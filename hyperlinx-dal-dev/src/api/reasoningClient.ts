import { DAL_REASONING_API } from "../config/dalApi";

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
  const res = await fetch(`${DAL_REASONING_API}/api/reasoning/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}${text ? `: ${text}` : ""}`);
  return JSON.parse(text) as ReasoningResponse;
}

export async function loadReasoningHealth() {
  const res = await fetch(`${DAL_REASONING_API}/api/reasoning/health`);
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}${text ? `: ${text}` : ""}`);
  return JSON.parse(text) as { status: "ok"; mode: string; model: string; providerReachable: boolean; dryRun: boolean };
}
