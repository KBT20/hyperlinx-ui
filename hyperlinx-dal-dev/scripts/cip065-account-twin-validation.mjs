import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const root = await mkdtemp(path.join(tmpdir(), "cip065-account-twin-"));
process.env.DAL_DATA_ROOT = path.join(root, "production");
process.env.DAL_DEMO_DATA_ROOT = path.join(root, "demo");

const { DIRS, persistRecord } = await import("../server/routes/_shared.js");
const { buildAccountCustomerTwin, CUSTOMER_DEAL_STATES } = await import("../server/routes/customer-account-twin.js");
const account = { accountId: "ACCOUNT-A", accountNumber: 1, customerId: "CUSTOMER-A", customerOrganizationId: "ORG-CUSTOMER-A", name: "Account A", status: "ACTIVE", organizationId: "ORG-TEST" };
const user = { organizationId: "ORG-TEST", permissions: ["opportunity.manage", "proposal.manage", "engineering.lifecycle.manage", "service_order.countersign"] };

async function save(dir, id, value) { await persistRecord(dir, id, { accountId: account.accountId, customerId: account.customerId, ...value, createdAt: `2026-01-01T00:00:${String(value.order ?? 0).padStart(2, "0")}Z` }); }
for (let index = 0; index < CUSTOMER_DEAL_STATES.length; index += 1) {
  const state = CUSTOMER_DEAL_STATES[index];
  const opportunityId = `OPP-${state}`;
  await save(DIRS.commercialOpportunities, opportunityId, { opportunityId, name: `${state} Deal`, order: index });
  if (index >= 1) await save(DIRS.proposalDrafts, `PROP-${state}`, { proposalId: `PROP-${state}`, opportunityId, status: "PROPOSED", approvalState: index >= 3 ? "APPROVED" : "PENDING", proposalRevisionId: `PROP-${state}-R1`, proposalHash: `HASH-${state}`, order: index });
  if (index >= 2) await save(DIRS.customerReviewPackages, `REVIEW-${state}`, { customerReviewPackageId: `REVIEW-${state}`, opportunityId, proposalId: `PROP-${state}`, status: "ACTIVE", order: index });
  if (index >= 4) await save(DIRS.engineeringPackages, `ENG-${state}`, { engineeringPackageId: `ENG-${state}`, opportunityId, proposalId: `PROP-${state}`, order: index });
  if (index >= 5) await save(DIRS.certifiedIofPackages, `CERT-${state}`, { certifiedPackageId: `CERT-${state}`, opportunityId, proposalId: `PROP-${state}`, order: index });
  if (index >= 6) await save(DIRS.serviceOrders, `SO-${state}`, { serviceOrderId: `SO-${state}`, opportunityId, proposalId: `PROP-${state}`, status: index === 6 ? "ISSUED" : index === 7 ? "CUSTOMER_ACCEPTED" : "COUNTERSIGNED", ...(index >= 7 ? { customerSignedAt: "2026-01-02T00:00:00Z" } : {}), ...(index >= 8 ? { countersignedAt: "2026-01-03T00:00:00Z" } : {}), ...(index === 9 ? { scopeVersionId: "SV-AUTHORIZED" } : {}), order: index });
  if (index === 9) await save(DIRS.scopeVersions, "SV-AUTHORIZED", { scopeVersionId: "SV-AUTHORIZED", opportunityId, order: index });
}
await persistRecord(DIRS.commercialOpportunities, "OPP-OTHER", { opportunityId: "OPP-OTHER", accountId: "ACCOUNT-B", customerId: "CUSTOMER-B", name: "Other account" });

const internal = await buildAccountCustomerTwin({ account, user, lens: "INTERNAL" });
assert.equal(internal.customerTwinId, "CUSTOMER-TWIN-ACCOUNT-A");
assert.equal(internal.dealCount, 10);
assert.equal(internal.createsAuthority, false);
for (const state of CUSTOMER_DEAL_STATES) assert.equal(internal.deals.find((deal) => deal.opportunityId === `OPP-${state}`)?.currentState, state);
assert.ok(internal.deals.find((deal) => deal.currentState === "DRAFT")?.permittedActions.some((action) => action.action === "CONTINUE_COMMERCIAL_DRAFT"));

const customerReviewer = await buildAccountCustomerTwin({ account, user, lens: "CUSTOMER", persona: "CUSTOMER_COMMERCIAL_REVIEWER", allowedOpportunityIds: ["OPP-CUSTOMER_REVIEW"] });
assert.deepEqual(customerReviewer.deals.map((deal) => deal.opportunityId), ["OPP-CUSTOMER_REVIEW"]);
assert.ok(customerReviewer.deals[0].permittedActions.some((action) => action.action === "ACCEPT_PROPOSAL_REVISION"));
const customerViewer = await buildAccountCustomerTwin({ account, user, lens: "CUSTOMER", persona: "CUSTOMER_VIEWER", allowedOpportunityIds: ["OPP-CUSTOMER_REVIEW"] });
assert.equal(customerViewer.deals[0].permittedActions.some((action) => action.mutation), false);
const customerSigner = await buildAccountCustomerTwin({ account, user, lens: "CUSTOMER", persona: "CUSTOMER_AUTHORIZED_SIGNER", allowedOpportunityIds: ["OPP-SERVICE_ORDER"] });
assert.ok(customerSigner.deals[0].permittedActions.some((action) => action.action === "SIGN_SERVICE_ORDER"));

console.log(JSON.stringify({ result: "PASS", customerTwinId: internal.customerTwinId, states: CUSTOMER_DEAL_STATES, internalDeals: internal.dealCount, customerIsolation: "PASS", viewerReadOnly: "PASS", governedActions: "PASS", createsAuthority: internal.createsAuthority }, null, 2));
await rm(root, { recursive: true, force: true });
