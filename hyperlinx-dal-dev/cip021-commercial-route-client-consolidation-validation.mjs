import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Readable } from "node:stream";

const root = process.cwd().endsWith("hyperlinx-dal-dev")
  ? process.cwd()
  : path.join(process.cwd(), "hyperlinx-dal-dev");

const paths = {
  clientApi: path.join(root, "src", "api", "teralinxRuntime.ts"),
  repositories: path.join(root, "src", "repositories", "commercialRepositories.ts"),
  workspace: path.join(root, "src", "components", "workspaces", "GoogleRfpWorkspace.tsx"),
  proposalAuthorityState: path.join(root, "src", "kernel", "ProposalAuthorityState.ts"),
  serverRoutes: path.join(root, "server", "routes", "commercial-routes.js"),
  serverOpportunities: path.join(root, "server", "routes", "commercial-opportunities.js"),
  report: path.join(root, "CIP_021_COMMERCIAL_ROUTE_REPOSITORY_CLIENT_CONSOLIDATION_REPORT.md"),
};

for (const requiredPath of Object.values(paths)) {
  if (!existsSync(requiredPath)) {
    console.error(`FAIL missing required file: ${path.relative(root, requiredPath)}`);
    process.exit(1);
  }
}

const clientApi = readFileSync(paths.clientApi, "utf8");
const repositories = readFileSync(paths.repositories, "utf8");
const workspace = readFileSync(paths.workspace, "utf8");
const proposalAuthorityState = readFileSync(paths.proposalAuthorityState, "utf8");
const serverRoutes = readFileSync(paths.serverRoutes, "utf8");
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

function walkFiles(dir, predicate, result = []) {
  for (const entry of readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      if (["node_modules", "dist-dal", ".git"].includes(entry)) continue;
      walkFiles(fullPath, predicate, result);
    } else if (predicate(fullPath)) {
      result.push(fullPath);
    }
  }
  return result;
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

const productionFiles = walkFiles(root, (file) => /\.(ts|tsx|js)$/.test(file) && !path.basename(file).startsWith("cip"));
const endpointOccurrences = productionFiles
  .filter((file) => readFileSync(file, "utf8").includes("/api/commercial/routes"))
  .map((file) => path.relative(root, file).replaceAll("\\", "/"));
const directFetchOccurrences = productionFiles
  .filter((file) => {
    const source = readFileSync(file, "utf8");
    return /fetch\s*\([^)]*\/api\/commercial\/routes/s.test(source);
  })
  .map((file) => path.relative(root, file).replaceAll("\\", "/"));

const listBlock = blockBetween(clientApi, "export async function listCommercialRoutes", "export async function loadCommercialRoute");
const loadBlock = blockBetween(clientApi, "export async function loadCommercialRoute", "export async function saveCommercialRoute");
const saveBlock = blockBetween(clientApi, "export async function saveCommercialRoute", "export async function verifyCommercialRoute");
const verifyBlock = blockBetween(clientApi, "export async function verifyCommercialRoute", "export async function cloneCommercialOpportunity");
const workspaceRestoreBlock = blockBetween(workspace, "async function handleOpenCommercialOpportunity", "function handleOpportunityLibrarySelect");
const workspaceGenerateBlock = blockBetween(workspace, "async function handleGenerateCommercialRoute", "function handleRunAzBuilderScout");
const workspaceSaveBlock = blockBetween(workspace, "async function upsertCommercialOpportunity", "function promptCommercialOpportunityName");

check("canonical client owns the Commercial Route Repository endpoint literal", endpointOccurrences.every((file) => [
  "src/api/teralinxRuntime.ts",
  "server/routes/commercial-routes.js",
].includes(file)), endpointOccurrences.join(", "));
check("no direct fetch calls target /api/commercial/routes outside canonical client", directFetchOccurrences.length === 0, directFetchOccurrences.join(", "));
check("runtime client has one internal Commercial Route Repository request helper", includesAll(clientApi, [
  "commercialRouteRepositoryRequest",
  "commercialRouteRepositoryHeaders",
  "X-Teralinx-Route-Client-Method",
  "X-Teralinx-Route-Endpoint",
  "endpointUsed",
]));
check("list/load/save/verify all traverse canonical runtime client helper", [listBlock, loadBlock, saveBlock, verifyBlock].every((block) => block.includes("commercialRouteRepositoryRequest")));
check("repository wrapper delegates every route operation to runtime client", includesAll(repositories, [
  "listRoutes: listCommercialRoutes",
  "loadRoute: loadCommercialRoute",
  "saveRoute: saveCommercialRoute",
  "verifyRoute: verifyCommercialRoute",
]));
check("Commercial Planning uses RouteRepository abstraction instead of API client route calls", includesAll(workspace, [
  "RouteRepository.listRoutes(session)",
  "RouteRepository.saveRoute",
  "RouteRepository.verifyRoute",
  "RouteRepository.loadRoute(routeRepositoryId, session)",
]) && !workspace.includes("listCommercialRoutes(") &&
  !workspace.includes("loadCommercialRoute(") &&
  !workspace.includes("saveCommercialRoute("));
check("route save verification uses explicit verifyRoute path", includesAll(workspaceGenerateBlock + workspaceSaveBlock, [
  "RouteRepository.saveRoute",
  "RouteRepository.verifyRoute",
]));
check("restore path still loads from repository and does not regenerate OSRM", includesAll(workspaceRestoreBlock, [
  "RouteRepository.loadRoute(routeRepositoryId, session)",
  "hydrateOpportunityFromRouteRepository(record, routeSnapshot)",
]) && !workspaceRestoreBlock.includes("routeCommercialCorridorWithOsrm"));
check("server echoes initiating client method and endpoint diagnostics", includesAll(serverRoutes, [
  "routeClientMethod(req)",
  "routeEndpointUsed(req)",
  "clientMethod",
  "endpointUsed",
]));
check("Proposal Authority evaluation moved to kernel state layer", includesAll(proposalAuthorityState, [
  "evaluateProposalAuthorityState",
  "proposalRepositoryReportsCommercialApproved",
  "proposalCustomerReviewStateFromRepository",
  "logProposalAuthorityStateHydration",
]) && includesAll(workspace, [
  "evaluateProposalAuthorityState",
  "logProposalAuthorityStateHydration",
]) && !workspace.includes("function proposalAuthoritySnapshot"));
check("report documents audit, consolidation, and validation", includesAll(report, [
  "Endpoint Occurrence Audit",
  "Canonical Runtime Client",
  "Client Diagnostics",
  "Proposal Authority",
  "Validation Results",
]));

const token = Buffer.from(JSON.stringify({
  sub: "teralinx-user-kyle",
  username: "kyle",
  role: "ADMINISTRATOR_COO",
  iat: new Date().toISOString(),
})).toString("base64url");

function requestFor(method, body = undefined, clientMethod = "SERVER_DIRECT") {
  const chunks = body === undefined ? [] : [Buffer.from(JSON.stringify(body))];
  const req = Readable.from(chunks);
  req.method = method;
  req.headers = {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
    "x-teralinx-route-client-method": clientMethod,
    "x-teralinx-route-endpoint": "/api/commercial/routes",
    host: "cip021.local",
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

async function invoke(handler, method, pathname, body = undefined, clientMethod = "SERVER_DIRECT") {
  const req = requestFor(method, body, clientMethod);
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

const testId = `CIP021-${Date.now()}`;
const routeRepositoryId = `${testId}-ROUTE-REPOSITORY`;
const opportunityId = `${testId}-OPPORTUNITY`;
const geometry = [
  [-96.9978, 32.7459],
  [-96.9801, 32.7602],
  [-96.9489, 32.8140],
];
const geometryHash = hashCommercialGeometry(geometry);
const timestamp = new Date().toISOString();

const saveRoute = await invoke(handleCommercialRoutes, "POST", "/api/commercial/routes", {
  commercialRoute: {
    routeRepositoryId,
    routeSnapshotId: routeRepositoryId,
    opportunityId,
    accountId: "google",
    customerId: "customer-google",
    productId: "POINT_TO_POINT_DUCT_DARK_FIBER",
    routeId: `${testId}-ROUTE`,
    routeName: "CIP-021 Client Consolidation Route",
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
}, "saveCommercialRoute");
check("dynamic save diagnostics identify saveCommercialRoute client method", saveRoute.statusCode === 201 &&
  saveRoute.body?.routeRepositoryDiagnostics?.clientMethod === "saveCommercialRoute" &&
  saveRoute.body?.routeRepositoryDiagnostics?.endpointUsed === "/api/commercial/routes" &&
  saveRoute.body?.commercialRoute?.geometryHash === geometryHash,
  `status=${saveRoute.statusCode}`);

const verifyRoute = await invoke(handleCommercialRoutes, "GET", `/api/commercial/routes/${encodeURIComponent(routeRepositoryId)}`, undefined, "verifyCommercialRoute");
check("dynamic verify diagnostics identify verifyCommercialRoute client method", verifyRoute.statusCode === 200 &&
  verifyRoute.body?.routeRepositoryDiagnostics?.clientMethod === "verifyCommercialRoute" &&
  verifyRoute.body?.commercialRoute?.geometryHash === geometryHash,
  `status=${verifyRoute.statusCode}`);

const loadRoute = await invoke(handleCommercialRoutes, "GET", `/api/commercial/routes/${encodeURIComponent(routeRepositoryId)}`, undefined, "loadCommercialRoute");
check("dynamic load diagnostics identify loadCommercialRoute client method", loadRoute.statusCode === 200 &&
  loadRoute.body?.routeRepositoryDiagnostics?.clientMethod === "loadCommercialRoute" &&
  loadRoute.body?.commercialRoute?.routeRepositoryId === routeRepositoryId,
  `status=${loadRoute.statusCode}`);

const opportunitySave = await invoke(handleCommercialOpportunities, "POST", "/api/commercial/opportunities", {
  opportunity: {
    opportunityId,
    accountId: "google",
    customerId: "customer-google",
    name: "CIP-021 Client Consolidation Opportunity",
    status: "SAVED",
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
const firstOpen = await invoke(handleCommercialOpportunities, "POST", `/api/commercial/opportunities/${encodeURIComponent(opportunityId)}/open`, {});
const secondOpen = await invoke(handleCommercialOpportunities, "POST", `/api/commercial/opportunities/${encodeURIComponent(opportunityId)}/open`, {});
const listRoutes = await invoke(handleCommercialRoutes, "GET", "/api/commercial/routes", undefined, "listCommercialRoutes");
const matchingRoutes = (listRoutes.body?.commercialRoutes ?? []).filter((route) => route.routeRepositoryId === routeRepositoryId);
check("dynamic opportunity restore preserves route reference", opportunitySave.statusCode === 201 &&
  firstOpen.statusCode === 200 &&
  secondOpen.statusCode === 200 &&
  firstOpen.body?.opportunity?.routeRepositoryId === routeRepositoryId &&
  secondOpen.body?.opportunity?.routeRepositoryId === routeRepositoryId,
  `save=${opportunitySave.statusCode} open1=${firstOpen.statusCode} open2=${secondOpen.statusCode}`);
check("dynamic list diagnostics identify listCommercialRoutes client method", listRoutes.statusCode === 200 &&
  listRoutes.body?.routeRepositoryDiagnostics?.clientMethod === "listCommercialRoutes",
  `status=${listRoutes.statusCode}`);
check("dynamic restore leaves exactly one Route Repository record", matchingRoutes.length === 1 &&
  matchingRoutes[0]?.geometryHash === geometryHash,
  `count=${matchingRoutes.length}`);

const failed = checks.filter((item) => !item.condition);

for (const item of checks) {
  const status = item.condition ? "PASS" : "FAIL";
  console.log(`${status} ${item.name}${item.detail ? ` - ${item.detail}` : ""}`);
}

console.log("\nCIP-021 dynamic client consolidation audit:");
console.log(`endpoint=/api/commercial/routes`);
console.log(`routeRepositoryId=${routeRepositoryId}`);
console.log(`opportunityId=${opportunityId}`);
console.log(`geometryHash=${geometryHash}`);
console.log(`matchingRouteRecords=${matchingRoutes.length}`);

if (failed.length) {
  console.error(`\n${failed.length} CIP-021 validation check(s) failed.`);
  process.exit(1);
}

console.log("\nCIP-021 Commercial Route Repository client consolidation validation passed.");
