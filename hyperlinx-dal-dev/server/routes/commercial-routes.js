import { DIRS, handleJsonCollection, nowIso, routeMatch } from "./_shared.js";
import { requireAnyPermission } from "./authority.js";

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
  const match = routeMatch(pathname, "/api/commercial/routes");
  if (!match) return false;
  if (req.method === "GET") {
    if (!requireAnyPermission(req, res, ["opportunity.read", "opportunity.manage"], "You do not have authority to read Commercial Routes.")) return true;
  } else if (["POST", "PUT"].includes(String(req.method))) {
    if (!requireAnyPermission(req, res, ["opportunity.manage"], "You do not have authority to create or update Commercial Routes.")) return true;
  }
  return handleJsonCollection(req, res, pathname, {
    basePath: "/api/commercial/routes",
    dir: DIRS.commercialRoutes,
    idKey: "routeRepositoryId",
    listKey: "commercialRoutes",
    itemKey: "commercialRoute",
    pluralBodyKeys: ["commercialRoutes", "routes", "items", "data"],
    idPrefix: "commercial-route",
    normalize: normalizeCommercialRoute,
  });
}
