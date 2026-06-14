import { useEffect, useRef, useState } from "react";

import DesignMode from "./DMredlinedev";
import MarketplaceMode from "./MarketplaceMode";
import ControlPlane from "./ControlPlane";
import FieldMode from "./FieldMode";
import TwinMode from "./TwinMode";
import PrismMode from "./Prism/PrismMode";

import { deriveState } from "./core/graph/state";
import type { ScopeVersion } from "./core/graph/scopeVersion";
import type { OpportunityBatch } from "./types/fiberlightBeta";

type LonLat = [number, number];

type Mode =
  | "design"
  | "prism"
  | "marketplace"
  | "control"
  | "field"
  | "twin";

export default function App() {
  const [mode, setMode] = useState<Mode>("design");
  const [scopeVersionId, setScopeVersionId] = useState<string | null>(null);

  const [routeCoords, setRouteCoords] = useState<LonLat[] | null>([]);
  console.log("APP ROUTE STATE IDENTITY", setRouteCoords);
  console.log("APP ROUTE STATE LENGTH DURING RENDER", routeCoords?.length ?? 0);
  if (typeof window !== "undefined") {
    (window as any).__hyperlinxAppSetRouteCoords = setRouteCoords;
  }
  const previousOwnerRouteCoordsRef = useRef<LonLat[] | null>(null);
  const [sites, setSites] = useState<any[]>([]);
  const [designStations, setDesignStations] = useState<any[]>([]);
  const [opportunityBatch, setOpportunityBatch] = useState<OpportunityBatch | null>(null);

  const corridorId = "C1";
  const segmentId = "SEG1";

  useEffect(() => {
    const testScope: ScopeVersion = {
      id: "test-scope",
      nodes: [
        { id: "A", type: "site" },
        { id: "B", type: "site" },
      ],
      edges: [
        {
          id: "E1",
          from: "A",
          to: "B",
          type: "physical",
          ownership: "internal",
        },
      ],
      events: [
        {
          id: "1",
          scopeVersionId: "test-scope",
          type: "activate_node",
          targetId: "A",
          timestamp: Date.now(),
        },
      ],
      metadata: {
        source: "App.tsx test harness",
      },
    };

    const derived = deriveState(testScope);
    console.log("GRAPH TEST STATE:", derived);
  }, []);

  useEffect(() => {
    const length = routeCoords?.length ?? 0;
    const prevLength = previousOwnerRouteCoordsRef.current?.length ?? 0;
    console.log("ROUTECOORDS OWNER UPDATED LENGTH", length);
    console.log("ROUTECOORDS OWNER UPDATED PREV LENGTH", prevLength);
    console.log("ROUTECOORDS OWNER UPDATED SOURCE", "App", "mode", mode);
    console.log("ROUTECOORDS OWNER UPDATED SAME REFERENCE", routeCoords === previousOwnerRouteCoordsRef.current);
    previousOwnerRouteCoordsRef.current = routeCoords;
  }, [routeCoords, mode]);

  useEffect(() => {
    const length = routeCoords?.length ?? 0;
    if (mode === "design") {
      console.log("ROUTECOORDS PROP RECEIVED LENGTH", length);
      console.log("ROUTECOORDS PROP RECEIVED SOURCE", "App -> DMredlinedev");
    }
    if (mode === "field") {
      console.log("ROUTECOORDS PROP RECEIVED LENGTH", length);
      console.log("ROUTECOORDS PROP RECEIVED SOURCE", "App -> FieldMode");
    }
  }, [mode, routeCoords]);

  const renderMode = () => {
    switch (mode) {
      case "design":
        console.log("APP -> DMREDLINE SETTER IDENTITY", setRouteCoords);
        return (
          <DesignMode
            corridorId={corridorId}
            segmentId={segmentId}
            scopeVersionId={scopeVersionId}
            setScopeVersionId={setScopeVersionId}
            routeCoords={routeCoords}
            setRouteCoords={setRouteCoords}
            sites={sites}
            setSites={setSites}
            designStations={designStations}
            setDesignStations={setDesignStations}
            opportunityBatch={opportunityBatch}
          />
        );

      case "prism":
        return (
          <PrismMode
            onSendBatchToDesign={(batch) => {
              setOpportunityBatch(batch);
              setSites(
                batch.selectedSites.map((site, index) => ({
                  name: site.name || site.siteId,
                  lat: site.lat,
                  lon: site.lon,
                  order: index + 1,
                }))
              );
              setMode("design");
            }}
          />
        );

      case "marketplace":
        return <MarketplaceMode />;

      case "control":
        return (
          <ControlPlane
            corridorId={corridorId}
            scopeVersionId={scopeVersionId}
            setScopeVersionId={setScopeVersionId}
          />
        );

      case "field":
        return (
          <FieldMode
            routeCoords={routeCoords}
            designStations={designStations}
            setDesignStations={setDesignStations}
            corridorId={corridorId}
            segmentId={segmentId}
            scopeVersionId={scopeVersionId}
          />
        );

      case "twin":
        return <TwinMode />;

      default:
        return null;
    }
  };

  return (
    <div
      style={{
        height: "100vh",
        width: "100vw",
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: 10,
          borderBottom: "1px solid #1e293b",
          display: "flex",
          gap: 10,
          background: "#0f172a",
          flexWrap: "wrap",
          flexShrink: 0,
          boxSizing: "border-box",
        }}
      >
        <NavButton
          label="Design"
          mode="design"
          current={mode}
          setMode={setMode}
        />
        <NavButton
          label="Prism"
          mode="prism"
          current={mode}
          setMode={setMode}
        />
        <NavButton
          label="Marketplace"
          mode="marketplace"
          current={mode}
          setMode={setMode}
        />
        <NavButton
          label="Control"
          mode="control"
          current={mode}
          setMode={setMode}
        />
        <NavButton
          label="Field"
          mode="field"
          current={mode}
          setMode={setMode}
        />
        <NavButton label="Twin" mode="twin" current={mode} setMode={setMode} />
      </div>

      <div
        style={{
          flex: 1,
          width: "100vw",
          background: "#0b1220",
          display: "flex",
          minWidth: 0,
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        {mode === "control" || mode === "design" ? (
          <div
            style={{
              flex: "1 1 auto",
              display: "flex",
              height: "100%",
              width: "100vw",
              minWidth: 0,
              minHeight: 0,
              overflow: "hidden",
            }}
          >
            {renderMode()}
          </div>
        ) : (
          <div
            style={{
              width: "100%",
              maxWidth: 1600,
              padding: 20,
              margin: "0 auto",
              minHeight: 0,
              boxSizing: "border-box",
            }}
          >
            {renderMode()}
          </div>
        )}
      </div>
    </div>
  );
}

function NavButton({
  label,
  mode,
  current,
  setMode,
}: {
  label: string;
  mode: Mode;
  current: Mode;
  setMode: (m: Mode) => void;
}) {
  const active = current === mode;

  return (
    <button
      onClick={() => setMode(mode)}
      style={{
        padding: "8px 14px",
        borderRadius: 8,
        border: "none",
        cursor: "pointer",
        background: active ? "#2563eb" : "#1e293b",
        color: "#fff",
        fontWeight: active ? 600 : 400,
      }}
    >
      {label}
    </button>
  );
}
