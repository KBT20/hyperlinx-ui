import { DAL_API, DAL_BASELINE_GRAPH_API, DAL_REASONING_API } from "../config/dalApi";

export type DalConnectivityKey = "dal" | "baseline" | "reasoning";

export type DalConnectivityResult = {
  key: DalConnectivityKey;
  label: string;
  endpoint: string;
  testUrl: string;
  reachable: boolean;
  responseTimeMs: number;
  statusCode?: number;
  statusText?: string;
  checkedAt: string;
  error?: string;
};

const CONNECTIVITY_TARGETS: Array<{
  key: DalConnectivityKey;
  label: string;
  endpoint: string;
  path: string;
}> = [
  {
    key: "dal",
    label: "DAL API",
    endpoint: DAL_API,
    path: "/api/baseline-graphs",
  },
  {
    key: "baseline",
    label: "Baseline Graph API",
    endpoint: DAL_BASELINE_GRAPH_API,
    path: "/api/baseline-graphs",
  },
  {
    key: "reasoning",
    label: "Reasoning API",
    endpoint: DAL_REASONING_API,
    path: "/api/reasoning/health",
  },
];

function buildUrl(endpoint: string, path: string) {
  return `${endpoint.replace(/\/+$/, "")}${path}`;
}

async function testTarget(target: (typeof CONNECTIVITY_TARGETS)[number]): Promise<DalConnectivityResult> {
  const startedAt = performance.now();
  const checkedAt = new Date().toISOString();
  const testUrl = buildUrl(target.endpoint, target.path);
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 6000);

  try {
    const response = await fetch(testUrl, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });
    const responseTimeMs = Math.round(performance.now() - startedAt);
    return {
      key: target.key,
      label: target.label,
      endpoint: target.endpoint,
      testUrl,
      reachable: response.ok,
      responseTimeMs,
      statusCode: response.status,
      statusText: response.statusText,
      checkedAt,
    };
  } catch (err: any) {
    return {
      key: target.key,
      label: target.label,
      endpoint: target.endpoint,
      testUrl,
      reachable: false,
      responseTimeMs: Math.round(performance.now() - startedAt),
      checkedAt,
      error: err?.name === "AbortError" ? "Request timed out." : err?.message ?? String(err),
    };
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function testDalConnectivity() {
  return Promise.all(CONNECTIVITY_TARGETS.map((target) => testTarget(target)));
}

export async function testBaselineGraphConnectivity() {
  const result = await testTarget(CONNECTIVITY_TARGETS.find((target) => target.key === "baseline")!);
  if (!result.reachable) {
    throw new Error(
      `Baseline Graph API is not reachable at ${result.endpoint}. ${result.statusCode ? `${result.statusCode} ${result.statusText ?? ""}` : result.error ?? ""}`.trim()
    );
  }
  return result;
}
