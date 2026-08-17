import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const root = await mkdtemp(path.join(tmpdir(), "cip070-customer-workspace-"));
process.env.DAL_DATA_ROOT = path.join(root, "production");
process.env.DAL_DEMO_DATA_ROOT = path.join(root, "demo");

const { DIRS, persistRecord, withRepositoryAuthority } = await import("../server/routes/_shared.js");
const { buildAccountCustomerTwin } = await import("../server/routes/customer-account-twin.js");
const sourceRoot = path.resolve(import.meta.dirname, "..");
const sources = Object.fromEntries(await Promise.all([
  "src/workspaces/CustomerWorkspace.tsx", "src/workspaces/CustomerPortalWorkspace.tsx", "src/dal/DALNavigation.tsx",
  "src/dal/DALState.tsx", "src/identity/teralinxIdentity.ts", "src/identity/TeralinxAuth.tsx",
  "src/components/workspaces/GoogleRfpWorkspace.tsx", "server/routes/customer-portal-authority.js",
].map(async (name) => [name, await readFile(path.join(sourceRoot, name), "utf8")])));

assert.match(sources["src/dal/DALNavigation.tsx"], /customerView.*Customer View/);
assert.match(sources["src/workspaces/CustomerWorkspace.tsx"], /Select Account/);
assert.match(sources["src/workspaces/CustomerWorkspace.tsx"], /INTERNAL CUSTOMER VIEW.*NO CUSTOMER AUTHORITY/);
assert.match(sources["src/workspaces/CustomerWorkspace.tsx"], /MAP BLOCKED.*LINEAGE MISMATCH/);
assert.match(sources["src/workspaces/CustomerWorkspace.tsx"], /\+ New Opportunity/);
assert.match(sources["src/workspaces/CustomerWorkspace.tsx"], /Proposal Revision ID/);
assert.match(sources["src/workspaces/CustomerWorkspace.tsx"], /Download Proposal PDF/);
assert.match(sources["src/workspaces/CustomerWorkspace.tsx"], /Download Service Order PDF/);
assert.doesNotMatch(sources["src/workspaces/CustomerWorkspace.tsx"], /customerPortalProjectAction/);
assert.match(sources["src/components/workspaces/GoogleRfpWorkspace.tsx"], /setWorkspace\("customerView"\)/);
assert.match(sources["src/components/workspaces/GoogleRfpWorkspace.tsx"], /searchParams\.set\("opportunityId", saved\.opportunityId\)/);
assert.match(sources["server/routes/customer-portal-authority.js"], /enrollmentPath:.*opportunityId/);
assert.match(sources["src/workspaces/CustomerPortalWorkspace.tsx"], /URLSearchParams\(window\.location\.search\)\.get\("opportunityId"\)/);
assert.match(sources["src/dal/DALState.tsx"], /URLSearchParams\(window\.location\.search\)\.get\("workspace"\)/);

const user = { principalId: "demo-principal", organizationId: "org-demo", authorityClass: "DEMO", permissions: ["opportunity.read", "proposal.read", "demo.tenant"] };
await withRepositoryAuthority(user, async () => {
const accountA = { accountId: "ACCOUNT-A", customerId: "CUSTOMER-A", name: "Northstar", status: "ACTIVE", organizationId: "org-demo" };
const accountB = { accountId: "ACCOUNT-B", customerId: "CUSTOMER-B", name: "Blue Mesa", status: "ACTIVE", organizationId: "org-demo" };
async function persistDeal({ account, opportunityId, authorized = false }) {
  const routeRepositoryId = `ROUTE-${opportunityId}`;
  const routeGeometryId = `${routeRepositoryId}:GEOMETRY:1`;
  const geometryHash = `HASH-${routeRepositoryId}`;
  const proposalId = `PROPOSAL-${opportunityId}`;
  const proposalRevisionId = `${proposalId}-revision-2`;
  const common = { accountId: account.accountId, customerId: account.customerId, opportunityId, organizationId: "org-demo", environment: "DEMO", productionEligible: false };
  await persistRecord(DIRS.commercialOpportunities, opportunityId, { ...common, opportunityId, name: opportunityId, productId: "DARK-FIBER", productName: "Dark Fiber", productDoctrineId: "DOCTRINE-L1", routeRepositoryId, routeRevision: 1, routeGeometryId, geometryHash, commercialStateVersion: 2, commercialStateHash: `STATE-${opportunityId}` });
  await persistRecord(DIRS.commercialRoutes, routeRepositoryId, { ...common, routeRepositoryId, routeRevision: 1, routeGeometryId, geometryHash, routeMiles: 8, routeFeet: 42240, commercialGeometry: [[-97, 36], [-96.9, 36.1]] });
  await persistRecord(DIRS.proposalDrafts, proposalId, { ...common, proposalId, proposalRevisionId, proposalRevisionNumber: 2, proposalHash: `PROPOSAL-HASH-${opportunityId}`, status: authorized ? "APPROVED" : "SUBMITTED", approvalState: authorized ? "APPROVED" : "PENDING", productId: "DARK-FIBER", productName: "Dark Fiber", productDoctrineId: "DOCTRINE-L1", productDoctrineVersion: "20C.1.0", productDoctrineHash: "DOCTRINE-HASH", routeRepositoryId, routeRevision: 1, routeGeometryId, routeGeometryHash: geometryHash, proposalRevisions: [{ proposalRevisionId, revisionNumber: 2, proposalHash: `PROPOSAL-HASH-${opportunityId}`, createdAt: "2026-08-17T00:00:00Z" }] });
  await persistRecord(DIRS.customerReviewPackages, `REVIEW-${opportunityId}`, { ...common, customerReviewPackageId: `REVIEW-${opportunityId}`, customerOrganizationId: account.accountId === "ACCOUNT-A" ? "org-demo-customer-a" : "org-demo-customer-b", proposalId, proposalRevisionId, proposalRevisionNumber: 2, proposalHash: `PROPOSAL-HASH-${opportunityId}`, status: "ACTIVE", route: { routeRepositoryId, routeRevision: 1, routeGeometryId, geometryHash } });
  if (authorized) {
    await persistRecord(DIRS.certifiedIofPackages, `CERT-${opportunityId}`, { ...common, certifiedPackageId: `CERT-${opportunityId}`, proposalId });
    await persistRecord(DIRS.serviceOrders, `SO-${opportunityId}`, { ...common, serviceOrderId: `SO-${opportunityId}`, proposalId, status: "COUNTERSIGNED", documentHash: `SO-HASH-${opportunityId}`, scopeVersionId: `SV-${opportunityId}` });
    await persistRecord(DIRS.scopeVersions, `SV-${opportunityId}`, { ...common, scopeVersionId: `SV-${opportunityId}`, proposalId });
  }
  return { opportunityId, routeRepositoryId, routeGeometryId, geometryHash, proposalRevisionId };
}

const authorized = await persistDeal({ account: accountA, opportunityId: "OPPORTUNITY-DEMO-AUTHORIZED", authorized: true });
await persistDeal({ account: accountA, opportunityId: "OPPORTUNITY-DEMO-CUSTOMER-REVIEW" });
await persistDeal({ account: accountB, opportunityId: "OPPORTUNITY-DEMO-OTHER-CUSTOMER" });
const internal = await buildAccountCustomerTwin({ account: accountA, user, lens: "INTERNAL" });
const external = await buildAccountCustomerTwin({ account: accountA, user, lens: "CUSTOMER", persona: "CUSTOMER_VIEWER", allowedOpportunityIds: [authorized.opportunityId] });
const internalDeal = internal.deals.find((deal) => deal.opportunityId === authorized.opportunityId);
const externalDeal = external.deals[0];
assert.equal(internal.dealCount, 2);
assert.equal(internal.deals.some((deal) => deal.opportunityId === "OPPORTUNITY-DEMO-OTHER-CUSTOMER"), false);
assert.equal(internalDeal.currentState, "AUTHORIZED");
assert.equal(internal.deals.find((deal) => deal.opportunityId === "OPPORTUNITY-DEMO-CUSTOMER-REVIEW")?.currentState, "CUSTOMER_REVIEW");
assert.equal(internalDeal.customerSafe.lineage.status, "PASS");
assert.ok(internalDeal.customerSafe.route.routeMiles > 0);
for (const field of ["opportunityId", "currentState"]) assert.equal(internalDeal[field], externalDeal[field]);
assert.deepEqual(internalDeal.commercial, externalDeal.commercial);
assert.deepEqual(internalDeal.spatial, externalDeal.spatial);
assert.deepEqual(internalDeal.engineering, externalDeal.engineering);
assert.deepEqual(internalDeal.contractual, externalDeal.contractual);
assert.deepEqual(internalDeal.customerSafe.route, externalDeal.customerSafe.route);
assert.equal(externalDeal.permittedActions.some((action) => action.mutation), false);
assert.equal(internal.createsAuthority, false);
assert.equal(external.createsAuthority, false);

console.log(JSON.stringify({ result: "PASS", firstClassWorkspace: true, accountSelection: true, accountFiltering: true, dealStates: internal.stateCounts, exactRoute: { routeRepositoryId: authorized.routeRepositoryId, routeGeometryId: authorized.routeGeometryId, geometryHash: authorized.geometryHash }, proposalRevisionId: authorized.proposalRevisionId, internalExternalProjectionParity: true, viewerReadOnly: true, deepLink: true, createsAuthority: false }, null, 2));
});
await rm(root, { recursive: true, force: true });
