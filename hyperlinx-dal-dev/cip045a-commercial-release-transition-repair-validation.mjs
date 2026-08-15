import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { exactProposalRevisionEligibility } from "./server/routes/commercial-iof-packages.js";
import {
  commercialReleasePackageRecordForRepository,
  commercialRevisionRecordForRepository,
} from "./server/routes/commercial-revisions.js";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const workspace = read("src/components/workspaces/GoogleRfpWorkspace.tsx");
const api = read("src/api/teralinxRuntime.ts");
const revisionsRoute = read("server/routes/commercial-revisions.js");
const iofRoute = read("server/routes/commercial-iof-packages.js");

function between(source, start, end) {
  const from = source.indexOf(start);
  assert.notEqual(from, -1, `Missing start marker: ${start}`);
  const to = source.indexOf(end, from + start.length);
  return to === -1 ? source.slice(from) : source.slice(from, to);
}

const handler = between(workspace, "async function handleSubmitCommercialDraftIofToEngineering", "function handleOpenSubmittedEngineeringCertification");
const coordinator = between(workspace, "async function ensureCommercialLifecycleAuthorityForDraft", "  useEffect(() => {");
const readiness = between(workspace, "const commercialReleasePrerequisiteChecks", "  useEffect(() => {");
const submitEndpoint = between(iofRoute, "normalizedPath.startsWith(\"/api/commercial/iof-packages/\") && normalizedPath.endsWith(\"/submit-engineering\")", "  if (normalizedPath.startsWith(\"/api/commercial/iof-packages/\")");

const proposalRevision = {
  proposalRevisionId: "PROP-1-revision-3",
  proposalHash: "a".repeat(64),
  revisionNumber: 3,
  revisionStatus: "SAVED",
};
const proposal = {
  proposalId: "PROP-1",
  opportunityId: "OPP-1",
  proposalRevisionId: proposalRevision.proposalRevisionId,
  proposalHash: proposalRevision.proposalHash,
  revisionNumber: proposalRevision.revisionNumber,
  proposalRevisions: [proposalRevision],
  approvals: [{
    approvalId: "APPROVAL-3",
    decision: "APPROVED",
    proposalRevisionId: proposalRevision.proposalRevisionId,
    proposalHash: proposalRevision.proposalHash,
  }],
};
const draft = {
  packageId: "DRAFT-1",
  proposalId: proposal.proposalId,
  opportunityId: proposal.opportunityId,
  proposalRevisionId: proposalRevision.proposalRevisionId,
  proposalHash: proposalRevision.proposalHash,
  proposalRevisionNumber: proposalRevision.revisionNumber,
  routeRepositoryId: "ROUTE-1",
  estimateId: "EST-1",
  workbookId: "WORKBOOK-1",
};
const eligibility = exactProposalRevisionEligibility(proposal, draft);
const revision = commercialRevisionRecordForRepository({ proposal, draftPackage: draft, timestamp: "2026-08-13T12:00:00.000Z" });
const revisionRetry = commercialRevisionRecordForRepository({ proposal, draftPackage: draft, timestamp: "2026-08-13T12:01:00.000Z" });
const release = commercialReleasePackageRecordForRepository({ revision, timestamp: "2026-08-13T12:00:00.000Z" });
const releaseRetry = commercialReleasePackageRecordForRepository({ revision: revisionRetry, timestamp: "2026-08-13T12:01:00.000Z" });

const checks = [
  ["release handler no longer gates on post-transition dashboard readiness", () => assert.doesNotMatch(handler, /if \(!commercialDashboardHandoffReady\)/)],
  ["release handler gates only on true prerequisites before orchestration", () => assert.match(handler, /if \(!commercialReleasePrerequisitesReady\)/)],
  ["release handler invokes coordinator before Draft IOF save", () => assert.ok(handler.indexOf("ensureCommercialLifecycleAuthorityForDraft") < handler.indexOf("saveCommercialDraftIofPackage"))],
  ["Draft IOF save occurs before Engineering submit", () => assert.ok(handler.indexOf("saveCommercialDraftIofPackage") < handler.indexOf("submitDraftIofPackageToEngineering"))],
  ["Engineering package is reopened for post-submit verification", () => assert.match(handler, /openEngineeringPackage\(result\.engineeringPackage\.engineeringPackageId/)],
  ["double-click guard is present", () => assert.match(handler, /releaseCoordinatorPendingRef\.current/)],
  ["double-click guard is set before mutation", () => assert.match(handler, /releaseCoordinatorPendingRef\.current = true/)],
  ["double-click guard is cleared in finally", () => assert.match(handler, /finally[\s\S]*releaseCoordinatorPendingRef\.current = false/)],
  ["coordinator requires saved Proposal Revision ID", () => assert.match(coordinator, /\["Saved Proposal Revision", proposalRevisionId/)],
  ["coordinator requires Proposal hash", () => assert.match(coordinator, /\["Proposal Hash", proposalHash/)],
  ["coordinator matches existing Draft IOF by exact revision ID", () => assert.match(coordinator, /String\(draft\.proposalRevisionId \?\? ""\) === proposalRevisionId/)],
  ["coordinator matches existing Draft IOF by exact hash", () => assert.match(coordinator, /String\(draft\.proposalHash \?\? ""\) === proposalHash/)],
  ["coordinator matches Commercial Revision by exact revision and hash", () => assert.match(coordinator, /String\(item\.proposalRevisionId \?\? ""\) === proposalRevisionId[\s\S]*String\(item\.proposalHash \?\? ""\) === proposalHash/)],
  ["Commercial Revision creation precedes Release Package creation", () => assert.ok(coordinator.indexOf("CommercialRevisionRepository.saveRevision") < coordinator.indexOf("CommercialReleasePackageRepository.saveReleasePackage"))],
  ["coordinator reuses existing Release Package", () => assert.match(coordinator, /existingReleasePackages\.find/)],
  ["coordinator returns an existing exact Draft IOF without recreating it", () => assert.match(coordinator, /restoredDraftPackage:\s*true/)],
  ["Draft IOF binds Proposal Revision ID", () => assert.match(coordinator, /proposalRevisionId,[\s\S]*proposalHash,[\s\S]*proposalRevisionNumber/)],
  ["Proposal Revision is sequence one in the displayed lifecycle", () => assert.match(workspace, /Proposal Revision[\s\S]*Commercial Revision[\s\S]*Release Package[\s\S]*Draft IOF Package[\s\S]*Engineering Handoff/)],
  ["Commercial Revision records sequence two", () => assert.equal(revision.lifecycleSequence, 2)],
  ["Release Package records sequence three", () => assert.equal(release.lifecycleSequence, 3)],
  ["Draft IOF records sequence four", () => assert.match(coordinator, /lifecycleSequence:\s*4/)],
  ["Engineering Intake records sequence five", () => assert.match(iofRoute, /proposalRevisionNumber:\s*draftPackage\.proposalRevisionNumber,[\s\S]*lifecycleSequence:\s*5/)],
  ["exact saved revision with exact approval is eligible", () => assert.equal(eligibility.eligible, true)],
  ["eligibility returns the exact selected revision", () => assert.equal(eligibility.revision.proposalRevisionId, proposalRevision.proposalRevisionId)],
  ["legacy records are readable but not release eligible", () => assert.deepEqual(exactProposalRevisionEligibility(proposal, {}).eligible, false)],
  ["partial exact identity is blocked", () => assert.equal(exactProposalRevisionEligibility(proposal, { proposalRevisionId: proposalRevision.proposalRevisionId }).eligible, false)],
  ["working revision is blocked", () => assert.equal(exactProposalRevisionEligibility({ ...proposal, proposalRevisions: [{ ...proposalRevision, revisionStatus: "WORKING" }] }, draft).eligible, false)],
  ["mismatched hash is blocked", () => assert.equal(exactProposalRevisionEligibility(proposal, { ...draft, proposalHash: "b".repeat(64) }).eligible, false)],
  ["approval for a different hash is blocked", () => assert.equal(exactProposalRevisionEligibility({ ...proposal, approvals: [{ ...proposal.approvals[0], proposalHash: "b".repeat(64) }] }, draft).eligible, false)],
  ["approval for a different revision is blocked", () => assert.equal(exactProposalRevisionEligibility({ ...proposal, approvals: [{ ...proposal.approvals[0], proposalRevisionId: "OTHER" }] }, draft).eligible, false)],
  ["Commercial Revision carries exact Proposal Revision ID", () => assert.equal(revision.proposalRevisionId, proposalRevision.proposalRevisionId)],
  ["Commercial Revision carries exact Proposal hash", () => assert.equal(revision.proposalHash, proposalRevision.proposalHash)],
  ["Commercial Revision ID is deterministic on retry", () => assert.equal(revisionRetry.commercialRevisionId, revision.commercialRevisionId)],
  ["Commercial Revision hash is deterministic on retry", () => assert.equal(revisionRetry.revisionHash, revision.revisionHash)],
  ["Release Package carries exact Proposal Revision ID", () => assert.equal(release.proposalRevisionId, proposalRevision.proposalRevisionId)],
  ["Release Package carries exact Proposal hash", () => assert.equal(release.proposalHash, proposalRevision.proposalHash)],
  ["Release Package ID is deterministic on retry", () => assert.equal(releaseRetry.commercialReleasePackageId, release.commercialReleasePackageId)],
  ["Release Package hash is deterministic on retry", () => assert.equal(releaseRetry.releaseHash, release.releaseHash)],
  ["reference-only Draft IOF serializer preserves exact revision fields", () => assert.match(api, /proposalRevisionId,[\s\S]*proposalHash,[\s\S]*proposalRevisionNumber/)],
  ["Draft IOF server blocks an ineligible exact revision", () => assert.match(iofRoute, /Draft IOF save blocked: \$\{proposalRevisionEligibility\.reason\}/)],
  ["Engineering submit server revalidates exact eligibility", () => assert.match(iofRoute, /Commercial Package validation failed: \$\{proposalRevisionEligibility\.reason\}/)],
  ["submitted package retry returns the existing artifacts", () => assert.match(submitEndpoint, /idempotentReplay:\s*true/)],
  ["submitted package retry explicitly reports no duplicates", () => assert.match(submitEndpoint, /noDuplicateArtifactsCreated:\s*true/)],
  ["Engineering Intake identity is deterministic from Draft IOF", () => assert.match(iofRoute, /ENGINEERING-INTAKE-\$\{stableIdPart\(draftPackage\.packageId\)\}/)],
  ["older eligible revision does not overwrite active Proposal status", () => assert.match(iofRoute, /status:\s*selectedIsActive \? PROPOSAL_STATUS_ENGINEERING_SUBMITTED : proposal\.status/)],
  ["older eligible revision receives its own handoff ledger entry", () => assert.match(iofRoute, /proposalRevisionHandoffs:[\s\S]*revisionHandoff/)],
  ["readiness exposes Proposal Revision", () => assert.match(readiness, /label:\s*"Proposal Revision"/)],
  ["readiness exposes Customer Approval", () => assert.match(readiness, /label:\s*"Customer Approval"/)],
  ["readiness exposes Commercial Revision", () => assert.match(readiness, /label:\s*"Commercial Revision"/)],
  ["readiness exposes Release Package as independent state", () => assert.match(readiness, /label:\s*"Release Package"/)],
  ["readiness exposes Draft IOF Package", () => assert.match(readiness, /label:\s*"Draft IOF Package"/)],
  ["readiness exposes Engineering Handoff", () => assert.match(readiness, /label:\s*"Engineering Handoff"/)],
  ["UI offers explicit eligible revision selection", () => assert.match(workspace, /Eligible Proposal Revision/)],
  ["UI labels the governed action Release to Engineering", () => assert.match(workspace, />\s*Release to Engineering\s*<\/button>/)],
  ["UI distinguishes Release Package NOT CREATED", () => assert.match(workspace, /check\.key === "release-package" \? "NOT CREATED"/)],
  ["release records remain immutable and reference-only", () => { assert.equal(release.immutable, true); assert.equal(release.referenceOnly, true); }],
  ["release creates no ScopeVersion", () => assert.equal(release.noScopeVersionCreation, true)],
  ["release does not mutate Engineering authority", () => assert.equal(release.noEngineeringAuthorityMutation, true)],
];

assert.ok(checks.length >= 30, "CIP-045A requires at least 30 focused checks.");
let passed = 0;
checks.forEach(([label, run], index) => {
  run();
  passed += 1;
  console.log(`PASS ${index + 1}: ${label}`);
});
console.log(`\n${passed}/${checks.length} CIP-045A validations passed.`);
