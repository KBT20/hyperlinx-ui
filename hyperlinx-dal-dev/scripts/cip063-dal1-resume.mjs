import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const baseUrl = process.env.CIP063_BASE_URL ?? "http://127.0.0.1:3001";
const password = (await readFile(process.env.CIP063_DEMO_CREDENTIAL_FILE ?? "/home/ubuntu/.hyperlinx-demo-credential", "utf8")).trim();
const packageId = "DRAFT-IOF-PROPOSAL-DEMO-CIP062-NORTHSTAR";
const proposalId = "PROPOSAL-DEMO-CIP062-NORTHSTAR";
const opportunityId = "OPPORTUNITY-DEMO-CIP062-NORTHSTAR";
const engineeringPackageId = `ENG-PKG-${packageId}`;
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

const existingEngineering = await call("Resolve existing R3 Engineering Package", `/api/engineering/packages/${engineeringPackageId}`, {
  cookie, persona: "ENGINEERING", expected: [200, 404],
});
const engineeringPackage = existingEngineering.value.engineeringPackage ?? (await call(
  "Resume same R3 Commercial handoff",
  `/api/commercial/iof-packages/${packageId}/submit-engineering`,
  { method: "POST", body: {}, cookie, persona: "SALES" },
)).value.engineeringPackage;
assert.ok(engineeringPackage?.engineeringPackageId);
assert.equal(engineeringPackage.proposalRevisionId, expectedRevisionId);
assert.equal(engineeringPackage.proposalHash, expectedProposalHash);
assert.equal(engineeringPackage.referenceIntegrity?.ok, true);
for (const key of ["closureLedger", "iofPackageTwin", "executionGraph", "lifecycleGraph", "commercialAudit", "constitutionalState"]) {
  assert.equal(engineeringPackage.referenceIntegrity.checks[key], true, `${key} must resolve through its governed producer`);
}

let approvalStatus = (await call("Read Engineering review and approval eligibility", `/api/engineering/approvals?engineeringPackageId=${encodeURIComponent(engineeringPackage.engineeringPackageId)}`, {
  cookie, persona: "ENGINEERING",
})).value;

let eligibility = approvalStatus.approvalEligibility;
if (!eligibility.approvalEligible) {
  assert.deepEqual(eligibility.blockers.map((blocker) => blocker.code), ["ENGINEERING_BUDGET_APPROVAL"]);
  await call("Engineering approves unchanged Commercial baseline budget", "/api/engineering/change-sets", {
    method: "POST", cookie, persona: "ENGINEERING", body: { engineeringChangeSet: {
      changeSetId: `ENGINEERING-CHANGE-SET-${eligibility.engineeringRevisionId}-BUDGET-APPROVAL`,
      revisionId: eligibility.engineeringRevisionId,
      engineeringBaselineId: engineeringPackage.engineeringBaselineId,
      engineeringPackageId: engineeringPackage.engineeringPackageId,
      draftIOFPackageId: packageId,
      opportunityId,
      routeRepositoryId: engineeringPackage.routeRepositoryId,
      proposalId,
      estimateId: engineeringPackage.estimateId,
      workbookId: engineeringPackage.workbookId,
      baselineHash: engineeringPackage.engineeringBaselineHash,
      status: "ACTIVE",
      patches: [{
        patchId: `ENG-PATCH-${eligibility.engineeringRevisionId}-BUDGET-APPROVAL`,
        patchType: "CHANGE_REVIEW_STATUS",
        targetObjectId: `ENG-BUDGET-${packageId}`,
        targetProperty: "engineeringApprovedBudget.status",
        oldValue: "PENDING",
        newValue: "APPROVED",
        reason: "Engineering reviewed and approved the unchanged Commercial baseline budget.",
      }],
    } },
  });
  approvalStatus = (await call("Recompute Engineering approval eligibility", `/api/engineering/approvals?engineeringPackageId=${encodeURIComponent(engineeringPackage.engineeringPackageId)}`, {
    cookie, persona: "ENGINEERING",
  })).value;
  eligibility = approvalStatus.approvalEligibility;
}
assert.equal(eligibility.approvalEligible, true);
assert.equal(eligibility.reviewComplete, true);

await call("Stale Engineering revision approval rejected", "/api/engineering/approvals", {
  method: "POST", cookie, persona: "ENGINEERING", expected: [409], body: {
    engineeringPackageId: eligibility.engineeringPackageId,
    engineeringRevisionId: eligibility.engineeringRevisionId,
    engineeringRevisionHash: "STALE-ENGINEERING-REVISION-HASH",
    reviewSummaryHash: eligibility.reviewSummaryHash,
    organizationId: eligibility.organizationId,
    tenantId: eligibility.tenantId,
    customerId: eligibility.customerId,
    opportunityId: eligibility.opportunityId,
  },
});

const approval = approvalStatus.currentEngineeringApproval ?? (await call("Kyle Engineering authority approves exact revision", "/api/engineering/approvals", {
  method: "POST", cookie, persona: "ENGINEERING", body: {
    engineeringPackageId: eligibility.engineeringPackageId,
    engineeringRevisionId: eligibility.engineeringRevisionId,
    engineeringRevisionHash: eligibility.engineeringRevisionHash,
    reviewSummaryHash: eligibility.reviewSummaryHash,
    organizationId: eligibility.organizationId,
    tenantId: eligibility.tenantId,
    customerId: eligibility.customerId,
    opportunityId: eligibility.opportunityId,
  },
})).value.engineeringApproval;
assert.equal(approval.engineeringRevisionId, eligibility.engineeringRevisionId);
assert.equal(approval.engineeringRevisionHash, eligibility.engineeringRevisionHash);

const checklist = Object.fromEntries([
  "geometryComplete", "existingInventoryValidated", "customerDesignReviewed", "relationshipsValidated",
  "dependenciesValidated", "evidencePresent", "commercialAssumptionsReviewed", "unitQuantitiesVerified",
  "engineeringStandardsMet", "riskAccepted", "packageComplete",
].map((key) => [key, true]));
checklist.certificationConfidence = 100;
const certifiedList = (await call("Resolve existing certification for exact R3 Draft", "/api/engineering/certification/certified-packages", {
  cookie, persona: "ENGINEERING",
})).value.certifiedIofPackages ?? [];
let certified = certifiedList.find((item) => (
  item.sourcePackageId === packageId || item.sourceDraftPackageId === packageId || item.draftIOFPackageId === packageId
));
let certificationAttempt = null;
if (!certified) {
  certificationAttempt = await call("Kyle certifies exact approved Engineering Revision", `/api/engineering/certification/draft-packages/${packageId}/certify`, {
    method: "POST", cookie, persona: "ENGINEERING", expected: [200, 409], body: {
      checklist,
      engineeringApprovalId: approval.approvalId,
      engineeringApprovedObjectBudget: {
        budgetId: `ENG-BUDGET-${packageId}`,
        allObjectsConfirmed: true,
        totalApprovedBudget: Number(proposal.pricingSummary?.budgetCost ?? 0),
        objectBudgets: [],
      },
    },
  });
  certified = certificationAttempt.value.certifiedIofPackage;
}
if (!certified) {
  console.log(JSON.stringify({
    result: "STOPPED_AT_GENUINE_CERTIFICATION_PREDICATE",
    packageId, proposalRevisionId: expectedRevisionId, proposalHash: expectedProposalHash,
    engineeringPackageId: engineeringPackage.engineeringPackageId,
    engineeringApprovalId: approval.approvalId,
    predicate: certificationAttempt?.value,
    productionEligible: false, resetPerformed: false, trace,
  }, null, 2));
  process.exit(0);
}
const serviceOrderList = (await call("Resolve existing exact Service Order", "/api/service-orders", {
  cookie, persona: "SALES",
})).value.serviceOrders ?? [];
let issuedServiceOrder = serviceOrderList.find((item) => item.certifiedPackageId === certified.certifiedPackageId || item.certifiedIofPackageId === certified.certifiedPackageId);
if (!issuedServiceOrder) {
  issuedServiceOrder = (await call("Commercial creates exact Service Order", "/api/service-orders", {
    method: "POST", cookie, persona: "SALES", body: { proposalId, certifiedPackageId: certified.certifiedPackageId },
  })).value.serviceOrder;
}
if (!issuedServiceOrder.issuedAt) {
  issuedServiceOrder = (await call("Commercial issues exact Service Order", `/api/service-orders/${issuedServiceOrder.serviceOrderId}/issue`, {
    method: "POST", cookie, persona: "SALES", body: {},
  })).value.serviceOrder;
}

const customerView = (await call("Customer View loads issued Service Order", "/api/customer-portal/projects", {
  cookie, persona: "CUSTOMER_AUTHORIZED_SIGNER",
})).value.projects.find((project) => project.projectId === opportunityId);
assert.equal(customerView.serviceOrder.serviceOrderId, issuedServiceOrder.serviceOrderId);
assert.equal(customerView.serviceOrder.documentHash, issuedServiceOrder.documentHash);

await call("Customer signature with wrong document hash rejected", `/api/customer-portal/projects/${opportunityId}/service-order/sign`, {
  method: "POST", cookie, persona: "CUSTOMER_AUTHORIZED_SIGNER", expected: [409], body: {
    serviceOrderId: issuedServiceOrder.serviceOrderId, documentHash: "WRONG", typedName: "Demo Customer Signer", authorityAcknowledged: true,
  },
});
const customerSignature = (await call("Independent Demo customer authority signs exact Service Order", `/api/customer-portal/projects/${opportunityId}/service-order/sign`, {
  method: "POST", cookie, persona: "CUSTOMER_AUTHORIZED_SIGNER", body: {
    serviceOrderId: issuedServiceOrder.serviceOrderId, documentHash: issuedServiceOrder.documentHash, typedName: "Demo Customer Signer", authorityAcknowledged: true,
  },
})).value;

const countersigned = (await call("Demo Executive countersigns atomically", `/api/service-orders/${issuedServiceOrder.serviceOrderId}/countersign`, {
  method: "POST", cookie, persona: "EXECUTIVE", body: { documentHash: issuedServiceOrder.documentHash, authorizationAcknowledged: true },
})).value;
assert.ok(countersigned.scopeVersion?.scopeVersionId);

console.log(JSON.stringify({
  result: "PASS_TO_SCOPEVERSION",
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
  approvalEligibility: eligibility,
  engineeringApprovalId: approval.approvalId,
  certifiedIofPackageId: certified.certifiedPackageId,
  serviceOrderId: issuedServiceOrder.serviceOrderId,
  customerSignatureId: customerSignature.customerSignature?.customerSignatureId ?? customerSignature.action?.actionId,
  scopeVersionId: countersigned.scopeVersion.scopeVersionId,
  productionEligible: false,
  resetPerformed: false,
  trace,
}, null, 2));
