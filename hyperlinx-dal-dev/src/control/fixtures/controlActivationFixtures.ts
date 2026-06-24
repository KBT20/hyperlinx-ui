import type { ScopeVersionCloseActorRole, ScopeVersionCloseEvent, ScopeVersionCloseType } from "../../scopeversion/ScopeVersionCloseAuthority";
import {
  createScopeVersionCloseDraft,
  validateScopeVersionClose,
} from "../../scopeversion/ScopeVersionCloseAuthorityEngine";
import type { ScopeVersionState } from "../../scopeversion/ScopeVersionLifecycle";
import type { ControlActivationDraftInput, ControlActivationReadinessInput } from "../ControlActivationReadiness";
import {
  evaluateControlReadiness,
  validateControlActivation,
} from "../ControlActivationEngine";

const baseTrace = {
  customerId: "CUSTOMER-HYPERSCALER-001",
  opportunityId: "OPP-CONTROL-AUTHORITY-001",
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
    ...baseTrace,
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
        source: "ControlActivationFixture",
        immutable: true,
      },
    ],
    constraintReferences: [
      {
        referenceId: `CONSTRAINT-${input.closeId}`,
        referenceType: "ControlActivationConstraint",
        source: "ControlActivationFixture",
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

function contractCloseFor(scopeVersionId: string): ScopeVersionCloseEvent {
  return close({
    scopeVersionId,
    closeId: `${scopeVersionId}-CONTRACT-CLOSE`,
    closeType: "CONTRACT_CLOSE",
    actorId: "legal-001",
    actorRole: "LEGAL",
    previousState: "CONTRACT_REVIEW",
    resultingState: "CONTRACT_EXECUTED",
  });
}

function readyInput(scopeVersionId: string, overrides: Partial<ControlActivationReadinessInput> = {}): ControlActivationReadinessInput {
  return {
    ...baseTrace,
    scopeVersionId,
    lifecycleState: "CONTRACT_EXECUTED",
    closes: [contractCloseFor(scopeVersionId)],
    actorId: "ops-001",
    actorRole: "TERALINX_OPERATIONS",
    references: {
      engineeringPackageReference: `ENG-PKG-${scopeVersionId}`,
      budgetReference: `BUDGET-${scopeVersionId}`,
      approvedVendorSelections: [`VENDOR-${scopeVersionId}`],
      approvedObjectPackage: `OBJECT-PACKAGE-${scopeVersionId}`,
      executionStrategy: `EXECUTION-STRATEGY-${scopeVersionId}`,
      designStandardsApproval: `DESIGN-STANDARDS-${scopeVersionId}`,
      referenceArchitecture: `REFERENCE-ARCHITECTURE-${scopeVersionId}`,
      closeChainValidation: `CLOSE-CHAIN-${scopeVersionId}`,
    },
    riskContext: {
      vendorAcceptanceRequired: true,
    },
    ...overrides,
  };
}

export const controlActivationReadinessInputFixtures: readonly ControlActivationReadinessInput[] = Object.freeze([
  readyInput("SV-CONTROL-HYPERSCALER-LONGHAUL"),
  readyInput("SV-CONTROL-METRO-AGGREGATION", {
    opportunityId: "OPP-METRO-AGGREGATION-001",
    corridorId: "CORRIDOR-METRO-001",
  }),
  readyInput("SV-CONTROL-AI-CORRIDOR", {
    opportunityId: "OPP-AI-CORRIDOR-001",
    corridorId: "CORRIDOR-AI-WEST-TEXAS",
  }),
  readyInput("SV-CONTROL-MISSING-CONTRACT", {
    closes: [],
  }),
  readyInput("SV-CONTROL-MISSING-ENGINEERING", {
    references: {
      ...readyInput("SV-CONTROL-MISSING-ENGINEERING").references,
      engineeringPackageReference: undefined,
    },
  }),
  readyInput("SV-CONTROL-INVALID-LIFECYCLE", {
    lifecycleState: "CUSTOMER_ACCEPTED",
  }),
  readyInput("SV-CONTROL-MISSING-REFERENCE-ARCHITECTURE", {
    references: {
      ...readyInput("SV-CONTROL-MISSING-REFERENCE-ARCHITECTURE").references,
      referenceArchitecture: undefined,
    },
  }),
  readyInput("SV-CONTROL-MISSING-EXECUTION-STRATEGY", {
    references: {
      ...readyInput("SV-CONTROL-MISSING-EXECUTION-STRATEGY").references,
      executionStrategy: undefined,
    },
  }),
  readyInput("SV-CONTROL-AI-ADVISORY-REJECTED", {
    riskContext: {
      vendorAcceptanceRequired: true,
      aiAdvisoryOnlyRecommendation: true,
    },
  }),
]);

export const fullyApprovedControlActivationFixture: ControlActivationDraftInput = {
  ...readyInput("SV-CONTROL-FULLY-APPROVED"),
  activationId: "CONTROL-ACTIVATE-SV-CONTROL-FULLY-APPROVED",
  notes: "Fixture validates Control activation authority without creating work packages.",
};

export const controlActivationReadinessResultFixtures = Object.freeze(
  controlActivationReadinessInputFixtures.map(evaluateControlReadiness),
);

export const controlActivationApprovedResultFixture = validateControlActivation(fullyApprovedControlActivationFixture);

export function evaluateControlActivationFixtures() {
  return {
    readinessFixtureCount: controlActivationReadinessResultFixtures.length,
    controlReadyCount: controlActivationReadinessResultFixtures.filter((result) => result.status === "CONTROL_READY").length,
    notReadyCount: controlActivationReadinessResultFixtures.filter((result) => result.status === "NOT_READY").length,
    reviewRequiredCount: controlActivationReadinessResultFixtures.filter((result) => result.status === "REVIEW_REQUIRED").length,
    activationStatus: controlActivationApprovedResultFixture.status,
    activationCloseType: controlActivationApprovedResultFixture.controlClose?.closeType,
    blockers: [
      ...controlActivationReadinessResultFixtures.flatMap((result) =>
        result.blockers.map((blocker) => ({
          scopeVersionId: result.scopeVersionId,
          code: blocker.code,
          severity: blocker.severity,
        })),
      ),
      ...controlActivationApprovedResultFixture.blockers.map((blocker) => ({
        scopeVersionId: controlActivationApprovedResultFixture.scopeVersionId,
        code: blocker.code,
        severity: blocker.severity,
      })),
    ],
  };
}
