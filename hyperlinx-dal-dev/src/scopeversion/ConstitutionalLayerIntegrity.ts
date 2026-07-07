import type {
  ClosureRecord,
  ControlWorkItem,
  FieldClosure,
  ScopeInfrastructureObject,
  ScopeVersion,
} from "../types/dal";
import type { ScopeVersionCloseEvent } from "./ScopeVersionCloseAuthority";
import { getAuthoritativeLifecycleState, lifecycleRank } from "./ScopeVersionLifecycleGuard";

export const CONSTITUTIONAL_LAYER_INTEGRITY_DOCTRINE_ID = "CONSTITUTIONAL_LAYER_INTEGRITY_DOCTRINE";
export const CONSTITUTIONAL_LAYER_INTEGRITY_DOCTRINE_PATH = "docs/cip/CONSTITUTIONAL_LAYER_INTEGRITY_DOCTRINE.md";

export const CONSTITUTIONAL_LAYER_CHAIN = [
  "CUSTOMER_ASK",
  "FULFILLMENT_REQUEST",
  "COMMERCIAL_PLANNING",
  "PRODUCT_DOCTRINE",
  "COMMERCIAL_AUDIT",
  "AUDIT_OBJECT_MANIFEST",
  "OBJECT_ADDRESSING",
  "SPINE_OBJECT_CATALOG",
  "PRODUCTION_DOCTRINE",
  "SPINE_OBJECT_INSTANTIATION",
  "KERNEL_EXECUTION_GRAPH",
  "CONSTITUTIONAL_ASSEMBLY",
  "DRAFT_IOF_PACKAGE",
  "ENGINEERING_CERTIFICATION",
  "PROPOSAL",
  "CUSTOMER_ACCEPTANCE",
  "SERVICE_ORDER",
  "CUSTOMER_SIGNATURE",
  "SCOPEVERSION",
  "MARKETPLACE",
  "CONTROL",
  "FIELD",
  "CLOSURE",
  "OPERATIONAL_TWIN",
  "OPERATIONAL_INTELLIGENCE",
  "PRISM_NEXT_FULFILLMENT_REQUEST",
] as const;

export type ConstitutionalLayer = typeof CONSTITUTIONAL_LAYER_CHAIN[number];

export type ConstitutionalLayerIntegrityBlockerCode =
  | "LIFECYCLE_STAGE_SKIPPED"
  | "MISSING_CUSTOMER_ACCEPTANCE_AUTHORITY"
  | "SERVICE_ORDER_WITHOUT_CUSTOMER_ACCEPTANCE"
  | "SCOPEVERSION_WITHOUT_SERVICE_ORDER"
  | "SCOPEVERSION_WITHOUT_SIGNED_SERVICE_ORDER"
  | "CUSTOMER_ACCEPTANCE_DIRECT_EXECUTION_TRUTH"
  | "FIELD_CLOSE_OUTSIDE_SCOPEVERSION"
  | "PAYMENT_ELIGIBLE_WITHOUT_VALIDATED_CLOSE";

export type ConstitutionalLayerIntegrityBlocker = {
  blockerId: string;
  code: ConstitutionalLayerIntegrityBlockerCode;
  severity: "BLOCKING";
  blockedLayer: ConstitutionalLayer;
  missingLayer?: ConstitutionalLayer;
  missingArtifacts: string[];
  requiredAuthority: string;
  nextLegalAction: string;
  message: string;
  doctrineId: typeof CONSTITUTIONAL_LAYER_INTEGRITY_DOCTRINE_ID;
  doctrinePath: typeof CONSTITUTIONAL_LAYER_INTEGRITY_DOCTRINE_PATH;
};

export type ConstitutionalLayerIntegrityResult = {
  status: "PASS" | "BLOCKED";
  allowed: boolean;
  blockers: ConstitutionalLayerIntegrityBlocker[];
  doctrineId: typeof CONSTITUTIONAL_LAYER_INTEGRITY_DOCTRINE_ID;
  doctrinePath: typeof CONSTITUTIONAL_LAYER_INTEGRITY_DOCTRINE_PATH;
};

export type ConstitutionalLayerIntegrityInput = {
  scopeVersion?: ScopeVersion | null;
  previousScopeVersion?: ScopeVersion | null;
  nextScopeVersion?: ScopeVersion | null;
  workItems?: ControlWorkItem[];
  closures?: Array<ClosureRecord | FieldClosure>;
  closeEvents?: ScopeVersionCloseEvent[];
  paymentCandidate?: unknown;
};

const SERVICE_ORDER_READY_STATUSES = new Set([
  "PASS",
  "READY",
  "CREATED",
  "APPROVED",
  "AUTHORIZED",
  "EXECUTED",
  "ACCEPTED",
  "COMPLETE",
  "COMPLETED",
]);

const CUSTOMER_ACCEPTED_STATUSES = new Set([
  "ACCEPTED",
  "CUSTOMER_ACCEPTED",
  "APPROVED",
  "PASS",
  "READY",
  "COMPLETE",
  "COMPLETED",
]);

const SERVICE_ORDER_SIGNED_STATUSES = new Set([
  "SIGNED",
  "CUSTOMER_SIGNED",
  "FULLY_SIGNED",
  "EXECUTED",
  "FULLY_EXECUTED",
  "COUNTERSIGNED",
  "COMPLETE",
  "COMPLETED",
]);

const PAYMENT_ELIGIBLE_STATUSES = new Set([
  "ELIGIBLE",
  "PAYMENT_ELIGIBLE",
  "ELIGIBLE_AFTER_SEGMENT_ACCEPTANCE",
  "ELIGIBLE_AFTER_VALIDATED_PAYMENT",
]);

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === "") return [];
  return [value];
}

function upper(value: unknown) {
  return String(value ?? "").trim().toUpperCase();
}

function truth(scopeVersion: ScopeVersion | null | undefined) {
  return asRecord(scopeVersion?.canonicalTruth);
}

function nestedRecord(source: Record<string, unknown>, ...keys: string[]): Record<string, unknown> | undefined {
  for (const key of keys) {
    const value = source[key];
    if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  }
  return undefined;
}

function nestedValue(source: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

function readinessItem(scopeVersion: ScopeVersion | null | undefined, key: string) {
  return asArray(truth(scopeVersion).downstreamReadiness ?? truth(scopeVersion).readiness).find((item) => {
    const record = asRecord(item);
    return upper(record.key) === upper(key);
  });
}

function readinessStatus(scopeVersion: ScopeVersion | null | undefined, key: string) {
  return upper(asRecord(readinessItem(scopeVersion, key)).status);
}

function executionGateStatus(scopeVersion: ScopeVersion | null | undefined, key: string) {
  return upper(asRecord(truth(scopeVersion).executionGate)[key]);
}

function serviceOrderRecord(scopeVersion: ScopeVersion | null | undefined) {
  const source = truth(scopeVersion);
  const top = asRecord(scopeVersion);
  return nestedRecord(source, "serviceOrder", "serviceOrderReference", "serviceOrderArtifact") ??
    nestedRecord(top, "serviceOrder", "serviceOrderReference", "serviceOrderArtifact") ??
    {};
}

function customerAcceptanceRecord(scopeVersion: ScopeVersion | null | undefined) {
  const source = truth(scopeVersion);
  const top = asRecord(scopeVersion);
  return nestedRecord(source, "customerAcceptance", "acceptedProposal", "proposalAcceptance", "customerApproval") ??
    nestedRecord(top, "customerAcceptance", "acceptedProposal", "proposalAcceptance", "customerApproval") ??
    {};
}

function scopeCloseRecords(scopeVersion: ScopeVersion | null | undefined): ClosureRecord[] {
  const byId = new Map<string, ClosureRecord>();
  [...(scopeVersion?.canonicalTruth?.closures ?? []), ...(scopeVersion?.closures ?? [])].forEach((closure) => {
    if (closure?.closureId) byId.set(closure.closureId, closure);
  });
  return Array.from(byId.values());
}

function isScopeClosure(value: ClosureRecord | FieldClosure): value is ClosureRecord {
  return Array.isArray((value as ClosureRecord).objectIds) || typeof (value as ClosureRecord).certifiedRouteId === "string";
}

function closureId(closure: ClosureRecord | FieldClosure) {
  return String((closure as ClosureRecord).closureId ?? (closure as FieldClosure).closureId ?? "UNKNOWN_CLOSE");
}

function scopeObjects(scopeVersion: ScopeVersion | null | undefined): ScopeInfrastructureObject[] {
  return Array.isArray(scopeVersion?.canonicalTruth?.objects)
    ? scopeVersion.canonicalTruth.objects.filter((object): object is ScopeInfrastructureObject => Boolean(object?.objectId))
    : [];
}

function isValidatedCloseEvent(close: ScopeVersionCloseEvent, scopeVersionId: string) {
  return close.scopeVersionId === scopeVersionId && close.immutable === true && Boolean(close.validatedAt);
}

function closeHasValidationSignal(close: ClosureRecord | FieldClosure | Record<string, unknown>) {
  const record = asRecord(close);
  const validationResult = asRecord(record.validationResult);
  return Boolean(
    record.validatedAt ||
      record.accepted === true ||
      record.immutable === true && record.accepted === true ||
      validationResult.accepted === true ||
      validationResult.status === "ACCEPTED",
  );
}

function blocker(input: Omit<ConstitutionalLayerIntegrityBlocker, "blockerId" | "severity" | "doctrineId" | "doctrinePath">): ConstitutionalLayerIntegrityBlocker {
  return {
    ...input,
    blockerId: [
      input.code,
      input.blockedLayer,
      input.missingLayer ?? "NO_MISSING_LAYER",
      ...input.missingArtifacts,
    ].join(":"),
    severity: "BLOCKING",
    doctrineId: CONSTITUTIONAL_LAYER_INTEGRITY_DOCTRINE_ID,
    doctrinePath: CONSTITUTIONAL_LAYER_INTEGRITY_DOCTRINE_PATH,
  };
}

export function isExecutionScopeVersion(scopeVersion: ScopeVersion | null | undefined) {
  if (!scopeVersion) return false;
  const source = upper(scopeVersion.source);
  const type = upper(scopeVersion.type);
  const authority = upper(truth(scopeVersion).constitutionalAuthority ?? truth(scopeVersion).authority);
  if (type === "INVENTORY" || type === "CANDIDATE") return false;
  return (
    type === "SCOPEVERSION_AUTHORITY" ||
    source === "CERTIFIEDIOFPACKAGE" ||
    source === "CERTIFIEDDRAFTIOFPACKAGE" ||
    Boolean(scopeVersion.certifiedDraftIofPackageId) ||
    Boolean(scopeVersion.certifiedIofPackageId) ||
    authority === "SCOPEVERSION_FROM_CERTIFIED_DRAFT_IOF_PACKAGE" ||
    authority === "SCOPEVERSION_FROM_CERTIFIED_IOF_PACKAGE" ||
    authority === "SCOPEVERSION_ORDER_FOR_EXECUTION" ||
    authority === "SCOPEVERSION_OPERATIONAL_BASELINE" ||
    authority === "CERTIFIED_SCOPEVERSION"
  );
}

export function hasCustomerAcceptanceAuthority(scopeVersion: ScopeVersion | null | undefined, closeEvents: readonly ScopeVersionCloseEvent[] = []) {
  if (!scopeVersion) return false;
  const source = truth(scopeVersion);
  const acceptance = customerAcceptanceRecord(scopeVersion);
  const serviceOrder = serviceOrderRecord(scopeVersion);
  const lifecycleState = upper(source.lifecycleState ?? scopeVersion.status);
  const directValue = nestedValue(
    source,
    "customerAcceptanceId",
    "customerAcceptanceCloseId",
    "acceptedProposalId",
    "proposalAcceptedAt",
    "customerAcceptedAt",
  );
  const recordValue = nestedValue(
    acceptance,
    "customerAcceptanceId",
    "customerAcceptanceCloseId",
    "acceptedProposalId",
    "acceptedAt",
    "customerAcceptedAt",
  );
  const serviceOrderReference = nestedValue(serviceOrder, "customerAcceptanceId", "customerAcceptanceCloseId", "acceptedProposalId");
  const status = upper(acceptance.status ?? acceptance.readiness ?? source.customerAcceptanceStatus ?? source.proposalStatus);
  return Boolean(
    closeEvents.some((close) => close.closeType === "CUSTOMER_ACCEPTANCE_CLOSE" && isValidatedCloseEvent(close, scopeVersion.scopeVersionId)) ||
      directValue ||
      recordValue ||
      serviceOrderReference ||
      CUSTOMER_ACCEPTED_STATUSES.has(status) ||
      lifecycleState === "CUSTOMER_ACCEPTED",
  );
}

export function hasServiceOrderAuthority(scopeVersion: ScopeVersion | null | undefined) {
  if (!scopeVersion) return false;
  const source = truth(scopeVersion);
  const serviceOrder = serviceOrderRecord(scopeVersion);
  const top = asRecord(scopeVersion);
  const directValue = nestedValue(
    source,
    "serviceOrderId",
    "serviceOrderArtifactId",
    "serviceOrderReferenceId",
    "serviceOrderCreatedAt",
    "serviceOrderAuthorizedAt",
  ) ?? nestedValue(top, "serviceOrderId", "serviceOrderArtifactId");
  const recordValue = nestedValue(serviceOrder, "serviceOrderId", "serviceOrderArtifactId", "orderId", "id", "createdAt", "authorizedAt");
  const status = upper(serviceOrder.status ?? serviceOrder.readiness ?? serviceOrder.authorizationStatus ?? source.serviceOrderStatus);
  return Boolean(
    directValue ||
      recordValue ||
      SERVICE_ORDER_READY_STATUSES.has(status) ||
      SERVICE_ORDER_READY_STATUSES.has(readinessStatus(scopeVersion, "serviceOrder")) ||
      SERVICE_ORDER_READY_STATUSES.has(executionGateStatus(scopeVersion, "serviceOrder")),
  );
}

export function hasSignedServiceOrderAuthority(scopeVersion: ScopeVersion | null | undefined) {
  if (!scopeVersion) return false;
  const source = truth(scopeVersion);
  const serviceOrder = serviceOrderRecord(scopeVersion);
  const top = asRecord(scopeVersion);
  const directValue = nestedValue(
    source,
    "signedServiceOrderId",
    "serviceOrderSignatureId",
    "customerSignatureId",
    "serviceOrderSignedAt",
    "customerSignedAt",
    "signedAt",
  ) ?? nestedValue(top, "signedServiceOrderId", "serviceOrderSignatureId", "customerSignatureId", "serviceOrderSignedAt", "customerSignedAt", "signedAt");
  const recordValue = nestedValue(
    serviceOrder,
    "signedServiceOrderId",
    "serviceOrderSignatureId",
    "signatureId",
    "customerSignatureId",
    "serviceOrderSignedAt",
    "customerSignedAt",
    "signedAt",
    "executedAt",
  );
  const status = upper(serviceOrder.signatureStatus ?? serviceOrder.customerSignatureStatus ?? serviceOrder.status ?? source.serviceOrderSignatureStatus);
  return Boolean(
    directValue ||
      recordValue ||
      SERVICE_ORDER_SIGNED_STATUSES.has(status) ||
      SERVICE_ORDER_SIGNED_STATUSES.has(readinessStatus(scopeVersion, "customerSignature")) ||
      SERVICE_ORDER_SIGNED_STATUSES.has(readinessStatus(scopeVersion, "signedServiceOrder")) ||
      SERVICE_ORDER_SIGNED_STATUSES.has(executionGateStatus(scopeVersion, "customerSignature")) ||
      SERVICE_ORDER_SIGNED_STATUSES.has(executionGateStatus(scopeVersion, "signedServiceOrder")),
  );
}

export function hasPaymentEligibilityClaim(scopeVersion: ScopeVersion | null | undefined, paymentCandidate?: unknown) {
  const source = truth(scopeVersion);
  const candidates = [
    paymentCandidate,
    source.paymentEligibility,
    source.paymentStatus,
    source.revenueRealization,
    source.currentTruth,
    source.paymentSummary,
    source.paymentProjection,
    source.productionPaymentProjection,
    source.paymentSegments,
    source.paymentEligibilityRules,
  ];

  return candidates.some((candidate) => {
    if (candidate === true) return true;
    if (typeof candidate === "string") return PAYMENT_ELIGIBLE_STATUSES.has(upper(candidate));
    if (Array.isArray(candidate)) {
      return candidate.some((item) => {
        const record = asRecord(item);
        return record.paymentEligible === true ||
          record.eligible === true ||
          PAYMENT_ELIGIBLE_STATUSES.has(upper(record.paymentEligibility ?? record.status));
      });
    }
    const record = asRecord(candidate);
    return record.paymentEligible === true ||
      record.eligible === true ||
      PAYMENT_ELIGIBLE_STATUSES.has(upper(record.paymentEligibility ?? record.revenueRealization ?? record.status));
  });
}

export function hasValidatedCloseEvidence(input: {
  scopeVersion?: ScopeVersion | null;
  closeEvents?: readonly ScopeVersionCloseEvent[];
  closures?: Array<ClosureRecord | FieldClosure>;
}) {
  const scopeVersionId = input.scopeVersion?.scopeVersionId ?? "";
  const closures = [...(input.closures ?? []), ...scopeCloseRecords(input.scopeVersion)];
  return Boolean(
    input.closeEvents?.some((close) => isValidatedCloseEvent(close, scopeVersionId)) ||
      closures.some((close) => closeHasValidationSignal(close as unknown as Record<string, unknown>)),
  );
}

export function validateConstitutionalLayerIntegrity(input: ConstitutionalLayerIntegrityInput): ConstitutionalLayerIntegrityResult {
  const scopeVersion = input.nextScopeVersion ?? input.scopeVersion ?? null;
  const blockers: ConstitutionalLayerIntegrityBlocker[] = [];

  if (input.previousScopeVersion && input.nextScopeVersion && input.previousScopeVersion.scopeVersionId === input.nextScopeVersion.scopeVersionId) {
    const previousState = getAuthoritativeLifecycleState(input.previousScopeVersion);
    const nextState = getAuthoritativeLifecycleState(input.nextScopeVersion);
    const previousRank = lifecycleRank(previousState);
    const nextRank = lifecycleRank(nextState);
    if (previousRank >= 0 && nextRank > previousRank + 1) {
      blockers.push(blocker({
        code: "LIFECYCLE_STAGE_SKIPPED",
        blockedLayer: "SCOPEVERSION",
        missingArtifacts: [`intermediate lifecycle transition between ${previousState} and ${nextState}`],
        requiredAuthority: "ScopeVersionTransitionAuthority",
        nextLegalAction: `Advance only to the next lawful lifecycle state after ${previousState}; do not jump directly to ${nextState}.`,
        message: `Lifecycle stage skip detected: ${previousState} -> ${nextState}.`,
      }));
    }
  }

  if (scopeVersion && isExecutionScopeVersion(scopeVersion)) {
    const hasCustomerAcceptance = hasCustomerAcceptanceAuthority(scopeVersion, input.closeEvents);
    const hasServiceOrder = hasServiceOrderAuthority(scopeVersion);
    const hasSignedServiceOrder = hasSignedServiceOrderAuthority(scopeVersion);

    if (!hasCustomerAcceptance) {
      blockers.push(blocker({
        code: "MISSING_CUSTOMER_ACCEPTANCE_AUTHORITY",
        blockedLayer: "SERVICE_ORDER",
        missingLayer: "CUSTOMER_ACCEPTANCE",
        missingArtifacts: ["validated CUSTOMER_ACCEPTANCE_CLOSE or accepted proposal artifact"],
        requiredAuthority: "Customer or Teralinx Sales",
        nextLegalAction: "Record and validate Customer Acceptance before creating a Service Order or execution ScopeVersion.",
        message: "Service Order and ScopeVersion authority require Customer Acceptance.",
      }));
    }

    if (hasServiceOrder && !hasCustomerAcceptance) {
      blockers.push(blocker({
        code: "SERVICE_ORDER_WITHOUT_CUSTOMER_ACCEPTANCE",
        blockedLayer: "SERVICE_ORDER",
        missingLayer: "CUSTOMER_ACCEPTANCE",
        missingArtifacts: ["validated CUSTOMER_ACCEPTANCE_CLOSE or accepted proposal artifact"],
        requiredAuthority: "Customer or Teralinx Sales",
        nextLegalAction: "Void or hold the Service Order until Customer Acceptance is validated.",
        message: "Service Order authority cannot exist before Customer Acceptance.",
      }));
    }

    if (!hasServiceOrder) {
      blockers.push(blocker({
        code: "SCOPEVERSION_WITHOUT_SERVICE_ORDER",
        blockedLayer: "SCOPEVERSION",
        missingLayer: "SERVICE_ORDER",
        missingArtifacts: ["Service Order artifact", "Service Order authority reference"],
        requiredAuthority: "Service Order authority",
        nextLegalAction: "Create or attach the Service Order, then request ScopeVersion creation.",
        message: "Execution ScopeVersion cannot be created before Service Order authority.",
      }));
    }

    if (hasServiceOrder && !hasSignedServiceOrder) {
      blockers.push(blocker({
        code: "SCOPEVERSION_WITHOUT_SIGNED_SERVICE_ORDER",
        blockedLayer: "SCOPEVERSION",
        missingLayer: "CUSTOMER_SIGNATURE",
        missingArtifacts: ["signed Service Order", "customer signature evidence"],
        requiredAuthority: "Signed Service Order authority",
        nextLegalAction: "Capture customer signature on the Service Order before requesting ScopeVersion creation.",
        message: "Execution ScopeVersion cannot be created before signed Service Order authority.",
      }));
    }

    if (hasCustomerAcceptance && !hasServiceOrder) {
      blockers.push(blocker({
        code: "CUSTOMER_ACCEPTANCE_DIRECT_EXECUTION_TRUTH",
        blockedLayer: "SCOPEVERSION",
        missingLayer: "SERVICE_ORDER",
        missingArtifacts: ["Service Order artifact"],
        requiredAuthority: "Service Order authority",
        nextLegalAction: "Convert Customer Acceptance into a Service Order before creating execution truth.",
        message: "Customer Acceptance cannot create ScopeVersion execution truth directly.",
      }));
    }
  }

  if (scopeVersion) {
    const validObjectIds = new Set(scopeObjects(scopeVersion).map((object) => object.objectId));
    const closures = [...(input.closures ?? []), ...scopeCloseRecords(scopeVersion)];
    closures.filter(isScopeClosure).forEach((closure) => {
      closure.objectIds.forEach((objectId) => {
        if (!validObjectIds.has(objectId)) {
          blockers.push(blocker({
            code: "FIELD_CLOSE_OUTSIDE_SCOPEVERSION",
            blockedLayer: "FIELD",
            missingLayer: "SCOPEVERSION",
            missingArtifacts: [`ScopeVersion object ${objectId}`],
            requiredAuthority: "ScopeVersion canonical object catalog",
            nextLegalAction: "Close only objects that exist in the selected ScopeVersion, or create a governed ScopeVersion amendment first.",
            message: `Field closure ${closureId(closure)} references object ${objectId} outside ScopeVersion ${scopeVersion.scopeVersionId}.`,
          }));
        }
      });
    });
  }

  if (scopeVersion && hasPaymentEligibilityClaim(scopeVersion, input.paymentCandidate) && !hasValidatedCloseEvidence(input)) {
    blockers.push(blocker({
      code: "PAYMENT_ELIGIBLE_WITHOUT_VALIDATED_CLOSE",
      blockedLayer: "CLOSURE",
      missingLayer: "CLOSURE",
      missingArtifacts: ["validated Close evidence"],
      requiredAuthority: "Closure authority",
      nextLegalAction: "Validate Close evidence before marking any payment or revenue segment eligible.",
      message: "Payment cannot become eligible without a validated Close.",
    }));
  }

  const unique = Array.from(new Map(blockers.map((item) => [item.blockerId, item])).values());
  return {
    status: unique.length ? "BLOCKED" : "PASS",
    allowed: unique.length === 0,
    blockers: unique,
    doctrineId: CONSTITUTIONAL_LAYER_INTEGRITY_DOCTRINE_ID,
    doctrinePath: CONSTITUTIONAL_LAYER_INTEGRITY_DOCTRINE_PATH,
  };
}
