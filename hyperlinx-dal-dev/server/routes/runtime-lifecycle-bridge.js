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
} from "./_shared.js";
import { findAlphaUserById, runtimeWorkspaceForUser, userFromBearerToken, userHasPermission } from "./auth.js";
import { normalizeCommercialOpportunity, readOpportunity, saveOpportunity } from "./commercial-opportunities.js";
import { normalizeProposalRecord, readProposal, saveProposal } from "./proposal-drafts.js";
import { ensureProductFulfillment } from "./product-fulfillment.js";
import { updateRuntimeWorkspaceSession } from "./runtime-workspace-session.js";
import { listReviewQueue } from "./engineering-certification.js";
import { loadCommercialDraftIofPackageForProposal } from "./commercial-iof-packages.js";

const BASE_PATH = "/api/runtime/lifecycle";
const LIFECYCLE_EVENTS = [
  "CUSTOMER_TWIN_READY",
  "COMMERCIAL_OPPORTUNITY_CREATED",
  "PRODUCT_SELECTED",
  "INVENTORY_RESOLVED",
  "FULFILLMENT_PLAN_CREATED",
  "COMMERCIAL_DRAFT_CREATED",
  "PROPOSAL_CREATED",
  "PROPOSAL_SUBMITTED",
  "PROPOSAL_ASSIGNED",
  "CUSTOMER_REVIEW_STARTED",
  "CUSTOMER_APPROVED",
  "DRAFT_IOF_PACKAGE_CREATED",
  "ENGINEERING_REVIEW_QUEUED",
];

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === "") return [];
  return [value];
}

function unique(values) {
  return [...new Set(asArray(values).filter(Boolean).map(String))];
}

function cleanId(value) {
  return String(value ?? "runtime").replace(/[^a-zA-Z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").toUpperCase();
}

function routeParts(pathname) {
  if (pathname === BASE_PATH || pathname === `${BASE_PATH}/`) return [];
  if (!pathname.startsWith(`${BASE_PATH}/`)) return null;
  return pathname.slice(BASE_PATH.length + 1).split("/").filter(Boolean).map(decodeURIComponent);
}

function customerIdFor(input = {}) {
  return String(input.customerId ?? input.account?.customerId ?? (input.accountId === "google" ? "customer-google" : input.accountId) ?? "customer-google");
}

function inputAccountId(input = {}) {
  const explicit = input.accountId ?? input.account?.accountId ?? input.opportunity?.accountId ?? input.proposal?.accountId;
  if (explicit) return String(explicit);
  const customerId = customerIdFor(input);
  if (customerId === "customer-google") return "google";
  return customerId.startsWith("customer-") ? customerId.slice("customer-".length) : customerId;
}

function lifecycleIdFor(input = {}) {
  const customerId = customerIdFor(input);
  const opportunityId = input.opportunityId ?? input.opportunity?.opportunityId ?? input.proposal?.opportunityId ?? "quote-ready";
  return `LIFECYCLE-${cleanId(customerId)}-${cleanId(opportunityId)}`;
}

function customerUserIds(input = {}) {
  return unique(input.assignedCustomerUsers ?? input.customerUsers ?? input.customerReviewers ?? ["google-participant-001"]);
}

function defaultEngineer(input = {}) {
  const user = findAlphaUserById(input.assignedEngineerId ?? input.engineerId ?? "teralinx-user-kyle") ?? findAlphaUserById("teralinx-user-kyle");
  return {
    assignedEngineerId: String(input.assignedEngineerId ?? input.engineerId ?? user?.userId ?? "teralinx-user-kyle"),
    assignedEngineer: String(input.assignedEngineer ?? input.engineerName ?? user?.name ?? "Kyle"),
  };
}

function runtimeObjectName(input = {}, fallback) {
  return String(input.name ?? input.title ?? input.label ?? fallback);
}

async function hasHistoryEvent(eventType, objectId, lifecycleId = "") {
  return (await listRecords(DIRS.runtimeHistory)).some((event) => (
    event?.eventType === eventType &&
    (!objectId || event?.objectId === objectId) &&
    (!lifecycleId || event?.metadata?.lifecycleId === lifecycleId)
  ));
}

async function appendLifecycleEvent(eventType, user, context = {}, details = "", metadata = {}) {
  const lifecycleId = context.lifecycleId ?? lifecycleIdFor(context);
  const objectId = String(context.objectId ?? context.proposalId ?? context.opportunityId ?? lifecycleId);
  const existing = await hasHistoryEvent(eventType, objectId, lifecycleId);
  if (existing) return null;
  const timestamp = nowIso();
  const event = {
    historyId: `runtime-history-${lifecycleId}-${eventType}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    eventType,
    actor: user.name,
    actorId: user.userId,
    objectType: context.objectType ?? "RuntimeLifecycle",
    objectId,
    objectName: context.objectName ?? objectId,
    accountId: context.accountId ?? inputAccountId(context),
    organizationId: context.organizationId ?? user.organizationId,
    workspaceId: context.workspaceId ?? user.workspaceId,
    timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
    details,
    metadata: {
      lifecycleId,
      accountId: context.accountId ?? inputAccountId(context),
      customerId: context.customerId,
      opportunityId: context.opportunityId,
      proposalId: context.proposalId,
      draftPackageId: context.draftPackageId,
      ...metadata,
    },
  };
  await persistRecord(DIRS.runtimeHistory, event.historyId, event);
  return event;
}

async function persistRelationshipOnce(input = {}) {
  const relationshipId = String(input.relationshipId ?? `REL-${cleanId(input.fromObjectId)}-${cleanId(input.relationshipType)}-${cleanId(input.toObjectId)}`);
  const timestamp = nowIso();
  const existing = await loadRecord(DIRS.runtimeRelationships, relationshipId).catch(() => null);
  const relationship = {
    ...existing,
    relationshipId,
    relationshipType: input.relationshipType,
    fromObjectId: input.fromObjectId,
    toObjectId: input.toObjectId,
    fromObjectType: input.fromObjectType,
    toObjectType: input.toObjectType,
    organizationId: input.organizationId,
    workspaceId: input.workspaceId,
    authority: input.authority ?? "RUNTIME_LIFECYCLE_BRIDGE",
    lifecycleState: input.lifecycleState ?? "ACTIVE",
    evidenceIds: unique([...(existing?.evidenceIds ?? []), ...asArray(input.evidenceIds)]),
    metadata: {
      ...(existing?.metadata ?? {}),
      ...(input.metadata ?? {}),
      noDuplicateObjects: true,
    },
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
  await persistRecord(DIRS.runtimeRelationships, relationshipId, relationship);
  return relationship;
}

async function persistEvidenceOnce(input = {}) {
  const evidenceId = String(input.evidenceId ?? `EVIDENCE-${cleanId(input.eventType)}-${cleanId(input.objectId)}`);
  const existing = await loadRecord(DIRS.runtimeEvidence, evidenceId).catch(() => null);
  if (existing) return existing;
  const timestamp = nowIso();
  const evidence = {
    evidenceId,
    sourceType: input.sourceType ?? "RUNTIME_LIFECYCLE_BRIDGE",
    sourceName: input.sourceName ?? input.eventType ?? "Runtime lifecycle event",
    sourceSystem: "Runtime Lifecycle Bridge",
    authority: "RUNTIME_LIFECYCLE_BRIDGE",
    validationStatus: "PASS",
    collectedAt: timestamp,
    ingestedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
    lineage: input.lineage ?? {},
    metadata: {
      ...(input.metadata ?? {}),
      noScopeVersionCreation: true,
      noInventoryMutation: true,
    },
  };
  await persistRecord(DIRS.runtimeEvidence, evidenceId, evidence);
  return evidence;
}

async function ensureCustomerTwin(input, user, lifecycleId) {
  const customerId = customerIdFor(input);
  const accountId = inputAccountId(input);
  const twinId = String(input.customerTwinReference ?? input.customerTwinId ?? `CUSTOMER-TWIN-${accountId}`);
  const runtimeId = twinId.startsWith("RUNTIME-") ? twinId : `RUNTIME-CUSTOMER-TWIN-${cleanId(twinId)}`;
  const existing = await loadRecord(DIRS.runtimeObjects, runtimeId).catch(() => null);
  const timestamp = nowIso();
  const twin = {
    ...existing,
    runtimeId,
    objectId: twinId,
    objectType: "CUSTOMER_TWIN",
    name: runtimeObjectName(input.customerTwin ?? {}, `${customerId} Customer Twin`),
    owner: existing?.owner ?? user.name,
    ownerId: existing?.ownerId ?? user.userId,
    createdBy: existing?.createdBy ?? user.name,
    createdById: existing?.createdById ?? user.userId,
    assignedTo: unique([...(existing?.assignedTo ?? []), user.userId]),
    organization: input.organizationId ?? user.organizationId,
    organizationId: input.organizationId ?? user.organizationId,
    workspace: input.workspaceId ?? user.workspaceId,
    workspaceId: input.workspaceId ?? user.workspaceId,
    accountId,
    customerId,
    visibility: "ORGANIZATION",
    authority: "CUSTOMER_TWIN_RUNTIME",
    lifecycleState: "READY",
    version: Number(existing?.version ?? 1),
    evidenceIds: unique([...(existing?.evidenceIds ?? []), ...asArray(input.runtimeEvidenceIds)]),
    relationshipIds: unique(existing?.relationshipIds ?? []),
    sourceId: twinId,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
    metadata: {
      ...(existing?.metadata ?? {}),
      accountId,
      existingInventoryReferences: unique(input.existingInventoryReferences),
      customerDesignReferences: unique(input.customerDesignReferences),
      lifecycleId,
      noDuplicateObjects: true,
    },
  };
  await persistRecord(DIRS.runtimeObjects, runtimeId, twin);
  await appendLifecycleEvent("CUSTOMER_TWIN_READY", user, {
    ...input,
    lifecycleId,
    objectType: "CustomerTwin",
    objectId: twin.objectId,
    objectName: twin.name,
    customerId,
  }, "Customer Twin verified for Runtime lifecycle bridge.");
  return twin;
}

async function ensureOpportunity(input, user, lifecycleId, customerTwin) {
  const customerId = customerIdFor(input);
  const accountId = inputAccountId(input);
  const requestedId = String(input.opportunityId ?? input.opportunity?.opportunityId ?? `COMMERCIAL-OPPORTUNITY-${accountId}-QUOTE-READY`);
  const existing = await readOpportunity(requestedId).catch(() => null)
    ?? (await listRecords(DIRS.commercialOpportunities)).find((record) => record?.accountId === accountId && record?.status !== "ARCHIVED");
  if (existing) return normalizeCommercialOpportunity(existing, user, existing, { bumpVersion: false });
  const opportunity = normalizeCommercialOpportunity({
    ...(input.opportunity ?? {}),
    opportunityId: requestedId,
    runtimeObjectId: `RUNTIME-OPPORTUNITY-${requestedId}`,
    accountId,
    customerId,
    name: runtimeObjectName(input.opportunity ?? {}, `${accountId} Commercial Opportunity`),
    status: "SAVED",
    visibility: "PRIVATE",
    lifecycleState: "ACTIVE",
    runtimeObjectIds: unique([customerTwin.runtimeId, ...asArray(input.runtimeObjectIds)]),
    relationshipLinks: unique([
      `USES_CUSTOMER_TWIN:${customerTwin.runtimeId}`,
      ...asArray(input.runtimeRelationshipIds),
      ...asArray(input.relationshipLinks),
    ]),
    evidenceLinks: unique(input.runtimeEvidenceIds),
    selectedScopeId: input.selectedScopeId ?? input.scopeId,
    commercialDraftType: input.commercialDraftType,
    commercialDraftSnapshot: input.commercialDraft,
    organizationId: input.organizationId ?? user.organizationId,
    workspaceId: input.workspaceId ?? user.workspaceId,
  }, user, null);
  const saved = await saveOpportunity(opportunity, user, "COMMERCIAL_OPPORTUNITY_CREATED", "Commercial Opportunity created by Runtime Lifecycle Bridge.");
  await persistRelationshipOnce({
    fromObjectId: customerTwin.runtimeId,
    fromObjectType: "CUSTOMER_TWIN",
    toObjectId: saved.runtimeObjectId,
    toObjectType: "COMMERCIAL_OPPORTUNITY",
    relationshipType: "ENABLES_OPPORTUNITY",
    organizationId: saved.organizationId,
    workspaceId: saved.workspaceId,
    metadata: { lifecycleId },
  });
  return saved;
}

async function ensureCommercialDraft(input, user, lifecycleId, opportunity, customerTwin) {
  const existing = (await listRecords(DIRS.runtimeObjects)).find((record) => (
    record?.objectType === "COMMERCIAL_DRAFT" &&
    record?.metadata?.parentOpportunityId === opportunity.opportunityId &&
    record?.lifecycleState !== "ARCHIVED"
  ));
  if (existing) return existing;
  const timestamp = nowIso();
  const draftId = String(input.commercialDraftId ?? input.commercialDraft?.commercialDraftId ?? `COMMERCIAL-DRAFT-${opportunity.opportunityId}`);
  const runtimeId = `RUNTIME-COMMERCIAL-DRAFT-${cleanId(draftId)}`;
  const draft = {
    runtimeId,
    objectId: draftId,
    objectType: "COMMERCIAL_DRAFT",
    name: runtimeObjectName(input.commercialDraft ?? {}, `${opportunity.name} Commercial Draft`),
    owner: opportunity.owner,
    ownerId: opportunity.ownerId,
    createdBy: user.name,
    createdById: user.userId,
    assignedTo: opportunity.assignedTo,
    organization: opportunity.organizationId,
    organizationId: opportunity.organizationId,
    workspace: opportunity.workspaceId,
    workspaceId: opportunity.workspaceId,
    customerId: customerIdFor(input),
    accountId: opportunity.accountId,
    visibility: opportunity.visibility,
    authority: "COMMERCIAL_REVIEW",
    lifecycleState: "ACTIVE",
    version: Number(input.commercialDraft?.revision ?? input.revision ?? 1),
    evidenceIds: unique(input.runtimeEvidenceIds),
    relationshipIds: [],
    sourceId: draftId,
    createdAt: timestamp,
    updatedAt: timestamp,
    parent: opportunity.runtimeObjectId,
    parentOpportunityId: opportunity.opportunityId,
    revision: Number(input.commercialDraft?.revision ?? input.revision ?? 1),
    sourceProposal: input.proposalId ?? input.proposal?.proposalId ?? "",
    productId: input.productId ?? "",
    productName: input.productName ?? "",
    fulfillmentPlanId: input.fulfillmentPlanId ?? "",
    fulfillmentStrategy: input.fulfillmentStrategy ?? "",
    commercialAssumptions: unique(input.commercialAssumptionIds),
    proposalInputs: input.proposalInputs ?? input.commercialDraft ?? {},
    metadata: {
      lifecycleId,
      accountId: opportunity.accountId,
      productId: input.productId ?? "",
      productName: input.productName ?? "",
      fulfillmentPlanId: input.fulfillmentPlanId ?? "",
      fulfillmentStrategy: input.fulfillmentStrategy ?? "",
      parentOpportunityId: opportunity.opportunityId,
      customerTwinReference: customerTwin.runtimeId,
      customerDesignReferences: unique(input.customerDesignReferences),
      existingInventoryReferences: unique(input.existingInventoryReferences),
      geometryReferences: unique(input.geometryReferences),
      noDuplicateObjects: true,
    },
  };
  await persistRecord(DIRS.runtimeObjects, runtimeId, draft);
  await persistRelationshipOnce({
    fromObjectId: opportunity.runtimeObjectId,
    fromObjectType: "COMMERCIAL_OPPORTUNITY",
    toObjectId: runtimeId,
    toObjectType: "COMMERCIAL_DRAFT",
    relationshipType: "PARENT_OF",
    organizationId: opportunity.organizationId,
    workspaceId: opportunity.workspaceId,
    metadata: { lifecycleId },
  });
  await appendLifecycleEvent("COMMERCIAL_DRAFT_CREATED", user, {
    ...input,
    lifecycleId,
    objectType: "CommercialDraft",
    objectId: draft.objectId,
    objectName: draft.name,
    customerId: customerIdFor(input),
    opportunityId: opportunity.opportunityId,
  }, "Commercial Draft linked as child of Commercial Opportunity.");
  return draft;
}

async function ensureProposal(input, user, lifecycleId, opportunity, commercialDraft, customerTwin) {
  const requestedId = String(input.proposalId ?? input.proposal?.proposalId ?? `PROPOSAL-${opportunity.opportunityId}`);
  const existing = await readProposal(requestedId).catch(() => null)
    ?? (await listRecords(DIRS.proposalDrafts)).find((record) => record?.opportunityId === opportunity.opportunityId && record?.status !== "ARCHIVED");
  if (existing) return normalizeProposalRecord(existing, user, existing);
  const evidence = await persistEvidenceOnce({
    evidenceId: `EVIDENCE-LIFECYCLE-${cleanId(lifecycleId)}-PROPOSAL-CREATED`,
    eventType: "PROPOSAL_CREATED",
    objectId: requestedId,
    sourceName: "Runtime lifecycle proposal creation",
    lineage: { lifecycleId, opportunityId: opportunity.opportunityId },
  });
  const proposal = normalizeProposalRecord({
    ...(input.proposal ?? {}),
    proposalId: requestedId,
    proposalRecordId: requestedId,
    proposalNumber: input.proposalNumber ?? input.proposal?.proposalNumber,
    customerId: customerIdFor(input),
    accountId: input.accountId ?? input.account?.accountId,
    opportunityId: opportunity.opportunityId,
    productId: input.productId ?? input.productDefinitionId,
    productName: input.productName ?? input.product?.productName,
    fulfillmentPlanId: input.fulfillmentPlanId,
    fulfillmentStrategy: input.fulfillmentStrategy,
    fulfillmentPlan: input.fulfillmentPlan,
    organizationId: opportunity.organizationId,
    workspaceId: opportunity.workspaceId,
    commercialOwnerId: opportunity.ownerId,
    ownerId: opportunity.ownerId,
    visibility: "PRIVATE",
    status: "COMMERCIAL_DRAFT",
    approvalState: "NOT_SUBMITTED",
    title: input.title ?? input.proposal?.title ?? `${opportunity.name} Proposal`,
    summary: input.summary ?? input.proposal?.summary ?? "Runtime lifecycle bridge generated proposal shell.",
    executiveSummary: input.executiveSummary ?? input.proposal?.executiveSummary ?? "Commercial draft references are ready for customer review.",
    pricingSummary: input.pricingSummary ?? input.proposal?.pricingSummary ?? {},
    marginSummary: input.marginSummary ?? input.proposal?.marginSummary ?? {},
    confidenceSummary: input.confidenceSummary ?? input.proposal?.confidenceSummary ?? {},
    commercialAssumptionIds: unique(input.commercialAssumptionIds ?? input.proposal?.commercialAssumptionIds),
    dealPointIds: unique(input.dealPointIds ?? input.proposal?.dealPointIds ?? [opportunity.selectedScopeId]),
    proposalRecipientContactIds: unique(input.proposalRecipientContactIds ?? input.proposal?.proposalRecipientContactIds),
    customerReviewContactIds: unique(input.customerReviewContactIds ?? input.proposal?.customerReviewContactIds),
    approvalAuthorityContactIds: unique(input.approvalAuthorityContactIds ?? input.proposal?.approvalAuthorityContactIds),
    sofRecipientContactIds: unique(input.sofRecipientContactIds ?? input.proposal?.sofRecipientContactIds),
    customerContactEmails: unique(input.customerContactEmails ?? input.proposal?.customerContactEmails),
    runtimeObjectIds: unique([
      opportunity.runtimeObjectId,
      commercialDraft.runtimeId,
      customerTwin.runtimeId,
      input.productRuntimeObjectId,
      input.fulfillmentRuntimeObjectId,
      ...asArray(input.runtimeObjectIds),
    ]),
    runtimeRelationshipIds: unique([
      `PARENT_OF:${opportunity.runtimeObjectId}:${commercialDraft.runtimeId}`,
      `GENERATES_PROPOSAL:${commercialDraft.runtimeId}:${requestedId}`,
      input.fulfillmentPlanId && input.productId ? `FULFILLS_PRODUCT:${input.fulfillmentPlanId}:${input.productId}` : "",
      ...asArray(input.runtimeRelationshipIds),
    ]),
    runtimeEvidenceIds: unique([evidence.evidenceId, ...asArray(input.runtimeEvidenceIds)]),
    existingInventoryReferences: unique(input.existingInventoryReferences),
    customerDesignReferences: unique(input.customerDesignReferences),
    customerTwinReference: customerTwin.runtimeId,
    geometryReferences: unique(input.geometryReferences),
    proposalDocumentReferences: unique(input.proposalDocumentReferences ?? ["Runtime lifecycle proposal"]),
    sourceCommercialDraftId: commercialDraft.objectId,
    noScopeVersionCreation: true,
    noInventoryMutation: true,
  }, user, null);
  const saved = await saveProposal(proposal, user, "PROPOSAL_CREATED", "Proposal Runtime Object generated from Commercial Draft by Runtime Lifecycle Bridge.", { lifecycleId, commercialDraftId: commercialDraft.objectId });
  await persistRelationshipOnce({
    fromObjectId: commercialDraft.runtimeId,
    fromObjectType: "COMMERCIAL_DRAFT",
    toObjectId: saved.runtimeObjectId,
    toObjectType: "PROPOSAL",
    relationshipType: "GENERATES_PROPOSAL",
    organizationId: saved.organizationId,
    workspaceId: saved.workspaceId,
    evidenceIds: [evidence.evidenceId],
    metadata: { lifecycleId },
  });
  return saved;
}

async function updateWorkspaceForCustomer(userId, task, notification) {
  const customer = findAlphaUserById(userId);
  if (!customer) return null;
  const existing = await loadRecord(DIRS.runtimeWorkspaces, customer.workspaceId).catch(() => runtimeWorkspaceForUser(customer));
  const workspace = {
    ...existing,
    assignments: unique([...(existing.assignments ?? []), task.runtimeId]),
    notifications: [
      ...asArray(existing.notifications).filter((item) => item?.notificationId !== notification.notificationId),
      notification,
    ],
    recentActivity: unique([notification.notificationId, ...(existing.recentActivity ?? [])]).slice(0, 25),
    updatedAt: nowIso(),
  };
  await persistRecord(DIRS.runtimeWorkspaces, customer.workspaceId, workspace);
  return workspace;
}

async function submitAndAssignProposal(input, user, lifecycleId, proposal) {
  const customerUsers = customerUserIds(input);
  let current = proposal;
  if (!(await hasHistoryEvent("PROPOSAL_SUBMITTED", current.proposalId))) {
    current = await saveProposal(normalizeProposalRecord({
      ...current,
      status: "AWAITING_CUSTOMER_REVIEW",
      approvalState: "CUSTOMER_REVIEW",
      visibility: "SHARED",
      assignedCustomerUsers: unique([...asArray(current.assignedCustomerUsers), ...customerUsers]),
      proposalRecipientContactIds: unique([...asArray(current.proposalRecipientContactIds), ...asArray(input.proposalRecipientContactIds)]),
      customerReviewContactIds: unique([...asArray(current.customerReviewContactIds), ...asArray(input.customerReviewContactIds)]),
      approvalAuthorityContactIds: unique([...asArray(current.approvalAuthorityContactIds), ...asArray(input.approvalAuthorityContactIds)]),
      sofRecipientContactIds: unique([...asArray(current.sofRecipientContactIds), ...asArray(input.sofRecipientContactIds)]),
      customerContactEmails: unique([...asArray(current.customerContactEmails), ...asArray(input.customerContactEmails)]),
      assignedTo: unique([...asArray(current.assignedTo), ...customerUsers]),
      submittedAt: nowIso(),
      immutableAfterSubmission: true,
      commercialEditFrozen: true,
    }, user, current, { assignDefaultCustomerUser: true }), user, "PROPOSAL_SUBMITTED", "Proposal submitted into customer review by Runtime Lifecycle Bridge.", { lifecycleId, assignedCustomerUsers: customerUsers });
  }
  if (!(await hasHistoryEvent("PROPOSAL_ASSIGNED", current.proposalId))) {
    current = await saveProposal(normalizeProposalRecord({
      ...current,
      status: "AWAITING_CUSTOMER_REVIEW",
      approvalState: "CUSTOMER_REVIEW",
      visibility: "SHARED",
      assignedCustomerUsers: unique([...asArray(current.assignedCustomerUsers), ...customerUsers]),
      proposalRecipientContactIds: unique([...asArray(current.proposalRecipientContactIds), ...asArray(input.proposalRecipientContactIds)]),
      customerReviewContactIds: unique([...asArray(current.customerReviewContactIds), ...asArray(input.customerReviewContactIds)]),
      approvalAuthorityContactIds: unique([...asArray(current.approvalAuthorityContactIds), ...asArray(input.approvalAuthorityContactIds)]),
      sofRecipientContactIds: unique([...asArray(current.sofRecipientContactIds), ...asArray(input.sofRecipientContactIds)]),
      customerContactEmails: unique([...asArray(current.customerContactEmails), ...asArray(input.customerContactEmails)]),
      assignedTo: unique([...asArray(current.assignedTo), ...customerUsers]),
      immutableAfterSubmission: true,
      commercialEditFrozen: true,
    }, user, current, { assignDefaultCustomerUser: true }), user, "PROPOSAL_ASSIGNED", "Proposal assigned to customer reviewers by Runtime Lifecycle Bridge.", { lifecycleId, assignedCustomerUsers: customerUsers });
  }
  for (const customerUserId of customerUsers) {
    const taskId = `REVIEW-TASK-${cleanId(current.proposalId)}-${cleanId(customerUserId)}`;
    const timestamp = nowIso();
    const task = {
      runtimeId: taskId,
      objectId: taskId,
      objectType: "REVIEW_TASK",
      name: `${current.proposalNumber ?? current.proposalId} Customer Review`,
      owner: current.owner,
      ownerId: current.ownerId,
      createdBy: user.name,
      createdById: user.userId,
      assignedTo: [customerUserId],
      organization: current.organizationId,
      organizationId: current.organizationId,
      workspace: findAlphaUserById(customerUserId)?.workspaceId ?? current.workspaceId,
      workspaceId: findAlphaUserById(customerUserId)?.workspaceId ?? current.workspaceId,
      accountId: current.accountId,
      customerId: current.customerId,
      visibility: "SHARED",
      authority: "CUSTOMER_REVIEW",
      lifecycleState: "AWAITING_REVIEW",
      version: 1,
      evidenceIds: unique(current.runtimeEvidenceIds),
      relationshipIds: [],
      sourceId: current.proposalId,
      createdAt: timestamp,
      updatedAt: timestamp,
      metadata: {
        lifecycleId,
        accountId: current.accountId,
        proposalId: current.proposalId,
        proposalRecipientContactIds: current.proposalRecipientContactIds,
        customerReviewContactIds: current.customerReviewContactIds,
        approvalAuthorityContactIds: current.approvalAuthorityContactIds,
        sofRecipientContactIds: current.sofRecipientContactIds,
        noDuplicateObjects: true,
      },
    };
    await persistRecord(DIRS.runtimeObjects, taskId, task);
    await persistRelationshipOnce({
      fromObjectId: current.runtimeObjectId,
      fromObjectType: "PROPOSAL",
      toObjectId: taskId,
      toObjectType: "REVIEW_TASK",
      relationshipType: "ASSIGNED_FOR_CUSTOMER_REVIEW",
      organizationId: current.organizationId,
      workspaceId: current.workspaceId,
      metadata: { lifecycleId, customerUserId },
    });
    const notification = {
      notificationId: `NOTIFICATION-${taskId}`,
      userId: customerUserId,
      type: "PROPOSAL_CUSTOMER_REVIEW",
      message: `${current.proposalNumber ?? current.proposalId} is awaiting customer review.`,
      objectId: current.proposalId,
      taskId,
      createdAt: timestamp,
      read: false,
    };
    await updateWorkspaceForCustomer(customerUserId, task, notification);
  }
  await persistEvidenceOnce({
    evidenceId: `EVIDENCE-LIFECYCLE-${cleanId(lifecycleId)}-PROPOSAL-ASSIGNED`,
    eventType: "PROPOSAL_ASSIGNED",
    objectId: current.proposalId,
    sourceName: "Proposal customer assignment",
    lineage: { lifecycleId, proposalId: current.proposalId },
    metadata: { assignedCustomerUsers: customerUsers },
  });
  if (!(await hasHistoryEvent("CUSTOMER_REVIEW_STARTED", current.proposalId))) {
    current = await saveProposal(normalizeProposalRecord(current, user, current), user, "CUSTOMER_REVIEW_STARTED", "Customer review started by Runtime Lifecycle Bridge.", { lifecycleId, assignedCustomerUsers: customerUsers });
  }
  return current;
}

async function assembleIfApproved(input, user, lifecycleId, proposal) {
  if (!(proposal.approvalState === "APPROVED" || ["CUSTOMER_APPROVED", "READY_FOR_IOF_PACKAGE"].includes(proposal.status))) {
    return { draftPackage: null, engineeringQueueItem: null };
  }
  const draftPackage = await loadCommercialDraftIofPackageForProposal(proposal.proposalId);
  if (!draftPackage) return { draftPackage: null, engineeringQueueItem: null };
  const queue = await listReviewQueue();
  return {
    draftPackage,
    engineeringQueueItem: queue.find((item) => item.packageId === draftPackage.packageId) ?? null,
  };
}

function lifecycleProgress(events, objects = {}) {
  return LIFECYCLE_EVENTS.map((eventType) => {
    const event = events.find((item) => item.eventType === eventType);
    return {
      eventType,
      complete: Boolean(event),
      timestamp: event?.timestamp ?? "",
      objectId: event?.objectId ?? objects[eventType] ?? "",
    };
  });
}

async function lifecycleState(input, user, records = {}) {
  const lifecycleId = lifecycleIdFor(input);
  const events = (await listRecords(DIRS.runtimeHistory))
    .filter((event) => event?.metadata?.lifecycleId === lifecycleId || [
      records.opportunity?.opportunityId,
      records.product?.productId,
      records.fulfillmentPlan?.fulfillmentPlanId,
      records.proposal?.proposalId,
      records.draftPackage?.packageId,
    ].includes(event?.objectId))
    .sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
  const proposal = records.proposal;
  const draftPackage = records.draftPackage;
  return {
    lifecycleId,
    status: draftPackage ? "ENGINEERING_REVIEW_QUEUED" : proposal?.approvalState === "APPROVED" ? "CUSTOMER_APPROVED" : proposal ? "AWAITING_CUSTOMER_REVIEW" : records.commercialDraft ? "COMMERCIAL_DRAFT_CREATED" : "CUSTOMER_TWIN_READY",
    lifecycleProgress: lifecycleProgress(events, {
      CUSTOMER_TWIN_READY: records.customerTwin?.objectId,
      COMMERCIAL_OPPORTUNITY_CREATED: records.opportunity?.opportunityId,
      PRODUCT_SELECTED: records.product?.productId,
      INVENTORY_RESOLVED: records.fulfillmentPlan?.fulfillmentPlanId,
      FULFILLMENT_PLAN_CREATED: records.fulfillmentPlan?.fulfillmentPlanId,
      COMMERCIAL_DRAFT_CREATED: records.commercialDraft?.objectId,
      PROPOSAL_CREATED: proposal?.proposalId,
      PROPOSAL_SUBMITTED: proposal?.proposalId,
      PROPOSAL_ASSIGNED: proposal?.proposalId,
      CUSTOMER_REVIEW_STARTED: proposal?.proposalId,
      CUSTOMER_APPROVED: proposal?.proposalId,
      DRAFT_IOF_PACKAGE_CREATED: draftPackage?.packageId,
      ENGINEERING_REVIEW_QUEUED: draftPackage?.packageId,
    }),
    currentAuthority: draftPackage?.authority ?? (proposal?.approvalState === "APPROVED" ? "ENGINEERING_REVIEW" : proposal?.authority ? "CUSTOMER_REVIEW" : records.opportunity?.authority ? "COMMERCIAL_REVIEW" : "CUSTOMER_TWIN_RUNTIME"),
    currentOwner: draftPackage?.assignedEngineer || proposal?.owner || records.opportunity?.owner || user.name,
    currentWorkspace: draftPackage?.workspaceId ?? proposal?.workspaceId ?? records.opportunity?.workspaceId ?? user.workspaceId,
    currentRuntimeObject: draftPackage?.packageId ?? proposal?.runtimeObjectId ?? records.commercialDraft?.runtimeId ?? records.opportunity?.runtimeObjectId ?? records.customerTwin?.runtimeId ?? "",
    currentProduct: records.product?.productId ?? proposal?.productId ?? "",
    currentFulfillmentPlan: records.fulfillmentPlan?.fulfillmentPlanId ?? proposal?.fulfillmentPlanId ?? "",
    currentProposal: proposal?.proposalId ?? "",
    currentIofPackage: draftPackage?.packageId ?? "",
    currentEngineeringStatus: records.engineeringQueueItem ? "QUEUED" : draftPackage ? draftPackage.workflowStatus : "NOT_QUEUED",
    events,
  };
}

async function advanceLifecycle(input, user) {
  if (!userHasPermission(user, "workspace.commercial") && !userHasPermission(user, "proposal.manage") && !userHasPermission(user, "platform.admin")) {
    throw Object.assign(new Error("You do not have authority to advance the Runtime lifecycle."), { status: 403 });
  }
  const lifecycleId = lifecycleIdFor(input);
  const customerTwin = await ensureCustomerTwin(input, user, lifecycleId);
  const opportunity = await ensureOpportunity(input, user, lifecycleId, customerTwin);
  const productFulfillment = await ensureProductFulfillment({
    ...input,
    lifecycleId,
    opportunityId: opportunity.opportunityId,
    accountId: opportunity.accountId,
    customerId: customerIdFor(input),
    ownerId: opportunity.ownerId,
    organizationId: opportunity.organizationId,
    workspaceId: opportunity.workspaceId,
  }, user);
  await appendLifecycleEvent("PRODUCT_SELECTED", user, {
    ...input,
    lifecycleId,
    objectType: "Product",
    objectId: productFulfillment.product.productId,
    objectName: productFulfillment.product.productName,
    accountId: opportunity.accountId,
    customerId: customerIdFor(input),
    opportunityId: opportunity.opportunityId,
  }, "Product selected before pricing, engineering, or execution.");
  await appendLifecycleEvent("INVENTORY_RESOLVED", user, {
    ...input,
    lifecycleId,
    objectType: "FulfillmentPlan",
    objectId: productFulfillment.fulfillmentPlan.fulfillmentPlanId,
    objectName: productFulfillment.fulfillmentPlan.productName,
    accountId: opportunity.accountId,
    customerId: customerIdFor(input),
    opportunityId: opportunity.opportunityId,
  }, "Carrier-neutral governed inventory resolved for Product fulfillment.");
  await appendLifecycleEvent("FULFILLMENT_PLAN_CREATED", user, {
    ...input,
    lifecycleId,
    objectType: "FulfillmentPlan",
    objectId: productFulfillment.fulfillmentPlan.fulfillmentPlanId,
    objectName: productFulfillment.fulfillmentPlan.productName,
    accountId: opportunity.accountId,
    customerId: customerIdFor(input),
    opportunityId: opportunity.opportunityId,
  }, "Fulfillment Plan established as the governed operational object.", {
    fulfillmentStrategy: productFulfillment.fulfillmentPlan.fulfillmentStrategy,
    fulfillmentMix: productFulfillment.fulfillmentPlan.fulfillmentMix,
  });
  await persistRelationshipOnce({
    fromObjectId: productFulfillment.fulfillmentPlan.runtimeObjectId,
    fromObjectType: "FULFILLMENT_PLAN",
    toObjectId: productFulfillment.product.runtimeObjectId,
    toObjectType: "PRODUCT",
    relationshipType: "FULFILLS_PRODUCT",
    organizationId: opportunity.organizationId,
    workspaceId: opportunity.workspaceId,
    metadata: {
      lifecycleId,
      productId: productFulfillment.product.productId,
      fulfillmentPlanId: productFulfillment.fulfillmentPlan.fulfillmentPlanId,
      ownershipIsMetadata: true,
    },
  });
  const lifecycleInput = {
    ...input,
    lifecycleId,
    productId: productFulfillment.product.productId,
    productName: productFulfillment.product.productName,
    productRuntimeObjectId: productFulfillment.product.runtimeObjectId,
    fulfillmentPlanId: productFulfillment.fulfillmentPlan.fulfillmentPlanId,
    fulfillmentStrategy: productFulfillment.fulfillmentPlan.fulfillmentStrategy,
    fulfillmentPlan: productFulfillment.fulfillmentPlan,
    fulfillmentRuntimeObjectId: productFulfillment.fulfillmentPlan.runtimeObjectId,
    runtimeObjectIds: unique([
      productFulfillment.product.runtimeObjectId,
      productFulfillment.fulfillmentPlan.runtimeObjectId,
      ...asArray(input.runtimeObjectIds),
    ]),
    runtimeRelationshipIds: unique([
      `FULFILLS_PRODUCT:${productFulfillment.fulfillmentPlan.fulfillmentPlanId}:${productFulfillment.product.productId}`,
      ...asArray(input.runtimeRelationshipIds),
    ]),
  };
  const commercialDraft = await ensureCommercialDraft(lifecycleInput, user, lifecycleId, opportunity, customerTwin);
  let proposal = await ensureProposal(lifecycleInput, user, lifecycleId, opportunity, commercialDraft, customerTwin);
  proposal = await submitAndAssignProposal(lifecycleInput, user, lifecycleId, proposal);
  const approvalCandidate = await readProposal(proposal.proposalId).catch(() => proposal);
  proposal = normalizeProposalRecord(approvalCandidate, user, approvalCandidate);
  const assembly = await assembleIfApproved(lifecycleInput, user, lifecycleId, proposal);
  const state = await lifecycleState(lifecycleInput, user, {
    customerTwin,
    opportunity,
    product: productFulfillment.product,
    fulfillmentPlan: productFulfillment.fulfillmentPlan,
    commercialDraft,
    proposal,
    draftPackage: assembly.draftPackage,
    engineeringQueueItem: assembly.engineeringQueueItem,
  });
  const workspaceSession = await updateRuntimeWorkspaceSession({
    ...lifecycleInput,
    lifecycle: state,
    sessionState: "ACTIVE",
    currentAuthority: state.currentAuthority,
    currentLifecycleStage: state.status,
    currentRuntimeObject: state.currentRuntimeObject,
    proposalId: proposal.proposalId,
    packageId: assembly.draftPackage?.packageId,
    selectedRoute: asArray(lifecycleInput.geometryReferences)[0] ?? lifecycleInput.commercialDraft?.routeId,
    selectedGraph: asArray(lifecycleInput.runtimeObjectIds)[0],
    selectedPackage: assembly.draftPackage?.packageId,
    engineeringRevision: assembly.draftPackage?.packageRevision,
    lastActivity: "RUNTIME_LIFECYCLE_ADVANCED",
  }, user, "RUNTIME_LIFECYCLE_ADVANCED", "Runtime lifecycle advanced and WorkspaceSession persisted.");
  return {
    ok: true,
    trigger: input.trigger ?? "QUOTE_READY_FOR_CUSTOMER",
    lifecycle: state,
    customerTwin,
    opportunity,
    product: productFulfillment.product,
    fulfillmentPlan: productFulfillment.fulfillmentPlan,
    commercialDraft,
    proposal,
    draftPackage: assembly.draftPackage,
    engineeringQueueItem: assembly.engineeringQueueItem,
    workspaceSession,
  };
}

async function handleState(req, res, user) {
  const url = new URL(req.url ?? "/", `https://${req.headers.host ?? "runtime.invalid"}`);
  const input = Object.fromEntries(url.searchParams.entries());
  const lifecycleId = lifecycleIdFor(input);
  const events = (await listRecords(DIRS.runtimeHistory)).filter((event) => event?.metadata?.lifecycleId === lifecycleId);
  jsonResponse(res, 200, {
    lifecycleId,
    lifecycleProgress: lifecycleProgress(events),
    events,
  });
}

export async function handleRuntimeLifecycleBridge(req, res, pathname) {
  const parts = routeParts(pathname);
  if (!parts) return false;
  if (handleOptions(req, res)) return true;
  const user = userFromBearerToken(req);
  if (!user) {
    errorResponse(res, 401, "Authentication token is missing or invalid.");
    return true;
  }

  if (req.method === "GET" && (parts.length === 0 || parts[0] === "state")) {
    await handleState(req, res, user);
    return true;
  }

  if (req.method === "POST" && (parts.length === 0 || parts[0] === "advance" || parts[0] === "bridge")) {
    try {
      const input = await readRequestJson(req);
      jsonResponse(res, 200, await advanceLifecycle(input, user));
    } catch (error) {
      errorResponse(res, error.status ?? 500, error.message ?? "Runtime lifecycle bridge failed.");
    }
    return true;
  }

  errorResponse(res, 405, "Runtime Lifecycle Bridge method not allowed.");
  return true;
}
