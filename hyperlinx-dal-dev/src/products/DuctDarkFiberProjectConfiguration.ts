export type DuctMaterialSpec = "HDPE" | "PVC" | "STEEL" | "OTHER_GOVERNED_SPEC" | "UNKNOWN";
export type FiberPlacementPolicy = "BLOWN" | "PULLED" | "JETTED" | "ENGINEERING_DEFINED" | "SOURCE_DEFINED" | "UNKNOWN";
export type SlackPolicyMode = "NONE" | "PERCENTAGE" | "ENGINEERING_DEFINED" | "SOURCE_DEFINED";
export type StructurePlanAuthority = "SOURCE_DEFINED" | "COMMERCIAL_ASSUMPTION" | "ENGINEERING_DEFINED" | "UNKNOWN";
export type SpliceArchitectureAuthority = "SOURCE_DEFINED" | "COMMERCIAL_ASSUMPTION" | "ENGINEERING_DEFINED" | "UNKNOWN";
export type RouteProvenance = "CUSTOMER_KMZ" | "CUSTOMER_KML" | "GIS" | "ENGINEERED_GEOMETRY" | "COMMERCIAL_DRAWN_ROUTE" | "APPROVED_ROUTE_REVISION" | "OSRM_ASSISTED_ROUTE" | "OTHER_GOVERNED_SOURCE";

export interface AttributableSlackPolicy {
  mode: SlackPolicyMode;
  slackPercent?: number;
  authority: "PROJECT_CONFIGURATION" | "SOURCE_EVIDENCE" | "ENGINEERING" | "UNKNOWN";
  source: string;
  revision: string;
  approvedBy?: string;
}

export interface DuctDarkFiberProjectConfiguration {
  configurationId: string;
  configurationRevision: number;
  organizationId: string;
  tenantId: string;
  customerId: string;
  opportunityId: string;
  productId: "POINT_TO_POINT_LONG_HAUL_CONDUIT_FIBER";
  productVersion: string;
  doctrineId: "DOCTRINE-L1-POINT-TO-POINT-LONG-HAUL-CONDUIT-FIBER";
  doctrineVersion: string;
  ductCount?: number;
  ductDiameter?: number;
  ductMaterialSpec: DuctMaterialSpec;
  fiberCount?: number;
  fiberCableType: string;
  fiberPlacementPolicy: FiberPlacementPolicy;
  slackPolicy: AttributableSlackPolicy;
  structurePlanAuthority: StructurePlanAuthority;
  handholeCount?: number;
  vaultCount?: number;
  spliceArchitectureAuthority: SpliceArchitectureAuthority;
  spliceCaseCount?: number;
  ilaConfigurationId?: string;
  /** Independent Commercial planning controls; neither is Product Doctrine. */
  intermediateIlaEnabled?: boolean;
  bookendIlaEnabled?: boolean;
  terminationConfiguration: string;
  routeSource: RouteProvenance | "UNKNOWN";
  routeAuthority: string;
  routeRevision: string;
  routeHash: string;
  measurementAuthority: string;
  previousConfigurationId?: string;
  changeReason: string;
  createdAt: string;
  createdBy: string;
  noScopeVersionCreation: true;
}

/** Commercial starting point only. Product Doctrine does not require this package. */
export const DUCT_DARK_FIBER_COMMERCIAL_DEFAULT = Object.freeze({
  ductCount: 3,
  ductDiameter: 1.25,
  ductMaterialSpec: "HDPE" as const,
  fiberCount: 864,
  fiberCableType: "864F G.657A1",
  fiberPlacementPolicy: "BLOWN" as const,
  intermediateIlaEnabled: false,
  bookendIlaEnabled: false,
});

export function createDuctDarkFiberProjectConfiguration(args: {
  organizationId: string;
  tenantId: string;
  customerId: string;
  opportunityId: string;
  productVersion: string;
  doctrineVersion: string;
  createdBy: string;
  createdAt?: string;
}): DuctDarkFiberProjectConfiguration {
  return {
    configurationId: `${args.opportunityId}:DUCT-DARK-FIBER-CONFIG:R1`,
    configurationRevision: 1,
    organizationId: args.organizationId,
    tenantId: args.tenantId,
    customerId: args.customerId,
    opportunityId: args.opportunityId,
    productId: "POINT_TO_POINT_LONG_HAUL_CONDUIT_FIBER",
    productVersion: args.productVersion,
    doctrineId: "DOCTRINE-L1-POINT-TO-POINT-LONG-HAUL-CONDUIT-FIBER",
    doctrineVersion: args.doctrineVersion,
    ...DUCT_DARK_FIBER_COMMERCIAL_DEFAULT,
    slackPolicy: { mode: "PERCENTAGE", slackPercent: 5, authority: "PROJECT_CONFIGURATION", source: "COMMERCIAL_DEFAULT", revision: "R1" },
    structurePlanAuthority: "UNKNOWN",
    spliceArchitectureAuthority: "UNKNOWN",
    terminationConfiguration: "ENGINEERING_DEFINED",
    routeSource: "UNKNOWN",
    routeAuthority: "PROJECT_CONFIGURATION_PENDING",
    routeRevision: "R1",
    routeHash: "PENDING",
    measurementAuthority: "MEASURED_CENTERLINE_PENDING",
    changeReason: "Initial configurable commercial default: 3 x 1.25-inch duct.",
    createdAt: args.createdAt ?? new Date().toISOString(),
    createdBy: args.createdBy,
    noScopeVersionCreation: true,
  };
}

export function reviseDuctDarkFiberProjectConfiguration(
  current: DuctDarkFiberProjectConfiguration,
  patch: Partial<Omit<DuctDarkFiberProjectConfiguration, "configurationId" | "configurationRevision" | "previousConfigurationId" | "createdAt">>,
): DuctDarkFiberProjectConfiguration {
  const nextRevision = current.configurationRevision + 1;
  return {
    ...current,
    ...patch,
    configurationId: `${current.opportunityId}:DUCT-DARK-FIBER-CONFIG:R${nextRevision}`,
    configurationRevision: nextRevision,
    previousConfigurationId: current.configurationId,
    createdAt: new Date().toISOString(),
    noScopeVersionCreation: true,
  };
}

/** Append-only helper used by repositories and tests; prior revisions are cloned, never mutated. */
export function appendDuctDarkFiberConfigurationRevision(
  history: readonly DuctDarkFiberProjectConfiguration[],
  patch: Parameters<typeof reviseDuctDarkFiberProjectConfiguration>[1],
) {
  if (!history.length) throw new Error("A current Project Configuration revision is required.");
  const immutableHistory = history.map((revision) => structuredClone(revision));
  const next = reviseDuctDarkFiberProjectConfiguration(immutableHistory[immutableHistory.length - 1], patch);
  return Object.freeze([...immutableHistory, next]);
}
