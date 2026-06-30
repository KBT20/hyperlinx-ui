import { DAL_API } from "../config/dalApi";
import { withStoredAuth } from "./authHeaders";
import { findRecord, readCollection, writeRecord } from "./dalStorage";
import { createScopeVersion, loadScopeVersion } from "./scopeVersionRepository";
import { createCloseEvent } from "./closeEventRepository";
import { createChildScopeVersionFromCloseEvent, createCloseEventFromPackage } from "../closeevents";
import { getAuthoritativeLifecycleState } from "../scopeversion/ScopeVersionLifecycleGuard";
import { logKernelFallbackActive } from "../kernel/KernelStateRegistry";
import type { CloseEvent, IOFPackage, IOFPackageProgress, IOFPackageStatus, IOFPackageType, ScopeVersion } from "../types/dal";

type IOFPackageListResponse = {
  iofPackages?: IOFPackage[];
  packages?: IOFPackage[];
  items?: IOFPackage[];
  data?: IOFPackage[];
};

type ClosePackageResponse = {
  iofPackage?: IOFPackage;
  package?: IOFPackage;
  closeEvent?: CloseEvent;
  childScopeVersion?: ScopeVersion;
};

const DEFAULT_PACKAGE_TYPES: IOFPackageType[] = ["ENGINEERING", "PERMITTING", "CONSTRUCTION", "TESTING"];

function apiUrl(path: string) {
  return `${DAL_API}${path}`;
}

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, withStoredAuth(init));
  const text = await response.text().catch(() => "");
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}${text ? `: ${text}` : ""}`);
  return (text ? JSON.parse(text) : {}) as T;
}

async function tryRemote<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    return await requestJson<T>(url, init);
  } catch (err) {
    logKernelFallbackActive({
      source: "iofPackageRepository",
      url,
      reason: err instanceof Error ? err.message : String(err),
    });
    console.warn("DAL IOF PACKAGE LOCAL FALLBACK ACTIVE", url, err instanceof Error ? err.message : String(err));
    return null;
  }
}

function unwrapList(data: IOFPackageListResponse | IOFPackage[] | unknown): IOFPackage[] {
  if (Array.isArray(data)) return data as IOFPackage[];
  const record = data as IOFPackageListResponse;
  if (Array.isArray(record?.iofPackages)) return record.iofPackages;
  if (Array.isArray(record?.packages)) return record.packages;
  if (Array.isArray(record?.items)) return record.items;
  if (Array.isArray(record?.data)) return record.data;
  return [];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function firstNonEmptyArray(...values: unknown[]) {
  for (const value of values) {
    const items = asArray(value);
    if (items.length) return items;
  }
  return [];
}

function packageProgress(iofPackage: Pick<IOFPackage, "objects" | "status" | "progress">): IOFPackageProgress {
  const totalObjects = Number(iofPackage.progress?.totalObjects ?? iofPackage.objects?.length ?? 0);
  const completedObjects = iofPackage.status === "CLOSED" || iofPackage.status === "COMPLETE"
    ? totalObjects
    : Number(iofPackage.progress?.completedObjects ?? 0);
  const percentComplete = totalObjects ? Math.round((completedObjects / totalObjects) * 100) : iofPackage.status === "CLOSED" ? 100 : 0;
  return { totalObjects, completedObjects, percentComplete };
}

function normalizePackage(raw: unknown): IOFPackage {
  const iofPackage = ((raw as any)?.iofPackage ?? (raw as any)?.package ?? (raw as any)?.data ?? raw) as IOFPackage;
  const timestamp = iofPackage.createdAt ?? nowIso();
  const normalized: IOFPackage = {
    ...iofPackage,
    packageId: String(iofPackage.packageId ?? createId("iof-package")),
    scopeVersionId: String(iofPackage.scopeVersionId),
    packageType: iofPackage.packageType ?? "CONSTRUCTION",
    status: iofPackage.status ?? "DRAFT",
    createdAt: timestamp,
    updatedAt: iofPackage.updatedAt ?? timestamp,
    route: asArray(iofPackage.route),
    stations: asArray(iofPackage.stations),
    objects: asArray(iofPackage.objects),
    metadata: iofPackage.metadata ?? {},
  };
  return {
    ...normalized,
    progress: packageProgress(normalized),
  };
}

function scopeRoutes(scopeVersion: ScopeVersion) {
  const truth = asRecord(scopeVersion.canonicalTruth);
  const geographicBasis = asRecord(truth.geographicBasis);
  const route = asRecord(scopeVersion.route);
  const truthRoute = asRecord(truth.route);
  const explicit = firstNonEmptyArray(truth.routes, asRecord(truth.network).routes);
  if (explicit.length) return explicit;
  const routeGeometry = firstNonEmptyArray(geographicBasis.routeGeometry, geographicBasis.geometry, scopeVersion.geometry, route.coordinates, truthRoute.coordinates);
  if (routeGeometry.length) {
    const routeId = String(asRecord(truth.networkBasis).routeId ?? route.routeId ?? truthRoute.routeId ?? `${scopeVersion.scopeVersionId}:route`);
    return [{ routeId, coordinates: routeGeometry, name: route.name ?? truthRoute.name ?? routeId }];
  }
  return [];
}

function scopeStations(scopeVersion: ScopeVersion) {
  const truth = asRecord(scopeVersion.canonicalTruth);
  return firstNonEmptyArray(truth.stations, asRecord(truth.network).stations, scopeVersion.nearestStation ? [scopeVersion.nearestStation] : [], scopeVersion.station ? [scopeVersion.station] : []);
}

function scopeObjects(scopeVersion: ScopeVersion) {
  const truth = asRecord(scopeVersion.canonicalTruth);
  return firstNonEmptyArray(truth.objects, truth.productionUnits, asRecord(truth.network).objects);
}

export function generateIofPackagesForScopeVersion(scopeVersion: ScopeVersion, packageTypes: IOFPackageType[] = DEFAULT_PACKAGE_TYPES): IOFPackage[] {
  const timestamp = nowIso();
  const route = scopeRoutes(scopeVersion);
  const stations = scopeStations(scopeVersion);
  const objects = scopeObjects(scopeVersion);
  return packageTypes.map((packageType) => {
    const iofPackage: IOFPackage = {
      packageId: `${scopeVersion.scopeVersionId}-${packageType.toLowerCase()}-${Date.now().toString(36)}`,
      scopeVersionId: scopeVersion.scopeVersionId,
      packageType,
      status: "DRAFT",
      createdAt: timestamp,
      updatedAt: timestamp,
      corridorId: String((scopeVersion.canonicalTruth as any)?.corridorId ?? ""),
      segmentId: String((scopeVersion.canonicalTruth as any)?.segmentId ?? ""),
      route,
      stations,
      objects,
      metadata: {
        sourceScopeVersionType: scopeVersion.type,
        sourceScopeVersionLifecycleState: getAuthoritativeLifecycleState(scopeVersion),
        executionDoctrine: "IOF Package = Work",
      },
    };
    return {
      ...iofPackage,
      progress: packageProgress(iofPackage),
    };
  });
}

export async function listIofPackages() {
  const remote = await tryRemote<IOFPackageListResponse>(apiUrl("/api/iof-packages"));
  const items = remote ? unwrapList(remote).map(normalizePackage) : await readCollection<IOFPackage>("iofPackages");
  return items.map(normalizePackage).sort((a, b) => String(b.updatedAt ?? b.createdAt).localeCompare(String(a.updatedAt ?? a.createdAt)));
}

export async function loadIofPackage(packageId: string) {
  const remote = await tryRemote<IOFPackage>(apiUrl(`/api/iof-packages/${encodeURIComponent(packageId)}`));
  if (remote) return normalizePackage(remote);
  const local = await findRecord<IOFPackage>("iofPackages", packageId);
  if (!local) throw new Error(`IOFPackage not found: ${packageId}`);
  return normalizePackage(local);
}

export async function createIofPackage(iofPackage: IOFPackage) {
  const payload = normalizePackage(iofPackage);
  const remote = await tryRemote<IOFPackage>(apiUrl("/api/iof-packages"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ iofPackage: payload }),
  });
  const saved = normalizePackage(remote ?? payload);
  if (!remote) await writeRecord("iofPackages", saved);
  return saved;
}

export async function updateIofPackage(iofPackage: IOFPackage) {
  const existing = await loadIofPackage(iofPackage.packageId).catch(() => null);
  if (existing?.status === "CLOSED") throw new Error("Closed IOF Packages cannot be updated. Create a new package for new work.");
  const payload = normalizePackage({ ...iofPackage, updatedAt: nowIso() });
  const remote = await tryRemote<IOFPackage>(apiUrl(`/api/iof-packages/${encodeURIComponent(payload.packageId)}`), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ iofPackage: payload }),
  });
  const saved = normalizePackage(remote ?? payload);
  if (!remote) await writeRecord("iofPackages", saved);
  return saved;
}

export async function archiveIofPackage(packageId: string) {
  const iofPackage = await loadIofPackage(packageId);
  const payload = normalizePackage({ ...iofPackage, isArchived: true, archivedAt: nowIso(), updatedAt: nowIso() });
  const remote = await tryRemote<IOFPackage>(apiUrl(`/api/iof-packages/${encodeURIComponent(packageId)}/archive`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ iofPackage: payload }),
  });
  const saved = normalizePackage(remote ?? payload);
  if (!remote) await writeRecord("iofPackages", saved);
  return saved;
}

export async function closeIofPackage(packageId: string) {
  const remote = await tryRemote<ClosePackageResponse>(apiUrl(`/api/iof-packages/${encodeURIComponent(packageId)}/close`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (remote?.iofPackage || remote?.package) {
    return {
      iofPackage: normalizePackage(remote.iofPackage ?? remote.package),
      closeEvent: remote.closeEvent,
      childScopeVersion: remote.childScopeVersion,
    };
  }

  const iofPackage = await loadIofPackage(packageId);
  if (iofPackage.status === "CLOSED" && iofPackage.closeEventId) {
    return { iofPackage };
  }
  const parent = await loadScopeVersion(iofPackage.scopeVersionId);
  const closeEvent = await createCloseEvent(createCloseEventFromPackage(iofPackage));
  const closedPackage = await writeRecord(
    "iofPackages",
    normalizePackage({
      ...iofPackage,
      status: "CLOSED",
      closeEventId: closeEvent.closeEventId,
      progress: { totalObjects: iofPackage.objects.length, completedObjects: iofPackage.objects.length, percentComplete: 100 },
      updatedAt: closeEvent.timestamp,
    })
  );
  const childScopeVersion = await createScopeVersion(createChildScopeVersionFromCloseEvent({ parent, iofPackage: closedPackage, closeEvent }));
  closeEvent.childScopeVersionId = childScopeVersion.scopeVersionId;
  await writeRecord("closeEvents", closeEvent);
  return { iofPackage: closedPackage, closeEvent, childScopeVersion };
}
