import type { ProviderEvidenceResult, ProviderType } from "../providers/ProviderContract";
import type { CorridorCandidate } from "./CorridorCandidate";
import type { CorridorClassificationResult } from "./CorridorClassificationEngine";

export type EnrichmentCategory =
  | "POWER"
  | "SUBSTATION"
  | "TRANSMISSION"
  | "GENERATION"
  | "DATA_CENTER"
  | "CARRIER_HOTEL"
  | "IX"
  | "CLOUD_ONRAMP"
  | "PARCEL"
  | "DEVELOPMENT_SITE"
  | "JURISDICTION"
  | "CROSSING"
  | "CONSTRAINT"
  | "UTILITY"
  | "MONETIZATION"
  | "RESTORATION"
  | "MAINTENANCE"
  | "INTERCONNECTION"
  | "REGEN"
  | "EXPANSION";

export type EnrichmentStatus =
  | "NOT_STARTED"
  | "REQUESTED"
  | "EVIDENCE_AVAILABLE"
  | "ENRICHED"
  | "PARTIAL"
  | "FAILED"
  | "NOT_AVAILABLE";

export type EnrichmentDiagnosticCode =
  | "EVIDENCE_ENRICHMENT_STARTED"
  | "EVIDENCE_ENRICHMENT_TARGET_SELECTED"
  | "EVIDENCE_ENRICHMENT_PROVIDER_EVIDENCE_MERGED"
  | "EVIDENCE_ENRICHMENT_FINDING_CREATED"
  | "EVIDENCE_ENRICHMENT_MISSING_CATEGORY"
  | "EVIDENCE_ENRICHMENT_CONFLICT"
  | "EVIDENCE_ENRICHMENT_COMPLETE"
  | "EVIDENCE_ENRICHMENT_WARNING"
  | "EVIDENCE_ENRICHMENT_ERROR";

export interface EnrichmentTarget {
  category: EnrichmentCategory;
  required: boolean;
  reason: string;
}

export interface EnrichmentDiagnostic {
  code: EnrichmentDiagnosticCode;
  candidateId?: string;
  category?: EnrichmentCategory;
  message: string;
  severity: "INFO" | "WARNING" | "ERROR";
  timestamp: string;
  details?: Record<string, unknown>;
}

export interface EnrichmentWarning {
  warningId: string;
  category?: EnrichmentCategory;
  message: string;
  evidenceIds: string[];
  providerIds: string[];
}

export interface EnrichmentFinding {
  findingId: string;
  candidateId: string;
  category: EnrichmentCategory;
  providerId: string;
  providerType: ProviderType;
  sourceResultId: string;
  confidence: number;
  evidenceIds: string[];
  rawReference?: unknown;
  value: unknown;
  notes?: string;
  conflictsWithFindingIds: string[];
}

export interface EnrichmentRequest {
  requestId: string;
  candidateIds: string[];
  targets: EnrichmentTarget[];
  providerEvidenceResults: ProviderEvidenceResult[];
  createdAt: string;
}

export interface EnrichmentSummary {
  status: EnrichmentStatus;
  targetCategories: Record<EnrichmentCategory, number>;
  findingCountsByCategory: Record<EnrichmentCategory, number>;
  missingCategories: EnrichmentCategory[];
  conflictCount: number;
  averageConfidence: number;
  powerAssets: number;
  substations: number;
  transmissionAssets: number;
  dataCenters: number;
  carrierHotels: number;
  cloudOnRamps: number;
  parcels: number;
  developmentSites: number;
  jurisdictions: number;
  crossings: number;
  constraints: number;
  monetizationOpportunities: number;
  maintenanceFindings: number;
  restorationFindings: number;
}

export interface EnrichmentResult {
  requestId: string;
  status: EnrichmentStatus;
  findings: EnrichmentFinding[];
  summary: EnrichmentSummary;
  warnings: EnrichmentWarning[];
  diagnostics: EnrichmentDiagnostic[];
}

export interface EnrichedCorridorCandidate {
  candidate: CorridorCandidate;
  classification: CorridorClassificationResult;
  enrichmentFindings: EnrichmentFinding[];
  enrichmentSummary: EnrichmentSummary;
  warnings: EnrichmentWarning[];
  diagnostics: EnrichmentDiagnostic[];
}
