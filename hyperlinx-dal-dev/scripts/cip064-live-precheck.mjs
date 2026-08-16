import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const baseUrl = process.env.CIP064_BASE_URL ?? "http://127.0.0.1:3001";
const password = (await readFile(process.env.CIP064_DEMO_CREDENTIAL_FILE ?? "/home/ubuntu/.hyperlinx-demo-credential", "utf8")).trim();
const northstarId = "OPPORTUNITY-DEMO-CIP062-NORTHSTAR";
const personas = [
  "SALES",
  "ENGINEERING",
  "CUSTOMER_VIEWER",
  "CUSTOMER_COMMERCIAL_REVIEWER",
  "CUSTOMER_AUTHORIZED_SIGNER",
  "EXECUTIVE",
];

async function json(pathname, { method = "GET", cookie = "", persona = "SALES", body } = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
      "X-Hyperlinx-Demo-Persona": persona,
      "X-Hyperlinx-Demo-Customer-Organization": "org-demo-customer-a",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const value = await response.json().catch(() => ({}));
  return { response, value, cookie: String(response.headers.get("set-cookie") ?? "").split(";")[0] };
}

async function login() {
  const result = await json("/api/auth/login", { method: "POST", body: { username: "demo", password } });
  assert.equal(result.response.status, 200);
  assert.equal(result.value.user.principalId, "demo-principal");
  assert.equal(result.value.user.organizationId, "org-demo");
  assert.equal(result.value.user.authorityClass, "DEMO");
  assert.equal(result.value.user.role, "DEMO_SUPERUSER");
  return result.cookie;
}

const runtime = await json("/api/runtime");
assert.equal(runtime.response.status, 200);
const firstCookie = await login();
const views = {};
for (const persona of personas.filter((value) => value.startsWith("CUSTOMER_"))) {
  const result = await json("/api/customer-portal/projects", { cookie: firstCookie, persona });
  assert.equal(result.response.status, 200);
  const northstar = result.value.projects.find((project) => project.projectId === northstarId);
  assert.ok(northstar, `${persona} must receive the Northstar Customer Portal project.`);
  assert.equal(northstar.status, "AUTHORIZED");
  assert.equal(northstar.customerOrganizationId, "org-demo-customer-a");
  views[persona] = northstar.status;
}

const logout = await json("/api/auth/logout", { method: "POST", cookie: firstCookie });
assert.equal(logout.response.status, 200);
const loggedOut = await json("/api/auth/me", { cookie: firstCookie });
assert.equal(loggedOut.response.status, 401);

const secondCookie = await login();
const reloaded = await json("/api/customer-portal/projects", { cookie: secondCookie, persona: "CUSTOMER_VIEWER" });
assert.equal(reloaded.response.status, 200);
assert.equal(reloaded.value.projects.find((project) => project.projectId === northstarId)?.status, "AUTHORIZED");

console.log(JSON.stringify({
  result: "PASS",
  runtimeCommit: runtime.value.gitCommit,
  authenticatedActor: "demo-principal",
  role: "DEMO_SUPERUSER",
  personas,
  customerViews: views,
  logoutInvalidatedSession: true,
  reloginRetainedAuthority: true,
  northstarStatusAfterRelogin: "AUTHORIZED",
}, null, 2));
