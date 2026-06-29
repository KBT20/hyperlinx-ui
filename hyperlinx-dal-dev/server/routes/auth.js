import { errorResponse, handleOptions, jsonResponse, nowIso, readRequestJson } from "./_shared.js";

const ALPHA_USERS = [
  {
    userId: "teralinx-user-kyle",
    username: "kyle",
    password: "kyle-alpha",
    name: "Kyle",
    title: "Administrator / COO",
    role: "ADMINISTRATOR_COO",
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
  },
  {
    userId: "teralinx-user-ryan",
    username: "ryan",
    password: "ryan-alpha",
    name: "Ryan",
    title: "CRO",
    role: "CRO",
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
  },
  {
    userId: "teralinx-user-fran",
    username: "fran",
    password: "fran-alpha",
    name: "Fran",
    title: "CEO",
    role: "CEO",
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
  },
];

function publicUser(user) {
  const { password, ...safe } = user;
  return safe;
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
    jsonResponse(res, 200, {
      token: tokenFor(user),
      user: publicUser(user),
      authenticatedAt: nowIso(),
      provider: "TERALINX_ALPHA_INTERNAL",
    });
    return true;
  }

  if (normalizedPath === "/api/auth/users" && req.method === "GET") {
    jsonResponse(res, 200, { users: ALPHA_USERS.map(publicUser) });
    return true;
  }

  return false;
}
