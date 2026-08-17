import assert from "node:assert/strict";
import { OPERATIONAL_LENS_REGISTRY, projectOperationalBaseline } from "./server/routes/operational-baselines.js";

const common = {
  baselineIdentity: { operationalBaselineId: "OPERATIONAL-BASELINE-ScopeVersion-0001", operationalBaselineHash: "a".repeat(64), deterministic: true },
  executionAuthority: { scopeVersionId: "ScopeVersion-0001", scopeVersionRevision: 1, scopeVersionHash: "b".repeat(64), state: "AUTHORIZED", immutable: true },
  project: { organizationId: "org-demo", accountId: "ACCOUNT-DEMO", opportunityId: "OPPORTUNITY-DEMO" },
  lineage: { proposalRevisionId: "PROPOSAL-DEMO-revision-2" },
  route: { id: "ROUTE-DEMO", revision: "1", geometryId: "ROUTE-DEMO:GEOMETRY:v1", geometryHash: "rg-demo" },
  authorityCensus: { stations: 3, objects: 6, relationships: 5, workSegments: 2, closureEvents: 0 },
  identities: { stationIds: ["STA-0", "STA-1", "STA-2"], objectIds: ["OBJ-1"], relationshipIds: ["REL-1"], workSegmentIds: ["WORK-1"] },
  initialState: { execution: "AUTHORIZED", objects: "AUTHORIZED_NOT_REALIZED", physicallyComplete: false, realized: false },
  closeBoundary: { mutationAuthority: "GOVERNED_CLOSE_ONLY", operationalLensesMutateSpine: false },
};

const projections = OPERATIONAL_LENS_REGISTRY.map((lens) => projectOperationalBaseline(common, lens.lensId));
for (const projection of projections) {
  assert.equal(projection.executionAuthority.scopeVersionId, common.executionAuthority.scopeVersionId);
  assert.deepEqual(projection.route, common.route);
  assert.deepEqual(projection.identities, common.identities);
  assert.equal(projection.lens.mutatesSpine, false);
  assert.equal(projection.lens.createsCloseAuthority, false);
  assert.equal(projection.projectionOnly, true);
}
assert.equal(projections[2].lens.completionAuthority, "NOT_CLOSE_AUTHORITY");
assert.equal(projections[3].lens.mutationAuthority, "NONE");
assert.throws(() => projectOperationalBaseline(common, "UNREGISTERED"), /not registered/);
console.log(JSON.stringify({
  status: "PASS",
  lensIds: projections.map((projection) => projection.lens.lensId),
  crossLensScopeVersionParity: true,
  crossLensRouteParity: true,
  crossLensIdentityParity: true,
  directSpineMutationAuthority: "REJECTED",
  closeAuthority: "GOVERNED_CLOSE_ONLY",
}, null, 2));
