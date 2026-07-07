import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd().endsWith("hyperlinx-dal-dev")
  ? process.cwd()
  : path.join(process.cwd(), "hyperlinx-dal-dev");

const workspacePath = path.join(root, "src", "components", "workspaces", "GoogleRfpWorkspace.tsx");
const repositoryPath = path.join(root, "src", "repositories", "commercialRepositories.ts");
const stylesPath = path.join(root, "src", "styles.css");
const serverSharedPath = path.join(root, "server", "routes", "_shared.js");
const commercialRoutePath = path.join(root, "server", "routes", "commercial-opportunities.js");

const requiredPaths = [workspacePath, repositoryPath, stylesPath, serverSharedPath, commercialRoutePath];
for (const requiredPath of requiredPaths) {
  if (!existsSync(requiredPath)) {
    console.error(`FAIL missing required source file: ${path.relative(root, requiredPath)}`);
    process.exit(1);
  }
}

const files = {
  workspace: readFileSync(workspacePath, "utf8"),
  repositories: readFileSync(repositoryPath, "utf8"),
  styles: readFileSync(stylesPath, "utf8"),
  shared: readFileSync(serverSharedPath, "utf8"),
  commercialRoute: readFileSync(commercialRoutePath, "utf8"),
};

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

const repositoryNames = [
  "CustomerRepository",
  "CustomerTwinRepository",
  "OpportunityRepository",
  "ProposalRepository",
  "RevisionRepository",
  "TemplateRepository",
  "ImportRepository",
];

const staleImportTerms = [
  "Import KMZ",
  "Upload KMZ",
  "Import GeoJSON",
  "KMZ / KML",
  "Import Customer",
  "Stage Customer",
  "ADD_TO_EXISTING_CUSTOMER_INVENTORY",
];

const directWorkspacePersistenceTerms = [
  "saveCommercialOpportunity",
  "openCommercialOpportunity",
  "listCommercialOpportunities",
  "archiveCommercialOpportunity",
  "saveProposalDraft",
  "listProposalDrafts",
  "listGovernedAccounts",
  "saveGovernedAccount",
  "commitRuntimeTranslation",
  "parseCustomerDesignFile",
  "file.text(",
  "readFileSync",
  "writeFileSync",
];

const existingNetworkAction = files.workspace.match(/<label[^>]*commercial-file-action[\s\S]*?<\/label>/)?.[0] ?? "";
const routeImportAction = files.workspace.match(/<label[^>]*commercial-file-action[^>]*>\s*Import Route\s*<input[\s\S]*?<\/label>/)?.[0] ?? "";
const routeImportActionCount = countMatches(
  files.workspace,
  /<label[^>]*commercial-file-action[^>]*>\s*Import Route\s*<input[\s\S]*?<\/label>/g,
);
const existingNetworkActionCount = countMatches(
  files.workspace,
  /<label[^>]*commercial-file-action[^>]*>\s*Import Existing Network[\s\S]*?<\/label>/g,
);
const temporaryRouteImportCard = files.workspace.match(/Temporary Imported Route[\s\S]*?Discard Imported Route[\s\S]*?<\/button>/)?.[0] ?? "";

check("repository layer file exists", existsSync(repositoryPath));
check("all commercial repository interfaces are declared", repositoryNames.every((name) => files.repositories.includes(`interface ${name}`)));
check("all commercial repository implementations are exported", repositoryNames.every((name) => files.repositories.includes(`export const ${name}`)));
check("workspace imports commercial repositories", repositoryNames.every((name) => files.workspace.includes(name)) && files.workspace.includes("../../repositories/commercialRepositories"));
check("workspace avoids direct commercial persistence APIs", directWorkspacePersistenceTerms.every((term) => !files.workspace.includes(term)));
check("repository owns direct file and JSON import parsing", includesAll(files.repositories, ["input.file.text()", "JSON.parse(jsonText)", "commitRuntimeTranslation", "parseCustomerDesignFile"]));
check("repository wraps customer, opportunity, proposal, revision, template, and import authority", includesAll(files.repositories, [
  "listGovernedAccounts",
  "loadCustomerInventoryForAccount",
  "listCommercialOpportunities",
  "saveCommercialOpportunity",
  "listProposalDrafts",
  "saveProposalDraft",
  "appendRevision",
  "proposalTemplateId",
  "parseRouteImport",
]));

check("customer library persists under governed shared storage", includesAll(files.shared, ["accounts", "contacts", "customerDesignImports"]));
check("opportunity library persists under governed shared storage", files.shared.includes("commercialOpportunities") && files.commercialRoute.includes("/api/commercial/opportunities"));
check("multiple opportunities are scoped to one customer", includesAll(files.workspace, ["accountCommercialOpportunities", "record.accountId === selectedAccount.accountId", "recentCommercialOpportunities", "savedCommercialOpportunities"]));
check("new opportunity creates a unique opportunity id", includesAll(files.workspace, ["handleNewCommercialOpportunity", "OPP-${recordIds.slug}-${Date.now()}", "blank: true"]));
check("save preserves the active opportunity id", includesAll(files.workspace, ["handleSaveCommercialOpportunity", "existing?.opportunityId ??", "overrideName: opportunityNameDraft"]));
check("save as creates a new opportunity id", includesAll(files.workspace, ["handleSaveAsCommercialOpportunity", "duplicate: true", "Save As"]));
check("open restores the saved opportunity record", includesAll(files.workspace, ["handleOpenCommercialOpportunity", "OpportunityRepository.openOpportunity", "commercialDraftSnapshot", "customerDesignImportSnapshot", "selectedRouteSnapshot"]));
check("opportunity restore payload includes map, route, estimate, workbook, previews, assumptions, pricing", includesAll(files.workspace, [
  "routeGeometry",
  "commercialDraftSnapshot",
  "estimate:",
  "commercialWorkbook:",
  "proposalPreview:",
  "serviceOrderPreview:",
  "doctrineAssumptions:",
  "humanOverrides:",
  "pricingSummary",
]));

check("only one visible Import Existing Network action exists", existingNetworkActionCount === 1, `found ${existingNetworkActionCount}`);
check("only one visible Import Route header action exists", routeImportActionCount === 1, `found ${routeImportActionCount}`);
check("duplicate legacy import labels are removed", staleImportTerms.every((term) => !files.workspace.includes(term)));
check("existing network import supports only customer twin formats", includesAll(existingNetworkAction, ["Import Existing Network", 'accept=".kmz,.kml,.geojson,.json"']) && !existingNetworkAction.includes(".csv"));
check("route import supports KMZ, KML, GeoJSON, and CSV through native picker", includesAll(routeImportAction, ["Import Route", 'type="file"', 'accept=".kmz,.kml,.geojson,.json,.csv"', "handleRouteImportFile(file)"]));
check("route import stages a temporary imported route before save", includesAll(temporaryRouteImportCard, ["Temporary Imported Route", "Save Imported Route", "Replace Imported Route", "Discard Imported Route"]));
check("route import cannot write Customer Twin inventory", !temporaryRouteImportCard.includes("Existing Customer Inventory") && !files.workspace.includes("handleExistingInventoryFile(sourceFile)"));
check("customer twin import is customer-level only", includesAll(files.workspace, ["CustomerTwinRepository.importExistingNetwork", "Existing Inventory", "Customer Twin source data"]) && !files.workspace.includes("No proposal or ScopeVersion was created"));

check("proposal preview is a collapsed drawer backed by ProposalRepository records", includesAll(files.workspace, ["const [proposalPreviewOpen, setProposalPreviewOpen] = useState(false)", "ProposalRepository.listProposals", "activeProposalRuntime", "commercial-proposal-preview-shell"]));
check("service order preview is a collapsible commercial workbook section", includesAll(files.workspace, ["service-order-preview", "Service Order Preview", "serviceOrderPreview:", "TemplateRepository.serviceOrderTemplateId()", "Commercial Release 2 placeholder"]));
check("commercial header exposes required fields", includesAll(files.workspace, [
  "<span>Customer</span>",
  "<span>Opportunity Name</span>",
  "<span>Opportunity ID</span>",
  "<span>Product</span>",
  "<span>Commercial Status</span>",
  "<span>Owner</span>",
  "<span>Created</span>",
  "<span>Modified</span>",
  "<span>Estimate Status</span>",
  "<span>Proposal Status</span>",
]));
check("commercial header exposes required actions", includesAll(files.workspace, [
  "New Opportunity",
  "Open Opportunity",
  "Save",
  "Save As",
  "Import Existing Network",
  "Import Route",
  "Preview Proposal",
  "Service Order Preview",
]));

check("estimate sidebar exposes CIP-014 economics", includesAll(files.workspace, [
  "Construction Cost",
  "Cost / Foot",
  "Sell Price / Foot",
  "Gross Margin %",
  "Gross Margin $",
  "Route Length Miles",
  "Route Length Feet",
  "Construction Mix",
  "Confidence",
  "Unknowns",
]));
check("map-first workspace remains the primary layout", includesAll(files.workspace, ["commercial-map-first-workspace", "commercial-orchestrator-map", "commercial-estimate-sidebar"]));
check("commercial workbook remains collapsible", includesAll(files.workspace, ["commercialWorkbookOpenSections", "Commercial Workbook", "TransparentEstimateExplorer"]));
check("single supported product remains point-to-point duct and dark fiber", files.workspace.includes("Point-to-Point Duct & Dark Fiber") && files.workspace.includes("POINT_TO_POINT_LONG_HAUL_PRODUCT_ID"));
check("ScopeVersion creation is not introduced", !/createScopeVersion|saveScopeVersion|\/api\/scopeversions/i.test(files.workspace + files.repositories));
check("map-first and preview styling remains present", includesAll(files.styles, ["commercial-map-first-workspace", "commercial-estimate-sidebar", "commercial-proposal-preview-shell"]));

const failed = checks.filter((item) => !item.condition);

for (const item of checks) {
  const status = item.condition ? "PASS" : "FAIL";
  console.log(`${status} ${item.name}${item.detail ? ` - ${item.detail}` : ""}`);
}

if (failed.length) {
  console.error(`\n${failed.length} CIP-014 validation check(s) failed.`);
  process.exit(1);
}

console.log("\nCIP-014 commercial repository, opportunity library, unified import authority, preview persistence, and recall validation passed.");
