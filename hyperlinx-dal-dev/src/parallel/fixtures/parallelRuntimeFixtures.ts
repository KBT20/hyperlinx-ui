import type { ParallelRuntimeInput, ParallelRuntimeObservation } from "../ParallelRuntime";
import { runParallelValidation } from "../ParallelRuntimeEngine";

const alignedObservation: ParallelRuntimeObservation = {
  scopeVersionState: "APPROVED",
  lifecycleState: "APPROVED",
  closeAuthority: ["CONTRACT_CLOSE", "CONTROL_CLOSE", "FIELD_CLOSE"],
  traceability: {
    customerId: "CUS-PARALLEL-001",
    opportunityId: "OPP-PARALLEL-001",
    corridorId: "COR-PARALLEL-001",
    scopeVersionId: "SV-PARALLEL-001",
  },
  controlReady: true,
  fieldReady: true,
  completionReady: true,
  operationsReady: false,
  marketplaceReady: true,
  auditReady: true,
};

function withDal(overrides: Partial<ParallelRuntimeObservation>): ParallelRuntimeInput {
  return {
    validationId: `PARALLEL-${Object.keys(overrides).join("-").toUpperCase() || "ALIGNED"}`,
    dalRuntime: { ...alignedObservation, ...overrides },
    constitutionalRuntime: alignedObservation,
  };
}

export const parallelRuntimeFixtures = Object.freeze({
  fullyAlignedRuntime: withDal({}),
  partialAlignment: withDal({ marketplaceReady: false, auditReady: false }),
  criticalAuthorityMismatch: withDal({ scopeVersionState: "PROVISIONALLY_CERTIFIED" }),
  lifecycleMismatch: withDal({ lifecycleState: "PROVISIONALLY_CERTIFIED" }),
  marketplaceMismatch: withDal({ marketplaceReady: false }),
  controlMismatch: withDal({ controlReady: false }),
  fieldMismatch: withDal({ fieldReady: false }),
  completionMismatch: withDal({ completionReady: false }),
  operationsMismatch: withDal({ operationsReady: true }),
  controlledAdoptionReady: {
    validationId: "PARALLEL-CONTROLLED-ADOPTION-READY",
    dalRuntime: alignedObservation,
    constitutionalRuntime: alignedObservation,
    notes: "All critical and non-critical runtime observations align.",
  } satisfies ParallelRuntimeInput,
});

export const parallelRuntimeInputs: readonly ParallelRuntimeInput[] = Object.freeze([
  parallelRuntimeFixtures.fullyAlignedRuntime,
  parallelRuntimeFixtures.partialAlignment,
  parallelRuntimeFixtures.criticalAuthorityMismatch,
  parallelRuntimeFixtures.lifecycleMismatch,
  parallelRuntimeFixtures.marketplaceMismatch,
  parallelRuntimeFixtures.controlMismatch,
  parallelRuntimeFixtures.fieldMismatch,
  parallelRuntimeFixtures.completionMismatch,
  parallelRuntimeFixtures.operationsMismatch,
  parallelRuntimeFixtures.controlledAdoptionReady,
]);

export function evaluateParallelRuntimeFixtures() {
  return parallelRuntimeInputs.map(runParallelValidation);
}
