import {
  SCOPEVERSION_TRANSITION_REGISTRY,
  SCOPEVERSION_STATE_REGISTRY,
  type ScopeVersionState,
} from "../scopeversion/ScopeVersionLifecycle";
import { getRequiredCloses } from "../scopeversion/ScopeVersionTransitionAuthorityEngine";
import type {
  AuditDiagnostic,
  AuditFinding,
  AuditFindingType,
  AuditSeverity,
  AuthorityActionType,
  AuthorityAuditResult,
  ConstitutionalAudit,
  ConstitutionalAuthorityEvent,
  ConstitutionalRuntimeSnapshot,
  ConstitutionalScopeVersionRef,
  CloseAuditResult,
  LifecycleAuditResult,
  ReplayabilityAuditResult,
} from "./ConstitutionalAudit";
import type { TraceabilityAuditResult } from "./ConstitutionalTraceabilityAudit";

const REQUIRED_TRACE_KEYS = ["customerId", "opportunityId", "corridorId", "scopeVersionId"] as const;
const REQUIRED_EXECUTION_CLOSE_TYPES = ["CONTRACT_CLOSE", "CONTROL_CLOSE", "FIELD_CLOSE", "COMPLETION_CLOSE", "OPERATIONS_CLOSE"] as const;
const ADVISORY_ONLY_LAYERS = new Set(["PRISM", "MARKETPLACE", "TWIN"] as const);
const EXECUTION_LAYER_ACTIONS: Partial<Record<ConstitutionalAuthorityEvent["authorityLayer"], AuthorityActionType[]>> = {
  CONTROL: ["EXECUTION_AUTHORITY"],
  FIELD: ["FIELD_EXECUTION"],
  COMPLETION: ["COMPLETION_AUTHORITY"],
  OPERATIONS: ["OPERATIONS_AUTHORITY"],
  BUDGET: ["COMMERCIAL_TRUTH"],
  OI: ["PORTFOLIO_OBSERVATION"],
};

function nowIso() {
  return new Date().toISOString();
}

function diagnostic(
  code: AuditDiagnostic["code"],
  severity: AuditSeverity,
  message: string,
  details?: Record<string, unknown>,
): AuditDiagnostic {
  return { code, severity, message, details };
}

function finding(
  args: Omit<AuditFinding, "findingId">,
): AuditFinding {
  return {
    findingId: `AUDIT-FINDING-${args.findingType}-${args.objectId ?? "GLOBAL"}-${args.message.replace(/[^A-Z0-9]+/gi, "-").slice(0, 48)}`,
    ...args,
  };
}

export function runTraceabilityAudit(snapshot: ConstitutionalRuntimeSnapshot): TraceabilityAuditResult {
  const findings: AuditFinding[] = [];
  const diagnostics: AuditDiagnostic[] = [];
  const customerIds = new Set(snapshot.customers.map((customer) => customer.customerId).filter(Boolean));
  const opportunityIds = new Set(snapshot.opportunities.map((opportunity) => opportunity.opportunityId).filter(Boolean));
  const corridorIds = new Set(snapshot.corridors.map((corridor) => corridor.corridorId).filter(Boolean));
  const scopeVersionIds = new Set(snapshot.scopeVersions.map((scopeVersion) => scopeVersion.scopeVersionId).filter(Boolean));

  for (const opportunity of snapshot.opportunities) {
    if (!opportunity.customerId) {
      findings.push(traceFinding("Opportunity", opportunity.opportunityId, "Missing customerId.", "CRITICAL"));
    } else if (!customerIds.has(opportunity.customerId)) {
      findings.push(traceFinding("Opportunity", opportunity.opportunityId, `Orphan customer reference ${opportunity.customerId}.`, "ERROR"));
    }
  }

  for (const corridor of snapshot.corridors) {
    if (!corridor.customerId) {
      findings.push(traceFinding("Corridor", corridor.corridorId, "Missing customerId.", "CRITICAL"));
    } else if (!customerIds.has(corridor.customerId)) {
      findings.push(traceFinding("Corridor", corridor.corridorId, `Orphan customer reference ${corridor.customerId}.`, "ERROR"));
    }
    if (!corridor.opportunityId) {
      findings.push(traceFinding("Corridor", corridor.corridorId, "Missing opportunityId.", "CRITICAL"));
    } else if (!opportunityIds.has(corridor.opportunityId)) {
      findings.push(traceFinding("Corridor", corridor.corridorId, `Orphan opportunity reference ${corridor.opportunityId}.`, "ERROR"));
    }
  }

  for (const scopeVersion of snapshot.scopeVersions) {
    validateTraceKeys("ScopeVersion", scopeVersion.scopeVersionId, scopeVersion, findings);
    if (scopeVersion.customerId && !customerIds.has(scopeVersion.customerId)) {
      findings.push(traceFinding("ScopeVersion", scopeVersion.scopeVersionId, `Orphan customer reference ${scopeVersion.customerId}.`, "ERROR"));
    }
    if (scopeVersion.opportunityId && !opportunityIds.has(scopeVersion.opportunityId)) {
      findings.push(traceFinding("ScopeVersion", scopeVersion.scopeVersionId, `Orphan opportunity reference ${scopeVersion.opportunityId}.`, "ERROR"));
    }
    if (scopeVersion.corridorId && !corridorIds.has(scopeVersion.corridorId)) {
      findings.push(traceFinding("ScopeVersion", scopeVersion.scopeVersionId, `Orphan corridor reference ${scopeVersion.corridorId}.`, "ERROR"));
    }
    if (scopeVersion.parentScopeVersionId && !scopeVersionIds.has(scopeVersion.parentScopeVersionId)) {
      findings.push(traceFinding("ScopeVersion", scopeVersion.scopeVersionId, `Invalid parent ScopeVersion ${scopeVersion.parentScopeVersionId}.`, "ERROR"));
    }
  }

  for (const close of snapshot.closeEvents ?? []) {
    validateTraceKeys("CloseEvent", close.closeId, close, findings);
  }

  for (const workPackage of snapshot.workPackages ?? []) {
    validateTraceKeys("WorkPackage", workPackage.workPackageId, workPackage, findings);
  }

  for (const event of snapshot.authorityEvents ?? []) {
    validateTraceKeys("AuthorityEvent", event.eventId, event, findings);
  }

  const passed = !hasError(findings);
  const scopeFindings = findings.filter((item) => item.objectType === "ScopeVersion" || item.findingType === "SCOPEVERSION_TRACEABILITY");
  const scopePassed = !hasError(scopeFindings);
  diagnostics.push(
    diagnostic(
      passed ? "CUSTOMER_TRACEABILITY_VALIDATED" : "TRACEABILITY_ERROR",
      passed ? "INFO" : "ERROR",
      passed ? "Customer to ScopeVersion traceability validated." : "Traceability errors found.",
      { findingCount: findings.length },
    ),
    diagnostic(
      scopePassed ? "SCOPEVERSION_TRACEABILITY_VALIDATED" : "SCOPEVERSION_TRACEABILITY_ERROR",
      scopePassed ? "INFO" : "ERROR",
      scopePassed ? "ScopeVersion traceability validated." : "ScopeVersion traceability errors found.",
      { findingCount: scopeFindings.length },
    ),
  );

  return {
    auditId: `TRACEABILITY-AUDIT-${snapshot.snapshotId}`,
    snapshotId: snapshot.snapshotId,
    passed,
    customerCount: snapshot.customers.length,
    opportunityCount: snapshot.opportunities.length,
    corridorCount: snapshot.corridors.length,
    scopeVersionCount: snapshot.scopeVersions.length,
    orphanReferenceCount: findings.filter((item) => item.message.includes("Orphan") || item.message.includes("Invalid parent")).length,
    missingTraceabilityCount: findings.filter((item) => item.message.startsWith("Missing")).length,
    findings,
    diagnostics,
  };
}

export function runAuthorityAudit(snapshot: ConstitutionalRuntimeSnapshot): AuthorityAuditResult {
  const findings: AuditFinding[] = [];
  const diagnostics: AuditDiagnostic[] = [];
  const events = snapshot.authorityEvents ?? [];

  for (const event of events) {
    if (ADVISORY_ONLY_LAYERS.has(event.authorityLayer as never) && event.actionType !== "ADVISORY" && event.actionType !== "PROJECTION") {
      findings.push(authorityFinding(event, `${event.authorityLayer} may not create authority.`, "CRITICAL"));
    }
    if (event.actorRole === "AI_ASSISTANT_ADVISORY" && event.actionType !== "ADVISORY") {
      findings.push(authorityFinding(event, "AI advisory actor attempted non-advisory authority.", "CRITICAL"));
    }
    const allowed = EXECUTION_LAYER_ACTIONS[event.authorityLayer];
    if (allowed && !allowed.includes(event.actionType)) {
      findings.push(authorityFinding(event, `${event.authorityLayer} used invalid action ${event.actionType}.`, "ERROR"));
    }
  }

  const passed = !hasError(findings);
  diagnostics.push(
    diagnostic(
      passed ? "AUTHORITY_BOUNDARY_VALIDATED" : "AUTHORITY_VIOLATION",
      passed ? "INFO" : "ERROR",
      passed ? "Authority boundaries validated." : "Authority boundary violations found.",
      { findingCount: findings.length },
    ),
  );

  return {
    auditId: `AUTHORITY-AUDIT-${snapshot.snapshotId}`,
    snapshotId: snapshot.snapshotId,
    passed,
    advisoryEvents: events.filter((event) => event.actionType === "ADVISORY").length,
    authorityEvents: events.filter((event) => event.actionType !== "ADVISORY").length,
    authorityViolations: findings.length,
    findings,
    diagnostics,
  };
}

export function runCloseAudit(snapshot: ConstitutionalRuntimeSnapshot): CloseAuditResult {
  const findings: AuditFinding[] = [];
  const diagnostics: AuditDiagnostic[] = [];
  const closeEvents = snapshot.closeEvents ?? [];
  const presentCloseTypes = new Set(closeEvents.map((close) => close.closeType));

  for (const close of closeEvents) {
    validateTraceKeys("CloseEvent", close.closeId, close, findings, "CLOSE_AUTHORITY");
    if (!close.actorId || !close.actorRole) {
      findings.push(closeFinding(close.closeId, "Close event is missing actor attribution.", "CRITICAL"));
    }
    if (close.actorRole === "AI_ASSISTANT_ADVISORY") {
      findings.push(closeFinding(close.closeId, "AI advisory actor may not validate a close.", "CRITICAL"));
    }
    if (close.immutable && !close.validatedAt) {
      findings.push(closeFinding(close.closeId, "Immutable close is missing validatedAt.", "ERROR"));
    }
    if (close.authority.closeType !== close.closeType) {
      findings.push(closeFinding(close.closeId, "Close authority type does not match close type.", "ERROR"));
    }
  }

  for (const transition of snapshot.lifecycleTransitions ?? []) {
    const required = getRequiredCloses(transition.requestedState);
    const matchingCloseTypes = new Set(
      closeEvents
        .filter((close) => close.scopeVersionId === transition.scopeVersionId && close.immutable && close.validatedAt)
        .map((close) => close.closeType),
    );
    required
      .filter((closeType) => !matchingCloseTypes.has(closeType))
      .forEach((closeType) => findings.push(closeFinding(transition.transitionId, `${closeType} missing for lifecycle transition.`, "ERROR")));
  }

  const requiredCloseTypesPresent = REQUIRED_EXECUTION_CLOSE_TYPES.filter((closeType) => presentCloseTypes.has(closeType));
  const requiredCloseTypesMissing = REQUIRED_EXECUTION_CLOSE_TYPES.filter((closeType) => !presentCloseTypes.has(closeType));
  requiredCloseTypesMissing.forEach((closeType) =>
    findings.push(closeFinding(closeType, `${closeType} is missing from the runtime snapshot.`, "WARNING")),
  );

  const passed = !hasError(findings);
  diagnostics.push(
    diagnostic(
      passed ? "CLOSE_AUTHORITY_VALIDATED" : "CLOSE_AUTHORITY_ERROR",
      passed ? "INFO" : "ERROR",
      passed ? "Close authority validated." : "Close authority findings found.",
      { findingCount: findings.length },
    ),
  );

  return {
    auditId: `CLOSE-AUDIT-${snapshot.snapshotId}`,
    snapshotId: snapshot.snapshotId,
    passed,
    closeCount: closeEvents.length,
    invalidCloseCount: findings.filter((item) => item.severity === "ERROR" || item.severity === "CRITICAL").length,
    requiredCloseTypesPresent,
    requiredCloseTypesMissing,
    findings,
    diagnostics,
  };
}

export function runLifecycleAudit(snapshot: ConstitutionalRuntimeSnapshot): LifecycleAuditResult {
  const findings: AuditFinding[] = [];
  const diagnostics: AuditDiagnostic[] = [];
  const knownStates = new Set<string>(SCOPEVERSION_STATE_REGISTRY);

  for (const scopeVersion of snapshot.scopeVersions) {
    if (scopeVersion.lifecycleState && !knownStates.has(scopeVersion.lifecycleState)) {
      findings.push(lifecycleFinding(scopeVersion.scopeVersionId, `Unknown lifecycle state ${scopeVersion.lifecycleState}.`, "ERROR"));
    }
  }

  for (const transition of snapshot.lifecycleTransitions ?? []) {
    if (!isKnownTransition(transition.previousState, transition.requestedState)) {
      findings.push(lifecycleFinding(transition.transitionId, `${transition.previousState} -> ${transition.requestedState} is not registered.`, "CRITICAL"));
    }
    if (transition.approved && transition.missingCloseTypes.length) {
      findings.push(lifecycleFinding(transition.transitionId, "Approved transition has missing close types.", "CRITICAL"));
    }
  }

  SCOPEVERSION_STATE_REGISTRY
    .filter((state) => state !== "INTENT")
    .filter((state) => !SCOPEVERSION_TRANSITION_REGISTRY.some((transition) => transition.to === state))
    .forEach((state) => findings.push(lifecycleFinding(state, `${state} is unreachable in transition registry.`, "WARNING")));

  const passed = !hasError(findings);
  diagnostics.push(
    diagnostic(
      passed ? "LIFECYCLE_VALIDATED" : "LIFECYCLE_ERROR",
      passed ? "INFO" : "ERROR",
      passed ? "Lifecycle transitions validated." : "Lifecycle findings found.",
      { findingCount: findings.length },
    ),
  );

  return {
    auditId: `LIFECYCLE-AUDIT-${snapshot.snapshotId}`,
    snapshotId: snapshot.snapshotId,
    passed,
    transitionCount: snapshot.lifecycleTransitions?.length ?? 0,
    invalidTransitionCount: findings.filter((item) => item.severity === "ERROR" || item.severity === "CRITICAL").length,
    unreachableStateCount: findings.filter((item) => item.message.includes("unreachable")).length,
    findings,
    diagnostics,
  };
}

export function runReplayabilityAudit(snapshot: ConstitutionalRuntimeSnapshot): ReplayabilityAuditResult {
  const findings: AuditFinding[] = [];
  const diagnostics: AuditDiagnostic[] = [];
  const closeAuditIds = new Set((snapshot.closeAudits ?? []).map((audit) => audit.closeId));
  const lifecycleAuditTransitions = new Set((snapshot.lifecycleAudits ?? []).map((audit) => `${audit.scopeVersionId}:${audit.previousState}:${audit.requestedState}`));
  let replayableEvents = 0;

  for (const close of snapshot.closeEvents ?? []) {
    if (closeAuditIds.has(close.closeId)) {
      replayableEvents += 1;
    } else {
      findings.push(replayFinding(close.closeId, "Close event is missing close audit chain.", "ERROR", "CloseEvent"));
    }
  }

  for (const transition of snapshot.lifecycleTransitions ?? []) {
    const key = `${transition.scopeVersionId}:${transition.previousState}:${transition.requestedState}`;
    if (lifecycleAuditTransitions.has(key)) {
      replayableEvents += 1;
    } else {
      findings.push(replayFinding(transition.transitionId, "Lifecycle transition is missing lifecycle audit chain.", "ERROR", "LifecycleTransition"));
    }
  }

  for (const event of snapshot.authorityEvents ?? []) {
    if (event.auditId || event.closeId) {
      replayableEvents += 1;
    } else {
      findings.push(replayFinding(event.eventId, "Authority event is missing audit or close reference.", "ERROR", "AuthorityEvent"));
    }
  }

  const passed = !hasError(findings);
  diagnostics.push(
    diagnostic(
      passed ? "REPLAYABILITY_VALIDATED" : "REPLAYABILITY_ERROR",
      passed ? "INFO" : "ERROR",
      passed ? "Replayability validated." : "Replayability findings found.",
      { findingCount: findings.length },
    ),
  );

  return {
    auditId: `REPLAYABILITY-AUDIT-${snapshot.snapshotId}`,
    snapshotId: snapshot.snapshotId,
    passed,
    replayableEvents,
    missingAuditChains: findings.length,
    findings,
    diagnostics,
  };
}

export function runConstitutionalAudit(snapshot: ConstitutionalRuntimeSnapshot): ConstitutionalAudit {
  const started = diagnostic("CONSTITUTIONAL_AUDIT_STARTED", "INFO", "Constitutional audit started.", {
    snapshotId: snapshot.snapshotId,
  });
  console.info("[CONSTITUTIONAL_AUDIT_STARTED]", { snapshotId: snapshot.snapshotId });

  const traceability = runTraceabilityAudit(snapshot);
  const authority = runAuthorityAudit(snapshot);
  const lifecycle = runLifecycleAudit(snapshot);
  const closeAuthority = runCloseAudit(snapshot);
  const replayability = runReplayabilityAudit(snapshot);
  const patentAlignmentFindings = patentAlignmentAudit(snapshot, {
    traceabilityPassed: traceability.passed,
    authorityPassed: authority.passed,
    lifecyclePassed: lifecycle.passed,
    closePassed: closeAuthority.passed,
    replayabilityPassed: replayability.passed,
  });
  const findings = [
    ...traceability.findings,
    ...authority.findings,
    ...lifecycle.findings,
    ...closeAuthority.findings,
    ...replayability.findings,
    ...patentAlignmentFindings,
  ];
  const passed = !hasError(findings);
  const diagnostics = [
    started,
    ...traceability.diagnostics,
    ...authority.diagnostics,
    ...lifecycle.diagnostics,
    ...closeAuthority.diagnostics,
    ...replayability.diagnostics,
    diagnostic(
      passed ? "CONSTITUTIONAL_AUDIT_PASSED" : hasCritical(findings) ? "CONSTITUTIONAL_AUDIT_ERROR" : "CONSTITUTIONAL_AUDIT_WARNING",
      passed ? "INFO" : hasCritical(findings) ? "ERROR" : "WARNING",
      passed ? "Constitutional audit passed." : "Constitutional audit found issues.",
      { findingCount: findings.length },
    ),
    diagnostic("CONSTITUTIONAL_AUDIT_COMPLETE", "INFO", "Constitutional audit complete.", {
      passed,
      findingCount: findings.length,
    }),
  ];

  console.info("[CONSTITUTIONAL_AUDIT_COMPLETE]", {
    snapshotId: snapshot.snapshotId,
    passed,
    findingCount: findings.length,
  });

  return {
    auditId: `CONSTITUTIONAL-AUDIT-${snapshot.snapshotId}`,
    snapshotId: snapshot.snapshotId,
    passed,
    traceability,
    authority,
    lifecycle,
    closeAuthority,
    replayability,
    patentAlignmentFindings,
    findings,
    diagnostics,
    completedAt: nowIso(),
  };
}

function validateTraceKeys(
  objectType: string,
  objectId: string,
  object: Partial<Record<(typeof REQUIRED_TRACE_KEYS)[number], string | undefined>>,
  findings: AuditFinding[],
  findingType: AuditFindingType = "TRACEABILITY",
) {
  for (const key of REQUIRED_TRACE_KEYS) {
    if (!object[key]) {
      findings.push(
        finding({
          findingType,
          severity: "CRITICAL",
          message: `Missing ${key}.`,
          objectType,
          objectId,
          remediation: `Provide ${key} so the object is traceable and replayable.`,
        }),
      );
    }
  }
}

function traceFinding(objectType: string, objectId: string, message: string, severity: AuditSeverity): AuditFinding {
  return finding({
    findingType: "TRACEABILITY",
    severity,
    message,
    objectType,
    objectId,
  });
}

function authorityFinding(event: ConstitutionalAuthorityEvent, message: string, severity: AuditSeverity): AuditFinding {
  return finding({
    findingType: "AUTHORITY",
    severity,
    message,
    objectType: "AuthorityEvent",
    objectId: event.eventId,
    sourceLayer: event.authorityLayer,
  });
}

function closeFinding(objectId: string, message: string, severity: AuditSeverity): AuditFinding {
  return finding({
    findingType: "CLOSE_AUTHORITY",
    severity,
    message,
    objectType: "CloseEvent",
    objectId,
  });
}

function lifecycleFinding(objectId: string, message: string, severity: AuditSeverity): AuditFinding {
  return finding({
    findingType: "LIFECYCLE",
    severity,
    message,
    objectType: "LifecycleTransition",
    objectId,
  });
}

function replayFinding(objectId: string, message: string, severity: AuditSeverity, objectType: string): AuditFinding {
  return finding({
    findingType: "REPLAYABILITY",
    severity,
    message,
    objectType,
    objectId,
  });
}

function isKnownTransition(previousState: ScopeVersionState, requestedState: ScopeVersionState): boolean {
  return SCOPEVERSION_TRANSITION_REGISTRY.some(
    (transition) => transition.from === previousState && transition.to === requestedState,
  );
}

function patentAlignmentAudit(
  snapshot: ConstitutionalRuntimeSnapshot,
  checks: {
    traceabilityPassed: boolean;
    authorityPassed: boolean;
    lifecyclePassed: boolean;
    closePassed: boolean;
    replayabilityPassed: boolean;
  },
): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const aiAuthorityEvents = (snapshot.authorityEvents ?? []).filter(
    (event) => event.actorRole === "AI_ASSISTANT_ADVISORY" && event.actionType !== "ADVISORY",
  );
  if (aiAuthorityEvents.length) {
    findings.push(
      finding({
        findingType: "PATENT_ALIGNMENT",
        severity: "CRITICAL",
        message: "AI advisory actor attempted authority-bearing action.",
        objectType: "AuthorityEvent",
        objectId: aiAuthorityEvents[0]?.eventId,
        remediation: "Keep AI advisory outputs evidence-only until a human or system authority validates the action.",
      }),
    );
  }
  if (!checks.traceabilityPassed || !checks.authorityPassed || !checks.lifecyclePassed || !checks.closePassed || !checks.replayabilityPassed) {
    findings.push(
      finding({
        findingType: "PATENT_ALIGNMENT",
        severity: "WARNING",
        message: "Patent-alignment review found constitutional audit findings. This is documentation only, not legal analysis.",
        objectType: "ConstitutionalAudit",
        objectId: snapshot.snapshotId,
      }),
    );
  }
  return findings;
}

function hasError(findings: readonly AuditFinding[]): boolean {
  return findings.some((item) => item.severity === "ERROR" || item.severity === "CRITICAL");
}

function hasCritical(findings: readonly AuditFinding[]): boolean {
  return findings.some((item) => item.severity === "CRITICAL");
}
