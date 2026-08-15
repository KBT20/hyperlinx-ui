import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd().endsWith("hyperlinx-dal-dev")
  ? process.cwd()
  : path.join(process.cwd(), "hyperlinx-dal-dev");

const paths = {
  projectionEngine: path.join(root, "src", "products", "DoctrineProjectionEngine.ts"),
  draftIofAssembly: path.join(root, "src", "commercial", "IOFPackageAssemblyEngine.ts"),
  runtimeApi: path.join(root, "src", "api", "teralinxRuntime.ts"),
  commercialIofRoute: path.join(root, "server", "routes", "commercial-iof-packages.js"),
  engineeringCertification: path.join(root, "server", "routes", "engineering-certification.js"),
  engineeringProjection: path.join(root, "src", "engineering", "EngineeringCertificationProjection.ts"),
  engineeringWorkspace: path.join(root, "src", "workspaces", "EngineeringCertificationWorkspace.tsx"),
  scopeVersionAuthority: path.join(root, "server", "scopeversion-authority-engine.js"),
};

for (const filePath of Object.values(paths)) {
  if (!existsSync(filePath)) {
    console.error(`FAIL missing required file: ${path.relative(root, filePath)}`);
    process.exit(1);
  }
}

const sources = Object.fromEntries(
  Object.entries(paths).map(([key, filePath]) => [key, readFileSync(filePath, "utf8")]),
);

const checks = [];

function check(name, condition) {
  checks.push({ name, condition: Boolean(condition) });
}

function includesAll(source, terms) {
  return terms.every((term) => source.includes(term));
}

function blockBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  if (start < 0) return "";
  const end = source.indexOf(endMarker, start + startMarker.length);
  return end < 0 ? source.slice(start) : source.slice(start, end);
}

const projectionEngine = sources.projectionEngine;
const serverProjectionBlock = blockBetween(sources.commercialIofRoute, "function stationProjectionForDraftPackage", "function stationAwareSubmitReadiness");
const certificationGateBlock = blockBetween(sources.engineeringCertification, "async function handleCertifyPackage", "const timestamp = nowIso();");

check("projection engine reads route length and measured station spine", includesAll(projectionEngine, [
  "measuredSpine.routeLengthFeet",
  "StationAuthority",
  "stationAuthority.stations.length",
  "coordinateAtMeasureOnSpine",
]));

check("projection engine reads existing doctrine quantity schedule", includesAll(projectionEngine, [
  "quantityPlacementFromManifest",
  "quantityPlacement.handholeCount",
  "quantityPlacement.vaultCount",
  "quantityPlacement.spliceCaseCount",
  "quantityPlacement.ilaRegenCount",
  "quantityPlacement.markerCount",
  "quantityPlacement.slackLoopCount",
]));

check("projection math uses route length divided by count", includesAll(projectionEngine, [
  "routeFeet / count",
  "pointMeasureFeet",
  "(routeFeet / count) * (index + 1)",
  "nominalIntervalFeet",
]));

check("deterministic object IDs are assigned by sequence", includesAll(projectionEngine, [
  "prefix: \"HH\"",
  "prefix: \"VAULT\"",
  "prefix: \"SPLICE\"",
  "prefix: \"ILA\"",
  "prefix: \"MARKER\"",
  "prefix: \"SLACK\"",
  "String(args.seedIndex + 1).padStart(3, \"0\")",
]));

check("object count equals doctrine quantity schedule", includesAll(projectionEngine, [
  "expectedObjectCount",
  "projectedObjects.length !== args.expectedObjectCount",
  "math count does not match doctrine quantity",
]));

check("every projected object receives station address and coordinate", includesAll(projectionEngine, [
  "stationAddress",
  "stationLabelFromMeasure(stationFeet)",
  "coordinate",
  "geographicCoordinate",
  "latitude",
  "longitude",
  "coordinate not resolved",
  "object lacks address",
]));

check("object addresses contain required field-level address data", includesAll(projectionEngine, [
  "routeId",
  "segmentId",
  "objectType",
  "objectSequence",
  "stationAddress",
  "latitude",
  "longitude",
  "geometryHash",
  "addressLabel",
  "addressType: \"POINT\"",
  "addressStatus: \"ASSIGNED\"",
]));

check("objects are sequenced by station", includesAll(projectionEngine, [
  ".sort((a, b) => a.stationFeet - b.stationFeet",
  "stationSequence: index + 1",
]));

check("spans are derived between sequenced action objects", includesAll(projectionEngine, [
  "derivedSpansFromProjectedObjects",
  "projectedObjects.slice(0, -1)",
  "startObjectId",
  "endObjectId",
  "startStation",
  "endStation",
  "span cannot be derived",
]));

check("linear assets cover and attach to derived spans", includesAll(projectionEngine, [
  "LINEAR_SPAN_ASSETS",
  "\"CONDUIT\"",
  "\"FIBER\"",
  "\"TRACE_WIRE\"",
  "\"WARNING_TAPE\"",
  "\"MULE_TAPE_PULL_TAPE\"",
  "linearAssetAttachmentsForSpans",
  "linearAssetStationRanges",
  "required linear assets are not attached",
]));

check("projection IDs cannot pass silently when missing", includesAll(projectionEngine, [
  "stationProjectionId",
  "stationGraphId",
  "projectedObjectManifestId",
  "projection ID missing",
]));

check("placeholder objects are rejected", includesAll(projectionEngine, [
  "ROUTE-CENTERLINE",
  "PROJECTED_IOF_OBJECT",
  "AUDIT_OBJECT",
  "placeholderObjectCount",
]));

check("projection diagnostics expose the four gates", includesAll(projectionEngine, [
  "\"Math Present\"",
  "\"Objects Calculated\"",
  "\"Addresses Assigned\"",
  "\"Objects Projected\"",
  "missing route feet",
  "missing doctrine quantity",
  "zero object count",
  "station not resolved",
  "coordinate not resolved",
  "duplicate station",
  "duplicate object ID",
]));

check("Draft IOF assembly and serializer preserve diagnostics", includesAll(sources.draftIofAssembly, [
  "doctrineProjectionDiagnostics",
  "doctrineProjectionDiagnosticsStatus",
]) && includesAll(sources.runtimeApi, [
  "doctrineProjectionDiagnostics: draft.doctrineProjectionDiagnostics",
  "objectAddresses: draftPackage.objectAddresses",
]));

check("server handoff uses same spine math and no longer depends on preexisting projection artifacts", includesAll(sources.commercialIofRoute, [
  "stationMathSeeds",
  "expectedProjectionObjectCount",
  "nominalIntervalFeet",
  "doctrineProjectionDiagnostics",
  "HH",
  "VAULT",
  "SPLICE",
  "ILA",
  "MARKER",
  "SLACK",
]) && includesAll(serverProjectionBlock, [
  "projectedObjectManifestId",
]));

check("server readiness fails with specific diagnostic gate reasons", includesAll(sources.commercialIofRoute, [
  "doctrine projection diagnostics failed",
  "failedGates",
  "objectType",
  "reason",
]));

check("Engineering Certification consumes diagnostic results", includesAll(certificationGateBlock, [
  "doctrineProjectionDiagnostics",
  "doctrineProjectionFailedGates",
  "Doctrine Projection Diagnostics failed before Engineering certification",
  "Doctrine Projection Diagnostics are required before Engineering certification",
]));

check("Engineering Projection consumes projected manifest objects first", includesAll(sources.engineeringProjection, [
  "projectedObjectManifest",
  "loose.projectedObjects",
  "projectedObjectManifest.projectedObjects",
  "Doctrine Projection Manifest",
  "doctrineProjectionDiagnostics",
]));

check("Engineering UI exposes Doctrine Projection Diagnostics visibly", includesAll(sources.engineeringWorkspace, [
  "DoctrineProjectionDiagnosticsPanel",
  "Doctrine Projection Diagnostics",
  "Math Present",
  "Objects Calculated",
  "Addresses Assigned",
  "Objects Projected",
  "Calculated Stations",
  "Resolved Coordinates",
]));

check("pricing remains unchanged by projection engine", !/budgetCost|sellPrice|grossMargin|monthlyRevenue|pricingSummary|totalCost/.test(projectionEngine));

check("ScopeVersion remains downstream and does not import projection math", !sources.scopeVersionAuthority.includes("DoctrineProjectionEngine") &&
  sources.scopeVersionAuthority.includes("Geometry Authority must be PASS before ScopeVersion authority.") &&
  sources.scopeVersionAuthority.includes("Product doctrine snapshot is required."));

const failed = checks.filter((item) => !item.condition);

for (const item of checks) {
  console.log(`${item.condition ? "PASS" : "FAIL"} ${item.name}`);
}

if (failed.length) {
  console.error(`\n${failed.length} CIP-034B validation check(s) failed.`);
  process.exit(1);
}

console.log("\nCIP-034B Spine Math Object Placement validation passed.");
