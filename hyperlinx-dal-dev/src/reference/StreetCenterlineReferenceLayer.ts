import { haversineFeet } from "../affinity/geo";
import type { MapKernelRenderSpec } from "../mapkernel";
import type { DALCoordinate } from "../types/dal";
import { renderReferenceLayer } from "./ReferenceLayerManager";

export type StreetReferenceClass = "Interstate" | "Highway" | "Arterial" | "Collector" | "Local" | "Private";

export type StreetCenterlineReference = {
  streetId: string;
  streetName: string;
  streetClass: StreetReferenceClass;
  geometry: DALCoordinate[];
  jurisdiction: string;
};

function normalizeStreetClass(value?: string): StreetReferenceClass {
  const normalized = String(value ?? "").toLowerCase();
  if (normalized.includes("interstate")) return "Interstate";
  if (normalized.includes("highway") || normalized.includes("state") || normalized.includes("us ")) return "Highway";
  if (normalized.includes("arterial")) return "Arterial";
  if (normalized.includes("collector")) return "Collector";
  if (normalized.includes("private")) return "Private";
  return "Local";
}

export function createStreetCenterlineReference(args: {
  streetId: string;
  streetName?: string;
  streetClass?: string;
  geometry: DALCoordinate[];
  jurisdiction?: string;
}): StreetCenterlineReference {
  return {
    streetId: args.streetId,
    streetName: args.streetName?.trim() || "Unnamed street reference",
    streetClass: normalizeStreetClass(args.streetClass),
    geometry: args.geometry,
    jurisdiction: args.jurisdiction ?? "Unknown",
  };
}

export function streetReferenceLengthFeet(street: StreetCenterlineReference) {
  let total = 0;
  for (let index = 1; index < street.geometry.length; index += 1) total += haversineFeet(street.geometry[index - 1], street.geometry[index]);
  return Math.round(total);
}

export function renderStreetCenterlineReferenceLayer(streets: StreetCenterlineReference[], sourceId = "street-reference"): MapKernelRenderSpec {
  return renderReferenceLayer({
    layerId: "streetReference",
    layerType: "Street Centerlines",
    sourceId,
    label: "Street Centerline Reference",
    minZoom: 13,
    features: streets
      .filter((street) => street.geometry.length >= 2)
      .map((street) => ({
        referenceId: street.streetId,
        layerId: "streetReference",
        kind: "StreetReference",
        coordinates: street.geometry,
        label: street.streetName,
        payload: {
          ...street,
          lengthFeet: streetReferenceLengthFeet(street),
          authoritative: false,
          purpose: "Engineering reference only",
        },
        minZoom: 13,
      })),
  });
}
