import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const dataRoot = path.join(projectRoot, ".tmp", "sprint13-6-runtime-lifecycle-bridge");
const reportPath = path.join(projectRoot, ".tmp", "sprint13-6-runtime-lifecycle-bridge-report.json");

function ensureSafeProofRoot(target) {
  const relative = path.relative(projectRoot, target);
  if (relative.startsWith("..") || path.isAbsolute(relative) || !relative.includes("sprint13-6-runtime-lifecycle-bridge")) {
    throw new Error(`Refusing to reset unsafe lifecycle bridge data root: ${target}`);
  }
}

ensureSafeProofRoot(dataRoot);
await rm(dataRoot, { recursive: true, force: true });
await mkdir(dataRoot, { recursive: true });
process.env.DAL_DATA_ROOT = dataRoot;
process.env.DAL_PORT = process.env.DAL_PORT ?? "0";

const { DIRS, listRecords } = await import("./server/routes/_shared.js");
const { handleAuth } = await import("./server/routes/auth.js");
const { handleCommercialOpportunities } = await import("./server/routes/commercial-opportunities.js");
const { handleEngineeringCertification } = await import("./server/routes/engineering-certification.js");
const { handleIofPackages } = await import("./server/routes/iof-packages.js");
const { handleProposalDrafts } = await import("./server/routes/proposal-drafts.js");
const { handleRuntime } = await import("./server/routes/runtime.js");
const { handleRuntimeFoundation } = await import("./server/routes/runtime-foundation.js");
const { handleRuntimeLifecycleBridge } = await import("./server/routes/runtime-lifecycle-bridge.js");
const { handleScopeVersions } = await import("./server/routes/scopeversions.js");

const routes = [
  handleAuth,
  handleRuntime,
  handleScopeVersions,
  handleCommercialOpportunities,
  handleProposalDrafts,
  handleEngineeringCertification,
  handleRuntimeLifecycleBridge,
  handleRuntimeFoundation,
  handleIofPackages,
];

const proof = {
  startedAt: new Date().toISOString(),
  dataRoot,
  assertions: [],
};

function assertProof(name, passed, details = {}) {
  proof.assertions.push({ name, status: passed ? "PASS" : "FAIL", ...details });
  if (!passed) throw new Error(`${name}: ${details.message ?? "assertion failed"}`);
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
      return { status: response.statusCode, text, json };
    }
  }
  return { status: 404, text: JSON.stringify({ error: "Not found" }), json: { error: "Not found" } };
}

function expectStatus(label, response, status) {
  assertProof(label, response.status === status, { expected: status, actual: response.status, body: response.json });
  return response;
}

async function login(username, password) {
  const response = await runtimeRequest("POST", "/api/auth/login", { username, password });
  expectStatus(`login:${username}`, response, 200);
  return { username, token: response.json.token, user: response.json.user, workspace: response.json.workspace };
}

function byType(records, objectType) {
  return records.filter((record) => record?.objectType === objectType);
}

function active(records) {
  return records.filter((record) => !["ARCHIVED", "CLOSED"].includes(String(record?.status ?? record?.lifecycleState ?? "")));
}

const ryan = await login("ryan", "ryan-alpha");
const quoteInput = {
  trigger: "QUOTE_READY_FOR_CUSTOMER",
  accountId: "google",
  customerId: "customer-google",
  customerName: "Google",
  organizationId: ryan.user.organizationId,
  workspaceId: ryan.workspace.workspaceId,
  opportunityId: "COMMERCIAL-OPPORTUNITY-GOOGLE-29M-LIFECYCLE",
  opportunity: {
    name: "Google 29M Runtime Lifecycle Opportunity",
    selectedScopeId: "GOOGLE-29M-SCOPE",
    commercialDraftType: "EXTEND_EXISTING_NETWORK",
  },
  commercialDraftId: "COMMERCIAL-DRAFT-GOOGLE-29M-LIFECYCLE",
  commercialDraft: {
    revision: 1,
    routeId: "GOOGLE-29M-ROUTE",
    draftType: "EXTEND_EXISTING_NETWORK",
  },
  proposalId: "PROPOSAL-GOOGLE-29M-LIFECYCLE",
  proposalNumber: "PROP-GOOGLE-29M-LIFECYCLE",
  title: "Google 29M Runtime Bridge Proposal",
  summary: "Runtime bridge quote-ready proposal.",
  executiveSummary: "Runtime owns the continuous Commercial-to-Engineering lifecycle.",
  pricingSummary: { budgetCost: 29000000, sellPriceIru: 43500000, routeMiles: 29 },
  marginSummary: { grossMarginDollars: 14500000, grossMarginPercent: 33.3 },
  confidenceSummary: { commercialReadiness: 92 },
  commercialAssumptionIds: ["ASSUMPTION-LIFECYCLE-ROUTE-MILES"],
  dealPointIds: ["DEAL-GOOGLE-29M-LIFECYCLE"],
  runtimeObjectIds: ["RUNTIME-INVENTORY-GOOGLE-MUSKOGEE", "RUNTIME-ROUTE-GOOGLE-29M"],
  runtimeRelationshipIds: ["EXTENDS_INVENTORY:RUNTIME-INVENTORY-GOOGLE-MUSKOGEE"],
  runtimeEvidenceIds: ["EVIDENCE-GOOGLE-QUOTE-READY"],
  existingInventoryReferences: ["RUNTIME-INVENTORY-GOOGLE-MUSKOGEE"],
  customerDesignReferences: ["CUSTOMER-DESIGN-GOOGLE-DIVERSITY"],
  customerTwinReference: "CUSTOMER-TWIN-GOOGLE",
  geometryReferences: ["GEOMETRY-GOOGLE-29M-A", "GEOMETRY-GOOGLE-29M-Z"],
  proposalDocumentReferences: ["DOC-GOOGLE-LIFECYCLE-PROPOSAL"],
  assignedCustomerUsers: ["google-participant-001"],
  assignedEngineerId: "teralinx-user-kyle",
  assignedEngineer: "Kyle",
};

let response = await runtimeRequest("POST", "/api/runtime/lifecycle/advance", quoteInput, ryan);
expectStatus("bridge:quote-ready-advance", response, 200);
let bridge = response.json;
assertProof("bridge:quote-ready-status", bridge.lifecycle.status === "AWAITING_CUSTOMER_REVIEW", bridge.lifecycle);
assertProof("bridge:quote-ready-progress", bridge.lifecycle.lifecycleProgress.filter((item) => item.complete).length >= 7, bridge.lifecycle.lifecycleProgress);
assertProof("bridge:opportunity-created", bridge.opportunity?.opportunityId === quoteInput.opportunityId, bridge.opportunity);
assertProof("bridge:commercial-draft-created", bridge.commercialDraft?.objectType === "COMMERCIAL_DRAFT", bridge.commercialDraft);
assertProof("bridge:proposal-created", bridge.proposal?.proposalId === quoteInput.proposalId && bridge.proposal?.status === "AWAITING_CUSTOMER_REVIEW", bridge.proposal);
assertProof("bridge:no-package-before-approval", !bridge.draftPackage, bridge);

let opportunities = await listRecords(DIRS.commercialOpportunities);
let proposals = await listRecords(DIRS.proposalDrafts);
let runtimeObjects = await listRecords(DIRS.runtimeObjects);
let runtimeRelationships = await listRecords(DIRS.runtimeRelationships);
let runtimeEvidence = await listRecords(DIRS.runtimeEvidence);
let runtimeHistory = await listRecords(DIRS.runtimeHistory);

assertProof("bridge:exactly-one-opportunity", opportunities.filter((item) => item.opportunityId === quoteInput.opportunityId).length === 1, opportunities);
assertProof("bridge:exactly-one-commercial-draft", active(byType(runtimeObjects, "COMMERCIAL_DRAFT")).length === 1, byType(runtimeObjects, "COMMERCIAL_DRAFT"));
assertProof("bridge:exactly-one-proposal", proposals.filter((item) => item.proposalId === quoteInput.proposalId).length === 1, proposals);
assertProof("bridge:assignment-evidence", runtimeEvidence.some((item) => item.evidenceId.includes("PROPOSAL-ASSIGNED")), runtimeEvidence);
assertProof("bridge:customer-review-task", byType(runtimeObjects, "REVIEW_TASK").length === 1, byType(runtimeObjects, "REVIEW_TASK"));
assertProof("bridge:relationships-created", runtimeRelationships.length >= 3, runtimeRelationships);
assertProof("bridge:history-through-review", [
  "CUSTOMER_TWIN_READY",
  "COMMERCIAL_OPPORTUNITY_CREATED",
  "COMMERCIAL_DRAFT_CREATED",
  "PROPOSAL_CREATED",
  "PROPOSAL_SUBMITTED",
  "PROPOSAL_ASSIGNED",
  "CUSTOMER_REVIEW_STARTED",
].every((eventType) => runtimeHistory.some((item) => item.eventType === eventType)), runtimeHistory.map((item) => item.eventType));

const google = await login("google", "google-alpha");
assertProof("bridge:customer-workspace-notification", google.workspace.notifications.some((item) => item.type === "PROPOSAL_CUSTOMER_REVIEW" && item.objectId === quoteInput.proposalId), google.workspace);
assertProof("bridge:customer-workspace-assignment", google.workspace.assignments.some((assignment) => String(assignment).includes("REVIEW-TASK")), google.workspace);

response = await runtimeRequest("POST", `/api/proposals/${encodeURIComponent(quoteInput.proposalId)}/approve`, {
  comment: "Approved for Runtime Lifecycle Bridge validation.",
}, google);
expectStatus("bridge:customer-approval", response, 200);
assertProof("bridge:approval-created-package", Boolean(response.json.draftPackage?.packageId), response.json);

const kyle = await login("kyle", "kyle-alpha");
response = await runtimeRequest("GET", "/api/engineering/certification/queue", undefined, kyle);
expectStatus("bridge:engineering-queue-visible", response, 200);
assertProof("bridge:engineering-queue-one-item", response.json.engineeringReviewQueue.filter((item) => item.proposalId === quoteInput.proposalId).length === 1, response.json.engineeringReviewQueue);

response = await runtimeRequest("POST", "/api/runtime/lifecycle/advance", { ...quoteInput, trigger: "CUSTOMER_APPROVED" }, ryan);
expectStatus("bridge:idempotent-rerun", response, 200);
bridge = response.json;
assertProof("bridge:approved-status", bridge.lifecycle.status === "ENGINEERING_REVIEW_QUEUED", bridge.lifecycle);
assertProof("bridge:all-progress-complete", bridge.lifecycle.lifecycleProgress.every((item) => item.complete), bridge.lifecycle.lifecycleProgress);

opportunities = await listRecords(DIRS.commercialOpportunities);
proposals = await listRecords(DIRS.proposalDrafts);
runtimeObjects = await listRecords(DIRS.runtimeObjects);
runtimeRelationships = await listRecords(DIRS.runtimeRelationships);
runtimeEvidence = await listRecords(DIRS.runtimeEvidence);
runtimeHistory = await listRecords(DIRS.runtimeHistory);
const draftPackages = await listRecords(DIRS.iofPackages);

assertProof("bridge:exactly-one-active-opportunity-after-rerun", opportunities.filter((item) => item.opportunityId === quoteInput.opportunityId && item.status !== "ARCHIVED").length === 1, opportunities);
assertProof("bridge:exactly-one-active-commercial-draft-after-rerun", active(byType(runtimeObjects, "COMMERCIAL_DRAFT")).length === 1, byType(runtimeObjects, "COMMERCIAL_DRAFT"));
assertProof("bridge:exactly-one-active-proposal-after-rerun", proposals.filter((item) => item.proposalId === quoteInput.proposalId && item.status !== "ARCHIVED").length === 1, proposals);
assertProof("bridge:exactly-one-draft-iof-package", draftPackages.filter((item) => item.proposalId === quoteInput.proposalId).length === 1, draftPackages);
assertProof("bridge:no-duplicated-runtime-ids", new Set(runtimeObjects.map((item) => item.runtimeId)).size === runtimeObjects.length, runtimeObjects.map((item) => item.runtimeId));
const runtimeObjectIds = new Set(runtimeObjects.map((item) => item.runtimeId));
assertProof("bridge:no-orphaned-relationships", runtimeRelationships.every((relationship) => runtimeObjectIds.has(relationship.fromObjectId) && runtimeObjectIds.has(relationship.toObjectId)), runtimeRelationships);
assertProof("bridge:history-complete", [
  "CUSTOMER_TWIN_READY",
  "COMMERCIAL_OPPORTUNITY_CREATED",
  "COMMERCIAL_DRAFT_CREATED",
  "PROPOSAL_CREATED",
  "PROPOSAL_SUBMITTED",
  "PROPOSAL_ASSIGNED",
  "CUSTOMER_REVIEW_STARTED",
  "CUSTOMER_APPROVED",
  "DRAFT_IOF_PACKAGE_CREATED",
  "ENGINEERING_REVIEW_QUEUED",
].every((eventType) => runtimeHistory.some((item) => item.eventType === eventType)), runtimeHistory.map((item) => item.eventType));
assertProof("bridge:evidence-complete", runtimeEvidence.length >= 2 && runtimeEvidence.every((item) => item.evidenceId), runtimeEvidence);

proof.completedAt = new Date().toISOString();
proof.summary = {
  assertions: proof.assertions.length,
  lifecycleId: bridge.lifecycle.lifecycleId,
  opportunityId: quoteInput.opportunityId,
  proposalId: quoteInput.proposalId,
  draftPackageId: draftPackages.find((item) => item.proposalId === quoteInput.proposalId)?.packageId,
  runtimeObjectCount: runtimeObjects.length,
  relationshipCount: runtimeRelationships.length,
  evidenceCount: runtimeEvidence.length,
  historyCount: runtimeHistory.length,
  dataRoot,
};

await mkdir(path.dirname(reportPath), { recursive: true });
await writeFile(reportPath, JSON.stringify(proof, null, 2));
console.log(JSON.stringify(proof.summary, null, 2));
