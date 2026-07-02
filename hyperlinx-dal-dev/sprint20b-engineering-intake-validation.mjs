import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function stripJsxComments(source) {
  return source.replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
}

function functionBody(source, name, nextName) {
  const start = source.indexOf(name);
  assert(start >= 0, `${name} was not found.`);
  const end = nextName ? source.indexOf(nextName, start) : source.length;
  assert(end > start, `${name} body could not be bounded.`);
  return source.slice(start, end);
}

const files = {
  shared: "server/routes/_shared.js",
  commercialRoute: "server/routes/commercial-iof-packages.js",
  engineeringRoute: "server/routes/engineering-certification.js",
  runtimeApi: "src/api/teralinxRuntime.ts",
  googleWorkspace: "src/components/workspaces/GoogleRfpWorkspace.tsx",
  commercialPanel: "src/components/workspaces/googleRfp/CommercialReviewPanel.tsx",
  engineeringWorkspace: "src/workspaces/EngineeringCertificationWorkspace.tsx",
};

for (const [label, relativePath] of Object.entries(files)) {
  assert(existsSync(path.join(root, relativePath)), `${label} file is missing: ${relativePath}`);
}

const shared = read(files.shared);
const commercialRoute = read(files.commercialRoute);
const engineeringRoute = read(files.engineeringRoute);
const runtimeApi = read(files.runtimeApi);
const googleWorkspace = read(files.googleWorkspace);
const visibleGoogleWorkspace = stripJsxComments(googleWorkspace);
const commercialPanel = read(files.commercialPanel);
const engineeringWorkspace = read(files.engineeringWorkspace);
const certificationBody = functionBody(engineeringRoute, "async function handleCertifyPackage", "async function handleGenerateScopeVersion");

const commercialLabels = [
  "Commercial Review",
  "Customer",
  "Proposal",
  "Product",
  "Doctrine",
  "Revision",
  "Validation",
  "Commercial Readiness",
  "Engineering Readiness",
  "Completeness",
  "Estimated Confidence",
  "Save Draft",
  "Validate",
  "Preview Package",
  "Submit to Engineering",
];

for (const label of commercialLabels) {
  assert(commercialPanel.includes(label), `CommercialReviewPanel is missing '${label}'.`);
}

assert(!commercialPanel.includes("Engineering Review Queue"), "CommercialReviewPanel must not expose the Engineering Review Queue.");
assert(visibleGoogleWorkspace.includes("<CommercialReviewPanel"), "GoogleRfpWorkspace does not render CommercialReviewPanel.");
assert(!visibleGoogleWorkspace.includes("engineering-certification-queue"), "Commercial workspace still renders engineering certification queue controls.");
assert(!visibleGoogleWorkspace.includes("Handoff to Engineering"), "Commercial workspace still exposes legacy handoff copy.");

assert(shared.includes("engineeringIntakes"), "Shared runtime directories do not include Engineering Intake storage.");
assert(commercialRoute.includes("submit-engineering"), "Commercial IOF Packages route is missing submit-engineering endpoint.");
assert(commercialRoute.includes("commercialRevisionLocked"), "Commercial submit flow does not lock the commercial revision.");
assert(commercialRoute.includes('status: "SUBMITTED_TO_ENGINEERING"'), "Commercial submit flow does not set SUBMITTED_TO_ENGINEERING.");
assert(commercialRoute.includes("persistEngineeringIntakeRecord"), "Commercial submit flow does not persist an Engineering Intake record.");
assert(commercialRoute.includes("Commercial revision is locked after Engineering submission."), "Commercial save path does not guard locked submitted revisions.");

assert(runtimeApi.includes("submitDraftIofPackageToEngineering"), "Runtime API is missing submitDraftIofPackageToEngineering.");
assert(runtimeApi.includes("EngineeringIntakeRecord"), "Runtime API is missing EngineeringIntakeRecord type.");
assert(runtimeApi.includes("scopeVersion?: Record<string, unknown>"), "Certification response still requires a ScopeVersion.");

assert(engineeringRoute.includes('.filter((record) => record.status === "SUBMITTED_TO_ENGINEERING")'), "Engineering queue must load only submitted packages.");
assert(engineeringRoute.includes("openDraftPackageForEngineering"), "Engineering open transition helper is missing.");
assert(engineeringRoute.includes('status: "UNDER_ENGINEERING_REVIEW"'), "Opening a package must set UNDER_ENGINEERING_REVIEW.");
assert(engineeringRoute.includes('workflowStatus: "ENGINEERING_CERTIFICATION"'), "Opening a package must set ENGINEERING_CERTIFICATION workflow.");
assert(engineeringRoute.includes("persistEngineeringIntakeStatus(opened"), "Opening a package must update Engineering Intake status.");

assert(certificationBody.includes("persistRecord(DIRS.certifiedIofPackages"), "Certification does not persist a Certified IOF Package.");
assert(certificationBody.includes('status: "CERTIFIED"'), "Certification does not set CERTIFIED status.");
assert(certificationBody.includes("certificationDate"), "Certification date is not stored.");
assert(certificationBody.includes("doctrineStatus"), "Doctrine status is not stored on certification.");
assert(certificationBody.includes("constraintSummary"), "Constraint summary is not stored on certification.");
assert(certificationBody.includes("redlineHistory"), "Redline history is not stored on certification.");
assert(certificationBody.includes("engineeringManifest"), "Engineering manifest is not stored on certification.");
assert(certificationBody.includes("persistEngineeringIntakeStatus(frozenDraft"), "Certification does not update Engineering Intake status.");
assert(!certificationBody.includes("generateScopeVersion("), "Certification handler still generates a ScopeVersion.");
assert(!certificationBody.includes("updateRuntimeWorkspaceSession("), "Certification handler still transfers workspace authority to execution.");
assert(!certificationBody.includes("executionAuthorizationCertificate:"), "Certification response still creates/returns an execution authorization certificate.");
assert(!certificationBody.includes("scopeVersion:"), "Certification response still returns a ScopeVersion.");

assert(engineeringWorkspace.includes("Packages Awaiting Review"), "Engineering start screen does not show Packages Awaiting Review.");
assert(engineeringWorkspace.includes("OPEN"), "Engineering intake cards do not expose OPEN action/status.");
assert(!engineeringWorkspace.includes("items[0]?.packageId"), "Engineering workspace still auto-opens the first queued package.");
assert(engineeringWorkspace.includes("Certified IOF Package created; ScopeVersion not created."), "Engineering certification notice does not state that ScopeVersion is not created.");
assert(engineeringWorkspace.includes("Engineering Status"), "Engineering active header is missing Engineering Status.");
assert(engineeringWorkspace.includes("PD-001 Compliance"), "Engineering right panel does not expose PD-001 Compliance.");

console.log("SPRINT 20B Engineering Intake validation passed.");
