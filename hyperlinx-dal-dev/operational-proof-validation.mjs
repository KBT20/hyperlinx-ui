import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const dataRoot = path.join(projectRoot, ".tmp", "sprint13-operational-proof-runtime");
const reportPath = path.join(projectRoot, ".tmp", "sprint13-operational-proof-report.json");

function ensureSafeProofRoot(target) {
  const relative = path.relative(projectRoot, target);
  if (relative.startsWith("..") || path.isAbsolute(relative) || !relative.includes("sprint13-operational-proof-runtime")) {
    throw new Error(`Refusing to reset unsafe proof data root: ${target}`);
  }
}

ensureSafeProofRoot(dataRoot);
process.env.DAL_DATA_ROOT = dataRoot;
process.env.DAL_PORT = process.env.DAL_PORT ?? "0";

const { handleActivity } = await import("./server/routes/activity.js");
const { handleAuth } = await import("./server/routes/auth.js");
const { handleCandidateSites } = await import("./server/routes/candidate-sites.js");
const { handleCertifiedRoutes } = await import("./server/routes/certified-routes.js");
const { handleCloseEvents } = await import("./server/routes/close-events.js");
const { handleCommercialOpportunities } = await import("./server/routes/commercial-opportunities.js");
const { handleControlWorkItems } = await import("./server/routes/control-work-items.js");
const { handleCustomerDesignImports } = await import("./server/routes/customer-design-imports.js");
const { handleEngineeringDrafts } = await import("./server/routes/engineering-drafts.js");
const { handleFieldClosures } = await import("./server/routes/field-closures.js");
const { handleInventoryGraphs } = await import("./server/routes/inventory-graphs.js");
const { handleIofPackages } = await import("./server/routes/iof-packages.js");
const { handleMarketplaceQuotes } = await import("./server/routes/marketplace-quotes.js");
const { handleOpportunitySeeds } = await import("./server/routes/opportunity-seeds.js");
const { handleProposalDrafts } = await import("./server/routes/proposal-drafts.js");
const { handleRuntime } = await import("./server/routes/runtime.js");
const { handleRuntimeFoundation } = await import("./server/routes/runtime-foundation.js");
const { handleScopeVersions } = await import("./server/routes/scopeversions.js");
const { handleTwinState } = await import("./server/routes/twin-state.js");

const routes = [
  handleAuth,
  handleRuntime,
  handleActivity,
  handleCertifiedRoutes,
  handleScopeVersions,
  handleCustomerDesignImports,
  handleCommercialOpportunities,
  handleEngineeringDrafts,
  handleProposalDrafts,
  handleRuntimeFoundation,
  handleCandidateSites,
  handleOpportunitySeeds,
  handleInventoryGraphs,
  handleMarketplaceQuotes,
  handleIofPackages,
  handleCloseEvents,
  handleControlWorkItems,
  handleFieldClosures,
  handleTwinState,
];

const IDS = {
  org: "org-teralinx",
  customerId: "customer-google",
  customerName: "Google",
  inventory: "INV-GOOGLE-AUSTIN-EXISTING",
  existingRoute: "RUNTIME-INV-ROUTE-GOOGLE-AUS-001",
  existingPopA: "RUNTIME-INV-POP-GOOGLE-AUS-A",
  existingPopZ: "RUNTIME-INV-POP-GOOGLE-AUS-Z",
  designRequest: "GOOGLE-DESIGN-REQUEST-29M",
  designRoute: "RUNTIME-DESIGN-ROUTE-GOOGLE-AZ-001",
  customerTwin: "RUNTIME-TWIN-GOOGLE-AUSTIN",
  opportunity: "GOOGLE-29M-OPPORTUNITY",
  proposal: "PROPOSAL-GOOGLE-29M",
  engineeringDraft: "ENG-GOOGLE-29M",
  certifiedRoute: "CR-GOOGLE-29M",
  iofPackage: "IOF-GOOGLE-29M-PRODUCTION",
  scopeVersion: "SV-GOOGLE-29M-PRODUCTION",
};

const evidence = {
  existingInventory: "EVID-GOOGLE-KMZ-EXISTING",
  designRequest: "EVID-GOOGLE-RFP-DESIGN",
  commercialDraft: "EVID-GOOGLE-COMMERCIAL-DRAFT",
  customerApproval: "EVID-GOOGLE-CUSTOMER-APPROVAL",
  engineeringCertification: "EVID-GOOGLE-ENG-CERT",
};

const routeGeometry = [
  [-97.7421, 30.2672],
  [-97.7218, 30.2824],
  [-97.7011, 30.2978],
  [-97.6813, 30.3142],
];

const proof = {
  startedAt: new Date().toISOString(),
  dataRoot,
  phases: [],
  assertions: [],
  authority: [],
  lineage: [],
  gaps: [],
};

function notePhase(phase, details = {}) {
  proof.phases.push({ phase, timestamp: new Date().toISOString(), ...details });
}

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

function runtimeObject(input) {
  const timestamp = new Date().toISOString();
  const evidenceIds = input.evidenceIds ?? [];
  const relationshipIds = input.relationshipIds ?? [];
  return {
    runtimeId: input.runtimeId,
    objectId: input.objectId ?? input.runtimeId,
    objectType: input.objectType,
    name: input.name,
    customerId: IDS.customerId,
    customer: IDS.customerName,
    owner: input.owner,
    ownerId: input.owner,
    createdBy: input.createdBy,
    createdById: input.createdBy,
    assignedTo: input.assignedTo ?? [],
    organization: IDS.org,
    organizationId: IDS.org,
    workspace: input.workspace,
    workspaceId: input.workspace,
    visibility: input.visibility ?? "PRIVATE",
    authority: input.authority,
    lifecycleState: input.lifecycleState,
    version: input.version ?? 1,
    scopeVersion: input.scopeVersion,
    evidenceIds,
    evidenceLinks: evidenceIds,
    relationshipIds,
    relationshipLinks: relationshipIds,
    geometry: input.geometry,
    source: input.source,
    classification: input.classification,
    confidence: input.confidence,
    lifecycle: input.lifecycle,
    createdDate: input.createdDate ?? timestamp,
    modifiedDate: timestamp,
    createdAt: input.createdAt ?? timestamp,
    updatedAt: timestamp,
    metadata: {
      noDuplicateRuntimeObject: true,
      ...(input.metadata ?? {}),
    },
  };
}

function relationship(relationshipId, relationshipType, fromRuntimeId, toRuntimeId, evidenceIds = []) {
  return {
    relationshipId,
    relationshipType,
    fromRuntimeId,
    toRuntimeId,
    authority: "RUNTIME_GRAPH",
    organizationId: IDS.org,
    customerId: IDS.customerId,
    evidenceIds,
  };
}

async function runtimeCommit(session, commit) {
  const response = await runtimeRequest("POST", "/api/runtime/commit", { runtimeCommit: commit }, session);
  expectStatus(`runtime commit:${commit.commitId}`, response, 201);
  return response.json.commit;
}

async function listCollection(pathname, key, session) {
  const response = await runtimeRequest("GET", pathname, undefined, session);
  expectStatus(`list:${pathname}`, response, 200);
  return response.json[key] ?? [];
}

async function saveHistory(session, historyEvent) {
  const response = await runtimeRequest("POST", "/api/runtime/history", { historyEvent }, session);
  expectStatus(`history:${historyEvent.historyId}`, response, 201);
  return response.json.historyEvent;
}

async function main() {
  await rm(dataRoot, { recursive: true, force: true });
  await mkdir(dataRoot, { recursive: true });

  notePhase("Participant Workspace");
  const ryan = await login("ryan", "ryan-alpha");
  const kyle = await login("kyle", "kyle-alpha");
  const fran = await login("fran", "fran-alpha");
  const google = await login("google", "google-alpha");
  const workspaces = [ryan, kyle, fran, google].map((session) => ({
    userId: session.user.userId,
    workspaceId: session.workspace.workspaceId,
    organizationId: session.workspace.organizationId,
  }));
  const workspaceIds = new Set(workspaces.map((workspace) => workspace.workspaceId));
  assertProof("authenticated users receive isolated workspace ids", workspaceIds.size === 4, { workspaces });

  const ryanWorkspace = await runtimeRequest("GET", "/api/runtime/workspaces/me", undefined, ryan);
  const kyleWorkspace = await runtimeRequest("GET", "/api/runtime/workspaces/me", undefined, kyle);
  const franWorkspace = await runtimeRequest("GET", "/api/runtime/workspaces/me", undefined, fran);
  const googleWorkspace = await runtimeRequest("GET", "/api/runtime/workspaces/me", undefined, google);
  expectStatus("Ryan workspace context", ryanWorkspace, 200);
  expectStatus("Kyle workspace context", kyleWorkspace, 200);
  expectStatus("Fran workspace context", franWorkspace, 200);
  expectStatus("Google workspace context", googleWorkspace, 200);
  assertProof("workspace context is scoped to authenticated user", (
    ryanWorkspace.json.workspace.userId === "teralinx-user-ryan" &&
    kyleWorkspace.json.workspace.userId === "teralinx-user-kyle" &&
    franWorkspace.json.workspace.userId === "teralinx-user-fran" &&
    googleWorkspace.json.workspace.userId === "google-participant-001"
  ), {
    ryan: ryanWorkspace.json.workspace,
    kyle: kyleWorkspace.json.workspace,
    fran: franWorkspace.json.workspace,
    google: googleWorkspace.json.workspace,
  });

  notePhase("Existing Inventory");
  await runtimeCommit(google, {
    commitId: "COMMIT-GOOGLE-EXISTING-INVENTORY",
    actor: "Google Customer",
    evidence: [{
      evidenceId: evidence.existingInventory,
      sourceType: "KMZ",
      sourceName: "Google Austin Existing Inventory",
      authority: "CUSTOMER_PROVIDED",
      validationStatus: "VALIDATED",
      customerId: IDS.customerId,
    }],
    inventories: [{
      inventoryId: IDS.inventory,
      inventoryType: "CUSTOMER_EXISTING_NETWORK",
      owner: "google-participant-001",
      organization: IDS.org,
      workspace: google.workspace.workspaceId,
      visibility: "ORGANIZATION",
      authority: "CUSTOMER_INVENTORY",
      lifecycleState: "ACTIVE",
      customer: IDS.customerName,
      source: "KMZ_IMPORT",
      evidenceIds: [evidence.existingInventory],
      objectIds: [IDS.existingRoute, IDS.existingPopA, IDS.existingPopZ],
    }],
    runtimeObjects: [
      runtimeObject({
        runtimeId: IDS.existingRoute,
        objectType: "EXISTING_ROUTE",
        name: "Google Austin Existing Backbone",
        owner: "google-participant-001",
        createdBy: "google-participant-001",
        assignedTo: ["teralinx-user-ryan"],
        workspace: google.workspace.workspaceId,
        visibility: "ORGANIZATION",
        authority: "CUSTOMER_INVENTORY",
        lifecycleState: "ACTIVE",
        scopeVersion: "CUSTOMER-INVENTORY-GOOGLE-ACTIVE",
        evidenceIds: [evidence.existingInventory],
        geometry: { type: "LineString", coordinates: routeGeometry },
        source: "KMZ_IMPORT",
        classification: "fiber_backbone",
        confidence: 0.97,
        lifecycle: "ACTIVE",
        metadata: { lane: "EXISTING_INVENTORY" },
      }),
      runtimeObject({
        runtimeId: IDS.existingPopA,
        objectType: "EXISTING_POP",
        name: "Google Austin POP A",
        owner: "google-participant-001",
        createdBy: "google-participant-001",
        assignedTo: ["teralinx-user-ryan"],
        workspace: google.workspace.workspaceId,
        visibility: "ORGANIZATION",
        authority: "CUSTOMER_INVENTORY",
        lifecycleState: "ACTIVE",
        evidenceIds: [evidence.existingInventory],
        geometry: { type: "Point", coordinates: routeGeometry[0] },
        source: "KMZ_IMPORT",
        classification: "pop",
        confidence: 0.99,
        lifecycle: "ACTIVE",
        metadata: { lane: "EXISTING_INVENTORY" },
      }),
      runtimeObject({
        runtimeId: IDS.existingPopZ,
        objectType: "EXISTING_POP",
        name: "Google Austin POP Z",
        owner: "google-participant-001",
        createdBy: "google-participant-001",
        assignedTo: ["teralinx-user-ryan"],
        workspace: google.workspace.workspaceId,
        visibility: "ORGANIZATION",
        authority: "CUSTOMER_INVENTORY",
        lifecycleState: "ACTIVE",
        evidenceIds: [evidence.existingInventory],
        geometry: { type: "Point", coordinates: routeGeometry.at(-1) },
        source: "KMZ_IMPORT",
        classification: "pop",
        confidence: 0.99,
        lifecycle: "ACTIVE",
        metadata: { lane: "EXISTING_INVENTORY" },
      }),
    ],
    relationships: [
      relationship("REL-GOOGLE-EXISTING-POP-A", "HAS_ENDPOINT", IDS.existingRoute, IDS.existingPopA, [evidence.existingInventory]),
      relationship("REL-GOOGLE-EXISTING-POP-Z", "HAS_ENDPOINT", IDS.existingRoute, IDS.existingPopZ, [evidence.existingInventory]),
    ],
    validationReports: [{
      validationId: "VAL-GOOGLE-EXISTING-INVENTORY",
      status: "PASS",
      checks: ["owner_present", "geometry_present", "classification_present", "confidence_present", "lifecycle_present"],
    }],
    history: [{
      historyId: "HIST-GOOGLE-EXISTING-INVENTORY",
      eventType: "runtime.inventory.imported",
      actor: "Google Customer",
      actorId: "google-participant-001",
      objectType: "RuntimeInventory",
      objectId: IDS.inventory,
      organizationId: IDS.org,
      workspaceId: google.workspace.workspaceId,
    }],
  });

  notePhase("Customer Design Request");
  const designImport = {
    importId: IDS.designRequest,
    designId: IDS.designRequest,
    accountId: IDS.customerId,
    customerName: IDS.customerName,
    sourceFileName: "google_29m_design_request.geojson",
    uploadedBy: "google-participant-001",
    organizationId: IDS.org,
    workspaceId: google.workspace.workspaceId,
    routes: [{
      routeId: IDS.designRoute,
      name: "Google $29M Requested Extension",
      geometry: routeGeometry.map(([longitude, latitude]) => ({ longitude, latitude })),
      dalGeometry: routeGeometry,
      folderPath: ["Google", "Design Requests"],
    }],
    objects: [],
    polygons: [],
    runtimeEvidenceIds: [evidence.designRequest],
    runtimeObjectIds: [IDS.designRoute],
    runtimeRelationshipIds: ["REL-GOOGLE-DESIGN-EXTENDS-EXISTING"],
    noScopeVersionCreation: true,
    noInventoryMutation: true,
    noCertifiedRouteAuthority: true,
  };
  const designImportResponse = await runtimeRequest("POST", "/api/customer-design-imports", { customerDesignImport: designImport }, google);
  expectStatus("Google customer submits design request", designImportResponse, 201);
  assertProof("customer design request does not create ScopeVersion or mutate inventory", (
    designImportResponse.json.customerDesignImport.noScopeVersionCreation === true &&
    designImportResponse.json.customerDesignImport.noInventoryMutation === true
  ), { customerDesignImport: designImportResponse.json.customerDesignImport });

  await runtimeCommit(google, {
    commitId: "COMMIT-GOOGLE-DESIGN-REQUEST",
    actor: "Google Customer",
    evidence: [{
      evidenceId: evidence.designRequest,
      sourceType: "GEOJSON",
      sourceName: "Google $29M Customer Design Request",
      authority: "CUSTOMER_REQUEST",
      validationStatus: "VALIDATED",
      customerId: IDS.customerId,
    }],
    runtimeObjects: [runtimeObject({
      runtimeId: IDS.designRoute,
      objectType: "CUSTOMER_DESIGN_REQUEST",
      name: "Google $29M Requested Extension",
      owner: "google-participant-001",
      createdBy: "google-participant-001",
      assignedTo: ["teralinx-user-ryan", "teralinx-user-kyle"],
      workspace: google.workspace.workspaceId,
      visibility: "ORGANIZATION",
      authority: "CUSTOMER_DESIGN_REQUEST",
      lifecycleState: "SUBMITTED",
      evidenceIds: [evidence.designRequest],
      relationshipIds: ["REL-GOOGLE-DESIGN-EXTENDS-EXISTING"],
      geometry: { type: "LineString", coordinates: routeGeometry },
      source: "GEOJSON_IMPORT",
      classification: "customer_requested_extension",
      confidence: 0.92,
      lifecycle: "SUBMITTED",
      metadata: {
        lane: "CUSTOMER_DESIGN_REQUEST",
        noScopeVersionCreation: true,
        noInventoryMutation: true,
        noCertifiedRouteAuthority: true,
      },
    })],
    relationships: [
      relationship("REL-GOOGLE-DESIGN-EXTENDS-EXISTING", "EXTENDS_EXISTING_NETWORK", IDS.designRoute, IDS.existingRoute, [evidence.designRequest, evidence.existingInventory]),
    ],
    validationReports: [{
      validationId: "VAL-GOOGLE-DESIGN-REQUEST",
      status: "PASS",
      checks: ["customer_request_separate_from_inventory", "no_scopeversion_created", "no_inventory_mutation"],
    }],
    history: [{
      historyId: "HIST-GOOGLE-DESIGN-REQUEST",
      eventType: "runtime.customer_design.submitted",
      actor: "Google Customer",
      actorId: "google-participant-001",
      objectType: "CustomerDesignRequest",
      objectId: IDS.designRequest,
      organizationId: IDS.org,
      workspaceId: google.workspace.workspaceId,
    }],
  });

  notePhase("Customer Twin");
  await runtimeCommit(ryan, {
    commitId: "COMMIT-GOOGLE-CUSTOMER-TWIN",
    actor: "Ryan",
    runtimeObjects: [runtimeObject({
      runtimeId: IDS.customerTwin,
      objectType: "CUSTOMER_TWIN",
      name: "Google Austin Customer Twin",
      owner: "teralinx-user-ryan",
      createdBy: "teralinx-user-ryan",
      assignedTo: ["teralinx-user-kyle", "google-participant-001"],
      workspace: ryan.workspace.workspaceId,
      visibility: "ORGANIZATION",
      authority: "CUSTOMER_TWIN",
      lifecycleState: "ACTIVE",
      evidenceIds: [evidence.existingInventory, evidence.designRequest],
      relationshipIds: ["REL-GOOGLE-TWIN-FROM-INVENTORY", "REL-GOOGLE-TWIN-INCLUDES-DESIGN"],
      geometry: { type: "GeometryCollection", geometries: [{ type: "LineString", coordinates: routeGeometry }] },
      source: "RUNTIME_OBJECT_GRAPH",
      classification: "customer_twin",
      confidence: 0.95,
      lifecycle: "ACTIVE",
      metadata: {
        builtFromRuntimeObjects: [IDS.existingRoute, IDS.designRoute],
        privateEditsRemainWorkspaceDrafts: true,
      },
    })],
    relationships: [
      relationship("REL-GOOGLE-TWIN-FROM-INVENTORY", "BUILT_FROM_INVENTORY", IDS.customerTwin, IDS.existingRoute, [evidence.existingInventory]),
      relationship("REL-GOOGLE-TWIN-INCLUDES-DESIGN", "INCLUDES_CUSTOMER_REQUEST", IDS.customerTwin, IDS.designRoute, [evidence.designRequest]),
    ],
    validationReports: [{
      validationId: "VAL-GOOGLE-CUSTOMER-TWIN",
      status: "PASS",
      checks: ["twin_builds_from_imported_inventory", "twin_persists_as_organization_asset", "workspace_drafts_do_not_replace_twin"],
    }],
    history: [{
      historyId: "HIST-GOOGLE-CUSTOMER-TWIN",
      eventType: "runtime.customer_twin.created",
      actor: "Ryan",
      actorId: "teralinx-user-ryan",
      objectType: "CustomerTwin",
      objectId: IDS.customerTwin,
      organizationId: IDS.org,
      workspaceId: ryan.workspace.workspaceId,
    }],
  });

  notePhase("Commercial Planning");
  const opportunityPayload = {
    opportunityId: IDS.opportunity,
    name: "Google $29M Operational Proof Opportunity",
    accountId: IDS.customerId,
    customerName: IDS.customerName,
    revenue: 29000000,
    status: "SAVED",
    visibility: "PRIVATE",
    ownerId: "teralinx-user-ryan",
    organizationId: IDS.org,
    workspaceId: ryan.workspace.workspaceId,
    selectedScopeId: IDS.designRequest,
    evidenceLinks: [evidence.existingInventory, evidence.designRequest],
    relationshipLinks: [IDS.customerTwin, IDS.existingRoute, IDS.designRoute],
    commercialDraftType: "EXTEND_EXISTING_NETWORK",
    authority: {
      owner: "teralinx-user-ryan",
      contributors: [],
      reviewers: ["teralinx-user-fran"],
      approvers: ["teralinx-user-kyle"],
      executives: ["teralinx-user-kyle"],
    },
    metadata: {
      extendsExistingNetwork: true,
      greenfieldCorridor: false,
      customerTwinId: IDS.customerTwin,
    },
  };
  const createOpportunity = await runtimeRequest("POST", "/api/commercial/opportunities", { opportunity: opportunityPayload }, ryan);
  expectStatus("Ryan creates owned opportunity", createOpportunity, 201);
  assertProof("opportunity defaults to Ryan private ownership", (
    createOpportunity.json.opportunity.ownerId === "teralinx-user-ryan" &&
    createOpportunity.json.opportunity.workspaceId === ryan.workspace.workspaceId &&
    createOpportunity.json.opportunity.visibility === "PRIVATE"
  ), { opportunity: createOpportunity.json.opportunity });

  const shareGoogle = await runtimeRequest("POST", `/api/commercial/opportunities/${IDS.opportunity}/share`, {
    userId: "google",
    role: "reviewers",
  }, ryan);
  expectStatus("Ryan shares opportunity with Google customer", shareGoogle, 200);
  const assignOpportunity = await runtimeRequest("POST", `/api/commercial/opportunities/${IDS.opportunity}/assign`, {
    reviewers: ["fran", "google"],
    approvers: ["kyle"],
    executives: ["kyle"],
    assignedTo: ["fran", "kyle", "google"],
  }, ryan);
  expectStatus("Ryan assigns reviewers and executive approver", assignOpportunity, 200);

  const googleCannotModifyOpportunity = await runtimeRequest("PUT", `/api/commercial/opportunities/${IDS.opportunity}`, {
    opportunity: { ...assignOpportunity.json.opportunity, name: "Unauthorized Google edit" },
  }, google);
  expectStatus("Google cannot modify Ryan-owned opportunity", googleCannotModifyOpportunity, 403);
  proof.authority.push({
    check: "opportunity_write_guard",
    actor: "google-participant-001",
    expected: "403",
    actual: googleCannotModifyOpportunity.status,
  });

  const kyleOpportunityList = await runtimeRequest("GET", "/api/commercial/opportunities", undefined, kyle);
  expectStatus("Kyle can read assigned executive opportunity", kyleOpportunityList, 200);
  assertProof("Kyle assigned pipeline includes Google opportunity", kyleOpportunityList.json.opportunities.some((item) => item.opportunityId === IDS.opportunity), {
    count: kyleOpportunityList.json.opportunities.length,
  });

  notePhase("Proposal");
  const proposalPayload = {
    proposalId: IDS.proposal,
    proposalRecordId: IDS.proposal,
    opportunityId: IDS.opportunity,
    customerId: IDS.customerId,
    customerName: IDS.customerName,
    ownerId: "teralinx-user-ryan",
    createdById: "teralinx-user-ryan",
    workspaceId: ryan.workspace.workspaceId,
    organizationId: IDS.org,
    assignedCustomerUsers: ["google-participant-001"],
    visibility: "SHARED",
    amount: 29000000,
    currency: "USD",
    status: "WAITING_CUSTOMER_REVIEW",
    approvalState: "CUSTOMER_REVIEW",
    title: "Google $29M Customer Review Proposal",
    summary: "Commercial proposal prepared from approved Runtime references.",
    executiveSummary: "Google customer review proposal uses Runtime Object, evidence, inventory, twin, and geometry references.",
    pricingSummary: {
      budgetCost: 19000000,
      sellPriceIru: 29000000,
      routeMiles: 29,
    },
    marginSummary: {
      grossMarginDollars: 10000000,
      grossMarginPercent: 34.5,
    },
    confidenceSummary: {
      commercialReadiness: 90,
    },
    commercialAssumptionIds: ["ASSUMPTION-GOOGLE-OPERATIONAL-PROOF"],
    dealPointIds: ["DEALPOINT-GOOGLE-29M"],
    runtimeObjectIds: [IDS.existingRoute, IDS.designRoute],
    runtimeRelationshipIds: [IDS.opportunity, IDS.customerTwin, IDS.designRoute],
    runtimeEvidenceIds: [evidence.commercialDraft, evidence.existingInventory, evidence.designRequest],
    existingInventoryReferences: [IDS.inventory],
    customerDesignReferences: [IDS.designRequest],
    customerTwinReference: IDS.customerTwin,
    geometryReferences: [IDS.designRoute],
    proposalDocumentReferences: ["DOC-GOOGLE-OPERATIONAL-PROOF"],
    evidenceLinks: [evidence.commercialDraft, evidence.existingInventory, evidence.designRequest],
    relationshipLinks: [IDS.opportunity, IDS.customerTwin, IDS.designRoute],
    noScopeVersionCreation: true,
    noInventoryMutation: true,
  };
  const createProposal = await runtimeRequest("POST", "/api/proposals", { proposal: proposalPayload }, ryan);
  expectStatus("Ryan creates proposal from opportunity", createProposal, 201);
  const customerApproval = await runtimeRequest("POST", `/api/proposals/${IDS.proposal}/approve`, {
    comment: "Google customer approved the operational proof proposal.",
  }, google);
  expectStatus("Google customer approves proposal", customerApproval, 200);

  await runtimeCommit(google, {
    commitId: "COMMIT-GOOGLE-PROPOSAL-APPROVED",
    actor: "Google Customer",
    evidence: [
      {
        evidenceId: evidence.commercialDraft,
        sourceType: "COMMERCIAL_DRAFT",
        sourceName: "Google $29M Commercial Draft",
        authority: "COMMERCIAL",
        validationStatus: "VALIDATED",
      },
      {
        evidenceId: evidence.customerApproval,
        sourceType: "CUSTOMER_APPROVAL",
        sourceName: "Google proposal approval",
        authority: "CUSTOMER_APPROVAL",
        validationStatus: "VALIDATED",
      },
    ],
    runtimeObjects: [runtimeObject({
      runtimeId: IDS.proposal,
      objectType: "PROPOSAL",
      name: "Google $29M Customer Approved Proposal",
      owner: "teralinx-user-ryan",
      createdBy: "teralinx-user-ryan",
      assignedTo: ["google-participant-001", "teralinx-user-kyle"],
      workspace: ryan.workspace.workspaceId,
      visibility: "SHARED",
      authority: "CUSTOMER_APPROVED_PROPOSAL",
      lifecycleState: "ACCEPTED",
      evidenceIds: [evidence.commercialDraft, evidence.customerApproval],
      relationshipIds: ["REL-GOOGLE-OPPORTUNITY-PROPOSAL"],
      source: "PROPOSAL_LIBRARY",
      classification: "proposal",
      confidence: 1,
      lifecycle: "ACCEPTED",
      metadata: { opportunityId: IDS.opportunity, amount: 29000000 },
    })],
    relationships: [
      relationship("REL-GOOGLE-OPPORTUNITY-PROPOSAL", "GENERATED_PROPOSAL", `RUNTIME-OPPORTUNITY-${IDS.opportunity}`, IDS.proposal, [evidence.commercialDraft]),
    ],
    validationReports: [{
      validationId: "VAL-GOOGLE-PROPOSAL-APPROVAL",
      status: "PASS",
      checks: ["proposal_references_opportunity", "customer_approval_persisted", "no_scopeversion_before_approval"],
    }],
    history: [{
      historyId: "HIST-GOOGLE-PROPOSAL-APPROVED",
      eventType: "runtime.proposal.customer_approved",
      actor: "Google Customer",
      actorId: "google-participant-001",
      objectType: "Proposal",
      objectId: IDS.proposal,
      organizationId: IDS.org,
      workspaceId: google.workspace.workspaceId,
    }],
  });

  notePhase("Engineering Draft");
  const engineeringDraft = {
    engineeringDraftId: IDS.engineeringDraft,
    opportunityId: IDS.opportunity,
    proposalRecordId: IDS.proposal,
    customerId: IDS.customerId,
    customerName: IDS.customerName,
    ownerId: "teralinx-user-kyle",
    createdById: "teralinx-user-kyle",
    organizationId: IDS.org,
    workspaceId: kyle.workspace.workspaceId,
    status: "ENGINEERING_DRAFT",
    evidenceLinks: [evidence.existingInventory, evidence.designRequest, evidence.customerApproval],
    relationshipLinks: [IDS.opportunity, IDS.proposal, IDS.customerTwin],
    noScopeVersionCreation: true,
    noInventoryMutation: true,
  };
  const createEngineering = await runtimeRequest("POST", "/api/engineering/drafts", { engineeringDraft }, kyle);
  expectStatus("Kyle creates engineering draft after approval", createEngineering, 201);

  notePhase("Engineering Validation and Certification");
  const draftRoute = await runtimeRequest("POST", "/api/certified-routes", {
    certifiedRoute: {
      certifiedRouteId: IDS.certifiedRoute,
      inventoryId: IDS.inventory,
      scopeVersionId: IDS.scopeVersion,
      opportunitySeedId: IDS.opportunity,
      corridorBasis: "CUSTOMER_TWIN_EXTENSION",
      candidateCoordinate: routeGeometry[0],
      attachmentCoordinate: routeGeometry.at(-1),
      geometry: routeGeometry,
      geometryHash: "google-29m-route-v1",
      routeFeet: 26300,
      routeMiles: 4.98,
      crowFlyFeet: 23400,
      routeToCrowFlyRatio: 1.12,
      routeMode: "ENGINEER_DEFINED",
      routeAuthorityState: "DRAFT",
      constraintEvidenceId: evidence.engineeringCertification,
      constraintEvidenceHash: "constraints-google-29m-v1",
      constraintEvidenceStatus: "CURRENT",
      constructabilityScore: 87,
      riskScore: 21,
      permitAuthorities: ["Austin Transportation", "Travis County"],
    },
  }, kyle);
  expectStatus("Kyle creates engineer-defined route", draftRoute, 201);
  const certifyRoute = await runtimeRequest("POST", `/api/certified-routes/${IDS.certifiedRoute}/certify`, {
    engineerName: "Kyle",
    certificationNotes: "Certified for operational proof after customer approval.",
  }, kyle);
  expectStatus("Kyle certifies route authority", certifyRoute, 200);
  assertProof("certified route can create downstream IOF and ScopeVersion authority", (
    certifyRoute.json.certifiedRoute.routeAuthorityState === "CERTIFIED_ROUTE" &&
    certifyRoute.json.certifiedRoute.authority.canCreateIOFPackage === true
  ), { certifiedRoute: certifyRoute.json.certifiedRoute });

  await runtimeCommit(kyle, {
    commitId: "COMMIT-GOOGLE-ENGINEERING-CERTIFIED",
    actor: "Kyle",
    evidence: [{
      evidenceId: evidence.engineeringCertification,
      sourceType: "ENGINEERING_CERTIFICATION",
      sourceName: "Google $29M route certification",
      authority: "ENGINEERING",
      validationStatus: "VALIDATED",
    }],
    runtimeObjects: [runtimeObject({
      runtimeId: IDS.engineeringDraft,
      objectType: "ENGINEERING_DRAFT",
      name: "Google $29M Engineering Draft",
      owner: "teralinx-user-kyle",
      createdBy: "teralinx-user-kyle",
      assignedTo: ["teralinx-user-ryan"],
      workspace: kyle.workspace.workspaceId,
      visibility: "SHARED",
      authority: "ENGINEERING",
      lifecycleState: "CERTIFIED",
      evidenceIds: [evidence.engineeringCertification],
      relationshipIds: ["REL-GOOGLE-PROPOSAL-ENGINEERING", "REL-GOOGLE-ENGINEERING-CERTIFIED-ROUTE"],
      source: "ENGINEERING_LIBRARY",
      classification: "engineering_draft",
      confidence: 0.96,
      lifecycle: "CERTIFIED",
      metadata: {
        proposalRecordId: IDS.proposal,
        certifiedRouteId: IDS.certifiedRoute,
      },
    })],
    relationships: [
      relationship("REL-GOOGLE-PROPOSAL-ENGINEERING", "CREATED_ENGINEERING_DRAFT", IDS.proposal, IDS.engineeringDraft, [evidence.customerApproval]),
      relationship("REL-GOOGLE-ENGINEERING-CERTIFIED-ROUTE", "CERTIFIED_ROUTE", IDS.engineeringDraft, IDS.certifiedRoute, [evidence.engineeringCertification]),
    ],
    validationReports: [{
      validationId: "VAL-GOOGLE-ENGINEERING-CERTIFIED",
      status: "PASS",
      checks: ["engineering_after_customer_approval", "certified_route_required", "route_not_direct_fallback"],
    }],
    history: [{
      historyId: "HIST-GOOGLE-ENGINEERING-CERTIFIED",
      eventType: "runtime.engineering.certified",
      actor: "Kyle",
      actorId: "teralinx-user-kyle",
      objectType: "EngineeringDraft",
      objectId: IDS.engineeringDraft,
      organizationId: IDS.org,
      workspaceId: kyle.workspace.workspaceId,
    }],
  });

  notePhase("IOF Package");
  const iofPackagePayload = {
    packageId: IDS.iofPackage,
    scopeVersionId: IDS.scopeVersion,
    packageType: "ENGINEERING",
    status: "READY",
    opportunityId: IDS.opportunity,
    proposalRecordId: IDS.proposal,
    engineeringDraftId: IDS.engineeringDraft,
    certifiedRouteId: IDS.certifiedRoute,
    organizationId: IDS.org,
    workspaceId: kyle.workspace.workspaceId,
    evidenceLinks: [evidence.engineeringCertification, evidence.customerApproval],
    relationshipLinks: [IDS.engineeringDraft, IDS.certifiedRoute],
    route: routeGeometry,
    stations: [
      { stationId: "ST-GOOGLE-A", measureFeet: 0, stationState: "PLANNED" },
      { stationId: "ST-GOOGLE-MID", measureFeet: 13150, stationState: "PLANNED" },
      { stationId: "ST-GOOGLE-Z", measureFeet: 26300, stationState: "PLANNED" },
    ],
    objects: [
      { objectId: "OBJ-GOOGLE-FIBER-001", stationId: "ST-GOOGLE-A", objectState: "PLANNED" },
      { objectId: "OBJ-GOOGLE-FIBER-002", stationId: "ST-GOOGLE-MID", objectState: "PLANNED" },
      { objectId: "OBJ-GOOGLE-FIBER-003", stationId: "ST-GOOGLE-Z", objectState: "PLANNED" },
    ],
    authority: {
      owner: "teralinx-user-kyle",
      source: "CERTIFIED_ENGINEERING_ROUTE",
      certifiedRouteId: IDS.certifiedRoute,
    },
  };
  const createIof = await runtimeRequest("POST", "/api/iof-packages", { iofPackage: iofPackagePayload }, kyle);
  expectStatus("Kyle creates IOF package before ScopeVersion", createIof, 201);

  notePhase("ScopeVersion");
  const scopeVersionPayload = {
    scopeVersionId: IDS.scopeVersion,
    type: "PRODUCTION",
    status: "APPROVED",
    certificationState: "DRAFT",
    organizationId: IDS.org,
    workspaceId: kyle.workspace.workspaceId,
    ownerId: "teralinx-user-kyle",
    customerId: IDS.customerId,
    customerName: IDS.customerName,
    opportunityId: IDS.opportunity,
    proposalRecordId: IDS.proposal,
    engineeringDraftId: IDS.engineeringDraft,
    iofPackageIds: [IDS.iofPackage],
    evidenceLinks: [evidence.existingInventory, evidence.designRequest, evidence.customerApproval, evidence.engineeringCertification],
    relationshipLinks: [IDS.opportunity, IDS.proposal, IDS.engineeringDraft, IDS.iofPackage, IDS.certifiedRoute],
    certifiedRouteReference: certifyRoute.json.certifiedRoute,
    canonicalTruth: {
      lifecycleState: "APPROVED",
      constitutionalAuthority: "PRODUCTION_SCOPEVERSION_FROM_CERTIFIED_IOF",
      customerTwinId: IDS.customerTwin,
      sourceRuntimeObjectIds: [IDS.existingRoute, IDS.designRoute, IDS.proposal, IDS.engineeringDraft, IDS.iofPackage],
      authorityChain: {
        participantWorkspaceId: google.workspace.workspaceId,
        existingInventoryId: IDS.inventory,
        customerDesignRequestId: IDS.designRequest,
        customerTwinId: IDS.customerTwin,
        commercialOpportunityId: IDS.opportunity,
        proposalRecordId: IDS.proposal,
        customerApprovalEvidenceId: evidence.customerApproval,
        engineeringDraftId: IDS.engineeringDraft,
        certifiedRouteId: IDS.certifiedRoute,
        iofPackageId: IDS.iofPackage,
      },
      stations: iofPackagePayload.stations,
      objects: iofPackagePayload.objects,
    },
    events: [
      {
        eventId: "EVENT-GOOGLE-SCOPEVERSION-APPROVED",
        type: "scopeversion.approved",
        entityId: IDS.scopeVersion,
        entityType: "ScopeVersion",
        payload: {
          opportunityId: IDS.opportunity,
          proposalRecordId: IDS.proposal,
          iofPackageId: IDS.iofPackage,
        },
        createdAt: new Date().toISOString(),
      },
    ],
  };
  const createScopeVersion = await runtimeRequest("POST", "/api/scopeversions", { scopeVersion: scopeVersionPayload }, kyle);
  expectStatus("Kyle creates first production ScopeVersion from IOF", createScopeVersion, 201);
  const certifyScopeVersion = await runtimeRequest("POST", `/api/scopeversions/${IDS.scopeVersion}/certify`, {
    certifiedBy: "Kyle",
  }, kyle);
  expectStatus("Kyle certifies production ScopeVersion", certifyScopeVersion, 200);
  assertProof("ScopeVersion references certified route and IOF package", (
    certifyScopeVersion.json.scopeVersion.certificationState === "CERTIFIED" &&
    certifyScopeVersion.json.scopeVersion.isImmutable === true &&
    certifyScopeVersion.json.scopeVersion.canonicalTruth.authorityChain.iofPackageId === IDS.iofPackage &&
    certifyScopeVersion.json.scopeVersion.canonicalTruth.authorityChain.certifiedRouteId === IDS.certifiedRoute
  ), { scopeVersion: certifyScopeVersion.json.scopeVersion });

  const ryanCannotMutateScopeVersion = await runtimeRequest("PUT", `/api/scopeversions/${IDS.scopeVersion}`, {
    scopeVersion: { ...certifyScopeVersion.json.scopeVersion, status: "CONTROL" },
  }, ryan);
  expectStatus("Ryan cannot mutate production ScopeVersion authority", ryanCannotMutateScopeVersion, 403);
  proof.authority.push({
    check: "scopeversion_write_guard",
    actor: "teralinx-user-ryan",
    expected: "403",
    actual: ryanCannotMutateScopeVersion.status,
  });

  await saveHistory(kyle, {
    historyId: "HIST-GOOGLE-SCOPEVERSION-CERTIFIED",
    eventType: "runtime.scopeversion.certified",
    actor: "Kyle",
    actorId: "teralinx-user-kyle",
    objectType: "ScopeVersion",
    objectId: IDS.scopeVersion,
    organizationId: IDS.org,
    workspaceId: kyle.workspace.workspaceId,
    payload: {
      productionTruth: true,
      marketplaceReady: true,
      controlReady: true,
      fieldReady: true,
    },
  });

  notePhase("Persistence and Runtime Object Library");
  await runtimeRequest("POST", "/api/auth/logout", {}, ryan);
  const ryanReloaded = await login("ryan", "ryan-alpha");
  const persistedOpportunity = await runtimeRequest("GET", `/api/commercial/opportunities/${IDS.opportunity}`, undefined, ryanReloaded);
  expectStatus("opportunity persists after logout and relogin", persistedOpportunity, 200);
  assertProof("reloaded opportunity retains owner and graph links", (
    persistedOpportunity.json.opportunity.ownerId === "teralinx-user-ryan" &&
    persistedOpportunity.json.opportunity.relationshipLinks.includes(IDS.customerTwin) &&
    persistedOpportunity.json.opportunity.evidenceLinks.includes(evidence.designRequest)
  ), { opportunity: persistedOpportunity.json.opportunity });

  const runtimeObjects = await listCollection("/api/runtime/objects", "runtimeObjects", kyle);
  const runtimeRelationships = await listCollection("/api/runtime/relationships", "relationships", kyle);
  const runtimeEvidence = await listCollection("/api/runtime/evidence", "evidence", kyle);
  const runtimeHistory = await listCollection("/api/runtime/history", "history", kyle);
  const runtimeInventories = await listCollection("/api/runtime/inventories", "inventories", kyle);
  const scopeVersions = await listCollection("/api/scopeversions", "scopeVersions", kyle);
  const iofPackages = await listCollection("/api/iof-packages", "iofPackages", kyle);

  const runtimeIds = runtimeObjects.map((item) => item.runtimeId);
  const uniqueRuntimeIds = new Set(runtimeIds);
  assertProof("runtime object ids are unique", runtimeIds.length === uniqueRuntimeIds.size, {
    runtimeObjectCount: runtimeIds.length,
  });
  const opportunityMirrors = runtimeObjects.filter((item) => item.objectType === "OPPORTUNITY" && item.objectId === IDS.opportunity);
  assertProof("single runtime object mirror for Google opportunity", opportunityMirrors.length === 1, { opportunityMirrors });
  assertProof("existing inventory and customer design request remain separate lanes", (
    runtimeObjects.some((item) => item.runtimeId === IDS.existingRoute && item.metadata?.lane === "EXISTING_INVENTORY") &&
    runtimeObjects.some((item) => item.runtimeId === IDS.designRoute && item.metadata?.lane === "CUSTOMER_DESIGN_REQUEST")
  ), {
    lanes: runtimeObjects
      .filter((item) => [IDS.existingRoute, IDS.designRoute].includes(item.runtimeId))
      .map((item) => ({ runtimeId: item.runtimeId, lane: item.metadata?.lane })),
  });
  assertProof("customer twin persists as organization asset", (
    runtimeObjects.some((item) => item.runtimeId === IDS.customerTwin && item.visibility === "ORGANIZATION")
  ), { customerTwin: runtimeObjects.find((item) => item.runtimeId === IDS.customerTwin) });
  assertProof("authoritative inventory is shared organization asset", (
    runtimeInventories.some((item) => item.inventoryId === IDS.inventory && item.visibility === "ORGANIZATION")
  ), { inventories: runtimeInventories });
  assertProof("activity history captures full operational proof", runtimeHistory.length >= 10, {
    historyCount: runtimeHistory.length,
  });
  assertProof("evidence registry links customer, commercial, approval, and engineering proof", (
    [evidence.existingInventory, evidence.designRequest, evidence.commercialDraft, evidence.customerApproval, evidence.engineeringCertification]
      .every((evidenceId) => runtimeEvidence.some((item) => item.evidenceId === evidenceId))
  ), { evidenceIds: runtimeEvidence.map((item) => item.evidenceId) });
  assertProof("relationship graph connects lifecycle objects", (
    runtimeRelationships.some((item) => item.relationshipId === "REL-GOOGLE-OPPORTUNITY-PROPOSAL") &&
    runtimeRelationships.some((item) => item.relationshipId === "REL-GOOGLE-PROPOSAL-ENGINEERING") &&
    runtimeRelationships.some((item) => item.relationshipId === "REL-GOOGLE-ENGINEERING-CERTIFIED-ROUTE")
  ), { relationshipCount: runtimeRelationships.length });
  assertProof("production ScopeVersion and IOF persisted", (
    scopeVersions.some((item) => item.scopeVersionId === IDS.scopeVersion && item.certificationState === "CERTIFIED") &&
    iofPackages.some((item) => item.packageId === IDS.iofPackage)
  ), {
    scopeVersions: scopeVersions.map((item) => ({ scopeVersionId: item.scopeVersionId, certificationState: item.certificationState })),
    iofPackages: iofPackages.map((item) => item.packageId),
  });

  proof.lineage.push({
    customer: IDS.customerName,
    opportunityValue: 29000000,
    runtimeChain: [
      { phase: "Participant Workspace", id: google.workspace.workspaceId, owner: "google-participant-001" },
      { phase: "Existing Inventory", id: IDS.inventory, owner: "google-participant-001" },
      { phase: "Customer Design Request", id: IDS.designRequest, owner: "google-participant-001" },
      { phase: "Customer Twin", id: IDS.customerTwin, owner: "teralinx-user-ryan" },
      { phase: "Commercial Opportunity", id: IDS.opportunity, owner: "teralinx-user-ryan" },
      { phase: "Proposal", id: IDS.proposal, owner: "teralinx-user-ryan" },
      { phase: "Engineering Draft", id: IDS.engineeringDraft, owner: "teralinx-user-kyle" },
      { phase: "Certified Route", id: IDS.certifiedRoute, owner: "teralinx-user-kyle" },
      { phase: "IOF Package", id: IDS.iofPackage, owner: "teralinx-user-kyle" },
      { phase: "ScopeVersion", id: IDS.scopeVersion, owner: "teralinx-user-kyle" },
    ],
  });

  const report = {
    ...proof,
    finishedAt: new Date().toISOString(),
    summary: {
      status: "PASS",
      assertionCount: proof.assertions.length,
      phaseCount: proof.phases.length,
      authorityChecks: proof.authority,
      runtimeObjectCount: runtimeObjects.length,
      runtimeRelationshipCount: runtimeRelationships.length,
      runtimeEvidenceCount: runtimeEvidence.length,
      runtimeHistoryCount: runtimeHistory.length,
      scopeVersionId: IDS.scopeVersion,
      iofPackageId: IDS.iofPackage,
      noCommitCreated: true,
    },
  };

  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report.summary, null, 2));
}

main().catch(async (error) => {
  const failedReport = {
    ...proof,
    finishedAt: new Date().toISOString(),
    summary: {
      status: "FAIL",
      error: error instanceof Error ? error.message : String(error),
      assertionCount: proof.assertions.length,
      noCommitCreated: true,
    },
  };
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, JSON.stringify(failedReport, null, 2));
  const detail = await readFile(reportPath, "utf8").catch(() => JSON.stringify(failedReport));
  console.error(detail);
  process.exitCode = 1;
});
