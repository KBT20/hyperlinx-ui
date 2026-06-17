import type { MapKernelRenderSpec } from "../mapkernel";
import type { DALCoordinate } from "../types/dal";
import { renderReferenceLayer } from "./ReferenceLayerManager";

export type WaterReferenceType = "River" | "Stream" | "Lake" | "Drainage Channel" | "Canal";

export type WaterReference = {
  waterId: string;
  name?: string;
  waterType: WaterReferenceType;
  geometry?: DALCoordinate[];
  boundary?: DALCoordinate[];
};

export function renderWaterReferenceLayer(features: WaterReference[], sourceId = "water-reference"): MapKernelRenderSpec {
  return renderReferenceLayer({
    layerId: "waterReference",
    layerType: "Water Features",
    sourceId,
    label: "Water Feature Reference",
    minZoom: 10,
    features: features
      .filter((feature) => (feature.boundary?.length ?? 0) >= 3 || (feature.geometry?.length ?? 0) >= 2)
      .map((feature) => ({
        referenceId: feature.waterId,
        layerId: "waterReference",
        kind: "WaterReference",
        coordinates: feature.geometry,
        rings: feature.boundary ? [feature.boundary] : undefined,
        label: feature.name ?? feature.waterType,
        payload: { ...feature, authoritative: false, purpose: "Engineering reference only" },
        minZoom: feature.boundary ? 12 : 10,
      })),
  });
}
