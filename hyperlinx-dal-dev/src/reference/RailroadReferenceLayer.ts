import type { MapKernelRenderSpec } from "../mapkernel";
import type { DALCoordinate } from "../types/dal";
import { renderReferenceLayer } from "./ReferenceLayerManager";

export type RailroadReference = {
  railroadId: string;
  name?: string;
  operator?: string;
  geometry: DALCoordinate[];
  crossings?: DALCoordinate[];
};

export function renderRailroadReferenceLayer(railroads: RailroadReference[], sourceId = "railroad-reference"): MapKernelRenderSpec {
  return renderReferenceLayer({
    layerId: "railroadReference",
    layerType: "Railroads",
    sourceId,
    label: "Railroad Reference",
    minZoom: 11,
    features: railroads.flatMap((railroad) => {
      const lineFeature =
        railroad.geometry.length >= 2
          ? [
              {
                referenceId: railroad.railroadId,
                layerId: "railroadReference" as const,
                kind: "RailroadReference" as const,
                coordinates: railroad.geometry,
                label: railroad.name ?? railroad.railroadId,
                payload: { ...railroad, authoritative: false, purpose: "Engineering reference only" },
                minZoom: 11,
              },
            ]
          : [];
      const crossingFeatures = (railroad.crossings ?? []).map((coordinate, index) => ({
        referenceId: `${railroad.railroadId}:crossing:${index}`,
        layerId: "railroadReference" as const,
        kind: "RailroadReference" as const,
        coordinate,
        label: `${railroad.name ?? railroad.railroadId} crossing`,
        payload: { railroadId: railroad.railroadId, coordinate, authoritative: false, purpose: "Crossing reference only" },
        minZoom: 13,
      }));
      return [...lineFeature, ...crossingFeatures];
    }),
  });
}
