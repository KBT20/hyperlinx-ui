import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createScopeVersionFromCertifiedPackage,
  markCertifiedPackagePromoted,
  routeCoordinatesFromCertifiedPackage,
  validateScopeVersionAuthority,
} from "./server/scopeversion-authority-engine.js";

const root = path.dirname(fileURLToPath(import.meta.url));

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const files = {
  engine: "server/scopeversion-authority-engine.js",
  engineeringRoute: "server/routes/engineering-certification.js",
  scopeRoute: "server/routes/scopeversions.js",
  commercialRoute: "server/routes/commercial-iof-packages.js",
  workspace: "src/workspaces/ScopeVersionWorkspace.tsx",
  dalState: "src/dal/DALState.tsx",
  dalApp: "src/dal/DALApp.tsx",
  dalNav: "src/dal/DALNavigation.tsx",
  renderer: "src/mapkernel/ScopeVersionRenderer.ts",
};

Object.values(files).forEach((relativePath) => {
  assert(existsSync(path.join(root, relativePath)), `${relativePath} is missing.`);
});

const engineSource = read(files.engine);
const engineeringRoute = read(files.engineeringRoute);
const scopeRoute = read(files.scopeRoute);
const commercialRoute = read(files.commercialRoute);
const workspace = read(files.workspace);
const renderer = read(files.renderer);
const appWiring = `${read(files.dalState)}\n${read(files.dalApp)}\n${read(files.dalNav)}`;

assert(engineeringRoute.includes("../scopeversion-authority-engine.js"), "Engineering Certification must use the ScopeVersion Authority engine.");
assert(engineeringRoute.includes("generate-scopeversion"), "Engineering must expose Certified IOF Package promotion.");
assert(engineeringRoute.includes("markCertifiedPackagePromoted"), "Engineering promotion must mark the Certified IOF Package read-only.");
assert(!commercialRoute.includes("generate-scopeversion"), "Commercial routes must not generate ScopeVersions.");
assert(!commercialRoute.includes("persistScopeVersion"), "Commercial routes must not persist ScopeVersions.");
assert(scopeRoute.includes("Commercial cannot create ScopeVersion"), "ScopeVersion route must reject Commercial-created ScopeVersions.");
assert(scopeRoute.includes("cannot be overwritten"), "ScopeVersion route must reject overwrite creation.");
assert(appWiring.includes('"scopeVersion"'), "ScopeVersion workspace must be registered in DAL shell/navigation.");
assert(workspace.includes("generateScopeVersionFromCertifiedIofPackage"), "ScopeVersion workspace must promote Certified IOF Packages through Engineering.");
assert(workspace.includes("renderScopeVersion"), "ScopeVersion workspace must render from ScopeVersion canonical truth.");
assert(!workspace.includes("OSRMLateralRouter"), "ScopeVersion workspace must not invoke OSRM routing.");
assert(!workspace.includes("/api/baseline-graphs"), "ScopeVersion workspace must not depend on baseline graph discovery.");
assert(renderer.includes("geographicBasis.routeGeometry"), "ScopeVersion renderer must consume canonical route geometry.");

[
  "routeCoordinatesFromCertifiedPackage",
  "certifiedSpine",
  "certifiedStations",
  "certifiedObjects",
  "certifiedGraph",
  "downstreamReadiness",
  "SCOPEVERSION_FROM_CERTIFIED_IOF_PACKAGE",
  "SCOPEVERSION_OPERATIONAL_BASELINE",
  "markCertifiedPackagePromoted",
  "validateScopeVersionAuthority",
].forEach((symbol) => {
  assert(engineSource.includes(symbol), `ScopeVersion Authority engine is missing ${symbol}.`);
});

const geometry = Array.from({ length: 1615 }, (_, index) => [
  -97.7431 + index * 0.001,
  30.2672 + index * 0.0005,
]);

const stations = Array.from({ length: 10 }, (_, index) => ({
  stationId: `STA-${String(index).padStart(3, "0")}`,
  stationFeet: index * 5280,
  label: `${index * 52}+80`,
  coordinate: geometry[Math.round(index * (geometry.length - 1) / 9)],
}));

const objects = Array.from({ length: 17 }, (_, index) => ({
  objectId: `OBJ-${String(index + 1).padStart(3, "0")}`,
  objectType: index % 5 === 0 ? "ILA_FACILITY" : index % 3 === 0 ? "CONDUIT" : "HANDHOLE",
  stationId: stations[index % stations.length].stationId,
  quantity: 1,
  unit: "EA",
  specification: "Certified package object",
}));

const certifiedPackage = {
  certifiedPackageId: "CERT-IOF-SPRINT21-001",
  packageId: "CERT-IOF-SPRINT21-001",
  sourcePackageId: "DRAFT-IOF-SPRINT21-001",
  status: "CERTIFIED",
  workflowStatus: "CERTIFIED_IOF_PACKAGE",
  authority: "ENGINEERING_CERTIFIED_IOF_PACKAGE",
  proposalId: "PROPOSAL-SPRINT21",
  customerId: "customer-google",
  accountId: "google",
  opportunityId: "OPPORTUNITY-SPRINT21",
  productId: "PRODUCT-L1-POINT-TO-POINT-LONG-HAUL",
  productName: "Point-to-Point Long Haul Conduit & Fiber",
  doctrineId: "PD-001",
  productDoctrineVersion: "PD-001.20A",
  certifiedAt: "2026-07-02T12:00:00.000Z",
  certifiedBy: "Engineering Certifier",
  certifiedById: "engineer-001",
  engineer: "Engineering Certifier",
  engineerId: "engineer-001",
  certificationConfidence: 94,
  geometry: { type: "LineString", coordinates: geometry },
  geometryCoordinateCount: geometry.length,
  centerline: geometry,
  centerlineRoute: {
    routeId: "CENTERLINE-SPRINT21",
    routeFeet: 266270.4,
    routeMiles: 50.43,
    geometry,
  },
  spine: {
    spineId: "SPINE-SPRINT21",
    centerlineId: "CENTERLINE-SPRINT21",
    routeFeet: 266270.4,
    routeMiles: 50.43,
    geometry,
  },
  stations,
  objects,
  dependencyGraph: {
    graphId: "GRAPH-SPRINT21",
    nodes: Array.from({ length: 37 }, (_, index) => ({ id: `NODE-${index + 1}`, type: "PACKAGE_NODE" })),
    edges: Array.from({ length: 36 }, (_, index) => ({ edgeId: `EDGE-${index + 1}`, from: `NODE-${index + 1}`, to: `NODE-${index + 2}` })),
    summary: { nodeCount: 37, edgeCount: 36 },
  },
  routeSegments: [
    { segmentId: "SEG-001", geometry: geometry.slice(0, 400) },
    { segmentId: "SEG-002", geometry: geometry.slice(399, 900) },
    { segmentId: "SEG-003", geometry: geometry.slice(899) },
  ],
  quantitySummary: {
    routeFeet: 266270.4,
    routeMiles: 50.43,
    conduitFeet: 266270.4,
    fiberFeet: 266270.4,
    handholeCount: 12,
    ilaCount: 4,
  },
  engineeringConstraints: [
    { constraintId: "CONSTRAINT-ROW-001", category: "ROW", status: "ACCEPTED", severity: "MEDIUM" },
  ],
  redlineRevisionHistory: [
    { redlineId: "REDLINE-001", status: "ACCEPTED", reason: "Constructability note" },
  ],
  objectMoveHistory: [
    { moveId: "MOVE-001", objectId: "OBJ-001", status: "ACCEPTED" },
  ],
  engineeringNotes: ["Certified geometry reviewed by Engineering."],
  doctrineStatus: "PASS",
  engineeringChecklist: {
    geometryComplete: true,
    packageComplete: true,
    certificationConfidence: 94,
    engineeringNotes: "Sprint 21 certification fixture.",
  },
  validation: {
    status: "PASS",
    checks: [{ key: "geometry", status: "PASS" }],
  },
  packageReadiness: { status: "CERTIFIED_IOF_PACKAGE_READY" },
  certifiedIofUnits: objects.slice(0, 5).map((object) => ({
    unitId: `UNIT-${object.objectId}`,
    unitType: object.objectType,
    status: "CERTIFIED",
    geometryReferences: [],
    runtimeObjectIds: [object.objectId],
    dependencyIds: [],
  })),
  runtimeObjectIds: objects.map((object) => object.objectId),
  runtimeRelationshipIds: ["REL-SPRINT21-001"],
  runtimeEvidenceIds: ["EVIDENCE-SPRINT21-001"],
};

const certificate = {
  certificateId: "EXEC-AUTH-CERT-IOF-SPRINT21-001",
  engineeringApprover: "Engineering Certifier",
  engineeringApproverId: "engineer-001",
  certificationConfidence: 94,
};

const user = {
  userId: "engineer-001",
  name: "Engineering Certifier",
  organizationId: "teralinx",
  workspaceId: "engineering",
};

assert(routeCoordinatesFromCertifiedPackage(certifiedPackage).length === 1615, "Certified IOF Package geometry extraction must preserve 1,615 coordinates.");

const scopeVersion = createScopeVersionFromCertifiedPackage(certifiedPackage, {
  certificate,
  user,
  changeSummary: "Initial certified package promotion.",
  engineeringReason: "Engineering package ready for operational baseline.",
  approvedBy: "Engineering Certifier",
  approvedTimestamp: "2026-07-02T12:05:00.000Z",
});

const validation = validateScopeVersionAuthority(scopeVersion);
assert(validation.status === "PASS", `ScopeVersion authority validation failed: ${validation.failures.join(" ")}`);
assert(scopeVersion.scopeVersionId.includes("ScopeVersion-0001"), "Initial ScopeVersion must use revision label ScopeVersion-0001.");
assert(scopeVersion.isImmutable === true, "ScopeVersion must be immutable.");
assert(scopeVersion.source === "CertifiedIofPackage", "ScopeVersion source must be CertifiedIofPackage.");
assert(scopeVersion.canonicalTruth.constitutionalAuthority === "SCOPEVERSION_FROM_CERTIFIED_IOF_PACKAGE", "ScopeVersion authority must derive from Certified IOF Package.");
assert(scopeVersion.canonicalTruth.routeGeometry.length === 1615, "ScopeVersion must contain certified route geometry.");
assert(scopeVersion.canonicalTruth.certifiedGeometry.coordinates.length === 1615, "ScopeVersion must contain canonical certified LineString geometry.");
assert(scopeVersion.canonicalTruth.spine.geometry.coordinates.length === 1615, "ScopeVersion must contain certified spine geometry.");
assert(scopeVersion.canonicalTruth.stations.length === 10, "ScopeVersion must contain certified stations.");
assert(scopeVersion.canonicalTruth.graph.nodes.length === 37, "ScopeVersion must contain certified graph nodes.");
assert(scopeVersion.canonicalTruth.objects.length === 17, "ScopeVersion must contain certified objects.");
assert(scopeVersion.canonicalTruth.facilityInventory.length > 0, "ScopeVersion must contain facility inventory.");
assert(scopeVersion.canonicalTruth.constraints.length === 1, "ScopeVersion must contain constraint history.");
assert(scopeVersion.canonicalTruth.routeLength.feet === 266270.4, "ScopeVersion must contain certified route length.");
assert(scopeVersion.canonicalTruth.productDoctrine.doctrineId === "PD-001", "ScopeVersion must contain product doctrine.");
assert(scopeVersion.canonicalTruth.engineeringDoctrine.doctrineStatus === "PASS", "ScopeVersion must contain engineering doctrine.");
assert(scopeVersion.canonicalTruth.validationSnapshot.packageValidation.status === "PASS", "ScopeVersion must contain validation snapshot.");
assert(scopeVersion.canonicalTruth.digitalCertificationMetadata.assemblyFingerprint, "ScopeVersion must contain digital certification metadata.");
assert(scopeVersion.canonicalTruth.downstreamReadiness.find((item) => item.key === "engineering")?.status === "PASS", "Engineering readiness must initially PASS.");
assert(scopeVersion.canonicalTruth.downstreamReadiness.filter((item) => item.key !== "engineering").every((item) => item.status === "PENDING"), "Downstream readiness must initially be PENDING.");

const promotedPackage = markCertifiedPackagePromoted(certifiedPackage, scopeVersion, certificate);
assert(promotedPackage.engineeringCertificationLocked === true, "Certified IOF Package must become read-only after promotion.");
assert(promotedPackage.scopeVersionCreated === true, "Certified IOF Package must record ScopeVersion creation.");
assert(promotedPackage.scopeVersionId === scopeVersion.scopeVersionId, "Certified IOF Package must reference created ScopeVersion.");

const revisionScopeVersion = createScopeVersionFromCertifiedPackage(
  {
    ...certifiedPackage,
    certifiedPackageId: "CERT-IOF-SPRINT21-002",
    packageId: "CERT-IOF-SPRINT21-002",
  },
  {
    certificate: { ...certificate, certificateId: "EXEC-AUTH-CERT-IOF-SPRINT21-002" },
    user,
    previousScopeVersion: scopeVersion,
    changeSummary: "Engineering revision after approved reroute.",
    engineeringReason: "Approved Engineering revision created a new certified package.",
    approvedBy: "Engineering Certifier",
    approvedTimestamp: "2026-07-02T13:00:00.000Z",
  },
);

assert(revisionScopeVersion.scopeVersionId.includes("ScopeVersion-0002"), "Revision ScopeVersion must use revision label ScopeVersion-0002.");
assert(revisionScopeVersion.parentScopeVersionId === scopeVersion.scopeVersionId, "Revision must reference parentScopeVersionId.");
assert(revisionScopeVersion.previousRevision.scopeVersionId === scopeVersion.scopeVersionId, "Revision must preserve previousRevision.");
assert(revisionScopeVersion.changeSummary === "Engineering revision after approved reroute.", "Revision must preserve changeSummary.");
assert(revisionScopeVersion.engineeringReason === "Approved Engineering revision created a new certified package.", "Revision must preserve engineeringReason.");

console.log("Sprint 21 ScopeVersion Authority validation passed.");
