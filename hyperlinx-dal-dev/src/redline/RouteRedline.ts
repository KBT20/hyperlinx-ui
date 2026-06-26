import type { DALCoordinate } from "../types/dal";
import type { RouteAvoidanceArea, RouteRedlineActionType, RouteRedlineAnchorPoint, RouteRedlineSnapStatus } from "./RouteRedlineAction";

export interface RouteRedline {
  redlineId: string;
  sourceRouteCandidateId: string;
  sourceCenterlineRouteId: string;
  proposedGraphId: string;
  actionType: RouteRedlineActionType;
  actor: string;
  reason: string;
  createdAt: string;
  affectedSegmentIds: string[];
  protectedSegmentIds: string[];
  anchorPoints: RouteRedlineAnchorPoint[];
  avoidanceAreas: RouteAvoidanceArea[];
  dragPath: DALCoordinate[];
  snapStatus: RouteRedlineSnapStatus;
  notes: string[];
}
