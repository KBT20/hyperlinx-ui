import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd().endsWith("hyperlinx-dal-dev")
  ? process.cwd()
  : path.join(process.cwd(), "hyperlinx-dal-dev");

const paths = {
  engine: path.join(root, "src", "products", "DoctrineObjectInstantiationEngine.ts"),
  contracts: path.join(root, "src", "products", "ProductDoctrineContracts.ts"),
  doctrine: path.join(root, "src", "products", "pointToPointLongHaulDoctrine.ts"),
  draftIof: path.join(root, "src", "commercial", "IOFPackageAssemblyEngine.ts"),
  teralinxApi: path.join(root, "src", "api", "teralinxRuntime.ts"),
  engineeringProjection: path.join(root, "src", "engineering", "EngineeringCertificationProjection.ts"),
  engineeringCertification: path.join(root, "server", "routes", "engineering-certification.js"),
  engineeringBaselines: path.join(root, "server", "routes", "engineering-baselines.js"),
  scopeVersionAuthority: path.join(root, "server", "scopeversion-authority-engine.js"),
  report: path.join(root, "CIP_032_DOCTRINE_OBJECT_INSTANTIATION_ENGINE_REPORT.md"),
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

const engineObjectBlock = blockBetween(sources.engine, "export interface DoctrineInstantiatedObject", "export interface DoctrineObjectDependencyGraph");
const addressBlock = blockBetween(sources.engine, "export interface DoctrineObjectAddress", "export interface DoctrineObjectPaymentSequence");
const instantiateBlock = blockBetween(sources.engine, "export function instantiateDoctrineObjects", "}\n");
const draftReturnBlock = blockBetween(sources.draftIof, "return {\n    packageId,", "  };\n}");
const complianceBlock = blockBetween(sources.engineeringProjection, "function buildCompliance", "function objectStyle");
const certificationBlock = blockBetween(sources.engineeringCertification, "async function handleCertifyPackage", "const timestamp = nowIso();");

check("DOIE engine exists with constitutional authority", includesAll(sources.engine, [
  "DOCTRINE_OBJECT_INSTANTIATION_ENGINE",
  "DOCTRINE_OBJECT_INSTANTIATION_VERSION = \"32.1\"",
  "instantiateDoctrineObjects",
  "ProductDoctrine",
  "ProductDoctrineAssembly",
]));
check("DOIE reads Product Doctrine sections", includesAll(instantiateBlock, [
  "productDoctrine.requiredServices",
  "productDoctrine.requiredAssets",
  "productDoctrine.engineeringObjects",
  "productDoctrine.executionSequences",
  "productDoctrine.closeSequences",
  "productDoctrine.evidenceRequirements",
  "productDoctrine.scopeVersionReadinessRequirements",
]));
check("DOIE instantiates manifest object fields required by CIP-032", includesAll(engineObjectBlock, [
  "objectId",
  "objectType",
  "productId",
  "doctrineId",
  "revision",
  "parentObjectId",
  "childObjectIds",
  "stationStart",
  "stationEnd",
  "geometry",
  "hierarchy",
  "requiredServices",
  "requiredAssets",
  "constructionMethod",
  "placementStrategy",
  "executionSequence",
  "closeSequence",
  "paymentSequence",
  "evidenceRequirements",
  "inspectionRequirements",
  "acceptanceCriteria",
  "visibilityProfile",
  "currentState",
  "authority",
]));
check("DOIE object addresses include required deterministic address fields", includesAll(addressBlock, [
  "scopeVersionCandidateId",
  "routeId",
  "segmentId",
  "stationStart",
  "stationEnd",
  "objectType",
  "objectSequence",
  "parentObjectId",
  "geometryHash",
  "jurisdiction",
  "latitude",
  "longitude",
  "stationRange",
  "addressLabel",
]));
check("DOIE builds dependency, execution, close, payment, evidence, and station lifecycle outputs", includesAll(sources.engine, [
  "DoctrineObjectDependencyGraph",
  "DoctrineObjectPaymentSequence",
  "DoctrineStationLifecycleRule",
  "dependencyGraph",
  "executionSequence",
  "closeSequence",
  "paymentSequence",
  "evidenceRequirements",
  "stationLifecycleRules",
  "marketplaceProjection",
  "controlProjection",
  "fieldProjection",
  "twinProjection",
]));
check("DOIE validation fails missing addresses and missing doctrine outputs", includesAll(sources.engine, [
  "missingAddressCount",
  "missingRequiredServiceCount",
  "missingRequiredAssetCount",
  "missingEngineeringObjectTypeCount",
  "missingPaymentSequenceCount",
  "missingCloseSequenceCount",
  "missingEvidenceRequirementCount",
  "Every Engineering Object must have a deterministic address",
]) || includesAll(sources.engine, [
  "Object ${object.objectId} is missing deterministic address.",
  "Required service ${service.serviceId} was not instantiated.",
  "Required asset ${asset.assetId} was not instantiated.",
]));
check("DOIE avoids placeholder n/a values", !sources.engine.includes("\"n/a\"") &&
  !sources.engine.includes("\"N/A\"") &&
  !sources.engine.includes("'n/a'") &&
  !sources.engine.includes("'N/A'"));
check("Draft IOF assembly invokes DOIE before Engineering Certification", includesAll(sources.draftIof, [
  "import { instantiateDoctrineObjects }",
  "const doctrineObjectInstantiation = input.productDoctrine && doctrineAssembly ? instantiateDoctrineObjects",
  "doctrineObjectInstantiation?.validation",
  "doctrineObjectManifest",
  "engineeringObjectManifest",
  "doctrineObjectDependencyGraph",
  "doctrineObjectExecutionSequence",
  "doctrineObjectCloseSequence",
  "doctrineObjectPaymentSequence",
  "doctrineStationLifecycleRules",
  "doctrineMarketplaceProjection",
  "doctrineControlProjection",
  "doctrineFieldProjection",
  "doctrineTwinProjection",
]));
check("Draft IOF output prefers doctrine-instantiated objects", draftReturnBlock.includes("objects: doctrineObjectInstantiation?.instantiatedObjects ?? packageObjects"));
check("Draft IOF validation includes DOIE checks", includesAll(sources.draftIof, [
  "doctrine-object-instantiation-engine",
  "doctrine-object-addressing",
  "doctrine-payment-close-sequences",
]));
check("API DTO exposes DOIE fields", includesAll(sources.teralinxApi, [
  "doctrineObjectInstantiation?: unknown",
  "doctrineObjectManifest?: unknown",
  "engineeringObjectManifest?: unknown",
  "doctrineObjectManifestId?: string",
  "engineeringObjectManifestId?: string",
  "doctrineInstantiatedObjects?: unknown[]",
  "doctrineObjectAddresses?: unknown[]",
  "doctrineObjectPaymentSequence?: unknown[]",
  "doctrineStationLifecycleRules?: unknown[]",
]));
check("Engineering Certification projection reads DOIE outputs", includesAll(sources.engineeringProjection, [
  "\"doctrine object manifest\"",
  "\"payment sequence\"",
  "\"station lifecycle\"",
  "doctrineObjectManifest?: Record<string, unknown>",
  "doctrineObjectInstantiationValidation?: Record<string, unknown>",
  "doctrineObjectPaymentSequence?: unknown[]",
  "doctrineStationLifecycleRules?: unknown[]",
  "doctrineObjectManifest: asRecord",
  "doctrineObjectPaymentSequence: asArray",
  "doctrineStationLifecycleRules: asArray",
]));
check("Engineering compliance fails missing DOIE manifest or addresses", includesAll(complianceBlock, [
  "Doctrine Object Instantiation Engine manifest missing",
  "address failures",
  "Doctrine payment sequence missing",
  "Doctrine station lifecycle projection missing",
]));
check("server certification blocks missing or invalid DOIE manifest", includesAll(certificationBlock, [
  "Doctrine Object Manifest is required before Engineering certification.",
  "Every Engineering Object must have a deterministic address before certification.",
  "doctrineObjectManifest",
  "doctrineObjectInstantiationValidation",
  "missingAddressCount",
]));
check("Engineering Baseline prefers DOIE manifest reference", includesAll(sources.engineeringBaselines, [
  "draft.doctrineObjectManifest ?? draft.engineeringObjectManifest",
  "draft.engineeringObjectManifestId",
  "draft.doctrineObjectManifestId",
  "doctrineObjectManifest.manifestId",
]));
check("Product Doctrine still defines all required CIP-032 inputs", includesAll(sources.doctrine, [
  "POINT_TO_POINT_LONG_HAUL_REQUIRED_SERVICES",
  "POINT_TO_POINT_LONG_HAUL_REQUIRED_ASSETS",
  "POINT_TO_POINT_LONG_HAUL_ENGINEERING_OBJECTS",
  "POINT_TO_POINT_LONG_HAUL_EXECUTION_SEQUENCES",
  "POINT_TO_POINT_LONG_HAUL_CLOSE_SEQUENCES",
  "POINT_TO_POINT_LONG_HAUL_EVIDENCE_REQUIREMENTS",
  "POINT_TO_POINT_LONG_HAUL_STATION_LIFECYCLE_PROJECTION",
]));
check("ScopeVersion authority behavior remains untouched by DOIE", !sources.scopeVersionAuthority.includes("DoctrineObjectInstantiationEngine") &&
  !sources.scopeVersionAuthority.includes("DOCTRINE_OBJECT_INSTANTIATION_ENGINE") &&
  sources.scopeVersionAuthority.includes("Product doctrine snapshot is required."));
check("CIP-032 report documents architecture and validation", includesAll(sources.report, [
  "Doctrine Object Instantiation Engine",
  "Engineering Object Manifest",
  "Object Addressing",
  "Dependency Graph",
  "Execution Sequence",
  "Close Sequence",
  "Payment Sequence",
  "Station Lifecycle",
  "Validation Results",
]));

const failed = checks.filter((item) => !item.condition);

for (const item of checks) {
  const status = item.condition ? "PASS" : "FAIL";
  console.log(`${status} ${item.name}${item.detail ? ` - ${item.detail}` : ""}`);
}

if (failed.length) {
  console.error(`\n${failed.length} CIP-032 validation check(s) failed.`);
  process.exit(1);
}

console.log("\nCIP-032 Doctrine Object Instantiation Engine validation passed.");
