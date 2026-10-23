import {
  DIRS, createId, currentRepositoryAuthority, errorResponse, handleOptions, jsonResponse, listRecords, loadRecord, nowIso,
  persistRecord, readRequestJson, routeMatch, sortedByUpdated, withRepositoryAuthority,
} from "./_shared.js";
import { deriveArtifactStates } from "./customer-account-twin.js";
import { requireRuntimeUser } from "./authority.js";
import { authQuery, withAuthTransaction } from "../auth/postgres.js";
import { hashPassword } from "../auth/password.js";
import { consumeInvitation, validateEnrollmentIdentity, projectEnrollment, validateEnrollmentAccess } from "../auth/invitation-consumption.js";
import { withInvitationAdministration } from '../auth/invitation-administration.js';
import { refreshDurableDirectory } from "./auth.js";
import {
  CUSTOMER_ORGANIZATIONS, customerProjectAccessRecords, invitationByToken,
} from "./customer-portal-authority.js";
import { handleApprove, handleReject, handleRequestChanges } from "./proposal-drafts.js";
import {customerPreliminary,customerPreliminaryDecision,preliminaryDocument} from '../network-planning/iof-preliminary-proposal.js';
import { buildAccountCustomerTwin } from "./customer-account-twin.js";
import { resolveCanonicalCustomerIdentity } from "./customer-identity-authority.js";
import { resolveServiceOrderAuthoritySet } from "./service-order-supersession.js";
import {
  activeCustomerProjectGrants, customerDisclosureAuthority, customerGrantMatchesReviewPackage,
  customerVisibleCommercialTerms, customerVisibleDocumentReference, customerVisibleEndpoint,
  customerVisibleMajorQuantities, customerVisibleProduct, customerVisibleSchedule,
  customerVisibleServiceOrder,
} from "./customer-read-authority.js";

const BASE_PATH = "/api/customer-portal";
const CUSTOMER_PERSONAS = new Set([
  "CUSTOMER_VIEWER", "CUSTOMER_CONTRIBUTOR", "CUSTOMER_PLANNER", "CUSTOMER_ADMIN", "CUSTOMER_COMMERCIAL_REVIEWER", "CUSTOMER_AUTHORIZED_SIGNER",
]);
const REVIEW_PERSONAS = new Set(["CUSTOMER_COMMERCIAL_REVIEWER", "CUSTOMER_AUTHORIZED_SIGNER"]);
const text = (value) => String(value ?? "").trim();
const array = (value) => Array.isArray(value) ? value : value == null ? [] : [value];
const record = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const displayText = (value) => {
  if (typeof value === "string" || typeof value === "number") {
    const rendered = text(value);
    return rendered === "[object Object]" ? "" : rendered;
  }
  const source = record(value);
  for (const candidate of [source.text, source.summary, source.description, source.executiveSummary, source.title]) {
    if (typeof candidate === "string" || typeof candidate === "number") return text(candidate);
  }
  return "";
};

function demoRepositoryUser() {
  return { principalId: "customer-enrollment", organizationId: "org-demo", authorityClass: "DEMO", permissions: ["demo.tenant"] };
}

function portalContext(user) {
  const isDemoPersona = user?.principalId === "demo-principal" && user?.organizationId === "org-demo";
  const customerOrganizationId = isDemoPersona
    ? text(user.demoCustomerOrganizationId)
    : text(user.organizationId);
  const organization = CUSTOMER_ORGANIZATIONS[customerOrganizationId];
  const persona = isDemoPersona ? text(user.demoPersona) : text(array(user.roles)[0], text(user.role));
  if (!organization || !CUSTOMER_PERSONAS.has(persona)) {
    const error = new Error("The bounded Customer Portal requires an authorized customer role and customer organization.");
    error.status = 403;
    throw error;
  }
  return { isDemoPersona, customerOrganizationId, organization, persona };
}

function selectedPortalAuthority(req) {
  const url = new URL(req.url ?? BASE_PATH, `https://${req.headers.host ?? "runtime.invalid"}`);
  const selection = {
    environment: text(url.searchParams.get("environment")),
    organizationId: text(url.searchParams.get("organizationId")),
    tenantId: text(url.searchParams.get("tenantId")),
    accountId: text(url.searchParams.get("accountId")),
    opportunityId: text(url.searchParams.get("opportunityId")),
  };
  const supplied = Object.values(selection).some(Boolean);
  if (!supplied) return null;
  if (Object.values(selection).some((value) => !value)) {
    throw Object.assign(new Error("CUSTOMER_IDENTITY_AUTHORITY_REQUIRED: environment, organizationId, tenantId, accountId, and opportunityId must be supplied together."), { status: 409 });
  }
  const repository = currentRepositoryAuthority();
  if (selection.environment.toUpperCase() !== repository.authorityClass ||
      selection.organizationId !== repository.organizationId || selection.tenantId !== repository.organizationId) {
    throw Object.assign(new Error("CUSTOMER_IDENTITY_LINEAGE_MISMATCH: selected Customer Portal authority does not match repository authority."), { status: 409 });
  }
  return selection;
}

async function accessiblePackages(user, selection = null) {
  const context = portalContext(user);
  let packages = (await listRecords(DIRS.customerReviewPackages))
    .filter((item) => item.customerOrganizationId === context.customerOrganizationId && item.status !== "SUPERSEDED");
  if (selection) packages = packages.filter((item) =>
    text(item.accountId) === selection.accountId && text(item.opportunityId) === selection.opportunityId
  );
  if (context.isDemoPersona) return { context, packages };
  const access = activeCustomerProjectGrants(user, await customerProjectAccessRecords());
  return { context, packages: packages.filter((item) => access.some((grant) => customerGrantMatchesReviewPackage(grant, item))), access };
}

async function portalProjectIdentities(available) {
  if (!available.packages.length) {
    throw Object.assign(new Error("CUSTOMER_IDENTITY_AUTHORITY_REQUIRED: no exact governed customer project is assigned."), { status: 409 });
  }
  return Promise.all(available.packages.map((item) => resolveCanonicalCustomerIdentity({
    environment: currentRepositoryAuthority().authorityClass,
    organizationId: currentRepositoryAuthority().organizationId,
    accountId: item.accountId,
    customerId: item.customerId,
    opportunityId: item.opportunityId,
    customerOrganizationId: item.customerOrganizationId,
  })));
}

async function exactPortalProjectIdentity(available) {
  const identities = await portalProjectIdentities(available);
  if (identities.length !== 1) {
    throw Object.assign(new Error("CUSTOMER_PROJECT_SELECTION_REQUIRED: select one exact granted project."), { status: 409 });
  }
  return identities[0];
}

function exactRevisionMatches(reviewPackage, proposal, body = {}) {
  const requestedId = text(body.proposalRevisionId);
  const requestedHash = text(body.proposalHash);
  const route = record(reviewPackage.route);
  return Boolean(requestedId && requestedHash &&
    text(body.accountId) === text(reviewPackage.accountId) &&
    text(body.customerId) === text(reviewPackage.customerId) &&
    text(body.opportunityId) === text(reviewPackage.opportunityId) &&
    text(body.proposalId) === text(reviewPackage.proposalId) &&
    Number(body.proposalRevisionNumber) === Number(reviewPackage.proposalRevisionNumber) &&
    requestedId === reviewPackage.proposalRevisionId && requestedHash === reviewPackage.proposalHash &&
    text(body.routeRepositoryId) === text(route.routeRepositoryId) &&
    Number(body.routeRevision) === Number(route.routeRevision) &&
    text(body.routeGeometryId) === text(route.routeGeometryId) &&
    text(body.geometryHash) === text(route.geometryHash) &&
    requestedId === proposal.proposalRevisionId && requestedHash === proposal.proposalHash &&
    text(reviewPackage.accountId) === text(proposal.accountId) &&
    text(reviewPackage.customerId) === text(proposal.customerId) &&
    text(reviewPackage.opportunityId) === text(proposal.opportunityId) &&
    text(reviewPackage.proposalId) === text(proposal.proposalId) &&
    text(route.routeRepositoryId) === text(proposal.routeRepositoryId) &&
    Number(route.routeRevision) === Number(proposal.routeRevision) &&
    text(route.routeGeometryId) === text(proposal.routeGeometryId) &&
    text(route.geometryHash) === text(proposal.routeGeometryHash));
}

function safeStatus(proposal = {}, serviceOrder = {}, scopeVersion = {}) {
  if (scopeVersion?.scopeVersionId) return "AUTHORIZED";
  if (serviceOrder?.status) return text(serviceOrder.status);
  return text(proposal.status, "CUSTOMER_REVIEW");
}

function exactProposalEvidence(item, reviewPackage) {
  return Boolean(item && reviewPackage &&
    text(item.proposalRevisionId) === text(reviewPackage.proposalRevisionId) &&
    text(item.proposalHash) === text(reviewPackage.proposalHash));
}

function certifiedPackageMatchesProject(item, reviewPackage, engineeringPackage) {
  return Boolean(item && engineeringPackage &&
    text(item.proposalId) === text(reviewPackage.proposalId) &&
    text(item.opportunityId) === text(reviewPackage.opportunityId) &&
    text(item.accountId) === text(reviewPackage.accountId) &&
    text(item.certifiedDraftIofPackageId) === text(engineeringPackage.draftIOFPackageId) &&
    text(item.status).toUpperCase() === "CERTIFIED");
}

function serviceOrderMatchesProject(order, reviewPackage, certified) {
  const commercialBasis = record(record(order?.documentBasis).acceptedCommercialBasis);
  return Boolean(order && certified &&
    text(order.proposalId) === text(reviewPackage.proposalId) &&
    text(order.opportunityId) === text(reviewPackage.opportunityId) &&
    text(order.accountId) === text(reviewPackage.accountId) &&
    text(commercialBasis.proposalRevisionId) === text(reviewPackage.proposalRevisionId) &&
    text(order.certifiedPackageId) === text(certified.certifiedPackageId));
}

async function projectProjection(reviewPackage) {
  const identity = await resolveCanonicalCustomerIdentity({
    environment: currentRepositoryAuthority().authorityClass,
    organizationId: currentRepositoryAuthority().organizationId,
    accountId: reviewPackage.accountId,
    customerId: reviewPackage.customerId,
    opportunityId: reviewPackage.opportunityId,
    customerOrganizationId: reviewPackage.customerOrganizationId,
  });
  const proposal = await loadRecord(DIRS.proposalDrafts, reviewPackage.proposalId).catch(() => null);
  const route = reviewPackage.route?.routeRepositoryId
    ? await loadRecord(DIRS.commercialRoutes, reviewPackage.route.routeRepositoryId).catch(() => null)
    : null;
  const routeExact = Boolean(route &&
    text(route.routeRepositoryId) === text(reviewPackage.route?.routeRepositoryId) &&
    Number(route.routeRevision) === Number(reviewPackage.route?.routeRevision) &&
    text(route.routeGeometryId) === text(reviewPackage.route?.routeGeometryId) &&
    text(route.geometryHash) === text(reviewPackage.route?.geometryHash));
  if (!routeExact) throw Object.assign(new Error("CUSTOMER_PROJECT_ROUTE_LINEAGE_MISMATCH"), { status: 409 });
  const serviceOrders = (await listRecords(DIRS.serviceOrders)).filter((item) => {
    const commercialBasis = record(record(item?.documentBasis).acceptedCommercialBasis);
    return text(item.proposalId) === text(reviewPackage.proposalId) && text(item.opportunityId) === text(reviewPackage.opportunityId) &&
      text(item.accountId) === text(reviewPackage.accountId) && text(commercialBasis.proposalRevisionId) === text(reviewPackage.proposalRevisionId);
  });
  const serviceOrderAuthority = await resolveServiceOrderAuthoritySet({
    accountId: reviewPackage.accountId,
    customerId: reviewPackage.customerId,
    opportunityId: reviewPackage.opportunityId,
    proposalId: reviewPackage.proposalId,
    proposalRevisionId: reviewPackage.proposalRevisionId,
    proposalHash: reviewPackage.proposalHash,
  }, { orders: serviceOrders });
  const serviceOrder = serviceOrderAuthority.activeServiceOrder;
  const certified = serviceOrder?.certifiedPackageId
    ? await loadRecord(DIRS.certifiedIofPackages, serviceOrder.certifiedPackageId).catch(() => null)
    : null;
  const engineeringPackage = certified?.engineeringPackageId
    ? await loadRecord(DIRS.engineeringPackages, certified.engineeringPackageId).catch(() => null)
    : null;
  if (certified && !certifiedPackageMatchesProject(certified, reviewPackage, engineeringPackage)) {
    throw Object.assign(new Error("CUSTOMER_PROJECT_CERTIFIED_IOF_AUTHORITY_MISMATCH"), { status: 409 });
  }
  const scopeVersion = serviceOrder?.scopeVersionId
    ? await loadRecord(DIRS.scopeVersions, serviceOrder.scopeVersionId).catch(() => null)
    : null;
  const actions = sortedByUpdated((await listRecords(DIRS.customerPortalActions)).filter((item) =>
    item.customerReviewPackageId === reviewPackage.customerReviewPackageId
  ));
  const customerSignature = serviceOrder?.customerSignatureEvidence ?? (serviceOrder?.customerSignatureId
    ? await loadRecord(DIRS.customerSignatures, serviceOrder.customerSignatureId).catch(() => null)
    : null);
  const countersignature = serviceOrder?.countersignatureId
    ? await loadRecord(DIRS.teralinxCountersignatures, serviceOrder.countersignatureId).catch(() => null)
    : null;
  const artifactStates = deriveArtifactStates({ proposal, reviewPackage, portalActions: actions, engineeringPackage, certifiedPackage: certified, serviceOrder, customerSignature, countersignature, scopeVersion });
  const governedMilestones = [
    { id: `${reviewPackage.customerReviewPackageId}:SUBMITTED`, action: "PROPOSAL_SUBMITTED", message: `Proposal Revision ${reviewPackage.proposalRevisionNumber} submitted for customer review.`, createdAt: reviewPackage.submittedAt },
    engineeringPackage ? { id: `${engineeringPackage.engineeringPackageId}:STARTED`, action: "ENGINEERING_STARTED", message: "Engineering review started.", createdAt: engineeringPackage.createdAt ?? engineeringPackage.updatedAt } : null,
    certified ? { id: `${certified.certifiedPackageId}:CERTIFIED`, action: "DESIGN_CERTIFIED", message: "The governed technical scope was certified.", createdAt: certified.certifiedAt ?? certified.updatedAt } : null,
    ...serviceOrderAuthority.orders.flatMap((order) => [
      order.issuedAt ? { id: `${order.serviceOrderId}:ISSUED`, action: "SERVICE_ORDER_ISSUED", message: `Service Order R${String(order.documentRevision).padStart(3, "0")} issued for customer signature.`, createdAt: order.issuedAt } : null,
      order.customerSignedAt ? { id: `${order.serviceOrderId}:SIGNED`, action: "SERVICE_ORDER_SIGNED", message: `Customer signature recorded for Service Order R${String(order.documentRevision).padStart(3, "0")}.`, createdAt: order.customerSignedAt } : null,
      order.supersession ? { id: order.supersession.supersessionId, action: "SERVICE_ORDER_SUPERSEDED", message: `${order.serviceOrderId} retained as signed history and superseded for execution by ${order.supersession.supersedingServiceOrderId}.`, createdAt: order.supersession.createdAt } : null,
    ]),
    serviceOrder?.countersignedAt ? { id: `${serviceOrder.serviceOrderId}:COUNTERSIGNED`, action: "TERALINX_COUNTERSIGNED", message: "Teralinx countersignature recorded.", createdAt: serviceOrder.countersignedAt } : null,
    scopeVersion ? { id: `${scopeVersion.scopeVersionId}:AUTHORIZED`, action: "PROJECT_AUTHORIZED", message: "Authorized ScopeVersion created by the system.", createdAt: scopeVersion.createdAt } : null,
  ].filter(Boolean);
  return {
    projectId: reviewPackage.opportunityId,
    customerReviewPackageId: reviewPackage.customerReviewPackageId,
    customerOrganizationId: reviewPackage.customerOrganizationId,
    customer: { accountId: identity.accountId, customerId: identity.customerId, name: identity.customerOrganizationName },
    title: reviewPackage.title || reviewPackage.product?.name || "Customer Project",
    summary: displayText(reviewPackage.summary),
    status: safeStatus(proposal, serviceOrder, scopeVersion),
    artifactStates: customerVisibleArtifactStates(artifactStates),
    proposal: {
      proposalId: reviewPackage.proposalId,
      proposalRevisionId: reviewPackage.proposalRevisionId,
      proposalRevisionNumber: reviewPackage.proposalRevisionNumber,
      proposalHash: reviewPackage.proposalHash,
      title: reviewPackage.title,
      summary: displayText(reviewPackage.summary),
      product: customerVisibleProduct(reviewPackage.product),
      commercialTerms: customerVisibleCommercialTerms(reviewPackage.commercialTerms),
      schedule: customerVisibleSchedule(reviewPackage.schedule),
      majorQuantities: customerVisibleMajorQuantities(reviewPackage.majorQuantities),
      expiration: reviewPackage.expiration,
      decision: text(proposal?.approvalState),
      status: text(proposal?.status),
      artifactState: artifactStates.proposal.state,
    },
    engineering: {
      status: artifactStates.engineering.state,
      certifiedAt: certified?.certifiedAt ?? null,
      customerSafeSummary: certified ? "Teralinx has certified the governed technical scope for this project." : engineeringPackage ? "Engineering review is in progress." : "Engineering begins after Proposal acceptance.",
    },
    map: {
      routeRepositoryId: reviewPackage.route?.routeRepositoryId,
      routeRevision: reviewPackage.route?.routeRevision,
      routeGeometryId: reviewPackage.route?.routeGeometryId,
      geometryHash: reviewPackage.route?.geometryHash,
      routeMiles: reviewPackage.route?.routeMiles,
      coordinates: array(route?.commercialGeometry),
      endpointA: customerVisibleEndpoint(route?.endpointA ?? route?.siteA, "A"),
      endpointZ: customerVisibleEndpoint(route?.endpointZ ?? route?.siteZ, "Z"),
    },
    documents: [
      ...array(reviewPackage.customerSafeDocumentReferences).map(customerVisibleDocumentReference),
      ...serviceOrderAuthority.orders.map((order) => ({ documentType: "SERVICE_ORDER", serviceOrderId: order.serviceOrderId, documentRevision: order.documentRevision, documentHash: order.documentHash, status: order.status, supersessionState: order.supersessionState, executionEligibility: order.executionEligibility })),
      ...(certified ? [{ documentType: "CERTIFIED_ROUTE", certifiedIofPackageId: certified.certifiedPackageId, status: "CERTIFIED" }] : []),
    ],
    serviceOrders: serviceOrderAuthority.orders.map((order) => customerVisibleServiceOrder(order, identity, certified)),
    serviceOrder: serviceOrder ? { ...customerVisibleServiceOrder(serviceOrder, identity, certified), artifactState: artifactStates.serviceOrder.state } : null,
    scopeVersion: scopeVersion ? { scopeVersionId: scopeVersion.scopeVersionId, status: scopeVersion.status, artifactState: artifactStates.scopeVersion.state, createdAt: scopeVersion.createdAt } : null,
    activity: [...actions.map((item) => ({
      customerPortalActionId: item.customerPortalActionId, action: item.action, message: item.message,
      actorDisplayName: item.actorDisplayNameAtAction, createdAt: item.createdAt,
    })), ...governedMilestones.map((item) => ({ customerPortalActionId: item.id, action: item.action, message: item.message, actorDisplayName: "Teralinx", createdAt: item.createdAt }))]
      .filter((item) => item.createdAt).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
    disclosureAuthority: customerDisclosureAuthority(),
  };
}

function customerVisibleArtifactStates(states) {
  return {
    proposal: { state: states.proposal.state, evidenceExact: states.proposal.evidenceExact },
    customerReview: { state: states.customerReview.state, evidenceExact: states.customerReview.evidenceExact },
    customerAcceptance: { state: states.customerAcceptance.state, evidenceExact: states.customerAcceptance.evidenceExact },
    engineering: { state: states.engineering.state, eligibility: states.engineering.eligibility },
    certifiedIof: { state: states.certifiedIof.state },
    serviceOrder: { state: states.serviceOrder.state, signatureState: states.serviceOrder.signatureState, serviceOrderId: states.serviceOrder.serviceOrderId },
    customerSignature: { state: states.customerSignature.state },
    countersignature: { state: states.countersignature.state },
    scopeVersion: { state: states.scopeVersion.state, scopeVersionId: states.scopeVersion.scopeVersionId, evidenceExact: states.scopeVersion.evidenceExact },
  };
}

function customerTwinDisclosureProjection(twin) {
  const customerSafe = (source) => ({
    product: customerVisibleProduct(source.product),
    route: {
      routeRepositoryId: source.route.routeRepositoryId,
      routeRevision: source.route.routeRevision,
      routeRevisionId: source.route.routeRevisionId,
      routeGeometryId: source.route.routeGeometryId,
      geometryHash: source.route.geometryHash,
      routeMiles: source.route.routeMiles,
      routeFeet: source.route.routeFeet,
      endpointA: customerVisibleEndpoint(source.route.endpointA, "A"),
      endpointZ: customerVisibleEndpoint(source.route.endpointZ, "Z"),
      coordinates: array(source.route.coordinates).map((coordinate) => array(coordinate).slice(0, 2).map(Number)).filter((coordinate) => coordinate.length === 2 && coordinate.every(Number.isFinite)),
    },
    economics: customerVisibleCommercialTerms(source.economics),
    delivery: customerVisibleSchedule(source.delivery),
    specifications: {
      fiberCount: source.specifications.fiberCount,
      ductCount: source.specifications.ductCount,
      ductDiameter: source.specifications.ductDiameter,
      ductMaterial: source.specifications.ductMaterial,
      conduitConfiguration: source.specifications.conduitConfiguration,
      diversity: source.specifications.diversity,
      demarcation: source.specifications.demarcation,
      deliveryConfiguration: source.specifications.deliveryConfiguration,
      maintenanceAssumptions: array(source.specifications.maintenanceAssumptions).map(text),
    },
    dealPoints: {
      paymentStructure: source.dealPoints.paymentStructure,
      customerResponsibilities: array(source.dealPoints.customerResponsibilities).map(text),
      teralinxResponsibilities: array(source.dealPoints.teralinxResponsibilities).map(text),
      assumptions: array(source.dealPoints.assumptions).map(text),
      exclusions: array(source.dealPoints.exclusions).map(text),
      specialConditions: array(source.dealPoints.specialConditions).map(text),
    },
    doctrineLineage: {
      productDoctrineId: source.doctrineLineage.productDoctrineId,
      productDoctrineVersion: source.doctrineLineage.productDoctrineVersion,
    },
    contracting: {
      mode: source.contracting.mode,
      supportedModes: array(source.contracting.supportedModes).map(text),
      governingTermsReference: source.contracting.governingTermsReference,
      customerPaperReferences: array(source.contracting.customerPaperReferences).map(customerVisibleDocumentReference),
      demoLegalClassification: source.contracting.demoLegalClassification,
    },
    lineage: { status: source.lineage.status },
  });
  return {
    customerTwinId: twin.customerTwinId,
    projectionType: twin.projectionType,
    projectionAuthority: twin.projectionAuthority,
    account: {
      accountId: twin.account.accountId,
      customerId: twin.account.customerId,
      customerOrganizationId: twin.account.customerOrganizationId,
      name: twin.account.name,
      status: twin.account.status,
    },
    lens: "CUSTOMER",
    persona: twin.persona,
    dealCount: twin.dealCount,
    stateCounts: twin.stateCounts,
    tasks: twin.tasks.map((task) => ({ taskType: task.taskType, label: task.label, count: task.count, dealIds: [...task.dealIds] })),
    deals: twin.deals.map((deal) => ({
      dealId: deal.dealId,
      opportunityId: deal.opportunityId,
      accountId: deal.accountId,
      customerId: deal.customerId,
      title: deal.title,
      summary: deal.summary,
      currentState: deal.currentState,
      currentStateIndex: deal.currentStateIndex,
      lifecycle: deal.lifecycle,
      permittedActions: deal.permittedActions,
      nextAction: deal.nextAction,
      artifactStates: customerVisibleArtifactStates(deal.artifactStates),
      activity: deal.activity.filter((item) => item.customerSafe === true).map((item) => ({
        evidenceId: item.evidenceId, eventType: item.eventType, title: item.title, detail: item.detail,
        actor: item.actor, timestamp: item.timestamp, customerSafe: true,
      })),
      customerSafe: customerSafe(deal.customerSafe),
      documentHistory: deal.documentHistory.map((item) => ({
        documentType: item.documentType, documentId: item.documentId, revision: item.revision,
        status: item.status, createdAt: item.createdAt,
      })),
      updatedAt: deal.updatedAt,
    })),
    lifecycleStates: twin.lifecycleStates,
    generatedAt: twin.generatedAt,
    createsAuthority: false,
    disclosureAuthority: customerDisclosureAuthority(),
  };
}

const customerLifecycleLabel = (state) => ({
  DRAFT: "Planning",
  PROPOSED: "Proposal available",
  CUSTOMER_REVIEW: "Under customer review",
  ACCEPTED: "Proposal accepted",
  ENGINEERING: "Engineering in progress",
  CERTIFIED: "Technical scope certified",
  SERVICE_ORDER: "Service Order available",
  CUSTOMER_SIGNED: "Awaiting Teralinx countersignature",
  COUNTERSIGNED: "Authorization processing",
  AUTHORIZED: "In implementation",
}[text(state).toUpperCase()] ?? "Project status unavailable");

export function customerPlannerProjectProjection(project, deal) {
  const safe = record(deal?.customerSafe);
  const route = record(project?.map);
  const routeSafe = record(safe.route);
  const proposal = record(project?.proposal);
  const commercialTerms = record(proposal.commercialTerms);
  const dealPoints = record(safe.dealPoints);
  const currentState = text(deal?.currentState ?? project?.status).toUpperCase();
  const actions = array(deal?.permittedActions).map((item) => ({
    action: text(item.action), label: text(item.label), available: item.available === true,
    mutation: item.mutation === true, reason: text(item.reason) || null,
  }));
  const exactRoute = text(record(safe.lineage).status) === "PASS" &&
    text(route.routeRepositoryId) === text(routeSafe.routeRepositoryId) &&
    Number(route.routeRevision) === Number(routeSafe.routeRevision) &&
    text(route.routeGeometryId) === text(routeSafe.routeGeometryId) &&
    text(route.geometryHash) === text(routeSafe.geometryHash);
  const coordinates = exactRoute
    ? array(route.coordinates).map((coordinate) => array(coordinate).slice(0, 2).map(Number))
      .filter((coordinate) => coordinate.length === 2 && coordinate.every(Number.isFinite))
    : [];
  return {
    projectionType: "CUSTOMER_PLANNER_PROJECT",
    projectionVersion: "CIP-114C-CUSTOMER-PLANNER-V1",
    readOnly: true,
    createsAuthority: false,
    project: {
      projectId: text(project?.projectId),
      displayName: text(project?.title) || "Customer project",
      customerReference: text(project?.customerReviewPackageId) || null,
      customerName: text(record(project?.customer).name) || null,
      status: currentState,
      statusLabel: customerLifecycleLabel(currentState),
      summary: text(project?.summary) || null,
    },
    product: customerVisibleProduct(Object.keys(record(safe.product)).length ? safe.product : proposal.product),
    endpoints: {
      a: customerVisibleEndpoint(routeSafe.endpointA ?? route.endpointA, "A"),
      z: customerVisibleEndpoint(routeSafe.endpointZ ?? route.endpointZ, "Z"),
    },
    route: {
      availability: coordinates.length >= 2 ? "AVAILABLE" : "ROUTE_NOT_AVAILABLE",
      exactProposalLineage: exactRoute,
      routeRepositoryId: text(route.routeRepositoryId) || null,
      routeRevision: Number.isFinite(Number(route.routeRevision)) ? Number(route.routeRevision) : null,
      routeGeometryId: text(route.routeGeometryId) || null,
      geometryHash: text(route.geometryHash) || null,
      routeMiles: Number.isFinite(Number(routeSafe.routeMiles ?? route.routeMiles)) ? Number(routeSafe.routeMiles ?? route.routeMiles) : null,
      routeFeet: Number.isFinite(Number(routeSafe.routeFeet)) ? Number(routeSafe.routeFeet) : null,
      coordinates,
      summary: coordinates.length >= 2 ? "Exact Proposal-bound route" : "Route is not yet available for customer viewing.",
    },
    proposal: {
      availability: text(proposal.proposalId) ? "AVAILABLE" : "PROPOSAL_NOT_AVAILABLE",
      proposalId: text(proposal.proposalId) || null,
      revisionId: text(proposal.proposalRevisionId) || null,
      revisionNumber: Number.isFinite(Number(proposal.proposalRevisionNumber)) ? Number(proposal.proposalRevisionNumber) : null,
      status: text(proposal.status ?? proposal.artifactState) || null,
      title: text(proposal.title) || null,
      summary: text(proposal.summary) || null,
      expiresAt: text(proposal.expiration) || null,
    },
    commercialOffer: customerVisibleCommercialTerms(Object.keys(record(safe.economics)).length ? safe.economics : commercialTerms),
    delivery: customerVisibleSchedule(safe.delivery ?? proposal.schedule),
    customerContent: {
      assumptions: array(dealPoints.assumptions).map(text).filter(Boolean),
      exclusions: array(dealPoints.exclusions).map(text).filter(Boolean),
      specialConditions: array(dealPoints.specialConditions).map(text).filter(Boolean),
      customerResponsibilities: array(dealPoints.customerResponsibilities).map(text).filter(Boolean),
      teralinxResponsibilities: array(dealPoints.teralinxResponsibilities).map(text).filter(Boolean),
      specifications: {
        fiberCount: record(safe.specifications).fiberCount ?? null,
        ductCount: record(safe.specifications).ductCount ?? null,
        ductDiameter: record(safe.specifications).ductDiameter ?? null,
        ductMaterial: record(safe.specifications).ductMaterial ?? null,
        conduitConfiguration: record(safe.specifications).conduitConfiguration ?? null,
        diversity: record(safe.specifications).diversity ?? null,
        demarcation: record(safe.specifications).demarcation ?? null,
        deliveryConfiguration: record(safe.specifications).deliveryConfiguration ?? null,
      },
    },
    documents: array(project?.documents).map((item) => customerVisibleDocumentReference({
      documentId: item?.documentId ?? item?.serviceOrderId ?? item?.certifiedIofPackageId,
      documentType: item?.documentType, title: item?.title, revision: item?.revision ?? item?.documentRevision,
      status: item?.status,
    })),
    lifecycle: {
      currentState,
      statusLabel: customerLifecycleLabel(currentState),
      steps: array(deal?.lifecycle).map((step) => ({ name: text(step.name), status: text(step.status) })),
      nextAction: { label: text(deal?.nextAction?.label) || "No action currently required", responsibleParty: text(deal?.nextAction?.responsibleParty) || null },
      activity: array(deal?.activity).filter((item) => item.customerSafe === true).map((item) => ({
        id: text(item.evidenceId), type: text(item.eventType), title: text(item.title), detail: text(item.detail) || null,
        actor: text(item.actor) || null, timestamp: text(item.timestamp),
      })),
    },
    capabilities: { actions, routeEditing: false, requestCreation: false, reasoning: false, documentUpload: false },
    serviceOrders: array(project?.serviceOrders).map((order) => ({
      serviceOrderId: text(order.serviceOrderId), documentRevision: order.documentRevision, documentHash: text(order.documentHash),
      status: text(order.status), signatureStatus: text(order.signatureStatus), supersessionState: text(order.supersessionState) || null,
      executionEligibility: text(order.executionEligibility) || null,
    })),
    activeServiceOrderId: text(project?.serviceOrder?.serviceOrderId) || null,
    actionAuthority: {
      accountId: text(project?.customer?.accountId), customerId: text(project?.customer?.customerId), opportunityId: text(project?.projectId),
      proposalId: text(proposal.proposalId), proposalRevisionId: text(proposal.proposalRevisionId),
      proposalRevisionNumber: proposal.proposalRevisionNumber, proposalHash: text(proposal.proposalHash),
      routeRepositoryId: text(route.routeRepositoryId), routeRevision: route.routeRevision,
      routeGeometryId: text(route.routeGeometryId), geometryHash: text(route.geometryHash),
    },
    disclosureAuthority: customerDisclosureAuthority(),
  };
}

async function plannerProjection(user, available, reviewPackage) {
  const project = await projectProjection(reviewPackage);
  const identity = await exactPortalProjectIdentity({ ...available, packages: [reviewPackage] });
  const account = await loadRecord(DIRS.accounts, identity.accountId).catch(() => null);
  if (!account) throw Object.assign(new Error("PROJECT_NOT_READY"), { status: 409 });
  const twin = await buildAccountCustomerTwin({
    account, user, lens: "CUSTOMER", persona: available.context.persona,
    allowedOpportunityIds: [reviewPackage.opportunityId],
  });
  const safeTwin = customerTwinDisclosureProjection(twin);
  const deal = safeTwin.deals.find((item) => text(item.opportunityId) === text(reviewPackage.opportunityId));
  if (!deal) throw Object.assign(new Error("PROJECT_NOT_READY"), { status: 409 });
  return customerPlannerProjectProjection(project, deal);
}

async function packageForProject(user, projectId) {
  const available = await accessiblePackages(user);
  const reviewPackage = available.packages.find((item) => item.opportunityId === projectId || item.customerReviewPackageId === projectId);
  if (!reviewPackage) {
    const error = new Error("Customer project not found or not assigned to this principal.");
    error.status = 404;
    throw error;
  }
  return { ...available, reviewPackage };
}

function customerDomainUser(user, context) {
  return {
    ...user,
    userId: user.principalId,
    customerId: context.organization.customerId,
    customerOrganizationId: context.customerOrganizationId,
    demoCustomerOrganizationId: context.isDemoPersona ? context.customerOrganizationId : undefined,
    participantType: "CUSTOMER",
    role: context.persona,
    roles: [context.persona],
    demoPersona: context.isDemoPersona ? context.persona : undefined,
  };
}

function captureResponse() {
  let statusCode = 200;
  let body = "";
  return {
    setHeader() {},
    writeHead(status) { statusCode = status; },
    end(value = "") { body += String(value); },
    result() {
      let payload = {};
      try { payload = body ? JSON.parse(body) : {}; } catch { payload = { error: body }; }
      return { statusCode, payload };
    },
  };
}

async function persistAction(user, context, reviewPackage, action, message, details = {}) {
  const timestamp = nowIso();
  const id = createId(`CUSTOMER-ACTION-DEMO-${action}`);
  return persistRecord(DIRS.customerPortalActions, id, {
    customerPortalActionId: id,
    artifactType: "CUSTOMER_PORTAL_ACTION_EVIDENCE",
    action,
    message: text(message),
    customerReviewPackageId: reviewPackage.customerReviewPackageId,
    opportunityId: reviewPackage.opportunityId,
    customerOrganizationId: context.customerOrganizationId,
    customerId: context.organization.customerId,
    proposalId: reviewPackage.proposalId,
    proposalRevisionId: reviewPackage.proposalRevisionId,
    proposalHash: reviewPackage.proposalHash,
    actorPrincipalId: user.principalId,
    actorMembershipId: user.membershipId,
    actorSessionId: user.sessionId,
    actorDisplayNameAtAction: user.displayName ?? user.name,
    demoPersona: context.isDemoPersona ? context.persona : undefined,
    authorityClass: "DEMO",
    environment: "DEMO",
    productionEligible: false,
    directInfrastructureMutation: false,
    details,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

async function enroll(req, res) {
  const body = await readRequestJson(req);
  const token = text(body.token), password = text(body.password);
  if (!token || !password) return errorResponse(res, 400, "Invitation token and password are required.");
  return withRepositoryAuthority(demoRepositoryUser(), async () => {
    try {
      const result = await consumeInvitation({ token, password, suppliedIdentity: text(body.username ?? body.email).toLowerCase() }, {
        findInvitation: invitationByToken,
        transaction: withAuthTransaction,
        validateIdentity: validateEnrollmentIdentity,
        preflight: async (invitation, principal) => {
          if (invitation.projectAccessId) {
            const access = await loadRecord(DIRS.customerProjectAccess, invitation.projectAccessId);
            validateEnrollmentAccess(access, principal);
            await loadRecord(DIRS.customerReviewPackages, access.customerReviewPackageId);
          }
        },
        hashPassword: async value => { try { return await hashPassword(value); } catch { throw Object.assign(new Error('ENROLLMENT_PASSWORD_INVALID'), { status: 400 }); } },
        activate: async (client, invitation, principal, passwordDigest) => {
          if (invitation.purpose === "CUSTOMER_PLANNER_ENROLLMENT") {
            await client.query("SELECT hyperlinx.activate_customer_planner_membership($1,$2,$3,$4)", [invitation.customerOrganizationId, principal.principal_id, principal.membership_id, passwordDigest]);
          } else if (invitation.purpose === "CUSTOMER_PORTAL_ENROLLMENT") {
            const updated = await client.query({
              text: `UPDATE hyperlinx.principal_credentials SET password_digest=$2,digest_scheme='SCRYPT',
                credential_version=credential_version+1,password_change_required=false,
                rotated_at=clock_timestamp(),failed_attempt_count=0 WHERE principal_id=$1`,
              values: [principal.principal_id, passwordDigest],
            });
            if (updated.rowCount !== 1) throw Object.assign(new Error('ENROLLMENT_CREDENTIAL_MISSING'), { status: 409 });
            await client.query({ text: "UPDATE hyperlinx.auth_sessions SET revoked_at=clock_timestamp(),revoked_reason='CUSTOMER_ENROLLMENT' WHERE principal_id=$1 AND revoked_at IS NULL", values: [principal.principal_id] });
          } else throw Object.assign(new Error('ENROLLMENT_PURPOSE_INVALID'), { status: 409 });
        },
        project: (invitation, receipt) => projectEnrollment(invitation, receipt, {
          loadInvitation: id => loadRecord(DIRS.customerPortalInvitations, id),
          saveInvitation: (id, value) => persistRecord(DIRS.customerPortalInvitations, id, value),
          loadAccess: id => loadRecord(DIRS.customerProjectAccess, id),
          saveAccess: (id, value) => persistRecord(DIRS.customerProjectAccess, id, value),
          loadReviewPackage: id => loadRecord(DIRS.customerReviewPackages, id),
        }),
      });
      await refreshDurableDirectory();
      return jsonResponse(res, 200, result);
    } catch (error) {
      // Missing migration, commit uncertainty and projection failures are retryable;
      // never fall back to the legacy unreceipted credential write.
      return errorResponse(res, error.status || 503, error.status ? error.message : 'ENROLLMENT_RECOVERY_REQUIRED');
    }
  });
}

async function decision(req, res, user, projectId, action) {
  const { context, reviewPackage } = await packageForProject(user, projectId);
  if (!REVIEW_PERSONAS.has(context.persona)) return errorResponse(res, 403, "Viewer authority cannot make Proposal decisions or requests.");
  const body = await readRequestJson(req);
  const proposal = await loadRecord(DIRS.proposalDrafts, reviewPackage.proposalId).catch(() => null);
  if (!proposal) return errorResponse(res, 404, "The exact Proposal is unavailable.");
  if (!exactRevisionMatches(reviewPackage, proposal, body)) return errorResponse(res, 409, "The exact assigned Proposal Revision ID/hash is required; stale or substituted revisions fail closed.");
  const priorAction = (await listRecords(DIRS.customerPortalActions)).find((item) =>
    item.customerReviewPackageId === reviewPackage.customerReviewPackageId && item.action === action &&
    item.proposalRevisionId === reviewPackage.proposalRevisionId && item.proposalHash === reviewPackage.proposalHash &&
    item.customerOrganizationId === context.customerOrganizationId
  );
  req.customerPortalBody = body;
  const captured = captureResponse();
  const domainUser = customerDomainUser(user, context);
  if (action === "ACCEPT") await handleApprove(req, captured, reviewPackage.proposalId, domainUser);
  else if (action === "DECLINE") await handleReject(req, captured, reviewPackage.proposalId, domainUser);
  else await handleRequestChanges(req, captured, reviewPackage.proposalId, domainUser);
  const result = captured.result();
  if (result.statusCode >= 400) return jsonResponse(res, result.statusCode, result.payload);
  if (result.payload.idempotentReplay) {
    return jsonResponse(res, 200, {
      action: result.payload.approval,
      project: await projectProjection(reviewPackage),
      idempotentReplay: true,
      replayStatus: "IDEMPOTENT_REPLAY",
      repositoryMutation: false,
    });
  }
  let evidence = null;
  let customerActionProjectionError = "";
  try {
    evidence = await persistAction(user, context, reviewPackage, action, body.comment ?? body.reason ?? "", {
      resultingProposalStatus: result.payload.proposal?.status,
      acceptanceEvidenceId: result.payload.approval?.acceptanceEvidenceId,
      acceptanceEvidenceHash: result.payload.approval?.acceptanceEvidenceHash,
      routeRepositoryId: reviewPackage.route?.routeRepositoryId,
      routeRevision: reviewPackage.route?.routeRevision,
      routeGeometryId: reviewPackage.route?.routeGeometryId,
      geometryHash: reviewPackage.route?.geometryHash,
    });
  } catch (error) {
    // The Proposal approval is the governed customer decision. Portal action
    // evidence is a post-commit projection and cannot convert a completed
    // constitutional command into an HTTP failure.
    customerActionProjectionError = error instanceof Error ? error.message : String(error);
  }
  return jsonResponse(res, 200, {
    action: evidence ?? result.payload.approval,
    project: await projectProjection(reviewPackage),
    customerActionProjectionError,
  });
}

async function comment(req, res, user, projectId, action = "COMMENT") {
  const { context, reviewPackage } = await packageForProject(user, projectId);
  if (context.persona === "CUSTOMER_VIEWER") return errorResponse(res, 403, "Viewer authority is read-only.");
  const body = await readRequestJson(req);
  const message = text(body.message ?? body.comment ?? body.question);
  if (!message) return errorResponse(res, 400, "A comment or question is required.");
  const evidence = await persistAction(user, context, reviewPackage, action, message);
  return jsonResponse(res, 201, { action: evidence });
}

export async function handleCustomerPortal(req, res, pathname) {
  const match = routeMatch(pathname, BASE_PATH);
  if (!match) return false;
  if (handleOptions(req, res)) return true;
  if (pathname === `${BASE_PATH}/invitations/enroll` && req.method === "POST") { await enroll(req, res); return true; }
  const user = requireRuntimeUser(req, res);
  if (!user) return true;
  try {
    const preliminary=pathname.match(/^\/api\/customer-portal\/iof-preliminary\/([^/]+)(?:\/(decision|proposal.pdf|route.kmz))?$/);
    if(preliminary){const id=decodeURIComponent(preliminary[1]),action=preliminary[2];if(!action&&req.method==='GET')jsonResponse(res,200,await customerPreliminary(id,user));else if(action==='decision'&&req.method==='POST')jsonResponse(res,200,await customerPreliminaryDecision(id,await readRequestJson(req),user));else if(req.method==='GET'&&['proposal.pdf','route.kmz'].includes(action)){const d=await preliminaryDocument(null,id,action,user,{customer:true});res.writeHead(200,{'Content-Type':action.endsWith('pdf')?'application/pdf':'application/vnd.google-earth.kmz','Content-Disposition':`attachment; filename="Teralinx-${action}"`,'X-Teralinx-Export-Hash':d.sha256});res.end(d.bytes);}else errorResponse(res,405,'IOF_PROPOSAL_METHOD_INVALID');return true;}
    const revokeMatch = pathname.match(/^\/api\/customer-portal\/invitations\/([^/]+)\/revoke$/);
    if (revokeMatch && req.method === "POST") {
      if (user.organizationId !== "org-demo" || user.principalId !== "demo-principal" || user.demoPersona !== "SALES") {
        errorResponse(res, 403, "Only Demo Sales authority may revoke a Demo customer invitation."); return true;
      }
      const invitationId = decodeURIComponent(revokeMatch[1]);
      const selected = await loadRecord(DIRS.customerPortalInvitations, invitationId).catch(() => null);
      if (!selected) { errorResponse(res, 404, "Invitation not found."); return true; }
      return await withInvitationAdministration(selected.customerOrganizationId, async () => {
      const invitation = await loadRecord(DIRS.customerPortalInvitations, invitationId);
      if (invitation.customerOrganizationId !== selected.customerOrganizationId) throw Object.assign(new Error('INVITATION_SCOPE_CHANGED'), { status: 409 });
      if (invitation.status === "CONSUMED") { errorResponse(res, 409, "A consumed invitation cannot be revoked."); return true; }
      const timestamp = nowIso();
      await persistRecord(DIRS.customerPortalInvitations, invitationId, { ...invitation, status: "REVOKED", revokedAt: timestamp, revokedByPrincipalId: user.principalId, updatedAt: timestamp });
      jsonResponse(res, 200, { revoked: true, customerInvitationId: invitationId }); return true;
      });
    }
    if (pathname === `${BASE_PATH}/context` && req.method === "GET") {
      const available = await accessiblePackages(user, selectedPortalAuthority(req));
      const identities = await portalProjectIdentities(available);
      jsonResponse(res, 200, {
        customerOrganization: { customerOrganizationId: available.context.customerOrganizationId, name: available.context.organization.name },
        projectIdentities: identities.map((identity) => ({ accountId: identity.accountId, customerId: identity.customerId, opportunityId: identity.opportunityId })),
        role: available.context.persona, actorPrincipalId: user.principalId,
        demoPersona: available.context.isDemoPersona ? available.context.persona : null,
        disclosureAuthority: customerDisclosureAuthority(),
      });
      return true;
    }
    if (pathname === `${BASE_PATH}/projects` && req.method === "GET") {
      const available = await accessiblePackages(user, selectedPortalAuthority(req));
      const projects = await Promise.all(available.packages.map(projectProjection));
      jsonResponse(res, 200, { projects }); return true;
    }
    if (pathname === `${BASE_PATH}/account-twin` && req.method === "GET") {
      const available = await accessiblePackages(user, selectedPortalAuthority(req));
      const identity = await exactPortalProjectIdentity(available);
      const account = await loadRecord(DIRS.accounts, identity.accountId).catch(() => null);
      if (!account) return errorResponse(res, 404, "The Customer Account backing this portal was not found.");
      const allowedOpportunityIds = available.packages.map((item) => item.opportunityId);
      const customerTwin = await buildAccountCustomerTwin({ account, user, lens: "CUSTOMER", persona: available.context.persona, allowedOpportunityIds });
      jsonResponse(res, 200, { customerTwin: customerTwinDisclosureProjection(customerTwin) }); return true;
    }
    const projectMatch = pathname.match(/^\/api\/customer-portal\/projects\/([^/]+)(?:\/(.+))?$/);
    if (!projectMatch) { errorResponse(res, 404, "Customer Portal resource not found."); return true; }
    const projectId = decodeURIComponent(projectMatch[1]);
    const action = projectMatch[2] ?? "";
    if (action === "planner" && req.method === "GET") {
      const available = await accessiblePackages(user);
      const reviewPackage = available.packages.find((item) => item.opportunityId === projectId || item.customerReviewPackageId === projectId);
      if (!reviewPackage) { errorResponse(res, 404, "PROJECT_UNAVAILABLE"); return true; }
      jsonResponse(res, 200, { plannerProject: await plannerProjection(user, available, reviewPackage) }); return true;
    }
    if (!action && req.method === "GET") {
      const { reviewPackage } = await packageForProject(user, projectId);
      jsonResponse(res, 200, { project: await projectProjection(reviewPackage) }); return true;
    }
    if (req.method === "POST" && action === "comments") { await comment(req, res, user, projectId); return true; }
    if (req.method === "POST" && action === "questions") { await comment(req, res, user, projectId, "QUESTION"); return true; }
    if (req.method === "POST" && action === "change-requests") { await decision(req, res, user, projectId, "REQUEST_CHANGE"); return true; }
    if (req.method === "POST" && action === "proposal/accept") { await decision(req, res, user, projectId, "ACCEPT"); return true; }
    if (req.method === "POST" && action === "proposal/decline") { await decision(req, res, user, projectId, "DECLINE"); return true; }
    errorResponse(res, 405, "Customer Portal method not allowed."); return true;
  } catch (error) {
    errorResponse(res, error.status ?? 500, error.message ?? "Customer Portal request failed closed.");
    return true;
  }
}
