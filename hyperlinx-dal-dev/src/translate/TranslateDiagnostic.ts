export type TranslateDiagnosticSeverity = "INFO" | "WARNING" | "ERROR";

export type TranslateDiagnosticCode =
  | "TRANSLATE_JOB_CREATED"
  | "TRANSLATE_FILE_PARSED"
  | "TRANSLATE_ENDPOINT_EXTRACTED"
  | "TRANSLATE_ROUTE_EXTRACTED"
  | "TRANSLATE_EVIDENCE_CREATED"
  | "TRANSLATE_WARNING"
  | "TRANSLATE_ERROR";

export interface TranslateDiagnostic {
  diagnosticId: string;
  code: TranslateDiagnosticCode;
  severity: TranslateDiagnosticSeverity;
  message: string;
  sourceFile?: string;
  sourceType?: string;
  entityId?: string;
  evidenceId?: string;
  details?: Record<string, unknown>;
}

export function createTranslateDiagnostic(args: Omit<TranslateDiagnostic, "diagnosticId">): TranslateDiagnostic {
  const diagnostic = {
    diagnosticId: `translate-diagnostic-${args.code.toLowerCase()}-${args.entityId ?? args.evidenceId ?? Date.now()}`,
    ...args,
  };
  if (args.severity === "ERROR") {
    console.error(`[${args.code}]`, diagnostic);
  } else if (args.severity === "WARNING") {
    console.warn(`[${args.code}]`, diagnostic);
  } else {
    console.log(`[${args.code}]`, diagnostic);
  }
  return diagnostic;
}

