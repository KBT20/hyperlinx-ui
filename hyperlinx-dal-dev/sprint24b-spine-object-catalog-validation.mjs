import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.dirname(fileURLToPath(import.meta.url));
const tempDir = path.join(root, ".tmp", "sprint24b-validation");
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
  "src/spine/catalog/SpineObjectCatalog.ts",
  "src/spine/catalog/SpineObjectCatalogContracts.ts",
  "src/spine/catalog/SpineObjectCatalogEngine.ts",
  "src/spine/catalog/SpineObjectDoctrine.ts",
  "src/spine/manifest/AuditObjectManifest.ts",
  "src/spine/manifest/AuditObjectManifestContracts.ts",
  "src/spine/manifest/AuditObjectManifestEngine.ts",
  "src/commercial/IOFPackageAssemblyEngine.ts",
  "src/components/workspaces/googleRfp/CommercialReviewPanel.tsx",
  "src/components/engineering/SpineObjectCatalogPanel.tsx",
  "src/workspaces/EngineeringCertificationWorkspace.tsx",
  "server/routes/commercial-iof-packages.js",
  "SPRINT_24B_CONSTITUTIONAL_SPINE_OBJECT_CATALOG_REPORT.md",
];

requiredFiles.forEach((relativePath) => {
  assert(existsSync(path.join(root, relativePath)), `${relativePath} exists.`);
});

[
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
  "src/engineering/EngineeringCertificationProjection.ts",
].forEach(transpile);

const catalogModule = await import(pathToFileURL(outPath("src/spine/catalog/SpineObjectCatalogEngine.ts")));
const manifestModule = await import(pathToFileURL(outPath("src/spine/manifest/AuditObjectManifestEngine.ts")));
const configuratorModule = await import(pathToFileURL(outPath("src/products/PointToPointConfigurator.ts")));
const doctrineModule = await import(pathToFileURL(outPath("src/products/pointToPointLongHaulDoctrine.ts")));
const projectionModule = await import(pathToFileURL(outPath("src/engineering/EngineeringCertificationProjection.ts")));

const catalog = catalogModule.buildSpineObjectCatalog("2026-07-03T12:00:00.000Z");
assert(catalog.authority === "SPINE_OBJECT_CATALOG_AUTHORITY", "Catalog carries constitutional authority label.");
assert(catalog.createsObjects === false && catalog.noScopeVersionCreation === true, "Catalog does not instantiate objects or create ScopeVersion.");
assert(catalog.validation.status === "PASS", "Catalog validation passes.");

[
  "PRIMARY_STRUCTURE",
  "LINEAR_INFRASTRUCTURE",
  "LINEAR_CONSTRUCTION",
  "CONTAINED_CONNECTION",
  "CONSTRAINT",
  "AUTHORITY",
].forEach((objectClass) => {
  assert(catalog.summary.objectClasses.includes(objectClass), `${objectClass} exists in catalog.`);
  assert(catalog.entries.some((entry) => entry.objectClass === objectClass), `${objectClass} has catalog entries.`);
});

[
  "HANDHOLE",
  "MANHOLE",
  "VAULT",
  "POP",
  "ILA",
  "REGEN",
  "CONDUIT",
  "FIBER",
  "INNERDUCT",
  "FUTUREPATH",
  "PLOW_SEGMENT",
  "DIRECTIONAL_BORE_SEGMENT",
  "ROCK_BORE_SEGMENT",
  "OPEN_TRENCH_SEGMENT",
  "SPLICE_CASE",
  "RAILROAD_CROSSING",
  "RIVER_CROSSING",
  "ROAD_CROSSING",
  "BRIDGE",
  "UTILITY_CONFLICT",
  "ENVIRONMENTAL_IMPACT",
  "COMMERCIAL_APPROVAL",
  "ENGINEERING_REVIEW",
  "PERMIT_PACKAGE",
  "MATERIAL_PROCUREMENT",
].forEach((objectType) => {
  assert(Boolean(catalog.byObjectType[objectType]), `${objectType} exists as a catalog object type.`);
});

catalog.entries.forEach((entry) => {
  assert(Boolean(entry.objectType && entry.displayName && entry.description), `${entry.objectType} defines identity fields.`);
  assert(Boolean(entry.profile?.identity), `${entry.objectType} has Spine Object Profile.`);
  assert(Boolean(entry.profile?.constitutionalRole), `${entry.objectType} has Constitutional Role.`);
  assert(Array.isArray(entry.profile?.constitutionalRoles) && entry.profile.constitutionalRoles.length > 0, `${entry.objectType} has constitutional role list.`);
  assert(Boolean(entry.addressType), `${entry.objectType} defines addressing behavior.`);
  assert(Boolean(entry.profile?.commercialVisibility && entry.profile?.engineeringVisibility), `${entry.objectType} defines workspace visibility in profile.`);
  assert(Boolean(entry.profile?.marketplaceVisibility && entry.profile?.controlVisibility), `${entry.objectType} defines Marketplace and Control visibility.`);
  assert(Boolean(entry.profile?.fieldVisibility && entry.profile?.operationalTwinVisibility), `${entry.objectType} defines Field and Operational Twin visibility.`);
  assert(Boolean(entry.profile?.paymentParticipation && entry.profile?.reviewParticipation), `${entry.objectType} defines payment and review participation.`);
  assert(Boolean(entry.profile?.constructionParticipation && entry.profile?.authorityOwner), `${entry.objectType} defines construction participation and authority owner.`);
  assert(entry.requiredDoctrine.length > 0, `${entry.objectType} defines required doctrine.`);
  assert(entry.doctrine?.behaviorSource === "SPINE_OBJECT_CATALOG", `${entry.objectType} defines SpineObjectDoctrine.`);
  assert(entry.doctrine?.workspaceDuplicationProhibited === true, `${entry.objectType} prohibits workspace behavior duplication.`);
  assert(Array.isArray(entry.constructionMethods) && entry.constructionMethods.length > 0, `${entry.objectType} defines SpineObjectConstructionMethods.`);
  assert(Array.isArray(entry.placementStrategies) && entry.placementStrategies.length > 0, `${entry.objectType} defines SpineObjectPlacementStrategies.`);
  assert(entry.hierarchy?.illegalHierarchyFailsValidation === true, `${entry.objectType} defines SpineObjectHierarchy.`);
  assert(entry.requiredEvidence.length > 0, `${entry.objectType} defines required evidence.`);
  assert(entry.evidenceTemplates?.requiredEvidence?.length > 0, `${entry.objectType} defines SpineObjectEvidenceTemplates.`);
  assert(entry.defaultDependencies.length > 0, `${entry.objectType} defines default dependencies.`);
  assert(entry.dependencyTemplates?.templates?.length > 0, `${entry.objectType} defines SpineObjectDependencyTemplates.`);
  assert(entry.defaultExecutionSequence.length > 0, `${entry.objectType} defines default execution sequence.`);
  assert(entry.sequenceTemplates?.templates?.length > 0, `${entry.objectType} defines SpineObjectSequenceTemplates.`);
  assert(entry.sequenceTemplates?.executionOutsideSprint24B === true, `${entry.objectType} sequence remains outside Sprint 24B execution.`);
  assert(entry.visibilityProfile?.commercial && entry.visibilityProfile?.operationalTwin, `${entry.objectType} defines SpineObjectVisibilityProfiles.`);
  assert(entry.recommendationTemplates?.every((item) => item.deterministic === true && item.noAiReasoning === true), `${entry.objectType} defines deterministic SpineObjectRecommendationTemplates.`);
  assert(Boolean(entry.defaultPaymentBehavior.validationRelationship), `${entry.objectType} defines payment validation relationship.`);
  assert(entry.defaultStatus, `${entry.objectType} defines default status.`);
});

assert(catalogModule.validateSpineObjectHierarchy(catalog, "HANDHOLE", "SPLICE_CASE") === true, "Legal parent/child hierarchy validates.");
assert(catalogModule.validateSpineObjectHierarchy(catalog, "SPLICE_CASE", "HANDHOLE") === false, "Illegal parent/child hierarchy fails.");
assert(catalog.byObjectType.CONDUIT.constructionMethods.some((item) => item.method === "Plow" && item.preference === "PREFERRED"), "Conduit recommends preferred plow construction.");
assert(catalog.byObjectType.CONDUIT.constructionMethods.some((item) => item.method === "Directional Bore" && item.preference === "FALLBACK"), "Conduit includes directional bore fallback.");
assert(catalog.byObjectType.RAILROAD_CROSSING.constructionMethods.some((item) => item.method === "Steel Casing"), "Railroad Crossing includes steel casing recommendation.");
assert(catalog.byObjectType.RIVER_CROSSING.recommendationTemplates.some((item) => item.recommendation === "Directional Bore"), "River Crossing recommends directional bore.");

const auditEntries = [
  { auditId: "AUDIT-PLOW", label: "Plowing labor", expectedQuantity: 12000, unit: "feet", confidence: 86 },
  { auditId: "AUDIT-BORE", label: "Directional bore dirt", expectedQuantity: 2500, unit: "feet", confidence: 76 },
  { auditId: "AUDIT-CONDUIT", label: "Conduit material", expectedQuantity: 48000, unit: "feet", confidence: 88 },
  { auditId: "AUDIT-FIBER", label: "Fiber material", expectedQuantity: 12000, unit: "feet", confidence: 87 },
  { auditId: "AUDIT-HANDHOLE", label: "Handhole installation", expectedQuantity: 12, unit: "each", confidence: 82 },
  { auditId: "AUDIT-ILA", label: "ILA facilities", expectedQuantity: 2, unit: "each", confidence: 74 },
  { auditId: "AUDIT-SPLICE", label: "Splice cases", expectedQuantity: 6, unit: "each", confidence: 81 },
  { auditId: "AUDIT-UNKNOWN-RAIL", label: "Railroad crossings UNKNOWN", value: "UNKNOWN", confidence: 45, formula: "Rail crossing count requires review" },
  { auditId: "AUDIT-UNKNOWN-ROCK", label: "Rock percentage UNKNOWN", value: "UNKNOWN", confidence: 40, formula: "Geotech required before engineering certification" },
];

const manifest = manifestModule.createAuditObjectManifest({
  packageId: "DRAFT-IOF-SPRINT24B",
  catalog,
  commercialAuditEntries: auditEntries,
  quantitySummary: {
    routeFeet: 12000,
    conduitFeet: 48000,
    fiberFeet: 12000,
    structureCount: 12,
    crossingCount: 1,
  },
  generatedAt: "2026-07-03T12:00:00.000Z",
});

assert(manifest.authority === "AUDIT_OBJECT_MANIFEST_AUTHORITY", "Audit Object Manifest carries authority label.");
assert(manifest.source === "COMMERCIAL_AUDIT", "Commercial Audit is the manifest source.");
assert(manifest.createsObjects === false && manifest.instantiationStatus === "NOT_INSTANTIATED_YET", "Manifest does not instantiate objects.");
assert(manifest.entries.length >= 7, "Commercial Audit creates required manifest entries.");
assert(manifest.entries.every((entry) => catalog.byObjectType[entry.objectType]), "Every manifest entry references a valid catalog entry.");
assert(manifest.entries.every((entry) => entry.createsObject === false), "Every manifest entry declares no object creation.");
assert(manifest.entries.every((entry) => entry.instantiationStatus === "NOT_INSTANTIATED_YET"), "Every manifest entry is not instantiated yet.");
assert(manifest.entries.every((entry) => entry.requiredEvidence.length > 0 && entry.defaultDependencies.length > 0), "Manifest entries inherit evidence and dependencies.");
assert(manifest.entries.every((entry) => entry.defaultExecutionSequence.length > 0), "Manifest entries inherit constitutional Close sequence.");
assert(manifest.entries.every((entry) => Boolean(entry.paymentBehavior.validationRelationship)), "Manifest entries inherit payment validation relationship.");
assert(manifest.entries.every((entry) => Boolean(entry.catalogProfile?.identity && entry.constitutionalRole)), "Manifest entries inherit Spine Object Profile and role.");
assert(manifest.entries.every((entry) => entry.constructionMethodTemplates.length > 0), "Manifest entries inherit construction method templates.");
assert(manifest.entries.every((entry) => entry.placementStrategies.length > 0), "Manifest entries inherit placement strategies.");
assert(manifest.entries.every((entry) => entry.dependencyTemplates.templates.length > 0), "Manifest entries inherit dependency templates.");
assert(manifest.entries.every((entry) => entry.sequenceTemplates.templates.length > 0), "Manifest entries inherit sequence templates.");
assert(manifest.entries.every((entry) => entry.evidenceTemplates.requiredEvidence.length > 0), "Manifest entries inherit evidence templates.");
assert(manifest.entries.every((entry) => entry.recommendationTemplates.length > 0), "Manifest entries inherit recommendation templates.");
assert(manifest.entries.some((entry) => entry.objectType === "HANDHOLE" && entry.placementStrategy.addressType === "POINT"), "Handholes manifest as point-addressed objects.");
assert(manifest.entries.some((entry) => entry.objectType === "CONDUIT" && entry.placementStrategy.addressType === "RANGE"), "Conduit manifests as station address range.");
assert(manifest.entries.some((entry) => entry.objectType === "FIBER" && entry.placementStrategy.addressType === "RANGE"), "Fiber manifests as station address range.");
assert(manifest.entries.some((entry) => entry.objectType === "SPLICE_CASE" && entry.placementStrategy.addressType === "INHERITED"), "Splice cases manifest as inherited-address contained connections.");
assert(manifest.reviewObjects.length >= 2, "Unknown commercial items become manifest review objects.");
assert(manifest.reviewObjects.every((item) => item.engineeringDispositionRequired === true), "Review objects require Engineering disposition.");
assert(manifest.reviewObjects.some((item) => item.blocking === true), "Blocking unknowns are represented.");
assert(manifest.validation.status !== "FAIL", "Manifest validation does not fail for reviewable unknowns.");

const geometry = [
  [-97.7500, 30.2600],
  [-97.7300, 30.2650],
  [-97.7000, 30.2700],
  [-97.6700, 30.2800],
];

const configuratorResult = configuratorModule.executePointToPointConfigurator({
  customer: { accountId: "google", customerId: "CUSTOMER-google", customerName: "Google" },
  opportunity: { opportunityId: "OPPORTUNITY-SPRINT24B", proposalId: "PROPOSAL-SPRINT24B" },
  product: { productId: doctrineModule.POINT_TO_POINT_LONG_HAUL_PRODUCT_ID, productName: configuratorModule.POINT_TO_POINT_PRODUCT_NAME },
  aLocation: { locationId: "A", label: "A", latitude: 30.2600, longitude: -97.7500 },
  zLocation: { locationId: "Z", label: "Z", latitude: 30.2800, longitude: -97.6700 },
  routeGeometry: geometry,
  generatedAt: "2026-07-03T12:00:00.000Z",
});

const draft = configuratorResult.draftPackage;
assert(Boolean(draft.spineObjectCatalog), "Draft IOF Package persists Spine Object Catalog.");
assert(Array.isArray(draft.spineObjectCatalogEntries) && draft.spineObjectCatalogEntries.length === draft.spineObjectCatalog.summary.catalogEntryCount, "Draft IOF Package persists catalog entries.");
assert(draft.spineObjectCatalogValidation.status === "PASS", "Draft IOF Package persists catalog validation.");
assert(Boolean(draft.auditObjectManifest), "Draft IOF Package persists Audit Object Manifest.");
assert(Array.isArray(draft.auditObjectManifestEntries) && draft.auditObjectManifestEntries.length > 0, "Draft IOF Package persists manifest entries.");
assert(Boolean(draft.auditObjectManifestSummary), "Draft IOF Package persists manifest summary.");
assert(draft.auditObjectManifest.createsObjects === false, "Draft IOF Package manifest does not instantiate objects.");
assert(draft.auditObjectManifest.instantiationDeferredUntil === "SPRINT_24C", "Instantiation is deferred to Sprint 24C.");
assert(draft.noScopeVersionCreation === true, "Draft IOF Package does not create ScopeVersion.");

const projection = projectionModule.buildEngineeringCertificationProjection(draft);
assert(projection.spineObjectCatalogEntries.length === draft.spineObjectCatalogEntries.length, "Engineering projection exposes catalog entries.");
assert(projection.auditObjectManifestEntries.length === draft.auditObjectManifestEntries.length, "Engineering projection exposes manifest entries.");
assert(projection.mapSpec.metadata?.spineObjectCatalogPanelTitle === "Spine Object Catalog", "Engineering projection exposes Spine Object Catalog panel metadata.");
assert(projection.mapSpec.metadata?.auditObjectManifestInstantiationStatus === "Not Instantiated Yet", "Engineering projection preserves no-instantiation boundary.");

const assemblySource = read("src/commercial/IOFPackageAssemblyEngine.ts");
assert(assemblySource.includes("buildSpineObjectCatalog"), "Commercial package assembly builds Spine Object Catalog.");
assert(assemblySource.includes("createAuditObjectManifest"), "Commercial package assembly builds Audit Object Manifest.");
assert(assemblySource.includes("auditObjectManifest"), "Commercial package assembly persists Audit Object Manifest.");

const commercialPanelSource = read("src/components/workspaces/googleRfp/CommercialReviewPanel.tsx");
[
  "Object Manifest Summary",
  "Catalog Entry",
  "Expected Quantity",
  "Visibility",
  "Review Objects",
  "Instantiation Pending",
].forEach((symbol) => {
  assert(commercialPanelSource.includes(symbol), `Commercial Review exposes ${symbol}.`);
});

const engineeringPanelSource = read("src/components/engineering/SpineObjectCatalogPanel.tsx");
[
  "Spine Object Catalog",
  "Catalog Entries",
  "Manifest Entries",
  "Expected Quantities",
  "Object Classes",
  "Construction Methods",
  "Placement Strategies",
  "Expected Hierarchy",
  "Dependencies",
  "Sequence Templates",
  "Evidence Templates",
  "Visibility Profiles",
  "Recommendation Templates",
  "Review Objects",
  "Not Instantiated Yet",
].forEach((symbol) => {
  assert(engineeringPanelSource.includes(symbol), `Engineering panel exposes ${symbol}.`);
});

const engineeringWorkspaceSource = read("src/workspaces/EngineeringCertificationWorkspace.tsx");
assert(engineeringWorkspaceSource.includes("SpineObjectCatalogPanel"), "Engineering workspace renders Spine Object Catalog panel.");

const serverSource = read("server/routes/commercial-iof-packages.js");
assert(serverSource.includes("spineObjectCatalog missing"), "Commercial submit validates catalog presence.");
assert(serverSource.includes("auditObjectManifest missing"), "Commercial submit validates manifest presence.");
assert(serverSource.includes("auditObjectManifest must not instantiate objects"), "Commercial submit validates no-instantiation boundary.");

[
  read("src/spine/catalog/SpineObjectCatalogEngine.ts"),
  read("src/spine/manifest/AuditObjectManifestEngine.ts"),
  read("src/components/engineering/SpineObjectCatalogPanel.tsx"),
].forEach((source, index) => {
  assert(!source.includes("createScopeVersion"), `Sprint 24B source ${index} cannot create ScopeVersion.`);
  assert(!source.includes("createServiceOrder"), `Sprint 24B source ${index} cannot create Service Orders.`);
  assert(!source.includes("createMarketplace"), `Sprint 24B source ${index} cannot create Marketplace workflow.`);
  assert(!source.includes("createControl"), `Sprint 24B source ${index} cannot create Control workflow.`);
  assert(!source.includes("createField"), `Sprint 24B source ${index} cannot create Field workflow.`);
  assert(!source.includes("createOperationalTwin"), `Sprint 24B source ${index} cannot create Operational Twin workflow.`);
});

console.log(`Sprint 24B spine object catalog validation passed (${checks.length} checks).`);
