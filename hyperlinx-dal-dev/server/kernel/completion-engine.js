function numberOrZero(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function clampPercent(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function normalizeControlWorkStatus(value) {
  const upper = typeof value === "string" ? value.trim().toUpperCase() : "";
  return upper === "ON_HOLD" ? "HOLD" : upper || "PENDING";
}

function routeStations(scopeVersion) {
  return Array.isArray(scopeVersion?.canonicalTruth?.stations)
    ? scopeVersion.canonicalTruth.stations
        .filter((station) => station && typeof station.stationId === "string")
        .slice()
        .sort((a, b) => numberOrZero(a.measureFeet) - numberOrZero(b.measureFeet))
    : [];
}

function scopeObjects(scopeVersion) {
  return Array.isArray(scopeVersion?.canonicalTruth?.objects)
    ? scopeVersion.canonicalTruth.objects.filter((object) => object && typeof object.objectId === "string")
    : [];
}

function dedupeById(records, key) {
  const byId = new Map();
  records.forEach((record, index) => {
    const id = String(record?.[key] ?? `${key}-${index}`);
    if (!byId.has(id)) byId.set(id, record);
  });
  return Array.from(byId.values());
}

function scopeClosureRecords(scopeVersion) {
  if (!scopeVersion) return [];
  return dedupeById([
    ...(Array.isArray(scopeVersion.canonicalTruth?.closures) ? scopeVersion.canonicalTruth.closures : []),
    ...(Array.isArray(scopeVersion.closures) ? scopeVersion.closures : []),
  ].filter((closure) => closure?.scopeVersionId === scopeVersion.scopeVersionId), "closureId");
}

function stateCounts(values) {
  return values.reduce((counts, value) => {
    if (value) counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function closureId(closure) {
  return String(closure?.closureId ?? "");
}

function closureScopeVersionId(closure) {
  return String(closure?.scopeVersionId ?? "");
}

function closureFeet(closure) {
  return Math.max(0, numberOrZero(closure?.feetAffected ?? closure?.footage));
}

function isClosureRecord(closure) {
  return Array.isArray(closure?.objectIds) || typeof closure?.newObjectState === "string" || typeof closure?.newStationState === "string";
}

function stationDelta(stations, stationId) {
  if (!stationId) return 0;
  const index = stations.findIndex((station) => station.stationId === stationId);
  if (index < 0) return 0;
  if (index > 0) return Math.max(0, numberOrZero(stations[index].measureFeet) - numberOrZero(stations[index - 1].measureFeet));
  if (stations[1]) return Math.max(0, numberOrZero(stations[1].measureFeet) - numberOrZero(stations[0].measureFeet));
  return 0;
}

function rangeDelta(stations, stationStartId, stationEndId) {
  const start = stations.find((station) => station.stationId === stationStartId);
  const end = stations.find((station) => station.stationId === stationEndId);
  if (!start || !end) return 0;
  return Math.abs(numberOrZero(end.measureFeet) - numberOrZero(start.measureFeet));
}

function addWarning(warnings, warning) {
  warnings.push(warning);
  console.warn("[COMPLETION_ENGINE_WARNING]", warning);
}

function totalFeetFor(scopeVersion, stations, warnings) {
  const totalFeet = numberOrZero(
    scopeVersion?.canonicalTruth?.stationing?.routeFeet ??
      scopeVersion?.certifiedRouteReference?.routeFeet ??
      scopeVersion?.canonicalTruth?.certifiedRouteReference?.routeFeet
  );
  if (totalFeet > 0) return totalFeet;
  const lastStationFeet = numberOrZero(stations.at(-1)?.measureFeet);
  if (lastStationFeet > 0) return lastStationFeet;
  const buildFeet = numberOrZero(
    scopeVersion?.buildFeet ??
      scopeVersion?.canonicalTruth?.engineeringBasis?.buildFeet ??
      scopeVersion?.canonicalTruth?.geographicBasis?.buildPath?.buildFeet ??
      scopeVersion?.canonicalTruth?.geographicBasis?.buildPath?.distanceFeet
  );
  if (buildFeet > 0) return buildFeet;
  addWarning(warnings, {
    code: "COMPLETION_TOTAL_FEET_MISSING",
    severity: "WARNING",
    message: "No route/station/build-path total footage was available.",
    entityId: scopeVersion?.scopeVersionId,
  });
  return 0;
}

function completionFeetFromClosures(closures, stations, objectIds, stationIds, warnings) {
  let completedFeet = 0;
  let verifiedFeet = 0;
  closures.forEach((closure) => {
    if (!isClosureRecord(closure)) return;
    const id = closureId(closure);
    const feet = closureFeet(closure);
    if (closure.closureType === "OBJECT_STATE_TRANSITION" || closure.closureType === "OBJECT_RANGE_TRANSITION") {
      (closure.objectIds ?? []).forEach((objectId) => {
        if (!objectIds.has(objectId)) {
          addWarning(warnings, {
            code: "COMPLETION_UNKNOWN_OBJECT",
            severity: "WARNING",
            message: `Closure references unknown object ${objectId}.`,
            entityId: id,
          });
        }
      });
      if ((closure.newObjectState === "COMPLETE" || closure.newObjectState === "VERIFIED") && feet > 0) {
        completedFeet += feet;
        if (closure.newObjectState === "VERIFIED") verifiedFeet += feet;
      }
      return;
    }
    if (closure.closureType === "STATION_STATE_TRANSITION") {
      if (closure.stationId && !stationIds.has(closure.stationId)) {
        addWarning(warnings, {
          code: "COMPLETION_UNKNOWN_STATION",
          severity: "WARNING",
          message: `Closure references unknown station ${closure.stationId}.`,
          entityId: id,
        });
      }
      if (closure.newStationState === "COMPLETE" || closure.newStationState === "VERIFIED") {
        const affectedFeet = feet > 0 ? feet : stationDelta(stations, closure.stationId);
        completedFeet += affectedFeet;
        if (closure.newStationState === "VERIFIED") verifiedFeet += affectedFeet;
      }
      return;
    }
    if (closure.closureType === "STATION_RANGE_TRANSITION") {
      [closure.stationStartId, closure.stationEndId].filter(Boolean).forEach((stationId) => {
        if (!stationIds.has(stationId)) {
          addWarning(warnings, {
            code: "COMPLETION_UNKNOWN_STATION",
            severity: "WARNING",
            message: `Range closure references unknown station ${stationId}.`,
            entityId: id,
          });
        }
      });
      if (closure.newStationState === "COMPLETE" || closure.newStationState === "VERIFIED") {
        const affectedFeet = feet > 0 ? feet : rangeDelta(stations, closure.stationStartId, closure.stationEndId);
        completedFeet += affectedFeet;
        if (closure.newStationState === "VERIFIED") verifiedFeet += affectedFeet;
      }
    }
  });
  return { completedFeet, verifiedFeet };
}

export function calculateCompletionProjection({ scopeVersion, workItems = [], closures = [] }) {
  const scopeVersionId = scopeVersion?.scopeVersionId ?? "";
  const warnings = [];
  const stations = routeStations(scopeVersion);
  const objects = scopeObjects(scopeVersion);
  const objectIds = new Set(objects.map((object) => object.objectId));
  const stationIds = new Set(stations.map((station) => station.stationId));
  console.log("[COMPLETION_ENGINE_INPUT]", {
    scopeVersionId: scopeVersionId || "none",
    inputWorkItems: workItems.length,
    inputClosures: closures.length,
    scopeClosureRecords: scopeClosureRecords(scopeVersion).length,
  });
  if (!scopeVersion) {
    addWarning(warnings, {
      code: "COMPLETION_SCOPEVERSION_MISSING",
      severity: "BLOCKING",
      message: "Completion projection requires a ScopeVersion.",
    });
  }
  const selectedWorkItems = workItems.filter((item) => {
    const belongs = !scopeVersionId || item.scopeVersionId === scopeVersionId;
    if (!belongs) addWarning(warnings, {
      code: "COMPLETION_FOREIGN_WORK_ITEM",
      severity: "WARNING",
      message: `Ignoring foreign work item ${item.workItemId}.`,
      entityId: item.workItemId,
    });
    return belongs;
  });
  const selectedClosures = dedupeById([...closures, ...scopeClosureRecords(scopeVersion)], "closureId").filter((closure) => {
    const belongs = !scopeVersionId || closureScopeVersionId(closure) === scopeVersionId;
    if (!belongs) addWarning(warnings, {
      code: "COMPLETION_FOREIGN_CLOSURE",
      severity: "WARNING",
      message: `Ignoring foreign closure ${closureId(closure)}.`,
      entityId: closureId(closure),
    });
    return belongs;
  });
  console.log("[COMPLETION_ENGINE_SCOPE_FILTER]", {
    scopeVersionId: scopeVersionId || "none",
    selectedWorkItems: selectedWorkItems.length,
    selectedClosures: selectedClosures.length,
  });
  const stationCounts = stateCounts(stations.map((station) => station.stationState));
  const objectCounts = stateCounts(objects.map((object) => object.objectState));
  const workStatuses = selectedWorkItems.map((item) => normalizeControlWorkStatus(item.status));
  const workCounts = stateCounts(workStatuses);
  const totalFeet = totalFeetFor(scopeVersion, stations, warnings);
  const closureFootage = completionFeetFromClosures(selectedClosures, stations, objectIds, stationIds, warnings);
  const stationWeighted = stations.reduce((sum, station) => {
    const weight = { PLANNED: 0, RELEASED: 0.1, IN_PROGRESS: 0.5, COMPLETE: 1, VERIFIED: 1, BLOCKED: 0, REJECTED: 0 }[station.stationState] ?? 0;
    return sum + weight;
  }, 0);
  const objectWeighted = objects.reduce((sum, object) => {
    const weight = { PLANNED: 0, RELEASED: 0.1, INSTALLED: 0.4, TESTED: 0.65, ACCEPTED: 0.8, COMPLETE: 1, VERIFIED: 1, BLOCKED: 0, REJECTED: 0 }[object.objectState] ?? 0;
    return sum + weight;
  }, 0);
  const workWeighted = workStatuses.reduce((sum, status) => {
    const weight = { PENDING: 0, ACTIVE: 0.25, HOLD: 0.1, BLOCKED: 0, COMPLETE: 1, CANCELLED: 0 }[status] ?? 0;
    return sum + weight;
  }, 0);
  const completedFeet = Math.min(totalFeet || closureFootage.completedFeet, closureFootage.completedFeet);
  const verifiedFeet = Math.min(totalFeet || closureFootage.verifiedFeet, closureFootage.verifiedFeet);
  const releasedFeet = totalFeet > 0 ? totalFeet * ((stationCounts.RELEASED ?? 0) / Math.max(stations.length, 1)) : 0;
  const inProgressFeet = totalFeet > 0 ? totalFeet * ((stationCounts.IN_PROGRESS ?? 0) / Math.max(stations.length, 1)) : 0;
  const projection = {
    scopeVersionId,
    totalFeet,
    completedFeet,
    releasedFeet,
    inProgressFeet,
    verifiedFeet,
    blockedFeet: totalFeet > 0 ? totalFeet * ((stationCounts.BLOCKED ?? 0) / Math.max(stations.length, 1)) : 0,
    rejectedFeet: totalFeet > 0 ? totalFeet * ((stationCounts.REJECTED ?? 0) / Math.max(stations.length, 1)) : 0,
    totalStations: stations.length,
    releasedStations: stationCounts.RELEASED ?? 0,
    inProgressStations: stationCounts.IN_PROGRESS ?? 0,
    completedStations: stationCounts.COMPLETE ?? 0,
    verifiedStations: stationCounts.VERIFIED ?? 0,
    blockedStations: stationCounts.BLOCKED ?? 0,
    rejectedStations: stationCounts.REJECTED ?? 0,
    totalObjects: objects.length,
    plannedObjects: objectCounts.PLANNED ?? 0,
    releasedObjects: objectCounts.RELEASED ?? 0,
    installedObjects: objectCounts.INSTALLED ?? 0,
    testedObjects: objectCounts.TESTED ?? 0,
    acceptedObjects: objectCounts.ACCEPTED ?? 0,
    completedObjects: objectCounts.COMPLETE ?? 0,
    verifiedObjects: objectCounts.VERIFIED ?? 0,
    blockedObjects: objectCounts.BLOCKED ?? 0,
    rejectedObjects: objectCounts.REJECTED ?? 0,
    totalWorkItems: selectedWorkItems.length,
    pendingWorkItems: workCounts.PENDING ?? 0,
    activeWorkItems: workCounts.ACTIVE ?? 0,
    holdWorkItems: workCounts.HOLD ?? 0,
    completedWorkItems: workCounts.COMPLETE ?? 0,
    cancelledWorkItems: workCounts.CANCELLED ?? 0,
    blockedWorkItems: workCounts.BLOCKED ?? 0,
    percentReleased: totalFeet > 0 ? clampPercent((releasedFeet / totalFeet) * 100) : objects.length ? clampPercent(((objectCounts.RELEASED ?? 0) / objects.length) * 100) : 0,
    percentInProgress: totalFeet > 0 ? clampPercent((inProgressFeet / totalFeet) * 100) : stations.length ? clampPercent((stationWeighted / stations.length) * 100) : 0,
    percentComplete: totalFeet > 0 ? clampPercent((completedFeet / totalFeet) * 100) : 0,
    percentVerified: totalFeet > 0 ? clampPercent((verifiedFeet / totalFeet) * 100) : 0,
    objectCompletionPercent: objects.length ? clampPercent((objectWeighted / objects.length) * 100) : 0,
    stationCompletionPercent: stations.length ? clampPercent((stationWeighted / stations.length) * 100) : 0,
    workCompletionPercent: selectedWorkItems.length ? clampPercent((workWeighted / selectedWorkItems.length) * 100) : 0,
    completionAuthority: selectedClosures.length && (objects.length || stations.length) ? "MIXED" : selectedClosures.length ? "CLOSURE_LEDGER" : "SCOPEVERSION_STATE",
    warnings,
  };
  console.log("[COMPLETION_ENGINE_PROJECTION]", {
    scopeVersionId: scopeVersionId || "none",
    completedFeet: projection.completedFeet,
    totalFeet: projection.totalFeet,
    percentComplete: projection.percentComplete,
    objectCompletionPercent: projection.objectCompletionPercent,
    stationCompletionPercent: projection.stationCompletionPercent,
    workCompletionPercent: projection.workCompletionPercent,
    completionAuthority: projection.completionAuthority,
    warningCount: projection.warnings.length,
  });
  return projection;
}
