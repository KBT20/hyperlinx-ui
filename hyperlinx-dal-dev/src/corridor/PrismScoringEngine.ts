import {
  getCorridorObjectDefinition,
  type CorridorObjectDefinition,
  type CorridorObjectType,
} from "./CorridorObjectCatalog";
import type { EnrichedCorridorCandidate, EnrichmentCategory, EnrichmentFinding } from "./EnrichmentContract";
import { PRISM_DECISION_LAYER_ORDER, type PrismDecisionLayer } from "./PrismDecisionHierarchy";
import type {
  PrismCategoryScore,
  PrismEvidenceConfidence,
  PrismScore,
  PrismScoreCategory,
  PrismScoreDiagnostic,
  PrismScoreEvidence,
  PrismScoreSummary,
} from "./PrismScoreContract";

export interface PrismScoringInput {
  enrichedCandidate: EnrichedCorridorCandidate;
  corridorObjects: CorridorObjectType[];
  objectConfidence?: Partial<Record<CorridorObjectType, PrismEvidenceConfidence>>;
}

type CategoryImpact = Partial<Record<PrismScoreCategory, number>>;

const ALL_SCORE_CATEGORIES: PrismScoreCategory[] = [
  "INFRASTRUCTURE",
  "POWER",
  "INTERCONNECTION",
  "COMMERCIAL",
  "AI",
  "STRATEGIC",
  "ENGINEERING",
  "OPTIMIZATION",
];

const SCORE_CATEGORY_LAYER: Record<PrismScoreCategory, PrismDecisionLayer> = {
  INFRASTRUCTURE: "ENGINEERING",
  POWER: "STRATEGIC_FIT",
  INTERCONNECTION: "STRATEGIC_FIT",
  COMMERCIAL: "COMMERCIAL",
  AI: "STRATEGIC_FIT",
  STRATEGIC: "STRATEGIC_FIT",
  ENGINEERING: "ENGINEERING",
  OPTIMIZATION: "OPTIMIZATION",
};

const CONFIDENCE_VALUE: Record<PrismEvidenceConfidence, number> = {
  VERY_LOW: 0.2,
  LOW: 0.4,
  MEDIUM: 0.6,
  HIGH: 0.8,
  VERIFIED: 1,
};

const OBJECT_IMPACTS: Partial<Record<CorridorObjectType, CategoryImpact>> = {
  CONDUIT: { INFRASTRUCTURE: 18, OPTIMIZATION: 4 },
  INNERDUCT: { INFRASTRUCTURE: 12, COMMERCIAL: 6 },
  FIBER: { INFRASTRUCTURE: 14, COMMERCIAL: 12 },
  FIBER_PAIR: { INFRASTRUCTURE: 8, COMMERCIAL: 8 },
  SPLICE: { INFRASTRUCTURE: 4, OPTIMIZATION: 4 },
  HANDHOLE: { INFRASTRUCTURE: 6, ENGINEERING: 3 },
  MANHOLE: { INFRASTRUCTURE: 5, ENGINEERING: 2 },
  VAULT: { INFRASTRUCTURE: 6, INTERCONNECTION: 4 },
  REGEN_SITE: { INFRASTRUCTURE: 8, OPTIMIZATION: 8, POWER: 4 },
  ADM_SITE: { INFRASTRUCTURE: 8, OPTIMIZATION: 6, COMMERCIAL: 4 },
  POP: { INFRASTRUCTURE: 8, INTERCONNECTION: 6, STRATEGIC: 6 },
  SUBSTATION: { POWER: 18, AI: 12, STRATEGIC: 6 },
  TRANSMISSION_LINE: { POWER: 16, AI: 10, STRATEGIC: 4 },
  GENERATION_SITE: { POWER: 10, AI: 6 },
  POWER_FEED: { POWER: 10, ENGINEERING: 4 },
  POWER_CORRIDOR: { POWER: 12, AI: 8, OPTIMIZATION: 4 },
  DATA_CENTER: { INTERCONNECTION: 14, COMMERCIAL: 8, AI: 8, STRATEGIC: 6 },
  CARRIER_HOTEL: { INTERCONNECTION: 14, COMMERCIAL: 8, STRATEGIC: 8 },
  IX: { STRATEGIC: 12, INTERCONNECTION: 10, COMMERCIAL: 4 },
  CLOUD_ONRAMP: { INTERCONNECTION: 12, STRATEGIC: 8, COMMERCIAL: 6, AI: 4 },
  MEET_ME_ROOM: { INTERCONNECTION: 8, INFRASTRUCTURE: 4 },
  INTERCONNECT_FACILITY: { INTERCONNECTION: 8, STRATEGIC: 4 },
  PARCEL: { OPTIMIZATION: 5, ENGINEERING: 3 },
  DEVELOPMENT_SITE: { OPTIMIZATION: 8, COMMERCIAL: 5, AI: 5 },
  RIGHT_OF_WAY: { ENGINEERING: 6, OPTIMIZATION: 4 },
  UTILITY_EASEMENT: { ENGINEERING: 4, OPTIMIZATION: 3 },
  LSO: { STRATEGIC: 12, COMMERCIAL: 6 },
  CO: { STRATEGIC: 8, INTERCONNECTION: 4, COMMERCIAL: 4 },
  WIRELESS_SITE: { COMMERCIAL: 5, STRATEGIC: 3 },
  AGGREGATION_NODE: { STRATEGIC: 8, INFRASTRUCTURE: 5 },
  BACKBONE_NODE: { STRATEGIC: 12, INFRASTRUCTURE: 8, OPTIMIZATION: 4 },
  JURISDICTION: { ENGINEERING: -10 },
  CROSSING: { ENGINEERING: -12 },
  CONSTRAINT: { ENGINEERING: -14, OPTIMIZATION: -3 },
  ENVIRONMENTAL_AREA: { ENGINEERING: -20, OPTIMIZATION: -5 },
  PERMIT_ZONE: { ENGINEERING: -8 },
  MAINTENANCE_ZONE: { OPTIMIZATION: 4, ENGINEERING: 2 },
  RESTORATION_ZONE: { OPTIMIZATION: 5, ENGINEERING: 2 },
  DUCT_OPPORTUNITY: { COMMERCIAL: 14, INFRASTRUCTURE: 3 },
  DARK_FIBER_OPPORTUNITY: { COMMERCIAL: 14, INFRASTRUCTURE: 3 },
  TRANSPORT_OPPORTUNITY: { COMMERCIAL: 12, INTERCONNECTION: 4 },
  IRU_OPPORTUNITY: { COMMERCIAL: 12 },
  EXPANSION_OPPORTUNITY: { COMMERCIAL: 8, OPTIMIZATION: 8, AI: 4 },
};

const ENRICHMENT_CATEGORY_IMPACTS: Partial<Record<EnrichmentCategory, CategoryImpact>> = {
  POWER: { POWER: 5, AI: 3 },
  SUBSTATION: { POWER: 6, AI: 3 },
  TRANSMISSION: { POWER: 5, AI: 3 },
  GENERATION: { POWER: 4 },
  DATA_CENTER: { INTERCONNECTION: 5, COMMERCIAL: 3, AI: 3 },
  CARRIER_HOTEL: { INTERCONNECTION: 5, COMMERCIAL: 3, STRATEGIC: 3 },
  IX: { INTERCONNECTION: 4, STRATEGIC: 4 },
  CLOUD_ONRAMP: { INTERCONNECTION: 4, STRATEGIC: 3 },
  PARCEL: { OPTIMIZATION: 2, ENGINEERING: 1 },
  DEVELOPMENT_SITE: { OPTIMIZATION: 4, COMMERCIAL: 2, AI: 2 },
  JURISDICTION: { ENGINEERING: -3 },
  CROSSING: { ENGINEERING: -4 },
  CONSTRAINT: { ENGINEERING: -5 },
  UTILITY: { ENGINEERING: 2 },
  MONETIZATION: { COMMERCIAL: 5 },
  RESTORATION: { OPTIMIZATION: 3 },
  MAINTENANCE: { OPTIMIZATION: 3 },
  INTERCONNECTION: { INTERCONNECTION: 4 },
  REGEN: { OPTIMIZATION: 4, INFRASTRUCTURE: 2 },
  EXPANSION: { OPTIMIZATION: 4, COMMERCIAL: 2, AI: 2 },
};

const ROLE_IMPACTS: Record<string, CategoryImpact> = {
  AI_FABRIC: { STRATEGIC: 10, AI: 12, POWER: 4 },
  METRO_AGGREGATION: { STRATEGIC: 8, COMMERCIAL: 5, INFRASTRUCTURE: 3 },
  MSA_INTERCONNECT: { STRATEGIC: 6, OPTIMIZATION: 3 },
  BACKBONE_INTERCONNECT: { STRATEGIC: 8, OPTIMIZATION: 5, INFRASTRUCTURE: 4 },
  INTERCONNECTION: { STRATEGIC: 8, INTERCONNECTION: 8, COMMERCIAL: 4 },
  CAMPUS: { STRATEGIC: 5, INFRASTRUCTURE: 4, ENGINEERING: 2 },
  REGIONAL_AGGREGATION: { STRATEGIC: 5, COMMERCIAL: 3, OPTIMIZATION: 3 },
};

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function confidenceFromValue(value: number): PrismEvidenceConfidence {
  if (value >= 0.9) return "VERIFIED";
  if (value >= 0.75) return "HIGH";
  if (value >= 0.55) return "MEDIUM";
  if (value >= 0.35) return "LOW";
  return "VERY_LOW";
}

function confidenceValue(confidence: PrismEvidenceConfidence): number {
  return CONFIDENCE_VALUE[confidence];
}

function now(): string {
  return new Date().toISOString();
}

function diagnostic(input: {
  code: PrismScoreDiagnostic["code"];
  message: string;
  category?: PrismScoreCategory;
  candidateId?: string;
  severity?: PrismScoreDiagnostic["severity"];
  evidenceIds?: string[];
  details?: Record<string, unknown>;
}): PrismScoreDiagnostic {
  const result: PrismScoreDiagnostic = {
    diagnosticId: `${input.code.toLowerCase()}-${Math.random().toString(36).slice(2, 9)}`,
    code: input.code,
    severity: input.severity ?? "INFO",
    category: input.category,
    candidateId: input.candidateId,
    message: input.message,
    evidenceIds: input.evidenceIds ?? [],
    details: input.details,
  };

  const payload = {
    candidateId: result.candidateId,
    category: result.category,
    message: result.message,
    severity: result.severity,
    details: result.details,
  };

  if (result.severity === "ERROR") {
    console.error(`[${input.code}]`, payload);
  } else if (result.severity === "WARNING") {
    console.warn(`[${input.code}]`, payload);
  } else {
    console.log(`[${input.code}]`, payload);
  }

  return result;
}

function defaultImpactForDefinition(definition: CorridorObjectDefinition): CategoryImpact {
  if (definition.category === "INFRASTRUCTURE") return { INFRASTRUCTURE: 6 };
  if (definition.category === "POWER") return { POWER: 6 };
  if (definition.category === "INTERCONNECTION") return { INTERCONNECTION: 6 };
  if (definition.category === "PROPERTY") return { OPTIMIZATION: 3 };
  if (definition.category === "NETWORK") return { STRATEGIC: 5 };
  if (definition.category === "OPERATIONAL") return { ENGINEERING: -5 };
  if (definition.category === "MONETIZATION") return { COMMERCIAL: 6 };
  return {};
}

function addEvidence(
  bucket: Map<PrismScoreCategory, PrismScoreEvidence[]>,
  evidence: PrismScoreEvidence,
): void {
  const existing = bucket.get(evidence.category) ?? [];
  bucket.set(evidence.category, [...existing, evidence]);
}

function addImpactEvidence(input: {
  bucket: Map<PrismScoreCategory, PrismScoreEvidence[]>;
  impact: CategoryImpact;
  source: PrismScoreEvidence["source"];
  baseEvidenceId: string;
  confidence: PrismEvidenceConfidence;
  evidenceIds: string[];
  objectType?: CorridorObjectType;
  findingId?: string;
  notes?: string;
}): void {
  Object.entries(input.impact).forEach(([category, contribution]) => {
    const scoreCategory = category as PrismScoreCategory;
    addEvidence(input.bucket, {
      evidenceId: `${input.baseEvidenceId}-${scoreCategory.toLowerCase()}`,
      source: input.source,
      category: scoreCategory,
      objectType: input.objectType,
      findingId: input.findingId,
      evidenceIds: input.evidenceIds,
      confidence: input.confidence,
      confidenceValue: confidenceValue(input.confidence),
      contribution: contribution ?? 0,
      notes: input.notes,
    });
  });
}

function categoryWarnings(input: {
  category: PrismScoreCategory;
  evidence: PrismScoreEvidence[];
  conflictCount: number;
  missingEnrichmentWarnings: string[];
}): string[] {
  const warnings: string[] = [];
  if (input.evidence.length === 0) {
    warnings.push(`Missing ${input.category} evidence.`);
  }
  if (input.conflictCount > 0) {
    warnings.push(`${input.conflictCount} enrichment conflict(s) reduce confidence.`);
  }
  input.missingEnrichmentWarnings.forEach((warning) => warnings.push(warning));
  return warnings;
}

function scoreCategory(input: {
  category: PrismScoreCategory;
  candidateId: string;
  evidence: PrismScoreEvidence[];
  conflictCount: number;
  missingEnrichmentWarnings: string[];
}): PrismCategoryScore {
  const contributionTotal = input.evidence.reduce(
    (sum, evidence) => sum + evidence.contribution * evidence.confidenceValue,
    0,
  );
  const score = clampScore(50 + contributionTotal);
  const confidenceAverage =
    input.evidence.length > 0
      ? input.evidence.reduce((sum, evidence) => sum + evidence.confidenceValue, 0) / input.evidence.length
      : 0.2;
  const conflictPenalty = Math.min(0.35, input.conflictCount * 0.08);
  const confidenceValueResult = Math.max(0.1, Number((confidenceAverage - conflictPenalty).toFixed(2)));
  const confidence = confidenceFromValue(confidenceValueResult);
  const warnings = categoryWarnings(input);

  const diagnostics = [
    diagnostic({
      code: "PRISM_SCORE_CATEGORY",
      category: input.category,
      candidateId: input.candidateId,
      message: `Calculated ${input.category} score.`,
      evidenceIds: input.evidence.flatMap((evidence) => evidence.evidenceIds),
      details: {
        score,
        evidenceCount: input.evidence.length,
        contributionTotal: Number(contributionTotal.toFixed(2)),
      },
    }),
    diagnostic({
      code: "PRISM_SCORE_CONFIDENCE",
      category: input.category,
      candidateId: input.candidateId,
      message: `Calculated ${input.category} confidence.`,
      evidenceIds: input.evidence.flatMap((evidence) => evidence.evidenceIds),
      details: {
        confidence,
        confidenceValue: confidenceValueResult,
        conflictPenalty,
      },
    }),
  ];

  warnings.forEach((message) => {
    diagnostics.push(
      diagnostic({
        code: "PRISM_SCORE_WARNING",
        category: input.category,
        candidateId: input.candidateId,
        severity: "WARNING",
        message,
        evidenceIds: input.evidence.flatMap((evidence) => evidence.evidenceIds),
      }),
    );
  });

  if (input.conflictCount > 0) {
    diagnostics.push(
      diagnostic({
        code: "PRISM_SCORE_CONFLICT",
        category: input.category,
        candidateId: input.candidateId,
        severity: "WARNING",
        message: `Conflicts preserved for ${input.category}.`,
        evidenceIds: input.evidence.flatMap((evidence) => evidence.evidenceIds),
        details: {
          conflictCount: input.conflictCount,
        },
      }),
    );
  }

  return {
    category: input.category,
    decisionLayer: SCORE_CATEGORY_LAYER[input.category],
    score,
    confidence,
    confidenceValue: confidenceValueResult,
    evidenceCount: input.evidence.length,
    warnings,
    supportingObjectReferences: [
      ...new Set(input.evidence.map((evidence) => evidence.objectType).filter(Boolean) as CorridorObjectType[]),
    ],
    evidenceUsed: input.evidence,
    diagnostics,
  };
}

function enrichmentCategoryToScoreCategories(category: EnrichmentCategory): PrismScoreCategory[] {
  const impact = ENRICHMENT_CATEGORY_IMPACTS[category];
  if (!impact) return [];
  return Object.keys(impact) as PrismScoreCategory[];
}

function confidenceFromFinding(finding: EnrichmentFinding): PrismEvidenceConfidence {
  return confidenceFromValue(finding.confidence);
}

function evidenceFromObjects(input: PrismScoringInput, bucket: Map<PrismScoreCategory, PrismScoreEvidence[]>): PrismScoreDiagnostic[] {
  const diagnostics: PrismScoreDiagnostic[] = [];

  input.corridorObjects.forEach((objectType) => {
    const definition = getCorridorObjectDefinition(objectType);
    if (!definition) {
      diagnostics.push(
        diagnostic({
          code: "PRISM_SCORE_WARNING",
          candidateId: input.enrichedCandidate.candidate.candidateId,
          severity: "WARNING",
          message: `Unknown corridor object type ${objectType}.`,
          evidenceIds: [],
        }),
      );
      return;
    }

    const impact = OBJECT_IMPACTS[objectType] ?? defaultImpactForDefinition(definition);
    const confidence = input.objectConfidence?.[objectType] ?? "MEDIUM";
    addImpactEvidence({
      bucket,
      impact,
      source: "CORRIDOR_OBJECT",
      baseEvidenceId: `${input.enrichedCandidate.candidate.candidateId}-${objectType.toLowerCase()}`,
      confidence,
      objectType,
      evidenceIds: [`${objectType}-catalog-evidence`],
      notes: definition.description,
    });
  });

  return diagnostics;
}

function evidenceFromEnrichment(input: PrismScoringInput, bucket: Map<PrismScoreCategory, PrismScoreEvidence[]>): void {
  input.enrichedCandidate.enrichmentFindings.forEach((finding) => {
    const impact = ENRICHMENT_CATEGORY_IMPACTS[finding.category];
    if (!impact) return;
    addImpactEvidence({
      bucket,
      impact,
      source: "ENRICHMENT_FINDING",
      baseEvidenceId: finding.findingId,
      confidence: confidenceFromFinding(finding),
      findingId: finding.findingId,
      evidenceIds: finding.evidenceIds,
      notes: finding.notes,
    });
  });
}

function evidenceFromClassification(input: PrismScoringInput, bucket: Map<PrismScoreCategory, PrismScoreEvidence[]>): void {
  const impact = ROLE_IMPACTS[input.enrichedCandidate.classification.networkRole] ?? { STRATEGIC: 3 };
  addImpactEvidence({
    bucket,
    impact,
    source: "CORRIDOR_CLASSIFICATION",
    baseEvidenceId: `${input.enrichedCandidate.candidate.candidateId}-classification`,
    confidence: confidenceFromValue(input.enrichedCandidate.classification.confidence),
    evidenceIds: input.enrichedCandidate.classification.evidenceIds,
    notes: `${input.enrichedCandidate.classification.networkRole} classification context.`,
  });
}

function evidenceFromDecisionHierarchy(input: PrismScoringInput, bucket: Map<PrismScoreCategory, PrismScoreEvidence[]>): void {
  PRISM_DECISION_LAYER_ORDER.forEach((layer) => {
    const category = ALL_SCORE_CATEGORIES.find((scoreCategory) => SCORE_CATEGORY_LAYER[scoreCategory] === layer);
    if (!category) return;
    addEvidence(bucket, {
      evidenceId: `${input.enrichedCandidate.candidate.candidateId}-${layer.toLowerCase()}-context`,
      source: "DECISION_HIERARCHY",
      category,
      evidenceIds: [],
      confidence: "MEDIUM",
      confidenceValue: confidenceValue("MEDIUM"),
      contribution: 0,
      notes: `${layer} governs scoring context; no recommendation generated in Phase 6.3A.`,
    });
  });
}

function missingWarningsForCategory(input: {
  enrichedCandidate: EnrichedCorridorCandidate;
  category: PrismScoreCategory;
}): string[] {
  const matchingEnrichmentCategories = input.enrichedCandidate.enrichmentSummary.missingCategories.filter((category) =>
    enrichmentCategoryToScoreCategories(category).includes(input.category),
  );
  return matchingEnrichmentCategories.map((category) => `Missing enrichment category ${category}.`);
}

function conflictCountForCategory(input: {
  enrichedCandidate: EnrichedCorridorCandidate;
  category: PrismScoreCategory;
}): number {
  return input.enrichedCandidate.enrichmentFindings.filter(
    (finding) =>
      finding.conflictsWithFindingIds.length > 0 &&
      enrichmentCategoryToScoreCategories(finding.category).includes(input.category),
  ).length;
}

function summarize(categoryScores: PrismCategoryScore[], candidateId: string): PrismScoreSummary {
  const overallScore = clampScore(
    categoryScores.reduce((sum, categoryScore) => sum + categoryScore.score, 0) / categoryScores.length,
  );
  const confidenceValueResult = Number(
    (categoryScores.reduce((sum, categoryScore) => sum + categoryScore.confidenceValue, 0) / categoryScores.length).toFixed(2),
  );
  const confidence = confidenceFromValue(confidenceValueResult);
  const evidenceUsed = categoryScores.flatMap((categoryScore) => categoryScore.evidenceUsed);
  const warnings = [...new Set(categoryScores.flatMap((categoryScore) => categoryScore.warnings))];
  const diagnostics = [
    ...categoryScores.flatMap((categoryScore) => categoryScore.diagnostics),
    diagnostic({
      code: "PRISM_SCORE_CALCULATED",
      candidateId,
      message: "Calculated advisory Prism score summary.",
      evidenceIds: evidenceUsed.flatMap((evidence) => evidence.evidenceIds),
      details: {
        overallScore,
        confidence,
        categoryCount: categoryScores.length,
      },
    }),
  ];

  return {
    overallScore,
    categoryScores,
    confidence,
    confidenceValue: confidenceValueResult,
    warnings,
    evidenceUsed,
    diagnostics,
  };
}

export function scoreEnrichedCorridorCandidate(input: PrismScoringInput): PrismScore {
  const evidenceByCategory = new Map<PrismScoreCategory, PrismScoreEvidence[]>();
  const initialDiagnostics = evidenceFromObjects(input, evidenceByCategory);
  evidenceFromEnrichment(input, evidenceByCategory);
  evidenceFromClassification(input, evidenceByCategory);
  evidenceFromDecisionHierarchy(input, evidenceByCategory);

  const categoryScores = ALL_SCORE_CATEGORIES.map((category) => {
    const categoryScore = scoreCategory({
      category,
      candidateId: input.enrichedCandidate.candidate.candidateId,
      evidence: evidenceByCategory.get(category) ?? [],
      conflictCount: conflictCountForCategory({
        enrichedCandidate: input.enrichedCandidate,
        category,
      }),
      missingEnrichmentWarnings: missingWarningsForCategory({
        enrichedCandidate: input.enrichedCandidate,
        category,
      }),
    });

    if (initialDiagnostics.length > 0) {
      categoryScore.diagnostics = [...initialDiagnostics, ...categoryScore.diagnostics];
    }

    return categoryScore;
  });

  return {
    scoreId: `score-${input.enrichedCandidate.candidate.candidateId}`,
    corridorId: input.enrichedCandidate.candidate.corridorId,
    candidateId: input.enrichedCandidate.candidate.candidateId,
    scoredAt: now(),
    summary: summarize(categoryScores, input.enrichedCandidate.candidate.candidateId),
    doctrine: "PRISM_SCORING_IS_ADVISORY_ONLY",
  };
}

export function scoreEnrichedCorridorCandidates(inputs: PrismScoringInput[]): PrismScore[] {
  return inputs.map((input) => scoreEnrichedCorridorCandidate(input));
}

