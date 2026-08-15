import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd().endsWith("hyperlinx-dal-dev")
  ? process.cwd()
  : path.join(process.cwd(), "hyperlinx-dal-dev");

const paths = {
  manager: path.join(root, "src", "kernel", "ReasoningServiceManager.ts"),
  registry: path.join(root, "src", "api", "reasoningRegistry.ts"),
  client: path.join(root, "src", "api", "reasoningClient.ts"),
  config: path.join(root, "src", "config", "dalApi.ts"),
  dashboard: path.join(root, "src", "components", "ReasoningHealthDashboard.tsx"),
  kernelPanel: path.join(root, "src", "components", "KernelReasoningStatusPanel.tsx"),
  runtimeDiagnostics: path.join(root, "src", "components", "RuntimeDiagnosticsPanel.tsx"),
  dalApp: path.join(root, "src", "dal", "DALApp.tsx"),
  dalConnectivity: path.join(root, "src", "api", "dalConnectivity.ts"),
  runtimeKernel: path.join(root, "src", "runtime", "ConstitutionalRuntimeKernel.ts"),
};

for (const filePath of Object.values(paths)) {
  if (!existsSync(filePath)) {
    console.error(`FAIL missing required file: ${path.relative(root, filePath)}`);
    process.exit(1);
  }
}

const sources = Object.fromEntries(
  Object.entries(paths).map(([key, filePath]) => [key, readFileSync(filePath, "utf8")]),
);

const checks = [];

function check(name, condition, detail = "") {
  checks.push({ name, condition: Boolean(condition), detail });
}

function includesAll(source, terms) {
  return terms.every((term) => source.includes(term));
}

function walkFiles(dir, result = []) {
  for (const entry of readdirSync(dir)) {
    if (["node_modules", "dist", "dist-dal", ".git"].includes(entry)) continue;
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walkFiles(full, result);
    else if (/\.(ts|tsx|js|jsx)$/.test(entry)) result.push(full);
  }
  return result;
}

const sourceFiles = walkFiles(path.join(root, "src")).concat(walkFiles(path.join(root, "server")));
const filesWithModelsProbe = sourceFiles
  .filter((filePath) => readFileSync(filePath, "utf8").includes("/v1/models"))
  .map((filePath) => path.relative(root, filePath).replaceAll("\\", "/"));
const filesWithLegacyHealthProbe = sourceFiles
  .filter((filePath) => readFileSync(filePath, "utf8").includes("/api/reasoning/health"))
  .map((filePath) => path.relative(root, filePath).replaceAll("\\", "/"));

check("Kernel ReasoningServiceManager exists and owns reasoning authority", includesAll(sources.manager, [
  "REASONING_SERVICE_MANAGER_AUTHORITY",
  "STELLAOS_KERNEL_REASONING_SERVICE_MANAGER",
  "REASONING_SERVICE_MANAGER_VERSION = \"36.0\"",
  "export class ReasoningServiceManagerClass",
  "export const ReasoningServiceManager",
]));

check("Only the kernel manager contains /v1/models probe path", filesWithModelsProbe.length === 1 &&
  filesWithModelsProbe[0] === "src/kernel/ReasoningServiceManager.ts", filesWithModelsProbe.join(", "));

check("Only the kernel manager contains legacy reasoning health probe path", filesWithLegacyHealthProbe.length === 1 &&
  filesWithLegacyHealthProbe[0] === "src/kernel/ReasoningServiceManager.ts", filesWithLegacyHealthProbe.join(", "));

check("Reasoning endpoint state machine is modeled", includesAll(sources.manager, [
  "\"ONLINE\"",
  "\"OFFLINE\"",
  "\"DEGRADED\"",
  "\"STARTING\"",
  "lastSuccessfulProbe",
  "lastFailure",
  "retryAfter",
  "latencyMs",
  "availableModels",
  "endpointVersion",
]));

check("Circuit breaker uses exponential backoff and cached skip diagnostics", includesAll(sources.manager, [
  "RETRY_BACKOFF_MS = [60_000, 120_000, 300_000, 600_000]",
  "MAXIMUM_RETRY_FREQUENCY_MS = 300_000",
  "Circuit breaker open. Retry in",
  "Reasoning endpoint unavailable. Circuit breaker opened. Retry in",
  "skippedDiagnostic",
  "canProbe",
]));

check("Model cache and endpoint capabilities are cached in kernel state", includesAll(sources.manager, [
  "availableModels",
  "defaultModel",
  "embeddingModel",
  "reasoningModel",
  "endpointCapabilities",
  "activeEndpoint",
]));

check("Developer mode can disable all reasoning probes", includesAll(sources.config, [
  "DAL_REASONING_ENABLED",
  "VITE_DAL_REASONING_ENABLED",
]) && includesAll(sources.manager, [
  "stellaos.reasoningEnabled",
  "setReasoningEnabled",
  "DISABLED",
  "Reasoning is disabled in Developer Mode.",
]));

check("Reasoning providers are kernel-configurable", includesAll(sources.manager, [
  "Local Mistral (Primary)",
  "OpenAI",
  "Anthropic",
  "Ollama",
  "Disabled",
  "getReasoningProviderConfigurations",
]));

check("Reasoning registry is a facade and does not probe endpoints", !sources.registry.includes("fetch(") &&
  !sources.registry.includes("/v1/models") &&
  sources.registry.includes("../kernel/ReasoningServiceManager"));

check("Reasoning client uses cached manager facade instead of probing models", !sources.client.includes("/v1/models") &&
  includesAll(sources.client, [
    "requestReasoningWithFailover",
    "resolveReasoningEndpoint",
  ]));

check("Reasoning dashboard subscribes to cached kernel state", includesAll(sources.dashboard, [
  "subscribeReasoningService",
  "startReasoningService",
  "getReasoningServiceSnapshot",
  "refreshReasoningService",
  "Refresh Kernel Cache",
]) && !sources.dashboard.includes("/v1/models"));

check("Kernel Reasoning Status panel is mounted in runtime diagnostics", includesAll(sources.kernelPanel, [
  "Reasoning Status",
  "Circuit Breaker",
  "reasoningEnabled",
  "Retry Kernel Cache",
]) || includesAll(sources.kernelPanel, [
  "Reasoning Status",
  "circuit breaker state",
  "reasoningEnabled",
  "Refresh Kernel Cache",
]) && sources.runtimeDiagnostics.includes("KernelReasoningStatusPanel"));

check("DAL shell starts reasoning once and reads cached kernel state", includesAll(sources.dalApp, [
  "startReasoningService",
  "subscribeReasoningService",
  "getReasoningServiceSnapshot",
  "Reasoning:",
]) && !sources.dalApp.includes("getReasoningEndpointCandidates"));

check("DAL connectivity reports kernel cache instead of direct model URL", includesAll(sources.dalConnectivity, [
  "StellaOS Kernel ReasoningServiceManager cache",
  "Kernel Reasoning Service",
]) && !sources.dalConnectivity.includes("/v1/models"));

check("Constitutional Runtime Kernel exposes reasoning service controls", includesAll(sources.runtimeKernel, [
  "startReasoningService",
  "refreshReasoningService",
  "getReasoningService",
]));

check("Downstream domain workspaces do not probe reasoning endpoints directly",
  sourceFiles
    .filter((filePath) => /src[\\/](components[\\/]workspaces|workspaces)[\\/]/.test(filePath))
    .every((filePath) => {
      const text = readFileSync(filePath, "utf8");
      return !text.includes("/v1/models") && !text.includes("/api/reasoning/health");
    }));

const failed = checks.filter((item) => !item.condition);

for (const item of checks) {
  console.log(`${item.condition ? "PASS" : "FAIL"} ${item.name}${item.detail ? ` - ${item.detail}` : ""}`);
}

if (failed.length) {
  console.error(`\n${failed.length} CIP-036 validation check(s) failed.`);
  process.exit(1);
}

console.log("\nCIP-036 Kernel Reasoning Service validation passed.");
