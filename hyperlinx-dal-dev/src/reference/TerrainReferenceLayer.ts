import type { MapKernelRenderSpec } from "../mapkernel";
import type { DALCoordinate } from "../types/dal";
import { renderReferenceLayer } from "./ReferenceLayerManager";

export type TerrainReference = {
  terrainId: string;
  label?: string;
  boundary: DALCoordinate[];
  terrainClass?: string;
};

export function renderTerrainReferenceLayer(features: TerrainReference[], sourceId = "terrain-reference"): MapKernelRenderSpec {
  return renderReferenceLayer({
    layerId: "terrainReference",
    layerType: "Terrain Reference",
    sourceId,
    label: "Terrain Reference",
    minZoom: 9,
    features: features
      .filter((feature) => feature.boundary.length >= 3)
      .map((feature) => ({
        referenceId: feature.terrainId,
        layerId: "terrainReference",
        kind: "TerrainReference",
        rings: [feature.boundary],
        label: feature.label ?? feature.terrainClass ?? feature.terrainId,
        payload: { ...feature, authoritative: false, purpose: "Engineering reference only" },
        minZoom: 9,
      })),
  });
}
