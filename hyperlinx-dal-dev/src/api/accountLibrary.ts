import { DAL_API } from "../config/dalApi";
import { withStoredAuthHeaders } from "./authHeaders";

export type GovernedAccount = {
  accountId: string;
  objectId?: string;
  runtimeObjectId?: string;
  objectType?: "ACCOUNT" | string;
  customerId: string;
  name: string;
  accountType: string;
  status: string;
  salesOwner: string;
  primaryEngineeringContact: string;
  procurementContact: string;
  organization?: string;
  organizationId?: string;
  workspace?: string;
  workspaceId?: string;
  owner?: string;
  ownerId?: string;
  createdBy?: string;
  createdById?: string;
  visibility?: string;
  authority?: Record<string, unknown>;
  lifecycleState?: string;
  version?: number;
  contacts: string[];
  contactIds: string[];
  activeOpportunities: string[];
  existingNetworks: string[];
  operationalObjects: string[];
  commercialEngagements: string[];
  proposalHistory: string[];
  customerReviewHistory: string[];
  engineeringHistory: string[];
  notes: string;
  activityHistory?: string[];
  historyIds?: string[];
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
};

export type GovernedContact = {
  contactId: string;
  objectId?: string;
  runtimeObjectId?: string;
  objectType?: "CONTACT" | string;
  accountId: string;
  customerId?: string;
  name: string;
  title: string;
  role: string;
  email: string;
  phone?: string;
  status: string;
  organization?: string;
  organizationId?: string;
  workspace?: string;
  workspaceId?: string;
  owner?: string;
  ownerId?: string;
  createdBy?: string;
  createdById?: string;
  visibility?: string;
  authority?: Record<string, unknown>;
  lifecycleState?: string;
  version?: number;
  activityHistory?: string[];
  historyIds?: string[];
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
};

export type RuntimeHistoryEvent = {
  historyId: string;
  eventType: string;
  actor?: string;
  actorId?: string;
  objectType?: string;
  objectId?: string;
  objectName?: string;
  accountId?: string;
  customerId?: string;
  organizationId?: string;
  workspaceId?: string;
  timestamp: string;
  createdAt?: string;
  updatedAt?: string;
  details?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
};

function apiUrl(path: string) {
  return `${DAL_API}${path}`;
}

async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(apiUrl(path), {
    ...init,
    headers: withStoredAuthHeaders(init.headers),
  });
  const text = await response.text().catch(() => "");
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}${text ? `: ${text}` : ""}`);
  return (text ? JSON.parse(text) : {}) as T;
}

function unwrapList<T>(data: any, keys: string[]): T[] {
  const items = keys.map((key) => data?.[key]).find(Array.isArray) ?? data?.items ?? data?.data ?? data;
  return Array.isArray(items) ? items : [];
}

export async function listGovernedAccounts() {
  const data = await requestJson<any>("/api/accounts");
  return unwrapList<GovernedAccount>(data, ["accounts"]);
}

export async function saveGovernedAccount(account: Partial<GovernedAccount>) {
  const data = await requestJson<any>(account.accountId ? `/api/accounts/${encodeURIComponent(account.accountId)}` : "/api/accounts", {
    method: account.accountId ? "PUT" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ account }),
  });
  return (data.account ?? data) as GovernedAccount;
}

export async function listGovernedContacts(accountId?: string) {
  const path = accountId ? `/api/accounts/${encodeURIComponent(accountId)}/contacts` : "/api/accounts/contacts";
  const data = await requestJson<any>(path);
  return unwrapList<GovernedContact>(data, ["contacts"]);
}

export async function saveGovernedContact(contact: Partial<GovernedContact>) {
  const accountId = String(contact.accountId ?? "");
  const path = contact.contactId
    ? `/api/accounts/${encodeURIComponent(accountId)}/contacts/${encodeURIComponent(contact.contactId)}`
    : `/api/accounts/${encodeURIComponent(accountId)}/contacts`;
  const data = await requestJson<any>(path, {
    method: contact.contactId ? "PUT" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contact }),
  });
  return (data.contact ?? data) as GovernedContact;
}

export async function listRuntimeHistory() {
  const data = await requestJson<any>("/api/runtime/history");
  return unwrapList<RuntimeHistoryEvent>(data, ["history", "events"]).sort((a, b) => String(b.timestamp ?? "").localeCompare(String(a.timestamp ?? "")));
}
