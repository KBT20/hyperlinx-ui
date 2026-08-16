import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DIRS, loadRecord, withRepositoryAuthority } from "../server/routes/_shared.js";

const baseUrl = process.env.CIP063_BASE_URL ?? "http://127.0.0.1:3001";
const password = (await readFile(process.env.CIP063_DEMO_CREDENTIAL_FILE ?? "/home/ubuntu/.hyperlinx-demo-credential", "utf8")).trim();
const proposalId = "PROPOSAL-DEMO-CIP062-NORTHSTAR";
const packageId = `DRAFT-IOF-${proposalId}`;
const engineeringPackageId = `ENG-PKG-${packageId}`;
const certifiedPackageId = `CERT-IOF-${packageId}`;
const serviceOrderId = `SO-${proposalId}-R001`;
const scopeVersionId = `ScopeVersion-0001-${certifiedPackageId}`;
const expectedRevisionId = `${proposalId}-revision-3`;
const expectedProposalHash = "0b6ad2866098cc520cc1c92d34c5fd089a79735c17a58cef4a0ff5a34b7eaf5f";

async function request(pathname, { cookie = "", persona = "ENGINEERING" } = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, { headers: {
    ...(cookie ? { Cookie: cookie } : {}),
    "X-Hyperlinx-Demo-Persona": persona,
    "X-Hyperlinx-Demo-Customer-Organization": "org-demo-customer-a",
  } });
  const body = await response.json();
  if (!response.ok) throw new Error(`${pathname} (${response.status}): ${body.error ?? JSON.stringify(body)}`);
  return body;
}

const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username: "demo", password }),
});
assert.equal(loginResponse.status, 200);
const login = await loginResponse.json();
const cookie = String(loginResponse.headers.get("set-cookie") ?? "").split(";")[0];
assert.equal(login.user.principalId, "demo-principal");

const proposal = (await request(`/api/proposals/${proposalId}`, { cookie, persona: "SALES" })).proposal;
const engineeringPackage = (await request(`/api/engineering/packages/${engineeringPackageId}`, { cookie })).engineeringPackage;
const approvalStatus = await request(`/api/engineering/approvals?engineeringPackageId=${encodeURIComponent(engineeringPackageId)}`, { cookie });
const certified = (await request(`/api/engineering/certification/certified-packages/${certifiedPackageId}`, { cookie })).certifiedIofPackage;
const serviceOrder = (await request(`/api/service-orders/${serviceOrderId}`, { cookie, persona: "SALES" })).serviceOrder;
const scopeVersion = (await request(`/api/scopeversions/${scopeVersionId}`, { cookie, persona: "EXECUTIVE" })).scopeVersion;
const customerProject = (await request("/api/customer-portal/projects", { cookie, persona: "CUSTOMER_AUTHORIZED_SIGNER" })).projects
  .find((project) => project.projectId === "OPPORTUNITY-DEMO-CIP062-NORTHSTAR");
const twin = await request(`/api/twin/state?scopeVersionId=${encodeURIComponent(scopeVersionId)}`, { cookie, persona: "EXECUTIVE" });

assert.equal(proposal.proposalRevisionId, expectedRevisionId);
assert.equal(proposal.proposalHash, expectedProposalHash);
assert.equal(engineeringPackage.proposalRevisionId, expectedRevisionId);
assert.equal(engineeringPackage.proposalHash, expectedProposalHash);
assert.equal(engineeringPackage.referenceIntegrity.ok, true);
assert.equal(approvalStatus.currentEngineeringApproval.decision, "APPROVED");
assert.equal(certified.status, "CERTIFIED");
assert.equal(serviceOrder.status, "COUNTERSIGNED");
assert.equal(serviceOrder.signatureStatus, "FULLY_SIGNED");
assert.equal(serviceOrder.scopeVersionId, scopeVersionId);
assert.ok(serviceOrder.customerSignatureId);
assert.ok(serviceOrder.countersignatureId);
assert.ok(serviceOrder.commercialAuthorizationTransactionId);
assert.equal(scopeVersion.certifiedIofPackageId ?? scopeVersion.canonicalTruth?.certifiedIofPackageId, certifiedPackageId);
assert.equal(scopeVersion.serviceOrderId ?? scopeVersion.canonicalTruth?.serviceOrderId, serviceOrderId);
assert.equal(scopeVersion.canonicalTruth?.customerSignatureId, serviceOrder.customerSignatureId);
assert.equal(scopeVersion.canonicalTruth?.closureLedgerId, engineeringPackage.closureLedgerId);
assert.equal(scopeVersion.canonicalTruth?.iofPackageTwinId, engineeringPackage.iofPackageTwinId);
assert.equal(scopeVersion.canonicalTruth?.executionGraphId, engineeringPackage.executionGraphId);
assert.equal(scopeVersion.canonicalTruth?.lifecycleGraphId, engineeringPackage.lifecycleGraphId);
assert.equal(customerProject.status, "AUTHORIZED");
assert.equal(customerProject.scopeVersion.scopeVersionId, scopeVersionId);
assert.equal(twin.scopeVersionId, scopeVersionId);
const persistedRecords = await withRepositoryAuthority({
  principalId: "demo-principal", organizationId: "org-demo", authorityClass: "DEMO", permissions: ["demo.tenant"],
}, async () => Promise.all([
  loadRecord(DIRS.engineeringPackages, engineeringPackageId),
  loadRecord(DIRS.engineeringApprovals, approvalStatus.currentEngineeringApproval.approvalId),
  loadRecord(DIRS.certifiedIofPackages, certifiedPackageId),
  loadRecord(DIRS.serviceOrders, serviceOrderId),
  loadRecord(DIRS.scopeVersions, scopeVersionId),
]));
for (const record of persistedRecords) {
  assert.equal(record.environment, "DEMO");
  assert.equal(record.organizationId, "org-demo");
  assert.equal(record.productionEligible, false);
}

console.log(JSON.stringify({
  result: "PASS_AFTER_RESTART",
  proposalRevisionId: proposal.proposalRevisionId,
  proposalHash: proposal.proposalHash,
  engineeringPackageId,
  engineeringApprovalId: approvalStatus.currentEngineeringApproval.approvalId,
  certifiedPackageId,
  serviceOrderId,
  customerSignatureId: serviceOrder.customerSignatureId,
  countersignatureId: serviceOrder.countersignatureId,
  scopeVersionId,
  authorizedTwinStateId: serviceOrder.authorizedTwinStateId,
  customerPortalStatus: customerProject.status,
  twinProjectionSource: twin.projectionSource,
  constitutionalReferences: {
    closureLedgerId: scopeVersion.canonicalTruth.closureLedgerId,
    iofPackageTwinId: scopeVersion.canonicalTruth.iofPackageTwinId,
    executionGraphId: scopeVersion.canonicalTruth.executionGraphId,
    lifecycleGraphId: scopeVersion.canonicalTruth.lifecycleGraphId,
    commercialAuditStatus: scopeVersion.canonicalTruth.commercialAuditStatus,
    constitutionalStateValidationStatus: scopeVersion.canonicalTruth.constitutionalStateValidationStatus,
  },
  environment: persistedRecords.at(-1).environment,
  organizationId: persistedRecords.at(-1).organizationId,
  productionEligible: persistedRecords.at(-1).productionEligible,
}, null, 2));
