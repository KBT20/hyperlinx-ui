import type { WorkPackage } from "../control/WorkPackage";
import type { ScopeVersionCloseEvent } from "../scopeversion/ScopeVersionCloseAuthority";
import {
  createScopeVersionCloseDraft,
  validateScopeVersionClose,
} from "../scopeversion/ScopeVersionCloseAuthorityEngine";
import { evaluateTransition } from "../scopeversion/ScopeVersionTransitionAuthorityEngine";
import {
  FIELD_ACTIVATION_REQUIREMENTS,
  type FieldActivationAudit,
  type FieldActivationBlocker,
  type FieldActivationBlockerCode,
  type FieldActivationBlockerSeverity,
  type FieldActivationDiagnostic,
  type FieldActivationDiagnosticCode,
  type FieldActivationRequirement,
  type FieldActivationResult,
} from "./FieldActivationAuthority";
import type {
  FieldActivationDraftInput,
  FieldActivationReadiness,
  FieldActivationReadinessInput,
} from "./FieldActivationReadiness";

function nowIso() {
  return new Date().toISOString();
}

function diagnostic(
  code: FieldActivationDiagnosticCode,
  severity: FieldActivationDiagnostic["severity"],
  message: string,
  details?: Record<string, unknown>,
): FieldActivationDiagnostic {
  return { code, severity, message, details };
}

export function getFieldActivationRequirements(): readonly FieldActivationRequirement[] {
  return FIELD_ACTIVATION_REQUIREMENTS;
}

export function evaluateFieldReadiness(input: FieldActivationReadinessInput): FieldActivationReadiness {
  const started = diagnostic("FIELD_READINESS_STARTED", "INFO", "Field readiness evaluation started.", {
    scopeVersionId: input.scopeVersionId,
    lifecycleState: input.lifecycleState,
  });
  console.info("[FIELD_READINESS_STARTED]", {
    scopeVersionId: input.scopeVersionId,
    lifecycleState: input.lifecycleState,
  });

  const blockers = identifyFieldBlockers(input);
  const missingRequirementIds = blockerRequirementIds(blockers);
  const status = fieldStatusFromBlockers(blockers);
  const diagnostics = [
    started,
    diagnostic("FIELD_REQUIREMENTS_VALIDATED", status === "FIELD_READY" ? "INFO" : "WARNING", `Field readiness evaluated as ${status}.`, {
      blockerCount: blockers.length,
    }),
    ...blockerDiagnostics(blockers),
  ];

  if (status === "FIELD_READY") {
    console.info("[FIELD_READY]", { scopeVersionId: input.scopeVersionId });
    diagnostics.push(diagnostic("FIELD_READY", "INFO", "Field readiness passed."));
  }

  return {
    scopeVersionId: input.scopeVersionId ?? "",
    lifecycleState: input.lifecycleState,
    status,
    blockers,
    satisfiedRequirementIds: FIELD_ACTIVATION_REQUIREMENTS.map((requirement) => requirement.requirementId).filter(
      (requirementId) => !missingRequirementIds.includes(requirementId),
    ),
    missingRequirementIds,
    diagnostics,
  };
}

export function validateFieldActivation(input: FieldActivationDraftInput): FieldActivationResult {
  const readiness = evaluateFieldReadiness(input);
  const blockers = [...readiness.blockers];
  const transitionResults: FieldActivationResult["transitionResults"] = [];
  let fieldCloseDraft: ScopeVersionCloseEvent | undefined;
  let fieldClose: ScopeVersionCloseEvent | undefined;

  if (readiness.status === "FIELD_READY") {
    const fieldReadyTransition = evaluateTransition({
      scopeVersionId: input.scopeVersionId ?? "",
      previousState: "CONTROL_ACTIVE",
      requestedState: "FIELD_READY",
      actorId: input.actorId,
      actorRole: input.actorRole,
      closes: input.closes,
    });
    transitionResults.push(fieldReadyTransition);

    fieldCloseDraft = createFieldActivationDraft(input);
    const validation = validateScopeVersionClose(fieldCloseDraft);
    fieldClose = { ...fieldCloseDraft, validatedAt: validation.validatedAt, immutable: validation.valid };

    if (!validation.valid) {
      blockers.push(createRuntimeBlocker(input, "FIELD_CLOSE_REJECTED", "CRITICAL", "FIELD_CLOSE validation was rejected."));
    }

    const fieldActiveTransition = evaluateTransition({
      scopeVersionId: input.scopeVersionId ?? "",
      previousState: "FIELD_READY",
      requestedState: "FIELD_ACTIVE",
      actorId: input.actorId,
      actorRole: input.actorRole,
      closes: fieldClose ? [...input.closes, fieldClose] : input.closes,
    });
    transitionResults.push(fieldActiveTransition);

    if (!fieldReadyTransition.approved || !fieldActiveTransition.approved) {
      blockers.push(createRuntimeBlocker(input, "LIFECYCLE_AUTHORITY_REJECTED", "CRITICAL", "Lifecycle authority rejected Field activation."));
    }
  }

  const status = blockers.some((blocker) => blocker.severity === "CRITICAL" || blocker.severity === "HIGH")
    ? "NOT_READY"
    : blockers.length
      ? "REVIEW_REQUIRED"
      : "FIELD_ACTIVE";
  const activationDiagnostics = [
    ...readiness.diagnostics,
    ...(status === "FIELD_ACTIVE"
      ? [diagnostic("FIELD_ACTIVATION_APPROVED", "INFO", "Field activation approved.", { scopeVersionId: input.scopeVersionId })]
      : [diagnostic("FIELD_ACTIVATION_REJECTED", "ERROR", "Field activation rejected.", { blockerCount: blockers.length })]),
  ];

  console.info(status === "FIELD_ACTIVE" ? "[FIELD_ACTIVATION_APPROVED]" : "[FIELD_ACTIVATION_REJECTED]", {
    scopeVersionId: input.scopeVersionId,
    status,
    blockerCount: blockers.length,
  });

  const audit = createFieldActivationAudit(input, status, blockers, transitionResults, activationDiagnostics);

  return {
    scopeVersionId: input.scopeVersionId ?? "",
    status,
    readiness: {
      status: readiness.status,
      blockers: readiness.blockers,
      satisfiedRequirementIds: readiness.satisfiedRequirementIds,
      missingRequirementIds: readiness.missingRequirementIds,
    },
    fieldCloseDraft,
    fieldClose,
    transitionResults,
    blockers,
    audit,
    diagnostics: [...activationDiagnostics, ...audit.diagnostics],
  };
}

export function createFieldActivationDraft(input: FieldActivationDraftInput): ScopeVersionCloseEvent {
  return createScopeVersionCloseDraft({
    closeId: input.activationId,
    scopeVersionId: input.scopeVersionId,
    customerId: input.customerId,
    opportunityId: input.opportunityId,
    corridorId: input.corridorId,
    closeType: "FIELD_CLOSE",
    actorId: input.actorId,
    actorRole: input.actorRole,
    evidenceIds: [
      input.references.controlActivationId,
      input.references.controlCloseId,
      input.references.executionPackageReference,
      input.references.dependencySatisfactionReference,
      ...input.workPackages.map((workPackage) => workPackage.workPackageId),
    ].filter((evidenceId): evidenceId is string => Boolean(evidenceId)),
    inputReferences: [
      {
        referenceId: input.scopeVersionId ?? "",
        referenceType: "ScopeVersion",
        source: "FieldActivationAuthority",
        immutable: true,
      },
      ...input.workPackages.map((workPackage) => ({
        referenceId: workPackage.workPackageId,
        referenceType: "WorkPackage",
        source: "FieldActivationAuthority",
        immutable: true,
      })),
    ],
    constraintReferences: [
      {
        referenceId: input.references.designStandardsReference ?? "DESIGN-STANDARDS-UNKNOWN",
        referenceType: "DesignStandards",
        source: "FieldActivationAuthority",
        immutable: Boolean(input.references.designStandardsReference),
      },
    ],
    outcome: {
      status: "ACCEPTED",
      previousState: "FIELD_READY",
      resultingState: "FIELD_ACTIVE",
      notes: input.notes,
    },
  });
}

export function identifyFieldBlockers(input: FieldActivationReadinessInput): FieldActivationBlocker[] {
  const blockers: FieldActivationBlocker[] = [];

  for (const requirement of FIELD_ACTIVATION_REQUIREMENTS) {
    if (!isRequirementSatisfied(input, requirement)) {
      blockers.push(createRequirementBlocker(input, requirement));
    }
  }

  if (input.riskContext?.unresolvedCriticalRisks?.length) {
    blockers.push(createRuntimeBlocker(input, "UNRESOLVED_CRITICAL_RISK", "CRITICAL", "Critical risks remain unresolved."));
  }

  if (input.riskContext?.aiAdvisoryRecommendation) {
    blockers.push(createRuntimeBlocker(input, "AI_ADVISORY_RECOMMENDATION", "CRITICAL", "AI advisory output cannot activate Field."));
  }

  const deduped = dedupeBlockers(blockers);
  for (const blocker of deduped) {
    console.info("[FIELD_BLOCKER_IDENTIFIED]", {
      scopeVersionId: input.scopeVersionId,
      code: blocker.code,
      severity: blocker.severity,
    });
  }

  return deduped;
}

export function createFieldActivationAudit(
  input: FieldActivationReadinessInput,
  status: FieldActivationResult["status"],
  blockers: readonly FieldActivationBlocker[],
  transitionResults: FieldActivationResult["transitionResults"] = [],
  diagnostics: readonly FieldActivationDiagnostic[] = [],
): FieldActivationAudit {
  const audit = {
    auditId: `FIELD-ACTIVATION-AUDIT-${input.scopeVersionId ?? "UNKNOWN"}-${Date.now()}`,
    scopeVersionId: input.scopeVersionId ?? "",
    customerId: input.customerId ?? "",
    opportunityId: input.opportunityId ?? "",
    corridorId: input.corridorId ?? "",
    lifecycleState: input.lifecycleState,
    status,
    workPackageIds: input.workPackages.map((workPackage) => workPackage.workPackageId),
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
      diagnostic("FIELD_AUDIT_CREATED", "INFO", "Field activation audit created.", {
        blockerCount: blockers.length,
        status,
      }),
    ],
  } satisfies FieldActivationAudit;

  console.info("[FIELD_AUDIT_CREATED]", {
    auditId: audit.auditId,
    scopeVersionId: audit.scopeVersionId,
    status: audit.status,
  });

  return audit;
}

function isRequirementSatisfied(input: FieldActivationReadinessInput, requirement: FieldActivationRequirement): boolean {
  switch (requirement.blockerCode) {
    case "MISSING_SCOPEVERSION_ID":
      return Boolean(input.scopeVersionId);
    case "MISSING_CUSTOMER_ID":
      return Boolean(input.customerId);
    case "MISSING_OPPORTUNITY_ID":
      return Boolean(input.opportunityId);
    case "MISSING_CORRIDOR_ID":
      return Boolean(input.corridorId);
    case "MISSING_CONTROL_ACTIVE":
    case "INVALID_LIFECYCLE_STATE":
      return input.lifecycleState === "CONTROL_ACTIVE";
    case "MISSING_WORK_PACKAGES":
      return input.workPackages.length > 0 && input.workPackages.every((workPackage) => workPackage.scopeVersionId === input.scopeVersionId);
    case "MISSING_STATION_ALLOCATIONS":
      return hasAnyAllocation(input.workPackages, "stationIds");
    case "MISSING_SEGMENT_ALLOCATIONS":
      return hasAnyAllocation(input.workPackages, "segmentIds");
    case "MISSING_OBJECT_ALLOCATIONS":
      return hasAnyAllocation(input.workPackages, "objectIds");
    case "MISSING_VENDOR_ALLOCATIONS":
      return hasAnyAllocation(input.workPackages, "vendorIds");
    case "MISSING_EXECUTION_PACKAGE":
      return Boolean(input.references.executionPackageReference);
    case "MISSING_DEPENDENCY":
      return Boolean(input.references.dependencySatisfactionReference) && input.workPackages.every((workPackage) => dependenciesSatisfied(workPackage));
    case "MISSING_DESIGN_STANDARDS":
      return Boolean(input.references.designStandardsReference);
    default:
      return true;
  }
}

function hasAnyAllocation(workPackages: readonly WorkPackage[], key: keyof WorkPackage["allocation"]): boolean {
  return workPackages.some((workPackage) => {
    const value = workPackage.allocation[key];
    return Array.isArray(value) && value.length > 0;
  });
}

function dependenciesSatisfied(workPackage: WorkPackage): boolean {
  return workPackage.dependencies.every((dependency) => !dependency.blocking || Boolean(dependency.sourceWorkPackageId));
}

function fieldStatusFromBlockers(blockers: readonly FieldActivationBlocker[]): FieldActivationReadiness["status"] {
  if (blockers.some((blocker) => blocker.severity === "CRITICAL" || blocker.severity === "HIGH")) return "NOT_READY";
  if (blockers.length) return "REVIEW_REQUIRED";
  return "FIELD_READY";
}

function createRequirementBlocker(
  input: FieldActivationReadinessInput,
  requirement: FieldActivationRequirement,
): FieldActivationBlocker {
  return {
    blockerId: `FIELD-BLOCKER-${input.scopeVersionId ?? "UNKNOWN"}-${requirement.blockerCode}`,
    code: requirement.blockerCode,
    severity: requirement.severity,
    message: requirement.description,
    requirementId: requirement.requirementId,
    resolved: false,
  };
}

function createRuntimeBlocker(
  input: FieldActivationReadinessInput,
  code: FieldActivationBlockerCode,
  severity: FieldActivationBlockerSeverity,
  message: string,
): FieldActivationBlocker {
  return {
    blockerId: `FIELD-BLOCKER-${input.scopeVersionId ?? "UNKNOWN"}-${code}`,
    code,
    severity,
    message,
    resolved: false,
  };
}

function blockerDiagnostics(blockers: readonly FieldActivationBlocker[]): FieldActivationDiagnostic[] {
  return blockers.map((blocker) =>
    diagnostic("FIELD_BLOCKER_IDENTIFIED", blocker.severity === "CRITICAL" || blocker.severity === "HIGH" ? "ERROR" : "WARNING", blocker.message, {
      blockerId: blocker.blockerId,
      code: blocker.code,
      severity: blocker.severity,
    }),
  );
}

function blockerRequirementIds(blockers: readonly FieldActivationBlocker[]): string[] {
  return [...new Set(blockers.map((blocker) => blocker.requirementId).filter((requirementId): requirementId is string => Boolean(requirementId)))];
}

function dedupeBlockers(blockers: readonly FieldActivationBlocker[]): FieldActivationBlocker[] {
  const seen = new Set<string>();
  return blockers.filter((blocker) => {
    const key = `${blocker.code}:${blocker.requirementId ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
