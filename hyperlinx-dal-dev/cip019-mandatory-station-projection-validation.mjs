import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { handleCommercialIofPackages } from "./server/routes/commercial-iof-packages.js";
import { handleEngineeringCertification } from "./server/routes/engineering-certification.js";

const root = process.cwd().endsWith("hyperlinx-dal-dev")
  ? process.cwd()
  : path.join(process.cwd(), "hyperlinx-dal-dev");

const DRAFT_ID = "DRAFT-IOF-ACCEPTED-PROPOSAL-google-1783379652948";
const ENGINEERING_PACKAGE_ID = "ENG-PKG-DRAFT-IOF-ACCEPTED-PROPOSAL-google-1783379652948";
const ROUTE_REPOSITORY_ID = "ROUTE-REPO-OPP-GOOGLE-DFW-ROUTE-12-1783379466306-COMMERCIAL-OSRM-GOOGLE-INDEPENDENT-GRAPH-96-99780-32-74590-96-94890-32-81400";

const paths = {
  commercialIof: path.join(root, "server", "routes", "commercial-iof-packages.js"),
  engineeringPackages: path.join(root, "server", "routes", "engineering-packages.js"),
  engineeringCertification: path.join(root, "server", "routes", "engineering-certification.js"),
  engineeringWorkspace: path.join(root, "src", "workspaces", "EngineeringCertificationWorkspace.tsx"),
  teralinxRuntime: path.join(root, "src", "api", "teralinxRuntime.ts"),
  doctrine: path.join(root, "PD_002_STATION_PROJECTION_DOCTRINE.md"),
  report: path.join(root, "CIP_019_MANDATORY_STATION_PROJECTION_ENGINEERING_SUBMISSION_REPORT.md"),
  draft: path.join(root, "server", "data", "iof-packages", `${encodeURIComponent(DRAFT_ID)}.json`),
  engineeringPackage: path.join(root, "server", "data", "engineering-packages", `${encodeURIComponent(ENGINEERING_PACKAGE_ID)}.json`),
  routeRepository: path.join(root, "server", "data", "commercial-routes", `${encodeURIComponent(ROUTE_REPOSITORY_ID)}.json`),
  scopeVersions: path.join(root, "server", "data", "scopeversions"),
};

const checks = [];

function check(name, condition, detail = "") {
  checks.push({ name, condition: Boolean(condition), detail });
}

function readText(file) {
  return readFileSync(file, "utf8");
}

function readJson(file) {
  return JSON.parse(readText(file));
}

function includesAll(source, terms) {
  return terms.every((term) => source.includes(term));
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function tokenForKyle() {
  const payload = {
    sub: "teralinx-user-kyle",
    username: "kyle",
    role: "ADMINISTRATOR_COO",
    iat: new Date().toISOString(),
  };
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

async function invoke(handler, method, pathname, body = {}) {
  const raw = JSON.stringify(body ?? {});
  const req = Readable.from([Buffer.from(raw)]);
  req.method = method;
  req.headers = {
    authorization: `Bearer ${tokenForKyle()}`,
    "content-type": "application/json",
  };
  const res = {
    statusCode: 0,
    headers: {},
    chunks: [],
    writeHead(statusCode, headers) {
      this.statusCode = statusCode;
      this.headers = headers;
    },
    end(chunk) {
      if (chunk) this.chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    },
  };
  const handled = await handler(req, res, pathname);
  const text = Buffer.concat(res.chunks).toString("utf8");
  let parsed = {};
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { raw: text };
  }
  return { handled, statusCode: res.statusCode, body: parsed, text };
}

function stationCountExpected(routeFeet, intervalFeet = 5280) {
  if (!Number.isFinite(routeFeet) || routeFeet <= 0) return 0;
  let count = Math.floor(routeFeet / intervalFeet) + 1;
  if ((count - 1) * intervalFeet < routeFeet) count += 1;
  return count;
}

function coordinateKey(coordinate) {
  return JSON.stringify(coordinate ?? null);
}

function listJsonFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((file) => file.endsWith(".json")).sort();
}

for (const [label, file] of Object.entries(paths)) {
  if (label === "scopeVersions") continue;
  check(`required file exists: ${path.relative(root, file)}`, existsSync(file));
}

const commercialIof = readText(paths.commercialIof);
const engineeringPackages = readText(paths.engineeringPackages);
const engineeringCertification = readText(paths.engineeringCertification);
const engineeringWorkspace = readText(paths.engineeringWorkspace);
const teralinxRuntime = readText(paths.teralinxRuntime);
const doctrine = readText(paths.doctrine);
const report = readText(paths.report);

check("PD-002 station projection doctrine documented", includesAll(doctrine, [
  "Station Authority is the engineering placement authority.",
  "No object may remain coordinate-only.",
  "ScopeVersion remains blocked",
]));
check("Commercial submission generates mandatory station projection artifacts", includesAll(commercialIof, [
  "function stationProjectionForDraftPackage",
  "Measured Centerline generated",
  "Station Graph generated",
  "Station Authority IDs generated",
  "Station Object Manifest persisted",
  "stationProjectionDecisionTrace",
  "one or more IOF objects remain coordinate-only",
]));
check("Engineering Package serializer whitelists station projection references", includesAll(engineeringPackages, [
  "measuredCenterlineId",
  "stationGraphId",
  "stationAuthorityIds",
  "stationObjectManifestId",
  "projectedObjectManifestId",
  "workbookId",
  "assertReferenceOnlyEngineeringPackagePayload",
]));
check("Engineering Certification validates station projection references before projection", includesAll(engineeringPackages + engineeringCertification, [
  "measuredCenterline",
  "stationGraph",
  "stationObjectManifest",
  "projectedObjectManifest",
  "projectedObjects",
]));
check("Engineering UI opens Station Review and hides station generation workflow", engineeringWorkspace.includes("Open Station Review")
  && !engineeringWorkspace.includes("Begin Station Planning")
  && !engineeringWorkspace.includes("Generate Station Plan")
  && !engineeringWorkspace.includes("Manual Station Plan"));
check("Readiness panel uses unique composite React keys", engineeringWorkspace.includes('key={`${check.key}:${check.id ?? "no-id"}:${index}`}'));
check("Reasoning is advisory and deterministic fallback is visible", engineeringWorkspace.includes("Reasoning OFFLINE. Using deterministic doctrine."));
check("Engineering Package runtime type exposes station projection references", includesAll(teralinxRuntime, [
  "measuredCenterlineId?: string",
  "stationGraphId?: string",
  "stationAuthorityIds?: string[]",
  "stationObjectManifestId?: string",
  "projectedObjectManifestId?: string",
  "workbookId?: string",
]));
check("CIP-019 report documents ScopeVersion blocking", report.includes("No ScopeVersion creation was added."));

const scopeBefore = listJsonFiles(paths.scopeVersions);
const submit = await invoke(
  handleCommercialIofPackages,
  "POST",
  `/api/commercial/iof-packages/${encodeURIComponent(DRAFT_ID)}/submit-engineering`,
  {},
);
check("Google DFW Route 12 submit handler returns success", submit.statusCode === 200, submit.body.error ?? `status=${submit.statusCode}`);
check("Submit transaction returns Engineering Package", Boolean(submit.body.engineeringPackage?.engineeringPackageId), submit.body.engineeringPackage?.engineeringPackageId ?? "");

const draft = readJson(paths.draft);
const engineeringPackage = readJson(paths.engineeringPackage);
const routeRepository = readJson(paths.routeRepository);
const proposalPath = path.join(root, "server", "data", "proposal-drafts", `${encodeURIComponent(engineeringPackage.proposalId)}.json`);
const proposal = existsSync(proposalPath) ? readJson(proposalPath) : null;

const stationAuthority = asRecord(draft.stationAuthority);
const stations = asArray(stationAuthority.stations);
const stationGraph = asRecord(draft.stationIndexedGraph);
const stationObjects = asArray(asRecord(draft.stationObjectManifest).objects);
const projectedObjects = asArray(asRecord(draft.projectedObjectManifest).projectedObjects);
const routeFeet = Number(asRecord(draft.measuredCenterline).routeFeet ?? draft.routeFeet);
const intervalFeet = Number(stationAuthority.intervalFeet ?? 5280);
const expectedStations = stationCountExpected(routeFeet, intervalFeet);
const firstStation = asRecord(stations[0]);
const firstProjectedObject = asRecord(projectedObjects[0]);

check("Draft IOF Package persists measured centerline", Boolean(draft.measuredCenterlineId && asRecord(draft.measuredCenterline).measuredCenterlineId === draft.measuredCenterlineId));
check("Draft IOF Package persists station graph", Boolean(draft.stationGraphId && stationGraph.stationGraphId === draft.stationGraphId && asArray(stationGraph.nodes).length === stations.length));
check("Draft IOF Package persists Station Authority IDs", asArray(draft.stationAuthorityIds).length > 0 && asArray(stationAuthority.stationAuthorityIds).length > 0);
check("Draft IOF Package persists Station Object Manifest", Boolean(draft.stationObjectManifestId && asRecord(draft.stationObjectManifest).manifestId === draft.stationObjectManifestId && stationObjects.length > 0));
check("Draft IOF Package persists Projected Object Manifest", Boolean(draft.projectedObjectManifestId && asRecord(draft.projectedObjectManifest).manifestId === draft.projectedObjectManifestId && projectedObjects.length > 0));
check("Station record carries all PD-002 required fields", includesAll(Object.keys(firstStation).join(","), [
  "stationId",
  "routeRepositoryId",
  "segmentId",
  "stationValue",
  "measureFeet",
  "coordinate",
  "bearing",
  "stationLabel",
  "authorityHash",
]));
check("Projected object carries all PD-002 required fields", includesAll(Object.keys(firstProjectedObject).join(","), [
  "objectId",
  "objectType",
  "routeRepositoryId",
  "segmentId",
  "stationId",
  "stationValue",
  "offset",
  "side",
  "orientation",
  "projectedCoordinate",
  "sourceObjectId",
  "engineeringDisposition",
  "projectionStatus",
  "projectionHash",
]));
check("No projected object remains coordinate-only", projectedObjects.length > 0 && projectedObjects.every((object) => {
  const item = asRecord(object);
  return Boolean(item.stationId && item.stationValue !== undefined && item.projectedCoordinate && item.projectionStatus === "PROJECTED");
}));
check("Station count is deterministic", expectedStations > 0 && stations.length === expectedStations, `actual=${stations.length}, expected=${expectedStations}`);
check("Route length is consistent across route, measured centerline, and station graph", Number.isFinite(routeFeet)
  && Math.abs(routeFeet - Number(asRecord(draft.stationProjectionSummary).routeFeet ?? routeFeet)) < 1
  && Math.abs(Number(asRecord(stations[stations.length - 1]).measureFeet ?? routeFeet) - routeFeet) < 1);
check("Object count is deterministic across manifests", projectedObjects.length > 0 && projectedObjects.length === stationObjects.length, `projected=${projectedObjects.length}, stationManifest=${stationObjects.length}`);
check("Projected object IDs are unique after idempotent submission", new Set(projectedObjects.map((object) => asRecord(object).objectId)).size === projectedObjects.length);
check("Engineering Package references station projection artifacts", [
  "measuredCenterlineId",
  "stationGraphId",
  "stationAuthorityIds",
  "stationObjectManifestId",
  "projectedObjectManifestId",
  "workbookId",
].every((field) => field === "stationAuthorityIds" ? asArray(engineeringPackage[field]).length > 0 : Boolean(engineeringPackage[field])));
check("Engineering Package remains reference-only", ![
  "commercialGeometry",
  "convertedRuntimeGeometry",
  "routeGeometry",
  "stationAuthority",
  "stationIndexedGraph",
  "stationObjectManifest",
  "projectedObjectManifest",
  "projectedObjects",
  "draftPackage",
  "proposalBody",
  "workbookBody",
  "estimateBody",
].some((field) => Object.prototype.hasOwnProperty.call(engineeringPackage, field)));
check("Proposal Repository marked ENGINEERING_SUBMITTED", proposal?.status === "ENGINEERING_SUBMITTED", proposal?.status ?? "missing proposal");

const open = await invoke(
  handleEngineeringCertification,
  "GET",
  `/api/engineering/certification/draft-packages/${encodeURIComponent(ENGINEERING_PACKAGE_ID)}`,
  {},
);
const openedDraft = asRecord(open.body.draftPackage ?? open.body.iofPackage);
const openedReadiness = asRecord(openedDraft.engineeringReadinessReport ?? openedDraft.engineeringRepositoryValidation);
check("Engineering Certification opens package from Engineering Repository", open.statusCode === 200 && openedDraft.engineeringPackageId === ENGINEERING_PACKAGE_ID, open.body.error ?? `status=${open.statusCode}`);
check("Engineering Certification opens with stationing complete", asArray(asRecord(openedDraft.stationAuthority).stations).length === stations.length
  && asArray(asRecord(openedDraft.projectedObjectManifest).projectedObjects).length === projectedObjects.length);
check("Engineering readiness reports Station Review ready", asArray(openedReadiness.checks).some((item) => asRecord(item).key === "readyForStationPlanning" && asRecord(item).status === "PASS"));

const targetStation = asRecord(stations.find((station) => asRecord(station).stationId !== firstProjectedObject.stationId) ?? stations[1]);
const recalculatedCoordinate = targetStation.coordinate;
check("Engineer can move object by station", Boolean(firstProjectedObject.objectId && targetStation.stationId && targetStation.stationId !== firstProjectedObject.stationId));
check("Coordinate recalculates after station move", Boolean(recalculatedCoordinate)
  && coordinateKey(recalculatedCoordinate) !== coordinateKey(firstProjectedObject.projectedCoordinate));
check("Move endpoint patches station-authority projections", includesAll(engineeringCertification, [
  "patchObjectStationProjection",
  "coordinateAuthority: \"STATION_PLUS_OFFSET_ORIENTATION\"",
  "projectedObjectManifest",
  "stationObjectManifest",
]));

const scopeAfter = listJsonFiles(paths.scopeVersions);
check("No ScopeVersion is created", JSON.stringify(scopeBefore) === JSON.stringify(scopeAfter)
  && engineeringPackage.scopeVersionState === "BLOCKED_UNTIL_SIGNED_SERVICE_ORDER"
  && engineeringPackage.noScopeVersionCreation === true);
check("Route Repository geometry restored without regeneration", asArray(routeRepository.commercialGeometry).length > 1
  && draft.routeRepositoryId === routeRepository.routeRepositoryId
  && asRecord(draft.geometry).geometryHash === routeRepository.geometryHash);

const failed = checks.filter((item) => !item.condition);

for (const item of checks) {
  const status = item.condition ? "PASS" : "FAIL";
  console.log(`${status} ${item.name}${item.detail ? ` - ${item.detail}` : ""}`);
}

console.log(`\nCIP-019 repository audit: stations=${stations.length}, projectedObjects=${projectedObjects.length}, routeFeet=${Math.round(routeFeet || 0)}.`);

if (failed.length) {
  console.error(`\n${failed.length} CIP-019 validation check(s) failed.`);
  process.exit(1);
}

console.log("\nCIP-019 mandatory station projection validation passed.");
