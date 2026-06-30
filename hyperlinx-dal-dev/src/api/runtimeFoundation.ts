import { DAL_API } from "../config/dalApi";
import type {
  RuntimeEvidenceRecord,
  RuntimeInventoryRecord,
  RuntimeObjectRecord,
  RuntimeRelationshipRecord,
  RuntimeTranslationCommitRequest,
  RuntimeTranslationCommitResponse,
  RuntimeValidationReport,
} from "../runtime/RuntimeObjectModel";
import type { TeralinxAuthSession } from "./teralinxRuntime";

function apiUrl(path: string) {
  return `${DAL_API}${path}`;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), init);
  const text = await response.text().catch(() => "");
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}${text ? `: ${text}` : ""}`);
  return (text ? JSON.parse(text) : {}) as T;
}

function authHeaders(session?: TeralinxAuthSession | null, headers: HeadersInit = {}) {
  return {
    ...headers,
    ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
  };
}

function unwrapList<T>(data: any, keys: string[]): T[] {
  const items = keys.map((key) => data?.[key]).find(Array.isArray) ?? data?.items ?? data?.data ?? data;
  return Array.isArray(items) ? items : [];
}

export async function commitRuntimeTranslation(runtimeCommit: RuntimeTranslationCommitRequest, session?: TeralinxAuthSession | null) {
  return requestJson<RuntimeTranslationCommitResponse>("/api/runtime/commit", {
    method: "POST",
    headers: authHeaders(session, { "Content-Type": "application/json" }),
    body: JSON.stringify({ runtimeCommit }),
  });
}

export async function listRuntimeEvidence() {
  const data = await requestJson<any>("/api/runtime/evidence");
  return unwrapList<RuntimeEvidenceRecord>(data, ["evidence", "evidenceRecords"]);
}

export async function listRuntimeInventories() {
  const data = await requestJson<any>("/api/runtime/inventories");
  return unwrapList<RuntimeInventoryRecord>(data, ["inventories", "runtimeInventories"]);
}

export async function listRuntimeObjects() {
  const data = await requestJson<any>("/api/runtime/objects");
  return unwrapList<RuntimeObjectRecord>(data, ["runtimeObjects", "objects"]);
}

export async function listRuntimeRelationships() {
  const data = await requestJson<any>("/api/runtime/relationships");
  return unwrapList<RuntimeRelationshipRecord>(data, ["relationships", "runtimeRelationships"]);
}

export async function listRuntimeValidationReports() {
  const data = await requestJson<any>("/api/runtime/validation");
  return unwrapList<RuntimeValidationReport>(data, ["validationReports", "reports"]);
}

export async function searchRuntimeObjects(query: string, collection = "") {
  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query.trim());
  if (collection.trim()) params.set("collection", collection.trim());
  return requestJson<{ query: string; collection: string; total: number; results: Array<{ collection: string; id: string; label: string; record: unknown }> }>(
    `/api/runtime/search${params.toString() ? `?${params}` : ""}`,
  );
}
