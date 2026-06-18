import type { DALCoordinate } from "../types/dal";

export type RouteAuthorityState =
  | "DRAFT_ROUTE"
  | "DIRECT_FALLBACK"
  | "ENGINEER_REVIEW_REQUIRED"
  | "PROVISIONALLY_CERTIFIED"
  | "CERTIFIED_ROUTE"
  | "REJECTED_ROUTE"
  | "BLOCKED";

export type RouteMode =
  | "DIRECT_FALLBACK"
  | "OSRM_ROUTE"
  | "ROAD_ROW"
  | "UTILITY_EASEMENT"
  | "EXISTING_TELECOM"
  | "RAIL_CORRIDOR"
  | "POWER_CORRIDOR"
  | "PRIVATE_EASEMENT"
  | "ENGINEER_DEFINED";

export type CorridorBasis =
  | "REFERENCE_ONLY"
  | "CANDIDATE_CORRIDOR"
  | "CERTIFIED_CORRIDOR"
  | "ENGINEER_DEFINED_CORRIDOR"
  | "UNKNOWN";

export type ConstraintEvidenceStatus = "MISSING" | "CURRENT" | "STALE" | "INCOMPLETE" | "UNKNOWN";

export type CrossingCount = number | "UNKNOWN";

export type CertifiedRouteCrossingSummary = {
  roadCrossings: CrossingCount;
  railCrossings: CrossingCount;
  waterCrossings: CrossingCount;
  parcelCrossings: CrossingCount;
  buildingConflicts: CrossingCount;
};

export type CertifiedRouteAuthorityFlags = {
  canGenerateAuthoritativeQuote: boolean;
  canCreateIOFPackage: boolean;
  canCreateControlWork: boolean;
  canCreateFieldWork: boolean;
  canMutateTwinPlannedState: boolean;
  requiredActions: string[];
  warnings: string[];
};

export type CertifiedRoute = {
  certifiedRouteId: string;
  routeAuthorityState: RouteAuthorityState;
  routeMode: RouteMode;
  corridorBasis: CorridorBasis;

  inventoryId: string;
  graphId: string;
  parentScopeVersionId?: string;
  scopeVersionId?: string;
  opportunitySeedId?: string;
  candidateSiteId?: string;

  candidateCoordinate: DALCoordinate;
  attachmentCoordinate: DALCoordinate;
  attachmentAuthorityId?: string;
  nearestRouteId?: string;
  nearestNodeId?: string;
  nearestStationId?: string;

  geometry: DALCoordinate[];
  geometryHash: string;
  routeFeet: number;
  routeMiles: number;
  crowFlyFeet: number;
  routeToCrowFlyRatio: number;

  constraintEvidenceId?: string;
  constraintEvidenceHash?: string;
  constraintEvidenceStatus: ConstraintEvidenceStatus;

  crossingSummary: CertifiedRouteCrossingSummary;

  constructabilityScore: number;
  riskScore: number;
  permitAuthorities: string[];

  certification: {
    certifiedBy?: string;
    certifiedAt?: string;
    certificationNotes?: string;
    provisionalReason?: string;
    rejectionReason?: string;
  };

  authority: CertifiedRouteAuthorityFlags;

  createdAt: string;
  updatedAt: string;
};

export type CertifiedRouteReference = {
  certifiedRouteId: string;
  geometryHash: string;
  routeAuthorityState: RouteAuthorityState;
  routeMode: RouteMode;
  routeFeet: number;
  routeMiles: number;
  constraintEvidenceId?: string;
};
