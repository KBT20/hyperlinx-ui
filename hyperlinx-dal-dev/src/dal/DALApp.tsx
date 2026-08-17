import { lazy, Suspense, useEffect, useState } from "react";
import { DAL_API, DAL_APP_NAME, DAL_BASELINE_GRAPH_API, DAL_INVENTORY_GRAPH_API } from "../config/dalApi";
import ReasoningPanel from "../components/ReasoningPanel";
import RuntimeDiagnosticsPanel from "../components/RuntimeDiagnosticsPanel";
import type { ReasoningWorkspace } from "../api/reasoningClient";
import {
  endpointBaseUrl,
  getReasoningServiceSnapshot,
  startReasoningService,
  subscribeReasoningService,
  type ReasoningFabricHealth,
} from "../api/reasoningRegistry";
import DALNavigation from "./DALNavigation";
import { DALStateProvider, useDALState } from "./DALState";
import { TeralinxAuthProvider, useTeralinxAuth } from "../identity/TeralinxAuth";
import { listDemoScenarios, resetDemoTenant } from "../api/teralinxRuntime";
import { getDemoCustomerOrganization, getDemoPersona, setDemoCustomerOrganization, setDemoPersona, type DemoPersona } from "../api/authHeaders";

const CandidateSitesWorkspace = lazy(() => import("../workspaces/CandidateSitesWorkspace"));
const DALInventoryWorkspace = lazy(() => import("../workspaces/DALInventoryWorkspace"));
const DesignWorkspace = lazy(() => import("../components/workspaces/DesignWorkspace"));
const FieldWorkspace = lazy(() => import("../workspaces/FieldWorkspace"));
const GraphExtensionWorkspace = lazy(() => import("../workspaces/GraphExtensionWorkspace"));
const GraphViewerWorkspace = lazy(() => import("../workspaces/GraphViewerWorkspace"));
const GoogleRfpWorkspace = lazy(() => import("../components/workspaces/GoogleRfpWorkspace"));
const InventoryRecoveryWorkspace = lazy(() => import("../workspaces/InventoryRecoveryWorkspace"));
const ControlWorkspace = lazy(() => import("../workspaces/ControlWorkspace"));
const MarketplaceWorkspace = lazy(() => import("../workspaces/MarketplaceWorkspace"));
const NetworkAffinityWorkspace = lazy(() => import("../workspaces/NetworkAffinityWorkspace"));
const OperationalIntelligenceWorkspace = lazy(() => import("../workspaces/OperationalIntelligenceWorkspace"));
const PortfolioWorkspace = lazy(() => import("../workspaces/PortfolioWorkspace"));
const PreliminaryProposalWorkspace = lazy(() => import("../components/workspaces/PreliminaryProposalWorkspace"));
const ProposedNetworkWorkspace = lazy(() => import("../components/workspaces/ProposedNetworkWorkspace"));
const PrismWorkspace = lazy(() => import("../workspaces/PrismWorkspace"));
const PrismSiteDecisionWorkspace = lazy(() => import("../workspaces/PrismSiteDecisionWorkspace"));
const RouteEngineeringWorkspace = lazy(() => import("../workspaces/RouteEngineeringWorkspace"));
const ScopeVersionWorkspace = lazy(() => import("../workspaces/ScopeVersionWorkspace"));
const ServiceOrderWorkspace = lazy(() => import("../workspaces/ServiceOrderWorkspace"));
const TeralinxRouteWorkspace = lazy(() => import("../components/workspaces/TeralinxRouteWorkspace"));
const TranslateWorkspace = lazy(() => import("../workspaces/TranslateWorkspace"));
const TwinWorkspace = lazy(() => import("../workspaces/TwinWorkspace"));
const CustomerPortalWorkspace = lazy(() => import("../workspaces/CustomerPortalWorkspace"));
const CustomerWorkspace = lazy(() => import("../workspaces/CustomerWorkspace"));

function DALWorkspaceOutlet() {
  const { workspace } = useDALState();

  const body =
    workspace === "teralinxRoute" ? <TeralinxRouteWorkspace /> :
      workspace === "googleRfp" ? <GoogleRfpWorkspace /> :
        workspace === "inventory" ? <DALInventoryWorkspace /> :
          workspace === "inventoryRecovery" ? <InventoryRecoveryWorkspace /> :
            workspace === "graphViewer" ? <GraphViewerWorkspace /> :
              workspace === "graphExtensions" ? <GraphExtensionWorkspace /> :
                workspace === "design" ? <DesignWorkspace /> :
                  workspace === "proposedNetwork" ? <ProposedNetworkWorkspace /> :
                    workspace === "preliminaryProposal" ? <PreliminaryProposalWorkspace /> :
                      workspace === "serviceOrder" ? <ServiceOrderWorkspace /> :
                        workspace === "customerView" ? <CustomerWorkspace /> :
                        workspace === "prism" ? <PrismWorkspace /> :
                          workspace === "siteDecision" ? <PrismSiteDecisionWorkspace /> :
                            workspace === "routeEngineering" ? <RouteEngineeringWorkspace /> :
                              workspace === "scopeVersion" ? <ScopeVersionWorkspace /> :
                                workspace === "candidateSites" ? <CandidateSitesWorkspace /> :
                                  workspace === "networkAffinity" ? <NetworkAffinityWorkspace /> :
                                    workspace === "portfolio" ? <PortfolioWorkspace /> :
                                      workspace === "marketplace" ? <MarketplaceWorkspace /> :
                                        workspace === "control" ? <ControlWorkspace /> :
                                          workspace === "field" ? <FieldWorkspace /> :
                                            workspace === "twin" ? <TwinWorkspace /> :
                                              workspace === "ops" ? <OperationalIntelligenceWorkspace /> :
                                                <TranslateWorkspace />;

  return (
    <Suspense fallback={<div className="dal-panel dal-status">Loading workspace...</div>}>
      {body}
    </Suspense>
  );
}

function reasoningWorkspace(workspace: ReturnType<typeof useDALState>["workspace"]): ReasoningWorkspace {
  if (workspace === "teralinxRoute") return "translate";
  if (workspace === "googleRfp") return "marketplace";
  if (workspace === "design") return "marketplace";
  if (workspace === "proposedNetwork") return "translate";
  if (workspace === "preliminaryProposal") return "marketplace";
  if (workspace === "serviceOrder") return "marketplace";
  if (workspace === "customerView") return "marketplace";
  if (workspace === "graphViewer" || workspace === "graphExtensions" || workspace === "inventoryRecovery") return "graph-viewer";
  if (workspace === "siteDecision") return "prism";
  if (workspace === "routeEngineering") return "prism";
  if (workspace === "scopeVersion") return "operational-intelligence";
  if (workspace === "portfolio" || workspace === "candidateSites" || workspace === "networkAffinity") return "portfolio";
  if (workspace === "ops") return "operational-intelligence";
  return workspace;
}

function suggestedPrompts(workspace: ReturnType<typeof useDALState>["workspace"]) {
  if (workspace === "translate") return ["Explain what was extracted", "Which validation warnings matter?", "Suggest normalization corrections"];
  if (workspace === "teralinxRoute") return ["Summarize this route request", "What blocks Design readiness?", "Draft a customer route intake summary"];
  if (workspace === "googleRfp")
    return [
      "Summarize this commercial engagement",
      "What blocks customer acceptance?",
      "Explain the current proposal assumptions",
      "What must transfer to Engineering?",
    ];
  if (workspace === "proposedNetwork") return ["Explain this proposed network", "What should the customer review?", "What is still non-authoritative?"];
  if (workspace === "preliminaryProposal") return ["Explain this preliminary proposal", "What assumptions matter?", "What blocks Engineering Certification handoff?"];
  if (workspace === "serviceOrder")
    return [
      "Summarize Service Order readiness",
      "Which authority references are missing?",
      "Confirm no ScopeVersion is created",
    ];
  if (workspace === "customerView") return ["Summarize the selected governed deal", "What does the customer currently see?", "Which customer action is pending?"];
  if (workspace === "inventory") return ["Summarize this inventory graph", "Identify graph anomalies", "What should I inspect next?"];
  if (workspace === "inventoryRecovery") return ["Which graphs are browser only?", "What should be pushed to the server?", "Summarize sync failures"];
  if (workspace === "graphViewer") return ["Explain the selected graph context", "Summarize route structure", "Suggest extension candidates"];
  if (workspace === "graphExtensions")
    return [
      "Explain this extension.",
      "What assets are affected?",
      "What opportunities does this create?",
      "What risks exist?",
      "What additional infrastructure may be required?",
    ];
  if (workspace === "prism") return ["Explain this opportunity", "Why is serviceability green/yellow/red?", "Draft opportunity seed rationale"];
  if (workspace === "siteDecision")
    return [
      "Can this site be built?",
      "Should this become a signed-order candidate?",
      "Which risks drive this decision?",
      "Which permits are likely required?",
      "Recommend deployment sequencing.",
    ];
  if (workspace === "routeEngineering")
    return [
      "What blocks package certification?",
      "Which PD-001 checks need exceptions?",
      "Which constraints remain unresolved?",
      "Summarize object moves and redlines.",
      "What is ready for signed Service Order?",
    ];
  if (workspace === "scopeVersion")
    return [
      "Summarize ScopeVersion authority.",
      "What downstream approvals are pending?",
      "Explain the revision lineage.",
      "Which certified artifacts govern operations?",
    ];
  if (workspace === "portfolio")
    return [
      "Rank opportunities by ROI.",
      "Show opportunities with payback under 24 months.",
      "Identify best hyperscaler opportunities.",
      "Compare constructability between sites.",
      "Which permits are likely required?",
      "Recommend Phase 1 build plan.",
      "Explain why Site 112 ranks higher than Site 207.",
      "Identify clusters suitable for metro expansion.",
      "Identify routes likely to improve acquisition valuation.",
    ];
  if (workspace === "candidateSites")
    return [
      "Why is this site ranked highly?",
      "What are the best municipal opportunities?",
      "Show sites with payback under 24 months.",
      "Recommend a Phase 1 deployment plan.",
      "Explain why Site A outranks Site B.",
    ];
  if (workspace === "networkAffinity")
    return [
      "Explain why this site scored this way.",
      "Why was this attachment strategy selected?",
      "Explain the build path and route selection.",
      "Why is this site difficult to build?",
      "Why is this site highly constructible?",
      "Compare this candidate against the next best site.",
      "Recommend phase sequencing for this attachment.",
    ];
  if (workspace === "marketplace") return ["Explain NRC/MRC/TCV", "What pricing inputs are missing?", "Suggest quote refinements"];
  if (workspace === "control") return ["Explain work queue risk", "Why is work blocked or active?", "Suggest next human actions"];
  if (workspace === "field") return ["Validate closure completeness", "Explain what the tech is closing", "What field data is missing?"];
  if (workspace === "twin") return ["Explain current operational state", "Summarize timeline", "Explain open versus closed work"];
  if (workspace === "ops") return ["Summarize operational readiness", "What matters most now?", "Recommend deployment sequencing", "Explain permit backlog"];
  return ["Help me form design intent", "Explain design tradeoffs", "Draft a candidate scope narrative"];
}

function DALReasoningOutlet() {
  const {
    workspace,
    selectedExtension,
    selectedGraph,
    selectedGraphFeature,
    selectedInventoryId,
    selectedCandidateSite,
    selectedCandidateSiteId,
    selectedOpportunitySeed,
    selectedOpportunitySeedId,
    selectedNetworkAffinity,
    selectedScopeVersion,
    selectedScopeVersionId,
    selectedOpportunityId,
  } = useDALState();
  if (workspace === "routeEngineering") return null;
  const scopeTruth = selectedScopeVersion?.canonicalTruth as any;
  const scopeNetworkBasis = scopeTruth?.networkBasis;
  const scopeGeographicBasis = scopeTruth?.geographicBasis;
  const scopeEngineeringBasis = scopeTruth?.engineeringBasis;
  const scopeFinancialBasis = scopeTruth?.financialBasis;
  const scopeRiskBasis = scopeTruth?.riskBasis;
  return (
    <ReasoningPanel
      title="DAL Reasoning"
      workspace={reasoningWorkspace(workspace)}
      suggestedPrompts={suggestedPrompts(workspace)}
      context={{
        inventoryId: selectedInventoryId || selectedGraph?.inventoryId,
        graphId: selectedGraph?.graphId,
        extensionId: selectedExtension?.extensionId,
        scopeVersionId: selectedScopeVersionId || selectedGraph?.scopeVersionId,
        opportunityId: selectedOpportunityId,
        opportunitySeedId: selectedOpportunitySeedId || selectedOpportunitySeed?.id,
        candidateSiteId: selectedCandidateSiteId || selectedCandidateSite?.candidateId || selectedOpportunitySeed?.candidateSiteId,
        attachmentRouteId: scopeNetworkBasis?.routeId ?? selectedNetworkAffinity?.buildPath.routeId ?? selectedOpportunitySeed?.buildPath?.routeId ?? selectedOpportunitySeed?.nearestRouteId,
        attachmentNodeId: scopeNetworkBasis?.nodeId ?? selectedNetworkAffinity?.buildPath.nodeId ?? selectedOpportunitySeed?.buildPath?.nodeId ?? selectedOpportunitySeed?.nearestNodeId,
        attachmentStationId: scopeNetworkBasis?.stationId ?? selectedNetworkAffinity?.buildPath.stationId ?? selectedOpportunitySeed?.buildPath?.stationId ?? selectedOpportunitySeed?.nearestStationId,
        buildFeet: scopeEngineeringBasis?.buildFeet ?? selectedNetworkAffinity?.buildPath.buildFeet ?? selectedOpportunitySeed?.buildPath?.buildFeet ?? selectedOpportunitySeed?.distanceFeet,
        buildMiles: scopeEngineeringBasis?.buildMiles ?? selectedNetworkAffinity?.buildPath.buildMiles ?? selectedOpportunitySeed?.buildPath?.buildMiles ?? selectedOpportunitySeed?.buildMiles,
        constructionType: scopeEngineeringBasis?.constructionType ?? selectedNetworkAffinity?.constructionType ?? selectedOpportunitySeed?.constructionType ?? selectedOpportunitySeed?.buildPath?.constructionType,
        riskScore: scopeRiskBasis?.compositeRisk ?? selectedNetworkAffinity?.riskScore ?? selectedOpportunitySeed?.riskScore ?? selectedOpportunitySeed?.buildPath?.riskScore,
        constructabilityScore: scopeEngineeringBasis?.constructabilityScore ?? selectedNetworkAffinity?.constructabilityScore ?? selectedOpportunitySeed?.constructabilityScore,
        permitScore: selectedNetworkAffinity?.permitScore ?? selectedOpportunitySeed?.permitScore,
        parcelScore: selectedNetworkAffinity?.parcelScore ?? selectedOpportunitySeed?.parcelScore,
        roadAccessScore: selectedNetworkAffinity?.roadAccessScore ?? selectedOpportunitySeed?.roadAccessScore,
        crossingScore: selectedNetworkAffinity?.crossingScore ?? selectedOpportunitySeed?.crossingScore,
        environmentalRisk: scopeRiskBasis?.environmentalRisk ?? selectedNetworkAffinity?.constructabilityAssessment?.environmentalRisk ?? selectedOpportunitySeed?.environmentalRisk,
        utilityConflictRisk: selectedNetworkAffinity?.constructabilityAssessment?.utilityConflictRisk ?? selectedOpportunitySeed?.utilityConflictRisk,
        estimatedCost: scopeFinancialBasis?.estimatedConstructionCost ?? selectedNetworkAffinity?.estimatedCost ?? selectedOpportunitySeed?.buildCost ?? selectedOpportunitySeed?.buildPath?.estimatedCost,
        estimatedPayback: scopeFinancialBasis?.payback ?? selectedNetworkAffinity?.estimatedPayback ?? selectedOpportunitySeed?.paybackMonths,
        selectedFeature: selectedGraphFeature,
        extensionSummary: selectedScopeVersion?.canonicalTruth?.extensionSummary,
        opportunitySeeds: selectedOpportunitySeed ? [selectedOpportunitySeed] : undefined,
        networkAffinity: selectedNetworkAffinity ?? selectedOpportunitySeed?.networkAffinity,
        attachmentStrategy: selectedNetworkAffinity?.preferredStrategy ?? selectedOpportunitySeed?.attachmentStrategy,
        buildPath: scopeGeographicBasis?.buildPath ?? selectedNetworkAffinity?.buildPath ?? selectedOpportunitySeed?.buildPath,
        constructabilityAssessment: selectedScopeVersion?.constructability ?? selectedNetworkAffinity?.constructabilityAssessment ?? selectedOpportunitySeed?.constructabilityAssessment,
        permitRequirements: scopeEngineeringBasis?.permits ?? selectedNetworkAffinity?.constructabilityAssessment?.permitting ?? selectedOpportunitySeed?.constructabilityAssessment?.permitting,
        crossingInventory: scopeEngineeringBasis?.crossings ?? {
          rail: selectedNetworkAffinity?.constructabilityAssessment?.rail ?? selectedOpportunitySeed?.constructabilityAssessment?.rail,
          water: selectedNetworkAffinity?.constructabilityAssessment?.water ?? selectedOpportunitySeed?.constructabilityAssessment?.water,
        },
        capacityStatus: scopeNetworkBasis?.capacityStatus ?? selectedNetworkAffinity?.capacity.projectedUtilization ?? selectedOpportunitySeed?.capacityStatus,
        scopeVersionContext: selectedScopeVersion,
        scopeVersionBasis: {
          graphReference: scopeTruth?.graphReference,
          networkBasis: scopeNetworkBasis,
          geographicBasis: scopeGeographicBasis,
          engineeringBasis: scopeEngineeringBasis,
          financialBasis: scopeFinancialBasis,
          riskBasis: scopeRiskBasis,
          decisionBasis: scopeTruth?.decisionBasis,
        },
        portfolioSummary: selectedScopeVersion?.canonicalTruth?.portfolioMetrics,
        portfolioMetrics: selectedScopeVersion?.canonicalTruth?.portfolioMetrics,
        phasePlan: selectedScopeVersion?.canonicalTruth?.phasePlan,
        metadata: selectedGraph?.metadata,
        validation: selectedGraph?.validation,
      }}
    />
  );
}

function RuntimeDiagnosticsDisclosure() {
  const [open, setOpen] = useState(false);
  const { workspace } = useDALState();
  return (
    <details
      className="dal-runtime-diagnostics-disclosure"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>{workspace === "routeEngineering" ? "Technical Diagnostics" : "Runtime Diagnostics"}</summary>
      {open ? <RuntimeDiagnosticsPanel /> : null}
    </details>
  );
}

function DALShell() {
  const [reasoningHealth, setReasoningHealth] = useState<ReasoningFabricHealth>(() => getReasoningServiceSnapshot());
  const [navigationOpen, setNavigationOpen] = useState(false);
  const { session, runtimeInfo, logout } = useTeralinxAuth();
  const [demoResetStatus, setDemoResetStatus] = useState("");
  const [demoScenarios, setDemoScenarios] = useState<Array<{ scenarioId: string; name: string }>>([]);
  const [demoScenarioId, setDemoScenarioId] = useState("DEMO-SCENARIO-DCI");
  const [demoPersona, updateDemoPersona] = useState<DemoPersona>(() => getDemoPersona());
  const [demoCustomerOrganization, updateDemoCustomerOrganization] = useState(() => getDemoCustomerOrganization());
  const { workspace } = useDALState();
  useEffect(() => {
    const unsubscribe = subscribeReasoningService(setReasoningHealth);
    startReasoningService();
    return unsubscribe;
  }, []);
  useEffect(() => {
    if (!navigationOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setNavigationOpen(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [navigationOpen]);
  const reasoningEndpoint = reasoningHealth.activeEndpoint ?? reasoningHealth.endpoints[0];
  const isDemo = session?.user.authorityClass === "DEMO" && session.user.organizationId === "org-demo";
  const externalCustomer = session?.user.authorityClass === "DEMO" && session.user.organizationId.startsWith("org-demo-customer-");
  const customerView = externalCustomer || (isDemo && demoPersona.startsWith("CUSTOMER_"));
  useEffect(() => { if (isDemo) void listDemoScenarios().then(setDemoScenarios).catch(() => setDemoScenarios([])); }, [isDemo]);
  function choosePersona(value: DemoPersona) {
    setDemoPersona(value); updateDemoPersona(value);
  }
  function chooseCustomerOrganization(value: string) {
    setDemoCustomerOrganization(value); updateDemoCustomerOrganization(value);
  }
  const demoPerspectiveSelector = (
    <label className="demo-perspective-selector">
      <span>Demo perspective</span>
      <select aria-label="Demo perspective" value={demoPersona} onChange={(event) => choosePersona(event.currentTarget.value as DemoPersona)}>
        <option value="SALES">Sales</option>
        <option value="ENGINEERING">Engineering</option>
        <option value="CUSTOMER_VIEWER">Customer Viewer</option>
        <option value="CUSTOMER_COMMERCIAL_REVIEWER">Customer Commercial Reviewer</option>
        <option value="CUSTOMER_AUTHORIZED_SIGNER">Customer Authorized Signer</option>
        <option value="EXECUTIVE">Executive</option>
      </select>
    </label>
  );
  async function resetDemo() {
    if (!isDemo || !window.confirm("Reset only the isolated Demo tenant to its approved seed state? The current Demo run will be archived.")) return;
    setDemoResetStatus("Resetting Demo...");
    try {
      await resetDemoTenant(demoScenarioId);
      setDemoResetStatus("Demo reset complete. Reloading...");
      window.location.reload();
    } catch (error) {
      setDemoResetStatus(error instanceof Error ? error.message : String(error));
    }
  }
  if (customerView) return (
    <div className="demo-experience-shell">
      {isDemo ? <div className="demo-persona-bar">
        {demoPerspectiveSelector}
        <select value={demoCustomerOrganization} onChange={(event) => chooseCustomerOrganization(event.currentTarget.value)}>
          <option value="org-demo-customer-a">Northstar Cloud Infrastructure</option><option value="org-demo-customer-b">Blue Mesa Digital Systems</option>
        </select>
        <span>Customer Portal · actor remains demo-principal · simulated capability only</span>
      </div> : null}
      <Suspense fallback={<div className="dal-status">Opening customer portal...</div>}><CustomerPortalWorkspace key={`${demoPersona}:${demoCustomerOrganization}`} /></Suspense>
    </div>
  );
  return (
    <div className="dal-shell">
      <header className="dal-header">
        <div>
          <div className="dal-kicker">TERALINX</div>
          <h1>{DAL_APP_NAME}</h1>
          <button className="dal-navigation-trigger" type="button" aria-expanded={navigationOpen} aria-controls="dal-workspace-navigation" onClick={() => setNavigationOpen((open) => !open)}>☰ Workspaces</button>
        </div>
        <div className="dal-targets">
          <span>User: {session?.user.name} / {session?.user.title} / {session?.user.role}</span>
          <span>Workspace: {session?.user.workspaceId ?? session?.workspace?.workspaceId ?? "unassigned"} / Principal: {session?.user.principalId ?? "anonymous"}</span>
          <span>Organization: {session?.user.organization ?? runtimeInfo?.organization ?? "Teralinx"} / Membership: {session?.user.membershipId ?? "unassigned"}</span>
          <span>Authority: {isDemo ? "DEMO — NOT PRODUCTION ELIGIBLE" : "PRODUCTION"}</span>
          <span>Runtime Version: {runtimeInfo?.runtimeVersion ?? "loading"} / Commit: {runtimeInfo?.gitCommit ?? "loading"}</span>
          <span>Build Date: {runtimeInfo?.buildDate ?? "loading"} / Environment: {runtimeInfo?.environment ?? "alpha"}</span>
          <span>DAL API: {DAL_API}</span>
          <span>Baseline Graph API: {DAL_BASELINE_GRAPH_API}</span>
          <span>Inventory API: {DAL_INVENTORY_GRAPH_API}</span>
          {workspace !== "routeEngineering" ? <span>Reasoning: {reasoningHealth.reasoningEnabled ? reasoningHealth.serviceStatus : "DISABLED"} / {reasoningEndpoint ? endpointBaseUrl(reasoningEndpoint) : "not configured"} / Circuit: {reasoningHealth.circuitBreakerState}</span> : null}
          {isDemo ? <button className="dal-header-signout" type="button" onClick={() => void resetDemo()}>Reset Demo</button> : null}
          {isDemo ? <select value={demoScenarioId} onChange={(event) => setDemoScenarioId(event.currentTarget.value)}>{demoScenarios.map((scenario) => <option key={scenario.scenarioId} value={scenario.scenarioId}>{scenario.name}</option>)}</select> : null}
          {demoResetStatus ? <span>{demoResetStatus}</span> : null}
          <button className="dal-header-signout" type="button" onClick={() => void logout()}>Sign Out</button>
        </div>
      </header>
      {isDemo ? <nav className="demo-primary-perspective" aria-label="Demo perspective navigation">
        {demoPerspectiveSelector}
        <span>Switch workflow perspective without changing the authenticated demo-principal actor.</span>
      </nav> : null}
      <div className="dal-layout">
        {navigationOpen ? <button type="button" className="dal-nav-backdrop" aria-label="Close workspace navigation" onClick={() => setNavigationOpen(false)} /> : null}
        <div id="dal-workspace-navigation"><DALNavigation open={navigationOpen} onClose={() => setNavigationOpen(false)} /></div>
        <main className="dal-main">
          <DALWorkspaceOutlet />
          <RuntimeDiagnosticsDisclosure />
          <DALReasoningOutlet />
        </main>
      </div>
    </div>
  );
}

function TeralinxAuthenticatedRuntime() {
  return (
    <DALStateProvider>
      <DALShell />
    </DALStateProvider>
  );
}

export default function DALApp() {
  return (
    <TeralinxAuthProvider>
      <TeralinxAuthenticatedRuntime />
    </TeralinxAuthProvider>
  );
}
