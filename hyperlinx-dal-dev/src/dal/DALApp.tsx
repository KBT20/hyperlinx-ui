import { DAL_API, DAL_APP_NAME, DAL_BASELINE_GRAPH_API, DAL_INVENTORY_GRAPH_API } from "../config/dalApi";
import ReasoningPanel from "../components/ReasoningPanel";
import type { ReasoningWorkspace } from "../api/reasoningClient";
import { endpointBaseUrl, getReasoningEndpointCandidates } from "../api/reasoningRegistry";
import CandidateSitesWorkspace from "../workspaces/CandidateSitesWorkspace";
import DALInventoryWorkspace from "../workspaces/DALInventoryWorkspace";
import DALPlaceholderWorkspace from "../workspaces/DALPlaceholderWorkspace";
import FieldWorkspace from "../workspaces/FieldWorkspace";
import GraphExtensionWorkspace from "../workspaces/GraphExtensionWorkspace";
import GraphViewerWorkspace from "../workspaces/GraphViewerWorkspace";
import InventoryRecoveryWorkspace from "../workspaces/InventoryRecoveryWorkspace";
import ControlWorkspace from "../workspaces/ControlWorkspace";
import MarketplaceWorkspace from "../workspaces/MarketplaceWorkspace";
import NetworkAffinityWorkspace from "../workspaces/NetworkAffinityWorkspace";
import OperationalIntelligenceWorkspace from "../workspaces/OperationalIntelligenceWorkspace";
import PortfolioWorkspace from "../workspaces/PortfolioWorkspace";
import PrismWorkspace from "../workspaces/PrismWorkspace";
import PrismSiteDecisionWorkspace from "../workspaces/PrismSiteDecisionWorkspace";
import TranslateWorkspace from "../workspaces/TranslateWorkspace";
import TwinWorkspace from "../workspaces/TwinWorkspace";
import DALNavigation from "./DALNavigation";
import { DALStateProvider, useDALState } from "./DALState";

function DALWorkspaceOutlet() {
  const { workspace } = useDALState();

  if (workspace === "inventory") return <DALInventoryWorkspace />;
  if (workspace === "inventoryRecovery") return <InventoryRecoveryWorkspace />;
  if (workspace === "graphViewer") return <GraphViewerWorkspace />;
  if (workspace === "graphExtensions") return <GraphExtensionWorkspace />;
  if (workspace === "design") return <DALPlaceholderWorkspace title="Design" />;
  if (workspace === "prism") return <PrismWorkspace />;
  if (workspace === "siteDecision") return <PrismSiteDecisionWorkspace />;
  if (workspace === "candidateSites") return <CandidateSitesWorkspace />;
  if (workspace === "networkAffinity") return <NetworkAffinityWorkspace />;
  if (workspace === "portfolio") return <PortfolioWorkspace />;
  if (workspace === "marketplace") return <MarketplaceWorkspace />;
  if (workspace === "control") return <ControlWorkspace />;
  if (workspace === "field") return <FieldWorkspace />;
  if (workspace === "twin") return <TwinWorkspace />;
  if (workspace === "ops") return <OperationalIntelligenceWorkspace />;
  return <TranslateWorkspace />;
}

function reasoningWorkspace(workspace: ReturnType<typeof useDALState>["workspace"]): ReasoningWorkspace {
  if (workspace === "graphViewer" || workspace === "graphExtensions" || workspace === "inventoryRecovery") return "graph-viewer";
  if (workspace === "siteDecision") return "prism";
  if (workspace === "portfolio" || workspace === "candidateSites" || workspace === "networkAffinity") return "portfolio";
  if (workspace === "ops") return "operational-intelligence";
  return workspace;
}

function suggestedPrompts(workspace: ReturnType<typeof useDALState>["workspace"]) {
  if (workspace === "translate") return ["Explain what was extracted", "Which validation warnings matter?", "Suggest normalization corrections"];
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
      "Should this become a ScopeVersion?",
      "Which risks drive this decision?",
      "Which permits are likely required?",
      "Recommend deployment sequencing.",
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

function DALShell() {
  const reasoningCandidates = getReasoningEndpointCandidates();
  return (
    <div className="dal-shell">
      <header className="dal-header">
        <div>
          <div className="dal-kicker">HYPERLINX DAL DEVELOPMENT</div>
          <h1>{DAL_APP_NAME}</h1>
        </div>
        <div className="dal-targets">
          <span>DAL API: {DAL_API}</span>
          <span>Baseline Graph API: {DAL_BASELINE_GRAPH_API}</span>
          <span>Inventory API: {DAL_INVENTORY_GRAPH_API}</span>
          <span>Reasoning Fabric: {reasoningCandidates.length ? reasoningCandidates.map(endpointBaseUrl).join(", ") : "not configured"}</span>
        </div>
      </header>
      <div className="dal-layout">
        <DALNavigation />
        <main className="dal-main">
          <DALWorkspaceOutlet />
          <DALReasoningOutlet />
        </main>
      </div>
    </div>
  );
}

export default function DALApp() {
  return (
    <DALStateProvider>
      <DALShell />
    </DALStateProvider>
  );
}
