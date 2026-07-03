import {
  PD002A_OBJECT_ADDRESSING_AUTHORITY,
  PD002A_OBJECT_ADDRESSING_DOCTRINE_ID,
  PD002A_OBJECT_ADDRESSING_DOCTRINE_VERSION,
  type ObjectAddressingDoctrine,
} from "./PD002AAddressingContracts";

export const PD002A_POINT_OBJECT_TYPES = [
  "HANDHOLE",
  "MANHOLE",
  "VAULT",
  "PULL_POINT",
  "MARKER",
  "ILA",
  "ILA_FACILITY",
  "REGEN",
  "REGENERATION",
  "REGENERATION_FACILITY",
  "CABINET",
  "SHELTER",
  "SPLICE_CASE",
  "CROSSING",
  "REVIEW_OBJECT",
] as const;

export const PD002A_RANGE_OBJECT_TYPES = [
  "PLOW_SEGMENT",
  "DIRECTIONAL_BORE_SEGMENT",
  "ROCK_BORE_SEGMENT",
  "OPEN_TRENCH_SEGMENT",
  "RESTORATION_SEGMENT",
  "CONDUIT_SEGMENT",
  "CONDUIT",
  "FUTUREPATH_SEGMENT",
  "INNERDUCT_SEGMENT",
  "FIBER_SEGMENT",
  "FIBER",
  "LOCATE_WIRE",
  "TEST_SECTION",
  "ROUTE_SEGMENT",
  "STATION_RANGE",
] as const;

export const PD002A_CONTAINED_OBJECT_TYPES = [
  "SPLICE_CASE",
  "SLACK_LOOP",
  "FIBER_TERMINATION",
  "GROUNDING",
] as const;

export const PD002A_PACKAGE_LEVEL_OBJECT_TYPES = [
  "COMMERCIAL_APPROVAL",
  "ENGINEERING_REVIEW",
  "FINANCIAL_APPROVAL",
  "GLOBAL_PROCUREMENT_PLAN",
  "SPINE",
] as const;

export const PD002A_REVIEW_OBJECT_TYPES = [
  "RAILROAD_CROSSING_UNKNOWN",
  "WATER_CROSSING_UNKNOWN",
  "DOT_HIGHWAY_CROSSING_UNKNOWN",
  "UTILITY_CONFLICT_UNKNOWN",
  "ENVIRONMENTAL_IMPACT_UNKNOWN",
  "BRIDGE_ATTACHMENT_UNKNOWN",
  "ROCK_PERCENTAGE_UNKNOWN",
  "RESTORATION_REVIEW_UNKNOWN",
  "GENERAL_REVIEW",
] as const;

export const PD002A_CERTIFICATION_ORDER = [
  "Object exists",
  "Object has valid address",
  "Object has valid hierarchy",
  "Object has valid placement rule",
  "Object has valid dependencies",
  "Object has valid close sequence",
  "Object has valid evidence requirements",
  "Object is projection-ready",
];

export const PD002A_OBJECT_ADDRESSING_DOCTRINE: ObjectAddressingDoctrine = {
  doctrineId: PD002A_OBJECT_ADDRESSING_DOCTRINE_ID,
  doctrineVersion: PD002A_OBJECT_ADDRESSING_DOCTRINE_VERSION,
  authority: PD002A_OBJECT_ADDRESSING_AUTHORITY,
  principle: "STATIONING_IS_CANONICAL_ADDRESS_SYSTEM",
  pointObjectTypes: [...PD002A_POINT_OBJECT_TYPES],
  rangeObjectTypes: [...PD002A_RANGE_OBJECT_TYPES],
  containedObjectTypes: [...PD002A_CONTAINED_OBJECT_TYPES],
  packageLevelObjectTypes: [...PD002A_PACKAGE_LEVEL_OBJECT_TYPES],
  reviewObjectTypes: [...PD002A_REVIEW_OBJECT_TYPES],
  certificationOrder: PD002A_CERTIFICATION_ORDER,
  noScopeVersionCreation: true,
};

export function isPD002APointObjectType(objectType: string) {
  return PD002A_POINT_OBJECT_TYPES.includes(objectType.toUpperCase() as typeof PD002A_POINT_OBJECT_TYPES[number]);
}

export function isPD002ARangeObjectType(objectType: string) {
  return PD002A_RANGE_OBJECT_TYPES.includes(objectType.toUpperCase() as typeof PD002A_RANGE_OBJECT_TYPES[number]);
}

export function isPD002AContainedObjectType(objectType: string) {
  return PD002A_CONTAINED_OBJECT_TYPES.includes(objectType.toUpperCase() as typeof PD002A_CONTAINED_OBJECT_TYPES[number]);
}

export function isPD002APackageLevelObjectType(objectType: string) {
  return PD002A_PACKAGE_LEVEL_OBJECT_TYPES.includes(objectType.toUpperCase() as typeof PD002A_PACKAGE_LEVEL_OBJECT_TYPES[number]);
}
