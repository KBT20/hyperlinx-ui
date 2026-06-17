import http from "node:http";
import { DATA_ROOT, DIRS, PORT, errorResponse, jsonResponse } from "./routes/_shared.js";
import { handleCandidateSites } from "./routes/candidate-sites.js";
import { handleCertifiedRoutes } from "./routes/certified-routes.js";
import { handleCloseEvents } from "./routes/close-events.js";
import { handleGeocode } from "./routes/geocode.js";
import { handleInventoryGraphs } from "./routes/inventory-graphs.js";
import { handleIofPackages } from "./routes/iof-packages.js";
import { handleMarketplaceQuotes } from "./routes/marketplace-quotes.js";
import { handleOpportunitySeeds } from "./routes/opportunity-seeds.js";
import { handleScopeVersions } from "./routes/scopeversions.js";

const routes = [
  handleGeocode,
  handleCertifiedRoutes,
  handleScopeVersions,
  handleCandidateSites,
  handleOpportunitySeeds,
  handleInventoryGraphs,
  handleMarketplaceQuotes,
  handleIofPackages,
  handleCloseEvents,
];

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    for (const route of routes) {
      if (await route(req, res, url.pathname)) return;
    }
    if (url.pathname === "/health") {
      jsonResponse(res, 200, {
        ok: true,
        service: "hyperlinx-dal-dev",
        dataRoot: DATA_ROOT,
        routes: {
          scopeVersions: true,
          candidateSites: true,
          opportunitySeeds: true,
          inventoryGraphs: true,
          marketplaceQuotes: true,
          iofPackages: true,
          closeEvents: true,
          certifiedRoutes: true,
          geocode: true,
        },
      });
      return;
    }
    errorResponse(res, 404, "Not found");
  } catch (err) {
    errorResponse(res, 500, err instanceof Error ? err.message : String(err));
  }
});

server.listen(PORT, () => {
  console.log("HYPERLINX DAL SERVER READY", {
    port: PORT,
    dataRoot: DATA_ROOT,
    ...DIRS,
  });
});
