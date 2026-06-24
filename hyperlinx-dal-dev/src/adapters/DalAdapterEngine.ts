import type { ScopeVersion } from "../types/dal";
import type { DalAdapterAuditSnapshot, DalAdapterDiagnostic, DalAdapterGap, DalAdapterResult } from "./DalAdapter";
import { createDalAdapterDiagnostic, createDalAdapterGap, statusFromGaps } from "./DalAdapter";
import { adaptDalEntityReference, type ConstitutionalEntityType, type DalEntityReference, type DalEntityType } from "./DalEntityAdapter";
import { adaptScopeVersionReference, getScopeVersionTraceability, type DalScopeVersionReference } from "./DalScopeVersionAdapter";

export interface DalEntityMappingRule {
  entityType: DalEntityType;
  target: ConstitutionalEntityType;
  source: string;
  requiredFields: readonly string[];
  optionalFields?: readonly string[];
}

export interface DalAdapterAuditInput extends DalAdapterAuditSnapshot {
  entityMappings?: readonly DalEntityMappingRule[];
}

export interface DalEntityMappingValidation {
  references: DalEntityReference[];
  mappedCount: number;
  gapCount: number;
}

export interface DalScopeVersionMappingValidation {
  references: DalScopeVersionReference[];
  mappedCount: number;
  missingTraceabilityCount: number;
  gapCount: number;
}

export interface DalTraceabilityValidation {
  scopeVersionCount: number;
  customerResolvedCount: number;
  opportunityResolvedCount: number;
  corridorResolvedCount: number;
  completeTraceabilityCount: number;
}

export interface DalAdapterAuditResult {
  auditId: string;
  snapshotId: string;
  status: "PASS" | "WARNING" | "FAIL";
  entityMappings: DalAdapterResult<DalEntityMappingValidation>;
  scopeVersionMappings: DalAdapterResult<DalScopeVersionMappingValidation>;
  traceabilityMappings: DalAdapterResult<DalTraceabilityValidation>;
  gaps: DalAdapterGap[];
  diagnostics: DalAdapterDiagnostic[];
  completedAt: string;
}

const DEFAULT_ENTITY_MAPPINGS: readonly DalEntityMappingRule[] = Object.freeze([
  {
    entityType: "Customer",
    target: "Customer",
    source: "DAL Customer",
    requiredFields: ["customerId"],
    optionalFields: ["name", "accountId"],
  },
  {
    entityType: "Opportunity",
    target: "Opportunity",
    source: "DAL Opportunity",
    requiredFields: ["opportunityId", "customerId"],
    optionalFields: ["name", "scopeVersionId", "corridorId"],
  },
  {
    entityType: "Corridor",
    target: "Corridor",
    source: "DAL Corridor",
    requiredFields: ["corridorId"],
    optionalFields: ["customerId", "opportunityId", "scopeVersionId"],
  },
  {
    entityType: "ScopeVersion",
    target: "ScopeVersion",
    source: "DAL ScopeVersion",
    requiredFields: ["scopeVersionId", "canonicalTruth.lifecycleState"],
    optionalFields: ["customerId", "sourceOpportunityId", "canonicalTruth.corridorId"],
  },
  {
    entityType: "WorkPackage",
    target: "WorkPackage",
    source: "DAL Work Package",
    requiredFields: ["workPackageId", "scopeVersionId"],
    optionalFields: ["customerId", "opportunityId", "corridorId"],
  },
  {
    entityType: "ControlItem",
    target: "WorkPackage",
    source: "DAL Control Item",
    requiredFields: ["workItemId", "scopeVersionId"],
    optionalFields: ["status", "workType"],
  },
  {
    entityType: "FieldItem",
    target: "CloseEvent",
    source: "DAL Field Item",
    requiredFields: ["closureId", "scopeVersionId"],
    optionalFields: ["stationId", "objectId", "closedAt"],
  },
  {
    entityType: "CompletionItem",
    target: "Completion",
    source: "DAL Completion Item",
    requiredFields: ["scopeVersionId", "closeId"],
    optionalFields: ["customerId", "opportunityId", "corridorId"],
  },
  {
    entityType: "OperationsItem",
    target: "Operations",
    source: "DAL Operations Item",
    requiredFields: ["scopeVersionId", "closeId"],
    optionalFields: ["customerId", "opportunityId", "corridorId"],
  },
]);

export function validateEntityMappings(
  entities: readonly unknown[],
  mappingRules: readonly DalEntityMappingRule[] = DEFAULT_ENTITY_MAPPINGS,
): DalAdapterResult<DalEntityMappingValidation> {
  const references: DalEntityReference[] = [];
  const gaps: DalAdapterGap[] = [];
  const diagnostics: DalAdapterDiagnostic[] = [];

  entities.forEach((entity) => {
    const entityType = inferEntityType(entity);
    const rule = mappingRules.find((candidate) => candidate.entityType === entityType);
    if (!rule) {
      gaps.push(
        createDalAdapterGap({
          severity: "WARNING",
          message: `No DAL entity mapping rule found for ${entityType}.`,
          sourceEntityType: entityType,
          requiredAdapter: "DalEntityAdapter",
        }),
      );
      diagnostics.push(
        createDalAdapterDiagnostic("ADAPTER_GAP_IDENTIFIED", "WARNING", `No entity mapping rule found for ${entityType}.`, {
          entityType,
        }),
      );
      return;
    }

    const result = adaptDalEntityReference({ ...rule, raw: entity });
    if (result.value) references.push(result.value);
    gaps.push(...result.gaps);
    diagnostics.push(...result.diagnostics);
  });

  return {
    status: statusFromGaps(gaps),
    value: {
      references,
      mappedCount: references.length,
      gapCount: gaps.length,
    },
    gaps,
    diagnostics,
  };
}

export function validateScopeVersionMappings(scopeVersions: readonly ScopeVersion[]): DalAdapterResult<DalScopeVersionMappingValidation> {
  const references: DalScopeVersionReference[] = [];
  const gaps: DalAdapterGap[] = [];
  const diagnostics: DalAdapterDiagnostic[] = [];

  scopeVersions.forEach((scopeVersion) => {
    const result = adaptScopeVersionReference(scopeVersion);
    if (result.value) references.push(result.value);
    gaps.push(...result.gaps);
    diagnostics.push(...result.diagnostics);
  });

  return {
    status: statusFromGaps(gaps),
    value: {
      references,
      mappedCount: references.length,
      missingTraceabilityCount: references.filter((reference) => !reference.customerId || !reference.opportunityId || !reference.corridorId).length,
      gapCount: gaps.length,
    },
    gaps,
    diagnostics,
  };
}

export function validateTraceabilityMappings(scopeVersions: readonly ScopeVersion[]): DalAdapterResult<DalTraceabilityValidation> {
  const gaps: DalAdapterGap[] = [];
  const diagnostics: DalAdapterDiagnostic[] = [];
  const traceability = scopeVersions.map(getScopeVersionTraceability);

  traceability.forEach((reference) => {
    const missing = [
      !reference.customerId ? "customerId" : undefined,
      !reference.opportunityId ? "opportunityId" : undefined,
      !reference.corridorId ? "corridorId" : undefined,
    ].filter((field): field is string => Boolean(field));
    if (missing.length) {
      gaps.push(
        createDalAdapterGap({
          severity: "WARNING",
          message: `ScopeVersion ${reference.scopeVersionId} has incomplete traceability: ${missing.join(", ")}.`,
          sourceEntityId: reference.scopeVersionId,
          sourceEntityType: "ScopeVersion",
          requiredAdapter: "DalScopeVersionAdapter",
        }),
      );
      diagnostics.push(
        createDalAdapterDiagnostic("ADAPTER_GAP_IDENTIFIED", "WARNING", "ScopeVersion traceability gap identified.", {
          scopeVersionId: reference.scopeVersionId,
          missing,
        }),
      );
    } else {
      diagnostics.push(
        createDalAdapterDiagnostic("TRACEABILITY_VALIDATED", "INFO", "ScopeVersion traceability validated.", {
          scopeVersionId: reference.scopeVersionId,
        }),
      );
    }
  });

  return {
    status: statusFromGaps(gaps),
    value: {
      scopeVersionCount: scopeVersions.length,
      customerResolvedCount: traceability.filter((reference) => Boolean(reference.customerId)).length,
      opportunityResolvedCount: traceability.filter((reference) => Boolean(reference.opportunityId)).length,
      corridorResolvedCount: traceability.filter((reference) => Boolean(reference.corridorId)).length,
      completeTraceabilityCount: traceability.filter((reference) => reference.customerId && reference.opportunityId && reference.corridorId).length,
    },
    gaps,
    diagnostics,
  };
}

export function runDalAdapterAudit(input: DalAdapterAuditInput): DalAdapterAuditResult {
  console.info("[ADAPTER_AUDIT_STARTED]", { snapshotId: input.snapshotId });
  const started = createDalAdapterDiagnostic("ADAPTER_AUDIT_STARTED", "INFO", "DAL adapter audit started.", {
    snapshotId: input.snapshotId,
  });
  const entityMappings = validateEntityMappings(input.entities, input.entityMappings);
  const scopeVersionMappings = validateScopeVersionMappings(input.scopeVersions as readonly ScopeVersion[]);
  const traceabilityMappings = validateTraceabilityMappings(input.scopeVersions as readonly ScopeVersion[]);
  const gaps = [...entityMappings.gaps, ...scopeVersionMappings.gaps, ...traceabilityMappings.gaps];
  const diagnostics = [
    started,
    ...entityMappings.diagnostics,
    ...scopeVersionMappings.diagnostics,
    ...traceabilityMappings.diagnostics,
    createDalAdapterDiagnostic("ADAPTER_AUDIT_COMPLETE", statusFromGaps(gaps) === "FAIL" ? "ERROR" : "INFO", "DAL adapter audit complete.", {
      snapshotId: input.snapshotId,
      gapCount: gaps.length,
    }),
  ];

  console.info("[ADAPTER_AUDIT_COMPLETE]", {
    snapshotId: input.snapshotId,
    status: statusFromGaps(gaps),
    gapCount: gaps.length,
  });

  return {
    auditId: `DAL-ADAPTER-AUDIT-${input.snapshotId}`,
    snapshotId: input.snapshotId,
    status: statusFromGaps(gaps),
    entityMappings,
    scopeVersionMappings,
    traceabilityMappings,
    gaps,
    diagnostics,
    completedAt: new Date().toISOString(),
  };
}

function inferEntityType(entity: unknown): DalEntityType {
  const record = asRecord(entity);
  if (record.customerId && !record.scopeVersionId && !record.opportunityId) return "Customer";
  if (record.opportunityId && !record.scopeVersionId) return "Opportunity";
  if (record.corridorId && !record.scopeVersionId && !record.opportunityId) return "Corridor";
  if (record.scopeVersionId && record.canonicalTruth) return "ScopeVersion";
  if (record.workPackageId) return "WorkPackage";
  if (record.workItemId) return "ControlItem";
  if (record.closureId) return "FieldItem";
  if (String(record.closeType ?? record.eventType ?? "").includes("COMPLETION")) return "CompletionItem";
  if (String(record.closeType ?? record.eventType ?? "").includes("OPERATIONS")) return "OperationsItem";
  return "ScopeVersion";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
