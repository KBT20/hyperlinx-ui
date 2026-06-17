import type { DALCoordinate } from "../types/dal";

export type StreetClass = "Interstate" | "Highway" | "Arterial" | "Collector" | "Local" | "Private";

export type StreetCenterline = {
  streetId: string;
  streetName: string;
  streetClass: StreetClass;
  geometry: DALCoordinate[];
  lengthFeet: number;
  jurisdiction: string;
  speedLimit?: number;
  oneWay?: boolean;
  source?: "IMPORTED" | "DETERMINISTIC_CENTERLINE" | "MANUAL";
};

export type SnapAuthorityMethod =
  | "DIRECT_ROUTE_SNAP"
  | "STREET_CENTERLINE_SNAP"
  | "STATION_SNAP"
  | "NODE_SNAP"
  | "EDGE_SNAP"
  | "ROUTE_SEGMENT_SNAP"
  | "CERTIFIED_ATTACHMENT_SNAP"
  | "CONSTRUCTABILITY_AWARE_SNAP";

export type SnapAuthorityResult = {
  snapId?: string;
  snapAuthority: "STREET_CENTERLINE" | "INVENTORY_ROUTE" | "INVENTORY_STATION" | "INVENTORY_NODE" | "INVENTORY_EDGE";
  snapMethod: SnapAuthorityMethod;
  snapConfidence: number;
  streetId?: string;
  streetName?: string;
  streetClass?: StreetClass;
  snappedCoordinate: DALCoordinate;
  attachmentCoordinate: DALCoordinate;
  distanceToStreetFeet?: number;
  distanceToAttachmentFeet: number;
  snappedStreet?: string;
  snappedStreetClass?: StreetClass;
  constructabilityScore?: number;
  selectedAlternative?: "LOWEST_DISTANCE" | "LOWEST_CONFLICT" | "LOWEST_COST" | "ENGINEER_PREFERRED";
  selectedCandidateType?: string;
  selectedCandidateId?: string;
  stationId?: string;
  nodeId?: string;
  edgeId?: string;
  routeId?: string;
  routeSegmentId?: string;
  snapEvidence?: unknown;
  attachmentCandidates?: unknown[];
  attachmentCorridorEvidence?: unknown;
};

export type SnapCertificationState = "DRAFT_SNAP" | "REVIEW_SNAP" | "CERTIFIED_SNAP" | "REJECTED_SNAP";

export type SnapCertificationSnapshot = SnapAuthorityResult & {
  snapCertificationId: string;
  status: SnapCertificationState;
  engineerName: string;
  certifiedBy: string;
  certifiedAt?: string;
  certificationNotes: string;
  manuallyRelocated: boolean;
};
