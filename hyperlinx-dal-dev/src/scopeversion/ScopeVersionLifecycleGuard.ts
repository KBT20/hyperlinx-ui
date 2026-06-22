import type { ScopeVersion, ScopeVersionStatus } from "../types/dal";

export const LIFECYCLE_ORDER = [
  "DRAFT",
  "ANALYZED",
  "CERTIFIED",
  "PROVISIONALLY_CERTIFIED",
  "QUOTED",
  "APPROVED",
  "CONTROL",
  "CONTROL_ACTIVE",
  "FIELD",
  "PARTIALLY_COMPLETE",
  "COMPLETE",
  "VERIFIED",
  "OPERATIONAL",
] as const;

const LIFECYCLE_RANKS = new Map<string, number>(
  LIFECYCLE_ORDER.map((state, index) => [state, index])
);

const LIFECYCLE_ALIASES: Record<string, string> = {
  RELEASED_TO_CONTROL: "CONTROL",
  ACTIVATED: "CONTROL_ACTIVE",
  FIELD_ACTIVE: "FIELD",
  IN_FIELD: "FIELD",
  IN_CONSTRUCTION: "FIELD",
};

const EXCEPTION_STATES = new Set(["BLOCKED", "REJECTED"]);

export function normalizeLifecycleState(state: unknown) {
  if (typeof state !== "string") return undefined;
  const upper = state.toUpperCase();
  return LIFECYCLE_ALIASES[upper] ?? upper;
}

export function getAuthoritativeLifecycleState(scopeVersion: ScopeVersion | null | undefined): ScopeVersionStatus {
  const canonical = normalizeLifecycleState(scopeVersion?.canonicalTruth?.lifecycleState);
  const topLevel = normalizeLifecycleState(scopeVersion?.status);
  return (canonical ?? topLevel ?? "ANALYZED") as ScopeVersionStatus;
}

export function inferLifecycleStateFromAuthority(scopeVersion: ScopeVersion | null | undefined): ScopeVersionStatus | undefined {
  if (!scopeVersion) return undefined;
  const events = Array.isArray(scopeVersion.events) ? scopeVersion.events : [];
  const closures = [
    ...(Array.isArray(scopeVersion.canonicalTruth?.closures) ? scopeVersion.canonicalTruth.closures : []),
    ...(Array.isArray(scopeVersion.closures) ? scopeVersion.closures : []),
  ];
  const executionState = scopeVersion.canonicalTruth?.executionState as { overallExecutionState?: string; updatedAt?: string } | undefined;
  let inferred: ScopeVersionStatus | undefined;
  const advance = (state: ScopeVersionStatus | undefined) => {
    if (!state) return;
    inferred = highestLifecycleState(inferred, state) as ScopeVersionStatus;
  };

  for (const event of events) {
    const type = String(event?.type ?? "");
    if (type === "scopeversion.quoted") advance("QUOTED");
    if (type === "scopeversion.approved") advance("APPROVED");
    if (type === "scopeversion.control.work_created") advance("CONTROL");
    if (type === "scopeversion.control.activated") advance("CONTROL_ACTIVE");
    if (type.startsWith("field.") || type.includes("field_") || type.includes("FIELD_CLOSE")) advance("FIELD");
    if (type === "scopeversion.complete" || type === "scopeversion.control.work_complete") advance("COMPLETE");
    if (type === "scopeversion.operational") advance("OPERATIONAL");
  }

  if (closures.length) advance("FIELD");
  if (executionState?.overallExecutionState === "ACTIVE") advance("CONTROL_ACTIVE");
  if (executionState?.overallExecutionState === "COMPLETE") advance("COMPLETE");

  return inferred;
}

export function inferLifecycleTimestampFromAuthority(scopeVersion: ScopeVersion | null | undefined): string | undefined {
  if (!scopeVersion) return undefined;
  const events = Array.isArray(scopeVersion.events) ? scopeVersion.events : [];
  const closures = [
    ...(Array.isArray(scopeVersion.canonicalTruth?.closures) ? scopeVersion.canonicalTruth.closures : []),
    ...(Array.isArray(scopeVersion.closures) ? scopeVersion.closures : []),
  ];
  const timestamps: string[] = [];
  events.forEach((event) => {
    const type = String(event?.type ?? "");
    if (
      type === "scopeversion.quoted" ||
      type === "scopeversion.approved" ||
      type === "scopeversion.control.work_created" ||
      type === "scopeversion.control.activated" ||
      type === "scopeversion.complete" ||
      type === "scopeversion.control.work_complete" ||
      type === "scopeversion.operational" ||
      type.startsWith("field.") ||
      type.includes("field_") ||
      type.includes("FIELD_CLOSE")
    ) {
      if (event.createdAt) timestamps.push(event.createdAt);
    }
  });
  closures.forEach((closure) => {
    const timestamp = closure.updatedAt ?? closure.createdAt;
    if (timestamp) timestamps.push(timestamp);
  });
  const executionTimestamp = (scopeVersion.canonicalTruth?.executionState as { updatedAt?: string } | undefined)?.updatedAt;
  if (executionTimestamp) timestamps.push(executionTimestamp);
  return timestamps.sort().at(-1);
}

function isExceptionState(state: unknown) {
  const normalized = normalizeLifecycleState(state);
  return Boolean(normalized && EXCEPTION_STATES.has(normalized));
}

export function lifecycleRank(state: unknown) {
  const normalized = normalizeLifecycleState(state);
  return normalized ? LIFECYCLE_RANKS.get(normalized) ?? -1 : -1;
}

function highestLifecycleState(existing: unknown, incoming: unknown): ScopeVersionStatus | undefined {
  if (isExceptionState(existing) || isExceptionState(incoming)) {
    return (normalizeLifecycleState(incoming) ?? normalizeLifecycleState(existing)) as ScopeVersionStatus | undefined;
  }

  const existingRank = lifecycleRank(existing);
  const incomingRank = lifecycleRank(incoming);

  if (existingRank < 0 && incomingRank < 0) return (normalizeLifecycleState(incoming) ?? normalizeLifecycleState(existing)) as ScopeVersionStatus | undefined;
  if (existingRank >= incomingRank && existingRank >= 0) return normalizeLifecycleState(existing) as ScopeVersionStatus;
  return normalizeLifecycleState(incoming) as ScopeVersionStatus;
}

function logBlockedRegression(
  scopeVersionId: string,
  field: "status" | "canonicalTruth.lifecycleState",
  existing: unknown,
  incoming: unknown,
  preserved: unknown
) {
  if (existing === incoming || incoming === undefined || preserved !== existing) return;
  console.log("[LIFECYCLE_REGRESSION_BLOCKED]", {
    scopeVersionId,
    field,
    existing,
    incoming,
    preserved,
  });
}

function lifecycleTimestamp(existing: ScopeVersion | null | undefined, incoming: ScopeVersion, preservedLifecycle: unknown) {
  const existingLifecycle = normalizeLifecycleState(existing?.canonicalTruth?.lifecycleState);
  const incomingLifecycle = normalizeLifecycleState(incoming.canonicalTruth?.lifecycleState);
  const preserved = normalizeLifecycleState(preservedLifecycle);
  if (preserved && incomingLifecycle === preserved && incomingLifecycle !== existingLifecycle) {
    return incoming.canonicalTruth?.lifecycleTimestamp ?? incoming.updatedAt ?? new Date().toISOString();
  }
  const incomingInferred = inferLifecycleStateFromAuthority(incoming);
  if (preserved && incomingInferred === preserved) {
    return inferLifecycleTimestampFromAuthority(incoming) ?? incoming.canonicalTruth?.lifecycleTimestamp ?? incoming.updatedAt;
  }
  const existingInferred = inferLifecycleStateFromAuthority(existing);
  if (preserved && existingInferred === preserved) {
    return inferLifecycleTimestampFromAuthority(existing) ?? existing?.canonicalTruth?.lifecycleTimestamp ?? existing?.updatedAt;
  }
  return existing?.canonicalTruth?.lifecycleTimestamp ?? incoming.canonicalTruth?.lifecycleTimestamp ?? incoming.updatedAt;
}

export function mergeScopeVersionLifecycle(existing: ScopeVersion | null | undefined, incoming: ScopeVersion): ScopeVersion {
  const incomingInferredLifecycle = inferLifecycleStateFromAuthority(incoming);
  if (!existing) {
    const lifecycleState = highestLifecycleState(
      highestLifecycleState(incoming.canonicalTruth?.lifecycleState, incoming.status),
      incomingInferredLifecycle
    );
    return {
      ...incoming,
      status: (lifecycleState ?? incoming.status) as ScopeVersionStatus,
      canonicalTruth: {
        ...(incoming.canonicalTruth ?? {}),
        lifecycleState: (lifecycleState ?? incoming.canonicalTruth?.lifecycleState) as ScopeVersionStatus,
        lifecycleTimestamp: inferLifecycleTimestampFromAuthority(incoming) ?? incoming.canonicalTruth?.lifecycleTimestamp ?? incoming.updatedAt ?? new Date().toISOString(),
      },
    };
  }

  const preservedStatus = highestLifecycleState(existing.status, incoming.status) as ScopeVersionStatus;
  const existingCanonicalLifecycle = existing.canonicalTruth?.lifecycleState;
  const incomingCanonicalLifecycle = incoming.canonicalTruth?.lifecycleState;
  const existingInferredLifecycle = inferLifecycleStateFromAuthority(existing);
  const preservedCanonicalLifecycle = highestLifecycleState(
    highestLifecycleState(existingCanonicalLifecycle, incomingCanonicalLifecycle),
    highestLifecycleState(existingInferredLifecycle, incomingInferredLifecycle)
  );
  const preservedTopLevelLifecycle = highestLifecycleState(preservedStatus, preservedCanonicalLifecycle) as ScopeVersionStatus;

  logBlockedRegression(incoming.scopeVersionId, "status", existing.status, incoming.status, preservedStatus);
  logBlockedRegression(
    incoming.scopeVersionId,
    "canonicalTruth.lifecycleState",
    existingCanonicalLifecycle,
    incomingCanonicalLifecycle,
    preservedCanonicalLifecycle
  );

  return {
    ...incoming,
    status: preservedTopLevelLifecycle,
    canonicalTruth: {
      ...(incoming.canonicalTruth ?? {}),
      lifecycleState: (preservedCanonicalLifecycle ?? incoming.canonicalTruth?.lifecycleState) as ScopeVersionStatus,
      lifecycleTimestamp: lifecycleTimestamp(existing, incoming, preservedCanonicalLifecycle),
    },
  };
}

export function reconcileScopeVersionLifecycle(scopeVersion: ScopeVersion): ScopeVersion {
  return mergeScopeVersionLifecycle(null, scopeVersion);
}

export function transitionScopeVersionLifecycle(
  scopeVersion: ScopeVersion,
  nextLifecycleState: ScopeVersionStatus,
  timestamp = new Date().toISOString()
): ScopeVersion {
  const lifecycleState = normalizeLifecycleState(nextLifecycleState) as ScopeVersionStatus;
  return mergeScopeVersionLifecycle(scopeVersion, {
    ...scopeVersion,
    status: lifecycleState,
    updatedAt: timestamp,
    canonicalTruth: {
      ...(scopeVersion.canonicalTruth ?? {}),
      lifecycleState,
      lifecycleTimestamp: timestamp,
    },
  });
}
