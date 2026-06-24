import {
  createScopeVersionCloseDraft,
  validateScopeVersionClose,
} from "../scopeversion/ScopeVersionCloseAuthorityEngine";
import {
  createTransitionAudit,
  evaluateTransition,
} from "../scopeversion/ScopeVersionTransitionAuthorityEngine";
import type {
  ScopeVersionCloseEvent,
  ScopeVersionCloseReference,
} from "../scopeversion/ScopeVersionCloseAuthority";
import type { ScopeVersionLifecycleAudit } from "../scopeversion/ScopeVersionLifecycle";
import {
  OPERATIONS_AUTHORITY,
  operationsStatusFromBlockers,
  type OperationsAudit,
  type OperationsDraftInput,
  type OperationsResult,
} from "./OperationsAuthority";
import {
  OPERATIONS_REQUIREMENTS,
  type OperationsBlocker,
  type OperationsBlockerCode,
  type OperationsBlockerSeverity,
  type OperationsDiagnostic,
  type OperationsDiagnosticCode,
  type OperationsReadiness,
  type OperationsReadinessInput,
  type OperationsRequirement,
} from "./OperationsReadiness";

function nowIso() {
  return new Date().toISOString();
}

function diagnostic(
  code: OperationsDiagnosticCode,
  severity: OperationsDiagnostic["severity"],
  message: string,
  details?: Record<string, unknown>,
): OperationsDiagnostic {
  return { code, severity, message, details };
}

export function getOperationsRequirements(): readonly OperationsRequirement[] {
  return OPERATIONS_REQUIREMENTS;
}

export function evaluateOperationsReadiness(input: OperationsReadinessInput): OperationsResult {
  const started = diagnostic("OPERATIONS_EVALUATION_STARTED", "INFO", "Operations readiness evaluation started.", {
    scopeVersionId: input.scopeVersionId,
    lifecycleState: input.lifecycleState,
  });
  console.info("[OPERATIONS_EVALUATION_STARTED]", {
    scopeVersionId: input.scopeVersionId,
    lifecycleState: input.lifecycleState,
  });

  const readiness = validateOperationsRequirements(input);
  if (!readiness.valid) {
    const diagnostics = [
      started,
      ...readiness.diagnostics,
      diagnostic("OPERATIONS_REJECTED", "ERROR", "Operations rejected by readiness validation.", {
        blockerCount: readiness.blockers.length,
      }),
    ];
    const audit = createOperationsAudit(input, undefined, readiness.blockers, [], diagnostics, readiness.status);
    return {
      scopeVersionId: input.scopeVersionId,
      status: readiness.status,
      readiness,
      lifecycleAudits: [],
      audit,
      diagnostics: [...diagnostics, ...audit.diagnostics],
    };
  }

  const operationsCloseDraft = createOperationsDraft({ ...input, readiness });
  const closeValidation = validateScopeVersionClose(operationsCloseDraft);
  const operationsClose: ScopeVersionCloseEvent = {
    ...operationsCloseDraft,
    validatedAt: closeValidation.validatedAt,
    immutable: closeValidation.valid,
  };

  if (!closeValidation.valid) {
    const blockers = [
      ...readiness.blockers,
      createBlocker(input, "OPERATIONS_CLOSE_REJECTED", "CRITICAL", "ScopeVersion OPERATIONS_CLOSE validation rejected."),
    ];
    const rejectedReadiness = {
      ...readiness,
      valid: false,
      status: operationsStatusFromBlockers(blockers),
      blockers,
      diagnostics: [
        ...readiness.diagnostics,
        diagnostic("OPERATIONS_REJECTED", "ERROR", "ScopeVersion OPERATIONS_CLOSE rejected.", {
          errors: closeValidation.errors,
        }),
      ],
    } satisfies OperationsReadiness;
    const audit = createOperationsAudit(input, operationsClose, blockers, [], rejectedReadiness.diagnostics, rejectedReadiness.status);
    return {
      scopeVersionId: input.scopeVersionId,
      status: rejectedReadiness.status,
      readiness: rejectedReadiness,
      operationsCloseDraft,
      lifecycleAudits: [],
      audit,
      diagnostics: [started, ...rejectedReadiness.diagnostics, ...audit.diagnostics],
    };
  }

  console.info("[OPERATIONS_CLOSE_CREATED]", {
    closeId: operationsClose.closeId,
    scopeVersionId: operationsClose.scopeVersionId,
  });

  const operationsTransition = evaluateTransition({
    scopeVersionId: input.scopeVersionId ?? "",
    previousState: OPERATIONS_AUTHORITY.requiredLifecycleState,
    requestedState: OPERATIONS_AUTHORITY.operationalState,
    actorId: input.actorId,
    actorRole: input.actorRole,
    closes: [...validatedCompletionCloses(input), operationsClose],
  });
  const lifecycleAudits = [createTransitionAudit(operationsTransition)];

  if (!operationsTransition.approved) {
    const blockers = [
      ...readiness.blockers,
      createBlocker(input, "LIFECYCLE_AUTHORITY_REJECTED", "CRITICAL", "Lifecycle authority rejected COMPLETE to OPERATIONS."),
    ];
    const rejectedReadiness = {
      ...readiness,
      valid: false,
      status: operationsStatusFromBlockers(blockers),
      blockers,
      diagnostics: [
        ...readiness.diagnostics,
        diagnostic("OPERATIONS_REJECTED", "ERROR", "Operations lifecycle transition rejected.", {
          transitionId: operationsTransition.transitionId,
        }),
      ],
    } satisfies OperationsReadiness;
    const audit = createOperationsAudit(input, operationsClose, blockers, lifecycleAudits, rejectedReadiness.diagnostics, rejectedReadiness.status);
    return {
      scopeVersionId: input.scopeVersionId,
      status: rejectedReadiness.status,
      readiness: rejectedReadiness,
      operationsCloseDraft,
      operationsClose,
      operationsTransition,
      lifecycleAudits,
      audit,
      diagnostics: [started, ...rejectedReadiness.diagnostics, ...audit.diagnostics],
    };
  }

  const diagnostics = [
    started,
    ...readiness.diagnostics,
    diagnostic("OPERATIONS_CLOSE_CREATED", "INFO", "ScopeVersion OPERATIONS_CLOSE created.", {
      closeId: operationsClose.closeId,
    }),
    diagnostic("OPERATIONS_APPROVED", "INFO", "Operations approved by Operations Authority.", {
      scopeVersionId: input.scopeVersionId,
      operationsCloseId: operationsClose.closeId,
    }),
  ];
  const activeReadiness = {
    ...readiness,
    status: "OPERATIONS_ACTIVE",
    diagnostics: [...readiness.diagnostics, ...diagnostics],
  } satisfies OperationsReadiness;
  const audit = createOperationsAudit(input, operationsClose, [], lifecycleAudits, diagnostics, "OPERATIONS_ACTIVE");

  console.info("[OPERATIONS_APPROVED]", {
    scopeVersionId: input.scopeVersionId,
    closeId: operationsClose.closeId,
  });

  return {
    scopeVersionId: input.scopeVersionId,
    status: "OPERATIONS_ACTIVE",
    readiness: activeReadiness,
    operationsCloseDraft,
    operationsClose,
    operationsTransition,
    lifecycleAudits,
    audit,
    diagnostics: [...diagnostics, ...audit.diagnostics],
  };
}

export function validateOperationsRequirements(input: OperationsReadinessInput): OperationsReadiness {
  const blockers = identifyOperationsBlockers(input);
  const valid = blockers.length === 0;
  const status = valid ? "READY_FOR_OPERATIONS" : operationsStatusFromBlockers(blockers);
  const diagnostics = [
    ...blockerDiagnostics(blockers),
    diagnostic(valid ? "OPERATIONS_READY" : "OPERATIONS_REJECTED", valid ? "INFO" : "ERROR", `Operations requirements ${valid ? "passed" : "failed"}.`, {
      blockerCount: blockers.length,
      status,
    }),
  ];

  for (const requirement of OPERATIONS_REQUIREMENTS) {
    console.info("[OPERATIONS_REQUIREMENT_VALIDATED]", {
      requirementId: requirement.requirementId,
      scopeVersionId: input.scopeVersionId,
      valid: valid || !blockers.some((blocker) => blocker.code === requirement.blockerCode),
    });
  }

  console.info(valid ? "[OPERATIONS_READY]" : "[OPERATIONS_REJECTED]", {
    scopeVersionId: input.scopeVersionId,
    status,
    blockerCount: blockers.length,
  });

  return {
    scopeVersionId: input.scopeVersionId,
    valid,
    status,
    blockers,
    validatedCompletionCloseIds: validatedCompletionCloses(input).map((close) => close.closeId),
    acceptedReferenceIds: acceptedCriteria(input).flatMap((acceptance) => acceptance.referenceIds),
    documentationIds: [...(input.requiredDocumentationIds ?? [])],
    turnoverPackageIds: [...(input.turnoverPackageIds ?? [])],
    diagnostics,
  };
}

export function identifyOperationsBlockers(input: OperationsReadinessInput): OperationsBlocker[] {
  const blockers: OperationsBlocker[] = [];
  const addMissing = (
    code: OperationsBlockerCode,
    severity: OperationsBlockerSeverity,
    message: string,
    referenceId?: string,
  ) => blockers.push(createBlocker(input, code, severity, message, referenceId));

  if (!input.scopeVersionId) addMissing("MISSING_SCOPEVERSION_ID", "CRITICAL", "Operations requires scopeVersionId.");
  if (!input.customerId) addMissing("MISSING_CUSTOMER_ID", "CRITICAL", "Operations requires customerId.");
  if (!input.opportunityId) addMissing("MISSING_OPPORTUNITY_ID", "CRITICAL", "Operations requires opportunityId.");
  if (!input.corridorId) addMissing("MISSING_CORRIDOR_ID", "CRITICAL", "Operations requires corridorId.");
  if (input.lifecycleState !== OPERATIONS_AUTHORITY.requiredLifecycleState) {
    addMissing("COMPLETE_REQUIRED", "CRITICAL", "Operations requires COMPLETE lifecycle state.");
  }
  if (input.actorRole === "AI_ASSISTANT_ADVISORY") {
    addMissing("AI_ADVISORY_RECOMMENDATION", "CRITICAL", "AI advisory output cannot approve operations.");
  }
  if (validatedCompletionCloses(input).length === 0) {
    addMissing("MISSING_COMPLETION_CLOSE", "CRITICAL", "Operations requires validated COMPLETION_CLOSE.");
  }
  if (!input.operationalOwnerId) addMissing("MISSING_OPERATIONAL_OWNER", "CRITICAL", "Operations requires operational owner.");
  if (!input.supportOwnerId) addMissing("MISSING_SUPPORT_OWNER", "CRITICAL", "Operations requires support owner.");
  if (!input.maintenanceOwnerId) addMissing("MISSING_MAINTENANCE_OWNER", "CRITICAL", "Operations requires maintenance owner.");
  if (!input.assetInventoryReference) {
    addMissing("MISSING_ASSET_INVENTORY_REFERENCE", "HIGH", "Operations requires asset inventory reference.");
  }
  if (!input.serviceInventoryReference) {
    addMissing("MISSING_SERVICE_INVENTORY_REFERENCE", "HIGH", "Operations requires service inventory reference.");
  }
  if (!input.requiredDocumentationIds?.length) {
    addMissing("MISSING_DOCUMENTATION", "HIGH", "Operations requires documentation references.");
  }
  if (!input.turnoverPackageIds?.length) {
    addMissing("MISSING_TURNOVER_PACKAGE", "CRITICAL", "Operations requires turnover package references.");
  }
  if (!acceptedCriteria(input).length) {
    addMissing("MISSING_ACCEPTANCE_CRITERIA", "CRITICAL", "Operations requires accepted operational criteria.");
  }
  (input.unresolvedCriticalBlockers ?? []).forEach((id) =>
    addMissing("UNRESOLVED_CRITICAL_BLOCKER", "CRITICAL", "Unresolved critical blocker prevents operations.", id),
  );

  const deduped = dedupeBlockers(blockers);
  for (const blocker of deduped) {
    console.info("[OPERATIONS_BLOCKER_IDENTIFIED]", {
      scopeVersionId: input.scopeVersionId,
      code: blocker.code,
      severity: blocker.severity,
      referenceId: blocker.referenceId,
    });
  }
  return deduped;
}

export function createOperationsDraft(input: OperationsDraftInput): ScopeVersionCloseEvent {
  const evidenceIds = unique([
    ...input.readiness.validatedCompletionCloseIds,
    ...validatedCompletionCloses(input).flatMap((close) => close.evidenceIds),
    ...(input.acceptances ?? []).flatMap((acceptance) => acceptance.evidenceIds),
    ...(input.requiredDocumentationIds ?? []),
    ...(input.turnoverPackageIds ?? []),
  ]);

  return createScopeVersionCloseDraft({
    closeId: `OPERATIONS-CLOSE-${input.scopeVersionId ?? "MISSING"}-${Date.now()}`,
    scopeVersionId: input.scopeVersionId,
    customerId: input.customerId,
    opportunityId: input.opportunityId,
    corridorId: input.corridorId,
    closeType: OPERATIONS_AUTHORITY.scopeVersionCloseType,
    actorId: input.actorId,
    actorRole: input.actorRole,
    createdAt: input.createdAt,
    evidenceIds,
    inputReferences: [
      ...validatedCompletionCloses(input).map((close) => reference(close.closeId, "COMPLETION_CLOSE", "OperationsAuthority")),
      ...acceptedCriteria(input).map((acceptance) => reference(acceptance.acceptanceId, acceptance.acceptanceType, "OperationsAcceptance")),
      ...(input.operationalOwnerId ? [reference(input.operationalOwnerId, "OperationalOwner", "OperationsRequirement")] : []),
      ...(input.supportOwnerId ? [reference(input.supportOwnerId, "SupportOwner", "OperationsRequirement")] : []),
      ...(input.maintenanceOwnerId ? [reference(input.maintenanceOwnerId, "MaintenanceOwner", "OperationsRequirement")] : []),
      ...(input.assetInventoryReference ? [reference(input.assetInventoryReference, "AssetInventory", "OperationsRequirement")] : []),
      ...(input.serviceInventoryReference ? [reference(input.serviceInventoryReference, "ServiceInventory", "OperationsRequirement")] : []),
      ...((input.requiredDocumentationIds ?? []).map((id) => reference(id, "Documentation", "OperationsRequirement"))),
      ...((input.turnoverPackageIds ?? []).map((id) => reference(id, "TurnoverPackage", "OperationsRequirement"))),
    ],
    constraintReferences: [
      reference(OPERATIONS_AUTHORITY.authorityId, "OperationsAuthority", "OperationsAuthority"),
      reference(OPERATIONS_AUTHORITY.requiredLifecycleState, "RequiredLifecycleState", "OperationsAuthority"),
    ],
    outcome: {
      status: "ACCEPTED",
      previousState: OPERATIONS_AUTHORITY.requiredLifecycleState,
      resultingState: OPERATIONS_AUTHORITY.operationalState,
      notes: input.notes,
    },
  });
}

export function createOperationsAudit(
  input: OperationsReadinessInput,
  close: ScopeVersionCloseEvent | undefined,
  blockers: readonly OperationsBlocker[] = identifyOperationsBlockers(input),
  lifecycleAudits: readonly ScopeVersionLifecycleAudit[] = [],
  diagnostics: readonly OperationsDiagnostic[] = [],
  status = operationsStatusFromBlockers(blockers),
): OperationsAudit {
  const audit = {
    auditId: `OPERATIONS-AUDIT-${input.scopeVersionId ?? "MISSING"}-${Date.now()}`,
    scopeVersionId: input.scopeVersionId ?? "",
    customerId: input.customerId ?? "",
    opportunityId: input.opportunityId ?? "",
    corridorId: input.corridorId ?? "",
    status,
    closeId: close?.closeId,
    blockerIds: blockers.map((blocker) => blocker.blockerId),
    validatedCompletionCloseIds: validatedCompletionCloses(input).map((completionClose) => completionClose.closeId),
    lifecycleTransitionIds: lifecycleAudits.map((auditRecord) => auditRecord.auditId),
    timestamp: nowIso(),
    diagnostics: [
      ...diagnostics,
      diagnostic("OPERATIONS_AUDIT_CREATED", "INFO", "Operations audit created.", {
        closeId: close?.closeId,
        blockerCount: blockers.length,
      }),
    ],
  } satisfies OperationsAudit;

  console.info("[OPERATIONS_AUDIT_CREATED]", {
    auditId: audit.auditId,
    scopeVersionId: audit.scopeVersionId,
    closeId: audit.closeId,
  });

  return audit;
}

function validatedCompletionCloses(input: Pick<OperationsReadinessInput, "completionCloses" | "scopeVersionId">): ScopeVersionCloseEvent[] {
  return input.completionCloses.filter(
    (close) =>
      close.closeType === "COMPLETION_CLOSE" &&
      close.scopeVersionId === input.scopeVersionId &&
      close.immutable === true &&
      Boolean(close.validatedAt),
  );
}

function acceptedCriteria(input: OperationsReadinessInput) {
  return (input.acceptances ?? []).filter((acceptance) => acceptance.accepted);
}

function createBlocker(
  input: OperationsReadinessInput,
  code: OperationsBlockerCode,
  severity: OperationsBlockerSeverity,
  message: string,
  referenceId?: string,
): OperationsBlocker {
  return {
    blockerId: `OPERATIONS-BLOCKER-${input.scopeVersionId ?? "MISSING"}-${code}${referenceId ? `-${referenceId}` : ""}`,
    code,
    severity,
    message,
    referenceId,
    resolved: false,
  };
}

function blockerDiagnostics(blockers: readonly OperationsBlocker[]): OperationsDiagnostic[] {
  return blockers.map((blocker) =>
    diagnostic(
      "OPERATIONS_BLOCKER_IDENTIFIED",
      blocker.severity === "CRITICAL" || blocker.severity === "HIGH" ? "ERROR" : "WARNING",
      blocker.message,
      {
        blockerId: blocker.blockerId,
        code: blocker.code,
        severity: blocker.severity,
        referenceId: blocker.referenceId,
      },
    ),
  );
}

function reference(referenceId: string, referenceType: string, source: string): ScopeVersionCloseReference {
  return {
    referenceId,
    referenceType,
    source,
    immutable: true,
  };
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function dedupeBlockers(blockers: readonly OperationsBlocker[]): OperationsBlocker[] {
  const seen = new Set<string>();
  return blockers.filter((blocker) => {
    const key = `${blocker.code}:${blocker.referenceId ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
