import { useEffect, useMemo, useState } from "react";
import {
  listCandidateSites,
  listInventoryGraphs,
  listScopeVersions,
  loadInventoryGraph,
  saveCandidateSites,
  saveScopeVersion,
} from "../api/dalClient";
import { deriveRouteCertificationState } from "../certification/CertificationAuthority";
import CertificationAuthorityStrip from "../components/CertificationAuthorityStrip";
import RouteEngineeringPanel from "../components/RouteEngineeringPanel";
import SnapAuthorityPanel from "../components/SnapAuthorityPanel";
import { useDALState } from "../dal/DALState";
import { MapKernel, buildMapKernelDiagnostics, renderScopeVersion, type MapSelection } from "../mapkernel";
import { boundsForRouteGeometry, constraintFeaturesToReferenceLayers, getConstraintRegistryAnalysisContext } from "../reference/ConstraintGeometryRegistry";
import { renderReferenceLayers } from "../reference/ReferenceLayerManager";
import { generateAttachmentAwareRouteAlternatives, type AttachmentAwareRouteResult } from "../routing/AttachmentAwareRouteEngine";
import { analyzeRouteConstraints } from "../routing/ConstraintAnalysisEngine";
import {
  analyzeSiteAgainstInventory,
  createCandidateScopeVersionFromServiceability,
  inventoryScopeVersionFromGraph,
  renderServiceabilityAnalysis,
  updateServiceabilityLateralGeometry,
  type ServiceabilityAnalysisResult,
} from "../serviceability/serviceabilityEngine";
import { canCreateScopeVersionFromRoute, type RouteCertificationSnapshot, type RouteCertificationState } from "../serviceability/routeCertification";
import { canUseSnapForRoute } from "../street/SnapAuthorityEngine";
import type { SnapAuthorityResult, SnapCertificationSnapshot, SnapCertificationState } from "../street/streetTypes";
import type { CandidateSite } from "../types/candidateSite";
import type { DALCoordinate, InventoryGraph, InventoryGraphMetadata, ScopeVersion } from "../types/dal";

type AnalysisRecord = {
  rank: number;
  site: CandidateSite;
  result: ServiceabilityAnalysisResult;
  candidateScopeVersion?: ScopeVersion;
};

function fmt(n: number | undefined) {
  return Number(n || 0).toLocaleString();
}

function feet(n: number | undefined) {
  return `${fmt(Math.round(Number(n || 0)))} ft`;
}

function statusLabel(result: ServiceabilityAnalysisResult) {
  if (result.status === "FAILED_GEOCODE") return "FAILED_GEOCODE";
  if (result.status === "NON_SERVICEABLE") return "NON_SERVICEABLE";
  return result.certificationReadiness.canCreateCandidateScopeVersion ? "READY" : "REVIEW";
}

function resultDistance(result: ServiceabilityAnalysisResult) {
  return Number(result.lateralPath?.feet ?? result.nearestEdge?.distanceFeet ?? result.nearestStation?.distanceFeet ?? Number.MAX_SAFE_INTEGER);
}

function datasetIdFor(site: CandidateSite) {
  return site.sourceDatasetId ?? "texas-400-opportunity-dataset";
}

function graphScopeMatch(scopes: ScopeVersion[], graph: InventoryGraph | null) {
  if (!graph) return null;
  return (
    scopes.find((scope) => scope.scopeVersionId === graph.scopeVersionId || scope.scopeVersionId === graph.metadata.scopeVersionId) ??
    scopes.find((scope) => scope.inventoryId === graph.inventoryId && (scope.type === "INVENTORY" || scope.source === "InventoryGraph")) ??
    null
  );
}

function readableBoolean(value: boolean) {
  return value ? "YES" : "NO";
}

function siteIsCertified(site: CandidateSite) {
  return site.geocodeStatus === "CERTIFIED" || site.geocodeMethod === "HUMAN_APPROVED";
}

function parseGeometry(text: string): DALCoordinate[] {
  const value = JSON.parse(text) as unknown;
  if (!Array.isArray(value)) throw new Error("Route geometry must be a JSON coordinate array.");
  const coordinates = value.map((coordinate) => {
    if (!Array.isArray(coordinate) || coordinate.length < 2) throw new Error("Each vertex must be [lon, lat].");
    const lon = Number(coordinate[0]);
    const lat = Number(coordinate[1]);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) throw new Error("Each vertex must contain finite lon/lat values.");
    return [lon, lat] as DALCoordinate;
  });
  if (coordinates.length < 2) throw new Error("At least two route vertices are required.");
  return coordinates;
}

function routeText(geometry?: DALCoordinate[]) {
  return JSON.stringify(geometry ?? [], null, 2);
}

export default function NetworkAffinityWorkspace() {
  const {
    selectedCandidateSiteId,
    selectedGraph,
    selectedInventoryId,
    setSelectedCandidateSite,
    setSelectedCandidateSiteId,
    setSelectedGraph,
    setSelectedInventoryId,
    setSelectedScopeVersion,
    setSelectedScopeVersionId,
    setWorkspace,
  } = useDALState();
  const [graphs, setGraphs] = useState<InventoryGraphMetadata[]>([]);
  const [scopeVersions, setScopeVersions] = useState<ScopeVersion[]>([]);
  const [sites, setSites] = useState<CandidateSite[]>([]);
  const [inventoryId, setInventoryId] = useState(selectedInventoryId);
  const [datasetId, setDatasetId] = useState("");
  const [selectedSiteId, setSelectedSiteId] = useState(selectedCandidateSiteId);
  const [records, setRecords] = useState<AnalysisRecord[]>([]);
  const [activeScopePreview, setActiveScopePreview] = useState<ScopeVersion | null>(null);
  const [routeGeometry, setRouteGeometry] = useState<DALCoordinate[]>([]);
  const [selectedRouteVertexIndex, setSelectedRouteVertexIndex] = useState<number | null>(null);
  const [routeCertificationBySiteId, setRouteCertificationBySiteId] = useState<Record<string, RouteCertificationSnapshot>>({});
  const [routeCertificationStatus, setRouteCertificationStatus] = useState<RouteCertificationState>("DRAFT_ROUTE");
  const [routeEngineerName, setRouteEngineerName] = useState("");
  const [routeCertificationNotes, setRouteCertificationNotes] = useState("");
  const [selectedRouteAlternativeId, setSelectedRouteAlternativeId] = useState("");
  const [snapAuthority, setSnapAuthority] = useState<SnapAuthorityResult | null>(null);
  const [snapCertificationBySiteId, setSnapCertificationBySiteId] = useState<Record<string, SnapCertificationSnapshot>>({});
  const [snapCertificationState, setSnapCertificationState] = useState<SnapCertificationState>("DRAFT_SNAP");
  const [snapEngineerName, setSnapEngineerName] = useState("");
  const [snapCertificationNotes, setSnapCertificationNotes] = useState("");
  const [mapSelection, setMapSelection] = useState<MapSelection | null>(null);
  const [status, setStatus] = useState("FiberLight / Texas 400 serviceability workflow ready.");

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    try {
      const [nextGraphs, nextSites, nextScopes] = await Promise.all([listInventoryGraphs(), listCandidateSites(), listScopeVersions()]);
      setGraphs(nextGraphs);
      setSites(nextSites);
      setScopeVersions(nextScopes);
      const nextInventoryId = selectedInventoryId || selectedGraph?.inventoryId || nextGraphs[0]?.inventoryId || "";
      const nextDatasetId = datasetId || nextSites[0]?.sourceDatasetId || "";
      const nextSiteId = selectedCandidateSiteId || nextSites[0]?.candidateId || "";
      setInventoryId(nextInventoryId);
      setDatasetId(nextDatasetId);
      setSelectedSiteId(nextSiteId);
      const nextSite = nextSites.find((site) => site.candidateId === nextSiteId) ?? null;
      setSelectedCandidateSite(nextSite);
      setStatus("Inventory metadata, ScopeVersions, and opportunity dataset records loaded.");
    } catch (err) {
      setStatus(`Network Affinity load failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function ensureGraph() {
    if (selectedGraph && selectedGraph.inventoryId === inventoryId) return selectedGraph;
    if (!inventoryId) return null;
    const graph = await loadInventoryGraph(inventoryId);
    setSelectedInventoryId(graph.inventoryId);
    setSelectedGraph(graph);
    return graph;
  }

  function selectSite(siteId: string) {
    setSelectedSiteId(siteId);
    setSelectedCandidateSiteId(siteId);
    setSelectedCandidateSite(sites.find((site) => site.candidateId === siteId) ?? null);
  }

  const datasetOptions = useMemo(() => {
    return Array.from(new Set(sites.map(datasetIdFor))).sort();
  }, [sites]);

  const opportunitySites = useMemo(() => {
    return sites.filter((site) => !datasetId || datasetIdFor(site) === datasetId);
  }, [datasetId, sites]);

  const certifiedSites = useMemo(() => {
    return opportunitySites.filter(siteIsCertified);
  }, [opportunitySites]);

  const activeRecord = useMemo(() => {
    return records.find((record) => record.site.candidateId === selectedSiteId) ?? records[0] ?? null;
  }, [records, selectedSiteId]);

  useEffect(() => {
    const certification = activeRecord ? routeCertificationBySiteId[activeRecord.site.candidateId] : undefined;
    const snapCertification = activeRecord ? snapCertificationBySiteId[activeRecord.site.candidateId] : undefined;
    setRouteGeometry(certification?.routeGeometry ?? activeRecord?.result.lateralPath?.geometry ?? []);
    setSelectedRouteAlternativeId("");
    setSelectedRouteVertexIndex(null);
    setRouteCertificationStatus(certification?.status ?? "DRAFT_ROUTE");
    setSnapAuthority(snapCertification ?? activeRecord?.result.snapAuthority ?? null);
    setSnapCertificationState(snapCertification?.status ?? (activeRecord?.result.snapAuthority ? "DRAFT_SNAP" : "REJECTED_SNAP"));
    if (certification) {
      setRouteEngineerName(certification.engineerName);
      setRouteCertificationNotes(certification.certificationNotes);
    }
    if (snapCertification) {
      setSnapEngineerName(snapCertification.engineerName);
      setSnapCertificationNotes(snapCertification.certificationNotes);
    }
  }, [activeRecord?.site.candidateId, activeRecord?.result.lateralPath?.geometry, activeRecord?.result.snapAuthority, routeCertificationBySiteId, snapCertificationBySiteId]);

  const activeSite = useMemo(() => {
    return activeRecord?.site ?? sites.find((site) => site.candidateId === selectedSiteId) ?? opportunitySites[0] ?? null;
  }, [activeRecord?.site, opportunitySites, selectedSiteId, sites]);

  const hydratedInventoryScope = useMemo(() => {
    if (!selectedGraph) return null;
    return inventoryScopeVersionFromGraph(selectedGraph, graphScopeMatch(scopeVersions, selectedGraph));
  }, [scopeVersions, selectedGraph]);

  const activeRouteConstraintAnalysis = useMemo(() => {
    const result = activeRecord?.result;
    if (!result?.attachmentAuthority || !result.candidateCoordinate || routeGeometry.length < 2) return null;
    const routeCertification = routeCertificationBySiteId[result.siteId];
    const hasAcceptedRouteCertification = routeCertification?.status === "CERTIFIED_ROUTE" || routeCertification?.status === "PROVISIONALLY_CERTIFIED";
    const registryContext = getConstraintRegistryAnalysisContext({ bbox: boundsForRouteGeometry(routeGeometry) });
    return analyzeRouteConstraints({
      parentScopeVersionId: result.sourceScopeVersionId,
      candidateSiteId: result.siteId,
      attachmentAuthority: result.attachmentAuthority,
      candidateCoordinate: { lon: result.candidateCoordinate[0], lat: result.candidateCoordinate[1] },
      proposedGeometry: routeGeometry,
      referenceLayers: { streets: result.streetCenterlines ?? [], ...registryContext },
      routeGeometrySource: hasAcceptedRouteCertification ? "CERTIFIED_ROUTE" : "ENGINEER_EDITED",
      analysisMode: hasAcceptedRouteCertification ? "CERTIFIED_SNAPSHOT" : "ENGINEER_EDITED",
      supersedesEvidenceId: routeCertification?.constraintEvidenceId,
    });
  }, [activeRecord?.result, routeCertificationBySiteId, routeGeometry]);

  const activeRouteCertification = activeRecord ? routeCertificationBySiteId[activeRecord.site.candidateId] : undefined;
  const activeRouteAuthority = useMemo(() => {
    const evidence = activeRouteCertification?.constraintEvidencePackage ?? activeRouteConstraintAnalysis;
    const routeGeometryHash = activeRouteCertification?.certifiedGeometryHash ?? evidence?.routeGeometryHash ?? "";
    return (
      activeRouteCertification?.certificationAuthority ??
      deriveRouteCertificationState({
        routeGeometryHash,
        constraintEvidencePackage: evidence,
        engineerApproval: activeRouteCertification
          ? {
              approved: activeRouteCertification.status === "CERTIFIED_ROUTE" || activeRouteCertification.status === "PROVISIONALLY_CERTIFIED",
              rejected: activeRouteCertification.status === "REJECTED_ROUTE",
              notes: activeRouteCertification.certificationNotes,
              certifiedBy: activeRouteCertification.engineerName,
              certifiedAt: activeRouteCertification.certifiedAt,
            }
          : {
              approved: false,
              notes: routeCertificationNotes,
              certifiedBy: routeEngineerName,
            },
        snapCertificationState,
      })
    );
  }, [activeRouteCertification, activeRouteConstraintAnalysis, routeCertificationNotes, routeEngineerName, snapCertificationState]);

  const routeAlternatives = useMemo<AttachmentAwareRouteResult[]>(() => {
    const result = activeRecord?.result;
    if (!result?.attachmentAuthority || !result.candidateCoordinate || !result.attachmentPoint) return [];
    const registryContext = getConstraintRegistryAnalysisContext();
    return generateAttachmentAwareRouteAlternatives({
      parentScopeVersionId: result.sourceScopeVersionId,
      candidateSiteId: result.siteId,
      attachmentAuthority: result.attachmentAuthority,
      attachmentCoordinate: { lon: result.attachmentPoint.lon, lat: result.attachmentPoint.lat },
      candidateCoordinate: { lon: result.candidateCoordinate[0], lat: result.candidateCoordinate[1] },
      referenceLayers: { streets: result.streetCenterlines ?? [], ...registryContext },
      routingPreference: "LOWEST_CONFLICT",
    });
  }, [activeRecord?.result]);

  const activeMapSpecs = useMemo(() => {
    if (!hydratedInventoryScope || !activeRecord) return [];
    const registrySpecs = renderReferenceLayers(
      constraintFeaturesToReferenceLayers(getConstraintRegistryAnalysisContext({ bbox: boundsForRouteGeometry(routeGeometry) }).constraintRegistryFeatures)
    );
    const specs = [renderServiceabilityAnalysis(activeRecord.result, hydratedInventoryScope), ...registrySpecs];
    const scope = activeRecord.candidateScopeVersion ?? activeScopePreview;
    if (scope) specs.push(renderScopeVersion(scope));
    return specs;
  }, [activeRecord, activeScopePreview, hydratedInventoryScope, routeGeometry]);

  const activeDiagnostics = useMemo(() => {
    const scope = activeRecord?.candidateScopeVersion ?? activeScopePreview;
    return buildMapKernelDiagnostics(scope ?? null, activeMapSpecs);
  }, [activeMapSpecs, activeRecord?.candidateScopeVersion, activeScopePreview]);

  async function runAnalysis() {
    const graph = await ensureGraph();
    if (!graph) {
      setStatus("Select a FiberLight inventory graph before running analysis.");
      return;
    }
    const parentScope = inventoryScopeVersionFromGraph(graph, graphScopeMatch(scopeVersions, graph));
    const sourceSites = certifiedSites;
    const missingGeocode = opportunitySites.length - sourceSites.length;
    if (!sourceSites.length) {
      setStatus("No certified sites are available. Ungeocoded or ambiguous sites cannot participate in serviceability analysis.");
      return;
    }
    setStatus(`Analyzing ${sourceSites.length.toLocaleString()} certified sites against ${parentScope.scopeVersionId}...`);
    const analyzed = sourceSites
      .map((site) => ({
        site,
        result: analyzeSiteAgainstInventory(site, parentScope),
      }))
      .sort((a, b) => {
        const readyDelta = Number(b.result.certificationReadiness.canCreateCandidateScopeVersion) - Number(a.result.certificationReadiness.canCreateCandidateScopeVersion);
        return readyDelta || resultDistance(a.result) - resultDistance(b.result);
      })
      .map((item, index) => ({ ...item, rank: index + 1 }));
    setRecords(analyzed);
    if (analyzed[0]) selectSite(analyzed[0].site.candidateId);
    const updatedSites = sites.map((site) => {
      const record = analyzed.find((item) => item.site.candidateId === site.candidateId);
      if (!record) return site;
      return {
        ...site,
        status: record.result.certificationReadiness.canCreateCandidateScopeVersion ? "ANALYZED" : "NON_SERVICEABLE",
      } satisfies CandidateSite;
    });
    await saveCandidateSites(updatedSites);
    setSites(updatedSites);
    setStatus(
      `Analysis complete: ${analyzed.length.toLocaleString()} sites analyzed, ${analyzed.filter((item) => item.result.certificationReadiness.canCreateCandidateScopeVersion).length.toLocaleString()} ready, ${missingGeocode.toLocaleString()} uncertified excluded.`
    );
  }

  function updateActiveRouteGeometry(geometry: DALCoordinate[]) {
    if (!activeRecord) return;
    try {
      if (geometry.length < 2) throw new Error("At least two route vertices are required.");
      const result = updateServiceabilityLateralGeometry(activeRecord.result, geometry);
      setRecords((prev) => prev.map((record) => (record.site.candidateId === activeRecord.site.candidateId ? { ...record, result } : record)));
      setRouteGeometry(geometry);
      setRouteCertificationStatus("ENGINEER_REVIEW_REQUIRED");
      setSelectedRouteAlternativeId("");
      setActiveScopePreview(null);
      setRouteCertificationBySiteId((prev) => {
        const next = { ...prev };
        delete next[activeRecord.site.candidateId];
        return next;
      });
      setStatus("Route geometry updated. Length, economics, and constructability evidence recalculated. Human certification is still required before commit.");
    } catch (err) {
      setStatus(`Route edit failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  function promoteRouteAlternative(route: AttachmentAwareRouteResult) {
    updateActiveRouteGeometry(route.geometry);
    setSelectedRouteAlternativeId(route.routeId);
    setStatus(`${route.routingPreference.replaceAll("_", " ")} route promoted. Mode ${route.routingMode}; engineer certification is still required.`);
  }

  function updateActiveSnapAuthority(nextSnapAuthority: SnapAuthorityResult) {
    if (!activeRecord) return;
    setSnapAuthority(nextSnapAuthority);
    setSnapCertificationState("REVIEW_SNAP");
    setRouteCertificationBySiteId((prev) => {
      const next = { ...prev };
      delete next[activeRecord.site.candidateId];
      return next;
    });
    setRouteCertificationStatus("DRAFT_ROUTE");
    setActiveScopePreview(null);
    setRecords((prev) =>
      prev.map((record) =>
        record.site.candidateId === activeRecord.site.candidateId
          ? {
              ...record,
              result: {
                ...record.result,
                snapAuthority: nextSnapAuthority,
                streetSnap: record.result.streetSnap
                  ? {
                      ...record.result.streetSnap,
                      snapPoint: { lon: nextSnapAuthority.snappedCoordinate[0], lat: nextSnapAuthority.snappedCoordinate[1] },
                      snapDistanceFeet: nextSnapAuthority.distanceToStreetFeet ?? record.result.streetSnap.snapDistanceFeet,
                      confidence: nextSnapAuthority.snapConfidence,
                      roadName: nextSnapAuthority.streetName ?? record.result.streetSnap.roadName,
                      roadClass: nextSnapAuthority.streetClass ?? record.result.streetSnap.roadClass,
                    }
                  : record.result.streetSnap,
              },
            }
          : record
      )
    );
    setStatus("Snap authority updated. Re-certify street snap before route certification or child ScopeVersion creation.");
  }

  function certifySnap(snapshot: SnapCertificationSnapshot) {
    if (!activeRecord) return;
    setSnapCertificationBySiteId((prev) => ({ ...prev, [activeRecord.site.candidateId]: snapshot }));
    setSnapAuthority(snapshot);
    setSnapCertificationState("CERTIFIED_SNAP");
    setStatus("Street snap certified. Route engineering certification is now allowed for this candidate.");
  }

  function rejectSnap(snapshot: SnapCertificationSnapshot) {
    if (!activeRecord) return;
    setSnapCertificationBySiteId((prev) => ({ ...prev, [activeRecord.site.candidateId]: snapshot }));
    setSnapAuthority(snapshot);
    setSnapCertificationState("REJECTED_SNAP");
    setRouteCertificationBySiteId((prev) => {
      const next = { ...prev };
      delete next[activeRecord.site.candidateId];
      return next;
    });
    setRouteCertificationStatus("REJECTED_ROUTE");
    setActiveScopePreview(null);
    setStatus("Street snap rejected. Route certification and child ScopeVersion creation are blocked.");
  }

  function selectAlternateAttachment() {
    if (!activeRecord?.result.lateralPath || !activeRecord.result.attachmentPoint || !activeRecord.result.streetSnap) return;
    const geometry = activeRecord.result.lateralPath.geometry;
    const attachment = geometry[geometry.length - 1];
    const offsetAttachment: DALCoordinate = [attachment[0] + 0.00025, attachment[1] + 0.00025];
    const next = [geometry[0], ...(geometry.length > 2 ? geometry.slice(1, -1) : []), offsetAttachment];
    updateActiveRouteGeometry(next);
    setStatus("Alternate attachment trial inserted and recalculated. Human certification is still required.");
  }

  function certifyRoute(certification: RouteCertificationSnapshot) {
    if (!activeRecord) return;
    const snapCertification = snapCertificationBySiteId[activeRecord.site.candidateId];
    if (!canUseSnapForRoute(snapCertification)) {
      setStatus("Street snap certification is required before route certification.");
      return;
    }
    const authority =
      certification.certificationAuthority ??
      deriveRouteCertificationState({
        routeGeometryHash: certification.certifiedGeometryHash,
        constraintEvidencePackage: certification.constraintEvidencePackage ?? activeRouteConstraintAnalysis,
        engineerApproval: {
          approved: certification.status === "CERTIFIED_ROUTE" || certification.status === "PROVISIONALLY_CERTIFIED",
          rejected: certification.status === "REJECTED_ROUTE",
          notes: certification.certificationNotes,
          certifiedBy: certification.engineerName,
          certifiedAt: certification.certifiedAt,
        },
        snapCertificationState: snapCertification.status,
      });
    if (authority.state !== "CERTIFIED_ROUTE" && authority.state !== "PROVISIONALLY_CERTIFIED") {
      setStatus(`Route certification blocked by Certification Authority: ${authority.state}. ${authority.requiredActions.join(" ") || authority.reasons.join(" ")}`);
      return;
    }
    try {
      const geometry = certification.certifiedGeometrySnapshot;
      const result = updateServiceabilityLateralGeometry(activeRecord.result, geometry);
      setRecords((prev) => prev.map((record) => (record.site.candidateId === activeRecord.site.candidateId ? { ...record, result } : record)));
      setRouteCertificationBySiteId((prev) => ({ ...prev, [activeRecord.site.candidateId]: certification }));
      setRouteGeometry(geometry);
      setRouteCertificationStatus(authority.state);
      setStatus(
        authority.state === "PROVISIONALLY_CERTIFIED"
          ? "Route provisionally certified. Engineer notes are preserved for child ScopeVersion review."
          : "Route certified by engineering review. Child ScopeVersion creation and package progression are now enabled for this selected site."
      );
    } catch (err) {
      setStatus(`Route certification failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  function rejectRoute(certification: RouteCertificationSnapshot) {
    if (!activeRecord) return;
    setRouteCertificationBySiteId((prev) => ({ ...prev, [activeRecord.site.candidateId]: certification }));
    setRouteCertificationStatus("REJECTED_ROUTE");
    setActiveScopePreview(null);
    setStatus("Route rejected. No child ScopeVersion can be created until engineering certifies a route.");
  }

  async function generateChildScopeVersion(record = activeRecord) {
    if (!record || !hydratedInventoryScope) {
      setStatus("Run analysis and select a ready opportunity before generating a child ScopeVersion.");
      return;
    }
    if (!record.result.certificationReadiness.canCreateCandidateScopeVersion) {
      setStatus("Selected opportunity is not ready for child ScopeVersion creation. Inspect certification readiness.");
      return;
    }
    const routeCertification = routeCertificationBySiteId[record.site.candidateId];
    const snapCertification = snapCertificationBySiteId[record.site.candidateId];
    if (!canUseSnapForRoute(snapCertification)) {
      setStatus("Certified street snap evidence is required before child ScopeVersion creation.");
      return;
    }
    if (!canCreateScopeVersionFromRoute(routeCertification)) {
      setStatus(`Child ScopeVersion blocked by Certification Authority: ${routeCertification?.certificationAuthority?.state ?? "ENGINEER_REVIEW_REQUIRED"}.`);
      return;
    }
    const scope = createCandidateScopeVersionFromServiceability({
      site: record.site,
      inventoryScopeVersion: hydratedInventoryScope,
      result: record.result,
      snapCertification,
      routeCertification,
    });
    const saved = await saveScopeVersion(scope);
    setRecords((prev) => prev.map((item) => (item.site.candidateId === record.site.candidateId ? { ...item, candidateScopeVersion: saved } : item)));
    setActiveScopePreview(saved);
    setSelectedScopeVersion(saved);
    setSelectedScopeVersionId(saved.scopeVersionId);
    setStatus(`Created child candidate ScopeVersion ${saved.scopeVersionId}. Parent ${saved.parentScopeVersionId} remains unchanged.`);
  }

  function previewChildScopeVersion(record = activeRecord) {
    if (!record || !hydratedInventoryScope || !record.result.certificationReadiness.canCreateCandidateScopeVersion) {
      setActiveScopePreview(null);
      return;
    }
    const routeCertification = routeCertificationBySiteId[record.site.candidateId];
    const snapCertification = snapCertificationBySiteId[record.site.candidateId];
    if (!canUseSnapForRoute(snapCertification)) {
      setActiveScopePreview(null);
      setStatus("Certify the street snap before previewing a child ScopeVersion.");
      return;
    }
    if (!canCreateScopeVersionFromRoute(routeCertification)) {
      setActiveScopePreview(null);
      setStatus(`Preview blocked by Certification Authority: ${routeCertification?.certificationAuthority?.state ?? "ENGINEER_REVIEW_REQUIRED"}.`);
      return;
    }
    setActiveScopePreview(
      createCandidateScopeVersionFromServiceability({
        site: record.site,
        inventoryScopeVersion: hydratedInventoryScope,
        result: record.result,
        snapCertification,
        routeCertification,
      })
    );
  }

  const inventoryScopeStatus = hydratedInventoryScope
    ? `${hydratedInventoryScope.scopeVersionId} / ${hydratedInventoryScope.certificationState}`
    : "No inventory ScopeVersion loaded";
  const activeResult = activeRecord?.result;

  return (
    <section className="dal-workspace wide">
      <div className="dal-workspace-header">
        <div>
          <h2>DAL Network Affinity</h2>
          <p>FiberLight / Texas 400 analysis consolidated around Inventory ScopeVersion truth, canonical serviceability, and MapKernel visualization.</p>
        </div>
        <button type="button" onClick={() => void refresh()}>
          Refresh
        </button>
      </div>

      <div className="dal-grid">
        <div className="dal-panel">
          <h3>Workflow Controls</h3>
          <div className="dal-grid compact">
            <select
              value={inventoryId}
              onChange={(event) => {
                setInventoryId(event.target.value);
                setSelectedInventoryId(event.target.value);
              }}
            >
              <option value="">Select inventory</option>
              {graphs.map((graph) => (
                <option key={graph.inventoryId} value={graph.inventoryId}>
                  {graph.name} ({fmt(graph.routeCount)} routes)
                </option>
              ))}
            </select>
            <select value={datasetId} onChange={(event) => setDatasetId(event.target.value)}>
              <option value="">All opportunity datasets</option>
              {datasetOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <select value={selectedSiteId} onChange={(event) => selectSite(event.target.value)}>
              <option value="">Select analyzed site</option>
              {(records.length ? records.map((record) => record.site) : opportunitySites).map((site) => (
                <option key={site.candidateId} value={site.candidateId}>
                  {site.companyName}
                </option>
              ))}
            </select>
          </div>
          <div className="dal-actions">
            <button type="button" onClick={() => void runAnalysis()}>
              Run Analysis
            </button>
            <button type="button" onClick={() => previewChildScopeVersion()}>
              Preview Child ScopeVersion
            </button>
            <button type="button" onClick={() => void generateChildScopeVersion()}>
              Generate Child ScopeVersion
            </button>
            <button type="button" onClick={() => setWorkspace("siteDecision")}>
              Site Decision
            </button>
          </div>
          <div className="dal-status">{status}</div>
        </div>

        <div className="dal-panel">
          <h3>Truth and Dataset Status</h3>
          <div className="dal-metrics">
            <span>Inventory ScopeVersion: {inventoryScopeStatus}</span>
            <span>Inventory ID: {(selectedGraph?.inventoryId ?? inventoryId) || "n/a"}</span>
            <span>Opportunity Dataset: {datasetId || "All datasets"}</span>
            <span>Sites Loaded: {fmt(opportunitySites.length)}</span>
            <span>Certified Sites: {fmt(certifiedSites.length)}</span>
            <span>Excluded Uncertified: {fmt(opportunitySites.length - certifiedSites.length)}</span>
            <span>Analysis Records: {fmt(records.length)}</span>
            <span>Server Truth: {hydratedInventoryScope ? "ScopeVersion selected / graph hydrated" : "not loaded"}</span>
          </div>
        </div>
      </div>

      <div className="dal-grid">
        <div className="dal-panel">
          <h3>MapKernel Serviceability View</h3>
          {activeMapSpecs.length ? (
            <MapKernel
              specs={activeMapSpecs}
              layerVisibility={{
                inventory: true,
                streetReference: true,
                buildingReference: true,
                parcelReference: true,
                railroadReference: true,
                waterReference: true,
                terrainReference: false,
                site: true,
                attachment: true,
                lateral: true,
                station: true,
                node: true,
                edge: true,
                scopeVersion: true,
              }}
              showStationLabels
              stationDensityFeet={300}
              height={560}
              initialMode="geographic"
              initialBaseLayer="hybrid"
              editableRoute={{
                routeId: activeRecord ? `${activeRecord.site.candidateId}:engineering-route` : "engineering-route",
                geometry: routeGeometry,
                enabled: Boolean(activeRecord),
                selectedVertexIndex: selectedRouteVertexIndex,
                onGeometryChange: updateActiveRouteGeometry,
                onVertexSelect: setSelectedRouteVertexIndex,
              }}
              onSelectionChange={setMapSelection}
            />
          ) : (
            <div className="dal-status">Run analysis and select an opportunity to render site, attachment, nearest station/node/edge, and lateral path through MapKernel.</div>
          )}
          <div className="dal-status">
            MapKernel selection: {mapSelection ? `${mapSelection.kind} ${mapSelection.featureRef.id}` : "none"}. Legacy GraphMap is not used in this workflow.
          </div>
        </div>

        <div className="dal-panel">
          <h3>Selected Opportunity Diagnostics</h3>
          {activeRecord && activeResult ? (
            <div className="dal-metrics">
              <span>Parent ScopeVersionId: {activeResult.sourceScopeVersionId}</span>
              <span>Candidate ScopeVersionId: {activeRecord.candidateScopeVersion?.scopeVersionId ?? activeScopePreview?.scopeVersionId ?? "preview not generated"}</span>
              <span>Relationship Type: LATERAL_EXTENSION</span>
              <span>Site: {activeRecord.site.companyName}</span>
              <span>Nearest Station: {activeResult.nearestStation?.stationId ?? "n/a"}</span>
              <span>Nearest Node: {activeResult.nearestNode?.nodeId ?? "n/a"}</span>
              <span>Nearest Edge: {activeResult.nearestEdge?.edgeId ?? "n/a"}</span>
              <span>Direct Feet: {feet(activeResult.lateralPath?.directFeet)}</span>
              <span>Street Feet: {feet(activeResult.lateralPath?.roadFeet)}</span>
              <span>Construction Feet: {feet(activeResult.lateralPath?.constructionFeet)}</span>
              <span>Street Snap: {activeResult.streetSnap ? `${feet(activeResult.streetSnap.snapDistanceFeet)} / ${Math.round(activeResult.streetSnap.confidence * 100)}%` : "n/a"}</span>
              <span>Snap Method: {activeResult.snapAuthority?.snapMethod ?? activeResult.streetSnap?.snapMethod ?? "n/a"}</span>
              <span>Snap Reference: {activeResult.snapAuthority?.snapAuthority ?? "n/a"}</span>
              <span>Attachment Authority: {activeResult.attachmentAuthority?.attachmentAuthority ?? "n/a"}</span>
              <span>Authority Method: {activeResult.attachmentAuthority?.attachmentMethod ?? "n/a"}</span>
              <span>Authority Confidence: {activeResult.attachmentAuthority ? `${Math.round(activeResult.attachmentAuthority.attachmentConfidence * 100)}%` : "n/a"}</span>
              <span>Reference Layers Excluded: {activeResult.attachmentAuthority?.excludesReferenceLayers ? "YES" : "n/a"}</span>
              <span>Snapped Street: {activeResult.snapAuthority?.streetName ?? "n/a"}</span>
              <span>Snapped Street Class: {activeResult.snapAuthority?.streetClass ?? "n/a"}</span>
              <span>Distance To Street: {activeResult.snapAuthority?.distanceToStreetFeet === undefined ? "n/a" : feet(activeResult.snapAuthority.distanceToStreetFeet)}</span>
              <span>Distance To Attachment: {activeResult.snapAuthority ? feet(activeResult.snapAuthority.distanceToAttachmentFeet) : "n/a"}</span>
              <span>Street Centerlines: {fmt(activeResult.streetCenterlines?.length)}</span>
              <span>Routing Mode: {activeResult.lateralPath?.routingMode ?? "n/a"}</span>
              <span>Path Confidence: {activeResult.lateralPath?.pathConfidence ?? "n/a"}</span>
              <span>Road Segment Count: {fmt(activeResult.lateralPath?.roadSegmentCount)}</span>
              <span>Road Names: {activeResult.lateralPath?.roadNamesTraversed.join(", ") ?? "n/a"}</span>
              <span>Road Classes: {activeResult.lateralPath?.roadClassesTraversed.join(", ") ?? "n/a"}</span>
              <span>Attachment Method: {activeResult.lateralPath?.attachmentMethod ?? "n/a"}</span>
              <span>Missing Dependencies: {activeResult.lateralPath?.missingDependencies.join(", ") ?? "n/a"}</span>
              <span>Attachment Confidence: {activeResult.attachmentPoint ? `${Math.round(activeResult.attachmentPoint.confidenceScore * 100)}%` : "n/a"}</span>
              <span>Diversity: {activeResult.diverseLateralPath ? `${activeResult.diverseLateralPath.separationScore ?? 0}` : "DIVERSITY_NOT_AVAILABLE"}</span>
              <span>Construction Type: {activeResult.lateralPath?.constructionType ?? "BURIED"}</span>
              <span>Certified Geocode: {readableBoolean(activeResult.certificationReadiness.hasCertifiedGeocode)}</span>
              <span>Has Street Snap: {readableBoolean(activeResult.certificationReadiness.hasStreetSnap)}</span>
              <span>Street Snap Certified: {activeRecord ? readableBoolean(canUseSnapForRoute(snapCertificationBySiteId[activeRecord.site.candidateId])) : "NO"}</span>
              <span>Route Certification Authority: {activeRouteAuthority.state}</span>
              <span>Evidence Grade: {activeRouteAuthority.evidenceGrade}</span>
              <span>Has Attachment: {readableBoolean(activeResult.certificationReadiness.hasAttachment)}</span>
              <span>Has Lateral: {readableBoolean(activeResult.certificationReadiness.hasLateral)}</span>
              <span>Has Station Reference: {readableBoolean(activeResult.certificationReadiness.hasStationReference)}</span>
              <span>Has Parent ScopeVersion: {readableBoolean(activeResult.certificationReadiness.hasParentScopeVersion)}</span>
              <span>Can Create ScopeVersion: {readableBoolean(activeResult.certificationReadiness.canCreateCandidateScopeVersion)}</span>
            </div>
          ) : (
            <div className="dal-status">Select an analyzed opportunity to inspect serviceability evidence.</div>
          )}
        </div>
      </div>

      <div className="dal-grid">
        <SnapAuthorityPanel
          snapAuthority={snapAuthority}
          certification={activeRecord ? snapCertificationBySiteId[activeRecord.site.candidateId] : undefined}
          certificationState={snapCertificationState}
          engineerName={snapEngineerName}
          certificationNotes={snapCertificationNotes}
          onSnapAuthorityChange={updateActiveSnapAuthority}
          onStateChange={setSnapCertificationState}
          onEngineerNameChange={setSnapEngineerName}
          onCertificationNotesChange={setSnapCertificationNotes}
          onCertify={certifySnap}
          onReject={rejectSnap}
        />

        <RouteEngineeringPanel
          title="Route Engineering"
          candidateLabel={activeRecord?.site.companyName}
          routeLabel={activeResult?.nearestRoute?.routeName ?? activeResult?.nearestRoute?.routeId}
          stationLabel={activeResult?.nearestStation?.stationId}
          nodeLabel={activeResult?.nearestNode?.nodeId}
          attachmentLabel={activeResult?.attachmentPoint?.attachmentId}
          geometry={routeGeometry}
          originalGeometry={activeResult?.lateralPath?.geometry}
          selectedVertexIndex={selectedRouteVertexIndex}
          certificationState={routeCertificationStatus}
          certification={activeRecord ? routeCertificationBySiteId[activeRecord.site.candidateId] : undefined}
          engineerName={routeEngineerName}
          certificationNotes={routeCertificationNotes}
          metricHints={{
            roadCrossings: activeResult?.lateralPath?.roadSegmentCount,
            constructabilityScore: activeResult?.attachmentPoint ? Math.round(activeResult.attachmentPoint.confidenceScore * 100) : undefined,
          }}
          routingMode={selectedRouteAlternativeId ? routeAlternatives.find((route) => route.routeId === selectedRouteAlternativeId)?.routingMode : "ENGINEER_EDITED"}
          constraintAnalysis={activeRouteConstraintAnalysis}
          routeAlternatives={routeAlternatives}
          selectedRouteAlternativeId={selectedRouteAlternativeId}
          onPromoteRouteAlternative={promoteRouteAlternative}
          onGeometryChange={updateActiveRouteGeometry}
          onVertexSelect={setSelectedRouteVertexIndex}
          onStateChange={setRouteCertificationStatus}
          onEngineerNameChange={setRouteEngineerName}
          onCertificationNotesChange={setRouteCertificationNotes}
          onCertify={certifyRoute}
          onReject={rejectRoute}
        />

        <CertificationAuthorityStrip title="Network Affinity Certification Authority" decision={activeRouteAuthority} />

        <div className="dal-panel">
          <h3>Economics</h3>
          {activeResult?.economics ? (
            <div className="dal-metrics">
              <span>Build Feet: {feet(activeResult.economics.buildFeet)}</span>
              <span>Construction Cost: {Number(activeResult.economics.constructionCost).toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 })}</span>
              <span>NRC: {Number(activeResult.economics.NRC).toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 })}</span>
              <span>MRC: {Number(activeResult.economics.MRC).toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 })}</span>
              <span>TCV: {Number(activeResult.economics.TCV).toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 })}</span>
              <span>Margin: {activeResult.economics.margin}%</span>
              <span>Payback: {activeResult.economics.payback} months</span>
              <span>ROI: {activeResult.economics.ROI}%</span>
            </div>
          ) : (
            <div className="dal-status">Run analysis to calculate street-constrained lateral economics.</div>
          )}
        </div>
      </div>

      <div className="dal-panel">
        <h3>Ranked Opportunity Results</h3>
        <div className="dal-table-wrap">
          <table className="dal-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Site Name</th>
                <th>Nearest Station</th>
                <th>Nearest Node</th>
                <th>Nearest Edge</th>
                <th>Distance Feet</th>
                <th>Build Feet</th>
                <th>Construction Type</th>
                <th>Snap Method</th>
                <th>Routing Mode</th>
                <th>Path Confidence</th>
                <th>Road Segments</th>
                <th>Road Names</th>
                <th>Road Classes</th>
                <th>Attachment Method</th>
                <th>Certification Readiness</th>
                <th>Candidate ScopeVersion Status</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr
                  key={record.site.candidateId}
                  className={activeRecord?.site.candidateId === record.site.candidateId ? "selected-row" : ""}
                  onClick={() => selectSite(record.site.candidateId)}
                >
                  <td>{record.rank}</td>
                  <td>{record.site.companyName}</td>
                  <td>{record.result.nearestStation?.stationId ?? "n/a"}</td>
                  <td>{record.result.nearestNode?.nodeId ?? "n/a"}</td>
                  <td>{record.result.nearestEdge?.edgeId ?? "n/a"}</td>
                  <td>{feet(record.result.nearestEdge?.distanceFeet ?? record.result.nearestStation?.distanceFeet)}</td>
                  <td>{feet(record.result.lateralPath?.feet)}</td>
                  <td>{record.result.lateralPath?.constructionType ?? "BURIED"}</td>
                  <td>{record.result.streetSnap?.snapMethod ?? "n/a"}</td>
                  <td>{record.result.lateralPath?.routingMode ?? "n/a"}</td>
                  <td>{record.result.lateralPath?.pathConfidence ?? "n/a"}</td>
                  <td>{fmt(record.result.lateralPath?.roadSegmentCount)}</td>
                  <td>{record.result.lateralPath?.roadNamesTraversed.join(", ") ?? "n/a"}</td>
                  <td>{record.result.lateralPath?.roadClassesTraversed.join(", ") ?? "n/a"}</td>
                  <td>{record.result.lateralPath?.attachmentMethod ?? "n/a"}</td>
                  <td>{statusLabel(record.result)}</td>
                  <td>{record.candidateScopeVersion?.scopeVersionId ?? "not generated"}</td>
                </tr>
              ))}
              {!records.length ? (
                <tr>
                  <td colSpan={17}>No analysis records yet. Load FiberLight inventory, load Texas 400 sites, then run analysis.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="dal-grid">
        <div className="dal-panel">
          <h3>Human Visualization Rule</h3>
          <div className="dal-table-wrap">
            <table className="dal-table">
              <thead>
                <tr>
                  <th>Object</th>
                  <th>Produced</th>
                  <th>Visualized</th>
                  <th>Inspectable</th>
                  <th>Validatable</th>
                  <th>Certifiable</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Inventory ScopeVersion", Boolean(hydratedInventoryScope), Boolean(activeMapSpecs.length), Boolean(hydratedInventoryScope), Boolean(hydratedInventoryScope), "Inventory Recovery"],
                  ["Opportunity Dataset", opportunitySites.length > 0, true, true, certifiedSites.length === opportunitySites.length, "Geocode + analysis"],
                  ["Nearest Station Result", Boolean(activeResult?.nearestStation), Boolean(activeResult?.nearestStation), Boolean(activeResult?.nearestStation), Boolean(activeResult?.nearestStation), "Serviceability"],
                  ["Nearest Node Result", Boolean(activeResult?.nearestNode), Boolean(activeResult?.nearestNode), Boolean(activeResult?.nearestNode), Boolean(activeResult?.nearestNode), "Serviceability"],
                  ["Nearest Edge Result", Boolean(activeResult?.nearestEdge), Boolean(activeResult?.nearestEdge), Boolean(activeResult?.nearestEdge), Boolean(activeResult?.nearestEdge), "Attachment"],
                  ["Build Path", Boolean(activeResult?.lateralPath), Boolean(activeResult?.lateralPath), Boolean(activeResult?.lateralPath), Boolean(activeResult?.certificationReadiness.hasLateral), "Lateral"],
                  ["Ranked Opportunity", records.length > 0, records.length > 0, records.length > 0, records.length > 0, "Operator"],
                  ["Candidate ScopeVersion", Boolean(activeRecord?.candidateScopeVersion ?? activeScopePreview), Boolean(activeRecord?.candidateScopeVersion ?? activeScopePreview), Boolean(activeRecord?.candidateScopeVersion ?? activeScopePreview), false, "Future certification"],
                ].map(([object, produced, visualized, inspectable, validatable, certifiable]) => (
                  <tr key={String(object)}>
                    <td>{object}</td>
                    <td>{produced ? "YES" : "NO"}</td>
                    <td>{visualized ? "YES" : "NO"}</td>
                    <td>{inspectable ? "YES" : "NO"}</td>
                    <td>{validatable ? "YES" : "NO"}</td>
                    <td>{String(certifiable)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="dal-panel">
          <h3>MapKernel Diagnostics</h3>
          <div className="dal-metrics">
            <span>ScopeVersionId: {activeDiagnostics.scopeVersionId}</span>
            <span>Routes: {fmt(activeDiagnostics.routeCount)}</span>
            <span>Stations: {fmt(activeDiagnostics.stationCount)}</span>
            <span>Nodes: {fmt(activeDiagnostics.nodeCount)}</span>
            <span>Edges: {fmt(activeDiagnostics.edgeCount)}</span>
            <span>Objects: {fmt(activeDiagnostics.objectCount)}</span>
            <span>Sites: {fmt(activeDiagnostics.siteCount)}</span>
            <span>Attachments: {fmt(activeDiagnostics.attachmentCount)}</span>
            <span>Laterals: {fmt(activeDiagnostics.lateralCount)}</span>
            <span>Render Authority: {activeDiagnostics.renderAuthority.status}</span>
            <span>Duplicate Keys: {fmt(activeDiagnostics.renderAuthority.duplicateKeyCount)}</span>
            <span>Duplicate Objects: {fmt(activeDiagnostics.renderAuthority.duplicateObjectCount)}</span>
            <span>Duplicate Render Authorities: {fmt(activeDiagnostics.renderAuthority.duplicateRenderAuthorityCount)}</span>
          </div>
          <pre className="dal-pre">
            {JSON.stringify(
              {
                serviceability: activeResult,
                selection: activeDiagnostics.selection,
                viewport: activeDiagnostics.viewport,
                stationing: activeDiagnostics.stationing,
                extensionHooks: activeDiagnostics.extensionHooks,
                renderAuthority: activeDiagnostics.renderAuthority,
              },
              null,
              2
            )}
          </pre>
        </div>
      </div>
    </section>
  );
}
