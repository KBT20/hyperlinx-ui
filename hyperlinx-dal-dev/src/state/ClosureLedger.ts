import type { ConstitutionalLifecycleState, DomainAuthority } from "./ObjectTransitionEngine";

export const CONSTITUTIONAL_CLOSURE_LEDGER_AUTHORITY = "CLOSURE_LEDGER" as const;
export const CLOSURE_LEDGER_VERSION = "39.0" as const;

export type ClosureLedgerEvidence = {
  evidenceId: string;
  evidenceType?: string;
  status?: "PASS" | "FAIL" | "PENDING";
};

export type ConstitutionalClosureEvent = {
  closureId: string;
  timestamp: string;
  objectId?: string;
  spanId?: string;
  closureSegmentId?: string;
  fromState: ConstitutionalLifecycleState;
  toState: ConstitutionalLifecycleState;
  domain: DomainAuthority;
  authority: DomainAuthority;
  actor: string;
  evidence: ClosureLedgerEvidence[];
  evidenceIds: string[];
  geometryAuthorityId: string;
  scopeVersionId?: string;
  stationRange?: {
    startStation?: string;
    endStation?: string;
    startMeasure?: number;
    endMeasure?: number;
  };
  reason: string;
  auditHash: string;
  immutable: true;
  ledgerAuthority: typeof CONSTITUTIONAL_CLOSURE_LEDGER_AUTHORITY;
};

export type ConstitutionalClosureLedger = {
  closureLedgerId: string;
  scopeVersionId?: string;
  geometryAuthorityId?: string;
  closureEvents: ConstitutionalClosureEvent[];
  eventCount: number;
  ledgerHash: string;
  authority: typeof CONSTITUTIONAL_CLOSURE_LEDGER_AUTHORITY;
  immutableAfterCreation: true;
  appendOnly: true;
  replayable: true;
};

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
    .join(",")}}`;
}

export function closureLedgerHash(value: unknown) {
  const json = stableStringify(value);
  let hash = 2166136261;
  for (let index = 0; index < json.length; index += 1) {
    hash ^= json.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `closure-hash-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function createConstitutionalClosureLedger(input: {
  closureLedgerId: string;
  scopeVersionId?: string;
  geometryAuthorityId?: string;
  closureEvents?: ConstitutionalClosureEvent[];
}) {
  const closureEvents = [...(input.closureEvents ?? [])].sort((left, right) => left.timestamp.localeCompare(right.timestamp));
  return {
    closureLedgerId: input.closureLedgerId,
    scopeVersionId: input.scopeVersionId,
    geometryAuthorityId: input.geometryAuthorityId,
    closureEvents,
    eventCount: closureEvents.length,
    ledgerHash: closureLedgerHash(closureEvents),
    authority: CONSTITUTIONAL_CLOSURE_LEDGER_AUTHORITY,
    immutableAfterCreation: true,
    appendOnly: true,
    replayable: true,
  } satisfies ConstitutionalClosureLedger;
}

export function appendClosureEvent(
  ledger: ConstitutionalClosureLedger,
  event: ConstitutionalClosureEvent,
) {
  return createConstitutionalClosureLedger({
    closureLedgerId: ledger.closureLedgerId,
    scopeVersionId: ledger.scopeVersionId,
    geometryAuthorityId: ledger.geometryAuthorityId,
    closureEvents: [...ledger.closureEvents, event],
  });
}

export function closureEventsForEntity(
  ledger: ConstitutionalClosureLedger,
  entityId: string,
) {
  return ledger.closureEvents.filter((event) => (
    event.objectId === entityId
    || event.spanId === entityId
    || event.closureSegmentId === entityId
  ));
}

export function validateClosureLedgerImmutability(
  previous: ConstitutionalClosureLedger,
  next: ConstitutionalClosureLedger,
) {
  const previousEvents = previous.closureEvents.map((event) => event.auditHash);
  const nextPrefix = next.closureEvents.slice(0, previousEvents.length).map((event) => event.auditHash);
  const prefixPreserved = previousEvents.every((hash, index) => nextPrefix[index] === hash);
  return {
    status: prefixPreserved && next.closureEvents.length >= previous.closureEvents.length ? "PASS" : "FAIL",
    previousEventCount: previous.closureEvents.length,
    nextEventCount: next.closureEvents.length,
    prefixPreserved,
    immutableAfterCreation: next.immutableAfterCreation,
    appendOnly: next.appendOnly,
    authority: CONSTITUTIONAL_CLOSURE_LEDGER_AUTHORITY,
  } as const;
}
