import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd().endsWith("hyperlinx-dal-dev")
  ? process.cwd()
  : path.join(process.cwd(), "hyperlinx-dal-dev");

const paths = {
  transitionEngine: path.join(root, "src", "state", "ObjectTransitionEngine.ts"),
  projectionEngine: path.join(root, "src", "products", "DoctrineProjectionEngine.ts"),
  draftIofAssembly: path.join(root, "src", "commercial", "IOFPackageAssemblyEngine.ts"),
  runtimeApi: path.join(root, "src", "api", "teralinxRuntime.ts"),
  sharedRoutes: path.join(root, "server", "routes", "_shared.js"),
  engineeringPackages: path.join(root, "server", "routes", "engineering-packages.js"),
  engineeringCertification: path.join(root, "server", "routes", "engineering-certification.js"),
  certificationLedger: path.join(root, "server", "routes", "certification-ledger.js"),
  scopeVersionAuthority: path.join(root, "server", "scopeversion-authority-engine.js"),
  commercialMap: path.join(root, "src", "components", "workspaces", "proposednetwork", "ProposedNetworkMapPanel.tsx"),
  commercialWorkspace: path.join(root, "src", "components", "workspaces", "GoogleRfpWorkspace.tsx"),
  engineeringProjection: path.join(root, "src", "engineering", "EngineeringCertificationProjection.ts"),
  engineeringWorkspace: path.join(root, "src", "workspaces", "EngineeringCertificationWorkspace.tsx"),
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

function check(name, condition) {
  checks.push({ name, condition: Boolean(condition) });
}

function includesAll(source, terms) {
  return terms.every((term) => source.includes(term));
}

const requiredStates = [
  "COMMERCIAL_ASSEMBLED",
  "COMMERCIAL_REVIEW",
  "COMMERCIAL_APPROVED",
  "CUSTOMER_ACCEPTED",
  "SUBMITTED_TO_ENGINEERING",
  "ENGINEERING_REVIEW",
  "ENGINEERING_CERTIFIED",
  "RETURNED_TO_COMMERCIAL",
  "SERVICE_ORDER_CREATED",
  "CUSTOMER_SIGNED",
  "SCOPEVERSION_CREATED",
  "MARKETPLACE_PROJECTED",
  "MARKETPLACE_RELEASED",
  "CONTROL_READY",
  "CONTROL_RELEASED",
  "FIELD_ASSIGNED",
  "FIELD_STARTED",
  "FIELD_INSTALLED",
  "FIELD_CLOSED",
  "AS_BUILT_VERIFIED",
  "TWIN_SYNCHRONIZED",
  "OPERATIONAL",
  "MAINTAINED",
  "MODIFIED",
  "RETIRED",
];

check("ObjectTransitionEngine declares the constitutional state machine", includesAll(sources.transitionEngine, [
  "OBJECT_TRANSITION_AUTHORITY",
  "CLOSURE_LEDGER_AUTHORITY",
  "IOF_PACKAGE_TWIN_AUTHORITY",
  "CONSTITUTIONAL_LIFECYCLE_STATES",
  "DOMAIN_AUTHORITY_MATRIX",
  ...requiredStates,
]));

check("ObjectTransitionEngine is the only state mutator and writes closure events", includesAll(sources.transitionEngine, [
  "export function transitionObjectState",
  "allowedTransitions.includes",
  "ObjectTransitionEngine rejected authority",
  "closureEventId",
  "prerequisiteResults",
  "geometryAuthorityId",
  "auditHash",
  "lastClosureEventId",
]));

check("ObjectTransitionEngine initializes objects, spans, closure ledger hooks, and twin metadata", includesAll(sources.transitionEngine, [
  "export function initializeLifecycleState",
  "currentState",
  "currentAuthority",
  "nextAuthority",
  "requiredEvidenceForNextTransition",
  "domainResponsibilityMatrix",
  "lifecycleStateMachine",
  "transitionRules",
  "auditLedgerHooks",
  "twinProjectionMetadata",
]));

check("WorkSegment / ClosureSegment model references parent span and measured centerline without independent geometry", includesAll(sources.transitionEngine, [
  "export type WorkSegment",
  "closureSegmentId",
  "parentSpanId",
  "measuredCenterlineId",
  "station range",
]) || includesAll(sources.transitionEngine, [
  "export type WorkSegment",
  "createClosureSegmentsForSpan",
  "parentSpanId",
  "measuredCenterlineId",
  "noIndependentGeometry: true",
]));

check("Projection births every object with authority, templates, sequences, and state metadata", includesAll(sources.projectionEngine, [
  "initializeLifecycleState(baseObject",
  "laborTemplate",
  "materialTemplate",
  "evidenceTemplate",
  "executionSequenceId",
  "closeSequenceId",
  "paymentSequenceId",
  "coordinateAuthority: \"MEASURED_CENTERLINE\"",
  "currentLifecycleState: \"COMMERCIAL_ASSEMBLED\"",
  "dependencyList",
]));

check("Projection births spans and closure segments from the measured centerline view", includesAll(sources.projectionEngine, [
  "derivedSpansFromProjectedObjects",
  "createClosureSegmentsForSpan",
  "renderAuthority: \"MEASURED_CENTERLINE_CLIP\"",
  "closureSegments",
  "openClosureSegments",
  "nextClosableSegment",
  "independentGeometryProhibited: true",
]));

check("Projection produces Closure Ledger, IOF Package Twin, execution graph, lifecycle graph, and commercial audit", includesAll(sources.projectionEngine, [
  "buildClosureLedger",
  "buildIofPackageTwin",
  "commercialAuditReconciliation",
  "validateConstitutionalStateGraph",
  "closureLedgerId",
  "iofPackageTwinId",
  "executionGraphId",
  "lifecycleGraphId",
  "commercialAuditReconciliation",
  "constitutionalStateValidation",
]));

check("Draft IOF assembly and runtime serialization expose state artifacts as references", includesAll(sources.draftIofAssembly, [
  "closureLedgerId",
  "iofPackageTwinId",
  "executionGraphId",
  "lifecycleGraphId",
  "commercialAuditReconciliation",
  "constitutionalStateValidation",
]) && includesAll(sources.runtimeApi, [
  "closureLedgerId",
  "iofPackageTwinId",
  "executionGraphId",
  "lifecycleGraphId",
  "workSegments",
]));

check("Reference-only artifact repository persists Closure Ledger and IOF Package Twin and strips embedded graphs", includesAll(sources.sharedRoutes, [
  "closureLedgers",
  "iofPackageTwins",
  "field: \"closureLedger\"",
  "field: \"iofPackageTwin\"",
  "delete next.workSegments",
  "delete next.commercialAuditReconciliation",
  "delete next.constitutionalStateValidation",
  "referenceOnly: true",
]));

check("Engineering Package stores and verifies constitutional state references", includesAll(sources.engineeringPackages, [
  "\"closureLedgerId\"",
  "\"iofPackageTwinId\"",
  "\"executionGraphId\"",
  "\"lifecycleGraphId\"",
  "commercialAuditStatus",
  "constitutionalStateValidationStatus",
  "closureLedger:",
  "iofPackageTwin:",
  "executionGraph:",
  "lifecycleGraph:",
  "commercialAudit:",
  "constitutionalState:",
]));

check("Engineering Certification blocks missing state authority outputs and failed audits", includesAll(sources.engineeringCertification, [
  "Constitutional state authority outputs are required",
  "Closure Ledger validation failed before Engineering certification",
  "Commercial audit reconciliation failed before Engineering certification",
  "Constitutional state authority validation failed before Engineering certification",
  "Constitutional state graph validation failed before Engineering certification",
  "closureLedgerId",
  "iofPackageTwinId",
  "executionGraphId",
  "lifecycleGraphId",
]));

check("Certification Ledger and Certified IOF Package are reference-only carriers of state authority", includesAll(sources.certificationLedger, [
  "\"closureLedgerId\"",
  "\"iofPackageTwinId\"",
  "\"executionGraphId\"",
  "\"lifecycleGraphId\"",
  "\"commercialAuditStatus\"",
  "\"constitutionalStateValidationStatus\"",
  "certifiedIofPackageProjectionOnly",
  "referenceOnly",
]));

check("ScopeVersion gate requires certified state references without changing signature authority", includesAll(sources.scopeVersionAuthority, [
  "ScopeVersion requires Closure Ledger, IOF Package Twin, Execution Graph, and Lifecycle Graph references",
  "ScopeVersion requires Commercial Audit and Constitutional State Authority validation to be PASS",
  "Closure Ledger reference is required before ScopeVersion authority",
  "IOF Package Twin reference is required before ScopeVersion authority",
  "Execution Graph reference is required before ScopeVersion authority",
  "Lifecycle Graph reference is required before ScopeVersion authority",
  "Signed Service Order reference is required before ScopeVersion authority",
]));

check("Commercial hover and click inspectors expose authority, audit, twin, templates, sequences, evidence, and dependencies", includesAll(sources.commercialMap, [
  "Current Authority",
  "Next Authority",
  "Domain Responsibility",
  "Audit Status",
  "Closure Ledger",
  "Twin Projection",
  "Labor Template",
  "Material Template",
  "Evidence Template",
  "Payment Sequence",
  "Close Sequence",
]) && includesAll(sources.commercialWorkspace, [
  "Domain Owner",
  "Closure Ledger",
  "Twin Projection",
  "Audit",
]));

check("Engineering projection and workspace expose constitutional state authority", includesAll(sources.engineeringProjection, [
  "\"constitutional state authority\"",
  "closureLedger",
  "iofPackageTwin",
  "commercialAuditReconciliation",
  "constitutionalStateValidation",
  "currentAuthority",
  "nextAuthority",
  "auditStatus",
]) && includesAll(sources.engineeringWorkspace, [
  "current authority",
  "next authority",
  "domain owner",
  "audit status",
  "closure ledger",
  "twin projection",
]));

check("No Product Doctrine quantity logic or pricing formulas were added to ObjectTransitionEngine", !/\b(pricing|price|margin|rate|quantitySummary|handholeCount|vaultCount|conduitFeet|fiberFeet)\b/i.test(sources.transitionEngine));

check("ScopeVersion behavior remains gated by signed Service Order", includesAll(sources.scopeVersionAuthority, [
  "Service Order reference is required before ScopeVersion authority.",
  "Signed Service Order reference is required before ScopeVersion authority.",
  "Customer Acceptance reference is required before ScopeVersion authority.",
]));

const failed = checks.filter((item) => !item.condition);

for (const item of checks) {
  console.log(`${item.condition ? "PASS" : "FAIL"} ${item.name}`);
}

if (failed.length) {
  console.error(`\n${failed.length} CIP-038 validation check(s) failed.`);
  process.exit(1);
}

console.log("\nCIP-038 Constitutional State Authority validation passed.");
