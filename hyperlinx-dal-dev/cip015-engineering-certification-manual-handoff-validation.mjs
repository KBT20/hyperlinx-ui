import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd().endsWith("hyperlinx-dal-dev")
  ? process.cwd()
  : path.join(process.cwd(), "hyperlinx-dal-dev");

const paths = {
  workspace: path.join(root, "src", "workspaces", "EngineeringCertificationWorkspace.tsx"),
  api: path.join(root, "src", "api", "teralinxRuntime.ts"),
  server: path.join(root, "server", "routes", "engineering-certification.js"),
  styles: path.join(root, "src", "styles.css"),
  report: path.join(root, "CIP_015_ENGINEERING_CERTIFICATION_MANUAL_HANDOFF_REPORT.md"),
};

for (const requiredPath of Object.values(paths)) {
  if (!existsSync(requiredPath)) {
    console.error(`FAIL missing required file: ${path.relative(root, requiredPath)}`);
    process.exit(1);
  }
}

const workspace = readFileSync(paths.workspace, "utf8");
const api = readFileSync(paths.api, "utf8");
const server = readFileSync(paths.server, "utf8");
const styles = readFileSync(paths.styles, "utf8");
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

const certifyClientBlock = blockBetween(workspace, "async function certifyPackage", "async function requestCommercialRevision");
const certifyServerBlock = blockBetween(server, "async function handleCertifyPackage", "async function handleGenerateScopeVersion");
const generateScopeVersionBlock = blockBetween(server, "async function handleGenerateScopeVersion", "async function handleCertifiedList");

check("workspace loads Draft IOF queue and Certified IOF restore repository", includesAll(workspace, [
  "listEngineeringReviewQueue",
  "openDraftIofPackageForCertification",
  "listCertifiedIofPackages",
  "openCertifiedIofPackage",
]));
check("workspace defines manual station and budget review models", includesAll(workspace, [
  "type ManualStationPlan",
  "type EngineeringBudgetRow",
  "function buildManualStationPlan",
  "function buildEngineeringBudgetRows",
  "routeRepositoryIdForDraft",
]));
check("workspace exposes required Engineering Certification UI", includesAll(workspace, [
  "Manual Station Plan",
  "Generate Station Plan",
  "Engineering Budget Review",
  "Approve Engineering Budget",
  "Certified IOF Package",
  "Service Order Ready. Await Signature. ScopeVersion Future.",
]));
check("workspace blocks certification until manual station and budget approval", includesAll(certifyClientBlock, [
  "Certification blocked until Engineering generates the station plan.",
  "Certification blocked until every object budget is confirmed and the Engineering budget is approved.",
]) && workspace.includes("manualCertificationReady"));
check("workspace certification submits station plan and engineering budget evidence", includesAll(certifyClientBlock, [
  "stationPlan:",
  "engineeringApprovedObjectBudget:",
  "engineeringApprovedBudget:",
  "manualHandoff:",
  "serviceOrderReady: true",
  "awaitSignature: true",
  "scopeVersionFuture: true",
]));
check("workspace certified restore displays immutable package metadata", includesAll(workspace, [
  "certificationRevision",
  "certificationHash",
  "engineeringReviewer",
  "certificationTimestamp",
  "serviceOrderStatus",
  "signatureStatus",
  "scopeVersionStatus",
]));
check("API Certified IOF type carries CIP-015 fields", includesAll(api, [
  "routeRepositoryId?: string",
  "commercialEstimate?: Record<string, unknown>",
  "stationPlanId?: string",
  "stationPlan?: Record<string, unknown>",
  "engineeringApprovedObjectBudget?: Record<string, unknown>",
  "engineeringApprovedBudgetTotal?: number",
  "certificationHash?: string",
  "serviceOrderStatus?: string",
  "scopeVersionFuture?: boolean",
]));
check("API certification accepts manual handoff payload", includesAll(api, [
  "stationPlan?: Record<string, unknown>",
  "engineeringApprovedObjectBudget?: Record<string, unknown>",
  "engineeringApprovedBudget?: number",
  "manualHandoff?: Record<string, unknown>",
]));
check("server normalizes route, estimate, station plan, and object budget evidence", includesAll(server, [
  "function routeRepositoryIdForPackage",
  "function commercialEstimateForPackage",
  "function normalizeStationPlan",
  "function normalizeEngineeringApprovedObjectBudget",
  "CERTIFIED_DRAFT_IOF_PACKAGE_COMMERCIAL_ESTIMATE_REFERENCE",
]));
check("server Certified IOF package persists required references and immutable metadata", includesAll(certifyServerBlock, [
  "certifiedDraftIofPackageId",
  "routeRepositoryId",
  "proposalId: draft.proposalId",
  "commercialEstimate",
  "engineeringApprovedObjectBudget",
  "stationPlanId: stationPlan.stationPlanId",
  "engineeringReviewer: user.name",
  "certificationTimestamp: timestamp",
  "certificationRevision",
  "certificationHash",
]));
check("server Certified IOF package ends at Service Order readiness", includesAll(certifyServerBlock, [
  "serviceOrderStatus: \"SERVICE_ORDER_READY\"",
  "signatureStatus: \"AWAITING_CUSTOMER_SIGNATURE\"",
  "scopeVersionStatus: \"BLOCKED_UNTIL_SIGNED_SERVICE_ORDER\"",
  "scopeVersionFuture: true",
  "readyForScopeVersionCreation: false",
  "readinessForScopeVersionPromotion: false",
  "noScopeVersionCreation: true",
]));
check("certification path does not create ScopeVersion", !certifyServerBlock.includes("generateScopeVersion(") &&
  !certifyServerBlock.includes("persistScopeVersion") &&
  !certifyServerBlock.includes("createScopeVersionFromCertifiedPackage("));
check("ScopeVersion promotion remains isolated behind signed Service Order authority route", includesAll(generateScopeVersionBlock, [
  "customerAcceptance",
  "serviceOrder: body.serviceOrder ?? body.signedServiceOrder",
  "generateScopeVersion(certified",
]) && server.includes("Only Runtime ScopeVersion authority may create ScopeVersions after executed Service Order."));
check("styles support budget review controls", includesAll(styles, [
  ".engineering-certification-budget-table",
  ".engineering-certification-confirm-row",
]));
check("report documents workflow, persistence, validation, and ScopeVersion boundary", includesAll(report, [
  "Workflow Implemented",
  "Certified IOF Package Record",
  "Manual Station Plan",
  "Engineering Budget Review",
  "Service Order Ready",
  "ScopeVersion Boundary",
  "Validation Results",
]));

const failed = checks.filter((item) => !item.condition);

for (const item of checks) {
  const status = item.condition ? "PASS" : "FAIL";
  console.log(`${status} ${item.name}${item.detail ? ` - ${item.detail}` : ""}`);
}

if (failed.length) {
  console.error(`\n${failed.length} CIP-015 validation check(s) failed.`);
  process.exit(1);
}

console.log("\nCIP-015 Engineering Certification manual handoff validation passed.");
