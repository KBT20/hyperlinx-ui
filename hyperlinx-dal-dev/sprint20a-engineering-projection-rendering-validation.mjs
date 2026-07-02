import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.dirname(fileURLToPath(import.meta.url));

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const projectionPath = "src/engineering/EngineeringCertificationProjection.ts";
const commercialAssemblyPath = "src/commercial/IOFPackageAssemblyEngine.ts";
const workspacePath = "src/workspaces/EngineeringCertificationWorkspace.tsx";

assert(existsSync(path.join(root, projectionPath)), "EngineeringCertificationProjection.ts is missing.");
assert(existsSync(path.join(root, commercialAssemblyPath)), "IOFPackageAssemblyEngine.ts is missing.");
assert(existsSync(path.join(root, workspacePath)), "EngineeringCertificationWorkspace.tsx is missing.");

const projection = read(projectionPath);
const commercialAssembly = read(commercialAssemblyPath);
const workspace = read(workspacePath);
const combinedCertificationRenderPath = `${projection}\n${workspace}`;

assert(!combinedCertificationRenderPath.includes("/api/baseline-graphs"), "Engineering Certification render path must not call /api/baseline-graphs.");
assert(!combinedCertificationRenderPath.includes("loadServerBaselineGraph"), "Engineering Certification render path must not load server baseline graphs.");
assert(!combinedCertificationRenderPath.includes("listServerBaselineGraphMetadata"), "Engineering Certification render path must not list server baseline graphs.");
assert(!combinedCertificationRenderPath.includes("inventoryRecovery"), "Engineering Certification render path must not depend on inventory recovery baseline APIs.");

[
  "coordinatesFromGeometryReferences",
  "coordinatesFromStations",
  "coordinatesFromRouteSegments",
  "coordinatesFromDependencyGraph",
  "centerlineCoordinatesFromPackage",
  "packageGraphPrimitives",
].forEach((symbol) => {
  assert(projection.includes(symbol), `Projection is missing package-native helper: ${symbol}.`);
});

[
  "loose.centerline",
  "loose.centerlineRoute",
  "loose.osrmRoute",
  "doctrineAssembly.centerline",
  "loose.spine",
  "routeSegmentGeometry",
  "stationCoordinates",
  "coordinatesFromGeometryReferences(loose.geometryReferences)",
  "coordinatesFromDependencyGraph(draft.dependencyGraph)",
].forEach((pattern) => {
  assert(projection.includes(pattern), `Projection route fallback is missing '${pattern}'.`);
});

[
  "ENGINEERING_CERTIFICATION_CENTERLINE",
  "ENGINEERING_CERTIFICATION_SPINE",
  "ENGINEERING_CERTIFICATION_GRAPH",
  "ENGINEERING_CERTIFICATION_STATIONS",
  "ENGINEERING_CERTIFICATION_OBJECTS",
].forEach((layer) => {
  assert(projection.includes(layer), `Projection map spec is missing ${layer}.`);
});

assert(projection.includes("primitives.push(...packageGraphPrimitives(projection, packageId));"), "Projection does not add package graph primitives.");
assert(workspace.includes("specs={[projection.mapSpec]}"), "Engineering Certification workspace must render the projection map spec directly.");
assert(workspace.includes("Rendered from Draft IOF Package artifacts"), "Engineering canvas copy must describe package-native rendering.");
assert(commercialAssembly.includes("geometry: geoJsonLineString(packageCenterline)"), "Commercial assembly must persist canonical package geometry.");
assert(commercialAssembly.includes("geometryCoordinateCount: packageCenterline.length"), "Commercial assembly must persist geometryCoordinateCount.");
assert(commercialAssembly.includes("centerline: packageCenterline"), "Commercial assembly must persist package centerline.");
assert(commercialAssembly.includes("centerlineRoute"), "Commercial assembly must persist centerlineRoute.");
assert(commercialAssembly.includes("spine"), "Commercial assembly must persist a spine artifact.");

const transpiled = ts.transpileModule(projection, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ES2022,
    verbatimModuleSyntax: false,
  },
}).outputText;
const projectionModule = await import(`data:text/javascript;base64,${Buffer.from(transpiled).toString("base64")}`);
const commercialTranspiled = ts.transpileModule(commercialAssembly, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ES2022,
    verbatimModuleSyntax: false,
  },
}).outputText;
const commercialModule = await import(`data:text/javascript;base64,${Buffer.from(commercialTranspiled).toString("base64")}`);

const osrmGeometry = Array.from({ length: 1615 }, (_, index) => [
  -97.7431 + index * 0.001,
  30.2672 + index * 0.0005,
]);
const assembledPackage = commercialModule.assembleDraftIofPackage({
  proposal: {
    proposalId: "PROPOSAL-GEOMETRY-1615",
    proposalNumber: "PG-1615",
    customerId: "customer-google",
    opportunityId: "OPPORTUNITY-GEOMETRY",
    productId: "PRODUCT-L1-POINT-TO-POINT-LONG-HAUL",
    productName: "Point-to-Point Long Haul Conduit & Fiber",
  },
  customerName: "Google",
  accountId: "google",
  quickQuote: {
    candidateId: "OSRM-ROUTE-1615",
    routeMiles: 50.43,
    geometry: osrmGeometry,
    confidence: 92,
    budgetCost: 1000000,
  },
  pricing: { sellPriceIru: 1350000, budgetCost: 1000000 },
});

assert(assembledPackage.geometry?.type === "LineString", "Commercial assembly did not persist GeoJSON LineString geometry.");
assert(assembledPackage.geometry?.coordinates?.length === 1615, "Commercial assembly did not persist all 1,615 OSRM coordinates.");
assert(assembledPackage.centerline?.length === 1615, "Commercial assembly did not persist centerline coordinates.");
assert(assembledPackage.centerlineRoute?.geometry?.length === 1615, "Commercial assembly did not persist centerlineRoute geometry.");
assert(assembledPackage.geometryCoordinateCount === 1615, "Commercial assembly did not persist geometryCoordinateCount 1615.");
assert(assembledPackage.validation?.checks?.find((check) => check.key === "geometry-or-design-artifact")?.status === "PASS", "Commercial geometry validation did not PASS with 1,615 coordinates.");

const fixture = {
  packageId: "DRAFT-IOF-PROJECTION-RENDER",
  draftPackageId: "DRAFT-IOF-PROJECTION-RENDER",
  packageName: "Projection Render Fixture",
  packageType: "ENGINEERING",
  status: "SUBMITTED_TO_ENGINEERING",
  workflowStatus: "ENGINEERING_INTAKE",
  proposalId: "PROPOSAL-RENDER",
  customerId: "customer-google",
  opportunityId: "OPPORTUNITY-RENDER",
  assignedEngineerId: "engineer-kyle",
  assignedEngineer: "Kyle",
  priority: "NORMAL",
  submittedAt: "2026-07-02T00:00:00.000Z",
  proposalSummary: {},
  commercialSummary: { routeFeet: 10560 },
  customerSummary: { name: "Google" },
  packageReadiness: { status: "READY_FOR_ENGINEERING_REVIEW" },
  engineeringReadiness: "SUBMITTED_TO_ENGINEERING",
  commercialConfidence: 90,
  assemblyReport: {},
  proposedIofUnits: [],
  centerline: [
    [-97.7431, 30.2672],
    [-96.7970, 32.7767],
    [-95.3698, 29.7604],
  ],
  spine: {
    spineId: "SPINE-RENDER",
    centerlineId: "CENTERLINE-RENDER",
    routeFeet: 10560,
  },
  routeSegments: [
    { segmentId: "SEG-001", fromStationId: "STA-000", toStationId: "STA-001", routeFeet: 5280 },
    { segmentId: "SEG-002", fromStationId: "STA-001", toStationId: "STA-002", routeFeet: 5280 },
  ],
  stations: [
    { stationId: "STA-000", stationFeet: 0, coordinate: [-97.7431, 30.2672] },
    { stationId: "STA-001", stationFeet: 5280, coordinate: [-96.7970, 32.7767] },
    { stationId: "STA-002", stationFeet: 10560, coordinate: [-95.3698, 29.7604] },
  ],
  objects: [
    { objectId: "ILA-001", objectType: "ILA", stationId: "STA-001", quantity: 1 },
  ],
  relationships: [],
  evidence: [],
  runtimeObjectIds: [],
  runtimeRelationshipIds: [],
  runtimeEvidenceIds: [],
  existingInventoryReferences: [],
  customerDesignReferences: [],
  customerTwinReference: "CUSTOMER-TWIN-GOOGLE",
  geometryReferences: ["fixture:geometry:0:-97.7431,30.2672", "fixture:geometry:1:-95.3698,29.7604"],
  historyIds: [],
  createdAt: "2026-07-02T00:00:00.000Z",
  updatedAt: "2026-07-02T00:00:00.000Z",
};

const builtProjection = projectionModule.buildEngineeringCertificationProjection(fixture);
assert(builtProjection.routeCoordinates.length >= 3, "Projection did not build route coordinates from package-native centerline.");
assert(builtProjection.centerlineCoordinates.length >= 3, "Projection did not build centerline coordinates from package-native centerline.");
assert(builtProjection.mapSpec.primitives.some((primitive) => primitive.metadata?.sourceLayer === "ENGINEERING_CERTIFICATION_CENTERLINE"), "Map spec is missing package centerline primitive.");
assert(builtProjection.mapSpec.primitives.some((primitive) => primitive.metadata?.sourceLayer === "ENGINEERING_CERTIFICATION_SPINE"), "Map spec is missing package spine primitive.");
assert(builtProjection.mapSpec.primitives.some((primitive) => primitive.metadata?.sourceLayer === "ENGINEERING_CERTIFICATION_GRAPH"), "Map spec is missing package graph primitive.");
assert(builtProjection.mapSpec.primitives.some((primitive) => primitive.metadata?.sourceLayer === "ENGINEERING_CERTIFICATION_STATIONS"), "Map spec is missing package station primitive.");
assert(builtProjection.mapSpec.primitives.some((primitive) => primitive.metadata?.sourceLayer === "ENGINEERING_CERTIFICATION_OBJECTS"), "Map spec is missing package object primitive.");
assert(builtProjection.mapSpec.primitives.length >= 7, "Map spec does not contain enough primitives to render the Engineering Twin immediately.");

const projectedAssembledPackage = projectionModule.buildEngineeringCertificationProjection(assembledPackage);
const geometryCompliance = projectedAssembledPackage.compliance.find((row) => row.key === "geometry");
assert(projectedAssembledPackage.routeCoordinates.length === 1615, "Engineering projection did not preserve all 1,615 commercial geometry coordinates.");
assert(geometryCompliance?.status === "PASS", "PD-001 geometry should PASS when 1,615 coordinates are projected.");
assert(geometryCompliance?.detail.includes("Coordinates 1,615"), "PD-001 geometry detail must include deterministic coordinate count.");

const zeroGeometryProjection = projectionModule.buildEngineeringCertificationProjection({
  ...assembledPackage,
  packageId: "DRAFT-IOF-ZERO-GEOMETRY",
  geometry: { type: "LineString", coordinates: [] },
  geometryCoordinateCount: 0,
  centerline: [],
  centerlineRoute: null,
  osrmRoute: null,
  route: [],
  routeSegments: [],
  stations: [],
  geometryReferences: [],
});
const zeroGeometryCompliance = zeroGeometryProjection.compliance.find((row) => row.key === "geometry");
assert(zeroGeometryProjection.routeCoordinates.length === 0, "Zero-geometry fixture unexpectedly projected coordinates.");
assert(zeroGeometryCompliance?.status === "FAIL", "PD-001 geometry must FAIL when zero coordinates are projected.");
assert(zeroGeometryCompliance?.detail.includes("Projected NO"), "PD-001 geometry failure must state Projected NO.");

console.log("Sprint 20A Engineering Projection Rendering validation passed.");
