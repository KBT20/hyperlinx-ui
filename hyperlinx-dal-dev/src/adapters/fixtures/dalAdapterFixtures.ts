import type { ClosureRecord, ScopeVersion } from "../../types/dal";
import { runDalAdapterAudit, type DalAdapterAuditInput } from "../DalAdapterEngine";

const now = "2026-06-24T00:00:00.000Z";

const compliantClosure = {
  closureId: "CLOSE-DAL-001",
  scopeVersionId: "SV-DAL-ADAPTER-001",
  certifiedRouteId: "CR-DAL-001",
  objectIds: ["OBJ-DAL-001"],
  closureType: "FIELD_CLOSE",
  actor: {
    actorId: "USER-DAL-001",
    actorName: "DAL Fixture User",
    actorRole: "FIELD_OPERATOR",
  },
  authority: {
    authorityId: "AUTH-FIELD-CLOSE",
    authorityType: "FIELD_CLOSE",
    lifecycleState: "FIELD",
  },
  evidence: [],
  feetAffected: 100,
  createdAt: now,
  updatedAt: now,
} as unknown as ClosureRecord;

const fullyMappedScopeVersion: ScopeVersion = {
  scopeVersionId: "SV-DAL-ADAPTER-001",
  source: "Manual",
  status: "APPROVED",
  type: "CANDIDATE",
  certificationState: "CERTIFIED",
  isImmutable: true,
  createdAt: now,
  updatedAt: now,
  sourceOpportunityId: "OPP-DAL-001",
  canonicalTruth: {
    lifecycleState: "APPROVED",
    lifecycleTimestamp: now,
    customerId: "CUS-DAL-001",
    opportunityId: "OPP-DAL-001",
    corridorId: "COR-DAL-001",
    sourceOpportunity: {
      opportunityId: "OPP-DAL-001",
    },
    closures: [compliantClosure],
  },
  closures: [compliantClosure],
  events: [
    {
      eventId: "EVENT-DAL-001",
      type: "scopeversion.approved",
      entityId: "SV-DAL-ADAPTER-001",
      entityType: "ScopeVersion",
      payload: { lifecycleState: "APPROVED" },
      createdAt: now,
    },
  ],
};

const missingCustomerScopeVersion: ScopeVersion = {
  ...fullyMappedScopeVersion,
  scopeVersionId: "SV-DAL-ADAPTER-MISSING-CUSTOMER",
  canonicalTruth: {
    ...fullyMappedScopeVersion.canonicalTruth,
    customerId: undefined,
    sourceOpportunity: {
      opportunityId: "OPP-DAL-002",
    },
  },
};

const missingOpportunityScopeVersion: ScopeVersion = {
  ...fullyMappedScopeVersion,
  scopeVersionId: "SV-DAL-ADAPTER-MISSING-OPPORTUNITY",
  sourceOpportunityId: undefined,
  canonicalTruth: {
    ...fullyMappedScopeVersion.canonicalTruth,
    opportunityId: undefined,
    sourceOpportunity: undefined,
  },
};

const missingCorridorScopeVersion: ScopeVersion = {
  ...fullyMappedScopeVersion,
  scopeVersionId: "SV-DAL-ADAPTER-MISSING-CORRIDOR",
  canonicalTruth: {
    ...fullyMappedScopeVersion.canonicalTruth,
    corridorId: undefined,
  },
};

const missingCloseScopeVersion: ScopeVersion = {
  ...fullyMappedScopeVersion,
  scopeVersionId: "SV-DAL-ADAPTER-MISSING-CLOSE",
  closures: [],
  canonicalTruth: {
    ...fullyMappedScopeVersion.canonicalTruth,
    closures: [],
  },
};

const missingLifecycleScopeVersion: ScopeVersion = {
  ...fullyMappedScopeVersion,
  scopeVersionId: "SV-DAL-ADAPTER-MISSING-LIFECYCLE",
  status: "DRAFT",
  canonicalTruth: {
    ...fullyMappedScopeVersion.canonicalTruth,
    lifecycleState: undefined,
    lifecycleTimestamp: undefined,
  },
};

const legacyDalObject = {
  workItemId: "WORK-LEGACY-001",
  workType: "CONSTRUCTION",
  status: "ACTIVE",
  opportunitySeedId: "SEED-LEGACY-001",
  createdAt: now,
};

const fullyCompliantEntities = [
  {
    customerId: "CUS-DAL-001",
    name: "Adapter Customer",
  },
  {
    opportunityId: "OPP-DAL-001",
    customerId: "CUS-DAL-001",
    corridorId: "COR-DAL-001",
    scopeVersionId: "SV-DAL-ADAPTER-001",
  },
  {
    corridorId: "COR-DAL-001",
    customerId: "CUS-DAL-001",
    opportunityId: "OPP-DAL-001",
    scopeVersionId: "SV-DAL-ADAPTER-001",
  },
  fullyMappedScopeVersion,
  {
    workPackageId: "WP-DAL-001",
    scopeVersionId: "SV-DAL-ADAPTER-001",
    customerId: "CUS-DAL-001",
    opportunityId: "OPP-DAL-001",
    corridorId: "COR-DAL-001",
  },
  {
    workItemId: "WORK-DAL-001",
    scopeVersionId: "SV-DAL-ADAPTER-001",
    status: "ACTIVE",
  },
  {
    closureId: "CLOSE-DAL-001",
    scopeVersionId: "SV-DAL-ADAPTER-001",
    closedAt: now,
  },
  {
    closeId: "COMPLETE-DAL-001",
    closeType: "COMPLETION_CLOSE",
    scopeVersionId: "SV-DAL-ADAPTER-001",
    customerId: "CUS-DAL-001",
    opportunityId: "OPP-DAL-001",
    corridorId: "COR-DAL-001",
  },
  {
    closeId: "OPS-DAL-001",
    closeType: "OPERATIONS_CLOSE",
    scopeVersionId: "SV-DAL-ADAPTER-001",
    customerId: "CUS-DAL-001",
    opportunityId: "OPP-DAL-001",
    corridorId: "COR-DAL-001",
  },
];

export const dalAdapterFixtures = Object.freeze({
  fullyMappedScopeVersion,
  missingCustomerScopeVersion,
  missingOpportunityScopeVersion,
  missingCorridorScopeVersion,
  missingCloseScopeVersion,
  missingLifecycleScopeVersion,
  legacyDalObject,
  fullyCompliantEntities,
});

export const dalAdapterAuditSnapshots: readonly DalAdapterAuditInput[] = Object.freeze([
  {
    snapshotId: "DAL-ADAPTER-FULLY-MAPPED",
    entities: fullyCompliantEntities,
    scopeVersions: [fullyMappedScopeVersion],
    notes: "Fully mapped ScopeVersion with customer, opportunity, corridor, closure, and lifecycle traceability.",
  },
  {
    snapshotId: "DAL-ADAPTER-MISSING-CUSTOMER",
    entities: [missingCustomerScopeVersion],
    scopeVersions: [missingCustomerScopeVersion],
    notes: "ScopeVersion missing customer traceability.",
  },
  {
    snapshotId: "DAL-ADAPTER-MISSING-OPPORTUNITY",
    entities: [missingOpportunityScopeVersion],
    scopeVersions: [missingOpportunityScopeVersion],
    notes: "ScopeVersion missing opportunity traceability.",
  },
  {
    snapshotId: "DAL-ADAPTER-MISSING-CORRIDOR",
    entities: [missingCorridorScopeVersion],
    scopeVersions: [missingCorridorScopeVersion],
    notes: "ScopeVersion missing corridor traceability.",
  },
  {
    snapshotId: "DAL-ADAPTER-MISSING-CLOSE",
    entities: [missingCloseScopeVersion],
    scopeVersions: [missingCloseScopeVersion],
    notes: "ScopeVersion without close linkage.",
  },
  {
    snapshotId: "DAL-ADAPTER-MISSING-LIFECYCLE",
    entities: [missingLifecycleScopeVersion],
    scopeVersions: [missingLifecycleScopeVersion],
    notes: "ScopeVersion without explicit lifecycle fields.",
  },
  {
    snapshotId: "DAL-ADAPTER-LEGACY-OBJECT",
    entities: [legacyDalObject],
    scopeVersions: [],
    notes: "Legacy DAL object without scopeVersionId.",
  },
]);

export function evaluateDalAdapterFixtures() {
  return dalAdapterAuditSnapshots.map(runDalAdapterAudit);
}
