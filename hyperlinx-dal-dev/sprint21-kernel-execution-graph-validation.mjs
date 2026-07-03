import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.dirname(fileURLToPath(import.meta.url));
const tempDir = path.join(root, ".tmp", "sprint21-validation");
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
  "src/kernel/KernelExecutionGraph.ts",
  "src/kernel/ExecutionNode.ts",
  "src/kernel/ExecutionEdge.ts",
  "src/kernel/ExecutionGraphBuilder.ts",
  "src/kernel/ExecutionGraphProjection.ts",
  "src/kernel/ExecutionGraphContracts.ts",
  "src/commercial/IOFPackageAssemblyEngine.ts",
  "src/products/PointToPointConfigurator.ts",
  "src/workspaces/GraphViewerWorkspace.tsx",
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
].forEach(transpile);

const projectionModule = await import(pathToFileURL(outPath("src/kernel/ExecutionGraphProjection.ts")));
const configuratorModule = await import(pathToFileURL(outPath("src/products/PointToPointConfigurator.ts")));
const doctrineModule = await import(pathToFileURL(outPath("src/products/pointToPointLongHaulDoctrine.ts")));

const geometry = [
  [-97.7500, 30.2600],
  [-97.7300, 30.2650],
  [-97.7000, 30.2700],
  [-97.6700, 30.2800],
];

const input = {
  customer: { accountId: "google", customerId: "CUSTOMER-google", customerName: "Google" },
  opportunity: { opportunityId: "OPPORTUNITY-SPRINT21", proposalId: "PROPOSAL-SPRINT21" },
  product: { productId: doctrineModule.POINT_TO_POINT_LONG_HAUL_PRODUCT_ID, productName: configuratorModule.POINT_TO_POINT_PRODUCT_NAME },
  aLocation: { locationId: "A", label: "A", latitude: 30.2600, longitude: -97.7500 },
  zLocation: { locationId: "Z", label: "Z", latitude: 30.2800, longitude: -97.6700 },
  routeGeometry: geometry,
  generatedAt: "2026-07-02T14:00:00.000Z",
};

const configuratorResult = configuratorModule.executePointToPointConfigurator(input);
const draft = configuratorResult.draftPackage;
const graph = draft.kernelExecutionGraph;
const stationAuthority = draft.stationAuthority;

assert(Boolean(graph), "Draft IOF Package persists Kernel Execution Graph.");
assert(graph.authority === "KERNEL_EXECUTION_GRAPH_AUTHORITY", "Kernel Execution Graph carries constitutional authority label.");
assert(graph.noScopeVersionCreation === true && draft.noScopeVersionCreation === true, "Kernel Execution Graph cannot create ScopeVersion.");
assert(Array.isArray(draft.executionNodes) && draft.executionNodes.length === graph.nodes.length, "Draft IOF Package persists execution nodes.");
assert(Array.isArray(draft.executionEdges) && draft.executionEdges.length === graph.edges.length, "Draft IOF Package persists execution edges.");
assert(Array.isArray(draft.executionGraphProjections) && draft.executionGraphProjections.length === graph.projections.length, "Draft IOF Package persists graph projections.");
assert(Boolean(draft.executionGraphValidation), "Draft IOF Package persists graph validation.");
assert(Boolean(draft.executionGraphSummary), "Draft IOF Package persists graph summary.");

const stationNodes = graph.nodes.filter((node) => node.nodeType === "STATION");
assert(stationNodes.length === stationAuthority.stationCount, "Every station is a first-class execution node.");
assert(stationNodes.every((node) => node.stationId && node.measureFeet >= 0), "Station execution nodes carry station and measure authority.");

const stationNodeByStationId = new Map(stationNodes.map((node) => [node.stationId, node]));
const objectNodes = graph.nodes.filter((node) => node.sourceArtifact === "engineeringObjects");
assert(objectNodes.length > 0, "Engineering objects become execution nodes.");
assert(objectNodes.every((node) => node.parentStationId && stationNodeByStationId.has(node.parentStationId)), "Engineering object nodes are children of station nodes.");
assert(objectNodes.every((node) => node.projectionLayers.includes("ENGINEERING") && node.projectionLayers.includes("FIELD")), "Engineering objects resolve into downstream projections from the same graph.");

assert(graph.nodes.some((node) => node.authority === "SPINE_AUDIT_PROJECTION_AUTHORITY"), "Audit projection enriches Kernel Execution Graph.");
assert(graph.nodes.some((node) => node.nodeType === "STATION_RANGE"), "Station range audit expectations become execution nodes.");
assert(graph.nodes.some((node) => node.nodeType === "CLOSURE_EXPECTATION"), "Closure expectations become execution nodes.");
assert(graph.edges.some((edge) => edge.dependencyClass === "CLOSURE_REQUIREMENT" || edge.dependencyClass === "REVIEW_REQUIREMENT"), "Execution dependencies determine closure or review requirements.");
assert(graph.edges.some((edge) => edge.dependencyClass === "PHYSICAL_ORDER"), "Station-indexed graph edges define physical order.");
assert(graph.validation.acyclic === true && graph.validation.status !== "FAIL", "Kernel Execution Graph dependencies are acyclic.");
assert(graph.nodes.every((node) => node.immutableIdentity === true) && graph.edges.every((edge) => edge.immutableIdentity === true), "Execution graph nodes and edges carry immutable identity.");
assert(graph.nodes.every((node) => node.identity && node.identity === node.stableKey), "Every execution node exposes immutable identity.");
assert(graph.nodes.every((node) => Array.isArray(node.parents) && Array.isArray(node.children) && Array.isArray(node.dependencies)), "Every execution node exposes parents, children, and dependencies.");
assert(graph.nodes.every((node) => node.commercialState && node.engineeringState && node.marketplaceState && node.controlState && node.fieldState && node.operationalState && node.revenueState), "Every execution node exposes lifecycle state fields.");

const expectedLayers = ["PHYSICAL", "COMMERCIAL", "STATIONS", "ENGINEERING", "EXECUTION", "MARKETPLACE", "CONTROL", "FIELD", "OPERATIONAL", "LIFECYCLE"];
expectedLayers.forEach((layer) => {
  const projection = graph.projections.find((item) => item.layer === layer);
  assert(Boolean(projection), `${layer} projection exists.`);
  assert(projection.sourceGraphId === graph.graphId, `${layer} projection resolves from the Kernel Execution Graph.`);
});

const commercialProjection = projectionModule.projectKernelExecutionGraph(graph, "COMMERCIAL", "2026-07-02T14:00:00.000Z");
assert(commercialProjection.sourceGraphId === graph.graphId && commercialProjection.nodeCount > 0, "Commercial projection is resolved from the same graph.");
const fieldProjection = projectionModule.projectKernelExecutionGraph(graph, "FIELD", "2026-07-02T14:00:00.000Z");
assert(fieldProjection.sourceGraphId === graph.graphId && fieldProjection.nodeCount > 0, "Field projection is resolved from the same graph.");
const selectedStation = projectionModule.findExecutionNode(graph, stationNodes[0].stationId);
assert(selectedStation?.nodeType === "STATION", "Selected station can be resolved as an execution node.");

const regenerated = configuratorModule.executePointToPointConfigurator(input).draftPackage.kernelExecutionGraph;
assert(regenerated.identityHash === graph.identityHash, "Kernel Execution Graph regeneration is deterministic.");
assert(JSON.stringify(regenerated.nodes.map((node) => node.nodeId).sort()) === JSON.stringify(graph.nodes.map((node) => node.nodeId).sort()), "Execution node identity is stable after regeneration.");
assert(JSON.stringify(regenerated.edges.map((edge) => edge.edgeId).sort()) === JSON.stringify(graph.edges.map((edge) => edge.edgeId).sort()), "Execution edge identity is stable after regeneration.");

const assemblySource = read("src/commercial/IOFPackageAssemblyEngine.ts");
assert(assemblySource.includes("buildKernelExecutionGraph"), "Commercial package assembly builds the Kernel Execution Graph.");
assert(assemblySource.includes("kernelExecutionGraph"), "Commercial package assembly persists the Kernel Execution Graph.");
const commercialPackageServerSource = read("server/routes/commercial-iof-packages.js");
assert(commercialPackageServerSource.includes("kernelExecutionGraph missing"), "Commercial submit validates Kernel Execution Graph readiness.");
assert(commercialPackageServerSource.includes("execution graph validation failed"), "Commercial submit blocks failed execution graph validation.");

const viewerSource = read("src/workspaces/GraphViewerWorkspace.tsx");
[
  "Kernel Execution Graph",
  "Physical",
  "Stations",
  "Engineering",
  "Execution",
  "Marketplace",
  "Control",
  "Field",
  "Operational",
  "Selected Execution Node",
].forEach((symbol) => {
  assert(viewerSource.includes(symbol), `Graph viewer exposes ${symbol}.`);
});
assert(!viewerSource.includes("buildKernelExecutionGraph") && !viewerSource.includes("createExecutionNode"), "Workspace does not duplicate execution graph construction.");
assert(!read("src/kernel/ExecutionGraphBuilder.ts").includes("createScopeVersion"), "Execution Graph Builder cannot create ScopeVersion.");

console.log(`Sprint 21 kernel execution graph validation passed (${checks.length} checks).`);
