import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const root = await mkdtemp(path.join(tmpdir(), "cip071a-artifact-state-"));
process.env.DAL_DATA_ROOT = path.join(root, "production");
process.env.DAL_DEMO_DATA_ROOT = path.join(root, "demo");

const { DIRS, persistRecord, withRepositoryAuthority } = await import("../server/routes/_shared.js");
const { buildAccountCustomerTwin } = await import("../server/routes/customer-account-twin.js");
const account = { accountId: "ACCOUNT-DEMO-CIP071A", customerId: "CUSTOMER-DEMO-CIP071A", name: "CIP-071A", status: "ACTIVE", organizationId: "org-demo" };
const opportunityId = "OPP-DEMO-CIP071A";
const proposalId = "PROPOSAL-DEMO-CIP071A";
const proposalRevisionId = `${proposalId}-revision-2`;
const proposalHash = "HASH-DEMO-CIP071A-R2";
const serviceOrderId = "SO-DEMO-CIP071A";
const customerSignatureId = "CUSTOMER-SIGNATURE-DEMO-CIP071A";
const countersignatureId = "TERALINX-COUNTERSIGNATURE-DEMO-CIP071A";
const scopeVersionId = "SCOPEVERSION-DEMO-CIP071A";
const demoUser = { principalId: "demo-principal", organizationId: "org-demo", authorityClass: "DEMO", permissions: ["demo.tenant"] };

async function save(dir, id, value) {
  await withRepositoryAuthority(demoUser, () => persistRecord(dir, id, { accountId: account.accountId, customerId: account.customerId, ...value }));
}

await save(DIRS.commercialOpportunities, opportunityId, { opportunityId, name: "Artifact-state projection" });
await save(DIRS.proposalDrafts, proposalId, {
  proposalId, opportunityId, proposalRevisionId, proposalRevisionNumber: 2, proposalHash,
  status: "CUSTOMER_ACCEPTED", approvalState: "APPROVED",
  proposalRevisions: [
    { proposalRevisionId: `${proposalId}-revision-1`, revisionNumber: 1, proposalHash: "HASH-DEMO-CIP071A-R1", createdAt: "2026-08-01T00:00:00Z" },
    { proposalRevisionId, revisionNumber: 2, proposalHash, createdAt: "2026-08-02T00:00:00Z" },
  ],
});
await save(DIRS.customerReviewPackages, "REVIEW-DEMO-CIP071A", { customerReviewPackageId: "REVIEW-DEMO-CIP071A", opportunityId, proposalId, proposalRevisionId, proposalHash });
await save(DIRS.customerPortalActions, "CUSTOMER-ACTION-DEMO-ACCEPT-CIP071A", { customerPortalActionId: "CUSTOMER-ACTION-DEMO-ACCEPT-CIP071A", action: "ACCEPT", opportunityId, proposalId, proposalRevisionId, proposalHash });
await save(DIRS.engineeringPackages, "ENG-DEMO-CIP071A", { engineeringPackageId: "ENG-DEMO-CIP071A", opportunityId, proposalId, status: "APPROVED" });
await save(DIRS.certifiedIofPackages, "CERT-DEMO-CIP071A", { certifiedPackageId: "CERT-DEMO-CIP071A", opportunityId, proposalId, certificationHash: "CERT-HASH-DEMO-CIP071A" });
await save(DIRS.customerSignatures, customerSignatureId, { customerSignatureId, serviceOrderId, documentHash: "SO-HASH-DEMO-CIP071A", signatureHash: "CUSTOMER-SIGNATURE-HASH-DEMO-CIP071A" });
await save(DIRS.teralinxCountersignatures, countersignatureId, { countersignatureId, serviceOrderId, documentHash: "SO-HASH-DEMO-CIP071A", customerSignatureId, countersignatureHash: "COUNTERSIGNATURE-HASH-DEMO-CIP071A" });
await save(DIRS.serviceOrders, serviceOrderId, { serviceOrderId, opportunityId, proposalId, documentRevision: 1, documentHash: "SO-HASH-DEMO-CIP071A", status: "COUNTERSIGNED", signatureStatus: "FULLY_SIGNED", customerSignatureId, countersignatureId, scopeVersionId });
await save(DIRS.scopeVersions, scopeVersionId, { scopeVersionId, serviceOrderId, opportunityId, status: "AUTHORIZED" });

const twin = await withRepositoryAuthority(demoUser, () => buildAccountCustomerTwin({ account, user: demoUser, lens: "INTERNAL" }));
const deal = twin.deals.find((item) => item.opportunityId === opportunityId);
assert.ok(deal);
assert.equal(deal.currentState, "AUTHORIZED");
assert.equal(deal.artifactStates.proposal.state, "ACCEPTED");
assert.equal(deal.artifactStates.proposal.proposalRevisionId, proposalRevisionId);
assert.equal(deal.artifactStates.proposal.proposalHash, proposalHash);
assert.equal(deal.artifactStates.engineering.state, "CERTIFIED");
assert.equal(deal.artifactStates.certifiedIof.state, "CERTIFIED");
assert.equal(deal.artifactStates.serviceOrder.state, "COUNTERSIGNED");
assert.equal(deal.artifactStates.serviceOrder.signatureState, "FULLY_SIGNED");
assert.equal(deal.artifactStates.customerSignature.state, "SIGNED");
assert.equal(deal.artifactStates.countersignature.state, "COUNTERSIGNED");
assert.equal(deal.artifactStates.scopeVersion.state, "AUTHORIZED");
assert.equal(deal.documentHistory.find((item) => item.documentId === proposalRevisionId)?.status, "ACCEPTED");
assert.notEqual(deal.artifactStates.proposal.state, deal.artifactStates.serviceOrder.state);

console.log(JSON.stringify({ result: "PASS", dealState: deal.currentState, artifactStates: deal.artifactStates, lineage: { proposalRevisionId, proposalHash, serviceOrderId, scopeVersionId } }, null, 2));
await rm(root, { recursive: true, force: true });
