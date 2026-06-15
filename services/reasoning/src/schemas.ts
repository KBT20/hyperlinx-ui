export const workspaces = [
  "translate",
  "inventory",
  "graph-viewer",
  "design",
  "prism",
  "portfolio",
  "marketplace",
  "control",
  "field",
  "twin",
  "operational-intelligence",
] as const;

export type ReasoningWorkspace = (typeof workspaces)[number];

export type ReasoningContext = {
  inventoryId?: string;
  graphId?: string;
  scopeVersionId?: string;
  opportunityId?: string;
  opportunitySeedId?: string;
  candidateSiteId?: string;
  quoteId?: string;
  workItemId?: string;
  closureId?: string;
  twinStateId?: string;
  selectedFeature?: unknown;
  opportunitySeeds?: unknown;
  networkAffinity?: unknown;
  attachmentStrategy?: unknown;
  buildPath?: unknown;
  capacityStatus?: unknown;
  portfolioSummary?: unknown;
  portfolioMetrics?: unknown;
  phasePlan?: unknown;
  extensionSummary?: unknown;
  validation?: unknown;
  metadata?: unknown;
};

export type ReasoningRequest = {
  workspace: ReasoningWorkspace;
  intent: string;
  userPrompt: string;
  context: ReasoningContext;
};

export type ProposedAction = {
  label: string;
  description: string;
  requiresHumanApproval: true;
};

export type ReasoningResponse = {
  reasoningId: string;
  workspace: ReasoningWorkspace;
  intent: string;
  answer: string;
  summary: string;
  recommendations: string[];
  proposedActions: ProposedAction[];
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

export type ReasoningTrace = {
  reasoningId: string;
  workspace: ReasoningWorkspace;
  intent: string;
  inputReferences: string[];
  model: string;
  promptHash: string;
  responseHash: string;
  createdAt: string;
  nonAuthoritative: true;
  providerReachable: boolean;
  dryRun: boolean;
};

export type HealthResponse = {
  status: "ok";
  mode: string;
  model: string;
  providerReachable: boolean;
  dryRun: boolean;
};

export function isReasoningWorkspace(value: unknown): value is ReasoningWorkspace {
  return typeof value === "string" && (workspaces as readonly string[]).includes(value);
}

export function validateReasoningRequest(value: any): ReasoningRequest {
  if (!value || typeof value !== "object") throw new Error("Request body must be an object.");
  if (!isReasoningWorkspace(value.workspace)) throw new Error("Invalid workspace.");
  if (typeof value.intent !== "string" || !value.intent.trim()) throw new Error("intent is required.");
  if (typeof value.userPrompt !== "string" || !value.userPrompt.trim()) throw new Error("userPrompt is required.");
  return {
    workspace: value.workspace,
    intent: value.intent.trim(),
    userPrompt: value.userPrompt.trim(),
    context: value.context && typeof value.context === "object" ? value.context : {},
  };
}
