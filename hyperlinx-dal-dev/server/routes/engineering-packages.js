import { createHash } from "node:crypto";
import {
  DIRS,
  errorResponse,
  handleOptions,
  hydrateIofProjectionArtifacts,
  jsonResponse,
  listRecords,
  loadRecord,
  nowIso,
  persistRecord,
  readRequestJsonWithRaw,
  recordPath,
  sortedByUpdated,
  unwrapBody,
} from "./_shared.js";
import { requireAnyPermission } from "./authority.js";
import { loadCommercialReleasePackage } from "./commercial-revisions.js";
import { loadEngineeringBaseline } from "./engineering-baselines.js";

const BASE_PATH = "/api/engineering/packages";
const TERMINAL_STATUSES = new Set(["ENGINEERING_CERTIFIED", "CERTIFIED", "CLOSED", "ARCHIVED"]);
const REFERENCE_ONLY_PAYLOAD_LIMIT_BYTES = 16 * 1024;
const TRANSACTION_FILE = "server/routes/engineering-packages.js";
const ALLOWED_ENGINEERING_PACKAGE_KEYS = [
  "engineeringPackageId",
  "customerId",
  "customerTwinId",
  "opportunityId",
  "routeRepositoryId",
  "proposalId",
  "proposalRevisionId",
  "proposalRevisionNumber",
  "proposalHash",
  "commercialWorkbookId",
  "workbookId",
  "estimateId",
  "draftIOFPackageId",
  "engineeringBaselineId",
  "engineeringBaselineManifestId",
  "engineeringBaselineProjectionId",
  "engineeringBaselineHash",
  "baselineState",
  "derivedFromBaseline",
  "engineeringRevisionId",
  "engineeringRevisionSource",
  "engineeringRevisionState",
  "commercialRevisionId",
  "commercialReleasePackageId",
  "commercialRevisionHash",
  "commercialReleaseHash",
  "measuredCenterlineId",
  "stationProjectionId",
  "stationGraphId",
  "stationAuthorityIds",
  "stationObjectManifestId",
  "projectedObjectManifestId",
  "closureLedgerId",
  "iofPackageTwinId",
  "executionGraphId",
  "lifecycleGraphId",
  "workSegmentCount",
  "commercialAuditStatus",
  "constitutionalStateValidationStatus",
  "geometryAuthority",
  "singleGeometryAuthority",
  "noIndependentSpanGeometry",
  "doctrineObjectManifestId",
  "engineeringObjectManifestId",
  "doctrineMaterializedObjectCount",
  "stationObjectManifestCount",
  "doctrineQuantityScheduleCount",
  "doctrineManifestAuthority",
  "productDoctrineId",
  "submittedBy",
  "submittedById",
  "submittedAt",
  "commercialStatus",
  "engineeringStatus",
  "serviceOrderState",
  "scopeVersionState",
  "stationPlanId",
  "futureInventoryManifestId",
  "certifiedIOFPackageId",
  "referenceHash",
  "referenceIntegrity",
  "authority",
  "engineeringAuthority",
  "repositoryType",
  "referenceOnly",
  "noScopeVersionCreation",
  "createdAt",
  "updatedAt",
];

export const ENGINEERING_TRANSACTION_STEPS = {
  VALIDATE_COMMERCIAL_PACKAGE: 1,
  BUILD_ENGINEERING_BASELINE: 2.1,
  BUILD_ENGINEERING_PACKAGE: 2,
  SERIALIZE_ENGINEERING_PACKAGE: 3,
  POST_ENGINEERING_PACKAGES: 4,
  ENGINEERING_API_RECEIVES_REQUEST: 5,
  NORMALIZE_ENGINEERING_PACKAGE: 6,
  WRITE_ENGINEERING_REPOSITORY_JSON: 7,
  FLUSH_FILE: 8,
  RELOAD_ENGINEERING_PACKAGE: 9,
  VERIFY_ENGINEERING_PACKAGE: 10,
  UPDATE_COMMERCIAL_STATUS: 11,
  RETURN_ENGINEERING_PACKAGE_ID: 12,
};

function transactionLineNumber(label) {
  const lines = {
    "Request received": 5,
    "Build Engineering Baseline": 2,
    "Normalize Engineering Package": 6,
    "Write Engineering Repository JSON": 7,
    "Flush file": 8,
    "Reload Engineering Package": 9,
    "Verify Engineering Package": 10,
    "Return Engineering Package ID": 12,
  };
  return lines[label] ?? 0;
}

export function appendEngineeringTransactionStep(log = [], step, label, status = "OK", details = {}) {
  const entry = {
    step,
    label,
    status,
    file: details.file ?? TRANSACTION_FILE,
    lineNumber: details.lineNumber ?? transactionLineNumber(label),
    objectType: details.objectType ?? "EngineeringPackage",
    payloadSizeBytes: details.payloadSizeBytes,
    engineeringPackageId: details.engineeringPackageId,
    repositoryPath: details.repositoryPath,
    repositoryFilename: details.repositoryFilename,
    exception: details.exception,
    stackTrace: details.stackTrace,
    timestamp: nowIso(),
    details: details.details ?? undefined,
  };
  log.push(entry);
  console.info(`[EngineeringTransaction] STEP ${step} ${label}`, {
    status,
    file: entry.file,
    lineNumber: entry.lineNumber,
    objectType: entry.objectType,
    payloadSizeBytes: entry.payloadSizeBytes,
    engineeringPackageId: entry.engineeringPackageId,
    repositoryFilename: entry.repositoryFilename,
    exception: entry.exception,
    details: entry.details,
  });
  return entry;
}

export function throwEngineeringTransactionError(log = [], step, label, error, details = {}) {
  const entry = appendEngineeringTransactionStep(log, step, label, "FAIL", {
    ...details,
    exception: error instanceof Error ? error.message : String(error),
    stackTrace: error instanceof Error ? error.stack : undefined,
  });
  const next = error instanceof Error ? error : new Error(String(error));
  next.transactionStep = step;
  next.transactionLabel = label;
  next.transactionFile = entry.file;
  next.transactionLineNumber = entry.lineNumber;
  next.objectType = entry.objectType;
  next.payloadSizeBytes = entry.payloadSizeBytes;
  next.engineeringTransactionLog = log;
  throw next;
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === "") return [];
  return [value];
}

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function stableIdPart(value, fallback = "UNKNOWN") {
  return String(value ?? fallback)
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || fallback;
}

function routeParts(pathname) {
  const normalizedPath = pathname.replace(/\/+$/, "");
  if (normalizedPath === BASE_PATH) return [];
  if (!normalizedPath.startsWith(`${BASE_PATH}/`)) return null;
  return normalizedPath
    .slice(BASE_PATH.length + 1)
    .split("/")
    .filter(Boolean)
    .map((part) => decodeURIComponent(part));
}

function packageReferenceHash(record) {
  const referencePayload = {
    customerId: record.customerId,
    opportunityId: record.opportunityId,
    customerTwinId: record.customerTwinId,
    proposalId: record.proposalId,
    proposalRevisionId: record.proposalRevisionId,
    proposalRevisionNumber: record.proposalRevisionNumber,
    proposalHash: record.proposalHash,
    commercialWorkbookId: record.commercialWorkbookId,
    draftIOFPackageId: record.draftIOFPackageId,
    routeRepositoryId: record.routeRepositoryId,
    estimateId: record.estimateId,
    productDoctrineId: record.productDoctrineId,
    engineeringBaselineId: record.engineeringBaselineId,
    engineeringBaselineHash: record.engineeringBaselineHash,
    engineeringBaselineManifestId: record.engineeringBaselineManifestId,
    engineeringBaselineProjectionId: record.engineeringBaselineProjectionId,
    engineeringRevisionId: record.engineeringRevisionId,
    commercialRevisionId: record.commercialRevisionId,
    commercialReleasePackageId: record.commercialReleasePackageId,
    commercialRevisionHash: record.commercialRevisionHash,
    commercialReleaseHash: record.commercialReleaseHash,
    stationProjectionId: record.stationProjectionId,
    stationGraphId: record.stationGraphId,
    projectedObjectManifestId: record.projectedObjectManifestId,
    closureLedgerId: record.closureLedgerId,
    iofPackageTwinId: record.iofPackageTwinId,
    executionGraphId: record.executionGraphId,
    lifecycleGraphId: record.lifecycleGraphId,
    doctrineObjectManifestId: record.doctrineObjectManifestId,
    engineeringObjectManifestId: record.engineeringObjectManifestId,
    doctrineMaterializedObjectCount: record.doctrineMaterializedObjectCount,
    doctrineQuantityScheduleCount: record.doctrineQuantityScheduleCount,
  };
  return createHash("sha256").update(JSON.stringify(referencePayload)).digest("hex");
}

export function engineeringPackageIdForDraftPackage(draftPackage = {}) {
  return String(draftPackage.engineeringPackageId ?? `ENG-PKG-${stableIdPart(draftPackage.packageId ?? draftPackage.draftPackageId ?? draftPackage.proposalId)}`);
}

function fieldFromSources(sources, keys) {
  for (const source of sources.map(asRecord)) {
    for (const key of keys) {
      const value = source[key];
      if (value !== undefined && value !== null && String(value).trim()) return String(value);
    }
  }
  return "";
}

function commercialWorkbookIdFrom(draftPackage, opportunity) {
  const draft = asRecord(draftPackage);
  const opportunityRecord = asRecord(opportunity);
  const commercialSummary = asRecord(draft.commercialSummary);
  const workbook = asRecord(draft.commercialWorkbook ?? opportunityRecord.commercialWorkbook ?? opportunityRecord.workbookSnapshot);
  return fieldFromSources([draft, commercialSummary, workbook, opportunityRecord], [
    "commercialWorkbookId",
    "workbookId",
    "CommercialWorkbookId",
  ]) || (draft.packageId ? `WORKBOOK-${stableIdPart(draft.packageId)}` : "");
}

function estimateIdFrom(draftPackage, opportunity) {
  const draft = asRecord(draftPackage);
  const opportunityRecord = asRecord(opportunity);
  const commercialSummary = asRecord(draft.commercialSummary);
  const pricingSummary = asRecord(draft.pricingSummary ?? commercialSummary.pricingSummary);
  const estimate = asRecord(draft.commercialEstimate ?? opportunityRecord.commercialEstimate ?? opportunityRecord.estimate ?? opportunityRecord.estimateSnapshot);
  return fieldFromSources([draft, commercialSummary, pricingSummary, estimate, opportunityRecord], [
    "commercialEstimateId",
    "estimateId",
    "EstimateId",
  ]) || (draft.packageId ? `ESTIMATE-${stableIdPart(draft.packageId)}` : "");
}

function firstText(...values) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function referenceTextArray(...values) {
  const result = [];
  const seen = new Set();
  const visit = (value) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    const text = String(value ?? "").trim();
    if (!text || seen.has(text)) return;
    seen.add(text);
    result.push(text);
  };
  values.forEach(visit);
  return result;
}

function serializedByteSize(value) {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

function payloadFieldSizes(record) {
  return Object.entries(record)
    .map(([key, value]) => ({ key, bytes: serializedByteSize(value) }))
    .sort((a, b) => b.bytes - a.bytes);
}

export function assertReferenceOnlyEngineeringPackagePayload(record) {
  const topLevelKeys = Object.keys(record);
  const forbiddenKeys = topLevelKeys.filter((key) => !ALLOWED_ENGINEERING_PACKAGE_KEYS.includes(key));
  const largestFields = payloadFieldSizes(record).slice(0, 8);
  const serializedBytes = serializedByteSize(record);
  console.info("[EngineeringPackage] reference-only payload audit", {
    topLevelKeys,
    serializedBytes,
    largestFields,
  });
  if (forbiddenKeys.length) {
    const error = new Error(`Engineering Package payload contains non-reference field: ${forbiddenKeys[0]}`);
    error.status = 413;
    error.offendingField = forbiddenKeys[0];
    error.payloadAudit = { topLevelKeys, serializedBytes, largestFields };
    throw error;
  }
  const largest = largestFields[0];
  if (serializedBytes > REFERENCE_ONLY_PAYLOAD_LIMIT_BYTES) {
    const error = new Error(`Engineering Package payload exceeds reference-only threshold. Offending field: ${largest?.key ?? "unknown"} (${largest?.bytes ?? 0} bytes).`);
    error.status = 413;
    error.offendingField = largest?.key;
    error.payloadAudit = { topLevelKeys, serializedBytes, largestFields };
    throw error;
  }
  return { topLevelKeys, serializedBytes, largestFields };
}

function engineeringPackageRepositoryFile(engineeringPackageId) {
  return recordPath(DIRS.engineeringPackages, engineeringPackageId);
}

function engineeringPackageRepositoryFilename(engineeringPackageId) {
  const filename = engineeringPackageRepositoryFile(engineeringPackageId);
  return filename.split(/[\\/]/).pop() ?? filename;
}

function verifyEngineeringPackageRepositoryRecord(record) {
  const required = [
    "engineeringPackageId",
    "opportunityId",
    "routeRepositoryId",
    "draftIOFPackageId",
    "engineeringBaselineId",
    "engineeringBaselineManifestId",
    "engineeringBaselineProjectionId",
    "engineeringBaselineHash",
    "engineeringRevisionId",
    "commercialRevisionId",
    "commercialReleasePackageId",
    "commercialRevisionHash",
    "commercialReleaseHash",
    "proposalId",
    "proposalRevisionId",
    "proposalRevisionNumber",
    "proposalHash",
    "estimateId",
    "commercialWorkbookId",
    "workbookId",
    "measuredCenterlineId",
    "stationProjectionId",
    "stationGraphId",
    "stationAuthorityIds",
    "stationObjectManifestId",
    "projectedObjectManifestId",
    "closureLedgerId",
    "iofPackageTwinId",
    "executionGraphId",
    "lifecycleGraphId",
    "doctrineObjectManifestId",
    "engineeringObjectManifestId",
    "referenceHash",
    "repositoryType",
    "engineeringStatus",
    "referenceOnly",
  ];
  const missing = required.filter((field) => {
    const value = record?.[field];
    if (field === "referenceOnly") return value !== true;
    if (field === "stationAuthorityIds") return !Array.isArray(value) || value.length === 0;
    return !String(value ?? "").trim();
  });
  if (missing.length) {
    const error = new Error(`Engineering Package repository verification failed: missing ${missing.join(", ")}`);
    error.status = 409;
    error.missingFields = missing;
    throw error;
  }
  if (record.repositoryType !== "ENGINEERING_PACKAGE") {
    const error = new Error(`Engineering Package repository verification failed: repositoryType=${record.repositoryType}`);
    error.status = 409;
    throw error;
  }
  if (!record.referenceOnly) {
    const error = new Error("Engineering Package repository verification failed: referenceOnly=false");
    error.status = 409;
    throw error;
  }
  return true;
}

export function engineeringPackageRecordForRepository(input = {}) {
  const draft = asRecord(input.draftPackage ?? input.draft ?? input.iofPackage);
  const engineeringBaseline = asRecord(input.engineeringBaseline ?? input.baseline);
  const opportunity = asRecord(input.opportunity);
  const user = asRecord(input.user);
  const measuredCenterline = asRecord(draft.measuredCenterline);
  const stationIndexedGraph = asRecord(draft.stationIndexedGraph);
  const stationAuthority = asRecord(draft.stationAuthority);
  const stationObjectManifest = asRecord(draft.stationObjectManifest);
  const projectedObjectManifest = asRecord(draft.projectedObjectManifest);
  const closureLedger = asRecord(draft.closureLedger ?? projectedObjectManifest.closureLedger);
  const iofPackageTwin = asRecord(draft.iofPackageTwin ?? projectedObjectManifest.iofPackageTwin);
  const commercialAuditReconciliation = asRecord(draft.commercialAuditReconciliation ?? projectedObjectManifest.commercialAuditReconciliation);
  const constitutionalStateValidation = asRecord(draft.constitutionalStateValidation ?? projectedObjectManifest.constitutionalStateValidation);
  const doctrineObjectManifest = asRecord(draft.doctrineObjectManifest ?? draft.engineeringObjectManifest);
  const timestamp = String(input.timestamp ?? input.submittedAt ?? draft.submittedToEngineeringAt ?? draft.submittedAt ?? nowIso());
  const draftIOFPackageId = firstText(
    input.draftIOFPackageId,
    input.draftIofPackageId,
    draft.draftIOFPackageId,
    draft.draftIofPackageId,
    draft.packageId,
  );
  const engineeringPackageId = firstText(
    input.engineeringPackageId,
    draft.engineeringPackageId,
    engineeringPackageIdForDraftPackage({ packageId: draftIOFPackageId || draft.packageId, proposalId: draft.proposalId }),
  );
  const engineeringBaselineId = firstText(
    input.engineeringBaselineId,
    engineeringBaseline.engineeringBaselineId,
    draft.engineeringBaselineId,
  );
  const engineeringBaselineHash = firstText(
    input.engineeringBaselineHash,
    engineeringBaseline.engineeringBaselineHash,
    draft.engineeringBaselineHash,
  );
  const engineeringBaselineManifestId = firstText(
    input.engineeringBaselineManifestId,
    engineeringBaseline.engineeringBaselineManifestId,
    draft.engineeringBaselineManifestId,
  );
  const engineeringBaselineProjectionId = firstText(
    input.engineeringBaselineProjectionId,
    engineeringBaseline.engineeringBaselineProjectionId,
    draft.engineeringBaselineProjectionId,
  );
  const workbookId = firstText(input.workbookId, input.commercialWorkbookId, engineeringBaseline.workbookId, engineeringBaseline.commercialWorkbookId, commercialWorkbookIdFrom(draft, opportunity));
  const stationAuthorityIds = referenceTextArray(
    input.stationAuthorityIds,
    engineeringBaseline.stationAuthorityIds,
    draft.stationAuthorityIds,
    stationAuthority.stationAuthorityIds,
    stationAuthority.stationAuthorityId,
    stationAuthority.authorityId,
  );
  const record = {
    engineeringPackageId,
    customerId: firstText(input.customerId, engineeringBaseline.customerId, draft.customerId, opportunity.customerId, opportunity.accountId),
    customerTwinId: firstText(input.customerTwinId, engineeringBaseline.customerTwinId, draft.customerTwinId, draft.customerTwinReference, opportunity.customerTwinId, opportunity.customerTwinReference, draft.customerId ? `CUSTOMER-TWIN-${stableIdPart(draft.customerId)}` : ""),
    opportunityId: firstText(input.opportunityId, engineeringBaseline.opportunityId, draft.opportunityId, opportunity.opportunityId),
    routeRepositoryId: firstText(input.routeRepositoryId, engineeringBaseline.routeRepositoryId, draft.routeRepositoryId, asRecord(draft.routeRepositoryRef).routeRepositoryId, asRecord(draft.commercialSummary).routeRepositoryId, opportunity.routeRepositoryId, asRecord(opportunity.routeRepositoryRef).routeRepositoryId),
    proposalId: firstText(input.proposalId, input.commercialProposalId, engineeringBaseline.proposalId, draft.proposalId, asRecord(draft.proposalSummary).proposalId, opportunity.proposalId),
    proposalRevisionId: firstText(input.proposalRevisionId, engineeringBaseline.proposalRevisionId, draft.proposalRevisionId, asRecord(draft.proposalSummary).proposalRevisionId),
    proposalRevisionNumber: Number(input.proposalRevisionNumber ?? engineeringBaseline.proposalRevisionNumber ?? draft.proposalRevisionNumber ?? asRecord(draft.proposalSummary).proposalRevisionNumber ?? 0),
    proposalHash: firstText(input.proposalHash, engineeringBaseline.proposalHash, draft.proposalHash, asRecord(draft.proposalSummary).proposalHash),
    commercialWorkbookId: workbookId,
    workbookId,
    estimateId: firstText(input.estimateId, engineeringBaseline.estimateId, estimateIdFrom(draft, opportunity)),
    draftIOFPackageId,
    engineeringBaselineId,
    engineeringBaselineManifestId,
    engineeringBaselineProjectionId,
    engineeringBaselineHash,
    baselineState: "FROZEN",
    derivedFromBaseline: true,
    engineeringRevisionId: firstText(input.engineeringRevisionId, engineeringBaseline.engineeringRevisionId, `ENG-REV-${stableIdPart(engineeringPackageId)}-000`),
    engineeringRevisionSource: firstText(input.engineeringRevisionSource, "ENGINEERING_PACKAGE_MIRRORS_BASELINE_UNTIL_CHANGE_SETS"),
    engineeringRevisionState: firstText(input.engineeringRevisionState, "MIRRORS_ENGINEERING_PACKAGE"),
    commercialRevisionId: firstText(input.commercialRevisionId, engineeringBaseline.commercialRevisionId, draft.commercialRevisionId, asRecord(draft.commercialSummary).commercialRevisionId, opportunity.commercialRevisionId),
    commercialReleasePackageId: firstText(input.commercialReleasePackageId, engineeringBaseline.commercialReleasePackageId, draft.commercialReleasePackageId, asRecord(draft.commercialSummary).commercialReleasePackageId, opportunity.commercialReleasePackageId),
    commercialRevisionHash: firstText(input.commercialRevisionHash, engineeringBaseline.commercialRevisionHash, draft.commercialRevisionHash, asRecord(draft.commercialSummary).commercialRevisionHash, opportunity.commercialRevisionHash),
    commercialReleaseHash: firstText(input.commercialReleaseHash, engineeringBaseline.commercialReleaseHash, draft.commercialReleaseHash, asRecord(draft.commercialSummary).commercialReleaseHash, opportunity.commercialReleaseHash),
    measuredCenterlineId: firstText(input.measuredCenterlineId, engineeringBaseline.measuredCenterlineId, draft.measuredCenterlineId, measuredCenterline.measuredCenterlineId, measuredCenterline.measuredSpineId, measuredCenterline.spineId),
    stationProjectionId: firstText(input.stationProjectionId, engineeringBaseline.stationProjectionId, draft.stationProjectionId, asRecord(draft.stationProjection).stationProjectionId),
    stationGraphId: firstText(input.stationGraphId, engineeringBaseline.stationGraphId, draft.stationGraphId, stationIndexedGraph.stationGraphId, stationIndexedGraph.graphId),
    stationAuthorityIds,
    stationObjectManifestId: firstText(input.stationObjectManifestId, engineeringBaseline.stationObjectManifestId, draft.stationObjectManifestId, stationObjectManifest.stationObjectManifestId, stationObjectManifest.manifestId),
    projectedObjectManifestId: firstText(input.projectedObjectManifestId, engineeringBaseline.projectedObjectManifestId, draft.projectedObjectManifestId, projectedObjectManifest.projectedObjectManifestId, projectedObjectManifest.manifestId),
    closureLedgerId: firstText(input.closureLedgerId, engineeringBaseline.closureLedgerId, draft.closureLedgerId, projectedObjectManifest.closureLedgerId, closureLedger.closureLedgerId),
    iofPackageTwinId: firstText(input.iofPackageTwinId, engineeringBaseline.iofPackageTwinId, draft.iofPackageTwinId, projectedObjectManifest.iofPackageTwinId, iofPackageTwin.twinProjectionId),
    executionGraphId: firstText(input.executionGraphId, engineeringBaseline.executionGraphId, draft.executionGraphId, projectedObjectManifest.executionGraphId, iofPackageTwin.executionGraphId),
    lifecycleGraphId: firstText(input.lifecycleGraphId, engineeringBaseline.lifecycleGraphId, draft.lifecycleGraphId, projectedObjectManifest.lifecycleGraphId, iofPackageTwin.lifecycleGraphId),
    workSegmentCount: Number(input.workSegmentCount ?? draft.workSegmentCount ?? closureLedger.workSegmentCount ?? asArray(draft.workSegments).length ?? asArray(projectedObjectManifest.workSegments).length ?? 0),
    commercialAuditStatus: firstText(input.commercialAuditStatus, commercialAuditReconciliation.status),
    constitutionalStateValidationStatus: firstText(input.constitutionalStateValidationStatus, constitutionalStateValidation.status),
    geometryAuthority: "MEASURED_CENTERLINE",
    singleGeometryAuthority: true,
    noIndependentSpanGeometry: true,
    doctrineObjectManifestId: firstText(input.doctrineObjectManifestId, engineeringBaseline.doctrineObjectManifestId, draft.doctrineObjectManifestId, draft.engineeringObjectManifestId, doctrineObjectManifest.manifestId, draft.objectManifestId),
    engineeringObjectManifestId: firstText(input.engineeringObjectManifestId, engineeringBaseline.engineeringObjectManifestId, draft.engineeringObjectManifestId, draft.doctrineObjectManifestId, doctrineObjectManifest.manifestId, draft.objectManifestId),
    doctrineMaterializedObjectCount: Number(input.doctrineMaterializedObjectCount ?? draft.doctrineMaterializedObjectCount ?? doctrineObjectManifest.objectCount ?? 0),
    stationObjectManifestCount: Number(input.stationObjectManifestCount ?? stationObjectManifest.objectCount ?? asArray(stationObjectManifest.objects).length ?? 0),
    doctrineQuantityScheduleCount: Number(input.doctrineQuantityScheduleCount ?? stationObjectManifest.doctrineQuantityScheduleCount ?? doctrineObjectManifest.objectCount ?? 0),
    doctrineManifestAuthority: firstText(input.doctrineManifestAuthority, doctrineObjectManifest.authority, stationObjectManifest.materializationAuthority, "DOCTRINE_OBJECT_INSTANTIATION_ENGINE"),
    productDoctrineId: firstText(input.productDoctrineId, engineeringBaseline.productDoctrineId, draft.productDoctrineId, draft.doctrineId, asRecord(draft.productionDoctrine).doctrineId, "PD-001"),
    submittedBy: firstText(input.submittedBy, draft.submittedBy, user.name, "Commercial"),
    submittedById: firstText(input.submittedById, draft.submittedById, user.userId),
    submittedAt: timestamp,
    commercialStatus: firstText(input.commercialStatus, "SUBMITTED_TO_ENGINEERING"),
    engineeringStatus: firstText(input.engineeringStatus, input.status, "ENGINEERING_PENDING"),
    serviceOrderState: firstText(input.serviceOrderState, input.serviceOrderStatus, "NOT_READY"),
    scopeVersionState: firstText(input.scopeVersionState, input.scopeVersionStatus, "BLOCKED_UNTIL_SIGNED_SERVICE_ORDER"),
    // Next sprint placeholders only. Station Plan, future Inventory Manifest, and Certified IOF refs stay null until Engineering creates them.
    stationPlanId: input.stationPlanId ?? null,
    futureInventoryManifestId: input.futureInventoryManifestId ?? null,
    certifiedIOFPackageId: input.certifiedIOFPackageId ?? input.certifiedIofPackageId ?? null,
    authority: "ENGINEERING_REPOSITORY",
    engineeringAuthority: "ENGINEERING_BASELINE",
    repositoryType: "ENGINEERING_PACKAGE",
    referenceOnly: true,
    noScopeVersionCreation: true,
    createdAt: String(input.createdAt ?? timestamp),
    updatedAt: String(input.updatedAt ?? timestamp),
  };
  record.referenceHash = packageReferenceHash(record);
  if (input.referenceIntegrity) record.referenceIntegrity = input.referenceIntegrity;
  assertReferenceOnlyEngineeringPackagePayload(record);
  return record;
}

export function buildEngineeringPackageFromDraftPackage(draftPackage = {}, context = {}) {
  return engineeringPackageRecordForRepository({
    draftPackage,
    opportunity: context.opportunity,
    user: context.user,
    engineeringBaseline: context.engineeringBaseline,
    timestamp: context.timestamp,
    engineeringPackageId: context.engineeringPackageId,
    submittedBy: context.submittedBy,
    submittedById: context.submittedById,
    submittedAt: context.submittedDate,
    createdAt: context.createdAt,
    updatedAt: context.timestamp,
  });
}

export function normalizeEngineeringPackage(record = {}) {
  const timestamp = nowIso();
  return engineeringPackageRecordForRepository({
    engineeringPackageId: record.engineeringPackageId ?? record.EngineeringPackageId,
    customerId: record.customerId,
    customerTwinId: record.customerTwinId ?? record.CustomerTwinId,
    opportunityId: record.opportunityId ?? record.OpportunityId,
    routeRepositoryId: record.routeRepositoryId ?? record.RouteRepositoryId,
    proposalId: record.proposalId ?? record.commercialProposalId ?? record.CommercialProposalId,
    proposalRevisionId: record.proposalRevisionId,
    proposalRevisionNumber: record.proposalRevisionNumber,
    proposalHash: record.proposalHash,
    commercialWorkbookId: record.commercialWorkbookId ?? record.CommercialWorkbookId,
    workbookId: record.workbookId ?? record.commercialWorkbookId ?? record.CommercialWorkbookId,
    estimateId: record.estimateId ?? record.EstimateId,
    draftIOFPackageId: record.draftIOFPackageId ?? record.draftIofPackageId ?? record.DraftIOFPackageId,
    engineeringBaselineId: record.engineeringBaselineId,
    engineeringBaselineManifestId: record.engineeringBaselineManifestId,
    engineeringBaselineProjectionId: record.engineeringBaselineProjectionId,
    engineeringBaselineHash: record.engineeringBaselineHash,
    baselineState: record.baselineState,
    derivedFromBaseline: record.derivedFromBaseline,
    engineeringRevisionId: record.engineeringRevisionId,
    engineeringRevisionSource: record.engineeringRevisionSource,
    engineeringRevisionState: record.engineeringRevisionState,
    commercialRevisionId: record.commercialRevisionId ?? record.CommercialRevisionId,
    commercialReleasePackageId: record.commercialReleasePackageId ?? record.CommercialReleasePackageId,
    commercialRevisionHash: record.commercialRevisionHash,
    commercialReleaseHash: record.commercialReleaseHash,
    measuredCenterlineId: record.measuredCenterlineId,
    stationProjectionId: record.stationProjectionId,
    stationGraphId: record.stationGraphId,
    stationAuthorityIds: record.stationAuthorityIds,
    stationObjectManifestId: record.stationObjectManifestId,
    projectedObjectManifestId: record.projectedObjectManifestId,
    closureLedgerId: record.closureLedgerId,
    iofPackageTwinId: record.iofPackageTwinId,
    executionGraphId: record.executionGraphId,
    lifecycleGraphId: record.lifecycleGraphId,
    workSegmentCount: record.workSegmentCount,
    commercialAuditStatus: record.commercialAuditStatus,
    constitutionalStateValidationStatus: record.constitutionalStateValidationStatus,
    doctrineObjectManifestId: record.doctrineObjectManifestId,
    engineeringObjectManifestId: record.engineeringObjectManifestId,
    doctrineMaterializedObjectCount: record.doctrineMaterializedObjectCount,
    stationObjectManifestCount: record.stationObjectManifestCount,
    doctrineQuantityScheduleCount: record.doctrineQuantityScheduleCount,
    doctrineManifestAuthority: record.doctrineManifestAuthority,
    productDoctrineId: record.productDoctrineId ?? record.ProductDoctrineId,
    submittedBy: record.submittedBy ?? record.SubmittedBy,
    submittedById: record.submittedById,
    submittedAt: record.submittedAt ?? record.submittedDate ?? record.SubmittedDate,
    commercialStatus: record.commercialStatus,
    engineeringStatus: record.engineeringStatus ?? record.status ?? record.Status,
    serviceOrderState: record.serviceOrderState ?? record.serviceOrderStatus,
    scopeVersionState: record.scopeVersionState ?? record.scopeVersionStatus,
    stationPlanId: record.stationPlanId ?? null,
    futureInventoryManifestId: record.futureInventoryManifestId ?? null,
    certifiedIOFPackageId: record.certifiedIOFPackageId ?? record.certifiedIofPackageId ?? null,
    engineeringAuthority: record.engineeringAuthority,
    referenceIntegrity: record.referenceIntegrity,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt ?? timestamp,
  });
}

function workbookReferenceResolves(commercialWorkbookId, draftPackage, opportunity) {
  if (!commercialWorkbookId) return false;
  const draft = asRecord(draftPackage);
  const opportunityRecord = asRecord(opportunity);
  const knownIds = [
    draft.commercialWorkbookId,
    draft.workbookId,
    asRecord(draft.commercialWorkbook).workbookId,
    asRecord(draft.commercialSummary).workbookId,
    opportunityRecord.commercialWorkbookId,
    opportunityRecord.workbookId,
    asRecord(opportunityRecord.commercialWorkbook).workbookId,
    asRecord(opportunityRecord.workbookSnapshot).workbookId,
  ].map((value) => String(value ?? ""));
  return knownIds.includes(String(commercialWorkbookId))
    || Boolean(asArray(draft.commercialWorkbookSections).length)
    || Boolean(asRecord(opportunityRecord.commercialWorkbook).sections);
}

function estimateReferenceResolves(estimateId, draftPackage, opportunity) {
  if (!estimateId) return false;
  const draft = asRecord(draftPackage);
  const opportunityRecord = asRecord(opportunity);
  const knownIds = [
    draft.estimateId,
    draft.commercialEstimateId,
    asRecord(draft.commercialEstimate).estimateId,
    asRecord(draft.commercialSummary).estimateId,
    asRecord(draft.pricingSummary).estimateId,
    opportunityRecord.estimateId,
    asRecord(opportunityRecord.commercialEstimate).estimateId,
    asRecord(opportunityRecord.estimate).estimateId,
    asRecord(opportunityRecord.estimateSnapshot).estimateId,
  ].map((value) => String(value ?? ""));
  return knownIds.includes(String(estimateId))
    || Boolean(asRecord(draft.pricingSummary).totalCost)
    || Boolean(asRecord(asRecord(draft.commercialSummary).pricingSummary).totalCost)
    || Boolean(asRecord(opportunityRecord.estimate).totalCost);
}

export async function resolveEngineeringPackageReferences(packageRecord) {
  const record = normalizeEngineeringPackage(packageRecord);
  const [engineeringBaseline, opportunity, rawDraftIofPackage, routeRepository, proposal, commercialReleasePackage] = await Promise.all([
    record.engineeringBaselineId ? loadEngineeringBaseline(record.engineeringBaselineId).catch(() => null) : null,
    record.opportunityId ? loadRecord(DIRS.commercialOpportunities, record.opportunityId).catch(() => null) : null,
    record.draftIOFPackageId ? loadRecord(DIRS.iofPackages, record.draftIOFPackageId).catch(() => null) : null,
    record.routeRepositoryId ? loadRecord(DIRS.commercialRoutes, record.routeRepositoryId).catch(() => null) : null,
    record.proposalId ? loadRecord(DIRS.proposalDrafts, record.proposalId).catch(() => null) : null,
    record.commercialReleasePackageId ? loadCommercialReleasePackage(record.commercialReleasePackageId).catch(() => null) : null,
  ]);
  const draftIofPackage = rawDraftIofPackage ? await hydrateIofProjectionArtifacts(rawDraftIofPackage) : null;
  const stationAuthority = asRecord(draftIofPackage?.stationAuthority);
  const draftStationAuthorityIds = referenceTextArray(
    draftIofPackage?.stationAuthorityIds,
    asRecord(draftIofPackage?.stationProjection).stationAuthorityIds,
    asRecord(draftIofPackage?.stationProjectionSummary).stationAuthorityIds,
    stationAuthority.stationAuthorityIds,
    stationAuthority.stationAuthorityId,
    stationAuthority.authorityId,
  );
  const checks = {
    engineeringPackage: Boolean(record.engineeringPackageId),
    engineeringBaseline: Boolean(record.engineeringBaselineId && engineeringBaseline && engineeringBaseline.engineeringBaselineHash === record.engineeringBaselineHash),
    commercialReleasePackage: Boolean(record.commercialReleasePackageId && commercialReleasePackage),
    opportunity: Boolean(opportunity),
    customerTwin: Boolean(record.customerTwinId),
    draftIofPackage: Boolean(draftIofPackage),
    routeRepository: Boolean(routeRepository && asArray(routeRepository.commercialGeometry).length > 1),
    commercialProposal: Boolean(proposal),
    commercialWorkbook: workbookReferenceResolves(record.commercialWorkbookId, draftIofPackage, opportunity),
    commercialEstimate: estimateReferenceResolves(record.estimateId, draftIofPackage, opportunity),
    measuredCenterline: Boolean(record.measuredCenterlineId && firstText(asRecord(draftIofPackage?.measuredCenterline).measuredCenterlineId, asRecord(draftIofPackage?.measuredCenterline).spineId) === record.measuredCenterlineId),
    geometryAuthority: Boolean(record.geometryAuthority === "MEASURED_CENTERLINE" && record.singleGeometryAuthority === true && record.noIndependentSpanGeometry === true),
    stationProjection: Boolean(record.stationProjectionId && firstText(asRecord(draftIofPackage?.stationProjection).stationProjectionId, draftIofPackage?.stationProjectionId) === record.stationProjectionId),
    stationGraph: Boolean(record.stationGraphId && firstText(asRecord(draftIofPackage?.stationIndexedGraph).stationGraphId, asRecord(draftIofPackage?.stationIndexedGraph).graphId) === record.stationGraphId),
    stationAuthorityIds: Boolean(asArray(record.stationAuthorityIds).length && draftStationAuthorityIds.some((id) => asArray(record.stationAuthorityIds).map(String).includes(String(id)))),
    stationObjectManifest: Boolean(record.stationObjectManifestId && firstText(asRecord(draftIofPackage?.stationObjectManifest).stationObjectManifestId, asRecord(draftIofPackage?.stationObjectManifest).manifestId) === record.stationObjectManifestId),
    projectedObjectManifest: Boolean(record.projectedObjectManifestId && firstText(asRecord(draftIofPackage?.projectedObjectManifest).projectedObjectManifestId, asRecord(draftIofPackage?.projectedObjectManifest).manifestId) === record.projectedObjectManifestId),
    closureLedger: Boolean(record.closureLedgerId && firstText(asRecord(draftIofPackage?.closureLedger).closureLedgerId, asRecord(draftIofPackage?.projectedObjectManifest).closureLedgerId) === record.closureLedgerId),
    iofPackageTwin: Boolean(record.iofPackageTwinId && firstText(asRecord(draftIofPackage?.iofPackageTwin).twinProjectionId, asRecord(draftIofPackage?.projectedObjectManifest).iofPackageTwinId) === record.iofPackageTwinId),
    executionGraph: Boolean(record.executionGraphId && firstText(draftIofPackage?.executionGraphId, asRecord(draftIofPackage?.projectedObjectManifest).executionGraphId, asRecord(draftIofPackage?.iofPackageTwin).executionGraphId) === record.executionGraphId),
    lifecycleGraph: Boolean(record.lifecycleGraphId && firstText(draftIofPackage?.lifecycleGraphId, asRecord(draftIofPackage?.projectedObjectManifest).lifecycleGraphId, asRecord(draftIofPackage?.iofPackageTwin).lifecycleGraphId) === record.lifecycleGraphId),
    commercialAudit: Boolean(record.commercialAuditStatus === "PASS" && asRecord(draftIofPackage?.commercialAuditReconciliation).status === "PASS"),
    constitutionalState: Boolean(record.constitutionalStateValidationStatus === "PASS" && asRecord(draftIofPackage?.constitutionalStateValidation).status === "PASS"),
    doctrineObjectManifest: Boolean(record.doctrineObjectManifestId && firstText(asRecord(draftIofPackage?.doctrineObjectManifest).manifestId, asRecord(draftIofPackage?.engineeringObjectManifest).manifestId) === record.doctrineObjectManifestId),
    engineeringObjectManifest: Boolean(record.engineeringObjectManifestId && firstText(asRecord(draftIofPackage?.engineeringObjectManifest).manifestId, asRecord(draftIofPackage?.doctrineObjectManifest).manifestId) === record.engineeringObjectManifestId),
    doctrineMaterializedObjectCount: Boolean(
      Number(record.doctrineMaterializedObjectCount) > 0 &&
      Number(record.doctrineMaterializedObjectCount) === Number(asRecord(draftIofPackage?.doctrineObjectManifest).objectCount ?? asRecord(draftIofPackage?.engineeringObjectManifest).objectCount),
    ),
    stationObjectManifestCount: Boolean(
      Number(record.stationObjectManifestCount) > 0 &&
      Number(record.stationObjectManifestCount) === Number(asRecord(draftIofPackage?.stationObjectManifest).objectCount),
    ),
    doctrineQuantityScheduleCount: Boolean(
      Number(record.doctrineQuantityScheduleCount) > 0 &&
      Number(record.doctrineQuantityScheduleCount) === Number(asRecord(draftIofPackage?.stationObjectManifest).doctrineQuantityScheduleCount ?? record.doctrineMaterializedObjectCount),
    ),
    projectedObjects: asArray(asRecord(draftIofPackage?.projectedObjectManifest).projectedObjects ?? draftIofPackage?.projectedObjects).length > 0
      && asArray(asRecord(draftIofPackage?.projectedObjectManifest).projectedObjects ?? draftIofPackage?.projectedObjects).every((item) => {
        const object = asRecord(item);
        return Boolean(object.objectId && object.stationId && (object.coordinate || object.projectedCoordinate) && (object.coordinateAuthority === "MEASURED_CENTERLINE" || object.projectionStatus === "PROJECTED"));
      }),
    productDoctrine: Boolean(record.productDoctrineId),
  };
  const missing = Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([key]) => key);
  return {
    ok: missing.length === 0,
    missing,
    checks,
    repositoryPaths: {
      engineeringPackage: "server/data/engineering-packages",
      engineeringBaseline: "server/data/engineering-baselines",
      opportunity: "server/data/commercial-opportunities",
      routeRepository: "server/data/commercial-routes",
      commercialReleasePackage: "server/data/commercial-release-packages",
      draftIofPackage: "server/data/iof-packages",
      commercialProposal: "server/data/proposal-drafts",
      commercialWorkbook: "Commercial Workbook reference resolved from Opportunity/Draft IOF Package source",
      commercialEstimate: "Commercial Estimate reference resolved from Opportunity/Draft IOF Package source",
      measuredCenterline: "server/data/iof-packages/*.json#/measuredCenterline",
      stationProjection: "server/data/iof-packages/*.json#/stationProjection",
      stationGraph: "server/data/iof-packages/*.json#/stationIndexedGraph",
      stationAuthorityIds: "server/data/iof-packages/*.json#/stationAuthority",
      stationObjectManifest: "server/data/iof-packages/*.json#/stationObjectManifest",
      projectedObjectManifest: "server/data/iof-packages/*.json#/projectedObjectManifest",
      closureLedger: "server/data/closure-ledgers",
      iofPackageTwin: "server/data/iof-package-twins",
      executionGraph: "server/data/iof-packages/*.json#/executionGraphId",
      lifecycleGraph: "server/data/iof-packages/*.json#/lifecycleGraphId",
      commercialAudit: "server/data/projected-object-manifests/*.json#/commercialAuditReconciliation",
      constitutionalState: "server/data/projected-object-manifests/*.json#/constitutionalStateValidation",
      doctrineObjectManifest: "server/data/iof-packages/*.json#/doctrineObjectManifest",
      engineeringObjectManifest: "server/data/iof-packages/*.json#/engineeringObjectManifest",
      doctrineMaterializedObjectCount: "server/data/iof-packages/*.json#/doctrineObjectManifest/objectCount",
      stationObjectManifestCount: "server/data/iof-packages/*.json#/stationObjectManifest/objectCount",
      doctrineQuantityScheduleCount: "server/data/iof-packages/*.json#/stationObjectManifest/doctrineQuantityScheduleCount",
      projectedObjects: "server/data/iof-packages/*.json#/projectedObjectManifest/projectedObjects",
    },
    resolvedAt: nowIso(),
    noRegeneration: true,
    noScopeVersionCreation: true,
    resolved: {
      engineeringBaseline,
      opportunity,
      draftIofPackage,
      routeRepository,
      proposal,
      commercialReleasePackage,
    },
  };
}

export async function persistEngineeringPackage(record = {}, user = {}, options = {}) {
  const transactionLog = options.transactionLog ?? [];
  if (!options.requestReceivedLogged) {
    appendEngineeringTransactionStep(
      transactionLog,
      ENGINEERING_TRANSACTION_STEPS.ENGINEERING_API_RECEIVES_REQUEST,
      "Engineering API receives request",
      "OK",
      {
        payloadSizeBytes: options.requestBodyByteLength,
        objectType: "EngineeringPackageRequest",
        details: { endpoint: BASE_PATH },
      },
    );
  }
  let normalized;
  try {
    normalized = engineeringPackageRecordForRepository({
      ...record,
      user,
      submittedBy: record.submittedBy ?? user.name,
      submittedById: record.submittedById ?? user.userId,
    });
    appendEngineeringTransactionStep(
      transactionLog,
      ENGINEERING_TRANSACTION_STEPS.NORMALIZE_ENGINEERING_PACKAGE,
      "Normalize Engineering Package",
      "OK",
      {
        engineeringPackageId: normalized.engineeringPackageId,
        payloadSizeBytes: serializedByteSize(normalized),
      },
    );
  } catch (error) {
    throwEngineeringTransactionError(
      transactionLog,
      ENGINEERING_TRANSACTION_STEPS.NORMALIZE_ENGINEERING_PACKAGE,
      "Normalize Engineering Package",
      error,
      {
        objectType: "EngineeringPackage",
        payloadSizeBytes: options.requestBodyByteLength,
      },
    );
  }
  const existing = await loadRecord(DIRS.engineeringPackages, normalized.engineeringPackageId).catch(() => null);
  if (existing && existing.referenceHash && existing.referenceHash !== normalized.referenceHash) {
    const error = new Error(`Engineering Package ${normalized.engineeringPackageId} already exists with different immutable commercial references.`);
    error.status = 409;
    throw error;
  }
  let integrity;
  try {
    integrity = await resolveEngineeringPackageReferences(normalized);
    if (!integrity.ok && options.requireIntegrity !== false) {
      const error = new Error(`Engineering Package reference validation failed: ${integrity.missing.join(", ")}`);
      error.status = 409;
      error.referenceIntegrity = integrity;
      throw error;
    }
  } catch (error) {
    throwEngineeringTransactionError(
      transactionLog,
      ENGINEERING_TRANSACTION_STEPS.VERIFY_ENGINEERING_PACKAGE,
      "Verify Engineering Package",
      error,
      {
        engineeringPackageId: normalized.engineeringPackageId,
        payloadSizeBytes: serializedByteSize(normalized),
      },
    );
  }
  const timestamp = nowIso();
  const next = engineeringPackageRecordForRepository({
    ...normalized,
    engineeringStatus: existing?.engineeringStatus ?? normalized.engineeringStatus,
    serviceOrderState: existing?.serviceOrderState ?? normalized.serviceOrderState,
    scopeVersionState: existing?.scopeVersionState ?? normalized.scopeVersionState,
    engineeringBaselineId: normalized.engineeringBaselineId,
    engineeringBaselineManifestId: normalized.engineeringBaselineManifestId,
    engineeringBaselineProjectionId: normalized.engineeringBaselineProjectionId,
    engineeringBaselineHash: normalized.engineeringBaselineHash,
    baselineState: normalized.baselineState,
    derivedFromBaseline: normalized.derivedFromBaseline,
    engineeringRevisionId: existing?.engineeringRevisionId ?? normalized.engineeringRevisionId,
    engineeringRevisionSource: existing?.engineeringRevisionSource ?? normalized.engineeringRevisionSource,
    engineeringRevisionState: existing?.engineeringRevisionState ?? normalized.engineeringRevisionState,
    commercialRevisionId: normalized.commercialRevisionId,
    commercialReleasePackageId: normalized.commercialReleasePackageId,
    commercialRevisionHash: normalized.commercialRevisionHash,
    commercialReleaseHash: normalized.commercialReleaseHash,
    measuredCenterlineId: normalized.measuredCenterlineId,
    stationProjectionId: normalized.stationProjectionId,
    stationGraphId: normalized.stationGraphId,
    stationAuthorityIds: normalized.stationAuthorityIds,
    stationObjectManifestId: normalized.stationObjectManifestId,
    projectedObjectManifestId: normalized.projectedObjectManifestId,
    doctrineObjectManifestId: normalized.doctrineObjectManifestId,
    engineeringObjectManifestId: normalized.engineeringObjectManifestId,
    doctrineMaterializedObjectCount: normalized.doctrineMaterializedObjectCount,
    stationObjectManifestCount: normalized.stationObjectManifestCount,
    doctrineQuantityScheduleCount: normalized.doctrineQuantityScheduleCount,
    doctrineManifestAuthority: normalized.doctrineManifestAuthority,
    stationPlanId: existing?.stationPlanId ?? normalized.stationPlanId,
    futureInventoryManifestId: existing?.futureInventoryManifestId ?? normalized.futureInventoryManifestId,
    certifiedIOFPackageId: existing?.certifiedIOFPackageId ?? normalized.certifiedIOFPackageId,
    engineeringAuthority: normalized.engineeringAuthority,
    referenceIntegrity: {
      ok: integrity.ok,
      missing: integrity.missing,
      checks: integrity.checks,
      repositoryPaths: integrity.repositoryPaths,
      resolvedAt: integrity.resolvedAt,
      noRegeneration: true,
      noScopeVersionCreation: true,
    },
    createdAt: existing?.createdAt ?? normalized.createdAt ?? timestamp,
    updatedAt: timestamp,
  });
  assertReferenceOnlyEngineeringPackagePayload(next);
  const repositoryFilename = engineeringPackageRepositoryFilename(next.engineeringPackageId);
  try {
    appendEngineeringTransactionStep(
      transactionLog,
      ENGINEERING_TRANSACTION_STEPS.WRITE_ENGINEERING_REPOSITORY_JSON,
      "Write Engineering Repository JSON",
      "START",
      {
        engineeringPackageId: next.engineeringPackageId,
        payloadSizeBytes: serializedByteSize(next),
        repositoryPath: DIRS.engineeringPackages,
        repositoryFilename,
      },
    );
    await persistRecord(DIRS.engineeringPackages, next.engineeringPackageId, next);
    appendEngineeringTransactionStep(
      transactionLog,
      ENGINEERING_TRANSACTION_STEPS.WRITE_ENGINEERING_REPOSITORY_JSON,
      "Write Engineering Repository JSON",
      "OK",
      {
        engineeringPackageId: next.engineeringPackageId,
        payloadSizeBytes: serializedByteSize(next),
        repositoryPath: DIRS.engineeringPackages,
        repositoryFilename,
      },
    );
    appendEngineeringTransactionStep(
      transactionLog,
      ENGINEERING_TRANSACTION_STEPS.FLUSH_FILE,
      "Flush file",
      "OK",
      {
        engineeringPackageId: next.engineeringPackageId,
        repositoryPath: DIRS.engineeringPackages,
        repositoryFilename,
        details: { writeFileResolved: true },
      },
    );
  } catch (error) {
    throwEngineeringTransactionError(
      transactionLog,
      ENGINEERING_TRANSACTION_STEPS.WRITE_ENGINEERING_REPOSITORY_JSON,
      "Write Engineering Repository JSON",
      error,
      {
        engineeringPackageId: next.engineeringPackageId,
        payloadSizeBytes: serializedByteSize(next),
        repositoryPath: DIRS.engineeringPackages,
        repositoryFilename,
      },
    );
  }

  let reloaded;
  try {
    appendEngineeringTransactionStep(
      transactionLog,
      ENGINEERING_TRANSACTION_STEPS.RELOAD_ENGINEERING_PACKAGE,
      "Reload Engineering Package",
      "START",
      {
        engineeringPackageId: next.engineeringPackageId,
        repositoryPath: DIRS.engineeringPackages,
        repositoryFilename,
      },
    );
    reloaded = await loadRecord(DIRS.engineeringPackages, next.engineeringPackageId);
    appendEngineeringTransactionStep(
      transactionLog,
      ENGINEERING_TRANSACTION_STEPS.RELOAD_ENGINEERING_PACKAGE,
      "Reload Engineering Package",
      "OK",
      {
        engineeringPackageId: next.engineeringPackageId,
        payloadSizeBytes: serializedByteSize(reloaded),
        repositoryPath: DIRS.engineeringPackages,
        repositoryFilename,
      },
    );
  } catch (error) {
    throwEngineeringTransactionError(
      transactionLog,
      ENGINEERING_TRANSACTION_STEPS.RELOAD_ENGINEERING_PACKAGE,
      "Reload Engineering Package",
      error,
      {
        engineeringPackageId: next.engineeringPackageId,
        repositoryPath: DIRS.engineeringPackages,
        repositoryFilename,
      },
    );
  }

  try {
    verifyEngineeringPackageRepositoryRecord(reloaded);
    appendEngineeringTransactionStep(
      transactionLog,
      ENGINEERING_TRANSACTION_STEPS.VERIFY_ENGINEERING_PACKAGE,
      "Verify Engineering Package",
      "OK",
      {
        engineeringPackageId: next.engineeringPackageId,
        payloadSizeBytes: serializedByteSize(reloaded),
        repositoryPath: DIRS.engineeringPackages,
        repositoryFilename,
      },
    );
  } catch (error) {
    throwEngineeringTransactionError(
      transactionLog,
      ENGINEERING_TRANSACTION_STEPS.VERIFY_ENGINEERING_PACKAGE,
      "Verify Engineering Package",
      error,
      {
        engineeringPackageId: next.engineeringPackageId,
        payloadSizeBytes: serializedByteSize(reloaded ?? next),
        repositoryPath: DIRS.engineeringPackages,
        repositoryFilename,
      },
    );
  }
  const verified = normalizeEngineeringPackage(reloaded);
  verified.engineeringTransactionLog = transactionLog;
  return verified;
}

export async function updateEngineeringPackageStatus(engineeringPackageId, user = {}, status, extras = {}) {
  const existing = await loadRecord(DIRS.engineeringPackages, engineeringPackageId).catch(() => null);
  if (!existing) return null;
  const timestamp = nowIso();
  const next = engineeringPackageRecordForRepository({
    ...existing,
    engineeringStatus: status,
    serviceOrderState: extras.serviceOrderState ?? extras.serviceOrderStatus ?? existing.serviceOrderState,
    scopeVersionState: extras.scopeVersionState ?? extras.scopeVersionStatus ?? existing.scopeVersionState,
    engineeringBaselineId: existing.engineeringBaselineId,
    engineeringBaselineManifestId: existing.engineeringBaselineManifestId,
    engineeringBaselineProjectionId: existing.engineeringBaselineProjectionId,
    engineeringBaselineHash: existing.engineeringBaselineHash,
    baselineState: existing.baselineState,
    derivedFromBaseline: existing.derivedFromBaseline,
    engineeringRevisionId: extras.engineeringRevisionId ?? existing.engineeringRevisionId,
    engineeringRevisionSource: extras.engineeringRevisionSource ?? existing.engineeringRevisionSource,
    engineeringRevisionState: extras.engineeringRevisionState ?? existing.engineeringRevisionState,
    commercialRevisionId: existing.commercialRevisionId,
    commercialReleasePackageId: existing.commercialReleasePackageId,
    commercialRevisionHash: existing.commercialRevisionHash,
    commercialReleaseHash: existing.commercialReleaseHash,
    measuredCenterlineId: existing.measuredCenterlineId,
    stationGraphId: existing.stationGraphId,
    stationAuthorityIds: existing.stationAuthorityIds,
    stationObjectManifestId: existing.stationObjectManifestId,
    projectedObjectManifestId: existing.projectedObjectManifestId,
    stationPlanId: extras.stationPlanId ?? existing.stationPlanId,
    futureInventoryManifestId: extras.futureInventoryManifestId ?? existing.futureInventoryManifestId,
    certifiedIOFPackageId: extras.certifiedIOFPackageId ?? extras.certifiedIofPackageId ?? existing.certifiedIOFPackageId,
    engineeringAuthority: existing.engineeringAuthority,
    referenceIntegrity: existing.referenceIntegrity,
    updatedAt: timestamp,
  });
  return persistRecord(DIRS.engineeringPackages, next.engineeringPackageId, next);
}

export async function loadEngineeringPackage(engineeringPackageId) {
  return normalizeEngineeringPackage(await loadRecord(DIRS.engineeringPackages, engineeringPackageId));
}

export async function findEngineeringPackageForDraft(draftIofPackageId) {
  const records = await listRecords(DIRS.engineeringPackages);
  const match = records.find((record) => String(record.draftIOFPackageId ?? record.draftIofPackageId ?? record.DraftIOFPackageId ?? "") === String(draftIofPackageId));
  return match ? normalizeEngineeringPackage(match) : null;
}

export async function listEngineeringPackages(options = {}) {
  const records = sortedByUpdated((await listRecords(DIRS.engineeringPackages)).map(normalizeEngineeringPackage));
  if (!options.openOnly) return records;
  return records.filter((record) => !TERMINAL_STATUSES.has(String(record.engineeringStatus ?? "")));
}

export async function handleEngineeringPackages(req, res, pathname) {
  const parts = routeParts(pathname);
  if (!parts) return false;
  if (handleOptions(req, res)) return true;

  const readOnly = req.method === "GET";
  const user = readOnly
    ? requireAnyPermission(req, res, ["workspace.engineering.read", "workspace.engineering.write", "workspace.commercial", "proposal.read"], "You do not have authority to read Engineering Packages.")
    : requireAnyPermission(req, res, ["workspace.commercial", "workspace.proposal", "proposal.manage", "workspace.engineering.write"], "You do not have authority to write Engineering Packages.");
  if (!user) return true;

  if (req.method === "GET" && parts.length === 0) {
    jsonResponse(res, 200, { engineeringPackages: await listEngineeringPackages() });
    return true;
  }

  if (req.method === "GET" && parts[0]) {
    const record = await loadEngineeringPackage(parts[0]).catch(() => null);
    if (!record) errorResponse(res, 404, `Engineering Package not found: ${parts[0]}`);
    else jsonResponse(res, 200, { engineeringPackage: record });
    return true;
  }

  if (req.method === "POST" && parts.length === 0) {
    const transactionLog = [];
    const { body, byteLength } = await readRequestJsonWithRaw(req);
    appendEngineeringTransactionStep(
      transactionLog,
      ENGINEERING_TRANSACTION_STEPS.ENGINEERING_API_RECEIVES_REQUEST,
      "Request received",
      "OK",
      {
        payloadSizeBytes: byteLength,
        objectType: "EngineeringPackageRequest",
        details: { method: "POST", endpoint: BASE_PATH },
      },
    );
    const input = unwrapBody(body, "engineeringPackage", ["engineeringPackages", "items", "data"]) ?? {};
    try {
      const record = await persistEngineeringPackage(input, user, {
        transactionLog,
        requestBodyByteLength: byteLength,
        requestReceivedLogged: true,
      });
      appendEngineeringTransactionStep(
        transactionLog,
        ENGINEERING_TRANSACTION_STEPS.RETURN_ENGINEERING_PACKAGE_ID,
        "Return Engineering Package ID",
        "OK",
        {
          engineeringPackageId: record.engineeringPackageId,
          payloadSizeBytes: serializedByteSize(record),
        },
      );
      jsonResponse(res, 201, { engineeringPackage: record, engineeringTransactionLog: transactionLog });
    } catch (error) {
      jsonResponse(res, error.status ?? 500, {
        error: error.message ?? "Engineering Package save failed.",
        transactionFailure: {
          step: error.transactionStep,
          label: error.transactionLabel,
          file: error.transactionFile,
          lineNumber: error.transactionLineNumber,
          objectType: error.objectType,
          payloadSizeBytes: error.payloadSizeBytes,
          exception: error.message,
          stackTrace: error.stack,
        },
        engineeringTransactionLog: error.engineeringTransactionLog ?? transactionLog,
      });
    }
    return true;
  }

  if (req.method === "POST" && parts[0] && parts[1] === "begin-station-planning") {
    const record = await updateEngineeringPackageStatus(parts[0], user, "STATION_PLANNING", {
      stationPlanningStartedAt: nowIso(),
      stationPlanningStartedBy: user.name,
      stationPlanningStartedById: user.userId,
    });
    if (!record) errorResponse(res, 404, `Engineering Package not found: ${parts[0]}`);
    else jsonResponse(res, 200, { engineeringPackage: record });
    return true;
  }

  errorResponse(res, 405, "Engineering Package method not allowed.");
  return true;
}
