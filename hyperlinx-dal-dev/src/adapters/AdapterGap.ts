export type AdapterGapType =
  | "TRACEABILITY_GAP"
  | "LIFECYCLE_GAP"
  | "CLOSE_GAP"
  | "MARKETPLACE_GAP"
  | "AUTHORITY_GAP"
  | "REFERENCE_GAP";

export type AdapterGapSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type AdapterGapStatus = "OPEN" | "NORMALIZED" | "RECONCILED" | "PLANNED" | "BLOCKED";

export interface AdapterGap {
  gapId: string;
  gapType: AdapterGapType;
  severity: AdapterGapSeverity;
  status: AdapterGapStatus;
  source: string;
  sourceEntityId?: string;
  sourceEntityType?: string;
  sourceField?: string;
  message: string;
  expected?: string;
  actual?: string;
  recommendedAdapter: string;
  requiredMapping: string;
  owner: string;
  risk: AdapterGapSeverity;
  priority: number;
}

export interface AdapterGapRegistryEntry {
  registryId: string;
  gapType: AdapterGapType;
  label: string;
  description: string;
  defaultSeverity: AdapterGapSeverity;
  recommendedAdapter: string;
  requiredMapping: string;
  owner: string;
}

export const ADAPTER_GAP_REGISTRY: readonly AdapterGapRegistryEntry[] = Object.freeze([
  {
    registryId: "GAP-MISSING-CUSTOMER-MAPPING",
    gapType: "TRACEABILITY_GAP",
    label: "Missing customer mapping",
    description: "DAL record cannot resolve customerId.",
    defaultSeverity: "HIGH",
    recommendedAdapter: "DalScopeVersionAdapter",
    requiredMapping: "customerId",
    owner: "DAL Adapter Layer",
  },
  {
    registryId: "GAP-MISSING-OPPORTUNITY-MAPPING",
    gapType: "TRACEABILITY_GAP",
    label: "Missing opportunity mapping",
    description: "DAL record cannot resolve opportunityId.",
    defaultSeverity: "HIGH",
    recommendedAdapter: "DalScopeVersionAdapter",
    requiredMapping: "opportunityId",
    owner: "DAL Adapter Layer",
  },
  {
    registryId: "GAP-MISSING-CORRIDOR-MAPPING",
    gapType: "TRACEABILITY_GAP",
    label: "Missing corridor mapping",
    description: "DAL record cannot resolve corridorId.",
    defaultSeverity: "HIGH",
    recommendedAdapter: "DalScopeVersionAdapter",
    requiredMapping: "corridorId",
    owner: "DAL Adapter Layer",
  },
  {
    registryId: "GAP-MISSING-SCOPEVERSION-MAPPING",
    gapType: "REFERENCE_GAP",
    label: "Missing ScopeVersion mapping",
    description: "DAL record cannot resolve scopeVersionId.",
    defaultSeverity: "CRITICAL",
    recommendedAdapter: "DalEntityAdapter",
    requiredMapping: "scopeVersionId",
    owner: "DAL Adapter Layer",
  },
  {
    registryId: "GAP-MISSING-CLOSE-MAPPING",
    gapType: "CLOSE_GAP",
    label: "Missing close mapping",
    description: "DAL close record cannot be mapped to constitutional close authority.",
    defaultSeverity: "HIGH",
    recommendedAdapter: "CloseAdapter",
    requiredMapping: "closeType",
    owner: "Closure Adapter",
  },
  {
    registryId: "GAP-MISSING-LIFECYCLE-MAPPING",
    gapType: "LIFECYCLE_GAP",
    label: "Missing lifecycle mapping",
    description: "DAL lifecycle value cannot be mapped to constitutional lifecycle vocabulary.",
    defaultSeverity: "HIGH",
    recommendedAdapter: "LifecycleAdapter",
    requiredMapping: "canonicalTruth.lifecycleState",
    owner: "Lifecycle Adapter",
  },
  {
    registryId: "GAP-MISSING-MARKETPLACE-MAPPING",
    gapType: "MARKETPLACE_GAP",
    label: "Missing marketplace mapping",
    description: "Marketplace record cannot resolve opportunity, budget, vendor, bid package, or contract readiness linkage.",
    defaultSeverity: "MEDIUM",
    recommendedAdapter: "MarketplaceAdapter",
    requiredMapping: "marketplaceReference",
    owner: "Marketplace Adapter",
  },
  {
    registryId: "GAP-MISSING-AUTHORITY-MAPPING",
    gapType: "AUTHORITY_GAP",
    label: "Missing authority mapping",
    description: "DAL authority record cannot be mapped to constitutional authority.",
    defaultSeverity: "HIGH",
    recommendedAdapter: "AuthorityAdapter",
    requiredMapping: "authority",
    owner: "Authority Adapter",
  },
  {
    registryId: "GAP-LEGACY-OBJECT-MAPPING",
    gapType: "REFERENCE_GAP",
    label: "Legacy object mapping",
    description: "Legacy DAL object requires adapter mapping before constitutional evaluation.",
    defaultSeverity: "MEDIUM",
    recommendedAdapter: "LegacyObjectAdapter",
    requiredMapping: "legacyObjectReference",
    owner: "DAL Adapter Layer",
  },
  {
    registryId: "GAP-UNKNOWN-OBJECT-MAPPING",
    gapType: "REFERENCE_GAP",
    label: "Unknown object mapping",
    description: "Object type is unknown to the adapter registry.",
    defaultSeverity: "MEDIUM",
    recommendedAdapter: "DalEntityAdapter",
    requiredMapping: "entityType",
    owner: "DAL Adapter Layer",
  },
]);

export function adapterGapRegistryFor(gapType: AdapterGapType) {
  return ADAPTER_GAP_REGISTRY.find((entry) => entry.gapType === gapType);
}
