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

const DEFAULT_ACCOUNT_BLUEPRINTS = [
  {
    accountId: "google",
    customerId: "customer-google",
    name: "Google",
    accountType: "Hyperscaler",
    status: "Active RFP",
    salesOwner: "Ryan",
    primaryEngineeringContact: "Google Network Engineering",
    procurementContact: "Google Procurement",
    contacts: ["Network Engineering", "Sourcing", "Commercial Review"],
    activeOpportunities: ["Google Helium / Dobson diversity response"],
    existingNetworks: ["Customer-supplied KMZ references", "Helium route source package"],
    operationalObjects: ["Helium campus", "Muskogee target", "Stillwater target"],
    commercialEngagements: ["Google Helium commercial response"],
    proposalHistory: ["Initial Dobson commercial package", "Current sales corridor proposal"],
    customerReviewHistory: ["KMZ review pending", "Commercial review pending"],
    engineeringHistory: ["No ScopeVersion created; Route Engineering not yet owner"],
    notes: "Google remains the first production customer scenario for DAL Commercial Planning.",
  },
  {
    accountId: "fiberlight",
    customerId: "customer-fiberlight",
    name: "FiberLight",
    accountType: "Carrier",
    status: "Prospect",
    salesOwner: "Ryan",
    contacts: ["Carrier sales contact", "Network planning contact"],
    notes: "Account data is isolated. Selecting FiberLight does not display Google corridors, proposals, or assets.",
  },
  {
    accountId: "verizon",
    customerId: "customer-verizon",
    name: "Verizon",
    accountType: "Carrier",
    status: "Prospect",
    salesOwner: "Ryan",
    contacts: ["Carrier account contact"],
    notes: "Account context gates downstream commercial and map data.",
  },
  {
    accountId: "crown-castle",
    customerId: "customer-crown-castle",
    name: "Crown Castle",
    accountType: "Infrastructure provider",
    status: "Prospect",
    salesOwner: "Ryan",
    contacts: ["Infrastructure account contact"],
    notes: "Future imported networks will remain account-owned assets, not proposals.",
  },
  {
    accountId: "municipality",
    customerId: "customer-municipality",
    name: "Municipality",
    accountType: "Public sector",
    status: "Prospect",
    salesOwner: "Ryan",
    contacts: ["Municipal broadband lead"],
    notes: "Municipal network imports will enter as customer assets with authority state.",
  },
];

const DEFAULT_GOOGLE_CONTACTS = [
  {
    contactId: "contact-google-network-engineering",
    accountId: "google",
    name: "Google Network Engineering",
    title: "Network Engineering",
    role: "Engineering",
    email: "network-engineering@example.google",
    status: "Active",
  },
  {
    contactId: "contact-google-sourcing",
    accountId: "google",
    name: "Google Sourcing",
    title: "Sourcing",
    role: "Procurement",
    email: "sourcing@example.google",
    status: "Active",
  },
  {
    contactId: "contact-google-commercial-review",
    accountId: "google",
    name: "Google Commercial Review",
    title: "Commercial Review",
    role: "Commercial",
    email: "commercial-review@example.google",
    status: "Active",
  },
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
  return String(value ?? "runtime").replace(/[^a-zA-Z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").toLowerCase();
}

function runtimeCleanId(value) {
  return cleanId(value).toUpperCase();
}

function customerIdFor(accountId, record = {}) {
  const explicit = String(record.customerId ?? "").trim();
  if (explicit) return explicit;
  if (String(accountId).startsWith("customer-")) return String(accountId);
  return `customer-${cleanId(accountId)}`;
}

function userLabel(userId) {
  const user = findAlphaUserById(userId);
  return user?.name ?? userId;
}

function canReadAccount(record, user) {
  if (!record || !user) return false;
  return record.organizationId === user.organizationId;
}

function canWriteAccount(user) {
  return userHasPermission(user, "opportunity.manage") || userHasPermission(user, "customerDesign.manage") || userHasPermission(user, "workspace.commercial");
}

function normalizeAccount(record = {}, user, existing = null, options = {}) {
  const timestamp = options.timestamp ?? nowIso();
  const creating = !existing;
  const rawId = String(record.accountId ?? existing?.accountId ?? createId("account"));
  const accountId = cleanId(rawId);
  const ownerId = String(record.ownerId ?? existing?.ownerId ?? user.userId);
  const createdById = String(existing?.createdById ?? record.createdById ?? user.userId);
  const contactIds = unique([
    ...asArray(existing?.contactIds),
    ...asArray(record.contactIds),
  ]);
  const activityHistory = unique([
    ...asArray(existing?.activityHistory),
    ...asArray(record.activityHistory),
    ...asArray(record.historyIds),
  ]);
  const defaultEngagements = accountId === "google" ? ["Google Helium commercial response"] : [];
  return {
    ...existing,
    ...record,
    accountId,
    objectId: accountId,
    runtimeObjectId: String(record.runtimeObjectId ?? existing?.runtimeObjectId ?? `RUNTIME-ACCOUNT-${runtimeCleanId(accountId)}`),
    objectType: "ACCOUNT",
    customerId: customerIdFor(accountId, { ...existing, ...record }),
    name: String(record.name ?? existing?.name ?? "New Account"),
    accountType: String(record.accountType ?? existing?.accountType ?? "Prospect"),
    status: String(record.status ?? existing?.status ?? "Prospect"),
    salesOwner: String(record.salesOwner ?? existing?.salesOwner ?? user.name),
    primaryEngineeringContact: String(record.primaryEngineeringContact ?? existing?.primaryEngineeringContact ?? "TBD"),
    procurementContact: String(record.procurementContact ?? existing?.procurementContact ?? "TBD"),
    organization: record.organization ?? existing?.organization ?? "Teralinx",
    organizationId: record.organizationId ?? existing?.organizationId ?? user.organizationId,
    workspace: record.workspace ?? existing?.workspace ?? user.workspaceId,
    workspaceId: record.workspaceId ?? existing?.workspaceId ?? user.workspaceId,
    owner: userLabel(ownerId),
    ownerId,
    createdBy: userLabel(createdById),
    createdById,
    visibility: record.visibility ?? existing?.visibility ?? "ORGANIZATION",
    authority: record.authority ?? existing?.authority ?? {
      owner: ownerId,
      contributors: [],
      reviewers: [],
      approvers: [],
      executives: [],
      sharedWith: [],
    },
    lifecycleState: record.lifecycleState ?? existing?.lifecycleState ?? "ACTIVE",
    version: Number(existing?.version ?? record.version ?? 0) + (options.bumpVersion === false ? 0 : 1),
    contacts: unique(record.contacts ?? existing?.contacts),
    contactIds,
    activeOpportunities: unique(record.activeOpportunities ?? existing?.activeOpportunities),
    existingNetworks: unique(record.existingNetworks ?? existing?.existingNetworks),
    operationalObjects: unique(record.operationalObjects ?? existing?.operationalObjects),
    commercialEngagements: unique(record.commercialEngagements ?? existing?.commercialEngagements ?? defaultEngagements),
    proposalHistory: unique(record.proposalHistory ?? existing?.proposalHistory),
    customerReviewHistory: unique(record.customerReviewHistory ?? existing?.customerReviewHistory),
    engineeringHistory: unique(record.engineeringHistory ?? existing?.engineeringHistory),
    notes: String(record.notes ?? existing?.notes ?? "Governed Account workspace root."),
    activityHistory,
    historyIds: activityHistory,
    createdDate: existing?.createdDate ?? existing?.createdAt ?? record.createdDate ?? record.createdAt ?? timestamp,
    modifiedDate: timestamp,
    createdAt: existing?.createdAt ?? record.createdAt ?? timestamp,
    updatedAt: timestamp,
    initializedFromFixture: Boolean(record.initializedFromFixture ?? existing?.initializedFromFixture ?? (creating && options.seeded)),
  };
}

function normalizeContact(record = {}, user, existing = null, account = null, options = {}) {
  const timestamp = options.timestamp ?? nowIso();
  const rawAccountId = String(record.accountId ?? existing?.accountId ?? account?.accountId ?? "");
  const accountId = cleanId(rawAccountId);
  const contactId = String(record.contactId ?? existing?.contactId ?? createId(`contact-${accountId || "account"}`));
  const ownerId = String(record.ownerId ?? existing?.ownerId ?? account?.ownerId ?? user.userId);
  const createdById = String(existing?.createdById ?? record.createdById ?? user.userId);
  const activityHistory = unique([
    ...asArray(existing?.activityHistory),
    ...asArray(record.activityHistory),
    ...asArray(record.historyIds),
  ]);
  return {
    ...existing,
    ...record,
    contactId,
    objectId: contactId,
    runtimeObjectId: String(record.runtimeObjectId ?? existing?.runtimeObjectId ?? `RUNTIME-CONTACT-${runtimeCleanId(contactId)}`),
    objectType: "CONTACT",
    accountId,
    customerId: customerIdFor(accountId, account ?? record),
    name: String(record.name ?? existing?.name ?? "New Contact"),
    title: String(record.title ?? existing?.title ?? ""),
    role: String(record.role ?? existing?.role ?? "Commercial"),
    email: String(record.email ?? existing?.email ?? ""),
    phone: String(record.phone ?? existing?.phone ?? ""),
    status: String(record.status ?? existing?.status ?? "Active"),
    recipientWorkflows: unique(record.recipientWorkflows ?? existing?.recipientWorkflows ?? ["PROPOSAL_RECIPIENT", "CUSTOMER_REVIEW", "CUSTOMER_APPROVAL", "SOF_RECIPIENT"]),
    proposalRecipient: Boolean(record.proposalRecipient ?? existing?.proposalRecipient ?? true),
    customerReviewRecipient: Boolean(record.customerReviewRecipient ?? existing?.customerReviewRecipient ?? true),
    approvalAuthority: Boolean(record.approvalAuthority ?? existing?.approvalAuthority ?? true),
    sofRecipient: Boolean(record.sofRecipient ?? existing?.sofRecipient ?? true),
    serviceOrderRecipient: Boolean(record.serviceOrderRecipient ?? existing?.serviceOrderRecipient ?? record.sofRecipient ?? existing?.sofRecipient ?? true),
    organization: record.organization ?? existing?.organization ?? account?.organization ?? "Teralinx",
    organizationId: record.organizationId ?? existing?.organizationId ?? account?.organizationId ?? user.organizationId,
    workspace: record.workspace ?? existing?.workspace ?? account?.workspace ?? user.workspaceId,
    workspaceId: record.workspaceId ?? existing?.workspaceId ?? account?.workspaceId ?? user.workspaceId,
    owner: userLabel(ownerId),
    ownerId,
    createdBy: userLabel(createdById),
    createdById,
    visibility: record.visibility ?? existing?.visibility ?? account?.visibility ?? "ORGANIZATION",
    authority: record.authority ?? existing?.authority ?? account?.authority ?? {
      owner: ownerId,
      contributors: [],
      reviewers: [],
      approvers: [],
      executives: [],
      sharedWith: [],
    },
    lifecycleState: record.lifecycleState ?? existing?.lifecycleState ?? "ACTIVE",
    version: Number(existing?.version ?? record.version ?? 0) + (options.bumpVersion === false ? 0 : 1),
    activityHistory,
    historyIds: activityHistory,
    createdDate: existing?.createdDate ?? existing?.createdAt ?? record.createdDate ?? record.createdAt ?? timestamp,
    modifiedDate: timestamp,
    createdAt: existing?.createdAt ?? record.createdAt ?? timestamp,
    updatedAt: timestamp,
    initializedFromFixture: Boolean(record.initializedFromFixture ?? existing?.initializedFromFixture ?? options.seeded),
  };
}

async function runtimeHistoryEvent(record, user, eventType, details = "") {
  const timestamp = nowIso();
  const history = {
    historyId: `runtime-history-${record.objectType}-${record.objectId}-${eventType}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    eventType,
    actor: user.name,
    actorId: user.userId,
    objectType: record.objectType === "CONTACT" ? "Contact" : "Account",
    objectId: record.objectId,
    objectName: record.name,
    accountId: record.accountId,
    customerId: record.customerId,
    organizationId: record.organizationId,
    workspaceId: record.workspaceId,
    timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
    details,
    metadata: {
      accountId: record.accountId,
      customerId: record.customerId,
      lifecycleState: record.lifecycleState,
      version: record.version,
      authority: record.authority,
    },
  };
  await persistRecord(DIRS.runtimeHistory, history.historyId, history);
  return history;
}

async function persistRuntimeMirror(record) {
  await persistRecord(DIRS.runtimeObjects, record.runtimeObjectId, {
    runtimeId: record.runtimeObjectId,
    objectId: record.objectId,
    objectType: record.objectType,
    name: record.name,
    owner: record.owner,
    ownerId: record.ownerId,
    createdBy: record.createdBy,
    createdById: record.createdById,
    assignedTo: unique([
      ...(record.assignedTo ?? []),
      ...(record.authority?.contributors ?? []),
      ...(record.authority?.reviewers ?? []),
      ...(record.authority?.approvers ?? []),
      ...(record.authority?.executives ?? []),
    ]),
    organization: record.organizationId,
    organizationId: record.organizationId,
    workspace: record.workspaceId,
    workspaceId: record.workspaceId,
    customerId: record.customerId,
    accountId: record.accountId,
    visibility: record.visibility,
    authority: record.objectType === "ACCOUNT" ? "ACCOUNT_WORKSPACE_ROOT" : "ACCOUNT_CONTACT",
    authorityGrants: record.authority,
    lifecycleState: record.lifecycleState,
    version: record.version,
    evidenceIds: unique(record.evidenceIds),
    relationshipIds: unique(record.relationshipIds),
    sourceId: record.objectId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    metadata: {
      accountId: record.accountId,
      customerId: record.customerId,
      accountType: record.accountType,
      contactRole: record.role,
      contactId: record.contactId,
      recipientWorkflows: record.recipientWorkflows,
      proposalRecipient: record.proposalRecipient,
      customerReviewRecipient: record.customerReviewRecipient,
      approvalAuthority: record.approvalAuthority,
      sofRecipient: record.sofRecipient,
      serviceOrderRecipient: record.serviceOrderRecipient,
      status: record.status,
      contactIds: record.contactIds,
      noDuplicateObjects: true,
      noSynchronization: true,
    },
  });
}

async function persistAccount(record, user, eventType = "runtime.account.saved", details = "Account saved to the governed Account Library.") {
  const history = await runtimeHistoryEvent(record, user, eventType, details);
  const saved = await persistRecord(DIRS.accounts, record.accountId, {
    ...record,
    activityHistory: unique([...asArray(record.activityHistory), history.historyId]),
    historyIds: unique([...asArray(record.historyIds), history.historyId]),
    updatedAt: history.timestamp,
    modifiedDate: history.timestamp,
  });
  await persistRuntimeMirror(saved);
  return saved;
}

async function persistContact(record, user, eventType = "runtime.contact.saved", details = "Contact saved to the governed Contact Library.") {
  const history = await runtimeHistoryEvent(record, user, eventType, details);
  const saved = await persistRecord(DIRS.contacts, record.contactId, {
    ...record,
    activityHistory: unique([...asArray(record.activityHistory), history.historyId]),
    historyIds: unique([...asArray(record.historyIds), history.historyId]),
    updatedAt: history.timestamp,
    modifiedDate: history.timestamp,
  });
  await persistRuntimeMirror(saved);
  const account = await loadRecord(DIRS.accounts, saved.accountId).catch(() => null);
  if (account) {
    const nextAccount = {
      ...account,
      contactIds: unique([...asArray(account.contactIds), saved.contactId]),
      contacts: unique([...asArray(account.contacts), saved.name]),
      updatedAt: saved.updatedAt,
      modifiedDate: saved.updatedAt,
    };
    await persistRecord(DIRS.accounts, nextAccount.accountId, nextAccount);
    await persistRuntimeMirror(nextAccount);
  }
  return saved;
}

async function seedDefaultAccounts(user) {
  const existing = await listRecords(DIRS.accounts);
  if (existing.length) return;
  const timestamp = nowIso();
  for (const blueprint of DEFAULT_ACCOUNT_BLUEPRINTS) {
    const normalized = normalizeAccount({
      ...blueprint,
      organizationId: user.organizationId,
      workspaceId: user.workspaceId,
      ownerId: user.userId,
      createdById: user.userId,
    }, user, null, { timestamp, seeded: true });
    await persistAccount(normalized, user, "runtime.account.seeded", "Default Account workspace root initialized.");
  }
  const google = await loadRecord(DIRS.accounts, "google").catch(() => null);
  for (const contact of DEFAULT_GOOGLE_CONTACTS) {
    const normalized = normalizeContact(contact, user, null, google, { timestamp, seeded: true });
    await persistContact(normalized, user, "runtime.contact.seeded", "Default Google contact initialized.");
  }
}

function requireUser(req, res) {
  const user = userFromBearerToken(req);
  if (!user) {
    errorResponse(res, 401, "Authentication token is missing or invalid.");
    return null;
  }
  return user;
}

async function decorateAccount(account) {
  const contacts = (await listRecords(DIRS.contacts)).filter((contact) => contact?.accountId === account.accountId);
  return {
    ...account,
    contactIds: unique([...asArray(account.contactIds), ...contacts.map((contact) => contact.contactId)]),
    contacts: unique([...asArray(account.contacts), ...contacts.map((contact) => contact.name)]),
  };
}

async function handleListAccounts(res, user) {
  await seedDefaultAccounts(user);
  const records = await Promise.all(sortedByUpdated(await listRecords(DIRS.accounts))
    .map((record) => normalizeAccount(record, user, record, { bumpVersion: false }))
    .filter((record) => canReadAccount(record, user))
    .map(decorateAccount));
  jsonResponse(res, 200, { accounts: records, items: records });
}

async function handleGetAccount(res, accountId, user) {
  const existing = await loadRecord(DIRS.accounts, cleanId(accountId)).catch(() => null);
  if (!existing) {
    errorResponse(res, 404, `Account not found: ${accountId}`);
    return;
  }
  const record = normalizeAccount(existing, user, existing, { bumpVersion: false });
  if (!canReadAccount(record, user)) {
    errorResponse(res, 403, "You do not have authority to open this account.");
    return;
  }
  jsonResponse(res, 200, { account: await decorateAccount(record) });
}

async function handleSaveAccount(req, res, user, accountId = "") {
  if (!canWriteAccount(user)) {
    errorResponse(res, 403, "You do not have authority to save accounts.");
    return;
  }
  const body = await readRequestJson(req);
  const input = unwrapBody(body, "account", ["accounts", "items", "data"]);
  const records = Array.isArray(input) ? input : [input];
  const saved = [];
  for (const item of records) {
    const id = cleanId(item?.accountId ?? accountId ?? item?.name ?? createId("account"));
    const existing = await loadRecord(DIRS.accounts, id).catch(() => null);
    const normalized = normalizeAccount({ ...item, accountId: id }, user, existing);
    saved.push(await persistAccount(normalized, user));
  }
  if (Array.isArray(input)) jsonResponse(res, 201, { accounts: saved, items: saved });
  else jsonResponse(res, 201, { account: saved[0] });
}

async function handleListContacts(res, user, accountId = "") {
  await seedDefaultAccounts(user);
  const targetAccountId = cleanId(accountId);
  const records = sortedByUpdated((await listRecords(DIRS.contacts))
    .map((record) => normalizeContact(record, user, record, null, { bumpVersion: false }))
    .filter((record) => (!targetAccountId || record.accountId === targetAccountId) && record.organizationId === user.organizationId));
  jsonResponse(res, 200, { contacts: records, items: records });
}

async function handleGetContact(res, contactId, user) {
  const existing = await loadRecord(DIRS.contacts, contactId).catch(() => null);
  if (!existing) {
    errorResponse(res, 404, `Contact not found: ${contactId}`);
    return;
  }
  const record = normalizeContact(existing, user, existing, null, { bumpVersion: false });
  if (record.organizationId !== user.organizationId) {
    errorResponse(res, 403, "You do not have authority to open this contact.");
    return;
  }
  jsonResponse(res, 200, { contact: record });
}

async function handleSaveContact(req, res, user, accountId = "", contactId = "") {
  if (!canWriteAccount(user)) {
    errorResponse(res, 403, "You do not have authority to save contacts.");
    return;
  }
  const body = await readRequestJson(req);
  const input = unwrapBody(body, "contact", ["contacts", "items", "data"]);
  const records = Array.isArray(input) ? input : [input];
  const saved = [];
  for (const item of records) {
    const targetAccountId = cleanId(item?.accountId ?? accountId);
    const account = await loadRecord(DIRS.accounts, targetAccountId).catch(() => null);
    if (!account) {
      errorResponse(res, 404, `Account not found for contact: ${targetAccountId}`);
      return;
    }
    const id = String(item?.contactId ?? contactId ?? createId(`contact-${targetAccountId}`));
    const existing = await loadRecord(DIRS.contacts, id).catch(() => null);
    const normalized = normalizeContact({ ...item, contactId: id, accountId: targetAccountId }, user, existing, account);
    saved.push(await persistContact(normalized, user));
  }
  if (Array.isArray(input)) jsonResponse(res, 201, { contacts: saved, items: saved });
  else jsonResponse(res, 201, { contact: saved[0] });
}

export async function handleAccounts(req, res, pathname) {
  if (!pathname.startsWith("/api/accounts")) return false;
  if (handleOptions(req, res)) return true;

  const user = requireUser(req, res);
  if (!user) return true;

  const match = routeMatch(pathname, "/api/accounts");
  const parts = match?.base ? [] : pathname.slice("/api/accounts/".length).split("/").filter(Boolean).map(decodeURIComponent);

  if (parts.length === 0 && req.method === "GET") {
    await handleListAccounts(res, user);
    return true;
  }

  if (parts.length === 0 && req.method === "POST") {
    await handleSaveAccount(req, res, user);
    return true;
  }

  if (parts[0] === "contacts" && parts.length === 1 && req.method === "GET") {
    await handleListContacts(res, user);
    return true;
  }

  if (parts[0] === "contacts" && parts.length === 1 && req.method === "POST") {
    await handleSaveContact(req, res, user);
    return true;
  }

  if (parts[0] === "contacts" && parts.length === 2 && req.method === "GET") {
    await handleGetContact(res, parts[1], user);
    return true;
  }

  if (parts[0] === "contacts" && parts.length === 2 && (req.method === "PUT" || req.method === "POST")) {
    await handleSaveContact(req, res, user, "", parts[1]);
    return true;
  }

  if (parts.length === 1 && req.method === "GET") {
    await handleGetAccount(res, parts[0], user);
    return true;
  }

  if (parts.length === 1 && (req.method === "PUT" || req.method === "POST")) {
    await handleSaveAccount(req, res, user, parts[0]);
    return true;
  }

  if (parts.length === 2 && parts[1] === "contacts" && req.method === "GET") {
    await handleListContacts(res, user, parts[0]);
    return true;
  }

  if (parts.length === 2 && parts[1] === "contacts" && req.method === "POST") {
    await handleSaveContact(req, res, user, parts[0]);
    return true;
  }

  if (parts.length === 3 && parts[1] === "contacts" && req.method === "GET") {
    await handleGetContact(res, parts[2], user);
    return true;
  }

  if (parts.length === 3 && parts[1] === "contacts" && (req.method === "PUT" || req.method === "POST")) {
    await handleSaveContact(req, res, user, parts[0], parts[2]);
    return true;
  }

  errorResponse(res, 405, "Account Library method not allowed.");
  return true;
}
