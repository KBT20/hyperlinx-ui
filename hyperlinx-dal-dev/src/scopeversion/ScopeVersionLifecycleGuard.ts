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
  "FIELD_ACTIVE",
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
  IN_FIELD: "FIELD_ACTIVE",
  IN_CONSTRUCTION: "FIELD_ACTIVE",
  FIELD: "FIELD_ACTIVE",
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

function isExceptionState(state: unknown) {
  const normalized = normalizeLifecycleState(state);
  return Boolean(normalized && EXCEPTION_STATES.has(normalized));
}

export function lifecycleRank(state: unknown) {
  const normalized = normalizeLifecycleState(state);
  return normalized ? LIFECYCLE_RANKS.get(normalized) ?? -1 : -1;
}

function highestLifecycleState(existing: unknown, incoming: unknown) {
  if (isExceptionState(existing) || isExceptionState(incoming)) return incoming ?? existing;

  const existingRank = lifecycleRank(existing);
  const incomingRank = lifecycleRank(incoming);

  if (existingRank < 0 && incomingRank < 0) return incoming ?? existing;
  if (existingRank >= incomingRank && existingRank >= 0) return normalizeLifecycleState(existing) ?? existing;
  return normalizeLifecycleState(incoming) ?? incoming;
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

export function mergeScopeVersionLifecycle(existing: ScopeVersion | null | undefined, incoming: ScopeVersion): ScopeVersion {
  if (!existing) return incoming;

  const preservedStatus = highestLifecycleState(existing.status, incoming.status) as ScopeVersionStatus;
  const existingCanonicalLifecycle = existing.canonicalTruth?.lifecycleState;
  const incomingCanonicalLifecycle = incoming.canonicalTruth?.lifecycleState;
  const preservedCanonicalLifecycle = highestLifecycleState(existingCanonicalLifecycle, incomingCanonicalLifecycle);

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
    status: preservedStatus,
    canonicalTruth: {
      ...(incoming.canonicalTruth ?? {}),
      lifecycleState: preservedCanonicalLifecycle ?? incoming.canonicalTruth?.lifecycleState,
    },
  };
}
