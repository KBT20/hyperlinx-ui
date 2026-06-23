import type { TranslateDiagnostic } from "./TranslateDiagnostic";
import type { TranslateSourceType } from "./TranslateContract";

export type TranslateJobStatus = "CREATED" | "PARSED" | "NORMALIZED" | "FAILED";

export interface TranslateJob {
  jobId: string;
  sourceType: TranslateSourceType;
  fileName: string;
  status: TranslateJobStatus;
  createdAt: string;
  completedAt?: string;
  diagnostics: TranslateDiagnostic[];
}

export function createTranslateJob(args: {
  sourceType: TranslateSourceType;
  fileName: string;
  createdAt?: string;
}): TranslateJob {
  return {
    jobId: `translate-job-${args.sourceType.toLowerCase()}-${Date.now()}`,
    sourceType: args.sourceType,
    fileName: args.fileName,
    status: "CREATED",
    createdAt: args.createdAt ?? new Date().toISOString(),
    diagnostics: [],
  };
}

