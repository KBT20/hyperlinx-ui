import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  PRODUCT_DOCTRINE_AUTHORITY,
  PRODUCT_DOCTRINE_HASH,
  assembleProductDoctrineArtifacts,
} from "../server/generated/product-doctrine-runtime.js";
import {
  selectedProposalRevisionDoctrineAuthority,
} from "../server/routes/engineering-certification.js";
import {
  normalizeProposalRecord,
  saveImmutableProposalRevision,
} from "../server/routes/proposal-drafts.js";

const user = {
  userId: "demo-principal",
  principalId: "demo-principal",
  membershipId: "demo-membership",
  name: "Demo Principal",
  displayName: "Demo Principal",
  organizationId: "org-demo",
  workspaceId: "demo-workspace",
};
const proposalId = "PROPOSAL-DEMO-E2E-20260816-B";
const doctrine = { ...PRODUCT_DOCTRINE_AUTHORITY };
const working = normalizeProposalRecord({
  proposalId,
  customerId: "customer-demo",
  accountId: "account-demo",
  opportunityId: "OPPORTUNITY-DEMO-E2E-20260816-B",
  productId: doctrine.productId,
  productName: doctrine.productName,
  productDoctrineId: doctrine.productDoctrineId,
  productDoctrineVersion: doctrine.productDoctrineVersion,
  productDoctrineHash: doctrine.productDoctrineHash,
  routeId: "ROUTE-DEMO-E2E-20260816-B",
  routeFeet: 5280,
  routeMiles: 1,
  routeGeometry: [[-97, 36], [-96.99, 36.01]],
  geometryReferences: ["ROUTE-DEMO-E2E-20260816-B:GEOMETRY"],
  runtimeObjectIds: ["RUNTIME-DEMO-E2E-20260816-B"],
  productConfiguration: {
    ductCount: 3,
    ductDiameter: 1.25,
    fiberCount: 288,
    handholeCount: 2,
    vaultCount: 1,
    spliceCaseCount: 1,
    structurePlanAuthority: "ENGINEERING",
    spliceArchitectureAuthority: "ENGINEERING",
  },
  pricingSummary: { budgetCost: 100000, sellPriceIru: 150000 },
  title: "Demo B",
  summary: "Governed Product Doctrine validation fixture.",
  dealPointIds: ["DEAL-POINT-DEMO-B"],
  existingInventoryReferences: ["DEMO-INVENTORY-REFERENCE"],
}, user);
const revision1 = saveImmutableProposalRevision(working, user, "Demo B Proposal R1.");
const revision1Record = revision1.proposalRevisions.at(-1);
assert.equal(revision1Record.snapshot.productDoctrineId, doctrine.productDoctrineId);
assert.equal(revision1Record.snapshot.productDoctrineVersion, doctrine.productDoctrineVersion);
assert.equal(revision1Record.snapshot.productDoctrineHash, doctrine.productDoctrineHash);
assert.deepEqual(selectedProposalRevisionDoctrineAuthority(revision1), PRODUCT_DOCTRINE_AUTHORITY);

const cloneWorking = normalizeProposalRecord({
  ...revision1,
  proposalRevisionId: `${proposalId}-revision-2`,
  revisionStatus: "WORKING",
  proposalHash: "",
  version: 2,
  revisionNumber: 2,
}, user, revision1);
assert.equal(cloneWorking.productDoctrineVersion, doctrine.productDoctrineVersion, "R1 -> R2 retains exact doctrine version");
assert.equal(cloneWorking.productDoctrineHash, doctrine.productDoctrineHash, "R1 -> R2 retains exact doctrine hash");
const revision2 = saveImmutableProposalRevision(cloneWorking, user, "Demo B Proposal R2 clone.");
const revision2Record = revision2.proposalRevisions.at(-1);
assert.equal(revision2Record.snapshot.productDoctrineVersion, doctrine.productDoctrineVersion);
assert.equal(revision2Record.snapshot.productDoctrineHash, doctrine.productDoctrineHash);

for (const [label, patch, expectedCode] of [
  ["missing doctrine id", { productDoctrineId: "" }, "PRODUCT_DOCTRINE_AUTHORITY_REQUIRED"],
  ["missing doctrine version", { productDoctrineVersion: "" }, "PRODUCT_DOCTRINE_AUTHORITY_REQUIRED"],
  ["missing doctrine hash", { productDoctrineHash: "" }, "PRODUCT_DOCTRINE_AUTHORITY_REQUIRED"],
  ["wrong doctrine id", { productDoctrineId: "WRONG" }, "PRODUCT_DOCTRINE_AUTHORITY_MISMATCH"],
  ["wrong doctrine version", { productDoctrineVersion: "99" }, "PRODUCT_DOCTRINE_AUTHORITY_MISMATCH"],
  ["wrong doctrine hash", { productDoctrineHash: "wrong" }, "PRODUCT_DOCTRINE_AUTHORITY_MISMATCH"],
]) {
  const badRevision = structuredClone(revision2);
  const selected = badRevision.proposalRevisions.find((item) => item.proposalRevisionId === badRevision.proposalRevisionId);
  Object.assign(selected.snapshot, patch);
  assert.throws(
    () => selectedProposalRevisionDoctrineAuthority(badRevision),
    (error) => error?.status === 409 && error?.code === expectedCode,
    label,
  );
}

const assemblyInput = { packageId: `DRAFT-IOF-${proposalId}`, proposal: revision2 };
const first = assembleProductDoctrineArtifacts(assemblyInput);
const second = assembleProductDoctrineArtifacts(assemblyInput);
const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
assert.equal(first.productDoctrineAssembly.validationSummary.status, "PASS");
assert.equal(first.doctrineObjectInstantiation.validation.status, "PASS");
assert.equal(first.engineeringObjectManifest.authority, "DOCTRINE_OBJECT_INSTANTIATION_ENGINE");
assert.equal(first.engineeringObjectManifest.doctrineId, doctrine.productDoctrineId);
assert.equal(first.engineeringObjectManifest.doctrineVersion, doctrine.productDoctrineVersion);
assert.ok(first.engineeringObjectManifest.objectCount > 0);
assert.equal(first.engineeringObjectManifest.manifestId, second.engineeringObjectManifest.manifestId);
assert.equal(hash(first.engineeringObjectManifest), hash(second.engineeringObjectManifest));

console.log(JSON.stringify({
  result: "PASS",
  productDoctrineAuthority: PRODUCT_DOCTRINE_AUTHORITY,
  productDoctrineHash: PRODUCT_DOCTRINE_HASH,
  proposalRevision1: revision1Record.proposalRevisionId,
  proposalRevision2: revision2Record.proposalRevisionId,
  cloneRetainsDoctrine: true,
  negativeAuthorityCases: 6,
  assemblyValidation: first.productDoctrineAssembly.validationSummary.status,
  instantiationValidation: first.doctrineObjectInstantiation.validation.status,
  manifestId: first.engineeringObjectManifest.manifestId,
  manifestHash: hash(first.engineeringObjectManifest),
  objectCount: first.engineeringObjectManifest.objectCount,
  deterministicRetry: true,
  noScopeVersionCreation: true,
}, null, 2));
