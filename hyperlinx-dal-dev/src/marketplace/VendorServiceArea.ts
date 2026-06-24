export type VendorServiceAreaType =
  | "NATIONAL"
  | "REGIONAL"
  | "STATE"
  | "MSA"
  | "COUNTY"
  | "CORRIDOR"
  | "POLYGON";

export interface VendorPolygonCoverage {
  geometryType: "POLYGON";
  coordinates: number[][][];
  source?: string;
}

export interface VendorServiceArea {
  serviceAreaId: string;
  name: string;
  areaType: VendorServiceAreaType;
  country?: string;
  regions?: string[];
  states?: string[];
  msas?: string[];
  counties?: string[];
  corridors?: string[];
  polygon?: VendorPolygonCoverage;
  notes?: string;
}

export function vendorServiceAreaMatchesRegion(serviceArea: VendorServiceArea, region: string): boolean {
  const normalizedRegion = region.trim().toLowerCase();
  if (!normalizedRegion) return false;

  const candidates = [
    serviceArea.name,
    serviceArea.country,
    ...(serviceArea.regions ?? []),
    ...(serviceArea.states ?? []),
    ...(serviceArea.msas ?? []),
    ...(serviceArea.counties ?? []),
    ...(serviceArea.corridors ?? []),
  ];

  return candidates.some((candidate) => candidate?.toLowerCase() === normalizedRegion);
}

