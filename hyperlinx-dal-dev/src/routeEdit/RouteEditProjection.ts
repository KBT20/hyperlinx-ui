import type {
  TransparentCorridorEstimate,
  TransparentEstimateControls,
} from "../commercial/TransparentEstimatingEngine";
import type { IlaPlanningControls } from "../commercial/IlaPlanningEngine";
import type {
  RouteEditPatch,
  RouteEditProjection,
  RouteEditSession,
} from "./RouteEditSession";
import { calculateRouteEditImpact } from "./RouteEditImpactEngine";

function cloneControls(controls: TransparentEstimateControls): TransparentEstimateControls {
  return {
    ...controls,
    production: { ...controls.production },
    financial: { ...controls.financial },
    ilaPlanning: {
      ...controls.ilaPlanning,
      stationOverrides: { ...(controls.ilaPlanning.stationOverrides ?? {}) },
    },
    constraints: { ...(controls.constraints ?? {}) },
    algorithmConstraints: { ...(controls.algorithmConstraints ?? {}) },
    humanAuditTrail: [...(controls.humanAuditTrail ?? [])],
  };
}

function patchNumber(patch: RouteEditPatch) {
  return typeof patch.value === "number" && Number.isFinite(patch.value) ? patch.value : 0;
}

function applyIlaPatch(controls: IlaPlanningControls, patch: RouteEditPatch): IlaPlanningControls {
  const next: IlaPlanningControls = {
    ...controls,
    stationOverrides: { ...(controls.stationOverrides ?? {}) },
  };
  if (patch.patchType === "REMOVE_BOOKEND") {
    next.useBookendIlas = false;
    next.bookendIlaEnabled = false;
  }
  if (patch.patchType === "RESTORE_BOOKEND") {
    next.useBookendIlas = true;
    next.bookendIlaEnabled = true;
  }
  if ((patch.patchType === "MOVE_ILA" || patch.patchType === "MOVE_BOOKEND") && patch.targetId) {
    next.selectedStationId = patch.targetId;
    next.stationOverrides = {
      ...(next.stationOverrides ?? {}),
      [patch.targetId]: {
        ...(next.stationOverrides?.[patch.targetId] ?? {}),
        ...(typeof patch.value === "number" ? { milepost: patch.value } : {}),
        ...(patch.facilityProfileId ? { facilityProfileId: patch.facilityProfileId } : {}),
      },
    };
  }
  if (patch.patchType === "REMOVE_ILA") {
    next.placementMethod = "INTERMEDIATE_COUNT";
    next.desiredIntermediateIlas = Math.max(0, next.desiredIntermediateIlas - 1);
  }
  if (patch.patchType === "RESTORE_ILA") {
    next.placementMethod = "INTERMEDIATE_COUNT";
    next.desiredIntermediateIlas = next.desiredIntermediateIlas + 1;
  }
  return next;
}

function applyEstimateControlPatch(controls: TransparentEstimateControls, patch: RouteEditPatch): TransparentEstimateControls {
  const next = cloneControls(controls);
  switch (patch.patchType) {
    case "CHANGE_PLOW_RATE":
      next.production.plowFeetPerDay = Math.max(0, Math.round(patchNumber(patch)));
      break;
    case "CHANGE_BORE_RATE":
      next.production.directionalBoreDirtFeetPerDay = Math.max(0, Math.round(patchNumber(patch)));
      break;
    case "CHANGE_TRENCH_RATE":
      next.production.openTrenchDirtFeetPerDay = Math.max(0, Math.round(patchNumber(patch)));
      break;
    case "CHANGE_ROCK_RATE":
      next.production.directionalBoreRockFeetPerDay = Math.max(0, Math.round(patchNumber(patch)));
      break;
    case "CHANGE_MONTHLY_REVENUE":
      next.financial.monthlyOmPerRouteMile = Math.max(0, patchNumber(patch));
      break;
    case "CHANGE_MARGIN_ASSUMPTION":
      next.financial.markupPercent = Math.max(0, patchNumber(patch));
      break;
    case "REMOVE_BOOKEND":
    case "RESTORE_BOOKEND":
    case "MOVE_BOOKEND":
    case "MOVE_ILA":
    case "REMOVE_ILA":
    case "RESTORE_ILA":
      next.ilaPlanning = applyIlaPatch(next.ilaPlanning, patch);
      break;
    default:
      break;
  }
  return next;
}

function constructionDeltaForPatch(patch: RouteEditPatch) {
  switch (patch.patchType) {
    case "ADD_MANUAL_COST_ADJUSTMENT":
      return patchNumber(patch);
    case "REMOVE_MANUAL_COST_ADJUSTMENT":
      return -Math.abs(patchNumber(patch));
    case "CHANGE_SEGMENT_UNIT_COST":
      return patchNumber(patch);
    case "CHANGE_PLOW_RATE":
    case "CHANGE_BORE_RATE":
    case "CHANGE_TRENCH_RATE":
    case "CHANGE_ROCK_RATE":
    case "CHANGE_CONSTRUCTION_MIX":
      return 0;
    case "REMOVE_BOOKEND":
    case "REMOVE_ILA":
      return -Math.abs(patchNumber(patch));
    case "RESTORE_BOOKEND":
    case "RESTORE_ILA":
      return Math.abs(patchNumber(patch));
    default:
      return 0;
  }
}

function monthlyRevenueDeltaForPatch(patch: RouteEditPatch) {
  return patch.patchType === "CHANGE_MONTHLY_REVENUE" ? patchNumber(patch) : 0;
}

function termMonthsDeltaForPatch(patch: RouteEditPatch) {
  return patch.patchType === "CHANGE_TERM_MONTHS" ? patchNumber(patch) : 0;
}

export function buildRouteEditProjection(session: Pick<RouteEditSession, "sessionId" | "routeId" | "baseEstimate" | "baseControls" | "patches">): RouteEditProjection {
  const warnings: string[] = [];
  const excludedStationIds = new Set<string>();
  const excludedSegmentIds = new Set<string>();
  const movedStationIds = new Set<string>();
  let projectedControls = cloneControls(session.baseControls);

  for (const patch of session.patches) {
    projectedControls = applyEstimateControlPatch(projectedControls, patch);
    if (patch.patchType === "REMOVE_BOOKEND") {
      session.baseEstimate.ilaPlan.stationObjects
        .filter((station) => station.stationType !== "INTERMEDIATE")
        .forEach((station) => excludedStationIds.add(station.stationId));
    }
    if (patch.patchType === "RESTORE_BOOKEND") {
      session.baseEstimate.ilaPlan.stationObjects
        .filter((station) => station.stationType !== "INTERMEDIATE")
        .forEach((station) => excludedStationIds.delete(station.stationId));
    }
    if (patch.patchType === "REMOVE_ILA" && patch.targetId) excludedStationIds.add(patch.targetId);
    if (patch.patchType === "RESTORE_ILA" && patch.targetId) excludedStationIds.delete(patch.targetId);
    if ((patch.patchType === "MOVE_ILA" || patch.patchType === "MOVE_BOOKEND") && patch.targetId) movedStationIds.add(patch.targetId);
    if (patch.patchType === "EXCLUDE_SEGMENT" && patch.targetId) excludedSegmentIds.add(patch.targetId);
    if (patch.patchType === "RESTORE_SEGMENT" && patch.targetId) excludedSegmentIds.delete(patch.targetId);
  }

  const basePlan = session.baseEstimate.ilaPlan;
  const visibleStations = basePlan.stationObjects
    .filter((station) => !excludedStationIds.has(station.stationId))
    .map((station) => {
      const override = projectedControls.ilaPlanning.stationOverrides?.[station.stationId];
      return override?.milepost !== undefined
        ? {
            ...station,
            milepost: override.milepost,
            ratio: basePlan.routeMiles ? Math.max(0, Math.min(1, override.milepost / basePlan.routeMiles)) : station.ratio,
            facilityProfileId: override.facilityProfileId ?? station.facilityProfileId,
          }
        : station;
    });
  const visibleStationIds = visibleStations.map((station) => station.stationId);
  const projectedSpans = basePlan.spans.filter((span) => (
    !excludedStationIds.has(span.fromStationId) &&
    !excludedStationIds.has(span.toStationId)
  ));
  const constructionCostDelta = session.patches.reduce((total, patch) => total + constructionDeltaForPatch(patch), 0);
  const monthlyRevenueDelta = session.patches.reduce((total, patch) => total + monthlyRevenueDeltaForPatch(patch), 0);
  const termMonthsDelta = session.patches.reduce((total, patch) => total + termMonthsDeltaForPatch(patch), 0);
  const marginDelta = session.patches.some((patch) => patch.patchType === "CHANGE_MARGIN_ASSUMPTION")
    ? projectedControls.financial.markupPercent - session.baseControls.financial.markupPercent
    : 0;
  const lifecycleValueDelta = monthlyRevenueDelta * Math.max(0, 36 + termMonthsDelta);
  const projectedEstimate: TransparentCorridorEstimate = {
    ...session.baseEstimate,
    controls: projectedControls,
    ilaPlan: {
      ...basePlan,
      controls: projectedControls.ilaPlanning,
      stationObjects: visibleStations,
      spans: projectedSpans,
      graphObjectCount: visibleStations.length,
      totalCost: visibleStations.reduce((total, station) => total + station.totalCost, 0),
    },
    ilaFacilities: session.baseEstimate.ilaFacilities.filter((facility) => visibleStationIds.includes(facility.graphNodeId) || visibleStationIds.includes(facility.facilityId)),
  };

  if (!projectedSpans.length && visibleStations.length > 1) {
    warnings.push("Route edit projection has visible stations but no visible spans; original route remains intact.");
  }

  return {
    projectionId: `ROUTE-EDIT-PROJECTION-${session.routeId}-${Date.now()}`,
    routeId: session.routeId,
    sourceSessionId: session.sessionId,
    projectedControls,
    projectedEstimate,
    visibleStationIds,
    excludedStationIds: [...excludedStationIds],
    excludedSegmentIds: [...excludedSegmentIds],
    movedStationIds: [...movedStationIds],
    estimateDelta: {
      constructionCostDelta,
      monthlyRevenueDelta,
      marginDelta,
      lifecycleValueDelta,
      termMonthsDelta,
    },
    impact: calculateRouteEditImpact(session.patches),
    warnings,
    noRepositoryCommit: true,
    repositoryTruthUnchanged: true,
  };
}
