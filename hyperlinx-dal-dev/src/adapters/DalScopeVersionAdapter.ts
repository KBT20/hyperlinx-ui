import { getAuthoritativeLifecycleState } from "../scopeversion/ScopeVersionLifecycleGuard";
import type { ClosureRecord, ScopeVersion, ScopeVersionStatus } from "../types/dal";
import type { DalAdapterDiagnostic, DalAdapterResult } from "./DalAdapter";
import { createDalAdapterDiagnostic, createDalAdapterGap, statusFromGaps } from "./DalAdapter";

export interface DalScopeVersionReference {
  scopeVersionId: string;
  status?: ScopeVersionStatus;
  lifecycleState: ScopeVersionStatus;
  lifecycleTimestamp?: string;
  customerId?: string;
  opportunityId?: string;
  corridorId?: string;
  parentScopeVersionId?: string;
  rootScopeVersionId?: string;
  closureIds: string[];
  source: string;
  canonicalTruthPresent: boolean;
  diagnostics: DalAdapterDiagnostic[];
}

export interface DalScopeVersionLifecycle {
  scopeVersionId: string;
  status?: ScopeVersionStatus;
  canonicalLifecycleState?: ScopeVersionStatus;
  authoritativeLifecycleState: ScopeVersionStatus;
  lifecycleTimestamp?: string;
  eventTypes: string[];
}

export interface DalScopeVersionTraceability {
  scopeVersionId: string;
  customerId?: string;
  opportunityId?: string;
  corridorId?: string;
  parentScopeVersionId?: string;
  rootScopeVersionId?: string;
}

export function getScopeVersion(scopeVersions: readonly ScopeVersion[], scopeVersionId: string): DalAdapterResult<ScopeVersion> {
  const scopeVersion = scopeVersions.find((candidate) => candidate.scopeVersionId === scopeVersionId);
  if (!scopeVersion) {
    return {
      status: "FAIL",
      gaps: [
        createDalAdapterGap({
          severity: "ERROR",
          message: `ScopeVersion ${scopeVersionId} was not found in DAL runtime state.`,
          sourceEntityId: scopeVersionId,
          sourceEntityType: "ScopeVersion",
          requiredAdapter: "DalScopeVersionAdapter.getScopeVersion",
        }),
      ],
      diagnostics: [
        logScopeVersionAdapterDiagnostic("SCOPEVERSION_ADAPTER_ERROR", "ERROR", "ScopeVersion adapter read failed.", {
          scopeVersionId,
        }),
      ],
    };
  }
  return {
    status: "PASS",
    value: scopeVersion,
    gaps: [],
    diagnostics: [
      logScopeVersionAdapterDiagnostic("SCOPEVERSION_ADAPTER_READ", "INFO", "ScopeVersion adapter read succeeded.", {
        scopeVersionId,
      }),
    ],
  };
}

export function getScopeVersionState(scopeVersion: ScopeVersion): ScopeVersionStatus {
  return getAuthoritativeLifecycleState(scopeVersion);
}

export function getScopeVersionTraceability(scopeVersion: ScopeVersion): DalScopeVersionTraceability {
  const canonicalTruth = asRecord(scopeVersion.canonicalTruth);
  const sourceCandidate = asRecord(canonicalTruth.sourceCandidate);
  const sourceOpportunity = asRecord(canonicalTruth.sourceOpportunity);
  const networkBasis = asRecord(canonicalTruth.networkBasis);
  return {
    scopeVersionId: scopeVersion.scopeVersionId,
    customerId: firstString((scopeVersion as Record<string, unknown>).customerId, canonicalTruth.customerId, sourceCandidate.customerId, sourceOpportunity.customerId),
    opportunityId: firstString(scopeVersion.sourceOpportunityId, canonicalTruth.opportunityId, sourceOpportunity.opportunityId, sourceCandidate.opportunityId),
    corridorId: firstString((scopeVersion as Record<string, unknown>).corridorId, canonicalTruth.corridorId, networkBasis.corridorId),
    parentScopeVersionId: scopeVersion.parentScopeVersionId,
    rootScopeVersionId: scopeVersion.rootScopeVersionId,
  };
}

export function getScopeVersionClosures(scopeVersion: ScopeVersion): readonly ClosureRecord[] {
  const canonicalClosures = Array.isArray(scopeVersion.canonicalTruth?.closures) ? scopeVersion.canonicalTruth.closures : [];
  const topLevelClosures = Array.isArray(scopeVersion.closures) ? scopeVersion.closures : [];
  const byId = new Map<string, ClosureRecord>();
  [...canonicalClosures, ...topLevelClosures].forEach((closure, index) => {
    const closureId = String(closure.closureId ?? `closure-${index}`);
    byId.set(closureId, closure);
  });
  return Array.from(byId.values());
}

export function getScopeVersionLifecycle(scopeVersion: ScopeVersion): DalScopeVersionLifecycle {
  return {
    scopeVersionId: scopeVersion.scopeVersionId,
    status: scopeVersion.status,
    canonicalLifecycleState: scopeVersion.canonicalTruth?.lifecycleState,
    authoritativeLifecycleState: getScopeVersionState(scopeVersion),
    lifecycleTimestamp: scopeVersion.canonicalTruth?.lifecycleTimestamp ?? scopeVersion.updatedAt ?? scopeVersion.createdAt,
    eventTypes: (scopeVersion.events ?? []).map((event) => event.type),
  };
}

export function adaptScopeVersionReference(scopeVersion: ScopeVersion): DalAdapterResult<DalScopeVersionReference> {
  const traceability = getScopeVersionTraceability(scopeVersion);
  const closures = getScopeVersionClosures(scopeVersion);
  const lifecycle = getScopeVersionLifecycle(scopeVersion);
  const gaps = [
    ...(["customerId", "opportunityId", "corridorId"] as const)
      .filter((field) => !traceability[field])
      .map((field) =>
        createDalAdapterGap({
          severity: "WARNING",
          message: `ScopeVersion ${scopeVersion.scopeVersionId} is missing ${field} traceability.`,
          sourceEntityId: scopeVersion.scopeVersionId,
          sourceEntityType: "ScopeVersion",
          requiredAdapter: "DalScopeVersionAdapter",
        }),
      ),
    ...(lifecycle.authoritativeLifecycleState
      ? []
      : [
          createDalAdapterGap({
            severity: "ERROR",
            message: `ScopeVersion ${scopeVersion.scopeVersionId} has no authoritative lifecycle state.`,
            sourceEntityId: scopeVersion.scopeVersionId,
            sourceEntityType: "ScopeVersion",
            requiredAdapter: "DalScopeVersionAdapter",
          }),
        ]),
  ];
  const diagnostics = [
    logScopeVersionAdapterDiagnostic(
      gaps.length ? "SCOPEVERSION_ADAPTER_WARNING" : "SCOPEVERSION_ADAPTER_READ",
      gaps.length ? "WARNING" : "INFO",
      "ScopeVersion reference adapted for Constitutional Runtime.",
      {
        scopeVersionId: scopeVersion.scopeVersionId,
        lifecycleState: lifecycle.authoritativeLifecycleState,
        closureCount: closures.length,
        missingTraceability: gaps.map((gap) => gap.message),
      },
    ),
  ];

  return {
    status: statusFromGaps(gaps),
    value: {
      scopeVersionId: scopeVersion.scopeVersionId,
      status: scopeVersion.status,
      lifecycleState: lifecycle.authoritativeLifecycleState,
      lifecycleTimestamp: lifecycle.lifecycleTimestamp,
      customerId: traceability.customerId,
      opportunityId: traceability.opportunityId,
      corridorId: traceability.corridorId,
      parentScopeVersionId: traceability.parentScopeVersionId,
      rootScopeVersionId: traceability.rootScopeVersionId,
      closureIds: closures.map((closure) => closure.closureId),
      source: scopeVersion.source,
      canonicalTruthPresent: Boolean(scopeVersion.canonicalTruth),
      diagnostics,
    },
    gaps,
    diagnostics,
  };
}

function logScopeVersionAdapterDiagnostic(
  code: DalAdapterDiagnostic["code"],
  severity: DalAdapterDiagnostic["severity"],
  message: string,
  details?: Record<string, unknown>,
) {
  const diagnostic = createDalAdapterDiagnostic(code, severity, message, details);
  console.info(`[${code}]`, details ?? {});
  return diagnostic;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function firstString(...values: unknown[]) {
  return values.find((value): value is string => typeof value === "string" && value.length > 0);
}
