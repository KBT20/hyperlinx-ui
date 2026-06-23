import type { CorridorCandidate } from "./CorridorCandidate";

export type PrismScoreCategory =
  | "LATENCY"
  | "RELIABILITY"
  | "DIVERSITY"
  | "CONSTRUCTABILITY"
  | "POWER"
  | "INTERCONNECTION"
  | "EXPANSION"
  | "MONETIZATION"
  | "COST"
  | "RISK"
  | "OPERATIONAL_MAINTAINABILITY"
  | "RESTORATION_COMPLEXITY"
  | "JURISDICTION_COMPLEXITY"
  | "RESIDUAL_ASSET_VALUE"
  | "FUTURE_CAPACITY_EXPANSION"
  | "HYPERSCALER_ALIGNMENT";

export type PrismRecommendationLevel =
  | "RECOMMENDED"
  | "ACCEPTABLE"
  | "CONDITIONAL"
  | "NOT_RECOMMENDED"
  | "REJECTED";

export interface PrismScoreComponent {
  componentId: string;
  category: PrismScoreCategory;
  label: string;
  score?: number;
  weightPercent: number;
  evidenceIds: string[];
  notes?: string;
}

export interface PrismScoreProfile {
  profileId: string;
  displayName: string;
  customerSegment:
    | "HYPERSCALER"
    | "NEOCLOUD"
    | "LONG_HAUL"
    | "MIDDLE_MILE"
    | "METRO"
    | "TRANSPORT"
    | "DARK_FIBER"
    | "DUCT";
  weights: Record<PrismScoreCategory, number>;
  doctrineNotes: string;
}

export interface PrismCandidateScore {
  candidateId: string;
  profileId: string;
  scoringState: "UNSCORED" | "EVIDENCE_READY" | "SCORED" | "REVIEW_REQUIRED";
  components: PrismScoreComponent[];
  totalScore?: number;
  evidenceIds: string[];
  diagnostics: PrismScoringDiagnostic[];
}

export interface PrismCandidateRecommendation {
  candidateId: string;
  profileId: string;
  recommendation: PrismRecommendationLevel;
  recommendationSummary: string;
  rationaleEvidenceIds: string[];
  requiredHumanReview: boolean;
  blockers: PrismScoringDiagnostic[];
}

export interface PrismEvaluationResult {
  evaluationId: string;
  corridorId: string;
  profileId: string;
  candidates: CorridorCandidate[];
  candidateScores: PrismCandidateScore[];
  recommendations: PrismCandidateRecommendation[];
  ranking: Array<{
    candidateId: string;
    rank: number;
    totalScore?: number;
    recommendation: PrismRecommendationLevel;
  }>;
  evaluatedAt: string;
  doctrine: "PRISM_RECOMMENDS_ROUTE_ENGINEERING_APPROVES";
}

export interface PrismScoringDiagnostic {
  diagnosticId: string;
  severity: "INFO" | "WARNING" | "BLOCKING";
  category?: PrismScoreCategory;
  code: string;
  message: string;
  candidateId?: string;
  evidenceIds: string[];
}

