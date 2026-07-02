import { readFile } from "node:fs/promises";

const files = {
  routeWorkspace: "src/workspaces/RouteEngineeringWorkspace.tsx",
  certificationWorkspace: "src/workspaces/EngineeringCertificationWorkspace.tsx",
  projection: "src/engineering/EngineeringCertificationProjection.ts",
  api: "src/api/teralinxRuntime.ts",
  server: "server/routes/engineering-certification.js",
  dalState: "src/dal/DALState.tsx",
};

const text = {};
for (const [key, path] of Object.entries(files)) {
  text[key] = await readFile(new URL(path, import.meta.url), "utf8");
}

const checks = [];

function assert(name, condition, detail = "") {
  checks.push({ name, passed: Boolean(condition), detail });
}

assert(
  "Engineering Certification consumes Draft IOF Package",
  text.certificationWorkspace.includes("openDraftIofPackageForCertification") &&
    text.certificationWorkspace.includes("selectedEngineeringDraftIofPackage") &&
    text.projection.includes("buildEngineeringCertificationProjection"),
);

assert(
  "Engineering projection does not require Commercial Corridor Draft state",
  !text.projection.includes("CommercialCorridorDraft") &&
    !text.certificationWorkspace.includes("selectedCommercialCorridorDraft"),
);

assert(
  "Engineering Canvas renders package route/spine/stations/objects",
  text.certificationWorkspace.includes("<MapKernel") &&
    text.projection.includes(":centerline") &&
    text.projection.includes(":spine") &&
    text.projection.includes("projection.stations.forEach") &&
    text.projection.includes("projection.objects.forEach"),
);

assert(
  "Sales Engineering mode is not required for certification path",
  text.routeWorkspace.includes("ENGINEERING_CERTIFICATION") &&
    text.routeWorkspace.includes("<EngineeringCertificationWorkspace />") &&
    !text.routeWorkspace.includes('setEngineeringMode("SALES_ENGINEERING")') &&
    !text.routeWorkspace.includes('setEngineeringMode("ROUTE_ENGINEERING")'),
);

assert(
  "Stations cannot be directly moved",
  text.projection.includes("stationMoveAllowed: false") &&
    !text.api.includes("moveEngineeringCertificationStation") &&
    !text.server.includes("handleMoveStation"),
);

assert(
  "Object move creates engineering revision metadata",
  text.api.includes("moveEngineeringCertificationObject") &&
    text.server.includes("objectMoveHistory") &&
    text.server.includes('revisionType: "OBJECT_MOVE"') &&
    text.server.includes("noStationGeometryMutation: true"),
);

assert(
  "Route redline creates new package revision metadata",
  text.api.includes("createEngineeringCertificationRouteRedline") &&
    text.server.includes("redlineRevisionHistory") &&
    text.server.includes('revisionType: "ROUTE_REDLINE"') &&
    text.server.includes("packageRevision: nextRevision"),
);

assert(
  "Doctrine exceptions are recorded",
  text.api.includes("recordEngineeringDoctrineException") &&
    text.server.includes("doctrineExceptions") &&
    text.server.includes("handleRecordDoctrineException"),
);

assert(
  "Certify Package creates Certified IOF Package",
  text.certificationWorkspace.includes("CERTIFY PACKAGE") &&
    text.certificationWorkspace.includes("certifyDraftIofPackage") &&
    text.server.includes("certifiedIofPackage") &&
    text.server.includes("constraintsReviewed") &&
    text.server.includes("finalEngineeringManifest") &&
    text.server.includes("readinessForScopeVersionPromotion"),
);

const outOfScopeBehaviorPatterns = [
  /createServiceOrder/i,
  /generateServiceOrder/i,
  /payment/i,
  /CustomerWorkspace/i,
  /handleControlWorkItems\s*\(/,
  /handleFieldClosures\s*\(/,
  /createMarketplaceQuote/i,
];
const sprintFiles = [text.certificationWorkspace, text.projection, text.api];
assert(
  "No Marketplace, Control, Field, Customer Workspace, payment, or Service Order behavior is added",
  !sprintFiles.some((content) => outOfScopeBehaviorPatterns.some((pattern) => pattern.test(content))),
);

const failures = checks.filter((check) => !check.passed);
for (const check of checks) {
  console.log(`${check.passed ? "PASS" : "FAIL"} ${check.name}${check.detail ? ` - ${check.detail}` : ""}`);
}

if (failures.length) {
  console.error(`\n${failures.length} Sprint 20A validation checks failed.`);
  process.exit(1);
}

console.log(`\nSprint 20A Engineering Certification Twin validation passed (${checks.length} checks).`);
