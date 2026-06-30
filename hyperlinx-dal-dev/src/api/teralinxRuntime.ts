import { DAL_API } from "../config/dalApi";
import { withStoredAuthHeaders } from "./authHeaders";

export type TeralinxUserRole = "ADMINISTRATOR_COO" | "CRO" | "CEO" | "CUSTOMER_PARTICIPANT";

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
  | "proposal.review"
  | "proposal.manage";

export type TeralinxUser = {
  userId: string;
  organizationId: string;
  workspaceId: string;
  username: string;
  name: string;
  title: string;
  role: TeralinxUserRole;
  organization: "Teralinx";
  permissions: TeralinxPermission[];
  preferences: Record<string, unknown>;
  dashboard: {
    sections: string[];
    executiveOverview?: boolean;
    organizationPipeline?: boolean;
    revenue?: boolean;
    operationalIntelligence?: boolean;
  };
  assignments: string[];
  notifications: string[];
  pinnedObjects: string[];
  workspace: TeralinxWorkspace;
};

export type TeralinxWorkspace = {
  workspaceId: string;
  userId: string;
  organizationId: string;
  name: string;
  preferences: Record<string, unknown>;
  dashboard: Record<string, unknown>;
  recentActivity: string[];
  assignments: string[];
  notifications: string[];
  pinnedObjects: string[];
  createdAt: string;
  updatedAt: string;
};

export type TeralinxAuthSession = {
  token: string;
  user: TeralinxUser;
  workspace?: TeralinxWorkspace;
  authenticatedAt: string;
  provider: "TERALINX_ALPHA_INTERNAL" | string;
};

export type TeralinxRuntimeInfo = {
  application: string;
  applicationName: string;
  applicationTitle: string;
  organization: "Teralinx";
  workspaceOwner: "Teralinx";
  version: string;
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
    scopeVersionLibrary: boolean;
    proposalLibrary: boolean;
    activityHistory: boolean;
    evidenceRegistry: boolean;
    runtimeObjectLibrary: boolean;
    relationshipGraph: boolean;
    workspaceLibrary: boolean;
    tenantRegistry: boolean;
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

export type ProposalRuntimeStatus =
  | "COMMERCIAL_DRAFT"
  | "INTERNAL_COMMERCIAL_REVIEW"
  | "WAITING_CUSTOMER_REVIEW"
  | "CUSTOMER_COMMENTS"
  | "COMMERCIAL_REVISION"
  | "CUSTOMER_CHANGES_REQUESTED"
  | "CUSTOMER_APPROVED"
  | "READY_FOR_IOF_PACKAGE"
  | "SALES_ENGINEERING_REVIEW"
  | "CERTIFIED_IOF_PACKAGE"
  | "CUSTOMER_REJECTED"
  | "WITHDRAWN"
  | "ARCHIVED";

export type ProposalReadiness = {
  proposalId: string;
  status: "READY" | "BLOCKED" | string;
  canCreateDraftIofPackage: boolean;
  customerApproved: boolean;
  proposalComplete: boolean;
  runtimeValid: boolean;
  confidence: number;
  missingInformation: string[];
  blockingIssues: string[];
  recommendation: string;
  commercial: Record<string, unknown>;
  customer: Record<string, unknown>;
  engineering: Record<string, unknown>;
  marketplace: Record<string, unknown>;
  runtimeHealth: Record<string, unknown>;
};

export type ProposalRuntimeObject = {
  proposalId: string;
  proposalRecordId: string;
  proposalNumber: string;
  customerId: string;
  opportunityId: string;
  organizationId: string;
  workspaceId: string;
  owner: string;
  ownerId: string;
  commercialOwner: string;
  commercialOwnerId: string;
  createdBy: string;
  createdById: string;
  assignedCustomerUsers: string[];
  assignedTo: string[];
  visibility: "PRIVATE" | "SHARED" | "ORGANIZATION" | "PUBLIC" | string;
  status: ProposalRuntimeStatus | string;
  approvalState: string;
  lifecycleState: string;
  version: number;
  title: string;
  summary: string;
  executiveSummary: string;
  pricingSummary: Record<string, unknown>;
  marginSummary: Record<string, unknown>;
  confidenceSummary: Record<string, unknown>;
  commercialAssumptionIds: string[];
  dealPointIds: string[];
  runtimeObjectId: string;
  runtimeObjectIds: string[];
  runtimeRelationshipIds: string[];
  runtimeEvidenceIds: string[];
  existingInventoryReferences: string[];
  customerDesignReferences: string[];
  customerTwinReference: string;
  geometryReferences: string[];
  proposalDocumentReferences: string[];
  attachments: Array<Record<string, unknown>>;
  comments: Array<Record<string, unknown>>;
  reviewers: string[];
  approvals: Array<Record<string, unknown>>;
  history: Array<Record<string, unknown>>;
  historyIds: string[];
  readiness: ProposalReadiness;
  nextLifecycleAction: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
};

export type EngineeringReviewQueueItem = {
  packageId: string;
  packageReadiness: Record<string, unknown>;
  proposalSummary: Record<string, unknown>;
  commercialConfidence: number;
  engineeringReadiness: string;
  assemblyReport: Record<string, unknown>;
  packageStatus: string;
  assignedEngineer: string;
  assignedEngineerId: string;
  priority: string;
  submissionDate: string;
  submittedAt: string;
  customer: string;
  customerId: string;
  opportunity: string;
  opportunityId: string;
  proposalId: string;
  proposedUnitCount: number;
  certifiedUnitCount: number;
  status: string;
  updatedAt: string;
};

export type ProposedIofUnit = {
  unitId: string;
  unitType: string;
  name: string;
  status: "PROPOSED" | "CERTIFIED" | "REJECTED" | string;
  sourceRuntimeObjectId?: string;
  runtimeObjectIds: string[];
  runtimeRelationshipIds: string[];
  runtimeEvidenceIds: string[];
  geometryReferences: string[];
  dependencyIds: string[];
  engineeringNote?: string;
  engineeringConfidence?: number;
  engineeringRisk?: string;
  engineeringComments?: unknown[];
  immutable?: boolean;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
};

export type DraftIofPackageRuntime = {
  packageId: string;
  draftPackageId: string;
  packageType: string;
  status: string;
  workflowStatus: string;
  proposalId: string;
  customerId: string;
  opportunityId: string;
  assignedEngineerId: string;
  assignedEngineer: string;
  priority: string;
  submittedAt: string;
  proposalSummary: Record<string, unknown>;
  commercialSummary: Record<string, unknown>;
  customerSummary: Record<string, unknown>;
  packageReadiness: Record<string, unknown>;
  engineeringReadiness: string;
  commercialConfidence: number;
  assemblyReport: Record<string, unknown>;
  proposedIofUnits: ProposedIofUnit[];
  runtimeObjectIds: string[];
  runtimeRelationshipIds: string[];
  runtimeEvidenceIds: string[];
  existingInventoryReferences: string[];
  customerDesignReferences: string[];
  customerTwinReference: string;
  geometryReferences: string[];
  historyIds: string[];
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
};

export type CertifiedIofPackageRuntime = DraftIofPackageRuntime & {
  certifiedPackageId: string;
  sourcePackageId: string;
  certifiedAt: string;
  certifiedBy: string;
  certifiedById: string;
  engineeringChecklist: Record<string, unknown>;
  certificationConfidence: number;
  certifiedIofUnits: ProposedIofUnit[];
  executionAuthorizationCertificateId: string;
  scopeVersionId?: string;
  executionAuthorized?: boolean;
  immutable: boolean;
};

export type ExecutionAuthorizationCertificate = {
  certificateId: string;
  proposalId: string;
  draftIofPackageId: string;
  certifiedIofPackageId: string;
  scopeVersionId: string;
  engineeringApproverId: string;
  engineeringApprover: string;
  certificationTimestamp: string;
  engineeringChecklist: Record<string, unknown>;
  authorityTransfer: Record<string, unknown>;
  runtimeObjectCount: number;
  relationshipCount: number;
  evidenceCount: number;
  certificationConfidence: number;
  assemblyFingerprint: string;
  status: string;
  immutable: boolean;
  createdAt: string;
  updatedAt: string;
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

function authHeaders(session?: TeralinxAuthSession | null, headers: HeadersInit = {}) {
  if (!session?.token) return withStoredAuthHeaders(headers);
  return {
    ...headers,
    Authorization: `Bearer ${session.token}`,
  };
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

export async function listCommercialOpportunities<T>(session?: TeralinxAuthSession | null) {
  const data = await requestJson<any>("/api/commercial/opportunities", {
    headers: authHeaders(session),
  });
  return unwrapList<T>(data, ["opportunities", "commercialOpportunities"]);
}

export async function saveCommercialOpportunity<T extends { opportunityId: string }>(record: T, session?: TeralinxAuthSession | null) {
  const data = await requestJson<any>("/api/commercial/opportunities", {
    method: "POST",
    headers: authHeaders(session, { "Content-Type": "application/json" }),
    body: JSON.stringify({ opportunity: record }),
  });
  return (data.opportunity ?? data) as T;
}

export async function openCommercialOpportunity<T>(opportunityId: string, session?: TeralinxAuthSession | null) {
  const data = await requestJson<any>(`/api/commercial/opportunities/${encodeURIComponent(opportunityId)}/open`, {
    method: "POST",
    headers: authHeaders(session, { "Content-Type": "application/json" }),
  });
  return (data.opportunity ?? data) as T;
}

export async function cloneCommercialOpportunity<T>(opportunityId: string, session?: TeralinxAuthSession | null) {
  const data = await requestJson<any>(`/api/commercial/opportunities/${encodeURIComponent(opportunityId)}/clone`, {
    method: "POST",
    headers: authHeaders(session, { "Content-Type": "application/json" }),
  });
  return (data.opportunity ?? data) as T;
}

export async function archiveCommercialOpportunity<T>(opportunityId: string, session?: TeralinxAuthSession | null) {
  const data = await requestJson<any>(`/api/commercial/opportunities/${encodeURIComponent(opportunityId)}/archive`, {
    method: "POST",
    headers: authHeaders(session, { "Content-Type": "application/json" }),
  });
  return (data.opportunity ?? data) as T;
}

export async function shareCommercialOpportunity<T>(
  opportunityId: string,
  input: { userId?: string; username?: string; targetUserIds?: string[]; role?: "contributors" | "reviewers" | "approvers" | "executives" },
  session?: TeralinxAuthSession | null,
) {
  const data = await requestJson<any>(`/api/commercial/opportunities/${encodeURIComponent(opportunityId)}/share`, {
    method: "POST",
    headers: authHeaders(session, { "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  return (data.opportunity ?? data) as T;
}

export async function assignCommercialOpportunity<T>(
  opportunityId: string,
  input: { assignedTo?: string[]; contributors?: string[]; reviewers?: string[]; approvers?: string[]; executives?: string[] },
  session?: TeralinxAuthSession | null,
) {
  const data = await requestJson<any>(`/api/commercial/opportunities/${encodeURIComponent(opportunityId)}/assign`, {
    method: "POST",
    headers: authHeaders(session, { "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  return (data.opportunity ?? data) as T;
}

export async function listEngineeringDrafts<T>() {
  const data = await requestJson<any>("/api/engineering/drafts", {
    headers: authHeaders(),
  });
  return unwrapList<T>(data, ["engineeringDrafts", "drafts"]);
}

export async function saveEngineeringDraft<T extends { engineeringDraftId: string }>(record: T) {
  const data = await requestJson<any>("/api/engineering/drafts", {
    method: "POST",
    headers: authHeaders(null, { "Content-Type": "application/json" }),
    body: JSON.stringify({ engineeringDraft: record }),
  });
  return (data.engineeringDraft ?? data) as T;
}

export async function listProposalDrafts<T>(session?: TeralinxAuthSession | null) {
  const data = await requestJson<any>("/api/proposals", {
    headers: authHeaders(session),
  });
  return unwrapList<T>(data, ["proposals", "proposalDrafts"]);
}

export async function saveProposalDraft<T extends { proposalRecordId?: string; proposalId?: string }>(record: T, session?: TeralinxAuthSession | null) {
  const data = await requestJson<any>("/api/proposals", {
    method: "POST",
    headers: authHeaders(session, { "Content-Type": "application/json" }),
    body: JSON.stringify({ proposal: record }),
  });
  return (data.proposal ?? data) as T;
}

export async function listProposalRuntimeObjects<T extends ProposalRuntimeObject = ProposalRuntimeObject>(session?: TeralinxAuthSession | null) {
  return listProposalDrafts<T>(session);
}

async function proposalAction<T>(proposalId: string, action: string, body?: unknown, session?: TeralinxAuthSession | null) {
  const init: RequestInit = {
    method: "POST",
    headers: authHeaders(session, { "Content-Type": "application/json" }),
  };
  if (body !== undefined) init.body = JSON.stringify(body);
  const data = await requestJson<any>(`/api/proposals/${encodeURIComponent(proposalId)}/${action}`, init);
  return (data.proposal ?? data) as T;
}

export async function openProposalRuntimeObject<T extends ProposalRuntimeObject = ProposalRuntimeObject>(proposalId: string, session?: TeralinxAuthSession | null) {
  return proposalAction<T>(proposalId, "open", undefined, session);
}

export async function assignProposalRuntimeObject<T extends ProposalRuntimeObject = ProposalRuntimeObject>(
  proposalId: string,
  input: {
    assignedTo?: string[];
    assignedCustomerUsers?: string[];
    customerUsers?: string[];
    contributors?: string[];
    reviewers?: string[];
    approvers?: string[];
    executives?: string[];
    salesEngineering?: string[];
  },
  session?: TeralinxAuthSession | null,
) {
  return proposalAction<T>(proposalId, "assign", input, session);
}

export async function submitProposalToCustomer<T extends ProposalRuntimeObject = ProposalRuntimeObject>(
  proposalId: string,
  input: { assignedCustomerUsers?: string[]; customerUsers?: string[]; customerReviewers?: string[] } = {},
  session?: TeralinxAuthSession | null,
) {
  return proposalAction<T>(proposalId, "submit-customer", input, session);
}

export async function withdrawProposalRuntimeObject<T extends ProposalRuntimeObject = ProposalRuntimeObject>(proposalId: string, session?: TeralinxAuthSession | null) {
  return proposalAction<T>(proposalId, "withdraw", undefined, session);
}

export async function duplicateProposalRuntimeObject<T extends ProposalRuntimeObject = ProposalRuntimeObject>(proposalId: string, session?: TeralinxAuthSession | null) {
  return proposalAction<T>(proposalId, "duplicate", undefined, session);
}

export async function archiveProposalRuntimeObject<T extends ProposalRuntimeObject = ProposalRuntimeObject>(proposalId: string, session?: TeralinxAuthSession | null) {
  return proposalAction<T>(proposalId, "archive", undefined, session);
}

export async function createProposalRevision<T extends ProposalRuntimeObject = ProposalRuntimeObject>(
  proposalId: string,
  input: { reason?: string; proposal?: Partial<T>; changes?: Record<string, unknown> } = {},
  session?: TeralinxAuthSession | null,
) {
  return proposalAction<T>(proposalId, "revision", input, session);
}

export async function commentProposalRuntimeObject<T extends ProposalRuntimeObject = ProposalRuntimeObject>(
  proposalId: string,
  input: { comment?: string; text?: string; visibility?: string },
  session?: TeralinxAuthSession | null,
) {
  return proposalAction<T>(proposalId, "comment", input, session);
}

export async function uploadProposalEvidence<T extends ProposalRuntimeObject = ProposalRuntimeObject>(
  proposalId: string,
  input: { evidenceId?: string; sourceName?: string; fileName?: string; name?: string; sourceType?: string; metadata?: Record<string, unknown> },
  session?: TeralinxAuthSession | null,
) {
  const data = await requestJson<any>(`/api/proposals/${encodeURIComponent(proposalId)}/upload-evidence`, {
    method: "POST",
    headers: authHeaders(session, { "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  return { proposal: (data.proposal ?? data) as T, evidence: data.evidence };
}

export async function requestProposalChanges<T extends ProposalRuntimeObject = ProposalRuntimeObject>(
  proposalId: string,
  input: { comment?: string; reason?: string; text?: string },
  session?: TeralinxAuthSession | null,
) {
  return proposalAction<T>(proposalId, "request-changes", input, session);
}

export async function approveProposalRuntimeObject<T extends ProposalRuntimeObject = ProposalRuntimeObject>(
  proposalId: string,
  input: { comment?: string } = {},
  session?: TeralinxAuthSession | null,
) {
  return proposalAction<T>(proposalId, "approve", input, session);
}

export async function rejectProposalRuntimeObject<T extends ProposalRuntimeObject = ProposalRuntimeObject>(
  proposalId: string,
  input: { comment?: string; reason?: string } = {},
  session?: TeralinxAuthSession | null,
) {
  return proposalAction<T>(proposalId, "reject", input, session);
}

export async function getProposalReadiness(proposalId: string, session?: TeralinxAuthSession | null) {
  const data = await requestJson<any>(`/api/proposals/${encodeURIComponent(proposalId)}/readiness`, {
    headers: authHeaders(session),
  });
  return {
    readiness: data.readiness as ProposalReadiness,
    proposal: data.proposal as ProposalRuntimeObject,
  };
}

export async function createDraftIofPackageFromProposal(proposalId: string, session?: TeralinxAuthSession | null) {
  return requestJson<{
    ready: boolean;
    readiness: ProposalReadiness;
    draftIofPackageSource: Record<string, unknown>;
    proposal: ProposalRuntimeObject;
  }>(`/api/proposals/${encodeURIComponent(proposalId)}/create-draft-iof-package`, {
    method: "POST",
    headers: authHeaders(session, { "Content-Type": "application/json" }),
  });
}

export async function listEngineeringReviewQueue(session?: TeralinxAuthSession | null) {
  const data = await requestJson<any>("/api/engineering/certification/queue", {
    headers: authHeaders(session),
  });
  return unwrapList<EngineeringReviewQueueItem>(data, ["engineeringReviewQueue", "queue", "items"]);
}

export async function assembleDraftIofPackageFromProposal(
  input: { proposalId: string; packageId?: string; assignedEngineerId?: string; assignedEngineer?: string; priority?: string },
  session?: TeralinxAuthSession | null,
) {
  const data = await requestJson<any>("/api/engineering/certification/draft-packages/from-proposal", {
    method: "POST",
    headers: authHeaders(session, { "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  return (data.draftPackage ?? data.iofPackage ?? data) as DraftIofPackageRuntime;
}

export async function openDraftIofPackageForCertification(packageId: string, session?: TeralinxAuthSession | null) {
  const data = await requestJson<any>(`/api/engineering/certification/draft-packages/${encodeURIComponent(packageId)}`, {
    headers: authHeaders(session),
  });
  return (data.draftPackage ?? data.iofPackage ?? data) as DraftIofPackageRuntime;
}

async function engineeringUnitAction(
  packageId: string,
  unitId: string,
  action: "certify" | "modify" | "reject" | "split" | "merge",
  input: Record<string, unknown> = {},
  session?: TeralinxAuthSession | null,
) {
  const data = await requestJson<any>(`/api/engineering/certification/draft-packages/${encodeURIComponent(packageId)}/units/${encodeURIComponent(unitId)}/${action}`, {
    method: "POST",
    headers: authHeaders(session, { "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  return {
    iofPackage: (data.draftPackage ?? data.iofPackage ?? data) as DraftIofPackageRuntime,
    unit: data.unit as ProposedIofUnit | undefined,
  };
}

export async function certifyIofUnit(
  packageId: string,
  unitId: string,
  input: { engineeringNote?: string; engineeringConfidence?: number; engineeringRisk?: string; engineeringComments?: string[] } = {},
  session?: TeralinxAuthSession | null,
) {
  return engineeringUnitAction(packageId, unitId, "certify", input, session);
}

export async function modifyIofUnit(
  packageId: string,
  unitId: string,
  input: { unit?: Partial<ProposedIofUnit>; engineeringComments?: string[] },
  session?: TeralinxAuthSession | null,
) {
  return engineeringUnitAction(packageId, unitId, "modify", input as Record<string, unknown>, session);
}

export async function rejectIofUnit(
  packageId: string,
  unitId: string,
  input: { reason?: string; engineeringRisk?: string } = {},
  session?: TeralinxAuthSession | null,
) {
  return engineeringUnitAction(packageId, unitId, "reject", input, session);
}

export async function splitIofUnit(
  packageId: string,
  unitId: string,
  input: { units?: Partial<ProposedIofUnit>[] } = {},
  session?: TeralinxAuthSession | null,
) {
  return engineeringUnitAction(packageId, unitId, "split", input as Record<string, unknown>, session);
}

export async function mergeIofUnits(
  packageId: string,
  unitId: string,
  input: { mergeUnitIds?: string[]; unitId?: string; name?: string } = {},
  session?: TeralinxAuthSession | null,
) {
  return engineeringUnitAction(packageId, unitId, "merge", input as Record<string, unknown>, session);
}

export async function returnDraftIofPackageToCommercial(
  packageId: string,
  input: { reason?: string } = {},
  session?: TeralinxAuthSession | null,
) {
  const data = await requestJson<any>(`/api/engineering/certification/draft-packages/${encodeURIComponent(packageId)}/return-commercial`, {
    method: "POST",
    headers: authHeaders(session, { "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  return (data.draftPackage ?? data.iofPackage ?? data) as DraftIofPackageRuntime;
}

export async function certifyDraftIofPackage(
  packageId: string,
  input: {
    certifiedPackageId?: string;
    checklist: Record<string, unknown>;
  },
  session?: TeralinxAuthSession | null,
) {
  return requestJson<{
    draftPackage: DraftIofPackageRuntime;
    certifiedIofPackage: CertifiedIofPackageRuntime;
    executionAuthorizationCertificate: ExecutionAuthorizationCertificate;
    scopeVersion: Record<string, unknown>;
  }>(`/api/engineering/certification/draft-packages/${encodeURIComponent(packageId)}/certify`, {
    method: "POST",
    headers: authHeaders(session, { "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
}

export async function listCertifiedIofPackages(session?: TeralinxAuthSession | null) {
  const data = await requestJson<any>("/api/engineering/certification/certified-packages", {
    headers: authHeaders(session),
  });
  return unwrapList<CertifiedIofPackageRuntime>(data, ["certifiedIofPackages", "items"]);
}

export async function openCertifiedIofPackage(certifiedPackageId: string, session?: TeralinxAuthSession | null) {
  const data = await requestJson<any>(`/api/engineering/certification/certified-packages/${encodeURIComponent(certifiedPackageId)}`, {
    headers: authHeaders(session),
  });
  return (data.certifiedIofPackage ?? data) as CertifiedIofPackageRuntime;
}

export async function generateScopeVersionFromCertifiedIofPackage(certifiedPackageId: string, session?: TeralinxAuthSession | null) {
  return requestJson<{
    certifiedPackage: CertifiedIofPackageRuntime;
    certificate: ExecutionAuthorizationCertificate;
    scopeVersion: Record<string, unknown>;
  }>(`/api/engineering/certification/certified-packages/${encodeURIComponent(certifiedPackageId)}/generate-scopeversion`, {
    method: "POST",
    headers: authHeaders(session, { "Content-Type": "application/json" }),
  });
}
