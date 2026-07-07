import { Readable } from "node:stream";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd().endsWith("hyperlinx-dal-dev")
  ? process.cwd()
  : path.join(process.cwd(), "hyperlinx-dal-dev");

const paths = {
  serverIndex: path.join(root, "server", "index.js"),
  serverRoutes: path.join(root, "server", "routes", "commercial-routes.js"),
  serverOpportunities: path.join(root, "server", "routes", "commercial-opportunities.js"),
  serverProposals: path.join(root, "server", "routes", "proposal-drafts.js"),
  clientApi: path.join(root, "src", "api", "teralinxRuntime.ts"),
  workspace: path.join(root, "src", "components", "workspaces", "GoogleRfpWorkspace.tsx"),
  report: path.join(root, "CIP_020_COMMERCIAL_ROUTE_REPOSITORY_ENDPOINT_AUTHORITY_REPORT.md"),
};

for (const requiredPath of Object.values(paths)) {
  if (!existsSync(requiredPath)) {
    console.error(`FAIL missing required file: ${path.relative(root, requiredPath)}`);
    process.exit(1);
  }
}

const serverIndex = readFileSync(paths.serverIndex, "utf8");
const serverRoutes = readFileSync(paths.serverRoutes, "utf8");
const clientApi = readFileSync(paths.clientApi, "utf8");
const workspace = readFileSync(paths.workspace, "utf8");
const report = readFileSync(paths.report, "utf8");
const checks = [];

function check(name, condition, detail = "") {
  checks.push({ name, condition: Boolean(condition), detail });
}

function includesAll(source, terms) {
  return terms.every((term) => source.includes(term));
}

function blockBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  if (start < 0) return "";
  const end = source.indexOf(endMarker, start + startMarker.length);
  return end < 0 ? source.slice(start) : source.slice(start, end);
}

function hashCommercialGeometry(geometry = []) {
  const source = geometry
    .filter((coordinate) => Array.isArray(coordinate) && Number.isFinite(coordinate[0]) && Number.isFinite(coordinate[1]))
    .map((coordinate) => `${Number(coordinate[0]).toFixed(7)},${Number(coordinate[1]).toFixed(7)}`)
    .join("|");
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `rg-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

const openBlock = blockBetween(workspace, "async function handleOpenCommercialOpportunity", "function handleOpportunityLibrarySelect");
const generateBlock = blockBetween(workspace, "async function handleGenerateCommercialRoute", "function handleRunAzBuilderScout");

check("canonical server endpoint remains /api/commercial/routes", includesAll(serverRoutes, [
  "COMMERCIAL_ROUTE_REPOSITORY_ENDPOINT = \"/api/commercial/routes\"",
  "COMMERCIAL_ROUTE_REPOSITORY_AUTHORITY",
  "repositoryIdentifier: \"COMMERCIAL_ROUTE_REPOSITORY\"",
]));
check("server startup registry includes Commercial Route Repository", includesAll(serverIndex, [
  "REGISTERED_API_ROUTES",
  "COMMERCIAL_ROUTE_REPOSITORY_AUTHORITY.endpoint",
  "handleCommercialRoutes",
  "commercialRoutes: true",
  "registeredApiRoutes: registeredApiRouteMap()",
]));
check("server exposes route registration diagnostics", includesAll(serverIndex, [
  "startupModel: \"node:http createServer route handler array\"",
  "expressAppUse: []",
  "registeredApiRouteCount",
  "commercialRouteRepository",
  "endpointRegistered",
]));
check("Commercial Route Repository responses include structured diagnostics", includesAll(serverRoutes, [
  "routeRepositoryDiagnostics",
  "endpointSelected",
  "endpointRegistered",
  "persistenceResult",
  "restoreResult",
  "authoritySource",
]));
check("client DAL uses the canonical endpoint constant", includesAll(clientApi, [
  "COMMERCIAL_ROUTE_REPOSITORY_ENDPOINT = \"/api/commercial/routes\"",
  "listCommercialRoutes",
  "loadCommercialRoute",
  "saveCommercialRoute",
  "logCommercialRouteRepositoryDiagnostics",
]));
check("restore path loads Route Repository without OSRM regeneration", includesAll(openBlock, [
  "RouteRepository.loadRoute(routeRepositoryId, session)",
  "hydrateOpportunityFromRouteRepository(record, routeSnapshot)",
  "RouteRepository.listRoutes(session)",
]) && !openBlock.includes("routeCommercialCorridorWithOsrm"));
check("route generation is the only OSRM route creation path", includesAll(generateBlock, [
  "routeCommercialCorridorWithOsrm(request)",
  "RouteRepository.saveRoute(routeSnapshotToSave, session)",
  "RouteRepository.loadRoute(savedRouteSnapshot.routeRepositoryId, session)",
]));
check("report documents endpoint authority and startup audit", includesAll(report, [
  "Canonical Endpoint",
  "/api/commercial/routes",
  "Registered API Routes",
  "No Express app.use",
  "Root Cause",
  "Validation Results",
]));

const token = Buffer.from(JSON.stringify({
  sub: "teralinx-user-kyle",
  username: "kyle",
  role: "ADMINISTRATOR_COO",
  iat: new Date().toISOString(),
})).toString("base64url");

function requestFor(method, body = undefined) {
  const chunks = body === undefined ? [] : [Buffer.from(JSON.stringify(body))];
  const req = Readable.from(chunks);
  req.method = method;
  req.headers = {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
    host: "cip020.local",
  };
  return req;
}

function responseCollector() {
  return {
    statusCode: 0,
    headers: {},
    body: "",
    writeHead(statusCode, headers = {}) {
      this.statusCode = statusCode;
      this.headers = headers;
    },
    end(body = "") {
      this.body += Buffer.isBuffer(body) ? body.toString("utf8") : String(body ?? "");
    },
  };
}

async function invoke(handler, method, pathname, body = undefined) {
  const req = requestFor(method, body);
  const res = responseCollector();
  const handled = await handler(req, res, pathname);
  let json = {};
  try {
    json = res.body ? JSON.parse(res.body) : {};
  } catch {
    json = { raw: res.body };
  }
  return { handled, statusCode: res.statusCode, body: json };
}

const { handleCommercialRoutes } = await import(pathToFileURL(path.join(root, "server", "routes", "commercial-routes.js")).href);
const { handleCommercialOpportunities } = await import(pathToFileURL(path.join(root, "server", "routes", "commercial-opportunities.js")).href);
const { handleProposalDrafts } = await import(pathToFileURL(path.join(root, "server", "routes", "proposal-drafts.js")).href);

const testId = `CIP020-${Date.now()}`;
const routeRepositoryId = `${testId}-ROUTE-REPOSITORY`;
const opportunityId = `${testId}-OPPORTUNITY`;
const proposalId = `${testId}-PROPOSAL`;
const geometry = [
  [-96.9978, 32.7459],
  [-96.9801, 32.7602],
  [-96.9489, 32.8140],
];
const geometryHash = hashCommercialGeometry(geometry);
const timestamp = new Date().toISOString();

const authority = await invoke(handleCommercialRoutes, "GET", "/api/commercial/routes/_authority");
check("dynamic authority endpoint confirms Commercial Route Repository", authority.statusCode === 200 &&
  authority.body?.authority?.endpoint === "/api/commercial/routes" &&
  authority.body?.routeRepositoryDiagnostics?.endpointRegistered === true,
  `status=${authority.statusCode}`);

const beforeList = await invoke(handleCommercialRoutes, "GET", "/api/commercial/routes");
const beforeCount = (beforeList.body?.commercialRoutes ?? []).filter((route) => route.routeRepositoryId === routeRepositoryId).length;
check("test Route Repository id does not already exist", beforeList.statusCode === 200 && beforeCount === 0, `count=${beforeCount}`);

const routeSave = await invoke(handleCommercialRoutes, "POST", "/api/commercial/routes", {
  commercialRoute: {
    routeRepositoryId,
    routeSnapshotId: routeRepositoryId,
    opportunityId,
    accountId: "google",
    customerId: "customer-google",
    productId: "POINT_TO_POINT_DUCT_DARK_FIBER",
    routeId: `${testId}-ROUTE`,
    routeName: "CIP-020 Endpoint Authority Route",
    commercialGeometry: geometry,
    convertedRuntimeGeometry: geometry,
    simplifiedGeometry: geometry,
    renderedGeometryCache: geometry,
    routeFeet: 25000,
    routeMiles: 25000 / 5280,
    aLocation: { label: "A", coordinate: geometry[0] },
    zLocation: { label: "Z", coordinate: geometry.at(-1) },
    routeSource: "COMMERCIAL_DRAFT",
    createdAt: timestamp,
    updatedAt: timestamp,
  },
});
const savedRoute = routeSave.body?.commercialRoute;
check("Route Repository record created through canonical endpoint", routeSave.statusCode === 201 &&
  savedRoute?.routeRepositoryId === routeRepositoryId &&
  savedRoute?.geometryHash === geometryHash &&
  routeSave.body?.routeRepositoryDiagnostics?.persistenceResult === "ROUTE_REPOSITORY_PERSISTED_ONCE",
  `status=${routeSave.statusCode}`);

const routeLoad = await invoke(handleCommercialRoutes, "GET", `/api/commercial/routes/${encodeURIComponent(routeRepositoryId)}`);
const loadedRoute = routeLoad.body?.commercialRoute;
check("Route Repository restore loads persisted geometry", routeLoad.statusCode === 200 &&
  loadedRoute?.routeRepositoryId === routeRepositoryId &&
  loadedRoute?.geometryHash === geometryHash &&
  Array.isArray(loadedRoute?.commercialGeometry) &&
  loadedRoute.commercialGeometry.length === geometry.length &&
  routeLoad.body?.routeRepositoryDiagnostics?.restoreResult === "ROUTE_REPOSITORY_LOADED",
  `status=${routeLoad.statusCode}`);

const opportunitySave = await invoke(handleCommercialOpportunities, "POST", "/api/commercial/opportunities", {
  opportunity: {
    opportunityId,
    accountId: "google",
    customerId: "customer-google",
    name: "CIP-020 Endpoint Authority Opportunity",
    status: "SAVED",
    commercialStatus: "DRAFT",
    routeRepositoryId,
    routeRepositoryRef: {
      routeRepositoryId,
      routeSnapshotId: routeRepositoryId,
      repositoryType: "COMMERCIAL_ROUTE_REPOSITORY",
    },
    routeGeometryOwnedBy: "COMMERCIAL_ROUTE_REPOSITORY",
    noEmbeddedRouteGeometry: true,
    noScopeVersionCreation: true,
    noInventoryMutation: true,
  },
});
check("Opportunity persists Route Repository reference", opportunitySave.statusCode === 201 &&
  opportunitySave.body?.opportunity?.opportunityId === opportunityId &&
  opportunitySave.body?.opportunity?.routeRepositoryId === routeRepositoryId,
  `status=${opportunitySave.statusCode}`);

const proposalSave = await invoke(handleProposalDrafts, "POST", "/api/proposals", {
  proposal: {
    proposalId,
    proposalRecordId: proposalId,
    accountId: "google",
    customerId: "customer-google",
    opportunityId,
    title: "CIP-020 Endpoint Authority Proposal",
    status: "DRAFT",
    approvalState: "NOT_SUBMITTED",
    geometryReferences: [routeRepositoryId],
    routeRepositoryId,
    pricingSummary: { estimateId: `${testId}-ESTIMATE`, totalCost: 100000 },
    marginSummary: { marginPct: 35 },
    confidenceSummary: { confidence: 80 },
    noScopeVersionCreation: true,
    noInventoryMutation: true,
  },
});
check("Proposal saves without duplicating Route Repository truth", proposalSave.statusCode === 201 &&
  proposalSave.body?.proposal?.proposalId === proposalId,
  `status=${proposalSave.statusCode}`);

const firstOpen = await invoke(handleCommercialOpportunities, "POST", `/api/commercial/opportunities/${encodeURIComponent(opportunityId)}/open`, {});
const secondOpen = await invoke(handleCommercialOpportunities, "POST", `/api/commercial/opportunities/${encodeURIComponent(opportunityId)}/open`, {});
check("Opportunity reopens with Route Repository reference intact", firstOpen.statusCode === 200 &&
  secondOpen.statusCode === 200 &&
  firstOpen.body?.opportunity?.routeRepositoryId === routeRepositoryId &&
  secondOpen.body?.opportunity?.routeRepositoryId === routeRepositoryId,
  `first=${firstOpen.statusCode} second=${secondOpen.statusCode}`);

const afterList = await invoke(handleCommercialRoutes, "GET", "/api/commercial/routes");
const matchingRoutes = (afterList.body?.commercialRoutes ?? []).filter((route) => route.routeRepositoryId === routeRepositoryId);
check("Route Repository persists exactly once after repeated restore", afterList.statusCode === 200 &&
  matchingRoutes.length === 1 &&
  matchingRoutes[0]?.geometryHash === geometryHash,
  `count=${matchingRoutes.length}`);
check("restore did not regenerate route geometry or create a second route", matchingRoutes.length === 1 &&
  !openBlock.includes("routeCommercialCorridorWithOsrm") &&
  matchingRoutes[0]?.commercialGeometry?.length === geometry.length);

const failed = checks.filter((item) => !item.condition);

for (const item of checks) {
  const status = item.condition ? "PASS" : "FAIL";
  console.log(`${status} ${item.name}${item.detail ? ` - ${item.detail}` : ""}`);
}

console.log("\nCIP-020 dynamic repository audit:");
console.log(`endpoint=/api/commercial/routes`);
console.log(`routeRepositoryId=${routeRepositoryId}`);
console.log(`opportunityId=${opportunityId}`);
console.log(`proposalId=${proposalId}`);
console.log(`geometryHash=${geometryHash}`);
console.log(`matchingRouteRecords=${matchingRoutes.length}`);

if (failed.length) {
  console.error(`\n${failed.length} CIP-020 validation check(s) failed.`);
  process.exit(1);
}

console.log("\nCIP-020 Commercial Route Repository endpoint authority validation passed.");
