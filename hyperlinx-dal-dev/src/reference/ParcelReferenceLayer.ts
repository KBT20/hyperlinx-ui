import type { MapKernelRenderSpec } from "../mapkernel";
import type { DALCoordinate } from "../types/dal";
import { renderReferenceLayer } from "./ReferenceLayerManager";

export type ParcelReference = {
  parcelId: string;
  ownerName?: string;
  boundary: DALCoordinate[];
  jurisdiction?: string;
};

export function renderParcelReferenceLayer(parcels: ParcelReference[], sourceId = "parcel-reference"): MapKernelRenderSpec {
  return renderReferenceLayer({
    layerId: "parcelReference",
    layerType: "Parcel Boundaries",
    sourceId,
    label: "Parcel Boundary Reference",
    minZoom: 15,
    features: parcels
      .filter((parcel) => parcel.boundary.length >= 3)
      .map((parcel) => ({
        referenceId: parcel.parcelId,
        layerId: "parcelReference",
        kind: "ParcelReference",
        rings: [parcel.boundary],
        label: parcel.parcelId,
        payload: { ...parcel, authoritative: false, purpose: "Engineering reference only" },
        minZoom: 15,
      })),
  });
}
