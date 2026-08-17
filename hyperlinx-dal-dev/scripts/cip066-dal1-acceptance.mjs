import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const baseUrl = process.env.CIP066_BASE_URL ?? "http://127.0.0.1:3001";
const password = (await readFile(process.env.CIP066_DEMO_CREDENTIAL_FILE ?? "/home/ubuntu/.hyperlinx-demo-credential", "utf8")).trim();
const proposalId = "PROPOSAL-DEMO-CIP062-NORTHSTAR";
const opportunityId = "OPPORTUNITY-DEMO-CIP062-NORTHSTAR";
const serviceOrderId = `SO-${proposalId}-R001`;
const revisions = [1,2,3].map((number) => `${proposalId}-revision-${number}`);

async function request(pathname, { cookie = "", persona = "SALES", customerOrganizationId = "org-demo-customer-a", method = "GET", body, binary = false } = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, { method, headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body ? { "Content-Type": "application/json" } : {}), "X-Hyperlinx-Demo-Persona": persona, "X-Hyperlinx-Demo-Customer-Organization": customerOrganizationId }, body: body ? JSON.stringify(body) : undefined });
  if (binary) return { response, body: Buffer.from(await response.arrayBuffer()) };
  const value = await response.json();
  if (!response.ok) throw new Error(`${pathname} (${response.status}): ${value.error ?? JSON.stringify(value)}`);
  return { response, value, cookie: String(response.headers.get("set-cookie") ?? "").split(";")[0] };
}

const login = await request("/api/auth/login", { method: "POST", body: { username: "demo", password } });
assert.equal(login.value.user.principalId, "demo-principal");
const cookie = login.cookie;
const viewer = (await request("/api/customer-portal/account-twin", { cookie, persona: "CUSTOMER_VIEWER" })).value.customerTwin;
const deal = viewer.deals.find((item) => item.opportunityId === opportunityId);
assert.ok(deal);
assert.equal(deal.currentState, "AUTHORIZED");
assert.equal(deal.customerSafe.lineage.status, "PASS");
assert.ok(deal.customerSafe.route.coordinates.length >= 2);
assert.equal(deal.customerSafe.route.geometryHash, "rg-64c0ada0");
assert.equal(deal.commercial.proposalRevisionId, revisions[2]);
assert.equal(deal.customerSafe.doctrineLineage.productDoctrineId, "DOCTRINE-L1-POINT-TO-POINT-LONG-HAUL-CONDUIT-FIBER");
assert.equal(deal.customerSafe.contracting.demoLegalClassification, "DEMO_PLACEHOLDER_NOT_APPROVED_LEGAL_TERMS");
assert.deepEqual(deal.documentHistory.filter((item) => item.documentType === "PROPOSAL").map((item) => item.status), ["SUPERSEDED", "SUPERSEDED", "ACCEPTED"]);
assert.equal(deal.permittedActions.some((action) => action.mutation), false);
assert.ok(viewer.tasks.some((task) => task.taskType === "AUTHORIZED_PROJECT" && task.dealIds.includes(opportunityId)));

const pdfResults = [];
for (const revisionId of revisions) {
  const pdf = await request(`/api/exports/proposals/${proposalId}/revisions/${revisionId}/pdf`, { cookie, persona: "CUSTOMER_VIEWER", binary: true });
  assert.equal(pdf.response.status, 200);
  assert.equal(pdf.response.headers.get("content-type"), "application/pdf");
  assert.equal(pdf.response.headers.get("x-teralinx-proposal-revision"), revisionId);
  assert.ok(pdf.body.subarray(0,4).equals(Buffer.from("%PDF")));
  pdfResults.push({ revisionId, bytes: pdf.body.length });
}
const serviceOrderPdf = await request(`/api/exports/service-orders/${serviceOrderId}/pdf`, { cookie, persona: "CUSTOMER_VIEWER", binary: true });
assert.equal(serviceOrderPdf.response.status, 200);
assert.equal(serviceOrderPdf.response.headers.get("content-type"), "application/pdf");
assert.ok(serviceOrderPdf.body.subarray(0,4).equals(Buffer.from("%PDF")));
const internal = (await request("/api/accounts/ACCOUNT-DEMO-NORTHSTAR/customer-twin", { cookie, persona: "SALES" })).value.customerTwin;
assert.equal(internal.lens, "INTERNAL");
assert.equal(internal.deals.find((item) => item.opportunityId === opportunityId)?.customerSafe.lineage.status, "PASS");
const customerB = (await request("/api/customer-portal/account-twin", { cookie, persona: "CUSTOMER_VIEWER", customerOrganizationId: "org-demo-customer-b" })).value.customerTwin;
assert.equal(customerB.deals.some((item) => item.opportunityId === opportunityId), false);
await request("/api/auth/logout", { cookie, method: "POST" });

console.log(JSON.stringify({ result: "PASS", actor: "demo-principal", customerTwinId: viewer.customerTwinId, state: deal.currentState, exactSpine: { routeRepositoryId: deal.customerSafe.route.routeRepositoryId, routeRevision: deal.customerSafe.route.routeRevision, geometryHash: deal.customerSafe.route.geometryHash, points: deal.customerSafe.route.coordinates.length }, proposalRevisionId: deal.commercial.proposalRevisionId, proposalPdfs: pdfResults, serviceOrderPdfBytes: serviceOrderPdf.body.length, historicalDocuments: "PASS", internalCustomerParity: "PASS", customerBIsolation: "PASS", viewerReadOnly: "PASS", createsAuthority: viewer.createsAuthority }, null, 2));
