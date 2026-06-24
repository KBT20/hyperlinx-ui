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
  evaluateCompletionReadiness,
  validateCompletionRequirements,
} from "../CompletionAuthorityEngine";
import type {
  CompletionAcceptance,
  CompletionReadinessInput,
} from "../CompletionRequirement";

const trace = {
  customerId: "CUSTOMER-HYPERSCALER-001",
  opportunityId: "OPP-COMPLETION-001",
  corridorId: "CORRIDOR-DALLAS-KANSAS-CITY",
};

const actor = {
  actorId: "ops-001",
  actorRole: "TERALINX_OPERATIONS" as ScopeVersionCloseActorRole,
};

function ref(referenceId: string, referenceType: string, source = "CompletionFixture"): ScopeVersionCloseReference {
  return {
    referenceId,
    referenceType,
    source,
    immutable: true,
  };
}

function validatedFieldClose(
  scopeVersionId: string,
  overrides: {
    customerId?: string;
    opportunityId?: string;
    corridorId?: string;
    workPackageIds?: string[];
    objectIds?: string[];
    stationIds?: string[];
    segmentIds?: string[];
    deliverableIds?: string[];
    evidenceIds?: string[];
  } = {},
): ScopeVersionCloseEvent {
  const close = createScopeVersionCloseDraft({
    closeId: `FIELD-CLOSE-${scopeVersionId}`,
    scopeVersionId,
    customerId: overrides.customerId ?? trace.customerId,
    opportunityId: overrides.opportunityId ?? trace.opportunityId,
    corridorId: overrides.corridorId ?? trace.corridorId,
    closeType: "FIELD_CLOSE",
    actorId: "field-001",
    actorRole: "FIELD_OPERATOR",
    evidenceIds: overrides.evidenceIds ?? [`EVIDENCE-${scopeVersionId}-FIELD`],
    inputReferences: [
      ...((overrides.workPackageIds ?? ["WP-CONSTRUCTION-001"]).map((id) => ref(id, "WorkPackage"))),
      ...((overrides.objectIds ?? ["OBJ-CONDUIT-001", "OBJ-FIBER-001"]).map((id) => ref(id, "Object"))),
      ...((overrides.stationIds ?? ["STA-0000", "STA-0100"]).map((id) => ref(id, "Station"))),
      ...((overrides.segmentIds ?? ["SEG-001"]).map((id) => ref(id, "Segment"))),
      ...((overrides.deliverableIds ?? ["DELIVERABLE-ASBUILT-001"]).map((id) => ref(id, "Deliverable"))),
    ],
    constraintReferences: [ref("FIELD-CLOSURE-AUTHORITY", "Authority")],
    outcome: {
      status: "ACCEPTED",
      previousState: "FIELD_ACTIVE",
      resultingState: "FIELD_ACTIVE",
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
  acceptanceType: CompletionAcceptance["acceptanceType"],
  referenceIds: string[],
  accepted = true,
): CompletionAcceptance {
  return {
    acceptanceId: `ACCEPTANCE-${scopeVersionId}-${acceptanceType}`,
    acceptanceType,
    accepted,
    referenceIds,
    evidenceIds: [`EVIDENCE-${scopeVersionId}-${acceptanceType}`],
    acceptedBy: "ops-001",
    acceptedAt: "2026-06-24T00:00:00.000Z",
  };
}

function input(
  scopeVersionId: string | undefined,
  overrides: Partial<CompletionReadinessInput> = {},
): CompletionReadinessInput {
  const fieldClose = scopeVersionId
    ? validatedFieldClose(scopeVersionId, {
        workPackageIds: overrides.requiredWorkPackageIds as string[] | undefined,
        objectIds: overrides.requiredObjectIds as string[] | undefined,
        stationIds: overrides.requiredStationIds as string[] | undefined,
        segmentIds: overrides.requiredSegmentIds as string[] | undefined,
        deliverableIds: overrides.requiredDeliverableIds as string[] | undefined,
      })
    : undefined;

  return {
    ...trace,
    ...actor,
    scopeVersionId,
    lifecycleState: "FIELD_ACTIVE",
    fieldCloses: fieldClose ? [fieldClose] : [],
    requiredWorkPackageIds: ["WP-CONSTRUCTION-001"],
    requiredObjectIds: ["OBJ-CONDUIT-001", "OBJ-FIBER-001"],
    requiredStationIds: ["STA-0000", "STA-0100"],
    requiredSegmentIds: ["SEG-001"],
    requiredDeliverableIds: ["DELIVERABLE-ASBUILT-001"],
    acceptances: scopeVersionId
      ? [
          acceptance(scopeVersionId, "WORK_PACKAGE_ACCEPTANCE", ["WP-CONSTRUCTION-001"]),
          acceptance(scopeVersionId, "COMPOSITE_ACCEPTANCE", [
            "OBJ-CONDUIT-001",
            "OBJ-FIBER-001",
            "STA-0000",
            "STA-0100",
            "SEG-001",
            "DELIVERABLE-ASBUILT-001",
          ]),
        ]
      : [],
    ...overrides,
  };
}

export const completionAuthorityInputFixtures: readonly CompletionReadinessInput[] = Object.freeze([
  input("SV-COMPLETE-LONG-HAUL"),
  input("SV-COMPLETE-METRO-AGGREGATION", {
    opportunityId: "OPP-METRO-COMPLETION",
    corridorId: "CORRIDOR-METRO-001",
  }),
  input("SV-COMPLETE-AI-CORRIDOR", {
    opportunityId: "OPP-AI-CORRIDOR-COMPLETION",
    corridorId: "CORRIDOR-WEST-TEXAS-AI",
    requiredObjectIds: ["OBJ-SUBSTATION-001", "OBJ-TRANSMISSION-001"],
  }),
  input("SV-COMPLETE-GPU-FACILITY", {
    requiredObjectIds: ["OBJ-GPU-FACILITY-001", "OBJ-POWER-FEED-001"],
    acceptances: [
      acceptance("SV-COMPLETE-GPU-FACILITY", "FACILITY_ACCEPTANCE", ["OBJ-GPU-FACILITY-001"]),
      acceptance("SV-COMPLETE-GPU-FACILITY", "POWER_ACCEPTANCE", ["OBJ-POWER-FEED-001"]),
    ],
  }),
  input("SV-COMPLETE-DATA-CENTER", {
    requiredObjectIds: ["OBJ-DATA-CENTER-001", "OBJ-CLOUD-ONRAMP-001"],
    acceptances: [
      acceptance("SV-COMPLETE-DATA-CENTER", "FACILITY_ACCEPTANCE", ["OBJ-DATA-CENTER-001"]),
      acceptance("SV-COMPLETE-DATA-CENTER", "TRANSPORT_ACCEPTANCE", ["OBJ-CLOUD-ONRAMP-001"]),
    ],
  }),
  input("SV-COMPLETE-MISSING-STATION", {
    fieldCloses: [
      validatedFieldClose("SV-COMPLETE-MISSING-STATION", {
        stationIds: ["STA-0000"],
      }),
    ],
    requiredStationIds: ["STA-0000", "STA-0100"],
  }),
  input("SV-COMPLETE-MISSING-WORK-PACKAGE", {
    fieldCloses: [
      validatedFieldClose("SV-COMPLETE-MISSING-WORK-PACKAGE", {
        workPackageIds: [],
      }),
    ],
    requiredWorkPackageIds: ["WP-CONSTRUCTION-001"],
  }),
  input("SV-COMPLETE-MISSING-ACCEPTANCE", {
    acceptances: [],
  }),
  input(undefined),
  input("SV-COMPLETE-FULLY-VALIDATED", {
    requiredWorkPackageIds: ["WP-ENGINEERING-001", "WP-CONSTRUCTION-001"],
    requiredObjectIds: ["OBJ-HANDHOLE-001", "OBJ-CONDUIT-001", "OBJ-FIBER-001"],
    requiredStationIds: ["STA-0000", "STA-0100", "STA-0200"],
    requiredSegmentIds: ["SEG-001", "SEG-002"],
    requiredDeliverableIds: ["DELIVERABLE-ASBUILT-001", "DELIVERABLE-TEST-RESULTS-001"],
    fieldCloses: [
      validatedFieldClose("SV-COMPLETE-FULLY-VALIDATED", {
        workPackageIds: ["WP-ENGINEERING-001", "WP-CONSTRUCTION-001"],
        objectIds: ["OBJ-HANDHOLE-001", "OBJ-CONDUIT-001", "OBJ-FIBER-001"],
        stationIds: ["STA-0000", "STA-0100", "STA-0200"],
        segmentIds: ["SEG-001", "SEG-002"],
        deliverableIds: ["DELIVERABLE-ASBUILT-001", "DELIVERABLE-TEST-RESULTS-001"],
      }),
    ],
    acceptances: [
      acceptance("SV-COMPLETE-FULLY-VALIDATED", "WORK_PACKAGE_ACCEPTANCE", ["WP-ENGINEERING-001", "WP-CONSTRUCTION-001"]),
      acceptance("SV-COMPLETE-FULLY-VALIDATED", "OBJECT_ACCEPTANCE", ["OBJ-HANDHOLE-001", "OBJ-CONDUIT-001", "OBJ-FIBER-001"]),
      acceptance("SV-COMPLETE-FULLY-VALIDATED", "STATION_ACCEPTANCE", ["STA-0000", "STA-0100", "STA-0200"]),
      acceptance("SV-COMPLETE-FULLY-VALIDATED", "SEGMENT_ACCEPTANCE", ["SEG-001", "SEG-002"]),
      acceptance("SV-COMPLETE-FULLY-VALIDATED", "CUSTOMER_ACCEPTANCE", ["DELIVERABLE-ASBUILT-001", "DELIVERABLE-TEST-RESULTS-001"]),
      acceptance("SV-COMPLETE-FULLY-VALIDATED", "COMPOSITE_ACCEPTANCE", ["SV-COMPLETE-FULLY-VALIDATED"]),
    ],
  }),
]);

export const completionAuthorityValidationFixtures = Object.freeze(
  completionAuthorityInputFixtures.map(validateCompletionRequirements),
);

export const completionAuthorityResultFixtures = Object.freeze(
  completionAuthorityInputFixtures.map(evaluateCompletionReadiness),
);

export function evaluateCompletionAuthorityFixtures() {
  return {
    fixtureCount: completionAuthorityResultFixtures.length,
    completeCount: completionAuthorityResultFixtures.filter((result) => result.status === "COMPLETE").length,
    notReadyCount: completionAuthorityResultFixtures.filter((result) => result.status === "NOT_READY").length,
    completionCloseIds: completionAuthorityResultFixtures.map((result) => result.completionClose?.closeId).filter(Boolean),
    blockers: completionAuthorityResultFixtures.flatMap((result) =>
      result.validation.blockers.map((blocker) => ({
        scopeVersionId: result.scopeVersionId,
        code: blocker.code,
        severity: blocker.severity,
        referenceId: blocker.referenceId,
      })),
    ),
  };
}
