import {
  DAL_REASONING_ENDPOINTS,
  DAL_REASONING_FALLBACK_API,
  DAL_REASONING_FALLBACK_MODEL,
  DAL_REASONING_LEGACY_API,
  DAL_REASONING_PRIMARY_API,
  DAL_REASONING_PRIMARY_MODEL,
  DAL_REASONING_SECONDARY_API,
  DAL_REASONING_SECONDARY_MODEL,
} from "../config/dalApi";

// Reasoning fabric discovery is runtime support only.
// Endpoint health and model outputs are non-authoritative until validated into ScopeVersion truth.
export type ReasoningHealthStatus = "ONLINE" | "DEGRADED" | "OFFLINE";

export type ReasoningCapability =
  | "GRAPH_ANALYSIS"
  | "PRISM_ANALYSIS"
  | "TRANSLATION"
  | "AFFINITY"
  | "SYNTHESIS"
  | "INVENTORY_VALIDATION"
  | "SCOPEVERSION_CERTIFICATION"
  | "GENERAL_REASONING";

export type ReasoningEndpointPriority = "PRIMARY" | "SECONDARY" | "FALLBACK" | "LEGACY" | "DISCOVERED";
export type ReasoningEndpointType = "DAL_REASONING" | "OPENAI_COMPATIBLE" | "UNKNOWN";

export type ReasoningEndpoint = {
  endpointId: string;
  name: string;
  host: string;
  port: number;
  protocol: string;
  modelName: string;
  modelId?: string;
  provider?: string;
  maxContext?: number;
  endpointType?: ReasoningEndpointType;
  healthStatus: ReasoningHealthStatus;
  latencyMs: number;
  capabilities: string[];
  priority?: ReasoningEndpointPriority;
  lastCheck?: string;
  baseUrl?: string;
  failures?: number;
};

export type ReasoningEndpointDiagnostic = {
  endpoint: ReasoningEndpoint;
  testUrl: string;
  dns: "CONFIGURED" | "INVALID_HOST" | "BROWSER_DELEGATED";
  tcpReachability: "REACHABLE" | "UNREACHABLE" | "BROWSER_INFERRED";
  healthCheck: "PASS" | "WARNING" | "FAIL";
  latencyMs: number;
  response?: unknown;
  error?: string;
  checkedAt: string;
};

export type ReasoningFabricHealth = {
  endpoints: ReasoningEndpoint[];
  diagnostics: ReasoningEndpointDiagnostic[];
  activeEndpoint?: ReasoningEndpoint;
  onlineModels: string[];
  offlineModels: string[];
  failures: number;
  checkedAt: string;
};

const LEGACY_REASONING_HEALTH_PATH = "/api/reasoning/health";
const STANDARD_HEALTH_PATH = "/health";
const OPENAI_MODELS_PATH = "/v1/models";
const REQUEST_TIMEOUT_MS = 6000;

const DEFAULT_GPU_CAPABILITIES: ReasoningCapability[] = [
  "GRAPH_ANALYSIS",
  "PRISM_ANALYSIS",
  "TRANSLATION",
  "AFFINITY",
  "SYNTHESIS",
  "GENERAL_REASONING",
];

const DAL_TRUTH_CAPABILITIES: ReasoningCapability[] = ["INVENTORY_VALIDATION", "SCOPEVERSION_CERTIFICATION"];

type EndpointConfigInput = Partial<ReasoningEndpoint> & {
  url?: string;
  api?: string;
};

function cleanBase(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "reasoning";
}

function parseCapabilities(value: unknown, fallback = DEFAULT_GPU_CAPABILITIES): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string" && value.trim()) return value.split(/[,\s|]+/).map((item) => item.trim()).filter(Boolean);
  return fallback;
}

function parseEndpointUrl(value: string, priority: ReasoningEndpointPriority, index: number, input?: EndpointConfigInput): ReasoningEndpoint | null {
  const base = cleanBase(value);
  if (!base) return null;
  try {
    const parsed = new URL(base);
    const protocol = parsed.protocol.replace(":", "") || "http";
    const port = Number(parsed.port || (protocol === "https" ? 443 : 80));
    const name = input?.name ?? `${priority}-${parsed.hostname}:${port}`;
    return {
      endpointId: input?.endpointId ?? `${slug(priority)}-${slug(name)}-${index}`,
      name,
      host: input?.host ?? parsed.hostname,
      port: Number(input?.port ?? port),
      protocol: input?.protocol ?? protocol,
      modelName: input?.modelName ?? "unknown",
      modelId: input?.modelId,
      provider: input?.provider,
      maxContext: input?.maxContext,
      endpointType: input?.endpointType ?? "UNKNOWN",
      healthStatus: "OFFLINE",
      latencyMs: 0,
      capabilities: parseCapabilities(input?.capabilities),
      priority,
      baseUrl: base,
      failures: 0,
    };
  } catch {
    return null;
  }
}

function endpointFromInput(input: EndpointConfigInput, priority: ReasoningEndpointPriority, index: number): ReasoningEndpoint | null {
  const url = input.url ?? input.api ?? input.baseUrl;
  if (url) return parseEndpointUrl(url, priority, index, input);
  if (!input.host) return null;
  const protocol = input.protocol ?? "http";
  const port = Number(input.port ?? 8000);
  const baseUrl = `${protocol}://${input.host}:${port}`;
  return {
    endpointId: input.endpointId ?? `${slug(priority)}-${slug(input.name ?? input.host)}-${index}`,
    name: input.name ?? `${priority}-${input.host}:${port}`,
    host: input.host,
    port,
    protocol,
    modelName: input.modelName ?? "unknown",
    modelId: input.modelId,
    provider: input.provider,
    maxContext: input.maxContext,
    endpointType: input.endpointType ?? "UNKNOWN",
    healthStatus: "OFFLINE",
    latencyMs: 0,
    capabilities: parseCapabilities(input.capabilities),
    priority,
    baseUrl,
    failures: 0,
  };
}

function parseJsonRegistry(value: string): ReasoningEndpoint[] {
  if (!value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    const items = Array.isArray(parsed) ? parsed : parsed?.endpoints;
    if (!Array.isArray(items)) return [];
    return items
      .map((item, index) => endpointFromInput(item, item.priority ?? "DISCOVERED", index))
      .filter((endpoint): endpoint is ReasoningEndpoint => Boolean(endpoint));
  } catch {
    return [];
  }
}

function parseDelimitedRegistry(value: string): ReasoningEndpoint[] {
  if (!value.trim() || value.trim().startsWith("[") || value.trim().startsWith("{")) return [];
  return value
    .split(/[;\n]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item, index) => parseEndpointUrl(item, "DISCOVERED", index))
    .filter((endpoint): endpoint is ReasoningEndpoint => Boolean(endpoint));
}

function dedupe(endpoints: ReasoningEndpoint[]) {
  const byBaseUrl = new Map<string, ReasoningEndpoint>();
  endpoints.forEach((endpoint) => {
    const key = endpoint.baseUrl ?? `${endpoint.protocol}://${endpoint.host}:${endpoint.port}`;
    if (!byBaseUrl.has(key)) byBaseUrl.set(key, endpoint);
  });
  return Array.from(byBaseUrl.values());
}

export function getReasoningEndpointCandidates(): ReasoningEndpoint[] {
  const registry = [...parseJsonRegistry(DAL_REASONING_ENDPOINTS), ...parseDelimitedRegistry(DAL_REASONING_ENDPOINTS)];
  const envEndpoints = [
    parseEndpointUrl(DAL_REASONING_PRIMARY_API, "PRIMARY", 0, { name: "Primary Reasoning", modelName: DAL_REASONING_PRIMARY_MODEL }),
    parseEndpointUrl(DAL_REASONING_SECONDARY_API, "SECONDARY", 1, { name: "Secondary Reasoning", modelName: DAL_REASONING_SECONDARY_MODEL }),
    parseEndpointUrl(DAL_REASONING_FALLBACK_API, "FALLBACK", 2, { name: "Fallback Reasoning", modelName: DAL_REASONING_FALLBACK_MODEL }),
    parseEndpointUrl(DAL_REASONING_LEGACY_API, "LEGACY", 3),
  ].filter((endpoint): endpoint is ReasoningEndpoint => Boolean(endpoint));
  return dedupe([...envEndpoints, ...registry]);
}

export function endpointBaseUrl(endpoint: ReasoningEndpoint) {
  return endpoint.baseUrl ?? `${endpoint.protocol}://${endpoint.host}:${endpoint.port}`;
}

function healthStatusFor(responseOk: boolean, parsed: any): ReasoningHealthStatus {
  if (!responseOk) return "OFFLINE";
  if (parsed?.providerReachable === false || parsed?.dryRun === true || parsed?.status === "degraded") return "DEGRADED";
  return "ONLINE";
}

type ProbeResult = {
  path: string;
  url: string;
  ok: boolean;
  latencyMs: number;
  status?: number;
  statusText?: string;
  body?: any;
  error?: string;
};

async function probeEndpoint(baseUrl: string, path: string): Promise<ProbeResult> {
  const startedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
  const url = `${baseUrl}${path}`;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });
    const text = await response.text().catch(() => "");
    const body = text
      ? (() => {
          try {
            return JSON.parse(text);
          } catch {
            return { raw: text };
          }
        })()
      : {};
    return {
      path,
      url,
      ok: response.ok,
      latencyMs: Math.round((typeof performance !== "undefined" ? performance.now() : Date.now()) - startedAt),
      status: response.status,
      statusText: response.statusText,
      body,
    };
  } catch (err: any) {
    return {
      path,
      url,
      ok: false,
      latencyMs: Math.round((typeof performance !== "undefined" ? performance.now() : Date.now()) - startedAt),
      error: err?.name === "AbortError" ? "Request timed out." : err?.message ?? String(err),
    };
  } finally {
    window.clearTimeout(timeout);
  }
}

function firstOpenAiModel(models: any) {
  const data = Array.isArray(models?.data) ? models.data : [];
  if (data.length) return data[0];
  if (models?.id) return models;
  if (models?.model) return { id: models.model, ...models };
  return undefined;
}

function contextFromModel(model: any) {
  const value = Number(
    model?.maxContext ??
      model?.max_context ??
      model?.maxContextLength ??
      model?.max_context_length ??
      model?.contextLength ??
      model?.context_length ??
      model?.max_model_len
  );
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function endpointWithDiscovery(endpoint: ReasoningEndpoint, args: {
  checkedAt: string;
  healthStatus: ReasoningHealthStatus;
  latencyMs: number;
  healthBody?: any;
  modelBody?: any;
}) {
  const model = firstOpenAiModel(args.modelBody);
  const modelId = model?.id ?? args.healthBody?.modelId ?? args.healthBody?.model ?? args.healthBody?.modelName ?? endpoint.modelId ?? endpoint.modelName;
  const provider = args.modelBody ? "vLLM" : args.healthBody?.provider ?? endpoint.provider;
  const endpointType: ReasoningEndpointType = args.modelBody ? "OPENAI_COMPATIBLE" : args.healthBody ? "DAL_REASONING" : endpoint.endpointType ?? "UNKNOWN";
  const discovered: ReasoningEndpoint = {
    ...endpoint,
    modelName: modelId ?? endpoint.modelName,
    modelId,
    provider,
    maxContext: contextFromModel(model) ?? args.healthBody?.maxContext ?? endpoint.maxContext,
    endpointType,
    healthStatus: args.healthStatus,
    latencyMs: args.latencyMs,
    lastCheck: args.checkedAt,
    failures: args.healthStatus === "OFFLINE" ? Number(endpoint.failures ?? 0) + 1 : 0,
  };
  if (args.healthStatus !== "OFFLINE") {
    console.info("REASONING ENDPOINT DISCOVERED", {
      endpoint: endpointBaseUrl(discovered),
      status: discovered.healthStatus,
      endpointType: discovered.endpointType,
    });
    console.info("MODEL DISCOVERED", {
      modelId: discovered.modelId,
      modelName: discovered.modelName,
      maxContext: discovered.maxContext,
    });
    console.info("PROVIDER DISCOVERED", {
      provider: discovered.provider,
      endpointType: discovered.endpointType,
    });
  }
  return discovered;
}

export async function testReasoningEndpoint(endpoint: ReasoningEndpoint): Promise<ReasoningEndpointDiagnostic> {
  const checkedAt = new Date().toISOString();
  const baseUrl = endpointBaseUrl(endpoint);
  const healthProbe = await probeEndpoint(baseUrl, STANDARD_HEALTH_PATH);
  const modelProbe = await probeEndpoint(baseUrl, OPENAI_MODELS_PATH);
  const legacyProbe = healthProbe.ok || modelProbe.ok ? undefined : await probeEndpoint(baseUrl, LEGACY_REASONING_HEALTH_PATH);
  const successfulProbe = modelProbe.ok ? modelProbe : healthProbe.ok ? healthProbe : legacyProbe?.ok ? legacyProbe : undefined;
  const healthBody = healthProbe.ok ? healthProbe.body : legacyProbe?.ok ? legacyProbe.body : undefined;
  const healthStatus = modelProbe.ok ? "ONLINE" : healthProbe.ok ? "ONLINE" : legacyProbe?.ok ? healthStatusFor(true, legacyProbe.body) : "OFFLINE";
  const latencyMs = successfulProbe?.latencyMs ?? Math.min(healthProbe.latencyMs, modelProbe.latencyMs, legacyProbe?.latencyMs ?? Number.MAX_SAFE_INTEGER);
  const discovered = endpointWithDiscovery(endpoint, {
    checkedAt,
    healthStatus,
    latencyMs,
    healthBody,
    modelBody: modelProbe.ok ? modelProbe.body : undefined,
  });
  const response = {
    health: healthProbe.ok ? healthProbe.body : healthProbe.error ?? `${healthProbe.status ?? ""} ${healthProbe.statusText ?? ""}`.trim(),
    models: modelProbe.ok ? modelProbe.body : modelProbe.error ?? `${modelProbe.status ?? ""} ${modelProbe.statusText ?? ""}`.trim(),
    legacyHealth: legacyProbe ? (legacyProbe.ok ? legacyProbe.body : legacyProbe.error ?? `${legacyProbe.status ?? ""} ${legacyProbe.statusText ?? ""}`.trim()) : undefined,
  };

  return {
    endpoint: discovered,
    testUrl: successfulProbe?.url ?? modelProbe.url,
    dns: endpoint.host ? "BROWSER_DELEGATED" : "INVALID_HOST",
    tcpReachability: successfulProbe ? "REACHABLE" : "UNREACHABLE",
    healthCheck: healthStatus === "ONLINE" ? "PASS" : healthStatus === "DEGRADED" ? "WARNING" : "FAIL",
    latencyMs,
    response,
    error: successfulProbe ? undefined : modelProbe.error ?? healthProbe.error ?? legacyProbe?.error,
    checkedAt,
  };
}

export async function loadReasoningRegistryHealth(): Promise<ReasoningFabricHealth> {
  const candidates = getReasoningEndpointCandidates();
  const checkedAt = new Date().toISOString();
  const diagnostics = await Promise.all(candidates.map((endpoint) => testReasoningEndpoint(endpoint)));
  const endpoints = diagnostics.map((diagnostic) => diagnostic.endpoint);
  const activeEndpoint = endpoints.find((endpoint) => endpoint.healthStatus === "ONLINE") ?? endpoints.find((endpoint) => endpoint.healthStatus === "DEGRADED");
  return {
    endpoints,
    diagnostics,
    activeEndpoint,
    onlineModels: endpoints.filter((endpoint) => endpoint.healthStatus === "ONLINE").map((endpoint) => endpoint.modelName),
    offlineModels: endpoints.filter((endpoint) => endpoint.healthStatus === "OFFLINE").map((endpoint) => endpoint.modelName),
    failures: endpoints.filter((endpoint) => endpoint.healthStatus === "OFFLINE").length,
    checkedAt,
  };
}

export async function resolveReasoningEndpoint(capability?: ReasoningCapability | string) {
  const health = await loadReasoningRegistryHealth();
  const capabilityMatches = (endpoint: ReasoningEndpoint) =>
    !capability || endpoint.capabilities.includes(capability) || endpoint.capabilities.includes("GENERAL_REASONING");
  const active =
    health.endpoints.find((endpoint) => endpoint.healthStatus === "ONLINE" && capabilityMatches(endpoint)) ??
    health.endpoints.find((endpoint) => endpoint.healthStatus === "DEGRADED" && capabilityMatches(endpoint));
  if (!active) {
    const configured = health.endpoints.length;
    throw new Error(
      configured
        ? `No reachable reasoning endpoint supports ${capability ?? "GENERAL_REASONING"}.`
        : "No reasoning endpoints configured. Set VITE_DAL_REASONING_ENDPOINTS or VITE_DAL_REASONING_PRIMARY_API."
    );
  }
  return active;
}

export async function requestReasoningWithFailover<T>(path: string, init?: RequestInit, capability?: ReasoningCapability | string): Promise<T> {
  const health = await loadReasoningRegistryHealth();
  const candidates = health.endpoints.filter(
    (endpoint) =>
      endpoint.healthStatus !== "OFFLINE" &&
      (!capability || endpoint.capabilities.includes(capability) || endpoint.capabilities.includes("GENERAL_REASONING"))
  );
  const failures: string[] = [];
  for (const endpoint of candidates) {
    const url = `${endpointBaseUrl(endpoint)}${path}`;
    try {
      const response = await fetch(url, init);
      const text = await response.text().catch(() => "");
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}${text ? `: ${text}` : ""}`);
      return (text ? JSON.parse(text) : {}) as T;
    } catch (err) {
      failures.push(`${endpoint.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  throw new Error(failures.length ? `Reasoning fabric unavailable. ${failures.join(" | ")}` : "Reasoning fabric unavailable. No reachable endpoint candidates.");
}

export const REASONING_WORKLOAD_ROUTES: Array<{
  workload: string;
  preferredCapabilities: ReasoningCapability[];
  preferredLayer: "GPU" | "DAL1";
}> = [
  { workload: "Graph Analysis", preferredCapabilities: ["GRAPH_ANALYSIS"], preferredLayer: "GPU" },
  { workload: "Prism", preferredCapabilities: ["PRISM_ANALYSIS"], preferredLayer: "GPU" },
  { workload: "Translation", preferredCapabilities: ["TRANSLATION"], preferredLayer: "GPU" },
  { workload: "Affinity", preferredCapabilities: ["AFFINITY"], preferredLayer: "GPU" },
  { workload: "Inventory Validation", preferredCapabilities: DAL_TRUTH_CAPABILITIES.slice(0, 1), preferredLayer: "DAL1" },
  { workload: "ScopeVersion Certification", preferredCapabilities: DAL_TRUTH_CAPABILITIES.slice(1), preferredLayer: "DAL1" },
];
