import {
  createScopeVersionCloseDraft,
  validateScopeVersionClose,
} from "../../scopeversion/ScopeVersionCloseAuthorityEngine";
import type {
  ScopeVersionCloseActorRole,
  ScopeVersionCloseEvent,
  ScopeVersionCloseReference,
} from "../../scopeversion/ScopeVersionCloseAuthority";
import {
  evaluateOperationsReadiness,
  validateOperationsRequirements,
} from "../OperationsAuthorityEngine";
import type {
  OperationsAcceptance,
  OperationsReadinessInput,
} from "../OperationsReadiness";

const trace = {
  customerId: "CUSTOMER-HYPERSCALER-001",
  opportunityId: "OPP-OPERATIONS-001",
  corridorId: "CORRIDOR-DALLAS-KANSAS-CITY",
};

const actor = {
  actorId: "ops-001",
  actorRole: "TERALINX_OPERATIONS" as ScopeVersionCloseActorRole,
};

function ref(referenceId: string, referenceType: string, source = "OperationsFixture"): ScopeVersionCloseReference {
  return {
    referenceId,
    referenceType,
    source,
    immutable: true,
  };
}

function validatedCompletionClose(
  scopeVersionId: string,
  overrides: {
    customerId?: string;
    opportunityId?: string;
    corridorId?: string;
    evidenceIds?: string[];
  } = {},
): ScopeVersionCloseEvent {
  const close = createScopeVersionCloseDraft({
    closeId: `COMPLETION-CLOSE-${scopeVersionId}`,
    scopeVersionId,
    customerId: overrides.customerId ?? trace.customerId,
    opportunityId: overrides.opportunityId ?? trace.opportunityId,
    corridorId: overrides.corridorId ?? trace.corridorId,
    closeType: "COMPLETION_CLOSE",
    actorId: "ops-001",
    actorRole: "TERALINX_OPERATIONS",
    evidenceIds: overrides.evidenceIds ?? [`EVIDENCE-${scopeVersionId}-COMPLETION`],
    inputReferences: [
      ref(`FIELD-CLOSE-${scopeVersionId}`, "FIELD_CLOSE"),
      ref(`COMPLETION-AUDIT-${scopeVersionId}`, "CompletionAudit"),
    ],
    constraintReferences: [ref("COMPLETION-AUTHORITY", "Authority")],
    outcome: {
      status: "ACCEPTED",
      previousState: "COMPLETION_REVIEW",
      resultingState: "COMPLETE",
    },
  });
  const validation = validateScopeVersionClose(close);
  return {
    ...close,
    validatedAt: validation.validatedAt,
    immutable: validation.valid,
  };
}

function acceptance(
  scopeVersionId: string,
  acceptanceType: OperationsAcceptance["acceptanceType"],
  referenceIds: string[],
  accepted = true,
): OperationsAcceptance {
  return {
    acceptanceId: `OPS-ACCEPTANCE-${scopeVersionId}-${acceptanceType}`,
    acceptanceType,
    accepted,
    referenceIds,
    evidenceIds: [`EVIDENCE-${scopeVersionId}-${acceptanceType}`],
    acceptedBy: "ops-001",
    acceptedAt: "2026-06-24T00:00:00.000Z",
  };
}

function input(
  scopeVersionId: string,
  overrides: Partial<OperationsReadinessInput> = {},
): OperationsReadinessInput {
  return {
    ...trace,
    ...actor,
    scopeVersionId,
    lifecycleState: "COMPLETE",
    completionCloses: [validatedCompletionClose(scopeVersionId)],
    operationalOwnerId: `OPS-OWNER-${scopeVersionId}`,
    supportOwnerId: `SUPPORT-OWNER-${scopeVersionId}`,
    maintenanceOwnerId: `MAINT-OWNER-${scopeVersionId}`,
    assetInventoryReference: `ASSET-INVENTORY-${scopeVersionId}`,
    serviceInventoryReference: `SERVICE-INVENTORY-${scopeVersionId}`,
    requiredDocumentationIds: [`DOC-ASBUILT-${scopeVersionId}`, `DOC-SUPPORT-${scopeVersionId}`],
    turnoverPackageIds: [`TURNOVER-${scopeVersionId}`],
    acceptances: [
      acceptance(scopeVersionId, "OPERATIONAL_ACCEPTANCE", [`SERVICE-INVENTORY-${scopeVersionId}`]),
      acceptance(scopeVersionId, "COMPOSITE_ACCEPTANCE", [scopeVersionId]),
    ],
    ...overrides,
  };
}

export const operationsAuthorityInputFixtures: readonly OperationsReadinessInput[] = Object.freeze([
  input("SV-OPERATIONS-LONG-HAUL"),
  input("SV-OPERATIONS-METRO-AGGREGATION", {
    opportunityId: "OPP-METRO-OPERATIONS",
    corridorId: "CORRIDOR-METRO-001",
    acceptances: [
      acceptance("SV-OPERATIONS-METRO-AGGREGATION", "NETWORK_ACCEPTANCE", ["SERVICE-INVENTORY-SV-OPERATIONS-METRO-AGGREGATION"]),
      acceptance("SV-OPERATIONS-METRO-AGGREGATION", "CUSTOMER_ACCEPTANCE", ["CUSTOMER-HYPERSCALER-001"]),
    ],
  }),
  input("SV-OPERATIONS-AI-CORRIDOR", {
    opportunityId: "OPP-AI-CORRIDOR-OPERATIONS",
    corridorId: "CORRIDOR-WEST-TEXAS-AI",
    acceptances: [
      acceptance("SV-OPERATIONS-AI-CORRIDOR", "POWER_ACCEPTANCE", ["ASSET-POWER-AI-001"]),
      acceptance("SV-OPERATIONS-AI-CORRIDOR", "NETWORK_ACCEPTANCE", ["SERVICE-AI-CORRIDOR-001"]),
      acceptance("SV-OPERATIONS-AI-CORRIDOR", "COMPOSITE_ACCEPTANCE", ["SV-OPERATIONS-AI-CORRIDOR"]),
    ],
  }),
  input("SV-OPERATIONS-GPU-FACILITY", {
    acceptances: [
      acceptance("SV-OPERATIONS-GPU-FACILITY", "GPU_ACCEPTANCE", ["ASSET-GPU-FACILITY-001"]),
      acceptance("SV-OPERATIONS-GPU-FACILITY", "FACILITY_ACCEPTANCE", ["FACILITY-GPU-001"]),
      acceptance("SV-OPERATIONS-GPU-FACILITY", "OPERATIONAL_ACCEPTANCE", ["SERVICE-GPU-001"]),
    ],
  }),
  input("SV-OPERATIONS-DATA-CENTER", {
    acceptances: [
      acceptance("SV-OPERATIONS-DATA-CENTER", "DATA_CENTER_ACCEPTANCE", ["ASSET-DATA-CENTER-001"]),
      acceptance("SV-OPERATIONS-DATA-CENTER", "TRANSPORT_ACCEPTANCE", ["SERVICE-TRANSPORT-001"]),
      acceptance("SV-OPERATIONS-DATA-CENTER", "CUSTOMER_ACCEPTANCE", ["CUSTOMER-HYPERSCALER-001"]),
    ],
  }),
  input("SV-OPERATIONS-MISSING-COMPLETION-CLOSE", {
    completionCloses: [],
  }),
  input("SV-OPERATIONS-MISSING-OWNER", {
    operationalOwnerId: undefined,
  }),
  input("SV-OPERATIONS-MISSING-TURNOVER", {
    turnoverPackageIds: [],
  }),
  input("SV-OPERATIONS-MISSING-ACCEPTANCE", {
    acceptances: [],
  }),
  input("SV-OPERATIONS-FULLY-VALIDATED", {
    acceptances: [
      acceptance("SV-OPERATIONS-FULLY-VALIDATED", "ASSET_ACCEPTANCE", ["ASSET-INVENTORY-SV-OPERATIONS-FULLY-VALIDATED"]),
      acceptance("SV-OPERATIONS-FULLY-VALIDATED", "FACILITY_ACCEPTANCE", ["FACILITY-SV-OPERATIONS-FULLY-VALIDATED"]),
      acceptance("SV-OPERATIONS-FULLY-VALIDATED", "POWER_ACCEPTANCE", ["POWER-SV-OPERATIONS-FULLY-VALIDATED"]),
      acceptance("SV-OPERATIONS-FULLY-VALIDATED", "TRANSPORT_ACCEPTANCE", ["TRANSPORT-SV-OPERATIONS-FULLY-VALIDATED"]),
      acceptance("SV-OPERATIONS-FULLY-VALIDATED", "NETWORK_ACCEPTANCE", ["SERVICE-INVENTORY-SV-OPERATIONS-FULLY-VALIDATED"]),
      acceptance("SV-OPERATIONS-FULLY-VALIDATED", "CUSTOMER_ACCEPTANCE", ["CUSTOMER-HYPERSCALER-001"]),
      acceptance("SV-OPERATIONS-FULLY-VALIDATED", "OPERATIONAL_ACCEPTANCE", ["SV-OPERATIONS-FULLY-VALIDATED"]),
      acceptance("SV-OPERATIONS-FULLY-VALIDATED", "COMPOSITE_ACCEPTANCE", ["SV-OPERATIONS-FULLY-VALIDATED"]),
    ],
  }),
]);

export const operationsAuthorityValidationFixtures = Object.freeze(
  operationsAuthorityInputFixtures.map(validateOperationsRequirements),
);

export const operationsAuthorityResultFixtures = Object.freeze(
  operationsAuthorityInputFixtures.map(evaluateOperationsReadiness),
);

export function evaluateOperationsAuthorityFixtures() {
  return {
    fixtureCount: operationsAuthorityResultFixtures.length,
    activeCount: operationsAuthorityResultFixtures.filter((result) => result.status === "OPERATIONS_ACTIVE").length,
    notReadyCount: operationsAuthorityResultFixtures.filter((result) => result.status === "NOT_READY").length,
    operationsCloseIds: operationsAuthorityResultFixtures.map((result) => result.operationsClose?.closeId).filter(Boolean),
    blockers: operationsAuthorityResultFixtures.flatMap((result) =>
      result.readiness.blockers.map((blocker) => ({
        scopeVersionId: result.scopeVersionId,
        code: blocker.code,
        severity: blocker.severity,
        referenceId: blocker.referenceId,
      })),
    ),
  };
}
