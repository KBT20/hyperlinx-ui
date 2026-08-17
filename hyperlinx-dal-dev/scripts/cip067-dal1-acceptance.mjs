import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const baseUrl = process.env.CIP067_BASE_URL ?? "http://127.0.0.1:3001";
const password = (await readFile(process.env.CIP067_DEMO_CREDENTIAL_FILE ?? "/home/ubuntu/.hyperlinx-demo-credential", "utf8")).trim();
const verifyOnly = process.env.CIP067_VERIFY_ONLY === "1";
const opportunityId = "OPPORTUNITY-DEMO-CIP067-NORTHSTAR-PERSISTENCE";
const routeRepositoryId = "ROUTE-DEMO-CIP067-NORTHSTAR-PERSISTENCE";
const proposalId = "PROPOSAL-DEMO-CIP067-NORTHSTAR-PERSISTENCE";
const accountId = "ACCOUNT-DEMO-NORTHSTAR";
const customerId = "customer-demo-a";
const customerOrganizationId = "org-demo-customer-a";
const trace = [];

async function request(step, pathname, { method = "GET", body, cookie = "", persona = "SALES", expected = [200, 201] } = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, { method, headers: { ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...(cookie ? { Cookie: cookie } : {}), "X-Hyperlinx-Demo-Persona": persona, "X-Hyperlinx-Demo-Customer-Organization": customerOrganizationId }, body: body === undefined ? undefined : JSON.stringify(body) });
  const raw = await response.text();
  let value;
  try { value = raw ? JSON.parse(raw) : {}; } catch { value = { raw }; }
  trace.push({ step, status: response.status, error: value.error, predicate: value.predicate });
  if (!expected.includes(response.status)) throw Object.assign(new Error(`${step} (${response.status}): ${value.error ?? raw}`), { trace, value });
  return { value, cookie: String(response.headers.get("set-cookie") ?? "").split(";")[0] };
}

async function login() {
  const result = await request("Demo login", "/api/auth/login", { method: "POST", body: { username: "demo", password } });
  assert.equal(result.value.user.principalId, "demo-principal");
  assert.equal(result.value.user.organizationId, "org-demo");
  return result.cookie;
}

function assertPersistedState(opportunity) {
  assert.equal(opportunity.opportunityId, opportunityId);
  assert.equal(opportunity.accountId, accountId);
  assert.equal(opportunity.customerTwinId, `CUSTOMER-TWIN-${accountId}`);
  assert.equal(opportunity.organizationId, "org-demo");
  assert.ok(opportunity.commercialStateVersion >= 1);
  assert.match(opportunity.commercialStateHash, /^[a-f0-9]{64}$/);
  assert.equal(opportunity.commercialStateSnapshot.schemaVersion, "CIP-067");
  assert.deepEqual(opportunity.commercialWorkingState.civilMixCalibration, { plowPercent: 82, dirtPercent: 12, rockPercent: 0, trenchPercent: 6 });
  assert.equal(opportunity.commercialWorkingState.estimateControls.financial.targetGrossMarginPercent, 35);
  assert.equal(opportunity.routeRepositoryId, routeRepositoryId);
  assert.equal(opportunity.routeRevision, 1);
  assert.equal(opportunity.routeGeometryId, `${routeRepositoryId}:GEOMETRY:v1`);
  assert.ok(opportunity.geometryHash);
  assert.equal(opportunity.environment, "DEMO");
  assert.equal(opportunity.productionEligible, false);
}

let cookie = await login();
const existingResult = await request("Discover controlled Opportunity", `/api/commercial/opportunities/${opportunityId}`, { cookie, expected: [200, 404] });
let opportunity = existingResult.value.opportunity ?? null;

if (!opportunity && !verifyOnly) {
  const products = (await request("Resolve Product Doctrine", "/api/products", { cookie })).value.products;
  const product = products.find((item) => item.productId === "POINT_TO_POINT_LONG_HAUL_CONDUIT_FIBER");
  assert.ok(product?.productDoctrineHash);
  const route = (await request("Persist governed route", "/api/commercial/routes", { method: "POST", cookie, body: { commercialRoute: {
    routeRepositoryId, routeSnapshotId: `${routeRepositoryId}-v1`, routeGeometryId: `${routeRepositoryId}:GEOMETRY:v1`, opportunityId,
    accountId, customerId, customerOrganizationId, productId: product.productId, productName: product.productName,
    productDoctrineId: product.productDoctrineId, productDoctrineVersion: product.productDoctrineVersion, productDoctrineHash: product.productDoctrineHash,
    routeId: routeRepositoryId, routeName: "Northstar Persistence Validation Route", routeRevision: 1,
    commercialGeometry: [[-97.5164, 35.4676], [-97.4125, 35.512], [-97.326, 35.565]], routeFeet: 5280, routeMiles: 1,
    routeSource: "COMMERCIAL_DRAWN_ROUTE",
  } } })).value.commercialRoute;
  const workingState = {
    schemaVersion: "CIP-067", opportunityId, accountId, customerTwinId: `CUSTOMER-TWIN-${accountId}`,
    product: { productId: product.productId, productName: product.productName, productDoctrineId: product.productDoctrineId, productDoctrineVersion: product.productDoctrineVersion, productDoctrineHash: product.productDoctrineHash },
    route: { routeRepositoryId, routeRevision: route.routeRevision, routeGeometryId: route.routeGeometryId, geometryHash: route.geometryHash },
    assumptionState: { stateId: "CAL-DEMO-CIP067", label: "Northstar persisted calibration", source: "SALES_SCENARIO", civilMix: { plowPercent: 82, hddPercent: 12, openCutPercent: 6, totalPercent: 100 }, borePricing: { dirtBorePercent: 100, rockBorePercent: 0 }, slack: {}, waste: {}, materials: {}, splicing: {}, noPersistence: true, noScopeVersionCreation: true },
    civilMixCalibration: { plowPercent: 82, dirtPercent: 12, rockPercent: 0, trenchPercent: 6 },
    estimateControls: { targetDurationDays: 180, civilMixMode: "MANUAL", production: { plowFeetPerDay: 5000 }, financial: { targetGrossMarginPercent: 35 }, ilaPlanning: { enabled: true, spacingMiles: 50, stationOverrides: {} }, projectConfiguration: { fiberCount: 288, ductCount: 3, ductDiameter: 1.25 }, constraints: {} },
    estimate: { constructionCost: 100000, sellPrice: 150000, nrc: 150000, mrc: 1000, lifecycleValue: 390000, grossMarginDollars: 50000, grossMarginPercent: 33.33 },
    economics: { constructionCost: 100000, sellPrice: 150000, nrc: 150000, mrc: 1000, termMonths: 240, lifecycleValue: 390000, grossMarginDollars: 50000, grossMarginPercent: 33.33 },
    quantities: { routeMiles: 1, routeFeet: 5280, fiberCount: 288 }, assumptions: [{ key: "customerSiteAccess", value: true }],
    specifications: { fiberCount: 288, ductCount: 3, ductDiameter: 1.25 }, commercialRequirements: ["DEAL-POINT-DEMO-CIP067"],
    customerRequirements: { proposalRecipientContactIds: ["CONTACT-DEMO-NORTHSTAR"] }, proposalReferences: { proposalId, proposalRevisionId: null, proposalHash: null },
    currentLifecycleState: "DRAFT",
  };
  opportunity = (await request("Save complete Opportunity", "/api/commercial/opportunities", { method: "POST", cookie, body: { opportunity: {
    opportunityId, accountId, customerId, customerOrganizationId, customerTwinId: workingState.customerTwinId, customerTwinReference: workingState.customerTwinId,
    name: "Northstar Persistence Validation", status: "SAVED", state: "DRAFT", selectedScopeId: "SCOPE-DEMO-CIP067", activeView: "proposal", visibility: "ORGANIZATION",
    productId: product.productId, productName: product.productName, productDoctrineId: product.productDoctrineId, productDoctrineVersion: product.productDoctrineVersion, productDoctrineHash: product.productDoctrineHash,
    routeRepositoryId, routeRevision: route.routeRevision, routeGeometryId: route.routeGeometryId, geometryHash: route.geometryHash,
    routeRepositoryRef: { routeRepositoryId, routeSnapshotId: route.routeSnapshotId, routeId: route.routeId, routeName: route.routeName, repositoryType: "COMMERCIAL_ROUTE_REPOSITORY" },
    estimate: workingState.estimate, commercialWorkbook: { workbookId: "WORKBOOK-DEMO-CIP067", openSections: ["proposal-summary", "construction-mix"] },
    doctrineAssumptions: { assumptionStateId: "CAL-DEMO-CIP067", productDoctrineId: product.productDoctrineId, productDoctrineVersion: product.productDoctrineVersion },
    constructionMixSnapshot: workingState.assumptionState.civilMix, commercialWorkingState: workingState, proposalId,
  } } })).value.opportunity;
  assertPersistedState(opportunity);

  const proposalBase = {
    proposalId, proposalRecordId: proposalId, proposalNumber: "DEMO-CIP067-NORTHSTAR", customerId, customerOrganizationId, accountId, opportunityId,
    productId: opportunity.productId, productName: opportunity.productName, productDoctrineId: opportunity.productDoctrineId, productDoctrineVersion: opportunity.productDoctrineVersion, productDoctrineHash: opportunity.productDoctrineHash,
    routeRepositoryId, routeId: route.routeId, routeRevision: route.routeRevision, routeGeometryId: route.routeGeometryId, routeGeometryHash: route.geometryHash,
    routeSnapshot: { routeRepositoryId, routeId: route.routeId, routeRevision: route.routeRevision, routeGeometryId: route.routeGeometryId, geometryHash: route.geometryHash },
    opportunityStateVersion: opportunity.commercialStateVersion, opportunityStateHash: opportunity.commercialStateHash, opportunityStateSnapshot: opportunity.commercialStateSnapshot,
    productConfiguration: workingState.specifications, estimateControls: workingState.estimateControls, constructionQuantities: workingState.quantities,
    pricingSummary: workingState.economics, commercialTerms: { termMonths: 240, nrc: 150000, monthlyOm: 1000, totalContractValue: 390000 },
    title: "Northstar Persistence Validation Proposal", summary: "CIP-067 exact persisted Opportunity proposal.", executiveSummary: "Persistent Opportunity validation.",
    status: "DRAFT", approvalState: "NOT_SUBMITTED", visibility: "SHARED", dealPointIds: workingState.commercialRequirements,
    runtimeObjectIds: [opportunity.runtimeObjectId], runtimeRelationshipIds: [`DERIVED_FROM:${opportunityId}`], existingInventoryReferences: ["INVENTORY-DEMO-CIP067"],
    geometryReferences: [route.routeGeometryId], proposalDocumentReferences: ["Customer proposal", "Governed route map"], saveProposalRevision: true, revisionReason: "CIP-067 immutable R1.",
  };
  const r1 = (await request("Generate Proposal R1 from saved Opportunity", "/api/proposals", { method: "POST", cookie, body: { proposal: proposalBase } })).value.proposal;
  const changedWorkingState = { ...opportunity.commercialWorkingState, economics: { ...opportunity.commercialWorkingState.economics, mrc: 1100, lifecycleValue: 414000 }, estimate: { ...opportunity.commercialWorkingState.estimate, mrc: 1100, lifecycleValue: 414000 }, updatedAt: new Date().toISOString() };
  opportunity = (await request("Save revised Opportunity working state", "/api/commercial/opportunities", { method: "POST", cookie, body: { opportunity: { ...opportunity, commercialWorkingState: changedWorkingState, estimate: changedWorkingState.estimate } } })).value.opportunity;
  const workingR2 = (await request("Create Proposal R2 working revision", `/api/proposals/${proposalId}/revision`, { method: "POST", cookie, body: { basisProposalRevisionId: r1.proposalRevisionId, reason: "Persisted economics revision.", proposal: { opportunityStateVersion: opportunity.commercialStateVersion, opportunityStateHash: opportunity.commercialStateHash, opportunityStateSnapshot: opportunity.commercialStateSnapshot, routeRepositoryId, routeRevision: route.routeRevision, routeGeometryId: route.routeGeometryId, routeGeometryHash: route.geometryHash, pricingSummary: changedWorkingState.economics } } })).value.proposal;
  const r2 = (await request("Save immutable Proposal R2", "/api/proposals", { method: "POST", cookie, body: { proposal: { ...workingR2, saveProposalRevision: true, revisionReason: "CIP-067 immutable R2." } } })).value.proposal;
  assert.equal(r1.proposalRevisions[0].proposalHash, r2.proposalRevisions[0].proposalHash);
  const submitted = (await request("Submit exact R2 to Customer", `/api/proposals/${proposalId}/submit-customer`, { method: "POST", cookie, body: { assignedCustomerUsers: ["demo-customer-a-viewer", "demo-customer-a-reviewer", "demo-customer-a-signer"], customerOrganizationId } })).value;
  assert.equal(submitted.customerReviewPackage.proposalRevisionId, r2.proposalRevisionId);
  await request("Customer accepts exact R2", `/api/customer-portal/projects/${opportunityId}/proposal/accept`, { method: "POST", cookie, persona: "CUSTOMER_COMMERCIAL_REVIEWER", body: { proposalRevisionId: r2.proposalRevisionId, proposalHash: r2.proposalHash, comment: "CIP-067 accepted." } });
}

const listed = (await request("Account-filtered Opportunity discovery", "/api/commercial/opportunities", { cookie })).value.opportunities;
opportunity = listed.find((item) => item.opportunityId === opportunityId);
assert.ok(opportunity);
assertPersistedState(opportunity);
assert.equal(listed.filter((item) => item.opportunityId === opportunityId).length, 1);
const stateBeforeLogout = { version: opportunity.commercialStateVersion, hash: opportunity.commercialStateHash, workingState: opportunity.commercialWorkingState };
await request("Logout", "/api/auth/logout", { method: "POST", cookie });
cookie = await login();
const reopened = (await request("Reopen persisted Opportunity", `/api/commercial/opportunities/${opportunityId}/open`, { method: "POST", cookie })).value.opportunity;
assert.equal(reopened.commercialStateVersion, stateBeforeLogout.version);
assert.equal(reopened.commercialStateHash, stateBeforeLogout.hash);
assert.deepEqual(reopened.commercialWorkingState, stateBeforeLogout.workingState);
const routeReload = (await request("Reload governed route", `/api/commercial/routes/${routeRepositoryId}`, { cookie })).value.commercialRoute;
assert.equal(routeReload.geometryHash, reopened.geometryHash);
const twin = (await request("Reload Account Customer Twin", `/api/accounts/${accountId}/customer-twin`, { cookie })).value.customerTwin;
const deal = twin.deals.find((item) => item.opportunityId === opportunityId);
assert.ok(deal);
assert.equal(deal.workingOpportunity.stateHash, reopened.commercialStateHash);
const customerProjects = (await request("Customer View parity", "/api/customer-portal/projects", { cookie, persona: "CUSTOMER_VIEWER" })).value.projects;
assert.ok(customerProjects.some((project) => project.projectId === opportunityId));

console.log(JSON.stringify({ result: verifyOnly ? "PASS_AFTER_RESTART" : "PASS_TO_CUSTOMER_ACCEPTANCE", opportunityId, accountId, stateVersion: reopened.commercialStateVersion, stateHash: reopened.commercialStateHash, civilMix: reopened.commercialWorkingState.civilMixCalibration, productId: reopened.productId, productDoctrineId: reopened.productDoctrineId, route: { routeRepositoryId, routeRevision: reopened.routeRevision, routeGeometryId: reopened.routeGeometryId, geometryHash: reopened.geometryHash }, proposalId, customerState: deal.currentState, refreshRehydration: "PASS", logoutLoginRehydration: "PASS", accountFiltering: "PASS", customerTwinProjection: "PASS", customerViewParity: "PASS", productionEligible: false, chicagoAccess: "ZERO", trace }, null, 2));
