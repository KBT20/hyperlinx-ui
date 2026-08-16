import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const baseUrl = process.env.CIP063_BASE_URL ?? "http://127.0.0.1:3001";
const password = (await readFile(process.env.CIP063_DEMO_CREDENTIAL_FILE ?? "/home/ubuntu/.hyperlinx-demo-credential", "utf8")).trim();
const packageId = "DRAFT-IOF-PROPOSAL-DEMO-CIP062-NORTHSTAR";
const proposalId = "PROPOSAL-DEMO-CIP062-NORTHSTAR";
const expectedRevisionId = "PROPOSAL-DEMO-CIP062-NORTHSTAR-revision-3";
const expectedProposalHash = "0b6ad2866098cc520cc1c92d34c5fd089a79735c17a58cef4a0ff5a34b7eaf5f";
const trace = [];

async function call(step, pathname, { method = "GET", body, cookie = "", persona = "ENGINEERING", expected = [200, 201] } = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(cookie ? { Cookie: cookie } : {}),
      "X-Hyperlinx-Demo-Persona": persona,
      "X-Hyperlinx-Demo-Customer-Organization": "org-demo-customer-a",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const raw = await response.text();
  let value;
  try { value = raw ? JSON.parse(raw) : {}; } catch { value = { raw }; }
  trace.push({ step, status: response.status, error: value.error, code: value.code, predicate: value.predicate });
  if (!expected.includes(response.status)) throw Object.assign(new Error(`${step} (${response.status}): ${value.error ?? raw}`), { value, trace });
  return { value, cookie: String(response.headers.get("set-cookie") ?? "").split(";")[0] };
}

const login = await call("Existing Demo principal login", "/api/auth/login", {
  method: "POST", body: { username: "demo", password }, persona: "SALES",
});
const cookie = login.cookie;
assert.equal(login.value.user.principalId, "demo-principal");
assert.equal(login.value.user.organizationId, "org-demo");

const proposal = (await call("Reload immutable Northstar R3", `/api/proposals/${proposalId}`, { cookie, persona: "SALES" })).value.proposal;
assert.equal(proposal.proposalRevisionId, expectedRevisionId);
assert.equal(proposal.proposalHash, expectedProposalHash);
const exactR3 = proposal.proposalRevisions.find((revision) => revision.proposalRevisionId === expectedRevisionId);
assert.equal(exactR3.proposalHash, expectedProposalHash);

const handoff = (await call("Resume same R3 Commercial handoff", `/api/commercial/iof-packages/${packageId}/submit-engineering`, {
  method: "POST", body: {}, cookie, persona: "SALES",
})).value;
const engineeringPackage = handoff.engineeringPackage;
assert.ok(engineeringPackage?.engineeringPackageId);
assert.equal(engineeringPackage.proposalRevisionId, expectedRevisionId);
assert.equal(engineeringPackage.proposalHash, expectedProposalHash);
assert.equal(engineeringPackage.referenceIntegrity?.ok, true);
for (const key of ["closureLedger", "iofPackageTwin", "executionGraph", "lifecycleGraph", "commercialAudit", "constitutionalState"]) {
  assert.equal(engineeringPackage.referenceIntegrity.checks[key], true, `${key} must resolve through its governed producer`);
}

const approvalStatus = (await call("Read Engineering review and approval eligibility", `/api/engineering/approvals?engineeringPackageId=${encodeURIComponent(engineeringPackage.engineeringPackageId)}`, {
  cookie, persona: "ENGINEERING",
})).value;

console.log(JSON.stringify({
  result: approvalStatus.approvalEligibility?.approvalEligible ? "READY_FOR_ENGINEERING_APPROVAL" : "STOPPED_AT_ENGINEERING_REVIEW_PREDICATE",
  packageId,
  proposalRevisionId: engineeringPackage.proposalRevisionId,
  proposalHash: engineeringPackage.proposalHash,
  engineeringPackageId: engineeringPackage.engineeringPackageId,
  constitutionalReferences: {
    closureLedgerId: engineeringPackage.closureLedgerId,
    iofPackageTwinId: engineeringPackage.iofPackageTwinId,
    executionGraphId: engineeringPackage.executionGraphId,
    lifecycleGraphId: engineeringPackage.lifecycleGraphId,
    commercialAuditStatus: engineeringPackage.commercialAuditStatus,
    constitutionalStateValidationStatus: engineeringPackage.constitutionalStateValidationStatus,
  },
  approvalEligibility: approvalStatus.approvalEligibility,
  currentEngineeringApproval: approvalStatus.currentEngineeringApproval ?? null,
  productionEligible: false,
  resetPerformed: false,
  trace,
}, null, 2));
