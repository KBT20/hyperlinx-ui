import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.dirname(fileURLToPath(import.meta.url));
const tempDir = path.join(root, ".tmp", "sprint23-validation");
const checks = [];

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
  checks.push(message);
}

function outPath(relativePath) {
  return path.join(tempDir, relativePath).replace(/\.tsx?$/, ".mjs");
}

function transpile(relativePath) {
  const source = read(relativePath);
  const output = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      jsx: ts.JsxEmit.ReactJSX,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
      esModuleInterop: true,
    },
    fileName: relativePath,
  }).outputText.replace(/from "(\.{1,2}\/[^"]+)";/g, 'from "$1.mjs";');
  const outputFile = outPath(relativePath);
  mkdirSync(path.dirname(outputFile), { recursive: true });
  writeFileSync(outputFile, output);
  return outputFile;
}

rmSync(tempDir, { recursive: true, force: true });
mkdirSync(tempDir, { recursive: true });

const requiredFiles = [
  "src/components/commercial/ConstitutionalAssemblyReviewPanel.tsx",
  "src/components/commercial/StationAwareObjectReviewPanel.tsx",
  "src/components/workspaces/googleRfp/CommercialReviewPanel.tsx",
  "src/components/workspaces/GoogleRfpWorkspace.tsx",
  "src/commercial/IOFPackageAssemblyEngine.ts",
  "src/products/PointToPointConfigurator.ts",
  "server/routes/commercial-iof-packages.js",
];

requiredFiles.forEach((relativePath) => {
  assert(existsSync(path.join(root, relativePath)), `${relativePath} exists.`);
});

[
  "src/kernel/ExecutionGraphContracts.ts",
  "src/kernel/ExecutionNode.ts",
  "src/kernel/ExecutionEdge.ts",
  "src/kernel/ExecutionGraphProjection.ts",
  "src/kernel/KernelExecutionGraph.ts",
  "src/kernel/closure/ClosureContracts.ts",
  "src/kernel/closure/ExecutionExpectationEngine.ts",
  "src/kernel/closure/ClosureLedger.ts",
  "src/kernel/closure/ClosureReplayEngine.ts",
  "src/kernel/closure/ClosureValidationEngine.ts",
  "src/kernel/closure/ClosureEngine.ts",
  "src/kernel/ExecutionGraphBuilder.ts",
  "src/spine/SpineAuthorityContracts.ts",
  "src/spine/MeasuredSpineEngine.ts",
  "src/spine/StationAuthorityEngine.ts",
  "src/spine/StationIndexedGraphEngine.ts",
  "src/spine/ObjectStationAttachmentEngine.ts",
  "src/spine/SpineAuditProjectionContracts.ts",
  "src/spine/SpineAuditProjectionEngine.ts",
  "src/spine/catalog/SpineObjectCatalogContracts.ts",
  "src/spine/catalog/SpineObjectDoctrine.ts",
  "src/spine/catalog/SpineObjectCatalog.ts",
  "src/spine/catalog/SpineObjectCatalogEngine.ts",
  "src/spine/manifest/AuditObjectManifestContracts.ts",
  "src/spine/manifest/AuditObjectManifest.ts",
  "src/spine/manifest/AuditObjectManifestEngine.ts",
  "src/doctrine/pd003/PD003ProductionContracts.ts",
  "src/doctrine/pd003/PD003ProductionDoctrine.ts",
  "src/doctrine/pd003/ProductionProfileLibrary.ts",
  "src/doctrine/pd003/ProductionScheduleProjectionEngine.ts",
  "src/doctrine/pd003/ProductionCostProjectionEngine.ts",
  "src/doctrine/pd003/ProductionPaymentProjectionEngine.ts",
  "src/doctrine/pd003/ProductionValidationEngine.ts",
  "src/doctrine/pd003/ProductionProfileEngine.ts",
  "src/doctrine/pd002/addressing/PD002AAddressingContracts.ts",
  "src/doctrine/pd002/addressing/PD002AObjectAddressingDoctrine.ts",
  "src/doctrine/pd002/addressing/PD002AAddressValidationEngine.ts",
  "src/doctrine/pd002/addressing/PD002AObjectAddressingEngine.ts",
  "src/spine/instantiation/SpineObjectInstantiationContracts.ts",
  "src/spine/instantiation/SpineObjectIdentityEngine.ts",
  "src/spine/instantiation/SpineObjectProductionBindingEngine.ts",
  "src/spine/instantiation/SpineObjectSegmentAssignmentEngine.ts",
  "src/spine/instantiation/SpineObjectFactory.ts",
  "src/spine/instantiation/SpineObjectHierarchyEngine.ts",
  "src/spine/instantiation/SpineObjectInstantiationSummary.ts",
  "src/spine/instantiation/SpineObjectInstantiationValidationEngine.ts",
  "src/spine/instantiation/SpineObjectInstantiationEngine.ts",
  "src/products/ProductDoctrineContracts.ts",
  "src/products/pointToPointLongHaulDoctrine.ts",
  "src/commercial/IOFPackageAssemblyEngine.ts",
  "src/products/PointToPointConfigurator.ts",
  "src/components/commercial/ConstitutionalAssemblyReviewPanel.tsx",
].forEach(transpile);

const reviewModule = await import(pathToFileURL(outPath("src/components/commercial/ConstitutionalAssemblyReviewPanel.tsx")));
const configuratorModule = await import(pathToFileURL(outPath("src/products/PointToPointConfigurator.ts")));
const doctrineModule = await import(pathToFileURL(outPath("src/products/pointToPointLongHaulDoctrine.ts")));

const geometry = [
  [-97.7500, 30.2600],
  [-97.7300, 30.2650],
  [-97.7000, 30.2700],
  [-97.6700, 30.2800],
];

const configuratorResult = configuratorModule.executePointToPointConfigurator({
  customer: { accountId: "google", customerId: "CUSTOMER-google", customerName: "Google" },
  opportunity: { opportunityId: "OPPORTUNITY-SPRINT23", proposalId: "PROPOSAL-SPRINT23" },
  product: { productId: doctrineModule.POINT_TO_POINT_LONG_HAUL_PRODUCT_ID, productName: configuratorModule.POINT_TO_POINT_PRODUCT_NAME },
  aLocation: { locationId: "A", label: "A", latitude: 30.2600, longitude: -97.7500 },
  zLocation: { locationId: "Z", label: "Z", latitude: 30.2800, longitude: -97.6700 },
  routeGeometry: geometry,
  generatedAt: "2026-07-02T16:00:00.000Z",
});

const draft = configuratorResult.draftPackage;
assert(Boolean(draft.constitutionalAssembly), "Draft IOF Package persists constitutionalAssembly.");
assert(Boolean(draft.kernelExecutionGraph), "Draft IOF Package persists kernelExecutionGraph.");
assert(Boolean(draft.measuredSpine), "Draft IOF Package persists measuredSpine.");
assert(Boolean(draft.stationAuthority), "Draft IOF Package persists stationAuthority.");
assert(Array.isArray(draft.executionNodes) && draft.executionNodes.length > 0, "Draft IOF Package persists executionNodes.");
assert(Array.isArray(draft.executionExpectations) && draft.executionExpectations.length > 0, "Draft IOF Package persists executionExpectations.");
assert(Array.isArray(draft.spineObjectDependencies) && draft.spineObjectDependencies.length > 0, "Draft IOF Package persists spineObjectDependencies.");
assert(Array.isArray(draft.spineObjectCloseSequences) && draft.spineObjectCloseSequences.length > 0, "Draft IOF Package persists spineObjectCloseSequences.");
assert(Array.isArray(draft.spineObjectEvidenceRequirements) && draft.spineObjectEvidenceRequirements.length > 0, "Draft IOF Package persists spineObjectEvidenceRequirements.");
assert(Array.isArray(draft.segmentValidationRules) && draft.segmentValidationRules.length > 0, "Draft IOF Package persists segmentValidationRules.");
assert(Array.isArray(draft.paymentEligibilityRules) && draft.paymentEligibilityRules.length > 0, "Draft IOF Package persists paymentEligibilityRules.");
assert(Boolean(draft.draftIofReadiness), "Draft IOF Package persists draftIofReadiness.");
assert(draft.draftIofReadiness.status === "READY", "Draft IOF readiness is READY when Constitutional Assembly succeeds.");

const review = reviewModule.evaluateConstitutionalAssemblyReview(draft);
assert(review.status === "PASS", "Constitutional Assembly Review passes for assembled Draft IOF.");
assert(review.draftIofReadiness === "READY", "Constitutional Assembly Review exposes READY Draft IOF readiness.");
assert(review.draftIofGateBlocked === false, "Draft IOF gate opens only after Constitutional Assembly succeeds.");
assert(review.summary.spineObjectCount === draft.executionExpectations.length, "Review accounts for every Spine Object expectation.");
assert(review.readinessChecks.some((check) => check.label === "Product Doctrine" && check.status === "PASS"), "Product Doctrine readiness renders.");
assert(review.readinessChecks.some((check) => check.label === "Object Doctrine" && check.status === "PASS"), "Object Doctrine readiness renders.");
assert(review.readinessChecks.some((check) => check.label === "Audit Projection" && check.status === "PASS"), "Audit Projection readiness renders.");
assert(review.readinessChecks.some((check) => check.label === "Dependencies" && check.status === "PASS"), "Dependencies readiness renders.");
assert(review.readinessChecks.some((check) => check.label === "Close Sequences" && check.status === "PASS"), "Close Sequences readiness renders.");
assert(review.readinessChecks.some((check) => check.label === "Evidence Requirements" && check.status === "PASS"), "Evidence Requirements readiness renders.");
assert(review.readinessChecks.some((check) => check.label === "Payment Rules" && check.status === "PASS"), "Payment Rules readiness renders.");
assert(review.segmentSummary.futurePaymentEligibleSegments > 0, "Segment Validation exposes future payment eligibility.");

const blockedDraft = {
  ...draft,
  constitutionalAssembly: {
    ...draft.constitutionalAssembly,
    status: "FAIL",
    blockingIssues: ["doctrine missing: OBJ-SPRINT23"],
  },
  draftIofReadiness: {
    ...draft.draftIofReadiness,
    status: "BLOCKED",
    blockingIssues: ["Constitutional Assembly failed."],
  },
};
const blockedReview = reviewModule.evaluateConstitutionalAssemblyReview(blockedDraft);
assert(blockedReview.draftIofGateBlocked === true, "Draft IOF gate blocks failed Constitutional Assembly.");
assert(blockedReview.draftIofReadiness === "BLOCKED", "Failed Constitutional Assembly blocks Draft IOF readiness.");
assert(blockedReview.draftIofGateReason === "Draft IOF approval prohibited until Constitutional Assembly succeeds.", "Gate displays constitutional prohibition.");
assert(blockedReview.blockers.some((blocker) => blocker.reason.includes("doctrine missing")), "Blocking Issues preserve Spine Object reason.");

const panelSource = read("src/components/commercial/ConstitutionalAssemblyReviewPanel.tsx");
[
  "Constitutional Assembly Review",
  "Executive Status",
  "Spine Summary",
  "Constitutional Readiness",
  "Spine Object Summary",
  "Dependency Summary",
  "Close Sequence Validation",
  "Evidence Summary",
  "Segment Validation",
  "Blocking Issues",
  "constitutionalAssembly",
  "kernelExecutionGraph",
  "measuredSpine",
  "stationAuthority",
  "executionNodes",
  "executionExpectations",
  "spineObjectDependencies",
  "spineObjectCloseSequences",
  "spineObjectEvidenceRequirements",
  "segmentValidationRules",
  "paymentEligibilityRules",
  "draftIofReadiness",
  "NO CLOSE",
  "NO VALIDATION",
  "NO PAYMENT",
  "Station Aware Object Review",
].forEach((symbol) => {
  assert(panelSource.includes(symbol), `Assembly panel exposes ${symbol}.`);
});
assert(panelSource.includes('constitutionalAssembly.status !== "PASS"'), "Assembly panel blocks when Constitutional Assembly is not PASS.");
assert(panelSource.includes('draftIofReadiness !== "READY"'), "Assembly panel blocks when Draft IOF readiness is not READY.");
assert(panelSource.includes("onFocusSpineObject"), "Assembly panel syncs blocker selection to Station Aware Object Review.");
assert(!panelSource.includes("<progress") && !panelSource.includes("progressbar"), "Assembly panel uses status colors only, no progress bars.");
assert(!panelSource.includes("lookupCommercialStationExpectations") && !panelSource.includes("buildCommercialStationReviewMapSpec") && !panelSource.includes("MapKernel"), "Assembly panel does not duplicate station inspection or map logic.");

const workspaceSource = read("src/components/workspaces/GoogleRfpWorkspace.tsx");
const commercialReviewIndex = workspaceSource.indexOf("<CommercialReviewPanel");
const assemblyReviewIndex = workspaceSource.indexOf("<ConstitutionalAssemblyReviewPanel");
const stationReviewIndex = workspaceSource.indexOf("<StationAwareObjectReviewPanel");
assert(commercialReviewIndex > 0 && assemblyReviewIndex > commercialReviewIndex && stationReviewIndex > assemblyReviewIndex, "Commercial Planning renders Commercial Review -> Constitutional Assembly Review -> Station Aware Object Review.");
assert(workspaceSource.includes("constitutionalAssemblyReview.draftIofGateBlocked"), "Commercial submit button consumes Assembly Review gate.");
assert(workspaceSource.includes("setConstitutionalAssemblyFocus"), "Workspace stores Assembly Review focus.");
assert(workspaceSource.includes("focusStationRef={constitutionalAssemblyFocus?.stationRef}"), "Workspace syncs selected station into Station Aware Object Review.");
assert(workspaceSource.includes("focusSpineObjectId={constitutionalAssemblyFocus?.spineObjectId}"), "Workspace syncs selected Spine Object into Station Aware Object Review.");

const commercialReviewSource = read("src/components/workspaces/googleRfp/CommercialReviewPanel.tsx");
assert(commercialReviewSource.includes("draftIofApprovalDisabled"), "Commercial Review disables Draft IOF approval from Assembly gate.");
assert(commercialReviewSource.includes("draftIofApprovalReason"), "Commercial Review displays Assembly gate reason.");

const stationReviewSource = read("src/components/commercial/StationAwareObjectReviewPanel.tsx");
assert(stationReviewSource.includes("focusStationRef"), "Station Aware Object Review accepts focused station.");
assert(stationReviewSource.includes("focusSpineObjectId"), "Station Aware Object Review accepts focused Spine Object.");
assert(stationReviewSource.includes("useEffect"), "Station Aware Object Review reacts to Assembly focus.");

const assemblySource = read("src/commercial/IOFPackageAssemblyEngine.ts");
assert(assemblySource.includes("spineObjectDependencies"), "Draft IOF assembly persists spineObjectDependencies.");
assert(assemblySource.includes("spineObjectCloseSequences"), "Draft IOF assembly persists spineObjectCloseSequences.");
assert(assemblySource.includes("spineObjectEvidenceRequirements"), "Draft IOF assembly persists spineObjectEvidenceRequirements.");
assert(assemblySource.includes("segmentValidationRules"), "Draft IOF assembly persists segmentValidationRules.");
assert(assemblySource.includes("paymentEligibilityRules"), "Draft IOF assembly persists paymentEligibilityRules.");
assert(assemblySource.includes("draftIofReadiness"), "Draft IOF assembly persists draftIofReadiness.");

const serverSource = read("server/routes/commercial-iof-packages.js");
assert(serverSource.includes("spineObjectDependencies missing"), "Commercial package API validates spineObjectDependencies.");
assert(serverSource.includes("spineObjectCloseSequences missing"), "Commercial package API validates spineObjectCloseSequences.");
assert(serverSource.includes("spineObjectEvidenceRequirements missing"), "Commercial package API validates spineObjectEvidenceRequirements.");
assert(serverSource.includes("segmentValidationRules missing"), "Commercial package API validates segmentValidationRules.");
assert(serverSource.includes("paymentEligibilityRules missing"), "Commercial package API validates paymentEligibilityRules.");
assert(serverSource.includes("draftIofReadiness blocked"), "Commercial package API validates Draft IOF readiness.");

const noWorkflowSources = [
  panelSource,
  assemblySource,
  workspaceSource,
].join("\n");
assert(!noWorkflowSources.includes("createScopeVersion"), "Sprint 23 does not create ScopeVersion.");
assert(!noWorkflowSources.includes("createServiceOrder"), "Sprint 23 does not create Service Orders.");
assert(!noWorkflowSources.includes("createMarketplace"), "Sprint 23 does not create Marketplace workflow.");
assert(!noWorkflowSources.includes("createControl"), "Sprint 23 does not create Control workflow.");
assert(!noWorkflowSources.includes("FieldWorkflow"), "Sprint 23 does not create Field workflow.");

console.log(`Sprint 23 constitutional assembly review validation passed (${checks.length} checks).`);
