import type {
  ConduitSystem,
  Constraint,
  Corridor,
  CorridorEndpoint,
  CorridorEvidence,
  CorridorEvidenceEntityType,
  CorridorRequirement,
  CorridorRouteCandidate,
  Crossing,
  FiberSystem,
  Jurisdiction,
  OpticalSystem,
} from "./corridorTypes";

export type CorridorPromotionStatus =
  | "DRAFT"
  | "EVIDENCE_COLLECTING"
  | "EVIDENCE_READY"
  | "ENGINEERING_REVIEW"
  | "PROMOTION_READY"
  | "PROMOTED"
  | "REJECTED"
  | "SUPERSEDED";

export type CorridorPromotionEvidenceCategory =
  | "ENDPOINT"
  | "ROUTE"
  | "REQUIREMENT"
  | "BUILDABILITY"
  | "INFRASTRUCTURE_ASSUMPTION"
  | "HUMAN_APPROVAL";

export interface CorridorPromotionEvidenceRequirement {
  requirementId: string;
  category: CorridorPromotionEvidenceCategory;
  code: string;
  description: string;
  entityType?: CorridorEvidenceEntityType;
  entityId?: string;
  required: boolean;
  satisfiedByEvidenceId?: string;
}

export interface CorridorPromotionBlocker {
  blockerId: string;
  code: string;
  severity: "INFO" | "WARNING" | "BLOCKING";
  message: string;
  entityId?: string;
  evidenceId?: string;
}

export interface CorridorPromotionState {
  promotionId: string;
  corridorId: string;
  routeCandidateId: string;
  targetScopeVersionId?: string;
  state: CorridorPromotionStatus;
  requiredEvidence: CorridorPromotionEvidenceRequirement[];
  satisfiedEvidenceIds: string[];
  blockers: CorridorPromotionBlocker[];
  reviewedBy?: string;
  reviewedAt?: string;
  promotedAt?: string;
  rejectedAt?: string;
  notes?: string;
}

export interface CorridorPromotionInput {
  promotionId?: string;
  corridor: Corridor;
  routeCandidate?: CorridorRouteCandidate;
  endpoints: CorridorEndpoint[];
  requirements?: CorridorRequirement[];
  evidence: CorridorEvidence[];
  conduitSystems?: ConduitSystem[];
  fiberSystems?: FiberSystem[];
  opticalSystems?: OpticalSystem[];
  jurisdictions?: Jurisdiction[];
  crossings?: Crossing[];
  constraints?: Constraint[];
  reviewedBy?: string;
  reviewedAt?: string;
  approvalEvidenceId?: string;
  duplicateActiveScopeVersionId?: string;
  routeConfidenceThreshold?: number;
}

export interface CorridorPromotionEvaluation {
  promotionId: string;
  corridorId: string;
  routeCandidateId: string;
  status: CorridorPromotionStatus;
  readyForPromotion: boolean;
  blockers: CorridorPromotionBlocker[];
  satisfiedEvidenceIds: string[];
  missingEvidence: CorridorPromotionEvidenceRequirement[];
  warnings: CorridorPromotionBlocker[];
}

export interface CorridorScopeVersionDraft {
  draftId: string;
  corridorId: string;
  routeCandidateId: string;
  lifecycleState: "ANALYZED";
  source: "CORRIDOR_PROMOTION_DRAFT";
  corridorName: string;
  customerType: Corridor["customerType"];
  designObjective: string;
  endpointReferences: Array<{
    endpointId: string;
    role: CorridorEndpoint["role"];
    name: string;
    latitude?: number;
    longitude?: number;
  }>;
  route: {
    geometry: CorridorRouteCandidate["geometry"];
    distanceMiles: number;
    buildFeet: number;
    source: CorridorRouteCandidate["source"];
    routeClass: CorridorRouteCandidate["routeClass"];
    routeEvidenceIds: string[];
    candidateRouteName: string;
  };
  requirements: CorridorRequirement[];
  infrastructureAssumptions: {
    conduitSystemIds: string[];
    fiberSystemIds: string[];
    opticalSystemIds: string[];
    ductCount?: number;
    fiberCount?: number;
    transportAssumption?: string;
    regenRequired?: boolean;
  };
  riskBasis: {
    jurisdictionIds: string[];
    crossingIds: string[];
    constraintIds: string[];
    constructabilityScore?: number;
    permitRisk?: number;
  };
  evidenceIds: string[];
  promotion: {
    promotionId: string;
    status: CorridorPromotionStatus;
    readyForPromotion: boolean;
    blockerCodes: string[];
  };
}

export const CORRIDOR_PROMOTION_STATE_ORDER: CorridorPromotionStatus[] = [
  "DRAFT",
  "EVIDENCE_COLLECTING",
  "EVIDENCE_READY",
  "ENGINEERING_REVIEW",
  "PROMOTION_READY",
  "PROMOTED",
  "REJECTED",
  "SUPERSEDED",
];

