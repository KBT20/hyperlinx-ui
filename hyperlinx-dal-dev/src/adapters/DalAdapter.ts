export type DalAdapterSeverity = "INFO" | "WARNING" | "ERROR" | "CRITICAL";

export type DalAdapterStatus = "PASS" | "WARNING" | "FAIL";

export type DalAdapterDiagnosticCode =
  | "SCOPEVERSION_ADAPTER_READ"
  | "SCOPEVERSION_ADAPTER_WARNING"
  | "SCOPEVERSION_ADAPTER_ERROR"
  | "ADAPTER_AUDIT_STARTED"
  | "ENTITY_MAPPING_VALIDATED"
  | "TRACEABILITY_VALIDATED"
  | "ADAPTER_GAP_IDENTIFIED"
  | "ADAPTER_AUDIT_COMPLETE";

export interface DalAdapterDiagnostic {
  code: DalAdapterDiagnosticCode;
  severity: DalAdapterSeverity;
  message: string;
  details?: Record<string, unknown>;
}

export interface DalAdapterGap {
  gapId: string;
  severity: DalAdapterSeverity;
  message: string;
  sourceEntityId?: string;
  sourceEntityType?: string;
  requiredAdapter?: string;
}

export interface DalAdapterResult<T = unknown> {
  status: DalAdapterStatus;
  value?: T;
  gaps: DalAdapterGap[];
  diagnostics: DalAdapterDiagnostic[];
}

export interface DalAdapter<TInput = unknown, TOutput = unknown> {
  adapterId: string;
  source: "DAL_RUNTIME";
  target: "CONSTITUTIONAL_RUNTIME";
  readonly: true;
  adapt(input: TInput): DalAdapterResult<TOutput>;
}

export interface DalAdapterAuditSnapshot {
  snapshotId: string;
  entities: readonly unknown[];
  scopeVersions: readonly unknown[];
  notes?: string;
}

export function createDalAdapterDiagnostic(
  code: DalAdapterDiagnosticCode,
  severity: DalAdapterSeverity,
  message: string,
  details?: Record<string, unknown>,
): DalAdapterDiagnostic {
  return { code, severity, message, details };
}

export function createDalAdapterGap(args: Omit<DalAdapterGap, "gapId">): DalAdapterGap {
  const source = args.sourceEntityId ?? args.sourceEntityType ?? "GLOBAL";
  return {
    gapId: `DAL-ADAPTER-GAP-${source}-${args.message.replace(/[^A-Z0-9]+/gi, "-").slice(0, 64)}`,
    ...args,
  };
}

export function statusFromGaps(gaps: readonly DalAdapterGap[]): DalAdapterStatus {
  if (gaps.some((gap) => gap.severity === "ERROR" || gap.severity === "CRITICAL")) return "FAIL";
  if (gaps.length) return "WARNING";
  return "PASS";
}
