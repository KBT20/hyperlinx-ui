import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd().endsWith("hyperlinx-dal-dev")
  ? process.cwd()
  : path.join(process.cwd(), "hyperlinx-dal-dev");

const paths = {
  workspace: path.join(root, "src", "components", "workspaces", "GoogleRfpWorkspace.tsx"),
  repositories: path.join(root, "src", "repositories", "commercialRepositories.ts"),
  api: path.join(root, "src", "api", "teralinxRuntime.ts"),
  serverIndex: path.join(root, "server", "index.js"),
  serverShared: path.join(root, "server", "routes", "_shared.js"),
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
const api = readFileSync(paths.api, "utf8");
const serverIndex = readFileSync(paths.serverIndex, "utf8");
const serverShared = readFileSync(paths.serverShared, "utf8");
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

const routeTypeBlock = blockBetween(repositories, "export type CommercialRouteEvidence", "export interface CustomerRepository");
const apiRouteBlock = blockBetween(api, "export async function listCommercialRoutes", "export async function cloneCommercialOpportunity");
const restoreTypesBlock = blockBetween(workspace, "type OpportunityRestoreStatus", "interface CommercialNetworkRecord");
const validationBlock = blockBetween(workspace, "function validateOpportunityRestoreRecord", "function restoreWarningText");
const buildRouteBlock = blockBetween(workspace, "function buildCommercialRouteRepositoryRecord", "function buildCommercialOpportunityRecord");
const buildOpportunityBlock = blockBetween(workspace, "function buildCommercialOpportunityRecord", "function upsertCommercialOpportunity");
const saveBlock = blockBetween(workspace, "function upsertCommercialOpportunity", "function promptCommercialOpportunityName");
const openBlock = blockBetween(workspace, "async function handleOpenCommercialOpportunity", "function handleOpportunityLibrarySelect");
const previewRowsBlock = blockBetween(workspace, "const restoredProposalPreview", "const closedProposalRecords");
const proposalPreviewUiBlock = blockBetween(workspace, "aria-label=\"Proposal Preview\"", "<section className=\"commercial-workbook-shell\"");
const serviceOrderPreviewUiBlock = blockBetween(workspace, "<summary><b>13. Service Order Preview", "<details className=\"commercial-workbook-section commercial-runtime-diagnostics\"");
const workbookStateBlock = blockBetween(workspace, "const [commercialWorkbookOpenSections", "const activeProposalRuntime");

check("server declares Commercial Route Repository storage", serverShared.includes("commercialRoutes: path.join(DATA_ROOT, \"commercial-routes\")"));
check("server registers Commercial Route Repository endpoint after Opportunities", includesAll(serverIndex, [
  "import { handleCommercialRoutes } from \"./routes/commercial-routes.js\";",
  "handleCommercialOpportunities",
  "handleCommercialRoutes",
]) && appearsBefore(serverIndex, "handleCommercialOpportunities", "handleCommercialRoutes"));
check("Commercial Route Repository route persists normalized route snapshots", includesAll(serverRoutes, [
  "routeMatch(pathname, \"/api/commercial/routes\")",
  "idKey: \"routeRepositoryId\"",
  "listKey: \"commercialRoutes\"",
  "itemKey: \"commercialRoute\"",
  "repositoryType: \"COMMERCIAL_ROUTE_REPOSITORY\"",
  "commercialGeometry",
  "convertedRuntimeGeometry",
  "simplifiedGeometry",
  "renderedGeometryCache",
  "immutableImportedEvidence: true",
  "noScopeVersionCreation: true",
  "noInventoryMutation: true",
]));
check("API client exposes list/load/save Commercial Route calls", includesAll(apiRouteBlock, [
  "listCommercialRoutes",
  "loadCommercialRoute",
  "saveCommercialRoute",
  "\"/api/commercial/routes\"",
  "encodeURIComponent(routeRepositoryId)",
  "JSON.stringify({ commercialRoute: record })",
  "authHeaders(session",
]));
check("repository layer models route authority and immutable evidence", includesAll(routeTypeBlock, [
  "CommercialRouteEvidence",
  "CommercialRouteRepositoryRecord",
  "RouteRepository",
  "DALCoordinate",
  "CommercialCorridorDraft",
  "importedEvidence: CommercialRouteEvidence[]",
  "immutableImportedEvidence: true",
  "commercialGeometry: DALCoordinate[]",
  "convertedRuntimeGeometry: DALCoordinate[]",
  "simplifiedGeometry: DALCoordinate[]",
  "renderedGeometryCache: DALCoordinate[]",
  "commercialDraftSnapshot?: CommercialCorridorDraft",
  "routeSource: \"IMPORTED_EVIDENCE\" | \"COMMERCIAL_DRAFT\" | \"MANUAL\" | \"NONE\"",
  "noScopeVersionCreation: true",
  "noInventoryMutation: true",
]) && repositories.includes("export const RouteRepository: RouteRepository"));
check("workspace restore model includes Route Repository step", includesAll(restoreTypesBlock, [
  "\"route-repository\"",
]) && workspace.includes("{ id: \"route-repository\", label: \"Route Repository\" }"));
check("workspace builds route repository snapshot from working geometry and evidence", includesAll(buildRouteBlock, [
  "routeRepositoryIdForOpportunity",
  "commercialGeometry",
  "importedEvidence",
  "immutableImportedEvidence: true",
  "convertedRuntimeGeometry: commercialGeometry",
  "simplifiedGeometry: simplifyRouteGeometry(commercialGeometry)",
  "renderedGeometryCache: commercialGeometry",
  "boundingBox: geometryBoundingBox(commercialGeometry)",
  "aLocation",
  "zLocation",
  "commercialDraftSnapshot",
  "selectedRouteSnapshot",
  "sourceImportSnapshot",
  "authority: \"COMMERCIAL_ROUTE_REPOSITORY\"",
  "noScopeVersionCreation: true",
  "noInventoryMutation: true",
]));
check("Opportunity snapshot captures complete Commercial persistence payload", includesAll(buildOpportunityBlock, [
  "productDoctrineVersion",
  "doctrineVersion",
  "customerSnapshot",
  "customerTwinReference",
  "routeRepositoryRef",
  "routeRepositorySnapshot",
  "attachmentMetadata",
  "estimateSnapshot",
  "workbookSnapshot",
  "proposalPreviewSnapshot",
  "serviceOrderPreviewSnapshot",
  "commercialOverrides",
  "constructionMixSnapshot",
  "riskSnapshot",
  "importedEvidenceReferences",
  "restoreSnapshotVersion: \"CIP-014C\"",
  "commercialSnapshot",
]));
check("Save persists Route Repository before Opportunity Repository", includesAll(saveBlock, [
  "RouteRepository.saveRoute(routeSnapshot, session)",
  "opportunityRecordForRepository(sharedRecord)",
  "OpportunityRepository.saveOpportunity(opportunityRepositoryRecord, session)",
  "routeRepositoryRef",
  "routeGeometry = routeSnapshot.commercialGeometry",
  "commercialDraftSnapshot = routeSnapshot.commercialDraftSnapshot",
  "importedEvidenceReferences = routeSnapshot.importedEvidence",
]) && appearsBefore(saveBlock, "RouteRepository.saveRoute(routeSnapshot, session)", "OpportunityRepository.saveOpportunity(opportunityRepositoryRecord, session)"));
check("Open loads Route Repository before restore validation", includesAll(openBlock, [
  "OpportunityRepository.openOpportunity<CommercialOpportunityRecord>",
  "RouteRepository.loadRoute(routeRepositoryId, session)",
  "hydrateOpportunityFromRouteRepository(record, routeSnapshot)",
  "Missing Route Repository reference",
  "using embedded route repository snapshot",
  "validateOpportunityRestoreRecord(record)",
]) && appearsBefore(openBlock, "RouteRepository.loadRoute(routeRepositoryId, session)", "validateOpportunityRestoreRecord(record)"));
check("Open restore does not regenerate commercial artifacts", !openBlock.includes("buildCommercialOpportunityRecord") &&
  !openBlock.includes("buildCommercialRouteRepositoryRecord") &&
  !openBlock.includes("proposalPreviewSnapshot") &&
  !openBlock.includes("serviceOrderPreviewSnapshot"));
check("restore validation treats missing components as warnings", includesAll(validationBlock, [
  "record.routeRepositorySnapshot?.commercialGeometry",
  "record.routeRepositorySnapshot?.selectedRouteSnapshot",
  "Missing route geometry in Opportunity Repository record.",
  "Missing estimate snapshot or restorable commercial draft.",
  "Missing workbook.json.",
  "Missing proposal id.",
  "Missing proposal preview payload.",
  "Missing service order preview payload.",
  "Missing attachments or source file evidence.",
]));
check("Proposal and Service Order previews render saved snapshots only", includesAll(previewRowsBlock, [
  "activeCommercialOpportunity?.proposalPreview ?? null",
  "activeCommercialOpportunity?.serviceOrderPreview ?? null",
  "snapshotRows(restoredProposalPreview)",
  "snapshotRows(restoredServiceOrderPreview)",
]));
check("missing previews show non-fatal generate actions", includesAll(proposalPreviewUiBlock, [
  "Proposal Preview not generated",
  "Generate Preview",
]) && includesAll(serviceOrderPreviewUiBlock, [
  "Service Order Preview not generated",
  "Generate Preview",
  "Commercial Release 2 placeholders",
  "No ScopeVersion is created here",
]));
check("runtime diagnostics remain collapsed by default", workbookStateBlock.includes("new Set([\"proposal-summary\"])") && !workbookStateBlock.includes("runtime-diagnostics"));
check("new persistence path does not create ScopeVersion", !serverRoutes.includes("createScopeVersion") &&
  !serverRoutes.includes("saveScopeVersion") &&
  !buildRouteBlock.includes("createScopeVersion") &&
  !saveBlock.includes("createScopeVersion") &&
  !openBlock.includes("createScopeVersion"));

const failed = checks.filter((item) => !item.condition);

for (const item of checks) {
  const status = item.condition ? "PASS" : "FAIL";
  console.log(`${status} ${item.name}${item.detail ? ` - ${item.detail}` : ""}`);
}

if (failed.length) {
  console.error(`\n${failed.length} CIP-014C validation check(s) failed.`);
  process.exit(1);
}

console.log("\nCIP-014C complete Opportunity persistence validation passed.");
