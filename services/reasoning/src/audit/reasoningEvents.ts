import type { ReasoningTrace } from "../schemas.js";

const traces: ReasoningTrace[] = [];

export function addReasoningTrace(trace: ReasoningTrace) {
  traces.unshift(trace);
  if (traces.length > 1000) traces.pop();
}

export function listReasoningTraces() {
  return traces;
}

export function getReasoningTrace(reasoningId: string) {
  return traces.find((trace) => trace.reasoningId === reasoningId) ?? null;
}

