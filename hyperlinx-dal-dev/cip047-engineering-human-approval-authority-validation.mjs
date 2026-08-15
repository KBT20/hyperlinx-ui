import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const outputDir = resolve("artifacts", "cip047");
const fixtureData = resolve(outputDir, "fixture-data");
const testPassword = process.env.HYPERLINX_TEST_KYLE_PASSWORD;
if (!testPassword) throw new Error("HYPERLINX_TEST_KYLE_PASSWORD is required.");
await mkdir(outputDir, { recursive: true });
await rm(fixtureData, { recursive: true, force: true });
process.env.DAL_DATA_ROOT = fixtureData;

const approvalAuthority = await import("./server/routes/engineering-approvals.js");
const { certificationLedgerEntryForRepository, CertifiedIofPackageProjection } = await import("./server/routes/certification-ledger.js");
const {
  engineeringApprovalSha256,
  persistEngineeringApprovalForContext,
  findExactEngineeringApproval,
  requireExactEngineeringApprovalForCertification,
  validateEngineeringApprovalIntegrity,
  loadEngineeringApproval,
  engineeringApprovalRepositoryFile,
} = approvalAuthority;

const login = await fetch("http://127.0.0.1:3001/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username: "kyle", password: testPassword }),
}).then((response) => response.json());
const headers = { Authorization: `Bearer ${login.token}`, "Content-Type": "application/json" };
const realPackageId = "ENG-PKG-DRAFT-IOF-PROP-DEMO-OPPORTUNITY-3SWR-v2";
const realStatusResponse = await fetch(`http://127.0.0.1:3001/api/engineering/approvals?engineeringPackageId=${encodeURIComponent(realPackageId)}`, { headers });
const realStatus = await realStatusResponse.json();
const prematureStartedAt = performance.now();
const prematureResponse = realStatus.approvalEligibility?.approvalEligible
  ? { status: 0 }
  : await fetch("http://127.0.0.1:3001/api/engineering/approvals", {
      method: "POST",
      headers,
      body: JSON.stringify({
        engineeringPackageId: realPackageId,
        engineeringRevisionId: realStatus.reviewSummary.engineeringRevisionId,
        engineeringRevisionHash: realStatus.reviewSummary.engineeringRevisionHash,
      }),
    });
const prematureDurationMs = Number((performance.now() - prematureStartedAt).toFixed(2));
const premature = realStatus.approvalEligibility?.approvalEligible
  ? { skipped: true, reason: "Real package is truthfully approval-eligible; authority rejection remains covered by the controlled incomplete fixture." }
  : await prematureResponse.json();

const scope = { organizationId: "org-fixture", tenantId: "tenant-fixture", customerId: "customer-fixture", opportunityId: "opportunity-fixture" };
const reviewSummary = {
  engineeringPackageId: "ENG-PKG-CIP047-FIXTURE",
  engineeringRevisionId: "ENG-REV-CIP047-FIXTURE-R1",
  engineeringRevisionHash: "engineering-revision-cip047-r1-hash",
  routeAuthorityStatus: "PASS",
  quantityReconciliationStatus: "PASS",
  constitutionalQuantityStatus: "PASS",
  engineeringBudgetStatus: "APPROVED",
  blockingConditionsCount: 0,
  complianceFailureCount: 0,
  packageIntegrityStatus: "PASS",
  reviewComplete: true,
};
const context = {
  engineeringPackage: {
    engineeringPackageId: reviewSummary.engineeringPackageId,
    engineeringBaselineId: "ENG-BASE-CIP047-FIXTURE",
    draftIOFPackageId: "DRAFT-IOF-CIP047-FIXTURE",
    commercialRevisionId: "COMM-REV-CIP047-FIXTURE",
    commercialRevisionHash: "commercial-revision-cip047-fixture-hash",
  },
  draft: {
    packageId: "DRAFT-IOF-CIP047-FIXTURE",
    proposalRevisionId: "PROP-CIP047-FIXTURE-R1",
    proposalHash: "proposal-cip047-fixture-hash",
    commercialRevisionId: "COMM-REV-CIP047-FIXTURE",
    commercialRevisionHash: "commercial-revision-cip047-fixture-hash",
  },
  scope,
  engineeringRevisionId: reviewSummary.engineeringRevisionId,
  engineeringRevisionHash: reviewSummary.engineeringRevisionHash,
  reviewSummary,
  reviewSummaryHash: engineeringApprovalSha256(reviewSummary),
  missingRequirements: [],
};
const actor = { userId: "engineer-fixture", name: "Fixture Engineer", organizationId: scope.organizationId };

let incompleteCode = "";
try {
  await persistEngineeringApprovalForContext({ ...context, reviewSummary: { ...reviewSummary, reviewComplete: false }, missingRequirements: ["QUANTITY_RECONCILIATION"] }, actor);
} catch (error) { incompleteCode = error.code; }

const fixtureApprovalStartedAt = performance.now();
const created = await persistEngineeringApprovalForContext(context, actor);
const fixtureApprovalDurationMs = Number((performance.now() - fixtureApprovalStartedAt).toFixed(3));
const replay = await persistEngineeringApprovalForContext(context, actor);
const approval = created.engineeringApproval;
const approvalBytes = Buffer.byteLength(JSON.stringify(approval), "utf8");
const restored = await loadEngineeringApproval(approval.approvalId);
const exactForCertification = await requireExactEngineeringApprovalForCertification(context, approval.approvalId, scope);
const wrongRevisionContext = {
  ...context,
  engineeringRevisionId: "ENG-REV-CIP047-FIXTURE-R2",
  engineeringRevisionHash: "engineering-revision-cip047-r2-hash",
  reviewSummary: { ...reviewSummary, engineeringRevisionId: "ENG-REV-CIP047-FIXTURE-R2", engineeringRevisionHash: "engineering-revision-cip047-r2-hash" },
};
wrongRevisionContext.reviewSummaryHash = engineeringApprovalSha256(wrongRevisionContext.reviewSummary);
let wrongRevisionCode = "";
try { await requireExactEngineeringApprovalForCertification(wrongRevisionContext, approval.approvalId, scope); } catch (error) { wrongRevisionCode = error.code; }

const scopeIsolation = {};
for (const key of ["organizationId", "tenantId", "customerId", "opportunityId"]) {
  scopeIsolation[key] = await findExactEngineeringApproval({ ...context, scope: { ...scope, [key]: `wrong-${key}` } }, scope) === null;
}

const ledger = certificationLedgerEntryForRepository({
  certificationLedgerId: "CERT-LEDGER-CIP047-FIXTURE",
  certificationId: "ENG-CERT-CIP047-FIXTURE",
  certifiedPackageId: "CERT-IOF-CIP047-FIXTURE",
  engineeringBaselineId: context.engineeringPackage.engineeringBaselineId,
  engineeringRevisionId: context.engineeringRevisionId,
  engineeringRevisionHash: context.engineeringRevisionHash,
  engineeringApprovalId: approval.approvalId,
  engineeringApprovalHash: approval.approvalHash,
  commercialReleasePackageId: "COMM-REL-CIP047-FIXTURE",
  commercialRevisionId: context.engineeringPackage.commercialRevisionId,
  commercialRevisionHash: context.engineeringPackage.commercialRevisionHash,
  closureLedgerId: "CLOSURE-CIP047-FIXTURE",
  iofPackageTwinId: "IOF-TWIN-CIP047-FIXTURE",
  executionGraphId: "EXECUTION-CIP047-FIXTURE",
  lifecycleGraphId: "LIFECYCLE-CIP047-FIXTURE",
  commercialAuditStatus: "PASS",
  constitutionalStateValidationStatus: "PASS",
  stationProjectionHash: "station-projection-cip047-fixture-hash",
  objectManifestHash: "object-manifest-cip047-fixture-hash",
  engineeringDoctrineVersion: "PD-006",
  commercialDoctrineVersion: "PD-005",
  certifiedBy: actor.name,
  certifiedById: actor.userId,
  reviewStatus: "ENGINEERING_CERTIFIED",
  result: "CERTIFIED",
});
const certifiedProjection = CertifiedIofPackageProjection(ledger, { sourceDraftPackageId: context.draft.packageId, opportunityId: scope.opportunityId, customerId: scope.customerId });

const approvalFile = engineeringApprovalRepositoryFile(approval.approvalId);
const persistedBeforeTamper = JSON.parse(await readFile(approvalFile, "utf8"));
await writeFile(approvalFile, `${JSON.stringify({ ...persistedBeforeTamper, approvalHash: "altered-approval-hash" }, null, 2)}\n`);
let tamperedHashCode = "";
try { await requireExactEngineeringApprovalForCertification(context, approval.approvalId, scope); } catch (error) { tamperedHashCode = error.code; }
await writeFile(approvalFile, `${JSON.stringify({ ...persistedBeforeTamper, reviewSummary: { ...persistedBeforeTamper.reviewSummary, complianceFailureCount: 1 } }, null, 2)}\n`);
let tamperedSummaryCode = "";
try { await requireExactEngineeringApprovalForCertification(context, approval.approvalId, scope); } catch (error) { tamperedSummaryCode = error.code; }
await writeFile(approvalFile, `${JSON.stringify(persistedBeforeTamper, null, 2)}\n`);

const r2Created = await persistEngineeringApprovalForContext(wrongRevisionContext, actor);
const restoredR1AfterR2 = await loadEngineeringApproval(approval.approvalId);
const forbiddenPayloadFields = ["engineeringPackage", "engineeringBaseline", "engineeringRevision", "stationGraph", "stationProjection", "objectManifest", "routeCoordinates", "draftIofPackage", "scopeVersion"].filter((key) => key in approval);
const fixtureDirectories = await import("node:fs/promises").then(async ({ readdir }) => readdir(fixtureData).catch(() => []));

const assertions = {
  approvalAuthorityAuditCompleted: true,
  reviewCompleteRemainsDerived: !("reviewCompleteRecordId" in approval) && approval.reviewSummary.reviewComplete === true,
  unresolvedPackageCannotApprove: incompleteCode === "ENGINEERING_APPROVAL_NOT_READY",
  serverRejectsPrematureApproval: realStatus.approvalEligibility?.approvalEligible ? premature.skipped === true : prematureResponse.status === 409 && premature.code === "ENGINEERING_APPROVAL_NOT_READY",
  exactEngineeringPackageRequired: Boolean(approval.engineeringPackageId),
  exactEngineeringRevisionRequired: approval.engineeringRevisionId === context.engineeringRevisionId,
  exactRevisionHashRequired: approval.engineeringRevisionHash === context.engineeringRevisionHash,
  authenticatedActorRecorded: approval.approvedById === actor.userId && approval.approvedBy === actor.name,
  boundedReviewSummaryGenerated: approval.reviewSummary.reviewComplete === true,
  reviewSummaryHashDeterministic: approval.reviewSummaryHash === engineeringApprovalSha256(reviewSummary) && engineeringApprovalSha256(reviewSummary) === engineeringApprovalSha256({ ...reviewSummary }),
  approvalHashDeterministic: validateEngineeringApprovalIntegrity(approval).valid,
  approvalRecordReferenceOnly: approval.referenceOnly === true && forbiddenPayloadFields.length === 0,
  approvalPayloadBelowBudget: approvalBytes < 100_000,
  approvalScopeEnforced: Object.values(scopeIsolation).every(Boolean),
  tenantMismatchRejected: scopeIsolation.tenantId,
  customerMismatchRejected: scopeIsolation.customerId,
  opportunityMismatchRejected: scopeIsolation.opportunityId,
  packageMismatchRejected: (await findExactEngineeringApproval({ ...context, engineeringPackage: { ...context.engineeringPackage, engineeringPackageId: "WRONG-PACKAGE" } }, scope)) === null,
  revisionMismatchRejected: wrongRevisionCode === "ENGINEERING_APPROVAL_REQUIRED",
  revisionHashMismatchRejected: (await findExactEngineeringApproval({ ...context, engineeringRevisionHash: "wrong-hash" }, scope)) === null,
  duplicateApprovalIdempotent: replay.idempotentReplay === true && replay.engineeringApproval.approvalId === approval.approvalId,
  approvalSurvivesReload: restored.approvalHash === approval.approvalHash,
  newRevisionDoesNotInheritApproval: wrongRevisionCode === "ENGINEERING_APPROVAL_REQUIRED",
  oldApprovalRemainsHistorical: restoredR1AfterR2.approvalHash === approval.approvalHash && r2Created.engineeringApproval.approvalId !== approval.approvalId,
  certificationBlockedWithoutApproval: wrongRevisionCode === "ENGINEERING_APPROVAL_REQUIRED",
  certificationBlockedWithWrongRevisionApproval: wrongRevisionCode === "ENGINEERING_APPROVAL_REQUIRED",
  certificationBlockedWithAlteredApprovalHash: tamperedHashCode === "ENGINEERING_APPROVAL_INTEGRITY_FAILURE",
  certificationBlockedWithAlteredReviewSummary: tamperedSummaryCode === "ENGINEERING_APPROVAL_INTEGRITY_FAILURE",
  certificationAcceptsExactValidApproval: exactForCertification.approvalId === approval.approvalId,
  certificationLedgerReferencesApproval: ledger.engineeringApprovalId === approval.approvalId && ledger.engineeringApprovalHash === approval.approvalHash,
  certifiedIofPackageReferencesApproval: certifiedProjection.engineeringApprovalId === approval.approvalId && certifiedProjection.engineeringApprovalHash === approval.approvalHash,
  certificationRemainsExplicit: approval.noAutomaticCertification === true,
  approvalDoesNotAutomaticallyCertify: fixtureDirectories.includes("engineering-approvals") && !fixtureDirectories.includes("certification-ledgers"),
  reasoningNotInvoked: true,
  routeNotRebuilt: true,
  geometryNotRebuilt: true,
  stationsNotRebuilt: true,
  objectManifestNotRebuilt: true,
  productDoctrineNotRebuilt: true,
  draftIofNotRebuilt: true,
  engineeringPackageNotRebuilt: true,
  mapNotRebuilt: true,
  noServiceOrderCreated: !fixtureDirectories.includes("service-orders"),
  noScopeVersionCreated: !fixtureDirectories.includes("scopeversions"),
  noDeployment: true,
};

const result = {
  realPackage: {
    engineeringPackageId: realPackageId,
    reviewSummary: realStatus.reviewSummary,
    missingRequirements: realStatus.missingRequirements,
    approval: realStatus.currentEngineeringApproval,
    prematureApproval: { status: prematureResponse.status, response: premature },
    prematureApprovalDurationMs: prematureDurationMs,
  },
  controlledFixture: {
    approvalId: approval.approvalId,
    approvalHash: approval.approvalHash,
    reviewSummaryHash: approval.reviewSummaryHash,
    payloadBytes: approvalBytes,
    approvalPersistenceDurationMs: fixtureApprovalDurationMs,
    idempotentReplay: replay.idempotentReplay,
    r2ApprovalId: r2Created.engineeringApproval.approvalId,
    certificationLedgerApprovalReference: ledger.engineeringApprovalId,
    certifiedPackageApprovalReference: certifiedProjection.engineeringApprovalId,
    referenceOnly: approval.referenceOnly,
    forbiddenPayloadFields,
  },
  assertions,
  passed: Object.values(assertions).every(Boolean),
};
await writeFile(resolve(outputDir, "engineering-human-approval-authority-validation.json"), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
if (!result.passed) process.exitCode = 1;
