import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd().endsWith("hyperlinx-dal-dev")
  ? process.cwd()
  : path.join(process.cwd(), "hyperlinx-dal-dev");

const workspacePath = path.join(root, "src", "components", "workspaces", "GoogleRfpWorkspace.tsx");
const mapPanelPath = path.join(root, "src", "components", "workspaces", "proposednetwork", "ProposedNetworkMapPanel.tsx");

for (const requiredPath of [workspacePath, mapPanelPath]) {
  if (!existsSync(requiredPath)) {
    console.error(`FAIL missing required source file: ${path.relative(root, requiredPath)}`);
    process.exit(1);
  }
}

const workspace = readFileSync(workspacePath, "utf8");
const mapPanel = readFileSync(mapPanelPath, "utf8");
const checks = [];

function check(name, condition, detail = "") {
  checks.push({ name, condition: Boolean(condition), detail });
}

function includesAll(source, terms) {
  return terms.every((term) => source.includes(term));
}

function countMatches(source, regex) {
  return (source.match(regex) ?? []).length;
}

function blockBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  if (start < 0) return "";
  const end = source.indexOf(endMarker, start + startMarker.length);
  return end < 0 ? source.slice(start) : source.slice(start, end);
}

const existingNetworkAction = workspace.match(/<label[^>]*commercial-file-action[^>]*>\s*Import Existing Network[\s\S]*?<\/label>/)?.[0] ?? "";
const routeImportAction = workspace.match(/<label[^>]*commercial-file-action[^>]*>\s*Import Route\s*<input[\s\S]*?<\/label>/)?.[0] ?? "";
const routeImportActionCount = countMatches(workspace, /<label[^>]*commercial-file-action[^>]*>\s*Import Route\s*<input[\s\S]*?<\/label>/g);
const replaceImportAction = workspace.match(/<label[^>]*commercial-file-action[^>]*>\s*Replace Imported Route[\s\S]*?<\/label>/)?.[0] ?? "";
const parseBody = blockBetween(workspace, "async function handleRouteImportFile", "function handleSaveTemporaryImportedRoute");
const saveBody = blockBetween(workspace, "function handleSaveTemporaryImportedRoute", "function handleDiscardTemporaryImportedRoute");
const discardBody = blockBetween(workspace, "function handleDiscardTemporaryImportedRoute", "function handleUseExistingCustomerSite");
const overlayBlock = workspace.match(/const commercialOpportunityOverlay = useMemo[\s\S]*?const accountCustomerReviewStatus/)?.[0] ?? "";
const mapLayerBlock = workspace.match(/const commercialMapLayers = useMemo[\s\S]*?const excludedInventoryAccountNames/)?.[0] ?? "";

check("native Import Route header file picker exists exactly once", routeImportActionCount === 1, `found ${routeImportActionCount}`);
check("Import Route accepts KMZ, KML, GeoJSON, JSON, and CSV", includesAll(routeImportAction, [
  'type="file"',
  'accept=".kmz,.kml,.geojson,.json,.csv"',
  "handleRouteImportFile(file)",
]));
check("Existing Network import remains customer twin only", includesAll(existingNetworkAction, [
  "Import Existing Network",
  'accept=".kmz,.kml,.geojson,.json"',
  "handleExistingInventoryFile(file)",
]) && !existingNetworkAction.includes(".csv"));
check("temporary imported route state is declared", includesAll(workspace, [
  "interface TemporaryImportedRoute",
  "const [temporaryImportedRoute, setTemporaryImportedRoute]",
  "type RouteImportStatus",
]));
check("route parse creates temporary state", includesAll(parseBody, [
  "ImportRepository.parseRouteImport",
  "buildPricedImport(imported)",
  "setTemporaryImportedRoute({",
  "TEMPORARY_IMPORTED_ROUTE",
  "setRouteImportStatus(\"READY\")",
]));
check("route parse does not persist opportunity or customer design", !parseBody.includes("upsertCommercialOpportunity") && !parseBody.includes("upsertCustomerDesignImport") && !parseBody.includes("OpportunityRepository.saveOpportunity"));
check("Save Imported Route persists the staged route", includesAll(saveBody, [
  "upsertCustomerDesignImport(temporaryImportedRoute.importRecord)",
  "upsertCommercialOpportunity(buildCommercialOpportunityRecord(\"SAVED\"",
  "overrideImport: temporaryImportedRoute.importRecord",
  "overrideRoute: temporaryImportedRoute.route",
  "setTemporaryImportedRoute(null)",
]));
check("Discard Imported Route does not persist", includesAll(discardBody, [
  "setTemporaryImportedRoute(null)",
  "setRouteImportStatus(\"IDLE\")",
  "Opportunity Repository was not changed",
]) && !discardBody.includes("upsertCommercialOpportunity") && !discardBody.includes("upsertCustomerDesignImport"));
check("temporary route action card exposes save replace discard", includesAll(workspace, [
  "Temporary Imported Route",
  "Save Imported Route",
  "Replace Imported Route",
  "Discard Imported Route",
]) && includesAll(replaceImportAction, [
  'accept=".kmz,.kml,.geojson,.json,.csv"',
  "handleRouteImportFile(file)",
]));
check("temporary route drives map overlay", includesAll(overlayBlock, [
  "temporaryRouteGeometry",
  "temporaryImportedRoute?.geometry",
  "temporary import",
  "temporaryImportedCommercialDraft",
]));
check("temporary route drives map layer rail", includesAll(mapLayerBlock, [
  "importedDesignActive: Boolean(temporaryImportedRoute?.geometry.length",
  "Temporary Imported Route /",
  "temporaryImportedCommercialDraft?.routeMiles",
]));
check("temporary route drives estimate sidebar", includesAll(workspace, [
  "const activeFinancialDraft = temporaryImportedCommercialDraft ?? selectedImportedCommercialDraft",
  "const activeSourceFileReference = temporaryImportedRoute?.sourceFileName",
  "const unsavedChanges = Boolean(temporaryImportedRoute",
]));
check("saved opportunity reopen restores imported route", includesAll(workspace, [
  "handleOpenCommercialOpportunity",
  "customerDesignImportSnapshot",
  "selectedRouteSnapshot",
  "commercialDraftSnapshot",
]));
check("map refits when temporary overlay path changes", includesAll(mapPanel, [
  "opportunityOverlayRouteKey",
  "commercialOpportunityOverlay?.corridorGeometry",
  "${inventoryRouteKey}:${opportunityOverlayRouteKey}",
]));
check("legacy delayed import drawer is removed", !includesAll(workspace, [
  "Confirm Import",
  "pendingImportDisposition",
]) && !workspace.includes("handleBeginImportOpportunity"));

const failed = checks.filter((item) => !item.condition);

for (const item of checks) {
  const status = item.condition ? "PASS" : "FAIL";
  console.log(`${status} ${item.name}${item.detail ? ` - ${item.detail}` : ""}`);
}

if (failed.length) {
  console.error(`\n${failed.length} CIP-014A validation check(s) failed.`);
  process.exit(1);
}

console.log("\nCIP-014A Import Route authority validation passed.");
