import { randomUUID } from "node:crypto";
import { inventoryAdapter } from "./adapters/inventoryAdapter.js";
import { controlAdapter } from "./adapters/controlAdapter.js";
import { fieldAdapter } from "./adapters/fieldAdapter.js";
import { marketplaceAdapter } from "./adapters/marketplaceAdapter.js";
import { prismAdapter } from "./adapters/prismAdapter.js";
import { twinAdapter } from "./adapters/twinAdapter.js";
import { addReasoningTrace } from "./audit/reasoningEvents.js";
import { buildReasoningTrace, createReasoningId } from "./audit/reasoningTrace.js";
import { buildCompactContext, buildInputReferences } from "./contextBuilder.js";
import { callInferenceProvider } from "./inferenceProvider.js";
import { applyReasoningPolicy } from "./policy.js";
import { workspacePrompt } from "./prompts/index.js";
import { systemPrompt } from "./prompts/system.js";
import type { ProposedAction, ReasoningRequest, ReasoningResponse } from "./schemas.js";

function workspaceAdapter(request: ReasoningRequest) {
  if (request.workspace === "translate" || request.workspace === "inventory" || request.workspace === "graph-viewer") return inventoryAdapter(request.context);
  if (request.workspace === "prism" || request.workspace === "portfolio") return prismAdapter(request.context);
  if (request.workspace === "marketplace") return marketplaceAdapter(request.context);
  if (request.workspace === "control") return controlAdapter(request.context);
  if (request.workspace === "field") return fieldAdapter(request.context);
  if (request.workspace === "twin" || request.workspace === "operational-intelligence") return twinAdapter(request.context);
  return {};
}

function recommendationsFor(request: ReasoningRequest, dryRun: boolean) {
  const base = [
    "Review the referenced deterministic records before taking action.",
    "Use DAL/IOF services for any state change; do not treat reasoning text as truth.",
  ];
  if (dryRun) base.unshift("Inference provider is unavailable; treat this as deterministic dry-run guidance.");
  if (request.workspace === "field") base.push("Check station, footage, crew, date, and notes before submitting a closure.");
  if (request.workspace === "prism") base.push("Confirm nearest asset distance and threshold before creating an Opportunity Seed.");
  if (request.workspace === "portfolio") base.push("Confirm portfolio rank, payback, capex, and phase plan assumptions before promoting work.");
  if (request.workspace === "marketplace") base.push("Confirm pricing assumptions before saving or sharing a quote.");
  return base;
}

function actionsFor(request: ReasoningRequest): ProposedAction[] {
  return [
    {
      label: "Review deterministic source records",
      description: `Open the referenced ${request.workspace} records and confirm the reasoning matches the DAL state.`,
      requiresHumanApproval: true,
    },
    {
      label: "Prepare next deterministic action",
      description: "Use the relevant DAL workspace button or API after human review. Reasoning does not execute actions.",
      requiresHumanApproval: true,
    },
  ];
}

function compactAnswer(text: string) {
  return text.trim() || "No reasoning text was produced.";
}

export async function runReasoning(request: ReasoningRequest): Promise<ReasoningResponse> {
  const reasoningId = createReasoningId();
  const compactContext = buildCompactContext(request);
  const adapterSummary = workspaceAdapter(request);
  const inputReferences = buildInputReferences(request);
  const promptText = [
    systemPrompt,
    workspacePrompt(request.workspace),
    `Workspace: ${request.workspace}`,
    `Intent: ${request.intent}`,
    `User prompt: ${request.userPrompt}`,
    `Compact context: ${JSON.stringify(compactContext)}`,
    `Adapter summary: ${JSON.stringify(adapterSummary)}`,
    "Respond with concise paragraphs and bullets. Include limitations and human review requirements.",
  ].join("\n\n");

  const inference = await callInferenceProvider(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: promptText },
    ],
    request
  );

  const createdAt = new Date().toISOString();
  const response = applyReasoningPolicy({
    reasoningId,
    workspace: request.workspace,
    intent: request.intent,
    answer: compactAnswer(inference.text),
    summary: compactAnswer(inference.text).split("\n")[0]?.slice(0, 320) || "Reasoning summary unavailable.",
    recommendations: recommendationsFor(request, inference.dryRun),
    proposedActions: actionsFor(request),
    warnings: ["Reasoning is non-authoritative.", "Human approval is required for every proposed action."],
    confidence: inference.providerReachable ? 0.68 : 0.35,
    limitations: [
      "Context was compacted before inference.",
      "Large graph payloads are represented by references and summaries.",
      "Reasoning cannot mutate inventory, ScopeVersion, closures, or Twin state.",
    ],
    inputReferences,
    nonAuthoritative: true,
    requiredHumanReview: true,
    requiresHumanApproval: true,
    providerReachable: inference.providerReachable,
    dryRun: inference.dryRun,
    createdAt,
  });

  addReasoningTrace(
    buildReasoningTrace({
      reasoningId,
      workspace: request.workspace,
      intent: request.intent,
      inputReferences,
      model: inference.model,
      promptText,
      responseText: response.answer,
      providerReachable: inference.providerReachable,
      dryRun: inference.dryRun,
    })
  );

  return response;
}

export function createEventId() {
  return `reasoning-event-${randomUUID()}`;
}
