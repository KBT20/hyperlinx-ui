import type { AppliedDesignDoctrine } from "../designDoctrine/DesignDoctrine";
import type { NetworkClass } from "../designDoctrine/NetworkClass";
import type { ProtectionClass } from "../designDoctrine/ProtectionClass";
import type { TopologyClass } from "../designDoctrine/TopologyClass";
import type { DALCoordinate } from "../types/dal";
import type { RouteConstraint, EngineeringConstraintCandidate } from "./RouteConstraint";
import type { RouteGenerationDiagnostic } from "./RouteGenerationDiagnostics";
import type { RouteSegment } from "./RouteSegment";
import type { RouteStatistics } from "./RouteStatistics";

export type RouteCandidateNodeType =
  | "A_SITE"
  | "Z_SITE"
  | "INTERMEDIATE_SITE"
  | "VAULT"
  | "REGENERATION_SITE"
  | "CABINET"
  | "ROUTE_POINT";

export interface RouteCandidateNode {
  nodeId: string;
  nodeType: RouteCandidateNodeType;
  name: string;
  coordinate: DALCoordinate;
  stationLabel: string;
  estimatedCost: number;
  confidence: number;
  metadata: Record<string, unknown>;
  estimatedOnly: true;
}

export interface RouteCandidate {
  routeCandidateId: string;
  sourceDesignLaunchId: string;
  designDoctrineId: string;
  networkClass: NetworkClass;
  topology: TopologyClass;
  protectionClass: ProtectionClass;
  geometry: DALCoordinate[];
  nodes: RouteCandidateNode[];
  segments: RouteSegment[];
  constraints: RouteConstraint[];
  engineeringConstraintCandidates: EngineeringConstraintCandidate[];
  statistics: RouteStatistics;
  estimatedConstructionProfile: AppliedDesignDoctrine["constructionProfileId"];
  estimatedMaterialProfile: AppliedDesignDoctrine["materialProfileId"];
  estimatedFacilityProfile: AppliedDesignDoctrine["facilityProfileId"];
  generatedAt: string;
  diagnostics: RouteGenerationDiagnostic[];
  salesEstimate: true;
  engineeringCertificationRequired: true;
  noScopeVersionCreation: true;
  noInventoryMutation: true;
  noPersistence: true;
}
