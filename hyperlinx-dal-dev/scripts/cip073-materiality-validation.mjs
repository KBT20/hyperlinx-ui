import assert from "node:assert/strict";
import { evaluateOpportunityProposalMateriality } from "../server/routes/commercial-opportunities.js";

const v4 = {
  schemaVersion: "CIP-067", commercialStateVersion: 4, state: "SAVED",
  accountId: "ACCOUNT-DEMO-NORTHSTAR", routeRevision: 2, geometryHash: "rg-503c4625",
  proposalRevisionId: "PROPOSAL-R1", proposalHash: "HASH-R1",
  commercialWorkingState: { proposalReferences: { proposalRevisionId: "PROPOSAL-R1", proposalHash: "HASH-R1" } },
};
const v5 = structuredClone(v4);
v5.commercialStateVersion = 5;
v5.proposalRevisionId = "PROPOSAL-R2";
v5.proposalHash = "HASH-R2";
v5.commercialWorkingState.proposalReferences = { proposalRevisionId: "PROPOSAL-R2", proposalHash: "HASH-R2" };
v5.commercialWorkingState.lastGovernedRevisionState = "PROPOSAL_REVISION_SAVED";

const nonMaterial = evaluateOpportunityProposalMateriality(v4, v5);
assert.equal(nonMaterial.decision, "NON_MATERIAL");
assert.equal(nonMaterial.materialCommercialState, "UNCHANGED");
assert.equal(nonMaterial.changes.length, 6);
assert.ok(nonMaterial.changes.every((item) => item.classification === "SYSTEM_DERIVED"));

const materialV5 = structuredClone(v5);
materialV5.routeRevision = 3;
const material = evaluateOpportunityProposalMateriality(v4, materialV5);
assert.equal(material.decision, "PROPOSAL_MATERIAL");
assert.ok(material.materialChanges.some((item) => item.field === "routeRevision"));

const unknownV5 = structuredClone(v5);
unknownV5.unclassifiedAuthority = "CHANGED";
const unknown = evaluateOpportunityProposalMateriality(v4, unknownV5);
assert.equal(unknown.decision, "PROPOSAL_REVIEW_REQUIRED");
assert.ok(unknown.unknownChanges.some((item) => item.field === "unclassifiedAuthority"));

console.log(JSON.stringify({ result: "PASS", nonMaterial, materialDecision: material.decision, unknownDecision: unknown.decision }, null, 2));
