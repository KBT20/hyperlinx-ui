import { createHash } from "node:crypto";
import {
  DIRS,
  createId,
  errorResponse,
  handleOptions,
  jsonResponse,
  listRecords,
  loadRecord,
  nowIso,
  persistRecord,
  readRequestJson,
  sortedByUpdated,
  unwrapBody,
} from "./_shared.js";
import { requireAnyPermission } from "./authority.js";
import { persistScopeVersion } from "./scopeversions.js";

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

function unique(values) {
  return [...new Set(asArray(values).filter(Boolean).map(String))];
}

function numeric(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
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
  return normalizeDraftPackage(await loadRecord(DIRS.iofPackages, packageId));
}

async function decorateDraftPackageForResponse(record) {
  const draft = normalizeDraftPackage(record);
  const proposal = draft.proposalId ? await loadRecord(DIRS.proposalDrafts, draft.proposalId).catch(() => null) : null;
  return normalizeDraftPackage({
    ...draft,
    packageDifferences: buildPackageDifferences(draft, proposal),
  });
}

async function persistDraftPackage(record, user, eventType = "runtime.iof_package.saved", details = "Draft IOF Package saved.") {
  const normalized = normalizeDraftPackage(record);
  const history = await appendHistory(normalized, user, eventType, details);
  const next = normalizeDraftPackage({
    ...normalized,
    historyIds: unique([...normalized.historyIds, history.historyId]),
    updatedAt: history.timestamp,
  });
  await persistRecord(DIRS.iofPackages, next.packageId, next);
  await persistRuntimeMirror(next, user, "DRAFT-IOF", next.packageId, { status: next.status, workflowStatus: next.workflowStatus });
  return next;
}

function packageQueueItem(record) {
  const draft = normalizeDraftPackage(record);
  return {
    packageId: draft.packageId,
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
    packageStatus: draft.status,
    assignedEngineer: draft.assignedEngineer || draft.assignedEngineerId || "Unassigned",
    assignedEngineerId: draft.assignedEngineerId,
    priority: draft.priority,
    submissionDate: draft.submittedAt,
    submittedAt: draft.submittedAt,
    customer: draft.customerSummary?.name ?? draft.customerId,
    customerId: draft.customerId,
    opportunity: draft.opportunityId,
    opportunityId: draft.opportunityId,
    proposalId: draft.proposalId,
    proposedUnitCount: draft.packageReadiness.proposedUnitCount,
    certifiedUnitCount: draft.packageReadiness.certifiedUnitCount,
    status: draft.status,
    updatedAt: draft.updatedAt,
  };
}

export async function listReviewQueue() {
  const records = await listRecords(DIRS.iofPackages);
  return sortedByUpdated(records
    .map(normalizeDraftPackage)
    .filter((record) => !["CERTIFIED", "CLOSED", "ARCHIVED"].includes(record.status))
    .map(packageQueueItem));
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
  const packageId = String(body.packageId ?? `DRAFT-IOF-${proposalId}`);
  const existing = await loadRecord(DIRS.iofPackages, packageId).catch(() => null)
    ?? (await listRecords(DIRS.iofPackages)).find((record) => record?.proposalId === proposalId && !["ARCHIVED", "CLOSED"].includes(String(record?.status ?? "")));
  if (existing && options.idempotent !== false) {
    return {
      created: false,
      iofPackage: await decorateDraftPackageForResponse(existing),
      draftPackage: await decorateDraftPackageForResponse(existing),
      proposal,
    };
  }
  const proposedIofUnits = unitsFromProposal(proposal, packageId);
  if (!proposedIofUnits.length) {
    throw runtimeError(409, "Approved Proposal has no runtime or geometry references to assemble.");
  }
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
    proposalId,
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
    },
    commercialSummary: {
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
      assembledFrom: "APPROVED_PROPOSAL_RUNTIME_OBJECT",
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
    proposalDocumentReferences: proposal.proposalDocumentReferences,
    sourceProposalVersion: proposal.version,
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
  const finalDraft = normalizeDraftPackage({
    ...draft,
    historyIds: unique([...draft.historyIds, createdEvent.historyId, queuedEvent.historyId]),
    updatedAt: queuedEvent.timestamp,
  });
  await persistRecord(DIRS.iofPackages, finalDraft.packageId, finalDraft);
  return { created: true, iofPackage: finalDraft, draftPackage: finalDraft, proposal };
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
    errorResponse(res, 409, "Certified IOF Packages are frozen. Create a new proposal revision cycle.");
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

function createExecutionCertificate(certifiedPackage, checklist, user, scopeVersionId = "") {
  const timestamp = nowIso();
  const certifiedUnits = asArray(certifiedPackage.certifiedIofUnits);
  const certificateId = `EXEC-AUTH-${certifiedPackage.certifiedPackageId}`;
  const fingerprintPayload = {
    proposalId: certifiedPackage.proposalId,
    draftPackageId: certifiedPackage.sourcePackageId,
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
    draftIofPackageId: certifiedPackage.sourcePackageId,
    certifiedIofPackageId: certifiedPackage.certifiedPackageId,
    scopeVersionId,
    engineeringApproverId: user.userId,
    engineeringApprover: user.name,
    certificationTimestamp: timestamp,
    engineeringChecklist: checklist,
    authorityTransfer: {
      from: "ENGINEERING",
      to: "EXECUTION",
      status: scopeVersionId ? "TRANSFERRED" : "PENDING_SCOPEVERSION",
      transferredAt: scopeVersionId ? timestamp : undefined,
    },
    runtimeObjectCount: unique(certifiedPackage.runtimeObjectIds).length,
    relationshipCount: unique(certifiedPackage.runtimeRelationshipIds).length,
    evidenceCount: unique(certifiedPackage.runtimeEvidenceIds).length,
    certificationConfidence: checklist.certificationConfidence,
    assemblyFingerprint: hashCertifiedAssembly(fingerprintPayload),
    createdAt: timestamp,
    updatedAt: timestamp,
    status: scopeVersionId ? "EXECUTION_AUTHORIZED" : "CERTIFIED_PACKAGE_PENDING_SCOPEVERSION",
    immutable: Boolean(scopeVersionId),
  };
}

function createScopeVersionFromCertifiedPackage(certifiedPackage, certificate, user) {
  const timestamp = nowIso();
  const scopeVersionId = certificate.scopeVersionId || `SV-${certifiedPackage.certifiedPackageId}-${Date.now()}`;
  const certifiedUnits = asArray(certifiedPackage.certifiedIofUnits);
  return {
    scopeVersionId,
    type: "EXECUTION_AUTHORITY",
    status: "CERTIFIED",
    certificationState: "CERTIFIED",
    isImmutable: true,
    certifiedIofPackageId: certifiedPackage.certifiedPackageId,
    executionAuthorizationCertificateId: certificate.certificateId,
    proposalId: certifiedPackage.proposalId,
    productId: certifiedPackage.productId,
    productName: certifiedPackage.productName,
    fulfillmentPlanId: certifiedPackage.fulfillmentPlanId,
    fulfillmentStrategy: certifiedPackage.fulfillmentStrategy,
    fulfillmentPlan: certifiedPackage.fulfillmentPlan,
    fulfillmentMix: certifiedPackage.fulfillmentMix,
    proposalRecipientContactIds: certifiedPackage.proposalRecipientContactIds,
    customerReviewContactIds: certifiedPackage.customerReviewContactIds,
    approvalAuthorityContactIds: certifiedPackage.approvalAuthorityContactIds,
    sofRecipientContactIds: certifiedPackage.sofRecipientContactIds,
    customerContactEmails: certifiedPackage.customerContactEmails,
    accountId: certifiedPackage.accountId,
    customerId: certifiedPackage.customerId,
    opportunityId: certifiedPackage.opportunityId,
    organizationId: user.organizationId,
    workspaceId: user.workspaceId,
    runtimeObjectIds: unique(certifiedPackage.runtimeObjectIds),
    runtimeRelationshipIds: unique(certifiedPackage.runtimeRelationshipIds),
    runtimeEvidenceIds: unique(certifiedPackage.runtimeEvidenceIds),
    certifiedIofUnitIds: certifiedUnits.map((unit) => unit.unitId),
    createdAt: timestamp,
    updatedAt: timestamp,
    canonicalTruth: {
      lifecycleState: "CERTIFIED",
      lifecycleTimestamp: timestamp,
      constitutionalAuthority: "SCOPEVERSION_FROM_CERTIFIED_IOF_PACKAGE",
      certifiedIofPackageId: certifiedPackage.certifiedPackageId,
      executionAuthorizationCertificateId: certificate.certificateId,
      proposalId: certifiedPackage.proposalId,
      productId: certifiedPackage.productId,
      productName: certifiedPackage.productName,
      fulfillmentPlanId: certifiedPackage.fulfillmentPlanId,
      fulfillmentStrategy: certifiedPackage.fulfillmentStrategy,
      fulfillmentPlan: certifiedPackage.fulfillmentPlan,
      fulfillmentMix: certifiedPackage.fulfillmentMix,
      proposalRecipientContactIds: certifiedPackage.proposalRecipientContactIds,
      customerReviewContactIds: certifiedPackage.customerReviewContactIds,
      approvalAuthorityContactIds: certifiedPackage.approvalAuthorityContactIds,
      sofRecipientContactIds: certifiedPackage.sofRecipientContactIds,
      customerContactEmails: certifiedPackage.customerContactEmails,
      accountId: certifiedPackage.accountId,
      customerId: certifiedPackage.customerId,
      opportunityId: certifiedPackage.opportunityId,
      existingInventoryReferences: certifiedPackage.existingInventoryReferences,
      customerTwinReference: certifiedPackage.customerTwinReference,
      customerDesignReferences: certifiedPackage.customerDesignReferences,
      partnerInventoryReferences: certifiedPackage.partnerInventoryReferences,
      marketplaceAssetReferences: certifiedPackage.marketplaceAssetReferences,
      newInfrastructureRequired: certifiedPackage.newInfrastructureRequired,
      geometryReferences: certifiedPackage.geometryReferences,
      relationships: certifiedPackage.runtimeRelationshipIds,
      evidence: certifiedPackage.runtimeEvidenceIds,
      certifiedIofUnitIds: certifiedUnits.map((unit) => unit.unitId),
      certifiedIofUnits: certifiedUnits.map((unit) => ({
        unitId: unit.unitId,
        unitType: unit.unitType,
        runtimeObjectIds: unit.runtimeObjectIds,
        geometryReferences: unit.geometryReferences,
        dependencyIds: unit.dependencyIds,
        status: unit.status,
      })),
      executionGate: {
        marketplaceEnabled: false,
        contractsEnabled: false,
        procurementEnabled: false,
        controlEnabled: false,
        fieldEnabled: false,
        operationalIntelligenceEnabled: false,
        nextConsumer: "MARKETPLACE_NEXT_PHASE",
      },
    },
    events: [{
      eventId: `event-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type: "scopeversion.created_from_certified_iof_package",
      entityId: scopeVersionId,
      entityType: "ScopeVersion",
      payload: {
        certifiedIofPackageId: certifiedPackage.certifiedPackageId,
        executionAuthorizationCertificateId: certificate.certificateId,
        authority: "EXECUTION",
      },
      createdAt: timestamp,
    }],
  };
}

async function persistCertificate(certificate) {
  return persistRecord(DIRS.executionAuthorizationCertificates, certificate.certificateId, certificate);
}

async function persistCertificationEvidence(certifiedPackage, certificate, user) {
  const timestamp = nowIso();
  const evidenceId = `EVIDENCE-${certificate.certificateId}`;
  const evidence = {
    evidenceId,
    sourceType: "EXECUTION_AUTHORIZATION_CERTIFICATE",
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
    },
  };
  await persistRecord(DIRS.runtimeEvidence, evidenceId, evidence);
  return evidence;
}

async function generateScopeVersion(certifiedPackage, certificate, user) {
  if (certifiedPackage.scopeVersionId) {
    const existing = await loadRecord(DIRS.scopeVersions, certifiedPackage.scopeVersionId).catch(() => null);
    if (existing) return { scopeVersion: existing, certifiedPackage, certificate };
  }
  const scopeVersion = await persistScopeVersion(createScopeVersionFromCertifiedPackage(certifiedPackage, certificate, user));
  const nextCertificate = {
    ...certificate,
    scopeVersionId: scopeVersion.scopeVersionId,
    status: "EXECUTION_AUTHORIZED",
    immutable: true,
    authorityTransfer: {
      ...certificate.authorityTransfer,
      status: "TRANSFERRED",
      transferredAt: nowIso(),
    },
    updatedAt: nowIso(),
  };
  const nextCertified = {
    ...certifiedPackage,
    scopeVersionId: scopeVersion.scopeVersionId,
    executionAuthorizationCertificateId: nextCertificate.certificateId,
    executionAuthorized: true,
    updatedAt: nowIso(),
  };
  await persistRecord(DIRS.certifiedIofPackages, nextCertified.certifiedPackageId, nextCertified);
  await persistCertificate(nextCertificate);
  await persistCertificationEvidence(nextCertified, nextCertificate, user);
  await appendHistory(nextCertified, user, "runtime.authority_transfer.engineering_to_execution", "Authority transferred from Engineering Certification to executable ScopeVersion.", {
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
  const units = proposedUnitsForPackage(draft);
  if (!units.length) {
    errorResponse(res, 409, "Draft IOF Package has no Proposed IOF Units.");
    return;
  }
  const unapproved = units.filter((unit) => unit.status !== "CERTIFIED");
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
  const timestamp = nowIso();
  const certifiedPackageId = String(body.certifiedPackageId ?? `CERT-IOF-${draft.packageId}`);
  const certifiedPackage = {
    ...draft,
    certifiedPackageId,
    sourcePackageId: draft.packageId,
    packageId: certifiedPackageId,
    sourceDraftPackageId: draft.packageId,
    status: "CERTIFIED",
    workflowStatus: "CERTIFIED_IOF_PACKAGE",
    certifiedAt: timestamp,
    certifiedBy: user.name,
    certifiedById: user.userId,
    engineeringChecklist: checklist,
    certificationConfidence: checklist.certificationConfidence,
    certifiedIofUnits: units.map((unit) => ({ ...unit, immutable: true, status: "CERTIFIED" })),
    proposedIofUnits: units.map((unit) => ({ ...unit, immutable: true, status: "CERTIFIED" })),
    immutable: true,
    executionAuthorized: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const certificate = createExecutionCertificate(certifiedPackage, checklist, user);
  await persistRecord(DIRS.certifiedIofPackages, certifiedPackageId, {
    ...certifiedPackage,
    executionAuthorizationCertificateId: certificate.certificateId,
  });
  await persistCertificate(certificate);
  const frozenDraft = await persistDraftPackage({
    ...draft,
    status: "CERTIFIED",
    workflowStatus: "CERTIFIED_IOF_PACKAGE",
    certifiedPackageId,
    certifiedAt: timestamp,
    certifiedBy: user.name,
    certifiedById: user.userId,
    proposedIofUnits: units.map((unit) => ({ ...unit, immutable: true })),
    immutable: true,
  }, user, "runtime.iof_package.certified", "Draft IOF Package certified by Engineering.");
  await appendHistory(frozenDraft, user, "runtime.engineering_checklist.completed", "Engineering Certification checklist completed.", { checklist });
  const generated = await generateScopeVersion({ ...certifiedPackage, executionAuthorizationCertificateId: certificate.certificateId }, certificate, user);
  const finalDraft = await persistDraftPackage({
    ...frozenDraft,
    scopeVersionId: generated.scopeVersion.scopeVersionId,
    executionAuthorizationCertificateId: generated.certificate.certificateId,
  }, user, "runtime.iof_package.execution_authorized", "Certified IOF Package authorized executable ScopeVersion creation.");
  jsonResponse(res, 200, {
    draftPackage: finalDraft,
    certifiedIofPackage: generated.certifiedPackage,
    executionAuthorizationCertificate: generated.certificate,
    scopeVersion: generated.scopeVersion,
  });
}

async function handleGenerateScopeVersion(res, user, certifiedPackageId) {
  const certified = await loadRecord(DIRS.certifiedIofPackages, certifiedPackageId).catch(() => null);
  if (!certified) {
    errorResponse(res, 404, `Certified IOF Package not found: ${certifiedPackageId}`);
    return;
  }
  if (certified.status !== "CERTIFIED") {
    errorResponse(res, 409, "Only Certified IOF Packages may generate ScopeVersions.");
    return;
  }
  const certificate = certified.executionAuthorizationCertificateId
    ? await loadRecord(DIRS.executionAuthorizationCertificates, certified.executionAuthorizationCertificateId).catch(() => null)
    : null;
  const nextCertificate = certificate ?? createExecutionCertificate(certified, certified.engineeringChecklist ?? {}, user);
  const generated = await generateScopeVersion(certified, nextCertificate, user);
  jsonResponse(res, 200, generated);
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
  const user = readOnly
    ? requireAnyPermission(req, res, ["workspace.engineering.read", "workspace.engineering.write", "scopeversion.authority"], "You do not have authority to read Engineering Certification.")
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
    jsonResponse(res, 200, { draftPackages: sortedByUpdated((await listRecords(DIRS.iofPackages)).map(normalizeDraftPackage)) });
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
    const raw = await loadRecord(DIRS.iofPackages, parts[1]).catch(() => null);
    const draft = raw ? await decorateDraftPackageForResponse(raw) : null;
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
    if (!certified) errorResponse(res, 404, `Certified IOF Package not found: ${parts[1]}`);
    else jsonResponse(res, 200, { certifiedIofPackage: certified });
    return true;
  }

  if (req.method === "POST" && parts[0] === "certified-packages" && parts[1] && parts[2] === "generate-scopeversion") {
    await handleGenerateScopeVersion(res, user, parts[1]);
    return true;
  }

  if (req.method === "GET" && parts[0] === "certificates" && parts.length === 1) {
    await handleCertificateList(res);
    return true;
  }

  if (req.method === "GET" && parts[0] === "certificates" && parts[1]) {
    const certificate = await loadRecord(DIRS.executionAuthorizationCertificates, parts[1]).catch(() => null);
    if (!certificate) errorResponse(res, 404, `Execution Authorization Certificate not found: ${parts[1]}`);
    else jsonResponse(res, 200, { executionAuthorizationCertificate: certificate });
    return true;
  }

  errorResponse(res, 405, "Engineering Certification method not allowed.");
  return true;
}
