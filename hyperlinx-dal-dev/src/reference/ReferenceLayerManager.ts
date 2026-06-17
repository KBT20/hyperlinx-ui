import type { MapFeatureKind, MapKernelPrimitive, MapKernelRenderSpec, MapLayerId } from "../mapkernel";
import type { DALCoordinate } from "../types/dal";

export type GeographicReferenceLayerId =
  | "streetReference"
  | "buildingReference"
  | "parcelReference"
  | "railroadReference"
  | "waterReference"
  | "terrainReference";

export type GeographicReferenceLayerType =
  | "Street Centerlines"
  | "Building Footprints"
  | "Parcel Boundaries"
  | "Railroads"
  | "Water Features"
  | "Terrain Reference";

export type GeographicReferenceFeatureKind =
  | "StreetReference"
  | "BuildingReference"
  | "ParcelReference"
  | "RailroadReference"
  | "WaterReference"
  | "TerrainReference";

export type ReferenceGeometry = {
  coordinate?: DALCoordinate;
  coordinates?: DALCoordinate[];
  rings?: DALCoordinate[][];
};

export type GeographicReferenceFeature = ReferenceGeometry & {
  referenceId: string;
  layerId: GeographicReferenceLayerId;
  kind: GeographicReferenceFeatureKind;
  label?: string;
  payload?: unknown;
  minZoom?: number;
  maxZoom?: number;
};

export type GeographicReferenceLayer = {
  layerId: GeographicReferenceLayerId;
  layerType: GeographicReferenceLayerType;
  sourceId: string;
  label: string;
  features: GeographicReferenceFeature[];
  visibleByDefault?: boolean;
  minZoom?: number;
  maxZoom?: number;
};

export const GEOGRAPHIC_REFERENCE_LAYER_IDS: GeographicReferenceLayerId[] = [
  "streetReference",
  "buildingReference",
  "parcelReference",
  "railroadReference",
  "waterReference",
  "terrainReference",
];

export function isGeographicReferenceLayerId(layerId: MapLayerId): layerId is GeographicReferenceLayerId {
  return (GEOGRAPHIC_REFERENCE_LAYER_IDS as string[]).includes(layerId);
}

function primitiveKindFor(feature: GeographicReferenceFeature): MapKernelPrimitive["kind"] {
  if (feature.rings?.length) return "polygon";
  if (feature.coordinates?.length) return "line";
  return "point";
}

export function renderReferenceLayer(layer: GeographicReferenceLayer): MapKernelRenderSpec {
  const primitives: MapKernelPrimitive[] = layer.features.map((feature) => ({
    id: feature.referenceId,
    layerId: feature.layerId,
    kind: primitiveKindFor(feature),
    coordinate: feature.coordinate,
    coordinates: feature.coordinates,
    rings: feature.rings,
    label: feature.label,
    payload: feature.payload,
    metadata: {
      referenceLayer: true,
      source: "geographic-reference",
      sourceLayer: feature.layerId,
      renderAuthority: "Geographic Reference",
      minZoom: feature.minZoom ?? layer.minZoom,
      maxZoom: feature.maxZoom ?? layer.maxZoom,
      selectable: true,
    },
    ref: {
      kind: feature.kind as MapFeatureKind,
      id: feature.referenceId,
      scopeVersionId: layer.sourceId,
      sourceLayer: feature.layerId,
    },
  }));

  return {
    specId: `reference:${layer.layerId}:${layer.sourceId}`,
    sourceType: "Manual",
    sourceId: layer.sourceId,
    name: layer.label,
    primitives,
    metadata: {
      referenceLayer: true,
      layerId: layer.layerId,
      layerType: layer.layerType,
      featureCount: layer.features.length,
      sourceLayer: layer.layerId,
    },
  };
}

export function renderReferenceLayers(layers: GeographicReferenceLayer[]) {
  return layers.filter((layer) => layer.features.length).map(renderReferenceLayer);
}
