import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd().endsWith("hyperlinx-dal-dev")
  ? process.cwd()
  : path.join(process.cwd(), "hyperlinx-dal-dev");

const paths = {
  workspace: path.join(root, "src", "components", "workspaces", "GoogleRfpWorkspace.tsx"),
  commercialReviewPanel: path.join(root, "src", "components", "workspaces", "googleRfp", "CommercialReviewPanel.tsx"),
  styles: path.join(root, "src", "styles.css"),
  api: path.join(root, "src", "api", "teralinxRuntime.ts"),
  iofRoute: path.join(root, "server", "routes", "commercial-iof-packages.js"),
  baselinesRoute: path.join(root, "server", "routes", "engineering-baselines.js"),
  packagesRoute: path.join(root, "server", "routes", "engineering-packages.js"),
  report: path.join(root, "CIP_029_COMMERCIAL_ENGINEERING_HANDOFF_REPORT.md"),
};

for (const requiredPath of Object.values(paths)) {
  if (!existsSync(requiredPath)) {
    console.error(`FAIL missing required file: ${path.relative(root, requiredPath)}`);
    process.exit(1);
  }
}

const workspace = readFileSync(paths.workspace, "utf8");
const panel = readFileSync(paths.commercialReviewPanel, "utf8");
const styles = readFileSync(paths.styles, "utf8");
const api = readFileSync(paths.api, "utf8");
const iofRoute = readFileSync(paths.iofRoute, "utf8");
const baselinesRoute = readFileSync(paths.baselinesRoute, "utf8");
const packagesRoute = readFileSync(paths.packagesRoute, "utf8");
const report = readFileSync(paths.report, "utf8");
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

function stripBlockComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "");
}

function countOccurrences(source, term) {
  return source.split(term).length - 1;
}

function appearsBefore(source, first, second) {
  const firstIndex = source.indexOf(first);
  const secondIndex = source.indexOf(second);
  return firstIndex >= 0 && secondIndex >= 0 && firstIndex < secondIndex;
}

const activeWorkspace = stripBlockComments(workspace);
const submitHandler = blockBetween(workspace, "async function handleSubmitCommercialDraftIofToEngineering", "async function handleOpenEngineeringDraftPackage");
const handoffCard = blockBetween(workspace, "<section className=\"dal-panel commercial-constitutional-handoff-card\"", "<details className=\"account-workspace-dashboard");
const ribbonBlock = blockBetween(activeWorkspace, "const commercialLifecycleRibbonBaseSteps", "const commercialEstimateRisks");
const proposalDashboardBlock = blockBetween(activeWorkspace, "<h3>{isCustomerParticipant ? \"Customer Proposal Dashboard\" : \"Commercial Proposal Dashboard\"}</h3>", "<details>");
const runtimeDiagnosticsBlock = blockBetween(workspace, "{commercialDeveloperMode ? (\n          <details className=\"commercial-workbook-section commercial-runtime-diagnostics\"", "</details>\n        ) : null}");
const submitServerBlock = blockBetween(iofRoute, "async function submitCommercialDraftPackageToEngineering", "if (normalizedPath.startsWith(\"/api/commercial/iof-packages/\")");

check("canonical handoff card exists", handoffCard.includes("Commercial Engineering Handoff"));
check("exactly one canonical Submit to Engineering action marker exists", countOccurrences(workspace, "data-action-authority=\"submit-to-engineering\"") === 1);
check("exactly one canonical Open Engineering action marker exists", countOccurrences(workspace, "data-action-authority=\"open-engineering-certification\"") === 1);
check("canonical Submit appears only in handoff card marker", handoffCard.includes("data-action-authority=\"submit-to-engineering\""));
check("canonical Open Engineering appears only in handoff card marker", handoffCard.includes("data-action-authority=\"open-engineering-certification\""));
check("handoff readiness validates required commercial artifacts", includesAll(workspace, [
  "commercialDashboardHandoffChecks",
  "Commercial Revision",
  "Commercial Release Package",
  "Proposal",
  "Estimate",
  "Workbook",
  "Draft IOF Package",
  "Route Repository",
  "commercialConstitutionalHandoffReady",
]));
check("submit handler saves Draft IOF before engineering transaction", includesAll(submitHandler, [
  "saveCommercialDraftIofPackage(draftSource, session)",
  "submitDraftIofPackageToEngineering(savedDraft.packageId",
  "openEngineeringPackage(result.engineeringPackage.engineeringPackageId",
]) && appearsBefore(submitHandler, "saveCommercialDraftIofPackage(draftSource, session)", "submitDraftIofPackageToEngineering(savedDraft.packageId"));
check("submit handler opens Engineering workspace after verification", includesAll(submitHandler, [
  "setSelectedEngineeringDraftIofPackageId(verifiedEngineeringPackage.engineeringPackageId)",
  "setWorkspace(\"routeEngineering\")",
]));
check("lifecycle ribbon includes required constitutional stages", includesAll(ribbonBlock, [
  "Opportunity",
  "Commercial Revision",
  "Commercial Release Package",
  "Proposal",
  "Customer Accepted",
  "Engineering",
  "Certified IOF",
  "Service Order",
  "ScopeVersion",
]));
check("lifecycle ribbon CSS exists", includesAll(styles, [
  ".commercial-lifecycle-ribbon",
  ".commercial-lifecycle-step.completed",
  ".commercial-lifecycle-step.current",
  ".commercial-lifecycle-step.next",
  ".commercial-constitutional-handoff-card",
]));
check("Commercial Review panel no longer owns handoff or raw JSON preview actions", !panel.includes("onSubmitToEngineering") &&
  !panel.includes("onOpenEngineeringCertification") &&
  !panel.includes("Preview Package") &&
  !panel.includes("previewOpen"));
check("proposal dashboard no longer contains handoff buttons", !proposalDashboardBlock.includes("handleSubmitCommercialDraftIofToEngineering") &&
  !proposalDashboardBlock.includes("handleOpenSubmittedEngineeringCertification"));
check("developer mode gates diagnostics and manual refresh actions", includesAll(workspace, [
  "const commercialDeveloperMode",
  "commercialDeveloperMode ? (",
  "commercial-runtime-diagnostics",
  "Refresh Proposals",
  "Reload Customer Inventory",
]));
check("runtime diagnostics are developer mode only", runtimeDiagnosticsBlock.includes("Developer Mode"));
check("legacy visible action labels removed from active JSX", !activeWorkspace.includes("Activate Corridor Draft") &&
  !activeWorkspace.includes("Lock Site") &&
  !activeWorkspace.includes(">Save Snapshot<"));
check("map action bar no longer duplicates primary operator actions", !blockBetween(activeWorkspace, "commercial-map-action-bar", "</div>").includes("<button"));
check("API submits through canonical Draft IOF handoff endpoint", includesAll(api, [
  "submitDraftIofPackageToEngineering",
  "/api/commercial/iof-packages/",
  "/submit-engineering",
  "transactionType: \"COMMERCIAL_TO_ENGINEERING_HANDOFF\"",
]));
check("server creates Engineering Baseline and Engineering Package during handoff", includesAll(submitServerBlock, [
  "buildEngineeringBaselineFromDraftPackage",
  "persistEngineeringBaseline",
  "buildEngineeringPackageFromDraftPackage",
  "persistEngineeringPackage",
  "loadEngineeringPackage",
]));
check("server locks Commercial and updates status after handoff", includesAll(submitServerBlock, [
  "commercialRevisionLocked: true",
  "SUBMITTED_TO_ENGINEERING",
  "updateCommercialOpportunitySubmittedToEngineering",
  "updateProposalSubmittedToEngineering",
]));
check("Engineering Baseline repository remains immutable and reference-only", includesAll(baselinesRoute, [
  "immutable: true",
  "referenceOnly: true",
  "noScopeVersionCreation: true",
]));
check("Engineering Package remains reference-only", includesAll(packagesRoute, [
  "referenceOnly: true",
  "scopeVersionState",
  "BLOCKED_UNTIL_SIGNED_SERVICE_ORDER",
]));
check("ScopeVersion creation is absent from commercial handoff handler", !submitHandler.includes("createScopeVersion") &&
  !submitServerBlock.includes("createScopeVersion"));
check("report documents workflow, cleanup, and validation", includesAll(report, [
  "Final Commercial Workflow",
  "Engineering Handoff Sequence",
  "Removed Legacy Actions",
  "Developer Mode Relocations",
  "Remaining Operator Actions",
  "Validation Results",
]));

const failed = checks.filter((item) => !item.condition);

for (const item of checks) {
  const status = item.condition ? "PASS" : "FAIL";
  console.log(`${status} ${item.name}${item.detail ? ` - ${item.detail}` : ""}`);
}

if (failed.length) {
  console.error(`\n${failed.length} CIP-029 handoff validation check(s) failed.`);
  process.exit(1);
}

console.log("\nCIP-029 commercial engineering handoff validation passed.");
