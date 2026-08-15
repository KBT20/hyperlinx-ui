import type { RouteEditPatch } from "../routeEdit";
import type { CommercialPatch, CommercialPatchType, CommercialPatchValue } from "./CommercialChangeSet";
import { createCommercialPatch } from "./CommercialPatchValidator";

function constructionPercentType(patch: RouteEditPatch): CommercialPatchType {
  const label = patch.label.toLowerCase();
  if (label.includes("plow")) return "CHANGE_PLOW_PERCENT";
  if (label.includes("bore")) return "CHANGE_BORE_PERCENT";
  if (label.includes("trench") || label.includes("open cut")) return "CHANGE_TRENCH_PERCENT";
  if (label.includes("rock")) return "CHANGE_ROCK_PERCENT";
  return "CHANGE_CONSTRUCTION_METHOD";
}

export function commercialPatchTypeFromRouteEditPatch(patch: RouteEditPatch): CommercialPatchType {
  switch (patch.patchType) {
    case "REMOVE_BOOKEND":
      return "REMOVE_BOOKEND";
    case "RESTORE_BOOKEND":
      return "RESTORE_BOOKEND";
    case "MOVE_BOOKEND":
      return "MOVE_ILA";
    case "MOVE_ILA":
      return "MOVE_ILA";
    case "REMOVE_ILA":
      return "REMOVE_ILA";
    case "RESTORE_ILA":
      return "RESTORE_ILA";
    case "CHANGE_PLOW_RATE":
    case "CHANGE_BORE_RATE":
    case "CHANGE_TRENCH_RATE":
    case "CHANGE_ROCK_RATE":
      return patch.label.toLowerCase().includes("strategy") || patch.label.toLowerCase().includes("geology") || patch.label.toLowerCase().includes("constraint")
        ? constructionPercentType(patch)
        : patch.patchType === "CHANGE_PLOW_RATE"
          ? "CHANGE_PLOW_RATE"
          : patch.patchType === "CHANGE_BORE_RATE"
            ? "CHANGE_BORE_RATE"
            : patch.patchType === "CHANGE_ROCK_RATE"
              ? "CHANGE_ROCK_PERCENT"
              : "CHANGE_CONSTRUCTION_METHOD";
    case "CHANGE_CONSTRUCTION_MIX":
      return "CHANGE_CONSTRUCTION_METHOD";
    case "CHANGE_SEGMENT_UNIT_COST":
      return "CHANGE_SEGMENT_TYPE";
    case "CHANGE_MARGIN_ASSUMPTION":
      return patch.label.toLowerCase().includes("markup") ? "CHANGE_MARKUP" : "CHANGE_MARGIN_ASSUMPTION";
    case "CHANGE_MONTHLY_REVENUE":
      return "CHANGE_MONTHLY_REVENUE";
    case "CHANGE_TERM_MONTHS":
      return "CHANGE_MAX_SPAN";
    case "EXCLUDE_SEGMENT":
      return "CHANGE_SEGMENT_TYPE";
    case "RESTORE_SEGMENT":
      return "CHANGE_SEGMENT_TYPE";
    case "ADD_MANUAL_COST_ADJUSTMENT":
      return "CHANGE_CONTINGENCY";
    case "REMOVE_MANUAL_COST_ADJUSTMENT":
      return "CHANGE_CONTINGENCY";
    default:
      return "CHANGE_CONSTRUCTION_METHOD";
  }
}

export function commercialPatchFromRouteEditPatch(input: {
  revisionId: string;
  patch: RouteEditPatch;
  oldValue?: CommercialPatchValue;
}): CommercialPatch {
  const targetProperty = String(input.patch.targetId ?? input.patch.facilityProfileId ?? input.patch.patchType);
  return createCommercialPatch({
    patchId: `COMMERCIAL-${input.patch.patchId}`,
    revisionId: input.revisionId,
    patchType: commercialPatchTypeFromRouteEditPatch(input.patch),
    targetObjectId: String(input.patch.targetId ?? input.patch.routeId),
    targetProperty,
    oldValue: input.oldValue ?? input.patch.previousValue ?? null,
    newValue: input.patch.coordinate
      ? { coordinate: input.patch.coordinate, value: input.patch.value ?? null }
      : input.patch.value ?? input.patch.facilityProfileId ?? null,
    createdBy: input.patch.createdBy,
    createdAt: input.patch.createdAt,
    reason: input.patch.reason ?? input.patch.label,
  });
}
