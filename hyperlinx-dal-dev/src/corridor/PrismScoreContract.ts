import type { CorridorObjectType } from "./CorridorObjectCatalog";
import type { PrismDecisionLayer } from "./PrismDecisionHierarchy";

export type PrismScoreCategory =
  | "INFRASTRUCTURE"
  | "POWER"
  | "INTERCONNECTION"
  | "COMMERCIAL"
  | "AI"
  | "STRATEGIC"
  | "ENGINEERING"
  | "OPTIMIZATION";

export type PrismEvidenceConfidence = "VERY_LOW" | "LOW" | "MEDIUM" | "HIGH" | "VERIFIED";

export interface PrismScoreEvidence {
  evidenceId: string;
  source:
    | "CORRIDOR_OBJECT"
    | "ENRICHMENT_FINDING"
    | "CORRIDOR_CLASSIFICATION"
    | "DECISION_HIERARCHY";
  category: PrismScoreCategory;
  objectType?: CorridorObjectType;
  findingId?: string;
  evidenceIds: string[];
  confidence: PrismEvidenceConfidence;
  confidenceValue: number;
  contribution: number;
  notes?: string;
}

export interface PrismScoreDiagnostic {
  diagnosticId: string;
  code:
    | "PRISM_SCORE_CALCULATED"
    | "PRISM_SCORE_WARNING"
    | "PRISM_SCORE_CONFLICT"
    | "PRISM_SCORE_CONFIDENCE"
    | "PRISM_SCORE_CATEGORY";
  severity: "INFO" | "WARNING" | "ERROR";
  category?: PrismScoreCategory;
  candidateId?: string;
  message: string;
  evidenceIds: string[];
  details?: Record<string, unknown>;
}

export interface PrismCategoryScore {
  category: PrismScoreCategory;
  decisionLayer: PrismDecisionLayer;
  score: number;
  confidence: PrismEvidenceConfidence;
  confidenceValue: number;
  evidenceCount: number;
  warnings: string[];
  supportingObjectReferences: CorridorObjectType[];
  evidenceUsed: PrismScoreEvidence[];
  diagnostics: PrismScoreDiagnostic[];
}

export interface PrismScoreSummary {
  overallScore: number;
  categoryScores: PrismCategoryScore[];
  confidence: PrismEvidenceConfidence;
  confidenceValue: number;
  warnings: string[];
  evidenceUsed: PrismScoreEvidence[];
  diagnostics: PrismScoreDiagnostic[];
}

export interface PrismScore {
  scoreId: string;
  corridorId: string;
  candidateId: string;
  scoredAt: string;
  summary: PrismScoreSummary;
  doctrine: "PRISM_SCORING_IS_ADVISORY_ONLY";
}

