import { useEffect, useState } from "react";
import ReasoningHealthDashboard from "../components/ReasoningHealthDashboard";
import { listCandidateSites, listCloseEvents, listControlWorkItems, listFieldClosures, listInventoryGraphs, listIofPackages, listMarketplaceQuotes, listOpportunitySeeds, listPrismOpportunities, listScopeVersions, loadTwinState } from "../api/dalClient";
import { testDalConnectivity, type DalConnectivityResult } from "../api/dalConnectivity";
import { listInventoryImportJobs } from "../api/inventoryImportJobs";
import { discoverInventoryRecovery, summarizeInventoryRecovery, type InventoryRecoveryRecord } from "../api/inventoryRecovery";
import { endpointBaseUrl, type ReasoningFabricHealth } from "../api/reasoningRegistry";
import type { CloseEvent, ControlWorkItem, FieldClosure, InventoryGraphMetadata, InventoryHealthMetrics, InventoryImportJob, IOFPackage, MarketplaceQuote, PrismOpportunity, ScopeVersion, TwinState } from "../types/dal";
import type { CandidateSite } from "../types/candidateSite";
import type { OpportunitySeed } from "../types/portfolio";
import { renderIOFPackage, renderScopeVersion, summarizeMapKernelMetrics } from "../mapkernel";

function fmt(n: number | undefined) {
  return Number(n || 0).toLocaleString();
}

function money(n: number | undefined) {
  return Number(n || 0).toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function topBy(seeds: OpportunitySeed[], value: (seed: OpportunitySeed) => number, ascending = false) {
  return [...seeds].sort((a, b) => (ascending ? value(a) - value(b) : value(b) - value(a))).slice(0, 10);
}

export default function OperationalIntelligenceWorkspace() {
  const [graphs, setGraphs] = useState<InventoryGraphMetadata[]>([]);
  const [candidateSites, setCandidateSites] = useState<CandidateSite[]>([]);
  const [opportunities, setOpportunities] = useState<PrismOpportunity[]>([]);
  const [scopeVersions, setScopeVersions] = useState<ScopeVersion[]>([]);
  const [iofPackages, setIofPackages] = useState<IOFPackage[]>([]);
  const [closeEvents, setCloseEvents] = useState<CloseEvent[]>([]);
  const [quotes, setQuotes] = useState<MarketplaceQuote[]>([]);
  const [seeds, setSeeds] = useState<OpportunitySeed[]>([]);
  const [workItems, setWorkItems] = useState<ControlWorkItem[]>([]);
  const [closures, setClosures] = useState<FieldClosure[]>([]);
  const [twinState, setTwinState] = useState<TwinState | null>(null);
  const [recoveryRecords, setRecoveryRecords] = useState<InventoryRecoveryRecord[]>([]);
  const [connectivityResults, setConnectivityResults] = useState<DalConnectivityResult[]>([]);
  const [importJobs, setImportJobs] = useState<InventoryImportJob[]>([]);
  const [reasoningFabricHealth, setReasoningFabricHealth] = useState<ReasoningFabricHealth | null>(null);
  const [status, setStatus] = useState("Operational Intelligence ready.");

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    try {
      const [nextGraphs, nextSites, nextOpps, nextScopes, nextPackages, nextCloseEvents, nextQuotes, nextSeeds, nextWork, nextClosures, nextTwin, nextRecovery, nextConnectivity, nextImportJobs] = await Promise.all([
        listInventoryGraphs(),
        listCandidateSites(),
        listPrismOpportunities(),
        listScopeVersions(),
        listIofPackages(),
        listCloseEvents(),
        listMarketplaceQuotes(),
        listOpportunitySeeds(),
        listControlWorkItems(),
        listFieldClosures(),
        loadTwinState(),
        discoverInventoryRecovery(),
        testDalConnectivity(),
        listInventoryImportJobs(),
      ]);
      setGraphs(nextGraphs);
      setCandidateSites(nextSites);
      setOpportunities(nextOpps);
      setScopeVersions(nextScopes);
      setIofPackages(nextPackages);
      setCloseEvents(nextCloseEvents);
      setQuotes(nextQuotes);
      setSeeds(nextSeeds);
      setWorkItems(nextWork);
      setClosures(nextClosures);
      setTwinState(nextTwin);
      setRecoveryRecords(nextRecovery);
      setConnectivityResults(nextConnectivity);
      setImportJobs(nextImportJobs);
      setStatus("Operational summary refreshed.");
    } catch (err: any) {
      setStatus(`Operational summary failed: ${err?.message ?? String(err)}`);
    }
  }

  const activeWork = workItems.filter((item) => item.status === "ACTIVE").length;
  const mapKernelSpecs = [...scopeVersions.map((scopeVersion) => renderScopeVersion(scopeVersion)), ...iofPackages.map((iofPackage) => renderIOFPackage(iofPackage))];
  const mapKernelMetrics = summarizeMapKernelMetrics(mapKernelSpecs, {
    layerVisibility: {
      edge: true,
      station: true,
      node: true,
      object: true,
      site: true,
      attachment: true,
      lateral: true,
      scopeVersion: true,
      iofPackage: true,
    },
    showStationLabels: true,
    stationDensityFeet: 300,
  });
  const inventoryRecoverySummary = summarizeInventoryRecovery(recoveryRecords);
  const inventoryHealth: InventoryHealthMetrics = {
    totalInventories: recoveryRecords.length,
    serverInventories: inventoryRecoverySummary.serverInventoryCount,
    browserInventories: inventoryRecoverySummary.browserInventoryCount,
    synchronizedInventories: inventoryRecoverySummary.synchronizedInventoryCount,
    unsynchronizedInventories: inventoryRecoverySummary.unsynchronizedInventoryCount,
    totalNodes: recoveryRecords.reduce((sum, record) => sum + record.nodeCount, 0),
    totalEdges: recoveryRecords.reduce((sum, record) => sum + record.edgeCount, 0),
    totalStations: recoveryRecords.reduce((sum, record) => sum + record.stationCount, 0),
    totalRoutes: recoveryRecords.reduce((sum, record) => sum + record.routeCount, 0),
    serverSizeMB: inventoryRecoverySummary.totalServerSizeMB,
    browserSizeMB: inventoryRecoverySummary.totalBrowserSizeMB,
    largestInventories: inventoryRecoverySummary.largestGraphs.map((record) => ({
      inventoryId: record.inventoryId,
      name: record.name,
      graphSizeMB: record.graphSizeMB,
      storageLocation: record.storageLocation,
    })),
    failedImports: importJobs.filter((job) => job.status === "FAILED").length,
    failedValidations: recoveryRecords.filter((record) => record.validationStatus === "FAIL").length,
    syncFailures: inventoryRecoverySummary.syncFailures.length,
  };
  const reachableEndpoints = connectivityResults.filter((result) => result.reachable);
  const dalConnectivityStatus = connectivityResults.length && reachableEndpoints.length === connectivityResults.length ? "ONLINE" : connectivityResults.length ? "DEGRADED" : "NOT TESTED";
  const serverReachability = connectivityResults.find((result) => result.key === "baseline")?.reachable ? "REACHABLE" : "NOT REACHABLE";
  const onlineReasoningModels = reasoningFabricHealth?.onlineModels.length ?? 0;
  const offlineReasoningModels = reasoningFabricHealth?.offlineModels.length ?? 0;
  const activeReasoningEndpoint = reasoningFabricHealth?.activeEndpoint;
  const scopeFinancialValue = (scope: ScopeVersion, key: "NRC" | "MRC" | "TCV") => {
    const truth = scope.canonicalTruth as any;
    const quote = truth?.quoteBasis as MarketplaceQuote | undefined;
    if (key === "NRC") return Number(truth?.financialBasis?.NRC ?? quote?.nrc ?? 0);
    if (key === "MRC") return Number(truth?.financialBasis?.MRC ?? quote?.mrc ?? quote?.monthlyService ?? 0);
    return Number(truth?.financialBasis?.TCV ?? quote?.totalContractValue ?? 0);
  };
  const draftScopes = scopeVersions.filter((scope) => scope.status === "DRAFT");
  const analyzedScopes = scopeVersions.filter((scope) => scope.status === "ANALYZED");
  const quotedScopes = scopeVersions.filter((scope) => scope.status === "QUOTED");
  const approvedScopes = scopeVersions.filter((scope) => scope.status === "APPROVED");
  const activatedScopes = scopeVersions.filter((scope) => scope.status === "ACTIVATED");
  const constructionScopes = scopeVersions.filter((scope) => scope.status === "IN_CONSTRUCTION");
  const completedScopes = scopeVersions.filter((scope) => scope.status === "COMPLETE");
  const certifiedScopeVersions = scopeVersions.filter((scope) => scope.certificationState === "CERTIFIED");
  const draftCertificationScopeVersions = scopeVersions.filter((scope) => !scope.certificationState || scope.certificationState === "DRAFT");
  const rejectedScopeVersions = scopeVersions.filter((scope) => scope.certificationState === "REJECTED");
  const immutableCertifiedScopeVersions = scopeVersions.filter((scope) => scope.certificationState === "CERTIFIED" && scope.isImmutable);
  const childLineageScopeVersions = scopeVersions.filter((scope) => Boolean(scope.parentScopeVersionId));
  const closureAuthorityScopeVersions = scopeVersions.filter((scope) => Boolean(scope.closureEventId));
  const inventoryScopeVersions = scopeVersions.filter((scope) => scope.type === "INVENTORY" || scope.source === "InventoryGraph");
  const candidateScopeVersions = scopeVersions.filter((scope) => scope.type === "CANDIDATE" || scope.source === "OpportunitySeed" || scope.source === "PrismOpportunity");
  const approvedScopeVersions = scopeVersions.filter((scope) => scope.type === "APPROVED" || scope.status === "APPROVED");
  const fieldClosedScopeVersions = scopeVersions.filter((scope) => scope.type === "FIELD_CLOSED" || scope.source === "FieldClosure");
  const activePackages = iofPackages.filter((iofPackage) => iofPackage.status === "ACTIVE");
  const completedPackages = iofPackages.filter((iofPackage) => iofPackage.status === "COMPLETE");
  const closedPackages = iofPackages.filter((iofPackage) => iofPackage.status === "CLOSED");
  const packageProgress =
    iofPackages.reduce((sum, iofPackage) => sum + Number(iofPackage.progress?.percentComplete ?? 0), 0) / Math.max(iofPackages.length, 1);
  const projectedNrc = scopeVersions.reduce((sum, scope) => sum + scopeFinancialValue(scope, "NRC"), 0);
  const projectedMrc = scopeVersions.reduce((sum, scope) => sum + scopeFinancialValue(scope, "MRC"), 0);
  const projectedTcv = scopeVersions.reduce((sum, scope) => sum + scopeFinancialValue(scope, "TCV"), 0);
  const revenueForecast = projectedTcv;
  const recommended = seeds.filter((seed) => seed.overallScore >= 70);
  const averagePayback = seeds.reduce((sum, seed) => sum + seed.paybackMonths, 0) / Math.max(seeds.length, 1);
  const geocodedSites = candidateSites.filter((site) => Number.isFinite(site.latitude) && Number.isFinite(site.longitude));
  const verifiedSites = candidateSites.filter((site) => site.status === "VERIFIED");
  const averageDistanceToBackbone =
    seeds.reduce((sum, seed) => sum + Number(seed.networkAffinity?.nearestRoute.distanceFeet ?? seed.distanceFeet ?? 0), 0) / Math.max(seeds.length, 1);
  const averageBuildCost = seeds.reduce((sum, seed) => sum + Number(seed.buildCost ?? seed.buildPath?.estimatedCost ?? 0), 0) / Math.max(seeds.length, 1);
  const expectedRevenue = recommended.reduce((sum, seed) => sum + seed.estimatedRevenueAnnual, 0);
  const expectedTcv = projectedTcv || recommended.reduce((sum, seed) => sum + seed.estimatedTCV, 0);
  const expectedEbitda = Math.round(expectedRevenue * 0.42);
  const topAffinity = topBy(seeds.filter((seed) => seed.networkAffinity), (seed) => seed.networkAffinity?.affinityScore ?? 0);
  const topRevenue = topBy(seeds, (seed) => seed.estimatedRevenueAnnual);
  const topLowestCost = topBy(seeds, (seed) => seed.buildCost, true);
  const topPayback = topBy(seeds.filter((seed) => Number.isFinite(seed.paybackMonths)), (seed) => seed.paybackMonths, true);
  const topLowestRisk = topBy(seeds, (seed) => Number(seed.riskScore ?? seed.buildPath?.riskScore ?? 100), true);
  const topRoi = topBy(seeds, (seed) => Number(seed.roi ?? seed.estimatedTCV / Math.max(seed.buildCost, 1)));
  const topStrategic = topBy(seeds, (seed) => seed.strategicScore);
  const expansionSeeds = seeds.filter((seed) => ["RING_EXTENSION", "REGEN_EXTENSION", "DATACENTER_EXTENSION"].includes(seed.attachmentStrategy?.attachmentType ?? ""));
  const projectedExpansionRevenue = expansionSeeds.reduce((sum, seed) => sum + seed.estimatedRevenueAnnual, 0);
  const projectedRouteMiles = seeds.reduce((sum, seed) => sum + Number(seed.buildPath?.buildFeet ?? seed.distanceFeet ?? 0) / 5280, 0);
  const projectedBuildCost = seeds.reduce((sum, seed) => sum + Number(seed.buildCost ?? seed.buildPath?.estimatedCost ?? 0), 0);
  const backlog = workItems.filter((item) => !["COMPLETE", "CANCELLED"].includes(item.status)).length;
  const buildableOpportunities = seeds.filter((seed) => seed.constructabilityAssessment?.buildableStatus === "BUILDABLE" || Number(seed.constructabilityScore ?? 0) >= 72);
  const permitConstrainedOpportunities = seeds.filter((seed) => Number(seed.permitScore ?? 100) < 55 || Number(seed.constructabilityAssessment?.permitComplexity ?? 0) >= 55);
  const crossingConstrainedOpportunities = seeds.filter(
    (seed) =>
      Number(seed.crossingScore ?? 100) < 60 ||
      Number(seed.buildPath?.estimatedCrossings ?? 0) > 0 ||
      Number(seed.constructabilityAssessment?.rail.railCrossingCount ?? 0) > 0 ||
      Number(seed.constructabilityAssessment?.water.waterCrossingCount ?? 0) > 0
  );
  const highRiskOpportunities = seeds.filter((seed) => Number(seed.riskScore ?? seed.buildPath?.riskScore ?? 0) >= 65 || seed.constructabilityAssessment?.buildableStatus === "HIGH_RISK");
  const lowRiskOpportunities = seeds.filter((seed) => Number(seed.riskScore ?? seed.buildPath?.riskScore ?? 100) <= 35 && Number(seed.constructabilityScore ?? 0) >= 70);
  const estimatedPermitBacklog = permitConstrainedOpportunities.reduce((sum, seed) => sum + Number(seed.estimatedPermitCost ?? 0), 0);
  const estimatedConstructionBacklog = workItems
    .filter((item) => !["COMPLETE", "CANCELLED"].includes(item.status))
    .reduce((sum, item) => sum + Number((item.buildPath as any)?.estimatedCost ?? 0), 0);
  const readiness = graphs.length && seeds.length && workItems.length ? "PORTFOLIO EXECUTION READY" : "NEEDS INVENTORY / PRISM PORTFOLIO / CONTROL DATA";
  const siteDecisionScopes = scopeVersions.filter((scope) => (scope.canonicalTruth as any)?.decisionType === "PrismSiteDecision");
  const serviceabilityValue = (seed: OpportunitySeed) =>
    Number(seed.constructabilityScore ?? 0) + Math.max(0, 100 - Number(seed.networkAffinity?.nearestRoute.distanceFeet ?? seed.distanceFeet ?? 0) / 100);
  const topServiceable = topBy(seeds, serviceabilityValue);
  const topNonServiceable = topBy(seeds, serviceabilityValue, true);

  return (
    <section className="dal-workspace">
      <div className="dal-workspace-header">
        <div>
          <h2>DAL Operational Intelligence</h2>
          <p>Lightweight platform readiness summary across DAL inventory and operational state.</p>
        </div>
        <button type="button" onClick={() => void refresh()}>
          Refresh
        </button>
      </div>

      <div className="dal-panel">
        <h3>{readiness}</h3>
        <div className="dal-status">{status}</div>
        <div className="dal-metrics">
          <span>Graphs: {fmt(graphs.length)}</span>
          <span>Inventory Health: {inventoryHealth.failedImports || inventoryHealth.failedValidations || inventoryHealth.syncFailures ? "ATTENTION" : "HEALTHY"}</span>
          <span>DAL Connectivity Status: {dalConnectivityStatus}</span>
          <span>Server Reachability: {serverReachability}</span>
          <span>Reasoning Fabric: {activeReasoningEndpoint ? activeReasoningEndpoint.healthStatus : "NOT CONFIGURED"}</span>
          <span>Primary Endpoint: {activeReasoningEndpoint ? endpointBaseUrl(activeReasoningEndpoint) : "none"}</span>
          <span>Reasoning Model: {activeReasoningEndpoint?.modelId ?? activeReasoningEndpoint?.modelName ?? "none"}</span>
          <span>Reasoning Provider: {activeReasoningEndpoint?.provider ?? "unknown"}</span>
          <span>Reasoning Health: {activeReasoningEndpoint?.healthStatus ?? "UNKNOWN"}</span>
          <span>Online Models: {fmt(onlineReasoningModels)}</span>
          <span>Offline Models: {fmt(offlineReasoningModels)}</span>
          <span>Active Reasoning Endpoint: {activeReasoningEndpoint?.name ?? "none"}</span>
          <span>Reasoning Response Time: {fmt(activeReasoningEndpoint?.latencyMs)} ms</span>
          <span>Server Inventory Count: {fmt(inventoryRecoverySummary.serverInventoryCount)}</span>
          <span>Browser Inventory Count: {fmt(inventoryRecoverySummary.browserInventoryCount)}</span>
          <span>Synchronized Inventory Count: {fmt(inventoryRecoverySummary.synchronizedInventoryCount)}</span>
          <span>Unsynchronized Inventory Count: {fmt(inventoryRecoverySummary.unsynchronizedInventoryCount)}</span>
          <span>Server Inventory Size: {inventoryRecoverySummary.totalServerSizeMB.toLocaleString(undefined, { maximumFractionDigits: 2 })} MB</span>
          <span>Browser Inventory Size: {inventoryRecoverySummary.totalBrowserSizeMB.toLocaleString(undefined, { maximumFractionDigits: 2 })} MB</span>
          <span>Sync Failures: {fmt(inventoryRecoverySummary.syncFailures.length)}</span>
          <span>Failed Imports: {fmt(inventoryHealth.failedImports)}</span>
          <span>Failed Validations: {fmt(inventoryHealth.failedValidations)}</span>
          <span>Sites Imported: {fmt(candidateSites.length)}</span>
          <span>Geocoded Sites: {fmt(geocodedSites.length)}</span>
          <span>Verified Sites: {fmt(verifiedSites.length)}</span>
          <span>Sites Evaluated: {fmt(candidateSites.filter((site) => site.status === "ANALYZED" || site.status === "QUALIFIED").length || seeds.length)}</span>
          <span>Recommended Opportunities: {fmt(recommended.length)}</span>
          <span>Draft Scopes: {fmt(draftScopes.length)}</span>
          <span>Analyzed Scopes: {fmt(analyzedScopes.length)}</span>
          <span>Quoted Scopes: {fmt(quotedScopes.length)}</span>
          <span>Approved Scopes: {fmt(approvedScopes.length)}</span>
          <span>Activated Scopes: {fmt(activatedScopes.length)}</span>
          <span>Construction Scopes: {fmt(constructionScopes.length)}</span>
          <span>Completed Scopes: {fmt(completedScopes.length)}</span>
          <span>Total ScopeVersions: {fmt(scopeVersions.length)}</span>
          <span>Certified ScopeVersions: {fmt(certifiedScopeVersions.length)}</span>
          <span>Immutable Certified ScopeVersions: {fmt(immutableCertifiedScopeVersions.length)}</span>
          <span>Child Lineage ScopeVersions: {fmt(childLineageScopeVersions.length)}</span>
          <span>Closure Authority ScopeVersions: {fmt(closureAuthorityScopeVersions.length)}</span>
          <span>Draft Certification ScopeVersions: {fmt(draftCertificationScopeVersions.length)}</span>
          <span>Rejected ScopeVersions: {fmt(rejectedScopeVersions.length)}</span>
          <span>Inventory ScopeVersions: {fmt(inventoryScopeVersions.length)}</span>
          <span>Candidate ScopeVersions: {fmt(candidateScopeVersions.length)}</span>
          <span>Approved Type ScopeVersions: {fmt(approvedScopeVersions.length)}</span>
          <span>Field Closed ScopeVersions: {fmt(fieldClosedScopeVersions.length)}</span>
          <span>Package Count: {fmt(iofPackages.length)}</span>
          <span>Active Packages: {fmt(activePackages.length)}</span>
          <span>Completed Packages: {fmt(completedPackages.length)}</span>
          <span>Closed Packages: {fmt(closedPackages.length)}</span>
          <span>Close Events: {fmt(closeEvents.length)}</span>
          <span>Package Progress: {fmt(Math.round(packageProgress))}%</span>
          <span>Buildable Opportunities: {fmt(buildableOpportunities.length)}</span>
          <span>Permit-Constrained Opportunities: {fmt(permitConstrainedOpportunities.length)}</span>
          <span>Crossing-Constrained Opportunities: {fmt(crossingConstrainedOpportunities.length)}</span>
          <span>High-Risk Opportunities: {fmt(highRiskOpportunities.length)}</span>
          <span>Low-Risk Opportunities: {fmt(lowRiskOpportunities.length)}</span>
          <span>Average Distance To Backbone: {fmt(Math.round(averageDistanceToBackbone))} ft</span>
          <span>Average Build Cost: {money(averageBuildCost)}</span>
          <span>Estimated Permit Backlog: {money(estimatedPermitBacklog)}</span>
          <span>Estimated Construction Backlog: {money(estimatedConstructionBacklog)}</span>
          <span>Projected NRC: {money(projectedNrc)}</span>
          <span>Projected MRC: {money(projectedMrc)}</span>
          <span>Projected TCV: {money(projectedTcv)}</span>
          <span>Revenue Forecast: {money(revenueForecast)}</span>
          <span>Expected Revenue: {fmt(expectedRevenue)}</span>
          <span>Expected TCV: {fmt(expectedTcv)}</span>
          <span>Expected EBITDA: {fmt(expectedEbitda)}</span>
          <span>Projected Expansion Revenue: {fmt(projectedExpansionRevenue)}</span>
          <span>Projected Route Miles: {projectedRouteMiles.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
          <span>Projected Build Cost: {money(projectedBuildCost)}</span>
          <span>Affinity-Ranked Seeds: {fmt(topAffinity.length)}</span>
          <span>Average Payback: {fmt(Math.round(averagePayback))} mo</span>
          <span>Construction Backlog: {fmt(backlog)}</span>
          <span>Opportunities: {fmt(opportunities.length)}</span>
          <span>ScopeVersions: {fmt(scopeVersions.length)}</span>
          <span>Map Visible ScopeVersions: {fmt(mapKernelMetrics.visibleScopeVersions)}</span>
          <span>Map Visible Routes: {fmt(mapKernelMetrics.visibleRoutes)}</span>
          <span>Map Visible Stations: {fmt(mapKernelMetrics.visibleStations)}</span>
          <span>Map Visible Nodes: {fmt(mapKernelMetrics.visibleNodes)}</span>
          <span>Map Visible Objects: {fmt(mapKernelMetrics.visibleObjects)}</span>
          <span>Site Decision Scopes: {fmt(siteDecisionScopes.length)}</span>
          <span>Work items: {fmt(workItems.length)}</span>
          <span>Active work: {fmt(activeWork)}</span>
          <span>Closures: {fmt(closures.length)}</span>
          <span>Completed feet: {fmt(twinState?.completedFeet)}</span>
        </div>
      </div>

      <div className="dal-grid">
        <ReasoningHealthDashboard onHealthChange={setReasoningFabricHealth} />
        <div className="dal-panel">
          <h3>ScopeVersion Doctrine</h3>
          <div className="dal-metrics">
            <span>Certified ScopeVersions immutable: ENABLED</span>
            <span>Child lineage enabled: ENABLED</span>
            <span>Closure authority required: ENABLED</span>
            <span>IOF Packages are execution artifacts: ENABLED</span>
            <span>AI output advisory only: ENABLED</span>
            <span>Immutable Certified: {fmt(immutableCertifiedScopeVersions.length)}</span>
            <span>Child Lineage: {fmt(childLineageScopeVersions.length)}</span>
            <span>Closure-Linked Children: {fmt(closureAuthorityScopeVersions.length)}</span>
          </div>
        </div>
        <div className="dal-panel">
          <h3>Map Kernel Metrics</h3>
          <div className="dal-metrics">
            <span>Visible ScopeVersions: {fmt(mapKernelMetrics.visibleScopeVersions)}</span>
            <span>Visible IOF Packages: {fmt(mapKernelMetrics.visibleIofPackages)}</span>
            <span>Visible Routes: {fmt(mapKernelMetrics.visibleRoutes)}</span>
            <span>Visible Stations: {fmt(mapKernelMetrics.visibleStations)}</span>
            <span>Visible Nodes: {fmt(mapKernelMetrics.visibleNodes)}</span>
            <span>Visible Edges: {fmt(mapKernelMetrics.visibleEdges)}</span>
            <span>Visible Objects: {fmt(mapKernelMetrics.visibleObjects)}</span>
            <span>Visible Sites: {fmt(mapKernelMetrics.visibleSites)}</span>
            <span>Visible Attachments: {fmt(mapKernelMetrics.visibleAttachments)}</span>
            <span>Visible Laterals: {fmt(mapKernelMetrics.visibleLaterals)}</span>
          </div>
        </div>
        <div className="dal-panel">
          <h3>Inventory Health Dashboard</h3>
          <div className="dal-metrics">
            <span>Total Inventories: {fmt(inventoryHealth.totalInventories)}</span>
            <span>Total Nodes: {fmt(inventoryHealth.totalNodes)}</span>
            <span>Total Edges: {fmt(inventoryHealth.totalEdges)}</span>
            <span>Total Stations: {fmt(inventoryHealth.totalStations)}</span>
            <span>Total Routes: {fmt(inventoryHealth.totalRoutes)}</span>
            <span>Server Size: {inventoryHealth.serverSizeMB.toLocaleString(undefined, { maximumFractionDigits: 2 })} MB</span>
            <span>Browser Size: {inventoryHealth.browserSizeMB.toLocaleString(undefined, { maximumFractionDigits: 2 })} MB</span>
            <span>Import Jobs: {fmt(importJobs.length)}</span>
            <span>Failed Imports: {fmt(inventoryHealth.failedImports)}</span>
            <span>Failed Validations: {fmt(inventoryHealth.failedValidations)}</span>
          </div>
          <div className="dal-list">
            {inventoryHealth.largestInventories.map((record) => (
              <div key={record.inventoryId} className="dal-list-row">
                <span>{record.name}</span>
                <b>{record.graphSizeMB.toLocaleString(undefined, { maximumFractionDigits: 2 })} MB</b>
                <small>{record.storageLocation}</small>
              </div>
            ))}
          </div>
        </div>
        <div className="dal-panel">
          <h3>DAL Connectivity</h3>
          <div className="dal-list">
            {connectivityResults.map((result) => (
              <div key={result.key} className="dal-list-row">
                <span>{result.label}</span>
                <b>{result.reachable ? "REACHABLE" : "UNREACHABLE"}</b>
                <small>{result.endpoint} / {fmt(result.responseTimeMs)} ms</small>
              </div>
            ))}
            {!connectivityResults.length ? <div className="dal-status">Connectivity has not been tested.</div> : null}
          </div>
        </div>
        <div className="dal-panel">
          <h3>Execution Chain</h3>
          <div className="dal-metrics">
            <span>ScopeVersion = Truth</span>
            <span>IOF Package = Work</span>
            <span>Close Event = Authorized Transformation</span>
            <span>Child ScopeVersion = New Truth</span>
            <span>Package Count: {fmt(iofPackages.length)}</span>
            <span>Active Packages: {fmt(activePackages.length)}</span>
            <span>Completed Packages: {fmt(completedPackages.length)}</span>
            <span>Closed Packages: {fmt(closedPackages.length)}</span>
            <span>Close Events: {fmt(closeEvents.length)}</span>
            <span>Average Package Progress: {fmt(Math.round(packageProgress))}%</span>
          </div>
          <div className="dal-list">
            {iofPackages.slice(0, 8).map((iofPackage) => (
              <div key={iofPackage.packageId} className="dal-list-row">
                <span>{iofPackage.packageType}</span>
                <b>{iofPackage.status}</b>
                <small>{iofPackage.scopeVersionId} / {fmt(iofPackage.progress?.percentComplete)}%</small>
              </div>
            ))}
            {!iofPackages.length ? <div className="dal-status">No IOF Packages have been persisted yet.</div> : null}
          </div>
        </div>
        <div className="dal-panel">
          <h3>Graph Summary</h3>
          <pre className="dal-pre">{JSON.stringify(graphs.slice(0, 5), null, 2)}</pre>
        </div>
        <div className="dal-panel">
          <h3>Inventory Synchronization</h3>
          <div className="dal-list">
            {inventoryRecoverySummary.largestGraphs.map((record) => (
              <div key={record.inventoryId} className="dal-list-row">
                <span>{record.name}</span>
                <b>{Number(record.graphSizeMB || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} MB</b>
                <small>{record.storageLocation} / {record.syncStatus}</small>
              </div>
            ))}
          </div>
          {inventoryRecoverySummary.syncFailures.length ? (
            <pre className="dal-pre">{JSON.stringify(inventoryRecoverySummary.syncFailures, null, 2)}</pre>
          ) : (
            <div className="dal-status">No inventory sync failures detected.</div>
          )}
        </div>
        <div className="dal-panel">
          <h3>Portfolio Summary</h3>
          <pre className="dal-pre">
            {JSON.stringify(
              {
                sitesImported: candidateSites.length,
                geocodedSites: geocodedSites.length,
                verifiedSites: verifiedSites.length,
                sitesEvaluated: candidateSites.filter((site) => site.status === "ANALYZED" || site.status === "QUALIFIED").length,
                recommended: recommended.slice(0, 10),
                lifecycle: {
                  draftScopes: draftScopes.length,
                  analyzedScopes: analyzedScopes.length,
                  quotedScopes: quotedScopes.length,
                  approvedScopes: approvedScopes.length,
                  activatedScopes: activatedScopes.length,
                  constructionScopes: constructionScopes.length,
                  completedScopes: completedScopes.length,
                },
                inventoryRecovery: inventoryRecoverySummary,
                commercial: {
                  projectedNrc,
                  projectedMrc,
                  projectedTcv,
                  quotes: quotes.length,
                },
                averageDistanceToBackbone,
                averageBuildCost,
                expectedRevenue,
                expectedTcv,
                expectedEbitda,
                averagePayback,
                workItems,
                scopeVersionLifecycle: scopeVersions.map((scope) => ({
                  scopeVersionId: scope.scopeVersionId,
                  source: scope.source,
                  status: scope.status,
                  decisionType: (scope.canonicalTruth as any)?.decisionType,
                  opportunitySeedId: (scope.canonicalTruth as any)?.opportunitySeedId,
                })),
                closures: closures.slice(0, 5),
                twinState,
              },
              null,
              2
            )}
          </pre>
        </div>
      </div>

      <div className="dal-grid">
        <div className="dal-panel">
          <h3>Top 10 By Affinity</h3>
          <div className="dal-list">
            {topAffinity.map((seed) => (
              <div key={seed.id} className="dal-list-row">
                <span>{seed.siteName ?? seed.id}</span>
                <b>{fmt(Math.round(seed.networkAffinity?.affinityScore ?? 0))}</b>
                <small>{seed.attachmentStrategy?.attachmentType?.replaceAll("_", " ") ?? "n/a"}</small>
              </div>
            ))}
          </div>
        </div>

        <div className="dal-panel">
          <h3>Top 10 By Revenue</h3>
          <div className="dal-list">
            {topRevenue.map((seed) => (
              <div key={seed.id} className="dal-list-row">
                <span>{seed.siteName ?? seed.id}</span>
                <b>{money(seed.estimatedRevenueAnnual)}</b>
                <small>{seed.marketSegment ?? seed.candidateType}</small>
              </div>
            ))}
          </div>
        </div>

        <div className="dal-panel">
          <h3>Top Serviceable Sites</h3>
          <div className="dal-list">
            {topServiceable.map((seed) => (
              <div key={seed.id} className="dal-list-row">
                <span>{seed.siteName ?? seed.id}</span>
                <b>{fmt(Math.round(seed.constructabilityScore ?? 0))}</b>
                <small>{fmt(Math.round(seed.networkAffinity?.nearestRoute.distanceFeet ?? seed.distanceFeet ?? 0))} ft to backbone</small>
              </div>
            ))}
          </div>
        </div>

        <div className="dal-panel">
          <h3>Top Non-Serviceable Sites</h3>
          <div className="dal-list">
            {topNonServiceable.map((seed) => (
              <div key={seed.id} className="dal-list-row">
                <span>{seed.siteName ?? seed.id}</span>
                <b>{fmt(Math.round(seed.constructabilityScore ?? 0))}</b>
                <small>Risk {fmt(Math.round(seed.riskScore ?? seed.buildPath?.riskScore ?? 0))} / {fmt(Math.round(seed.networkAffinity?.nearestRoute.distanceFeet ?? seed.distanceFeet ?? 0))} ft</small>
              </div>
            ))}
          </div>
        </div>

        <div className="dal-panel">
          <h3>Top 10 Lowest Cost</h3>
          <div className="dal-list">
            {topLowestCost.map((seed) => (
              <div key={seed.id} className="dal-list-row">
                <span>{seed.siteName ?? seed.id}</span>
                <b>{money(seed.buildCost)}</b>
                <small>{seed.constructionType ?? seed.buildPath?.constructionType ?? seed.candidateType}</small>
              </div>
            ))}
          </div>
        </div>

        <div className="dal-panel">
          <h3>Top 10 By Payback</h3>
          <div className="dal-list">
            {topPayback.map((seed) => (
              <div key={seed.id} className="dal-list-row">
                <span>{seed.siteName ?? seed.id}</span>
                <b>{fmt(Math.round(seed.paybackMonths))} mo</b>
                <small>{money(seed.buildCost)}</small>
              </div>
            ))}
          </div>
        </div>

        <div className="dal-panel">
          <h3>Top 10 Lowest Risk</h3>
          <div className="dal-list">
            {topLowestRisk.map((seed) => (
              <div key={seed.id} className="dal-list-row">
                <span>{seed.siteName ?? seed.id}</span>
                <b>{fmt(Math.round(seed.riskScore ?? seed.buildPath?.riskScore ?? 0))}</b>
                <small>{seed.attachmentStrategy?.attachmentType?.replaceAll("_", " ") ?? seed.candidateType}</small>
              </div>
            ))}
          </div>
        </div>

        <div className="dal-panel">
          <h3>Top 10 Highest ROI</h3>
          <div className="dal-list">
            {topRoi.map((seed) => (
              <div key={seed.id} className="dal-list-row">
                <span>{seed.siteName ?? seed.id}</span>
                <b>{Number(seed.roi ?? seed.estimatedTCV / Math.max(seed.buildCost, 1)).toLocaleString(undefined, { maximumFractionDigits: 2 })}x</b>
                <small>{money(seed.estimatedTCV)}</small>
              </div>
            ))}
          </div>
        </div>

        <div className="dal-panel">
          <h3>Top 10 By Strategic Score</h3>
          <div className="dal-list">
            {topStrategic.map((seed) => (
              <div key={seed.id} className="dal-list-row">
                <span>{seed.siteName ?? seed.id}</span>
                <b>{fmt(Math.round(seed.strategicScore))}</b>
                <small>{seed.attachmentStrategy?.attachmentType?.replaceAll("_", " ") ?? seed.candidateType}</small>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="dal-grid">
        <div className="dal-panel">
          <h3>Expansion Forecast</h3>
          <div className="dal-metrics">
            <span>Expansion Candidates: {fmt(expansionSeeds.length)}</span>
            <span>Projected Revenue: {money(projectedExpansionRevenue)}</span>
            <span>Projected TCV: {money(expansionSeeds.reduce((sum, seed) => sum + seed.estimatedTCV, 0))}</span>
            <span>Projected Build Cost: {money(projectedBuildCost)}</span>
            <span>Route Miles: {projectedRouteMiles.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
            <span>Critical Capacity: {fmt(seeds.filter((seed) => seed.capacityStatus === "CRITICAL").length)}</span>
            <span>High Capacity: {fmt(seeds.filter((seed) => seed.capacityStatus === "HIGH").length)}</span>
          </div>
        </div>

        <div className="dal-panel">
          <h3>Projected Revenue</h3>
          <pre className="dal-pre">
            {JSON.stringify(
              {
                topAffinity: topAffinity.map((seed) => ({ id: seed.id, site: seed.siteName, affinity: seed.networkAffinity?.affinityScore })),
                topRevenue: topRevenue.map((seed) => ({ id: seed.id, site: seed.siteName, annualRevenue: seed.estimatedRevenueAnnual })),
                topServiceable: topServiceable.map((seed) => ({ id: seed.id, site: seed.siteName, constructabilityScore: seed.constructabilityScore, distanceFeet: seed.networkAffinity?.nearestRoute.distanceFeet ?? seed.distanceFeet })),
                topNonServiceable: topNonServiceable.map((seed) => ({ id: seed.id, site: seed.siteName, constructabilityScore: seed.constructabilityScore, riskScore: seed.riskScore })),
                topLowestCost: topLowestCost.map((seed) => ({ id: seed.id, site: seed.siteName, buildCost: seed.buildCost })),
                topPayback: topPayback.map((seed) => ({ id: seed.id, site: seed.siteName, paybackMonths: seed.paybackMonths })),
                topLowestRisk: topLowestRisk.map((seed) => ({ id: seed.id, site: seed.siteName, riskScore: seed.riskScore })),
                constructability: {
                  buildable: buildableOpportunities.length,
                  permitConstrained: permitConstrainedOpportunities.length,
                  crossingConstrained: crossingConstrainedOpportunities.length,
                  highRisk: highRiskOpportunities.length,
                  lowRisk: lowRiskOpportunities.length,
                  estimatedPermitBacklog,
                  estimatedConstructionBacklog,
                },
                topRoi: topRoi.map((seed) => ({ id: seed.id, site: seed.siteName, roi: seed.roi })),
                topStrategic: topStrategic.map((seed) => ({ id: seed.id, site: seed.siteName, strategicScore: seed.strategicScore })),
                expansionForecast: {
                  candidateCount: expansionSeeds.length,
                  projectedExpansionRevenue,
                  projectedRouteMiles,
                  projectedBuildCost,
                },
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
