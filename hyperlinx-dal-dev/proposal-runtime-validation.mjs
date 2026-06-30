import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const dataRoot = path.join(projectRoot, ".tmp", "sprint13-25-proposal-runtime");
const reportPath = path.join(projectRoot, ".tmp", "sprint13-25-proposal-runtime-report.json");

function ensureSafeProofRoot(target) {
  const relative = path.relative(projectRoot, target);
  if (relative.startsWith("..") || path.isAbsolute(relative) || !relative.includes("sprint13-25-proposal-runtime")) {
    throw new Error(`Refusing to reset unsafe proposal proof data root: ${target}`);
  }
}

ensureSafeProofRoot(dataRoot);
await rm(dataRoot, { recursive: true, force: true });
await mkdir(dataRoot, { recursive: true });
process.env.DAL_DATA_ROOT = dataRoot;
process.env.DAL_PORT = process.env.DAL_PORT ?? "0";

const { handleActivity } = await import("./server/routes/activity.js");
const { handleAuth } = await import("./server/routes/auth.js");
const { handleIofPackages } = await import("./server/routes/iof-packages.js");
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
  handleRuntimeFoundation,
  handleIofPackages,
];

const IDS = {
  org: "org-teralinx",
  customerId: "customer-google",
  opportunity: "GOOGLE-29M-OPPORTUNITY",
  proposal: "PROPOSAL-GOOGLE-29M-RUNTIME",
  proposalRuntime: "RUNTIME-PROPOSAL-PROPOSAL-GOOGLE-29M-RUNTIME",
  opportunityRuntime: "RUNTIME-OPPORTUNITY-GOOGLE-29M-OPPORTUNITY",
  inventory: "RUNTIME-INVENTORY-CUSTOMER-GOOGLE-AUSTIN",
  twin: "CUSTOMER-TWIN-GOOGLE-AUSTIN",
  inventoryRoute: "RUNTIME-ROUTE-GOOGLE-AUSTIN-EXISTING-001",
  customerDesign: "CUSTOMER-DESIGN-GOOGLE-29M",
  geometry: "GEOMETRY-GOOGLE-AUSTIN-29M",
};

const proof = {
  startedAt: new Date().toISOString(),
  dataRoot,
  assertions: [],
  lifecycle: [],
  authority: [],
  runtime: [],
  gaps: [],
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

async function listProposals(session) {
  const response = await runtimeRequest("GET", "/api/proposals", undefined, session);
  expectStatus(`proposal:list:${session.username}`, response, 200);
  return response.json.proposals ?? [];
}

async function getProposal(session, proposalId) {
  const response = await runtimeRequest("GET", `/api/proposals/${encodeURIComponent(proposalId)}`, undefined, session);
  expectStatus(`proposal:get:${session.username}:${proposalId}`, response, 200);
  return response.json.proposal;
}

function proposalInput(ryan) {
  return {
    proposalId: IDS.proposal,
    proposalRecordId: IDS.proposal,
    proposalRecordType: "PROPOSAL_RUNTIME_OBJECT",
    proposalNumber: "PROP-GOOGLE-29M-001",
    customerId: IDS.customerId,
    accountId: "google",
    opportunityId: IDS.opportunity,
    organizationId: IDS.org,
    workspaceId: ryan.workspace.workspaceId,
    ownerId: ryan.user.userId,
    commercialOwnerId: ryan.user.userId,
    assignedCustomerUsers: [],
    visibility: "PRIVATE",
    status: "COMMERCIAL_DRAFT",
    title: "Google Austin 29M Commercial Proposal",
    summary: "Commercial proposal for the Google Austin 29 mile network extension.",
    executiveSummary: "Proposal is assembled from Runtime references and customer inventory evidence.",
    pricingSummary: {
      budgetCost: 11800000,
      sellPriceIru: 17700000,
      mrcRevenue: 420000,
      routeMiles: 29,
    },
    marginSummary: {
      grossMarginDollars: 5900000,
      grossMarginPercent: 33.3,
    },
    confidenceSummary: {
      commercialReadiness: 88,
      runtimeHealth: "PASS",
    },
    commercialAssumptionIds: ["ASSUMPTION-GOOGLE-AUSTIN-CIVIL-MIX"],
    dealPointIds: ["DEALPOINT-GOOGLE-IRU", "DEALPOINT-GOOGLE-SLA"],
    runtimeObjectIds: [IDS.opportunityRuntime, IDS.inventoryRoute],
    runtimeRelationshipIds: [`DERIVED_FROM:${IDS.opportunity}`, `REFERENCES_INVENTORY:${IDS.inventory}`],
    runtimeEvidenceIds: ["EVIDENCE-GOOGLE-COMMERCIAL-DRAFT"],
    existingInventoryReferences: [IDS.inventory],
    customerDesignReferences: [IDS.customerDesign],
    customerTwinReference: IDS.twin,
    geometryReferences: [IDS.geometry],
    proposalDocumentReferences: ["DOC-GOOGLE-COMMERCIAL-PREVIEW"],
    attachments: [],
    comments: [],
    reviewers: [],
    approvalState: "NOT_SUBMITTED",
    version: 1,
    noScopeVersionCreation: true,
    noInventoryMutation: true,
  };
}

const ryan = await login("ryan", "ryan-alpha");
const kyle = await login("kyle", "kyle-alpha");
const fran = await login("fran", "fran-alpha");
const google = await login("google", "google-alpha");

assertProof("workspace:ryan:is-independent", ryan.workspace.workspaceId === "workspace-teralinx-ryan", { workspaceId: ryan.workspace.workspaceId });
assertProof("workspace:fran:is-independent", fran.workspace.workspaceId === "workspace-teralinx-fran", { workspaceId: fran.workspace.workspaceId });
assertProof("workspace:kyle:is-independent", kyle.workspace.workspaceId === "workspace-teralinx-kyle", { workspaceId: kyle.workspace.workspaceId });
assertProof("workspace:google:is-customer", google.workspace.workspaceId === "workspace-google-customer", { workspaceId: google.workspace.workspaceId });

let response = await runtimeRequest("POST", "/api/proposals", { proposal: proposalInput(ryan) }, ryan);
expectStatus("proposal:create:ryan", response, 201);
let proposal = response.json.proposal;
note("lifecycle", "created", { status: proposal.status, ownerId: proposal.ownerId, visibility: proposal.visibility });
assertProof("proposal:created:owned-by-ryan", proposal.ownerId === ryan.user.userId && proposal.commercialOwnerId === ryan.user.userId, proposal);
assertProof("proposal:created:private", proposal.visibility === "PRIVATE", { visibility: proposal.visibility });
assertProof("proposal:created:no-scopeversion", proposal.noScopeVersionCreation === true, { noScopeVersionCreation: proposal.noScopeVersionCreation });

let googleVisible = await listProposals(google);
assertProof("proposal:isolation:google-cannot-see-private-draft", !googleVisible.some((item) => item.proposalId === IDS.proposal), { visibleCount: googleVisible.length });
let franVisible = await listProposals(fran);
assertProof("proposal:isolation:fran-cannot-see-private-draft", !franVisible.some((item) => item.proposalId === IDS.proposal), { visibleCount: franVisible.length });

response = await runtimeRequest("PUT", `/api/proposals/${encodeURIComponent(IDS.proposal)}`, { proposal: { ...proposal, title: "Kyle unauthorized edit" } }, kyle);
expectStatus("proposal:authority:kyle-cannot-modify-ryan-draft", response, 403);
note("authority", "kyle-write-denied", { status: response.status });

response = await runtimeRequest("POST", `/api/proposals/${encodeURIComponent(IDS.proposal)}/submit-customer`, { assignedCustomerUsers: [google.user.userId] }, ryan);
expectStatus("proposal:submit-customer:ryan", response, 200);
proposal = response.json.proposal;
assertProof("proposal:submitted:visible-shared", proposal.visibility === "SHARED" && proposal.status === "WAITING_CUSTOMER_REVIEW", { status: proposal.status, visibility: proposal.visibility });
assertProof("proposal:submitted:assigned-google", proposal.assignedCustomerUsers.includes(google.user.userId), { assignedCustomerUsers: proposal.assignedCustomerUsers });

googleVisible = await listProposals(google);
assertProof("proposal:customer-dashboard:assigned-visible", googleVisible.some((item) => item.proposalId === IDS.proposal), { visibleIds: googleVisible.map((item) => item.proposalId) });

response = await runtimeRequest("PUT", `/api/proposals/${encodeURIComponent(IDS.proposal)}`, { proposal: { ...proposal, pricingSummary: { sellPriceIru: 1 } } }, google);
expectStatus("proposal:authority:customer-cannot-edit-pricing", response, 403);

response = await runtimeRequest("POST", `/api/proposals/${encodeURIComponent(IDS.proposal)}/comment`, { comment: "Customer requests SLA clarification." }, google);
expectStatus("proposal:customer:comment", response, 200);
proposal = response.json.proposal;
assertProof("proposal:comment:recorded", proposal.comments.some((item) => item.text.includes("SLA")), { comments: proposal.comments });

response = await runtimeRequest("POST", `/api/proposals/${encodeURIComponent(IDS.proposal)}/upload-evidence`, {
  sourceName: "Google review notes.pdf",
  sourceType: "CUSTOMER_UPLOAD",
  metadata: { reviewRound: 1 },
}, google);
expectStatus("proposal:customer:evidence-upload", response, 200);
proposal = response.json.proposal;
assertProof("proposal:evidence:linked", proposal.runtimeEvidenceIds.includes(response.json.evidence.evidenceId), { runtimeEvidenceIds: proposal.runtimeEvidenceIds });

response = await runtimeRequest("POST", `/api/proposals/${encodeURIComponent(IDS.proposal)}/request-changes`, { comment: "Revise diversity assumption and resubmit." }, google);
expectStatus("proposal:customer:request-changes", response, 200);
proposal = response.json.proposal;
assertProof("proposal:changes-requested:state", proposal.status === "CUSTOMER_CHANGES_REQUESTED" && proposal.approvalState === "CHANGES_REQUESTED", { status: proposal.status, approvalState: proposal.approvalState });

response = await runtimeRequest("POST", `/api/proposals/${encodeURIComponent(IDS.proposal)}/revision`, {
  reason: "v2 addresses customer diversity assumption.",
  proposal: {
    pricingSummary: {
      budgetCost: 11900000,
      sellPriceIru: 17800000,
      routeMiles: 29,
    },
  },
  changes: {
    changedRuntimeObjectIds: [IDS.inventoryRoute],
    changedDealPointIds: ["DEALPOINT-GOOGLE-SLA"],
    changedPricingFields: ["pricingSummary"],
    changedGeometryReferences: [IDS.geometry],
  },
}, ryan);
expectStatus("proposal:revision:ryan", response, 200);
proposal = response.json.proposal;
assertProof("proposal:revision:versioned", proposal.version === 2 && proposal.versions.length === 2, { version: proposal.version, versions: proposal.versions });
assertProof("proposal:revision:v1-immutable", proposal.versions[0].version === 1 && proposal.versions[1].version === 2, { versions: proposal.versions });

response = await runtimeRequest("POST", `/api/proposals/${encodeURIComponent(IDS.proposal)}/submit-customer`, { assignedCustomerUsers: [google.user.userId] }, ryan);
expectStatus("proposal:resubmit-customer:ryan", response, 200);

response = await runtimeRequest("POST", `/api/proposals/${encodeURIComponent(IDS.proposal)}/approve`, { comment: "Approved for Draft IOF package readiness." }, google);
expectStatus("proposal:customer:approve", response, 200);
proposal = response.json.proposal;
assertProof("proposal:approved:customer", proposal.status === "CUSTOMER_APPROVED" && proposal.approvalState === "APPROVED", { status: proposal.status, approvalState: proposal.approvalState });
assertProof("proposal:approved:readiness-ready", proposal.readiness.canCreateDraftIofPackage === true, proposal.readiness);

response = await runtimeRequest("POST", `/api/proposals/${encodeURIComponent(IDS.proposal)}/create-draft-iof-package`, undefined, google);
expectStatus("proposal:authority:customer-cannot-create-draft-iof", response, 403);

response = await runtimeRequest("POST", `/api/proposals/${encodeURIComponent(IDS.proposal)}/create-draft-iof-package`, undefined, ryan);
expectStatus("proposal:draft-iof-source:ryan", response, 200);
assertProof("proposal:draft-iof-source:no-assembly", response.json.draftIofPackageSource.noIofPackageCreated === true && response.json.draftIofPackageSource.sprint13_3AssemblyRequired === true, response.json.draftIofPackageSource);
proposal = response.json.proposal;
note("lifecycle", "draft-iof-source-exposed", { status: proposal.status, nextLifecycleAction: proposal.nextLifecycleAction });

response = await runtimeRequest("GET", "/api/runtime/objects", undefined, ryan);
expectStatus("runtime:objects:list", response, 200);
const runtimeObjects = response.json.runtimeObjects ?? [];
const proposalRuntimeObjects = runtimeObjects.filter((item) => item.objectType === "PROPOSAL" && item.objectId === IDS.proposal);
assertProof("runtime:proposal-mirror:single-authoritative-object", proposalRuntimeObjects.length === 1, { proposalRuntimeObjects });
assertProof("runtime:proposal-mirror:owner-retained", proposalRuntimeObjects[0]?.ownerId === ryan.user.userId, proposalRuntimeObjects[0]);

response = await runtimeRequest("GET", "/api/runtime/history", undefined, ryan);
expectStatus("runtime:history:list", response, 200);
const history = response.json.history ?? [];
assertProof("runtime:history:comment-event", history.some((item) => item.eventType === "runtime.proposal.comment.created"), { historyCount: history.length });
assertProof("runtime:history:approval-event", history.some((item) => item.eventType === "runtime.proposal.customer.approved"), { historyCount: history.length });
assertProof("runtime:history:lifecycle-approval-event", history.some((item) => item.eventType === "CUSTOMER_APPROVED"), { historyCount: history.length });
assertProof("runtime:history:source-exposed-event", history.some((item) => item.eventType === "runtime.proposal.draft_iof.source_exposed"), { historyCount: history.length });

response = await runtimeRequest("GET", "/api/runtime/evidence", undefined, ryan);
expectStatus("runtime:evidence:list", response, 200);
const evidence = response.json.evidence ?? [];
assertProof("runtime:evidence:customer-upload-registered", evidence.some((item) => item.sourceName === "Google review notes.pdf" && item.authority === "CUSTOMER_EVIDENCE"), { evidence });

response = await runtimeRequest("GET", "/api/iof-packages", undefined, kyle);
expectStatus("iof:list:kyle:approval-package-created", response, 200);
assertProof("iof:package-created-by-approval-bridge", (response.json.iofPackages ?? []).filter((item) => item.proposalId === IDS.proposal).length === 1, response.json);

response = await runtimeRequest("GET", "/api/scopeversions", undefined, kyle);
expectStatus("scopeversion:list:kyle:no-scopeversions-created", response, 200);
assertProof("scopeversion:no-scopeversion-created-by-proposal", (response.json.scopeVersions ?? response.json.scopeversions ?? []).length === 0, response.json);

await runtimeRequest("POST", "/api/auth/logout", undefined, ryan);
const ryanAgain = await login("ryan", "ryan-alpha");
proposal = await getProposal(ryanAgain, IDS.proposal);
assertProof("proposal:persistence:after-logout-login", proposal.status === "READY_FOR_IOF_PACKAGE" && proposal.version === 2, { status: proposal.status, version: proposal.version });

const storedProposal = JSON.parse(await readFile(path.join(dataRoot, "proposal-drafts", `${encodeURIComponent(IDS.proposal)}.json`), "utf8"));
assertProof("proposal:persistence:file-backed", storedProposal.proposalId === IDS.proposal && storedProposal.historyIds.length >= 8, { historyIds: storedProposal.historyIds });

proof.completedAt = new Date().toISOString();
proof.summary = {
  assertions: proof.assertions.length,
  lifecycleEvents: proof.lifecycle.length,
  authorityEvents: proof.authority.length,
  runtimeEvents: proof.runtime.length,
  proposalStatus: proposal.status,
  proposalVersion: proposal.version,
  dataRoot,
};

await mkdir(path.dirname(reportPath), { recursive: true });
await writeFile(reportPath, JSON.stringify(proof, null, 2));
console.log(JSON.stringify(proof.summary, null, 2));
