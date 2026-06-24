import type {
  ParallelRuntimeAdoptionStatus,
  ParallelRuntimeAlignment,
  ParallelRuntimeComparison,
  ParallelRuntimeDiagnostic,
  ParallelRuntimeFinding,
  ParallelRuntimeRisk,
} from "./ParallelRuntimeComparison";

export interface ParallelRuntimeObservation {
  scopeVersionState?: unknown;
  lifecycleState?: unknown;
  closeAuthority?: readonly string[];
  traceability?: {
    customerId?: string;
    opportunityId?: string;
    corridorId?: string;
    scopeVersionId?: string;
  };
  controlReady?: boolean;
  fieldReady?: boolean;
  completionReady?: boolean;
  operationsReady?: boolean;
  marketplaceReady?: boolean;
  auditReady?: boolean;
}

export interface ParallelRuntimeInput {
  validationId: string;
  dalRuntime: ParallelRuntimeObservation;
  constitutionalRuntime: ParallelRuntimeObservation;
  notes?: string;
}

export interface ParallelRuntimeResult {
  resultId: string;
  validationId: string;
  alignment: ParallelRuntimeAlignment;
  adoptionStatus: ParallelRuntimeAdoptionStatus;
  comparisons: ParallelRuntimeComparison[];
  risks: ParallelRuntimeRisk[];
  findings: ParallelRuntimeFinding[];
  diagnostics: ParallelRuntimeDiagnostic[];
  completedAt: string;
}
