import type { ScopeVersionCloseEvent, ScopeVersionCloseType } from "../scopeversion/ScopeVersionCloseAuthority";
import { SCOPEVERSION_STATE_REGISTRY, type ScopeVersionState } from "../scopeversion/ScopeVersionLifecycle";
import {
  CONTRACT_SOF_REQUIREMENTS,
  type ContractReadinessStatus,
  type ContractSofBlocker,
  type ContractSofBlockerCode,
  type ContractSofBlockerSeverity,
  type ContractSofDiagnostic,
  type ContractSofDiagnosticCode,
  type ContractSofGate,
  type ContractSofGateEvaluation,
  type ContractSofReadinessAudit,
  type ContractSofReadinessInput,
  type ContractSofReadinessResult,
  type ContractSofReadinessStatus,
  type ContractSofRequirement,
  type SofReadinessStatus,
} from "./ContractSofReadiness";

const customerAcceptedIndex = SCOPEVERSION_STATE_REGISTRY.indexOf("CUSTOMER_ACCEPTED");

function nowIso() {
  return new Date().toISOString();
}

function diagnostic(
  code: ContractSofDiagnosticCode,
  severity: ContractSofDiagnostic["severity"],
  message: string,
  details?: Record<string, unknown>,
): ContractSofDiagnostic {
  return { code, severity, message, details };
}

export function evaluateContractSofReadiness(input: ContractSofReadinessInput): ContractSofReadinessResult {
  const started = diagnostic("CONTRACT_SOF_READINESS_STARTED", "INFO", "Contract and SOF readiness evaluation started.", {
    scopeVersionId: input.scopeVersionId,
    lifecycleState: input.lifecycleState,
  });
  console.info("[CONTRACT_SOF_READINESS_STARTED]", {
    scopeVersionId: input.scopeVersionId,
    lifecycleState: input.lifecycleState,
  });

  const sof = evaluateSofReadiness(input);
  const contract = evaluateContractReadiness(input);
  const blockers = identifyContractSofBlockers(input, "BOTH");
  const overallStatus = combineStatuses(sof.status as SofReadinessStatus, contract.status as ContractReadinessStatus);
  const statusDiagnostic = readinessStatusDiagnostic(overallStatus, blockers.length);
  const audit = createContractSofReadinessAudit(input, sof, contract, blockers, [started, statusDiagnostic]);
  const diagnostics = [started, ...sof.diagnostics, ...contract.diagnostics, statusDiagnostic, ...audit.diagnostics];

  return {
    scopeVersionId: input.scopeVersionId ?? "",
    lifecycleState: input.lifecycleState,
    sofStatus: sof.status as SofReadinessStatus,
    contractStatus: contract.status as ContractReadinessStatus,
    overallStatus,
    sof,
    contract,
    blockers,
    audit,
    diagnostics,
  };
}

export function evaluateSofReadiness(input: ContractSofReadinessInput): ContractSofGateEvaluation {
  const blockers = identifyContractSofBlockers(input, "SOF");
  const status = statusFromBlockers(blockers);
  const requirements = requirementsForGate("SOF");
  const missingRequirementIds = blockerRequirementIds(blockers);
  const evaluation = {
    gate: "SOF",
    status,
    blockers,
    satisfiedRequirementIds: requirements
      .map((requirement) => requirement.requirementId)
      .filter((requirementId) => !missingRequirementIds.includes(requirementId)),
    missingRequirementIds,
    diagnostics: [
      diagnostic("SOF_READINESS_EVALUATED", status === "READY" ? "INFO" : "WARNING", `SOF readiness evaluated as ${status}.`, {
        blockerCount: blockers.length,
      }),
      ...blockerDiagnostics(blockers),
    ],
  } satisfies ContractSofGateEvaluation;

  console.info("[SOF_READINESS_EVALUATED]", {
    scopeVersionId: input.scopeVersionId,
    status,
    blockerCount: blockers.length,
  });

  return evaluation;
}

export function evaluateContractReadiness(input: ContractSofReadinessInput): ContractSofGateEvaluation {
  const blockers = identifyContractSofBlockers(input, "CONTRACT");
  const status = statusFromBlockers(blockers);
  const requirements = requirementsForGate("CONTRACT");
  const missingRequirementIds = blockerRequirementIds(blockers);
  const evaluation = {
    gate: "CONTRACT",
    status,
    blockers,
    satisfiedRequirementIds: requirements
      .map((requirement) => requirement.requirementId)
      .filter((requirementId) => !missingRequirementIds.includes(requirementId)),
    missingRequirementIds,
    diagnostics: [
      diagnostic("CONTRACT_READINESS_EVALUATED", status === "READY" ? "INFO" : "WARNING", `Contract readiness evaluated as ${status}.`, {
        blockerCount: blockers.length,
      }),
      ...blockerDiagnostics(blockers),
    ],
  } satisfies ContractSofGateEvaluation;

  console.info("[CONTRACT_READINESS_EVALUATED]", {
    scopeVersionId: input.scopeVersionId,
    status,
    blockerCount: blockers.length,
  });

  return evaluation;
}

export function identifyContractSofBlockers(
  input: ContractSofReadinessInput,
  gate: ContractSofGate = "BOTH",
): ContractSofBlocker[] {
  const blockers: ContractSofBlocker[] = [];
  const requirements = requirementsForGate(gate);

  for (const requirement of requirements) {
    if (!isRequirementSatisfied(input, requirement)) {
      blockers.push(createBlocker(input, requirement, gate));
    }
  }

  blockers.push(...riskBlockers(input, gate));

  for (const blocker of blockers) {
    console.info("[CONTRACT_SOF_BLOCKER_IDENTIFIED]", {
      scopeVersionId: input.scopeVersionId,
      blockerCode: blocker.code,
      gate: blocker.gate,
      severity: blocker.severity,
    });
  }

  return dedupeBlockers(blockers);
}

export function createContractSofReadinessAudit(
  input: ContractSofReadinessInput,
  sof: ContractSofGateEvaluation,
  contract: ContractSofGateEvaluation,
  blockers: readonly ContractSofBlocker[] = identifyContractSofBlockers(input, "BOTH"),
  diagnostics: readonly ContractSofDiagnostic[] = [],
): ContractSofReadinessAudit {
  const overallStatus = combineStatuses(sof.status as SofReadinessStatus, contract.status as ContractReadinessStatus);
  const audit = {
    auditId: `CONTRACT-SOF-AUDIT-${input.scopeVersionId ?? "UNKNOWN"}-${Date.now()}`,
    scopeVersionId: input.scopeVersionId ?? "",
    lifecycleState: input.lifecycleState,
    sofStatus: sof.status as SofReadinessStatus,
    contractStatus: contract.status as ContractReadinessStatus,
    overallStatus,
    blockerIds: blockers.map((blocker) => blocker.blockerId),
    closeIds: input.closes.filter((close) => isValidatedCloseForScope(close, input.scopeVersionId ?? "")).map((close) => close.closeId),
    evaluatedBy: input.evaluatedBy,
    evaluatedAt: nowIso(),
    diagnostics: [
      ...diagnostics,
      diagnostic("CONTRACT_SOF_AUDIT_CREATED", "INFO", "Contract and SOF readiness audit created.", {
        blockerCount: blockers.length,
        overallStatus,
      }),
    ],
  } satisfies ContractSofReadinessAudit;

  console.info("[CONTRACT_SOF_AUDIT_CREATED]", {
    auditId: audit.auditId,
    scopeVersionId: audit.scopeVersionId,
    overallStatus: audit.overallStatus,
  });

  return audit;
}

function requirementsForGate(gate: ContractSofGate): ContractSofRequirement[] {
  return CONTRACT_SOF_REQUIREMENTS.filter((requirement) => {
    if (gate === "BOTH") return true;
    return requirement.gate === gate || requirement.gate === "BOTH";
  });
}

function isRequirementSatisfied(input: ContractSofReadinessInput, requirement: ContractSofRequirement): boolean {
  switch (requirement.blockerCode) {
    case "MISSING_SCOPEVERSION_ID":
      return Boolean(input.scopeVersionId);
    case "MISSING_CUSTOMER_ID":
      return Boolean(input.customerId);
    case "MISSING_OPPORTUNITY_ID":
      return Boolean(input.opportunityId);
    case "MISSING_CORRIDOR_ID":
      return Boolean(input.corridorId);
    case "LIFECYCLE_STATE_TOO_EARLY":
      return isAtOrBeyondCustomerAccepted(input.lifecycleState);
    case "MISSING_ENGINEERING_CLOSE":
      return hasValidatedClose(input, "ENGINEERING_CLOSE");
    case "MISSING_BUDGET_CLOSE":
      return hasValidatedClose(input, "BUDGET_CLOSE");
    case "MISSING_VENDOR_ACCEPTANCE_CLOSE":
      return input.riskContext?.vendorAcceptanceRequired === false || hasValidatedClose(input, "VENDOR_ACCEPTANCE_CLOSE");
    case "MISSING_CUSTOMER_ACCEPTANCE_CLOSE":
      return hasValidatedClose(input, "CUSTOMER_ACCEPTANCE_CLOSE");
    case "MISSING_LOCKED_BUDGET":
      return Boolean(input.references.lockedBudgetReference);
    case "MISSING_PRODUCT_PLAN":
      return Boolean(input.references.approvedProductPlan);
    case "MISSING_SERVICE_DESCRIPTION":
      return Boolean(input.references.serviceDescription);
    case "MISSING_SERVICE_LOCATIONS":
      return Boolean(input.references.serviceLocations?.length);
    case "MISSING_APPROVED_CAPACITY":
      return Boolean(input.references.approvedCapacity);
    case "MISSING_TERM_ASSUMPTIONS":
      return Boolean(input.references.termAssumptions);
    case "MISSING_PRICING_REFERENCE":
      return Boolean(input.references.pricingReference ?? input.references.lockedBudgetReference);
    case "MISSING_APPROVED_OBJECT_PACKAGE":
      return Boolean(input.references.approvedObjectPackage);
    case "MISSING_CUSTOMER_LEGAL_PROFILE":
      return Boolean(input.references.customerLegalProfile);
    case "MISSING_BILLING_PROFILE":
      return Boolean(input.references.billingProfile);
    case "MISSING_APPROVED_SCOPE":
      return Boolean(input.references.approvedScope ?? input.scopeVersionId);
    case "MISSING_APPROVED_VENDOR_SELECTION":
      return input.riskContext?.vendorAcceptanceRequired === false || Boolean(input.references.approvedVendorSelections?.length);
    case "MISSING_APPROVED_COMMERCIAL_TERMS":
      return Boolean(input.references.approvedCommercialTerms);
    case "MISSING_RISK_NOTES":
      return Boolean(input.references.riskNotes?.length);
    case "MISSING_REQUIRED_EXHIBITS":
      return Boolean(input.references.requiredExhibits?.length);
    case "MISSING_ENGINEERING_PACKAGE":
      return Boolean(input.references.engineeringPackageReference);
    case "MISSING_CONTRACT_REVIEWER_ROLE":
      return Boolean(input.references.contractReviewerRole);
    default:
      return true;
  }
}

function riskBlockers(input: ContractSofReadinessInput, gate: ContractSofGate): ContractSofBlocker[] {
  const blockers: ContractSofBlocker[] = [];
  const riskContext = input.riskContext;
  if (!riskContext) return blockers;

  if (riskContext.unresolvedHighSeverityBlockers?.length) {
    blockers.push(createRiskBlocker(input, gate, "UNRESOLVED_HIGH_SEVERITY_RISK", "HIGH", "High-severity blockers remain unresolved."));
  }

  if (riskContext.unresolvedDesignStandardExceptions?.length) {
    blockers.push(createRiskBlocker(input, gate, "UNRESOLVED_DESIGN_STANDARD_EXCEPTION", "MEDIUM", "Design standard exceptions require review."));
  }

  if (riskContext.rejectedLifecycleTransitions?.length) {
    blockers.push(createRiskBlocker(input, gate, "REJECTED_LIFECYCLE_TRANSITION", "HIGH", "Rejected lifecycle transitions must be resolved."));
  }

  if (riskContext.aiAdvisoryOnlyRecommendation) {
    blockers.push(createRiskBlocker(input, gate, "AI_ADVISORY_ONLY_RECOMMENDATION", "HIGH", "AI advisory output cannot establish contract/SOF readiness."));
  }

  return blockers;
}

function createBlocker(
  input: ContractSofReadinessInput,
  requirement: ContractSofRequirement,
  requestedGate: ContractSofGate,
): ContractSofBlocker {
  const blockerGate = requestedGate === "BOTH" ? requirement.gate : requestedGate;
  return {
    blockerId: `BLOCKER-${input.scopeVersionId ?? "UNKNOWN"}-${requirement.blockerCode}`,
    code: requirement.blockerCode,
    gate: blockerGate,
    severity: requirement.severity,
    message: requirement.description,
    requirementId: requirement.requirementId,
    resolved: false,
  };
}

function createRiskBlocker(
  input: ContractSofReadinessInput,
  gate: ContractSofGate,
  code: ContractSofBlockerCode,
  severity: ContractSofBlockerSeverity,
  message: string,
): ContractSofBlocker {
  return {
    blockerId: `BLOCKER-${input.scopeVersionId ?? "UNKNOWN"}-${code}`,
    code,
    gate,
    severity,
    message,
    resolved: false,
  };
}

function blockerDiagnostics(blockers: readonly ContractSofBlocker[]): ContractSofDiagnostic[] {
  return blockers.map((blocker) =>
    diagnostic("CONTRACT_SOF_BLOCKER_IDENTIFIED", blocker.severity === "HIGH" ? "ERROR" : "WARNING", blocker.message, {
      blockerId: blocker.blockerId,
      code: blocker.code,
      gate: blocker.gate,
      severity: blocker.severity,
    }),
  );
}

function readinessStatusDiagnostic(
  status: ContractSofReadinessStatus,
  blockerCount: number,
): ContractSofDiagnostic {
  if (status === "READY") {
    console.info("[CONTRACT_SOF_READY]", { blockerCount });
    return diagnostic("CONTRACT_SOF_READY", "INFO", "Contract and SOF readiness passed.", { blockerCount });
  }

  if (status === "REVIEW_REQUIRED") {
    console.info("[CONTRACT_SOF_REVIEW_REQUIRED]", { blockerCount });
    return diagnostic("CONTRACT_SOF_REVIEW_REQUIRED", "WARNING", "Contract and SOF readiness requires review.", { blockerCount });
  }

  console.info("[CONTRACT_SOF_NOT_READY]", { blockerCount });
  return diagnostic("CONTRACT_SOF_NOT_READY", "ERROR", "Contract and SOF readiness failed.", { blockerCount });
}

function statusFromBlockers(blockers: readonly ContractSofBlocker[]): ContractReadinessStatus {
  if (blockers.some((blocker) => blocker.severity === "HIGH")) return "NOT_READY";
  if (blockers.length > 0) return "REVIEW_REQUIRED";
  return "READY";
}

function combineStatuses(sofStatus: SofReadinessStatus, contractStatus: ContractReadinessStatus): ContractSofReadinessStatus {
  if (sofStatus === "NOT_READY" || contractStatus === "NOT_READY") return "NOT_READY";
  if (sofStatus === "REVIEW_REQUIRED" || contractStatus === "REVIEW_REQUIRED") return "REVIEW_REQUIRED";
  return "READY";
}

function hasValidatedClose(input: ContractSofReadinessInput, closeType: ScopeVersionCloseType): boolean {
  return input.closes.some(
    (close) => close.closeType === closeType && isValidatedCloseForScope(close, input.scopeVersionId ?? ""),
  );
}

function isValidatedCloseForScope(close: ScopeVersionCloseEvent, scopeVersionId: string) {
  return close.scopeVersionId === scopeVersionId && close.immutable === true && Boolean(close.validatedAt);
}

function isAtOrBeyondCustomerAccepted(state: ScopeVersionState): boolean {
  if (state === "SUPERSEDED" || state === "CANCELLED") return false;
  const index = SCOPEVERSION_STATE_REGISTRY.indexOf(state);
  return index >= customerAcceptedIndex && customerAcceptedIndex >= 0;
}

function blockerRequirementIds(blockers: readonly ContractSofBlocker[]): string[] {
  return [...new Set(blockers.map((blocker) => blocker.requirementId).filter((requirementId): requirementId is string => Boolean(requirementId)))];
}

function dedupeBlockers(blockers: readonly ContractSofBlocker[]): ContractSofBlocker[] {
  const seen = new Set<string>();
  return blockers.filter((blocker) => {
    const key = `${blocker.gate}:${blocker.code}:${blocker.requirementId ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
