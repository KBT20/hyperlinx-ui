import type { DraftIofPackageRuntime } from "../api/teralinxRuntime";
import type { EngineeringCertificationProjection, EngineeringComplianceRow } from "./EngineeringCertificationProjection";

export type EngineeringIssueClassification =
  | "ENGINEERING_DECISION"
  | "DERIVED_SYSTEM_VALIDATION"
  | "PACKAGE_DATA_DEFECT"
  | "IMPLEMENTATION_DEFECT"
  | "INFORMATIONAL";

export type EngineeringIssueOwner =
  | "ENGINEERING"
  | "COMMERCIAL"
  | "SYSTEM"
  | "PRODUCT_DOCTRINE"
  | "PACKAGE_PRODUCER"
  | "IMPLEMENTATION";

export type EngineeringResolutionType =
  | "ENGINEERING_DISPOSITION"
  | "AUTOMATIC_REEVALUATION"
  | "CORRECT_SOURCE_AUTHORITY"
  | "CORRECT_IMPLEMENTATION"
  | "NO_ACTION";

export interface EngineeringFailureAuthorityIssue {
  issueId: string;
  issueType: string;
  classification: EngineeringIssueClassification;
  title: string;
  humanReadableReason: string;
  sourceAuthority: string;
  sourceArtifactId: string;
  sourceRevision: string;
  sourceHash: string;
  validator: string;
  predicate: string;
  expected: string;
  actual: string;
  blocking: boolean;
  humanActionRequired: boolean;
  dependentOn: string[];
  resolutionOwner: EngineeringIssueOwner;
  resolutionType: EngineeringResolutionType;
  resolutionAction: string;
  technicalDetails: Record<string, unknown>;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(...values: unknown[]) {
  for (const value of values) {
    const candidate = String(value ?? "").trim();
    if (candidate) return candidate;
  }
  return "";
}

const SYSTEM_VALIDATIONS = new Set([
  "geometry", "spine", "stationing", "station-to-coordinate", "graph", "object addressing",
  "object attachment", "audit projection", "engineering readiness", "doctrine object manifest",
  "payment sequence", "station lifecycle", "doctrine station sequencing", "doctrine span attachments",
  "constitutional state authority",
]);

function authorityFor(row: EngineeringComplianceRow, projection: EngineeringCertificationProjection) {
  const draft = projection.sourceDraftPackage as Record<string, unknown>;
  const stationProjection = record(draft.stationProjection);
  const projectedManifest = record(draft.projectedObjectManifest);
  if (["stationing", "station-to-coordinate"].includes(row.key)) return {
    sourceAuthority: "DOCTRINE_PROJECTION_ENGINE",
    sourceArtifactId: text(stationProjection.stationProjectionId, draft.stationProjectionId),
    sourceHash: text(record(record(draft.iofArtifactRepositoryReferences).stationProjection).hash),
  };
  if (row.key === "graph") return {
    sourceAuthority: "STATION_GRAPH",
    sourceArtifactId: text(record(draft.stationIndexedGraph).stationGraphId, draft.stationGraphId),
    sourceHash: text(record(record(draft.iofArtifactRepositoryReferences).stationGraph).hash),
  };
  if (["object addressing", "object attachment", "objects"].includes(row.key)) return {
    sourceAuthority: "DOCTRINE_PROJECTION_ENGINE",
    sourceArtifactId: text(projectedManifest.projectedObjectManifestId, projectedManifest.manifestId, draft.projectedObjectManifestId),
    sourceHash: text(record(record(draft.iofArtifactRepositoryReferences).projectedObjectManifest).hash),
  };
  if (row.key === "audit projection") return {
    sourceAuthority: "COMMERCIAL_AUDIT_PROJECTION",
    sourceArtifactId: text(record(draft.auditProjectionSummary).summaryId),
    sourceHash: "",
  };
  return {
    sourceAuthority: text(draft.currentAuthority, "COMMERCIAL_DRAFT_IOF_PACKAGE"),
    sourceArtifactId: projection.packageId,
    sourceHash: text(draft.packageHash, draft.repositoryHash),
  };
}

function classificationFor(row: EngineeringComplianceRow): Pick<EngineeringFailureAuthorityIssue, "classification" | "resolutionOwner" | "resolutionType" | "humanActionRequired" | "resolutionAction"> {
  if (row.status !== "FAIL") return {
    classification: row.key === "engineering readiness" || row.key === "audit projection" ? "INFORMATIONAL" : "DERIVED_SYSTEM_VALIDATION",
    resolutionOwner: "SYSTEM",
    resolutionType: row.key === "engineering readiness" || row.key === "audit projection" ? "NO_ACTION" : "AUTOMATIC_REEVALUATION",
    humanActionRequired: false,
    resolutionAction: row.key === "engineering readiness" || row.key === "audit projection" ? "No Engineering action." : "Re-evaluate automatically when governed inputs change.",
  };
  if (SYSTEM_VALIDATIONS.has(row.key)) return {
    classification: "PACKAGE_DATA_DEFECT",
    resolutionOwner: "PACKAGE_PRODUCER",
    resolutionType: "CORRECT_SOURCE_AUTHORITY",
    humanActionRequired: false,
    resolutionAction: "Correct or restore the governed source artifact; do not record a doctrine exception for missing system authority.",
  };
  return {
    classification: "PACKAGE_DATA_DEFECT",
    resolutionOwner: row.key.startsWith("doctrine") ? "PRODUCT_DOCTRINE" : "PACKAGE_PRODUCER",
    resolutionType: "CORRECT_SOURCE_AUTHORITY",
    humanActionRequired: false,
    resolutionAction: "Correct the producing authority and allow deterministic validation to re-evaluate.",
  };
}

export function classifyEngineeringComplianceIssue(
  row: EngineeringComplianceRow,
  projection: EngineeringCertificationProjection,
): EngineeringFailureAuthorityIssue {
  const authority = authorityFor(row, projection);
  const resolution = classificationFor(row);
  return {
    issueId: `ENGINEERING-ISSUE-${projection.packageId}-${row.key.toUpperCase().replaceAll(/[^A-Z0-9]+/g, "-")}`,
    issueType: `COMPLIANCE_${row.key.toUpperCase().replaceAll(/[^A-Z0-9]+/g, "_")}`,
    ...resolution,
    title: row.label,
    humanReadableReason: row.detail,
    ...authority,
    sourceRevision: text((projection.sourceDraftPackage as DraftIofPackageRuntime).packageRevision, (projection.sourceDraftPackage as Record<string, unknown>).routeRevision, "1"),
    validator: "EngineeringCertificationProjection.buildCompliance",
    predicate: `${row.key} governed predicate must evaluate PASS`,
    expected: "PASS",
    actual: row.status,
    blocking: row.status === "FAIL",
    dependentOn: [],
    technicalDetails: { complianceKey: row.key, detail: row.detail },
  };
}

export function engineeringFailureAuthorityProjection(projection: EngineeringCertificationProjection) {
  return projection.compliance.map((row) => classifyEngineeringComplianceIssue(row, projection));
}

export function engineeringDecisionIssue(args: {
  issueId: string;
  title: string;
  reason: string;
  sourceAuthority: string;
  sourceArtifactId: string;
  validator: string;
  predicate: string;
  resolutionAction: string;
  technicalDetails?: Record<string, unknown>;
}): EngineeringFailureAuthorityIssue {
  return {
    issueId: args.issueId,
    issueType: "ENGINEERING_DECISION",
    classification: "ENGINEERING_DECISION",
    title: args.title,
    humanReadableReason: args.reason,
    sourceAuthority: args.sourceAuthority,
    sourceArtifactId: args.sourceArtifactId,
    sourceRevision: "",
    sourceHash: "",
    validator: args.validator,
    predicate: args.predicate,
    expected: "ENGINEERING_DISPOSITION",
    actual: "PENDING",
    blocking: true,
    humanActionRequired: true,
    dependentOn: [],
    resolutionOwner: "ENGINEERING",
    resolutionType: "ENGINEERING_DISPOSITION",
    resolutionAction: args.resolutionAction,
    technicalDetails: args.technicalDetails ?? {},
  };
}
