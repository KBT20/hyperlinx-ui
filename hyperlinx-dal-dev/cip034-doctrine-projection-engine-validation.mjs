import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd().endsWith("hyperlinx-dal-dev")
  ? process.cwd()
  : path.join(process.cwd(), "hyperlinx-dal-dev");

const paths = {
  projectionEngine: path.join(root, "src", "products", "DoctrineProjectionEngine.ts"),
  instantiationEngine: path.join(root, "src", "products", "DoctrineObjectInstantiationEngine.ts"),
  draftIofAssembly: path.join(root, "src", "commercial", "IOFPackageAssemblyEngine.ts"),
  runtimeApi: path.join(root, "src", "api", "teralinxRuntime.ts"),
  commercialIofRoute: path.join(root, "server", "routes", "commercial-iof-packages.js"),
  engineeringPackages: path.join(root, "server", "routes", "engineering-packages.js"),
  engineeringCertification: path.join(root, "server", "routes", "engineering-certification.js"),
  engineeringProjection: path.join(root, "src", "engineering", "EngineeringCertificationProjection.ts"),
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

function check(name, condition, detail = "") {
  checks.push({ name, condition: Boolean(condition), detail });
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
const draftIofReturnBlock = blockBetween(sources.draftIofAssembly, "return {\n    packageId,", "  };\n}");
const draftValidationBlock = blockBetween(sources.draftIofAssembly, "function buildValidation", "function packageReadiness");
const stationProjectionBlock = blockBetween(sources.commercialIofRoute, "function stationProjectionForDraftPackage", "function stationAwareSubmitReadiness");
const certificationGateBlock = blockBetween(sources.engineeringCertification, "async function handleCertifyPackage", "const timestamp = nowIso();");
const renderSpecBlock = blockBetween(sources.engineeringProjection, "function renderCertificationSpec", "export function buildEngineeringCertificationProjection");

check("Doctrine Projection Engine exists and declares constitutional authority", includesAll(projectionEngine, [
  "export const DOCTRINE_PROJECTION_AUTHORITY = \"DOCTRINE_PROJECTION_ENGINE\"",
  "export const DOCTRINE_PROJECTION_VERSION = \"37.0\"",
  "export function projectDoctrineToStationSpine",
  "ProductDoctrine",
  "DoctrineEngineeringObjectManifest",
  "MeasuredSpine",
  "StationAuthority",
  "StationIndexedGraph",
]));

check("Projection Engine emits required authority IDs", includesAll(projectionEngine, [
  "measuredCenterlineId",
  "stationProjectionId",
  "stationGraphId",
  "stationAuthorityIds",
  "projectedObjectManifestId",
  "projectedObjectManifest",
  "stationProjection",
  "stationGraph",
]));

check("Projection Engine materializes every doctrine object onto station spine", includesAll(projectionEngine, [
  "projectObjectsFromQuantitySchedule",
  "projectionSeeds(args.quantityPlacement, args.doctrineObjectManifest)",
  "manifestObjectCount",
  "coordinateAtMeasureOnSpine",
  "stationAddress",
  "geographicCoordinate",
  "parentSpanId",
  "parentRouteId",
  "placementAuthority",
  "projectionAuthority",
  "engineeringAuthority",
  "doctrineQuantitySource",
  "executionSequenceId",
  "closeSequenceId",
  "paymentSequenceId",
]));

check("Projection Engine derives clickable spans from doctrine manifest only", includesAll(projectionEngine, [
  "derivedSpansFromProjectedObjects",
  "projectedObjects.slice(0, -1).map",
  "measuredCenterlineId",
  "startMeasure: start.measure",
  "endMeasure: end.measure",
  "renderAuthority: \"MEASURED_CENTERLINE_CLIP\"",
  "independentGeometryProhibited: true",
  "linearAssetSpanAttachments",
  "linearAssetAttachmentsForSpans",
  "containedAssets",
  "dependencies",
]) && !projectionEngine.includes("coordinates: [start.coordinate, end.coordinate]"));

check("Projection Engine validates count and required projected object fields", includesAll(projectionEngine, [
  "math count does not match doctrine quantity",
  "object lacks address",
  "coordinate not resolved",
  "station not resolved",
  "missing parent span",
  "missing execution sequence",
  "missing close sequence",
  "missing payment sequence",
  "placeholderObjectCount",
]));

check("Projection Engine does not introduce pricing or commercial quantity recalculation", !/pricing|budgetCost|sellPrice|margin|grossMargin|monthlyRevenue/.test(projectionEngine) &&
  projectionEngine.includes("quantityPlacementFromManifest"));

check("Projection Engine does not import or invoke downstream execution authorities", !projectionEngine.includes("../scopeversion") &&
  !projectionEngine.includes("../marketplace") &&
  !projectionEngine.includes("../control") &&
  !projectionEngine.includes("../field") &&
  !projectionEngine.includes("../twin") &&
  !projectionEngine.includes("OperationalIntelligence"));

check("Draft IOF assembly runs projection after doctrine object instantiation", sources.draftIofAssembly.indexOf("const doctrineProjection") > sources.draftIofAssembly.indexOf("const doctrineObjectInstantiation") &&
  includesAll(sources.draftIofAssembly, [
    "import { projectDoctrineToStationSpine }",
    "projectDoctrineToStationSpine({",
    "doctrineObjectManifest: doctrineObjectInstantiation.engineeringObjectManifest",
    "measuredSpine",
    "stationAuthority",
    "stationIndexedGraph",
  ]));

check("Draft IOF validation exposes projection readiness rows", includesAll(draftValidationBlock, [
  "doctrine-projection-engine",
  "doctrine-projection-measured-centerline",
  "doctrine-projection-station-projection",
  "doctrine-projection-station-graph",
  "doctrine-projection-station-authorities",
  "doctrine-projection-projected-object-manifest",
]));

check("Draft IOF package returns CIP-034 projection deliverables", includesAll(draftIofReturnBlock, [
  "doctrineProjection",
  "doctrineProjectionId",
  "doctrineProjectionValidation",
  "measuredCenterlineId",
  "stationProjectionId",
  "stationGraphId",
  "stationAuthorityIds",
  "projectedObjectManifestId",
  "projectedObjectManifest",
  "projectedObjects",
  "projectedSpans",
  "objectStationAttachments",
]));

check("Reference-only Draft IOF serializer preserves projection artifacts without restoring embedded commercial bodies", includesAll(sources.runtimeApi, [
  "doctrineProjection: draft.doctrineProjection",
  "measuredCenterline: draft.measuredCenterline",
  "stationProjection: draft.stationProjection",
  "stationGraph: draft.stationGraph",
  "stationAuthorities: draft.stationAuthorities",
  "projectedObjectManifest: draft.projectedObjectManifest",
  "projectedSpans: draft.projectedSpans",
  "noEmbeddedRouteGeometry: true",
  "noEmbeddedWorkbookRows: true",
  "noEmbeddedProposalBody: true",
  "noEmbeddedRuntimeInventory: true",
]));

check("Server submit hydrator requires Doctrine Object Manifest and materializes station projection", includesAll(sources.commercialIofRoute, [
  "requireDoctrineObjectMaterializationForStationProjection",
  "Doctrine Object Manifest is required before Engineering submission",
]) && includesAll(stationProjectionBlock, [
  "stationProjectionId",
  "projectedObjectManifestId",
  "projectedSpans",
  "linearAssetSpanAttachments",
  "DOCTRINE_PROJECTION_ENGINE",
]) && !sources.commercialIofRoute.includes("function sourceObjectsForStationProjection"));

check("Engineering Package persists and verifies projection reference IDs", includesAll(sources.engineeringPackages, [
  "\"measuredCenterlineId\"",
  "\"stationProjectionId\"",
  "\"stationGraphId\"",
  "\"stationAuthorityIds\"",
  "\"projectedObjectManifestId\"",
  "stationProjection: Boolean(record.stationProjectionId",
  "projectedObjectManifest: Boolean(record.projectedObjectManifestId",
  "projectedObjects:",
]));

check("Engineering Certification blocks missing projection outputs and invalid projected objects", includesAll(certificationGateBlock, [
  "measuredCenterlineId",
  "stationProjectionId",
  "stationGraphId",
  "stationAuthorityIds",
  "projectedObjectManifestId",
  "Projected Object Manifest validation failed",
  "execution sequence",
  "close sequence",
  "payment sequence",
]));

check("Engineering map renders doctrine action objects and selectable projected spans", includesAll(sources.engineeringProjection, [
  "doctrineInstantiatedObjectsFromPackage",
  "packageSource: \"Doctrine Object Manifest\"",
  "doctrineProjectedSpanPrimitives",
  "DOCTRINE_PROJECTED_SPANS",
  "selectable: true",
]) && includesAll(renderSpecBlock, [
  "objectAddressingPrimitives",
  "doctrineProjectedSpanPrimitives",
  "instantiatedSpineObjectPrimitives",
]));

check("ScopeVersion authority remains downstream and gated after CIP-037", !sources.scopeVersionAuthority.includes("DoctrineProjectionEngine") &&
  sources.scopeVersionAuthority.includes("Geometry Authority must be PASS before ScopeVersion authority.") &&
  sources.scopeVersionAuthority.includes("Product doctrine snapshot is required."));

const failed = checks.filter((item) => !item.condition);

for (const item of checks) {
  console.log(`${item.condition ? "PASS" : "FAIL"} ${item.name}${item.detail ? ` - ${item.detail}` : ""}`);
}

if (failed.length) {
  console.error(`\n${failed.length} CIP-034 validation check(s) failed.`);
  process.exit(1);
}

console.log("\nCIP-034 Doctrine Projection Engine validation passed.");
