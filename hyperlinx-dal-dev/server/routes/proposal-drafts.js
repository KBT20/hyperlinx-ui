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
  unwrapBody,
} from "./_shared.js";
import { findAlphaUserById, userFromBearerToken, userHasPermission } from "./auth.js";
import { loadCommercialDraftIofPackageForProposal } from "./commercial-iof-packages.js";
import { updateRuntimeWorkspaceSession } from "./runtime-workspace-session.js";

const ROLE_KEYS = ["contributors", "reviewers", "approvers", "executives", "customerReviewers", "salesEngineering"];
const CUSTOMER_USER_BY_CUSTOMER = {
  google: "google-participant-001",
  "customer-google": "google-participant-001",
};

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === "") return [];
  return [value];
}

function unique(values) {
  return [...new Set(values.filter(Boolean).map(String))];
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

function lifecycleForStatus(status) {
  if (status === "ARCHIVED") return "ARCHIVED";
  if (["CUSTOMER_APPROVED", "READY_FOR_IOF_PACKAGE", "CERTIFIED_IOF_PACKAGE"].includes(status)) return "APPROVED";
  if (["CUSTOMER_REJECTED", "WITHDRAWN"].includes(status)) return "RETIRED";
  if (["INTERNAL_COMMERCIAL_REVIEW", "WAITING_CUSTOMER_REVIEW", "CUSTOMER_COMMENTS", "CUSTOMER_CHANGES_REQUESTED", "COMMERCIAL_REVISION", "SALES_ENGINEERING_REVIEW"].includes(status)) return "IN_REVIEW";
  return "DRAFT";
}

function nextLifecycleActionFor(record, readiness = null) {
  const status = record.status;
  if (status === "COMMERCIAL_DRAFT" || status === "COMMERCIAL_REVISION") return "SUBMIT_TO_INTERNAL_COMMERCIAL_REVIEW";
  if (status === "INTERNAL_COMMERCIAL_REVIEW") return "SUBMIT_TO_CUSTOMER_REVIEW";
  if (status === "WAITING_CUSTOMER_REVIEW" || status === "CUSTOMER_COMMENTS") return "CUSTOMER_REVIEW_DECISION";
  if (status === "CUSTOMER_CHANGES_REQUESTED") return "CREATE_COMMERCIAL_REVISION";
  if (status === "CUSTOMER_APPROVED" || status === "READY_FOR_IOF_PACKAGE") {
    return readiness?.canCreateDraftIofPackage ? "CREATE_DRAFT_IOF_PACKAGE" : "RESOLVE_PROPOSAL_READINESS";
  }
  if (status === "SALES_ENGINEERING_REVIEW") return "SALES_ENGINEERING_REVIEW";
  if (status === "CERTIFIED_IOF_PACKAGE") return "CREATE_SCOPEVERSION";
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

  const customerApproved = record.approvalState === "APPROVED" || ["CUSTOMER_APPROVED", "READY_FOR_IOF_PACKAGE", "SALES_ENGINEERING_REVIEW", "CERTIFIED_IOF_PACKAGE"].includes(record.status);
  const proposalComplete = missingInformation.length === 0;
  const runtimeValid = (runtimeObjectIds.length > 0 || geometryReferences.length > 0) &&
    (runtimeEvidenceIds.length > 0 || existingInventoryReferences.length > 0 || proposalDocumentReferences.length > 0 || record.customerTwinReference);
  if (!customerApproved) blockingIssues.push("Customer approval is required before Draft IOF package creation.");
  if (!proposalComplete) blockingIssues.push("Proposal completeness checks have unresolved fields.");
  if (!runtimeValid) blockingIssues.push("Runtime references or evidence are missing.");

  const readinessScore = [customerApproved, proposalComplete, runtimeValid].filter(Boolean).length;
  const confidence = Math.round((readinessScore / 3) * 100);
  return {
    proposalId: record.proposalId,
    status: customerApproved && proposalComplete && runtimeValid ? "READY" : "BLOCKED",
    canCreateDraftIofPackage: customerApproved && proposalComplete && runtimeValid,
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
      status: customerApproved && runtimeValid ? "READY_FOR_DRAFT_IOF" : "NOT_READY",
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
    recommendation: customerApproved && proposalComplete && runtimeValid
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
  const createdById = String(existing?.createdById ?? record.createdById ?? user.userId);
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
  const status = record.status ?? existing?.status ?? (record.acceptedProposalId ? "CUSTOMER_APPROVED" : "COMMERCIAL_DRAFT");
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
    fulfillmentPlanId: String(record.fulfillmentPlanId ?? existing?.fulfillmentPlanId ?? record.fulfillmentPlan?.fulfillmentPlanId ?? existing?.fulfillmentPlan?.fulfillmentPlanId ?? ""),
    fulfillmentStrategy: String(record.fulfillmentStrategy ?? existing?.fulfillmentStrategy ?? record.fulfillmentPlan?.fulfillmentStrategy ?? existing?.fulfillmentPlan?.fulfillmentStrategy ?? ""),
    fulfillmentPlan: record.fulfillmentPlan ?? existing?.fulfillmentPlan ?? null,
    organization: record.organization ?? existing?.organization ?? "Teralinx",
    organizationId: record.organizationId ?? existing?.organizationId ?? user.organizationId,
    workspace: record.workspace ?? existing?.workspace ?? user.workspaceId,
    workspaceId: record.workspaceId ?? existing?.workspaceId ?? user.workspaceId,
    owner: userLabel(ownerId),
    ownerId,
    commercialOwnerId,
    commercialOwner: userLabel(commercialOwnerId),
    createdBy: userLabel(createdById),
    createdById,
    assignedTo,
    assignedCustomerUsers,
    proposalRecipientContactIds: unique([...asArray(existing?.proposalRecipientContactIds), ...asArray(record.proposalRecipientContactIds)]),
    customerReviewContactIds: unique([...asArray(existing?.customerReviewContactIds), ...asArray(record.customerReviewContactIds)]),
    approvalAuthorityContactIds: unique([...asArray(existing?.approvalAuthorityContactIds), ...asArray(record.approvalAuthorityContactIds)]),
    sofRecipientContactIds: unique([...asArray(existing?.sofRecipientContactIds), ...asArray(record.sofRecipientContactIds)]),
    customerContactEmails: unique([...asArray(existing?.customerContactEmails), ...asArray(record.customerContactEmails)]),
    assignment: assignmentFromAuthority(authority),
    reviewers: unique([...asArray(record.reviewers ?? existing?.reviewers), ...authority.reviewers]),
    approvalState: record.approvalState ?? existing?.approvalState ?? (status === "CUSTOMER_APPROVED" ? "APPROVED" : "NOT_SUBMITTED"),
    visibility: record.visibility ?? existing?.visibility ?? "PRIVATE",
    authority,
    lifecycleState: record.lifecycleState ?? lifecycleForStatus(status),
    status,
    version,
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
  recordWithHistory.readiness = computeProposalReadiness(recordWithHistory);
  recordWithHistory.nextLifecycleAction = nextLifecycleActionFor(recordWithHistory, recordWithHistory.readiness);
  const saved = await persistRecord(DIRS.proposalDrafts, recordWithHistory.proposalRecordId, recordWithHistory);
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
    .map((record) => normalizeProposalRecord(record, user, record))
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
    const normalized = normalizeProposalRecord({
      ...item,
      proposalId: proposalId || item?.proposalId,
      proposalRecordId: proposalId || item?.proposalRecordId,
    }, user, existing);
    saved.push(await saveProposal(normalized, user, "runtime.proposal.saved", "Proposal saved with owner, workspace, visibility, authority, lifecycle, evidence, and relationship metadata."));
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
  const body = await readRequestJson(req);
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
    status: "WAITING_CUSTOMER_REVIEW",
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
  jsonResponse(res, 200, { proposal: await saveProposal(submitted, user, "runtime.proposal.submitted.customer", "Proposal submitted for customer review.", { assignedCustomerUsers: customerUsers }) });
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
    status: "COMMERCIAL_DRAFT",
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
  const nextVersion = Number(existing.version ?? 1) + 1;
  const revised = normalizeProposalRecord({
    ...existing,
    ...updates,
    version: nextVersion,
    status: "COMMERCIAL_REVISION",
    approvalState: "REVISION_IN_PROGRESS",
    versions: [
      ...asArray(existing.versions),
      normalizeVersionEntry({ ...existing, ...updates, proposalId: existing.proposalId, version: nextVersion }, user, revisionReason, body.changes ?? updates.changes ?? {}),
    ],
  }, user, existing);
  jsonResponse(res, 200, { proposal: await saveProposal(revised, user, "runtime.proposal.revision.created", revisionReason, { version: nextVersion }) });
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
    status: isCustomerUser(user) && record.status === "WAITING_CUSTOMER_REVIEW" ? "CUSTOMER_COMMENTS" : record.status,
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

async function handleRequestChanges(req, res, id, user) {
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
  const body = await readRequestJson(req);
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

async function handleApprove(req, res, id, user) {
  const existing = await readProposal(id).catch(() => null);
  if (!existing) {
    errorResponse(res, 404, `Proposal not found: ${id}`);
    return;
  }
  const record = normalizeProposalRecord(existing, user, existing);
  if (!canCustomerReviewProposal(record, user)) {
    errorResponse(res, 403, "Only an assigned customer reviewer can approve this proposal.");
    return;
  }
  const body = await readRequestJson(req);
  const timestamp = nowIso();
  const approval = {
    approvalId: createId("proposal-approval"),
    approverId: user.userId,
    approver: user.name,
    customerId: user.customerId,
    decision: "APPROVED",
    comment: body.comment ?? "",
    createdAt: timestamp,
  };
  const approved = normalizeProposalRecord({
    ...record,
    approvals: [...asArray(record.approvals), approval],
    status: "CUSTOMER_APPROVED",
    approvalState: "APPROVED",
    approvedAt: timestamp,
    visibility: "SHARED",
  }, user, record);
  const saved = await saveProposal(approved, user, "runtime.proposal.customer.approved", "Customer approved the commercial proposal. Draft IOF readiness may now be evaluated.", { approvalId: approval.approvalId });
  const lifecycleApproval = runtimeHistoryEvent(saved, user, "CUSTOMER_APPROVED", "Customer approval advanced the Runtime lifecycle bridge.", { approvalId: approval.approvalId });
  await persistRecord(DIRS.runtimeHistory, lifecycleApproval.historyId, lifecycleApproval);
  let draftPackage = null;
  let draftIofAssemblyError = "";
  try {
    draftPackage = await loadCommercialDraftIofPackageForProposal(saved.proposalId);
    if (!draftPackage) draftIofAssemblyError = "Commercial Draft IOF Package JSON has not been assembled for this Proposal.";
  } catch (error) {
    draftIofAssemblyError = error instanceof Error ? error.message : String(error);
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
  jsonResponse(res, 200, { proposal: saved, draftPackage, iofPackage: draftPackage, draftIofAssemblyError, workspaceSession });
}

async function handleReject(req, res, id, user) {
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
  const body = await readRequestJson(req);
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
  const source = {
    sourceType: "APPROVED_PROPOSAL_RUNTIME_OBJECT",
    proposalId: record.proposalId,
    proposalNumber: record.proposalNumber,
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
  };
  const exposed = normalizeProposalRecord({
    ...record,
    status: "READY_FOR_IOF_PACKAGE",
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
