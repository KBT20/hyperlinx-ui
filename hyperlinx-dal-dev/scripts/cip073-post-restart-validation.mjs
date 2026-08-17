import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const baseUrl = process.env.CIP073_BASE_URL ?? "http://127.0.0.1:3001";
const password = (await readFile(process.env.CIP073_DEMO_CREDENTIAL_FILE ?? "/home/ubuntu/.hyperlinx-demo-credential", "utf8")).trim();
const accountId = "ACCOUNT-DEMO-NORTHSTAR";
const opportunityId = "DEMO-OPP-NORTHSTAR-CLOUD-INFRASTRUCTURE-CHEYENNE-METRO-DUCT-SYSTEM-31-1786992282335";
const proposalId = "DEMO-PROP-NORTHSTAR-CLOUD-INFRASTRUCTURE-CHEYENNE-METRO-DUCT-SYSTEM-31-v1";
const proposalRevisionId = `${proposalId}-revision-2`;
const proposalHash = "3b6a99a518ad4e43f7030e1aa14cff46bf0e895bab62dc8ad5eea400d65e9673";
const engineeringPackageId = `ENG-PKG-DRAFT-IOF-${proposalId}`;

async function request(pathname, { method = "GET", body, cookie = "", persona = "SALES", customerOrganizationId = "org-demo-customer-a" } = {}) {
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
  const value = raw ? JSON.parse(raw) : {};
  assert.ok(response.ok, `${method} ${pathname} failed (${response.status}): ${value.error ?? raw}`);
  return { value, cookie: String(response.headers.get("set-cookie") ?? "").split(";")[0] };
}

const login = await request("/api/auth/login", { method: "POST", body: { username: "demo", password } });
assert.equal(login.value.user.principalId, "demo-principal");
assert.equal(login.value.user.organizationId, "org-demo");
const cookie = login.cookie;

const proposal = (await request(`/api/proposals/${encodeURIComponent(proposalId)}`, { cookie })).value.proposal;
assert.equal(proposal.proposalRevisionId, proposalRevisionId);
assert.equal(proposal.proposalHash, proposalHash);
assert.equal(proposal.revisionNumber, 2);
assert.equal(proposal.proposalRevisions.length, 2);
assert.equal(proposal.internalCommercialApproval.opportunityMateriality.decision, "NON_MATERIAL");

const twin = (await request(`/api/accounts/${encodeURIComponent(accountId)}/customer-twin`, { cookie })).value.customerTwin;
const deal = twin.deals.find((item) => item.opportunityId === opportunityId);
assert.ok(deal, "Cheyenne deal must remain discoverable from the Account Customer Twin.");
assert.equal(deal.currentState, "ENGINEERING");
assert.equal(deal.artifactStates.proposal.state, "ACCEPTED");
assert.equal(deal.artifactStates.customerAcceptance.state, "COMPLETE");
assert.equal(deal.artifactStates.engineering.eligibility, "SUBMITTED");
assert.equal(deal.engineering.engineeringPackageId, engineeringPackageId);
assert.equal(deal.commercial.proposalRevisionId, proposalRevisionId);
assert.equal(deal.commercial.proposalHash, proposalHash);
assert.equal(deal.contractual.scopeVersionId, null);

const externalTwin = (await request("/api/customer-portal/account-twin", { cookie, persona: "CUSTOMER_VIEWER" })).value.customerTwin;
const externalDeal = externalTwin.deals.find((item) => item.opportunityId === opportunityId);
assert.ok(externalDeal, "The exact Cheyenne deal must remain visible through the bounded Customer lens.");
for (const field of ["opportunityId", "accountId", "currentState"]) assert.equal(externalDeal[field], deal[field]);
for (const branch of ["commercial", "spatial", "engineering", "contractual", "artifactStates"]) assert.deepEqual(externalDeal[branch], deal[branch]);
assert.deepEqual(externalDeal.customerSafe, deal.customerSafe);
assert.equal(externalDeal.permittedActions.some((action) => action.mutation), false);

const project = (await request(`/api/customer-portal/projects/${encodeURIComponent(opportunityId)}`, { cookie, persona: "CUSTOMER_VIEWER" })).value.project;
assert.equal(project.projectId, opportunityId);
assert.equal(project.status, "ENGINEERING_SUBMITTED");
assert.equal(project.proposal.proposalRevisionId, proposalRevisionId);
assert.equal(project.proposal.proposalHash, proposalHash);
assert.equal(project.map.routeRepositoryId, deal.customerSafe.route.routeRepositoryId);
assert.equal(project.map.routeRevision, deal.customerSafe.route.routeRevision);
assert.equal(project.map.routeGeometryId, deal.customerSafe.route.routeGeometryId);
assert.equal(project.map.geometryHash, deal.customerSafe.route.geometryHash);
assert.deepEqual(project.artifactStates, deal.artifactStates);

const customerBTwin = (await request("/api/customer-portal/account-twin", {
  cookie,
  persona: "CUSTOMER_VIEWER",
  customerOrganizationId: "org-demo-customer-b",
})).value.customerTwin;
assert.equal(customerBTwin.deals.some((item) => item.opportunityId === opportunityId), false);

await request("/api/auth/logout", { method: "POST", cookie });

console.log(JSON.stringify({
  result: "PASS",
  authority: "READ_ONLY_POST_RESTART_REHYDRATION",
  accountId,
  opportunityId,
  proposalId,
  proposalRevisionId,
  proposalHash,
  revisionCount: proposal.proposalRevisions.length,
  opportunityMateriality: proposal.internalCommercialApproval.opportunityMateriality.decision,
  customerAcceptanceState: deal.artifactStates.customerAcceptance.state,
  engineeringPackageId,
  finalState: deal.currentState,
  scopeVersionAbsent: deal.contractual.scopeVersionId === null,
  internalExternalProjectionParity: true,
  customerBIsolation: true,
  customerMapLineage: deal.customerSafe.lineage.status,
}, null, 2));
