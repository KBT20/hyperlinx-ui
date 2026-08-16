import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const baseUrl = process.env.CIP060_BASE_URL ?? "http://127.0.0.1:3001";
const credentialPath = process.env.CIP060_DEMO_CREDENTIAL_FILE ?? "/home/ubuntu/.hyperlinx-demo-credential";
const password = (await readFile(credentialPath, "utf8")).trim();
assert.ok(password, "Demo credential is empty.");

let cookie = "";
const trace = [];
async function request(step, pathname, { method = "GET", body, expected = [200, 201] } = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  const text = await response.text();
  let payload;
  try { payload = text ? JSON.parse(text) : {}; } catch { payload = { text }; }
  trace.push({ step, status: response.status, predicate: payload.predicate, error: payload.error });
  if (!expected.includes(response.status)) {
    const error = new Error(`${step} failed (${response.status}): ${payload.error ?? text}`);
    Object.assign(error, { step, status: response.status, payload, trace });
    throw error;
  }
  return payload;
}

const login = await request("Demo login", "/api/auth/login", {
  method: "POST",
  body: { username: "demo", password },
});
assert.equal(login.user?.principalId, "demo-principal");
assert.equal(login.user?.organizationId, "org-demo");
assert.ok(login.permissions?.includes("demo.tenant"));

const productList = await request("Product authority resolve", "/api/products");
const product = productList.products.find((item) => item.productId === "POINT_TO_POINT_LONG_HAUL_CONDUIT_FIBER");
assert.ok(product, "Approved Layer-1 product was not resolved.");
for (const field of ["productDoctrineId", "productDoctrineVersion", "productDoctrineHash"]) assert.ok(product[field], `${field} missing`);

const oldFailure = await request("Old A doctrine gate", "/api/engineering/certification/draft-packages/from-proposal", {
  method: "POST",
  body: { proposalId: "PROPOSAL-DEMO-E2E-20260816-A" },
  expected: [409],
});
assert.equal(oldFailure.predicate, "PRODUCT_DOCTRINE_AUTHORITY_REQUIRED");

const opportunityId = "OPPORTUNITY-DEMO-E2E-20260816-B";
const routeRepositoryId = "ROUTE-DEMO-E2E-20260816-B";
const proposalId = "PROPOSAL-DEMO-E2E-20260816-B";
const packageId = `DRAFT-IOF-${proposalId}`;
const geometry = [[-97.5164, 35.4676], [-97.4125, 35.512], [-97.326, 35.565]];
const productAuthority = {
  productId: product.productId,
  productName: product.productName,
  productDoctrineId: product.productDoctrineId,
  productDoctrineVersion: product.productDoctrineVersion,
  productDoctrineHash: product.productDoctrineHash,
};

const opportunityResponse = await request("Create Demo B Opportunity", "/api/commercial/opportunities", {
  method: "POST",
  body: { opportunity: {
    opportunityId,
    accountId: "account-demo",
    customerId: "customer-demo",
    name: "Demo E2E 20260816 B",
    status: "SAVED",
    selectedScopeId: "SCOPE-DEMO-E2E-20260816-B",
    activeView: "proposal",
    visibility: "ORGANIZATION",
    ...productAuthority,
  } },
});
assert.equal(opportunityResponse.opportunity.organizationId, "org-demo");
assert.equal(opportunityResponse.opportunity.productionEligible, false);

const routeResponse = await request("Persist Demo B Commercial Route", "/api/commercial/routes", {
  method: "POST",
  body: { commercialRoute: {
    routeRepositoryId,
    routeSnapshotId: `${routeRepositoryId}-v1`,
    routeGeometryId: `${routeRepositoryId}:GEOMETRY:v1`,
    opportunityId,
    accountId: "account-demo",
    customerId: "customer-demo",
    ...productAuthority,
    routeId: routeRepositoryId,
    routeName: "Demo B Governed Route",
    routeRevision: 1,
    commercialGeometry: geometry,
    routeFeet: 5280,
    routeMiles: 1,
    routeSource: "COMMERCIAL_DRAWN_ROUTE",
  } },
});
const route = routeResponse.commercialRoute;
assert.equal(route.organizationId, "org-demo");
assert.equal(route.productionEligible, false);

const proposalBase = {
  proposalId,
  proposalRecordId: proposalId,
  proposalNumber: "DEMO-E2E-20260816-B",
  customerId: "customer-demo",
  accountId: "account-demo",
  opportunityId,
  ...productAuthority,
  routeRepositoryId,
  routeId: route.routeId,
  routeRevision: route.routeRevision,
  routeGeometryId: route.routeGeometryId,
  routeGeometryHash: route.geometryHash,
  routeSnapshot: {
    routeRepositoryId,
    routeId: route.routeId,
    routeRevision: route.routeRevision,
    routeGeometryId: route.routeGeometryId,
    geometryHash: route.geometryHash,
  },
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
  pricingSummary: {
    routeMiles: 1,
    routeFeet: 5280,
    budgetCost: 100000,
    sellPriceIru: 150000,
    nrcRevenue: 150000,
    mrcRevenue: 1000,
    grossMarginDollars: 50000,
    grossMarginPercent: 33.33,
  },
  title: "Demo B Governed Dark Fiber Proposal",
  summary: "A Demo-only Proposal bound to exact Product Doctrine authority.",
  executiveSummary: "Demo Point-to-Point Duct & Dark Fiber lifecycle validation.",
  status: "DRAFT",
  approvalState: "NOT_SUBMITTED",
  visibility: "SHARED",
  assignedCustomerUsers: ["demo-principal"],
  dealPointIds: ["DEAL-POINT-DEMO-E2E-20260816-B"],
  runtimeObjectIds: ["RUNTIME-DEMO-E2E-20260816-B"],
  runtimeRelationshipIds: [`DERIVED_FROM:${opportunityId}`],
  existingInventoryReferences: ["INVENTORY-DEMO-E2E-20260816-B"],
  geometryReferences: [route.routeGeometryId],
  proposalDocumentReferences: ["Demo executive summary", "Demo pricing summary", "Demo route map"],
  saveProposalRevision: true,
  revisionReason: "Demo B immutable Proposal R1.",
};
const r1Response = await request("Save Proposal R1", "/api/proposals", { method: "POST", body: { proposal: proposalBase } });
const r1 = r1Response.proposal;
assert.equal(r1.revisionNumber, 1);
assert.equal(r1.revisionStatus, "SAVED");
assert.equal(r1.proposalRevisions.at(-1).snapshot.productDoctrineHash, product.productDoctrineHash);

const workingR2Response = await request("Clone R1 into working R2", `/api/proposals/${proposalId}/revision`, {
  method: "POST",
  body: { basisProposalRevisionId: r1.proposalRevisionId, reason: "Demo B governed Proposal clone R1 to R2." },
});
const workingR2 = workingR2Response.proposal;
assert.equal(workingR2.revisionNumber, 2);
assert.equal(workingR2.revisionStatus, "WORKING");
assert.equal(workingR2.productDoctrineHash, r1.productDoctrineHash);
const r2Response = await request("Save Proposal R2", "/api/proposals", {
  method: "POST",
  body: { proposal: { ...workingR2, saveProposalRevision: true, revisionReason: "Demo B immutable Proposal R2." } },
});
const r2 = r2Response.proposal;
assert.equal(r2.revisionNumber, 2);
assert.equal(r2.revisionStatus, "SAVED");
assert.equal(r2.proposalRevisions.at(-1).snapshot.productDoctrineVersion, r1.productDoctrineVersion);
assert.equal(r2.proposalRevisions.at(-1).snapshot.productDoctrineHash, r1.productDoctrineHash);

await request("Submit Proposal R2 to Demo customer", `/api/proposals/${proposalId}/submit-customer`, {
  method: "POST",
  body: { assignedCustomerUsers: ["demo-principal"] },
});
const approvalResponse = await request("Demo customer accepts Proposal R2", `/api/proposals/${proposalId}/approve`, {
  method: "POST",
  body: { comment: "Demo customer acceptance simulation under DEMO authority." },
});
assert.equal(approvalResponse.proposal.proposalRevisionId, r2.proposalRevisionId);
assert.equal(approvalResponse.proposal.proposalHash, r2.proposalHash);
assert.equal(approvalResponse.draftIofAssemblyError, "");
const draft = approvalResponse.draftPackage;
assert.ok(draft, "Customer acceptance did not create the Draft IOF Package.");
assert.equal(draft.productDoctrineId, product.productDoctrineId);
assert.equal(draft.productDoctrineVersion, product.productDoctrineVersion);
assert.equal(draft.productDoctrineHash, product.productDoctrineHash);
assert.equal(draft.proposalRevisionId, r2.proposalRevisionId);
assert.equal(draft.proposalHash, r2.proposalHash);
const manifestReference = draft.iofArtifactRepositoryReferences?.engineeringObjectManifest;
assert.ok(manifestReference?.artifactId);
assert.equal(draft.noEmbeddedManifests, true);

const retry = await request("Deterministic Draft IOF retry", "/api/engineering/certification/draft-packages/from-proposal", {
  method: "POST",
  body: { proposalId },
});
const retryDraft = retry.draftPackage;
assert.equal(retryDraft.iofArtifactRepositoryReferences.engineeringObjectManifest.artifactId, manifestReference.artifactId);
assert.equal(retryDraft.iofArtifactRepositoryReferences.engineeringObjectManifest.hash, manifestReference.hash);

const engineering = await request("Commercial to Engineering submission", `/api/commercial/iof-packages/${packageId}/submit-engineering`, {
  method: "POST",
  body: {},
});
assert.ok(engineering.engineeringPackage?.engineeringPackageId);
assert.equal(engineering.engineeringPackage.proposalRevisionId, r2.proposalRevisionId);
assert.equal(engineering.engineeringPackage.proposalHash, r2.proposalHash);
assert.equal(engineering.engineeringPackage.engineeringObjectManifestId, manifestReference.artifactId);

console.log(JSON.stringify({
  result: "PASS_TO_ENGINEERING",
  codeVersion: process.env.CIP060_CODE_VERSION ?? "UNKNOWN",
  principalId: login.user.principalId,
  organizationId: login.user.organizationId,
  oldFixtureA: "FAILED_PRE_ENGINEERING_VALIDATION / PRODUCT_DOCTRINE_AUTHORITY_ABSENT",
  opportunityId,
  routeRepositoryId,
  proposalId,
  proposalRevision1Id: r1.proposalRevisionId,
  proposalRevision2Id: r2.proposalRevisionId,
  proposalRevision2Hash: r2.proposalHash,
  productDoctrine: productAuthority,
  manifestReference,
  objectCount: retryDraft.engineeringObjectManifest?.objectCount,
  deterministicRetry: true,
  referenceOnlyDraft: retryDraft.noEmbeddedManifests === true,
  engineeringPackageId: engineering.engineeringPackage.engineeringPackageId,
  engineeringBaselineId: engineering.engineeringBaseline?.engineeringBaselineId,
  trace,
}, null, 2));
