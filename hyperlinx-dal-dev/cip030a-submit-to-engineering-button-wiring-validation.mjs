import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd().endsWith("hyperlinx-dal-dev")
  ? process.cwd()
  : path.join(process.cwd(), "hyperlinx-dal-dev");

const workspacePath = path.join(root, "src", "components", "workspaces", "GoogleRfpWorkspace.tsx");

if (!existsSync(workspacePath)) {
  console.error(`FAIL missing React client file: ${path.relative(root, workspacePath)}`);
  process.exit(1);
}

const workspace = readFileSync(workspacePath, "utf8");
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

function countOccurrences(source, term) {
  return source.split(term).length - 1;
}

const submitHandler = blockBetween(
  workspace,
  "async function handleSubmitCommercialDraftIofToEngineering()",
  "async function handleOpenEngineeringDraftPackage",
);
const submitButton = blockBetween(
  workspace,
  "data-action-authority=\"submit-to-engineering\"",
  "Submit to Engineering",
);

check("React client renders one Submit to Engineering authority button", countOccurrences(workspace, "data-action-authority=\"submit-to-engineering\"") === 1);
check("Submit button is wired to the existing handoff handler", submitButton.includes("onClick={() => void handleSubmitCommercialDraftIofToEngineering()}"));
check("Submit button remains clickable for readiness diagnostics", submitButton.includes("disabled={proposalRuntimeActionPending || engineeringCertificationPending}") &&
  !submitButton.includes("commercialConstitutionalHandoffReady"));
check("handler first line logs click", submitHandler.trimStart().startsWith("async function handleSubmitCommercialDraftIofToEngineering() {\n    console.log(\"[HANDOFF] Submit button clicked\");"));
check("handler logs missing Draft IOF early return", includesAll(submitHandler, [
  "reason: \"MISSING_DRAFT_IOF_PACKAGE\"",
  "Commercial Review needs a Draft IOF Package before Engineering submission.",
]));
check("handler logs readiness failure early return", includesAll(submitHandler, [
  "reason: \"HANDOFF_READINESS_FAILED\"",
  "missing: commercialDashboardHandoffMissing",
  "Engineering submission blocked:",
]));
check("handler logs already submitted/locked early return", includesAll(submitHandler, [
  "reason: \"COMMERCIAL_ALREADY_LOCKED_OR_SUBMITTED\"",
  "commercialRevisionLocked",
  "already locked for Engineering custody",
]));
check("handler logs before reaching existing API call", includesAll(submitHandler, [
  "[HANDOFF] Draft IOF saved; calling commercial handoff endpoint",
  "/api/commercial/iof-packages/${encodeURIComponent(savedDraft.packageId)}/submit-engineering",
  "method: \"POST\"",
  "submitDraftIofPackageToEngineering(savedDraft.packageId",
]) && appearsBefore(submitHandler, "[HANDOFF] Draft IOF saved; calling commercial handoff endpoint", "submitDraftIofPackageToEngineering(savedDraft.packageId"));
check("handler logs API result and repository verification", includesAll(submitHandler, [
  "[HANDOFF] Commercial handoff API returned",
  "engineeringPackageId: result.engineeringPackage.engineeringPackageId",
  "[HANDOFF] Engineering Package verification returned",
  "openEngineeringPackage(result.engineeringPackage.engineeringPackageId",
]));
check("handler logs caught submission failures", includesAll(submitHandler, [
  "console.error(\"[HANDOFF] Engineering submission failed\"",
  "setProposalRuntimeNotice(`Engineering submission failed:",
]));
check("handler still opens Engineering workspace after verification", includesAll(submitHandler, [
  "setSelectedEngineeringDraftIofPackageId(verifiedEngineeringPackage.engineeringPackageId)",
  "setWorkspace(\"routeEngineering\")",
]));

const failed = checks.filter((item) => !item.condition);

for (const item of checks) {
  const status = item.condition ? "PASS" : "FAIL";
  console.log(`${status} ${item.name}${item.detail ? ` - ${item.detail}` : ""}`);
}

if (failed.length) {
  console.error(`\n${failed.length} CIP-030A React handoff wiring validation check(s) failed.`);
  process.exit(1);
}

console.log("\nCIP-030A Submit to Engineering button wiring validation passed.");
