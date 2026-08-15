import { constitutionalInputHash } from "../runtime/ConstitutionalProjectionCache";

export type CommercialMutationType =
  | "CIVIL_MIX_CHANGE"
  | "DUCT_CONFIGURATION_CHANGE"
  | "FIBER_CONFIGURATION_CHANGE"
  | "ILA_MODE_CHANGE"
  | "MATERIAL_RATE_CHANGE"
  | "LABOR_RATE_CHANGE"
  | "COMMERCIAL_MARKUP_CHANGE";

export type ArtifactDependencyClass =
  | "GEOMETRY"
  | "SPINE"
  | "STATIONING"
  | "OBJECT_MANIFEST"
  | "PRODUCT_DOCTRINE"
  | "PROJECT_CONFIGURATION"
  | "CONSTRUCTION_CAPABILITY"
  | "QUANTITY"
  | "RATE_RESOLUTION"
  | "MATERIAL_RESOLUTION"
  | "ESTIMATE"
  | "COMMERCIAL_FINANCIALS"
  | "PROPOSAL"
  | "DRAFT_IOF"
  | "ENGINEERING"
  | "MAP";

export type MutationOperation =
  | "routeRebuilds"
  | "stationRebuilds"
  | "objectManifestRebuilds"
  | "doctrineEvaluations"
  | "structuralIofAssemblies"
  | "financialProjections"
  | "engineeringProjections"
  | "mapRebuilds"
  | "quantityRecalculations"
  | "estimateRecalculations"
  | "proposalProjections"
  | "reactStateCommits"
  | "repositoryReads"
  | "repositoryWrites";

export type MutationTrace = {
  traceId: string;
  event: CommercialMutationType;
  component: string;
  action: string;
  startedAt: string;
  completedAt?: string;
  durationMs: number;
  inputFingerprint: string;
  artifactType?: string;
  artifactId?: string;
  cacheStatus?: "HIT" | "MISS" | "BYPASS";
  invalidationReason: string;
  invalidated: ArtifactDependencyClass[];
  preserved: ArtifactDependencyClass[];
  objectsProcessed: number;
  geometryPointsProcessed: number;
  operations: Record<MutationOperation, number>;
  timeline: Array<{ operation: string; startedOffsetMs: number; durationMs: number; details?: Record<string, unknown> }>;
  childTimings: Array<{ operation: string; startedOffsetMs: number; durationMs: number; details?: Record<string, unknown> }>;
  unattributedDurationMs: number;
  thresholds: Record<"over50Ms" | "over100Ms" | "over500Ms" | "over1Second" | "over5Seconds", string[]>;
};

export const COMMERCIAL_DEPENDENCY_CLASSES: ArtifactDependencyClass[] = [
  "GEOMETRY", "SPINE", "STATIONING", "OBJECT_MANIFEST", "PRODUCT_DOCTRINE",
  "PROJECT_CONFIGURATION", "CONSTRUCTION_CAPABILITY", "QUANTITY", "RATE_RESOLUTION",
  "MATERIAL_RESOLUTION", "ESTIMATE", "COMMERCIAL_FINANCIALS", "PROPOSAL", "DRAFT_IOF",
  "ENGINEERING", "MAP",
];

export const COMMERCIAL_MUTATION_DEPENDENCIES: Record<CommercialMutationType, ArtifactDependencyClass[]> = {
  CIVIL_MIX_CHANGE: ["QUANTITY", "ESTIMATE", "COMMERCIAL_FINANCIALS", "PROPOSAL"],
  DUCT_CONFIGURATION_CHANGE: ["PROJECT_CONFIGURATION", "CONSTRUCTION_CAPABILITY", "QUANTITY", "MATERIAL_RESOLUTION", "RATE_RESOLUTION", "ESTIMATE", "COMMERCIAL_FINANCIALS", "PROPOSAL", "DRAFT_IOF"],
  FIBER_CONFIGURATION_CHANGE: ["PROJECT_CONFIGURATION", "QUANTITY", "MATERIAL_RESOLUTION", "ESTIMATE", "COMMERCIAL_FINANCIALS", "PROPOSAL", "DRAFT_IOF"],
  ILA_MODE_CHANGE: ["PROJECT_CONFIGURATION", "QUANTITY", "ESTIMATE", "COMMERCIAL_FINANCIALS", "PROPOSAL", "DRAFT_IOF"],
  MATERIAL_RATE_CHANGE: ["MATERIAL_RESOLUTION", "ESTIMATE", "COMMERCIAL_FINANCIALS", "PROPOSAL"],
  LABOR_RATE_CHANGE: ["RATE_RESOLUTION", "ESTIMATE", "COMMERCIAL_FINANCIALS", "PROPOSAL"],
  COMMERCIAL_MARKUP_CHANGE: ["COMMERCIAL_FINANCIALS", "PROPOSAL"],
};

const OPERATION_KEYS: MutationOperation[] = [
  "routeRebuilds", "stationRebuilds", "objectManifestRebuilds", "doctrineEvaluations",
  "structuralIofAssemblies", "financialProjections", "engineeringProjections", "mapRebuilds",
  "quantityRecalculations", "estimateRecalculations", "proposalProjections", "reactStateCommits",
  "repositoryReads", "repositoryWrites",
];
const traces: MutationTrace[] = [];
let activeTrace: MutationTrace | null = null;

function nowMs() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

export function beginCommercialMutation(args: {
  event: CommercialMutationType;
  component: string;
  action: string;
  input: unknown;
  artifactType?: string;
  artifactId?: string;
}) {
  const invalidated = [...COMMERCIAL_MUTATION_DEPENDENCIES[args.event]];
  const started = nowMs();
  const trace: MutationTrace & { _started?: number; _lastMilestone?: number } = {
    traceId: `MUTATION-${args.event}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    event: args.event,
    component: args.component,
    action: args.action,
    startedAt: new Date().toISOString(),
    durationMs: 0,
    inputFingerprint: constitutionalInputHash(args.input),
    artifactType: args.artifactType,
    artifactId: args.artifactId,
    invalidationReason: `${args.event} invalidates only registered dependent projections.`,
    invalidated,
    preserved: COMMERCIAL_DEPENDENCY_CLASSES.filter((item) => !invalidated.includes(item)),
    objectsProcessed: 0,
    geometryPointsProcessed: 0,
    operations: Object.fromEntries(OPERATION_KEYS.map((key) => [key, 0])) as Record<MutationOperation, number>,
    timeline: [],
    childTimings: [],
    unattributedDurationMs: 0,
    thresholds: { over50Ms: [], over100Ms: [], over500Ms: [], over1Second: [], over5Seconds: [] },
    _started: started,
    _lastMilestone: started,
  };
  activeTrace = trace;
  return trace.traceId;
}

export function recordCommercialMutationMilestone(operation: string, details?: Record<string, unknown>) {
  if (!activeTrace) return;
  const trace = activeTrace as MutationTrace & { _started?: number; _lastMilestone?: number };
  const now = nowMs();
  const started = trace._lastMilestone ?? trace._started ?? now;
  trace.timeline.push({ operation, startedOffsetMs: Math.round((started - (trace._started ?? started)) * 100) / 100, durationMs: Math.round((now - started) * 100) / 100, details });
  trace._lastMilestone = now;
}

export function measureCommercialMutationChild<T>(operation: string, callback: () => T, details?: Record<string, unknown>): T {
  if (!activeTrace) return callback();
  const trace = activeTrace as MutationTrace & { _started?: number };
  const started = nowMs();
  try {
    return callback();
  } finally {
    const ended = nowMs();
    trace.childTimings.push({ operation, startedOffsetMs: Math.round((started - (trace._started ?? started)) * 100) / 100, durationMs: Math.round((ended - started) * 100) / 100, details });
  }
}

export function recordCommercialMutationOperation(operation: MutationOperation, amount = 1) {
  if (activeTrace) activeTrace.operations[operation] += amount;
}

export function annotateCommercialMutation(args: Partial<Pick<MutationTrace, "cacheStatus" | "objectsProcessed" | "geometryPointsProcessed" | "artifactType" | "artifactId">>) {
  if (activeTrace) Object.assign(activeTrace, args);
}

export function completeCommercialMutation(traceId?: string) {
  if (!activeTrace || (traceId && activeTrace.traceId !== traceId)) return null;
  recordCommercialMutationMilestone("mutation-finalization");
  const trace = activeTrace as MutationTrace & { _started?: number; _lastMilestone?: number };
  trace.completedAt = new Date().toISOString();
  trace.durationMs = Math.round((nowMs() - (trace._started ?? nowMs())) * 100) / 100;
  const attributed = trace.timeline.reduce((total, item) => total + item.durationMs, 0);
  trace.unattributedDurationMs = Math.max(0, Math.round((trace.durationMs - attributed) * 100) / 100);
  const allTimings = [...trace.timeline, ...trace.childTimings];
  trace.thresholds = {
    over50Ms: allTimings.filter((item) => item.durationMs > 50).map((item) => item.operation),
    over100Ms: allTimings.filter((item) => item.durationMs > 100).map((item) => item.operation),
    over500Ms: allTimings.filter((item) => item.durationMs > 500).map((item) => item.operation),
    over1Second: allTimings.filter((item) => item.durationMs > 1000).map((item) => item.operation),
    over5Seconds: allTimings.filter((item) => item.durationMs > 5000).map((item) => item.operation),
  };
  delete trace._started;
  delete trace._lastMilestone;
  traces.push(trace);
  if (traces.length > 100) traces.splice(0, traces.length - 100);
  activeTrace = null;
  return trace;
}

export function latestCommercialMutationTrace() {
  return activeTrace ?? traces.at(-1) ?? null;
}

export function listCommercialMutationTraces() {
  return [...traces];
}

export function resetCommercialMutationTraces() {
  traces.splice(0, traces.length);
  activeTrace = null;
}

export function calculateCivilMixFastPath(routeFeet: number, mix: { plowPercent: number; dirtPercent: number; rockPercent: number; trenchPercent: number }) {
  const feet = Math.max(0, Math.round(routeFeet));
  const entries = [mix.plowPercent, mix.dirtPercent, mix.rockPercent, mix.trenchPercent];
  if (entries.some((value) => !Number.isFinite(value) || value < 0)) throw new Error("Civil mix values must be finite, non-negative percentages.");
  const totalPercent = entries.reduce((total, value) => total + value, 0);
  if (Math.abs(totalPercent - 100) > 0.001) throw new Error(`Civil mix totals ${totalPercent}%; expected 100%.`);
  const quantities = entries.map((percent) => Math.round(feet * percent / 100));
  const roundingDelta = feet - quantities.reduce((total, value) => total + value, 0);
  const reconciliationIndex = entries.indexOf(Math.max(...entries));
  quantities[reconciliationIndex] += roundingDelta;
  const [plowFeet, dirtFeet, rockFeet, trenchFeet] = quantities;
  recordCommercialMutationOperation("quantityRecalculations");
  return { routeFeet: feet, plowFeet, dirtFeet, rockFeet, trenchFeet, totalFeet: plowFeet + dirtFeet + rockFeet + trenchFeet };
}
