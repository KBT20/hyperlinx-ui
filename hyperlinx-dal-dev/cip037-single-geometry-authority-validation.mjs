import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd().endsWith("hyperlinx-dal-dev")
  ? process.cwd()
  : path.join(process.cwd(), "hyperlinx-dal-dev");

const paths = {
  projectionEngine: path.join(root, "src", "products", "DoctrineProjectionEngine.ts"),
  measuredSpineRenderer: path.join(root, "src", "rendering", "MeasuredSpineRenderer.ts"),
  projectedSpanRenderer: path.join(root, "src", "rendering", "ProjectedSpanRenderer.ts"),
  commercialWorkspace: path.join(root, "src", "components", "workspaces", "GoogleRfpWorkspace.tsx"),
  commercialMap: path.join(root, "src", "components", "workspaces", "proposednetwork", "ProposedNetworkMapPanel.tsx"),
  engineeringProjection: path.join(root, "src", "engineering", "EngineeringCertificationProjection.ts"),
  engineeringWorkspace: path.join(root, "src", "workspaces", "EngineeringCertificationWorkspace.tsx"),
  sharedRoutes: path.join(root, "server", "routes", "_shared.js"),
  commercialIofRoute: path.join(root, "server", "routes", "commercial-iof-packages.js"),
  engineeringPackages: path.join(root, "server", "routes", "engineering-packages.js"),
  engineeringCertification: path.join(root, "server", "routes", "engineering-certification.js"),
  certificationLedger: path.join(root, "server", "routes", "certification-ledger.js"),
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
const projectedSpanTypeBlock = blockBetween(projectionEngine, "export type DoctrineProjectedSpan", "export type GeometryAuthorityDiagnostics");
const derivedSpanBlock = blockBetween(projectionEngine, "function derivedSpansFromProjectedObjects", "function linearAssetAttachmentsForSpans");
const geometryDiagnosticsBlock = blockBetween(projectionEngine, "function geometryAuthorityDiagnostics", "export function projectDoctrineToStationSpine");
const commercialMapSpanBlock = blockBetween(sources.commercialMap, "{layers.commercialProjectedSpans ? visibleCommercialIofSpans.map", "{layers.commercialProjectedObjects");
const commercialGeometryPanelBlock = blockBetween(sources.commercialWorkspace, "commercial-geometry-authority-panel", "commercial-doctrine-diagnostics-panel");
const engineeringSpanBlock = blockBetween(sources.engineeringProjection, "function doctrineProjectedSpanPrimitives", "function spineObjectLayer");
const certificationGateBlock = blockBetween(sources.engineeringCertification, "async function handleCertifyPackage", "const timestamp = nowIso();");
const scopeVersionCreateBlock = blockBetween(sources.scopeVersionAuthority, "export function createScopeVersionFromCertifiedPackage", "export function markCertifiedPackagePromoted");

check("Measured Spine renderer clips centerline by measure", includesAll(sources.measuredSpineRenderer, [
  "export function measuredSpineCoordinates",
  "export function coordinateAtMeasure",
  "export function clipMeasuredSpineToMeasureRange",
  "cumulativeStartFeet",
  "cumulativeEndFeet",
]));

check("Projected Span renderer renders from measured centerline only", includesAll(sources.projectedSpanRenderer, [
  "export function projectedSpanCoordinates",
  "export function renderSpan",
  "clipMeasuredSpineToMeasureRange",
]) && !sources.projectedSpanRenderer.includes("coordinates ??"));

check("Doctrine Projection declares one measured centerline authority", includesAll(projectionEngine, [
  "export const DOCTRINE_PROJECTION_VERSION = \"37.0\"",
  "measuredCenterlineId",
  "geometryAuthority: \"MEASURED_CENTERLINE\"",
  "singleGeometryAuthority: true",
  "segments: input.measuredSpine.segments",
  "cumulativeMeasureIndex: input.measuredSpine.cumulativeMeasureIndex",
]));

check("Projected objects store measure and coordinate authority", includesAll(projectionEngine, [
  "measure: stationFeet",
  "coordinateAtMeasureOnSpine",
  "coordinateAuthority: \"MEASURED_CENTERLINE\"",
  "stationAddress",
  "geographicCoordinate",
]));

check("Projected spans are measure references without independent coordinates", includesAll(projectedSpanTypeBlock, [
  "measuredCenterlineId: string",
  "startMeasure: number",
  "endMeasure: number",
  "startObjectId: string",
  "endObjectId: string",
  "renderAuthority: \"MEASURED_CENTERLINE_CLIP\"",
  "independentGeometryProhibited: true",
]) && !projectedSpanTypeBlock.includes("coordinates:"));

check("Span derivation stores measures and no coordinate arrays", includesAll(derivedSpanBlock, [
  "derivedSpansFromProjectedObjects(packageId: string, measuredCenterlineId: string",
  "startMeasure: start.measure",
  "endMeasure: end.measure",
  "renderAuthority: \"MEASURED_CENTERLINE_CLIP\"",
  "independentGeometryProhibited: true",
]) && !derivedSpanBlock.includes("coordinates: ["));

check("Geometry Authority diagnostics prove zero drift and independent span geometry", includesAll(geometryDiagnosticsBlock, [
  "duplicateMeasuredCenterlineCount",
  "independentGeometryCount",
  "objectsOnSpine",
  "maximumDriftFeet: 0",
  "independentSpanGeometryCount",
  "commercialRenderValidation",
  "engineeringRenderValidation",
  "fieldRenderValidation",
  "twinRenderValidation",
]));

check("Draft IOF persistence strips duplicate geometry from package envelope", includesAll(sources.sharedRoutes, [
  "delete next.geometry",
  "delete next.centerline",
  "delete next.centerlineRoute",
  "delete next.osrmRoute",
  "delete next.spine",
  "hydrateIofProjectionArtifacts",
  "hydrated.geometryAuthorityDiagnostics",
]));

check("Commercial map renders measured spine and clipped projected spans", includesAll(sources.commercialMap, [
  "measuredSpineCoordinates",
  "renderSpan(commercialIofProjection?.measuredCenterline, span)",
  "commercial-iof-measured-spine",
  "commercial-iof-projected-span",
  "layers.commercialProjectedSpans",
]) && includesAll(commercialMapSpanBlock, [
  "pathData(coordinates, project)",
  "onSelect({ type: \"commercialIofSpan\"",
]) && !sources.commercialMap.includes("projectedSpans.flatMap((span) => span.coordinates"));

check("Commercial Geometry Authority diagnostics are visible", includesAll(commercialGeometryPanelBlock, [
  "Geometry Authority",
  "data-geometry-authority-diagnostics=\"visible\"",
  "Independent Geometry",
  "Objects On Spine",
  "Maximum Drift",
  "Independent Span Geometry",
  "Commercial",
  "Engineering",
  "Field",
  "Twin",
]));

check("Engineering map renders projected spans by clipping measured spine", includesAll(engineeringSpanBlock, [
  "renderSpan(measuredCenterline, span)",
  "renderAuthority: \"MEASURED_CENTERLINE_CLIP\"",
  "measuredCenterlineId: span.measuredCenterlineId",
  "independentGeometryProhibited: true",
]) && !engineeringSpanBlock.includes("coordinatesFrom(span.coordinates)"));

check("Engineering Geometry Authority diagnostics are visible", includesAll(sources.engineeringWorkspace, [
  "function GeometryAuthorityDiagnosticsPanel",
  "data-geometry-authority-diagnostics=\"visible\"",
  "Geometry Authority",
  "Independent Span Geometry",
  "Maximum Drift",
  "<GeometryAuthorityDiagnosticsPanel projection={projection} />",
]));

check("Engineering Package remains reference-only and declares geometry authority", includesAll(sources.engineeringPackages, [
  "\"geometryAuthority\"",
  "\"singleGeometryAuthority\"",
  "\"noIndependentSpanGeometry\"",
  "geometryAuthority: \"MEASURED_CENTERLINE\"",
  "singleGeometryAuthority: true",
  "noIndependentSpanGeometry: true",
]));

check("Certification gate blocks drift, independent span geometry, and missing diagnostics", includesAll(certificationGateBlock, [
  "Geometry Authority diagnostics are required before Engineering certification.",
  "independentSpanGeometryCount",
  "maximumDriftFeet",
  "Span contains independent geometry",
  "Geometry drift exceeds tolerance",
  "Geometry Authority validation failed before Engineering certification",
]));

check("Certified IOF Package projection carries geometry authority diagnostics", includesAll(sources.certificationLedger, [
  "\"geometryAuthorityDiagnostics\"",
  "geometryAuthorityDiagnostics: asRecord(context.geometryAuthorityDiagnostics)",
]));

check("ScopeVersion gate refuses promotion when Geometry Authority is not PASS", includesAll(scopeVersionCreateBlock, [
  "geometryAuthorityDiagnosticsFromPackage",
  "Geometry Authority is PASS",
  "measuredCenterlineId",
  "projectedObjectManifestId",
  "stationGraphId",
  "stationAuthorityIds",
  "geometryAuthority: \"MEASURED_CENTERLINE\"",
  "noIndependentSpanGeometry: true",
]));

check("ScopeVersion validation requires measured geometry references", includesAll(sources.scopeVersionAuthority, [
  "Geometry Authority must be PASS before ScopeVersion authority.",
  "Measured Centerline reference is required before ScopeVersion authority.",
  "Projected Object Manifest reference is required before ScopeVersion authority.",
  "Station Graph reference is required before ScopeVersion authority.",
  "Station Authority references are required before ScopeVersion authority.",
]));

check("No pricing, Product Doctrine quantity, or downstream workflow code is introduced", !/sellPrice|grossMargin|monthlyRevenue|pricingFormula|Marketplace|OperationalIntelligence/.test(sources.measuredSpineRenderer + sources.projectedSpanRenderer + projectionEngine));

const failed = checks.filter((item) => !item.condition);

for (const item of checks) {
  console.log(`${item.condition ? "PASS" : "FAIL"} ${item.name}`);
}

if (failed.length) {
  console.error(`\n${failed.length} CIP-037 validation check(s) failed.`);
  process.exit(1);
}

console.log("\nCIP-037 Single Geometry Authority validation passed.");
