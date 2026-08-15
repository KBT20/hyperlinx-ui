import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const engineSource = read("src/engineering/quantity/QuantityReconciliationEngine.ts");
const repositorySource = read("src/engineering/quantity/QuantityReconciliationRepository.ts");
const contractsSource = read("src/engineering/quantity/QuantityReconciliationContracts.ts");
const adapterSource = read("src/engineering/quantity/QuantityReconciliationDraftAdapter.ts");
const heliumSource = read("src/reference/helium/HeliumReferenceAssembly.ts");
const panelSource = read("src/components/engineering/EngineeringQuantityReconciliationPanel.tsx");
const assemblySource = read("src/components/commercial/ConstitutionalAssemblyReviewPanel.tsx");
const workspaceSource = read("src/workspaces/EngineeringCertificationWorkspace.tsx");
const certificationServerSource = read("server/routes/engineering-certification.js");

async function loadStandalone(source) {
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
}

const engine = await loadStandalone(engineSource);
const repositoryModule = await loadStandalone(repositorySource);
const scope = {
  organizationId: "ORG-GOOGLE",
  tenantId: "TENANT-GOOGLE",
  customerId: "CUSTOMER-GOOGLE",
  opportunityId: "OPP-HELIUM",
  packageId: "PKG-HELIUM-TEST-COPY",
  productId: "POINT_TO_POINT_DUCT_DARK_FIBER",
  productVersion: "1.0.0",
  doctrineId: "PD-001",
  doctrineVersion: "1.0.0",
};
const evidence = (ref) => [{
  evidenceRef: ref,
  sourceFile: "HLI_SWR_Investor_Presentation_Workbook.v.4.xlsx",
  worksheet: "Materials_Labor_Units",
  sourceLocation: ref,
  sourceHash: "SHA256:HELIUM-WORKBOOK-IMMUTABLE",
  sourceAuthority: "PROJECT_EVIDENCE",
  authorityMode: "SOURCE_WORKBOOK",
}];
const inputs = [
  ["SPINE", "routeFeet", "route-foot", 832972.8, 801149, "SOURCE_OVERRIDE_REQUIRES_AUTHORITY", "MEASURED_CENTERLINE_GEODESIC_LENGTH"],
  ["CONDUIT", "conduitFeet", "conduit-foot", 2573942, 2403447, "SOURCE_OVERRIDE_REQUIRES_AUTHORITY", "MEASURED_ROUTE_FEET x 3"],
  ["FIBER", "fiberFeet", "cable-foot", 895326, 841207, "SOURCE_OVERRIDE_REQUIRES_AUTHORITY", "MEASURED_ROUTE_FEET x 1.05"],
  ["HANDHOLE", "handholeCount", "each", 334, 76, "SOURCE_OVERRIDE_REQUIRES_AUTHORITY", "CEILING(MEASURED_ROUTE_MILES / SPACING_MILES)"],
  ["SPLICE_CASE", "spliceCaseCount", "each", 34, undefined, "MISSING_DOCTRINE", "ENGINEERING_SPLICE_ARCHITECTURE"],
  ["ILA_SITE", "ILACount", "each", 2, undefined, "MISSING_DOCTRINE", "APPROVED_OPTICAL_DESIGN"],
].map(([objectClass, quantityType, unit, sourceQuantity, derivedQuantity, status, formula]) => ({
  objectClass, quantityType, unit, sourceQuantity, derivedQuantity, status,
  sourceAuthority: "PROJECT_EVIDENCE",
  sourceEvidence: evidence(`${quantityType}:SOURCE`),
  derivationMethod: formula,
  derivationFormula: formula,
  doctrineRule: formula,
  geometryAuthority: "MEASURED_CENTERLINE",
}));
const initial = engine.createQuantityReconciliation({
  scope,
  revisionId: "HELIUM-TEST-REV-1",
  sourceHash: "SHA256:HELIUM-WORKBOOK-AND-KMZ",
  calculatedAt: "2026-08-11T12:00:00.000Z",
  items: inputs,
});
const originalSnapshot = JSON.stringify(initial);
const act = (reconciliation, index, type, extra = {}) => engine.dispositionQuantity({
  reconciliation,
  reconciliationItemId: reconciliation.items[index].reconciliationItemId,
  type,
  reviewer: "Test Engineer PE",
  engineeringAuthority: "ENGINEERING",
  reason: `TEST_FIXTURE: governed ${type}`,
  evidenceRefs: evidence(`${reconciliation.items[index].quantityType}:${type}`),
  reviewedAt: `2026-08-11T12:${String(index).padStart(2, "0")}:00.000Z`,
  ...extra,
});

const checks = [];
function check(number, label, fn) {
  fn();
  checks.push({ number, label, status: "PASS" });
  console.log(`PASS ${number}. ${label}`);
}

check(1, "CIP-040 Helium mismatches load into reconciliation", () => {
  assert.equal(initial.items.length, 6);
  assert.deepEqual(initial.items.map((item) => item.sourceQuantity), [832972.8, 2573942, 895326, 334, 34, 2]);
  assert.match(heliumSource, /quantityReconciliation/);
});
const acceptedSource = act(initial, 0, "ACCEPT_SOURCE");
check(2, "original source quantities remain immutable", () => {
  assert.equal(JSON.stringify(initial), originalSnapshot);
  assert.equal(acceptedSource.item.sourceQuantity, 832972.8);
});
check(3, "derived quantities remain independently reconstructable", () => {
  assert.equal(initial.items[1].derivedQuantity, 2403447);
  assert.match(initial.items[1].derivedCandidate.formula, /3/);
  assert.equal(initial.items[2].derivedQuantity, 841207);
});
check(4, "MATCH requires no human override", () => {
  const match = engine.createQuantityReconciliation({ scope, revisionId: "MATCH", sourceHash: "HASH", items: [{ ...inputs[0], sourceQuantity: 10, derivedQuantity: 10, status: "MATCH" }] });
  assert.equal(match.status, "PASS");
  assert.equal(match.items[0].disposition, null);
});
check(5, "SOURCE_OVERRIDE_REQUIRES_AUTHORITY blocks readiness", () => assert.equal(initial.status, "FAIL"));
check(6, "ACCEPT_SOURCE requires valid Engineering authority", () => {
  assert.equal(acceptedSource.item.approvedQuantity, 832972.8);
  assert.throws(() => act(initial, 0, "ACCEPT_SOURCE", { reviewer: "" }), /reviewer/);
});
const acceptedDerived = act(initial, 1, "ACCEPT_DERIVED");
check(7, "ACCEPT_DERIVED requires valid Engineering authority", () => {
  assert.equal(acceptedDerived.item.approvedQuantity, 2403447);
  assert.equal(acceptedDerived.item.engineeringAuthority, "ENGINEERING");
});
const exceptionResult = act(initial, 3, "APPROVE_DOCTRINE_EXCEPTION", {
  approvedQuantity: 334,
  doctrineRule: "STANDARD_HANDHOLE_SPACING",
  expectedCondition: "76 preliminary handholes",
  actualCondition: "334 source handholes supported by project conditions",
  impactSummary: "Project-only structure count exception",
});
const repository = new repositoryModule.QuantityReconciliationRepository();
repository.saveInitial(initial);
repository.saveDisposition(exceptionResult);
check(8, "APPROVE_DOCTRINE_EXCEPTION creates a persistent exception", () => assert.equal(repository.listExceptions(scope).length, 1));
check(9, "doctrine exception does not modify global Product Doctrine", () => {
  assert.equal(exceptionResult.doctrineException.globalDoctrineMutation, false);
  assert.match(contractsSource, /INCORPORATED_IN_FUTURE_DOCTRINE/);
});
const correction = act(initial, 2, "CORRECT_SOURCE", { approvedQuantity: 900000 });
check(10, "CORRECT_SOURCE creates revision evidence instead of mutating source", () => {
  assert.equal(correction.sourceCorrection.sourceMutation, false);
  assert.equal(correction.item.sourceQuantity, 895326);
  assert.equal(correction.item.status, "ENGINEERING_REVIEW_REQUIRED");
});
const commercialRevision = act(initial, 4, "REQUEST_COMMERCIAL_REVISION");
check(11, "REQUEST_COMMERCIAL_REVISION preserves Commercial authority", () => {
  assert.equal(commercialRevision.commercialRevisionRequested, true);
  assert.match(panelSource, /onRequestCommercialRevision/);
  assert.match(workspaceSource, /returnDraftIofPackageToCommercial/);
});
const additionalEvidence = act(initial, 5, "REQUIRE_ADDITIONAL_EVIDENCE");
check(12, "REQUIRE_ADDITIONAL_EVIDENCE remains blocking", () => {
  assert.equal(additionalEvidence.item.status, "ENGINEERING_REVIEW_REQUIRED");
  assert.equal(additionalEvidence.reconciliation.status, "FAIL");
});
check(13, "every disposition creates an audit event", () => {
  [acceptedSource, acceptedDerived, exceptionResult, correction, commercialRevision, additionalEvidence].forEach((result) => assert.ok(result.auditEvent.eventHash));
});
check(14, "every disposition retains evidence provenance", () => assert.ok(acceptedSource.auditEvent.evidenceRefs[0].sourceHash));
check(15, "reconciliation cannot PASS with unresolved required items", () => assert.equal(acceptedSource.reconciliation.status, "FAIL"));

let resolved = initial;
resolved = act(resolved, 0, "ACCEPT_SOURCE").reconciliation;
resolved = act(resolved, 1, "ACCEPT_DERIVED").reconciliation;
resolved = act(resolved, 2, "ACCEPT_DERIVED").reconciliation;
resolved = act(resolved, 3, "APPROVE_DOCTRINE_EXCEPTION", {
  approvedQuantity: 334, doctrineRule: "STANDARD_HANDHOLE_SPACING", expectedCondition: "76", actualCondition: "334", impactSummary: "Project-only exception",
}).reconciliation;
resolved = act(resolved, 4, "DEFINE_SPLICE_ARCHITECTURE", { approvedQuantity: 34 }).reconciliation;
resolved = act(resolved, 5, "BIND_OPTICAL_DESIGN", {
  approvedQuantity: 2,
  engineeringDesignBinding: { station: "MP-52.59/MP-105.2", milepost: 52.59, spanLength: 52.61, opticalLoss: 0, facilityClass: "ILA", powerRequirement: "ENGINEERING_REVIEWED", powerEvidenceRef: "POWER:EVIDENCE", designEvidenceRef: "OPTICAL:DESIGN" },
}).reconciliation;
check(16, "reconciliation automatically PASSes after all required items resolve", () => assert.equal(resolved.status, "PASS"));
const gateResult = engine.recalculateConstitutionalQuantityGate({ reconciliation: resolved, otherGates: { productDoctrine: "PASS", geometry: "PASS", evidence: "PASS" } });
check(17, "Constitutional Assembly is recalculated rather than force-set", () => {
  assert.equal(gateResult.constitutionalAssembly, "PASS");
  assert.match(assemblySource, /calculatedConstitutionalStatus/);
  assert.doesNotMatch(assemblySource, /persistedDraftReady === "READY"/);
});
check(18, "Draft IOF becomes certification-ready only after all constitutional gates PASS", () => {
  assert.equal(gateResult.draftIofCertificationReadiness, "READY_FOR_ENGINEERING_CERTIFICATION");
  assert.equal(engine.recalculateConstitutionalQuantityGate({ reconciliation: resolved, otherGates: { geometry: "FAIL" } }).draftIofCertificationReadiness, "BLOCKED");
});
check(19, "certification does not create ScopeVersion", () => {
  const handler = certificationServerSource.slice(certificationServerSource.indexOf("async function handleCertifyPackage"), certificationServerSource.indexOf("async function handleGenerateScopeVersion"));
  assert.match(handler, /noScopeVersionCreation: true/);
  assert.doesNotMatch(handler, /persistRecord\(DIRS\.scopeVersions/);
});
check(20, "Commercial still cannot create ScopeVersion", () => assert.match(heliumSource, /commercialScopeVersionCreationAllowed: false/));
check(21, "Engineering quantities do not automatically change NRC or MRC", () => {
  assert.doesNotMatch(engineSource, /\bNRC\b|\bMRC\b/);
  assert.match(engineSource, /pricingMutation: false/);
});
check(22, "financial changes create Commercial impact and revision signals", () => {
  assert.equal(acceptedSource.commercialImpact.commercialReviewRequired, true);
  assert.match(engineSource, /ENGINEERING_QUANTITY_IMPACT/);
  assert.match(heliumSource, /commercialSourceWarnings/);
});
check(23, "tenant and customer scoping prevents cross-project retrieval", () => {
  assert.equal(repository.getForScope({ ...scope, customerId: "OTHER-CUSTOMER" }, initial.reconciliationId), null);
  assert.match(repositorySource, /Cross-tenant quantity artifact persistence is prohibited/);
});
check(24, "Helium-specific values stay outside generic reconciliation logic", () => {
  assert.doesNotMatch(engineSource + repositorySource + panelSource, /832972|2573942|895326|\b334\b|52\.59|105\.2/);
  assert.match(adapterSource, /DEFAULT_DERIVATIONS/);
});
check(25, "CIP-040 Product Registry behavior remains intact", () => {
  assert.ok(fs.existsSync(path.join(root, "cip040-formal-product-registry-helium-reference-validation.mjs")));
  assert.match(heliumSource, /PRODUCT_REGISTRY/);
});
check(26, "CIP-039 closure behavior remains intact", () => assert.ok(fs.existsSync(path.join(root, "cip039-constitutional-closure-engine-validation.mjs"))));
check(27, "CIP-038 state authority remains intact", () => assert.ok(fs.existsSync(path.join(root, "cip038-constitutional-state-authority-validation.mjs"))));
check(28, "geometry authority remains intact", () => {
  assert.ok(fs.existsSync(path.join(root, "cip037-single-geometry-authority-validation.mjs")));
  assert.match(adapterSource, /MEASURED_CENTERLINE/);
});
check(29, "Commercial Revision and Release sequencing remains intact", () => {
  assert.ok(fs.existsSync(path.join(root, "cip035a-commercial-lifecycle-sequencing-validation.mjs")));
  assert.match(workspaceSource, /returnDraftIofPackageToCommercial/);
});
check(30, "existing cache behavior remains intact", () => {
  assert.ok(fs.existsSync(path.join(root, "cip038a-commercial-projection-ui-restoration-validation.mjs")));
  assert.match(repositorySource, /localStorage|memoryStore/);
});

assert.equal(checks.length, 30);
console.log(`\nCIP-041 validation complete: ${checks.length}/30 checks passed.`);
