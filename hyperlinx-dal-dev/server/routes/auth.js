import { createHash, randomBytes, randomUUID } from "node:crypto";
import { authQuery, verifyAuthDatabase, withAuthTransaction } from "../auth/postgres.js";
import { hashPassword, verifyPassword } from "../auth/password.js";
import { errorResponse, handleOptions, jsonResponse, nowIso, readRequestJson } from "./_shared.js";

export const TERALINX_ORGANIZATION_ID = "org-teralinx";
export const AUTH_PROVIDER = "POSTGRES_DURABLE_SESSION";

const COOKIE_NAME = "hyperlinx_session";
const ABSOLUTE_SESSION_MS = Number(process.env.AUTH_SESSION_ABSOLUTE_MS ?? 12 * 60 * 60 * 1_000);
const IDLE_SESSION_MS = Number(process.env.AUTH_SESSION_IDLE_MS ?? 2 * 60 * 60 * 1_000);
const SESSION_TOUCH_MS = Number(process.env.AUTH_SESSION_TOUCH_MS ?? 5 * 60 * 1_000);
const LOGIN_WINDOW_MS = Number(process.env.AUTH_LOGIN_WINDOW_MS ?? 15 * 60 * 1_000);
const LOGIN_ATTEMPT_LIMIT = Number(process.env.AUTH_LOGIN_ATTEMPT_LIMIT ?? 8);
const PERSONAL_STATE_KEYS = new Set([
  "identity.profile",
  "workspace.preferences",
  "workspace.dashboard",
  "recent-opportunities",
  "saved-filters",
  "map-preferences",
  "table-preferences",
  "collapsed-panels",
]);

const durableDirectory = new Map();
const DEMO_PERSONAS = new Set([
  "SALES",
  "ENGINEERING",
  "CUSTOMER_VIEWER",
  "CUSTOMER_COMMERCIAL_REVIEWER",
  "CUSTOMER_AUTHORIZED_SIGNER",
  "EXECUTIVE",
]);

function digest(value) {
  return createHash("sha256").update(String(value ?? "")).digest("hex");
}

function requestNetwork(req) {
  return String(req.headers["cf-connecting-ip"] ?? req.headers["x-forwarded-for"] ?? req.socket?.remoteAddress ?? "unknown").split(",")[0].trim();
}

function requestFingerprint(req) {
  return {
    networkAddressHash: digest(requestNetwork(req)),
    userAgentHash: digest(req.headers["user-agent"] ?? "unknown"),
  };
}

function parseCookies(req) {
  return Object.fromEntries(String(req.headers.cookie ?? "").split(";").map((part) => part.trim()).filter(Boolean).map((part) => {
    const index = part.indexOf("=");
    if (index < 0) return [part, ""];
    return [decodeURIComponent(part.slice(0, index)), decodeURIComponent(part.slice(index + 1))];
  }));
}

function requestCredential(req) {
  const cookieToken = parseCookies(req)[COOKIE_NAME];
  if (cookieToken) return { token: cookieToken, mechanism: "COOKIE" };
  const match = String(req.headers.authorization ?? "").match(/^Bearer\s+(.+)$/i);
  if (match?.[1]) return { token: match[1], mechanism: "BEARER" };
  return null;
}

function cookieValue(token, maxAgeSeconds) {
  const secure = String(process.env.AUTH_COOKIE_SECURE ?? "1") !== "0";
  return [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    secure ? "Secure" : "",
    "SameSite=Strict",
    `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`,
  ].filter(Boolean).join("; ");
}

function setSessionCookie(res, token, expiresAt) {
  res.setHeader("Set-Cookie", cookieValue(token, (new Date(expiresAt).getTime() - Date.now()) / 1_000));
}

function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", cookieValue("", 0));
}

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter(Boolean).map(String))];
}

function workspaceIdFor(identity, profile = {}) {
  if (profile.workspaceId) return String(profile.workspaceId);
  if (identity.principal_id.startsWith("teralinx-user-")) return `workspace-teralinx-${identity.principal_id.slice("teralinx-user-".length)}`;
  if (identity.principal_id === "google-participant-001") return "workspace-google-customer";
  return `workspace-${identity.membership_id}`;
}

function workspaceFor(user) {
  const timestamp = nowIso();
  const state = user.personalState ?? {};
  return {
    workspaceId: user.workspaceId,
    userId: user.userId,
    principalId: user.principalId,
    membershipId: user.membershipId,
    organizationId: user.organizationId,
    name: `${user.name} Workspace`,
    preferences: state["workspace.preferences"] ?? user.preferences ?? {},
    dashboard: state["workspace.dashboard"] ?? user.dashboard ?? {},
    recentActivity: state["recent-opportunities"] ?? [],
    assignments: user.assignments ?? [],
    notifications: [],
    pinnedObjects: [],
    createdAt: user.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
}

function identityFromRow(row, personalState = {}) {
  const profile = personalState["identity.profile"] ?? {};
  const roles = unique(row.roles);
  const permissions = unique(row.permissions);
  const role = roles[0] ?? "MEMBER";
  const workspaceId = workspaceIdFor(row, profile);
  const user = {
    userId: row.principal_id,
    principalId: row.principal_id,
    membershipId: row.membership_id,
    organizationId: row.organization_id,
    workspaceId,
    username: row.username,
    name: row.display_name,
    displayName: row.display_name,
    title: row.title || profile.title || "",
    role,
    roles,
    participantType: profile.participantType ?? "HUMAN",
    authorityClass: profile.authorityClass ?? "PRODUCTION",
    environment: profile.authorityClass === "DEMO" ? "DEMO" : "PRODUCTION",
    productionEligible: profile.authorityClass !== "DEMO",
    customerId: profile.customerId ?? "",
    organization: row.organization_name,
    permissions,
    assignments: unique(row.assignments),
    preferences: personalState["workspace.preferences"] ?? profile.preferences ?? {},
    dashboard: personalState["workspace.dashboard"] ?? profile.dashboard ?? {},
    notifications: [],
    pinnedObjects: [],
    passwordChangeRequired: Boolean(row.password_change_required),
    createdAt: row.principal_created_at,
    personalState,
  };
  return { ...user, workspace: workspaceFor(user) };
}

const IDENTITY_SELECT = `
  SELECT
    p.principal_id, p.username, p.display_name, p.title, p.status AS principal_status,
    p.created_at AS principal_created_at,
    m.membership_id, m.organization_id, m.status AS membership_status,
    o.name AS organization_name, o.status AS organization_status,
    c.credential_version, c.password_change_required,
    COALESCE(array_agg(DISTINCT r.role_key) FILTER (WHERE r.role_key IS NOT NULL), '{}') AS roles,
    COALESCE(array_agg(DISTINCT permission.permission_key) FILTER (WHERE permission.permission_key IS NOT NULL), '{}') AS permissions,
    COALESCE(array_agg(DISTINCT assignment.assignment_id) FILTER (WHERE assignment.assignment_id IS NOT NULL), '{}') AS assignments
  FROM hyperlinx.principals p
  JOIN hyperlinx.memberships m ON m.principal_id = p.principal_id
  JOIN hyperlinx.organizations o ON o.organization_id = m.organization_id
  JOIN hyperlinx.principal_credentials c ON c.principal_id = p.principal_id
  LEFT JOIN hyperlinx.assignments assignment ON assignment.membership_id = m.membership_id
    AND assignment.effective_at <= clock_timestamp()
    AND (assignment.expires_at IS NULL OR assignment.expires_at > clock_timestamp())
  LEFT JOIN hyperlinx.roles r ON r.role_id = assignment.role_id
  LEFT JOIN hyperlinx.role_permissions rp ON rp.role_id = r.role_id
  LEFT JOIN hyperlinx.permissions permission ON permission.permission_id = rp.permission_id
`;

const IDENTITY_GROUP = `
  GROUP BY p.principal_id, p.username, p.display_name, p.title, p.status, p.created_at,
    m.membership_id, m.organization_id, m.status, o.name, o.status,
    c.credential_version, c.password_change_required
`;

async function personalStateFor(membershipId) {
  const result = await authQuery({
    name: "auth-personal-state-v1",
    text: "SELECT state_key, state_value FROM hyperlinx.personal_state WHERE membership_id = $1",
    values: [membershipId],
  });
  return Object.fromEntries(result.rows.map((row) => [row.state_key, row.state_value]));
}

async function directoryRows(where = "", values = []) {
  const result = await authQuery({ text: `${IDENTITY_SELECT} ${where} ${IDENTITY_GROUP} ORDER BY p.username`, values });
  return result.rows;
}

async function identityForRow(row) {
  return identityFromRow(row, await personalStateFor(row.membership_id));
}

export async function refreshDurableDirectory() {
  const rows = await directoryRows("WHERE p.status = 'ACTIVE' AND m.status = 'ACTIVE' AND o.status = 'ACTIVE'");
  const users = await Promise.all(rows.map(identityForRow));
  durableDirectory.clear();
  for (const user of users) durableDirectory.set(user.userId, user);
  return users;
}

export async function initializeAuthenticationAuthority() {
  await verifyAuthDatabase();
  await refreshDurableDirectory();
}

export function findAlphaUserById(userId) {
  return durableDirectory.get(String(userId ?? "")) ?? null;
}

export const ALPHA_USERS = Object.freeze([]);

export function runtimeWorkspaceForUser(user) {
  return workspaceFor(user);
}

export function userFromBearerToken(req) {
  return req.authUser ?? null;
}

export function canAdministerRuntime(user) {
  return Boolean(user?.permissions?.includes("platform.admin"));
}

export function userHasPermission(user, permission) {
  return Boolean(user?.permissions?.includes(permission) || canAdministerRuntime(user));
}

async function auditAuth(eventType, details = {}, query = authQuery) {
  await query({
    text: `INSERT INTO hyperlinx.auth_audit_events (
      auth_event_id, event_type, principal_id, membership_id, organization_id, session_id,
      login_identifier_hash, network_address_hash, user_agent_hash, outcome, reason
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    values: [
      randomUUID(), eventType, details.principalId ?? null, details.membershipId ?? null,
      details.organizationId ?? null, details.sessionId ?? null, details.loginIdentifierHash ?? null,
      details.networkAddressHash ?? null, details.userAgentHash ?? null,
      details.outcome ?? "SUCCESS", details.reason ?? "",
    ],
  });
}

async function loginAttemptCount(loginIdentifierHash, networkAddressHash) {
  const result = await authQuery({
    text: `SELECT count(*)::integer AS attempts FROM hyperlinx.auth_audit_events
      WHERE event_type = 'LOGIN' AND outcome = 'FAILURE'
        AND login_identifier_hash = $1 AND network_address_hash = $2
        AND recorded_at > clock_timestamp() - ($3::bigint * interval '1 millisecond')`,
    values: [loginIdentifierHash, networkAddressHash, LOGIN_WINDOW_MS],
  });
  return Number(result.rows[0]?.attempts ?? 0);
}

async function identityForLogin(username) {
  const rows = await directoryRows("WHERE lower(p.username) = lower($1) OR lower(p.email) = lower($1)", [username]);
  if (rows.length !== 1) return null;
  const credential = await authQuery({
    text: "SELECT password_digest, digest_scheme, credential_version, password_change_required FROM hyperlinx.principal_credentials WHERE principal_id = $1",
    values: [rows[0].principal_id],
  });
  return { row: rows[0], credential: credential.rows[0], user: await identityForRow(rows[0]) };
}

async function createSession(identity, req) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = digest(token);
  const issuedAt = new Date();
  const idleExpiresAt = new Date(issuedAt.getTime() + IDLE_SESSION_MS);
  const absoluteExpiresAt = new Date(issuedAt.getTime() + ABSOLUTE_SESSION_MS);
  const sessionId = randomUUID();
  const fingerprint = requestFingerprint(req);
  await withAuthTransaction(async (client) => {
    await client.query({
      text: `INSERT INTO hyperlinx.auth_sessions (
        session_id, token_hash, principal_id, membership_id, organization_id, credential_version,
        issued_at, last_seen_at, idle_expires_at, absolute_expires_at, user_agent_hash, network_address_hash
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$7,$8,$9,$10,$11)`,
      values: [sessionId, tokenHash, identity.user.principalId, identity.user.membershipId,
        identity.user.organizationId, identity.credential.credential_version, issuedAt,
        idleExpiresAt, absoluteExpiresAt, fingerprint.userAgentHash, fingerprint.networkAddressHash],
    });
    await client.query("UPDATE hyperlinx.principals SET last_authenticated_at = clock_timestamp() WHERE principal_id = $1", [identity.user.principalId]);
    await client.query("UPDATE hyperlinx.principal_credentials SET failed_attempt_count = 0 WHERE principal_id = $1", [identity.user.principalId]);
    await auditAuth("LOGIN", {
      principalId: identity.user.principalId, membershipId: identity.user.membershipId,
      organizationId: identity.user.organizationId, sessionId, outcome: "SUCCESS", ...fingerprint,
    }, (config) => client.query(config));
  });
  return { token, sessionId, issuedAt, idleExpiresAt, absoluteExpiresAt };
}

async function resolveSession(token, req) {
  const tokenHash = digest(token);
  const result = await authQuery({
    text: `SELECT session.*, credential.credential_version AS current_credential_version
      FROM hyperlinx.auth_sessions session
      JOIN hyperlinx.principal_credentials credential USING (principal_id)
      WHERE session.token_hash = $1`,
    values: [tokenHash],
  });
  const session = result.rows[0];
  if (!session) return null;
  const now = Date.now();
  const expired = session.revoked_at || new Date(session.absolute_expires_at).getTime() <= now
    || new Date(session.idle_expires_at).getTime() <= now
    || Number(session.credential_version) !== Number(session.current_credential_version);
  if (expired) {
    if (!session.revoked_at) {
      await authQuery({
        text: "UPDATE hyperlinx.auth_sessions SET revoked_at = clock_timestamp(), revoked_reason = $2 WHERE session_id = $1 AND revoked_at IS NULL",
        values: [session.session_id, "EXPIRED_OR_CREDENTIAL_ROTATED"],
      });
    }
    return null;
  }
  const rows = await directoryRows("WHERE p.principal_id = $1 AND m.membership_id = $2 AND m.organization_id = $3 AND p.status = 'ACTIVE' AND m.status = 'ACTIVE' AND o.status = 'ACTIVE'", [session.principal_id, session.membership_id, session.organization_id]);
  if (rows.length !== 1) return null;
  if (now - new Date(session.last_seen_at).getTime() >= SESSION_TOUCH_MS) {
    const idleExpiresAt = new Date(Math.min(now + IDLE_SESSION_MS, new Date(session.absolute_expires_at).getTime()));
    await authQuery({
      text: "UPDATE hyperlinx.auth_sessions SET last_seen_at = clock_timestamp(), idle_expires_at = $2 WHERE session_id = $1",
      values: [session.session_id, idleExpiresAt],
    });
    session.last_seen_at = new Date();
    session.idle_expires_at = idleExpiresAt;
  }
  return { session, user: await identityForRow(rows[0]) };
}

export async function authenticateRuntimeRequest(req) {
  req.authUser = null;
  req.authSession = null;
  req.authMechanism = null;
  req.authAuthorityUnavailable = false;
  const credential = requestCredential(req);
  if (!credential) return null;
  try {
    const resolved = await resolveSession(credential.token, req);
    if (!resolved) return null;
    resolved.user.sessionId = resolved.session.session_id;
    resolved.user.actorAuthority = {
      principalId: resolved.user.principalId,
      membershipId: resolved.user.membershipId,
      organizationId: resolved.user.organizationId,
      sessionId: resolved.session.session_id,
      actorDisplayNameAtAction: resolved.user.displayName,
    };
    req.authUser = resolved.user;
    if (resolved.user.principalId === "demo-principal" && resolved.user.organizationId === "org-demo" && resolved.user.authorityClass === "DEMO") {
      const requestedPersona = String(req.headers["x-hyperlinx-demo-persona"] ?? "SALES").trim().toUpperCase();
      resolved.user.demoPersona = DEMO_PERSONAS.has(requestedPersona) ? requestedPersona : "SALES";
      const requestedCustomerOrganization = String(req.headers["x-hyperlinx-demo-customer-organization"] ?? "org-demo-customer-a").trim();
      resolved.user.demoCustomerOrganizationId = ["org-demo-customer-a", "org-demo-customer-b"].includes(requestedCustomerOrganization)
        ? requestedCustomerOrganization
        : "org-demo-customer-a";
    }
    req.authSession = resolved.session;
    req.authMechanism = credential.mechanism;
    durableDirectory.set(resolved.user.userId, resolved.user);
    return resolved.user;
  } catch (error) {
    req.authAuthorityUnavailable = true;
    console.error("[auth-authority-unavailable]", error instanceof Error ? error.message : String(error));
    return null;
  }
}

function isPublicApi(req, pathname) {
  return (pathname === "/api/runtime" && req.method === "GET")
    || (pathname === "/api/routes" && req.method === "GET")
    || (pathname === "/api/auth/login" && req.method === "POST")
    || (pathname === "/api/customer-portal/invitations/enroll" && req.method === "POST");
}

function cookieOriginAllowed(req) {
  if (req.authMechanism !== "COOKIE" || ["GET", "HEAD", "OPTIONS"].includes(req.method ?? "GET")) return true;
  const origin = String(req.headers.origin ?? "").trim();
  if (!origin) return true;
  try {
    return new URL(origin).host === String(req.headers.host ?? "");
  } catch {
    return false;
  }
}

export function enforceAuthenticationBoundary(req, res, pathname) {
  if (!pathname.startsWith("/api/") || isPublicApi(req, pathname)) return false;
  if (req.authAuthorityUnavailable) {
    errorResponse(res, 503, "Authentication authority is unavailable; request failed closed.");
    return true;
  }
  if (!req.authUser) {
    errorResponse(res, 401, "Authentication session is missing, expired, revoked, or invalid.");
    return true;
  }
  if (!cookieOriginAllowed(req)) {
    errorResponse(res, 403, "Cross-origin cookie-authenticated mutation rejected.");
    return true;
  }
  if (req.authUser.passwordChangeRequired && !["/api/auth/me", "/api/auth/logout", "/api/auth/password"].includes(pathname)) {
    errorResponse(res, 403, "Password change is required before application access.");
    return true;
  }
  return false;
}

function sessionProjection(session) {
  return {
    sessionId: session.session_id ?? session.sessionId,
    principalId: session.principal_id ?? session.principalId,
    membershipId: session.membership_id ?? session.membershipId,
    organizationId: session.organization_id ?? session.organizationId,
    issuedAt: new Date(session.issued_at ?? session.issuedAt).toISOString(),
    lastSeenAt: new Date(session.last_seen_at ?? session.issuedAt).toISOString(),
    idleExpiresAt: new Date(session.idle_expires_at ?? session.idleExpiresAt).toISOString(),
    absoluteExpiresAt: new Date(session.absolute_expires_at ?? session.absoluteExpiresAt).toISOString(),
    status: session.revoked_at ? "REVOKED" : "ACTIVE",
  };
}

async function handleLogin(req, res) {
  const body = await readRequestJson(req);
  const username = String(body.username ?? body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const fingerprint = requestFingerprint(req);
  const loginIdentifierHash = digest(username);
  if (!username || !password) {
    errorResponse(res, 400, "Login identifier and password are required.");
    return;
  }
  if (await loginAttemptCount(loginIdentifierHash, fingerprint.networkAddressHash) >= LOGIN_ATTEMPT_LIMIT) {
    res.setHeader("Retry-After", String(Math.ceil(LOGIN_WINDOW_MS / 1_000)));
    errorResponse(res, 429, "Too many login attempts. Try again later.");
    return;
  }
  const identity = await identityForLogin(username);
  const valid = identity
    && identity.row.principal_status === "ACTIVE"
    && identity.row.membership_status === "ACTIVE"
    && identity.row.organization_status === "ACTIVE"
    && identity.credential?.digest_scheme === "SCRYPT"
    && await verifyPassword(password, identity.credential.password_digest);
  if (!valid) {
    await auditAuth("LOGIN", { loginIdentifierHash, outcome: "FAILURE", reason: "INVALID_CREDENTIALS", ...fingerprint });
    if (identity?.user?.principalId) {
      await authQuery({
        text: "UPDATE hyperlinx.principal_credentials SET failed_attempt_count = failed_attempt_count + 1, last_failed_at = clock_timestamp() WHERE principal_id = $1",
        values: [identity.user.principalId],
      });
    }
    errorResponse(res, 401, "Invalid credentials.");
    return;
  }
  const session = await createSession(identity, req);
  setSessionCookie(res, session.token, session.absoluteExpiresAt);
  const user = { ...identity.user, passwordChangeRequired: Boolean(identity.credential.password_change_required) };
  durableDirectory.set(user.userId, user);
  jsonResponse(res, 200, {
    token: "",
    user,
    principal: { principalId: user.principalId, displayName: user.displayName, username: user.username, status: "ACTIVE" },
    membership: { membershipId: user.membershipId, organizationId: user.organizationId, status: "ACTIVE" },
    organization: { organizationId: user.organizationId, name: user.organization },
    roles: user.roles,
    permissions: user.permissions,
    workspace: workspaceFor(user),
    session: sessionProjection({ ...session, principalId: user.principalId, membershipId: user.membershipId, organizationId: user.organizationId }),
    authenticatedAt: nowIso(),
    provider: AUTH_PROVIDER,
  });
}

async function handlePasswordChange(req, res) {
  const body = await readRequestJson(req);
  const currentPassword = String(body.currentPassword ?? "");
  const nextPassword = String(body.newPassword ?? "");
  const credentialResult = await authQuery({
    text: "SELECT password_digest FROM hyperlinx.principal_credentials WHERE principal_id = $1",
    values: [req.authUser.principalId],
  });
  if (!await verifyPassword(currentPassword, credentialResult.rows[0]?.password_digest)) {
    errorResponse(res, 401, "Current password is invalid.");
    return;
  }
  let passwordDigest;
  try {
    passwordDigest = await hashPassword(nextPassword);
  } catch (error) {
    errorResponse(res, 400, error instanceof Error ? error.message : String(error));
    return;
  }
  await withAuthTransaction(async (client) => {
    await client.query(`UPDATE hyperlinx.principal_credentials SET password_digest = $2, digest_scheme = 'SCRYPT',
      credential_version = credential_version + 1, rotated_at = clock_timestamp(), password_change_required = false
      WHERE principal_id = $1`, [req.authUser.principalId, passwordDigest]);
    await client.query("UPDATE hyperlinx.auth_sessions SET revoked_at = clock_timestamp(), revoked_reason = 'PASSWORD_CHANGED' WHERE principal_id = $1 AND revoked_at IS NULL", [req.authUser.principalId]);
    await auditAuth("PASSWORD_CHANGE", {
      principalId: req.authUser.principalId, membershipId: req.authUser.membershipId,
      organizationId: req.authUser.organizationId, sessionId: req.authSession.session_id,
      outcome: "SUCCESS", ...requestFingerprint(req),
    }, (config) => client.query(config));
  });
  clearSessionCookie(res);
  jsonResponse(res, 200, { ok: true, reauthenticationRequired: true });
}

async function handlePersonalState(req, res, normalizedPath) {
  const prefix = "/api/auth/personal-state";
  const key = normalizedPath.startsWith(`${prefix}/`) ? decodeURIComponent(normalizedPath.slice(prefix.length + 1)) : "";
  if (req.method === "GET") {
    const state = await personalStateFor(req.authUser.membershipId);
    if (key) jsonResponse(res, 200, { key, value: state[key] ?? null, principalId: req.authUser.principalId, organizationId: req.authUser.organizationId });
    else jsonResponse(res, 200, { personalState: state, principalId: req.authUser.principalId, organizationId: req.authUser.organizationId });
    return true;
  }
  if ((req.method === "PUT" || req.method === "POST") && key) {
    if (!PERSONAL_STATE_KEYS.has(key) || key === "identity.profile") {
      errorResponse(res, 400, "Personal-state key is not writable through the user API.");
      return true;
    }
    const body = await readRequestJson(req);
    const value = body.value ?? body.state ?? {};
    if (Buffer.byteLength(JSON.stringify(value), "utf8") > 64 * 1024) {
      errorResponse(res, 413, "Personal-state value exceeds 64 KiB.");
      return true;
    }
    await authQuery({
      text: `INSERT INTO hyperlinx.personal_state (membership_id, state_key, state_value)
        VALUES ($1,$2,$3) ON CONFLICT (membership_id,state_key) DO UPDATE
        SET state_value = EXCLUDED.state_value, updated_at = clock_timestamp()`,
      values: [req.authUser.membershipId, key, value],
    });
    jsonResponse(res, 200, { key, value, principalId: req.authUser.principalId, organizationId: req.authUser.organizationId });
    return true;
  }
  return false;
}

export async function handleAuth(req, res, pathname) {
  if (!pathname.startsWith("/api/auth")) return false;
  if (handleOptions(req, res)) return true;
  const normalizedPath = pathname.replace(/\/+$/, "");
  try {
    if (normalizedPath === "/api/auth/login" && req.method === "POST") {
      await handleLogin(req, res);
      return true;
    }
    if (normalizedPath === "/api/auth/logout" && req.method === "POST") {
      await authQuery({
        text: "UPDATE hyperlinx.auth_sessions SET revoked_at = clock_timestamp(), revoked_reason = 'LOGOUT' WHERE session_id = $1 AND revoked_at IS NULL",
        values: [req.authSession.session_id],
      });
      await auditAuth("LOGOUT", {
        principalId: req.authUser.principalId, membershipId: req.authUser.membershipId,
        organizationId: req.authUser.organizationId, sessionId: req.authSession.session_id,
        outcome: "SUCCESS", ...requestFingerprint(req),
      });
      clearSessionCookie(res);
      jsonResponse(res, 200, { ok: true, loggedOutAt: nowIso(), provider: AUTH_PROVIDER });
      return true;
    }
    if (normalizedPath === "/api/auth/password" && req.method === "POST") {
      await handlePasswordChange(req, res);
      return true;
    }
    if (normalizedPath === "/api/auth/me" && req.method === "GET") {
      jsonResponse(res, 200, {
        authenticated: true,
        user: req.authUser,
        principal: { principalId: req.authUser.principalId, displayName: req.authUser.displayName, username: req.authUser.username, status: "ACTIVE" },
        membership: { membershipId: req.authUser.membershipId, organizationId: req.authUser.organizationId, status: "ACTIVE" },
        organization: { organizationId: req.authUser.organizationId, name: req.authUser.organization },
        roles: req.authUser.roles,
        permissions: req.authUser.permissions,
        workspace: workspaceFor(req.authUser),
        session: sessionProjection(req.authSession),
        authenticatedAt: new Date(req.authSession.issued_at).toISOString(),
        provider: AUTH_PROVIDER,
      });
      return true;
    }
    if (normalizedPath === "/api/auth/workspace" && req.method === "GET") {
      jsonResponse(res, 200, { workspace: workspaceFor(req.authUser), hierarchy: { tenant: req.authUser.organizationId, principal: req.authUser.principalId, membership: req.authUser.membershipId, workspace: req.authUser.workspaceId } });
      return true;
    }
    if (normalizedPath === "/api/auth/users" && req.method === "GET") {
      if (!userHasPermission(req.authUser, "users.manage")) {
        errorResponse(res, 403, "User-directory administration permission is required.");
        return true;
      }
      const users = await refreshDurableDirectory();
      jsonResponse(res, 200, { users: users.map((user) => ({
        principalId: user.principalId, membershipId: user.membershipId, organizationId: user.organizationId,
        username: user.username, displayName: user.displayName, title: user.title,
        roles: user.roles, permissions: user.permissions,
      })) });
      return true;
    }
    if (normalizedPath === "/api/auth/sessions" && req.method === "GET") {
      const result = await authQuery({
        text: "SELECT * FROM hyperlinx.auth_sessions WHERE principal_id = $1 ORDER BY issued_at DESC LIMIT 50",
        values: [req.authUser.principalId],
      });
      jsonResponse(res, 200, { sessions: result.rows.map(sessionProjection) });
      return true;
    }
    if (normalizedPath === "/api/auth/sessions/revoke-all" && req.method === "POST") {
      await authQuery({
        text: "UPDATE hyperlinx.auth_sessions SET revoked_at = clock_timestamp(), revoked_reason = 'PRINCIPAL_REVOKE_ALL' WHERE principal_id = $1 AND revoked_at IS NULL",
        values: [req.authUser.principalId],
      });
      await auditAuth("SESSION_REVOKE_ALL", { principalId: req.authUser.principalId, membershipId: req.authUser.membershipId, organizationId: req.authUser.organizationId, sessionId: req.authSession.session_id, outcome: "SUCCESS", ...requestFingerprint(req) });
      clearSessionCookie(res);
      jsonResponse(res, 200, { ok: true });
      return true;
    }
    const revokeMatch = normalizedPath.match(/^\/api\/auth\/sessions\/([^/]+)\/revoke$/);
    if (revokeMatch && req.method === "POST") {
      const targetId = decodeURIComponent(revokeMatch[1]);
      const result = await authQuery({
        text: `UPDATE hyperlinx.auth_sessions SET revoked_at = clock_timestamp(), revoked_reason = 'SESSION_REVOKED'
          WHERE session_id = $1 AND revoked_at IS NULL AND (principal_id = $2 OR $3::boolean) RETURNING session_id`,
        values: [targetId, req.authUser.principalId, canAdministerRuntime(req.authUser)],
      });
      if (!result.rowCount) errorResponse(res, 404, "Revocable session not found.");
      else jsonResponse(res, 200, { ok: true, sessionId: targetId });
      return true;
    }
    if (normalizedPath.startsWith("/api/auth/personal-state")) {
      if (await handlePersonalState(req, res, normalizedPath)) return true;
    }
    return false;
  } catch (error) {
    console.error("[auth-route]", error instanceof Error ? error.message : String(error));
    errorResponse(res, 503, "Authentication authority is unavailable; request failed closed.");
    return true;
  }
}
