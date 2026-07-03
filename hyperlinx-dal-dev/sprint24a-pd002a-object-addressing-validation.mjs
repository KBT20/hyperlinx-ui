import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.dirname(fileURLToPath(import.meta.url));
const tempDir = path.join(root, ".tmp", "sprint24a-validation");
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
  "src/doctrine/pd002/addressing/PD002AObjectAddressingDoctrine.ts",
  "src/doctrine/pd002/addressing/PD002AAddressingContracts.ts",
  "src/doctrine/pd002/addressing/PD002AObjectAddressingEngine.ts",
  "src/doctrine/pd002/addressing/PD002AAddressValidationEngine.ts",
  "src/doctrine/pd002/addressing/PD002AConstraintAddressingEngine.ts",
  "src/commercial/IOFPackageAssemblyEngine.ts",
  "src/engineering/EngineeringCertificationProjection.ts",
  "server/routes/commercial-iof-packages.js",
];

requiredFiles.forEach((relativePath) => {
  assert(existsSync(path.join(root, relativePath)), `${relativePath} exists.`);
});

[
  "src/doctrine/pd002/addressing/PD002AAddressingContracts.ts",
  "src/doctrine/pd002/addressing/PD002AObjectAddressingDoctrine.ts",
  "src/doctrine/pd002/addressing/PD002AAddressValidationEngine.ts",
  "src/doctrine/pd002/addressing/PD002AObjectAddressingEngine.ts",
  "src/doctrine/pd002/addressing/PD002AConstraintAddressingEngine.ts",
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

const measuredModule = await import(pathToFileURL(outPath("src/spine/MeasuredSpineEngine.ts")));
const stationModule = await import(pathToFileURL(outPath("src/spine/StationAuthorityEngine.ts")));
const addressingModule = await import(pathToFileURL(outPath("src/doctrine/pd002/addressing/PD002AObjectAddressingEngine.ts")));
const validationModule = await import(pathToFileURL(outPath("src/doctrine/pd002/addressing/PD002AAddressValidationEngine.ts")));
const assignmentModule = await import(pathToFileURL(outPath("src/doctrine/pd002/addressing/PD002AConstraintAddressingEngine.ts")));
const projectionModule = await import(pathToFileURL(outPath("src/engineering/EngineeringCertificationProjection.ts")));
const configuratorModule = await import(pathToFileURL(outPath("src/products/PointToPointConfigurator.ts")));
const doctrineModule = await import(pathToFileURL(outPath("src/products/pointToPointLongHaulDoctrine.ts")));

const geometry = [
  [-97.7500, 30.2600],
  [-97.7300, 30.2650],
  [-97.7000, 30.2700],
  [-97.6700, 30.2800],
];

const measuredSpine = measuredModule.createMeasuredSpine({
  packageId: "DRAFT-IOF-SPRINT24A",
  routeId: "ROUTE-SPRINT24A",
  geometry,
  aSite: { siteId: "SITE-A", role: "A", label: "A", coordinate: geometry[0] },
  zSite: { siteId: "SITE-Z", role: "Z", label: "Z", coordinate: geometry[geometry.length - 1] },
});
const stationAuthority = stationModule.createStationAuthority({
  measuredSpine,
  intervalFeet: 100,
  stationClass: "ENGINEERING",
});

const auditEntries = [
  { auditId: "AUDIT-HANDHOLES", label: "Handholes / manholes", expectedQuantity: 334, confidence: 82 },
  { auditId: "AUDIT-SPLICE", label: "Splice cases", expectedQuantity: 34, confidence: 81 },
  { auditId: "AUDIT-ILA", label: "ILA facilities", expectedQuantity: 1, confidence: 74 },
  { auditId: "AUDIT-PLOW", label: "Plowing", expectedQuantity: 683053, confidence: 86 },
  { auditId: "AUDIT-BORE", label: "Directional bore dirt", expectedQuantity: 99959, confidence: 76 },
  { auditId: "AUDIT-TRENCH", label: "Open trench dirt", expectedQuantity: 49979, confidence: 77 },
  { auditId: "AUDIT-CONDUIT", label: "Conduit material", expectedQuantity: 2573942, confidence: 88 },
  { auditId: "AUDIT-FIBER", label: "Fiber material", expectedQuantity: 895326, confidence: 87 },
  { auditId: "AUDIT-RAIL-UNKNOWN", label: "Railroad crossing UNKNOWN", value: "UNKNOWN", confidence: 45 },
  { auditId: "AUDIT-WATER-UNKNOWN", label: "Water crossing UNKNOWN", value: "UNKNOWN", confidence: 45 },
  { auditId: "AUDIT-DOT-UNKNOWN", label: "DOT / highway crossing UNKNOWN", value: "UNKNOWN", confidence: 45 },
  { auditId: "AUDIT-UTILITY-UNKNOWN", label: "Utility conflict UNKNOWN", value: "UNKNOWN", confidence: 45 },
  { auditId: "AUDIT-ENV-UNKNOWN", label: "Environmental impact UNKNOWN", value: "UNKNOWN", confidence: 45 },
  { auditId: "AUDIT-BRIDGE-UNKNOWN", label: "Bridge attachment UNKNOWN", value: "UNKNOWN", confidence: 45 },
  { auditId: "AUDIT-ROCK-UNKNOWN", label: "Rock percentage UNKNOWN", value: "UNKNOWN", confidence: 45 },
  { auditId: "AUDIT-RESTORATION-UNKNOWN", label: "Restoration review UNKNOWN", value: "UNKNOWN", confidence: 80 },
];

const addressing = addressingModule.createObjectAddressing({
  packageId: measuredSpine.packageId,
  measuredSpine,
  stationAuthority,
  commercialAuditEntries: auditEntries,
  quantitySummary: {
    routeFeet: measuredSpine.routeLengthFeet,
    conduitFeet: measuredSpine.routeLengthFeet * 4,
    fiberFeet: measuredSpine.routeLengthFeet,
  },
  productIncludesFiber: true,
});

assert(addressing.objectAddressingDoctrine.doctrineId === "PD-002A", "PD-002A doctrine is created.");
assert(Boolean(addressing.stationAddressRegistry), "Station address registry exists.");
assert(addressing.stationAddressRegistry.entries.length === stationAuthority.stationCount, "StationAddress contract maps every station.");
assert(addressing.objectAddresses.length > 0, "ObjectAddress contract exists.");
assert(addressing.objectAddresses.filter((address) => address.objectType === "HANDHOLE").length === 334, "Handholes receive station addresses.");
assert(addressing.objectAddresses.filter((address) => address.objectType === "SPLICE_CASE").length === 34, "Splice cases are created from audit.");
assert(addressing.objectAddresses.filter((address) => address.objectType === "SPLICE_CASE").every((address) => address.inheritedFromObjectId && address.stationAddress), "Splice cases inherit valid parent address.");
assert(addressing.objectAddresses.some((address) => address.objectType === "ILA" && address.stationAddress), "ILA receives station address.");

["PLOW_SEGMENT", "DIRECTIONAL_BORE_SEGMENT", "OPEN_TRENCH_SEGMENT", "CONDUIT_SEGMENT", "FIBER_SEGMENT"].forEach((objectType) => {
  const range = addressing.objectAddresses.find((address) => address.objectType === objectType);
  assert(Boolean(range?.fromStationAddress && range?.toStationAddress), `${objectType} receives from/to station addresses.`);
});

const ductOnly = addressingModule.createObjectAddressing({
  packageId: `${measuredSpine.packageId}-DUCT-ONLY`,
  measuredSpine: { ...measuredSpine, packageId: `${measuredSpine.packageId}-DUCT-ONLY` },
  stationAuthority: { ...stationAuthority, packageId: `${measuredSpine.packageId}-DUCT-ONLY` },
  commercialAuditEntries: auditEntries,
  quantitySummary: { routeFeet: measuredSpine.routeLengthFeet, conduitFeet: measuredSpine.routeLengthFeet * 2, fiberFeet: 0 },
  productIncludesFiber: false,
});
assert(!ductOnly.objectAddresses.some((address) => address.objectType === "FIBER_SEGMENT"), "Duct-only product excludes fiber addressing.");

const packageLevel = addressingModule.createObjectAddressing({
  packageId: "DRAFT-IOF-SPRINT24A-PACKAGE-LEVEL",
  measuredSpine: { ...measuredSpine, packageId: "DRAFT-IOF-SPRINT24A-PACKAGE-LEVEL" },
  stationAuthority: { ...stationAuthority, packageId: "DRAFT-IOF-SPRINT24A-PACKAGE-LEVEL" },
  objects: [{ objectId: "COMMERCIAL-APPROVAL-1", objectType: "COMMERCIAL_APPROVAL" }],
  commercialAuditEntries: [],
  quantitySummary: { routeFeet: measuredSpine.routeLengthFeet, conduitFeet: measuredSpine.routeLengthFeet },
  productIncludesFiber: false,
});
assert(packageLevel.objectAddresses.some((address) => address.objectId === "COMMERCIAL-APPROVAL-1" && address.addressType === "PACKAGE_LEVEL"), "Package-level objects are explicitly PACKAGE_LEVEL.");

const reviewTypes = addressing.unassignedReviewObjects.map((review) => review.reviewType);
[
  "RAILROAD_CROSSING_UNKNOWN",
  "WATER_CROSSING_UNKNOWN",
  "DOT_HIGHWAY_CROSSING_UNKNOWN",
  "UTILITY_CONFLICT_UNKNOWN",
  "ENVIRONMENTAL_IMPACT_UNKNOWN",
  "BRIDGE_ATTACHMENT_UNKNOWN",
  "ROCK_PERCENTAGE_UNKNOWN",
  "RESTORATION_REVIEW_UNKNOWN",
].forEach((reviewType) => {
  assert(reviewTypes.includes(reviewType), `${reviewType} creates pending review object.`);
});
assert(addressing.unassignedReviewObjects.every((review) => ["PENDING_REVIEW", "UNASSIGNED"].includes(review.addressStatus)), "Review objects can remain unassigned but visible.");

const targetReview = addressing.unassignedReviewObjects.find((review) => review.reviewType === "RAILROAD_CROSSING_UNKNOWN");
const baselineBefore = JSON.stringify(addressing);
const assignment = assignmentModule.assignReviewObjectAddress({
  draftPackage: {
    packageId: measuredSpine.packageId,
    stationAuthority,
    stationAddressRegistry: addressing.stationAddressRegistry,
    objectAddresses: addressing.objectAddresses,
    unassignedReviewObjects: addressing.unassignedReviewObjects,
    addressedReviewObjects: addressing.addressedReviewObjects,
    addressAssignmentEvents: addressing.addressAssignmentEvents,
  },
  reviewObjectId: targetReview.reviewObjectId,
  clickedCoordinate: stationAuthority.stations[10].coordinate,
  addressType: "POINT",
  actor: "Engineering",
  reason: "Assign railroad review to nearest measured spine station.",
  assignedAt: "2026-07-03T12:00:00.000Z",
});
assert(assignment.addressedReviewObject.addressStatus === "ENGINEERING_ASSIGNED", "Assigned review object becomes ENGINEERING_ASSIGNED.");
assert(assignment.addressedReviewObject.objectAddress.stationAddress.stationId === stationAuthority.stations[10].stationId, "assignReviewObjectAddress snaps to nearest station.");
assert(assignment.commercialBaselineMutated === false, "Engineering assignment does not mutate Commercial Baseline.");
assert(JSON.stringify(addressing) === baselineBefore, "Assigning review object preserves original unassigned review record in baseline object.");
assert(assignment.addressAssignmentEvent.originalReviewRecordPreserved === true, "Assignment event preserves original review record.");

const invalidPointValidation = validationModule.validateObjectAddresses({
  packageId: measuredSpine.packageId,
  stationAuthority,
  stationAddressRegistry: addressing.stationAddressRegistry,
  objectAddresses: [{
    objectId: "MISSING-POINT",
    objectType: "HANDHOLE",
    addressType: "POINT",
    addressStatus: "UNASSIGNED",
    addressAuthority: "PD002A_OBJECT_ADDRESSING_AUTHORITY",
    addressSource: "TEST",
    requiresEngineeringReview: true,
    requiresFieldRedlineReview: false,
    notes: [],
  }],
  unassignedReviewObjects: [],
});
assert(invalidPointValidation.status === "FAIL", "Address validation fails required object missing address.");

const invalidRangeValidation = validationModule.validateObjectAddresses({
  packageId: measuredSpine.packageId,
  stationAuthority,
  stationAddressRegistry: addressing.stationAddressRegistry,
  objectAddresses: [{
    objectId: "INVALID-RANGE",
    objectType: "PLOW_SEGMENT",
    addressType: "RANGE",
    fromStationAddress: addressing.stationAddressRegistry.entries[10],
    toStationAddress: addressing.stationAddressRegistry.entries[1],
    fromMeasureFeet: addressing.stationAddressRegistry.entries[10].measureFeet,
    toMeasureFeet: addressing.stationAddressRegistry.entries[1].measureFeet,
    addressStatus: "ALGORITHM_ASSIGNED",
    addressAuthority: "PD002A_OBJECT_ADDRESSING_AUTHORITY",
    addressSource: "TEST",
    requiresEngineeringReview: false,
    requiresFieldRedlineReview: false,
    notes: [],
  }],
  unassignedReviewObjects: [],
});
assert(invalidRangeValidation.status === "FAIL", "Address validation fails invalid range.");

const nonBlockingReview = addressingModule.createObjectAddressing({
  packageId: "DRAFT-IOF-SPRINT24A-WARNING",
  measuredSpine: { ...measuredSpine, packageId: "DRAFT-IOF-SPRINT24A-WARNING" },
  stationAuthority: { ...stationAuthority, packageId: "DRAFT-IOF-SPRINT24A-WARNING" },
  commercialAuditEntries: [{ auditId: "AUDIT-RESTORATION-NONBLOCKING", label: "Restoration review UNKNOWN", value: "UNKNOWN", confidence: 90 }],
  quantitySummary: { routeFeet: measuredSpine.routeLengthFeet, conduitFeet: measuredSpine.routeLengthFeet },
  productIncludesFiber: false,
});
assert(nonBlockingReview.addressValidation.status === "WARNING", "Address validation warns non-blocking pending review.");

const configuratorResult = configuratorModule.executePointToPointConfigurator({
  customer: { accountId: "google", customerId: "CUSTOMER-google", customerName: "Google" },
  opportunity: { opportunityId: "OPPORTUNITY-SPRINT24A", proposalId: "PROPOSAL-SPRINT24A" },
  product: { productId: doctrineModule.POINT_TO_POINT_LONG_HAUL_PRODUCT_ID, productName: configuratorModule.POINT_TO_POINT_PRODUCT_NAME },
  aLocation: { locationId: "A", label: "A", latitude: 30.2600, longitude: -97.7500 },
  zLocation: { locationId: "Z", label: "Z", latitude: 30.2800, longitude: -97.6700 },
  routeGeometry: geometry,
  generatedAt: "2026-07-03T12:30:00.000Z",
});
const draft = configuratorResult.draftPackage;
assert(Boolean(draft.objectAddressingDoctrine), "Draft IOF persists objectAddressingDoctrine.");
assert(Boolean(draft.stationAddressRegistry), "Draft IOF persists address registry.");
assert(Array.isArray(draft.objectAddresses) && draft.objectAddresses.length > 0, "Draft IOF persists objectAddresses.");
assert(Array.isArray(draft.unassignedReviewObjects), "Draft IOF persists unassignedReviewObjects.");
assert(Array.isArray(draft.addressedReviewObjects), "Draft IOF persists addressedReviewObjects.");
assert(Boolean(draft.addressValidation), "Draft IOF persists addressValidation.");
assert(Array.isArray(draft.addressAssignmentEvents), "Draft IOF persists addressAssignmentEvents.");
assert(Boolean(draft.addressProjectionSummary), "Draft IOF persists addressProjectionSummary.");

const projection = projectionModule.buildEngineeringCertificationProjection(draft);
const layerNames = JSON.stringify(projection.mapSpec.metadata.objectAddressingLayers);
[
  "Handholes / Manholes",
  "Vaults",
  "Splice Cases",
  "ILAs",
  "Civil Ranges",
  "Conduit",
  "Fiber",
  "Crossings",
  "Pending Review Objects",
  "Addressed Review Objects",
  "Engineering Deltas",
].forEach((layer) => {
  assert(layerNames.includes(layer), `Engineering map exposes ${layer} object addressing layer.`);
});
assert(projection.mapSpec.primitives.some((primitive) => primitive.metadata?.sourceLayer === "PD002A_CIVIL_RANGES"), "Engineering map projects civil ranges.");
assert(projection.mapSpec.primitives.some((primitive) => primitive.metadata?.sourceLayer === "PD002A_CONDUIT"), "Engineering map projects conduit ranges.");
assert(projection.mapSpec.primitives.some((primitive) => primitive.metadata?.sourceLayer === "PD002A_FIBER"), "Engineering map projects fiber ranges.");
assert(projection.compliance.some((row) => row.key === "object addressing"), "PD-002A object addressing is part of Engineering compliance.");

const contractsSource = read("src/doctrine/pd002/addressing/PD002AAddressingContracts.ts");
assert(contractsSource.includes("interface StationAddress"), "StationAddress contract exists.");
assert(contractsSource.includes("interface ObjectAddress"), "ObjectAddress contract exists.");
assert(contractsSource.includes("POINT") && contractsSource.includes("RANGE") && contractsSource.includes("PACKAGE_LEVEL"), "Address types include point, range, and package-level.");
assert(contractsSource.includes("UNASSIGNED") && contractsSource.includes("PENDING_REVIEW") && contractsSource.includes("ENGINEERING_ASSIGNED"), "Address statuses include review and Engineering assignment states.");

const engineSource = read("src/doctrine/pd002/addressing/PD002AObjectAddressingEngine.ts");
assert(engineSource.includes("PD-002A_CONTAINED_OBJECT_INHERITANCE"), "Contained object inheritance exists.");
assert(engineSource.includes("AUDIT_DERIVED_HANDHOLE_SPACING"), "Audit-derived handhole addressing exists.");
assert(engineSource.includes("PD-002A_AUDIT_DERIVED_CIVIL_RANGE"), "Audit-derived civil range addressing exists.");
assert(engineSource.includes("PD-002A_AUDIT_DERIVED_CONDUIT_RANGE"), "Audit-derived conduit range addressing exists.");
assert(engineSource.includes("PD-002A_AUDIT_DERIVED_FIBER_RANGE"), "Audit-derived fiber range addressing exists.");

const assignmentSource = read("src/doctrine/pd002/addressing/PD002AConstraintAddressingEngine.ts");
assert(assignmentSource.includes("assignReviewObjectAddress"), "assignReviewObjectAddress function exists.");
assert(assignmentSource.includes("nearestStationAddress"), "Assignment snaps clicked coordinate to nearest station.");
assert(assignmentSource.includes("commercialBaselineMutated: false"), "Assignment records no Commercial Baseline mutation.");

const serverSource = read("server/routes/commercial-iof-packages.js");
assert(serverSource.includes("stationAddressRegistry missing"), "Commercial package API validates station address registry persistence.");
assert(serverSource.includes("objectAddresses missing"), "Commercial package API validates object address persistence.");
assert(serverSource.includes("addressValidation missing"), "Commercial package API validates address validation persistence.");

const noWorkflowSources = [
  contractsSource,
  engineSource,
  assignmentSource,
  read("src/doctrine/pd002/addressing/PD002AAddressValidationEngine.ts"),
  read("src/commercial/IOFPackageAssemblyEngine.ts"),
  read("src/engineering/EngineeringCertificationProjection.ts"),
].join("\n");
assert(!noWorkflowSources.includes("createScopeVersion"), "ScopeVersion is not created.");
assert(!noWorkflowSources.includes("createServiceOrder"), "Service Order is not created.");
assert(!noWorkflowSources.includes("createMarketplace"), "Marketplace is not created.");
assert(!noWorkflowSources.includes("createControl"), "Control is not created.");
assert(!noWorkflowSources.includes("FieldWorkflow"), "Field is not created.");

console.log(`Sprint 24A PD-002A object addressing validation passed (${checks.length} checks).`);
