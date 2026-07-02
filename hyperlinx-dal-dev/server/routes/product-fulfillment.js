import {
  DIRS,
  createId,
  errorResponse,
  handleOptions,
  jsonResponse,
  listRecords,
  loadRecord,
  nowIso,
  persistRecord,
  readRequestJson,
  routeMatch,
  sortedByUpdated,
  unwrapBody,
} from "./_shared.js";
import { userFromBearerToken, userHasPermission } from "./auth.js";

export const INVENTORY_OWNERSHIP_CLASSES = {
  TERALINX_OWNED: {
    classId: "A",
    label: "Teralinx-Owned",
    description: "Infrastructure owned or controlled directly by Teralinx.",
  },
  CUSTOMER_OWNED: {
    classId: "B",
    label: "Customer-Owned",
    description: "Infrastructure owned by the customer.",
  },
  PARTNER_OWNED: {
    classId: "C",
    label: "Partner-Owned",
    description: "Infrastructure owned by carriers, utilities, municipalities, cooperatives, or strategic partners.",
  },
  MARKETPLACE_INVENTORY: {
    classId: "D",
    label: "Marketplace Inventory",
    description: "Infrastructure discovered through Marketplace and retained as governed fulfillment evidence.",
  },
  NEW_CONSTRUCTION: {
    classId: "N",
    label: "New Construction",
    description: "Infrastructure created because governed inventory cannot fully satisfy Product requirements.",
  },
};

const LAYER_1_PRODUCTS = [
  ["POINT_TO_POINT_LONG_HAUL_CONDUIT_FIBER", "Point-to-Point Long Haul Conduit & Fiber", "Transport Infrastructure", "POINT_TO_POINT_LONG_HAUL_CONDUIT_FIBER", ["long haul", "linear topology", "conduit", "fiber", "point-to-point"]],
  ["PRODUCT-L1-PROTECTED-DARK-FIBER-IRU", "Protected Dark Fiber IRU", "Infrastructure", "DARK_FIBER_IRU", ["fiber", "route topology", "physical protection", "diversity"]],
  ["PRODUCT-L1-UNPROTECTED-DARK-FIBER-IRU", "Unprotected Dark Fiber IRU", "Infrastructure", "DARK_FIBER_IRU", ["fiber", "route topology"]],
  ["PRODUCT-L1-DARK-FIBER-LEASE", "Dark Fiber Lease", "Infrastructure", "DARK_FIBER_LEASE", ["fiber", "lease terms", "operations"]],
  ["PRODUCT-L1-CONDUIT-AS-A-SERVICE", "Conduit-as-a-Service", "Infrastructure", "CONDUIT_SERVICE", ["conduit", "duct occupancy", "rights-of-way"]],
  ["PRODUCT-L1-MULTI-DUCT-INFRASTRUCTURE", "Multi-Duct Infrastructure", "Infrastructure", "MULTI_DUCT", ["conduit", "duct banks", "vaults"]],
  ["PRODUCT-L1-LATERAL-FIBER-EXTENSION", "Lateral Fiber Extension", "Infrastructure", "LATERAL_EXTENSION", ["existing network", "customer lateral", "building entrance"]],
  ["PRODUCT-L1-LONG-HAUL-ROUTE", "Long-Haul Route", "Transport Infrastructure", "LONG_HAUL_ROUTE", ["route topology", "regeneration", "ILA spacing"]],
  ["PRODUCT-L1-METRO-BACKBONE", "Metro Backbone", "Transport Infrastructure", "METRO_BACKBONE", ["metro ring", "route diversity", "capacity"]],
  ["PRODUCT-L1-DATA-CENTER-INTERCONNECT", "Data Center Interconnect", "Transport Infrastructure", "DATA_CENTER_INTERCONNECT", ["facilities", "diversity", "handoff"]],
  ["PRODUCT-L1-CAMPUS-INTERCONNECT", "Campus Interconnect", "Transport Infrastructure", "CAMPUS_INTERCONNECT", ["campus fiber", "entrances", "customer assets"]],
  ["PRODUCT-L1-ILA-FACILITY", "ILA Facility", "Physical Facilities", "ILA_FACILITY", ["regeneration", "power", "facility readiness"]],
  ["PRODUCT-L1-REGENERATION-SITE", "Regeneration Site", "Physical Facilities", "REGENERATION_SITE", ["regeneration", "facility expansion"]],
  ["PRODUCT-L1-MEET-ME-POINT", "Meet-Me Point", "Physical Facilities", "MEET_ME_POINT", ["interconnection", "handoff", "carrier access"]],
  ["PRODUCT-L1-POINT-OF-PRESENCE", "Point of Presence (POP)", "Physical Facilities", "POP", ["facility", "interconnection", "operations"]],
];

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === "") return [];
  return [value];
}

function unique(values) {
  return [...new Set(asArray(values).filter(Boolean).map(String))];
}

function cleanId(value) {
  return String(value ?? "runtime").replace(/[^a-zA-Z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").toUpperCase();
}

function accountIdFor(input = {}) {
  const explicit = input.accountId ?? input.account?.accountId ?? input.opportunity?.accountId ?? input.proposal?.accountId;
  if (explicit) return String(explicit);
  const customerId = String(input.customerId ?? input.customer?.customerId ?? "");
  if (customerId === "customer-google") return "google";
  return customerId.startsWith("customer-") ? customerId.slice("customer-".length) : customerId;
}

function customerIdFor(input = {}) {
  const accountId = accountIdFor(input);
  return String(input.customerId ?? input.account?.customerId ?? (accountId === "google" ? "customer-google" : accountId ? `customer-${accountId}` : "customer-google"));
}

function defaultProductDefinition([productId, productName, productFamily, productCode, doctrineTags]) {
  const timestamp = nowIso();
  return {
    productId,
    productName,
    productCode,
    productFamily,
    productVersion: "1.0.0",
    lifecycleStatus: "ACTIVE",
    supportedOsiLayer: 1,
    commercial: {
      nrcModel: "PRODUCT_CONFIGURATION_DERIVED",
      mrcModel: productName.includes("Lease") || productName.includes("Service") ? "SUPPORTED" : "OPTIONAL",
      termOptions: ["12", "36", "60", "120", "240"],
      marginDoctrine: "Product margin derives from fulfillment strategy, inventory utilization, and customer-specific adjustments.",
      iruOptions: productCode.includes("IRU"),
      leaseOptions: productCode.includes("LEASE") || productName.includes("Service"),
      standardCommercialTerms: ["NRC", "MRC where supported", "20-year IRU where configured"],
      defaultProposalTemplates: [`${productName} Proposal`],
    },
    engineering: {
      engineeringDoctrine: "Validate Product configuration and fulfillment plan without redefining Product intent.",
      protectionDoctrine: productName.includes("Protected") ? "DIVERSE_PATH_REQUIRED" : "PRODUCT_CONFIGURATION",
      routeDiversityRequirements: productName.includes("Protected") || productName.includes("Interconnect") ? "DIVERSITY_REVIEW_REQUIRED" : "STANDARD_REVIEW",
      fiberRules: doctrineTags.includes("fiber") ? "FIBER_PAIR_AND_HANDOFF_REQUIRED" : "NOT_PRIMARY",
      capacityRules: "CAPACITY_CONFIRMED_DURING_ENGINEERING_VALIDATION",
      ilaStandards: doctrineTags.includes("regeneration") ? "ILA_SPACING_AND_POWER_REQUIRED" : "AS_NEEDED",
      acceptanceCriteria: ["configuration validated", "fulfillment plan reconciled", "runtime references present"],
      validationRules: ["PRODUCT_SELECTED", "FULFILLMENT_PLAN_CREATED", "INVENTORY_OWNERSHIP_RECORDED"],
    },
    construction: {
      constructionDoctrine: "Construction is only used where governed inventory cannot fulfill Product requirements.",
      placementStandards: "Layer 1 placement standards apply.",
      conduitStandards: "Conduit standards apply when conduit is part of fulfillment.",
      vaultStandards: "Vault standards apply when vaults are part of fulfillment.",
      splicingStandards: "Splicing standards apply to fiber fulfillment.",
      testingStandards: "Acceptance testing required before operational inventory creation.",
      restorationStandards: "Restoration governed by route jurisdiction and construction method.",
    },
    runtime: {
      runtimeObjectTemplates: ["PRODUCT", "FULFILLMENT_PLAN", "PRODUCT_CONFIGURATION"],
      scopeVersionTemplates: ["SCOPEVERSION_FROM_CERTIFIED_IOF_PACKAGE"],
      authorityModel: "PRODUCT_DEFINITION_SINGLE_SOURCE",
      lifecycleStates: ["SELECTED", "CONFIGURED", "FULFILLMENT_PLANNED", "ENGINEERING_VALIDATED", "OPERATIONAL"],
      runtimeHistoryTemplates: ["PRODUCT_SELECTED", "INVENTORY_RESOLVED", "FULFILLMENT_PLAN_CREATED"],
    },
    operations: {
      monitoringRequirements: ["availability", "maintenance responsibility", "owner handoff"],
      slaDefinitions: ["product-specific SLA generated from configuration"],
      maintenanceRequirements: ["ownership-aware maintenance plan"],
      operationalDeliverables: ["Service Order", "SOF", "Acceptance Package"],
    },
    doctrine: {
      fulfillmentPrinciple: "StellaOS does not optimize for ownership; it optimizes for fulfillment. Ownership governs commercial relationships. Fulfillment governs operational success.",
      inventoryFirst: true,
      ownershipIsMetadata: true,
      doctrineTags,
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function normalizeProduct(record = {}) {
  const timestamp = record.updatedAt ?? record.createdAt ?? nowIso();
  const productId = String(record.productId ?? createId("product")).toUpperCase();
  return {
    ...record,
    productId,
    runtimeObjectId: String(record.runtimeObjectId ?? `RUNTIME-PRODUCT-${cleanId(productId)}`),
    objectType: "PRODUCT",
    productName: String(record.productName ?? record.name ?? productId),
    productFamily: String(record.productFamily ?? "Layer 1"),
    productVersion: String(record.productVersion ?? record.version ?? "1.0.0"),
    lifecycleStatus: String(record.lifecycleStatus ?? record.status ?? "ACTIVE"),
    supportedOsiLayer: Number(record.supportedOsiLayer ?? record.osiLayer ?? 1),
    commercial: record.commercial ?? {},
    engineering: record.engineering ?? {},
    construction: record.construction ?? {},
    runtime: record.runtime ?? {},
    operations: record.operations ?? {},
    doctrine: {
      fulfillmentPrinciple: "StellaOS does not optimize for ownership; it optimizes for fulfillment. Ownership governs commercial relationships. Fulfillment governs operational success.",
      inventoryFirst: true,
      ownershipIsMetadata: true,
      ...(record.doctrine ?? {}),
    },
    createdAt: record.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
}

function normalizeFulfillmentPlan(record = {}) {
  const timestamp = record.updatedAt ?? record.createdAt ?? nowIso();
  const fulfillmentPlanId = String(record.fulfillmentPlanId ?? record.planId ?? createId("fulfillment-plan"));
  const accountId = accountIdFor(record);
  const customerId = customerIdFor({ ...record, accountId });
  return {
    ...record,
    fulfillmentPlanId,
    planId: fulfillmentPlanId,
    runtimeObjectId: String(record.runtimeObjectId ?? `RUNTIME-FULFILLMENT-PLAN-${cleanId(fulfillmentPlanId)}`),
    objectType: "FULFILLMENT_PLAN",
    accountId,
    customerId,
    opportunityId: String(record.opportunityId ?? record.opportunity?.opportunityId ?? ""),
    proposalId: String(record.proposalId ?? record.proposal?.proposalId ?? ""),
    productId: String(record.productId ?? record.selectedProduct?.productId ?? ""),
    productName: String(record.productName ?? record.selectedProduct?.productName ?? ""),
    fulfillmentStrategy: String(record.fulfillmentStrategy ?? "INVENTORY_EXTENSION"),
    ownershipClasses: record.ownershipClasses ?? INVENTORY_OWNERSHIP_CLASSES,
    fulfillmentMix: asArray(record.fulfillmentMix),
    existingAssetsUtilized: asArray(record.existingAssetsUtilized),
    customerAssetsUtilized: asArray(record.customerAssetsUtilized),
    partnerAssetsUtilized: asArray(record.partnerAssetsUtilized),
    marketplaceAssetsUtilized: asArray(record.marketplaceAssetsUtilized),
    newInfrastructureRequired: asArray(record.newInfrastructureRequired),
    newInventoryCreated: asArray(record.newInventoryCreated),
    estimatedCapital: Number(record.estimatedCapital ?? 0),
    commercialModel: record.commercialModel ?? {},
    engineeringDoctrine: record.engineeringDoctrine ?? {},
    runtimeObjectsGenerated: unique(record.runtimeObjectsGenerated),
    authority: String(record.authority ?? "PRODUCT_FULFILLMENT"),
    lifecycleState: String(record.lifecycleState ?? "FULFILLMENT_PLANNED"),
    validation: record.validation ?? {},
    createdAt: record.createdAt ?? timestamp,
    updatedAt: timestamp,
    noInventoryOwnershipConstraint: true,
    ownershipIsMetadata: true,
  };
}

async function persistRuntimeMirror(record, user, objectType, sourceId, metadata = {}) {
  const timestamp = nowIso();
  const runtimeId = record.runtimeObjectId ?? `RUNTIME-${objectType}-${cleanId(sourceId)}`;
  const mirror = {
    runtimeId,
    objectId: sourceId,
    objectType,
    name: record.productName ?? record.productId ?? record.fulfillmentPlanId ?? sourceId,
    owner: record.owner ?? user.name,
    ownerId: record.ownerId ?? user.userId,
    createdBy: record.createdBy ?? user.name,
    createdById: record.createdById ?? user.userId,
    assignedTo: unique(record.assignedTo ?? [user.userId]),
    organization: record.organizationId ?? user.organizationId,
    organizationId: record.organizationId ?? user.organizationId,
    workspace: record.workspaceId ?? user.workspaceId,
    workspaceId: record.workspaceId ?? user.workspaceId,
    accountId: record.accountId,
    customerId: record.customerId,
    visibility: "ORGANIZATION",
    authority: objectType === "PRODUCT" ? "PRODUCT_DEFINITION" : "PRODUCT_FULFILLMENT",
    lifecycleState: record.lifecycleState ?? record.lifecycleStatus ?? "ACTIVE",
    version: Number(record.version ?? 1),
    evidenceIds: unique(record.evidenceIds ?? record.runtimeEvidenceIds),
    relationshipIds: unique(record.relationshipIds ?? record.runtimeRelationshipIds),
    sourceId,
    createdAt: record.createdAt ?? timestamp,
    updatedAt: timestamp,
    metadata: {
      ...metadata,
      accountId: record.accountId,
      customerId: record.customerId,
      productId: record.productId,
      fulfillmentPlanId: record.fulfillmentPlanId,
      fulfillmentStrategy: record.fulfillmentStrategy,
      fulfillmentMix: record.fulfillmentMix,
      ownershipIsMetadata: true,
      noDuplicateObjects: true,
    },
  };
  await persistRecord(DIRS.runtimeObjects, runtimeId, mirror);
  return mirror;
}

async function appendHistory(record, user, eventType, details = "", metadata = {}) {
  const timestamp = nowIso();
  const objectId = record.fulfillmentPlanId ?? record.productId;
  const event = {
    historyId: `runtime-history-${objectId}-${eventType}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    eventType,
    actor: user.name,
    actorId: user.userId,
    objectType: record.objectType === "FULFILLMENT_PLAN" ? "FulfillmentPlan" : "Product",
    objectId,
    objectName: record.productName ?? record.name ?? objectId,
    accountId: record.accountId,
    customerId: record.customerId,
    organizationId: record.organizationId ?? user.organizationId,
    workspaceId: record.workspaceId ?? user.workspaceId,
    timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
    details,
    metadata: {
      accountId: record.accountId,
      customerId: record.customerId,
      productId: record.productId,
      fulfillmentPlanId: record.fulfillmentPlanId,
      ownershipIsMetadata: true,
      ...metadata,
    },
  };
  await persistRecord(DIRS.runtimeHistory, event.historyId, event);
  return event;
}

async function seedProducts() {
  const existing = await listRecords(DIRS.products);
  if (existing.length) return;
  for (const seed of LAYER_1_PRODUCTS) {
    const product = normalizeProduct(defaultProductDefinition(seed));
    await persistRecord(DIRS.products, product.productId, product);
    await persistRuntimeMirror(product, { name: "System", userId: "teralinx-system", organizationId: "org-teralinx", workspaceId: "workspace-teralinx-system" }, "PRODUCT", product.productId, {
      seeded: true,
    });
  }
}

function assetRef(reference, ownershipClass, source) {
  return {
    referenceId: String(reference),
    ownershipClass,
    ownershipClassId: INVENTORY_OWNERSHIP_CLASSES[ownershipClass]?.classId,
    source,
    ownershipIsMetadata: true,
  };
}

function normalizeMix(inputMix, fallbackCategories) {
  const explicit = asArray(inputMix)
    .map((item) => ({
      ownershipClass: String(item.ownershipClass ?? item.class ?? ""),
      percentage: Number(item.percentage ?? item.percent ?? 0),
      label: String(item.label ?? item.ownershipClass ?? ""),
    }))
    .filter((item) => item.ownershipClass && Number.isFinite(item.percentage) && item.percentage > 0);
  if (explicit.length) {
    const total = explicit.reduce((sum, item) => sum + item.percentage, 0) || 1;
    return explicit.map((item) => ({ ...item, percentage: Number(((item.percentage / total) * 100).toFixed(2)) }));
  }
  const active = fallbackCategories.filter((item) => item.count > 0);
  if (!active.length) return [{ ownershipClass: "NEW_CONSTRUCTION", label: INVENTORY_OWNERSHIP_CLASSES.NEW_CONSTRUCTION.label, percentage: 100 }];
  const share = Number((100 / active.length).toFixed(2));
  return active.map((item, index) => ({
    ownershipClass: item.ownershipClass,
    label: INVENTORY_OWNERSHIP_CLASSES[item.ownershipClass]?.label ?? item.ownershipClass,
    percentage: index === active.length - 1 ? Number((100 - share * (active.length - 1)).toFixed(2)) : share,
  }));
}

function strategyFor(mix) {
  const ownerClasses = unique(mix.filter((item) => item.ownershipClass !== "NEW_CONSTRUCTION").map((item) => item.ownershipClass));
  if (mix.some((item) => item.ownershipClass === "MARKETPLACE_INVENTORY")) return "MARKETPLACE_AGGREGATION";
  if (ownerClasses.length > 1) return "MULTI_OWNER_AGGREGATION";
  if (mix.length === 1 && mix[0].ownershipClass !== "NEW_CONSTRUCTION") return "EXISTING_INVENTORY";
  if (mix.some((item) => item.ownershipClass === "NEW_CONSTRUCTION") && mix.some((item) => item.ownershipClass !== "NEW_CONSTRUCTION")) return "INVENTORY_EXTENSION";
  if (mix.length === 1 && mix[0].ownershipClass === "NEW_CONSTRUCTION") return "GREENFIELD_CONSTRUCTION";
  return "INVENTORY_EXTENSION";
}

function createPlanFromInput(input, user, product) {
  const timestamp = nowIso();
  const accountId = accountIdFor(input);
  const customerId = customerIdFor({ ...input, accountId });
  const opportunityId = String(input.opportunityId ?? input.opportunity?.opportunityId ?? `OPPORTUNITY-${cleanId(accountId)}-${Date.now()}`);
  const fulfillmentPlanId = String(input.fulfillmentPlanId ?? `FULFILLMENT-${cleanId(accountId)}-${cleanId(opportunityId)}-${cleanId(product.productId)}`);
  const existingAssets = unique(input.existingInventoryReferences ?? input.runtimeObjectIds)
    .map((ref) => assetRef(ref, "TERALINX_OWNED", "existingInventoryReferences"));
  const customerAssets = unique([
    ...asArray(input.customerDesignReferences),
    ...asArray(input.customerAssetReferences),
    input.customerTwinReference,
  ]).map((ref) => assetRef(ref, "CUSTOMER_OWNED", "customerReferences"));
  const partnerAssets = unique(input.partnerInventoryReferences ?? input.partnerAssetReferences)
    .map((ref) => assetRef(ref, "PARTNER_OWNED", "partnerReferences"));
  const marketplaceAssets = unique([
    ...asArray(input.marketplaceAssetReferences),
    ...asArray(input.marketplaceQuoteIds),
    ...asArray(input.marketplaceReferences),
  ]).map((ref) => assetRef(ref, "MARKETPLACE_INVENTORY", "marketplaceReferences"));
  const newInfrastructure = unique(input.newInfrastructureRequired ?? input.geometryReferences)
    .map((ref) => assetRef(ref, "NEW_CONSTRUCTION", "geometryReferences"));
  const mix = normalizeMix(input.fulfillmentMix, [
    { ownershipClass: "CUSTOMER_OWNED", count: customerAssets.length },
    { ownershipClass: "TERALINX_OWNED", count: existingAssets.length },
    { ownershipClass: "PARTNER_OWNED", count: partnerAssets.length },
    { ownershipClass: "MARKETPLACE_INVENTORY", count: marketplaceAssets.length },
    { ownershipClass: "NEW_CONSTRUCTION", count: newInfrastructure.length },
  ]);
  return normalizeFulfillmentPlan({
    fulfillmentPlanId,
    accountId,
    customerId,
    opportunityId,
    proposalId: input.proposalId ?? input.proposal?.proposalId,
    productId: product.productId,
    productName: product.productName,
    selectedProduct: {
      productId: product.productId,
      productName: product.productName,
      productFamily: product.productFamily,
      productVersion: product.productVersion,
      supportedOsiLayer: product.supportedOsiLayer,
    },
    productConfiguration: input.productConfiguration ?? {
      termYears: input.pricingSummary?.iruTermYears ?? input.termYears ?? 20,
      protected: product.productName.includes("Protected"),
      routeMiles: input.pricingSummary?.routeMiles,
    },
    fulfillmentMix: mix,
    fulfillmentStrategy: input.fulfillmentStrategy ?? strategyFor(mix),
    existingAssetsUtilized: existingAssets,
    customerAssetsUtilized: customerAssets,
    partnerAssetsUtilized: partnerAssets,
    marketplaceAssetsUtilized: marketplaceAssets,
    newInfrastructureRequired: newInfrastructure,
    newInventoryCreated: asArray(input.newInventoryCreated),
    estimatedCapital: Number(input.estimatedCapital ?? input.pricingSummary?.budgetCost ?? 0),
    commercialModel: {
      pricingSummary: input.pricingSummary ?? {},
      marginSummary: input.marginSummary ?? {},
      commercialTerms: product.commercial?.standardCommercialTerms ?? [],
    },
    engineeringDoctrine: product.engineering,
    runtimeObjectsGenerated: unique([
      product.runtimeObjectId,
      ...asArray(input.runtimeObjectIds),
    ]),
    validation: {
      inventoryEvaluatedBeforeConstruction: true,
      ownershipDoesNotConstrainFulfillment: true,
      multiOwnerFulfillment: mix.filter((item) => item.ownershipClass !== "NEW_CONSTRUCTION").length > 1,
      createdAt: timestamp,
    },
    organizationId: input.organizationId ?? user.organizationId,
    workspaceId: input.workspaceId ?? user.workspaceId,
    ownerId: input.ownerId ?? user.userId,
    owner: user.name,
    createdById: user.userId,
    createdBy: user.name,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

async function saveProduct(product, user, eventType = "PRODUCT_DEFINITION_SAVED", details = "Product Definition saved.") {
  const normalized = normalizeProduct(product);
  await persistRecord(DIRS.products, normalized.productId, normalized);
  await persistRuntimeMirror(normalized, user, "PRODUCT", normalized.productId);
  await appendHistory(normalized, user, eventType, details);
  return normalized;
}

async function saveFulfillmentPlan(plan, user, eventType = "FULFILLMENT_PLAN_CREATED", details = "Fulfillment Plan created from Product Definition and governed inventory references.") {
  const normalized = normalizeFulfillmentPlan(plan);
  await persistRecord(DIRS.fulfillmentPlans, normalized.fulfillmentPlanId, normalized);
  await persistRuntimeMirror(normalized, user, "FULFILLMENT_PLAN", normalized.fulfillmentPlanId);
  await appendHistory(normalized, user, eventType, details, {
    fulfillmentStrategy: normalized.fulfillmentStrategy,
    fulfillmentMix: normalized.fulfillmentMix,
  });
  return normalized;
}

export async function ensureProductFulfillment(input = {}, user) {
  await seedProducts();
  const productId = String(input.productId ?? input.productDefinitionId ?? input.product?.productId ?? "PRODUCT-L1-PROTECTED-DARK-FIBER-IRU").toUpperCase();
  const product = normalizeProduct(await loadRecord(DIRS.products, productId).catch(() => defaultProductDefinition(LAYER_1_PRODUCTS[0])));
  await persistRuntimeMirror(product, user, "PRODUCT", product.productId);
  await appendHistory({
    ...product,
    objectType: "PRODUCT",
    accountId: accountIdFor(input),
    customerId: customerIdFor(input),
  }, user, "PRODUCT_SELECTED", "Product selected for governed Opportunity fulfillment.", {
    productId: product.productId,
    opportunityId: input.opportunityId ?? input.opportunity?.opportunityId,
  });
  const existing = input.fulfillmentPlanId ? await loadRecord(DIRS.fulfillmentPlans, input.fulfillmentPlanId).catch(() => null) : null;
  if (existing) return { product, fulfillmentPlan: normalizeFulfillmentPlan(existing) };
  const plan = await saveFulfillmentPlan(createPlanFromInput(input, user, product), user);
  await appendHistory(plan, user, "INVENTORY_RESOLVED", "Inventory ownership classes resolved as metadata for Product fulfillment.", {
    fulfillmentMix: plan.fulfillmentMix,
  });
  return { product, fulfillmentPlan: plan };
}

function requireUser(req, res) {
  const user = userFromBearerToken(req);
  if (!user) {
    errorResponse(res, 401, "Authentication token is missing or invalid.");
    return null;
  }
  return user;
}

async function handleProducts(req, res, pathname, user) {
  const match = routeMatch(pathname, "/api/products");
  if (!match) return false;
  await seedProducts();
  if (match.base && req.method === "GET") {
    const products = sortedByUpdated((await listRecords(DIRS.products)).map(normalizeProduct));
    jsonResponse(res, 200, { products, items: products, ownershipClasses: INVENTORY_OWNERSHIP_CLASSES });
    return true;
  }
  if (!match.base && req.method === "GET") {
    const product = await loadRecord(DIRS.products, match.id).catch(() => null);
    if (!product) errorResponse(res, 404, `Product not found: ${match.id}`);
    else jsonResponse(res, 200, { product: normalizeProduct(product) });
    return true;
  }
  if ((match.base || !match.action) && (req.method === "POST" || req.method === "PUT")) {
    if (!userHasPermission(user, "platform.admin") && !userHasPermission(user, "proposal.manage")) {
      errorResponse(res, 403, "You do not have authority to save Product Definitions.");
      return true;
    }
    const body = await readRequestJson(req);
    const input = unwrapBody(body, "product", ["products", "items", "data"]);
    const records = Array.isArray(input) ? input : [input];
    const saved = [];
    for (const record of records) saved.push(await saveProduct(record, user));
    if (Array.isArray(input)) jsonResponse(res, 201, { products: saved, items: saved });
    else jsonResponse(res, 201, { product: saved[0] });
    return true;
  }
  return false;
}

async function handlePlans(req, res, pathname, user) {
  const match = routeMatch(pathname, "/api/fulfillment/plans");
  if (!match) return false;
  await seedProducts();
  if (match.base && req.method === "GET") {
    const plans = sortedByUpdated((await listRecords(DIRS.fulfillmentPlans)).map(normalizeFulfillmentPlan));
    jsonResponse(res, 200, { fulfillmentPlans: plans, plans, items: plans });
    return true;
  }
  if (!match.base && req.method === "GET") {
    const plan = await loadRecord(DIRS.fulfillmentPlans, match.id).catch(() => null);
    if (!plan) errorResponse(res, 404, `Fulfillment Plan not found: ${match.id}`);
    else jsonResponse(res, 200, { fulfillmentPlan: normalizeFulfillmentPlan(plan), plan: normalizeFulfillmentPlan(plan) });
    return true;
  }
  if (req.method === "POST" && (match.base || match.id === "analyze" || match.action === "analyze")) {
    if (!userHasPermission(user, "workspace.commercial") && !userHasPermission(user, "proposal.manage") && !userHasPermission(user, "platform.admin")) {
      errorResponse(res, 403, "You do not have authority to create Fulfillment Plans.");
      return true;
    }
    const body = await readRequestJson(req);
    const result = await ensureProductFulfillment(body, user);
    jsonResponse(res, 201, result);
    return true;
  }
  return false;
}

export async function handleProductFulfillment(req, res, pathname) {
  if (!pathname.startsWith("/api/products") && !pathname.startsWith("/api/fulfillment")) return false;
  if (handleOptions(req, res)) return true;
  const user = requireUser(req, res);
  if (!user) return true;
  if (await handleProducts(req, res, pathname, user)) return true;
  if (await handlePlans(req, res, pathname, user)) return true;
  errorResponse(res, 405, "Product Fulfillment method not allowed.");
  return true;
}
