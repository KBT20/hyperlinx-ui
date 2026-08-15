import { createHash } from "node:crypto";
import {
  DIRS,
  handleOptions,
  hydrateIofProjectionArtifacts,
  jsonResponse,
  listRecords,
  loadRecord,
  nowIso,
  persistRecord,
  readRequestJson,
  recordPath,
  routeMatch,
  sortedByUpdated,
} from "./_shared.js";
import { requireAnyPermission } from "./authority.js";
import { loadEngineeringPackage, resolveEngineeringPackageReferences } from "./engineering-packages.js";
import { engineeringChangeSetsForRevision, projectEngineeringRevisionFromChangeSets } from "./engineering-change-sets.js";

const BASE_PATH = "/api/engineering/approvals";
const MAX_APPROVAL_BYTES = 100_000;

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

function stableIdPart(value, fallback = "UNKNOWN") {
  return String(value ?? fallback).replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120) || fallback;
}

export function canonicalizeEngineeringApproval(value) {
  if (Array.isArray(value)) return value.map(canonicalizeEngineeringApproval);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalizeEngineeringApproval(value[key])]));
}

export function engineeringApprovalSha256(value) {
  return createHash("sha256").update(JSON.stringify(canonicalizeEngineeringApproval(value))).digest("hex");
}

function approvalScopeFrom(engineeringPackage, draft) {
  return {
    organizationId: firstText(draft.organizationId, engineeringPackage.organizationId),
    tenantId: firstText(draft.tenantId, engineeringPackage.tenantId, draft.organizationId, engineeringPackage.organizationId),
    customerId: firstText(engineeringPackage.customerId, draft.customerId, draft.accountId),
    opportunityId: firstText(engineeringPackage.opportunityId, draft.opportunityId),
  };
}

function scopeMismatch(actual, expected) {
  return ["organizationId", "tenantId", "customerId", "opportunityId"].filter((key) => firstText(expected[key]) && firstText(actual[key]) !== firstText(expected[key]));
}

function approvalConflict(code, message, details = {}) {
  const error = new Error(message);
  error.status = 409;
  error.code = code;
  error.details = details;
  return error;
}

function reviewStatusFromDraft(draft, engineeringPackage, referenceIntegrity, changeSets) {
  const quantity = asRecord(draft.quantityReconciliation);
  const quantityItems = asArray(quantity.items);
  const quantityRequired = quantityItems.length > 0;
  const quantityPass = !quantityRequired || (
    firstText(quantity.status).toUpperCase() === "PASS"
    && quantityItems.length > 0
    && quantityItems.every((item) => ["MATCH", "RESOLVED", "SUPERSEDED"].includes(firstText(asRecord(item).status).toUpperCase()))
  );
  const constitutional = asRecord(draft.constitutionalAssembly);
  const constitutionalQuantityPass = quantityPass && firstText(constitutional.status, "PASS").toUpperCase() === "PASS";
  const budgetTarget = `ENG-BUDGET-${firstText(engineeringPackage.draftIOFPackageId, engineeringPackage.draftIofPackageId, draft.packageId)}`;
  const budgetApproved = changeSets.some((changeSet) => (
    ["ACTIVE", "APPLIED"].includes(firstText(changeSet.status).toUpperCase())
    && asArray(changeSet.patches).some((patchValue) => {
      const patch = asRecord(patchValue);
      return patch.patchType === "CHANGE_REVIEW_STATUS"
        && patch.targetObjectId === budgetTarget
        && patch.targetProperty === "engineeringApprovedBudget.status"
        && patch.newValue === "APPROVED"
        && patch.validationState !== "INVALID";
    })
  ));
  const unresolvedConditions = asArray(draft.engineeringConstraints).filter((constraintValue) => !["RESOLVED", "ACCEPTED"].includes(firstText(asRecord(constraintValue).status).toUpperCase()));
  const exceptionRules = new Set(asArray(draft.doctrineExceptions).flatMap((value) => {
    const exception = asRecord(value);
    return [firstText(exception.doctrineRule), firstText(exception.rule), firstText(exception.key), firstText(exception.label)].filter(Boolean);
  }));
  const explicitComplianceFailures = asArray(asRecord(draft.validation).checks).filter((checkValue) => {
    const check = asRecord(checkValue);
    const key = firstText(check.key).toLowerCase();
    const representedByGovernedProjection = key === "units" && asArray(asRecord(draft.projectedObjectManifest).projectedObjects ?? draft.projectedObjects).length > 0;
    return firstText(check.status).toUpperCase() === "FAIL"
      && !representedByGovernedProjection
      && !exceptionRules.has(firstText(check.key))
      && !exceptionRules.has(firstText(check.label));
  });
  const measuredSpine = asRecord(draft.measuredSpine);
  const stations = asArray(asRecord(draft.stationAuthority).stations);
  const stationGraph = asRecord(draft.stationIndexedGraph);
  const auditProjectionSummary = asRecord(draft.auditProjectionSummary);
  const stationIds = new Set(stations.map((stationValue) => firstText(asRecord(stationValue).stationId)));
  const graphEdges = asArray(stationGraph.edges);
  const projectedObjects = asArray(asRecord(draft.projectedObjectManifest).projectedObjects ?? draft.projectedObjects);
  const objectAttachments = asArray(draft.objectStationAttachments);
  const derivedComplianceChecks = [
    { key: "geometry", pass: Boolean(firstText(measuredSpine.geometryHash) && Number(measuredSpine.coordinateCount ?? 0) > 1) },
    { key: "spine", pass: Boolean(firstText(measuredSpine.spineId) && Number(measuredSpine.routeLengthFeet ?? 0) > 0) },
    { key: "stationing", pass: Boolean(firstText(asRecord(draft.stationAuthority).authorityId) && stations.length > 0) },
    { key: "station-to-coordinate", pass: Boolean(stations.length && stations.every((stationValue) => {
      const station = asRecord(stationValue);
      return Boolean(station.coordinate && Number.isFinite(Number(station.stationFeet ?? station.measuredDistanceFeet ?? station.measure)));
    })) },
    { key: "graph", pass: Boolean(firstText(stationGraph.graphId) && graphEdges.length > 0 && graphEdges.every((edgeValue) => {
      const edge = asRecord(edgeValue);
      return stationIds.has(firstText(edge.fromStationId)) && stationIds.has(firstText(edge.toStationId));
    })) },
    { key: "object attachment", pass: projectedObjects.length === 0 || (objectAttachments.length >= projectedObjects.length && objectAttachments.every((attachmentValue) => {
      const attachment = asRecord(attachmentValue);
      return firstText(attachment.attachmentStatus).toUpperCase() === "EXCEPTED"
        || (firstText(attachment.attachmentMethod) && firstText(attachment.attachmentMethod).toUpperCase() !== "UNRESOLVED" && firstText(attachment.attachmentStatus).toUpperCase() !== "UNRESOLVED");
    })) },
    { key: "audit projection", pass: firstText(auditProjectionSummary.complianceStatus).toUpperCase() === "PASS" },
    { key: "engineering readiness", pass: ["SUBMITTED_TO_ENGINEERING", "UNDER_ENGINEERING_REVIEW", "READY_FOR_CERTIFICATION"].includes(firstText(draft.engineeringReadiness).toUpperCase()) || firstText(draft.engineeringReadiness).toUpperCase().includes("READY") },
  ];
  const derivedComplianceFailures = derivedComplianceChecks.filter((check) => !check.pass && !exceptionRules.has(check.key));
  const complianceFailures = [...explicitComplianceFailures, ...derivedComplianceFailures];
  const routeAuthorityPass = Boolean(referenceIntegrity.checks?.routeRepository && referenceIntegrity.checks?.geometryAuthority);
  const packageIntegrityPass = Boolean(referenceIntegrity.ok);
  const missingRequirements = [
    !packageIntegrityPass ? "PACKAGE_INTEGRITY" : "",
    !routeAuthorityPass ? "ROUTE_AUTHORITY" : "",
    !quantityPass ? "QUANTITY_RECONCILIATION" : "",
    !constitutionalQuantityPass ? "CONSTITUTIONAL_QUANTITY" : "",
    !budgetApproved ? "ENGINEERING_BUDGET_APPROVAL" : "",
    unresolvedConditions.length ? "BLOCKING_CONDITIONS" : "",
    complianceFailures.length ? "COMPLIANCE_REQUIREMENTS" : "",
  ].filter(Boolean);
  return {
    routeAuthorityStatus: routeAuthorityPass ? "PASS" : "FAIL",
    quantityReconciliationStatus: quantityPass ? "PASS" : "INCOMPLETE",
    constitutionalQuantityStatus: constitutionalQuantityPass ? "PASS" : "INCOMPLETE",
    engineeringBudgetStatus: budgetApproved ? "APPROVED" : "NOT_APPROVED",
    blockingConditionsCount: unresolvedConditions.length,
    complianceFailureCount: complianceFailures.length,
    packageIntegrityStatus: packageIntegrityPass ? "PASS" : "FAIL",
    reviewComplete: missingRequirements.length === 0,
    missingRequirements,
  };
}

const APPROVAL_BLOCKER_DETAILS = {
  PACKAGE_INTEGRITY: { predicate: "packageIntegrity", expected: "PASS", sourceAuthority: "ENGINEERING_PACKAGE_REFERENCE_INTEGRITY" },
  ROUTE_AUTHORITY: { predicate: "routeAuthority", expected: "PASS", sourceAuthority: "COMMERCIAL_ROUTE_REPOSITORY" },
  QUANTITY_RECONCILIATION: { predicate: "quantityReconciliation", expected: "PASS", sourceAuthority: "QUANTITY_RECONCILIATION" },
  CONSTITUTIONAL_QUANTITY: { predicate: "constitutionalQuantity", expected: "PASS", sourceAuthority: "CONSTITUTIONAL_ASSEMBLY" },
  ENGINEERING_BUDGET_APPROVAL: { predicate: "budgetApproval", expected: "APPROVED", sourceAuthority: "ENGINEERING_CHANGE_SET" },
  BLOCKING_CONDITIONS: { predicate: "blockingConditions", expected: 0, sourceAuthority: "ENGINEERING_CONSTRAINTS" },
  COMPLIANCE_REQUIREMENTS: { predicate: "compliance", expected: "PASS", sourceAuthority: "PRODUCT_DOCTRINE_COMPLIANCE" },
};

function engineeringApprovalEligibility(engineeringPackage, draft, scope, reviewSummary, reviewSummaryHash, missingRequirements) {
  const actualByRequirement = {
    PACKAGE_INTEGRITY: reviewSummary.packageIntegrityStatus,
    ROUTE_AUTHORITY: reviewSummary.routeAuthorityStatus,
    QUANTITY_RECONCILIATION: reviewSummary.quantityReconciliationStatus,
    CONSTITUTIONAL_QUANTITY: reviewSummary.constitutionalQuantityStatus,
    ENGINEERING_BUDGET_APPROVAL: reviewSummary.engineeringBudgetStatus,
    BLOCKING_CONDITIONS: reviewSummary.blockingConditionsCount,
    COMPLIANCE_REQUIREMENTS: reviewSummary.complianceFailureCount ? "FAIL" : "PASS",
  };
  const blockers = missingRequirements.map((code) => ({
    code,
    ...APPROVAL_BLOCKER_DETAILS[code],
    actual: actualByRequirement[code],
  }));
  return {
    engineeringPackageId: reviewSummary.engineeringPackageId,
    engineeringRevisionId: reviewSummary.engineeringRevisionId,
    engineeringRevisionHash: reviewSummary.engineeringRevisionHash,
    draftIofPackageId: firstText(engineeringPackage.draftIOFPackageId, engineeringPackage.draftIofPackageId, draft.packageId),
    proposalRevisionId: firstText(draft.proposalRevisionId, asRecord(draft.proposalSummary).proposalRevisionId),
    commercialRevisionId: firstText(engineeringPackage.commercialRevisionId, draft.commercialRevisionId),
    organizationId: scope.organizationId,
    tenantId: scope.tenantId,
    customerId: scope.customerId,
    opportunityId: scope.opportunityId,
    packageIntegrity: reviewSummary.packageIntegrityStatus,
    routeAuthority: reviewSummary.routeAuthorityStatus,
    quantityReconciliation: reviewSummary.quantityReconciliationStatus,
    constitutionalQuantity: reviewSummary.constitutionalQuantityStatus,
    budgetApproval: reviewSummary.engineeringBudgetStatus,
    blockingConditions: reviewSummary.blockingConditionsCount,
    compliance: reviewSummary.complianceFailureCount ? "FAIL" : "PASS",
    reviewSummaryHash,
    reviewComplete: reviewSummary.reviewComplete,
    approvalEligible: reviewSummary.reviewComplete && blockers.length === 0,
    blockers,
    sourceAuthority: "ENGINEERING_APPROVAL_ELIGIBILITY",
    derivedFromGovernedState: true,
    reasoningRequired: false,
  };
}

export async function resolveEngineeringApprovalContext(engineeringPackageId, expected = {}) {
  const engineeringPackage = await loadEngineeringPackage(engineeringPackageId).catch(() => null);
  if (!engineeringPackage) throw approvalConflict("ENGINEERING_PACKAGE_NOT_FOUND", `Engineering Package not found: ${engineeringPackageId}`, { engineeringPackageId });
  const referenceIntegrity = await resolveEngineeringPackageReferences(engineeringPackage);
  const rawDraft = referenceIntegrity.resolved?.draftIofPackage
    ?? await loadRecord(DIRS.iofPackages, firstText(engineeringPackage.draftIOFPackageId, engineeringPackage.draftIofPackageId));
  const draft = await hydrateIofProjectionArtifacts(rawDraft);
  const engineeringRevisionId = firstText(engineeringPackage.engineeringRevisionId);
  const changeSets = await engineeringChangeSetsForRevision(engineeringRevisionId, {
    engineeringBaselineId: engineeringPackage.engineeringBaselineId,
    engineeringPackageId,
  });
  const revisionProjection = projectEngineeringRevisionFromChangeSets(engineeringPackage, changeSets, engineeringPackage);
  const engineeringRevisionHash = firstText(revisionProjection.diagnostics?.revisionHash);
  const scope = approvalScopeFrom(engineeringPackage, draft);
  const mismatches = scopeMismatch(scope, expected);
  if (mismatches.length) throw approvalConflict("ENGINEERING_APPROVAL_SCOPE_MISMATCH", `Engineering Approval scope mismatch: ${mismatches.join(", ")}.`, { mismatches, expected, actual: scope });
  if (firstText(expected.engineeringRevisionId) && firstText(expected.engineeringRevisionId) !== engineeringRevisionId) {
    throw approvalConflict("ENGINEERING_APPROVAL_REVISION_MISMATCH", "Engineering Approval must reference the exact active Engineering Revision.", { expectedEngineeringRevisionId: engineeringRevisionId, receivedEngineeringRevisionId: expected.engineeringRevisionId });
  }
  const review = reviewStatusFromDraft(draft, engineeringPackage, referenceIntegrity, changeSets);
  const reviewSummary = {
    engineeringPackageId,
    engineeringRevisionId,
    engineeringRevisionHash,
    routeAuthorityStatus: review.routeAuthorityStatus,
    quantityReconciliationStatus: review.quantityReconciliationStatus,
    constitutionalQuantityStatus: review.constitutionalQuantityStatus,
    engineeringBudgetStatus: review.engineeringBudgetStatus,
    blockingConditionsCount: review.blockingConditionsCount,
    complianceFailureCount: review.complianceFailureCount,
    packageIntegrityStatus: review.packageIntegrityStatus,
    reviewComplete: review.reviewComplete,
  };
  const reviewSummaryHash = engineeringApprovalSha256(reviewSummary);
  const approvalEligibility = engineeringApprovalEligibility(engineeringPackage, draft, scope, reviewSummary, reviewSummaryHash, review.missingRequirements);
  if (firstText(expected.engineeringRevisionHash) && firstText(expected.engineeringRevisionHash) !== engineeringRevisionHash) {
    const stale = Boolean(firstText(expected.reviewSummaryHash));
    throw approvalConflict(stale ? "STALE_APPROVAL_ELIGIBILITY" : "ENGINEERING_APPROVAL_REVISION_HASH_MISMATCH", stale ? "Engineering Approval eligibility is stale. Refresh the exact active Engineering Revision before approving." : "Engineering Approval must reference the exact active Engineering Revision hash.", {
      failedPredicate: "engineeringRevisionHash",
      expectedValue: engineeringRevisionHash,
      actualValue: expected.engineeringRevisionHash,
      sourceAuthority: "ENGINEERING_REVISION",
      approvalEligibility,
    });
  }
  if (firstText(expected.reviewSummaryHash) && firstText(expected.reviewSummaryHash) !== reviewSummaryHash) {
    throw approvalConflict("STALE_APPROVAL_ELIGIBILITY", "Engineering Approval eligibility changed after the workspace calculated readiness. Refresh package state before approving.", {
      failedPredicate: "reviewSummaryHash",
      expectedValue: reviewSummaryHash,
      actualValue: expected.reviewSummaryHash,
      sourceAuthority: "ENGINEERING_APPROVAL_ELIGIBILITY",
      approvalEligibility,
    });
  }
  return { engineeringPackage, draft, scope, changeSets, revisionProjection, engineeringRevisionId, engineeringRevisionHash, reviewSummary, reviewSummaryHash, approvalEligibility, missingRequirements: review.missingRequirements };
}

function approvalIdentity(record) {
  return {
    approvalId: record.approvalId,
    organizationId: record.organizationId,
    tenantId: record.tenantId,
    customerId: record.customerId,
    opportunityId: record.opportunityId,
    engineeringPackageId: record.engineeringPackageId,
    engineeringBaselineId: record.engineeringBaselineId,
    engineeringRevisionId: record.engineeringRevisionId,
    engineeringRevisionHash: record.engineeringRevisionHash,
    draftIofPackageId: record.draftIofPackageId,
    proposalRevisionId: record.proposalRevisionId,
    proposalHash: record.proposalHash,
    commercialRevisionId: record.commercialRevisionId,
    commercialRevisionHash: record.commercialRevisionHash,
    decision: record.decision,
    approvedBy: record.approvedBy,
    approvedById: record.approvedById,
    approvedAt: record.approvedAt,
    reviewSummaryHash: record.reviewSummaryHash,
  };
}

export function validateEngineeringApprovalIntegrity(record) {
  const errors = [];
  if (record.authority !== "ENGINEERING_APPROVAL") errors.push("authority");
  if (record.repositoryType !== "ENGINEERING_APPROVAL") errors.push("repositoryType");
  if (record.immutable !== true || record.referenceOnly !== true) errors.push("immutableReferenceOnly");
  if (record.decision !== "APPROVED") errors.push("decision");
  if (!record.approvedById || !record.approvedBy) errors.push("authenticatedActor");
  if (engineeringApprovalSha256(record.reviewSummary) !== record.reviewSummaryHash) errors.push("reviewSummaryHash");
  if (engineeringApprovalSha256(approvalIdentity(record)) !== record.approvalHash) errors.push("approvalHash");
  return { valid: errors.length === 0, errors };
}

export async function findExactEngineeringApproval(context, expectedScope = {}) {
  const records = (await listRecords(DIRS.engineeringApprovals)).filter((record) => (
    record.engineeringPackageId === context.engineeringPackage.engineeringPackageId
    && record.engineeringRevisionId === context.engineeringRevisionId
    && record.engineeringRevisionHash === context.engineeringRevisionHash
    && record.reviewSummaryHash === context.reviewSummaryHash
    && record.decision === "APPROVED"
  ));
  const actualScope = context.scope;
  const allowed = records.find((record) => !scopeMismatch(actualScope, record).length && !scopeMismatch(actualScope, expectedScope).length);
  if (!allowed) return null;
  const integrity = validateEngineeringApprovalIntegrity(allowed);
  if (!integrity.valid) throw approvalConflict("ENGINEERING_APPROVAL_INTEGRITY_FAILURE", `Engineering Approval integrity failed: ${integrity.errors.join(", ")}.`, { approvalId: allowed.approvalId, integrityErrors: integrity.errors });
  return allowed;
}

export async function requireExactEngineeringApprovalForCertification(context, requestedApprovalId = "", expectedScope = {}) {
  const approval = await findExactEngineeringApproval(context, expectedScope);
  if (!approval || (requestedApprovalId && requestedApprovalId !== approval.approvalId)) {
    throw approvalConflict("ENGINEERING_APPROVAL_REQUIRED", "Exact Human Engineering Approval is required before IOF certification.", {
      engineeringPackageId: context.engineeringPackage?.engineeringPackageId,
      engineeringRevisionId: context.engineeringRevisionId,
      engineeringRevisionHash: context.engineeringRevisionHash,
      requestedEngineeringApprovalId: requestedApprovalId,
    });
  }
  return approval;
}

export async function createEngineeringApproval(input, user) {
  const engineeringPackageId = firstText(input.engineeringPackageId);
  if (!engineeringPackageId) throw approvalConflict("ENGINEERING_APPROVAL_PACKAGE_REQUIRED", "engineeringPackageId is required.");
  const context = await resolveEngineeringApprovalContext(engineeringPackageId, {
    ...input,
    organizationId: user.organizationId,
    tenantId: user.organizationId,
  });
  if (context.approvalEligibility?.approvalEligible !== true) {
    throw approvalConflict("ENGINEERING_APPROVAL_NOT_READY", "Engineering Review is not complete for the exact active Engineering Revision.", { engineeringPackageId, engineeringRevisionId: context.engineeringRevisionId, missingRequirements: context.missingRequirements, approvalEligibility: context.approvalEligibility });
  }
  return persistEngineeringApprovalForContext(context, user);
}

export async function persistEngineeringApprovalForContext(context, user) {
  if (context.approvalEligibility?.approvalEligible === false || context.reviewSummary?.reviewComplete !== true || asArray(context.missingRequirements).length) {
    throw approvalConflict("ENGINEERING_APPROVAL_NOT_READY", "Engineering Review is not complete for the exact active Engineering Revision.", { engineeringPackageId: context.engineeringPackage?.engineeringPackageId, engineeringRevisionId: context.engineeringRevisionId, missingRequirements: asArray(context.missingRequirements) });
  }
  const existing = await findExactEngineeringApproval(context, context.scope);
  if (existing) return { engineeringApproval: existing, idempotentReplay: true, reviewComplete: true };
  const approvedAt = nowIso();
  const draft = context.draft;
  const engineeringPackage = context.engineeringPackage;
  const engineeringPackageId = context.engineeringPackage.engineeringPackageId;
  const approvalId = `ENG-APPROVAL-${stableIdPart(engineeringPackageId)}-${context.engineeringRevisionHash.slice(-16)}-${context.reviewSummaryHash.slice(-12)}`;
  const record = {
    approvalId,
    organizationId: context.scope.organizationId,
    tenantId: context.scope.tenantId,
    customerId: context.scope.customerId,
    opportunityId: context.scope.opportunityId,
    engineeringPackageId,
    engineeringBaselineId: firstText(engineeringPackage.engineeringBaselineId),
    engineeringRevisionId: context.engineeringRevisionId,
    engineeringRevisionHash: context.engineeringRevisionHash,
    draftIofPackageId: firstText(engineeringPackage.draftIOFPackageId, engineeringPackage.draftIofPackageId, draft.packageId),
    proposalRevisionId: firstText(draft.proposalRevisionId, asRecord(draft.proposalSummary).proposalRevisionId),
    proposalHash: firstText(draft.proposalHash, asRecord(draft.proposalSummary).proposalHash),
    commercialRevisionId: firstText(engineeringPackage.commercialRevisionId, draft.commercialRevisionId),
    commercialRevisionHash: firstText(engineeringPackage.commercialRevisionHash, draft.commercialRevisionHash),
    decision: "APPROVED",
    approvedBy: user.name,
    approvedById: user.userId,
    approvedByPrincipalId: user.principalId ?? user.userId,
    approvedByMembershipId: user.membershipId,
    approvedBySessionId: user.sessionId,
    actorDisplayNameAtAction: user.displayName ?? user.name,
    approvedAt,
    reviewSummary: context.reviewSummary,
    reviewSummaryHash: context.reviewSummaryHash,
    approvalHash: "",
    authority: "ENGINEERING_APPROVAL",
    repositoryType: "ENGINEERING_APPROVAL",
    immutable: true,
    appendOnly: true,
    referenceOnly: true,
    noAutomaticCertification: true,
    noServiceOrderCreation: true,
    noScopeVersionCreation: true,
    createdAt: approvedAt,
  };
  record.approvalHash = engineeringApprovalSha256(approvalIdentity(record));
  const sizeBytes = Buffer.byteLength(JSON.stringify(record), "utf8");
  if (sizeBytes >= MAX_APPROVAL_BYTES) throw approvalConflict("ENGINEERING_APPROVAL_PAYLOAD_TOO_LARGE", `Engineering Approval is ${sizeBytes} bytes; reference-only budget is ${MAX_APPROVAL_BYTES} bytes.`, { sizeBytes });
  const saved = await persistRecord(DIRS.engineeringApprovals, approvalId, record);
  return { engineeringApproval: saved, idempotentReplay: false, reviewComplete: true, sizeBytes };
}

export async function loadEngineeringApproval(approvalId) {
  const record = await loadRecord(DIRS.engineeringApprovals, approvalId);
  const integrity = validateEngineeringApprovalIntegrity(record);
  if (!integrity.valid) throw approvalConflict("ENGINEERING_APPROVAL_INTEGRITY_FAILURE", `Engineering Approval integrity failed: ${integrity.errors.join(", ")}.`, { approvalId, integrityErrors: integrity.errors });
  return record;
}

export function engineeringApprovalRepositoryFile(approvalId) {
  return recordPath(DIRS.engineeringApprovals, approvalId);
}

function sendError(res, error) {
  jsonResponse(res, Number(error?.status ?? 500), { error: error instanceof Error ? error.message : String(error), code: error?.code ?? "ENGINEERING_APPROVAL_FAILURE", ...(asRecord(error?.details)) });
}

export async function handleEngineeringApprovals(req, res, pathname) {
  const match = routeMatch(pathname, BASE_PATH);
  if (!match) return false;
  if (handleOptions(req, res)) return true;
  const readOnly = req.method === "GET";
  const user = readOnly
    ? requireAnyPermission(req, res, ["workspace.engineering.read", "workspace.engineering.write"], "Engineering approval read authority is required.")
    : requireAnyPermission(req, res, ["workspace.engineering.write"], "Only an authorized Engineering reviewer may approve an Engineering Revision.");
  if (!user) return true;
  try {
    if (!match.base && req.method === "GET") {
      const engineeringApproval = await loadEngineeringApproval(match.id);
      if (engineeringApproval.organizationId !== user.organizationId || engineeringApproval.tenantId !== user.organizationId) {
        throw approvalConflict("ENGINEERING_APPROVAL_SCOPE_MISMATCH", "Engineering Approval is outside the authenticated organization/tenant scope.", { approvalId: match.id });
      }
      jsonResponse(res, 200, { engineeringApproval });
      return true;
    }
    if (match.base && req.method === "GET") {
      const url = new URL(req.url ?? BASE_PATH, "http://runtime.invalid");
      const engineeringPackageId = firstText(url.searchParams.get("engineeringPackageId"));
      const engineeringRevisionId = firstText(url.searchParams.get("engineeringRevisionId"));
      const records = sortedByUpdated(await listRecords(DIRS.engineeringApprovals)).filter((record) => (
        record.organizationId === user.organizationId
        && record.tenantId === user.organizationId
        && (!engineeringPackageId || record.engineeringPackageId === engineeringPackageId)
        && (!engineeringRevisionId || record.engineeringRevisionId === engineeringRevisionId)
      ));
      if (engineeringPackageId) {
        const context = await resolveEngineeringApprovalContext(engineeringPackageId, engineeringRevisionId ? { engineeringRevisionId } : {});
        const currentEngineeringApproval = await findExactEngineeringApproval(context, context.scope);
        jsonResponse(res, 200, {
          engineeringApprovals: records,
          items: records,
          currentEngineeringApproval,
          reviewSummary: context.reviewSummary,
          reviewSummaryHash: context.reviewSummaryHash,
          approvalEligibility: context.approvalEligibility,
          missingRequirements: context.missingRequirements,
        });
      } else {
        jsonResponse(res, 200, { engineeringApprovals: records, items: records });
      }
      return true;
    }
    if (match.base && req.method === "POST") {
      const result = await createEngineeringApproval(await readRequestJson(req), user);
      jsonResponse(res, result.idempotentReplay ? 200 : 201, result);
      return true;
    }
    jsonResponse(res, 405, { error: "Engineering Approval method not allowed." });
  } catch (error) {
    sendError(res, error);
  }
  return true;
}
