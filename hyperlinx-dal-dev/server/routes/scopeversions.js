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
  const status = raw.status ?? "DRAFT";
  return {
    ...raw,
    scopeVersionId: String(raw.scopeVersionId),
    status,
    certificationState: raw.certificationState ?? "DRAFT",
    canonicalTruth: {
      ...(raw.canonicalTruth ?? {}),
      lifecycleState: normalizeLifecycleState(raw.canonicalTruth?.lifecycleState ?? status) ?? status,
    },
    createdAt: raw.createdAt ?? timestamp,
    updatedAt: raw.updatedAt ?? timestamp,
    events: Array.isArray(raw.events) ? raw.events : [],
  };
}

const LIFECYCLE_ORDER = [
  "DRAFT",
  "ANALYZED",
  "CERTIFIED",
  "PROVISIONALLY_CERTIFIED",
  "QUOTED",
  "APPROVED",
  "CONTROL",
  "CONTROL_ACTIVE",
  "FIELD_ACTIVE",
  "FIELD",
  "PARTIALLY_COMPLETE",
  "COMPLETE",
  "VERIFIED",
  "OPERATIONAL",
];

const LIFECYCLE_RANKS = new Map(LIFECYCLE_ORDER.map((state, index) => [state, index]));

const LIFECYCLE_ALIASES = {
  RELEASED_TO_CONTROL: "CONTROL",
  ACTIVATED: "CONTROL_ACTIVE",
  IN_FIELD: "FIELD_ACTIVE",
  IN_CONSTRUCTION: "FIELD_ACTIVE",
  FIELD: "FIELD_ACTIVE",
};

const EXCEPTION_STATES = new Set(["BLOCKED", "REJECTED"]);

function normalizeLifecycleState(state) {
  if (typeof state !== "string") return undefined;
  const upper = state.toUpperCase();
  return LIFECYCLE_ALIASES[upper] ?? upper;
}

function isExceptionState(state) {
  const normalized = normalizeLifecycleState(state);
  return Boolean(normalized && EXCEPTION_STATES.has(normalized));
}

function lifecycleRank(state) {
  const normalized = normalizeLifecycleState(state);
  return normalized ? LIFECYCLE_RANKS.get(normalized) ?? -1 : -1;
}

function highestLifecycleState(existing, incoming) {
  if (isExceptionState(existing) || isExceptionState(incoming)) return incoming ?? existing;

  const existingRank = lifecycleRank(existing);
  const incomingRank = lifecycleRank(incoming);
  if (existingRank < 0 && incomingRank < 0) return incoming ?? existing;
  if (existingRank >= incomingRank && existingRank >= 0) return normalizeLifecycleState(existing) ?? existing;
  return normalizeLifecycleState(incoming) ?? incoming;
}

function logBlockedRegression(scopeVersionId, field, existing, incoming, preserved) {
  if (existing === incoming || incoming === undefined || preserved !== existing) return;
  console.log("[LIFECYCLE_REGRESSION_BLOCKED]", {
    scopeVersionId,
    field,
    existing,
    incoming,
    preserved,
  });
}

function mergeScopeVersionLifecycle(existing, incoming) {
  if (!existing) return incoming;
  const preservedStatus = highestLifecycleState(existing.status, incoming.status);
  const existingLifecycle = existing.canonicalTruth?.lifecycleState;
  const incomingLifecycle = incoming.canonicalTruth?.lifecycleState;
  const preservedLifecycle = highestLifecycleState(existingLifecycle, incomingLifecycle);

  logBlockedRegression(incoming.scopeVersionId, "status", existing.status, incoming.status, preservedStatus);
  logBlockedRegression(incoming.scopeVersionId, "canonicalTruth.lifecycleState", existingLifecycle, incomingLifecycle, preservedLifecycle);

  return {
    ...incoming,
    status: preservedStatus,
    canonicalTruth: {
      ...(incoming.canonicalTruth ?? {}),
      lifecycleState: preservedLifecycle ?? incoming.canonicalTruth?.lifecycleState,
    },
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
  if (stationStates.includes("IN_PROGRESS") || objectStates.some((state) => ["INSTALLED", "TESTED", "ACCEPTED"].includes(state))) return "FIELD_ACTIVE";
  if (scopeVersion.status === "CONTROL_ACTIVE" || stationStates.includes("RELEASED")) return "CONTROL_ACTIVE";
  if (scopeVersion.status === "CONTROL") return "CONTROL";
  if (scopeVersion.status === "FIELD" || scopeVersion.status === "FIELD_ACTIVE") return "FIELD_ACTIVE";
  if (scopeVersion.status === "QUOTED") return "QUOTED";
  if (scopeVersion.status === "APPROVED" || scopeVersion.status === "ACTIVATED") return "APPROVED";
  if (scopeVersion.certifiedRouteReference?.routeAuthorityState === "PROVISIONALLY_CERTIFIED") return "PROVISIONALLY_CERTIFIED";
  return "ANALYZED";
}

async function activeControlWorkForScope(scopeVersionId) {
  const workItems = await listRecords(DIRS.controlWorkItems);
  return workItems.find((workItem) => workItem?.scopeVersionId === scopeVersionId && workItem?.status === "ACTIVE");
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
  const existing = await loadRecord(DIRS.scopeVersions, normalized.scopeVersionId).catch(() => null);
  const guarded = normalizeScopeVersion(mergeScopeVersionLifecycle(existing ? normalizeScopeVersion(existing) : null, normalized));
  return persistRecord(DIRS.scopeVersions, guarded.scopeVersionId, guarded);
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
      const lifecycleState = normalizeLifecycleState(existing.canonicalTruth?.lifecycleState ?? existing.status);
      if (!["CONTROL_ACTIVE", "FIELD_ACTIVE"].includes(lifecycleState)) {
        jsonResponse(res, 409, {
          error: "LIFECYCLE_AUTHORITY_VIOLATION",
          message: "Cannot append Field closure unless ScopeVersion lifecycle is CONTROL_ACTIVE or FIELD_ACTIVE.",
          lifecycleState,
        });
        return true;
      }
      const activeWork = await activeControlWorkForScope(existing.scopeVersionId);
      if (!activeWork) {
        jsonResponse(res, 409, {
          error: "ACTIVE_CONTROL_WORK_REQUIRED",
          message: "Cannot append closure without an ACTIVE ControlWorkItem for this ScopeVersion.",
        });
        return true;
      }
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
