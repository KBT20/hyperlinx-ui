import { haversineFeet } from "../affinity/geo";
import type { AttachmentAuthorityResult } from "../attachment/AttachmentAuthorityEngine";
import type { MapKernelPrimitive, MapKernelRenderSpec } from "../mapkernel";
import {
  calculateConstraintCompleteness,
  constraintFeaturesToReferenceLayers,
  DEFAULT_ROUTE_CERTIFICATION_REQUIRED_LAYERS,
  type ConstraintGeometryFeature,
  type ConstraintReferenceLayer,
  type ConstraintReferenceLayerType,
  type ConstraintRegistrySnapshot,
} from "../reference/ConstraintGeometryRegistry";
import type { GeographicReferenceFeature, GeographicReferenceLayer } from "../reference/ReferenceLayerManager";
import type { StreetCenterline } from "../street/streetTypes";
import type { DALCoordinate } from "../types/dal";

export type ConstraintType =
  | "BUILDING_CONFLICT"
  | "PARCEL_CROSSING"
  | "RAILROAD_CROSSING"
  | "WATER_CROSSING"
  | "ROAD_CROSSING"
  | "TERRAIN_FLAG"
  | "UNKNOWN_CONSTRAINT";

export type ConstraintSeverity = "LOW" | "MEDIUM" | "HIGH" | "BLOCKING";
export type RecommendedConstraintAction = "REVIEW" | "REROUTE" | "PERMIT_REQUIRED" | "FIELD_VERIFY" | "NO_ACTION";
export type CertificationReadiness = "READY" | "REVIEW_REQUIRED" | "BLOCKED" | "UNKNOWN";
export type RouteGeometrySource = "SERVICEABILITY_PROPOSED" | "ENGINEER_EDITED" | "CERTIFIED_ROUTE" | "CHILD_SCOPEVERSION";
export type ConstraintAnalysisMode = "REFERENCE_LAYER_ASSISTED" | "CONSTRAINT_AWARE_DOGLEG" | "ENGINEER_EDITED" | "CERTIFIED_SNAPSHOT" | "CHILD_SCOPEVERSION";
export type ConstraintLayerKey = "streets" | "parcels" | "buildings" | "railroads" | "water" | "terrain";
export type ConstraintAnalysisMethod = "GEOMETRY_INTERSECTION" | "REFERENCE_ESTIMATE" | "FALLBACK" | "UNKNOWN";

export type ReferenceLayerSet = {
  streets?: StreetCenterline[];
  buildings?: GeographicReferenceFeature[];
  parcels?: GeographicReferenceFeature[];
  railroads?: GeographicReferenceFeature[];
  water?: GeographicReferenceFeature[];
  terrain?: GeographicReferenceFeature[];
  layers?: GeographicReferenceLayer[];
  constraintRegistrySnapshot?: ConstraintRegistrySnapshot;
  constraintRegistryFeatures?: ConstraintGeometryFeature[];
};

export type RouteConstraint = {
  constraintId: string;
  constraintType: ConstraintType;
  severity: ConstraintSeverity;
  geometry: DALCoordinate[] | { lat: number; lon: number };
  description: string;
  recommendedAction: RecommendedConstraintAction;
  sourceLayer?: string;
  sourceObjectId?: string;
  intersectionCoordinates?: Array<{ lat: number; lon: number }>;
  analysisMethod?: ConstraintAnalysisMethod;
};

export type ConstraintSummary = {
  buildingConflicts: number;
  parcelCrossings: number;
  railroadCrossings: number;
  waterCrossings: number;
  roadCrossings: number;
  terrainFlags: number;
};

export type ConstraintProvenance = {
  evidenceId: string;
  routeGeometryHash: string;
  referenceLayersLoaded: Record<ConstraintLayerKey, boolean>;
  featureCounts: {
    streetFeatures: number;
    parcelFeatures: number;
    buildingFeatures: number;
    railroadFeatures: number;
    waterFeatures: number;
    terrainFeatures: number;
  };
  dataSources: Partial<Record<ConstraintLayerKey, string>>;
  fallbackMode: boolean;
  fallbackReasons: string[];
};

export type WaterCrossingAudit = {
  waterLayerLoaded: boolean;
  waterFeatureCount: number;
  waterIntersectionsFound: number;
  intersectionCoordinates: Array<{ lat: number; lon: number }>;
  analysisMethod: ConstraintAnalysisMethod;
};

export type ConstraintLayerDiagnostic = {
  constraintClass: ConstraintLayerKey;
  layerLoaded: boolean;
  featureCount: number;
  authority: string;
  certificationUse: string;
  coverage?: ConstraintReferenceLayer["coverage"];
  intersectionCount: number;
};

export type ConstraintEvidencePackage = {
  evidenceId: string;
  routeGeometryHash: string;
  routeGeometrySource: RouteGeometrySource;
  sourceScopeVersionId: string;
  candidateSiteId?: string;
  routeCertificationId?: string;
  generatedAt: string;
  generatedBy: "ConstraintAnalysisEngine";
  summary: ConstraintSummary;
  constraints: RouteConstraint[];
  constructabilityScore: number;
  certificationReadiness: CertificationReadiness;
  diagnostics: {
    referenceLayersUsed: string[];
    analysisMode: ConstraintAnalysisMode;
    notes: string[];
    constraintLayerDiagnostics: ConstraintLayerDiagnostic[];
  };
  provenance: ConstraintProvenance;
  constraintRegistrySnapshot: ConstraintRegistrySnapshot;
  waterCrossingAudit: WaterCrossingAudit;
  unknownCounts: Partial<Record<keyof ConstraintSummary, boolean>>;
};

export type ConstraintAnalysisResult = ConstraintEvidencePackage & {
  constraintSummary: ConstraintSummary;
  unresolvedConstraints: string[];
  recommendedActions: RecommendedConstraintAction[];
  supersedesEvidenceId?: string;
};

export type ConstraintAnalysisInput = {
  parentScopeVersionId: string;
  candidateSiteId: string;
  attachmentAuthority: AttachmentAuthorityResult;
  candidateCoordinate: { lat: number; lon: number };
  proposedGeometry: DALCoordinate[];
  referenceLayers: ReferenceLayerSet;
  routeGeometrySource?: RouteGeometrySource;
  analysisMode?: ConstraintAnalysisMode;
  routeCertificationId?: string;
  supersedesEvidenceId?: string;
};

const EMPTY_SUMMARY: ConstraintSummary = {
  buildingConflicts: 0,
  parcelCrossings: 0,
  railroadCrossings: 0,
  waterCrossings: 0,
  roadCrossings: 0,
  terrainFlags: 0,
};

type NormalizedFeature = {
  id: string;
  layerId: string;
  label: string;
  dataSource?: string;
  coordinate?: DALCoordinate;
  coordinates?: DALCoordinate[];
  rings?: DALCoordinate[][];
};

function pointGeometry(value: { lat: number; lon: number }) {
  return { lat: value.lat, lon: value.lon };
}

function nowIso() {
  return new Date().toISOString();
}

function normalizedGeometryKey(geometry: DALCoordinate[]) {
  return geometry
    .filter((coordinate) => Array.isArray(coordinate) && Number.isFinite(coordinate[0]) && Number.isFinite(coordinate[1]))
    .map((coordinate) => `${Number(coordinate[0]).toFixed(7)},${Number(coordinate[1]).toFixed(7)}`)
    .join("|");
}

export function hashRouteGeometry(geometry: DALCoordinate[]) {
  const source = normalizedGeometryKey(geometry);
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `rg-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function evidenceIdFor(args: { candidateSiteId: string; routeGeometryHash: string; routeGeometrySource?: RouteGeometrySource }) {
  const source = args.routeGeometrySource ?? "SERVICEABILITY_PROPOSED";
  return `ce-${args.candidateSiteId}-${source.toLowerCase()}-${args.routeGeometryHash}`;
}

const REGISTRY_LAYER_BY_KEY: Record<ConstraintLayerKey, ConstraintReferenceLayerType> = {
  streets: "STREETS",
  parcels: "PARCELS",
  buildings: "BUILDINGS",
  railroads: "RAILROADS",
  water: "WATER",
  terrain: "TERRAIN",
};

function referenceLayerIdForKey(key: ConstraintLayerKey) {
  if (key === "streets") return "streetReference";
  if (key === "buildings") return "buildingReference";
  if (key === "parcels") return "parcelReference";
  if (key === "railroads") return "railroadReference";
  if (key === "water") return "waterReference";
  return "terrainReference";
}

function registryLayerForKey(snapshot: ConstraintRegistrySnapshot | undefined, key: ConstraintLayerKey) {
  const layerType = REGISTRY_LAYER_BY_KEY[key];
  return snapshot?.layers.find((layer) => layer.layerType === layerType);
}

function referenceLayerProvided(input: ReferenceLayerSet, key: ConstraintLayerKey) {
  if (key === "streets") return input.streets !== undefined || input.layers?.some((layer) => layer.layerId === "streetReference") || false;
  if (key === "buildings") return input.buildings !== undefined || input.layers?.some((layer) => layer.layerId === "buildingReference") || false;
  if (key === "parcels") return input.parcels !== undefined || input.layers?.some((layer) => layer.layerId === "parcelReference") || false;
  if (key === "railroads") return input.railroads !== undefined || input.layers?.some((layer) => layer.layerId === "railroadReference") || false;
  if (key === "water") return input.water !== undefined || input.layers?.some((layer) => layer.layerId === "waterReference") || false;
  return input.terrain !== undefined || input.layers?.some((layer) => layer.layerId === "terrainReference") || false;
}

function featureCountForKey(features: ReturnType<typeof referenceFeatures>, key: ConstraintLayerKey) {
  if (key === "streets") return features.streets.length;
  if (key === "buildings") return features.buildings.length;
  if (key === "parcels") return features.parcels.length;
  if (key === "railroads") return features.railroads.length;
  if (key === "water") return features.water.length;
  return features.terrain.length;
}

function adHocLayerForKey(input: ReferenceLayerSet, features: ReturnType<typeof referenceFeatures>, key: ConstraintLayerKey): ConstraintReferenceLayer {
  const featureCount = featureCountForKey(features, key);
  const layerId = `ad-hoc-${REGISTRY_LAYER_BY_KEY[key].toLowerCase()}`;
  const sourceName = sourceForLayer(input, referenceLayerIdForKey(key), featureCount ? `${key} reference layer` : undefined);
  return {
    layerId,
    layerType: REGISTRY_LAYER_BY_KEY[key],
    status: featureCount > 0 ? "LOADED" : referenceLayerProvided(input, key) ? "LOADED" : "NOT_LOADED",
    certificationUse: featureCount > 0 ? "REFERENCE_ONLY" : "NOT_USABLE",
    authority: "UNKNOWN",
    sourceName: sourceName ?? `${REGISTRY_LAYER_BY_KEY[key]} not loaded`,
    featureCount,
    loadedAt: featureCount > 0 ? nowIso() : undefined,
    lastUpdated: nowIso(),
    notes: featureCount > 0 ? "Ad hoc reference layer supplied outside Constraint Geometry Registry." : "No registry layer or ad hoc reference geometry supplied.",
  };
}

function snapshotForReferenceLayers(input: ReferenceLayerSet, features: ReturnType<typeof referenceFeatures>): ConstraintRegistrySnapshot {
  if (input.constraintRegistrySnapshot) {
    const adHocLayers = (Object.keys(REGISTRY_LAYER_BY_KEY) as ConstraintLayerKey[])
      .filter((key) => !registryLayerForKey(input.constraintRegistrySnapshot, key) && featureCountForKey(features, key) > 0)
      .map((key) => adHocLayerForKey(input, features, key));
    const layers = [...input.constraintRegistrySnapshot.layers, ...adHocLayers];
    return {
      layers,
      completeness: calculateConstraintCompleteness(layers, DEFAULT_ROUTE_CERTIFICATION_REQUIRED_LAYERS),
    };
  }
  const layers = (Object.keys(REGISTRY_LAYER_BY_KEY) as ConstraintLayerKey[]).map((key) => adHocLayerForKey(input, features, key));
  return {
    layers,
    completeness: calculateConstraintCompleteness(layers, DEFAULT_ROUTE_CERTIFICATION_REQUIRED_LAYERS),
  };
}

function referenceLayersUsed(input: ReferenceLayerSet) {
  const used = new Set<string>();
  if (input.streets?.length) used.add("streets");
  if (input.buildings?.length) used.add("buildings");
  if (input.parcels?.length) used.add("parcels");
  if (input.railroads?.length) used.add("railroads");
  if (input.water?.length) used.add("water");
  if (input.terrain?.length) used.add("terrain");
  input.layers?.forEach((layer) => {
    if (layer.features.length) used.add(layer.layerId);
  });
  input.constraintRegistrySnapshot?.layers.forEach((layer) => {
    if (layer.status === "LOADED" && layer.featureCount > 0) used.add(layer.layerType);
  });
  return Array.from(used).sort();
}

function layerProvided(input: ReferenceLayerSet, key: ConstraintLayerKey) {
  return Boolean(registryLayerForKey(input.constraintRegistrySnapshot, key) || referenceLayerProvided(input, key));
}

function sourceForLayer(input: ReferenceLayerSet, layerId: string, fallback?: string) {
  const layer = input.layers?.find((item) => item.layerId === layerId);
  return layer?.label ?? layer?.sourceId ?? fallback;
}

function provenanceFor(args: {
  input: ReferenceLayerSet;
  features: ReturnType<typeof referenceFeatures>;
  registrySnapshot: ConstraintRegistrySnapshot;
  evidenceId: string;
  routeGeometryHash: string;
  routeInvalid: boolean;
}) {
  const loadedForKey = (key: ConstraintLayerKey) => {
    const registryLayer = registryLayerForKey(args.registrySnapshot, key);
    if (registryLayer) return registryLayer.status === "LOADED" && registryLayer.featureCount > 0;
    return layerProvided(args.input, key) && featureCountForKey(args.features, key) > 0;
  };
  const sourceForKey = (key: ConstraintLayerKey, fallbackLayerId: string, fallback?: string) => {
    const registryLayer = registryLayerForKey(args.registrySnapshot, key);
    return registryLayer?.sourceName ?? sourceForLayer(args.input, fallbackLayerId, fallback);
  };
  const referenceLayersLoaded: Record<ConstraintLayerKey, boolean> = {
    streets: loadedForKey("streets"),
    parcels: loadedForKey("parcels"),
    buildings: loadedForKey("buildings"),
    railroads: loadedForKey("railroads"),
    water: loadedForKey("water"),
    terrain: loadedForKey("terrain"),
  };
  const featureCounts = {
    streetFeatures: featureCountForKey(args.features, "streets"),
    parcelFeatures: featureCountForKey(args.features, "parcels"),
    buildingFeatures: featureCountForKey(args.features, "buildings"),
    railroadFeatures: featureCountForKey(args.features, "railroads"),
    waterFeatures: featureCountForKey(args.features, "water"),
    terrainFeatures: featureCountForKey(args.features, "terrain"),
  };
  const dataSources = {
    streets: sourceForKey("streets", "streetReference", args.input.streets?.length ? "streetCenterlines" : undefined),
    parcels: sourceForKey("parcels", "parcelReference", args.input.parcels?.length ? "parcelReferences" : undefined),
    buildings: sourceForKey("buildings", "buildingReference", args.input.buildings?.length ? "buildingReferences" : undefined),
    railroads: sourceForKey("railroads", "railroadReference", args.input.railroads?.length ? "railroadReferences" : undefined),
    water: sourceForKey("water", "waterReference", args.input.water?.length ? "waterReferences" : undefined),
    terrain: sourceForKey("terrain", "terrainReference", args.input.terrain?.length ? "terrainReferences" : undefined),
  };
  const fallbackReasons = Object.entries(referenceLayersLoaded)
    .filter(([, loaded]) => !loaded)
    .map(([layer]) => `${layer} reference geometry unavailable; ${layer} constraint count is UNKNOWN.`);
  if (args.routeInvalid) fallbackReasons.unshift("Route geometry has fewer than two valid vertices.");
  const noReferenceGeometry = Object.values(featureCounts).every((count) => count === 0);
  if (noReferenceGeometry) fallbackReasons.unshift("No authoritative geographic reference geometry was loaded.");
  return {
    evidenceId: args.evidenceId,
    routeGeometryHash: args.routeGeometryHash,
    referenceLayersLoaded,
    featureCounts,
    dataSources,
    fallbackMode: args.routeInvalid || noReferenceGeometry,
    fallbackReasons,
  } satisfies ConstraintProvenance;
}

function featureLabel(feature: GeographicReferenceFeature) {
  return feature.label ?? feature.referenceId;
}

function normalizedFeatures(input: ReferenceLayerSet, layerId: string): NormalizedFeature[] {
  const layerFeatures = input.layers?.filter((layer) => layer.layerId === layerId).flatMap((layer) => layer.features) ?? [];
  return layerFeatures.map((feature) => ({
    id: feature.referenceId,
    layerId: feature.layerId,
    label: featureLabel(feature),
    dataSource: sourceForLayer(input, layerId),
    coordinate: feature.coordinate,
    coordinates: feature.coordinates,
    rings: feature.rings,
  }));
}

function normalizedStreetFeatures(streets: StreetCenterline[] = []): NormalizedFeature[] {
  return streets
    .filter((street) => street.geometry.length >= 2)
    .map((street) => ({
      id: street.streetId,
      layerId: "streetReference",
      label: street.streetName,
      dataSource: street.source,
      coordinates: street.geometry,
    }));
}

function withRegistryReferenceLayers(input: ReferenceLayerSet): ReferenceLayerSet {
  if (!input.constraintRegistryFeatures?.length) return input;
  const registryLayers = constraintFeaturesToReferenceLayers(input.constraintRegistryFeatures);
  return {
    ...input,
    layers: [...(input.layers ?? []), ...registryLayers],
  };
}

function referenceFeatures(input: ReferenceLayerSet) {
  const expandedInput = withRegistryReferenceLayers(input);
  return {
    streets: [...normalizedStreetFeatures(expandedInput.streets), ...normalizedFeatures(expandedInput, "streetReference")],
    buildings: [...(expandedInput.buildings ?? []), ...normalizedFeatures(expandedInput, "buildingReference")].map(normalizeGenericFeature("buildingReference")),
    parcels: [...(expandedInput.parcels ?? []), ...normalizedFeatures(expandedInput, "parcelReference")].map(normalizeGenericFeature("parcelReference")),
    railroads: [...(expandedInput.railroads ?? []), ...normalizedFeatures(expandedInput, "railroadReference")].map(normalizeGenericFeature("railroadReference")),
    water: [...(expandedInput.water ?? []), ...normalizedFeatures(expandedInput, "waterReference")].map(normalizeGenericFeature("waterReference")),
    terrain: [...(expandedInput.terrain ?? []), ...normalizedFeatures(expandedInput, "terrainReference")].map(normalizeGenericFeature("terrainReference")),
  };
}

function normalizeGenericFeature(defaultLayerId: string) {
  return (feature: GeographicReferenceFeature | NormalizedFeature): NormalizedFeature => ({
    id: "referenceId" in feature ? feature.referenceId : feature.id,
    layerId: "layerId" in feature ? feature.layerId : defaultLayerId,
    label: "label" in feature && feature.label ? feature.label : "referenceId" in feature ? feature.referenceId : feature.id,
    dataSource: "dataSource" in feature ? feature.dataSource : undefined,
    coordinate: feature.coordinate,
    coordinates: feature.coordinates,
    rings: feature.rings,
  });
}

function routeSegments(geometry: DALCoordinate[]) {
  const segments: Array<[DALCoordinate, DALCoordinate]> = [];
  for (let index = 1; index < geometry.length; index += 1) segments.push([geometry[index - 1], geometry[index]]);
  return segments;
}

function orientation(a: DALCoordinate, b: DALCoordinate, c: DALCoordinate) {
  return (b[1] - a[1]) * (c[0] - b[0]) - (b[0] - a[0]) * (c[1] - b[1]);
}

function onSegment(a: DALCoordinate, b: DALCoordinate, c: DALCoordinate) {
  return b[0] <= Math.max(a[0], c[0]) && b[0] >= Math.min(a[0], c[0]) && b[1] <= Math.max(a[1], c[1]) && b[1] >= Math.min(a[1], c[1]);
}

function segmentsIntersect(a: DALCoordinate, b: DALCoordinate, c: DALCoordinate, d: DALCoordinate) {
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);
  if ((o1 > 0) !== (o2 > 0) && (o3 > 0) !== (o4 > 0)) return true;
  const epsilon = 1e-12;
  return (
    (Math.abs(o1) < epsilon && onSegment(a, c, b)) ||
    (Math.abs(o2) < epsilon && onSegment(a, d, b)) ||
    (Math.abs(o3) < epsilon && onSegment(c, a, d)) ||
    (Math.abs(o4) < epsilon && onSegment(c, b, d))
  );
}

function segmentIntersectionCoordinate(a: DALCoordinate, b: DALCoordinate, c: DALCoordinate, d: DALCoordinate): DALCoordinate | null {
  if (!segmentsIntersect(a, b, c, d)) return null;
  const x1 = a[0];
  const y1 = a[1];
  const x2 = b[0];
  const y2 = b[1];
  const x3 = c[0];
  const y3 = c[1];
  const x4 = d[0];
  const y4 = d[1];
  const denominator = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denominator) < 1e-12) return [(Math.max(Math.min(x1, x2), Math.min(x3, x4)) + Math.min(Math.max(x1, x2), Math.max(x3, x4))) / 2, (Math.max(Math.min(y1, y2), Math.min(y3, y4)) + Math.min(Math.max(y1, y2), Math.max(y3, y4))) / 2];
  const px = ((x1 * y2 - y1 * x2) * (x3 - x4) - (x1 - x2) * (x3 * y4 - y3 * x4)) / denominator;
  const py = ((x1 * y2 - y1 * x2) * (y3 - y4) - (y1 - y2) * (x3 * y4 - y3 * x4)) / denominator;
  return [px, py];
}

function uniqueCoordinates(coordinates: DALCoordinate[]) {
  const seen = new Set<string>();
  return coordinates.filter((coordinate) => {
    const key = `${coordinate[0].toFixed(7)},${coordinate[1].toFixed(7)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function intersectsLine(route: DALCoordinate[], line: DALCoordinate[]) {
  if (route.length < 2 || line.length < 2) return false;
  return routeSegments(route).some(([a, b]) => routeSegments(line).some(([c, d]) => segmentsIntersect(a, b, c, d)));
}

function lineIntersectionCoordinates(route: DALCoordinate[], line: DALCoordinate[]) {
  if (route.length < 2 || line.length < 2) return [];
  const intersections: DALCoordinate[] = [];
  routeSegments(route).forEach(([a, b]) => {
    routeSegments(line).forEach(([c, d]) => {
      const intersection = segmentIntersectionCoordinate(a, b, c, d);
      if (intersection) intersections.push(intersection);
    });
  });
  return uniqueCoordinates(intersections);
}

function pointInRing(point: DALCoordinate, ring: DALCoordinate[]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersect = yi > point[1] !== yj > point[1] && point[0] < ((xj - xi) * (point[1] - yi)) / Math.max(yj - yi, 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function intersectsPolygon(route: DALCoordinate[], rings: DALCoordinate[][] = []) {
  const exterior = rings[0] ?? [];
  if (route.length < 2 || exterior.length < 3) return false;
  if (route.some((point) => pointInRing(point, exterior))) return true;
  const closedRing = exterior[0] === exterior[exterior.length - 1] ? exterior : [...exterior, exterior[0]];
  return routeSegments(route).some(([a, b]) => routeSegments(closedRing).some(([c, d]) => segmentsIntersect(a, b, c, d)));
}

function polygonIntersectionCoordinates(route: DALCoordinate[], rings: DALCoordinate[][] = []) {
  const exterior = rings[0] ?? [];
  if (route.length < 2 || exterior.length < 3) return [];
  const closedRing = exterior[0] === exterior[exterior.length - 1] ? exterior : [...exterior, exterior[0]];
  const intersections = lineIntersectionCoordinates(route, closedRing);
  const containedRoutePoints = route.filter((point) => pointInRing(point, exterior));
  return uniqueCoordinates([...intersections, ...containedRoutePoints]);
}

function feetToLine(point: DALCoordinate, a: DALCoordinate, b: DALCoordinate) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lengthSquared = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / lengthSquared));
  const projection: DALCoordinate = [a[0] + t * dx, a[1] + t * dy];
  return haversineFeet(point, projection);
}

function pointNearRoute(route: DALCoordinate[], point: DALCoordinate, thresholdFeet: number) {
  if (route.length < 2) return false;
  return routeSegments(route).some(([a, b]) => feetToLine(point, a, b) <= thresholdFeet);
}

function featureIntersectionCoordinates(route: DALCoordinate[], feature: NormalizedFeature, nearThresholdFeet = 35) {
  if (feature.rings?.length) return polygonIntersectionCoordinates(route, feature.rings);
  if (feature.coordinates?.length) {
    const intersections = lineIntersectionCoordinates(route, feature.coordinates);
    const nearPoints = feature.coordinates.filter((coordinate) => pointNearRoute(route, coordinate, nearThresholdFeet));
    return uniqueCoordinates([...intersections, ...nearPoints]);
  }
  if (feature.coordinate && pointNearRoute(route, feature.coordinate, nearThresholdFeet)) return [feature.coordinate];
  return [];
}

function featureTouchesRoute(route: DALCoordinate[], feature: NormalizedFeature, nearThresholdFeet = 35) {
  if (feature.rings?.length) return intersectsPolygon(route, feature.rings);
  if (feature.coordinates?.length) return intersectsLine(route, feature.coordinates) || feature.coordinates.some((coordinate) => pointNearRoute(route, coordinate, nearThresholdFeet));
  if (feature.coordinate) return pointNearRoute(route, feature.coordinate, nearThresholdFeet);
  return false;
}

function representativeGeometry(feature: NormalizedFeature): DALCoordinate[] | { lat: number; lon: number } {
  if (feature.rings?.[0]?.length) return feature.rings[0];
  if (feature.coordinates?.length) return feature.coordinates;
  const point = feature.coordinate ?? [0, 0];
  return { lon: point[0], lat: point[1] };
}

function severityPenalty(severity: ConstraintSeverity) {
  if (severity === "BLOCKING") return 42;
  if (severity === "HIGH") return 20;
  if (severity === "MEDIUM") return 10;
  return 3;
}

function addConstraints(args: {
  route: DALCoordinate[];
  features: NormalizedFeature[];
  type: ConstraintType;
  severity: ConstraintSeverity;
  action: RecommendedConstraintAction;
  description: (feature: NormalizedFeature) => string;
  constraints: RouteConstraint[];
}) {
  args.features.forEach((feature) => {
    const intersections = featureIntersectionCoordinates(args.route, feature);
    if (!intersections.length && !featureTouchesRoute(args.route, feature)) return;
    args.constraints.push({
      constraintId: `${args.type.toLowerCase()}:${feature.id}`,
      constraintType: args.type,
      severity: args.severity,
      geometry: representativeGeometry(feature),
      description: args.description(feature),
      recommendedAction: args.action,
      sourceLayer: feature.layerId,
      sourceObjectId: feature.id,
      intersectionCoordinates: intersections.map((coordinate) => ({ lon: coordinate[0], lat: coordinate[1] })),
      analysisMethod: intersections.length ? "GEOMETRY_INTERSECTION" : "REFERENCE_ESTIMATE",
    });
  });
}

export function analyzeRouteConstraints(input: ConstraintAnalysisInput): ConstraintAnalysisResult {
  const geometry = input.proposedGeometry.filter((coordinate) => Array.isArray(coordinate) && Number.isFinite(coordinate[0]) && Number.isFinite(coordinate[1]));
  const constraints: RouteConstraint[] = [];
  const features = referenceFeatures(input.referenceLayers);
  const constraintRegistrySnapshot = snapshotForReferenceLayers(input.referenceLayers, features);
  const routeGeometryHash = hashRouteGeometry(geometry);
  const routeGeometrySource = input.routeGeometrySource ?? "SERVICEABILITY_PROPOSED";

  if (geometry.length < 2) {
    constraints.push({
      constraintId: `unknown:${input.candidateSiteId}:invalid-route`,
      constraintType: "UNKNOWN_CONSTRAINT",
      severity: "BLOCKING",
      geometry: pointGeometry(input.candidateCoordinate),
      description: "Proposed route geometry has fewer than two valid vertices.",
      recommendedAction: "REROUTE",
    });
  }

  addConstraints({
    route: geometry,
    features: features.buildings,
    type: "BUILDING_CONFLICT",
    severity: "BLOCKING",
    action: "REROUTE",
    constraints,
    description: (feature) => `Route intersects building reference ${feature.label}.`,
  });
  addConstraints({
    route: geometry,
    features: features.parcels,
    type: "PARCEL_CROSSING",
    severity: "MEDIUM",
    action: "PERMIT_REQUIRED",
    constraints,
    description: (feature) => `Route crosses parcel reference ${feature.label}.`,
  });
  addConstraints({
    route: geometry,
    features: features.railroads,
    type: "RAILROAD_CROSSING",
    severity: "HIGH",
    action: "PERMIT_REQUIRED",
    constraints,
    description: (feature) => `Route crosses railroad reference ${feature.label}.`,
  });
  addConstraints({
    route: geometry,
    features: features.water,
    type: "WATER_CROSSING",
    severity: "HIGH",
    action: "FIELD_VERIFY",
    constraints,
    description: (feature) => `Route crosses water reference ${feature.label}.`,
  });
  addConstraints({
    route: geometry,
    features: features.streets,
    type: "ROAD_CROSSING",
    severity: "LOW",
    action: "REVIEW",
    constraints,
    description: (feature) => `Route touches street reference ${feature.label}.`,
  });
  addConstraints({
    route: geometry,
    features: features.terrain,
    type: "TERRAIN_FLAG",
    severity: "MEDIUM",
    action: "FIELD_VERIFY",
    constraints,
    description: (feature) => `Route touches terrain reference ${feature.label}.`,
  });

  const evidenceId = evidenceIdFor({ candidateSiteId: input.candidateSiteId, routeGeometryHash, routeGeometrySource });
  const provenance = provenanceFor({
    input: input.referenceLayers,
    features,
    registrySnapshot: constraintRegistrySnapshot,
    evidenceId,
    routeGeometryHash,
    routeInvalid: geometry.length < 2,
  });
  let constraintSummary = constraints.reduce(
    (summary, constraint) => {
      if (constraint.constraintType === "BUILDING_CONFLICT") summary.buildingConflicts += 1;
      if (constraint.constraintType === "PARCEL_CROSSING") summary.parcelCrossings += 1;
      if (constraint.constraintType === "RAILROAD_CROSSING") summary.railroadCrossings += 1;
      if (constraint.constraintType === "WATER_CROSSING") summary.waterCrossings += 1;
      if (constraint.constraintType === "ROAD_CROSSING") summary.roadCrossings += 1;
      if (constraint.constraintType === "TERRAIN_FLAG") summary.terrainFlags += 1;
      return summary;
    },
    { ...EMPTY_SUMMARY }
  );
  const waterIntersectionCoordinates = constraints
    .filter((constraint) => constraint.constraintType === "WATER_CROSSING")
    .flatMap((constraint) => constraint.intersectionCoordinates ?? []);
  const waterLayerLoaded = provenance.referenceLayersLoaded.water;
  const waterFeatureCount = provenance.featureCounts.waterFeatures;
  const waterUnknown = !waterLayerLoaded || waterFeatureCount === 0 || provenance.fallbackMode;
  const waterCrossingAudit: WaterCrossingAudit = {
    waterLayerLoaded,
    waterFeatureCount,
    waterIntersectionsFound: waterIntersectionCoordinates.length,
    intersectionCoordinates: waterIntersectionCoordinates,
    analysisMethod: waterUnknown ? (provenance.fallbackMode ? "FALLBACK" : "UNKNOWN") : "GEOMETRY_INTERSECTION",
  };
  constraintSummary = {
    ...constraintSummary,
    waterCrossings: waterUnknown ? 0 : waterCrossingAudit.waterIntersectionsFound,
  };
  const unknownCounts: Partial<Record<keyof ConstraintSummary, boolean>> = {
    buildingConflicts: !provenance.referenceLayersLoaded.buildings || provenance.featureCounts.buildingFeatures === 0 || provenance.fallbackMode,
    parcelCrossings: !provenance.referenceLayersLoaded.parcels || provenance.featureCounts.parcelFeatures === 0 || provenance.fallbackMode,
    railroadCrossings: !provenance.referenceLayersLoaded.railroads || provenance.featureCounts.railroadFeatures === 0 || provenance.fallbackMode,
    waterCrossings: waterUnknown,
    roadCrossings: !provenance.referenceLayersLoaded.streets || provenance.featureCounts.streetFeatures === 0 || provenance.fallbackMode,
    terrainFlags: !provenance.referenceLayersLoaded.terrain || provenance.featureCounts.terrainFeatures === 0 || provenance.fallbackMode,
  };
  const requiredUnknownCounts = DEFAULT_ROUTE_CERTIFICATION_REQUIRED_LAYERS.some((layerType) => {
    if (layerType === "STREETS") return unknownCounts.roadCrossings;
    if (layerType === "WATER") return unknownCounts.waterCrossings;
    if (layerType === "RAILROADS") return unknownCounts.railroadCrossings;
    if (layerType === "PARCELS") return unknownCounts.parcelCrossings;
    if (layerType === "BUILDINGS") return unknownCounts.buildingConflicts;
    return false;
  });
  const scorePenalty = constraints.reduce((sum, constraint) => sum + severityPenalty(constraint.severity), 0);
  const constructabilityScore = Math.max(0, Math.min(100, Math.round(100 - scorePenalty)));
  const unresolvedConstraints = constraints.filter((constraint) => constraint.recommendedAction !== "NO_ACTION").map((constraint) => constraint.constraintId);
  const certificationReadiness: CertificationReadiness =
    requiredUnknownCounts || provenance.fallbackMode || !constraintRegistrySnapshot.completeness.usableForCertification
      ? "UNKNOWN"
      : constraints.some((constraint) => constraint.severity === "BLOCKING") || constructabilityScore < 45
        ? "BLOCKED"
        : unresolvedConstraints.length
          ? "REVIEW_REQUIRED"
          : "READY";
  const recommendedActions = Array.from(new Set(constraints.map((constraint) => constraint.recommendedAction)));
  const referenceLayers = referenceLayersUsed(input.referenceLayers);
  const constraintLayerDiagnostics: ConstraintLayerDiagnostic[] = (Object.keys(REGISTRY_LAYER_BY_KEY) as ConstraintLayerKey[]).map((key) => {
    const registryLayer = registryLayerForKey(constraintRegistrySnapshot, key);
    const intersectionCount =
      key === "streets"
        ? constraintSummary.roadCrossings
        : key === "buildings"
          ? constraintSummary.buildingConflicts
          : key === "parcels"
            ? constraintSummary.parcelCrossings
            : key === "railroads"
              ? constraintSummary.railroadCrossings
              : key === "water"
                ? constraintSummary.waterCrossings
                : constraintSummary.terrainFlags;
    return {
      constraintClass: key,
      layerLoaded: provenance.referenceLayersLoaded[key],
      featureCount: featureCountForKey(features, key),
      authority: registryLayer?.authority ?? "UNKNOWN",
      certificationUse: registryLayer?.certificationUse ?? "NOT_USABLE",
      coverage: registryLayer?.coverage,
      intersectionCount,
    };
  });
  const notes = [
    `Route geometry hash ${routeGeometryHash}.`,
    referenceLayers.length ? `Reference layers used: ${referenceLayers.join(", ")}.` : "No populated geographic reference layers were available.",
    `Constraint completeness ${constraintRegistrySnapshot.completeness.completenessPercent}%.`,
    ...provenance.fallbackReasons,
    ...constraintRegistrySnapshot.completeness.notes,
  ];
  if (input.supersedesEvidenceId) notes.push(`Supersedes constraint evidence ${input.supersedesEvidenceId}.`);
  const layerAudit = {
    routeGeometryHash,
    streetsLayerLoaded: provenance.referenceLayersLoaded.streets,
    streetFeatureCount: provenance.featureCounts.streetFeatures,
    roadIntersectionsFound: constraintSummary.roadCrossings,
    parcelsLayerLoaded: provenance.referenceLayersLoaded.parcels,
    parcelFeatureCount: provenance.featureCounts.parcelFeatures,
    parcelIntersectionsFound: constraintSummary.parcelCrossings,
    buildingsLayerLoaded: provenance.referenceLayersLoaded.buildings,
    buildingFeatureCount: provenance.featureCounts.buildingFeatures,
    buildingIntersectionsFound: constraintSummary.buildingConflicts,
    railroadsLayerLoaded: provenance.referenceLayersLoaded.railroads,
    railroadFeatureCount: provenance.featureCounts.railroadFeatures,
    railroadIntersectionsFound: constraintSummary.railroadCrossings,
    waterLayerLoaded: provenance.referenceLayersLoaded.water,
    waterFeatureCount: provenance.featureCounts.waterFeatures,
    waterIntersectionsFound: waterCrossingAudit.waterIntersectionsFound,
    terrainLayerLoaded: provenance.referenceLayersLoaded.terrain,
    terrainFeatureCount: provenance.featureCounts.terrainFeatures,
    terrainIntersectionsFound: constraintSummary.terrainFlags,
    fallbackMode: provenance.fallbackMode,
    constraintCompletenessPercent: constraintRegistrySnapshot.completeness.completenessPercent,
    missingConstraintLayers: constraintRegistrySnapshot.completeness.missingLayers,
    constraintLayerDiagnostics,
  };
  console.info("ConstraintAnalysisEngine", JSON.stringify(layerAudit));

  return {
    evidenceId,
    routeGeometryHash,
    routeGeometrySource,
    sourceScopeVersionId: input.parentScopeVersionId,
    candidateSiteId: input.candidateSiteId,
    routeCertificationId: input.routeCertificationId,
    generatedAt: nowIso(),
    generatedBy: "ConstraintAnalysisEngine",
    summary: constraintSummary,
    constraintSummary,
    constraints,
    constructabilityScore,
    certificationReadiness,
    diagnostics: {
      referenceLayersUsed: referenceLayers,
      analysisMode: input.analysisMode ?? "REFERENCE_LAYER_ASSISTED",
      notes,
      constraintLayerDiagnostics,
    },
    provenance,
    constraintRegistrySnapshot,
    waterCrossingAudit,
    unknownCounts,
    unresolvedConstraints,
    recommendedActions,
    supersedesEvidenceId: input.supersedesEvidenceId,
  };
}

function constraintCoordinate(constraint: RouteConstraint): DALCoordinate | undefined {
  if (Array.isArray(constraint.geometry)) return constraint.geometry[Math.floor(constraint.geometry.length / 2)] ?? constraint.geometry[0];
  return [constraint.geometry.lon, constraint.geometry.lat];
}

function severityStyle(severity: ConstraintSeverity): MapKernelPrimitive["style"] {
  if (severity === "BLOCKING") return { fill: "#7f1d1d", stroke: "#ffffff", radius: 7, opacity: 0.98 };
  if (severity === "HIGH") return { fill: "#dc2626", stroke: "#ffffff", radius: 6, opacity: 0.95 };
  if (severity === "MEDIUM") return { fill: "#f59e0b", stroke: "#ffffff", radius: 5, opacity: 0.92 };
  return { fill: "#fde047", stroke: "#854d0e", radius: 4, opacity: 0.88 };
}

function constraintLineStyle(severity: ConstraintSeverity): MapKernelPrimitive["style"] {
  if (severity === "BLOCKING") return { stroke: "#7f1d1d", fill: "none", strokeWidth: 4, opacity: 0.9, dasharray: "2 3" };
  if (severity === "HIGH") return { stroke: "#dc2626", fill: "none", strokeWidth: 3, opacity: 0.84, dasharray: "4 4" };
  if (severity === "MEDIUM") return { stroke: "#f59e0b", fill: "none", strokeWidth: 2, opacity: 0.78, dasharray: "6 4" };
  return { stroke: "#facc15", fill: "none", strokeWidth: 2, opacity: 0.72, dasharray: "8 6" };
}

export function renderConstraintAnalysis(args: {
  result: ConstraintAnalysisResult | null | undefined;
  sourceId: string;
  scopeVersionId?: string;
}): MapKernelRenderSpec | null {
  if (!args.result?.constraints.length) return null;
  const primitives: MapKernelPrimitive[] = [];
  args.result.constraints.forEach((constraint) => {
    const coordinate = constraintCoordinate(constraint);
    if (Array.isArray(constraint.geometry) && constraint.geometry.length >= 2) {
      primitives.push({
        id: `${constraint.constraintId}:geometry`,
        layerId: "object",
        kind: "line",
        coordinates: constraint.geometry,
        label: constraint.constraintType,
        payload: constraint,
        style: constraintLineStyle(constraint.severity),
        metadata: { sourceLayer: "object", renderAuthority: "Geographic Reference", referenceLayer: true },
        ref: { kind: "Constraint", id: `${constraint.constraintId}:geometry`, scopeVersionId: args.scopeVersionId ?? args.sourceId, sourceLayer: "object" },
      });
    }
    if (coordinate) {
      primitives.push({
        id: `${constraint.constraintId}:marker`,
        layerId: "object",
        kind: "point",
        coordinate,
        label: constraint.constraintType,
        payload: constraint,
        style: severityStyle(constraint.severity),
        metadata: { sourceLayer: "object", renderAuthority: "Geographic Reference", referenceLayer: true },
        ref: { kind: "Constraint", id: `${constraint.constraintId}:marker`, scopeVersionId: args.scopeVersionId ?? args.sourceId, sourceLayer: "object" },
      });
      primitives.push({
        id: `${constraint.constraintId}:label`,
        layerId: "object",
        kind: "label",
        coordinate,
        label: `${constraint.severity} ${constraint.constraintType.replaceAll("_", " ")}`,
        payload: constraint,
        style: { fill: constraint.severity === "LOW" ? "#854d0e" : "#7f1d1d", fontSize: 11, fontWeight: 700, opacity: 1 },
        metadata: { sourceLayer: "object", renderAuthority: "Geographic Reference", referenceLayer: true },
        ref: { kind: "Constraint", id: `${constraint.constraintId}:label`, scopeVersionId: args.scopeVersionId ?? args.sourceId, sourceLayer: "object" },
      });
    }
  });
  args.result.waterCrossingAudit.intersectionCoordinates.forEach((coordinate, index) => {
    const id = `water-intersection:${args.result?.evidenceId}:${index + 1}`;
    primitives.push({
      id,
      layerId: "object",
      kind: "point",
      coordinate: [coordinate.lon, coordinate.lat],
      label: `Water intersection ${index + 1}`,
      payload: {
        evidenceId: args.result?.evidenceId,
        routeGeometryHash: args.result?.routeGeometryHash,
        coordinate,
        audit: args.result?.waterCrossingAudit,
      },
      style: { fill: "#0284c7", stroke: "#ffffff", radius: 7, opacity: 1 },
      metadata: { sourceLayer: "object", renderAuthority: "Constraint Evidence", referenceLayer: true, auditOverlay: true },
      ref: { kind: "Constraint", id, scopeVersionId: args.scopeVersionId ?? args.sourceId, sourceLayer: "object" },
    });
  });
  return {
    specId: `constraints:${args.sourceId}`,
    sourceType: "Manual",
    sourceId: args.sourceId,
    name: "Constraint Evidence",
    primitives,
    metadata: {
      evidenceId: args.result.evidenceId,
      routeGeometryHash: args.result.routeGeometryHash,
      generatedBy: args.result.generatedBy,
      generatedAt: args.result.generatedAt,
      constraintSummary: args.result.summary,
      constructabilityScore: args.result.constructabilityScore,
      certificationReadiness: args.result.certificationReadiness,
      referenceLayer: true,
    },
  };
}
