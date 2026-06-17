import type { MapKernelRenderSpec } from "../mapkernel";
import type { DALCoordinate } from "../types/dal";
import { renderReferenceLayer } from "./ReferenceLayerManager";

export type BuildingReference = {
  buildingId: string;
  name?: string;
  footprint: DALCoordinate[];
  structureType?: string;
};

export function renderBuildingReferenceLayer(buildings: BuildingReference[], sourceId = "building-reference"): MapKernelRenderSpec {
  return renderReferenceLayer({
    layerId: "buildingReference",
    layerType: "Building Footprints",
    sourceId,
    label: "Building Footprint Reference",
    minZoom: 16,
    features: buildings
      .filter((building) => building.footprint.length >= 3)
      .map((building) => ({
        referenceId: building.buildingId,
        layerId: "buildingReference",
        kind: "BuildingReference",
        rings: [building.footprint],
        label: building.name ?? building.buildingId,
        payload: { ...building, authoritative: false, purpose: "Engineering reference only" },
        minZoom: 16,
      })),
  });
}
