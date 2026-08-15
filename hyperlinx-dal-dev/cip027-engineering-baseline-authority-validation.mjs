import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd().endsWith("hyperlinx-dal-dev")
  ? process.cwd()
  : path.join(process.cwd(), "hyperlinx-dal-dev");

const paths = {
  baselineRoute: path.join(root, "server", "routes", "engineering-baselines.js"),
  engineeringPackages: path.join(root, "server", "routes", "engineering-packages.js"),
  commercialIof: path.join(root, "server", "routes", "commercial-iof-packages.js"),
  engineeringCertification: path.join(root, "server", "routes", "engineering-certification.js"),
  shared: path.join(root, "server", "routes", "_shared.js"),
  index: path.join(root, "server", "index.js"),
  api: path.join(root, "src", "api", "teralinxRuntime.ts"),
  repositories: path.join(root, "src", "repositories", "commercialRepositories.ts"),
  engineeringWorkspace: path.join(root, "src", "workspaces", "EngineeringCertificationWorkspace.tsx"),
  iofAssembly: path.join(root, "src", "commercial", "IOFPackageAssemblyEngine.ts"),
  commercialRevisions: path.join(root, "server", "routes", "commercial-revisions.js"),
  commercialChangeSets: path.join(root, "server", "routes", "commercial-change-sets.js"),
  scopeversions: path.join(root, "server", "routes", "scopeversions.js"),
  scopeversionAuthority: path.join(root, "server", "scopeversion-authority-engine.js"),
  pricing: path.join(root, "src", "commercial", "TransparentEstimatingEngine.ts"),
  proposal: path.join(root, "src", "proposal", "ProposalGenerationEngine.ts"),
  doctrine: path.join(root, "PD_006_ENGINEERING_BASELINE_DOCTRINE.md"),
  report: path.join(root, "CIP_027_ENGINEERING_BASELINE_AUTHORITY_REPORT.md"),
  dataDir: path.join(root, "server", "data", "engineering-baselines"),
};

for (const requiredPath of Object.values(paths)) {
  if (!existsSync(requiredPath)) {
    console.error(`FAIL missing required file: ${path.relative(root, requiredPath)}`);
    process.exit(1);
  }
}

const sources = Object.fromEntries(
  Object.entries(paths)
    .filter(([key]) => key !== "dataDir")
    .map(([key, file]) => [key, readFileSync(file, "utf8")]),
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

function appearsBefore(source, first, second) {
  const firstIndex = source.indexOf(first);
  const secondIndex = source.indexOf(second);
  return firstIndex >= 0 && secondIndex >= 0 && firstIndex < secondIndex;
}

const baselineSerializerBlock = blockBetween(sources.baselineRoute, "export function engineeringBaselineRecordForRepository", "export function EngineeringBaseline(input");
const baselinePersistBlock = blockBetween(sources.baselineRoute, "export async function persistEngineeringBaseline", "export async function loadEngineeringBaseline");
const packageSerializerBlock = blockBetween(sources.engineeringPackages, "export function engineeringPackageRecordForRepository", "export function buildEngineeringPackageFromDraftPackage");
const packageResolveBlock = blockBetween(sources.engineeringPackages, "export async function resolveEngineeringPackageReferences", "export async function persistEngineeringPackage");
const packagePersistBlock = blockBetween(sources.engineeringPackages, "export async function persistEngineeringPackage", "export async function updateEngineeringPackageStatus");
const packageUpdateBlock = blockBetween(sources.engineeringPackages, "export async function updateEngineeringPackageStatus", "export async function loadEngineeringPackage");
const submitBlock = blockBetween(sources.commercialIof, "async function submitCommercialDraftPackageToEngineering", "export async function handleCommercialIofPackages");
const certificationReadinessBlock = blockBetween(sources.engineeringCertification, "function buildEngineeringRepositoryValidationReport", "function decorateDraftPackageWithEngineeringPackage");
const certificationDecorateBlock = blockBetween(sources.engineeringCertification, "function decorateDraftPackageWithEngineeringPackage", "async function decorateDraftPackageForResponse");
const certifyBlock = blockBetween(sources.engineeringCertification, "async function handleCertifyPackage", "async function handleGenerateScopeVersion");

check("Engineering Baseline repository route exists and is registered", includesAll(sources.shared + sources.index, [
  "engineeringBaselines: path.join(DATA_ROOT, \"engineering-baselines\")",
  "handleEngineeringBaselines",
  "/api/engineering/baselines",
  "engineeringBaselines: true",
]));
check("Engineering Baseline creates required authority artifacts", includesAll(sources.baselineRoute, [
  "EngineeringBaseline",
  "EngineeringBaselineManifest",
  "EngineeringBaselineValidator",
  "EngineeringBaselineProjection",
  "EngineeringBaselineAuthority",
]));
check("Engineering Baseline is immutable and reference-only", includesAll(sources.baselineRoute, [
  "immutable: true",
  "referenceOnly: true",
  "draftIofPackageUnchanged: true",
  "noCommercialMutation: true",
  "noScopeVersionCreation: true",
  "noGeometryDuplication: true",
  "noWorkbookDuplication: true",
  "noProposalDuplication: true",
  "REFERENCE_ONLY_PAYLOAD_LIMIT_BYTES",
  "FORBIDDEN_BASELINE_KEYS",
]));
check("Baseline serializer whitelists references and preserves station/object references", includesAll(baselineSerializerBlock, [
  "commercialReleasePackageId",
  "draftIOFPackageId",
  "commercialRevisionId",
  "commercialRevisionHash",
  "commercialReleaseHash",
  "routeRepositoryId",
  "stationProjectionId",
  "stationGraphId",
  "stationAuthorityIds",
  "objectManifestId",
  "stationObjectManifestId",
  "projectedObjectManifestId",
  "estimateId",
  "workbookId",
  "proposalId",
  "productDoctrineId",
  "engineeringDoctrineId",
]));
check("Baseline persist refuses mutation after first commit", includesAll(baselinePersistBlock, [
  "already exists with different immutable references",
  "return normalizeEngineeringBaseline(existing)",
  "persistRecord(DIRS.engineeringBaselines",
  "verifyEngineeringBaselineRepositoryRecord(reloaded)",
]));
check("Engineering Package model requires Baseline and Revision references", includesAll(sources.engineeringPackages, [
  "\"engineeringBaselineId\"",
  "\"engineeringBaselineHash\"",
  "\"engineeringBaselineManifestId\"",
  "\"engineeringBaselineProjectionId\"",
  "\"engineeringRevisionId\"",
  "\"derivedFromBaseline\"",
  "\"engineeringAuthority\"",
  "MIRRORS_ENGINEERING_PACKAGE",
]));
check("Engineering Package hash includes Baseline references", includesAll(sources.engineeringPackages, [
  "engineeringBaselineId: record.engineeringBaselineId",
  "engineeringBaselineHash: record.engineeringBaselineHash",
  "engineeringBaselineManifestId: record.engineeringBaselineManifestId",
  "engineeringBaselineProjectionId: record.engineeringBaselineProjectionId",
  "engineeringRevisionId: record.engineeringRevisionId",
]));
check("Engineering Package is derived from persisted Baseline", includesAll(packageSerializerBlock, [
  "const engineeringBaseline = asRecord(input.engineeringBaseline ?? input.baseline)",
  "engineeringBaselineId",
  "engineeringBaselineHash",
  "derivedFromBaseline: true",
  "engineeringRevisionId",
  "engineeringAuthority: \"ENGINEERING_BASELINE\"",
]));
check("Engineering Package restore resolves Baseline repository first", includesAll(packageResolveBlock, [
  "loadEngineeringBaseline(record.engineeringBaselineId)",
  "checks = {",
  "engineeringBaseline:",
  "server/data/engineering-baselines",
  "resolved: {",
  "engineeringBaseline",
]));
check("Engineering Package persist and status update preserve Baseline fields", includesAll(packagePersistBlock + packageUpdateBlock, [
  "engineeringBaselineId",
  "engineeringBaselineManifestId",
  "engineeringBaselineProjectionId",
  "engineeringBaselineHash",
  "engineeringRevisionId",
  "engineeringRevisionState",
  "engineeringAuthority",
]));
check("Commercial submit creates Baseline before Engineering Package", includesAll(submitBlock, [
  "buildEngineeringBaselineFromDraftPackage",
  "persistEngineeringBaseline",
  "Build Engineering Baseline",
  "buildEngineeringPackageFromDraftPackage",
  "engineeringBaseline: engineeringBaselineRecord",
]) && appearsBefore(submitBlock, "persistEngineeringBaseline", "buildEngineeringPackageFromDraftPackage"));
check("Commercial submit verifies Baseline fields after Package reload", includesAll(submitBlock, [
  "[\"engineeringBaselineId\", verifiedEngineeringPackage.engineeringBaselineId]",
  "[\"engineeringBaselineHash\", verifiedEngineeringPackage.engineeringBaselineHash]",
  "[\"engineeringBaselineManifestId\", verifiedEngineeringPackage.engineeringBaselineManifestId]",
  "[\"engineeringBaselineProjectionId\", verifiedEngineeringPackage.engineeringBaselineProjectionId]",
  "[\"engineeringRevisionId\", verifiedEngineeringPackage.engineeringRevisionId]",
]));
check("Engineering Certification validates Engineering Baseline authority", includesAll(certificationReadinessBlock + certificationDecorateBlock, [
  "Engineering Baseline",
  "checks.engineeringBaseline",
  "engineeringAuthority: \"ENGINEERING_BASELINE\"",
  "engineeringBaselineId",
  "engineeringBaselineHash",
  "engineeringRevisionId",
  "restoredFromEngineeringRepository: true",
]));
check("Engineering UI displays Baseline and Revision diagnostics", includesAll(sources.engineeringWorkspace, [
  "Engineering Baseline",
  "Baseline Hash",
  "Engineering Revision",
  "Engineering Authority",
  "Baseline Validation",
  "Repository References",
  "Rendered from Engineering Baseline and Engineering Package projection",
]));
check("Runtime client and repository wrapper expose Engineering Baseline API", includesAll(sources.api + sources.repositories, [
  "EngineeringBaselineRuntime",
  "listEngineeringBaselines",
  "openEngineeringBaseline",
  "saveEngineeringBaseline",
  "/api/engineering/baselines",
  "EngineeringBaselineRepository",
]));
check("Draft IOF assembly output remains free of Engineering Baseline fields", !sources.iofAssembly.includes("engineeringBaseline") &&
  !sources.iofAssembly.includes("ENGINEERING_BASELINE"));
check("Commercial Revision and Change Set repositories are unchanged by Baseline authority", !sources.commercialRevisions.includes("engineeringBaseline") &&
  !sources.commercialRevisions.includes("ENGINEERING_BASELINE") &&
  !sources.commercialChangeSets.includes("engineeringBaseline") &&
  !sources.commercialChangeSets.includes("ENGINEERING_BASELINE"));
check("ScopeVersion remains unchanged by Baseline authority", !sources.scopeversions.includes("engineeringBaseline") &&
  !sources.scopeversions.includes("ENGINEERING_BASELINE") &&
  !sources.scopeversionAuthority.includes("engineeringBaseline") &&
  !sources.scopeversionAuthority.includes("ENGINEERING_BASELINE"));
check("Pricing and Proposal generation remain unchanged by Baseline authority", !sources.pricing.includes("engineeringBaseline") &&
  !sources.pricing.includes("ENGINEERING_BASELINE") &&
  !sources.proposal.includes("engineeringBaseline") &&
  !sources.proposal.includes("ENGINEERING_BASELINE"));
check("Certified IOF Package output remains unchanged by Baseline payload fields", !certifyBlock.includes("engineeringBaselineId") &&
  !certifyBlock.includes("engineeringBaselineHash") &&
  !certifyBlock.includes("ENGINEERING_BASELINE"));
check("Doctrine and report document the authority model", includesAll(sources.doctrine + sources.report, [
  "Engineering Baseline",
  "Immutable Intake Doctrine",
  "Commercial Release Package",
  "Draft IOF Package",
  "Engineering Package",
  "Engineering Revision",
  "Certified IOF Package",
  "ScopeVersion unchanged",
  "Commercial unchanged",
  "Pricing unchanged",
]));

const failed = checks.filter((item) => !item.condition);

for (const item of checks) {
  const status = item.condition ? "PASS" : "FAIL";
  console.log(`${status} ${item.name}${item.detail ? ` - ${item.detail}` : ""}`);
}

if (failed.length) {
  console.error(`\n${failed.length} CIP-027 validation check(s) failed.`);
  process.exit(1);
}

console.log("\nCIP-027 engineering baseline authority validation passed.");
