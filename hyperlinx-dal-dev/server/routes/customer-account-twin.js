import { DIRS, listRecords, sortedByUpdated } from "./_shared.js";

export const CUSTOMER_DEAL_STATES = [
  "DRAFT", "PROPOSED", "CUSTOMER_REVIEW", "ACCEPTED", "ENGINEERING", "CERTIFIED",
  "SERVICE_ORDER", "CUSTOMER_SIGNED", "COUNTERSIGNED", "AUTHORIZED",
];

const text = (value) => String(value ?? "").trim();
const newest = (records) => sortedByUpdated(records)[0] ?? null;

function hasPermission(user, permission) {
  return Array.isArray(user?.permissions) && user.permissions.includes(permission);
}

function deriveState({ proposal, reviewPackage, engineeringPackage, certifiedPackage, serviceOrder, scopeVersion }) {
  if (scopeVersion?.scopeVersionId) return "AUTHORIZED";
  if (serviceOrder?.status === "COUNTERSIGNED" || serviceOrder?.countersignedAt) return "COUNTERSIGNED";
  if (serviceOrder?.status === "CUSTOMER_ACCEPTED" || serviceOrder?.customerSignedAt || serviceOrder?.customerSignatureId) return "CUSTOMER_SIGNED";
  if (serviceOrder?.serviceOrderId) return "SERVICE_ORDER";
  if (certifiedPackage?.certifiedPackageId) return "CERTIFIED";
  if (engineeringPackage?.engineeringPackageId) return "ENGINEERING";
  if (proposal?.approvalState === "APPROVED") return "ACCEPTED";
  if (reviewPackage?.customerReviewPackageId) return "CUSTOMER_REVIEW";
  if (proposal?.proposalId && !["DRAFT", "SAVED"].includes(text(proposal.status).toUpperCase())) return "PROPOSED";
  return "DRAFT";
}

function permittedActions(state, { lens, persona, user, serviceOrder }) {
  const actions = [
    { action: "INSPECT_DEAL", label: "Open deal", authority: "READ_PROJECTION", mutation: false },
    { action: "VIEW_GOVERNED_MAP", label: "View map", authority: "READ_PROJECTION", mutation: false },
    { action: "VIEW_GOVERNED_DOCUMENTS", label: "View documents", authority: "READ_PROJECTION", mutation: false },
  ];
  if (lens === "CUSTOMER") {
    const mayReview = persona === "CUSTOMER_COMMERCIAL_REVIEWER" || persona === "CUSTOMER_AUTHORIZED_SIGNER";
    if (state === "CUSTOMER_REVIEW" && mayReview) actions.push(
      { action: "ACCEPT_PROPOSAL_REVISION", label: "Accept exact revision", authority: persona, mutation: true },
      { action: "REQUEST_PROPOSAL_CHANGE", label: "Request change", authority: persona, mutation: true },
      { action: "DECLINE_PROPOSAL_REVISION", label: "Decline exact revision", authority: persona, mutation: true },
    );
    if (state === "SERVICE_ORDER" && serviceOrder?.status === "ISSUED" && persona === "CUSTOMER_AUTHORIZED_SIGNER") {
      actions.push({ action: "SIGN_SERVICE_ORDER", label: "Sign exact Service Order", authority: persona, mutation: true });
    }
    return actions;
  }
  if (state === "DRAFT" && hasPermission(user, "opportunity.manage")) {
    actions.push({ action: "CONTINUE_COMMERCIAL_DRAFT", label: "Continue Commercial draft", authority: "opportunity.manage", mutation: true });
  }
  if (["DRAFT", "PROPOSED"].includes(state) && hasPermission(user, "proposal.manage")) {
    actions.push({ action: "OPEN_PROPOSAL", label: "Open Proposal", authority: "proposal.manage", mutation: true });
  }
  if (["ACCEPTED", "ENGINEERING"].includes(state) && hasPermission(user, "engineering.lifecycle.manage")) {
    actions.push({ action: "OPEN_ENGINEERING", label: "Open Engineering", authority: "engineering.lifecycle.manage", mutation: true });
  }
  if (state === "CUSTOMER_SIGNED" && hasPermission(user, "service_order.countersign")) {
    actions.push({ action: "OPEN_COUNTERSIGNATURE", label: "Review countersignature", authority: "service_order.countersign", mutation: true });
  }
  return actions;
}

function dealTimestamp(...records) {
  return records.filter(Boolean).map((item) => item.updatedAt ?? item.createdAt ?? item.submittedAt ?? "").sort().at(-1) ?? null;
}

export async function buildAccountCustomerTwin({ account, user, lens = "INTERNAL", persona = "", allowedOpportunityIds = null }) {
  const [opportunities, proposals, reviewPackages, engineeringPackages, certifiedPackages, serviceOrders, scopeVersions] = await Promise.all([
    listRecords(DIRS.commercialOpportunities), listRecords(DIRS.proposalDrafts), listRecords(DIRS.customerReviewPackages),
    listRecords(DIRS.engineeringPackages), listRecords(DIRS.certifiedIofPackages), listRecords(DIRS.serviceOrders), listRecords(DIRS.scopeVersions),
  ]);
  const accountId = text(account.accountId);
  const customerId = text(account.customerId);
  const allowed = allowedOpportunityIds ? new Set(allowedOpportunityIds) : null;
  const belongs = (item) => text(item?.accountId) === accountId || (customerId && text(item?.customerId) === customerId);
  const opportunityIds = new Set(opportunities.filter(belongs).map((item) => text(item.opportunityId)).filter(Boolean));
  for (const collection of [proposals, reviewPackages, engineeringPackages, certifiedPackages, serviceOrders]) {
    for (const item of collection) if (belongs(item) && item.opportunityId) opportunityIds.add(text(item.opportunityId));
  }
  if (allowed) {
    for (const opportunityId of [...opportunityIds]) if (!allowed.has(opportunityId)) opportunityIds.delete(opportunityId);
    for (const opportunityId of allowed) opportunityIds.add(opportunityId);
  }
  const deals = [...opportunityIds].map((opportunityId) => {
    const opportunity = newest(opportunities.filter((item) => text(item.opportunityId) === opportunityId));
    const proposal = newest(proposals.filter((item) => text(item.opportunityId) === opportunityId));
    const reviewPackage = newest(reviewPackages.filter((item) => text(item.opportunityId) === opportunityId));
    const engineeringPackage = newest(engineeringPackages.filter((item) => text(item.opportunityId) === opportunityId || (proposal && text(item.proposalId) === text(proposal.proposalId))));
    const certifiedPackage = newest(certifiedPackages.filter((item) => text(item.opportunityId) === opportunityId || (proposal && text(item.proposalId) === text(proposal.proposalId))));
    const serviceOrder = newest(serviceOrders.filter((item) => text(item.opportunityId) === opportunityId || (proposal && text(item.proposalId) === text(proposal.proposalId))));
    const scopeVersion = serviceOrder?.scopeVersionId
      ? scopeVersions.find((item) => text(item.scopeVersionId) === text(serviceOrder.scopeVersionId)) ?? null
      : newest(scopeVersions.filter((item) => text(item.opportunityId ?? item.canonicalTruth?.opportunityId) === opportunityId));
    const state = deriveState({ proposal, reviewPackage, engineeringPackage, certifiedPackage, serviceOrder, scopeVersion });
    const currentStateIndex = CUSTOMER_DEAL_STATES.indexOf(state);
    return {
      dealId: opportunityId,
      opportunityId,
      accountId,
      customerId,
      title: text(opportunity?.name || reviewPackage?.title || proposal?.name || opportunityId),
      summary: text(reviewPackage?.summary || proposal?.summary || opportunity?.description),
      currentState: state,
      currentStateIndex,
      lifecycle: CUSTOMER_DEAL_STATES.map((name, index) => ({ name, status: index < currentStateIndex ? "COMPLETE" : index === currentStateIndex ? "CURRENT" : "PENDING" })),
      permittedActions: permittedActions(state, { lens, persona, user, serviceOrder }),
      commercial: {
        proposalId: proposal?.proposalId ?? reviewPackage?.proposalId ?? null,
        proposalRevisionId: proposal?.proposalRevisionId ?? reviewPackage?.proposalRevisionId ?? null,
        proposalRevisionNumber: proposal?.proposalRevisionNumber ?? reviewPackage?.proposalRevisionNumber ?? null,
        proposalHash: proposal?.proposalHash ?? reviewPackage?.proposalHash ?? null,
      },
      spatial: {
        routeRepositoryId: reviewPackage?.route?.routeRepositoryId ?? opportunity?.routeRepositoryId ?? null,
        routeRevision: reviewPackage?.route?.routeRevision ?? opportunity?.routeRevision ?? null,
        geometryHash: reviewPackage?.route?.geometryHash ?? opportunity?.geometryHash ?? null,
      },
      engineering: {
        engineeringPackageId: engineeringPackage?.engineeringPackageId ?? null,
        certifiedPackageId: certifiedPackage?.certifiedPackageId ?? null,
        certificationHash: certifiedPackage?.certificationHash ?? null,
      },
      contractual: {
        serviceOrderId: serviceOrder?.serviceOrderId ?? null,
        serviceOrderStatus: serviceOrder?.status ?? null,
        documentHash: serviceOrder?.documentHash ?? null,
        scopeVersionId: scopeVersion?.scopeVersionId ?? serviceOrder?.scopeVersionId ?? null,
      },
      updatedAt: dealTimestamp(opportunity, proposal, reviewPackage, engineeringPackage, certifiedPackage, serviceOrder, scopeVersion),
    };
  }).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  const stateCounts = Object.fromEntries(CUSTOMER_DEAL_STATES.map((state) => [state, deals.filter((deal) => deal.currentState === state).length]));
  return {
    customerTwinId: `CUSTOMER-TWIN-${accountId}`,
    projectionType: "ACCOUNT_CUSTOMER_TWIN",
    projectionAuthority: "READ_ONLY_GOVERNED_PROJECTION",
    account: {
      accountId, accountNumber: account.accountNumber ?? null, customerId, customerOrganizationId: account.customerOrganizationId ?? null,
      name: account.name, status: account.status, organizationId: account.organizationId,
    },
    lens,
    persona: persona || null,
    dealCount: deals.length,
    stateCounts,
    deals,
    lifecycleStates: CUSTOMER_DEAL_STATES,
    generatedAt: new Date().toISOString(),
    createsAuthority: false,
  };
}
