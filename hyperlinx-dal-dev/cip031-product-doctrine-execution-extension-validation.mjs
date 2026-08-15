import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd().endsWith("hyperlinx-dal-dev")
  ? process.cwd()
  : path.join(process.cwd(), "hyperlinx-dal-dev");

const paths = {
  contracts: path.join(root, "src", "products", "ProductDoctrineContracts.ts"),
  doctrine: path.join(root, "src", "products", "pointToPointLongHaulDoctrine.ts"),
  configurator: path.join(root, "src", "products", "PointToPointConfigurator.ts"),
  draftIof: path.join(root, "src", "commercial", "IOFPackageAssemblyEngine.ts"),
  engineeringProjection: path.join(root, "src", "engineering", "EngineeringCertificationProjection.ts"),
  teralinxApi: path.join(root, "src", "api", "teralinxRuntime.ts"),
  certificationLedger: path.join(root, "server", "routes", "certification-ledger.js"),
  engineeringCertification: path.join(root, "server", "routes", "engineering-certification.js"),
  scopeVersionAuthority: path.join(root, "server", "scopeversion-authority-engine.js"),
  doctrineDoc: path.join(root, "PD_008_PRODUCT_EXECUTION_DOCTRINE.md"),
  report: path.join(root, "CIP_031_PRODUCT_DOCTRINE_EXECUTION_EXTENSION_REPORT.md"),
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

const doctrineObjectBlock = blockBetween(
  sources.doctrine,
  "export const POINT_TO_POINT_LONG_HAUL_DOCTRINE: ProductDoctrine",
  "export interface PointToPointLongHaulDoctrineInput",
);
const assemblyReturnBlock = blockBetween(
  sources.doctrine,
  "return {\n    assemblyId,",
  "};\n}\n\nexport const PRODUCT_DOCTRINE_REGISTRY",
);
const draftReturnBlock = blockBetween(
  sources.draftIof,
  "return {\n    packageId,",
  "  };\n}",
);
const engineeringPartialBlock = blockBetween(
  sources.engineeringProjection,
  "const partial: Omit<EngineeringCertificationProjection",
  "  };\n  const compliance",
);
const certifiedProjectionBlock = blockBetween(
  sources.certificationLedger,
  "export function CertificationLedgerProjection",
  "assertReferenceOnly(projection",
);
const certifiedContextBlock = blockBetween(
  sources.engineeringCertification,
  "const certifiedPackage = CertifiedIofPackageProjection",
  "  });",
);

check("canonical doctrine still exists", includesAll(sources.doctrine, [
  "POINT_TO_POINT_LONG_HAUL_DOCTRINE_ID = \"DOCTRINE-L1-POINT-TO-POINT-LONG-HAUL-CONDUIT-FIBER\"",
  "POINT_TO_POINT_LONG_HAUL_PRODUCT_ID = \"POINT_TO_POINT_LONG_HAUL_CONDUIT_FIBER\"",
  "POINT_TO_POINT_LONG_HAUL_DOCTRINE_VERSION",
]));
check("PD-001 maps to canonical doctrine", includesAll(sources.doctrine, [
  "POINT_TO_POINT_LONG_HAUL_DOCTRINE_REGISTRY_ENTRY",
  "alias: \"PD-001\"",
  "canonicalDoctrineId: POINT_TO_POINT_LONG_HAUL_DOCTRINE_ID",
  "businessProductName: POINT_TO_POINT_LONG_HAUL_BUSINESS_PRODUCT_NAME",
  "technicalDoctrineName: POINT_TO_POINT_LONG_HAUL_TECHNICAL_DOCTRINE_NAME",
  "PRODUCT_DOCTRINE_REGISTRY",
  "resolveProductDoctrineRegistryEntry",
]));
check("contracts define complete execution doctrine vocabulary", includesAll(sources.contracts, [
  "ProductDoctrineRequiredService",
  "ProductDoctrineRequiredAsset",
  "ProductDoctrineEngineeringObjectDefinition",
  "ProductDoctrineExecutionSequence",
  "ProductDoctrineCloseSequence",
  "ProductDoctrineEvidenceRequirement",
  "ProductDoctrineCertificationRules",
  "ProductDoctrineStationLifecycleProjection",
  "ProductDoctrineScopeVersionReadinessRequirement",
  "ProductDoctrineRegistryEntry",
]));
check("canonical doctrine object carries every required section", includesAll(doctrineObjectBlock, [
  "registry: POINT_TO_POINT_LONG_HAUL_DOCTRINE_REGISTRY_ENTRY",
  "requiredServices: POINT_TO_POINT_LONG_HAUL_REQUIRED_SERVICES",
  "requiredAssets: POINT_TO_POINT_LONG_HAUL_REQUIRED_ASSETS",
  "engineeringObjects: POINT_TO_POINT_LONG_HAUL_ENGINEERING_OBJECTS",
  "executionSequences: POINT_TO_POINT_LONG_HAUL_EXECUTION_SEQUENCES",
  "closeSequences: POINT_TO_POINT_LONG_HAUL_CLOSE_SEQUENCES",
  "evidenceRequirements: POINT_TO_POINT_LONG_HAUL_EVIDENCE_REQUIREMENTS",
  "certificationRules: POINT_TO_POINT_LONG_HAUL_CERTIFICATION_RULES",
  "stationLevelLifecycleProjection: POINT_TO_POINT_LONG_HAUL_STATION_LIFECYCLE_PROJECTION",
  "scopeVersionReadinessRequirements: POINT_TO_POINT_LONG_HAUL_SCOPEVERSION_READINESS_REQUIREMENTS",
]));
check("required services are complete", includesAll(sources.doctrine, [
  "\"engineering\"",
  "\"survey\"",
  "\"permitting\"",
  "\"utility locate\"",
  "\"traffic control\"",
  "\"directional bore\"",
  "\"plowing\"",
  "\"open trench\"",
  "\"conduit placement\"",
  "\"handhole/vault placement\"",
  "\"fiber placement\"",
  "\"splicing\"",
  "\"OTDR testing\"",
  "\"restoration\"",
  "\"as-built documentation\"",
  "\"inspection\"",
]));
check("required assets are complete", includesAll(sources.doctrine, [
  "\"conduit\"",
  "\"fiber\"",
  "\"handholes\"",
  "\"vaults\"",
  "\"splice cases\"",
  "\"marker posts\"",
  "\"warning tape\"",
  "\"locate wire\"",
  "\"slack loops\"",
  "\"ILA/regeneration facilities where required\"",
  "\"LIU/termination hardware where required\"",
]));
check("engineering object types are complete", includesAll(sources.doctrine, [
  "\"SPINE\"",
  "\"ROUTE_SEGMENT\"",
  "\"STATION\"",
  "\"CONDUIT_SEGMENT\"",
  "\"FIBER_SEGMENT\"",
  "\"STRUCTURE\"",
  "\"CROSSING\"",
  "\"SPLICE_CASE\"",
  "\"ILA_REGENERATION_SITE\"",
  "\"TERMINATION_POINT\"",
  "\"EVIDENCE_OBJECT\"",
]));
check("service versus asset rule is explicit", includesAll(sources.doctrine + sources.draftIof + sources.doctrineDoc, [
  "SERVICE_NOT_ASSET",
  "Services are not assets",
  "tangibleInfrastructure: true",
  "representedInTwin: true",
]));
check("service and asset lifecycle fields are modeled", includesAll(sources.contracts + sources.doctrine, [
  "lifecycleStates",
  "prerequisiteDependencies",
  "releaseGates",
  "blockedReasons",
  "requiredEvidence",
  "acceptanceCriteria",
  "responsibleRole",
  "billableTrigger",
  "paymentTrigger",
  "capitalCashFlowTrigger",
  "twinStateTransition",
]));
check("station-level lifecycle projection includes required outputs", includesAll(sources.doctrine, [
  "POINT_TO_POINT_LONG_HAUL_STATION_LIFECYCLE_PROJECTION",
  "\"required service\"",
  "\"required asset\"",
  "\"release status\"",
  "\"blocked reason\"",
  "\"evidence required\"",
  "\"close eligibility\"",
  "\"payment eligibility\"",
  "\"Twin state transition\"",
]));
check("certification rules enforce required product doctrine contents", includesAll(sources.doctrine, [
  "POINT_TO_POINT_LONG_HAUL_CERTIFICATION_RULES",
  "\"product doctrine compliance\"",
  "\"customer technical requirements\"",
  "\"exceptions and rationale\"",
  "\"pricing\"",
  "\"margin\"",
  "\"commercial terms\"",
  "\"finance/admin reporting\"",
  "\"ScopeVersion readiness requirements\"",
  "noScopeVersionCreationBeforeSignedServiceOrder: true",
]));
check("assembly validates and returns new doctrine sections", includesAll(assemblyReturnBlock, [
  "registry: POINT_TO_POINT_LONG_HAUL_DOCTRINE_REGISTRY_ENTRY",
  "requiredServices: POINT_TO_POINT_LONG_HAUL_REQUIRED_SERVICES",
  "requiredAssets: POINT_TO_POINT_LONG_HAUL_REQUIRED_ASSETS",
  "engineeringObjects: POINT_TO_POINT_LONG_HAUL_ENGINEERING_OBJECTS",
  "executionSequences: POINT_TO_POINT_LONG_HAUL_EXECUTION_SEQUENCES",
  "closeSequences: POINT_TO_POINT_LONG_HAUL_CLOSE_SEQUENCES",
  "evidenceRequirements: POINT_TO_POINT_LONG_HAUL_EVIDENCE_REQUIREMENTS",
  "certificationRules: POINT_TO_POINT_LONG_HAUL_CERTIFICATION_RULES",
  "stationLevelLifecycleProjection: POINT_TO_POINT_LONG_HAUL_STATION_LIFECYCLE_PROJECTION",
  "scopeVersionReadinessRequirements: POINT_TO_POINT_LONG_HAUL_SCOPEVERSION_READINESS_REQUIREMENTS",
  "serviceIds:",
  "assetIds:",
  "evidenceRequirementIds:",
  "closeSequenceIds:",
  "scopeVersionReadinessRequirementIds:",
]));
check("Commercial can still consume canonical doctrine", includesAll(sources.configurator + sources.draftIof, [
  "POINT_TO_POINT_LONG_HAUL_DOCTRINE",
  "assemblePointToPointLongHaulDoctrine",
  "productDoctrine?: ProductDoctrine | null",
  "productDoctrineAssembly?: ProductDoctrineAssembly | null",
]));
check("Draft IOF carries product execution sections and close sequence references", includesAll(draftReturnBlock, [
  "productDoctrineExecution",
  "requiredServices",
  "requiredAssets",
  "productDoctrineEngineeringObjects",
  "executionSequences",
  "closeSequences",
  "closeSequenceReferences",
  "evidenceRequirements",
  "certificationRules",
  "stationLevelLifecycleProjection",
  "scopeVersionReadinessRequirements",
]));
check("Engineering Certification can read new sections", includesAll(sources.engineeringProjection + engineeringPartialBlock, [
  "productDoctrineExecution?: Record<string, unknown>",
  "closeSequenceReferences?: unknown[]",
  "scopeVersionReadinessRequirements?: unknown[]",
  "productDoctrineExecution: asRecord(loose.productDoctrineExecution)",
  "closeSequenceReferences: asArray(loose.closeSequenceReferences)",
  "scopeVersionReadinessRequirements: asArray(loose.scopeVersionReadinessRequirements)",
]));
check("Certified IOF projection can include close sequence references", includesAll(sources.certificationLedger + certifiedProjectionBlock + certifiedContextBlock, [
  "\"closeSequenceReferences\"",
  "\"evidenceRequirementReferences\"",
  "\"scopeVersionReadinessRequirementReferences\"",
  "closeSequenceReferences: asArray(context.closeSequenceReferences)",
  "evidenceRequirementReferences: asArray(context.evidenceRequirementReferences)",
  "scopeVersionReadinessRequirementReferences: asArray(context.scopeVersionReadinessRequirementReferences)",
  "closeSequenceReferences: asArray(draft.closeSequenceReferences)",
]));
check("ScopeVersion authority behavior remains decoupled from product doctrine implementation", !sources.scopeVersionAuthority.includes("pointToPointLongHaulDoctrine") &&
  !sources.scopeVersionAuthority.includes("PRODUCT_DOCTRINE_REGISTRY") &&
  !sources.scopeVersionAuthority.includes("requiredServices") &&
  sources.scopeVersionAuthority.includes("Product doctrine snapshot is required."));
check("doctrine and report deliverables document CIP-031", includesAll(sources.doctrineDoc + sources.report, [
  "PD-001",
  "DOCTRINE-L1-POINT-TO-POINT-LONG-HAUL-CONDUIT-FIBER",
  "Required Services",
  "Required Assets",
  "Engineering Objects",
  "ScopeVersion behavior was not changed",
]));

const failed = checks.filter((item) => !item.condition);

for (const item of checks) {
  const status = item.condition ? "PASS" : "FAIL";
  console.log(`${status} ${item.name}${item.detail ? ` - ${item.detail}` : ""}`);
}

if (failed.length) {
  console.error(`\n${failed.length} CIP-031 validation check(s) failed.`);
  process.exit(1);
}

console.log("\nCIP-031 product doctrine execution extension validation passed.");
