import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const baseUrl = process.env.CIP065_BASE_URL ?? "http://127.0.0.1:3001";
const password = (await readFile(process.env.CIP065_DEMO_CREDENTIAL_FILE ?? "/home/ubuntu/.hyperlinx-demo-credential", "utf8")).trim();
const northstarOpportunityId = "OPPORTUNITY-DEMO-CIP062-NORTHSTAR";

async function request(pathname, { cookie = "", persona = "SALES", customerOrganizationId = "org-demo-customer-a", method = "GET", body } = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, { method, headers: {
    ...(cookie ? { Cookie: cookie } : {}), ...(body ? { "Content-Type": "application/json" } : {}),
    "X-Hyperlinx-Demo-Persona": persona, "X-Hyperlinx-Demo-Customer-Organization": customerOrganizationId,
  }, body: body ? JSON.stringify(body) : undefined });
  const value = await response.json();
  if (!response.ok) throw new Error(`${pathname} (${response.status}): ${value.error ?? JSON.stringify(value)}`);
  return { value, cookie: String(response.headers.get("set-cookie") ?? "").split(";")[0] };
}

const login = await request("/api/auth/login", { method: "POST", body: { username: "demo", password } });
assert.equal(login.value.user.principalId, "demo-principal");
const cookie = login.cookie;
const customerResults = {};
for (const persona of ["CUSTOMER_VIEWER", "CUSTOMER_COMMERCIAL_REVIEWER", "CUSTOMER_AUTHORIZED_SIGNER"]) {
  const twin = (await request("/api/customer-portal/account-twin", { cookie, persona })).value.customerTwin;
  assert.equal(twin.customerTwinId, "CUSTOMER-TWIN-ACCOUNT-DEMO-NORTHSTAR");
  assert.equal(twin.account.accountId, "ACCOUNT-DEMO-NORTHSTAR");
  assert.equal(twin.lens, "CUSTOMER");
  assert.equal(twin.createsAuthority, false);
  const deal = twin.deals.find((item) => item.opportunityId === northstarOpportunityId);
  assert.ok(deal);
  assert.equal(deal.currentState, "AUTHORIZED");
  assert.equal(deal.lifecycle.at(-1).status, "CURRENT");
  assert.equal(deal.contractual.scopeVersionId, "ScopeVersion-0001-CERT-IOF-DRAFT-IOF-PROPOSAL-DEMO-CIP062-NORTHSTAR");
  customerResults[persona] = { state: deal.currentState, permittedActions: deal.permittedActions.map((item) => item.action) };
}
const internal = (await request("/api/accounts/ACCOUNT-DEMO-NORTHSTAR/customer-twin", { cookie, persona: "SALES" })).value.customerTwin;
assert.equal(internal.lens, "INTERNAL");
assert.equal(internal.deals.find((item) => item.opportunityId === northstarOpportunityId)?.currentState, "AUTHORIZED");
const customerB = (await request("/api/customer-portal/account-twin", { cookie, persona: "CUSTOMER_VIEWER", customerOrganizationId: "org-demo-customer-b" })).value.customerTwin;
assert.equal(customerB.account.accountId, "ACCOUNT-DEMO-BLUE-MESA");
assert.equal(customerB.deals.some((item) => item.opportunityId === northstarOpportunityId), false);
await request("/api/auth/logout", { cookie, method: "POST" });

console.log(JSON.stringify({ result: "PASS", actor: "demo-principal", customerTwinId: internal.customerTwinId, northstarState: "AUTHORIZED", internalExternalParity: "PASS", customerBIsolation: "PASS", customerResults, createsAuthority: false }, null, 2));
