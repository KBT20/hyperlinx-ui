import type {
  ClosureRecord,
  ControlWorkItem,
  FieldClosure,
  ScopeInfrastructureObject,
  ScopeVersion,
  ScopeVersionCertifiedRouteReference,
  TwinState,
} from "../types/dal";
import { getAuthoritativeLifecycleState, lifecycleRank, normalizeLifecycleState } from "../scopeversion/ScopeVersionLifecycleGuard";
import { isKernelAlias, kernelAliasTarget } from "./KernelStateRegistry";

export type KernelInvariantSeverity = "INFO" | "WARNING" | "BLOCKING";

export type KernelInvariant = {
  invariantId: string;
  severity: KernelInvariantSeverity;
  code: string;
  entityId: string;
  message: string;
  recommendedAction: string;
};

export type KernelInvariantContext = {
  scopeVersion?: ScopeVersion | null;
  scopeVersions?: ScopeVersion[];
  previousScopeVersion?: ScopeVersion | null;
  nextScopeVersion?: ScopeVersion | null;
  workItems?: ControlWorkItem[];
  closures?: Array<ClosureRecord | FieldClosure>;
  twinState?: TwinState | null;
  selectedScopeVersionId?: string;
  portfolioScopeVersionIds?: string[];
  certifiedRoutes?: Array<{ certifiedRouteId: string; routeAuthorityState?: string }>;
  fallbackMode?: "SERVER" | "LOCAL_FALLBACK" | "DEVELOPMENT_FALLBACK";
  environment?: "development" | "production";
  duplicateAuthorityDefinitions?: string[];
};

const APPROVED_OR_LATER = new Set(["APPROVED", "CONTROL", "CONTROL_ACTIVE", "FIELD", "PARTIALLY_COMPLETE", "COMPLETE", "VERIFIED", "OPERATIONAL"]);
const CONTROL_ACTIVE_OR_LATER = new Set(["CONTROL", "CONTROL_ACTIVE", "FIELD", "PARTIALLY_COMPLETE", "COMPLETE", "VERIFIED", "OPERATIONAL"]);
const CERTIFIED_ROUTE_STATES = new Set(["CERTIFIED_ROUTE", "PROVISIONALLY_CERTIFIED"]);
const KNOWN_DUPLICATE_AUTHORITY_DEFINITIONS = [
  "Lifecycle order is implemented in client ScopeVersionLifecycleGuard and mirrored in server route modules.",
  "Station/object transition tables are implemented in client ClosureAuthorityEngine and mirrored in server scopeversions route.",
];

function invariant(input: Omit<KernelInvariant, "invariantId">): KernelInvariant {
  return {
    ...input,
    invariantId: [input.code, input.entityId || "NO_ENTITY"].join(":"),
  };
}

function isScopeClosure(value: ClosureRecord | FieldClosure): value is ClosureRecord {
  return Array.isArray((value as ClosureRecord).objectIds) || typeof (value as ClosureRecord).certifiedRouteId === "string";
}

function closureScopeVersionId(closure: ClosureRecord | FieldClosure) {
  return String(closure.scopeVersionId ?? "");
}

function closureWorkItemId(closure: ClosureRecord | FieldClosure) {
  return String((closure as ClosureRecord).workItemId ?? (closure as FieldClosure).workItemId ?? "");
}

function closureId(closure: ClosureRecord | FieldClosure) {
  return String((closure as ClosureRecord).closureId ?? (closure as FieldClosure).closureId ?? "");
}

function scopeClosures(scopeVersion: ScopeVersion): ClosureRecord[] {
  const byId = new Map<string, ClosureRecord>();
  [...(scopeVersion.canonicalTruth?.closures ?? []), ...(scopeVersion.closures ?? [])].forEach((closure) => {
    if (closure?.closureId) byId.set(closure.closureId, closure);
  });
  return Array.from(byId.values());
}

function scopeObjects(scopeVersion: ScopeVersion): ScopeInfrastructureObject[] {
  return Array.isArray(scopeVersion.canonicalTruth?.objects)
    ? scopeVersion.canonicalTruth.objects.filter((object): object is ScopeInfrastructureObject => Boolean(object?.objectId))
    : [];
}

function allScopeVersions(context: KernelInvariantContext) {
  const scopes = [...(context.scopeVersions ?? [])];
  if (context.scopeVersion) scopes.push(context.scopeVersion);
  if (context.nextScopeVersion) scopes.push(context.nextScopeVersion);
  if (context.previousScopeVersion) scopes.push(context.previousScopeVersion);
  return Array.from(new Map(scopes.map((scope) => [scope.scopeVersionId, scope])).values());
}

function certifiedRouteReference(scopeVersion: ScopeVersion | null | undefined) {
  return scopeVersion?.certifiedRouteReference ?? (scopeVersion?.canonicalTruth as Record<string, unknown> | undefined)?.certifiedRouteReference;
}

function hasCertifiedRouteReference(scopeVersion: ScopeVersion) {
  const reference = certifiedRouteReference(scopeVersion) as { routeAuthorityState?: string } | undefined;
  return Boolean(reference && CERTIFIED_ROUTE_STATES.has(String(reference.routeAuthorityState)));
}

function lifecycleSnapshot(scopeVersion: ScopeVersion | null | undefined) {
  return normalizeLifecycleState(scopeVersion?.canonicalTruth?.lifecycleState ?? scopeVersion?.status);
}

function isApprovedOrLater(scopeVersion: ScopeVersion) {
  return APPROVED_OR_LATER.has(String(getAuthoritativeLifecycleState(scopeVersion)));
}

function geometrySnapshot(scopeVersion: ScopeVersion | null | undefined) {
  if (!scopeVersion) return undefined;
  return {
    geometry: scopeVersion.geometry,
    geographicBasis: scopeVersion.canonicalTruth?.geographicBasis,
    engineeringBasisGeometry: scopeVersion.canonicalTruth?.engineeringBasis?.certifiedGeometrySnapshot,
  };
}

function stableJson(value: unknown) {
  return JSON.stringify(value ?? null);
}

function stationIds(scopeVersion: ScopeVersion) {
  return new Set((scopeVersion.canonicalTruth?.stations ?? []).map((station: any) => station?.stationId).filter(Boolean));
}

function objectIds(scopeVersion: ScopeVersion) {
  return new Set(scopeObjects(scopeVersion).map((object) => object.objectId));
}

function addScopeLifecycleInvariants(findings: KernelInvariant[], scopeVersion: ScopeVersion) {
  const canonical = normalizeLifecycleState(scopeVersion.canonicalTruth?.lifecycleState);
  const status = normalizeLifecycleState(scopeVersion.status);
  if (!canonical) {
    findings.push(invariant({
      severity: "BLOCKING",
      code: "SCOPEVERSION_CANONICAL_LIFECYCLE_MISSING",
      entityId: scopeVersion.scopeVersionId,
      message: "ScopeVersion does not contain canonicalTruth.lifecycleState.",
      recommendedAction: "Persist the ScopeVersion through ScopeVersionLifecycleGuard before using it as kernel truth.",
    }));
  }
  if (canonical && status && canonical !== status) {
    findings.push(invariant({
      severity: "WARNING",
      code: "SCOPEVERSION_LIFECYCLE_FIELD_CONFLICT",
      entityId: scopeVersion.scopeVersionId,
      message: `ScopeVersion status (${status}) and canonicalTruth.lifecycleState (${canonical}) differ.`,
      recommendedAction: "Read lifecycle through getAuthoritativeLifecycleState and reconcile through mergeScopeVersionLifecycle.",
    }));
  }
  if (isApprovedOrLater(scopeVersion) && !hasCertifiedRouteReference(scopeVersion)) {
    findings.push(invariant({
      severity: "BLOCKING",
      code: "APPROVED_SCOPEVERSION_WITHOUT_CERTIFIED_ROUTE_REFERENCE",
      entityId: scopeVersion.scopeVersionId,
      message: "Approved or executable ScopeVersion lacks a certifiedRouteReference.",
      recommendedAction: "Return to Route Engineering and attach CERTIFIED_ROUTE or PROVISIONALLY_CERTIFIED route evidence.",
    }));
  }
}

function addAliasInvariants(
  findings: KernelInvariant[],
  scopeVersions: ScopeVersion[],
  workItems: ControlWorkItem[],
  certifiedRoutes: Array<{ certifiedRouteId: string; routeAuthorityState?: string }>
) {
  workItems.forEach((workItem) => {
    if (isKernelAlias(workItem.status, "controlWork")) {
      findings.push(invariant({
        severity: "WARNING",
        code: "KERNEL_ALIAS_CONTROL_STATUS",
        entityId: workItem.workItemId,
        message: `Control work status ${workItem.status} is a legacy alias for ${kernelAliasTarget(workItem.status, "controlWork")}.`,
        recommendedAction: "Persist canonical Control work statuses through normalizeControlWorkStatus.",
      }));
    }
  });

  const routeReferences: Array<{ entityId: string; routeAuthorityState?: string }> = [
    ...certifiedRoutes.map((route) => ({ entityId: route.certifiedRouteId, routeAuthorityState: route.routeAuthorityState })),
    ...scopeVersions
      .map((scope) => ({
        entityId: scope.scopeVersionId,
        routeAuthorityState: (certifiedRouteReference(scope) as ScopeVersionCertifiedRouteReference | undefined)?.routeAuthorityState,
      }))
      .filter((item) => Boolean(item.routeAuthorityState)),
  ];

  routeReferences.forEach((reference) => {
    if (isKernelAlias(reference.routeAuthorityState, "routeAuthority")) {
      findings.push(invariant({
        severity: "WARNING",
        code: "KERNEL_ALIAS_ROUTE_AUTHORITY",
        entityId: reference.entityId,
        message: `Route authority ${reference.routeAuthorityState} is a legacy alias for ${kernelAliasTarget(reference.routeAuthorityState, "routeAuthority")}.`,
        recommendedAction: "Persist canonical route authority values through normalizeRouteAuthorityState.",
      }));
    }
  });
}

function addAuthorityConsolidationInvariants(findings: KernelInvariant[], duplicateAuthorityDefinitions?: string[]) {
  const duplicates = duplicateAuthorityDefinitions ?? KNOWN_DUPLICATE_AUTHORITY_DEFINITIONS;
  duplicates.forEach((message, index) => {
    findings.push(invariant({
      severity: "WARNING",
      code: "KERNEL_DUPLICATE_AUTHORITY_DEFINITION",
      entityId: `duplicate-authority-${index + 1}`,
      message,
      recommendedAction: "Treat the documented kernel authority file as canonical and keep mirrored server definitions generated or manually synchronized.",
    }));
  });
}

function addFallbackInvariant(findings: KernelInvariant[], context: KernelInvariantContext) {
  const fallbackMode = context.fallbackMode;
  if (!fallbackMode || fallbackMode === "SERVER") return;
  if (context.environment === "production") {
    findings.push(invariant({
      severity: "WARNING",
      code: "KERNEL_FALLBACK_ACTIVE_IN_PRODUCTION",
      entityId: fallbackMode,
      message: `${fallbackMode} is active in production mode.`,
      recommendedAction: "Reconnect to DAL server authority before treating kernel projections as authoritative.",
    }));
  } else {
    findings.push(invariant({
      severity: "INFO",
      code: "KERNEL_FALLBACK_ACTIVE",
      entityId: fallbackMode,
      message: `${fallbackMode} is active. Data is not server-authoritative.`,
      recommendedAction: "Use fallback only for local development continuity.",
    }));
  }
}

function addLifecycleRegressionInvariant(findings: KernelInvariant[], previous?: ScopeVersion | null, next?: ScopeVersion | null) {
  if (!previous || !next || previous.scopeVersionId !== next.scopeVersionId) return;
  const previousLifecycle = lifecycleSnapshot(previous);
  const nextLifecycle = lifecycleSnapshot(next);
  if (lifecycleRank(nextLifecycle) >= 0 && lifecycleRank(previousLifecycle) > lifecycleRank(nextLifecycle)) {
    findings.push(invariant({
      severity: "BLOCKING",
      code: "SCOPEVERSION_LIFECYCLE_REGRESSION",
      entityId: next.scopeVersionId,
      message: `Lifecycle regression detected: ${previousLifecycle} -> ${nextLifecycle}.`,
      recommendedAction: "Apply mergeScopeVersionLifecycle before persistence and preserve the highest-ranked lifecycle state.",
    }));
  }
}

function addImmutableEvidenceInvariants(findings: KernelInvariant[], previous?: ScopeVersion | null, next?: ScopeVersion | null) {
  if (!previous || !next || previous.scopeVersionId !== next.scopeVersionId) return;
  const previousRank = lifecycleRank(getAuthoritativeLifecycleState(previous));
  if (previous.certificationState === "CERTIFIED" || previousRank >= lifecycleRank("CERTIFIED")) {
    if (stableJson(geometrySnapshot(previous)) !== stableJson(geometrySnapshot(next))) {
      findings.push(invariant({
        severity: "BLOCKING",
        code: "IMMUTABLE_GEOMETRY_CHANGED_AFTER_CERTIFICATION",
        entityId: next.scopeVersionId,
        message: "ScopeVersion geometry changed after certification authority was established.",
        recommendedAction: "Create a child ScopeVersion or superseding certified route instead of mutating certified geometry.",
      }));
    }
  }
  if (previousRank >= lifecycleRank("APPROVED") && stableJson(certifiedRouteReference(previous)) !== stableJson(certifiedRouteReference(next))) {
    findings.push(invariant({
      severity: "BLOCKING",
      code: "CERTIFIED_ROUTE_REFERENCE_CHANGED_AFTER_APPROVAL",
      entityId: next.scopeVersionId,
      message: "certifiedRouteReference changed after approval.",
      recommendedAction: "Create a governed amendment or child ScopeVersion instead of replacing approved route evidence.",
    }));
  }
}

function addWorkItemInvariants(findings: KernelInvariant[], scopesById: Map<string, ScopeVersion>, workItems: ControlWorkItem[]) {
  workItems.forEach((workItem) => {
    const scopeVersionId = String(workItem.scopeVersionId ?? "");
    const scope = scopesById.get(scopeVersionId);
    const lifecycle = scope ? getAuthoritativeLifecycleState(scope) : undefined;
    if (!scope) {
      findings.push(invariant({
        severity: "WARNING",
        code: "CONTROL_WORK_SCOPEVERSION_NOT_LOADED",
        entityId: workItem.workItemId,
        message: `Control work item references unloaded ScopeVersion ${scopeVersionId || "UNKNOWN"}.`,
        recommendedAction: "Load the referenced ScopeVersion before treating Control work as authoritative.",
      }));
      return;
    }
    if (!APPROVED_OR_LATER.has(String(lifecycle))) {
      findings.push(invariant({
        severity: "BLOCKING",
        code: "CONTROL_WORK_BEFORE_SCOPEVERSION_APPROVAL",
        entityId: workItem.workItemId,
        message: `Control work exists while ScopeVersion lifecycle is ${lifecycle}.`,
        recommendedAction: "Approve the ScopeVersion before creating Control work.",
      }));
    }
    if (workItem.status === "ACTIVE" && !CONTROL_ACTIVE_OR_LATER.has(String(lifecycle))) {
      findings.push(invariant({
        severity: "BLOCKING",
        code: "ACTIVE_WORK_WITHOUT_CONTROL_AUTHORITY",
        entityId: workItem.workItemId,
        message: `ACTIVE Control work requires CONTROL or later lifecycle; current lifecycle is ${lifecycle}.`,
        recommendedAction: "Advance ScopeVersion through Control activation before Field execution.",
      }));
    }
  });
}

function addClosureInvariants(
  findings: KernelInvariant[],
  scopesById: Map<string, ScopeVersion>,
  workItemsById: Map<string, ControlWorkItem>,
  closures: Array<ClosureRecord | FieldClosure>
) {
  closures.forEach((closure) => {
    const id = closureId(closure);
    const scopeVersionId = closureScopeVersionId(closure);
    const workItemId = closureWorkItemId(closure);
    const scope = scopesById.get(scopeVersionId);
    const workItem = workItemId ? workItemsById.get(workItemId) : undefined;

    if (!workItemId) {
      findings.push(invariant({
        severity: "BLOCKING",
        code: "FIELD_CLOSURE_WITHOUT_WORK_ITEM_ID",
        entityId: id,
        message: "Field closure does not reference a workItemId.",
        recommendedAction: "Include the active ControlWorkItem ID in every closure payload.",
      }));
    } else if (!workItem || (workItem.status !== "ACTIVE" && workItem.status !== "COMPLETE")) {
      findings.push(invariant({
        severity: "BLOCKING",
        code: "FIELD_CLOSURE_WITHOUT_ACTIVE_WORK_ITEM",
        entityId: id,
        message: "Field closure does not resolve to an ACTIVE or completed Control work item.",
        recommendedAction: "Activate Control work before accepting Field closures and preserve workItemId in the closure ledger.",
      }));
    }
    if (workItem && workItem.scopeVersionId !== scopeVersionId) {
      findings.push(invariant({
        severity: "BLOCKING",
        code: "FIELD_CLOSURE_WORK_ITEM_SCOPE_MISMATCH",
        entityId: id,
        message: `Closure scopeVersionId ${scopeVersionId} does not match work item scopeVersionId ${workItem.scopeVersionId}.`,
        recommendedAction: "Reject or repair the closure so workItemId and scopeVersionId point to the same ScopeVersion.",
      }));
    }
    if (!scope) {
      findings.push(invariant({
        severity: "WARNING",
        code: "FIELD_CLOSURE_SCOPEVERSION_NOT_LOADED",
        entityId: id,
        message: `Closure references unloaded ScopeVersion ${scopeVersionId || "UNKNOWN"}.`,
        recommendedAction: "Load the ScopeVersion before validating station and object references.",
      }));
      return;
    }
    if (isScopeClosure(closure)) {
      const validStationIds = stationIds(scope);
      const validObjectIds = objectIds(scope);
      [closure.stationId, closure.stationStartId, closure.stationEndId].filter(Boolean).forEach((stationId) => {
        if (!validStationIds.has(stationId)) {
          findings.push(invariant({
            severity: "BLOCKING",
            code: "FIELD_CLOSURE_UNKNOWN_STATION",
            entityId: id,
            message: `Closure references missing station ${stationId}.`,
            recommendedAction: "Use only constitutional RouteStation IDs from the selected ScopeVersion.",
          }));
        }
      });
      closure.objectIds.forEach((objectId) => {
        if (!validObjectIds.has(objectId)) {
          findings.push(invariant({
            severity: "BLOCKING",
            code: "FIELD_CLOSURE_UNKNOWN_OBJECT",
            entityId: id,
            message: `Closure references missing object ${objectId}.`,
            recommendedAction: "Use only ScopeInfrastructureObject IDs from the selected ScopeVersion.",
          }));
        }
      });
    }
  });
}

function addTwinIsolationInvariants(findings: KernelInvariant[], twinState: TwinState | null | undefined, selectedScopeVersionId?: string) {
  if (!twinState || !selectedScopeVersionId) return;
  if (twinState.scopeVersionId && twinState.scopeVersionId !== selectedScopeVersionId) {
    findings.push(invariant({
      severity: "BLOCKING",
      code: "TWIN_PROJECTION_SCOPEVERSION_MISMATCH",
      entityId: twinState.twinStateId,
      message: `Twin projection scopeVersionId ${twinState.scopeVersionId} does not match selected ScopeVersion ${selectedScopeVersionId}.`,
      recommendedAction: "Request Twin state with the selected ScopeVersion ID and filter all metrics to that ScopeVersion.",
    }));
  }
  (twinState.workItems ?? []).forEach((workItem) => {
    if (workItem.scopeVersionId !== selectedScopeVersionId) {
      findings.push(invariant({
        severity: "BLOCKING",
        code: "TWIN_PROJECTION_WORK_ITEM_SCOPE_LEAK",
        entityId: workItem.workItemId,
        message: "Twin projection contains a work item from another ScopeVersion.",
        recommendedAction: "Filter Twin work item inputs by selected ScopeVersion only.",
      }));
    }
  });
  (twinState.closures ?? []).forEach((closure) => {
    if (closure.scopeVersionId !== selectedScopeVersionId) {
      findings.push(invariant({
        severity: "BLOCKING",
        code: "TWIN_PROJECTION_CLOSURE_SCOPE_LEAK",
        entityId: closureId(closure),
        message: "Twin projection contains a closure from another ScopeVersion.",
        recommendedAction: "Filter Twin closure inputs by selected ScopeVersion only.",
      }));
    }
  });
}

function addPortfolioBoundaryInvariants(
  findings: KernelInvariant[],
  portfolioScopeVersionIds: string[] | undefined,
  workItems: ControlWorkItem[],
  closures: Array<ClosureRecord | FieldClosure>
) {
  if (!portfolioScopeVersionIds?.length) return;
  const allowed = new Set(portfolioScopeVersionIds);
  workItems.forEach((workItem) => {
    if (workItem.scopeVersionId && !allowed.has(workItem.scopeVersionId)) {
      findings.push(invariant({
        severity: "WARNING",
        code: "OI_PORTFOLIO_WORK_ITEM_OUTSIDE_PORTFOLIO",
        entityId: workItem.workItemId,
        message: "Operational Intelligence portfolio input contains a work item outside the declared portfolio scope.",
        recommendedAction: "Declare portfolio membership explicitly or filter the OI projection source set.",
      }));
    }
  });
  closures.forEach((closure) => {
    const scopeVersionId = closureScopeVersionId(closure);
    if (scopeVersionId && !allowed.has(scopeVersionId)) {
      findings.push(invariant({
        severity: "WARNING",
        code: "OI_PORTFOLIO_CLOSURE_OUTSIDE_PORTFOLIO",
        entityId: closureId(closure),
        message: "Operational Intelligence portfolio input contains a closure outside the declared portfolio scope.",
        recommendedAction: "Declare portfolio membership explicitly or filter the OI projection source set.",
      }));
    }
  });
}

export function checkKernelInvariants(context: KernelInvariantContext): KernelInvariant[] {
  const scopes = allScopeVersions(context);
  const scopesById = new Map(scopes.map((scope) => [scope.scopeVersionId, scope]));
  const workItems = context.workItems ?? [];
  const workItemsById = new Map(workItems.map((workItem) => [workItem.workItemId, workItem]));
  const closures = [
    ...(context.closures ?? []),
    ...scopes.flatMap(scopeClosures),
  ];
  const findings: KernelInvariant[] = [];

  scopes.forEach((scope) => addScopeLifecycleInvariants(findings, scope));
  addAliasInvariants(findings, scopes, workItems, context.certifiedRoutes ?? []);
  addAuthorityConsolidationInvariants(findings, context.duplicateAuthorityDefinitions);
  addFallbackInvariant(findings, context);
  addLifecycleRegressionInvariant(findings, context.previousScopeVersion, context.nextScopeVersion);
  addImmutableEvidenceInvariants(findings, context.previousScopeVersion, context.nextScopeVersion);
  addWorkItemInvariants(findings, scopesById, workItems);
  addClosureInvariants(findings, scopesById, workItemsById, closures);
  addTwinIsolationInvariants(findings, context.twinState, context.selectedScopeVersionId);
  addPortfolioBoundaryInvariants(findings, context.portfolioScopeVersionIds, workItems, closures);

  const unique = Array.from(new Map(findings.map((item) => [item.invariantId, item])).values());
  console.log("[KERNEL_INVARIANT_CHECK]", {
    scopeVersionCount: scopes.length,
    workItemCount: workItems.length,
    closureCount: closures.length,
    invariantCount: unique.length,
    blockingCount: unique.filter((item) => item.severity === "BLOCKING").length,
  });
  unique.forEach((item) => {
    if (item.severity === "BLOCKING" || item.severity === "WARNING") {
      if (item.code.includes("ALIAS")) console.log("[KERNEL_ALIAS_WARNING]", item);
      if (item.code.includes("DUPLICATE_AUTHORITY")) console.log("[KERNEL_DUPLICATE_AUTHORITY]", item);
      if (item.code.includes("FALLBACK")) console.log("[KERNEL_FALLBACK_WARNING]", item);
      console.log("[KERNEL_INVARIANT_VIOLATION]", item);
    }
  });
  return unique;
}
