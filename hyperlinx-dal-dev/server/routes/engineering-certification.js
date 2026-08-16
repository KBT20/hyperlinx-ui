import { createHash } from "node:crypto";
import {
  DIRS,
  createId,
  errorResponse,
  handleOptions,
  hydrateIofProjectionArtifacts,
  jsonResponse,
  listRecords,
  loadRecord,
  nowIso,
  persistIofProjectionArtifacts,
  persistRecord,
  readRequestJson,
  sortedByUpdated,
  stripIofProjectionArtifacts,
  unwrapBody,
} from "./_shared.js";
import { requireAnyPermission } from "./authority.js";
import {
  findEngineeringPackageForDraft,
  listEngineeringPackages,
  loadEngineeringPackage,
  resolveEngineeringPackageReferences,
  updateEngineeringPackageStatus,
} from "./engineering-packages.js";
import {
  engineeringChangeSetsForRevision,
  projectEngineeringRevisionFromChangeSets,
} from "./engineering-change-sets.js";
import {
  CertifiedIofPackageProjection,
  persistCertificationLedgerEntry,
} from "./certification-ledger.js";
import {
  requireExactEngineeringApprovalForCertification,
  resolveEngineeringApprovalContext,
} from "./engineering-approvals.js";
import { materializeCertifiedIofTwin } from "./twin-state.js";
import {
  commercialAuthorityDiagnosticsFrom,
  ensureCommercialRevisionForProposal,
  ensureCommercialReleasePackageForDraft,
} from "./commercial-revisions.js";
import { persistScopeVersion } from "./scopeversions.js";
import { updateRuntimeWorkspaceSession } from "./runtime-workspace-session.js";
import {
  createScopeVersionFromCertifiedPackage as createScopeVersionAuthority,
  markCertifiedPackagePromoted,
} from "../scopeversion-authority-engine.js";

const BASE_PATH = "/api/engineering/certification";
const CHECKLIST_KEYS = [
  "geometryComplete",
  "existingInventoryValidated",
  "customerDesignReviewed",
  "relationshipsValidated",
  "dependenciesValidated",
  "evidencePresent",
  "commercialAssumptionsReviewed",
  "unitQuantitiesVerified",
  "engineeringStandardsMet",
  "riskAccepted",
  "packageComplete",
];

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === "") return [];
  return [value];
}

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function unique(values) {
  return [...new Set(asArray(values).filter(Boolean).map(String))];
}

function stableIdPart(value, fallback = "UNKNOWN") {
  return String(value ?? fallback)
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || fallback;
}

function numeric(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function firstText(...values) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function sharedOpportunityMapProjection(routeRepository) {
  const route = asRecord(routeRepository);
  const coordinates = asArray(route.commercialGeometry)
    .map((item) => asArray(item).slice(0, 2).map(Number))
    .filter((item) => item.length === 2 && item.every(Number.isFinite));
  const routeRepositoryId = firstText(route.routeRepositoryId, route.routeSnapshotId);
  if (!routeRepositoryId || coordinates.length < 2) return null;
  const endpointAuthority = asRecord(route.endpointAuthority);
  const normalizeEndpoint = (value, fallback, role) => {
    const source = asRecord(value);
    const site = asRecord(source.site);
    const candidate = asArray(source.coordinate).length >= 2
      ? asArray(source.coordinate).slice(0, 2).map(Number)
      : asArray(site.coordinate).length >= 2
        ? asArray(site.coordinate).slice(0, 2).map(Number)
        : fallback;
    if (!candidate || candidate.length !== 2 || !candidate.every(Number.isFinite)) return null;
    return {
      role,
      label: firstText(source.label, source.siteName, site.name, `${role} endpoint`),
      coordinate: candidate,
      coordinateSource: firstText(source.coordinateSource, site.coordinateSource, "COMMERCIAL_ROUTE_REPOSITORY"),
    };
  };
  return {
    authority: "COMMERCIAL_ROUTE_REPOSITORY",
    projectionPurpose: "SHARED_OPPORTUNITY_MAP",
    opportunityId: firstText(route.opportunityId),
    routeRepositoryId,
    routeRevision: Math.max(1, numeric(route.routeRevision, 1)),
    routeGeometryId: firstText(route.routeGeometryId, `${routeRepositoryId}:geometry`),
    geometryHash: firstText(route.geometryHash),
    orientation: firstText(endpointAuthority.orientation, endpointAuthority.commercialOrientation, "A_TO_Z"),
    coordinates,
    endpoints: [
      normalizeEndpoint(endpointAuthority.aSite ?? route.aLocation, coordinates[0], "A"),
      normalizeEndpoint(endpointAuthority.zSite ?? route.zLocation, coordinates.at(-1), "Z"),
    ].filter(Boolean),
    responseProjectionOnly: true,
    noPersistenceMutation: true,
    noRouteRegeneration: true,
  };
}

function routeParts(pathname) {
  if (pathname === BASE_PATH || pathname === `${BASE_PATH}/`) return [];
  if (!pathname.startsWith(`${BASE_PATH}/`)) return null;
  return pathname.slice(BASE_PATH.length + 1).split("/").filter(Boolean).map(decodeURIComponent);
}

function firstBodyRecord(body, key) {
  return unwrapBody(body, key, ["payload", "data", "item"]) ?? {};
}

function unitSourceId(unit = {}, index = 0) {
  return String(
    unit.unitId ??
    unit.iofUnitId ??
    unit.objectId ??
    unit.runtimeObjectId ??
    unit.sourceRuntimeObjectId ??
    unit.id ??
    `unit-${index + 1}`,
  );
}

function normalizeUnit(unit = {}, packageId, index = 0) {
  const timestamp = nowIso();
  const unitId = unitSourceId(unit, index);
  const runtimeObjectIds = unique([
    ...asArray(unit.runtimeObjectIds),
    unit.runtimeObjectId,
    unit.sourceRuntimeObjectId,
  ]);
  return {
    ...unit,
    unitId: String(unit.unitId ?? unit.iofUnitId ?? `${packageId}:unit:${String(index + 1).padStart(3, "0")}`),
    sourceUnitId: unitId,
    unitType: String(unit.unitType ?? unit.objectType ?? unit.type ?? "IOF_UNIT"),
    name: String(unit.name ?? unit.label ?? unit.objectName ?? unitId),
    status: String(unit.status ?? unit.unitStatus ?? "PROPOSED"),
    sourceRuntimeObjectId: unit.sourceRuntimeObjectId ?? unit.runtimeObjectId ?? runtimeObjectIds[0] ?? "",
    runtimeObjectIds,
    runtimeRelationshipIds: unique(asArray(unit.runtimeRelationshipIds ?? unit.relationshipIds)),
    runtimeEvidenceIds: unique(asArray(unit.runtimeEvidenceIds ?? unit.evidenceIds)),
    geometryReferences: unique(asArray(unit.geometryReferences ?? unit.geometryIds)),
    dependencyIds: unique(asArray(unit.dependencyIds ?? unit.dependencies)),
    quantity: numeric(unit.quantity, numeric(unit.commercialQuantity, 1)),
    commercialQuantity: numeric(unit.commercialQuantity, numeric(unit.quantity, 1)),
    historicalQuantity: numeric(unit.historicalQuantity, 0),
    marketplaceAdvisory: String(unit.marketplaceAdvisory ?? "NOT_REQUESTED"),
    engineeringQuantity: numeric(unit.engineeringQuantity, unit.status === "CERTIFIED" ? numeric(unit.quantity, 1) : 0),
    confidence: numeric(unit.confidence, numeric(unit.commercialConfidence, numeric(unit.engineeringConfidence, 0))),
    commercialConfidence: numeric(unit.commercialConfidence, numeric(unit.confidence, 0)),
    engineeringDecision: String(unit.engineeringDecision ?? (unit.status === "CERTIFIED" ? "CERTIFIED" : "PENDING_ENGINEERING_REVIEW")),
    engineeringNote: unit.engineeringNote ?? "",
    engineeringConfidence: numeric(unit.engineeringConfidence, 0),
    engineeringRisk: unit.engineeringRisk ?? "UNREVIEWED",
    engineeringComments: asArray(unit.engineeringComments),
    immutable: Boolean(unit.immutable),
    createdAt: String(unit.createdAt ?? timestamp),
    updatedAt: String(unit.updatedAt ?? timestamp),
  };
}

function proposedUnitsForPackage(raw = {}) {
  const candidates = [
    raw.proposedIofUnits,
    raw.iofUnits,
    raw.certifiedIofUnits,
    raw.objects,
  ].find(Array.isArray) ?? [];
  return candidates.map((unit, index) => normalizeUnit(unit, raw.packageId ?? raw.draftPackageId ?? "draft-iof", index));
}

function normalizeDraftPackage(raw = {}) {
  const timestamp = nowIso();
  const packageId = String(raw.packageId ?? raw.draftPackageId ?? createId("draft-iof-package"));
  const proposedIofUnits = proposedUnitsForPackage({ ...raw, packageId });
  const status = String(raw.status ?? "DRAFT");
  const packageInput = { ...raw, packageId, status, proposedIofUnits };
  const packageReadiness = packageReadinessFor(packageInput);
  const validation = buildPackageValidation({ ...packageInput, packageReadiness });
  const manifest = buildPackageManifest({ ...packageInput, packageReadiness, validation });
  const dependencyGraph = buildPackageDependencyGraph({ ...packageInput, packageReadiness, validation, manifest });
  const packageDifferences = raw.packageDifferences ?? buildPackageDifferences(packageInput);
  const averageEngineeringConfidence = proposedIofUnits.length
    ? Math.round(proposedIofUnits.reduce((sum, unit) => sum + numeric(unit.engineeringConfidence), 0) / proposedIofUnits.length)
    : 0;
  return {
    ...raw,
    packageId,
    draftPackageId: String(raw.draftPackageId ?? packageId),
    packageName: String(raw.packageName ?? raw.name ?? `Draft IOF Package ${raw.proposalSummary?.proposalNumber ?? raw.proposalId ?? packageId}`),
    packageType: raw.packageType ?? "ENGINEERING",
    status,
    workflowStatus: raw.workflowStatus ?? (status === "RETURNED_TO_COMMERCIAL" ? "RETURNED_TO_COMMERCIAL" : "ENGINEERING_REVIEW"),
    organizationId: String(raw.organizationId ?? raw.organization ?? ""),
    workspaceId: String(raw.workspaceId ?? raw.workspace ?? ""),
    ownerId: String(raw.ownerId ?? raw.createdById ?? ""),
    owner: String(raw.owner ?? raw.createdBy ?? ""),
    visibility: String(raw.visibility ?? "ORGANIZATION"),
    authority: String(raw.authority ?? "ENGINEERING_REVIEW"),
    lifecycleState: String(raw.lifecycleState ?? (status === "CERTIFIED" ? "CERTIFIED" : "IN_REVIEW")),
    packageReadiness,
    manifest,
    dependencyGraph,
    validation,
    packageDifferences,
    proposalId: String(raw.proposalId ?? raw.sourceProposalId ?? ""),
    proposalRevisionId: String(raw.proposalRevisionId ?? ""),
    proposalRevisionNumber: numeric(raw.proposalRevisionNumber, numeric(raw.sourceProposalVersion, 0)),
    proposalHash: String(raw.proposalHash ?? ""),
    sourceProposalVersion: numeric(raw.sourceProposalVersion, numeric(raw.proposalRevisionNumber, 0)),
    customerId: String(raw.customerId ?? raw.accountId ?? ""),
    accountId: String(raw.accountId ?? raw.proposalSummary?.accountId ?? raw.customerSummary?.accountId ?? (raw.customerId === "customer-google" ? "google" : raw.customerId ?? "")),
    opportunityId: String(raw.opportunityId ?? ""),
    productId: String(raw.productId ?? raw.proposalSummary?.productId ?? raw.commercialSummary?.productId ?? ""),
    productName: String(raw.productName ?? raw.proposalSummary?.productName ?? raw.commercialSummary?.productName ?? ""),
    fulfillmentPlanId: String(raw.fulfillmentPlanId ?? raw.proposalSummary?.fulfillmentPlanId ?? raw.commercialSummary?.fulfillmentPlanId ?? ""),
    fulfillmentStrategy: String(raw.fulfillmentStrategy ?? raw.proposalSummary?.fulfillmentStrategy ?? raw.commercialSummary?.fulfillmentStrategy ?? ""),
    fulfillmentPlan: raw.fulfillmentPlan ?? raw.commercialSummary?.fulfillmentPlan ?? null,
    fulfillmentMix: asArray(raw.fulfillmentMix ?? raw.commercialSummary?.fulfillmentMix ?? raw.fulfillmentPlan?.fulfillmentMix),
    assignedEngineerId: String(raw.assignedEngineerId ?? raw.engineerId ?? ""),
    assignedEngineer: String(raw.assignedEngineer ?? raw.engineerName ?? ""),
    priority: raw.priority ?? "NORMAL",
    submittedAt: raw.submittedAt ?? raw.createdAt ?? timestamp,
    proposalSummary: raw.proposalSummary ?? {},
    commercialSummary: raw.commercialSummary ?? {},
    customerSummary: raw.customerSummary ?? {},
    proposalRecipientContactIds: unique(asArray(raw.proposalRecipientContactIds ?? raw.proposalSummary?.proposalRecipientContactIds ?? raw.customerSummary?.proposalRecipientContactIds)),
    customerReviewContactIds: unique(asArray(raw.customerReviewContactIds ?? raw.proposalSummary?.customerReviewContactIds ?? raw.customerSummary?.customerReviewContactIds)),
    approvalAuthorityContactIds: unique(asArray(raw.approvalAuthorityContactIds ?? raw.proposalSummary?.approvalAuthorityContactIds ?? raw.customerSummary?.approvalAuthorityContactIds)),
    sofRecipientContactIds: unique(asArray(raw.sofRecipientContactIds ?? raw.proposalSummary?.sofRecipientContactIds ?? raw.customerSummary?.sofRecipientContactIds)),
    customerContactEmails: unique(asArray(raw.customerContactEmails ?? raw.proposalSummary?.customerContactEmails ?? raw.customerSummary?.customerContactEmails)),
    engineeringReadiness: raw.engineeringReadiness ?? packageReadiness.status,
    commercialConfidence: numeric(raw.commercialConfidence, numeric(raw.confidence, 0)),
    engineeringConfidence: numeric(raw.engineeringConfidence, averageEngineeringConfidence),
    assemblyConfidence: numeric(raw.assemblyConfidence, numeric(packageReadiness.readinessScore, 0)),
    packageCompleteness: numeric(raw.packageCompleteness, numeric(packageReadiness.packageCompleteness, packageReadiness.readinessScore)),
    certificationProgress: numeric(raw.certificationProgress, packageReadiness.certificationPercent),
    packageRevision: numeric(raw.packageRevision, numeric(raw.revision, 1)),
    assemblyReport: raw.assemblyReport ?? {},
    proposedIofUnits,
    route: asArray(raw.route),
    stations: asArray(raw.stations),
    structures: asArray(raw.structures),
    dependencies: asArray(raw.dependencies),
    objects: asArray(raw.objects),
    relationships: asArray(raw.relationships),
    evidence: asArray(raw.evidence),
    engineeringConstraints: asArray(raw.engineeringConstraints ?? raw.constraints),
    objectMoveHistory: asArray(raw.objectMoveHistory),
    redlineRevisionHistory: asArray(raw.redlineRevisionHistory),
    doctrineExceptions: asArray(raw.doctrineExceptions),
    engineeringRevisionMetadata: asArray(raw.engineeringRevisionMetadata),
    proposalDocumentReferences: unique(asArray(raw.proposalDocumentReferences)),
    customerRequests: asArray(raw.customerRequests),
    commercialNotes: asArray(raw.commercialNotes),
    engineeringNotes: asArray(raw.engineeringNotes),
    engineeringRequirements: asArray(raw.engineeringRequirements),
    historyIds: unique(asArray(raw.historyIds)),
    runtimeObjectIds: unique(asArray(raw.runtimeObjectIds)),
    runtimeRelationshipIds: unique(asArray(raw.runtimeRelationshipIds)),
    runtimeEvidenceIds: unique(asArray(raw.runtimeEvidenceIds)),
    existingInventoryReferences: unique(asArray(raw.existingInventoryReferences)),
    customerDesignReferences: unique(asArray(raw.customerDesignReferences)),
    partnerInventoryReferences: unique(asArray(raw.partnerInventoryReferences)),
    marketplaceAssetReferences: unique(asArray(raw.marketplaceAssetReferences)),
    newInfrastructureRequired: unique(asArray(raw.newInfrastructureRequired)),
    customerTwinReference: String(raw.customerTwinReference ?? ""),
    geometryReferences: unique(asArray(raw.geometryReferences)),
    createdAt: String(raw.createdAt ?? timestamp),
    updatedAt: String(raw.updatedAt ?? timestamp),
    noMarketplaceCreation: true,
    noContractCreation: true,
    noSofCreation: true,
    noSowCreation: true,
  };
}

function packageReadinessFor(record = {}) {
  const units = asArray(record.proposedIofUnits);
  const certifiedUnits = units.filter((unit) => unit?.status === "CERTIFIED").length;
  const runtimeObjectIds = unique([
    ...asArray(record.runtimeObjectIds),
    ...units.flatMap((unit) => asArray(unit?.runtimeObjectIds)),
    ...units.map((unit) => unit?.sourceRuntimeObjectId),
  ]);
  const geometryReferences = unique([
    ...asArray(record.geometryReferences),
    ...units.flatMap((unit) => asArray(unit?.geometryReferences)),
  ]);
  const relationshipIds = unique([
    ...asArray(record.runtimeRelationshipIds),
    ...units.flatMap((unit) => asArray(unit?.runtimeRelationshipIds)),
  ]);
  const evidenceIds = unique([
    ...asArray(record.runtimeEvidenceIds),
    ...units.flatMap((unit) => asArray(unit?.runtimeEvidenceIds)),
  ]);
  const dependencyIds = unique([
    ...asArray(record.dependencies).map((dependency) => typeof dependency === "object" ? dependency.dependencyId ?? dependency.id : dependency),
    ...units.flatMap((unit) => asArray(unit?.dependencyIds)),
  ]);
  const hasValidation = record.validation?.status === "PASS" || Boolean(record.proposalId && units.length && (geometryReferences.length || runtimeObjectIds.length));
  const missingGeometry = !geometryReferences.length;
  const missingInventory = !asArray(record.existingInventoryReferences).length;
  const missingRelationships = !relationshipIds.length;
  const missingEvidence = !evidenceIds.length && !asArray(record.evidence).length;
  const missingUnits = !units.length;
  const missingEngineeringReview = units.some((unit) => !["CERTIFIED", "REJECTED", "MODIFIED", "APPROVED"].includes(String(unit?.status ?? "")));
  const missingValidation = !hasValidation;
  const missing = [];
  if (!record.proposalId) missing.push("Proposal reference");
  if (!record.customerId) missing.push("Customer");
  if (!record.opportunityId) missing.push("Opportunity");
  if (missingUnits) missing.push("Proposed IOF Units");
  if (!runtimeObjectIds.length && missingGeometry) missing.push("Runtime object or geometry references");
  if (missingGeometry) missing.push("Geometry");
  if (missingInventory) missing.push("Existing Inventory");
  if (missingRelationships) missing.push("Relationships");
  if (missingEvidence) missing.push("Evidence");
  if (missingEngineeringReview) missing.push("Engineering Review");
  if (missingValidation) missing.push("Validation");
  const checks = [
    Boolean(record.proposalId),
    Boolean(record.customerId),
    Boolean(record.opportunityId),
    !missingUnits,
    Boolean(runtimeObjectIds.length || geometryReferences.length),
    !missingGeometry,
    !missingInventory,
    !missingRelationships,
    !missingEvidence,
    !missingEngineeringReview,
    !missingValidation,
  ];
  const readinessScore = Math.round((checks.filter(Boolean).length / checks.length) * 100);
  return {
    status: missing.filter((item) => !["Engineering Review", "Validation"].includes(item)).length
      ? "INCOMPLETE"
      : certifiedUnits === units.length && units.length
        ? "READY_FOR_PACKAGE_CERTIFICATION"
        : "READY_FOR_ENGINEERING_REVIEW",
    missingInformation: missing,
    missingGeometry,
    missingInventory,
    missingRelationships,
    missingEvidence,
    missingUnits,
    missingEngineeringReview,
    missingValidation,
    dependencyCount: dependencyIds.length,
    readinessScore,
    packageCompleteness: readinessScore,
    proposedUnitCount: units.length,
    certifiedUnitCount: certifiedUnits,
    certificationPercent: units.length ? Math.round((certifiedUnits / units.length) * 100) : 0,
  };
}

function entryId(value, fallback) {
  if (value && typeof value === "object") {
    return String(value.objectId ?? value.runtimeObjectId ?? value.relationshipId ?? value.evidenceId ?? value.geometryId ?? value.stationId ?? value.structureId ?? value.dependencyId ?? value.documentId ?? value.id ?? fallback);
  }
  return String(value ?? fallback);
}

function entryLabel(value, fallback) {
  if (value && typeof value === "object") {
    return String(value.name ?? value.label ?? value.title ?? value.objectName ?? value.summary ?? value.description ?? entryId(value, fallback));
  }
  return String(value ?? fallback);
}

function entryMetadata(value = {}, metadata = {}) {
  return {
    ...(value && typeof value === "object" ? value : {}),
    ...metadata,
  };
}

function manifestEntry(kind, value, index, record, metadata = {}) {
  const id = entryId(value, `${kind}-${index + 1}`);
  const runtimeObjectIds = unique([
    ...asArray(metadata.runtimeObjectIds),
    ...(kind === "objects" ? [id] : []),
    ...asArray(record.runtimeObjectIds),
    record.proposalId,
  ]);
  return {
    manifestEntryId: `${record.packageId ?? "draft-iof"}:${kind}:${id}`.replace(/\s+/g, "-"),
    entryType: kind,
    objectId: id,
    objectType: String(metadata.objectType ?? kind.toUpperCase()),
    label: entryLabel(value, id),
    runtimeObjectIds,
    source: String(metadata.source ?? "RUNTIME_REFERENCE"),
    authority: String(metadata.authority ?? record.authority ?? "ENGINEERING_REVIEW"),
    lifecycle: String(metadata.lifecycle ?? record.lifecycleState ?? "IN_REVIEW"),
    duplicated: false,
    metadata: entryMetadata(value, metadata),
  };
}

function manifestEntries(kind, values, record, metadata = {}) {
  return unique(asArray(values).map((value, index) => entryId(value, `${kind}-${index + 1}`)))
    .map((id, index) => {
      const value = asArray(values).find((candidate, candidateIndex) => entryId(candidate, `${kind}-${candidateIndex + 1}`) === id) ?? id;
      return manifestEntry(kind, value, index, record, metadata);
    });
}

function packageUnitIds(record = {}) {
  return asArray(record.proposedIofUnits).map((unit, index) => unit?.unitId ?? `${record.packageId}:unit:${index + 1}`);
}

function buildPackageManifest(record = {}) {
  const units = asArray(record.proposedIofUnits);
  const runtimeObjectIds = unique([
    ...asArray(record.runtimeObjectIds),
    ...units.flatMap((unit) => asArray(unit?.runtimeObjectIds)),
    ...units.map((unit) => unit?.sourceRuntimeObjectId),
  ]);
  const relationshipIds = unique([
    ...asArray(record.runtimeRelationshipIds),
    ...units.flatMap((unit) => asArray(unit?.runtimeRelationshipIds)),
  ]);
  const geometryReferences = unique([
    ...asArray(record.geometryReferences),
    ...units.flatMap((unit) => asArray(unit?.geometryReferences)),
  ]);
  const evidenceIds = unique([
    ...asArray(record.runtimeEvidenceIds),
    ...units.flatMap((unit) => asArray(unit?.runtimeEvidenceIds)),
  ]);
  const dependencyIds = unique([
    ...asArray(record.dependencies).map((dependency, index) => entryId(dependency, `dependency-${index + 1}`)),
    ...units.flatMap((unit) => asArray(unit?.dependencyIds)),
  ]);
  const structures = asArray(record.structures).length ? asArray(record.structures) : asArray(record.objects).filter((item) => item?.objectType === "STRUCTURE" || item?.classification === "STRUCTURE");
  const commercialAssumptions = asArray(record.commercialSummary?.commercialAssumptionIds);
  const customerRequests = [
    ...asArray(record.customerDesignReferences),
    ...asArray(record.customerRequests).map((request, index) => entryId(request, `customer-request-${index + 1}`)),
  ];
  const engineeringRequirements = asArray(record.engineeringRequirements).length ? asArray(record.engineeringRequirements) : CHECKLIST_KEYS;
  const manifest = {
    manifestId: `MANIFEST-${record.packageId ?? "DRAFT-IOF"}`,
    packageId: record.packageId,
    proposalId: record.proposalId,
    organizationId: record.organizationId,
    workspaceId: record.workspaceId,
    generatedAt: nowIso(),
    modelVersion: "IOF_PACKAGE_MANIFEST_V1",
    duplicationPolicy: "REFERENCE_ONLY_RUNTIME_OBJECTS",
    objects: manifestEntries("objects", runtimeObjectIds, record, { source: "PROPOSAL_RUNTIME_OBJECTS", objectType: "RUNTIME_OBJECT" }),
    relationships: manifestEntries("relationships", relationshipIds, record, { source: "RELATIONSHIP_GRAPH", objectType: "RUNTIME_RELATIONSHIP" }),
    inventory: manifestEntries("inventory", record.existingInventoryReferences, record, { source: "CUSTOMER_INVENTORY", objectType: "CUSTOMER_INVENTORY_REFERENCE" }),
    geometry: manifestEntries("geometry", geometryReferences, record, { source: "GEOMETRY_REFERENCE", objectType: "GEOMETRY_REFERENCE" }),
    stations: manifestEntries("stations", record.stations, record, { source: "STATION_REFERENCE", objectType: "STATION" }),
    structures: manifestEntries("structures", structures, record, { source: "STRUCTURE_REFERENCE", objectType: "STRUCTURE" }),
    dependencies: manifestEntries("dependencies", dependencyIds, record, { source: "PACKAGE_DEPENDENCY", objectType: "DEPENDENCY", runtimeObjectIds }),
    evidence: manifestEntries("evidence", evidenceIds, record, { source: "EVIDENCE_REGISTRY", objectType: "EVIDENCE" }),
    documents: manifestEntries("documents", record.proposalDocumentReferences, record, { source: "PROPOSAL_DOCUMENTS", objectType: "DOCUMENT" }),
    commercialAssumptions: manifestEntries("commercialAssumptions", commercialAssumptions, record, { source: "COMMERCIAL_SUMMARY", objectType: "COMMERCIAL_ASSUMPTION" }),
    customerRequests: manifestEntries("customerRequests", customerRequests, record, { source: "CUSTOMER_DESIGN_REQUEST", objectType: "CUSTOMER_REQUEST" }),
    engineeringRequirements: manifestEntries("engineeringRequirements", engineeringRequirements, record, { source: "ENGINEERING_CHECKLIST", objectType: "ENGINEERING_REQUIREMENT", runtimeObjectIds }),
  };
  manifest.counts = Object.fromEntries(
    Object.entries(manifest)
      .filter(([, value]) => Array.isArray(value))
      .map(([key, value]) => [key, value.length]),
  );
  manifest.summary = {
    runtimeObjectCount: manifest.objects.length,
    relationshipCount: manifest.relationships.length,
    inventoryCount: manifest.inventory.length,
    geometryCount: manifest.geometry.length,
    evidenceCount: manifest.evidence.length,
    unitCount: units.length,
    unitIds: packageUnitIds(record),
    noDuplicateObjects: true,
  };
  return manifest;
}

function graphNode(id, type, label, metadata = {}) {
  return { id, type, label, metadata };
}

function graphEdge(from, to, relationship, metadata = {}) {
  return { edgeId: `${from}->${to}:${relationship}`.replace(/\s+/g, "-"), from, to, relationship, metadata };
}

function buildPackageDependencyGraph(record = {}) {
  const units = asArray(record.proposedIofUnits);
  const runtimeObjectIds = unique([
    ...asArray(record.runtimeObjectIds),
    ...units.flatMap((unit) => asArray(unit?.runtimeObjectIds)),
    ...units.map((unit) => unit?.sourceRuntimeObjectId),
  ]);
  const relationshipIds = unique([
    ...asArray(record.runtimeRelationshipIds),
    ...units.flatMap((unit) => asArray(unit?.runtimeRelationshipIds)),
  ]);
  const evidenceIds = unique([
    ...asArray(record.runtimeEvidenceIds),
    ...units.flatMap((unit) => asArray(unit?.runtimeEvidenceIds)),
  ]);
  const geometryReferences = unique([
    ...asArray(record.geometryReferences),
    ...units.flatMap((unit) => asArray(unit?.geometryReferences)),
  ]);
  const proposalNodeId = record.proposalId || `${record.packageId}:proposal`;
  const packageNodeId = record.packageId || "draft-iof-package";
  const nodes = [
    graphNode(proposalNodeId, "Proposal", record.proposalSummary?.proposalNumber ?? record.proposalId ?? "Proposal", { runtimeObject: true }),
    ...runtimeObjectIds.map((id) => graphNode(id, "RuntimeObject", id, { runtimeObject: true })),
    ...relationshipIds.map((id) => graphNode(id, "Relationship", id)),
    ...units.map((unit) => graphNode(unit.unitId, "ProposedIOFUnit", unit.name ?? unit.unitId, { status: unit.status })),
    ...evidenceIds.map((id) => graphNode(id, "Evidence", id)),
    ...geometryReferences.map((id) => graphNode(id, "Geometry", id)),
    graphNode(packageNodeId, "DraftIOFPackage", record.packageName ?? record.packageId ?? "Draft IOF Package", { status: record.status }),
  ];
  const edges = [];
  for (const objectId of runtimeObjectIds) edges.push(graphEdge(proposalNodeId, objectId, "REFERENCES_RUNTIME_OBJECT"));
  for (const relationshipId of relationshipIds) {
    const objectTargets = runtimeObjectIds.length ? runtimeObjectIds : [proposalNodeId];
    for (const objectId of objectTargets) edges.push(graphEdge(objectId, relationshipId, "RELATIONSHIP_CONTEXT"));
  }
  for (const unit of units) {
    const relationshipTargets = unit.runtimeRelationshipIds?.length ? unit.runtimeRelationshipIds : relationshipIds;
    const objectTargets = unit.runtimeObjectIds?.length ? unit.runtimeObjectIds : runtimeObjectIds;
    if (relationshipTargets.length) {
      for (const relationshipId of relationshipTargets) edges.push(graphEdge(relationshipId, unit.unitId, "ASSEMBLES_UNIT"));
    } else {
      for (const objectId of objectTargets.length ? objectTargets : [proposalNodeId]) edges.push(graphEdge(objectId, unit.unitId, "ASSEMBLES_UNIT"));
    }
    const unitEvidence = unit.runtimeEvidenceIds?.length ? unit.runtimeEvidenceIds : evidenceIds;
    const unitGeometry = unit.geometryReferences?.length ? unit.geometryReferences : geometryReferences;
    if (unitEvidence.length) {
      for (const evidenceId of unitEvidence) edges.push(graphEdge(unit.unitId, evidenceId, "SUPPORTED_BY_EVIDENCE"));
      for (const evidenceId of unitEvidence) {
        for (const geometryId of unitGeometry) edges.push(graphEdge(evidenceId, geometryId, "EVIDENCE_LOCATES_GEOMETRY"));
      }
    } else {
      for (const geometryId of unitGeometry) edges.push(graphEdge(unit.unitId, geometryId, "USES_GEOMETRY"));
    }
    if (unitGeometry.length) {
      for (const geometryId of unitGeometry) edges.push(graphEdge(geometryId, packageNodeId, "PACKAGED_IN_DRAFT_IOF"));
    } else {
      edges.push(graphEdge(unit.unitId, packageNodeId, "PACKAGED_IN_DRAFT_IOF"));
    }
  }
  const uniqueNodes = [...new Map(nodes.map((node) => [node.id, node])).values()];
  const uniqueEdges = [...new Map(edges.map((edge) => [edge.edgeId, edge])).values()];
  return {
    graphId: `GRAPH-${record.packageId ?? "DRAFT-IOF"}`,
    packageId: record.packageId,
    generatedAt: nowIso(),
    path: "Proposal -> Runtime Objects -> Relationships -> Units -> Evidence -> Geometry -> Draft IOF Package",
    nodes: uniqueNodes,
    edges: uniqueEdges,
    summary: {
      nodeCount: uniqueNodes.length,
      edgeCount: uniqueEdges.length,
      referenceOnly: true,
    },
  };
}

function buildPackageValidation(record = {}) {
  const readiness = record.packageReadiness ?? packageReadinessFor(record);
  const checks = [
    { key: "geometry", label: "Geometry", status: readiness.missingGeometry ? "FAIL" : "PASS" },
    { key: "inventory", label: "Existing Inventory", status: readiness.missingInventory ? "WARNING" : "PASS" },
    { key: "relationships", label: "Relationships", status: readiness.missingRelationships ? "WARNING" : "PASS" },
    { key: "evidence", label: "Evidence", status: readiness.missingEvidence ? "WARNING" : "PASS" },
    { key: "units", label: "Proposed IOF Units", status: readiness.missingUnits ? "FAIL" : "PASS" },
    { key: "engineeringReview", label: "Engineering Review", status: readiness.missingEngineeringReview ? "WARNING" : "PASS" },
    { key: "runtimeReferences", label: "Runtime References", status: asArray(record.runtimeObjectIds).length || asArray(record.geometryReferences).length ? "PASS" : "FAIL" },
  ];
  const hasFail = checks.some((check) => check.status === "FAIL");
  const hasWarning = checks.some((check) => check.status === "WARNING");
  return {
    validationId: `VALIDATION-${record.packageId ?? "DRAFT-IOF"}`,
    packageId: record.packageId,
    status: hasFail ? "FAIL" : hasWarning ? "WARNING" : "PASS",
    readinessScore: readiness.readinessScore,
    checks,
    validatedAt: nowIso(),
  };
}

function buildPackageDifferences(record = {}, proposal = null) {
  const proposalRuntimeObjectIds = unique(asArray(proposal?.runtimeObjectIds));
  const packageRuntimeObjectIds = unique(asArray(record.runtimeObjectIds));
  const proposalGeometryReferences = unique(asArray(proposal?.geometryReferences));
  const packageGeometryReferences = unique(asArray(record.geometryReferences));
  const proposalRelationshipIds = unique(asArray(proposal?.runtimeRelationshipIds));
  const packageRelationshipIds = unique(asArray(record.runtimeRelationshipIds));
  const addedObjects = proposal ? proposalRuntimeObjectIds.filter((id) => !packageRuntimeObjectIds.includes(id)) : [];
  const removedObjects = proposal ? packageRuntimeObjectIds.filter((id) => !proposalRuntimeObjectIds.includes(id)) : [];
  const addedGeometry = proposal ? proposalGeometryReferences.filter((id) => !packageGeometryReferences.includes(id)) : [];
  const removedGeometry = proposal ? packageGeometryReferences.filter((id) => !proposalGeometryReferences.includes(id)) : [];
  const addedRelationships = proposal ? proposalRelationshipIds.filter((id) => !packageRelationshipIds.includes(id)) : [];
  const removedRelationships = proposal ? packageRelationshipIds.filter((id) => !proposalRelationshipIds.includes(id)) : [];
  const modifiedUnits = asArray(record.proposedIofUnits)
    .filter((unit) => unit?.modifiedAt || !["PROPOSED", "CERTIFIED"].includes(String(unit?.status ?? "")) || numeric(unit?.engineeringQuantity) !== 0)
    .map((unit) => unit.unitId);
  const hasImpact = addedObjects.length || removedObjects.length || addedGeometry.length || removedGeometry.length || addedRelationships.length || removedRelationships.length || modifiedUnits.length;
  return {
    differenceId: `DIFF-${record.packageId ?? "DRAFT-IOF"}`,
    packageId: record.packageId,
    proposalId: record.proposalId,
    proposalVersion: proposal?.version ?? record.sourceProposalVersion ?? null,
    packageSourceProposalVersion: record.sourceProposalVersion ?? null,
    comparedAt: nowIso(),
    addedObjects,
    removedObjects,
    modifiedUnits,
    geometryChanges: { added: addedGeometry, removed: removedGeometry },
    relationshipChanges: { added: addedRelationships, removed: removedRelationships },
    engineeringImpact: hasImpact ? "ENGINEERING_REVIEW_REQUIRED" : "NO_IMPACT",
  };
}

function normalizeChecklist(input = {}) {
  const checklist = {};
  for (const key of CHECKLIST_KEYS) checklist[key] = Boolean(input[key]);
  checklist.certificationConfidence = numeric(input.certificationConfidence, 0);
  checklist.engineeringNotes = String(input.engineeringNotes ?? "");
  checklist.completedAt = input.completedAt ?? nowIso();
  return checklist;
}

function checklistComplete(checklist = {}) {
  return CHECKLIST_KEYS.every((key) => checklist[key] === true) && numeric(checklist.certificationConfidence) > 0;
}

function hashCertifiedAssembly(payload) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function routeRepositoryIdForPackage(record = {}) {
  return String(
    record.routeRepositoryId ??
      asRecord(record.routeRepositoryRef).routeRepositoryId ??
      asRecord(record.routeRepositorySnapshot).routeRepositoryId ??
      asRecord(record.commercialDraftSnapshot).routeRepositoryId ??
      asRecord(record.proposalSummary).routeRepositoryId ??
      "",
  );
}

function commercialEstimateForPackage(record = {}) {
  const commercialSummary = asRecord(record.commercialSummary);
  return {
    estimateId: String(record.estimateId ?? commercialSummary.estimateId ?? record.proposalId ?? record.packageId ?? ""),
    pricingSummary: asRecord(record.pricingSummary ?? commercialSummary.pricingSummary),
    marginSummary: asRecord(record.marginSummary ?? commercialSummary.marginSummary),
    confidenceSummary: asRecord(record.confidenceSummary ?? commercialSummary.confidenceSummary),
    routeMiles: numeric(record.routeMiles, numeric(commercialSummary.routeMiles, 0)),
    routeFeet: numeric(record.routeFeet, numeric(commercialSummary.routeFeet, 0)),
    source: "CERTIFIED_DRAFT_IOF_PACKAGE_COMMERCIAL_ESTIMATE_REFERENCE",
  };
}

function normalizeStationPlan(input = {}, draft = {}, user = {}, timestamp = nowIso()) {
  const plan = asRecord(input);
  const routeRepositoryId = routeRepositoryIdForPackage(draft);
  const stations = asArray(plan.stations).map((station, index) => {
    const record = asRecord(station);
    return {
      stationId: String(record.stationId ?? record.id ?? `${draft.packageId}:STATION:${String(index + 1).padStart(4, "0")}`),
      label: String(record.label ?? record.stationLabel ?? record.stationId ?? `STA-${String(index + 1).padStart(4, "0")}`),
      stationFeet: numeric(record.stationFeet ?? record.measureFeet ?? record.feet, index * 5280),
      milepost: numeric(record.milepost, numeric(record.stationFeet ?? record.measureFeet ?? record.feet, index * 5280) / 5280),
      coordinate: record.coordinate,
    };
  });
  const objectAssignments = asArray(plan.objectAssignments).map((assignment, index) => {
    const record = asRecord(assignment);
    return {
      objectId: String(record.objectId ?? `${draft.packageId}:OBJECT:${String(index + 1).padStart(3, "0")}`),
      objectType: String(record.objectType ?? "ENGINEERING_OBJECT"),
      stationId: String(record.stationId ?? ""),
      stationLabel: String(record.stationLabel ?? record.station ?? ""),
      stationRange: String(record.stationRange ?? ""),
      assignmentMethod: String(record.assignmentMethod ?? "MANUAL_CERTIFICATION_DEFAULT"),
    };
  });
  return {
    ...plan,
    stationPlanId: String(plan.stationPlanId ?? `STATION-PLAN-${draft.packageId}`),
    draftIofPackageId: String(plan.draftIofPackageId ?? draft.packageId ?? ""),
    opportunityId: String(plan.opportunityId ?? draft.opportunityId ?? ""),
    routeRepositoryId,
    stationIntervalFeet: numeric(plan.stationIntervalFeet, 5280),
    routeLengthFeet: numeric(plan.routeLengthFeet, numeric(draft.routeFeet, numeric(asRecord(draft.commercialSummary).routeFeet, 0))),
    generatedBy: String(plan.generatedBy ?? user.name ?? ""),
    generatedAt: String(plan.generatedAt ?? timestamp),
    certifiedBy: String(plan.certifiedBy ?? user.name ?? ""),
    certifiedAt: String(plan.certifiedAt ?? timestamp),
    status: "CERTIFIED",
    stations,
    objectAssignments,
    stationCount: numeric(plan.stationCount, stations.length || asArray(draft.stationAuthorityIds).length),
    objectAssignmentCount: numeric(plan.objectAssignmentCount, objectAssignments.length || asArray(asRecord(draft.projectedObjectManifest).projectedObjects).length),
    immutable: true,
    noScopeVersionCreation: true,
  };
}

function normalizeEngineeringApprovedObjectBudget(input = {}, draft = {}, user = {}, timestamp = nowIso()) {
  const budget = asRecord(input);
  const objectBudgets = asArray(budget.objectBudgets ?? budget.rows).map((item, index) => {
    const record = asRecord(item);
    return {
      objectId: String(record.objectId ?? `${draft.packageId}:OBJECT:${String(index + 1).padStart(3, "0")}`),
      objectType: String(record.objectType ?? "ENGINEERING_OBJECT"),
      stationReference: String(record.stationReference ?? record.station ?? ""),
      stationRange: String(record.stationRange ?? ""),
      commercialBudget: numeric(record.commercialBudget, 0),
      engineeringApprovedBudget: numeric(record.engineeringApprovedBudget, numeric(record.commercialBudget, 0)),
      confirmed: Boolean(record.confirmed),
      notes: String(record.notes ?? ""),
    };
  });
  const totalApprovedBudget = numeric(
    budget.totalApprovedBudget ?? budget.engineeringApprovedBudget,
    objectBudgets.reduce((sum, row) => sum + numeric(row.engineeringApprovedBudget), 0),
  );
  return {
    ...budget,
    budgetId: String(budget.budgetId ?? `ENG-BUDGET-${draft.packageId}`),
    draftIofPackageId: String(budget.draftIofPackageId ?? draft.packageId ?? ""),
    opportunityId: String(budget.opportunityId ?? draft.opportunityId ?? ""),
    routeRepositoryId: routeRepositoryIdForPackage(draft),
    approvedBy: String(budget.approvedBy ?? user.name ?? ""),
    approvedById: String(budget.approvedById ?? user.userId ?? ""),
    approvedAt: String(budget.approvedAt ?? timestamp),
    totalApprovedBudget,
    objectBudgets,
    allObjectsConfirmed: objectBudgets.length ? objectBudgets.every((row) => row.confirmed) : Boolean(budget.allObjectsConfirmed),
    immutable: true,
    noScopeVersionCreation: true,
  };
}

function runtimeHistoryEvent(record, user, eventType, details = "", metadata = {}) {
  const timestamp = nowIso();
  return {
    historyId: `runtime-history-${record.packageId ?? record.certifiedPackageId}-${eventType}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    eventType,
    actor: user.name,
    actorId: user.userId,
    objectType: "IOFPackage",
    objectId: record.packageId ?? record.certifiedPackageId,
    objectName: record.name ?? record.packageId ?? record.certifiedPackageId,
    accountId: record.accountId,
    customerId: record.customerId,
    organizationId: user.organizationId,
    workspaceId: user.workspaceId,
    timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
    details,
    metadata: {
      accountId: record.accountId,
      customerId: record.customerId,
      productId: record.productId,
      productName: record.productName,
      fulfillmentPlanId: record.fulfillmentPlanId,
      fulfillmentStrategy: record.fulfillmentStrategy,
      proposalRecipientContactIds: record.proposalRecipientContactIds,
      customerReviewContactIds: record.customerReviewContactIds,
      approvalAuthorityContactIds: record.approvalAuthorityContactIds,
      sofRecipientContactIds: record.sofRecipientContactIds,
      customerContactEmails: record.customerContactEmails,
      ...metadata,
    },
  };
}

async function appendHistory(record, user, eventType, details = "", metadata = {}) {
  const event = runtimeHistoryEvent(record, user, eventType, details, metadata);
  await persistRecord(DIRS.runtimeHistory, event.historyId, event);
  return event;
}

async function persistRuntimeMirror(record, user, type, sourceId, metadata = {}) {
  const timestamp = nowIso();
  const runtimeId = `RUNTIME-${type}-${sourceId}`.replace(/[^a-zA-Z0-9-]/g, "-").toUpperCase();
  await persistRecord(DIRS.runtimeObjects, runtimeId, {
    runtimeId,
    objectId: sourceId,
    objectType: type === "SCOPEVERSION" ? "SCOPE_VERSION" : "ENGINEERING",
    name: record.name ?? sourceId,
    owner: record.owner ?? user.name,
    ownerId: record.ownerId ?? user.userId,
    createdBy: record.createdBy ?? user.name,
    createdById: record.createdById ?? user.userId,
    assignedTo: unique([record.assignedEngineerId, user.userId]),
    organization: record.organizationId ?? user.organizationId,
    organizationId: record.organizationId ?? user.organizationId,
    workspace: record.workspaceId ?? user.workspaceId,
    workspaceId: record.workspaceId ?? user.workspaceId,
    accountId: record.accountId,
    customerId: record.customerId,
    visibility: "ORGANIZATION",
    authority: type === "SCOPEVERSION" ? "TERALINX_RUNTIME" : "ENGINEERING_REVIEW",
    lifecycleState: type === "DRAFT-IOF" ? "IN_REVIEW" : "APPROVED",
    version: 1,
    evidenceIds: unique(record.runtimeEvidenceIds ?? record.evidenceIds),
    evidenceLinks: unique(record.runtimeEvidenceIds ?? record.evidenceIds),
    relationshipIds: unique(record.runtimeRelationshipIds ?? record.relationshipIds),
    relationshipLinks: unique(record.runtimeRelationshipIds ?? record.relationshipIds),
    sourceId,
    createdAt: record.createdAt ?? timestamp,
    updatedAt: timestamp,
    metadata: {
      ...metadata,
      accountId: record.accountId,
      customerId: record.customerId,
      proposalId: record.proposalId,
      opportunityId: record.opportunityId,
      productId: record.productId,
      productName: record.productName,
      fulfillmentPlanId: record.fulfillmentPlanId,
      fulfillmentStrategy: record.fulfillmentStrategy,
      fulfillmentMix: record.fulfillmentMix,
      packageId: record.packageId,
      certifiedPackageId: record.certifiedPackageId,
      scopeVersionId: record.scopeVersionId,
      noDuplicateRuntimeObjects: true,
    },
  });
  return runtimeId;
}

async function loadDraftPackage(packageId) {
  return normalizeDraftPackage(await hydrateIofProjectionArtifacts(await loadRecord(DIRS.iofPackages, packageId)));
}

async function resolveEngineeringPackageForCertification(packageReferenceId) {
  let engineeringPackage = await loadEngineeringPackage(packageReferenceId).catch(() => null);
  if (!engineeringPackage) {
    engineeringPackage = await findEngineeringPackageForDraft(packageReferenceId);
  }
  if (!engineeringPackage) return null;
  const referenceIntegrity = await resolveEngineeringPackageReferences(engineeringPackage);
  const draftPackageId = engineeringPackage.draftIOFPackageId ?? engineeringPackage.draftIofPackageId;
  const draft = referenceIntegrity.resolved?.draftIofPackage
    ? normalizeDraftPackage(referenceIntegrity.resolved.draftIofPackage)
    : await loadDraftPackage(draftPackageId).catch(() => null);
  if (!draft) return null;
  return {
    engineeringPackage,
    referenceIntegrity,
    draft,
    opportunity: referenceIntegrity.resolved?.opportunity ?? null,
    routeRepository: referenceIntegrity.resolved?.routeRepository ?? null,
    proposal: referenceIntegrity.resolved?.proposal ?? null,
  };
}

function repositoryValidationCheck(key, label, id, ok, required, detail, repositoryPath) {
  const status = ok ? "PASS" : required ? "FAIL" : "WARNING";
  return {
    key,
    label,
    status,
    id: firstText(id, "missing"),
    required,
    detail,
    repositoryPath,
  };
}

function buildEngineeringRepositoryValidationReport(draftRecord, engineeringPackage, referenceIntegrity = {}) {
  const draft = asRecord(draftRecord);
  const refs = asRecord(referenceIntegrity.resolved);
  const checks = asRecord(referenceIntegrity.checks);
  const paths = asRecord(referenceIntegrity.repositoryPaths);
  const engineeringBaseline = asRecord(refs.engineeringBaseline);
  const routeRepository = asRecord(refs.routeRepository);
  const proposedObjects = asArray(draft.proposedIofUnits);
  const stationAuthority = asRecord(draft.stationAuthority);
  const stationIndexedGraph = asRecord(draft.stationIndexedGraph);
  const stationObjectManifest = asRecord(draft.stationObjectManifest);
  const projectedObjectManifest = asRecord(draft.projectedObjectManifest);
  const projectedObjects = asArray(projectedObjectManifest.projectedObjects ?? draft.projectedObjects);
  const missingObjectTypes = proposedObjects.filter((object) => !firstText(
    object?.unitType,
    object?.objectType,
    object?.type,
    object?.classification,
  ));
  const routeVertexCount = asArray(routeRepository.commercialGeometry).length;
  const repositoryChecks = [
    repositoryValidationCheck(
      "engineeringPackage",
      "Engineering Package",
      engineeringPackage?.engineeringPackageId,
      Boolean(checks.engineeringPackage),
      true,
      "Engineering Repository package envelope restored.",
      paths.engineeringPackage,
    ),
    repositoryValidationCheck(
      "engineeringBaseline",
      "Engineering Baseline",
      engineeringPackage?.engineeringBaselineId ?? engineeringBaseline.engineeringBaselineId,
      Boolean(checks.engineeringBaseline),
      true,
      "Immutable Engineering Baseline restored before Engineering Package projection.",
      paths.engineeringBaseline,
    ),
    repositoryValidationCheck(
      "draftIofPackage",
      "Draft IOF Package",
      engineeringPackage?.draftIOFPackageId ?? engineeringPackage?.draftIofPackageId ?? draft.packageId,
      Boolean(checks.draftIofPackage),
      true,
      "Draft IOF Package reference resolved before projection.",
      paths.draftIofPackage,
    ),
    repositoryValidationCheck(
      "proposal",
      "Proposal",
      engineeringPackage?.proposalId ?? draft.proposalId,
      Boolean(checks.commercialProposal),
      true,
      "Proposal reference resolved from Proposal Repository.",
      paths.commercialProposal,
    ),
    repositoryValidationCheck(
      "workbook",
      "Workbook",
      engineeringPackage?.commercialWorkbookId ?? draft.commercialWorkbookId,
      Boolean(checks.commercialWorkbook),
      true,
      "Commercial Workbook reference resolved without rebuilding workbook data.",
      paths.commercialWorkbook,
    ),
    repositoryValidationCheck(
      "estimate",
      "Estimate",
      engineeringPackage?.estimateId ?? draft.estimateId,
      Boolean(checks.commercialEstimate),
      true,
      "Commercial Estimate reference resolved without recalculation.",
      paths.commercialEstimate,
    ),
    repositoryValidationCheck(
      "routeRepository",
      "Route Repository",
      engineeringPackage?.routeRepositoryId ?? draft.routeRepositoryId,
      Boolean(checks.routeRepository),
      true,
      `${routeVertexCount.toLocaleString()} route vertices resolved from Route Repository.`,
      paths.routeRepository,
    ),
    repositoryValidationCheck(
      "measuredCenterline",
      "Measured Centerline",
      engineeringPackage?.measuredCenterlineId ?? draft.measuredCenterlineId,
      Boolean(checks.measuredCenterline),
      true,
      "Measured centerline restored before Engineering projection.",
      paths.measuredCenterline,
    ),
    repositoryValidationCheck(
      "stationGraph",
      "Station Graph",
      engineeringPackage?.stationGraphId ?? draft.stationGraphId ?? stationIndexedGraph.stationGraphId ?? stationIndexedGraph.graphId,
      Boolean(checks.stationGraph),
      true,
      `${asArray(stationIndexedGraph.nodes).length.toLocaleString()} station graph nodes restored.`,
      paths.stationGraph,
    ),
    repositoryValidationCheck(
      "stationAuthorityIds",
      "Station Authority IDs",
      asArray(engineeringPackage?.stationAuthorityIds).join(", ") || asArray(stationAuthority.stationAuthorityIds).join(", ") || stationAuthority.authorityId,
      Boolean(checks.stationAuthorityIds),
      true,
      `${asArray(stationAuthority.stations).length.toLocaleString()} station authority records restored.`,
      paths.stationAuthorityIds,
    ),
    repositoryValidationCheck(
      "stationObjectManifest",
      "Station Object Manifest",
      engineeringPackage?.stationObjectManifestId ?? draft.stationObjectManifestId ?? stationObjectManifest.manifestId,
      Boolean(checks.stationObjectManifest),
      true,
      `${asArray(stationObjectManifest.objects).length.toLocaleString()} station-indexed object rows restored.`,
      paths.stationObjectManifest,
    ),
    repositoryValidationCheck(
      "projectedObjectManifest",
      "Projected Object Manifest",
      engineeringPackage?.projectedObjectManifestId ?? draft.projectedObjectManifestId ?? projectedObjectManifest.manifestId,
      Boolean(checks.projectedObjectManifest && checks.projectedObjects),
      true,
      `${projectedObjects.length.toLocaleString()} projected IOF objects restored. No coordinate-only objects allowed.`,
      paths.projectedObjectManifest,
    ),
    repositoryValidationCheck(
      "objectValidation",
      "Object Validation",
      draft.packageId,
      proposedObjects.length > 0 && missingObjectTypes.length === 0,
      false,
      missingObjectTypes.length
        ? `${missingObjectTypes.length.toLocaleString()} package object(s) are missing type metadata. Continuing certification.`
        : `${proposedObjects.length.toLocaleString()} package object(s) available for projection validation.`,
      "Draft IOF Package projection",
    ),
    repositoryValidationCheck(
      "repositoryIntegrity",
      "Repository Integrity",
      engineeringPackage?.referenceHash,
      Boolean(referenceIntegrity.ok),
      true,
      "All required Engineering Package references must resolve before projection.",
      "Engineering Repository reference integrity",
    ),
  ];
  const blockingFailures = repositoryChecks.filter((check) => check.required && check.status === "FAIL");
  const warningChecks = repositoryChecks.filter((check) => check.status === "WARNING");
  const readyForStationPlanning = blockingFailures.length === 0;
  const readyForCertification = readyForStationPlanning && proposedObjects.length > 0 && missingObjectTypes.length === 0;
  const readinessChecks = [
    ...repositoryChecks,
    repositoryValidationCheck(
      "readyForStationPlanning",
      "Ready for Station Review",
      draft.packageId,
      readyForStationPlanning,
      false,
      readyForStationPlanning ? "Station projection is complete and ready for Engineering Station Review." : "Repository references must resolve before Station Review.",
      "Engineering Certification readiness",
    ),
    repositoryValidationCheck(
      "readyForCertification",
      "Ready for Certification",
      draft.packageId,
      readyForCertification,
      false,
      readyForCertification ? "Repository and object validation passed; manual Engineering gates still apply." : "Certification remains locked until repository and object validation pass.",
      "Engineering Certification readiness",
    ),
  ];
  return {
    reportId: `ENG-READINESS-${engineeringPackage?.engineeringPackageId ?? draft.packageId}`,
    status: blockingFailures.length ? "FAIL" : warningChecks.length ? "WARNING" : "PASS",
    checks: readinessChecks,
    warnings: readinessChecks.filter((check) => check.status !== "PASS"),
    readiness: {
      readyForProjection: blockingFailures.length === 0,
      readyForStationPlanning,
      readyForCertification,
    },
    repositoryAuthority: "ENGINEERING_REPOSITORY",
    engineeringAuthority: "ENGINEERING_BASELINE",
    engineeringBaselineId: engineeringPackage?.engineeringBaselineId,
    engineeringBaselineHash: engineeringPackage?.engineeringBaselineHash,
    engineeringRevisionId: engineeringPackage?.engineeringRevisionId,
    baselineGraphRequired: false,
    reasoningRequired: false,
    deterministicDoctrineFallback: true,
    generatedAt: nowIso(),
    noRegeneration: true,
    noScopeVersionCreation: true,
  };
}

function decorateDraftPackageWithEngineeringPackage(draftRecord, engineeringPackage, referenceIntegrity, routeRepository = null) {
  const draft = normalizeDraftPackage(draftRecord);
  const repositoryValidation = buildEngineeringRepositoryValidationReport(draft, engineeringPackage, referenceIntegrity);
  const sanitizedIntegrity = {
    ...referenceIntegrity,
    resolved: undefined,
  };
  return normalizeDraftPackage({
    ...draft,
    engineeringPackageId: engineeringPackage.engineeringPackageId,
    engineeringBaselineId: engineeringPackage.engineeringBaselineId,
    engineeringBaselineHash: engineeringPackage.engineeringBaselineHash,
    engineeringBaselineManifestId: engineeringPackage.engineeringBaselineManifestId,
    engineeringBaselineProjectionId: engineeringPackage.engineeringBaselineProjectionId,
    engineeringRevisionId: engineeringPackage.engineeringRevisionId,
    engineeringRevisionSource: engineeringPackage.engineeringRevisionSource,
    engineeringRevisionState: engineeringPackage.engineeringRevisionState,
    engineeringAuthority: engineeringPackage.engineeringAuthority ?? "ENGINEERING_BASELINE",
    engineeringPackage,
    engineeringRepositoryRestore: {
      engineeringPackageId: engineeringPackage.engineeringPackageId,
      engineeringBaselineId: engineeringPackage.engineeringBaselineId,
      engineeringBaselineHash: engineeringPackage.engineeringBaselineHash,
      engineeringRevisionId: engineeringPackage.engineeringRevisionId,
      status: engineeringPackage.engineeringStatus ?? engineeringPackage.status,
      referenceIntegrity: sanitizedIntegrity,
      repositoryAuthority: "ENGINEERING_REPOSITORY",
      engineeringAuthority: "ENGINEERING_BASELINE",
      restoredFromEngineeringRepository: true,
      noCommercialRepositoryBrowsing: true,
      noRegeneration: true,
      noScopeVersionCreation: true,
    },
    engineeringRepositoryValidation: repositoryValidation,
    engineeringReadinessReport: repositoryValidation,
    sharedOpportunityMapProjection: sharedOpportunityMapProjection(routeRepository),
    routeRepositoryId: draft.routeRepositoryId ?? engineeringPackage.routeRepositoryId,
    commercialProposalId: engineeringPackage.proposalId ?? engineeringPackage.commercialProposalId,
    commercialWorkbookId: engineeringPackage.commercialWorkbookId,
    estimateId: engineeringPackage.estimateId,
    productDoctrineId: engineeringPackage.productDoctrineId,
    customerTwinId: engineeringPackage.customerTwinId,
    noRouteRegeneration: true,
    noEstimateRegeneration: true,
    noWorkbookRegeneration: true,
    noProposalRegeneration: true,
    noScopeVersionCreation: true,
  });
}

async function decorateDraftPackageForResponse(record) {
  const draft = normalizeDraftPackage(record);
  const proposal = draft.proposalId ? await loadRecord(DIRS.proposalDrafts, draft.proposalId).catch(() => null) : null;
  return normalizeDraftPackage({
    ...draft,
    packageDifferences: buildPackageDifferences(draft, proposal),
  });
}

async function persistDraftPackage(record, user, eventType = "runtime.iof_package.saved", details = "Draft IOF Package saved.", options = {}) {
  const normalized = normalizeDraftPackage(record);
  const history = await appendHistory(normalized, user, eventType, details);
  const next = normalizeDraftPackage({
    ...normalized,
    historyIds: unique([...normalized.historyIds, history.historyId]),
    updatedAt: history.timestamp,
  });
  const artifactReferences = options.reuseArtifactReferences
    ? asRecord(next.iofArtifactRepositoryReferences)
    : await persistIofProjectionArtifacts(next, {
        timestamp: history.timestamp,
        user,
        lifecycleStage: eventType,
      });
  const repositoryRecord = normalizeDraftPackage(stripIofProjectionArtifacts({
    ...next,
    iofArtifactRepositoryReferences: {
      ...(next.iofArtifactRepositoryReferences ?? {}),
      ...artifactReferences,
    },
    repositoryAssemblyStatus: "PERSISTED_REFERENCE_ARTIFACTS",
  }, {
    ...(next.iofArtifactRepositoryReferences ?? {}),
    ...artifactReferences,
  }));
  await persistRecord(DIRS.iofPackages, repositoryRecord.packageId, repositoryRecord);
  await persistRuntimeMirror(repositoryRecord, user, "DRAFT-IOF", repositoryRecord.packageId, { status: repositoryRecord.status, workflowStatus: repositoryRecord.workflowStatus });
  return next;
}

async function persistDraftPackageMetadataPatch(record, user, eventType, details, metadata = {}) {
  const timestamp = nowIso();
  const history = await appendHistory(record, user, eventType, details, metadata);
  const saved = await persistRecord(DIRS.iofPackages, record.packageId, {
    ...record,
    historyIds: unique([...asArray(record.historyIds), history.historyId]),
    updatedAt: timestamp,
  });
  await persistRuntimeMirror(saved, user, "DRAFT-IOF", saved.packageId, { status: saved.status, workflowStatus: saved.workflowStatus, metadataPatchOnly: true });
  return saved;
}

function engineeringIntakeIdForPackage(packageId) {
  return `ENGINEERING-INTAKE-${stableIdPart(packageId)}`;
}

async function persistEngineeringIntakeStatus(packageRecord, user, status, extras = {}) {
  const timestamp = nowIso();
  const intakeId = engineeringIntakeIdForPackage(packageRecord.packageId);
  const existing = await loadRecord(DIRS.engineeringIntakes, intakeId).catch(() => null);
  const next = {
    ...(existing ?? {}),
    intakeId,
    packageId: packageRecord.packageId,
    draftPackageId: packageRecord.draftPackageId ?? packageRecord.packageId,
    status,
    workflowStatus: status === "CERTIFIED" ? "CERTIFIED_IOF_PACKAGE" : "ENGINEERING_INTAKE",
    lifecycleState: status,
    authority: "ENGINEERING_INTAKE",
    customerId: packageRecord.customerId,
    customerName: packageRecord.customerSummary?.name ?? packageRecord.customerName ?? packageRecord.customerId,
    accountId: packageRecord.accountId,
    opportunityId: packageRecord.opportunityId,
    proposalId: packageRecord.proposalId,
    productId: packageRecord.productId,
    productName: packageRecord.productName,
    doctrineId: packageRecord.doctrineId,
    productDoctrineVersion: packageRecord.productDoctrineVersion,
    packageRevision: packageRecord.packageRevision,
    assignedEngineerId: packageRecord.assignedEngineerId,
    assignedEngineer: packageRecord.assignedEngineer || user.name,
    commercialRevisionLocked: Boolean(packageRecord.commercialRevisionLocked ?? existing?.commercialRevisionLocked),
    submittedAt: packageRecord.submittedAt ?? existing?.submittedAt,
    noScopeVersionCreation: true,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
    ...extras,
  };
  await persistRecord(DIRS.engineeringIntakes, intakeId, next);
  return next;
}

async function openDraftPackageForEngineering(packageReferenceId, user) {
  const resolved = await resolveEngineeringPackageForCertification(packageReferenceId);
  if (!resolved) return null;
  const { draft, referenceIntegrity } = resolved;
  let { engineeringPackage } = resolved;
  if ((engineeringPackage.engineeringStatus ?? engineeringPackage.status) === "ENGINEERING_PENDING") {
    engineeringPackage = await updateEngineeringPackageStatus(engineeringPackage.engineeringPackageId, user, "STATION_PLANNING", {
      stationPlanningStatus: "READY_FOR_STATION_PLANNING",
      stationPlanningStartedAt: nowIso(),
      stationPlanningStartedBy: user.name,
      stationPlanningStartedById: user.userId,
      noRegeneration: true,
      noScopeVersionCreation: true,
    }) ?? engineeringPackage;
  }
  await persistEngineeringIntakeStatus(draft, user, "STATION_PLANNING", {
    engineeringPackageId: engineeringPackage.engineeringPackageId,
    openedAt: nowIso(),
    openedBy: user.name,
    openedById: user.userId,
  });
  return decorateDraftPackageWithEngineeringPackage(
    await decorateDraftPackageForResponse(draft),
    engineeringPackage,
    referenceIntegrity,
    resolved.routeRepository,
  );
}

function packageQueueItem(record, engineeringPackage = null) {
  const draft = normalizeDraftPackage(record);
  const packageRecord = engineeringPackage ?? {};
  return {
    engineeringPackageId: packageRecord.engineeringPackageId ?? draft.engineeringPackageId ?? draft.packageId,
    packageId: packageRecord.engineeringPackageId ?? draft.engineeringPackageId ?? draft.packageId,
    engineeringBaselineId: packageRecord.engineeringBaselineId,
    engineeringBaselineHash: packageRecord.engineeringBaselineHash,
    engineeringRevisionId: packageRecord.engineeringRevisionId,
    engineeringAuthority: packageRecord.engineeringAuthority ?? "ENGINEERING_BASELINE",
    draftIofPackageId: packageRecord.draftIOFPackageId ?? packageRecord.draftIofPackageId ?? draft.packageId,
    packageName: draft.packageName,
    packageReadiness: draft.packageReadiness,
    packageCompleteness: draft.packageCompleteness,
    certificationProgress: draft.certificationProgress,
    packageRevision: draft.packageRevision,
    workspaceId: draft.workspaceId,
    proposalSummary: draft.proposalSummary,
    commercialConfidence: draft.commercialConfidence,
    engineeringConfidence: draft.engineeringConfidence,
    assemblyConfidence: draft.assemblyConfidence,
    engineeringReadiness: draft.engineeringReadiness,
    assemblyReport: draft.assemblyReport,
    packageStatus: packageRecord.engineeringStatus ?? packageRecord.status ?? draft.status,
    assignedEngineer: draft.assignedEngineer || draft.assignedEngineerId || "Unassigned",
    assignedEngineerId: draft.assignedEngineerId,
    priority: draft.priority,
    submissionDate: packageRecord.submittedDate ?? draft.submittedAt,
    submittedAt: packageRecord.submittedDate ?? draft.submittedAt,
    customer: draft.customerSummary?.name ?? draft.customerId,
    customerId: draft.customerId,
    opportunity: draft.opportunityId,
    opportunityId: draft.opportunityId,
    proposalId: packageRecord.proposalId ?? packageRecord.commercialProposalId ?? draft.proposalId,
    routeRepositoryId: packageRecord.routeRepositoryId,
    commercialWorkbookId: packageRecord.commercialWorkbookId,
    estimateId: packageRecord.estimateId,
    productDoctrineId: packageRecord.productDoctrineId,
    commercialStatus: packageRecord.commercialStatus ?? "SUBMITTED_TO_ENGINEERING",
    repositoryAuthority: packageRecord.authority ?? "ENGINEERING_REPOSITORY",
    proposedUnitCount: draft.packageReadiness.proposedUnitCount,
    certifiedUnitCount: draft.packageReadiness.certifiedUnitCount,
    status: packageRecord.engineeringStatus ?? packageRecord.status ?? draft.status,
    updatedAt: packageRecord.updatedAt ?? draft.updatedAt,
  };
}

export async function listReviewQueue() {
  const records = await listEngineeringPackages({ openOnly: true });
  const items = await Promise.all(records.map(async (engineeringPackage) => {
    const draft = await loadDraftPackage(engineeringPackage.draftIOFPackageId ?? engineeringPackage.draftIofPackageId).catch(() => null);
    if (!draft) return null;
    return packageQueueItem(draft, engineeringPackage);
  }));
  return sortedByUpdated(items.filter(Boolean));
}

function unitsFromProposal(proposal, packageId) {
  const runtimeIds = unique(asArray(proposal.runtimeObjectIds));
  const geometryRefs = unique(asArray(proposal.geometryReferences));
  const sources = runtimeIds.length ? runtimeIds : geometryRefs;
  const confidence = numeric(proposal.confidenceSummary?.commercialReadiness, numeric(proposal.readiness?.confidence, 80));
  return sources.map((sourceId, index) => normalizeUnit({
    unitId: `${packageId}:unit:${String(index + 1).padStart(3, "0")}`,
    sourceRuntimeObjectId: runtimeIds[index] ?? "",
    runtimeObjectIds: runtimeIds[index] ? [runtimeIds[index]] : [],
    geometryReferences: geometryRefs[index] ? [geometryRefs[index]] : geometryRefs.slice(0, 1),
    runtimeRelationshipIds: asArray(proposal.runtimeRelationshipIds),
    runtimeEvidenceIds: asArray(proposal.runtimeEvidenceIds),
    dependencyIds: asArray(proposal.dependencyIds ?? proposal.runtimeRelationshipIds),
    unitType: runtimeIds[index] ? "RUNTIME_REFERENCE_UNIT" : "GEOMETRY_REFERENCE_UNIT",
    name: `Proposed IOF Unit ${index + 1}`,
    quantity: 1,
    commercialQuantity: 1,
    historicalQuantity: 0,
    marketplaceAdvisory: "NOT_REQUESTED",
    engineeringQuantity: 0,
    confidence,
    commercialConfidence: confidence,
    engineeringDecision: "PENDING_ENGINEERING_REVIEW",
    status: "PROPOSED",
  }, packageId, index));
}

function runtimeError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export function selectedSavedProposalRevisionLineage(proposal = {}) {
  const proposalId = firstText(proposal.proposalId, proposal.proposalRecordId);
  const proposalRevisionId = firstText(proposal.proposalRevisionId);
  const proposalHash = firstText(proposal.proposalHash);
  if (!proposalRevisionId || !proposalHash) {
    throw runtimeError(409, "Draft IOF Package assembly requires the selected saved Proposal Revision ID and hash.");
  }
  const revision = asArray(proposal.proposalRevisions).find((candidate) => (
    firstText(asRecord(candidate).proposalRevisionId) === proposalRevisionId
    && firstText(asRecord(candidate).proposalHash) === proposalHash
  ));
  if (!revision) {
    throw runtimeError(409, "Draft IOF Package assembly could not resolve the selected Proposal Revision ID/hash exactly.");
  }
  if (firstText(revision.revisionStatus).toUpperCase() !== "SAVED") {
    throw runtimeError(409, `Draft IOF Package assembly requires a SAVED Proposal Revision; received ${firstText(revision.revisionStatus, "UNKNOWN")}.`);
  }
  if (firstText(revision.proposalId) && firstText(revision.proposalId) !== proposalId) {
    throw runtimeError(409, "Draft IOF Package assembly rejected a Proposal Revision owned by a different Proposal.");
  }
  const snapshot = asRecord(revision.snapshot);
  if (firstText(snapshot.proposalId) && firstText(snapshot.proposalId) !== proposalId) {
    throw runtimeError(409, "Draft IOF Package assembly rejected a Proposal Revision snapshot owned by a different Proposal.");
  }
  const proposalRevisionNumber = numeric(revision.revisionNumber, numeric(proposal.revisionNumber, 0));
  if (!proposalRevisionNumber) {
    throw runtimeError(409, "Draft IOF Package assembly requires the selected saved Proposal Revision number.");
  }
  return {
    proposalId,
    proposalRevisionId: firstText(revision.proposalRevisionId),
    proposalRevisionNumber,
    proposalHash: firstText(revision.proposalHash),
    sourceProposalVersion: proposalRevisionNumber,
  };
}

export async function assembleDraftIofPackageFromProposal(input = {}, user, options = {}) {
  const body = input ?? {};
  const proposalId = String(body.proposalId ?? body.proposal?.proposalId ?? "");
  if (!proposalId) {
    throw runtimeError(400, "proposalId is required.");
  }
  const proposal = await loadRecord(DIRS.proposalDrafts, proposalId).catch(() => null);
  if (!proposal) {
    throw runtimeError(404, `Proposal not found: ${proposalId}`);
  }
  if (!(proposal.approvalState === "APPROVED" || ["CUSTOMER_APPROVED", "READY_FOR_IOF_PACKAGE"].includes(proposal.status))) {
    throw runtimeError(409, "Draft IOF Package assembly requires a customer-approved Proposal.");
  }
  const proposalRevisionLineage = selectedSavedProposalRevisionLineage(proposal);
  const commercialRevision = await ensureCommercialRevisionForProposal(proposal, user, {
    timestamp: nowIso(),
  });
  const packageId = String(body.packageId ?? `DRAFT-IOF-${proposalId}`);
  const existing = await loadRecord(DIRS.iofPackages, packageId).catch(() => null)
    ?? (await listRecords(DIRS.iofPackages)).find((record) => record?.proposalId === proposalId && !["ARCHIVED", "CLOSED"].includes(String(record?.status ?? "")));
  if (existing && options.idempotent !== false) {
    const lineageRepairedExisting = normalizeDraftPackage({
      ...existing,
      ...proposalRevisionLineage,
      proposalSummary: {
        ...asRecord(existing.proposalSummary),
        proposalRevisionId: proposalRevisionLineage.proposalRevisionId,
        proposalRevisionNumber: proposalRevisionLineage.proposalRevisionNumber,
        proposalHash: proposalRevisionLineage.proposalHash,
      },
    });
    const { revision, releasePackage } = await ensureCommercialReleasePackageForDraft(lineageRepairedExisting, proposal, user, {
      revision: commercialRevision,
      timestamp: nowIso(),
    });
    const existingWithCommercialAuthority = normalizeDraftPackage({
      ...lineageRepairedExisting,
      commercialRevisionId: revision.commercialRevisionId,
      revisionId: revision.revisionId,
      commercialRevisionHash: revision.revisionHash,
      commercialRepositoryId: revision.repositoryId,
      commercialReleasePackageId: releasePackage.commercialReleasePackageId,
      commercialReleaseHash: releasePackage.releaseHash,
      commercialReleaseState: releasePackage.commercialReleaseState,
      currentAuthority: "COMMERCIAL_RELEASE_PACKAGE",
      draftIofAuthorityFlow: {
        inputAuthority: "COMMERCIAL_RELEASE_PACKAGE",
        commercialRevisionId: revision.commercialRevisionId,
        commercialReleasePackageId: releasePackage.commercialReleasePackageId,
        draftIofPackageId: existing.packageId,
        draftIofOutputUnchanged: true,
        pricingOutputUnchanged: true,
        workbookOutputUnchanged: true,
        noScopeVersionCreation: true,
      },
      commercialAuthorityDiagnostics: commercialAuthorityDiagnosticsFrom({
        revision,
        releasePackage,
        proposal,
        draftPackage: existing,
      }),
    });
    await persistRecord(DIRS.iofPackages, existingWithCommercialAuthority.packageId, existingWithCommercialAuthority);
    return {
      created: false,
      iofPackage: await decorateDraftPackageForResponse(existingWithCommercialAuthority),
      draftPackage: await decorateDraftPackageForResponse(existingWithCommercialAuthority),
      proposal,
      commercialRevision: revision,
      commercialReleasePackage: releasePackage,
    };
  }
  const proposedIofUnits = unitsFromProposal(proposal, packageId);
  if (!proposedIofUnits.length) {
    throw runtimeError(409, "Approved Proposal has no runtime or geometry references to assemble.");
  }
  const candidateRouteGeometry = proposal.routeGeometry ?? proposal.centerline ?? proposal.centerlineRoute?.geometry ?? proposal.geometry?.coordinates ?? proposal.geometry;
  const routeGeometry = Array.isArray(candidateRouteGeometry) ? candidateRouteGeometry : undefined;
  const geometryCoordinateCount = Number(proposal.geometryCoordinateCount ?? routeGeometry?.length ?? 0);
  const routeMiles = numeric(proposal.routeMiles, numeric(proposal.pricingSummary?.routeMiles, numeric(proposal.productConfiguration?.routeMiles, 0)));
  const routeFeet = numeric(proposal.routeFeet, routeMiles ? routeMiles * 5280 : 0);
  const routeId = String(proposal.routeId ?? proposal.centerlineRoute?.routeId ?? asArray(proposal.geometryReferences)[0] ?? packageId);
  const draft = await persistDraftPackage({
    packageId,
    packageName: String(body.packageName ?? `${proposal.proposalNumber ?? proposalId} Draft IOF Package`),
    packageType: "ENGINEERING",
    status: "DRAFT",
    workflowStatus: "ENGINEERING_REVIEW",
    organizationId: proposal.organizationId ?? user.organizationId,
    workspaceId: proposal.workspaceId ?? user.workspaceId,
    ownerId: proposal.commercialOwnerId ?? proposal.ownerId ?? user.userId,
    owner: proposal.commercialOwner ?? proposal.owner ?? user.name,
    createdById: user.userId,
    createdBy: user.name,
    visibility: "ORGANIZATION",
    authority: "ENGINEERING_REVIEW",
    lifecycleState: "IN_REVIEW",
    commercialRevisionId: commercialRevision.commercialRevisionId,
    revisionId: commercialRevision.revisionId,
    commercialRevisionHash: commercialRevision.revisionHash,
    commercialRepositoryId: commercialRevision.repositoryId,
    commercialReleaseState: "PENDING_RELEASE",
    currentAuthority: "COMMERCIAL_REVISION",
    proposalAuthorityFlow: {
      inputAuthority: "COMMERCIAL_REVISION",
      projection: "PROPOSAL_PROJECTION",
      repository: "PROPOSAL_REPOSITORY",
      commercialRevisionId: commercialRevision.commercialRevisionId,
      revisionHash: commercialRevision.revisionHash,
      proposalOutputUnchanged: true,
      pricingOutputUnchanged: true,
      workbookOutputUnchanged: true,
      noScopeVersionCreation: true,
    },
    proposalId,
    proposalRevisionId: proposalRevisionLineage.proposalRevisionId,
    proposalRevisionNumber: proposalRevisionLineage.proposalRevisionNumber,
    proposalHash: proposalRevisionLineage.proposalHash,
    customerId: proposal.customerId,
    accountId: proposal.accountId ?? (proposal.customerId === "customer-google" ? "google" : proposal.customerId),
    opportunityId: proposal.opportunityId,
    productId: proposal.productId,
    productName: proposal.productName,
    fulfillmentPlanId: proposal.fulfillmentPlanId,
    fulfillmentStrategy: proposal.fulfillmentStrategy,
    fulfillmentPlan: proposal.fulfillmentPlan,
    fulfillmentMix: proposal.fulfillmentMix,
    assignedEngineerId: body.assignedEngineerId ?? user.userId,
    assignedEngineer: body.assignedEngineer ?? user.name,
    priority: body.priority ?? "NORMAL",
    submittedAt: nowIso(),
    packageRevision: 1,
    assemblyConfidence: numeric(proposal.readiness?.confidence, numeric(proposal.confidenceSummary?.commercialReadiness, 80)),
    engineeringConfidence: 0,
    proposalSummary: {
      title: proposal.title,
      proposalNumber: proposal.proposalNumber,
      version: proposal.version,
      proposalRevisionId: proposalRevisionLineage.proposalRevisionId,
      proposalRevisionNumber: proposalRevisionLineage.proposalRevisionNumber,
      proposalHash: proposalRevisionLineage.proposalHash,
      status: proposal.status,
      accountId: proposal.accountId,
      productId: proposal.productId,
      productName: proposal.productName,
      fulfillmentPlanId: proposal.fulfillmentPlanId,
      fulfillmentStrategy: proposal.fulfillmentStrategy,
      proposalRecipientContactIds: proposal.proposalRecipientContactIds,
      customerReviewContactIds: proposal.customerReviewContactIds,
      approvalAuthorityContactIds: proposal.approvalAuthorityContactIds,
      sofRecipientContactIds: proposal.sofRecipientContactIds,
      customerContactEmails: proposal.customerContactEmails,
      executiveSummary: proposal.executiveSummary,
      readiness: proposal.readiness,
      commercialRevisionId: commercialRevision.commercialRevisionId,
      commercialRevisionHash: commercialRevision.revisionHash,
    },
    commercialSummary: {
      commercialRevisionId: commercialRevision.commercialRevisionId,
      commercialRevisionHash: commercialRevision.revisionHash,
      commercialRepositoryId: commercialRevision.repositoryId,
      routeRepositoryId: commercialRevision.routeRepositoryId,
      estimateId: commercialRevision.estimateId,
      workbookId: commercialRevision.workbookId,
      pricingSummary: proposal.pricingSummary,
      marginSummary: proposal.marginSummary,
      confidenceSummary: proposal.confidenceSummary,
      commercialAssumptionIds: proposal.commercialAssumptionIds,
      dealPointIds: proposal.dealPointIds,
      productId: proposal.productId,
      productName: proposal.productName,
      fulfillmentPlanId: proposal.fulfillmentPlanId,
      fulfillmentStrategy: proposal.fulfillmentStrategy,
      fulfillmentPlan: proposal.fulfillmentPlan,
      fulfillmentMix: proposal.fulfillmentMix,
    },
    customerSummary: {
      customerId: proposal.customerId,
      accountId: proposal.accountId ?? (proposal.customerId === "customer-google" ? "google" : proposal.customerId),
      name: proposal.customer ?? proposal.customerId,
      approvalState: proposal.approvalState,
      approvedAt: proposal.approvedAt,
      proposalRecipientContactIds: proposal.proposalRecipientContactIds,
      customerReviewContactIds: proposal.customerReviewContactIds,
      approvalAuthorityContactIds: proposal.approvalAuthorityContactIds,
      sofRecipientContactIds: proposal.sofRecipientContactIds,
      customerContactEmails: proposal.customerContactEmails,
    },
    proposalRecipientContactIds: proposal.proposalRecipientContactIds,
    customerReviewContactIds: proposal.customerReviewContactIds,
    approvalAuthorityContactIds: proposal.approvalAuthorityContactIds,
    sofRecipientContactIds: proposal.sofRecipientContactIds,
    customerContactEmails: proposal.customerContactEmails,
    commercialNotes: unique([
      proposal.summary,
      proposal.executiveSummary,
      ...(asArray(proposal.commercialNotes).map(String)),
    ]),
    engineeringNotes: ["Awaiting Engineering review."],
    customerRequests: asArray(proposal.comments),
    engineeringRequirements: CHECKLIST_KEYS,
    dependencies: unique([
      ...asArray(proposal.dependencyIds),
      ...asArray(proposal.runtimeRelationshipIds),
      proposal.fulfillmentPlanId,
    ]),
    assemblyReport: {
      assembledFrom: "COMMERCIAL_REVISION",
      previousSourceType: "APPROVED_PROPOSAL_RUNTIME_OBJECT",
      commercialRevisionId: commercialRevision.commercialRevisionId,
      commercialRevisionHash: commercialRevision.revisionHash,
      proposalConsumesCommercialRevision: true,
      noScopeVersionCreated: true,
      noMarketplaceCreated: true,
      noDuplicateRuntimeObjects: true,
      runtimeObjectCount: asArray(proposal.runtimeObjectIds).length,
      relationshipCount: asArray(proposal.runtimeRelationshipIds).length,
      evidenceCount: asArray(proposal.runtimeEvidenceIds).length,
      proposedUnitCount: proposedIofUnits.length,
    },
    proposedIofUnits,
    runtimeObjectIds: proposal.runtimeObjectIds,
    runtimeRelationshipIds: proposal.runtimeRelationshipIds,
    runtimeEvidenceIds: proposal.runtimeEvidenceIds,
    existingInventoryReferences: proposal.existingInventoryReferences,
    customerDesignReferences: proposal.customerDesignReferences,
    partnerInventoryReferences: proposal.partnerInventoryReferences,
    marketplaceAssetReferences: proposal.marketplaceAssetReferences,
    newInfrastructureRequired: proposal.newInfrastructureRequired,
    customerTwinReference: proposal.customerTwinReference,
    geometryReferences: proposal.geometryReferences,
    routeId,
    routeMiles,
    routeFeet,
    routeGeometry,
    geometry: proposal.geometry ?? (routeGeometry ? { type: "LineString", coordinates: routeGeometry } : undefined),
    geometryCoordinateCount,
    centerline: proposal.centerline ?? routeGeometry,
    centerlineId: proposal.centerlineId ?? `${packageId}:CENTERLINE`,
    centerlineRoute: proposal.centerlineRoute ?? (routeGeometry ? {
      routeId,
      routeMiles,
      routeFeet,
      geometry: routeGeometry,
      geometryCoordinateCount,
      source: "APPROVED_PROPOSAL_RUNTIME_OBJECT",
    } : undefined),
    route: proposal.route ?? (routeGeometry ? [{ routeId, routeMiles, geometry: routeGeometry }] : undefined),
    routeSegments: proposal.routeSegments,
    proposalDocumentReferences: proposal.proposalDocumentReferences,
    sourceProposalVersion: proposalRevisionLineage.sourceProposalVersion,
  }, user, "runtime.iof_package.assembled_from_proposal", "Draft IOF Package assembled from approved Proposal references.");
  await appendHistory(draft, user, "runtime.authority_transfer.commercial_to_engineering", "Authority transferred from Commercial Proposal to Engineering Review.", {
    proposalId,
    packageId: draft.packageId,
  });
  const createdEvent = await appendHistory(draft, user, "DRAFT_IOF_PACKAGE_CREATED", "Draft IOF Package created by the Runtime lifecycle bridge.", {
    proposalId,
    packageId: draft.packageId,
  });
  const queuedEvent = await appendHistory(draft, user, "ENGINEERING_REVIEW_QUEUED", "Draft IOF Package queued for Engineering review.", {
    proposalId,
    packageId: draft.packageId,
    assignedEngineerId: draft.assignedEngineerId,
  });
  const draftWithHistory = normalizeDraftPackage({
    ...draft,
    historyIds: unique([...draft.historyIds, createdEvent.historyId, queuedEvent.historyId]),
    updatedAt: queuedEvent.timestamp,
  });
  const { revision, releasePackage } = await ensureCommercialReleasePackageForDraft(draftWithHistory, proposal, user, {
    revision: commercialRevision,
    timestamp: queuedEvent.timestamp,
  });
  const finalDraft = normalizeDraftPackage({
    ...draftWithHistory,
    commercialRevisionId: revision.commercialRevisionId,
    revisionId: revision.revisionId,
    commercialRevisionHash: revision.revisionHash,
    commercialRepositoryId: revision.repositoryId,
    commercialReleasePackageId: releasePackage.commercialReleasePackageId,
    commercialReleaseHash: releasePackage.releaseHash,
    commercialReleaseState: releasePackage.commercialReleaseState,
    currentAuthority: "COMMERCIAL_RELEASE_PACKAGE",
    draftIofAuthorityFlow: {
      inputAuthority: "COMMERCIAL_RELEASE_PACKAGE",
      commercialRevisionId: revision.commercialRevisionId,
      commercialReleasePackageId: releasePackage.commercialReleasePackageId,
      draftIofPackageId: draftWithHistory.packageId,
      draftIofOutputUnchanged: true,
      pricingOutputUnchanged: true,
      workbookOutputUnchanged: true,
      noScopeVersionCreation: true,
    },
    assemblyReport: {
      ...asRecord(draftWithHistory.assemblyReport),
      assembledFrom: "COMMERCIAL_RELEASE_PACKAGE",
      previousAuthority: "COMMERCIAL_REVISION",
      commercialRevisionId: revision.commercialRevisionId,
      commercialReleasePackageId: releasePackage.commercialReleasePackageId,
      releaseHash: releasePackage.releaseHash,
      draftIofOutputUnchanged: true,
    },
    commercialAuthorityDiagnostics: commercialAuthorityDiagnosticsFrom({
      revision,
      releasePackage,
      proposal,
      draftPackage: draftWithHistory,
    }),
  });
  await persistRecord(DIRS.iofPackages, finalDraft.packageId, finalDraft);
  return { created: true, iofPackage: finalDraft, draftPackage: finalDraft, proposal, commercialRevision: revision, commercialReleasePackage: releasePackage };
}

async function handleAssembleFromProposal(req, res, user) {
  const body = await readRequestJson(req);
  try {
    const result = await assembleDraftIofPackageFromProposal(body, user, { idempotent: true });
    jsonResponse(res, result.created ? 201 : 200, result);
  } catch (error) {
    errorResponse(res, error.status ?? 500, error.message ?? "Draft IOF Package assembly failed.");
  }
}

async function handleAssignEngineer(req, res, user, packageId) {
  const draft = await loadDraftPackage(packageId).catch(() => null);
  if (!draft) {
    errorResponse(res, 404, `Draft IOF Package not found: ${packageId}`);
    return;
  }
  if (["CERTIFIED", "CLOSED", "ARCHIVED"].includes(draft.status)) {
    errorResponse(res, 409, "Closed IOF Packages cannot be reassigned.");
    return;
  }
  const body = await readRequestJson(req);
  const assignedEngineerId = String(body.assignedEngineerId ?? body.engineerId ?? user.userId);
  const assignedEngineer = String(body.assignedEngineer ?? body.engineerName ?? user.name);
  const saved = await persistDraftPackage({
    ...draft,
    assignedEngineerId,
    assignedEngineer,
    engineeringReadiness: "ASSIGNED_FOR_ENGINEERING_REVIEW",
    updatedAt: nowIso(),
  }, user, "runtime.iof_package.assigned_engineer", `Draft IOF Package assigned to ${assignedEngineer}.`, {
    assignedEngineerId,
    assignedEngineer,
  });
  jsonResponse(res, 200, { iofPackage: saved, draftPackage: saved });
}

function findUnit(record, unitId) {
  const units = proposedUnitsForPackage(record);
  const index = units.findIndex((unit) => unit.unitId === unitId || unit.sourceUnitId === unitId);
  return { units, index, unit: index >= 0 ? units[index] : null };
}

async function updateUnit(req, res, user, packageId, unitId, action) {
  const draft = await loadDraftPackage(packageId).catch(() => null);
  if (!draft) {
    errorResponse(res, 404, `Draft IOF Package not found: ${packageId}`);
    return;
  }
  if (draft.status === "CERTIFIED") {
    errorResponse(res, 409, "Certified Draft IOF Packages are frozen. Create a new proposal revision cycle.");
    return;
  }
  const body = await readRequestJson(req);
  const { units, index, unit } = findUnit(draft, unitId);
  if (!unit) {
    errorResponse(res, 404, `Proposed IOF Unit not found: ${unitId}`);
    return;
  }
  if (unit.status === "CERTIFIED" && action !== "note") {
    errorResponse(res, 409, "Certified IOF Units are frozen.");
    return;
  }
  const timestamp = nowIso();
  if (action === "certify") {
    units[index] = {
      ...unit,
      status: "CERTIFIED",
      certifiedBy: user.name,
      certifiedById: user.userId,
      certifiedAt: timestamp,
      engineeringNote: body.engineeringNote ?? body.note ?? unit.engineeringNote,
      engineeringConfidence: numeric(body.engineeringConfidence ?? body.confidence, 90),
      engineeringRisk: body.engineeringRisk ?? body.risk ?? "ACCEPTED",
      engineeringQuantity: numeric(body.engineeringQuantity, numeric(unit.quantity, 1)),
      engineeringDecision: "CERTIFIED",
      engineeringComments: [...asArray(unit.engineeringComments), ...asArray(body.engineeringComments ?? body.comments)],
      immutable: true,
      updatedAt: timestamp,
    };
  } else if (action === "modify") {
    const patch = firstBodyRecord(body, "unit");
    units[index] = normalizeUnit({
      ...unit,
      ...patch,
      status: patch.status ?? "PROPOSED",
      modifiedBy: user.name,
      modifiedById: user.userId,
      modifiedAt: timestamp,
      engineeringComments: [...asArray(unit.engineeringComments), ...asArray(body.engineeringComments ?? body.comments)],
      updatedAt: timestamp,
    }, draft.packageId, index);
  } else if (action === "reject") {
    units[index] = {
      ...unit,
      status: "REJECTED",
      rejectedBy: user.name,
      rejectedById: user.userId,
      rejectedAt: timestamp,
      rejectionReason: body.reason ?? body.rejectionReason ?? "Rejected during Engineering certification.",
      engineeringRisk: body.engineeringRisk ?? "REJECTED",
      engineeringDecision: "REJECTED",
      updatedAt: timestamp,
    };
  } else if (action === "split") {
    const splitUnits = asArray(body.units).length ? asArray(body.units) : [
      { ...unit, unitId: `${unit.unitId}:split:a`, name: `${unit.name} A` },
      { ...unit, unitId: `${unit.unitId}:split:b`, name: `${unit.name} B` },
    ];
    units.splice(index, 1, ...splitUnits.map((item, offset) => normalizeUnit({
      ...item,
      parentUnitId: unit.unitId,
      status: "PROPOSED",
      splitBy: user.userId,
      splitAt: timestamp,
    }, draft.packageId, index + offset)));
  } else if (action === "merge") {
    const mergeUnitIds = unique([unit.unitId, ...asArray(body.mergeUnitIds ?? body.unitIds)]);
    const sourceUnits = units.filter((item) => mergeUnitIds.includes(item.unitId));
    const remaining = units.filter((item) => !mergeUnitIds.includes(item.unitId));
    remaining.splice(index, 0, normalizeUnit({
      ...unit,
      unitId: body.unitId ?? `${unit.unitId}:merged`,
      name: body.name ?? `${unit.name} Merged`,
      status: "PROPOSED",
      mergedFromUnitIds: sourceUnits.map((item) => item.unitId),
      runtimeObjectIds: unique(sourceUnits.flatMap((item) => item.runtimeObjectIds)),
      runtimeRelationshipIds: unique(sourceUnits.flatMap((item) => item.runtimeRelationshipIds)),
      runtimeEvidenceIds: unique(sourceUnits.flatMap((item) => item.runtimeEvidenceIds)),
      geometryReferences: unique(sourceUnits.flatMap((item) => item.geometryReferences)),
      mergedBy: user.userId,
      mergedAt: timestamp,
    }, draft.packageId, index));
    units.splice(0, units.length, ...remaining);
  }
  const saved = await persistDraftPackage({
    ...draft,
    proposedIofUnits: units,
    objects: units,
    updatedAt: timestamp,
  }, user, `runtime.iof_unit.${action}`, `Engineering ${action} applied to Proposed IOF Unit ${unitId}.`,);
  jsonResponse(res, 200, { iofPackage: saved, unit: findUnit(saved, unitId).unit ?? saved.proposedIofUnits[index] });
}

async function handleReturnToCommercial(req, res, user, packageId) {
  const draft = await loadDraftPackage(packageId).catch(() => null);
  if (!draft) {
    errorResponse(res, 404, `Draft IOF Package not found: ${packageId}`);
    return;
  }
  const body = await readRequestJson(req);
  const returned = await persistDraftPackage({
    ...draft,
    status: "RETURNED_TO_COMMERCIAL",
    workflowStatus: "RETURNED_TO_COMMERCIAL",
    returnReason: body.reason ?? "Returned to Commercial for revision.",
    returnedBy: user.name,
    returnedById: user.userId,
    returnedAt: nowIso(),
  }, user, "runtime.iof_package.returned_to_commercial", "Engineering returned Draft IOF Package to Commercial.", { reason: body.reason });
  jsonResponse(res, 200, { iofPackage: returned });
}

const CONSTRAINT_CATEGORIES = new Set([
  "ROW",
  "utility conflict",
  "railroad",
  "DOT / highway",
  "water crossing",
  "environmental",
  "floodplain",
  "rock / geology",
  "bridge attachment",
  "power availability",
  "permit jurisdiction",
  "customer requested change",
]);

const STATION_ATTACHED_OBJECT_TYPES = new Set([
  "REGEN",
  "REGENERATION",
  "REGENERATION_FACILITY",
  "ILA",
  "ILA_FACILITY",
  "VAULT",
  "HANDHOLE",
  "SPLICE_CASE",
  "MARKER",
  "PULL_POINT",
  "CONDUIT",
  "FIBER",
  "ROUTE_CENTERLINE",
]);

function objectIdentity(record = {}) {
  return String(record.objectId ?? record.unitId ?? record.structureId ?? record.id ?? record.runtimeObjectId ?? "");
}

function objectType(record = {}) {
  return String(
    record.metadata?.structureType ??
    record.structureType ??
    record.unitType ??
    record.objectType ??
    record.type ??
    record.classification ??
    "ENGINEERING_OBJECT"
  ).toUpperCase();
}

function objectStation(record = {}) {
  return String(record.stationId ?? record.station ?? record.metadata?.stationId ?? record.metadata?.station ?? "");
}

function stationFeet(record = {}, stationReference = "") {
  const stations = [
    ...asArray(record.stations),
    ...asArray(asRecord(record.stationAuthority).stations),
  ];
  const station = stations.find((item) =>
    String(item?.stationId ?? item?.id ?? "") === stationReference ||
    String(item?.label ?? item?.stationLabel ?? "") === stationReference
  );
  if (!station) return undefined;
  const feet = numeric(station.stationFeet ?? station.measureFeet ?? station.feet, Number.NaN);
  return Number.isFinite(feet) ? feet : undefined;
}

function stationRecord(record = {}, stationReference = "") {
  const stations = [
    ...asArray(record.stations),
    ...asArray(asRecord(record.stationAuthority).stations),
  ];
  return stations.find((item) =>
    String(item?.stationId ?? item?.id ?? "") === stationReference ||
    String(item?.label ?? item?.stationLabel ?? "") === stationReference
  );
}

function deterministicMoveHash(value) {
  return `move-${createHash("sha256").update(JSON.stringify(value ?? null)).digest("hex").slice(0, 12)}`;
}

function patchObjectStationProjection(item = {}, targetStation = {}, move = {}, body = {}) {
  const stationId = String(targetStation.stationId ?? move.newStation ?? "");
  const stationLabel = String(targetStation.stationLabel ?? targetStation.label ?? stationId);
  const stationValue = numeric(targetStation.stationValue ?? targetStation.measureFeet ?? targetStation.stationFeet, numeric(item.stationValue, 0));
  const offset = numeric(body.offset, numeric(item.offset, 0));
  const side = String(body.side ?? item.side ?? "CENTERLINE");
  const orientation = String(body.orientation ?? item.orientation ?? "ALONG_ROUTE");
  const projectedCoordinate = targetStation.coordinate ?? item.projectedCoordinate ?? item.coordinate;
  return {
    ...item,
    stationId,
    station: stationId,
    stationLabel,
    stationValue,
    offset,
    side,
    orientation,
    projectedCoordinate,
    coordinate: projectedCoordinate,
    coordinateAuthority: "STATION_PLUS_OFFSET_ORIENTATION",
    projectionStatus: "PROJECTED",
    projectionHash: deterministicMoveHash({
      objectId: objectIdentity(item),
      stationId,
      stationValue,
      offset,
      side,
      orientation,
      projectedCoordinate,
      moveId: move.moveId,
    }),
  };
}

function patchPackageObjectCollections(draft, objectId, patcher) {
  const patchCollection = (items) => asArray(items).map((item) => {
    if (objectIdentity(item) !== objectId) return item;
    return patcher(item);
  });
  return {
    ...draft,
    objects: patchCollection(draft.objects),
    structures: patchCollection(draft.structures),
    proposedIofUnits: patchCollection(draft.proposedIofUnits),
  };
}

function findPackageObjectRecord(draft, objectId) {
  return [
    ...asArray(draft.objects),
    ...asArray(draft.structures),
    ...asArray(draft.proposedIofUnits),
  ].find((item) => objectIdentity(item) === objectId);
}

async function handleAddConstraint(req, res, user, packageId) {
  const draft = await loadRecord(DIRS.iofPackages, packageId).catch(() => null);
  if (!draft) {
    errorResponse(res, 404, `Draft IOF Package not found: ${packageId}`);
    return;
  }
  if (draft.status === "CERTIFIED") {
    errorResponse(res, 409, "Certified Draft IOF Packages are frozen. Create a new Commercial revision cycle.");
    return;
  }
  const body = await readRequestJson(req);
  const timestamp = nowIso();
  const category = CONSTRAINT_CATEGORIES.has(String(body.category)) ? String(body.category) : "ROW";
  const constraint = {
    constraintId: String(body.constraintId ?? `${draft.packageId}:CONSTRAINT:${Date.now()}`),
    category,
    station: String(body.station ?? body.stationId ?? ""),
    stationRange: String(body.stationRange ?? ""),
    objectReference: String(body.objectReference ?? body.objectId ?? ""),
    severity: ["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(String(body.severity)) ? String(body.severity) : "MEDIUM",
    status: ["OPEN", "IN_REVIEW", "RESOLVED", "ACCEPTED"].includes(String(body.status)) ? String(body.status) : "OPEN",
    engineeringDisposition: String(body.engineeringDisposition ?? body.disposition ?? "PENDING_ENGINEERING_DISPOSITION"),
    notesEvidence: String(body.notesEvidence ?? body.notes ?? body.evidence ?? ""),
    conditionTitle: String(body.conditionTitle ?? body.title ?? body.category ?? "Engineering condition"),
    humanClassification: String(body.humanClassification ?? body.category ?? "Other"),
    humanSeverity: ["INFO", "LOW", "MEDIUM", "HIGH", "BLOCKING"].includes(String(body.humanSeverity)) ? String(body.humanSeverity) : String(body.severity ?? "MEDIUM"),
    conditionContext: {
      ...asRecord(body.conditionContext),
      opportunityId: String(asRecord(body.conditionContext).opportunityId ?? draft.opportunityId ?? ""),
      engineeringPackageId: String(asRecord(body.conditionContext).engineeringPackageId ?? draft.engineeringPackageId ?? ""),
      engineeringRevisionId: String(asRecord(body.conditionContext).engineeringRevisionId ?? draft.engineeringRevisionId ?? ""),
      routeRepositoryId: String(asRecord(body.conditionContext).routeRepositoryId ?? draft.routeRepositoryId ?? ""),
      routeRevision: asRecord(body.conditionContext).routeRevision ?? draft.routeRevision,
      geometryHash: String(asRecord(body.conditionContext).geometryHash ?? draft.geometryHash ?? ""),
      station: String(asRecord(body.conditionContext).station ?? body.station ?? body.stationId ?? ""),
      objectId: String(asRecord(body.conditionContext).objectId ?? body.objectReference ?? body.objectId ?? ""),
      identifiedAt: timestamp,
      humanActor: user.name,
      humanActorId: user.userId,
    },
    actor: user.name,
    actorId: user.userId,
    source: "Engineering Certification",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const saved = await persistDraftPackageMetadataPatch({
    ...draft,
    engineeringConstraints: [...asArray(draft.engineeringConstraints), constraint],
    updatedAt: timestamp,
  }, user, "runtime.engineering_constraint.added", "Engineering constraint added to Draft IOF Package.", { constraintId: constraint.constraintId });
  jsonResponse(res, 200, { packageId: saved.packageId, updatedAt: saved.updatedAt, engineeringConstraints: saved.engineeringConstraints, constraint, metadataPatchOnly: true });
}

async function handleDispositionConstraint(req, res, user, packageId, constraintId) {
  const draft = await loadRecord(DIRS.iofPackages, packageId).catch(() => null);
  if (!draft) {
    errorResponse(res, 404, `Draft IOF Package not found: ${packageId}`);
    return;
  }
  if (draft.status === "CERTIFIED") {
    errorResponse(res, 409, "Certified Draft IOF Packages are frozen. Create a new Commercial revision cycle.");
    return;
  }
  const body = await readRequestJson(req);
  const status = String(body.status ?? "");
  if (!["OPEN", "IN_REVIEW", "RESOLVED", "ACCEPTED"].includes(status)) {
    errorResponse(res, 400, "Engineering condition disposition requires OPEN, IN_REVIEW, RESOLVED, or ACCEPTED status.");
    return;
  }
  const constraints = asArray(draft.engineeringConstraints);
  const index = constraints.findIndex((constraint) => String(constraint?.constraintId ?? constraint?.id ?? "") === constraintId);
  if (index < 0) {
    errorResponse(res, 404, `Engineering constraint not found: ${constraintId}`);
    return;
  }
  const timestamp = nowIso();
  const previous = constraints[index];
  const disposition = {
    disposition: String(body.disposition ?? body.engineeringDisposition ?? (status === "ACCEPTED" ? "ACCEPT" : "ENGINEERING_CHANGE")),
    status,
    reason: String(body.reason ?? body.notesEvidence ?? "Engineering condition disposition recorded."),
    impactSummary: String(body.impactSummary ?? ""),
    actor: user.name,
    actorId: user.userId,
    occurredAt: timestamp,
    authority: "ENGINEERING",
  };
  constraints[index] = {
    ...previous,
    status,
    engineeringDisposition: disposition.disposition,
    notesEvidence: String(body.notesEvidence ?? body.reason ?? previous.notesEvidence ?? ""),
    dispositionHistory: [...asArray(previous.dispositionHistory), disposition],
    dispositionActor: user.name,
    dispositionActorId: user.userId,
    dispositionAt: timestamp,
    updatedAt: timestamp,
  };
  const saved = await persistDraftPackageMetadataPatch({
    ...draft,
    engineeringConstraints: constraints,
    updatedAt: timestamp,
  }, user, "runtime.engineering_constraint.dispositioned", "Engineering constraint disposition recorded.", {
    constraintId,
    previousStatus: previous.status,
    status,
    disposition: disposition.disposition,
  });
  jsonResponse(res, 200, { packageId: saved.packageId, updatedAt: saved.updatedAt, engineeringConstraints: saved.engineeringConstraints, constraint: constraints[index], previousConstraint: previous, metadataPatchOnly: true });
}

async function handleMoveObject(req, res, user, packageId) {
  const draft = await loadDraftPackage(packageId).catch(() => null);
  if (!draft) {
    errorResponse(res, 404, `Draft IOF Package not found: ${packageId}`);
    return;
  }
  if (draft.status === "CERTIFIED") {
    errorResponse(res, 409, "Certified Draft IOF Packages are frozen. Create a new Commercial revision cycle.");
    return;
  }
  const body = await readRequestJson(req);
  const objectId = String(body.objectId ?? "");
  const target = String(body.newStation ?? body.station ?? body.stationId ?? "");
  const reason = String(body.reason ?? "").trim();
  const authority = String(body.authority ?? "").trim();
  if (!objectId || !target || !reason || !authority) {
    errorResponse(res, 400, "Object move requires objectId, newStation, reason, and authority.");
    return;
  }
  const object = findPackageObjectRecord(draft, objectId);
  if (!object) {
    errorResponse(res, 404, `Engineering object not found: ${objectId}`);
    return;
  }
  const type = objectType(object);
  if (!STATION_ATTACHED_OBJECT_TYPES.has(type)) {
    errorResponse(res, 409, `Object ${objectId} is ${type} and cannot be station-moved under Engineering Certification.`);
    return;
  }
  const previousStation = objectStation(object);
  const previousFeet = stationFeet(draft, previousStation);
  const newFeet = stationFeet(draft, target);
  const targetStationRecord = stationRecord(draft, target) ?? {};
  const distanceDelta = Number.isFinite(previousFeet) && Number.isFinite(newFeet)
    ? Math.round(newFeet - previousFeet)
    : numeric(body.distanceDelta, 0);
  const timestamp = nowIso();
  const move = {
    moveId: String(body.moveId ?? `${draft.packageId}:OBJECT-MOVE:${Date.now()}`),
    objectId,
    objectType: type,
    previousStation,
    newStation: target,
    stationValue: numeric(targetStationRecord.stationValue ?? targetStationRecord.measureFeet ?? targetStationRecord.stationFeet, newFeet),
    offset: numeric(body.offset, numeric(object.offset, 0)),
    side: String(body.side ?? object.side ?? "CENTERLINE"),
    orientation: String(body.orientation ?? object.orientation ?? "ALONG_ROUTE"),
    projectedCoordinate: targetStationRecord.coordinate ?? object.projectedCoordinate ?? object.coordinate,
    distanceDelta,
    reason,
    authority,
    actor: user.name,
    actorId: user.userId,
    timestamp,
    impactSummary: String(body.impactSummary ?? `Object station reference changed by ${distanceDelta} ft. Station geometry was not moved.`),
  };
  const patched = patchPackageObjectCollections(draft, objectId, (item) => ({
    ...patchObjectStationProjection(item, targetStationRecord, move, body),
    metadata: {
      ...(item.metadata ?? {}),
      stationId: target,
      stationValue: move.stationValue,
      previousStation,
      latestObjectMoveId: move.moveId,
    },
    engineeringDecision: "OBJECT_STATION_REFERENCE_MOVED",
    updatedAt: timestamp,
  }));
  const patchManifestCollection = (items) => asArray(items).map((item) => (
    objectIdentity(item) === objectId ? patchObjectStationProjection(item, targetStationRecord, move, body) : item
  ));
  const projectedObjectManifest = asRecord(patched.projectedObjectManifest);
  const stationObjectManifest = asRecord(patched.stationObjectManifest);
  const objectStationAttachments = asArray(patched.objectStationAttachments).map((attachment) => {
    if (String(attachment?.objectId ?? "") !== objectId) return attachment;
    return {
      ...attachment,
      stationId: target,
      stationValue: move.stationValue,
      stationRange: `${String(targetStationRecord.stationLabel ?? targetStationRecord.label ?? target)}-${String(targetStationRecord.stationLabel ?? targetStationRecord.label ?? target)}`,
      coordinateAuthority: "STATION_PLUS_OFFSET_ORIENTATION",
      attachmentMethod: "ENGINEERING_STATION_MOVE",
      attachmentStatus: "ASSIGNED",
      status: "PROJECTED",
      projectedCoordinate: move.projectedCoordinate,
      projectionHash: deterministicMoveHash({ attachmentId: attachment.attachmentId, moveId: move.moveId }),
    };
  });
  const revision = {
    revisionId: `${draft.packageId}:ENGINEERING-REVISION:OBJECT-MOVE:${Date.now()}`,
    revisionType: "OBJECT_MOVE",
    packageRevision: numeric(draft.packageRevision, 0),
    objectMoveId: move.moveId,
    createdAt: timestamp,
    actor: user.name,
    noStationGeometryMutation: true,
  };
  const saved = await persistDraftPackage({
    ...patched,
    objectStationAttachments,
    projectedObjects: patchManifestCollection(patched.projectedObjects),
    projectedObjectManifest: {
      ...projectedObjectManifest,
      projectedObjects: patchManifestCollection(projectedObjectManifest.projectedObjects),
      updatedAt: timestamp,
    },
    stationObjectManifest: {
      ...stationObjectManifest,
      objects: patchManifestCollection(stationObjectManifest.objects),
      updatedAt: timestamp,
    },
    objectMoveHistory: [...asArray(draft.objectMoveHistory), move],
    engineeringRevisionMetadata: [...asArray(draft.engineeringRevisionMetadata), revision],
    updatedAt: timestamp,
  }, user, "runtime.engineering_object.move", "Engineering moved station-attached object reference.", { objectMoveId: move.moveId });
  jsonResponse(res, 200, { draftPackage: saved, iofPackage: saved, objectMove: move });
}

async function handleCreateRouteRedline(req, res, user, packageId) {
  const draft = await loadDraftPackage(packageId).catch(() => null);
  if (!draft) {
    errorResponse(res, 404, `Draft IOF Package not found: ${packageId}`);
    return;
  }
  if (draft.status === "CERTIFIED") {
    errorResponse(res, 409, "Certified Draft IOF Packages are frozen. Create a new Commercial revision cycle.");
    return;
  }
  const body = await readRequestJson(req);
  const reason = String(body.reason ?? "").trim();
  const authority = String(body.authority ?? "").trim();
  if (!reason || !authority) {
    errorResponse(res, 400, "Route redline requires reason and authority.");
    return;
  }
  const timestamp = nowIso();
  const nextRevision = numeric(draft.packageRevision, 0) + 1;
  const redline = {
    redlineId: String(body.redlineId ?? `${draft.packageId}:ROUTE-REDLINE:${Date.now()}`),
    packageRevision: nextRevision,
    status: "ENGINEERING_REDLINE_CREATED",
    reason,
    description: String(body.description ?? ""),
    authority,
    actor: user.name,
    actorId: user.userId,
    timestamp,
    affectedStations: String(body.affectedStations ?? ""),
    impactSummary: String(body.impactSummary ?? "Route redline requires governed regeneration before ScopeVersion promotion."),
    regenerationRequired: [
      "route geometry",
      "centerline",
      "spine",
      "graph",
      "stations",
      "object station references",
      "assemblies",
      "quantities",
      "pricing",
      "validation",
      "Draft IOF Package revision",
    ],
    commercialRevisionZeroImmutable: true,
  };
  const revision = {
    revisionId: `${draft.packageId}:ENGINEERING-REVISION:REDLINE:${Date.now()}`,
    revisionType: "ROUTE_REDLINE",
    packageRevision: nextRevision,
    redlineId: redline.redlineId,
    createdAt: timestamp,
    actor: user.name,
    requiresDraftPackageRegeneration: true,
  };
  const saved = await persistDraftPackage({
    ...draft,
    packageRevision: nextRevision,
    redlineRevisionHistory: [...asArray(draft.redlineRevisionHistory), redline],
    engineeringRevisionMetadata: [...asArray(draft.engineeringRevisionMetadata), revision],
    engineeringReadiness: "ROUTE_REDLINE_REQUIRES_COMMERCIAL_REVISION",
    updatedAt: timestamp,
  }, user, "runtime.engineering_route_redline.created", "Engineering route redline created new package revision metadata.", { redlineId: redline.redlineId });
  jsonResponse(res, 200, { draftPackage: saved, iofPackage: saved, redline });
}

async function handleRecordDoctrineException(req, res, user, packageId) {
  const draft = await loadDraftPackage(packageId).catch(() => null);
  if (!draft) {
    errorResponse(res, 404, `Draft IOF Package not found: ${packageId}`);
    return;
  }
  if (draft.status === "CERTIFIED") {
    errorResponse(res, 409, "Certified Draft IOF Packages are frozen. Create a new Commercial revision cycle.");
    return;
  }
  const body = await readRequestJson(req);
  const doctrineRule = String(body.doctrineRule ?? body.rule ?? "").trim();
  const actualCondition = String(body.actualCondition ?? body.condition ?? "").trim();
  const reason = String(body.reason ?? "").trim();
  const approvalAuthority = String(body.approvalAuthority ?? body.authority ?? "").trim();
  const impactSummary = String(body.impactSummary ?? "").trim();
  if (!doctrineRule || !actualCondition || !reason || !approvalAuthority || !impactSummary) {
    errorResponse(res, 400, "Doctrine exception requires doctrineRule, actualCondition, reason, approvalAuthority, and impactSummary.");
    return;
  }
  const timestamp = nowIso();
  const exception = {
    exceptionId: String(body.exceptionId ?? `${draft.packageId}:DOCTRINE-EXCEPTION:${Date.now()}`),
    doctrineRule,
    actualCondition,
    reason,
    approvalAuthority,
    impactSummary,
    actor: user.name,
    actorId: user.userId,
    approvedAt: timestamp,
    status: "APPROVED",
  };
  const saved = await persistDraftPackage({
    ...draft,
    doctrineExceptions: [...asArray(draft.doctrineExceptions), exception],
    updatedAt: timestamp,
  }, user, "runtime.engineering_doctrine_exception.recorded", "Engineering doctrine exception recorded.", { exceptionId: exception.exceptionId });
  jsonResponse(res, 200, { draftPackage: saved, iofPackage: saved, doctrineException: exception });
}

function createExecutionCertificate(certifiedPackage, checklist, user, scopeVersionId = "") {
  const timestamp = nowIso();
  const certifiedUnits = asArray(certifiedPackage.certifiedIofUnits);
  const certificateId = `EXEC-AUTH-${certifiedPackage.certifiedPackageId}`;
  const certifiedDraftIofPackageId = String(
    certifiedPackage.certifiedDraftIofPackageId ??
      certifiedPackage.technicalSourcePackageId ??
      certifiedPackage.sourcePackageId ??
      certifiedPackage.sourceDraftPackageId ??
      certifiedPackage.draftPackageId ??
      "",
  );
  const fingerprintPayload = {
    proposalId: certifiedPackage.proposalId,
    draftPackageId: certifiedDraftIofPackageId,
    certifiedDraftIofPackageId,
    certifiedPackageId: certifiedPackage.certifiedPackageId,
    productId: certifiedPackage.productId,
    fulfillmentPlanId: certifiedPackage.fulfillmentPlanId,
    proposalRecipientContactIds: unique(certifiedPackage.proposalRecipientContactIds).sort(),
    customerReviewContactIds: unique(certifiedPackage.customerReviewContactIds).sort(),
    approvalAuthorityContactIds: unique(certifiedPackage.approvalAuthorityContactIds).sort(),
    sofRecipientContactIds: unique(certifiedPackage.sofRecipientContactIds).sort(),
    scopeVersionId,
    certifiedIofUnitIds: certifiedUnits.map((unit) => unit.unitId).sort(),
    runtimeObjectIds: unique(certifiedPackage.runtimeObjectIds).sort(),
    runtimeRelationshipIds: unique(certifiedPackage.runtimeRelationshipIds).sort(),
    runtimeEvidenceIds: unique(certifiedPackage.runtimeEvidenceIds).sort(),
    checklist,
  };
  return {
    certificateId,
    accountId: certifiedPackage.accountId,
    proposalId: certifiedPackage.proposalId,
    productId: certifiedPackage.productId,
    productName: certifiedPackage.productName,
    fulfillmentPlanId: certifiedPackage.fulfillmentPlanId,
    fulfillmentStrategy: certifiedPackage.fulfillmentStrategy,
    proposalRecipientContactIds: certifiedPackage.proposalRecipientContactIds,
    customerReviewContactIds: certifiedPackage.customerReviewContactIds,
    approvalAuthorityContactIds: certifiedPackage.approvalAuthorityContactIds,
    sofRecipientContactIds: certifiedPackage.sofRecipientContactIds,
    customerContactEmails: certifiedPackage.customerContactEmails,
    draftIofPackageId: certifiedDraftIofPackageId,
    certifiedDraftIofPackageId,
    technicalSourcePackageId: certifiedDraftIofPackageId,
    certifiedIofPackageId: certifiedPackage.certifiedPackageId,
    scopeVersionId,
    engineeringApproverId: user.userId,
    engineeringApprover: user.name,
    certificationTimestamp: timestamp,
    engineeringChecklist: checklist,
    authorityTransfer: {
      from: "EXECUTED_SERVICE_ORDER",
      to: "SCOPEVERSION",
      status: scopeVersionId ? "TRANSFERRED" : "PENDING_EXECUTED_SERVICE_ORDER",
      transferredAt: scopeVersionId ? timestamp : undefined,
      certifiedDraftIofPackageId,
      noAdditionalEngineeringReviewAfterSignature: true,
    },
    runtimeObjectCount: unique(certifiedPackage.runtimeObjectIds).length,
    relationshipCount: unique(certifiedPackage.runtimeRelationshipIds).length,
    evidenceCount: unique(certifiedPackage.runtimeEvidenceIds).length,
    certificationConfidence: checklist.certificationConfidence,
    assemblyFingerprint: hashCertifiedAssembly(fingerprintPayload),
    createdAt: timestamp,
    updatedAt: timestamp,
    status: scopeVersionId ? "RUNTIME_PROMOTED_TO_SCOPEVERSION" : "CERTIFIED_DRAFT_IOF_PACKAGE_PENDING_SIGNED_SERVICE_ORDER",
    immutable: Boolean(scopeVersionId),
  };
}

function createScopeVersionFromCertifiedPackage(certifiedPackage, certificate, user, options = {}) {
  return createScopeVersionAuthority(certifiedPackage, {
    certificate,
    user,
    ...options,
  });
}

async function persistCertificate(certificate) {
  return persistRecord(DIRS.executionAuthorizationCertificates, certificate.certificateId, certificate);
}

async function persistCertificationEvidence(certifiedPackage, certificate, user) {
  const timestamp = nowIso();
  const evidenceId = `EVIDENCE-${certificate.certificateId}`;
  const evidence = {
    evidenceId,
    sourceType: "ENGINEERING_CERTIFICATION_EVIDENCE",
    sourceName: certificate.certificateId,
    sourceSystem: "Engineering Certification Runtime",
    authority: "ENGINEERING_REVIEW",
    validationStatus: "PASS",
    collectedAt: timestamp,
    ingestedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
    lineage: {
      accountId: certifiedPackage.accountId,
      proposalId: certifiedPackage.proposalId,
      productId: certifiedPackage.productId,
      fulfillmentPlanId: certifiedPackage.fulfillmentPlanId,
      draftIofPackageId: certifiedPackage.sourcePackageId,
      certifiedDraftIofPackageId: certifiedPackage.certifiedDraftIofPackageId ?? certifiedPackage.technicalSourcePackageId ?? certifiedPackage.sourcePackageId,
      certifiedIofPackageId: certifiedPackage.certifiedPackageId,
      scopeVersionId: certificate.scopeVersionId,
      certifiedBy: user.userId,
    },
    metadata: {
      accountId: certifiedPackage.accountId,
      customerId: certifiedPackage.customerId,
      productId: certifiedPackage.productId,
      productName: certifiedPackage.productName,
      fulfillmentPlanId: certifiedPackage.fulfillmentPlanId,
      fulfillmentStrategy: certifiedPackage.fulfillmentStrategy,
      proposalRecipientContactIds: certifiedPackage.proposalRecipientContactIds,
      customerReviewContactIds: certifiedPackage.customerReviewContactIds,
      approvalAuthorityContactIds: certifiedPackage.approvalAuthorityContactIds,
      sofRecipientContactIds: certifiedPackage.sofRecipientContactIds,
      customerContactEmails: certifiedPackage.customerContactEmails,
      assemblyFingerprint: certificate.assemblyFingerprint,
      certificationConfidence: certificate.certificationConfidence,
      noMarketplaceCreation: true,
      noContractCreation: true,
      singleEngineeringTruth: true,
      noEngineeringRecreation: true,
    },
  };
  await persistRecord(DIRS.runtimeEvidence, evidenceId, evidence);
  return evidence;
}

async function generateScopeVersion(certifiedPackage, certificate, user, options = {}) {
  if (certifiedPackage.scopeVersionId) {
    const existing = await loadRecord(DIRS.scopeVersions, certifiedPackage.scopeVersionId).catch(() => null);
    if (existing) return { scopeVersion: existing, certifiedPackage, certificate };
  }
  const sourceDraftPackageId = firstText(
    certifiedPackage.sourcePackageId,
    certifiedPackage.sourceDraftPackageId,
    certifiedPackage.certifiedDraftIofPackageId,
    certifiedPackage.technicalSourcePackageId,
  );
  const sourceDraft = sourceDraftPackageId
    ? await hydrateIofProjectionArtifacts(await loadRecord(DIRS.iofPackages, sourceDraftPackageId).catch(() => null))
    : null;
  const routeRepositoryId = firstText(certifiedPackage.routeRepositoryId, sourceDraft?.routeRepositoryId, asRecord(sourceDraft?.routeRepositoryRef).routeRepositoryId);
  const routeRepository = routeRepositoryId ? await loadRecord(DIRS.commercialRoutes, routeRepositoryId).catch(() => null) : null;
  const routeGeometry = asArray(routeRepository?.commercialGeometry);
  const certifiedPackageForPromotion = {
    ...(sourceDraft ?? {}),
    ...certifiedPackage,
    routeRepositoryId,
    centerlineRoute: {
      ...asRecord(sourceDraft?.centerlineRoute),
      routeId: firstText(asRecord(sourceDraft?.centerlineRoute).routeId, routeRepository?.routeId, routeRepositoryId),
      routeFeet: numeric(sourceDraft?.routeFeet, numeric(routeRepository?.routeFeet, 0)),
      routeMiles: numeric(sourceDraft?.routeMiles, numeric(routeRepository?.routeMiles, 0)),
      geometry: routeGeometry.length ? routeGeometry : asRecord(sourceDraft?.centerlineRoute).geometry,
      coordinates: routeGeometry.length ? routeGeometry : asRecord(sourceDraft?.centerlineRoute).coordinates,
    },
    osrmRoute: {
      ...asRecord(sourceDraft?.osrmRoute),
      routeId: firstText(asRecord(sourceDraft?.osrmRoute).routeId, routeRepository?.routeId, routeRepositoryId),
      routeFeet: numeric(sourceDraft?.routeFeet, numeric(routeRepository?.routeFeet, 0)),
      routeMiles: numeric(sourceDraft?.routeMiles, numeric(routeRepository?.routeMiles, 0)),
      geometry: routeGeometry.length ? routeGeometry : asRecord(sourceDraft?.osrmRoute).geometry,
      coordinates: routeGeometry.length ? routeGeometry : asRecord(sourceDraft?.osrmRoute).coordinates,
    },
    quantitySummary: {
      ...asRecord(sourceDraft?.quantitySummary),
      routeFeet: numeric(asRecord(sourceDraft?.quantitySummary).routeFeet, numeric(routeRepository?.routeFeet, 0)),
      routeMiles: numeric(asRecord(sourceDraft?.quantitySummary).routeMiles, numeric(routeRepository?.routeMiles, 0)),
    },
    commercialSummary: {
      ...asRecord(sourceDraft?.commercialSummary),
      ...asRecord(certifiedPackage.commercialSummary),
      routeFeet: numeric(asRecord(sourceDraft?.commercialSummary).routeFeet, numeric(routeRepository?.routeFeet, 0)),
      routeMiles: numeric(asRecord(sourceDraft?.commercialSummary).routeMiles, numeric(routeRepository?.routeMiles, 0)),
    },
    scopeVersionPromotionTrace: {
      sourceDraftPackageId,
      routeRepositoryId,
      measuredCenterlineId: sourceDraft?.measuredCenterlineId,
      stationProjectionId: sourceDraft?.stationProjectionId,
      stationGraphId: sourceDraft?.stationGraphId,
      projectedObjectManifestId: sourceDraft?.projectedObjectManifestId,
      authority: "RUNTIME_SCOPEVERSION_PROMOTION",
      referenceResolution: "CERTIFIED_IOF_PACKAGE_REFERENCES_RESOLVED",
    },
  };
  const previousScopeVersionId = options.previousScopeVersionId ?? options.parentScopeVersionId ?? certifiedPackage.parentScopeVersionId ?? certifiedPackage.previousScopeVersionId;
  const previousScopeVersion = previousScopeVersionId
    ? await loadRecord(DIRS.scopeVersions, previousScopeVersionId).catch(() => null)
    : null;
  const proposedScopeVersion = createScopeVersionFromCertifiedPackage(certifiedPackageForPromotion, certificate, user, {
    previousScopeVersion,
    parentScopeVersionId: previousScopeVersionId,
    customerAcceptance: options.customerAcceptance,
    serviceOrder: options.serviceOrder,
    changeSummary: options.changeSummary,
    engineeringReason: options.engineeringReason,
    approvedBy: options.approvedBy,
    approvedTimestamp: options.approvedTimestamp,
  });
  const existingScopeVersion = await loadRecord(DIRS.scopeVersions, proposedScopeVersion.scopeVersionId).catch(() => null);
  if (existingScopeVersion) {
    if (existingScopeVersion.certifiedIofPackageId === certifiedPackageForPromotion.certifiedPackageId || existingScopeVersion.canonicalTruth?.certifiedIofPackageId === certifiedPackageForPromotion.certifiedPackageId) {
      return { scopeVersion: existingScopeVersion, certifiedPackage: certifiedPackageForPromotion, certificate };
    }
    throw new Error(`ScopeVersion already exists and cannot be overwritten: ${proposedScopeVersion.scopeVersionId}`);
  }
  const scopeVersion = await persistScopeVersion(proposedScopeVersion);
  const nextCertificate = {
    ...certificate,
    scopeVersionId: scopeVersion.scopeVersionId,
    status: "RUNTIME_PROMOTED_TO_SCOPEVERSION",
    immutable: true,
    authorityTransfer: {
      ...certificate.authorityTransfer,
      status: "TRANSFERRED",
      transferredAt: nowIso(),
    },
    updatedAt: nowIso(),
  };
  const nextCertified = markCertifiedPackagePromoted(certifiedPackage, scopeVersion, nextCertificate);
  await persistRecord(DIRS.certifiedIofPackages, nextCertified.certifiedPackageId, nextCertified);
  if (nextCertified.sourcePackageId) {
    const draft = await loadRecord(DIRS.iofPackages, nextCertified.sourcePackageId).catch(() => null);
    if (draft) {
      await persistRecord(DIRS.iofPackages, nextCertified.sourcePackageId, {
        ...draft,
        scopeVersionId: scopeVersion.scopeVersionId,
        scopeVersionCreated: true,
        scopeVersionCreatedAt: nextCertified.scopeVersionCreatedAt,
        engineeringCertificationLocked: true,
        engineeringReadOnly: true,
        immutable: true,
        updatedAt: nowIso(),
      });
    }
  }
  await persistCertificate(nextCertificate);
  await persistCertificationEvidence(nextCertified, nextCertificate, user);
  await appendHistory(nextCertified, user, "runtime.authority_transfer.signed_service_order_to_scopeversion", "Authority transferred from signed Service Order to executable ScopeVersion.", {
    scopeVersionId: scopeVersion.scopeVersionId,
    certificateId: nextCertificate.certificateId,
  });
  await persistRuntimeMirror(nextCertified, user, "CERTIFIED-IOF", nextCertified.certifiedPackageId, { executionAuthorized: true });
  await persistRuntimeMirror(scopeVersion, user, "SCOPEVERSION", scopeVersion.scopeVersionId, { certifiedIofPackageId: nextCertified.certifiedPackageId });
  return { scopeVersion, certifiedPackage: nextCertified, certificate: nextCertificate };
}

async function handleCertifyPackage(req, res, user, packageId) {
  const draft = await loadDraftPackage(packageId).catch(() => null);
  if (!draft) {
    errorResponse(res, 404, `Draft IOF Package not found: ${packageId}`);
    return;
  }
  if (draft.status === "RETURNED_TO_COMMERCIAL") {
    errorResponse(res, 409, "Returned packages require Commercial revision before certification.");
    return;
  }
  const embeddedUnits = proposedUnitsForPackage(draft);
  const governedProjectedObjects = asArray(asRecord(draft.projectedObjectManifest).projectedObjects ?? draft.projectedObjects);
  const usesReferenceOnlyObjectManifest = !embeddedUnits.length && governedProjectedObjects.length > 0;
  const units = embeddedUnits.length
    ? embeddedUnits
    : governedProjectedObjects.map((object, index) => ({
        unitId: firstText(asRecord(object).objectId, asRecord(object).projectedObjectId, `PROJECTED-OBJECT-${index + 1}`),
        status: "CERTIFIED",
        immutable: true,
      }));
  if (!units.length) {
    errorResponse(res, 409, "Draft IOF Package has no Proposed IOF Units or governed Projected Object Manifest.");
    return;
  }
  const unapproved = usesReferenceOnlyObjectManifest ? [] : units.filter((unit) => unit.status !== "CERTIFIED");
  if (unapproved.length) {
    errorResponse(res, 409, "Every Proposed IOF Unit must be certified before package certification.");
    return;
  }
  const body = await readRequestJson(req);
  const checklist = normalizeChecklist(body.checklist ?? body);
  if (!checklistComplete(checklist)) {
    errorResponse(res, 409, "Engineering certification checklist is incomplete.");
    return;
  }
  const unresolvedConstraints = asArray(draft.engineeringConstraints).filter((constraint) => !["RESOLVED", "ACCEPTED"].includes(String(constraint?.status ?? "")));
  if (unresolvedConstraints.length) {
    errorResponse(res, 409, "Engineering constraints must be resolved or explicitly accepted before certification.");
    return;
  }
  const approvedExceptionRules = new Set(asArray(draft.doctrineExceptions).map((exception) => String(exception?.doctrineRule ?? exception?.rule ?? "")));
  const unexceptedFailures = asArray(draft.validation?.checks).filter((check) => {
    const status = String(check?.status ?? "").toUpperCase();
    if (status !== "FAIL") return false;
    const key = String(check?.key ?? "");
    const label = String(check?.label ?? "");
    if (draft.referenceOnly && key === "units" && asArray(asRecord(draft.projectedObjectManifest).projectedObjects).length) return false;
    return !approvedExceptionRules.has(key) && !approvedExceptionRules.has(label);
  });
  if (unexceptedFailures.length) {
    errorResponse(res, 409, "PD-001 compliance failures require approved doctrine exceptions before certification.");
    return;
  }
  const doctrineObjectManifest = asRecord(draft.doctrineObjectManifest ?? draft.engineeringObjectManifest);
  const doctrineObjectValidation = asRecord(draft.doctrineObjectInstantiationValidation ?? doctrineObjectManifest.validation);
  const doctrineObjectCount = numeric(doctrineObjectManifest.objectCount, asArray(doctrineObjectManifest.instantiatedObjects).length);
  const doctrineAddressFailures = numeric(doctrineObjectValidation.missingAddressCount, 0);
  const doctrineStationObjectIndex = asArray(draft.doctrineStationObjectIndex ?? doctrineObjectManifest.stationObjectIndex);
  const doctrineDerivedSpans = asArray(draft.doctrineDerivedSpans ?? doctrineObjectManifest.derivedSpans);
  const doctrineLinearAssetSpanAttachments = asArray(draft.doctrineLinearAssetSpanAttachments ?? doctrineObjectManifest.linearAssetSpanAttachments);
  const doctrineQuantityPlacement = asRecord(draft.doctrineQuantityPlacement ?? doctrineObjectManifest.quantityPlacement);
  const measuredCenterlineId = firstText(draft.measuredCenterlineId, asRecord(draft.measuredCenterline).measuredCenterlineId, asRecord(draft.measuredCenterline).spineId);
  const stationProjectionId = firstText(draft.stationProjectionId, asRecord(draft.stationProjection).stationProjectionId);
  const stationGraphId = firstText(draft.stationGraphId, asRecord(draft.stationGraph).stationGraphId, asRecord(draft.stationIndexedGraph).stationGraphId, asRecord(draft.stationIndexedGraph).graphId);
  const stationAuthorityIds = asArray(draft.stationAuthorityIds ?? asRecord(draft.stationAuthority).stationAuthorityIds ?? asRecord(draft.stationAuthority).authorityId);
  const projectedObjectManifest = asRecord(draft.projectedObjectManifest);
  const projectedObjectManifestId = firstText(draft.projectedObjectManifestId, projectedObjectManifest.manifestId, projectedObjectManifest.projectedObjectManifestId);
  const projectedObjects = asArray(projectedObjectManifest.projectedObjects ?? draft.projectedObjects);
  const projectedSpans = asArray(projectedObjectManifest.projectedSpans ?? draft.projectedSpans);
  const closureLedger = asRecord(draft.closureLedger ?? projectedObjectManifest.closureLedger);
  const iofPackageTwin = asRecord(draft.iofPackageTwin ?? projectedObjectManifest.iofPackageTwin);
  const closureLedgerId = firstText(draft.closureLedgerId, projectedObjectManifest.closureLedgerId, closureLedger.closureLedgerId);
  const iofPackageTwinId = firstText(draft.iofPackageTwinId, projectedObjectManifest.iofPackageTwinId, iofPackageTwin.twinProjectionId);
  const executionGraphId = firstText(draft.executionGraphId, projectedObjectManifest.executionGraphId, iofPackageTwin.executionGraphId);
  const lifecycleGraphId = firstText(draft.lifecycleGraphId, projectedObjectManifest.lifecycleGraphId, iofPackageTwin.lifecycleGraphId);
  const workSegments = asArray(draft.workSegments ?? projectedObjectManifest.workSegments);
  const commercialAuditReconciliation = asRecord(draft.commercialAuditReconciliation ?? projectedObjectManifest.commercialAuditReconciliation);
  const constitutionalStateValidation = asRecord(draft.constitutionalStateValidation ?? projectedObjectManifest.constitutionalStateValidation);
  const doctrineProjectionDiagnostics = asRecord(draft.doctrineProjectionDiagnostics ?? projectedObjectManifest.doctrineProjectionDiagnostics);
  const geometryAuthorityDiagnostics = asRecord(draft.geometryAuthorityDiagnostics ?? projectedObjectManifest.geometryAuthorityDiagnostics ?? doctrineProjectionDiagnostics.geometryAuthorityDiagnostics);
  const doctrineProjectionFailedGates = asArray(doctrineProjectionDiagnostics.failedGates).map(asRecord);
  const invalidProjectedObjects = projectedObjects
    .map(asRecord)
    .filter((object) => !firstText(object.stationAddress, object.stationRange) ||
      !firstText(object.parentSpanId, object.parentSegmentId) ||
      !firstText(object.executionSequenceId, asRecord(object.executionSequence).sequenceId) ||
      !firstText(object.closeSequenceId, asRecord(object.closeSequence).closeSequenceId) ||
      !firstText(object.paymentSequenceId, asRecord(object.paymentSequence).paymentSequenceId) ||
      !(object.coordinate || object.projectedCoordinate || object.geographicCoordinate));
  const invalidStateObjects = projectedObjects
    .map(asRecord)
    .filter((object) => !firstText(object.currentState, object.currentLifecycleState) ||
      !firstText(object.currentAuthority) ||
      !Array.isArray(object.allowedTransitions) ||
      !asRecord(object.auditLedgerHooks).closureLedgerId ||
      !asRecord(object.twinProjectionMetadata).twinProjectionId ||
      !firstText(object.laborTemplate, object.laborTemplateId) ||
      !firstText(object.materialTemplate, object.materialTemplateId) ||
      !firstText(object.evidenceTemplate, object.evidenceTemplateId));
  const invalidStateSpans = projectedSpans
    .map(asRecord)
    .filter((span) => !firstText(span.currentState, span.lifecycleState) ||
      !firstText(span.currentAuthority) ||
      !Array.isArray(span.allowedTransitions) ||
      !asRecord(span.auditLedgerHooks).closureLedgerId ||
      !asRecord(span.twinProjectionMetadata).twinProjectionId ||
      !firstText(span.executionSequenceId) ||
      !firstText(span.closeSequenceId) ||
      !firstText(span.paymentSequenceId));
  const doctrineQuantityPlacementFailures = [
    ["quantityMismatchCount", numeric(doctrineObjectValidation.quantityMismatchCount, 0)],
    ["missingStationAddressCount", numeric(doctrineObjectValidation.missingStationAddressCount, 0)],
    ["sequenceGapCount", numeric(doctrineObjectValidation.sequenceGapCount, 0)],
    ["duplicateObjectIdCount", numeric(doctrineObjectValidation.duplicateObjectIdCount, 0)],
    ["spanDerivationFailureCount", numeric(doctrineObjectValidation.spanDerivationFailureCount, 0)],
    ["unattachedLinearAssetCount", numeric(doctrineObjectValidation.unattachedLinearAssetCount, 0)],
  ].filter(([, count]) => Number(count) > 0);
  if (!doctrineObjectCount) {
    errorResponse(res, 409, "Doctrine Object Manifest is required before Engineering certification.");
    return;
  }
  if (String(doctrineObjectValidation.status ?? "").toUpperCase() === "FAIL" || doctrineAddressFailures > 0) {
    errorResponse(res, 409, "Doctrine Object Manifest validation failed. Every Engineering Object must have a deterministic address before certification.");
    return;
  }
  if (!Object.keys(doctrineQuantityPlacement).length || !doctrineStationObjectIndex.length || !doctrineDerivedSpans.length || !doctrineLinearAssetSpanAttachments.length) {
    errorResponse(res, 409, "Doctrine quantity placement, station sequencing, span derivation, and linear asset attachments are required before Engineering certification.");
    return;
  }
  if (!measuredCenterlineId || !stationProjectionId || !stationGraphId || !stationAuthorityIds.length || !projectedObjectManifestId) {
    errorResponse(res, 409, "Doctrine Projection Engine outputs are required before Engineering certification: measuredCenterlineId, stationProjectionId, stationGraphId, stationAuthorityIds, and projectedObjectManifestId.");
    return;
  }
  if (!closureLedgerId || !iofPackageTwinId || !executionGraphId || !lifecycleGraphId) {
    errorResponse(res, 409, "Constitutional state authority outputs are required before Engineering certification: closureLedgerId, iofPackageTwinId, executionGraphId, and lifecycleGraphId.");
    return;
  }
  const closureWorkSegmentCount = numeric(closureLedger.workSegmentCount, 0);
  const twinWorkSegmentCount = numeric(iofPackageTwin.workSegmentCount, closureWorkSegmentCount);
  if (!closureWorkSegmentCount
    || (workSegments.length > 0 && closureWorkSegmentCount !== workSegments.length)
    || (twinWorkSegmentCount > 0 && closureWorkSegmentCount !== twinWorkSegmentCount)) {
    errorResponse(res, 409, "Closure Ledger validation failed before Engineering certification: governed work-segment counts must be present and reconcile across embedded data or reference-only Twin authority.");
    return;
  }
  if (commercialAuditReconciliation.status !== "PASS") {
    const reason = asArray(commercialAuditReconciliation.failures).map((failure) => JSON.stringify(failure)).join("; ");
    errorResponse(res, 409, `Commercial audit reconciliation failed before Engineering certification: ${reason || "commercial audit status is not PASS"}.`);
    return;
  }
  if (constitutionalStateValidation.status !== "PASS") {
    const reason = asArray(constitutionalStateValidation.failures).join("; ");
    errorResponse(res, 409, `Constitutional state authority validation failed before Engineering certification: ${reason || "state graph status is not PASS"}.`);
    return;
  }
  if (!doctrineProjectionDiagnostics.diagnosticsId) {
    errorResponse(res, 409, "Doctrine Projection Diagnostics are required before Engineering certification.");
    return;
  }
  if (doctrineProjectionDiagnostics.status === "FAIL" || doctrineProjectionFailedGates.length) {
    const reason = doctrineProjectionFailedGates
      .map((gate) => `${firstText(gate.objectType, "UNKNOWN")} ${firstText(gate.gate, "Gate")}: ${firstText(gate.reason, "unknown reason")}`)
      .join("; ");
    errorResponse(res, 409, `Doctrine Projection Diagnostics failed before Engineering certification: ${reason || "unknown failed gate"}.`);
    return;
  }
  if (!geometryAuthorityDiagnostics.diagnosticsId) {
    errorResponse(res, 409, "Geometry Authority diagnostics are required before Engineering certification.");
    return;
  }
  const independentSpanGeometryCount = projectedSpans.filter((span) => Array.isArray(asRecord(span).coordinates)).length;
  const maximumDriftFeet = numeric(geometryAuthorityDiagnostics.maximumDriftFeet, 0);
  if (geometryAuthorityDiagnostics.geometryAuthority !== "PASS" || geometryAuthorityDiagnostics.status !== "PASS" || independentSpanGeometryCount > 0 || maximumDriftFeet > 0) {
    const reason = [
      ...asArray(geometryAuthorityDiagnostics.failures).map((failure) => String(failure)),
      ...(independentSpanGeometryCount ? [`Span contains independent geometry: ${independentSpanGeometryCount}`] : []),
      ...(maximumDriftFeet > 0 ? [`Geometry drift exceeds tolerance: ${maximumDriftFeet} ft`] : []),
    ].filter(Boolean).join("; ");
    errorResponse(res, 409, `Geometry Authority validation failed before Engineering certification: ${reason || "Geometry Authority != PASS"}.`);
    return;
  }
  if (!projectedObjects.length || invalidProjectedObjects.length) {
    errorResponse(res, 409, `Projected Object Manifest validation failed before Engineering certification: ${invalidProjectedObjects.length || "all"} projected object(s) are missing station address, coordinate, parent span, execution sequence, close sequence, or payment sequence.`);
    return;
  }
  if (!draft.referenceOnly && (invalidStateObjects.length || invalidStateSpans.length)) {
    errorResponse(res, 409, `Constitutional state graph validation failed before Engineering certification: ${invalidStateObjects.length} object(s) or ${invalidStateSpans.length} span(s) are missing state, authority, template, audit, or twin metadata.`);
    return;
  }
  if (doctrineQuantityPlacementFailures.length) {
    errorResponse(res, 409, `Doctrine station sequencing validation failed: ${doctrineQuantityPlacementFailures.map(([key, count]) => `${key}=${count}`).join(", ")}.`);
    return;
  }
  const timestamp = nowIso();
  const certifiedPackageId = String(body.certifiedPackageId ?? `CERT-IOF-${draft.packageId}`);
  const certifiedDraftIofPackageId = String(draft.packageId);
  const routeRepositoryId = routeRepositoryIdForPackage(draft);
  const commercialEstimate = commercialEstimateForPackage(draft);
  const engineeringPackageForCertification = await findEngineeringPackageForDraft(draft.packageId).catch(() => null);
  const engineeringRevisionRequest = asRecord(body.engineeringRevision);
  const engineeringRevisionProjectionRequest = asRecord(body.engineeringRevisionProjection);
  const engineeringRevisionId = firstText(
    engineeringRevisionRequest.engineeringRevisionId,
    engineeringRevisionProjectionRequest.revisionId,
    engineeringPackageForCertification?.engineeringRevisionId,
    `ENG-REV-${stableIdPart(engineeringPackageForCertification?.engineeringPackageId ?? draft.packageId)}-000`,
  );
  const engineeringBaselineId = firstText(
    engineeringRevisionRequest.engineeringBaselineId,
    engineeringRevisionProjectionRequest.engineeringBaselineId,
    engineeringPackageForCertification?.engineeringBaselineId,
    draft.engineeringBaselineId,
  );
  const engineeringBaselineHash = firstText(
    engineeringRevisionRequest.engineeringBaselineHash,
    asRecord(engineeringRevisionProjectionRequest.diagnostics).baselineHash,
    engineeringPackageForCertification?.engineeringBaselineHash,
    draft.engineeringBaselineHash,
  );
  const engineeringChangeSets = engineeringRevisionId
    ? await engineeringChangeSetsForRevision(engineeringRevisionId, {
        engineeringBaselineId,
        engineeringPackageId: engineeringPackageForCertification?.engineeringPackageId,
      }).catch(() => [])
    : [];
  const engineeringRevisionProjection = Object.keys(engineeringRevisionProjectionRequest).length
    ? engineeringRevisionProjectionRequest
    : projectEngineeringRevisionFromChangeSets({
        ...asRecord(engineeringPackageForCertification),
        engineeringRevisionId,
        engineeringBaselineId,
        engineeringBaselineHash,
      }, engineeringChangeSets, { engineeringBaselineId, engineeringBaselineHash });
  const engineeringRevisionDiagnostics = asRecord(engineeringRevisionProjection.diagnostics);
  const engineeringRevisionHash = firstText(
    engineeringRevisionRequest.engineeringRevisionHash,
    engineeringRevisionDiagnostics.revisionHash,
  );
  let engineeringApprovalContext;
  let engineeringApproval;
  try {
    engineeringApprovalContext = await resolveEngineeringApprovalContext(engineeringPackageForCertification?.engineeringPackageId, {
      organizationId: user.organizationId,
      tenantId: user.organizationId,
      customerId: draft.customerId,
      opportunityId: draft.opportunityId,
      engineeringRevisionId,
      engineeringRevisionHash,
    });
    engineeringApproval = await requireExactEngineeringApprovalForCertification(engineeringApprovalContext, firstText(body.engineeringApprovalId, asRecord(body.engineeringApproval).approvalId), {
      organizationId: user.organizationId,
      tenantId: user.organizationId,
      customerId: draft.customerId,
      opportunityId: draft.opportunityId,
    });
  } catch (error) {
    jsonResponse(res, Number(error?.status ?? 409), {
      error: error instanceof Error ? error.message : String(error),
      code: error?.code ?? "ENGINEERING_APPROVAL_INTEGRITY_FAILURE",
      ...(asRecord(error?.details)),
    });
    return;
  }
  const engineeringChangeSetIds = unique([
    ...asArray(engineeringRevisionRequest.engineeringChangeSetIds),
    ...asArray(engineeringRevisionProjection.changeSetIds),
    ...engineeringChangeSets.map((changeSet) => changeSet.changeSetId),
  ]);
  const certifiedEngineeringChangeSetIds = [...engineeringChangeSetIds].sort();
  const engineeringCertificationEvidenceId = `ENG-CERT-EVIDENCE-${stableIdPart(certifiedPackageId)}`;
  const stationPlan = normalizeStationPlan(body.stationPlan ?? body.stationPlanEvidence ?? {}, draft, user, timestamp);
  const engineeringApprovedObjectBudget = normalizeEngineeringApprovedObjectBudget(
    body.engineeringApprovedObjectBudget ?? body.objectBudget ?? body.budgetReview ?? {},
    draft,
    user,
    timestamp,
  );
  const engineeringApprovedBudgetTotal = numeric(
    body.engineeringApprovedBudget ?? body.engineeringApprovedBudgetTotal,
    engineeringApprovedObjectBudget.totalApprovedBudget,
  );
  const quantityReconciliation = asRecord(body.quantityReconciliation);
  if (Object.keys(quantityReconciliation).length) {
    const quantityItems = asArray(quantityReconciliation.items).length
      ? asArray(quantityReconciliation.items)
      : asArray(quantityReconciliation.approvedQuantities);
    const unresolvedQuantityItems = quantityItems.filter((item) => {
      const record = asRecord(item);
      return !["MATCH", "RESOLVED", "SUPERSEDED"].includes(firstText(record.status).toUpperCase())
        || !firstText(record.sourceHash)
        || (firstText(record.status).toUpperCase() === "RESOLVED" && !firstText(record.decisionHash));
    });
    if (firstText(quantityReconciliation.status).toUpperCase() !== "PASS" || !firstText(quantityReconciliation.calculationHash) || !quantityItems.length || unresolvedQuantityItems.length) {
      errorResponse(res, 409, "Engineering Quantity Reconciliation must be deterministically PASS with evidence-backed approved quantities before certification.");
      return;
    }
  }
  const constraintSummary = {
    total: asArray(draft.engineeringConstraints).length,
    resolved: asArray(draft.engineeringConstraints).filter((constraint) => String(constraint?.status ?? "").toUpperCase() === "RESOLVED").length,
    accepted: asArray(draft.engineeringConstraints).filter((constraint) => String(constraint?.status ?? "").toUpperCase() === "ACCEPTED").length,
    open: 0,
  };
  const approvedExceptions = asArray(draft.doctrineExceptions);
  const doctrineStatus = approvedExceptions.length ? "PASS_WITH_APPROVED_EXCEPTIONS" : "PASS";
  const certificationRevision = numeric(draft.packageRevision ?? draft.revision, 1);
  const certificationHash = hashCertifiedAssembly({
    certifiedPackageId,
    certifiedDraftIofPackageId,
    opportunityId: draft.opportunityId,
    routeRepositoryId,
    proposalId: draft.proposalId,
    commercialEstimate,
    stationPlanId: stationPlan.stationPlanId,
    stationPlan,
    engineeringApprovedObjectBudget,
    engineeringApprovedBudgetTotal,
    quantityReconciliation,
    engineeringBaselineId,
    engineeringRevisionId,
    engineeringRevisionHash,
    engineeringApprovalId: engineeringApproval.approvalId,
    engineeringApprovalHash: engineeringApproval.approvalHash,
    engineeringChangeSetIds: certifiedEngineeringChangeSetIds,
    certifiedIofUnitIds: units.map((unit) => unit.unitId).sort(),
    reviewer: user.userId,
    timestamp,
  });
  const commercialSummary = asRecord(draft.commercialSummary);
  const proposalSummary = asRecord(draft.proposalSummary);
  const stationProjectionHash = hashCertifiedAssembly({
    stationPlanId: stationPlan.stationPlanId,
    stationCount: numeric(stationPlan.stationCount, asArray(stationPlan.stations).length),
    objectAssignmentCount: numeric(stationPlan.objectAssignmentCount, asArray(stationPlan.objectAssignments).length),
  });
  const objectManifestHash = hashCertifiedAssembly({
    objectManifestId: firstText(draft.objectManifestId, draft.stationObjectManifestId, asRecord(draft.manifest).manifestId),
    certifiedIofUnitIds: units.map((unit) => unit.unitId).sort(),
    unitCount: units.length,
  });
  const commercialReleasePackageId = firstText(
    draft.commercialReleasePackageId,
    commercialSummary.commercialReleasePackageId,
    engineeringPackageForCertification?.commercialReleasePackageId,
    `COMMERCIAL-RELEASE-${stableIdPart(draft.packageId)}`,
  );
  const commercialRevisionId = firstText(
    draft.commercialRevisionId,
    commercialSummary.commercialRevisionId,
    engineeringPackageForCertification?.commercialRevisionId,
    `COMMERCIAL-REVISION-${stableIdPart(draft.opportunityId ?? draft.packageId)}`,
  );
  const commercialRevisionHash = firstText(
    draft.commercialRevisionHash,
    commercialSummary.commercialRevisionHash,
    engineeringPackageForCertification?.commercialRevisionHash,
    hashCertifiedAssembly({ commercialRevisionId, routeRepositoryId, proposalId: draft.proposalId }),
  );
  const certificationLedgerEntry = await persistCertificationLedgerEntry({
    certificationId: `ENG-CERT-${stableIdPart(certifiedPackageId)}`,
    certificationLedgerId: `CERT-LEDGER-${stableIdPart(certifiedPackageId)}`,
    certifiedPackageId,
    engineeringBaselineId,
    engineeringRevisionId,
    engineeringRevisionHash,
    engineeringApprovalId: engineeringApproval.approvalId,
    engineeringApprovalHash: engineeringApproval.approvalHash,
    engineeringChangeSetIds: certifiedEngineeringChangeSetIds,
    commercialReleasePackageId,
    commercialRevisionId,
    commercialRevisionHash,
    routeRepositoryId,
    measuredCenterlineId,
    stationProjectionId,
    stationGraphId,
    stationAuthorityIds,
    engineeringObjectManifestId: firstText(draft.engineeringObjectManifestId, draft.doctrineObjectManifestId, draft.objectManifestId),
    stationObjectManifestId: firstText(draft.stationObjectManifestId, asRecord(draft.stationObjectManifest).stationObjectManifestId, asRecord(draft.stationObjectManifest).manifestId),
    projectedObjectManifestId,
    closureLedgerId,
    iofPackageTwinId,
    executionGraphId,
    lifecycleGraphId,
    commercialAuditStatus: firstText(commercialAuditReconciliation.status),
    constitutionalStateValidationStatus: firstText(constitutionalStateValidation.status),
    geometryAuthorityDiagnostics,
    proposalId: draft.proposalId,
    estimateId: commercialEstimate.estimateId,
    workbookId: firstText(draft.workbookId, draft.commercialWorkbookId, commercialSummary.workbookId, commercialSummary.commercialWorkbookId),
    productDoctrineId: firstText(draft.productDoctrineId, draft.doctrineId, commercialSummary.productDoctrineId, proposalSummary.productDoctrineId, "PD-001"),
    engineeringDoctrineId: firstText(draft.engineeringDoctrineId, asRecord(draft.productionDoctrine).engineeringDoctrineId, "PD-006"),
    certificationTimestamp: timestamp,
    certifiedBy: user.name,
    certifiedById: user.userId,
    certifiedByPrincipalId: user.principalId ?? user.userId,
    certifiedByMembershipId: user.membershipId,
    certifiedBySessionId: user.sessionId,
    actorDisplayNameAtAction: user.displayName ?? user.name,
    reviewStatus: "ENGINEERING_CERTIFIED",
    engineeringDoctrineVersion: firstText(draft.engineeringDoctrineVersion, draft.engineeringDoctrineId, "PD-006"),
    commercialDoctrineVersion: firstText(draft.commercialDoctrineVersion, commercialSummary.commercialDoctrineId, "PD-005"),
    stationProjectionHash,
    objectManifestHash,
    certificationHash,
    result: "CERTIFIED",
    stationPlanId: stationPlan.stationPlanId,
    stationProjectionId: firstText(draft.stationProjectionId, draft.stationGraphId, stationPlan.stationPlanId),
    objectManifestId: firstText(draft.objectManifestId, draft.stationObjectManifestId, asRecord(draft.manifest).manifestId),
    budgetId: engineeringApprovedObjectBudget.budgetId,
    engineeringApprovedBudgetId: engineeringApprovedObjectBudget.budgetId,
    validationId: asRecord(draft.validation).validationId,
    dependencyGraphId: asRecord(draft.dependencyGraph).graphId,
    engineeringCertificationEvidenceId,
    certifiedIofUnitIds: units.map((unit) => unit.unitId).sort(),
    quantityReconciliationId: quantityReconciliation.reconciliationId,
    quantityReconciliationRevisionId: quantityReconciliation.revisionId,
    quantityReconciliationHash: quantityReconciliation.calculationHash,
    quantitySourceHash: quantityReconciliation.sourceHash,
    approvedQuantityDecisionHashes: asArray(quantityReconciliation.approvedQuantities).map((item) => asRecord(item).decisionHash).filter(Boolean).sort(),
    quantityDoctrineExceptionIds: asArray(quantityReconciliation.doctrineExceptionIds).sort(),
  });
  const certifiedPackage = CertifiedIofPackageProjection(certificationLedgerEntry, {
    certifiedDraftIofPackageId,
    technicalSourcePackageId: certifiedDraftIofPackageId,
    sourcePackageId: draft.packageId,
    sourceDraftPackageId: draft.packageId,
    draftIOFPackageId: draft.packageId,
    opportunityId: draft.opportunityId,
    customerId: draft.customerId,
    accountId: draft.accountId,
    productId: draft.productId,
    productName: draft.productName,
    productVersion: draft.productVersion,
    doctrineId: draft.doctrineId,
    doctrineVersion: firstText(draft.doctrineVersion, draft.productDoctrineVersion),
    quantityReconciliation,
    approvedQuantities: asArray(quantityReconciliation.approvedQuantities),
    quantityReconciliationHash: quantityReconciliation.calculationHash,
    quantityDoctrineExceptionIds: asArray(quantityReconciliation.doctrineExceptionIds),
    quantityDoctrineExceptions: asArray(quantityReconciliation.doctrineExceptions),
    commercialReleaseState: firstText(draft.commercialReleaseState, commercialSummary.commercialReleaseState, "FROZEN"),
    iofArtifactRepositoryReferences: draft.iofArtifactRepositoryReferences,
    closureLedgerId,
    iofPackageTwinId,
    executionGraphId,
    lifecycleGraphId,
    commercialAuditStatus: firstText(commercialAuditReconciliation.status),
    constitutionalStateValidationStatus: firstText(constitutionalStateValidation.status),
    geometryAuthorityDiagnostics,
    closeSequenceReferences: asArray(draft.closeSequenceReferences),
    evidenceRequirementReferences: asArray(draft.evidenceRequirements).map((requirement) => {
      const record = asRecord(requirement);
      return firstText(record.evidenceRequirementId, record.id);
    }).filter(Boolean),
    scopeVersionReadinessRequirementReferences: asArray(draft.scopeVersionReadinessRequirements).map((requirement) => {
      const record = asRecord(requirement);
      return firstText(record.requirementId, record.id);
    }).filter(Boolean),
    timestamp,
    createdAt: timestamp,
  });
  await persistRecord(DIRS.certifiedIofPackages, certifiedPackageId, certifiedPackage);
  const certifiedIofTwin = await materializeCertifiedIofTwin({
    draft: {
      ...draft,
      engineeringPackageId: engineeringPackageForCertification?.engineeringPackageId,
    },
    certifiedPackage,
    certificationLedgerEntry,
    stationPlan,
    timestamp,
  });
  await persistRuntimeMirror(certifiedPackage, user, "CERTIFIED-IOF", certifiedPackageId, {
    status: "CERTIFIED",
    noScopeVersionCreation: true,
  });
  const frozenDraft = await persistDraftPackage({
    ...draft,
    status: "CERTIFIED",
    workflowStatus: "CERTIFIED_IOF_PACKAGE",
    authority: "ENGINEERING_CERTIFICATION",
    lifecycleState: "CERTIFIED",
    engineeringStatus: "CERTIFIED",
    certifiedPackageId,
    certifiedDraftIofPackageId,
    technicalSourcePackageId: certifiedDraftIofPackageId,
    sourceEngineeringTruthId: engineeringRevisionId,
    sourceEngineeringBaselineId: engineeringBaselineId,
    sourceEngineeringRevisionId: engineeringRevisionId,
    singleEngineeringTruth: true,
    noEngineeringRecreation: true,
    readyForCustomerCommitment: true,
    routeRepositoryId,
    commercialEstimate,
    engineeringBaselineId,
    engineeringBaselineHash,
    engineeringRevisionId,
    engineeringRevisionHash,
    engineeringApprovalId: engineeringApproval.approvalId,
    engineeringApprovalHash: engineeringApproval.approvalHash,
    engineeringChangeSetIds: certifiedEngineeringChangeSetIds,
    engineeringRevisionPatchCount: Number(engineeringRevisionDiagnostics.activePatchCount ?? engineeringRevisionRequest.activePatchCount ?? 0),
    engineeringRevisionAppliedPatchCount: Number(engineeringRevisionDiagnostics.appliedPatchCount ?? engineeringRevisionRequest.appliedPatchCount ?? 0),
    certificationConsumesEngineeringRevision: true,
    certifiedIofPackageConsumesEngineeringRevision: true,
    engineeringPackageIntakeOnly: true,
    noBaselineMutation: true,
    noEngineeringPackageMutation: true,
    stationPlanId: stationPlan.stationPlanId,
    stationPlan: draft.referenceOnly ? {
      stationPlanId: stationPlan.stationPlanId,
      stationProjectionId,
      stationGraphId,
      stationCount: stationPlan.stationCount,
      objectAssignmentCount: stationPlan.objectAssignmentCount,
      status: stationPlan.status,
      certifiedBy: stationPlan.certifiedBy,
      certifiedAt: stationPlan.certifiedAt,
      referenceOnly: true,
      immutable: true,
    } : stationPlan,
    engineeringApprovedObjectBudget,
    engineeringApprovedBudget: engineeringApprovedBudgetTotal,
    engineeringApprovedBudgetTotal,
    quantityReconciliation,
    approvedQuantities: asArray(quantityReconciliation.approvedQuantities),
    quantityReconciliationHash: quantityReconciliation.calculationHash,
    quantityDoctrineExceptionIds: asArray(quantityReconciliation.doctrineExceptionIds),
    quantityDoctrineExceptions: asArray(quantityReconciliation.doctrineExceptions),
    engineeringReviewer: user.name,
    engineeringReviewerId: user.userId,
    certificationTimestamp: timestamp,
    certificationRevision,
    certificationHash: certificationLedgerEntry.certificationHash,
    certificationLedgerId: certificationLedgerEntry.certificationLedgerId,
    certificationId: certificationLedgerEntry.certificationId,
    certificationEvidenceManifestId: certificationLedgerEntry.certificationEvidenceManifestId,
    certificationEvidenceHash: certificationLedgerEntry.certificationEvidenceHash,
    certifiedPackageHash: certificationLedgerEntry.certifiedPackageHash,
    certifiedPackageProjectionOnly: true,
    certifiedIofTwinStateId: certifiedIofTwin.twinStateId,
    certifiedIofTwinId: certifiedIofTwin.twinId,
    twinState: "CERTIFIED",
    executionState: "NOT_AUTHORIZED",
    serviceOrderState: "NOT_CREATED",
    scopeVersionState: "NOT_CREATED",
    serviceOrderStatus: "SERVICE_ORDER_READY",
    signatureStatus: "AWAITING_CUSTOMER_SIGNATURE",
    scopeVersionStatus: "BLOCKED_UNTIL_SIGNED_SERVICE_ORDER",
    scopeVersionFuture: true,
    certifiedId: certifiedPackageId,
    certificationDate: timestamp,
    certifiedAt: timestamp,
    certifiedBy: user.name,
    certifiedById: user.userId,
    certifiedByPrincipalId: user.principalId ?? user.userId,
    certifiedByMembershipId: user.membershipId,
    certifiedBySessionId: user.sessionId,
    actorDisplayNameAtAction: user.displayName ?? user.name,
    proposedIofUnits: usesReferenceOnlyObjectManifest ? asArray(draft.proposedIofUnits) : units.map((unit) => ({ ...unit, immutable: true })),
    certifiedIofUnitIds: units.map((unit) => unit.unitId).sort(),
    certifiedUnitsFromProjectedObjectManifest: usesReferenceOnlyObjectManifest,
    noScopeVersionCreation: true,
    noAdditionalEngineeringReviewAfterSignature: true,
    immutable: true,
  }, user, "runtime.iof_package.certified", "Draft IOF Package certified by Engineering.", { reuseArtifactReferences: true });
  await appendHistory(frozenDraft, user, "runtime.engineering_checklist.completed", "Engineering Certification checklist completed.", { checklist });
  await persistEngineeringIntakeStatus(frozenDraft, user, "CERTIFIED", {
    certifiedAt: timestamp,
    certifiedBy: user.name,
    certifiedById: user.userId,
    certifiedPackageId,
    certifiedDraftIofPackageId,
    stationPlanId: stationPlan.stationPlanId,
    engineeringApprovedBudgetTotal,
    certificationHash: certificationLedgerEntry.certificationHash,
    certificationLedgerId: certificationLedgerEntry.certificationLedgerId,
    certificationId: certificationLedgerEntry.certificationId,
    certificationEvidenceManifestId: certificationLedgerEntry.certificationEvidenceManifestId,
    certificationEvidenceHash: certificationLedgerEntry.certificationEvidenceHash,
    certifiedPackageHash: certificationLedgerEntry.certifiedPackageHash,
    engineeringBaselineId,
    engineeringRevisionId,
    engineeringRevisionHash,
    engineeringChangeSetIds: certifiedEngineeringChangeSetIds,
    engineeringCertificationEvidenceId,
    certificationConsumesEngineeringRevision: true,
    certifiedIofPackageConsumesEngineeringRevision: true,
    engineeringPackageIntakeOnly: true,
    serviceOrderStatus: "SERVICE_ORDER_READY",
    signatureStatus: "AWAITING_CUSTOMER_SIGNATURE",
    scopeVersionStatus: "BLOCKED_UNTIL_SIGNED_SERVICE_ORDER",
    readyForCustomerCommitment: true,
  });
  const engineeringPackage = await findEngineeringPackageForDraft(draft.packageId).then((record) => (
    record
      ? updateEngineeringPackageStatus(record.engineeringPackageId, user, "ENGINEERING_CERTIFIED", {
          stationPlanId: stationPlan.stationPlanId,
          certifiedIofPackageId: certifiedPackageId,
          certificationLedgerId: certificationLedgerEntry.certificationLedgerId,
          certificationId: certificationLedgerEntry.certificationId,
          certificationHash: certificationLedgerEntry.certificationHash,
          certificationEvidenceManifestId: certificationLedgerEntry.certificationEvidenceManifestId,
          certificationEvidenceHash: certificationLedgerEntry.certificationEvidenceHash,
          certifiedPackageHash: certificationLedgerEntry.certifiedPackageHash,
          certifiedPackageProjectionOnly: true,
          certifiedIofTwinStateId: certifiedIofTwin.twinStateId,
          certifiedIofTwinId: certifiedIofTwin.twinId,
          engineeringRevisionState: "CERTIFIED_FROM_ENGINEERING_REVISION",
          engineeringRevisionHash,
          engineeringChangeSetIds: certifiedEngineeringChangeSetIds,
          engineeringCertificationEvidenceId,
          certificationConsumesEngineeringRevision: true,
          engineeringPackageIntakeOnly: true,
          serviceOrderStatus: "SERVICE_ORDER_READY",
          signatureStatus: "AWAITING_CUSTOMER_SIGNATURE",
          scopeVersionStatus: "BLOCKED_UNTIL_SIGNED_SERVICE_ORDER",
          certifiedAt: timestamp,
          certifiedBy: user.name,
          certifiedById: user.userId,
        })
      : null
  )).catch(() => null);
  jsonResponse(res, 200, {
    draftPackage: frozenDraft,
    certifiedIofPackage: certifiedPackage,
    certificationLedgerEntry,
    certifiedIofTwin,
    engineeringPackage,
  });
}

async function handleGenerateScopeVersion(req, res, user, certifiedPackageId) {
  const certified = await loadRecord(DIRS.certifiedIofPackages, certifiedPackageId).catch(() => null);
  if (!certified) {
    errorResponse(res, 404, `Certified Draft IOF Package not found: ${certifiedPackageId}`);
    return;
  }
  if (certified.status !== "CERTIFIED") {
    errorResponse(res, 409, "Only Certified Draft IOF Packages may generate ScopeVersions.");
    return;
  }
  const certificate = certified.executionAuthorizationCertificateId
    ? await loadRecord(DIRS.executionAuthorizationCertificates, certified.executionAuthorizationCertificateId).catch(() => null)
    : null;
  const nextCertificate = certificate ?? createExecutionCertificate(certified, certified.engineeringChecklist ?? {}, user);
  const body = await readRequestJson(req);
  let generated;
  try {
    generated = await generateScopeVersion(certified, nextCertificate, user, {
      previousScopeVersionId: body.previousScopeVersionId ?? body.parentScopeVersionId,
      parentScopeVersionId: body.parentScopeVersionId,
      customerAcceptance: body.customerAcceptance,
      serviceOrder: body.serviceOrder ?? body.signedServiceOrder,
      changeSummary: body.changeSummary,
      engineeringReason: body.engineeringReason,
      approvedBy: body.approvedBy,
      approvedTimestamp: body.approvedTimestamp,
    });
  } catch (error) {
    errorResponse(res, 409, error instanceof Error ? error.message : String(error));
    return;
  }
  const workspaceSession = await updateRuntimeWorkspaceSession({
    accountId: generated.certifiedPackage.accountId,
    customerId: generated.certifiedPackage.customerId,
    sessionUserId: generated.certifiedPackage.ownerId ?? generated.certifiedPackage.commercialOwnerId,
    sessionUserName: generated.certifiedPackage.owner ?? generated.certifiedPackage.commercialOwner,
    workspaceId: generated.certifiedPackage.workspaceId,
    organizationId: generated.certifiedPackage.organizationId,
    opportunityId: generated.certifiedPackage.opportunityId,
    productId: generated.certifiedPackage.productId,
    fulfillmentPlanId: generated.certifiedPackage.fulfillmentPlanId,
    proposalId: generated.certifiedPackage.proposalId,
    packageId: generated.certifiedPackage.sourcePackageId,
    certifiedPackageId: generated.certifiedPackage.certifiedPackageId,
    certifiedDraftIofPackageId: generated.certifiedPackage.certifiedDraftIofPackageId ?? generated.certifiedPackage.sourcePackageId,
    scopeVersionId: generated.scopeVersion.scopeVersionId,
    currentRuntimeObject: generated.scopeVersion.scopeVersionId,
    currentAuthority: "SCOPEVERSION",
    currentLifecycleStage: "SCOPEVERSION_AUTHORITY",
    selectedRoute: asArray(generated.certifiedPackage.geometryReferences)[0],
    selectedGraph: asArray(generated.certifiedPackage.runtimeObjectIds)[0],
    selectedPackage: generated.certifiedPackage.sourcePackageId,
    selectedProposalRevision: generated.certifiedPackage.sourceProposalVersion,
    engineeringRevision: generated.certifiedPackage.packageRevision,
    sessionState: "ACTIVE",
    lastActivity: "EXECUTION_AUTHORIZED",
  }, user, "AUTHORITY_TRANSFER_SIGNED_SERVICE_ORDER_TO_SCOPEVERSION", "Signed Service Order promoted Certified Draft IOF Package into immutable ScopeVersion authority.");
  jsonResponse(res, 200, {
    ...generated,
    certifiedIofPackage: generated.certifiedPackage,
    executionAuthorizationCertificate: generated.certificate,
    workspaceSession,
  });
}

async function handleCertifiedList(res) {
  jsonResponse(res, 200, { certifiedIofPackages: sortedByUpdated(await listRecords(DIRS.certifiedIofPackages)) });
}

async function handleCertificateList(res) {
  jsonResponse(res, 200, { executionAuthorizationCertificates: sortedByUpdated(await listRecords(DIRS.executionAuthorizationCertificates)) });
}

export async function handleEngineeringCertification(req, res, pathname) {
  const parts = routeParts(pathname);
  if (!parts) return false;
  if (handleOptions(req, res)) return true;

  const readOnly = req.method === "GET";
  const requiresScopeVersionAuthority = req.method === "POST" && parts[0] === "certified-packages" && parts[1] && parts[2] === "generate-scopeversion";
  const user = readOnly
    ? requireAnyPermission(req, res, ["workspace.engineering.read", "workspace.engineering.write", "scopeversion.authority"], "You do not have authority to read Engineering Certification.")
    : requiresScopeVersionAuthority
      ? requireAnyPermission(req, res, ["scopeversion.authority"], "Only Runtime ScopeVersion authority may create ScopeVersions after executed Service Order.")
      : requireAnyPermission(req, res, ["workspace.engineering.write", "scopeversion.authority"], "Only Engineering may certify IOF Packages.");
  if (!user) return true;

  if (req.method === "GET" && (parts.length === 0 || parts[0] === "queue")) {
    jsonResponse(res, 200, { engineeringReviewQueue: await listReviewQueue() });
    return true;
  }

  if (req.method === "POST" && parts[0] === "draft-packages" && parts[1] === "from-proposal") {
    await handleAssembleFromProposal(req, res, user);
    return true;
  }

  if (req.method === "GET" && parts[0] === "draft-packages" && parts.length === 1) {
    const engineeringPackages = await listEngineeringPackages({ openOnly: true });
    const draftPackages = (await Promise.all(engineeringPackages.map(async (engineeringPackage) => {
      const resolved = await resolveEngineeringPackageForCertification(engineeringPackage.engineeringPackageId).catch(() => null);
      if (!resolved) return null;
      return decorateDraftPackageWithEngineeringPackage(resolved.draft, engineeringPackage, resolved.referenceIntegrity, resolved.routeRepository);
    }))).filter(Boolean);
    jsonResponse(res, 200, { draftPackages: sortedByUpdated(draftPackages), engineeringPackages });
    return true;
  }

  if (req.method === "GET" && parts[0] === "draft-packages" && parts[1] && parts[2] === "manifest") {
    const draft = await loadDraftPackage(parts[1]).catch(() => null);
    if (!draft) errorResponse(res, 404, `Draft IOF Package not found: ${parts[1]}`);
    else jsonResponse(res, 200, { manifest: draft.manifest, draftPackage: draft });
    return true;
  }

  if (req.method === "GET" && parts[0] === "draft-packages" && parts[1] && parts[2] === "graph") {
    const draft = await loadDraftPackage(parts[1]).catch(() => null);
    if (!draft) errorResponse(res, 404, `Draft IOF Package not found: ${parts[1]}`);
    else jsonResponse(res, 200, { dependencyGraph: draft.dependencyGraph, draftPackage: draft });
    return true;
  }

  if (req.method === "GET" && parts[0] === "draft-packages" && parts[1] && parts[2] === "readiness") {
    const draft = await loadDraftPackage(parts[1]).catch(() => null);
    if (!draft) errorResponse(res, 404, `Draft IOF Package not found: ${parts[1]}`);
    else jsonResponse(res, 200, { packageReadiness: draft.packageReadiness, validation: draft.validation, draftPackage: draft });
    return true;
  }

  if (req.method === "GET" && parts[0] === "draft-packages" && parts[1] && parts[2] === "differences") {
    const draft = await loadDraftPackage(parts[1]).catch(() => null);
    if (!draft) {
      errorResponse(res, 404, `Draft IOF Package not found: ${parts[1]}`);
    } else {
      const proposal = draft.proposalId ? await loadRecord(DIRS.proposalDrafts, draft.proposalId).catch(() => null) : null;
      jsonResponse(res, 200, { packageDifferences: buildPackageDifferences(draft, proposal), draftPackage: draft });
    }
    return true;
  }

  if (req.method === "GET" && parts[0] === "draft-packages" && parts[1] && parts.length === 2) {
    const draft = await openDraftPackageForEngineering(parts[1], user);
    if (!draft) errorResponse(res, 404, `Draft IOF Package not found: ${parts[1]}`);
    else jsonResponse(res, 200, { iofPackage: draft, draftPackage: draft });
    return true;
  }

  if (req.method === "POST" && parts[0] === "draft-packages" && parts[1] && parts[2] === "assign-engineer") {
    await handleAssignEngineer(req, res, user, parts[1]);
    return true;
  }

  if (req.method === "POST" && parts[0] === "draft-packages" && parts[1] && parts[2] === "return-commercial") {
    await handleReturnToCommercial(req, res, user, parts[1]);
    return true;
  }

  if (req.method === "POST" && parts[0] === "draft-packages" && parts[1] && parts[2] === "constraints") {
    if (parts[3] && parts[4] === "disposition") await handleDispositionConstraint(req, res, user, parts[1], parts[3]);
    else await handleAddConstraint(req, res, user, parts[1]);
    return true;
  }

  if (req.method === "POST" && parts[0] === "draft-packages" && parts[1] && parts[2] === "object-moves") {
    await handleMoveObject(req, res, user, parts[1]);
    return true;
  }

  if (req.method === "POST" && parts[0] === "draft-packages" && parts[1] && parts[2] === "route-redlines") {
    await handleCreateRouteRedline(req, res, user, parts[1]);
    return true;
  }

  if (req.method === "POST" && parts[0] === "draft-packages" && parts[1] && parts[2] === "doctrine-exceptions") {
    await handleRecordDoctrineException(req, res, user, parts[1]);
    return true;
  }

  if (req.method === "POST" && parts[0] === "draft-packages" && parts[1] && parts[2] === "certify") {
    await handleCertifyPackage(req, res, user, parts[1]);
    return true;
  }

  if (req.method === "POST" && parts[0] === "draft-packages" && parts[1] && parts[2] === "units" && parts[3] && parts[4]) {
    const action = parts[4];
    if (!["certify", "modify", "reject", "split", "merge"].includes(action)) {
      errorResponse(res, 405, "Unsupported IOF Unit certification action.");
    } else {
      await updateUnit(req, res, user, parts[1], parts[3], action);
    }
    return true;
  }

  if (req.method === "GET" && parts[0] === "certified-packages" && parts.length === 1) {
    await handleCertifiedList(res);
    return true;
  }

  if (req.method === "GET" && parts[0] === "certified-packages" && parts[1]) {
    const certified = await loadRecord(DIRS.certifiedIofPackages, parts[1]).catch(() => null);
    if (!certified) errorResponse(res, 404, `Certified Draft IOF Package not found: ${parts[1]}`);
    else jsonResponse(res, 200, { certifiedIofPackage: certified });
    return true;
  }

  if (req.method === "POST" && parts[0] === "certified-packages" && parts[1] && parts[2] === "generate-scopeversion") {
    errorResponse(res, 409, "ScopeVersion creation is only legal inside the atomic authorized Teralinx countersignature transaction at /api/service-orders/:id/countersign.");
    return true;
  }

  if (req.method === "GET" && parts[0] === "certificates" && parts.length === 1) {
    await handleCertificateList(res);
    return true;
  }

  if (req.method === "GET" && parts[0] === "certificates" && parts[1]) {
    const certificate = await loadRecord(DIRS.executionAuthorizationCertificates, parts[1]).catch(() => null);
    if (!certificate) errorResponse(res, 404, `Certification evidence not found: ${parts[1]}`);
    else jsonResponse(res, 200, { executionAuthorizationCertificate: certificate });
    return true;
  }

  errorResponse(res, 405, "Engineering Certification method not allowed.");
  return true;
}
