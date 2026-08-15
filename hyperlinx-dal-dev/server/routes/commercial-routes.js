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
  updateTransactionManifest,
} from "./_shared.js";
import { requireAnyPermission } from "./authority.js";

export const COMMERCIAL_ROUTE_REPOSITORY_ENDPOINT = "/api/commercial/routes";

export const COMMERCIAL_ROUTE_REPOSITORY_AUTHORITY = {
  endpoint: COMMERCIAL_ROUTE_REPOSITORY_ENDPOINT,
  canonical: true,
  repositoryIdentifier: "COMMERCIAL_ROUTE_REPOSITORY",
  authoritySource: "Commercial Route Repository",
  storage: "server/data/commercial-routes/*.json",
  dirKey: "commercialRoutes",
  methods: ["GET", "POST", "PUT"],
  noScopeVersionCreation: true,
  noInventoryMutation: true,
};

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

function routeRepositoryDiagnostics({
  method,
  clientMethod = "SERVER_DIRECT",
  endpointUsed = COMMERCIAL_ROUTE_REPOSITORY_ENDPOINT,
  routeRepositoryId = "",
  recordCount,
  persistenceResult = "NOT_APPLICABLE",
  restoreResult = "NOT_APPLICABLE",
  authoritySource = "COMMERCIAL_ROUTE_REPOSITORY",
  detail = "",
} = {}) {
  return {
    endpointSelected: COMMERCIAL_ROUTE_REPOSITORY_ENDPOINT,
    endpointRegistered: true,
    endpointUsed,
    clientMethod,
    method,
    repositoryIdentifier: routeRepositoryId || "COMMERCIAL_ROUTE_REPOSITORY",
    repositoryType: "COMMERCIAL_ROUTE_REPOSITORY",
    persistenceResult,
    restoreResult,
    authoritySource,
    storagePath: "server/data/commercial-routes",
    physicalStorage: DIRS.commercialRoutes,
    recordCount,
    noOsrmRegeneration: true,
    noScopeVersionCreation: true,
    noInventoryMutation: true,
    detail,
  };
}

function logRouteRepositoryDiagnostics(diagnostics) {
  console.info("[CommercialRouteRepository]", diagnostics);
  return diagnostics;
}

function routeClientMethod(req) {
  return String(req.headers["x-teralinx-route-client-method"] ?? "SERVER_DIRECT");
}

function routeEndpointUsed(req) {
  return String(req.headers["x-teralinx-route-endpoint"] ?? COMMERCIAL_ROUTE_REPOSITORY_ENDPOINT);
}

function normalizeCommercialRoute(record = {}) {
  const timestamp = nowIso();
  const routeRepositoryId = String(record.routeRepositoryId ?? record.routeSnapshotId ?? `commercial-route-${Date.now()}`);
  const commercialGeometry = Array.isArray(record.commercialGeometry) ? record.commercialGeometry : [];
  const routeFeet = Number(record.routeFeet ?? record.length?.feet ?? 0);
  const routeMiles = Number(record.routeMiles ?? record.length?.miles ?? (routeFeet ? routeFeet / 5280 : 0));
  const geometryHash = String(record.geometryHash ?? record.routeGeometryHash ?? (commercialGeometry.length > 1 ? hashCommercialGeometry(commercialGeometry) : "missing"));
  const importedEvidence = Array.isArray(record.importedEvidence) && record.importedEvidence.length
    ? record.importedEvidence
    : commercialGeometry.length > 1
      ? [{
          evidenceId: `EVIDENCE-${routeRepositoryId}-GENERATED-ROUTE`,
          fileName: `${String(record.routeId ?? routeRepositoryId)}.generated-route.json`,
          type: "GENERATED_ROUTE_AUDIT",
          source: record.routeSource === "IMPORTED_EVIDENCE" ? "Imported route evidence" : "OSRM Generate Route",
          repositoryLocation: `Commercial Route Repository/${routeRepositoryId}/generated-route`,
          originalImportDate: record.createdAt ?? timestamp,
          checksum: geometryHash,
          immutable: true,
        }]
      : [];
  return {
    ...record,
    routeRepositoryId,
    routeSnapshotId: String(record.routeSnapshotId ?? routeRepositoryId),
    routeGeometryId: String(record.routeGeometryId ?? `${routeRepositoryId}:geometry:${geometryHash}`),
    geometryHash,
    repositoryType: "COMMERCIAL_ROUTE_REPOSITORY",
    commercialGeometry,
    renderedGeometryCache: record.renderedGeometryCache ?? commercialGeometry,
    simplifiedGeometry: Array.isArray(record.simplifiedGeometry) ? record.simplifiedGeometry : commercialGeometry,
    convertedRuntimeGeometry: Array.isArray(record.convertedRuntimeGeometry) ? record.convertedRuntimeGeometry : commercialGeometry,
    routeFeet,
    routeMiles,
    length: {
      feet: routeFeet,
      miles: routeMiles,
    },
    importedEvidence,
    immutableImportedEvidence: true,
    authority: "COMMERCIAL_ROUTE_REPOSITORY",
    noScopeVersionCreation: true,
    noInventoryMutation: true,
    createdAt: record.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
}

export async function handleCommercialRoutes(req, res, pathname) {
  const match = routeMatch(pathname, COMMERCIAL_ROUTE_REPOSITORY_ENDPOINT);
  if (!match) return false;
  if (handleOptions(req, res)) return true;

  if (req.method === "GET") {
    if (!requireAnyPermission(req, res, ["opportunity.read", "opportunity.manage"], "You do not have authority to read Commercial Routes.")) return true;
  } else if (["POST", "PUT"].includes(String(req.method))) {
    if (!requireAnyPermission(req, res, ["opportunity.manage"], "You do not have authority to create or update Commercial Routes.")) return true;
  }

  if (!match.base && req.method === "GET" && ["_authority", "_diagnostics"].includes(match.id)) {
    jsonResponse(res, 200, {
      authority: COMMERCIAL_ROUTE_REPOSITORY_AUTHORITY,
      routeRepositoryDiagnostics: logRouteRepositoryDiagnostics(routeRepositoryDiagnostics({
        method: req.method,
        clientMethod: routeClientMethod(req),
        endpointUsed: routeEndpointUsed(req),
        restoreResult: "AUTHORITY_CONFIRMED",
        authoritySource: COMMERCIAL_ROUTE_REPOSITORY_AUTHORITY.authoritySource,
        detail: "Commercial Route Repository canonical endpoint is registered.",
      })),
    });
    return true;
  }

  if (match.base && req.method === "GET") {
    const records = sortedByUpdated((await listRecords(DIRS.commercialRoutes)).map(normalizeCommercialRoute));
    jsonResponse(res, 200, {
      commercialRoutes: records,
      routes: records,
      routeRepositoryDiagnostics: logRouteRepositoryDiagnostics(routeRepositoryDiagnostics({
        method: req.method,
        clientMethod: routeClientMethod(req),
        endpointUsed: routeEndpointUsed(req),
        recordCount: records.length,
        restoreResult: "ROUTE_REPOSITORY_LIST_LOADED",
        authoritySource: COMMERCIAL_ROUTE_REPOSITORY_AUTHORITY.authoritySource,
      })),
    });
    return true;
  }

  if (!match.base && req.method === "GET") {
    try {
      const record = normalizeCommercialRoute(await loadRecord(DIRS.commercialRoutes, match.id));
      jsonResponse(res, 200, {
        commercialRoute: record,
        route: record,
        routeRepositoryDiagnostics: logRouteRepositoryDiagnostics(routeRepositoryDiagnostics({
          method: req.method,
          clientMethod: routeClientMethod(req),
          endpointUsed: routeEndpointUsed(req),
          routeRepositoryId: record.routeRepositoryId,
          persistenceResult: "PERSISTED",
          restoreResult: "ROUTE_REPOSITORY_LOADED",
          authoritySource: COMMERCIAL_ROUTE_REPOSITORY_AUTHORITY.authoritySource,
        })),
      });
    } catch {
      jsonResponse(res, 404, {
        error: `commercialRoute not found: ${match.id}`,
        routeRepositoryDiagnostics: logRouteRepositoryDiagnostics(routeRepositoryDiagnostics({
          method: req.method,
          clientMethod: routeClientMethod(req),
          endpointUsed: routeEndpointUsed(req),
          routeRepositoryId: match.id,
          restoreResult: "ROUTE_REPOSITORY_NOT_FOUND",
          authoritySource: COMMERCIAL_ROUTE_REPOSITORY_AUTHORITY.authoritySource,
        })),
      });
    }
    return true;
  }

  if ((match.base || match.id === "bulk" || match.action === "bulk") && req.method === "POST") {
    const body = await readRequestJson(req);
    const input = unwrapBody(body, "commercialRoute", ["commercialRoutes", "routes", "items", "data"]);
    const records = Array.isArray(input) ? input : [input];
    const saved = [];
    for (const record of records) {
      const routeRepositoryId = String(record?.routeRepositoryId ?? record?.routeSnapshotId ?? createId("commercial-route"));
      const transactionId = String(record?.transactionId ?? createId("route-save"));
      const normalized = normalizeCommercialRoute({
        ...record,
        routeRepositoryId,
        transactionId,
      });
      await updateTransactionManifest({ transactionId, operationType: "ROUTE_OPPORTUNITY_SAVE", state: "STARTED", customerId: normalized.customerId, opportunityId: normalized.opportunityId, plannedWrites: [`commercial-routes/${normalized.routeRepositoryId}.json`, `commercial-opportunities/${normalized.opportunityId}.json`], artifactIds: [normalized.routeRepositoryId], hashes: [normalized.geometryHash].filter(Boolean) });
      try {
        saved.push(await persistRecord(DIRS.commercialRoutes, normalized.routeRepositoryId, normalized));
        await updateTransactionManifest({ transactionId, operationType: "ROUTE_OPPORTUNITY_SAVE", state: "STARTED", completedWrites: [`commercial-routes/${normalized.routeRepositoryId}.json`], artifactIds: [normalized.routeRepositoryId], hashes: [normalized.geometryHash].filter(Boolean) });
      } catch (error) {
        await updateTransactionManifest({ transactionId, operationType: "ROUTE_OPPORTUNITY_SAVE", state: "RECOVERY_REQUIRED", failureReason: error instanceof Error ? error.message : String(error) });
        throw error;
      }
    }
    const diagnostics = logRouteRepositoryDiagnostics(routeRepositoryDiagnostics({
      method: req.method,
      clientMethod: routeClientMethod(req),
      endpointUsed: routeEndpointUsed(req),
      routeRepositoryId: saved[0]?.routeRepositoryId,
      recordCount: saved.length,
      persistenceResult: "ROUTE_REPOSITORY_PERSISTED_ONCE",
      restoreResult: "READY_FOR_RESTORE",
      authoritySource: COMMERCIAL_ROUTE_REPOSITORY_AUTHORITY.authoritySource,
    }));
    if (Array.isArray(input) || match.action === "bulk") {
      jsonResponse(res, 201, { commercialRoutes: saved, routes: saved, items: saved, routeRepositoryDiagnostics: diagnostics });
    } else {
      jsonResponse(res, 201, { commercialRoute: saved[0], route: saved[0], routeRepositoryDiagnostics: diagnostics });
    }
    return true;
  }

  if (!match.base && req.method === "PUT") {
    const body = await readRequestJson(req);
    const input = unwrapBody(body, "commercialRoute");
    const normalized = normalizeCommercialRoute({
      ...input,
      routeRepositoryId: input?.routeRepositoryId ?? match.id,
      updatedAt: nowIso(),
    });
    const saved = await persistRecord(DIRS.commercialRoutes, normalized.routeRepositoryId, normalized);
    jsonResponse(res, 200, {
      commercialRoute: saved,
      route: saved,
      routeRepositoryDiagnostics: logRouteRepositoryDiagnostics(routeRepositoryDiagnostics({
        method: req.method,
        clientMethod: routeClientMethod(req),
        endpointUsed: routeEndpointUsed(req),
        routeRepositoryId: saved.routeRepositoryId,
        persistenceResult: "ROUTE_REPOSITORY_UPDATED_ONCE",
        restoreResult: "READY_FOR_RESTORE",
        authoritySource: COMMERCIAL_ROUTE_REPOSITORY_AUTHORITY.authoritySource,
      })),
    });
    return true;
  }

  errorResponse(res, 405, "Commercial Route Repository method not allowed.");
  return true;
}
