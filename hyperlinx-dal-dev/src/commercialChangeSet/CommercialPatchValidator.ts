import type { CommercialChangeSet, CommercialPatch, CommercialPatchType, CommercialPatchValue, CommercialRevisionReference } from "./CommercialChangeSet";

export const COMMERCIAL_PATCH_TYPES: CommercialPatchType[] = [
  "CHANGE_PLOW_PERCENT",
  "CHANGE_BORE_PERCENT",
  "CHANGE_ROCK_PERCENT",
  "CHANGE_TRENCH_PERCENT",
  "CHANGE_AERIAL_PERCENT",
  "CHANGE_PLOW_RATE",
  "CHANGE_BORE_RATE",
  "CHANGE_LABOR_RATE",
  "CHANGE_MATERIAL_RATE",
  "CHANGE_EQUIPMENT_RATE",
  "CHANGE_MARKUP",
  "CHANGE_CONTINGENCY",
  "MOVE_ILA",
  "REMOVE_ILA",
  "RESTORE_ILA",
  "CHANGE_MAX_SPAN",
  "CHANGE_OPTICAL_LOSS",
  "CHANGE_REGEN_SPACING",
  "CHANGE_STATION_SPACING",
  "REMOVE_BOOKEND",
  "RESTORE_BOOKEND",
  "ADD_UNKNOWN",
  "RESOLVE_UNKNOWN",
  "ADD_RISK",
  "RESOLVE_RISK",
  "ADD_EXCEPTION",
  "RESOLVE_EXCEPTION",
  "MOVE_ALIGNMENT",
  "CHANGE_CONSTRUCTION_METHOD",
  "CHANGE_SEGMENT_TYPE",
  "CHANGE_MONTHLY_REVENUE",
  "CHANGE_MARGIN_ASSUMPTION",
];

const REQUIRED_PATCH_KEYS = [
  "patchId",
  "revisionId",
  "patchType",
  "targetObjectId",
  "targetProperty",
  "oldValue",
  "newValue",
  "createdBy",
  "createdAt",
  "reason",
  "authority",
  "validationState",
] as const;

export type CommercialPatchValidationResult = {
  valid: boolean;
  warnings: string[];
  errors: string[];
  normalizedPatch?: CommercialPatch;
};

function byteSize(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value ?? null)).length;
}

function safePatchValue(value: CommercialPatchValue): CommercialPatchValue {
  if (byteSize(value) > 2048) return "[VALUE_TOO_LARGE_FOR_PATCH]";
  return value;
}

export function createCommercialPatch(input: {
  patchId?: string;
  revisionId: string;
  patchType: CommercialPatchType;
  targetObjectId?: string;
  targetProperty: string;
  oldValue?: CommercialPatchValue;
  newValue?: CommercialPatchValue;
  createdBy: string;
  createdAt?: string;
  reason?: string;
}): CommercialPatch {
  return {
    patchId: input.patchId ?? `COMM-PATCH-${input.patchType}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    revisionId: input.revisionId,
    patchType: input.patchType,
    targetObjectId: input.targetObjectId ?? input.targetProperty,
    targetProperty: input.targetProperty,
    oldValue: safePatchValue(input.oldValue ?? null),
    newValue: safePatchValue(input.newValue ?? null),
    createdBy: input.createdBy,
    createdAt: input.createdAt ?? new Date().toISOString(),
    reason: input.reason ?? input.patchType.replaceAll("_", " "),
    authority: "COMMERCIAL_CHANGE_SET",
    validationState: "PENDING",
  };
}

export function validateCommercialPatch(patch: CommercialPatch): CommercialPatchValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const keys = Object.keys(patch);
  const unexpected = keys.filter((key) => !REQUIRED_PATCH_KEYS.includes(key as (typeof REQUIRED_PATCH_KEYS)[number]));
  if (unexpected.length) errors.push(`Commercial Patch contains non-model field ${unexpected[0]}.`);
  if (!patch.patchId) errors.push("Commercial Patch is missing patchId.");
  if (!patch.revisionId) errors.push("Commercial Patch is missing revisionId.");
  if (!COMMERCIAL_PATCH_TYPES.includes(patch.patchType)) errors.push(`Unsupported Commercial Patch type ${String(patch.patchType)}.`);
  if (!patch.targetObjectId) warnings.push("Commercial Patch targetObjectId was empty; targetProperty will be used as the stable target.");
  if (!patch.targetProperty) errors.push("Commercial Patch is missing targetProperty.");
  if (!patch.createdBy) errors.push("Commercial Patch is missing createdBy.");
  if (!patch.createdAt) errors.push("Commercial Patch is missing createdAt.");
  if (patch.authority !== "COMMERCIAL_CHANGE_SET") errors.push("Commercial Patch authority must be COMMERCIAL_CHANGE_SET.");
  if (byteSize(patch.oldValue) > 2048 || byteSize(patch.newValue) > 2048) errors.push("Commercial Patch oldValue/newValue exceeds deterministic patch limit.");
  return {
    valid: errors.length === 0,
    warnings,
    errors,
    normalizedPatch: errors.length ? undefined : {
      ...patch,
      targetObjectId: patch.targetObjectId || patch.targetProperty,
      validationState: warnings.length ? "WARNING" : "VALID",
    },
  };
}

export function validateCommercialChangeSet(changeSet: CommercialChangeSet) {
  const warnings: string[] = [];
  const errors: string[] = [];
  if (!changeSet.changeSetId) errors.push("Commercial Change Set is missing changeSetId.");
  if (!changeSet.revisionId) errors.push("Commercial Change Set is missing revisionId.");
  if (changeSet.authority !== "COMMERCIAL_CHANGE_SET") errors.push("Commercial Change Set authority must be COMMERCIAL_CHANGE_SET.");
  if (!Array.isArray(changeSet.patches)) errors.push("Commercial Change Set patches must be an array.");
  const normalizedPatches: CommercialPatch[] = [];
  for (const patch of changeSet.patches ?? []) {
    const result = validateCommercialPatch(patch);
    warnings.push(...result.warnings);
    errors.push(...result.errors);
    if (result.normalizedPatch) normalizedPatches.push(result.normalizedPatch);
  }
  if (changeSet.patchCount !== normalizedPatches.length) warnings.push("Commercial Change Set patchCount did not match normalized patch count.");
  return {
    valid: errors.length === 0,
    warnings,
    errors,
    normalizedChangeSet: errors.length ? undefined : {
      ...changeSet,
      patches: normalizedPatches,
      patchCount: normalizedPatches.length,
      activePatchCount: changeSet.status === "DISCARDED" || changeSet.status === "INACTIVE" ? 0 : normalizedPatches.length,
      appliedPatchCount: changeSet.status === "APPLIED" ? normalizedPatches.length : 0,
    },
  };
}

export function repositoryReferenceHash(repositoryTruth: CommercialRevisionReference, revision: CommercialRevisionReference) {
  const reference = {
    opportunityId: revision.opportunityId ?? repositoryTruth.opportunityId,
    repositoryId: revision.repositoryId ?? repositoryTruth.repositoryId,
    routeRepositoryId: revision.routeRepositoryId ?? repositoryTruth.routeRepositoryId,
    estimateId: revision.estimateId ?? repositoryTruth.estimateId,
    workbookId: revision.workbookId ?? revision.commercialWorkbookId ?? repositoryTruth.workbookId,
    proposalId: revision.proposalId ?? repositoryTruth.proposalId,
  };
  return stableCommercialHash(reference, "commercial-repository");
}

export function stableCommercialHash(value: unknown, prefix = "commercial") {
  const json = JSON.stringify(value ?? null);
  let hash = 2166136261;
  for (let index = 0; index < json.length; index += 1) {
    hash ^= json.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
