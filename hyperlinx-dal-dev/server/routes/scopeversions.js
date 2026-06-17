import {
  DIRS,
  deleteRecord,
  errorResponse,
  handleOptions,
  jsonResponse,
  listRecords,
  loadRecord,
  nowIso,
  persistRecord,
  readRequestJson,
  routeMatch,
  sortedByUpdated,
  unwrapBody,
} from "./_shared.js";

function normalizeScopeVersion(input = {}) {
  const raw = input.scopeVersion ?? input;
  const timestamp = nowIso();
  return {
    ...raw,
    scopeVersionId: String(raw.scopeVersionId),
    status: raw.status ?? "DRAFT",
    certificationState: raw.certificationState ?? "DRAFT",
    canonicalTruth: raw.canonicalTruth ?? {},
    createdAt: raw.createdAt ?? timestamp,
    updatedAt: raw.updatedAt ?? timestamp,
    events: Array.isArray(raw.events) ? raw.events : [],
  };
}

function isCertifiedImmutable(scopeVersion) {
  return Boolean(scopeVersion?.isImmutable || scopeVersion?.certificationState === "CERTIFIED");
}

function relationshipForChild(proposed = {}) {
  return proposed.relationshipType ?? "AMENDMENT";
}

function createChildScopeVersion(parent, proposed, relationshipType = relationshipForChild(proposed)) {
  const timestamp = nowIso();
  return normalizeScopeVersion({
    ...proposed,
    scopeVersionId: proposed.scopeVersionId && proposed.scopeVersionId !== parent.scopeVersionId ? proposed.scopeVersionId : `${parent.scopeVersionId}-child-${Date.now()}`,
    parentScopeVersionId: parent.scopeVersionId,
    rootScopeVersionId: parent.rootScopeVersionId ?? parent.scopeVersionId,
    relationshipType,
    createdAt: proposed.createdAt ?? timestamp,
    updatedAt: timestamp,
    events: [
      ...(proposed.events ?? []),
      {
        eventId: `event-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        type: "scopeversion.child_created",
        entityId: proposed.scopeVersionId ?? parent.scopeVersionId,
        entityType: "ScopeVersion",
        payload: {
          parentScopeVersionId: parent.scopeVersionId,
          relationshipType,
        },
        createdAt: timestamp,
      },
    ],
  });
}

function certifyScopeVersion(scopeVersion) {
  const timestamp = nowIso();
  const rejected = scopeVersion.certificationState === "REJECTED" || scopeVersion.status === "REJECTED";
  return normalizeScopeVersion({
    ...scopeVersion,
    certificationState: rejected ? "REJECTED" : "CERTIFIED",
    status: rejected ? "REJECTED" : scopeVersion.status,
    isImmutable: !rejected,
    updatedAt: timestamp,
    canonicalTruth: {
      ...(scopeVersion.canonicalTruth ?? {}),
      constitutionalAuthority: rejected ? "NON_AUTHORITATIVE" : "CERTIFIED_SCOPEVERSION",
      certifiedAt: rejected ? undefined : timestamp,
    },
  });
}

export async function loadScopeVersion(scopeVersionId) {
  return normalizeScopeVersion(await loadRecord(DIRS.scopeVersions, scopeVersionId));
}

export async function persistScopeVersion(scopeVersion) {
  const normalized = normalizeScopeVersion(scopeVersion);
  return persistRecord(DIRS.scopeVersions, normalized.scopeVersionId, normalized);
}

export function createChildScopeVersionFromClose(parent, iofPackage, closeEvent) {
  const timestamp = nowIso();
  const eventType = closeEvent.eventType ?? "FIELD_CLOSE";
  const relationshipType = eventType === "AS_BUILT_CLOSE" ? "AS_BUILT" : eventType === "FIELD_CLOSE" ? "FIELD_CLOSURE" : "AMENDMENT";
  const type = eventType === "AS_BUILT_CLOSE" ? "AS_BUILT" : eventType === "FIELD_CLOSE" ? "FIELD_CLOSED" : parent.type;
  return normalizeScopeVersion({
    ...parent,
    scopeVersionId: `${parent.scopeVersionId}-${String(eventType).toLowerCase().replaceAll("_", "-")}-${Date.now()}`,
    type,
    parentScopeVersionId: parent.scopeVersionId,
    rootScopeVersionId: parent.rootScopeVersionId ?? parent.scopeVersionId,
    relationshipType,
    closureEventId: closeEvent.closeEventId,
    certificationState: "DRAFT",
    isImmutable: false,
    status: "ANALYZED",
    createdAt: timestamp,
    updatedAt: timestamp,
    canonicalTruth: {
      ...(parent.canonicalTruth ?? {}),
      parentScopeVersionId: parent.scopeVersionId,
      relationshipType,
      closeEvent,
      closedPackage: iofPackage,
      constitutionalAuthority: "CHILD_SCOPEVERSION_FROM_CLOSE_EVENT",
    },
    events: [
      ...(parent.events ?? []),
      {
        eventId: `event-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        type: "scopeversion.child_from_close",
        entityId: parent.scopeVersionId,
        entityType: "ScopeVersion",
        payload: { packageId: iofPackage.packageId, closeEventId: closeEvent.closeEventId, childRelationship: relationshipType },
        createdAt: timestamp,
      },
    ],
  });
}

export async function handleScopeVersions(req, res, pathname) {
  const match = routeMatch(pathname, "/api/scopeversions");
  if (!match) return false;
  if (handleOptions(req, res)) return true;

  if (match.base && req.method === "GET") {
    jsonResponse(res, 200, { scopeVersions: sortedByUpdated(await listRecords(DIRS.scopeVersions)) });
    return true;
  }

  if (match.base && req.method === "POST") {
    const body = await readRequestJson(req);
    const scopeVersion = await persistScopeVersion(normalizeScopeVersion(body));
    jsonResponse(res, 201, { scopeVersion });
    return true;
  }

  if (!match.base && req.method === "GET") {
    try {
      jsonResponse(res, 200, { scopeVersion: await loadScopeVersion(match.id) });
    } catch {
      errorResponse(res, 404, `ScopeVersion not found: ${match.id}`);
    }
    return true;
  }

  if (!match.base && req.method === "PUT") {
    const body = await readRequestJson(req);
    const proposed = normalizeScopeVersion({ ...unwrapBody(body, "scopeVersion"), scopeVersionId: unwrapBody(body, "scopeVersion")?.scopeVersionId ?? match.id });
    const existing = await loadScopeVersion(match.id).catch(() => null);
    const scopeVersion =
      existing && isCertifiedImmutable(existing)
        ? await persistScopeVersion(createChildScopeVersion(existing, proposed))
        : existing?.certificationState === "REJECTED" && proposed.certificationState === "CERTIFIED"
          ? await persistScopeVersion(createChildScopeVersion(existing, proposed, "AMENDMENT"))
          : await persistScopeVersion(proposed);
    jsonResponse(res, 200, { scopeVersion });
    return true;
  }

  if (!match.base && match.action === "certify" && req.method === "POST") {
    try {
      const existing = await loadScopeVersion(match.id);
      if (isCertifiedImmutable(existing)) {
        jsonResponse(res, 200, { scopeVersion: existing });
        return true;
      }
      if (existing.certificationState === "REJECTED") {
        errorResponse(res, 409, "Rejected ScopeVersions cannot become authoritative. Create a child ScopeVersion with corrected truth.");
        return true;
      }
      const scopeVersion = certifyScopeVersion(existing);
      await persistScopeVersion(scopeVersion);
      jsonResponse(res, 200, { scopeVersion });
    } catch {
      errorResponse(res, 404, `ScopeVersion not found: ${match.id}`);
    }
    return true;
  }

  if (!match.base && req.method === "DELETE") {
    const existing = await loadScopeVersion(match.id).catch(() => null);
    if (existing && isCertifiedImmutable(existing)) {
      errorResponse(res, 409, "Certified ScopeVersions are immutable and cannot be deleted.");
      return true;
    }
    await deleteRecord(DIRS.scopeVersions, match.id);
    jsonResponse(res, 200, { ok: true });
    return true;
  }

  return false;
}
