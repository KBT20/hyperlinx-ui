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
import { userFromBearerToken, userHasPermission } from "./auth.js";

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

function sessionIdFor(user, input = {}) {
  const sessionUserId = input.sessionUserId ?? input.workspaceSessionUserId ?? input.userId ?? user.userId;
  return String(input.sessionId ?? input.workspaceSessionId ?? `WORKSPACE-SESSION-${cleanId(sessionUserId)}-${cleanId(input.workspaceId ?? user.workspaceId)}`);
}

function latestByUpdated(records) {
  return records.sort((a, b) => String(b.updatedAt ?? b.lastSaved ?? b.createdAt ?? "").localeCompare(String(a.updatedAt ?? a.lastSaved ?? a.createdAt ?? "")))[0] ?? null;
}

function pickCurrentAuthority(input = {}, existing = {}) {
  return String(
    input.currentAuthority ??
    input.authority ??
    input.lifecycle?.currentAuthority ??
    existing.currentAuthority ??
    "RUNTIME"
  );
}

function pickCurrentStage(input = {}, existing = {}) {
  return String(
    input.currentLifecycleStage ??
    input.lifecycleStage ??
    input.lifecycle?.status ??
    input.status ??
    existing.currentLifecycleStage ??
    "RUNTIME_READY"
  );
}

function normalizeWorkspaceSession(input = {}, user, existing = null) {
  const timestamp = nowIso();
  const sessionId = sessionIdFor(user, input);
  const accountId = String(input.accountId ?? input.account?.accountId ?? existing?.accountId ?? "");
  const opportunityId = String(input.opportunityId ?? input.opportunity?.opportunityId ?? existing?.opportunityId ?? "");
  const productId = String(input.productId ?? input.product?.productId ?? existing?.productId ?? "");
  const fulfillmentPlanId = String(input.fulfillmentPlanId ?? input.fulfillmentPlan?.fulfillmentPlanId ?? existing?.fulfillmentPlanId ?? "");
  const proposalId = String(input.proposalId ?? input.proposal?.proposalId ?? existing?.proposalId ?? "");
  const packageId = String(input.packageId ?? input.draftPackageId ?? input.draftPackage?.packageId ?? input.iofPackage?.packageId ?? existing?.packageId ?? "");
  const certifiedPackageId = String(input.certifiedPackageId ?? input.certifiedIofPackage?.certifiedPackageId ?? existing?.certifiedPackageId ?? "");
  const scopeVersionId = String(input.scopeVersionId ?? input.scopeVersion?.scopeVersionId ?? existing?.scopeVersionId ?? "");
  const currentRuntimeObject = String(
    input.currentRuntimeObject ??
    input.lifecycle?.currentRuntimeObject ??
    input.runtimeObjectId ??
    input.scopeVersion?.scopeVersionId ??
    (scopeVersionId || packageId || proposalId || existing?.currentRuntimeObject || "")
  );
  const selectedRoute = String(
    input.selectedRoute ??
    input.selectedRouteId ??
    input.routeId ??
    input.commercialDraft?.routeId ??
    asArray(input.geometryReferences)[0] ??
    existing?.selectedRoute ??
    ""
  );
  const selectedGraph = String(
    input.selectedGraph ??
    input.selectedGraphId ??
    input.graphId ??
    asArray(input.runtimeObjectIds)[0] ??
    existing?.selectedGraph ??
    ""
  );
  return {
    ...existing,
    sessionId,
    workspaceSessionId: sessionId,
    runtimeObjectId: String(existing?.runtimeObjectId ?? input.runtimeObjectId ?? `RUNTIME-WORKSPACE-SESSION-${cleanId(sessionId)}`),
    objectId: sessionId,
    objectType: "WORKSPACE_SESSION",
    name: String(input.name ?? existing?.name ?? `${user.name} Runtime Workspace Session`),
    userId: String(input.sessionUserId ?? input.workspaceSessionUserId ?? input.userId ?? existing?.userId ?? user.userId),
    userName: String(input.sessionUserName ?? input.workspaceSessionUserName ?? input.userName ?? existing?.userName ?? user.name),
    organizationId: String(input.organizationId ?? existing?.organizationId ?? user.organizationId),
    workspaceId: String(input.workspaceId ?? existing?.workspaceId ?? user.workspaceId),
    accountId,
    customerId: String(input.customerId ?? input.account?.customerId ?? existing?.customerId ?? (accountId === "google" ? "customer-google" : accountId ? `customer-${accountId}` : "")),
    opportunityId,
    productId,
    fulfillmentPlanId,
    proposalId,
    scopeVersionId,
    currentRuntimeObject,
    currentAuthority: pickCurrentAuthority(input, existing ?? {}),
    currentLifecycleStage: pickCurrentStage(input, existing ?? {}),
    selectedGraph,
    selectedRoute,
    selectedCustomerDesign: String(input.selectedCustomerDesign ?? input.selectedCustomerDesignId ?? asArray(input.customerDesignReferences)[0] ?? existing?.selectedCustomerDesign ?? ""),
    selectedInventory: unique(input.selectedInventory ?? input.selectedInventoryIds ?? input.existingInventoryReferences ?? existing?.selectedInventory),
    selectedPackage: packageId,
    selectedProposalRevision: String(input.selectedProposalRevision ?? input.proposalRevision ?? input.proposal?.version ?? existing?.selectedProposalRevision ?? ""),
    engineeringRevision: String(input.engineeringRevision ?? input.draftPackage?.packageRevision ?? existing?.engineeringRevision ?? ""),
    packageId,
    certifiedPackageId,
    mapView: input.mapView ?? existing?.mapView ?? null,
    expandedPanels: unique(input.expandedPanels ?? existing?.expandedPanels),
    filters: input.filters ?? existing?.filters ?? {},
    selectedRecords: unique(input.selectedRecords ?? existing?.selectedRecords),
    resumeToken: String(input.resumeToken ?? existing?.resumeToken ?? `RESUME-${cleanId(sessionId)}`),
    sessionState: String(input.sessionState ?? existing?.sessionState ?? "ACTIVE"),
    authorityTransactions: asArray(existing?.authorityTransactions),
    lifecycleProgress: asArray(input.lifecycle?.lifecycleProgress ?? existing?.lifecycleProgress),
    lastActivity: String(input.lastActivity ?? input.eventType ?? existing?.lastActivity ?? "WORKSPACE_SESSION_UPDATED"),
    lastSaved: timestamp,
    createdAt: existing?.createdAt ?? input.createdAt ?? timestamp,
    updatedAt: timestamp,
    noWorkspaceOwnedLifecycleState: true,
    runtimeIsSingleSourceOfTruth: true,
  };
}

async function persistRuntimeMirror(session) {
  await persistRecord(DIRS.runtimeObjects, session.runtimeObjectId, {
    runtimeId: session.runtimeObjectId,
    objectId: session.sessionId,
    objectType: "WORKSPACE_SESSION",
    name: session.name,
    owner: session.userName,
    ownerId: session.userId,
    createdBy: session.userName,
    createdById: session.userId,
    assignedTo: unique([session.userId]),
    organization: session.organizationId,
    organizationId: session.organizationId,
    workspace: session.workspaceId,
    workspaceId: session.workspaceId,
    accountId: session.accountId,
    customerId: session.customerId,
    visibility: "PRIVATE",
    authority: "RUNTIME_WORKSPACE_SESSION",
    lifecycleState: session.sessionState,
    version: 1,
    evidenceIds: [],
    relationshipIds: unique([
      session.accountId ? `SESSION_ACCOUNT:${session.sessionId}:${session.accountId}` : "",
      session.opportunityId ? `SESSION_OPPORTUNITY:${session.sessionId}:${session.opportunityId}` : "",
      session.proposalId ? `SESSION_PROPOSAL:${session.sessionId}:${session.proposalId}` : "",
      session.scopeVersionId ? `SESSION_SCOPEVERSION:${session.sessionId}:${session.scopeVersionId}` : "",
    ]),
    sourceId: session.sessionId,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    metadata: {
      accountId: session.accountId,
      opportunityId: session.opportunityId,
      productId: session.productId,
      fulfillmentPlanId: session.fulfillmentPlanId,
      proposalId: session.proposalId,
      packageId: session.packageId,
      certifiedPackageId: session.certifiedPackageId,
      scopeVersionId: session.scopeVersionId,
      currentAuthority: session.currentAuthority,
      currentLifecycleStage: session.currentLifecycleStage,
      currentRuntimeObject: session.currentRuntimeObject,
      resumeToken: session.resumeToken,
      runtimeIsSingleSourceOfTruth: true,
    },
  });
}

async function appendSessionHistory(session, user, eventType = "WORKSPACE_SESSION_UPDATED", details = "WorkspaceSession persisted by Runtime.") {
  const timestamp = nowIso();
  const history = {
    historyId: `runtime-history-${session.sessionId}-${eventType}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    eventType,
    actor: user.name,
    actorId: user.userId,
    objectType: "WorkspaceSession",
    objectId: session.sessionId,
    objectName: session.name,
    accountId: session.accountId,
    customerId: session.customerId,
    organizationId: session.organizationId,
    workspaceId: session.workspaceId,
    timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
    details,
    metadata: {
      accountId: session.accountId,
      opportunityId: session.opportunityId,
      productId: session.productId,
      fulfillmentPlanId: session.fulfillmentPlanId,
      proposalId: session.proposalId,
      packageId: session.packageId,
      certifiedPackageId: session.certifiedPackageId,
      scopeVersionId: session.scopeVersionId,
      currentAuthority: session.currentAuthority,
      currentLifecycleStage: session.currentLifecycleStage,
      resumeToken: session.resumeToken,
      runtimeIsSingleSourceOfTruth: true,
    },
  };
  await persistRecord(DIRS.runtimeHistory, history.historyId, history);
  return history;
}

export async function updateRuntimeWorkspaceSession(input = {}, user, eventType = "WORKSPACE_SESSION_UPDATED", details = "WorkspaceSession updated from Runtime transaction.") {
  const sessionId = sessionIdFor(user, input);
  const existing = await loadRecord(DIRS.runtimeWorkspaceSessions, sessionId).catch(() => null);
  const session = normalizeWorkspaceSession(input, user, existing);
  const authorityTransaction = {
    transactionId: `AUTHORITY-TX-${cleanId(eventType)}-${Date.now()}`,
    eventType,
    authority: session.currentAuthority,
    lifecycleStage: session.currentLifecycleStage,
    currentRuntimeObject: session.currentRuntimeObject,
    actorId: user.userId,
    timestamp: session.updatedAt,
  };
  const next = {
    ...session,
    authorityTransactions: [...asArray(session.authorityTransactions), authorityTransaction].slice(-50),
  };
  await persistRecord(DIRS.runtimeWorkspaceSessions, next.sessionId, next);
  await persistRuntimeMirror(next);
  await appendSessionHistory(next, user, eventType, details);
  return next;
}

async function currentWorkspaceSession(user, input = {}) {
  const explicitId = input.sessionId ?? input.workspaceSessionId;
  if (explicitId) {
    const existing = await loadRecord(DIRS.runtimeWorkspaceSessions, explicitId).catch(() => null);
    if (existing) return normalizeWorkspaceSession(existing, user, existing);
  }
  const sessions = (await listRecords(DIRS.runtimeWorkspaceSessions))
    .filter((session) => session?.userId === user.userId && session?.workspaceId === user.workspaceId);
  const existing = latestByUpdated(sessions);
  if (existing) return normalizeWorkspaceSession(existing, user, existing);
  return updateRuntimeWorkspaceSession({
    ...input,
    sessionState: "ACTIVE",
    currentAuthority: "RUNTIME",
    currentLifecycleStage: "RUNTIME_READY",
    lastActivity: "WORKSPACE_SESSION_INITIALIZED",
  }, user, "WORKSPACE_SESSION_INITIALIZED", "WorkspaceSession initialized by Runtime without creating domain defaults.");
}

async function loadMaybe(dir, id) {
  if (!id) return null;
  return loadRecord(dir, id).catch(() => null);
}

async function latestPackageForProposal(proposalId) {
  if (!proposalId) return null;
  return latestByUpdated((await listRecords(DIRS.iofPackages)).filter((record) => record?.proposalId === proposalId));
}

async function latestCertifiedForPackage(packageId) {
  if (!packageId) return null;
  return latestByUpdated((await listRecords(DIRS.certifiedIofPackages)).filter((record) => record?.sourcePackageId === packageId || record?.packageId === packageId));
}

async function buildRehydration(user, input = {}) {
  const workspaceSession = await currentWorkspaceSession(user, input);
  const account = await loadMaybe(DIRS.accounts, workspaceSession.accountId);
  const contacts = workspaceSession.accountId
    ? (await listRecords(DIRS.contacts)).filter((contact) => contact?.accountId === workspaceSession.accountId)
    : [];
  const opportunity = await loadMaybe(DIRS.commercialOpportunities, workspaceSession.opportunityId);
  const product = await loadMaybe(DIRS.products, workspaceSession.productId);
  const fulfillmentPlan = await loadMaybe(DIRS.fulfillmentPlans, workspaceSession.fulfillmentPlanId);
  const proposal = await loadMaybe(DIRS.proposalDrafts, workspaceSession.proposalId);
  const draftPackage = await loadMaybe(DIRS.iofPackages, workspaceSession.packageId) ?? await latestPackageForProposal(workspaceSession.proposalId);
  const certifiedPackage = await loadMaybe(DIRS.certifiedIofPackages, workspaceSession.certifiedPackageId) ?? await latestCertifiedForPackage(draftPackage?.packageId ?? workspaceSession.packageId);
  const scopeVersion = await loadMaybe(DIRS.scopeVersions, workspaceSession.scopeVersionId) ??
    (certifiedPackage?.scopeVersionId ? await loadMaybe(DIRS.scopeVersions, certifiedPackage.scopeVersionId) : null);
  const runtimeObjects = await listRecords(DIRS.runtimeObjects);
  const runtimeHistory = (await listRecords(DIRS.runtimeHistory)).filter((event) => [
    workspaceSession.sessionId,
    workspaceSession.accountId,
    workspaceSession.opportunityId,
    workspaceSession.productId,
    workspaceSession.fulfillmentPlanId,
    workspaceSession.proposalId,
    draftPackage?.packageId,
    certifiedPackage?.certifiedPackageId,
    scopeVersion?.scopeVersionId,
  ].filter(Boolean).includes(event?.objectId) || event?.metadata?.proposalId === workspaceSession.proposalId || event?.metadata?.accountId === workspaceSession.accountId);
  return {
    workspaceSession,
    restored: {
      account: Boolean(account),
      contacts: contacts.length,
      opportunity: Boolean(opportunity),
      product: Boolean(product),
      fulfillmentPlan: Boolean(fulfillmentPlan),
      proposal: Boolean(proposal),
      route: Boolean(workspaceSession.selectedRoute || asArray(proposal?.geometryReferences).length),
      graph: Boolean(workspaceSession.selectedGraph || asArray(proposal?.runtimeObjectIds).length),
      pricing: Boolean(proposal?.pricingSummary),
      draftPackage: Boolean(draftPackage),
      certifiedPackage: Boolean(certifiedPackage),
      scopeVersion: Boolean(scopeVersion),
      activity: runtimeHistory.length,
    },
    account,
    contacts,
    opportunity,
    product,
    fulfillmentPlan,
    proposal,
    draftPackage,
    certifiedPackage,
    scopeVersion,
    currentRuntimeObject: workspaceSession.currentRuntimeObject,
    currentAuthority: workspaceSession.currentAuthority,
    currentLifecycleStage: workspaceSession.currentLifecycleStage,
    route: {
      selectedRoute: workspaceSession.selectedRoute,
      geometryReferences: asArray(proposal?.geometryReferences ?? draftPackage?.geometryReferences ?? scopeVersion?.canonicalTruth?.geometryReferences),
    },
    graph: {
      selectedGraph: workspaceSession.selectedGraph,
      runtimeObjectIds: unique(proposal?.runtimeObjectIds ?? draftPackage?.runtimeObjectIds ?? scopeVersion?.runtimeObjectIds),
      runtimeRelationshipIds: unique(proposal?.runtimeRelationshipIds ?? draftPackage?.runtimeRelationshipIds ?? scopeVersion?.runtimeRelationshipIds),
    },
    runtimeObjects: runtimeObjects.filter((object) => [
      workspaceSession.runtimeObjectId,
      account?.runtimeObjectId,
      ...contacts.map((contact) => contact.runtimeObjectId),
      opportunity?.runtimeObjectId,
      product?.runtimeObjectId,
      fulfillmentPlan?.runtimeObjectId,
      proposal?.runtimeObjectId,
    ].filter(Boolean).includes(object?.runtimeId)),
    runtimeHistory,
    twinRestore: {
      runtimeObjectsAvailable: runtimeObjects.length,
      accountVisible: runtimeObjects.some((object) => object?.objectType === "ACCOUNT" && object?.objectId === workspaceSession.accountId),
      proposalVisible: runtimeObjects.some((object) => object?.objectType === "PROPOSAL" && object?.objectId === workspaceSession.proposalId),
      scopeVersionVisible: Boolean(scopeVersion),
    },
    noWorkspaceOwnedLifecycleState: true,
    runtimeIsSingleSourceOfTruth: true,
  };
}

function requireUser(req, res) {
  const user = userFromBearerToken(req);
  if (!user) {
    errorResponse(res, 401, "Authentication token is missing or invalid.");
    return null;
  }
  return user;
}

export async function handleRuntimeWorkspaceSession(req, res, pathname) {
  const normalizedPath = pathname.replace(/\/+$/, "");
  if (!normalizedPath.startsWith("/api/runtime/workspace-session") && normalizedPath !== "/api/runtime/rehydrate") return false;
  if (handleOptions(req, res)) return true;
  const user = requireUser(req, res);
  if (!user) return true;

  if ((normalizedPath === "/api/runtime/workspace-session" || normalizedPath === "/api/runtime/workspace-session/current") && req.method === "GET") {
    const url = new URL(req.url ?? "/", `https://${req.headers.host ?? "runtime.invalid"}`);
    const workspaceSession = await currentWorkspaceSession(user, Object.fromEntries(url.searchParams.entries()));
    jsonResponse(res, 200, { workspaceSession, session: workspaceSession });
    return true;
  }

  if (normalizedPath === "/api/runtime/workspace-session" && (req.method === "POST" || req.method === "PUT")) {
    if (!userHasPermission(user, "workspace.commercial") && !userHasPermission(user, "proposal.manage") && !userHasPermission(user, "workspace.engineering.write") && !userHasPermission(user, "scopeversion.authority") && !userHasPermission(user, "platform.admin")) {
      errorResponse(res, 403, "You do not have authority to update Runtime WorkspaceSession.");
      return true;
    }
    const body = await readRequestJson(req);
    const input = body.workspaceSession ?? body.session ?? body;
    const workspaceSession = await updateRuntimeWorkspaceSession(input, user);
    jsonResponse(res, 200, { workspaceSession, session: workspaceSession });
    return true;
  }

  if (normalizedPath === "/api/runtime/rehydrate" && req.method === "GET") {
    const url = new URL(req.url ?? "/", `https://${req.headers.host ?? "runtime.invalid"}`);
    jsonResponse(res, 200, await buildRehydration(user, Object.fromEntries(url.searchParams.entries())));
    return true;
  }

  errorResponse(res, 405, "Runtime WorkspaceSession method not allowed.");
  return true;
}
