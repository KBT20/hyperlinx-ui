import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd().endsWith("hyperlinx-dal-dev")
  ? process.cwd()
  : path.join(process.cwd(), "hyperlinx-dal-dev");

const workspacePath = path.join(root, "src", "components", "workspaces", "GoogleRfpWorkspace.tsx");
const stylesPath = path.join(root, "src", "styles.css");

for (const requiredPath of [workspacePath, stylesPath]) {
  if (!existsSync(requiredPath)) {
    console.error(`FAIL missing required source file: ${path.relative(root, requiredPath)}`);
    process.exit(1);
  }
}

const workspace = readFileSync(workspacePath, "utf8");
const styles = readFileSync(stylesPath, "utf8");
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

const restoreTypesBlock = blockBetween(workspace, "type OpportunityRestoreStatus", "interface CommercialNetworkRecord");
const validationBlock = blockBetween(workspace, "function validateOpportunityRestoreRecord", "function restoreWarningText");
const openBody = blockBetween(workspace, "async function handleOpenCommercialOpportunity", "function handleOpportunityLibrarySelect");
const loadingUiBlock = blockBetween(workspace, "if (opportunityRestoreState.status === \"RESTORING\")", "return (\n    <section className=\"dal-workspace wide\">");
const reportUiBlock = blockBetween(workspace, "<details className={`commercial-restore-report", "<details className=\"account-workspace-dashboard");

check("restore state model is explicit", includesAll(restoreTypesBlock, [
  "OpportunityRestoreStatus",
  "OpportunityRestoreStepStatus",
  "OpportunityRestoreStepId",
  "OpportunityRestoreState",
  "\"repository\"",
  "\"validation\"",
  "\"restore\"",
  "\"map\"",
  "\"estimate\"",
  "\"workbook\"",
  "\"proposal\"",
  "\"preview\"",
  "\"service-order\"",
  "\"attachments\"",
]));
check("restore validation covers required components", includesAll(validationBlock, [
  "Missing route geometry",
  "Missing estimate snapshot",
  "Missing workbook.json",
  "Missing proposal id",
  "Missing proposal preview payload",
  "Missing service order preview payload",
  "Missing attachments or source file evidence",
]));
check("open opportunity loads repository before restore", openBody.indexOf("OpportunityRepository.openOpportunity<CommercialOpportunityRecord>") >= 0 &&
  openBody.indexOf("OpportunityRepository.openOpportunity<CommercialOpportunityRecord>") < openBody.indexOf("resetCommercialOpportunityWorkingState"));
check("open opportunity validates repository record before map render", openBody.indexOf("validateOpportunityRestoreRecord(record)") >= 0 &&
  openBody.indexOf("validateOpportunityRestoreRecord(record)") < openBody.indexOf("runRestoreStep(\"map\""));
check("restore never falls back to inventory or customer design library", !openBody.includes("handleOpenCustomerDesignFromLibrary") && !openBody.includes("activateSalesDraftWorkingSet") && !openBody.includes("setInventoryRefreshNonce"));
check("restore logs required phases", includesAll(openBody, [
  "Opening Opportunity",
  "Repository loads...",
  "Validate...",
  "Restore...",
  "Loading ${label}...",
  "runRestoreStep(\"map\", \"Map\"",
  "runRestoreStep(\"estimate\", \"Estimate\"",
  "runRestoreStep(\"workbook\", \"Workbook\"",
  "runRestoreStep(\"proposal\", \"Proposal\"",
  "runRestoreStep(\"preview\", \"Proposal Preview\"",
  "runRestoreStep(\"service-order\", \"Service Order Preview\"",
  "Workspace restored with warnings.",
]));
check("component failure becomes warning and continues", includesAll(openBody, [
  "restoreWarningText(label, reason)",
  "Continuing...",
  "markRestoreStep(stepId, \"WARNING\", reason)",
]) && workspace.includes("Continue loading remaining Opportunity?"));
check("repository failure is fatal and does not local-fallback", includesAll(openBody, [
  "Unable to restore Opportunity from Repository",
  "status: \"FAILED\"",
]) && !openBody.includes("handleOpenCustomerDesignFromLibrary") && !openBody.includes("activateSalesDraftWorkingSet"));
check("restore loading state blocks workspace render", includesAll(loadingUiBlock, [
  "Opening {opportunityRestoreState.opportunityName",
  "Opportunity Repository restore is validating before Commercial Planning renders.",
  "commercial-restore-steps",
  "commercial-restore-log",
]));
check("restore report displays warnings and logs after completion", includesAll(reportUiBlock, [
  "Restored with warnings",
  "commercial-restore-warning-list",
  "opportunityRestoreState.warnings.map",
  "opportunityRestoreState.log.map",
]));
check("restore styles exist", includesAll(styles, [
  ".commercial-restore-panel",
  ".commercial-restore-report",
  ".commercial-restore-steps",
  ".commercial-restore-step.warning",
  ".commercial-restore-log",
  ".commercial-restore-warning-list",
]));

const failed = checks.filter((item) => !item.condition);

for (const item of checks) {
  const status = item.condition ? "PASS" : "FAIL";
  console.log(`${status} ${item.name}${item.detail ? ` - ${item.detail}` : ""}`);
}

if (failed.length) {
  console.error(`\n${failed.length} CIP-014B validation check(s) failed.`);
  process.exit(1);
}

console.log("\nCIP-014B repository restore stability validation passed.");
