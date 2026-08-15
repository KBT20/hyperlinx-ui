import { createHash } from "node:crypto";
import {
  DIRS,
  errorResponse,
  handleOptions,
  jsonResponse,
  listRecords,
  loadRecord,
  nowIso,
  persistRecord,
  readRequestJson,
  recordPath,
  routeMatch,
  sortedByUpdated,
  unwrapBody,
} from "./_shared.js";
import { requireAnyPermission } from "./authority.js";

const BASE_PATH = "/api/engineering/certification-ledger";
const REFERENCE_ONLY_PAYLOAD_LIMIT_BYTES = 24 * 1024;

export const CertificationAuthority = {
  endpoint: BASE_PATH,
  repositoryIdentifier: "CERTIFICATION_LEDGER",
  authoritySource: "ENGINEERING_CERTIFICATION",
  immutable: true,
  certifiedIofPackageProjectionOnly: true,
};

const ALLOWED_EVIDENCE_MANIFEST_KEYS = [
  "certificationEvidenceManifestId",
  "certificationId",
  "certificationLedgerId",
  "engineeringBaselineId",
  "engineeringRevisionId",
  "stationReviewId",
  "objectReviewId",
  "doctrineValidationId",
  "quantityValidationId",
  "dependencyValidationId",
  "engineeringNotesId",
  "reviewerCommentsId",
  "validationResultsId",
  "stationReviewReferences",
  "objectReviewReferences",
  "doctrineValidationReferences",
  "quantityValidationReferences",
  "dependencyValidationReferences",
  "engineeringNoteReferences",
  "reviewerCommentReferences",
  "validationResultReferences",
  "engineeringChangeSetIds",
  "evidenceReferences",
  "evidenceHash",
  "referenceOnly",
  "createdAt",
];

const ALLOWED_LEDGER_KEYS = [
  "certificationLedgerId",
  "certificationId",
  "engineeringBaselineId",
  "engineeringRevisionId",
  "engineeringRevisionHash",
  "engineeringApprovalId",
  "engineeringApprovalHash",
  "engineeringChangeSetIds",
  "commercialReleasePackageId",
  "commercialRevisionId",
  "commercialRevisionHash",
  "routeRepositoryId",
  "measuredCenterlineId",
  "stationProjectionId",
  "stationGraphId",
  "stationAuthorityIds",
  "engineeringObjectManifestId",
  "stationObjectManifestId",
  "projectedObjectManifestId",
  "closureLedgerId",
  "iofPackageTwinId",
  "executionGraphId",
  "lifecycleGraphId",
  "commercialAuditStatus",
  "constitutionalStateValidationStatus",
  "proposalId",
  "estimateId",
  "workbookId",
  "productDoctrineId",
  "engineeringDoctrineId",
  "certificationEvidenceManifestId",
  "certificationEvidenceManifest",
  "certificationEvidenceHash",
  "certificationTimestamp",
  "certifiedBy",
  "certifiedById",
  "reviewStatus",
  "engineeringDoctrineVersion",
  "commercialDoctrineVersion",
  "stationProjectionHash",
  "objectManifestHash",
  "packageHash",
  "certificationHash",
  "result",
  "certifiedPackageId",
  "certifiedIofPackageProjectionId",
  "certifiedPackageHash",
  "authority",
  "repositoryType",
  "immutable",
  "appendOnly",
  "referenceOnly",
  "certificationLedgerAuthority",
  "certifiedIofPackageProjectionOnly",
  "noScopeVersionCreation",
  "noServiceOrderCreation",
  "noRuntimePromotion",
  "noCommercialMutation",
  "noEngineeringBaselineMutation",
  "noEngineeringRevisionMutation",
  "noEngineeringChangeSetMutation",
  "createdAt",
  "updatedAt",
];

const FORBIDDEN_LEDGER_FIELDS = [
  "commercialGeometry",
  "convertedRuntimeGeometry",
  "routeGeometry",
  "stationPlan",
  "stations",
  "objectAssignments",
  "engineeringApprovedObjectBudget",
  "objectBudgets",
  "engineeringRevisionProjection",
  "proposalBody",
  "workbookBody",
  "estimateBody",
  "draftIofPackage",
  "draftIOFPackage",
  "draftPackage",
  "engineeringPackage",
  "commercialReleasePackage",
  "commercialRevision",
  "scopeVersion",
  "runtimeCache",
];

const CERTIFIED_PACKAGE_REFERENCE_KEYS = [
  "certifiedPackageId",
  "certifiedIofPackageId",
  "packageId",
  "certificationLedgerId",
  "certificationId",
  "certificationHash",
  "packageHash",
  "certifiedPackageHash",
  "certificationEvidenceManifestId",
  "evidenceManifestId",
  "certificationEvidenceHash",
  "engineeringBaselineId",
  "engineeringRevisionId",
  "engineeringRevisionHash",
  "engineeringApprovalId",
  "engineeringApprovalHash",
  "engineeringChangeSetIds",
  "commercialReleasePackageId",
  "commercialRevisionId",
  "commercialRevisionHash",
  "routeRepositoryId",
  "measuredCenterlineId",
  "stationProjectionId",
  "stationGraphId",
  "stationAuthorityIds",
  "engineeringObjectManifestId",
  "stationObjectManifestId",
  "projectedObjectManifestId",
  "closureLedgerId",
  "iofPackageTwinId",
  "executionGraphId",
  "lifecycleGraphId",
  "commercialAuditStatus",
  "constitutionalStateValidationStatus",
  "geometryAuthorityDiagnostics",
  "iofArtifactRepositoryReferences",
  "proposalId",
  "estimateId",
  "workbookId",
  "productDoctrineId",
  "engineeringDoctrineId",
  "closeSequenceReferences",
  "evidenceRequirementReferences",
  "scopeVersionReadinessRequirementReferences",
  "certificationTimestamp",
  "certifiedAt",
  "certifiedBy",
  "certifiedById",
  "engineeringReviewer",
  "engineeringReviewerId",
  "reviewStatus",
  "result",
  "status",
  "workflowStatus",
  "lifecycleState",
  "authority",
  "repositoryType",
  "sourceAuthority",
  "engineeringTruthAuthority",
  "certifiedPackageAuthority",
  "certifiedDraftIofPackageId",
  "technicalSourcePackageId",
  "sourcePackageId",
  "sourceDraftPackageId",
  "opportunityId",
  "customerId",
  "accountId",
  "productId",
  "productName",
  "commercialReleaseState",
  "serviceOrderStatus",
  "signatureStatus",
  "scopeVersionStatus",
  "scopeVersionFuture",
  "readinessForSignedServiceOrder",
  "readinessForScopeVersionPromotion",
  "readyForCustomerCommitment",
  "referenceOnly",
  "projectionOnly",
  "immutable",
  "singleEngineeringTruth",
  "noDuplicatedRepositoryTruth",
  "noDuplicatedEngineeringObjects",
  "noEmbeddedCommercialTruth",
  "noEmbeddedEngineeringTruth",
  "noScopeVersionCreation",
  "noServiceOrderCreation",
  "noRuntimePromotion",
  "createdAt",
  "updatedAt",
  "readiness",
];

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === "") return [];
  return [value];
}

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function firstText(...values) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function unique(values) {
  return [...new Set(asArray(values).filter(Boolean).map(String))];
}

function stableIdPart(value, fallback = "UNKNOWN") {
  return String(value ?? fallback)
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || fallback;
}

function hashReference(value) {
  return createHash("sha256").update(JSON.stringify(value ?? null)).digest("hex");
}

function serializedByteSize(value) {
  return Buffer.byteLength(JSON.stringify(value ?? null), "utf8");
}

function assertAllowedKeys(record, allowedKeys, label) {
  const keys = Object.keys(record);
  const forbidden = keys.filter((key) => !allowedKeys.includes(key));
  if (forbidden.length) {
    const error = new Error(`${label} contains non-model field: ${forbidden[0]}`);
    error.status = 413;
    throw error;
  }
}

function assertReferenceOnly(record, label, allowedKeys) {
  assertAllowedKeys(record, allowedKeys, label);
  const forbidden = Object.keys(record).filter((key) => FORBIDDEN_LEDGER_FIELDS.includes(key));
  if (forbidden.length) {
    const error = new Error(`${label} contains duplicated repository truth: ${forbidden[0]}`);
    error.status = 413;
    throw error;
  }
  const serializedBytes = serializedByteSize(record);
  if (serializedBytes > REFERENCE_ONLY_PAYLOAD_LIMIT_BYTES) {
    const largest = Object.entries(record)
      .map(([key, value]) => ({ key, bytes: serializedByteSize(value) }))
      .sort((a, b) => b.bytes - a.bytes)[0];
    const error = new Error(`${label} exceeds reference-only threshold. Offending field: ${largest?.key ?? "unknown"} (${largest?.bytes ?? 0} bytes).`);
    error.status = 413;
    throw error;
  }
}

function referenceArrayId(prefix, certificationId) {
  return `${prefix}-${stableIdPart(certificationId)}`;
}

export function CertificationEvidenceManifest(input = {}) {
  const timestamp = firstText(input.createdAt, input.certificationTimestamp, nowIso());
  const certificationId = firstText(input.certificationId, `ENG-CERT-${stableIdPart(input.certifiedPackageId)}`);
  const certificationLedgerId = firstText(input.certificationLedgerId, `CERT-LEDGER-${stableIdPart(certificationId)}`);
  const engineeringChangeSetIds = unique(input.engineeringChangeSetIds);
  const stationReviewReferences = unique([
    input.stationReviewId,
    input.stationPlanId,
    input.stationProjectionId,
    input.stationProjectionHash ? `STATION-PROJECTION-HASH:${input.stationProjectionHash}` : "",
  ]);
  const objectReviewReferences = unique([
    input.objectReviewId,
    input.objectManifestId,
    input.objectManifestHash ? `OBJECT-MANIFEST-HASH:${input.objectManifestHash}` : "",
  ]);
  const doctrineValidationReferences = unique([
    input.doctrineValidationId,
    input.engineeringDoctrineId,
    input.commercialDoctrineId,
    input.engineeringDoctrineVersion,
    input.commercialDoctrineVersion,
  ]);
  const quantityValidationReferences = unique([input.quantityValidationId, input.engineeringApprovedBudgetId, input.budgetId]);
  const dependencyValidationReferences = unique([input.dependencyValidationId, input.dependencyGraphId]);
  const engineeringNoteReferences = unique([input.engineeringNotesId, input.engineeringNoteId]);
  const reviewerCommentReferences = unique([input.reviewerCommentsId, input.reviewerCommentId]);
  const validationResultReferences = unique([input.validationResultsId, input.validationId, input.certificationHash]);
  const evidenceReferences = unique([
    ...stationReviewReferences,
    ...objectReviewReferences,
    ...doctrineValidationReferences,
    ...quantityValidationReferences,
    ...dependencyValidationReferences,
    ...engineeringNoteReferences,
    ...reviewerCommentReferences,
    ...validationResultReferences,
    ...engineeringChangeSetIds,
    input.engineeringCertificationEvidenceId,
  ]);
  const manifest = {
    certificationEvidenceManifestId: firstText(input.certificationEvidenceManifestId, `CERT-EVIDENCE-MANIFEST-${stableIdPart(certificationId)}`),
    certificationId,
    certificationLedgerId,
    engineeringBaselineId: firstText(input.engineeringBaselineId),
    engineeringRevisionId: firstText(input.engineeringRevisionId),
    stationReviewId: firstText(input.stationReviewId, input.stationPlanId, referenceArrayId("STATION-REVIEW", certificationId)),
    objectReviewId: firstText(input.objectReviewId, input.objectManifestId, referenceArrayId("OBJECT-REVIEW", certificationId)),
    doctrineValidationId: firstText(input.doctrineValidationId, referenceArrayId("DOCTRINE-VALIDATION", certificationId)),
    quantityValidationId: firstText(input.quantityValidationId, input.engineeringApprovedBudgetId, referenceArrayId("QUANTITY-VALIDATION", certificationId)),
    dependencyValidationId: firstText(input.dependencyValidationId, referenceArrayId("DEPENDENCY-VALIDATION", certificationId)),
    engineeringNotesId: firstText(input.engineeringNotesId, referenceArrayId("ENGINEERING-NOTES", certificationId)),
    reviewerCommentsId: firstText(input.reviewerCommentsId, referenceArrayId("REVIEWER-COMMENTS", certificationId)),
    validationResultsId: firstText(input.validationResultsId, referenceArrayId("VALIDATION-RESULTS", certificationId)),
    stationReviewReferences,
    objectReviewReferences,
    doctrineValidationReferences,
    quantityValidationReferences,
    dependencyValidationReferences,
    engineeringNoteReferences,
    reviewerCommentReferences,
    validationResultReferences,
    engineeringChangeSetIds,
    evidenceReferences,
    evidenceHash: hashReference({ certificationId, evidenceReferences }),
    referenceOnly: true,
    createdAt: timestamp,
  };
  assertReferenceOnly(manifest, "CertificationEvidenceManifest", ALLOWED_EVIDENCE_MANIFEST_KEYS);
  return manifest;
}

export function CertificationLedgerValidator(record = {}) {
  const errors = [];
  const required = [
    "certificationId",
    "engineeringBaselineId",
    "engineeringRevisionId",
    "engineeringRevisionHash",
    "commercialReleasePackageId",
    "commercialRevisionId",
    "commercialRevisionHash",
    "certificationEvidenceHash",
    "certificationTimestamp",
    "certifiedBy",
    "reviewStatus",
    "engineeringDoctrineVersion",
    "commercialDoctrineVersion",
    "stationProjectionHash",
    "objectManifestHash",
    "closureLedgerId",
    "iofPackageTwinId",
    "executionGraphId",
    "lifecycleGraphId",
    "commercialAuditStatus",
    "constitutionalStateValidationStatus",
    "packageHash",
    "result",
    "certifiedPackageId",
  ];
  for (const key of required) {
    if (!firstText(record[key])) errors.push(`Certification Ledger missing ${key}.`);
  }
  if (record.immutable !== true) errors.push("Certification Ledger must be immutable.");
  if (record.authority !== "CERTIFICATION_LEDGER") errors.push("Certification Ledger authority must be CERTIFICATION_LEDGER.");
  if (record.repositoryType !== "CERTIFICATION_LEDGER") errors.push("Certification Ledger repositoryType must be CERTIFICATION_LEDGER.");
  return {
    valid: errors.length === 0,
    errors,
  };
}

export function certificationLedgerEntryForRepository(input = {}) {
  const timestamp = firstText(input.certificationTimestamp, input.createdAt, nowIso());
  const certifiedPackageId = firstText(input.certifiedPackageId, input.certifiedIofPackageId);
  const certificationId = firstText(input.certificationId, `ENG-CERT-${stableIdPart(certifiedPackageId)}`);
  const certificationLedgerId = firstText(input.certificationLedgerId, `CERT-LEDGER-${stableIdPart(certificationId)}`);
  const evidenceManifest = CertificationEvidenceManifest({
    ...asRecord(input.certificationEvidenceManifest),
    ...input,
    certificationId,
    certificationLedgerId,
    certifiedPackageId,
    certificationTimestamp: timestamp,
  });
  const engineeringChangeSetIds = unique(input.engineeringChangeSetIds);
  const referencePayload = {
    certificationId,
    engineeringBaselineId: firstText(input.engineeringBaselineId),
    engineeringRevisionId: firstText(input.engineeringRevisionId),
    engineeringRevisionHash: firstText(input.engineeringRevisionHash),
    engineeringApprovalId: firstText(input.engineeringApprovalId),
    engineeringApprovalHash: firstText(input.engineeringApprovalHash),
    commercialReleasePackageId: firstText(input.commercialReleasePackageId),
    commercialRevisionId: firstText(input.commercialRevisionId),
    commercialRevisionHash: firstText(input.commercialRevisionHash),
    routeRepositoryId: firstText(input.routeRepositoryId),
    measuredCenterlineId: firstText(input.measuredCenterlineId),
    stationProjectionId: firstText(input.stationProjectionId),
    stationGraphId: firstText(input.stationGraphId),
    stationAuthorityIds: unique(input.stationAuthorityIds),
    engineeringObjectManifestId: firstText(input.engineeringObjectManifestId),
    stationObjectManifestId: firstText(input.stationObjectManifestId),
    projectedObjectManifestId: firstText(input.projectedObjectManifestId),
    closureLedgerId: firstText(input.closureLedgerId),
    iofPackageTwinId: firstText(input.iofPackageTwinId),
    executionGraphId: firstText(input.executionGraphId),
    lifecycleGraphId: firstText(input.lifecycleGraphId),
    commercialAuditStatus: firstText(input.commercialAuditStatus),
    constitutionalStateValidationStatus: firstText(input.constitutionalStateValidationStatus),
    proposalId: firstText(input.proposalId),
    estimateId: firstText(input.estimateId),
    workbookId: firstText(input.workbookId, input.commercialWorkbookId),
    productDoctrineId: firstText(input.productDoctrineId),
    engineeringDoctrineId: firstText(input.engineeringDoctrineId),
    evidenceHash: evidenceManifest.evidenceHash,
    certifiedPackageId,
    result: firstText(input.result, "CERTIFIED"),
  };
  const packageHash = firstText(input.packageHash, hashReference(referencePayload));
  const certificationHash = firstText(input.certificationHash, hashReference({
    ...referencePayload,
    packageHash,
    stationProjectionHash: input.stationProjectionHash,
    objectManifestHash: input.objectManifestHash,
    engineeringChangeSetIds,
    timestamp,
  }));
  const record = {
    certificationLedgerId,
    certificationId,
    engineeringBaselineId: referencePayload.engineeringBaselineId,
    engineeringRevisionId: referencePayload.engineeringRevisionId,
    engineeringRevisionHash: referencePayload.engineeringRevisionHash,
    engineeringApprovalId: referencePayload.engineeringApprovalId,
    engineeringApprovalHash: referencePayload.engineeringApprovalHash,
    engineeringChangeSetIds,
    commercialReleasePackageId: referencePayload.commercialReleasePackageId,
    commercialRevisionId: referencePayload.commercialRevisionId,
    commercialRevisionHash: referencePayload.commercialRevisionHash,
    routeRepositoryId: referencePayload.routeRepositoryId,
    measuredCenterlineId: referencePayload.measuredCenterlineId,
    stationProjectionId: referencePayload.stationProjectionId,
    stationGraphId: referencePayload.stationGraphId,
    stationAuthorityIds: referencePayload.stationAuthorityIds,
    engineeringObjectManifestId: referencePayload.engineeringObjectManifestId,
    stationObjectManifestId: referencePayload.stationObjectManifestId,
    projectedObjectManifestId: referencePayload.projectedObjectManifestId,
    closureLedgerId: referencePayload.closureLedgerId,
    iofPackageTwinId: referencePayload.iofPackageTwinId,
    executionGraphId: referencePayload.executionGraphId,
    lifecycleGraphId: referencePayload.lifecycleGraphId,
    commercialAuditStatus: referencePayload.commercialAuditStatus,
    constitutionalStateValidationStatus: referencePayload.constitutionalStateValidationStatus,
    proposalId: referencePayload.proposalId,
    estimateId: referencePayload.estimateId,
    workbookId: referencePayload.workbookId,
    productDoctrineId: referencePayload.productDoctrineId,
    engineeringDoctrineId: referencePayload.engineeringDoctrineId,
    certificationEvidenceManifestId: evidenceManifest.certificationEvidenceManifestId,
    certificationEvidenceManifest: evidenceManifest,
    certificationEvidenceHash: firstText(input.certificationEvidenceHash, evidenceManifest.evidenceHash),
    certificationTimestamp: timestamp,
    certifiedBy: firstText(input.certifiedBy, input.reviewer, "Engineering"),
    certifiedById: firstText(input.certifiedById, input.reviewerId),
    reviewStatus: firstText(input.reviewStatus, "ENGINEERING_CERTIFIED"),
    engineeringDoctrineVersion: firstText(input.engineeringDoctrineVersion, input.engineeringDoctrineId, "PD-006"),
    commercialDoctrineVersion: firstText(input.commercialDoctrineVersion, input.commercialDoctrineId, "PD-005"),
    stationProjectionHash: firstText(input.stationProjectionHash, hashReference({ stationProjectionId: input.stationProjectionId, stationPlanId: input.stationPlanId })),
    objectManifestHash: firstText(input.objectManifestHash, hashReference({ objectManifestId: input.objectManifestId, unitIds: input.certifiedIofUnitIds })),
    packageHash,
    certificationHash,
    result: referencePayload.result,
    certifiedPackageId,
    certifiedIofPackageProjectionId: firstText(input.certifiedIofPackageProjectionId, `CERT-IOF-PROJECTION-${stableIdPart(certifiedPackageId)}`),
    certifiedPackageHash: firstText(input.certifiedPackageHash, packageHash),
    authority: "CERTIFICATION_LEDGER",
    repositoryType: "CERTIFICATION_LEDGER",
    immutable: true,
    appendOnly: true,
    referenceOnly: true,
    certificationLedgerAuthority: true,
    certifiedIofPackageProjectionOnly: true,
    noScopeVersionCreation: true,
    noServiceOrderCreation: true,
    noRuntimePromotion: true,
    noCommercialMutation: true,
    noEngineeringBaselineMutation: true,
    noEngineeringRevisionMutation: true,
    noEngineeringChangeSetMutation: true,
    createdAt: firstText(input.createdAt, timestamp),
    updatedAt: firstText(input.updatedAt, timestamp),
  };
  assertReferenceOnly(record, "CertificationLedgerEntry", ALLOWED_LEDGER_KEYS);
  const validation = CertificationLedgerValidator(record);
  if (!validation.valid) {
    const error = new Error(`Certification Ledger validation failed: ${validation.errors.join("; ")}`);
    error.status = 400;
    throw error;
  }
  return record;
}

export function CertificationLedgerProjection(record = {}, context = {}) {
  const ledger = certificationLedgerEntryForRepository(record);
  const timestamp = firstText(context.timestamp, ledger.certificationTimestamp, nowIso());
  const projection = {
    certifiedPackageId: ledger.certifiedPackageId,
    certifiedIofPackageId: ledger.certifiedPackageId,
    packageId: ledger.certifiedPackageId,
    certificationLedgerId: ledger.certificationLedgerId,
    certificationId: ledger.certificationId,
    certificationHash: ledger.certificationHash,
    packageHash: ledger.packageHash,
    certifiedPackageHash: ledger.certifiedPackageHash,
    certificationEvidenceManifestId: ledger.certificationEvidenceManifestId,
    evidenceManifestId: ledger.certificationEvidenceManifestId,
    certificationEvidenceHash: ledger.certificationEvidenceHash,
    engineeringBaselineId: ledger.engineeringBaselineId,
    engineeringRevisionId: ledger.engineeringRevisionId,
    engineeringRevisionHash: ledger.engineeringRevisionHash,
    engineeringApprovalId: ledger.engineeringApprovalId,
    engineeringApprovalHash: ledger.engineeringApprovalHash,
    engineeringChangeSetIds: ledger.engineeringChangeSetIds,
    commercialReleasePackageId: ledger.commercialReleasePackageId,
    commercialRevisionId: ledger.commercialRevisionId,
    commercialRevisionHash: ledger.commercialRevisionHash,
    routeRepositoryId: ledger.routeRepositoryId,
    measuredCenterlineId: ledger.measuredCenterlineId,
    stationProjectionId: ledger.stationProjectionId,
    stationGraphId: ledger.stationGraphId,
    stationAuthorityIds: ledger.stationAuthorityIds,
    engineeringObjectManifestId: ledger.engineeringObjectManifestId,
    stationObjectManifestId: ledger.stationObjectManifestId,
    projectedObjectManifestId: ledger.projectedObjectManifestId,
    closureLedgerId: ledger.closureLedgerId,
    iofPackageTwinId: ledger.iofPackageTwinId,
    executionGraphId: ledger.executionGraphId,
    lifecycleGraphId: ledger.lifecycleGraphId,
    commercialAuditStatus: ledger.commercialAuditStatus,
    constitutionalStateValidationStatus: ledger.constitutionalStateValidationStatus,
    geometryAuthorityDiagnostics: asRecord(context.geometryAuthorityDiagnostics),
    iofArtifactRepositoryReferences: asRecord(context.iofArtifactRepositoryReferences),
    proposalId: ledger.proposalId,
    estimateId: ledger.estimateId,
    workbookId: ledger.workbookId,
    productDoctrineId: ledger.productDoctrineId,
    engineeringDoctrineId: ledger.engineeringDoctrineId,
    closeSequenceReferences: asArray(context.closeSequenceReferences),
    evidenceRequirementReferences: asArray(context.evidenceRequirementReferences),
    scopeVersionReadinessRequirementReferences: asArray(context.scopeVersionReadinessRequirementReferences),
    certificationTimestamp: ledger.certificationTimestamp,
    certifiedAt: ledger.certificationTimestamp,
    certifiedBy: ledger.certifiedBy,
    certifiedById: ledger.certifiedById,
    engineeringReviewer: ledger.certifiedBy,
    engineeringReviewerId: ledger.certifiedById,
    reviewStatus: ledger.reviewStatus,
    result: ledger.result,
    status: "CERTIFIED",
    workflowStatus: "CERTIFIED_IOF_PACKAGE",
    lifecycleState: "CERTIFIED",
    authority: "CERTIFIED_IOF_PACKAGE_PROJECTION",
    repositoryType: "CERTIFIED_IOF_PACKAGE_PROJECTION",
    sourceAuthority: "CERTIFICATION_LEDGER",
    engineeringTruthAuthority: "CERTIFICATION_LEDGER",
    certifiedPackageAuthority: "CERTIFICATION_LEDGER_PROJECTION",
    certifiedDraftIofPackageId: firstText(context.certifiedDraftIofPackageId, context.sourceDraftPackageId, context.draftIOFPackageId),
    technicalSourcePackageId: firstText(context.technicalSourcePackageId, context.certifiedDraftIofPackageId, context.sourceDraftPackageId),
    sourcePackageId: firstText(context.sourcePackageId, context.sourceDraftPackageId, context.draftIOFPackageId),
    sourceDraftPackageId: firstText(context.sourceDraftPackageId, context.draftIOFPackageId),
    opportunityId: firstText(context.opportunityId),
    customerId: firstText(context.customerId),
    accountId: firstText(context.accountId),
    productId: firstText(context.productId),
    productName: firstText(context.productName),
    commercialReleaseState: firstText(context.commercialReleaseState, "FROZEN"),
    serviceOrderStatus: "SERVICE_ORDER_READY",
    signatureStatus: "AWAITING_CUSTOMER_SIGNATURE",
    scopeVersionStatus: "BLOCKED_UNTIL_SIGNED_SERVICE_ORDER",
    scopeVersionFuture: true,
    readinessForSignedServiceOrder: true,
    readinessForScopeVersionPromotion: false,
    readyForCustomerCommitment: true,
    referenceOnly: true,
    projectionOnly: true,
    immutable: true,
    singleEngineeringTruth: true,
    noDuplicatedRepositoryTruth: true,
    noDuplicatedEngineeringObjects: true,
    noEmbeddedCommercialTruth: true,
    noEmbeddedEngineeringTruth: true,
    noScopeVersionCreation: true,
    noServiceOrderCreation: true,
    noRuntimePromotion: true,
    createdAt: firstText(context.createdAt, timestamp),
    updatedAt: timestamp,
    readiness: {
      status: "CERTIFIED_IOF_PACKAGE_READY",
      sourceAuthority: "CERTIFICATION_LEDGER",
      certificationLedgerId: ledger.certificationLedgerId,
      certificationHash: ledger.certificationHash,
      packageHash: ledger.packageHash,
      serviceOrderReady: true,
      awaitCustomerSignature: true,
      scopeVersionFuture: true,
      readyForScopeVersionCreation: false,
      scopeVersionCreated: false,
    },
  };
  assertReferenceOnly(projection, "CertifiedIofPackageProjection", CERTIFIED_PACKAGE_REFERENCE_KEYS);
  return projection;
}

export const CertifiedIofPackageProjection = CertificationLedgerProjection;

export async function persistCertificationLedgerEntry(input = {}) {
  const record = certificationLedgerEntryForRepository(input);
  const existing = await loadRecord(DIRS.certificationLedgers, record.certificationLedgerId).catch(() => null);
  if (existing && existing.certificationHash !== record.certificationHash) {
    const error = new Error(`Certification Ledger ${record.certificationLedgerId} is immutable and already exists with a different hash.`);
    error.status = 409;
    throw error;
  }
  return existing ?? persistRecord(DIRS.certificationLedgers, record.certificationLedgerId, record);
}

export async function loadCertificationLedgerEntry(certificationLedgerId) {
  return certificationLedgerEntryForRepository(await loadRecord(DIRS.certificationLedgers, certificationLedgerId));
}

export function certificationLedgerRepositoryFile(certificationLedgerId) {
  return recordPath(DIRS.certificationLedgers, certificationLedgerId);
}

export async function handleCertificationLedger(req, res, pathname) {
  const match = routeMatch(pathname, BASE_PATH);
  if (!match) return false;
  if (handleOptions(req, res)) return true;
  const readOnly = req.method === "GET";
  const user = readOnly
    ? requireAnyPermission(req, res, ["workspace.engineering.read", "workspace.engineering.write", "scopeversion.authority"], "You do not have authority to read Certification Ledger.")
    : requireAnyPermission(req, res, ["workspace.engineering.write", "scopeversion.authority"], "Only Engineering may write Certification Ledger entries.");
  if (!user) return true;

  if (match.base && req.method === "GET") {
    const records = sortedByUpdated((await listRecords(DIRS.certificationLedgers)).map(certificationLedgerEntryForRepository));
    jsonResponse(res, 200, { certificationLedger: records, certificationLedgerEntries: records, items: records });
    return true;
  }
  if (!match.base && req.method === "GET") {
    const record = await loadCertificationLedgerEntry(match.id).catch(() => null);
    if (!record) errorResponse(res, 404, `Certification Ledger entry not found: ${match.id}`);
    else jsonResponse(res, 200, { certificationLedgerEntry: record });
    return true;
  }
  if (match.base && req.method === "POST") {
    const body = await readRequestJson(req);
    const input = unwrapBody(body, "certificationLedgerEntry", ["certificationLedger", "item", "data"]) ?? {};
    const saved = await persistCertificationLedgerEntry({
      ...input,
      organizationId: user.organizationId,
      certifiedBy: user.name,
      certifiedById: user.userId,
      certifiedByPrincipalId: user.principalId ?? user.userId,
      certifiedByMembershipId: user.membershipId,
      certifiedBySessionId: user.sessionId,
      actorDisplayNameAtAction: user.displayName ?? user.name,
    });
    jsonResponse(res, 201, { certificationLedgerEntry: saved });
    return true;
  }
  errorResponse(res, 405, "Certification Ledger method not allowed.");
  return true;
}
