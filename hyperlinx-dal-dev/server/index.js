import { createStaticHandler } from './static-output-policy.js';
import http from "node:http";
import { admission, startControl } from './operations/admission-drain.js';
import { readFile } from "node:fs/promises";
import path from "node:path";
import { DATA_ROOT, DIRS, PORT, PROJECT_ROOT, errorResponse, handleOptions, jsonResponse, withRepositoryAuthority } from "./routes/_shared.js";
import { handleAccounts } from "./routes/accounts.js";
import { handleActivity } from "./routes/activity.js";
import {
  authenticateRuntimeRequest,
  enforceAuthenticationBoundary,
  handleAuth,
  initializeAuthenticationAuthority,
} from "./routes/auth.js";
import { handleCandidateSites } from "./routes/candidate-sites.js";
import { handleCertificationLedger } from "./routes/certification-ledger.js";
import { handleCertifiedRoutes } from "./routes/certified-routes.js";
import { handleCloseEvents } from "./routes/close-events.js";
import { handleCommercialIofPackages } from "./routes/commercial-iof-packages.js";
import { handleCommercialOpportunities } from "./routes/commercial-opportunities.js";
import { handleCommercialChangeSets } from "./routes/commercial-change-sets.js";
import { handleCommercialRevisionAuthority } from "./routes/commercial-revisions.js";
import { COMMERCIAL_ROUTE_REPOSITORY_AUTHORITY, handleCommercialRoutes } from "./routes/commercial-routes.js";
import { handleControlWorkItems } from "./routes/control-work-items.js";
import { handleCustomerDesignImports } from "./routes/customer-design-imports.js";
import { handleCustomerExports } from "./routes/customer-exports.js";
import { handleEngineeringBaselines } from "./routes/engineering-baselines.js";
import { handleEngineeringChangeSets } from "./routes/engineering-change-sets.js";
import { handleEngineeringDrafts } from "./routes/engineering-drafts.js";
import { handleEngineeringPackages } from "./routes/engineering-packages.js";
import { handleEngineeringApprovals } from "./routes/engineering-approvals.js";
import { handleEngineeringCertification } from "./routes/engineering-certification.js";
import { handleFieldClosures } from "./routes/field-closures.js";
import { handleGeocode } from "./routes/geocode.js";
import { handleInventoryGraphs } from "./routes/inventory-graphs.js";
import { handleIofPackages } from "./routes/iof-packages.js";
import { handleMarketplaceQuotes } from "./routes/marketplace-quotes.js";
import { handleMarketplaceFulfillment } from "./routes/marketplace-fulfillment.js";
import { handleOpportunitySeeds } from "./routes/opportunity-seeds.js";
import { handleOperationalBaselines } from "./routes/operational-baselines.js";
import { handleProposalDrafts } from "./routes/proposal-drafts.js";
import { handleProductFulfillment } from "./routes/product-fulfillment.js";
import { handleProductDoctrineAuthority } from "./routes/product-doctrine-authority.js";
import { handleRuntime } from "./routes/runtime.js";
import { handleRuntimeFoundation } from "./routes/runtime-foundation.js";
import { handleRuntimeLifecycleBridge } from "./routes/runtime-lifecycle-bridge.js";
import { handleRuntimeWorkspaceSession } from "./routes/runtime-workspace-session.js";
import { handleScopeVersions } from "./routes/scopeversions.js";
import { handleServiceOrders } from "./routes/service-orders.js";
import { handleTwinState } from "./routes/twin-state.js";
import { enforceLifecycleSeparationOfDuties } from "./routes/duty-authority.js";
import { handleDemo } from "./routes/demo.js";
import { handleCustomerPortal } from "./routes/customer-portal.js";
import { handleCustomerPlanning } from "./routes/customer-planning.js";
import { handleCustomerIdentityAuthority } from "./routes/customer-identity-authority.js";
import { handleCustomerEnrollmentReissue } from "./routes/customer-enrollment-reissue-authority.js";
import { handleCustomerInfrastructureRequests } from "./routes/customer-infrastructure-requests.js";
import { handleContentRegistry } from "./routes/content-registry.js";
import { handleContentIngestion } from "./routes/content-ingestion.js";
import { handleCustomerSites } from "./routes/customer-sites.js";
import { handleContentLayers } from "./routes/content-layers.js";
import { handleSiteNetworkAnalysis } from "./routes/site-network-analysis.js";
import { handleFluidstackWorkingPlanner } from "./routes/fluidstack-working-planner.js";
import { handleNetworkPlanner } from "./routes/network-planner.js";
import { handleNetworkUniverse } from "./routes/network-universe.js";
import { handlePlannerVnext } from "./routes/planner-vnext.js";

export const REGISTERED_API_ROUTES = [
  { basePath: "/api/auth", handler: "handleAuth" },
  { basePath: "/api/demo", handler: "handleDemo" },
  { basePath: "/api/customer-portal", handler: "handleCustomerPortal" },
  { basePath: "/api/customer-planning", handler: "handleCustomerPlanning", canonical: true, authority: "TENANT_SCOPED_CUSTOMER_PLANNING_AND_COLLABORATION" },
  { basePath: "/api/customer-identity", handler: "handleCustomerIdentityAuthority", canonical: true },
  { basePath: "/api/customer-access", handler: "handleCustomerEnrollmentReissue", canonical: true, authority: "CUSTOMER_SIGNER_ENROLLMENT_ADMIN" },
  { basePath: "/api/customer-requests", handler: "handleCustomerInfrastructureRequests", canonical: true, authority: "CUSTOMER_INTENT" },
  { basePath: "/api/content-registry", handler: "handleContentRegistry", canonical: true, authority: "BOUNDED_CONTENT_READ" },
  { basePath: "/api/content-ingestion", handler: "handleContentIngestion", canonical: true, authority: "INTERNAL_CONTENT_DATA_STEWARD" },
  { basePath: "/api/customer-sites", handler: "handleCustomerSites", canonical: true, authority: "CUSTOMER_SITE_PLANNING" },
  { basePath: "/api/content-layers", handler: "handleContentLayers", canonical: true, authority: "AUTHORIZED_VIEWPORT_CONTENT_READ" },
  { basePath: "/api/site-network-analysis", handler: "handleSiteNetworkAnalysis", canonical: true, authority: "EPHEMERAL_DETERMINISTIC_PLANNING_ANALYSIS" },
  { basePath: "/api/network-planning/fluidstack", handler: "handleFluidstackWorkingPlanner", canonical: true, authority: "NON_GOVERNED_INTERNAL_EXACT_WORKING_ANALYSIS" },
  { basePath: "/api/network-planning/planner", handler: "handleNetworkPlanner", canonical: true, authority: "OPPORTUNITY_BOUND_PLANNER_ARTIFACT_HANDOFF" },
  { basePath: "/api/network-planning/universe", handler: "handleNetworkUniverse", canonical: true, authority: "GOVERNED_NETWORK_UNIVERSE_RIGHTS_AND_REVISION_AUTHORITY" },
  { basePath: "/api/network-planning/vnext", handler: "handlePlannerVnext", canonical: true, authority: "PRE_GOVERNED_PLANNER_SOLUTION_SYNTHESIS" },
  { basePath: "/api/runtime", handler: "handleRuntime" },
  { basePath: "/api/accounts", handler: "handleAccounts" },
  { basePath: "/api/accounts/contacts", handler: "handleAccounts" },
  { basePath: "/api/activity", handler: "handleActivity" },
  { basePath: "/api/geocode", handler: "handleGeocode" },
  { basePath: "/api/certified-routes", handler: "handleCertifiedRoutes" },
  { basePath: "/api/scopeversions", handler: "handleScopeVersions" },
  { basePath: "/api/operational-baselines", handler: "handleOperationalBaselines", canonical: true, authority: "SCOPEVERSION_ORDER_FOR_EXECUTION" },
  { basePath: "/api/customer-design-imports", handler: "handleCustomerDesignImports" },
  { basePath: "/api/exports", handler: "handleCustomerExports" },
  { basePath: "/api/commercial/opportunities", handler: "handleCommercialOpportunities" },
  {
    basePath: COMMERCIAL_ROUTE_REPOSITORY_AUTHORITY.endpoint,
    handler: "handleCommercialRoutes",
    canonical: true,
    authority: COMMERCIAL_ROUTE_REPOSITORY_AUTHORITY,
  },
  { basePath: "/api/commercial/revisions", handler: "handleCommercialRevisionAuthority" },
  { basePath: "/api/commercial/change-sets", handler: "handleCommercialChangeSets" },
  { basePath: "/api/commercial/release-packages", handler: "handleCommercialRevisionAuthority" },
  { basePath: "/api/commercial/iof-packages", handler: "handleCommercialIofPackages" },
  { basePath: "/api/engineering/drafts", handler: "handleEngineeringDrafts" },
  { basePath: "/api/engineering/baselines", handler: "handleEngineeringBaselines" },
  { basePath: "/api/engineering/change-sets", handler: "handleEngineeringChangeSets" },
  { basePath: "/api/engineering/packages", handler: "handleEngineeringPackages" },
  { basePath: "/api/engineering/approvals", handler: "handleEngineeringApprovals" },
  { basePath: "/api/engineering/certification-ledger", handler: "handleCertificationLedger" },
  { basePath: "/api/engineering/certification", handler: "handleEngineeringCertification" },
  { basePath: "/api/proposals", handler: "handleProposalDrafts" },
  { basePath: "/api/service-orders", handler: "handleServiceOrders" },
  { basePath: "/api/products", handler: "handleProductFulfillment" },
  { basePath: "/api/product-authority", handler: "handleProductDoctrineAuthority", canonical: true, authority: "PRODUCT_DOCTRINE_DRAFT_ONLY" },
  { basePath: "/api/fulfillment/plans", handler: "handleProductFulfillment" },
  { basePath: "/api/runtime/lifecycle", handler: "handleRuntimeLifecycleBridge" },
  { basePath: "/api/runtime/workspace-session", handler: "handleRuntimeWorkspaceSession" },
  { basePath: "/api/runtime/rehydrate", handler: "handleRuntimeFoundation" },
  { basePath: "/api/evidence", handler: "handleRuntimeFoundation" },
  { basePath: "/api/runtime/evidence", handler: "handleRuntimeFoundation" },
  { basePath: "/api/inventory", handler: "handleRuntimeFoundation" },
  { basePath: "/api/runtime/inventories", handler: "handleRuntimeFoundation" },
  { basePath: "/api/runtime/objects", handler: "handleRuntimeFoundation" },
  { basePath: "/api/runtime/relationships", handler: "handleRuntimeFoundation" },
  { basePath: "/api/runtime/validation", handler: "handleRuntimeFoundation" },
  { basePath: "/api/runtime/history", handler: "handleRuntimeFoundation" },
  { basePath: "/api/connectors", handler: "handleRuntimeFoundation" },
  { basePath: "/api/runtime/connectors", handler: "handleRuntimeFoundation" },
  { basePath: "/api/runtime/search", handler: "handleRuntimeFoundation" },
  { basePath: "/api/runtime/workspaces", handler: "handleRuntimeFoundation" },
  { basePath: "/api/runtime/commit", handler: "handleRuntimeFoundation" },
  { basePath: "/api/runtime/commits", handler: "handleRuntimeFoundation" },
  { basePath: "/api/candidate-sites", handler: "handleCandidateSites" },
  { basePath: "/api/opportunity-seeds", handler: "handleOpportunitySeeds" },
  { basePath: "/api/inventory-graphs", handler: "handleInventoryGraphs" },
  { basePath: "/api/baseline-graphs", handler: "handleInventoryGraphs" },
  { basePath: "/api/marketplace/quotes", handler: "handleMarketplaceQuotes" },
  { basePath: "/api/marketplace/fulfillment", handler: "handleMarketplaceFulfillment" },
  { basePath: "/api/iof-packages", handler: "handleIofPackages" },
  { basePath: "/api/close-events", handler: "handleCloseEvents" },
  { basePath: "/api/control/work-items", handler: "handleControlWorkItems" },
  { basePath: "/api/field/closures", handler: "handleFieldClosures" },
  { basePath: "/api/twin/state", handler: "handleTwinState" },
];

function registeredApiRouteMap() {
  return Object.fromEntries(REGISTERED_API_ROUTES.map((route) => [route.basePath, true]));
}

const routes = [
  handleAuth,
  handleDemo,
  handleCustomerPortal,
  handleCustomerPlanning,
  handleCustomerIdentityAuthority,
  handleCustomerEnrollmentReissue,
  handleCustomerInfrastructureRequests,
  handleContentRegistry,
  handleContentIngestion,
  handleCustomerSites,
  handleContentLayers,
  handleSiteNetworkAnalysis,
  handleFluidstackWorkingPlanner,
  handleNetworkPlanner,
  handleNetworkUniverse,
  handlePlannerVnext,
  handleRuntime,
  handleAccounts,
  handleActivity,
  handleGeocode,
  handleCertifiedRoutes,
  handleScopeVersions,
  handleOperationalBaselines,
  handleCustomerDesignImports,
  handleCustomerExports,
  handleCommercialOpportunities,
  handleCommercialRoutes,
  handleCommercialRevisionAuthority,
  handleCommercialChangeSets,
  handleCommercialIofPackages,
  handleEngineeringDrafts,
  handleEngineeringBaselines,
  handleEngineeringChangeSets,
  handleEngineeringPackages,
  handleEngineeringApprovals,
  handleCertificationLedger,
  handleEngineeringCertification,
  handleProposalDrafts,
  handleServiceOrders,
  handleProductFulfillment,
  handleProductDoctrineAuthority,
  handleRuntimeLifecycleBridge,
  handleRuntimeWorkspaceSession,
  handleRuntimeFoundation,
  handleCandidateSites,
  handleOpportunitySeeds,
  handleInventoryGraphs,
  handleMarketplaceQuotes,
  handleMarketplaceFulfillment,
  handleIofPackages,
  handleCloseEvents,
  handleControlWorkItems,
  handleFieldClosures,
  handleTwinState,
];

const STATIC_ROOT = process.env.DAL_STATIC_ROOT
  ? path.resolve(process.env.DAL_STATIC_ROOT)
  : path.join(PROJECT_ROOT, "dist-dal");
const serveStaticApp = createStaticHandler(STATIC_ROOT);

import { pollPlanningRequests } from "./network-planning/planning-request-runtime.js";

const server = http.createServer((req, res) => { void admission.request(req, res, async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `https://${req.headers.host ?? "runtime.invalid"}`);
    if (handleOptions(req, res)) return;
    await authenticateRuntimeRequest(req);
    if (enforceAuthenticationBoundary(req, res, url.pathname)) return;
    const routed = await withRepositoryAuthority(req.authUser, async () => {
      if (enforceLifecycleSeparationOfDuties(req, res, url.pathname)) return true;
      for (const route of routes) {
        if (await route(req, res, url.pathname)) return true;
      }
      return false;
    });
    if (routed) return;
    if (url.pathname === "/api/routes" && req.method === "GET") {
      jsonResponse(res, 200, {
        startupModel: "node:http createServer route handler array",
        expressAppUse: [],
        registeredApiRoutes: REGISTERED_API_ROUTES,
        registeredApiRouteCount: REGISTERED_API_ROUTES.length,
        commercialRouteRepository: {
          endpointSelected: COMMERCIAL_ROUTE_REPOSITORY_AUTHORITY.endpoint,
          endpointRegistered: REGISTERED_API_ROUTES.some((route) => route.basePath === COMMERCIAL_ROUTE_REPOSITORY_AUTHORITY.endpoint),
          repositoryIdentifier: COMMERCIAL_ROUTE_REPOSITORY_AUTHORITY.repositoryIdentifier,
          authoritySource: COMMERCIAL_ROUTE_REPOSITORY_AUTHORITY.authoritySource,
          canonical: COMMERCIAL_ROUTE_REPOSITORY_AUTHORITY.canonical,
        },
      });
      return;
    }
    if (url.pathname === "/health") {
      jsonResponse(res, 200, {
        ok: true,
        service: "hyperlinx-dal-dev",
        dataRoot: DATA_ROOT,
        startupModel: "node:http createServer route handler array",
        expressAppUse: [],
        registeredApiRoutes: registeredApiRouteMap(),
        registeredApiRouteCount: REGISTERED_API_ROUTES.length,
        commercialRouteRepository: {
          endpointSelected: COMMERCIAL_ROUTE_REPOSITORY_AUTHORITY.endpoint,
          endpointRegistered: REGISTERED_API_ROUTES.some((route) => route.basePath === COMMERCIAL_ROUTE_REPOSITORY_AUTHORITY.endpoint),
          repositoryIdentifier: COMMERCIAL_ROUTE_REPOSITORY_AUTHORITY.repositoryIdentifier,
          authoritySource: COMMERCIAL_ROUTE_REPOSITORY_AUTHORITY.authoritySource,
        },
        routes: {
          auth: true,
          runtime: true,
          evidence: true,
          runtimeInventories: true,
          runtimeObjects: true,
          runtimeRelationships: true,
          runtimeValidation: true,
          runtimeHistory: true,
          runtimeSearch: true,
          runtimeConnectors: true,
          runtimeLifecycleBridge: true,
          runtimeWorkspaceSession: true,
          runtimeRehydration: true,
          translationCommits: true,
          activity: true,
          accountLibrary: true,
          contactLibrary: true,
          customerDesignImports: true,
          contentRegistry: true,
          contentIngestion: true,
          customerSites: true,
          commercialOpportunities: true,
          commercialRoutes: true,
          commercialRevisions: true,
          commercialChangeSets: true,
          commercialReleasePackages: true,
          engineeringDrafts: true,
          engineeringBaselines: true,
          engineeringChangeSets: true,
          engineeringPackages: true,
          certificationLedger: true,
          engineeringCertification: true,
          proposalDrafts: true,
          serviceOrders: true,
          productLibrary: true,
          fulfillmentPlans: true,
          scopeVersions: true,
          operationalBaselines: true,
          candidateSites: true,
          opportunitySeeds: true,
          inventoryGraphs: true,
          marketplaceQuotes: true,
          iofPackages: true,
          closeEvents: true,
          certifiedRoutes: true,
          controlWorkItems: true,
          fieldClosures: true,
          twinState: true,
          geocode: true,
        },
      });
      return;
    }
    if (await serveStaticApp(req, res, url.pathname)) return;
    errorResponse(res, 404, "Not found");
  } catch (err) {
    const status = Number(err?.status);
    errorResponse(res, Number.isInteger(status) && status >= 400 && status <= 599 ? status : 500, err instanceof Error ? err.message : String(err));
  }
}).catch(() => { if (!res.destroyed) res.destroy(); }); });

await startControl();
await initializeAuthenticationAuthority();
admission.markReady();
// Signals close admission but never report an interrupted writer as drained.
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => { admission.close(); });
const planningRequestTimer = setInterval(() => { void pollPlanningRequests().catch(() => console.error("[planning-request] WORKER_FAILED")); }, 60000);
planningRequestTimer.unref();

server.listen(PORT, () => {
  const address = server.address();
  const activePort = typeof address === "object" && address ? address.port : PORT;
  console.log("TERALINX RUNTIME READY", {
    port: activePort,
    dataRoot: DATA_ROOT,
    ...DIRS,
  });
});
