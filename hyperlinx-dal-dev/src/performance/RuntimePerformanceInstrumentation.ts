export type RuntimePerformanceMetric = {
  metricId: string;
  operation: string;
  domain: string;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  cacheStatus?: "HIT" | "MISS" | "BYPASS";
  recordsProcessed?: number;
  recordsRendered?: number;
  workerStatus?: string;
  metadata?: Record<string, unknown>;
};

export type RuntimePerformanceSnapshot = {
  initialRenderMs: number;
  workspaceRestoreMs: number;
  inventoryImportMs: number;
  kmzParseMs: number;
  normalizationMs: number;
  geometryBuildMs: number;
  cacheStatus: "HIT" | "MISS" | "BYPASS" | "UNKNOWN";
  workerStatus: string;
  visibleRoutes: number;
  visibleStations: number;
  renderedObjects: number;
  workbookRecalculationMs: number;
  ilaRecalculationMs: number;
  viewportObjectCount: number;
  reactRenderCount: number;
  frameTimingMs: number;
};

const metrics: RuntimePerformanceMetric[] = [];

function nowMs() {
  return typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
}

export function startRuntimePerformanceOperation(operation: string, domain: string, metadata: Record<string, unknown> = {}) {
  const startedAt = nowMs();
  return {
    operation,
    domain,
    startedAt,
    end(extra: Partial<Omit<RuntimePerformanceMetric, "metricId" | "operation" | "domain" | "startedAt" | "endedAt" | "durationMs">> = {}) {
      const endedAt = nowMs();
      const metric: RuntimePerformanceMetric = {
        metricId: `PERF-${operation}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        operation,
        domain,
        startedAt,
        endedAt,
        durationMs: Math.max(0, Math.round((endedAt - startedAt) * 100) / 100),
        metadata,
        ...extra,
      };
      metrics.push(metric);
      if (metrics.length > 250) metrics.splice(0, metrics.length - 250);
      return metric;
    },
  };
}

export function latestRuntimePerformanceMetrics() {
  return [...metrics];
}

function latestDuration(operation: string) {
  return [...metrics].reverse().find((metric) => metric.operation === operation)?.durationMs ?? 0;
}

function latestCacheStatus() {
  return [...metrics].reverse().find((metric) => metric.cacheStatus)?.cacheStatus ?? "UNKNOWN";
}

function latestWorkerStatus() {
  return [...metrics].reverse().find((metric) => metric.workerStatus)?.workerStatus ?? "IDLE";
}

export function runtimePerformanceSnapshot(overrides: Partial<RuntimePerformanceSnapshot> = {}): RuntimePerformanceSnapshot {
  return {
    initialRenderMs: latestDuration("initial-render"),
    workspaceRestoreMs: latestDuration("workspace-restore"),
    inventoryImportMs: latestDuration("inventory-import"),
    kmzParseMs: latestDuration("kmz-parse"),
    normalizationMs: latestDuration("normalization"),
    geometryBuildMs: latestDuration("geometry-build"),
    cacheStatus: latestCacheStatus(),
    workerStatus: latestWorkerStatus(),
    visibleRoutes: 0,
    visibleStations: 0,
    renderedObjects: 0,
    workbookRecalculationMs: latestDuration("workbook-recalculation"),
    ilaRecalculationMs: latestDuration("ila-recalculation"),
    viewportObjectCount: 0,
    reactRenderCount: 0,
    frameTimingMs: latestDuration("frame"),
    ...overrides,
  };
}
