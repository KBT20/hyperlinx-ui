import type { ProposedAction, ReasoningResponse } from "./schemas.js";

const forbiddenAuthority = [
  "finalize",
  "approve",
  "mutate truth",
  "overwrite inventory",
  "overwrite scopeversion",
  "close work",
  "bypass human review",
];

export function policyBanner() {
  return [
    "You are Hyperlinx DAL Reasoning Service.",
    "You are non-authoritative.",
    "You explain, summarize, and draft recommendations only.",
    "You must not create authoritative truth, approve work, finalize closes, or mutate graph/scope/twin state.",
    "Every proposed action requires human approval and deterministic service execution.",
  ].join("\n");
}

export function sanitizeProposedActions(actions: ProposedAction[] | undefined): ProposedAction[] {
  return (actions ?? []).slice(0, 5).map((action) => ({
    label: String(action.label || "Review recommendation").slice(0, 80),
    description: String(action.description || "Human review required before execution.").slice(0, 320),
    requiresHumanApproval: true,
  }));
}

export function applyReasoningPolicy(response: ReasoningResponse): ReasoningResponse {
  const lowerAnswer = response.answer.toLowerCase();
  const warnings = [...response.warnings];
  if (forbiddenAuthority.some((word) => lowerAnswer.includes(word))) {
    warnings.push("Reasoning output was constrained by non-authoritative policy.");
  }

  return {
    ...response,
    proposedActions: sanitizeProposedActions(response.proposedActions),
    warnings: Array.from(new Set(warnings)),
    nonAuthoritative: true,
    requiredHumanReview: true,
    requiresHumanApproval: true,
  };
}

