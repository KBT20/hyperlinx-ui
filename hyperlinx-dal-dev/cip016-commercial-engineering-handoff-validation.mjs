import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd().endsWith("hyperlinx-dal-dev")
  ? process.cwd()
  : path.join(process.cwd(), "hyperlinx-dal-dev");

const paths = {
  shared: path.join(root, "server", "routes", "_shared.js"),
  index: path.join(root, "server", "index.js"),
  engineeringPackages: path.join(root, "server", "routes", "engineering-packages.js"),
  commercialIofPackages: path.join(root, "server", "routes", "commercial-iof-packages.js"),
  engineeringCertification: path.join(root, "server", "routes", "engineering-certification.js"),
  api: path.join(root, "src", "api", "teralinxRuntime.ts"),
  repositories: path.join(root, "src", "repositories", "commercialRepositories.ts"),
  commercialWorkspace: path.join(root, "src", "components", "workspaces", "GoogleRfpWorkspace.tsx"),
  engineeringWorkspace: path.join(root, "src", "workspaces", "EngineeringCertificationWorkspace.tsx"),
  report: path.join(root, "CIP_016_COMMERCIAL_ENGINEERING_HANDOFF_REPORT.md"),
};

for (const requiredPath of Object.values(paths)) {
  if (!existsSync(requiredPath)) {
    console.error(`FAIL missing required file: ${path.relative(root, requiredPath)}`);
    process.exit(1);
  }
}

const sources = Object.fromEntries(Object.entries(paths).map(([key, filePath]) => [key, readFileSync(filePath, "utf8")]));
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

const engineeringPackageModelBlock = blockBetween(sources.engineeringPackages, "export function buildEngineeringPackageFromDraftPackage", "export function normalizeEngineeringPackage");
const engineeringPackageResolveBlock = blockBetween(sources.engineeringPackages, "export async function resolveEngineeringPackageReferences", "export async function persistEngineeringPackage");
const engineeringPackagePersistBlock = blockBetween(sources.engineeringPackages, "export async function persistEngineeringPackage", "export async function updateEngineeringPackageStatus");
const commercialSubmitBlock = blockBetween(sources.commercialIofPackages, "async function submitCommercialDraftPackageToEngineering", "export async function handleCommercialIofPackages");
const commercialUiSubmitBlock = blockBetween(sources.commercialWorkspace, "async function handleSubmitCommercialDraftIofToEngineering", "async function handleOpenEngineeringDraftPackage");
const engineeringQueueBlock = blockBetween(sources.engineeringCertification, "export async function listReviewQueue", "function unitsFromProposal");
const engineeringOpenBlock = blockBetween(sources.engineeringCertification, "async function openDraftPackageForEngineering", "function packageQueueItem");
const engineeringCertifyBlock = blockBetween(sources.engineeringCertification, "async function handleCertifyPackage", "async function handleOpenCertifiedPackage");
const engineeringLandingBlock = blockBetween(sources.engineeringWorkspace, "<section className=\"dal-panel engineering-certification-package-header\">", "<div className=\"dal-panel engineering-certification-package-header\">");
const engineeringBrowserBlock = blockBetween(sources.engineeringWorkspace, "Engineering Package Browser", "const renderDraft = activeDraft");

check("Engineering Repository has physical JSON storage directory", sources.shared.includes("engineeringPackages: path.join(DATA_ROOT, \"engineering-packages\")"));
check("Express runtime exposes Engineering Package API", includesAll(sources.index, [
  "import { handleEngineeringPackages }",
  "handleEngineeringPackages",
  "engineeringPackages: true",
]));
check("Engineering Package API is reference-only and has canonical required fields", includesAll(engineeringPackageModelBlock, [
  "engineeringPackageId",
  "EngineeringPackageId",
  "opportunityId",
  "customerTwinId",
  "commercialProposalId",
  "commercialWorkbookId",
  "draftIofPackageId",
  "routeRepositoryId",
  "estimateId",
  "productDoctrineId",
  "submittedBy",
  "submittedDate",
  "status",
  "ENGINEERING_PENDING",
  "referenceOnly: true",
  "noDuplicatedCommercialData: true",
  "immutableCommercialReferences: true",
  "noScopeVersionCreation: true",
]));
check("Engineering Package validation resolves every commercial reference without regeneration", includesAll(engineeringPackageResolveBlock, [
  "loadRecord(DIRS.commercialOpportunities",
  "loadRecord(DIRS.iofPackages",
  "loadRecord(DIRS.commercialRoutes",
  "loadRecord(DIRS.proposalDrafts",
  "commercialWorkbook",
  "commercialEstimate",
  "noRegeneration: true",
  "noScopeVersionCreation: true",
]));
check("Engineering Package persistence rejects broken references", includesAll(engineeringPackagePersistBlock, [
  "resolveEngineeringPackageReferences",
  "Engineering Package reference validation failed",
  "referenceHash",
  "persistRecord(DIRS.engineeringPackages",
]));
check("Commercial submission creates Engineering Package and rolls back failed handoff", includesAll(commercialSubmitBlock, [
  "buildEngineeringPackageFromDraftPackage",
  "persistEngineeringPackage",
  "updateCommercialOpportunitySubmittedToEngineering",
  "SUBMITTED_TO_ENGINEERING",
  "commercialOpportunity",
  "previousDraftPackage",
  "deleteRecord(DIRS.iofPackages",
]));
check("Commercial UI submit stays in Commercial and reports Engineering Package ID", includesAll(commercialUiSubmitBlock, [
  "result.engineeringPackage.engineeringPackageId",
  "setCommercialOpportunities",
  "refreshEngineeringReviewQueue",
  "SUBMITTED_TO_ENGINEERING",
]) && !commercialUiSubmitBlock.includes("activateEngineeringCertificationFromDraftPackage"));
check("Commercial Planning no longer exposes direct Engineering action buttons", !includesAll(sources.commercialWorkspace, [
  "Handoff to Engineering",
  "Use Commercial Draft IOF",
  "Certify Draft IOF Package",
]));
check("Engineering Certification queue loads Engineering Repository packages only", includesAll(engineeringQueueBlock, [
  "listEngineeringPackages({ openOnly: true })",
  "loadDraftPackage(engineeringPackage.draftIofPackageId)",
  "packageQueueItem(draft, engineeringPackage)",
]) && !engineeringQueueBlock.includes("listRecords(DIRS.iofPackages)"));
check("Engineering open resolves by Engineering Package and starts station planning", includesAll(engineeringOpenBlock, [
  "resolveEngineeringPackageForCertification",
  "updateEngineeringPackageStatus",
  "STATION_PLANNING",
  "decorateDraftPackageWithEngineeringPackage",
  "noRegeneration",
]));
check("Engineering certification updates Engineering Package and stops before ScopeVersion", includesAll(engineeringCertifyBlock, [
  "updateEngineeringPackageStatus",
  "ENGINEERING_CERTIFIED",
  "SERVICE_ORDER_READY",
  "BLOCKED_UNTIL_SIGNED_SERVICE_ORDER",
  "noScopeVersionCreation",
]) && !engineeringCertifyBlock.includes("createScopeVersionFromCertifiedPackage"));
check("Client API exposes EngineeringRepository package methods", includesAll(sources.api, [
  "export type EngineeringPackageRuntime",
  "listEngineeringPackages",
  "openEngineeringPackage",
  "saveEngineeringPackage",
  "engineeringPackage: EngineeringPackageRuntime",
]));
check("Repository layer exposes EngineeringRepository", includesAll(sources.repositories, [
  "export interface EngineeringRepository",
  "export const EngineeringRepository",
  "listPackages: listEngineeringPackages",
  "openPackage: openEngineeringPackage",
  "savePackage: saveEngineeringPackage",
]));
check("Engineering workspace has package browser and package-first restore state", includesAll(sources.engineeringWorkspace, [
  "activeEngineeringPackage",
  "engineeringPackageForDraft",
  "Engineering Package Browser",
  "queueEngineeringPackageId",
  "Begin Station Planning",
]));
check("Engineering landing screen shows required handoff fields", includesAll(engineeringLandingBlock, [
  "Engineering Package",
  "Customer",
  "Opportunity",
  "Draft IOF Package",
  "Commercial Status",
  "Submitted Date",
  "Engineering Status",
  "Route Length",
  "Estimated Cost",
  "Revenue",
  "Margin",
  "Engineering Confidence",
  "Station Planning",
  "Service Order",
  "ScopeVersion",
]));
check("Engineering browser action opens Engineering Package IDs", includesAll(engineeringBrowserBlock, [
  "queueEngineeringPackageId(item)",
  "Begin Station Planning",
  "openPackage(engineeringPackageId)",
]));
check("CIP-016 implementation does not add ScopeVersion creation to new handoff paths", !sources.engineeringPackages.includes("createScopeVersion") &&
  !commercialSubmitBlock.includes("createScopeVersion") &&
  !engineeringOpenBlock.includes("createScopeVersion"));
check("CIP-016 report documents architecture, flows, validation, and no ScopeVersion", includesAll(sources.report, [
  "Engineering Repository",
  "Submit to Engineering",
  "Reference Integrity",
  "Commercial Status",
  "Engineering Restore",
  "No ScopeVersion",
  "Validation Results",
]));

const failed = checks.filter((item) => !item.condition);

for (const item of checks) {
  const status = item.condition ? "PASS" : "FAIL";
  console.log(`${status} ${item.name}${item.detail ? ` - ${item.detail}` : ""}`);
}

if (failed.length) {
  console.error(`\n${failed.length} CIP-016 validation check(s) failed.`);
  process.exit(1);
}

console.log("\nCIP-016 Commercial to Engineering repository handoff validation passed.");
