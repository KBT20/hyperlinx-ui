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

const ROLE_KEYS = ["contributors", "reviewers", "approvers", "executives"];

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
  if (normalized === "google") return "google-participant-001";
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

function normalizeAuthority(record = {}, ownerId) {
  const input = record.authority && typeof record.authority === "object" ? record.authority : {};
  const authority = {
    owner: ownerId,
    contributors: normalizeUserIds(input.contributors ?? record.contributors),
    reviewers: normalizeUserIds(input.reviewers ?? record.reviewers),
    approvers: normalizeUserIds(input.approvers ?? record.approvers),
    executives: normalizeUserIds(input.executives ?? record.executives),
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
  };
}

function authorityIncludes(record, userId) {
  const authority = normalizeAuthority(record, record.ownerId);
  return authority.owner === userId || authority.sharedWith.includes(userId);
}

function canReadOpportunity(record, user) {
  if (!record || !user) return false;
  if (record.organizationId !== user.organizationId) return false;
  if (record.visibility === "PUBLIC") return true;
  if (record.visibility === "ORGANIZATION") return true;
  if (record.ownerId === user.userId) return true;
  if (asArray(record.assignedTo).map(resolveUserId).includes(user.userId)) return true;
  return authorityIncludes(record, user.userId);
}

function canWriteOpportunity(record, user) {
  if (!record || !user) return false;
  const authority = normalizeAuthority(record, record.ownerId);
  return record.ownerId === user.userId ||
    authority.contributors.includes(user.userId) ||
    authority.approvers.includes(user.userId);
}

function canGovernOpportunity(record, user) {
  if (!record || !user) return false;
  const authority = normalizeAuthority(record, record.ownerId);
  return record.ownerId === user.userId || authority.approvers.includes(user.userId);
}

function lifecycleForStatus(status) {
  if (status === "ARCHIVED") return "ARCHIVED";
  if (status === "ACCEPTED") return "ACCEPTED";
  if (status === "REVIEW") return "IN_REVIEW";
  return "ACTIVE";
}

function normalizeCommercialOpportunity(record = {}, user, existing = null, options = {}) {
  const timestamp = options.timestamp ?? nowIso();
  const creating = !existing;
  const opportunityId = String(record.opportunityId ?? existing?.opportunityId ?? createId("commercial-opportunity"));
  const ownerId = creating ? user.userId : String(existing.ownerId || resolveUserId(existing.owner) || user.userId);
  const createdById = String(existing?.createdById || record.createdById || user.userId);
  const authority = normalizeAuthority({
    ...existing,
    ...record,
    authority: record.authority ?? existing?.authority,
  }, ownerId);
  const assignedTo = unique([
    ...normalizeUserIds(existing?.assignedTo),
    ...normalizeUserIds(record.assignedTo),
    ...authority.contributors,
    ...authority.reviewers,
    ...authority.approvers,
    ...authority.executives,
  ]);
  const visibility = record.visibility ?? existing?.visibility ?? "PRIVATE";
  const status = record.status ?? existing?.status ?? "SAVED";
  const version = options.bumpVersion === false
    ? Number(existing?.version ?? record.version ?? 1)
    : Number(existing?.version ?? record.version ?? 0) + (creating ? 1 : 1);
  const runtimeObjectId = String(record.runtimeObjectId ?? existing?.runtimeObjectId ?? `RUNTIME-OPPORTUNITY-${opportunityId}`);
  const evidenceLinks = unique(asArray(record.evidenceLinks ?? record.evidenceIds ?? existing?.evidenceLinks));
  const relationshipLinks = unique([
    ...asArray(existing?.relationshipLinks),
    ...asArray(record.relationshipLinks ?? record.relationshipIds),
    ...(record.cloneSourceOpportunityId ? [`DERIVED_FROM:${record.cloneSourceOpportunityId}`] : []),
  ]);
  const activityHistory = unique([
    ...asArray(existing?.activityHistory),
    ...asArray(record.activityHistory ?? record.historyIds),
  ]);

  return {
    ...existing,
    ...record,
    opportunityId,
    objectId: opportunityId,
    runtimeObjectId,
    objectType: "OPPORTUNITY",
    organization: record.organization ?? existing?.organization ?? "Teralinx",
    organizationId: record.organizationId ?? existing?.organizationId ?? user.organizationId,
    workspace: record.workspace ?? existing?.workspace ?? user.workspaceId,
    workspaceId: record.workspaceId ?? existing?.workspaceId ?? user.workspaceId,
    owner: userLabel(ownerId),
    ownerId,
    createdBy: userLabel(createdById),
    createdById,
    assignedTo,
    assignment: assignmentFromAuthority(authority),
    visibility,
    authority,
    lifecycleState: record.lifecycleState ?? lifecycleForStatus(status),
    version,
    status,
    selectedScopeId: record.selectedScopeId ?? existing?.selectedScopeId ?? "",
    activeView: record.activeView ?? existing?.activeView ?? "networks",
    commercialDraftType: record.commercialDraftType ?? existing?.commercialDraftType ?? null,
    liveSession: record.liveSession ?? existing?.liveSession ?? null,
    snapshotCount: Number(record.snapshotCount ?? existing?.snapshotCount ?? 0),
    evidenceLinks,
    evidenceIds: evidenceLinks,
    relationshipLinks,
    relationshipIds: relationshipLinks,
    activityHistory,
    historyIds: activityHistory,
    createdDate: existing?.createdDate ?? existing?.createdAt ?? record.createdDate ?? record.createdAt ?? timestamp,
    modifiedDate: timestamp,
    createdAt: existing?.createdAt ?? record.createdAt ?? timestamp,
    updatedAt: timestamp,
    archivedAt: status === "ARCHIVED" ? (record.archivedAt ?? existing?.archivedAt ?? timestamp) : record.archivedAt ?? existing?.archivedAt,
    noScopeVersionCreation: true,
    noInventoryMutation: true,
  };
}

async function persistRuntimeMirror(record) {
  await persistRecord(DIRS.runtimeObjects, record.runtimeObjectId, {
    runtimeId: record.runtimeObjectId,
    objectId: record.opportunityId,
    objectType: "OPPORTUNITY",
    name: record.name,
    owner: record.owner,
    ownerId: record.ownerId,
    createdBy: record.createdBy,
    createdById: record.createdById,
    assignedTo: record.assignedTo,
    organization: record.organizationId,
    workspace: record.workspaceId,
    visibility: record.visibility,
    authority: "COMMERCIAL_REVIEW",
    authorityGrants: record.authority,
    lifecycleState: record.lifecycleState,
    version: record.version,
    evidenceIds: record.evidenceLinks,
    evidenceLinks: record.evidenceLinks,
    relationshipIds: record.relationshipLinks,
    relationshipLinks: record.relationshipLinks,
    sourceId: record.opportunityId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    metadata: {
      accountId: record.accountId,
      status: record.status,
      selectedScopeId: record.selectedScopeId,
      activityHistory: record.activityHistory,
      noDuplicateObjects: true,
      noScopeVersionCreation: record.noScopeVersionCreation,
      noInventoryMutation: record.noInventoryMutation,
    },
  });
}

async function readOpportunity(id) {
  return loadRecord(DIRS.commercialOpportunities, id);
}

function runtimeHistoryEvent(record, user, eventType, details = "") {
  const timestamp = nowIso();
  return {
    historyId: `runtime-history-${record.opportunityId}-${eventType}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    eventType,
    actor: user.name,
    actorId: user.userId,
    objectType: "Opportunity",
    objectId: record.opportunityId,
    objectName: record.name,
    organizationId: record.organizationId,
    workspaceId: record.workspaceId,
    timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
    details,
    metadata: {
      visibility: record.visibility,
      lifecycleState: record.lifecycleState,
      version: record.version,
      authority: record.authority,
    },
  };
}

async function saveOpportunity(record, user, eventType = "runtime.opportunity.saved", details = "Opportunity saved to the governed Runtime Object Library.") {
  const history = runtimeHistoryEvent(record, user, eventType, details);
  await persistRecord(DIRS.runtimeHistory, history.historyId, history);
  const recordWithHistory = {
    ...record,
    activityHistory: unique([...asArray(record.activityHistory), history.historyId]),
    historyIds: unique([...asArray(record.historyIds), history.historyId]),
  };
  const saved = await persistRecord(DIRS.commercialOpportunities, recordWithHistory.opportunityId, recordWithHistory);
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

async function handleList(req, res, user) {
  const records = sortedByUpdated((await listRecords(DIRS.commercialOpportunities))
    .map((record) => normalizeCommercialOpportunity(record, user, record, { bumpVersion: false }))
    .filter((record) => canReadOpportunity(record, user)));
  jsonResponse(res, 200, { opportunities: records });
}

async function handleGet(req, res, id, user) {
  try {
    const record = normalizeCommercialOpportunity(await readOpportunity(id), user, await readOpportunity(id), { bumpVersion: false });
    if (!canReadOpportunity(record, user)) {
      errorResponse(res, 403, "You do not have authority to open this opportunity.");
      return;
    }
    jsonResponse(res, 200, { opportunity: record });
  } catch {
    errorResponse(res, 404, `Opportunity not found: ${id}`);
  }
}

async function handleSave(req, res, user, id = "") {
  if (!userHasPermission(user, "opportunity.manage")) {
    errorResponse(res, 403, "You do not have authority to save opportunities.");
    return;
  }
  const body = await readRequestJson(req);
  const input = unwrapBody(body, "opportunity", ["opportunities", "commercialOpportunities", "items", "data"]);
  const records = Array.isArray(input) ? input : [input];
  const saved = [];
  for (const item of records) {
    const opportunityId = String(item?.opportunityId ?? id ?? "");
    const existing = opportunityId ? await readOpportunity(opportunityId).catch(() => null) : null;
    if (existing && !canWriteOpportunity(existing, user)) {
      errorResponse(res, 403, "You cannot modify an opportunity unless you own it or have contributor/approver authority.");
      return;
    }
    const normalized = normalizeCommercialOpportunity({ ...item, opportunityId: opportunityId || item?.opportunityId }, user, existing);
    saved.push(await saveOpportunity(normalized, user, "runtime.opportunity.saved", "Opportunity saved with owner, workspace, visibility, authority, and lifecycle metadata."));
  }
  if (Array.isArray(input)) jsonResponse(res, 201, { opportunities: saved, items: saved });
  else jsonResponse(res, 201, { opportunity: saved[0] });
}

async function handleOpen(req, res, id, user) {
  const existing = await readOpportunity(id).catch(() => null);
  if (!existing) {
    errorResponse(res, 404, `Opportunity not found: ${id}`);
    return;
  }
  const record = normalizeCommercialOpportunity(existing, user, existing, { bumpVersion: false });
  if (!canReadOpportunity(record, user)) {
    errorResponse(res, 403, "You do not have authority to open this opportunity.");
    return;
  }
  const opened = {
    ...record,
    status: record.status === "ARCHIVED" ? "ARCHIVED" : "RECENT",
    lastOpenedBy: user.name,
    lastOpenedById: user.userId,
    lastOpenedAt: nowIso(),
    updatedAt: nowIso(),
    modifiedDate: nowIso(),
  };
  jsonResponse(res, 200, { opportunity: await saveOpportunity(opened, user, "runtime.opportunity.opened", "Opportunity opened from the governed Runtime Object Library.") });
}

async function handleArchive(req, res, id, user) {
  const existing = await readOpportunity(id).catch(() => null);
  if (!existing) {
    errorResponse(res, 404, `Opportunity not found: ${id}`);
    return;
  }
  if (!canGovernOpportunity(existing, user)) {
    errorResponse(res, 403, "Only the owner or an approver can archive this opportunity.");
    return;
  }
  const archived = normalizeCommercialOpportunity({ ...existing, status: "ARCHIVED", lifecycleState: "ARCHIVED" }, user, existing);
  jsonResponse(res, 200, { opportunity: await saveOpportunity(archived, user, "runtime.opportunity.archived", "Opportunity archived by governing authority.") });
}

async function handleClone(req, res, id, user) {
  if (!userHasPermission(user, "opportunity.manage")) {
    errorResponse(res, 403, "You do not have authority to clone opportunities.");
    return;
  }
  const existing = await readOpportunity(id).catch(() => null);
  if (!existing) {
    errorResponse(res, 404, `Opportunity not found: ${id}`);
    return;
  }
  const source = normalizeCommercialOpportunity(existing, user, existing, { bumpVersion: false });
  if (!canReadOpportunity(source, user)) {
    errorResponse(res, 403, "You do not have authority to clone this opportunity.");
    return;
  }
  const timestamp = nowIso();
  const cloneId = `COMMERCIAL-OPPORTUNITY-${source.accountId ?? "account"}-${Date.now()}`;
  const clone = normalizeCommercialOpportunity({
    ...source,
    opportunityId: cloneId,
    runtimeObjectId: `RUNTIME-OPPORTUNITY-${cloneId}`,
    name: `${source.name} Clone`,
    status: "SAVED",
    visibility: "PRIVATE",
    authority: { owner: user.userId, contributors: [], reviewers: [], approvers: [], executives: [] },
    assignedTo: [],
    cloneSourceOpportunityId: source.opportunityId,
    relationshipLinks: [...asArray(source.relationshipLinks), `DERIVED_FROM:${source.opportunityId}`],
    createdAt: timestamp,
    createdDate: timestamp,
  }, user, null, { timestamp });
  jsonResponse(res, 201, { opportunity: await saveOpportunity(clone, user, "runtime.opportunity.cloned", `Opportunity cloned from ${source.opportunityId}.`) });
}

async function handleShare(req, res, id, user) {
  const existing = await readOpportunity(id).catch(() => null);
  if (!existing) {
    errorResponse(res, 404, `Opportunity not found: ${id}`);
    return;
  }
  if (!canGovernOpportunity(existing, user)) {
    errorResponse(res, 403, "Only the owner or an approver can share this opportunity.");
    return;
  }
  const body = await readRequestJson(req);
  const role = ROLE_KEYS.includes(String(body.role)) ? String(body.role) : "reviewers";
  const targetUserIds = normalizeUserIds(body.targetUserIds ?? body.userIds ?? body.userId ?? body.username);
  if (!targetUserIds.length) {
    errorResponse(res, 400, "Share target is required.");
    return;
  }
  const authority = normalizeAuthority(existing, existing.ownerId);
  authority[role] = unique([...authority[role], ...targetUserIds]);
  const shared = normalizeCommercialOpportunity({
    ...existing,
    visibility: "SHARED",
    authority,
    assignedTo: unique([...asArray(existing.assignedTo), ...targetUserIds]),
  }, user, existing);
  jsonResponse(res, 200, { opportunity: await saveOpportunity(shared, user, "runtime.opportunity.shared", `Opportunity shared with ${targetUserIds.map(userLabel).join(", ")}.`) });
}

async function handleAssign(req, res, id, user) {
  const existing = await readOpportunity(id).catch(() => null);
  if (!existing) {
    errorResponse(res, 404, `Opportunity not found: ${id}`);
    return;
  }
  if (!canGovernOpportunity(existing, user)) {
    errorResponse(res, 403, "Only the owner or an approver can assign this opportunity.");
    return;
  }
  const body = await readRequestJson(req);
  const contributors = normalizeUserIds(body.contributors);
  const reviewers = normalizeUserIds(body.reviewers);
  const approvers = normalizeUserIds(body.approvers);
  const executives = normalizeUserIds(body.executives);
  const assignedTo = normalizeUserIds(body.assignedTo ?? body.userIds ?? body.userId);
  const authority = normalizeAuthority(existing, existing.ownerId);
  authority.contributors = unique([...authority.contributors, ...contributors]);
  authority.reviewers = unique([...authority.reviewers, ...reviewers]);
  authority.approvers = unique([...authority.approvers, ...approvers]);
  authority.executives = unique([...authority.executives, ...executives]);
  const nextAssigned = unique([
    ...asArray(existing.assignedTo),
    ...assignedTo,
    ...contributors,
    ...reviewers,
    ...approvers,
    ...executives,
  ]);
  const assigned = normalizeCommercialOpportunity({
    ...existing,
    visibility: nextAssigned.length ? "SHARED" : existing.visibility,
    authority,
    assignedTo: nextAssigned,
  }, user, existing);
  jsonResponse(res, 200, { opportunity: await saveOpportunity(assigned, user, "runtime.opportunity.assigned", "Opportunity assignment and authority updated.") });
}

export async function handleCommercialOpportunities(req, res, pathname) {
  const match = routeMatch(pathname, "/api/commercial/opportunities");
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

  if (!match.base && req.method === "GET") {
    await handleGet(req, res, match.id, user);
    return true;
  }

  if (!match.base && (req.method === "PUT" || req.method === "POST") && !match.action) {
    await handleSave(req, res, user, match.id);
    return true;
  }

  if (!match.base && req.method === "POST" && match.action === "open") {
    await handleOpen(req, res, match.id, user);
    return true;
  }

  if (!match.base && req.method === "POST" && match.action === "clone") {
    await handleClone(req, res, match.id, user);
    return true;
  }

  if (!match.base && req.method === "POST" && match.action === "archive") {
    await handleArchive(req, res, match.id, user);
    return true;
  }

  if (!match.base && req.method === "POST" && match.action === "share") {
    await handleShare(req, res, match.id, user);
    return true;
  }

  if (!match.base && req.method === "POST" && match.action === "assign") {
    await handleAssign(req, res, match.id, user);
    return true;
  }

  errorResponse(res, 405, "Opportunity Library method not allowed.");
  return true;
}
