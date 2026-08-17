import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const baseUrl = process.env.CIP074_BASE_URL ?? "http://127.0.0.1:3001";
const password = (await readFile(process.env.CIP074_DEMO_CREDENTIAL_FILE ?? "/home/ubuntu/.hyperlinx-demo-credential", "utf8")).trim();
const accountId = "ACCOUNT-DEMO-NORTHSTAR";
const opportunityId = "DEMO-OPP-NORTHSTAR-CLOUD-INFRASTRUCTURE-CHEYENNE-METRO-DUCT-SYSTEM-31-1786992282335";
const proposalRevisionId = "DEMO-PROP-NORTHSTAR-CLOUD-INFRASTRUCTURE-CHEYENNE-METRO-DUCT-SYSTEM-31-v1-revision-2";
const proposalHash = "3b6a99a518ad4e43f7030e1aa14cff46bf0e895bab62dc8ad5eea400d65e9673";

async function request(pathname, { method = "GET", body, cookie = "", persona = "SALES", customerOrganizationId = "org-demo-customer-a", expected = [200] } = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(cookie ? { Cookie: cookie } : {}),
      "X-Hyperlinx-Demo-Persona": persona,
      "X-Hyperlinx-Demo-Customer-Organization": customerOrganizationId,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const raw = await response.text();
  let value = {};
  try { value = raw ? JSON.parse(raw) : {}; } catch { value = { raw }; }
  assert.ok(expected.includes(response.status), `${method} ${pathname} returned ${response.status}: ${raw.slice(0, 300)}`);
  return { value, status: response.status, cookie: String(response.headers.get("set-cookie") ?? "").split(";")[0], contentType: response.headers.get("content-type") };
}

const login = await request("/api/auth/login", { method: "POST", body: { username: "demo", password } });
const cookie = login.cookie;
assert.equal(login.value.user.principalId, "demo-principal");
assert.equal(login.value.user.organizationId, "org-demo");

const internal = (await request(`/api/accounts/${accountId}/customer-twin`, { cookie })).value.customerTwin;
const internalDeal = internal.deals.find((item) => item.opportunityId === opportunityId);
assert.ok(internalDeal);
assert.equal(internalDeal.currentState, "ENGINEERING");
assert.equal(internalDeal.artifactStates.proposal.state, "ACCEPTED");
assert.equal(internalDeal.artifactStates.customerReview.state, "COMPLETE");
assert.equal(internalDeal.artifactStates.customerAcceptance.state, "COMPLETE");
assert.equal(internalDeal.artifactStates.engineering.eligibility, "SUBMITTED");
assert.equal(internalDeal.artifactStates.serviceOrder.state, "NOT_CREATED");
assert.equal(internalDeal.artifactStates.scopeVersion.state, "NOT_AUTHORIZED");
assert.equal(internalDeal.commercial.proposalRevisionId, proposalRevisionId);
assert.equal(internalDeal.commercial.proposalHash, proposalHash);
assert.equal(internalDeal.customerSafe.lineage.status, "PASS");
assert.equal(internalDeal.customerSafe.route.routeRevision, 2);
assert.equal(internalDeal.customerSafe.route.geometryHash, "rg-503c4625");
assert.equal(internalDeal.customerSafe.route.routeMiles, 31.05);
assert.equal(internalDeal.customerSafe.economics.nrc, 4082311);
assert.equal(internalDeal.customerSafe.economics.mrc, 3105);
assert.equal(internalDeal.customerSafe.economics.termMonths, 240);
for (const eventType of ["PROPOSAL_SUBMITTED_TO_CUSTOMER", "CUSTOMER_ACCEPT", "ENGINEERING_SUBMITTED"]) {
  assert.ok(internalDeal.activity.some((item) => item.eventType === eventType), `Missing governed activity ${eventType}`);
}

const external = (await request("/api/customer-portal/account-twin", { cookie, persona: "CUSTOMER_VIEWER" })).value.customerTwin;
const externalDeal = external.deals.find((item) => item.opportunityId === opportunityId);
assert.ok(externalDeal);
for (const branch of ["commercial", "spatial", "engineering", "contractual", "artifactStates", "customerSafe"]) assert.deepEqual(externalDeal[branch], internalDeal[branch]);
assert.ok(externalDeal.activity.every((item) => item.customerSafe));
assert.equal(externalDeal.activity.some((item) => item.eventType === "INTERNAL_COMMERCIAL_APPROVED"), false);

const project = (await request(`/api/customer-portal/projects/${opportunityId}`, { cookie, persona: "CUSTOMER_VIEWER" })).value.project;
assert.equal(project.projectId, opportunityId);
assert.equal(project.status, "ENGINEERING_SUBMITTED");
assert.equal(project.proposal.proposalRevisionId, proposalRevisionId);
assert.equal(project.proposal.proposalHash, proposalHash);
assert.equal(project.map.routeRevision, internalDeal.customerSafe.route.routeRevision);
assert.equal(project.map.geometryHash, internalDeal.customerSafe.route.geometryHash);
assert.deepEqual(project.artifactStates, internalDeal.artifactStates);

const pdf = await request(`/api/exports/proposals/${encodeURIComponent(internalDeal.commercial.proposalId)}/revisions/${encodeURIComponent(proposalRevisionId)}/pdf`, { cookie });
assert.match(pdf.contentType ?? "", /application\/pdf/);

const exact = { accountId, opportunityId, proposalRevisionId, proposalHash };
await request(`/api/customer-portal/projects/${opportunityId}/proposal/accept`, { method: "POST", cookie, persona: "CUSTOMER_VIEWER", body: exact, expected: [403] });
await request(`/api/commercial/iof-packages/DRAFT-IOF-DEMO-PROP-NORTHSTAR-CLOUD-INFRASTRUCTURE-CHEYENNE-METRO-DUCT-SYSTEM-31-v1/submit-engineering`, { method: "POST", cookie, persona: "CUSTOMER_COMMERCIAL_REVIEWER", expected: [403] });
await request("/api/scopeversions", { method: "POST", cookie, persona: "CUSTOMER_COMMERCIAL_REVIEWER", body: {}, expected: [403] });

const customerB = (await request("/api/customer-portal/account-twin", { cookie, persona: "CUSTOMER_VIEWER", customerOrganizationId: "org-demo-customer-b" })).value.customerTwin;
assert.equal(customerB.deals.some((item) => item.opportunityId === opportunityId), false);

await request("/api/auth/logout", { method: "POST", cookie });
const relogin = await request("/api/auth/login", { method: "POST", body: { username: "demo", password } });
const reloaded = (await request(`/api/accounts/${accountId}/customer-twin`, { cookie: relogin.cookie })).value.customerTwin.deals.find((item) => item.opportunityId === opportunityId);
assert.equal(reloaded.currentState, "ENGINEERING");
assert.deepEqual(reloaded.artifactStates, internalDeal.artifactStates);
assert.deepEqual(reloaded.customerSafe, internalDeal.customerSafe);
await request("/api/auth/logout", { method: "POST", cookie: relogin.cookie });

console.log(JSON.stringify({
  result: "PASS",
  mutationPerformed: false,
  accountId,
  opportunityId,
  state: internalDeal.currentState,
  proposal: { proposalRevisionId, proposalHash, state: internalDeal.artifactStates.proposal.state },
  route: { routeRevision: internalDeal.customerSafe.route.routeRevision, geometryHash: internalDeal.customerSafe.route.geometryHash, routeMiles: internalDeal.customerSafe.route.routeMiles },
  economics: internalDeal.customerSafe.economics,
  activity: internalDeal.activity.map((item) => ({ eventType: item.eventType, actor: item.actor, timestamp: item.timestamp })),
  accountPortfolio: internal.deals.map((item) => ({ opportunityId: item.opportunityId, title: item.title, state: item.currentState, proposalRevision: item.commercial.proposalRevisionNumber ?? null })),
  internalCustomerParity: true,
  customerSafeActivity: true,
  deepLinkProjectStatus: project.status,
  proposalPdf: "PASS",
  negativeAuthority: "PASS",
  logoutLoginRehydration: "PASS",
  customerBIsolation: "PASS",
  scopeVersionCreated: false,
}, null, 2));
