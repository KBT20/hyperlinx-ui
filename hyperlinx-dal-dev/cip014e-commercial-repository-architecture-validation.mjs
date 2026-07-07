import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd().endsWith("hyperlinx-dal-dev")
  ? process.cwd()
  : path.join(process.cwd(), "hyperlinx-dal-dev");

const paths = {
  workspace: path.join(root, "src", "components", "workspaces", "GoogleRfpWorkspace.tsx"),
  repositories: path.join(root, "src", "repositories", "commercialRepositories.ts"),
  accountApi: path.join(root, "src", "api", "accountLibrary.ts"),
  runtimeApi: path.join(root, "src", "api", "runtimeFoundation.ts"),
  teralinxApi: path.join(root, "src", "api", "teralinxRuntime.ts"),
  customerInventory: path.join(root, "src", "customerInventory", "CustomerNetworkInventory.ts"),
  serverShared: path.join(root, "server", "routes", "_shared.js"),
  serverAccounts: path.join(root, "server", "routes", "accounts.js"),
  serverOpportunities: path.join(root, "server", "routes", "commercial-opportunities.js"),
  serverRoutes: path.join(root, "server", "routes", "commercial-routes.js"),
  serverProposals: path.join(root, "server", "routes", "proposal-drafts.js"),
  report: path.join(root, "COMMERCIAL_REPOSITORY_ARCHITECTURE.md"),
};

for (const requiredPath of Object.values(paths)) {
  if (!existsSync(requiredPath)) {
    console.error(`FAIL missing required file: ${path.relative(root, requiredPath)}`);
    process.exit(1);
  }
}

const workspace = readFileSync(paths.workspace, "utf8");
const repositories = readFileSync(paths.repositories, "utf8");
const accountApi = readFileSync(paths.accountApi, "utf8");
const runtimeApi = readFileSync(paths.runtimeApi, "utf8");
const teralinxApi = readFileSync(paths.teralinxApi, "utf8");
const customerInventory = readFileSync(paths.customerInventory, "utf8");
const serverShared = readFileSync(paths.serverShared, "utf8");
const serverAccounts = readFileSync(paths.serverAccounts, "utf8");
const serverOpportunities = readFileSync(paths.serverOpportunities, "utf8");
const serverRoutes = readFileSync(paths.serverRoutes, "utf8");
const serverProposals = readFileSync(paths.serverProposals, "utf8");
const report = readFileSync(paths.report, "utf8");
const dataRoot = path.join(root, "server", "data");
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

function jsonRecords(dirName) {
  const dir = path.join(dataRoot, dirName);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => {
      try {
        return { file, record: JSON.parse(readFileSync(path.join(dir, file), "utf8")) };
      } catch {
        return { file, record: null };
      }
    });
}

const saveBlock = blockBetween(workspace, "async function upsertCommercialOpportunity", "function promptCommercialOpportunityName");
const openBlock = blockBetween(workspace, "async function handleOpenCommercialOpportunity", "function handleOpportunityLibrarySelect");
const serializerBlock = blockBetween(workspace, "function opportunityRecordForRepository", "function newestRouteForOpportunity");
const browserBlock = blockBetween(workspace, "const commercialRepositoryBrowserSections", "function isCommercialWorkbookSectionOpen");
const diagnosticsBlock = blockBetween(workspace, "<b>Repository Browser</b>", "</details>\n      </section>");
const validationBlock = blockBetween(workspace, "function validateOpportunityRestoreRecord", "function restoreWarningText");

const requiredDataDirs = [
  "accounts",
  "contacts",
  "runtime-inventories",
  "runtime-objects",
  "commercial-opportunities",
  "commercial-routes",
  "proposal-drafts",
];

for (const dir of requiredDataDirs) {
  check(`physical storage exists: server/data/${dir}`, existsSync(path.join(dataRoot, dir)));
}

check("shared server storage is JSON filesystem", includesAll(serverShared, [
  "DATA_ROOT",
  "recordPath",
  "JSON.stringify(record, null, 2)",
  "readFile(recordPath",
  "writeFile(recordPath",
]));
check("Customer Repository endpoints and storage are present", includesAll(accountApi + serverAccounts, [
  "/api/accounts",
  "/api/accounts/contacts",
  "DIRS.accounts",
  "DIRS.contacts",
  "persistRecord(DIRS.accounts",
  "persistRecord(DIRS.contacts",
]));
check("Customer Twin Repository reads runtime inventory repositories", includesAll(runtimeApi + customerInventory, [
  "/api/runtime/inventories",
  "/api/runtime/objects",
  "listRuntimeInventories()",
  "listRuntimeObjects()",
  "buildCustomerNetworkGraph",
]));
check("Opportunity Repository endpoints and storage are present", includesAll(teralinxApi + serverOpportunities, [
  "/api/commercial/opportunities",
  "openCommercialOpportunity",
  "DIRS.commercialOpportunities",
  "persistRecord(DIRS.commercialOpportunities",
]));
check("Route Repository endpoints and storage are present", includesAll(teralinxApi + serverRoutes, [
  "/api/commercial/routes",
  "listCommercialRoutes",
  "loadCommercialRoute",
  "saveCommercialRoute",
  "DIRS.commercialRoutes",
  "basePath: \"/api/commercial/routes\"",
]));
check("Proposal Repository endpoints and storage are present", includesAll(teralinxApi + serverProposals, [
  "/api/proposals",
  "listProposalDrafts",
  "saveProposalDraft",
  "DIRS.proposalDrafts",
  "persistRecord(DIRS.proposalDrafts",
]));
check("Revision Repository is embedded append-only Opportunity history", includesAll(repositories + browserBlock, [
  "export const RevisionRepository",
  "revisionHistory: [...(record.revisionHistory ?? []), revision]",
  "server/data/commercial-opportunities/*.json#/revisionHistory",
]));
check("commercial repositories do not use browser storage", !repositories.includes("localStorage") &&
  !repositories.includes("sessionStorage") &&
  !workspace.includes("localStorage") &&
  !workspace.includes("sessionStorage"));
check("Opportunity save strips route-owned data before repository write", includesAll(serializerBlock, [
  "routeRepositorySnapshot: _routeRepositorySnapshot",
  "routeGeometry: _routeGeometry",
  "commercialDraftSnapshot: _commercialDraftSnapshot",
  "selectedRouteSnapshot: _selectedRouteSnapshot",
  "customerDesignImportSnapshot: _customerDesignImportSnapshot",
  "routeGeometryOwnedBy: routeRepositoryId ? \"COMMERCIAL_ROUTE_REPOSITORY\" : \"NONE\"",
  "noEmbeddedRouteGeometry: true",
]) && saveBlock.includes("OpportunityRepository.saveOpportunity(opportunityRepositoryRecord, session)"));
check("Route Repository relationship repair reads repository records by opportunityId", includesAll(openBlock, [
  "RouteRepository.listRoutes(session)",
  "newestRouteForOpportunity(repositoryRoutes, record.opportunityId)",
  "hydrateOpportunityFromRouteRepository(record, routeSnapshot)",
  "opportunityRecordForRepository(record)",
  "OpportunityRepository.saveOpportunity(repairedRecord, session)",
  "Route Repository relationship repair",
]));
check("Open restore still avoids route regeneration and runtime fallback", !openBlock.includes("routeCommercialCorridorWithOsrm") &&
  !openBlock.includes("buildCommercialCorridorDraft(") &&
  !openBlock.includes("buildCommercialOpportunityRecord") &&
  !openBlock.includes("activateSalesDraftWorkingSet"));
check("Route Repository owns geometry hash and generated route evidence", includesAll(serverRoutes, [
  "hashCommercialGeometry",
  "GENERATED_ROUTE_AUDIT",
  "importedEvidence",
  "geometryHash",
  "routeGeometryId",
]));
check("restore validation accepts Route Repository evidence", includesAll(validationBlock, [
  "record.importedEvidenceReferences",
  "record.routeRepositorySnapshot?.importedEvidence",
  "Missing attachments or source file evidence.",
]));
check("developer Repository Browser covers every commercial repository", includesAll(browserBlock + diagnosticsBlock, [
  "Customer Repository",
  "Customer Twin Repository",
  "Opportunity Repository",
  "Route Repository",
  "Proposal Repository",
  "Revision Repository",
  "Physical Storage",
  "Repository API",
  "Stored JSON",
]));
check("architecture report documents storage, flows, root causes, and repair", includesAll(report, [
  "Physical Storage",
  "Repository Hierarchy",
  "Save Sequence",
  "Restore Sequence",
  "API Endpoints",
  "Actual Persisted Record Schemas",
  "Root Cause Analysis",
  "Repaired Architecture",
]));

const opportunities = jsonRecords("commercial-opportunities").filter((item) => item.record);
const routes = jsonRecords("commercial-routes").filter((item) => item.record);
const routesWithGeometry = routes.filter(({ record }) => Array.isArray(record.commercialGeometry) && record.commercialGeometry.length > 1);
const linkedRouteCount = routesWithGeometry.filter(({ record }) => opportunities.some((item) => item.record.opportunityId === record.opportunityId)).length;
const staleOpportunityRelationshipCount = opportunities.filter(({ record }) => (
  !record.routeRepositoryId &&
  !record.routeRepositoryRef?.routeRepositoryId &&
  routesWithGeometry.some((route) => route.record.opportunityId === record.opportunityId)
)).length;

check("actual disk has Commercial Opportunity JSON records", opportunities.length > 0, `count=${opportunities.length}`);
check("actual disk has Route Repository JSON records with geometry", routesWithGeometry.length > 0, `count=${routesWithGeometry.length}`);
check("actual disk route records relate to Opportunity ids", linkedRouteCount > 0, `linked=${linkedRouteCount}`);
check("stale missing route references are repairable from Route Repository", staleOpportunityRelationshipCount === 0 || openBlock.includes("newestRouteForOpportunity(repositoryRoutes, record.opportunityId)"), `stale=${staleOpportunityRelationshipCount}`);

const failed = checks.filter((item) => !item.condition);

for (const item of checks) {
  const status = item.condition ? "PASS" : "FAIL";
  console.log(`${status} ${item.name}${item.detail ? ` - ${item.detail}` : ""}`);
}

console.log(`\nRepository disk audit: opportunities=${opportunities.length}, routesWithGeometry=${routesWithGeometry.length}, staleRepairableRouteReferences=${staleOpportunityRelationshipCount}.`);

if (failed.length) {
  console.error(`\n${failed.length} CIP-014E repository architecture validation check(s) failed.`);
  process.exit(1);
}

console.log("\nCIP-014E commercial repository architecture validation passed.");
