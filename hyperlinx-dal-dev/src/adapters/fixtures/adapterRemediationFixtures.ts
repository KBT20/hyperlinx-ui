import type { DalAdapterGap } from "../DalAdapter";
import { generateRemediationPlan, type AdapterRemediationInput } from "../AdapterRemediationEngine";
import type { ShadowRuntimeFinding } from "../../shadow/ShadowRuntimeFinding";

const missingCustomerMapping = {
  scopeVersionId: "SV-REMEDIATION-MISSING-CUSTOMER",
  status: "APPROVED",
  canonicalTruth: {
    lifecycleState: "APPROVED",
    opportunityId: "OPP-REMEDIATION-001",
    corridorId: "COR-REMEDIATION-001",
  },
};

const missingLifecycleMapping = {
  scopeVersionId: "SV-REMEDIATION-MISSING-LIFECYCLE",
  canonicalTruth: {
    customerId: "CUS-REMEDIATION-001",
    opportunityId: "OPP-REMEDIATION-001",
    corridorId: "COR-REMEDIATION-001",
  },
};

const missingCloseMapping = {
  closureId: "CLOSE-REMEDIATION-LEGACY",
  scopeVersionId: "SV-REMEDIATION-CLOSE",
  closureType: "FIELD_CLOSURE",
};

const missingMarketplaceMapping = {
  scopeVersionId: "SV-REMEDIATION-MARKETPLACE",
  opportunityId: "OPP-REMEDIATION-MARKETPLACE",
  candidateId: "BUDGET-CANDIDATE-LEGACY",
};

const legacyObjectMapping = {
  legacyObject: true,
  workItemId: "WORK-REMEDIATION-LEGACY",
  opportunitySeedId: "SEED-REMEDIATION-LEGACY",
};

const authorityMismatch = {
  closeId: "CLOSE-REMEDIATION-AUTHORITY",
  scopeVersionId: "SV-REMEDIATION-AUTHORITY",
  closeType: "CONTROL_ACTIVATED",
  authority: {
    authorityType: "LEGACY_CONTROL_AUTHORITY",
  },
};

const partialAlignment = {
  scopeVersionId: "SV-REMEDIATION-PARTIAL",
  status: "RELEASED_TO_CONTROL",
  canonicalTruth: {
    lifecycleState: "RELEASED_TO_CONTROL",
    customerId: "CUS-REMEDIATION-PARTIAL",
    opportunityId: "OPP-REMEDIATION-PARTIAL",
  },
};

const fullAlignment = {
  scopeVersionId: "SV-REMEDIATION-FULL",
  status: "APPROVED",
  canonicalTruth: {
    lifecycleState: "APPROVED",
    customerId: "CUS-REMEDIATION-FULL",
    opportunityId: "OPP-REMEDIATION-FULL",
    corridorId: "COR-REMEDIATION-FULL",
  },
};

const criticalGap = {
  unknownObject: true,
  status: "UNKNOWN_LIFECYCLE",
  canonicalTruth: {},
};

const productionReadyRuntime = {
  scopeVersionId: "SV-REMEDIATION-PRODUCTION-READY",
  status: "OPERATIONAL",
  canonicalTruth: {
    lifecycleState: "OPERATIONAL",
    customerId: "CUS-REMEDIATION-PRODUCTION",
    opportunityId: "OPP-REMEDIATION-PRODUCTION",
    corridorId: "COR-REMEDIATION-PRODUCTION",
  },
};

const adapterGapExample: DalAdapterGap = {
  gapId: "DAL-ADAPTER-GAP-SV-REMEDIATION-MISSING-CUSTOMER",
  severity: "WARNING",
  message: "ScopeVersion SV-REMEDIATION-MISSING-CUSTOMER has incomplete traceability: customerId.",
  sourceEntityId: "SV-REMEDIATION-MISSING-CUSTOMER",
  sourceEntityType: "ScopeVersion",
  requiredAdapter: "DalScopeVersionAdapter",
};

const shadowFindingExample: ShadowRuntimeFinding = {
  findingId: "SHADOW-FINDING-MARKETPLACE-MISSING-BUDGET",
  component: "Marketplace",
  severity: "MEDIUM",
  expected: "budgetLinked=true",
  actual: "budgetLinked=false",
  gap: "Marketplace: expected budgetLinked=true, actual budgetLinked=false",
  recommendedAdapterAction: "Expose budgetLinked through DAL marketplace adapter.",
};

export const adapterRemediationFixtures = Object.freeze({
  missingCustomerMapping,
  missingLifecycleMapping,
  missingCloseMapping,
  missingMarketplaceMapping,
  legacyObjectMapping,
  authorityMismatch,
  partialAlignment,
  fullAlignment,
  criticalGap,
  productionReadyRuntime,
  adapterGapExample,
  shadowFindingExample,
});

export const adapterRemediationInputs: readonly AdapterRemediationInput[] = Object.freeze([
  {
    planId: "REMEDIATION-MISSING-CUSTOMER",
    records: [missingCustomerMapping],
    adapterGaps: [adapterGapExample],
  },
  {
    planId: "REMEDIATION-MISSING-LIFECYCLE",
    records: [missingLifecycleMapping],
  },
  {
    planId: "REMEDIATION-MISSING-CLOSE",
    records: [missingCloseMapping],
  },
  {
    planId: "REMEDIATION-MISSING-MARKETPLACE",
    records: [missingMarketplaceMapping],
    shadowFindings: [shadowFindingExample],
  },
  {
    planId: "REMEDIATION-LEGACY-OBJECT",
    records: [legacyObjectMapping],
  },
  {
    planId: "REMEDIATION-AUTHORITY-MISMATCH",
    records: [authorityMismatch],
  },
  {
    planId: "REMEDIATION-PARTIAL-ALIGNMENT",
    records: [partialAlignment],
  },
  {
    planId: "REMEDIATION-FULL-ALIGNMENT",
    records: [fullAlignment],
  },
  {
    planId: "REMEDIATION-CRITICAL-GAP",
    records: [criticalGap],
  },
  {
    planId: "REMEDIATION-PRODUCTION-READY",
    records: [productionReadyRuntime],
  },
]);

export function evaluateAdapterRemediationFixtures() {
  return adapterRemediationInputs.map(generateRemediationPlan);
}
