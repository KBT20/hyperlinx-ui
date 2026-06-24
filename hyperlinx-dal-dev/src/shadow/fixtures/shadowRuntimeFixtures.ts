import type { ClosureRecord, ScopeVersion } from "../../types/dal";
import type { ShadowRuntimeInput } from "../ShadowRuntimeEvaluation";
import { runShadowRuntime } from "../ShadowRuntimeEngine";

const now = "2026-06-24T00:00:00.000Z";

function close(closeType: string, scopeVersionId = "SV-SHADOW-READY") {
  return {
    closureId: `CLOSE-${closeType}-${scopeVersionId}`,
    scopeVersionId,
    certifiedRouteId: `CR-${scopeVersionId}`,
    objectIds: [`OBJ-${scopeVersionId}`],
    closureType: closeType,
    actor: {
      actorId: "USER-SHADOW",
      actorName: "Shadow Runtime Fixture",
      actorRole: "SYSTEM",
    },
    authority: {
      authorityId: `AUTH-${closeType}`,
      authorityType: closeType,
      closeType,
      lifecycleState: "FIELD",
    },
    evidence: [],
    feetAffected: 100,
    createdAt: now,
    updatedAt: now,
  } as unknown as ClosureRecord;
}

function scopeVersion(scopeVersionId: string, lifecycleState: ScopeVersion["status"] = "APPROVED", overrides: Partial<ScopeVersion> = {}): ScopeVersion {
  return {
    scopeVersionId,
    source: "Manual",
    status: lifecycleState,
    type: "CANDIDATE",
    certificationState: "CERTIFIED",
    isImmutable: true,
    createdAt: now,
    updatedAt: now,
    sourceOpportunityId: `OPP-${scopeVersionId}`,
    canonicalTruth: {
      lifecycleState,
      lifecycleTimestamp: now,
      customerId: `CUS-${scopeVersionId}`,
      opportunityId: `OPP-${scopeVersionId}`,
      corridorId: `COR-${scopeVersionId}`,
      sourceOpportunity: {
        opportunityId: `OPP-${scopeVersionId}`,
      },
      closures: [],
    },
    closures: [],
    events: [],
    ...overrides,
  };
}

const productionReadyScope = scopeVersion("SV-SHADOW-READY", "OPERATIONAL", {
  closures: [
    close("CONTRACT_CLOSE"),
    close("CONTROL_CLOSE"),
    close("FIELD_CLOSE"),
    close("COMPLETION_CLOSE"),
    close("OPERATIONS_CLOSE"),
  ],
  canonicalTruth: {
    lifecycleState: "OPERATIONAL",
    lifecycleTimestamp: now,
    customerId: "CUS-SV-SHADOW-READY",
    opportunityId: "OPP-SV-SHADOW-READY",
    corridorId: "COR-SV-SHADOW-READY",
    closures: [
      close("CONTRACT_CLOSE"),
      close("CONTROL_CLOSE"),
      close("FIELD_CLOSE"),
      close("COMPLETION_CLOSE"),
      close("OPERATIONS_CLOSE"),
    ],
  },
});

const partialAlignmentScope = scopeVersion("SV-SHADOW-PARTIAL", "CONTROL_ACTIVE", {
  closures: [close("CONTROL_CLOSE", "SV-SHADOW-PARTIAL")],
  canonicalTruth: {
    lifecycleState: "CONTROL_ACTIVE",
    lifecycleTimestamp: now,
    customerId: "CUS-SV-SHADOW-PARTIAL",
    opportunityId: "OPP-SV-SHADOW-PARTIAL",
    corridorId: "COR-SV-SHADOW-PARTIAL",
    closures: [close("CONTROL_CLOSE", "SV-SHADOW-PARTIAL")],
  },
});

const missingLifecycleScope = scopeVersion("SV-SHADOW-MISSING-LIFECYCLE", "DRAFT", {
  canonicalTruth: {
    customerId: "CUS-SV-SHADOW-MISSING-LIFECYCLE",
    opportunityId: "OPP-SV-SHADOW-MISSING-LIFECYCLE",
    corridorId: "COR-SV-SHADOW-MISSING-LIFECYCLE",
  },
});

const missingCloseAuthorityScope = scopeVersion("SV-SHADOW-MISSING-CLOSE", "FIELD", {
  closures: [],
  canonicalTruth: {
    lifecycleState: "FIELD",
    lifecycleTimestamp: now,
    customerId: "CUS-SV-SHADOW-MISSING-CLOSE",
    opportunityId: "OPP-SV-SHADOW-MISSING-CLOSE",
    corridorId: "COR-SV-SHADOW-MISSING-CLOSE",
    closures: [],
  },
});

const missingTraceabilityScope = scopeVersion("SV-SHADOW-MISSING-TRACE", "APPROVED", {
  sourceOpportunityId: undefined,
  canonicalTruth: {
    lifecycleState: "APPROVED",
    lifecycleTimestamp: now,
  },
});

const authorityMismatchScope = scopeVersion("SV-SHADOW-AUTHORITY-MISMATCH", "CONTROL_ACTIVE", {
  canonicalTruth: {
    lifecycleState: "APPROVED",
    lifecycleTimestamp: now,
    customerId: "CUS-SV-SHADOW-AUTHORITY-MISMATCH",
    opportunityId: "OPP-SV-SHADOW-AUTHORITY-MISMATCH",
    corridorId: "COR-SV-SHADOW-AUTHORITY-MISMATCH",
  },
});

const marketplaceMismatchScope = scopeVersion("SV-SHADOW-MARKETPLACE-MISMATCH", "APPROVED", {
  canonicalTruth: {
    lifecycleState: "APPROVED",
    lifecycleTimestamp: now,
    customerId: "CUS-SV-SHADOW-MARKETPLACE-MISMATCH",
    opportunityId: "OPP-SV-SHADOW-MARKETPLACE-MISMATCH",
    corridorId: "COR-SV-SHADOW-MARKETPLACE-MISMATCH",
  },
});

const scopeVersionMismatchScope = scopeVersion("SV-SHADOW-SCOPEVERSION-MISMATCH", "APPROVED", {
  canonicalTruth: {
    lifecycleState: "NOT_A_REAL_STATE" as ScopeVersion["status"],
    lifecycleTimestamp: now,
    customerId: "CUS-SV-SHADOW-SCOPEVERSION-MISMATCH",
    opportunityId: "OPP-SV-SHADOW-SCOPEVERSION-MISMATCH",
    corridorId: "COR-SV-SHADOW-SCOPEVERSION-MISMATCH",
  },
});

export const shadowRuntimeFixtures = Object.freeze({
  productionReadyScope,
  partialAlignmentScope,
  missingLifecycleScope,
  missingCloseAuthorityScope,
  missingTraceabilityScope,
  authorityMismatchScope,
  marketplaceMismatchScope,
  scopeVersionMismatchScope,
});

export const shadowRuntimeSnapshots: readonly ShadowRuntimeInput[] = Object.freeze([
  {
    runtimeId: "SHADOW-FULLY-ALIGNED",
    scopeVersions: [productionReadyScope],
    marketplace: [
      {
        scopeVersionId: "SV-SHADOW-READY",
        opportunityId: "OPP-SV-SHADOW-READY",
        budgetLockId: "BUDGET-SHADOW-READY",
        vendorId: "VENDOR-SHADOW",
        bidPackageId: "BID-SHADOW",
        contractReadinessId: "CONTRACT-READY-SHADOW",
      },
    ],
    notes: "Fully aligned runtime.",
  },
  {
    runtimeId: "SHADOW-MISSING-LIFECYCLE",
    scopeVersions: [missingLifecycleScope],
    notes: "Missing lifecycle state.",
  },
  {
    runtimeId: "SHADOW-MISSING-CLOSE-AUTHORITY",
    scopeVersions: [missingCloseAuthorityScope],
    notes: "Missing close authority.",
  },
  {
    runtimeId: "SHADOW-MISSING-TRACEABILITY",
    scopeVersions: [missingTraceabilityScope],
    notes: "Missing traceability.",
  },
  {
    runtimeId: "SHADOW-MARKETPLACE-MISMATCH",
    scopeVersions: [marketplaceMismatchScope],
    marketplace: [],
    notes: "Marketplace mismatch.",
  },
  {
    runtimeId: "SHADOW-AUTHORITY-MISMATCH",
    scopeVersions: [authorityMismatchScope],
    notes: "Authority mismatch.",
  },
  {
    runtimeId: "SHADOW-SCOPEVERSION-MISMATCH",
    scopeVersions: [scopeVersionMismatchScope],
    notes: "ScopeVersion mismatch.",
  },
  {
    runtimeId: "SHADOW-PARTIAL-ALIGNMENT",
    scopeVersions: [partialAlignmentScope],
    marketplace: [
      {
        scopeVersionId: "SV-SHADOW-PARTIAL",
        opportunityId: "OPP-SV-SHADOW-PARTIAL",
      },
    ],
    notes: "Partial alignment.",
  },
  {
    runtimeId: "SHADOW-PRODUCTION-READY-ALIGNMENT",
    scopeVersions: [productionReadyScope],
    closures: productionReadyScope.closures,
    marketplace: [
      {
        scopeVersionId: "SV-SHADOW-READY",
        opportunityId: "OPP-SV-SHADOW-READY",
        budgetLockId: "BUDGET-SHADOW-READY",
        vendorResponseId: "VR-SHADOW",
        bidPackageId: "BID-SHADOW",
        contractReady: true,
      },
    ],
    notes: "Production-ready alignment.",
  },
  {
    runtimeId: "SHADOW-CRITICAL-GAP",
    scopeVersions: [missingTraceabilityScope, missingCloseAuthorityScope],
    marketplace: [],
    notes: "Critical gap example.",
  },
]);

export function evaluateShadowRuntimeFixtures() {
  return shadowRuntimeSnapshots.map(runShadowRuntime);
}
