import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.dirname(fileURLToPath(import.meta.url));
const tempDir = path.join(root, ".tmp", "sprint20c-validation");
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

function near(a, b, tolerance = 0.001) {
  return Math.abs(a - b) <= tolerance;
}

rmSync(tempDir, { recursive: true, force: true });
mkdirSync(tempDir, { recursive: true });

const requiredFiles = [
  "src/commercial/CommercialStationReviewEngine.ts",
  "src/commercial/CommercialObjectPlacementEngine.ts",
  "src/components/commercial/StationAwareObjectReviewPanel.tsx",
  "src/components/workspaces/GoogleRfpWorkspace.tsx",
  "src/commercial/IOFPackageAssemblyEngine.ts",
  "src/engineering/EngineeringCertificationProjection.ts",
  "server/routes/commercial-iof-packages.js",
];

requiredFiles.forEach((relativePath) => {
  assert(existsSync(path.join(root, relativePath)), `${relativePath} exists.`);
});

[
  "src/spine/SpineAuthorityContracts.ts",
  "src/spine/MeasuredSpineEngine.ts",
  "src/spine/StationAuthorityEngine.ts",
  "src/spine/ObjectStationAttachmentEngine.ts",
  "src/spine/StationIndexedGraphEngine.ts",
  "src/spine/SpineAuditProjectionEngine.ts",
  "src/commercial/CommercialStationReviewEngine.ts",
  "src/commercial/CommercialObjectPlacementEngine.ts",
  "src/engineering/EngineeringCertificationProjection.ts",
].forEach(transpile);

const measuredModule = await import(pathToFileURL(outPath("src/spine/MeasuredSpineEngine.ts")));
const stationModule = await import(pathToFileURL(outPath("src/spine/StationAuthorityEngine.ts")));
const attachmentModule = await import(pathToFileURL(outPath("src/spine/ObjectStationAttachmentEngine.ts")));
const graphModule = await import(pathToFileURL(outPath("src/spine/StationIndexedGraphEngine.ts")));
const reviewModule = await import(pathToFileURL(outPath("src/commercial/CommercialStationReviewEngine.ts")));
const placementModule = await import(pathToFileURL(outPath("src/commercial/CommercialObjectPlacementEngine.ts")));
const projectionModule = await import(pathToFileURL(outPath("src/engineering/EngineeringCertificationProjection.ts")));

const geometry = [
  [-97.7500, 30.2600],
  [-97.7300, 30.2600],
];
const measuredSpine = measuredModule.createMeasuredSpine({
  packageId: "DRAFT-IOF-SPRINT20C-001",
  routeId: "ROUTE-SPRINT20C",
  geometry,
  aSite: { siteId: "SITE-A", role: "A", label: "A", coordinate: geometry[0] },
  zSite: { siteId: "SITE-Z", role: "Z", label: "Z", coordinate: geometry[1] },
});
const stationAuthority = stationModule.createStationAuthority({
  measuredSpine,
  intervalFeet: 100,
  stationClass: "ENGINEERING",
});
const station20 = stationAuthority.stations.find((station) => station.stationLabel === "20+00");
const station40 = stationAuthority.stations.find((station) => station.stationLabel === "40+00");
assert(Boolean(station20), "Commercial can look up Station 20+00 fixture authority.");
assert(Boolean(station40), "Commercial can look up Station 40+00 fixture authority.");

const stationIndexedGraph = graphModule.createStationIndexedGraph({
  packageId: measuredSpine.packageId,
  measuredSpine,
  stationAuthority,
});
const objects = [
  {
    objectId: "OBJ-ILA-001",
    objectType: "STRUCTURE",
    label: "ILA 1",
    stationId: station20.stationId,
    stationLabel: station20.stationLabel,
    measureFeet: station20.measureFeet,
    coordinate: station20.coordinate,
    metadata: { structureType: "ILA" },
  },
];
const objectStationAttachments = attachmentModule.createObjectStationAttachments({
  packageId: measuredSpine.packageId,
  objects,
  stationAuthority,
  stationIndexedGraph,
});
const draftPackage = {
  packageId: measuredSpine.packageId,
  draftPackageId: measuredSpine.packageId,
  packageName: "Sprint 20C Draft IOF Package",
  packageType: "ENGINEERING",
  status: "DRAFT",
  workflowStatus: "COMMERCIAL_REVIEW",
  proposalId: "PROPOSAL-SPRINT20C",
  customerId: "CUSTOMER-SPRINT20C",
  opportunityId: "OPPORTUNITY-SPRINT20C",
  productId: "PRODUCT-L1-POINT-TO-POINT-LONG-HAUL",
  productName: "Point-to-Point Long Haul",
  assignedEngineerId: "",
  assignedEngineer: "Unassigned",
  priority: "NORMAL",
  submittedAt: "2026-07-02T12:00:00.000Z",
  proposalSummary: {},
  commercialSummary: { routeFeet: measuredSpine.routeLengthFeet, routeMiles: measuredSpine.routeLengthMiles },
  customerSummary: { name: "Sprint 20C Customer" },
  packageReadiness: { status: "READY_FOR_ENGINEERING_REVIEW" },
  engineeringReadiness: "READY_FOR_ENGINEERING_REVIEW",
  commercialConfidence: 100,
  assemblyReport: {},
  proposedIofUnits: [],
  geometry: { type: "LineString", coordinates: geometry },
  geometryCoordinateCount: geometry.length,
  centerline: geometry,
  measuredSpine,
  stationAuthority,
  stationIndex: stationAuthority.stationIndex,
  stationToCoordinateMap: stationAuthority.stationToCoordinateMap,
  stationIndexedGraph,
  objects,
  structures: [],
  objectStationAttachments,
  commercialObjectPlacementHistory: [],
  customerRequestedMoves: [],
  commercialImpactSummary: { status: "NO_COMMERCIAL_STATION_MOVES" },
  runtimeObjectIds: [],
  runtimeRelationshipIds: [],
  runtimeEvidenceIds: [],
  existingInventoryReferences: [],
  customerDesignReferences: [],
  customerTwinReference: "CUSTOMER-TWIN-SPRINT20C",
  geometryReferences: [],
  historyIds: [],
  createdAt: "2026-07-02T12:00:00.000Z",
  updatedAt: "2026-07-02T12:00:00.000Z",
  noScopeVersionCreation: true,
};

const review = reviewModule.buildCommercialStationReview(draftPackage);
assert(review.measuredSpine.geometryHash === measuredSpine.geometryHash, "Commercial can consume measuredSpine.");
assert(review.stationAuthority.stationCount === stationAuthority.stationCount, "Commercial can consume stationAuthority.");
assert(review.movableObjects.length === 1 && review.movableObjects[0].objectType === "ILA", "Commercial shows ILA as movable station-aware object.");
assert(review.mapSpec.primitives.some((primitive) => primitive.metadata?.renderAuthority === "MEASURED_SPINE_AUTHORITY"), "Commercial map renders measured spine.");
assert(review.mapSpec.primitives.some((primitive) => primitive.metadata?.renderAuthority === "STATION_AUTHORITY"), "Commercial map renders station authority.");

const lookup20 = reviewModule.lookupCommercialStation(draftPackage, "20+00");
const lookup40 = reviewModule.lookupCommercialStation(draftPackage, "40+00");
assert(lookup20.stationId === station20.stationId, "Commercial can look up Station 20+00.");
assert(lookup40.stationId === station40.stationId, "Commercial can look up Station 40+00.");

const measuredSpineBefore = JSON.stringify(draftPackage.measuredSpine);
const stationAuthorityBefore = JSON.stringify(draftPackage.stationAuthority);
const moveResult = placementModule.moveCommercialObjectByStation({
  draftPackage,
  objectId: "OBJ-ILA-001",
  targetStation: "40+00",
  reason: "Customer asked Commercial to move ILA to Station 40+00.",
  actor: "Commercial Reviewer",
  customerRequested: true,
  createdAt: "2026-07-02T12:05:00.000Z",
});
const movedDraft = moveResult.draftPackage;
const movedAttachment = movedDraft.objectStationAttachments.find((attachment) => attachment.objectId === "OBJ-ILA-001");
const movedObject = movedDraft.objects.find((object) => object.objectId === "OBJ-ILA-001");
assert(movedAttachment.stationId === station40.stationId, "ILA object can move from Station 20+00 to Station 40+00.");
assert(movedAttachment.stationLabel === "40+00", "Object station attachment updates.");
assert(near(movedAttachment.coordinate[0], station40.coordinate[0]) && near(movedAttachment.coordinate[1], station40.coordinate[1]), "Object coordinate updates from stationToCoordinateMap.");
assert(movedObject.stationId === station40.stationId && movedObject.stationLabel === "40+00", "Commercial object placement updates object station fields.");
assert(JSON.stringify(movedDraft.measuredSpine) === measuredSpineBefore, "Measured spine does not change.");
assert(JSON.stringify(movedDraft.stationAuthority) === stationAuthorityBefore, "Station authority does not change.");
assert(movedDraft.commercialObjectPlacementHistory.length === 1, "Commercial revision history records the move.");
assert(movedDraft.customerRequestedMoves.length === 1, "Customer-requested move is persisted.");
assert(movedDraft.commercialImpactSummary.requiresEngineeringReview === "YES", "Commercial impact summary requires Engineering review.");
assert(movedDraft.objectStationAttachments.some((attachment) => attachment.objectId === "OBJ-ILA-001" && attachment.stationLabel === "40+00"), "Draft IOF Package includes updated objectStationAttachments.");

const engineeringProjection = projectionModule.buildEngineeringCertificationProjection(movedDraft);
const engineeringObject = engineeringProjection.objects.find((object) => object.objectId === "OBJ-ILA-001");
assert(engineeringObject.station === "40+00" || engineeringObject.station === station40.stationId, "Engineering receives the updated station-aware object placement.");

const panelSource = read("src/components/commercial/StationAwareObjectReviewPanel.tsx");
[
  "Move Object by Station",
  "Add Object at Station",
  "Remove Proposed Object",
  "Record Customer Requested Move",
  "Recalculate Commercial Impact",
  "MapKernel",
].forEach((symbol) => {
  assert(panelSource.includes(symbol), `Commercial UI exposes ${symbol}.`);
});

const commercialSources = [
  "src/commercial/CommercialStationReviewEngine.ts",
  "src/commercial/CommercialObjectPlacementEngine.ts",
  "src/components/commercial/StationAwareObjectReviewPanel.tsx",
  "server/routes/commercial-iof-packages.js",
].map(read).join("\n");
assert(!commercialSources.includes("createScopeVersion"), "Commercial cannot create ScopeVersion.");
assert(!commercialSources.includes("CERTIFIED_IOF_PACKAGE"), "Commercial cannot certify station authority.");
assert(commercialSources.includes("canCertifyStationAuthority: false"), "Commercial station review explicitly cannot certify station authority.");

const commercialRouteSource = read("server/routes/commercial-iof-packages.js");
assert(commercialRouteSource.includes("stationAwareSubmitReadiness"), "Commercial submit path validates station-aware readiness.");
assert(commercialRouteSource.includes("objectStationAttachments missing"), "Commercial blocks Submit to Engineering when object attachments are missing.");

console.log(`Sprint 20C commercial station-aware review validation passed (${checks.length} checks).`);
