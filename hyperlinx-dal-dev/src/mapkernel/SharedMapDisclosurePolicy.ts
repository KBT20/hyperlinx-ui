import { withPrimitiveRenderIdentity, type MapKernelPrimitive } from "./MapLayerManager";

export type SharedMapPresentationContext =
  | "COMMERCIAL_PLANNER"
  | "ENGINEERING_REVIEW"
  | "CUSTOMER_PORTAL"
  | "MARKETPLACE"
  | "CONTROL"
  | "FIELD"
  | "TWIN"
  | "PRISM"
  | "OPERATIONAL_INTELLIGENCE";
export type SharedMapDisclosureLevel = "REGIONAL" | "CORRIDOR" | "SEGMENT" | "LOCAL" | "OBJECT" | "ROUTE_OVERVIEW" | "ENGINEERING_OVERVIEW" | "ENGINEERING_DETAIL" | "CLOSE_ENGINEERING_DETAIL";

export type SharedMapDisclosureMetrics = {
  context: SharedMapPresentationContext;
  level: SharedMapDisclosureLevel;
  zoom: number;
  projectedFeatureCount: number;
  projectedStationCount: number;
  projectedObjectCount: number;
  projectedLabelCount: number;
  visibleFeatureCount: number;
  visibleStationCount: number;
  visibleObjectCount: number;
  visibleLabelCount: number;
};

const FEATURE_LIMITS: Record<SharedMapDisclosureLevel, { stations: number; routineObjects: number; labels: number }> = {
  REGIONAL: { stations: 0, routineObjects: 0, labels: 4 },
  CORRIDOR: { stations: 0, routineObjects: 0, labels: 12 },
  SEGMENT: { stations: 80, routineObjects: 160, labels: 28 },
  LOCAL: { stations: Number.POSITIVE_INFINITY, routineObjects: Number.POSITIVE_INFINITY, labels: 64 },
  OBJECT: { stations: Number.POSITIVE_INFINITY, routineObjects: Number.POSITIVE_INFINITY, labels: 80 },
  ROUTE_OVERVIEW: { stations: 0, routineObjects: 0, labels: 8 },
  ENGINEERING_OVERVIEW: { stations: 12, routineObjects: 24, labels: 12 },
  ENGINEERING_DETAIL: { stations: 80, routineObjects: 160, labels: 28 },
  CLOSE_ENGINEERING_DETAIL: { stations: Number.POSITIVE_INFINITY, routineObjects: Number.POSITIVE_INFINITY, labels: 64 },
};

export function sharedMapDisclosureLevel(zoom: number): SharedMapDisclosureLevel {
  if (zoom <= 8) return "REGIONAL";
  if (zoom <= 10) return "ROUTE_OVERVIEW";
  if (zoom <= 12) return "ENGINEERING_OVERVIEW";
  if (zoom <= 14) return "ENGINEERING_DETAIL";
  return "CLOSE_ENGINEERING_DETAIL";
}

export function sharedMapFeatureLimits(zoom: number) {
  return FEATURE_LIMITS[sharedMapDisclosureLevel(zoom)];
}

function upper(value: unknown) {
  return String(value ?? "").toUpperCase();
}

export function sharedMapFeatureIdentity(value: { id?: string; ref?: { id?: string; objectId?: string; stationId?: string } }) {
  return [value.id, value.ref?.id, value.ref?.objectId, value.ref?.stationId].filter(Boolean).map(String);
}

export function sharedMapFeatureRole(primitive: MapKernelPrimitive): "ROUTE" | "ENDPOINT" | "CONDITION" | "FACILITY" | "STATION" | "ROUTINE_OBJECT" | "CONTEXT" | "LABEL" {
  const label = upper(primitive.label);
  const sourceLayer = upper(primitive.metadata?.sourceLayer);
  const payload = primitive.payload && typeof primitive.payload === "object" ? primitive.payload as Record<string, unknown> : {};
  const type = upper(primitive.metadata?.objectType ?? primitive.metadata?.facilityType ?? payload.objectType);
  if (primitive.kind === "label") return "LABEL";
  if (primitive.ref.kind === "Route" || primitive.metadata?.isRouteAuthority === true || sourceLayer.includes("GOVERNED_ROUTE")) return "ROUTE";
  if (primitive.ref.kind === "Site" && (sourceLayer.includes("ENDPOINT") || ["A", "Z"].includes(upper(primitive.metadata?.role)))) return "ENDPOINT";
  if (primitive.ref.kind === "Constraint" || sourceLayer.includes("CONSTRAINT") || sourceLayer.includes("CONDITION")) return "CONDITION";
  if ([label, sourceLayer, type].some((text) => ["ILA", "REGEN", "POP", "FACILITY", "BUILDING", "CUSTOMER_SITE", "VAULT"].some((token) => text.includes(token)))) return "FACILITY";
  if (primitive.ref.kind === "Station" || primitive.layerId === "station" || sourceLayer.includes("STATION_PROJECTION")) return "STATION";
  if (primitive.ref.kind === "Object" || primitive.ref.kind === "ProductionUnit" || primitive.layerId === "object") return "ROUTINE_OBJECT";
  return "CONTEXT";
}

function stableSample<T>(items: T[], limit: number, key: (item: T) => string) {
  if (!Number.isFinite(limit) || items.length <= limit) return items;
  if (limit <= 0) return [];
  const sorted = [...items].sort((a, b) => key(a).localeCompare(key(b)));
  const selected: T[] = [];
  for (let index = 0; index < limit; index += 1) selected.push(sorted[Math.min(sorted.length - 1, Math.floor((index * sorted.length) / limit))]);
  return selected;
}

function labelPriority(primitive: MapKernelPrimitive) {
  const explicit = Number(primitive.metadata?.labelPriority);
  if (Number.isFinite(explicit)) return explicit;
  const role = upper(primitive.metadata?.disclosureRole);
  if (role === "ENDPOINT") return 100;
  if (role === "CONDITION") return 95;
  if (role === "FACILITY") return 80;
  if (role === "SELECTED") return 110;
  return 20;
}

function labelAllowedAtLevel(primitive: MapKernelPrimitive, level: SharedMapDisclosureLevel, selectedIds: Set<string>) {
  if (sharedMapFeatureIdentity(primitive).some((id) => selectedIds.has(id))) return true;
  const role = upper(primitive.metadata?.disclosureRole);
  if (role === "ENDPOINT" || role === "CONDITION") return true;
  if (level === "REGIONAL") return false;
  if (level === "ROUTE_OVERVIEW") return role === "FACILITY";
  if (level === "ENGINEERING_OVERVIEW") return ["FACILITY", "MAJOR_STATION"].includes(role);
  if (level === "ENGINEERING_DETAIL") return role !== "ROUTINE_STATION" && role !== "ROUTINE_OBJECT";
  return true;
}

export function applySharedMapDisclosure(
  projected: MapKernelPrimitive[],
  options: { context: SharedMapPresentationContext; zoom: number; selectedFeatureIds?: string[] },
) {
  const level = sharedMapDisclosureLevel(options.zoom);
  const limits = FEATURE_LIMITS[level];
  const selectedIds = new Set((options.selectedFeatureIds ?? []).filter(Boolean));
  const selected = projected.filter((primitive) => sharedMapFeatureIdentity(primitive).some((id) => selectedIds.has(id)));
  const selectedLabels: MapKernelPrimitive[] = selected
    .filter((primitive) => primitive.kind !== "label" && primitive.coordinate)
    .map((primitive, index) => withPrimitiveRenderIdentity({
      ...primitive,
      id: `${primitive.id}:selected-label`,
      kind: "label" as const,
      label: String(primitive.ref.objectId ?? primitive.ref.stationId ?? primitive.label ?? "Selected"),
      metadata: { ...primitive.metadata, sourceLayer: "SHARED_MAP_SELECTED_LABELS", renderAuthority: "SHARED_MAP_DISCLOSURE", disclosureRole: "SELECTED", labelPriority: 110, responseProjectionOnly: true },
      ref: { ...primitive.ref, sourceLayer: "SHARED_MAP_SELECTED_LABELS", renderKey: undefined },
      renderIdentity: undefined,
    }, undefined, index));
  const labels = projected.filter((primitive) => primitive.kind === "label" && labelAllowedAtLevel(primitive, level, selectedIds));
  const nonLabels = projected.filter((primitive) => primitive.kind !== "label");
  const always = nonLabels.filter((primitive) => ["ROUTE", "ENDPOINT", "CONDITION"].includes(sharedMapFeatureRole(primitive)));
  const facilities = nonLabels.filter((primitive) => sharedMapFeatureRole(primitive) === "FACILITY" && level !== "REGIONAL");
  const context = nonLabels.filter((primitive) => sharedMapFeatureRole(primitive) === "CONTEXT" && (primitive.kind === "line" || primitive.kind === "polygon") && level !== "REGIONAL");
  const stations = stableSample(nonLabels.filter((primitive) => sharedMapFeatureRole(primitive) === "STATION"), limits.stations, (item) => item.id);
  const objects = stableSample(nonLabels.filter((primitive) => sharedMapFeatureRole(primitive) === "ROUTINE_OBJECT"), limits.routineObjects, (item) => item.id);
  const visibleLabels = [...labels]
    .sort((a, b) => labelPriority(b) - labelPriority(a) || a.id.localeCompare(b.id))
    .slice(0, limits.labels);
  const visible = [...always, ...facilities, ...context, ...stations, ...objects, ...visibleLabels, ...selected, ...selectedLabels];
  const unique = [...new Map(visible.map((primitive) => [primitive.id, primitive])).values()];
  const metrics: SharedMapDisclosureMetrics = {
    context: options.context,
    level,
    zoom: options.zoom,
    projectedFeatureCount: projected.filter((item) => item.kind !== "label").length,
    projectedStationCount: projected.filter((item) => sharedMapFeatureRole(item) === "STATION").length,
    projectedObjectCount: projected.filter((item) => sharedMapFeatureRole(item) === "ROUTINE_OBJECT").length,
    projectedLabelCount: projected.filter((item) => item.kind === "label").length,
    visibleFeatureCount: unique.filter((item) => item.kind !== "label").length,
    visibleStationCount: unique.filter((item) => sharedMapFeatureRole(item) === "STATION").length,
    visibleObjectCount: unique.filter((item) => sharedMapFeatureRole(item) === "ROUTINE_OBJECT").length,
    visibleLabelCount: unique.filter((item) => item.kind === "label").length,
  };
  return { primitives: unique, metrics };
}

export function sharedMapRoutineFeatureVisible(role: "STATION" | "ROUTINE_OBJECT" | "FACILITY" | "CONDITION", zoom: number) {
  const level = sharedMapDisclosureLevel(zoom);
  if (role === "CONDITION") return true;
  if (role === "FACILITY") return level !== "REGIONAL";
  if (role === "STATION") return !["REGIONAL", "ROUTE_OVERVIEW"].includes(level);
  return ["ENGINEERING_OVERVIEW", "ENGINEERING_DETAIL", "CLOSE_ENGINEERING_DETAIL"].includes(level);
}

export function sharedMapRoutineLabelVisible(role: "ENDPOINT" | "CONDITION" | "FACILITY" | "STATION" | "ROUTINE_OBJECT" | "SELECTED", zoom: number) {
  const level = sharedMapDisclosureLevel(zoom);
  if (["ENDPOINT", "CONDITION", "SELECTED"].includes(role)) return true;
  if (role === "FACILITY") return level !== "REGIONAL";
  if (role === "STATION") return ["ENGINEERING_DETAIL", "CLOSE_ENGINEERING_DETAIL"].includes(level);
  return level === "CLOSE_ENGINEERING_DETAIL";
}
