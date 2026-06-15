import { randomUUID } from "node:crypto";
import { hashText } from "../contextBuilder.js";
import type { ReasoningTrace, ReasoningWorkspace } from "../schemas.js";

export function createReasoningId() {
  return `reasoning-${randomUUID()}`;
}

export function buildReasoningTrace(args: {
  reasoningId: string;
  workspace: ReasoningWorkspace;
  intent: string;
  inputReferences: string[];
  model: string;
  promptText: string;
  responseText: string;
  providerReachable: boolean;
  dryRun: boolean;
}): ReasoningTrace {
  return {
    reasoningId: args.reasoningId,
    workspace: args.workspace,
    intent: args.intent,
    inputReferences: args.inputReferences,
    model: args.model,
    promptHash: hashText(args.promptText),
    responseHash: hashText(args.responseText),
    createdAt: new Date().toISOString(),
    nonAuthoritative: true,
    providerReachable: args.providerReachable,
    dryRun: args.dryRun,
  };
}

