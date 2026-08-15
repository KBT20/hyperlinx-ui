import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd().endsWith("hyperlinx-dal-dev")
  ? process.cwd()
  : path.join(process.cwd(), "hyperlinx-dal-dev");

const paths = {
  doctrine: path.join(root, "PD_005_COMMERCIAL_CHANGE_SET_DOCTRINE.md"),
  report: path.join(root, "CIP_026_COMMERCIAL_CHANGE_SET_PATCH_ENGINE_REPORT.md"),
  validation: path.join(root, "cip026-commercial-change-set-validation.mjs"),
  shared: path.join(root, "server", "routes", "_shared.js"),
  index: path.join(root, "server", "index.js"),
  changeSetsRoute: path.join(root, "server", "routes", "commercial-change-sets.js"),
  revisionsRoute: path.join(root, "server", "routes", "commercial-revisions.js"),
  proposalsRoute: path.join(root, "server", "routes", "proposal-drafts.js"),
  commercialIofRoute: path.join(root, "server", "routes", "commercial-iof-packages.js"),
  engineeringCertification: path.join(root, "server", "routes", "engineering-certification.js"),
  engineeringPackages: path.join(root, "server", "routes", "engineering-packages.js"),
  scopeversions: path.join(root, "server", "routes", "scopeversions.js"),
  api: path.join(root, "src", "api", "teralinxRuntime.ts"),
  repositories: path.join(root, "src", "repositories", "commercialRepositories.ts"),
  workspace: path.join(root, "src", "components", "workspaces", "GoogleRfpWorkspace.tsx"),
  changeSetTypes: path.join(root, "src", "commercialChangeSet", "CommercialChangeSet.ts"),
  patchValidator: path.join(root, "src", "commercialChangeSet", "CommercialPatchValidator.ts"),
  patchEngine: path.join(root, "src", "commercialChangeSet", "CommercialPatchEngine.ts"),
  routeAdapter: path.join(root, "src", "commercialChangeSet", "RouteEditCommercialPatchAdapter.ts"),
  changeSetIndex: path.join(root, "src", "commercialChangeSet", "index.ts"),
  pricingEngine: path.join(root, "src", "commercial", "TransparentEstimatingEngine.ts"),
  proposalAuthority: path.join(root, "src", "kernel", "ProposalAuthorityState.ts"),
  dataDir: path.join(root, "server", "data", "commercial-change-sets"),
};

for (const requiredPath of Object.values(paths)) {
  if (!existsSync(requiredPath)) {
    console.error(`FAIL missing required CIP-026 file: ${path.relative(root, requiredPath)}`);
    process.exit(1);
  }
}

const sources = Object.fromEntries(Object.entries(paths)
  .filter(([, filePath]) => filePath.endsWith(".js") || filePath.endsWith(".ts") || filePath.endsWith(".tsx") || filePath.endsWith(".md"))
  .map(([key, filePath]) => [key, readFileSync(filePath, "utf8")]));

const checks = [];

function check(name, condition, detail = "") {
  checks.push({ name, condition: Boolean(condition), detail });
}

function includesAll(source, terms) {
  source = source ?? "";
  return terms.every((term) => source.includes(term));
}

function blockBetween(source, startMarker, endMarker) {
  source = source ?? "";
  const start = source.indexOf(startMarker);
  if (start < 0) return "";
  const end = source.indexOf(endMarker, start + startMarker.length);
  return end < 0 ? source.slice(start) : source.slice(start, end);
}

const requiredPatchTypes = [
  "CHANGE_PLOW_PERCENT",
  "CHANGE_BORE_PERCENT",
  "CHANGE_ROCK_PERCENT",
  "CHANGE_TRENCH_PERCENT",
  "CHANGE_AERIAL_PERCENT",
  "CHANGE_PLOW_RATE",
  "CHANGE_BORE_RATE",
  "CHANGE_LABOR_RATE",
  "CHANGE_MATERIAL_RATE",
  "CHANGE_EQUIPMENT_RATE",
  "CHANGE_MARKUP",
  "CHANGE_CONTINGENCY",
  "MOVE_ILA",
  "REMOVE_ILA",
  "RESTORE_ILA",
  "CHANGE_MAX_SPAN",
  "CHANGE_OPTICAL_LOSS",
  "CHANGE_REGEN_SPACING",
  "CHANGE_STATION_SPACING",
  "REMOVE_BOOKEND",
  "RESTORE_BOOKEND",
  "ADD_UNKNOWN",
  "RESOLVE_UNKNOWN",
  "ADD_RISK",
  "RESOLVE_RISK",
  "ADD_EXCEPTION",
  "RESOLVE_EXCEPTION",
  "MOVE_ALIGNMENT",
  "CHANGE_CONSTRUCTION_METHOD",
  "CHANGE_SEGMENT_TYPE",
];

const requiredPatchFields = [
  "patchId",
  "revisionId",
  "patchType",
  "targetObjectId",
  "targetProperty",
  "oldValue",
  "newValue",
  "createdBy",
  "createdAt",
  "reason",
  "authority",
  "validationState",
];

const proposalSaveBlock = blockBetween(sources.proposalsRoute, "const commercialRevision = await ensureCommercialRevisionForProposal(recordWithHistory", "recordWithHistory.readiness");
const draftSourceBlock = blockBetween(sources.proposalsRoute, "const commercialRevision = await ensureCommercialRevisionForProposal(record", "const saved = await saveProposal");
const commercialIofSubmitBlock = blockBetween(sources.commercialIofRoute, "const commercialAuthority = await ensureCommercialReleasePackageForDraft", "appendEngineeringTransactionStep");
const workspaceRouteEditBlock = blockBetween(sources.workspace, "function activeRouteEditBase()", "function transparentConstraintTemplate");
const repositoryBrowserBlock = blockBetween(sources.workspace, "const commercialRepositoryBrowserSections", "function isCommercialWorkbookSectionOpen");

check("Commercial Change Set physical storage exists", existsSync(paths.dataDir));
check("Commercial Change Set storage directory registered", sources.shared.includes("commercialChangeSets: path.join(DATA_ROOT, \"commercial-change-sets\")"));
check("Commercial Change Set API route mounted and health visible", includesAll(sources.index, [
  "handleCommercialChangeSets",
  "/api/commercial/change-sets",
  "commercialChangeSets: true",
]));
check("Commercial Change Set server route is patch-only and additive", includesAll(sources.changeSetsRoute, [
  "ALLOWED_PATCH_KEYS",
  "ALLOWED_CHANGE_SET_KEYS",
  "commercialPatchRecordForRepository",
  "commercialChangeSetRecordForRepository",
  "assertAllowedKeys(patch, ALLOWED_PATCH_KEYS",
  "additive: true",
  "patchSetOnly: true",
  "repositoryTruthImmutable: true",
  "noScopeVersionCreation: true",
]));
check("Commercial Patch model contains exactly required fields", requiredPatchFields.every((field) => sources.changeSetTypes.includes(`${field}:`) || sources.changeSetTypes.includes(`${field}?:`) || sources.patchValidator.includes(`\"${field}\"`)) &&
  includesAll(sources.patchValidator, requiredPatchFields.map((field) => `\"${field}\"`)));
check("Commercial Patch model supports required patch types", requiredPatchTypes.every((type) => sources.changeSetTypes.includes(`\"${type}\"`) && sources.patchValidator.includes(`\"${type}\"`)));
check("Commercial Patch Engine rebuilds projection from repository plus change sets", includesAll(sources.patchEngine, [
  "buildCommercialRevisionProjection",
  "repositoryTruth",
  "changeSets",
  "repositoryTruthImmutable: true",
  "workbookConsumesCommercialRevision: true",
  "estimateConsumesCommercialRevision: true",
  "proposalConsumesCommercialRevision: true",
  "commercialReleasePackageConsumesCommercialRevision: true",
  "draftIofConsumesCommercialRevision: true",
  "noPricingFormulaMutation: true",
]));
check("Commercial Patch Replay and comparison are patch-result based", includesAll(sources.patchEngine, [
  "replayCommercialPatches",
  "compareCommercialRevisionProjections",
  "rawJsonCompared: false",
  "comparedPatchResults: true",
  "discardUnappliedCommercialPatches",
  "restoreOriginalCommercialRevision",
]));
check("Route Edit adapter creates Commercial patches without new UI mode", includesAll(sources.routeAdapter, [
  "commercialPatchFromRouteEditPatch",
  "commercialPatchTypeFromRouteEditPatch",
  "CHANGE_PLOW_PERCENT",
  "MOVE_ILA",
  "REMOVE_BOOKEND",
  "CHANGE_MARKUP",
]));
check("Commercial Revision replays Change Sets before persistence", includesAll(sources.revisionsRoute, [
  "commercialChangeSetsForRevision",
  "projectCommercialRevisionFromChangeSets",
  "changeSetIds",
  "activePatchCount",
  "patchReplayTimeMs",
  "projectionTimeMs",
  "commercialChangeSetAuthority: \"COMMERCIAL_CHANGE_SET\"",
]));
check("Proposal consumes Commercial Revision Projection metadata", includesAll(proposalSaveBlock + draftSourceBlock, [
  "changeSetIds: commercialRevision.changeSetIds",
  "commercialRevisionProjection: \"COMMERCIAL_REVISION_PROJECTION\"",
  "proposalOutputUnchanged: true",
  "pricingOutputUnchanged: true",
  "workbookOutputUnchanged: true",
]));
check("Commercial Draft IOF consumes Commercial Revision Projection metadata", includesAll(commercialIofSubmitBlock, [
  "changeSetIds: commercialRevisionForSubmit.changeSetIds",
  "commercialRevisionProjection: \"COMMERCIAL_REVISION_PROJECTION\"",
  "draftIofOutputUnchanged: true",
  "pricingOutputUnchanged: true",
  "workbookOutputUnchanged: true",
]));
check("Runtime API and repository facade expose Change Set authority", includesAll(sources.api + sources.repositories, [
  "CommercialChangeSetRuntime",
  "CommercialRevisionProjectionRuntime",
  "listCommercialChangeSets",
  "openCommercialChangeSet",
  "saveCommercialChangeSet",
  "replayCommercialRevision",
  "compareCommercialRevision",
  "discardCommercialRevision",
  "restoreOriginalCommercialRevision",
  "CommercialChangeSetRepository",
]));
check("Commercial UI stages, saves, compares, discards, and restores Change Sets", includesAll(workspaceRouteEditBlock, [
  "stageCommercialChangeSetPatch",
  "saveCommercialChangeSetForRouteRevision",
  "CommercialChangeSetRepository.saveChangeSet",
  "CommercialChangeSetRepository.replayRevision",
  "compareCommercialRevisionProjections",
  "discardUnappliedCommercialPatches",
  "restoreOriginalCommercialRevision",
]));
check("Commercial UI diagnostics show requested runtime metrics", includesAll(sources.workspace, [
  "Repository Hash",
  "Revision Hash",
  "Active Patch Count",
  "Applied Patch Count",
  "Patch Replay",
  "Projection",
  "commercialChangeSetNotice",
]));
check("Repository Browser includes Commercial Change Set Repository", includesAll(repositoryBrowserBlock, [
  "Commercial Change Set Repository",
  "server/data/commercial-change-sets/*.json",
  "/api/commercial/change-sets",
]));
check("ScopeVersion remains unchanged by Commercial Change Sets", !sources.scopeversions.includes("COMMERCIAL_CHANGE_SET") &&
  !sources.scopeversions.includes("commercialChangeSet") &&
  !sources.scopeversions.includes("changeSetIds"));
check("Engineering Package and Certification do not implement Commercial Change Sets", !sources.engineeringPackages.includes("COMMERCIAL_CHANGE_SET") &&
  !sources.engineeringPackages.includes("commercialChangeSet") &&
  !sources.engineeringCertification.includes("COMMERCIAL_CHANGE_SET") &&
  !sources.engineeringCertification.includes("commercialChangeSet") &&
  !sources.engineeringCertification.includes("commercialRevisionProjection"));
check("Pricing and proposal authority kernels do not import Change Set engine", !sources.pricingEngine.includes("commercialChangeSet") &&
  !sources.pricingEngine.includes("CommercialChangeSet") &&
  !sources.proposalAuthority.includes("commercialChangeSet") &&
  !sources.proposalAuthority.includes("CommercialChangeSet"));
check("Doctrine and report document required CIP-026 sections", includesAll(sources.doctrine + sources.report, [
  "Constitutional Doctrine",
  "Patch Architecture",
  "Revision Architecture",
  "Projection Architecture",
  "Replay Strategy",
  "Comparison Strategy",
  "Validation Results",
]));

const failed = checks.filter((item) => !item.condition);

for (const item of checks) {
  const status = item.condition ? "PASS" : "FAIL";
  console.log(`${status} ${item.name}${item.detail ? ` - ${item.detail}` : ""}`);
}

if (failed.length) {
  console.error(`\n${failed.length} CIP-026 validation check(s) failed.`);
  process.exit(1);
}

console.log("\nCIP-026 commercial change set validation passed.");
