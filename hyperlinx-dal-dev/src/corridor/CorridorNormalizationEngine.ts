import {
  detectEvidenceConflicts,
  scoreCorridorEvidenceConfidence,
} from "./CorridorConfidenceEngine";
import type {
  ConflictRecord,
  CorridorEvidenceBundle,
  CorridorGeometryReference,
  CorridorNormalizedEvidence,
  CorridorNormalizedEvidenceEntityType,
  CorridorRawEvidenceInput,
} from "./CorridorNormalizedEvidence";

function stableHash(value: unknown) {
  const text = JSON.stringify(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function evidenceIdFor(input: CorridorRawEvidenceInput, entityType: CorridorNormalizedEvidenceEntityType) {
  return `EV-${entityType}-${input.entityId ?? stableHash(input.rawPayload ?? input.normalizedPayload ?? input.rawReference ?? input.sourceName)}`;
}

function entityIdFor(input: CorridorRawEvidenceInput, entityType: CorridorNormalizedEvidenceEntityType) {
  return input.entityId ?? `${entityType}-${stableHash(input.rawPayload ?? input.normalizedPayload ?? input.sourceName)}`;
}

function normalizeEvidence(input: CorridorRawEvidenceInput, entityType: CorridorNormalizedEvidenceEntityType): CorridorNormalizedEvidence {
  const normalizedPayload = {
    ...(input.rawPayload ?? {}),
    ...(input.normalizedPayload ?? {}),
  };
  const confidence = scoreCorridorEvidenceConfidence({
    sourceType: input.sourceType,
    explicitConfidence: input.confidence,
    hasGeometry: Boolean(input.geometryReference),
    hasEndpoint: entityType === "ENDPOINT",
    hasRequiredFields: Object.keys(normalizedPayload).length > 0,
    humanReviewed: input.humanReviewed,
    fieldValidated: input.fieldValidated,
    unknownGeometry: input.geometryReference?.geometryType === "LINESTRING"
      ? input.geometryReference.coordinates.length < 2
      : false,
  });

  return {
    evidenceId: evidenceIdFor(input, entityType),
    sourceType: input.sourceType,
    sourceName: input.sourceName,
    entityType,
    entityId: entityIdFor(input, entityType),
    confidence: confidence.score,
    collectedAt: input.collectedAt ?? new Date().toISOString(),
    normalizedPayload,
    rawReference: input.rawReference,
    geometryReference: input.geometryReference,
    notes: input.notes ?? confidence.warnings.join(", "),
  };
}

export function normalizeEndpointEvidence(inputs: CorridorRawEvidenceInput[]): CorridorNormalizedEvidence[] {
  return inputs.map((input) => normalizeEvidence(input, "ENDPOINT"));
}

export function normalizeRouteEvidence(inputs: CorridorRawEvidenceInput[]): CorridorNormalizedEvidence[] {
  return inputs.map((input) => {
    const normalized = normalizeEvidence(input, "ROUTE_CANDIDATE");
    if (normalized.geometryReference?.geometryType === "LINESTRING" && !normalized.geometryReference.geometryHash) {
      normalized.geometryReference = {
        ...normalized.geometryReference,
        geometryHash: stableHash(normalized.geometryReference.coordinates),
      };
    }
    return normalized;
  });
}

export function normalizeConstraintEvidence(inputs: CorridorRawEvidenceInput[]): CorridorNormalizedEvidence[] {
  return inputs.map((input) => normalizeEvidence(input, "CONSTRAINT"));
}

export function normalizeCrossingEvidence(inputs: CorridorRawEvidenceInput[]): CorridorNormalizedEvidence[] {
  return inputs.map((input) => normalizeEvidence(input, "CROSSING"));
}

export function normalizeJurisdictionEvidence(inputs: CorridorRawEvidenceInput[]): CorridorNormalizedEvidence[] {
  return inputs.map((input) => normalizeEvidence(input, "JURISDICTION"));
}

export function normalizePowerEvidence(inputs: CorridorRawEvidenceInput[]): CorridorNormalizedEvidence[] {
  return inputs.map((input) => normalizeEvidence(input, "POWER_ASSET"));
}

export function normalizeInterconnectionEvidence(inputs: CorridorRawEvidenceInput[]): CorridorNormalizedEvidence[] {
  return inputs.map((input) => normalizeEvidence(input, "INTERCONNECTION_NODE"));
}

export function normalizeRegenEvidence(inputs: CorridorRawEvidenceInput[]): CorridorNormalizedEvidence[] {
  return inputs.map((input) => normalizeEvidence(input, "REGEN_SITE"));
}

export function normalizeMonetizationEvidence(inputs: CorridorRawEvidenceInput[]): CorridorNormalizedEvidence[] {
  return inputs.map((input) => normalizeEvidence(input, "MONETIZATION_OPPORTUNITY"));
}

function byType(evidence: CorridorNormalizedEvidence[], entityType: CorridorNormalizedEvidenceEntityType) {
  return evidence.filter((item) => item.entityType === entityType);
}

export function createCorridorEvidenceBundle(args: {
  bundleId: string;
  corridorId?: string;
  evidence: CorridorNormalizedEvidence[];
  conflicts?: ConflictRecord[];
  createdAt?: string;
}): CorridorEvidenceBundle {
  const conflicts = args.conflicts ?? detectEvidenceConflicts(args.evidence);
  return {
    bundleId: args.bundleId,
    corridorId: args.corridorId,
    endpoints: byType(args.evidence, "ENDPOINT"),
    routes: byType(args.evidence, "ROUTE_CANDIDATE"),
    constraints: byType(args.evidence, "CONSTRAINT"),
    crossings: byType(args.evidence, "CROSSING"),
    jurisdictions: byType(args.evidence, "JURISDICTION"),
    power: byType(args.evidence, "POWER_ASSET"),
    interconnection: byType(args.evidence, "INTERCONNECTION_NODE"),
    regen: byType(args.evidence, "REGEN_SITE"),
    monetization: byType(args.evidence, "MONETIZATION_OPPORTUNITY"),
    evidence: args.evidence,
    conflicts,
    createdAt: args.createdAt ?? new Date().toISOString(),
  };
}

export function pointGeometry(longitude: number, latitude: number): CorridorGeometryReference {
  return {
    geometryType: "POINT",
    coordinate: [longitude, latitude],
  };
}

export function lineGeometry(coordinates: Array<[number, number]>): CorridorGeometryReference {
  return {
    geometryType: "LINESTRING",
    coordinates,
    geometryHash: stableHash(coordinates),
  };
}

