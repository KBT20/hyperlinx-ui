import type {
  ClosureRecord,
  ControlWorkItem,
  ControlWorkStatus,
  FieldClosure,
  ScopeInfrastructureObject,
  ScopeVersion,
  ScopeVersionExecutionState,
} from "../types/dal";
import { getAuthoritativeLifecycleState } from "./ScopeVersionLifecycleGuard";

export type LifecycleViolationCode =
  | "FIELD_CLOSURE_WITHOUT_ACTIVE_WORK"
  | "FIELD_CLOSURE_BEFORE_SCOPE_APPROVAL"
  | "FIELD_CLOSURE_WITHOUT_CONTROL_WORK"
  | "CONTROL_WORK_WITHOUT_APPROVED_SCOPE"
  | "CONTROL_WORK_WITHOUT_CERTIFIED_ROUTE"
  | "SCOPEVERSION_APPROVED_WITHOUT_CERTIFIED_ROUTE"
  | "OBJECT_CLOSED_WITHOUT_RELEASE"
  | "STATION_CLOSED_WITHOUT_OBJECT_COMPLETION"
  | "TWIN_STATE_DRIFT";

export type LifecycleViolation = {
  violationId: string;
  severity: "INFO" | "WARNING" | "BLOCKING";
  code: LifecycleViolationCode;
  scopeVersionId: string;
  workItemId?: string;
  closureId?: string;
  message: string;
  recommendedAction: string;
  createdAt: string;
};

const CONTROL_APPROVED_STATUSES = new Set([
  "APPROVED",
  "CONTROL",
  "CONTROL_ACTIVE",
  "FIELD",
  "PARTIALLY_COMPLETE",
  "COMPLETE",
  "VERIFIED",
  "OPERATIONAL",
]);

const CONTROL_ACTIVATION_STATUSES = new Set(["APPROVED", "CONTROL"]);
const FIELD_EXECUTABLE_STATUSES = new Set(["CONTROL_ACTIVE", "FIELD"]);

const CLOSED_OBJECT_STATES = new Set(["INSTALLED", "TESTED", "ACCEPTED", "COMPLETE", "VERIFIED"]);
const COMPLETE_OBJECT_STATES = new Set(["COMPLETE", "VERIFIED"]);

function stationCount(scope: ScopeVersion | null | undefined) {
  return Array.isArray(scope?.canonicalTruth?.stations) ? scope.canonicalTruth.stations.length : 0;
}

function objectCount(scope: ScopeVersion | null | undefined) {
  return Array.isArray(scope?.canonicalTruth?.objects) ? scope.canonicalTruth.objects.length : 0;
}

function routeAuthority(scope: ScopeVersion | null | undefined) {
  return scope?.certifiedRouteReference?.routeAuthorityState ?? (scope?.canonicalTruth as any)?.certifiedRouteReference?.routeAuthorityState;
}

function hasRouteAuthority(scope: ScopeVersion | null | undefined) {
  return ["CERTIFIED_ROUTE", "PROVISIONALLY_CERTIFIED"].includes(String(routeAuthority(scope)));
}

function scopeClosures(scope: ScopeVersion): ClosureRecord[] {
  const byId = new Map<string, ClosureRecord>();
  [...(scope.canonicalTruth?.closures ?? []), ...(scope.closures ?? [])].forEach((closure) => {
    if (closure?.closureId) byId.set(closure.closureId, closure);
  });
  return Array.from(byId.values()).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

function isScopeClosure(value: ClosureRecord | FieldClosure): value is ClosureRecord {
  return typeof (value as ClosureRecord).certifiedRouteId === "string" || Array.isArray((value as ClosureRecord).objectIds);
}

function closureScopeId(closure: ClosureRecord | FieldClosure) {
  return String(closure.scopeVersionId ?? "");
}

function closureTimestamp(closure: ClosureRecord | FieldClosure, scope?: ScopeVersion) {
  return String((closure as ClosureRecord).createdAt ?? (closure as FieldClosure).closedAt ?? scope?.updatedAt ?? "");
}

function createViolation(input: Omit<LifecycleViolation, "violationId">): LifecycleViolation {
  return {
    ...input,
    violationId: [
      input.code,
      input.scopeVersionId || "NO_SCOPE",
      input.workItemId || "NO_WORK",
      input.closureId || "NO_CLOSURE",
    ].join(":"),
  };
}

export function isScopeVersionApprovedForControl(scope: ScopeVersion | null | undefined): boolean {
  const lifecycleState = getAuthoritativeLifecycleState(scope);
  const approved =
    Boolean(scope) &&
    CONTROL_APPROVED_STATUSES.has(String(lifecycleState)) &&
    hasRouteAuthority(scope) &&
    stationCount(scope) > 0 &&
    objectCount(scope) > 0;
  console.log("[LIFECYCLE_AUTHORITY_CHECK]", {
    check: "isScopeVersionApprovedForControl",
    scopeVersionId: scope?.scopeVersionId ?? "none",
    lifecycleState,
    routeAuthority: routeAuthority(scope) ?? "none",
    stationCount: stationCount(scope),
    objectCount: objectCount(scope),
    approved,
  });
  return approved;
}

export function canControlCreateWork(scope: ScopeVersion | null | undefined): { allowed: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const lifecycleState = getAuthoritativeLifecycleState(scope);
  if (!scope) reasons.push("Select a ScopeVersion before creating Control work.");
  if (scope && lifecycleState !== "APPROVED") reasons.push("ScopeVersion must be APPROVED before Control can generate work.");
  if (scope && !hasRouteAuthority(scope)) reasons.push("CertifiedRoute authority is required before Control can generate work.");
  if (scope && stationCount(scope) <= 0) reasons.push("ScopeVersion stationing is required before Control can generate work.");
  if (scope && objectCount(scope) <= 0) reasons.push("ScopeVersion objects are required before Control can generate work.");
  const result = { allowed: reasons.length === 0, reasons };
  console.log("[LIFECYCLE_AUTHORITY_CHECK]", {
    check: "canControlCreateWork",
    scopeVersionId: scope?.scopeVersionId ?? "none",
    lifecycleState,
    routeAuthority: routeAuthority(scope) ?? "none",
    stationCount: stationCount(scope),
    objectCount: objectCount(scope),
    ...result,
  });
  return result;
}

export function canControlActivateWork(scope: ScopeVersion | null | undefined, workItem?: ControlWorkItem): { allowed: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const lifecycleState = getAuthoritativeLifecycleState(scope);
  if (!scope) reasons.push("Select a ScopeVersion before activating Control work.");
  if (scope && !CONTROL_ACTIVATION_STATUSES.has(String(lifecycleState))) {
    reasons.push("ScopeVersion must be APPROVED or CONTROL before Control activation.");
  }
  if (!workItem) reasons.push("Select a Control work package before activation.");
  if (workItem && workItem.scopeVersionId !== scope?.scopeVersionId) reasons.push("Selected Control work package does not belong to this ScopeVersion.");
  if (scope && !hasRouteAuthority(scope)) reasons.push("CertifiedRoute authority is required before Control activation.");
  if (scope && stationCount(scope) <= 0) reasons.push("ScopeVersion stationing is required before Control activation.");
  if (scope && objectCount(scope) <= 0) reasons.push("ScopeVersion objects are required before Control activation.");
  const result = { allowed: reasons.length === 0, reasons };
  console.log("[LIFECYCLE_AUTHORITY_CHECK]", {
    check: "canControlActivateWork",
    scopeVersionId: scope?.scopeVersionId ?? "none",
    lifecycleState,
    workItemId: workItem?.workItemId ?? "none",
    workStatus: workItem?.status ?? "none",
    routeAuthority: routeAuthority(scope) ?? "none",
    stationCount: stationCount(scope),
    objectCount: objectCount(scope),
    ...result,
  });
  return result;
}

export function canFieldExecute(scope: ScopeVersion | null | undefined, workItem?: ControlWorkItem): { allowed: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const lifecycleState = getAuthoritativeLifecycleState(scope);
  if (!scope) reasons.push("Select a ScopeVersion before Field execution.");
  if (scope && !FIELD_EXECUTABLE_STATUSES.has(String(lifecycleState))) reasons.push("LIFECYCLE_AUTHORITY_VIOLATION: ScopeVersion must be CONTROL_ACTIVE or FIELD before Field execution.");
  if (!workItem) reasons.push("No active Control work package is selected.");
  if (workItem && workItem.status !== "ACTIVE") reasons.push("Selected Control work package must be ACTIVE.");
  if (scope && workItem && workItem.scopeVersionId !== scope.scopeVersionId) reasons.push("Selected Control work package does not belong to this ScopeVersion.");
  if (scope && !hasRouteAuthority(scope)) reasons.push("CertifiedRoute authority is required before Field execution.");
  if (scope && stationCount(scope) <= 0) reasons.push("ScopeVersion stationing is required before Field execution.");
  if (scope && objectCount(scope) <= 0) reasons.push("ScopeVersion objects are required before Field execution.");
  const result = { allowed: reasons.length === 0, reasons };
  console.log("[FIELD_EXECUTION_GATE]", {
    scopeVersionId: scope?.scopeVersionId ?? "none",
    lifecycleState,
    workItemId: workItem?.workItemId ?? "none",
    workStatus: workItem?.status ?? "none",
    routeAuthority: routeAuthority(scope) ?? "none",
    stationCount: stationCount(scope),
    objectCount: objectCount(scope),
    ...result,
  });
  return result;
}

function statusForType(workItems: ControlWorkItem[], workType: NonNullable<ControlWorkItem["workType"]>): ControlWorkStatus | "NOT_CREATED" {
  const item = workItems.find((workItem) => workItem.workType === workType);
  return item?.status ?? "NOT_CREATED";
}

export function buildScopeVersionExecutionState(scopeVersionId: string, workItems: ControlWorkItem[]): ScopeVersionExecutionState {
  const scopedItems = workItems.filter((workItem) => workItem.scopeVersionId === scopeVersionId);
  const statuses = scopedItems.map((workItem) => workItem.status);
  const overallExecutionState: ScopeVersionExecutionState["overallExecutionState"] =
    !scopedItems.length
      ? "NOT_CREATED"
      : statuses.every((status) => status === "COMPLETE")
        ? "COMPLETE"
        : statuses.some((status) => status === "ACTIVE")
          ? "ACTIVE"
          : statuses.some((status) => status === "ON_HOLD")
            ? "ON_HOLD"
            : statuses.some((status) => status === "COMPLETE")
              ? "PARTIALLY_COMPLETE"
              : statuses.every((status) => status === "CANCELLED")
                ? "CANCELLED"
                : "PENDING";

  return {
    scopeVersionId,
    engineeringStatus: statusForType(scopedItems, "ENGINEERING"),
    permittingStatus: statusForType(scopedItems, "PERMITTING"),
    constructionStatus: statusForType(scopedItems, "CONSTRUCTION"),
    validationStatus: statusForType(scopedItems, "VALIDATION"),
    activationStatus: statusForType(scopedItems, "ACTIVATION"),
    overallExecutionState,
    updatedAt: new Date().toISOString(),
  };
}

export function withScopeVersionExecutionState(scopeVersion: ScopeVersion, workItems: ControlWorkItem[]): ScopeVersion {
  const executionState = buildScopeVersionExecutionState(scopeVersion.scopeVersionId, workItems);
  return {
    ...scopeVersion,
    canonicalTruth: {
      ...scopeVersion.canonicalTruth,
      executionState,
    },
  };
}

export function deriveLifecycleViolations(
  scopeVersions: ScopeVersion[],
  workItems: ControlWorkItem[],
  closures: Array<ClosureRecord | FieldClosure>
): LifecycleViolation[] {
  const scopesById = new Map(scopeVersions.map((scope) => [scope.scopeVersionId, scope]));
  const workByScope = new Map<string, ControlWorkItem[]>();
  workItems.forEach((workItem) => {
    if (!workItem.scopeVersionId) return;
    const list = workByScope.get(workItem.scopeVersionId) ?? [];
    list.push(workItem);
    workByScope.set(workItem.scopeVersionId, list);
  });
  const allClosures = [
    ...closures,
    ...scopeVersions.flatMap(scopeClosures),
  ].filter((closure, index, list) => {
    const id = (closure as ClosureRecord).closureId ?? (closure as FieldClosure).closureId;
    return id ? list.findIndex((item) => ((item as ClosureRecord).closureId ?? (item as FieldClosure).closureId) === id) === index : true;
  });
  const violations: LifecycleViolation[] = [];

  scopeVersions.forEach((scope) => {
    const lifecycleState = getAuthoritativeLifecycleState(scope);
    if (lifecycleState === "APPROVED" && !hasRouteAuthority(scope)) {
      violations.push(createViolation({
        severity: "BLOCKING",
        code: "SCOPEVERSION_APPROVED_WITHOUT_CERTIFIED_ROUTE",
        scopeVersionId: scope.scopeVersionId,
        message: "ScopeVersion is APPROVED without certified route authority.",
        recommendedAction: "Return the ScopeVersion to Route Engineering for CertifiedRoute authority before Control work.",
        createdAt: scope.updatedAt,
      }));
    }
  });

  workItems.forEach((workItem) => {
    const scope = workItem.scopeVersionId ? scopesById.get(workItem.scopeVersionId) : undefined;
    if (!scope || !isScopeVersionApprovedForControl(scope)) {
      violations.push(createViolation({
        severity: "BLOCKING",
        code: "CONTROL_WORK_WITHOUT_APPROVED_SCOPE",
        scopeVersionId: workItem.scopeVersionId ?? "UNKNOWN_SCOPE",
        workItemId: workItem.workItemId,
        message: "Control work exists without an approved executable ScopeVersion.",
        recommendedAction: "Approve the ScopeVersion through Route Engineering before Control work is created or activated.",
        createdAt: workItem.updatedAt ?? workItem.createdAt,
      }));
    }
    if (scope && !hasRouteAuthority(scope)) {
      violations.push(createViolation({
        severity: "BLOCKING",
        code: "CONTROL_WORK_WITHOUT_CERTIFIED_ROUTE",
        scopeVersionId: scope.scopeVersionId,
        workItemId: workItem.workItemId,
        message: "Control work exists for a ScopeVersion without CertifiedRoute authority.",
        recommendedAction: "Attach a CERTIFIED_ROUTE or PROVISIONALLY_CERTIFIED route reference before execution.",
        createdAt: workItem.updatedAt ?? workItem.createdAt,
      }));
    }
  });

  allClosures.forEach((closure) => {
    const scopeVersionId = closureScopeId(closure);
    const scope = scopesById.get(scopeVersionId);
    const workForScope = workByScope.get(scopeVersionId) ?? [];
    const activeOrCompleteWork = workForScope.filter((workItem) => workItem.status === "ACTIVE" || workItem.status === "COMPLETE");
    const closureId = (closure as ClosureRecord).closureId ?? (closure as FieldClosure).closureId;
    const workItemId = (closure as ClosureRecord).workItemId ?? (closure as FieldClosure).workItemId;
    if (!workForScope.length) {
      violations.push(createViolation({
        severity: "BLOCKING",
        code: "FIELD_CLOSURE_WITHOUT_CONTROL_WORK",
        scopeVersionId,
        closureId,
        message: "A field closure exists without a Control work package for the ScopeVersion.",
        recommendedAction: "Create and activate Control work before accepting new Field closures.",
        createdAt: closureTimestamp(closure, scope),
      }));
    }
    if (!activeOrCompleteWork.length) {
      violations.push(createViolation({
        severity: "BLOCKING",
        code: "FIELD_CLOSURE_WITHOUT_ACTIVE_WORK",
        scopeVersionId,
        workItemId,
        closureId,
        message: "A field closure exists without ACTIVE or completed Control work for this ScopeVersion.",
        recommendedAction: "Activate Control work before Field execution.",
        createdAt: closureTimestamp(closure, scope),
      }));
    }
    const lifecycleState = getAuthoritativeLifecycleState(scope);
    if (!scope || !CONTROL_APPROVED_STATUSES.has(String(lifecycleState))) {
      violations.push(createViolation({
        severity: "BLOCKING",
        code: "FIELD_CLOSURE_BEFORE_SCOPE_APPROVAL",
        scopeVersionId,
        workItemId,
        closureId,
        message: "A field closure exists before ScopeVersion approval.",
        recommendedAction: "Approve the ScopeVersion before Field closure authority is used.",
        createdAt: closureTimestamp(closure, scope),
      }));
    }
    if (scope && isScopeClosure(closure) && closure.newObjectState && CLOSED_OBJECT_STATES.has(closure.newObjectState)) {
      const previousStates = Object.values(closure.previousObjectStates ?? {});
      if (!previousStates.length || previousStates.includes("PLANNED")) {
        violations.push(createViolation({
          severity: "WARNING",
          code: "OBJECT_CLOSED_WITHOUT_RELEASE",
          scopeVersionId,
          workItemId,
          closureId,
          message: "An object closure appears to close work before object release.",
          recommendedAction: "Release object work before installation, test, acceptance, completion, or verification.",
          createdAt: closureTimestamp(closure, scope),
        }));
      }
    }
    if (scope && isScopeClosure(closure) && closure.newStationState && ["COMPLETE", "VERIFIED"].includes(closure.newStationState)) {
      const objects = (scope.canonicalTruth?.objects ?? []) as ScopeInfrastructureObject[];
      const affectedStationIds = new Set([closure.stationId, closure.stationStartId, closure.stationEndId].filter(Boolean));
      const affectedObjects = objects.filter((object) => affectedStationIds.has(object.stationId));
      if (affectedObjects.some((object) => !COMPLETE_OBJECT_STATES.has(object.objectState))) {
        violations.push(createViolation({
          severity: "WARNING",
          code: "STATION_CLOSED_WITHOUT_OBJECT_COMPLETION",
          scopeVersionId,
          workItemId,
          closureId,
          message: "A station was completed or verified while one or more attached objects remain incomplete.",
          recommendedAction: "Complete station objects before completing or verifying the station.",
          createdAt: closureTimestamp(closure, scope),
        }));
      }
    }
  });

  const fieldLedgerScopeIds = new Set(closures.filter((closure) => !isScopeClosure(closure)).map(closureScopeId).filter(Boolean));
  fieldLedgerScopeIds.forEach((scopeVersionId) => {
    const scope = scopesById.get(scopeVersionId);
    if (scope && !scopeClosures(scope).length) {
      violations.push(createViolation({
        severity: "INFO",
        code: "TWIN_STATE_DRIFT",
        scopeVersionId,
        message: "Server field closure ledger has records that are not present in the ScopeVersion closure ledger.",
        recommendedAction: "Reconcile FieldClosure ledger and ScopeVersion ClosureRecord projection before treating Twin state as authoritative.",
        createdAt: scope.updatedAt,
      }));
    }
  });

  const unique = Array.from(new Map(violations.map((violation) => [violation.violationId, violation])).values());
  console.log("[LIFECYCLE_VIOLATIONS]", {
    scopeVersionCount: scopeVersions.length,
    workItemCount: workItems.length,
    closureCount: allClosures.length,
    violationCount: unique.length,
    blockingCount: unique.filter((violation) => violation.severity === "BLOCKING").length,
  });
  return unique;
}
