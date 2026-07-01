import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const dataRoot = path.join(projectRoot, ".tmp", "sprint17-runtime-rehydration");
const reportPath = path.join(projectRoot, ".tmp", "sprint17-runtime-rehydration-report.json");

function ensureSafeProofRoot(target) {
  const relative = path.relative(projectRoot, target);
  if (relative.startsWith("..") || path.isAbsolute(relative) || !relative.includes("sprint17-runtime-rehydration")) {
    throw new Error(`Refusing to reset unsafe Sprint 17 data root: ${target}`);
  }
}

ensureSafeProofRoot(dataRoot);
await rm(dataRoot, { recursive: true, force: true });
await mkdir(dataRoot, { recursive: true });
process.env.DAL_DATA_ROOT = dataRoot;
process.env.DAL_PORT = process.env.DAL_PORT ?? "0";

const { DIRS, listRecords } = await import("./server/routes/_shared.js");
const { handleAccounts } = await import("./server/routes/accounts.js");
const { handleAuth } = await import("./server/routes/auth.js");
const { handleCommercialOpportunities } = await import("./server/routes/commercial-opportunities.js");
const { handleEngineeringCertification } = await import("./server/routes/engineering-certification.js");
const { handleIofPackages } = await import("./server/routes/iof-packages.js");
const { handleProductFulfillment } = await import("./server/routes/product-fulfillment.js");
const { handleProposalDrafts } = await import("./server/routes/proposal-drafts.js");
const { handleRuntime } = await import("./server/routes/runtime.js");
const { handleRuntimeFoundation } = await import("./server/routes/runtime-foundation.js");
const { handleRuntimeLifecycleBridge } = await import("./server/routes/runtime-lifecycle-bridge.js");
const { handleRuntimeWorkspaceSession } = await import("./server/routes/runtime-workspace-session.js");
const { handleScopeVersions } = await import("./server/routes/scopeversions.js");
const { handleTwinState } = await import("./server/routes/twin-state.js");

const routes = [
  handleAuth,
  handleRuntime,
  handleAccounts,
  handleScopeVersions,
  handleCommercialOpportunities,
  handleProposalDrafts,
  handleProductFulfillment,
  handleEngineeringCertification,
  handleRuntimeLifecycleBridge,
  handleRuntimeWorkspaceSession,
  handleRuntimeFoundation,
  handleIofPackages,
  handleTwinState,
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
  certificationConfidence: 98,
  engineeringNotes: "Sprint 17 Runtime rehydration certification complete.",
};

const ryan = await login("ryan", "ryan-alpha");
const kyle = await login("kyle", "kyle-alpha");
const google = await login("google", "google-alpha");

let response = await runtimeRequest("GET", "/api/runtime", undefined, ryan);
expectStatus("runtime:info", response, 200);
assertProof("runtime:rehydration-advertised", response.json.libraries.workspaceSessionLibrary === true && response.json.libraries.runtimeRehydration === true, response.json.libraries);

response = await runtimeRequest("POST", "/api/accounts", {
  account: {
    accountId: "google",
    customerId: "customer-google",
    name: "Google",
    accountType: "Hyperscaler",
    status: "Active RFP",
    salesOwner: "Ryan",
    primaryEngineeringContact: "Google Network Engineering",
    procurementContact: "Google Procurement",
    organizationId: ryan.user.organizationId,
    workspaceId: ryan.workspace.workspaceId,
    commercialEngagements: ["Google Runtime rehydration doctrine"],
    activeOpportunities: ["Google Runtime OS Opportunity"],
    notes: "Sprint 17 governed Account root.",
  },
}, ryan);
expectStatus("account:create", response, 201);

response = await runtimeRequest("POST", "/api/accounts/google/contacts", {
  contact: {
    contactId: "contact-google-runtime-restore",
    accountId: "google",
    name: "Google Runtime Restore Contact",
    title: "Review Authority",
    role: "Commercial Review",
    email: "runtime-restore@example.google",
    status: "Active",
    proposalRecipient: true,
    customerReviewRecipient: true,
    approvalAuthority: true,
    sofRecipient: true,
  },
}, ryan);
expectStatus("contact:create", response, 201);

const quoteInput = {
  trigger: "QUOTE_READY_FOR_CUSTOMER",
  accountId: "google",
  customerId: "customer-google",
  customerName: "Google",
  organizationId: ryan.user.organizationId,
  workspaceId: ryan.workspace.workspaceId,
  opportunityId: "COMMERCIAL-OPPORTUNITY-GOOGLE-RUNTIME-OS-SPRINT17",
  opportunity: {
    accountId: "google",
    customerId: "customer-google",
    name: "Google Runtime OS Opportunity",
    selectedScopeId: "GOOGLE-RUNTIME-OS-SCOPE",
    commercialDraftType: "NEW_GRAPH_CORRIDOR",
  },
  commercialDraftId: "COMMERCIAL-DRAFT-GOOGLE-RUNTIME-OS-SPRINT17",
  commercialDraft: {
    accountId: "google",
    customerId: "customer-google",
    revision: 1,
    routeId: "ROUTE-GOOGLE-RUNTIME-OS-SPRINT17",
    draftType: "NEW_GRAPH_CORRIDOR",
  },
  proposalId: "PROPOSAL-GOOGLE-RUNTIME-OS-SPRINT17",
  proposalNumber: "PROP-GOOGLE-RUNTIME-OS-SPRINT17",
  productId: "PRODUCT-L1-PROTECTED-DARK-FIBER-IRU",
  productName: "Protected Dark Fiber IRU",
  productConfiguration: {
    termYears: 20,
    protected: true,
    routeMiles: 33,
    selectedScopeId: "GOOGLE-RUNTIME-OS-SCOPE",
  },
  fulfillmentMix: [
    { ownershipClass: "CUSTOMER_OWNED", label: "Customer Existing Ring", percentage: 40 },
    { ownershipClass: "TERALINX_OWNED", label: "Teralinx Backbone", percentage: 35 },
    { ownershipClass: "PARTNER_OWNED", label: "Partner Longhaul", percentage: 15 },
    { ownershipClass: "NEW_CONSTRUCTION", label: "New Construction", percentage: 10 },
  ],
  title: "Google Runtime OS Proposal",
  summary: "Sprint 17 proposal used to prove Runtime rehydration.",
  executiveSummary: "Runtime owns lifecycle state and all workspaces project it.",
  pricingSummary: {
    nrcRevenue: 33000000,
    sellPriceIru: 33000000,
    iruTermYears: 20,
    budgetCost: 21500000,
    routeMiles: 33,
  },
  marginSummary: { grossMarginDollars: 11500000, grossMarginPercent: 34.8 },
  confidenceSummary: { commercialReadiness: 97, runtimeHealth: "PASS" },
  commercialAssumptionIds: ["ASSUMPTION-SPRINT17-RUNTIME-OS"],
  dealPointIds: ["DEAL-SPRINT17-RUNTIME-OS-IRU"],
  runtimeObjectIds: ["RUNTIME-GRAPH-GOOGLE-RUNTIME-OS", "RUNTIME-INVENTORY-SPRINT17-BACKBONE"],
  runtimeRelationshipIds: ["GRAPH_SUPPORTS_PROPOSAL:RUNTIME-GRAPH-GOOGLE-RUNTIME-OS"],
  runtimeEvidenceIds: ["EVIDENCE-SPRINT17-RUNTIME-OS-QUOTE"],
  existingInventoryReferences: ["RUNTIME-INVENTORY-SPRINT17-BACKBONE"],
  customerDesignReferences: ["CUSTOMER-DESIGN-SPRINT17-GOOGLE"],
  partnerInventoryReferences: ["PARTNER-LONGHAUL-SPRINT17"],
  marketplaceAssetReferences: ["MARKETPLACE-WAVELENGTH-SPRINT17"],
  newInfrastructureRequired: ["NEW-CONSTRUCTION-SPRINT17-LATERAL"],
  customerTwinReference: "CUSTOMER-TWIN-GOOGLE",
  geometryReferences: ["ROUTE-GOOGLE-RUNTIME-OS-SPRINT17", "GEOMETRY-SPRINT17-A", "GEOMETRY-SPRINT17-Z"],
  proposalDocumentReferences: ["DOC-SPRINT17-RUNTIME-OS-PROPOSAL"],
  assignedCustomerUsers: ["google-participant-001"],
  proposalRecipientContactIds: ["contact-google-runtime-restore"],
  customerReviewContactIds: ["contact-google-runtime-restore"],
  approvalAuthorityContactIds: ["contact-google-runtime-restore"],
  sofRecipientContactIds: ["contact-google-runtime-restore"],
  customerContactEmails: ["runtime-restore@example.google"],
  assignedEngineerId: "teralinx-user-kyle",
  assignedEngineer: "Kyle",
};

response = await runtimeRequest("POST", "/api/runtime/lifecycle/advance", quoteInput, ryan);
expectStatus("lifecycle:advance", response, 200);
const initialWorkspaceSession = response.json.workspaceSession;
assertProof("session:created-by-lifecycle", initialWorkspaceSession?.proposalId === quoteInput.proposalId && initialWorkspaceSession?.currentAuthority === "CUSTOMER_REVIEW", initialWorkspaceSession);

response = await runtimeRequest("POST", `/api/proposals/${encodeURIComponent(quoteInput.proposalId)}/approve`, {
  comment: "Approved for Sprint 17 Runtime rehydration.",
}, google);
expectStatus("proposal:approve", response, 200);
let draft = response.json.draftPackage;
assertProof("session:updated-by-customer-approval", response.json.workspaceSession?.currentAuthority === "ENGINEERING_REVIEW" && response.json.workspaceSession?.packageId === draft.packageId, response.json.workspaceSession);

for (const unit of draft.proposedIofUnits) {
  response = await runtimeRequest("POST", `/api/engineering/certification/draft-packages/${encodeURIComponent(draft.packageId)}/units/${encodeURIComponent(unit.unitId)}/certify`, {
    engineeringNote: `Sprint 17 certified ${unit.unitId}`,
    engineeringConfidence: 98,
    engineeringRisk: "ACCEPTED",
  }, kyle);
  expectStatus(`engineering:certify-unit:${unit.unitId}`, response, 200);
  draft = response.json.iofPackage;
}

response = await runtimeRequest("POST", `/api/engineering/certification/draft-packages/${encodeURIComponent(draft.packageId)}/certify`, {
  certifiedPackageId: "CERT-IOF-GOOGLE-RUNTIME-OS-SPRINT17",
  checklist: completeChecklist,
}, kyle);
expectStatus("engineering:certify-package", response, 200);
const certified = response.json.certifiedIofPackage;
const scopeVersion = response.json.scopeVersion;
assertProof("session:updated-by-engineering", response.json.workspaceSession?.currentAuthority === "EXECUTION" && response.json.workspaceSession?.scopeVersionId === scopeVersion.scopeVersionId, response.json.workspaceSession);

const countsBeforeReload = {
  proposals: (await listRecords(DIRS.proposalDrafts)).length,
  draftPackages: (await listRecords(DIRS.iofPackages)).length,
  scopeVersions: (await listRecords(DIRS.scopeVersions)).length,
  workspaceSessions: (await listRecords(DIRS.runtimeWorkspaceSessions)).length,
};

const ryanReloaded = await login("ryan", "ryan-alpha");
response = await runtimeRequest("GET", "/api/runtime/rehydrate", undefined, ryanReloaded);
expectStatus("runtime:rehydrate", response, 200);
const restored = response.json;
assertProof("rehydrate:account-restored", restored.account?.accountId === "google", restored);
assertProof("rehydrate:opportunity-restored", restored.opportunity?.opportunityId === quoteInput.opportunityId, restored.opportunity);
assertProof("rehydrate:proposal-restored", restored.proposal?.proposalId === quoteInput.proposalId, restored.proposal);
assertProof("rehydrate:route-restored", restored.route?.geometryReferences?.includes("ROUTE-GOOGLE-RUNTIME-OS-SPRINT17"), restored.route);
assertProof("rehydrate:graph-restored", restored.graph?.runtimeObjectIds?.includes("RUNTIME-GRAPH-GOOGLE-RUNTIME-OS"), restored.graph);
assertProof("rehydrate:pricing-restored", Number(restored.proposal?.pricingSummary?.nrcRevenue) === 33000000, restored.proposal?.pricingSummary);
assertProof("rehydrate:authority-restored", restored.currentAuthority === "EXECUTION" && restored.currentLifecycleStage === "EXECUTION_AUTHORIZED", restored.workspaceSession);
assertProof("rehydrate:revision-restored", String(restored.workspaceSession.selectedProposalRevision || restored.proposal?.version), restored.workspaceSession);
assertProof("rehydrate:package-restored", restored.draftPackage?.packageId === draft.packageId, restored.draftPackage);
assertProof("rehydrate:certified-restored", restored.certifiedPackage?.certifiedPackageId === certified.certifiedPackageId, restored.certifiedPackage);
assertProof("rehydrate:scopeversion-restored", restored.scopeVersion?.scopeVersionId === scopeVersion.scopeVersionId, restored.scopeVersion);
assertProof("rehydrate:session-restored", restored.workspaceSession?.proposalId === quoteInput.proposalId && restored.workspaceSession?.runtimeIsSingleSourceOfTruth === true, restored.workspaceSession);
assertProof("rehydrate:activity-restored", restored.runtimeHistory.length >= 10, { historyCount: restored.runtimeHistory.length });
assertProof("rehydrate:no-recreation", countsBeforeReload.proposals === (await listRecords(DIRS.proposalDrafts)).length && countsBeforeReload.scopeVersions === (await listRecords(DIRS.scopeVersions)).length, countsBeforeReload);

response = await runtimeRequest("GET", "/api/twin/state", undefined, ryanReloaded);
expectStatus("twin:state", response, 200);
assertProof("twin:restores-runtime-projection", response.json.commercialRuntimeObjects.some((item) => item.objectType === "PROPOSAL" && item.objectId === quoteInput.proposalId), response.json.commercialRuntimeObjects);

const workspaceSessions = await listRecords(DIRS.runtimeWorkspaceSessions);
const runtimeObjects = await listRecords(DIRS.runtimeObjects);
const runtimeHistory = await listRecords(DIRS.runtimeHistory);
assertProof("persistence:workspace-session", workspaceSessions.some((session) => session.userId === ryan.user.userId && session.scopeVersionId === scopeVersion.scopeVersionId), workspaceSessions);
assertProof("persistence:workspace-session-runtime-object", runtimeObjects.some((object) => object.objectType === "WORKSPACE_SESSION" && object.metadata?.scopeVersionId === scopeVersion.scopeVersionId), runtimeObjects);
assertProof("persistence:authority-transactions-recorded", runtimeHistory.some((event) => event.eventType === "AUTHORITY_TRANSFER_ENGINEERING_TO_EXECUTION"), runtimeHistory);

proof.completedAt = new Date().toISOString();
proof.summary = {
  assertions: proof.assertions.length,
  accountId: "google",
  opportunityId: quoteInput.opportunityId,
  proposalId: quoteInput.proposalId,
  draftPackageId: draft.packageId,
  certifiedPackageId: certified.certifiedPackageId,
  scopeVersionId: scopeVersion.scopeVersionId,
  workspaceSessionId: restored.workspaceSession.sessionId,
  currentAuthority: restored.currentAuthority,
  runtimeObjectCount: runtimeObjects.length,
  runtimeHistoryCount: runtimeHistory.length,
  dataRoot,
};

await mkdir(path.dirname(reportPath), { recursive: true });
await writeFile(reportPath, JSON.stringify(proof, null, 2));
console.log(JSON.stringify(proof.summary, null, 2));
