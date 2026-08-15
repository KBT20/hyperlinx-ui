import { createHash, randomBytes, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import process from "node:process";
import { authQuery, closeAuthPool } from "../server/auth/postgres.js";

async function stdinJson() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) throw new Error("Acceptance configuration is required on stdin.");
  return JSON.parse(raw);
}

const tokenHash = (value) => createHash("sha256").update(value).digest("hex");
const oldAlphaToken = (sub, username, role) => Buffer.from(JSON.stringify({ sub, username, role, iat: new Date().toISOString() })).toString("base64url");

function cookieFrom(response) {
  return String(response.headers.get("set-cookie") ?? "").split(";")[0];
}

async function call(baseUrl, path, options = {}) {
  const headers = { ...(options.headers ?? {}) };
  if (options.cookie) headers.Cookie = options.cookie;
  if (options.bearer) headers.Authorization = `Bearer ${options.bearer}`;
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  const started = performance.now();
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  let body;
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
  const expected = Array.isArray(options.expected) ? options.expected : [options.expected ?? 200];
  if (!expected.includes(response.status)) throw new Error(`${path} expected ${expected.join("/")}, received ${response.status}: ${text.slice(0, 300)}`);
  return { response, body, cookie: cookieFrom(response), durationMs: Number((performance.now() - started).toFixed(2)) };
}

async function waitForRuntime(baseUrl) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return;
    } catch {
      // Restart interval.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Runtime did not recover after PM2 restart.");
}

async function login(baseUrl, username, password) {
  const result = await call(baseUrl, "/api/auth/login", { method: "POST", body: { username, password } });
  if (!result.cookie) throw new Error(`Login for ${username} did not issue an HttpOnly session cookie.`);
  const cookieHeader = String(result.response.headers.get("set-cookie") ?? "");
  for (const attribute of ["HttpOnly", "Secure", "SameSite=Strict"]) {
    if (!cookieHeader.includes(attribute)) throw new Error(`Login cookie is missing ${attribute}.`);
  }
  if (result.body.token) throw new Error("Login exposed a browser-readable bearer credential.");
  return result;
}

async function main() {
  const config = await stdinJson();
  const baseUrl = String(config.baseUrl ?? "http://127.0.0.1:3001").replace(/\/+$/, "");
  const users = config.users ?? {};
  const principals = {
    kyle: "teralinx-user-kyle",
    ryan: "teralinx-user-ryan",
    fran: "teralinx-user-fran",
  };
  const expectedRoles = { kyle: "ADMINISTRATOR_COO", ryan: "CRO", fran: "CEO" };
  const timings = {};
  const checks = [];
  const pass = (name, detail = "PASS") => checks.push({ name, result: "PASS", detail });

  await call(baseUrl, "/api/auth/users", { expected: 401 });
  pass("anonymous user enumeration", "BLOCKED");
  await call(baseUrl, "/api/commercial/opportunities", { expected: 401 });
  pass("anonymous governed API", "BLOCKED");

  for (const [name, principalId] of Object.entries(principals)) {
    await call(baseUrl, "/api/auth/me", { bearer: oldAlphaToken(principalId, name, expectedRoles[name]), expected: 401 });
  }
  pass("legacy unsigned alpha tokens", "REJECTED");
  await call(baseUrl, "/api/auth/me", { bearer: randomBytes(32).toString("base64url"), expected: 401 });
  pass("fabricated opaque token", "REJECTED");

  const sessions = {};
  for (const name of Object.keys(principals)) {
    const result = await login(baseUrl, name, users[name].password);
    timings[`${name}LoginMs`] = result.durationMs;
    if (result.body.user?.principalId !== principals[name]) throw new Error(`${name} resolved the wrong principal.`);
    if (result.body.user?.role !== expectedRoles[name]) throw new Error(`${name} resolved the wrong role.`);
    sessions[name] = { cookie: result.cookie, sessionId: result.body.session.sessionId, password: users[name].password };
  }
  if (new Set(Object.values(sessions).map((session) => session.cookie)).size !== 3) throw new Error("Independent users received a shared session credential.");
  pass("three independent sessions");

  const modifiedCookie = sessions.kyle.cookie.slice(0, -1) + (sessions.kyle.cookie.endsWith("A") ? "B" : "A");
  await call(baseUrl, "/api/auth/me", { cookie: modifiedCookie, expected: 401 });
  pass("modified session token", "REJECTED");

  const nextKylePassword = randomBytes(30).toString("base64url");
  await call(baseUrl, "/api/auth/password", { method: "POST", cookie: sessions.kyle.cookie, body: { currentPassword: sessions.kyle.password, newPassword: nextKylePassword } });
  await call(baseUrl, "/api/auth/me", { cookie: sessions.kyle.cookie, expected: 401 });
  await call(baseUrl, "/api/auth/login", { method: "POST", body: { username: "kyle", password: sessions.kyle.password }, expected: 401 });
  const kyleRelogin = await login(baseUrl, "kyle", nextKylePassword);
  sessions.kyle = { cookie: kyleRelogin.cookie, sessionId: kyleRelogin.body.session.sessionId, password: nextKylePassword };
  pass("password rotation invalidates prior sessions and credentials");

  for (const name of Object.keys(principals)) {
    const result = await call(baseUrl, "/api/auth/me", { cookie: sessions[name].cookie });
    if (result.body.principal?.principalId !== principals[name]) throw new Error(`${name} /api/auth/me mismatch.`);
    if (result.body.membership?.organizationId !== "org-teralinx") throw new Error(`${name} organization mismatch.`);
  }
  pass("server-authoritative /api/auth/me");

  const preferenceKey = "saved-filters";
  for (const name of Object.keys(principals)) {
    const marker = `cip060-phase2b-${name}`;
    const spoof = name === "ryan" ? { principalId: principals.kyle, membershipId: "membership-teralinx-user-kyle", organizationId: "org-fabricated" } : {};
    const written = await call(baseUrl, `/api/auth/personal-state/${preferenceKey}?principalId=${encodeURIComponent(principals.kyle)}`, {
      method: "PUT", cookie: sessions[name].cookie, body: { ...spoof, value: { marker } },
    });
    if (written.body.principalId !== principals[name] || written.body.organizationId !== "org-teralinx") throw new Error(`${name} personal state trusted client identity fields.`);
    const read = await call(baseUrl, `/api/auth/personal-state/${preferenceKey}`, { cookie: sessions[name].cookie });
    if (read.body.value?.marker !== marker) throw new Error(`${name} personal state was not isolated.`);
  }
  pass("personal-state isolation and actor/organization spoof rejection");

  const sharedAccountId = String(config.sharedAccountId ?? "google");
  const sharedIds = [];
  for (const name of Object.keys(principals)) {
    const result = await call(baseUrl, `/api/accounts/${encodeURIComponent(sharedAccountId)}`, { cookie: sessions[name].cookie });
    sharedIds.push(result.body.account?.accountId);
  }
  if (new Set(sharedIds).size !== 1 || sharedIds[0] !== sharedAccountId) throw new Error("Users did not resolve the same governed Account.");
  pass("same-organization shared governed truth", `Account ${sharedAccountId}; no duplicate per-user records`);

  await call(baseUrl, "/api/auth/users", { cookie: sessions.kyle.cookie });
  await call(baseUrl, "/api/auth/users", { cookie: sessions.ryan.cookie, expected: 403 });
  await call(baseUrl, "/api/auth/users", { cookie: sessions.fran.cookie, expected: 403 });
  pass("server-side role enforcement", "Kyle PASS; Ryan/Fran 403");

  const franSecond = await login(baseUrl, "fran", sessions.fran.password);
  await call(baseUrl, `/api/auth/sessions/${encodeURIComponent(franSecond.body.session.sessionId)}/revoke`, { method: "POST", cookie: sessions.fran.cookie });
  await call(baseUrl, "/api/auth/me", { cookie: franSecond.cookie, expected: 401 });
  await call(baseUrl, "/api/auth/me", { cookie: sessions.fran.cookie });
  pass("single-session revocation");

  const expiredToken = randomBytes(32).toString("base64url");
  const expiredSessionId = randomUUID();
  const credential = await authQuery({
    text: `SELECT m.membership_id,m.organization_id,c.credential_version FROM hyperlinx.memberships m
      JOIN hyperlinx.principal_credentials c USING(principal_id) WHERE m.principal_id = $1 AND m.status = 'ACTIVE'`,
    values: [principals.fran],
  });
  const expiredIdentity = credential.rows[0];
  await authQuery({
    text: `INSERT INTO hyperlinx.auth_sessions (session_id,token_hash,principal_id,membership_id,organization_id,credential_version,issued_at,last_seen_at,idle_expires_at,absolute_expires_at)
      VALUES ($1,$2,$3,$4,$5,$6,clock_timestamp()-interval '2 hours',clock_timestamp()-interval '2 hours',clock_timestamp()-interval '1 hour',clock_timestamp()-interval '30 minutes')`,
    values: [expiredSessionId, tokenHash(expiredToken), principals.fran, expiredIdentity.membership_id, expiredIdentity.organization_id, expiredIdentity.credential_version],
  });
  await call(baseUrl, "/api/auth/me", { bearer: expiredToken, expected: 401 });
  const expiredRow = await authQuery({ text: "SELECT revoked_at FROM hyperlinx.auth_sessions WHERE session_id=$1", values: [expiredSessionId] });
  if (!expiredRow.rows[0]?.revoked_at) throw new Error("Expired session was rejected but not durably closed.");
  pass("expired session", "REJECTED");

  execFileSync("pm2", ["restart", "hyperlinx-dal-api"], { stdio: "ignore" });
  await waitForRuntime(baseUrl);
  for (const name of Object.keys(principals)) await call(baseUrl, "/api/auth/me", { cookie: sessions[name].cookie });
  pass("session durability across PM2 restart");

  await call(baseUrl, "/api/auth/logout", { method: "POST", cookie: sessions.ryan.cookie });
  await call(baseUrl, "/api/auth/me", { cookie: sessions.ryan.cookie, expected: 401 });
  await call(baseUrl, "/api/auth/me", { cookie: sessions.kyle.cookie });
  pass("logout invalidation and cross-user session isolation");

  await call(baseUrl, "/api/auth/sessions/revoke-all", { method: "POST", cookie: sessions.fran.cookie });
  await call(baseUrl, "/api/auth/me", { cookie: sessions.fran.cookie, expected: 401 });
  pass("principal session revocation");

  await call(baseUrl, "/api/auth/logout", { method: "POST", cookie: sessions.kyle.cookie });
  await call(baseUrl, "/api/auth/me", { cookie: sessions.kyle.cookie, expected: 401 });

  const audit = await authQuery({
    text: "SELECT event_type,outcome,count(*)::integer AS count FROM hyperlinx.auth_audit_events GROUP BY event_type,outcome ORDER BY event_type,outcome",
  });
  console.log(JSON.stringify({
    decision: "PHASE 2B SECURITY ACCEPTANCE PASSED",
    checks,
    principals: Object.fromEntries(Object.keys(principals).map((name) => [name, { principalId: principals[name], role: expectedRoles[name] }])),
    timings,
    authAuditSummary: audit.rows,
    activeAcceptanceSessionsRemaining: 0,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}).finally(() => closeAuthPool());
