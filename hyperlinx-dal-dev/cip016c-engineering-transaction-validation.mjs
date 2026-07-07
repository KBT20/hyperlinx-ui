import { Buffer } from "node:buffer";
import { existsSync, readFileSync } from "node:fs";
import { Readable } from "node:stream";
import path from "node:path";
import {
  DIRS,
  deleteRecord,
  loadRecord,
  persistRecord,
} from "./server/routes/_shared.js";
import { ALPHA_USERS } from "./server/routes/auth.js";
import { handleCommercialIofPackages } from "./server/routes/commercial-iof-packages.js";
import { handleEngineeringPackages, engineeringPackageRecordForRepository } from "./server/routes/engineering-packages.js";
import { listReviewQueue } from "./server/routes/engineering-certification.js";

const root = process.cwd().endsWith("hyperlinx-dal-dev")
  ? process.cwd()
  : path.join(process.cwd(), "hyperlinx-dal-dev");

const paths = {
  api: path.join(root, "src", "api", "teralinxRuntime.ts"),
  workspace: path.join(root, "src", "components", "workspaces", "GoogleRfpWorkspace.tsx"),
  commercialIof: path.join(root, "server", "routes", "commercial-iof-packages.js"),
  engineeringPackages: path.join(root, "server", "routes", "engineering-packages.js"),
  engineeringCertification: path.join(root, "server", "routes", "engineering-certification.js"),
  report: path.join(root, "CIP_016C_ENGINEERING_TRANSACTION_REPAIR_REPORT.md"),
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
const created = [];

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

function tokenFor(user) {
  return Buffer.from(JSON.stringify({
    sub: user.userId,
    username: user.username,
    role: user.role,
    iat: new Date().toISOString(),
  })).toString("base64url");
}

function mockRequest(method, body, token) {
  const raw = JSON.stringify(body ?? {});
  const req = Readable.from([Buffer.from(raw)]);
  req.method = method;
  req.headers = {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  };
  return req;
}

function mockResponse() {
  const chunks = [];
  return {
    statusCode: 0,
    headers: {},
    body: "",
    writeHead(statusCode, headers) {
      this.statusCode = statusCode;
      this.headers = headers;
    },
    end(chunk = "") {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      this.body = Buffer.concat(chunks).toString("utf8");
    },
    json() {
      return this.body ? JSON.parse(this.body) : {};
    },
  };
}

async function invoke(handler, method, pathname, body, token) {
  const req = mockRequest(method, body, token);
  const res = mockResponse();
  const handled = await handler(req, res, pathname);
  if (!handled) throw new Error(`Route not handled: ${method} ${pathname}`);
  return res;
}

function readyDraft(seed, user) {
  const packageId = `DRAFT-IOF-${seed}`;
  const proposalId = `PROPOSAL-${seed}`;
  const opportunityId = `OPPORTUNITY-${seed}`;
  const routeRepositoryId = `ROUTE-${seed}`;
  const estimateId = `ESTIMATE-${seed}`;
  const commercialWorkbookId = `WORKBOOK-${seed}`;
  return {
    packageId,
    draftPackageId: packageId,
    packageName: `CIP-016C ${seed}`,
    proposalId,
    opportunityId,
    customerId: `CUSTOMER-${seed}`,
    accountId: `ACCOUNT-${seed}`,
    routeRepositoryId,
    estimateId,
    commercialWorkbookId,
    productDoctrineId: "PD-001",
    productId: "POINT_TO_POINT_DARK_FIBER",
    productName: "Point-to-Point Duct & Dark Fiber",
    organizationId: user.organizationId,
    workspaceId: user.workspaceId,
    ownerId: user.userId,
    owner: user.name,
    geometry: { coordinates: [[-96.8, 32.78], [-96.81, 32.79]] },
    centerline: [[-96.8, 32.78], [-96.81, 32.79]],
    measuredSpine: { geometryHash: `HASH-${seed}` },
    stationAuthority: { stations: [{ stationId: "STA-0000", label: "0+00" }] },
    objectStationAttachments: [{ objectId: "OBJ-001", attachmentMethod: "STATION_RANGE", attachmentStatus: "ASSIGNED" }],
    spineAuditProjection: { projectionId: `SAP-${seed}`, attachments: [], summary: {} },
    closureExpectations: [{ closureType: "OBJECT_CLOSE" }],
    auditProjectionSummary: { complianceStatus: "PASS" },
    kernelExecutionGraph: { graphId: `GRAPH-${seed}`, referencesInstantiatedSpineObjects: true },
    executionNodes: [{ nodeId: "NODE-001" }],
    executionEdges: [{ edgeId: "EDGE-001" }],
    executionGraphValidation: { status: "PASS" },
    executionExpectations: [{ expectationId: "EXPECT-001" }],
    closureLedgers: [{ ledgerId: "LEDGER-001" }],
    constitutionalClosureSummary: { authority: "FIELD" },
    constitutionalAssembly: { authority: "COMMERCIAL", status: "PASS" },
    spineObjectDependencies: [{ dependencyId: "DEP-001" }],
    spineObjectCloseSequences: [{ sequenceId: "SEQ-001" }],
    spineObjectEvidenceRequirements: [{ evidenceRequirementId: "EVREQ-001" }],
    segmentValidationRules: [{ ruleId: "SEG-RULE-001" }],
    paymentEligibilityRules: [{ ruleId: "PAY-RULE-001" }],
    draftIofReadiness: { status: "READY" },
    stationAddressRegistry: { registryId: `STATION-REG-${seed}` },
    objectAddresses: [{ objectId: "OBJ-001", station: "0+00" }],
    addressValidation: { validationId: `ADDR-VAL-${seed}`, status: "PASS" },
    addressProjectionSummary: { summaryId: `ADDR-SUM-${seed}` },
    spineObjectCatalog: { catalogId: `CATALOG-${seed}` },
    spineObjectCatalogEntries: [{ objectType: "CONDUIT" }],
    spineObjectCatalogValidation: { status: "PASS" },
    auditObjectManifest: { manifestId: `MANIFEST-${seed}`, createsObjects: false },
    auditObjectManifestEntries: [{ objectId: "OBJ-001" }],
    auditObjectManifestValidation: { status: "PASS" },
    auditObjectManifestSummary: { createsObjects: false },
    productionDoctrine: { doctrineId: "PD-001" },
    productionProfiles: [{ profileId: "PROFILE-001" }],
    objectProductionProfiles: [{ objectId: "OBJ-001", profileId: "PROFILE-001" }],
    productionProjectionSummary: { summaryId: `PROD-SUM-${seed}` },
    productionScheduleProjection: [{ objectId: "OBJ-001" }],
    productionCostProjection: [{ objectId: "OBJ-001", cost: 1000 }],
    productionPaymentProjection: [{ paymentEligible: false }],
    productionValidation: { validationId: `PROD-VAL-${seed}`, status: "PASS" },
    instantiatedSpineObjects: [{ objectId: "OBJ-001", currentState: "PLANNED" }],
    spineObjectRegistry: { registryId: `OBJ-REG-${seed}` },
    spineObjectIdentityRegistry: { registryId: `ID-REG-${seed}` },
    constructionSegments: [{ segmentId: "SEG-001" }],
    paymentSegments: [{ segmentId: "SEG-001", paymentEligible: false }],
    executionZones: [{ zoneId: "ZONE-001" }],
    instantiationSummary: { summaryId: `INST-SUM-${seed}` },
    instantiationHealth: { healthId: `INST-HEALTH-${seed}`, instantiationStatus: "PASS" },
    hierarchySummary: { summaryId: `HIER-SUM-${seed}` },
    productionBindings: [{ objectId: "OBJ-001", profileId: "PROFILE-001" }],
    addressBindings: [{ objectId: "OBJ-001", station: "0+00" }],
    kernelSpineObjectReferences: [{ objectId: "OBJ-001" }],
    objects: [{ objectId: "OBJ-001", objectType: "CONDUIT" }],
    proposedIofUnits: [{ unitId: "UNIT-001", unitType: "CONDUIT", status: "APPROVED", runtimeObjectIds: ["OBJ-001"], geometryReferences: [`GEOM-${seed}`] }],
    geometryReferences: [`GEOM-${seed}`],
    runtimeObjectIds: ["OBJ-001"],
    runtimeRelationshipIds: ["REL-001"],
    runtimeEvidenceIds: ["EVID-001"],
    existingInventoryReferences: ["INV-001"],
    commercialSummary: {
      routeRepositoryId,
      estimateId,
      workbookId: commercialWorkbookId,
      pricingSummary: { totalCost: 1000 },
    },
    pricingSummary: { estimateId, totalCost: 1000 },
    commercialWorkbook: { workbookId: commercialWorkbookId, sections: { summary: true } },
    customerSummary: { name: "CIP-016C Customer" },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function recordIdsFor(seed) {
  return {
    packageId: `DRAFT-IOF-${seed}`,
    engineeringPackageId: `ENG-PKG-DRAFT-IOF-${seed}`,
    proposalId: `PROPOSAL-${seed}`,
    opportunityId: `OPPORTUNITY-${seed}`,
    routeRepositoryId: `ROUTE-${seed}`,
  };
}

async function persistFixture(seed, user) {
  const ids = recordIdsFor(seed);
  const draft = readyDraft(seed, user);
  const opportunity = {
    opportunityId: ids.opportunityId,
    customerId: draft.customerId,
    customerTwinId: `CUSTOMER-TWIN-${draft.customerId}`,
    routeRepositoryId: ids.routeRepositoryId,
    proposalId: ids.proposalId,
    commercialWorkbookId: draft.commercialWorkbookId,
    estimateId: draft.estimateId,
    status: "DRAFT_IOF_PACKAGE",
    commercialStatus: "DRAFT_IOF_PACKAGE",
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
  };
  const route = {
    routeRepositoryId: ids.routeRepositoryId,
    opportunityId: ids.opportunityId,
    commercialGeometry: [{ lat: 32.78, lng: -96.8 }, { lat: 32.79, lng: -96.81 }],
    geometryHash: `HASH-${seed}`,
    routeGeometryId: `GEOM-${seed}`,
    routeMiles: 1.2,
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
  };
  const proposal = {
    proposalRecordId: ids.proposalId,
    proposalId: ids.proposalId,
    opportunityId: ids.opportunityId,
    status: "APPROVED",
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
  };
  await persistRecord(DIRS.iofPackages, ids.packageId, draft);
  await persistRecord(DIRS.commercialOpportunities, ids.opportunityId, opportunity);
  await persistRecord(DIRS.commercialRoutes, ids.routeRepositoryId, route);
  await persistRecord(DIRS.proposalDrafts, ids.proposalId, proposal);
  created.push([DIRS.iofPackages, ids.packageId]);
  created.push([DIRS.commercialOpportunities, ids.opportunityId]);
  created.push([DIRS.commercialRoutes, ids.routeRepositoryId]);
  created.push([DIRS.proposalDrafts, ids.proposalId]);
  created.push([DIRS.engineeringPackages, ids.engineeringPackageId]);
  created.push([DIRS.engineeringIntakes, `ENGINEERING-INTAKE-${ids.packageId}`]);
  created.push([DIRS.runtimeObjects, `RUNTIME-DRAFT-IOF-${ids.packageId}`]);
  created.push([DIRS.runtimeHistory, `${ids.packageId}:HISTORY:SUBMITTED_TO_ENGINEERING`]);
  created.push([DIRS.runtimeHistory, `${ids.packageId}:HISTORY:COMMERCIAL_ASSEMBLED`]);
  return { draft, opportunity, route, proposal, ids };
}

const submitApiBlock = blockBetween(sources.api, "export async function submitDraftIofPackageToEngineering", "export async function openDraftIofPackageForCertification");

check("client submit serializes only reference transaction request", includesAll(submitApiBlock, [
  "transactionRequest",
  "COMMERCIAL_TO_ENGINEERING_HANDOFF",
  "body: JSON.stringify(transactionRequest)",
]) && !submitApiBlock.includes("body: JSON.stringify(input),"));
check("Commercial UI no longer passes Draft IOF body into submit", sources.workspace.includes("submitDraftIofPackageToEngineering(draftSource.packageId, undefined, session)") &&
  !sources.workspace.includes("submitDraftIofPackageToEngineering(draftSource.packageId, { draftPackage: draftSource }"));
check("Commercial submit endpoint loads saved Draft IOF from repository", includesAll(sources.commercialIof, [
  "readRequestJsonWithRaw",
  "Commercial Draft IOF Package not found",
  "submitCommercialDraftPackageToEngineering(existing, user",
]));
check("Commercial transaction logs all required steps", includesAll(sources.commercialIof + sources.engineeringPackages, [
  "Validate Commercial Package",
  "Build Engineering Package",
  "Serialize Engineering Package",
  "POST /api/engineering/packages",
  "Engineering API receives request",
  "Normalize Engineering Package",
  "Write Engineering Repository JSON",
  "Flush file",
  "Reload Engineering Package",
  "Verify Engineering Package",
  "Update Commercial status",
  "Return Engineering Package ID",
]));
check("Engineering server audit records request bytes and repository filename", includesAll(sources.engineeringPackages, [
  "readRequestJsonWithRaw",
  "payloadSizeBytes: byteLength",
  "repositoryFilename",
  "Repository JSON",
]));
check("Engineering repository verification checks canonical fields", includesAll(sources.engineeringPackages, [
  "verifyEngineeringPackageRepositoryRecord",
  "engineeringPackageId",
  "opportunityId",
  "routeRepositoryId",
  "draftIOFPackageId",
  "proposalId",
  "estimateId",
  "commercialWorkbookId",
  "referenceHash",
  "repositoryType",
  "engineeringStatus",
  "referenceOnly",
]));
check("Commercial status update occurs after repository verification", sources.commercialIof.indexOf("const verifiedEngineeringPackage = await loadEngineeringPackage") <
  sources.commercialIof.indexOf("updateCommercialOpportunitySubmittedToEngineering(submitted, verifiedEngineeringPackage"));
check("Engineering Certification discovers Engineering Repository packages", includesAll(sources.engineeringCertification, [
  "listEngineeringPackages({ openOnly: true })",
  "packageQueueItem(draft, engineeringPackage)",
  "ENGINEERING_PENDING",
]));
check("report documents transaction repair", includesAll(sources.report, [
  "Root Cause",
  "Exact Failing Line",
  "Invalid string length",
  "Engineering Repository commit log",
  "Repository verification log",
  "Engineering Certification discovery confirmation",
  "Validation Results",
]));

const user = ALPHA_USERS.find((item) => item.username === "kyle");
const token = tokenFor(user);
const seed = `CIP016C-${Date.now()}`;

try {
  const { draft, opportunity, ids } = await persistFixture(seed, user);
  const response = await invoke(
    handleCommercialIofPackages,
    "POST",
    `/api/commercial/iof-packages/${encodeURIComponent(ids.packageId)}/submit-engineering`,
    { packageId: ids.packageId, draftIOFPackageId: ids.packageId, referenceOnly: true },
    token,
  );
  const result = response.json();
  check("Commercial submit POST succeeds", response.statusCode === 200, `status=${response.statusCode} body=${response.body.slice(0, 200)}`);
  check("No Invalid string length returned", !response.body.includes("Invalid string length"));
  check("Engineering Package built", Boolean(result.engineeringPackage?.engineeringPackageId));
  check("Engineering Package serialized", result.engineeringTransactionLog?.some((entry) => entry.label === "Serialize Engineering Package" && entry.status === "OK"));
  check("Server receives Engineering request step", result.engineeringTransactionLog?.some((entry) => entry.label === "Engineering API receives request" && entry.status === "OK"));
  check("JSON written", result.engineeringTransactionLog?.some((entry) => entry.label === "Write Engineering Repository JSON" && entry.status === "OK"));
  check("JSON reload succeeds", result.engineeringTransactionLog?.some((entry) => entry.label === "Reload Engineering Package" && entry.status === "OK"));
  check("Repository verification succeeds", result.engineeringTransactionLog?.some((entry) => entry.label === "Verify Engineering Package" && entry.status === "OK"));
  check("Commercial status updated", result.commercialOpportunity?.commercialStatus === "SUBMITTED_TO_ENGINEERING");
  const persistedEngineeringPackage = await loadRecord(DIRS.engineeringPackages, ids.engineeringPackageId);
  check("Engineering Repository JSON created", persistedEngineeringPackage.engineeringPackageId === ids.engineeringPackageId);
  check("Engineering Package JSON is reference-only", persistedEngineeringPackage.referenceOnly === true &&
    persistedEngineeringPackage.repositoryType === "ENGINEERING_PACKAGE" &&
    !("commercialGeometry" in persistedEngineeringPackage) &&
    !("draftPackage" in persistedEngineeringPackage) &&
    !("commercialWorkbook" in persistedEngineeringPackage));
  const updatedOpportunity = await loadRecord(DIRS.commercialOpportunities, ids.opportunityId);
  check("Commercial Opportunity committed submitted status", updatedOpportunity.commercialStatus === "SUBMITTED_TO_ENGINEERING" &&
    updatedOpportunity.engineeringPackageId === ids.engineeringPackageId);
  const queue = await listReviewQueue();
  check("Engineering Package visible inside Engineering Certification", queue.some((item) => item.engineeringPackageId === ids.engineeringPackageId && item.status === "ENGINEERING_PENDING"));
  const directRecord = engineeringPackageRecordForRepository({ draftPackage: draft, opportunity, user, timestamp: new Date().toISOString() });
  const directPost = await invoke(
    handleEngineeringPackages,
    "POST",
    "/api/engineering/packages",
    { engineeringPackage: directRecord },
    token,
  );
  const directResult = directPost.json();
  check("POST /api/engineering/packages succeeds", directPost.statusCode === 201, `status=${directPost.statusCode}`);
  check("Engineering API direct POST logs request receipt", directResult.engineeringTransactionLog?.some((entry) => entry.label === "Request received" && entry.status === "OK"));
} catch (error) {
  check("dynamic transaction validation completed", false, error instanceof Error ? error.stack ?? error.message : String(error));
} finally {
  for (const [dir, id] of created.reverse()) {
    await deleteRecord(dir, id).catch(() => null);
  }
}

const failed = checks.filter((item) => !item.condition);

for (const item of checks) {
  const status = item.condition ? "PASS" : "FAIL";
  console.log(`${status} ${item.name}${item.detail ? ` - ${item.detail}` : ""}`);
}

if (failed.length) {
  console.error(`\n${failed.length} CIP-016C validation check(s) failed.`);
  process.exit(1);
}

console.log("\nCIP-016C Engineering transaction validation passed.");
