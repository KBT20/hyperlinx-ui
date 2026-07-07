import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd().endsWith("hyperlinx-dal-dev")
  ? process.cwd()
  : path.join(process.cwd(), "hyperlinx-dal-dev");

const paths = {
  workspace: path.join(root, "src", "components", "workspaces", "GoogleRfpWorkspace.tsx"),
  repositories: path.join(root, "src", "repositories", "commercialRepositories.ts"),
  serverRoutes: path.join(root, "server", "routes", "commercial-routes.js"),
};

for (const requiredPath of Object.values(paths)) {
  if (!existsSync(requiredPath)) {
    console.error(`FAIL missing required source file: ${path.relative(root, requiredPath)}`);
    process.exit(1);
  }
}

const workspace = readFileSync(paths.workspace, "utf8");
const repositories = readFileSync(paths.repositories, "utf8");
const serverRoutes = readFileSync(paths.serverRoutes, "utf8");
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

function appearsBefore(source, first, second) {
  const firstIndex = source.indexOf(first);
  const secondIndex = source.indexOf(second);
  return firstIndex >= 0 && secondIndex >= 0 && firstIndex < secondIndex;
}

const routeTypeBlock = blockBetween(repositories, "export type CommercialRouteRepositoryRecord", "export interface RouteRepository");
const routeBuilderBlock = blockBetween(workspace, "function buildCommercialRouteRepositoryRecord", "function buildCommercialOpportunityRecord");
const generateBlock = blockBetween(workspace, "async function handleGenerateCommercialRoute", "function handleRunAzBuilderScout");
const saveBlock = blockBetween(workspace, "async function upsertCommercialOpportunity", "function promptCommercialOpportunityName");
const verifyBlock = blockBetween(workspace, "async function verifySavedOpportunityTransaction", "function buildCommercialRouteRepositoryRecord");
const openBlock = blockBetween(workspace, "async function handleOpenCommercialOpportunity", "function handleOpportunityLibrarySelect");
const validationBlock = blockBetween(workspace, "function validateOpportunityRestoreRecord", "function restoreWarningText");
const inspectorBlock = blockBetween(workspace, "<b>Route Persistence Inspector</b>", "<details className=\"commercial-workbook-section commercial-runtime-diagnostics\"");

check("Route Repository model carries geometry hash and geometry id", includesAll(routeTypeBlock, [
  "routeGeometryId?: string",
  "geometryHash?: string",
  "commercialGeometry: DALCoordinate[]",
]));
check("server preserves route geometry identity", includesAll(serverRoutes, [
  "const geometryHash",
  "routeGeometryId",
  "geometryHash",
  "repositoryType: \"COMMERCIAL_ROUTE_REPOSITORY\"",
  "noScopeVersionCreation: true",
  "noInventoryMutation: true",
]));
check("route snapshots include hash, geometry id, and generated evidence", includesAll(routeBuilderBlock, [
  "commercialRouteGeometryHash(commercialGeometry)",
  "routeGeometryId(routeRepositoryId, geometryHash)",
  "generatedRouteEvidence(routeRepositoryId, routeId, geometryHash",
  "importedEvidence",
  "immutableImportedEvidence: true",
]));
check("Generate Route logs route metrics", includesAll(generateBlock, [
  "appendRoutePersistenceAudit(\"Generate Route\", \"START\"",
  "vertices: routedGeometry.length",
  "lengthMiles: result.routeMiles",
  "geometryHash: commercialRouteGeometryHash(routedGeometry)",
  "status: result.status === \"ROUTED\" ? \"SUCCESS\" : \"FAIL\"",
]));
check("Generate Route creates and verifies Route Repository before workspace advances", includesAll(generateBlock, [
  "buildCommercialRouteRepositoryRecord",
  "RouteRepository.saveRoute(routeSnapshotToSave, session)",
  "RouteRepository.loadRoute(savedRouteSnapshot.routeRepositoryId, session)",
  "requireRouteSnapshotIntegrity(verifiedRouteSnapshot, \"Route Repository\")",
  "setGeneratedRouteRepositorySnapshot(verifiedRouteSnapshot)",
  "\"Workspace.routeRepositoryId\"",
]) && generateBlock.lastIndexOf("RouteRepository.saveRoute(routeSnapshotToSave, session)") < generateBlock.lastIndexOf("setCommercialRouteResult(result)"));
check("Route Repository failure aborts route progression", includesAll(generateBlock, [
  "ROUTE_REPOSITORY_COMMIT_FAILED",
  "No Opportunity save is allowed until the Route Repository commits and reloads successfully.",
  "Route Repository persistence failed",
]));
check("Save Opportunity preflight requires route id, geometry, estimate, and workbook", includesAll(saveBlock, [
  "validateOpportunityBeforeSave(sharedRecord)",
  "routeRepositoryId",
  "geometryExists",
  "estimateExists",
  "workbookExists",
  "Save Opportunity preflight: missing Route Repository snapshot.",
]));
check("Save sequence persists Route Repository before Opportunity", includesAll(saveBlock, [
  "RouteRepository.saveRoute(routeSnapshot, session)",
  "RouteRepository.loadRoute(routeSnapshot.routeRepositoryId, session)",
  "opportunityRecordForRepository(sharedRecord)",
  "OpportunityRepository.saveOpportunity(opportunityRepositoryRecord, session)",
]) && appearsBefore(saveBlock, "RouteRepository.saveRoute(routeSnapshot, session)", "OpportunityRepository.saveOpportunity(opportunityRepositoryRecord, session)"));
check("Save immediately reloads from repositories and compares geometry hash", includesAll(verifyBlock, [
  "OpportunityRepository.openOpportunity<CommercialOpportunityRecord>",
  "RouteRepository.loadRoute(routeRepositoryId, session)",
  "Saved geometry hash mismatch",
  "Saved Opportunity routeRepositoryId mismatch",
  "Saved Opportunity is missing estimate snapshot after reload",
  "Saved Opportunity is missing workbook snapshot after reload",
]));
check("Save commits local state only after verification", appearsBefore(saveBlock, "verifySavedOpportunityTransaction(saved", "setCommercialOpportunities((prev) => [committedOpportunity"));
check("Save rollback path exists for failed post-save verification", includesAll(saveBlock, [
  "opportunityPersisted",
  "Rollback",
  "OpportunityRepository.saveOpportunity(opportunityRecordForRepository(previousRecord), session)",
  "Opportunity save aborted",
]));
check("Open Opportunity instruments repository restore", includesAll(openBlock, [
  "appendRoutePersistenceAudit(\"Opening Opportunity\", \"START\"",
  "appendRoutePersistenceAudit(\"Loading Route Repository\", \"START\"",
  "RouteRepository.loadRoute(routeRepositoryId, session)",
  "geometryLoaded: \"YES\"",
  "Open Opportunity / ${label}",
  "${label} Restored",
  "updateRoutePersistenceInspector(record, routeSnapshot",
]));
check("Open Opportunity does not regenerate geometry or commercial artifacts", !openBlock.includes("buildCommercialOpportunityRecord") &&
  !openBlock.includes("buildCommercialRouteRepositoryRecord") &&
  !openBlock.includes("routeCommercialCorridorWithOsrm") &&
  !openBlock.includes("buildCommercialCorridorDraft("));
check("restore validation accepts route repository evidence for generated routes", includesAll(validationBlock, [
  "record.importedEvidenceReferences",
  "record.routeRepositorySnapshot?.importedEvidence",
  "Missing attachments or source file evidence.",
]) && openBlock.includes("record.routeRepositorySnapshot?.importedEvidence"));
check("developer inspector displays required repository fields", includesAll(inspectorBlock, [
  "Opportunity ID",
  "Route Repository ID",
  "Route Geometry ID",
  "Geometry Hash",
  "Vertex Count",
  "Length",
  "Estimate ID",
  "Workbook ID",
  "Proposal ID",
  "Attachment IDs",
  "Saved Timestamp",
  "Restored Timestamp",
  "routePersistenceAuditLog",
]));
check("no ScopeVersion creation added", !generateBlock.includes("createScopeVersion") &&
  !saveBlock.includes("createScopeVersion") &&
  !openBlock.includes("createScopeVersion") &&
  !serverRoutes.includes("createScopeVersion"));

const failed = checks.filter((item) => !item.condition);

for (const item of checks) {
  const status = item.condition ? "PASS" : "FAIL";
  console.log(`${status} ${item.name}${item.detail ? ` - ${item.detail}` : ""}`);
}

if (failed.length) {
  console.error(`\n${failed.length} CIP-014D validation check(s) failed.`);
  process.exit(1);
}

console.log("\nCIP-014D route persistence audit validation passed.");
