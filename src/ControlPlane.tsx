import { useEffect, useMemo, useState } from "react";
import { deriveState } from "./core/graph/state";
import ScopeSelector from "./components/ScopeSelector";
import { SummaryCards } from "./components/SummaryCards";
import { StationList } from "./components/StationList";
import { GraphDebugPanel } from "./components/GraphDebugPanel";
import { buildGraphScope, getStationKey, getStationLabel, extractStations } from "./utils/graphBuilder";
import { buildCloseActivationMap, normalizeId, createApprovedScopePackage, computeScopeReplayState } from "./core/iof";
import type { CloseRecord, LoadedScope, GraphScopeVersion } from "./utils/graphBuilder";

const API_BASE =
  (import.meta as any)?.env?.VITE_IOF_API_BASE || "http://64.34.93.5:4000";

type ControlPlaneProps = {
  corridorId?: string;
  segmentId?: string;
};


export default function ControlPlane({
  corridorId = "",
  segmentId,
}: ControlPlaneProps) {
  const [selectedScopeVersionId, setSelectedScopeVersionId] = useState<string | null>(null);
  const [rawScope, setRawScope] = useState<LoadedScope | null>(null);
  const [closes, setCloses] = useState<CloseRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadScopeAndCloses() {
      if (!selectedScopeVersionId) {
        setRawScope(null);
        setCloses([]);
        setLoadError(null);
        return;
      }

      setRawScope(null);
      setCloses([]);
      setIsLoading(true);
      setLoadError(null);

      try {
        const scopeUrl = `${API_BASE}/scope/${selectedScopeVersionId}`;
        const scopeRes = await fetch(scopeUrl);

        if (!scopeRes.ok) {
          throw new Error(`Scope request failed: ${scopeRes.status}`);
        }

        const scopeData = (await scopeRes.json()) as LoadedScope;
        if (cancelled) return;

        const truth = (scopeData as any).canonicalTruth ?? scopeData;
        const mergedScope: LoadedScope = {
          ...truth,
          ...scopeData,
        };

        console.log("CONTROL SCOPE:", mergedScope);
        setRawScope(mergedScope);

        const corridor =
          (mergedScope as any).corridorId ||
          (mergedScope as any).corridor_id ||
          corridorId;
        const segment =
          (mergedScope as any).segmentId ||
          (mergedScope as any).segment_id ||
          segmentId ||
          "";

        if (!corridor) {
          setCloses([]);
          if (!cancelled) setIsLoading(false);
          return;
        }

        const closeUrl = `${API_BASE}/closes?corridorId=${encodeURIComponent(
          corridor
        )}&segmentId=${encodeURIComponent(segment)}&scopeVersionId=${encodeURIComponent(
          selectedScopeVersionId
        )}`;

        console.log("CONTROL CLOSE URL:", closeUrl);

        const closeRes = await fetch(closeUrl);
        if (!closeRes.ok) {
          throw new Error(`Close request failed: ${closeRes.status}`);
        }

        const closeData = (await closeRes.json()) as CloseRecord[];
        console.log("CONTROL CLOSES RAW:", closeData);

        const normalizedCloses = Array.isArray(closeData) ? closeData : [];
        console.log("CONTROL CLOSES NORMALIZED:", normalizedCloses);

        if (!cancelled) {
          setCloses(normalizedCloses);
        }
      } catch (err: any) {
        if (cancelled) return;
        setRawScope(null);
        setCloses([]);
        setLoadError(err?.message || "Unknown load error");
        console.error("Control load failed:", err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadScopeAndCloses();

    return () => {
      cancelled = true;
    };
  }, [selectedScopeVersionId, corridorId, segmentId, refreshKey]);

  useEffect(() => {
    const handleFocus = () => {
      if (selectedScopeVersionId) {
        setRefreshKey((current) => current + 1);
      }
    };

    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [selectedScopeVersionId]);

  const currentCorridorId =
    (rawScope as any)?.corridorId ||
    (rawScope as any)?.corridor_id ||
    corridorId;
  const currentSegmentId =
    (rawScope as any)?.segmentId ||
    (rawScope as any)?.segment_id ||
    segmentId ||
    "";

  const getStationActivationKey = (station: any) => normalizeId(station.stationId || station.station_id || station.id);

  const scopePackage = useMemo(() => {
    if (!rawScope?.canonicalTruth) return null;
    return createApprovedScopePackage({
      event: "scope.approved",
      corridorId: currentCorridorId,
      segmentId: currentSegmentId,
      scopeVersionId: selectedScopeVersionId || "control-derived",
      route: rawScope.canonicalTruth.route || [],
      stations: (rawScope.canonicalTruth.stations || []).map(s => ({
        id: s.stationId || s.id || '',
        stationId: s.stationId || s.id || '',
        lat: s.lat || 0,
        lon: s.lon || 0,
        feet: s.feet || 0,
      })),
      role: "metro", // Default role
      routeFeet: (rawScope.canonicalTruth.route || []).length * 100, // Estimate
      timestamp: rawScope.created_at || new Date().toISOString(),
      actor: "system",
      context: {},
    });
  }, [rawScope, selectedScopeVersionId, currentCorridorId, currentSegmentId]);

  const replayState = useMemo(() => {
    if (!scopePackage) return null;
    return computeScopeReplayState(scopePackage, closes as any[]);
  }, [scopePackage, closes]);

  const activationMap = useMemo(() => {
    return replayState?.activationMap || new Map();
  }, [replayState]);

  const activateStation = async (stationId: string) => {
    if (!selectedScopeVersionId) {
      return;
    }

    setIsLoading(true);

    try {
      const payload = {
        scopeVersionId: selectedScopeVersionId,
        corridorId: currentCorridorId,
        segmentId: currentSegmentId,
        stationId,
        closeType: "work.activated",
      };

      const response = await fetch(`${API_BASE}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Activation failed: ${response.status}`);
      }

      console.log("CONTROL STATION ACTIVATED", await response.json());
      setRefreshKey((current) => current + 1);
    } catch (err: any) {
      console.error("activateStation error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const stations = useMemo(() => {
    return rawScope ? extractStations(rawScope) : [];
  }, [rawScope]);

  const graphScope = useMemo<GraphScopeVersion>(() => {
    return buildGraphScope(
      rawScope,
      closes,
      selectedScopeVersionId || "control-derived",
      corridorId,
      segmentId
    );
  }, [rawScope, closes, selectedScopeVersionId, corridorId, segmentId]);

  const derivedState = useMemo(() => deriveState(graphScope as any), [graphScope]);

  const stationRows = useMemo(() => {
    return stations.map((station, index) => {
      const key = getStationKey(station, index);
      const label = getStationLabel(station, index);
      const nodeState = (derivedState as any)?.nodeStates?.[key];

      const edgeBlocked = Object.values(
        ((derivedState as any)?.edgeStates || {}) as Record<string, any>
      ).some((e: any) => e?.blocked);

      let displayState = nodeState?.status || "unknown";

      if (edgeBlocked && displayState === "unknown") {
        displayState = "constrained";
      }

      return {
        key,
        label,
        state: displayState,
        raw: station,
        activated: activationMap.get(getStationActivationKey(station)) === true,
        stationId: station.stationId || station.station_id || station.id || "",
      };
    });
  }, [stations, derivedState, activationMap]);

  const budgetModel = rawScope?.financialContext?.designBudgetModel;
  const budgetReleased = closes.some((close) => (close as any).closeType === "budget.released");
  const budgetReleaseStationId = stationRows[0]?.stationId || "";

  const releaseBudget = async () => {
    if (!selectedScopeVersionId || !budgetReleaseStationId) return;

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scopeVersionId: selectedScopeVersionId,
          corridorId: currentCorridorId,
          segmentId: currentSegmentId,
          stationId: budgetReleaseStationId,
          closeType: "budget.released",
          payload: {
            budgetReleased: true,
            releasedAt: new Date().toISOString(),
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Budget release failed: ${response.status}`);
      }

      setRefreshKey((current) => current + 1);
    } catch (err: any) {
      console.error("releaseBudget error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const summary = useMemo(() => {
    const totalStations = stationRows.length;
    const activeStations = stationRows.filter((s) => s.state === "active").length;
    const unknownStations = stationRows.filter(
      (s) => s.state === "unknown"
    ).length;
    const totalEvents = graphScope.events.length;

    return {
      totalStations,
      activeStations,
      unknownStations,
      totalEvents,
    };
  }, [stationRows, graphScope.events.length]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#020617",
        color: "#e5e7eb",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          padding: 16,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          borderBottom: "1px solid #1f2937",
        }}
      >
        <div style={{ fontSize: 24, fontWeight: 900 }}>StellaOS Control</div>
        <div style={{ opacity: 0.75, fontSize: 14 }}>
          Operational Activation + State Governance
        </div>
        <div style={{ fontSize: 12, opacity: 0.7 }}>
          ScopeVersion: {selectedScopeVersionId || "none selected"}
        </div>
      </div>

      <div
        style={{
          padding: 16,
        }}
      >
        <ScopeSelector
          selectedScopeVersionId={selectedScopeVersionId}
          onSelect={(id, scope) => {
            setSelectedScopeVersionId(id);
          }}
        />
      </div>

      <div
        style={{
          padding: 16,
        }}
      >
        <SummaryCards
          totalStations={summary.totalStations}
          activeStations={summary.activeStations}
          unknownStations={summary.unknownStations}
          totalEvents={summary.totalEvents}
        />

        <div style={{ marginTop: 12, padding: 14, background: "#111827", borderRadius: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, opacity: 0.75 }}>Design Budget</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>${budgetModel?.totalBid?.toLocaleString() ?? "0"}</div>
            </div>
            <button
              onClick={releaseBudget}
              disabled={budgetReleased || !budgetModel}
              style={{
                padding: "10px 16px",
                borderRadius: 8,
                border: "none",
                background: budgetReleased ? "#334155" : "#16a34a",
                color: "white",
                cursor: budgetReleased ? "not-allowed" : "pointer",
              }}
            >
              {budgetReleased ? "Budget Released" : "Release Budget"}
            </button>
          </div>
          {budgetModel && (
            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>
              {budgetReleased ? "Budget release has been recorded." : "Release budget to unlock funding for downstream execution."}
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          padding: "0 16px 16px 16px",
          display: "grid",
          gridTemplateColumns: "1.2fr 1fr",
          gap: 16,
          flex: 1,
          minHeight: 0,
        }}
      >
        <StationList
          stationRows={stationRows}
          isLoading={isLoading}
          loadError={loadError}
          onActivate={activateStation}
        />

        <GraphDebugPanel
          derivedState={derivedState}
          graphScope={graphScope}
          rawScope={rawScope}
          closes={closes}
        />
      </div>
    </div>
  );
}