import { DIRS, errorResponse, handleOptions, jsonResponse, listRecords, loadRecord } from "./_shared.js";
import { calculateCompletionProjection } from "../kernel/completion-engine.js";

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
  FIELD_ACTIVE: "FIELD",
  IN_FIELD: "FIELD",
  IN_CONSTRUCTION: "FIELD",
};

const LIFECYCLE_ORDER = [
  "DRAFT",
  "ANALYZED",
  "CERTIFIED",
  "PROVISIONALLY_CERTIFIED",
  "QUOTED",
  "APPROVED",
  "CONTROL",
  "CONTROL_ACTIVE",
  "FIELD",
  "PARTIALLY_COMPLETE",
  "COMPLETE",
  "VERIFIED",
  "OPERATIONAL",
];

const LIFECYCLE_RANKS = new Map(LIFECYCLE_ORDER.map((state, index) => [state, index]));

function normalizeLifecycleState(state) {
  if (typeof state !== "string") return undefined;
  const upper = state.toUpperCase();
  return LIFECYCLE_ALIASES[upper] ?? upper;
}

function highestLifecycleState(existing, incoming) {
  const existingNormalized = normalizeLifecycleState(existing);
  const incomingNormalized = normalizeLifecycleState(incoming);
  const existingRank = existingNormalized ? LIFECYCLE_RANKS.get(existingNormalized) ?? -1 : -1;
  const incomingRank = incomingNormalized ? LIFECYCLE_RANKS.get(incomingNormalized) ?? -1 : -1;
  if (existingRank < 0 && incomingRank < 0) return incomingNormalized ?? existingNormalized;
  return existingRank >= incomingRank ? existingNormalized : incomingNormalized;
}

function inferLifecycleStateFromAuthority(scopeVersion = {}) {
  const events = Array.isArray(scopeVersion.events) ? scopeVersion.events : [];
  const closures = [
    ...(Array.isArray(scopeVersion.canonicalTruth?.closures) ? scopeVersion.canonicalTruth.closures : []),
    ...(Array.isArray(scopeVersion.closures) ? scopeVersion.closures : []),
  ];
  const executionState = scopeVersion.canonicalTruth?.executionState;
  let inferred;
  const advance = (state) => {
    inferred = highestLifecycleState(inferred, state);
  };
  events.forEach((event) => {
    const type = String(event?.type ?? "");
    if (type === "scopeversion.quoted") advance("QUOTED");
    if (type === "scopeversion.approved") advance("APPROVED");
    if (type === "scopeversion.control.work_created") advance("CONTROL");
    if (type === "scopeversion.control.activated") advance("CONTROL_ACTIVE");
    if (type.startsWith("field.") || type.includes("field_") || type.includes("FIELD_CLOSE")) advance("FIELD");
    if (type === "scopeversion.complete" || type === "scopeversion.control.work_complete") advance("COMPLETE");
    if (type === "scopeversion.operational") advance("OPERATIONAL");
  });
  if (closures.length) advance("FIELD");
  if (executionState?.overallExecutionState === "ACTIVE") advance("CONTROL_ACTIVE");
  if (executionState?.overallExecutionState === "COMPLETE") advance("COMPLETE");
  return inferred;
}

function authoritativeLifecycleState(scopeVersion) {
  return highestLifecycleState(
    highestLifecycleState(scopeVersion?.canonicalTruth?.lifecycleState, scopeVersion?.status),
    inferLifecycleStateFromAuthority(scopeVersion)
  ) ?? "ANALYZED";
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
  const completionProjection = calculateCompletionProjection({ scopeVersion, workItems, closures });

  return {
    openWorkItems: completionProjection.totalWorkItems - completionProjection.completedWorkItems - completionProjection.cancelledWorkItems,
    completedWorkItems: completionProjection.completedWorkItems,
    activeWorkItems: completionProjection.activeWorkItems,
    pendingWorkItems: completionProjection.pendingWorkItems,
    holdWorkItems: completionProjection.holdWorkItems,
    cancelledWorkItems: completionProjection.cancelledWorkItems,
    blockedWorkItems: completionProjection.blockedWorkItems,
    closureCount: closures.length,
    totalFeet: completionProjection.totalFeet,
    completedFeet: completionProjection.completedFeet,
    releasedObjects: completionProjection.releasedObjects,
    installedObjects: completionProjection.installedObjects,
    testedObjects: completionProjection.testedObjects,
    acceptedObjects: completionProjection.acceptedObjects,
    completedObjects: completionProjection.completedObjects,
    verifiedObjects: completionProjection.verifiedObjects,
    blockedObjects: completionProjection.blockedObjects,
    rejectedObjects: completionProjection.rejectedObjects,
    plannedAssets: Math.max(0, completionProjection.totalStations - completionProjection.releasedStations - completionProjection.inProgressStations - completionProjection.completedStations - completionProjection.verifiedStations - completionProjection.blockedStations - completionProjection.rejectedStations),
    releasedAssets: completionProjection.releasedStations,
    inProgressAssets: completionProjection.inProgressStations,
    completedAssets: completionProjection.completedStations,
    verifiedAssets: completionProjection.verifiedStations,
    blockedAssets: completionProjection.blockedStations,
    rejectedAssets: completionProjection.rejectedStations,
    percentComplete: completionProjection.percentComplete,
    objectCompletionPercent: completionProjection.objectCompletionPercent,
    stationDerivedCompletionPercent: completionProjection.stationCompletionPercent,
    workCompletionPercent: completionProjection.workCompletionPercent,
    completionAuthority: completionProjection.completionAuthority,
    completionProjection,
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
    ["APPROVED", "CONTROL", "CONTROL_ACTIVE", "FIELD", "PARTIALLY_COMPLETE", "COMPLETE", "VERIFIED", "OPERATIONAL"].includes(String(authoritativeLifecycleState(scopeVersion))) &&
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
  const runtimeObjects = await listRecords(DIRS.runtimeObjects);
  const commercialRuntimeObjects = dedupeById(
    runtimeObjects.filter((record) => ["ACCOUNT", "CONTACT", "OPPORTUNITY", "CUSTOMER_TWIN", "PRODUCT", "FULFILLMENT_PLAN", "PROPOSAL"].includes(String(record?.objectType ?? ""))),
    "runtimeId"
  ).sort((a, b) => String(b.updatedAt ?? b.createdAt ?? "").localeCompare(String(a.updatedAt ?? a.createdAt ?? ""))).slice(0, 24);
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
      completionProjection: metrics.completionProjection,
      lifecycleViolations: [],
      graphContext: { matched: null },
      commercialRuntimeObjects,
      totals: {
        workItemsLoaded: allWorkItems.length,
        closuresLoaded: allFieldClosures.length,
        runtimeObjectsLoaded: runtimeObjects.length,
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
    completionProjection: metrics.completionProjection,
    lifecycleViolations: violations,
    graphContext: graphContext(scopeVersion),
    commercialRuntimeObjects,
    totals: {
      workItemsLoaded: allWorkItems.length,
      closuresLoaded: allFieldClosures.length,
      runtimeObjectsLoaded: runtimeObjects.length,
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

  const url = new URL(req.url ?? "/", `https://${req.headers.host ?? "runtime.invalid"}`);
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
