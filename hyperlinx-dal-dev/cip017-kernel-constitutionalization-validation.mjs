import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd().endsWith("hyperlinx-dal-dev")
  ? process.cwd()
  : path.join(process.cwd(), "hyperlinx-dal-dev");

const paths = {
  report: path.join(root, "CIP_017_KERNEL_CONSTITUTIONALIZATION_REPORT.md"),
  workspace: path.join(root, "src", "components", "workspaces", "GoogleRfpWorkspace.tsx"),
  commercialReviewPanel: path.join(root, "src", "components", "workspaces", "googleRfp", "CommercialReviewPanel.tsx"),
  proposalRoutes: path.join(root, "server", "routes", "proposal-drafts.js"),
  routeRoutes: path.join(root, "server", "routes", "commercial-routes.js"),
  commercialIofRoutes: path.join(root, "server", "routes", "commercial-iof-packages.js"),
  engineeringPackages: path.join(root, "server", "routes", "engineering-packages.js"),
  engineeringCertification: path.join(root, "server", "routes", "engineering-certification.js"),
  api: path.join(root, "src", "api", "teralinxRuntime.ts"),
};

for (const requiredPath of Object.values(paths)) {
  if (!existsSync(requiredPath)) {
    console.error(`FAIL missing required file: ${path.relative(root, requiredPath)}`);
    process.exit(1);
  }
}

const sources = Object.fromEntries(
  Object.entries(paths).map(([key, filePath]) => [key, readFileSync(filePath, "utf8")]),
);

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

const report = sources.report;
const workspace = sources.workspace;
const engineeringPackageBuilder = blockBetween(
  sources.engineeringPackages,
  "export function engineeringPackageRecordForRepository",
  "export function buildEngineeringPackageFromDraftPackage",
);
const commercialSubmitHandler = blockBetween(
  workspace,
  "async function handleSubmitCommercialDraftIofToEngineering",
  "function handleOpenSubmittedEngineeringCertification",
);
const commercialScope = [
  sources.workspace,
  sources.proposalRoutes,
  sources.commercialIofRoutes,
  sources.engineeringPackages,
  sources.routeRoutes,
].join("\n");

check("report documents Proposal Repository as sole proposal authority", includesAll(report, [
  "Proposal Repository is the sole proposal authority.",
  "ProposalKernel",
  "Duplicate Proposal Authority Inventory",
  "Canonical owner:",
]));
check("report documents Route Repository as sole route geometry authority", includesAll(report, [
  "Route Repository is the sole route geometry authority.",
  "RouteKernel",
  "Duplicate Route Authority Inventory",
  "commercialGeometry",
]));
check("report documents Engineering Repository as sole engineering package authority", includesAll(report, [
  "Engineering Repository is the sole engineering package authority.",
  "EngineeringHandoffKernel",
  "Engineering Certification must load by `EngineeringPackageId` only.",
]));
check("report includes lifecycle state machine inventory", includesAll(report, [
  "Lifecycle State Machine Inventory",
  "repositoryStatus",
  "approvalState",
  "customerReviewState",
  "readiness",
  "nextAction",
]));
check("report includes duplicate UI action inventory", includesAll(report, [
  "Duplicate UI Action Inventory",
  "Constitutional Commercial actions",
  "Legacy/remove",
  "Future hidden",
]));
check("report includes hydration and API cleanup plans", includesAll(report, [
  "Duplicate Hydration Logic Inventory",
  "API Authority Cleanup Plan",
  "CommercialPackageKernel",
  "ServiceOrderKernel",
]));
check("report includes kernel authority map", includesAll(report, [
  "Kernel Authority Map",
  "ProposalKernel",
  "RouteKernel",
  "CommercialPackageKernel",
  "EngineeringHandoffKernel",
  "EngineeringCertificationKernel",
  "ScopeVersionKernel Future",
  "InventoryKernel Future",
]));
check("report includes decision trace standard", includesAll(report, [
  "Decision Trace Standard",
  "`action`",
  "`actor`",
  "`currentState`",
  "`requestedTransition`",
  "`ruleResults`",
  "`repositoryWrites`",
  "Proposal approval emits `[ProposalApprovalDecisionTrace]`",
  "Engineering handoff emits `[EngineeringTransaction]`",
]));
check("Commercial UI no longer exposes legacy direct Engineering buttons", !workspace.includes("Enter Engineering Mode") &&
  !workspace.includes("Open In Engineering") &&
  !workspace.includes("handleEnterEngineeringMode") &&
  !workspace.includes("handleOpenImportedCustomerRouteInEngineering"));
check("Commercial workspace no longer directly passes full commercial objects to Engineering", !workspace.includes("activateRouteEngineeringFromCommercialDraft") &&
  !workspace.includes("commercialDraft: commercialCorridorDraft") &&
  !workspace.includes("commercialDraft: priced.draft"));
check("Submit to Engineering remains visible and repository driven", includesAll(workspace + sources.commercialReviewPanel, [
  "Submit to Engineering",
  "Open Engineering Certification",
  "handleSubmitCommercialDraftIofToEngineering",
  "submitDraftIofPackageToEngineering",
  "openEngineeringPackage",
]));
check("Commercial Submit to Engineering passes package id instead of full object", includesAll(commercialSubmitHandler, [
  "submitDraftIofPackageToEngineering(draftSource.packageId",
  "openEngineeringPackage(result.engineeringPackage.engineeringPackageId",
  "engineeringPackage: verifiedEngineeringPackage",
]) && !commercialSubmitHandler.includes("activateRouteEngineeringFromCommercialDraft"));
check("Engineering Package serializer is reference-only", includesAll(engineeringPackageBuilder, [
  "engineeringPackageId",
  "customerId",
  "customerTwinId",
  "opportunityId",
  "routeRepositoryId",
  "proposalId",
  "commercialWorkbookId",
  "estimateId",
  "draftIOFPackageId",
  "referenceOnly: true",
  "noScopeVersionCreation: true",
  "stationPlanId",
  "futureInventoryManifestId",
  "certifiedIOFPackageId",
  "assertReferenceOnlyEngineeringPackagePayload(record)",
]) && includesAll(sources.engineeringPackages, [
  "ALLOWED_ENGINEERING_PACKAGE_KEYS",
  "REFERENCE_ONLY_PAYLOAD_LIMIT_BYTES",
  "forbiddenKeys",
]));
check("Engineering Package serializer excludes embedded commercial bodies", !engineeringPackageBuilder.includes("commercialGeometry") &&
  !engineeringPackageBuilder.includes("convertedRuntimeGeometry") &&
  !engineeringPackageBuilder.includes("proposalBody") &&
  !engineeringPackageBuilder.includes("workbookBody") &&
  !engineeringPackageBuilder.includes("estimateBody"));
check("Proposal approval has decision trace coverage", includesAll(sources.proposalRoutes, [
  "buildProposalApprovalDecisionTrace",
  "ProposalApprovalDecisionTrace",
  "decisionTrace",
  "requestedTransition: \"APPROVE\"",
]));
check("Engineering handoff has transaction trace coverage", includesAll(sources.engineeringPackages, [
  "appendEngineeringTransactionStep",
  "[EngineeringTransaction]",
  "ENGINEERING_TRANSACTION_STEPS",
  "VERIFY_ENGINEERING_PACKAGE",
]));
check("ScopeVersion is not created by Commercial or Engineering handoff", !commercialSubmitHandler.includes("createScopeVersion") &&
  !sources.engineeringPackages.includes("createScopeVersion") &&
  !sources.proposalRoutes.includes("createScopeVersion") &&
  !sources.commercialIofRoutes.includes("createScopeVersion"));
check("Inventory is not created by Commercial or Engineering handoff", !commercialScope.includes("persistRecord(DIRS.runtimeInventories") &&
  !commercialScope.includes("persistRecord(DIRS.inventoryGraphs") &&
  commercialScope.includes("noInventoryMutation"));
check("Route Repository remains canonical geometry persistence", includesAll(sources.routeRoutes, [
  "repositoryType: \"COMMERCIAL_ROUTE_REPOSITORY\"",
  "commercialGeometry",
  "geometryHash",
  "routeGeometryId",
  "noScopeVersionCreation: true",
  "noInventoryMutation: true",
]));

const failed = checks.filter((item) => !item.condition);

for (const item of checks) {
  const status = item.condition ? "PASS" : "FAIL";
  console.log(`${status} ${item.name}${item.detail ? ` - ${item.detail}` : ""}`);
}

if (failed.length) {
  console.error(`\n${failed.length} CIP-017 validation check(s) failed.`);
  process.exit(1);
}

console.log("\nCIP-017 kernel constitutionalization validation passed.");
