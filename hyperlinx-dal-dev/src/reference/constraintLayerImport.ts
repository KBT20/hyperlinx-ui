import {
  boundsForConstraintFeatures,
  registerConstraintLayer,
  type ConstraintAuthority,
  type ConstraintCertificationUse,
  type ConstraintGeometryFeature,
  type ConstraintGeometryType,
  type ConstraintReferenceLayer,
  type ConstraintReferenceLayerType,
} from "./ConstraintGeometryRegistry";

type ImportGeoJsonConstraintLayerArgs = {
  layerType: Extract<ConstraintReferenceLayerType, "WATER" | "RAILROADS" | "BUILDINGS" | "PARCELS" | "STREETS">;
  authority: ConstraintAuthority;
  certificationUse: ConstraintCertificationUse;
  sourceName: string;
  sourceUrl?: string;
  geojson: unknown;
  notes?: string;
};

type RegisterGeoJsonConstraintLayerArgs = Omit<ImportGeoJsonConstraintLayerArgs, "geojson"> & {
  text: string;
};

type GeoJsonGeometry = {
  type?: string;
  coordinates?: unknown;
  geometries?: GeoJsonGeometry[];
};

type GeoJsonFeature = {
  type?: string;
  id?: string | number;
  geometry?: GeoJsonGeometry | null;
  properties?: Record<string, unknown> | null;
};

function nowIso() {
  return new Date().toISOString();
}

function safeId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "constraint-layer";
}

function createLayerId(layerType: ConstraintReferenceLayerType, sourceName: string) {
  return `constraint-${layerType.toLowerCase()}-${safeId(sourceName)}-${Date.now()}`;
}

function geometryType(value: string | undefined): ConstraintGeometryType | null {
  const normalized = String(value ?? "").toUpperCase();
  if (normalized === "POINT") return "POINT";
  if (normalized === "LINESTRING") return "LINESTRING";
  if (normalized === "POLYGON") return "POLYGON";
  if (normalized === "MULTILINESTRING") return "MULTILINESTRING";
  if (normalized === "MULTIPOLYGON") return "MULTIPOLYGON";
  return null;
}

function geometryCoordinates(geometry: GeoJsonGeometry | null | undefined) {
  return geometry?.coordinates;
}

function normalizeFeatures(value: unknown): GeoJsonFeature[] {
  const source = value as { type?: string; features?: GeoJsonFeature[]; geometry?: GeoJsonGeometry; properties?: Record<string, unknown> };
  if (source?.type === "FeatureCollection" && Array.isArray(source.features)) return source.features;
  if (source?.type === "Feature") return [source as GeoJsonFeature];
  if (source?.type === "GeometryCollection" && Array.isArray((source as GeoJsonGeometry).geometries)) {
    return ((source as GeoJsonGeometry).geometries ?? []).map((geometry, index) => ({
      type: "Feature",
      id: `geometry-${index + 1}`,
      geometry,
      properties: {},
    }));
  }
  if (source?.type && "coordinates" in source) return [{ type: "Feature", id: "geometry-1", geometry: source as GeoJsonGeometry, properties: {} }];
  return [];
}

function expandGeometryCollection(feature: GeoJsonFeature) {
  if (feature.geometry?.type !== "GeometryCollection") return [feature];
  return (feature.geometry.geometries ?? []).map((geometry, index) => ({
    ...feature,
    id: `${feature.id ?? "feature"}:geometry-${index + 1}`,
    geometry,
  }));
}

function featureProperties(feature: GeoJsonFeature) {
  return feature.properties && typeof feature.properties === "object" ? feature.properties : {};
}

export function importGeoJsonConstraintLayer(args: ImportGeoJsonConstraintLayerArgs): {
  layer: ConstraintReferenceLayer;
  features: ConstraintGeometryFeature[];
} {
  const layerId = createLayerId(args.layerType, args.sourceName);
  const expandedFeatures = normalizeFeatures(args.geojson).flatMap(expandGeometryCollection);
  const features: ConstraintGeometryFeature[] = expandedFeatures.flatMap((feature, index) => {
    const type = geometryType(feature.geometry?.type);
    const geometry = geometryCoordinates(feature.geometry);
    if (!type || geometry === undefined || geometry === null) return [];
    const properties = featureProperties(feature);
    return [
      {
        featureId: String(feature.id ?? properties.id ?? properties.ID ?? `${layerId}:feature-${index + 1}`),
        layerId,
        layerType: args.layerType,
        geometryType: type,
        geometry,
        properties,
        authority: args.authority,
        usableForCertification: args.certificationUse === "USABLE_FOR_CERTIFICATION",
      },
    ];
  });
  const timestamp = nowIso();
  const layer: ConstraintReferenceLayer = {
    layerId,
    layerType: args.layerType,
    status: features.length ? "LOADED" : "FAILED",
    certificationUse: args.certificationUse,
    authority: args.authority,
    sourceName: args.sourceName,
    sourceUrl: args.sourceUrl,
    featureCount: features.length,
    coverage: {
      bbox: boundsForConstraintFeatures(features),
    },
    loadedAt: features.length ? timestamp : undefined,
    lastUpdated: timestamp,
    notes: features.length ? args.notes : "GeoJSON import produced no supported constraint geometries.",
  };
  return { layer, features };
}

export function registerGeoJsonConstraintLayer(args: RegisterGeoJsonConstraintLayerArgs) {
  const geojson = JSON.parse(args.text) as unknown;
  const result = importGeoJsonConstraintLayer({ ...args, geojson });
  return {
    layer: registerConstraintLayer(result.layer, result.features),
    features: result.features,
  };
}

export function importKmlKmzConstraintLayer(): never {
  throw new Error("KML/KMZ constraint layer import is not yet implemented.");
}

export function importShapefileConstraintLayer(): never {
  throw new Error("Shapefile constraint layer import is not yet implemented.");
}

export function createManualConstraintFeature(args: {
  featureId: string;
  layerId: string;
  layerType: ConstraintReferenceLayerType;
  geometryType: ConstraintGeometryType;
  geometry: unknown;
  properties?: Record<string, unknown>;
  authority?: ConstraintAuthority;
  usableForCertification?: boolean;
}): ConstraintGeometryFeature {
  return {
    featureId: args.featureId,
    layerId: args.layerId,
    layerType: args.layerType,
    geometryType: args.geometryType,
    geometry: args.geometry,
    properties: args.properties ?? {},
    authority: args.authority ?? "MANUAL",
    usableForCertification: args.usableForCertification ?? false,
  };
}
