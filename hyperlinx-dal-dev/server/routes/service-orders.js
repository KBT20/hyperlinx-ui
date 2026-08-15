import { createHash } from "node:crypto";
import {
  DIRS, deleteRecord, errorResponse, handleOptions, hydrateIofProjectionArtifacts, jsonResponse,
  listRecords, loadRecord, nowIso, persistRecord, readRequestJson, routeMatch, sortedByUpdated, unwrapBody,
} from "./_shared.js";
import { requireAnyPermission } from "./authority.js";
import { createScopeVersionFromCertifiedPackage } from "../scopeversion-authority-engine.js";
import { persistScopeVersion } from "./scopeversions.js";
import { materializeAuthorizedIofTwin } from "./twin-state.js";

const BASE_PATH = "/api/service-orders";

const record = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const array = (value) => Array.isArray(value) ? value : value == null || value === "" ? [] : [value];
const text = (value, fallback = "") => typeof value === "string" && value.trim() ? value.trim() : fallback;
const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const positive = (...values) => values.map(Number).find((value) => Number.isFinite(value) && value > 0) ?? 0;
const idPart = (value) => String(value ?? "UNKNOWN").replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120);
const sorted = (value) => Array.isArray(value) ? value.map(sorted) : value && typeof value === "object"
  ? Object.keys(value).sort().reduce((out, key) => ({ ...out, [key]: sorted(value[key]) }), {}) : value;
const hash = (value) => createHash("sha256").update(JSON.stringify(sorted(value))).digest("hex");

function proposalId(value = {}) { return text(value.proposalId ?? value.proposalRecordId ?? value.acceptedProposalId); }
function certifiedId(value = {}) { return text(value.certifiedPackageId ?? value.certifiedIofPackageId ?? value.packageId); }

async function proposalFor(body) {
  const embedded = record(body.proposal ?? body.acceptedProposal);
  if (Object.keys(embedded).length) return embedded;
  const id = text(body.proposalId);
  return id ? loadRecord(DIRS.proposalDrafts, id).catch(() => null) : null;
}

async function certifiedFor(body) {
  const embedded = record(body.certifiedPackage ?? body.certifiedIofPackage);
  if (Object.keys(embedded).length) return embedded;
  const id = text(body.certifiedPackageId ?? body.certifiedIofPackageId);
  return id ? loadRecord(DIRS.certifiedIofPackages, id).catch(() => null) : null;
}

function acceptedProposal(proposal = {}) {
  const approval = array(proposal.approvals).at(-1) ?? {};
  const state = text(proposal.approvalState ?? approval.decision ?? proposal.status).toUpperCase();
  return ["APPROVED", "ACCEPTED", "CUSTOMER_APPROVED", "CUSTOMER_ACCEPTED", "READY_FOR_IOF_PACKAGE", "ENGINEERING_SUBMITTED"].includes(state)
    || Boolean(proposal.approvedAt ?? approval.createdAt);
}

function acceptanceFor(proposal = {}) {
  const approval = array(proposal.approvals).at(-1) ?? {};
  return {
    customerAcceptanceId: text(approval.approvalId, `CUSTOMER-ACCEPTANCE-${proposalId(proposal)}`),
    acceptedProposalId: proposalId(proposal),
    status: "ACCEPTED",
    acceptedAt: proposal.approvedAt ?? approval.createdAt ?? proposal.updatedAt,
    evidenceSource: "ACCEPTED_PROPOSAL",
  };
}

function pricingFor(proposal = {}) {
  const customerFacing = record(record(proposal.proposalContent).customerFacingPricing);
  const pricing = record(proposal.pricingSummary);
  const commercialTerms = record(proposal.commercialTerms);
  const estimate = record(proposal.transparentEstimate);
  return {
    currency: text(customerFacing.currency ?? commercialTerms.currency ?? pricing.currency, "USD"),
    nonRecurringCharge: number(customerFacing.nrc ?? commercialTerms.nrc ?? estimate.nrc ?? pricing.nrcRevenue ?? pricing.sellPriceIru, 0),
    monthlyRecurringCharge: number(customerFacing.monthlyOm ?? commercialTerms.monthlyOm ?? pricing.mrcRevenue, 0),
    termMonths: number(customerFacing.termMonths ?? commercialTerms.termMonths ?? pricing.termMonths, 0),
  };
}

function routeFor(certified = {}, proposal = {}) {
  const commercial = record(certified.commercialSummary);
  const measured = record(certified.measuredSpine);
  const quantities = record(proposal.constructionQuantities ?? record(proposal.transparentEstimate).physicalQuantities);
  const feet = positive(commercial.routeFeet, measured.routeLengthFeet, quantities.routeFeet, proposal.routeFeet);
  return {
    routeRepositoryId: text(certified.routeRepositoryId), routeRevision: number(certified.routeRevision, 1),
    routeGeometryId: text(certified.routeGeometryId), geometryHash: text(certified.geometryHash),
    routeFeet: feet, routeMiles: positive(commercial.routeMiles, measured.routeLengthMiles, quantities.routeMiles, feet / 5280),
    endpointA: certified.endpointA ?? commercial.endpointA ?? proposal.endpointA ?? null,
    endpointZ: certified.endpointZ ?? commercial.endpointZ ?? proposal.endpointZ ?? null,
  };
}

function termsFor(input = {}) {
  return {
    paymentTerms: text(input.paymentTerms, "Net 30 from invoice date"),
    serviceTermMonths: number(input.serviceTermMonths, 240),
    pricingValidityDays: number(input.pricingValidityDays, 30),
    changeControl: text(input.changeControl, "Material changes require a new Service Order revision and signatures."),
    governingTerms: text(input.governingTerms, "Teralinx master service terms and this Service Order."),
  };
}

function documentBasis({ proposal, certified, revision, terms }) {
  const customerName = text(proposal.customerName ?? record(proposal.executiveSummary).customer ?? certified.customerName, "Customer");
  const route = routeFor(certified, proposal);
  const pricing = pricingFor(proposal);
  return {
    documentType: "TERALINX_SERVICE_ORDER",
    documentRevision: revision,
    title: `${customerName} — ${text(proposal.title, "Network Service Order")}`,
    parties: { customer: { customerId: text(proposal.customerId ?? certified.customerId), accountId: text(proposal.accountId ?? certified.accountId), name: customerName }, provider: { name: "Teralinx", role: "Provider" } },
    serviceDescription: { productId: text(proposal.productId ?? certified.productId), productName: text(proposal.productName ?? certified.productName, "Point-to-Point Fiber Infrastructure"), opportunityId: text(proposal.opportunityId ?? certified.opportunityId) },
    route, pricing, schedule: record(proposal.scheduleSummary ?? proposal.deliverySummary),
    assumptions: array(proposal.commercialAssumptions ?? certified.commercialNotes),
    terms,
    certifiedTechnicalBasis: {
      certifiedIofPackageId: certifiedId(certified), certificationLedgerId: text(certified.certificationLedgerId),
      certificationHash: text(certified.certificationHash), certifiedPackageHash: text(certified.certifiedPackageHash),
      engineeringRevisionId: text(certified.engineeringRevisionId), engineeringRevisionHash: text(certified.engineeringRevisionHash),
      engineeringApprovalId: text(certified.engineeringApprovalId), engineeringApprovalHash: text(certified.engineeringApprovalHash),
      draftIofPackageId: text(certified.sourceDraftPackageId ?? certified.certifiedDraftIofPackageId),
    },
    acceptedCommercialBasis: { proposalId: proposalId(proposal), proposalRevisionId: text(proposal.proposalRevisionId), commercialRevisionId: text(proposal.commercialRevisionId), customerAcceptance: acceptanceFor(proposal) },
  };
}

function createServiceOrder(proposal, certified, commercialTerms, user, revision = 1) {
  const basis = documentBasis({ proposal, certified, revision, terms: termsFor(commercialTerms) });
  const serviceOrderId = `SO-${idPart(proposalId(proposal))}-R${String(revision).padStart(3, "0")}`;
  const timestamp = nowIso();
  return {
    serviceOrderId, serviceOrderNumber: serviceOrderId, objectType: "SERVICE_ORDER", documentRevision: revision,
    status: "DRAFT", lifecycleState: "DRAFT", authorizationStatus: "NOT_AUTHORIZED", signatureStatus: "NOT_SIGNED",
    referenceOnly: true, immutableWhenIssued: true, documentBasis: basis,
    documentHash: hash(basis), commercialTermsHash: hash(basis.terms),
    customer: basis.parties.customer, customerId: basis.parties.customer.customerId, accountId: basis.parties.customer.accountId,
    authorizedCustomerSignerUserIds: array(proposal.assignedCustomerUsers),
    opportunityId: basis.serviceDescription.opportunityId, proposalId: proposalId(proposal), customerAcceptance: basis.acceptedCommercialBasis.customerAcceptance,
    customerAcceptanceId: basis.acceptedCommercialBasis.customerAcceptance.customerAcceptanceId,
    certifiedPackageId: certifiedId(certified), certifiedDraftIofPackageId: basis.certifiedTechnicalBasis.draftIofPackageId,
    serviceDescription: basis.serviceDescription, routeSummary: basis.route, pricingSummary: basis.pricing, scheduleSummary: basis.schedule,
    assumptions: basis.assumptions, commercialTerms: basis.terms, technicalBasis: basis.certifiedTechnicalBasis,
    executionAuthority: { scopeVersionCreationAllowed: false, requiredEvent: "AUTHORIZED_TERALINX_COUNTERSIGNATURE", customerSignatureAloneIsNotExecutionAuthority: true },
    noMarketplaceCreation: true, noControlCreation: true, noFieldCreation: true,
    createdBy: user.name, createdById: user.userId,
    createdByPrincipalId: user.principalId ?? user.userId, createdByMembershipId: user.membershipId,
    createdBySessionId: user.sessionId, actorDisplayNameAtAction: user.displayName ?? user.name,
    organizationId: user.organizationId, createdAt: timestamp, updatedAt: timestamp,
  };
}

function verifyDocument(order) {
  if (hash(order.documentBasis) !== order.documentHash || hash(record(order.documentBasis).terms) !== order.commercialTermsHash) {
    const error = new Error("Service Order document or commercial terms hash no longer matches its immutable revision.");
    error.status = 409; throw error;
  }
}

async function generate(req, res, user) {
  const body = unwrapBody(await readRequestJson(req), "serviceOrder", ["payload", "data"]);
  const proposal = await proposalFor(body); const certified = await certifiedFor(body);
  if (!proposal || !acceptedProposal(proposal)) return errorResponse(res, 409, "An accepted Proposal is required.");
  if (!certified || text(certified.status).toUpperCase() !== "CERTIFIED") return errorResponse(res, 409, "The exact Certified IOF Package is required.");
  const revision = 1;
  const candidate = createServiceOrder(proposal, certified, body.commercialTerms, user, revision);
  const existing = await loadRecord(DIRS.serviceOrders, candidate.serviceOrderId).catch(() => null);
  if (existing) {
    if (existing.documentHash !== candidate.documentHash && existing.status === "DRAFT") {
      const correctedDraft = { ...candidate, createdAt: existing.createdAt, createdBy: existing.createdBy, createdById: existing.createdById, updatedAt: nowIso() };
      return jsonResponse(res, 200, { serviceOrder: await persistRecord(DIRS.serviceOrders, candidate.serviceOrderId, correctedDraft), draftNormalized: true });
    }
    if (existing.documentHash !== candidate.documentHash) return errorResponse(res, 409, "Service Order revision 1 already exists with a different document. Create a new revision.");
    return jsonResponse(res, 200, { serviceOrder: existing, idempotentReplay: true });
  }
  return jsonResponse(res, 201, { serviceOrder: await persistRecord(DIRS.serviceOrders, candidate.serviceOrderId, candidate) });
}

async function issue(req, res, user, id) {
  const order = await loadRecord(DIRS.serviceOrders, id).catch(() => null);
  if (!order) return errorResponse(res, 404, `Service Order not found: ${id}`);
  verifyDocument(order);
  if (order.status === "ISSUED" || order.status === "CUSTOMER_ACCEPTED" || order.status === "COUNTERSIGNED") return jsonResponse(res, 200, { serviceOrder: order, idempotentReplay: true });
  if (order.status !== "DRAFT") return errorResponse(res, 409, "Only a Draft Service Order may be issued.");
  const timestamp = nowIso();
  const next = { ...order, status: "ISSUED", lifecycleState: "ISSUED", authorizationStatus: "PENDING_CUSTOMER_SIGNATURE", signatureStatus: "AWAITING_CUSTOMER_SIGNATURE", issuedAt: timestamp, issuedBy: user.name, issuedById: user.userId, issuedByPrincipalId: user.principalId ?? user.userId, issuedByMembershipId: user.membershipId, issuedBySessionId: user.sessionId, updatedAt: timestamp };
  return jsonResponse(res, 200, { serviceOrder: await persistRecord(DIRS.serviceOrders, id, next) });
}

async function signAsCustomer(req, res, user, id) {
  const order = await loadRecord(DIRS.serviceOrders, id).catch(() => null);
  if (!order) return errorResponse(res, 404, `Service Order not found: ${id}`);
  verifyDocument(order);
  if (order.customerSignatureId) {
    const evidence = await loadRecord(DIRS.customerSignatures, order.customerSignatureId).catch(() => null);
    return jsonResponse(res, 200, { serviceOrder: order, customerSignature: evidence, idempotentReplay: true });
  }
  if (order.status !== "ISSUED") return errorResponse(res, 409, "Only an issued Service Order may be signed by the customer.");
  const body = await readRequestJson(req);
  const authorizedSignerIds = array(order.authorizedCustomerSignerUserIds).map(String);
  const customerAffiliated = authorizedSignerIds.includes(String(user.userId)) || (user.customerId && String(user.customerId) === String(order.customerId));
  if (!customerAffiliated) return errorResponse(res, 403, "The authenticated user is not an authorized customer signer assigned to this Proposal.");
  if (body.documentHash && body.documentHash !== order.documentHash) return errorResponse(res, 409, "Customer signature references a different Service Order document hash.");
  if (body.authorityAcknowledged !== true || text(body.typedName) !== text(user.name)) return errorResponse(res, 409, "Explicit signer-authority acknowledgment and the authenticated signer's exact name are required.");
  const timestamp = nowIso();
  const evidenceBasis = { serviceOrderId: id, documentRevision: order.documentRevision, documentHash: order.documentHash, commercialTermsHash: order.commercialTermsHash, signerUserId: user.userId, signedByPrincipalId: user.principalId ?? user.userId, signedByMembershipId: user.membershipId, signedBySessionId: user.sessionId, signerName: user.name, actorDisplayNameAtAction: user.displayName ?? user.name, signerRole: user.role, organizationId: user.organizationId, authorityAcknowledged: true, signedAt: timestamp };
  const signatureHash = hash(evidenceBasis);
  const customerSignatureId = `CUSTOMER-SIGNATURE-${id}-${signatureHash.slice(0, 16)}`;
  const evidence = { customerSignatureId, objectType: "CUSTOMER_DIGITAL_SIGNATURE_EVIDENCE", status: "ACCEPTED", immutable: true, ...evidenceBasis, signatureHash, authenticatedIdentity: true, createdAt: timestamp };
  await persistRecord(DIRS.customerSignatures, customerSignatureId, evidence);
  const next = { ...order, status: "CUSTOMER_ACCEPTED", lifecycleState: "CUSTOMER_ACCEPTED", authorizationStatus: "PENDING_TERALINX_COUNTERSIGNATURE", signatureStatus: "CUSTOMER_SIGNED", customerSignatureId, serviceOrderSignatureId: customerSignatureId, customerSignedAt: timestamp, signedAt: timestamp, signedBy: user.name, signedById: user.userId, customerSignatureHash: signatureHash, executionAuthority: { ...order.executionAuthority, scopeVersionCreationAllowed: false }, updatedAt: timestamp };
  return jsonResponse(res, 200, { serviceOrder: await persistRecord(DIRS.serviceOrders, id, next), customerSignature: evidence });
}

async function promotionPackage(certified) {
  const sourceId = text(certified.sourcePackageId ?? certified.sourceDraftPackageId ?? certified.certifiedDraftIofPackageId);
  const source = sourceId ? await hydrateIofProjectionArtifacts(await loadRecord(DIRS.iofPackages, sourceId).catch(() => null)) : null;
  const routeRepositoryId = text(certified.routeRepositoryId ?? source?.routeRepositoryId);
  const route = routeRepositoryId ? await loadRecord(DIRS.commercialRoutes, routeRepositoryId).catch(() => null) : null;
  const coordinates = array(route?.commercialGeometry);
  return {
    ...(source ?? {}), ...certified, routeRepositoryId,
    centerlineRoute: { ...record(source?.centerlineRoute), routeId: text(route?.routeId, routeRepositoryId), routeFeet: number(route?.routeFeet ?? source?.routeFeet), routeMiles: number(route?.routeMiles ?? source?.routeMiles), coordinates: coordinates.length ? coordinates : record(source?.centerlineRoute).coordinates },
    osrmRoute: { ...record(source?.osrmRoute), routeId: text(route?.routeId, routeRepositoryId), routeFeet: number(route?.routeFeet ?? source?.routeFeet), routeMiles: number(route?.routeMiles ?? source?.routeMiles), coordinates: coordinates.length ? coordinates : record(source?.osrmRoute).coordinates },
    quantitySummary: { ...record(source?.quantitySummary), routeFeet: number(route?.routeFeet ?? record(source?.quantitySummary).routeFeet), routeMiles: number(route?.routeMiles ?? record(source?.quantitySummary).routeMiles) },
    commercialSummary: { ...record(source?.commercialSummary), ...record(certified.commercialSummary), routeFeet: number(route?.routeFeet ?? record(source?.commercialSummary).routeFeet), routeMiles: number(route?.routeMiles ?? record(source?.commercialSummary).routeMiles) },
  };
}

async function countersign(req, res, user, id) {
  const permissions = array(user.permissions).map(String);
  if (!permissions.some((permission) => ["platform.admin", "scopeversion.authority"].includes(permission)) || String(user.participantType ?? "").toUpperCase() === "CUSTOMER") {
    return errorResponse(res, 403, "Only an authenticated Teralinx ScopeVersion authority may countersign and authorize execution.");
  }
  const order = await loadRecord(DIRS.serviceOrders, id).catch(() => null);
  if (!order) return errorResponse(res, 404, `Service Order not found: ${id}`);
  verifyDocument(order);
  const body = await readRequestJson(req);
  if (body.authorizationAcknowledged !== true || text(body.documentHash) !== order.documentHash) return errorResponse(res, 409, "Explicit Teralinx authorization acknowledgment and the exact document hash are required.");
  const transactionId = `COMMERCIAL-AUTHORIZATION-${id}-${order.documentHash.slice(0, 16)}`;
  const committed = await loadRecord(DIRS.commercialAuthorizationTransactions, transactionId).catch(() => null);
  if (committed?.state === "COMMITTED") {
    const [serviceOrder, scopeVersion, authorizedTwin] = await Promise.all([loadRecord(DIRS.serviceOrders, id), loadRecord(DIRS.scopeVersions, committed.scopeVersionId), loadRecord(DIRS.iofPackageTwins, committed.authorizedTwinStateId)]);
    return jsonResponse(res, 200, { serviceOrder, scopeVersion, authorizedTwin, transaction: committed, idempotentReplay: true });
  }
  if (order.status !== "CUSTOMER_ACCEPTED" || !order.customerSignatureId) return errorResponse(res, 409, "Customer acceptance evidence is required before Teralinx countersignature.");
  const signature = await loadRecord(DIRS.customerSignatures, order.customerSignatureId).catch(() => null);
  const certified = await loadRecord(DIRS.certifiedIofPackages, order.certifiedPackageId).catch(() => null);
  const ledger = certified?.certificationLedgerId ? await loadRecord(DIRS.certificationLedgers, certified.certificationLedgerId).catch(() => null) : null;
  if (!signature || signature.documentHash !== order.documentHash || signature.signatureHash !== order.customerSignatureHash) return errorResponse(res, 409, "Customer signature evidence is missing or does not match the issued revision.");
  if (!certified || certified.status !== "CERTIFIED" || !ledger || ledger.certificationHash !== certified.certificationHash) return errorResponse(res, 409, "Certified IOF Package or Certification Ledger integrity failed.");
  const twins = (await listRecords(DIRS.iofPackageTwins)).filter((item) => item.certifiedIofPackageId === certified.certifiedPackageId && item.twinState === "CERTIFIED").sort((a,b) => Number(b.stateRevision)-Number(a.stateRevision));
  const certifiedTwin = twins[0];
  if (!certifiedTwin || certifiedTwin.certificationHash !== certified.certificationHash) return errorResponse(res, 409, "The exact Certified IOF Twin is unavailable.");
  const timestamp = nowIso();
  const countersignBasis = { serviceOrderId: id, documentRevision: order.documentRevision, documentHash: order.documentHash, commercialTermsHash: order.commercialTermsHash, customerSignatureId: signature.customerSignatureId, customerSignatureHash: signature.signatureHash, certifiedIofPackageId: certified.certifiedPackageId, certificationHash: certified.certificationHash, countersignedById: user.userId, countersignedByPrincipalId: user.principalId ?? user.userId, countersignedByMembershipId: user.membershipId, countersignedBySessionId: user.sessionId, countersignedBy: user.name, actorDisplayNameAtAction: user.displayName ?? user.name, organizationId: user.organizationId, countersignedAt: timestamp };
  const countersignatureHash = hash(countersignBasis);
  const countersignatureId = `TERALINX-COUNTERSIGNATURE-${id}-${countersignatureHash.slice(0,16)}`;
  const countersignature = { countersignatureId, objectType: "TERALINX_AUTHORIZATION_COUNTERSIGNATURE", status: "AUTHORIZED", immutable: true, ...countersignBasis, countersignatureHash, authority: "SCOPEVERSION_CREATION_EVENT", createdAt: timestamp };
  const packageForPromotion = await promotionPackage(certified);
  const executableOrder = { ...order, status: "COUNTERSIGNED", authorizationStatus: "AUTHORIZED", countersignatureId, serviceOrderSignatureId: signature.customerSignatureId };
  let scopeVersion;
  try {
    scopeVersion = createScopeVersionFromCertifiedPackage(packageForPromotion, { certificate: { certificateId: countersignatureId }, user, customerAcceptance: order.customerAcceptance, serviceOrder: executableOrder, approvedBy: user.name, approvedTimestamp: timestamp, createdAt: timestamp });
  } catch (error) { return errorResponse(res, error.status ?? 409, error.message); }
  const collision = await loadRecord(DIRS.scopeVersions, scopeVersion.scopeVersionId).catch(() => null);
  if (collision) return errorResponse(res, 409, `ScopeVersion collision: ${scopeVersion.scopeVersionId}`);
  const transaction = { transactionId, objectType: "COMMERCIAL_AUTHORIZATION_TRANSACTION", state: "PREVALIDATED", serviceOrderId: id, documentHash: order.documentHash, customerSignatureId: signature.customerSignatureId, countersignatureId, certifiedIofPackageId: certified.certifiedPackageId, certificationHash: certified.certificationHash, scopeVersionId: scopeVersion.scopeVersionId, atomic: true, startedAt: timestamp, updatedAt: timestamp };
  const written = [];
  try {
    await persistRecord(DIRS.teralinxCountersignatures, countersignatureId, countersignature); written.push([DIRS.teralinxCountersignatures, countersignatureId]);
    await persistScopeVersion(scopeVersion); written.push([DIRS.scopeVersions, scopeVersion.scopeVersionId]);
    const twin = await materializeAuthorizedIofTwin({ certifiedTwin, serviceOrder: executableOrder, customerSignature: signature, countersignature, scopeVersion, transaction, timestamp }); written.push([DIRS.iofPackageTwins, twin.twinStateId]);
    const finalOrder = { ...executableOrder, lifecycleState: "COUNTERSIGNED", signatureStatus: "FULLY_SIGNED", countersignatureHash, countersignedAt: timestamp, countersignedBy: user.name, countersignedById: user.userId, scopeVersionId: scopeVersion.scopeVersionId, authorizedTwinStateId: twin.twinStateId, commercialAuthorizationTransactionId: transactionId, executionAuthority: { ...order.executionAuthority, scopeVersionCreationAllowed: true, authorityEvent: countersignatureId }, updatedAt: timestamp };
    await persistRecord(DIRS.serviceOrders, id, finalOrder);
    const committedTransaction = { ...transaction, state: "COMMITTED", authorizedTwinStateId: twin.twinStateId, committedAt: nowIso(), updatedAt: nowIso() };
    await persistRecord(DIRS.commercialAuthorizationTransactions, transactionId, committedTransaction); written.push([DIRS.commercialAuthorizationTransactions, transactionId]);
    return jsonResponse(res, 200, { serviceOrder: finalOrder, customerSignature: signature, countersignature, scopeVersion, authorizedTwin: twin, transaction: committedTransaction });
  } catch (error) {
    for (const [dir, artifactId] of written.reverse()) await deleteRecord(dir, artifactId).catch(() => undefined);
    await persistRecord(DIRS.serviceOrders, id, order).catch(() => undefined);
    return errorResponse(res, 500, `Commercial authorization failed closed and was rolled back: ${error.message}`);
  }
}

export async function handleServiceOrders(req, res, pathname) {
  const match = routeMatch(pathname, BASE_PATH); if (!match) return false;
  if (handleOptions(req, res)) return true;
  const user = requireAnyPermission(req, res, req.method === "GET" ? ["workspace.commercial", "workspace.proposal", "proposal.read", "proposal.manage"] : ["workspace.commercial", "workspace.proposal", "proposal.manage"], "Commercial authority is required for Service Orders.");
  if (!user) return true;
  if (match.base && req.method === "GET") { jsonResponse(res, 200, { serviceOrders: sortedByUpdated(await listRecords(DIRS.serviceOrders)) }); return true; }
  if (!match.base && req.method === "GET") { const serviceOrder = await loadRecord(DIRS.serviceOrders, match.id).catch(() => null); serviceOrder ? jsonResponse(res, 200, { serviceOrder }) : errorResponse(res, 404, `Service Order not found: ${match.id}`); return true; }
  if (match.base && req.method === "POST") { await generate(req, res, user); return true; }
  if (!match.base && req.method === "POST" && ["issue", "mark-ready-signature"].includes(match.action)) { await issue(req, res, user, match.id); return true; }
  if (!match.base && req.method === "POST" && match.action === "record-signature") { await signAsCustomer(req, res, user, match.id); return true; }
  if (!match.base && req.method === "POST" && match.action === "countersign") { await countersign(req, res, user, match.id); return true; }
  errorResponse(res, 405, "Service Order method not allowed."); return true;
}
