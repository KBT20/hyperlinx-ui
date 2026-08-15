import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd().endsWith("hyperlinx-dal-dev")
  ? process.cwd()
  : path.join(process.cwd(), "hyperlinx-dal-dev");

const paths = {
  ledgerRoute: path.join(root, "server", "routes", "certification-ledger.js"),
  certificationRoute: path.join(root, "server", "routes", "engineering-certification.js"),
  shared: path.join(root, "server", "routes", "_shared.js"),
  index: path.join(root, "server", "index.js"),
  api: path.join(root, "src", "api", "teralinxRuntime.ts"),
  workspace: path.join(root, "src", "workspaces", "EngineeringCertificationWorkspace.tsx"),
  commercialRevisions: path.join(root, "server", "routes", "commercial-revisions.js"),
  commercialChangeSets: path.join(root, "server", "routes", "commercial-change-sets.js"),
  commercialIofPackages: path.join(root, "server", "routes", "commercial-iof-packages.js"),
  engineeringBaselines: path.join(root, "server", "routes", "engineering-baselines.js"),
  engineeringChangeSets: path.join(root, "server", "routes", "engineering-change-sets.js"),
  scopeversions: path.join(root, "server", "routes", "scopeversions.js"),
  scopeversionAuthority: path.join(root, "server", "scopeversion-authority-engine.js"),
  marketplace: path.join(root, "server", "routes", "marketplace-quotes.js"),
  control: path.join(root, "server", "routes", "control-work-items.js"),
  field: path.join(root, "server", "routes", "field-closures.js"),
  twin: path.join(root, "server", "routes", "twin-state.js"),
  doctrine: path.join(root, "PD_007_CERTIFICATION_LEDGER_DOCTRINE.md"),
  report: path.join(root, "CIP_029_CERTIFICATION_LEDGER_IMMUTABLE_CERTIFIED_IOF_PACKAGE_REPORT.md"),
  dataDir: path.join(root, "server", "data", "certification-ledgers"),
};

for (const requiredPath of Object.values(paths)) {
  if (!existsSync(requiredPath)) {
    console.error(`FAIL missing required file: ${path.relative(root, requiredPath)}`);
    process.exit(1);
  }
}

const source = Object.fromEntries(Object.entries(paths).map(([key, filePath]) => [
  key,
  existsSync(filePath) && !filePath.endsWith("certification-ledgers")
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

const ledgerAllowedBlock = blockBetween(source.ledgerRoute, "const ALLOWED_LEDGER_KEYS", "];");
const evidenceBlock = blockBetween(source.ledgerRoute, "export function CertificationEvidenceManifest", "export function CertificationLedgerValidator");
const validatorBlock = blockBetween(source.ledgerRoute, "export function CertificationLedgerValidator", "export function certificationLedgerEntryForRepository");
const ledgerSerializerBlock = blockBetween(source.ledgerRoute, "export function certificationLedgerEntryForRepository", "export function CertificationLedgerProjection");
const packageProjectionBlock = blockBetween(source.ledgerRoute, "export function CertificationLedgerProjection", "export const CertifiedIofPackageProjection");
const certifyBlock = blockBetween(source.certificationRoute, "async function handleCertifyPackage", "async function handleGenerateScopeVersion");

const requiredLedgerFields = [
  "certificationId",
  "engineeringBaselineId",
  "engineeringRevisionId",
  "engineeringRevisionHash",
  "commercialReleasePackageId",
  "commercialRevisionId",
  "commercialRevisionHash",
  "certificationEvidenceHash",
  "certificationTimestamp",
  "certifiedBy",
  "reviewStatus",
  "engineeringDoctrineVersion",
  "commercialDoctrineVersion",
  "stationProjectionHash",
  "objectManifestHash",
  "packageHash",
  "result",
  "certifiedPackageId",
];

check("Certification Ledger storage exists", existsSync(paths.dataDir));
check("Certification Ledger route is registered", includesAll(source.shared + source.index, [
  "certificationLedgers: path.join(DATA_ROOT, \"certification-ledgers\")",
  "handleCertificationLedger",
  "/api/engineering/certification-ledger",
  "certificationLedger: true",
]));
check("Certification Ledger architecture names exist", includesAll(source.ledgerRoute, [
  "CertificationLedger",
  "CertificationLedgerEntry",
  "CertificationLedgerValidator",
  "CertificationLedgerProjection",
  "CertificationEvidenceManifest",
  "CertificationAuthority",
]));
check("ledger whitelist contains required certification fields", includesAll(ledgerAllowedBlock, requiredLedgerFields));
check("ledger validator requires immutable certification event fields", includesAll(validatorBlock, [
  "Certification Ledger missing",
  "immutable",
  "CERTIFICATION_LEDGER",
  ...requiredLedgerFields,
]));
check("Certification Evidence Manifest references all evidence categories", includesAll(evidenceBlock, [
  "stationReviewReferences",
  "objectReviewReferences",
  "doctrineValidationReferences",
  "quantityValidationReferences",
  "dependencyValidationReferences",
  "engineeringNoteReferences",
  "reviewerCommentReferences",
  "validationResultReferences",
  "evidenceHash",
  "referenceOnly: true",
]));
check("ledger serializer is immutable, append-only, and reference-only", includesAll(ledgerSerializerBlock, [
  "authority: \"CERTIFICATION_LEDGER\"",
  "repositoryType: \"CERTIFICATION_LEDGER\"",
  "immutable: true",
  "appendOnly: true",
  "referenceOnly: true",
  "certificationLedgerAuthority: true",
  "certifiedIofPackageProjectionOnly: true",
  "noScopeVersionCreation: true",
  "noServiceOrderCreation: true",
  "noRuntimePromotion: true",
]));
check("ledger rejects duplicated repository truth", includesAll(source.ledgerRoute, [
  "FORBIDDEN_LEDGER_FIELDS",
  "commercialGeometry",
  "routeGeometry",
  "stationPlan",
  "engineeringApprovedObjectBudget",
  "engineeringRevisionProjection",
  "draftIofPackage",
  "engineeringPackage",
  "scopeVersion",
  "runtimeCache",
  "contains duplicated repository truth",
]));
check("Certified IOF Package is a ledger projection", includesAll(packageProjectionBlock, [
  "sourceAuthority: \"CERTIFICATION_LEDGER\"",
  "engineeringTruthAuthority: \"CERTIFICATION_LEDGER\"",
  "certifiedPackageAuthority: \"CERTIFICATION_LEDGER_PROJECTION\"",
  "referenceOnly: true",
  "projectionOnly: true",
  "noDuplicatedRepositoryTruth: true",
  "noEmbeddedCommercialTruth: true",
  "noEmbeddedEngineeringTruth: true",
  "noScopeVersionCreation: true",
  "noServiceOrderCreation: true",
  "noRuntimePromotion: true",
]) && !packageProjectionBlock.includes("...draft"));
check("certification flow persists ledger before certified package projection", includesAll(certifyBlock, [
  "persistCertificationLedgerEntry",
  "CertifiedIofPackageProjection(certificationLedgerEntry",
  "certificationLedgerEntry",
  "certifiedPackage",
  "persistRecord(DIRS.certifiedIofPackages",
]) && certifyBlock.indexOf("persistCertificationLedgerEntry") < certifyBlock.indexOf("CertifiedIofPackageProjection(certificationLedgerEntry") &&
  certifyBlock.indexOf("CertifiedIofPackageProjection(certificationLedgerEntry") < certifyBlock.indexOf("persistRecord(DIRS.certifiedIofPackages"));
check("certified package is no longer built by spreading Draft IOF Package", !certifyBlock.includes("const certifiedPackage = {\n    ...draft"));
check("certification response returns ledger and package projection", includesAll(certifyBlock, [
  "certificationLedgerEntry,",
  "certifiedIofPackage: certifiedPackage",
]));
check("runtime API exposes Certification Ledger", includesAll(source.api, [
  "CertificationLedgerEntryRuntime",
  "listCertificationLedgerEntries",
  "openCertificationLedgerEntry",
  "/api/engineering/certification-ledger",
  "certificationLedgerEntry?: CertificationLedgerEntryRuntime",
]));
check("Engineering UI displays ledger diagnostics", includesAll(source.workspace, [
  "Certification Ledger",
  "Certification Hash",
  "Evidence Hash",
  "Certified Package Hash",
  "certification ledger id",
  "engineering revision hash",
  "commercial revision hash",
]));
check("Commercial authority files are not rewritten for Certification Ledger", !source.commercialRevisions.includes("CERTIFICATION_LEDGER") &&
  !source.commercialChangeSets.includes("CERTIFICATION_LEDGER") &&
  !source.commercialIofPackages.includes("CERTIFICATION_LEDGER"));
check("Engineering Baseline and Change Set authority remain unchanged", !source.engineeringBaselines.includes("CERTIFICATION_LEDGER") &&
  !source.engineeringChangeSets.includes("CERTIFICATION_LEDGER"));
check("ScopeVersion authority remains unchanged", !source.scopeversions.includes("CERTIFICATION_LEDGER") &&
  !source.scopeversionAuthority.includes("CERTIFICATION_LEDGER") &&
  !source.ledgerRoute.includes("createScopeVersion"));
check("Marketplace Control Field Twin remain unchanged", !source.marketplace.includes("CERTIFICATION_LEDGER") &&
  !source.control.includes("CERTIFICATION_LEDGER") &&
  !source.field.includes("CERTIFICATION_LEDGER") &&
  !source.twin.includes("CERTIFICATION_LEDGER"));
check("doctrine and report document Certification Ledger lifecycle", includesAll(source.doctrine + source.report, [
  "Certification Ledger",
  "Certified IOF Package",
  "CertificationEvidenceManifest",
  "constitutional authority",
  "evidence model",
  "repository reference model",
  "Validation Results",
]));

const failed = checks.filter((item) => !item.condition);

for (const item of checks) {
  const status = item.condition ? "PASS" : "FAIL";
  console.log(`${status} ${item.name}${item.detail ? ` - ${item.detail}` : ""}`);
}

if (failed.length) {
  console.error(`\n${failed.length} CIP-029 validation check(s) failed.`);
  process.exit(1);
}

console.log("\nCIP-029 certification ledger validation passed.");
