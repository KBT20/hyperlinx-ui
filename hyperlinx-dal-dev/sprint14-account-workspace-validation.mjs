import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const dataRoot = path.join(projectRoot, ".tmp", "sprint14-account-workspace");
const reportPath = path.join(projectRoot, ".tmp", "sprint14-account-workspace-report.json");

function ensureSafeProofRoot(target) {
  const relative = path.relative(projectRoot, target);
  if (relative.startsWith("..") || path.isAbsolute(relative) || !relative.includes("sprint14-account-workspace")) {
    throw new Error(`Refusing to reset unsafe Sprint 14 data root: ${target}`);
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
const { handleProposalDrafts } = await import("./server/routes/proposal-drafts.js");
const { handleRuntime } = await import("./server/routes/runtime.js");
const { handleRuntimeFoundation } = await import("./server/routes/runtime-foundation.js");
const { handleRuntimeLifecycleBridge } = await import("./server/routes/runtime-lifecycle-bridge.js");
const { handleScopeVersions } = await import("./server/routes/scopeversions.js");
const { handleTwinState } = await import("./server/routes/twin-state.js");

const routes = [
  handleAuth,
  handleRuntime,
  handleAccounts,
  handleScopeVersions,
  handleCommercialOpportunities,
  handleProposalDrafts,
  handleEngineeringCertification,
  handleRuntimeLifecycleBridge,
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
  certificationConfidence: 96,
  engineeringNotes: "Sprint 14 Google Helium certification complete.",
};

const ryan = await login("ryan", "ryan-alpha");
const kyle = await login("kyle", "kyle-alpha");
const google = await login("google", "google-alpha");

let response = await runtimeRequest("POST", "/api/accounts", {
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
    commercialEngagements: ["Google Helium commercial response"],
    activeOpportunities: ["Helium Campus Opportunity"],
    notes: "Sprint 14 governed Account workspace root.",
  },
}, ryan);
expectStatus("account:create-google", response, 201);
const account = response.json.account;
assertProof("account:governed-root", account.accountId === "google" && account.runtimeObjectId, account);

for (const contact of [
  { contactId: "contact-google-network-engineering", name: "Google Network Engineering", title: "Network Engineering", role: "Engineering", email: "network-engineering@example.google" },
  { contactId: "contact-google-sourcing", name: "Google Sourcing", title: "Sourcing", role: "Procurement", email: "sourcing@example.google" },
]) {
  response = await runtimeRequest("POST", "/api/accounts/google/contacts", {
    contact: { ...contact, accountId: "google", status: "Active" },
  }, ryan);
  expectStatus(`contact:create:${contact.contactId}`, response, 201);
  assertProof(`contact:inherits-account:${contact.contactId}`, response.json.contact.accountId === "google", response.json.contact);
}

const quoteInput = {
  trigger: "QUOTE_READY_FOR_CUSTOMER",
  accountId: "google",
  customerId: "customer-google",
  customerName: "Google",
  organizationId: ryan.user.organizationId,
  workspaceId: ryan.workspace.workspaceId,
  opportunityId: "COMMERCIAL-OPPORTUNITY-GOOGLE-HELIUM-SPRINT14",
  opportunity: {
    accountId: "google",
    customerId: "customer-google",
    name: "Google Helium Campus Opportunity",
    selectedScopeId: "GOOGLE-HELIUM-COMBINED-AWARD",
    commercialDraftType: "NEW_GRAPH_CORRIDOR",
  },
  commercialDraftId: "COMMERCIAL-DRAFT-GOOGLE-HELIUM-SPRINT14",
  commercialDraft: {
    accountId: "google",
    customerId: "customer-google",
    revision: 1,
    routeId: "GOOGLE-HELIUM-ENGINEERED-ROUTE",
    draftType: "NEW_GRAPH_CORRIDOR",
  },
  proposalId: "PROPOSAL-GOOGLE-HELIUM-SPRINT14",
  proposalNumber: "PROP-GOOGLE-HELIUM-SPRINT14",
  title: "Google Helium 20-Year IRU Commercial Proposal",
  summary: "Sprint 14 Google Helium governed commercial proposal.",
  executiveSummary: "20-year IRU commercial response matching the prior Google Helium proposal structure.",
  pricingSummary: {
    nrcRevenue: 29000000,
    sellPriceIru: 29000000,
    iruTermYears: 20,
    budgetCost: 19300000,
    routeMiles: 29,
  },
  marginSummary: { grossMarginDollars: 9700000, grossMarginPercent: 33.4 },
  confidenceSummary: { commercialReadiness: 94, runtimeHealth: "PASS" },
  commercialAssumptionIds: ["ASSUMPTION-GOOGLE-HELIUM-20-YEAR-IRU"],
  dealPointIds: ["DEAL-GOOGLE-HELIUM-IRU", "DEAL-GOOGLE-HELIUM-NRC-29M"],
  runtimeObjectIds: ["RUNTIME-INVENTORY-GOOGLE-HELIUM", "RUNTIME-ROUTE-GOOGLE-HELIUM-29M"],
  runtimeRelationshipIds: ["EXTENDS_INVENTORY:RUNTIME-INVENTORY-GOOGLE-HELIUM"],
  runtimeEvidenceIds: ["EVIDENCE-GOOGLE-HELIUM-QUOTE-READY"],
  existingInventoryReferences: ["RUNTIME-INVENTORY-GOOGLE-HELIUM"],
  customerDesignReferences: ["CUSTOMER-DESIGN-GOOGLE-HELIUM"],
  customerTwinReference: "CUSTOMER-TWIN-GOOGLE",
  geometryReferences: ["GEOMETRY-GOOGLE-HELIUM-A", "GEOMETRY-GOOGLE-HELIUM-Z"],
  proposalDocumentReferences: ["DOC-GOOGLE-HELIUM-20-YEAR-IRU"],
  assignedCustomerUsers: ["google-participant-001"],
  assignedEngineerId: "teralinx-user-kyle",
  assignedEngineer: "Kyle",
};

response = await runtimeRequest("POST", "/api/runtime/lifecycle/advance", quoteInput, ryan);
expectStatus("golden-path:lifecycle-quote-ready", response, 200);
let bridge = response.json;
assertProof("golden-path:opportunity-account", bridge.opportunity.accountId === "google", bridge.opportunity);
assertProof("golden-path:proposal-account", bridge.proposal.accountId === "google", bridge.proposal);
assertProof("golden-path:proposal-29m-iru", Number(bridge.proposal.pricingSummary.nrcRevenue) === 29000000 && Number(bridge.proposal.pricingSummary.iruTermYears) === 20, bridge.proposal.pricingSummary);

response = await runtimeRequest("POST", `/api/proposals/${encodeURIComponent(quoteInput.proposalId)}/approve`, {
  comment: "Approved for Sprint 14 Account Workspace Golden Path.",
}, google);
expectStatus("golden-path:customer-approval", response, 200);
assertProof("golden-path:approval-created-draft-iof", Boolean(response.json.draftPackage?.packageId), response.json);
let draft = response.json.draftPackage;
assertProof("golden-path:draft-iof-account", draft.accountId === "google", draft);

for (const unit of draft.proposedIofUnits) {
  response = await runtimeRequest("POST", `/api/engineering/certification/draft-packages/${encodeURIComponent(draft.packageId)}/units/${encodeURIComponent(unit.unitId)}/certify`, {
    engineeringNote: `Sprint 14 certified ${unit.unitId}`,
    engineeringConfidence: 95,
    engineeringRisk: "ACCEPTED",
  }, kyle);
  expectStatus(`golden-path:certify-unit:${unit.unitId}`, response, 200);
  draft = response.json.iofPackage;
}

response = await runtimeRequest("POST", `/api/engineering/certification/draft-packages/${encodeURIComponent(draft.packageId)}/certify`, {
  certifiedPackageId: "CERT-IOF-GOOGLE-HELIUM-SPRINT14",
  checklist: completeChecklist,
}, kyle);
expectStatus("golden-path:certified-iof", response, 200);
const certified = response.json.certifiedIofPackage;
const scopeVersion = response.json.scopeVersion;
assertProof("golden-path:certified-account", certified.accountId === "google", certified);
assertProof("golden-path:scopeversion-account", scopeVersion.accountId === "google" && scopeVersion.canonicalTruth.accountId === "google", scopeVersion);

response = await runtimeRequest("POST", "/api/runtime/lifecycle/advance", { ...quoteInput, trigger: "CUSTOMER_APPROVED" }, ryan);
expectStatus("golden-path:lifecycle-rerun-idempotent", response, 200);
bridge = response.json;
assertProof("golden-path:lifecycle-complete", bridge.lifecycle.lifecycleProgress.every((item) => item.complete), bridge.lifecycle.lifecycleProgress);

response = await runtimeRequest("GET", "/api/twin/state", undefined, kyle);
expectStatus("twin:commercial-runtime-objects", response, 200);
assertProof("twin:surfaces-account", response.json.commercialRuntimeObjects.some((item) => item.objectType === "ACCOUNT" && item.accountId === "google"), response.json.commercialRuntimeObjects);
assertProof("twin:surfaces-opportunity", response.json.commercialRuntimeObjects.some((item) => item.objectType === "OPPORTUNITY" && item.accountId === "google"), response.json.commercialRuntimeObjects);

const accounts = await listRecords(DIRS.accounts);
const contacts = await listRecords(DIRS.contacts);
const opportunities = await listRecords(DIRS.commercialOpportunities);
const proposals = await listRecords(DIRS.proposalDrafts);
const draftPackages = await listRecords(DIRS.iofPackages);
const certifiedPackages = await listRecords(DIRS.certifiedIofPackages);
const scopeVersions = await listRecords(DIRS.scopeVersions);
const runtimeObjects = await listRecords(DIRS.runtimeObjects);
const runtimeHistory = await listRecords(DIRS.runtimeHistory);

function onlyGoogle(records, idKey) {
  return records
    .filter((record) => String(record?.[idKey] ?? record?.objectId ?? "").includes("GOOGLE") || record?.accountId === "google")
    .every((record) => record?.accountId === "google" || record?.metadata?.accountId === "google");
}

assertProof("inheritance:accounts", accounts.some((item) => item.accountId === "google"), accounts);
assertProof("inheritance:contacts", contacts.filter((item) => item.accountId === "google").length >= 2, contacts);
assertProof("inheritance:opportunities", onlyGoogle(opportunities, "opportunityId"), opportunities);
assertProof("inheritance:proposals", proposals.every((item) => item.accountId === "google"), proposals);
assertProof("inheritance:draft-iof", draftPackages.every((item) => item.accountId === "google"), draftPackages);
assertProof("inheritance:certified-iof", certifiedPackages.every((item) => item.accountId === "google"), certifiedPackages);
assertProof("inheritance:scopeversions", scopeVersions.every((item) => item.accountId === "google" && item.canonicalTruth?.accountId === "google"), scopeVersions);
assertProof("inheritance:runtime-objects", onlyGoogle(runtimeObjects, "runtimeId"), runtimeObjects.map((item) => ({ runtimeId: item.runtimeId, objectType: item.objectType, accountId: item.accountId, metadata: item.metadata })));
assertProof("inheritance:runtime-history", runtimeHistory.filter((item) => item.objectId?.includes("GOOGLE") || item.accountId === "google").every((item) => item.accountId === "google" || item.metadata?.accountId === "google"), runtimeHistory);

proof.completedAt = new Date().toISOString();
proof.summary = {
  assertions: proof.assertions.length,
  accountId: "google",
  opportunityId: quoteInput.opportunityId,
  proposalId: quoteInput.proposalId,
  nrcRevenue: 29000000,
  iruTermYears: 20,
  draftPackageId: draft.packageId,
  certifiedPackageId: certified.certifiedPackageId,
  scopeVersionId: scopeVersion.scopeVersionId,
  runtimeObjectCount: runtimeObjects.length,
  runtimeHistoryCount: runtimeHistory.length,
  dataRoot,
};

await mkdir(path.dirname(reportPath), { recursive: true });
await writeFile(reportPath, JSON.stringify(proof, null, 2));
console.log(JSON.stringify(proof.summary, null, 2));
