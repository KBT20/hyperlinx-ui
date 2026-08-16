import http from "node:http";
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
import { handleProposalDrafts } from "./routes/proposal-drafts.js";
import { handleProductFulfillment } from "./routes/product-fulfillment.js";
import { handleRuntime } from "./routes/runtime.js";
import { handleRuntimeFoundation } from "./routes/runtime-foundation.js";
import { handleRuntimeLifecycleBridge } from "./routes/runtime-lifecycle-bridge.js";
import { handleRuntimeWorkspaceSession } from "./routes/runtime-workspace-session.js";
import { handleScopeVersions } from "./routes/scopeversions.js";
import { handleServiceOrders } from "./routes/service-orders.js";
import { handleTwinState } from "./routes/twin-state.js";
import { enforceLifecycleSeparationOfDuties } from "./routes/duty-authority.js";
import { handleDemo } from "./routes/demo.js";

export const REGISTERED_API_ROUTES = [
  { basePath: "/api/auth", handler: "handleAuth" },
  { basePath: "/api/demo", handler: "handleDemo" },
  { basePath: "/api/runtime", handler: "handleRuntime" },
  { basePath: "/api/accounts", handler: "handleAccounts" },
  { basePath: "/api/accounts/contacts", handler: "handleAccounts" },
  { basePath: "/api/activity", handler: "handleActivity" },
  { basePath: "/api/geocode", handler: "handleGeocode" },
  { basePath: "/api/certified-routes", handler: "handleCertifiedRoutes" },
  { basePath: "/api/scopeversions", handler: "handleScopeVersions" },
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
  handleRuntime,
  handleAccounts,
  handleActivity,
  handleGeocode,
  handleCertifiedRoutes,
  handleScopeVersions,
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
const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
};

function isInsideStaticRoot(resolvedPath) {
  const relative = path.relative(STATIC_ROOT, resolvedPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function serveStaticApp(req, res, pathname) {
  if (req.method !== "GET" && req.method !== "HEAD") return false;
  if (pathname === "/api" || pathname.startsWith("/api/") || pathname === "/health") return false;
  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const resolvedPath = path.resolve(STATIC_ROOT, `.${decodeURIComponent(requestedPath)}`);
  if (!isInsideStaticRoot(resolvedPath)) return false;
  const hasFileExtension = Boolean(path.extname(requestedPath));
  const candidates = hasFileExtension ? [resolvedPath] : [resolvedPath, path.join(STATIC_ROOT, "index.html")];
  for (const candidate of candidates) {
    try {
      const body = await readFile(candidate);
      res.writeHead(200, {
        "Content-Type": CONTENT_TYPES[path.extname(candidate)] ?? "application/octet-stream",
      });
      if (req.method !== "HEAD") res.end(body);
      else res.end();
      return true;
    } catch {
      // Try the next static fallback.
    }
  }
  return false;
}

const server = http.createServer(async (req, res) => {
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
    errorResponse(res, 500, err instanceof Error ? err.message : String(err));
  }
});

await initializeAuthenticationAuthority();

server.listen(PORT, () => {
  const address = server.address();
  const activePort = typeof address === "object" && address ? address.port : PORT;
  console.log("TERALINX RUNTIME READY", {
    port: activePort,
    dataRoot: DATA_ROOT,
    ...DIRS,
  });
});
