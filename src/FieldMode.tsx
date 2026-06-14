import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import ScopeSelector from "./components/ScopeSelector";
import StationSelector from "./components/StationSelector";
import CloseAction from "./components/CloseAction";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline
} from "react-leaflet";
import L from "leaflet";
import { ROLE_PERMISSIONS } from "./config/roles";
import {
  buildCloseActivationMap,
  buildLatestStationCloseMap,
  getCloseType,
  getNextCloseTypeFromSequence,
  getNextCloseTypeForObject,
  normalizeId,
  computeScopeReplayState,
  createApprovedScopePackage,
} from "./core/iof";

// -----------------------------
// Marker Icons
// -----------------------------

const blueIcon = L.divIcon({
  className: "",
  html: `<div style="
    width:10px;
    height:10px;
    border-radius:50%;
    background:#3b82f6;
    border:2px solid white;
  "></div>`
});

const selectedIcon = L.divIcon({
  className: "",
  html: `<div style="
    width:12px;
    height:12px;
    border-radius:50%;
    background:#f59e0b;
    border:2px solid white;
  "></div>`
});

const gpsClosedIcon = L.divIcon({
  className: "",
  html: `<div style="
    width:12px;
    height:12px;
    border-radius:50%;
    background:#f97316;
    border:2px solid white;
  "></div>`
});

type ScopeSummary = {
  corridorId: string;
  segmentId: string;
};

type GPSState = {
  lat: number;
  lon: number;
};

type Station = {
  stationId: string;
  station?: string;
  lat: number;
  lon: number;
  [key: string]: any;
};

type ScopeObject = {
  objectId: string;
  objectType?: string;
  networkRole?: string;
  activated?: boolean;
  [key: string]: any;
};

type CloseRecord = {
  closeId?: string;
  closureid?: string;
  created_at?: string;
  timestamp?: string;
  scope_version_id?: string;
  scopeVersionId?: string;
  station_id?: string;
  stationId?: string;
  object_id?: string;
  objectId?: string;
  close_type?: string;
  closeType?: string;
  status?: string;
  lat?: number;
  lon?: number;
  payload?: {
    observed?: {
      lat?: number;
      lon?: number;
    };
    offset?: number | string | { feet?: number | string };
    depth?: number | string | { inches?: number | string };
    photo?: string;
    [key: string]: any;
  };
  [key: string]: any;
};

type ExecutionRecord = {
  executionId?: string;
  storedHash?: string;
  recomputedHash?: string;
  match?: boolean;
  scopeVersionId?: string;
  deterministicResolution?: {
    decision?: string;
    status?: string;
  };
  [key: string]: any;
};

const userRole = "admin";
const API_BASE = "http://64.34.93.5:4000";

// -----------------------------
// Component
// -----------------------------

export default function FieldMode() {
  const [gps, setGps] = useState<GPSState | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [offsetFeet, setOffsetFeet] = useState<string>("");
  const [depthInches, setDepthInches] = useState<string>("");
  const [closes, setCloses] = useState<CloseRecord[]>([]);

  const [stationId, setStationId] = useState<string | null>(null);
  const [stations, setStations] = useState<Station[]>([]);

  const [scopeVersion, setScopeVersion] = useState<string | null>(null);
  const [selectedScope, setSelectedScope] = useState<ScopeSummary | null>(null);
  const [scopeRefreshKey, setScopeRefreshKey] = useState<number>(0);
  const [scopeData, setScopeData] = useState<any>(null);

  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [closeTaxonomy, setCloseTaxonomy] = useState<Record<string, string[]>>(
    {}
  );
  const [objects, setObjects] = useState<ScopeObject[]>([]);
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);

  const [closeId, setCloseId] = useState<string | null>(null);
  const [execution, setExecution] = useState<ExecutionRecord | null>(null);
  const [stationState, setStationState] = useState<any>(null);
  const [corridorState, setCorridorState] = useState<any>(null);
  const [log, setLog] = useState<string>("");

  const [isSubmittingClose, setIsSubmittingClose] = useState<boolean>(false);
  const [isValidatingClose, setIsValidatingClose] = useState<boolean>(false);
  const [isLoadingScope, setIsLoadingScope] = useState<boolean>(false);

  const selectedStationObj = useMemo(() => {
    return stations.find((s) => s.stationId === stationId) || null;
  }, [stations, stationId]);

  const selectedObject = useMemo(() => {
    return objects.find((o) => o.objectId === selectedObjectId) || null;
  }, [objects, selectedObjectId]);

  const stationKey = stationId ? normalizeId(stationId) : null;

  const scopePackage = useMemo(() => {
    if (!scopeData?.canonicalTruth) return null;
    const pkg = createApprovedScopePackage({
      event: "scope.approved",
      corridorId: scopeData.corridorId,
      segmentId: scopeData.segmentId,
      scopeVersionId: scopeVersion || "field-derived",
      route: scopeData.canonicalTruth.route || [],
      stations: (scopeData.canonicalTruth.stations || []).map(s => ({
        id: s.stationId || s.id || '',
        stationId: s.stationId || s.id || '',
        lat: s.lat || 0,
        lon: s.lon || 0,
        feet: s.feet || 0,
      })),
      role: "metro", // Default role
      routeFeet: (scopeData.canonicalTruth.route || []).length * 100, // Estimate
      timestamp: scopeData.created_at || new Date().toISOString(),
      actor: "system",
      context: {},
    });
    // Override objects with actual objects from scope
    pkg.canonicalTruth.objects = (scopeData.canonicalTruth.objects || []).map(o => ({
      objectId: o.objectId || o.id || '',
      objectType: o.objectType || '',
      networkRole: o.networkRole || 'metro',
      unit: o.unit || 'each',
      quantity: o.quantity || 1,
      stationId: o.stationId || '', // Add stationId if present
    }));
    return pkg;
  }, [scopeData, scopeVersion]);

  const replayState = useMemo(() => {
    if (!scopePackage) return null;
    return computeScopeReplayState(scopePackage, closes as any[]);
  }, [scopePackage, closes]);

  const currentRole = "field";

  const FIELD_CLOSE_SEQUENCE = [
    "engineering_complete",
    "permit_approved",
    "construction_complete",
    "cable_pulled",
    "splice_test_complete",
    "asbuilt_verified",
  ];

  // -----------------------------
  // Deterministic State
  // -----------------------------

  const executionMap = useMemo(() => {
    return replayState?.executionMap || new Map();
  }, [replayState]);

  const activationMap = useMemo(() => {
    return replayState?.activationMap || new Map();
  }, [replayState]);

  const totalStations = stations.length;
  const completedStations = executionMap.size;
  const percentComplete =
    totalStations > 0
      ? Math.round((completedStations / totalStations) * 100)
      : 0;

  const lastExecution = useMemo(() => {
    if (!stationKey) return null;
    return executionMap.get(stationKey) || null;
  }, [executionMap, stationKey]);

  const lastExecutionType = useMemo(() => {
    return getCloseType(lastExecution as any) || null;
  }, [lastExecution]);

  const nextClose = useMemo(() => {
    if (!stationKey || !replayState) return null;
    const stationState = replayState.stations.get(stationKey);
    return stationState?.latestCloseType ? getNextCloseTypeFromSequence(stationState.latestCloseType, FIELD_CLOSE_SEQUENCE) : FIELD_CLOSE_SEQUENCE[0];
  }, [stationKey, replayState]);

  const nextStepForSelected = useMemo(() => {
    if (!selectedObjectId || !replayState) return null;
    const objectState = replayState.objects.get(normalizeId(selectedObjectId));
    return objectState?.nextCloseType || null;
  }, [selectedObjectId, replayState]);

  const isActivated = stationKey ? activationMap.get(stationKey) === true : false;

  const requiredRoleForNextClose = useMemo(() => {
    if (!nextClose) return null;

    const entry = Object.entries(ROLE_PERMISSIONS).find(([, allowedCloses]) =>
      allowedCloses.includes(nextClose)
    );

    return entry?.[0] || null;
  }, [nextClose]);

  const availableWork = useMemo(() => {
    if (!selectedStationObj || !stationId || !nextClose) return [];

    return objects.filter((obj) => {
      const lifecycleNext = getNextCloseTypeForObject(
        obj.objectId,
        stationId,
        obj.objectType,
        closes as any[],
        closeTaxonomy as any
      );

      const activationAllowed =
        typeof obj.activated === "boolean" ? obj.activated : isActivated;

      const allowed =
        ROLE_PERMISSIONS[userRole]?.includes("*") ||
        ROLE_PERMISSIONS[userRole]?.includes(nextClose);

      return (
        activationAllowed &&
        lifecycleNext === nextClose &&
        allowed
      );
    });
  }, [
    selectedStationObj,
    stationId,
    nextClose,
    objects,
    closes,
    closeTaxonomy,
    isActivated
  ]);

  // -----------------------------
  // Evidence
  // -----------------------------

  const captureGPS = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude
        };
        setGps(coords);
        console.log("GPS CAPTURED:", coords);
      },
      (err) => {
        console.error("GPS ERROR:", err);
        alert("Unable to capture GPS");
      }
    );
  };

  const clearFieldEvidence = () => {
    setGps(null);
    setPhoto(null);
    setOffsetFeet("");
    setDepthInches("");
  };

  const getObservedCoords = (close: CloseRecord | undefined) => {
    return {
      lat: close?.lat ?? close?.payload?.observed?.lat ?? null,
      lon: close?.lon ?? close?.payload?.observed?.lon ?? null
    };
  };

  const handlePhoto = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setPhoto(reader.result as string);
      console.log("PHOTO CAPTURED");
    };

    reader.readAsDataURL(file);
  };

  // -----------------------------
  // Load Scope
  // -----------------------------

  useEffect(() => {
    if (!scopeVersion) {
      setStations([]);
      setObjects([]);
      setCloses([]);
      setCloseTaxonomy({});
      console.log("ROUTECOORDS CLEAR REQUEST");
      console.log("ROUTECOORDS CLEAR REQUEST SOURCE", "FieldMode.localLoadScope.noScopeVersion");
      console.log("ROUTECOORDS CLEAR REQUEST NEXT LENGTH", 0);
      setRouteCoords([]);
      setLog("");
      setStationId(null);
      setSelectedObjectId(null);
      setCloseId(null);
      setExecution(null);
      setStationState(null);
      setCorridorState(null);
      setSelectedScope(null);
      clearFieldEvidence();
      return;
    }

    let cancelled = false;

    async function loadRoute() {
      // RESET BEFORE loading new scope
      setIsLoadingScope(true);
      setStations([]);
      setObjects([]);
      setCloses([]);
      setCloseTaxonomy({});
      console.log("ROUTECOORDS CLEAR REQUEST");
      console.log("ROUTECOORDS CLEAR REQUEST SOURCE", "FieldMode.localLoadScope.beforeFetch");
      console.log("ROUTECOORDS CLEAR REQUEST NEXT LENGTH", 0);
      setRouteCoords([]);
      setLog("");
      setStationState(null);
      setCorridorState(null);
      setExecution(null);
      setScopeData(null);

      try {
        console.log("LOADING SCOPE VERSION:", scopeVersion);
        
        const scopeRes = await fetch(`${API_BASE}/scope/${scopeVersion}`);
        if (!scopeRes.ok) {
          throw new Error(`Scope request failed: ${scopeRes.status}`);
        }

        const scope = await scopeRes.json();
        if (cancelled) return;

        console.log("FIELD SCOPE:", scope);

        const truth = scope?.canonicalTruth || scope || {};
        const rawObjects = truth?.objects || [];
        const cleanObjects = rawObjects.filter((o: any) => {
          return o && o.objectType && o.objectId;
        });

        const closeRes = await fetch(
          `${API_BASE}/closes?corridorId=${scope.corridorId}&segmentId=${scope.segmentId}&scopeVersionId=${scopeVersion}`
        );
        if (!closeRes.ok) {
          throw new Error(`Closes request failed: ${closeRes.status}`);
        }

        const closesData = await closeRes.json();
        if (cancelled) return;

        const route = truth?.route || [];
        const nextStations = truth?.stations || [];

        if (cancelled) return;

        setObjects(cleanObjects);
        setCloseTaxonomy(truth?.closeTaxonomy || {});
        setStations(nextStations);
        setCloses(Array.isArray(closesData) ? closesData : []);
        setScopeData(scope);

        const stationCoords: [number, number][] = nextStations.map((s: any) => [
          s.lat,
          s.lon
        ]);

        const finalRoute: [number, number][] =
          route.length > 0
            ? route.map((p: any) => [p[1], p[0]])
            : stationCoords;

        if (!cancelled) setRouteCoords(finalRoute);
      } catch (err) {
        if (cancelled) return;
        
        console.error("Scope load failed", err);
        console.log("ROUTECOORDS CLEAR REQUEST");
        console.log("ROUTECOORDS CLEAR REQUEST SOURCE", "FieldMode.localLoadScope.fetchError");
        console.log("ROUTECOORDS CLEAR REQUEST NEXT LENGTH", 0);
        setRouteCoords([]);
        setStations([]);
        setObjects([]);
        setCloses([]);
        setCloseTaxonomy({});
        setLog(
          JSON.stringify(
            {
              error: "Scope load failed",
              detail: String(err)
            },
            null,
            2
          )
        );
      } finally {
        if (!cancelled) setIsLoadingScope(false);
      }
    }

    loadRoute();

    return () => {
      cancelled = true;
    };
  }, [scopeVersion, scopeRefreshKey]);

  // -----------------------------
  // Submit Close
  // -----------------------------

  const submitClose = async () => {
    console.log("SUBMIT CLOSE CLICKED");

    if (!selectedScope) {
      alert("Select a scope version first");
      return;
    }

    if (!stationId) {
      alert("Select a station");
      return;
    }

    if (!selectedObjectId) {
      alert("Select an object");
      return;
    }

    if (!isActivated) {
      alert("This station is not activated by Control.");
      return;
    }

    const station = stations.find((s) => s.stationId === stationId);

    if (!station) {
      console.error("INVALID STATION INPUT", {
        input: stationId,
        available: stations.map((s) => ({
          station: s.station,
          stationId: s.stationId
        }))
      });
      alert("Invalid station selected");
      return;
    }

    if (!selectedObject) {
      alert("Selected object not found");
      return;
    }

    const corridorId = selectedScope.corridorId;
    const segmentId = selectedScope.segmentId;

    const nextCloseType = getNextCloseTypeForObject(
      selectedObjectId,
      station.stationId,
      selectedObject.objectType,
      closes as any[],
      closeTaxonomy as any
    );

    if (!nextCloseType) {
      alert("All steps complete for this object");
      return;
    }

    if (nextClose && nextCloseType !== nextClose) {
      alert(
        `This station only allows the next deterministic step: ${nextClose}`
      );
      return;
    }

    const allowed =
      ROLE_PERMISSIONS[userRole]?.includes("*") ||
      ROLE_PERMISSIONS[userRole]?.includes(nextClose);

    if (!allowed) {
      alert(
        `Role "${currentRole}" is not allowed to submit "${nextClose}".`
      );
      return;
    }

    const payload = {
      scopeVersionId: scopeVersion,
      corridorId,
      segmentId,
      stationId: station.stationId,
      closeType: nextCloseType,
      objectId: selectedObjectId,
      payload: {
        planned: {
          lat: station.lat,
          lon: station.lon
        },
        ...(gps && {
          observed: {
            lat: gps.lat,
            lon: gps.lon
          }
        }),
        offset: {
          feet: Number(offsetFeet || 0)
        },
        depth: {
          inches: Number(depthInches || 0)
        },
        ...(photo && { photo }),
        mode: gps || photo ? "field" : "manual",
        timestamp: new Date().toISOString()
      }
    };

    console.log("FINAL PAYLOAD:", payload);

    try {
      setIsSubmittingClose(true);

      const res = await fetch(`${API_BASE}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      console.log("RESPONSE STATUS:", res.status);

      const data = await res.json();
      console.log("RESPONSE DATA:", data);

      const resolvedCloseId = data.closeId || data.closureid || null;

      setCloseId(resolvedCloseId);
      setLog(JSON.stringify(data, null, 2));

      // Trigger scope reload to pick up new closes
      if (scopeVersion) {
        setScopeRefreshKey(k => k + 1);
      }

      clearFieldEvidence();
      setSelectedObjectId(null);
    } catch (err) {
      console.error("SUBMIT ERROR:", err);
      setLog(
        JSON.stringify(
          {
            error: "Submit close failed",
            detail: String(err)
          },
          null,
          2
        )
      );
    } finally {
      setIsSubmittingClose(false);
    }
  };

  const handleWorkSelection = (obj: ScopeObject) => {
    if (!selectedStationObj) return;

    const nextStep = getNextCloseTypeForObject(
      obj.objectId,
      selectedStationObj.stationId,
      obj.objectType,
      closes as any[],
      closeTaxonomy as any
    );

    setSelectedObjectId(String(obj.objectId));
    setCloseId(nextStep);
  };

  // -----------------------------
  // Validate Close
  // -----------------------------

  const validateClose = async () => {
    if (!selectedScope || !scopeVersion || !closeId || !stationId) {
      alert("Select scope first");
      return;
    }

    try {
      setIsValidatingClose(true);

      const corridorId = selectedScope.corridorId;
      const segmentId = selectedScope.segmentId;

      const res = await fetch(`${API_BASE}/iof/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope_version_id: scopeVersion,
          corridor_id: corridorId,
          segment_id: segmentId,
          station_id: stationId,
          close_id: closeId
        })
      });

      const text = await res.text();
      console.log("VALIDATE RAW:", text);

      try {
        const validateData = JSON.parse(text);
        setLog(JSON.stringify(validateData, null, 2));
      } catch {
        setLog(text);
        return;
      }

      await new Promise((r) => setTimeout(r, 300));

      const execRes = await fetch(`${API_BASE}/iof/replay/exec/${closeId}`);

      if (!execRes.ok) {
        console.error("Execution record not found");
        return;
      }

      const execData = await execRes.json();
      setExecution(execData);
    } catch (err) {
      console.error("VALIDATE ERROR:", err);
      setLog(
        JSON.stringify(
          {
            error: "Validate close failed",
            detail: String(err)
          },
          null,
          2
        )
      );
    } finally {
      setIsValidatingClose(false);
    }
  };

  // -----------------------------
  // State Loaders
  // -----------------------------

  const loadStation = async () => {
    if (!stationId) return;

    try {
      const res = await fetch(`${API_BASE}/iof/station/${stationId}/completion`);
      const data = await res.json();
      setStationState(data);
    } catch (err) {
      console.error("LOAD STATION ERROR:", err);
      setLog(
        JSON.stringify(
          {
            error: "Load station failed",
            detail: String(err)
          },
          null,
          2
        )
      );
    }
  };

  const loadCorridor = async () => {
    if (!selectedScope) {
      alert("Select a scope version first");
      return;
    }

    try {
      const corridorId = selectedScope.corridorId;
      const res = await fetch(
        `${API_BASE}/iof/corridor/${corridorId}/completion`
      );
      const data = await res.json();
      setCorridorState(data);
    } catch (err) {
      console.error("LOAD CORRIDOR ERROR:", err);
      setLog(
        JSON.stringify(
          {
            error: "Load corridor failed",
            detail: String(err)
          },
          null,
          2
        )
      );
    }
  };

  const checkLedger = async () => {
    if (!selectedScope) {
      alert("Select a scope version first");
      return;
    }

    try {
      const corridorId = selectedScope.corridorId;
      const res = await fetch(`${API_BASE}/iof/replay/chain/${corridorId}`);
      const data = await res.json();
      setLog(JSON.stringify(data, null, 2));
    } catch (err) {
      console.error("LEDGER ERROR:", err);
      setLog(
        JSON.stringify(
          {
            error: "Ledger integrity check failed",
            detail: String(err)
          },
          null,
          2
        )
      );
    }
  };

  // -----------------------------
  // UI Fragments
  // -----------------------------

  const renderAvailableWork = () => {
    if (!selectedStationObj) {
      return (
        <div
          style={{
            padding: 10,
            borderRadius: 6,
            background: "#111827",
            color: "#fff"
          }}
        >
          Select a station to view deterministic work.
        </div>
      );
    }

    if (!isActivated) {
      return (
        <div
          style={{
            padding: 10,
            borderRadius: 6,
            background: "#7f1d1d",
            color: "#fff"
          }}
        >
          🚫 Work Not Activated
        </div>
      );
    }

    if (!nextClose) {
      return (
        <div
          style={{
            padding: 10,
            borderRadius: 6,
            background: "#065f46",
            color: "#fff"
          }}
        >
          ✅ Work Complete
        </div>
      );
    }

    const roleAllowed =
      ROLE_PERMISSIONS[userRole]?.includes("*") ||
      ROLE_PERMISSIONS[userRole]?.includes(nextClose);

    if (!roleAllowed) {
      return (
        <div
          style={{
            padding: 10,
            borderRadius: 6,
            background: "#1f2937",
            color: "#fff"
          }}
        >
          Role "{userRole}" is not authorized for next step: {nextClose}
        </div>
      );
    }

    if (availableWork.length === 0) {
      return (
        <div
          style={{
            padding: 10,
            borderRadius: 6,
            background: "#1f2937",
            color: "#fff"
          }}
        >
          No available work for next deterministic step: {nextClose}
        </div>
      );
    }

    return (
      <div style={{ marginBottom: 15 }}>
        <h4>Available Work</h4>

        {availableWork.map((obj) => {
          const objectNextStep = getNextCloseTypeForObject(
            obj.objectId,
            selectedStationObj.stationId,
            obj.objectType,
            closes as any[],
            closeTaxonomy as any
          );

          const isSelected = selectedObjectId === obj.objectId;

          return (
            <div
              key={obj.objectId}
              style={{
                padding: 10,
                marginBottom: 6,
                borderRadius: 6,
                background: isSelected ? "#374151" : "#1f2937",
                color: "#fff",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                border: isSelected
                  ? "1px solid #f59e0b"
                  : "1px solid transparent"
              }}
            >
              <div>
                <strong>{obj.objectType || "Unknown Object"}</strong>
                {obj.networkRole ? ` — ${obj.networkRole}` : ""}
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  Next: {objectNextStep || "Complete"}
                </div>
              </div>

              <button
                onClick={() => handleWorkSelection(obj)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: "none",
                  cursor: "pointer"
                }}
              >
                Select
              </button>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div style={{ padding: 20, fontFamily: "system-ui" }}>
      <h1>StellaOS Field</h1>
      <div style={{ marginBottom: 16, color: "#94a3b8" }}>
        Execution + Closure Operations
      </div>

      <ScopeSelector
        selectedScopeVersionId={scopeVersion}
        onSelect={(id, scope) => {
          setScopeVersion(id);
          setSelectedScope({
            corridorId: scope.corridor_id,
            segmentId: scope.segment_id
          });
          setStationId(null);
          setSelectedObjectId(null);
          setCloseId(null);
          setExecution(null);
          setStationState(null);
          setCorridorState(null);
          clearFieldEvidence();
        }}
      />

      <StationSelector
        stationId={stationId ?? ""}
        onChange={(val) => {
          setStationId(val ?? null);
          setSelectedObjectId(null);
          setCloseId(null);
          setExecution(null);
          setStationState(null);
        }}
      />

      <div style={{ marginBottom: 10 }}>
        <label>Select Object</label>
        <select
          value={typeof selectedObjectId === "string" ? selectedObjectId : ""}
          onChange={(e) => setSelectedObjectId(String(e.target.value) || null)}
          style={{ width: "100%", padding: 8 }}
        >
          <option value="">Select object</option>

          {availableWork.map((o) => (
            <option key={o.objectId} value={o.objectId}>
              {o.objectType}
              {o.networkRole ? ` — ${o.networkRole}` : ""}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: 20 }}>
        <h3>Field Transaction</h3>

        <div style={{ marginBottom: 10, fontWeight: "bold" }}>
          Progress: {percentComplete}%
        </div>

        {isLoadingScope && (
          <div style={{ marginBottom: 10 }}>Loading scope...</div>
        )}

        {selectedStationObj && (
          <div
            style={{
              padding: 10,
              marginBottom: 10,
              background: "#1f2937",
              color: "#fff",
              borderRadius: 6
            }}
          >
            <strong>Selected Station:</strong>{" "}
            {selectedStationObj.station || selectedStationObj.stationId}
          </div>
        )}

        {selectedStationObj && (
          <div
            style={{
              padding: 10,
              marginBottom: 10,
              background: "#111827",
              color: "#fff",
              borderRadius: 6
            }}
          >
            <div>
              <strong>Last Execution:</strong> {lastExecutionType || "none"}
            </div>
            <div>
              <strong>Next Allowed:</strong> {nextClose || "complete"}
            </div>
            <div>
              <strong>Required Role:</strong> {requiredRoleForNextClose || "n/a"}
            </div>
            <div>
              <strong>Current Role:</strong> {userRole}
            </div>
            <div>
              <strong>Activated:</strong> {isActivated ? "yes" : "no"}
            </div>
            <div>
              <strong>Selected Object Next:</strong>{" "}
              {nextStepForSelected || "n/a"}
            </div>
          </div>
        )}

        {renderAvailableWork()}

        <CloseAction submitClose={submitClose} />

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
          <button onClick={validateClose} disabled={isValidatingClose}>
            {isValidatingClose ? "Validating..." : "Validate Close"}
          </button>

          <button onClick={captureGPS}>Capture GPS</button>

          <button onClick={clearFieldEvidence}>Clear Evidence</button>

          <button onClick={submitClose} disabled={isSubmittingClose}>
            {isSubmittingClose ? "Submitting..." : "Submit Close"}
          </button>
        </div>

        {gps && (
          <div style={{ marginTop: 8, marginBottom: 8 }}>
            GPS: {gps.lat.toFixed(6)}, {gps.lon.toFixed(6)} ✅
          </div>
        )}
// @ts-ignore
        {stations.length > 0 && (
          <MapContainer
            center={[stations[0].lat, stations[0].lon]}
            zoom={16}
            style={{ height: 400, marginTop: 10, marginBottom: 20 }}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

            {routeCoords.length > 1 && <Polyline positions={routeCoords} />}

            {selectedObject && selectedObject.geometry && Array.isArray(selectedObject.geometry) && selectedObject.geometry.length > 1 && (
              <Polyline
                positions={selectedObject.geometry.map((coord: [number, number]) => [coord[1], coord[0]])}
                color="red"
                weight={3}
              />
            )}

            {stations.map((station) => {
              const key = normalizeId(station.stationId);
              const match = executionMap.get(key);

              const { lat, lon } = getObservedCoords(match);
              const closeType =
                match?.close_type || match?.closeType || match?.status;

              const stateColor =
                closeType === "engineering_complete"
                  ? "#eab308"
                  : closeType === "permit_approved"
                  ? "#3b82f6"
                  : closeType === "construction_complete"
                  ? "#f97316"
                  : closeType === "cable_pulled"
                  ? "#fb923c"
                  : closeType === "splice_test_complete"
                  ? "#a855f7"
                  : closeType === "asbuilt_verified"
                  ? "#22c55e"
                  : "#6b7280";

              const hasGPS = !!lat && !!lon;

              const dynamicIcon = L.divIcon({
                className: "",
                html: `<div style="
                  width:12px;
                  height:12px;
                  border-radius:50%;
                  background:${stateColor};
                  border:2px solid white;
                "></div>`
              });

              const statusLabel = hasGPS
                ? "Closed with GPS"
                : closeType === "asbuilt_verified"
                ? "Complete"
                : closeType
                ? String(closeType).replaceAll("_", " ")
                : "Open";

              return (
                <Marker
                  key={station.stationId}
                  position={[station.lat, station.lon]}
                  icon={
                    station.stationId === stationId
                      ? selectedIcon
                      : hasGPS
                      ? gpsClosedIcon
                      : closeType
                      ? dynamicIcon
                      : blueIcon
                  }
                  eventHandlers={{
                    click: () => {
                      console.log("FIELD DEBUG", {
                        stationId: station.stationId,
                        lookupKey: key,
                        match
                      });
                      setStationId(station.stationId);
                      setSelectedObjectId(null);
                      setCloseId(null);
                      setExecution(null);
                    }
                  }}
                >
                  <Popup>
                    <b>{station.station || station.stationId}</b>
                    <div>{statusLabel}</div>
                    <div>
                      {activationMap.get(key) === true ? "Activated" : "Not Activated"}
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        )}

        <label
          style={{
            display: "inline-block",
            marginLeft: 8,
            padding: "8px 12px",
            background: "#111",
            color: "#fff",
            borderRadius: 6,
            cursor: "pointer"
          }}
        >
          Take Photo
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhoto}
            style={{ display: "none" }}
          />
        </label>

        {photo && (
          <div style={{ marginTop: 10 }}>
            <img src={photo} width={120} style={{ marginTop: 10 }} />
          </div>
        )}

        <div style={{ marginBottom: 8, marginTop: 10 }}>
          <label style={{ display: "block", marginBottom: 4 }}>
            Offset from selected station (feet)
          </label>
          <input
            type="number"
            inputMode="numeric"
            placeholder="49"
            value={offsetFeet}
            onChange={(e) => setOffsetFeet(e.target.value)}
            style={{ width: "100%", padding: 10 }}
          />
        </div>

        <div style={{ marginBottom: 8 }}>
          <label style={{ display: "block", marginBottom: 4 }}>
            Depth below grade (inches)
          </label>
          <input
            type="number"
            inputMode="numeric"
            placeholder="42"
            value={depthInches}
            onChange={(e) => setDepthInches(e.target.value)}
            style={{ width: "100%", padding: 10 }}
          />
        </div>

        {closeId && <div>Close ID / Next Step: {closeId}</div>}
      </div>

      <div style={{ marginBottom: 20 }}>
        <h3>Deterministic Proof</h3>

        {execution && (
          <div>
            <div>Decision: {execution?.deterministicResolution?.decision}</div>
            <div>Status: {execution?.deterministicResolution?.status}</div>
            <div>Execution ID: {execution?.executionId}</div>

            <div>
              Stored Hash
              <pre>{execution?.storedHash}</pre>
            </div>

            <div>
              Recomputed Hash
              <pre>{execution?.recomputedHash}</pre>
            </div>

            <div>Hash Match: {String(execution?.match)}</div>
            <div>Scope Version: {execution?.scopeVersionId}</div>
          </div>
        )}
      </div>

      <div style={{ marginBottom: 20 }}>
        <h3>Infrastructure State</h3>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={loadStation}>Load Station</button>
          <button onClick={loadCorridor}>Load Corridor</button>
          <button onClick={checkLedger}>Ledger Integrity</button>
        </div>

        {stationState && (
          <div>
            <h4>Station</h4>
            <pre>{JSON.stringify(stationState, null, 2)}</pre>
          </div>
        )}

        {corridorState && (
          <div>
            <h4>Corridor</h4>
            <pre>{JSON.stringify(corridorState, null, 2)}</pre>
          </div>
        )}
      </div>

      <div>
        <h3>Event Log</h3>
        <pre>{log}</pre>
      </div>
    </div>
  );
}

// -----------------------------
// Helpers
// -----------------------------


/* function getNextCloseType(
  objectId: string,
  stationId: string,
  objectType: string | undefined,
  closes: CloseRecord[],
  closeTaxonomy: Record<string, string[]>
) {
  if (!objectType) return null;

  const sequence = closeTaxonomy?.[objectType] || [];

  const existing = closes
    .filter((close) => {
      return (
        String(close.station_id || close.stationId).toUpperCase() ===
          String(stationId).toUpperCase() &&
        String(close.object_id || close.objectId) === String(objectId)
      );
    })
    .sort((a, b) => {
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
      return aTime - bTime;
    });

  if (!existing.length) {
    return sequence[0] || null;
  }

  const lastClose = existing[existing.length - 1];
  const completed = lastClose?.close_type || lastClose?.closeType;

  const idx = sequence.indexOf(completed);
  if (idx === -1) return sequence[0] || null;

  return sequence[idx + 1] || null;
*/
