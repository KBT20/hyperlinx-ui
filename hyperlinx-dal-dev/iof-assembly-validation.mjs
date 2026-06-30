import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const dataRoot = path.join(projectRoot, ".tmp", "sprint13-4-iof-assembly");
const reportPath = path.join(projectRoot, ".tmp", "sprint13-4-iof-assembly-report.json");

function ensureSafeProofRoot(target) {
  const relative = path.relative(projectRoot, target);
  if (relative.startsWith("..") || path.isAbsolute(relative) || !relative.includes("sprint13-4-iof-assembly")) {
    throw new Error(`Refusing to reset unsafe IOF assembly data root: ${target}`);
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

const proposalId = "PROPOSAL-GOOGLE-29M-ASSEMBLY";
const packageId = "DRAFT-IOF-GOOGLE-29M-ASSEMBLY";

let response = await runtimeRequest("POST", "/api/proposals", {
  proposal: {
    proposalId,
    proposalRecordId: proposalId,
    proposalNumber: "PROP-GOOGLE-29M-ASSEMBLY",
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
    title: "Google 29M Assembly Proposal",
    summary: "Approved assembly source.",
    executiveSummary: "Assembly uses references only.",
    pricingSummary: { budgetCost: 100, sellPriceIru: 150, routeMiles: 29 },
    marginSummary: { grossMarginDollars: 50, grossMarginPercent: 33.3 },
    confidenceSummary: { commercialReadiness: 90 },
    commercialAssumptionIds: ["ASSUMPTION-1"],
    dealPointIds: ["DEAL-1"],
    runtimeObjectIds: ["RUNTIME-OPPORTUNITY-GOOGLE-29M", "RUNTIME-ROUTE-GOOGLE-29M"],
    runtimeRelationshipIds: ["DERIVED_FROM:GOOGLE-29M-OPPORTUNITY"],
    runtimeEvidenceIds: ["EVIDENCE-GOOGLE-APPROVAL"],
    existingInventoryReferences: ["RUNTIME-INVENTORY-GOOGLE"],
    customerDesignReferences: ["CUSTOMER-DESIGN-GOOGLE"],
    customerTwinReference: "CUSTOMER-TWIN-GOOGLE",
    geometryReferences: ["GEOMETRY-GOOGLE-29M"],
    proposalDocumentReferences: ["DOC-GOOGLE-PROPOSAL"],
    approvedAt: new Date().toISOString(),
    noScopeVersionCreation: true,
    noInventoryMutation: true,
  },
}, ryan);
expectStatus("assembly:approved-proposal-created", response, 201);

response = await runtimeRequest("POST", "/api/engineering/certification/draft-packages/from-proposal", {
  proposalId,
  packageId,
  assignedEngineerId: kyle.user.userId,
  assignedEngineer: kyle.user.name,
}, kyle);
expectStatus("assembly:draft-iof-created", response, 201);
const draft = response.json.draftPackage;
assertProof("assembly:draft-status", draft.status === "DRAFT" && draft.workflowStatus === "ENGINEERING_REVIEW", draft);
assertProof("assembly:proposed-units", draft.proposedIofUnits.length === 2 && draft.proposedIofUnits.every((unit) => unit.status === "PROPOSED"), draft);
assertProof("assembly:references-only", draft.assemblyReport.noDuplicateRuntimeObjects === true && draft.assemblyReport.noScopeVersionCreated === true, draft.assemblyReport);

response = await runtimeRequest("GET", "/api/engineering/certification/queue", undefined, kyle);
expectStatus("assembly:queue-visible", response, 200);
assertProof("assembly:queue-contains-package", response.json.engineeringReviewQueue.some((item) => item.packageId === packageId), response.json);

response = await runtimeRequest("GET", "/api/scopeversions", undefined, kyle);
expectStatus("assembly:no-scopeversions", response, 200);
assertProof("assembly:no-scopeversion-created", (response.json.scopeVersions ?? []).length === 0, response.json);

proof.completedAt = new Date().toISOString();
proof.summary = {
  assertions: proof.assertions.length,
  proposalId,
  packageId,
  proposedUnitCount: draft.proposedIofUnits.length,
  dataRoot,
};

await mkdir(path.dirname(reportPath), { recursive: true });
await writeFile(reportPath, JSON.stringify(proof, null, 2));
console.log(JSON.stringify(proof.summary, null, 2));
