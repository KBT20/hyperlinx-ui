import type { WorkPackage } from "../../control/WorkPackage";
import type { WorkPackageGenerationInput } from "../../control/WorkPackageGeneration";
import { generateWorkPackages } from "../../control/WorkPackageGenerationEngine";
import type { ScopeVersionCloseActorRole, ScopeVersionCloseEvent, ScopeVersionCloseType } from "../../scopeversion/ScopeVersionCloseAuthority";
import {
  createScopeVersionCloseDraft,
  validateScopeVersionClose,
} from "../../scopeversion/ScopeVersionCloseAuthorityEngine";
import type { ScopeVersionState } from "../../scopeversion/ScopeVersionLifecycle";
import type { FieldActivationDraftInput, FieldActivationReadinessInput } from "../FieldActivationReadiness";
import {
  evaluateFieldReadiness,
  validateFieldActivation,
} from "../FieldActivationEngine";

const trace = {
  customerId: "CUSTOMER-HYPERSCALER-001",
  opportunityId: "OPP-FIELD-ACTIVATION-001",
  corridorId: "CORRIDOR-DALLAS-KANSAS-CITY",
};

function close(input: {
  scopeVersionId: string;
  closeId: string;
  closeType: ScopeVersionCloseType;
  actorId: string;
  actorRole: ScopeVersionCloseActorRole;
  previousState: ScopeVersionState;
  resultingState: ScopeVersionState;
}): ScopeVersionCloseEvent {
  const draft = createScopeVersionCloseDraft({
    ...trace,
    scopeVersionId: input.scopeVersionId,
    closeId: input.closeId,
    closeType: input.closeType,
    actorId: input.actorId,
    actorRole: input.actorRole,
    evidenceIds: [`EV-${input.closeId}`],
    inputReferences: [
      {
        referenceId: input.scopeVersionId,
        referenceType: "ScopeVersion",
        source: "FieldActivationFixture",
        immutable: true,
      },
    ],
    constraintReferences: [
      {
        referenceId: `CONSTRAINT-${input.closeId}`,
        referenceType: "FieldActivationConstraint",
        source: "FieldActivationFixture",
        immutable: true,
      },
    ],
    createdAt: "2026-06-24T00:00:00.000Z",
    outcome: {
      status: "ACCEPTED",
      previousState: input.previousState,
      resultingState: input.resultingState,
    },
  });
  const validation = validateScopeVersionClose(draft);
  return { ...draft, validatedAt: validation.validatedAt, immutable: validation.valid };
}

function controlCloseFor(scopeVersionId: string): ScopeVersionCloseEvent {
  return close({
    scopeVersionId,
    closeId: `${scopeVersionId}-CONTROL-CLOSE`,
    closeType: "CONTROL_CLOSE",
    actorId: "ops-001",
    actorRole: "TERALINX_OPERATIONS",
    previousState: "CONTROL_READY",
    resultingState: "CONTROL_ACTIVE",
  });
}

function workPackageInput(scopeVersionId: string, overrides: Partial<WorkPackageGenerationInput> = {}): WorkPackageGenerationInput {
  return {
    ...trace,
    scopeVersionId,
    lifecycleState: "CONTROL_ACTIVE",
    controlActivationId: `CONTROL-ACTIVATION-${scopeVersionId}`,
    controlCloseId: `${scopeVersionId}-CONTROL-CLOSE`,
    actorId: "ops-001",
    actorRole: "TERALINX_OPERATIONS",
    approvedPackages: {
      objectPackageReference: `OBJECT-PACKAGE-${scopeVersionId}`,
      stationPackageReference: `STATION-PACKAGE-${scopeVersionId}`,
      segmentPackageReference: `SEGMENT-PACKAGE-${scopeVersionId}`,
      budgetReference: `BUDGET-${scopeVersionId}`,
      executionStrategyReference: `EXECUTION-STRATEGY-${scopeVersionId}`,
      designStandardsReference: `DESIGN-STANDARDS-${scopeVersionId}`,
      referenceArchitecture: `REFERENCE-ARCHITECTURE-${scopeVersionId}`,
      vendorAllocationReferences: [`VENDOR-ALLOCATION-${scopeVersionId}`],
    },
    source: {
      stationIds: ["STA-0000", "STA-0100", "STA-0200"],
      segmentIds: ["SEG-001"],
      objectIds: ["OBJ-HANDHOLE-001", "OBJ-CONDUIT-001"],
      vendorIds: ["VENDOR-CONSTRUCTION-001"],
      productIds: ["PRODUCT-DARK-FIBER"],
      disciplines: ["CONSTRUCTION", "MATERIAL"],
      quantityReferences: [`QUANTITY-${scopeVersionId}`],
    },
    requestedPackageTypes: ["STATION_WORK_PACKAGE", "CONSTRUCTION_WORK_PACKAGE", "MATERIAL_WORK_PACKAGE"],
    ...overrides,
  };
}

function workPackagesFor(scopeVersionId: string, overrides: Partial<WorkPackageGenerationInput> = {}): WorkPackage[] {
  return generateWorkPackages(workPackageInput(scopeVersionId, overrides)).workPackages;
}

function readyInput(scopeVersionId: string, overrides: Partial<FieldActivationReadinessInput> = {}): FieldActivationReadinessInput {
  return {
    ...trace,
    scopeVersionId,
    lifecycleState: "CONTROL_ACTIVE",
    closes: [controlCloseFor(scopeVersionId)],
    workPackages: workPackagesFor(scopeVersionId),
    actorId: "field-001",
    actorRole: "FIELD_OPERATOR",
    references: {
      controlActivationId: `CONTROL-ACTIVATION-${scopeVersionId}`,
      controlCloseId: `${scopeVersionId}-CONTROL-CLOSE`,
      executionPackageReference: `EXECUTION-PACKAGE-${scopeVersionId}`,
      designStandardsReference: `DESIGN-STANDARDS-${scopeVersionId}`,
      dependencySatisfactionReference: `DEPENDENCIES-SATISFIED-${scopeVersionId}`,
    },
    ...overrides,
  };
}

export const fieldActivationReadinessInputFixtures: readonly FieldActivationReadinessInput[] = Object.freeze([
  readyInput("SV-FIELD-HYPERSCALER-LONGHAUL"),
  readyInput("SV-FIELD-METRO-AGGREGATION", {
    opportunityId: "OPP-METRO-AGGREGATION-001",
    corridorId: "CORRIDOR-METRO-001",
  }),
  readyInput("SV-FIELD-AI-CORRIDOR", {
    opportunityId: "OPP-AI-CORRIDOR-001",
    corridorId: "CORRIDOR-AI-WEST-TEXAS",
  }),
  readyInput("SV-FIELD-MISSING-CONTROL-ACTIVE", {
    lifecycleState: "CONTRACT_EXECUTED",
  }),
  readyInput("SV-FIELD-MISSING-WORK-PACKAGES", {
    workPackages: [],
  }),
  readyInput("SV-FIELD-MISSING-DEPENDENCY", {
    references: {
      ...readyInput("SV-FIELD-MISSING-DEPENDENCY").references,
      dependencySatisfactionReference: undefined,
    },
  }),
  readyInput("SV-FIELD-INVALID-LIFECYCLE", {
    lifecycleState: "FIELD_READY",
  }),
  readyInput("SV-FIELD-MISSING-VENDOR-ALLOCATION", {
    workPackages: workPackagesFor("SV-FIELD-MISSING-VENDOR-ALLOCATION", {
      source: {
        ...workPackageInput("SV-FIELD-MISSING-VENDOR-ALLOCATION").source,
        vendorIds: [],
      },
    }),
  }),
  readyInput("SV-FIELD-AI-ADVISORY-REJECTED", {
    riskContext: {
      aiAdvisoryRecommendation: true,
    },
  }),
]);

export const fullyApprovedFieldActivationFixture: FieldActivationDraftInput = {
  ...readyInput("SV-FIELD-FULLY-APPROVED"),
  activationId: "FIELD-ACTIVATE-SV-FIELD-FULLY-APPROVED",
  notes: "Fixture validates Field activation authority without performing Field closure.",
};

export const fieldActivationReadinessResultFixtures = Object.freeze(
  fieldActivationReadinessInputFixtures.map(evaluateFieldReadiness),
);

export const fieldActivationApprovedResultFixture = validateFieldActivation(fullyApprovedFieldActivationFixture);

export function evaluateFieldActivationFixtures() {
  return {
    readinessFixtureCount: fieldActivationReadinessResultFixtures.length,
    fieldReadyCount: fieldActivationReadinessResultFixtures.filter((result) => result.status === "FIELD_READY").length,
    notReadyCount: fieldActivationReadinessResultFixtures.filter((result) => result.status === "NOT_READY").length,
    reviewRequiredCount: fieldActivationReadinessResultFixtures.filter((result) => result.status === "REVIEW_REQUIRED").length,
    activationStatus: fieldActivationApprovedResultFixture.status,
    activationCloseType: fieldActivationApprovedResultFixture.fieldClose?.closeType,
    blockers: [
      ...fieldActivationReadinessResultFixtures.flatMap((result) =>
        result.blockers.map((blocker) => ({
          scopeVersionId: result.scopeVersionId,
          code: blocker.code,
          severity: blocker.severity,
        })),
      ),
      ...fieldActivationApprovedResultFixture.blockers.map((blocker) => ({
        scopeVersionId: fieldActivationApprovedResultFixture.scopeVersionId,
        code: blocker.code,
        severity: blocker.severity,
      })),
    ],
  };
}
