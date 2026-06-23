import type { CorridorCoordinate } from "./corridorTypes";
import type { CorridorEvidenceSourceType } from "./CorridorEvidenceRegistry";

export type CorridorNormalizedEvidenceEntityType =
  | "CORRIDOR"
  | "ENDPOINT"
  | "ROUTE_CANDIDATE"
  | "CONSTRAINT"
  | "CROSSING"
  | "JURISDICTION"
  | "POWER_ASSET"
  | "INTERCONNECTION_NODE"
  | "REGEN_SITE"
  | "MONETIZATION_OPPORTUNITY";

export type CorridorGeometryReference =
  | {
      geometryType: "POINT";
      coordinate: CorridorCoordinate;
    }
  | {
      geometryType: "LINESTRING";
      coordinates: CorridorCoordinate[];
      geometryHash?: string;
    }
  | {
      geometryType: "POLYGON";
      rings: CorridorCoordinate[][];
      geometryHash?: string;
    };

export interface CorridorNormalizedEvidence {
  evidenceId: string;
  sourceType: CorridorEvidenceSourceType;
  sourceName: string;
  entityType: CorridorNormalizedEvidenceEntityType;
  entityId: string;
  confidence: number;
  collectedAt: string;
  normalizedPayload: Record<string, unknown>;
  rawReference?: string;
  geometryReference?: CorridorGeometryReference;
  notes?: string;
}

export interface CorridorEvidenceBundle {
  bundleId: string;
  corridorId?: string;
  endpoints: CorridorNormalizedEvidence[];
  routes: CorridorNormalizedEvidence[];
  constraints: CorridorNormalizedEvidence[];
  crossings: CorridorNormalizedEvidence[];
  jurisdictions: CorridorNormalizedEvidence[];
  power: CorridorNormalizedEvidence[];
  interconnection: CorridorNormalizedEvidence[];
  regen: CorridorNormalizedEvidence[];
  monetization: CorridorNormalizedEvidence[];
  evidence: CorridorNormalizedEvidence[];
  conflicts: ConflictRecord[];
  createdAt: string;
}

export interface ConflictRecord {
  conflictId: string;
  severity: "INFO" | "WARNING" | "BLOCKING";
  entityType: CorridorNormalizedEvidenceEntityType;
  entityId?: string;
  field: string;
  sourceA: string;
  sourceB: string;
  valueA: unknown;
  valueB: unknown;
  resolutionRecommendation: string;
}

export interface CorridorRawEvidenceInput {
  sourceType: CorridorEvidenceSourceType;
  sourceName: string;
  entityType: CorridorNormalizedEvidenceEntityType;
  entityId?: string;
  collectedAt?: string;
  rawReference?: string;
  rawPayload?: Record<string, unknown>;
  normalizedPayload?: Record<string, unknown>;
  geometryReference?: CorridorGeometryReference;
  notes?: string;
  confidence?: number;
  humanReviewed?: boolean;
  fieldValidated?: boolean;
}

