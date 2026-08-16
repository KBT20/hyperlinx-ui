import {
  DIRS,
  errorResponse,
  handleOptions,
  jsonResponse,
  listRecords,
  loadRecord,
  nowIso,
  persistRecord,
  readRequestJson,
  resetDemoRepositories,
  routeMatch,
  sortedByUpdated,
} from "./_shared.js";
import { requireRuntimeUser } from "./authority.js";
import { hasExactPermission } from "./duty-authority.js";

const BASE_PATH = "/api/demo";

function requireDemo(user, res, permission = "demo.tenant") {
  if (user.organizationId !== "org-demo" || !hasExactPermission(user, "demo.tenant") || !hasExactPermission(user, permission)) {
    errorResponse(res, 403, "This action is restricted to the isolated org-demo security domain.");
    return false;
  }
  return true;
}

export async function handleDemo(req, res, pathname) {
  const match = routeMatch(pathname, BASE_PATH);
  if (!match) return false;
  if (handleOptions(req, res)) return true;
  const user = requireRuntimeUser(req, res);
  if (!user || !requireDemo(user, res)) return true;

  if (match.base && req.method === "GET") {
    jsonResponse(res, 200, {
      organizationId: "org-demo",
      environment: "DEMO",
      authorityClass: "DEMO",
      productionEligible: false,
      resetAvailable: hasExactPermission(user, "demo.reset"),
      scenarios: sortedByUpdated(await listRecords(DIRS.demoScenarios)),
    });
    return true;
  }
  if (!match.base && match.id === "scenarios" && req.method === "GET") {
    jsonResponse(res, 200, { scenarios: sortedByUpdated(await listRecords(DIRS.demoScenarios)) });
    return true;
  }
  if (!match.base && match.id === "reset" && req.method === "POST") {
    if (!requireDemo(user, res, "demo.reset")) return true;
    const body = await readRequestJson(req);
    const scenarioId = String(body.scenarioId ?? "DEMO-SCENARIO-DCI");
    const selectedScenario = await loadRecord(DIRS.demoScenarios, scenarioId).catch(() => null);
    if (!selectedScenario || selectedScenario.environment !== "DEMO") {
      errorResponse(res, 404, "Approved Demo scenario not found."); return true;
    }
    const result = await resetDemoRepositories();
    await persistRecord(DIRS.demoScenarios, "DEMO-ACTIVE-SCENARIO", {
      scenarioId: "DEMO-ACTIVE-SCENARIO", selectedScenarioId: scenarioId, name: selectedScenario.name,
      scenarioType: selectedScenario.scenarioType, status: "ACTIVE", activatedByPrincipalId: user.principalId,
      activatedAt: nowIso(), environment: "DEMO", authorityClass: "DEMO", productionEligible: false,
    });
    jsonResponse(res, 200, {
      reset: true,
      environment: "DEMO",
      organizationId: "org-demo",
      authorityClass: "DEMO",
      productionEligible: false,
      resetAt: result.resetAt,
      archivedPreviousState: Boolean(result.archivedAt),
      scenarios: sortedByUpdated(await listRecords(DIRS.demoScenarios)),
      selectedScenarioId: scenarioId,
    });
    return true;
  }
  errorResponse(res, 405, "Demo method not allowed.");
  return true;
}
