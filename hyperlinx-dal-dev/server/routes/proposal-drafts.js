import { createHash } from "node:crypto";
import {
  DIRS,
  createId,
  errorResponse,
  handleOptions,
  jsonResponse,
  listRecords,
  loadRecord,
  nowIso,
  persistRecord,
  readRequestJson,
  routeMatch,
  sortedByUpdated,
  stripIofProjectionArtifacts,
  unwrapBody,
} from "./_shared.js";
import { findAlphaUserById, userFromBearerToken, userHasPermission } from "./auth.js";
import { loadCommercialDraftIofPackageForProposal } from "./commercial-iof-packages.js";
import {
  commercialAuthorityDiagnosticsFrom,
  ensureCommercialRevisionForProposal,
} from "./commercial-revisions.js";
import { assembleDraftIofPackageFromProposal } from "./engineering-certification.js";
import { updateRuntimeWorkspaceSession } from "./runtime-workspace-session.js";
import { createCustomerReviewAuthority } from "./customer-portal-authority.js";
import { commercialOpportunityStateHash, normalizeCommercialOpportunity, saveOpportunity } from "./commercial-opportunities.js";

const ROLE_KEYS = ["contributors", "reviewers", "approvers", "executives", "customerReviewers", "salesEngineering"];
const CUSTOMER_USER_BY_CUSTOMER = {
  google: "google-participant-001",
  "customer-google": "google-participant-001",
};
const PROPOSAL_REPOSITORY_DRAFT_STATUS = "DRAFT";
const PROPOSAL_REPOSITORY_WAITING_CUSTOMER_REVIEW_STATUS = "WAITING_CUSTOMER_REVIEW";
const PROPOSAL_REPOSITORY_CUSTOMER_REVIEW_STATUS = "CUSTOMER_REVIEW";
const PROPOSAL_REPOSITORY_APPROVED_STATUS = "COMMERCIAL_APPROVED";
const PROPOSAL_REPOSITORY_ENGINEERING_SUBMITTED_STATUS = "ENGINEERING_SUBMITTED";
const APPROVED_PROPOSAL_STATUSES = new Set([
  PROPOSAL_REPOSITORY_APPROVED_STATUS,
  PROPOSAL_REPOSITORY_ENGINEERING_SUBMITTED_STATUS,
  "CUSTOMER_APPROVED",
  "READY_FOR_IOF_PACKAGE",
  "SUBMITTED_TO_ENGINEERING",
  "SALES_ENGINEERING_REVIEW",
  "CERTIFIED_IOF_PACKAGE",
]);
const PROPOSAL_APPROVAL_ELIGIBLE_STATUSES = new Set([
  PROPOSAL_REPOSITORY_WAITING_CUSTOMER_REVIEW_STATUS,
  PROPOSAL_REPOSITORY_CUSTOMER_REVIEW_STATUS,
]);

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === "") return [];
  return [value];
}

function unique(values) {
  return [...new Set(values.filter(Boolean).map(String))];
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

function safeIdPart(value, fallback = "UNKNOWN") {
  return String(value ?? fallback)
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || fallback;
}

function nonEmptyArray(value, fallback = []) {
  return Array.isArray(value) && value.length ? value : fallback;
}

function resolveUserId(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const byId = findAlphaUserById(raw);
  if (byId) return byId.userId;
  const normalized = raw.toLowerCase();
  if (normalized === "google" || normalized === "google customer") return "google-participant-001";
  const byName = ["kyle", "ryan", "fran"]
    .map((name) => findAlphaUserById(`teralinx-user-${name}`))
    .find((user) => user && (user.username === normalized || user.name.toLowerCase() === normalized));
  return byName?.userId ?? raw;
}

function userLabel(userId) {
  const user = findAlphaUserById(userId);
  return user?.name ?? userId;
}

function normalizeUserIds(value) {
  return unique(asArray(value).map(resolveUserId));
}

function normalizeCustomerId(record = {}) {
  const raw = String(record.customerId ?? record.accountId ?? record.customer ?? "").trim();
  if (!raw) return "customer-unknown";
  if (raw.toLowerCase() === "google") return "customer-google";
  if (raw.startsWith("customer-")) return raw;
  return raw;
}

function defaultCustomerUserIds(customerId) {
  return unique([CUSTOMER_USER_BY_CUSTOMER[String(customerId ?? "").toLowerCase()]]);
}

function normalizeAuthority(record = {}, ownerId, assignedCustomerUsers = []) {
  const input = record.authority && typeof record.authority === "object" ? record.authority : {};
  const authority = {
    owner: ownerId,
    contributors: normalizeUserIds(input.contributors ?? record.contributors),
    reviewers: normalizeUserIds(input.reviewers ?? record.reviewers),
    approvers: normalizeUserIds(input.approvers ?? record.approvers),
    executives: normalizeUserIds(input.executives ?? record.executives),
    customerReviewers: unique([
      ...normalizeUserIds(input.customerReviewers ?? record.customerReviewers),
      ...assignedCustomerUsers,
    ]),
    salesEngineering: normalizeUserIds(input.salesEngineering ?? record.salesEngineering ?? record.salesEngineeringReviewers),
  };
  return {
    ...authority,
    sharedWith: unique(ROLE_KEYS.flatMap((key) => authority[key])),
  };
}

function assignmentFromAuthority(authority) {
  return {
    owner: authority.owner,
    contributors: authority.contributors,
    reviewers: authority.reviewers,
    approvers: authority.approvers,
    executives: authority.executives,
    customerReviewers: authority.customerReviewers,
    salesEngineering: authority.salesEngineering,
  };
}

function authorityIncludes(record, userId) {
  const authority = normalizeAuthority(record, record.ownerId ?? record.commercialOwnerId, record.assignedCustomerUsers);
  return authority.owner === userId || authority.sharedWith.includes(userId);
}

function isCustomerUser(user) {
  return user?.participantType === "CUSTOMER" || user?.role === "CUSTOMER_PARTICIPANT";
}

function canReadProposal(record, user) {
  if (!record || !user) return false;
  if (record.organizationId !== user.organizationId) return false;
  if (userHasPermission(user, "platform.admin")) return true;
  if (record.visibility === "PUBLIC") return true;
  if (record.ownerId === user.userId || record.commercialOwnerId === user.userId || record.createdById === user.userId) return true;
  if (asArray(record.assignedTo).map(resolveUserId).includes(user.userId)) return true;
  if (authorityIncludes(record, user.userId)) return true;
  if (isCustomerUser(user)) {
    const assigned = normalizeUserIds(record.assignedCustomerUsers);
    const customerMatches = user.customerId && record.customerId === user.customerId;
    const reviewVisible = ["SHARED", "ORGANIZATION", "PUBLIC"].includes(record.visibility);
    return assigned.includes(user.userId) || Boolean(customerMatches && reviewVisible && record.status !== "COMMERCIAL_DRAFT");
  }
  if (record.visibility === "ORGANIZATION") return userHasPermission(user, "proposal.read") || userHasPermission(user, "proposal.manage");
  return false;
}

function canWriteProposal(record, user) {
  if (!record || !user || !userHasPermission(user, "proposal.manage")) return false;
  const authority = normalizeAuthority(record, record.ownerId ?? record.commercialOwnerId, record.assignedCustomerUsers);
  return record.ownerId === user.userId ||
    record.commercialOwnerId === user.userId ||
    authority.contributors.includes(user.userId) ||
    authority.approvers.includes(user.userId);
}

function canGovernProposal(record, user) {
  if (!record || !user || !userHasPermission(user, "proposal.manage")) return false;
  const authority = normalizeAuthority(record, record.ownerId ?? record.commercialOwnerId, record.assignedCustomerUsers);
  return record.ownerId === user.userId || record.commercialOwnerId === user.userId || authority.approvers.includes(user.userId);
}

function canCustomerReviewProposal(record, user) {
  if (!record || !user || !userHasPermission(user, "proposal.review")) return false;
  if (!canReadProposal(record, user)) return false;
  const assigned = normalizeUserIds(record.assignedCustomerUsers);
  return assigned.includes(user.userId) || Boolean(isCustomerUser(user) && user.customerId && record.customerId === user.customerId);
}

function canonicalProposalRepositoryStatus(status) {
  if (status === "CUSTOMER_APPROVED") return PROPOSAL_REPOSITORY_APPROVED_STATUS;
  if (status === "CUSTOMER_COMMENTS" || status === "IN_CUSTOMER_REVIEW") return PROPOSAL_REPOSITORY_CUSTOMER_REVIEW_STATUS;
  if (status === "SUBMITTED_TO_ENGINEERING") return PROPOSAL_REPOSITORY_ENGINEERING_SUBMITTED_STATUS;
  if (status === "COMMERCIAL_DRAFT") return PROPOSAL_REPOSITORY_DRAFT_STATUS;
  return status;
}

function proposalRepositoryStateSnapshot(record = {}, source = "Proposal Repository", dashboardStatus = "") {
  const repositoryStatus = canonicalProposalRepositoryStatus(String(record.status ?? ""));
  const approvalState = String(record.approvalState ?? "");
  const customerReviewState = repositoryStatus === PROPOSAL_REPOSITORY_APPROVED_STATUS || repositoryStatus === PROPOSAL_REPOSITORY_ENGINEERING_SUBMITTED_STATUS
    ? "ACCEPTED"
    : [PROPOSAL_REPOSITORY_WAITING_CUSTOMER_REVIEW_STATUS, PROPOSAL_REPOSITORY_CUSTOMER_REVIEW_STATUS].includes(repositoryStatus)
      ? "CUSTOMER_REVIEW"
      : repositoryStatus === "CUSTOMER_CHANGES_REQUESTED"
        ? "CHANGES_REQUESTED"
        : repositoryStatus || "UNKNOWN";
  const engineeringEligibility = repositoryStatus === PROPOSAL_REPOSITORY_APPROVED_STATUS || repositoryStatus === PROPOSAL_REPOSITORY_ENGINEERING_SUBMITTED_STATUS ? "ELIGIBLE" : "BLOCKED";
  return {
    source,
    proposalId: record.proposalId ?? record.proposalRecordId ?? record.acceptedProposalId ?? "",
    repositoryStatus,
    rawStatus: record.status,
    approvalState,
    customerReviewState,
    commercialStatus: repositoryStatus,
    dashboardStatus: dashboardStatus || repositoryStatus,
    engineeringEligibility,
  };
}

function logProposalRepositoryState(source, record = {}, extra = {}) {
  const snapshot = proposalRepositoryStateSnapshot(record, source, extra.dashboardStatus);
  console.info("[ProposalStateAuthority]", {
    ...snapshot,
    ...extra,
  });
  return snapshot;
}

function proposalApprovalRule(name, passed, details = {}) {
  return {
    rule: name,
    status: passed ? "PASS" : "FAIL",
    passed: Boolean(passed),
    ...details,
  };
}

function formatProposalApprovalDecisionTrace(trace) {
  const lines = [
    "Decision Trace",
    "--------------",
    ...trace.validationRules.map((rule) => {
      const label = String(rule.rule ?? "").padEnd(28, ".");
      return `${label} ${rule.status}`;
    }),
    `Required State ............. ${trace.requiredState}`,
    `Current State .............. ${trace.repositoryStatus || "UNKNOWN"}`,
    `Transition ................. ${trace.requestedTransition}`,
    "",
    trace.decision,
  ];
  if (trace.decision === "DENY") {
    lines.push("Reason:", trace.denialReason);
  }
  return lines.join("\n");
}

function buildProposalApprovalDecisionTrace({ proposalId, repositoryRecord = null, normalizedRecord = null, user = null }) {
  const record = normalizedRecord ?? repositoryRecord;
  const repositoryStatus = canonicalProposalRepositoryStatus(String(record?.status ?? ""));
  const state = proposalRepositoryStateSnapshot(record ?? { proposalId }, "Proposal Approval Decision Trace");
  const alreadyApproved = repositoryStatus === PROPOSAL_REPOSITORY_APPROVED_STATUS || repositoryStatus === PROPOSAL_REPOSITORY_ENGINEERING_SUBMITTED_STATUS;
  const customerReviewAuthority = Boolean(record && canCustomerReviewProposal(record, user));
  const commercialApprovalAuthority = Boolean(record && canGovernProposal(record, user));
  const reviewAuthority = customerReviewAuthority || commercialApprovalAuthority;
  const approvalStateEligible = Boolean(record && PROPOSAL_APPROVAL_ELIGIBLE_STATUSES.has(repositoryStatus));
  const validationRules = [
    proposalApprovalRule("Proposal Exists", Boolean(repositoryRecord), {
      reason: repositoryRecord ? "" : "Proposal Repository record was not found.",
    }),
    proposalApprovalRule("Repository Loaded", Boolean(normalizedRecord), {
      reason: normalizedRecord ? "" : "Proposal Repository record could not be normalized.",
    }),
    proposalApprovalRule("Proposal Approval Authority", reviewAuthority, {
      reason: reviewAuthority ? "" : "Only an assigned customer reviewer or commercial proposal authority can approve this proposal.",
      userId: user?.userId ?? "",
      customerReviewAuthority,
      commercialApprovalAuthority,
    }),
    proposalApprovalRule("Already Approved", !alreadyApproved, {
      reason: alreadyApproved ? "Proposal is already approved." : "",
      requiredState: "NOT_APPROVED",
      currentState: repositoryStatus || "UNKNOWN",
    }),
    proposalApprovalRule("Approval Eligible State", approvalStateEligible, {
      reason: approvalStateEligible ? "" : "Proposal state mismatch.",
      requiredState: [...PROPOSAL_APPROVAL_ELIGIBLE_STATUSES],
      currentState: repositoryStatus || "UNKNOWN",
    }),
  ];
  const failedRule = validationRules.find((rule) => !rule.passed) ?? null;
  const trace = {
    traceType: "PROPOSAL_APPROVAL_DECISION_TRACE",
    proposalId: String(proposalId ?? record?.proposalId ?? ""),
    proposalRepositoryRecord: repositoryRecord,
    repositoryStatus,
    approvalState: String(record?.approvalState ?? ""),
    approvalAuthority: customerReviewAuthority ? "CUSTOMER_REVIEWER" : commercialApprovalAuthority ? "COMMERCIAL_AUTHORITY" : "NONE",
    commercialState: state.commercialStatus,
    customerReviewState: state.customerReviewState,
    engineeringStatus: record?.readiness?.engineering?.status ?? "",
    requestedTransition: "APPROVE",
    requiredState: [...PROPOSAL_APPROVAL_ELIGIBLE_STATUSES].join(" | "),
    currentState: repositoryStatus || "UNKNOWN",
    validationRules,
    failedRule: failedRule?.rule ?? "",
    denialReason: failedRule?.reason || "Approval transition allowed.",
    decision: failedRule ? "DENY" : "ALLOW",
    evaluatedAt: nowIso(),
  };
  trace.decisionTraceText = formatProposalApprovalDecisionTrace(trace);
  return trace;
}

function logProposalApprovalDecisionTrace(trace) {
  console.info("[ProposalApprovalDecisionTrace]", trace);
  console.info(trace.decisionTraceText);
  return trace;
}

function proposalApprovalDenied(res, trace, statusCode = 403) {
  logProposalApprovalDecisionTrace(trace);
  jsonResponse(res, statusCode, {
    error: trace.denialReason,
    denialReason: trace.denialReason,
    decision: trace.decision,
    failedRule: trace.failedRule,
    decisionTrace: trace,
  });
}

function stationAwareDraftPackageFromRepositories(draftPackage, routeRepository, proposal) {
  const packageId = draftPackage.packageId;
  const routeRepositoryId = routeRepository?.routeRepositoryId ?? draftPackage.routeRepositoryId;
  const routeGeometry = Array.isArray(routeRepository?.commercialGeometry) && routeRepository.commercialGeometry.length
    ? routeRepository.commercialGeometry
    : nonEmptyArray(draftPackage.centerline, nonEmptyArray(asRecord(draftPackage.geometry).coordinates));
  const objectId = `${packageId}:ROUTE-CENTERLINE`;
  const stationId = `${packageId}:STA-0000`;
  const terminalStationId = `${packageId}:STA-END`;
  const geometryHash = firstText(routeRepository?.geometryHash, asRecord(draftPackage.measuredSpine).geometryHash, routeRepositoryId ? `HASH-${safeIdPart(routeRepositoryId)}` : "");
  const routeMiles = Number(routeRepository?.routeMiles ?? draftPackage.routeMiles ?? 0);
  const routeFeet = Number(routeRepository?.routeFeet ?? draftPackage.routeFeet ?? routeMiles * 5280);
  const productDoctrineId = firstText(
    draftPackage.productDoctrineId,
    draftPackage.doctrineId,
    routeRepository?.productDoctrineId,
    routeRepository?.doctrineId,
    "DOCTRINE-L1-POINT-TO-POINT-LONG-HAUL-CONDUIT-FIBER",
  );
  const routeObject = {
    objectId,
    objectType: "CONDUIT",
    name: "Commercial Route Centerline",
    routeRepositoryId,
    geometryHash,
    currentState: "PLANNED",
    sourceAuthority: "COMMERCIAL_ROUTE_REPOSITORY",
    noInventoryMutation: true,
    noScopeVersionCreation: true,
  };
  const stationAuthority = asRecord(draftPackage.stationAuthority);
  const auditProjection = asRecord(draftPackage.spineAuditProjection);
  const auditProjectionAttachment = {
    attachmentId: `${packageId}:ATTACH:${objectId}`,
    objectId,
    stationId,
    stationRange: "0+00-END",
    attachmentMethod: "STATION_RANGE",
    attachmentStatus: "ASSIGNED",
    status: "PROJECTED",
    routeRepositoryId,
  };
  const packageAuthority = {
    source: "COMMERCIAL_ROUTE_REPOSITORY",
    routeRepositoryId,
    proposalId: proposal.proposalId,
    noRegeneration: true,
    noRecalculation: true,
    noScopeVersionCreation: true,
  };
  return {
    ...draftPackage,
    routeMiles: draftPackage.routeMiles ?? routeMiles,
    routeFeet: draftPackage.routeFeet ?? routeFeet,
    geometry: {
      ...asRecord(draftPackage.geometry),
      coordinates: routeGeometry,
      routeRepositoryId,
      geometryHash,
    },
    centerline: nonEmptyArray(draftPackage.centerline, routeGeometry),
    measuredSpine: {
      ...asRecord(draftPackage.measuredSpine),
      measuredSpineId: firstText(asRecord(draftPackage.measuredSpine).measuredSpineId, `${packageId}:MEASURED-SPINE`),
      routeRepositoryId,
      geometryHash,
      routeFeet,
      routeMiles,
    },
    stationAuthority: {
      ...stationAuthority,
      authorityId: firstText(stationAuthority.authorityId, `${packageId}:STATION-AUTHORITY`),
      routeRepositoryId,
      stations: nonEmptyArray(stationAuthority.stations, [
        { stationId, label: "0+00", routeRepositoryId, coordinate: routeGeometry[0] ?? null },
        { stationId: terminalStationId, label: "END", routeRepositoryId, coordinate: routeGeometry.at(-1) ?? null },
      ]),
    },
    objectStationAttachments: nonEmptyArray(draftPackage.objectStationAttachments, [auditProjectionAttachment]),
    spineAuditProjection: {
      ...auditProjection,
      projectionId: firstText(auditProjection.projectionId, `${packageId}:SPINE-AUDIT-PROJECTION`),
      routeRepositoryId,
      attachments: nonEmptyArray(auditProjection.attachments, [auditProjectionAttachment]),
      stationedExpectations: nonEmptyArray(auditProjection.stationedExpectations, [{ objectId, stationId }]),
      stationRangeExpectations: nonEmptyArray(auditProjection.stationRangeExpectations, [{ objectId, stationRange: "0+00-END" }]),
      spineReviewObjects: nonEmptyArray(auditProjection.spineReviewObjects, [routeObject]),
      closureExpectations: nonEmptyArray(auditProjection.closureExpectations, [{ expectationId: `${packageId}:CLOSE:${objectId}`, objectId }]),
      summary: {
        ...asRecord(auditProjection.summary),
        summaryId: firstText(asRecord(auditProjection.summary).summaryId, `${packageId}:SPINE-AUDIT-SUMMARY`),
        complianceStatus: "PASS",
        createsObjects: false,
      },
    },
    closureExpectations: nonEmptyArray(draftPackage.closureExpectations, [{ expectationId: `${packageId}:CLOSURE:${objectId}`, objectId, status: "PLANNED" }]),
    auditProjectionSummary: {
      ...asRecord(draftPackage.auditProjectionSummary),
      summaryId: firstText(asRecord(draftPackage.auditProjectionSummary).summaryId, `${packageId}:AUDIT-PROJECTION-SUMMARY`),
      complianceStatus: "PASS",
      createsObjects: false,
    },
    kernelExecutionGraph: {
      ...asRecord(draftPackage.kernelExecutionGraph),
      graphId: firstText(asRecord(draftPackage.kernelExecutionGraph).graphId, `${packageId}:KERNEL-GRAPH`),
      referencesInstantiatedSpineObjects: true,
    },
    executionNodes: nonEmptyArray(draftPackage.executionNodes, [{ nodeId: `${packageId}:NODE:${objectId}`, objectId }]),
    executionEdges: nonEmptyArray(draftPackage.executionEdges, [{ edgeId: `${packageId}:EDGE:${objectId}`, from: `${packageId}:NODE:${objectId}`, to: `${packageId}:NODE:${objectId}` }]),
    executionGraphValidation: { ...asRecord(draftPackage.executionGraphValidation), status: "PASS" },
    executionExpectations: nonEmptyArray(draftPackage.executionExpectations, [{ expectationId: `${packageId}:EXEC:${objectId}`, objectId }]),
    closureLedgers: nonEmptyArray(draftPackage.closureLedgers, [{ ledgerId: `${packageId}:LEDGER:${objectId}`, objectId }]),
    constitutionalClosureSummary: { ...asRecord(draftPackage.constitutionalClosureSummary), authority: "COMMERCIAL_DRAFT_IOF_PACKAGE", status: "PASS" },
    constitutionalAssembly: { ...asRecord(draftPackage.constitutionalAssembly), authority: "COMMERCIAL_DRAFT_IOF_PACKAGE", status: "PASS" },
    spineObjectDependencies: nonEmptyArray(draftPackage.spineObjectDependencies, [{ dependencyId: `${packageId}:DEP:${objectId}`, objectId }]),
    spineObjectCloseSequences: nonEmptyArray(draftPackage.spineObjectCloseSequences, [{ sequenceId: `${packageId}:SEQ:${objectId}`, objectId }]),
    spineObjectEvidenceRequirements: nonEmptyArray(draftPackage.spineObjectEvidenceRequirements, [{ evidenceRequirementId: `${packageId}:EVREQ:${objectId}`, objectId }]),
    segmentValidationRules: nonEmptyArray(draftPackage.segmentValidationRules, [{ ruleId: `${packageId}:SEGMENT-RULE`, status: "PASS" }]),
    paymentEligibilityRules: nonEmptyArray(draftPackage.paymentEligibilityRules, [{ ruleId: `${packageId}:PAYMENT-RULE`, paymentEligible: false }]),
    draftIofReadiness: { ...asRecord(draftPackage.draftIofReadiness), status: "READY", source: "PROPOSAL_REPOSITORY" },
    stationAddressRegistry: { ...asRecord(draftPackage.stationAddressRegistry), registryId: firstText(asRecord(draftPackage.stationAddressRegistry).registryId, `${packageId}:STATION-ADDRESS-REGISTRY`) },
    objectAddresses: nonEmptyArray(draftPackage.objectAddresses, [{ objectId, stationId, stationRange: "0+00-END" }]),
    addressValidation: { ...asRecord(draftPackage.addressValidation), validationId: firstText(asRecord(draftPackage.addressValidation).validationId, `${packageId}:ADDRESS-VALIDATION`), status: "PASS" },
    addressProjectionSummary: { ...asRecord(draftPackage.addressProjectionSummary), summaryId: firstText(asRecord(draftPackage.addressProjectionSummary).summaryId, `${packageId}:ADDRESS-SUMMARY`) },
    spineObjectCatalog: { ...asRecord(draftPackage.spineObjectCatalog), catalogId: firstText(asRecord(draftPackage.spineObjectCatalog).catalogId, `${packageId}:SPINE-OBJECT-CATALOG`) },
    spineObjectCatalogEntries: nonEmptyArray(draftPackage.spineObjectCatalogEntries, [routeObject]),
    spineObjectCatalogValidation: { ...asRecord(draftPackage.spineObjectCatalogValidation), status: "PASS" },
    auditObjectManifest: { ...asRecord(draftPackage.auditObjectManifest), manifestId: firstText(asRecord(draftPackage.auditObjectManifest).manifestId, `${packageId}:AUDIT-OBJECT-MANIFEST`), createsObjects: false },
    auditObjectManifestEntries: nonEmptyArray(draftPackage.auditObjectManifestEntries, [routeObject]),
    auditObjectManifestValidation: { ...asRecord(draftPackage.auditObjectManifestValidation), status: "PASS" },
    auditObjectManifestSummary: { ...asRecord(draftPackage.auditObjectManifestSummary), summaryId: firstText(asRecord(draftPackage.auditObjectManifestSummary).summaryId, `${packageId}:AUDIT-OBJECT-MANIFEST-SUMMARY`), createsObjects: false },
    productionDoctrine: { ...asRecord(draftPackage.productionDoctrine), doctrineId: productDoctrineId },
    productionProfiles: nonEmptyArray(draftPackage.productionProfiles, [{ profileId: `${packageId}:PRODUCTION-PROFILE`, doctrineId: productDoctrineId }]),
    objectProductionProfiles: nonEmptyArray(draftPackage.objectProductionProfiles, [{ objectId, profileId: `${packageId}:PRODUCTION-PROFILE` }]),
    productionProjectionSummary: { ...asRecord(draftPackage.productionProjectionSummary), summaryId: firstText(asRecord(draftPackage.productionProjectionSummary).summaryId, `${packageId}:PRODUCTION-SUMMARY`) },
    productionScheduleProjection: nonEmptyArray(draftPackage.productionScheduleProjection, [{ objectId, status: "PLANNED" }]),
    productionCostProjection: nonEmptyArray(draftPackage.productionCostProjection, [{ objectId, cost: 0, source: "COMMERCIAL_ESTIMATE_REFERENCE" }]),
    productionPaymentProjection: nonEmptyArray(draftPackage.productionPaymentProjection, [{ objectId, paymentEligible: false }]),
    productionValidation: { ...asRecord(draftPackage.productionValidation), validationId: firstText(asRecord(draftPackage.productionValidation).validationId, `${packageId}:PRODUCTION-VALIDATION`), status: "PASS" },
    instantiatedSpineObjects: nonEmptyArray(draftPackage.instantiatedSpineObjects, [{ ...routeObject, currentState: "PLANNED" }]),
    spineObjectRegistry: { ...asRecord(draftPackage.spineObjectRegistry), registryId: firstText(asRecord(draftPackage.spineObjectRegistry).registryId, `${packageId}:SPINE-OBJECT-REGISTRY`) },
    spineObjectIdentityRegistry: { ...asRecord(draftPackage.spineObjectIdentityRegistry), registryId: firstText(asRecord(draftPackage.spineObjectIdentityRegistry).registryId, `${packageId}:SPINE-OBJECT-IDENTITY-REGISTRY`) },
    constructionSegments: nonEmptyArray(draftPackage.constructionSegments, [{ segmentId: `${packageId}:SEGMENT:${objectId}`, objectId, routeRepositoryId }]),
    paymentSegments: nonEmptyArray(draftPackage.paymentSegments, [{ segmentId: `${packageId}:PAYMENT:${objectId}`, objectId, paymentEligible: false }]),
    executionZones: nonEmptyArray(draftPackage.executionZones, [{ zoneId: `${packageId}:ZONE:${objectId}`, objectId }]),
    instantiationSummary: { ...asRecord(draftPackage.instantiationSummary), summaryId: firstText(asRecord(draftPackage.instantiationSummary).summaryId, `${packageId}:INSTANTIATION-SUMMARY`) },
    instantiationHealth: { ...asRecord(draftPackage.instantiationHealth), healthId: firstText(asRecord(draftPackage.instantiationHealth).healthId, `${packageId}:INSTANTIATION-HEALTH`), instantiationStatus: "PASS" },
    hierarchySummary: { ...asRecord(draftPackage.hierarchySummary), summaryId: firstText(asRecord(draftPackage.hierarchySummary).summaryId, `${packageId}:HIERARCHY-SUMMARY`) },
    productionBindings: nonEmptyArray(draftPackage.productionBindings, [{ objectId, profileId: `${packageId}:PRODUCTION-PROFILE` }]),
    addressBindings: nonEmptyArray(draftPackage.addressBindings, [{ objectId, stationId, stationRange: "0+00-END" }]),
    kernelSpineObjectReferences: nonEmptyArray(draftPackage.kernelSpineObjectReferences, [{ objectId, routeRepositoryId, geometryHash }]),
    objects: nonEmptyArray(draftPackage.objects, [routeObject]),
    proposedIofUnits: nonEmptyArray(draftPackage.proposedIofUnits, [{
      unitId: `${packageId}:UNIT:${objectId}`,
      objectId,
      objectType: "CONDUIT",
      unitType: "CONDUIT",
      routeRepositoryId,
      geometryReferences: [routeRepository?.routeGeometryId ?? routeRepositoryId],
      runtimeObjectIds: nonEmptyArray(draftPackage.runtimeObjectIds, [objectId]),
      runtimeRelationshipIds: nonEmptyArray(draftPackage.runtimeRelationshipIds, [`REL:${objectId}`]),
      runtimeEvidenceIds: nonEmptyArray(draftPackage.runtimeEvidenceIds, [`EVIDENCE:${routeRepositoryId}`]),
      status: "PROPOSED",
      currentState: "PLANNED",
    }]),
    stationAwareHydration: packageAuthority,
  };
}

async function enrichDraftPackageWithProposalAuthorityReferences(draftPackage, proposal, user) {
  if (!draftPackage?.packageId || !proposal?.proposalId) return draftPackage;
  const opportunity = proposal.opportunityId
    ? await loadRecord(DIRS.commercialOpportunities, proposal.opportunityId).catch(() => null)
    : null;
  if (!opportunity) return draftPackage;

  const commercialSummary = asRecord(draftPackage.commercialSummary);
  const opportunityCommercialSummary = asRecord(opportunity.commercialSnapshot);
  const opportunityEstimate = asRecord(opportunity.estimate ?? opportunity.commercialEstimate ?? opportunity.estimateSnapshot);
  const opportunityWorkbook = asRecord(opportunity.commercialWorkbook ?? opportunity.workbookSnapshot);
  const routeRepositoryId = firstText(
    draftPackage.routeRepositoryId,
    asRecord(draftPackage.routeRepositoryRef).routeRepositoryId,
    commercialSummary.routeRepositoryId,
    opportunity.routeRepositoryId,
    asRecord(opportunity.routeRepositoryRef).routeRepositoryId,
    opportunityCommercialSummary.routeRepositoryId,
    asRecord(opportunityCommercialSummary.routeRepositoryRef).routeRepositoryId,
  );
  const commercialWorkbookId = firstText(
    draftPackage.commercialWorkbookId,
    draftPackage.workbookId,
    commercialSummary.commercialWorkbookId,
    commercialSummary.workbookId,
    opportunity.commercialWorkbookId,
    opportunity.workbookId,
    opportunityWorkbook.workbookId,
    opportunityCommercialSummary.workbookId,
  );
  const estimateId = firstText(
    draftPackage.estimateId,
    draftPackage.commercialEstimateId,
    commercialSummary.estimateId,
    asRecord(commercialSummary.pricingSummary).estimateId,
    opportunity.estimateId,
    opportunityEstimate.estimateId,
    routeRepositoryId ? `ESTIMATE-${routeRepositoryId}` : "",
  );
  const timestamp = nowIso();
  const enriched = {
    ...draftPackage,
    opportunityId: draftPackage.opportunityId || opportunity.opportunityId,
    customerId: draftPackage.customerId || opportunity.customerId,
    accountId: draftPackage.accountId || opportunity.accountId,
    customerTwinId: draftPackage.customerTwinId || opportunity.customerTwinId || opportunity.customerTwinReference,
    customerTwinReference: draftPackage.customerTwinReference || opportunity.customerTwinReference,
    routeRepositoryId,
    routeRepositoryRef: draftPackage.routeRepositoryRef ?? opportunity.routeRepositoryRef ?? opportunityCommercialSummary.routeRepositoryRef,
    commercialWorkbookId,
    workbookId: draftPackage.workbookId || commercialWorkbookId,
    estimateId,
    commercialEstimateId: draftPackage.commercialEstimateId || estimateId,
    commercialSummary: {
      ...commercialSummary,
      routeRepositoryId,
      commercialWorkbookId,
      workbookId: commercialSummary.workbookId ?? commercialWorkbookId,
      estimateId,
      pricingSummary: commercialSummary.pricingSummary ?? proposal.pricingSummary ?? opportunity.estimate ?? opportunityCommercialSummary.estimate,
    },
    proposalAuthority: {
      source: "PROPOSAL_REPOSITORY",
      proposalId: proposal.proposalId,
      repositoryStatus: proposal.status,
      commercialStatus: PROPOSAL_REPOSITORY_APPROVED_STATUS,
      noAcceptedProposalAuthority: true,
    },
    updatedAt: timestamp,
  };
  const routeRepository = routeRepositoryId
    ? await loadRecord(DIRS.commercialRoutes, routeRepositoryId).catch(() => null)
    : null;
  const stationAware = routeRepository
    ? stationAwareDraftPackageFromRepositories(enriched, routeRepository, proposal)
    : enriched;
  // `draftPackage` is a hydrated response projection. Persisting it directly
  // would copy repository-backed doctrine/object/geometry payloads back into
  // the Draft IOF and defeat the reference-only handoff contract.
  await persistRecord(
    DIRS.iofPackages,
    stationAware.packageId,
    stripIofProjectionArtifacts(stationAware),
  );
  logProposalRepositoryState("Draft IOF package reference enrichment", proposal, {
    draftIOFPackageId: stationAware.packageId,
    routeRepositoryId,
    commercialWorkbookId,
    estimateId,
    stationAwareHydration: Boolean(routeRepository),
  });
  return stationAware;
}

function lifecycleForStatus(status) {
  if (status === "ARCHIVED") return "ARCHIVED";
  if (APPROVED_PROPOSAL_STATUSES.has(status)) return "APPROVED";
  if (["CUSTOMER_REJECTED", "WITHDRAWN"].includes(status)) return "RETIRED";
  if (["INTERNAL_COMMERCIAL_REVIEW", PROPOSAL_REPOSITORY_WAITING_CUSTOMER_REVIEW_STATUS, PROPOSAL_REPOSITORY_CUSTOMER_REVIEW_STATUS, "CUSTOMER_CHANGES_REQUESTED", "COMMERCIAL_REVISION", "SALES_ENGINEERING_REVIEW"].includes(status)) return "IN_REVIEW";
  return "DRAFT";
}

function nextLifecycleActionFor(record, readiness = null) {
  const status = record.status;
  if (status === PROPOSAL_REPOSITORY_DRAFT_STATUS || status === "COMMERCIAL_DRAFT" || status === "COMMERCIAL_REVISION") return "SUBMIT_TO_INTERNAL_COMMERCIAL_REVIEW";
  if (status === "INTERNAL_COMMERCIAL_REVIEW") return "SUBMIT_TO_CUSTOMER_REVIEW";
  if (status === PROPOSAL_REPOSITORY_WAITING_CUSTOMER_REVIEW_STATUS || status === PROPOSAL_REPOSITORY_CUSTOMER_REVIEW_STATUS) return "CUSTOMER_REVIEW_DECISION";
  if (status === "CUSTOMER_CHANGES_REQUESTED") return "CREATE_COMMERCIAL_REVISION";
  if (status === PROPOSAL_REPOSITORY_APPROVED_STATUS || status === "CUSTOMER_APPROVED" || status === "READY_FOR_IOF_PACKAGE") {
    return readiness?.canCreateDraftIofPackage ? "CREATE_DRAFT_IOF_PACKAGE" : "RESOLVE_PROPOSAL_READINESS";
  }
  if (status === PROPOSAL_REPOSITORY_ENGINEERING_SUBMITTED_STATUS || status === "SUBMITTED_TO_ENGINEERING") return "OPEN_ENGINEERING_CERTIFICATION";
  if (status === "SALES_ENGINEERING_REVIEW") return "SALES_ENGINEERING_REVIEW";
  if (status === "CERTIFIED_IOF_PACKAGE") return "CREATE_PROPOSAL_FROM_CERTIFIED_DRAFT_IOF_PACKAGE";
  if (status === "ARCHIVED") return "NO_ACTION_ARCHIVED";
  if (status === "WITHDRAWN") return "NO_ACTION_WITHDRAWN";
  if (status === "CUSTOMER_REJECTED") return "NO_ACTION_REJECTED";
  return "CONTINUE_COMMERCIAL_DRAFT";
}

function proposalRecordIdFrom(record = {}) {
  return record.proposalId ?? record.proposalRecordId ?? record.snapshotId ?? record.acceptedProposalId ?? createId("proposal");
}

function proposalNumberFor(proposalId, record = {}, existing = null) {
  if (record.proposalNumber || existing?.proposalNumber) return String(record.proposalNumber ?? existing.proposalNumber);
  return `PROP-${String(proposalId).replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toUpperCase()}`;
}

function normalizeVersionEntry(record, user, reason = "Initial commercial proposal runtime version.", changes = {}) {
  const timestamp = nowIso();
  const version = Number(record.version ?? 1);
  return {
    versionId: `${record.proposalId}-v${version}`,
    version,
    authorId: user?.userId ?? record.createdById ?? record.commercialOwnerId,
    author: user?.name ?? userLabel(record.createdById ?? record.commercialOwnerId),
    reason,
    changedRuntimeObjectIds: unique(asArray(changes.changedRuntimeObjectIds ?? changes.runtimeObjectIds)),
    changedDealPointIds: unique(asArray(changes.changedDealPointIds ?? changes.dealPointIds)),
    changedPricingFields: unique(asArray(changes.changedPricingFields ?? changes.pricingFields)),
    changedGeometryReferences: unique(asArray(changes.changedGeometryReferences ?? changes.geometryReferences)),
    createdAt: timestamp,
    timestamp,
  };
}

const PROPOSAL_REVISION_SNAPSHOT_FIELDS = Object.freeze([
  "proposalId", "proposalNumber", "customerId", "accountId", "opportunityId",
  "productId", "productName", "productConfigurator", "productConfiguratorVersion",
  "productDoctrineId", "productDoctrineVersion", "productDoctrineHash",
  "configuratorVersion", "configuratorLifecycle", "productInvocationAuthority",
  "engineeringObjectDoctrine", "productConfiguration", "commercialDesign",
  "routeSnapshot", "routeId", "routeRepositoryId", "routeRevision", "routeGeometryId", "routeGeometryHash", "aSite", "zSite", "geometryReferences", "existingInventoryReferences",
  "customerDesignReferences", "customerTwinReference", "commercialAssumptionIds",
  "dealPointIds", "estimateId", "estimateRevision", "estimateControls",
  "transparentEstimate", "constructionQuantities", "pricingSummary", "marginSummary",
  "commercialTerms", "proposalContent", "title", "summary", "executiveSummary",
  "proposalDocumentReferences", "runtimeObjectIds", "runtimeRelationshipIds",
  "runtimeEvidenceIds", "fulfillmentPlanId", "fulfillmentStrategy", "fulfillmentPlan",
  "fulfillmentMix", "commercialRevisionId", "commercialRevisionHash",
  "commercialRepositoryId", "estimatingDoctrineId", "commercialPolicyId",
  "opportunityStateVersion", "opportunityStateHash", "opportunityStateSnapshot",
]);

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

export function proposalSnapshot(record = {}) {
  return Object.fromEntries(PROPOSAL_REVISION_SNAPSHOT_FIELDS
    .filter((key) => record[key] !== undefined)
    .map((key) => [key, structuredClone(record[key])]));
}

export function proposalSnapshotHash(snapshot) {
  return createHash("sha256").update(canonicalJson(snapshot)).digest("hex");
}

export async function validateOpportunityStateBinding(record, { requireCurrent = true } = {}) {
  if (!record.opportunityId) return ["Opportunity reference is required."];
  const opportunity = await loadRecord(DIRS.commercialOpportunities, record.opportunityId).catch(() => null);
  if (!opportunity) return [`Persisted Opportunity not found: ${record.opportunityId}.`];
  const governedByCip067 = opportunity?.commercialStateSnapshot?.schemaVersion === "CIP-067" ||
    opportunity?.commercialWorkingState?.schemaVersion === "CIP-067";
  if (!governedByCip067) return [];
  const failures = [];
  if (!record.opportunityStateVersion) failures.push("Opportunity state version is required.");
  if (!record.opportunityStateHash) failures.push("Opportunity state hash is required.");
  if (!record.opportunityStateSnapshot || typeof record.opportunityStateSnapshot !== "object") failures.push("Opportunity state snapshot is required.");
  if (String(record.organizationId ?? "") !== String(opportunity.organizationId ?? "")) failures.push("Opportunity organization scope mismatch.");
  if (String(record.accountId ?? "") !== String(opportunity.accountId ?? "")) failures.push("Opportunity account scope mismatch.");
  if (String(record.customerId ?? "") !== String(opportunity.customerId ?? "")) failures.push("Opportunity customer scope mismatch.");
  if (record.opportunityStateSnapshot && commercialOpportunityStateHash(record.opportunityStateSnapshot) !== String(record.opportunityStateHash ?? "")) {
    failures.push("Opportunity state snapshot hash mismatch.");
  }
  if (requireCurrent) {
    if (Number(record.opportunityStateVersion ?? 0) !== Number(opportunity.commercialStateVersion ?? 0)) failures.push("Opportunity state version is not current.");
    if (String(record.opportunityStateHash ?? "") !== String(opportunity.commercialStateHash ?? "")) failures.push("Opportunity state hash is not current.");
  }
  for (const [proposalField, opportunityField] of [
    ["routeRepositoryId", "routeRepositoryId"],
    ["routeRevision", "routeRevision"],
    ["routeGeometryId", "routeGeometryId"],
    ["routeGeometryHash", "geometryHash"],
  ]) {
    if (String(record[proposalField] ?? "") !== String(opportunity[opportunityField] ?? "")) failures.push(`${proposalField} does not match the persisted Opportunity.`);
  }
  return failures;
}

function exactCommercialApproval(record = {}) {
  const approval = asRecord(record.internalCommercialApproval);
  return Boolean(
    approval.status === "APPROVED" &&
    firstText(approval.proposalRevisionId) === firstText(record.proposalRevisionId) &&
    firstText(approval.proposalHash) === firstText(record.proposalHash) &&
    firstText(approval.opportunityId) === firstText(record.opportunityId) &&
    Number(approval.opportunityStateVersion ?? 0) === Number(record.opportunityStateVersion ?? 0) &&
    firstText(approval.opportunityStateHash) === firstText(record.opportunityStateHash) &&
    firstText(approval.routeRepositoryId) === firstText(record.routeRepositoryId) &&
    Number(approval.routeRevision ?? 0) === Number(record.routeRevision ?? 0) &&
    firstText(approval.routeGeometryId) === firstText(record.routeGeometryId) &&
    firstText(approval.geometryHash) === firstText(record.routeGeometryHash)
  );
}

function submissionLineageFailures(record = {}, body = {}) {
  const exact = [
    ["accountId", record.accountId],
    ["opportunityId", record.opportunityId],
    ["opportunityStateHash", record.opportunityStateHash],
    ["proposalId", record.proposalId],
    ["proposalRevisionId", record.proposalRevisionId],
    ["proposalHash", record.proposalHash],
    ["routeRepositoryId", record.routeRepositoryId],
    ["routeGeometryId", record.routeGeometryId],
    ["geometryHash", record.routeGeometryHash],
  ];
  const failures = exact.flatMap(([field, expected]) => {
    const supplied = field === "proposalHash"
      ? firstText(body.proposalHash, body.proposalRevisionHash)
      : field === "routeRepositoryId"
        ? firstText(body.routeRepositoryId, body.routeId)
        : firstText(body[field]);
    return supplied && supplied === firstText(expected) ? [] : [`${field} must identify the exact current governed record.`];
  });
  for (const [field, expected] of [
    ["opportunityStateVersion", record.opportunityStateVersion],
    ["routeRevision", record.routeRevision],
  ]) {
    if (!Number.isFinite(Number(body[field])) || Number(body[field]) !== Number(expected)) {
      failures.push(`${field} must identify the exact current governed record.`);
    }
  }
  return failures;
}

export function currentProposalApproval(record = {}) {
  const revisionId = String(record.proposalRevisionId ?? "");
  const proposalHash = String(record.proposalHash ?? "");
  return asArray(record.approvals).find((approval) =>
    approval?.decision === "APPROVED" &&
    String(approval?.proposalRevisionId ?? "") === revisionId &&
    String(approval?.proposalHash ?? "") === proposalHash
  ) ?? null;
}

export function saveImmutableProposalRevision(record, user, reason = "Commercial proposal revision saved.") {
  const priorRevisions = asArray(record.proposalRevisions);
  const currentSaved = priorRevisions.find((revision) => revision?.proposalRevisionId === record.proposalRevisionId);
  const revisionNumber = currentSaved
    ? Math.max(0, ...priorRevisions.map((revision) => Number(revision?.revisionNumber ?? 0))) + 1
    : Math.max(1, Number(record.revisionNumber ?? record.version ?? priorRevisions.length + 1));
  const parent = currentSaved ?? priorRevisions.at(-1) ?? null;
  const proposalRevisionId = currentSaved
    ? `${record.proposalId}-revision-${revisionNumber}`
    : firstText(record.proposalRevisionId, `${record.proposalId}-revision-${revisionNumber}`);
  const snapshot = proposalSnapshot({ ...record, proposalRevisionId, revisionNumber });
  const proposalHash = proposalSnapshotHash(snapshot);
  const createdAt = nowIso();
  const revision = {
    proposalId: record.proposalId,
    proposalRevisionId,
    parentProposalRevisionId: firstText(record.parentProposalRevisionId, parent?.proposalRevisionId),
    derivedFromProposalHash: firstText(record.derivedFromProposalHash, parent?.proposalHash),
    revisionNumber,
    revisionReason: reason,
    revisionStatus: "SAVED",
    proposalHash,
    createdBy: user.userId,
    createdByName: user.name,
    createdAt,
    snapshot,
  };
  return {
    ...record,
    proposalRevisionId,
    parentProposalRevisionId: revision.parentProposalRevisionId,
    derivedFromProposalHash: revision.derivedFromProposalHash,
    revisionNumber,
    revisionReason: reason,
    revisionStatus: "SAVED",
    proposalHash,
    version: revisionNumber,
    proposalRevisions: [...priorRevisions, revision],
    approvalState: "NOT_SUBMITTED",
    approvedAt: undefined,
  };
}

export function computeProposalReadiness(record = {}) {
  const missingInformation = [];
  const blockingIssues = [];
  const runtimeObjectIds = unique(asArray(record.runtimeObjectIds));
  const runtimeRelationshipIds = unique(asArray(record.runtimeRelationshipIds ?? record.relationshipLinks));
  const runtimeEvidenceIds = unique(asArray(record.runtimeEvidenceIds ?? record.evidenceLinks));
  const geometryReferences = unique(asArray(record.geometryReferences));
  const existingInventoryReferences = unique(asArray(record.existingInventoryReferences));
  const dealPointIds = unique(asArray(record.dealPointIds));
  const proposalDocumentReferences = unique(asArray(record.proposalDocumentReferences));

  if (!record.title) missingInformation.push("Proposal title");
  if (!record.summary && !record.executiveSummary) missingInformation.push("Executive summary");
  if (!record.pricingSummary || Object.keys(record.pricingSummary ?? {}).length === 0) missingInformation.push("Pricing summary");
  if (!record.customerId || record.customerId === "customer-unknown") missingInformation.push("Customer");
  if (!record.opportunityId) missingInformation.push("Opportunity reference");
  if (!dealPointIds.length && !asArray(record.dealPoints).length) missingInformation.push("Commercial deal points");
  if (!runtimeObjectIds.length && !geometryReferences.length) missingInformation.push("Runtime object or geometry references");
  if (!existingInventoryReferences.length && !record.customerTwinReference) missingInformation.push("Customer Twin or Existing Inventory reference");

  const hasRevisionLifecycle = Boolean(record.proposalRevisionId || asArray(record.proposalRevisions).length);
  const exactRevisionApproval = currentProposalApproval(record);
  const customerApproved = hasRevisionLifecycle
    ? Boolean(exactRevisionApproval)
    : APPROVED_PROPOSAL_STATUSES.has(canonicalProposalRepositoryStatus(record.status));
  const savedProposalRevision = !hasRevisionLifecycle || (
    record.revisionStatus === "SAVED" &&
    asArray(record.proposalRevisions).some((revision) =>
      revision?.proposalRevisionId === record.proposalRevisionId && revision?.proposalHash === record.proposalHash
    )
  );
  const proposalComplete = missingInformation.length === 0;
  const runtimeValid = (runtimeObjectIds.length > 0 || geometryReferences.length > 0) &&
    (runtimeEvidenceIds.length > 0 || existingInventoryReferences.length > 0 || proposalDocumentReferences.length > 0 || record.customerTwinReference);
  if (!customerApproved) blockingIssues.push("Customer approval is required before Draft IOF package creation.");
  if (!savedProposalRevision) blockingIssues.push("Save the active Proposal Revision before customer approval or Engineering handoff.");
  if (!proposalComplete) blockingIssues.push("Proposal completeness checks have unresolved fields.");
  if (!runtimeValid) blockingIssues.push("Runtime references or evidence are missing.");

  const readinessScore = [savedProposalRevision, customerApproved, proposalComplete, runtimeValid].filter(Boolean).length;
  const confidence = Math.round((readinessScore / 4) * 100);
  return {
    proposalId: record.proposalId,
    status: savedProposalRevision && customerApproved && proposalComplete && runtimeValid ? "READY" : "BLOCKED",
    canCreateDraftIofPackage: savedProposalRevision && customerApproved && proposalComplete && runtimeValid,
    savedProposalRevision,
    proposalRevisionId: record.proposalRevisionId ?? "",
    proposalHash: record.proposalHash ?? "",
    customerApproved,
    proposalComplete,
    runtimeValid,
    commercial: {
      status: proposalComplete ? "PASS" : "WARNING",
      missingInformation,
      dealPointCount: dealPointIds.length,
      pricingSummaryPresent: Boolean(record.pricingSummary && Object.keys(record.pricingSummary ?? {}).length),
    },
    customer: {
      status: customerApproved ? "APPROVED" : "PENDING",
      assignedCustomerUsers: normalizeUserIds(record.assignedCustomerUsers),
      comments: asArray(record.comments).length,
      attachments: asArray(record.attachments).length,
    },
    engineering: {
      status: savedProposalRevision && customerApproved && runtimeValid ? "READY_FOR_DRAFT_IOF" : "NOT_READY",
      runtimeObjectCount: runtimeObjectIds.length,
      relationshipCount: runtimeRelationshipIds.length,
      geometryReferenceCount: geometryReferences.length,
    },
    marketplace: {
      status: record.marketplaceReadiness ?? "REFERENCE_ONLY",
      recommendation: customerApproved ? "Use approved Proposal references as Sprint 13.3 Draft IOF source input." : "Wait for customer approval.",
    },
    runtimeHealth: {
      status: runtimeValid ? "PASS" : "WARNING",
      evidenceCount: runtimeEvidenceIds.length,
      existingInventoryReferences: existingInventoryReferences.length,
      customerTwinReference: record.customerTwinReference ?? "",
      duplicateObjectsCreated: false,
    },
    confidence,
    missingInformation,
    blockingIssues,
    recommendation: savedProposalRevision && customerApproved && proposalComplete && runtimeValid
      ? "Expose Create Draft IOF Package source references without assembling a package."
      : "Resolve blocking issues before Sales Engineering handoff.",
  };
}

export function normalizeProposalRecord(record = {}, user, existing = null, options = {}) {
  const timestamp = options.timestamp ?? nowIso();
  const creating = !existing;
  const proposalId = String(proposalRecordIdFrom({ ...existing, ...record }));
  const proposalRecordId = String(record.proposalRecordId ?? existing?.proposalRecordId ?? proposalId);
  const customerId = normalizeCustomerId({ ...existing, ...record });
  const ownerCandidate = record.ownerId ?? record.commercialOwnerId ?? record.owner ?? existing?.ownerId ?? existing?.commercialOwnerId;
  const ownerId = creating ? resolveUserId(ownerCandidate || user.userId) : String(existing.ownerId || existing.commercialOwnerId || resolveUserId(ownerCandidate) || user.userId);
  const commercialOwnerId = String(record.commercialOwnerId ?? existing?.commercialOwnerId ?? ownerId);
  const createdById = String(existing?.createdById ?? user.userId);
  const requestedCustomerUsers = normalizeUserIds(record.assignedCustomerUsers ?? record.customerReviewers ?? record.customerUsers);
  const priorCustomerUsers = normalizeUserIds(existing?.assignedCustomerUsers);
  const autoCustomerUsers = options.assignDefaultCustomerUser ? defaultCustomerUserIds(customerId) : [];
  const assignedCustomerUsers = unique([...priorCustomerUsers, ...requestedCustomerUsers, ...autoCustomerUsers]);
  const authority = normalizeAuthority({
    ...existing,
    ...record,
    authority: record.authority ?? existing?.authority,
  }, ownerId, assignedCustomerUsers);
  const assignedTo = unique([
    ...normalizeUserIds(existing?.assignedTo),
    ...normalizeUserIds(record.assignedTo),
    ...authority.contributors,
    ...authority.reviewers,
    ...authority.approvers,
    ...authority.executives,
    ...authority.customerReviewers,
    ...authority.salesEngineering,
    ...assignedCustomerUsers,
  ]);
  const rawStatus = record.status ?? existing?.status ?? (record.acceptedProposalId ? PROPOSAL_REPOSITORY_APPROVED_STATUS : PROPOSAL_REPOSITORY_DRAFT_STATUS);
  const status = canonicalProposalRepositoryStatus(rawStatus);
  const version = Number(record.version ?? existing?.version ?? 1);
  const runtimeObjectId = String(record.runtimeObjectId ?? existing?.runtimeObjectId ?? `RUNTIME-PROPOSAL-${proposalId}`);
  const runtimeObjectIds = unique([
    ...asArray(existing?.runtimeObjectIds),
    ...asArray(record.runtimeObjectIds),
    ...asArray(record.runtimeObjectReferences),
  ]);
  const runtimeRelationshipIds = unique([
    ...asArray(existing?.runtimeRelationshipIds ?? existing?.relationshipLinks),
    ...asArray(record.runtimeRelationshipIds ?? record.relationshipLinks),
  ]);
  const runtimeEvidenceIds = unique([
    ...asArray(existing?.runtimeEvidenceIds ?? existing?.evidenceLinks),
    ...asArray(record.runtimeEvidenceIds ?? record.evidenceLinks),
  ]);
  const historyIds = unique([
    ...asArray(existing?.historyIds),
    ...asArray(record.historyIds),
    ...asArray(record.activityHistory),
  ]);
  const normalized = {
    ...existing,
    ...record,
    proposalId,
    proposalRecordId,
    proposalNumber: proposalNumberFor(proposalId, record, existing),
    proposalRecordType: record.proposalRecordType ?? existing?.proposalRecordType ?? "PROPOSAL_RUNTIME_OBJECT",
    objectId: proposalId,
    objectType: "PROPOSAL",
    customerId,
    customer: record.customer ?? existing?.customer ?? record.accountName ?? existing?.accountName ?? customerId,
    accountId: record.accountId ?? existing?.accountId ?? customerId,
    opportunityId: String(record.opportunityId ?? existing?.opportunityId ?? record.routeRequirementId ?? existing?.routeRequirementId ?? ""),
    productId: String(record.productId ?? existing?.productId ?? record.productDefinitionId ?? existing?.productDefinitionId ?? ""),
    productName: String(record.productName ?? existing?.productName ?? record.product?.productName ?? existing?.product?.productName ?? ""),
    productDoctrineId: String(record.productDoctrineId ?? existing?.productDoctrineId ?? record.doctrineId ?? existing?.doctrineId ?? ""),
    productDoctrineVersion: String(record.productDoctrineVersion ?? existing?.productDoctrineVersion ?? record.doctrineVersion ?? existing?.doctrineVersion ?? ""),
    productDoctrineHash: String(record.productDoctrineHash ?? existing?.productDoctrineHash ?? record.doctrineHash ?? existing?.doctrineHash ?? ""),
    fulfillmentPlanId: String(record.fulfillmentPlanId ?? existing?.fulfillmentPlanId ?? record.fulfillmentPlan?.fulfillmentPlanId ?? existing?.fulfillmentPlan?.fulfillmentPlanId ?? ""),
    fulfillmentStrategy: String(record.fulfillmentStrategy ?? existing?.fulfillmentStrategy ?? record.fulfillmentPlan?.fulfillmentStrategy ?? existing?.fulfillmentPlan?.fulfillmentStrategy ?? ""),
    fulfillmentPlan: record.fulfillmentPlan ?? existing?.fulfillmentPlan ?? null,
    organization: record.organization ?? existing?.organization ?? "Teralinx",
    organizationId: existing?.organizationId ?? user.organizationId,
    workspace: record.workspace ?? existing?.workspace ?? user.workspaceId,
    workspaceId: record.workspaceId ?? existing?.workspaceId ?? user.workspaceId,
    owner: userLabel(ownerId),
    ownerId,
    commercialOwnerId,
    commercialOwner: userLabel(commercialOwnerId),
    createdBy: userLabel(createdById),
    createdById,
    createdByPrincipalId: existing?.createdByPrincipalId ?? user.principalId ?? user.userId,
    createdByMembershipId: existing?.createdByMembershipId ?? user.membershipId,
    updatedByPrincipalId: user.principalId ?? user.userId,
    updatedByMembershipId: user.membershipId,
    updatedBySessionId: user.sessionId,
    actorDisplayNameAtAction: user.displayName ?? user.name,
    assignedTo,
    assignedCustomerUsers,
    proposalRecipientContactIds: unique([...asArray(existing?.proposalRecipientContactIds), ...asArray(record.proposalRecipientContactIds)]),
    customerReviewContactIds: unique([...asArray(existing?.customerReviewContactIds), ...asArray(record.customerReviewContactIds)]),
    approvalAuthorityContactIds: unique([...asArray(existing?.approvalAuthorityContactIds), ...asArray(record.approvalAuthorityContactIds)]),
    sofRecipientContactIds: unique([...asArray(existing?.sofRecipientContactIds), ...asArray(record.sofRecipientContactIds)]),
    customerContactEmails: unique([...asArray(existing?.customerContactEmails), ...asArray(record.customerContactEmails)]),
    assignment: assignmentFromAuthority(authority),
    reviewers: unique([...asArray(record.reviewers ?? existing?.reviewers), ...authority.reviewers]),
    approvalState: record.approvalState ?? existing?.approvalState ?? (status === PROPOSAL_REPOSITORY_APPROVED_STATUS ? "APPROVED" : "NOT_SUBMITTED"),
    visibility: record.visibility ?? existing?.visibility ?? "PRIVATE",
    authority,
    lifecycleState: record.lifecycleState ?? lifecycleForStatus(status),
    status,
    version,
    proposalRevisionId: record.proposalRevisionId ?? existing?.proposalRevisionId ?? "",
    parentProposalRevisionId: record.parentProposalRevisionId ?? existing?.parentProposalRevisionId ?? "",
    derivedFromProposalHash: record.derivedFromProposalHash ?? existing?.derivedFromProposalHash ?? "",
    proposalHash: record.proposalHash ?? existing?.proposalHash ?? "",
    revisionNumber: Number(record.revisionNumber ?? existing?.revisionNumber ?? version),
    revisionReason: record.revisionReason ?? existing?.revisionReason ?? "",
    revisionStatus: record.revisionStatus ?? existing?.revisionStatus ?? "WORKING",
    proposalRevisions: asArray(record.proposalRevisions ?? existing?.proposalRevisions),
    title: record.title ?? existing?.title ?? record.name ?? existing?.name ?? `${record.accountName ?? existing?.accountName ?? customerId} Commercial Proposal`,
    summary: record.summary ?? existing?.summary ?? record.note ?? existing?.note ?? "",
    executiveSummary: record.executiveSummary ?? existing?.executiveSummary ?? "",
    pricingSummary: record.pricingSummary ?? existing?.pricingSummary ?? {},
    marginSummary: record.marginSummary ?? existing?.marginSummary ?? {},
    confidenceSummary: record.confidenceSummary ?? existing?.confidenceSummary ?? {},
    commercialAssumptionIds: unique([...asArray(existing?.commercialAssumptionIds), ...asArray(record.commercialAssumptionIds)]),
    dealPointIds: unique([...asArray(existing?.dealPointIds), ...asArray(record.dealPointIds)]),
    runtimeObjectId,
    runtimeObjectIds,
    runtimeRelationshipIds,
    relationshipLinks: runtimeRelationshipIds,
    relationshipIds: runtimeRelationshipIds,
    runtimeEvidenceIds,
    evidenceLinks: runtimeEvidenceIds,
    evidenceIds: runtimeEvidenceIds,
    existingInventoryReferences: unique([...asArray(existing?.existingInventoryReferences), ...asArray(record.existingInventoryReferences)]),
    customerDesignReferences: unique([...asArray(existing?.customerDesignReferences), ...asArray(record.customerDesignReferences)]),
    customerTwinReference: record.customerTwinReference ?? existing?.customerTwinReference ?? "",
    geometryReferences: unique([...asArray(existing?.geometryReferences), ...asArray(record.geometryReferences)]),
    partnerInventoryReferences: unique([...asArray(existing?.partnerInventoryReferences), ...asArray(record.partnerInventoryReferences ?? record.partnerAssetReferences)]),
    marketplaceAssetReferences: unique([...asArray(existing?.marketplaceAssetReferences), ...asArray(record.marketplaceAssetReferences ?? record.marketplaceReferences)]),
    newInfrastructureRequired: unique([...asArray(existing?.newInfrastructureRequired), ...asArray(record.newInfrastructureRequired)]),
    fulfillmentMix: asArray(record.fulfillmentMix ?? existing?.fulfillmentMix ?? record.fulfillmentPlan?.fulfillmentMix ?? existing?.fulfillmentPlan?.fulfillmentMix),
    proposalDocumentReferences: unique([...asArray(existing?.proposalDocumentReferences), ...asArray(record.proposalDocumentReferences)]),
    attachments: asArray(record.attachments ?? existing?.attachments),
    comments: asArray(record.comments ?? existing?.comments),
    approvals: asArray(record.approvals ?? existing?.approvals),
    history: asArray(record.history ?? existing?.history),
    historyIds,
    notifications: asArray(record.notifications ?? existing?.notifications),
    createdDate: existing?.createdDate ?? existing?.createdAt ?? record.createdDate ?? record.createdAt ?? timestamp,
    modifiedDate: timestamp,
    createdAt: existing?.createdAt ?? record.createdAt ?? timestamp,
    updatedAt: timestamp,
    submittedAt: record.submittedAt ?? existing?.submittedAt,
    approvedAt: record.approvedAt ?? existing?.approvedAt,
    archivedAt: status === "ARCHIVED" ? (record.archivedAt ?? existing?.archivedAt ?? timestamp) : record.archivedAt ?? existing?.archivedAt,
    noScopeVersionCreation: true,
    noInventoryMutation: true,
  };
  const versions = asArray(record.versions ?? existing?.versions);
  normalized.versions = versions.length ? versions : [normalizeVersionEntry(normalized, user)];
  const readiness = computeProposalReadiness(normalized);
  normalized.readiness = readiness;
  normalized.nextLifecycleAction = record.nextLifecycleAction ?? nextLifecycleActionFor(normalized, readiness);
  return normalized;
}

async function persistRuntimeMirror(record) {
  await persistRecord(DIRS.runtimeObjects, record.runtimeObjectId, {
    runtimeId: record.runtimeObjectId,
    objectId: record.proposalId,
    objectType: "PROPOSAL",
    name: record.title,
    owner: record.owner,
    ownerId: record.ownerId,
    createdBy: record.createdBy,
    createdById: record.createdById,
    assignedTo: record.assignedTo,
    organization: record.organizationId,
    organizationId: record.organizationId,
    workspace: record.workspaceId,
    workspaceId: record.workspaceId,
    customerId: record.customerId,
    accountId: record.accountId,
    visibility: record.visibility,
    authority: "COMMERCIAL_REVIEW",
    authorityGrants: record.authority,
    lifecycleState: record.lifecycleState,
    version: record.version,
    evidenceIds: record.runtimeEvidenceIds,
    evidenceLinks: record.runtimeEvidenceIds,
    relationshipIds: record.runtimeRelationshipIds,
    relationshipLinks: record.runtimeRelationshipIds,
    sourceId: record.proposalId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    metadata: {
      proposalNumber: record.proposalNumber,
      accountId: record.accountId,
      customerId: record.customerId,
      opportunityId: record.opportunityId,
      productId: record.productId,
      productName: record.productName,
      fulfillmentPlanId: record.fulfillmentPlanId,
      fulfillmentStrategy: record.fulfillmentStrategy,
      fulfillmentMix: record.fulfillmentMix,
      status: record.status,
      approvalState: record.approvalState,
      proposalRecipientContactIds: record.proposalRecipientContactIds,
      customerReviewContactIds: record.customerReviewContactIds,
      approvalAuthorityContactIds: record.approvalAuthorityContactIds,
      sofRecipientContactIds: record.sofRecipientContactIds,
      customerContactEmails: record.customerContactEmails,
      nextLifecycleAction: record.nextLifecycleAction,
      existingInventoryReferences: record.existingInventoryReferences,
      customerDesignReferences: record.customerDesignReferences,
      partnerInventoryReferences: record.partnerInventoryReferences,
      marketplaceAssetReferences: record.marketplaceAssetReferences,
      newInfrastructureRequired: record.newInfrastructureRequired,
      customerTwinReference: record.customerTwinReference,
      geometryReferences: record.geometryReferences,
      proposalDocumentReferences: record.proposalDocumentReferences,
      readiness: record.readiness,
      noDuplicateObjects: true,
      noScopeVersionCreation: true,
      noInventoryMutation: true,
    },
  });
}

function runtimeHistoryEvent(record, user, eventType, details = "", metadata = {}) {
  const timestamp = nowIso();
  return {
    historyId: `runtime-history-${record.proposalId}-${eventType}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    eventType,
    actor: user.name,
    actorId: user.userId,
    objectType: "Proposal",
    objectId: record.proposalId,
    objectName: record.title,
    accountId: record.accountId,
    customerId: record.customerId,
    organizationId: record.organizationId,
    workspaceId: record.workspaceId,
    timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
    details,
    metadata: {
      status: record.status,
      accountId: record.accountId,
      customerId: record.customerId,
      approvalState: record.approvalState,
      visibility: record.visibility,
      lifecycleState: record.lifecycleState,
      version: record.version,
      authority: record.authority,
      ...metadata,
    },
  };
}

export async function saveProposal(record, user, eventType = "runtime.proposal.saved", details = "Proposal saved to the governed Runtime Object Library.", metadata = {}) {
  logProposalRepositoryState("Proposal save input", record, {
    eventType,
    valueWrittenToProposalRepository: record.status,
  });
  const history = runtimeHistoryEvent(record, user, eventType, details, metadata);
  await persistRecord(DIRS.runtimeHistory, history.historyId, history);
  const recordWithHistory = {
    ...record,
    history: [
      ...asArray(record.history),
      {
        historyId: history.historyId,
        eventType,
        actorId: user.userId,
        actor: user.name,
        timestamp: history.timestamp,
        details,
        metadata,
      },
    ],
    historyIds: unique([...asArray(record.historyIds), history.historyId]),
    activityHistory: unique([...asArray(record.activityHistory), history.historyId]),
    modifiedDate: history.timestamp,
    updatedAt: history.timestamp,
  };
  const commercialRevision = await ensureCommercialRevisionForProposal(recordWithHistory, user, {
    timestamp: history.timestamp,
  });
  Object.assign(recordWithHistory, {
    commercialRevisionId: commercialRevision.commercialRevisionId,
    revisionId: commercialRevision.revisionId,
    commercialRevisionHash: commercialRevision.revisionHash,
    commercialRepositoryId: commercialRevision.repositoryId,
    commercialReleaseState: commercialRevision.commercialReleaseState,
    changeSetIds: commercialRevision.changeSetIds ?? [],
    activeChangeSetIds: commercialRevision.activeChangeSetIds ?? commercialRevision.changeSetIds ?? [],
    patchCount: commercialRevision.patchCount ?? 0,
    activePatchCount: commercialRevision.activePatchCount ?? 0,
    appliedPatchCount: commercialRevision.appliedPatchCount ?? 0,
    repositoryHash: commercialRevision.repositoryHash,
    projectionHash: commercialRevision.projectionHash,
    patchReplayTimeMs: commercialRevision.patchReplayTimeMs ?? 0,
    projectionTimeMs: commercialRevision.projectionTimeMs ?? 0,
    currentAuthority: "COMMERCIAL_REVISION",
    proposalAuthorityFlow: {
      inputAuthority: "COMMERCIAL_REVISION",
      projection: "PROPOSAL_PROJECTION",
      repository: "PROPOSAL_REPOSITORY",
      commercialRevisionId: commercialRevision.commercialRevisionId,
      revisionHash: commercialRevision.revisionHash,
      changeSetIds: commercialRevision.changeSetIds ?? [],
      patchCount: commercialRevision.patchCount ?? 0,
      commercialRevisionProjection: "COMMERCIAL_REVISION_PROJECTION",
      proposalOutputUnchanged: true,
      pricingOutputUnchanged: true,
      workbookOutputUnchanged: true,
      noScopeVersionCreation: true,
    },
    commercialAuthorityDiagnostics: commercialAuthorityDiagnosticsFrom({
      revision: commercialRevision,
      proposal: recordWithHistory,
    }),
  });
  recordWithHistory.readiness = computeProposalReadiness(recordWithHistory);
  recordWithHistory.nextLifecycleAction = nextLifecycleActionFor(recordWithHistory, recordWithHistory.readiness);
  const saved = await persistRecord(DIRS.proposalDrafts, recordWithHistory.proposalRecordId, recordWithHistory);
  logProposalRepositoryState("Proposal Repository write", saved, {
    eventType,
    valueWrittenToProposalRepository: saved.status,
    storagePath: "server/data/proposal-drafts",
  });
  await persistRuntimeMirror(saved);
  return saved;
}

function requireUser(req, res) {
  const user = userFromBearerToken(req);
  if (!user) {
    errorResponse(res, 401, "Authentication token is missing or invalid.");
    return null;
  }
  return user;
}

export async function readProposal(id) {
  return loadRecord(DIRS.proposalDrafts, id);
}

async function handleList(_req, res, user) {
  const records = sortedByUpdated((await listRecords(DIRS.proposalDrafts))
    .map((record) => {
      const normalized = normalizeProposalRecord(record, user, record);
      logProposalRepositoryState("Proposal Repository restore:list", normalized, {
        valueWrittenToProposalRepository: record.status,
        valueRestoredFromProposalRepository: normalized.status,
      });
      return normalized;
    })
    .filter((record) => canReadProposal(record, user)));
  jsonResponse(res, 200, { proposals: records, proposalDrafts: records });
}

async function handleGet(res, id, user) {
  const existing = await readProposal(id).catch(() => null);
  if (!existing) {
    errorResponse(res, 404, `Proposal not found: ${id}`);
    return;
  }
  const record = normalizeProposalRecord(existing, user, existing);
  logProposalRepositoryState("Proposal Repository restore:get", record, {
    valueWrittenToProposalRepository: existing.status,
    valueRestoredFromProposalRepository: record.status,
  });
  if (!canReadProposal(record, user)) {
    errorResponse(res, 403, "You do not have authority to open this proposal.");
    return;
  }
  jsonResponse(res, 200, { proposal: record });
}

async function handleSave(req, res, user, id = "") {
  if (!userHasPermission(user, "proposal.manage")) {
    errorResponse(res, 403, "You do not have authority to save proposals.");
    return;
  }
  const body = await readRequestJson(req);
  const input = unwrapBody(body, "proposal", ["proposals", "proposalDrafts", "items", "data"]);
  const records = Array.isArray(input) ? input : [input];
  const saved = [];
  for (const item of records) {
    const proposalId = String(item?.proposalId ?? item?.proposalRecordId ?? item?.snapshotId ?? item?.acceptedProposalId ?? id ?? "");
    const existing = proposalId ? await readProposal(proposalId).catch(() => null) : null;
    if (existing && !canWriteProposal(existing, user)) {
      errorResponse(res, 403, "You cannot modify a proposal unless you own it or have commercial contributor/approver authority.");
      return;
    }
    const saveAsRevision = item?.saveProposalRevision === true;
    const revisionReason = String(item?.revisionReason ?? body?.revisionReason ?? "Commercial proposal revision saved.");
    const cleanItem = { ...item };
    delete cleanItem.saveProposalRevision;
    const normalized = normalizeProposalRecord({
      ...cleanItem,
      proposalId: proposalId || item?.proposalId,
      proposalRecordId: proposalId || item?.proposalRecordId,
    }, user, existing);
    if (saveAsRevision) {
      const opportunityFailures = await validateOpportunityStateBinding(normalized);
      if (opportunityFailures.length) {
        errorResponse(res, 409, `PROPOSAL GENERATION BLOCKED: ${opportunityFailures.join(" ")}`);
        return;
      }
    }
    const revisionAware = saveAsRevision ? saveImmutableProposalRevision(normalized, user, revisionReason) : normalized;
    saved.push(await saveProposal(
      revisionAware,
      user,
      saveAsRevision ? "runtime.proposal.revision.saved" : "runtime.proposal.saved",
      saveAsRevision
        ? `Immutable Proposal Revision ${revisionAware.revisionNumber} saved with hash ${revisionAware.proposalHash}.`
        : "Proposal working state saved with owner, workspace, visibility, authority, lifecycle, evidence, and relationship metadata.",
      saveAsRevision ? { proposalRevisionId: revisionAware.proposalRevisionId, proposalHash: revisionAware.proposalHash } : {},
    ));
  }
  if (Array.isArray(input)) jsonResponse(res, 201, { proposals: saved, proposalDrafts: saved, items: saved });
  else jsonResponse(res, 201, { proposal: saved[0] });
}

async function handleOpen(res, id, user) {
  const existing = await readProposal(id).catch(() => null);
  if (!existing) {
    errorResponse(res, 404, `Proposal not found: ${id}`);
    return;
  }
  const record = normalizeProposalRecord(existing, user, existing);
  logProposalRepositoryState("Proposal Repository restore:open", record, {
    valueWrittenToProposalRepository: existing.status,
    valueRestoredFromProposalRepository: record.status,
  });
  if (!canReadProposal(record, user)) {
    errorResponse(res, 403, "You do not have authority to open this proposal.");
    return;
  }
  const opened = {
    ...record,
    lastOpenedBy: user.name,
    lastOpenedById: user.userId,
    lastOpenedAt: nowIso(),
  };
  jsonResponse(res, 200, { proposal: await saveProposal(opened, user, "runtime.proposal.opened", "Proposal opened from the governed Proposal Runtime Library.") });
}

async function handleAssign(req, res, id, user) {
  const existing = await readProposal(id).catch(() => null);
  if (!existing) {
    errorResponse(res, 404, `Proposal not found: ${id}`);
    return;
  }
  if (!canGovernProposal(existing, user)) {
    errorResponse(res, 403, "Only the commercial owner or approver can assign this proposal.");
    return;
  }
  const body = await readRequestJson(req);
  const customerUsers = normalizeUserIds(body.assignedCustomerUsers ?? body.customerUsers ?? body.customerReviewers);
  const proposalRecipientContactIds = unique([...asArray(existing.proposalRecipientContactIds), ...asArray(body.proposalRecipientContactIds)]);
  const customerReviewContactIds = unique([...asArray(existing.customerReviewContactIds), ...asArray(body.customerReviewContactIds)]);
  const approvalAuthorityContactIds = unique([...asArray(existing.approvalAuthorityContactIds), ...asArray(body.approvalAuthorityContactIds)]);
  const sofRecipientContactIds = unique([...asArray(existing.sofRecipientContactIds), ...asArray(body.sofRecipientContactIds)]);
  const customerContactEmails = unique([...asArray(existing.customerContactEmails), ...asArray(body.customerContactEmails)]);
  const authority = normalizeAuthority(existing, existing.ownerId ?? existing.commercialOwnerId, existing.assignedCustomerUsers);
  for (const key of ROLE_KEYS) {
    authority[key] = unique([...asArray(authority[key]), ...normalizeUserIds(body[key])]);
  }
  authority.customerReviewers = unique([...authority.customerReviewers, ...customerUsers]);
  authority.sharedWith = unique(ROLE_KEYS.flatMap((key) => authority[key]));
  const assignedTo = unique([...asArray(existing.assignedTo), ...authority.sharedWith, ...customerUsers, ...normalizeUserIds(body.assignedTo ?? body.userIds ?? body.userId)]);
  const assigned = normalizeProposalRecord({
    ...existing,
    visibility: assignedTo.length ? "SHARED" : existing.visibility,
    authority,
    assignedTo,
    assignedCustomerUsers: unique([...asArray(existing.assignedCustomerUsers), ...customerUsers]),
    proposalRecipientContactIds,
    customerReviewContactIds,
    approvalAuthorityContactIds,
    sofRecipientContactIds,
    customerContactEmails,
  }, user, existing);
  jsonResponse(res, 200, { proposal: await saveProposal(assigned, user, "runtime.proposal.assigned", "Proposal assignment and authority updated.") });
}

async function handleSubmitCustomer(req, res, id, user) {
  const existing = await readProposal(id).catch(() => null);
  if (!existing) {
    errorResponse(res, 404, `Proposal not found: ${id}`);
    return;
  }
  if (!canGovernProposal(existing, user)) {
    errorResponse(res, 403, "Only the commercial owner or approver can submit this proposal for customer review.");
    return;
  }
  if (existing.proposalRevisionId && (
    existing.revisionStatus !== "SAVED" ||
    !asArray(existing.proposalRevisions).some((revision) =>
      revision?.proposalRevisionId === existing.proposalRevisionId && revision?.proposalHash === existing.proposalHash
    )
  )) {
    errorResponse(res, 409, "Save the active Proposal Revision before submitting it to the customer.");
    return;
  }
  const body = await readRequestJson(req);
  if (!exactCommercialApproval(existing)) {
    errorResponse(res, 409, "CUSTOMER SUBMISSION BLOCKED: exact Internal Commercial Review approval is required for the selected saved Proposal Revision.");
    return;
  }
  const lineageFailures = submissionLineageFailures(existing, body);
  if (lineageFailures.length) {
    errorResponse(res, 409, `CUSTOMER SUBMISSION BLOCKED: ${lineageFailures.join(" ")}`);
    return;
  }
  const opportunityFailures = await validateOpportunityStateBinding(existing, { requireCurrent: true });
  if (opportunityFailures.length) {
    errorResponse(res, 409, `CUSTOMER SUBMISSION BLOCKED: ${opportunityFailures.join(" ")}`);
    return;
  }
  const explicitCustomerUsers = normalizeUserIds(body.assignedCustomerUsers ?? body.customerUsers ?? body.customerReviewers);
  const customerUsers = unique([...asArray(existing.assignedCustomerUsers), ...explicitCustomerUsers, ...defaultCustomerUserIds(existing.customerId)]);
  const proposalRecipientContactIds = unique([...asArray(existing.proposalRecipientContactIds), ...asArray(body.proposalRecipientContactIds)]);
  const customerReviewContactIds = unique([...asArray(existing.customerReviewContactIds), ...asArray(body.customerReviewContactIds)]);
  const approvalAuthorityContactIds = unique([...asArray(existing.approvalAuthorityContactIds), ...asArray(body.approvalAuthorityContactIds)]);
  const sofRecipientContactIds = unique([...asArray(existing.sofRecipientContactIds), ...asArray(body.sofRecipientContactIds)]);
  const customerContactEmails = unique([...asArray(existing.customerContactEmails), ...asArray(body.customerContactEmails)]);
  if (!customerUsers.length) {
    errorResponse(res, 400, "At least one customer reviewer is required.");
    return;
  }
  const submitted = normalizeProposalRecord({
    ...existing,
    customerOrganizationId: body.customerOrganizationId ?? existing.customerOrganizationId,
    status: PROPOSAL_REPOSITORY_WAITING_CUSTOMER_REVIEW_STATUS,
    approvalState: "CUSTOMER_REVIEW",
    visibility: "SHARED",
    assignedCustomerUsers: customerUsers,
    proposalRecipientContactIds,
    customerReviewContactIds,
    approvalAuthorityContactIds,
    sofRecipientContactIds,
    customerContactEmails,
    assignedTo: unique([...asArray(existing.assignedTo), ...customerUsers]),
    submittedAt: nowIso(),
    notifications: [
      ...asArray(existing.notifications),
      ...customerUsers.map((userId) => ({
        notificationId: createId("proposal-notification"),
        userId,
        type: "PROPOSAL_CUSTOMER_REVIEW",
        message: `${existing.title ?? existing.proposalId} is ready for customer review.`,
        createdAt: nowIso(),
        read: false,
      })),
    ],
  }, user, existing, { assignDefaultCustomerUser: true });
  let customerPortal = null;
  if (user.authorityClass === "DEMO") {
    customerPortal = await createCustomerReviewAuthority(submitted, {
      ...body,
      recipientPrincipalIds: explicitCustomerUsers.length ? explicitCustomerUsers : customerUsers,
    }, user);
  }
  const saved = await saveProposal(submitted, user, "runtime.proposal.submitted.customer", "Exact Proposal Revision submitted to the bounded Customer Portal.", {
    assignedCustomerUsers: customerUsers,
    customerReviewPackageId: customerPortal?.reviewPackage?.customerReviewPackageId,
  });
  const opportunity = await loadRecord(DIRS.commercialOpportunities, saved.opportunityId).catch(() => null);
  let savedOpportunity = null;
  if (opportunity?.commercialWorkingState?.schemaVersion === "CIP-067") {
    savedOpportunity = await saveOpportunity(normalizeCommercialOpportunity({
      ...opportunity,
      state: "CUSTOMER_REVIEW",
      proposalId: saved.proposalId,
      proposalRevisionId: saved.proposalRevisionId,
      proposalHash: saved.proposalHash,
      commercialWorkingState: {
        ...opportunity.commercialWorkingState,
        currentLifecycleState: "CUSTOMER_REVIEW",
        proposalReferences: {
          proposalId: saved.proposalId,
          proposalRevisionId: saved.proposalRevisionId,
          proposalHash: saved.proposalHash,
        },
        lastGovernedRevisionState: "SUBMITTED_TO_CUSTOMER",
      },
    }, user, opportunity), user, "runtime.opportunity.submitted.customer", "Opportunity advanced to Customer Review through its exact saved Proposal Revision.");
  }
  jsonResponse(res, 200, { proposal: saved, opportunity: savedOpportunity, customerReviewPackage: customerPortal?.reviewPackage, invitations: customerPortal?.invitations ?? [] });
}

async function handleInternalCommercialApproval(req, res, id, user) {
  const existing = await readProposal(id).catch(() => null);
  if (!existing) {
    errorResponse(res, 404, `Proposal not found: ${id}`);
    return;
  }
  if (!canGovernProposal(existing, user)) {
    errorResponse(res, 403, "Only the Commercial owner or approver may complete Internal Commercial Review.");
    return;
  }
  if (!existing.proposalRevisionId || !existing.proposalHash || existing.revisionStatus !== "SAVED" ||
    !asArray(existing.proposalRevisions).some((revision) =>
      revision?.proposalRevisionId === existing.proposalRevisionId && revision?.proposalHash === existing.proposalHash && revision?.revisionStatus === "SAVED"
    )) {
    errorResponse(res, 409, "Internal Commercial Review must bind to an exact immutable saved Proposal Revision ID/hash.");
    return;
  }
  const body = await readRequestJson(req);
  const lineageFailures = submissionLineageFailures(existing, body);
  const opportunityFailures = await validateOpportunityStateBinding(existing, { requireCurrent: true });
  if (lineageFailures.length || opportunityFailures.length) {
    errorResponse(res, 409, `INTERNAL COMMERCIAL REVIEW BLOCKED: ${[...lineageFailures, ...opportunityFailures].join(" ")}`);
    return;
  }
  if (exactCommercialApproval(existing)) {
    jsonResponse(res, 200, { proposal: normalizeProposalRecord(existing, user, existing), idempotentReplay: true });
    return;
  }
  const timestamp = nowIso();
  const approval = {
    internalCommercialApprovalId: `INTERNAL-COMMERCIAL-APPROVAL-${safeIdPart(existing.proposalRevisionId)}`,
    status: "APPROVED",
    accountId: existing.accountId,
    opportunityId: existing.opportunityId,
    opportunityStateVersion: Number(existing.opportunityStateVersion),
    opportunityStateHash: existing.opportunityStateHash,
    proposalId: existing.proposalId,
    proposalRevisionId: existing.proposalRevisionId,
    proposalHash: existing.proposalHash,
    routeRepositoryId: existing.routeRepositoryId,
    routeRevision: Number(existing.routeRevision),
    routeGeometryId: existing.routeGeometryId,
    geometryHash: existing.routeGeometryHash,
    approvedBy: user.name,
    approvedById: user.userId,
    approvedByPrincipalId: user.principalId ?? user.userId,
    approvedByMembershipId: user.membershipId,
    approvedBySessionId: user.sessionId,
    authorityClass: user.authorityClass,
    demoPersona: user.demoPersona,
    comment: firstText(body.comment),
    approvedAt: timestamp,
  };
  const approved = normalizeProposalRecord({ ...existing, internalCommercialApproval: approval }, user, existing);
  jsonResponse(res, 200, {
    proposal: await saveProposal(approved, user, "runtime.proposal.internal_commercial.approved", "Internal Commercial Review approved the exact saved Proposal Revision.", { internalCommercialApprovalId: approval.internalCommercialApprovalId }),
  });
}

async function handleWithdraw(res, id, user) {
  const existing = await readProposal(id).catch(() => null);
  if (!existing) {
    errorResponse(res, 404, `Proposal not found: ${id}`);
    return;
  }
  if (!canGovernProposal(existing, user)) {
    errorResponse(res, 403, "Only the commercial owner or approver can withdraw this proposal.");
    return;
  }
  const withdrawn = normalizeProposalRecord({ ...existing, status: "WITHDRAWN", approvalState: "WITHDRAWN" }, user, existing);
  jsonResponse(res, 200, { proposal: await saveProposal(withdrawn, user, "runtime.proposal.withdrawn", "Proposal withdrawn from active review.") });
}

async function handleArchive(res, id, user) {
  const existing = await readProposal(id).catch(() => null);
  if (!existing) {
    errorResponse(res, 404, `Proposal not found: ${id}`);
    return;
  }
  if (!canGovernProposal(existing, user)) {
    errorResponse(res, 403, "Only the commercial owner or approver can archive this proposal.");
    return;
  }
  const archived = normalizeProposalRecord({ ...existing, status: "ARCHIVED", lifecycleState: "ARCHIVED", archivedAt: nowIso() }, user, existing);
  jsonResponse(res, 200, { proposal: await saveProposal(archived, user, "runtime.proposal.archived", "Proposal archived by governing authority.") });
}

async function handleDuplicate(res, id, user) {
  if (!userHasPermission(user, "proposal.manage")) {
    errorResponse(res, 403, "You do not have authority to duplicate proposals.");
    return;
  }
  const existing = await readProposal(id).catch(() => null);
  if (!existing) {
    errorResponse(res, 404, `Proposal not found: ${id}`);
    return;
  }
  const source = normalizeProposalRecord(existing, user, existing);
  if (!canReadProposal(source, user)) {
    errorResponse(res, 403, "You do not have authority to duplicate this proposal.");
    return;
  }
  const cloneId = `PROPOSAL-${source.customerId}-${Date.now()}`;
  const clone = normalizeProposalRecord({
    ...source,
    proposalId: cloneId,
    proposalRecordId: cloneId,
    proposalNumber: undefined,
    runtimeObjectId: `RUNTIME-PROPOSAL-${cloneId}`,
    title: `${source.title} Copy`,
    status: PROPOSAL_REPOSITORY_DRAFT_STATUS,
    approvalState: "NOT_SUBMITTED",
    visibility: "PRIVATE",
    authority: { owner: user.userId, contributors: [], reviewers: [], approvers: [], executives: [], customerReviewers: [], salesEngineering: [] },
    assignedTo: [],
    assignedCustomerUsers: [],
    comments: [],
    approvals: [],
    history: [],
    historyIds: [],
    version: 1,
    versions: [],
    relationshipLinks: unique([...asArray(source.relationshipLinks), `DERIVED_FROM:${source.proposalId}`]),
  }, user, null);
  jsonResponse(res, 201, { proposal: await saveProposal(clone, user, "runtime.proposal.duplicated", `Proposal duplicated from ${source.proposalId}.`) });
}

async function handleRevision(req, res, id, user) {
  const existing = await readProposal(id).catch(() => null);
  if (!existing) {
    errorResponse(res, 404, `Proposal not found: ${id}`);
    return;
  }
  if (!canWriteProposal(existing, user)) {
    errorResponse(res, 403, "Only commercial authority can create proposal revisions.");
    return;
  }
  const body = await readRequestJson(req);
  const updates = unwrapBody(body, "proposal", ["updates"]) ?? {};
  const revisionReason = String(body.reason ?? updates.reason ?? "Commercial revision created.");
  const savedRevisions = asArray(existing.proposalRevisions);
  const requestedBasisId = String(body.basisProposalRevisionId ?? updates.basisProposalRevisionId ?? existing.proposalRevisionId ?? "");
  const basisRevision = savedRevisions.find((revision) => revision?.proposalRevisionId === requestedBasisId)
    ?? savedRevisions.at(-1)
    ?? null;
  const basisSnapshot = asRecord(basisRevision?.snapshot);
  const nextVersion = Math.max(
    Number(existing.version ?? 1),
    ...savedRevisions.map((revision) => Number(revision?.revisionNumber ?? 0)),
  ) + 1;
  const nextProposalRevisionId = `${existing.proposalId}-revision-${nextVersion}`;
  const revised = normalizeProposalRecord({
    ...existing,
    ...basisSnapshot,
    ...updates,
    version: nextVersion,
    status: "COMMERCIAL_REVISION",
    approvalState: "REVISION_IN_PROGRESS",
    approvedAt: undefined,
    proposalRevisionId: nextProposalRevisionId,
    parentProposalRevisionId: basisRevision?.proposalRevisionId ?? existing.proposalRevisionId ?? "",
    derivedFromProposalHash: basisRevision?.proposalHash ?? existing.proposalHash ?? "",
    proposalHash: "",
    revisionNumber: nextVersion,
    revisionReason,
    revisionStatus: "WORKING",
    proposalRevisions: savedRevisions,
    approvals: asArray(existing.approvals),
    versions: [
      ...asArray(existing.versions),
      normalizeVersionEntry({ ...existing, ...updates, proposalId: existing.proposalId, version: nextVersion }, user, revisionReason, body.changes ?? updates.changes ?? {}),
    ],
  }, user, existing);
  jsonResponse(res, 200, { proposal: await saveProposal(revised, user, "runtime.proposal.revision.created", revisionReason, {
    version: nextVersion,
    proposalRevisionId: nextProposalRevisionId,
    parentProposalRevisionId: revised.parentProposalRevisionId,
    derivedFromProposalHash: revised.derivedFromProposalHash,
    approvalTransferred: false,
  }) });
}

async function handleComment(req, res, id, user) {
  const existing = await readProposal(id).catch(() => null);
  if (!existing) {
    errorResponse(res, 404, `Proposal not found: ${id}`);
    return;
  }
  const record = normalizeProposalRecord(existing, user, existing);
  if (!canReadProposal(record, user)) {
    errorResponse(res, 403, "You do not have authority to comment on this proposal.");
    return;
  }
  if (isCustomerUser(user) && !canCustomerReviewProposal(record, user)) {
    errorResponse(res, 403, "You do not have customer review authority for this proposal.");
    return;
  }
  const body = await readRequestJson(req);
  const text = String(body.comment ?? body.text ?? "").trim();
  if (!text) {
    errorResponse(res, 400, "Comment text is required.");
    return;
  }
  const timestamp = nowIso();
  const comment = {
    commentId: createId("proposal-comment"),
    authorId: user.userId,
    author: user.name,
    authorRole: user.role,
    customerId: isCustomerUser(user) ? user.customerId : undefined,
    text,
    createdAt: timestamp,
    updatedAt: timestamp,
    visibility: body.visibility ?? "SHARED",
    resolved: false,
  };
  const commented = normalizeProposalRecord({
    ...record,
    comments: [...asArray(record.comments), comment],
    status: isCustomerUser(user) && record.status === PROPOSAL_REPOSITORY_WAITING_CUSTOMER_REVIEW_STATUS ? PROPOSAL_REPOSITORY_CUSTOMER_REVIEW_STATUS : record.status,
    approvalState: isCustomerUser(user) ? "COMMENTED" : record.approvalState,
  }, user, record);
  jsonResponse(res, 200, { proposal: await saveProposal(commented, user, "runtime.proposal.comment.created", "Proposal collaboration comment recorded as Runtime History.", { commentId: comment.commentId }) });
}

async function handleUploadEvidence(req, res, id, user) {
  const existing = await readProposal(id).catch(() => null);
  if (!existing) {
    errorResponse(res, 404, `Proposal not found: ${id}`);
    return;
  }
  const record = normalizeProposalRecord(existing, user, existing);
  if (!canReadProposal(record, user)) {
    errorResponse(res, 403, "You do not have authority to attach evidence to this proposal.");
    return;
  }
  if (isCustomerUser(user) && !canCustomerReviewProposal(record, user)) {
    errorResponse(res, 403, "You do not have customer review authority for this proposal.");
    return;
  }
  const body = await readRequestJson(req);
  const timestamp = nowIso();
  const sourceName = String(body.sourceName ?? body.fileName ?? body.name ?? "Customer proposal evidence");
  const evidenceId = String(body.evidenceId ?? createId("proposal-evidence"));
  const evidence = {
    evidenceId,
    sourceType: body.sourceType ?? (isCustomerUser(user) ? "CUSTOMER_UPLOAD" : "PROPOSAL_ATTACHMENT"),
    sourceName,
    sourceSystem: "Proposal Collaboration",
    authority: isCustomerUser(user) ? "CUSTOMER_EVIDENCE" : "COMMERCIAL_REVIEW",
    validationStatus: body.validationStatus ?? "PENDING",
    collectedAt: body.collectedAt ?? timestamp,
    ingestedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
    lineage: {
      proposalId: record.proposalId,
      customerId: record.customerId,
      uploadedBy: user.userId,
    },
    metadata: {
      ...(body.metadata ?? {}),
      proposalVersion: record.version,
      noScopeVersionCreation: true,
      noInventoryMutation: true,
    },
  };
  await persistRecord(DIRS.runtimeEvidence, evidenceId, evidence);
  const attachment = {
    attachmentId: createId("proposal-attachment"),
    evidenceId,
    sourceName,
    uploadedById: user.userId,
    uploadedBy: user.name,
    uploadedAt: timestamp,
    metadata: body.metadata ?? {},
  };
  const withEvidence = normalizeProposalRecord({
    ...record,
    runtimeEvidenceIds: unique([...asArray(record.runtimeEvidenceIds), evidenceId]),
    attachments: [...asArray(record.attachments), attachment],
  }, user, record);
  jsonResponse(res, 200, { proposal: await saveProposal(withEvidence, user, "runtime.proposal.evidence.uploaded", "Proposal evidence uploaded and registered in the Runtime Evidence Registry.", { evidenceId, attachmentId: attachment.attachmentId }), evidence });
}

export async function handleRequestChanges(req, res, id, user) {
  const existing = await readProposal(id).catch(() => null);
  if (!existing) {
    errorResponse(res, 404, `Proposal not found: ${id}`);
    return;
  }
  const record = normalizeProposalRecord(existing, user, existing);
  if (!canCustomerReviewProposal(record, user)) {
    errorResponse(res, 403, "Only an assigned customer reviewer can request proposal changes.");
    return;
  }
  const body = req.customerPortalBody ?? await readRequestJson(req);
  const text = String(body.comment ?? body.reason ?? body.text ?? "Customer requested proposal changes.").trim();
  const timestamp = nowIso();
  const comment = {
    commentId: createId("proposal-comment"),
    authorId: user.userId,
    author: user.name,
    authorRole: user.role,
    customerId: user.customerId,
    text,
    createdAt: timestamp,
    updatedAt: timestamp,
    visibility: "SHARED",
    resolved: false,
    action: "REQUEST_CHANGES",
  };
  const requested = normalizeProposalRecord({
    ...record,
    comments: [...asArray(record.comments), comment],
    status: "CUSTOMER_CHANGES_REQUESTED",
    approvalState: "CHANGES_REQUESTED",
  }, user, record);
  jsonResponse(res, 200, { proposal: await saveProposal(requested, user, "runtime.proposal.customer.requested_changes", "Customer requested proposal changes.", { commentId: comment.commentId }) });
}

export async function handleApprove(req, res, id, user) {
  const existing = await readProposal(id).catch(() => null);
  if (!existing) {
    const trace = buildProposalApprovalDecisionTrace({
      proposalId: id,
      repositoryRecord: null,
      normalizedRecord: null,
      user,
    });
    proposalApprovalDenied(res, trace, 404);
    return;
  }
  const record = normalizeProposalRecord(existing, user, existing);
  if (record.proposalRevisionId && (
    record.revisionStatus !== "SAVED" ||
    !asArray(record.proposalRevisions).some((revision) =>
      revision?.proposalRevisionId === record.proposalRevisionId && revision?.proposalHash === record.proposalHash
    )
  )) {
    errorResponse(res, 409, "Customer approval can only attach to an exact saved Proposal Revision and proposal hash.");
    return;
  }
  const decisionTrace = buildProposalApprovalDecisionTrace({
    proposalId: id,
    repositoryRecord: existing,
    normalizedRecord: record,
    user,
  });
  if (decisionTrace.decision === "DENY") {
    proposalApprovalDenied(res, decisionTrace, 403);
    return;
  }
  logProposalApprovalDecisionTrace(decisionTrace);
  const body = req.customerPortalBody ?? await readRequestJson(req);
  const timestamp = nowIso();
  const approval = {
    approvalId: createId("proposal-approval"),
    approverId: user.userId,
    approver: user.name,
    customerId: user.customerId,
    decision: "APPROVED",
    proposalRevisionId: record.proposalRevisionId ?? `${record.proposalId}-legacy-v${record.version}`,
    proposalHash: record.proposalHash ?? "LEGACY-PROPOSAL-HASH-NOT-AVAILABLE",
    revisionNumber: record.revisionNumber ?? record.version,
    comment: body.comment ?? "",
    createdAt: timestamp,
  };
  const approved = normalizeProposalRecord({
    ...record,
    approvals: [
      ...asArray(record.approvals).map((priorApproval) => priorApproval?.decision === "APPROVED" &&
        priorApproval?.proposalRevisionId &&
        priorApproval.proposalRevisionId !== approval.proposalRevisionId &&
        !priorApproval.supersededByRevisionId
        ? { ...priorApproval, supersededByRevisionId: approval.proposalRevisionId }
        : priorApproval),
      approval,
    ],
    status: PROPOSAL_REPOSITORY_APPROVED_STATUS,
    approvalState: "APPROVED",
    approvedAt: timestamp,
    visibility: "SHARED",
  }, user, record);
  const saved = await saveProposal(approved, user, "runtime.proposal.customer.approved", "Customer approved the commercial proposal. Draft IOF readiness may now be evaluated.", { approvalId: approval.approvalId });
  const lifecycleApproval = runtimeHistoryEvent(saved, user, "CUSTOMER_APPROVED", "Customer approval advanced the Runtime lifecycle bridge.", { approvalId: approval.approvalId });
  await persistRecord(DIRS.runtimeHistory, lifecycleApproval.historyId, lifecycleApproval);
  let draftPackage = null;
  let draftIofAssemblyError = "";
  let draftIofAssemblyPredicate = "";
  try {
    draftPackage = await loadCommercialDraftIofPackageForProposal(saved.proposalId);
    if (!draftPackage) {
      const assembly = await assembleDraftIofPackageFromProposal({ proposalId: saved.proposalId }, user, { idempotent: true });
      draftPackage = assembly.draftPackage ?? assembly.iofPackage ?? null;
    }
    if (draftPackage) draftPackage = await enrichDraftPackageWithProposalAuthorityReferences(draftPackage, saved, user);
    if (!draftPackage) draftIofAssemblyError = "Draft IOF Package has not been assembled for this Proposal.";
  } catch (error) {
    draftIofAssemblyError = error instanceof Error ? error.message : String(error);
    draftIofAssemblyPredicate = String(error?.code ?? "");
  }
  const workspaceSession = await updateRuntimeWorkspaceSession({
    accountId: saved.accountId,
    customerId: saved.customerId,
    sessionUserId: saved.commercialOwnerId ?? saved.ownerId,
    sessionUserName: saved.commercialOwner ?? saved.owner,
    workspaceId: saved.workspaceId,
    organizationId: saved.organizationId,
    opportunityId: saved.opportunityId,
    productId: saved.productId,
    fulfillmentPlanId: saved.fulfillmentPlanId,
    proposalId: saved.proposalId,
    packageId: draftPackage?.packageId,
    currentRuntimeObject: draftPackage?.packageId ?? saved.runtimeObjectId,
    currentAuthority: draftPackage ? "ENGINEERING_REVIEW" : "CUSTOMER_REVIEW",
    currentLifecycleStage: draftPackage ? "ENGINEERING_REVIEW_QUEUED" : "CUSTOMER_APPROVED",
    selectedRoute: asArray(saved.geometryReferences)[0],
    selectedGraph: asArray(saved.runtimeObjectIds)[0],
    selectedPackage: draftPackage?.packageId,
    selectedProposalRevision: saved.version,
    sessionState: "ACTIVE",
    lastActivity: "CUSTOMER_APPROVED",
  }, user, "AUTHORITY_TRANSFER_CUSTOMER_TO_ENGINEERING", "Customer approval persisted WorkspaceSession authority transfer.");
  jsonResponse(res, 200, { proposal: saved, draftPackage, iofPackage: draftPackage, draftIofAssemblyError, draftIofAssemblyPredicate, workspaceSession });
}

export async function handleReject(req, res, id, user) {
  const existing = await readProposal(id).catch(() => null);
  if (!existing) {
    errorResponse(res, 404, `Proposal not found: ${id}`);
    return;
  }
  const record = normalizeProposalRecord(existing, user, existing);
  if (!canCustomerReviewProposal(record, user)) {
    errorResponse(res, 403, "Only an assigned customer reviewer can reject this proposal.");
    return;
  }
  const body = req.customerPortalBody ?? await readRequestJson(req);
  const timestamp = nowIso();
  const rejection = {
    approvalId: createId("proposal-approval"),
    approverId: user.userId,
    approver: user.name,
    customerId: user.customerId,
    decision: "REJECTED",
    comment: body.comment ?? body.reason ?? "",
    createdAt: timestamp,
  };
  const rejected = normalizeProposalRecord({
    ...record,
    approvals: [...asArray(record.approvals), rejection],
    status: "CUSTOMER_REJECTED",
    approvalState: "REJECTED",
  }, user, record);
  jsonResponse(res, 200, { proposal: await saveProposal(rejected, user, "runtime.proposal.customer.rejected", "Customer rejected the commercial proposal.", { approvalId: rejection.approvalId }) });
}

async function handleReadiness(res, id, user) {
  const existing = await readProposal(id).catch(() => null);
  if (!existing) {
    errorResponse(res, 404, `Proposal not found: ${id}`);
    return;
  }
  const record = normalizeProposalRecord(existing, user, existing);
  if (!canReadProposal(record, user)) {
    errorResponse(res, 403, "You do not have authority to inspect this proposal readiness.");
    return;
  }
  jsonResponse(res, 200, { readiness: computeProposalReadiness(record), proposal: record });
}

async function handleCreateDraftIofPackage(res, id, user) {
  const existing = await readProposal(id).catch(() => null);
  if (!existing) {
    errorResponse(res, 404, `Proposal not found: ${id}`);
    return;
  }
  const record = normalizeProposalRecord(existing, user, existing);
  if (!canWriteProposal(record, user)) {
    errorResponse(res, 403, "Only commercial authority can expose Draft IOF package source references.");
    return;
  }
  const readiness = computeProposalReadiness(record);
  if (!readiness.canCreateDraftIofPackage) {
    errorResponse(res, 409, "Proposal is not ready for Draft IOF package creation.");
    return;
  }
  const commercialRevision = await ensureCommercialRevisionForProposal(record, user, {
    timestamp: nowIso(),
  });
  const source = {
    sourceType: "COMMERCIAL_REVISION",
    previousSourceType: "APPROVED_PROPOSAL_RUNTIME_OBJECT",
    commercialRevisionId: commercialRevision.commercialRevisionId,
    revisionId: commercialRevision.revisionId,
    commercialRevisionHash: commercialRevision.revisionHash,
    commercialRepositoryId: commercialRevision.repositoryId,
    changeSetIds: commercialRevision.changeSetIds ?? [],
    activeChangeSetIds: commercialRevision.activeChangeSetIds ?? commercialRevision.changeSetIds ?? [],
    patchCount: commercialRevision.patchCount ?? 0,
    activePatchCount: commercialRevision.activePatchCount ?? 0,
    appliedPatchCount: commercialRevision.appliedPatchCount ?? 0,
    repositoryHash: commercialRevision.repositoryHash,
    projectionHash: commercialRevision.projectionHash,
    patchReplayTimeMs: commercialRevision.patchReplayTimeMs ?? 0,
    projectionTimeMs: commercialRevision.projectionTimeMs ?? 0,
    proposalConsumesCommercialRevision: true,
    proposalId: record.proposalId,
    proposalNumber: record.proposalNumber,
    proposalRevisionId: record.proposalRevisionId,
    proposalHash: record.proposalHash,
    proposalRevisionNumber: record.revisionNumber,
    customerId: record.customerId,
    opportunityId: record.opportunityId,
    version: record.version,
    runtimeObjectId: record.runtimeObjectId,
    runtimeObjectIds: record.runtimeObjectIds,
    runtimeRelationshipIds: record.runtimeRelationshipIds,
    runtimeEvidenceIds: record.runtimeEvidenceIds,
    existingInventoryReferences: record.existingInventoryReferences,
    customerDesignReferences: record.customerDesignReferences,
    customerTwinReference: record.customerTwinReference,
    geometryReferences: record.geometryReferences,
    proposalDocumentReferences: record.proposalDocumentReferences,
    noIofPackageCreated: true,
    sprint13_3AssemblyRequired: true,
    noScopeVersionCreation: true,
  };
  const exposed = normalizeProposalRecord({
    ...record,
    status: PROPOSAL_REPOSITORY_APPROVED_STATUS,
    commercialRevisionId: commercialRevision.commercialRevisionId,
    revisionId: commercialRevision.revisionId,
    commercialRevisionHash: commercialRevision.revisionHash,
    commercialRepositoryId: commercialRevision.repositoryId,
    changeSetIds: commercialRevision.changeSetIds ?? [],
    activeChangeSetIds: commercialRevision.activeChangeSetIds ?? commercialRevision.changeSetIds ?? [],
    patchCount: commercialRevision.patchCount ?? 0,
    activePatchCount: commercialRevision.activePatchCount ?? 0,
    appliedPatchCount: commercialRevision.appliedPatchCount ?? 0,
    repositoryHash: commercialRevision.repositoryHash,
    projectionHash: commercialRevision.projectionHash,
    patchReplayTimeMs: commercialRevision.patchReplayTimeMs ?? 0,
    projectionTimeMs: commercialRevision.projectionTimeMs ?? 0,
    currentAuthority: "COMMERCIAL_REVISION",
    proposalAuthorityFlow: {
      inputAuthority: "COMMERCIAL_REVISION",
      projection: "PROPOSAL_PROJECTION",
      repository: "PROPOSAL_REPOSITORY",
      commercialRevisionId: commercialRevision.commercialRevisionId,
      revisionHash: commercialRevision.revisionHash,
      changeSetIds: commercialRevision.changeSetIds ?? [],
      patchCount: commercialRevision.patchCount ?? 0,
      commercialRevisionProjection: "COMMERCIAL_REVISION_PROJECTION",
      proposalOutputUnchanged: true,
      pricingOutputUnchanged: true,
      workbookOutputUnchanged: true,
      noScopeVersionCreation: true,
    },
    commercialAuthorityDiagnostics: commercialAuthorityDiagnosticsFrom({
      revision: commercialRevision,
      proposal: record,
    }),
    draftIofPackageSource: source,
  }, user, record);
  const saved = await saveProposal(exposed, user, "runtime.proposal.draft_iof.source_exposed", "Approved Proposal references exposed for Sprint 13.3 Draft IOF package assembly. No IOF package was created.", { source });
  jsonResponse(res, 200, { ready: true, readiness: saved.readiness, draftIofPackageSource: source, proposal: saved });
}

export async function handleProposalDrafts(req, res, pathname) {
  const match = routeMatch(pathname, "/api/proposals");
  if (!match) return false;
  if (handleOptions(req, res)) return true;

  const user = requireUser(req, res);
  if (!user) return true;

  if (match.base && req.method === "GET") {
    await handleList(req, res, user);
    return true;
  }

  if (match.base && req.method === "POST") {
    await handleSave(req, res, user);
    return true;
  }

  if (!match.base && req.method === "GET" && match.action === "readiness") {
    await handleReadiness(res, match.id, user);
    return true;
  }

  if (!match.base && req.method === "GET" && !match.action) {
    await handleGet(res, match.id, user);
    return true;
  }

  if (!match.base && (req.method === "PUT" || req.method === "POST") && !match.action) {
    await handleSave(req, res, user, match.id);
    return true;
  }

  if (!match.base && req.method === "POST" && match.action === "open") {
    await handleOpen(res, match.id, user);
    return true;
  }

  if (!match.base && req.method === "POST" && match.action === "assign") {
    await handleAssign(req, res, match.id, user);
    return true;
  }

  if (!match.base && req.method === "POST" && match.action === "submit-customer") {
    await handleSubmitCustomer(req, res, match.id, user);
    return true;
  }

  if (!match.base && req.method === "POST" && match.action === "internal-commercial-approve") {
    await handleInternalCommercialApproval(req, res, match.id, user);
    return true;
  }

  if (!match.base && req.method === "POST" && match.action === "withdraw") {
    await handleWithdraw(res, match.id, user);
    return true;
  }

  if (!match.base && req.method === "POST" && match.action === "archive") {
    await handleArchive(res, match.id, user);
    return true;
  }

  if (!match.base && req.method === "POST" && match.action === "duplicate") {
    await handleDuplicate(res, match.id, user);
    return true;
  }

  if (!match.base && req.method === "POST" && match.action === "revision") {
    await handleRevision(req, res, match.id, user);
    return true;
  }

  if (!match.base && req.method === "POST" && match.action === "comment") {
    await handleComment(req, res, match.id, user);
    return true;
  }

  if (!match.base && req.method === "POST" && match.action === "upload-evidence") {
    await handleUploadEvidence(req, res, match.id, user);
    return true;
  }

  if (!match.base && req.method === "POST" && match.action === "request-changes") {
    await handleRequestChanges(req, res, match.id, user);
    return true;
  }

  if (!match.base && req.method === "POST" && match.action === "approve") {
    await handleApprove(req, res, match.id, user);
    return true;
  }

  if (!match.base && req.method === "POST" && match.action === "reject") {
    await handleReject(req, res, match.id, user);
    return true;
  }

  if (!match.base && req.method === "POST" && match.action === "create-draft-iof-package") {
    await handleCreateDraftIofPackage(res, match.id, user);
    return true;
  }

  errorResponse(res, 405, "Proposal Runtime Library method not allowed.");
  return true;
}
