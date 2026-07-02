import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.dirname(fileURLToPath(import.meta.url));
const tempDir = path.join(root, ".tmp", "sprint20b-validation");
const checks = [];

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
  checks.push(message);
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
  }).outputText.replace(/from "(\.\/[^"]+)";/g, 'from "$1.mjs";');
  const outputPath = path.join(tempDir, path.basename(relativePath).replace(/\.ts(x)?$/, ".mjs"));
  writeFileSync(outputPath, output);
  return outputPath;
}

function near(a, b, tolerance = 0.01) {
  return Math.abs(a - b) <= tolerance;
}

rmSync(tempDir, { recursive: true, force: true });
mkdirSync(tempDir, { recursive: true });

const requiredFiles = [
  "src/spine/SpineAuthorityContracts.ts",
  "src/spine/MeasuredSpineEngine.ts",
  "src/spine/StationAuthorityEngine.ts",
  "src/spine/ObjectStationAttachmentEngine.ts",
  "src/spine/StationIndexedGraphEngine.ts",
  "src/spine/SpineAuthorityRegenerationEngine.ts",
  "src/commercial/IOFPackageAssemblyEngine.ts",
  "src/engineering/EngineeringCertificationProjection.ts",
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
  "src/spine/SpineAuthorityRegenerationEngine.ts",
  "src/engineering/EngineeringCertificationProjection.ts",
].forEach(transpile);

const measuredModule = await import(pathToFileURL(path.join(tempDir, "MeasuredSpineEngine.mjs")));
const stationModule = await import(pathToFileURL(path.join(tempDir, "StationAuthorityEngine.mjs")));
const attachmentModule = await import(pathToFileURL(path.join(tempDir, "ObjectStationAttachmentEngine.mjs")));
const graphModule = await import(pathToFileURL(path.join(tempDir, "StationIndexedGraphEngine.mjs")));
const regenerationModule = await import(pathToFileURL(path.join(tempDir, "SpineAuthorityRegenerationEngine.mjs")));
const projectionModule = await import(pathToFileURL(path.join(tempDir, "EngineeringCertificationProjection.mjs")));

const geometry = [
  [-97.7431, 30.2672],
  [-97.7411, 30.2672],
  [-97.7391, 30.2682],
  [-97.7371, 30.2694],
  [-97.7352, 30.2706],
];

const measuredSpine = measuredModule.createMeasuredSpine({
  packageId: "DRAFT-IOF-SPRINT20B-001",
  routeId: "ROUTE-SPRINT20B",
  geometry,
  aSite: { siteId: "SITE-A", role: "A", label: "A", coordinate: geometry[0] },
  zSite: { siteId: "SITE-Z", role: "Z", label: "Z", coordinate: geometry[geometry.length - 1] },
});

assert(measuredSpine.authority === "MEASURED_SPINE_AUTHORITY", "geometry creates measured spine authority.");
assert(measuredSpine.coordinateCount === geometry.length, "measured spine preserves coordinate count.");
assert(measuredSpine.segments.length === geometry.length - 1, "measured spine computes one segment per geometry span.");
assert(measuredSpine.routeLengthFeet > 0, "route length matches measured spine length.");
assert(measuredSpine.segments.every((segment, index, segments) => index === 0 || segment.cumulativeStartFeet >= segments[index - 1].cumulativeEndFeet), "measured spine computes cumulative segment measures.");

const stationAuthority = stationModule.createStationAuthority({
  measuredSpine,
  intervalFeet: 100,
  stationClass: "ENGINEERING",
});

assert(stationAuthority.authority === "STATION_AUTHORITY", "station authority is created from measured spine.");
assert(stationAuthority.intervalFeet === 100, "station authority generates 100 ft stations.");
assert(stationAuthority.stationCount === stationModule.expectedStationCount(measuredSpine.routeLengthFeet, 100), "station count matches interval logic.");
assert(near(stationAuthority.stations.at(-1).measureFeet, measuredSpine.routeLengthFeet), "final station is included.");
assert(stationAuthority.stations.every((station, index, stations) => index === 0 || station.measureFeet > stations[index - 1].measureFeet), "station measures are monotonic.");
assert(stationAuthority.stationToCoordinateMap.entries.length === stationAuthority.stationCount, "station-to-coordinate map exists.");
assert(stationModule.stationLabelForMeasure(0) === "0+00", "station label 0+00 is correct.");
assert(stationModule.stationLabelForMeasure(100) === "1+00", "station label 1+00 is correct.");
assert(stationModule.stationLabelForMeasure(1000) === "10+00", "station label 10+00 is correct.");
assert(stationModule.stationLabelForMeasure(169118) === "1691+18", "station label 1691+18 is correct.");

const station100 = stationAuthority.stations.find((station) => near(station.measureFeet, 100, 0.001));
assert(Boolean(station100), "100 ft station exists.");
assert(station100.coordinate[0] !== geometry[0][0] && station100.coordinate[0] !== geometry[1][0], "station coordinates interpolate by measured distance.");

const stationGraph = graphModule.createStationIndexedGraph({
  packageId: measuredSpine.packageId,
  measuredSpine,
  stationAuthority,
});
const stationIds = new Set(stationAuthority.stations.map((station) => station.stationId));
assert(stationGraph.authority === "STATION_INDEXED_GRAPH_AUTHORITY", "station-indexed graph authority is created.");
assert(stationGraph.edges.length === stationAuthority.stationCount - 1, "station-indexed graph creates station-to-station edges.");
assert(stationGraph.edges.every((edge) => stationIds.has(edge.fromStationId) && stationIds.has(edge.toStationId)), "station-indexed graph references valid stations.");

const resolvedObjects = [
  { objectId: "OBJ-EXPLICIT", objectType: "HANDHOLE", stationId: stationAuthority.stations[1].stationId },
  { objectId: "OBJ-MEASURE", objectType: "VAULT", measureFeet: 250 },
  { objectId: "OBJ-COORDINATE", objectType: "ILA", coordinate: stationAuthority.stations[4].coordinate },
];
const unresolvedObject = { objectId: "OBJ-UNRESOLVED" };
const objectStationAttachments = attachmentModule.createObjectStationAttachments({
  packageId: measuredSpine.packageId,
  objects: [...resolvedObjects, unresolvedObject],
  stationAuthority,
  stationIndexedGraph: stationGraph,
});

assert(objectStationAttachments.slice(0, 3).every((attachment) => attachment.attachmentStatus === "ATTACHED"), "objects resolve to station attachments.");
assert(objectStationAttachments.some((attachment) => attachment.attachmentMethod === "EXPLICIT_STATION"), "explicit station attachment is supported.");
assert(objectStationAttachments.some((attachment) => attachment.attachmentMethod === "EXPLICIT_MEASURE"), "explicit measure attachment is supported.");
assert(objectStationAttachments.some((attachment) => attachment.attachmentMethod === "EXPLICIT_COORDINATE_NEAREST_STATION"), "explicit coordinate nearest-station attachment is supported.");
assert(objectStationAttachments.find((attachment) => attachment.objectId === "OBJ-UNRESOLVED").attachmentMethod === "UNRESOLVED", "unresolved objects are flagged.");

const regenerated = regenerationModule.regenerateAuthorityFromGeometry({
  packageId: measuredSpine.packageId,
  routeId: measuredSpine.routeId,
  geometry: [...geometry.slice(0, -1), [-97.7342, 30.2712]],
  reason: "Sprint 20B deterministic reroute core validation.",
  actor: "validation",
  previousGeometryHash: measuredSpine.geometryHash,
  objects: resolvedObjects,
});

assert(regenerated.measuredSpine.geometryHash !== measuredSpine.geometryHash, "regeneration creates new geometryHash.");
assert(regenerated.stationAuthority.stationCount > 0, "regeneration creates new stations.");
assert(regenerated.regenerationAudit.previousGeometryHash === measuredSpine.geometryHash, "regeneration audit records previous geometry hash.");

const commercialAssemblySource = read("src/commercial/IOFPackageAssemblyEngine.ts");
[
  "measuredSpine",
  "stationAuthority",
  "stationIndex",
  "stationToCoordinateMap",
  "objectStationAttachments",
  "stationIndexedGraph",
].forEach((symbol) => {
  assert(commercialAssemblySource.includes(symbol), `Draft IOF Package persists ${symbol}.`);
});

const projectionSource = read("src/engineering/EngineeringCertificationProjection.ts");
[
  "measuredSpineFromPackage",
  "stationAuthorityFromPackage",
  "stationIndexedGraphFromPackage",
  "objectStationAttachmentsFromPackage",
  "station-to-coordinate",
  "object attachment",
].forEach((symbol) => {
  assert(projectionSource.includes(symbol), `Engineering Projection consumes ${symbol}.`);
});

const noScopeVersionSources = [
  "src/spine/MeasuredSpineEngine.ts",
  "src/spine/StationAuthorityEngine.ts",
  "src/spine/ObjectStationAttachmentEngine.ts",
  "src/spine/StationIndexedGraphEngine.ts",
  "src/spine/SpineAuthorityRegenerationEngine.ts",
].map(read).join("\n");
assert(!noScopeVersionSources.includes("createScopeVersion"), "ScopeVersion is not created by Sprint 20B spine authority.");

const draftBase = {
  packageId: measuredSpine.packageId,
  draftPackageId: measuredSpine.packageId,
  status: "DRAFT",
  workflowStatus: "ENGINEERING_REVIEW",
  proposalId: "PROPOSAL-SPRINT20B",
  customerId: "CUSTOMER-SPRINT20B",
  opportunityId: "OPPORTUNITY-SPRINT20B",
  productId: "PRODUCT-L1-POINT-TO-POINT-LONG-HAUL",
  productName: "Point-to-Point Long Haul",
  assignedEngineerId: "ENGINEER-001",
  assignedEngineer: "Engineering",
  priority: "NORMAL",
  submittedAt: "2026-07-02T12:00:00.000Z",
  proposalSummary: {},
  commercialSummary: { routeFeet: measuredSpine.routeLengthFeet, routeMiles: measuredSpine.routeLengthMiles },
  customerSummary: { name: "Sprint 20B Customer" },
  packageReadiness: { status: "ENGINEERING_REVIEW" },
  engineeringReadiness: "READY_FOR_ENGINEERING_REVIEW",
  commercialConfidence: 100,
  assemblyReport: {},
  proposedIofUnits: [],
  geometry: { type: "LineString", coordinates: geometry },
  geometryCoordinateCount: geometry.length,
  centerline: geometry,
  measuredSpine,
  stations: stationAuthority.stations,
  objects: resolvedObjects,
  structures: [],
  runtimeObjectIds: [],
  runtimeRelationshipIds: [],
  runtimeEvidenceIds: [],
  existingInventoryReferences: [],
  customerDesignReferences: [],
  customerTwinReference: "CUSTOMER-TWIN-SPRINT20B",
  geometryReferences: [],
  historyIds: [],
  createdAt: "2026-07-02T12:00:00.000Z",
  updatedAt: "2026-07-02T12:00:00.000Z",
};

const missingAuthorityProjection = projectionModule.buildEngineeringCertificationProjection({
  ...draftBase,
  stationAuthority: undefined,
  stationIndex: undefined,
  stationToCoordinateMap: undefined,
  objectStationAttachments: undefined,
  stationIndexedGraph: undefined,
});
assert(missingAuthorityProjection.compliance.find((row) => row.key === "stationing").status === "FAIL", "PD-001 fails when stationAuthority is missing.");

const passingProjection = projectionModule.buildEngineeringCertificationProjection({
  ...draftBase,
  stationAuthority,
  stationIndex: stationAuthority.stationIndex,
  stationToCoordinateMap: stationAuthority.stationToCoordinateMap,
  objectStationAttachments: objectStationAttachments.slice(0, 3),
  stationIndexedGraph: stationGraph,
});
["geometry", "spine", "stationing", "station-to-coordinate", "graph", "object attachment"].forEach((key) => {
  assert(passingProjection.compliance.find((row) => row.key === key).status === "PASS", `PD-001 ${key} passes when measured spine and station authority exist.`);
});
assert(passingProjection.mapSpec.primitives.some((primitive) => primitive.metadata?.renderAuthority === "MEASURED_SPINE_AUTHORITY"), "Engineering map renders measured spine authority.");
assert(passingProjection.mapSpec.primitives.some((primitive) => primitive.metadata?.renderAuthority === "STATION_INDEXED_GRAPH_AUTHORITY"), "Engineering map renders station-indexed graph authority.");

console.log(`Sprint 20B spine/station authority validation passed (${checks.length} checks).`);
