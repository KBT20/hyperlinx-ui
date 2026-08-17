import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const root = await mkdtemp(path.join(tmpdir(), "cip067-opportunity-"));
process.env.DAL_DATA_ROOT = path.join(root, "production");
process.env.DAL_DEMO_DATA_ROOT = path.join(root, "demo");

const { DIRS, loadRecord, persistRecord, withRepositoryAuthority } = await import("../server/routes/_shared.js");
const {
  commercialOpportunityStateHash,
  normalizeCommercialOpportunity,
  saveOpportunity,
} = await import("../server/routes/commercial-opportunities.js");
const {
  saveImmutableProposalRevision,
  validateOpportunityStateBinding,
} = await import("../server/routes/proposal-drafts.js");
const { buildAccountCustomerTwin } = await import("../server/routes/customer-account-twin.js");

const user = { userId: "demo-principal", principalId: "demo-principal", membershipId: "membership-demo", name: "Demo User", displayName: "Demo User", organizationId: "org-demo", workspaceId: "workspace-demo", sessionId: "session-demo", authorityClass: "DEMO", permissions: ["opportunity.manage", "proposal.manage", "demo.tenant"] };
await withRepositoryAuthority(user, async () => {
const account = { accountId: "ACCOUNT-DEMO-CIP067", customerId: "CUSTOMER-DEMO-CIP067", customerOrganizationId: "org-demo-customer-a", name: "Northstar Cloud Infrastructure", status: "ACTIVE", organizationId: "org-demo" };
const opportunityId = "OPPORTUNITY-DEMO-CIP067-PERSISTENCE";
const routeRepositoryId = "ROUTE-DEMO-CIP067-PERSISTENCE";
const routeGeometryId = `${routeRepositoryId}:GEOMETRY:v1`;
const geometryHash = "geometry-cip067-v1";
await persistRecord(DIRS.commercialRoutes, routeRepositoryId, { routeRepositoryId, opportunityId, accountId: account.accountId, customerId: account.customerId, organizationId: "org-demo", routeRevision: 1, routeGeometryId, geometryHash, commercialGeometry: [[-97.04, 36.17], [-97.01, 36.19], [-96.92, 36.21]], routeFeet: 70858, routeMiles: 13.42 });

const workingState = {
  schemaVersion: "CIP-067",
  opportunityId,
  accountId: account.accountId,
  customerTwinId: `CUSTOMER-TWIN-${account.accountId}`,
  product: { productId: "POINT-TO-POINT-DARK-FIBER", productName: "Point-to-Point Dark Fiber", productDoctrineId: "DOCTRINE-L1", productDoctrineVersion: "1", productDoctrineHash: "doctrine-hash" },
  route: { routeRepositoryId, routeRevision: 1, routeGeometryId, geometryHash },
  assumptionState: { stateId: "CAL-CIP067", civilMix: { plowPercent: 82, hddPercent: 12, openCutPercent: 6, totalPercent: 100 }, borePricing: { dirtBorePercent: 100, rockBorePercent: 0 } },
  civilMixCalibration: { plowPercent: 82, dirtPercent: 12, rockPercent: 0, trenchPercent: 6 },
  estimateControls: { targetDurationDays: 180, civilMixMode: "MANUAL", production: { plowFeetPerDay: 5000 }, financial: { targetGrossMarginPercent: 35 }, ilaPlanning: {}, projectConfiguration: { fiberCount: 288 }, constraints: {} },
  estimate: { constructionCost: 2100000, sellPrice: 3250000, mrc: 15000, grossMarginPercent: 35.3846 },
  economics: { constructionCost: 2100000, sellPrice: 3250000, nrc: 3250000, mrc: 15000, termMonths: 240, grossMarginPercent: 35.3846 },
  assumptions: [{ key: "customerSiteAccess", value: true }],
  specifications: { fiberCount: 288 },
  commercialRequirements: ["REQ-A", "REQ-Z"],
  customerRequirements: { proposalRecipientContactIds: ["CONTACT-CIP067"] },
  proposalReferences: { proposalId: "PROPOSAL-DEMO-CIP067", proposalRevisionId: null, proposalHash: null },
  currentLifecycleState: "DRAFT",
};
const input = {
  opportunityId, accountId: account.accountId, customerId: account.customerId, customerTwinId: workingState.customerTwinId,
  name: "Northstar Persistence Validation", status: "SAVED", state: "DRAFT", productId: workingState.product.productId,
  productName: workingState.product.productName, productDoctrineId: workingState.product.productDoctrineId,
  productDoctrineVersion: workingState.product.productDoctrineVersion, productDoctrineHash: workingState.product.productDoctrineHash,
  routeRepositoryId, routeRevision: 1, routeGeometryId, geometryHash,
  estimate: workingState.estimate, commercialWorkbook: { workbookId: "WORKBOOK-CIP067", openSections: ["construction-mix", "proposal-summary"] },
  doctrineAssumptions: { assumptionStateId: "CAL-CIP067" }, constructionMixSnapshot: workingState.assumptionState.civilMix,
  commercialWorkingState: workingState, proposalId: "PROPOSAL-DEMO-CIP067", ownerId: user.userId,
  visibility: "ORGANIZATION", organizationId: "org-demo", workspaceId: "workspace-demo",
};
const v1 = await saveOpportunity(normalizeCommercialOpportunity(input, user), user, "cip067.created");
const reloaded = await loadRecord(DIRS.commercialOpportunities, opportunityId);
assert.equal(reloaded.commercialStateVersion, 1);
assert.equal(reloaded.commercialStateHash, commercialOpportunityStateHash(reloaded.commercialStateSnapshot));
assert.deepEqual(reloaded.commercialWorkingState.civilMixCalibration, { plowPercent: 82, dirtPercent: 12, rockPercent: 0, trenchPercent: 6 });
assert.deepEqual(reloaded.commercialWorkingState.estimateControls, workingState.estimateControls);
assert.equal(reloaded.routeRepositoryId, routeRepositoryId);
assert.equal(reloaded.geometryHash, geometryHash);

const proposalInput = {
  proposalId: "PROPOSAL-DEMO-CIP067", proposalNumber: "PROPOSAL-DEMO-CIP067", accountId: account.accountId, customerId: account.customerId,
  opportunityId, organizationId: "org-demo", productId: reloaded.productId, productName: reloaded.productName,
  routeRepositoryId, routeRevision: 1, routeGeometryId, routeGeometryHash: geometryHash,
  opportunityStateVersion: reloaded.commercialStateVersion, opportunityStateHash: reloaded.commercialStateHash,
  opportunityStateSnapshot: reloaded.commercialStateSnapshot, title: "Northstar Persistence Validation Proposal",
  summary: "Exact persisted Opportunity projection.", pricingSummary: workingState.economics, dealPointIds: ["REQ-A"],
  runtimeObjectIds: [reloaded.runtimeObjectId], customerTwinReference: workingState.customerTwinId,
};
assert.deepEqual(await validateOpportunityStateBinding(proposalInput), []);
assert.ok((await validateOpportunityStateBinding({ ...proposalInput, opportunityStateHash: "wrong" })).length > 0);
assert.ok((await validateOpportunityStateBinding({ ...proposalInput, routeGeometryHash: "wrong" })).length > 0);
const proposalR1 = saveImmutableProposalRevision(proposalInput, user, "CIP-067 immutable R1");
const r1Snapshot = structuredClone(proposalR1.proposalRevisions[0].snapshot);

const v2 = await saveOpportunity(normalizeCommercialOpportunity({ ...v1, commercialWorkingState: { ...workingState, economics: { ...workingState.economics, mrc: 16000 } } }, user, v1), user, "cip067.updated");
assert.equal(v2.commercialStateVersion, 2);
assert.notEqual(v2.commercialStateHash, v1.commercialStateHash);
assert.deepEqual(proposalR1.proposalRevisions[0].snapshot, r1Snapshot);
assert.ok((await validateOpportunityStateBinding(proposalInput)).some((failure) => failure.includes("not current")));
assert.deepEqual(await validateOpportunityStateBinding(proposalInput, { requireCurrent: false }), []);

await persistRecord(DIRS.proposalDrafts, proposalR1.proposalId, { ...proposalR1, accountId: account.accountId, customerId: account.customerId, opportunityId });
await persistRecord(DIRS.serviceOrders, "SO-DEMO-CIP067", { serviceOrderId: "SO-DEMO-CIP067", accountId: account.accountId, customerId: account.customerId, opportunityId, proposalId: proposalR1.proposalId, scopeVersionId: "SV-DEMO-CIP067", status: "COUNTERSIGNED" });
await persistRecord(DIRS.scopeVersions, "SV-DEMO-CIP067", { scopeVersionId: "SV-DEMO-CIP067", accountId: account.accountId, customerId: account.customerId, opportunityId, proposalId: proposalR1.proposalId });
const twin = await buildAccountCustomerTwin({ account, user, lens: "INTERNAL" });
const deal = twin.deals.find((item) => item.opportunityId === opportunityId);
assert.equal(deal.currentState, "AUTHORIZED");
assert.equal(deal.workingOpportunity.stateVersion, 2);
assert.equal(deal.workingOpportunity.civilMixCalibration.plowPercent, 82);
assert.equal(twin.createsAuthority, false);

const legacy = normalizeCommercialOpportunity({ opportunityId: "LEGACY", accountId: account.accountId, name: "Historical", status: "SAVED" }, user, null, { bumpVersion: false });
assert.equal(legacy.commercialStateSnapshot, undefined);
assert.equal(legacy.commercialStateHash, undefined);

console.log(JSON.stringify({ result: "PASS", opportunityId, opportunityStateVersions: [v1.commercialStateVersion, v2.commercialStateVersion], civilMix: reloaded.commercialWorkingState.civilMixCalibration, route: { routeRepositoryId, routeRevision: 1, routeGeometryId, geometryHash }, proposalRevisionId: proposalR1.proposalRevisionId, proposalImmutableAfterOpportunitySave: true, staleProposalCurrentSaveRejected: true, historicalSubmissionBindingRetained: true, customerTwinState: deal.currentState, createsAuthority: twin.createsAuthority, legacyRecordsReinterpreted: false }, null, 2));
});
await rm(root, { recursive: true, force: true });
