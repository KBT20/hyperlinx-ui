import { DAL_API } from "../config/dalApi";
import { withStoredAuth } from "./authHeaders";
import type { CustomerDesignImport, CustomerDesignLayerVisibility, CustomerDesignLineageEvent } from "../translate/CustomerDesignImport";

const DEFAULT_LAYER_VISIBILITY: CustomerDesignLayerVisibility = {
  customerDesign: true,
  commercialDraft: false,
  engineeringRevision: false,
  acceptedRevision: false,
  inventory: true,
  stations: true,
  fiber: true,
  routes: true,
};

function sourceBaseName(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "").trim() || "Customer Design";
}

export function normalizeCustomerDesignImport(record: CustomerDesignImport): CustomerDesignImport {
  const routes = (record.routes ?? []).map((route) => {
    const dalGeometry = route.dalGeometry?.length
      ? route.dalGeometry
      : (route.geometry ?? []).map((coordinate) => [coordinate.longitude, coordinate.latitude] as [number, number]);
    const geometry = route.geometry?.length
      ? route.geometry
      : dalGeometry.map((coordinate) => ({ longitude: coordinate[0], latitude: coordinate[1] }));
    return {
      ...route,
      geometry,
      dalGeometry,
    };
  });
  const objects = record.objects ?? [];
  const polygons = record.polygons ?? [];
  const folders = record.folders ?? [];
  const activeRouteId = record.activeRouteId ?? routes[0]?.routeId ?? "";
  const activeRoute = routes.find((route) => route.routeId === activeRouteId) ?? routes[0];
  const customerName = record.customerName || record.accountId || "Customer";
  const importId = record.importId || `CUSTOMER-DESIGN-IMPORT-${Date.now()}`;
  const uploadedAt = record.uploadedAt || new Date().toISOString();
  const designId = record.designId || `CUSTOMER-DESIGN-${record.accountId || customerName}-${importId}`.replace(/\s+/g, "-").toUpperCase();
  const libraryPath = record.libraryPath?.length
    ? record.libraryPath
    : [customerName, activeRoute?.folderPath?.[0] ?? sourceBaseName(record.sourceFileName ?? "Customer Design")];
  const fallbackLineageEvent: CustomerDesignLineageEvent = {
    lineageEventId: `CUSTOMER-DESIGN-LINEAGE-${importId}`,
    stage: "IMPORTED",
    label: `${record.sourceFileName ?? "Customer design"} restored into the Customer Design Library.`,
    relatedId: designId,
    routeId: activeRouteId || undefined,
    createdAt: uploadedAt,
    actor: record.uploadedBy || "system",
  };
  const lineage = record.lineage?.length
    ? record.lineage
    : [fallbackLineageEvent];

  return {
    ...record,
    designId,
    importId,
    customerName,
    uploadedAt,
    sourceFileName: record.sourceFileName ?? "Customer Design",
    libraryPath,
    routes,
    objects,
    polygons,
    folders,
    activeRouteId,
    runtimeEvidenceIds: record.runtimeEvidenceIds ?? [],
    runtimeObjectIds: record.runtimeObjectIds ?? [],
    runtimeRelationshipIds: record.runtimeRelationshipIds ?? [],
    runtimeValidationReportIds: record.runtimeValidationReportIds ?? [],
    previewGeometry: record.previewGeometry?.length ? record.previewGeometry : activeRoute?.dalGeometry ?? [],
    layerVisibility: {
      ...DEFAULT_LAYER_VISIBILITY,
      ...(record.layerVisibility ?? {}),
    },
    lineage,
    diagnostics: record.diagnostics ?? [],
    auditEvents: record.auditEvents ?? [],
    noScopeVersionCreation: true,
    noInventoryMutation: true,
    noCertifiedRouteAuthority: true,
  };
}

function apiUrl(path: string) {
  return `${DAL_API}${path}`;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), withStoredAuth(init));
  const text = await response.text().catch(() => "");
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}${text ? `: ${text}` : ""}`);
  return (text ? JSON.parse(text) : {}) as T;
}

function unwrapList<T>(data: any, keys: string[]): T[] {
  const items = keys.map((key) => data?.[key]).find(Array.isArray) ?? data?.items ?? data?.data ?? data;
  return Array.isArray(items) ? items : [];
}

export async function listCustomerDesignImports() {
  const data = await requestJson<any>("/api/customer-design-imports");
  const records = unwrapList<CustomerDesignImport>(data, ["customerDesignImports", "imports"]);
  return records
    .map(normalizeCustomerDesignImport)
    .sort((a, b) => String(b.uploadedAt).localeCompare(String(a.uploadedAt)));
}

export async function saveCustomerDesignImport(record: CustomerDesignImport) {
  const data = await requestJson<any>("/api/customer-design-imports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ customerDesignImport: normalizeCustomerDesignImport(record) }),
  });
  return normalizeCustomerDesignImport(data.customerDesignImport ?? data);
}
