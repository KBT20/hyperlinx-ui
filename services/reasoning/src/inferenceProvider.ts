import type { HealthResponse, ReasoningRequest } from "./schemas.js";

export type InferenceResult = {
  text: string;
  providerReachable: boolean;
  dryRun: boolean;
  model: string;
};

const VLLM_BASE_URL = (process.env.VLLM_BASE_URL || "http://127.0.0.1:8000/v1").replace(/\/+$/, "");
const VLLM_MODEL = process.env.VLLM_MODEL || "mistral";
const VLLM_API_KEY = process.env.VLLM_API_KEY || "";
const REASONING_MODE = process.env.REASONING_MODE || "local";

export function configuredModel() {
  return VLLM_MODEL;
}

function dryRunText(request: ReasoningRequest) {
  return [
    `Dry-run reasoning for ${request.workspace}.`,
    `Intent: ${request.intent}.`,
    "The inference provider is unavailable, so this deterministic placeholder summarizes likely next review steps.",
    "Review referenced IDs, inspect validation warnings, and use deterministic DAL services for any state change.",
  ].join("\n");
}

export async function callInferenceProvider(messages: Array<{ role: "system" | "user"; content: string }>, request: ReasoningRequest): Promise<InferenceResult> {
  if (REASONING_MODE === "dry-run") {
    return { text: dryRunText(request), providerReachable: false, dryRun: true, model: VLLM_MODEL };
  }

  try {
    const res = await fetch(`${VLLM_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(VLLM_API_KEY ? { Authorization: `Bearer ${VLLM_API_KEY}` } : {}),
      },
      body: JSON.stringify({
        model: VLLM_MODEL,
        messages,
        temperature: 0.2,
        max_tokens: 1200,
      }),
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const data = (await res.json()) as any;
    const text = String(data?.choices?.[0]?.message?.content ?? "").trim();
    if (!text) throw new Error("Empty inference response.");
    return { text, providerReachable: true, dryRun: false, model: VLLM_MODEL };
  } catch {
    return { text: dryRunText(request), providerReachable: false, dryRun: true, model: VLLM_MODEL };
  }
}

export async function providerHealth(): Promise<HealthResponse> {
  try {
    const res = await fetch(`${VLLM_BASE_URL}/models`, {
      headers: VLLM_API_KEY ? { Authorization: `Bearer ${VLLM_API_KEY}` } : undefined,
    });
    return {
      status: "ok",
      mode: REASONING_MODE,
      model: VLLM_MODEL,
      providerReachable: res.ok,
      dryRun: !res.ok || REASONING_MODE === "dry-run",
    };
  } catch {
    return {
      status: "ok",
      mode: REASONING_MODE,
      model: VLLM_MODEL,
      providerReachable: false,
      dryRun: true,
    };
  }
}

