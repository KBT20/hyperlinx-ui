import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd().endsWith("hyperlinx-dal-dev")
  ? process.cwd()
  : path.join(process.cwd(), "hyperlinx-dal-dev");

const paths = {
  workspace: path.join(root, "src", "components", "workspaces", "GoogleRfpWorkspace.tsx"),
  reviewPanel: path.join(root, "src", "components", "workspaces", "googleRfp", "CommercialReviewPanel.tsx"),
  api: path.join(root, "src", "api", "teralinxRuntime.ts"),
  engineeringWorkspace: path.join(root, "src", "workspaces", "EngineeringCertificationWorkspace.tsx"),
  report: path.join(root, "CIP_016A_UI_COMPLETION_REPORT.md"),
};

for (const requiredPath of Object.values(paths)) {
  if (!existsSync(requiredPath)) {
    console.error(`FAIL missing required file: ${path.relative(root, requiredPath)}`);
    process.exit(1);
  }
}

const sources = Object.fromEntries(Object.entries(paths).map(([key, filePath]) => [key, readFileSync(filePath, "utf8")]));
const checks = [];

function check(name, condition) {
  checks.push({ name, condition: Boolean(condition) });
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

const dashboardValidationBlock = blockBetween(sources.workspace, "const commercialDashboardHandoffChecks", "const commercialProposalProgressSteps");
const submitBlock = blockBetween(sources.workspace, "async function handleSubmitCommercialDraftIofToEngineering", "async function handleOpenEngineeringDraftPackage");
const openBlock = blockBetween(sources.workspace, "function handleOpenSubmittedEngineeringCertification", "async function handleAssignActiveDraftIofPackageToMe");
const dashboardBlock = blockBetween(sources.workspace, "Commercial Proposal Dashboard", "Visible Commercial Proposals");
const draftJsonBlock = blockBetween(sources.workspace, "Draft IOF Package JSON", "Commercial-Assembled Draft IOF Package JSON");
const legacyHandoffBlock = blockBetween(sources.workspace, "IOF Package Assembly", "Package Explorer");

check("dashboard validation covers required handoff artifacts", includesAll(dashboardValidationBlock, [
  "Proposal",
  "Estimate",
  "Workbook",
  "Draft IOF Package",
  "Route Repository",
  "commercialDashboardHandoffReady",
  "submittedToEngineering",
]));
check("dashboard submit path validates before submit", includesAll(submitBlock, [
  "commercialDashboardHandoffReady",
  "commercialDashboardHandoffMissing",
  "submitDraftIofPackageToEngineering",
]));
check("submit path verifies Engineering Repository persistence", includesAll(submitBlock, [
  "openEngineeringPackage(result.engineeringPackage.engineeringPackageId",
  "Engineering Repository verification failed after submit",
  "engineeringPackageId: verifiedEngineeringPackage.engineeringPackageId",
  "setCommercialOpportunities",
  "SUBMITTED_TO_ENGINEERING",
]));
check("dashboard shows Engineering Package ID and Engineering Status", includesAll(dashboardBlock, [
  "Engineering Package",
  "Engineering Status",
  "submittedEngineeringPackageId",
  "submittedEngineeringStatus",
]));
check("dashboard button appears only before submission and hides afterward", includesAll(dashboardBlock, [
  "showCommercialDashboardSubmitToEngineering",
  "Submit to Engineering",
  "submittedEngineeringPackageId ?",
  "Open Engineering Certification",
]));
check("open action navigates by Engineering Package ID only", includesAll(openBlock, [
  "setSelectedEngineeringDraftIofPackage(null)",
  "setSelectedEngineeringDraftIofPackageId(submittedEngineeringPackageId)",
  "setSelectedRouteEngineeringActivation(null)",
  "setWorkspace(\"routeEngineering\")",
]));
check("review panel hides submit after handoff and exposes open action", includesAll(sources.reviewPanel, [
  "engineeringPackageId",
  "engineeringStatus",
  "!engineeringPackageId && !locked",
  "Open Engineering Certification",
  "onOpenEngineeringCertification",
]));
check("Draft IOF JSON action switches to open after submission", includesAll(draftJsonBlock, [
  "!submittedToEngineering",
  "Submit to Engineering",
  "Open Engineering Certification",
]));
check("legacy handoff section switches to open after submission", includesAll(legacyHandoffBlock, [
  "!submittedToEngineering",
  "Submit to Engineering",
  "Open Engineering Certification",
]));
check("Engineering workspace still restores selected Engineering Package from repository", includesAll(sources.engineeringWorkspace, [
  "selectedEngineeringDraftIofPackageId",
  "openDraftIofPackageForCertification(preferredPackageId",
  "restored from the Engineering Repository",
]));
check("CIP-016A does not add ScopeVersion/Marketplace/Control/Field/OI behavior", !submitBlock.includes("createScopeVersion") &&
  !dashboardBlock.includes("Marketplace") &&
  !dashboardBlock.includes("Control") &&
  !dashboardBlock.includes("Operational Intelligence"));
check("CIP-016A report documents workflow completion", includesAll(sources.report, [
  "Commercial Proposal Dashboard",
  "Submit to Engineering",
  "Open Engineering Certification",
  "Engineering Package ID",
  "Validation Results",
]));

const failed = checks.filter((item) => !item.condition);

for (const item of checks) {
  console.log(`${item.condition ? "PASS" : "FAIL"} ${item.name}`);
}

if (failed.length) {
  console.error(`\n${failed.length} CIP-016A validation check(s) failed.`);
  process.exit(1);
}

console.log("\nCIP-016A UI completion validation passed.");
