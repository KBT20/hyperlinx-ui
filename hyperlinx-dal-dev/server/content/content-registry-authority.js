import { createHash } from "node:crypto";

export const CONTENT_REGISTRY_SCHEMA_VERSION = "CIP-115B-CONTENT-REGISTRY-V1";
export const CONTENT_DISCLOSURE_POLICY_VERSION = "CIP-115B-CONTENT-DISCLOSURE-V1";
export const CONTENT_INTERNAL_READ_PERMISSION = "content.registry.read_internal";

export const CONTENT_SOURCE_CLASSIFICATIONS = Object.freeze([
  "CUSTOMER_PROVIDED", "TERALINX_INTERNAL", "NETWORK_OPERATOR", "PUBLIC_GOVERNMENT",
  "PUBLIC_REFERENCE", "ENGINEERING_PROVIDER", "FIELD", "THIRD_PARTY_PROVIDER",
]);
export const CONTENT_RIGHTS_CLASSIFICATIONS = Object.freeze([
  "INTERNAL_ONLY", "TENANT_PRIVATE", "CUSTOMER_VISIBLE", "PROJECT_SHARED",
  "LICENSE_RESTRICTED", "AGGREGATED_ONLY",
]);
export const CONTENT_DATASET_CATEGORIES = Object.freeze([
  "NETWORK_ROUTE", "NETWORK_FACILITY", "NETWORK_SERVICE_AREA", "CUSTOMER_SITE",
  "DATA_CENTER", "CAMPUS", "GEOLOGY", "SOIL", "CONSTRUCTION_RISK", "ROAD", "RAIL",
  "BRIDGE", "ROW", "WATER", "WETLAND", "ENVIRONMENTAL", "ENGINEERING_ROUTE",
  "ENGINEERING_EVIDENCE", "FIELD_AS_BUILT", "DOCUMENT_REFERENCE",
]);
export const CONTENT_PURPOSES = Object.freeze([
  "INTERNAL_COMMERCIAL_PLANNING", "CUSTOMER_PLANNING", "ENGINEERING", "FIELD", "TWIN",
  "OPERATIONAL_INTELLIGENCE",
]);
export const CONTENT_REVISION_STATUSES = Object.freeze(["REGISTERED", "NON_GOVERNED_TEST_DATA"]);
export const CONTENT_INGESTION_JOB_CONTRACT = Object.freeze({
  schemaVersion: "CIP-115C-CONTENT-INGESTION-JOB-PREREQUISITE-V1",
  activated: false,
  fields: [
    "jobId", "sourceId", "datasetId", "proposedRevisionId", "uploadedObjectReference", "sourceHash",
    "quarantineStatus", "malwareScanStatus", "archiveValidationStatus", "parserStatus",
    "schemaValidationStatus", "geometryValidationStatus", "parserVersion", "mappingVersion",
    "sourceRowOrFeatureCount", "acceptedCount", "rejectedCount", "boundedDiagnostics",
    "initiatedBy", "initiatedAt", "completedAt", "finalDisposition", "canonicalReceiptHash",
  ],
});
export const CONTENT_OBJECT_STORAGE_CONTRACT = Object.freeze({
  activated: false,
  requirements: [
    "PRIVATE_OBJECT_REFERENCE", "TENANT_ISOLATION", "QUARANTINE_LOCATION", "ACCEPTED_LOCATION",
    "NO_PUBLIC_URL", "SERVER_SIDE_RETRIEVAL", "SOURCE_HASH", "BYTE_SIZE", "MEDIA_TYPE",
    "RETENTION", "ARCHIVAL_DELETION_POLICY", "AUDIT_ACCESS", "ENCRYPTION_AT_REST",
  ],
});
export const CONTENT_INGESTION_SECURITY_PREREQUISITES = Object.freeze([
  "MIME_ALLOWLIST", "EXTENSION_VALIDATION", "FILENAME_SANITIZATION", "REQUEST_BODY_SIZE_LIMIT",
  "ARCHIVE_ENTRY_LIMIT", "EXPANDED_BYTE_LIMIT", "COMPRESSION_RATIO_LIMIT", "NESTED_ARCHIVE_POLICY",
  "PATH_TRAVERSAL_PROTECTION", "SAFE_XML_POLICY", "MALWARE_SCANNING", "PARSER_ISOLATION",
  "PARSER_TIMEOUT", "PARSER_MEMORY_BUDGET", "ROW_LIMIT", "FEATURE_LIMIT",
  "GEOMETRY_COMPLEXITY_LIMIT", "CRS_VALIDATION", "GEOMETRY_VALIDITY", "SOURCE_HASH_BEFORE_PARSE",
  "QUARANTINE", "ACCEPTED_REJECTED_DISPOSITION", "IMMUTABLE_INGESTION_RECEIPT",
]);

const text = (value) => String(value ?? "").trim();
const object = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const array = (value) => Array.isArray(value) ? value : [];
const sorted = (value) => Array.isArray(value) ? value.map(sorted) : value && typeof value === "object"
  ? Object.keys(value).sort().reduce((out, key) => ({ ...out, [key]: sorted(value[key]) }), {}) : value;

export function contentCanonicalHash(value) {
  return createHash("sha256").update(JSON.stringify(sorted(value))).digest("hex");
}

export function contentRevisionCanonicalBasis(revision = {}) {
  const source = object(revision);
  return {
    revisionId: text(source.revisionId), datasetId: text(source.datasetId),
    revisionNumber: Number(source.revisionNumber), revisionLabel: text(source.revisionLabel),
    sourceHash: text(source.sourceHash), normalizedHash: text(source.normalizedHash) || null,
    byteSize: source.byteSize == null ? null : Number(source.byteSize), mediaType: text(source.mediaType) || null,
    sourceFilename: text(source.sourceFilename) || null, sourceReference: text(source.sourceReference) || null,
    effectiveFrom: text(source.effectiveFrom) || null, effectiveTo: text(source.effectiveTo) || null,
    observedAt: text(source.observedAt) || null, importedAt: text(source.importedAt) || null,
    coordinateReferenceSystem: text(source.coordinateReferenceSystem) || null,
    schemaVersion: text(source.schemaVersion) || CONTENT_REGISTRY_SCHEMA_VERSION,
    parserVersion: text(source.parserVersion) || null, mappingVersion: text(source.mappingVersion) || null,
    featureCount: source.featureCount == null ? null : Number(source.featureCount),
    geometryTypes: array(source.geometryTypes).map(text).filter(Boolean).sort(),
    geographicExtent: source.geographicExtent ?? null,
    validationStatus: text(source.validationStatus) || "UNRESOLVED",
    verificationClass: text(source.verificationClass) || "UNRESOLVED",
    registryStatus: text(source.registryStatus) || "REGISTERED",
    supersedesRevisionId: text(source.supersedesRevisionId) || null,
    provenance: object(source.provenance), transformations: array(source.transformations),
    createdByPrincipalId: text(source.createdByPrincipalId), createdByMembershipId: text(source.createdByMembershipId),
    createdAt: text(source.createdAt),
  };
}

export function resolveRevisionRegistration(existing, incoming) {
  const basis = contentRevisionCanonicalBasis(incoming);
  const canonicalHash = contentCanonicalHash(basis);
  if (!existing) return { disposition: "CREATE", revision: { ...basis, canonicalHash, immutable: true } };
  if (text(existing.revisionId) !== basis.revisionId) throw failure("CONTENT_REVISION_ID_MISMATCH", 409);
  if (text(existing.canonicalHash) === canonicalHash) return { disposition: "IDEMPOTENT", revision: existing };
  throw failure("CONTENT_REVISION_IMMUTABLE_CONFLICT", 409);
}

export function failure(code, status = 403, detail = code) {
  return Object.assign(new Error(detail), { code, status });
}

function permissionSet(user) {
  return new Set([...array(user?.permissions), ...array(user?.effectivePermissions)].map(text));
}

export function isInternalContentReader(user) {
  if (!text(user?.principalId) || !text(user?.membershipId) || !text(user?.sessionId)) return false;
  if (String(user?.membershipStatus ?? "ACTIVE").toUpperCase() === "INACTIVE") return false;
  const permissions = permissionSet(user);
  return permissions.has(CONTENT_INTERNAL_READ_PERMISSION) || permissions.has("platform.admin");
}

function activeGrant(grant, user, context, now) {
  if (text(grant.status || "ACTIVE") !== "ACTIVE" || grant.revokedAt) return false;
  if (grant.effectiveFrom && new Date(grant.effectiveFrom) > now) return false;
  if (grant.expiresAt && new Date(grant.expiresAt) <= now) return false;
  if (text(grant.granteeOrganizationId) !== text(user.organizationId)) return false;
  if (grant.granteePrincipalId && text(grant.granteePrincipalId) !== text(user.principalId)) return false;
  if (grant.granteeMembershipId && text(grant.granteeMembershipId) !== text(user.membershipId)) return false;
  if (text(grant.datasetId) !== text(context.datasetId)) return false;
  if (grant.datasetRevisionId && text(grant.datasetRevisionId) !== text(context.datasetRevisionId)) return false;
  if (text(grant.purpose) !== text(context.purpose)) return false;
  if (grant.projectId && text(grant.projectId) !== text(context.projectId)) return false;
  return true;
}

const geometryRanks = Object.freeze({ NONE: 0, BOUNDS: 1, GENERALIZED: 2, EXACT: 3 });
function leastGeometry(a, b) {
  const left = geometryRanks[text(a).toUpperCase()] ?? 0;
  const right = geometryRanks[text(b).toUpperCase()] ?? 0;
  return Object.entries(geometryRanks).find(([, rank]) => rank === Math.min(left, right))?.[0] ?? "NONE";
}

export function resolveContentAccess({ user, source, dataset, revision, grants = [], purpose, projectId = null, now = new Date() }) {
  const context = {
    datasetId: text(dataset?.datasetId), datasetRevisionId: text(revision?.revisionId), purpose: text(purpose), projectId: text(projectId),
  };
  if (!text(user?.principalId) || !text(user?.membershipId) || !text(user?.sessionId)) return { authorized: false, reason: "AUTHENTICATION_REQUIRED" };
  if (!CONTENT_PURPOSES.includes(context.purpose)) return { authorized: false, reason: "PURPOSE_NOT_ALLOWED" };
  if (isInternalContentReader(user)) return {
    authorized: true, actorClass: "INTERNAL", geometryAccess: "EXACT", permittedProperties: ["*"], exportAllowed: false,
    discloseSourceIdentity: true, discloseLicenseDetail: true, reason: "INTERNAL_EXACT_PERMISSION",
  };
  const rights = text(source?.rightsClassification);
  const rightsPolicy = object(source?.rightsPolicy);
  if (rights === "INTERNAL_ONLY") return { authorized: false, reason: "SOURCE_RIGHTS_INTERNAL_ONLY" };
  if (rights === "LICENSE_RESTRICTED" && rightsPolicy.externalDisclosureAllowed !== true) return { authorized: false, reason: "SOURCE_LICENSE_RESTRICTED" };
  if (rights === "TENANT_PRIVATE" && text(dataset?.ownerOrganizationId) !== text(user.organizationId)) return { authorized: false, reason: "TENANT_PRIVATE_MISMATCH" };
  const allowedPurposes = array(rightsPolicy.allowedPurposes).map(text);
  if (allowedPurposes.length && !allowedPurposes.includes(context.purpose)) return { authorized: false, reason: "SOURCE_PURPOSE_RESTRICTED" };
  const grant = grants.find((candidate) => activeGrant(candidate, user, context, now));
  if (!grant) return { authorized: false, reason: "CONTENT_ACCESS_GRANT_REQUIRED" };
  if (rights === "PROJECT_SHARED" && (!text(projectId) || text(grant.projectId) !== text(projectId))) return { authorized: false, reason: "PROJECT_SCOPE_REQUIRED" };
  const sourceGeometry = rights === "AGGREGATED_ONLY" ? "GENERALIZED" : text(rightsPolicy.maxGeometryAccess || "EXACT").toUpperCase();
  const geometryAccess = leastGeometry(sourceGeometry, grant.geometryAccess || "NONE");
  const sourceExport = rightsPolicy.exportAllowed === true;
  const exportAllowed = sourceExport && grant.exportAllowed === true;
  const sourceProperties = array(rightsPolicy.permittedProperties).map(text);
  const grantProperties = array(grant.permittedProperties).map(text);
  const permittedProperties = sourceProperties.length
    ? grantProperties.filter((key) => sourceProperties.includes(key))
    : grantProperties;
  return {
    authorized: true, actorClass: "EXTERNAL_CUSTOMER", geometryAccess, permittedProperties, exportAllowed,
    discloseSourceIdentity: rightsPolicy.discloseSourceIdentity === true,
    discloseLicenseDetail: false, grantId: text(grant.grantId), reason: "EXACT_ACTIVE_CONTENT_GRANT",
  };
}

export function assertContentAccess(args) {
  const decision = resolveContentAccess(args);
  if (!decision.authorized) throw failure("CONTENT_NOT_FOUND", 404);
  return decision;
}

export function contentDatasetProjection(context, decision) {
  const { dataset, source, revision, layer } = context;
  return {
    datasetId: text(dataset.datasetId), displayName: text(dataset.displayName), datasetType: text(dataset.datasetType),
    category: text(dataset.category), status: text(dataset.status),
    ownerOrganizationId: decision.actorClass === "INTERNAL" || text(dataset.ownerOrganizationId) === text(context.actorOrganizationId)
      ? text(dataset.ownerOrganizationId) : undefined,
    currentRevision: revision ? {
      datasetRevisionId: text(revision.revisionId), revisionNumber: Number(revision.revisionNumber),
      revisionLabel: text(revision.revisionLabel), datasetRevisionCanonicalHash: text(revision.canonicalHash),
      registryStatus: text(revision.registryStatus), effectiveFrom: revision.effectiveFrom ?? null,
      effectiveTo: revision.effectiveTo ?? null, observedAt: revision.observedAt ?? null,
    } : null,
    layer: layer ? { layerId: text(layer.layerId), displayName: text(layer.displayName), styleClass: text(layer.styleClass) } : null,
    source: decision.discloseSourceIdentity ? { sourceId: text(source.sourceId), displayName: text(source.displayName), sourceClassification: text(source.sourceClassification) } : { sourceClassification: "DISCLOSURE_RESTRICTED" },
    disclosureAuthority: { policyVersion: CONTENT_DISCLOSURE_POLICY_VERSION, decision: decision.reason, exportAllowed: decision.exportAllowed === true },
  };
}

export function contentRevisionProjection(context, decision, { provenance = false } = {}) {
  const revision = context.revision;
  const base = {
    datasetId: text(revision.datasetId), datasetRevisionId: text(revision.revisionId),
    revisionNumber: Number(revision.revisionNumber), revisionLabel: text(revision.revisionLabel),
    datasetRevisionCanonicalHash: text(revision.canonicalHash), sourceHash: decision.actorClass === "INTERNAL" ? text(revision.sourceHash) : undefined,
    normalizedHash: decision.actorClass === "INTERNAL" ? text(revision.normalizedHash) || null : undefined,
    effectiveFrom: revision.effectiveFrom ?? null, effectiveTo: revision.effectiveTo ?? null, observedAt: revision.observedAt ?? null,
    importedAt: decision.actorClass === "INTERNAL" ? revision.importedAt ?? null : undefined,
    coordinateReferenceSystem: text(revision.coordinateReferenceSystem) || null,
    featureCount: decision.actorClass === "INTERNAL" ? Number(revision.featureCount ?? 0) : undefined,
    geometryTypes: array(revision.geometryTypes), validationStatus: text(revision.validationStatus),
    verificationClass: text(revision.verificationClass), registryStatus: text(revision.registryStatus),
    supersedesRevisionId: decision.actorClass === "INTERNAL" ? text(revision.supersedesRevisionId) || null : undefined,
    disclosureAuthority: { policyVersion: CONTENT_DISCLOSURE_POLICY_VERSION, geometryAccess: decision.geometryAccess, exportAllowed: decision.exportAllowed === true },
  };
  if (!provenance) return base;
  return {
    ...base,
    provenance: decision.actorClass === "INTERNAL" ? object(revision.provenance) : { freshness: revision.observedAt ?? revision.effectiveFrom ?? null },
    transformations: decision.actorClass === "INTERNAL" ? array(revision.transformations) : undefined,
    source: decision.discloseSourceIdentity ? { sourceId: text(context.source.sourceId), displayName: text(context.source.displayName), acquisitionMethod: text(context.source.acquisitionMethod) } : undefined,
    licenseReference: decision.discloseLicenseDetail ? text(context.source.licenseReference) || null : undefined,
  };
}

export function contentLayerProjection(context, decision, queryCapabilities = ["BBOX", "NEAREST", "INTERSECTION"]) {
  const { layer, dataset, revision, source } = context;
  return {
    projectionId: `CONTENT-LAYER-${text(layer.layerId)}-${text(revision.revisionId)}`,
    projectionVersion: CONTENT_DISCLOSURE_POLICY_VERSION,
    layerId: text(layer.layerId), datasetId: text(dataset.datasetId), datasetRevisionId: text(revision.revisionId),
    datasetRevisionCanonicalHash: text(revision.canonicalHash), category: text(dataset.category),
    displayName: text(layer.displayName || dataset.displayName), geometryTypes: array(revision.geometryTypes),
    geographicExtent: decision.actorClass === "INTERNAL" ? revision.geographicExtent ?? null : undefined,
    styleClass: text(layer.styleClass), freshness: revision.observedAt ?? revision.effectiveFrom ?? null,
    sourceClass: decision.discloseSourceIdentity ? text(source.sourceClassification) : "DISCLOSURE_RESTRICTED",
    permittedProperties: decision.permittedProperties, geometryPrecision: decision.geometryAccess,
    queryCapabilities: decision.geometryAccess === "NONE" ? [] : queryCapabilities,
    exportAllowed: decision.exportAllowed === true,
    disclosureDecisionId: contentCanonicalHash({ policy: CONTENT_DISCLOSURE_POLICY_VERSION, actor: text(context.actorId), revision: revision.revisionId, grant: decision.grantId ?? "INTERNAL", purpose: context.purpose }),
  };
}

export function filterContentProperties(properties, permittedProperties) {
  const source = object(properties);
  if (permittedProperties.includes("*")) return source;
  return permittedProperties.reduce((out, key) => {
    if (Object.hasOwn(source, key)) out[key] = source[key];
    return out;
  }, {});
}

export function contentFeatureProjection(row, decision) {
  const projected = {
    featureId: text(row.featureId ?? row.feature_id),
    sourceFeatureKey: decision.actorClass === "INTERNAL" ? text(row.sourceFeatureKey ?? row.source_feature_key) : undefined,
    datasetRevisionId: text(row.datasetRevisionId ?? row.dataset_revision_id),
    geometryHash: text(row.geometryHash ?? row.geometry_hash), propertiesHash: text(row.propertiesHash ?? row.properties_hash),
    properties: filterContentProperties(row.properties, decision.permittedProperties),
    validationStatus: text(row.validationStatus ?? row.validation_status),
    effectiveFrom: row.effectiveFrom ?? row.effective_from ?? null, effectiveTo: row.effectiveTo ?? row.effective_to ?? null,
    canonicalHash: text(row.canonicalHash ?? row.canonical_hash),
  };
  if (decision.geometryAccess !== "NONE" && row.geometry) projected.geometry = typeof row.geometry === "string" ? JSON.parse(row.geometry) : row.geometry;
  return projected;
}

export function parseBbox(value) {
  const parts = text(value).split(",").map(Number);
  if (parts.length !== 4 || parts.some((item) => !Number.isFinite(item))) throw failure("CONTENT_BBOX_INVALID", 400);
  const [west, south, east, north] = parts;
  if (west < -180 || east > 180 || south < -90 || north > 90 || west > east || south > north) throw failure("CONTENT_BBOX_INVALID", 400);
  return { west, south, east, north };
}

export function parseNearest(value) {
  const parts = text(value).split(",").map(Number);
  if (parts.length !== 2 || parts.some((item) => !Number.isFinite(item))) throw failure("CONTENT_NEAREST_INVALID", 400);
  const [longitude, latitude] = parts;
  if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) throw failure("CONTENT_NEAREST_INVALID", 400);
  return { longitude, latitude };
}

export function boundedLimit(value, maximum = 500) {
  const limit = Number(value ?? 100);
  if (!Number.isInteger(limit) || limit < 1 || limit > maximum) throw failure("CONTENT_QUERY_LIMIT_INVALID", 400);
  return limit;
}
