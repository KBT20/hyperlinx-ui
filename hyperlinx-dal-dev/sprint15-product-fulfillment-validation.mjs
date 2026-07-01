import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const dataRoot = path.join(projectRoot, ".tmp", "sprint15-product-fulfillment");
const reportPath = path.join(projectRoot, ".tmp", "sprint15-product-fulfillment-report.json");

function ensureSafeProofRoot(target) {
  const relative = path.relative(projectRoot, target);
  if (relative.startsWith("..") || path.isAbsolute(relative) || !relative.includes("sprint15-product-fulfillment")) {
    throw new Error(`Refusing to reset unsafe Sprint 15 data root: ${target}`);
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

function mixPercent(plan, ownershipClass) {
  return Number((plan.fulfillmentMix ?? []).find((item) => item.ownershipClass === ownershipClass)?.percentage ?? 0);
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
  certificationConfidence: 97,
  engineeringNotes: "Sprint 15 carrier-neutral Product Fulfillment certification complete.",
};

const ryan = await login("ryan", "ryan-alpha");
const kyle = await login("kyle", "kyle-alpha");
const google = await login("google", "google-alpha");

let response = await runtimeRequest("GET", "/api/runtime", undefined, ryan);
expectStatus("runtime:advertises-product-libraries", response, 200);
assertProof("runtime:product-library-flag", response.json.libraries.productLibrary === true && response.json.libraries.fulfillmentPlanLibrary === true, response.json.libraries);

response = await runtimeRequest("GET", "/api/products", undefined, ryan);
expectStatus("products:list-layer1", response, 200);
assertProof("products:layer1-seeded", response.json.products.length >= 14, { productCount: response.json.products.length });
assertProof("products:protected-dark-fiber", response.json.products.some((item) => item.productId === "PRODUCT-L1-PROTECTED-DARK-FIBER-IRU"), response.json.products);
assertProof("products:ownership-classes", response.json.ownershipClasses.MARKETPLACE_INVENTORY.classId === "D", response.json.ownershipClasses);

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
    commercialEngagements: ["Google Helium carrier-neutral fulfillment"],
    activeOpportunities: ["Google Campus Interconnect"],
    notes: "Sprint 15 governed Account workspace root.",
  },
}, ryan);
expectStatus("account:create-google", response, 201);

const quoteInput = {
  trigger: "QUOTE_READY_FOR_CUSTOMER",
  accountId: "google",
  customerId: "customer-google",
  customerName: "Google",
  organizationId: ryan.user.organizationId,
  workspaceId: ryan.workspace.workspaceId,
  opportunityId: "COMMERCIAL-OPPORTUNITY-GOOGLE-CARRIER-NEUTRAL-SPRINT15",
  opportunity: {
    accountId: "google",
    customerId: "customer-google",
    name: "Google Campus Interconnect",
    selectedScopeId: "GOOGLE-CAMPUS-INTERCONNECT-SCOPE",
    commercialDraftType: "NEW_GRAPH_CORRIDOR",
  },
  commercialDraftId: "COMMERCIAL-DRAFT-GOOGLE-CARRIER-NEUTRAL-SPRINT15",
  commercialDraft: {
    accountId: "google",
    customerId: "customer-google",
    revision: 1,
    routeId: "GOOGLE-CARRIER-NEUTRAL-ROUTE",
    draftType: "NEW_GRAPH_CORRIDOR",
  },
  proposalId: "PROPOSAL-GOOGLE-CARRIER-NEUTRAL-SPRINT15",
  proposalNumber: "PROP-GOOGLE-CARRIER-NEUTRAL-SPRINT15",
  productId: "PRODUCT-L1-PROTECTED-DARK-FIBER-IRU",
  productName: "Protected Dark Fiber IRU",
  productConfiguration: {
    termYears: 20,
    protected: true,
    routeMiles: 29,
    selectedScopeId: "GOOGLE-CAMPUS-INTERCONNECT-SCOPE",
  },
  fulfillmentMix: [
    { ownershipClass: "CUSTOMER_OWNED", label: "Customer Existing Ring", percentage: 40 },
    { ownershipClass: "TERALINX_OWNED", label: "Teralinx Backbone", percentage: 35 },
    { ownershipClass: "PARTNER_OWNED", label: "Partner Longhaul", percentage: 15 },
    { ownershipClass: "NEW_CONSTRUCTION", label: "New Construction", percentage: 10 },
  ],
  title: "Google Carrier-Neutral Protected Dark Fiber IRU",
  summary: "Sprint 15 governed Product fulfilled by customer, Teralinx, partner, and new construction inventory.",
  executiveSummary: "StellaOS optimizes for fulfillment while ownership remains commercial metadata.",
  pricingSummary: {
    nrcRevenue: 29000000,
    sellPriceIru: 29000000,
    iruTermYears: 20,
    budgetCost: 19300000,
    routeMiles: 29,
  },
  marginSummary: { grossMarginDollars: 9700000, grossMarginPercent: 33.4 },
  confidenceSummary: { commercialReadiness: 95, runtimeHealth: "PASS" },
  commercialAssumptionIds: ["ASSUMPTION-CARRIER-NEUTRAL-FULFILLMENT"],
  dealPointIds: ["DEAL-GOOGLE-PROTECTED-DARK-FIBER-IRU"],
  runtimeObjectIds: ["RUNTIME-INVENTORY-TERALINX-BACKBONE", "RUNTIME-CUSTOMER-RING-GOOGLE"],
  runtimeRelationshipIds: ["AGGREGATES_INVENTORY:RUNTIME-INVENTORY-TERALINX-BACKBONE:RUNTIME-CUSTOMER-RING-GOOGLE"],
  runtimeEvidenceIds: ["EVIDENCE-GOOGLE-CARRIER-NEUTRAL-QUOTE-READY"],
  existingInventoryReferences: ["RUNTIME-INVENTORY-TERALINX-BACKBONE"],
  customerDesignReferences: ["CUSTOMER-RING-GOOGLE-CAMPUS"],
  partnerInventoryReferences: ["PARTNER-LONGHAUL-GOOGLE-HELIUM"],
  marketplaceAssetReferences: ["MARKETPLACE-WHOLESALE-FIBER-ALT-1"],
  newInfrastructureRequired: ["NEW-CONSTRUCTION-GOOGLE-LATERAL-A", "NEW-CONSTRUCTION-GOOGLE-LATERAL-Z"],
  customerTwinReference: "CUSTOMER-TWIN-GOOGLE",
  geometryReferences: ["GEOMETRY-GOOGLE-CARRIER-NEUTRAL-A", "GEOMETRY-GOOGLE-CARRIER-NEUTRAL-Z"],
  proposalDocumentReferences: ["DOC-GOOGLE-CARRIER-NEUTRAL-PROPOSAL"],
  assignedCustomerUsers: ["google-participant-001"],
  assignedEngineerId: "teralinx-user-kyle",
  assignedEngineer: "Kyle",
};

response = await runtimeRequest("POST", "/api/runtime/lifecycle/advance", quoteInput, ryan);
expectStatus("lifecycle:quote-ready", response, 200);
let bridge = response.json;
const product = bridge.product;
const plan = bridge.fulfillmentPlan;
assertProof("lifecycle:product-selected", product.productId === quoteInput.productId && product.doctrine.ownershipIsMetadata === true, product);
assertProof("lifecycle:fulfillment-plan-created", Boolean(plan.fulfillmentPlanId) && plan.productId === quoteInput.productId, plan);
assertProof("fulfillment:strategy-multi-owner", plan.fulfillmentStrategy === "MULTI_OWNER_AGGREGATION", plan);
assertProof("fulfillment:mix-customer", mixPercent(plan, "CUSTOMER_OWNED") === 40, plan.fulfillmentMix);
assertProof("fulfillment:mix-teralinx", mixPercent(plan, "TERALINX_OWNED") === 35, plan.fulfillmentMix);
assertProof("fulfillment:mix-partner", mixPercent(plan, "PARTNER_OWNED") === 15, plan.fulfillmentMix);
assertProof("fulfillment:mix-new-construction", mixPercent(plan, "NEW_CONSTRUCTION") === 10, plan.fulfillmentMix);
assertProof("fulfillment:ownership-metadata", plan.ownershipIsMetadata === true && plan.noInventoryOwnershipConstraint === true, plan);
assertProof("fulfillment:class-d-available", plan.ownershipClasses.MARKETPLACE_INVENTORY.classId === "D", plan.ownershipClasses);
assertProof("fulfillment:partner-assets", plan.partnerAssetsUtilized.some((item) => item.ownershipClass === "PARTNER_OWNED"), plan.partnerAssetsUtilized);
assertProof("fulfillment:marketplace-assets", plan.marketplaceAssetsUtilized.some((item) => item.ownershipClass === "MARKETPLACE_INVENTORY"), plan.marketplaceAssetsUtilized);
assertProof("proposal:inherits-product", bridge.proposal.productId === quoteInput.productId && bridge.proposal.fulfillmentPlanId === plan.fulfillmentPlanId, bridge.proposal);
assertProof("lifecycle:product-milestones", ["PRODUCT_SELECTED", "INVENTORY_RESOLVED", "FULFILLMENT_PLAN_CREATED"].every((eventType) => bridge.lifecycle.lifecycleProgress.find((item) => item.eventType === eventType)?.complete), bridge.lifecycle.lifecycleProgress);

response = await runtimeRequest("GET", `/api/fulfillment/plans/${encodeURIComponent(plan.fulfillmentPlanId)}`, undefined, ryan);
expectStatus("fulfillment:get-plan", response, 200);
assertProof("fulfillment:get-plan-preserves-product", response.json.fulfillmentPlan.productId === quoteInput.productId, response.json.fulfillmentPlan);

response = await runtimeRequest("POST", `/api/proposals/${encodeURIComponent(quoteInput.proposalId)}/approve`, {
  comment: "Approved for Sprint 15 carrier-neutral Product Fulfillment validation.",
}, google);
expectStatus("proposal:customer-approval", response, 200);
let draft = response.json.draftPackage;
assertProof("draft-iof:inherits-product", draft.productId === quoteInput.productId && draft.fulfillmentPlanId === plan.fulfillmentPlanId, draft);
assertProof("draft-iof:commercial-summary", draft.commercialSummary.productId === quoteInput.productId && draft.commercialSummary.fulfillmentPlanId === plan.fulfillmentPlanId, draft.commercialSummary);

for (const unit of draft.proposedIofUnits) {
  response = await runtimeRequest("POST", `/api/engineering/certification/draft-packages/${encodeURIComponent(draft.packageId)}/units/${encodeURIComponent(unit.unitId)}/certify`, {
    engineeringNote: `Sprint 15 certified ${unit.unitId}`,
    engineeringConfidence: 96,
    engineeringRisk: "ACCEPTED",
  }, kyle);
  expectStatus(`engineering:certify-unit:${unit.unitId}`, response, 200);
  draft = response.json.iofPackage;
}

response = await runtimeRequest("POST", `/api/engineering/certification/draft-packages/${encodeURIComponent(draft.packageId)}/certify`, {
  certifiedPackageId: "CERT-IOF-GOOGLE-CARRIER-NEUTRAL-SPRINT15",
  checklist: completeChecklist,
}, kyle);
expectStatus("engineering:certified-iof", response, 200);
const certified = response.json.certifiedIofPackage;
const certificate = response.json.executionAuthorizationCertificate;
const scopeVersion = response.json.scopeVersion;
assertProof("certified-iof:inherits-product", certified.productId === quoteInput.productId && certified.fulfillmentPlanId === plan.fulfillmentPlanId, certified);
assertProof("certificate:inherits-product", certificate.productId === quoteInput.productId && certificate.fulfillmentPlanId === plan.fulfillmentPlanId, certificate);
assertProof("scopeversion:canonical-product", scopeVersion.productId === quoteInput.productId && scopeVersion.canonicalTruth.productId === quoteInput.productId, scopeVersion);
assertProof("scopeversion:canonical-fulfillment", scopeVersion.fulfillmentPlanId === plan.fulfillmentPlanId && scopeVersion.canonicalTruth.fulfillmentPlanId === plan.fulfillmentPlanId, scopeVersion.canonicalTruth);

response = await runtimeRequest("POST", "/api/runtime/lifecycle/advance", { ...quoteInput, trigger: "CUSTOMER_APPROVED" }, ryan);
expectStatus("lifecycle:rerun-idempotent", response, 200);
bridge = response.json;
assertProof("lifecycle:complete-after-approval", bridge.lifecycle.lifecycleProgress.every((item) => item.complete), bridge.lifecycle.lifecycleProgress);

response = await runtimeRequest("GET", "/api/twin/state", undefined, kyle);
expectStatus("twin:commercial-runtime-objects", response, 200);
assertProof("twin:surfaces-product", response.json.commercialRuntimeObjects.some((item) => item.objectType === "PRODUCT" && item.objectId === quoteInput.productId), response.json.commercialRuntimeObjects);
assertProof("twin:surfaces-fulfillment-plan", response.json.commercialRuntimeObjects.some((item) => item.objectType === "FULFILLMENT_PLAN" && item.objectId === plan.fulfillmentPlanId), response.json.commercialRuntimeObjects);

const products = await listRecords(DIRS.products);
const fulfillmentPlans = await listRecords(DIRS.fulfillmentPlans);
const proposals = await listRecords(DIRS.proposalDrafts);
const draftPackages = await listRecords(DIRS.iofPackages);
const certifiedPackages = await listRecords(DIRS.certifiedIofPackages);
const scopeVersions = await listRecords(DIRS.scopeVersions);
const runtimeObjects = await listRecords(DIRS.runtimeObjects);
const runtimeHistory = await listRecords(DIRS.runtimeHistory);

assertProof("persistence:products", products.length >= 14 && products.some((item) => item.productId === quoteInput.productId), products);
assertProof("persistence:fulfillment-plan-single", fulfillmentPlans.filter((item) => item.fulfillmentPlanId === plan.fulfillmentPlanId).length === 1, fulfillmentPlans);
assertProof("persistence:proposal-product", proposals.every((item) => item.productId === quoteInput.productId && item.fulfillmentPlanId === plan.fulfillmentPlanId), proposals);
assertProof("persistence:draft-product", draftPackages.every((item) => item.productId === quoteInput.productId && item.fulfillmentPlanId === plan.fulfillmentPlanId), draftPackages);
assertProof("persistence:certified-product", certifiedPackages.every((item) => item.productId === quoteInput.productId && item.fulfillmentPlanId === plan.fulfillmentPlanId), certifiedPackages);
assertProof("persistence:scope-product", scopeVersions.every((item) => item.productId === quoteInput.productId && item.canonicalTruth?.fulfillmentPlanId === plan.fulfillmentPlanId), scopeVersions);
assertProof("persistence:runtime-product-object", runtimeObjects.some((item) => item.objectType === "PRODUCT" && item.objectId === quoteInput.productId), runtimeObjects);
assertProof("persistence:runtime-fulfillment-object", runtimeObjects.some((item) => item.objectType === "FULFILLMENT_PLAN" && item.objectId === plan.fulfillmentPlanId && item.accountId === "google"), runtimeObjects);
assertProof("persistence:runtime-history-product-events", ["PRODUCT_SELECTED", "INVENTORY_RESOLVED", "FULFILLMENT_PLAN_CREATED"].every((eventType) => runtimeHistory.some((item) => item.eventType === eventType)), runtimeHistory);

proof.completedAt = new Date().toISOString();
proof.summary = {
  assertions: proof.assertions.length,
  accountId: "google",
  productId: quoteInput.productId,
  fulfillmentPlanId: plan.fulfillmentPlanId,
  fulfillmentStrategy: plan.fulfillmentStrategy,
  fulfillmentMix: plan.fulfillmentMix,
  proposalId: quoteInput.proposalId,
  draftPackageId: draft.packageId,
  certifiedPackageId: certified.certifiedPackageId,
  scopeVersionId: scopeVersion.scopeVersionId,
  productCount: products.length,
  fulfillmentPlanCount: fulfillmentPlans.length,
  runtimeObjectCount: runtimeObjects.length,
  runtimeHistoryCount: runtimeHistory.length,
  dataRoot,
};

await mkdir(path.dirname(reportPath), { recursive: true });
await writeFile(reportPath, JSON.stringify(proof, null, 2));
console.log(JSON.stringify(proof.summary, null, 2));
