import { createHash } from "node:crypto";
import {
  DIRS,
  errorResponse,
  handleOptions,
  hydrateIofProjectionArtifacts,
  jsonResponse,
  listRecords,
  loadRecord,
  nowIso,
  persistRecord,
  readRequestJsonWithRaw,
  recordPath,
  sortedByUpdated,
  unwrapBody,
} from "./_shared.js";
import { requireAnyPermission } from "./authority.js";

const BASE_PATH = "/api/engineering/baselines";
const REFERENCE_ONLY_PAYLOAD_LIMIT_BYTES = 16 * 1024;
const FORBIDDEN_BASELINE_KEYS = [
  "commercialGeometry",
  "convertedRuntimeGeometry",
  "routeGeometry",
  "route",
  "stations",
  "stationArrays",
  "proposalBody",
  "proposalDocument",
  "workbookBody",
  "estimateBody",
  "draftIOFPackageBody",
  "draftIofPackageBody",
  "routeRepositorySnapshot",
  "customerInventory",
  "runtimeCache",
  "mapState",
  "leafletMap",
  "reactState",
];
const ALLOWED_ENGINEERING_BASELINE_KEYS = [
  "engineeringBaselineId",
  "engineeringBaselineManifestId",
  "engineeringBaselineProjectionId",
  "engineeringBaselineHash",
  "draftIOFPackageId",
  "draftIofPackageId",
  "commercialReleasePackageId",
  "commercialRevisionId",
  "commercialRevisionHash",
  "commercialReleaseHash",
  "routeRepositoryId",
  "stationProjectionId",
  "measuredCenterlineId",
  "stationGraphId",
  "stationAuthorityIds",
  "objectManifestId",
  "stationObjectManifestId",
  "projectedObjectManifestId",
  "estimateId",
  "workbookId",
  "commercialWorkbookId",
  "proposalId",
  "productDoctrineId",
  "engineeringDoctrineId",
  "opportunityId",
  "customerId",
  "customerTwinId",
  "submittedBy",
  "submittedById",
  "submittedAt",
  "baselineState",
  "engineeringAuthority",
  "authority",
  "repositoryType",
  "referenceOnly",
  "immutable",
  "draftIofPackageUnchanged",
  "noCommercialMutation",
  "noScopeVersionCreation",
  "noGeometryDuplication",
  "noWorkbookDuplication",
  "noProposalDuplication",
  "referenceIntegrity",
  "createdAt",
  "updatedAt",
];

export const EngineeringBaselineAuthority = {
  authority: "ENGINEERING_BASELINE_AUTHORITY",
  repositoryType: "ENGINEERING_BASELINE",
  endpoint: BASE_PATH,
  storagePath: "server/data/engineering-baselines",
  immutable: true,
  referenceOnly: true,
  draftIofPackageUnchanged: true,
  noCommercialMutation: true,
  noScopeVersionCreation: true,
};

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === "") return [];
  return [value];
}

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function stableIdPart(value, fallback = "UNKNOWN") {
  return String(value ?? fallback)
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || fallback;
}

function firstText(...values) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function referenceTextArray(...values) {
  const result = [];
  const seen = new Set();
  const visit = (value) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    const text = String(value ?? "").trim();
    if (!text || seen.has(text)) return;
    seen.add(text);
    result.push(text);
  };
  values.forEach(visit);
  return result;
}

function routeParts(pathname) {
  const normalizedPath = pathname.replace(/\/+$/, "");
  if (normalizedPath === BASE_PATH) return [];
  if (!normalizedPath.startsWith(`${BASE_PATH}/`)) return null;
  return normalizedPath
    .slice(BASE_PATH.length + 1)
    .split("/")
    .filter(Boolean)
    .map((part) => decodeURIComponent(part));
}

function serializedByteSize(value) {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

function payloadFieldSizes(record) {
  return Object.entries(record)
    .map(([key, value]) => ({ key, bytes: serializedByteSize(value) }))
    .sort((a, b) => b.bytes - a.bytes);
}

function fieldFromSources(sources, keys) {
  for (const source of sources.map(asRecord)) {
    for (const key of keys) {
      const value = source[key];
      if (value !== undefined && value !== null && String(value).trim()) return String(value);
    }
  }
  return "";
}

function commercialWorkbookIdFrom(draftPackage, opportunity) {
  const draft = asRecord(draftPackage);
  const opportunityRecord = asRecord(opportunity);
  const commercialSummary = asRecord(draft.commercialSummary);
  const workbook = asRecord(draft.commercialWorkbook ?? opportunityRecord.commercialWorkbook ?? opportunityRecord.workbookSnapshot);
  return fieldFromSources([draft, commercialSummary, workbook, opportunityRecord], [
    "commercialWorkbookId",
    "workbookId",
    "CommercialWorkbookId",
  ]) || (draft.packageId ? `WORKBOOK-${stableIdPart(draft.packageId)}` : "");
}

function estimateIdFrom(draftPackage, opportunity) {
  const draft = asRecord(draftPackage);
  const opportunityRecord = asRecord(opportunity);
  const commercialSummary = asRecord(draft.commercialSummary);
  const pricingSummary = asRecord(draft.pricingSummary ?? commercialSummary.pricingSummary);
  const estimate = asRecord(draft.commercialEstimate ?? opportunityRecord.commercialEstimate ?? opportunityRecord.estimate ?? opportunityRecord.estimateSnapshot);
  return fieldFromSources([draft, commercialSummary, pricingSummary, estimate, opportunityRecord], [
    "commercialEstimateId",
    "estimateId",
    "EstimateId",
  ]) || (draft.packageId ? `ESTIMATE-${stableIdPart(draft.packageId)}` : "");
}

function engineeringBaselineReferenceHash(record) {
  const referencePayload = {
    engineeringBaselineId: record.engineeringBaselineId,
    draftIOFPackageId: record.draftIOFPackageId,
    commercialReleasePackageId: record.commercialReleasePackageId,
    commercialRevisionId: record.commercialRevisionId,
    commercialRevisionHash: record.commercialRevisionHash,
    commercialReleaseHash: record.commercialReleaseHash,
    routeRepositoryId: record.routeRepositoryId,
    stationProjectionId: record.stationProjectionId,
    objectManifestId: record.objectManifestId,
    estimateId: record.estimateId,
    workbookId: record.workbookId,
    proposalId: record.proposalId,
    productDoctrineId: record.productDoctrineId,
    engineeringDoctrineId: record.engineeringDoctrineId,
    opportunityId: record.opportunityId,
    customerTwinId: record.customerTwinId,
  };
  return createHash("sha256").update(JSON.stringify(referencePayload)).digest("hex");
}

export function engineeringBaselineIdForDraftPackage(draftPackage = {}) {
  return String(draftPackage.engineeringBaselineId ?? `ENG-BASE-${stableIdPart(draftPackage.packageId ?? draftPackage.draftPackageId ?? draftPackage.proposalId)}`);
}

export function EngineeringBaselineManifest(record = {}) {
  const baseline = asRecord(record);
  return {
    engineeringBaselineManifestId: firstText(baseline.engineeringBaselineManifestId, `ENG-BASE-MANIFEST-${stableIdPart(baseline.engineeringBaselineId)}`),
    engineeringBaselineId: baseline.engineeringBaselineId,
    draftIOFPackageId: baseline.draftIOFPackageId,
    stationProjectionId: baseline.stationProjectionId,
    objectManifestId: baseline.objectManifestId,
    referenceOnly: true,
    immutable: true,
  };
}

export function EngineeringBaselineProjection(record = {}) {
  const baseline = asRecord(record);
  return {
    engineeringBaselineProjectionId: firstText(baseline.engineeringBaselineProjectionId, `ENG-BASE-PROJ-${stableIdPart(baseline.engineeringBaselineId)}`),
    engineeringBaselineId: baseline.engineeringBaselineId,
    routeRepositoryId: baseline.routeRepositoryId,
    stationProjectionId: baseline.stationProjectionId,
    objectManifestId: baseline.objectManifestId,
    projectionAuthority: "ENGINEERING_BASELINE_PROJECTION",
    repositoryTruthUnchanged: true,
    noRegeneration: true,
    noScopeVersionCreation: true,
  };
}

export function assertReferenceOnlyEngineeringBaselinePayload(record) {
  const topLevelKeys = Object.keys(record);
  const forbiddenKeys = topLevelKeys.filter((key) => !ALLOWED_ENGINEERING_BASELINE_KEYS.includes(key));
  const doctrineForbidden = topLevelKeys.filter((key) => FORBIDDEN_BASELINE_KEYS.includes(key));
  const largestFields = payloadFieldSizes(record).slice(0, 8);
  const serializedBytes = serializedByteSize(record);
  console.info("[EngineeringBaseline] reference-only payload audit", {
    topLevelKeys,
    serializedBytes,
    largestFields,
  });
  if (forbiddenKeys.length || doctrineForbidden.length) {
    const offendingField = forbiddenKeys[0] ?? doctrineForbidden[0];
    const error = new Error(`Engineering Baseline payload contains non-reference field: ${offendingField}`);
    error.status = 413;
    error.offendingField = offendingField;
    error.payloadAudit = { topLevelKeys, serializedBytes, largestFields };
    throw error;
  }
  const largest = largestFields[0];
  if (serializedBytes > REFERENCE_ONLY_PAYLOAD_LIMIT_BYTES) {
    const error = new Error(`Engineering Baseline payload exceeds reference-only threshold. Offending field: ${largest?.key ?? "unknown"} (${largest?.bytes ?? 0} bytes).`);
    error.status = 413;
    error.offendingField = largest?.key;
    error.payloadAudit = { topLevelKeys, serializedBytes, largestFields };
    throw error;
  }
  return { topLevelKeys, serializedBytes, largestFields };
}

export function engineeringBaselineRecordForRepository(input = {}) {
  const draft = asRecord(input.draftPackage ?? input.draft ?? input.iofPackage);
  const opportunity = asRecord(input.opportunity);
  const user = asRecord(input.user);
  const measuredCenterline = asRecord(draft.measuredCenterline);
  const stationIndexedGraph = asRecord(draft.stationIndexedGraph);
  const stationAuthority = asRecord(draft.stationAuthority);
  const stationObjectManifest = asRecord(draft.stationObjectManifest);
  const projectedObjectManifest = asRecord(draft.projectedObjectManifest);
  const doctrineObjectManifest = asRecord(draft.doctrineObjectManifest ?? draft.engineeringObjectManifest);
  const timestamp = String(input.timestamp ?? input.submittedAt ?? draft.submittedToEngineeringAt ?? draft.submittedAt ?? nowIso());
  const draftIOFPackageId = firstText(
    input.draftIOFPackageId,
    input.draftIofPackageId,
    draft.draftIOFPackageId,
    draft.draftIofPackageId,
    draft.packageId,
  );
  const engineeringBaselineId = firstText(
    input.engineeringBaselineId,
    draft.engineeringBaselineId,
    engineeringBaselineIdForDraftPackage({ packageId: draftIOFPackageId || draft.packageId, proposalId: draft.proposalId }),
  );
  const stationGraphId = firstText(input.stationGraphId, draft.stationGraphId, stationIndexedGraph.stationGraphId, stationIndexedGraph.graphId);
  const stationAuthorityIds = referenceTextArray(
    input.stationAuthorityIds,
    draft.stationAuthorityIds,
    stationAuthority.stationAuthorityIds,
    stationAuthority.stationAuthorityId,
    stationAuthority.authorityId,
  );
  const stationObjectManifestId = firstText(input.stationObjectManifestId, draft.stationObjectManifestId, stationObjectManifest.stationObjectManifestId, stationObjectManifest.manifestId);
  const projectedObjectManifestId = firstText(input.projectedObjectManifestId, draft.projectedObjectManifestId, projectedObjectManifest.projectedObjectManifestId, projectedObjectManifest.manifestId);
  const objectManifestId = firstText(
    input.objectManifestId,
    draft.engineeringObjectManifestId,
    draft.doctrineObjectManifestId,
    doctrineObjectManifest.manifestId,
    stationObjectManifestId,
    projectedObjectManifestId,
  );
  const workbookId = firstText(input.workbookId, input.commercialWorkbookId, commercialWorkbookIdFrom(draft, opportunity));
  const record = {
    engineeringBaselineId,
    engineeringBaselineManifestId: firstText(input.engineeringBaselineManifestId, `ENG-BASE-MANIFEST-${stableIdPart(engineeringBaselineId)}`),
    engineeringBaselineProjectionId: firstText(input.engineeringBaselineProjectionId, `ENG-BASE-PROJ-${stableIdPart(engineeringBaselineId)}`),
    draftIOFPackageId,
    draftIofPackageId: draftIOFPackageId,
    commercialReleasePackageId: firstText(input.commercialReleasePackageId, draft.commercialReleasePackageId, asRecord(draft.commercialSummary).commercialReleasePackageId, opportunity.commercialReleasePackageId),
    commercialRevisionId: firstText(input.commercialRevisionId, draft.commercialRevisionId, asRecord(draft.commercialSummary).commercialRevisionId, opportunity.commercialRevisionId),
    commercialRevisionHash: firstText(input.commercialRevisionHash, draft.commercialRevisionHash, asRecord(draft.commercialSummary).commercialRevisionHash, opportunity.commercialRevisionHash),
    commercialReleaseHash: firstText(input.commercialReleaseHash, draft.commercialReleaseHash, asRecord(draft.commercialSummary).commercialReleaseHash, opportunity.commercialReleaseHash),
    routeRepositoryId: firstText(input.routeRepositoryId, draft.routeRepositoryId, asRecord(draft.routeRepositoryRef).routeRepositoryId, asRecord(draft.commercialSummary).routeRepositoryId, opportunity.routeRepositoryId, asRecord(opportunity.routeRepositoryRef).routeRepositoryId),
    stationProjectionId: firstText(input.stationProjectionId, draft.stationProjectionId, stationGraphId),
    measuredCenterlineId: firstText(input.measuredCenterlineId, draft.measuredCenterlineId, measuredCenterline.measuredCenterlineId, measuredCenterline.measuredSpineId, measuredCenterline.spineId),
    stationGraphId,
    stationAuthorityIds,
    objectManifestId,
    stationObjectManifestId,
    projectedObjectManifestId,
    estimateId: firstText(input.estimateId, estimateIdFrom(draft, opportunity)),
    workbookId,
    commercialWorkbookId: firstText(input.commercialWorkbookId, workbookId),
    proposalId: firstText(input.proposalId, input.commercialProposalId, draft.proposalId, asRecord(draft.proposalSummary).proposalId, opportunity.proposalId),
    productDoctrineId: firstText(input.productDoctrineId, draft.productDoctrineId, draft.doctrineId, asRecord(draft.productionDoctrine).doctrineId, "PD-001"),
    engineeringDoctrineId: firstText(input.engineeringDoctrineId, draft.engineeringDoctrineId, asRecord(draft.productionDoctrine).engineeringDoctrineId, "PD-006"),
    opportunityId: firstText(input.opportunityId, draft.opportunityId, opportunity.opportunityId),
    customerId: firstText(input.customerId, draft.customerId, opportunity.customerId, opportunity.accountId),
    customerTwinId: firstText(input.customerTwinId, draft.customerTwinId, draft.customerTwinReference, opportunity.customerTwinId, opportunity.customerTwinReference, draft.customerId ? `CUSTOMER-TWIN-${stableIdPart(draft.customerId)}` : ""),
    submittedBy: firstText(input.submittedBy, draft.submittedBy, user.name, "Commercial"),
    submittedById: firstText(input.submittedById, draft.submittedById, user.userId),
    submittedAt: timestamp,
    baselineState: "FROZEN",
    engineeringAuthority: "ENGINEERING_BASELINE",
    authority: EngineeringBaselineAuthority.authority,
    repositoryType: EngineeringBaselineAuthority.repositoryType,
    referenceOnly: true,
    immutable: true,
    draftIofPackageUnchanged: true,
    noCommercialMutation: true,
    noScopeVersionCreation: true,
    noGeometryDuplication: true,
    noWorkbookDuplication: true,
    noProposalDuplication: true,
    createdAt: String(input.createdAt ?? timestamp),
    updatedAt: String(input.updatedAt ?? timestamp),
  };
  record.engineeringBaselineHash = engineeringBaselineReferenceHash(record);
  if (input.referenceIntegrity) record.referenceIntegrity = input.referenceIntegrity;
  assertReferenceOnlyEngineeringBaselinePayload(record);
  return record;
}

export function EngineeringBaseline(input = {}) {
  return engineeringBaselineRecordForRepository(input);
}

export function buildEngineeringBaselineFromDraftPackage(draftPackage = {}, context = {}) {
  return engineeringBaselineRecordForRepository({
    draftPackage,
    opportunity: context.opportunity,
    user: context.user,
    timestamp: context.timestamp,
    submittedBy: context.submittedBy,
    submittedById: context.submittedById,
    submittedAt: context.submittedDate,
    createdAt: context.createdAt,
    updatedAt: context.timestamp,
  });
}

export function normalizeEngineeringBaseline(record = {}) {
  return engineeringBaselineRecordForRepository({
    engineeringBaselineId: record.engineeringBaselineId ?? record.EngineeringBaselineId,
    engineeringBaselineManifestId: record.engineeringBaselineManifestId,
    engineeringBaselineProjectionId: record.engineeringBaselineProjectionId,
    draftIOFPackageId: record.draftIOFPackageId ?? record.draftIofPackageId ?? record.DraftIOFPackageId,
    commercialReleasePackageId: record.commercialReleasePackageId ?? record.CommercialReleasePackageId,
    commercialRevisionId: record.commercialRevisionId ?? record.CommercialRevisionId,
    commercialRevisionHash: record.commercialRevisionHash,
    commercialReleaseHash: record.commercialReleaseHash,
    routeRepositoryId: record.routeRepositoryId ?? record.RouteRepositoryId,
    stationProjectionId: record.stationProjectionId,
    measuredCenterlineId: record.measuredCenterlineId,
    stationGraphId: record.stationGraphId,
    stationAuthorityIds: record.stationAuthorityIds,
    objectManifestId: record.objectManifestId,
    stationObjectManifestId: record.stationObjectManifestId,
    projectedObjectManifestId: record.projectedObjectManifestId,
    estimateId: record.estimateId ?? record.EstimateId,
    workbookId: record.workbookId ?? record.commercialWorkbookId ?? record.CommercialWorkbookId,
    commercialWorkbookId: record.commercialWorkbookId ?? record.CommercialWorkbookId,
    proposalId: record.proposalId ?? record.commercialProposalId ?? record.CommercialProposalId,
    productDoctrineId: record.productDoctrineId ?? record.ProductDoctrineId,
    engineeringDoctrineId: record.engineeringDoctrineId,
    opportunityId: record.opportunityId ?? record.OpportunityId,
    customerId: record.customerId,
    customerTwinId: record.customerTwinId,
    submittedBy: record.submittedBy,
    submittedById: record.submittedById,
    submittedAt: record.submittedAt ?? record.submittedDate,
    referenceIntegrity: record.referenceIntegrity,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}

function workbookReferenceResolves(commercialWorkbookId, draftPackage, opportunity) {
  if (!commercialWorkbookId) return false;
  const draft = asRecord(draftPackage);
  const opportunityRecord = asRecord(opportunity);
  const knownIds = [
    draft.commercialWorkbookId,
    draft.workbookId,
    asRecord(draft.commercialWorkbook).workbookId,
    asRecord(draft.commercialSummary).workbookId,
    opportunityRecord.commercialWorkbookId,
    opportunityRecord.workbookId,
    asRecord(opportunityRecord.commercialWorkbook).workbookId,
    asRecord(opportunityRecord.workbookSnapshot).workbookId,
  ].map((value) => String(value ?? ""));
  return knownIds.includes(String(commercialWorkbookId))
    || Boolean(asArray(draft.commercialWorkbookSections).length)
    || Boolean(asRecord(opportunityRecord.commercialWorkbook).sections);
}

function estimateReferenceResolves(estimateId, draftPackage, opportunity) {
  if (!estimateId) return false;
  const draft = asRecord(draftPackage);
  const opportunityRecord = asRecord(opportunity);
  const knownIds = [
    draft.estimateId,
    draft.commercialEstimateId,
    asRecord(draft.commercialEstimate).estimateId,
    asRecord(draft.commercialSummary).estimateId,
    asRecord(draft.pricingSummary).estimateId,
    opportunityRecord.estimateId,
    asRecord(opportunityRecord.commercialEstimate).estimateId,
    asRecord(opportunityRecord.estimate).estimateId,
    asRecord(opportunityRecord.estimateSnapshot).estimateId,
  ].map((value) => String(value ?? ""));
  return knownIds.includes(String(estimateId))
    || Boolean(asRecord(draft.pricingSummary).totalCost)
    || Boolean(asRecord(asRecord(draft.commercialSummary).pricingSummary).totalCost)
    || Boolean(asRecord(opportunityRecord.estimate).totalCost);
}

function verifyEngineeringBaselineRepositoryRecord(record) {
  const required = [
    "engineeringBaselineId",
    "engineeringBaselineManifestId",
    "engineeringBaselineProjectionId",
    "engineeringBaselineHash",
    "draftIOFPackageId",
    "commercialReleasePackageId",
    "commercialRevisionId",
    "commercialRevisionHash",
    "commercialReleaseHash",
    "routeRepositoryId",
    "stationProjectionId",
    "objectManifestId",
    "proposalId",
    "estimateId",
    "commercialWorkbookId",
    "workbookId",
    "repositoryType",
    "authority",
    "referenceOnly",
    "immutable",
  ];
  const missing = required.filter((field) => {
    const value = record?.[field];
    if (field === "referenceOnly" || field === "immutable") return value !== true;
    return !String(value ?? "").trim();
  });
  if (missing.length) {
    const error = new Error(`Engineering Baseline repository verification failed: missing ${missing.join(", ")}`);
    error.status = 409;
    error.missingFields = missing;
    throw error;
  }
  if (record.repositoryType !== "ENGINEERING_BASELINE") {
    const error = new Error(`Engineering Baseline repository verification failed: repositoryType=${record.repositoryType}`);
    error.status = 409;
    throw error;
  }
  if (!record.referenceOnly || !record.immutable) {
    const error = new Error("Engineering Baseline repository verification failed: referenceOnly/immutable flags are not true");
    error.status = 409;
    throw error;
  }
  return true;
}

export async function resolveEngineeringBaselineReferences(baselineRecord) {
  const record = normalizeEngineeringBaseline(baselineRecord);
  const [opportunity, rawDraftIofPackage, routeRepository, proposal, commercialReleasePackage] = await Promise.all([
    record.opportunityId ? loadRecord(DIRS.commercialOpportunities, record.opportunityId).catch(() => null) : null,
    record.draftIOFPackageId ? loadRecord(DIRS.iofPackages, record.draftIOFPackageId).catch(() => null) : null,
    record.routeRepositoryId ? loadRecord(DIRS.commercialRoutes, record.routeRepositoryId).catch(() => null) : null,
    record.proposalId ? loadRecord(DIRS.proposalDrafts, record.proposalId).catch(() => null) : null,
    record.commercialReleasePackageId ? loadRecord(DIRS.commercialReleasePackages, record.commercialReleasePackageId).catch(() => null) : null,
  ]);
  const draftIofPackage = rawDraftIofPackage ? await hydrateIofProjectionArtifacts(rawDraftIofPackage) : null;
  const stationAuthority = asRecord(draftIofPackage?.stationAuthority);
  const draftStationAuthorityIds = referenceTextArray(
    stationAuthority.stationAuthorityIds,
    stationAuthority.stationAuthorityId,
    stationAuthority.authorityId,
  );
  const checks = {
    engineeringBaseline: Boolean(record.engineeringBaselineId && record.engineeringBaselineHash),
    immutable: record.immutable === true,
    referenceOnly: record.referenceOnly === true,
    draftIofPackage: Boolean(draftIofPackage),
    commercialReleasePackage: Boolean(record.commercialReleasePackageId && commercialReleasePackage),
    commercialRevision: Boolean(record.commercialRevisionId && record.commercialRevisionHash),
    routeRepository: Boolean(routeRepository && asArray(routeRepository.commercialGeometry).length > 1),
    stationProjection: Boolean(record.stationProjectionId && record.stationGraphId && asArray(record.stationAuthorityIds).length),
    objectManifest: Boolean(record.objectManifestId && (record.stationObjectManifestId || record.projectedObjectManifestId)),
    commercialProposal: Boolean(proposal),
    commercialWorkbook: workbookReferenceResolves(record.commercialWorkbookId, draftIofPackage, opportunity),
    commercialEstimate: estimateReferenceResolves(record.estimateId, draftIofPackage, opportunity),
    productDoctrine: Boolean(record.productDoctrineId),
    engineeringDoctrine: Boolean(record.engineeringDoctrineId),
    customerTwin: Boolean(record.customerTwinId),
    noCommercialMutation: record.noCommercialMutation === true,
    noScopeVersionCreation: record.noScopeVersionCreation === true,
    stationAuthorityIds: Boolean(asArray(record.stationAuthorityIds).length && draftStationAuthorityIds.some((id) => asArray(record.stationAuthorityIds).map(String).includes(String(id)))),
  };
  const missing = Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([key]) => key);
  return {
    ok: missing.length === 0,
    missing,
    checks,
    repositoryPaths: {
      engineeringBaseline: "server/data/engineering-baselines",
      commercialReleasePackage: "server/data/commercial-release-packages",
      draftIofPackage: "server/data/iof-packages",
      routeRepository: "server/data/commercial-routes",
      commercialProposal: "server/data/proposal-drafts",
      commercialWorkbook: "Commercial Workbook reference resolved from Opportunity/Draft IOF Package source",
      commercialEstimate: "Commercial Estimate reference resolved from Opportunity/Draft IOF Package source",
      stationProjection: "server/data/iof-packages/*.json#/stationIndexedGraph",
      objectManifest: "server/data/iof-packages/*.json#/stationObjectManifest + projectedObjectManifest",
    },
    resolvedAt: nowIso(),
    noRegeneration: true,
    noCommercialMutation: true,
    noScopeVersionCreation: true,
    resolved: {
      opportunity,
      draftIofPackage,
      routeRepository,
      proposal,
      commercialReleasePackage,
    },
  };
}

export async function EngineeringBaselineValidator(record = {}) {
  return resolveEngineeringBaselineReferences(record);
}

function engineeringBaselineRepositoryFile(engineeringBaselineId) {
  return recordPath(DIRS.engineeringBaselines, engineeringBaselineId);
}

function engineeringBaselineRepositoryFilename(engineeringBaselineId) {
  const filename = engineeringBaselineRepositoryFile(engineeringBaselineId);
  return filename.split(/[\\/]/).pop() ?? filename;
}

export async function persistEngineeringBaseline(record = {}, user = {}, options = {}) {
  const normalized = engineeringBaselineRecordForRepository({
    ...record,
    user,
    submittedBy: record.submittedBy ?? user.name,
    submittedById: record.submittedById ?? user.userId,
  });
  const existing = await loadRecord(DIRS.engineeringBaselines, normalized.engineeringBaselineId).catch(() => null);
  if (existing) {
    if (existing.engineeringBaselineHash !== normalized.engineeringBaselineHash) {
      const error = new Error(`Engineering Baseline ${normalized.engineeringBaselineId} already exists with different immutable references.`);
      error.status = 409;
      throw error;
    }
    return normalizeEngineeringBaseline(existing);
  }
  const integrity = await resolveEngineeringBaselineReferences(normalized);
  if (!integrity.ok && options.requireIntegrity !== false) {
    const error = new Error(`Engineering Baseline reference validation failed: ${integrity.missing.join(", ")}`);
    error.status = 409;
    error.referenceIntegrity = integrity;
    throw error;
  }
  const next = engineeringBaselineRecordForRepository({
    ...normalized,
    referenceIntegrity: {
      ok: integrity.ok,
      missing: integrity.missing,
      checks: integrity.checks,
      repositoryPaths: integrity.repositoryPaths,
      resolvedAt: integrity.resolvedAt,
      noRegeneration: true,
      noCommercialMutation: true,
      noScopeVersionCreation: true,
    },
  });
  assertReferenceOnlyEngineeringBaselinePayload(next);
  const repositoryFilename = engineeringBaselineRepositoryFilename(next.engineeringBaselineId);
  console.info("[EngineeringBaseline] persisting immutable intake", {
    engineeringBaselineId: next.engineeringBaselineId,
    engineeringBaselineHash: next.engineeringBaselineHash,
    repositoryPath: DIRS.engineeringBaselines,
    repositoryFilename,
  });
  await persistRecord(DIRS.engineeringBaselines, next.engineeringBaselineId, next);
  const reloaded = await loadRecord(DIRS.engineeringBaselines, next.engineeringBaselineId);
  verifyEngineeringBaselineRepositoryRecord(reloaded);
  return normalizeEngineeringBaseline(reloaded);
}

export async function loadEngineeringBaseline(engineeringBaselineId) {
  return normalizeEngineeringBaseline(await loadRecord(DIRS.engineeringBaselines, engineeringBaselineId));
}

export async function findEngineeringBaselineForDraft(draftIofPackageId) {
  const records = await listRecords(DIRS.engineeringBaselines);
  const match = records.find((record) => String(record.draftIOFPackageId ?? record.draftIofPackageId ?? record.DraftIOFPackageId ?? "") === String(draftIofPackageId));
  return match ? normalizeEngineeringBaseline(match) : null;
}

export async function listEngineeringBaselines() {
  return sortedByUpdated((await listRecords(DIRS.engineeringBaselines)).map(normalizeEngineeringBaseline));
}

export async function handleEngineeringBaselines(req, res, pathname) {
  const parts = routeParts(pathname);
  if (!parts) return false;
  if (handleOptions(req, res)) return true;

  const readOnly = req.method === "GET";
  const user = readOnly
    ? requireAnyPermission(req, res, ["workspace.engineering.read", "workspace.engineering.write", "workspace.commercial", "proposal.read"], "You do not have authority to read Engineering Baselines.")
    : requireAnyPermission(req, res, ["workspace.commercial", "workspace.proposal", "proposal.manage", "workspace.engineering.write"], "You do not have authority to write Engineering Baselines.");
  if (!user) return true;

  if (req.method === "GET" && parts.length === 0) {
    jsonResponse(res, 200, { engineeringBaselines: await listEngineeringBaselines(), authority: EngineeringBaselineAuthority });
    return true;
  }

  if (req.method === "GET" && parts[0]) {
    const record = await loadEngineeringBaseline(parts[0]).catch(() => null);
    if (!record) errorResponse(res, 404, `Engineering Baseline not found: ${parts[0]}`);
    else jsonResponse(res, 200, {
      engineeringBaseline: record,
      engineeringBaselineManifest: EngineeringBaselineManifest(record),
      engineeringBaselineProjection: EngineeringBaselineProjection(record),
      authority: EngineeringBaselineAuthority,
    });
    return true;
  }

  if (req.method === "POST" && parts.length === 0) {
    const { body } = await readRequestJsonWithRaw(req);
    const input = unwrapBody(body, "engineeringBaseline", ["baseline", "items", "data"]) ?? {};
    try {
      const record = await persistEngineeringBaseline(input, user);
      jsonResponse(res, 201, {
        engineeringBaseline: record,
        engineeringBaselineManifest: EngineeringBaselineManifest(record),
        engineeringBaselineProjection: EngineeringBaselineProjection(record),
        authority: EngineeringBaselineAuthority,
      });
    } catch (error) {
      jsonResponse(res, error.status ?? 500, {
        error: error.message ?? "Engineering Baseline save failed.",
        referenceIntegrity: error.referenceIntegrity,
        payloadAudit: error.payloadAudit,
      });
    }
    return true;
  }

  errorResponse(res, 405, "Unsupported Engineering Baseline request.");
  return true;
}
