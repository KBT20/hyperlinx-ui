import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.dirname(fileURLToPath(import.meta.url));
const tempDir = path.join(root, ".tmp", "sprint20d-validation");
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
  "src/products/PointToPointConfigurator.ts",
  "src/products/pointToPointLongHaulDoctrine.ts",
  "src/commercial/IOFPackageAssemblyEngine.ts",
  "src/components/workspaces/GoogleRfpWorkspace.tsx",
  "src/components/workspaces/googleRfp/CommercialReviewPanel.tsx",
  "src/components/commercial/StationAwareObjectReviewPanel.tsx",
  "src/api/teralinxRuntime.ts",
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
  "src/spine/ObjectStationAttachmentEngine.ts",
  "src/spine/StationIndexedGraphEngine.ts",
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
  "src/commercial/IOFPackageAssemblyEngine.ts",
  "src/products/pointToPointLongHaulDoctrine.ts",
  "src/products/PointToPointConfigurator.ts",
].forEach(transpile);

const configuratorModule = await import(pathToFileURL(outPath("src/products/PointToPointConfigurator.ts")));
const doctrineModule = await import(pathToFileURL(outPath("src/products/pointToPointLongHaulDoctrine.ts")));

const routeGeometry = [
  [-97.7500, 30.2600],
  [-97.7400, 30.2640],
  [-97.7300, 30.2690],
  [-97.7200, 30.2750],
];

const result = configuratorModule.executePointToPointConfigurator({
  customer: {
    accountId: "google",
    customerId: "CUSTOMER-google",
    customerName: "Google",
  },
  opportunity: {
    opportunityId: "OPPORTUNITY-SPRINT20D",
    proposalId: "PROPOSAL-SPRINT20D",
    proposalNumber: "SPRINT20D-001",
    title: "Google Point-to-Point Duct & Dark Fiber",
    summary: "Sprint 20D Product Invocation Authority fixture.",
  },
  product: {
    productId: doctrineModule.POINT_TO_POINT_LONG_HAUL_PRODUCT_ID,
    productName: configuratorModule.POINT_TO_POINT_PRODUCT_NAME,
    defaultTermYears: 20,
    protected: false,
  },
  aLocation: {
    locationId: "A-GOOGLE-SPRINT20D",
    label: "Google A",
    latitude: 30.2600,
    longitude: -97.7500,
    source: "VALIDATION",
  },
  zLocation: {
    locationId: "Z-GOOGLE-SPRINT20D",
    label: "Google Z",
    latitude: 30.2750,
    longitude: -97.7200,
    source: "VALIDATION",
  },
  routeGeometry,
  routeId: "ROUTE-SPRINT20D",
  pricingSummary: {
    routeMiles: 2.14,
    budgetCost: 1100000,
    sellPriceIru: 1450000,
    grossMarginDollars: 350000,
    grossMarginPercent: 24.1,
  },
  commercialAssumptions: {
    assumptionStateId: "ASSUMPTIONS-SPRINT20D",
    civilMix: { aerialPercent: 0, undergroundPercent: 100 },
  },
  generatedAt: "2026-07-02T12:00:00.000Z",
  ownerId: "teralinx-user-kyle",
  owner: "Kyle",
  organizationId: "ORG-SPRINT20D",
  workspaceId: "WORKSPACE-SPRINT20D",
});

const draft = result.draftPackage;
const measuredSpine = draft.measuredSpine;
const stationAuthority = draft.stationAuthority;
const stationIndexedGraph = draft.stationIndexedGraph;

assert(result.validation.status === "PASS", "Product Configurator validation passes.");
assert(result.contextInspector.customer === "Google", "Customer selected.");
assert(result.productId === doctrineModule.POINT_TO_POINT_LONG_HAUL_PRODUCT_ID, "Point-to-Point product selected.");
assert(configuratorModule.productConfiguratorForProduct(result.productId) === configuratorModule.POINT_TO_POINT_CONFIGURATOR_ID, "Correct configurator invoked.");
assert(result.doctrineId === doctrineModule.POINT_TO_POINT_LONG_HAUL_DOCTRINE.doctrineId, "PD-001 loaded.");
assert(result.productDoctrineAssembly.aSite?.coordinate?.length === 2 && result.productDoctrineAssembly.zSite?.coordinate?.length === 2, "A/Z resolved.");
assert(result.routeGeometry.length === routeGeometry.length, "Route generated.");
assert(Boolean(measuredSpine?.geometryHash), "Measured spine generated.");
assert(measuredSpine?.coordinateCount === routeGeometry.length, "Measured spine retains route coordinate count.");
assert(Boolean(stationAuthority?.stations?.length), "Station authority generated.");
assert(stationAuthority?.stationCount === stationAuthority?.stations?.length, "Station count is authoritative.");
assert(Boolean(draft.stationIndex), "Station index persisted.");
assert(Boolean(draft.stationToCoordinateMap), "Station-to-coordinate map persisted.");
assert(Array.isArray(draft.objectStationAttachments), "Object station attachments persisted.");
assert(Boolean(stationIndexedGraph?.edges?.length), "Station-indexed graph generated.");
assert(result.productDoctrineAssembly.objects.length > 0, "Engineering objects generated.");
assert(Array.isArray(draft.engineeringObjects) && draft.engineeringObjects.length === result.productDoctrineAssembly.objects.length, "Engineering objects persisted in Draft IOF Package.");
assert(Number(result.productDoctrineAssembly.quantitySummary.routeFeet) > 0, "Quantities generated.");
assert(Boolean(draft.packageId) && draft.draftPackageId === draft.packageId, "Draft IOF Package created.");
assert(draft.productConfigurator === configuratorModule.POINT_TO_POINT_CONFIGURATOR_ID, "Draft IOF Package records Product Configurator.");
assert(draft.configuratorVersion === configuratorModule.POINT_TO_POINT_CONFIGURATOR_VERSION, "Draft IOF Package records configurator version.");
assert(draft.productInvocationAuthority === "PRODUCT_CONFIGURATOR_EXECUTES_PRODUCT_DOCTRINE", "Draft IOF Package records Product Invocation Authority.");
assert(draft.commercialReviewState?.status === "COMMERCIAL_REVIEW_LOADED", "Commercial Review loaded.");
assert(draft.commercialReviewState?.canCreateScopeVersion === false, "Commercial Review cannot create ScopeVersion.");
assert(draft.commercialDesign?.noManualEngineeringAssembly === true, "Commercial Design does not require manual engineering assembly.");
assert(draft.noScopeVersionCreation === true && result.noScopeVersionCreation === true, "No ScopeVersion is created.");

const workspaceSource = read("src/components/workspaces/GoogleRfpWorkspace.tsx");
[
  "POINT_TO_POINT_PRODUCT_NAME",
  "productConfiguratorForProduct",
  "executePointToPointConfigurator",
  "BUILD COMMERCIAL DESIGN",
  "Context Inspector",
  "Point-to-Point Product Configurator",
].forEach((symbol) => {
  assert(workspaceSource.includes(symbol), `Commercial workspace exposes ${symbol}.`);
});

assert(!workspaceSource.includes("Protected Dark Fiber IRU"), "Phase 1 product list contains no unsupported product options.");
assert(!read("src/products/PointToPointConfigurator.ts").includes("createScopeVersion"), "Product Configurator cannot create ScopeVersion.");

console.log(`Sprint 20D product configurator validation passed (${checks.length} checks).`);
