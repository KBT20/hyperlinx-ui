import {
  POINT_TO_POINT_LONG_HAUL_DOCTRINE_CHANGE_REASON,
  POINT_TO_POINT_LONG_HAUL_DOCTRINE_ID,
  POINT_TO_POINT_LONG_HAUL_DOCTRINE_VERSION,
  POINT_TO_POINT_LONG_HAUL_PREVIOUS_DOCTRINE_VERSION,
  POINT_TO_POINT_LONG_HAUL_PRODUCT_ID,
} from "./pointToPointLongHaulDoctrine";

export const PRODUCT_DOCTRINE_VERSION_HISTORY = Object.freeze([
  Object.freeze({
    doctrineId: POINT_TO_POINT_LONG_HAUL_DOCTRINE_ID,
    doctrineAlias: "PD-001",
    productId: POINT_TO_POINT_LONG_HAUL_PRODUCT_ID,
    doctrineVersion: POINT_TO_POINT_LONG_HAUL_PREVIOUS_DOCTRINE_VERSION,
    status: "HISTORICAL_SNAPSHOT" as const,
    behavior: "Legacy packages retain their persisted doctrine snapshot and synthetic planning behavior.",
  }),
  Object.freeze({
    doctrineId: POINT_TO_POINT_LONG_HAUL_DOCTRINE_ID,
    doctrineAlias: "PD-001",
    productId: POINT_TO_POINT_LONG_HAUL_PRODUCT_ID,
    doctrineVersion: POINT_TO_POINT_LONG_HAUL_DOCTRINE_VERSION,
    previousDoctrineVersion: POINT_TO_POINT_LONG_HAUL_PREVIOUS_DOCTRINE_VERSION,
    status: "ACTIVE" as const,
    changeReason: POINT_TO_POINT_LONG_HAUL_DOCTRINE_CHANGE_REASON,
  }),
]);

export function productDoctrineVersion(version: string) {
  return PRODUCT_DOCTRINE_VERSION_HISTORY.find((entry) => entry.doctrineVersion === version) ?? null;
}

export function createDoctrineMigrationRecord(args: {
  organizationId: string;
  tenantId: string;
  customerId: string;
  opportunityId: string;
  packageId: string;
  migratedBy: string;
  migratedAt?: string;
}) {
  return Object.freeze({
    ...args,
    migrationId: `${args.packageId}:PD-001:${POINT_TO_POINT_LONG_HAUL_PREVIOUS_DOCTRINE_VERSION}:TO:${POINT_TO_POINT_LONG_HAUL_DOCTRINE_VERSION}`,
    doctrineId: POINT_TO_POINT_LONG_HAUL_DOCTRINE_ID,
    previousDoctrineVersion: POINT_TO_POINT_LONG_HAUL_PREVIOUS_DOCTRINE_VERSION,
    newDoctrineVersion: POINT_TO_POINT_LONG_HAUL_DOCTRINE_VERSION,
    changeReason: POINT_TO_POINT_LONG_HAUL_DOCTRINE_CHANGE_REASON,
    migratedAt: args.migratedAt ?? new Date().toISOString(),
    historicalPackageMutation: false as const,
    noScopeVersionCreation: true as const,
  });
}
