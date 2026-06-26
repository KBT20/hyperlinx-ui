import type { DALCoordinate } from "../types/dal";
import type { RouteRedline } from "./RouteRedline";
import type { RouteRedlineSnapStatus } from "./RouteRedlineAction";
import type { RouteRevisionDelta } from "./RouteRevisionDelta";

export type RouteRevisionStatus =
  | "DRAFT"
  | "READY_FOR_REVIEW"
  | "SELECTED_FOR_PROPOSAL"
  | "REJECTED"
  | "SUPERSEDED"
  | "PENDING_ENGINEERING_VERIFICATION";

export interface RouteRevision {
  revisionId: string;
  parentRouteCandidateId: string;
  parentCenterlineRouteId: string;
  proposedGraphId: string;
  revisionNumber: number;
  revisionName: string;
  revisionStatus: RouteRevisionStatus;
  revisionReason: string;
  geometry: DALCoordinate[];
  centerlineRouteId?: string;
  stationedCorridorId?: string;
  takeoffId?: string;
  civilMixEstimateId?: string;
  quotePreviewId?: string;
  redlineActions: RouteRedline[];
  delta: RouteRevisionDelta;
  createdBy: string;
  createdAt: string;
  selectedForProposal: boolean;
  engineeringStatus: "PENDING_ENGINEERING_VERIFICATION";
  snapStatus: RouteRedlineSnapStatus;
}
