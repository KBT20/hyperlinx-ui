import type { GeographicReferenceFeature, GeographicReferenceLayer } from "./ReferenceLayerManager";
import type { StreetCenterline } from "../street/streetTypes";
import type { DALCoordinate } from "../types/dal";

export type ConstraintReferenceLayerType =
  | "STREETS"
  | "WATER"
  | "RAILROADS"
  | "BUILDINGS"
  | "PARCELS"
  | "TERRAIN"
  | "ROW"
  | "UTILITY_CORRIDORS"
  | "EASEMENTS";

export type ConstraintReferenceLayerStatus = "NOT_LOADED" | "LOADING" | "LOADED" | "FAILED" | "STALE";
export type ConstraintCertificationUse = "USABLE_FOR_CERTIFICATION" | "ROUTING_REFERENCE" | "REFERENCE_ONLY" | "NOT_USABLE";
export type ConstraintAuthority = "IMPORTED" | "OSM" | "USGS" | "FRA" | "COUNTY" | "CITY" | "STATE" | "CUSTOMER" | "MANUAL" | "UNKNOWN";
export type ConstraintGeometryType = "POINT" | "LINESTRING" | "POLYGON" | "MULTILINESTRING" | "MULTIPOLYGON";
export type ConstraintBounds = [number, number, number, number];

export type ConstraintReferenceLayer = {
  layerId: string;
  layerType: ConstraintReferenceLayerType;
  status: ConstraintReferenceLayerStatus;
  certificationUse: ConstraintCertificationUse;
  authority: ConstraintAuthority;
  sourceName: string;
  sourceUrl?: string;
  featureCount: number;
  coverage?: {
    bbox?: ConstraintBounds;
    county?: string;
    state?: string;
    market?: string;
  };
  loadedAt?: string;
  lastUpdated?: string;
  notes?: string;
};

export type ConstraintGeometryFeature = {
  featureId: string;
  layerId: string;
  layerType: ConstraintReferenceLayerType;
  geometryType: ConstraintGeometryType;
  geometry: unknown;
  properties: Record<string, unknown>;
  authority: ConstraintAuthority;
  usableForCertification: boolean;
};

export type ConstraintCompletenessScore = {
  totalRequiredLayers: number;
  loadedRequiredLayers: number;
  completenessPercent: number;
  missingLayers: ConstraintReferenceLayerType[];
  usableForCertification: boolean;
  notes: string[];
};

export type ConstraintRegistrySnapshot = {
  layers: ConstraintReferenceLayer[];
  completeness: ConstraintCompletenessScore;
};

export type ConstraintRegistryAnalysisContext = {
  constraintRegistrySnapshot: ConstraintRegistrySnapshot;
  constraintRegistryFeatures: ConstraintGeometryFeature[];
};

export const DEFAULT_ROUTE_CERTIFICATION_REQUIRED_LAYERS: ConstraintReferenceLayerType[] = ["STREETS", "WATER", "RAILROADS", "PARCELS", "BUILDINGS"];

const layers = new Map<string, ConstraintReferenceLayer>();
const featuresByLayer = new Map<string, ConstraintGeometryFeature[]>();

function nowIso() {
  return new Date().toISOString();
}

function layerSort(a: ConstraintReferenceLayer, b: ConstraintReferenceLayer) {
  return a.layerType.localeCompare(b.layerType) || a.sourceName.localeCompare(b.sourceName) || a.layerId.localeCompare(b.layerId);
}

function finiteCoordinate(value: unknown): value is DALCoordinate {
  return Array.isArray(value) && value.length >= 2 && Number.isFinite(Number(value[0])) && Number.isFinite(Number(value[1]));
}

function collectCoordinates(geometry: unknown): DALCoordinate[] {
  const coordinates: DALCoordinate[] = [];
  const stack: unknown[] = [geometry];
  const visited = new Set<object>();
  while (stack.length) {
    const next = stack.pop();
    if (finiteCoordinate(next)) {
      coordinates.push([Number(next[0]), Number(next[1])]);
      continue;
    }
    if (next && typeof next === "object") {
      if (visited.has(next)) continue;
      visited.add(next);
    }
    if (Array.isArray(next)) {
      for (let index = next.length - 1; index >= 0; index -= 1) stack.push(next[index]);
    } else if (next && typeof next === "object" && "coordinates" in next) {
      stack.push((next as { coordinates?: unknown }).coordinates);
    }
  }
  return coordinates;
}

export function boundsForConstraintFeatures(features: ConstraintGeometryFeature[]): ConstraintBounds | undefined {
  const coordinates = features.flatMap((feature) => collectCoordinates(feature.geometry));
  if (!coordinates.length) return undefined;
  let minLon = Number.POSITIVE_INFINITY;
  let minLat = Number.POSITIVE_INFINITY;
  let maxLon = Number.NEGATIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;
  coordinates.forEach(([lon, lat]) => {
    minLon = Math.min(minLon, lon);
    minLat = Math.min(minLat, lat);
    maxLon = Math.max(maxLon, lon);
    maxLat = Math.max(maxLat, lat);
  });
  return [minLon, minLat, maxLon, maxLat];
}

function boundsIntersect(a?: ConstraintBounds, b?: ConstraintBounds) {
  if (!a || !b) return true;
  return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
}

export function boundsForRouteGeometry(geometry: DALCoordinate[]): ConstraintBounds | undefined {
  const features: ConstraintGeometryFeature[] = geometry.length
    ? [
        {
          featureId: "route-bounds",
          layerId: "route",
          layerType: "ROW",
          geometryType: "LINESTRING",
          geometry,
          properties: {},
          authority: "MANUAL",
          usableForCertification: false,
        },
      ]
    : [];
  return boundsForConstraintFeatures(features);
}

export function registerConstraintLayer(layer: ConstraintReferenceLayer, layerFeatures: ConstraintGeometryFeature[] = []) {
  const timestamp = nowIso();
  const normalizedFeatures = layerFeatures.map((feature) => ({
    ...feature,
    layerId: layer.layerId,
    layerType: layer.layerType,
    authority: feature.authority ?? layer.authority,
    usableForCertification: feature.usableForCertification ?? layer.certificationUse === "USABLE_FOR_CERTIFICATION",
  }));
  const nextLayer: ConstraintReferenceLayer = {
    ...layer,
    status: layer.status ?? "LOADED",
    featureCount: normalizedFeatures.length || layer.featureCount || 0,
    coverage: {
      ...layer.coverage,
      bbox: layer.coverage?.bbox ?? boundsForConstraintFeatures(normalizedFeatures),
    },
    loadedAt: layer.loadedAt ?? (layer.status === "LOADED" || normalizedFeatures.length ? timestamp : undefined),
    lastUpdated: timestamp,
  };
  layers.set(nextLayer.layerId, nextLayer);
  featuresByLayer.set(nextLayer.layerId, normalizedFeatures);
  return nextLayer;
}

export function listConstraintLayers() {
  return Array.from(layers.values()).sort(layerSort);
}

export function loadConstraintLayer(layerId: string) {
  const layer = layers.get(layerId);
  if (!layer) return undefined;
  const next = { ...layer, status: "LOADED" as const, loadedAt: layer.loadedAt ?? nowIso(), lastUpdated: nowIso() };
  layers.set(layerId, next);
  return next;
}

export function unloadConstraintLayer(layerId: string) {
  const layer = layers.get(layerId);
  if (!layer) return undefined;
  const next = { ...layer, status: "NOT_LOADED" as const, featureCount: 0, lastUpdated: nowIso(), notes: layer.notes ?? "Layer unloaded from active DAL session." };
  layers.set(layerId, next);
  featuresByLayer.set(layerId, []);
  return next;
}

export function getConstraintLayerStatus(layerIdOrType: string) {
  const direct = layers.get(layerIdOrType);
  if (direct) return direct.status;
  const matching = listConstraintLayers().filter((layer) => layer.layerType === layerIdOrType);
  if (!matching.length) return "NOT_LOADED" as ConstraintReferenceLayerStatus;
  if (matching.some((layer) => layer.status === "LOADED")) return "LOADED";
  if (matching.some((layer) => layer.status === "LOADING")) return "LOADING";
  if (matching.some((layer) => layer.status === "FAILED")) return "FAILED";
  if (matching.some((layer) => layer.status === "STALE")) return "STALE";
  return "NOT_LOADED";
}

export function getConstraintLayerFeaturesByBounds(args: {
  layerId?: string;
  layerType?: ConstraintReferenceLayerType;
  bbox?: ConstraintBounds;
}) {
  const candidates = listConstraintLayers().filter((layer) => {
    if (args.layerId && layer.layerId !== args.layerId) return false;
    if (args.layerType && layer.layerType !== args.layerType) return false;
    if (layer.status !== "LOADED") return false;
    return boundsIntersect(layer.coverage?.bbox, args.bbox);
  });
  return candidates.flatMap((layer) =>
    (featuresByLayer.get(layer.layerId) ?? []).filter((feature) => boundsIntersect(boundsForConstraintFeatures([feature]), args.bbox))
  );
}

export function getConstraintLayerFeatureCount(layerIdOrType: string) {
  const direct = layers.get(layerIdOrType);
  if (direct) return direct.featureCount;
  return listConstraintLayers()
    .filter((layer) => layer.layerType === layerIdOrType && layer.status === "LOADED")
    .reduce((sum, layer) => sum + layer.featureCount, 0);
}

function bestLayerForTypeFromList(layerType: ConstraintReferenceLayerType, sourceLayers: ConstraintReferenceLayer[]) {
  const candidates = sourceLayers.filter((layer) => layer.layerType === layerType);
  return (
    candidates.find((layer) => layer.status === "LOADED" && layer.certificationUse === "USABLE_FOR_CERTIFICATION" && layer.featureCount > 0) ??
    candidates.find((layer) => layer.status === "LOADED" && layer.featureCount > 0) ??
    candidates[0]
  );
}

function bestLayerForType(layerType: ConstraintReferenceLayerType) {
  return bestLayerForTypeFromList(layerType, listConstraintLayers());
}

export function calculateConstraintCompleteness(
  sourceLayers: ConstraintReferenceLayer[],
  requiredLayers: ConstraintReferenceLayerType[] = DEFAULT_ROUTE_CERTIFICATION_REQUIRED_LAYERS
): ConstraintCompletenessScore {
  const required = Array.from(new Set(requiredLayers));
  const missingLayers: ConstraintReferenceLayerType[] = [];
  const notes: string[] = [];
  let loadedRequiredLayers = 0;
  let usableForCertification = true;

  required.forEach((layerType) => {
    const layer = bestLayerForTypeFromList(layerType, sourceLayers);
    if (!layer || layer.status !== "LOADED" || layer.featureCount <= 0) {
      missingLayers.push(layerType);
      notes.push(`${layerType} reference geometry is unavailable; related constraints remain UNKNOWN.`);
      usableForCertification = false;
      return;
    }
    loadedRequiredLayers += 1;
    if (layer.certificationUse !== "USABLE_FOR_CERTIFICATION") {
      usableForCertification = false;
      notes.push(`${layerType} is loaded as ${layer.certificationUse}; evidence is reference-only or not certifiable.`);
    }
  });

  return {
    totalRequiredLayers: required.length,
    loadedRequiredLayers,
    completenessPercent: required.length ? Math.round((loadedRequiredLayers / required.length) * 100) : 100,
    missingLayers,
    usableForCertification,
    notes,
  };
}

export function getConstraintCompleteness(requiredLayers: ConstraintReferenceLayerType[] = DEFAULT_ROUTE_CERTIFICATION_REQUIRED_LAYERS): ConstraintCompletenessScore {
  return calculateConstraintCompleteness(listConstraintLayers(), requiredLayers);
}

export function getConstraintRegistrySnapshot(requiredLayers: ConstraintReferenceLayerType[] = DEFAULT_ROUTE_CERTIFICATION_REQUIRED_LAYERS): ConstraintRegistrySnapshot {
  return {
    layers: listConstraintLayers(),
    completeness: getConstraintCompleteness(requiredLayers),
  };
}

export function getConstraintRegistryAnalysisContext(args: {
  bbox?: ConstraintBounds;
  requiredLayers?: ConstraintReferenceLayerType[];
} = {}): ConstraintRegistryAnalysisContext {
  const loadedLayers = listConstraintLayers().filter((layer) => layer.status === "LOADED" && boundsIntersect(layer.coverage?.bbox, args.bbox));
  return {
    constraintRegistrySnapshot: {
      layers: loadedLayers,
      completeness: getConstraintCompleteness(args.requiredLayers),
    },
    constraintRegistryFeatures: loadedLayers.flatMap((layer) =>
      (featuresByLayer.get(layer.layerId) ?? []).filter((feature) => boundsIntersect(boundsForConstraintFeatures([feature]), args.bbox))
    ),
  };
}

function coordinatesFromLineString(geometry: unknown): DALCoordinate[] {
  if (!Array.isArray(geometry)) return [];
  return geometry.filter(finiteCoordinate).map((coordinate) => [Number(coordinate[0]), Number(coordinate[1])] as DALCoordinate);
}

function ringsFromPolygon(geometry: unknown): DALCoordinate[][] {
  if (!Array.isArray(geometry)) return [];
  return geometry.map(coordinatesFromLineString).filter((ring) => ring.length >= 3);
}

function referenceLayerIdForType(layerType: ConstraintReferenceLayerType): GeographicReferenceLayer["layerId"] | null {
  if (layerType === "STREETS") return "streetReference";
  if (layerType === "BUILDINGS") return "buildingReference";
  if (layerType === "PARCELS") return "parcelReference";
  if (layerType === "RAILROADS") return "railroadReference";
  if (layerType === "WATER") return "waterReference";
  if (layerType === "TERRAIN") return "terrainReference";
  return null;
}

function referenceKindForType(layerType: ConstraintReferenceLayerType): GeographicReferenceFeature["kind"] | null {
  if (layerType === "STREETS") return "StreetReference";
  if (layerType === "BUILDINGS") return "BuildingReference";
  if (layerType === "PARCELS") return "ParcelReference";
  if (layerType === "RAILROADS") return "RailroadReference";
  if (layerType === "WATER") return "WaterReference";
  if (layerType === "TERRAIN") return "TerrainReference";
  return null;
}

function labelForFeature(feature: ConstraintGeometryFeature) {
  const name =
    feature.properties.name ??
    feature.properties.Name ??
    feature.properties.NAME ??
    feature.properties.roadName ??
    feature.properties.ROAD_NAME ??
    feature.properties.streetName ??
    feature.properties.STREET ??
    feature.properties.highway ??
    feature.properties.classification;
  return typeof name === "string" && name.trim() ? name : feature.featureId;
}

function streetClassForFeature(feature: ConstraintGeometryFeature): StreetCenterline["streetClass"] {
  const raw = String(
    feature.properties.streetClass ??
      feature.properties.classification ??
      feature.properties.highway ??
      feature.properties.roadClass ??
      feature.properties.ROAD_CLASS ??
      feature.properties.service ??
      ""
  ).toLowerCase();
  if (/motorway|interstate/.test(raw)) return "Interstate";
  if (/trunk|primary|highway|state|us /.test(raw)) return "Highway";
  if (/secondary|arterial/.test(raw)) return "Arterial";
  if (/tertiary|collector/.test(raw)) return "Collector";
  if (/private|driveway|service/.test(raw)) return "Private";
  return "Local";
}

function booleanProperty(value: unknown) {
  const normalized = String(value ?? "").toLowerCase();
  if (["yes", "true", "1"].includes(normalized)) return true;
  if (["no", "false", "0"].includes(normalized)) return false;
  return undefined;
}

export function constraintFeatureToGeographicFeatures(feature: ConstraintGeometryFeature): GeographicReferenceFeature[] {
  const layerId = referenceLayerIdForType(feature.layerType);
  const kind = referenceKindForType(feature.layerType);
  if (!layerId || !kind) return [];
  const payload = { ...feature.properties, authority: feature.authority, usableForCertification: feature.usableForCertification, registryFeature: feature };
  if (feature.geometryType === "POINT" && finiteCoordinate(feature.geometry)) {
    return [{ referenceId: feature.featureId, layerId, kind, coordinate: [Number(feature.geometry[0]), Number(feature.geometry[1])], label: labelForFeature(feature), payload }];
  }
  if (feature.geometryType === "LINESTRING") {
    const coordinates = coordinatesFromLineString(feature.geometry);
    return coordinates.length >= 2 ? [{ referenceId: feature.featureId, layerId, kind, coordinates, label: labelForFeature(feature), payload }] : [];
  }
  if (feature.geometryType === "POLYGON") {
    const rings = ringsFromPolygon(feature.geometry);
    return rings.length ? [{ referenceId: feature.featureId, layerId, kind, rings, label: labelForFeature(feature), payload }] : [];
  }
  if (feature.geometryType === "MULTILINESTRING" && Array.isArray(feature.geometry)) {
    return feature.geometry
      .map((line, index) => ({ line: coordinatesFromLineString(line), index }))
      .filter((item) => item.line.length >= 2)
      .map((item) => ({
        referenceId: `${feature.featureId}:line-${item.index + 1}`,
        layerId,
        kind,
        coordinates: item.line,
        label: labelForFeature(feature),
        payload,
      }));
  }
  if (feature.geometryType === "MULTIPOLYGON" && Array.isArray(feature.geometry)) {
    return feature.geometry
      .map((polygon, index) => ({ rings: ringsFromPolygon(polygon), index }))
      .filter((item) => item.rings.length)
      .map((item) => ({
        referenceId: `${feature.featureId}:polygon-${item.index + 1}`,
        layerId,
        kind,
        rings: item.rings,
        label: labelForFeature(feature),
        payload,
      }));
  }
  return [];
}

export function constraintFeaturesToReferenceLayers(features: ConstraintGeometryFeature[]): GeographicReferenceLayer[] {
  const grouped = new Map<GeographicReferenceLayer["layerId"], GeographicReferenceFeature[]>();
  features.flatMap(constraintFeatureToGeographicFeatures).forEach((feature) => {
    grouped.set(feature.layerId, [...(grouped.get(feature.layerId) ?? []), feature]);
  });
  return Array.from(grouped.entries()).map(([layerId, groupedFeatures]) => ({
    layerId,
    layerType:
      layerId === "streetReference"
        ? "Street Centerlines"
        : layerId === "buildingReference"
          ? "Building Footprints"
          : layerId === "parcelReference"
            ? "Parcel Boundaries"
            : layerId === "railroadReference"
              ? "Railroads"
              : layerId === "waterReference"
                ? "Water Features"
                : "Terrain Reference",
    sourceId: "constraint-geometry-registry",
    label: `Constraint Registry ${layerId}`,
    features: groupedFeatures,
    visibleByDefault: true,
  }));
}

export function streetCenterlinesFromConstraintFeatures(features: ConstraintGeometryFeature[]): StreetCenterline[] {
  return features
    .filter((feature) => feature.layerType === "STREETS")
    .flatMap((feature) => constraintFeatureToGeographicFeatures(feature))
    .filter((feature) => feature.coordinates && feature.coordinates.length >= 2)
    .map((feature) => {
      const registryFeature = (feature.payload as { registryFeature?: ConstraintGeometryFeature } | undefined)?.registryFeature;
      const properties = registryFeature?.properties ?? {};
      return {
        streetId: feature.referenceId,
        streetName: feature.label ?? feature.referenceId,
        streetClass: registryFeature ? streetClassForFeature(registryFeature) : "Local",
        geometry: feature.coordinates ?? [],
        lengthFeet: 0,
        jurisdiction: String(properties.jurisdiction ?? properties.city ?? properties.county ?? "Unknown"),
        speedLimit: Number.isFinite(Number(properties.speedLimit ?? properties.maxspeed)) ? Number(properties.speedLimit ?? properties.maxspeed) : undefined,
        oneWay: booleanProperty(properties.oneway),
        source: "IMPORTED" as const,
      };
    });
}
