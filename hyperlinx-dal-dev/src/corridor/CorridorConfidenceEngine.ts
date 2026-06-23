import type { CorridorEvidenceSourceType } from "./CorridorEvidenceRegistry";
import { getCorridorEvidenceSourceDefinition } from "./CorridorEvidenceRegistry";
import type { ConflictRecord, CorridorNormalizedEvidence } from "./CorridorNormalizedEvidence";

export type CorridorConfidenceCategory = "VERY_LOW" | "LOW" | "MEDIUM" | "HIGH" | "VERIFIED";

export interface CorridorConfidenceInput {
  sourceType: CorridorEvidenceSourceType;
  explicitConfidence?: number;
  hasGeometry?: boolean;
  hasEndpoint?: boolean;
  hasRequiredFields?: boolean;
  humanReviewed?: boolean;
  fieldValidated?: boolean;
  conflictCount?: number;
  unknownGeometry?: boolean;
}

export interface CorridorConfidenceScore {
  score: number;
  category: CorridorConfidenceCategory;
  warnings: string[];
}

function clampConfidence(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function corridorConfidenceCategory(score: number): CorridorConfidenceCategory {
  if (score >= 90) return "VERIFIED";
  if (score >= 75) return "HIGH";
  if (score >= 50) return "MEDIUM";
  if (score >= 25) return "LOW";
  return "VERY_LOW";
}

export function scoreCorridorEvidenceConfidence(input: CorridorConfidenceInput): CorridorConfidenceScore {
  const definition = getCorridorEvidenceSourceDefinition(input.sourceType);
  const warnings: string[] = [];
  let score = Number.isFinite(input.explicitConfidence)
    ? Number(input.explicitConfidence)
    : definition.defaultConfidence;

  if (input.hasGeometry && definition.supportsGeometry) score += 5;
  if (input.hasEndpoint && definition.supportsEndpoints) score += 5;
  if (input.hasRequiredFields) score += 6;
  if (input.humanReviewed) score += 12;
  if (input.fieldValidated) score += 15;
  if (input.unknownGeometry) {
    score -= 18;
    warnings.push("UNKNOWN_GEOMETRY");
  }
  if ((input.conflictCount ?? 0) > 0) {
    const penalty = Math.min(30, Number(input.conflictCount) * 10);
    score -= penalty;
    warnings.push("CONFLICTING_EVIDENCE");
    console.warn("[CORRIDOR_EVIDENCE_CONFLICT]", {
      sourceType: input.sourceType,
      conflictCount: input.conflictCount,
      confidencePenalty: penalty,
    });
  }

  const normalized = clampConfidence(score);
  const result = {
    score: normalized,
    category: corridorConfidenceCategory(normalized),
    warnings,
  };

  console.log("[CORRIDOR_CONFIDENCE_SCORE]", {
    sourceType: input.sourceType,
    authorityLevel: definition.authorityLevel,
    ...result,
  });
  if (result.category === "VERIFIED") {
    console.log("[CORRIDOR_EVIDENCE_VERIFIED]", {
      sourceType: input.sourceType,
      score: result.score,
    });
  }

  return result;
}

function valuesConflict(valueA: unknown, valueB: unknown) {
  if (valueA === undefined || valueB === undefined) return false;
  return JSON.stringify(valueA) !== JSON.stringify(valueB);
}

function geometryConflict(a: CorridorNormalizedEvidence, b: CorridorNormalizedEvidence) {
  if (!a.geometryReference || !b.geometryReference) return false;
  return JSON.stringify(a.geometryReference) !== JSON.stringify(b.geometryReference);
}

function normalizedFieldValue(evidence: CorridorNormalizedEvidence, field: string) {
  return evidence.normalizedPayload[field];
}

function conflictId(entityType: string, entityId: string | undefined, field: string, sourceA: string, sourceB: string) {
  return `conflict-${entityType.toLowerCase()}-${entityId ?? "unknown"}-${field.toLowerCase()}-${sourceA.toLowerCase()}-${sourceB.toLowerCase()}`;
}

export function detectEvidenceConflicts(evidence: CorridorNormalizedEvidence[]): ConflictRecord[] {
  const conflicts: ConflictRecord[] = [];
  for (let i = 0; i < evidence.length; i += 1) {
    for (let j = i + 1; j < evidence.length; j += 1) {
      const sourceA = evidence[i];
      const sourceB = evidence[j];
      if (!sourceA || !sourceB) continue;
      if (sourceA.entityType !== sourceB.entityType) continue;
      if (sourceA.entityId !== sourceB.entityId) continue;

      if (geometryConflict(sourceA, sourceB)) {
        conflicts.push({
          conflictId: conflictId(sourceA.entityType, sourceA.entityId, "geometry", sourceA.sourceType, sourceB.sourceType),
          severity: "WARNING",
          entityType: sourceA.entityType,
          entityId: sourceA.entityId,
          field: "geometry",
          sourceA: sourceA.evidenceId,
          sourceB: sourceB.evidenceId,
          valueA: sourceA.geometryReference,
          valueB: sourceB.geometryReference,
          resolutionRecommendation: "Preserve both geometries and require human engineering review before promotion.",
        });
      }

      for (const field of ["owner", "capacity", "jurisdiction", "role", "address"]) {
        const valueA = normalizedFieldValue(sourceA, field);
        const valueB = normalizedFieldValue(sourceB, field);
        if (valuesConflict(valueA, valueB)) {
          conflicts.push({
            conflictId: conflictId(sourceA.entityType, sourceA.entityId, field, sourceA.sourceType, sourceB.sourceType),
            severity: "WARNING",
            entityType: sourceA.entityType,
            entityId: sourceA.entityId,
            field,
            sourceA: sourceA.evidenceId,
            sourceB: sourceB.evidenceId,
            valueA,
            valueB,
            resolutionRecommendation: "Preserve both evidence records and require source comparison or human review.",
          });
        }
      }
    }
  }

  for (const conflict of conflicts) {
    console.warn("[CORRIDOR_EVIDENCE_CONFLICT]", conflict);
  }

  return conflicts;
}

