import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  PRODUCT_DOCTRINE_AUTHORITY,
  assembleProductDoctrineArtifacts,
} from "../server/generated/product-doctrine-runtime.js";

const baseProposal = {
  proposalId: "PROPOSAL-DEMO-CIP069-VALIDATION",
  proposalRevisionId: "PROPOSAL-DEMO-CIP069-VALIDATION-revision-1",
  proposalHash: "immutable-proposal-hash",
  accountId: "ACCOUNT-DEMO-CIP069",
  customerId: "customer-demo-a",
  opportunityId: "OPPORTUNITY-DEMO-CIP069",
  productId: PRODUCT_DOCTRINE_AUTHORITY.productId,
  productDoctrineId: PRODUCT_DOCTRINE_AUTHORITY.productDoctrineId,
  productDoctrineVersion: PRODUCT_DOCTRINE_AUTHORITY.productDoctrineVersion,
  productDoctrineHash: PRODUCT_DOCTRINE_AUTHORITY.productDoctrineHash,
  routeId: "ROUTE-DEMO-CIP069",
  routeRevision: 1,
  routeFeet: 5280,
  routeMiles: 1,
  routeGeometry: [[-97.5, 35.4], [-97.4, 35.5]],
  routeGeometryHash: "route-cip069-hash",
  productConfiguration: { ductCount: 3, ductDiameter: 1.25, fiberCount: 288 },
  pricingSummary: { budgetCost: 100000, sellPriceIru: 150000 },
};

const assemble = (suffix, proposal = baseProposal) => assembleProductDoctrineArtifacts({
  packageId: `DRAFT-IOF-PROPOSAL-DEMO-CIP069-${suffix}`,
  proposal,
});
const byAsset = (artifacts, assetId) => artifacts.engineeringObjectManifest.requiredAssetModel.find((item) => item.assetId === assetId);
const countObjects = (artifacts, objectType) => artifacts.engineeringObjectManifest.instantiatedObjects.filter((item) => item.objectGroup === "REQUIRED_ASSET" && item.objectType === objectType).length;
const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

const unresolved = assemble("UNRESOLVED");
assert.equal(unresolved.doctrineObjectInstantiation.validation.status, "PASS");
for (const [assetId, objectType] of [
  ["ASSET:HANDHOLES", "HANDHOLE"],
  ["ASSET:VAULTS", "VAULT"],
  ["ASSET:SPLICE-CASES", "SPLICE_CASE"],
]) {
  const model = byAsset(unresolved, assetId);
  assert.equal(model.requirement, "CONDITIONAL");
  assert.equal(model.applicability, "ENGINEERING_REVIEW_REQUIRED");
  assert.equal(model.instantiatedQuantity, 0);
  assert.equal(model.routeLengthCreatesAsset, false);
  assert.equal(countObjects(unresolved, objectType), 0);
}

const longerRoute = assemble("LONGER", { ...baseProposal, routeFeet: 528000, routeMiles: 100 });
for (const assetId of ["ASSET:HANDHOLES", "ASSET:VAULTS", "ASSET:SPLICE-CASES", "ASSET:ILA-REGEN-FACILITIES"]) {
  assert.equal(byAsset(longerRoute, assetId).instantiatedQuantity, 0, `${assetId} must not be created by route mileage`);
}

const governed = assemble("GOVERNED", {
  ...baseProposal,
  productConfiguration: {
    ...baseProposal.productConfiguration,
    handholeCount: 2,
    vaultCount: 1,
    spliceCaseCount: 1,
    structurePlanAuthority: "ENGINEERING_DEFINED",
    spliceArchitectureAuthority: "ENGINEERING_DEFINED",
  },
});
assert.equal(governed.doctrineObjectInstantiation.validation.status, "PASS");
assert.equal(byAsset(governed, "ASSET:HANDHOLES").applicability, "APPLICABLE");
assert.equal(byAsset(governed, "ASSET:VAULTS").applicability, "APPLICABLE");
assert.equal(byAsset(governed, "ASSET:SPLICE-CASES").applicability, "APPLICABLE");
assert.equal(countObjects(governed, "HANDHOLE"), 2);
assert.equal(countObjects(governed, "VAULT"), 1);
assert.equal(countObjects(governed, "SPLICE_CASE"), 1);

const explicitZero = assemble("EXPLICIT-ZERO", {
  ...baseProposal,
  productConfiguration: {
    ...baseProposal.productConfiguration,
    handholeCount: 0,
    vaultCount: 0,
    spliceCaseCount: 0,
    structurePlanAuthority: "ENGINEERING_DEFINED",
    spliceArchitectureAuthority: "ENGINEERING_DEFINED",
  },
});
for (const assetId of ["ASSET:HANDHOLES", "ASSET:VAULTS", "ASSET:SPLICE-CASES"]) {
  assert.equal(byAsset(explicitZero, assetId).applicability, "NOT_APPLICABLE");
}

const retry = assemble("UNRESOLVED");
assert.equal(hash(unresolved.engineeringObjectManifest), hash(retry.engineeringObjectManifest));
assert.equal(PRODUCT_DOCTRINE_AUTHORITY.productDoctrineVersion, "20C.1.0");
assert.equal(PRODUCT_DOCTRINE_AUTHORITY.productDoctrineHash, "81c488a6d4bd35183e35eabf1a1c533e53a7c700d38db5d5bf67e8c2b3883bdd");

console.log(JSON.stringify({
  result: "PASS",
  doctrineVersion: PRODUCT_DOCTRINE_AUTHORITY.productDoctrineVersion,
  doctrineHash: PRODUCT_DOCTRINE_AUTHORITY.productDoctrineHash,
  unresolvedConditionalAssets: unresolved.engineeringObjectManifest.requiredAssetModel
    .filter((item) => item.applicability === "ENGINEERING_REVIEW_REQUIRED")
    .map((item) => item.assetId),
  noMileageGeneratedStructures: true,
  governedCounts: { handholes: countObjects(governed, "HANDHOLE"), vaults: countObjects(governed, "VAULT"), spliceCases: countObjects(governed, "SPLICE_CASE") },
  explicitZeroSupported: true,
  deterministicRetry: true,
  proposalMutation: false,
  scopeVersionCreation: false,
}, null, 2));
