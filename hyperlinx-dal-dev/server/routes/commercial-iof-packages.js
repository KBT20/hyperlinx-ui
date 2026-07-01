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
    await persistRecord(DIRS.iofPackages, draftPackage.packageId, draftPackage);
    await persistCommercialPackageRuntime(draftPackage, user);
    jsonResponse(res, 201, { draftPackage, iofPackage: draftPackage });
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
