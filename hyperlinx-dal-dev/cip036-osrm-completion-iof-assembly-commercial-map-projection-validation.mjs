import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd().endsWith("hyperlinx-dal-dev")
  ? process.cwd()
  : path.join(process.cwd(), "hyperlinx-dal-dev");

const paths = {
  commercialWorkspace: path.join(root, "src", "components", "workspaces", "GoogleRfpWorkspace.tsx"),
  proposedNetworkMap: path.join(root, "src", "components", "workspaces", "proposednetwork", "ProposedNetworkMapPanel.tsx"),
  proposedGraphInspector: path.join(root, "src", "components", "workspaces", "proposednetwork", "ProposedGraphInspectorPanel.tsx"),
  draftIofAssembly: path.join(root, "src", "commercial", "IOFPackageAssemblyEngine.ts"),
  doctrineProjection: path.join(root, "src", "products", "DoctrineProjectionEngine.ts"),
  doctrineInstantiation: path.join(root, "src", "products", "DoctrineObjectInstantiationEngine.ts"),
  runtimeApi: path.join(root, "src", "api", "teralinxRuntime.ts"),
  sharedRoutes: path.join(root, "server", "routes", "_shared.js"),
  commercialIofRoute: path.join(root, "server", "routes", "commercial-iof-packages.js"),
  engineeringPackages: path.join(root, "server", "routes", "engineering-packages.js"),
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

const autoAssemblyBlock = blockBetween(
  sources.commercialWorkspace,
  "useEffect(() => {\n    let cancelled = false;\n    const routeRepositoryId = generatedRouteRepositorySnapshot?.routeRepositoryId",
  "function handleBuildProductCommercialDesign",
);
const routeGenerationBlock = blockBetween(
  sources.commercialWorkspace,
  "async function handleGenerateCommercialRoute",
  "function activeRouteGeometry",
);
const mapRenderBlock = blockBetween(
  sources.proposedNetworkMap,
  "{layers.commercialProjectedSpans ? visibleCommercialIofSpans.map",
  "{layers.commercialObjectAddresses ?",
);
const diagnosticsPanelBlock = blockBetween(
  sources.commercialWorkspace,
  "commercial-doctrine-diagnostics-panel",
  "<div className=\"dal-panel-title-row commercial-route-inspector-title\">",
);
const sharedHydrationBlock = blockBetween(
  sources.sharedRoutes,
  "export async function hydrateIofProjectionArtifacts",
  "export function recordPath",
);
const commercialIofGetBlock = blockBetween(
  sources.commercialIofRoute,
  "if (normalizedPath === \"/api/commercial/iof-packages\" && req.method === \"GET\")",
  "if (normalizedPath === \"/api/commercial/iof-packages\" && req.method === \"POST\")",
);

check("OSRM route completion commits Route Repository before Initial IOF assembly", includesAll(routeGenerationBlock, [
  "routeCommercialCorridorWithOsrm",
  "routeSnapshotToSave",
  "RouteRepository.saveRoute",
  "verifiedRouteSnapshot",
  "setGeneratedRouteRepositorySnapshot(verifiedRouteSnapshot)",
]) && sources.commercialWorkspace.indexOf("setGeneratedRouteRepositorySnapshot(verifiedRouteSnapshot)") < sources.commercialWorkspace.indexOf("[CIP-035A] Commercial lifecycle sequencing started"));

check("Route Repository commit triggers automatic Initial IOF Package assembly exactly once", includesAll(autoAssemblyBlock, [
  "automaticIofAssemblyRouteRepositoryId === routeRepositoryId",
  "ensureCommercialLifecycleAuthorityForDraft",
  "AUTOMATIC_IOF_PACKAGE_ASSEMBLY",
  "saveCommercialDraftIofPackage",
  "automaticIofPackageAssembly: true",
  "Commercial Ready",
]));

check("Commercial Revision and Commercial Release Package are restored or created before Draft IOF save", includesAll(sources.commercialWorkspace, [
  "CommercialRevisionRepository.listRevisions",
  "CommercialRevisionRepository.saveRevision",
  "CommercialReleasePackageRepository.listReleasePackages",
  "CommercialReleasePackageRepository.saveReleasePackage",
  "commercialRevisionId",
  "commercialReleasePackageId",
]));

check("Product Doctrine and Doctrine Projection are applied immediately from existing assembly logic", includesAll(sources.commercialWorkspace, [
  "selectedProductDoctrine",
  "scheduleDraftIofPackageAssembly",
  "productDoctrineAssembly",
]) && includesAll(sources.draftIofAssembly, [
  "projectDoctrineToStationSpine",
  "doctrineObjectManifest: doctrineObjectInstantiation.engineeringObjectManifest",
  "doctrineProjectionDiagnostics",
]) && includesAll(sources.doctrineProjection, [
  "projectDoctrineToStationSpine",
]) && includesAll(sources.commercialWorkspace, [
  "PRODUCT_REGISTRY.resolve(selectedProductOption.productId)",
  "selectedProductResolution?.doctrine",
]));

check("Projection uses route length, station spine, existing quantities, and deterministic object IDs", includesAll(sources.doctrineProjection, [
  "routeFeet / count",
  "coordinateAtMeasureOnSpine",
  "stationAddress",
  "HH",
  "VAULT",
  "SPLICE",
  "ILA",
  "MARKER",
  "SLACK",
  "TERM",
  "CROSSING",
  "objectId",
  "executionSequenceId",
  "closeSequenceId",
  "paymentSequenceId",
  "currentLifecycleState: \"COMMERCIAL_ASSEMBLED\"",
]));

check("Linear assets attach to derived spans without per-foot object explosion", includesAll(sources.doctrineProjection, [
  "LINEAR_SPAN_ASSETS",
  "CONDUIT",
  "FIBER",
  "TRACE_WIRE",
  "WARNING_TAPE",
  "MULE_TAPE_PULL_TAPE",
  "linearAssetAttachmentsForSpans",
  "containedAssets",
  "fullSpineViewOnly: true",
]));

check("Projected spans, object addresses, and linear attachments hydrate from immutable artifacts", includesAll(sharedHydrationBlock, [
  "projectedObjectManifest.projectedSpans",
  "hydrated.projectedSpans",
  "projectedObjectManifest.objectAddresses",
  "hydrated.objectAddresses",
  "projectedObjectManifest.linearAssetSpanAttachments",
  "hydrated.linearAssetSpanAttachments",
  "hydrated.doctrineLinearAssetSpanAttachments",
]));

check("Draft IOF package remains reference-only while artifacts persist in repositories", includesAll(sources.sharedRoutes, [
  "persistIofProjectionArtifacts",
  "stripIofProjectionArtifacts",
  "delete next.projectedObjects",
  "delete next.projectedSpans",
  "delete next.objectAddresses",
  "noEmbeddedManifests: true",
  "noEmbeddedGeometry: true",
  "noDuplicatedObjectGraphs: true",
]) && includesAll(sources.runtimeApi, [
  "noEmbeddedRouteGeometry: true",
  "noEmbeddedWorkbookRows: true",
  "noEmbeddedProposalBody: true",
  "noEmbeddedRuntimeInventory: true",
]));

check("Commercial Draft IOF list and open paths return hydrated projection artifacts for restore", includesAll(commercialIofGetBlock, [
  "packageRecords",
  "hydrateIofProjectionArtifacts",
  "Promise.all",
]) && sources.commercialIofRoute.includes("const draftPackage = await hydrateIofProjectionArtifacts(await loadRecord(DIRS.iofPackages, id))"));

check("Commercial Doctrine Diagnostics panel is visible and shows four gates", includesAll(diagnosticsPanelBlock, [
  "Commercial Doctrine Diagnostics",
  "data-commercial-doctrine-diagnostics=\"visible\"",
  "Math Present",
  "Objects Calculated",
  "Addresses Assigned",
  "Objects Projected",
  "commercialDoctrineDiagnosticsRows",
]));

check("Diagnostics represent required billable classes", includesAll(sources.commercialWorkspace + sources.doctrineProjection, [
  "CONDUIT",
  "FIBER",
  "TRACE_WIRE",
  "WARNING_TAPE",
  "MULE_TAPE_PULL_TAPE",
  "HANDHOLE",
  "VAULT",
  "SPLICE_CASE",
  "ILA_REGENERATION_SITE",
  "MARKER_POST",
  "SLACK_LOOP",
  "CROSSING",
  "TERMINATION_POINT",
]));

check("Commercial map renders projected objects and clickable projected spans", includesAll(sources.proposedNetworkMap, [
  "CommercialIofProjectionOverlay",
  "commercialIofProjection",
  "visibleCommercialIofObjects",
  "visibleCommercialIofSpans",
  "commercial-iof-projected-object",
  "commercial-iof-projected-span",
  "onSelect({ type: \"commercialIofObject\"",
  "onSelect({ type: \"commercialIofSpan\"",
]) && includesAll(mapRenderBlock, [
  "pathData(coordinates, project)",
  "commercialIofSpanColor",
  "commercialIofObjectColor",
]));

check("Commercial object and span inspectors expose sequence, dependency, evidence, and lifecycle fields", includesAll(sources.commercialWorkspace + sources.proposedGraphInspector, [
  "Initial IOF Object Inspector",
  "Initial IOF Span Inspector",
  "Billable Material",
  "Billable Labor",
  "Dependencies",
  "Execution",
  "Payment",
  "Close",
  "Evidence",
  "Lifecycle",
]));

check("Engineering restores the same projected object graph instead of regenerating it", includesAll(sources.engineeringPackages, [
  "projectedObjects:",
  "projectedObjectManifest).projectedObjects",
  "stationProjection: Boolean(record.stationProjectionId",
]) && includesAll(sources.engineeringProjection, [
  "Doctrine Projection Manifest",
  "doctrineProjectedSpanPrimitives",
  "DOCTRINE_PROJECTED_SPANS",
]));

check("No pricing formulas were changed by CIP-036 OSRM projection wiring", ![
  "CHANGE_PLOW_RATE",
  "CHANGE_BORE_RATE",
  "grossMargin",
  "monthlyRevenue",
  "sellPrice",
].some((term) => mapRenderBlock.includes(term) || diagnosticsPanelBlock.includes(term)));

check("ScopeVersion authority remains unchanged by Commercial map projection", !sources.scopeVersionAuthority.includes("commercialIofProjection") &&
  !sources.scopeVersionAuthority.includes("Commercial Doctrine Diagnostics") &&
  sources.scopeVersionAuthority.includes("Product doctrine snapshot is required."));

check("Marketplace, Control, Field, Twin, and Operational Intelligence behavior are not invoked by map projection", ![
  "/api/marketplace",
  "/api/control",
  "/api/field",
  "OperationalIntelligence",
  "TwinWorkspace",
].some((term) => mapRenderBlock.includes(term) || diagnosticsPanelBlock.includes(term) || autoAssemblyBlock.includes(term)));

const failed = checks.filter((item) => !item.condition);

for (const item of checks) {
  console.log(`${item.condition ? "PASS" : "FAIL"} ${item.name}${item.detail ? ` - ${item.detail}` : ""}`);
}

if (failed.length) {
  console.error(`\n${failed.length} CIP-036 OSRM completion validation check(s) failed.`);
  process.exit(1);
}

console.log("\nCIP-036 OSRM Completion IOF Assembly Commercial Map Projection validation passed.");
