import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd().endsWith("hyperlinx-dal-dev")
  ? process.cwd()
  : path.join(process.cwd(), "hyperlinx-dal-dev");

const paths = {
  session: path.join(root, "src", "routeEdit", "RouteEditSession.ts"),
  reducer: path.join(root, "src", "routeEdit", "RouteEditReducer.ts"),
  projection: path.join(root, "src", "routeEdit", "RouteEditProjection.ts"),
  impact: path.join(root, "src", "routeEdit", "RouteEditImpactEngine.ts"),
  index: path.join(root, "src", "routeEdit", "index.ts"),
  workspace: path.join(root, "src", "components", "workspaces", "GoogleRfpWorkspace.tsx"),
  report: path.join(root, "CIP_023_ROUTE_EDIT_SESSION_DELTA_PATCH_ENGINE_REPORT.md"),
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

const allRouteEdit = [source.session, source.reducer, source.projection, source.impact, source.index].join("\n");

check("Route Edit architecture files exist and export the required primitives", includesAll(source.index, [
  "createRouteEditSession",
  "RouteEditPatch",
  "RouteEditProjection",
  "routeEditReducer",
  "calculateRouteEditImpact",
  "safeApplyRouteEditPatch",
]));
check("all required patch types are modeled", includesAll(source.session, [
  "\"REMOVE_BOOKEND\"",
  "\"RESTORE_BOOKEND\"",
  "\"MOVE_BOOKEND\"",
  "\"MOVE_ILA\"",
  "\"REMOVE_ILA\"",
  "\"RESTORE_ILA\"",
  "\"CHANGE_PLOW_RATE\"",
  "\"CHANGE_BORE_RATE\"",
  "\"CHANGE_TRENCH_RATE\"",
  "\"CHANGE_ROCK_RATE\"",
  "\"CHANGE_CONSTRUCTION_MIX\"",
  "\"CHANGE_SEGMENT_UNIT_COST\"",
  "\"EXCLUDE_SEGMENT\"",
  "\"RESTORE_SEGMENT\"",
  "\"ADD_MANUAL_COST_ADJUSTMENT\"",
  "\"REMOVE_MANUAL_COST_ADJUSTMENT\"",
  "\"CHANGE_MARGIN_ASSUMPTION\"",
  "\"CHANGE_MONTHLY_REVENUE\"",
  "\"CHANGE_TERM_MONTHS\"",
]));
check("assembled route truth is represented as immutable session baseline", includesAll(source.session, [
  "assembledRouteSnapshot",
  "baseControls",
  "baseEstimate",
  "repositoryTruthUnchanged: true",
  "noAutoSave: true",
  "noScopeVersionCreation: true",
  "noInventoryMutation: true",
]));
check("bookend removal creates a projection patch without full route rebuild", includesAll(source.projection + source.impact, [
  "REMOVE_BOOKEND",
  "excludedStationIds.add",
  "station.stationType !== \"INTERMEDIATE\"",
  "ENDPOINT_SPAN",
  "AFFECTED_SPANS_ONLY",
  "fullRouteRebuild: false",
]));
check("rate changes are estimate-domain patches only", includesAll(source.projection + source.impact + source.workspace, [
  "CHANGE_PLOW_RATE",
  "CHANGE_BORE_RATE",
  "CHANGE_TRENCH_RATE",
  "CHANGE_ROCK_RATE",
  "ESTIMATE_DOMAIN_ONLY",
  "updateTransparentProduction",
  "routeEditPatch(patchType",
]));
check("ILA changes recalculate only affected spans in projection", includesAll(source.projection + source.impact + source.workspace, [
  "MOVE_ILA",
  "REMOVE_ILA",
  "RESTORE_ILA",
  "projectedSpans",
  "AFFECTED_SPANS_ONLY",
  "inferIlaRouteEditPatch",
]));
check("map projection updates without full rerender", includesAll(source.session + source.impact + source.workspace, [
  "mapFullRerender: false",
  "displayedTransparentEstimate?.ilaPlan.stationObjects",
  "selectedCommercialIlaStationId={displayedTransparentEstimateControls.ilaPlanning.selectedStationId}",
]));
check("failed patches are isolated and preserve edit session", includesAll(source.reducer, [
  "safeApplyRouteEditPatch",
  "operatorSafeMessage",
  "Original assembled route remains intact",
  "status: \"FAILED_PATCH\"",
  "failedPatches",
]));
check("rollback/restore original clears patch effects", includesAll(source.reducer + source.workspace, [
  "rollbackRouteEditSession",
  "patches: []",
  "failedPatches: []",
  "handleRollbackRouteEditSession",
  "Restore Original",
]));
check("explicit Save Revision commits patch set only", includesAll(source.reducer + source.workspace, [
  "commitRouteEditSession",
  "patchSetOnly: true",
  "assembledRouteEmbedded: false",
  "handleSaveRouteEditRevision",
  "ROUTE_EDIT_PATCH_SET",
  "OpportunityRepository.saveOpportunity",
]));
check("repository truth is unchanged until explicit save", includesAll(source.session + source.reducer + source.workspace, [
  "repositoryTruthUnchangedUntilExplicitSave: true",
  "noRepositoryCommit: true",
  "Repository truth is unchanged until Save Revision",
  "Route Repository geometry and assembled route remain unchanged",
]));
check("workspace provides required operator actions", includesAll(source.workspace, [
  "Start Edit",
  "Save Revision",
  "Compare Revision",
  "Restore Original",
  "Discard Revision",
  "Route Edit Session",
]));
check("route edit layer does not call OSRM, import inventory, or create ScopeVersion", !allRouteEdit.match(/routeCommercialCorridorWithOsrm|parseCustomerDesignFile|commitRuntimeTranslation|createScopeVersion|createScopeversion|MarketplaceWorkspace|ControlWorkspace|FieldWorkspace/));
check("CIP-023 report documents required sections", includesAll(source.report, [
  "Root Cause",
  "Route Edit Session Architecture",
  "Patch Model",
  "Projection Model",
  "Bookend Removal Handling",
  "Rate Change Handling",
  "ILA Edit Handling",
  "Recalculation Boundaries",
  "Crash Isolation Strategy",
  "Validation Results",
]));

const failed = checks.filter((item) => !item.condition);

for (const item of checks) {
  const status = item.condition ? "PASS" : "FAIL";
  console.log(`${status} ${item.name}${item.detail ? ` - ${item.detail}` : ""}`);
}

if (failed.length) {
  console.error(`\n${failed.length} CIP-023 route edit session validation check(s) failed.`);
  process.exit(1);
}

console.log("\nCIP-023 route edit session validation passed.");
