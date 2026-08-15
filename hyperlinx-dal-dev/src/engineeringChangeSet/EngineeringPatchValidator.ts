import type { EngineeringBaselineReference, EngineeringChangeSet, EngineeringPatch, EngineeringPatchType, EngineeringPatchValue } from "./EngineeringChangeSet";

export const ENGINEERING_PATCH_TYPES: EngineeringPatchType[] = [
  "MOVE_STATION",
  "INSERT_STATION",
  "REMOVE_STATION",
  "CHANGE_STATION_TYPE",
  "CHANGE_STATION_INTERVAL",
  "MOVE_OBJECT",
  "ADD_OBJECT",
  "REMOVE_OBJECT",
  "CHANGE_OBJECT_CLASS",
  "CHANGE_OBJECT_TYPE",
  "CHANGE_OBJECT_STATUS",
  "CHANGE_OBJECT_SIZE",
  "CHANGE_OBJECT_CONFIGURATION",
  "ADD_CONSTRAINT",
  "REMOVE_CONSTRAINT",
  "RESOLVE_CONSTRAINT",
  "ADD_EXCEPTION",
  "RESOLVE_EXCEPTION",
  "CHANGE_CLEARANCE",
  "CHANGE_PLACEMENT",
  "CHANGE_SPLICE",
  "CHANGE_SPLICE_CASE",
  "CHANGE_FIBER_ASSIGNMENT",
  "CHANGE_BUFFER_ASSIGNMENT",
  "CHANGE_LOSS",
  "CHANGE_REGEN",
  "CHANGE_ILA_CONFIGURATION",
  "ADD_EVIDENCE",
  "REMOVE_EVIDENCE",
  "CHANGE_REVIEW_STATUS",
  "ADD_ENGINEERING_NOTE",
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

export type EngineeringPatchValidationResult = {
  valid: boolean;
  warnings: string[];
  errors: string[];
  normalizedPatch?: EngineeringPatch;
};

function byteSize(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value ?? null)).length;
}

function safePatchValue(value: EngineeringPatchValue): EngineeringPatchValue {
  if (byteSize(value) > 2048) return "[VALUE_TOO_LARGE_FOR_PATCH]";
  return value;
}

export function createEngineeringPatch(input: {
  patchId?: string;
  revisionId: string;
  patchType: EngineeringPatchType;
  targetObjectId?: string;
  targetProperty: string;
  oldValue?: EngineeringPatchValue;
  newValue?: EngineeringPatchValue;
  createdBy: string;
  createdAt?: string;
  reason?: string;
}): EngineeringPatch {
  return {
    patchId: input.patchId ?? `ENG-PATCH-${input.patchType}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    revisionId: input.revisionId,
    patchType: input.patchType,
    targetObjectId: input.targetObjectId ?? input.targetProperty,
    targetProperty: input.targetProperty,
    oldValue: safePatchValue(input.oldValue ?? null),
    newValue: safePatchValue(input.newValue ?? null),
    createdBy: input.createdBy,
    createdAt: input.createdAt ?? new Date().toISOString(),
    reason: input.reason ?? input.patchType.replaceAll("_", " "),
    authority: "ENGINEERING_CHANGE_SET",
    validationState: "PENDING",
  };
}

export function validateEngineeringPatch(patch: EngineeringPatch): EngineeringPatchValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const keys = Object.keys(patch);
  const unexpected = keys.filter((key) => !REQUIRED_PATCH_KEYS.includes(key as (typeof REQUIRED_PATCH_KEYS)[number]));
  if (unexpected.length) errors.push(`Engineering Patch contains non-model field ${unexpected[0]}.`);
  if (!patch.patchId) errors.push("Engineering Patch is missing patchId.");
  if (!patch.revisionId) errors.push("Engineering Patch is missing revisionId.");
  if (!ENGINEERING_PATCH_TYPES.includes(patch.patchType)) errors.push(`Unsupported Engineering Patch type ${String(patch.patchType)}.`);
  if (!patch.targetObjectId) warnings.push("Engineering Patch targetObjectId was empty; targetProperty will be used as the stable target.");
  if (!patch.targetProperty) errors.push("Engineering Patch is missing targetProperty.");
  if (!patch.createdBy) errors.push("Engineering Patch is missing createdBy.");
  if (!patch.createdAt) errors.push("Engineering Patch is missing createdAt.");
  if (patch.authority !== "ENGINEERING_CHANGE_SET") errors.push("Engineering Patch authority must be ENGINEERING_CHANGE_SET.");
  if (byteSize(patch.oldValue) > 2048 || byteSize(patch.newValue) > 2048) errors.push("Engineering Patch oldValue/newValue exceeds deterministic patch limit.");
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

export function validateEngineeringChangeSet(changeSet: EngineeringChangeSet) {
  const warnings: string[] = [];
  const errors: string[] = [];
  if (!changeSet.changeSetId) errors.push("Engineering Change Set is missing changeSetId.");
  if (!changeSet.revisionId) errors.push("Engineering Change Set is missing revisionId.");
  if (!changeSet.engineeringBaselineId) errors.push("Engineering Change Set is missing engineeringBaselineId.");
  if (changeSet.authority !== "ENGINEERING_CHANGE_SET") errors.push("Engineering Change Set authority must be ENGINEERING_CHANGE_SET.");
  if (!Array.isArray(changeSet.patches)) errors.push("Engineering Change Set patches must be an array.");
  const normalizedPatches: EngineeringPatch[] = [];
  for (const patch of changeSet.patches ?? []) {
    const result = validateEngineeringPatch(patch);
    warnings.push(...result.warnings);
    errors.push(...result.errors);
    if (result.normalizedPatch) normalizedPatches.push(result.normalizedPatch);
  }
  if (changeSet.patchCount !== normalizedPatches.length) warnings.push("Engineering Change Set patchCount did not match normalized patch count.");
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

export function engineeringBaselineReferenceHash(baseline: EngineeringBaselineReference) {
  const reference = {
    engineeringBaselineId: baseline.engineeringBaselineId,
    engineeringBaselineHash: baseline.engineeringBaselineHash,
    engineeringPackageId: baseline.engineeringPackageId,
    draftIOFPackageId: baseline.draftIOFPackageId ?? baseline.draftIofPackageId,
    routeRepositoryId: baseline.routeRepositoryId,
    proposalId: baseline.proposalId,
    estimateId: baseline.estimateId,
    workbookId: baseline.workbookId ?? baseline.commercialWorkbookId,
    stationProjectionId: baseline.stationProjectionId,
    objectManifestId: baseline.objectManifestId,
  };
  return stableEngineeringHash(reference, "engineering-baseline");
}

export function stableEngineeringHash(value: unknown, prefix = "engineering") {
  const json = JSON.stringify(value ?? null);
  let hash = 2166136261;
  for (let index = 0; index < json.length; index += 1) {
    hash ^= json.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
