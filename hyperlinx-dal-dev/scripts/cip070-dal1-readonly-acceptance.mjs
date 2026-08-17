import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const baseUrl = process.env.CIP070_BASE_URL ?? "http://127.0.0.1:3001";
const password = (await readFile(process.env.CIP070_DEMO_CREDENTIAL_FILE ?? "/home/ubuntu/.hyperlinx-demo-credential", "utf8")).trim();
const accountId = "ACCOUNT-DEMO-NORTHSTAR";
const opportunityId = "OPPORTUNITY-DEMO-CIP067-NORTHSTAR-PERSISTENCE";
const proposalRevisionId = "PROPOSAL-DEMO-CIP067-NORTHSTAR-PERSISTENCE-revision-2";
const scopeVersionId = "ScopeVersion-0001-CERT-IOF-DRAFT-IOF-PROPOSAL-DEMO-CIP067-NORTHSTAR-PERSISTENCE";

async function call(pathname, { method = "GET", body, cookie = "", persona = "SALES", customerOrganization = "org-demo-customer-a", expected = [200] } = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(cookie ? { Cookie: cookie } : {}),
      "X-Hyperlinx-Demo-Persona": persona,
      "X-Hyperlinx-Demo-Customer-Organization": customerOrganization,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const raw = await response.text();
  let value = {};
  try { value = raw ? JSON.parse(raw) : {}; } catch { value = { byteLength: raw.length, contentType: response.headers.get("content-type") }; }
  assert.ok(expected.includes(response.status), `${pathname} returned ${response.status}: ${raw.slice(0, 300)}`);
  return { value, status: response.status, cookie: String(response.headers.get("set-cookie") ?? "").split(";")[0], contentType: response.headers.get("content-type") };
}

const login = await call("/api/auth/login", { method: "POST", body: { username: "demo", password } });
const cookie = login.cookie;
assert.equal(login.value.user.principalId, "demo-principal");
assert.equal(login.value.user.organizationId, "org-demo");

const accountsResponse = await call("/api/accounts", { cookie, persona: "SALES" });
const accounts = Array.isArray(accountsResponse.value) ? accountsResponse.value : accountsResponse.value.accounts ?? accountsResponse.value.items ?? [];
const account = accounts.find((item) => item.accountId === accountId);
assert.ok(account, "The accepted Northstar Account must be discoverable by exact accountId.");
const internal = (await call(`/api/accounts/${encodeURIComponent(accountId)}/customer-twin`, { cookie, persona: "SALES" })).value.customerTwin;
assert.equal(internal.customerTwinId, `CUSTOMER-TWIN-${accountId}`);
const internalDeal = internal.deals.find((deal) => deal.opportunityId === opportunityId);
assert.ok(internalDeal, "The accepted persisted Opportunity must be discoverable beneath Northstar.");
assert.equal(internalDeal.currentState, "AUTHORIZED");
assert.equal(internalDeal.commercial.proposalRevisionId, proposalRevisionId);
assert.equal(internalDeal.contractual.scopeVersionId, scopeVersionId);
assert.equal(internalDeal.customerSafe.lineage.status, "PASS");
assert.ok(internalDeal.customerSafe.route.coordinates.length >= 2);
assert.ok(internalDeal.customerSafe.route.routeMiles > 0);

const externalA = (await call("/api/customer-portal/account-twin", { cookie, persona: "CUSTOMER_VIEWER" })).value.customerTwin;
const externalDeal = externalA.deals.find((deal) => deal.opportunityId === opportunityId);
assert.ok(externalDeal);
for (const field of ["opportunityId", "accountId", "currentState"]) assert.equal(externalDeal[field], internalDeal[field]);
for (const branch of ["commercial", "spatial", "engineering", "contractual"]) assert.deepEqual(externalDeal[branch], internalDeal[branch]);
assert.deepEqual(externalDeal.customerSafe.route, internalDeal.customerSafe.route);
assert.equal(externalDeal.permittedActions.some((action) => action.mutation), false);

const project = (await call(`/api/customer-portal/projects/${encodeURIComponent(opportunityId)}`, { cookie, persona: "CUSTOMER_VIEWER" })).value.project;
assert.equal(project.projectId, opportunityId);
assert.equal(project.proposal.proposalRevisionId, proposalRevisionId);
assert.equal(project.map.routeRepositoryId, internalDeal.customerSafe.route.routeRepositoryId);
assert.equal(project.map.routeRevision, internalDeal.customerSafe.route.routeRevision);
assert.equal(project.map.routeGeometryId, internalDeal.customerSafe.route.routeGeometryId);
assert.equal(project.map.geometryHash, internalDeal.customerSafe.route.geometryHash);
assert.equal(project.scopeVersion.scopeVersionId, scopeVersionId);

const externalB = (await call("/api/customer-portal/account-twin", { cookie, persona: "CUSTOMER_VIEWER", customerOrganization: "org-demo-customer-b" })).value.customerTwin;
assert.equal(externalB.deals.some((deal) => deal.opportunityId === opportunityId), false);
const forbiddenInternalCustomerAction = await call(`/api/customer-portal/projects/${encodeURIComponent(opportunityId)}/proposal/accept`, { method: "POST", body: { proposalRevisionId, proposalHash: internalDeal.commercial.proposalHash }, cookie, persona: "SALES", expected: [403] });
assert.equal(forbiddenInternalCustomerAction.status, 403);

const proposalPdf = await call(`/api/exports/proposals/${encodeURIComponent(internalDeal.commercial.proposalId)}/revisions/${encodeURIComponent(proposalRevisionId)}/pdf`, { cookie, persona: "SALES" });
const serviceOrderPdf = await call(`/api/exports/service-orders/${encodeURIComponent(internalDeal.contractual.serviceOrderId)}/pdf`, { cookie, persona: "SALES" });
assert.match(proposalPdf.contentType ?? "", /application\/pdf/);
assert.match(serviceOrderPdf.contentType ?? "", /application\/pdf/);

console.log(JSON.stringify({
  result: "PASS", readOnlyAcceptance: true, account: { accountId, name: account.name }, customerTwinId: internal.customerTwinId,
  dealCount: internal.dealCount, stateCounts: internal.stateCounts, opportunityId, currentState: internalDeal.currentState,
  route: internalDeal.customerSafe.route, proposal: internalDeal.commercial, engineering: internalDeal.engineering,
  contractual: internalDeal.contractual, historicalProposalRevision: project.proposal,
  internalExternalParity: true, customerAtoBIsolation: true, viewerReadOnly: true,
  internalCustomerMutationRejected: true, proposalPdf: "PASS", serviceOrderPdf: "PASS",
  createsAuthority: internal.createsAuthority, lifecycleMutationPerformed: false,
}, null, 2));
