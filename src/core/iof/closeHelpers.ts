import type { IOFCloseTaxonomy } from "./types";

export type IOFCloseRecord = {
  closeType?: string;
  close_type?: string;
  stationId?: string;
  station_id?: string;
  objectId?: string;
  object_id?: string;
  timestamp?: string | number;
  createdAt?: string;
  created_at?: string;
  [key: string]: any;
};

export function normalizeId(value?: string | null): string {
  return (value || "").toString().trim().toLowerCase();
}

export function getCloseType(closeRecord: IOFCloseRecord): string | undefined {
  const raw = closeRecord?.closeType ?? closeRecord?.close_type;
  const value = raw == null ? "" : String(raw);
  return value.trim() || undefined;
}

export function getCloseStationId(closeRecord: IOFCloseRecord): string | undefined {
  const raw = closeRecord?.stationId ?? closeRecord?.station_id;
  const value = raw == null ? "" : String(raw);
  return value.trim() || undefined;
}

export function getCloseTimestamp(closeRecord: IOFCloseRecord): number {
  const raw = closeRecord?.createdAt ?? closeRecord?.created_at ?? closeRecord?.timestamp;
  const value = raw == null ? "" : String(raw);
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.getTime() : 0;
}

export function isWorkActivatedClose(closeRecord: IOFCloseRecord): boolean {
  return getCloseType(closeRecord) === "work.activated";
}

export function isPricingClose(closeRecord: IOFCloseRecord): boolean {
  const type = getCloseType(closeRecord)?.toLowerCase() || "";
  return type.startsWith("pricing");
}

export function buildLatestStationCloseMap(
  closeRecords: IOFCloseRecord[],
  options?: { ignorePricing?: boolean; ignoreWorkActivated?: boolean }
): Map<string, IOFCloseRecord> {
  const map = new Map<string, IOFCloseRecord>();
  const sorted = [...closeRecords].sort(
    (a, b) => getCloseTimestamp(b) - getCloseTimestamp(a)
  );

  for (const record of sorted) {
    const key = normalizeId(getCloseStationId(record));
    if (!key) continue;
    if (options?.ignorePricing && isPricingClose(record)) continue;
    if (options?.ignoreWorkActivated && isWorkActivatedClose(record)) continue;
    if (!map.has(key)) {
      map.set(key, record);
    }
  }

  return map;
}

export function getNextCloseTypeFromSequence(
  lastCloseType: string | null | undefined,
  sequence: string[]
): string | null {
  if (!sequence?.length) return null;
  if (!lastCloseType) return sequence[0] || null;

  const idx = sequence.indexOf(lastCloseType);
  if (idx === -1 || idx + 1 >= sequence.length) return null;

  return sequence[idx + 1] || null;
}

export function getNextCloseTypeForObject(
  objectId: string,
  stationId: string,
  objectType: string | undefined,
  closes: IOFCloseRecord[],
  closeTaxonomy: IOFCloseTaxonomy
): string | null {
  if (!objectType) return null;

  const sequence = closeTaxonomy[objectType] || [];
  if (!sequence.length) return null;

  const existing = closes
    .filter((close) => {
      return (
        normalizeId(close.station_id || close.stationId) === normalizeId(stationId) &&
        normalizeId(close.object_id || close.objectId) === normalizeId(objectId)
      );
    })
    .sort((a, b) => getCloseTimestamp(a) - getCloseTimestamp(b));

  if (!existing.length) {
    return sequence[0] || null;
  }

  const lastClose = existing[existing.length - 1];
  const completed = getCloseType(lastClose);
  if (!completed) return sequence[0] || null;

  const idx = sequence.indexOf(completed);
  if (idx === -1) return sequence[0] || null;

  return sequence[idx + 1] || null;
}

export function buildCloseCountMap(closeRecords: IOFCloseRecord[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const record of closeRecords) {
    const key = normalizeId(getCloseStationId(record));
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return counts;
}

export function buildCloseActivationMap(closeRecords: IOFCloseRecord[]): Map<string, boolean> {
  const map = new Map<string, boolean>();
  const sorted = [...closeRecords].sort(
    (a, b) => getCloseTimestamp(a) - getCloseTimestamp(b)
  );

  for (const record of sorted) {
    if (!isWorkActivatedClose(record)) continue;
    const stationId = getCloseStationId(record);
    if (!stationId) continue;
    map.set(normalizeId(stationId), true);
  }

  return map;
}
