import { useEffect, useMemo, useState } from "react";
import {
  attachConstraintEvidence,
  certifyRoute,
  createDraftRoute,
  evaluateRouteAuthority,
  markGeometryEdited,
  rejectRoute,
  computeRouteGeometryHash,
} from "../routing/RouteAuthorityEngine";
import type { CertifiedRoute, CorridorBasis, RouteMode } from "../routing/CertifiedRouteAuthority";
import { renderCertifiedRouteAuthority } from "../routing/RouteAuthorityRenderer";
import { MapKernel } from "../mapkernel";
import {
  certifyCertifiedRoute,
  createCertifiedRoute,
  listCandidateSites,
  listCertifiedRoutes,
  listInventoryGraphs,
  listOpportunitySeeds,
  rejectCertifiedRoute,
  updateCertifiedRoute,
} from "../api/dalClient";
import type { DALCoordinate, InventoryGraphMetadata } from "../types/dal";
import type { CandidateSite } from "../types/candidateSite";
import type { OpportunitySeed } from "../types/portfolio";
import { useDALState } from "../dal/DALState";

type TargetType = "candidate" | "opportunity";

function fmt(value: number | undefined) {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function feet(value: number | undefined) {
  return `${Math.round(Number(value || 0)).toLocaleString()} ft`;
}

function miles(value: number | undefined) {
  return `${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} mi`;
}

function coordinateLabel(coordinate: DALCoordinate | undefined) {
  if (!coordinate) return "n/a";
  return `${coordinate[1].toFixed(6)}, ${coordinate[0].toFixed(6)}`;
}

function validCoordinate(coordinate: DALCoordinate | undefined): coordinate is DALCoordinate {
  return (
    Array.isArray(coordinate) &&
    coordinate.length >= 2 &&
    Number.isFinite(Number(coordinate[0])) &&
    Number.isFinite(Number(coordinate[1])) &&
    Math.abs(Number(coordinate[0])) <= 180 &&
    Math.abs(Number(coordinate[1])) <= 90
  );
}

function midpoint(a: DALCoordinate, b: DALCoordinate): DALCoordinate {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

function targetLabel(target: CandidateSite | OpportunitySeed | null, type: TargetType) {
  if (!target) return "No target selected";
  if (type === "candidate") return (target as CandidateSite).companyName;
  const seed = target as OpportunitySeed;
  return seed.siteName ?? seed.candidateSiteId ?? seed.id;
}

function targetCoordinate(target: CandidateSite | OpportunitySeed | null, type: TargetType): DALCoordinate | undefined {
  if (!target) return undefined;
  const lon = Number(type === "candidate" ? (target as CandidateSite).longitude : (target as OpportunitySeed).longitude);
  const lat = Number(type === "candidate" ? (target as CandidateSite).latitude : (target as OpportunitySeed).latitude);
  const coord: DALCoordinate = [lon, lat];
  return validCoordinate(coord) ? coord : undefined;
}

function nearestAttachmentFromSeed(seed: OpportunitySeed | null): DALCoordinate | undefined {
  const geometry = seed?.buildPath?.geometry;
  const candidate = targetCoordinate(seed, "opportunity");
  if (!geometry?.length || !candidate) return undefined;
  const first = geometry[0];
  const last = geometry[geometry.length - 1];
  if (!validCoordinate(first) || !validCoordinate(last)) return undefined;
  const firstDistance = Math.hypot(first[0] - candidate[0], first[1] - candidate[1]);
  const lastDistance = Math.hypot(last[0] - candidate[0], last[1] - candidate[1]);
  return firstDistance < lastDistance ? last : first;
}

function routeGeometryFromSeed(seed: OpportunitySeed | null, candidate: DALCoordinate, attachment: DALCoordinate) {
  const geometry = seed?.buildPath?.geometry?.filter(validCoordinate);
  if (geometry && geometry.length > 1) return geometry;
  return [candidate, attachment];
}

function referenceFromRoute(route: CertifiedRoute) {
  return {
    certifiedRouteId: route.certifiedRouteId,
    geometryHash: route.geometryHash,
    routeAuthorityState: route.routeAuthorityState,
    routeMode: route.routeMode,
    routeFeet: route.routeFeet,
    routeMiles: route.routeMiles,
    constraintEvidenceId: route.constraintEvidenceId,
  };
}

export default function RouteEngineeringWorkspace() {
  const {
    selectedInventoryId,
    setSelectedInventoryId,
    selectedCandidateSiteId,
    setSelectedCandidateSiteId,
    selectedOpportunitySeedId,
    setSelectedOpportunitySeedId,
  } = useDALState();
  const [inventories, setInventories] = useState<InventoryGraphMetadata[]>([]);
  const [candidateSites, setCandidateSites] = useState<CandidateSite[]>([]);
  const [opportunitySeeds, setOpportunitySeeds] = useState<OpportunitySeed[]>([]);
  const [certifiedRoutes, setCertifiedRoutes] = useState<CertifiedRoute[]>([]);
  const [selectedCertifiedRouteId, setSelectedCertifiedRouteId] = useState("");
  const [targetType, setTargetType] = useState<TargetType>("opportunity");
  const [draftRoute, setDraftRoute] = useState<CertifiedRoute | null>(null);
  const [selectedVertexIndex, setSelectedVertexIndex] = useState<number | null>(null);
  const [engineerName, setEngineerName] = useState("DAL Engineer");
  const [certificationNotes, setCertificationNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [status, setStatus] = useState("Route Engineering ready.");

  async function refresh() {
    try {
      const [nextInventories, nextCandidates, nextSeeds, nextRoutes] = await Promise.all([
        listInventoryGraphs(),
        listCandidateSites(),
        listOpportunitySeeds(),
        listCertifiedRoutes(),
      ]);
      setInventories(nextInventories);
      setCandidateSites(nextCandidates);
      setOpportunitySeeds(nextSeeds);
      setCertifiedRoutes(nextRoutes);
      if (!selectedInventoryId && nextInventories[0]) setSelectedInventoryId(nextInventories[0].inventoryId);
      setStatus("Route authority data loaded from DAL API.");
    } catch (error: any) {
      setStatus(`Route authority load failed: ${error?.message ?? String(error)}`);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const selectedInventory = inventories.find((inventory) => inventory.inventoryId === selectedInventoryId) ?? inventories[0] ?? null;
  const selectedSeed = opportunitySeeds.find((seed) => seed.id === selectedOpportunitySeedId) ?? opportunitySeeds[0] ?? null;
  const selectedCandidate = candidateSites.find((candidate) => candidate.candidateId === selectedCandidateSiteId) ?? candidateSites[0] ?? null;
  const selectedTarget = targetType === "candidate" ? selectedCandidate : selectedSeed;
  const selectedTargetCoordinate = targetCoordinate(selectedTarget, targetType);
  const activeRoute = draftRoute ?? certifiedRoutes.find((route) => route.certifiedRouteId === selectedCertifiedRouteId) ?? null;
  const evaluatedRoute = activeRoute ? evaluateRouteAuthority(activeRoute) : null;
  const routeSpec = useMemo(() => (evaluatedRoute ? renderCertifiedRouteAuthority(evaluatedRoute) : null), [evaluatedRoute]);

  function createDraft() {
    if (!selectedInventory || !selectedTargetCoordinate) {
      setStatus("Select an inventory and a geocoded candidate/opportunity first.");
      return;
    }
    const seed = targetType === "opportunity" ? selectedSeed : null;
    const attachment = nearestAttachmentFromSeed(seed) ?? selectedTargetCoordinate;
    const geometry = routeGeometryFromSeed(seed, selectedTargetCoordinate, attachment);
    const route = createDraftRoute({
      inventoryId: selectedInventory.inventoryId,
      graphId: selectedInventory.graphId,
      opportunitySeedId: seed?.id,
      candidateSiteId: targetType === "candidate" ? selectedCandidate?.candidateId : seed?.candidateSiteId,
      candidateCoordinate: selectedTargetCoordinate,
      attachmentCoordinate: attachment,
      nearestRouteId: seed?.nearestRouteId ?? seed?.buildPath?.routeId,
      nearestNodeId: seed?.nearestNodeId ?? seed?.buildPath?.nodeId,
      nearestStationId: seed?.nearestStationId ?? seed?.buildPath?.stationId,
      geometry,
      routeMode: geometry.length <= 2 ? "DIRECT_FALLBACK" : "ENGINEER_DEFINED",
      corridorBasis: geometry.length <= 2 ? "REFERENCE_ONLY" : "CANDIDATE_CORRIDOR",
      permitAuthorities: seed?.constructabilityAssessment?.permitting?.authorities ?? [],
    });
    setDraftRoute(route);
    setSelectedCertifiedRouteId("");
    setSelectedVertexIndex(null);
    setStatus(`${route.routeAuthorityState}: draft route created. Save to DAL API to establish server authority.`);
  }

  function updateGeometry(geometry: DALCoordinate[]) {
    if (!activeRoute) return;
    setDraftRoute(markGeometryEdited(activeRoute, geometry));
  }

  function updateRouteMode(routeMode: RouteMode) {
    if (!activeRoute) return;
    setDraftRoute(evaluateRouteAuthority({ ...activeRoute, routeMode }));
  }

  function updateCorridorBasis(corridorBasis: CorridorBasis) {
    if (!activeRoute) return;
    setDraftRoute(evaluateRouteAuthority({ ...activeRoute, corridorBasis }));
  }

  function addEvidenceSnapshot() {
    if (!activeRoute) return;
    const routeGeometryHash = computeRouteGeometryHash(activeRoute.geometry);
    setDraftRoute(
      attachConstraintEvidence(activeRoute, {
        evidenceId: `EV-${activeRoute.certifiedRouteId}-${Date.now()}`,
        evidenceHash: `evidence-${routeGeometryHash}`,
        routeGeometryHash,
        status: "CURRENT",
        summary: activeRoute.crossingSummary,
        constructabilityScore: activeRoute.constructabilityScore || 65,
        riskScore: activeRoute.riskScore || 35,
        permitAuthorities: activeRoute.permitAuthorities,
      })
    );
    setStatus("Current deterministic constraint evidence snapshot attached to route geometry hash.");
  }

  function addMidpointVertex() {
    if (!activeRoute?.geometry.length || activeRoute.geometry.length < 2) return;
    const geometry = [...activeRoute.geometry];
    const index = typeof selectedVertexIndex === "number" ? Math.min(selectedVertexIndex + 1, geometry.length - 1) : Math.max(1, geometry.length - 1);
    geometry.splice(index, 0, midpoint(geometry[index - 1], geometry[index]));
    updateGeometry(geometry);
    setSelectedVertexIndex(index);
  }

  async function saveRoute() {
    if (!activeRoute) return;
    try {
      const saved = activeRoute.certifiedRouteId && certifiedRoutes.some((route) => route.certifiedRouteId === activeRoute.certifiedRouteId)
        ? await updateCertifiedRoute(evaluateRouteAuthority(activeRoute))
        : await createCertifiedRoute(evaluateRouteAuthority(activeRoute));
      setCertifiedRoutes((prev) => [saved, ...prev.filter((route) => route.certifiedRouteId !== saved.certifiedRouteId)]);
      setSelectedCertifiedRouteId(saved.certifiedRouteId);
      setDraftRoute(null);
      setStatus(`CertifiedRoute persisted: ${saved.certifiedRouteId}`);
    } catch (error: any) {
      setStatus(`CertifiedRoute save failed: ${error?.message ?? String(error)}`);
    }
  }

  async function certifyActiveRoute() {
    if (!activeRoute) return;
    try {
      const localCertified = certifyRoute(activeRoute, { name: engineerName, notes: certificationNotes });
      const saved = certifiedRoutes.some((route) => route.certifiedRouteId === localCertified.certifiedRouteId)
        ? await updateCertifiedRoute(localCertified)
        : await createCertifiedRoute(localCertified);
      const serverCertified = await certifyCertifiedRoute(saved.certifiedRouteId, { engineerName, certificationNotes });
      setCertifiedRoutes((prev) => [serverCertified, ...prev.filter((route) => route.certifiedRouteId !== serverCertified.certifiedRouteId)]);
      setSelectedCertifiedRouteId(serverCertified.certifiedRouteId);
      setDraftRoute(null);
      setStatus(`CertifiedRoute certified: ${serverCertified.certifiedRouteId}`);
    } catch (error: any) {
      setStatus(`Certification blocked: ${error?.message ?? String(error)}`);
    }
  }

  async function rejectActiveRoute() {
    if (!activeRoute) return;
    try {
      const rejected = rejectRoute(activeRoute, rejectionReason || "Rejected during Route Engineering review.");
      const saved = certifiedRoutes.some((route) => route.certifiedRouteId === rejected.certifiedRouteId)
        ? await updateCertifiedRoute(rejected)
        : await createCertifiedRoute(rejected);
      const serverRejected = await rejectCertifiedRoute(saved.certifiedRouteId, { reason: rejectionReason || "Rejected during Route Engineering review." });
      setCertifiedRoutes((prev) => [serverRejected, ...prev.filter((route) => route.certifiedRouteId !== serverRejected.certifiedRouteId)]);
      setSelectedCertifiedRouteId(serverRejected.certifiedRouteId);
      setDraftRoute(null);
      setStatus(`CertifiedRoute rejected: ${serverRejected.certifiedRouteId}`);
    } catch (error: any) {
      setStatus(`Route rejection failed: ${error?.message ?? String(error)}`);
    }
  }

  return (
    <section className="dal-workspace route-engineering-workspace">
      <div className="dal-panel">
        <div className="dal-panel-title-row">
          <div>
            <h2>Route Engineering</h2>
            <p>CertifiedRoute is route authority. Direct fallback geometry remains advisory and blocks authoritative downstream work.</p>
          </div>
          <button type="button" onClick={refresh}>Refresh DAL API</button>
        </div>
        <div className="dal-status">{status}</div>
      </div>

      <div className="route-engineering-map-first">
        <MapKernel
          specs={routeSpec ? [routeSpec] : []}
          initialMode="geographic"
          initialBaseLayer="hybrid"
          editableRoute={
            activeRoute
              ? {
                  routeId: activeRoute.certifiedRouteId,
                  geometry: activeRoute.geometry,
                  enabled: activeRoute.routeAuthorityState !== "CERTIFIED_ROUTE",
                  selectedVertexIndex,
                  onGeometryChange: updateGeometry,
                  onVertexSelect: setSelectedVertexIndex,
                }
              : undefined
          }
          height={680}
        />
      </div>

      <div className="dal-grid two">
        <div className="dal-panel">
          <h3>Route Inputs</h3>
          <label>
            Inventory
            <select value={selectedInventory?.inventoryId ?? ""} onChange={(event) => setSelectedInventoryId(event.target.value)}>
              {inventories.map((inventory) => (
                <option key={inventory.inventoryId} value={inventory.inventoryId}>
                  {inventory.name} / {inventory.inventoryId}
                </option>
              ))}
            </select>
          </label>
          <label>
            Target Type
            <select value={targetType} onChange={(event) => setTargetType(event.target.value as TargetType)}>
              <option value="opportunity">Opportunity Seed</option>
              <option value="candidate">Candidate Site</option>
            </select>
          </label>
          {targetType === "opportunity" ? (
            <label>
              Opportunity
              <select value={selectedSeed?.id ?? ""} onChange={(event) => setSelectedOpportunitySeedId(event.target.value)}>
                {opportunitySeeds.map((seed) => (
                  <option key={seed.id} value={seed.id}>
                    {seed.siteName ?? seed.id}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label>
              Candidate
              <select value={selectedCandidate?.candidateId ?? ""} onChange={(event) => setSelectedCandidateSiteId(event.target.value)}>
                {candidateSites.map((candidate) => (
                  <option key={candidate.candidateId} value={candidate.candidateId}>
                    {candidate.companyName}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="dal-actions">
            <button type="button" onClick={createDraft} disabled={!selectedInventory || !selectedTargetCoordinate}>
              Create Draft Route
            </button>
            <button type="button" onClick={saveRoute} disabled={!activeRoute}>
              Save CertifiedRoute
            </button>
          </div>
          <div className="dal-metrics">
            <span>Target: {targetLabel(selectedTarget, targetType)}</span>
            <span>Candidate Coordinate: {coordinateLabel(selectedTargetCoordinate)}</span>
            <span>Inventory: {selectedInventory?.inventoryId ?? "n/a"}</span>
            <span>Graph: {selectedInventory?.graphId ?? "n/a"}</span>
          </div>
        </div>

        <div className="dal-panel">
          <h3>CertifiedRoute Repository</h3>
          <label>
            Existing CertifiedRoute
            <select
              value={selectedCertifiedRouteId}
              onChange={(event) => {
                setSelectedCertifiedRouteId(event.target.value);
                setDraftRoute(null);
              }}
            >
              <option value="">Draft / none</option>
              {certifiedRoutes.map((route) => (
                <option key={route.certifiedRouteId} value={route.certifiedRouteId}>
                  {route.certifiedRouteId} / {route.routeAuthorityState}
                </option>
              ))}
            </select>
          </label>
          <div className="dal-metrics">
            <span>Total CertifiedRoute Records: {certifiedRoutes.length.toLocaleString()}</span>
            <span>Certified: {certifiedRoutes.filter((route) => route.routeAuthorityState === "CERTIFIED_ROUTE").length.toLocaleString()}</span>
            <span>Direct Fallback: {certifiedRoutes.filter((route) => route.routeAuthorityState === "DIRECT_FALLBACK").length.toLocaleString()}</span>
            <span>Review Required: {certifiedRoutes.filter((route) => route.routeAuthorityState === "ENGINEER_REVIEW_REQUIRED").length.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div className="dal-grid two">
        <div className="dal-panel">
          <h3>Route Authority Evidence</h3>
          {evaluatedRoute ? (
            <>
              <div className="dal-grid compact">
                <label>
                  Route Mode
                  <select value={evaluatedRoute.routeMode} onChange={(event) => updateRouteMode(event.target.value as RouteMode)}>
                    <option value="DIRECT_FALLBACK">DIRECT_FALLBACK</option>
                    <option value="ROAD_ROW">ROAD_ROW</option>
                    <option value="UTILITY_EASEMENT">UTILITY_EASEMENT</option>
                    <option value="EXISTING_TELECOM">EXISTING_TELECOM</option>
                    <option value="RAIL_CORRIDOR">RAIL_CORRIDOR</option>
                    <option value="POWER_CORRIDOR">POWER_CORRIDOR</option>
                    <option value="PRIVATE_EASEMENT">PRIVATE_EASEMENT</option>
                    <option value="ENGINEER_DEFINED">ENGINEER_DEFINED</option>
                  </select>
                </label>
                <label>
                  Corridor Basis
                  <select value={evaluatedRoute.corridorBasis} onChange={(event) => updateCorridorBasis(event.target.value as CorridorBasis)}>
                    <option value="REFERENCE_ONLY">REFERENCE_ONLY</option>
                    <option value="CANDIDATE_CORRIDOR">CANDIDATE_CORRIDOR</option>
                    <option value="CERTIFIED_CORRIDOR">CERTIFIED_CORRIDOR</option>
                    <option value="ENGINEER_DEFINED_CORRIDOR">ENGINEER_DEFINED_CORRIDOR</option>
                    <option value="UNKNOWN">UNKNOWN</option>
                  </select>
                </label>
              </div>
              <div className="dal-metrics">
                <span>Authority State: {evaluatedRoute.routeAuthorityState}</span>
                <span>Geometry Hash: {evaluatedRoute.geometryHash}</span>
                <span>Route Feet: {feet(evaluatedRoute.routeFeet)}</span>
                <span>Route Miles: {miles(evaluatedRoute.routeMiles)}</span>
                <span>Crow-Fly Feet: {feet(evaluatedRoute.crowFlyFeet)}</span>
                <span>Route/Crow-Fly Ratio: {fmt(evaluatedRoute.routeToCrowFlyRatio)}</span>
                <span>Constraint Evidence: {evaluatedRoute.constraintEvidenceStatus}</span>
                <span>Constructability: {fmt(evaluatedRoute.constructabilityScore)}</span>
                <span>Risk: {fmt(evaluatedRoute.riskScore)}</span>
                <span>Road Crossings: {evaluatedRoute.crossingSummary.roadCrossings}</span>
                <span>Rail Crossings: {evaluatedRoute.crossingSummary.railCrossings}</span>
                <span>Water Crossings: {evaluatedRoute.crossingSummary.waterCrossings}</span>
                <span>Parcel Crossings: {evaluatedRoute.crossingSummary.parcelCrossings}</span>
                <span>Building Conflicts: {evaluatedRoute.crossingSummary.buildingConflicts}</span>
                <span>Quote Authority: {evaluatedRoute.authority.canGenerateAuthoritativeQuote ? "AUTHORIZED" : "BLOCKED"}</span>
                <span>IOF Package Authority: {evaluatedRoute.authority.canCreateIOFPackage ? "AUTHORIZED" : "BLOCKED"}</span>
                <span>Control Work Authority: {evaluatedRoute.authority.canCreateControlWork ? "AUTHORIZED" : "BLOCKED"}</span>
                <span>Field Work Authority: {evaluatedRoute.authority.canCreateFieldWork ? "AUTHORIZED" : "BLOCKED"}</span>
                <span>Twin Planned State: {evaluatedRoute.authority.canMutateTwinPlannedState ? "AUTHORIZED" : "ADVISORY ONLY"}</span>
              </div>
              <div className="dal-actions">
                <button type="button" onClick={addMidpointVertex} disabled={evaluatedRoute.routeAuthorityState === "CERTIFIED_ROUTE"}>
                  Add Engineering Vertex
                </button>
                <button type="button" onClick={addEvidenceSnapshot}>
                  Attach Current Evidence Snapshot
                </button>
              </div>
            </>
          ) : (
            <div className="dal-status">Create or select a CertifiedRoute.</div>
          )}
        </div>

        <div className="dal-panel">
          <h3>Certification</h3>
          <label>
            Engineer
            <input value={engineerName} onChange={(event) => setEngineerName(event.target.value)} />
          </label>
          <label>
            Certification Notes
            <textarea value={certificationNotes} onChange={(event) => setCertificationNotes(event.target.value)} rows={4} />
          </label>
          <label>
            Rejection Reason
            <textarea value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} rows={3} />
          </label>
          <div className="dal-actions">
            <button type="button" onClick={certifyActiveRoute} disabled={!evaluatedRoute}>
              Certify Route
            </button>
            <button type="button" onClick={rejectActiveRoute} disabled={!evaluatedRoute}>
              Reject Route
            </button>
          </div>
          {evaluatedRoute ? (
            <div className="dal-callout">
              <strong>Required Actions</strong>
              <ul>
                {evaluatedRoute.authority.requiredActions.map((action) => (
                  <li key={action}>{action}</li>
                ))}
                {!evaluatedRoute.authority.requiredActions.length ? <li>None. Route is authoritative for certified uses.</li> : null}
              </ul>
              <strong>Warnings</strong>
              <ul>
                {evaluatedRoute.authority.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
                {!evaluatedRoute.authority.warnings.length ? <li>None.</li> : null}
              </ul>
            </div>
          ) : null}
        </div>
      </div>

      {evaluatedRoute ? (
        <div className="dal-panel">
          <button type="button" onClick={() => setShowDiagnostics((prev) => !prev)}>
            {showDiagnostics ? "Hide" : "Show"} Advanced Diagnostics
          </button>
          {showDiagnostics ? (
            <pre className="dal-json">{JSON.stringify({ certifiedRoute: evaluatedRoute, scopeVersionReference: referenceFromRoute(evaluatedRoute) }, null, 2)}</pre>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
