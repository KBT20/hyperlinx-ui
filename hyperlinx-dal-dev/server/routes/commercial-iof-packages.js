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
  const submitted = {
    ...savedDraftPackage,
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
    const result = await submitCommercialDraftPackageToEngineering(rawDraftPackage, user);
    jsonResponse(res, 200, result);
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
