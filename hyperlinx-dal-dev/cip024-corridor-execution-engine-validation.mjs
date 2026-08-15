import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd().endsWith("hyperlinx-dal-dev")
  ? process.cwd()
  : path.join(process.cwd(), "hyperlinx-dal-dev");

const paths = {
  types: path.join(root, "src", "corridorExecution", "CorridorExecutionTypes.ts"),
  partition: path.join(root, "src", "corridorExecution", "CorridorPartitionEngine.ts"),
  worker: path.join(root, "src", "corridorExecution", "CorridorSegmentWorker.ts"),
  checkpoints: path.join(root, "src", "corridorExecution", "CorridorCheckpointStore.ts"),
  aggregate: path.join(root, "src", "corridorExecution", "CorridorAggregateProjection.ts"),
  viewport: path.join(root, "src", "corridorExecution", "CorridorViewportProjection.ts"),
  metrics: path.join(root, "src", "corridorExecution", "CorridorPerformanceMetrics.ts"),
  cache: path.join(root, "src", "corridorExecution", "CorridorCache.ts"),
  engine: path.join(root, "src", "corridorExecution", "CorridorExecutionEngine.ts"),
  index: path.join(root, "src", "corridorExecution", "index.ts"),
  workspace: path.join(root, "src", "components", "workspaces", "GoogleRfpWorkspace.tsx"),
  mapPanel: path.join(root, "src", "components", "workspaces", "proposednetwork", "ProposedNetworkMapPanel.tsx"),
  diagnostics: path.join(root, "src", "performance", "RuntimeDiagnostics.ts"),
  doctrine: path.join(root, "PD_003_CORRIDOR_EXECUTION_ENGINE_DOCTRINE.md"),
  report: path.join(root, "CIP_024_CORRIDOR_EXECUTION_ENGINE_STREAMING_RUNTIME_REPORT.md"),
};

for (const requiredPath of Object.values(paths)) {
  if (!existsSync(requiredPath)) {
    console.error(`FAIL missing required file: ${path.relative(root, requiredPath)}`);
    process.exit(1);
  }
}

const source = Object.fromEntries(
  Object.entries(paths).map(([key, filePath]) => [key, readFileSync(filePath, "utf8")]),
);
const corridorSources = [
  source.types,
  source.partition,
  source.worker,
  source.checkpoints,
  source.aggregate,
  source.viewport,
  source.metrics,
  source.cache,
  source.engine,
  source.index,
].join("\n");
const checks = [];

function check(name, condition, detail = "") {
  checks.push({ name, condition: Boolean(condition), detail });
}

function includesAll(text, terms) {
  return terms.every((term) => text.includes(term));
}

check("subsystem exports every CIP-024 runtime component", includesAll(source.index, [
  "CorridorExecutionTypes",
  "CorridorPartitionEngine",
  "CorridorCheckpointStore",
  "CorridorCache",
  "CorridorSegmentWorker",
  "CorridorAggregateProjection",
  "CorridorViewportProjection",
  "CorridorPerformanceMetrics",
  "CorridorExecutionEngine",
]));

check("segment model contains required canonical fields", includesAll(source.types, [
  "segmentId",
  "corridorId",
  "sequence",
  "startStation",
  "endStation",
  "startNode",
  "endNode",
  "lengthFeet",
  "lengthMiles",
  "geometryHash",
  "simplifiedGeometry",
  "visibleGeometry",
  "constructionSummary",
  "materialSummary",
  "laborSummary",
  "costSummary",
  "stationSummary",
  "ILASummary",
  "bookendSummary",
  "constraintSummary",
  "riskSummary",
  "validationState",
  "buildStatus",
  "checkpointId",
  "cacheKey",
]));

check("partition engine uses preferred 25-mile and max 50-mile rules", includesAll(source.partition, [
  "PREFERRED_SEGMENT_MILES = 25",
  "MAX_SEGMENT_MILES = 50",
  "preferredFeet",
  "maxFeet",
]));

check("partition engine recognizes required deterministic breakpoints", includesAll(source.partition, [
  "\"POP\"",
  "\"ILA_BOUNDARY\"",
  "\"BOOKEND\"",
  "\"CONSTRUCTION_METHOD_CHANGE\"",
  "\"MUNICIPALITY\"",
  "\"COUNTY\"",
  "\"STATE\"",
  "\"OPERATOR_BREAKPOINT\"",
]));

check("segment worker performs bounded per-segment work and checkpoint creation", includesAll(source.worker, [
  "processCorridorSegment",
  "processCorridorSegmentQueue",
  "yieldToRuntime",
  "requestIdleCallback",
  "setTimeout",
  "createCorridorCheckpoint",
  "stationSummary",
  "ILASummary",
  "constructionSummary",
  "costSummary",
]));

check("checkpoint store keeps completed segments recoverable", includesAll(source.checkpoints, [
  "createCorridorCheckpoint",
  "saveCorridorCheckpoint",
  "loadCorridorCheckpoint",
  "listCorridorCheckpoints",
  "recoverSegmentsFromCheckpoints",
  "recoverable: true",
]));

check("cache key contains required authority dimensions", includesAll(source.partition + source.cache, [
  "customerTwinId",
  "customerId",
  "corridorId",
  "importHash",
  "geometryHash",
  "segmentHash",
  "workbookHash",
]));

check("aggregate projection provides Commercial summary fields", includesAll(source.aggregate + source.types, [
  "totalLengthMiles",
  "estimatedCost",
  "revenue",
  "constructionMix",
  "unknownCount",
  "confidence",
  "ilaCount",
  "bookendCount",
  "executesFromSegmentSummaries",
  "consumesAggregateProjectionOnly",
  "detailedSchedulesAsync",
]));

check("viewport projection materializes visible and adjacent segments only", includesAll(source.viewport + source.types, [
  "buildCorridorViewportProjection",
  "geometryForViewport",
  "visibleSegmentIds",
  "visibleSegmentCount",
  "selectedSegmentId",
  "adjacentSegmentIds",
  "materializedTier",
  "\"HOT\"",
  "\"WARM\"",
  "\"COLD\"",
]));

check("performance metrics expose required diagnostics", includesAll(source.metrics + source.types, [
  "initialRenderTimeMs",
  "corridorPartitionTimeMs",
  "workerQueueDepth",
  "checkpointCount",
  "cacheHits",
  "cacheMisses",
  "visibleSegmentCount",
  "renderedStationCount",
  "renderedObjectCount",
  "workbookCalculationTimeMs",
  "proposalGenerationTimeMs",
  "workerUtilization",
]));

check("engine exposes progressive execution states and retry-safe failure", includesAll(source.engine + source.types, [
  "INITIALIZING_CORRIDOR",
  "PARTITIONING_CORRIDOR",
  "BUILDING_SEGMENTS",
  "CALCULATING_AGGREGATE",
  "READY",
  "FAILED",
  "retryFromFailedSegment",
  "completedSegments",
]));

check("diagnostics are gated by DEBUG_RUNTIME_DIAGNOSTICS", includesAll(source.diagnostics, [
  "VITE_DEBUG_RUNTIME_DIAGNOSTICS",
  "DEBUG_RUNTIME_DIAGNOSTICS",
  "runtimeDiagnosticsEnabled",
]) && includesAll(source.engine, [
  "runtimeDiagnosticsLog",
  "runtimeDiagnosticsWarn",
]));

check("Commercial workspace consumes aggregate and viewport projections", includesAll(source.workspace, [
  "executeCorridorInBackground",
  "corridorExecutionSession",
  "corridorAggregateProjection",
  "corridorViewportProjection",
  "corridorPerformanceMetrics",
  "Corridor Execution Engine",
  "Visible Segments",
  "Worker Utilization",
]));

check("map panel consumes corridor viewport projection for map LOD", includesAll(source.mapPanel, [
  "CorridorViewportProjection",
  "corridorViewportProjection",
  "visibleGeometry",
  "opportunityOverlayPath",
]));

check("corridor subsystem does not create ScopeVersion or mutate downstream execution", !includesAll(corridorSources, ["createScopeVersion"]) &&
  !corridorSources.includes("Marketplace") &&
  !corridorSources.includes("Control") &&
  !corridorSources.includes("Field") &&
  !corridorSources.includes("submitDraftIofPackageToEngineering"));

check("doctrine and report document streaming runtime", includesAll(source.doctrine + source.report, [
  "Corridor Execution Engine",
  "Segment Streaming",
  "Checkpoint",
  "Lazy Materialization",
  "Hot",
  "Warm",
  "Cold",
  "ScopeVersion",
]));

const failed = checks.filter((item) => !item.condition);

for (const item of checks) {
  const status = item.condition ? "PASS" : "FAIL";
  console.log(`${status} ${item.name}${item.detail ? ` - ${item.detail}` : ""}`);
}

if (failed.length) {
  console.error(`\n${failed.length} CIP-024 validation check(s) failed.`);
  process.exit(1);
}

console.log("\nCIP-024 corridor execution engine validation passed.");
