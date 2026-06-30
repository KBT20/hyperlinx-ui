import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const dataRoot = path.join(projectRoot, ".tmp", "sprint13-4-engineering-certification");
const reportPath = path.join(projectRoot, ".tmp", "sprint13-4-engineering-certification-report.json");

function ensureSafeProofRoot(target) {
  const relative = path.relative(projectRoot, target);
  if (relative.startsWith("..") || path.isAbsolute(relative) || !relative.includes("sprint13-4-engineering-certification")) {
    throw new Error(`Refusing to reset unsafe engineering certification data root: ${target}`);
  }
}

ensureSafeProofRoot(dataRoot);
await rm(dataRoot, { recursive: true, force: true });
await mkdir(dataRoot, { recursive: true });
process.env.DAL_DATA_ROOT = dataRoot;
process.env.DAL_PORT = process.env.DAL_PORT ?? "0";

const { handleActivity } = await import("./server/routes/activity.js");
const { handleAuth } = await import("./server/routes/auth.js");
const { handleControlWorkItems } = await import("./server/routes/control-work-items.js");
const { handleEngineeringCertification } = await import("./server/routes/engineering-certification.js");
const { handleFieldClosures } = await import("./server/routes/field-closures.js");
const { handleIofPackages } = await import("./server/routes/iof-packages.js");
const { handleMarketplaceQuotes } = await import("./server/routes/marketplace-quotes.js");
const { handleProposalDrafts } = await import("./server/routes/proposal-drafts.js");
const { handleRuntime } = await import("./server/routes/runtime.js");
const { handleRuntimeFoundation } = await import("./server/routes/runtime-foundation.js");
const { handleScopeVersions } = await import("./server/routes/scopeversions.js");

const routes = [
  handleAuth,
  handleRuntime,
  handleActivity,
  handleScopeVersions,
  handleProposalDrafts,
  handleEngineeringCertification,
  handleRuntimeFoundation,
  handleIofPackages,
  handleMarketplaceQuotes,
  handleControlWorkItems,
  handleFieldClosures,
];

const IDS = {
  org: "org-teralinx",
  customerId: "customer-google",
  opportunity: "GOOGLE-29M-OPPORTUNITY",
  proposal: "PROPOSAL-GOOGLE-29M-CERTIFICATION",
  opportunityRuntime: "RUNTIME-OPPORTUNITY-GOOGLE-29M-OPPORTUNITY",
  inventory: "RUNTIME-INVENTORY-CUSTOMER-GOOGLE-AUSTIN",
  twin: "CUSTOMER-TWIN-GOOGLE-AUSTIN",
  inventoryRoute: "RUNTIME-ROUTE-GOOGLE-AUSTIN-EXISTING-001",
  design: "CUSTOMER-DESIGN-GOOGLE-29M",
  geometry: "GEOMETRY-GOOGLE-AUSTIN-29M",
  draftPackage: "DRAFT-IOF-GOOGLE-29M-CERTIFICATION",
  certifiedPackage: "CERT-IOF-DRAFT-IOF-GOOGLE-29M-CERTIFICATION",
};

const proof = {
  startedAt: new Date().toISOString(),
  dataRoot,
  assertions: [],
  lifecycle: [],
  authority: [],
  executionGate: [],
  runtime: [],
};

function assertProof(name, passed, details = {}) {
  proof.assertions.push({ name, status: passed ? "PASS" : "FAIL", ...details });
  if (!passed) throw new Error(`${name}: ${details.message ?? "assertion failed"}`);
}

function note(section, event, details = {}) {
  proof[section].push({ event, timestamp: new Date().toISOString(), ...details });
}

function authHeader(session) {
  return session?.token ? { authorization: `Bearer ${session.token}` } : {};
}

function requestStream(body) {
  if (body === undefined) return Readable.from([]);
  return Readable.from([Buffer.from(JSON.stringify(body), "utf8")]);
}

async function runtimeRequest(method, requestPath, body, session) {
  const url = new URL(requestPath, "https://runtime.proof");
  const req = requestStream(body);
  req.method = method;
  req.url = `${url.pathname}${url.search}`;
  req.headers = {
    host: "runtime.proof",
    accept: "application/json",
    ...(body === undefined ? {} : { "content-type": "application/json" }),
    ...authHeader(session),
  };

  const response = {
    statusCode: 200,
    headers: {},
    chunks: [],
    writeHead(statusCode, headers = {}) {
      this.statusCode = statusCode;
      this.headers = { ...this.headers, ...headers };
    },
    write(chunk) {
      if (chunk) this.chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    },
    end(chunk) {
      if (chunk) this.write(chunk);
    },
  };

  for (const route of routes) {
    if (await route(req, response, url.pathname)) {
      const text = Buffer.concat(response.chunks).toString("utf8");
      let json = {};
      if (text.trim()) {
        try {
          json = JSON.parse(text);
        } catch {
          json = { raw: text };
        }
      }
      return { status: response.statusCode, headers: response.headers, text, json };
    }
  }
  return { status: 404, headers: {}, text: JSON.stringify({ error: "Not found" }), json: { error: "Not found" } };
}

function expectStatus(label, response, status) {
  assertProof(label, response.status === status, {
    expected: status,
    actual: response.status,
    body: response.json,
  });
  return response;
}

async function login(username, password) {
  const response = await runtimeRequest("POST", "/api/auth/login", { username, password });
  expectStatus(`login:${username}`, response, 200);
  return {
    username,
    token: response.json.token,
    user: response.json.user,
    workspace: response.json.workspace,
  };
}

function approvedProposalInput(ryan) {
  return {
    proposalId: IDS.proposal,
    proposalRecordId: IDS.proposal,
    proposalNumber: "PROP-GOOGLE-29M-CERTIFICATION",
    customerId: IDS.customerId,
    accountId: "google",
    opportunityId: IDS.opportunity,
    organizationId: IDS.org,
    workspaceId: ryan.workspace.workspaceId,
    ownerId: ryan.user.userId,
    commercialOwnerId: ryan.user.userId,
    assignedCustomerUsers: ["google-participant-001"],
    visibility: "SHARED",
    status: "CUSTOMER_APPROVED",
    approvalState: "APPROVED",
    title: "Google Austin 29M Certified Execution Proposal",
    summary: "Customer-approved proposal for engineering certification proof.",
    executiveSummary: "Approved proposal supplies runtime references only.",
    pricingSummary: {
      budgetCost: 11800000,
      sellPriceIru: 17700000,
      routeMiles: 29,
    },
    marginSummary: {
      grossMarginDollars: 5900000,
      grossMarginPercent: 33.3,
    },
    confidenceSummary: {
      commercialReadiness: 90,
      runtimeHealth: "PASS",
    },
    commercialAssumptionIds: ["ASSUMPTION-GOOGLE-AUSTIN-CIVIL-MIX"],
    dealPointIds: ["DEALPOINT-GOOGLE-IRU", "DEALPOINT-GOOGLE-SLA"],
    runtimeObjectIds: [IDS.opportunityRuntime, IDS.inventoryRoute],
    runtimeRelationshipIds: [`DERIVED_FROM:${IDS.opportunity}`, `REFERENCES_INVENTORY:${IDS.inventory}`],
    runtimeEvidenceIds: ["EVIDENCE-GOOGLE-COMMERCIAL-DRAFT", "EVIDENCE-GOOGLE-CUSTOMER-APPROVAL"],
    existingInventoryReferences: [IDS.inventory],
    customerDesignReferences: [IDS.design],
    customerTwinReference: IDS.twin,
    geometryReferences: [IDS.geometry],
    proposalDocumentReferences: ["DOC-GOOGLE-COMMERCIAL-PREVIEW"],
    approvedAt: new Date().toISOString(),
    version: 1,
    noScopeVersionCreation: true,
    noInventoryMutation: true,
  };
}

const completeChecklist = {
  geometryComplete: true,
  existingInventoryValidated: true,
  customerDesignReviewed: true,
  relationshipsValidated: true,
  dependenciesValidated: true,
  evidencePresent: true,
  commercialAssumptionsReviewed: true,
  unitQuantitiesVerified: true,
  engineeringStandardsMet: true,
  riskAccepted: true,
  packageComplete: true,
  certificationConfidence: 95,
  engineeringNotes: "Engineering certification complete; execution stops at ScopeVersion.",
};

const ryan = await login("ryan", "ryan-alpha");
const kyle = await login("kyle", "kyle-alpha");
const fran = await login("fran", "fran-alpha");
const google = await login("google", "google-alpha");

let response = await runtimeRequest("POST", "/api/proposals", { proposal: approvedProposalInput(ryan) }, ryan);
expectStatus("proposal:approved:create", response, 201);
let proposal = response.json.proposal;
assertProof("proposal:approved:readiness", proposal.readiness.canCreateDraftIofPackage === true, proposal.readiness);
note("lifecycle", "proposal-approved", { proposalId: proposal.proposalId, status: proposal.status });

response = await runtimeRequest("POST", "/api/engineering/certification/draft-packages/from-proposal", {
  proposalId: IDS.proposal,
  packageId: IDS.draftPackage,
  assignedEngineerId: kyle.user.userId,
  assignedEngineer: kyle.user.name,
  priority: "HIGH",
}, ryan);
expectStatus("authority:ryan-cannot-assemble-engineering-draft", response, 403);

response = await runtimeRequest("POST", "/api/engineering/certification/draft-packages/from-proposal", {
  proposalId: IDS.proposal,
  packageId: IDS.draftPackage,
  assignedEngineerId: kyle.user.userId,
  assignedEngineer: kyle.user.name,
  priority: "HIGH",
}, kyle);
expectStatus("draft-iof:assemble-from-approved-proposal", response, 201);
let draft = response.json.draftPackage;
assertProof("draft-iof:persisted", draft.packageId === IDS.draftPackage && draft.status === "DRAFT", draft);
assertProof("draft-iof:proposed-units-created", draft.proposedIofUnits.length === 2 && draft.proposedIofUnits.every((unit) => unit.status === "PROPOSED"), { units: draft.proposedIofUnits });
assertProof("draft-iof:references-runtime-objects", draft.runtimeObjectIds.includes(IDS.inventoryRoute) && draft.existingInventoryReferences.includes(IDS.inventory), draft);
note("lifecycle", "draft-iof-assembled", { packageId: draft.packageId, proposedUnits: draft.proposedIofUnits.length });

response = await runtimeRequest("GET", "/api/engineering/certification/queue", undefined, fran);
expectStatus("engineering-queue:fran-can-read", response, 200);
assertProof("engineering-queue:contains-draft", response.json.engineeringReviewQueue.some((item) => item.packageId === IDS.draftPackage), response.json);

response = await runtimeRequest("GET", "/api/engineering/certification/queue", undefined, google);
expectStatus("engineering-queue:customer-cannot-read", response, 403);

response = await runtimeRequest("GET", "/api/scopeversions", undefined, kyle);
expectStatus("execution-gate:no-scopeversion-before-certification", response, 200);
assertProof("execution-gate:scopeversion-absent-before-certification", (response.json.scopeVersions ?? []).length === 0, response.json);
note("executionGate", "pre-certification-scopeversion-blocked", { scopeVersions: 0 });

for (const unit of draft.proposedIofUnits) {
  response = await runtimeRequest("POST", `/api/engineering/certification/draft-packages/${encodeURIComponent(IDS.draftPackage)}/units/${encodeURIComponent(unit.unitId)}/certify`, {
    engineeringNote: `Certified ${unit.unitId}`,
    engineeringConfidence: 94,
    engineeringRisk: "ACCEPTED",
    engineeringComments: ["Certified by Kyle."],
  }, kyle);
  expectStatus(`unit:certify:${unit.unitId}`, response, 200);
  draft = response.json.iofPackage;
}
assertProof("unit-certification:all-units-certified", draft.proposedIofUnits.every((unit) => unit.status === "CERTIFIED" && unit.immutable === true), { units: draft.proposedIofUnits });
note("lifecycle", "units-certified", { units: draft.proposedIofUnits.map((unit) => unit.unitId) });

const firstUnit = draft.proposedIofUnits[0];
response = await runtimeRequest("POST", `/api/engineering/certification/draft-packages/${encodeURIComponent(IDS.draftPackage)}/units/${encodeURIComponent(firstUnit.unitId)}/modify`, {
  unit: { name: "Unauthorized post-cert modification" },
}, kyle);
expectStatus("unit-certification:certified-unit-frozen", response, 409);

response = await runtimeRequest("POST", `/api/engineering/certification/draft-packages/${encodeURIComponent(IDS.draftPackage)}/certify`, {
  checklist: { ...completeChecklist, packageComplete: false },
}, kyle);
expectStatus("package-certification:incomplete-checklist-blocked", response, 409);

response = await runtimeRequest("POST", `/api/engineering/certification/draft-packages/${encodeURIComponent(IDS.draftPackage)}/certify`, {
  certifiedPackageId: IDS.certifiedPackage,
  checklist: completeChecklist,
}, kyle);
expectStatus("package-certification:certify-draft-iof", response, 200);
const certified = response.json.certifiedIofPackage;
const certificate = response.json.executionAuthorizationCertificate;
const scopeVersion = response.json.scopeVersion;
assertProof("certified-package:persisted", certified.certifiedPackageId === IDS.certifiedPackage && certified.status === "CERTIFIED", certified);
assertProof("execution-certificate:persisted", certificate.certifiedIofPackageId === IDS.certifiedPackage && certificate.scopeVersionId === scopeVersion.scopeVersionId && certificate.assemblyFingerprint.length === 64, certificate);
assertProof("scopeversion:generated-from-certified-package", scopeVersion.certifiedIofPackageId === IDS.certifiedPackage && scopeVersion.certificationState === "CERTIFIED", scopeVersion);
assertProof("scopeversion:references-no-duplicates", scopeVersion.runtimeObjectIds.length === proposal.runtimeObjectIds.length && scopeVersion.canonicalTruth.certifiedIofUnitIds.length === draft.proposedIofUnits.length, scopeVersion);
note("lifecycle", "package-certified-scopeversion-generated", { certifiedPackageId: certified.certifiedPackageId, scopeVersionId: scopeVersion.scopeVersionId });
note("authority", "engineering-to-execution", { certificateId: certificate.certificateId, scopeVersionId: scopeVersion.scopeVersionId });

response = await runtimeRequest("POST", `/api/engineering/certification/certified-packages/${encodeURIComponent(IDS.certifiedPackage)}/generate-scopeversion`, undefined, kyle);
expectStatus("scopeversion:generate-idempotent", response, 200);
assertProof("scopeversion:idempotent", response.json.scopeVersion.scopeVersionId === scopeVersion.scopeVersionId, response.json.scopeVersion);

response = await runtimeRequest("PUT", `/api/iof-packages/${encodeURIComponent(IDS.draftPackage)}`, {
  iofPackage: { ...draft, status: "DRAFT", note: "try to mutate certified draft" },
}, kyle);
expectStatus("certified-package:draft-frozen-against-put", response, 409);

response = await runtimeRequest("GET", "/api/runtime/history", undefined, kyle);
expectStatus("runtime:history:list", response, 200);
const history = response.json.history ?? [];
assertProof("runtime-history:authority-transfer-commercial-engineering", history.some((item) => item.eventType === "runtime.authority_transfer.commercial_to_engineering"), { historyCount: history.length });
assertProof("runtime-history:engineering-checklist", history.some((item) => item.eventType === "runtime.engineering_checklist.completed"), { historyCount: history.length });
assertProof("runtime-history:authority-transfer-engineering-execution", history.some((item) => item.eventType === "runtime.authority_transfer.engineering_to_execution"), { historyCount: history.length });

response = await runtimeRequest("GET", "/api/runtime/evidence", undefined, kyle);
expectStatus("runtime:evidence:list", response, 200);
const evidence = response.json.evidence ?? [];
assertProof("runtime-evidence:execution-certificate", evidence.some((item) => item.sourceType === "EXECUTION_AUTHORIZATION_CERTIFICATE" && item.lineage?.scopeVersionId === scopeVersion.scopeVersionId), { evidence });

response = await runtimeRequest("GET", "/api/runtime/objects", undefined, kyle);
expectStatus("runtime:objects:list", response, 200);
const runtimeObjects = response.json.runtimeObjects ?? [];
assertProof("runtime-object:certified-package-mirror", runtimeObjects.some((item) => item.metadata?.certifiedPackageId === IDS.certifiedPackage), { runtimeObjects });
assertProof("runtime-object:scopeversion-mirror", runtimeObjects.some((item) => item.objectType === "SCOPE_VERSION" && item.objectId === scopeVersion.scopeVersionId), { runtimeObjects });

response = await runtimeRequest("GET", "/api/marketplace/quotes", undefined, kyle);
expectStatus("execution-gate:marketplace-empty", response, 200);
assertProof("execution-gate:no-marketplace-created", (response.json.quotes ?? response.json.items ?? []).length === 0, response.json);

response = await runtimeRequest("GET", "/api/control/work-items", undefined, kyle);
expectStatus("execution-gate:control-empty", response, 200);
assertProof("execution-gate:no-control-created", (response.json.workItems ?? []).length === 0, response.json);

response = await runtimeRequest("GET", "/api/field/closures", undefined, kyle);
expectStatus("execution-gate:field-empty", response, 200);
assertProof("execution-gate:no-field-created", (response.json.closures ?? response.json.items ?? []).length === 0, response.json);

await runtimeRequest("POST", "/api/auth/logout", undefined, kyle);
const kyleAgain = await login("kyle", "kyle-alpha");
response = await runtimeRequest("GET", `/api/engineering/certification/certified-packages/${encodeURIComponent(IDS.certifiedPackage)}`, undefined, kyleAgain);
expectStatus("persistence:certified-package-after-login", response, 200);
assertProof("persistence:certified-package-retained", response.json.certifiedIofPackage.scopeVersionId === scopeVersion.scopeVersionId, response.json.certifiedIofPackage);

const storedCertificate = JSON.parse(await readFile(path.join(dataRoot, "execution-authorization-certificates", `${encodeURIComponent(certificate.certificateId)}.json`), "utf8"));
assertProof("persistence:certificate-file-backed", storedCertificate.assemblyFingerprint === certificate.assemblyFingerprint && storedCertificate.immutable === true, storedCertificate);

proof.completedAt = new Date().toISOString();
proof.summary = {
  assertions: proof.assertions.length,
  draftPackageId: IDS.draftPackage,
  certifiedPackageId: IDS.certifiedPackage,
  scopeVersionId: scopeVersion.scopeVersionId,
  certificateId: certificate.certificateId,
  dataRoot,
};

await mkdir(path.dirname(reportPath), { recursive: true });
await writeFile(reportPath, JSON.stringify(proof, null, 2));
console.log(JSON.stringify(proof.summary, null, 2));
