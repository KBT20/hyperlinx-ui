import type {
  TransparentCorridorEstimate,
  TransparentEstimateControls,
} from "../commercial/TransparentEstimatingEngine";
import type { IlaFacilityProfileId } from "../commercial/IlaPlanningEngine";
import type { DALCoordinate } from "../types/dal";
import { buildRouteEditProjection } from "./RouteEditProjection";

export type RouteEditPatchType =
  | "REMOVE_BOOKEND"
  | "RESTORE_BOOKEND"
  | "MOVE_BOOKEND"
  | "MOVE_ILA"
  | "REMOVE_ILA"
  | "RESTORE_ILA"
  | "CHANGE_PLOW_RATE"
  | "CHANGE_BORE_RATE"
  | "CHANGE_TRENCH_RATE"
  | "CHANGE_ROCK_RATE"
  | "CHANGE_CONSTRUCTION_MIX"
  | "CHANGE_SEGMENT_UNIT_COST"
  | "EXCLUDE_SEGMENT"
  | "RESTORE_SEGMENT"
  | "ADD_MANUAL_COST_ADJUSTMENT"
  | "REMOVE_MANUAL_COST_ADJUSTMENT"
  | "CHANGE_MARGIN_ASSUMPTION"
  | "CHANGE_MONTHLY_REVENUE"
  | "CHANGE_TERM_MONTHS";

export type RouteEditPatch = {
  patchId: string;
  patchType: RouteEditPatchType;
  createdAt: string;
  createdBy: string;
  routeId: string;
  targetId?: string;
  label: string;
  reason?: string;
  value?: number | string | boolean | null;
  coordinate?: DALCoordinate | null;
  facilityProfileId?: IlaFacilityProfileId;
  previousValue?: number | string | boolean | null;
  affectedSpanIds?: string[];
  noRepositoryCommit: true;
};

export type RouteEditImpactDomain =
  | "MAP_PROJECTION"
  | "ROUTE_SUMMARY"
  | "ENDPOINT_SPAN"
  | "ILA_SPANS"
  | "ESTIMATE_COST"
  | "FINANCIAL_MODEL"
  | "WORKBOOK_SECTION"
  | "PROPOSAL_PREVIEW";

export type RouteEditImpactReport = {
  impactId: string;
  patchIds: string[];
  affectedDomains: RouteEditImpactDomain[];
  affectedSections: string[];
  affectedStationIds: string[];
  affectedSpanIds: string[];
  recalculationBoundary: "PATCH_ONLY" | "AFFECTED_SPANS_ONLY" | "ESTIMATE_DOMAIN_ONLY";
  fullRouteRebuild: false;
  fullWorkbookRecalculation: false;
  inventoryReimport: false;
  kmzProjectionRebuild: false;
  mapFullRerender: false;
};

export type RouteEditProjection = {
  projectionId: string;
  routeId: string;
  sourceSessionId: string;
  projectedControls: TransparentEstimateControls;
  projectedEstimate: TransparentCorridorEstimate;
  visibleStationIds: string[];
  excludedStationIds: string[];
  excludedSegmentIds: string[];
  movedStationIds: string[];
  estimateDelta: {
    constructionCostDelta: number;
    monthlyRevenueDelta: number;
    marginDelta: number;
    lifecycleValueDelta: number;
    termMonthsDelta: number;
  };
  impact: RouteEditImpactReport;
  warnings: string[];
  noRepositoryCommit: true;
  repositoryTruthUnchanged: true;
};

export type RouteEditFailure = {
  failureId: string;
  patchId: string;
  patchType: RouteEditPatchType;
  message: string;
  timestamp: string;
  operatorSafeMessage: string;
};

export type RouteEditSession = {
  sessionId: string;
  routeId: string;
  opportunityId?: string | null;
  routeRepositoryId?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  status: "ACTIVE" | "SAVED" | "DISCARDED" | "FAILED_PATCH";
  assembledRouteSnapshot: {
    routeId: string;
    routeMiles: number;
    routeFeet: number;
    stationCount: number;
    spanCount: number;
    geometryVertexCount: number;
    estimateId: string;
  };
  baseControls: TransparentEstimateControls;
  baseEstimate: TransparentCorridorEstimate;
  patches: RouteEditPatch[];
  failedPatches: RouteEditFailure[];
  projection: RouteEditProjection;
  repositoryTruthUnchanged: true;
  noAutoSave: true;
  noScopeVersionCreation: true;
  noInventoryMutation: true;
};

export type RouteEditRevisionRecord = {
  routeEditRevisionId: string;
  sessionId: string;
  opportunityId?: string | null;
  routeId: string;
  routeRepositoryId?: string | null;
  committedAt: string;
  committedBy: string;
  patchCount: number;
  patches: RouteEditPatch[];
  impact: RouteEditImpactReport;
  patchSetOnly: true;
  assembledRouteEmbedded: false;
  repositoryTruthUnchangedUntilExplicitSave: true;
  noScopeVersionCreation: true;
  noInventoryMutation: true;
};

export function routeEditPatchId(type: RouteEditPatchType) {
  return `ROUTE-EDIT-PATCH-${type}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createRouteEditPatch(input: Omit<RouteEditPatch, "patchId" | "createdAt" | "noRepositoryCommit"> & { patchId?: string; createdAt?: string }): RouteEditPatch {
  return {
    ...input,
    patchId: input.patchId ?? routeEditPatchId(input.patchType),
    createdAt: input.createdAt ?? new Date().toISOString(),
    noRepositoryCommit: true,
  };
}

export function createRouteEditSession(input: {
  routeId: string;
  opportunityId?: string | null;
  routeRepositoryId?: string | null;
  estimate: TransparentCorridorEstimate;
  controls: TransparentEstimateControls;
  createdBy: string;
  geometryVertexCount?: number;
}): RouteEditSession {
  const now = new Date().toISOString();
  const sessionShell = {
    sessionId: `ROUTE-EDIT-SESSION-${input.routeId}-${Date.now()}`,
    routeId: input.routeId,
    opportunityId: input.opportunityId ?? null,
    routeRepositoryId: input.routeRepositoryId ?? null,
    createdAt: now,
    updatedAt: now,
    createdBy: input.createdBy,
    status: "ACTIVE" as const,
    assembledRouteSnapshot: {
      routeId: input.routeId,
      routeMiles: input.estimate.physicalQuantities.routeMiles,
      routeFeet: input.estimate.physicalQuantities.routeFeet,
      stationCount: input.estimate.ilaPlan.stationObjects.length,
      spanCount: input.estimate.ilaPlan.spans.length,
      geometryVertexCount: input.geometryVertexCount ?? 0,
      estimateId: input.estimate.estimateId,
    },
    baseControls: input.controls,
    baseEstimate: input.estimate,
    patches: [],
    failedPatches: [],
    repositoryTruthUnchanged: true as const,
    noAutoSave: true as const,
    noScopeVersionCreation: true as const,
    noInventoryMutation: true as const,
  };
  return {
    ...sessionShell,
    projection: buildRouteEditProjection(sessionShell),
  };
}
