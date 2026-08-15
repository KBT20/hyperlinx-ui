import {
  DAL_REASONING_ENABLED,
  DAL_REASONING_ENDPOINTS,
  DAL_REASONING_FALLBACK_API,
  DAL_REASONING_FALLBACK_MODEL,
  DAL_REASONING_LEGACY_API,
  DAL_REASONING_PRIMARY_API,
  DAL_REASONING_PRIMARY_MODEL,
  DAL_REASONING_SECONDARY_API,
  DAL_REASONING_SECONDARY_MODEL,
} from "../config/dalApi";

// Kernel-owned advisory reasoning service.
// Workspaces consume this cached capability state and never probe model endpoints directly.
export const REASONING_SERVICE_MANAGER_AUTHORITY = "STELLAOS_KERNEL_REASONING_SERVICE_MANAGER";
export const REASONING_SERVICE_MANAGER_VERSION = "36.0";

export type ReasoningServiceStatus = "ONLINE" | "OFFLINE" | "DEGRADED" | "STARTING";
export type ReasoningHealthStatus = ReasoningServiceStatus;
export type ReasoningCircuitBreakerState = "CLOSED" | "OPEN" | "HALF_OPEN" | "DISABLED";

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
export type ReasoningProviderKind = "LOCAL_MISTRAL" | "OPENAI" | "ANTHROPIC" | "OLLAMA" | "DISABLED" | "CUSTOM";

export type ReasoningEndpoint = {
  endpointId: string;
  name: string;
  host: string;
  port: number;
  protocol: string;
  modelName: string;
  modelId?: string;
  provider?: string;
  providerKind?: ReasoningProviderKind;
  maxContext?: number;
  endpointType?: ReasoningEndpointType;
  healthStatus: ReasoningHealthStatus;
  latencyMs: number;
  capabilities: string[];
  priority?: ReasoningEndpointPriority;
  lastCheck?: string;
  baseUrl?: string;
  failures?: number;
  availableModels?: string[];
  defaultModel?: string;
  embeddingModel?: string;
  reasoningModel?: string;
  endpointVersion?: string;
  lastSuccessfulProbe?: string;
  lastFailure?: string;
  retryAfter?: string;
  retryAfterSeconds?: number;
  circuitBreakerState?: ReasoningCircuitBreakerState;
};

export type ReasoningEndpointDiagnostic = {
  endpoint: ReasoningEndpoint;
  testUrl: string;
  dns: "CONFIGURED" | "INVALID_HOST" | "BROWSER_DELEGATED";
  tcpReachability: "REACHABLE" | "UNREACHABLE" | "BROWSER_INFERRED";
  healthCheck: "PASS" | "WARNING" | "FAIL" | "SKIPPED";
  latencyMs: number;
  response?: unknown;
  error?: string;
  checkedAt: string;
  circuitBreakerState: ReasoningCircuitBreakerState;
  retryAfterSeconds?: number;
};

export type ReasoningProviderConfiguration = {
  providerId: string;
  label: string;
  providerKind: ReasoningProviderKind;
  priority: ReasoningEndpointPriority;
  endpoint?: ReasoningEndpoint;
  enabled: boolean;
};

export type ReasoningFabricHealth = {
  authority: typeof REASONING_SERVICE_MANAGER_AUTHORITY;
  serviceStatus: ReasoningServiceStatus;
  circuitBreakerState: ReasoningCircuitBreakerState;
  reasoningEnabled: boolean;
  endpoints: ReasoningEndpoint[];
  diagnostics: ReasoningEndpointDiagnostic[];
  activeEndpoint?: ReasoningEndpoint;
  onlineModels: string[];
  offlineModels: string[];
  availableModels: string[];
  defaultModel?: string;
  embeddingModel?: string;
  reasoningModel?: string;
  endpointCapabilities: string[];
  failures: number;
  checkedAt: string;
  lastSuccessfulProbe?: string;
  lastFailure?: string;
  retryAfter?: string;
  retryCountdownSeconds?: number;
  providerConfigurations: ReasoningProviderConfiguration[];
};

type EndpointConfigInput = Partial<ReasoningEndpoint> & {
  url?: string;
  api?: string;
};

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

type EndpointCircuitState = {
  failureCount: number;
  lastSuccessfulProbe?: string;
  lastFailure?: string;
  retryAfter?: string;
  retryAfterMs: number;
  circuitBreakerState: ReasoningCircuitBreakerState;
  unavailableLogged: boolean;
  cachedEndpoint?: ReasoningEndpoint;
};

const LEGACY_REASONING_HEALTH_PATH = "/api/reasoning/health";
const STANDARD_HEALTH_PATH = "/health";
const OPENAI_MODELS_PATH = "/v1/models";
const REQUEST_TIMEOUT_MS = 6000;
const RETRY_BACKOFF_MS = [60_000, 120_000, 300_000, 600_000] as const;
const MAXIMUM_RETRY_FREQUENCY_MS = 300_000;

const DEFAULT_GPU_CAPABILITIES: ReasoningCapability[] = [
  "GRAPH_ANALYSIS",
  "PRISM_ANALYSIS",
  "TRANSLATION",
  "AFFINITY",
  "SYNTHESIS",
  "GENERAL_REASONING",
];

const DAL_TRUTH_CAPABILITIES: ReasoningCapability[] = ["INVENTORY_VALIDATION", "SCOPEVERSION_CERTIFICATION"];

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

function providerKindFor(input?: EndpointConfigInput): ReasoningProviderKind {
  const provider = String(input?.providerKind ?? input?.provider ?? input?.name ?? "").toUpperCase();
  if (provider.includes("OPENAI")) return "OPENAI";
  if (provider.includes("ANTHROPIC")) return "ANTHROPIC";
  if (provider.includes("OLLAMA")) return "OLLAMA";
  if (provider.includes("MISTRAL") || provider.includes("PRIMARY")) return "LOCAL_MISTRAL";
  if (provider.includes("DISABLED")) return "DISABLED";
  return input?.providerKind ?? "CUSTOM";
}

function parseEndpointUrl(value: string, priority: ReasoningEndpointPriority, index: number, input?: EndpointConfigInput): ReasoningEndpoint | null {
  const base = cleanBase(value);
  if (!base) return null;
  try {
    const parsed = new URL(base);
    const protocol = parsed.protocol.replace(":", "") || "http";
    const port = Number(parsed.port || (protocol === "https" ? 443 : 80));
    const name = input?.name ?? `${priority}-${parsed.hostname}:${port}`;
    const providerKind = providerKindFor(input ?? { name });
    return {
      endpointId: input?.endpointId ?? `${slug(priority)}-${slug(name)}-${index}`,
      name,
      host: input?.host ?? parsed.hostname,
      port: Number(input?.port ?? port),
      protocol: input?.protocol ?? protocol,
      modelName: input?.modelName ?? "unknown",
      modelId: input?.modelId,
      provider: input?.provider ?? (providerKind === "LOCAL_MISTRAL" ? "Local Mistral" : providerKind),
      providerKind,
      maxContext: input?.maxContext,
      endpointType: input?.endpointType ?? "UNKNOWN",
      healthStatus: "OFFLINE",
      latencyMs: 0,
      capabilities: parseCapabilities(input?.capabilities),
      priority,
      baseUrl: base,
      failures: 0,
      circuitBreakerState: "CLOSED",
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
  const providerKind = providerKindFor(input);
  return {
    endpointId: input.endpointId ?? `${slug(priority)}-${slug(input.name ?? input.host)}-${index}`,
    name: input.name ?? `${priority}-${input.host}:${port}`,
    host: input.host,
    port,
    protocol,
    modelName: input.modelName ?? "unknown",
    modelId: input.modelId,
    provider: input.provider ?? (providerKind === "LOCAL_MISTRAL" ? "Local Mistral" : providerKind),
    providerKind,
    maxContext: input.maxContext,
    endpointType: input.endpointType ?? "UNKNOWN",
    healthStatus: "OFFLINE",
    latencyMs: 0,
    capabilities: parseCapabilities(input.capabilities),
    priority,
    baseUrl,
    failures: 0,
    circuitBreakerState: "CLOSED",
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
    .map((item, index) => parseEndpointUrl(item, "DISCOVERED", index, { providerKind: "CUSTOM" }))
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

export function endpointBaseUrl(endpoint: ReasoningEndpoint) {
  return endpoint.baseUrl ?? `${endpoint.protocol}://${endpoint.host}:${endpoint.port}`;
}

export function getReasoningEndpointCandidates(): ReasoningEndpoint[] {
  const registry = [...parseJsonRegistry(DAL_REASONING_ENDPOINTS), ...parseDelimitedRegistry(DAL_REASONING_ENDPOINTS)];
  const envEndpoints = [
    parseEndpointUrl(DAL_REASONING_PRIMARY_API, "PRIMARY", 0, { name: "Local Mistral (Primary)", modelName: DAL_REASONING_PRIMARY_MODEL, providerKind: "LOCAL_MISTRAL" }),
    parseEndpointUrl(DAL_REASONING_SECONDARY_API, "SECONDARY", 1, { name: "OpenAI", modelName: DAL_REASONING_SECONDARY_MODEL, providerKind: "OPENAI" }),
    parseEndpointUrl(DAL_REASONING_FALLBACK_API, "FALLBACK", 2, { name: "Anthropic", modelName: DAL_REASONING_FALLBACK_MODEL, providerKind: "ANTHROPIC" }),
    parseEndpointUrl(DAL_REASONING_LEGACY_API, "LEGACY", 3, { name: "Ollama", providerKind: "OLLAMA" }),
  ].filter((endpoint): endpoint is ReasoningEndpoint => Boolean(endpoint));
  return dedupe([...envEndpoints, ...registry]);
}

function providerConfigurations(endpoints = getReasoningEndpointCandidates()): ReasoningProviderConfiguration[] {
  const byKind = new Map<ReasoningProviderKind, ReasoningEndpoint>();
  endpoints.forEach((endpoint) => {
    if (!byKind.has(endpoint.providerKind ?? "CUSTOM")) byKind.set(endpoint.providerKind ?? "CUSTOM", endpoint);
  });
  return [
    { providerId: "local-mistral", label: "Local Mistral (Primary)", providerKind: "LOCAL_MISTRAL", priority: "PRIMARY", endpoint: byKind.get("LOCAL_MISTRAL"), enabled: Boolean(byKind.get("LOCAL_MISTRAL")) },
    { providerId: "openai", label: "OpenAI", providerKind: "OPENAI", priority: "SECONDARY", endpoint: byKind.get("OPENAI"), enabled: Boolean(byKind.get("OPENAI")) },
    { providerId: "anthropic", label: "Anthropic", providerKind: "ANTHROPIC", priority: "FALLBACK", endpoint: byKind.get("ANTHROPIC"), enabled: Boolean(byKind.get("ANTHROPIC")) },
    { providerId: "ollama", label: "Ollama", providerKind: "OLLAMA", priority: "LEGACY", endpoint: byKind.get("OLLAMA"), enabled: Boolean(byKind.get("OLLAMA")) },
    { providerId: "disabled", label: "Disabled", providerKind: "DISABLED", priority: "DISCOVERED", enabled: !reasoningEnabledFromDeveloperMode() },
  ];
}

export function getReasoningProviderConfigurations() {
  return providerConfigurations();
}

function healthStatusFor(responseOk: boolean, parsed: any): ReasoningHealthStatus {
  if (!responseOk) return "OFFLINE";
  if (parsed?.providerReachable === false || parsed?.dryRun === true || parsed?.status === "degraded") return "DEGRADED";
  return "ONLINE";
}

function firstOpenAiModel(models: any) {
  const data = Array.isArray(models?.data) ? models.data : [];
  if (data.length) return data[0];
  if (models?.id) return models;
  if (models?.model) return { id: models.model, ...models };
  return undefined;
}

function openAiModelIds(models: any): string[] {
  const data = Array.isArray(models?.data) ? models.data : [];
  if (data.length) return data.map((model: any) => String(model?.id ?? model?.model ?? "")).filter(Boolean);
  const single = firstOpenAiModel(models);
  return single ? [String(single.id ?? single.model ?? "")].filter(Boolean) : [];
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

function endpointVersionFrom(healthBody: any, modelBody: any) {
  return String(
    healthBody?.version ??
      healthBody?.endpointVersion ??
      healthBody?.serviceVersion ??
      modelBody?.version ??
      modelBody?.object ??
      ""
  ).trim() || undefined;
}

function nowIso() {
  return new Date().toISOString();
}

function nowMs() {
  return Date.now();
}

function retryAfterMsForFailure(failureCount: number) {
  const raw = RETRY_BACKOFF_MS[Math.min(Math.max(failureCount - 1, 0), RETRY_BACKOFF_MS.length - 1)];
  return Math.max(raw, failureCount > 2 ? MAXIMUM_RETRY_FREQUENCY_MS : raw);
}

function secondsUntil(iso?: string) {
  if (!iso) return undefined;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - nowMs()) / 1000));
}

function reasonerStorage() {
  try {
    return typeof window !== "undefined" ? window.localStorage : undefined;
  } catch {
    return undefined;
  }
}

function reasoningEnabledFromDeveloperMode() {
  const storageValue = reasonerStorage()?.getItem("stellaos.reasoningEnabled");
  if (storageValue === "false") return false;
  if (storageValue === "true") return true;
  return DAL_REASONING_ENABLED;
}

function emptyHealth(status: ReasoningServiceStatus, enabled = reasoningEnabledFromDeveloperMode()): ReasoningFabricHealth {
  const endpoints = enabled ? getReasoningEndpointCandidates() : [];
  return {
    authority: REASONING_SERVICE_MANAGER_AUTHORITY,
    serviceStatus: enabled ? status : "OFFLINE",
    circuitBreakerState: enabled ? "CLOSED" : "DISABLED",
    reasoningEnabled: enabled,
    endpoints,
    diagnostics: [],
    onlineModels: [],
    offlineModels: endpoints.map((endpoint) => endpoint.modelName),
    availableModels: [],
    endpointCapabilities: [],
    failures: endpoints.length,
    checkedAt: nowIso(),
    providerConfigurations: providerConfigurations(endpoints),
  };
}

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

function endpointWithDiscovery(endpoint: ReasoningEndpoint, args: {
  checkedAt: string;
  healthStatus: ReasoningHealthStatus;
  latencyMs: number;
  healthBody?: any;
  modelBody?: any;
  circuitState?: EndpointCircuitState;
}) {
  const model = firstOpenAiModel(args.modelBody);
  const availableModels = openAiModelIds(args.modelBody);
  const modelId = model?.id ?? args.healthBody?.modelId ?? args.healthBody?.model ?? args.healthBody?.modelName ?? endpoint.modelId ?? endpoint.modelName;
  const provider = args.modelBody ? "vLLM" : args.healthBody?.provider ?? endpoint.provider;
  const endpointType: ReasoningEndpointType = args.modelBody ? "OPENAI_COMPATIBLE" : args.healthBody ? "DAL_REASONING" : endpoint.endpointType ?? "UNKNOWN";
  return {
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
    availableModels,
    defaultModel: availableModels[0] ?? modelId ?? endpoint.modelName,
    reasoningModel: modelId ?? availableModels[0] ?? endpoint.modelName,
    embeddingModel: args.healthBody?.embeddingModel,
    endpointVersion: endpointVersionFrom(args.healthBody, args.modelBody),
    lastSuccessfulProbe: args.circuitState?.lastSuccessfulProbe,
    lastFailure: args.circuitState?.lastFailure,
    retryAfter: args.circuitState?.retryAfter,
    retryAfterSeconds: secondsUntil(args.circuitState?.retryAfter),
    circuitBreakerState: args.circuitState?.circuitBreakerState ?? "CLOSED",
  } satisfies ReasoningEndpoint;
}

export class ReasoningServiceManagerClass {
  private state: ReasoningFabricHealth = emptyHealth("STARTING");
  private started = false;
  private probePromise: Promise<ReasoningFabricHealth> | null = null;
  private subscribers = new Set<(health: ReasoningFabricHealth) => void>();
  private endpointCircuit = new Map<string, EndpointCircuitState>();

  start() {
    if (this.started) return this.state;
    this.started = true;
    this.state = emptyHealth("STARTING");
    this.publish();
    if (this.state.reasoningEnabled) {
      void this.refresh({ source: "startup" });
    }
    return this.state;
  }

  subscribe(callback: (health: ReasoningFabricHealth) => void) {
    this.subscribers.add(callback);
    callback(this.state);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  getHealth() {
    return this.withUpdatedRetryCountdown(this.state);
  }

  setReasoningEnabled(enabled: boolean) {
    reasonerStorage()?.setItem("stellaos.reasoningEnabled", String(enabled));
    this.endpointCircuit.clear();
    this.state = emptyHealth(enabled ? "STARTING" : "OFFLINE", enabled);
    this.publish();
    if (enabled) void this.refresh({ source: "developer-mode" });
    return this.state;
  }

  async refresh(_args: { source?: "startup" | "manual" | "developer-mode" } = {}) {
    if (!reasoningEnabledFromDeveloperMode()) {
      this.state = emptyHealth("OFFLINE", false);
      this.publish();
      return this.state;
    }
    if (this.probePromise) return this.probePromise;
    this.probePromise = this.probeConfiguredEndpoints()
      .then((health) => {
        this.state = health;
        this.publish();
        return health;
      })
      .finally(() => {
        this.probePromise = null;
      });
    return this.probePromise;
  }

  async resolveEndpoint(capability?: ReasoningCapability | string) {
    const health = this.getHealth();
    const capabilityMatches = (endpoint: ReasoningEndpoint) =>
      !capability || endpoint.capabilities.includes(capability) || endpoint.capabilities.includes("GENERAL_REASONING");
    const active =
      health.endpoints.find((endpoint) => endpoint.healthStatus === "ONLINE" && capabilityMatches(endpoint)) ??
      health.endpoints.find((endpoint) => endpoint.healthStatus === "DEGRADED" && capabilityMatches(endpoint));
    if (!active) {
      const configured = health.endpoints.length;
      throw new Error(
        !health.reasoningEnabled
          ? "Reasoning is disabled in Developer Mode."
          : configured
            ? `Reasoning OFFLINE. Cached kernel state has no reachable endpoint for ${capability ?? "GENERAL_REASONING"}.`
            : "No reasoning endpoints configured. Set VITE_DAL_REASONING_ENDPOINTS or VITE_DAL_REASONING_PRIMARY_API."
      );
    }
    return active;
  }

  async requestWithFailover<T>(path: string, init?: RequestInit, capability?: ReasoningCapability | string): Promise<T> {
    const health = this.getHealth();
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
    throw new Error(failures.length ? `Reasoning fabric unavailable. ${failures.join(" | ")}` : "Reasoning fabric unavailable. No reachable cached endpoint candidates.");
  }

  private publish() {
    const next = this.withUpdatedRetryCountdown(this.state);
    this.subscribers.forEach((callback) => callback(next));
  }

  private withUpdatedRetryCountdown(health: ReasoningFabricHealth) {
    const retryCountdownSeconds = secondsUntil(health.retryAfter);
    return { ...health, retryCountdownSeconds };
  }

  private endpointState(endpoint: ReasoningEndpoint) {
    const existing = this.endpointCircuit.get(endpoint.endpointId);
    if (existing) return existing;
    const created: EndpointCircuitState = {
      failureCount: 0,
      retryAfterMs: 0,
      circuitBreakerState: "CLOSED",
      unavailableLogged: false,
    };
    this.endpointCircuit.set(endpoint.endpointId, created);
    return created;
  }

  private canProbe(endpoint: ReasoningEndpoint) {
    const state = this.endpointState(endpoint);
    if (!state.retryAfter) return true;
    if (new Date(state.retryAfter).getTime() <= nowMs()) {
      state.circuitBreakerState = "HALF_OPEN";
      return true;
    }
    return false;
  }

  private skippedDiagnostic(endpoint: ReasoningEndpoint, checkedAt: string): ReasoningEndpointDiagnostic {
    const circuit = this.endpointState(endpoint);
    const cachedEndpoint = circuit.cachedEndpoint ?? {
      ...endpoint,
      healthStatus: "OFFLINE" as const,
      circuitBreakerState: circuit.circuitBreakerState,
      lastSuccessfulProbe: circuit.lastSuccessfulProbe,
      lastFailure: circuit.lastFailure,
      retryAfter: circuit.retryAfter,
      retryAfterSeconds: secondsUntil(circuit.retryAfter),
    };
    return {
      endpoint: cachedEndpoint,
      testUrl: `${endpointBaseUrl(endpoint)}${OPENAI_MODELS_PATH}`,
      dns: endpoint.host ? "BROWSER_DELEGATED" : "INVALID_HOST",
      tcpReachability: "UNREACHABLE",
      healthCheck: "SKIPPED",
      latencyMs: 0,
      error: `Circuit breaker open. Retry in ${secondsUntil(circuit.retryAfter) ?? 0} seconds.`,
      checkedAt,
      circuitBreakerState: circuit.circuitBreakerState,
      retryAfterSeconds: secondsUntil(circuit.retryAfter),
    };
  }

  private async probeConfiguredEndpoints(): Promise<ReasoningFabricHealth> {
    const candidates = getReasoningEndpointCandidates();
    const checkedAt = nowIso();
    if (!candidates.length) return emptyHealth("OFFLINE", true);

    const diagnostics = await Promise.all(candidates.map((endpoint) => this.probeEndpointWithCircuitBreaker(endpoint, checkedAt)));
    const endpoints = diagnostics.map((diagnostic) => diagnostic.endpoint);
    const activeEndpoint = endpoints.find((endpoint) => endpoint.healthStatus === "ONLINE") ?? endpoints.find((endpoint) => endpoint.healthStatus === "DEGRADED");
    const offlineEndpoints = endpoints.filter((endpoint) => endpoint.healthStatus === "OFFLINE");
    const onlineModels = endpoints.filter((endpoint) => endpoint.healthStatus === "ONLINE").map((endpoint) => endpoint.modelName);
    const availableModels = Array.from(new Set(endpoints.flatMap((endpoint) => endpoint.availableModels ?? []).filter(Boolean)));
    const retryAfter = offlineEndpoints.map((endpoint) => endpoint.retryAfter).filter(Boolean).sort()[0];
    const circuitBreakerState: ReasoningCircuitBreakerState =
      endpoints.some((endpoint) => endpoint.circuitBreakerState === "OPEN") ? "OPEN" :
        endpoints.some((endpoint) => endpoint.circuitBreakerState === "HALF_OPEN") ? "HALF_OPEN" :
          "CLOSED";

    return {
      authority: REASONING_SERVICE_MANAGER_AUTHORITY,
      serviceStatus: activeEndpoint?.healthStatus ?? "OFFLINE",
      circuitBreakerState,
      reasoningEnabled: true,
      endpoints,
      diagnostics,
      activeEndpoint,
      onlineModels,
      offlineModels: offlineEndpoints.map((endpoint) => endpoint.modelName),
      availableModels,
      defaultModel: activeEndpoint?.defaultModel ?? activeEndpoint?.modelName,
      embeddingModel: activeEndpoint?.embeddingModel,
      reasoningModel: activeEndpoint?.reasoningModel ?? activeEndpoint?.modelName,
      endpointCapabilities: Array.from(new Set(endpoints.flatMap((endpoint) => endpoint.capabilities))),
      failures: offlineEndpoints.length,
      checkedAt,
      lastSuccessfulProbe: endpoints.map((endpoint) => endpoint.lastSuccessfulProbe).filter(Boolean).sort().at(-1),
      lastFailure: endpoints.map((endpoint) => endpoint.lastFailure).filter(Boolean).sort().at(-1),
      retryAfter,
      retryCountdownSeconds: secondsUntil(retryAfter),
      providerConfigurations: providerConfigurations(endpoints),
    };
  }

  private async probeEndpointWithCircuitBreaker(endpoint: ReasoningEndpoint, checkedAt: string): Promise<ReasoningEndpointDiagnostic> {
    if (!this.canProbe(endpoint)) return this.skippedDiagnostic(endpoint, checkedAt);

    const baseUrl = endpointBaseUrl(endpoint);
    const healthProbe = await probeEndpoint(baseUrl, STANDARD_HEALTH_PATH);
    const modelProbe = await probeEndpoint(baseUrl, OPENAI_MODELS_PATH);
    const legacyProbe = healthProbe.ok || modelProbe.ok ? undefined : await probeEndpoint(baseUrl, LEGACY_REASONING_HEALTH_PATH);
    const successfulProbe = modelProbe.ok ? modelProbe : healthProbe.ok ? healthProbe : legacyProbe?.ok ? legacyProbe : undefined;
    const healthBody = healthProbe.ok ? healthProbe.body : legacyProbe?.ok ? legacyProbe.body : undefined;
    const healthStatus: ReasoningHealthStatus = modelProbe.ok ? "ONLINE" : healthProbe.ok ? "ONLINE" : legacyProbe?.ok ? healthStatusFor(true, legacyProbe.body) : "OFFLINE";
    const latencyMs = successfulProbe?.latencyMs ?? Math.min(healthProbe.latencyMs, modelProbe.latencyMs, legacyProbe?.latencyMs ?? Number.MAX_SAFE_INTEGER);
    const circuit = this.endpointState(endpoint);

    if (successfulProbe) {
      circuit.failureCount = 0;
      circuit.retryAfterMs = 0;
      circuit.retryAfter = undefined;
      circuit.lastSuccessfulProbe = checkedAt;
      circuit.circuitBreakerState = "CLOSED";
      circuit.unavailableLogged = false;
    } else {
      circuit.failureCount += 1;
      circuit.retryAfterMs = retryAfterMsForFailure(circuit.failureCount);
      circuit.retryAfter = new Date(nowMs() + circuit.retryAfterMs).toISOString();
      circuit.lastFailure = checkedAt;
      circuit.circuitBreakerState = "OPEN";
      if (!circuit.unavailableLogged) {
        console.warn(`Reasoning endpoint unavailable. Circuit breaker opened. Retry in ${Math.ceil(circuit.retryAfterMs / 1000)} seconds.`, {
          endpoint: baseUrl,
          reason: modelProbe.error ?? healthProbe.error ?? legacyProbe?.error ?? "unavailable",
        });
        circuit.unavailableLogged = true;
      }
    }

    const discovered = endpointWithDiscovery(endpoint, {
      checkedAt,
      healthStatus,
      latencyMs,
      healthBody,
      modelBody: modelProbe.ok ? modelProbe.body : undefined,
      circuitState: circuit,
    });
    circuit.cachedEndpoint = discovered;

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
      circuitBreakerState: circuit.circuitBreakerState,
      retryAfterSeconds: secondsUntil(circuit.retryAfter),
    };
  }
}

export const ReasoningServiceManager = new ReasoningServiceManagerClass();

export function startReasoningService() {
  return ReasoningServiceManager.start();
}

export function subscribeReasoningService(callback: (health: ReasoningFabricHealth) => void) {
  return ReasoningServiceManager.subscribe(callback);
}

export function getReasoningServiceSnapshot() {
  return ReasoningServiceManager.getHealth();
}

export function setReasoningEnabled(enabled: boolean) {
  return ReasoningServiceManager.setReasoningEnabled(enabled);
}

export async function refreshReasoningService() {
  return ReasoningServiceManager.refresh({ source: "manual" });
}

export async function loadReasoningRegistryHealth(): Promise<ReasoningFabricHealth> {
  startReasoningService();
  return getReasoningServiceSnapshot();
}

export async function resolveReasoningEndpoint(capability?: ReasoningCapability | string) {
  return ReasoningServiceManager.resolveEndpoint(capability);
}

export async function requestReasoningWithFailover<T>(path: string, init?: RequestInit, capability?: ReasoningCapability | string): Promise<T> {
  return ReasoningServiceManager.requestWithFailover<T>(path, init, capability);
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
