import { useMemo, useState } from "react";
import { useDALState } from "../../dal/DALState";
import { proposedGraphFixtures, googleTexasAiProposedGraphFixture, type ProposedGraphFixture } from "../../proposedGraph/ProposedGraphFixtures";
import { approveProposedGraphForEngineering } from "../../proposedGraph/ProposedGraphEngine";
import type { ProposedGraph } from "../../proposedGraph/ProposedGraph";
import { createManualRouteRevision, createRouteRedline } from "../../redline/RouteRedlineEngine";
import type { RouteRevision } from "../../redline/RouteRevision";
import type { RouteAvoidanceArea } from "../../redline/RouteRedlineAction";
import type { DALCoordinate } from "../../types/dal";
import ProposedNetworkDiagnosticsPanel from "./proposednetwork/ProposedNetworkDiagnosticsPanel";
import ProposedGraphInspectorPanel from "./proposednetwork/ProposedGraphInspectorPanel";
import ProposedNetworkLegendPanel from "./proposednetwork/ProposedNetworkLegendPanel";
import ProposedNetworkMapPanel, { type ProposedNetworkSelection } from "./proposednetwork/ProposedNetworkMapPanel";
import ProposedNetworkReadinessPanel from "./proposednetwork/ProposedNetworkReadinessPanel";
import ProposedNetworkStatisticsPanel from "./proposednetwork/ProposedNetworkStatisticsPanel";
import ProposedNetworkSummaryPanel from "./proposednetwork/ProposedNetworkSummaryPanel";
import ProposedRouteStatisticsPanel from "./proposednetwork/ProposedRouteStatisticsPanel";
import ProposedEstimatedConstraintsPanel from "./proposednetwork/ProposedEstimatedConstraintsPanel";
import ProposedEstimatedInfrastructurePanel from "./proposednetwork/ProposedEstimatedInfrastructurePanel";
import RouteRevisionComparisonPanel from "./proposednetwork/RouteRevisionComparisonPanel";
import type { ProposedNetworkRedlineMode } from "./proposednetwork/ProposedNetworkMapPanel";

function fixtureLabel(fixture: ProposedGraphFixture) {
  return fixture.title;
}

function matchSelectedFixture(graph?: ProposedGraph | null) {
  if (!graph) return googleTexasAiProposedGraphFixture;
  return proposedGraphFixtures.find((fixture) => fixture.proposedGraph?.proposedGraphId === graph.proposedGraphId) ?? googleTexasAiProposedGraphFixture;
}

export default function ProposedNetworkWorkspace() {
  const { selectedProposedGraph, setSelectedProposedGraph, setWorkspace } = useDALState();
  const defaultFixture = matchSelectedFixture(selectedProposedGraph);
  const fixtures = useMemo(() => proposedGraphFixtures, []);
  const defaultIndex = Math.max(0, fixtures.indexOf(defaultFixture));
  const [selectedFixtureIndex, setSelectedFixtureIndex] = useState(defaultIndex);
  const [selected, setSelected] = useState<ProposedNetworkSelection>(null);
  const fixture = fixtures[selectedFixtureIndex] ?? defaultFixture;
  const [reviewGraph, setReviewGraph] = useState<ProposedGraph | null>(selectedProposedGraph ?? fixture.proposedGraph);
  const [redlineMode, setRedlineMode] = useState<ProposedNetworkRedlineMode>("REVIEW");
  const [viaPoints, setViaPoints] = useState<DALCoordinate[]>([]);
  const [avoidancePolygon, setAvoidancePolygon] = useState<DALCoordinate[]>([]);
  const [lockedSegmentIds, setLockedSegmentIds] = useState<string[]>([]);
  const [routeRevisions, setRouteRevisions] = useState<RouteRevision[]>([]);
  const [selectedRevision, setSelectedRevision] = useState<RouteRevision | null>(null);
  const graph = reviewGraph;

  function handleFixtureChange(index: number) {
    const nextFixture = fixtures[index] ?? googleTexasAiProposedGraphFixture;
    setSelectedFixtureIndex(index);
    setReviewGraph(nextFixture.proposedGraph);
    setSelectedProposedGraph(nextFixture.proposedGraph);
    setSelected(null);
    setViaPoints([]);
    setAvoidancePolygon([]);
    setLockedSegmentIds([]);
    setRouteRevisions([]);
    setSelectedRevision(null);
    setRedlineMode("REVIEW");
  }

  if (!graph) {
    return (
      <section className="dal-workspace wide">
        <div className="dal-workspace-header">
          <div>
            <h2>Proposed Network</h2>
            <p>Read-only proposed network visualization between Design and Preliminary Proposal.</p>
          </div>
        </div>
        <section className="dal-panel">
          <h3>Visualization Blocked</h3>
          <div className="dal-status">A canonical ProposedGraph is required before Proposed Network visualization.</div>
        </section>
      </section>
    );
  }

  function handleCustomerReviewComplete() {
    if (!graph) return;
    const approved = approveProposedGraphForEngineering(graph);
    setReviewGraph(approved);
    setSelectedProposedGraph(approved);
  }

  function saveManualRevision() {
    if (!graph || (!viaPoints.length && !avoidancePolygon.length)) return;
    const avoidanceAreas: RouteAvoidanceArea[] = avoidancePolygon.length >= 3
      ? [{
          avoidanceAreaId: `AVOID-${graph.proposedGraphId}-${Date.now()}`,
          label: "Avoidance Area",
          polygon: avoidancePolygon,
          reason: "Reviewer marked area to avoid. OSRM public exclusion is not available in this phase.",
          snapStatus: "SNAP_PENDING",
        }]
      : [];
    const redline = createRouteRedline({
      graph,
      actionType: avoidanceAreas.length && !viaPoints.length ? "AVOID_AREA" : "MOVE_SEGMENT",
      actor: "DAL reviewer",
      reason: "Manual corridor control point staged for non-authoritative redline review.",
      viaPoints,
      avoidanceAreas,
      protectedSegmentIds: lockedSegmentIds,
      snapStatus: "MANUAL_GEOMETRY",
      affectedSegmentIds: selected?.type === "edge" && selected.value.segmentId ? [selected.value.segmentId] : [],
    });
    const result = createManualRouteRevision({
      graph,
      redline,
      revisionNumber: routeRevisions.length + 1,
      createdBy: "DAL reviewer",
      reason: "Manual corridor control point staged for Route Engineering review.",
    });
    setRouteRevisions((prev) => [...prev, result.revision]);
    setSelectedRevision(result.revision);
    setViaPoints([]);
    setAvoidancePolygon([]);
    setRedlineMode("REVIEW");
  }

  return (
    <section className="dal-workspace wide">
      <div className="dal-workspace-header">
        <div>
          <h2>Proposed Network</h2>
          <p>Customer-facing centerline design candidate before preliminary quote generation and Route Engineering certification.</p>
        </div>
        <select value={selectedFixtureIndex} onChange={(event) => handleFixtureChange(Number(event.currentTarget.value))} aria-label="Proposed network fixture">
          {fixtures.map((item, index) => (
            <option key={item.fixtureId} value={index}>
              {fixtureLabel(item)}
            </option>
          ))}
        </select>
      </div>

      <ProposedNetworkMapPanel
        graph={graph}
        selected={selected}
        onSelect={setSelected}
        redline={{
          mode: redlineMode,
          pendingViaPoints: viaPoints,
          avoidancePolygon,
          lockedSegmentIds,
          revisionGeometry: selectedRevision?.geometry,
          revisionCount: routeRevisions.length,
          selectedRevisionLabel: selectedRevision?.revisionName,
          onModeChange: setRedlineMode,
          onAddViaPoint: (coordinate) => setViaPoints((prev) => [...prev, coordinate]),
          onMoveViaPoint: (index, coordinate) => setViaPoints((prev) => {
            const next = [...prev];
            if (index >= next.length) next.push(coordinate);
            else next[index] = coordinate;
            return next;
          }),
          onDeleteLastControlPoint: () => setViaPoints((prev) => prev.slice(0, -1)),
          onAddAvoidancePoint: (coordinate) => setAvoidancePolygon((prev) => [...prev, coordinate]),
          onSplitSelectedSegment: () => {
            if (selected?.type !== "edge") return;
            const midpoint = selected.value.coordinates[Math.floor(selected.value.coordinates.length / 2)];
            if (midpoint) setViaPoints((prev) => [...prev, midpoint]);
          },
          onProtectSelectedSegment: () => {
            if (selected?.type !== "edge") return;
            const segmentId = selected.value.segmentId ?? selected.value.id;
            setLockedSegmentIds((prev) => (prev.includes(segmentId) ? prev : [...prev, segmentId]));
          },
          onResetSelectedSegment: () => {
            if (selected?.type !== "edge") return;
            const segmentId = selected.value.segmentId ?? selected.value.id;
            setLockedSegmentIds((prev) => prev.filter((item) => item !== segmentId));
          },
          onSaveRevision: saveManualRevision,
          onDiscardRevision: () => {
            setViaPoints([]);
            setAvoidancePolygon([]);
            setSelectedRevision(null);
            setRedlineMode("REVIEW");
          },
          onSelectRevisionForProposal: () => {
            if (!selectedRevision) return;
            const selectedForProposal = { ...selectedRevision, selectedForProposal: true, revisionStatus: "SELECTED_FOR_PROPOSAL" as const };
            setRouteRevisions((prev) => prev.map((revision) => (
              revision.revisionId === selectedRevision.revisionId
                ? selectedForProposal
                : { ...revision, selectedForProposal: false }
            )));
            setSelectedRevision(selectedForProposal);
          },
        }}
      />

      <section className="dal-panel">
        <div className="dal-panel-title-row">
          <h3>Sales Estimate</h3>
          <span className="dal-badge warning">Engineering validation required</span>
        </div>
        <div className="dal-status">
          Route generated from the snapped centerline design candidate. Crossings, constraints, and infrastructure quantities are estimated. Final route geometry, permitting
          requirements, and construction quantities will be established during Route Engineering.
        </div>
      </section>

      <ProposedGraphInspectorPanel graph={graph} selected={selected} />

      <RouteRevisionComparisonPanel revisions={routeRevisions} selectedRevision={selectedRevision} />

      <div className="dal-grid">
        <ProposedNetworkSummaryPanel graph={graph} />
        <ProposedNetworkStatisticsPanel graph={graph} />
      </div>

      <div className="dal-grid">
        <ProposedRouteStatisticsPanel graph={graph} />
        <ProposedEstimatedInfrastructurePanel graph={graph} />
      </div>

      <ProposedEstimatedConstraintsPanel graph={graph} />

      <div className="dal-grid">
        <ProposedNetworkLegendPanel />
        <ProposedNetworkReadinessPanel graph={graph} />
      </div>

      <ProposedNetworkDiagnosticsPanel graph={graph} />

      <section className="dal-panel">
        <div className="dal-panel-title-row">
          <h3>Actions</h3>
          <span className="dal-badge warning">No engineering actions</span>
        </div>
        <div className="dal-actions">
          <button
            type="button"
            onClick={() => {
              setSelectedProposedGraph(graph);
              setWorkspace("preliminaryProposal");
            }}
          >
            Open Proposal
          </button>
          <button type="button" onClick={() => setWorkspace("design")}>
            Back to Design
          </button>
          <button type="button" disabled title="Placeholder only. Export is intentionally not implemented in Phase 6.9D.">
            Export Map
          </button>
          <button type="button" onClick={handleCustomerReviewComplete}>
            Customer Review Complete
          </button>
        </div>
        <div className="dal-status">
          No redlining, editing, engineering certification, ScopeVersion creation, Inventory Graph mutation, persistence, or API calls occur in this workspace.
        </div>
      </section>
    </section>
  );
}
