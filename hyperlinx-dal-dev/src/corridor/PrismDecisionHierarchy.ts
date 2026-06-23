import type { EnrichedCorridorCandidate, EnrichmentCategory } from "./EnrichmentContract";
import type { PrismScoreCategory } from "./PrismScoringContract";

export type PrismDecisionLayer =
  | "HARD_EXCLUSION"
  | "STRATEGIC_FIT"
  | "COMMERCIAL"
  | "ENGINEERING"
  | "OPTIMIZATION";

export type HardExclusionResult = "PASS" | "FAIL" | "REVIEW_REQUIRED";
export type StrategicFitResult = "STRONG" | "MODERATE" | "WEAK";
export type CommercialPotentialResult = "HIGH" | "MEDIUM" | "LOW";
export type EngineeringFeasibilityResult = "FAVORABLE" | "NEUTRAL" | "UNFAVORABLE";
export type OptimizationResult = "OPTIMAL" | "GOOD" | "ACCEPTABLE";

export type PrismDecisionLayerResult =
  | HardExclusionResult
  | StrategicFitResult
  | CommercialPotentialResult
  | EngineeringFeasibilityResult
  | OptimizationResult;

export type PrismDecisionPrecedence =
  | "BLOCKS_LOWER_LAYERS"
  | "GOVERNS_LOWER_LAYERS"
  | "INFORMS_LOWER_LAYERS";

export interface PrismDecisionFinding {
  findingId: string;
  candidateId: string;
  layer: PrismDecisionLayer;
  result: PrismDecisionLayerResult;
  label: string;
  summary: string;
  evidenceIds: string[];
  enrichmentCategories: EnrichmentCategory[];
  scoringCategories: PrismScoreCategory[];
  confidence: number;
  requiresReview: boolean;
}

export interface PrismDecisionConflict {
  conflictId: string;
  candidateId: string;
  layer: PrismDecisionLayer;
  conflictType:
    | "POWER_AVAILABILITY"
    | "PARCEL"
    | "JURISDICTION"
    | "INTERCONNECTION"
    | "COMMERCIAL"
    | "ENGINEERING"
    | "ENVIRONMENTAL"
    | "OTHER";
  description: string;
  evidenceIds: string[];
  findingIds: string[];
  confidenceImpact: "LOWER_CONFIDENCE" | "REVIEW_REQUIRED" | "BLOCKING_REVIEW";
  resolutionPolicy: "PRESERVE_ALL_EVIDENCE" | "HUMAN_REVIEW_REQUIRED";
}

export interface PrismDecisionDiagnostic {
  diagnosticId: string;
  candidateId?: string;
  layer?: PrismDecisionLayer;
  severity: "INFO" | "WARNING" | "BLOCKING";
  code: string;
  message: string;
  evidenceIds: string[];
}

export interface PrismDecisionResult {
  candidateId: string;
  layer: PrismDecisionLayer;
  result: PrismDecisionLayerResult;
  precedence: PrismDecisionPrecedence;
  findings: PrismDecisionFinding[];
  conflicts: PrismDecisionConflict[];
  diagnostics: PrismDecisionDiagnostic[];
  confidence: number;
}

export interface PrismDecisionSummary {
  decisionId: string;
  corridorId: string;
  candidateId: string;
  evaluatedCandidate?: EnrichedCorridorCandidate;
  hardExclusion: HardExclusionResult;
  strategicFit: StrategicFitResult;
  commercialPotential: CommercialPotentialResult;
  engineeringFeasibility: EngineeringFeasibilityResult;
  optimization: OptimizationResult;
  blockedByLayer?: PrismDecisionLayer;
  reviewRequired: boolean;
  layerResults: PrismDecisionResult[];
  conflicts: PrismDecisionConflict[];
  diagnostics: PrismDecisionDiagnostic[];
  doctrine: "PRISM_HIERARCHY_GOVERNS_SCORING";
}

export const PRISM_DECISION_LAYER_ORDER: readonly PrismDecisionLayer[] = Object.freeze([
  "HARD_EXCLUSION",
  "STRATEGIC_FIT",
  "COMMERCIAL",
  "ENGINEERING",
  "OPTIMIZATION",
]);

