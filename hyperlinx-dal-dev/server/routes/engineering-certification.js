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
  const packageReadiness = packageReadinessFor({ ...raw, packageId, status, proposedIofUnits });
  return {
    ...raw,
    packageId,
    draftPackageId: String(raw.draftPackageId ?? packageId),
    packageType: raw.packageType ?? "ENGINEERING",
    status,
    workflowStatus: raw.workflowStatus ?? (status === "RETURNED_TO_COMMERCIAL" ? "RETURNED_TO_COMMERCIAL" : "ENGINEERING_REVIEW"),
    packageReadiness,
    proposalId: String(raw.proposalId ?? raw.sourceProposalId ?? ""),
    customerId: String(raw.customerId ?? raw.accountId ?? ""),
    opportunityId: String(raw.opportunityId ?? ""),
    assignedEngineerId: String(raw.assignedEngineerId ?? raw.engineerId ?? ""),
    assignedEngineer: String(raw.assignedEngineer ?? raw.engineerName ?? ""),
    priority: raw.priority ?? "NORMAL",
    submittedAt: raw.submittedAt ?? raw.createdAt ?? timestamp,
    proposalSummary: raw.proposalSummary ?? {},
    commercialSummary: raw.commercialSummary ?? {},
    customerSummary: raw.customerSummary ?? {},
    engineeringReadiness: raw.engineeringReadiness ?? packageReadiness.status,
    commercialConfidence: numeric(raw.commercialConfidence, numeric(raw.confidence, 0)),
    assemblyReport: raw.assemblyReport ?? {},
    proposedIofUnits,
    route: asArray(raw.route),
    stations: asArray(raw.stations),
    objects: asArray(raw.objects),
    relationships: asArray(raw.relationships),
    evidence: asArray(raw.evidence),
    historyIds: unique(asArray(raw.historyIds)),
    runtimeObjectIds: unique(asArray(raw.runtimeObjectIds)),
    runtimeRelationshipIds: unique(asArray(raw.runtimeRelationshipIds)),
    runtimeEvidenceIds: unique(asArray(raw.runtimeEvidenceIds)),
    existingInventoryReferences: unique(asArray(raw.existingInventoryReferences)),
    customerDesignReferences: unique(asArray(raw.customerDesignReferences)),
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
  const missing = [];
  if (!record.proposalId) missing.push("Proposal reference");
  if (!record.customerId) missing.push("Customer");
  if (!record.opportunityId) missing.push("Opportunity");
  if (!units.length) missing.push("Proposed IOF Units");
  if (!asArray(record.runtimeObjectIds).length && !asArray(record.geometryReferences).length) missing.push("Runtime object or geometry references");
  if (!asArray(record.runtimeEvidenceIds).length && !asArray(record.evidence).length) missing.push("Evidence");
  return {
    status: missing.length ? "INCOMPLETE" : certifiedUnits === units.length && units.length ? "READY_FOR_PACKAGE_CERTIFICATION" : "READY_FOR_ENGINEERING_REVIEW",
    missingInformation: missing,
    proposedUnitCount: units.length,
    certifiedUnitCount: certifiedUnits,
    certificationPercent: units.length ? Math.round((certifiedUnits / units.length) * 100) : 0,
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
    organizationId: user.organizationId,
    workspaceId: user.workspaceId,
    timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
    details,
    metadata,
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
    owner: user.name,
    ownerId: user.userId,
    createdBy: user.name,
    createdById: user.userId,
    assignedTo: unique([record.assignedEngineerId, user.userId]),
    organization: user.organizationId,
    organizationId: user.organizationId,
    workspace: user.workspaceId,
    workspaceId: user.workspaceId,
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
      proposalId: record.proposalId,
      opportunityId: record.opportunityId,
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
    packageReadiness: draft.packageReadiness,
    proposalSummary: draft.proposalSummary,
    commercialConfidence: draft.commercialConfidence,
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

async function listReviewQueue() {
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
  return sources.map((sourceId, index) => normalizeUnit({
    unitId: `${packageId}:unit:${String(index + 1).padStart(3, "0")}`,
    sourceRuntimeObjectId: runtimeIds[index] ?? "",
    runtimeObjectIds: runtimeIds[index] ? [runtimeIds[index]] : [],
    geometryReferences: geometryRefs[index] ? [geometryRefs[index]] : geometryRefs.slice(0, 1),
    runtimeRelationshipIds: asArray(proposal.runtimeRelationshipIds),
    runtimeEvidenceIds: asArray(proposal.runtimeEvidenceIds),
    unitType: runtimeIds[index] ? "RUNTIME_REFERENCE_UNIT" : "GEOMETRY_REFERENCE_UNIT",
    name: `Proposed IOF Unit ${index + 1}`,
    status: "PROPOSED",
  }, packageId, index));
}

async function handleAssembleFromProposal(req, res, user) {
  const body = await readRequestJson(req);
  const proposalId = String(body.proposalId ?? body.proposal?.proposalId ?? "");
  if (!proposalId) {
    errorResponse(res, 400, "proposalId is required.");
    return;
  }
  const proposal = await loadRecord(DIRS.proposalDrafts, proposalId).catch(() => null);
  if (!proposal) {
    errorResponse(res, 404, `Proposal not found: ${proposalId}`);
    return;
  }
  if (!(proposal.approvalState === "APPROVED" || ["CUSTOMER_APPROVED", "READY_FOR_IOF_PACKAGE"].includes(proposal.status))) {
    errorResponse(res, 409, "Draft IOF Package assembly requires a customer-approved Proposal.");
    return;
  }
  const packageId = String(body.packageId ?? `DRAFT-IOF-${proposalId}-${Date.now()}`);
  const proposedIofUnits = unitsFromProposal(proposal, packageId);
  if (!proposedIofUnits.length) {
    errorResponse(res, 409, "Approved Proposal has no runtime or geometry references to assemble.");
    return;
  }
  const draft = await persistDraftPackage({
    packageId,
    packageType: "ENGINEERING",
    status: "DRAFT",
    workflowStatus: "ENGINEERING_REVIEW",
    proposalId,
    customerId: proposal.customerId,
    opportunityId: proposal.opportunityId,
    assignedEngineerId: body.assignedEngineerId ?? user.userId,
    assignedEngineer: body.assignedEngineer ?? user.name,
    priority: body.priority ?? "NORMAL",
    submittedAt: nowIso(),
    proposalSummary: {
      title: proposal.title,
      proposalNumber: proposal.proposalNumber,
      version: proposal.version,
      readiness: proposal.readiness,
    },
    commercialSummary: {
      pricingSummary: proposal.pricingSummary,
      marginSummary: proposal.marginSummary,
      confidenceSummary: proposal.confidenceSummary,
      commercialAssumptionIds: proposal.commercialAssumptionIds,
      dealPointIds: proposal.dealPointIds,
    },
    customerSummary: {
      customerId: proposal.customerId,
      name: proposal.customer ?? proposal.customerId,
      approvalState: proposal.approvalState,
      approvedAt: proposal.approvedAt,
    },
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
    customerTwinReference: proposal.customerTwinReference,
    geometryReferences: proposal.geometryReferences,
    sourceProposalVersion: proposal.version,
  }, user, "runtime.iof_package.assembled_from_proposal", "Draft IOF Package assembled from approved Proposal references.");
  await appendHistory(draft, user, "runtime.authority_transfer.commercial_to_engineering", "Authority transferred from Commercial Proposal to Engineering Review.", {
    proposalId,
    packageId: draft.packageId,
  });
  jsonResponse(res, 201, { iofPackage: draft, draftPackage: draft });
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
    scopeVersionId,
    certifiedIofUnitIds: certifiedUnits.map((unit) => unit.unitId).sort(),
    runtimeObjectIds: unique(certifiedPackage.runtimeObjectIds).sort(),
    runtimeRelationshipIds: unique(certifiedPackage.runtimeRelationshipIds).sort(),
    runtimeEvidenceIds: unique(certifiedPackage.runtimeEvidenceIds).sort(),
    checklist,
  };
  return {
    certificateId,
    proposalId: certifiedPackage.proposalId,
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
      customerId: certifiedPackage.customerId,
      opportunityId: certifiedPackage.opportunityId,
      existingInventoryReferences: certifiedPackage.existingInventoryReferences,
      customerTwinReference: certifiedPackage.customerTwinReference,
      customerDesignReferences: certifiedPackage.customerDesignReferences,
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
      proposalId: certifiedPackage.proposalId,
      draftIofPackageId: certifiedPackage.sourcePackageId,
      certifiedIofPackageId: certifiedPackage.certifiedPackageId,
      scopeVersionId: certificate.scopeVersionId,
      certifiedBy: user.userId,
    },
    metadata: {
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

  if (req.method === "GET" && parts[0] === "draft-packages" && parts[1]) {
    const draft = await loadDraftPackage(parts[1]).catch(() => null);
    if (!draft) errorResponse(res, 404, `Draft IOF Package not found: ${parts[1]}`);
    else jsonResponse(res, 200, { iofPackage: draft, draftPackage: draft });
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
