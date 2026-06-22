import {
  DIRS,
  deleteRecord,
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

function normalizeScopeVersion(input = {}) {
  const raw = input.scopeVersion ?? input;
  const timestamp = nowIso();
  return {
    ...raw,
    scopeVersionId: String(raw.scopeVersionId),
    status: raw.status ?? "DRAFT",
    certificationState: raw.certificationState ?? "DRAFT",
    canonicalTruth: raw.canonicalTruth ?? {},
    createdAt: raw.createdAt ?? timestamp,
    updatedAt: raw.updatedAt ?? timestamp,
    events: Array.isArray(raw.events) ? raw.events : [],
  };
}

function isCertifiedImmutable(scopeVersion) {
  return Boolean(scopeVersion?.isImmutable || scopeVersion?.certificationState === "CERTIFIED");
}

const STATION_TRANSITIONS = {
  PLANNED: ["RELEASED", "BLOCKED", "REJECTED"],
  RELEASED: ["IN_PROGRESS", "BLOCKED", "REJECTED"],
  IN_PROGRESS: ["COMPLETE", "BLOCKED", "REJECTED"],
  COMPLETE: ["VERIFIED", "BLOCKED", "REJECTED"],
  VERIFIED: ["BLOCKED", "REJECTED"],
  BLOCKED: ["IN_PROGRESS", "REJECTED"],
  REJECTED: [],
};

const OBJECT_TRANSITIONS = {
  PLANNED: ["RELEASED", "BLOCKED", "REJECTED"],
  RELEASED: ["INSTALLED", "BLOCKED", "REJECTED"],
  INSTALLED: ["TESTED", "BLOCKED", "REJECTED"],
  TESTED: ["ACCEPTED", "BLOCKED", "REJECTED"],
  ACCEPTED: ["COMPLETE", "BLOCKED", "REJECTED"],
  COMPLETE: ["VERIFIED", "BLOCKED", "REJECTED"],
  VERIFIED: ["BLOCKED", "REJECTED"],
  BLOCKED: ["RELEASED", "INSTALLED", "REJECTED"],
  REJECTED: [],
};

function isRouteStation(value) {
  return Boolean(value) && typeof value === "object" && typeof value.stationId === "string" && typeof value.stationState === "string";
}

function isScopeObject(value) {
  return Boolean(value) && typeof value === "object" && typeof value.objectId === "string" && typeof value.objectState === "string";
}

function routeStations(scopeVersion) {
  return Array.isArray(scopeVersion?.canonicalTruth?.stations) ? scopeVersion.canonicalTruth.stations.filter(isRouteStation).sort((a, b) => Number(a.measureFeet) - Number(b.measureFeet)) : [];
}

function scopeObjects(scopeVersion) {
  return Array.isArray(scopeVersion?.canonicalTruth?.objects) ? scopeVersion.canonicalTruth.objects.filter(isScopeObject) : [];
}

function closureRecords(scopeVersion) {
  const byId = new Map();
  [...(scopeVersion?.canonicalTruth?.closures ?? []), ...(scopeVersion?.closures ?? [])].forEach((closure) => {
    if (closure?.closureId) byId.set(closure.closureId, closure);
  });
  return Array.from(byId.values()).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

function stationById(stations, stationId) {
  return stations.find((station) => station.stationId === stationId);
}

function stationsInRange(scopeVersion, stationStartId, stationEndId) {
  const stations = routeStations(scopeVersion);
  const start = stationById(stations, stationStartId);
  const end = stationById(stations, stationEndId);
  if (!start || !end) return [];
  const min = Math.min(Number(start.measureFeet), Number(end.measureFeet));
  const max = Math.max(Number(start.measureFeet), Number(end.measureFeet));
  return stations.filter((station) => Number(station.measureFeet) >= min && Number(station.measureFeet) <= max);
}

function isValidTransition(from, to, table) {
  return Boolean(from && to && from !== to && table[from]?.includes(to));
}

function validateClosureRecord(scopeVersion, closureRecord) {
  if (!closureRecord || typeof closureRecord !== "object") throw new Error("ClosureRecord is required.");
  if (!closureRecord.closureId) throw new Error("ClosureRecord closureId is required.");
  if (!closureRecord.scopeVersionId) throw new Error("ClosureRecord scopeVersionId is required.");
  if (closureRecord.scopeVersionId !== scopeVersion.scopeVersionId) throw new Error("ClosureRecord scopeVersionId does not match target ScopeVersion.");
  if (!closureRecord.authority) throw new Error("Closure authority is required.");
  if (closureRecords(scopeVersion).some((closure) => closure.closureId === closureRecord.closureId)) {
    throw new Error(`Duplicate closureId rejected: ${closureRecord.closureId}.`);
  }

  const stations = routeStations(scopeVersion);
  const objects = scopeObjects(scopeVersion);
  const objectIds = Array.isArray(closureRecord.objectIds) ? closureRecord.objectIds : [];

  if (closureRecord.closureType === "STATION_STATE_TRANSITION") {
    const station = stationById(stations, closureRecord.stationId);
    if (!station) throw new Error(`Closure references missing station ${closureRecord.stationId}.`);
    if (!isValidTransition(station.stationState, closureRecord.newStationState, STATION_TRANSITIONS)) {
      throw new Error(`Invalid station transition: ${station.stationState} -> ${closureRecord.newStationState}.`);
    }
    return { stationIds: [station.stationId], objectIds, previousStationState: station.stationState };
  }

  if (closureRecord.closureType === "STATION_RANGE_TRANSITION") {
    const range = stationsInRange(scopeVersion, closureRecord.stationStartId, closureRecord.stationEndId);
    if (!range.length) throw new Error(`Closure references missing station range ${closureRecord.stationStartId} -> ${closureRecord.stationEndId}.`);
    const invalid = range.find((station) => !isValidTransition(station.stationState, closureRecord.newStationState, STATION_TRANSITIONS));
    if (invalid) throw new Error(`Invalid station transition in range: ${invalid.stationId} ${invalid.stationState} -> ${closureRecord.newStationState}.`);
    return { stationIds: range.map((station) => station.stationId), objectIds, previousStationState: range[0]?.stationState };
  }

  if (closureRecord.closureType === "OBJECT_STATE_TRANSITION" || closureRecord.closureType === "OBJECT_RANGE_TRANSITION") {
    if (!objectIds.length) throw new Error("Object closure requires objectIds.");
    const previousObjectStates = {};
    const stationIds = new Set();
    objectIds.forEach((objectId) => {
      const object = objects.find((item) => item.objectId === objectId);
      if (!object) throw new Error(`Closure references missing object ${objectId}.`);
      if (!isValidTransition(object.objectState, closureRecord.newObjectState, OBJECT_TRANSITIONS)) {
        throw new Error(`Invalid object transition: ${object.objectState} -> ${closureRecord.newObjectState}.`);
      }
      previousObjectStates[object.objectId] = object.objectState;
      if (object.stationId) stationIds.add(object.stationId);
    });
    return { stationIds: Array.from(stationIds), objectIds, previousObjectStates };
  }

  throw new Error(`Unsupported closureType ${closureRecord.closureType}.`);
}

function calculateProgress(scopeVersion) {
  const stations = routeStations(scopeVersion);
  const objects = scopeObjects(scopeVersion);
  const closures = closureRecords(scopeVersion);
  const stationStateCounts = stations.reduce((counts, station) => {
    counts[station.stationState] = (counts[station.stationState] ?? 0) + 1;
    return counts;
  }, {});
  const objectStateCounts = objects.reduce((counts, object) => {
    counts[object.objectState] = (counts[object.objectState] ?? 0) + 1;
    return counts;
  }, {});
  const totalFeet = Number(scopeVersion.canonicalTruth?.stationing?.routeFeet ?? scopeVersion.certifiedRouteReference?.routeFeet ?? scopeVersion.buildFeet ?? stations.at(-1)?.measureFeet ?? 0);
  const completeStations = stations.filter((station) => station.stationState === "COMPLETE" || station.stationState === "VERIFIED");
  const verifiedStations = stations.filter((station) => station.stationState === "VERIFIED");
  let completedFeet = completeStations.reduce((sum, station) => {
    const index = stations.findIndex((item) => item.stationId === station.stationId);
    if (index <= 0) return sum;
    return sum + Math.max(0, Number(stations[index].measureFeet) - Number(stations[index - 1].measureFeet));
  }, 0);
  if (completeStations.length === 1 && stations[0]?.stationId === completeStations[0].stationId && stations[1]) {
    completedFeet = Math.max(0, Number(stations[1].measureFeet) - Number(stations[0].measureFeet));
  }
  const lastClosure = closures.at(-1);
  return {
    scopeVersionId: scopeVersion.scopeVersionId,
    totalStations: stations.length,
    totalObjects: objects.length,
    totalFeet,
    releasedStations: stationStateCounts.RELEASED ?? 0,
    inProgressStations: stationStateCounts.IN_PROGRESS ?? 0,
    completeStations: completeStations.length,
    verifiedStations: verifiedStations.length,
    completedFeet,
    remainingFeet: Math.max(0, totalFeet - completedFeet),
    percentComplete: totalFeet > 0 ? Math.min(100, (completedFeet / totalFeet) * 100) : stations.length ? (completeStations.length / stations.length) * 100 : 0,
    closureCount: closures.length,
    latestClosureTimestamp: lastClosure?.updatedAt ?? lastClosure?.createdAt,
    lastClosureId: lastClosure?.closureId,
    openClosures: closures.filter((closure) => closure.newStationState !== "COMPLETE" && closure.newStationState !== "VERIFIED" && closure.newObjectState !== "COMPLETE" && closure.newObjectState !== "VERIFIED").length,
    stationStateCounts,
    objectStateCounts,
    closureAuthorityStatus: stations.length && objects.length ? "PASS" : "FAIL",
  };
}

function deriveLifecycleState(scopeVersion) {
  const stationStates = routeStations(scopeVersion).map((station) => station.stationState);
  const objectStates = scopeObjects(scopeVersion).map((object) => object.objectState);
  if (scopeVersion.status === "REJECTED" || stationStates.includes("REJECTED") || objectStates.includes("REJECTED")) return "REJECTED";
  if (scopeVersion.status === "BLOCKED" || stationStates.includes("BLOCKED") || objectStates.includes("BLOCKED")) return "BLOCKED";
  if (stationStates.length && stationStates.every((state) => state === "VERIFIED")) return "VERIFIED";
  if (stationStates.length && stationStates.every((state) => state === "COMPLETE" || state === "VERIFIED")) return "COMPLETE";
  if (stationStates.some((state) => state === "COMPLETE" || state === "VERIFIED")) return "PARTIALLY_COMPLETE";
  if (stationStates.includes("IN_PROGRESS")) return "IN_FIELD";
  if (stationStates.includes("RELEASED")) return "RELEASED_TO_CONTROL";
  if (scopeVersion.status === "QUOTED") return "QUOTED";
  if (scopeVersion.status === "APPROVED" || scopeVersion.status === "ACTIVATED") return "APPROVED";
  if (scopeVersion.certifiedRouteReference?.routeAuthorityState === "PROVISIONALLY_CERTIFIED") return "PROVISIONALLY_CERTIFIED";
  return "ANALYZED";
}

function applyClosureRecord(scopeVersion, closureRecord) {
  const validation = validateClosureRecord(scopeVersion, closureRecord);
  const timestamp = nowIso();
  const affectedStationIds =
    closureRecord.closureType === "STATION_RANGE_TRANSITION"
      ? stationsInRange(scopeVersion, closureRecord.stationStartId, closureRecord.stationEndId).map((station) => station.stationId)
      : closureRecord.stationId
        ? [closureRecord.stationId]
        : validation.stationIds;
  const affectedObjectIds = new Set(validation.objectIds);
  const persistedClosure = {
    ...closureRecord,
    previousStationState: validation.previousStationState ?? closureRecord.previousStationState,
    previousObjectStates: validation.previousObjectStates ?? closureRecord.previousObjectStates,
    persistenceStatus: "PERSISTED",
    updatedAt: timestamp,
  };
  const nextStations = routeStations(scopeVersion).map((station) =>
    closureRecord.newStationState && affectedStationIds.includes(station.stationId)
      ? { ...station, stationState: closureRecord.newStationState, updatedAt: timestamp }
      : station
  );
  const nextObjects = scopeObjects(scopeVersion).map((object) =>
    closureRecord.newObjectState && affectedObjectIds.has(object.objectId)
      ? { ...object, objectState: closureRecord.newObjectState, updatedAt: timestamp }
      : object
  );
  const closures = [...closureRecords(scopeVersion), persistedClosure];
  const nextScope = normalizeScopeVersion({
    ...scopeVersion,
    closures,
    updatedAt: timestamp,
    canonicalTruth: {
      ...(scopeVersion.canonicalTruth ?? {}),
      stations: nextStations,
      objects: nextObjects,
      closures,
    },
  });
  const progress = calculateProgress(nextScope);
  const lifecycleState = deriveLifecycleState(nextScope);
  return normalizeScopeVersion({
    ...nextScope,
    status: lifecycleState,
    canonicalTruth: {
      ...(nextScope.canonicalTruth ?? {}),
      progress,
      lifecycleState,
    },
  });
}

function relationshipForChild(proposed = {}) {
  return proposed.relationshipType ?? "AMENDMENT";
}

function createChildScopeVersion(parent, proposed, relationshipType = relationshipForChild(proposed)) {
  const timestamp = nowIso();
  return normalizeScopeVersion({
    ...proposed,
    scopeVersionId: proposed.scopeVersionId && proposed.scopeVersionId !== parent.scopeVersionId ? proposed.scopeVersionId : `${parent.scopeVersionId}-child-${Date.now()}`,
    parentScopeVersionId: parent.scopeVersionId,
    rootScopeVersionId: parent.rootScopeVersionId ?? parent.scopeVersionId,
    relationshipType,
    createdAt: proposed.createdAt ?? timestamp,
    updatedAt: timestamp,
    events: [
      ...(proposed.events ?? []),
      {
        eventId: `event-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        type: "scopeversion.child_created",
        entityId: proposed.scopeVersionId ?? parent.scopeVersionId,
        entityType: "ScopeVersion",
        payload: {
          parentScopeVersionId: parent.scopeVersionId,
          relationshipType,
        },
        createdAt: timestamp,
      },
    ],
  });
}

function certifyScopeVersion(scopeVersion) {
  const timestamp = nowIso();
  const rejected = scopeVersion.certificationState === "REJECTED" || scopeVersion.status === "REJECTED";
  return normalizeScopeVersion({
    ...scopeVersion,
    certificationState: rejected ? "REJECTED" : "CERTIFIED",
    status: rejected ? "REJECTED" : scopeVersion.status,
    isImmutable: !rejected,
    updatedAt: timestamp,
    canonicalTruth: {
      ...(scopeVersion.canonicalTruth ?? {}),
      constitutionalAuthority: rejected ? "NON_AUTHORITATIVE" : "CERTIFIED_SCOPEVERSION",
      certifiedAt: rejected ? undefined : timestamp,
    },
  });
}

export async function loadScopeVersion(scopeVersionId) {
  return normalizeScopeVersion(await loadRecord(DIRS.scopeVersions, scopeVersionId));
}

export async function persistScopeVersion(scopeVersion) {
  const normalized = normalizeScopeVersion(scopeVersion);
  return persistRecord(DIRS.scopeVersions, normalized.scopeVersionId, normalized);
}

export function createChildScopeVersionFromClose(parent, iofPackage, closeEvent) {
  const timestamp = nowIso();
  const eventType = closeEvent.eventType ?? "FIELD_CLOSE";
  const relationshipType = eventType === "AS_BUILT_CLOSE" ? "AS_BUILT" : eventType === "FIELD_CLOSE" ? "FIELD_CLOSURE" : "AMENDMENT";
  const type = eventType === "AS_BUILT_CLOSE" ? "AS_BUILT" : eventType === "FIELD_CLOSE" ? "FIELD_CLOSED" : parent.type;
  return normalizeScopeVersion({
    ...parent,
    scopeVersionId: `${parent.scopeVersionId}-${String(eventType).toLowerCase().replaceAll("_", "-")}-${Date.now()}`,
    type,
    parentScopeVersionId: parent.scopeVersionId,
    rootScopeVersionId: parent.rootScopeVersionId ?? parent.scopeVersionId,
    relationshipType,
    closureEventId: closeEvent.closeEventId,
    certificationState: "DRAFT",
    isImmutable: false,
    status: "ANALYZED",
    createdAt: timestamp,
    updatedAt: timestamp,
    canonicalTruth: {
      ...(parent.canonicalTruth ?? {}),
      parentScopeVersionId: parent.scopeVersionId,
      relationshipType,
      closeEvent,
      closedPackage: iofPackage,
      constitutionalAuthority: "CHILD_SCOPEVERSION_FROM_CLOSE_EVENT",
    },
    events: [
      ...(parent.events ?? []),
      {
        eventId: `event-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        type: "scopeversion.child_from_close",
        entityId: parent.scopeVersionId,
        entityType: "ScopeVersion",
        payload: { packageId: iofPackage.packageId, closeEventId: closeEvent.closeEventId, childRelationship: relationshipType },
        createdAt: timestamp,
      },
    ],
  });
}

export async function handleScopeVersions(req, res, pathname) {
  const match = routeMatch(pathname, "/api/scopeversions");
  if (!match) return false;
  if (handleOptions(req, res)) return true;

  if (match.base && req.method === "GET") {
    jsonResponse(res, 200, { scopeVersions: sortedByUpdated(await listRecords(DIRS.scopeVersions)) });
    return true;
  }

  if (match.base && req.method === "POST") {
    const body = await readRequestJson(req);
    const scopeVersion = await persistScopeVersion(normalizeScopeVersion(body));
    jsonResponse(res, 201, { scopeVersion });
    return true;
  }

  if (!match.base && match.action === "closures" && req.method === "POST") {
    try {
      const body = await readRequestJson(req);
      const closureRecord = unwrapBody(body, "closureRecord");
      const existing = await loadScopeVersion(match.id);
      const scopeVersion = await persistScopeVersion(applyClosureRecord(existing, closureRecord));
      jsonResponse(res, 200, { scopeVersion, closureRecord: closureRecords(scopeVersion).find((closure) => closure.closureId === closureRecord?.closureId) });
    } catch (err) {
      errorResponse(res, /not found/i.test(String(err?.message ?? err)) ? 404 : 409, err instanceof Error ? err.message : String(err));
    }
    return true;
  }

  if (!match.base && req.method === "GET") {
    try {
      jsonResponse(res, 200, { scopeVersion: await loadScopeVersion(match.id) });
    } catch {
      errorResponse(res, 404, `ScopeVersion not found: ${match.id}`);
    }
    return true;
  }

  if (!match.base && req.method === "PUT") {
    const body = await readRequestJson(req);
    const proposed = normalizeScopeVersion({ ...unwrapBody(body, "scopeVersion"), scopeVersionId: unwrapBody(body, "scopeVersion")?.scopeVersionId ?? match.id });
    const existing = await loadScopeVersion(match.id).catch(() => null);
    const scopeVersion =
      existing && isCertifiedImmutable(existing)
        ? await persistScopeVersion(createChildScopeVersion(existing, proposed))
        : existing?.certificationState === "REJECTED" && proposed.certificationState === "CERTIFIED"
          ? await persistScopeVersion(createChildScopeVersion(existing, proposed, "AMENDMENT"))
          : await persistScopeVersion(proposed);
    jsonResponse(res, 200, { scopeVersion });
    return true;
  }

  if (!match.base && match.action === "certify" && req.method === "POST") {
    try {
      const existing = await loadScopeVersion(match.id);
      if (isCertifiedImmutable(existing)) {
        jsonResponse(res, 200, { scopeVersion: existing });
        return true;
      }
      if (existing.certificationState === "REJECTED") {
        errorResponse(res, 409, "Rejected ScopeVersions cannot become authoritative. Create a child ScopeVersion with corrected truth.");
        return true;
      }
      const scopeVersion = certifyScopeVersion(existing);
      await persistScopeVersion(scopeVersion);
      jsonResponse(res, 200, { scopeVersion });
    } catch {
      errorResponse(res, 404, `ScopeVersion not found: ${match.id}`);
    }
    return true;
  }

  if (!match.base && req.method === "DELETE") {
    const existing = await loadScopeVersion(match.id).catch(() => null);
    if (existing && isCertifiedImmutable(existing)) {
      errorResponse(res, 409, "Certified ScopeVersions are immutable and cannot be deleted.");
      return true;
    }
    await deleteRecord(DIRS.scopeVersions, match.id);
    jsonResponse(res, 200, { ok: true });
    return true;
  }

  return false;
}
