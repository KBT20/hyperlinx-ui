import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { DATA_ROOT, DIRS, PORT, PROJECT_ROOT, errorResponse, handleOptions, jsonResponse } from "./routes/_shared.js";
import { handleAccounts } from "./routes/accounts.js";
import { handleActivity } from "./routes/activity.js";
import { handleAuth } from "./routes/auth.js";
import { handleCandidateSites } from "./routes/candidate-sites.js";
import { handleCertifiedRoutes } from "./routes/certified-routes.js";
import { handleCloseEvents } from "./routes/close-events.js";
import { handleCommercialOpportunities } from "./routes/commercial-opportunities.js";
import { handleControlWorkItems } from "./routes/control-work-items.js";
import { handleCustomerDesignImports } from "./routes/customer-design-imports.js";
import { handleEngineeringDrafts } from "./routes/engineering-drafts.js";
import { handleEngineeringCertification } from "./routes/engineering-certification.js";
import { handleFieldClosures } from "./routes/field-closures.js";
import { handleGeocode } from "./routes/geocode.js";
import { handleInventoryGraphs } from "./routes/inventory-graphs.js";
import { handleIofPackages } from "./routes/iof-packages.js";
import { handleMarketplaceQuotes } from "./routes/marketplace-quotes.js";
import { handleOpportunitySeeds } from "./routes/opportunity-seeds.js";
import { handleProposalDrafts } from "./routes/proposal-drafts.js";
import { handleProductFulfillment } from "./routes/product-fulfillment.js";
import { handleRuntime } from "./routes/runtime.js";
import { handleRuntimeFoundation } from "./routes/runtime-foundation.js";
import { handleRuntimeLifecycleBridge } from "./routes/runtime-lifecycle-bridge.js";
import { handleRuntimeWorkspaceSession } from "./routes/runtime-workspace-session.js";
import { handleScopeVersions } from "./routes/scopeversions.js";
import { handleTwinState } from "./routes/twin-state.js";

const routes = [
  handleAuth,
  handleRuntime,
  handleAccounts,
  handleActivity,
  handleGeocode,
  handleCertifiedRoutes,
  handleScopeVersions,
  handleCustomerDesignImports,
  handleCommercialOpportunities,
  handleEngineeringDrafts,
  handleEngineeringCertification,
  handleProposalDrafts,
  handleProductFulfillment,
  handleRuntimeLifecycleBridge,
  handleRuntimeWorkspaceSession,
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
    for (const route of routes) {
      if (await route(req, res, url.pathname)) return;
    }
    if (url.pathname === "/health") {
      jsonResponse(res, 200, {
        ok: true,
        service: "hyperlinx-dal-dev",
        dataRoot: DATA_ROOT,
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
          engineeringDrafts: true,
          engineeringCertification: true,
          proposalDrafts: true,
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

server.listen(PORT, () => {
  const address = server.address();
  const activePort = typeof address === "object" && address ? address.port : PORT;
  console.log("TERALINX RUNTIME READY", {
    port: activePort,
    dataRoot: DATA_ROOT,
    ...DIRS,
  });
});
