export type RouteRedlineActionType =
  | "MOVE_SEGMENT"
  | "ADD_VIA_POINT"
  | "REMOVE_VIA_POINT"
  | "AVOID_AREA"
  | "PREFER_CORRIDOR"
  | "LOCK_SEGMENT"
  | "UNLOCK_SEGMENT"
  | "MARK_REVIEW_REQUIRED";

export type RouteRedlineSnapStatus = "OSRM_RESNAPPED" | "SNAP_PENDING" | "MANUAL_GEOMETRY" | "SNAP_FAILED" | "BLOCKED";

export interface RouteRedlineAnchorPoint {
  anchorId: string;
  label: string;
  longitude: number;
  latitude: number;
  role: "START" | "VIA" | "END" | "AVOID_VERTEX" | "LOCKED_SEGMENT";
}

export interface RouteAvoidanceArea {
  avoidanceAreaId: string;
  label: string;
  polygon: Array<[number, number]>;
  reason: string;
  snapStatus: RouteRedlineSnapStatus;
}
