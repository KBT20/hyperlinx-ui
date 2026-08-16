import { createHash } from "node:crypto";
import { instantiateDoctrineObjects } from "../products/DoctrineObjectInstantiationEngine";
import {
  POINT_TO_POINT_LONG_HAUL_DOCTRINE,
  POINT_TO_POINT_LONG_HAUL_DOCTRINE_ID,
  POINT_TO_POINT_LONG_HAUL_DOCTRINE_HASH,
  POINT_TO_POINT_LONG_HAUL_DOCTRINE_VERSION,
  POINT_TO_POINT_LONG_HAUL_PRODUCT_ID,
  assemblePointToPointLongHaulDoctrine,
} from "../products/pointToPointLongHaulDoctrine";

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(...values: unknown[]): string {
  for (const value of values) {
    const normalized = String(value ?? "").trim();
    if (normalized) return normalized;
  }
  return "";
}

function number(...values: unknown[]): number {
  for (const value of values) {
    const normalized = Number(value);
    if (Number.isFinite(normalized)) return normalized;
  }
  return 0;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value as JsonRecord).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson((value as JsonRecord)[key])}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

const calculatedDoctrineHash = createHash("sha256")
  .update(canonicalJson(POINT_TO_POINT_LONG_HAUL_DOCTRINE))
  .digest("hex");
if (calculatedDoctrineHash !== POINT_TO_POINT_LONG_HAUL_DOCTRINE_HASH) {
  throw new Error(`PRODUCT_DOCTRINE_HASH_REGISTRY_MISMATCH: ${calculatedDoctrineHash}`);
}
export const PRODUCT_DOCTRINE_HASH = POINT_TO_POINT_LONG_HAUL_DOCTRINE_HASH;

export const PRODUCT_DOCTRINE_AUTHORITY = Object.freeze({
  productId: POINT_TO_POINT_LONG_HAUL_PRODUCT_ID,
  productDoctrineId: POINT_TO_POINT_LONG_HAUL_DOCTRINE_ID,
  productDoctrineVersion: POINT_TO_POINT_LONG_HAUL_DOCTRINE_VERSION,
  productDoctrineHash: PRODUCT_DOCTRINE_HASH,
  productName: POINT_TO_POINT_LONG_HAUL_DOCTRINE.productName,
  doctrineAlias: POINT_TO_POINT_LONG_HAUL_DOCTRINE.registry.alias,
  status: "ACTIVE",
  immutable: true,
  authority: "PRODUCT_DOCTRINE_REGISTRY",
});

export function resolveProductDoctrineAuthority(candidate: JsonRecord = {}) {
  const productId = text(candidate.productId);
  const productDoctrineId = text(candidate.productDoctrineId, candidate.doctrineId);
  const productDoctrineVersion = text(candidate.productDoctrineVersion, candidate.doctrineVersion);
  const productDoctrineHash = text(candidate.productDoctrineHash, candidate.doctrineHash);
  if (!productId || !productDoctrineId || !productDoctrineVersion || !productDoctrineHash) return null;
  if (
    productId !== PRODUCT_DOCTRINE_AUTHORITY.productId
    || productDoctrineId !== PRODUCT_DOCTRINE_AUTHORITY.productDoctrineId
    || productDoctrineVersion !== PRODUCT_DOCTRINE_AUTHORITY.productDoctrineVersion
    || productDoctrineHash !== PRODUCT_DOCTRINE_AUTHORITY.productDoctrineHash
  ) return null;
  return PRODUCT_DOCTRINE_AUTHORITY;
}

export function assembleProductDoctrineArtifacts(input: {
  packageId: string;
  proposal: JsonRecord;
  route?: JsonRecord;
}) {
  const proposal = record(input.proposal);
  const routeRecord = record(input.route);
  const geometryRecord = record(proposal.geometry);
  const centerlineRoute = record(proposal.centerlineRoute);
  const routeGeometry = array(
    routeRecord.commercialGeometry
    ?? routeRecord.geometry
    ?? proposal.routeGeometry
    ?? proposal.centerline
    ?? centerlineRoute.geometry
    ?? geometryRecord.coordinates,
  ) as [number, number][];
  const routeMiles = number(routeRecord.routeMiles, proposal.routeMiles, record(proposal.pricingSummary).routeMiles, record(proposal.productConfiguration).routeMiles);
  const routeFeet = number(routeRecord.routeFeet, proposal.routeFeet, routeMiles * 5280);
  const routeId = text(routeRecord.routeRepositoryId, routeRecord.routeId, proposal.routeId, centerlineRoute.routeId, array(proposal.geometryReferences)[0], input.packageId);
  const routeRevision = text(routeRecord.routeRevision, routeRecord.revision, proposal.routeRevision, "1");
  const routeHash = text(routeRecord.geometryHash, proposal.routeGeometryHash, proposal.geometryHash, routeId);
  const authoritativeRoute = routeGeometry.length > 1 && routeFeet > 0 ? {
    routeId,
    source: "COMMERCIAL_ROUTE_REPOSITORY" as const,
    routeMiles: routeMiles || routeFeet / 5280,
    routeFeet,
    distanceMeters: routeFeet * 0.3048,
    geometry: routeGeometry,
    routeAuthority: "COMMERCIAL_ROUTE_REPOSITORY",
    routeRevision,
    routeHash,
    measurementAuthority: "MEASURED_CENTERLINE",
  } : null;
  const projectConfiguration = record(proposal.productConfiguration ?? proposal.projectConfiguration);
  const assembly = assemblePointToPointLongHaulDoctrine({
    accountId: text(proposal.accountId, proposal.customerId),
    customerId: text(proposal.customerId),
    aSite: null,
    zSite: null,
    osrmRoute: authoritativeRoute,
    authoritativeRoute,
    projectConfiguration,
    pricingSummary: record(proposal.pricingSummary),
    conduitCount: number(projectConfiguration.ductCount, projectConfiguration.conduitCount),
    conduitSizeInches: number(projectConfiguration.ductDiameter, projectConfiguration.conduitSizeInches),
    fiberCount: number(projectConfiguration.fiberCount),
  });
  if (assembly.validationSummary.status !== "PASS") {
    const failures = assembly.validationSummary.checks.filter((check) => check.status !== "PASS").map((check) => check.key);
    const error = new Error(`PRODUCT_DOCTRINE_ASSEMBLY_FAILED: ${failures.join(", ")}`);
    Object.assign(error, { code: "PRODUCT_DOCTRINE_ASSEMBLY_FAILED", status: 409, failures });
    throw error;
  }
  const instantiation = instantiateDoctrineObjects({
    packageId: input.packageId,
    productDoctrine: POINT_TO_POINT_LONG_HAUL_DOCTRINE,
    productDoctrineAssembly: assembly,
    routeId,
    scopeVersionCandidateId: `${input.packageId}:SCOPEVERSION-CANDIDATE`,
    geometryHash: routeHash,
  });
  if (instantiation.validation.status !== "PASS") {
    const error = new Error(`DOCTRINE_OBJECT_INSTANTIATION_FAILED: ${instantiation.validation.failures.join("; ")}`);
    Object.assign(error, { code: "DOCTRINE_OBJECT_INSTANTIATION_FAILED", status: 409, failures: instantiation.validation.failures });
    throw error;
  }
  return {
    authority: PRODUCT_DOCTRINE_AUTHORITY,
    productDoctrine: POINT_TO_POINT_LONG_HAUL_DOCTRINE,
    productDoctrineAssembly: assembly,
    doctrineObjectInstantiation: instantiation,
    engineeringObjectManifest: instantiation.engineeringObjectManifest,
  };
}
