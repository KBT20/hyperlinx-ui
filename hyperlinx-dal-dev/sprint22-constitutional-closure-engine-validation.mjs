import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.dirname(fileURLToPath(import.meta.url));
const tempDir = path.join(root, ".tmp", "sprint22-validation");
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
  "src/kernel/closure/ClosureContracts.ts",
  "src/kernel/closure/ClosureEngine.ts",
  "src/kernel/closure/ClosureValidationEngine.ts",
  "src/kernel/closure/ClosureReplayEngine.ts",
  "src/kernel/closure/ClosureLedger.ts",
  "src/kernel/closure/ExecutionExpectationEngine.ts",
  "src/kernel/ExecutionGraphBuilder.ts",
  "src/commercial/IOFPackageAssemblyEngine.ts",
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
  "src/products/ProductDoctrineContracts.ts",
  "src/products/pointToPointLongHaulDoctrine.ts",
  "src/commercial/IOFPackageAssemblyEngine.ts",
  "src/products/PointToPointConfigurator.ts",
].forEach(transpile);

const closureContracts = await import(pathToFileURL(outPath("src/kernel/closure/ClosureContracts.ts")));
const closureEngine = await import(pathToFileURL(outPath("src/kernel/closure/ClosureEngine.ts")));
const closureLedgerModule = await import(pathToFileURL(outPath("src/kernel/closure/ClosureLedger.ts")));
const replayModule = await import(pathToFileURL(outPath("src/kernel/closure/ClosureReplayEngine.ts")));
const expectationModule = await import(pathToFileURL(outPath("src/kernel/closure/ExecutionExpectationEngine.ts")));
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
  opportunity: { opportunityId: "OPPORTUNITY-SPRINT22", proposalId: "PROPOSAL-SPRINT22" },
  product: { productId: doctrineModule.POINT_TO_POINT_LONG_HAUL_PRODUCT_ID, productName: configuratorModule.POINT_TO_POINT_PRODUCT_NAME },
  aLocation: { locationId: "A", label: "A", latitude: 30.2600, longitude: -97.7500 },
  zLocation: { locationId: "Z", label: "Z", latitude: 30.2800, longitude: -97.6700 },
  routeGeometry: geometry,
  generatedAt: "2026-07-02T15:00:00.000Z",
});

const draft = configuratorResult.draftPackage;
const graph = draft.kernelExecutionGraph;
assert(Boolean(graph), "Kernel Execution Graph exists.");
assert(Array.isArray(graph.executionExpectations) && graph.executionExpectations.length > 0, "Execution Expectations created.");
assert(Array.isArray(graph.closureLedgers) && graph.closureLedgers.length > 0, "Close Ledger exists.");
assert(Boolean(graph.closureReplaySummary), "Replay Engine summary exists.");
assert(Boolean(graph.constitutionalClosureSummary), "Kernel graph enriched with constitutional closure summary.");
assert(Boolean(graph.constitutionalAssembly), "Kernel graph carries Constitutional Assembly.");
assert(graph.constitutionalAssembly.status === "PASS", "Constitutional Assembly succeeds before Draft IOF approval.");
assert(graph.constitutionalAssembly.draftIofApprovalProhibitedUntilPass === true, "Draft IOF approval is prohibited until Constitutional Assembly succeeds.");
assert(graph.constitutionalAssembly.spineObjectCount === graph.executionExpectations.length, "Constitutional Assembly accounts for every Spine Object expectation.");
assert(graph.constitutionalAssembly.doctrineCount === graph.constitutionalAssembly.spineObjectCount, "Every Spine Object has doctrine.");
assert(graph.constitutionalAssembly.dependencyGraphCount === graph.constitutionalAssembly.spineObjectCount, "Every Spine Object has dependency graph.");
assert(graph.constitutionalAssembly.legalCloseSequenceCount === graph.constitutionalAssembly.spineObjectCount, "Every Spine Object has legal Close sequence.");
assert(graph.constitutionalAssembly.evidenceRequirementCount === graph.constitutionalAssembly.spineObjectCount, "Every Spine Object has evidence requirements.");
assert(graph.constitutionalAssembly.paymentValidationRelationshipCount === graph.constitutionalAssembly.spineObjectCount, "Every Spine Object has payment validation relationship.");
assert(Array.isArray(draft.executionExpectations) && draft.executionExpectations.length === graph.executionExpectations.length, "Draft IOF Package persists execution expectations.");
assert(Array.isArray(draft.closureLedgers) && draft.closureLedgers.length === graph.closureLedgers.length, "Draft IOF Package persists closure ledgers.");
assert(Boolean(draft.closureReplaySummary), "Draft IOF Package persists closure replay summary.");
assert(Boolean(draft.constitutionalClosureSummary), "Draft IOF Package persists constitutional closure summary.");
assert(Boolean(draft.constitutionalAssembly), "Draft IOF Package persists Constitutional Assembly.");

const executableNode = graph.nodes.find((node) => node.sourceArtifact === "engineeringObjects" && node.expectation && node.nextExpectedClose?.readiness === "READY");
assert(Boolean(executableNode), "Execution Object enrichment exists.");
assert(Boolean(executableNode.expectation), "Execution Object exposes expectation.");
assert(Array.isArray(executableNode.validatedCloses), "Execution Object exposes validated closes.");
assert(Array.isArray(executableNode.pendingCloses), "Execution Object exposes pending closes.");
assert(Array.isArray(executableNode.rejectedCloses), "Execution Object exposes rejected closes.");
assert(Boolean(executableNode.currentTruth), "Execution Object exposes derived current truth.");
assert(Boolean(executableNode.nextExpectedClose), "Execution Object exposes next deterministic close.");

const expectation = expectationModule.createExecutionExpectation(executableNode, graph);
assert(Boolean(expectation), "Execution Expectation can be recreated deterministically.");
assert(expectation.expectedWork.length > 0, "Execution Expectation includes expected work.");
assert(expectation.expectedEvidence.length > 0, "Execution Expectation includes expected evidence.");
assert(expectation.expectedMeasurements.length > 0, "Execution Expectation includes expected measurements.");
assert(expectation.expectedAcceptanceCriteria.length > 0, "Execution Expectation includes acceptance criteria.");
assert(expectation.expectedCloseSequence.length > 0, "Execution Expectation includes close sequence.");
assert(expectation.spineObjectId === executableNode.sourceArtifactId, "Execution Expectation identifies the Spine Object.");
assert(expectation.spineObjectType === executableNode.nodeType, "Execution Expectation records Spine Object type.");
assert(JSON.stringify(expectation.legalCloseSequence) === JSON.stringify(expectation.expectedCloseSequence), "Execution Expectation exposes legal Close sequence.");
assert(expectation.dependencyGraphNotSchedule === true, "Close sequence is a dependency graph, not a schedule.");
assert(expectation.paymentEligibilityRule === "NO_CLOSE_NO_VALIDATION_NO_PAYMENT", "Execution Expectation encodes no-close no-validation no-payment rule.");

const next = closureEngine.getNextDeterministicClose({
  node: executableNode,
  expectation,
  ledger: executableNode.closureLedger,
  graph,
});
assert(next.readiness === "READY", "Next Deterministic Close resolves correctly.");
assert(Boolean(next.expectedClose), "Next Deterministic Close returns expected close.");
assert(next.requiredEvidence.length > 0, "Next Deterministic Close returns required evidence.");
assert(next.spineObjectId === expectation.spineObjectId, "Next Deterministic Close remains attached to the Spine Object.");

const evidenceReference = [
  "GPS-EVIDENCE-001",
  "PHOTO-EVIDENCE-001",
  "MEASUREMENT: Station reference",
  "MEASUREMENT: Placement depth",
  "MEASUREMENT: Installed footage",
  "ACTOR_ATTESTATION",
  ...expectation.expectedEvidence,
];
const attachments = [
  "MEASUREMENT: Station reference",
  "MEASUREMENT: Placement depth",
  "MEASUREMENT: Installed footage",
];
const gpsEvidence = [{ lat: executableNode.coordinate?.[1] ?? 30.26, lng: executableNode.coordinate?.[0] ?? -97.75, accuracyFeet: 8, capturedAt: "2026-07-02T15:05:00.000Z" }];
const photoEvidence = [{ photoId: "PHOTO-EVIDENCE-001", uri: "field://photo/001", capturedAt: "2026-07-02T15:05:00.000Z" }];

const acceptedClose = closureEngine.createConstitutionalClose({
  graph,
  nodeId: executableNode.nodeId,
  closeType: next.expectedClose,
  actor: "Field Operator",
  timestamp: "2026-07-02T15:05:00.000Z",
  reason: "Validated first deterministic close.",
  evidenceReference,
  attachments,
  gpsEvidence,
  photoEvidence,
  notes: "All required evidence captured.",
});
assert(acceptedClose.accepted === true, "Accepted Close validates.");
assert(acceptedClose.immutable === true, "Every Close is immutable.");
assert(acceptedClose.executionObjectId === executableNode.sourceArtifactId, "Every Close references Execution Object.");
assert(acceptedClose.spineObjectId === executableNode.sourceArtifactId, "Every Close references Spine Object.");
assert(acceptedClose.spineObjectIds.includes(executableNode.sourceArtifactId), "Every Close attaches to one or more Spine Objects.");
assert(Boolean(acceptedClose.stationId), "Every Close references Station.");
assert(acceptedClose.stationId !== acceptedClose.spineObjectId, "Station is a spatial address and does not replace Spine Object identity.");

const rejectedClose = closureEngine.createConstitutionalClose({
  graph,
  nodeId: executableNode.nodeId,
  closeType: next.expectedClose,
  actor: "Field Operator",
  timestamp: "2026-07-02T15:06:00.000Z",
  reason: "Missing evidence test.",
  notes: "",
});
assert(rejectedClose.accepted === false && rejectedClose.validationResult.status === "REJECTED", "Rejected Close preserved.");
assert(rejectedClose.validationResult.blockers.length > 0, "Rejected Close records blockers.");

const fieldRedlineClose = closureEngine.createConstitutionalClose({
  graph,
  nodeId: executableNode.nodeId,
  closeType: "FIELD_REDLINE_CLOSE",
  actor: "Field Operator",
  timestamp: "2026-07-02T15:07:00.000Z",
  reason: "Field redline observation.",
  evidenceReference,
  attachments,
  gpsEvidence,
  photoEvidence,
  notes: "Utility conflict and depth variance found.",
  redline: {
    offset: 12,
    depth: 4,
    placement: "south shoulder",
    materialSubstitution: "HDPE SDR11",
    utilityConflict: "gas line offset",
    obstruction: "rock",
    accessIssue: "locked gate",
    quantityVariance: 18,
  },
});
assert(fieldRedlineClose.accepted === true, "Field Redline Close supported.");
assert(fieldRedlineClose.workspace === "FIELD", "Field Redline Close belongs to Field workspace.");
assert(fieldRedlineClose.noScopeVersionCreation === true, "Field cannot modify ScopeVersion.");

const engineeringAcceptanceClose = closureEngine.createConstitutionalClose({
  graph,
  nodeId: executableNode.nodeId,
  closeType: "ENGINEERING_ACCEPTANCE_CLOSE",
  actor: "Engineering",
  timestamp: "2026-07-02T15:08:00.000Z",
  reason: "Engineering acceptance of redline for future delta.",
  evidenceReference,
  attachments,
  gpsEvidence,
  photoEvidence,
  notes: "Accept into future ScopeVersion delta.",
  requiresScopeVersionDelta: true,
});
assert(engineeringAcceptanceClose.accepted === true, "Engineering Acceptance Close supported.");
assert(engineeringAcceptanceClose.requiresScopeVersionDelta === true, "Engineering Acceptance Close can flag future ScopeVersion delta.");
assert(engineeringAcceptanceClose.noScopeVersionCreation === true, "Engineering Acceptance Close does not create ScopeVersion.");

const ledger = closureLedgerModule.createClosureLedger({
  graph,
  node: executableNode,
  expectation,
  closes: [acceptedClose, rejectedClose, fieldRedlineClose, engineeringAcceptanceClose],
});
assert(ledger.validatedCloses.length === 3, "Close Ledger stores validated closes.");
assert(ledger.rejectedCloses.length === 1, "Close Ledger stores rejected closes.");
assert(ledger.immutable === true, "Close Ledger is immutable.");

const replayA = replayModule.replayObject({ node: executableNode, expectation, ledger, graph, replayedAt: "2026-07-02T15:10:00.000Z" });
const replayB = replayModule.replayObject({ node: executableNode, expectation, ledger, graph, replayedAt: "2026-07-02T15:10:00.000Z" });
assert(JSON.stringify(replayA.currentTruth) === JSON.stringify(replayB.currentTruth), "Replay produces identical truth.");
assert(replayA.currentTruth.mutableStateStored === false, "Current Truth derived through replay.");
assert(replayA.currentTruth.derivedStateRule === "STATE_DERIVED_ONLY_FROM_VALIDATED_CLOSE_REPLAY", "Derived state rule is explicit.");
assert(replayA.currentTruth.spineObjectId === executableNode.sourceArtifactId, "Current Truth remains attached to Spine Object.");
assert(replayA.currentTruth.derivedFromCloseIds.includes(acceptedClose.closeId), "Current Truth derives from validated Closes.");
assert(replayA.currentTruth.rejectedCloseIds.includes(rejectedClose.closeId), "Rejected Closes remain visible but do not become truth.");
assert(replayA.currentTruth.requiresScopeVersionDelta === true, "Replay carries future ScopeVersion delta signal without creating ScopeVersion.");
assert(["NOT_ELIGIBLE", "ELIGIBLE_AFTER_SEGMENT_ACCEPTANCE"].includes(replayA.currentTruth.paymentEligibility), "Payment eligibility is derived from replay.");
assert(["NOT_REALIZED", "ELIGIBLE_AFTER_VALIDATED_PAYMENT"].includes(replayA.currentTruth.revenueRealization), "Revenue realization is derived from validation.");

const nextAfterFirst = closureEngine.getNextDeterministicClose({
  node: executableNode,
  expectation,
  ledger: closureLedgerModule.createClosureLedger({ graph, node: executableNode, expectation, closes: [acceptedClose] }),
  graph,
});
assert(nextAfterFirst.expectedClose !== next.expectedClose || nextAfterFirst.readiness === "COMPLETE", "Next Deterministic Close advances after accepted close.");

const enriched = closureEngine.enrichKernelExecutionGraphWithClosures({
  graph,
  closes: [acceptedClose, rejectedClose, fieldRedlineClose, engineeringAcceptanceClose],
  generatedAt: "2026-07-02T15:10:00.000Z",
});
assert(enriched.nodes.length === graph.nodes.length, "Kernel graph enriched without node topology changes.");
assert(enriched.edges.length === graph.edges.length, "Kernel graph enriched without edge topology changes.");
assert(JSON.stringify(enriched.nodes.map((node) => node.nodeId).sort()) === JSON.stringify(graph.nodes.map((node) => node.nodeId).sort()), "Graph node identity unchanged after enrichment.");
assert(JSON.stringify(enriched.edges.map((edge) => edge.edgeId).sort()) === JSON.stringify(graph.edges.map((edge) => edge.edgeId).sort()), "Graph edge identity unchanged after enrichment.");
const enrichedObject = enriched.nodes.find((node) => node.nodeId === executableNode.nodeId);
assert(enrichedObject.validatedCloses.length === 3, "Kernel graph node exposes validated Closes.");
assert(enrichedObject.rejectedCloses.length === 1, "Kernel graph node exposes rejected Closes.");
assert(enrichedObject.currentTruth.derivedFromCloseIds.length === 3, "Kernel graph node exposes derived Current Truth.");
assert(enrichedObject.nextExpectedClose.readiness, "Kernel graph node exposes Next Deterministic Close.");

const stationReplay = replayModule.replayStation(enriched, executableNode.stationId ?? executableNode.parentStationId);
assert(stationReplay.executionObjectCount > 0, "Selecting a station can expose execution objects.");
const packageReplayA = replayModule.replayPackage(enriched);
const packageReplayB = replayModule.replayGraph(enriched);
assert(JSON.stringify(packageReplayA) === JSON.stringify(packageReplayB), "Replay package and graph are deterministic.");

assert(closureContracts.SUPPORTED_CLOSE_TYPES.includes("FIELD_REDLINE_CLOSE"), "Field Redline Close type is supported.");
assert(closureContracts.SUPPORTED_CLOSE_TYPES.includes("ENGINEERING_ACCEPTANCE_CLOSE"), "Engineering Acceptance Close type is supported.");
assert(closureContracts.STATION_IS_ADDRESS_RULE === "STATIONS_LOCATE_SPINE_OBJECTS_BUT_DO_NOT_REPLACE_THEM", "Station Authority rule is encoded.");
assert(closureContracts.PAYMENT_ELIGIBILITY_RULE === "NO_CLOSE_NO_VALIDATION_NO_PAYMENT", "Payment eligibility rule is encoded.");

const closureSources = [
  "src/kernel/closure/ClosureContracts.ts",
  "src/kernel/closure/ClosureEngine.ts",
  "src/kernel/closure/ClosureValidationEngine.ts",
  "src/kernel/closure/ClosureReplayEngine.ts",
  "src/kernel/closure/ClosureLedger.ts",
  "src/kernel/closure/ExecutionExpectationEngine.ts",
].map(read).join("\n");
assert(!closureSources.includes("createScopeVersion"), "ScopeVersion not created.");
assert(!closureSources.includes("createServiceOrder"), "Service Order not created.");
assert(!closureSources.includes("createMarketplace"), "Marketplace not created.");
assert(!closureSources.includes("createControl"), "Control not created.");
assert(!closureSources.includes("FieldWorkflow"), "Field workflow not created.");

const serverSource = read("server/routes/commercial-iof-packages.js");
assert(serverSource.includes("executionExpectations missing"), "Commercial submit validates execution expectations.");
assert(serverSource.includes("closureLedgers missing"), "Commercial submit validates closure ledgers.");
assert(serverSource.includes("constitutionalClosureSummary missing"), "Commercial submit validates constitutional closure summary.");
assert(serverSource.includes("constitutionalAssembly missing"), "Commercial submit validates Constitutional Assembly presence.");
assert(serverSource.includes("constitutionalAssembly failed"), "Commercial submit blocks failed Constitutional Assembly.");
const assemblySource = read("src/commercial/IOFPackageAssemblyEngine.ts");
assert(assemblySource.includes("constitutionalAssembly"), "Commercial package assembly persists Constitutional Assembly.");
assert(assemblySource.includes("Constitutional Assembly validated"), "Commercial package validation checks Constitutional Assembly.");

console.log(`Sprint 22 constitutional closure engine validation passed (${checks.length} checks).`);
