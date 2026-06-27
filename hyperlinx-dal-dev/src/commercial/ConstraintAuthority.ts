export type ConstraintAuthorityMode =
  | "UNKNOWN"
  | "ALGORITHM"
  | "HUMAN"
  | "API"
  | "SYNTHESIS"
  | "APPROVED";

export interface ConstraintValue<T = number | string | boolean> {
  key: string;
  label: string;
  value: T | null;
  unit?: string;
  authorityMode: ConstraintAuthorityMode;
  confidence: number;
  source: string;
  sourceDetail?: string;
  lastUpdated?: string;
  approvedBy?: string;
  approvedAt?: string;
  notes?: string;
  affectsCost: boolean;
  affectsSchedule: boolean;
  affectsConfidence: boolean;
}

export function authorityModeConfidence(mode: ConstraintAuthorityMode) {
  if (mode === "APPROVED") return 96;
  if (mode === "HUMAN") return 88;
  if (mode === "API") return 84;
  if (mode === "ALGORITHM") return 62;
  if (mode === "SYNTHESIS") return 70;
  return 0;
}

export function authorityModeRank(mode: ConstraintAuthorityMode) {
  if (mode === "APPROVED") return 6;
  if (mode === "HUMAN") return 5;
  if (mode === "API") return 4;
  if (mode === "SYNTHESIS") return 3;
  if (mode === "ALGORITHM") return 2;
  return 1;
}

export function authorityModeCostIncluded(value: ConstraintValue) {
  return value.affectsCost && value.value !== null && value.authorityMode !== "UNKNOWN" && value.authorityMode !== "SYNTHESIS";
}

export function createConstraintValue<T = number | string | boolean>(args: {
  key: string;
  label: string;
  value: T | null;
  unit?: string;
  authorityMode: ConstraintAuthorityMode;
  source: string;
  sourceDetail?: string;
  confidence?: number;
  approvedBy?: string;
  approvedAt?: string;
  notes?: string;
  affectsCost?: boolean;
  affectsSchedule?: boolean;
  affectsConfidence?: boolean;
}): ConstraintValue<T> {
  return {
    key: args.key,
    label: args.label,
    value: args.value,
    unit: args.unit,
    authorityMode: args.authorityMode,
    confidence: args.confidence ?? authorityModeConfidence(args.authorityMode),
    source: args.source,
    sourceDetail: args.sourceDetail,
    lastUpdated: new Date().toISOString(),
    approvedBy: args.approvedBy,
    approvedAt: args.approvedAt,
    notes: args.notes,
    affectsCost: args.affectsCost ?? false,
    affectsSchedule: args.affectsSchedule ?? false,
    affectsConfidence: args.affectsConfidence ?? true,
  };
}

export function resolveConstraintValue<T>(base: ConstraintValue<T>, override?: ConstraintValue<T> | null) {
  return override ?? base;
}
