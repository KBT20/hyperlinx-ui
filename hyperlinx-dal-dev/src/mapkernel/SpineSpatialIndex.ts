import type { DALCoordinate } from "../types/dal";
import { withPrimitiveRenderIdentity, type MapKernelPrimitive } from "./MapLayerManager";
import type { MapBounds } from "./MapViewportManager";
import { sharedMapFeatureIdentity, sharedMapFeatureRole } from "./SharedMapDisclosurePolicy";

export type MapResolution = "REGIONAL" | "CORRIDOR" | "SEGMENT" | "LOCAL" | "OBJECT";
export type MapLens = "CUSTOMER" | "PLANNER" | "ENGINEERING" | "MARKETPLACE" | "CONTROL" | "FIELD" | "TWIN" | "PRISM" | "OPERATIONAL" | "DEFAULT";
export type MapLayerRole = "route" | "stations" | "objects" | "facilities" | "conditions" | "context" | "work" | "closures";

export type SpineStationRange = {
  startFeet: number;
  endFeet: number;
};

export type SpineIndexedAttachment = {
  canonicalId: string;
  stationFeet: number;
  primitive: MapKernelPrimitive;
  role: ReturnType<typeof sharedMapFeatureRole>;
};

export type SpineIndex = {
  routeId: string;
  geometryAuthority: string;
  geometryHash?: string;
  routeLength: number;
  stationCount: number;
  coordinates: DALCoordinate[];
  routePrimitive: MapKernelPrimitive | null;
  stationAtDistance: (distanceFeet: number) => SpineIndexedAttachment | null;
  coordinateAtStation: (stationFeet: number) => DALCoordinate | null;
  stationAtCoordinate: (coordinate: DALCoordinate) => { stationFeet: number; coordinate: DALCoordinate; distanceFeet: number } | null;
  stationRangeForViewport: (viewport: MapBounds) => SpineStationRange | null;
  geometryForStationRange: (range: SpineStationRange) => DALCoordinate[];
};

export type SpineAttachmentIndex = {
  all: SpineIndexedAttachment[];
  byCanonicalId: Map<string, SpineIndexedAttachment>;
  between: (range: SpineStationRange, roles?: Set<ReturnType<typeof sharedMapFeatureRole>>) => SpineIndexedAttachment[];
  find: (canonicalId: string) => SpineIndexedAttachment | null;
};

export type MapViewportProjectionTimings = {
  spineResolutionMs: number;
  stationLookupMs: number;
  attachmentLookupMs: number;
  projectionAssemblyMs: number;
  primitiveCreationMs: number;
  totalProjectionMs: number;
};

export type MapLensSummary = {
  mode: "ROUTE" | "VIEWPORT" | "SELECTION";
  lens: MapLens;
  routeId: string;
  geometryAuthority: string;
  routeLengthFeet: number;
  routeStationCount: number;
  routeObjectCount: number;
  routeFacilityCount: number;
  routeConditionCount: number;
  visibleStationRange: SpineStationRange | null;
  visibleLengthFeet: number;
  visibleStationCount: number;
  visibleObjectCount: number;
  visibleFacilityCount: number;
  visibleConditionCount: number;
  selection?: {
    canonicalId: string;
    type: string;
    stationFeet?: number;
    label?: string;
  };
};

export type SpineMapProjection = {
  resolution: MapResolution;
  visibleSpine: DALCoordinate[];
  visibleStationRange: SpineStationRange | null;
  primitives: MapKernelPrimitive[];
  summary: MapLensSummary;
  timings: MapViewportProjectionTimings;
  candidatePrimitiveCount: number;
  renderedPrimitiveCount: number;
  geometryDetail: "SIMPLIFIED" | "CORRIDOR" | "SEGMENT" | "EXACT";
  cacheKey: string;
  cacheHit: boolean;
};

type Segment = { start: DALCoordinate; end: DALCoordinate; startFeet: number; endFeet: number };

const FEET_PER_MILE = 5280;
const EARTH_RADIUS_FEET = 20_902_231;
const projectionCache = new Map<string, SpineMapProjection>();
const MAX_CACHE_ENTRIES = 32;

function now() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function numeric(value: unknown) {
  const result = Number(value);
  return Number.isFinite(result) ? result : undefined;
}

function coordinateValid(value: unknown): value is DALCoordinate {
  return Array.isArray(value) && value.length >= 2 && Number.isFinite(Number(value[0])) && Number.isFinite(Number(value[1]));
}

function distanceFeet(a: DALCoordinate, b: DALCoordinate) {
  const lat1 = (a[1] * Math.PI) / 180;
  const lat2 = (b[1] * Math.PI) / 180;
  const deltaLat = ((b[1] - a[1]) * Math.PI) / 180;
  const deltaLon = ((b[0] - a[0]) * Math.PI) / 180;
  const h = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return 2 * EARTH_RADIUS_FEET * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}

function cumulativeDistances(coordinates: DALCoordinate[]) {
  const values = [0];
  for (let index = 1; index < coordinates.length; index += 1) values.push(values[index - 1] + distanceFeet(coordinates[index - 1], coordinates[index]));
  return values;
}

function routeRank(primitive: MapKernelPrimitive) {
  const source = String(primitive.metadata?.sourceLayer ?? "").toUpperCase();
  const authority = String(primitive.metadata?.renderAuthority ?? "").toUpperCase();
  let rank = primitive.ref.kind === "Route" ? 10 : 0;
  if (source.includes("SPINE") || authority.includes("SPINE")) rank += 100;
  if (primitive.metadata?.isRouteAuthority === true || source.startsWith("ROUTE_AUTHORITY_")) rank += 80;
  if (authority.includes("CERTIFIED")) rank += 40;
  rank += Math.min(20, (primitive.coordinates?.length ?? 0) / 1000);
  return rank;
}

function selectGovernedSpine(primitives: MapKernelPrimitive[]) {
  return primitives
    .filter((primitive) => primitive.kind === "line" && (primitive.coordinates?.length ?? 0) > 1 && sharedMapFeatureRole(primitive) === "ROUTE")
    .sort((a, b) => routeRank(b) - routeRank(a))[0] ?? null;
}

function pointOnSegment(point: DALCoordinate, start: DALCoordinate, end: DALCoordinate) {
  const meanLat = ((point[1] + start[1] + end[1]) / 3) * Math.PI / 180;
  const scaleX = Math.cos(meanLat) * 364_000;
  const scaleY = 364_000;
  const px = (point[0] - start[0]) * scaleX;
  const py = (point[1] - start[1]) * scaleY;
  const ex = (end[0] - start[0]) * scaleX;
  const ey = (end[1] - start[1]) * scaleY;
  const denominator = ex * ex + ey * ey;
  const ratio = denominator > 0 ? Math.max(0, Math.min(1, (px * ex + py * ey) / denominator)) : 0;
  const coordinate: DALCoordinate = [start[0] + (end[0] - start[0]) * ratio, start[1] + (end[1] - start[1]) * ratio];
  return { ratio, coordinate, distanceFeet: distanceFeet(point, coordinate) };
}

function coordinateAtDistance(coordinates: DALCoordinate[], cumulative: number[], requestedFeet: number) {
  if (!coordinates.length) return null;
  const feet = Math.max(0, Math.min(cumulative.at(-1) ?? 0, requestedFeet));
  let low = 0;
  let high = cumulative.length - 1;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (cumulative[mid] < feet) low = mid + 1;
    else high = mid;
  }
  const endIndex = Math.max(1, low);
  const startIndex = endIndex - 1;
  const span = cumulative[endIndex] - cumulative[startIndex];
  const ratio = span > 0 ? (feet - cumulative[startIndex]) / span : 0;
  return [
    coordinates[startIndex][0] + (coordinates[endIndex][0] - coordinates[startIndex][0]) * ratio,
    coordinates[startIndex][1] + (coordinates[endIndex][1] - coordinates[startIndex][1]) * ratio,
  ] as DALCoordinate;
}

function boundsContains(bounds: MapBounds, coordinate: DALCoordinate) {
  return coordinate[0] >= bounds.west && coordinate[0] <= bounds.east && coordinate[1] >= bounds.south && coordinate[1] <= bounds.north;
}

function segmentIntersectsBounds(segment: Segment, bounds: MapBounds) {
  if (boundsContains(bounds, segment.start) || boundsContains(bounds, segment.end)) return true;
  const minX = Math.min(segment.start[0], segment.end[0]);
  const maxX = Math.max(segment.start[0], segment.end[0]);
  const minY = Math.min(segment.start[1], segment.end[1]);
  const maxY = Math.max(segment.start[1], segment.end[1]);
  return !(maxX < bounds.west || minX > bounds.east || maxY < bounds.south || minY > bounds.north);
}

function primitiveCoordinate(primitive: MapKernelPrimitive) {
  if (coordinateValid(primitive.coordinate)) return primitive.coordinate;
  if (primitive.coordinates?.length && coordinateValid(primitive.coordinates[Math.floor(primitive.coordinates.length / 2)])) return primitive.coordinates[Math.floor(primitive.coordinates.length / 2)];
  return null;
}

function canonicalId(primitive: MapKernelPrimitive) {
  return String(primitive.ref.objectId ?? primitive.ref.stationId ?? primitive.ref.id ?? primitive.id);
}

function explicitStationFeet(primitive: MapKernelPrimitive) {
  const payload = primitive.payload && typeof primitive.payload === "object" ? primitive.payload as Record<string, unknown> : {};
  return numeric(primitive.metadata?.stationFeet) ?? numeric(primitive.metadata?.measureFeet) ?? numeric(payload.stationFeet) ?? numeric(payload.measureFeet);
}

function boundedStationFeet(explicit: number | undefined, projected: number | undefined, routeLength: number) {
  // Some older certified local records persisted mile-number values in a
  // field named stationFeet (0, 5,280, 10,560 ... for successive 100-foot
  // stations). The coordinate remains governed. Treat out-of-route measures
  // as legacy display metadata and resolve the read index from the spine.
  if (Number.isFinite(explicit) && explicit! >= 0 && explicit! <= routeLength * 1.01) return explicit!;
  return projected ?? explicit;
}

export function mapResolutionForZoom(zoom: number, hasObjectSelection = false): MapResolution {
  if (hasObjectSelection && zoom >= 17) return "OBJECT";
  if (zoom <= 8) return "REGIONAL";
  if (zoom <= 11) return "CORRIDOR";
  if (zoom <= 14) return "SEGMENT";
  if (zoom <= 17) return "LOCAL";
  return "OBJECT";
}

export function formatStation(stationFeet: number | undefined) {
  if (!Number.isFinite(stationFeet)) return "—";
  const feet = Math.max(0, Math.round(stationFeet!));
  return `${Math.floor(feet / 100)}+${String(feet % 100).padStart(2, "0")}`;
}

export function buildSpineIndex(primitives: MapKernelPrimitive[]): SpineIndex {
  const routePrimitive = selectGovernedSpine(primitives);
  const coordinates = (routePrimitive?.coordinates ?? []).filter(coordinateValid);
  const cumulative = cumulativeDistances(coordinates);
  const routeLength = cumulative.at(-1) ?? 0;
  const segments: Segment[] = coordinates.slice(1).map((end, index) => ({ start: coordinates[index], end, startFeet: cumulative[index], endFeet: cumulative[index + 1] }));
  const stationAtCoordinate = (coordinate: DALCoordinate): { stationFeet: number; coordinate: DALCoordinate; distanceFeet: number } | null => {
    let closest: { stationFeet: number; coordinate: DALCoordinate; distanceFeet: number } | null = null;
    segments.forEach((segment) => {
      const candidate = pointOnSegment(coordinate, segment.start, segment.end);
      if (!closest || candidate.distanceFeet < closest.distanceFeet) {
        closest = { stationFeet: segment.startFeet + (segment.endFeet - segment.startFeet) * candidate.ratio, coordinate: candidate.coordinate, distanceFeet: candidate.distanceFeet };
      }
    });
    return closest;
  };
  const stations = primitives
    .filter((primitive) => sharedMapFeatureRole(primitive) === "STATION" && primitive.kind !== "label")
    .map((primitive) => {
      const coordinate = primitiveCoordinate(primitive);
      const projected = coordinate ? stationAtCoordinate(coordinate) : null;
      return { canonicalId: canonicalId(primitive), stationFeet: boundedStationFeet(explicitStationFeet(primitive), projected?.stationFeet, routeLength) ?? 0, primitive, role: sharedMapFeatureRole(primitive) };
    })
    .sort((a, b) => a.stationFeet - b.stationFeet);
  const geometryAuthority = String(routePrimitive?.metadata?.renderAuthority ?? routePrimitive?.metadata?.sourceLayer ?? "NO_GOVERNED_SPINE");
  return {
    routeId: String(routePrimitive?.ref.routeId ?? routePrimitive?.ref.id ?? routePrimitive?.id ?? "NO_ROUTE"),
    geometryAuthority,
    geometryHash: typeof routePrimitive?.metadata?.geometryHash === "string" ? routePrimitive.metadata.geometryHash : undefined,
    routeLength,
    stationCount: new Set(stations.map((station) => station.canonicalId)).size,
    coordinates,
    routePrimitive,
    stationAtDistance: (requestedFeet) => {
      if (!stations.length) return null;
      let low = 0;
      let high = stations.length - 1;
      while (low < high) {
        const mid = Math.floor((low + high) / 2);
        if (stations[mid].stationFeet < requestedFeet) low = mid + 1;
        else high = mid;
      }
      const before = stations[Math.max(0, low - 1)];
      const after = stations[low];
      return Math.abs(before.stationFeet - requestedFeet) <= Math.abs(after.stationFeet - requestedFeet) ? before : after;
    },
    coordinateAtStation: (stationFeet) => coordinateAtDistance(coordinates, cumulative, stationFeet),
    stationAtCoordinate,
    stationRangeForViewport: (viewport) => {
      const matches = segments.filter((segment) => segmentIntersectsBounds(segment, viewport));
      if (!matches.length) return null;
      return { startFeet: Math.max(0, Math.min(...matches.map((segment) => segment.startFeet))), endFeet: Math.min(routeLength, Math.max(...matches.map((segment) => segment.endFeet))) };
    },
    geometryForStationRange: (range) => {
      if (!coordinates.length) return [];
      const start = Math.max(0, Math.min(routeLength, range.startFeet));
      const end = Math.max(start, Math.min(routeLength, range.endFeet));
      const result: DALCoordinate[] = [];
      const first = coordinateAtDistance(coordinates, cumulative, start);
      const last = coordinateAtDistance(coordinates, cumulative, end);
      if (first) result.push(first);
      coordinates.forEach((coordinate, index) => { if (cumulative[index] > start && cumulative[index] < end) result.push(coordinate); });
      if (last) result.push(last);
      return result;
    },
  };
}

export function buildSpineAttachmentIndex(primitives: MapKernelPrimitive[], spine: SpineIndex): SpineAttachmentIndex {
  const indexed = primitives
    .filter((primitive) => primitive !== spine.routePrimitive && primitive.kind !== "label")
    .map((primitive): SpineIndexedAttachment | null => {
      const coordinate = primitiveCoordinate(primitive);
      const projected = coordinate ? spine.stationAtCoordinate(coordinate) : null;
      const stationFeet = boundedStationFeet(explicitStationFeet(primitive), projected?.stationFeet, spine.routeLength);
      if (!Number.isFinite(stationFeet)) return null;
      return { canonicalId: canonicalId(primitive), stationFeet: stationFeet!, primitive, role: sharedMapFeatureRole(primitive) };
    })
    .filter((item): item is SpineIndexedAttachment => Boolean(item))
    .sort((a, b) => a.stationFeet - b.stationFeet || a.canonicalId.localeCompare(b.canonicalId));
  const byCanonicalId = new Map<string, SpineIndexedAttachment>();
  indexed.forEach((item) => { if (!byCanonicalId.has(item.canonicalId)) byCanonicalId.set(item.canonicalId, item); });
  return {
    all: indexed,
    byCanonicalId,
    between: (range, roles) => indexed.filter((item) => item.stationFeet >= range.startFeet && item.stationFeet <= range.endFeet && (!roles || roles.has(item.role))),
    find: (id) => byCanonicalId.get(id) ?? indexed.find((item) => sharedMapFeatureIdentity(item.primitive).includes(id)) ?? null,
  };
}

function geometryStride(resolution: MapResolution, count: number) {
  const target = resolution === "REGIONAL" ? 180 : resolution === "CORRIDOR" ? 420 : resolution === "SEGMENT" ? 900 : Number.POSITIVE_INFINITY;
  return Number.isFinite(target) ? Math.max(1, Math.ceil(count / target)) : 1;
}

function simplifyGeometry(coordinates: DALCoordinate[], resolution: MapResolution) {
  const stride = geometryStride(resolution, coordinates.length);
  if (stride <= 1 || coordinates.length <= 2) return coordinates;
  const simplified = coordinates.filter((_, index) => index === 0 || index === coordinates.length - 1 || index % stride === 0);
  if (simplified.at(-1) !== coordinates.at(-1)) simplified.push(coordinates.at(-1)!);
  return simplified;
}

function rolesForResolution(resolution: MapResolution): Set<ReturnType<typeof sharedMapFeatureRole>> {
  if (resolution === "REGIONAL") return new Set(["ENDPOINT", "CONDITION"]);
  if (resolution === "CORRIDOR") return new Set(["ENDPOINT", "CONDITION", "FACILITY"]);
  if (resolution === "SEGMENT") return new Set(["ENDPOINT", "CONDITION", "FACILITY", "STATION", "ROUTINE_OBJECT"]);
  return new Set(["ENDPOINT", "CONDITION", "FACILITY", "STATION", "ROUTINE_OBJECT", "CONTEXT"]);
}

function geometryDetailForResolution(resolution: MapResolution): SpineMapProjection["geometryDetail"] {
  if (resolution === "REGIONAL") return "SIMPLIFIED";
  if (resolution === "CORRIDOR") return "CORRIDOR";
  if (resolution === "SEGMENT") return "SEGMENT";
  return "EXACT";
}

function layerRoleForPrimitive(primitive: MapKernelPrimitive): MapLayerRole {
  const role = sharedMapFeatureRole(primitive);
  const source = String(primitive.metadata?.sourceLayer ?? "").toUpperCase();
  if (role === "ROUTE") return "route";
  if (role === "STATION") return "stations";
  if (role === "ROUTINE_OBJECT") return "objects";
  if (role === "FACILITY") return "facilities";
  if (role === "CONDITION") return "conditions";
  if (source.includes("CLOSURE")) return "closures";
  if (source.includes("WORK") || source.includes("ALLOCAT") || source.includes("BID_PACKAGE")) return "work";
  return "context";
}

export function layerAvailableAtResolution(role: MapLayerRole, resolution: MapResolution) {
  if (role === "stations") return ["SEGMENT", "LOCAL", "OBJECT"].includes(resolution);
  if (role === "objects") return ["SEGMENT", "LOCAL", "OBJECT"].includes(resolution);
  if (["work", "closures"].includes(role)) return resolution !== "REGIONAL";
  return true;
}

function lensAllows(lens: MapLens, primitive: MapKernelPrimitive) {
  if (lens !== "CUSTOMER") return true;
  const metadata = primitive.metadata ?? {};
  const source = String(metadata.sourceLayer ?? "").toUpperCase();
  if (metadata.customerVisible === false || metadata.internalOnly === true) return false;
  return !["VENDOR", "MARGIN", "PRICING", "REASONING", "DIAGNOSTIC", "FAILURE"].some((token) => source.includes(token));
}

function makeCacheKey(spine: SpineIndex, viewport: MapBounds, resolution: MapResolution, lens: MapLens, selectedIds: string[], enabledLayers: Set<MapLayerRole>, revision: string) {
  const rounded = [viewport.west, viewport.south, viewport.east, viewport.north].map((value) => value.toFixed(4)).join(":");
  return [spine.routeId, spine.geometryHash ?? spine.geometryAuthority, rounded, resolution, lens, revision, [...enabledLayers].sort().join(","), [...selectedIds].sort().join(",")].join("|");
}

function labelsForVisible(primitives: MapKernelPrimitive[], visibleIds: Set<string>, resolution: MapResolution) {
  if (resolution === "REGIONAL") return primitives.filter((primitive) => primitive.kind === "label" && ["ENDPOINT", "CONDITION"].includes(String(primitive.metadata?.disclosureRole ?? "")));
  const limit = resolution === "CORRIDOR" ? 12 : resolution === "SEGMENT" ? 28 : 80;
  return primitives.filter((primitive) => primitive.kind === "label" && sharedMapFeatureIdentity(primitive).some((id) => visibleIds.has(id))).slice(0, limit);
}

export function resolveSpineMapProjection(input: {
  primitives: MapKernelPrimitive[];
  spine: SpineIndex;
  attachments: SpineAttachmentIndex;
  viewport: MapBounds;
  zoom: number;
  lens: MapLens;
  selectedIds?: string[];
  enabledLayers: Set<MapLayerRole>;
  governedRevision?: string;
  selection?: { canonicalId: string; type: string; stationFeet?: number; label?: string };
}): SpineMapProjection {
  const started = now();
  const selectedIds = (input.selectedIds ?? []).filter(Boolean);
  const resolution = mapResolutionForZoom(input.zoom, selectedIds.length > 0);
  const cacheKey = makeCacheKey(input.spine, input.viewport, resolution, input.lens, selectedIds, input.enabledLayers, input.governedRevision ?? "CURRENT");
  const cached = projectionCache.get(cacheKey);
  if (cached) return { ...cached, cacheHit: true };
  const spineResolvedAt = now();
  const viewportRange = input.spine.stationRangeForViewport(input.viewport);
  const stationLookupAt = now();
  const fullRange = { startFeet: 0, endFeet: input.spine.routeLength };
  const range = resolution === "REGIONAL" ? fullRange : viewportRange;
  const permittedRoles = rolesForResolution(resolution);
  const visibleAttachments = range ? input.attachments.between(range, permittedRoles) : [];
  const attachmentLookupAt = now();
  const selected = selectedIds.map((id) => input.attachments.find(id)).filter((item): item is SpineIndexedAttachment => Boolean(item));
  const majorRegional = resolution === "REGIONAL"
    ? input.attachments.all.filter((item) => item.role === "ENDPOINT" || item.role === "CONDITION" || item.role === "FACILITY")
    : [];
  const attachmentPrimitives = [...visibleAttachments, ...selected, ...majorRegional]
    .filter((item) => lensAllows(input.lens, item.primitive))
    .filter((item) => input.enabledLayers.has(layerRoleForPrimitive(item.primitive)) && layerAvailableAtResolution(layerRoleForPrimitive(item.primitive), resolution))
    .map((item) => item.primitive);
  const visibleIds = new Set(attachmentPrimitives.flatMap(sharedMapFeatureIdentity));
  const labels = labelsForVisible(input.primitives, visibleIds, resolution).filter((primitive) => lensAllows(input.lens, primitive));
  const projectionAssemblyAt = now();
  const visibleSpineExact = range ? input.spine.geometryForStationRange(range) : [];
  const visibleSpine = simplifyGeometry(visibleSpineExact, resolution);
  const route = input.spine.routePrimitive && input.enabledLayers.has("route") && visibleSpine.length > 1
    ? withPrimitiveRenderIdentity({
        ...input.spine.routePrimitive,
        id: `${input.spine.routePrimitive.id}:viewport:${resolution}`,
        coordinates: visibleSpine,
        renderIdentity: undefined,
        ref: { ...input.spine.routePrimitive.ref, renderKey: undefined },
        metadata: { ...input.spine.routePrimitive.metadata, responseProjectionOnly: true, sourceGeometryHash: input.spine.geometryHash, geometryDetail: resolution },
      })
    : null;
  const unique = [...new Map([...(route ? [route] : []), ...attachmentPrimitives, ...labels].map((primitive) => [primitive.id, primitive])).values()];
  const primitiveCreationAt = now();
  const count = (role: ReturnType<typeof sharedMapFeatureRole>, source = input.attachments.all) => new Set(source.filter((item) => item.role === role && (role !== "ROUTINE_OBJECT" || item.primitive.ref.kind === "Object")).map((item) => item.canonicalId)).size;
  // A facility remains a governed object while also being summarized by its
  // more useful map role. Canonical identity avoids inflating alias records.
  const objectCount = (source = input.attachments.all) => new Set(source.filter((item) => item.primitive.ref.kind === "Object").map((item) => item.canonicalId)).size;
  const visibleIndexed = [...visibleAttachments, ...selected, ...majorRegional];
  const selectedAttachment = selected[0];
  const selectedSummary = selectedAttachment
    ? { canonicalId: selectedAttachment.canonicalId, type: selectedAttachment.role, stationFeet: selectedAttachment.stationFeet, label: selectedAttachment.primitive.label }
    : input.selection;
  const summary: MapLensSummary = {
    mode: selectedSummary ? "SELECTION" : resolution === "REGIONAL" ? "ROUTE" : "VIEWPORT",
    lens: input.lens,
    routeId: input.spine.routeId,
    geometryAuthority: input.spine.geometryAuthority,
    routeLengthFeet: input.spine.routeLength,
    routeStationCount: input.spine.stationCount,
    routeObjectCount: objectCount(),
    routeFacilityCount: count("FACILITY"),
    routeConditionCount: count("CONDITION"),
    visibleStationRange: range,
    visibleLengthFeet: range ? Math.max(0, range.endFeet - range.startFeet) : 0,
    visibleStationCount: count("STATION", visibleIndexed),
    visibleObjectCount: objectCount(visibleIndexed),
    visibleFacilityCount: count("FACILITY", visibleIndexed),
    visibleConditionCount: count("CONDITION", visibleIndexed),
    selection: selectedSummary,
  };
  const finished = now();
  const result: SpineMapProjection = {
    resolution,
    visibleSpine,
    visibleStationRange: range,
    primitives: unique,
    summary,
    timings: {
      spineResolutionMs: spineResolvedAt - started,
      stationLookupMs: stationLookupAt - spineResolvedAt,
      attachmentLookupMs: attachmentLookupAt - stationLookupAt,
      projectionAssemblyMs: projectionAssemblyAt - attachmentLookupAt,
      primitiveCreationMs: primitiveCreationAt - projectionAssemblyAt,
      totalProjectionMs: finished - started,
    },
    candidatePrimitiveCount: visibleAttachments.length,
    renderedPrimitiveCount: unique.length,
    geometryDetail: geometryDetailForResolution(resolution),
    cacheKey,
    cacheHit: false,
  };
  projectionCache.set(cacheKey, result);
  while (projectionCache.size > MAX_CACHE_ENTRIES) projectionCache.delete(projectionCache.keys().next().value!);
  return result;
}

export function parseStationInput(value: string) {
  const normalized = value.trim().replaceAll(",", "");
  const match = normalized.match(/^(\d+)\s*\+\s*(\d{1,2})$/);
  if (match) return Number(match[1]) * 100 + Number(match[2]);
  const numericValue = Number(normalized);
  return Number.isFinite(numericValue) && numericValue >= 0 ? numericValue : null;
}

export function stationRangeBounds(spine: SpineIndex, range: SpineStationRange) {
  const geometry = spine.geometryForStationRange(range);
  if (!geometry.length) return null;
  return geometry.reduce<MapBounds>((bounds, coordinate) => ({
    west: Math.min(bounds.west, coordinate[0]), south: Math.min(bounds.south, coordinate[1]), east: Math.max(bounds.east, coordinate[0]), north: Math.max(bounds.north, coordinate[1]),
  }), { west: geometry[0][0], south: geometry[0][1], east: geometry[0][0], north: geometry[0][1] });
}

export function routeMiles(spine: SpineIndex) {
  return spine.routeLength / FEET_PER_MILE;
}
