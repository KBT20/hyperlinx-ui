import { useEffect, useState } from "react";
import { listControlWorkItems, listFieldClosures, loadCertifiedIofTwinState, loadTwinState } from "../api/dalClient";
import { countersignServiceOrder, downloadRuntimeArtifact, generateServiceOrder, issueServiceOrder, listServiceOrders, recordServiceOrderCustomerSignature, type ServiceOrderRuntime } from "../api/teralinxRuntime";
import ScopeVersionLifecycleRibbon from "../components/ScopeVersionLifecycleRibbon";
import { useDALState } from "../dal/DALState";
import { MapKernel, renderSharedOpportunityMapProjection, type SharedOpportunityMapProjection } from "../mapkernel";
import { LeafletMap, type GISBuildPath, type GISPoint, type GISRoute } from "../gis";
import { deriveLifecycleViolations } from "../scopeversion/LifecycleAuthorityEngine";
import { getAuthoritativeLifecycleState } from "../scopeversion/ScopeVersionLifecycleGuard";
import { buildScopeVersionTwinProjection } from "../scopeversion/ScopeVersionTwinProjection";
import type { ClosureRecord, ControlWorkItem, DALCoordinate, FieldClosure, InventoryRoute, TwinState } from "../types/dal";
import { useTeralinxAuth } from "../identity/TeralinxAuth";

function fmt(n: number | undefined) {
  return Number(n || 0).toLocaleString();
}

function money(n: number | undefined) {
  return Number(n || 0).toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
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
  const { session } = useTeralinxAuth();
  const { selectedGraph, selectedScopeVersion } = useDALState();
  const selectedScopeVersionId = selectedScopeVersion?.scopeVersionId ?? "";
  const [twinState, setTwinState] = useState<TwinState | null>(null);
  const [workItems, setWorkItems] = useState<ControlWorkItem[]>([]);
  const [closures, setClosures] = useState<FieldClosure[]>([]);
  const [visibleSpatialLayers, setVisibleSpatialLayers] = useState<Record<SpatialLayerName, boolean>>({
    Parcel: true,
    Road: true,
    Rail: true,
    Water: true,
    Permit: true,
    Constructability: true,
  });
  const [status, setStatus] = useState("Twin ready.");
  const [serviceOrder, setServiceOrder] = useState<ServiceOrderRuntime | null>(null);
  const [authorizationPending, setAuthorizationPending] = useState(false);
  const [customerAcknowledged, setCustomerAcknowledged] = useState(false);
  const [teralinxAcknowledged, setTeralinxAcknowledged] = useState(false);

  useEffect(() => {
    void refresh();
  }, [selectedScopeVersionId]);

  async function refresh() {
    try {
      if (!selectedScopeVersionId) {
        try {
          const certifiedState = await loadCertifiedIofTwinState();
          setTwinState(certifiedState);
          const certified = certifiedState?.certifiedTwin as Record<string, unknown> | undefined;
          const orders = await listServiceOrders(session);
          setServiceOrder(orders.find((item) => item.certifiedPackageId === certified?.certifiedIofPackageId) ?? null);
          setWorkItems([]);
          setClosures([]);
          setStatus("Certified IOF Twin loaded from governed repositories.");
          return;
        } catch {
        }
      }
      const [state, work, field] = await Promise.all([
        loadTwinState(selectedScopeVersionId),
        listControlWorkItems(),
        listFieldClosures(),
      ]);
      setTwinState(state);
      setWorkItems(work);
      setClosures(field);
      setStatus("Twin state loaded.");
    } catch (err: any) {
      setStatus(`Twin load failed: ${err?.message ?? String(err)}`);
    }
  }

  const certifiedTwin = twinState?.projectionType === "CERTIFIED_IOF_TWIN" ? twinState.certifiedTwin : null;
  const certifiedMapProjection = twinState?.sharedOpportunityMapProjection as SharedOpportunityMapProjection | undefined;
  if (certifiedTwin) {
    const lensAuthority = certifiedTwin.lensAuthority as { reasoningAuthority?: string; lenses?: Array<Record<string, unknown>> } | undefined;
    const constraintSummary = certifiedTwin.constraintSummary as Record<string, unknown> | undefined;
    const certifiedMapSpecs = certifiedMapProjection ? [renderSharedOpportunityMapProjection(certifiedMapProjection)] : [];
    const pricing = (serviceOrder?.pricingSummary ?? {}) as Record<string, unknown>;
    const terms = (serviceOrder?.commercialTerms ?? {}) as Record<string, unknown>;
    const customerSignerAuthorized = Array.isArray(serviceOrder?.authorizedCustomerSignerUserIds) && serviceOrder.authorizedCustomerSignerUserIds.includes(session?.user?.userId);
    const authorizationAction = async (action: "create" | "issue" | "customer" | "countersign") => {
      setAuthorizationPending(true);
      try {
        if (action === "create") {
          const next = await generateServiceOrder({ proposalId: String(certifiedTwin.proposalId), certifiedPackageId: String(certifiedTwin.certifiedIofPackageId) }, session);
          setServiceOrder(next); setStatus("Service Order draft created from the exact Certified IOF.");
        } else if (action === "issue" && serviceOrder) {
          setServiceOrder(await issueServiceOrder(serviceOrder.serviceOrderId, session)); setStatus("Service Order revision issued and locked for signature.");
        } else if (action === "customer" && serviceOrder) {
          const next = await recordServiceOrderCustomerSignature(serviceOrder.serviceOrderId, { documentHash: String(serviceOrder.documentHash), typedName: String(session?.user?.name ?? ""), authorityAcknowledged: customerAcknowledged }, session);
          setServiceOrder(next); setStatus("Customer acceptance recorded. Execution remains unauthorized pending Teralinx countersignature.");
        } else if (action === "countersign" && serviceOrder) {
          await countersignServiceOrder(serviceOrder.serviceOrderId, { documentHash: String(serviceOrder.documentHash), authorizationAcknowledged: teralinxAcknowledged }, session);
          setStatus("Teralinx countersignature committed atomically with ScopeVersion authorization."); await refresh();
        }
      } catch (error: any) { setStatus(`Authorization action failed: ${error?.message ?? String(error)}`); }
      finally { setAuthorizationPending(false); }
    };
    return (
      <section className="dal-workspace engineering-certification-shell">
        <div className="dal-workspace-header">
          <div>
            <span className="engineering-review-eyebrow">Certified IOF Twin</span>
            <h2>IOF Twin · {String(certifiedTwin.productName || certifiedTwin.productId || "Certified IOF Package").replaceAll("_", " ")}</h2>
            <strong>{String(certifiedTwin.opportunityId ?? "Certified opportunity")}</strong>
            <p>A reference-only representation of the exact certified IOF. Commercial authorization changes its lifecycle state without changing its certified technical basis.</p>
          </div>
          <button type="button" onClick={() => void refresh()}>Refresh governed state</button>
        </div>

        <div className="engineering-final-review-grid" aria-label="Certified Twin state">
          <span>Twin State<b>{String(certifiedTwin.twinState ?? "CERTIFIED")}</b></span>
          <span>Certification State<b>{String(certifiedTwin.certificationState ?? "CERTIFIED")}</b></span>
          <span>Execution State<b>{String(certifiedTwin.executionState ?? "NOT_AUTHORIZED").replaceAll("_", " ")}</b></span>
          <span>Service Order<b>{String(certifiedTwin.serviceOrderState ?? "NOT_CREATED").replaceAll("_", " ")}</b></span>
          <span>ScopeVersion<b>{String(certifiedTwin.scopeVersionState ?? "NOT_CREATED").replaceAll("_", " ")}</b></span>
          <span>Route Revision<b>{String(certifiedTwin.routeRevision ?? "—")}</b></span>
          <span>Route<b>{Number(certifiedMapProjection?.routeMiles ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} miles</b></span>
        </div>

        <section className="dal-panel" aria-label="Commercial Authorization">
          <div className="dal-panel-title-row"><div><h3>Commercial Authorization</h3><small>Certified IOF → Service Order → Customer acceptance → Teralinx countersignature + ScopeVersion</small></div><span className={`dal-badge ${certifiedTwin.twinState === "AUTHORIZED" ? "pass" : "warning"}`}>{String(certifiedTwin.executionState ?? "NOT_AUTHORIZED").replaceAll("_", " ")}</span></div>
          {!serviceOrder ? <button type="button" disabled={authorizationPending} onClick={() => void authorizationAction("create")}>Create Service Order</button> : <>
            <div className="dal-metrics">
              <span>Service Order: {serviceOrder.serviceOrderId}</span><span>Revision: {String(serviceOrder.documentRevision ?? 1)}</span>
              <span>Status: {serviceOrder.status}</span><span>Customer: {String((serviceOrder.customer as Record<string, unknown>)?.name ?? "Customer")}</span>
              <span>Non-recurring: {money(Number(pricing.nonRecurringCharge ?? 0))}</span><span>Monthly: {money(Number(pricing.monthlyRecurringCharge ?? 0))}</span><span>Term: {String(pricing.termMonths ?? terms.serviceTermMonths ?? "—")} months</span>
            </div>
            <p>{String((serviceOrder.serviceDescription as Record<string, unknown>)?.productName ?? "Network infrastructure service")} over {Number((serviceOrder.routeSummary as Record<string, unknown>)?.routeMiles ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} route miles.</p>
            <details><summary>Read full Service Order terms and exact governed references</summary><div className="dal-metrics"><span>Payment: {String(terms.paymentTerms ?? "—")}</span><span>Change control: {String(terms.changeControl ?? "—")}</span><span>Governing terms: {String(terms.governingTerms ?? "—")}</span><span>Document hash: {String(serviceOrder.documentHash ?? "—")}</span><span>Certified IOF: {String(serviceOrder.certifiedPackageId ?? "—")}</span></div></details>
            {serviceOrder.status === "DRAFT" && <button type="button" disabled={authorizationPending} onClick={() => void authorizationAction("issue")}>Issue Service Order Revision</button>}
            {serviceOrder.status === "ISSUED" && <div>{!customerSignerAuthorized && <p className="dal-status warning">Sign in as the customer participant assigned to this Proposal to accept this revision.</p>}<label><input type="checkbox" disabled={!customerSignerAuthorized} checked={customerAcknowledged} onChange={(event) => setCustomerAcknowledged(event.target.checked)} /> I am authorized to sign for the customer and accept this exact revision.</label><button type="button" disabled={authorizationPending || !customerAcknowledged || !customerSignerAuthorized} onClick={() => void authorizationAction("customer")}>Sign as Customer · {String(session?.user?.name ?? "authenticated user")}</button></div>}
            {serviceOrder.status === "CUSTOMER_ACCEPTED" && <div><p>Customer accepted. This has not created execution authority.</p><label><input type="checkbox" checked={teralinxAcknowledged} onChange={(event) => setTeralinxAcknowledged(event.target.checked)} /> I am authorized by Teralinx to countersign and create the ScopeVersion Order for Execution.</label><button type="button" disabled={authorizationPending || !teralinxAcknowledged} onClick={() => void authorizationAction("countersign")}>Countersign & Authorize ScopeVersion</button></div>}
            {serviceOrder.status === "COUNTERSIGNED" && <div className="dal-status pass">Fully authorized · ScopeVersion {String(serviceOrder.scopeVersionId ?? certifiedTwin.scopeVersionId ?? "created")}</div>}
            <div className="dal-actions"><button type="button" onClick={() => void downloadRuntimeArtifact(`/api/exports/service-orders/${encodeURIComponent(serviceOrder.serviceOrderId)}/pdf`, session).then((artifact) => setStatus(`Downloaded ${artifact.filename}.`)).catch((error) => setStatus(`Service Order PDF failed: ${error.message}`))}>Download Service Order PDF</button></div>
          </>}
          <div className="dal-actions">
            <button type="button" onClick={() => void downloadRuntimeArtifact(`/api/exports/certified-iof/${encodeURIComponent(String(certifiedTwin.certifiedIofPackageId))}/route.kmz`, session).then((artifact) => setStatus(`Downloaded ${artifact.filename}.`)).catch((error) => setStatus(`Certified KMZ failed: ${error.message}`))}>Download Certified Route KMZ</button>
            {Boolean(certifiedTwin.scopeVersionId) && <button type="button" onClick={() => void downloadRuntimeArtifact(`/api/exports/scopeversions/${encodeURIComponent(String(certifiedTwin.scopeVersionId))}/route.kmz`, session).then((artifact) => setStatus(`Downloaded ${artifact.filename}.`)).catch((error) => setStatus(`Authorized KMZ failed: ${error.message}`))}>Download Authorized Route KMZ</button>}
          </div>
        </section>

        <section className="dal-panel">
          <div className="dal-panel-title-row"><div><h3>Shared Opportunity Map</h3><small>{String(certifiedTwin.routeRepositoryId ?? "Governed route unavailable")} · geometry {String(certifiedTwin.geometryHash ?? "unavailable")}</small></div><span className="dal-badge pass">CERTIFIED ROUTE</span></div>
          {certifiedMapSpecs.length ? <MapKernel specs={certifiedMapSpecs} initialMode="geographic" initialBaseLayer="hybrid" stationDensityFeet={0} showStationLabels height={620} presentationContext="TWIN" /> : <div className="dal-status warning">The governed source package could not be projected onto the shared Opportunity Map.</div>}
        </section>

        <div className="dal-grid">
          <section className="dal-panel">
            <h3>Certification & Lineage</h3>
            <div className="dal-metrics">
              <span>Certified IOF: {String(certifiedTwin.certifiedIofPackageId ?? "—")}</span>
              <span>Certified by: {String(certifiedTwin.certifiedBy ?? "—")}</span>
              <span>Certified at: {String(certifiedTwin.certifiedAt ?? "—")}</span>
              <span>Certification Ledger: {String(certifiedTwin.certificationLedgerId ?? "—")}</span>
              <span>Engineering Revision: {String(certifiedTwin.engineeringRevisionId ?? "—")}</span>
              <span>Engineering Approval: {String(certifiedTwin.engineeringApprovalId ?? "—")}</span>
              <span>Commercial Revision: {String(certifiedTwin.commercialRevisionId ?? "—")}</span>
              <span>Proposal Revision: {String(certifiedTwin.proposalRevisionId ?? "—")}</span>
            </div>
          </section>
          <section className="dal-panel">
            <h3>Certified Basis</h3>
            <div className="dal-metrics">
              <span>Stations: {fmt(Number(certifiedTwin.stationAuthorityCount ?? 0))}</span>
              <span>Governed objects: {fmt(Number(certifiedTwin.objectCount ?? 0))}</span>
              <span>Projected route objects: {fmt(Number(certifiedTwin.projectedObjectCount ?? 0))}</span>
              <span>Governed spans: {fmt(Number(certifiedTwin.spanCount ?? 0))}</span>
              <span>Work segments: {fmt(Number(certifiedTwin.workSegmentCount ?? 0))}</span>
              <span>Conditions: {fmt(Number(constraintSummary?.total ?? 0))}</span>
              <span>Resolved / accepted: {fmt(Number(constraintSummary?.resolved ?? 0) + Number(constraintSummary?.accepted ?? 0))}</span>
              <span>Open: {fmt(Number(constraintSummary?.open ?? 0))}</span>
              <span>Product Doctrine: {String(certifiedTwin.productDoctrineId ?? "—")}</span>
              <span>Project Configuration: {String(certifiedTwin.projectConfigurationId ?? "—")}</span>
              <span>Quantity Reconciliation: {String(certifiedTwin.quantityReconciliationId ?? "—")}</span>
            </div>
          </section>
        </div>

        <details className="dal-panel">
          <summary>Lens Authority & Package Integrity</summary>
          <div className="dal-metrics">
            <span>Twin identity: {String(certifiedTwin.twinId ?? "—")}</span>
            <span>Twin state identity: {String(certifiedTwin.twinStateId ?? "—")}</span>
            <span>Certification hash: {String(certifiedTwin.certificationHash ?? "—")}</span>
            <span>Revision hash: {String(certifiedTwin.engineeringRevisionHash ?? "—")}</span>
            <span>Approval hash: {String(certifiedTwin.engineeringApprovalHash ?? "—")}</span>
            <span>Lens reasoning: {String(lensAuthority?.reasoningAuthority ?? "ADVISORY_ONLY").replaceAll("_", " ")}</span>
            <span>Available lenses: {(lensAuthority?.lenses ?? []).map((lens) => String(lens.label ?? lens.lensId)).join(", ") || "—"}</span>
            <span>Mutation authority: none; certified state is immutable</span>
          </div>
        </details>
        <div className="dal-status pass">{status}</div>
      </section>
    );
  }

  const projectionScopeVersion = twinState?.scopeVersion ?? selectedScopeVersion;
  const scopeTruth = projectionScopeVersion?.canonicalTruth as any;
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
  const routeAuthorityState = projectionScopeVersion?.certifiedRouteReference?.routeAuthorityState ?? "NO_CERTIFIED_ROUTE";
  const plannedStateAuthority = routeAuthorityState === "CERTIFIED_ROUTE" ? "PLANNED NETWORK TRUTH" : "ADVISORY ONLY";
  const twinProjection = buildScopeVersionTwinProjection(projectionScopeVersion);
  const authoritativeLifecycleState = getAuthoritativeLifecycleState(projectionScopeVersion);
  const selectedScopeWorkItems = twinState?.workItems ?? workItems.filter((item) => item.scopeVersionId === selectedScopeVersionId);
  const activeSelectedScopeWorkItems = selectedScopeWorkItems.filter((item) => item.status === "ACTIVE");
  const selectedScopeFieldClosures = closures.filter((closure) => closure.scopeVersionId === selectedScopeVersionId);
  const selectedScopeClosureRecords: ClosureRecord[] = projectionScopeVersion
    ? [...(projectionScopeVersion.canonicalTruth?.closures ?? []), ...(projectionScopeVersion.closures ?? [])]
      .filter((closure) => closure.scopeVersionId === projectionScopeVersion.scopeVersionId)
      .filter(
        (closure, index, list) => list.findIndex((item) => item.closureId === closure.closureId) === index
      )
    : [];
  const completedClosureSource = twinState?.projectionSource ?? (selectedScopeFieldClosures.length ? "SERVER_FIELD_CLOSURE_LEDGER" : "SCOPEVERSION_CLOSURE_LEDGER");
  const completedClosures = twinState?.closures ?? (selectedScopeFieldClosures.length ? selectedScopeFieldClosures : selectedScopeClosureRecords);
  const projectionSource = twinState?.projectionSource ?? (selectedScopeFieldClosures.length && selectedScopeClosureRecords.length ? "MIXED" : selectedScopeFieldClosures.length ? "SERVER" : selectedScopeClosureRecords.length ? "LOCAL_FALLBACK" : "SERVER");
  const lifecycleViolations =
    twinState?.lifecycleViolations ??
    deriveLifecycleViolations(projectionScopeVersion ? [projectionScopeVersion] : [], selectedScopeWorkItems, completedClosures);
  const projectionMetrics = twinState?.metrics ?? {
    openWorkItems: selectedScopeWorkItems.filter((item) => !["COMPLETE", "CANCELLED"].includes(item.status)).length,
    completedWorkItems: selectedScopeWorkItems.filter((item) => item.status === "COMPLETE").length,
    activeWorkItems: activeSelectedScopeWorkItems.length,
    pendingWorkItems: selectedScopeWorkItems.filter((item) => item.status === "PENDING").length,
    cancelledWorkItems: selectedScopeWorkItems.filter((item) => item.status === "CANCELLED").length,
    closureCount: completedClosures.length,
    completedFeet: completedClosures.reduce((sum, closure) => sum + Number((closure as FieldClosure).footage ?? (closure as ClosureRecord).feetAffected ?? 0), 0),
    releasedObjects: twinProjection.releasedObjects,
    installedObjects: twinProjection.installedObjects,
    testedObjects: twinProjection.testedObjects,
    acceptedObjects: twinProjection.acceptedObjects,
    completedObjects: twinProjection.completeObjects,
    verifiedObjects: twinProjection.verifiedObjects,
    blockedObjects: twinProjection.blockedObjects,
    rejectedObjects: twinProjection.rejectedObjects,
    plannedAssets: (twinProjection.stationStateCounts as Record<string, number>).PLANNED ?? 0,
    releasedAssets: (twinProjection.stationStateCounts as Record<string, number>).RELEASED ?? 0,
    inProgressAssets: (twinProjection.stationStateCounts as Record<string, number>).IN_PROGRESS ?? 0,
    completedAssets: (twinProjection.stationStateCounts as Record<string, number>).COMPLETE ?? 0,
    verifiedAssets: (twinProjection.stationStateCounts as Record<string, number>).VERIFIED ?? 0,
    blockedAssets: (twinProjection.stationStateCounts as Record<string, number>).BLOCKED ?? 0,
    rejectedAssets: (twinProjection.stationStateCounts as Record<string, number>).REJECTED ?? 0,
    percentComplete: twinProjection.percentComplete,
    objectCompletionPercent: twinProjection.objectCompletionPercent,
    stationDerivedCompletionPercent: twinProjection.stationDerivedCompletionPercent,
  };
  const completionProjection = twinState?.completionProjection ?? projectionMetrics.completionProjection;
  const projectionTimeline = twinState?.timeline ?? [];
  const commercialRuntimeObjects = Array.isArray((twinState as any)?.commercialRuntimeObjects)
    ? (twinState as any).commercialRuntimeObjects as Array<Record<string, any>>
    : [];
  const graphContext = twinState?.graphContext;
  const expectedInventoryId = graphContext?.inventoryId ?? projectionScopeVersion?.inventoryId ?? projectionScopeVersion?.sourceInventoryId ?? (projectionScopeVersion?.canonicalTruth as any)?.graphReference?.inventoryId;
  const expectedGraphId = graphContext?.graphId ?? projectionScopeVersion?.graphId ?? (projectionScopeVersion?.canonicalTruth as any)?.graphReference?.graphId;
  const graphContextMatched =
    !selectedGraph ||
    ((!expectedInventoryId || selectedGraph.inventoryId === expectedInventoryId) && (!expectedGraphId || selectedGraph.graphId === expectedGraphId));
  const twinStationStateCounts = twinProjection.stationStateCounts as Record<string, number>;
  const twinObjectStateCounts = twinProjection.objectStateCounts as Record<string, number>;
  const attachmentPoint = networkBasis?.attachmentCoordinates as DALCoordinate | undefined;
  const plannedRoute = graphContextMatched ? selectedGraph?.routes.find((route) => route.routeId === networkBasis?.routeId) : undefined;
  const plannedRouteSegment = routeSegmentForAttachment(plannedRoute, attachmentPoint);
  const plannedCandidatePoints: GISPoint[] =
    Number.isFinite(Number(geographicBasis?.candidateLongitude ?? projectionScopeVersion?.longitude)) && Number.isFinite(Number(geographicBasis?.candidateLatitude ?? projectionScopeVersion?.latitude))
      ? [
          {
            id: String(scopeSite?.candidateId ?? projectionScopeVersion?.scopeVersionId ?? "candidate"),
            label: String(scopeSite?.name ?? scopeSite?.companyName ?? "Candidate"),
            coordinate: [Number(geographicBasis?.candidateLongitude ?? projectionScopeVersion?.longitude), Number(geographicBasis?.candidateLatitude ?? projectionScopeVersion?.latitude)],
            kind: "candidate",
          },
        ]
      : [];
  const plannedAttachments: GISPoint[] = attachmentPoint
    ? [
        {
          id: `${projectionScopeVersion?.scopeVersionId ?? "scope"}-attachment`,
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
          id: `${projectionScopeVersion?.scopeVersionId ?? "scope"}-lateral`,
          label: "Service Path",
          coordinates: proposedBuildPath.geometry,
        },
      ]
    : [];
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
          <span>Inventory: {expectedInventoryId ?? selectedGraph?.inventoryId ?? "none"}</span>
          <span>Scope: {projectionScopeVersion?.scopeVersionId ?? twinState?.scopeVersionId ?? "none"}</span>
          <span>Open work: {fmt(projectionMetrics.openWorkItems)}</span>
          <span>Completed work: {fmt(projectionMetrics.completedWorkItems)}</span>
          <span>Closures: {fmt(projectionMetrics.closureCount)}</span>
          <span>Completed feet: {fmt(projectionMetrics.completedFeet)}</span>
          <span>Total feet: {fmt(projectionMetrics.totalFeet)}</span>
          <span>Completion %: {fmt(Math.round(projectionMetrics.percentComplete ?? 0))}%</span>
          <span>Completion Authority: {projectionMetrics.completionAuthority ?? "n/a"}</span>
          <span>Lifecycle State: {authoritativeLifecycleState}</span>
          <span>Verified Stations: {fmt(twinProjection.verifiedStationCount)}</span>
          <span>Closure Timeline: {fmt(projectionTimeline.length)}</span>
        </div>
      </div>

      <ScopeVersionLifecycleRibbon scopeVersion={projectionScopeVersion} />

      <div className="dal-panel">
        <h3>Commercial Runtime Objects</h3>
        <div className="dal-metrics">
          <span>Objects surfaced: {fmt(commercialRuntimeObjects.length)}</span>
          <span>Source: Runtime Object Library</span>
          <span>Duplicate storage: none</span>
        </div>
        {commercialRuntimeObjects.length ? (
          <div className="dal-list">
            {commercialRuntimeObjects.slice(0, 8).map((object) => (
              <div key={String(object.runtimeId ?? object.objectId)} className="dal-list-row">
                <span>{String(object.name ?? object.objectId)}</span>
                <b>{String(object.objectType ?? "Runtime")}</b>
                <small>{String(object.accountId ?? object.metadata?.accountId ?? object.customerId ?? "account pending")}</small>
              </div>
            ))}
          </div>
        ) : (
          <div className="dal-status">No commercial runtime objects have been created yet.</div>
        )}
      </div>

      <div className="dal-grid">
        <div className="dal-panel">
          <h3>Twin Source Diagnostics</h3>
          <div className="dal-metrics">
            <span>Selected ScopeVersion: {projectionScopeVersion?.scopeVersionId ?? "none"}</span>
            <span>Projection source: {projectionSource}</span>
            <span>Server work items loaded: {fmt(twinState?.totals?.workItemsLoaded ?? workItems.length)}</span>
            <span>Work items for scope: {fmt(selectedScopeWorkItems.length)}</span>
            <span>Active work items for scope: {fmt(activeSelectedScopeWorkItems.length)}</span>
            <span>Server closures loaded: {fmt(twinState?.totals?.closuresLoaded ?? closures.length)}</span>
            <span>Closures for scope: {fmt(completedClosures.length)}</span>
            <span>Timeline events for scope: {fmt(projectionTimeline.length)}</span>
            <span>Graph context matched: {graphContextMatched ? "true" : "false"}</span>
          </div>
        </div>
        <div className="dal-panel">
          <h3>Lifecycle Audit</h3>
          <div className="dal-metrics">
            <span>Total Violations: {fmt(lifecycleViolations.length)}</span>
            <span>Blocking: {fmt(lifecycleViolations.filter((violation) => violation.severity === "BLOCKING").length)}</span>
            <span>Warnings: {fmt(lifecycleViolations.filter((violation) => violation.severity === "WARNING").length)}</span>
            <span>Info: {fmt(lifecycleViolations.filter((violation) => violation.severity === "INFO").length)}</span>
          </div>
          {lifecycleViolations.length ? (
            <div className="dal-list">
              {lifecycleViolations.slice(0, 8).map((violation) => (
                <div key={violation.violationId} className="dal-list-row">
                  <span>{violation.code}</span>
                  <b>{violation.severity}</b>
                  <small>{violation.message}</small>
                </div>
              ))}
            </div>
          ) : (
            <div className="dal-status">No selected-scope lifecycle violations detected.</div>
          )}
        </div>
      </div>

      <div className="dal-grid">
        <div className="dal-panel">
          <h3>Current State</h3>
          {!graphContextMatched ? (
            <div className="dal-status">Graph context does not match selected ScopeVersion.</div>
          ) : (
            <div className="dal-metrics">
              <span>Inventory nodes: {fmt(selectedGraph?.nodes.length)}</span>
              <span>Inventory edges: {fmt(selectedGraph?.edges.length)}</span>
              <span>Inventory routes: {fmt(selectedGraph?.routes.length)}</span>
              <span>Inventory stations: {fmt(selectedGraph?.stations.length)}</span>
            </div>
          )}
        </div>

        <div className="dal-panel">
          <h3>Proposed State</h3>
          <div className="dal-metrics">
            <span>Scope: {projectionScopeVersion?.scopeVersionId ?? "none"}</span>
            <span>Proposed ScopeVersion State: {twinProjection.proposedScopeVersionState ?? "none"}</span>
            <span>Completed Stations: {fmt(twinProjection.completedStationCount)}</span>
            <span>Verified Stations: {fmt(twinProjection.verifiedStationCount)}</span>
            <span>Completed Feet: {fmt(Math.round(twinProjection.completedFeet))}</span>
            <span>Percent Complete: {fmt(Math.round(twinProjection.percentComplete))}%</span>
            <span>Blocked Stations: {fmt(twinProjection.blockedStations.length)}</span>
            <span>Rejected Stations: {fmt(twinProjection.rejectedStations.length)}</span>
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
            <span>Completed work: {fmt(projectionMetrics.completedWorkItems)}</span>
            <span>Closures: {fmt(projectionMetrics.closureCount)}</span>
            <span>Completed feet: {fmt(projectionMetrics.completedFeet)}</span>
          </div>
        </div>
      </div>

      <div className="dal-panel">
        <h3>Twin Execution Overlay</h3>
        <div className="dal-metrics">
          <span>Planned Assets: {fmt(projectionMetrics.plannedAssets)}</span>
          <span>Released Assets: {fmt(projectionMetrics.releasedAssets)}</span>
          <span>In Progress Assets: {fmt(projectionMetrics.inProgressAssets)}</span>
          <span>Completed Assets: {fmt(projectionMetrics.completedAssets)}</span>
          <span>Verified Assets: {fmt(projectionMetrics.verifiedAssets)}</span>
          <span>Blocked Assets: {fmt(projectionMetrics.blockedAssets)}</span>
          <span>Rejected Assets: {fmt(projectionMetrics.rejectedAssets)}</span>
          <span>Percent Complete: {fmt(Math.round(projectionMetrics.percentComplete ?? 0))}%</span>
          <span>Completed Feet / Total Feet: {fmt(Math.round(projectionMetrics.completedFeet ?? 0))} / {fmt(Math.round(projectionMetrics.totalFeet ?? 0))}</span>
          <span>Completion Authority: {projectionMetrics.completionAuthority ?? "n/a"}</span>
          <span>Planned Objects: {fmt(twinObjectStateCounts.PLANNED)}</span>
          <span>Released Objects: {fmt(projectionMetrics.releasedObjects)}</span>
          <span>Installed Objects: {fmt(projectionMetrics.installedObjects)}</span>
          <span>Tested Objects: {fmt(projectionMetrics.testedObjects)}</span>
          <span>Accepted Objects: {fmt(projectionMetrics.acceptedObjects)}</span>
          <span>Completed Objects: {fmt(projectionMetrics.completedObjects)}</span>
          <span>Verified Objects: {fmt(projectionMetrics.verifiedObjects)}</span>
          <span>Blocked Objects: {fmt(projectionMetrics.blockedObjects)}</span>
          <span>Rejected Objects: {fmt(projectionMetrics.rejectedObjects)}</span>
          <span>Object Completion: {fmt(Math.round(projectionMetrics.objectCompletionPercent ?? 0))}%</span>
          <span>Station Progress: {fmt(Math.round(projectionMetrics.stationDerivedCompletionPercent ?? 0))}%</span>
          <span>Work Progress: {fmt(Math.round(projectionMetrics.workCompletionPercent ?? 0))}%</span>
          <span>Completion Warnings: {fmt(Array.isArray((completionProjection as any)?.warnings) ? (completionProjection as any).warnings.length : 0)}</span>
        </div>
      </div>

      <div className="dal-panel">
        <h3>Planned Network State</h3>
        {projectionScopeVersion ? (
          <>
            <LeafletMap
              autoFocusKey={`${projectionScopeVersion.scopeVersionId}-planned`}
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
            {!graphContextMatched ? <div className="dal-status">Graph context does not match selected ScopeVersion.</div> : null}
            <div className="dal-metrics">
              <span>Candidate: {scopeSite?.name ?? scopeSite?.companyName ?? "n/a"}</span>
              <span>Route Authority: {routeAuthorityState}</span>
              <span>Twin Planned State: {plannedStateAuthority}</span>
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
        <div className="dal-panel">
          <h3>Open Work</h3>
          {selectedScopeWorkItems.filter((item) => !["COMPLETE", "CANCELLED"].includes(item.status)).length ? (
            <div className="dal-list">
              {selectedScopeWorkItems
                .filter((item) => !["COMPLETE", "CANCELLED"].includes(item.status))
                .map((item) => (
                <div key={item.workItemId} className="dal-list-row">
                  <span>{item.title}</span>
                  <b>{item.status}</b>
                  <small>{item.workItemId}</small>
                </div>
                ))}
            </div>
          ) : (
            <div className="dal-status">No Control work packages have been created for this ScopeVersion.</div>
          )}
        </div>

        <div className="dal-panel">
          <h3>Completed Closures</h3>
          <div className="dal-status">Source: {completedClosureSource}</div>
          <div className="dal-list">
            {completedClosures.map((closure) => (
              <div key={(closure as any).closureId} className="dal-list-row">
                <span>{(closure as any).closureType}</span>
                <b>{fmt((closure as FieldClosure).footage ?? (closure as ClosureRecord).feetAffected)} ft</b>
                <small>{(closure as FieldClosure).closedAt ?? (closure as ClosureRecord).createdAt}</small>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="dal-panel">
        <h3>State Timeline</h3>
        {projectionTimeline.length ? (
          <div className="dal-list">
            {projectionTimeline.map((event) => (
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
