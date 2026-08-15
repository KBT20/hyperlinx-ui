import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd().endsWith("hyperlinx-dal-dev")
  ? process.cwd()
  : path.join(process.cwd(), "hyperlinx-dal-dev");

const paths = {
  model: path.join(root, "src", "engineeringChangeSet", "EngineeringChangeSet.ts"),
  validator: path.join(root, "src", "engineeringChangeSet", "EngineeringPatchValidator.ts"),
  engine: path.join(root, "src", "engineeringChangeSet", "EngineeringPatchEngine.ts"),
  barrel: path.join(root, "src", "engineeringChangeSet", "index.ts"),
  api: path.join(root, "src", "api", "teralinxRuntime.ts"),
  repositories: path.join(root, "src", "repositories", "commercialRepositories.ts"),
  workspace: path.join(root, "src", "workspaces", "EngineeringCertificationWorkspace.tsx"),
  shared: path.join(root, "server", "routes", "_shared.js"),
  index: path.join(root, "server", "index.js"),
  changeSetRoute: path.join(root, "server", "routes", "engineering-change-sets.js"),
  certificationRoute: path.join(root, "server", "routes", "engineering-certification.js"),
  baselineRoute: path.join(root, "server", "routes", "engineering-baselines.js"),
  commercialRevisionRoute: path.join(root, "server", "routes", "commercial-revisions.js"),
  commercialChangeSetRoute: path.join(root, "server", "routes", "commercial-change-sets.js"),
  commercialChangeSetEngine: path.join(root, "src", "commercialChangeSet", "CommercialPatchEngine.ts"),
  draftAssembly: path.join(root, "src", "commercial", "IOFPackageAssemblyEngine.ts"),
  scopeversions: path.join(root, "server", "routes", "scopeversions.js"),
  scopeversionAuthority: path.join(root, "server", "scopeversion-authority-engine.js"),
  pricing: path.join(root, "src", "commercial", "TransparentEstimatingEngine.ts"),
  stationProjection: path.join(root, "src", "engineering", "EngineeringCertificationProjection.ts"),
  doctrine: path.join(root, "PD_006_ENGINEERING_CHANGE_SET_DOCTRINE.md"),
  report: path.join(root, "CIP_028_ENGINEERING_CHANGE_SET_PATCH_ENGINE_REPORT.md"),
  dataDir: path.join(root, "server", "data", "engineering-change-sets"),
};

for (const requiredPath of Object.values(paths)) {
  if (!existsSync(requiredPath)) {
    console.error(`FAIL missing required file: ${path.relative(root, requiredPath)}`);
    process.exit(1);
  }
}

const source = Object.fromEntries(Object.entries(paths).map(([key, filePath]) => [
  key,
  existsSync(filePath) && !filePath.endsWith("engineering-change-sets")
    ? readFileSync(filePath, "utf8")
    : "",
]));

const checks = [];

function check(name, condition, detail = "") {
  checks.push({ name, condition: Boolean(condition), detail });
}

function includesAll(text, terms) {
  return terms.every((term) => text.includes(term));
}

function blockBetween(text, startMarker, endMarker) {
  const start = text.indexOf(startMarker);
  if (start < 0) return "";
  const end = text.indexOf(endMarker, start + startMarker.length);
  return end < 0 ? text.slice(start) : text.slice(start, end);
}

const requiredPatchKeys = [
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

const requiredPatchTypes = [
  "MOVE_STATION",
  "INSERT_STATION",
  "REMOVE_STATION",
  "CHANGE_STATION_TYPE",
  "CHANGE_STATION_INTERVAL",
  "MOVE_OBJECT",
  "ADD_OBJECT",
  "REMOVE_OBJECT",
  "CHANGE_OBJECT_CLASS",
  "CHANGE_OBJECT_TYPE",
  "CHANGE_OBJECT_STATUS",
  "CHANGE_OBJECT_SIZE",
  "CHANGE_OBJECT_CONFIGURATION",
  "ADD_CONSTRAINT",
  "REMOVE_CONSTRAINT",
  "RESOLVE_CONSTRAINT",
  "ADD_EXCEPTION",
  "RESOLVE_EXCEPTION",
  "CHANGE_CLEARANCE",
  "CHANGE_PLACEMENT",
  "CHANGE_SPLICE",
  "CHANGE_SPLICE_CASE",
  "CHANGE_FIBER_ASSIGNMENT",
  "CHANGE_BUFFER_ASSIGNMENT",
  "CHANGE_LOSS",
  "CHANGE_REGEN",
  "CHANGE_ILA_CONFIGURATION",
  "ADD_EVIDENCE",
  "REMOVE_EVIDENCE",
  "CHANGE_REVIEW_STATUS",
  "ADD_ENGINEERING_NOTE",
];

const modelPatchBlock = blockBetween(source.model, "export type EngineeringPatch =", "export type EngineeringChangeSetStatus");
const validatorKeyBlock = blockBetween(source.validator, "const REQUIRED_PATCH_KEYS", "] as const");
const routePatchKeyBlock = blockBetween(source.changeSetRoute, "const ALLOWED_PATCH_KEYS", "];");
const workspacePatchBlock = blockBetween(source.workspace, "async function recordEngineeringChangeSetPatch", "async function certifyPackage");
const certificationBlock = blockBetween(source.certificationRoute, "async function handleCertifyPackage", "async function handleGenerateScopeVersion");

check("Engineering Change Set data directory exists", existsSync(paths.dataDir));
check("Engineering patch model is whitelist-only", includesAll(modelPatchBlock, requiredPatchKeys) &&
  ["commercialGeometry", "stationPlan", "engineeringPackage", "proposalBody", "workbookBody"].every((term) => !modelPatchBlock.includes(term)));
check("all required Engineering patch types exist in TS validator", includesAll(source.validator, requiredPatchTypes));
check("all required Engineering patch types exist in server route", includesAll(source.changeSetRoute, requiredPatchTypes));
check("TS patch whitelist contains only model fields", includesAll(validatorKeyBlock, requiredPatchKeys));
check("server patch whitelist contains only model fields", includesAll(routePatchKeyBlock, requiredPatchKeys));
check("patch factory and validator enforce Engineering Change Set authority", includesAll(source.validator, [
  "createEngineeringPatch",
  "validateEngineeringPatch",
  "validateEngineeringChangeSet",
  "authority: \"ENGINEERING_CHANGE_SET\"",
  "Engineering Patch authority must be ENGINEERING_CHANGE_SET.",
]));
check("Engineering Revision projection rebuilds from Baseline and Change Sets", includesAll(source.engine, [
  "buildEngineeringRevisionProjection",
  "normalizedPatches(changeSets",
  "sourceAuthority: \"ENGINEERING_BASELINE\"",
  "revisionAuthority: \"ENGINEERING_REVISION\"",
  "patchAuthority: \"ENGINEERING_CHANGE_SET\"",
  "baselineImmutable: true",
  "noBaselineMutation: true",
  "noEngineeringPackageMutation: true",
  "noStationProjectionMutation: true",
  "noPricingMutation: true",
  "noCommercialAuthorityMutation: true",
  "noScopeVersionCreation: true",
]));
check("Engineering Patch replay and comparison are implemented", includesAll(source.engine, [
  "replayEngineeringPatches",
  "compareEngineeringRevisionProjections",
  "discardUnappliedEngineeringPatches",
  "restoreOriginalEngineeringRevision",
  "engineeringChangeSetFromPatches",
]));
check("Engineering Change Set API is mounted and stored canonically", includesAll(source.shared + source.index + source.changeSetRoute, [
  "engineeringChangeSets: path.join(DATA_ROOT, \"engineering-change-sets\")",
  "handleEngineeringChangeSets",
  "/api/engineering/change-sets",
  "DIRS.engineeringChangeSets",
  "persistEngineeringChangeSet",
  "projectEngineeringRevisionFromChangeSets",
]));
check("runtime API and repository facade use Engineering Change Set endpoints", includesAll(source.api + source.repositories, [
  "listEngineeringChangeSets",
  "openEngineeringChangeSet",
  "saveEngineeringChangeSet",
  "replayEngineeringRevision",
  "compareEngineeringRevision",
  "discardEngineeringRevision",
  "restoreOriginalEngineeringRevision",
  "EngineeringChangeSetRepository",
]));
check("Engineering UI creates patches for existing edit actions", includesAll(workspacePatchBlock, [
  "recordEngineeringChangeSetPatch",
  "CHANGE_OBJECT_CONFIGURATION",
  "CHANGE_REVIEW_STATUS",
  "ADD_CONSTRAINT",
  "MOVE_OBJECT",
  "CHANGE_PLACEMENT",
  "ADD_EXCEPTION",
  "EngineeringChangeSetRepository.saveChangeSet",
]));
check("Engineering UI displays revision diagnostics", includesAll(source.workspace, [
  "renderEngineeringRevisionHash",
  "Active Patch Count",
  "Applied Patch Count",
  "Replay Time",
  "Projection Time",
  "Certification Readiness",
]));
check("Engineering Certification submits Engineering Revision projection", includesAll(source.workspace, [
  "engineeringRevision:",
  "engineeringRevisionProjection: certificationRevisionProjection",
  "certificationConsumesEngineeringRevision: true",
  "noBaselineMutation: true",
  "noEngineeringPackageMutation: true",
]));
check("Certification route consumes Engineering Revision and Change Sets", includesAll(certificationBlock, [
  "engineeringChangeSetsForRevision",
  "projectEngineeringRevisionFromChangeSets",
  "engineeringRevisionRequest",
  "engineeringRevisionProjectionRequest",
  "engineeringRevisionId",
  "engineeringRevisionHash",
  "certifiedEngineeringChangeSetIds",
  "engineeringCertificationEvidenceId",
  "sourceEngineeringTruthId: engineeringRevisionId",
  "engineeringTruthAuthority: \"ENGINEERING_REVISION\"",
  "certificationConsumesEngineeringRevision: true",
  "certifiedIofPackageConsumesEngineeringRevision: true",
  "engineeringPackageIntakeOnly: true",
]));
check("Certified IOF Package references revision and evidence", includesAll(certificationBlock, [
  "engineeringBaselineId",
  "engineeringBaselineHash",
  "engineeringRevisionId",
  "engineeringRevisionHash",
  "engineeringChangeSetIds",
  "certificationEvidenceReferences",
  "certificationHash",
]));
check("Engineering Baseline remains immutable", includesAll(source.baselineRoute, [
  "immutable: true",
  "referenceOnly: true",
  "noCommercialMutation: true",
]) && !source.changeSetRoute.includes("persistRecord(DIRS.engineeringBaselines"));
check("Draft IOF generation was not changed for Engineering Change Sets", !source.draftAssembly.includes("ENGINEERING_CHANGE_SET") &&
  !source.draftAssembly.includes("EngineeringChangeSet"));
check("Commercial Change Set authority was not modified by Engineering Change Sets", !source.commercialChangeSetRoute.includes("ENGINEERING_CHANGE_SET") &&
  !source.commercialChangeSetEngine.includes("ENGINEERING_CHANGE_SET") &&
  !source.commercialRevisionRoute.includes("ENGINEERING_CHANGE_SET"));
check("ScopeVersion authority was not modified", !source.scopeversions.includes("ENGINEERING_CHANGE_SET") &&
  !source.scopeversionAuthority.includes("ENGINEERING_CHANGE_SET") &&
  !source.changeSetRoute.includes("createScopeVersion"));
check("Pricing formulas were not modified for Engineering Change Sets", !source.pricing.includes("ENGINEERING_CHANGE_SET") &&
  !source.pricing.includes("EngineeringChangeSet"));
check("Station projection implementation remains separate from Engineering Change Sets", !source.stationProjection.includes("ENGINEERING_CHANGE_SET") &&
  !source.stationProjection.includes("EngineeringChangeSet"));
check("doctrine and report document required architecture", includesAll(source.doctrine + source.report, [
  "Engineering Baseline",
  "Engineering Change Sets",
  "Engineering Revision",
  "Patch Architecture",
  "Revision Architecture",
  "Replay Strategy",
  "Certification Integration",
  "Validation Results",
]));

const failed = checks.filter((item) => !item.condition);

for (const item of checks) {
  const status = item.condition ? "PASS" : "FAIL";
  console.log(`${status} ${item.name}${item.detail ? ` - ${item.detail}` : ""}`);
}

if (failed.length) {
  console.error(`\n${failed.length} CIP-028 validation check(s) failed.`);
  process.exit(1);
}

console.log("\nCIP-028 engineering change set validation passed.");
