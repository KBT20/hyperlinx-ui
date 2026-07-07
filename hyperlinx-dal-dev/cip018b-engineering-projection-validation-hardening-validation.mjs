import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd().endsWith("hyperlinx-dal-dev")
  ? process.cwd()
  : path.join(process.cwd(), "hyperlinx-dal-dev");

const paths = {
  projection: path.join(root, "src", "engineering", "EngineeringCertificationProjection.ts"),
  workspace: path.join(root, "src", "workspaces", "EngineeringCertificationWorkspace.tsx"),
  scopeLifecycle: path.join(root, "src", "scopeversion", "ScopeVersionLifecycleGuard.ts"),
  scopeFactory: path.join(root, "src", "scopeversion", "ScopeVersionObjectFactory.ts"),
  engineeringPackage: path.join(root, "server", "data", "engineering-packages", "ENG-PKG-DRAFT-IOF-ACCEPTED-PROPOSAL-google-1783379652948.json"),
  report: path.join(root, "CIP_018B_ENGINEERING_PROJECTION_VALIDATION_HARDENING_REPORT.md"),
};

for (const requiredPath of Object.values(paths)) {
  if (!existsSync(requiredPath)) {
    console.error(`FAIL missing required file: ${path.relative(root, requiredPath)}`);
    process.exit(1);
  }
}

const projection = readFileSync(paths.projection, "utf8");
const workspace = readFileSync(paths.workspace, "utf8");
const scopeLifecycle = readFileSync(paths.scopeLifecycle, "utf8");
const scopeFactory = readFileSync(paths.scopeFactory, "utf8");
const report = readFileSync(paths.report, "utf8");
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

const objectTypeBlock = blockBetween(projection, "function objectTypeFor", "function objectIdFor");
const addressLayerBlock = blockBetween(projection, "function objectAddressLayer", "function objectAddressStyle");
const addressPrimitiveBlock = blockBetween(projection, "function objectAddressingPrimitives", "function spineObjectLayer");
const spineLayerBlock = blockBetween(projection, "function spineObjectLayer", "function spineObjectStyle");
const spinePrimitiveBlock = blockBetween(projection, "function instantiatedSpineObjectPrimitives", "function draftIofRouteFeature");
const buildProjectionBlock = blockBetween(projection, "export function buildEngineeringCertificationProjection", "export function canMoveEngineeringObjectToStation");
const workspaceProjectionBlock = blockBetween(workspace, "function projectionWarningsFromProjector", "function uniqueProjectionWarnings");
const lifecycleNormalizeBlock = blockBetween(scopeLifecycle, "export function normalizeLifecycleState", "export function getAuthoritativeLifecycleState");
const factoryAttachmentBlock = blockBetween(scopeFactory, "function attachmentModeFromSource", "function referenceTypeFor");

check("projection defines deterministic validation warnings", includesAll(projection, [
  "export interface EngineeringProjectionValidationWarning",
  "projectionValidationWarnings",
  "Projection Validation missing required property",
  "Default applied:",
  "Projection continued with warnings.",
]));
check("projection string normalizers guard uppercase and labels", includesAll(projection, [
  "function normalizedProjectionString",
  "function normalizedProjectionUpper",
  "function requiredProjectionString",
  "function requiredProjectionUpper",
  "function projectionLabel",
]));
check("package object type validation defaults before projection", includesAll(objectTypeBlock, [
  "requiredProjectionUpper",
  "ENGINEERING_OBJECT",
  "engineeringPackage.objects",
  "objectType",
]) && !objectTypeBlock.includes("record.objectType.toUpperCase"));
check("object address layer no longer calls uppercase on raw fields", includesAll(addressLayerBlock, [
  "objectType: unknown",
  "addressType: unknown",
  "requiredProjectionUpper",
  "normalizedProjectionUpper",
]) && !addressLayerBlock.includes("objectType.toUpperCase") && !addressLayerBlock.includes("addressType.toUpperCase"));
check("object address projector validates required properties", includesAll(addressPrimitiveBlock, [
  "engineeringPackage.objectAddresses",
  "address.objectType",
  "address.addressType",
  "requiredProjectionString",
  "normalizedAddressType",
  "projectionLabel(objectType",
]));
check("addressed review objects validate review type", includesAll(addressPrimitiveBlock, [
  "engineeringPackage.addressedReviewObjects",
  "reviewObject.reviewType",
  "UNASSIGNED_REVIEW",
  "projectionLabel(reviewType",
]));
check("spine layer no longer calls uppercase on raw fields", includesAll(spineLayerBlock, [
  "objectType: unknown",
  "objectClass: unknown",
  "reviewStatus: unknown",
  "requiredProjectionUpper",
  "normalizedProjectionUpper",
]) && !spineLayerBlock.includes("objectType.toUpperCase") && !spineLayerBlock.includes("objectClass.toUpperCase"));
check("instantiated spine object projector validates required properties", includesAll(spinePrimitiveBlock, [
  "engineeringPackage.instantiatedSpineObjects",
  "object.objectType",
  "object.objectClass",
  "requiredProjectionString",
  "projectionLabel(objectType",
]));
check("projection carries warnings through final projection", includesAll(buildProjectionBlock, [
  "const projectionValidationWarnings",
  "normalizeObjects(draft, stations, projectionValidationWarnings)",
  "projectionValidationStatus",
  "projectionValidationWarnings",
  "projectionValidationWarnings.length ? \"WARNING\" : \"PASS\"",
]));
check("Engineering UI renders projector warnings", includesAll(workspaceProjectionBlock, [
  "projectionValidationWarnings",
  "Default applied:",
  "Projection Validation",
]) && workspace.includes("...projectionWarningsFromProjector(projection)"));
check("unsafe Engineering projection uppercase calls were removed", !projection.includes("objectType.toUpperCase()") &&
  !projection.includes("objectClass.toUpperCase()") &&
  !projection.includes("addressType.toUpperCase()") &&
  !projection.includes("reviewStatus.toUpperCase()"));
check("ScopeVersion lifecycle uppercase is guarded", lifecycleNormalizeBlock.includes("if (typeof state !== \"string\") return undefined;") &&
  lifecycleNormalizeBlock.includes("const upper = state.toUpperCase();"));
check("ScopeVersion object factory uppercase uses String fallback", factoryAttachmentBlock.includes("String(sourceObjectType ?? \"\").toUpperCase();"));
check("Google DFW Route 12 Engineering Package exists", existsSync(paths.engineeringPackage));
check("report documents root cause and validation", includesAll(report, [
  "Root Cause",
  "Unsafe Calls Located",
  "Validator Repair",
  "Projector Repair",
  "Validation Results",
]));

for (const item of checks) {
  const status = item.condition ? "PASS" : "FAIL";
  console.log(`${status} ${item.name}${item.detail ? ` - ${item.detail}` : ""}`);
}

const failed = checks.filter((item) => !item.condition);
if (failed.length) {
  console.error(`\n${failed.length} CIP-018B projection hardening validation check(s) failed.`);
  process.exit(1);
}

console.log("\nCIP-018B engineering projection validation hardening passed.");
