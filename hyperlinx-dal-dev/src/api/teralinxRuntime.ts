import { DAL_API } from "../config/dalApi";

export type TeralinxUserRole = "ADMINISTRATOR_COO" | "CRO" | "CEO";

export type TeralinxPermission =
  | "platform.admin"
  | "runtime.deploy"
  | "users.manage"
  | "workspace.translate"
  | "workspace.commercial"
  | "workspace.proposal"
  | "workspace.salesEngineering"
  | "workspace.executiveReview"
  | "workspace.engineering.read"
  | "workspace.engineering.write"
  | "scopeversion.authority"
  | "customerDesign.read"
  | "customerDesign.manage"
  | "opportunity.read"
  | "opportunity.manage"
  | "proposal.read"
  | "proposal.manage";

export type TeralinxUser = {
  userId: string;
  username: string;
  name: string;
  title: string;
  role: TeralinxUserRole;
  organization: "Teralinx";
  permissions: TeralinxPermission[];
};

export type TeralinxAuthSession = {
  token: string;
  user: TeralinxUser;
  authenticatedAt: string;
  provider: "TERALINX_ALPHA_INTERNAL" | string;
};

export type TeralinxRuntimeInfo = {
  applicationName: string;
  applicationTitle: string;
  organization: "Teralinx";
  workspaceOwner: "Teralinx";
  runtimeVersion: string;
  gitCommit: string;
  buildDate: string;
  environment: string;
  runtimeStatus: "CONNECTED" | "DEGRADED" | "ERROR" | string;
  status: "CONNECTED" | "DEGRADED" | "ERROR" | string;
  serverStartedAt: string;
  sharedRuntime: boolean;
  libraries: {
    opportunityLibrary: boolean;
    customerDesignLibrary: boolean;
    engineeringLibrary: boolean;
    proposalLibrary: boolean;
    activityHistory: boolean;
  };
};

export type TeralinxActivityEvent = {
  activityId: string;
  userId: string;
  userName: string;
  userRole: TeralinxUserRole;
  action: string;
  objectType: string;
  objectId: string;
  objectName?: string;
  revision?: string;
  opportunityId?: string;
  customerId?: string;
  timestamp: string;
  createdAt: string;
  updatedAt: string;
  details?: string;
};

export type TeralinxActivityInput = Omit<TeralinxActivityEvent, "activityId" | "timestamp" | "createdAt" | "updatedAt" | "userId" | "userName" | "userRole"> & {
  timestamp?: string;
};

function apiUrl(path: string) {
  return `${DAL_API}${path}`;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), init);
  const text = await response.text().catch(() => "");
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}${text ? `: ${text}` : ""}`);
  return (text ? JSON.parse(text) : {}) as T;
}

function unwrapList<T>(data: any, keys: string[]): T[] {
  const items = keys.map((key) => data?.[key]).find(Array.isArray) ?? data?.items ?? data?.data ?? data;
  return Array.isArray(items) ? items : [];
}

export async function loginTeralinxUser(username: string, password: string) {
  return requestJson<TeralinxAuthSession>("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
}

export async function loadTeralinxRuntimeInfo() {
  return requestJson<TeralinxRuntimeInfo>("/api/runtime");
}

export async function listTeralinxActivity() {
  const data = await requestJson<any>("/api/activity");
  return unwrapList<TeralinxActivityEvent>(data, ["activity", "events"]).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export async function appendTeralinxActivity(session: TeralinxAuthSession, input: TeralinxActivityInput) {
  const timestamp = input.timestamp ?? new Date().toISOString();
  const event = {
    ...input,
    activityId: `activity-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    userId: session.user.userId,
    userName: session.user.name,
    userRole: session.user.role,
    timestamp,
  };
  const data = await requestJson<any>("/api/activity", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.token}`,
    },
    body: JSON.stringify({ activityEvent: event }),
  });
  return (data.activityEvent ?? data) as TeralinxActivityEvent;
}

export async function listCommercialOpportunities<T>() {
  const data = await requestJson<any>("/api/commercial/opportunities");
  return unwrapList<T>(data, ["opportunities", "commercialOpportunities"]);
}

export async function saveCommercialOpportunity<T extends { opportunityId: string }>(record: T) {
  const data = await requestJson<any>("/api/commercial/opportunities", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ opportunity: record }),
  });
  return (data.opportunity ?? data) as T;
}

export async function listEngineeringDrafts<T>() {
  const data = await requestJson<any>("/api/engineering/drafts");
  return unwrapList<T>(data, ["engineeringDrafts", "drafts"]);
}

export async function saveEngineeringDraft<T extends { engineeringDraftId: string }>(record: T) {
  const data = await requestJson<any>("/api/engineering/drafts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ engineeringDraft: record }),
  });
  return (data.engineeringDraft ?? data) as T;
}

export async function listProposalDrafts<T>() {
  const data = await requestJson<any>("/api/proposals");
  return unwrapList<T>(data, ["proposals", "proposalDrafts"]);
}

export async function saveProposalDraft<T extends { proposalRecordId: string }>(record: T) {
  const data = await requestJson<any>("/api/proposals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ proposal: record }),
  });
  return (data.proposal ?? data) as T;
}
