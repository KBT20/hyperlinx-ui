import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const baseUrl = process.env.CIP071A_BASE_URL ?? "http://127.0.0.1:3001";
const password = (await readFile(process.env.CIP071A_DEMO_CREDENTIAL_FILE ?? "/home/ubuntu/.hyperlinx-demo-credential", "utf8")).trim();
const suffix = String(process.env.CIP071A_SUFFIX ?? Date.now());
const accountId = "ACCOUNT-DEMO-BLUE-MESA";
const customerId = "customer-demo-b";
const customerOrganizationId = "org-demo-customer-b";
const opportunityId = `OPPORTUNITY-DEMO-CIP071A-${suffix}`;
const routeRepositoryId = `ROUTE-DEMO-CIP071A-${suffix}`;
const importId = `CUSTOMER-DESIGN-IMPORT-DEMO-CIP071A-${suffix}`;
const proposalId = `PROPOSAL-DEMO-CIP071A-${suffix}`;
const geometry = [[-104.9903, 39.7392], [-104.9702, 39.7508], [-104.9501, 39.7614]];

async function call(label, pathname, { method = "GET", body, cookie = "", expected = [200] } = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(cookie ? { Cookie: cookie } : {}),
      "X-Hyperlinx-Demo-Persona": "SALES",
      "X-Hyperlinx-Demo-Customer-Organization": customerOrganizationId,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const raw = await response.text();
  let value = {};
  try { value = raw ? JSON.parse(raw) : {}; } catch { value = { raw: raw.slice(0, 300) }; }
  assert.ok(expected.includes(response.status), `${label} returned ${response.status}: ${raw.slice(0, 500)}`);
  assert.notEqual(response.status, 409, `${label} must not produce a namespace 409.`);
  return { value, status: response.status, cookie: String(response.headers.get("set-cookie") ?? "").split(";")[0] };
}

const login = await call("Demo login", "/api/auth/login", { method: "POST", body: { username: "demo", password } });
const cookie = login.cookie;
assert.equal(login.value.user.principalId, "demo-principal");
assert.equal(login.value.user.organizationId, "org-demo");
if (process.env.CIP071A_READ_ONLY === "1") {
  const [savedImport, savedRoute, savedOpportunity, savedProposal] = await Promise.all([
    call("Reload Customer Design Import", `/api/customer-design-imports/${encodeURIComponent(importId)}`, { cookie }),
    call("Reload Commercial Route", `/api/commercial/routes/${encodeURIComponent(routeRepositoryId)}`, { cookie }),
    call("Reload Commercial Opportunity", `/api/commercial/opportunities/${encodeURIComponent(opportunityId)}`, { cookie }),
    call("Reload Proposal", `/api/proposals/${encodeURIComponent(proposalId)}`, { cookie }),
  ]);
  assert.equal(savedImport.value.customerDesignImport.importId, importId);
  assert.equal(savedRoute.value.commercialRoute.routeRepositoryId, routeRepositoryId);
  assert.equal(savedOpportunity.value.opportunity.opportunityId, opportunityId);
  assert.equal(savedProposal.value.proposal.proposalId, proposalId);
  assert.equal(savedProposal.value.proposal.status, "WAITING_CUSTOMER_REVIEW");
  console.log(JSON.stringify({ result: "PASS", readOnly: true, restartPersistence: true, records: { importId, routeRepositoryId, opportunityId, proposalId, proposalRevisionId: savedProposal.value.proposal.proposalRevisionId, proposalHash: savedProposal.value.proposal.proposalHash } }, null, 2));
  process.exit(0);
}
const northstarBefore = (await call("Northstar before", "/api/accounts/ACCOUNT-DEMO-NORTHSTAR/customer-twin", { cookie })).value.customerTwin.deals.find((item) => item.opportunityId === "OPPORTUNITY-DEMO-CIP067-NORTHSTAR-PERSISTENCE");

const imported = (await call("Customer Design Import", "/api/customer-design-imports", { method: "POST", cookie, expected: [201], body: { customerDesignImport: {
  importId, designId: `DESIGN-DEMO-CIP071A-${suffix}`, accountId, customerId, sourceFileName: "cip071a-demo-route.kml", sourceType: "KML", status: "IMPORTED",
  routes: [{ routeId: `IMPORTED-ROUTE-DEMO-CIP071A-${suffix}`, name: "CIP-071A Demo route", dalGeometry: geometry }],
  activeRouteId: `IMPORTED-ROUTE-DEMO-CIP071A-${suffix}`, lineage: [{ stage: "IMPORTED", timestamp: new Date().toISOString() }],
} } })).value.customerDesignImport;
assert.equal(imported.importId, importId);

const route = (await call("Commercial Route", "/api/commercial/routes", { method: "POST", cookie, expected: [201], body: { commercialRoute: {
  routeRepositoryId, transactionId: `ROUTE-SAVE-DEMO-CIP071A-${suffix}`, routeSnapshotId: `${routeRepositoryId}-v1`, routeId: routeRepositoryId,
  opportunityId, accountId, customerId, routeName: "CIP-071A Demo namespace route", routeRevision: 1, commercialGeometry: geometry,
  routeFeet: 10450, routeMiles: 10450 / 5280, routeSource: "IMPORTED_EVIDENCE", sourceImportId: importId,
} } })).value.commercialRoute;
assert.equal(route.routeRepositoryId, routeRepositoryId);

const workingState = {
  schemaVersion: "CIP-067", currentLifecycleState: "DRAFT",
  product: { productId: "L1_POINT_TO_POINT_LONG_HAUL_CONDUIT_FIBER", productName: "Point-to-Point Long-Haul Conduit + Fiber" },
  routeAuthority: { routeRepositoryId, routeRevision: route.routeRevision, routeGeometryId: route.routeGeometryId, geometryHash: route.geometryHash },
  civilMixCalibration: { plowPercent: 82, dirtPercent: 12, rockPercent: 0, trenchPercent: 6 },
  quantities: { routeFeet: route.routeFeet, routeMiles: route.routeMiles }, economics: { nrc: 125000, mrc: 3500, termMonths: 60 }, assumptions: [],
};
const opportunity = (await call("Commercial Opportunity", "/api/commercial/opportunities", { method: "POST", cookie, expected: [201], body: { opportunity: {
  opportunityId, transactionId: `OPPORTUNITY-SAVE-DEMO-CIP071A-${suffix}`, accountId, customerId, customerOrganizationId,
  name: "CIP-071A Demo namespace acceptance", status: "SAVED", state: "DRAFT", visibility: "ORGANIZATION",
  productId: workingState.product.productId, productName: workingState.product.productName,
  routeRepositoryId, routeRevision: route.routeRevision, routeGeometryId: route.routeGeometryId, geometryHash: route.geometryHash,
  commercialWorkingState: workingState, customerTwinId: `CUSTOMER-TWIN-${accountId}`,
} } })).value.opportunity;
assert.equal(opportunity.opportunityId, opportunityId);
assert.ok(opportunity.commercialStateHash);

const proposal = (await call("Proposal save", "/api/proposals", { method: "POST", cookie, expected: [201], body: { proposal: {
  proposalId, proposalRecordId: proposalId, proposalNumber: proposalId, saveProposalRevision: true, revisionReason: "CIP-071A Demo namespace acceptance.",
  accountId, customerId, customerOrganizationId, opportunityId, organizationId: "org-demo", visibility: "ORGANIZATION",
  title: "CIP-071A Demo Namespace Proposal", summary: "Disposable Demo-only namespace acceptance fixture.", status: "DRAFT", approvalState: "NOT_SUBMITTED",
  productId: workingState.product.productId, productName: workingState.product.productName,
  routeRepositoryId, routeRevision: route.routeRevision, routeGeometryId: route.routeGeometryId, routeGeometryHash: route.geometryHash,
  opportunityStateVersion: opportunity.commercialStateVersion, opportunityStateHash: opportunity.commercialStateHash, opportunityStateSnapshot: opportunity.commercialStateSnapshot,
  assignedCustomerUsers: ["demo-customer-b-viewer", "demo-customer-b-reviewer", "demo-customer-b-signer"],
} } })).value.proposal;
assert.equal(proposal.proposalId, proposalId);
assert.ok(proposal.proposalRevisionId && proposal.proposalHash);

const submitted = (await call("Proposal submit-customer", `/api/proposals/${encodeURIComponent(proposalId)}/submit-customer`, { method: "POST", cookie, body: {
  assignedCustomerUsers: ["demo-customer-b-viewer", "demo-customer-b-reviewer", "demo-customer-b-signer"], customerOrganizationId,
} })).value;
assert.equal(submitted.proposal.status, "WAITING_CUSTOMER_REVIEW");
assert.equal(submitted.customerReviewPackage.proposalRevisionId, proposal.proposalRevisionId);
assert.equal(submitted.customerReviewPackage.proposalHash, proposal.proposalHash);

const [reloadedImport, reloadedRoute, reloadedOpportunity, reloadedProposal] = await Promise.all([
  call("Reload Customer Design Import", `/api/customer-design-imports/${encodeURIComponent(importId)}`, { cookie }),
  call("Reload Commercial Route", `/api/commercial/routes/${encodeURIComponent(routeRepositoryId)}`, { cookie }),
  call("Reload Commercial Opportunity", `/api/commercial/opportunities/${encodeURIComponent(opportunityId)}`, { cookie }),
  call("Reload Proposal", `/api/proposals/${encodeURIComponent(proposalId)}`, { cookie }),
]);
assert.equal(reloadedImport.value.customerDesignImport.importId, importId);
assert.equal(reloadedRoute.value.commercialRoute.routeRepositoryId, routeRepositoryId);
assert.equal(reloadedOpportunity.value.opportunity.opportunityId, opportunityId);
assert.equal(reloadedProposal.value.proposal.proposalRevisionId, proposal.proposalRevisionId);
assert.equal(reloadedProposal.value.proposal.proposalHash, proposal.proposalHash);
const northstarAfter = (await call("Northstar after", "/api/accounts/ACCOUNT-DEMO-NORTHSTAR/customer-twin", { cookie })).value.customerTwin.deals.find((item) => item.opportunityId === "OPPORTUNITY-DEMO-CIP067-NORTHSTAR-PERSISTENCE");
assert.deepEqual(northstarAfter, northstarBefore);

console.log(JSON.stringify({ result: "PASS", authorityClass: "DEMO", accountId, customerOrganizationId, records: { importId, routeRepositoryId, opportunityId, proposalId, proposalRevisionId: proposal.proposalRevisionId, proposalHash: proposal.proposalHash, customerReviewPackageId: submitted.customerReviewPackage.customerReviewPackageId }, namespace409s: 0, persistenceReload: "PASS", northstarUnchanged: true, productionEligible: false }, null, 2));
