import { createHash } from "node:crypto";
import { DIRS, errorResponse, handleOptions, jsonResponse, listRecords, loadRecord, nowIso, persistRecord } from "./_shared.js";
import { calculateCompletionProjection } from "../kernel/completion-engine.js";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function firstText(...values) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function stableIdPart(value, fallback = "UNKNOWN") {
  return String(value ?? fallback).replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120) || fallback;
}

function hashReference(value) {
  return createHash("sha256").update(JSON.stringify(value ?? null)).digest("hex");
}

const CERTIFIED_TWIN_LENS_AUTHORITY = Object.freeze({
  contractVersion: "1",
  sourceAuthority: "CERTIFIED_IOF_TWIN",
  sharedStateIdentityRequired: true,
  mutationAuthority: "NONE",
  reasoningAuthority: "ADVISORY_ONLY",
  lenses: [
    { lensId: "COMMERCIAL", label: "Commercial", mayProject: true, mayFilter: true, mayAnnotate: false, mayMutateCertifiedState: false },
    { lensId: "ENGINEERING", label: "Engineering", mayProject: true, mayFilter: true, mayAnnotate: false, mayMutateCertifiedState: false },
    { lensId: "SUPPLY_CHAIN", label: "Supply Chain", mayProject: true, mayFilter: true, mayAnnotate: false, mayMutateCertifiedState: false },
    { lensId: "CONTROL", label: "Control", mayProject: true, mayFilter: true, mayAnnotate: false, mayMutateCertifiedState: false },
    { lensId: "FIELD", label: "Field", mayProject: true, mayFilter: true, mayAnnotate: false, mayMutateCertifiedState: false },
  ],
});

export async function materializeCertifiedIofTwin({ draft = {}, certifiedPackage = {}, certificationLedgerEntry = {}, stationPlan = {}, timestamp } = {}) {
  const sourceDraft = asRecord(draft);
  const certified = asRecord(certifiedPackage);
  const ledger = asRecord(certificationLedgerEntry);
  const certifiedAt = firstText(timestamp, ledger.certificationTimestamp, certified.certifiedAt, nowIso());
  const logicalTwinId = firstText(ledger.iofPackageTwinId, certified.iofPackageTwinId, sourceDraft.iofPackageTwinId);
  if (!logicalTwinId) {
    const error = new Error("Certified IOF Twin materialization requires the governed IOF Package Twin identity.");
    error.status = 409;
    throw error;
  }
  const certificationHash = firstText(ledger.certificationHash, certified.certificationHash);
  if (!certificationHash) {
    const error = new Error("Certified IOF Twin materialization requires the Certification Ledger hash.");
    error.status = 409;
    throw error;
  }
  const twinStateId = `${logicalTwinId}:CERTIFIED:${stableIdPart(certificationHash.slice(0, 16))}:V4`;
  const baseTwin = await loadRecord(DIRS.iofPackageTwins, logicalTwinId).catch(() => null);
  const priorCertifiedStates = (await listRecords(DIRS.iofPackageTwins))
    .filter((item) => item?.logicalTwinId === logicalTwinId && item?.certificationHash === certificationHash && item?.twinStateId !== twinStateId)
    .sort((a, b) => Number(b.stateRevision ?? 0) - Number(a.stateRevision ?? 0));
  const previousState = priorCertifiedStates[0] ?? baseTwin;
  const artifactReferences = asRecord(sourceDraft.iofArtifactRepositoryReferences);
  const constraints = asArray(sourceDraft.engineeringConstraints);
  const record = {
    twinStateId,
    twinId: logicalTwinId,
    logicalTwinId,
    previousTwinStateId: firstText(previousState?.twinStateId, previousState?.artifactId, logicalTwinId),
    stateTransition: priorCertifiedStates.length ? "REFERENCE_NORMALIZATION" : "INITIAL_CERTIFICATION",
    stateRevision: Number(previousState?.stateRevision ?? 0) + 1,
    twinContractVersion: "4",
    twinState: "CERTIFIED",
    executionState: "NOT_AUTHORIZED",
    certificationState: "CERTIFIED",
    serviceOrderState: "NOT_CREATED",
    scopeVersionState: "NOT_CREATED",
    authority: "CERTIFIED_IOF_TWIN",
    repositoryType: "IOF_PACKAGE_TWIN",
    sourceAuthority: "CERTIFICATION_LEDGER",
    stateAuthority: "CERTIFICATION_LEDGER",
    referenceOnly: true,
    immutable: true,
    appendOnly: true,
    projectionOnly: true,
    organizationId: firstText(sourceDraft.organizationId),
    tenantId: firstText(sourceDraft.tenantId, sourceDraft.organizationId),
    customerId: firstText(sourceDraft.customerId),
    accountId: firstText(sourceDraft.accountId),
    opportunityId: firstText(sourceDraft.opportunityId),
    productId: firstText(sourceDraft.productId, asRecord(sourceDraft.projectConfiguration).productId, asRecord(sourceDraft.productDoctrineAssembly).productId),
    productName: firstText(sourceDraft.productName, asRecord(sourceDraft.projectConfiguration).productName, asRecord(sourceDraft.productDoctrineAssembly).productName),
    productDoctrineId: firstText(ledger.productDoctrineId, sourceDraft.productDoctrineId, sourceDraft.doctrineId),
    productDoctrineVersion: firstText(sourceDraft.productDoctrineVersion, sourceDraft.doctrineVersion),
    projectConfigurationId: firstText(sourceDraft.configurationId, asRecord(sourceDraft.projectConfigurationRef).artifactId, asRecord(artifactReferences.projectConfiguration).artifactId),
    proposalId: firstText(sourceDraft.proposalId, ledger.proposalId),
    proposalRevisionId: firstText(sourceDraft.proposalRevisionId),
    proposalHash: firstText(sourceDraft.proposalHash),
    commercialReleasePackageId: firstText(ledger.commercialReleasePackageId, sourceDraft.commercialReleasePackageId),
    commercialReleaseHash: firstText(sourceDraft.commercialReleaseHash),
    commercialRevisionId: firstText(ledger.commercialRevisionId, sourceDraft.commercialRevisionId),
    commercialRevisionHash: firstText(ledger.commercialRevisionHash, sourceDraft.commercialRevisionHash),
    draftIofPackageId: firstText(certified.sourceDraftPackageId, certified.certifiedDraftIofPackageId, sourceDraft.packageId),
    certifiedIofPackageId: firstText(certified.certifiedPackageId, ledger.certifiedPackageId),
    certifiedPackageHash: firstText(ledger.certifiedPackageHash, certified.certifiedPackageHash),
    engineeringPackageId: firstText(sourceDraft.engineeringPackageId),
    engineeringBaselineId: firstText(ledger.engineeringBaselineId, certified.engineeringBaselineId),
    engineeringRevisionId: firstText(ledger.engineeringRevisionId, certified.engineeringRevisionId),
    engineeringRevisionHash: firstText(ledger.engineeringRevisionHash, certified.engineeringRevisionHash),
    engineeringApprovalId: firstText(ledger.engineeringApprovalId, certified.engineeringApprovalId),
    engineeringApprovalHash: firstText(ledger.engineeringApprovalHash, certified.engineeringApprovalHash),
    certificationLedgerId: firstText(ledger.certificationLedgerId, certified.certificationLedgerId),
    certificationId: firstText(ledger.certificationId, certified.certificationId),
    certificationHash,
    certificationEvidenceManifestId: firstText(ledger.certificationEvidenceManifestId, certified.certificationEvidenceManifestId),
    certifiedAt,
    certifiedBy: firstText(ledger.certifiedBy, certified.certifiedBy),
    certifiedById: firstText(ledger.certifiedById, certified.certifiedById),
    routeRepositoryId: firstText(ledger.routeRepositoryId, sourceDraft.routeRepositoryId),
    routeRevision: Number(sourceDraft.routeRevision ?? 1),
    routeGeometryId: firstText(sourceDraft.routeGeometryId),
    geometryHash: firstText(sourceDraft.geometryHash),
    measuredCenterlineId: firstText(ledger.measuredCenterlineId, sourceDraft.measuredCenterlineId),
    stationProjectionId: firstText(ledger.stationProjectionId, sourceDraft.stationProjectionId),
    stationGraphId: firstText(ledger.stationGraphId, sourceDraft.stationGraphId),
    stationAuthorityCount: Number(asRecord(stationPlan).stationCount ?? asArray(sourceDraft.stations).length ?? 0) || asArray(ledger.stationAuthorityIds).length || asArray(sourceDraft.stationAuthorityIds).length,
    objectCount: Number(asRecord(sourceDraft.constitutionalStateValidation).objectCount ?? asRecord(asRecord(sourceDraft.projectedObjectManifest).constitutionalStateValidation).objectCount ?? baseTwin?.objectCount ?? 0),
    projectedObjectCount: asArray(asRecord(sourceDraft.projectedObjectManifest).projectedObjects).length,
    spanCount: Number(asRecord(sourceDraft.constitutionalStateValidation).spanCount ?? asRecord(asRecord(sourceDraft.projectedObjectManifest).constitutionalStateValidation).spanCount ?? baseTwin?.spanCount ?? 0),
    projectedSpanCount: asArray(asRecord(sourceDraft.projectedObjectManifest).projectedSpans).length,
    workSegmentCount: Number(asRecord(sourceDraft.closureLedger).workSegmentCount ?? baseTwin?.workSegmentCount ?? 0),
    stationObjectManifestId: firstText(ledger.stationObjectManifestId, sourceDraft.stationObjectManifestId),
    engineeringObjectManifestId: firstText(ledger.engineeringObjectManifestId, sourceDraft.engineeringObjectManifestId),
    projectedObjectManifestId: firstText(ledger.projectedObjectManifestId, sourceDraft.projectedObjectManifestId),
    closureLedgerId: firstText(ledger.closureLedgerId, sourceDraft.closureLedgerId),
    executionGraphId: firstText(ledger.executionGraphId, sourceDraft.executionGraphId),
    lifecycleGraphId: firstText(ledger.lifecycleGraphId, sourceDraft.lifecycleGraphId),
    quantityReconciliationId: firstText(asRecord(certified.quantityReconciliation).reconciliationId, asRecord(sourceDraft.quantityReconciliationRef).artifactId, asRecord(artifactReferences.quantityReconciliation).artifactId),
    quantityReconciliationHash: firstText(certified.quantityReconciliationHash, asRecord(sourceDraft.quantityReconciliationRef).hash, asRecord(artifactReferences.quantityReconciliation).hash),
    constraintSummary: {
      total: constraints.length,
      resolved: constraints.filter((item) => String(item?.status ?? "").toUpperCase() === "RESOLVED").length,
      accepted: constraints.filter((item) => String(item?.status ?? "").toUpperCase() === "ACCEPTED").length,
      open: constraints.filter((item) => !["RESOLVED", "ACCEPTED"].includes(String(item?.status ?? "").toUpperCase())).length,
    },
    lensAuthority: CERTIFIED_TWIN_LENS_AUTHORITY,
    sharedOpportunityMap: {
      authority: "COMMERCIAL_ROUTE_REPOSITORY",
      routeRepositoryId: firstText(ledger.routeRepositoryId, sourceDraft.routeRepositoryId),
      routeRevision: Number(sourceDraft.routeRevision ?? 1),
      geometryHash: firstText(sourceDraft.geometryHash),
      sourceDraftPackageId: firstText(sourceDraft.packageId),
    },
    noServiceOrderCreation: true,
    noScopeVersionCreation: true,
    noExecutionAuthorization: true,
    noCertifiedStateMutation: true,
    createdAt: certifiedAt,
    updatedAt: certifiedAt,
  };
  record.twinStateHash = hashReference(record);
  const existing = await loadRecord(DIRS.iofPackageTwins, twinStateId).catch(() => null);
  if (existing && existing.twinStateHash !== record.twinStateHash) {
    const error = new Error(`Certified IOF Twin state ${twinStateId} is immutable and already exists with a different hash.`);
    error.status = 409;
    throw error;
  }
  return existing ?? persistRecord(DIRS.iofPackageTwins, twinStateId, record);
}

export async function materializeAuthorizedIofTwin({ certifiedTwin = {}, serviceOrder = {}, customerSignature = {}, countersignature = {}, scopeVersion = {}, transaction = {}, timestamp } = {}) {
  const prior = asRecord(certifiedTwin);
  const logicalTwinId = firstText(prior.logicalTwinId, prior.twinId);
  const scopeVersionId = firstText(scopeVersion.scopeVersionId);
  if (!logicalTwinId || prior.twinState !== "CERTIFIED" || prior.certificationState !== "CERTIFIED") {
    const error = new Error("Commercial authorization requires the exact Certified IOF Twin.");
    error.status = 409;
    throw error;
  }
  if (!scopeVersionId || !serviceOrder.documentHash || !customerSignature.customerSignatureId || !countersignature.countersignatureId) {
    const error = new Error("Commercial authorization requires complete Service Order, customer signature, countersignature, and ScopeVersion evidence.");
    error.status = 409;
    throw error;
  }
  const authorizedAt = firstText(timestamp, countersignature.countersignedAt, nowIso());
  const twinStateId = `${logicalTwinId}:AUTHORIZED:${stableIdPart(scopeVersionId)}:V1`;
  const record = {
    ...prior,
    twinStateId,
    previousTwinStateId: prior.twinStateId,
    stateTransition: "COMMERCIAL_AUTHORIZATION",
    stateRevision: Number(prior.stateRevision ?? 0) + 1,
    twinState: "AUTHORIZED",
    executionState: "AUTHORIZED",
    certificationState: "CERTIFIED",
    serviceOrderState: "COUNTERSIGNED",
    customerAcceptanceState: "ACCEPTED",
    scopeVersionState: "CREATED",
    authority: "CERTIFIED_IOF_TWIN",
    stateAuthority: "TERALINX_COUNTERSIGNATURE_ATOMIC_SCOPEVERSION_AUTHORIZATION",
    serviceOrderId: serviceOrder.serviceOrderId,
    serviceOrderRevision: serviceOrder.documentRevision,
    serviceOrderDocumentHash: serviceOrder.documentHash,
    commercialTermsHash: serviceOrder.commercialTermsHash,
    customerSignatureId: customerSignature.customerSignatureId,
    customerSignatureHash: customerSignature.signatureHash,
    countersignatureId: countersignature.countersignatureId,
    countersignatureHash: countersignature.countersignatureHash,
    commercialAuthorizationTransactionId: transaction.transactionId,
    scopeVersionId,
    authorizedAt,
    authorizedBy: countersignature.countersignedBy,
    authorizedById: countersignature.countersignedById,
    noServiceOrderCreation: false,
    noScopeVersionCreation: false,
    noExecutionAuthorization: false,
    noCertifiedStateMutation: true,
    createdAt: authorizedAt,
    updatedAt: authorizedAt,
  };
  delete record.twinStateHash;
  record.twinStateHash = hashReference(record);
  const existing = await loadRecord(DIRS.iofPackageTwins, twinStateId).catch(() => null);
  if (existing && existing.twinStateHash !== record.twinStateHash) {
    const error = new Error(`Authorized IOF Twin state ${twinStateId} already exists with different authority evidence.`);
    error.status = 409;
    throw error;
  }
  return existing ?? persistRecord(DIRS.iofPackageTwins, twinStateId, record);
}

function isRouteStation(value) {
  return Boolean(value) && typeof value === "object" && typeof value.stationId === "string" && typeof value.stationState === "string";
}

function isScopeObject(value) {
  return Boolean(value) && typeof value === "object" && typeof value.objectId === "string" && typeof value.objectState === "string";
}

function routeStations(scopeVersion) {
  return Array.isArray(scopeVersion?.canonicalTruth?.stations)
    ? scopeVersion.canonicalTruth.stations.filter(isRouteStation).sort((a, b) => Number(a.measureFeet) - Number(b.measureFeet))
    : [];
}

function scopeObjects(scopeVersion) {
  return Array.isArray(scopeVersion?.canonicalTruth?.objects) ? scopeVersion.canonicalTruth.objects.filter(isScopeObject) : [];
}

function scopeClosures(scopeVersion, scopeVersionId) {
  const canonical = Array.isArray(scopeVersion?.canonicalTruth?.closures) ? scopeVersion.canonicalTruth.closures : [];
  const topLevel = Array.isArray(scopeVersion?.closures) ? scopeVersion.closures : [];
  return [...canonical, ...topLevel].filter((closure) => closure?.scopeVersionId === scopeVersionId);
}

function dedupeById(records, idKey) {
  const byId = new Map();
  records.forEach((record, index) => {
    const id = record?.[idKey] ?? `${idKey}-${index}`;
    if (!byId.has(id)) byId.set(id, record);
  });
  return Array.from(byId.values());
}

const LIFECYCLE_ALIASES = {
  RELEASED_TO_CONTROL: "CONTROL",
  ACTIVATED: "CONTROL_ACTIVE",
  FIELD_ACTIVE: "FIELD",
  IN_FIELD: "FIELD",
  IN_CONSTRUCTION: "FIELD",
};

const LIFECYCLE_ORDER = [
  "DRAFT",
  "ANALYZED",
  "CERTIFIED",
  "PROVISIONALLY_CERTIFIED",
  "QUOTED",
  "APPROVED",
  "CONTROL",
  "CONTROL_ACTIVE",
  "FIELD",
  "PARTIALLY_COMPLETE",
  "COMPLETE",
  "VERIFIED",
  "OPERATIONAL",
];

const LIFECYCLE_RANKS = new Map(LIFECYCLE_ORDER.map((state, index) => [state, index]));

function normalizeLifecycleState(state) {
  if (typeof state !== "string") return undefined;
  const upper = state.toUpperCase();
  return LIFECYCLE_ALIASES[upper] ?? upper;
}

function highestLifecycleState(existing, incoming) {
  const existingNormalized = normalizeLifecycleState(existing);
  const incomingNormalized = normalizeLifecycleState(incoming);
  const existingRank = existingNormalized ? LIFECYCLE_RANKS.get(existingNormalized) ?? -1 : -1;
  const incomingRank = incomingNormalized ? LIFECYCLE_RANKS.get(incomingNormalized) ?? -1 : -1;
  if (existingRank < 0 && incomingRank < 0) return incomingNormalized ?? existingNormalized;
  return existingRank >= incomingRank ? existingNormalized : incomingNormalized;
}

function inferLifecycleStateFromAuthority(scopeVersion = {}) {
  const events = Array.isArray(scopeVersion.events) ? scopeVersion.events : [];
  const closures = [
    ...(Array.isArray(scopeVersion.canonicalTruth?.closures) ? scopeVersion.canonicalTruth.closures : []),
    ...(Array.isArray(scopeVersion.closures) ? scopeVersion.closures : []),
  ];
  const executionState = scopeVersion.canonicalTruth?.executionState;
  let inferred;
  const advance = (state) => {
    inferred = highestLifecycleState(inferred, state);
  };
  events.forEach((event) => {
    const type = String(event?.type ?? "");
    if (type === "scopeversion.quoted") advance("QUOTED");
    if (type === "scopeversion.approved") advance("APPROVED");
    if (type === "scopeversion.control.work_created") advance("CONTROL");
    if (type === "scopeversion.control.activated") advance("CONTROL_ACTIVE");
    if (type.startsWith("field.") || type.includes("field_") || type.includes("FIELD_CLOSE")) advance("FIELD");
    if (type === "scopeversion.complete" || type === "scopeversion.control.work_complete") advance("COMPLETE");
    if (type === "scopeversion.operational") advance("OPERATIONAL");
  });
  if (closures.length) advance("FIELD");
  if (executionState?.overallExecutionState === "ACTIVE") advance("CONTROL_ACTIVE");
  if (executionState?.overallExecutionState === "COMPLETE") advance("COMPLETE");
  return inferred;
}

function authoritativeLifecycleState(scopeVersion) {
  return highestLifecycleState(
    highestLifecycleState(scopeVersion?.canonicalTruth?.lifecycleState, scopeVersion?.status),
    inferLifecycleStateFromAuthority(scopeVersion)
  ) ?? "ANALYZED";
}

function closureFeet(closure) {
  return Number(closure?.footage ?? closure?.feetAffected ?? 0);
}

function selectedClosures(fieldClosures, scopeVersion, scopeVersionId) {
  return dedupeById(
    [
      ...fieldClosures.filter((closure) => closure?.scopeVersionId === scopeVersionId),
      ...scopeClosures(scopeVersion, scopeVersionId),
    ],
    "closureId"
  ).sort((a, b) => String(a.closedAt ?? a.createdAt ?? "").localeCompare(String(b.closedAt ?? b.createdAt ?? "")));
}

function graphContext(scopeVersion) {
  const truth = scopeVersion?.canonicalTruth ?? {};
  const reference = truth.graphReference ?? {};
  return {
    inventoryId: scopeVersion?.inventoryId ?? scopeVersion?.sourceInventoryId ?? reference.inventoryId ?? "",
    graphId: scopeVersion?.graphId ?? reference.graphId ?? "",
    graphVersion: scopeVersion?.graphVersion ?? reference.graphVersion ?? "",
    routeId: truth.networkBasis?.routeId ?? scopeVersion?.nearestRoute?.routeId ?? "",
    matched: null,
  };
}

function metricsFor(scopeVersion, workItems, closures) {
  const completionProjection = calculateCompletionProjection({ scopeVersion, workItems, closures });

  return {
    openWorkItems: completionProjection.totalWorkItems - completionProjection.completedWorkItems - completionProjection.cancelledWorkItems,
    completedWorkItems: completionProjection.completedWorkItems,
    activeWorkItems: completionProjection.activeWorkItems,
    pendingWorkItems: completionProjection.pendingWorkItems,
    holdWorkItems: completionProjection.holdWorkItems,
    cancelledWorkItems: completionProjection.cancelledWorkItems,
    blockedWorkItems: completionProjection.blockedWorkItems,
    closureCount: closures.length,
    totalFeet: completionProjection.totalFeet,
    completedFeet: completionProjection.completedFeet,
    releasedObjects: completionProjection.releasedObjects,
    installedObjects: completionProjection.installedObjects,
    testedObjects: completionProjection.testedObjects,
    acceptedObjects: completionProjection.acceptedObjects,
    completedObjects: completionProjection.completedObjects,
    verifiedObjects: completionProjection.verifiedObjects,
    blockedObjects: completionProjection.blockedObjects,
    rejectedObjects: completionProjection.rejectedObjects,
    plannedAssets: Math.max(0, completionProjection.totalStations - completionProjection.releasedStations - completionProjection.inProgressStations - completionProjection.completedStations - completionProjection.verifiedStations - completionProjection.blockedStations - completionProjection.rejectedStations),
    releasedAssets: completionProjection.releasedStations,
    inProgressAssets: completionProjection.inProgressStations,
    completedAssets: completionProjection.completedStations,
    verifiedAssets: completionProjection.verifiedStations,
    blockedAssets: completionProjection.blockedStations,
    rejectedAssets: completionProjection.rejectedStations,
    percentComplete: completionProjection.percentComplete,
    objectCompletionPercent: completionProjection.objectCompletionPercent,
    stationDerivedCompletionPercent: completionProjection.stationCompletionPercent,
    workCompletionPercent: completionProjection.workCompletionPercent,
    completionAuthority: completionProjection.completionAuthority,
    completionProjection,
  };
}

function routeAuthority(scopeVersion) {
  return scopeVersion?.certifiedRouteReference?.routeAuthorityState ?? scopeVersion?.canonicalTruth?.certifiedRouteReference?.routeAuthorityState;
}

function hasRouteAuthority(scopeVersion) {
  return ["CERTIFIED_ROUTE", "PROVISIONALLY_CERTIFIED"].includes(String(routeAuthority(scopeVersion)));
}

function approvedForControl(scopeVersion) {
  return (
    ["APPROVED", "CONTROL", "CONTROL_ACTIVE", "FIELD", "PARTIALLY_COMPLETE", "COMPLETE", "VERIFIED", "OPERATIONAL"].includes(String(authoritativeLifecycleState(scopeVersion))) &&
    hasRouteAuthority(scopeVersion) &&
    routeStations(scopeVersion).length > 0 &&
    scopeObjects(scopeVersion).length > 0
  );
}

function lifecycleViolations(scopeVersion, workItems, closures) {
  const violations = [];
  if (!scopeVersion) return violations;
  const lifecycleState = authoritativeLifecycleState(scopeVersion);
  if (lifecycleState === "APPROVED" && !hasRouteAuthority(scopeVersion)) {
    violations.push({
      violationId: `SCOPEVERSION_APPROVED_WITHOUT_CERTIFIED_ROUTE:${scopeVersion.scopeVersionId}:NO_WORK:NO_CLOSURE`,
      severity: "BLOCKING",
      code: "SCOPEVERSION_APPROVED_WITHOUT_CERTIFIED_ROUTE",
      scopeVersionId: scopeVersion.scopeVersionId,
      message: "ScopeVersion is APPROVED without certified route authority.",
      createdAt: scopeVersion.updatedAt,
    });
  }
  workItems.forEach((workItem) => {
    if (!approvedForControl(scopeVersion)) {
      violations.push({
        violationId: `CONTROL_WORK_WITHOUT_APPROVED_SCOPE:${scopeVersion.scopeVersionId}:${workItem.workItemId}:NO_CLOSURE`,
        severity: "BLOCKING",
        code: "CONTROL_WORK_WITHOUT_APPROVED_SCOPE",
        scopeVersionId: scopeVersion.scopeVersionId,
        workItemId: workItem.workItemId,
        message: "Control work exists without an approved executable ScopeVersion.",
        createdAt: workItem.updatedAt ?? workItem.createdAt,
      });
    }
  });
  if (closures.length) {
    const hasActiveOrCompleteWork = workItems.some((workItem) => workItem.status === "ACTIVE" || workItem.status === "COMPLETE");
    if (!workItems.length || !hasActiveOrCompleteWork) {
      closures.forEach((closure) => {
        violations.push({
          violationId: `FIELD_CLOSURE_WITHOUT_ACTIVE_WORK:${scopeVersion.scopeVersionId}:NO_WORK:${closure.closureId}`,
          severity: "BLOCKING",
          code: "FIELD_CLOSURE_WITHOUT_ACTIVE_WORK",
          scopeVersionId: scopeVersion.scopeVersionId,
          closureId: closure.closureId,
          message: "A field closure exists without active or complete Control work for the selected ScopeVersion.",
          createdAt: closure.closedAt ?? closure.createdAt,
        });
      });
    }
  }
  return violations;
}

function timelineFor(scopeVersion, workItems, closures) {
  const scopeEvents = Array.isArray(scopeVersion?.events)
    ? scopeVersion.events.map((event) => ({
        ...event,
        payload: event.payload ?? {},
      }))
    : [];
  const workEvents = workItems.map((item) => ({
    eventId: item.workItemId,
    type: `control.${String(item.status ?? "unknown").toLowerCase()}`,
    entityId: item.workItemId,
    entityType: "ControlWorkItem",
    payload: item,
    createdAt: item.updatedAt ?? item.createdAt,
  }));
  const closureEvents = closures.map((closure) => ({
    eventId: closure.closureId,
    type: `field.${String(closure.closureType ?? "closure").toLowerCase()}.closed`,
    entityId: closure.closureId,
    entityType: "FieldClosure",
    payload: closure,
    createdAt: closure.closedAt ?? closure.createdAt ?? closure.updatedAt,
  }));
  return dedupeById([...scopeEvents, ...workEvents, ...closureEvents], "eventId").sort((a, b) => String(a.createdAt ?? "").localeCompare(String(b.createdAt ?? "")));
}

async function buildProjection(scopeVersionId) {
  const allWorkItems = await listRecords(DIRS.controlWorkItems);
  const allFieldClosures = await listRecords(DIRS.fieldClosures);
  const runtimeObjects = await listRecords(DIRS.runtimeObjects);
  const commercialRuntimeObjects = dedupeById(
    runtimeObjects.filter((record) => ["ACCOUNT", "CONTACT", "OPPORTUNITY", "CUSTOMER_TWIN", "PRODUCT", "FULFILLMENT_PLAN", "PROPOSAL"].includes(String(record?.objectType ?? ""))),
    "runtimeId"
  ).sort((a, b) => String(b.updatedAt ?? b.createdAt ?? "").localeCompare(String(a.updatedAt ?? a.createdAt ?? ""))).slice(0, 24);
  if (!scopeVersionId) {
    const metrics = {
      openWorkItems: allWorkItems.filter((item) => !["COMPLETE", "CANCELLED"].includes(item.status)).length,
      completedWorkItems: allWorkItems.filter((item) => item.status === "COMPLETE").length,
      activeWorkItems: allWorkItems.filter((item) => item.status === "ACTIVE").length,
      pendingWorkItems: allWorkItems.filter((item) => item.status === "PENDING").length,
      cancelledWorkItems: allWorkItems.filter((item) => item.status === "CANCELLED").length,
      closureCount: allFieldClosures.length,
      completedFeet: allFieldClosures.reduce((sum, closure) => sum + closureFeet(closure), 0),
    };
    return {
      projectionSource: "SERVER",
      scopeVersionId: "",
      workItems: [],
      closures: [],
      timeline: [],
      metrics,
      completionProjection: metrics.completionProjection,
      lifecycleViolations: [],
      graphContext: { matched: null },
      commercialRuntimeObjects,
      totals: {
        workItemsLoaded: allWorkItems.length,
        closuresLoaded: allFieldClosures.length,
        runtimeObjectsLoaded: runtimeObjects.length,
      },
    };
  }

  const scopeVersion = await loadRecord(DIRS.scopeVersions, scopeVersionId).catch(() => null);
  if (!scopeVersion) return null;
  const workItems = allWorkItems.filter((item) => item?.scopeVersionId === scopeVersionId);
  const closures = selectedClosures(allFieldClosures, scopeVersion, scopeVersionId);
  const metrics = metricsFor(scopeVersion, workItems, closures);
  const timeline = timelineFor(scopeVersion, workItems, closures);
  const violations = lifecycleViolations(scopeVersion, workItems, closures);

  console.log("[TWIN_PROJECTION_SCOPE_FILTER]", {
    scopeVersionId,
    totalWorkItemsLoaded: allWorkItems.length,
    selectedWorkItems: workItems.length,
    totalClosuresLoaded: allFieldClosures.length,
    selectedClosures: closures.length,
    completedFeet: metrics.completedFeet,
    projectionSource: "SERVER",
  });
  console.log("[TWIN_PROJECTION_METRICS]", {
    scopeVersionId,
    ...metrics,
    projectionSource: "SERVER",
  });

  return {
    projectionSource: "SERVER",
    scopeVersionId,
    scopeVersion,
    workItems,
    closures,
    timeline,
    metrics,
    completionProjection: metrics.completionProjection,
    lifecycleViolations: violations,
    graphContext: graphContext(scopeVersion),
    commercialRuntimeObjects,
    totals: {
      workItemsLoaded: allWorkItems.length,
      closuresLoaded: allFieldClosures.length,
      runtimeObjectsLoaded: runtimeObjects.length,
    },
  };
}

async function buildCertifiedTwinProjection(twinStateId = "") {
  const records = (await listRecords(DIRS.iofPackageTwins))
    .filter((record) => record?.authority === "CERTIFIED_IOF_TWIN" && ["CERTIFIED", "AUTHORIZED"].includes(record?.twinState))
    .sort((a, b) => Number(b.stateRevision ?? 0) - Number(a.stateRevision ?? 0) || String(b.updatedAt ?? b.certifiedAt ?? "").localeCompare(String(a.updatedAt ?? a.certifiedAt ?? "")));
  const certifiedTwin = twinStateId
    ? records.find((record) => record.twinStateId === twinStateId || record.twinId === twinStateId || record.logicalTwinId === twinStateId)
    : records[0];
  if (!certifiedTwin) return null;
  const certifiedIofPackage = certifiedTwin.certifiedIofPackageId
    ? await loadRecord(DIRS.certifiedIofPackages, certifiedTwin.certifiedIofPackageId).catch(() => null)
    : null;
  const routeRepository = certifiedTwin.routeRepositoryId
    ? await loadRecord(DIRS.commercialRoutes, certifiedTwin.routeRepositoryId).catch(() => null)
    : null;
  const routeCoordinates = asArray(routeRepository?.commercialGeometry)
    .map((item) => asArray(item).slice(0, 2).map(Number))
    .filter((item) => item.length === 2 && item.every(Number.isFinite));
  const endpointAuthority = asRecord(routeRepository?.endpointAuthority);
  const endpointProjection = (value, fallback, role) => {
    const source = asRecord(value);
    const site = asRecord(source.site);
    const coordinate = asArray(source.coordinate).length >= 2 ? asArray(source.coordinate).slice(0, 2).map(Number) : fallback;
    return coordinate?.length === 2 ? {
      role,
      label: firstText(source.label, source.siteName, site.name, `${role} endpoint`),
      coordinate,
      coordinateSource: firstText(source.coordinateSource, site.coordinateSource, "COMMERCIAL_ROUTE_REPOSITORY"),
    } : null;
  };
  const sharedOpportunityMapProjection = routeRepository && routeCoordinates.length > 1 ? {
    authority: "COMMERCIAL_ROUTE_REPOSITORY",
    projectionPurpose: "SHARED_OPPORTUNITY_MAP",
    opportunityId: firstText(routeRepository.opportunityId, certifiedTwin.opportunityId),
    routeRepositoryId: certifiedTwin.routeRepositoryId,
    routeRevision: Number(routeRepository.routeRevision ?? certifiedTwin.routeRevision ?? 1),
    routeGeometryId: firstText(routeRepository.routeGeometryId, certifiedTwin.routeGeometryId),
    geometryHash: firstText(routeRepository.geometryHash, certifiedTwin.geometryHash),
    routeMiles: Number(routeRepository.routeMiles ?? 0),
    routeFeet: Number(routeRepository.routeFeet ?? 0),
    orientation: firstText(endpointAuthority.orientation, endpointAuthority.commercialOrientation, "A_TO_Z"),
    coordinates: routeCoordinates,
    endpoints: [
      endpointProjection(endpointAuthority.aSite ?? routeRepository.aLocation, routeCoordinates[0], "A"),
      endpointProjection(endpointAuthority.zSite ?? routeRepository.zLocation, routeCoordinates.at(-1), "Z"),
    ].filter(Boolean),
    responseProjectionOnly: true,
  } : null;
  return {
    projectionSource: "SERVER",
    projectionType: "CERTIFIED_IOF_TWIN",
    twinStateId: certifiedTwin.twinStateId,
    certifiedTwin,
    certifiedIofPackage,
    sharedOpportunityMapProjection,
    sourceDraftPackageId: certifiedTwin.draftIofPackageId,
    scopeVersionId: firstText(certifiedTwin.scopeVersionId),
    scopeVersion: certifiedTwin.scopeVersionId ? await loadRecord(DIRS.scopeVersions, certifiedTwin.scopeVersionId).catch(() => null) : null,
    workItems: [],
    closures: [],
    timeline: [{
      eventId: certifiedTwin.certificationId,
      type: "iof_twin.certified",
      entityId: certifiedTwin.twinStateId,
      entityType: "CertifiedIofTwin",
      payload: {
        certificationLedgerId: certifiedTwin.certificationLedgerId,
        certificationHash: certifiedTwin.certificationHash,
        engineeringApprovalId: certifiedTwin.engineeringApprovalId,
      },
      createdAt: certifiedTwin.certifiedAt,
    }],
    metrics: {
      openWorkItems: 0,
      completedWorkItems: 0,
      activeWorkItems: 0,
      pendingWorkItems: 0,
      cancelledWorkItems: 0,
      closureCount: 0,
      completedFeet: 0,
      completionAuthority: "CERTIFICATION_LEDGER",
    },
    lifecycleViolations: [],
    graphContext: {
      routeId: certifiedTwin.routeRepositoryId,
      matched: null,
    },
    totals: {
      certifiedTwinStatesLoaded: records.length,
      workItemsLoaded: 0,
      closuresLoaded: 0,
    },
    updatedAt: certifiedTwin.updatedAt,
  };
}

export async function handleTwinState(req, res, pathname) {
  if (pathname !== "/api/twin/state" && pathname !== "/api/twin/state/") return false;
  if (handleOptions(req, res)) return true;
  if (req.method !== "GET") {
    errorResponse(res, 405, "Method not allowed");
    return true;
  }

  const url = new URL(req.url ?? "/", `https://${req.headers.host ?? "runtime.invalid"}`);
  const scopeVersionId = url.searchParams.get("scopeVersionId") ?? "";
  const twinStateId = url.searchParams.get("twinStateId") ?? url.searchParams.get("twinId") ?? "";
  const certified = url.searchParams.get("certified") === "true" || Boolean(twinStateId);
  console.log("[TWIN_PROJECTION_REQUEST]", { scopeVersionId: scopeVersionId || "none", twinStateId: twinStateId || "none", certified });
  const projection = certified ? await buildCertifiedTwinProjection(twinStateId) : await buildProjection(scopeVersionId);
  if (!projection) {
    jsonResponse(res, 404, {
      error: certified ? "CERTIFIED_IOF_TWIN_NOT_FOUND" : "SCOPEVERSION_NOT_FOUND",
      scopeVersionId,
      twinStateId,
    });
    return true;
  }
  console.log("[TWIN_PROJECTION_SERVER]", {
    scopeVersionId: projection.scopeVersionId || "none",
    selectedWorkItems: projection.workItems?.length ?? 0,
    selectedClosures: projection.closures?.length ?? 0,
    completedFeet: projection.metrics?.completedFeet ?? 0,
    projectionSource: projection.projectionSource,
  });
  jsonResponse(res, 200, projection);
  return true;
}
