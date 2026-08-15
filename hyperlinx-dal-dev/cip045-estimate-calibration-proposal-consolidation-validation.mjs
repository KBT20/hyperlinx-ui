import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import {
  computeProposalReadiness,
  currentProposalApproval,
  proposalSnapshot,
  proposalSnapshotHash,
  saveImmutableProposalRevision,
} from "./server/routes/proposal-drafts.js";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const workspace = read("src/components/workspaces/GoogleRfpWorkspace.tsx");
const explorer = read("src/components/workspaces/googleRfp/TransparentEstimateExplorer.tsx");
const engine = read("src/commercial/TransparentEstimatingEngine.ts");
const defaults = read("src/commercial/EstimatorDefaults.ts");
const server = read("server/routes/proposal-drafts.js");
const api = read("src/api/teralinxRuntime.ts");
const lifecycleSource = read("src/commercial/ProposalRevisionLifecycle.ts");
const lifecycleModule = await import(`data:text/javascript;base64,${Buffer.from(ts.transpileModule(lifecycleSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText).toString("base64")}`);

const user = { userId: "teralinx-user-ryan", name: "Ryan" };
const base = {
  proposalId: "CIP-045-PROP",
  proposalNumber: "PROP-CIP-045",
  customerId: "customer-google",
  accountId: "google",
  opportunityId: "OPP-1",
  productId: "DUCT-DARK-FIBER",
  productName: "Point-to-Point Duct and Dark Fiber",
  productConfiguration: { ductCount: 3, ductDiameter: 2, fiberCount: 864 },
  geometryReferences: ["ROUTE-1"],
  runtimeObjectIds: ["ROUTE-1"],
  runtimeEvidenceIds: ["EVIDENCE-1"],
  existingInventoryReferences: ["INVENTORY-1"],
  dealPointIds: ["DEAL-1"],
  title: "Google Commercial Proposal",
  summary: "Route proposal",
  executiveSummary: "Customer-facing summary",
  pricingSummary: { sellPriceIru: 1200000, mrcRevenue: 5000 },
  marginSummary: { grossMarginDollars: 200000, grossMarginPercent: 16.67 },
  estimateId: "EST-1",
  estimateControls: { financial: { markupPercent: 20 }, civilMix: { plow: 82, dirt: 12, rock: 0, trench: 6 } },
  transparentEstimate: { estimateId: "EST-1", totalKnownCost: 1000000, nrc: 1200000, mrc: 5000 },
  constructionQuantities: { routeFeet: 52800, plowFeet: 43296, dirtBoreFeet: 6336, rockBoreFeet: 0, openTrenchFeet: 3168 },
  commercialTerms: { termMonths: 36, nrc: 1200000, monthlyOm: 5000, totalContractValue: 1380000 },
  proposalContent: { title: "Google Commercial Proposal", customerFacingPricing: { nrc: 1200000 } },
  status: "DRAFT",
  approvalState: "NOT_SUBMITTED",
  version: 1,
  proposalRevisions: [],
  approvals: [],
};
const revision1 = saveImmutableProposalRevision(base, user, "Original revision");
const revision2 = saveImmutableProposalRevision({ ...revision1, pricingSummary: { ...revision1.pricingSummary, sellPriceIru: 1250000 } }, user, "Price update");
const artifact1 = revision1.proposalRevisions[0];
const artifact2 = revision2.proposalRevisions[1];
const approved = {
  ...revision1,
  status: "COMMERCIAL_APPROVED",
  approvalState: "APPROVED",
  approvals: [{ decision: "APPROVED", proposalRevisionId: revision1.proposalRevisionId, proposalHash: revision1.proposalHash }],
};
const ready = computeProposalReadiness(approved);
const working = { ...revision2, revisionStatus: "WORKING", proposalHash: "", approvals: approved.approvals };
const workingReadiness = computeProposalReadiness(working);
const differences = lifecycleModule.compareProposalRevisions(artifact1, artifact2);

let passed = 0;
function check(number, label, fn) {
  fn();
  passed += 1;
  console.log(`PASS ${number}: ${label}`);
}
const checks = [
  ["single TransparentEstimatingEngine remains the estimate authority", () => assert.match(workspace, /TransparentEstimateExplorer/)],
  ["no replacement estimator was introduced", () => assert.equal((workspace.match(/TransparentEstimatingEngine/g) ?? []).length <= 2, true)],
  ["standard civil plow is 82", () => assert.match(defaults, /plowPercent:\s*82/)],
  ["standard civil dirt is 12", () => assert.match(defaults, /dirtBorePercent:\s*12/)],
  ["standard civil rock is zero", () => assert.match(defaults, /defaultRockPercentOfDirtBore:\s*0/)],
  ["standard civil trench is 6", () => assert.match(defaults, /openCutPercent:\s*6/)],
  ["new dirt baseline is 15", () => assert.match(defaults, /baseDirtBorePerFoot:\s*15/)],
  ["current dirt authority uses estimator default", () => assert.match(engine, /CURRENT_PRODUCT1_DIRT_RATE_AUTHORITY[\s\S]*ESTIMATOR_DEFAULTS\.construction\.baseDirtBorePerFoot/)],
  ["dirt authority applies to new estimate revisions", () => assert.match(engine, /appliesTo:\s*"NEW_ESTIMATE_REVISION"/)],
  ["civil values use whole-number inputs", () => assert.match(workspace, /step="1"[\s\S]*inputMode="numeric"/)],
  ["civil mix exposes plow", () => assert.match(workspace, /"plowPercent", "Plow"/)],
  ["civil mix exposes dirt", () => assert.match(workspace, /"dirtPercent", "Dirt"/)],
  ["civil mix exposes rock", () => assert.match(workspace, /"rockPercent", "Rock"/)],
  ["civil mix exposes trench", () => assert.match(workspace, /"trenchPercent", "Trench"/)],
  ["civil mix reset is present", () => assert.match(workspace, /Reset to Standard/)],
  ["route feet remain projected", () => assert.match(workspace, /<span>Route Feet<\/span>/)],
  ["project configuration exposes duct count", () => assert.match(explorer, /Duct Count/)],
  ["project configuration exposes duct diameter", () => assert.match(explorer, /Duct Diameter/)],
  ["project configuration exposes fiber count", () => assert.match(explorer, /Fiber Count/)],
  ["ILA planning remains present", () => assert.match(explorer, /ILA Planning/)],
  ["bookend controls remain in ILA planning", () => assert.match(explorer, /Bookend/)],
  ["advanced diagnostics are collapsed", () => assert.match(explorer, /Advanced \/ Diagnostics[\s\S]*Collapsed by default/)],
  ["civil controls are not duplicated in advanced groups", () => assert.match(explorer, /filter\(\(group\) => group\.label !== "Civil Mix"\)/)],
  ["active estimate calibration is labeled", () => assert.match(explorer, /aria-label="Active estimate calibration"/)],
  ["one active estimate invariant is stated", () => assert.match(explorer, /One active estimate drives displayed cost/)],
  ["baseline quantity column exists", () => assert.match(explorer, /Baseline Qty/)],
  ["calibrated quantity column exists", () => assert.match(explorer, /Calibrated Qty/)],
  ["baseline rate column exists", () => assert.match(explorer, /Baseline Rate/)],
  ["calibrated rate column exists", () => assert.match(explorer, /Calibrated Rate/)],
  ["baseline cost column exists", () => assert.match(explorer, /Baseline Cost/)],
  ["calibrated cost column exists", () => assert.match(explorer, /Calibrated Cost/)],
  ["cost delta column exists", () => assert.match(explorer, /<th>Delta<\/th>/)],
  ["provenance column exists", () => assert.match(explorer, /<th>Provenance<\/th>/)],
  ["line reset exists", () => assert.match(explorer, /resetLine/)],
  ["reset all exists", () => assert.match(explorer, /resetAll/)],
  ["estimate revision save exists", () => assert.match(explorer, /Save Estimate Revision/)],
  ["estimate working state is memory-only", () => assert.doesNotMatch(explorer.slice(explorer.indexOf("function ActiveEstimateCalibration"), explorer.indexOf("function LineTable")), /localStorage|Repository|fetch\(/)],
  ["estimate summary excludes revenue", () => assert.match(explorer, /Revenue Included<\/span><b>No/)],
  ["proposal preview exposes NRC", () => assert.match(workspace, /Customer proposal commercial summary[\s\S]*<span>NRC<\/span>/)],
  ["proposal preview exposes monthly O&M", () => assert.match(workspace, /Customer proposal commercial summary[\s\S]*O&amp;M \/ Month/)],
  ["proposal preview exposes term", () => assert.match(workspace, /Customer proposal commercial summary[\s\S]*<span>Term<\/span>/)],
  ["proposal preview exposes TCV", () => assert.match(workspace, /Customer proposal commercial summary[\s\S]*Total Contract Value/)],
  ["save button names Proposal Revision", () => assert.match(workspace, />Save Proposal Revision<\/button>/)],
  ["create button names new revision", () => assert.match(workspace, />Create New Revision<\/button>/)],
  ["proposal save freezes active estimate", () => assert.match(workspace, /transparentEstimate:\s*displayedTransparentEstimate/)],
  ["proposal save freezes estimate controls", () => assert.match(workspace, /estimateControls:\s*displayedTransparentEstimateControls/)],
  ["proposal save freezes product configuration", () => assert.match(workspace, /productConfiguration:\s*displayedTransparentEstimateControls\.projectConfiguration/)],
  ["proposal save freezes construction quantities", () => assert.match(workspace, /constructionQuantities:\s*displayedTransparentEstimate\?\.physicalQuantities/)],
  ["proposal save freezes commercial terms", () => assert.match(workspace, /commercialTerms:/)],
  ["proposal save freezes customer-facing content", () => assert.match(workspace, /proposalContent:/)],
  ["server has a canonical snapshot field allowlist", () => assert.match(server, /PROPOSAL_REVISION_SNAPSHOT_FIELDS/)],
  ["hash is SHA-256", () => assert.equal(proposalSnapshotHash({ a: 1 }).length, 64)],
  ["canonical hash ignores object key order", () => assert.equal(proposalSnapshotHash({ a: 1, b: 2 }), proposalSnapshotHash({ b: 2, a: 1 }))],
  ["volatile approvals are excluded from frozen snapshot", () => assert.equal(proposalSnapshot({ ...base, approvals: [1] }).approvals, undefined)],
  ["first immutable revision is numbered one", () => assert.equal(revision1.revisionNumber, 1)],
  ["first revision has stable identity", () => assert.equal(revision1.proposalRevisionId, "CIP-045-PROP-revision-1")],
  ["first revision is saved", () => assert.equal(revision1.revisionStatus, "SAVED")],
  ["first revision has a hash", () => assert.equal(revision1.proposalHash.length, 64)],
  ["second save creates a new revision", () => assert.equal(revision2.revisionNumber, 2)],
  ["second revision points to parent", () => assert.equal(artifact2.parentProposalRevisionId, artifact1.proposalRevisionId)],
  ["second revision records source hash", () => assert.equal(artifact2.derivedFromProposalHash, artifact1.proposalHash)],
  ["original snapshot remains unchanged", () => assert.equal(artifact1.snapshot.pricingSummary.sellPriceIru, 1200000)],
  ["new snapshot contains revised value", () => assert.equal(artifact2.snapshot.pricingSummary.sellPriceIru, 1250000)],
  ["comparison detects the price change", () => assert.ok(differences.some((item) => item.path === "pricingSummary.sellPriceIru"))],
  ["price change is commercial-only", () => assert.equal(differences.find((item) => item.path === "pricingSummary.sellPriceIru")?.changeClass, "COMMERCIAL_ONLY")],
  ["route changes classify as route", () => assert.equal(lifecycleModule.compareProposalRevisions({ snapshot: { routeId: "A" } }, { snapshot: { routeId: "B" } })[0].changeClass, "ROUTE")],
  ["configuration changes classify as physical", () => assert.equal(lifecycleModule.compareProposalRevisions({ snapshot: { productConfiguration: { ductCount: 2 } } }, { snapshot: { productConfiguration: { ductCount: 3 } } })[0].changeClass, "PHYSICAL_CONFIGURATION")],
  ["estimate changes classify as cost", () => assert.equal(lifecycleModule.compareProposalRevisions({ snapshot: { transparentEstimate: { total: 1 } } }, { snapshot: { transparentEstimate: { total: 2 } } })[0].changeClass, "ESTIMATE_COST")],
  ["approval matches exact revision and hash", () => assert.ok(currentProposalApproval(approved))],
  ["mismatched hash does not approve", () => assert.equal(currentProposalApproval({ ...approved, proposalHash: "different" }), null)],
  ["approved saved revision can reach readiness", () => assert.equal(ready.customerApproved, true)],
  ["working revision is not customer approved", () => assert.equal(workingReadiness.customerApproved, false)],
  ["working revision is blocked from handoff", () => assert.equal(workingReadiness.canCreateDraftIofPackage, false)],
  ["working revision reports save blocker", () => assert.ok(workingReadiness.blockingIssues.some((item) => item.includes("Save the active Proposal Revision")))],
  ["derived revision API accepts basis ID", () => assert.match(api, /basisProposalRevisionId\?: string/)],
  ["derived revision remains working", () => assert.match(server, /revisionStatus:\s*"WORKING"/)],
  ["approval transfer is explicitly false", () => assert.match(server, /approvalTransferred:\s*false/)],
  ["approval stores revision ID", () => assert.match(server, /proposalRevisionId:\s*record\.proposalRevisionId/)],
  ["approval stores proposal hash", () => assert.match(server, /proposalHash:\s*record\.proposalHash/)],
  ["new approval can supersede prior revision", () => assert.match(server, /supersededByRevisionId/)],
  ["handoff source carries proposal revision", () => assert.match(server, /proposalRevisionNumber:\s*record\.revisionNumber/)],
  ["financial civil handler performs no repository write", () => { const block = workspace.slice(workspace.indexOf("function updateCivilMixCalibration"), workspace.indexOf("function resetCivilMixCalibration")); assert.doesNotMatch(block, /Repository\.|fetch\(|persist/i); }],
  ["financial change remains outside structural assembly", () => { const start = workspace.indexOf("function updateTransparentFinancial"); const block = workspace.slice(start, workspace.indexOf("\n  }\n", start) + 5); assert.doesNotMatch(block, /assembleDraftIof|station|geometry|engineering/i); }],
  ["CIP-044A.3 guard remains intact", () => assert.match(workspace, /if \(routeEditConstraintPatchType && routeEditSession\)/)],
];

assert.equal(checks.length, 84, "CIP-045 validator inventory changed; renumber/report it deliberately.");
checks.forEach(([label, fn], index) => check(index + 1, label, fn));
console.log(`\n${passed}/${checks.length} CIP-045 validations passed.`);
