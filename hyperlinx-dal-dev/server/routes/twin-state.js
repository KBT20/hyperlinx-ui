import { DIRS, errorResponse, handleOptions, jsonResponse, listRecords, loadRecord } from "./_shared.js";

function isRouteStation(value) {
  return Boolean(value) && typeof value === "object" && typeof value.stationId === "string" && typeof value.stationState === "string";
}

function isScopeObject(value) {
  return Boolean(value) && typeof value === "object" && typeof value.objectId === "string" && typeof value.objectState === "string";
}

function routeStations(scopeVersion) {
  return Array.isArray(scopeVersion?.canonicalTruth?.stations)
    ? scopeVersion.canonicalTruth.stations.filter(isRouteStation).sort((a, b) => Number(a.measureFeet) - Number(b.measureFeet))
    : [];
}

function scopeObjects(scopeVersion) {
  return Array.isArray(scopeVersion?.canonicalTruth?.objects) ? scopeVersion.canonicalTruth.objects.filter(isScopeObject) : [];
}

function scopeClosures(scopeVersion, scopeVersionId) {
  const canonical = Array.isArray(scopeVersion?.canonicalTruth?.closures) ? scopeVersion.canonicalTruth.closures : [];
  const topLevel = Array.isArray(scopeVersion?.closures) ? scopeVersion.closures : [];
  return [...canonical, ...topLevel].filter((closure) => closure?.scopeVersionId === scopeVersionId);
}

function dedupeById(records, idKey) {
  const byId = new Map();
  records.forEach((record, index) => {
    const id = record?.[idKey] ?? `${idKey}-${index}`;
    if (!byId.has(id)) byId.set(id, record);
  });
  return Array.from(byId.values());
}

const LIFECYCLE_ALIASES = {
  RELEASED_TO_CONTROL: "CONTROL",
  ACTIVATED: "CONTROL_ACTIVE",
  IN_FIELD: "FIELD_ACTIVE",
  IN_CONSTRUCTION: "FIELD_ACTIVE",
  FIELD: "FIELD_ACTIVE",
};

function normalizeLifecycleState(state) {
  if (typeof state !== "string") return undefined;
  const upper = state.toUpperCase();
  return LIFECYCLE_ALIASES[upper] ?? upper;
}

function authoritativeLifecycleState(scopeVersion) {
  return normalizeLifecycleState(scopeVersion?.canonicalTruth?.lifecycleState) ?? normalizeLifecycleState(scopeVersion?.status) ?? "ANALYZED";
}

function stateCounts(records, stateKey) {
  return records.reduce((counts, record) => {
    const state = record?.[stateKey];
    if (state) counts[state] = (counts[state] ?? 0) + 1;
    return counts;
  }, {});
}

function closureFeet(closure) {
  return Number(closure?.footage ?? closure?.feetAffected ?? 0);
}

function selectedClosures(fieldClosures, scopeVersion, scopeVersionId) {
  return dedupeById(
    [
      ...fieldClosures.filter((closure) => closure?.scopeVersionId === scopeVersionId),
      ...scopeClosures(scopeVersion, scopeVersionId),
    ],
    "closureId"
  ).sort((a, b) => String(a.closedAt ?? a.createdAt ?? "").localeCompare(String(b.closedAt ?? b.createdAt ?? "")));
}

function graphContext(scopeVersion) {
  const truth = scopeVersion?.canonicalTruth ?? {};
  const reference = truth.graphReference ?? {};
  return {
    inventoryId: scopeVersion?.inventoryId ?? scopeVersion?.sourceInventoryId ?? reference.inventoryId ?? "",
    graphId: scopeVersion?.graphId ?? reference.graphId ?? "",
    graphVersion: scopeVersion?.graphVersion ?? reference.graphVersion ?? "",
    routeId: truth.networkBasis?.routeId ?? scopeVersion?.nearestRoute?.routeId ?? "",
    matched: null,
  };
}

function metricsFor(scopeVersion, workItems, closures) {
  const stations = routeStations(scopeVersion);
  const objects = scopeObjects(scopeVersion);
  const stationStateCounts = stateCounts(stations, "stationState");
  const objectStateCounts = stateCounts(objects, "objectState");
  const completedFeet = closures.reduce((sum, closure) => sum + closureFeet(closure), 0);
  const totalFeet = Number(scopeVersion?.canonicalTruth?.stationing?.routeFeet ?? scopeVersion?.certifiedRouteReference?.routeFeet ?? scopeVersion?.buildFeet ?? stations.at(-1)?.measureFeet ?? 0);
  const completedObjects = Number(objectStateCounts.COMPLETE ?? 0) + Number(objectStateCounts.VERIFIED ?? 0);
  const completedStations = Number(stationStateCounts.COMPLETE ?? 0) + Number(stationStateCounts.VERIFIED ?? 0);

  return {
    openWorkItems: workItems.filter((item) => !["COMPLETE", "CANCELLED"].includes(item.status)).length,
    completedWorkItems: workItems.filter((item) => item.status === "COMPLETE").length,
    activeWorkItems: workItems.filter((item) => item.status === "ACTIVE").length,
    pendingWorkItems: workItems.filter((item) => item.status === "PENDING").length,
    cancelledWorkItems: workItems.filter((item) => item.status === "CANCELLED").length,
    closureCount: closures.length,
    completedFeet,
    releasedObjects: objectStateCounts.RELEASED ?? 0,
    installedObjects: objectStateCounts.INSTALLED ?? 0,
    testedObjects: objectStateCounts.TESTED ?? 0,
    acceptedObjects: objectStateCounts.ACCEPTED ?? 0,
    completedObjects: objectStateCounts.COMPLETE ?? 0,
    verifiedObjects: objectStateCounts.VERIFIED ?? 0,
    blockedObjects: objectStateCounts.BLOCKED ?? 0,
    rejectedObjects: objectStateCounts.REJECTED ?? 0,
    plannedAssets: stationStateCounts.PLANNED ?? 0,
    releasedAssets: stationStateCounts.RELEASED ?? 0,
    inProgressAssets: stationStateCounts.IN_PROGRESS ?? 0,
    completedAssets: stationStateCounts.COMPLETE ?? 0,
    verifiedAssets: stationStateCounts.VERIFIED ?? 0,
    blockedAssets: stationStateCounts.BLOCKED ?? 0,
    rejectedAssets: stationStateCounts.REJECTED ?? 0,
    percentComplete: totalFeet > 0 ? Math.min(100, (completedFeet / totalFeet) * 100) : stations.length ? (completedStations / stations.length) * 100 : 0,
    objectCompletionPercent: objects.length ? (completedObjects / objects.length) * 100 : 0,
    stationDerivedCompletionPercent: stations.length ? (completedStations / stations.length) * 100 : 0,
  };
}

function routeAuthority(scopeVersion) {
  return scopeVersion?.certifiedRouteReference?.routeAuthorityState ?? scopeVersion?.canonicalTruth?.certifiedRouteReference?.routeAuthorityState;
}

function hasRouteAuthority(scopeVersion) {
  return ["CERTIFIED_ROUTE", "PROVISIONALLY_CERTIFIED"].includes(String(routeAuthority(scopeVersion)));
}

function approvedForControl(scopeVersion) {
  return (
    ["APPROVED", "CONTROL", "CONTROL_ACTIVE", "FIELD_ACTIVE", "PARTIALLY_COMPLETE", "COMPLETE", "VERIFIED", "OPERATIONAL"].includes(String(authoritativeLifecycleState(scopeVersion))) &&
    hasRouteAuthority(scopeVersion) &&
    routeStations(scopeVersion).length > 0 &&
    scopeObjects(scopeVersion).length > 0
  );
}

function lifecycleViolations(scopeVersion, workItems, closures) {
  const violations = [];
  if (!scopeVersion) return violations;
  const lifecycleState = authoritativeLifecycleState(scopeVersion);
  if (lifecycleState === "APPROVED" && !hasRouteAuthority(scopeVersion)) {
    violations.push({
      violationId: `SCOPEVERSION_APPROVED_WITHOUT_CERTIFIED_ROUTE:${scopeVersion.scopeVersionId}:NO_WORK:NO_CLOSURE`,
      severity: "BLOCKING",
      code: "SCOPEVERSION_APPROVED_WITHOUT_CERTIFIED_ROUTE",
      scopeVersionId: scopeVersion.scopeVersionId,
      message: "ScopeVersion is APPROVED without certified route authority.",
      createdAt: scopeVersion.updatedAt,
    });
  }
  workItems.forEach((workItem) => {
    if (!approvedForControl(scopeVersion)) {
      violations.push({
        violationId: `CONTROL_WORK_WITHOUT_APPROVED_SCOPE:${scopeVersion.scopeVersionId}:${workItem.workItemId}:NO_CLOSURE`,
        severity: "BLOCKING",
        code: "CONTROL_WORK_WITHOUT_APPROVED_SCOPE",
        scopeVersionId: scopeVersion.scopeVersionId,
        workItemId: workItem.workItemId,
        message: "Control work exists without an approved executable ScopeVersion.",
        createdAt: workItem.updatedAt ?? workItem.createdAt,
      });
    }
  });
  if (closures.length) {
    const hasActiveOrCompleteWork = workItems.some((workItem) => workItem.status === "ACTIVE" || workItem.status === "COMPLETE");
    if (!workItems.length || !hasActiveOrCompleteWork) {
      closures.forEach((closure) => {
        violations.push({
          violationId: `FIELD_CLOSURE_WITHOUT_ACTIVE_WORK:${scopeVersion.scopeVersionId}:NO_WORK:${closure.closureId}`,
          severity: "BLOCKING",
          code: "FIELD_CLOSURE_WITHOUT_ACTIVE_WORK",
          scopeVersionId: scopeVersion.scopeVersionId,
          closureId: closure.closureId,
          message: "A field closure exists without active or complete Control work for the selected ScopeVersion.",
          createdAt: closure.closedAt ?? closure.createdAt,
        });
      });
    }
  }
  return violations;
}

function timelineFor(scopeVersion, workItems, closures) {
  const scopeEvents = Array.isArray(scopeVersion?.events)
    ? scopeVersion.events.map((event) => ({
        ...event,
        payload: event.payload ?? {},
      }))
    : [];
  const workEvents = workItems.map((item) => ({
    eventId: item.workItemId,
    type: `control.${String(item.status ?? "unknown").toLowerCase()}`,
    entityId: item.workItemId,
    entityType: "ControlWorkItem",
    payload: item,
    createdAt: item.updatedAt ?? item.createdAt,
  }));
  const closureEvents = closures.map((closure) => ({
    eventId: closure.closureId,
    type: `field.${String(closure.closureType ?? "closure").toLowerCase()}.closed`,
    entityId: closure.closureId,
    entityType: "FieldClosure",
    payload: closure,
    createdAt: closure.closedAt ?? closure.createdAt ?? closure.updatedAt,
  }));
  return dedupeById([...scopeEvents, ...workEvents, ...closureEvents], "eventId").sort((a, b) => String(a.createdAt ?? "").localeCompare(String(b.createdAt ?? "")));
}

async function buildProjection(scopeVersionId) {
  const allWorkItems = await listRecords(DIRS.controlWorkItems);
  const allFieldClosures = await listRecords(DIRS.fieldClosures);
  if (!scopeVersionId) {
    const metrics = {
      openWorkItems: allWorkItems.filter((item) => !["COMPLETE", "CANCELLED"].includes(item.status)).length,
      completedWorkItems: allWorkItems.filter((item) => item.status === "COMPLETE").length,
      activeWorkItems: allWorkItems.filter((item) => item.status === "ACTIVE").length,
      pendingWorkItems: allWorkItems.filter((item) => item.status === "PENDING").length,
      cancelledWorkItems: allWorkItems.filter((item) => item.status === "CANCELLED").length,
      closureCount: allFieldClosures.length,
      completedFeet: allFieldClosures.reduce((sum, closure) => sum + closureFeet(closure), 0),
    };
    return {
      projectionSource: "SERVER",
      scopeVersionId: "",
      workItems: [],
      closures: [],
      timeline: [],
      metrics,
      lifecycleViolations: [],
      graphContext: { matched: null },
      totals: {
        workItemsLoaded: allWorkItems.length,
        closuresLoaded: allFieldClosures.length,
      },
    };
  }

  const scopeVersion = await loadRecord(DIRS.scopeVersions, scopeVersionId).catch(() => null);
  if (!scopeVersion) return null;
  const workItems = allWorkItems.filter((item) => item?.scopeVersionId === scopeVersionId);
  const closures = selectedClosures(allFieldClosures, scopeVersion, scopeVersionId);
  const metrics = metricsFor(scopeVersion, workItems, closures);
  const timeline = timelineFor(scopeVersion, workItems, closures);
  const violations = lifecycleViolations(scopeVersion, workItems, closures);

  console.log("[TWIN_PROJECTION_SCOPE_FILTER]", {
    scopeVersionId,
    totalWorkItemsLoaded: allWorkItems.length,
    selectedWorkItems: workItems.length,
    totalClosuresLoaded: allFieldClosures.length,
    selectedClosures: closures.length,
    completedFeet: metrics.completedFeet,
    projectionSource: "SERVER",
  });
  console.log("[TWIN_PROJECTION_METRICS]", {
    scopeVersionId,
    ...metrics,
    projectionSource: "SERVER",
  });

  return {
    projectionSource: "SERVER",
    scopeVersionId,
    scopeVersion,
    workItems,
    closures,
    timeline,
    metrics,
    lifecycleViolations: violations,
    graphContext: graphContext(scopeVersion),
    totals: {
      workItemsLoaded: allWorkItems.length,
      closuresLoaded: allFieldClosures.length,
    },
  };
}

export async function handleTwinState(req, res, pathname) {
  if (pathname !== "/api/twin/state" && pathname !== "/api/twin/state/") return false;
  if (handleOptions(req, res)) return true;
  if (req.method !== "GET") {
    errorResponse(res, 405, "Method not allowed");
    return true;
  }

  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const scopeVersionId = url.searchParams.get("scopeVersionId") ?? "";
  console.log("[TWIN_PROJECTION_REQUEST]", { scopeVersionId: scopeVersionId || "none" });
  const projection = await buildProjection(scopeVersionId);
  if (!projection) {
    jsonResponse(res, 404, {
      error: "SCOPEVERSION_NOT_FOUND",
      scopeVersionId,
    });
    return true;
  }
  console.log("[TWIN_PROJECTION_SERVER]", {
    scopeVersionId: projection.scopeVersionId || "none",
    selectedWorkItems: projection.workItems?.length ?? 0,
    selectedClosures: projection.closures?.length ?? 0,
    completedFeet: projection.metrics?.completedFeet ?? 0,
    projectionSource: projection.projectionSource,
  });
  jsonResponse(res, 200, projection);
  return true;
}
