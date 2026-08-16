import assert from "node:assert/strict";
import { exactProposalRevisionEligibility } from "../server/routes/commercial-iof-packages.js";
import { selectedSavedProposalRevisionLineage } from "../server/routes/engineering-certification.js";
import { engineeringPackageRecordForRepository } from "../server/routes/engineering-packages.js";

const revision1 = {
  proposalId: "PROPOSAL-DEMO-E2E-20260816-A",
  proposalRevisionId: "PROPOSAL-DEMO-E2E-20260816-A-revision-1",
  proposalHash: "hash-r1",
  revisionNumber: 1,
  revisionStatus: "SAVED",
  snapshot: { proposalId: "PROPOSAL-DEMO-E2E-20260816-A", customerId: "demo-customer-001", opportunityId: "OPPORTUNITY-DEMO-E2E-20260816-A" },
};
const revision2 = {
  proposalId: "PROPOSAL-DEMO-E2E-20260816-A",
  proposalRevisionId: "PROPOSAL-DEMO-E2E-20260816-A-revision-2",
  proposalHash: "cc746cba574951b6dcc0a49ee6c80dc85ddeba599ed9663142512026cc05a31d",
  revisionNumber: 2,
  revisionStatus: "SAVED",
  snapshot: { proposalId: "PROPOSAL-DEMO-E2E-20260816-A", customerId: "demo-customer-001", opportunityId: "OPPORTUNITY-DEMO-E2E-20260816-A" },
};
const proposal = {
  proposalId: revision2.proposalId,
  proposalRecordId: revision2.proposalId,
  proposalRevisionId: revision2.proposalRevisionId,
  proposalHash: revision2.proposalHash,
  revisionNumber: 2,
  version: 2,
  organizationId: "org-demo",
  customerId: "demo-customer-001",
  opportunityId: "OPPORTUNITY-DEMO-E2E-20260816-A",
  proposalRevisions: [revision1, revision2],
  approvals: [{ decision: "APPROVED", proposalRevisionId: revision2.proposalRevisionId, proposalHash: revision2.proposalHash }],
};
const lineage = selectedSavedProposalRevisionLineage(proposal);
assert.deepEqual(lineage, {
  proposalId: proposal.proposalId,
  proposalRevisionId: revision2.proposalRevisionId,
  proposalRevisionNumber: 2,
  proposalHash: revision2.proposalHash,
  sourceProposalVersion: 2,
});

const draft = {
  ...lineage,
  organizationId: proposal.organizationId,
  customerId: proposal.customerId,
  opportunityId: proposal.opportunityId,
};
assert.equal(exactProposalRevisionEligibility(proposal, draft).eligible, true);

const rejected = (candidate) => exactProposalRevisionEligibility(proposal, candidate).eligible === false;
assert.equal(rejected({ ...draft, proposalRevisionId: "" }), true, "missing proposalRevisionId");
assert.equal(rejected({ ...draft, proposalHash: "" }), true, "missing proposalHash");
assert.equal(rejected({ ...draft, proposalRevisionId: "PROPOSAL-DEMO-WRONG-REVISION" }), true, "wrong proposalRevisionId");
assert.equal(rejected({ ...draft, proposalHash: "wrong-hash" }), true, "wrong proposalHash");
assert.equal(rejected({ ...draft, proposalRevisionId: revision1.proposalRevisionId, proposalHash: revision1.proposalHash, proposalRevisionNumber: 1 }), true, "same proposal wrong revision");
assert.equal(rejected({ ...draft, opportunityId: "OPPORTUNITY-DEMO-CROSS" }), true, "cross-opportunity revision");
assert.equal(rejected({ ...draft, organizationId: "org-teralinx" }), true, "cross-organization revision");
assert.equal(rejected({ proposalId: proposal.proposalId, sourceProposalVersion: 2, organizationId: proposal.organizationId, customerId: proposal.customerId, opportunityId: proposal.opportunityId }), true, "sourceProposalVersion only");

const engineeringPackage = engineeringPackageRecordForRepository({
  draftPackage: {
    ...draft,
    packageId: "DRAFT-IOF-PROPOSAL-DEMO-E2E-20260816-A",
    routeRepositoryId: "ROUTE-DEMO-E2E-20260816-A",
    commercialRevisionId: "COMM-REV-DEMO",
    commercialReleasePackageId: "COMM-RELEASE-DEMO",
    commercialRevisionHash: "commercial-revision-hash",
    commercialReleaseHash: "commercial-release-hash",
    measuredCenterlineId: "DEMO-CENTERLINE",
    stationProjectionId: "DEMO-STATION-PROJECTION",
    stationGraphId: "DEMO-STATION-GRAPH",
    stationAuthorityIds: ["DEMO-STATION-AUTHORITY"],
    stationObjectManifestId: "DEMO-STATION-OBJECT-MANIFEST",
    projectedObjectManifestId: "DEMO-PROJECTED-OBJECT-MANIFEST",
    closureLedgerId: "DEMO-CLOSURE-LEDGER",
    iofPackageTwinId: "DEMO-IOF-TWIN",
    executionGraphId: "DEMO-EXECUTION-GRAPH",
    lifecycleGraphId: "DEMO-LIFECYCLE-GRAPH",
    doctrineObjectManifestId: "DEMO-DOCTRINE-MANIFEST",
    engineeringObjectManifestId: "DEMO-ENGINEERING-MANIFEST",
  },
  engineeringBaseline: {
    engineeringBaselineId: "DEMO-ENGINEERING-BASELINE",
    engineeringBaselineHash: "demo-baseline-hash",
    engineeringBaselineManifestId: "DEMO-BASELINE-MANIFEST",
    engineeringBaselineProjectionId: "DEMO-BASELINE-PROJECTION",
  },
});
assert.equal(engineeringPackage.proposalRevisionId, revision2.proposalRevisionId);
assert.equal(engineeringPackage.proposalRevisionNumber, 2);
assert.equal(engineeringPackage.proposalHash, revision2.proposalHash);

console.log(JSON.stringify({
  result: "PASS",
  proposalRevisionId: lineage.proposalRevisionId,
  proposalHash: lineage.proposalHash,
  negativeCases: 8,
  engineeringPackageBinding: true,
  geometryRebuilt: false,
  stationProjectionRebuilt: false,
  objectManifestRebuilt: false,
  productDoctrineRebuilt: false,
  mapRebuilt: false,
  scopeVersionCreated: false,
  twinCreated: false,
}, null, 2));
