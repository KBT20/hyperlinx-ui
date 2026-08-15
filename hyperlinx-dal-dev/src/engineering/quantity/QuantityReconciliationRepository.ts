import type {
  DoctrineException,
  EngineeringQuantityImpactEvent,
  QuantityArtifactScope,
  QuantityDispositionAuditEvent,
  QuantityDispositionResult,
  QuantityReconciliation,
  SourceCorrectionRecord,
} from "./QuantityReconciliationContracts";

type RepositoryRecord =
  | QuantityReconciliation
  | DoctrineException
  | EngineeringQuantityImpactEvent
  | QuantityDispositionAuditEvent
  | SourceCorrectionRecord;

type RepositoryCollection = "reconciliations" | "exceptions" | "audit-events" | "source-corrections" | "commercial-impacts";

const memoryStore = new Map<string, string>();

function storage() {
  if (typeof localStorage !== "undefined") return localStorage;
  return {
    getItem: (key: string) => memoryStore.get(key) ?? null,
    setItem: (key: string, value: string) => { memoryStore.set(key, value); },
  };
}

function scopedPrefix(scope: Pick<QuantityArtifactScope, "organizationId" | "tenantId" | "customerId" | "opportunityId" | "packageId">) {
  return [scope.organizationId, scope.tenantId, scope.customerId, scope.opportunityId, scope.packageId]
    .map((value) => encodeURIComponent(value))
    .join(":");
}

function key(scope: QuantityArtifactScope, collection: RepositoryCollection) {
  return `teralinx:engineering-quantity:${scopedPrefix(scope)}:${collection}`;
}

function scoped(record: RepositoryRecord, scope: QuantityArtifactScope) {
  return record.organizationId === scope.organizationId
    && record.tenantId === scope.tenantId
    && record.customerId === scope.customerId
    && record.opportunityId === scope.opportunityId
    && record.packageId === scope.packageId;
}

function immutableCopy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function read<T extends RepositoryRecord>(scope: QuantityArtifactScope, collection: RepositoryCollection): T[] {
  const raw = storage().getItem(key(scope, collection));
  if (!raw) return [];
  const records = JSON.parse(raw) as T[];
  return records.filter((record) => scoped(record, scope)).map(immutableCopy);
}

function append<T extends RepositoryRecord>(scope: QuantityArtifactScope, collection: RepositoryCollection, record: T, id: keyof T) {
  if (!scoped(record, scope)) throw new Error("Cross-tenant quantity artifact persistence is prohibited.");
  const records = read<T>(scope, collection);
  const recordId = String(record[id]);
  if (records.some((candidate) => String(candidate[id]) === recordId)) return immutableCopy(record);
  storage().setItem(key(scope, collection), JSON.stringify([...records, immutableCopy(record)]));
  return immutableCopy(record);
}

export class QuantityReconciliationRepository {
  saveInitial(reconciliation: QuantityReconciliation) {
    return append(reconciliation, "reconciliations", reconciliation, "revisionId");
  }

  saveDisposition(result: QuantityDispositionResult) {
    const scope = result.reconciliation;
    append(scope, "reconciliations", result.reconciliation, "revisionId");
    append(scope, "audit-events", result.auditEvent, "auditEventId");
    if (result.doctrineException) append(scope, "exceptions", result.doctrineException, "exceptionId");
    if (result.sourceCorrection) append(scope, "source-corrections", result.sourceCorrection, "correctionId");
    if (result.commercialImpact) append(scope, "commercial-impacts", result.commercialImpact, "impactEventId");
    return immutableCopy(result);
  }

  listRevisions(scope: QuantityArtifactScope) {
    return read<QuantityReconciliation>(scope, "reconciliations");
  }

  latest(scope: QuantityArtifactScope) {
    return this.listRevisions(scope).at(-1) ?? null;
  }

  listExceptions(scope: QuantityArtifactScope) {
    return read<DoctrineException>(scope, "exceptions");
  }

  listAuditEvents(scope: QuantityArtifactScope) {
    return read<QuantityDispositionAuditEvent>(scope, "audit-events");
  }

  listSourceCorrections(scope: QuantityArtifactScope) {
    return read<SourceCorrectionRecord>(scope, "source-corrections");
  }

  listCommercialImpacts(scope: QuantityArtifactScope) {
    return read<EngineeringQuantityImpactEvent>(scope, "commercial-impacts");
  }

  getForScope(scope: QuantityArtifactScope, reconciliationId: string) {
    return this.listRevisions(scope).filter((record) => record.reconciliationId === reconciliationId).at(-1) ?? null;
  }
}

export const quantityReconciliationRepository = new QuantityReconciliationRepository();
