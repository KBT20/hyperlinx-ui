import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd().endsWith("hyperlinx-dal-dev")
  ? process.cwd()
  : path.join(process.cwd(), "hyperlinx-dal-dev");

const paths = {
  shared: path.join(root, "server", "routes", "_shared.js"),
  commercialIof: path.join(root, "server", "routes", "commercial-iof-packages.js"),
  engineeringCertification: path.join(root, "server", "routes", "engineering-certification.js"),
  engineeringPackages: path.join(root, "server", "routes", "engineering-packages.js"),
  engineeringBaselines: path.join(root, "server", "routes", "engineering-baselines.js"),
  certificationLedger: path.join(root, "server", "routes", "certification-ledger.js"),
  serviceOrders: path.join(root, "server", "routes", "service-orders.js"),
  scopeVersionAuthority: path.join(root, "server", "scopeversion-authority-engine.js"),
  runtimeApi: path.join(root, "src", "api", "teralinxRuntime.ts"),
  commercialWorkspace: path.join(root, "src", "components", "workspaces", "GoogleRfpWorkspace.tsx"),
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

const shared = sources.shared;
const commercialSaveBlock = blockBetween(sources.commercialIof, "if (normalizedPath === \"/api/commercial/iof-packages\" && req.method === \"POST\")", "if (normalizedPath.startsWith(\"/api/commercial/iof-packages/\")");
const commercialSubmitBlock = blockBetween(sources.commercialIof, "async function submitCommercialDraftPackageToEngineering", "export async function handleCommercialIofPackages");
const generateScopeVersionBlock = blockBetween(sources.engineeringCertification, "async function generateScopeVersion", "async function handleGenerateScopeVersion");
const serviceOrderSignatureBlock = blockBetween(sources.serviceOrders, "async function handleRecordCustomerSignature", "export async function handleServiceOrders");
const autoAssemblyBlock = blockBetween(sources.commercialWorkspace, "useEffect(() => {\n    let cancelled = false;\n    const routeRepositoryId = generatedRouteRepositorySnapshot?.routeRepositoryId", "function handleBuildProductCommercialDesign");

check("Projection artifact repositories are registered", includesAll(shared, [
  "engineeringObjectManifests",
  "stationProjections",
  "stationGraphs",
  "stationObjectManifests",
  "measuredCenterlines",
  "projectedObjectManifests",
]));

check("Shared helpers persist, strip, and hydrate IOF projection artifacts", includesAll(shared, [
  "export async function persistIofProjectionArtifacts",
  "export function stripIofProjectionArtifacts",
  "export async function hydrateIofProjectionArtifacts",
  "noEmbeddedManifests: true",
  "noEmbeddedGeometry: true",
  "noDuplicatedObjectGraphs: true",
  "ENGINEERING_OBJECT_MANIFEST",
  "STATION_PROJECTION",
  "PROJECTED_OBJECT_MANIFEST",
]));

check("Commercial Draft IOF save persists artifact truth and stores reference-only package", includesAll(commercialSaveBlock, [
  "persistIofProjectionArtifacts(draftPackage",
  "stripIofProjectionArtifacts",
  "automaticIofPackageAssembly: true",
  "repositoryAssemblyStatus: \"PERSISTED_REFERENCE_ARTIFACTS\"",
  "persistRecord(DIRS.iofPackages, referenceOnlyDraftPackage.packageId, referenceOnlyDraftPackage)",
]));

check("Commercial submit hydrates artifacts and re-strips repository record", includesAll(sources.commercialIof, [
  "const existing = existingRecord ? await hydrateIofProjectionArtifacts(existingRecord) : null",
  "persistIofProjectionArtifacts(submitted",
  "stripIofProjectionArtifacts",
  "COMMERCIAL_TO_ENGINEERING_HANDOFF",
]));

check("Engineering Baseline and Engineering Package validation hydrate Draft IOF references", includesAll(sources.engineeringBaselines, [
  "hydrateIofProjectionArtifacts",
  "const draftIofPackage = rawDraftIofPackage ? await hydrateIofProjectionArtifacts(rawDraftIofPackage) : null",
]) && includesAll(sources.engineeringPackages, [
  "hydrateIofProjectionArtifacts",
  "const draftIofPackage = rawDraftIofPackage ? await hydrateIofProjectionArtifacts(rawDraftIofPackage) : null",
]));

check("Engineering Certification loads hydrated artifacts but persists Draft IOF reference-only", includesAll(sources.engineeringCertification, [
  "hydrateIofProjectionArtifacts(await loadRecord(DIRS.iofPackages, packageId))",
  "persistIofProjectionArtifacts(next",
  "stripIofProjectionArtifacts",
  "PERSISTED_REFERENCE_ARTIFACTS",
]));

check("Generate Route triggers automatic Initial IOF Package Assembly", includesAll(autoAssemblyBlock, [
  "[CIP-035A] Commercial lifecycle sequencing started",
  "ensureCommercialLifecycleAuthorityForDraft",
  "saveCommercialDraftIofPackage",
  "automaticIofPackageAssembly: true",
  "setCommercialDraftIofPackage(draft)",
  "setActiveDraftIofPackage(draft)",
]) && includesAll(sources.commercialWorkspace, [
  "CommercialRevisionRepository.saveRevision",
  "CommercialReleasePackageRepository.saveReleasePackage",
]));

check("Service Order supports real customer signature authority", includesAll(serviceOrderSignatureBlock, [
  "SIGNED_SERVICE_ORDER",
  "CUSTOMER_SIGNED",
  "EXECUTED_SERVICE_ORDER",
  "serviceOrderSignatureId",
  "customerSignatureId",
  "executionTrigger: true",
  "scopeVersionCreationAllowed: true",
]) && sources.serviceOrders.includes("match.action === \"record-signature\""));

check("Runtime API exposes canonical customer signature client", includesAll(sources.runtimeApi, [
  "export async function recordServiceOrderCustomerSignature",
  "/api/service-orders/${encodeURIComponent(serviceOrderId)}/record-signature",
]));

check("ScopeVersion promotion resolves Certified IOF references before authority creation", includesAll(generateScopeVersionBlock, [
  "sourceDraftPackageId",
  "hydrateIofProjectionArtifacts",
  "routeRepositoryId",
  "routeRepository = routeRepositoryId ? await loadRecord(DIRS.commercialRoutes",
  "certifiedPackageForPromotion",
  "scopeVersionPromotionTrace",
  "createScopeVersionFromCertifiedPackage(certifiedPackageForPromotion",
]));

check("Certification Ledger and Certified IOF Package carry artifact references only", includesAll(sources.certificationLedger, [
  "\"measuredCenterlineId\"",
  "\"stationProjectionId\"",
  "\"stationGraphId\"",
  "\"stationAuthorityIds\"",
  "\"engineeringObjectManifestId\"",
  "\"stationObjectManifestId\"",
  "\"projectedObjectManifestId\"",
  "\"iofArtifactRepositoryReferences\"",
  "referenceOnly: true",
  "projectionOnly: true",
]));

check("Engineering Certification records artifact IDs into Certification Ledger", includesAll(sources.engineeringCertification, [
  "measuredCenterlineId,",
  "stationProjectionId,",
  "stationGraphId,",
  "stationAuthorityIds,",
  "engineeringObjectManifestId",
  "stationObjectManifestId",
  "projectedObjectManifestId",
  "iofArtifactRepositoryReferences: draft.iofArtifactRepositoryReferences",
]));

check("ScopeVersion authority reads projected stations and objects", includesAll(sources.scopeVersionAuthority, [
  "stationProjection.stations",
  "stationProjection.stationObjects",
  "stationGraph.nodes",
  "projectedObjectManifest.projectedObjects",
  "stationObjectManifest.objects",
  "createScopeVersionFromCertifiedPackage",
]));

check("ScopeVersion signed Service Order gate remains enforced", includesAll(sources.scopeVersionAuthority, [
  "ScopeVersion cannot be created before signed Service Order",
  "assertConstitutionalLayerIntegrityForScopeVersion",
  "Customer Signature readiness must be PASS",
]));

check("No downstream execution systems were introduced in CIP-035 client path", ![
  "/api/marketplace",
  "/api/control",
  "/api/field",
  "OperationalIntelligence",
].some((term) => autoAssemblyBlock.includes(term) || serviceOrderSignatureBlock.includes(term)));

check("No pricing formulas are changed by CIP-035 validation scope", ![
  "grossMargin",
  "monthlyRevenue",
  "CHANGE_PLOW_RATE",
  "pricingFormula",
].some((term) => serviceOrderSignatureBlock.includes(term) || generateScopeVersionBlock.includes(term)));

const failed = checks.filter((item) => !item.condition);

for (const item of checks) {
  console.log(`${item.condition ? "PASS" : "FAIL"} ${item.name}${item.detail ? ` - ${item.detail}` : ""}`);
}

if (failed.length) {
  console.error(`\n${failed.length} CIP-035 validation check(s) failed.`);
  process.exit(1);
}

console.log("\nCIP-035 Happy Path to ScopeVersion validation passed.");
