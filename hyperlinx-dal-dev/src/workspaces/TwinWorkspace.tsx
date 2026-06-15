import { useEffect, useState } from "react";
import { listCandidateSites, listControlWorkItems, listFieldClosures, listOpportunitySeeds, loadTwinState } from "../api/dalClient";
import { useDALState } from "../dal/DALState";
import { LeafletMap, type GISBuildPath, type GISPoint, type GISRoute } from "../gis";
import type { ControlWorkItem, DALCoordinate, FieldClosure, InventoryRoute, TwinState } from "../types/dal";
import type { CandidateSite } from "../types/candidateSite";
import type { OpportunitySeed } from "../types/portfolio";

function fmt(n: number | undefined) {
  return Number(n || 0).toLocaleString();
}

function money(n: number | undefined) {
  return Number(n || 0).toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function averageRisk(seeds: OpportunitySeed[]) {
  return seeds.reduce((sum, seed) => sum + Number(seed.riskScore ?? seed.buildPath?.riskScore ?? 0), 0) / Math.max(seeds.length, 1);
}

const spatialLayerNames = ["Parcel", "Road", "Rail", "Water", "Permit", "Constructability"] as const;
type SpatialLayerName = (typeof spatialLayerNames)[number];

function routeSegmentForAttachment(route: InventoryRoute | undefined, attachmentPoint?: DALCoordinate, radius = 28) {
  const coordinates = route?.coordinates ?? [];
  if (!coordinates.length) return [];
  if (!attachmentPoint || coordinates.length <= radius * 2 + 1) return coordinates;
  let bestIndex = 0;
  let bestScore = Infinity;
  coordinates.forEach((coord, index) => {
    const dx = coord[0] - attachmentPoint[0];
    const dy = coord[1] - attachmentPoint[1];
    const score = dx * dx + dy * dy;
    if (score < bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });
  return coordinates.slice(Math.max(0, bestIndex - radius), Math.min(coordinates.length, bestIndex + radius + 1));
}

export default function TwinWorkspace() {
  const { selectedGraph, selectedScopeVersion } = useDALState();
  const [twinState, setTwinState] = useState<TwinState | null>(null);
  const [workItems, setWorkItems] = useState<ControlWorkItem[]>([]);
  const [closures, setClosures] = useState<FieldClosure[]>([]);
  const [candidateSites, setCandidateSites] = useState<CandidateSite[]>([]);
  const [seeds, setSeeds] = useState<OpportunitySeed[]>([]);
  const [visibleSpatialLayers, setVisibleSpatialLayers] = useState<Record<SpatialLayerName, boolean>>({
    Parcel: true,
    Road: true,
    Rail: true,
    Water: true,
    Permit: true,
    Constructability: true,
  });
  const [status, setStatus] = useState("Twin ready.");

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    try {
      const [state, work, field, nextSites, nextSeeds] = await Promise.all([
        loadTwinState(),
        listControlWorkItems(),
        listFieldClosures(),
        listCandidateSites(),
        listOpportunitySeeds(),
      ]);
      setTwinState(state);
      setWorkItems(work);
      setClosures(field);
      setCandidateSites(nextSites);
      setSeeds(nextSeeds);
      setStatus("Twin state loaded.");
    } catch (err: any) {
      setStatus(`Twin load failed: ${err?.message ?? String(err)}`);
    }
  }

  const scopeTruth = selectedScopeVersion?.canonicalTruth as any;
  const extensionSummary = scopeTruth?.extensionSummary as any;
  const networkBasis = scopeTruth?.networkBasis ?? {};
  const geographicBasis = scopeTruth?.geographicBasis ?? {};
  const engineeringBasis = scopeTruth?.engineeringBasis ?? {};
  const financialBasis = scopeTruth?.financialBasis ?? {};
  const riskBasis = scopeTruth?.riskBasis ?? {};
  const proposedBuildPath = geographicBasis?.buildPath;
  const proposedBuildFeet = Number(engineeringBasis?.buildFeet ?? extensionSummary?.addedFeet ?? 0);
  const proposedRouteMiles = proposedBuildFeet / 5280;
  const proposedNodes = proposedBuildPath?.geometry?.length ? 2 : Number(extensionSummary?.addedNodeCount ?? 0);
  const proposedCost = Number(financialBasis?.estimatedConstructionCost ?? 0);
  const proposedCrossings = Number(engineeringBasis?.roadCrossings ?? 0) + Number(engineeringBasis?.railCrossings ?? 0) + Number(engineeringBasis?.waterCrossings ?? 0);
  const proposedRisk = Number(riskBasis?.compositeRisk ?? 0);
  const constructability = scopeTruth?.constructabilityAssessment;
  const scopeSite = scopeTruth?.sourceCandidate ?? scopeTruth?.site ?? scopeTruth?.candidateSite;
  const attachmentPoint = networkBasis?.attachmentCoordinates as DALCoordinate | undefined;
  const plannedRoute = selectedGraph?.routes.find((route) => route.routeId === networkBasis?.routeId);
  const plannedRouteSegment = routeSegmentForAttachment(plannedRoute, attachmentPoint);
  const plannedCandidatePoints: GISPoint[] =
    Number.isFinite(Number(geographicBasis?.candidateLongitude ?? selectedScopeVersion?.longitude)) && Number.isFinite(Number(geographicBasis?.candidateLatitude ?? selectedScopeVersion?.latitude))
      ? [
          {
            id: String(scopeSite?.candidateId ?? selectedScopeVersion?.scopeVersionId ?? "candidate"),
            label: String(scopeSite?.name ?? scopeSite?.companyName ?? "Candidate"),
            coordinate: [Number(geographicBasis?.candidateLongitude ?? selectedScopeVersion?.longitude), Number(geographicBasis?.candidateLatitude ?? selectedScopeVersion?.latitude)],
            kind: "candidate",
          },
        ]
      : [];
  const plannedAttachments: GISPoint[] = attachmentPoint
    ? [
        {
          id: `${selectedScopeVersion?.scopeVersionId ?? "scope"}-attachment`,
          label: "Attachment",
          coordinate: attachmentPoint,
          kind: "attachment",
        },
      ]
    : [];
  const plannedStations: GISPoint[] = geographicBasis?.stationGeometry
    ? [
        {
          id: String(networkBasis?.stationId ?? "station"),
          label: String(networkBasis?.stationName ?? networkBasis?.stationId ?? "Station"),
          coordinate: geographicBasis.stationGeometry,
          kind: "station",
        },
      ]
    : [];
  const plannedRoutes: GISRoute[] = plannedRouteSegment.length
    ? [
        {
          id: plannedRoute?.routeId ?? "planned-route",
          label: plannedRoute?.name ?? "Backbone",
          coordinates: plannedRouteSegment,
          color: "#27c26a",
          width: 4,
        },
      ]
    : [];
  const plannedBuildPaths: GISBuildPath[] = proposedBuildPath?.geometry?.length
    ? [
        {
          id: `${selectedScopeVersion?.scopeVersionId ?? "scope"}-lateral`,
          label: "Service Path",
          coordinates: proposedBuildPath.geometry,
        },
      ]
    : [];
  const phases = [
    { label: "Phase 1", seeds: seeds.slice(0, 10) },
    { label: "Phase 2", seeds: seeds.slice(10, 25) },
    { label: "Phase 3", seeds: seeds.slice(25, 50) },
  ];

  return (
    <section className="dal-workspace">
      <div className="dal-workspace-header">
        <div>
          <h2>DAL Twin</h2>
          <p>Operational state visualization from inventory graph, work queue, and field closures. Twin does not mutate graph data.</p>
        </div>
        <button type="button" onClick={() => void refresh()}>
          Refresh
        </button>
      </div>

      <div className="dal-panel">
        <div className="dal-status">{status}</div>
        <div className="dal-metrics">
          <span>Inventory: {selectedGraph?.inventoryId ?? twinState?.inventoryId ?? "none"}</span>
          <span>Scope: {selectedScopeVersion?.scopeVersionId ?? twinState?.scopeVersionId ?? "none"}</span>
          <span>Open work: {fmt(twinState?.openWorkItems)}</span>
          <span>Completed work: {fmt(twinState?.completedWorkItems)}</span>
          <span>Closures: {fmt(twinState?.closureCount)}</span>
          <span>Completed feet: {fmt(twinState?.completedFeet)}</span>
        </div>
      </div>

      <div className="dal-grid">
        <div className="dal-panel">
          <h3>Current State</h3>
          <div className="dal-metrics">
            <span>Inventory nodes: {fmt(selectedGraph?.nodes.length)}</span>
            <span>Inventory edges: {fmt(selectedGraph?.edges.length)}</span>
            <span>Inventory routes: {fmt(selectedGraph?.routes.length)}</span>
            <span>Inventory stations: {fmt(selectedGraph?.stations.length)}</span>
          </div>
        </div>

        <div className="dal-panel">
          <h3>Proposed State</h3>
          <div className="dal-metrics">
            <span>Scope: {selectedScopeVersion?.scopeVersionId ?? "none"}</span>
            <span>Opportunity Seeds: {fmt(seeds.length)}</span>
            <span>Imported Sites: {fmt(candidateSites.length)}</span>
            <span>Qualified Sites: {fmt(candidateSites.filter((site) => site.status === "QUALIFIED").length)}</span>
            <span>Added nodes: {fmt(extensionSummary?.addedNodeCount)}</span>
            <span>Added routes: {fmt(extensionSummary?.addedRouteCount)}</span>
            <span>Added feet: {fmt(Math.round(extensionSummary?.addedFeet ?? 0))}</span>
            <span>Proposed attachment: {networkBasis?.attachmentStrategy?.replaceAll("_", " ") ?? "n/a"}</span>
          <span>Attachment route: {networkBasis?.routeId ?? "n/a"}</span>
          <span>Attachment station: {networkBasis?.stationId ?? "n/a"}</span>
            <span>Added route miles: {proposedRouteMiles.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            <span>Added nodes from path: {fmt(proposedNodes)}</span>
            <span>Projected build cost: {money(proposedCost)}</span>
          <span>Projected crossings: {fmt(proposedCrossings)}</span>
          <span>Projected risk: {fmt(Math.round(proposedRisk))}</span>
          <span>Constructability: {fmt(Math.round(engineeringBasis?.constructabilityScore ?? constructability?.constructabilityScore ?? 0))}</span>
          <span>Buildable: {constructability?.buildableStatus ?? "n/a"}</span>
          <span>Capacity: {networkBasis?.capacityStatus ?? "n/a"}</span>
        </div>
      </div>

        <div className="dal-panel">
          <h3>Completed State</h3>
          <div className="dal-metrics">
            <span>Completed work: {fmt(twinState?.completedWorkItems)}</span>
            <span>Closures: {fmt(twinState?.closureCount)}</span>
            <span>Completed feet: {fmt(twinState?.completedFeet)}</span>
          </div>
        </div>
      </div>

      <div className="dal-panel">
        <h3>Planned Network State</h3>
        {selectedScopeVersion ? (
          <>
            <LeafletMap
              autoFocusKey={`${selectedScopeVersion.scopeVersionId}-planned`}
              candidates={plannedCandidatePoints}
              attachments={plannedAttachments}
              routes={plannedRoutes}
              buildPaths={plannedBuildPaths}
              stations={plannedStations}
              focusCoordinates={[
                ...plannedCandidatePoints.map((point) => point.coordinate),
                ...plannedAttachments.map((point) => point.coordinate),
                ...plannedBuildPaths.flatMap((path) => path.coordinates),
                ...plannedRoutes.flatMap((route) => route.coordinates),
              ]}
            />
            <div className="dal-metrics">
              <span>Candidate: {scopeSite?.name ?? scopeSite?.companyName ?? "n/a"}</span>
              <span>Lateral Coordinates: {fmt(plannedBuildPaths[0]?.coordinates.length)}</span>
              <span>Backbone Coordinates: {fmt(plannedRoutes[0]?.coordinates.length)}</span>
              <span>Attachment: {attachmentPoint ? `${attachmentPoint[1].toFixed(6)}, ${attachmentPoint[0].toFixed(6)}` : "n/a"}</span>
              <span>Service Path: {networkBasis?.routeId ?? "n/a"}</span>
            </div>
          </>
        ) : (
          <div className="dal-status">Select a ScopeVersion to view planned state.</div>
        )}
      </div>

      <div className="dal-panel">
        <h3>Spatial Layers</h3>
        <div className="dal-actions">
          {spatialLayerNames.map((layer) => (
            <button
              key={layer}
              type="button"
              className={visibleSpatialLayers[layer] ? "active-toggle" : ""}
              onClick={() => setVisibleSpatialLayers((prev) => ({ ...prev, [layer]: !prev[layer] }))}
            >
              {layer}
            </button>
          ))}
        </div>
        <div className="dal-metrics">
          {visibleSpatialLayers.Parcel && <span>Parcel: {constructability?.parcel.parcel.parcelId ?? "n/a"} / {constructability?.parcel.parcel.ownershipType ?? "n/a"}</span>}
          {visibleSpatialLayers.Road && <span>Road: {constructability?.road.nearestRoad.name ?? "n/a"} / {constructability?.road.nearestRoad.roadType ?? "n/a"}</span>}
          {visibleSpatialLayers.Rail && <span>Rail Crossings: {fmt(constructability?.rail.railCrossingCount)}</span>}
          {visibleSpatialLayers.Water && <span>Water Crossings: {fmt(constructability?.water.waterCrossingCount)}</span>}
          {visibleSpatialLayers.Permit && <span>Permit Authorities: {constructability?.permitting.authorities.join(", ") ?? "n/a"}</span>}
          {visibleSpatialLayers.Constructability && <span>Constructability Score: {fmt(Math.round(constructability?.constructabilityScore ?? 0))}</span>}
        </div>
      </div>

      <div className="dal-grid">
        {phases.map((phase) => (
          <div key={phase.label} className="dal-panel">
            <h3>{phase.label}</h3>
            <div className="dal-metrics">
              <span>Sites: {fmt(phase.seeds.length)}</span>
              <span>TCV: {fmt(Math.round(phase.seeds.reduce((sum, seed) => sum + seed.estimatedTCV, 0)))}</span>
              <span>Capex: {fmt(Math.round(phase.seeds.reduce((sum, seed) => sum + seed.buildCost, 0)))}</span>
              <span>Route Miles: {phase.seeds.reduce((sum, seed) => sum + Number(seed.buildMiles ?? seed.buildPath?.buildMiles ?? 0), 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
              <span>Build Cost: {money(phase.seeds.reduce((sum, seed) => sum + seed.buildCost, 0))}</span>
              <span>Crossings: {fmt(phase.seeds.reduce((sum, seed) => sum + Number(seed.buildPath?.estimatedCrossings ?? 0), 0))}</span>
              <span>Avg Risk: {fmt(Math.round(averageRisk(phase.seeds)))}</span>
              <span>Avg Score: {fmt(Math.round(phase.seeds.reduce((sum, seed) => sum + seed.overallScore, 0) / Math.max(phase.seeds.length, 1)))}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="dal-grid">
        <div className="dal-panel">
          <h3>Open Work</h3>
          <div className="dal-list">
            {workItems
              .filter((item) => !["COMPLETE", "CANCELLED"].includes(item.status))
              .map((item) => (
                <div key={item.workItemId} className="dal-list-row">
                  <span>{item.title}</span>
                  <b>{item.status}</b>
                  <small>{item.workItemId}</small>
                </div>
              ))}
          </div>
        </div>

        <div className="dal-panel">
          <h3>Completed Closures</h3>
          <div className="dal-list">
            {closures.map((closure) => (
              <div key={closure.closureId} className="dal-list-row">
                <span>{closure.closureType}</span>
                <b>{fmt(closure.footage)} ft</b>
                <small>{closure.closedAt}</small>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="dal-panel">
        <h3>State Timeline</h3>
        {twinState?.timeline.length ? (
          <div className="dal-list">
            {twinState.timeline.map((event) => (
              <div key={event.eventId} className="dal-list-row">
                <span>{event.type}</span>
                <b>{event.entityType}</b>
                <small>{event.createdAt}</small>
              </div>
            ))}
          </div>
        ) : (
          <div className="dal-status">No operational events yet.</div>
        )}
      </div>
    </section>
  );
}
