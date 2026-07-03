import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.dirname(fileURLToPath(import.meta.url));
const tempDir = path.join(root, ".tmp", "sprint24d-validation");
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
  "src/spine/instantiation/SpineObjectInstantiationEngine.ts",
  "src/spine/instantiation/SpineObjectInstantiationContracts.ts",
  "src/spine/instantiation/SpineObjectFactory.ts",
  "src/spine/instantiation/SpineObjectIdentityEngine.ts",
  "src/spine/instantiation/SpineObjectHierarchyEngine.ts",
  "src/spine/instantiation/SpineObjectSegmentAssignmentEngine.ts",
  "src/spine/instantiation/SpineObjectProductionBindingEngine.ts",
  "src/spine/instantiation/SpineObjectInstantiationValidationEngine.ts",
  "src/spine/instantiation/SpineObjectInstantiationSummary.ts",
  "src/commercial/IOFPackageAssemblyEngine.ts",
  "src/components/workspaces/googleRfp/CommercialReviewPanel.tsx",
  "src/components/engineering/SpineObjectCatalogPanel.tsx",
  "src/engineering/EngineeringCertificationProjection.ts",
  "server/routes/commercial-iof-packages.js",
];

requiredFiles.forEach((relativePath) => {
  assert(existsSync(path.join(root, relativePath)), `${relativePath} exists.`);
});

[
  "src/doctrine/pd003/PD003ProductionContracts.ts",
  "src/doctrine/pd003/PD003ProductionDoctrine.ts",
  "src/doctrine/pd003/ProductionProfileLibrary.ts",
  "src/doctrine/pd003/ProductionScheduleProjectionEngine.ts",
  "src/doctrine/pd003/ProductionCostProjectionEngine.ts",
  "src/doctrine/pd003/ProductionPaymentProjectionEngine.ts",
  "src/doctrine/pd003/ProductionValidationEngine.ts",
  "src/doctrine/pd003/ProductionProfileEngine.ts",
  "src/spine/catalog/SpineObjectCatalogContracts.ts",
  "src/spine/catalog/SpineObjectDoctrine.ts",
  "src/spine/catalog/SpineObjectCatalog.ts",
  "src/spine/catalog/SpineObjectCatalogEngine.ts",
  "src/spine/manifest/AuditObjectManifestContracts.ts",
  "src/spine/manifest/AuditObjectManifest.ts",
  "src/spine/manifest/AuditObjectManifestEngine.ts",
  "src/spine/SpineAuthorityContracts.ts",
  "src/spine/MeasuredSpineEngine.ts",
  "src/spine/StationAuthorityEngine.ts",
  "src/spine/StationIndexedGraphEngine.ts",
  "src/spine/ObjectStationAttachmentEngine.ts",
  "src/spine/SpineAuditProjectionContracts.ts",
  "src/spine/SpineAuditProjectionEngine.ts",
  "src/doctrine/pd002/addressing/PD002AAddressingContracts.ts",
  "src/doctrine/pd002/addressing/PD002AObjectAddressingDoctrine.ts",
  "src/doctrine/pd002/addressing/PD002AAddressValidationEngine.ts",
  "src/doctrine/pd002/addressing/PD002AObjectAddressingEngine.ts",
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
  "src/engineering/EngineeringCertificationProjection.ts",
].forEach(transpile);

const measuredModule = await import(pathToFileURL(outPath("src/spine/MeasuredSpineEngine.ts")));
const stationModule = await import(pathToFileURL(outPath("src/spine/StationAuthorityEngine.ts")));
const graphModule = await import(pathToFileURL(outPath("src/spine/StationIndexedGraphEngine.ts")));
const catalogModule = await import(pathToFileURL(outPath("src/spine/catalog/SpineObjectCatalogEngine.ts")));
const manifestModule = await import(pathToFileURL(outPath("src/spine/manifest/AuditObjectManifestEngine.ts")));
const addressingModule = await import(pathToFileURL(outPath("src/doctrine/pd002/addressing/PD002AObjectAddressingEngine.ts")));
const productionModule = await import(pathToFileURL(outPath("src/doctrine/pd003/ProductionProfileEngine.ts")));
const instantiationModule = await import(pathToFileURL(outPath("src/spine/instantiation/SpineObjectInstantiationEngine.ts")));
const identityModule = await import(pathToFileURL(outPath("src/spine/instantiation/SpineObjectIdentityEngine.ts")));
const projectionModule = await import(pathToFileURL(outPath("src/engineering/EngineeringCertificationProjection.ts")));
const configuratorModule = await import(pathToFileURL(outPath("src/products/PointToPointConfigurator.ts")));
const doctrineModule = await import(pathToFileURL(outPath("src/products/pointToPointLongHaulDoctrine.ts")));

const packageId = "DRAFT-IOF-SPRINT24D";
const geometry = [
  [-97.7500, 30.2600],
  [-97.7300, 30.2650],
  [-97.7000, 30.2700],
  [-97.6700, 30.2800],
];
const measuredSpine = measuredModule.createMeasuredSpine({
  packageId,
  routeId: "ROUTE-SPRINT24D",
  geometry,
  aSite: { siteId: "SITE-A", role: "A", label: "A", coordinate: geometry[0] },
  zSite: { siteId: "SITE-Z", role: "Z", label: "Z", coordinate: geometry[geometry.length - 1] },
});
const stationAuthority = stationModule.createStationAuthority({ measuredSpine, intervalFeet: 100, stationClass: "ENGINEERING" });
const stationIndexedGraph = graphModule.createStationIndexedGraph({ packageId, measuredSpine, stationAuthority });
const catalog = catalogModule.buildSpineObjectCatalog("2026-07-03T16:00:00.000Z");
const commercialAuditEntries = [
  { auditId: "AUDIT-HH", label: "Handhole installation", expectedQuantity: 2, confidence: 86 },
  { auditId: "AUDIT-MH", label: "Manhole installation", expectedQuantity: 1, confidence: 84 },
  { auditId: "AUDIT-VLT", label: "Vault installation", expectedQuantity: 1, confidence: 84 },
  { auditId: "AUDIT-POP", label: "POP facility", expectedQuantity: 1, confidence: 80 },
  { auditId: "AUDIT-ILA", label: "ILA facility", expectedQuantity: 1, confidence: 78 },
  { auditId: "AUDIT-REGEN", label: "Regen facility", expectedQuantity: 1, confidence: 78 },
  { auditId: "AUDIT-SPLICE", label: "Splice case", expectedQuantity: 2, confidence: 82 },
  { auditId: "AUDIT-CONDUIT", label: "Conduit material", expectedQuantity: 1000, confidence: 88 },
  { auditId: "AUDIT-FIBER", label: "Fiber material", expectedQuantity: 1000, confidence: 88 },
  { auditId: "AUDIT-PLOW", label: "Plow segment", expectedQuantity: 1000, confidence: 86 },
  { auditId: "AUDIT-BORE", label: "Directional bore dirt", expectedQuantity: 300, confidence: 76 },
  { auditId: "AUDIT-ROCK-BORE", label: "Rock bore segment", expectedQuantity: 100, confidence: 64 },
  { auditId: "AUDIT-TRENCH", label: "Open trench segment", expectedQuantity: 100, confidence: 74 },
  { auditId: "AUDIT-RAIL", label: "Railroad crossing UNKNOWN", expectedQuantity: 1, confidence: 45 },
  { auditId: "AUDIT-ROCK", label: "Rock percentage UNKNOWN", expectedQuantity: 1, confidence: 40 },
];
const objectAddressing = addressingModule.createObjectAddressing({
  packageId,
  measuredSpine,
  stationAuthority,
  commercialAuditEntries,
  productIncludesFiber: true,
});
const auditObjectManifest = manifestModule.createAuditObjectManifest({
  packageId,
  catalog,
  commercialAuditEntries,
  objectAddressing,
  productConfiguration: { productId: "POINT_TO_POINT_DUCT_DARK_FIBER", productName: "Point-to-Point Duct & Dark Fiber" },
  generatedAt: "2026-07-03T16:00:00.000Z",
});
const productionArtifacts = productionModule.createPD003ProductionArtifacts({
  packageId,
  catalog,
  auditObjectManifest,
  productIncludesFiber: true,
  generatedAt: "2026-07-03T16:00:00.000Z",
});
const instantiation = instantiationModule.instantiateSpineObjects({
  packageId,
  catalog,
  auditObjectManifest,
  stationAddressRegistry: objectAddressing.stationAddressRegistry,
  objectProductionProfiles: productionArtifacts.objectProductionProfiles,
  kernelExecutionGraph: { graphId: "KEG-SPRINT24D" },
  generatedAt: "2026-07-03T16:00:00.000Z",
});

const objects = instantiation.instantiatedSpineObjects;
const objectTypes = new Set(objects.map((object) => object.objectType));
[
  "HANDHOLE",
  "MANHOLE",
  "VAULT",
  "CONDUIT",
  "FIBER",
  "SPLICE_CASE",
  "ILA",
  "REGEN",
  "POP",
  "PLOW_SEGMENT",
  "DIRECTIONAL_BORE_SEGMENT",
  "ROCK_BORE_SEGMENT",
  "OPEN_TRENCH_SEGMENT",
  "RAILROAD_CROSSING",
  "ROCK_REVIEW",
].forEach((objectType) => {
  assert(objectTypes.has(objectType), `${objectType} is instantiated.`);
});

assert(objects.every((object) => /^SPO-[A-Z]+-\d{6}$/.test(object.spineObjectId)), "Every Spine Object receives a permanent SPO identity.");
assert(objects.every((object) => object.identity.permanent === true && object.identity.referencedByKernelExecutionGraph === true), "Every identity is immutable and KEG-addressable.");
assert(objects.every((object) => object.catalogEntryId && object.authority === "SPINE_OBJECT_INSTANTIATION_AUTHORITY"), "Every object binds to catalog and instantiation authority.");
assert(objects.every((object) => object.currentState === "PLANNED"), "Every object starts in PLANNED state.");
assert(objects.every((object) => object.constructionSegmentId && object.paymentSegmentId && object.executionZoneId), "Every object has construction segment, payment segment, and execution zone.");
assert(objects.every((object) => object.objectClass === "CONSTRAINT" || object.productionProfileIds.length > 0), "Every producible object binds to PD-003 production profiles.");
assert(objects.every((object) => object.dependencyTemplate && object.executionSequenceTemplate && object.evidenceTemplate), "Every object carries dependencies, sequence, and evidence templates.");
assert(instantiation.addressBindings.length === objects.length, "Every instantiated object has an address binding.");
assert(instantiation.productionBindings.length === objects.length, "Every instantiated object has a production binding.");
assert(instantiation.spineObjectRegistry.objectCount === objects.length, "Spine Object Registry indexes all objects.");
assert(instantiation.spineObjectIdentityRegistry.identities.length === objects.length, "Identity Registry indexes all identities.");
assert(instantiation.constructionSegments.length > 0, "Construction segments are created.");
assert(instantiation.paymentSegments.every((segment) => segment.paymentEligible === false && segment.forecastOnly === true), "Payment segments remain forecast-only.");
assert(instantiation.executionZones.length > 0, "Execution zones are created.");
assert(instantiation.instantiationHealth.instantiationStatus === "PASS", "Instantiation health passes.");
assert(instantiation.instantiationSummary.expectedObjects === instantiation.instantiationSummary.createdObjects, "Expected objects equal created objects.");
assert(instantiation.hierarchySummary.parentRelationshipCount > 0, "Hierarchy parent relationships are created.");
assert(objects.filter((object) => object.objectClass === "CONTAINED_CONNECTION").every((object) => object.parentObjectId && object.addressStatus === "INHERITED"), "Contained objects inherit parent station address.");
assert(objects.filter((object) => object.objectClass === "CONSTRAINT").every((object) => object.reviewStatus === "ENGINEERING_DISPOSITION_REQUIRED"), "Review objects require Engineering disposition.");
assert(identityModule.createSpineObjectIdentity("HANDHOLE", 1).spineObjectId === "SPO-HH-000001", "Identity engine creates expected handhole prefix.");
assert(identityModule.createSpineObjectIdentity("CONDUIT", 1).spineObjectId === "SPO-CD-000001", "Identity engine creates expected conduit prefix.");
assert(identityModule.createSpineObjectIdentity("FIBER", 1).spineObjectId === "SPO-FB-000001", "Identity engine creates expected fiber prefix.");
assert(identityModule.createSpineObjectIdentity("SPLICE_CASE", 1).spineObjectId === "SPO-SC-000001", "Identity engine creates expected splice case prefix.");

const configuratorResult = configuratorModule.executePointToPointConfigurator({
  customer: { accountId: "google", customerId: "CUSTOMER-google", customerName: "Google" },
  opportunity: { opportunityId: "OPPORTUNITY-SPRINT24D", proposalId: "PROPOSAL-SPRINT24D" },
  product: { productId: doctrineModule.POINT_TO_POINT_LONG_HAUL_PRODUCT_ID, productName: configuratorModule.POINT_TO_POINT_PRODUCT_NAME },
  aLocation: { locationId: "A", label: "A", latitude: 30.2600, longitude: -97.7500 },
  zLocation: { locationId: "Z", label: "Z", latitude: 30.2800, longitude: -97.6700 },
  routeGeometry: geometry,
  generatedAt: "2026-07-03T16:00:00.000Z",
});
const draft = configuratorResult.draftPackage;
assert(Array.isArray(draft.instantiatedSpineObjects) && draft.instantiatedSpineObjects.length > 0, "Draft IOF Package persists instantiated Spine Objects.");
assert(Boolean(draft.spineObjectRegistry?.registryId), "Draft IOF Package persists Spine Object Registry.");
assert(Boolean(draft.spineObjectIdentityRegistry?.registryId), "Draft IOF Package persists Spine Object Identity Registry.");
assert(Array.isArray(draft.constructionSegments) && draft.constructionSegments.length > 0, "Draft IOF Package persists construction segments.");
assert(Array.isArray(draft.paymentSegments) && draft.paymentSegments.every((segment) => segment.paymentEligible === false), "Draft IOF Package persists forecast-only payment segments.");
assert(Array.isArray(draft.executionZones) && draft.executionZones.length > 0, "Draft IOF Package persists execution zones.");
assert(draft.instantiationHealth?.instantiationStatus === "PASS", "Draft IOF Package persists PASS instantiation health.");
assert(Boolean(draft.hierarchySummary?.summaryId), "Draft IOF Package persists hierarchy summary.");
assert(Array.isArray(draft.productionBindings) && draft.productionBindings.length === draft.instantiatedSpineObjects.length, "Draft IOF Package persists production bindings.");
assert(Array.isArray(draft.addressBindings) && draft.addressBindings.length === draft.instantiatedSpineObjects.length, "Draft IOF Package persists address bindings.");
assert(draft.kernelExecutionGraph?.referencesInstantiatedSpineObjects === true, "Kernel Execution Graph references instantiated Spine Objects.");
assert(Array.isArray(draft.kernelExecutionGraph?.spineObjectIds) && draft.kernelExecutionGraph.spineObjectIds.length === draft.instantiatedSpineObjects.length, "KEG exposes Spine Object IDs.");
assert(draft.noScopeVersionCreation === true && draft.kernelExecutionGraph.noScopeVersionCreation === true, "ScopeVersion is not created.");

const projection = projectionModule.buildEngineeringCertificationProjection(draft);
assert(projection.instantiatedSpineObjects.length === draft.instantiatedSpineObjects.length, "Engineering projection exposes instantiated Spine Objects.");
assert(projection.mapSpec.primitives.some((primitive) => primitive.metadata?.renderAuthority === "SPINE_OBJECT_INSTANTIATION_AUTHORITY"), "Engineering map renders instantiated Spine Objects.");
assert(projection.mapSpec.metadata?.instantiatedSpineObjectLayers?.includes("Construction Segments"), "Engineering map exposes Construction Segments layer.");
assert(projection.mapSpec.metadata?.instantiatedSpineObjectLayers?.includes("Execution Zones"), "Engineering map exposes Execution Zones layer.");
assert(projection.mapSpec.metadata?.instantiatedSpineObjectLayers?.includes("Payment Segments"), "Engineering map exposes Payment Segments layer.");

const assemblySource = read("src/commercial/IOFPackageAssemblyEngine.ts");
assert(assemblySource.includes("instantiateSpineObjects"), "Commercial package assembly invokes Spine Object Instantiation Engine.");
assert(assemblySource.includes("instantiatedSpineObjects"), "Commercial package assembly persists instantiated Spine Objects.");
assert(assemblySource.includes("kernelSpineObjectReferences"), "Commercial package assembly links Spine Objects to KEG.");
const serverSource = read("server/routes/commercial-iof-packages.js");
assert(serverSource.includes("instantiatedSpineObjects missing"), "Commercial submit validates instantiated Spine Objects.");
assert(serverSource.includes("spine object instantiation failed"), "Commercial submit blocks failed instantiation.");
assert(serverSource.includes("paymentSegments attempted authorization"), "Commercial submit blocks payment authorization.");

const commercialPanelSource = read("src/components/workspaces/googleRfp/CommercialReviewPanel.tsx");
[
  "Instantiation Summary",
  "Expected Objects",
  "Created Objects",
  "Review Objects",
  "Production Profiles",
  "Construction Segments",
  "Payment Segments",
  "Instantiation Health",
].forEach((symbol) => {
  assert(commercialPanelSource.includes(symbol), `Commercial Review exposes ${symbol}.`);
});

const engineeringPanelSource = read("src/components/engineering/SpineObjectCatalogPanel.tsx");
[
  "Instantiated Spine Objects",
  "Hierarchy",
  "Production Profile",
  "Construction Method",
  "Dependencies",
  "Execution Sequence",
  "Evidence",
  "Current State",
  "Review Status",
  "Address",
].forEach((symbol) => {
  assert(engineeringPanelSource.includes(symbol), `Engineering Review exposes ${symbol}.`);
});

[
  read("src/spine/instantiation/SpineObjectInstantiationEngine.ts"),
  read("src/spine/instantiation/SpineObjectFactory.ts"),
  read("src/spine/instantiation/SpineObjectIdentityEngine.ts"),
  read("src/spine/instantiation/SpineObjectProductionBindingEngine.ts"),
].forEach((source, index) => {
  assert(!source.includes("createScopeVersion"), `Sprint 24D source ${index} cannot create ScopeVersion.`);
  assert(!source.includes("createServiceOrder"), `Sprint 24D source ${index} cannot create Service Orders.`);
  assert(!source.includes("createMarketplace"), `Sprint 24D source ${index} cannot create Marketplace.`);
  assert(!source.includes("createControl"), `Sprint 24D source ${index} cannot create Control.`);
  assert(!source.includes("createField"), `Sprint 24D source ${index} cannot create Field.`);
  assert(!source.includes("createOperationalTwin"), `Sprint 24D source ${index} cannot create Operational Twin.`);
});

console.log(`Sprint 24D spine object instantiation validation passed (${checks.length} checks).`);
