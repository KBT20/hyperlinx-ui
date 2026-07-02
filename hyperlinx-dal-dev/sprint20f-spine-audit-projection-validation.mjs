import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.dirname(fileURLToPath(import.meta.url));
const tempDir = path.join(root, ".tmp", "sprint20f-validation");
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
  "src/spine/SpineAuditProjectionContracts.ts",
  "src/spine/SpineAuditProjectionEngine.ts",
  "src/commercial/IOFPackageAssemblyEngine.ts",
  "src/commercial/CommercialStationReviewEngine.ts",
  "src/components/commercial/StationAwareObjectReviewPanel.tsx",
  "src/products/PointToPointConfigurator.ts",
  "server/routes/commercial-iof-packages.js",
];

requiredFiles.forEach((relativePath) => {
  assert(existsSync(path.join(root, relativePath)), `${relativePath} exists.`);
});

[
  "src/spine/SpineAuthorityContracts.ts",
  "src/spine/MeasuredSpineEngine.ts",
  "src/spine/StationAuthorityEngine.ts",
  "src/spine/StationIndexedGraphEngine.ts",
  "src/spine/ObjectStationAttachmentEngine.ts",
  "src/spine/SpineAuditProjectionEngine.ts",
  "src/commercial/IOFPackageAssemblyEngine.ts",
  "src/products/pointToPointLongHaulDoctrine.ts",
  "src/products/PointToPointConfigurator.ts",
  "src/commercial/CommercialStationReviewEngine.ts",
].forEach(transpile);

const measuredModule = await import(pathToFileURL(outPath("src/spine/MeasuredSpineEngine.ts")));
const stationModule = await import(pathToFileURL(outPath("src/spine/StationAuthorityEngine.ts")));
const graphModule = await import(pathToFileURL(outPath("src/spine/StationIndexedGraphEngine.ts")));
const attachmentModule = await import(pathToFileURL(outPath("src/spine/ObjectStationAttachmentEngine.ts")));
const projectionModule = await import(pathToFileURL(outPath("src/spine/SpineAuditProjectionEngine.ts")));
const reviewModule = await import(pathToFileURL(outPath("src/commercial/CommercialStationReviewEngine.ts")));
const configuratorModule = await import(pathToFileURL(outPath("src/products/PointToPointConfigurator.ts")));
const doctrineModule = await import(pathToFileURL(outPath("src/products/pointToPointLongHaulDoctrine.ts")));

const geometry = [
  [-97.7500, 30.2600],
  [-97.7300, 30.2650],
  [-97.7000, 30.2700],
];
const measuredSpine = measuredModule.createMeasuredSpine({
  packageId: "DRAFT-IOF-SPRINT20F",
  routeId: "ROUTE-SPRINT20F",
  geometry,
  aSite: { siteId: "SITE-A", role: "A", label: "A", coordinate: geometry[0] },
  zSite: { siteId: "SITE-Z", role: "Z", label: "Z", coordinate: geometry[geometry.length - 1] },
});
const stationAuthority = stationModule.createStationAuthority({
  measuredSpine,
  intervalFeet: 100,
  stationClass: "ENGINEERING",
});
const stationIndexedGraph = graphModule.createStationIndexedGraph({
  packageId: measuredSpine.packageId,
  measuredSpine,
  stationAuthority,
});

const station10 = stationAuthority.stations.find((station) => station.stationLabel === "10+00") ?? stationAuthority.stations[10];
const station20 = stationAuthority.stations.find((station) => station.stationLabel === "20+00") ?? stationAuthority.stations[20];
const station30 = stationAuthority.stations.find((station) => station.stationLabel === "30+00") ?? stationAuthority.stations[30];

const engineeringObjects = [
  { objectId: "OBJ-HANDHOLE-001", objectType: "HANDHOLE", label: "Handhole 1", stationId: station10.stationId, stationLabel: station10.stationLabel, coordinate: station10.coordinate, quantity: 1, unit: "each" },
  { objectId: "OBJ-ILA-001", objectType: "ILA_FACILITY", label: "ILA 1", stationId: station20.stationId, stationLabel: station20.stationLabel, coordinate: station20.coordinate, quantity: 1, unit: "each", facilityTotal: 250000 },
  { objectId: "OBJ-SPLICE-001", objectType: "SPLICE_CASE", label: "Splice Case 1", stationId: station30.stationId, stationLabel: station30.stationLabel, coordinate: station30.coordinate, quantity: 1, unit: "each" },
];
const objectStationAttachments = attachmentModule.createObjectStationAttachments({
  packageId: measuredSpine.packageId,
  objects: engineeringObjects,
  stationAuthority,
  stationIndexedGraph,
});

const auditEntries = [
  { auditId: "AUDIT-PLOW", label: "Plowing labor", value: "$120,000", unit: "USD", authorityMode: "CALCULATED", formula: "route feet * plow unit rate", source: "Transparent Estimating Engine", confidence: 86, costImpact: "Included", scheduleImpact: "Included", expectedQuantity: measuredSpine.routeLengthFeet },
  { auditId: "AUDIT-BORE-DIRT", label: "Directional bore dirt", value: "$80,000", unit: "USD", authorityMode: "CALCULATED", formula: "bore feet * dirt bore unit rate", source: "Transparent Estimating Engine", confidence: 76, costImpact: "Included", scheduleImpact: "Included", expectedQuantity: 1800 },
  { auditId: "AUDIT-CONDUIT", label: "Conduit material", value: "$95,000", unit: "USD", authorityMode: "CALCULATED", formula: "conduit feet * material unit rate", source: "Transparent Estimating Engine", confidence: 88, costImpact: "Included", scheduleImpact: "Included", expectedQuantity: measuredSpine.routeLengthFeet * 4 },
  { auditId: "AUDIT-FIBER", label: "Fiber material", value: "$210,000", unit: "USD", authorityMode: "CALCULATED", formula: "fiber feet * material unit rate", source: "Transparent Estimating Engine", confidence: 87, costImpact: "Included", scheduleImpact: "Included", expectedQuantity: measuredSpine.routeLengthFeet },
  { auditId: "AUDIT-HANDHOLE", label: "Handhole installation", value: "$8,000", unit: "USD", authorityMode: "CALCULATED", formula: "handhole count * installed unit rate", source: "Transparent Estimating Engine", confidence: 82, costImpact: "Included", scheduleImpact: "Included", expectedQuantity: 1 },
  { auditId: "AUDIT-ILA", label: "ILA facilities", value: "$250,000", unit: "USD", authorityMode: "CALCULATED", formula: "ILA facility profile capital", source: "ILA Planning Engine", confidence: 74, costImpact: "Included", scheduleImpact: "Included", expectedQuantity: 1 },
  { auditId: "AUDIT-SPLICE", label: "Splice cases", value: "$12,000", unit: "USD", authorityMode: "CALCULATED", formula: "splice case count * installed unit rate", source: "Transparent Estimating Engine", confidence: 81, costImpact: "Included", scheduleImpact: "Included", expectedQuantity: 1 },
  { auditId: "AUDIT-LIFECYCLE", label: "Layer 1 lifecycle O&M", value: "$2,400", unit: "USD", authorityMode: "CALCULATED", formula: "route miles * monthly O&M", source: "Transparent Estimating Engine", confidence: 70, costImpact: "Included", scheduleImpact: "Not included" },
  { auditId: "AUDIT-UNKNOWN-RAIL", label: "Railroad crossings UNKNOWN", value: "UNKNOWN", unit: "review", authorityMode: "REFERENCE", formula: "Rail crossing count requires review", source: "Estimate Audit", confidence: 45, costImpact: "Not included", scheduleImpact: "Included" },
  { auditId: "AUDIT-UNKNOWN-ROCK", label: "Rock percentage UNKNOWN", value: "UNKNOWN", unit: "review", authorityMode: "REFERENCE", formula: "Geotech required before engineering certification", source: "Estimate Audit", confidence: 40, costImpact: "Not included", scheduleImpact: "Included" },
];

const projection = projectionModule.createSpineAuditProjection({
  packageId: measuredSpine.packageId,
  measuredSpine,
  stationAuthority,
  stationIndexedGraph,
  engineeringObjects,
  objectStationAttachments,
  commercialAuditEntries: auditEntries,
  productionAssumptions: {
    plowFeetPerDay: 5280,
    directionalBoreDirtFeetPerDay: 600,
    openTrenchDirtFeetPerDay: 300,
    fiberBlowingFeetPerDay: 5280,
  },
  generatedAt: "2026-07-02T12:00:00.000Z",
});

assert(projection.attachments.length >= auditEntries.length, "Audit entries load.");
assert(projection.stationRangeExpectations.some((item) => item.expectationType === "PLOW"), "Plowing projects to station range.");
assert(projection.stationRangeExpectations.some((item) => item.expectationType === "BORE"), "Directional bore projects to station range.");
assert(projection.stationRangeExpectations.some((item) => item.expectationType === "CONDUIT"), "Conduit projects to spine/range.");
assert(projection.stationRangeExpectations.some((item) => item.expectationType === "FIBER"), "Fiber projects to spine/range.");
assert(projection.stationedExpectations.some((item) => item.objectType === "HANDHOLE"), "Handholes project to station objects.");
assert(projection.stationedExpectations.some((item) => item.objectType === "ILA_FACILITY"), "ILA facilities project to station objects.");
assert(projection.stationedExpectations.some((item) => item.objectType === "SPLICE_CASE"), "Splice cases project to station objects.");
assert(projection.attachments.some((item) => item.projectionType === "LIFECYCLE" && item.attachmentType === "SPINE"), "Lifecycle items attach to spine.");
assert(projection.spineReviewObjects.some((item) => item.label.includes("Railroad")), "Unknown railroad crossing creates review object.");
assert(projection.spineReviewObjects.some((item) => item.label.includes("Rock")), "Unknown rock percentage creates review object.");
assert(projection.closureExpectations.length >= projection.stationedExpectations.length + projection.stationRangeExpectations.length, "Closure expectations are created.");

const handholeLookup = projectionModule.lookupStationExpectations(projection, station10.stationId);
assert(handholeLookup?.attachedObjects.some((item) => item.objectType === "HANDHOLE"), "Station click can retrieve expected work.");
assert(handholeLookup?.closurePreview.some((item) => item.currentStatus === "NOT_STARTED"), "Station click returns closure preview with NOT_STARTED status.");

const configuratorResult = configuratorModule.executePointToPointConfigurator({
  customer: { accountId: "google", customerId: "CUSTOMER-google", customerName: "Google" },
  opportunity: { opportunityId: "OPPORTUNITY-SPRINT20F", proposalId: "PROPOSAL-SPRINT20F" },
  product: { productId: doctrineModule.POINT_TO_POINT_LONG_HAUL_PRODUCT_ID, productName: configuratorModule.POINT_TO_POINT_PRODUCT_NAME },
  aLocation: { locationId: "A", label: "A", latitude: 30.2600, longitude: -97.7500 },
  zLocation: { locationId: "Z", label: "Z", latitude: 30.2700, longitude: -97.7000 },
  routeGeometry: geometry,
  generatedAt: "2026-07-02T12:00:00.000Z",
});
const draft = configuratorResult.draftPackage;
assert(Boolean(draft.spineAuditProjection), "Draft IOF Package persists projection.");
assert(Array.isArray(draft.spineAuditAttachments) && draft.spineAuditAttachments.length > 0, "Draft IOF Package persists spineAuditAttachments.");
assert(Array.isArray(draft.stationedExpectations), "Draft IOF Package persists stationedExpectations.");
assert(Array.isArray(draft.stationRangeExpectations) && draft.stationRangeExpectations.length > 0, "Draft IOF Package persists stationRangeExpectations.");
assert(Array.isArray(draft.spineReviewObjects), "Draft IOF Package persists spineReviewObjects.");
assert(Array.isArray(draft.closureExpectations) && draft.closureExpectations.length > 0, "Draft IOF Package persists closureExpectations.");
assert(Boolean(draft.auditProjectionSummary), "Draft IOF Package persists auditProjectionSummary.");

const reviewState = reviewModule.buildCommercialStationReview(draft);
assert(reviewState.mapModes.includes("ROUTE_VIEW") && reviewState.mapModes.includes("FIELD_PREVIEW_VIEW"), "Map modes are available.");
assert(reviewState.stationExpectationLookupReady, "Commercial Review can retrieve station expectations.");
const engineeringMap = reviewModule.buildCommercialStationReviewMapSpec(draft, "ENGINEERING_REVIEW_VIEW");
assert(engineeringMap.primitives.some((primitive) => primitive.metadata?.sourceLayer === "COMMERCIAL_AUDIT_RANGE_OVERLAY"), "Engineering Review View shows audit overlays.");
const fieldMap = reviewModule.buildCommercialStationReviewMapSpec(draft, "FIELD_PREVIEW_VIEW");
assert(fieldMap.metadata?.closureExpectationCount > 0, "Field Preview View exposes closure-ready expectations without Field workflow.");

const frozen = projectionModule.freezeSpineAuditProjection(projection, "2026-07-02T12:30:00.000Z");
assert(projection.baselineState === "LIVE", "Baseline freeze does not mutate original live projection.");
assert(frozen.baselineState === "FROZEN" && frozen.summary.baselineFrozen === true, "Baseline freezes after approval.");
const delta = projectionModule.createSpineAuditProjectionRedlineDelta({
  baseline: frozen,
  next: {
    ...projection,
    attachments: [...projection.attachments, { ...projection.attachments[0], auditEntryId: "AUDIT-REDLINE-NEW", attachmentId: "ATTACHMENT-REDLINE-NEW" }],
  },
  reason: "Engineering redline audit projection delta",
  actor: "Engineering",
  createdAt: "2026-07-02T12:45:00.000Z",
});
assert(delta.addedAttachmentIds.includes("ATTACHMENT-REDLINE-NEW"), "Redline creates delta.");
assert(delta.originalBaselineImmutable === true, "Redline does not mutate baseline.");
assert(delta.noScopeVersionCreation === true && draft.noScopeVersionCreation === true, "ScopeVersion is not created.");

const panelSource = read("src/components/commercial/StationAwareObjectReviewPanel.tsx");
[
  "ROUTE_VIEW",
  "ENGINEERING_REVIEW_VIEW",
  "FIELD_PREVIEW_VIEW",
  "Station Expectation Panel",
  "Closure Preview",
].forEach((symbol) => {
  assert(panelSource.includes(symbol), `Commercial UI exposes ${symbol}.`);
});

const serverSource = read("server/routes/commercial-iof-packages.js");
assert(serverSource.includes("freezeCommercialAuditProjectionBaseline"), "Commercial submit freezes enriched spine baseline.");
assert(serverSource.includes("spineAuditProjection missing"), "Commercial submit validates audit projection readiness.");
assert(!read("src/spine/SpineAuditProjectionEngine.ts").includes("createScopeVersion"), "Spine audit projection engine cannot create ScopeVersion.");

console.log(`Sprint 20F spine audit projection validation passed (${checks.length} checks).`);
