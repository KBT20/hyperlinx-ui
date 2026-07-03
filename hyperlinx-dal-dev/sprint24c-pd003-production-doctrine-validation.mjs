import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.dirname(fileURLToPath(import.meta.url));
const tempDir = path.join(root, ".tmp", "sprint24c-validation");
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
  "src/doctrine/pd003/PD003ProductionDoctrine.ts",
  "src/doctrine/pd003/PD003ProductionContracts.ts",
  "src/doctrine/pd003/ProductionProfileLibrary.ts",
  "src/doctrine/pd003/ProductionProfileEngine.ts",
  "src/doctrine/pd003/ProductionScheduleProjectionEngine.ts",
  "src/doctrine/pd003/ProductionCostProjectionEngine.ts",
  "src/doctrine/pd003/ProductionPaymentProjectionEngine.ts",
  "src/doctrine/pd003/ProductionValidationEngine.ts",
  "src/spine/catalog/SpineObjectCatalog.ts",
  "src/spine/catalog/SpineObjectCatalogContracts.ts",
  "src/commercial/IOFPackageAssemblyEngine.ts",
  "src/components/workspaces/googleRfp/CommercialReviewPanel.tsx",
  "src/components/engineering/SpineObjectCatalogPanel.tsx",
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
  "src/spine/instantiation/SpineObjectInstantiationContracts.ts",
  "src/spine/instantiation/SpineObjectIdentityEngine.ts",
  "src/spine/instantiation/SpineObjectProductionBindingEngine.ts",
  "src/spine/instantiation/SpineObjectSegmentAssignmentEngine.ts",
  "src/spine/instantiation/SpineObjectFactory.ts",
  "src/spine/instantiation/SpineObjectHierarchyEngine.ts",
  "src/spine/instantiation/SpineObjectInstantiationSummary.ts",
  "src/spine/instantiation/SpineObjectInstantiationValidationEngine.ts",
  "src/spine/instantiation/SpineObjectInstantiationEngine.ts",
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
  "src/products/ProductDoctrineContracts.ts",
  "src/products/pointToPointLongHaulDoctrine.ts",
  "src/commercial/IOFPackageAssemblyEngine.ts",
  "src/products/PointToPointConfigurator.ts",
].forEach(transpile);

const libraryModule = await import(pathToFileURL(outPath("src/doctrine/pd003/ProductionProfileLibrary.ts")));
const profileModule = await import(pathToFileURL(outPath("src/doctrine/pd003/ProductionProfileEngine.ts")));
const scheduleModule = await import(pathToFileURL(outPath("src/doctrine/pd003/ProductionScheduleProjectionEngine.ts")));
const costModule = await import(pathToFileURL(outPath("src/doctrine/pd003/ProductionCostProjectionEngine.ts")));
const catalogModule = await import(pathToFileURL(outPath("src/spine/catalog/SpineObjectCatalogEngine.ts")));
const manifestModule = await import(pathToFileURL(outPath("src/spine/manifest/AuditObjectManifestEngine.ts")));
const configuratorModule = await import(pathToFileURL(outPath("src/products/PointToPointConfigurator.ts")));
const doctrineModule = await import(pathToFileURL(outPath("src/products/pointToPointLongHaulDoctrine.ts")));

const library = libraryModule.createProductionProfileLibrary("2026-07-03T15:00:00.000Z");
assert(library.authority === "PRODUCTION_PROFILE_LIBRARY_AUTHORITY", "Production Profile Library carries authority.");

[
  "PLOW_STANDARD",
  "BORE_DIRT_STANDARD",
  "BORE_ROCK_STANDARD",
  "OPEN_TRENCH_DIRT_STANDARD",
  "OPEN_TRENCH_ROCK_STANDARD",
  "FIBER_BLOW_STANDARD",
  "FIBER_PULL_STANDARD",
  "SPLICE_864_STANDARD",
  "TESTING_INCLUDED_WITH_SPLICING",
  "RESTORATION_INCLUDED_STANDARD",
  "HYDROVAC_INCLUDED_STANDARD",
  "PROJECT_MANAGEMENT_STANDARD",
  "MATERIAL_CONDUIT_1_5_STANDARD",
  "MATERIAL_FUTUREPATH_STANDARD",
  "MATERIAL_FIBER_864_STANDARD",
  "MATERIAL_HANDHOLE_STANDARD",
  "MATERIAL_SPLICE_CASE_STANDARD",
].forEach((profileId) => {
  assert(Boolean(library.byProfileId[profileId]), `${profileId} exists.`);
});

assert(library.byProfileId.PLOW_STANDARD.productionRate === 5280, "Plow production rate matches audit value.");
assert(library.byProfileId.PLOW_STANDARD.laborRate === 5, "Plow labor rate matches audit value.");
assert(library.byProfileId.BORE_DIRT_STANDARD.productionRate === 600, "Directional bore dirt production rate matches audit value.");
assert(library.byProfileId.BORE_DIRT_STANDARD.laborRate === 11, "Directional bore dirt labor rate matches audit value.");
assert(library.byProfileId.BORE_ROCK_STANDARD.productionRate === 300, "Directional bore rock production rate matches audit value.");
assert(library.byProfileId.BORE_ROCK_STANDARD.requiresHumanReview === true, "Directional bore rock requires human review.");
assert(library.byProfileId.OPEN_TRENCH_DIRT_STANDARD.productionRate === 300, "Open trench dirt production rate matches audit value.");
assert(library.byProfileId.OPEN_TRENCH_DIRT_STANDARD.laborRate === 38, "Open trench labor rate matches audit value.");
assert(library.byProfileId.OPEN_TRENCH_ROCK_STANDARD.productionRate === 150, "Open trench rock production rate matches audit value.");
assert(library.byProfileId.FIBER_BLOW_STANDARD.productionRate === 5280, "Fiber blow production rate matches audit value.");
assert(library.byProfileId.FIBER_PULL_STANDARD.productionRate === 5280, "Fiber pull production rate matches audit value.");
assert(library.byProfileId.FIBER_BLOW_STANDARD.laborRate === 1, "Fiber labor rate matches audit value.");
assert(library.byProfileId.SPLICE_864_STANDARD.productionRate === 1728, "Splicing production rate matches audit value.");
assert(library.byProfileId.SPLICE_864_STANDARD.laborRate === 15, "Splicing labor rate matches audit value.");
assert(library.byProfileId.PROJECT_MANAGEMENT_STANDARD.annualLoadedCost === 100000, "Project manager loaded cost matches audit value.");
assert(library.byProfileId.MATERIAL_CONDUIT_1_5_STANDARD.materialRate === 0.65, "Conduit material rate matches audit value.");
assert(library.byProfileId.MATERIAL_FUTUREPATH_STANDARD.materialRate === 1.8, "FuturePath material rate matches audit value.");
assert(library.byProfileId.MATERIAL_FIBER_864_STANDARD.materialRate === 5, "Fiber material rate matches audit value.");
assert(library.byProfileId.MATERIAL_HANDHOLE_STANDARD.laborRate === 315, "Handhole labor rate matches audit value.");
assert(library.byProfileId.MATERIAL_HANDHOLE_STANDARD.materialRate === 900, "Handhole material rate matches audit value.");
assert(library.byProfileId.MATERIAL_SPLICE_CASE_STANDARD.materialRate === 850, "Splice case material rate matches audit value.");
assert(library.byProfileId.TESTING_INCLUDED_WITH_SPLICING.productionRate === "INCLUDED" && library.byProfileId.TESTING_INCLUDED_WITH_SPLICING.costParticipation === false, "Testing included profile exists.");
assert(library.byProfileId.RESTORATION_INCLUDED_STANDARD.productionRate === "INCLUDED" && library.byProfileId.RESTORATION_INCLUDED_STANDARD.costParticipation === false, "Restoration included profile exists.");
assert(library.byProfileId.HYDROVAC_INCLUDED_STANDARD.productionRate === "INCLUDED" && library.byProfileId.HYDROVAC_INCLUDED_STANDARD.costParticipation === false, "Hydrovac included profile exists.");

const catalog = catalogModule.buildSpineObjectCatalog("2026-07-03T15:00:00.000Z");
assert(catalog.byObjectType.PLOW_SEGMENT.primaryProductionProfileId === "PLOW_STANDARD", "Plow segment references PLOW_STANDARD.");
assert(catalog.byObjectType.DIRECTIONAL_BORE_SEGMENT.primaryProductionProfileId === "BORE_DIRT_STANDARD", "Bore segment references BORE_DIRT_STANDARD.");
assert(catalog.byObjectType.ROCK_BORE_SEGMENT.primaryProductionProfileId === "BORE_ROCK_STANDARD", "Rock bore references BORE_ROCK_STANDARD.");
assert(catalog.byObjectType.OPEN_TRENCH_SEGMENT.primaryProductionProfileId === "OPEN_TRENCH_DIRT_STANDARD", "Open trench references OPEN_TRENCH_DIRT_STANDARD.");
assert(catalog.byObjectType.FIBER.productionProfileIds.includes("FIBER_BLOW_STANDARD"), "Fiber references fiber production profile.");
assert(catalog.byObjectType.CONDUIT.materialProfileIds.includes("MATERIAL_CONDUIT_1_5_STANDARD"), "Conduit references material profile.");
assert(catalog.byObjectType.FIBER.materialProfileIds.includes("MATERIAL_FIBER_864_STANDARD"), "Fiber references material profile.");
assert(catalog.byObjectType.HANDHOLE.primaryProductionProfileId === "MATERIAL_HANDHOLE_STANDARD", "Handhole references material/labor profile.");
assert(catalog.byObjectType.SPLICE_CASE.primaryProductionProfileId === "SPLICE_864_STANDARD", "Splice case references splice production profile.");

const duration = scheduleModule.calculateDurationDays(5280, library.byProfileId.PLOW_STANDARD);
assert(duration === 1, "Duration calculation works.");
const crewAdjusted = scheduleModule.calculateCrewAdjustedDurationDays(10560, { ...library.byProfileId.PLOW_STANDARD, crewCountDefault: 2 });
assert(crewAdjusted === 1, "Crew-adjusted duration calculation works.");
assert(scheduleModule.calculateWeeklyProduction(library.byProfileId.PLOW_STANDARD) === 26400, "Weekly production calculation works.");
assert(costModule.calculateProductionCost(1000, library.byProfileId.PLOW_STANDARD) === 5000, "Production cost calculation works.");
assert(costModule.calculateMaterialCost(1000, library.byProfileId.MATERIAL_CONDUIT_1_5_STANDARD) === 650, "Material cost calculation works.");
assert(Math.round(costModule.calculateProjectManagementCost(260, library.byProfileId.PROJECT_MANAGEMENT_STANDARD)) === 100000, "Project management cost calculation works.");

const auditManifest = manifestModule.createAuditObjectManifest({
  packageId: "DRAFT-IOF-SPRINT24C",
  catalog,
  commercialAuditEntries: [
    { auditId: "AUDIT-PLOW", label: "Plowing labor", expectedQuantity: 5280 },
    { auditId: "AUDIT-BORE", label: "Directional bore dirt", expectedQuantity: 600 },
    { auditId: "AUDIT-FIBER", label: "Fiber material", expectedQuantity: 5280 },
    { auditId: "AUDIT-SPLICE", label: "Splice cases", expectedQuantity: 1 },
    { auditId: "AUDIT-HANDHOLE", label: "Handhole installation", expectedQuantity: 2 },
  ],
  quantitySummary: { routeFeet: 5280, conduitFeet: 21120, fiberFeet: 5280, structureCount: 2 },
});

const productionArtifacts = profileModule.createPD003ProductionArtifacts({
  packageId: "DRAFT-IOF-SPRINT24C",
  catalog,
  auditObjectManifest: auditManifest,
  productIncludesFiber: true,
  generatedAt: "2026-07-03T15:00:00.000Z",
});
assert(productionArtifacts.productionDoctrine.principle === "PRODUCTION_IS_DETERMINISTIC", "PD-003 doctrine exists.");
assert(productionArtifacts.objectProductionProfiles.some((item) => item.objectType === "FIBER" && item.profileId === "FIBER_BLOW_STANDARD"), "Fiber references fiber profile when product includes fiber.");
assert(productionArtifacts.productionScheduleProjection.length > 0, "Production schedule projection exists.");
assert(productionArtifacts.productionCostProjection.length > 0, "Production cost projection exists.");
assert(productionArtifacts.productionPaymentProjection.length > 0, "Production payment projection exists.");
assert(productionArtifacts.productionPaymentProjection.every((item) => item.paymentEligible === false && item.reason === "Validation required"), "Payment projection is forecast only.");
assert(productionArtifacts.productionPaymentProjection.every((item) => item.noPaymentAuthorization === true), "Payment is not authorized without validation.");
assert(productionArtifacts.productionReviewObjects.some((item) => item.profileId === "BORE_ROCK_STANDARD" || item.reviewType === "HUMAN_REVIEW_REQUIRED") || productionArtifacts.productionValidation.status !== "FAIL", "Production review handling is available.");

const ductOnly = profileModule.createPD003ProductionArtifacts({
  packageId: "DRAFT-IOF-SPRINT24C-DUCT",
  catalog,
  auditObjectManifest: auditManifest,
  productIncludesFiber: false,
  generatedAt: "2026-07-03T15:00:00.000Z",
});
assert(!ductOnly.objectProductionProfiles.some((item) => item.objectType === "FIBER"), "Duct-only product excludes fiber production.");

const unknownManifest = manifestModule.createAuditObjectManifest({
  packageId: "DRAFT-IOF-SPRINT24C-UNKNOWN",
  catalog,
  commercialAuditEntries: [{ auditId: "AUDIT-ROCK", label: "Rock bore", expectedQuantity: 300 }],
  quantitySummary: { routeFeet: 300 },
});
const unknownArtifacts = profileModule.createPD003ProductionArtifacts({
  packageId: "DRAFT-IOF-SPRINT24C-UNKNOWN",
  catalog,
  auditObjectManifest: unknownManifest,
  productIncludesFiber: false,
});
assert(unknownArtifacts.productionReviewObjects.some((item) => item.reviewType === "CONFIGURABLE_RATE" || item.reviewType === "HUMAN_REVIEW_REQUIRED"), "Unknown/configurable production value creates Review Object.");

const override = profileModule.applyProductionHumanOverride(library.byProfileId.BORE_ROCK_STANDARD, {
  field: "laborRate",
  overrideValue: 24,
  overrideUnit: "USD/ft",
  reason: "Geotech quote received",
  actor: "Engineering",
  timestamp: "2026-07-03T15:10:00.000Z",
  confidence: 82,
  authority: "ENGINEERING_PRODUCTION_OVERRIDE",
  source: "Geotech quote",
  requiresApproval: true,
});
assert(override.override.replacesProfileValue === "CONFIGURABLE", "Human override records replaced profile value.");
assert(override.override.noSilentOverride === true && override.override.requiresApproval === true, "Human override records provenance and approval requirement.");

const geometry = [
  [-97.7500, 30.2600],
  [-97.7300, 30.2650],
  [-97.7000, 30.2700],
  [-97.6700, 30.2800],
];
const configuratorResult = configuratorModule.executePointToPointConfigurator({
  customer: { accountId: "google", customerId: "CUSTOMER-google", customerName: "Google" },
  opportunity: { opportunityId: "OPPORTUNITY-SPRINT24C", proposalId: "PROPOSAL-SPRINT24C" },
  product: { productId: doctrineModule.POINT_TO_POINT_LONG_HAUL_PRODUCT_ID, productName: configuratorModule.POINT_TO_POINT_PRODUCT_NAME },
  aLocation: { locationId: "A", label: "A", latitude: 30.2600, longitude: -97.7500 },
  zLocation: { locationId: "Z", label: "Z", latitude: 30.2800, longitude: -97.6700 },
  routeGeometry: geometry,
  generatedAt: "2026-07-03T15:00:00.000Z",
});
const draft = configuratorResult.draftPackage;
assert(Boolean(draft.productionDoctrine), "Draft IOF persists productionDoctrine.");
assert(Array.isArray(draft.productionProfiles) && draft.productionProfiles.length >= library.profiles.length, "Draft IOF persists productionProfiles.");
assert(Array.isArray(draft.objectProductionProfiles) && draft.objectProductionProfiles.length > 0, "Draft IOF persists objectProductionProfiles.");
assert(Boolean(draft.productionProjectionSummary), "Draft IOF persists productionProjectionSummary.");
assert(Array.isArray(draft.productionScheduleProjection) && draft.productionScheduleProjection.length > 0, "Draft IOF persists productionScheduleProjection.");
assert(Array.isArray(draft.productionCostProjection) && draft.productionCostProjection.length > 0, "Draft IOF persists productionCostProjection.");
assert(Array.isArray(draft.productionPaymentProjection) && draft.productionPaymentProjection.length > 0, "Draft IOF persists productionPaymentProjection.");
assert(Array.isArray(draft.productionReviewObjects), "Draft IOF persists productionReviewObjects.");
assert(Boolean(draft.productionValidation), "Draft IOF persists productionValidation.");
assert(draft.productionPaymentProjection.every((item) => item.paymentEligible === false), "Draft IOF payment projection remains forecast only.");
assert(draft.noScopeVersionCreation === true, "Draft IOF does not create ScopeVersion.");

const commercialPanelSource = read("src/components/workspaces/googleRfp/CommercialReviewPanel.tsx");
[
  "Production Doctrine Summary",
  "production profiles used",
  "Projected Crew Days",
  "Weekly Production",
  "Payment Projection Basis",
].forEach((symbol) => {
  assert(commercialPanelSource.toLowerCase().includes(symbol.toLowerCase()), `Commercial displays ${symbol}.`);
});

const engineeringPanelSource = read("src/components/engineering/SpineObjectCatalogPanel.tsx");
[
  "Production Profile",
  "Crew",
  "Schedule",
  "Payment",
  "Human Override",
  "Review Required",
].forEach((symbol) => {
  assert(engineeringPanelSource.includes(symbol), `Engineering displays ${symbol}.`);
});

const serverSource = read("server/routes/commercial-iof-packages.js");
assert(serverSource.includes("productionDoctrine missing"), "Commercial submit validates productionDoctrine.");
assert(serverSource.includes("production payment projection attempted authorization"), "Commercial submit blocks payment authorization.");

[
  read("src/doctrine/pd003/ProductionProfileEngine.ts"),
  read("src/doctrine/pd003/ProductionPaymentProjectionEngine.ts"),
  read("src/commercial/IOFPackageAssemblyEngine.ts"),
].forEach((source, index) => {
  assert(!source.includes("createScopeVersion"), `PD-003 source ${index} cannot create ScopeVersion.`);
  assert(!source.includes("createServiceOrder"), `PD-003 source ${index} cannot create Service Orders.`);
  assert(!source.includes("createMarketplace"), `PD-003 source ${index} cannot create Marketplace workflow.`);
  assert(!source.includes("createControl"), `PD-003 source ${index} cannot create Control workflow.`);
  assert(!source.includes("createField"), `PD-003 source ${index} cannot create Field workflow.`);
});

console.log(`Sprint 24C PD-003 production doctrine validation passed (${checks.length} checks).`);
