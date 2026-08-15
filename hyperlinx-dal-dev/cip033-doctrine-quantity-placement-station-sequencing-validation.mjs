import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd().endsWith("hyperlinx-dal-dev")
  ? process.cwd()
  : path.join(process.cwd(), "hyperlinx-dal-dev");

const paths = {
  engine: path.join(root, "src", "products", "DoctrineObjectInstantiationEngine.ts"),
  doctrine: path.join(root, "src", "products", "pointToPointLongHaulDoctrine.ts"),
  draftIof: path.join(root, "src", "commercial", "IOFPackageAssemblyEngine.ts"),
  teralinxApi: path.join(root, "src", "api", "teralinxRuntime.ts"),
  engineeringProjection: path.join(root, "src", "engineering", "EngineeringCertificationProjection.ts"),
  engineeringCertification: path.join(root, "server", "routes", "engineering-certification.js"),
  scopeVersionAuthority: path.join(root, "server", "scopeversion-authority-engine.js"),
  report: path.join(root, "CIP_033_DOCTRINE_QUANTITY_PLACEMENT_STATION_SEQUENCING_REPORT.md"),
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

const quantityBlock = blockBetween(sources.engine, "function buildQuantityPlacement", "function assetCount");
const stationIndexBlock = blockBetween(sources.engine, "function buildStationObjectIndex", "function buildSequencedActionObjects");
const validationBlock = blockBetween(sources.engine, "function validateManifest", "export function instantiateDoctrineObjects");
const instantiateBlock = blockBetween(sources.engine, "export function instantiateDoctrineObjects", "}\n");
const draftValidationBlock = blockBetween(sources.draftIof, "function buildValidation", "function packageReadiness");
const draftReturnBlock = blockBetween(sources.draftIof, "return {\n    packageId,", "  };\n}");
const complianceBlock = blockBetween(sources.engineeringProjection, "function buildCompliance", "function objectStyle");
const certificationBlock = blockBetween(sources.engineeringCertification, "async function handleCertifyPackage", "const timestamp = nowIso();");
const doctrinePricingBlock = blockBetween(sources.doctrine, "function buildPricingSummary", "function validationCheck");

check("DOIE reads existing Product Doctrine quantity surfaces", includesAll(quantityBlock, [
  "quantitySource: \"PRODUCT_DOCTRINE_ASSEMBLY\"",
  "handholeCount: structureQuantity(assembly, \"HANDHOLE\")",
  "vaultCount: structureQuantity(assembly, \"VAULT\")",
  "spliceCaseCount: structureQuantity(assembly, \"SPLICE\")",
  "ilaRegenCount: structureQuantity(assembly, \"ILA\") + structureQuantity(assembly, \"REGEN\")",
  "assembly.quantitySummary.conduitFeet",
  "assembly.quantitySummary.fiberFeet",
  "assembly.quantitySummary.stationCount",
  "assembly.quantitySummary.routeFeet",
  "noNewQuantityLogic: true",
]));

check("DOIE uses Product Doctrine structure assembly counts for station object placement", includesAll(sources.engine, [
  "structureQuantity(assembly, \"HANDHOLE\")",
  "structureQuantity(assembly, \"VAULT\")",
  "structureQuantity(assembly, \"SPLICE\")",
  "structureQuantity(assembly, \"ILA\") + structureQuantity(assembly, \"REGEN\")",
]));

check("station object index allocates friendly sequenced action IDs", includesAll(sources.engine, [
  "HH",
  "VAULT",
  "SPLICE",
  "ILA",
  "objectId",
  "stationAddress",
  "stationSequence",
  "parentRouteId",
  "parentSegmentId",
  "placementReason",
  "placementAuthority",
  "doctrineQuantitySource",
  "originalDoctrineStation",
  "currentEngineeringStation",
  "movementCreatesEngineeringChangeSet: true",
]));

check("DOIE sequences station objects and derives station spans", includesAll(sources.engine, [
  "DoctrineSequencedActionObject",
  "DoctrineDerivedSpan",
  "buildSequencedActionObjects",
  "buildDerivedSpans",
  "spanTypeToken",
  "SPLICE",
  "VIEW_ONLY_NOT_CLOSURE_LIMIT",
  "preservesContinuousStationClosure: true",
]));

check("DOIE attaches required linear assets to every derived span", includesAll(sources.engine, [
  "DoctrineLinearAssetSpanAttachment",
  "LINEAR_SPAN_ASSETS",
  "\"CONDUIT\"",
  "\"FIBER\"",
  "\"TRACE_WIRE\"",
  "\"WARNING_TAPE\"",
  "\"MULE_TAPE_PULL_TAPE\"",
  "buildLinearAssetSpanAttachments",
]));

check("DOIE validation enforces CIP-033 failure conditions", includesAll(validationBlock, [
  "quantityMismatchCount",
  "missingStationAddressCount",
  "sequenceGapCount",
  "duplicateObjectIdCount",
  "spanDerivationFailureCount",
  "unattachedLinearAssetCount",
  "Doctrine station object count mismatch",
  "missing station address or sequence",
  "Station object index contains duplicate object IDs",
  "Sequenced action objects exist but span derivation produced no spans",
  "is missing",
]));

check("DOIE instantiation returns CIP-033 deliverables", includesAll(instantiateBlock, [
  "quantityPlacement",
  "stationObjectIndex",
  "sequencedActionObjects",
  "derivedSpans",
  "linearAssetSpanAttachments",
  "engineeringMovementPolicy",
  "continuousStationClosure: true",
]));

check("Draft IOF validation exposes Engineering certification readiness rows", includesAll(draftValidationBlock, [
  "doctrine-station-sequencing",
  "doctrine-span-derivation",
  "doctrine-linear-asset-attachments",
  "quantityMismatchCount",
  "spanDerivationFailureCount",
  "unattachedLinearAssetCount",
]));

check("Draft IOF package exposes station sequencing deliverables", includesAll(draftReturnBlock, [
  "doctrineQuantityPlacement",
  "doctrineStationObjectIndex",
  "doctrineSequencedActionObjects",
  "doctrineDerivedSpans",
  "doctrineLinearAssetSpanAttachments",
  "doctrineEngineeringMovementPolicy",
  "doctrineContinuousStationClosure",
]));

check("API DTO can carry CIP-033 restored package fields", includesAll(sources.teralinxApi, [
  "doctrineQuantityPlacement?: unknown",
  "doctrineStationObjectIndex?: unknown[]",
  "doctrineSequencedActionObjects?: unknown[]",
  "doctrineDerivedSpans?: unknown[]",
  "doctrineLinearAssetSpanAttachments?: unknown[]",
  "doctrineEngineeringMovementPolicy?: unknown",
]));

check("Engineering Certification projection consumes and reports CIP-033 readiness", includesAll(sources.engineeringProjection, [
  "\"doctrine station sequencing\"",
  "\"doctrine span attachments\"",
  "doctrineQuantityPlacement?: Record<string, unknown>",
  "doctrineStationObjectIndex?: unknown[]",
  "doctrineSequencedActionObjects?: unknown[]",
  "doctrineDerivedSpans?: unknown[]",
  "doctrineLinearAssetSpanAttachments?: unknown[]",
]) && includesAll(complianceBlock, [
  "stationSequencingPass",
  "spanAttachmentPass",
  "Station sequencing failed",
  "Span attachment validation failed",
]));

check("server certification blocks invalid station sequencing and span attachments", includesAll(certificationBlock, [
  "Doctrine quantity placement, station sequencing, span derivation, and linear asset attachments are required before Engineering certification.",
  "Doctrine station sequencing validation failed",
  "quantityMismatchCount",
  "missingStationAddressCount",
  "sequenceGapCount",
  "duplicateObjectIdCount",
  "spanDerivationFailureCount",
  "unattachedLinearAssetCount",
]));

check("pricing formula remains in canonical Product Doctrine assembly and was not moved into DOIE", !sources.engine.includes("budgetCost") &&
  !sources.engine.includes("sellPriceIru") &&
  !sources.engine.includes("grossMarginDollars") &&
  doctrinePricingBlock.includes("budgetCost") &&
  doctrinePricingBlock.includes("sellPriceIru"));

check("ScopeVersion behavior remains untouched by CIP-033", !sources.scopeVersionAuthority.includes("doctrineStationObjectIndex") &&
  !sources.scopeVersionAuthority.includes("doctrineDerivedSpans") &&
  !sources.scopeVersionAuthority.includes("DoctrineObjectInstantiationEngine") &&
  sources.scopeVersionAuthority.includes("Product doctrine snapshot is required."));

check("CIP-033 report documents architecture and validation", includesAll(sources.report, [
  "Doctrine Quantity Placement",
  "Station Object Index",
  "Sequenced Action Object",
  "Derived Span",
  "Linear Asset Span Attachment",
  "Engineering Certification Readiness",
  "Validation Results",
]));

const failed = checks.filter((item) => !item.condition);

for (const item of checks) {
  const status = item.condition ? "PASS" : "FAIL";
  console.log(`${status} ${item.name}${item.detail ? ` - ${item.detail}` : ""}`);
}

if (failed.length) {
  console.error(`\n${failed.length} CIP-033 validation check(s) failed.`);
  process.exit(1);
}

console.log("\nCIP-033 Doctrine Quantity Placement and Station Sequencing validation passed.");
