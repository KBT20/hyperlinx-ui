import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const dataRoot = path.join(projectRoot, ".tmp", "sprint13-5-iof-package-experience");
const reportPath = path.join(projectRoot, ".tmp", "sprint13-5-iof-package-experience-report.json");

function ensureSafeProofRoot(target) {
  const relative = path.relative(projectRoot, target);
  if (relative.startsWith("..") || path.isAbsolute(relative) || !relative.includes("sprint13-5-iof-package-experience")) {
    throw new Error(`Refusing to reset unsafe IOF package data root: ${target}`);
  }
}

ensureSafeProofRoot(dataRoot);
await rm(dataRoot, { recursive: true, force: true });
await mkdir(dataRoot, { recursive: true });
process.env.DAL_DATA_ROOT = dataRoot;
process.env.DAL_PORT = process.env.DAL_PORT ?? "0";

const { handleAuth } = await import("./server/routes/auth.js");
const { handleEngineeringCertification } = await import("./server/routes/engineering-certification.js");
const { handleIofPackages } = await import("./server/routes/iof-packages.js");
const { handleProposalDrafts } = await import("./server/routes/proposal-drafts.js");
const { handleRuntime } = await import("./server/routes/runtime.js");
const { handleRuntimeFoundation } = await import("./server/routes/runtime-foundation.js");
const { handleScopeVersions } = await import("./server/routes/scopeversions.js");

const routes = [
  handleAuth,
  handleRuntime,
  handleScopeVersions,
  handleProposalDrafts,
  handleEngineeringCertification,
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

const ryan = await login("ryan", "ryan-alpha");
const kyle = await login("kyle", "kyle-alpha");

const proposalId = "PROPOSAL-GOOGLE-29M-SPRINT-13-5";
const packageId = "DRAFT-IOF-GOOGLE-29M-SPRINT-13-5";

let response = await runtimeRequest("POST", "/api/proposals", {
  proposal: {
    proposalId,
    proposalRecordId: proposalId,
    proposalNumber: "PROP-GOOGLE-29M-SPRINT-13-5",
    customerId: "customer-google",
    accountId: "google",
    opportunityId: "GOOGLE-29M-OPPORTUNITY",
    organizationId: "org-teralinx",
    workspaceId: ryan.workspace.workspaceId,
    ownerId: ryan.user.userId,
    commercialOwnerId: ryan.user.userId,
    assignedCustomerUsers: ["google-participant-001"],
    visibility: "SHARED",
    status: "CUSTOMER_APPROVED",
    approvalState: "APPROVED",
    title: "Google 29M IOF Package Proposal",
    summary: "Commercial proposal approved for Draft IOF Package assembly.",
    executiveSummary: "Google 29M package uses runtime references for opportunity, route, inventory, evidence, and geometry.",
    pricingSummary: { budgetCost: 29000000, sellPriceIru: 43500000, routeMiles: 29 },
    marginSummary: { grossMarginDollars: 14500000, grossMarginPercent: 33.3 },
    confidenceSummary: { commercialReadiness: 91 },
    commercialAssumptionIds: ["ASSUMPTION-GOOGLE-ROUTE-MILES", "ASSUMPTION-GOOGLE-IRU-TERM"],
    dealPointIds: ["DEAL-GOOGLE-29M"],
    runtimeObjectIds: [
      "RUNTIME-OPPORTUNITY-GOOGLE-29M",
      "RUNTIME-ROUTE-GOOGLE-29M",
      "RUNTIME-CUSTOMER-DESIGN-GOOGLE-29M",
    ],
    runtimeRelationshipIds: [
      "DERIVED_FROM:GOOGLE-29M-OPPORTUNITY",
      "EXTENDS_INVENTORY:RUNTIME-INVENTORY-GOOGLE-MUSKOGEE",
    ],
    runtimeEvidenceIds: ["EVIDENCE-GOOGLE-APPROVAL", "EVIDENCE-GOOGLE-KMZ", "EVIDENCE-GOOGLE-COMMERCIAL-REVIEW"],
    existingInventoryReferences: ["RUNTIME-INVENTORY-GOOGLE-MUSKOGEE", "RUNTIME-INVENTORY-GOOGLE-STILLWATER"],
    customerDesignReferences: ["CUSTOMER-DESIGN-GOOGLE-DIVERSITY-REQUEST"],
    customerTwinReference: "CUSTOMER-TWIN-GOOGLE",
    geometryReferences: ["GEOMETRY-GOOGLE-29M-A", "GEOMETRY-GOOGLE-29M-Z"],
    proposalDocumentReferences: ["DOC-GOOGLE-EXECUTIVE-SUMMARY", "DOC-GOOGLE-COMMERCIAL-PRICING"],
    dependencyIds: ["DEPENDENCY-PERMITTING", "DEPENDENCY-INVENTORY-VALIDATION"],
    comments: [{
      commentId: "CUSTOMER-REQUEST-GOOGLE-001",
      author: "Google Network Engineering",
      comment: "Proceed with the 29M diversity package for engineering review.",
      createdAt: new Date().toISOString(),
    }],
    approvedAt: new Date().toISOString(),
    readiness: { status: "READY_FOR_IOF_PACKAGE", canCreateDraftIofPackage: true, confidence: 91 },
    version: 1,
    noScopeVersionCreation: true,
    noInventoryMutation: true,
  },
}, ryan);
expectStatus("experience:approved-proposal-created", response, 201);

response = await runtimeRequest("POST", "/api/engineering/certification/draft-packages/from-proposal", {
  proposalId,
  packageId,
  assignedEngineerId: kyle.user.userId,
  assignedEngineer: kyle.user.name,
  priority: "HIGH",
}, kyle);
expectStatus("experience:draft-iof-created", response, 201);
let draft = response.json.draftPackage;
assertProof("experience:package-dashboard-fields", Boolean(draft.packageName && draft.packageId && draft.proposalId && draft.customerId && draft.opportunityId && draft.workspaceId), draft);
assertProof("experience:proposed-units-display-fields", draft.proposedIofUnits.length === 3 && draft.proposedIofUnits.every((unit) => (
  unit.unitType &&
  Number.isFinite(Number(unit.quantity)) &&
  Number.isFinite(Number(unit.commercialQuantity)) &&
  unit.marketplaceAdvisory === "NOT_REQUESTED" &&
  unit.engineeringDecision === "PENDING_ENGINEERING_REVIEW"
)), draft.proposedIofUnits);
assertProof("experience:no-forbidden-artifacts", draft.noMarketplaceCreation === true && draft.noContractCreation === true && draft.noSofCreation === true && draft.noSowCreation === true, draft);
assertProof("experience:manifest-present", draft.manifest?.objects?.length === 3 && draft.manifest?.relationships?.length === 2 && draft.manifest?.inventory?.length === 2, draft.manifest);
assertProof("experience:true-manifest-reference-only", draft.manifest?.duplicationPolicy === "REFERENCE_ONLY_RUNTIME_OBJECTS" && draft.manifest?.summary?.noDuplicateObjects === true, draft.manifest);
assertProof("experience:dependency-graph-present", draft.dependencyGraph?.nodes?.length > 0 && draft.dependencyGraph?.edges?.some((edge) => edge.relationship === "PACKAGED_IN_DRAFT_IOF"), draft.dependencyGraph);
assertProof("experience:readiness-model-present", Number(draft.packageReadiness?.readinessScore) > 0 && draft.validation?.checks?.length >= 7, { readiness: draft.packageReadiness, validation: draft.validation });

response = await runtimeRequest("GET", `/api/engineering/certification/draft-packages/${encodeURIComponent(packageId)}/manifest`, undefined, kyle);
expectStatus("experience:manifest-endpoint", response, 200);
assertProof("experience:manifest-endpoint-complete", response.json.manifest?.documents?.length === 2 && response.json.manifest?.customerRequests?.length >= 2, response.json.manifest);

response = await runtimeRequest("GET", `/api/engineering/certification/draft-packages/${encodeURIComponent(packageId)}/graph`, undefined, kyle);
expectStatus("experience:graph-endpoint", response, 200);
assertProof("experience:graph-endpoint-complete", response.json.dependencyGraph?.path?.includes("Proposal -> Runtime Objects"), response.json.dependencyGraph);

response = await runtimeRequest("GET", `/api/engineering/certification/draft-packages/${encodeURIComponent(packageId)}/readiness`, undefined, kyle);
expectStatus("experience:readiness-endpoint", response, 200);
assertProof("experience:readiness-endpoint-score", Number(response.json.packageReadiness?.readinessScore) >= 70, response.json.packageReadiness);

response = await runtimeRequest("GET", `/api/engineering/certification/draft-packages/${encodeURIComponent(packageId)}/differences`, undefined, kyle);
expectStatus("experience:differences-endpoint", response, 200);
assertProof("experience:differences-no-impact", response.json.packageDifferences?.engineeringImpact === "NO_IMPACT", response.json.packageDifferences);

response = await runtimeRequest("POST", `/api/engineering/certification/draft-packages/${encodeURIComponent(packageId)}/assign-engineer`, {
  assignedEngineerId: kyle.user.userId,
  assignedEngineer: kyle.user.name,
}, kyle);
expectStatus("experience:assign-engineer", response, 200);
draft = response.json.draftPackage;
assertProof("experience:assigned-engineer-retained", draft.assignedEngineerId === kyle.user.userId && draft.assignedEngineer === kyle.user.name, draft);

response = await runtimeRequest("GET", "/api/engineering/certification/queue", undefined, kyle);
expectStatus("experience:engineering-queue", response, 200);
assertProof("experience:engineering-queue-dashboard-row", response.json.engineeringReviewQueue.some((item) => (
  item.packageId === packageId &&
  item.packageName &&
  Number.isFinite(Number(item.packageCompleteness)) &&
  Number.isFinite(Number(item.assemblyConfidence))
)), response.json.engineeringReviewQueue);

const restartedKyle = await login("kyle", "kyle-alpha");
response = await runtimeRequest("GET", `/api/engineering/certification/draft-packages/${encodeURIComponent(packageId)}`, undefined, restartedKyle);
expectStatus("experience:persistence-after-restart-open", response, 200);
assertProof("experience:persistence-retains-runtime-spine", response.json.draftPackage?.manifest?.objects?.length === 3 && response.json.draftPackage?.dependencyGraph?.edges?.length > 0, response.json.draftPackage);

response = await runtimeRequest("GET", "/api/scopeversions", undefined, kyle);
expectStatus("experience:no-scopeversions", response, 200);
assertProof("experience:no-scopeversion-created", (response.json.scopeVersions ?? []).length === 0, response.json);

proof.completedAt = new Date().toISOString();
proof.summary = {
  assertions: proof.assertions.length,
  proposalId,
  packageId,
  proposedUnitCount: draft.proposedIofUnits.length,
  manifestObjectCount: draft.manifest.objects.length,
  graphNodeCount: draft.dependencyGraph.nodes.length,
  graphEdgeCount: draft.dependencyGraph.edges.length,
  readinessScore: draft.packageReadiness.readinessScore,
  dataRoot,
};

await mkdir(path.dirname(reportPath), { recursive: true });
await writeFile(reportPath, JSON.stringify(proof, null, 2));
console.log(JSON.stringify(proof.summary, null, 2));
