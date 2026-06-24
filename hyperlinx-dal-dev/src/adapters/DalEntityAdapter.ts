import type { DalAdapterDiagnostic, DalAdapterResult } from "./DalAdapter";
import { createDalAdapterDiagnostic, createDalAdapterGap, statusFromGaps } from "./DalAdapter";

export type DalEntityType =
  | "Customer"
  | "Opportunity"
  | "Corridor"
  | "ScopeVersion"
  | "WorkPackage"
  | "ControlItem"
  | "FieldItem"
  | "CompletionItem"
  | "OperationsItem";

export type ConstitutionalEntityType =
  | "Customer"
  | "Opportunity"
  | "Corridor"
  | "ScopeVersion"
  | "IOFPackage"
  | "WorkPackage"
  | "CloseEvent"
  | "Completion"
  | "Operations";

export type DalMappingConfidence = "LOW" | "MEDIUM" | "HIGH" | "VERIFIED";

export interface DalEntityReference {
  entityType: DalEntityType;
  entityId: string;
  source: string;
  target: ConstitutionalEntityType;
  requiredFields: readonly string[];
  optionalFields: readonly string[];
  resolvedFields: readonly string[];
  missingFields: readonly string[];
  mappingConfidence: DalMappingConfidence;
  traceability?: {
    customerId?: string;
    opportunityId?: string;
    corridorId?: string;
    scopeVersionId?: string;
  };
  raw?: unknown;
}

export interface DalEntityMappingInput {
  entityType: DalEntityType;
  target: ConstitutionalEntityType;
  source: string;
  requiredFields: readonly string[];
  optionalFields?: readonly string[];
  raw: unknown;
}

export function adaptDalEntityReference(input: DalEntityMappingInput): DalAdapterResult<DalEntityReference> {
  const record = asRecord(input.raw);
  const customer = asRecord(record.customer);
  const opportunity = asRecord(record.opportunity);
  const corridor = asRecord(record.corridor);
  const entityId = firstString(record.id, record.entityId, record.customerId, record.opportunityId, record.corridorId, record.scopeVersionId, record.workItemId, record.workPackageId, record.closureId, record.closeId);
  const resolvedFields = input.requiredFields.filter((field) => hasField(record, field));
  const missingFields = input.requiredFields.filter((field) => !hasField(record, field));
  const traceability = {
    customerId: firstString(record.customerId, customer.customerId),
    opportunityId: firstString(record.opportunityId, record.sourceOpportunityId, opportunity.opportunityId),
    corridorId: firstString(record.corridorId, corridor.corridorId),
    scopeVersionId: firstString(record.scopeVersionId),
  };
  const gaps = missingFields.map((field) =>
    createDalAdapterGap({
      severity: "WARNING",
      message: `${input.entityType} is missing required adapter field ${field}.`,
      sourceEntityId: entityId,
      sourceEntityType: input.entityType,
      requiredAdapter: `${input.entityType} -> ${input.target}`,
    }),
  );
  const diagnostics: DalAdapterDiagnostic[] = [
    createDalAdapterDiagnostic("ENTITY_MAPPING_VALIDATED", gaps.length ? "WARNING" : "INFO", `${input.entityType} mapping validated.`, {
      entityId,
      target: input.target,
      missingFields,
    }),
  ];

  return {
    status: statusFromGaps(gaps),
    value: {
      entityType: input.entityType,
      entityId: entityId ?? `UNRESOLVED-${input.entityType}`,
      source: input.source,
      target: input.target,
      requiredFields: input.requiredFields,
      optionalFields: input.optionalFields ?? [],
      resolvedFields,
      missingFields,
      mappingConfidence: confidenceFor(resolvedFields.length, input.requiredFields.length),
      traceability,
      raw: input.raw,
    },
    gaps,
    diagnostics,
  };
}

export function hasScopeVersionTraceability(reference: DalEntityReference) {
  return Boolean(reference.traceability?.scopeVersionId);
}

function confidenceFor(resolved: number, required: number): DalMappingConfidence {
  if (required === 0) return "VERIFIED";
  const ratio = resolved / required;
  if (ratio >= 1) return "VERIFIED";
  if (ratio >= 0.75) return "HIGH";
  if (ratio >= 0.5) return "MEDIUM";
  return "LOW";
}

function hasField(record: Record<string, unknown>, path: string) {
  return valueAt(record, path) !== undefined && valueAt(record, path) !== null && valueAt(record, path) !== "";
}

function valueAt(record: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object" || Array.isArray(current)) return undefined;
    return (current as Record<string, unknown>)[key];
  }, record);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function firstString(...values: unknown[]) {
  return values.find((value): value is string => typeof value === "string" && value.length > 0);
}
