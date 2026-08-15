import type {
  CommercialSourceWarning,
  DoctrineException,
  EngineeringQuantityImpactEvent,
  QuantityArtifactScope,
  QuantityAuthorityLevel,
  QuantityCandidate,
  QuantityDispositionAuditEvent,
  QuantityDispositionResult,
  QuantityDispositionType,
  QuantityEvidenceReference,
  QuantityReconciliation,
  QuantityReconciliationItem,
  QuantityReconciliationStatus,
  SourceCorrectionRecord,
} from "./QuantityReconciliationContracts";

export const QUANTITY_AUTHORITY_PRECEDENCE: QuantityAuthorityLevel[] = [
  "CERTIFIED_ENGINEERING",
  "APPROVED_PROJECT_EXCEPTION",
  "APPROVED_SOURCE_EVIDENCE",
  "MEASURED_GEOMETRY",
  "PRODUCT_DOCTRINE_DERIVATION",
  "COMMERCIAL_ASSUMPTION",
  "UNKNOWN",
];

function stableValue(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableValue).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableValue(record[key])}`).join(",")}}`;
}

export function deterministicQuantityHash(prefix: string, value: unknown) {
  const source = stableValue(value);
  let hashA = 2166136261;
  let hashB = 2246822519;
  for (let index = 0; index < source.length; index += 1) {
    const code = source.charCodeAt(index);
    hashA = Math.imul(hashA ^ code, 16777619);
    hashB = Math.imul(hashB ^ code, 3266489917);
  }
  return `${prefix}-${(hashA >>> 0).toString(16).padStart(8, "0")}${(hashB >>> 0).toString(16).padStart(8, "0")}`;
}

function delta(source?: number, derived?: number) {
  if (!Number.isFinite(source) || !Number.isFinite(derived)) return {};
  const deltaAbsolute = Number(source) - Number(derived);
  return {
    deltaAbsolute,
    deltaPercent: derived === 0 ? undefined : deltaAbsolute / Math.abs(Number(derived)) * 100,
  };
}

function candidate(args: {
  itemId: string;
  kind: "SOURCE" | "DERIVED";
  quantity?: number;
  unit: string;
  authority: QuantityAuthorityLevel;
  method: string;
  formula?: string;
  doctrineRule?: string;
  geometryAuthority?: string;
  evidenceRefs?: QuantityEvidenceReference[];
}): QuantityCandidate | null {
  if (!Number.isFinite(args.quantity)) return null;
  return {
    candidateId: `${args.itemId}:${args.kind}`,
    truthState: args.kind === "SOURCE" ? "OBSERVED" : "DERIVED",
    quantity: args.quantity,
    unit: args.unit,
    authority: args.authority,
    method: args.method,
    formula: args.formula,
    doctrineRule: args.doctrineRule,
    geometryAuthority: args.geometryAuthority,
    evidenceRefs: args.evidenceRefs ?? [],
  };
}

export type CreateQuantityItemInput = {
  objectClass: string;
  quantityType: string;
  unit: string;
  required?: boolean;
  sourceQuantity?: number;
  sourceAuthority?: string;
  sourceEvidence?: QuantityEvidenceReference[];
  derivedQuantity?: number;
  derivationMethod: string;
  derivationAuthority?: QuantityAuthorityLevel;
  derivationFormula?: string;
  doctrineRule?: string;
  geometryAuthority?: string;
  status: QuantityReconciliationStatus;
};

export function createQuantityReconciliation(args: {
  scope: QuantityArtifactScope;
  revisionId: string;
  sourceHash: string;
  items: CreateQuantityItemInput[];
  calculatedAt?: string;
}): QuantityReconciliation {
  const calculatedAt = args.calculatedAt ?? new Date().toISOString();
  const reconciliationId = `${args.scope.packageId}:QUANTITY-RECONCILIATION`;
  const items = args.items.map((input, index): QuantityReconciliationItem => {
    const reconciliationItemId = `${reconciliationId}:ITEM:${String(index + 1).padStart(3, "0")}:${input.quantityType}`;
    const sourceEvidence = input.sourceEvidence ?? [];
    return {
      ...args.scope,
      reconciliationItemId,
      objectClass: input.objectClass,
      quantityType: input.quantityType,
      unit: input.unit,
      required: input.required !== false,
      sourceCandidate: candidate({ itemId: reconciliationItemId, kind: "SOURCE", quantity: input.sourceQuantity, unit: input.unit, authority: "APPROVED_SOURCE_EVIDENCE", method: "source project evidence", evidenceRefs: sourceEvidence }),
      derivedCandidate: candidate({ itemId: reconciliationItemId, kind: "DERIVED", quantity: input.derivedQuantity, unit: input.unit, authority: input.derivationAuthority ?? "PRODUCT_DOCTRINE_DERIVATION", method: input.derivationMethod, formula: input.derivationFormula, doctrineRule: input.doctrineRule, geometryAuthority: input.geometryAuthority }),
      sourceQuantity: input.sourceQuantity,
      sourceAuthority: input.sourceAuthority ?? "PROJECT_EVIDENCE",
      sourceEvidenceRef: sourceEvidence[0]?.evidenceRef,
      derivedQuantity: input.derivedQuantity,
      derivationMethod: input.derivationMethod,
      derivationAuthority: input.derivationAuthority ?? "PRODUCT_DOCTRINE_DERIVATION",
      ...delta(input.sourceQuantity, input.derivedQuantity),
      status: input.status,
      disposition: null,
      revisionId: args.revisionId,
      sourceHash: args.sourceHash,
      auditState: input.status === "MATCH" ? "RESOLVED" : "BLOCKED",
    };
  });
  return evaluateQuantityReconciliation({
    ...args.scope,
    reconciliationId,
    revisionId: args.revisionId,
    sourceHash: args.sourceHash,
    items,
    status: "FAIL",
    resolvedCount: 0,
    requiredCount: items.filter((item) => item.required).length,
    exceptionIds: [],
    auditEventIds: [],
    commercialImpactEventIds: [],
    calculatedAt,
    calculationHash: "PENDING",
    noScopeVersionCreation: true,
    noExecutionAuthorization: true,
  });
}

function validResolvedItem(item: QuantityReconciliationItem) {
  if (item.status === "MATCH") return true;
  if (item.status !== "RESOLVED" || !item.disposition) return false;
  return Boolean(
    item.engineeringAuthority === "ENGINEERING"
    && item.engineeringReviewer
    && item.reviewedAt
    && item.decisionHash
    && item.disposition.reason
    && item.disposition.evidenceRefs.length,
  );
}

export function evaluateQuantityReconciliation(reconciliation: QuantityReconciliation): QuantityReconciliation {
  const requiredItems = reconciliation.items.filter((item) => item.required && item.status !== "SUPERSEDED");
  const resolvedCount = requiredItems.filter(validResolvedItem).length;
  const status = requiredItems.length > 0 && resolvedCount === requiredItems.length ? "PASS" : "FAIL";
  const calculatedAt = reconciliation.calculatedAt || new Date().toISOString();
  const calculationHash = deterministicQuantityHash("QRC", {
    reconciliationId: reconciliation.reconciliationId,
    revisionId: reconciliation.revisionId,
    items: requiredItems.map((item) => ({ id: item.reconciliationItemId, status: item.status, sourceHash: item.sourceHash, decisionHash: item.decisionHash })),
    status,
  });
  return { ...reconciliation, status, resolvedCount, requiredCount: requiredItems.length, calculatedAt, calculationHash };
}

const FINANCIAL_QUANTITY_CLASSES = new Set(["SPINE", "ROUTE_SEGMENT", "CONDUIT", "FIBER", "HANDHOLE", "SPLICE_CASE", "ILA_SITE"]);

export function dispositionQuantity(args: {
  reconciliation: QuantityReconciliation;
  reconciliationItemId: string;
  type: QuantityDispositionType;
  reviewer: string;
  engineeringAuthority: "ENGINEERING";
  reason: string;
  notes?: string;
  evidenceRefs: QuantityEvidenceReference[];
  reviewedAt?: string;
  approvedQuantity?: number;
  doctrineRule?: string;
  actualCondition?: string;
  expectedCondition?: string;
  impactSummary?: string;
  engineeringDesignBinding?: {
    station?: string;
    milepost?: number;
    spanLength?: number;
    opticalLoss?: number;
    facilityClass?: string;
    powerRequirement?: string;
    powerEvidenceRef?: string;
    designEvidenceRef?: string;
  };
}): QuantityDispositionResult {
  const current = args.reconciliation.items.find((item) => item.reconciliationItemId === args.reconciliationItemId);
  if (!current) throw new Error("Quantity reconciliation item was not found in the scoped package.");
  if (!args.reviewer.trim() || args.engineeringAuthority !== "ENGINEERING") throw new Error("Valid Engineering reviewer and authority are required.");
  if (!args.reason.trim()) throw new Error("Engineering disposition reason is required.");
  if (!args.evidenceRefs.length || args.evidenceRefs.some((evidence) => !evidence.evidenceRef || !evidence.sourceHash)) throw new Error("At least one attributable evidence reference is required.");

  const reviewedAt = args.reviewedAt ?? new Date().toISOString();
  let approvedQuantity: number | undefined;
  let approvedAuthority: QuantityAuthorityLevel | undefined;
  let nextStatus: QuantityReconciliationStatus = "ENGINEERING_REVIEW_REQUIRED";
  if (args.type === "ACCEPT_SOURCE") {
    if (!current.sourceCandidate || !Number.isFinite(current.sourceQuantity)) throw new Error("Source quantity is unavailable.");
    approvedQuantity = current.sourceQuantity;
    approvedAuthority = "CERTIFIED_ENGINEERING";
    nextStatus = "RESOLVED";
  } else if (args.type === "ACCEPT_DERIVED") {
    if (!current.derivedCandidate || !Number.isFinite(current.derivedQuantity)) throw new Error("Derived quantity is unavailable.");
    approvedQuantity = current.derivedQuantity;
    approvedAuthority = "CERTIFIED_ENGINEERING";
    nextStatus = "RESOLVED";
  } else if (args.type === "APPROVE_DOCTRINE_EXCEPTION") {
    approvedQuantity = args.approvedQuantity ?? current.sourceQuantity;
    if (!Number.isFinite(approvedQuantity) || !args.doctrineRule || !args.actualCondition || !args.expectedCondition || !args.impactSummary) {
      throw new Error("Doctrine rule, expected/actual condition, impact, and approved quantity are required.");
    }
    approvedAuthority = "APPROVED_PROJECT_EXCEPTION";
    nextStatus = "RESOLVED";
  } else if (args.type === "DEFINE_SPLICE_ARCHITECTURE" || args.type === "BIND_OPTICAL_DESIGN") {
    approvedQuantity = args.approvedQuantity;
    if (!Number.isFinite(approvedQuantity)) throw new Error("Engineering-derived approved quantity is required.");
    if (args.type === "BIND_OPTICAL_DESIGN") {
      const binding = args.engineeringDesignBinding;
      if (!binding?.station || !Number.isFinite(binding.milepost) || !binding.designEvidenceRef || !binding.powerEvidenceRef) {
        throw new Error("ILA station, milepost, design evidence, and power evidence are required for optical-design authority.");
      }
    }
    approvedAuthority = "CERTIFIED_ENGINEERING";
    nextStatus = "RESOLVED";
  }

  const decisionPayload = {
    reconciliationItemId: current.reconciliationItemId,
    type: args.type,
    sourceHash: current.sourceHash,
    sourceQuantity: current.sourceQuantity,
    derivedQuantity: current.derivedQuantity,
    approvedQuantity,
    approvedAuthority,
    reviewer: args.reviewer,
    reason: args.reason,
    evidenceRefs: args.evidenceRefs,
    reviewedAt,
    engineeringDesignBinding: args.engineeringDesignBinding,
  };
  const decisionHash = deterministicQuantityHash("QDS", decisionPayload);
  const disposition = {
    dispositionId: `${current.reconciliationItemId}:DISPOSITION:${decisionHash.slice(-12)}`,
    type: args.type,
    approvedQuantity,
    approvedAuthority,
    reason: args.reason,
    notes: args.notes,
    evidenceRefs: args.evidenceRefs,
    engineeringAuthority: "ENGINEERING" as const,
    engineeringReviewer: args.reviewer,
    reviewedAt,
    decisionHash,
    engineeringDesignBinding: args.engineeringDesignBinding ? {
      ...args.engineeringDesignBinding,
      engineeringAuthority: "ENGINEERING" as const,
    } : undefined,
  };
  const item: QuantityReconciliationItem = {
    ...current,
    status: nextStatus,
    disposition,
    dispositionReason: args.reason,
    approvedQuantity,
    engineeringAuthority: "ENGINEERING",
    engineeringReviewer: args.reviewer,
    reviewedAt,
    decisionHash,
    auditState: nextStatus === "RESOLVED" ? "RESOLVED" : "BLOCKED",
  };

  let doctrineException: DoctrineException | undefined;
  if (args.type === "APPROVE_DOCTRINE_EXCEPTION") {
    const exceptionPayload = {
      item: current.reconciliationItemId,
      doctrineRule: args.doctrineRule,
      expectedCondition: args.expectedCondition,
      actualCondition: args.actualCondition,
      reason: args.reason,
      impactSummary: args.impactSummary,
      evidenceRefs: args.evidenceRefs,
      reviewer: args.reviewer,
      createdAt: reviewedAt,
    };
    const exceptionHash = deterministicQuantityHash("QEX", exceptionPayload);
    doctrineException = {
      ...current,
      exceptionId: `${current.packageId}:DOCTRINE-EXCEPTION:${exceptionHash.slice(-12)}`,
      doctrineRule: args.doctrineRule!,
      objectClass: current.objectClass,
      expectedCondition: args.expectedCondition!,
      actualCondition: args.actualCondition!,
      reason: args.reason,
      impactSummary: args.impactSummary!,
      evidenceRefs: args.evidenceRefs,
      reviewer: args.reviewer,
      authority: "CERTIFIED_ENGINEERING",
      createdAt: reviewedAt,
      exceptionHash,
      status: "ACTIVE",
      globalDoctrineMutation: false,
    };
  }

  let sourceCorrection: SourceCorrectionRecord | undefined;
  if (args.type === "CORRECT_SOURCE") {
    const correctionPayload = { item: current.reconciliationItemId, original: current.sourceQuantity, proposed: args.approvedQuantity, reason: args.reason, reviewer: args.reviewer, reviewedAt };
    const correctionHash = deterministicQuantityHash("QCR", correctionPayload);
    sourceCorrection = {
      ...current,
      correctionId: `${current.packageId}:SOURCE-CORRECTION:${correctionHash.slice(-12)}`,
      reconciliationItemId: current.reconciliationItemId,
      originalSourceQuantity: current.sourceQuantity,
      proposedCorrectedQuantity: args.approvedQuantity,
      originalSourceHash: current.sourceHash,
      reason: args.reason,
      evidenceRefs: args.evidenceRefs,
      reviewer: args.reviewer,
      createdAt: reviewedAt,
      correctionHash,
      sourceMutation: false,
    };
  }

  const auditPayload = { action: args.type, previous: current.status, next: nextStatus, decisionHash, reviewedAt };
  const eventHash = deterministicQuantityHash("QAE", auditPayload);
  const auditEvent: QuantityDispositionAuditEvent = {
    ...current,
    auditEventId: `${current.packageId}:QUANTITY-AUDIT:${eventHash.slice(-12)}`,
    reconciliationItemId: current.reconciliationItemId,
    actor: args.reviewer,
    action: args.type,
    occurredAt: reviewedAt,
    previousState: current.status,
    newState: nextStatus,
    sourceValue: current.sourceQuantity,
    derivedValue: current.derivedQuantity,
    approvedValue: approvedQuantity,
    selectedAuthority: approvedAuthority,
    reason: args.reason,
    evidenceRefs: args.evidenceRefs,
    packageRevision: current.revisionId,
    previousDecisionHash: current.decisionHash,
    eventHash,
  };

  let commercialImpact: EngineeringQuantityImpactEvent | undefined;
  if (nextStatus === "RESOLVED" && FINANCIAL_QUANTITY_CLASSES.has(current.objectClass) && approvedQuantity !== current.derivedQuantity) {
    const impactPayload = { item: current.reconciliationItemId, previous: current.derivedQuantity, approved: approvedQuantity, reason: args.reason, reviewedAt };
    const impactHash = deterministicQuantityHash("QIM", impactPayload);
    commercialImpact = {
      ...current,
      impactEventId: `${current.packageId}:ENGINEERING-QUANTITY-IMPACT:${impactHash.slice(-12)}`,
      eventType: "ENGINEERING_QUANTITY_IMPACT",
      reconciliationItemId: current.reconciliationItemId,
      objectClass: current.objectClass,
      previousQuantity: current.derivedQuantity,
      approvedQuantity,
      delta: Number.isFinite(approvedQuantity) && Number.isFinite(current.derivedQuantity) ? Number(approvedQuantity) - Number(current.derivedQuantity) : undefined,
      unit: current.unit,
      potentialCostImpact: "UNKNOWN_REQUIRES_COMMERCIAL_AUTHORITY",
      commercialReviewRequired: true,
      reason: args.reason,
      createdAt: reviewedAt,
      impactHash,
      pricingMutation: false,
      requestCommercialRevision: args.type === "REQUEST_COMMERCIAL_REVISION",
    };
  }

  const reconciliation = evaluateQuantityReconciliation({
    ...args.reconciliation,
    revisionId: deterministicQuantityHash("QRR", { previous: args.reconciliation.revisionId, decisionHash }),
    items: args.reconciliation.items.map((candidateItem) => candidateItem.reconciliationItemId === item.reconciliationItemId ? item : candidateItem),
    exceptionIds: doctrineException ? [...args.reconciliation.exceptionIds, doctrineException.exceptionId] : args.reconciliation.exceptionIds,
    auditEventIds: [...args.reconciliation.auditEventIds, auditEvent.auditEventId],
    commercialImpactEventIds: commercialImpact ? [...args.reconciliation.commercialImpactEventIds, commercialImpact.impactEventId] : args.reconciliation.commercialImpactEventIds,
    calculatedAt: reviewedAt,
  });

  return { reconciliation, item, auditEvent, doctrineException, sourceCorrection, commercialImpact, commercialRevisionRequested: args.type === "REQUEST_COMMERCIAL_REVISION" };
}

export function createCommercialSourceWarnings(args: {
  scope: QuantityArtifactScope;
  sourceHash: string;
  validation: Array<{ item: string; difference?: number; status: string; outcome?: string }>;
}): CommercialSourceWarning[] {
  return args.validation.filter((item) => item.status.toUpperCase() !== "OK").map((item, index) => ({
    ...args.scope,
    warningId: `${args.scope.packageId}:COMMERCIAL-SOURCE-WARNING:${String(index + 1).padStart(3, "0")}`,
    warningType: "COMMERCIAL_SOURCE_WARNING",
    sourceField: item.item,
    difference: Number(item.difference ?? 0),
    message: item.outcome || `${item.item} requires Commercial source review.`,
    sourceHash: args.sourceHash,
    engineeringDispositionRequired: false,
    commercialRecalculationRequired: true,
  }));
}

export function recalculateConstitutionalQuantityGate(args: {
  reconciliation: QuantityReconciliation;
  otherGates: Record<string, "PASS" | "FAIL">;
}) {
  const quantityReconciliation = evaluateQuantityReconciliation(args.reconciliation);
  const gates = { ...args.otherGates, quantityReconciliation: quantityReconciliation.status };
  const constitutionalAssembly = Object.values(gates).every((status) => status === "PASS") ? "PASS" : "FAIL";
  return {
    quantityReconciliation,
    gates,
    constitutionalAssembly,
    draftIofCertificationReadiness: constitutionalAssembly === "PASS" ? "READY_FOR_ENGINEERING_CERTIFICATION" : "BLOCKED",
    scopeVersionReadiness: "FUTURE_AFTER_SIGNED_SERVICE_ORDER" as const,
    noScopeVersionCreation: true as const,
    noExecutionAuthorization: true as const,
  };
}
