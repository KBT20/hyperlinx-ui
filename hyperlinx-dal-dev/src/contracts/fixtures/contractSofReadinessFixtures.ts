import type { ScopeVersionCloseActorRole, ScopeVersionCloseEvent, ScopeVersionCloseType } from "../../scopeversion/ScopeVersionCloseAuthority";
import {
  createScopeVersionCloseDraft,
  validateScopeVersionClose,
} from "../../scopeversion/ScopeVersionCloseAuthorityEngine";
import type { ScopeVersionState } from "../../scopeversion/ScopeVersionLifecycle";
import type { ContractSofReadinessInput } from "../ContractSofReadiness";
import { evaluateContractSofReadiness } from "../ContractSofReadinessEngine";

const trace = {
  scopeVersionId: "SV-DAL-CONTRACT-SOF-READY",
  customerId: "CUSTOMER-HYPERSCALER-001",
  opportunityId: "OPP-AI-LONGHAUL-001",
  corridorId: "CORRIDOR-DALLAS-KANSAS-CITY",
};

function close(input: {
  scopeVersionId?: string;
  closeId: string;
  closeType: ScopeVersionCloseType;
  actorId: string;
  actorRole: ScopeVersionCloseActorRole;
  previousState: ScopeVersionState;
  resultingState: ScopeVersionState;
}): ScopeVersionCloseEvent {
  const draft = createScopeVersionCloseDraft({
    ...trace,
    scopeVersionId: input.scopeVersionId ?? trace.scopeVersionId,
    closeId: input.closeId,
    closeType: input.closeType,
    actorId: input.actorId,
    actorRole: input.actorRole,
    evidenceIds: [`EV-${input.closeId}`],
    inputReferences: [
      {
        referenceId: trace.scopeVersionId,
        referenceType: "ScopeVersion",
        source: "ContractSofReadinessFixture",
        immutable: true,
      },
    ],
    constraintReferences: [
      {
        referenceId: `CONSTRAINT-${input.closeId}`,
        referenceType: "ReadinessConstraint",
        source: "ContractSofReadinessFixture",
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

export const contractSofCloseFixtures: readonly ScopeVersionCloseEvent[] = Object.freeze([
  close({
    closeId: "CONTRACT-SOF-CLOSE-ENGINEERING",
    closeType: "ENGINEERING_CLOSE",
    actorId: "engineer-001",
    actorRole: "TERALINX_ENGINEERING",
    previousState: "ENGINEERING_REVIEW",
    resultingState: "ENGINEERING_APPROVED",
  }),
  close({
    closeId: "CONTRACT-SOF-CLOSE-BUDGET",
    closeType: "BUDGET_CLOSE",
    actorId: "finance-001",
    actorRole: "FINANCE",
    previousState: "BUDGET_CANDIDATE",
    resultingState: "BUDGET_LOCKED",
  }),
  close({
    closeId: "CONTRACT-SOF-CLOSE-VENDOR",
    closeType: "VENDOR_ACCEPTANCE_CLOSE",
    actorId: "vendor-001",
    actorRole: "VENDOR",
    previousState: "VENDOR_REVIEW",
    resultingState: "VENDOR_ACCEPTED",
  }),
  close({
    closeId: "CONTRACT-SOF-CLOSE-CUSTOMER",
    closeType: "CUSTOMER_ACCEPTANCE_CLOSE",
    actorId: "customer-001",
    actorRole: "CUSTOMER",
    previousState: "CUSTOMER_REVIEW",
    resultingState: "CUSTOMER_ACCEPTED",
  }),
]);

function closesFor(scopeVersionId: string): ScopeVersionCloseEvent[] {
  return [
    close({
      scopeVersionId,
      closeId: `${scopeVersionId}-ENGINEERING`,
      closeType: "ENGINEERING_CLOSE",
      actorId: "engineer-001",
      actorRole: "TERALINX_ENGINEERING",
      previousState: "ENGINEERING_REVIEW",
      resultingState: "ENGINEERING_APPROVED",
    }),
    close({
      scopeVersionId,
      closeId: `${scopeVersionId}-BUDGET`,
      closeType: "BUDGET_CLOSE",
      actorId: "finance-001",
      actorRole: "FINANCE",
      previousState: "BUDGET_CANDIDATE",
      resultingState: "BUDGET_LOCKED",
    }),
    close({
      scopeVersionId,
      closeId: `${scopeVersionId}-VENDOR`,
      closeType: "VENDOR_ACCEPTANCE_CLOSE",
      actorId: "vendor-001",
      actorRole: "VENDOR",
      previousState: "VENDOR_REVIEW",
      resultingState: "VENDOR_ACCEPTED",
    }),
    close({
      scopeVersionId,
      closeId: `${scopeVersionId}-CUSTOMER`,
      closeType: "CUSTOMER_ACCEPTANCE_CLOSE",
      actorId: "customer-001",
      actorRole: "CUSTOMER",
      previousState: "CUSTOMER_REVIEW",
      resultingState: "CUSTOMER_ACCEPTED",
    }),
  ];
}

const readyInput: ContractSofReadinessInput = {
  ...trace,
  lifecycleState: "CUSTOMER_ACCEPTED",
  closes: closesFor(trace.scopeVersionId),
  evaluatedBy: "contract-readiness-fixture",
  references: {
    lockedBudgetReference: "BUDGET-LOCK-AI-LONGHAUL-001",
    approvedVendorScopeReference: "VENDOR-SCOPE-FIBER-001",
    approvedProductPlan: "PRODUCT-PLAN-AI-INTERCONNECT",
    approvedObjectPackage: "OBJECT-PACKAGE-AI-LONGHAUL",
    serviceDescription: "Dallas to Kansas City AI interconnect service.",
    serviceLocations: ["Dallas, TX", "Kansas City, MO"],
    approvedCapacity: "400G protected optical transport",
    termAssumptions: "60 month term",
    pricingReference: "PRICEBOOK-AI-LONGHAUL-001",
    customerLegalProfile: "CUSTOMER-LEGAL-HYPERSCALER-001",
    billingProfile: "BILLING-HYPERSCALER-001",
    approvedScope: trace.scopeVersionId,
    approvedVendorSelections: ["VENDOR-FIBER-001", "VENDOR-CONSTRUCTION-001"],
    approvedCommercialTerms: "COMMERCIAL-TERMS-AI-LONGHAUL-001",
    riskNotes: ["Standard construction and interconnection risks accepted."],
    requiredExhibits: ["EXHIBIT-A-SCOPE", "EXHIBIT-B-PRICING", "EXHIBIT-C-SLA"],
    engineeringPackageReference: "ENGINEERING-PACKAGE-AI-LONGHAUL-001",
    contractReviewerRole: "LEGAL",
  },
  riskContext: {
    vendorAcceptanceRequired: true,
  },
};

export const contractSofReadinessInputFixtures: readonly ContractSofReadinessInput[] = Object.freeze([
  readyInput,
  {
    ...readyInput,
    scopeVersionId: "SV-DAL-CONTRACT-SOF-MISSING-BUDGET",
    closes: closesFor("SV-DAL-CONTRACT-SOF-MISSING-BUDGET").filter((closeEvent) => closeEvent.closeType !== "BUDGET_CLOSE"),
  },
  {
    ...readyInput,
    scopeVersionId: "SV-DAL-CONTRACT-SOF-MISSING-LEGAL-PROFILE",
    closes: closesFor("SV-DAL-CONTRACT-SOF-MISSING-LEGAL-PROFILE"),
    references: {
      ...readyInput.references,
      customerLegalProfile: undefined,
    },
  },
  {
    ...readyInput,
    scopeVersionId: "SV-DAL-CONTRACT-SOF-DESIGN-EXCEPTION",
    closes: closesFor("SV-DAL-CONTRACT-SOF-DESIGN-EXCEPTION"),
    riskContext: {
      vendorAcceptanceRequired: true,
      unresolvedDesignStandardExceptions: ["Exception: non-standard diversity path requires legal review."],
    },
  },
  {
    ...readyInput,
    scopeVersionId: "SV-DAL-CONTRACT-SOF-LIFECYCLE-EARLY",
    closes: closesFor("SV-DAL-CONTRACT-SOF-LIFECYCLE-EARLY"),
    lifecycleState: "BUDGET_LOCKED",
  },
  {
    ...readyInput,
    scopeVersionId: "SV-DAL-SOF-READY-CONTRACT-REVIEW",
    closes: closesFor("SV-DAL-SOF-READY-CONTRACT-REVIEW"),
    references: {
      ...readyInput.references,
      billingProfile: undefined,
      requiredExhibits: undefined,
    },
  },
  {
    ...readyInput,
    scopeVersionId: "SV-DAL-CONTRACT-READY-NOT-EXECUTED",
    closes: closesFor("SV-DAL-CONTRACT-READY-NOT-EXECUTED"),
    lifecycleState: "CONTRACT_REVIEW",
  },
  {
    ...readyInput,
    scopeVersionId: "SV-DAL-CONTRACT-SOF-AI-ADVISORY-BLOCKED",
    closes: closesFor("SV-DAL-CONTRACT-SOF-AI-ADVISORY-BLOCKED"),
    riskContext: {
      vendorAcceptanceRequired: true,
      aiAdvisoryOnlyRecommendation: true,
    },
  },
]);

export const contractSofReadinessResultFixtures = Object.freeze(
  contractSofReadinessInputFixtures.map(evaluateContractSofReadiness),
);

export function evaluateContractSofReadinessFixtures() {
  return {
    fixtureCount: contractSofReadinessResultFixtures.length,
    readyCount: contractSofReadinessResultFixtures.filter((result) => result.overallStatus === "READY").length,
    reviewRequiredCount: contractSofReadinessResultFixtures.filter((result) => result.overallStatus === "REVIEW_REQUIRED").length,
    notReadyCount: contractSofReadinessResultFixtures.filter((result) => result.overallStatus === "NOT_READY").length,
    blockers: contractSofReadinessResultFixtures.flatMap((result) =>
      result.blockers.map((blocker) => ({
        scopeVersionId: result.scopeVersionId,
        code: blocker.code,
        severity: blocker.severity,
        gate: blocker.gate,
      })),
    ),
  };
}
