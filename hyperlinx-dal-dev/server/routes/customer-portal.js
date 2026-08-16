import {
  DIRS, createId, errorResponse, handleOptions, jsonResponse, listRecords, loadRecord, nowIso,
  persistRecord, readRequestJson, routeMatch, sortedByUpdated, withRepositoryAuthority,
} from "./_shared.js";
import { requireRuntimeUser } from "./authority.js";
import { authQuery, withAuthTransaction } from "../auth/postgres.js";
import { hashPassword } from "../auth/password.js";
import { refreshDurableDirectory } from "./auth.js";
import {
  CUSTOMER_ORGANIZATIONS, customerProjectAccessRecords, invitationByToken,
} from "./customer-portal-authority.js";
import { handleApprove, handleReject, handleRequestChanges } from "./proposal-drafts.js";
import { signAsCustomer } from "./service-orders.js";

const BASE_PATH = "/api/customer-portal";
const CUSTOMER_PERSONAS = new Set([
  "CUSTOMER_VIEWER", "CUSTOMER_COMMERCIAL_REVIEWER", "CUSTOMER_AUTHORIZED_SIGNER",
]);
const REVIEW_PERSONAS = new Set(["CUSTOMER_COMMERCIAL_REVIEWER", "CUSTOMER_AUTHORIZED_SIGNER"]);
const text = (value) => String(value ?? "").trim();
const array = (value) => Array.isArray(value) ? value : value == null ? [] : [value];
const record = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};

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

async function accessiblePackages(user) {
  const context = portalContext(user);
  const packages = (await listRecords(DIRS.customerReviewPackages))
    .filter((item) => item.customerOrganizationId === context.customerOrganizationId && item.status !== "SUPERSEDED");
  if (context.isDemoPersona) return { context, packages };
  const access = (await customerProjectAccessRecords()).filter((item) =>
    item.principalId === user.principalId && item.customerOrganizationId === context.customerOrganizationId && item.status === "ACTIVE"
  );
  const allowed = new Set(access.map((item) => item.customerReviewPackageId));
  return { context, packages: packages.filter((item) => allowed.has(item.customerReviewPackageId)), access };
}

function exactRevisionMatches(reviewPackage, proposal, body = {}) {
  const requestedId = text(body.proposalRevisionId);
  const requestedHash = text(body.proposalHash);
  return Boolean(requestedId && requestedHash &&
    requestedId === reviewPackage.proposalRevisionId && requestedHash === reviewPackage.proposalHash &&
    requestedId === proposal.proposalRevisionId && requestedHash === proposal.proposalHash);
}

function safeStatus(proposal = {}, serviceOrder = {}, scopeVersion = {}) {
  if (scopeVersion.scopeVersionId) return "AUTHORIZED";
  if (serviceOrder.status) return text(serviceOrder.status);
  return text(proposal.status, "CUSTOMER_REVIEW");
}

async function projectProjection(reviewPackage) {
  const proposal = await loadRecord(DIRS.proposalDrafts, reviewPackage.proposalId).catch(() => null);
  const route = reviewPackage.route?.routeRepositoryId
    ? await loadRecord(DIRS.commercialRoutes, reviewPackage.route.routeRepositoryId).catch(() => null)
    : null;
  const serviceOrders = (await listRecords(DIRS.serviceOrders)).filter((item) =>
    item.proposalId === reviewPackage.proposalId && item.customerId === reviewPackage.customerId
  );
  const serviceOrder = sortedByUpdated(serviceOrders)[0] ?? null;
  const engineeringPackage = sortedByUpdated((await listRecords(DIRS.engineeringPackages)).filter((item) =>
    item.proposalId === reviewPackage.proposalId || item.opportunityId === reviewPackage.opportunityId
  ))[0] ?? null;
  const certified = sortedByUpdated((await listRecords(DIRS.certifiedIofPackages)).filter((item) =>
    item.proposalId === reviewPackage.proposalId || item.opportunityId === reviewPackage.opportunityId
  ))[0] ?? null;
  const scopeVersion = serviceOrder?.scopeVersionId
    ? await loadRecord(DIRS.scopeVersions, serviceOrder.scopeVersionId).catch(() => null)
    : null;
  const actions = sortedByUpdated((await listRecords(DIRS.customerPortalActions)).filter((item) =>
    item.customerReviewPackageId === reviewPackage.customerReviewPackageId
  ));
  const governedMilestones = [
    { id: `${reviewPackage.customerReviewPackageId}:SUBMITTED`, action: "PROPOSAL_SUBMITTED", message: `Proposal Revision ${reviewPackage.proposalRevisionNumber} submitted for customer review.`, createdAt: reviewPackage.submittedAt },
    engineeringPackage ? { id: `${engineeringPackage.engineeringPackageId}:STARTED`, action: "ENGINEERING_STARTED", message: "Engineering review started.", createdAt: engineeringPackage.createdAt ?? engineeringPackage.updatedAt } : null,
    certified ? { id: `${certified.certifiedPackageId}:CERTIFIED`, action: "DESIGN_CERTIFIED", message: "The governed technical scope was certified.", createdAt: certified.certifiedAt ?? certified.updatedAt } : null,
    serviceOrder?.issuedAt ? { id: `${serviceOrder.serviceOrderId}:ISSUED`, action: "SERVICE_ORDER_ISSUED", message: "Service Order issued for customer signature.", createdAt: serviceOrder.issuedAt } : null,
    serviceOrder?.customerSignedAt ? { id: `${serviceOrder.serviceOrderId}:SIGNED`, action: "SERVICE_ORDER_SIGNED", message: "Customer signature recorded.", createdAt: serviceOrder.customerSignedAt } : null,
    serviceOrder?.countersignedAt ? { id: `${serviceOrder.serviceOrderId}:COUNTERSIGNED`, action: "TERALINX_COUNTERSIGNED", message: "Teralinx countersignature recorded.", createdAt: serviceOrder.countersignedAt } : null,
    scopeVersion ? { id: `${scopeVersion.scopeVersionId}:AUTHORIZED`, action: "PROJECT_AUTHORIZED", message: "Authorized ScopeVersion created by the system.", createdAt: scopeVersion.createdAt } : null,
  ].filter(Boolean);
  return {
    projectId: reviewPackage.opportunityId,
    customerReviewPackageId: reviewPackage.customerReviewPackageId,
    customerOrganizationId: reviewPackage.customerOrganizationId,
    title: reviewPackage.title || reviewPackage.product?.name || "Customer Project",
    summary: reviewPackage.summary,
    status: safeStatus(proposal, serviceOrder, scopeVersion),
    proposal: {
      proposalId: reviewPackage.proposalId,
      proposalRevisionId: reviewPackage.proposalRevisionId,
      proposalRevisionNumber: reviewPackage.proposalRevisionNumber,
      proposalHash: reviewPackage.proposalHash,
      title: reviewPackage.title,
      summary: reviewPackage.summary,
      product: reviewPackage.product,
      commercialTerms: reviewPackage.commercialTerms,
      schedule: reviewPackage.schedule,
      majorQuantities: reviewPackage.majorQuantities,
      expiration: reviewPackage.expiration,
      decision: text(proposal?.approvalState),
      status: text(proposal?.status),
    },
    engineering: {
      status: certified ? "CERTIFIED" : engineeringPackage ? "IN_REVIEW" : proposal?.approvalState === "APPROVED" ? "QUEUED" : "NOT_STARTED",
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
      endpointA: route?.endpointA ?? route?.siteA ?? null,
      endpointZ: route?.endpointZ ?? route?.siteZ ?? null,
    },
    documents: [
      ...array(reviewPackage.customerSafeDocumentReferences),
      ...(serviceOrder ? [{ documentType: "SERVICE_ORDER", serviceOrderId: serviceOrder.serviceOrderId, documentRevision: serviceOrder.documentRevision, documentHash: serviceOrder.documentHash, status: serviceOrder.status }] : []),
      ...(certified ? [{ documentType: "CERTIFIED_ROUTE", certifiedIofPackageId: certified.certifiedPackageId, certificationHash: certified.certificationHash, status: "CERTIFIED" }] : []),
    ],
    serviceOrder: serviceOrder ? {
      serviceOrderId: serviceOrder.serviceOrderId,
      documentRevision: serviceOrder.documentRevision,
      documentHash: serviceOrder.documentHash,
      status: serviceOrder.status,
      signatureStatus: serviceOrder.signatureStatus,
      pricingSummary: serviceOrder.pricingSummary,
      serviceDescription: serviceOrder.serviceDescription,
    } : null,
    scopeVersion: scopeVersion ? { scopeVersionId: scopeVersion.scopeVersionId, status: scopeVersion.status, createdAt: scopeVersion.createdAt } : null,
    activity: [...actions.map((item) => ({
      customerPortalActionId: item.customerPortalActionId, action: item.action, message: item.message,
      actorDisplayName: item.actorDisplayNameAtAction, createdAt: item.createdAt,
    })), ...governedMilestones.map((item) => ({ customerPortalActionId: item.id, action: item.action, message: item.message, actorDisplayName: "Teralinx", createdAt: item.createdAt }))]
      .filter((item) => item.createdAt).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
  };
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
  const token = text(body.token);
  const password = text(body.password);
  if (!token || !password) return errorResponse(res, 400, "Invitation token and password are required.");
  return withRepositoryAuthority(demoRepositoryUser(), async () => {
    const invitation = await invitationByToken(token);
    if (!invitation || invitation.status !== "ACTIVE" || invitation.revokedAt || invitation.consumedAt || new Date(invitation.expiresAt).getTime() <= Date.now()) {
      return errorResponse(res, 410, "Invitation is invalid, expired, revoked, or already used.");
    }
    const identity = await authQuery({
      text: `SELECT p.principal_id, p.username, p.email, m.organization_id
        FROM hyperlinx.principals p JOIN hyperlinx.memberships m USING (principal_id)
        WHERE p.principal_id = $1 AND p.status = 'ACTIVE' AND m.status = 'ACTIVE'`,
      values: [invitation.intendedPrincipalId],
    });
    const principal = identity.rows[0];
    if (!principal || principal.organization_id !== invitation.customerOrganizationId) {
      return errorResponse(res, 409, "Invitation identity authority no longer matches the intended customer membership.");
    }
    const suppliedIdentity = text(body.username ?? body.email).toLowerCase();
    if (suppliedIdentity && ![text(principal.username).toLowerCase(), text(principal.email).toLowerCase()].includes(suppliedIdentity)) {
      return errorResponse(res, 403, "Invitation is not valid for that identity.");
    }
    let passwordDigest;
    try { passwordDigest = await hashPassword(password); }
    catch (error) { return errorResponse(res, 400, error.message); }
    await withAuthTransaction(async (client) => {
      await client.query({
        text: `UPDATE hyperlinx.principal_credentials SET password_digest = $2, digest_scheme = 'SCRYPT',
          credential_version = credential_version + 1, password_change_required = false,
          rotated_at = clock_timestamp(), failed_attempt_count = 0 WHERE principal_id = $1`,
        values: [principal.principal_id, passwordDigest],
      });
      await client.query({
        text: "UPDATE hyperlinx.auth_sessions SET revoked_at = clock_timestamp(), revoked_reason = 'CUSTOMER_ENROLLMENT' WHERE principal_id = $1 AND revoked_at IS NULL",
        values: [principal.principal_id],
      });
    });
    const timestamp = nowIso();
    await persistRecord(DIRS.customerPortalInvitations, invitation.customerInvitationId, {
      ...invitation, status: "CONSUMED", consumedAt: timestamp, consumedByPrincipalId: principal.principal_id,
      tokenHash: invitation.tokenHash, updatedAt: timestamp,
    });
    const access = await loadRecord(DIRS.customerProjectAccess, invitation.projectAccessId).catch(() => null);
    if (access) await persistRecord(DIRS.customerProjectAccess, invitation.projectAccessId, { ...access, status: "ACTIVE", enrolledAt: timestamp, updatedAt: timestamp });
    await refreshDurableDirectory();
    return jsonResponse(res, 200, { enrolled: true, username: principal.username, customerOrganizationId: principal.organization_id });
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
  if (priorAction) return jsonResponse(res, 200, { action: priorAction, project: await projectProjection(reviewPackage), idempotentReplay: true });
  req.customerPortalBody = body;
  const captured = captureResponse();
  const domainUser = customerDomainUser(user, context);
  if (action === "ACCEPT") await handleApprove(req, captured, reviewPackage.proposalId, domainUser);
  else if (action === "DECLINE") await handleReject(req, captured, reviewPackage.proposalId, domainUser);
  else await handleRequestChanges(req, captured, reviewPackage.proposalId, domainUser);
  const result = captured.result();
  if (result.statusCode >= 400) return jsonResponse(res, result.statusCode, result.payload);
  const evidence = await persistAction(user, context, reviewPackage, action, body.comment ?? body.reason ?? "", {
    resultingProposalStatus: result.payload.proposal?.status,
  });
  return jsonResponse(res, 200, { action: evidence, project: await projectProjection(reviewPackage) });
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

async function signServiceOrder(req, res, user, projectId) {
  const { context, reviewPackage } = await packageForProject(user, projectId);
  if (context.persona !== "CUSTOMER_AUTHORIZED_SIGNER") return errorResponse(res, 403, "Authorized Signer authority is required.");
  const body = await readRequestJson(req);
  const order = (await listRecords(DIRS.serviceOrders)).find((item) =>
    item.serviceOrderId === body.serviceOrderId && item.proposalId === reviewPackage.proposalId &&
    item.customerOrganizationId === context.customerOrganizationId
  );
  if (!order) return errorResponse(res, 404, "The exact assigned Service Order is unavailable.");
  if (!body.documentHash || body.documentHash !== order.documentHash) return errorResponse(res, 409, "The exact Service Order document hash is required.");
  const priorAction = (await listRecords(DIRS.customerPortalActions)).find((item) =>
    item.customerReviewPackageId === reviewPackage.customerReviewPackageId && item.action === "SERVICE_ORDER_SIGNED" &&
    item.details?.serviceOrderId === order.serviceOrderId && item.details?.documentHash === order.documentHash
  );
  if (priorAction) return jsonResponse(res, 200, { action: priorAction, project: await projectProjection(reviewPackage), idempotentReplay: true });
  req.customerPortalBody = body;
  const captured = captureResponse();
  const domainUser = customerDomainUser(user, context);
  domainUser.demoCustomerOrganizationId = context.customerOrganizationId;
  await signAsCustomer(req, captured, domainUser, order.serviceOrderId);
  const result = captured.result();
  if (result.statusCode >= 400) return jsonResponse(res, result.statusCode, result.payload);
  const evidence = await persistAction(user, context, reviewPackage, "SERVICE_ORDER_SIGNED", "Customer signed the exact Service Order revision.", {
    serviceOrderId: order.serviceOrderId, documentRevision: order.documentRevision, documentHash: order.documentHash,
    customerSignatureId: result.payload.customerSignature?.customerSignatureId,
  });
  return jsonResponse(res, 200, { action: evidence, project: await projectProjection(reviewPackage) });
}

export async function handleCustomerPortal(req, res, pathname) {
  const match = routeMatch(pathname, BASE_PATH);
  if (!match) return false;
  if (handleOptions(req, res)) return true;
  if (pathname === `${BASE_PATH}/invitations/enroll` && req.method === "POST") { await enroll(req, res); return true; }
  const user = requireRuntimeUser(req, res);
  if (!user) return true;
  try {
    const revokeMatch = pathname.match(/^\/api\/customer-portal\/invitations\/([^/]+)\/revoke$/);
    if (revokeMatch && req.method === "POST") {
      if (user.organizationId !== "org-demo" || user.principalId !== "demo-principal" || user.demoPersona !== "SALES") {
        errorResponse(res, 403, "Only Demo Sales authority may revoke a Demo customer invitation."); return true;
      }
      const invitationId = decodeURIComponent(revokeMatch[1]);
      const invitation = await loadRecord(DIRS.customerPortalInvitations, invitationId).catch(() => null);
      if (!invitation) { errorResponse(res, 404, "Invitation not found."); return true; }
      if (invitation.status === "CONSUMED") { errorResponse(res, 409, "A consumed invitation cannot be revoked."); return true; }
      const timestamp = nowIso();
      await persistRecord(DIRS.customerPortalInvitations, invitationId, { ...invitation, status: "REVOKED", revokedAt: timestamp, revokedByPrincipalId: user.principalId, updatedAt: timestamp });
      jsonResponse(res, 200, { revoked: true, customerInvitationId: invitationId }); return true;
    }
    if (pathname === `${BASE_PATH}/context` && req.method === "GET") {
      const available = await accessiblePackages(user);
      jsonResponse(res, 200, { customerOrganization: { customerOrganizationId: available.context.customerOrganizationId, name: available.context.organization.name }, role: available.context.persona, actorPrincipalId: user.principalId, demoPersona: available.context.isDemoPersona ? available.context.persona : null });
      return true;
    }
    if (pathname === `${BASE_PATH}/projects` && req.method === "GET") {
      const available = await accessiblePackages(user);
      const projects = await Promise.all(available.packages.map(projectProjection));
      jsonResponse(res, 200, { projects }); return true;
    }
    const projectMatch = pathname.match(/^\/api\/customer-portal\/projects\/([^/]+)(?:\/(.+))?$/);
    if (!projectMatch) { errorResponse(res, 404, "Customer Portal resource not found."); return true; }
    const projectId = decodeURIComponent(projectMatch[1]);
    const action = projectMatch[2] ?? "";
    if (!action && req.method === "GET") {
      const { reviewPackage } = await packageForProject(user, projectId);
      jsonResponse(res, 200, { project: await projectProjection(reviewPackage) }); return true;
    }
    if (req.method === "POST" && action === "comments") { await comment(req, res, user, projectId); return true; }
    if (req.method === "POST" && action === "questions") { await comment(req, res, user, projectId, "QUESTION"); return true; }
    if (req.method === "POST" && action === "change-requests") { await decision(req, res, user, projectId, "REQUEST_CHANGE"); return true; }
    if (req.method === "POST" && action === "proposal/accept") { await decision(req, res, user, projectId, "ACCEPT"); return true; }
    if (req.method === "POST" && action === "proposal/decline") { await decision(req, res, user, projectId, "DECLINE"); return true; }
    if (req.method === "POST" && action === "service-order/sign") { await signServiceOrder(req, res, user, projectId); return true; }
    errorResponse(res, 405, "Customer Portal method not allowed."); return true;
  } catch (error) {
    errorResponse(res, error.status ?? 500, error.message ?? "Customer Portal request failed closed.");
    return true;
  }
}
