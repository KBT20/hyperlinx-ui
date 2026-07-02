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
const mapLayerManagerPath = "src/mapkernel/MapLayerManager.ts";

assert(existsSync(path.join(root, projectionPath)), "EngineeringCertificationProjection.ts is missing.");
assert(existsSync(path.join(root, commercialAssemblyPath)), "IOFPackageAssemblyEngine.ts is missing.");
assert(existsSync(path.join(root, workspacePath)), "EngineeringCertificationWorkspace.tsx is missing.");
assert(existsSync(path.join(root, mapLayerManagerPath)), "MapLayerManager.ts is missing.");

const projection = read(projectionPath);
const commercialAssembly = read(commercialAssemblyPath);
const workspace = read(workspacePath);
const mapLayerManager = read(mapLayerManagerPath);
const combinedCertificationRenderPath = `${projection}\n${workspace}`;

assert(!combinedCertificationRenderPath.includes("/api/baseline-graphs"), "Engineering Certification render path must not call /api/baseline-graphs.");
assert(!combinedCertificationRenderPath.includes("loadServerBaselineGraph"), "Engineering Certification render path must not load server baseline graphs.");
assert(!combinedCertificationRenderPath.includes("listServerBaselineGraphMetadata"), "Engineering Certification render path must not list server baseline graphs.");
assert(!combinedCertificationRenderPath.includes("inventoryRecovery"), "Engineering Certification render path must not depend on inventory recovery baseline APIs.");

[
  "coordinatesFromGeometryReferences",
  "coordinatesFromCommercialDraftSnapshot",
  "coordinatesFromCustomerRequests",
  "coordinatesFromProposedIofUnits",
  "coordinatesFromStations",
  "coordinatesFromRouteSegments",
  "centerlineCoordinatesFromPackage",
  "packageGraphPrimitives",
  "draftIofRouteFeature",
].forEach((symbol) => {
  assert(projection.includes(symbol), `Projection is missing package-native helper: ${symbol}.`);
});

[
  "loose.centerline",
  "loose.centerlineRoute",
  "loose.osrmRoute",
  "doctrineAssembly.centerline",
  "loose.commercialDraftSnapshot",
  "loose.customerRequests",
  "draft.proposedIofUnits",
  "loose.spine",
  "routeSegmentGeometry",
  "coordinatesFromGeometryReferences(loose.geometryReferences)",
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
assert(projection.includes("features: routeFeature ? [routeFeature] : []"), "Projection map spec must carry a canonical GeoJSON Feature.");
assert(mapLayerManager.includes("features?: MapKernelGeoJsonFeature[]"), "MapKernel render spec must support canonical GeoJSON features.");
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
assert(projectedAssembledPackage.mapSpec.features?.length === 1, "MapKernel-compatible spec must contain one canonical LineString Feature.");
assert(projectedAssembledPackage.mapSpec.features[0]?.type === "Feature", "Canonical render object must be a GeoJSON Feature.");
assert(projectedAssembledPackage.mapSpec.features[0]?.geometry?.type === "LineString", "Canonical render feature must be a LineString.");
assert(projectedAssembledPackage.mapSpec.features[0]?.geometry?.coordinates?.length === 1615, "Canonical LineString Feature must contain 1,615 coordinates.");
assert(projectedAssembledPackage.mapSpec.features[0]?.properties?.source === "DRAFT_IOF_PACKAGE", "Canonical render feature must be sourced from the Draft IOF Package.");
assert(projectedAssembledPackage.mapSpec.features[0]?.properties?.authority === "ENGINEERING_CERTIFICATION", "Canonical render feature must carry Engineering Certification authority.");
assert(projectedAssembledPackage.mapSpec.primitives.some((primitive) =>
  primitive.kind === "line" &&
  primitive.metadata?.sourceLayer === "ENGINEERING_CERTIFICATION_CENTERLINE" &&
  primitive.coordinates?.length === 1615
), "MapKernel primitive adapter must draw the 1,615-coordinate Engineering centerline.");

function isolatedDraft(overrides) {
  return {
    ...assembledPackage,
    packageId: `DRAFT-IOF-SHAPE-${overrides.shapeName ?? "UNKNOWN"}`,
    draftPackageId: `DRAFT-IOF-SHAPE-${overrides.shapeName ?? "UNKNOWN"}`,
    geometry: null,
    geometryCoordinateCount: 0,
    centerline: null,
    centerlineRoute: null,
    osrmRoute: null,
    spine: null,
    route: [],
    routeSegments: [],
    productDoctrineAssembly: null,
    commercialDraftSnapshot: null,
    customerRequests: [],
    proposedIofUnits: [],
    stations: [],
    geometryReferences: [],
    ...overrides,
  };
}

const geometryReferenceStrings = osrmGeometry.map((coordinate, index) => `shape:geometry:${index}:${coordinate[0]},${coordinate[1]}`);
const reversedLatLngGeometry = osrmGeometry.map(([lng, lat]) => [lat, lng]);
const shapeFixtures = [
  ["geometry.coordinates", isolatedDraft({ shapeName: "GEOMETRY", geometry: { type: "LineString", coordinates: osrmGeometry } })],
  ["geometry.geometry.coordinates", isolatedDraft({ shapeName: "NESTED-GEOMETRY", geometry: { geometry: { type: "LineString", coordinates: osrmGeometry } } })],
  ["centerline.coordinates", isolatedDraft({ shapeName: "CENTERLINE-COORDINATES", centerline: { coordinates: osrmGeometry } })],
  ["centerline.geometry.coordinates", isolatedDraft({ shapeName: "CENTERLINE-GEOMETRY", centerline: { geometry: { type: "LineString", coordinates: osrmGeometry } } })],
  ["centerlineRoute.coordinates", isolatedDraft({ shapeName: "CENTERLINE-ROUTE-COORDINATES", centerlineRoute: { coordinates: osrmGeometry } })],
  ["centerlineRoute.geometry.coordinates", isolatedDraft({ shapeName: "CENTERLINE-ROUTE-GEOMETRY", centerlineRoute: { geometry: { type: "LineString", coordinates: osrmGeometry } } })],
  ["osrmRoute.coordinates", isolatedDraft({ shapeName: "OSRM-ROUTE-COORDINATES", osrmRoute: { coordinates: osrmGeometry } })],
  ["osrmRoute.geometry.coordinates", isolatedDraft({ shapeName: "OSRM-ROUTE-GEOMETRY", osrmRoute: { geometry: { type: "LineString", coordinates: osrmGeometry } } })],
  ["commercialDraftSnapshot.geometry", isolatedDraft({ shapeName: "COMMERCIAL-DRAFT-SNAPSHOT", commercialDraftSnapshot: { geometry: { type: "LineString", coordinates: osrmGeometry } } })],
  ["customerRequests[].commercialDraftSnapshot.geometry", isolatedDraft({ shapeName: "CUSTOMER-REQUEST-SNAPSHOT", customerRequests: [{ commercialDraftSnapshot: { geometry: { type: "LineString", coordinates: osrmGeometry } } }] })],
  ["proposedIofUnits[].geometry", isolatedDraft({ shapeName: "PROPOSED-UNIT-GEOMETRY", proposedIofUnits: [{ unitId: "UNIT-GEOMETRY", geometry: { type: "LineString", coordinates: osrmGeometry } }] })],
  ["proposedIofUnits[].geometryReferences embedded", isolatedDraft({ shapeName: "PROPOSED-UNIT-GEOMETRY-REFERENCES", proposedIofUnits: [{ unitId: "UNIT-GEOMETRY-REFERENCES", geometryReferences: geometryReferenceStrings }] })],
  ["normalized [lat,lng] centerlineRoute.geometry.coordinates", isolatedDraft({ shapeName: "LAT-LNG-NORMALIZATION", centerlineRoute: { geometry: { type: "LineString", coordinates: reversedLatLngGeometry } } })],
];

shapeFixtures.forEach(([label, draft]) => {
  const shapeProjection = projectionModule.buildEngineeringCertificationProjection(draft);
  assert(shapeProjection.routeCoordinates.length === 1615, `Projection did not extract 1,615 coordinates from ${label}.`);
  assert(shapeProjection.mapSpec.features?.[0]?.geometry?.coordinates?.length === 1615, `MapKernel feature did not carry 1,615 coordinates from ${label}.`);
  assert(shapeProjection.compliance.find((row) => row.key === "geometry")?.status === "PASS", `PD-001 geometry did not PASS for ${label}.`);
  if (String(label).includes("[lat,lng]")) {
    assert(shapeProjection.routeCoordinates[0][0] === osrmGeometry[0][0], "Projection did not normalize [lat,lng] longitude into [lng,lat].");
    assert(shapeProjection.routeCoordinates[0][1] === osrmGeometry[0][1], "Projection did not normalize [lat,lng] latitude into [lng,lat].");
  }
});

const zeroGeometryProjection = projectionModule.buildEngineeringCertificationProjection({
  ...assembledPackage,
  packageId: "DRAFT-IOF-ZERO-GEOMETRY",
  geometry: { type: "LineString", coordinates: [] },
  geometryCoordinateCount: 0,
  centerline: [],
  centerlineRoute: null,
  osrmRoute: null,
  commercialDraftSnapshot: null,
  customerRequests: [],
  proposedIofUnits: [],
  productDoctrineAssembly: null,
  route: [],
  routeSegments: [],
  stations: [],
  geometryReferences: [],
});
const zeroGeometryCompliance = zeroGeometryProjection.compliance.find((row) => row.key === "geometry");
assert(zeroGeometryProjection.routeCoordinates.length === 0, "Zero-geometry fixture unexpectedly projected coordinates.");
assert(zeroGeometryCompliance?.status === "FAIL", "PD-001 geometry must FAIL when zero coordinates are projected.");
assert(zeroGeometryCompliance?.detail.includes("Projected NO"), "PD-001 geometry failure must state Projected NO.");
assert((zeroGeometryProjection.mapSpec.features?.length ?? 0) === 0, "Zero-geometry fixture must not emit a canonical LineString Feature.");

const stationOnlyProjection = projectionModule.buildEngineeringCertificationProjection({
  ...assembledPackage,
  packageId: "DRAFT-IOF-STATIONS-NO-GEOMETRY",
  draftPackageId: "DRAFT-IOF-STATIONS-NO-GEOMETRY",
  geometry: null,
  geometryCoordinateCount: 0,
  centerline: null,
  centerlineRoute: null,
  osrmRoute: null,
  spine: null,
  productDoctrineAssembly: null,
  route: [],
  routeSegments: [],
  geometryReferences: [],
  proposedIofUnits: [],
  customerRequests: [],
  stations: [
    { stationId: "STA-ONLY-000", stationFeet: 0, coordinate: [-97.7431, 30.2672] },
    { stationId: "STA-ONLY-001", stationFeet: 5280, coordinate: [-96.7970, 32.7767] },
  ],
});
const stationOnlyGeometryCompliance = stationOnlyProjection.compliance.find((row) => row.key === "geometry");
assert(stationOnlyProjection.routeCoordinates.length === 0, "Station coordinates must not be promoted into route geometry.");
assert(stationOnlyGeometryCompliance?.status === "FAIL", "PD-001 geometry must FAIL when only stations are projected.");
assert(stationOnlyProjection.mapSpec.primitives.some((primitive) => primitive.metadata?.sourceLayer === "ENGINEERING_CERTIFICATION_STATIONS"), "Station-only fixture should still render station artifacts.");

console.log("Sprint 20A Engineering Projection Rendering validation passed.");
