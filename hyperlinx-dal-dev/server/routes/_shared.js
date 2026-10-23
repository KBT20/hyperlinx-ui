import { AsyncLocalStorage } from "node:async_hooks";
import { cp, mkdir, open, readdir, readFile, rename, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  listPostgresRecords,
  loadPostgresRecord,
  mirrorRecord,
  mirrorRecordBestEffort,
  postgresReadsEnabled,
  postgresShadowEnabled,
} from "../persistence/postgres/repositoryAdapter.js";

export const ROUTES_DIR = path.dirname(fileURLToPath(import.meta.url));
export const SERVER_ROOT = path.resolve(ROUTES_DIR, "..");
export const PROJECT_ROOT = path.resolve(SERVER_ROOT, "..");

export const PORT = Number(process.env.DAL_PORT ?? process.env.PORT ?? 3001);
export const DATA_ROOT = process.env.DAL_DATA_ROOT
  ? path.resolve(process.env.DAL_DATA_ROOT)
  : path.join(SERVER_ROOT, "data");
export const DEMO_DATA_ROOT = process.env.DAL_DEMO_DATA_ROOT
  ? path.resolve(process.env.DAL_DEMO_DATA_ROOT)
  : path.join(SERVER_ROOT, "data-demo");
export const DEMO_SEED_ROOT = process.env.DAL_DEMO_SEED_ROOT
  ? path.resolve(process.env.DAL_DEMO_SEED_ROOT)
  : path.join(SERVER_ROOT, "demo-seed");
export const DEMO_ARCHIVE_ROOT = process.env.DAL_DEMO_ARCHIVE_ROOT
  ? path.resolve(process.env.DAL_DEMO_ARCHIVE_ROOT)
  : path.join(SERVER_ROOT, "demo-reset-archive");

const repositoryAuthority = new AsyncLocalStorage();
const immutableArtifactRecoveryAuthority = new AsyncLocalStorage();
const DEMO_ORGANIZATION_ID = "org-demo";

function inside(parent, child) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function assertRepositoryRoots() {
  if (DATA_ROOT === DEMO_DATA_ROOT || inside(DATA_ROOT, DEMO_DATA_ROOT) || inside(DEMO_DATA_ROOT, DATA_ROOT)) {
    throw new Error("DEMO_REPOSITORY_BOUNDARY_INVALID: production and demo repository roots must be disjoint.");
  }
}

assertRepositoryRoots();

export function repositoryAuthorityForUser(user) {
  const organizationId = String(user?.organizationId ?? "");
  const demo = user?.authorityClass === "DEMO" && (
    (organizationId === DEMO_ORGANIZATION_ID && Array.isArray(user?.permissions) && user.permissions.includes("demo.tenant")) ||
    organizationId.startsWith("org-demo-customer-")
  );
  return {
    organizationId: demo ? DEMO_ORGANIZATION_ID : String(user?.organizationId ?? ""),
    authorityClass: demo ? "DEMO" : "PRODUCTION",
    dataRoot: demo ? DEMO_DATA_ROOT : DATA_ROOT,
    principalId: String(user?.principalId ?? ""),
  };
}

export function withRepositoryAuthority(user, operation) {
  return repositoryAuthority.run(repositoryAuthorityForUser(user), operation);
}

export function currentRepositoryAuthority() {
  return repositoryAuthority.getStore() ?? {
    organizationId: "",
    authorityClass: "PRODUCTION",
    dataRoot: DATA_ROOT,
    principalId: "",
  };
}

function resolveRepositoryDir(dir) {
  const resolved = path.resolve(dir);
  if (!inside(DATA_ROOT, resolved)) throw new Error(`REPOSITORY_PATH_OUTSIDE_AUTHORITY_ROOT: ${resolved}`);
  const relative = path.relative(DATA_ROOT, resolved);
  const authority = currentRepositoryAuthority();
  const scoped = path.resolve(authority.dataRoot, relative);
  if (!inside(authority.dataRoot, scoped)) throw new Error("REPOSITORY_TENANT_ESCAPE_REJECTED");
  return scoped;
}

function governedRecordForAuthority(id, record) {
  const authority = currentRepositoryAuthority();
  if (authority.authorityClass === "DEMO") {
    if (!/(^|[-_:])DEMO(?:[-_:]|$)/i.test(String(id))) {
      const error = new Error(`DEMO_ID_NAMESPACE_REQUIRED: ${id}`);
      error.status = 409;
      throw error;
    }
    return {
      ...record,
      environment: "DEMO",
      // Repository placement supplies Demo execution authority. Preserve an
      // existing governed domain organization/tenant so an explicit command
      // cannot silently rewrite Proposal material merely by persisting it.
      organizationId: record?.organizationId || DEMO_ORGANIZATION_ID,
      tenantId: record?.tenantId || DEMO_ORGANIZATION_ID,
      authorityClass: "DEMO",
      actorPrincipalId: authority.principalId,
      authorityActorPrincipalId: authority.principalId,
      productionEligible: false,
    };
  }
  if (record?.organizationId === DEMO_ORGANIZATION_ID || record?.tenantId === DEMO_ORGANIZATION_ID || record?.authorityClass === "DEMO") {
    const error = new Error("DEMO_RECORD_PRODUCTION_WRITE_REJECTED");
    error.status = 403;
    throw error;
  }
  return record;
}

// Run the same repository-namespace predicate used by persistRecord without
// performing a write. Command handlers use this during preflight so a
// non-constitutional projection cannot discover an invalid identity only
// after governed lifecycle artifacts have committed.
export function prevalidateGovernedRecord(id, record = {}) {
  return governedRecordForAuthority(id, record);
}

// Repository ownership is authoritative at read time. Historical Demo fixtures may
// carry their pre-isolation organization metadata inside immutable snapshots; those
// bytes must not be rewritten merely to reconcile repository placement. Project only
// the top-level runtime authority from the already-isolated Demo root and leave every
// nested payload, snapshot, hash, ID, revision, and reference byte-for-byte intact.
function projectRecordForRepositoryAuthority(record) {
  const authority = currentRepositoryAuthority();
  if (authority.authorityClass !== "DEMO" || !record || typeof record !== "object") return record;
  const runtimePrincipalId = authority.principalId || "demo-principal";
  const ownerAuthority = record.authority && typeof record.authority === "object" && !Array.isArray(record.authority) && "owner" in record.authority
    ? { ...record.authority, owner: runtimePrincipalId }
    : record.authority;
  return {
    ...record,
    organizationId: DEMO_ORGANIZATION_ID,
    tenantId: DEMO_ORGANIZATION_ID,
    authorityClass: "DEMO",
    environment: "DEMO",
    productionEligible: false,
    ...(record.ownerId ? { ownerId: runtimePrincipalId } : {}),
    ...(record.commercialOwnerId ? { commercialOwnerId: runtimePrincipalId } : {}),
    ...(Array.isArray(record.assignedTo) ? { assignedTo: [...new Set([...record.assignedTo, runtimePrincipalId])] } : {}),
    ...(ownerAuthority !== undefined ? { authority: ownerAuthority } : {}),
  };
}

export const DIRS = {
  scopeVersions: path.join(DATA_ROOT, "scopeversions"),
  candidateSites: path.join(DATA_ROOT, "candidate-sites"),
  opportunitySeeds: path.join(DATA_ROOT, "opportunity-seeds"),
  inventoryGraphs: path.join(DATA_ROOT, "inventory-graphs"),
  inventoryAuthorizations: path.join(DATA_ROOT, "inventory-authorizations"),
  marketplaceQuotes: path.join(DATA_ROOT, "marketplace-quotes"),
  marketplacePackages: path.join(DATA_ROOT, "marketplace-packages"),
  marketplaceResponses: path.join(DATA_ROOT, "marketplace-responses"),
  marketplaceAllocations: path.join(DATA_ROOT, "marketplace-allocations"),
  marketplaceAwards: path.join(DATA_ROOT, "marketplace-awards"),
  marketplaceObservations: path.join(DATA_ROOT, "marketplace-observations"),
  products: path.join(DATA_ROOT, "products"),
  productDoctrineDrafts: path.join(DATA_ROOT, "product-doctrine-drafts"),
  fulfillmentPlans: path.join(DATA_ROOT, "fulfillment-plans"),
  iofPackages: path.join(DATA_ROOT, "iof-packages"),
  engineeringObjectManifests: path.join(DATA_ROOT, "engineering-object-manifests"),
  stationProjections: path.join(DATA_ROOT, "station-projections"),
  stationGraphs: path.join(DATA_ROOT, "station-graphs"),
  stationObjectManifests: path.join(DATA_ROOT, "station-object-manifests"),
  measuredCenterlines: path.join(DATA_ROOT, "measured-centerlines"),
  projectedObjectManifests: path.join(DATA_ROOT, "projected-object-manifests"),
  closureLedgers: path.join(DATA_ROOT, "closure-ledgers"),
  iofPackageTwins: path.join(DATA_ROOT, "iof-package-twins"),
  productDoctrineAssemblies: path.join(DATA_ROOT, "product-doctrine-assemblies"),
  projectConfigurations: path.join(DATA_ROOT, "project-configurations"),
  quantityReconciliations: path.join(DATA_ROOT, "quantity-reconciliations"),
  engineeringIntakes: path.join(DATA_ROOT, "engineering-intakes"),
  engineeringBaselines: path.join(DATA_ROOT, "engineering-baselines"),
  engineeringChangeSets: path.join(DATA_ROOT, "engineering-change-sets"),
  engineeringApprovals: path.join(DATA_ROOT, "engineering-approvals"),
  engineeringPackages: path.join(DATA_ROOT, "engineering-packages"),
  certificationLedgers: path.join(DATA_ROOT, "certification-ledgers"),
  certifiedIofPackages: path.join(DATA_ROOT, "certified-iof-packages"),
  executionAuthorizationCertificates: path.join(DATA_ROOT, "execution-authorization-certificates"),
  closeEvents: path.join(DATA_ROOT, "close-events"),
  certifiedRoutes: path.join(DATA_ROOT, "certified-routes"),
  controlWorkItems: path.join(DATA_ROOT, "control-work-items"),
  fieldClosures: path.join(DATA_ROOT, "field-closures"),
  accounts: path.join(DATA_ROOT, "accounts"),
  contacts: path.join(DATA_ROOT, "contacts"),
  customerDesignImports: path.join(DATA_ROOT, "customer-design-imports"),
  commercialOpportunities: path.join(DATA_ROOT, "commercial-opportunities"),
  commercialRoutes: path.join(DATA_ROOT, "commercial-routes"),
  commercialRevisions: path.join(DATA_ROOT, "commercial-revisions"),
  commercialChangeSets: path.join(DATA_ROOT, "commercial-change-sets"),
  commercialReleasePackages: path.join(DATA_ROOT, "commercial-release-packages"),
  engineeringDrafts: path.join(DATA_ROOT, "engineering-drafts"),
  proposalDrafts: path.join(DATA_ROOT, "proposal-drafts"),
  serviceOrders: path.join(DATA_ROOT, "service-orders"),
  serviceOrderSupersessions: path.join(DATA_ROOT, "service-order-supersessions"),
  customerSignatures: path.join(DATA_ROOT, "customer-signatures"),
  teralinxCountersignatures: path.join(DATA_ROOT, "teralinx-countersignatures"),
  commercialAuthorizationTransactions: path.join(DATA_ROOT, "commercial-authorization-transactions"),
  activity: path.join(DATA_ROOT, "activity"),
  runtimeWorkspaces: path.join(DATA_ROOT, "runtime-workspaces"),
  runtimeEvidence: path.join(DATA_ROOT, "runtime-evidence"),
  runtimeInventories: path.join(DATA_ROOT, "runtime-inventories"),
  runtimeObjects: path.join(DATA_ROOT, "runtime-objects"),
  runtimeRelationships: path.join(DATA_ROOT, "runtime-relationships"),
  runtimeValidation: path.join(DATA_ROOT, "runtime-validation"),
  runtimeHistory: path.join(DATA_ROOT, "runtime-history"),
  runtimeConnectors: path.join(DATA_ROOT, "runtime-connectors"),
  runtimeWorkspaceSessions: path.join(DATA_ROOT, "runtime-workspace-sessions"),
  translationCommits: path.join(DATA_ROOT, "translation-commits"),
  transactionManifests: path.join(DATA_ROOT, "transaction-manifests"),
  demoScenarios: path.join(DATA_ROOT, "demo-scenarios"),
  customerReviewPackages: path.join(DATA_ROOT, "customer-review-packages"),
  customerPortalInvitations: path.join(DATA_ROOT, "customer-portal-invitations"),
  customerProjectAccess: path.join(DATA_ROOT, "customer-project-access"),
  customerPortalActions: path.join(DATA_ROOT, "customer-portal-actions"),
  customerPortalDocuments: path.join(DATA_ROOT, "customer-portal-documents"),
  customerInfrastructureRequests: path.join(DATA_ROOT, "customer-infrastructure-requests"),
  customerRequestSubmissions: path.join(DATA_ROOT, "customer-request-submissions"),
  plannerInputs: path.join(DATA_ROOT, "planner-inputs"),
  plannerSessions: path.join(DATA_ROOT, "planner-sessions"),
  plannerArtifacts: path.join(DATA_ROOT, "planner-artifacts"),
  commercialPlanningIntakes: path.join(DATA_ROOT, "commercial-planning-intakes"),
  networkPlans: path.join(DATA_ROOT, "network-plans"),
  networkPlanRevisions: path.join(DATA_ROOT, "network-plan-revisions"),
  sitePlanningRecipes: path.join(DATA_ROOT, "site-planning-recipes"),
  sitePlanningRecipeRevisions: path.join(DATA_ROOT, "site-planning-recipe-revisions"),
  portfolioPlanningPackages: path.join(DATA_ROOT, "portfolio-planning-packages"),
  portfolioPlanningRevisions: path.join(DATA_ROOT, "portfolio-planning-revisions"),
  portfolioExports: path.join(DATA_ROOT, "portfolio-exports"),
  iofPreliminaryEvents: path.join(DATA_ROOT, "iof-preliminary-events"),
  customerPlanningOpportunities: path.join(DATA_ROOT, "customer-planning-opportunities"),
  customerPlanningOpportunityRevisions: path.join(DATA_ROOT, "customer-planning-opportunity-revisions"),
  customerPlanningOpportunityInputRevisions: path.join(DATA_ROOT, "customer-planning-opportunity-input-revisions"),
  planningCanonicalSpatialObjects: path.join(DATA_ROOT, "planning-canonical-spatial-objects"),
  planningProductRequirementsRevisions: path.join(DATA_ROOT, "planning-product-requirements-revisions"),
  pendingOpportunityInputIntents: path.join(DATA_ROOT, "pending-opportunity-input-intents"),
  networkClassCalibrationRevisions: path.join(DATA_ROOT, "network-class-calibration-revisions"),
  planningAssets: path.join(DATA_ROOT, "planning-assets"),
  planningDatasets: path.join(DATA_ROOT, "planning-datasets"),
  customerPlanningCollaboration: path.join(DATA_ROOT, "customer-planning-collaboration"),
  customerPlanningExports: path.join(DATA_ROOT, "customer-planning-exports"),
  customerPlanningSubmissions: path.join(DATA_ROOT, "customer-planning-submissions"),
  customerPlanningInformationRequests: path.join(DATA_ROOT, "customer-planning-information-requests"),
  customerPlanningBindings: path.join(DATA_ROOT, "customer-planning-bindings"),
  customerPlanningReleases: path.join(DATA_ROOT, "customer-planning-releases"),
  customerPlanningPromotionLinks: path.join(DATA_ROOT, "customer-planning-promotion-links"),
  customerProductPlanningRequests: path.join(DATA_ROOT, "customer-product-planning-requests"),
  customerProductExecutionLeases: path.join(DATA_ROOT, "customer-product-execution-leases"),
  customerProductPlanRevisions: path.join(DATA_ROOT, "customer-product-plan-revisions"),
  endpointCorridorAdmissionRevisions: path.join(DATA_ROOT, "endpoint-corridor-admission-revisions"),
  networkPlanningContexts: path.join(DATA_ROOT, "network-planning-contexts"),
  networkUniverses: path.join(DATA_ROOT, "network-universes"),
  networkUniverseRevisions: path.join(DATA_ROOT, "network-universe-revisions"),
  canonicalNetworkAssets: path.join(DATA_ROOT, "canonical-network-assets"),
  canonicalNetworkAssetRevisions: path.join(DATA_ROOT, "canonical-network-asset-revisions"),
  networkAssetRightsDecisions: path.join(DATA_ROOT, "network-asset-rights-decisions"),
  networkAssetReusableDispositions: path.join(DATA_ROOT, "network-asset-reusable-dispositions"),
  networkAssetQualifications: path.join(DATA_ROOT, "network-asset-qualifications"),
  networkUniversePlanningGrants: path.join(DATA_ROOT, "network-universe-planning-grants"),
  networkUniverseDisclosureGrants: path.join(DATA_ROOT, "network-universe-disclosure-grants"),
  networkUniverseGrantEvents: path.join(DATA_ROOT, "network-universe-grant-events"),
  networkUniverseGrants: path.join(DATA_ROOT, "network-universe-planning-grants"),
  networkSynthesisConsumptionManifests: path.join(DATA_ROOT, "network-synthesis-consumption-manifests"),
  networkSynthesisRuns: path.join(DATA_ROOT, "network-synthesis-runs"),
  plannerVnextAccounts: path.join(DATA_ROOT, "planner-vnext-accounts"),
  planningAccountActivations: path.join(DATA_ROOT, "planning-account-activations"),
  plannerVnextOpportunities: path.join(DATA_ROOT, "planner-vnext-opportunities"),
  plannerVnextPlans: path.join(DATA_ROOT, "planner-vnext-plans"),
  plannerVnextPlanRevisions: path.join(DATA_ROOT, "planner-vnext-plan-revisions"),
  plannerPromotionEvents: path.join(DATA_ROOT, "planner-promotion-events"),
  planningAccountReconciliations: path.join(DATA_ROOT, "planning-account-reconciliations"),
  plannerSolutionGraphs: path.join(DATA_ROOT, "planner-solution-graphs"),
  plannerSolutionGraphRevisions: path.join(DATA_ROOT, "planner-solution-graph-revisions"),
  forensicRecoveryEvidence: path.join(DATA_ROOT, "forensic-recovery-evidence"),
};

const GOVERNED_IDENTITY_HASH_FIELDS = new Map([
  [path.resolve(DIRS.commercialRevisions), ["revisionHash"]],
  [path.resolve(DIRS.commercialReleasePackages), ["releaseHash"]],
  [path.resolve(DIRS.engineeringBaselines), ["engineeringBaselineHash", "baselineHash"]],
  [path.resolve(DIRS.engineeringPackages), ["referenceHash"]],
  [path.resolve(DIRS.certifiedIofPackages), ["certifiedPackageHash", "packageHash"]],
  [path.resolve(DIRS.serviceOrders), ["documentHash", "serviceOrderHash"]],
  [path.resolve(DIRS.serviceOrderSupersessions), ["supersessionHash"]],
  [path.resolve(DIRS.scopeVersions), ["scopeVersionHash", "authorityHash", "canonicalHash"]],
  [path.resolve(DIRS.networkPlanRevisions), ["planRevisionHash"]],
  [path.resolve(DIRS.sitePlanningRecipeRevisions), ["sitePlanningRecipeRevisionHash"]],
  [path.resolve(DIRS.portfolioPlanningRevisions), ["portfolioRevisionHash"]],
  [path.resolve(DIRS.portfolioExports), ["exportRecordHash"]],
  [path.resolve(DIRS.iofPreliminaryEvents), ["eventHash"]],
  [path.resolve(DIRS.customerPlanningSubmissions), ["submissionHash"]],
  [path.resolve(DIRS.customerPlanningInformationRequests), ["informationRequestHash"]],
  [path.resolve(DIRS.customerPlanningBindings), ["bindingHash"]],
  [path.resolve(DIRS.customerPlanningReleases), ["releaseHash"]],
  [path.resolve(DIRS.customerPlanningPromotionLinks), ["promotionLinkHash"]],
  [path.resolve(DIRS.customerProductPlanningRequests), ["requestHash"]],
  [path.resolve(DIRS.customerProductPlanRevisions), ["planRevisionHash"]],
  [path.resolve(DIRS.customerPlanningOpportunityInputRevisions), ["opportunityInputRevisionHash"]],
  [path.resolve(DIRS.planningCanonicalSpatialObjects), ["canonicalSpatialObjectHash"]],
  [path.resolve(DIRS.planningProductRequirementsRevisions), ["productRequirementsRevisionHash"]],
  [path.resolve(DIRS.pendingOpportunityInputIntents), ["pendingInputIntentHash"]],
  [path.resolve(DIRS.networkClassCalibrationRevisions), ["calibrationDecisionHash"]],
  [path.resolve(DIRS.planningAssets), ["planningAssetHash"]],
  [path.resolve(DIRS.planningDatasets), ["planningDatasetHash"]],
  [path.resolve(DIRS.customerProductExecutionLeases), ["leaseHash"]],
  [path.resolve(DIRS.endpointCorridorAdmissionRevisions), ["endpointAdmissionHash"]],
  [path.resolve(DIRS.networkPlanningContexts), ["planningContextHash"]],
  [path.resolve(DIRS.networkUniverses), ["universeHash"]],
  [path.resolve(DIRS.networkUniverseRevisions), ["networkUniverseRevisionHash"]],
  [path.resolve(DIRS.canonicalNetworkAssets), ["assetHash"]],
  [path.resolve(DIRS.canonicalNetworkAssetRevisions), ["assetRevisionHash"]],
  [path.resolve(DIRS.networkAssetRightsDecisions), ["decisionHash"]],
  [path.resolve(DIRS.networkAssetReusableDispositions), ["dispositionHash"]],
  [path.resolve(DIRS.networkAssetQualifications), ["qualificationHash"]],
  [path.resolve(DIRS.networkUniversePlanningGrants), ["universeGrantHash"]],
  [path.resolve(DIRS.networkUniverseDisclosureGrants), ["disclosureGrantHash"]],
  [path.resolve(DIRS.networkUniverseGrantEvents), ["grantEventHash"]],
  [path.resolve(DIRS.networkSynthesisConsumptionManifests), ["manifestHash"]],
  [path.resolve(DIRS.networkSynthesisRuns), ["synthesisRunHash"]],
  [path.resolve(DIRS.inventoryAuthorizations), ["authorizationHash"]],
  [path.resolve(DIRS.plannerInputs), ["canonicalHash"]],
  [path.resolve(DIRS.plannerSessions), ["sessionHash"]],
  [path.resolve(DIRS.plannerArtifacts), ["submittedArtifactHash", "artifactHash"]],
  [path.resolve(DIRS.commercialPlanningIntakes), ["receiptHash"]],
]);

export function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, X-Requested-With, X-Teralinx-Runtime, X-Hyperlinx-Demo-Persona, X-Hyperlinx-Demo-Customer-Organization",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Expose-Headers": "Content-Type, Content-Disposition, Content-Length, Authorization, X-Teralinx-Export-Hash, X-Teralinx-Authority-Hash, X-Teralinx-Geometry-Hash, X-Teralinx-Route-Revision, X-Teralinx-Execution-State",
    "Access-Control-Max-Age": "86400",
    "Access-Control-Allow-Private-Network": "true",
    Vary: "Origin, Access-Control-Request-Headers, Access-Control-Request-Method",
  };
}

export function jsonResponse(res, statusCode, payload) {
  const body = JSON.stringify(payload ?? {});
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    ...corsHeaders(),
  });
  res.end(body);
}

export function errorResponse(res, statusCode, message) {
  jsonResponse(res, statusCode, { error: message });
}

export function handleOptions(req, res) {
  if (req.method !== "OPTIONS") return false;
  res.writeHead(204, corsHeaders());
  res.end();
  return true;
}

export async function readRequestJson(req) {
  const { body } = await readRequestJsonWithRaw(req);
  return body;
}

export async function readRequestJsonWithRaw(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return {
    raw,
    byteLength: Buffer.byteLength(raw, "utf8"),
    body: raw.trim() ? JSON.parse(raw) : {},
  };
}

export function nowIso() {
  return new Date().toISOString();
}

export function createId(prefix) {
  const authorityPrefix = currentRepositoryAuthority().authorityClass === "DEMO" && !String(prefix).toUpperCase().includes("DEMO")
    ? `DEMO-${prefix}`
    : prefix;
  return `${authorityPrefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function ensureDir(dir) {
  await mkdir(dir, { recursive: true });
}

function sharedRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function sharedFirstText(...values) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function sharedArray(value) {
  return Array.isArray(value) ? value : [];
}

export const IOF_PROJECTION_ARTIFACT_SPECS = [
  {
    field: "engineeringObjectManifest",
    aliases: ["doctrineObjectManifest"],
    idFields: ["engineeringObjectManifestId", "doctrineObjectManifestId", "objectManifestId", "manifestId"],
    dirKey: "engineeringObjectManifests",
    refKey: "engineeringObjectManifest",
    repositoryType: "ENGINEERING_OBJECT_MANIFEST",
    authority: "DOCTRINE_OBJECT_INSTANTIATION_ENGINE",
  },
  {
    field: "stationProjection",
    aliases: [],
    idFields: ["stationProjectionId", "projectionId"],
    dirKey: "stationProjections",
    refKey: "stationProjection",
    repositoryType: "STATION_PROJECTION",
    authority: "DOCTRINE_PROJECTION_ENGINE",
  },
  {
    field: "stationGraph",
    aliases: ["stationIndexedGraph"],
    idFields: ["stationGraphId", "graphId"],
    dirKey: "stationGraphs",
    refKey: "stationGraph",
    repositoryType: "STATION_GRAPH",
    authority: "DOCTRINE_PROJECTION_ENGINE",
  },
  {
    field: "stationObjectManifest",
    aliases: [],
    idFields: ["stationObjectManifestId", "manifestId"],
    dirKey: "stationObjectManifests",
    refKey: "stationObjectManifest",
    repositoryType: "STATION_OBJECT_MANIFEST",
    authority: "DOCTRINE_PROJECTION_ENGINE",
  },
  {
    field: "measuredCenterline",
    aliases: ["measuredSpine"],
    idFields: ["measuredCenterlineId", "measuredSpineId", "spineId"],
    dirKey: "measuredCenterlines",
    refKey: "measuredCenterline",
    repositoryType: "MEASURED_CENTERLINE",
    authority: "DOCTRINE_PROJECTION_ENGINE",
  },
  {
    field: "projectedObjectManifest",
    aliases: [],
    idFields: ["projectedObjectManifestId", "manifestId"],
    dirKey: "projectedObjectManifests",
    refKey: "projectedObjectManifest",
    repositoryType: "PROJECTED_OBJECT_MANIFEST",
    authority: "DOCTRINE_PROJECTION_ENGINE",
  },
  {
    field: "closureLedger",
    aliases: [],
    idFields: ["closureLedgerId", "ledgerId"],
    dirKey: "closureLedgers",
    refKey: "closureLedger",
    repositoryType: "CLOSURE_LEDGER",
    authority: "CLOSURE_LEDGER",
  },
  {
    field: "iofPackageTwin",
    aliases: ["iofTwin"],
    idFields: ["iofPackageTwinId", "twinProjectionId", "packageTwinId"],
    dirKey: "iofPackageTwins",
    refKey: "iofPackageTwin",
    repositoryType: "IOF_PACKAGE_TWIN",
    authority: "IOF_PACKAGE_TWIN",
  },
  {
    field: "productDoctrineAssembly",
    aliases: ["doctrineAssembly"],
    idFields: ["productDoctrineAssemblyId", "assemblyId", "productDoctrineId", "doctrineId"],
    dirKey: "productDoctrineAssemblies",
    refKey: "productDoctrineAssembly",
    repositoryType: "PRODUCT_DOCTRINE_ASSEMBLY",
    authority: "PRODUCT_DOCTRINE_ASSEMBLY_ENGINE",
  },
  {
    field: "projectConfiguration",
    aliases: [],
    idFields: ["projectConfigurationId", "configurationId"],
    dirKey: "projectConfigurations",
    refKey: "projectConfiguration",
    repositoryType: "PROJECT_CONFIGURATION",
    authority: "PROJECT_CONFIGURATION_REPOSITORY",
  },
  {
    field: "quantityReconciliation",
    aliases: ["commercialAuditReconciliation"],
    idFields: ["quantityReconciliationId", "reconciliationId"],
    dirKey: "quantityReconciliations",
    refKey: "quantityReconciliation",
    repositoryType: "QUANTITY_RECONCILIATION",
    authority: "COMMERCIAL_QUANTITY_RECONCILIATION",
  },
];

function artifactHash(payload) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function governedArtifactHash(payload) {
  return artifactHash(payload);
}

function artifactIntegrityError(message) {
  const error = new Error(`ARTIFACT_INTEGRITY_FAILURE: ${message}`);
  error.code = "ARTIFACT_INTEGRITY_FAILURE";
  error.status = 409;
  return error;
}

function artifactSourceFor(record, spec) {
  const candidates = [record?.[spec.field], ...spec.aliases.map((alias) => record?.[alias])];
  return candidates.map(sharedRecord).find((candidate) => Object.keys(candidate).length) ?? {};
}

function artifactIdFor(record, artifact, spec) {
  return sharedFirstText(
    ...spec.idFields.map((field) => artifact?.[field]),
    ...spec.idFields.map((field) => record?.[field]),
  );
}

export function stripIofProjectionArtifacts(record = {}, artifactReferences = undefined) {
  const next = { ...record };
  for (const spec of IOF_PROJECTION_ARTIFACT_SPECS) {
    delete next[spec.field];
    for (const alias of spec.aliases) delete next[alias];
  }
  delete next.doctrineObjectInstantiation;
  // Product Doctrine is immutable source authority resolved by the exact
  // id/version/hash bound to the Proposal Revision. The assembled doctrine is
  // persisted in the Product Doctrine Assembly repository and must not be
  // embedded in the reference-only Draft IOF envelope.
  delete next.productDoctrine;
  delete next.doctrineProjection;
  delete next.projectedObjects;
  delete next.projectedSpans;
  delete next.workSegments;
  delete next.objectStationAttachments;
  delete next.objectAddresses;
  delete next.stationAddressRegistry;
  delete next.commercialAuditReconciliation;
  delete next.constitutionalStateValidation;
  delete next.doctrineInstantiatedObjects;
  delete next.geometry;
  delete next.centerline;
  delete next.centerlineRoute;
  delete next.osrmRoute;
  delete next.spine;
  // Station/closure assembly exposes these repository-backed projections as
  // convenient top-level views while a Draft IOF is hydrated. They must not be
  // copied back into the reference-only repository record during handoff.
  for (const field of [
    "stationAuthority",
    "stations",
    "spineAuditProjection",
    "spineObjectCatalogEntries",
    "instantiatedSpineObjects",
    "auditObjectManifestEntries",
    "objects",
    "spineReviewObjects",
    "linearAssetSpanAttachments",
    "doctrineLinearAssetSpanAttachments",
    "spineAuditAttachments",
    "proposedIofUnits",
    "constructionSegments",
    "kernelSpineObjectReferences",
    "executionZones",
    "addressBindings",
    "productionScheduleProjection",
    "stationedExpectations",
    "doctrineProjectionDiagnostics",
    "objectProductionProfiles",
    "paymentSegments",
    "productionBindings",
    "closureExpectations",
    "productionCostProjection",
    "stationRangeExpectations",
    "productionPaymentProjection",
  ]) delete next[field];
  const references = artifactReferences ?? record.iofArtifactRepositoryReferences;
  return {
    ...next,
    iofArtifactRepositoryReferences: references ?? next.iofArtifactRepositoryReferences ?? {},
    referenceOnly: true,
    noEmbeddedManifests: true,
    noEmbeddedGeometry: true,
    noDuplicatedObjectGraphs: true,
  };
}

function iofProjectionArtifactWrites(record = {}, metadata = {}) {
  const timestamp = metadata.timestamp ?? nowIso();
  const references = {};
  const writes = [];
  for (const spec of IOF_PROJECTION_ARTIFACT_SPECS) {
    const source = artifactSourceFor(record, spec);
    const artifactId = artifactIdFor(record, source, spec);
    if (!artifactId || !Object.keys(source).length) continue;
    const revision = sharedFirstText(source.revision, source.revisionId, record.routeRevision, record.packageRevision, "1");
    const hash = artifactHash(source);
    const artifact = {
      artifactId,
      revision,
      hash,
      payload: source,
      packageId: record.packageId,
      draftIofPackageId: record.draftIofPackageId ?? record.draftPackageId ?? record.packageId,
      proposalId: record.proposalId,
      opportunityId: record.opportunityId,
      organizationId: record.organizationId,
      tenantId: record.tenantId ?? record.organizationId,
      customerId: record.customerId ?? record.accountId,
      routeRepositoryId: record.routeRepositoryId ?? sharedRecord(record.routeRepositoryRef).routeRepositoryId,
      repositoryType: spec.repositoryType,
      authority: source.authority ?? spec.authority,
      immutable: true,
      sourceAuthority: "COMMERCIAL_DRAFT_IOF_PACKAGE_ASSEMBLY",
      createdAt: source.createdAt ?? record.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    writes.push({
      dir: DIRS[spec.dirKey],
      id: artifactId,
      record: artifact,
      immutable: true,
      artifactType: spec.repositoryType,
    });
    references[spec.refKey] = {
      artifactType: spec.repositoryType,
      artifactId,
      revision,
      hash,
      organizationId: artifact.organizationId,
      tenantId: artifact.tenantId,
      customerId: artifact.customerId,
      opportunityId: artifact.opportunityId,
      createdAt: artifact.createdAt,
      repositoryType: spec.repositoryType,
      repositoryPath: `server/data/${DIRS[spec.dirKey].split(/[\\/]/).pop()}`,
      field: spec.field,
      authority: artifact.authority,
      immutable: true,
      referenceOnly: true,
    };
  }
  return { references, writes };
}

function immutableArtifactConflict(artifactType, artifactId, existingHash, incomingHash) {
  const error = new Error(`IMMUTABLE_ARTIFACT_CONFLICT: ${artifactType} ${artifactId} already exists with hash ${existingHash}; incoming hash ${incomingHash}.`);
  error.code = "IMMUTABLE_ARTIFACT_CONFLICT";
  error.status = 409;
  error.details = { artifactType, artifactId, existingHash, incomingHash };
  return error;
}

const governedCommitLocks = new Map();

const CIP081_BLUE_MESA_RECOVERY = Object.freeze({
  cip: "CIP-081",
  mode: "FORENSIC_RECOVERY",
  reasonCode: "PRE_CIP080_COMPETING_IOF_WRITER_RECONCILIATION",
  evidenceId: "DEMO-CIP-081-BLUE-MESA-R1-DRAFT-IOF-RECONCILIATION",
  packageId: "DRAFT-IOF-DEMO-PROP-BLUE-MESA-DIGITAL-SYSTEMS-OPPORTUNITY-3-v1",
  proposalId: "DEMO-PROP-BLUE-MESA-DIGITAL-SYSTEMS-OPPORTUNITY-3-v1",
  proposalRevisionId: "DEMO-PROP-BLUE-MESA-DIGITAL-SYSTEMS-OPPORTUNITY-3-v1-revision-1",
  proposalHash: "1c0b0e5ff00f48b68ce70150ba2f174a9a99aff63ff3c77ff026be9fd46146e8",
  routeRepositoryId: "ROUTE-REPO-DEMO-OPP-BLUE-MESA-DIGITAL-SYSTEMS-OPPORTUNITY-3-1787237904360-COMMERCIAL-DRAFT-IMPORT-ROUTE-CHEYENNE-METRO-DUCT-SYSTEM-31-1",
  commercialRevisionHash: "commercial-revision-0f8acd705b95820b",
  commercialReleaseHash: "commercial-release-4a92c1a05e561ad8",
  artifacts: Object.freeze({
    "DRAFT-IOF-DEMO-PROP-BLUE-MESA-DIGITAL-SYSTEMS-OPPORTUNITY-3-v1:DOCTRINE-ENGINEERING-OBJECT-MANIFEST": Object.freeze({
      conflictingHash: "c25efe68898e4adaad7d8c09f1cb28294585004187a5b3cb1451b2a082f3a49e",
      expectedUpstreamHash: "f74be905815431731e375392772f598fe104f212e5f6a3404de7a111a105e19d",
    }),
    "DRAFT-IOF-DEMO-PROP-BLUE-MESA-DIGITAL-SYSTEMS-OPPORTUNITY-3-v1:CLOSURE-LEDGER": Object.freeze({
      conflictingHash: "ef6b2c28ad0d857765df2d1af04fde19d1682d1b101694f47a46c32756579042",
      expectedUpstreamHash: "0c5ee5c5ec592e0f4a019c4c7ce9ab650e817f9b06750d271e35ba198271e425",
    }),
    "DRAFT-IOF-DEMO-PROP-BLUE-MESA-DIGITAL-SYSTEMS-OPPORTUNITY-3-v1:IOF-PACKAGE-TWIN": Object.freeze({
      conflictingHash: "781ce3ecfd1efeac9409604e258f94f877ac370d06b43d767012e975f75061e8",
      expectedUpstreamHash: "84036113698a4a45d79acefaac55c8c16176b4f53325692296b661618aa08c99",
    }),
  }),
});

function forensicRecoveryError(code, message) {
  const error = new Error(`${code}: ${message}`);
  error.code = code;
  error.status = 409;
  return error;
}

function assertCip081BlueMesaRecovery(record, metadata, artifactWrites) {
  const recovery = sharedRecord(metadata.forensicRecovery);
  if (!Object.keys(recovery).length) return null;
  const authority = currentRepositoryAuthority();
  const permissions = sharedArray(metadata.user?.permissions);
  if (recovery.authorized !== true
    || recovery.mode !== CIP081_BLUE_MESA_RECOVERY.mode
    || recovery.cip !== CIP081_BLUE_MESA_RECOVERY.cip
    || recovery.reasonCode !== CIP081_BLUE_MESA_RECOVERY.reasonCode
    || recovery.evidenceId !== CIP081_BLUE_MESA_RECOVERY.evidenceId
    || authority.authorityClass !== "DEMO"
    || !permissions.includes("system.forensic_recovery")
    || !sharedFirstText(recovery.operator, metadata.user?.principalId)
    || !sharedFirstText(recovery.transactionId)) {
    throw forensicRecoveryError("FORENSIC_RECOVERY_AUTHORITY_REQUIRED", "CIP-081 recovery requires exact administrator authority, reason, operator, and transaction identity");
  }
  for (const [field, expected] of Object.entries({
    packageId: CIP081_BLUE_MESA_RECOVERY.packageId,
    proposalId: CIP081_BLUE_MESA_RECOVERY.proposalId,
    proposalRevisionId: CIP081_BLUE_MESA_RECOVERY.proposalRevisionId,
    proposalHash: CIP081_BLUE_MESA_RECOVERY.proposalHash,
    routeRepositoryId: CIP081_BLUE_MESA_RECOVERY.routeRepositoryId,
    commercialRevisionHash: CIP081_BLUE_MESA_RECOVERY.commercialRevisionHash,
    commercialReleaseHash: CIP081_BLUE_MESA_RECOVERY.commercialReleaseHash,
  })) {
    if (sharedFirstText(record[field]) !== expected) throw forensicRecoveryError("FORENSIC_RECOVERY_LINEAGE_MISMATCH", `${field} is not the exact authorized Blue Mesa authority`);
  }
  const suppliedArtifacts = sharedRecord(recovery.artifacts);
  const expectedIds = Object.keys(CIP081_BLUE_MESA_RECOVERY.artifacts).sort();
  if (JSON.stringify(Object.keys(suppliedArtifacts).sort()) !== JSON.stringify(expectedIds)) {
    throw forensicRecoveryError("FORENSIC_RECOVERY_SCOPE_MISMATCH", "recovery artifact set is not the exact bounded CIP-081 set");
  }
  for (const artifactId of expectedIds) {
    const expected = CIP081_BLUE_MESA_RECOVERY.artifacts[artifactId];
    const supplied = sharedRecord(suppliedArtifacts[artifactId]);
    const incoming = artifactWrites.find((write) => write.id === artifactId);
    if (supplied.conflictingHash !== expected.conflictingHash
      || supplied.expectedUpstreamHash !== expected.expectedUpstreamHash
      || sharedFirstText(incoming?.record?.hash) !== expected.expectedUpstreamHash) {
      throw forensicRecoveryError("FORENSIC_RECOVERY_SCOPE_MISMATCH", `${artifactId} does not match the proven conflict/canonical hash pair`);
    }
  }
  return recovery;
}

function governedRepositoryGraphDigest(snapshots, useIncoming) {
  const entries = snapshots
    .filter((snapshot) => snapshot.artifactType !== "RUNTIME_HISTORY" && snapshot.artifactType !== "FORENSIC_RECOVERY_EVIDENCE")
    .map((snapshot) => {
      const value = useIncoming
        ? governedRecordForAuthority(snapshot.id, snapshot.record)
        : snapshot.existing;
      return {
        repository: path.basename(snapshot.dir),
        artifactType: snapshot.artifactType,
        id: snapshot.id,
        digest: value ? artifactHash(value) : null,
      };
    })
    .sort((left, right) => `${left.repository}/${left.id}`.localeCompare(`${right.repository}/${right.id}`));
  return artifactHash(entries);
}

async function withGovernedCommitLock(key, operation) {
  const prior = governedCommitLocks.get(key) ?? Promise.resolve();
  let release;
  const current = new Promise((resolve) => { release = resolve; });
  const queued = prior.then(() => current);
  governedCommitLocks.set(key, queued);
  await prior;
  try {
    return await operation();
  } finally {
    release();
    if (governedCommitLocks.get(key) === queued) governedCommitLocks.delete(key);
  }
}

/**
 * The sole persistence authority for the immutable Commercial Draft IOF artifact
 * set. Callers provide one complete server-assembled package. Every artifact and
 * the reference-only envelope is preflighted before the first authoritative
 * write; failures roll the complete set back to its prior repository state.
 */
export async function commitCanonicalDraftIofPackage(record = {}, metadata = {}) {
  const packageId = sharedFirstText(record.packageId, record.draftIofPackageId, record.draftPackageId);
  if (!packageId) throw artifactIntegrityError("canonical Draft IOF commit requires packageId");
  const timestamp = metadata.timestamp ?? nowIso();
  return withGovernedCommitLock(packageId, async () => {
    const { references, writes: artifactWrites } = iofProjectionArtifactWrites(record, { ...metadata, timestamp });
    if (!artifactWrites.length) throw artifactIntegrityError("canonical Draft IOF commit contains no governed artifacts");
    const requiredTypes = new Set(metadata.requiredArtifactTypes ?? ["ENGINEERING_OBJECT_MANIFEST", "STATION_OBJECT_MANIFEST", "PROJECTED_OBJECT_MANIFEST"]);
    const presentTypes = new Set(artifactWrites.map((write) => write.artifactType));
    const missingTypes = [...requiredTypes].filter((type) => !presentTypes.has(type));
    if (missingTypes.length) throw artifactIntegrityError(`canonical Draft IOF commit missing ${missingTypes.join(", ")}`);
    const forensicRecovery = assertCip081BlueMesaRecovery(record, metadata, artifactWrites);

    const envelope = stripIofProjectionArtifacts({
      ...record,
      iofArtifactRepositoryReferences: references,
      canonicalAssemblyAuthority: "SERVER_CANONICAL_IOF_ASSEMBLY",
      canonicalPersistenceAuthority: "ATOMIC_GOVERNED_IOF_COMMIT",
      repositoryAssemblyStatus: "ATOMICALLY_COMMITTED",
      referenceOnly: true,
      updatedAt: timestamp,
    }, references);
    const writes = [
      ...artifactWrites,
      { dir: DIRS.iofPackages, id: packageId, record: envelope, immutable: false, artifactType: "DRAFT_IOF_ENVELOPE" },
      ...sharedArray(metadata.additionalWrites),
    ];
    const snapshots = [];
    const skipped = [];
    for (const write of writes) {
      const existing = await loadRecord(write.dir, write.id).catch(() => null);
      snapshots.push({ ...write, existing });
      if (!write.immutable || !existing) continue;
      const existingHash = sharedFirstText(existing.hash) || artifactHash(sharedRecord(existing.payload));
      const incomingHash = sharedFirstText(write.record?.hash) || artifactHash(sharedRecord(write.record?.payload));
      if (existingHash === incomingHash) {
        skipped.push(write.id);
        continue;
      }
      const recovery = sharedRecord(metadata.forensicRecovery);
      const recoveryArtifacts = sharedRecord(recovery.artifacts);
      const recoveryEntry = sharedRecord(recoveryArtifacts[write.id]);
      const expectedUpstreamHash = sharedFirstText(recoveryEntry.expectedUpstreamHash, recovery.expectedUpstreamHash);
      const conflictingHash = sharedFirstText(recoveryEntry.conflictingHash, recovery.conflictingHash);
      const mayRecover = recovery.authorized === true
        && incomingHash === expectedUpstreamHash
        && conflictingHash === existingHash;
      if (!mayRecover) throw immutableArtifactConflict(write.artifactType, write.id, existingHash, incomingHash);
      snapshots[snapshots.length - 1].recoveryAuthorized = true;
    }

    if (forensicRecovery) {
      const existingEvidence = await loadRecord(DIRS.forensicRecoveryEvidence, forensicRecovery.evidenceId).catch(() => null);
      if (existingEvidence) throw forensicRecoveryError("FORENSIC_RECOVERY_ALREADY_EXECUTED", forensicRecovery.evidenceId);
      const recoveredArtifactIds = snapshots.filter((snapshot) => snapshot.recoveryAuthorized).map((snapshot) => snapshot.id).sort();
      const expectedRecoveredIds = Object.keys(CIP081_BLUE_MESA_RECOVERY.artifacts).sort();
      if (JSON.stringify(recoveredArtifactIds) !== JSON.stringify(expectedRecoveredIds)) {
        throw forensicRecoveryError("FORENSIC_RECOVERY_PRECONDITION_MISMATCH", "repository no longer contains the exact proven historical conflict set");
      }
      const evidence = {
        evidenceId: forensicRecovery.evidenceId,
        cip: forensicRecovery.cip,
        mode: forensicRecovery.mode,
        reasonCode: forensicRecovery.reasonCode,
        recoveryTransaction: forensicRecovery.transactionId,
        operator: forensicRecovery.operator,
        timestamp,
        packageId: record.packageId,
        proposalId: record.proposalId,
        proposalRevisionId: record.proposalRevisionId,
        proposalHash: record.proposalHash,
        routeRepositoryId: record.routeRepositoryId,
        routeRevision: record.routeRevision,
        geometryId: record.geometryId ?? record.routeGeometryId,
        geometryHash: record.geometryHash,
        commercialRevisionId: record.commercialRevisionId,
        commercialRevisionHash: record.commercialRevisionHash,
        commercialReleasePackageId: record.commercialReleasePackageId,
        commercialReleaseHash: record.commercialReleaseHash,
        supersededCommercialReleasePackageId: forensicRecovery.supersededCommercialReleasePackageId,
        supersededCommercialRevisionHash: forensicRecovery.supersededCommercialRevisionHash,
        artifacts: expectedRecoveredIds.map((artifactId) => ({ artifactId, ...CIP081_BLUE_MESA_RECOVERY.artifacts[artifactId] })),
        beforeRepositoryDigest: governedRepositoryGraphDigest(snapshots, false),
        afterRepositoryDigest: governedRepositoryGraphDigest(snapshots, true),
        forensicEvidenceReferences: sharedArray(forensicRecovery.forensicEvidenceReferences),
        immutable: true,
        oneTime: true,
        authority: "CIP_081_FORENSIC_RECOVERY_AUTHORITY",
      };
      snapshots.push({
        dir: DIRS.forensicRecoveryEvidence,
        id: evidence.evidenceId,
        record: evidence,
        existing: null,
        immutable: true,
        artifactType: "FORENSIC_RECOVERY_EVIDENCE",
      });
    }

    const completed = [];
    try {
      for (const snapshot of snapshots) {
        if (skipped.includes(snapshot.id) && snapshot.immutable) continue;
        if (snapshot.recoveryAuthorized) {
          await immutableArtifactRecoveryAuthority.run(true, () => persistRecord(snapshot.dir, snapshot.id, snapshot.record));
        } else {
          await persistRecord(snapshot.dir, snapshot.id, snapshot.record);
        }
        completed.push(snapshot);
      }
    } catch (error) {
      for (const snapshot of completed.reverse()) {
        if (snapshot.existing && snapshot.recoveryAuthorized) {
          await immutableArtifactRecoveryAuthority.run(true, () => persistRecord(snapshot.dir, snapshot.id, snapshot.existing)).catch(() => undefined);
        } else if (snapshot.existing) await persistRecord(snapshot.dir, snapshot.id, snapshot.existing).catch(() => undefined);
        else await deleteRecord(snapshot.dir, snapshot.id).catch(() => undefined);
      }
      throw error;
    }
    return {
      envelope,
      references,
      transactionState: skipped.length === artifactWrites.length ? "IDEMPOTENT_REPLAY" : "COMMITTED",
      idempotentArtifactIds: skipped,
      artifactIds: artifactWrites.map((write) => write.id),
    };
  });
}

// Removed as an authoritative writer by CIP-080. Keeping the exported symbol
// makes legacy imports fail closed instead of silently gaining an independent
// repository mutation path.
export async function persistIofProjectionArtifacts() {
  const error = new Error("CANONICAL_IOF_PERSISTENCE_AUTHORITY_REQUIRED: submit one Proposal lineage intention to the canonical Draft IOF commit authority.");
  error.code = "CANONICAL_IOF_PERSISTENCE_AUTHORITY_REQUIRED";
  error.status = 409;
  throw error;
}

export async function hydrateIofProjectionArtifacts(record = {}, options = {}) {
  if (!record || typeof record !== "object") return record;
  const references = sharedRecord(record.iofArtifactRepositoryReferences);
  const hydrated = { ...record };
  for (const spec of IOF_PROJECTION_ARTIFACT_SPECS) {
    const existing = artifactSourceFor(hydrated, spec);
    if (Object.keys(existing).length) continue;
    const reference = sharedRecord(references[spec.refKey]);
    const artifactId = sharedFirstText(
      reference.artifactId,
      ...spec.idFields.map((field) => hydrated[field]),
    );
    if (!artifactId) continue;
    const artifact = await loadRecord(DIRS[spec.dirKey], artifactId).catch(() => null);
    if (!artifact) {
      if (options.strict && reference.artifactId) throw artifactIntegrityError(`missing ${spec.repositoryType} ${artifactId}`);
      continue;
    }
    const payload = sharedRecord(artifact.payload);
    const resolved = Object.keys(payload).length ? payload : artifact;
    if (options.strict && reference.artifactId) {
      if (!sharedFirstText(reference.revision) || !sharedFirstText(reference.hash)) throw artifactIntegrityError(`${spec.repositoryType} reference is missing immutable revision/hash`);
      if (sharedFirstText(artifact.artifactId) !== sharedFirstText(reference.artifactId)) throw artifactIntegrityError(`${spec.repositoryType} artifact ID mismatch`);
      if (sharedFirstText(reference.revision) && sharedFirstText(artifact.revision) !== sharedFirstText(reference.revision)) throw artifactIntegrityError(`${spec.repositoryType} revision mismatch`);
      if (sharedFirstText(reference.hash) && artifactHash(resolved) !== sharedFirstText(reference.hash)) throw artifactIntegrityError(`${spec.repositoryType} hash mismatch`);
      for (const field of ["organizationId", "tenantId", "customerId", "opportunityId"]) {
        const expected = sharedFirstText(record[field], reference[field]);
        const actual = sharedFirstText(artifact[field]);
        if (expected && actual && expected !== actual) throw artifactIntegrityError(`${spec.repositoryType} ${field} scope mismatch`);
      }
    }
    hydrated[spec.field] = resolved;
    for (const alias of spec.aliases) hydrated[alias] = resolved;
    for (const field of spec.idFields) {
      if (!hydrated[field] && resolved[field]) hydrated[field] = resolved[field];
    }
  }
  const stationGraph = sharedRecord(hydrated.stationGraph);
  if (!hydrated.stationIndexedGraph && Object.keys(stationGraph).length) hydrated.stationIndexedGraph = stationGraph;
  // Reference-only Draft IOF records persist the governed station list inside
  // the immutable Station Projection artifact. Engineering historically read a
  // pre-normalization top-level `stationAuthority`, which made valid station and
  // graph authority appear absent after rehydration. Project the existing
  // authority into that response contract; do not persist or regenerate it.
  const stationProjection = sharedRecord(hydrated.stationProjection);
  const projectedStations = sharedArray(stationProjection.stations);
  if (!Object.keys(sharedRecord(hydrated.stationAuthority)).length && projectedStations.length) {
    const stationAuthorityId = sharedFirstText(
      sharedArray(stationProjection.stationAuthorityIds)[0],
      sharedArray(hydrated.stationAuthorityIds)[0],
      sharedRecord(hydrated.stationObjectManifest).stationAuthorityId,
    );
    const firstMeasure = Number(sharedRecord(projectedStations[0]).stationFeet ?? sharedRecord(projectedStations[0]).measuredDistanceFeet ?? sharedRecord(projectedStations[0]).measure);
    const secondMeasure = Number(sharedRecord(projectedStations[1]).stationFeet ?? sharedRecord(projectedStations[1]).measuredDistanceFeet ?? sharedRecord(projectedStations[1]).measure);
    const intervalFeet = Number.isFinite(firstMeasure) && Number.isFinite(secondMeasure)
      ? Math.abs(secondMeasure - firstMeasure)
      : 0;
    hydrated.stationAuthority = {
      authorityId: stationAuthorityId,
      stationAuthorityId,
      stationAuthorityIds: stationAuthorityId ? [stationAuthorityId] : [],
      stationProjectionId: sharedFirstText(stationProjection.stationProjectionId, hydrated.stationProjectionId),
      stationGraphId: sharedFirstText(stationProjection.stationGraphId, hydrated.stationGraphId),
      intervalFeet,
      stationCount: projectedStations.length,
      stations: projectedStations,
      authority: sharedFirstText(stationProjection.authority, "DOCTRINE_PROJECTION_ENGINE"),
      responseProjectionOnly: true,
    };
  }
  if (!sharedArray(hydrated.stations).length && projectedStations.length) hydrated.stations = projectedStations;
  const engineeringObjectManifest = sharedRecord(hydrated.engineeringObjectManifest);
  if (!hydrated.doctrineObjectManifest && Object.keys(engineeringObjectManifest).length) hydrated.doctrineObjectManifest = engineeringObjectManifest;
  const projectedObjectManifest = sharedRecord(hydrated.projectedObjectManifest);
  if (!sharedArray(hydrated.projectedObjects).length && sharedArray(projectedObjectManifest.projectedObjects).length) {
    hydrated.projectedObjects = projectedObjectManifest.projectedObjects;
  }
  if (!sharedArray(hydrated.projectedSpans).length && sharedArray(projectedObjectManifest.projectedSpans).length) {
    hydrated.projectedSpans = projectedObjectManifest.projectedSpans;
  }
  if (!sharedArray(hydrated.objectAddresses).length && sharedArray(projectedObjectManifest.objectAddresses).length) {
    hydrated.objectAddresses = projectedObjectManifest.objectAddresses;
  }
  // Project the attachment view from the exact governed object station address
  // when the former redundant attachment array is absent. The source object,
  // station identity, coordinate and projection hash remain the authority.
  if (!sharedArray(hydrated.objectStationAttachments).length && sharedArray(projectedObjectManifest.projectedObjects).length) {
    hydrated.objectStationAttachments = projectedObjectManifest.projectedObjects
      .filter((value) => {
        const object = sharedRecord(value);
        return Boolean(sharedFirstText(object.objectId) && sharedFirstText(object.stationId) && Array.isArray(object.projectedCoordinate ?? object.coordinate));
      })
      .map((value) => {
        const object = sharedRecord(value);
        const objectId = sharedFirstText(object.objectId);
        return {
          attachmentId: `${objectId}:PROJECTED-STATION-ATTACHMENT`,
          objectId,
          stationId: sharedFirstText(object.stationId),
          stationLabel: sharedFirstText(object.stationAddress),
          stationValue: object.stationValue ?? object.measure,
          coordinate: object.projectedCoordinate ?? object.coordinate,
          attachmentMethod: "GOVERNED_PROJECTED_OBJECT_STATION_ADDRESS",
          attachmentStatus: "ATTACHED",
          projectionHash: object.projectionHash,
          sourceAuthority: sharedFirstText(object.projectionAuthority, object.engineeringAuthority, "DOCTRINE_PROJECTION_ENGINE"),
          responseProjectionOnly: true,
        };
      });
  }
  if (!sharedArray(hydrated.linearAssetSpanAttachments).length && sharedArray(projectedObjectManifest.linearAssetSpanAttachments).length) {
    hydrated.linearAssetSpanAttachments = projectedObjectManifest.linearAssetSpanAttachments;
  }
  if (!sharedArray(hydrated.doctrineLinearAssetSpanAttachments).length && sharedArray(projectedObjectManifest.linearAssetSpanAttachments).length) {
    hydrated.doctrineLinearAssetSpanAttachments = projectedObjectManifest.linearAssetSpanAttachments;
  }
  if (!sharedRecord(hydrated.geometryAuthorityDiagnostics).diagnosticsId && sharedRecord(projectedObjectManifest.geometryAuthorityDiagnostics).diagnosticsId) {
    hydrated.geometryAuthorityDiagnostics = projectedObjectManifest.geometryAuthorityDiagnostics;
  }
  if (!sharedRecord(hydrated.closureLedger).closureLedgerId && sharedRecord(projectedObjectManifest.closureLedger).closureLedgerId) {
    hydrated.closureLedger = projectedObjectManifest.closureLedger;
    hydrated.closureLedgerId = hydrated.closureLedgerId ?? projectedObjectManifest.closureLedger.closureLedgerId;
  }
  if (!sharedRecord(hydrated.iofPackageTwin).twinProjectionId && sharedRecord(projectedObjectManifest.iofPackageTwin).twinProjectionId) {
    hydrated.iofPackageTwin = projectedObjectManifest.iofPackageTwin;
    hydrated.iofPackageTwinId = hydrated.iofPackageTwinId ?? projectedObjectManifest.iofPackageTwin.twinProjectionId;
  }
  if (!sharedArray(hydrated.workSegments).length && sharedArray(projectedObjectManifest.workSegments).length) {
    hydrated.workSegments = projectedObjectManifest.workSegments;
  }
  if (!sharedRecord(hydrated.commercialAuditReconciliation).reconciliationId && sharedRecord(projectedObjectManifest.commercialAuditReconciliation).reconciliationId) {
    hydrated.commercialAuditReconciliation = projectedObjectManifest.commercialAuditReconciliation;
  }
  if (!sharedRecord(hydrated.constitutionalStateValidation).validationId && sharedRecord(projectedObjectManifest.constitutionalStateValidation).validationId) {
    hydrated.constitutionalStateValidation = projectedObjectManifest.constitutionalStateValidation;
  }
  return hydrated;
}

export function recordPath(dir, id) {
  return path.join(resolveRepositoryDir(dir), `${encodeURIComponent(String(id))}.json`);
}

export async function listRecords(dir, options = {}) {
  const authority = currentRepositoryAuthority();
  if (authority.authorityClass !== "DEMO" && postgresReadsEnabled()) return listPostgresRecords(dir);
  const scopedDir = resolveRepositoryDir(dir);
  if (options.readOnly !== true) await ensureDir(scopedDir);
  const files = await readdir(scopedDir).catch(error => {
    if (options.strict === true && error.code !== "ENOENT") throw Object.assign(new Error("REPOSITORY_RECORD_READ_FAILED"), { code: "REPOSITORY_RECORD_READ_FAILED", status: 409 });
    return [];
  });
  const records = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      const record = JSON.parse(await readFile(path.join(scopedDir, file), "utf8"));
      records.push(options.projectRepositoryAuthority === false ? record : projectRecordForRepositoryAuthority(record));
    } catch {
      if (options.strict === true) throw Object.assign(new Error("REPOSITORY_RECORD_READ_FAILED"), { code: "REPOSITORY_RECORD_READ_FAILED", status: 409 });
      // Skip corrupt records; endpoint health should survive one bad file.
    }
  }
  return records;
}

export async function loadRecord(dir, id, options = {}) {
  const authority = currentRepositoryAuthority();
  if (authority.authorityClass !== "DEMO" && postgresReadsEnabled()) return loadPostgresRecord(dir, id);
  const record = JSON.parse(await readFile(recordPath(dir, id), "utf8"));
  return options.projectRepositoryAuthority === false ? record : projectRecordForRepositoryAuthority(record);
}

export async function persistRecord(dir, id, record) {
  const authority = currentRepositoryAuthority();
  const governedRecord = governedRecordForAuthority(id, record);
  if (path.resolve(dir) === path.resolve(DIRS.serviceOrders)) {
    const existing = await loadRecord(dir, id, { projectRepositoryAuthority: false }).catch(() => null);
    if (existing?.issuanceEvidence) {
      if (!governedRecord?.issuanceEvidence || JSON.stringify(existing.issuanceEvidence) !== JSON.stringify(governedRecord.issuanceEvidence)) {
        throw immutableArtifactConflict("SERVICE_ORDER_ISSUANCE_EVIDENCE", existing.issuanceEvidence.issuanceEvidenceId ?? id, existing.issuanceEvidence.evidenceHash, governedRecord?.issuanceEvidence?.evidenceHash);
      }
    }
    if (existing?.customerSignatureEvidence) {
      if (!governedRecord?.customerSignatureEvidence || JSON.stringify(existing.customerSignatureEvidence) !== JSON.stringify(governedRecord.customerSignatureEvidence)) {
        throw immutableArtifactConflict("CUSTOMER_SIGNATURE_EVIDENCE", existing.customerSignatureEvidence.customerSignatureEvidenceId ?? id, existing.customerSignatureEvidence.evidenceHash, governedRecord?.customerSignatureEvidence?.evidenceHash);
      }
    }
    if (existing?.teralinxCountersignatureEvidence) {
      if (!governedRecord?.teralinxCountersignatureEvidence || JSON.stringify(existing.teralinxCountersignatureEvidence) !== JSON.stringify(governedRecord.teralinxCountersignatureEvidence)) {
        throw immutableArtifactConflict("TERALINX_COUNTERSIGNATURE_EVIDENCE", existing.teralinxCountersignatureEvidence.countersignatureEvidenceId ?? id, existing.teralinxCountersignatureEvidence.evidenceHash, governedRecord?.teralinxCountersignatureEvidence?.evidenceHash);
      }
    }
    if (existing?.executionAuthorizationCertificate) {
      if (!governedRecord?.executionAuthorizationCertificate || JSON.stringify(existing.executionAuthorizationCertificate) !== JSON.stringify(governedRecord.executionAuthorizationCertificate)) {
        throw immutableArtifactConflict("EXECUTION_AUTHORIZATION_CERTIFICATE", existing.executionAuthorizationCertificate.executionAuthorizationCertificateId ?? id, existing.executionAuthorizationCertificate.certificateHash, governedRecord?.executionAuthorizationCertificate?.certificateHash);
      }
    }
  }
  if (path.resolve(dir) === path.resolve(DIRS.customerPortalInvitations)) {
    const existing = await loadRecord(dir, id, { projectRepositoryAuthority: false }).catch(() => null);
    if (existing?.reissueEvidence && (!governedRecord?.reissueEvidence || JSON.stringify(existing.reissueEvidence) !== JSON.stringify(governedRecord.reissueEvidence))) {
      throw immutableArtifactConflict("CUSTOMER_ENROLLMENT_REISSUE_EVIDENCE", existing.reissueEvidence.reissueEvidenceId ?? id, existing.reissueEvidence.evidenceHash, governedRecord?.reissueEvidence?.evidenceHash);
    }
  }
  if (path.resolve(dir) === path.resolve(DIRS.customerRequestSubmissions)) {
    const existing = await loadRecord(dir, id, { projectRepositoryAuthority: false }).catch(() => null);
    if (existing && JSON.stringify(existing) !== JSON.stringify(governedRecord)) {
      throw immutableArtifactConflict("CUSTOMER_REQUEST_SUBMISSION_EVIDENCE", id, existing.canonicalHash, governedRecord?.canonicalHash);
    }
  }
  if (path.resolve(dir) === path.resolve(DIRS.scopeVersions)) {
    const existing = await loadRecord(dir, id, { projectRepositoryAuthority: false }).catch(() => null);
    if (existing?.schemaVersion === "CIP-109-GENESIS-SCOPEVERSION-V1" && JSON.stringify(existing) !== JSON.stringify(governedRecord)) {
      throw immutableArtifactConflict("GENESIS_SCOPEVERSION", id, existing.scopeVersionHash, governedRecord?.scopeVersionHash);
    }
    if (existing?.schemaVersion === "CIP-109-GENESIS-SCOPEVERSION-V1" && JSON.stringify(existing) === JSON.stringify(governedRecord)) return existing;
  }
  if (path.resolve(dir) === path.resolve(DIRS.inventoryAuthorizations)) {
    const existing = await loadRecord(dir, id, { projectRepositoryAuthority: false }).catch(() => null);
    if (existing && JSON.stringify(existing) !== JSON.stringify(governedRecord)) {
      throw immutableArtifactConflict("INVENTORY_AUTHORIZATION", id, existing.authorizationHash, governedRecord?.authorizationHash);
    }
    if (existing) return existing;
  }
  const identityHashFields = GOVERNED_IDENTITY_HASH_FIELDS.get(path.resolve(dir)) ?? [];
  if (identityHashFields.length) {
    const existing = await loadRecord(dir, id).catch(() => null);
    if (existing) {
      const existingHash = sharedFirstText(...identityHashFields.map((field) => existing[field]));
      const incomingHash = sharedFirstText(...identityHashFields.map((field) => governedRecord?.[field]));
      if (existingHash && incomingHash && existingHash !== incomingHash) {
        throw immutableArtifactConflict(sharedFirstText(existing.repositoryType, governedRecord?.repositoryType, path.basename(dir).toUpperCase()), id, existingHash, incomingHash);
      }
      if (existingHash && !incomingHash) {
        throw artifactIntegrityError(`${path.basename(dir)} ${id} update omitted immutable identity hash`);
      }
    }
  }
  const immutableArtifactDirs = new Set(IOF_PROJECTION_ARTIFACT_SPECS.map((spec) => path.resolve(DIRS[spec.dirKey])));
  if (immutableArtifactDirs.has(path.resolve(dir))) {
    const existing = await loadRecord(dir, id).catch(() => null);
    if (existing) {
      const existingHash = sharedFirstText(existing.hash) || artifactHash(sharedRecord(existing.payload));
      const incomingHash = sharedFirstText(governedRecord?.hash) || artifactHash(sharedRecord(governedRecord?.payload));
      if (existingHash !== incomingHash && immutableArtifactRecoveryAuthority.getStore() !== true) {
        throw immutableArtifactConflict(sharedFirstText(existing.repositoryType, governedRecord?.repositoryType, "GOVERNED_ARTIFACT"), id, existingHash, incomingHash);
      }
      if (existingHash === incomingHash) return existing;
    }
  }
  if (authority.authorityClass !== "DEMO" && postgresReadsEnabled()) return mirrorRecord(dir, id, governedRecord);
  const scopedDir = resolveRepositoryDir(dir);
  await ensureDir(scopedDir);
  const destination = recordPath(dir, id);
  const temporary = `${destination}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`;
  const handle = await open(temporary, "wx");
  try {
    await handle.writeFile(JSON.stringify(governedRecord, null, 2), "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await rename(temporary, destination);
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
  if (authority.authorityClass !== "DEMO" && postgresShadowEnabled()) await mirrorRecordBestEffort(dir, id, governedRecord);
  return governedRecord;
}

export async function resetDemoRepositories() {
  const authority = currentRepositoryAuthority();
  if (authority.authorityClass !== "DEMO" || authority.organizationId !== DEMO_ORGANIZATION_ID) {
    const error = new Error("DEMO_RESET_AUTHORITY_REQUIRED");
    error.status = 403;
    throw error;
  }
  assertRepositoryRoots();
  await ensureDir(DEMO_ARCHIVE_ROOT);
  await ensureDir(DEMO_SEED_ROOT);
  const archive = path.join(DEMO_ARCHIVE_ROOT, `data-demo-${new Date().toISOString().replace(/[:.]/g, "-")}`);
  let archived = false;
  try {
    await rename(DEMO_DATA_ROOT, archive);
    archived = true;
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  try {
    await cp(DEMO_SEED_ROOT, DEMO_DATA_ROOT, { recursive: true, force: false, errorOnExist: true });
  } catch (error) {
    await rm(DEMO_DATA_ROOT, { recursive: true, force: true }).catch(() => undefined);
    if (archived) await rename(archive, DEMO_DATA_ROOT).catch(() => undefined);
    throw error;
  }
  return { dataRoot: DEMO_DATA_ROOT, archivedAt: archived ? archive : null, resetAt: nowIso() };
}

export async function updateTransactionManifest(args) {
  const transactionId = String(args.transactionId || createId("transaction"));
  const existing = await loadRecord(DIRS.transactionManifests, transactionId).catch(() => null);
  const timestamp = nowIso();
  const completedWrites = [...new Set([...(existing?.completedWrites ?? []), ...(args.completedWrites ?? [])])];
  const plannedWrites = [...new Set([...(existing?.plannedWrites ?? []), ...(args.plannedWrites ?? [])])];
  const artifactIds = [...new Set([...(existing?.artifactIds ?? []), ...(args.artifactIds ?? [])])];
  const revisionIds = [...new Set([...(existing?.revisionIds ?? []), ...(args.revisionIds ?? [])])];
  const hashes = [...new Set([...(existing?.hashes ?? []), ...(args.hashes ?? [])])];
  const manifest = {
    transactionId,
    operationType: args.operationType ?? existing?.operationType ?? "REPOSITORY_OPERATION",
    tenantId: args.tenantId ?? existing?.tenantId ?? "LOCAL_DEVELOPMENT",
    customerId: args.customerId ?? existing?.customerId ?? "",
    opportunityId: args.opportunityId ?? existing?.opportunityId ?? "",
    startedAt: existing?.startedAt ?? timestamp,
    completedAt: args.state === "COMMITTED" || args.state === "FAILED" || args.state === "RECOVERY_REQUIRED" ? timestamp : existing?.completedAt,
    state: args.state ?? existing?.state ?? "STARTED",
    plannedWrites,
    completedWrites,
    artifactIds,
    revisionIds,
    hashes,
    failureReason: args.failureReason ?? existing?.failureReason ?? "",
    localDevelopmentOnly: true,
    updatedAt: timestamp,
  };
  await persistRecord(DIRS.transactionManifests, transactionId, manifest);
  return manifest;
}

export async function deleteRecord(dir, id) {
  const authority = currentRepositoryAuthority();
  if (path.resolve(dir) === path.resolve(DIRS.scopeVersions)) {
    const existing = await loadRecord(dir, id, { projectRepositoryAuthority: false }).catch(() => null);
    if (existing?.schemaVersion === "CIP-109-GENESIS-SCOPEVERSION-V1") {
      throw immutableArtifactConflict("GENESIS_SCOPEVERSION", id, existing.scopeVersionHash, "DELETE_PROHIBITED");
    }
  }
  if (authority.authorityClass !== "DEMO" && postgresReadsEnabled()) {
    const error = new Error("POSTGRES_DELETE_REQUIRES_GOVERNED_COMMAND");
    error.code = "POSTGRES_DELETE_REQUIRES_GOVERNED_COMMAND";
    error.status = 409;
    throw error;
  }
  await rm(recordPath(dir, id), { force: true });
}

export function sortedByUpdated(records) {
  return [...records].sort((a, b) => String(b.updatedAt ?? b.createdAt ?? b.timestamp ?? "").localeCompare(String(a.updatedAt ?? a.createdAt ?? a.timestamp ?? "")));
}

export function unwrapBody(body, singularKey, pluralKeys = []) {
  if (body?.[singularKey]) return body[singularKey];
  for (const key of pluralKeys) {
    if (body?.[key]) return body[key];
  }
  return body;
}

export function routeMatch(pathname, basePath) {
  if (pathname === basePath || pathname === `${basePath}/`) return { base: true, id: "" };
  if (!pathname.startsWith(`${basePath}/`)) return null;
  const rest = pathname.slice(basePath.length + 1);
  const [encodedId, action] = rest.split("/");
  return { base: false, id: decodeURIComponent(encodedId ?? ""), action };
}

export async function handleJsonCollection(req, res, pathname, options) {
  const match = routeMatch(pathname, options.basePath);
  if (!match) return false;
  if (handleOptions(req, res)) return true;

  const {
    dir,
    idKey,
    listKey,
    itemKey,
    singularBodyKey = itemKey,
    pluralBodyKeys = [listKey, "items", "data"],
    idPrefix = itemKey ?? "record",
    normalize = (record) => record,
    beforeWrite = async () => undefined,
    singleCreateResponse = "wrapped",
  } = options;

  if (match.base && req.method === "GET") {
    jsonResponse(res, 200, { [listKey]: sortedByUpdated(await Promise.all((await listRecords(dir)).map((record) => normalize(record, { operation: "read", user: req.authUser ?? null })))) });
    return true;
  }

  if (!match.base && req.method === "GET") {
    try {
      jsonResponse(res, 200, { [itemKey]: await normalize(await loadRecord(dir, match.id), { operation: "read", user: req.authUser ?? null }) });
    } catch {
      errorResponse(res, 404, `${itemKey} not found: ${match.id}`);
    }
    return true;
  }

  if ((match.base || match.id === "bulk" || match.action === "bulk") && req.method === "POST") {
    const body = await readRequestJson(req);
    const input = unwrapBody(body, singularBodyKey, pluralBodyKeys);
    const records = Array.isArray(input) ? input : [input];
    const saved = [];
    for (const record of records) {
      await beforeWrite(record, { operation: "write", user: req.authUser ?? null });
      const normalized = await normalize({
        ...record,
        [idKey]: record?.[idKey] ?? createId(idPrefix),
      }, { operation: "write", user: req.authUser ?? null });
      saved.push(await persistRecord(dir, normalized[idKey], normalized));
    }
    if (Array.isArray(input) || match.action === "bulk") {
      jsonResponse(res, 201, { [listKey]: saved, items: saved });
    } else if (singleCreateResponse === "plain") {
      jsonResponse(res, 201, saved[0]);
    } else {
      jsonResponse(res, 201, { [itemKey]: saved[0] });
    }
    return true;
  }

  if (!match.base && req.method === "PUT") {
    const body = await readRequestJson(req);
    const input = unwrapBody(body, singularBodyKey);
    await beforeWrite(input, { operation: "write", user: req.authUser ?? null });
    const normalized = await normalize({ ...input, [idKey]: input?.[idKey] ?? match.id, updatedAt: nowIso() }, { operation: "write", user: req.authUser ?? null });
    jsonResponse(res, 200, { [itemKey]: await persistRecord(dir, normalized[idKey], normalized) });
    return true;
  }

  return false;
}
