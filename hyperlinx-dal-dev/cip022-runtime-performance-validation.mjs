import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd().endsWith("hyperlinx-dal-dev")
  ? process.cwd()
  : path.join(process.cwd(), "hyperlinx-dal-dev");

const paths = {
  workspace: path.join(root, "src", "components", "workspaces", "GoogleRfpWorkspace.tsx"),
  mapPanel: path.join(root, "src", "components", "workspaces", "proposednetwork", "ProposedNetworkMapPanel.tsx"),
  repositories: path.join(root, "src", "repositories", "commercialRepositories.ts"),
  runtimeApi: path.join(root, "src", "api", "teralinxRuntime.ts"),
  proposalAuthority: path.join(root, "src", "kernel", "ProposalAuthorityState.ts"),
  inventoryCache: path.join(root, "src", "performance", "InventoryImportCache.ts"),
  asyncImport: path.join(root, "src", "performance", "AsyncCustomerDesignImport.ts"),
  mapVirtualization: path.join(root, "src", "performance", "MapVirtualization.ts"),
  runtimeInstrumentation: path.join(root, "src", "performance", "RuntimePerformanceInstrumentation.ts"),
  runtimeDiagnostics: path.join(root, "src", "performance", "RuntimeDiagnostics.ts"),
  workbookDomains: path.join(root, "src", "performance", "WorkbookRecalculationDomains.ts"),
  ilaEngine: path.join(root, "src", "commercial", "IlaPlanningEngine.ts"),
  estimateEngine: path.join(root, "src", "commercial", "TransparentEstimatingEngine.ts"),
  report: path.join(root, "CIP_022_RUNTIME_PERFORMANCE_IMPORT_CACHING_MAP_VIRTUALIZATION_REPORT.md"),
};

for (const requiredPath of Object.values(paths)) {
  if (!existsSync(requiredPath)) {
    console.error(`FAIL missing required file: ${path.relative(root, requiredPath)}`);
    process.exit(1);
  }
}

const source = Object.fromEntries(Object.entries(paths).map(([key, filePath]) => [key, readFileSync(filePath, "utf8")]));
const checks = [];

function check(name, condition, detail = "") {
  checks.push({ name, condition: Boolean(condition), detail });
}

function includesAll(text, terms) {
  return terms.every((term) => text.includes(term));
}

function listSourceFiles(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = path.join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) return listSourceFiles(fullPath);
    return /\.(ts|tsx|js|jsx)$/.test(entry) ? [fullPath] : [];
  });
}

const sourceFiles = listSourceFiles(path.join(root, "src"));
const directRouteEndpointCallers = sourceFiles
  .filter((file) => file !== paths.runtimeApi)
  .filter((file) => readFileSync(file, "utf8").includes("/api/commercial/routes"));

check("inventory import cache uses the required authority key", includesAll(source.inventoryCache, [
  "customerTwinId",
  "customerId",
  "inventorySourceId",
  "importHash",
  "routeCount",
  "lastModified",
  "buildInventoryCacheKey",
  "cacheInventoryProjection",
  "findCachedInventoryProjectionForCustomer",
]));
check("inventory import deduplication uses route, folder, placemark, coordinate, and import hashes", includesAll(source.inventoryCache, [
  "importDeduplicationIndex",
  "coordinateHash",
  "folderPath?.join",
  "provenance?.placemarkName",
  "buildInventoryImportHash",
  "dedupeCustomerDesignImport",
]));
check("KMZ/KML/GeoJSON/CSV import runs through async worker-style progress states", includesAll(source.asyncImport, [
  "\"Importing KMZ\"",
  "\"Parsing\"",
  "\"Normalizing\"",
  "\"Building Geometry Index\"",
  "\"Caching\"",
  "\"Ready\"",
  "requestIdleCallback",
  "setTimeout",
  "parseCustomerDesignFile(args)",
  "onProgress",
]));
check("import parsing is instrumented by phase", includesAll(source.asyncImport, [
  "startRuntimePerformanceOperation(\"kmz-parse\"",
  "startRuntimePerformanceOperation(\"normalization\"",
  "startRuntimePerformanceOperation(\"geometry-build\"",
]));
check("Commercial repositories use the async import wrapper with UI progress callbacks", includesAll(source.repositories, [
  "parseCustomerDesignFileAsync",
  "onProgress?: (state: AsyncImportProgressState) => void",
  "onProgress: input.onProgress",
  "parseCustomerDesignFileAsync(input)",
]));
check("Commercial Planning progressively restores Customer Twin from cache before background refresh", includesAll(source.workspace, [
  "findCachedInventoryProjectionForCustomer(selectedAccount.accountId)",
  "Inventory projection restored from cache",
  "Inventory cache miss. Customer Twin will load in the background.",
  "cacheInventoryProjection",
  "startRuntimePerformanceOperation(\"inventory-import\"",
  "window.setTimeout",
]));
check("Runtime Performance panel is present in Commercial diagnostics", includesAll(source.workspace, [
  "runtimePerformancePanelOpen",
  "<b>Runtime Performance</b>",
  "Show Runtime Performance",
  "inventoryCacheStats()",
  "recentRuntimePerformanceMetrics",
]));
check("Map virtualization module defines viewport, LOD, simplification, and label gates", includesAll(source.mapVirtualization, [
  "MapLevelOfDetail",
  "ViewportBounds",
  "mapLevelOfDetail",
  "simplifyGeometryForZoom",
  "geometryForViewport",
  "shouldRenderStationLabels",
  "shouldRenderMinorObjects",
  "shouldRenderMajorStations",
]));
check("Proposed Network map uses virtualized geometry and viewport render instrumentation", includesAll(source.mapPanel, [
  "geometryForViewport",
  "viewportBounds",
  "virtualizeGeometry",
  "shouldRenderStationLabels",
  "shouldRenderMinorObjects",
  "startRuntimePerformanceOperation(\"map-viewport-render\"",
]));
check("ILA planning is memoized and estimate recalculation is instrumented", includesAll(source.ilaEngine + source.estimateEngine, [
  "ilaPlanningMemo",
  "memoizedIlaPlanningKey",
  "buildMemoizedIlaPlanningResult",
  "buildMemoizedIlaPlanningResult({",
  "startRuntimePerformanceOperation(\"ila-recalculation\"",
]));
check("Workbook recalculation boundaries are explicit and used by the workspace", includesAll(source.workbookDomains + source.workspace, [
  "ROUTE_CALCULATION",
  "ESTIMATE_CALCULATION",
  "WORKBOOK_DISPLAY",
  "ILA_PLANNING",
  "PROPOSAL_GENERATION",
  "affectedWorkbookExecutionDomains",
  "WorkbookRecalculationBoundary",
  "startRuntimePerformanceOperation(\"workbook-recalculation\"",
]));
check("Runtime diagnostics are debug-gated and throttled", includesAll(source.runtimeDiagnostics, [
  "VITE_DEBUG_RUNTIME_DIAGNOSTICS",
  "DEBUG_RUNTIME_DIAGNOSTICS",
  "lastDiagnosticAt",
  "now - previous < 250",
  "runtimeDiagnosticsLog",
  "runtimeDiagnosticsWarn",
]) && !source.runtimeDiagnostics.includes("Boolean(env?.DEV)"));
check("Commercial route client diagnostics use the canonical runtime client", includesAll(source.runtimeApi, [
  "runtimeDiagnosticsLog(\"CommercialRouteRepository\"",
  "runtimeDiagnosticsLog(\"CommercialRouteRepositoryClient\"",
  "COMMERCIAL_ROUTE_REPOSITORY_ENDPOINT = \"/api/commercial/routes\"",
  "commercialRouteRepositoryRequest",
]));
check("Proposal authority diagnostics are kernel-owned, not React render console chatter", includesAll(source.proposalAuthority, [
  "runtimeDiagnosticsLog",
  "evaluateProposalAuthorityState",
  "logProposalAuthorityStateHydration",
]));
check("no direct /api/commercial/routes callers remain outside teralinxRuntime client", directRouteEndpointCallers.length === 0, directRouteEndpointCallers.map((file) => path.relative(root, file)).join(", "));
check("performance modules do not create ScopeVersion or mutate production inventory", ![
  source.inventoryCache,
  source.asyncImport,
  source.mapVirtualization,
  source.runtimeInstrumentation,
  source.runtimeDiagnostics,
  source.workbookDomains,
].join("\n").match(/createScopeVersion|commitRuntimeTranslation|createInventory|Marketplace|Control|Field/));
check("CIP-022 report documents performance scope and validation", includesAll(source.report, [
  "Import Caching",
  "Async Import Execution",
  "Map Virtualization",
  "Incremental Execution",
  "Runtime Performance Panel",
  "Validation Results",
]));

const failed = checks.filter((item) => !item.condition);

for (const item of checks) {
  const status = item.condition ? "PASS" : "FAIL";
  console.log(`${status} ${item.name}${item.detail ? ` - ${item.detail}` : ""}`);
}

if (failed.length) {
  console.error(`\n${failed.length} CIP-022 runtime performance validation check(s) failed.`);
  process.exit(1);
}

console.log("\nCIP-022 runtime performance validation passed.");
