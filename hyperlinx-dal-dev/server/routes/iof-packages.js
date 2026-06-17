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
  routeMatch,
  sortedByUpdated,
  unwrapBody,
} from "./_shared.js";
import { createChildScopeVersionFromClose, loadScopeVersion, persistScopeVersion } from "./scopeversions.js";
import { normalizeCloseEvent } from "./close-events.js";

function normalizeIofPackage(input = {}) {
  const raw = input.iofPackage ?? input.package ?? input;
  const timestamp = nowIso();
  return {
    ...raw,
    packageId: String(raw.packageId),
    scopeVersionId: String(raw.scopeVersionId ?? ""),
    packageType: raw.packageType ?? "ENGINEERING",
    status: raw.status ?? "DRAFT",
    createdAt: raw.createdAt ?? timestamp,
    updatedAt: raw.updatedAt ?? timestamp,
    route: Array.isArray(raw.route) ? raw.route : [],
    stations: Array.isArray(raw.stations) ? raw.stations : [],
    objects: Array.isArray(raw.objects) ? raw.objects : [],
    progress: raw.progress ?? {
      totalObjects: Array.isArray(raw.objects) ? raw.objects.length : 0,
      completedObjects: 0,
      percentComplete: 0,
    },
  };
}

function closeEventTypeForPackage(iofPackage) {
  if (iofPackage.packageType === "AS_BUILT") return "AS_BUILT_CLOSE";
  if (iofPackage.packageType === "PERMITTING") return "PERMIT_CLOSE";
  if (iofPackage.packageType === "ENGINEERING") return "ENGINEERING_CLOSE";
  if (iofPackage.packageType === "CONSTRUCTION") return "CONSTRUCTION_CLOSE";
  return "FIELD_CLOSE";
}

function createCloseEventFromPackage(iofPackage) {
  return normalizeCloseEvent({
    closeEventId: `close-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    sourceScopeVersionId: iofPackage.scopeVersionId,
    packageId: iofPackage.packageId,
    eventType: closeEventTypeForPackage(iofPackage),
    timestamp: nowIso(),
    payload: {
      packageType: iofPackage.packageType,
      closedPackageStatus: "CLOSED",
      progress: iofPackage.progress,
    },
  });
}

export async function handleIofPackages(req, res, pathname) {
  const match = routeMatch(pathname, "/api/iof-packages");
  if (!match) return false;
  if (handleOptions(req, res)) return true;

  if (match.base && req.method === "GET") {
    jsonResponse(res, 200, { iofPackages: sortedByUpdated(await listRecords(DIRS.iofPackages)) });
    return true;
  }

  if (match.base && req.method === "POST") {
    const body = await readRequestJson(req);
    const iofPackage = normalizeIofPackage(unwrapBody(body, "iofPackage"));
    jsonResponse(res, 201, { iofPackage: await persistRecord(DIRS.iofPackages, iofPackage.packageId, iofPackage) });
    return true;
  }

  if (!match.base && req.method === "GET") {
    try {
      jsonResponse(res, 200, { iofPackage: await loadRecord(DIRS.iofPackages, match.id) });
    } catch {
      errorResponse(res, 404, `IOFPackage not found: ${match.id}`);
    }
    return true;
  }

  if (!match.base && match.action === "archive" && req.method === "POST") {
    try {
      const iofPackage = normalizeIofPackage({ ...(await loadRecord(DIRS.iofPackages, match.id)), isArchived: true, archivedAt: nowIso(), updatedAt: nowIso() });
      await persistRecord(DIRS.iofPackages, iofPackage.packageId, iofPackage);
      jsonResponse(res, 200, { iofPackage });
    } catch {
      errorResponse(res, 404, `IOFPackage not found: ${match.id}`);
    }
    return true;
  }

  if (!match.base && match.action === "close" && req.method === "POST") {
    try {
      const existingPackage = normalizeIofPackage(await loadRecord(DIRS.iofPackages, match.id));
      if (existingPackage.status === "CLOSED" && existingPackage.closeEventId) {
        const closeEvent = await loadRecord(DIRS.closeEvents, existingPackage.closeEventId).catch(() => undefined);
        jsonResponse(res, 200, { iofPackage: existingPackage, closeEvent });
        return true;
      }
      const parent = await loadScopeVersion(existingPackage.scopeVersionId);
      const closeEventPayload = createCloseEventFromPackage(existingPackage);
      const closeEvent = await persistRecord(DIRS.closeEvents, closeEventPayload.closeEventId, closeEventPayload);
      const closedPackage = normalizeIofPackage({
        ...existingPackage,
        status: "CLOSED",
        closeEventId: closeEvent.closeEventId,
        progress: {
          totalObjects: existingPackage.objects.length,
          completedObjects: existingPackage.objects.length,
          percentComplete: 100,
        },
        updatedAt: closeEvent.timestamp,
      });
      await persistRecord(DIRS.iofPackages, closedPackage.packageId, closedPackage);
      const childScopeVersion = await persistScopeVersion(createChildScopeVersionFromClose(parent, closedPackage, closeEvent));
      closeEvent.childScopeVersionId = childScopeVersion.scopeVersionId;
      await persistRecord(DIRS.closeEvents, closeEvent.closeEventId, closeEvent);
      jsonResponse(res, 200, { iofPackage: closedPackage, closeEvent, childScopeVersion });
    } catch (err) {
      errorResponse(res, 500, err instanceof Error ? err.message : String(err));
    }
    return true;
  }

  if (!match.base && req.method === "PUT") {
    const existing = await loadRecord(DIRS.iofPackages, match.id).catch(() => null);
    if (existing?.status === "CLOSED") {
      errorResponse(res, 409, "Closed IOF Packages cannot be updated. Create a new package for new work.");
      return true;
    }
    const body = await readRequestJson(req);
    const iofPackage = normalizeIofPackage({ ...unwrapBody(body, "iofPackage"), packageId: match.id, updatedAt: nowIso() });
    jsonResponse(res, 200, { iofPackage: await persistRecord(DIRS.iofPackages, iofPackage.packageId, iofPackage) });
    return true;
  }

  return false;
}
