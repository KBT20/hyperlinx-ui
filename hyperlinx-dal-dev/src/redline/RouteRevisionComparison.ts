import type { RouteRevision } from "./RouteRevision";

export interface RouteRevisionComparison {
  comparisonId: string;
  routeRequirementId?: string;
  originalLabel: string;
  revisedLabel: string;
  revision: RouteRevision;
  readyForVendorResponsePreview: boolean;
  summaryLines: string[];
}

export function buildRouteRevisionComparison(revision: RouteRevision, routeRequirementId?: string): RouteRevisionComparison {
  return {
    comparisonId: `COMPARE-${revision.revisionId}`,
    routeRequirementId,
    originalLabel: revision.parentCenterlineRouteId,
    revisedLabel: revision.centerlineRouteId ?? revision.revisionId,
    revision,
    readyForVendorResponsePreview: revision.selectedForProposal && revision.snapStatus === "OSRM_RESNAPPED",
    summaryLines: [
      `Mileage change ${revision.delta.mileDelta.toFixed(2)} mi`,
      `Cost change ${Math.round(revision.delta.estimatedCostDelta).toLocaleString()}`,
      `Crossing change ${revision.delta.crossingDelta}`,
    ],
  };
}
