import { DIRS, errorResponse, handleOptions, jsonResponse, loadRecord, nowIso, persistRecord, readRequestJson } from "./_shared.js";

export const TERALINX_ORGANIZATION_ID = "org-teralinx";

function workspaceFor(user) {
  const timestamp = nowIso();
  return {
    workspaceId: user.workspaceId,
    userId: user.userId,
    organizationId: user.organizationId,
    name: `${user.name} Workspace`,
    preferences: user.preferences ?? {},
    dashboard: user.dashboard ?? {},
    recentActivity: [],
    assignments: [],
    notifications: user.notifications ?? [],
    pinnedObjects: user.pinnedObjects ?? [],
    createdAt: user.workspaceCreatedAt ?? timestamp,
    updatedAt: timestamp,
  };
}

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter(Boolean).map(String))];
}

async function persistedWorkspaceFor(user) {
  const base = workspaceFor(user);
  const existing = await loadRecord(DIRS.runtimeWorkspaces, user.workspaceId).catch(() => null);
  if (!existing) return base;
  return {
    ...base,
    ...existing,
    preferences: { ...base.preferences, ...(existing.preferences ?? {}) },
    dashboard: { ...base.dashboard, ...(existing.dashboard ?? {}) },
    assignments: unique([...(base.assignments ?? []), ...(existing.assignments ?? [])]),
    notifications: Array.isArray(existing.notifications) ? existing.notifications : base.notifications,
    pinnedObjects: unique([...(base.pinnedObjects ?? []), ...(existing.pinnedObjects ?? [])]),
    recentActivity: unique([...(existing.recentActivity ?? []), ...(base.recentActivity ?? [])]),
    updatedAt: nowIso(),
  };
}

export const ALPHA_USERS = [
  {
    userId: "teralinx-user-kyle",
    organizationId: TERALINX_ORGANIZATION_ID,
    workspaceId: "workspace-teralinx-kyle",
    username: "kyle",
    password: "kyle-alpha",
    name: "Kyle",
    title: "Administrator / COO",
    role: "ADMINISTRATOR_COO",
    participantType: "EXECUTIVE",
    organization: "Teralinx",
    permissions: [
      "platform.admin",
      "runtime.deploy",
      "users.manage",
      "workspace.translate",
      "workspace.commercial",
      "workspace.proposal",
      "workspace.salesEngineering",
      "workspace.engineering.read",
      "workspace.engineering.write",
      "scopeversion.authority",
      "customerDesign.manage",
      "opportunity.manage",
      "proposal.manage",
    ],
    preferences: {
      defaultWorkspace: "googleRfp",
      dashboardDensity: "executive",
    },
    dashboard: {
      sections: ["My Opportunities", "Assigned Work", "Recent Activity", "Pending Approvals", "Notifications", "Executive Overview", "Organization Pipeline", "Revenue", "Operational Intelligence"],
      executiveOverview: true,
      organizationPipeline: true,
      revenue: true,
      operationalIntelligence: true,
    },
    assignments: [],
    notifications: [],
    pinnedObjects: [],
  },
  {
    userId: "teralinx-user-ryan",
    organizationId: TERALINX_ORGANIZATION_ID,
    workspaceId: "workspace-teralinx-ryan",
    username: "ryan",
    password: "ryan-alpha",
    name: "Ryan",
    title: "CRO",
    role: "CRO",
    participantType: "COMMERCIAL",
    organization: "Teralinx",
    permissions: [
      "workspace.translate",
      "workspace.commercial",
      "workspace.proposal",
      "workspace.salesEngineering",
      "customerDesign.manage",
      "opportunity.manage",
      "proposal.manage",
    ],
    preferences: {
      defaultWorkspace: "googleRfp",
      dashboardDensity: "commercial",
    },
    dashboard: {
      sections: ["My Opportunities", "Assigned Work", "Recent Activity", "Pending Approvals", "Notifications"],
      executiveOverview: false,
      organizationPipeline: false,
      revenue: false,
      operationalIntelligence: false,
    },
    assignments: [],
    notifications: [],
    pinnedObjects: [],
  },
  {
    userId: "teralinx-user-fran",
    organizationId: TERALINX_ORGANIZATION_ID,
    workspaceId: "workspace-teralinx-fran",
    username: "fran",
    password: "fran-alpha",
    name: "Fran",
    title: "CEO",
    role: "CEO",
    participantType: "EXECUTIVE",
    organization: "Teralinx",
    permissions: [
      "workspace.commercial",
      "workspace.proposal",
      "workspace.executiveReview",
      "workspace.engineering.read",
      "customerDesign.read",
      "opportunity.read",
      "proposal.read",
    ],
    preferences: {
      defaultWorkspace: "googleRfp",
      dashboardDensity: "review",
    },
    dashboard: {
      sections: ["My Opportunities", "Assigned Work", "Recent Activity", "Pending Approvals", "Notifications"],
      executiveOverview: false,
      organizationPipeline: false,
      revenue: false,
      operationalIntelligence: false,
    },
    assignments: [],
    notifications: [],
    pinnedObjects: [],
  },
  {
    userId: "google-participant-001",
    organizationId: TERALINX_ORGANIZATION_ID,
    workspaceId: "workspace-google-customer",
    username: "google",
    password: "google-alpha",
    name: "Google Customer",
    title: "Hyperscaler Participant",
    role: "CUSTOMER_PARTICIPANT",
    participantType: "CUSTOMER",
    organization: "Teralinx",
    customerId: "customer-google",
    customerName: "Google",
    permissions: [
      "workspace.commercial",
      "workspace.proposal",
      "customerDesign.manage",
      "opportunity.read",
      "proposal.read",
      "proposal.review",
    ],
    preferences: {
      defaultWorkspace: "googleRfp",
      dashboardDensity: "participant",
    },
    dashboard: {
      sections: ["Assigned Work", "Recent Activity", "Pending Approvals", "Notifications"],
      executiveOverview: false,
      organizationPipeline: false,
      revenue: false,
      operationalIntelligence: false,
    },
    assignments: [],
    notifications: [],
    pinnedObjects: [],
  },
];

function publicUser(user) {
  const { password, ...safe } = user;
  return {
    ...safe,
    workspace: workspaceFor(user),
  };
}

function tokenFor(user) {
  const payload = JSON.stringify({
    sub: user.userId,
    username: user.username,
    role: user.role,
    iat: nowIso(),
  });
  return Buffer.from(payload).toString("base64url");
}

export function userFromBearerToken(req) {
  const authorization = String(req.headers.authorization ?? "");
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  try {
    const payload = JSON.parse(Buffer.from(match[1], "base64url").toString("utf8"));
    return ALPHA_USERS.find((user) => user.userId === payload.sub && user.username === payload.username) ?? null;
  } catch {
    return null;
  }
}

export function canAdministerRuntime(user) {
  return Boolean(user?.permissions?.includes("platform.admin"));
}

export function userHasPermission(user, permission) {
  return Boolean(user?.permissions?.includes(permission) || canAdministerRuntime(user));
}

export function runtimeWorkspaceForUser(user) {
  return workspaceFor(user);
}

export function findAlphaUserById(userId) {
  return ALPHA_USERS.find((user) => user.userId === userId) ?? null;
}

export async function handleAuth(req, res, pathname) {
  if (!pathname.startsWith("/api/auth")) return false;
  if (handleOptions(req, res)) return true;
  const normalizedPath = pathname.replace(/\/+$/, "");

  if (normalizedPath === "/api/auth/login" && req.method === "POST") {
    const body = await readRequestJson(req);
    const username = String(body.username ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const user = ALPHA_USERS.find((candidate) => candidate.username === username && candidate.password === password);
    if (!user) {
      errorResponse(res, 401, "Invalid Teralinx alpha credentials.");
      return true;
    }
    const workspace = await persistedWorkspaceFor(user);
    await persistRecord(DIRS.runtimeWorkspaces, user.workspaceId, workspace);
    jsonResponse(res, 200, {
      token: tokenFor(user),
      user: publicUser(user),
      workspace,
      authenticatedAt: nowIso(),
      provider: "TERALINX_ALPHA_INTERNAL",
    });
    return true;
  }

  if (normalizedPath === "/api/auth/logout" && req.method === "POST") {
    jsonResponse(res, 200, {
      ok: true,
      loggedOutAt: nowIso(),
      provider: "TERALINX_ALPHA_INTERNAL",
    });
    return true;
  }

  if (normalizedPath === "/api/auth/me" && req.method === "GET") {
    const user = userFromBearerToken(req);
    if (!user) {
      errorResponse(res, 401, "Authentication token is missing or invalid.");
      return true;
    }
    const workspace = await persistedWorkspaceFor(user);
    jsonResponse(res, 200, {
      authenticated: true,
      user: publicUser(user),
      workspace,
      provider: "TERALINX_ALPHA_INTERNAL",
    });
    return true;
  }

  if (normalizedPath === "/api/auth/workspace" && req.method === "GET") {
    const user = userFromBearerToken(req);
    if (!user) {
      errorResponse(res, 401, "Authentication token is missing or invalid.");
      return true;
    }
    const workspace = await persistedWorkspaceFor(user);
    jsonResponse(res, 200, {
      workspace,
      hierarchy: {
        tenant: user.organizationId,
        user: user.userId,
        workspace: user.workspaceId,
      },
    });
    return true;
  }

  if (normalizedPath === "/api/auth/users" && req.method === "GET") {
    jsonResponse(res, 200, { users: ALPHA_USERS.map(publicUser) });
    return true;
  }

  return false;
}
