import { useEffect, useMemo, useRef, useState } from "react";
import ScopeSelector from "./components/ScopeSelector";
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  buildCloseCountMap,
  buildLatestStationCloseMap,
  getCloseTimestamp,
  getCloseType,
  normalizeId,
  computeScopeReplayState,
  createApprovedScopePackage,
  computeFinancialState,
} from "./core/iof";

const IOF_API = "http://64.34.93.5:4000";
const LLM_API = "http://64.34.93.5:3001";

// Preserve existing Leaflet marker behavior.
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

type TwinStatus =
  | "planned"
  | "engineering"
  | "permitting"
  | "build"
  | "testing"
  | "complete"
  | "priced"
  | "in_progress";

type OperatorRole = "operator" | "human";

type TwinStation = {
  stationId: string;
  station?: string;
  lat: number;
  lon: number;
  status?: TwinStatus;
  latestCloseType?: string;
  latestCloseTime?: string;
  closeCount?: number;
};

type TwinPackage = {
  scopeVersionId: string;
  corridorId: string;
  segmentId: string;
  route: [number, number][];
  stations: TwinStation[];
};

type CloseRecord = {
  id?: string | number;
  station_id?: string;
  stationId?: string;
  close_type?: string;
  closeType?: string;
  created_at?: string;
  timestamp?: string;
};

type ScopeResponse = {
  scopeVersionId: string;
  corridorId: string;
  segmentId: string;
  canonicalTruth?: {
    route?: [number, number][];
    stations?: any[];
    stateModel?: any;
    closeTaxonomy?: Record<string, string[]>;
    constraints?: any;
    objects?: any[];
  };
  route?: [number, number][];
  stations?: any[];
  stateModel?: any;
  closeTaxonomy?: Record<string, string[]>;
  constraints?: any;
  objects?: any[];
};

type TwinInsightResponse = {
  result?: string;
  observations?: string[];
  anomalies?: string[];
  recommendations?: string[];
  nextActions?: string[];
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  speaker: OperatorRole;
  content: string;
  timestamp: number;
};

type StationMetric = {
  total: number;
  byStatus: Record<TwinStatus, number>;
};

const shellStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "380px minmax(0, 1fr) 420px",
  position: "fixed",
  top: 50,
  left: 0,
  width: "100vw",
  height: "calc(100vh - 50px)",
  background: "#0b1220",
  color: "#e5eefc",
  zIndex: 1,
};

const sideStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  minHeight: 0,
  gap: 14,
  padding: 16,
  background: "linear-gradient(180deg, #071224 0%, #08162d 100%)",
};

const panelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  minHeight: 0,
  background: "linear-gradient(180deg, #071224 0%, #08162d 100%)",
  border: "1px solid rgba(148, 163, 184, 0.16)",
  borderRadius: 18,
  padding: 16,
  boxShadow: "0 18px 50px rgba(0,0,0,0.28)",
};

const mapCardStyle: React.CSSProperties = {
  ...panelStyle,
  padding: 0,
  overflow: "hidden",
  position: "relative",
};

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 0.8,
  textTransform: "uppercase",
  color: "#8aa0bf",
  marginBottom: 8,
};

const buttonPrimary: React.CSSProperties = {
  background: "#2563eb",
  color: "#fff",
  border: "none",
  borderRadius: 10,
  padding: "10px 12px",
  fontWeight: 700,
  cursor: "pointer",
};

const buttonSecondary: React.CSSProperties = {
  background: "#0f172a",
  color: "#fff",
  border: "1px solid rgba(148,163,184,0.25)",
  borderRadius: 10,
  padding: "10px 12px",
  fontWeight: 700,
  cursor: "pointer",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(15, 23, 42, 0.92)",
  border: "1px solid rgba(148,163,184,0.2)",
  color: "#edf4ff",
  borderRadius: 10,
  padding: "10px 12px",
  outline: "none",
};

// PHASE 5.1E:
// Executive Program Execution panel.
// Presentation layer only.
// Future versions may bind to actual program budget and deployment metrics.
const programExecutionMetrics = [
  { label: "Approved Budget", value: "$12.4M" },
  { label: "Capital Deployed", value: "$3.1M" },
  { label: "Stations Planned", value: "686" },
  { label: "Schedule Health", value: "ON TRACK" },
] as const;

function closeTypeValue(close?: CloseRecord | any) {
  return getCloseType(close as any) || "";
}

function closeTimestampValue(close?: CloseRecord | any) {
  const timestamp = getCloseTimestamp(close as any);
  return timestamp > 0 ? new Date(timestamp).toISOString() : "";
}

function deriveStatus(closeType?: string): TwinStatus {
  if (!closeType) return "planned";
  const type = closeType.toLowerCase();

  if (type.includes("pricing")) return "priced";
  if (type.includes("engineering")) return "engineering";
  if (type.includes("permit")) return "permitting";
  if (type.includes("construction")) return "build";
  if (type.includes("splice")) return "testing";
  if (type.includes("asbuilt")) return "complete";

  return "in_progress";
}

function getStatusMeta(status?: TwinStatus) {
  switch (status) {
    case "engineering":
      return { color: "#f59e0b", label: "Engineering" };
    case "permitting":
      return { color: "#f97316", label: "Permitting" };
    case "build":
      return { color: "#ef4444", label: "Construction" };
    case "testing":
      return { color: "#8b5cf6", label: "Testing / Splice" };
    case "complete":
      return { color: "#22c55e", label: "Complete" };
    case "priced":
      return { color: "#06b6d4", label: "Priced" };
    case "in_progress":
      return { color: "#64748b", label: "In Progress" };
    case "planned":
    default:
      return { color: "#3b82f6", label: "Planned" };
  }
}

function makeStationIcon(status?: TwinStatus, active = false) {
  const meta = getStatusMeta(status);
  const size = active ? 18 : 14;
  const ring = active
    ? "0 0 0 4px rgba(255,255,255,0.25)"
    : "0 0 0 2px rgba(255,255,255,0.95)";

  return L.divIcon({
    className: "custom-station-icon",
    html: `<div style="
      width:${size}px;
      height:${size}px;
      border-radius:999px;
      background:${meta.color};
      box-shadow:${ring};
      border:1px solid rgba(15,23,42,0.5);
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function formatDate(value?: string) {
  if (!value) return "Unknown time";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return dt.toLocaleString();
}

function fitMapToData(
  map: L.Map | null,
  routePositions: [number, number][],
  stationPositions: { position: [number, number] }[]
) {
  if (!map) return;

  const points: L.LatLngExpression[] = [];
  if (routePositions.length) points.push(...routePositions);
  if (stationPositions.length)
    points.push(...stationPositions.map((s) => s.position));

  if (!points.length) return;

  const bounds = L.latLngBounds(points);
  map.fitBounds(bounds, { padding: [30, 30] });
}

function summarizeStatusCounts(stations: TwinStation[]): StationMetric {
  const byStatus: Record<TwinStatus, number> = {
    planned: 0,
    engineering: 0,
    permitting: 0,
    build: 0,
    testing: 0,
    complete: 0,
    in_progress: 0,
    priced: 0,
  };

  for (const station of stations) {
    const status = station.status || "planned";
    byStatus[status] = (byStatus[status] || 0) + 1;
  }

  return {
    total: stations.length,
    byStatus,
  };
}

function buildExecutionMap(closesData: CloseRecord[]) {
  return buildLatestStationCloseMap(closesData as any[], {
    ignorePricing: true,
  });
}

function buildMergedStations(
  sourceStations: any[],
  replayState: any
): TwinStation[] {
  if (!replayState) return sourceStations.map(s => ({ ...s, status: "pending", latestCloseType: undefined, latestCloseTime: undefined, closeCount: 0 }));

  return (sourceStations || []).map((s: any) => {
    const stationId = normalizeId(s.stationId);
    const stationState = replayState.stations.get(stationId);

    return {
      ...s,
      lat: Number(s.lat),
      lon: Number(s.lon),
      status: stationState?.status || "pending",
      latestCloseType: stationState?.latestCloseType,
      latestCloseTime: stationState?.latestCloseTime ? new Date(stationState.latestCloseTime).toISOString() : undefined,
      closeCount: stationState?.closeCount || 0,
    };
  });
}

function inferAnomalies(
  stations: TwinStation[],
  closes: CloseRecord[]
): string[] {
  const anomalies: string[] = [];

  const closeCounts = buildCloseCountMap(closes as any[]);

  for (const station of stations) {
    const status = station.status || "planned";

    if (
      status === "in_progress" &&
      (!station.latestCloseType || station.closeCount === 0)
    ) {
      anomalies.push(
        `${station.stationId} is marked in progress without a clear latest close record.`
      );
    }

    if (status === "complete" && (station.closeCount || 0) < 1) {
      anomalies.push(
        `${station.stationId} appears complete but has no counted close history.`
      );
    }

    const count = closeCounts.get(normalizeId(station.stationId)) || 0;
    if (count > 6) {
      anomalies.push(
        `${station.stationId} has unusually dense close activity (${count} closes).`
      );
    }
  }

  return anomalies.slice(0, 8);
}

function inferRecommendations(stations: TwinStation[]): string[] {
  const recommendations: string[] = [];

  const planned = stations.filter((s) => (s.status || "planned") === "planned");
  const engineering = stations.filter((s) => s.status === "engineering");
  const permitting = stations.filter((s) => s.status === "permitting");
  const build = stations.filter((s) => s.status === "build");
  const testing = stations.filter((s) => s.status === "testing");

  if (planned.length) {
    recommendations.push(
      `${planned.length} stations remain in planned state. Confirm whether engineering closes should begin on the earliest eligible span.`
    );
  }

  if (engineering.length) {
    recommendations.push(
      `${engineering.length} stations are in engineering. Review whether permit approvals should now be the next focus.`
    );
  }

  if (permitting.length) {
    recommendations.push(
      `${permitting.length} stations are in permitting. Watch for permit bottlenecks before construction handoff.`
    );
  }

  if (build.length) {
    recommendations.push(
      `${build.length} stations are in construction. Prepare splice/testing visibility where construction is nearing completion.`
    );
  }

  if (testing.length) {
    recommendations.push(
      `${testing.length} stations are in testing. Verify whether as-built verification is the next close surface.`
    );
  }

  if (!recommendations.length) {
    recommendations.push(
      "No obvious execution recommendation surfaced from current station state."
    );
  }

  return recommendations.slice(0, 8);
}

function buildTwinPromptContext(
  pkg: TwinPackage | null,
  closes: CloseRecord[],
  selectedStationId: string | null,
  truthMeta?: ScopeResponse["canonicalTruth"]
) {
  return {
    scopeVersionId: pkg?.scopeVersionId || null,
    corridorId: pkg?.corridorId || null,
    segmentId: pkg?.segmentId || null,
    route: pkg?.route || [],
    stations:
      (pkg?.stations || []).map((s) => ({
        stationId: s.stationId,
        station: s.station,
        lat: s.lat,
        lon: s.lon,
        status: s.status,
        latestCloseType: s.latestCloseType,
        latestCloseTime: s.latestCloseTime,
        closeCount: s.closeCount,
      })) || [],
    closes: closes.map((c) => ({
      stationId: c.station_id || c.stationId,
      closeType: c.close_type || c.closeType,
      timestamp: c.created_at || c.timestamp,
    })),
    selectedStationId,
    stateModel: truthMeta?.stateModel || null,
    closeTaxonomy: truthMeta?.closeTaxonomy || null,
    constraints: truthMeta?.constraints || null,
    objects: truthMeta?.objects || null,
  };
}

async function callTwinOperator(params: {
  pkg: TwinPackage | null;
  closes: CloseRecord[];
  selectedStationId: string | null;
  truthMeta?: ScopeResponse["canonicalTruth"];
  message: string;
}): Promise<TwinInsightResponse> {

  const body = {
    message: params.message,

    scopeVersionId: params.pkg?.scopeVersionId,

    route: params.pkg?.route?.slice(0, 10) || [],

    stations: params.pkg?.stations?.slice(0, 20) || [],

    closes: params.closes?.slice(0, 50) || [],

    selectedStationId: params.selectedStationId,
  };

  console.log("🚀 TWIN BODY:", body); // optional debug

  const res = await fetch(`${LLM_API}/api/twin`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Twin operator failed: ${res.status} ${text}`);
  }

  return res.json();
}

export default function TwinMode() {
  const [scopeVersion, setScopeVersion] = useState<string | null>(null);
  const [pkg, setPkg] = useState<TwinPackage | null>(null);
  const [scopeData, setScopeData] = useState<any>(null);
  const [closes, setCloses] = useState<CloseRecord[]>([]);
  const [truthMeta, setTruthMeta] = useState<ScopeResponse["canonicalTruth"]>();
  const [loading, setLoading] = useState(false);
  const [operatorLoading, setOperatorLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedStationId, setSelectedStationId] = useState<string | null>(
    null
  );
  const [operatorMode, setOperatorMode] = useState<OperatorRole>("operator");
  const [consoleInput, setConsoleInput] = useState("");
  const [consoleMessages, setConsoleMessages] = useState<ChatMessage[]>([]);
  const [operatorSummary, setOperatorSummary] = useState<string>("");
  const [operatorObservations, setOperatorObservations] = useState<string[]>(
    []
  );
  const [operatorAnomalies, setOperatorAnomalies] = useState<string[]>([]);
  const [operatorRecommendations, setOperatorRecommendations] = useState<
    string[]
  >([]);
  const [operatorNextActions, setOperatorNextActions] = useState<string[]>([]);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!scopeVersion) {
      setPkg(null);
      setCloses([]);
      setTruthMeta(undefined);
      setError(null);
      setSelectedStationId(null);
      setConsoleMessages([]);
      setOperatorSummary("");
      setOperatorObservations([]);
      setOperatorAnomalies([]);
      setOperatorRecommendations([]);
      setOperatorNextActions([]);
      return;
    }

    let cancelled = false;

    async function loadTwin() {
      setLoading(true);
      setError(null);

      try {
        const scopeRes = await fetch(`${IOF_API}/scope/${scopeVersion}`);
        if (!scopeRes.ok) {
          throw new Error(`Scope request failed: ${scopeRes.status}`);
        }

        const scope: ScopeResponse = await scopeRes.json();
        const truth = scope.canonicalTruth ?? scope;

        const closeRes = await fetch(
          `${IOF_API}/closes?corridorId=${scope.corridorId}&segmentId=${scope.segmentId}&scopeVersionId=${scope.scopeVersionId}`
        );
        if (!closeRes.ok) {
          throw new Error(`Close request failed: ${closeRes.status}`);
        }

        const closesData: CloseRecord[] = await closeRes.json();

        if (!cancelled) {
          setTruthMeta(scope.canonicalTruth);
          setCloses(closesData);
          setScopeData(scope);
          setPkg({
            scopeVersionId: scope.scopeVersionId,
            corridorId: scope.corridorId,
            segmentId: scope.segmentId,
            route: truth.route || [],
            stations: truth.stations || [],
            closeTaxonomy: truth.closeTaxonomy,
            stateModel: truth.stateModel,
          });
          setSelectedStationId((truth.stations || [])[0]?.stationId ?? null);

          // Initial messages, will be updated by useEffect
          const initialStationCount = (truth.stations || []).length;
          setOperatorSummary(
            `Twin loaded for ${scope.scopeVersionId}. ${initialStationCount} stations and ${closesData.length} closes are now in view.`
          );
          setOperatorObservations([
            `Corridor ${scope.corridorId} / Segment ${scope.segmentId} loaded.`,
          ]);
          setOperatorAnomalies([]);
          setOperatorRecommendations([]);
          setOperatorNextActions([
            "Select a station to inspect current execution state.",
            "Use Operator mode to ask for anomalies, drift, or next likely close.",
            "Use Human mode to ask for a plain-language explanation.",
          ]);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || "Unable to load twin data");
          setPkg(null);
          setCloses([]);
          setTruthMeta(undefined);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadTwin();

    return () => {
      cancelled = true;
    };
  }, [scopeVersion]);

  const routePositions = useMemo<[number, number][]>(() => {
    if (!pkg?.route?.length) return [];

    return pkg.route
      .filter((p) => Array.isArray(p) && p.length === 2)
      .map((p) => [Number(p[1]), Number(p[0])]);
  }, [pkg]);

  const stationPositions = useMemo(() => {
    if (!pkg?.stations?.length) return [];

    return pkg.stations
      .filter(
        (s) =>
          Number.isFinite(Number(s.lat)) && Number.isFinite(Number(s.lon))
      )
      .map((s) => ({
        ...s,
        position: [Number(s.lat), Number(s.lon)] as [number, number],
      }));
  }, [pkg?.stations]);

  const latestCloses = useMemo(() => {
    return [...closes].sort(
      (a, b) =>
        new Date(closeTimestampValue(b)).getTime() -
        new Date(closeTimestampValue(a)).getTime()
    );
  }, [closes]);

  const scopePackage = useMemo(() => {
    if (!scopeData?.canonicalTruth) return null;
    return createApprovedScopePackage({
      event: "scope.approved",
      corridorId: scopeData.corridorId,
      segmentId: scopeData.segmentId,
      scopeVersionId: scopeVersion || "twin-derived",
      route: scopeData.canonicalTruth.route || [],
      stations: (scopeData.canonicalTruth.stations || []).map(s => ({
        id: s.stationId || s.id || '',
        stationId: s.stationId || s.id || '',
        lat: s.lat || 0,
        lon: s.lon || 0,
        feet: s.feet || 0,
      })),
      role: "metro",
      routeFeet: (scopeData.canonicalTruth.route || []).length * 100,
      timestamp: scopeData.created_at || new Date().toISOString(),
      actor: "system",
      context: {},
    });
  }, [scopeData, scopeVersion]);

  const replayState = useMemo(() => {
    if (!scopePackage) return null;
    return computeScopeReplayState(scopePackage, closes as any[]);
  }, [scopePackage, closes]);

  const financialState = useMemo(() => {
    if (!scopePackage) return null;
    // Derive economic truth from operational runtime
    return computeFinancialState(scopePackage, closes as any[]);
  }, [scopePackage, closes]);

  const mergedStations = useMemo(() => {
    if (!pkg?.stations || !replayState) return [];
    return buildMergedStations(pkg.stations, replayState);
  }, [pkg?.stations, replayState]);

  const statusCounts = useMemo(() => {
    return summarizeStatusCounts(mergedStations);
  }, [mergedStations]);

  const mergedStationPositions = useMemo(() => {
    if (!mergedStations.length) return [];

    return mergedStations
      .filter(
        (s) =>
          Number.isFinite(Number(s.lat)) && Number.isFinite(Number(s.lon))
      )
      .map((s) => ({
        ...s,
        position: [Number(s.lat), Number(s.lon)] as [number, number],
      }));
  }, [mergedStations]);

  const selectedStation = useMemo(() => {
    if (!selectedStationId) return null;
    return mergedStationPositions.find((s) => s.stationId === selectedStationId) ?? null;
  }, [selectedStationId, mergedStationPositions]);

  const selectedStationCloses = useMemo(() => {
    if (!selectedStationId) return [];

    return latestCloses.filter(
      (c) => normalizeId(c.station_id || c.stationId) === normalizeId(selectedStationId)
    );
  }, [latestCloses, selectedStationId]);

  useEffect(() => {
    fitMapToData(mapRef.current, routePositions, mergedStationPositions);
  }, [routePositions, mergedStationPositions]);

  useEffect(() => {
    if (mergedStations.length > 0 && closes.length >= 0) {
      const localAnomalies = inferAnomalies(mergedStations, closes);
      const localRecommendations = inferRecommendations(mergedStations);

      setOperatorObservations([
        `Corridor ${pkg?.corridorId} / Segment ${pkg?.segmentId} loaded.`,
        `${mergedStations.filter((s) => s.status === "complete").length} stations are complete.`,
        `${mergedStations.filter((s) => s.status === "planned").length} stations remain planned.`,
      ]);
      setOperatorAnomalies(localAnomalies);
      setOperatorRecommendations(localRecommendations);
    }
  }, [mergedStations, closes, pkg?.corridorId, pkg?.segmentId]);

  async function handleConsoleSend() {
    const message = consoleInput.trim();
    if (!message || !pkg) return;

    const userMessage: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      speaker: operatorMode,
      content: message,
      timestamp: Date.now(),
    };

    setConsoleMessages((prev) => [...prev, userMessage]);
    setConsoleInput("");
    setOperatorLoading(true);

    try {
      const response = await callTwinOperator({
        pkg,
        closes,
        selectedStationId,
        truthMeta,
        message:
          operatorMode === "operator"
            ? `Operator request: ${message}`
            : `Human request: ${message}`,
      });

      const reply = response.result || "Twin operator returned no narrative reply.";

      setOperatorSummary(reply);
      setOperatorObservations(response.observations || []);
      setOperatorAnomalies(response.anomalies || []);
      setOperatorRecommendations(response.recommendations || []);
      setOperatorNextActions(response.nextActions || []);

      const assistantMessage: ChatMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        speaker: operatorMode,
        content: reply,
        timestamp: Date.now(),
      };

      setConsoleMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      const assistantMessage: ChatMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        speaker: operatorMode,
        content: err?.message || "Twin operator call failed.",
        timestamp: Date.now(),
      };

      setConsoleMessages((prev) => [...prev, assistantMessage]);
    } finally {
      setOperatorLoading(false);
    }
  }

  function runLocalOperatorSnapshot() {
    if (!pkg) return;

    const localAnomalies = inferAnomalies(pkg.stations, closes);
    const localRecommendations = inferRecommendations(pkg.stations);

    setOperatorSummary(
      `Local Twin snapshot refreshed for ${pkg.scopeVersionId}. Execution state was interpreted from current scope truth and close history.`
    );
    setOperatorObservations([
      `${pkg.stations.length} stations loaded into Twin.`,
      `${closes.length} closes are currently linked to this scope.`,
      `${statusCounts.byStatus.complete || 0} stations are complete and ${statusCounts.byStatus.build || 0} are in build.`,
    ]);
    setOperatorAnomalies(localAnomalies);
    setOperatorRecommendations(localRecommendations);
    setOperatorNextActions([
      "Inspect selected station close history.",
      "Ask Twin Operator to explain bottlenecks.",
      "Switch to Human mode for plain-language summary.",
    ]);
  }

  return (
    <div style={shellStyle}>
      <aside style={sideStyle}>
        <div style={panelStyle}>
          <div style={{ marginBottom: 16 }}>
            <div style={sectionLabelStyle}>Teralinx Twin</div>
            <div
              style={{
                fontSize: 34,
                fontWeight: 800,
                lineHeight: 1.05,
                marginBottom: 8,
              }}
            >
              Live Scope State
            </div>
            <div style={{ color: "#93a7c5", fontSize: 14, lineHeight: 1.5 }}>
              Operational Replay + Derived State
              <br />
              Powered by IOF
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={sectionLabelStyle}>Select Scope Version</div>
            <ScopeSelector onSelect={setScopeVersion} />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 10,
              marginBottom: 16,
            }}
          >
            <StatCard label="Stations" value={pkg?.stations.length ?? 0} />
            <StatCard label="Closes" value={closes.length} />
            <StatCard label="Corridor" value={pkg?.corridorId ?? "—"} small />
            <StatCard label="Segment" value={pkg?.segmentId ?? "—"} small />
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={sectionLabelStyle}>Execution Overview</div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: 8,
              }}
            >
              {(
                [
                  "planned",
                  "engineering",
                  "permitting",
                  "build",
                  "testing",
                  "complete",
                ] as TwinStatus[]
              ).map((status) => {
                const meta = getStatusMeta(status);
                return (
                  <div
                    key={status}
                    style={{
                      background: "rgba(15, 23, 42, 0.55)",
                      border: "1px solid rgba(148, 163, 184, 0.12)",
                      borderRadius: 12,
                      padding: "10px 12px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 6,
                      }}
                    >
                      <div
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 999,
                          background: meta.color,
                        }}
                      />
                      <div style={{ fontSize: 12, color: "#9fb2cf" }}>
                        {meta.label}
                      </div>
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 800 }}>
                      {statusCounts.byStatus[status] || 0}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {financialState?.overall && (
            <div style={{ marginBottom: 16 }}>
              <div style={sectionLabelStyle}>Program Execution</div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: 8,
                }}
              >
                {programExecutionMetrics.map((metric) => (
                  <StatCard
                    key={metric.label}
                    label={metric.label}
                    value={metric.value}
                  />
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
            <div style={sectionLabelStyle}>Close History</div>
            <div
              style={{
                overflowY: "auto",
                paddingRight: 4,
                display: "flex",
                flexDirection: "column",
                gap: 8,
                minHeight: 180,
                maxHeight: 320,
              }}
            >
              {!scopeVersion && (
                <EmptyState text="Select a scope version to load the twin." />
              )}
              {scopeVersion && loading && (
                <EmptyState text="Loading twin data..." />
              )}
              {scopeVersion && !loading && error && (
                <EmptyState text={error} danger />
              )}
              {scopeVersion &&
                !loading &&
                !error &&
                latestCloses.length === 0 && (
                  <EmptyState text="No closes yet for this scope." />
                )}

              {scopeVersion &&
                !loading &&
                !error &&
                latestCloses.map((c, idx) => {
                  const type = closeTypeValue(c) || "Unknown close";
                  const stationId = c.station_id || c.stationId || "Unknown station";
                  const status = deriveStatus(type);
                  const meta = getStatusMeta(status);

                  return (
                    <button
                      key={`${c.id ?? idx}-${stationId}-${type}`}
                      type="button"
                      onClick={() => setSelectedStationId(stationId)}
                      style={{
                        textAlign: "left",
                        background: "rgba(15, 23, 42, 0.78)",
                        border: "1px solid rgba(148, 163, 184, 0.14)",
                        borderRadius: 14,
                        padding: 12,
                        color: "#f8fbff",
                        cursor: "pointer",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          marginBottom: 6,
                        }}
                      >
                        <div style={{ fontWeight: 700, lineHeight: 1.3 }}>
                          {type}
                        </div>
                        <div
                          style={{
                            whiteSpace: "nowrap",
                            fontSize: 11,
                            color: meta.color,
                            fontWeight: 700,
                          }}
                        >
                          {meta.label}
                        </div>
                      </div>
                      <div
                        style={{ fontSize: 12, color: "#9fb2cf", marginBottom: 4 }}
                      >
                        Station: {stationId}
                      </div>
                      <div style={{ fontSize: 12, color: "#7f93b3" }}>
                        {formatDate(closeTimestampValue(c))}
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      </aside>

      <section style={mapCardStyle}>
        <div
          style={{
            position: "absolute",
            zIndex: 500,
            top: 14,
            left: 14,
            right: 14,
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              pointerEvents: "auto",
              background: "rgba(7, 18, 36, 0.86)",
              color: "#edf4ff",
              border: "1px solid rgba(148, 163, 184, 0.2)",
              borderRadius: 14,
              padding: "12px 14px",
              minWidth: 280,
              backdropFilter: "blur(8px)",
            }}
          >
            <div
              style={{
                fontSize: 12,
                textTransform: "uppercase",
                letterSpacing: 0.8,
                color: "#8ea4c4",
              }}
            >
              Active Scope
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>
              {pkg?.scopeVersionId || scopeVersion || "No scope selected"}
            </div>
            <div style={{ fontSize: 13, color: "#a9bbd6", marginTop: 4 }}>
              {pkg
                ? `${pkg.corridorId} / ${pkg.segmentId}`
                : "Select a scope to load route and station state."}
            </div>
          </div>

          <div
            style={{
              pointerEvents: "auto",
              background: "rgba(7, 18, 36, 0.86)",
              border: "1px solid rgba(148, 163, 184, 0.2)",
              borderRadius: 14,
              padding: "12px 14px",
              minWidth: 280,
              maxWidth: 360,
              backdropFilter: "blur(8px)",
            }}
          >
            <div
              style={{
                fontSize: 12,
                textTransform: "uppercase",
                letterSpacing: 0.8,
                color: "#8ea4c4",
                marginBottom: 6,
              }}
            >
              Selected Station
            </div>
            {selectedStation ? (
              <>
                <div style={{ fontSize: 16, fontWeight: 800 }}>
                  {selectedStation.station || selectedStation.stationId}
                </div>
                <div style={{ fontSize: 13, color: "#a9bbd6", marginTop: 4 }}>
                  {selectedStation.stationId}
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginTop: 8,
                  }}
                >
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 999,
                      background: getStatusMeta(selectedStation.status).color,
                    }}
                  />
                  <div style={{ fontSize: 13, color: "#dce7f8" }}>
                    {getStatusMeta(selectedStation.status).label}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "#89a0c0", marginTop: 8 }}>
                  Lat {selectedStation.lat.toFixed(6)} / Lon{" "}
                  {selectedStation.lon.toFixed(6)}
                </div>
                <div style={{ fontSize: 12, color: "#89a0c0", marginTop: 4 }}>
                  Closes: {selectedStation.closeCount || 0}
                </div>
                {selectedStation.latestCloseType && (
                  <div style={{ fontSize: 12, color: "#89a0c0", marginTop: 4 }}>
                    Latest: {selectedStation.latestCloseType}
                  </div>
                )}
              </>
            ) : (
              <div style={{ fontSize: 13, color: "#a9bbd6" }}>
                Select a station from the map or close history.
              </div>
            )}
          </div>
        </div>

        {!scopeVersion ? (
          <CenterMessage
            title="Twin ready"
            body="Select a scope version to open the route, stations, and execution state."
          />
        ) : loading ? (
          <CenterMessage
            title="Loading twin"
            body="Fetching canonical truth and close history..."
          />
        ) : error ? (
          <CenterMessage title="Unable to load twin" body={error} danger />
        ) : (
          <MapContainer
            key={scopeVersion}
            center={[37, -95]}
            zoom={5}
            style={{ height: "100%", width: "100%", background: "#0b1320" }}
            whenReady={(e: any) => {
              mapRef.current = e.target;
            }}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

            {routePositions.length > 0 && (
              <Polyline
                positions={routePositions}
                pathOptions={{ color: "#38bdf8", weight: 4, opacity: 0.85 }}
              />
            )}

            {mergedStationPositions.map((s, i) => {
              const active = selectedStationId === s.stationId;

              return (
                <Marker
                  key={s.stationId || `station-${i}`}
                  position={s.position}
                  icon={makeStationIcon(s.status, active) as any}
                  eventHandlers={{
                    click: () => setSelectedStationId(s.stationId),
                  }}
                >
                  <Popup>
                    <div style={{ minWidth: 200 }}>
                      <div style={{ fontWeight: 800, marginBottom: 4 }}>
                        {s.station || s.stationId}
                      </div>
                      <div style={{ marginBottom: 4 }}>
                        Station ID: {s.stationId}
                      </div>
                      <div style={{ marginBottom: 4 }}>
                        Status: {getStatusMeta(s.status).label}
                      </div>
                      {s.latestCloseType && (
                        <div style={{ marginBottom: 4 }}>
                          Latest Close: {s.latestCloseType}
                        </div>
                      )}
                      {s.latestCloseTime && (
                        <div style={{ marginBottom: 4 }}>
                          Time: {formatDate(s.latestCloseTime)}
                        </div>
                      )}

                      {financialState && (
                        <>
                          <div
                            style={{
                              marginTop: 8,
                              paddingTop: 8,
                              borderTop: "1px solid rgba(148,163,184,0.2)",
                              fontSize: 12,
                            }}
                          >
                            <div style={{ marginBottom: 3 }}>
                              Install: $
                              {Math.round(
                                (financialState.segments.get(normalizeId(s.stationId))
                                  ?.totalInstallCost || 0) / 1000
                              )}
                              k
                            </div>
                            <div style={{ marginBottom: 3 }}>
                              Revenue: $
                              {Math.round(
                                (financialState.segments.get(normalizeId(s.stationId))
                                  ?.totalAllocatedRevenue || 0) * 12 / 1000
                              )}
                              k/yr
                            </div>
                            <div>
                              Payback:{" "}
                              {Math.round(
                                financialState.segments.get(normalizeId(s.stationId))
                                  ?.averagePaybackMonths || 0
                              )}{" "}
                              mo
                            </div>
                          </div>
                        </>
                      )}

                      <div style={{ fontSize: 12, opacity: 0.8, marginTop: 8 }}>
                        {s.lat.toFixed(6)}, {s.lon.toFixed(6)}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        )}
      </section>

      <aside style={sideStyle}>
        <div style={panelStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <div>
              <div style={sectionLabelStyle}>Twin Console</div>
              <div style={{ fontSize: 24, fontWeight: 800 }}>
                Teralinx Operations Console
              </div>
              <div style={{ color: "#93a7c5", fontSize: 13, marginTop: 4 }}>
                Powered by IOF Reasoning Fabric
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: 6,
                alignItems: "flex-start",
              }}
            >
              <button
                type="button"
                onClick={() => setOperatorMode("operator")}
                style={{
                  ...(operatorMode === "operator"
                    ? buttonPrimary
                    : buttonSecondary),
                  padding: "8px 10px",
                }}
              >
                Operator
              </button>
              <button
                type="button"
                onClick={() => setOperatorMode("human")}
                style={{
                  ...(operatorMode === "human"
                    ? buttonPrimary
                    : buttonSecondary),
                  padding: "8px 10px",
                }}
              >
                Human
              </button>
            </div>
          </div>

          <div
            style={{
              marginTop: 14,
              display: "grid",
              gap: 10,
            }}
          >
            <div
              style={{
                borderRadius: 14,
                background: "rgba(15,23,42,0.55)",
                border: "1px solid rgba(148,163,184,0.12)",
                padding: 12,
              }}
            >
              <div style={sectionLabelStyle}>Twin Summary</div>
              <div style={{ fontSize: 14, color: "#dce7f8", lineHeight: 1.55 }}>
                {operatorSummary || "Twin summary will appear here."}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={runLocalOperatorSnapshot}
                style={{ ...buttonSecondary, flex: 1 }}
                disabled={!pkg}
              >
                Refresh Local Snapshot
              </button>
            </div>

            <div
              style={{
                height: 220,
                overflowY: "auto",
                borderRadius: 14,
                background: "rgba(2,6,23,0.65)",
                border: "1px solid rgba(148,163,184,0.12)",
                padding: 12,
              }}
            >
              {consoleMessages.length === 0 ? (
                <div style={{ fontSize: 13, color: "#9fb2cf", lineHeight: 1.6 }}>
                  Use Operator mode for grounded execution analysis. Use Human
                  mode for plainer explanation of what the twin is showing.
                </div>
              ) : (
                consoleMessages.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      marginBottom: 12,
                      padding: 10,
                      borderRadius: 12,
                      background:
                        m.role === "user"
                          ? "rgba(37,99,235,0.18)"
                          : "rgba(15,23,42,0.82)",
                      border: "1px solid rgba(148,163,184,0.12)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        textTransform: "uppercase",
                        letterSpacing: 0.8,
                        color: m.role === "user" ? "#93c5fd" : "#86efac",
                        marginBottom: 6,
                        fontWeight: 800,
                      }}
                    >
                      {m.role} · {m.speaker}
                    </div>
                    <div style={{ fontSize: 13, color: "#edf4ff", lineHeight: 1.55 }}>
                      {m.content}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              <input
                value={consoleInput}
                onChange={(e) => setConsoleInput(e.target.value)}
                placeholder={
                  operatorMode === "operator"
                    ? "Ask Twin Operator about anomalies, state drift, or next close..."
                    : "Ask Twin to explain this scope in plain language..."
                }
                style={inputStyle}
              />
              <button
                type="button"
                onClick={handleConsoleSend}
                style={buttonPrimary}
                disabled={!pkg || operatorLoading}
              >
                {operatorLoading ? "Thinking..." : "Send to Twin Operator"}
              </button>
            </div>
          </div>
        </div>

        <div style={{ ...panelStyle, flex: 1 }}>
          <div style={sectionLabelStyle}>Analysis Surface</div>

          <InfoBlock
            title="Observations"
            items={operatorObservations}
            empty="No observations yet."
            accent="#38bdf8"
          />

          <InfoBlock
            title="Anomalies"
            items={operatorAnomalies}
            empty="No anomalies surfaced."
            accent="#f97316"
          />

          <InfoBlock
            title="Recommendations"
            items={operatorRecommendations}
            empty="No recommendations surfaced."
            accent="#22c55e"
          />

          <InfoBlock
            title="Next Actions"
            items={operatorNextActions}
            empty="No next actions surfaced."
            accent="#a78bfa"
          />

          <div style={{ marginTop: 12 }}>
            <div style={sectionLabelStyle}>Selected Station History</div>
            <div
              style={{
                borderRadius: 14,
                background: "rgba(15,23,42,0.55)",
                border: "1px solid rgba(148,163,184,0.12)",
                padding: 12,
                maxHeight: 220,
                overflowY: "auto",
              }}
            >
              {!selectedStationId ? (
                <div style={{ fontSize: 13, color: "#9fb2cf" }}>
                  Select a station to inspect its close history.
                </div>
              ) : selectedStationCloses.length === 0 ? (
                <div style={{ fontSize: 13, color: "#9fb2cf" }}>
                  No closes recorded for {selectedStationId}.
                </div>
              ) : (
                selectedStationCloses.map((close, idx) => (
                  <div
                    key={`${selectedStationId}-${idx}-${close.id ?? "close"}`}
                    style={{
                      padding: "10px 0",
                      borderBottom:
                        idx === selectedStationCloses.length - 1
                          ? "none"
                          : "1px solid rgba(148,163,184,0.1)",
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#edf4ff" }}>
                      {closeTypeValue(close) || "Unknown close"}
                    </div>
                    <div style={{ fontSize: 12, color: "#9fb2cf", marginTop: 2 }}>
                      {formatDate(closeTimestampValue(close))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function StatCard({
  label,
  value,
  small = false,
}: {
  label: string;
  value: string | number;
  small?: boolean;
}) {
  return (
    <div
      style={{
        background: "rgba(15, 23, 42, 0.55)",
        border: "1px solid rgba(148, 163, 184, 0.12)",
        borderRadius: 14,
        padding: 12,
      }}
    >
      <div
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: 0.8,
          color: "#88a0c2",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontWeight: 800,
          fontSize: small ? 14 : 24,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function EmptyState({
  text,
  danger = false,
}: {
  text: string;
  danger?: boolean;
}) {
  return (
    <div
      style={{
        borderRadius: 14,
        padding: 14,
        background: danger
          ? "rgba(127, 29, 29, 0.22)"
          : "rgba(15, 23, 42, 0.55)",
        border: `1px solid ${
          danger
            ? "rgba(248, 113, 113, 0.25)"
            : "rgba(148, 163, 184, 0.12)"
        }`,
        color: danger ? "#fecaca" : "#9fb2cf",
        fontSize: 13,
      }}
    >
      {text}
    </div>
  );
}

function CenterMessage({
  title,
  body,
  danger = false,
}: {
  title: string;
  body: string;
  danger?: boolean;
}) {
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "radial-gradient(circle at center, rgba(15,23,42,0.82), rgba(2,6,23,0.96))",
        color: "#e6eefb",
        textAlign: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          maxWidth: 420,
          borderRadius: 18,
          border: `1px solid ${
            danger
              ? "rgba(248,113,113,0.25)"
              : "rgba(148,163,184,0.16)"
          }`,
          background: danger
            ? "rgba(127,29,29,0.16)"
            : "rgba(15,23,42,0.5)",
          padding: 24,
          boxShadow: "0 18px 50px rgba(0,0,0,0.28)",
        }}
      >
        <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>
          {title}
        </div>
        <div style={{ fontSize: 14, color: "#9fb2cf", lineHeight: 1.6 }}>
          {body}
        </div>
      </div>
    </div>
  );
}

function InfoBlock({
  title,
  items,
  empty,
  accent,
}: {
  title: string;
  items: string[];
  empty: string;
  accent: string;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={sectionLabelStyle}>{title}</div>
      <div
        style={{
          borderRadius: 14,
          background: "rgba(15,23,42,0.55)",
          border: "1px solid rgba(148,163,184,0.12)",
          padding: 12,
        }}
      >
        {!items.length ? (
          <div style={{ fontSize: 13, color: "#9fb2cf" }}>{empty}</div>
        ) : (
          items.map((item, idx) => (
            <div
              key={`${title}-${idx}`}
              style={{
                display: "flex",
                gap: 10,
                padding: "8px 0",
                borderBottom:
                  idx === items.length - 1
                    ? "none"
                    : "1px solid rgba(148,163,184,0.08)",
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: accent,
                  marginTop: 6,
                  flexShrink: 0,
                }}
              />
              <div style={{ fontSize: 13, color: "#e5eefc", lineHeight: 1.55 }}>
                {item}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
