import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd().endsWith("hyperlinx-dal-dev")
  ? process.cwd()
  : path.join(process.cwd(), "hyperlinx-dal-dev");

const paths = {
  workspace: path.join(root, "src", "components", "workspaces", "GoogleRfpWorkspace.tsx"),
  runtimeApi: path.join(root, "src", "api", "teralinxRuntime.ts"),
  repositories: path.join(root, "src", "repositories", "commercialRepositories.ts"),
  commercialRevisionsRoute: path.join(root, "server", "routes", "commercial-revisions.js"),
  commercialIofRoute: path.join(root, "server", "routes", "commercial-iof-packages.js"),
  doctrine: path.join(root, "src", "products", "pointToPointLongHaulDoctrine.ts"),
  engineeringProjection: path.join(root, "src", "engineering", "EngineeringCertificationProjection.ts"),
  scopeVersionAuthority: path.join(root, "server", "scopeversion-authority-engine.js"),
};

for (const filePath of Object.values(paths)) {
  if (!existsSync(filePath)) {
    console.error(`FAIL missing required file: ${path.relative(root, filePath)}`);
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

const workspace = sources.workspace;
const sequencingHelper = blockBetween(workspace, "async function ensureCommercialLifecycleAuthorityForDraft", "  useEffect(() => {");
const automaticEffect = blockBetween(workspace, "  useEffect(() => {\n    let cancelled = false;", "  function handleBuildProductCommercialDesign");
const handoffChecks = blockBetween(workspace, "const commercialDashboardHandoffChecks = [", "const commercialDashboardHandoffMissing");
const lifecyclePanel = blockBetween(workspace, "commercial-lifecycle-sequencing-panel", "{commercialConstitutionalHandoffVisible");

check("Runtime API exposes Commercial Release save and Commercial Draft IOF list clients", includesAll(sources.runtimeApi, [
  "export async function saveCommercialReleasePackage",
  "/api/commercial/release-packages",
  "export async function listCommercialDraftIofPackages",
  "/api/commercial/iof-packages",
]));

check("Draft IOF reference-only save requires Commercial Revision and Release Package", includesAll(sources.runtimeApi, [
  "commercialRevisionId",
  "commercialReleasePackageId",
  "Draft IOF reference-only save blocked: missing",
]) && blockBetween(sources.runtimeApi, "const missing = [", "].filter").includes("[\"commercialReleasePackageId\", commercialReleasePackageId]"));

check("Commercial Release repository abstraction can save release packages", includesAll(sources.repositories, [
  "saveCommercialReleasePackage",
  "saveReleasePackage(record",
  "saveReleasePackage: saveCommercialReleasePackage",
]));

check("Workspace has one authority sequencing helper", includesAll(sequencingHelper, [
  "ensureCommercialLifecycleAuthorityForDraft",
  "listCommercialDraftIofPackages",
  "CommercialRevisionRepository.listRevisions",
  "CommercialReleasePackageRepository.listReleasePackages",
  "CommercialRevisionRepository.saveRevision",
  "CommercialReleasePackageRepository.saveReleasePackage",
  "restoredDraftPackage",
]));

check("Sequencing helper creates Commercial Revision before Commercial Release Package", sequencingHelper.indexOf("CommercialRevisionRepository.saveRevision") > -1 &&
  sequencingHelper.indexOf("CommercialReleasePackageRepository.saveReleasePackage") > sequencingHelper.indexOf("CommercialRevisionRepository.saveRevision"));

check("Sequencing helper restores existing Draft IOF by routeRepositoryId before assembly", includesAll(sequencingHelper, [
  "listCommercialDraftIofPackages",
  "existingDraftPackages.find",
  "String(draft.routeRepositoryId",
  "routeRepositoryIdValue",
  "restoredDraftPackage: true",
]));

check("Automatic IOF assembly waits for authority helper before Draft IOF save", automaticEffect.indexOf("ensureCommercialLifecycleAuthorityForDraft") > -1 &&
  automaticEffect.indexOf("saveCommercialDraftIofPackage") > automaticEffect.indexOf("ensureCommercialLifecycleAuthorityForDraft") &&
  automaticEffect.includes("PENDING_COMMERCIAL_AUTHORITY"));

check("Automatic assembly executes once per Route Repository and restores existing package", includesAll(automaticEffect, [
  "automaticIofAssemblyRouteRepositoryId === routeRepositoryId",
  "authority.restoredDraftPackage",
  "Automatic IOF Package Assembly restored existing package",
  "Automatic assembly skipped",
]));

check("Manual Draft IOF save and Engineering submit use same sequencing helper", workspace.match(/ensureCommercialLifecycleAuthorityForDraft/g)?.length >= 4 &&
  workspace.includes("\"MANUAL_DRAFT_IOF_SAVE\"") &&
  workspace.includes("\"COMMERCIAL_TO_ENGINEERING_HANDOFF\""));

check("Commercial handoff readiness requires actual Commercial Release Package", handoffChecks.includes("key: \"commercial-release\"") &&
  handoffChecks.includes("ok: Boolean(commercialAuthorityDiagnostics.commercialReleasePackageId)") &&
  !handoffChecks.includes("commercialReleasePackageId || displayedDraftIofPackage?.packageId"));

check("Visible Commercial Lifecycle panel reports sequencing blockers", includesAll(workspace, [
  "commercialLifecycleSequencingRows",
  "commercialLifecycleSequencingBlocker",
  "Commercial Lifecycle",
  "commercial-lifecycle-sequencing-panel",
  "Automatic IOF Assembly blocked",
  "Repair:",
]));

check("Commercial Revision and Release server authorities already exist", includesAll(sources.commercialRevisionsRoute, [
  "commercialRevisionRecordForRepository",
  "commercialReleasePackageRecordForRepository",
  "persistCommercialRevision",
  "persistCommercialReleasePackage",
  "ensureCommercialReleasePackageForDraft",
]));

check("Server Draft IOF save continues to persist reference artifacts only", includesAll(sources.commercialIofRoute, [
  "persistIofProjectionArtifacts",
  "stripIofProjectionArtifacts",
  "referenceOnlyDraftPackage",
  "PERSISTED_REFERENCE_ARTIFACTS",
]));

check("Product Doctrine behavior is untouched by sequencing validation scope", sources.doctrine.includes("POINT_TO_POINT_LONG_HAUL_DOCTRINE") &&
  !sources.doctrine.includes("CIP-035A"));

check("Engineering behavior is untouched by sequencing validation scope", sources.engineeringProjection.includes("buildEngineeringCertificationProjection") &&
  !sources.engineeringProjection.includes("CIP-035A"));

check("ScopeVersion behavior is untouched by sequencing validation scope", sources.scopeVersionAuthority.includes("Product doctrine snapshot is required.") &&
  !sources.scopeVersionAuthority.includes("CIP-035A"));

const failed = checks.filter((item) => !item.condition);

for (const item of checks) {
  console.log(`${item.condition ? "PASS" : "FAIL"} ${item.name}${item.detail ? ` - ${item.detail}` : ""}`);
}

if (failed.length) {
  console.error(`\n${failed.length} CIP-035A validation check(s) failed.`);
  process.exit(1);
}

console.log("\nCIP-035A Commercial Lifecycle Sequencing validation passed.");
