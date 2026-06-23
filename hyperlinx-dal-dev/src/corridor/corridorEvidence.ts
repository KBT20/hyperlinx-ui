import type {
  CorridorEvidence,
  CorridorEvidenceEntityType,
  CorridorEvidenceSourceType,
} from "./corridorTypes";

export const CORRIDOR_EVIDENCE_DOCTRINE = {
  evidenceIsAuthority: false,
  preservesConflicts: true,
  requiresHumanOverrideEvidence: true,
  certifiedTruthReferencesEvidence: true,
} as const;

export type CorridorEvidenceDraft = {
  evidenceId: string;
  sourceType: CorridorEvidenceSourceType;
  sourceName: string;
  entityType: CorridorEvidenceEntityType;
  entityId: string;
  confidence?: number;
  rawReference?: string;
  normalizedValue?: unknown;
  notes?: string;
  collectedAt?: string;
};

export function normalizeEvidenceConfidence(confidence?: number) {
  if (!Number.isFinite(confidence)) return 0;
  return Math.max(0, Math.min(100, Number(confidence)));
}

export function createCorridorEvidence(draft: CorridorEvidenceDraft): CorridorEvidence {
  return {
    evidenceId: draft.evidenceId,
    sourceType: draft.sourceType,
    sourceName: draft.sourceName,
    collectedAt: draft.collectedAt ?? new Date().toISOString(),
    confidence: normalizeEvidenceConfidence(draft.confidence),
    entityType: draft.entityType,
    entityId: draft.entityId,
    rawReference: draft.rawReference,
    normalizedValue: draft.normalizedValue,
    notes: draft.notes,
  };
}

export function evidenceSupportsEntity(
  evidence: CorridorEvidence,
  entityType: CorridorEvidenceEntityType,
  entityId: string
) {
  return evidence.entityType === entityType && evidence.entityId === entityId;
}

