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
import { requireAnyPermission } from "./authority.js";

const BASE_PATH = "/api/service-orders";
const ACCEPTED_PROPOSAL_STATUSES = new Set([
  "CUSTOMER_APPROVED",
  "READY_FOR_IOF_PACKAGE",
  "SALES_ENGINEERING_REVIEW",
  "CERTIFIED_IOF_PACKAGE",
  "CUSTOMER_ACCEPTED",
  "APPROVED",
  "ACCEPTED",
]);

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === "") return [];
  return [value];
}

function asString(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function asNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function proposalIdFor(proposal = {}) {
  return asString(proposal.proposalId ?? proposal.proposalRecordId ?? proposal.acceptedProposalId);
}

function certifiedIdFor(certified = {}) {
  return asString(certified.certifiedPackageId ?? certified.certifiedDraftIofPackageId ?? certified.packageId);
}

function isAcceptedProposal(proposal = {}, customerAcceptance = {}) {
  if (asString(customerAcceptance.status).toUpperCase().includes("ACCEPT")) return true;
  if (asString(customerAcceptance.acceptanceId ?? customerAcceptance.customerAcceptanceId)) return true;
  if (asString(proposal.approvalState).toUpperCase() === "APPROVED") return true;
  return ACCEPTED_PROPOSAL_STATUSES.has(asString(proposal.status).toUpperCase());
}

function routeSummaryFrom(certified = {}, proposal = {}) {
  const commercial = asRecord(certified.commercialSummary);
  const measuredSpine = asRecord(certified.measuredSpine);
  const proposalCommercial = asRecord(proposal.commercialDesign);
  const routeFeet = asNumber(commercial.routeFeet ?? measuredSpine.routeLengthFeet ?? proposalCommercial.routeFeet, 0);
  const routeMiles = asNumber(commercial.routeMiles ?? measuredSpine.routeLengthMiles, routeFeet ? routeFeet / 5280 : 0);
  return {
    source: "CERTIFIED_DRAFT_IOF_PACKAGE",
    routeId: asString(certified.routeId ?? certified.centerlineId ?? certified.geometryReferences?.[0] ?? proposal.geometryReferences?.[0], "CERTIFIED_DRAFT_IOF_ROUTE"),
    routeLengthFeet: routeFeet,
    routeLengthMiles: routeMiles,
    endpointA: certified.endpointA ?? commercial.endpointA ?? proposal.endpointA ?? null,
    endpointZ: certified.endpointZ ?? commercial.endpointZ ?? proposal.endpointZ ?? null,
    geometryReferences: asArray(certified.geometryReferences),
    stationCount: asNumber(asRecord(certified.stationAuthority).stationCount, asArray(certified.stations).length),
  };
}

function pricingSummaryFrom(proposal = {}, certified = {}) {
  const proposalPricing = asRecord(proposal.pricingSummary);
  const certifiedPricing = asRecord(asRecord(certified.commercialSummary).pricingSummary);
  const pricing = Object.keys(proposalPricing).length ? proposalPricing : certifiedPricing;
  return {
    source: "ACCEPTED_PROPOSAL",
    nrc: pricing.nrc ?? pricing.totalNrc ?? pricing.constructionCost ?? null,
    mrc: pricing.mrc ?? pricing.totalMrc ?? null,
    termMonths: pricing.termMonths ?? pricing.term ?? null,
    currency: pricing.currency ?? "USD",
    marginSummary: proposal.marginSummary ?? null,
  };
}

function objectSummaryFrom(certified = {}) {
  const manifest = asRecord(certified.engineeringManifest ?? certified.finalEngineeringManifest ?? certified.manifest);
  const counts = asRecord(manifest.counts);
  return {
    source: "CERTIFIED_DRAFT_IOF_PACKAGE",
    manifestId: asString(manifest.manifestId),
    unitCount: asArray(certified.certifiedIofUnits ?? certified.proposedIofUnits).length,
    manifestObjectCount: asNumber(counts.objects, asArray(manifest.objects).length),
    manifestRelationshipCount: asNumber(counts.relationships, asArray(manifest.relationships).length),
    manifestEvidenceCount: asNumber(counts.evidence, asArray(manifest.evidence).length),
    stationCount: asNumber(counts.stations, asArray(manifest.stations).length),
    noEngineeringObjectDuplication: true,
  };
}

function scheduleSummaryFrom(proposal = {}, certified = {}) {
  const commercial = asRecord(certified.commercialSummary);
  const proposalSchedule = asRecord(proposal.scheduleSummary ?? proposal.deliverySummary);
  return {
    source: "ACCEPTED_PROPOSAL_AND_CERTIFIED_DRAFT_IOF_PACKAGE",
    requestedServiceDate: proposalSchedule.requestedServiceDate ?? commercial.requestedServiceDate ?? null,
    estimatedConstructionDurationDays: proposalSchedule.estimatedConstructionDurationDays ?? commercial.estimatedConstructionDurationDays ?? null,
    milestones: asArray(proposalSchedule.milestones ?? commercial.milestones),
    placeholderOnly: true,
  };
}

function customerSummaryFrom(proposal = {}, certified = {}) {
  return {
    customerId: asString(proposal.customerId ?? certified.customerId),
    customerName: asString(proposal.customerName ?? proposal.customer ?? certified.customerName ?? asRecord(certified.customerSummary).name, "Customer"),
    accountId: asString(proposal.accountId ?? certified.accountId),
    opportunityId: asString(proposal.opportunityId ?? certified.opportunityId),
  };
}

function legalPlaceholders() {
  return [
    { key: "termsAndConditions", label: "Terms & Conditions", status: "COMMERCIAL_RELEASE_2_PLACEHOLDER" },
    { key: "paymentTerms", label: "Payment Terms", status: "COMMERCIAL_RELEASE_2_PLACEHOLDER" },
    { key: "insurance", label: "Insurance", status: "COMMERCIAL_RELEASE_2_PLACEHOLDER" },
    { key: "warranty", label: "Warranty", status: "COMMERCIAL_RELEASE_2_PLACEHOLDER" },
    { key: "signatureBlocks", label: "Signature Blocks", status: "COMMERCIAL_RELEASE_2_PLACEHOLDER" },
    { key: "legalLanguage", label: "Legal Language", status: "COMMERCIAL_RELEASE_2_PLACEHOLDER" },
  ];
}

function normalizeCustomerAcceptance(proposal = {}, input = {}) {
  const latestApproval = asArray(proposal.approvals).at(-1) ?? {};
  return {
    customerAcceptanceId: asString(input.customerAcceptanceId ?? input.acceptanceId ?? latestApproval.approvalId, `CUST-ACCEPT-${proposalIdFor(proposal) || "proposal"}`),
    status: asString(input.status ?? latestApproval.decision ?? proposal.approvalState, "APPROVED"),
    acceptedProposalId: proposalIdFor(proposal),
    acceptedAt: input.acceptedAt ?? proposal.approvedAt ?? latestApproval.createdAt ?? nowIso(),
    acceptedBy: asString(input.acceptedBy ?? latestApproval.approver, "Customer Acceptance"),
  };
}

function createServiceOrder({ proposal, certifiedPackage, customerAcceptance, commercialTerms, user }) {
  const timestamp = nowIso();
  const proposalId = proposalIdFor(proposal);
  const certifiedPackageId = certifiedIdFor(certifiedPackage);
  const customer = customerSummaryFrom(proposal, certifiedPackage);
  const serviceOrderId = `SOF-${proposalId || certifiedPackageId || createId("service-order")}`;
  return {
    serviceOrderId,
    serviceOrderNumber: serviceOrderId,
    objectType: "SERVICE_ORDER_FORM",
    authority: "COMMERCIAL_AUTHORIZATION",
    constitutionalRole: "Service Order is commercial authorization. It is not the Order for Execution.",
    lifecycleState: "SERVICE_ORDER_GENERATED",
    status: "SERVICE_ORDER_GENERATED",
    authorizationStatus: "PENDING_CUSTOMER_SIGNATURE",
    signatureStatus: "NOT_READY_FOR_SIGNATURE",
    readyForSignature: false,
    customer,
    customerId: customer.customerId,
    customerName: customer.customerName,
    accountId: customer.accountId,
    opportunityId: customer.opportunityId,
    proposalId,
    proposalNumber: proposal.proposalNumber ?? proposalId,
    acceptedProposalId: proposalId,
    acceptedProposalRevision: proposal.version ?? proposal.revision ?? 1,
    customerAcceptance,
    customerAcceptanceId: customerAcceptance.customerAcceptanceId,
    certifiedDraftIofPackageId: asString(certifiedPackage.certifiedDraftIofPackageId ?? certifiedPackage.sourceDraftPackageId ?? certifiedPackage.sourcePackageId ?? certifiedPackage.packageId),
    draftIofPackageId: asString(certifiedPackage.sourceDraftPackageId ?? certifiedPackage.sourcePackageId ?? certifiedPackage.draftPackageId ?? certifiedPackage.packageId),
    draftIofPackageRevision: certifiedPackage.packageRevision ?? 1,
    engineeringCertificationId: certifiedPackageId,
    certifiedPackageId,
    futureScopeVersionId: "PENDING_RUNTIME_PROMOTION_AFTER_EXECUTED_SERVICE_ORDER",
    executionOrderReference: "FUTURE_SCOPEVERSION_ORDER_FOR_EXECUTION",
    product: {
      productId: asString(proposal.productId ?? certifiedPackage.productId),
      productName: asString(proposal.productName ?? certifiedPackage.productName, "Point-to-Point Duct and Dark Fiber Construction"),
      doctrineId: asString(certifiedPackage.doctrineId, "PD-001"),
      doctrineVersion: asString(certifiedPackage.productDoctrineVersion ?? certifiedPackage.doctrineVersion),
    },
    routeSummary: routeSummaryFrom(certifiedPackage, proposal),
    pricingSummary: pricingSummaryFrom(proposal, certifiedPackage),
    objectSummary: objectSummaryFrom(certifiedPackage),
    scheduleSummary: scheduleSummaryFrom(proposal, certifiedPackage),
    assumptions: asArray(proposal.commercialAssumptions ?? proposal.commercialAssumptionIds ?? certifiedPackage.commercialNotes),
    commercialTerms: {
      status: "COMMERCIAL_RELEASE_1_PLACEHOLDER",
      ...asRecord(commercialTerms),
    },
    legalPlaceholders: legalPlaceholders(),
    sourceReferences: {
      certifiedDraftIofPackageId: asString(certifiedPackage.certifiedDraftIofPackageId ?? certifiedPackage.sourcePackageId),
      certifiedPackageId,
      proposalId,
      customerAcceptanceId: customerAcceptance.customerAcceptanceId,
      singleEngineeringTruth: true,
    },
    runtimePromotion: {
      scopeVersionCreationAllowed: false,
      requiredTrigger: "EXECUTED_SERVICE_ORDER",
      nextCip: "CIP-014",
      noSignedServiceOrderNoScopeVersion: true,
      noScopeVersionNoExecution: true,
    },
    signature: {
      status: "PENDING_READY_FOR_SIGNATURE",
      placeholderOnly: true,
      notExecutionTrigger: true,
    },
    noScopeVersionCreation: true,
    noEngineeringRecreation: true,
    noEngineeringObjectsPersisted: true,
    noMarketplaceCreation: true,
    noControlCreation: true,
    noFieldCreation: true,
    noTwinCreation: true,
    createdBy: user.name,
    createdById: user.userId,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

async function resolveProposal(body) {
  const embedded = asRecord(body.proposal ?? body.acceptedProposal);
  const id = asString(body.proposalId ?? embedded.proposalId ?? embedded.proposalRecordId);
  if (Object.keys(embedded).length) return embedded;
  if (!id) return null;
  return loadRecord(DIRS.proposalDrafts, id).catch(() => null);
}

async function resolveCertifiedPackage(body) {
  const embedded = asRecord(body.certifiedPackage ?? body.certifiedIofPackage ?? body.certifiedDraftIofPackage);
  const id = asString(body.certifiedPackageId ?? body.certifiedIofPackageId ?? body.engineeringCertificationId ?? embedded.certifiedPackageId ?? embedded.packageId);
  if (Object.keys(embedded).length) return embedded;
  if (!id) return null;
  return loadRecord(DIRS.certifiedIofPackages, id).catch(() => null);
}

async function handleGenerate(req, res, user) {
  const body = unwrapBody(await readRequestJson(req), "serviceOrder", ["payload", "data"]);
  const proposal = await resolveProposal(body);
  const certifiedPackage = await resolveCertifiedPackage(body);
  const customerAcceptance = normalizeCustomerAcceptance(proposal ?? {}, asRecord(body.customerAcceptance));
  if (!proposal) {
    errorResponse(res, 409, "Accepted Proposal is required before Service Order generation.");
    return;
  }
  if (!isAcceptedProposal(proposal, customerAcceptance)) {
    errorResponse(res, 409, "Customer Acceptance is required before Service Order generation.");
    return;
  }
  if (!certifiedPackage || asString(certifiedPackage.status).toUpperCase() !== "CERTIFIED") {
    errorResponse(res, 409, "Certified Draft IOF Package is required before Service Order generation.");
    return;
  }
  const record = createServiceOrder({
    proposal,
    certifiedPackage,
    customerAcceptance,
    commercialTerms: body.commercialTerms,
    user,
  });
  const saved = await persistRecord(DIRS.serviceOrders, record.serviceOrderId, record);
  jsonResponse(res, 201, { serviceOrder: saved });
}

async function handleMarkReady(req, res, user, serviceOrderId) {
  const existing = await loadRecord(DIRS.serviceOrders, serviceOrderId).catch(() => null);
  if (!existing) {
    errorResponse(res, 404, `Service Order not found: ${serviceOrderId}`);
    return;
  }
  const timestamp = nowIso();
  const next = {
    ...existing,
    status: "SIGNATURE_READY_SERVICE_ORDER",
    authorizationStatus: "PENDING_CUSTOMER_SIGNATURE",
    signatureStatus: "READY_FOR_SIGNATURE",
    readyForSignature: true,
    readyForSignatureAt: timestamp,
    readyForSignatureBy: user.name,
    signature: {
      ...asRecord(existing.signature),
      status: "READY_FOR_SIGNATURE",
      placeholderOnly: true,
      notExecutionTrigger: true,
    },
    updatedAt: timestamp,
  };
  jsonResponse(res, 200, { serviceOrder: await persistRecord(DIRS.serviceOrders, serviceOrderId, next) });
}

async function handleRecordSignaturePlaceholder(req, res, user, serviceOrderId) {
  const existing = await loadRecord(DIRS.serviceOrders, serviceOrderId).catch(() => null);
  if (!existing) {
    errorResponse(res, 404, `Service Order not found: ${serviceOrderId}`);
    return;
  }
  const body = await readRequestJson(req);
  const timestamp = nowIso();
  const next = {
    ...existing,
    status: "SIGNATURE_PLACEHOLDER_CAPTURED",
    authorizationStatus: "PENDING_EXECUTED_SERVICE_ORDER",
    signatureStatus: "PLACEHOLDER_ONLY_NOT_EXECUTED",
    signature: {
      ...asRecord(existing.signature),
      placeholderId: asString(body.placeholderId, createId("service-order-signature-placeholder")),
      status: "PLACEHOLDER_ONLY_NOT_EXECUTED",
      recordedBy: user.name,
      recordedById: user.userId,
      recordedAt: timestamp,
      placeholderOnly: true,
      notExecutionTrigger: true,
      note: asString(body.note, "Signature capture placeholder recorded. Executed Service Order authority is not present in CIP-013A."),
    },
    runtimePromotion: {
      ...asRecord(existing.runtimePromotion),
      scopeVersionCreationAllowed: false,
      blockedReason: "Executed Service Order not recorded by CIP-013A placeholder.",
      nextCip: "CIP-014",
    },
    updatedAt: timestamp,
  };
  jsonResponse(res, 200, { serviceOrder: await persistRecord(DIRS.serviceOrders, serviceOrderId, next) });
}

export async function handleServiceOrders(req, res, pathname) {
  const match = routeMatch(pathname, BASE_PATH);
  if (!match) return false;
  if (handleOptions(req, res)) return true;

  const readOnly = req.method === "GET";
  const user = readOnly
    ? requireAnyPermission(req, res, ["workspace.commercial", "workspace.proposal", "proposal.read", "proposal.manage"], "You do not have authority to read Service Orders.")
    : requireAnyPermission(req, res, ["workspace.commercial", "workspace.proposal", "proposal.manage"], "Only Commercial may generate Service Orders.");
  if (!user) return true;

  if (match.base && req.method === "GET") {
    jsonResponse(res, 200, { serviceOrders: sortedByUpdated(await listRecords(DIRS.serviceOrders)) });
    return true;
  }

  if (!match.base && req.method === "GET") {
    const serviceOrder = await loadRecord(DIRS.serviceOrders, match.id).catch(() => null);
    if (!serviceOrder) errorResponse(res, 404, `Service Order not found: ${match.id}`);
    else jsonResponse(res, 200, { serviceOrder });
    return true;
  }

  if (match.base && req.method === "POST") {
    await handleGenerate(req, res, user);
    return true;
  }

  if (!match.base && req.method === "POST" && match.action === "mark-ready-signature") {
    await handleMarkReady(req, res, user, match.id);
    return true;
  }

  if (!match.base && req.method === "POST" && match.action === "record-signature-placeholder") {
    await handleRecordSignaturePlaceholder(req, res, user, match.id);
    return true;
  }

  errorResponse(res, 405, "Service Order method not allowed.");
  return true;
}
