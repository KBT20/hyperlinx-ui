import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd().endsWith("hyperlinx-dal-dev")
  ? process.cwd()
  : path.join(process.cwd(), "hyperlinx-dal-dev");

const paths = {
  shared: path.join(root, "server", "routes", "_shared.js"),
  index: path.join(root, "server", "index.js"),
  commercialRevisions: path.join(root, "server", "routes", "commercial-revisions.js"),
  proposalDrafts: path.join(root, "server", "routes", "proposal-drafts.js"),
  commercialIofPackages: path.join(root, "server", "routes", "commercial-iof-packages.js"),
  engineeringCertification: path.join(root, "server", "routes", "engineering-certification.js"),
  engineeringPackages: path.join(root, "server", "routes", "engineering-packages.js"),
  teralinxApi: path.join(root, "src", "api", "teralinxRuntime.ts"),
  repositories: path.join(root, "src", "repositories", "commercialRepositories.ts"),
  workspace: path.join(root, "src", "components", "workspaces", "GoogleRfpWorkspace.tsx"),
  scopeversions: path.join(root, "server", "routes", "scopeversions.js"),
  report: path.join(root, "CIP_025_COMMERCIAL_REVISION_AUTHORITY_REPORT.md"),
};

for (const requiredPath of Object.values(paths)) {
  if (!existsSync(requiredPath)) {
    console.error(`FAIL missing required file: ${path.relative(root, requiredPath)}`);
    process.exit(1);
  }
}

const sources = Object.fromEntries(
  Object.entries(paths).map(([key, file]) => [key, readFileSync(file, "utf8")]),
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

const saveProposalBlock = blockBetween(sources.proposalDrafts, "export async function saveProposal", "function requireUser");
const createDraftSourceBlock = blockBetween(sources.proposalDrafts, "async function handleCreateDraftIofPackage", "export async function handleProposalDrafts");
const assembleDraftBlock = blockBetween(sources.engineeringCertification, "export async function assembleDraftIofPackageFromProposal", "async function handleAssembleFromProposal");
const submitCommercialBlock = blockBetween(sources.commercialIofPackages, "async function submitCommercialDraftPackageToEngineering", "export async function handleCommercialIofPackages");
const engineeringPackageBuilderBlock = blockBetween(sources.engineeringPackages, "export function engineeringPackageRecordForRepository", "function workbookReferenceResolves");
const repositoryBrowserBlock = blockBetween(sources.workspace, "const commercialRepositoryBrowserSections", "function isCommercialWorkbookSectionOpen");

check("Commercial Revision and Release storage directories are registered", includesAll(sources.shared, [
  "commercialRevisions: path.join(DATA_ROOT, \"commercial-revisions\")",
  "commercialReleasePackages: path.join(DATA_ROOT, \"commercial-release-packages\")",
]));
check("Commercial Revision authority route is mounted", includesAll(sources.index, [
  "handleCommercialRevisionAuthority",
  "/api/commercial/revisions",
  "/api/commercial/release-packages",
  "commercialRevisions: true",
  "commercialReleasePackages: true",
]));
check("Commercial Revision serializer is explicit reference-only whitelist", includesAll(sources.commercialRevisions, [
  "ALLOWED_COMMERCIAL_REVISION_KEYS",
  "commercialRevisionRecordForRepository",
  "assertReferenceOnlyPayload",
  "repositoryTruthImmutable: true",
  "mutableWorkspaceStateAuthority: false",
  "noPricingMutation: true",
  "noProposalOutputMutation: true",
  "noWorkbookOutputMutation: true",
]) && !sources.commercialRevisions.includes("commercialGeometry") &&
  !sources.commercialRevisions.includes("routeGeometry") &&
  !sources.commercialRevisions.includes("\"pricingSummary\""));
check("Commercial Release Package serializer is explicit reference-only whitelist", includesAll(sources.commercialRevisions, [
  "ALLOWED_COMMERCIAL_RELEASE_KEYS",
  "commercialReleasePackageRecordForRepository",
  "noCommercialTruthDuplication: true",
  "immutable: true",
  "frozen: true",
  "COMMERCIAL_RELEASE_PACKAGE",
]));
check("Proposal save consumes Commercial Revision authority", includesAll(saveProposalBlock, [
  "ensureCommercialRevisionForProposal(recordWithHistory",
  "commercialRevisionId: commercialRevision.commercialRevisionId",
  "currentAuthority: \"COMMERCIAL_REVISION\"",
  "proposalAuthorityFlow",
  "inputAuthority: \"COMMERCIAL_REVISION\"",
  "proposalOutputUnchanged: true",
  "pricingOutputUnchanged: true",
  "workbookOutputUnchanged: true",
]));
check("Draft IOF source exposure consumes Commercial Revision references", includesAll(createDraftSourceBlock, [
  "ensureCommercialRevisionForProposal(record",
  "sourceType: \"COMMERCIAL_REVISION\"",
  "proposalConsumesCommercialRevision: true",
  "commercialRevisionHash: commercialRevision.revisionHash",
]));
check("Draft IOF assembly creates Commercial Release Package and preserves output", includesAll(assembleDraftBlock, [
  "ensureCommercialRevisionForProposal(proposal",
  "ensureCommercialReleasePackageForDraft",
  "assembledFrom: \"COMMERCIAL_RELEASE_PACKAGE\"",
  "draftIofAuthorityFlow",
  "draftIofOutputUnchanged: true",
  "pricingOutputUnchanged: true",
  "workbookOutputUnchanged: true",
]));
check("Commercial submit creates Release before Engineering Package", includesAll(submitCommercialBlock, [
  "ensureCommercialReleasePackageForDraft(savedDraftPackage",
  "commercialReleasePackageForSubmit",
  "currentAuthority: \"COMMERCIAL_RELEASE_PACKAGE\"",
  "buildEngineeringPackageFromDraftPackage(submitted",
]) && appearsBefore(submitCommercialBlock, "ensureCommercialReleasePackageForDraft(savedDraftPackage", "buildEngineeringPackageFromDraftPackage(submitted"));
check("Engineering Package remains reference-only and carries Release references", includesAll(engineeringPackageBuilderBlock + sources.engineeringPackages, [
  "commercialRevisionId",
  "commercialReleasePackageId",
  "commercialRevisionHash",
  "commercialReleaseHash",
  "loadCommercialReleasePackage",
  "commercialReleasePackage: Boolean(record.commercialReleasePackageId && commercialReleasePackage)",
  "referenceOnly",
  "noScopeVersionCreation",
]));
check("Runtime API and repository facades expose Commercial Revision authority", includesAll(sources.teralinxApi + sources.repositories, [
  "CommercialRevisionRuntime",
  "CommercialReleasePackageRuntime",
  "listCommercialRevisions",
  "openCommercialRevision",
  "saveCommercialRevision",
  "listCommercialReleasePackages",
  "openCommercialReleasePackage",
  "CommercialRevisionRepository",
  "CommercialReleasePackageRepository",
]));
check("Commercial UI shows authority diagnostics", includesAll(sources.workspace, [
  "commercialAuthorityDiagnostics",
  "Commercial Revision",
  "Release Package",
  "Revision Hash",
  "Release Hash",
  "Current Authority",
  "Commercial Revision Repository",
  "Commercial Release Package Repository",
]));
check("Repository Browser includes Revision and Release repositories", includesAll(repositoryBrowserBlock, [
  "server/data/commercial-revisions/*.json",
  "server/data/commercial-release-packages/*.json",
  "GET /api/commercial/revisions",
  "GET /api/commercial/release-packages",
]));
check("ScopeVersion route remains unchanged by Commercial refactor", !sources.scopeversions.includes("commercialRevisionId") &&
  !sources.scopeversions.includes("commercialReleasePackageId") &&
  sources.scopeversions.includes("Commercial cannot create ScopeVersion"));
check("Report documents required CIP-025 sections", includesAll(sources.report, [
  "Current Authority Audit",
  "Repository Authority",
  "Commercial Revision Architecture",
  "Commercial Release Package Architecture",
  "Proposal Authority Flow",
  "Draft IOF Authority Flow",
  "Constitutional Boundary Validation",
  "Engineering Compatibility Verification",
]));

const failed = checks.filter((item) => !item.condition);

for (const item of checks) {
  const status = item.condition ? "PASS" : "FAIL";
  console.log(`${status} ${item.name}${item.detail ? ` - ${item.detail}` : ""}`);
}

if (failed.length) {
  console.error(`\n${failed.length} CIP-025 commercial revision authority validation check(s) failed.`);
  process.exit(1);
}

console.log("\nCIP-025 commercial revision authority validation passed.");
