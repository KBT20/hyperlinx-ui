import type { RuntimeTranslationCommitRequest, RuntimeValidationReport } from "./RuntimeObjectModel";
import type { ValidationStatus } from "../types/dal";

export type UniversalTranslationDomain =
  | "CUSTOMER_INVENTORY"
  | "CARRIER_INVENTORY"
  | "TERALINX_INVENTORY"
  | "COMMERCIAL_DESIGN"
  | "ENGINEERING_DESIGN";

export type UniversalEvidenceSourceType =
  | "KMZ"
  | "KML"
  | "CSV"
  | "GEOJSON"
  | "API"
  | "MANUAL"
  | "UNKNOWN";

export interface RuntimeEvidenceMetadata {
  sourceType: UniversalEvidenceSourceType | string;
  sourceName: string;
  sourceSystem: string;
  collectedAt: string;
  submittedBy: string;
  customerName?: string;
  accountId?: string;
  connectorId?: string;
  metadata?: Record<string, unknown>;
}

export interface ApiConnectorDefinition {
  connectorId: string;
  name: string;
  domain: UniversalTranslationDomain;
  sourceSystem: string;
  supportedEvidenceTypes: string[];
  authorityBoundary: "EVIDENCE_ONLY" | "READ_ONLY_RUNTIME" | "WRITE_REQUIRES_APPROVAL";
  authenticationMode: "NONE" | "TOKEN" | "OAUTH" | "SERVICE_ACCOUNT";
  status: "PLANNED" | "CONFIGURED" | "ACTIVE" | "DISABLED";
}

export interface UniversalTranslationContext {
  actor: string;
  domain: UniversalTranslationDomain;
  evidence: RuntimeEvidenceMetadata;
  commitToRuntime: boolean;
}

export interface UniversalTranslationAdapter<TInput> {
  adapterId: string;
  domain: UniversalTranslationDomain;
  sourceTypes: string[];
  normalize: (input: TInput, context: UniversalTranslationContext) => Promise<RuntimeTranslationCommitRequest> | RuntimeTranslationCommitRequest;
}

export interface UniversalTranslationPipelineResult {
  commit: RuntimeTranslationCommitRequest;
  validation: RuntimeValidationReport;
  canCommit: boolean;
}

function pipelineStatus(commit: RuntimeTranslationCommitRequest): ValidationStatus {
  if (!commit.evidence.length) return "FAIL";
  const reportStatus = commit.validationReports.map((report) => report.status);
  if (reportStatus.includes("FAIL")) return "FAIL";
  if (reportStatus.includes("WARNING")) return "WARNING";
  if (!commit.runtimeObjects.length) return "WARNING";
  return "PASS";
}

export async function runUniversalTranslationPipeline<TInput>(
  adapter: UniversalTranslationAdapter<TInput>,
  input: TInput,
  context: UniversalTranslationContext,
): Promise<UniversalTranslationPipelineResult> {
  const commit = await adapter.normalize(input, context);
  const status = pipelineStatus(commit);
  const validation: RuntimeValidationReport = {
    validationId: `${commit.commitId}-PIPELINE`,
    status,
    checks: [
      {
        checkId: "PIPELINE_EVIDENCE_PRESENT",
        status: commit.evidence.length ? "PASS" : "FAIL",
        message: "Runtime translation commits must include evidence.",
        details: { evidenceCount: commit.evidence.length },
      },
      {
        checkId: "PIPELINE_OBJECTS_PRESENT",
        status: commit.runtimeObjects.length ? "PASS" : "WARNING",
        message: "Runtime translation commits should produce runtime objects.",
        details: { objectCount: commit.runtimeObjects.length },
      },
      {
        checkId: "PIPELINE_RELATIONSHIPS_PRESENT",
        status: commit.relationships.length ? "PASS" : "WARNING",
        message: "Runtime translation commits should produce relationship graph edges.",
        details: { relationshipCount: commit.relationships.length },
      },
      {
        checkId: "PIPELINE_AUTHORITY_BOUNDARY",
        status: commit.connectors.every((connector) => connector.authorityBoundary === "EVIDENCE_ONLY") ? "PASS" : "WARNING",
        message: "Connector authority must be explicit before runtime commit.",
        details: { connectors: commit.connectors.map((connector) => connector.connectorId) },
      },
    ],
    validatedAt: new Date().toISOString(),
    metadata: {
      adapterId: adapter.adapterId,
      domain: adapter.domain,
      sourceTypes: adapter.sourceTypes,
    },
  };

  return {
    commit: {
      ...commit,
      validationReports: [...commit.validationReports, validation],
    },
    validation,
    canCommit: status !== "FAIL",
  };
}
