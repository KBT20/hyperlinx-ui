import { requestReasoningWithFailover, resolveReasoningEndpoint } from "./reasoningRegistry";

// Runtime / AI guardrail: reasoning fabric output is bounded synthesis only.
// Mistral, vLLM, and future models may propose candidate truth, but cannot mutate ScopeVersions.
export type ReasoningWorkspace =
  | "translate"
  | "inventory"
  | "graph-viewer"
  | "design"
  | "prism"
  | "portfolio"
  | "marketplace"
  | "control"
  | "field"
  | "twin"
  | "operational-intelligence";

export type ReasoningContext = {
  inventoryId?: string;
  graphId?: string;
  extensionId?: string;
  scopeVersionId?: string;
  opportunityId?: string;
  opportunitySeedId?: string;
  candidateSiteId?: string;
  attachmentRouteId?: string;
  attachmentNodeId?: string;
  attachmentStationId?: string;
  buildFeet?: number;
  buildMiles?: number;
  constructionType?: string;
  riskScore?: number;
  constructabilityScore?: number;
  permitScore?: number;
  parcelScore?: number;
  roadAccessScore?: number;
  crossingScore?: number;
  environmentalRisk?: number;
  utilityConflictRisk?: number;
  estimatedCost?: number;
  estimatedPayback?: number;
  quoteId?: string;
  workItemId?: string;
  closureId?: string;
  twinStateId?: string;
  scopeVersionContext?: unknown;
  scopeVersionBasis?: unknown;
  selectedFeature?: unknown;
  extensionSummary?: unknown;
  opportunitySeeds?: unknown;
  networkAffinity?: unknown;
  attachmentStrategy?: unknown;
  buildPath?: unknown;
  constructabilityAssessment?: unknown;
  permitRequirements?: unknown;
  crossingInventory?: unknown;
  capacityStatus?: unknown;
  portfolioSummary?: unknown;
  portfolioMetrics?: unknown;
  phasePlan?: unknown;
  validation?: unknown;
  metadata?: unknown;
};

export type ReasoningResponse = {
  reasoningId: string;
  workspace: ReasoningWorkspace;
  intent: string;
  answer: string;
  summary: string;
  recommendations: string[];
  proposedActions: Array<{ label: string; description: string; requiresHumanApproval: true }>;
  warnings: string[];
  confidence: number;
  limitations: string[];
  inputReferences: string[];
  nonAuthoritative: true;
  requiredHumanReview: true;
  requiresHumanApproval: true;
  providerReachable: boolean;
  dryRun: boolean;
  createdAt: string;
};

export async function queryReasoning(args: {
  workspace: ReasoningWorkspace;
  intent: string;
  userPrompt: string;
  context: ReasoningContext;
}) {
  return requestReasoningWithFailover<ReasoningResponse>("/api/reasoning/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  }, "GENERAL_REASONING");
}

export async function loadReasoningHealth() {
  const activeEndpoint = await resolveReasoningEndpoint("GENERAL_REASONING");
  return {
    status: activeEndpoint.healthStatus,
    mode: activeEndpoint.priority ?? "DISCOVERED",
    model: activeEndpoint.modelName,
    providerReachable: activeEndpoint.healthStatus === "ONLINE",
    dryRun: activeEndpoint.healthStatus === "DEGRADED",
    endpoint: activeEndpoint,
  };
}
