import { DAL_API } from "../config/dalApi";
import { findRecord, readCollection, writeRecord, deleteRecord } from "./dalStorage";
import { createScopeVersionFromInventoryGraph } from "../scopeversion/scopeVersionUtils";
import { applyScopeVersionCertification } from "../scopeversion/scopeVersionCertification";
import type {
  ClosureRecord,
  InventoryGraph,
  ScopeVersion,
  ScopeVersionCertificationState,
  ScopeVersionGraphSummary,
  ScopeVersionRelationshipType,
  ScopeVersionTruthType,
} from "../types/dal";

type ScopeVersionListResponse = {
  scopeVersions?: ScopeVersion[];
  items?: ScopeVersion[];
  data?: ScopeVersion[];
};

function apiUrl(path: string) {
  return `${DAL_API}${path}`;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const text = await response.text().catch(() => "");
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}${text ? `: ${text}` : ""}`);
  return (text ? JSON.parse(text) : {}) as T;
}

async function tryRemote<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    return await requestJson<T>(url, init);
  } catch (err) {
    console.warn("DAL SCOPEVERSION LOCAL FALLBACK ACTIVE", url, err instanceof Error ? err.message : String(err));
    return null;
  }
}

function unwrapList(data: ScopeVersionListResponse | ScopeVersion[] | unknown): ScopeVersion[] {
  if (Array.isArray(data)) return data as ScopeVersion[];
  const record = data as ScopeVersionListResponse;
  if (Array.isArray(record?.scopeVersions)) return record.scopeVersions;
  if (Array.isArray(record?.items)) return record.items;
  if (Array.isArray(record?.data)) return record.data;
  return [];
}

function inferType(scopeVersion: ScopeVersion): ScopeVersionTruthType {
  if (scopeVersion.type) return scopeVersion.type;
  if (scopeVersion.source === "InventoryGraph") return "INVENTORY";
  if (scopeVersion.source === "FieldClosure") return "FIELD_CLOSED";
  if (scopeVersion.status === "APPROVED") return "APPROVED";
  return "CANDIDATE";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function nowIso() {
  return new Date().toISOString();
}

function isCertifiedImmutable(scopeVersion: ScopeVersion) {
  return scopeVersion.certificationState === "CERTIFIED" || scopeVersion.isImmutable === true;
}

function summariesEqual(a?: ScopeVersionGraphSummary, b?: ScopeVersionGraphSummary) {
  return (
    Number(a?.nodeCount ?? 0) === Number(b?.nodeCount ?? 0) &&
    Number(a?.edgeCount ?? 0) === Number(b?.edgeCount ?? 0) &&
    Number(a?.stationCount ?? 0) === Number(b?.stationCount ?? 0) &&
    Number(a?.routeCount ?? 0) === Number(b?.routeCount ?? 0)
  );
}

function relationshipForChild(scopeVersion: ScopeVersion): ScopeVersionRelationshipType {
  if (scopeVersion.relationshipType && scopeVersion.relationshipType !== "ROOT") return scopeVersion.relationshipType;
  if (scopeVersion.source === "GraphExtension") return "GRAPH_EXTENSION";
  if (scopeVersion.source === "FieldClosure") return "FIELD_CLOSURE";
  if (scopeVersion.type === "AS_BUILT") return "AS_BUILT";
  return "AMENDMENT";
}

function childScopeVersionId(parent: ScopeVersion, relationshipType: ScopeVersionRelationshipType) {
  return `${parent.scopeVersionId}-${relationshipType.toLowerCase().replaceAll("_", "-")}-${Date.now().toString(36)}`;
}

function stripCertificationTruth(canonicalTruth: ScopeVersion["canonicalTruth"]) {
  const truth = asRecord(canonicalTruth);
  const { certification: _certification, constitutionalAuthority: _constitutionalAuthority, ...rest } = truth;
  return rest;
}

function createChildScopeVersion(
  parent: ScopeVersion,
  proposed: ScopeVersion,
  relationshipType: ScopeVersionRelationshipType = relationshipForChild(proposed)
): ScopeVersion {
  const timestamp = nowIso();
  const scopeVersionId =
    proposed.scopeVersionId && proposed.scopeVersionId !== parent.scopeVersionId
      ? proposed.scopeVersionId
      : childScopeVersionId(parent, relationshipType);
  return normalizeScopeVersion({
    ...proposed,
    scopeVersionId,
    parentScopeVersionId: parent.scopeVersionId,
    rootScopeVersionId: parent.rootScopeVersionId ?? parent.scopeVersionId,
    relationshipType,
    certificationState: "DRAFT",
    isImmutable: false,
    updatedAt: timestamp,
    createdAt: timestamp,
    canonicalTruth: {
      ...stripCertificationTruth(proposed.canonicalTruth),
      parentScopeVersionId: parent.scopeVersionId,
      rootScopeVersionId: parent.rootScopeVersionId ?? parent.scopeVersionId,
      relationshipType,
      supersedesScopeVersionId: relationshipType === "SUPERSEDES" ? parent.scopeVersionId : undefined,
      constitutionalAuthority: "NON_AUTHORITATIVE",
    },
    events: [
      ...(proposed.events ?? []),
      {
        eventId: `event-${Date.now().toString(36)}`,
        type: "scopeversion.child.created",
        entityId: scopeVersionId,
        entityType: "ScopeVersion",
        payload: {
          parentScopeVersionId: parent.scopeVersionId,
          rootScopeVersionId: parent.rootScopeVersionId ?? parent.scopeVersionId,
          relationshipType,
        },
        createdAt: timestamp,
      },
    ],
  });
}

function assertConstitutionalGuardrails(scopeVersion: ScopeVersion) {
  const truth = asRecord(scopeVersion.canonicalTruth);
  const reasoning = asRecord(truth.reasoning);
  const machineOutput = asRecord(truth.machineOutput);
  const certificationState = scopeVersion.certificationState;
  const relationshipType = scopeVersion.relationshipType ?? "ROOT";
  const claimsAuthority =
    scopeVersion.isImmutable === true ||
    truth.constitutionalAuthority === "CERTIFIED_SCOPEVERSION" ||
    truth.authoritative === true ||
    truth.authority === "AUTHORITATIVE";
  const machineClaimsAuthority =
    truth.aiAuthoritative === true ||
    truth.machineOutputsAuthoritative === true ||
    reasoning.authoritative === true ||
    machineOutput.authoritative === true;

  if (relationshipType !== "ROOT" && !scopeVersion.parentScopeVersionId) {
    throw new Error("Child ScopeVersions must reference parentScopeVersionId.");
  }
  if (scopeVersion.source === "GraphExtension" && !scopeVersion.parentScopeVersionId) {
    throw new Error("Graph extensions must create child ScopeVersions with parentScopeVersionId.");
  }
  if (machineClaimsAuthority) {
    throw new Error("Machine or AI output is advisory and cannot claim ScopeVersion authority.");
  }
  if (claimsAuthority && certificationState !== "CERTIFIED") {
    throw new Error("Only certified ScopeVersions may claim constitutional authority.");
  }
  if (certificationState === "REJECTED" && claimsAuthority) {
    throw new Error("Rejected ScopeVersions cannot become authoritative.");
  }
}

function normalizeScopeVersion(raw: unknown): ScopeVersion {
  const scope = ((raw as any)?.scopeVersion ?? (raw as any)?.data ?? raw) as ScopeVersion;
  const type = inferType(scope);
  const sourceInventoryId = scope.sourceInventoryId ?? scope.inventoryId;
  const certificationState = (scope.certificationState ?? (scope.canonicalTruth as any)?.certification?.certificationState ?? "DRAFT") as ScopeVersionCertificationState;
  const relationshipType = scope.relationshipType ?? (scope.parentScopeVersionId ? "AMENDMENT" : "ROOT");
  const rootScopeVersionId = scope.rootScopeVersionId ?? scope.parentScopeVersionId ?? scope.scopeVersionId;
  const graphSummary = scope.graphSummary ?? (scope.canonicalTruth as any)?.graphSummary ?? {
    nodeCount: Number((scope.canonicalTruth as any)?.nodeCount ?? 0),
    edgeCount: Number((scope.canonicalTruth as any)?.edgeCount ?? 0),
    stationCount: Number((scope.canonicalTruth as any)?.stationCount ?? 0),
    routeCount: Number((scope.canonicalTruth as any)?.routeCount ?? 0),
  };
  return {
    ...scope,
    type,
    relationshipType,
    rootScopeVersionId,
    sourceInventoryId,
    certificationState,
    isImmutable: scope.isImmutable ?? certificationState === "CERTIFIED",
    graphSummary,
    iofPackageIds: Array.isArray(scope.iofPackageIds) ? scope.iofPackageIds : [],
    canonicalTruth: {
      ...(scope.canonicalTruth ?? {}),
      graphSummary,
      constitutionalAuthority: certificationState === "CERTIFIED" ? "CERTIFIED_SCOPEVERSION" : "NON_AUTHORITATIVE",
    },
  };
}

export async function listScopeVersions() {
  const remote = await tryRemote<ScopeVersionListResponse>(apiUrl("/api/scopeversions"));
  const items = remote ? unwrapList(remote).map(normalizeScopeVersion) : await readCollection<ScopeVersion>("scopeVersions");
  return items.map(normalizeScopeVersion).sort((a, b) => String(b.updatedAt ?? b.createdAt).localeCompare(String(a.updatedAt ?? a.createdAt)));
}

export async function loadScopeVersion(scopeVersionId: string) {
  const remote = await tryRemote<ScopeVersion>(apiUrl(`/api/scopeversions/${encodeURIComponent(scopeVersionId)}`));
  if (remote) return normalizeScopeVersion(remote);
  const local = await findRecord<ScopeVersion>("scopeVersions", scopeVersionId);
  if (!local) throw new Error(`ScopeVersion not found: ${scopeVersionId}`);
  return normalizeScopeVersion(local);
}

export async function createScopeVersion(scopeVersion: ScopeVersion) {
  const payload = normalizeScopeVersion(scopeVersion);
  assertConstitutionalGuardrails(payload);
  const remote = await tryRemote<ScopeVersion>(apiUrl("/api/scopeversions"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scopeVersion: payload }),
  });
  const saved = normalizeScopeVersion(remote ?? payload);
  if (!remote) await writeRecord("scopeVersions", saved);
  return saved;
}

export async function updateScopeVersion(scopeVersion: ScopeVersion) {
  const proposed = normalizeScopeVersion({ ...scopeVersion, updatedAt: nowIso() });
  assertConstitutionalGuardrails(proposed);
  const existing = await loadScopeVersion(proposed.scopeVersionId).catch(() => null);
  if (existing && isCertifiedImmutable(existing)) {
    return createScopeVersion(createChildScopeVersion(existing, proposed));
  }
  if (existing?.certificationState === "REJECTED" && proposed.certificationState === "CERTIFIED") {
    return createScopeVersion(createChildScopeVersion(existing, proposed, "AMENDMENT"));
  }
  const payload = proposed;
  const remote = await tryRemote<ScopeVersion>(apiUrl(`/api/scopeversions/${encodeURIComponent(payload.scopeVersionId)}`), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scopeVersion: payload }),
  });
  const saved = normalizeScopeVersion(remote ?? payload);
  if (!remote) await writeRecord("scopeVersions", saved);
  return saved;
}

export async function appendScopeVersionClosure(scopeVersionId: string, closureRecord: ClosureRecord, expectedVersion?: string) {
  const remote = await requestJson<ScopeVersion | { scopeVersion?: ScopeVersion }>(apiUrl(`/api/scopeversions/${encodeURIComponent(scopeVersionId)}/closures`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ closureRecord, expectedVersion }),
  });
  return normalizeScopeVersion(remote);
}

export async function deleteScopeVersion(scopeVersionId: string) {
  const existing = await loadScopeVersion(scopeVersionId).catch(() => null);
  if (existing && isCertifiedImmutable(existing)) {
    throw new Error("Certified ScopeVersions are immutable and cannot be deleted.");
  }
  const remote = await tryRemote<{ ok: boolean }>(apiUrl(`/api/scopeversions/${encodeURIComponent(scopeVersionId)}`), {
    method: "DELETE",
  });
  if (!remote) await deleteRecord("scopeVersions", scopeVersionId);
}

export async function certifyScopeVersionRecord(scopeVersionId: string, graph?: InventoryGraph) {
  const scopeVersion = await loadScopeVersion(scopeVersionId);
  if (isCertifiedImmutable(scopeVersion)) return scopeVersion;
  if (scopeVersion.certificationState === "REJECTED") {
    throw new Error("Rejected ScopeVersions cannot become authoritative. Create a child ScopeVersion with corrected truth.");
  }
  return updateScopeVersion(applyScopeVersionCertification(scopeVersion, graph));
}

export async function attachIofPackage(scopeVersionId: string, iofPackageId: string) {
  const scopeVersion = await loadScopeVersion(scopeVersionId);
  const iofPackageIds = Array.from(new Set([...(scopeVersion.iofPackageIds ?? []), iofPackageId]));
  return updateScopeVersion({
    ...scopeVersion,
    iofPackageIds,
    canonicalTruth: {
      ...scopeVersion.canonicalTruth,
      iofPackageIds,
    },
  });
}

export function hydrateScopeVersionForMap(scopeVersion: ScopeVersion, graph?: InventoryGraph): ScopeVersion {
  if (!graph || scopeVersion.type !== "INVENTORY") return scopeVersion;
  return {
    ...scopeVersion,
    canonicalTruth: {
      ...scopeVersion.canonicalTruth,
      routes: graph.routes,
      nodes: graph.nodes,
      edges: graph.edges,
      stations: graph.stations,
    },
  };
}

export async function createInventoryScopeVersion(graph: InventoryGraph) {
  return applyScopeVersionCertification(createScopeVersionFromInventoryGraph(graph), graph);
}

export async function ensureInventoryScopeVersion(graph: InventoryGraph) {
  const scopeVersionId = graph.scopeVersionId ?? graph.metadata.scopeVersionId ?? `SV-INV-${graph.inventoryId}`;
  const existing = await loadScopeVersion(scopeVersionId).catch(() => null);
  const candidate = applyScopeVersionCertification(
    {
      ...(existing ?? createScopeVersionFromInventoryGraph(graph)),
      scopeVersionId,
      type: "INVENTORY",
      relationshipType: existing?.relationshipType ?? "ROOT",
      rootScopeVersionId: existing?.rootScopeVersionId ?? scopeVersionId,
      sourceInventoryId: graph.inventoryId,
      inventoryId: graph.inventoryId,
      graphId: graph.graphId,
      graphVersion: graph.graphId,
      updatedAt: nowIso(),
    },
    graph
  );
  if (existing && isCertifiedImmutable(existing)) {
    return summariesEqual(existing.graphSummary, candidate.graphSummary)
      ? existing
      : createScopeVersion(createChildScopeVersion(existing, candidate, "SUPERSEDES"));
  }
  return existing ? updateScopeVersion(candidate) : createScopeVersion(candidate);
}
