import type { ScopeVersionCloseEvent } from "../scopeversion/ScopeVersionCloseAuthority";
import {
  createScopeVersionCloseDraft,
  validateScopeVersionClose,
} from "../scopeversion/ScopeVersionCloseAuthorityEngine";
import { evaluateTransition } from "../scopeversion/ScopeVersionTransitionAuthorityEngine";
import type {
  ControlActivationAudit,
  ControlActivationBlocker,
  ControlActivationBlockerCode,
  ControlActivationBlockerSeverity,
  ControlActivationDiagnostic,
  ControlActivationDiagnosticCode,
  ControlActivationRequirement,
} from "./ControlActivationAuthority";
import { CONTROL_ACTIVATION_REQUIREMENTS } from "./ControlActivationAuthority";
import type {
  ControlActivationDraftInput,
  ControlActivationReadiness,
  ControlActivationReadinessInput,
} from "./ControlActivationReadiness";

export interface ControlActivationResult {
  scopeVersionId: string;
  status: "NOT_READY" | "REVIEW_REQUIRED" | "CONTROL_READY" | "CONTROL_ACTIVE";
  readiness: ControlActivationReadiness;
  controlCloseDraft?: ScopeVersionCloseEvent;
  controlClose?: ScopeVersionCloseEvent;
  transitionResults: ReturnType<typeof evaluateTransition>[];
  blockers: ControlActivationBlocker[];
  audit: ControlActivationAudit;
  diagnostics: ControlActivationDiagnostic[];
}

function nowIso() {
  return new Date().toISOString();
}

function diagnostic(
  code: ControlActivationDiagnosticCode,
  severity: ControlActivationDiagnostic["severity"],
  message: string,
  details?: Record<string, unknown>,
): ControlActivationDiagnostic {
  return { code, severity, message, details };
}

export function getControlActivationRequirements(): readonly ControlActivationRequirement[] {
  return CONTROL_ACTIVATION_REQUIREMENTS;
}

export function evaluateControlReadiness(input: ControlActivationReadinessInput): ControlActivationReadiness {
  const started = diagnostic("CONTROL_READINESS_STARTED", "INFO", "Control readiness evaluation started.", {
    scopeVersionId: input.scopeVersionId,
    lifecycleState: input.lifecycleState,
  });
  console.info("[CONTROL_READINESS_STARTED]", {
    scopeVersionId: input.scopeVersionId,
    lifecycleState: input.lifecycleState,
  });

  const blockers = identifyControlBlockers(input);
  const missingRequirementIds = blockerRequirementIds(blockers);
  const status = controlStatusFromBlockers(blockers);
  const diagnostics = [
    started,
    diagnostic("CONTROL_REQUIREMENTS_VALIDATED", status === "CONTROL_READY" ? "INFO" : "WARNING", `Control readiness evaluated as ${status}.`, {
      blockerCount: blockers.length,
    }),
    ...blockerDiagnostics(blockers),
  ];

  if (status === "CONTROL_READY") {
    console.info("[CONTROL_READY]", { scopeVersionId: input.scopeVersionId });
    diagnostics.push(diagnostic("CONTROL_READY", "INFO", "Control readiness passed."));
  }

  return {
    scopeVersionId: input.scopeVersionId ?? "",
    lifecycleState: input.lifecycleState,
    status,
    blockers,
    satisfiedRequirementIds: CONTROL_ACTIVATION_REQUIREMENTS.map((requirement) => requirement.requirementId).filter(
      (requirementId) => !missingRequirementIds.includes(requirementId),
    ),
    missingRequirementIds,
    diagnostics,
  };
}

export function validateControlActivation(input: ControlActivationDraftInput): ControlActivationResult {
  const readiness = evaluateControlReadiness(input);
  const blockers = [...readiness.blockers];
  const transitionResults: ControlActivationResult["transitionResults"] = [];
  let controlCloseDraft: ScopeVersionCloseEvent | undefined;
  let controlClose: ScopeVersionCloseEvent | undefined;

  if (readiness.status === "CONTROL_READY") {
    const controlReadyTransition = evaluateTransition({
      scopeVersionId: input.scopeVersionId ?? "",
      previousState: "CONTRACT_EXECUTED",
      requestedState: "CONTROL_READY",
      actorId: input.actorId,
      actorRole: input.actorRole,
      closes: input.closes,
    });
    transitionResults.push(controlReadyTransition);

    controlCloseDraft = createControlActivationDraft(input);
    const validation = validateScopeVersionClose(controlCloseDraft);
    controlClose = { ...controlCloseDraft, validatedAt: validation.validatedAt, immutable: validation.valid };

    if (!validation.valid) {
      blockers.push(createRuntimeBlocker(input, "CONTROL_CLOSE_REJECTED", "CRITICAL", "CONTROL_CLOSE validation was rejected."));
    }

    const controlActiveTransition = evaluateTransition({
      scopeVersionId: input.scopeVersionId ?? "",
      previousState: "CONTROL_READY",
      requestedState: "CONTROL_ACTIVE",
      actorId: input.actorId,
      actorRole: input.actorRole,
      closes: controlClose ? [...input.closes, controlClose] : input.closes,
    });
    transitionResults.push(controlActiveTransition);

    if (!controlReadyTransition.approved || !controlActiveTransition.approved) {
      blockers.push(createRuntimeBlocker(input, "LIFECYCLE_AUTHORITY_REJECTED", "CRITICAL", "Lifecycle authority rejected Control activation."));
    }
  }

  const status = blockers.some((blocker) => blocker.severity === "CRITICAL" || blocker.severity === "HIGH")
    ? "NOT_READY"
    : blockers.length
      ? "REVIEW_REQUIRED"
      : "CONTROL_ACTIVE";
  const activationDiagnostics = [
    ...readiness.diagnostics,
    ...(status === "CONTROL_ACTIVE"
      ? [diagnostic("CONTROL_ACTIVATION_APPROVED", "INFO", "Control activation approved.", { scopeVersionId: input.scopeVersionId })]
      : [diagnostic("CONTROL_ACTIVATION_REJECTED", "ERROR", "Control activation rejected.", { blockerCount: blockers.length })]),
  ];

  console.info(status === "CONTROL_ACTIVE" ? "[CONTROL_ACTIVATION_APPROVED]" : "[CONTROL_ACTIVATION_REJECTED]", {
    scopeVersionId: input.scopeVersionId,
    status,
    blockerCount: blockers.length,
  });

  const audit = createControlActivationAudit(input, status, blockers, transitionResults, activationDiagnostics);

  return {
    scopeVersionId: input.scopeVersionId ?? "",
    status,
    readiness,
    controlCloseDraft,
    controlClose,
    transitionResults,
    blockers,
    audit,
    diagnostics: [...activationDiagnostics, ...audit.diagnostics],
  };
}

export function createControlActivationDraft(input: ControlActivationDraftInput): ScopeVersionCloseEvent {
  return createScopeVersionCloseDraft({
    closeId: input.activationId,
    scopeVersionId: input.scopeVersionId,
    customerId: input.customerId,
    opportunityId: input.opportunityId,
    corridorId: input.corridorId,
    closeType: "CONTROL_CLOSE",
    actorId: input.actorId,
    actorRole: input.actorRole,
    evidenceIds: [
      input.references.engineeringPackageReference,
      input.references.budgetReference,
      input.references.approvedObjectPackage,
      input.references.executionStrategy,
      input.references.referenceArchitecture,
      input.references.closeChainValidation,
    ].filter((evidenceId): evidenceId is string => Boolean(evidenceId)),
    inputReferences: [
      {
        referenceId: input.scopeVersionId ?? "",
        referenceType: "ScopeVersion",
        source: "ControlActivationAuthority",
        immutable: true,
      },
    ],
    constraintReferences: [
      {
        referenceId: input.references.designStandardsApproval ?? "DESIGN-STANDARDS-UNKNOWN",
        referenceType: "DesignStandardsApproval",
        source: "ControlActivationAuthority",
        immutable: Boolean(input.references.designStandardsApproval),
      },
    ],
    outcome: {
      status: "ACCEPTED",
      previousState: "CONTROL_READY",
      resultingState: "CONTROL_ACTIVE",
      notes: input.notes,
    },
  });
}

export function identifyControlBlockers(input: ControlActivationReadinessInput): ControlActivationBlocker[] {
  const blockers: ControlActivationBlocker[] = [];

  for (const requirement of CONTROL_ACTIVATION_REQUIREMENTS) {
    if (!isRequirementSatisfied(input, requirement)) {
      blockers.push(createRequirementBlocker(input, requirement));
    }
  }

  if (input.riskContext?.unresolvedCriticalRisks?.length) {
    blockers.push(createRuntimeBlocker(input, "UNRESOLVED_CRITICAL_RISK", "CRITICAL", "Critical risks remain unresolved."));
  }

  if (input.riskContext?.aiAdvisoryOnlyRecommendation) {
    blockers.push(createRuntimeBlocker(input, "AI_ADVISORY_ONLY_RECOMMENDATION", "CRITICAL", "AI advisory output cannot create Control activation."));
  }

  const deduped = dedupeBlockers(blockers);
  for (const blocker of deduped) {
    console.info("[CONTROL_BLOCKER_IDENTIFIED]", {
      scopeVersionId: input.scopeVersionId,
      code: blocker.code,
      severity: blocker.severity,
    });
  }

  return deduped;
}

export function createControlActivationAudit(
  input: ControlActivationReadinessInput,
  status: ControlActivationResult["status"],
  blockers: readonly ControlActivationBlocker[],
  transitionResults: ControlActivationResult["transitionResults"] = [],
  diagnostics: readonly ControlActivationDiagnostic[] = [],
): ControlActivationAudit {
  const audit = {
    auditId: `CONTROL-ACTIVATION-AUDIT-${input.scopeVersionId ?? "UNKNOWN"}-${Date.now()}`,
    scopeVersionId: input.scopeVersionId ?? "",
    customerId: input.customerId ?? "",
    opportunityId: input.opportunityId ?? "",
    corridorId: input.corridorId ?? "",
    lifecycleState: input.lifecycleState,
    status,
    blockerIds: blockers.map((blocker) => blocker.blockerId),
    closeIds: input.closes.filter((close) => close.scopeVersionId === input.scopeVersionId).map((close) => close.closeId),
    actor: {
      actorId: input.actorId,
      actorRole: input.actorRole,
    },
    transitionResults,
    createdAt: nowIso(),
    diagnostics: [
      ...diagnostics,
      diagnostic("CONTROL_AUDIT_CREATED", "INFO", "Control activation audit created.", {
        blockerCount: blockers.length,
        status,
      }),
    ],
  } satisfies ControlActivationAudit;

  console.info("[CONTROL_AUDIT_CREATED]", {
    auditId: audit.auditId,
    scopeVersionId: audit.scopeVersionId,
    status: audit.status,
  });

  return audit;
}

function isRequirementSatisfied(input: ControlActivationReadinessInput, requirement: ControlActivationRequirement): boolean {
  switch (requirement.blockerCode) {
    case "MISSING_SCOPEVERSION_ID":
      return Boolean(input.scopeVersionId);
    case "MISSING_CUSTOMER_ID":
      return Boolean(input.customerId);
    case "MISSING_OPPORTUNITY_ID":
      return Boolean(input.opportunityId);
    case "MISSING_CORRIDOR_ID":
      return Boolean(input.corridorId);
    case "MISSING_CONTRACT_CLOSE":
      return hasValidatedClose(input, "CONTRACT_CLOSE");
    case "INVALID_LIFECYCLE_STATE":
      return input.lifecycleState === "CONTRACT_EXECUTED";
    case "MISSING_ENGINEERING_PACKAGE":
      return Boolean(input.references.engineeringPackageReference);
    case "MISSING_BUDGET":
      return Boolean(input.references.budgetReference);
    case "MISSING_VENDOR_ACCEPTANCE":
      return input.riskContext?.vendorAcceptanceRequired === false || Boolean(input.references.approvedVendorSelections?.length);
    case "MISSING_OBJECT_PACKAGE":
      return Boolean(input.references.approvedObjectPackage);
    case "MISSING_EXECUTION_STRATEGY":
      return Boolean(input.references.executionStrategy);
    case "MISSING_DESIGN_STANDARD_APPROVAL":
      return Boolean(input.references.designStandardsApproval);
    case "MISSING_REFERENCE_ARCHITECTURE":
      return Boolean(input.references.referenceArchitecture);
    case "MISSING_CLOSE_CHAIN_VALIDATION":
      return Boolean(input.references.closeChainValidation);
    default:
      return true;
  }
}

function hasValidatedClose(input: ControlActivationReadinessInput, closeType: ScopeVersionCloseEvent["closeType"]): boolean {
  return input.closes.some(
    (close) => close.closeType === closeType && close.scopeVersionId === input.scopeVersionId && close.immutable === true && Boolean(close.validatedAt),
  );
}

function controlStatusFromBlockers(blockers: readonly ControlActivationBlocker[]): ControlActivationReadiness["status"] {
  if (blockers.some((blocker) => blocker.severity === "CRITICAL" || blocker.severity === "HIGH")) return "NOT_READY";
  if (blockers.length) return "REVIEW_REQUIRED";
  return "CONTROL_READY";
}

function createRequirementBlocker(
  input: ControlActivationReadinessInput,
  requirement: ControlActivationRequirement,
): ControlActivationBlocker {
  return {
    blockerId: `CONTROL-BLOCKER-${input.scopeVersionId ?? "UNKNOWN"}-${requirement.blockerCode}`,
    code: requirement.blockerCode,
    severity: requirement.severity,
    message: requirement.description,
    requirementId: requirement.requirementId,
    resolved: false,
  };
}

function createRuntimeBlocker(
  input: ControlActivationReadinessInput,
  code: ControlActivationBlockerCode,
  severity: ControlActivationBlockerSeverity,
  message: string,
): ControlActivationBlocker {
  return {
    blockerId: `CONTROL-BLOCKER-${input.scopeVersionId ?? "UNKNOWN"}-${code}`,
    code,
    severity,
    message,
    resolved: false,
  };
}

function blockerDiagnostics(blockers: readonly ControlActivationBlocker[]): ControlActivationDiagnostic[] {
  return blockers.map((blocker) =>
    diagnostic("CONTROL_BLOCKER_IDENTIFIED", blocker.severity === "CRITICAL" || blocker.severity === "HIGH" ? "ERROR" : "WARNING", blocker.message, {
      blockerId: blocker.blockerId,
      code: blocker.code,
      severity: blocker.severity,
    }),
  );
}

function blockerRequirementIds(blockers: readonly ControlActivationBlocker[]): string[] {
  return [...new Set(blockers.map((blocker) => blocker.requirementId).filter((requirementId): requirementId is string => Boolean(requirementId)))];
}

function dedupeBlockers(blockers: readonly ControlActivationBlocker[]): ControlActivationBlocker[] {
  const seen = new Set<string>();
  return blockers.filter((blocker) => {
    const key = `${blocker.code}:${blocker.requirementId ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
