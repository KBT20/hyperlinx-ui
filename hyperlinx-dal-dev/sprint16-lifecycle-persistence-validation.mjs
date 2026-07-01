import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const dataRoot = path.join(projectRoot, ".tmp", "sprint16-lifecycle-persistence");
const reportPath = path.join(projectRoot, ".tmp", "sprint16-lifecycle-persistence-report.json");

function ensureSafeProofRoot(target) {
  const relative = path.relative(projectRoot, target);
  if (relative.startsWith("..") || path.isAbsolute(relative) || !relative.includes("sprint16-lifecycle-persistence")) {
    throw new Error(`Refusing to reset unsafe Sprint 16 data root: ${target}`);
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

const workspaceSource = await readFile(path.join(projectRoot, "src", "components", "workspaces", "GoogleRfpWorkspace.tsx"), "utf8");
assertProof("ui:add-contact-no-null-current-target-updater", !workspaceSource.includes("setContactDraft((prev) => ({ ...prev, name: event.currentTarget.value"), {
  message: "Contact inputs must capture currentTarget.value before state update.",
});

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
  engineeringNotes: "Sprint 16 lifecycle persistence audit certification complete.",
};

const ryan = await login("ryan", "ryan-alpha");
const fran = await login("fran", "fran-alpha");
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
    commercialEngagements: ["Google lifecycle persistence audit"],
    activeOpportunities: ["Google Persistence Continuity Opportunity"],
    notes: "Sprint 16 governed Account workspace root.",
  },
}, ryan);
expectStatus("account:create-google", response, 201);

const contactId = "contact-google-sprint16-continuity";
response = await runtimeRequest("POST", "/api/accounts/google/contacts", {
  contact: {
    contactId,
    accountId: "google",
    name: "Google Continuity Contact",
    title: "Customer Review Authority",
    role: "Commercial Review",
    email: "continuity-review@example.google",
    phone: "+1-555-0100",
    status: "Active",
    recipientWorkflows: ["PROPOSAL_RECIPIENT", "CUSTOMER_REVIEW", "CUSTOMER_APPROVAL", "SOF_RECIPIENT"],
    proposalRecipient: true,
    customerReviewRecipient: true,
    approvalAuthority: true,
    sofRecipient: true,
    serviceOrderRecipient: true,
  },
}, ryan);
expectStatus("contact:create", response, 201);
const contact = response.json.contact;
assertProof("contact:account-linked", contact.accountId === "google" && contact.customerId === "customer-google", contact);
assertProof("contact:recipient-workflows", contact.recipientWorkflows.includes("CUSTOMER_REVIEW") && contact.sofRecipient === true, contact);

response = await runtimeRequest("GET", "/api/accounts/google/contacts", undefined, fran);
expectStatus("contact:reload-other-operator", response, 200);
assertProof("contact:survives-reload", response.json.contacts.some((item) => item.contactId === contactId && item.email === "continuity-review@example.google"), response.json.contacts);

response = await runtimeRequest("GET", "/api/accounts/google", undefined, fran);
expectStatus("account:reload-includes-contact", response, 200);
assertProof("account:contact-index-persisted", response.json.account.contactIds.includes(contactId) && response.json.account.contacts.includes("Google Continuity Contact"), response.json.account);

const quoteInput = {
  trigger: "QUOTE_READY_FOR_CUSTOMER",
  accountId: "google",
  customerId: "customer-google",
  customerName: "Google",
  organizationId: ryan.user.organizationId,
  workspaceId: ryan.workspace.workspaceId,
  opportunityId: "COMMERCIAL-OPPORTUNITY-GOOGLE-PERSISTENCE-SPRINT16",
  opportunity: {
    accountId: "google",
    customerId: "customer-google",
    name: "Google Persistence Continuity Opportunity",
    selectedScopeId: "GOOGLE-PERSISTENCE-SCOPE",
    commercialDraftType: "NEW_GRAPH_CORRIDOR",
  },
  commercialDraftId: "COMMERCIAL-DRAFT-GOOGLE-PERSISTENCE-SPRINT16",
  commercialDraft: {
    accountId: "google",
    customerId: "customer-google",
    revision: 1,
    routeId: "GOOGLE-PERSISTENCE-ROUTE",
    draftType: "NEW_GRAPH_CORRIDOR",
  },
  proposalId: "PROPOSAL-GOOGLE-PERSISTENCE-SPRINT16",
  proposalNumber: "PROP-GOOGLE-PERSISTENCE-SPRINT16",
  productId: "PRODUCT-L1-PROTECTED-DARK-FIBER-IRU",
  productName: "Protected Dark Fiber IRU",
  productConfiguration: {
    termYears: 20,
    protected: true,
    routeMiles: 31,
    selectedScopeId: "GOOGLE-PERSISTENCE-SCOPE",
  },
  fulfillmentMix: [
    { ownershipClass: "CUSTOMER_OWNED", label: "Customer Existing Ring", percentage: 40 },
    { ownershipClass: "TERALINX_OWNED", label: "Teralinx Backbone", percentage: 35 },
    { ownershipClass: "PARTNER_OWNED", label: "Partner Longhaul", percentage: 15 },
    { ownershipClass: "NEW_CONSTRUCTION", label: "New Construction", percentage: 10 },
  ],
  title: "Google Lifecycle Persistence Proposal",
  summary: "Sprint 16 proposal carrying governed contact recipient lineage.",
  executiveSummary: "Governed runtime state survives refresh, login, and certification handoff.",
  pricingSummary: {
    nrcRevenue: 31000000,
    sellPriceIru: 31000000,
    iruTermYears: 20,
    budgetCost: 20500000,
    routeMiles: 31,
  },
  marginSummary: { grossMarginDollars: 10500000, grossMarginPercent: 33.8 },
  confidenceSummary: { commercialReadiness: 96, runtimeHealth: "PASS" },
  commercialAssumptionIds: ["ASSUMPTION-SPRINT16-PERSISTENCE"],
  dealPointIds: ["DEAL-SPRINT16-PERSISTENCE-IRU"],
  runtimeObjectIds: ["RUNTIME-INVENTORY-SPRINT16-TERALINX", "RUNTIME-CUSTOMER-RING-SPRINT16"],
  runtimeRelationshipIds: ["AGGREGATES_INVENTORY:RUNTIME-INVENTORY-SPRINT16-TERALINX:RUNTIME-CUSTOMER-RING-SPRINT16"],
  runtimeEvidenceIds: ["EVIDENCE-SPRINT16-QUOTE-READY"],
  existingInventoryReferences: ["RUNTIME-INVENTORY-SPRINT16-TERALINX"],
  customerDesignReferences: ["CUSTOMER-RING-SPRINT16"],
  partnerInventoryReferences: ["PARTNER-LONGHAUL-SPRINT16"],
  marketplaceAssetReferences: ["MARKETPLACE-FIBER-SPRINT16"],
  newInfrastructureRequired: ["NEW-CONSTRUCTION-SPRINT16-LATERAL"],
  customerTwinReference: "CUSTOMER-TWIN-GOOGLE",
  geometryReferences: ["GEOMETRY-SPRINT16-A", "GEOMETRY-SPRINT16-Z"],
  proposalDocumentReferences: ["DOC-SPRINT16-PERSISTENCE-PROPOSAL"],
  assignedCustomerUsers: ["google-participant-001"],
  proposalRecipientContactIds: [contactId],
  customerReviewContactIds: [contactId],
  approvalAuthorityContactIds: [contactId],
  sofRecipientContactIds: [contactId],
  customerContactEmails: ["continuity-review@example.google"],
  assignedEngineerId: "teralinx-user-kyle",
  assignedEngineer: "Kyle",
};

response = await runtimeRequest("POST", "/api/runtime/lifecycle/advance", quoteInput, ryan);
expectStatus("lifecycle:quote-ready", response, 200);
let bridge = response.json;
const plan = bridge.fulfillmentPlan;
assertProof("proposal:contact-recipients-persist", bridge.proposal.proposalRecipientContactIds.includes(contactId) && bridge.proposal.customerReviewContactIds.includes(contactId), bridge.proposal);
assertProof("lifecycle:product-fulfillment-persist", bridge.product.productId === quoteInput.productId && plan.fulfillmentPlanId, { product: bridge.product, plan });

response = await runtimeRequest("POST", `/api/proposals/${encodeURIComponent(quoteInput.proposalId)}/submit-customer`, {
  assignedCustomerUsers: ["google-participant-001"],
  proposalRecipientContactIds: [contactId],
  customerReviewContactIds: [contactId],
  approvalAuthorityContactIds: [contactId],
  sofRecipientContactIds: [contactId],
  customerContactEmails: ["continuity-review@example.google"],
}, ryan);
expectStatus("proposal:submit-preserves-contact", response, 200);
assertProof("proposal:submitted-contact-recipients", response.json.proposal.customerReviewContactIds.includes(contactId), response.json.proposal);

response = await runtimeRequest("POST", `/api/proposals/${encodeURIComponent(quoteInput.proposalId)}/approve`, {
  comment: "Approved for Sprint 16 lifecycle persistence validation.",
}, google);
expectStatus("proposal:customer-approval", response, 200);
let draft = response.json.draftPackage;
assertProof("draft-iof:contact-recipients", draft.sofRecipientContactIds.includes(contactId) && draft.customerContactEmails.includes("continuity-review@example.google"), draft);

for (const unit of draft.proposedIofUnits) {
  response = await runtimeRequest("POST", `/api/engineering/certification/draft-packages/${encodeURIComponent(draft.packageId)}/units/${encodeURIComponent(unit.unitId)}/certify`, {
    engineeringNote: `Sprint 16 certified ${unit.unitId}`,
    engineeringConfidence: 97,
    engineeringRisk: "ACCEPTED",
  }, kyle);
  expectStatus(`engineering:certify-unit:${unit.unitId}`, response, 200);
  draft = response.json.iofPackage;
}

response = await runtimeRequest("POST", `/api/engineering/certification/draft-packages/${encodeURIComponent(draft.packageId)}/certify`, {
  certifiedPackageId: "CERT-IOF-GOOGLE-PERSISTENCE-SPRINT16",
  checklist: completeChecklist,
}, kyle);
expectStatus("engineering:certified-iof", response, 200);
const certified = response.json.certifiedIofPackage;
const certificate = response.json.executionAuthorizationCertificate;
const scopeVersion = response.json.scopeVersion;
assertProof("certified-iof:contact-recipients", certified.sofRecipientContactIds.includes(contactId), certified);
assertProof("certificate:contact-recipients", certificate.sofRecipientContactIds.includes(contactId), certificate);
assertProof("scopeversion:canonical-contact-recipients", scopeVersion.canonicalTruth.sofRecipientContactIds.includes(contactId), scopeVersion.canonicalTruth);

response = await runtimeRequest("POST", "/api/runtime/lifecycle/advance", { ...quoteInput, trigger: "CUSTOMER_APPROVED" }, ryan);
expectStatus("lifecycle:rerun-idempotent", response, 200);
bridge = response.json;
assertProof("lifecycle:complete-after-reload", bridge.lifecycle.lifecycleProgress.every((item) => item.complete), bridge.lifecycle.lifecycleProgress);

response = await runtimeRequest("GET", "/api/twin/state", undefined, fran);
expectStatus("twin:commercial-runtime-objects", response, 200);
assertProof("twin:surfaces-contact", response.json.commercialRuntimeObjects.some((item) => item.objectType === "CONTACT" && item.objectId === contactId), response.json.commercialRuntimeObjects);
assertProof("twin:surfaces-product-fulfillment", response.json.commercialRuntimeObjects.some((item) => item.objectType === "PRODUCT") && response.json.commercialRuntimeObjects.some((item) => item.objectType === "FULFILLMENT_PLAN"), response.json.commercialRuntimeObjects);

const accounts = await listRecords(DIRS.accounts);
const contacts = await listRecords(DIRS.contacts);
const proposals = await listRecords(DIRS.proposalDrafts);
const draftPackages = await listRecords(DIRS.iofPackages);
const certifiedPackages = await listRecords(DIRS.certifiedIofPackages);
const scopeVersions = await listRecords(DIRS.scopeVersions);
const runtimeObjects = await listRecords(DIRS.runtimeObjects);
const runtimeHistory = await listRecords(DIRS.runtimeHistory);

assertProof("persistence:account-survives", accounts.some((item) => item.accountId === "google" && item.contactIds.includes(contactId)), accounts);
assertProof("persistence:contact-survives", contacts.some((item) => item.contactId === contactId && item.accountId === "google"), contacts);
assertProof("persistence:runtime-contact-object", runtimeObjects.some((item) => item.objectType === "CONTACT" && item.objectId === contactId), runtimeObjects);
assertProof("persistence:contact-history", runtimeHistory.some((item) => item.eventType === "runtime.contact.saved" && item.objectId === contactId), runtimeHistory);
assertProof("persistence:proposal-contact-lineage", proposals.every((item) => item.proposalRecipientContactIds?.includes(contactId)), proposals);
assertProof("persistence:draft-contact-lineage", draftPackages.every((item) => item.sofRecipientContactIds?.includes(contactId)), draftPackages);
assertProof("persistence:certified-contact-lineage", certifiedPackages.every((item) => item.sofRecipientContactIds?.includes(contactId)), certifiedPackages);
assertProof("persistence:scope-contact-lineage", scopeVersions.every((item) => item.canonicalTruth?.sofRecipientContactIds?.includes(contactId)), scopeVersions);

proof.completedAt = new Date().toISOString();
proof.summary = {
  assertions: proof.assertions.length,
  accountId: "google",
  contactId,
  proposalId: quoteInput.proposalId,
  fulfillmentPlanId: plan.fulfillmentPlanId,
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
