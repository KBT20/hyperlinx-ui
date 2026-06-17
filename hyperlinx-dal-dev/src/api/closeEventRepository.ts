import { DAL_API } from "../config/dalApi";
import { findRecord, readCollection, writeRecord } from "./dalStorage";
import type { CloseEvent } from "../types/dal";

type CloseEventListResponse = {
  closeEvents?: CloseEvent[];
  items?: CloseEvent[];
  data?: CloseEvent[];
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
    console.warn("DAL CLOSE EVENT LOCAL FALLBACK ACTIVE", url, err instanceof Error ? err.message : String(err));
    return null;
  }
}

function unwrapList(data: CloseEventListResponse | CloseEvent[] | unknown): CloseEvent[] {
  if (Array.isArray(data)) return data as CloseEvent[];
  const record = data as CloseEventListResponse;
  if (Array.isArray(record?.closeEvents)) return record.closeEvents;
  if (Array.isArray(record?.items)) return record.items;
  if (Array.isArray(record?.data)) return record.data;
  return [];
}

function normalizeCloseEvent(raw: unknown): CloseEvent {
  const closeEvent = ((raw as any)?.closeEvent ?? (raw as any)?.data ?? raw) as CloseEvent;
  return {
    ...closeEvent,
    closeEventId: String(closeEvent.closeEventId),
    sourceScopeVersionId: String(closeEvent.sourceScopeVersionId),
    packageId: String(closeEvent.packageId),
    timestamp: closeEvent.timestamp ?? new Date().toISOString(),
    payload: closeEvent.payload ?? {},
  };
}

export async function listCloseEvents() {
  const remote = await tryRemote<CloseEventListResponse>(apiUrl("/api/close-events"));
  const items = remote ? unwrapList(remote).map(normalizeCloseEvent) : await readCollection<CloseEvent>("closeEvents");
  return items.map(normalizeCloseEvent).sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
}

export async function loadCloseEvent(closeEventId: string) {
  const remote = await tryRemote<CloseEvent>(apiUrl(`/api/close-events/${encodeURIComponent(closeEventId)}`));
  if (remote) return normalizeCloseEvent(remote);
  const local = await findRecord<CloseEvent>("closeEvents", closeEventId);
  if (!local) throw new Error(`CloseEvent not found: ${closeEventId}`);
  return normalizeCloseEvent(local);
}

export async function createCloseEvent(closeEvent: CloseEvent) {
  const payload = normalizeCloseEvent(closeEvent);
  const remote = await tryRemote<CloseEvent>(apiUrl("/api/close-events"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ closeEvent: payload }),
  });
  const saved = normalizeCloseEvent(remote ?? payload);
  if (!remote) await writeRecord("closeEvents", saved);
  return saved;
}
