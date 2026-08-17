import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const baseUrl = process.env.CIP067_BASE_URL ?? "http://127.0.0.1:3001";
const password = (await readFile(process.env.CIP067_DEMO_CREDENTIAL_FILE ?? "/home/ubuntu/.hyperlinx-demo-credential", "utf8")).trim();
const opportunityId = "OPPORTUNITY-DEMO-CIP067-NORTHSTAR-PERSISTENCE";
const proposalId = "PROPOSAL-DEMO-CIP067-NORTHSTAR-PERSISTENCE";
const packageId = `DRAFT-IOF-${proposalId}`;
const engineeringPackageId = `ENG-PKG-${packageId}`;
const accountId = "ACCOUNT-DEMO-NORTHSTAR";
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

function stop(result, predicate, context = {}) {
  console.log(JSON.stringify({ result, predicate, opportunityId, proposalId, packageId, productionEligible: false, resetPerformed: false, chicagoAccess: "ZERO", ...context, trace }, null, 2));
  process.exit(0);
}

const login = await call("Existing Demo principal login", "/api/auth/login", {
  method: "POST", body: { username: "demo", password }, persona: "SALES",
});
const cookie = login.cookie;
assert.equal(login.value.user.principalId, "demo-principal");
assert.equal(login.value.user.organizationId, "org-demo");

const opportunityBefore = (await call("Reload exact persisted Opportunity", `/api/commercial/opportunities/${opportunityId}`, { cookie, persona: "SALES" })).value.opportunity;
assert.equal(opportunityBefore.organizationId, "org-demo");
assert.equal(opportunityBefore.productionEligible, false);
assert.deepEqual(opportunityBefore.commercialWorkingState.civilMixCalibration, { plowPercent: 82, dirtPercent: 12, rockPercent: 0, trenchPercent: 6 });
const expectedOpportunityStateVersion = opportunityBefore.commercialStateVersion;
const expectedOpportunityStateHash = opportunityBefore.commercialStateHash;

const proposal = (await call("Reload exact accepted Proposal R2", `/api/proposals/${proposalId}`, { cookie, persona: "SALES" })).value.proposal;
assert.equal(proposal.approvalState, "APPROVED");
assert.equal(proposal.opportunityId, opportunityId);
const exactRevision = proposal.proposalRevisions.find((revision) => revision.proposalRevisionId === proposal.proposalRevisionId);
assert.equal(exactRevision.proposalHash, proposal.proposalHash);
assert.equal(exactRevision.revisionNumber, 2);
assert.equal(exactRevision.snapshot.opportunityStateVersion, proposal.opportunityStateVersion);
assert.equal(exactRevision.snapshot.opportunityStateHash, proposal.opportunityStateHash);
assert.ok(expectedOpportunityStateVersion >= proposal.opportunityStateVersion);

await call("Direct human ScopeVersion creation remains prohibited", "/api/scopeversions", {
  method: "POST", cookie, persona: "EXECUTIVE", body: { opportunityId }, expected: [403],
});

const assembly = await call("Assemble or resolve exact accepted Draft IOF", "/api/engineering/certification/draft-packages/from-proposal", {
  method: "POST", cookie, persona: "ENGINEERING", body: { proposalId, packageId }, expected: [200, 201, 409],
});
if (!assembly.value.draftPackage && !assembly.value.iofPackage) {
  stop("STOPPED_AT_GENUINE_DRAFT_IOF_PREDICATE", assembly.value);
}
const draft = assembly.value.draftPackage ?? assembly.value.iofPackage;
assert.equal(draft.opportunityId, opportunityId);
assert.equal(draft.proposalRevisionId, proposal.proposalRevisionId);
assert.equal(draft.proposalHash, proposal.proposalHash);

const handoffResult = await call("Commercial submits exact accepted package to Engineering", `/api/commercial/iof-packages/${packageId}/submit-engineering`, {
  method: "POST", body: {}, cookie, persona: "SALES", expected: [200, 409],
});
if (!handoffResult.value.engineeringPackage) {
  stop("STOPPED_AT_GENUINE_ENGINEERING_HANDOFF_PREDICATE", handoffResult.value);
}
const engineeringPackage = handoffResult.value.engineeringPackage;
assert.equal(engineeringPackage.engineeringPackageId, engineeringPackageId);
assert.equal(engineeringPackage.opportunityId, opportunityId);
assert.equal(engineeringPackage.proposalRevisionId, proposal.proposalRevisionId);
assert.equal(engineeringPackage.proposalHash, proposal.proposalHash);
assert.equal(engineeringPackage.referenceIntegrity?.ok, true);

let approvalStatus = (await call("Read exact Engineering review and approval eligibility", `/api/engineering/approvals?engineeringPackageId=${encodeURIComponent(engineeringPackageId)}`, {
  cookie, persona: "ENGINEERING",
})).value;
let eligibility = approvalStatus.approvalEligibility;
if (!eligibility.approvalEligible) {
  const blockerCodes = eligibility.blockers.map((blocker) => blocker.code);
  if (blockerCodes.length !== 1 || blockerCodes[0] !== "ENGINEERING_BUDGET_APPROVAL") {
    stop("STOPPED_AT_GENUINE_ENGINEERING_REVIEW_PREDICATE", eligibility, { engineeringPackageId });
  }
  await call("Engineering approves unchanged Commercial baseline budget", "/api/engineering/change-sets", {
    method: "POST", cookie, persona: "ENGINEERING", body: { engineeringChangeSet: {
      changeSetId: `ENGINEERING-CHANGE-SET-${eligibility.engineeringRevisionId}-BUDGET-APPROVAL`,
      revisionId: eligibility.engineeringRevisionId,
      engineeringBaselineId: engineeringPackage.engineeringBaselineId,
      engineeringPackageId,
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
  approvalStatus = (await call("Recompute Engineering approval eligibility", `/api/engineering/approvals?engineeringPackageId=${encodeURIComponent(engineeringPackageId)}`, {
    cookie, persona: "ENGINEERING",
  })).value;
  eligibility = approvalStatus.approvalEligibility;
}
if (!eligibility.approvalEligible || !eligibility.reviewComplete) {
  stop("STOPPED_AT_GENUINE_ENGINEERING_REVIEW_PREDICATE", eligibility, { engineeringPackageId });
}

await call("Stale Engineering revision approval rejected", "/api/engineering/approvals", {
  method: "POST", cookie, persona: "ENGINEERING", expected: [409], body: {
    engineeringPackageId,
    engineeringRevisionId: eligibility.engineeringRevisionId,
    engineeringRevisionHash: "STALE-ENGINEERING-REVISION-HASH",
    reviewSummaryHash: eligibility.reviewSummaryHash,
    organizationId: eligibility.organizationId,
    tenantId: eligibility.tenantId,
    customerId: eligibility.customerId,
    opportunityId,
  },
});
const approval = approvalStatus.currentEngineeringApproval ?? (await call("Engineering approves exact active revision", "/api/engineering/approvals", {
  method: "POST", cookie, persona: "ENGINEERING", body: {
    engineeringPackageId,
    engineeringRevisionId: eligibility.engineeringRevisionId,
    engineeringRevisionHash: eligibility.engineeringRevisionHash,
    reviewSummaryHash: eligibility.reviewSummaryHash,
    organizationId: eligibility.organizationId,
    tenantId: eligibility.tenantId,
    customerId: eligibility.customerId,
    opportunityId,
  },
})).value.engineeringApproval;

const checklist = Object.fromEntries([
  "geometryComplete", "existingInventoryValidated", "customerDesignReviewed", "relationshipsValidated",
  "dependenciesValidated", "evidencePresent", "commercialAssumptionsReviewed", "unitQuantitiesVerified",
  "engineeringStandardsMet", "riskAccepted", "packageComplete",
].map((key) => [key, true]));
checklist.certificationConfidence = 100;
const certifiedList = (await call("Resolve existing exact certification", "/api/engineering/certification/certified-packages", { cookie, persona: "ENGINEERING" })).value.certifiedIofPackages ?? [];
let certified = certifiedList.find((item) => item.sourcePackageId === packageId || item.sourceDraftPackageId === packageId || item.draftIOFPackageId === packageId);
let certificationAttempt;
if (!certified) {
  certificationAttempt = await call("Engineering certifies exact approved revision", `/api/engineering/certification/draft-packages/${packageId}/certify`, {
    method: "POST", cookie, persona: "ENGINEERING", expected: [200, 409], body: {
      checklist,
      engineeringApprovalId: approval.approvalId,
      engineeringApprovedObjectBudget: {
        budgetId: `ENG-BUDGET-${packageId}`,
        allObjectsConfirmed: true,
        totalApprovedBudget: Number(proposal.pricingSummary?.budgetCost ?? proposal.pricingSummary?.constructionCost ?? 0),
        objectBudgets: [],
      },
    },
  });
  certified = certificationAttempt.value.certifiedIofPackage;
}
if (!certified) {
  stop("STOPPED_AT_GENUINE_CERTIFICATION_PREDICATE", certificationAttempt?.value, { engineeringPackageId, engineeringApprovalId: approval.approvalId });
}
assert.equal(certified.opportunityId, opportunityId);

const serviceOrders = (await call("Resolve existing exact Service Order", "/api/service-orders", { cookie, persona: "SALES" })).value.serviceOrders ?? [];
let serviceOrder = serviceOrders.find((item) => item.certifiedPackageId === certified.certifiedPackageId || item.certifiedIofPackageId === certified.certifiedPackageId);
if (!serviceOrder) {
  serviceOrder = (await call("Commercial creates exact Service Order", "/api/service-orders", {
    method: "POST", cookie, persona: "SALES", body: { proposalId, certifiedPackageId: certified.certifiedPackageId },
  })).value.serviceOrder;
}
if (!serviceOrder.issuedAt) {
  serviceOrder = (await call("Commercial issues exact Service Order", `/api/service-orders/${serviceOrder.serviceOrderId}/issue`, {
    method: "POST", cookie, persona: "SALES", body: {},
  })).value.serviceOrder;
}
assert.equal(serviceOrder.opportunityId, opportunityId);

const customerView = (await call("Customer View resolves issued Service Order", "/api/customer-portal/projects", { cookie, persona: "CUSTOMER_AUTHORIZED_SIGNER" })).value.projects.find((project) => project.projectId === opportunityId);
assert.equal(customerView.serviceOrder.serviceOrderId, serviceOrder.serviceOrderId);
await call("Wrong Service Order document hash rejected", `/api/customer-portal/projects/${opportunityId}/service-order/sign`, {
  method: "POST", cookie, persona: "CUSTOMER_AUTHORIZED_SIGNER", expected: [409], body: {
    serviceOrderId: serviceOrder.serviceOrderId, documentHash: "WRONG", typedName: "Demo Customer Signer", authorityAcknowledged: true,
  },
});
const customerSignature = (await call("Independent Demo customer authority signs exact Service Order", `/api/customer-portal/projects/${opportunityId}/service-order/sign`, {
  method: "POST", cookie, persona: "CUSTOMER_AUTHORIZED_SIGNER", body: {
    serviceOrderId: serviceOrder.serviceOrderId, documentHash: serviceOrder.documentHash, typedName: "Demo Customer Signer", authorityAcknowledged: true,
  },
})).value;
const countersigned = (await call("Demo Executive countersigns and system creates ScopeVersion atomically", `/api/service-orders/${serviceOrder.serviceOrderId}/countersign`, {
  method: "POST", cookie, persona: "EXECUTIVE", body: { documentHash: serviceOrder.documentHash, authorizationAcknowledged: true },
})).value;
assert.ok(countersigned.scopeVersion?.scopeVersionId);
assert.equal(countersigned.scopeVersion.opportunityId, opportunityId);

const opportunityAfter = (await call("Reopen Opportunity after ScopeVersion", `/api/commercial/opportunities/${opportunityId}/open`, { method: "POST", cookie, persona: "SALES" })).value.opportunity;
assert.equal(opportunityAfter.commercialStateVersion, expectedOpportunityStateVersion);
assert.equal(opportunityAfter.commercialStateHash, expectedOpportunityStateHash);
assert.deepEqual(opportunityAfter.commercialWorkingState.civilMixCalibration, { plowPercent: 82, dirtPercent: 12, rockPercent: 0, trenchPercent: 6 });
const twin = (await call("Reload Account Customer Twin after authorization", `/api/accounts/${accountId}/customer-twin`, { cookie, persona: "SALES" })).value.customerTwin;
const deal = twin.deals.find((item) => item.opportunityId === opportunityId);
assert.equal(deal.currentState, "AUTHORIZED");
assert.equal(deal.scopeVersion.scopeVersionId, countersigned.scopeVersion.scopeVersionId);

console.log(JSON.stringify({
  result: "PASS_TO_SCOPEVERSION",
  opportunityId,
  opportunityStateVersion: expectedOpportunityStateVersion,
  opportunityStateHash: expectedOpportunityStateHash,
  proposalId,
  proposalRevisionId: proposal.proposalRevisionId,
  proposalHash: proposal.proposalHash,
  packageId,
  engineeringPackageId,
  engineeringApprovalId: approval.approvalId,
  certifiedIofPackageId: certified.certifiedPackageId,
  serviceOrderId: serviceOrder.serviceOrderId,
  customerSignatureId: customerSignature.customerSignature?.customerSignatureId ?? customerSignature.action?.actionId,
  scopeVersionId: countersigned.scopeVersion.scopeVersionId,
  customerTwinState: deal.currentState,
  civilMix: opportunityAfter.commercialWorkingState.civilMixCalibration,
  productionEligible: false,
  resetPerformed: false,
  chicagoAccess: "ZERO",
  trace,
}, null, 2));
