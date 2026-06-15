import { createHash } from "node:crypto";
import type { ReasoningRequest } from "./schemas.js";

const sensitiveKeys = new Set(["password", "token", "secret", "apiKey", "authorization", "cookie"]);

function compactValue(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[Max depth]";
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return {
      kind: "array-summary",
      count: value.length,
      sample: value.slice(0, 5).map((item) => compactValue(item, depth + 1)),
    };
  }

  const output: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (sensitiveKeys.has(key.toLowerCase())) {
      output[key] = "[redacted]";
    } else {
      output[key] = compactValue(child, depth + 1);
    }
  }
  return output;
}

export function buildInputReferences(request: ReasoningRequest) {
  return Object.entries(request.context)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${key}:${typeof value === "object" ? "provided" : String(value)}`);
}

export function buildCompactContext(request: ReasoningRequest) {
  return {
    workspace: request.workspace,
    intent: request.intent,
    inputReferences: buildInputReferences(request),
    context: compactValue(request.context),
  };
}

export function hashText(text: string) {
  return createHash("sha256").update(text).digest("hex");
}

