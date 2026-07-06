export type RuntimeDiagnosticCounter =
  | "reactRenders"
  | "assemblyExecutions"
  | "cacheHits"
  | "cacheMisses"
  | "projectionExecutions"
  | "objectInstantiationExecutions"
  | "engineeringProjectionExecutions"
  | "mapRebuilds"
  | "operationalIntelligenceExecutions"
  | "runtimeSerializationCount"
  | "revisionChanges";

export type RuntimeDiagnosticTiming = {
  count: number;
  totalDurationMs: number;
  maxDurationMs: number;
  averageDurationMs: number;
};

export type RuntimeDiagnosticsSnapshot = {
  counters: Record<RuntimeDiagnosticCounter, number>;
  timings: Record<string, RuntimeDiagnosticTiming>;
  currentArtifactRevisions: Record<string, number>;
  cacheEntries: number;
  cacheUtilization: number;
};

const COUNTERS: RuntimeDiagnosticCounter[] = [
  "reactRenders",
  "assemblyExecutions",
  "cacheHits",
  "cacheMisses",
  "projectionExecutions",
  "objectInstantiationExecutions",
  "engineeringProjectionExecutions",
  "mapRebuilds",
  "operationalIntelligenceExecutions",
  "runtimeSerializationCount",
  "revisionChanges",
];

const counters: Record<RuntimeDiagnosticCounter, number> = COUNTERS.reduce(
  (result, counter) => ({ ...result, [counter]: 0 }),
  {} as Record<RuntimeDiagnosticCounter, number>,
);
const timings = new Map<string, RuntimeDiagnosticTiming>();
const currentArtifactRevisions = new Map<string, number>();
let cacheEntries = 0;

function nowMs() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

export function markRuntimeDiagnostic(counter: RuntimeDiagnosticCounter, amount = 1) {
  counters[counter] += amount;
}

export function recordRuntimeDuration(label: string, durationMs: number) {
  const current = timings.get(label) ?? { count: 0, totalDurationMs: 0, maxDurationMs: 0, averageDurationMs: 0 };
  const nextTotal = current.totalDurationMs + durationMs;
  const nextCount = current.count + 1;
  timings.set(label, {
    count: nextCount,
    totalDurationMs: nextTotal,
    maxDurationMs: Math.max(current.maxDurationMs, durationMs),
    averageDurationMs: nextTotal / nextCount,
  });
}

export function recordRuntimeArtifactRevision(artifactId: string, revision: number) {
  if (currentArtifactRevisions.get(artifactId) !== revision) markRuntimeDiagnostic("revisionChanges");
  currentArtifactRevisions.set(artifactId, revision);
}

export function recordRuntimeCacheEntries(count: number) {
  cacheEntries = count;
}

export function measureRuntime<T>(label: string, counter: RuntimeDiagnosticCounter | undefined, producer: () => T): T {
  const start = nowMs();
  try {
    return producer();
  } finally {
    if (counter) markRuntimeDiagnostic(counter);
    recordRuntimeDuration(label, nowMs() - start);
  }
}

export function getRuntimeDiagnosticsSnapshot(): RuntimeDiagnosticsSnapshot {
  const hits = counters.cacheHits;
  const misses = counters.cacheMisses;
  const totalCacheLookups = hits + misses;
  return {
    counters: { ...counters },
    timings: Object.fromEntries(timings.entries()),
    currentArtifactRevisions: Object.fromEntries(currentArtifactRevisions.entries()),
    cacheEntries,
    cacheUtilization: totalCacheLookups ? hits / totalCacheLookups : 0,
  };
}

export function resetRuntimeDiagnostics() {
  COUNTERS.forEach((counter) => {
    counters[counter] = 0;
  });
  timings.clear();
  currentArtifactRevisions.clear();
  cacheEntries = 0;
}
