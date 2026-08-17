import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const baseUrl = process.env.CIP071A_BASE_URL ?? "http://127.0.0.1:3001";
const password = (await readFile(process.env.CIP071A_DEMO_CREDENTIAL_FILE ?? "/home/ubuntu/.hyperlinx-demo-credential", "utf8")).trim();
const accountId = "ACCOUNT-DEMO-NORTHSTAR";
const opportunityId = "OPPORTUNITY-DEMO-CIP067-NORTHSTAR-PERSISTENCE";

async function call(pathname, { method = "GET", body, cookie = "", persona = "SALES", customerOrganization = "org-demo-customer-a" } = {}) {
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
  const value = await response.json().catch(() => ({}));
  assert.equal(response.status, 200, `${pathname} returned ${response.status}: ${JSON.stringify(value).slice(0, 300)}`);
  return { value, cookie: String(response.headers.get("set-cookie") ?? "").split(";")[0] };
}

const login = await call("/api/auth/login", { method: "POST", body: { username: "demo", password } });
const cookie = login.cookie;
assert.equal(login.value.user.principalId, "demo-principal");
const internal = (await call(`/api/accounts/${accountId}/customer-twin`, { cookie })).value.customerTwin;
const external = (await call("/api/customer-portal/account-twin", { cookie, persona: "CUSTOMER_VIEWER" })).value.customerTwin;
const project = (await call(`/api/customer-portal/projects/${opportunityId}`, { cookie, persona: "CUSTOMER_VIEWER" })).value.project;
const internalDeal = internal.deals.find((item) => item.opportunityId === opportunityId);
const externalDeal = external.deals.find((item) => item.opportunityId === opportunityId);
assert.ok(internalDeal && externalDeal);
assert.equal(internalDeal.currentState, "AUTHORIZED");
assert.equal(externalDeal.currentState, "AUTHORIZED");
assert.equal(project.status, "AUTHORIZED");
assert.deepEqual(externalDeal.commercial, internalDeal.commercial);
assert.deepEqual(externalDeal.engineering, internalDeal.engineering);
assert.deepEqual(externalDeal.contractual, internalDeal.contractual);

if (process.env.CIP071A_REQUIRE_ARTIFACT_STATES === "1") {
  for (const candidate of [internalDeal, externalDeal]) {
    assert.equal(candidate.artifactStates.proposal.state, "ACCEPTED");
    assert.equal(candidate.artifactStates.engineering.state, "CERTIFIED");
    assert.equal(candidate.artifactStates.certifiedIof.state, "CERTIFIED");
    assert.equal(candidate.artifactStates.serviceOrder.state, "COUNTERSIGNED");
    assert.equal(candidate.artifactStates.serviceOrder.signatureState, "FULLY_SIGNED");
    assert.equal(candidate.artifactStates.scopeVersion.state, "AUTHORIZED");
  }
  assert.deepEqual(externalDeal.artifactStates, internalDeal.artifactStates);
  assert.deepEqual(project.artifactStates, internalDeal.artifactStates);
  const acceptedRevisions = internalDeal.documentHistory.filter((item) => item.documentType === "PROPOSAL" && item.status === "ACCEPTED");
  assert.ok(acceptedRevisions.length >= 1, "At least one exact persisted Proposal acceptance must remain visible in history.");
}

console.log(JSON.stringify({
  result: "PASS",
  mutationPerformed: false,
  customerTwinState: internalDeal.currentState,
  proposal: internalDeal.commercial,
  engineering: internalDeal.engineering,
  contractual: internalDeal.contractual,
  artifactStates: internalDeal.artifactStates ?? null,
  proposalHistory: internalDeal.documentHistory.filter((item) => item.documentType === "PROPOSAL"),
  internalExternalParity: true,
  projectStatus: project.status,
}, null, 2));
