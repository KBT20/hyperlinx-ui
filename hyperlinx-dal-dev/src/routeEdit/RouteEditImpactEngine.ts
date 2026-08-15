import type {
  RouteEditImpactDomain,
  RouteEditImpactReport,
  RouteEditPatch,
} from "./RouteEditSession";

function unique<T>(items: T[]) {
  return [...new Set(items)];
}

function affectedDomainsForPatch(patch: RouteEditPatch): RouteEditImpactDomain[] {
  switch (patch.patchType) {
    case "REMOVE_BOOKEND":
    case "RESTORE_BOOKEND":
    case "MOVE_BOOKEND":
      return ["MAP_PROJECTION", "ROUTE_SUMMARY", "ENDPOINT_SPAN", "ILA_SPANS", "ESTIMATE_COST", "PROPOSAL_PREVIEW"];
    case "MOVE_ILA":
    case "REMOVE_ILA":
    case "RESTORE_ILA":
      return ["MAP_PROJECTION", "ILA_SPANS", "ESTIMATE_COST", "PROPOSAL_PREVIEW"];
    case "CHANGE_PLOW_RATE":
    case "CHANGE_BORE_RATE":
    case "CHANGE_TRENCH_RATE":
    case "CHANGE_ROCK_RATE":
    case "CHANGE_CONSTRUCTION_MIX":
    case "CHANGE_SEGMENT_UNIT_COST":
      return ["ESTIMATE_COST", "FINANCIAL_MODEL", "WORKBOOK_SECTION", "PROPOSAL_PREVIEW"];
    case "CHANGE_MARGIN_ASSUMPTION":
    case "CHANGE_MONTHLY_REVENUE":
    case "CHANGE_TERM_MONTHS":
      return ["FINANCIAL_MODEL", "WORKBOOK_SECTION", "PROPOSAL_PREVIEW"];
    case "EXCLUDE_SEGMENT":
    case "RESTORE_SEGMENT":
      return ["MAP_PROJECTION", "ROUTE_SUMMARY", "ESTIMATE_COST", "WORKBOOK_SECTION", "PROPOSAL_PREVIEW"];
    case "ADD_MANUAL_COST_ADJUSTMENT":
    case "REMOVE_MANUAL_COST_ADJUSTMENT":
      return ["ESTIMATE_COST", "FINANCIAL_MODEL", "WORKBOOK_SECTION", "PROPOSAL_PREVIEW"];
    default:
      return ["WORKBOOK_SECTION"];
  }
}

function sectionForPatch(patch: RouteEditPatch) {
  switch (patch.patchType) {
    case "REMOVE_BOOKEND":
    case "RESTORE_BOOKEND":
    case "MOVE_BOOKEND":
      return ["Bookends", "Endpoint spans", "Route summary", "Estimate delta"];
    case "MOVE_ILA":
    case "REMOVE_ILA":
    case "RESTORE_ILA":
      return ["ILA facilities", "Affected spans", "Optical preview", "Estimate delta"];
    case "CHANGE_PLOW_RATE":
      return ["Plow rate", "Construction cost", "Margin"];
    case "CHANGE_BORE_RATE":
      return ["Bore rate", "Construction cost", "Margin"];
    case "CHANGE_TRENCH_RATE":
      return ["Trench rate", "Construction cost", "Margin"];
    case "CHANGE_ROCK_RATE":
      return ["Rock rate", "Construction cost", "Margin"];
    case "CHANGE_CONSTRUCTION_MIX":
      return ["Construction mix", "Construction cost", "Margin"];
    case "CHANGE_MONTHLY_REVENUE":
      return ["Monthly revenue", "Lifecycle value", "Margin"];
    case "CHANGE_MARGIN_ASSUMPTION":
      return ["Margin", "Sell price", "Lifecycle value"];
    case "CHANGE_TERM_MONTHS":
      return ["Term months", "Lifecycle value"];
    case "EXCLUDE_SEGMENT":
    case "RESTORE_SEGMENT":
      return ["Segment projection", "Route summary", "Estimate delta"];
    case "ADD_MANUAL_COST_ADJUSTMENT":
    case "REMOVE_MANUAL_COST_ADJUSTMENT":
      return ["Manual cost adjustment", "Construction cost", "Margin"];
    default:
      return ["Route edit"];
  }
}

function recalculationBoundaryForPatch(patch: RouteEditPatch): RouteEditImpactReport["recalculationBoundary"] {
  if (["MOVE_ILA", "REMOVE_ILA", "RESTORE_ILA", "REMOVE_BOOKEND", "RESTORE_BOOKEND", "MOVE_BOOKEND"].includes(patch.patchType)) {
    return "AFFECTED_SPANS_ONLY";
  }
  if (patch.patchType.startsWith("CHANGE_") || patch.patchType.includes("COST_ADJUSTMENT")) return "ESTIMATE_DOMAIN_ONLY";
  return "PATCH_ONLY";
}

export function calculateRouteEditImpact(patches: RouteEditPatch[]): RouteEditImpactReport {
  const newestBoundary = patches.reduce<RouteEditImpactReport["recalculationBoundary"]>((current, patch) => {
    const next = recalculationBoundaryForPatch(patch);
    if (next === "AFFECTED_SPANS_ONLY") return next;
    if (next === "ESTIMATE_DOMAIN_ONLY" && current === "PATCH_ONLY") return next;
    return current;
  }, "PATCH_ONLY");
  return {
    impactId: `ROUTE-EDIT-IMPACT-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    patchIds: patches.map((patch) => patch.patchId),
    affectedDomains: unique(patches.flatMap(affectedDomainsForPatch)),
    affectedSections: unique(patches.flatMap(sectionForPatch)),
    affectedStationIds: unique(patches.map((patch) => patch.targetId).filter((id): id is string => Boolean(id?.startsWith("ILA")))),
    affectedSpanIds: unique(patches.flatMap((patch) => patch.affectedSpanIds ?? [])),
    recalculationBoundary: newestBoundary,
    fullRouteRebuild: false,
    fullWorkbookRecalculation: false,
    inventoryReimport: false,
    kmzProjectionRebuild: false,
    mapFullRerender: false,
  };
}
