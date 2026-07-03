import {
  DIRS,
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
import { userFromBearerToken, userHasPermission } from "./auth.js";

function stableIdPart(value, fallback = "UNKNOWN") {
  return String(value ?? fallback)
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || fallback;
}

function uniqueStrings(values) {
  const seen = new Set();
  const result = [];
  for (const value of values.flatMap((entry) => Array.isArray(entry) ? entry : [entry])) {
    const text = String(value ?? "").trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
  }
  return result;
}

const REQUIRED_STATION_OBJECT_TYPES = new Set([
  "ILA",
  "ILA_FACILITY",
  "REGEN",
  "REGENERATION",
  "REGENERATION_FACILITY",
  "HUT",
  "HANDHOLE",
  "VAULT",
  "SPLICE_CASE",
  "PULL_POINT",
  "MARKER",
]);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function commercialObjectId(record, packageId, index) {
  return String(record.objectId ?? record.unitId ?? record.structureId ?? record.id ?? record.runtimeObjectId ?? `${packageId}:COMMERCIAL-OBJECT:${String(index + 1).padStart(4, "0")}`);
}

function commercialObjectType(record) {
  const metadata = asRecord(record.metadata);
  return String(metadata.structureType ?? record.structureType ?? record.unitType ?? record.objectType ?? record.type ?? "OBJECT").toUpperCase();
}

function stationAwareSubmitReadiness(draftPackage) {
  const blockingIssues = [];
  const geometryCoordinateCount = asArray(asRecord(draftPackage.geometry).coordinates).length || asArray(draftPackage.centerline).length;
  const stationAuthorityStations = asArray(asRecord(draftPackage.stationAuthority).stations);
  const attachments = asArray(draftPackage.objectStationAttachments);
  const auditProjection = asRecord(draftPackage.spineAuditProjection);
  const closureExpectations = asArray(draftPackage.closureExpectations);
  const auditProjectionSummary = asRecord(draftPackage.auditProjectionSummary);
  const kernelExecutionGraph = asRecord(draftPackage.kernelExecutionGraph);
  const executionNodes = asArray(draftPackage.executionNodes);
  const executionEdges = asArray(draftPackage.executionEdges);
  const executionGraphValidation = asRecord(draftPackage.executionGraphValidation);
  const executionExpectations = asArray(draftPackage.executionExpectations);
  const closureLedgers = asArray(draftPackage.closureLedgers);
  const constitutionalClosureSummary = asRecord(draftPackage.constitutionalClosureSummary);
  const constitutionalAssembly = asRecord(draftPackage.constitutionalAssembly);
  const spineObjectDependencies = asArray(draftPackage.spineObjectDependencies);
  const spineObjectCloseSequences = asArray(draftPackage.spineObjectCloseSequences);
  const spineObjectEvidenceRequirements = asArray(draftPackage.spineObjectEvidenceRequirements);
  const segmentValidationRules = asArray(draftPackage.segmentValidationRules);
  const paymentEligibilityRules = asArray(draftPackage.paymentEligibilityRules);
  const draftIofReadiness = asRecord(draftPackage.draftIofReadiness);
  const stationAddressRegistry = asRecord(draftPackage.stationAddressRegistry);
  const objectAddresses = asArray(draftPackage.objectAddresses);
  const addressValidation = asRecord(draftPackage.addressValidation);
  const addressProjectionSummary = asRecord(draftPackage.addressProjectionSummary);
  const spineObjectCatalog = asRecord(draftPackage.spineObjectCatalog);
  const spineObjectCatalogEntries = asArray(draftPackage.spineObjectCatalogEntries);
  const spineObjectCatalogValidation = asRecord(draftPackage.spineObjectCatalogValidation);
  const auditObjectManifest = asRecord(draftPackage.auditObjectManifest);
  const auditObjectManifestEntries = asArray(draftPackage.auditObjectManifestEntries);
  const auditObjectManifestValidation = asRecord(draftPackage.auditObjectManifestValidation);
  const auditObjectManifestSummary = asRecord(draftPackage.auditObjectManifestSummary);
  const productionDoctrine = asRecord(draftPackage.productionDoctrine);
  const productionProfiles = asArray(draftPackage.productionProfiles);
  const objectProductionProfiles = asArray(draftPackage.objectProductionProfiles);
  const productionProjectionSummary = asRecord(draftPackage.productionProjectionSummary);
  const productionScheduleProjection = asArray(draftPackage.productionScheduleProjection);
  const productionCostProjection = asArray(draftPackage.productionCostProjection);
  const productionPaymentProjection = asArray(draftPackage.productionPaymentProjection);
  const productionValidation = asRecord(draftPackage.productionValidation);
  const instantiatedSpineObjects = asArray(draftPackage.instantiatedSpineObjects);
  const spineObjectRegistry = asRecord(draftPackage.spineObjectRegistry);
  const spineObjectIdentityRegistry = asRecord(draftPackage.spineObjectIdentityRegistry);
  const constructionSegments = asArray(draftPackage.constructionSegments);
  const paymentSegments = asArray(draftPackage.paymentSegments);
  const executionZones = asArray(draftPackage.executionZones);
  const instantiationSummary = asRecord(draftPackage.instantiationSummary);
  const instantiationHealth = asRecord(draftPackage.instantiationHealth);
  const hierarchySummary = asRecord(draftPackage.hierarchySummary);
  const productionBindings = asArray(draftPackage.productionBindings);
  const addressBindings = asArray(draftPackage.addressBindings);
  const kernelSpineObjectReferences = asArray(draftPackage.kernelSpineObjectReferences);
  const objects = [
    ...asArray(draftPackage.objects),
    ...asArray(draftPackage.structures),
  ];
  const sourceObjects = objects.length ? objects : asArray(draftPackage.proposedIofUnits);
  if (!geometryCoordinateCount) blockingIssues.push("route geometry missing");
  if (!asRecord(draftPackage.measuredSpine).geometryHash) blockingIssues.push("measuredSpine missing");
  if (!stationAuthorityStations.length) blockingIssues.push("stationAuthority missing");
  if (!attachments.length) blockingIssues.push("objectStationAttachments missing");
  if (!auditProjection.projectionId) blockingIssues.push("spineAuditProjection missing");
  if (!closureExpectations.length) blockingIssues.push("closureExpectations missing");
  if (auditProjectionSummary.complianceStatus === "FAIL") blockingIssues.push("audit projection compliance failed");
  if (!kernelExecutionGraph.graphId) blockingIssues.push("kernelExecutionGraph missing");
  if (!executionNodes.length) blockingIssues.push("executionNodes missing");
  if (!executionEdges.length) blockingIssues.push("executionEdges missing");
  if (executionGraphValidation.status === "FAIL") blockingIssues.push("execution graph validation failed");
  if (!executionExpectations.length) blockingIssues.push("executionExpectations missing");
  if (!closureLedgers.length) blockingIssues.push("closureLedgers missing");
  if (!constitutionalClosureSummary.authority) blockingIssues.push("constitutionalClosureSummary missing");
  if (!constitutionalAssembly.authority) blockingIssues.push("constitutionalAssembly missing");
  if (constitutionalAssembly.status !== "PASS") blockingIssues.push("constitutionalAssembly failed");
  if (!spineObjectDependencies.length) blockingIssues.push("spineObjectDependencies missing");
  if (!spineObjectCloseSequences.length) blockingIssues.push("spineObjectCloseSequences missing");
  if (!spineObjectEvidenceRequirements.length) blockingIssues.push("spineObjectEvidenceRequirements missing");
  if (!segmentValidationRules.length) blockingIssues.push("segmentValidationRules missing");
  if (!paymentEligibilityRules.length) blockingIssues.push("paymentEligibilityRules missing");
  if (draftIofReadiness.status !== "READY") blockingIssues.push("draftIofReadiness blocked");
  if (!stationAddressRegistry.registryId) blockingIssues.push("stationAddressRegistry missing");
  if (!objectAddresses.length) blockingIssues.push("objectAddresses missing");
  if (!addressValidation.validationId) blockingIssues.push("addressValidation missing");
  if (!addressProjectionSummary.summaryId) blockingIssues.push("addressProjectionSummary missing");
  if (!spineObjectCatalog.catalogId) blockingIssues.push("spineObjectCatalog missing");
  if (!spineObjectCatalogEntries.length) blockingIssues.push("spineObjectCatalogEntries missing");
  if (spineObjectCatalogValidation.status === "FAIL") blockingIssues.push("spineObjectCatalog validation failed");
  if (!auditObjectManifest.manifestId) blockingIssues.push("auditObjectManifest missing");
  if (!auditObjectManifestEntries.length) blockingIssues.push("auditObjectManifestEntries missing");
  if (auditObjectManifest.createsObjects !== false) blockingIssues.push("auditObjectManifest must not instantiate objects");
  if (auditObjectManifestValidation.status === "FAIL") blockingIssues.push("auditObjectManifest validation failed");
  if (auditObjectManifestSummary.createsObjects !== false) blockingIssues.push("auditObjectManifestSummary missing no-instantiation boundary");
  if (!productionDoctrine.doctrineId) blockingIssues.push("productionDoctrine missing");
  if (!productionProfiles.length) blockingIssues.push("productionProfiles missing");
  if (!objectProductionProfiles.length) blockingIssues.push("objectProductionProfiles missing");
  if (!productionProjectionSummary.summaryId) blockingIssues.push("productionProjectionSummary missing");
  if (!productionScheduleProjection.length) blockingIssues.push("productionScheduleProjection missing");
  if (!productionCostProjection.length) blockingIssues.push("productionCostProjection missing");
  if (!productionPaymentProjection.length) blockingIssues.push("productionPaymentProjection missing");
  if (productionPaymentProjection.some((item) => asRecord(item).paymentEligible !== false)) blockingIssues.push("production payment projection attempted authorization");
  if (!productionValidation.validationId) blockingIssues.push("productionValidation missing");
  if (productionValidation.status === "FAIL") blockingIssues.push("productionValidation failed");
  if (!instantiatedSpineObjects.length) blockingIssues.push("instantiatedSpineObjects missing");
  if (!spineObjectRegistry.registryId) blockingIssues.push("spineObjectRegistry missing");
  if (!spineObjectIdentityRegistry.registryId) blockingIssues.push("spineObjectIdentityRegistry missing");
  if (!constructionSegments.length) blockingIssues.push("constructionSegments missing");
  if (!paymentSegments.length) blockingIssues.push("paymentSegments missing");
  if (!executionZones.length) blockingIssues.push("executionZones missing");
  if (!instantiationSummary.summaryId) blockingIssues.push("instantiationSummary missing");
  if (!instantiationHealth.healthId) blockingIssues.push("instantiationHealth missing");
  if (instantiationHealth.instantiationStatus === "FAIL") blockingIssues.push("spine object instantiation failed");
  if (!hierarchySummary.summaryId) blockingIssues.push("hierarchySummary missing");
  if (!productionBindings.length) blockingIssues.push("productionBindings missing");
  if (!addressBindings.length) blockingIssues.push("addressBindings missing");
  if (!kernelSpineObjectReferences.length) blockingIssues.push("kernelSpineObjectReferences missing");
  if (instantiatedSpineObjects.some((item) => asRecord(item).currentState !== "PLANNED")) blockingIssues.push("instantiated Spine Objects must start PLANNED");
  if (paymentSegments.some((item) => asRecord(item).paymentEligible !== false)) blockingIssues.push("paymentSegments attempted authorization");
  if (kernelExecutionGraph.referencesInstantiatedSpineObjects !== true) blockingIssues.push("kernelExecutionGraph missing instantiated Spine Object references");
  const unresolved = sourceObjects
    .map((record, index) => ({
      objectId: commercialObjectId(asRecord(record), draftPackage.packageId, index),
      objectType: commercialObjectType(asRecord(record)),
    }))
    .filter((object) => REQUIRED_STATION_OBJECT_TYPES.has(object.objectType))
    .filter((object) => {
      const attachment = attachments.find((candidate) => String(candidate.objectId) === object.objectId);
      return !attachment || attachment.attachmentMethod === "UNRESOLVED" || attachment.attachmentStatus === "UNRESOLVED";
    })
    .map((object) => object.objectId);
  if (unresolved.length) blockingIssues.push(`unresolved required facility object: ${unresolved.join(", ")}`);
  return {
    status: blockingIssues.length ? "FAIL" : "PASS",
    blockingIssues,
    canSubmitToEngineering: blockingIssues.length === 0,
  };
}

function freezeCommercialAuditProjectionBaseline(draftPackage, timestamp) {
  const projection = asRecord(draftPackage.spineAuditProjection);
  if (!projection.projectionId) return draftPackage;
  const frozenProjection = {
    ...projection,
    baselineState: "FROZEN",
    baselineFrozenAt: projection.baselineFrozenAt ?? timestamp,
    baselineProjectionId: projection.baselineProjectionId ?? projection.projectionId,
    attachments: asArray(projection.attachments).map((attachment) => ({
      ...asRecord(attachment),
      status: asRecord(attachment).status === "PROJECTED" ? "FROZEN" : asRecord(attachment).status,
    })),
    summary: {
      ...asRecord(projection.summary),
      baselineFrozen: true,
    },
  };
  return {
    ...draftPackage,
    spineAuditProjection: frozenProjection,
    spineAuditAttachments: frozenProjection.attachments,
    stationedExpectations: asArray(frozenProjection.stationedExpectations),
    stationRangeExpectations: asArray(frozenProjection.stationRangeExpectations),
    spineReviewObjects: asArray(frozenProjection.spineReviewObjects),
    closureExpectations: asArray(frozenProjection.closureExpectations),
    auditProjectionSummary: frozenProjection.summary,
    commercialBaselineFrozen: true,
    commercialBaselineFrozenAt: frozenProjection.baselineFrozenAt,
  };
}

function requireCommercialPackageUser(req, res) {
  const user = userFromBearerToken(req);
  if (!user) {
    errorResponse(res, 401, "Authentication token is missing or invalid.");
    return null;
  }
  const allowed = ["workspace.commercial", "workspace.proposal", "proposal.manage"].some((permission) => userHasPermission(user, permission));
  if (!allowed) {
    errorResponse(res, 403, "Only Commercial proposal authority may assemble Draft IOF Packages.");
    return null;
  }
  return user;
}

function normalizeCommercialDraftPackage(raw, user) {
  const timestamp = nowIso();
  const proposalId = String(raw.proposalId ?? "").trim();
  const packageId = String(raw.packageId ?? raw.draftPackageId ?? `DRAFT-IOF-${stableIdPart(proposalId || "COMMERCIAL")}`);
  const createdAt = raw.createdAt ?? timestamp;
  return {
    ...raw,
    packageId,
    draftPackageId: String(raw.draftPackageId ?? packageId),
    packageType: "ENGINEERING",
    status: "DRAFT",
    workflowStatus: raw.workflowStatus ?? "ENGINEERING_REVIEW",
    organizationId: raw.organizationId ?? user.organizationId,
    workspaceId: raw.workspaceId ?? user.workspaceId,
    ownerId: raw.ownerId ?? user.userId,
    owner: raw.owner ?? user.name,
    visibility: raw.visibility ?? "ORGANIZATION",
    authority: "COMMERCIAL_DRAFT_IOF_PACKAGE",
    lifecycleState: raw.lifecycleState ?? "IN_REVIEW",
    assignedEngineerId: raw.assignedEngineerId ?? "",
    assignedEngineer: raw.assignedEngineer ?? "Unassigned",
    priority: raw.priority ?? "NORMAL",
    proposedIofUnits: Array.isArray(raw.proposedIofUnits) ? raw.proposedIofUnits : [],
    runtimeObjectIds: uniqueStrings([raw.runtimeObjectIds]),
    runtimeRelationshipIds: uniqueStrings([raw.runtimeRelationshipIds]),
    runtimeEvidenceIds: uniqueStrings([raw.runtimeEvidenceIds]),
    existingInventoryReferences: uniqueStrings([raw.existingInventoryReferences]),
    customerDesignReferences: uniqueStrings([raw.customerDesignReferences]),
    geometryReferences: uniqueStrings([raw.geometryReferences]),
    commercialObjectPlacementHistory: Array.isArray(raw.commercialObjectPlacementHistory) ? raw.commercialObjectPlacementHistory : [],
    customerRequestedMoves: Array.isArray(raw.customerRequestedMoves) ? raw.customerRequestedMoves : [],
    commercialImpactSummary: raw.commercialImpactSummary ?? {
      status: "NO_COMMERCIAL_STATION_MOVES",
      requiresEngineeringReview: "NO",
      noCertification: true,
      noScopeVersionCreation: true,
    },
    commercialImpactSummaries: Array.isArray(raw.commercialImpactSummaries) ? raw.commercialImpactSummaries : [],
    commercialReviewRevision: Number(raw.commercialReviewRevision ?? 0),
    historyIds: uniqueStrings([raw.historyIds, `${packageId}:HISTORY:COMMERCIAL_ASSEMBLED`]),
    noScopeVersionCreation: true,
    noMarketplaceCreation: true,
    noControlCreation: true,
    noFieldCreation: true,
    noContractCreation: true,
    noSofCreation: true,
    immutable: false,
    sourceSystem: "IOFPackageAssemblyEngine",
    createdAt,
    updatedAt: timestamp,
  };
}

export async function loadCommercialDraftIofPackageForProposal(proposalId) {
  const packages = sortedByUpdated(await listRecords(DIRS.iofPackages));
  return packages.find((record) =>
    String(record?.proposalId ?? "") === String(proposalId ?? "") &&
    (record?.authority === "COMMERCIAL_DRAFT_IOF_PACKAGE" || record?.sourceSystem === "IOFPackageAssemblyEngine") &&
    !["CERTIFIED", "CLOSED", "ARCHIVED"].includes(String(record?.status ?? "").toUpperCase())
  ) ?? null;
}

async function persistCommercialPackageRuntime(packageRecord, user) {
  const timestamp = nowIso();
  const runtimeObjectId = `RUNTIME-DRAFT-IOF-${stableIdPart(packageRecord.packageId)}`;
  await persistRecord(DIRS.runtimeObjects, runtimeObjectId, {
    runtimeObjectId,
    objectId: packageRecord.packageId,
    objectType: "DRAFT_IOF_PACKAGE",
    sourceObjectType: "COMMERCIAL_DRAFT_IOF_PACKAGE",
    sourceSystem: "IOFPackageAssemblyEngine",
    organizationId: packageRecord.organizationId,
    workspaceId: packageRecord.workspaceId,
    ownerId: packageRecord.ownerId,
    owner: packageRecord.owner,
    proposalId: packageRecord.proposalId,
    accountId: packageRecord.accountId,
    customerId: packageRecord.customerId,
    opportunityId: packageRecord.opportunityId,
    lifecycleState: packageRecord.lifecycleState,
    status: packageRecord.status,
    workflowStatus: packageRecord.workflowStatus,
    noScopeVersionCreation: true,
    createdAt: packageRecord.createdAt,
    updatedAt: timestamp,
  });
  const historyId = `${packageRecord.packageId}:HISTORY:COMMERCIAL_ASSEMBLED`;
  await persistRecord(DIRS.runtimeHistory, historyId, {
    historyId,
    objectId: packageRecord.packageId,
    runtimeObjectId,
    objectType: "DRAFT_IOF_PACKAGE",
    eventType: "COMMERCIAL_DRAFT_IOF_PACKAGE_ASSEMBLED",
    actorId: user.userId,
    actorName: user.name,
    actorRole: user.role,
    organizationId: packageRecord.organizationId,
    workspaceId: packageRecord.workspaceId,
    accountId: packageRecord.accountId,
    customerId: packageRecord.customerId,
    opportunityId: packageRecord.opportunityId,
    proposalId: packageRecord.proposalId,
    packageId: packageRecord.packageId,
    authority: "COMMERCIAL",
    noScopeVersionCreation: true,
    timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
    details: "Commercial assembled deterministic Draft IOF Package JSON for Engineering review.",
  });
}

async function persistEngineeringIntakeRecord(draftPackage, user) {
  const timestamp = nowIso();
  const intakeId = `ENGINEERING-INTAKE-${stableIdPart(draftPackage.packageId)}`;
  const intakeRecord = {
    intakeId,
    packageId: draftPackage.packageId,
    draftPackageId: draftPackage.draftPackageId ?? draftPackage.packageId,
    status: "SUBMITTED_TO_ENGINEERING",
    workflowStatus: "ENGINEERING_INTAKE",
    lifecycleState: "AWAITING_ENGINEERING_REVIEW",
    authority: "ENGINEERING_INTAKE",
    customerId: draftPackage.customerId,
    customerName: draftPackage.customerSummary?.name ?? draftPackage.customerName ?? draftPackage.customerId,
    accountId: draftPackage.accountId,
    opportunityId: draftPackage.opportunityId,
    proposalId: draftPackage.proposalId,
    productId: draftPackage.productId,
    productName: draftPackage.productName,
    doctrineId: draftPackage.doctrineId,
    productDoctrineVersion: draftPackage.productDoctrineVersion,
    packageRevision: draftPackage.packageRevision ?? draftPackage.revision ?? 0,
    commercialReviewRevision: draftPackage.commercialReviewRevision ?? 0,
    customerRequestedMoveCount: asArray(draftPackage.customerRequestedMoves).length,
    commercialImpactStatus: draftPackage.commercialImpactSummary?.status,
    assignedEngineerId: draftPackage.assignedEngineerId ?? "",
    assignedEngineer: draftPackage.assignedEngineer || "Unassigned",
    commercialRevisionLocked: true,
    submittedBy: user.name,
    submittedById: user.userId,
    submittedAt: draftPackage.submittedAt ?? timestamp,
    openedAt: draftPackage.engineeringOpenedAt,
    openedBy: draftPackage.engineeringOpenedBy,
    certifiedAt: draftPackage.certifiedAt,
    certifiedPackageId: draftPackage.certifiedPackageId,
    noScopeVersionCreation: true,
    createdAt: draftPackage.engineeringIntakeCreatedAt ?? timestamp,
    updatedAt: timestamp,
  };
  await persistRecord(DIRS.engineeringIntakes, intakeId, intakeRecord);
  const runtimeObjectId = `RUNTIME-DRAFT-IOF-${stableIdPart(draftPackage.packageId)}`;
  await persistRecord(DIRS.runtimeObjects, runtimeObjectId, {
    runtimeObjectId,
    objectId: draftPackage.packageId,
    objectType: "DRAFT_IOF_PACKAGE",
    sourceObjectType: "COMMERCIAL_DRAFT_IOF_PACKAGE",
    sourceSystem: "IOFPackageAssemblyEngine",
    organizationId: draftPackage.organizationId,
    workspaceId: draftPackage.workspaceId,
    ownerId: draftPackage.ownerId,
    owner: draftPackage.owner,
    proposalId: draftPackage.proposalId,
    accountId: draftPackage.accountId,
    customerId: draftPackage.customerId,
    opportunityId: draftPackage.opportunityId,
    lifecycleState: draftPackage.lifecycleState,
    status: draftPackage.status,
    workflowStatus: draftPackage.workflowStatus,
    engineeringIntakeId: intakeId,
    noScopeVersionCreation: true,
    createdAt: draftPackage.createdAt,
    updatedAt: timestamp,
  });
  await persistRecord(DIRS.runtimeHistory, `${draftPackage.packageId}:HISTORY:SUBMITTED_TO_ENGINEERING`, {
    historyId: `${draftPackage.packageId}:HISTORY:SUBMITTED_TO_ENGINEERING`,
    objectId: draftPackage.packageId,
    runtimeObjectId,
    objectType: "DRAFT_IOF_PACKAGE",
    eventType: "COMMERCIAL_DRAFT_IOF_PACKAGE_SUBMITTED_TO_ENGINEERING",
    actorId: user.userId,
    actorName: user.name,
    actorRole: user.role,
    organizationId: draftPackage.organizationId,
    workspaceId: draftPackage.workspaceId,
    accountId: draftPackage.accountId,
    customerId: draftPackage.customerId,
    opportunityId: draftPackage.opportunityId,
    proposalId: draftPackage.proposalId,
    packageId: draftPackage.packageId,
    engineeringIntakeId: intakeId,
    authority: "COMMERCIAL",
    noScopeVersionCreation: true,
    timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
    details: "Commercial locked the Draft IOF Package revision and submitted the same package object to Engineering Intake.",
  });
  return intakeRecord;
}

async function submitCommercialDraftPackageToEngineering(rawDraftPackage, user) {
  const timestamp = nowIso();
  const savedDraftPackage = normalizeCommercialDraftPackage(rawDraftPackage, user);
  const stationReadiness = stationAwareSubmitReadiness(savedDraftPackage);
  if (!stationReadiness.canSubmitToEngineering) {
    const error = new Error(`Commercial station-aware review blocks Engineering submission: ${stationReadiness.blockingIssues.join("; ")}`);
    error.status = 409;
    throw error;
  }
  const frozenDraftPackage = freezeCommercialAuditProjectionBaseline(savedDraftPackage, timestamp);
  const submitted = {
    ...frozenDraftPackage,
    commercialStationReviewReadiness: stationReadiness,
    status: "SUBMITTED_TO_ENGINEERING",
    workflowStatus: "ENGINEERING_INTAKE",
    lifecycleState: "SUBMITTED_TO_ENGINEERING",
    engineeringStatus: "SUBMITTED",
    engineeringReadiness: "SUBMITTED_TO_ENGINEERING",
    commercialRevisionLocked: true,
    commercialLockedAt: timestamp,
    commercialLockedBy: user.name,
    commercialLockedById: user.userId,
    submittedAt: timestamp,
    submittedToEngineeringAt: timestamp,
    submittedBy: user.name,
    submittedById: user.userId,
    historyIds: uniqueStrings([
      savedDraftPackage.historyIds,
      `${savedDraftPackage.packageId}:HISTORY:COMMERCIAL_ASSEMBLED`,
      `${savedDraftPackage.packageId}:HISTORY:SUBMITTED_TO_ENGINEERING`,
    ]),
    noScopeVersionCreation: true,
    updatedAt: timestamp,
  };
  await persistRecord(DIRS.iofPackages, submitted.packageId, submitted);
  const engineeringIntake = await persistEngineeringIntakeRecord(submitted, user);
  return { draftPackage: submitted, iofPackage: submitted, engineeringIntake };
}

export async function handleCommercialIofPackages(req, res, pathname) {
  const normalizedPath = pathname.replace(/\/+$/, "");
  if (!normalizedPath.startsWith("/api/commercial/iof-packages")) return false;
  if (handleOptions(req, res)) return true;

  const user = requireCommercialPackageUser(req, res);
  if (!user) return true;

  if (normalizedPath === "/api/commercial/iof-packages" && req.method === "GET") {
    const packages = sortedByUpdated(await listRecords(DIRS.iofPackages))
      .filter((record) => record?.authority === "COMMERCIAL_DRAFT_IOF_PACKAGE" || record?.sourceSystem === "IOFPackageAssemblyEngine");
    jsonResponse(res, 200, { draftPackages: packages, iofPackages: packages });
    return true;
  }

  if (normalizedPath === "/api/commercial/iof-packages" && req.method === "POST") {
    const body = await readRequestJson(req);
    const raw = unwrapBody(body, "draftPackage", ["iofPackage", "package"]) ?? {};
    const draftPackage = normalizeCommercialDraftPackage(raw, user);
    const existing = await loadRecord(DIRS.iofPackages, draftPackage.packageId).catch(() => null);
    if (existing?.commercialRevisionLocked || ["SUBMITTED_TO_ENGINEERING", "UNDER_ENGINEERING_REVIEW", "CERTIFIED"].includes(String(existing?.status ?? ""))) {
      errorResponse(res, 409, "Commercial revision is locked after Engineering submission.");
      return true;
    }
    await persistRecord(DIRS.iofPackages, draftPackage.packageId, draftPackage);
    await persistCommercialPackageRuntime(draftPackage, user);
    jsonResponse(res, 201, { draftPackage, iofPackage: draftPackage });
    return true;
  }

  if (normalizedPath.startsWith("/api/commercial/iof-packages/") && normalizedPath.endsWith("/submit-engineering") && req.method === "POST") {
    const packageId = decodeURIComponent(normalizedPath
      .slice("/api/commercial/iof-packages/".length)
      .replace(/\/submit-engineering$/, ""));
    const body = await readRequestJson(req);
    const bodyDraft = unwrapBody(body, "draftPackage", ["iofPackage", "package"]) ?? {};
    const existing = await loadRecord(DIRS.iofPackages, packageId).catch(() => null);
    const rawDraftPackage = {
      ...(existing ?? {}),
      ...(bodyDraft ?? {}),
      packageId,
      draftPackageId: bodyDraft.draftPackageId ?? existing?.draftPackageId ?? packageId,
    };
    try {
      const result = await submitCommercialDraftPackageToEngineering(rawDraftPackage, user);
      jsonResponse(res, 200, result);
    } catch (error) {
      errorResponse(res, error.status ?? 500, error.message ?? "Commercial Draft IOF Package submission failed.");
    }
    return true;
  }

  const id = decodeURIComponent(normalizedPath.slice("/api/commercial/iof-packages/".length));
  if (id && req.method === "GET") {
    try {
      const draftPackage = await loadRecord(DIRS.iofPackages, id);
      jsonResponse(res, 200, { draftPackage, iofPackage: draftPackage });
    } catch {
      errorResponse(res, 404, `Commercial Draft IOF Package not found: ${id}`);
    }
    return true;
  }

  return false;
}
