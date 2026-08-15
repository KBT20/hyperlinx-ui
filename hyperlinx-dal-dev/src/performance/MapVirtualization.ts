import type { DALCoordinate } from "../types/dal";

export type MapLevelOfDetail = "LOW" | "MEDIUM" | "HIGH";

export type ViewportBounds = {
  west: number;
  south: number;
  east: number;
  north: number;
};

export type VirtualizedGeometryResult = {
  lod: MapLevelOfDetail;
  repositoryGeometryCount: number;
  simplifiedGeometryCount: number;
  viewportGeometryCount: number;
  geometry: DALCoordinate[];
};

export function mapLevelOfDetail(zoom: number): MapLevelOfDetail {
  if (zoom < 10) return "LOW";
  if (zoom < 14) return "MEDIUM";
  return "HIGH";
}

export function simplifyGeometryForZoom(geometry: DALCoordinate[], zoom: number) {
  if (geometry.length <= 2) return geometry;
  const lod = mapLevelOfDetail(zoom);
  const step = lod === "LOW" ? Math.max(1, Math.ceil(geometry.length / 250)) : lod === "MEDIUM" ? Math.max(1, Math.ceil(geometry.length / 900)) : 1;
  if (step <= 1) return geometry;
  const simplified = geometry.filter((_, index) => index === 0 || index === geometry.length - 1 || index % step === 0);
  return simplified.at(-1) === geometry.at(-1) ? simplified : [...simplified, geometry.at(-1)!];
}

export function coordinateInBounds(coordinate: DALCoordinate, bounds: ViewportBounds, padDegrees = 0.05) {
  const [lon, lat] = coordinate;
  return lon >= bounds.west - padDegrees &&
    lon <= bounds.east + padDegrees &&
    lat >= bounds.south - padDegrees &&
    lat <= bounds.north + padDegrees;
}

export function geometryForViewport(geometry: DALCoordinate[], bounds: ViewportBounds | null, zoom: number): VirtualizedGeometryResult {
  const simplifiedGeometry = simplifyGeometryForZoom(geometry, zoom);
  const viewportGeometry = bounds
    ? simplifiedGeometry.filter((coordinate, index) => (
        index === 0 ||
        index === simplifiedGeometry.length - 1 ||
        coordinateInBounds(coordinate, bounds)
      ))
    : simplifiedGeometry;
  return {
    lod: mapLevelOfDetail(zoom),
    repositoryGeometryCount: geometry.length,
    simplifiedGeometryCount: simplifiedGeometry.length,
    viewportGeometryCount: viewportGeometry.length,
    geometry: viewportGeometry.length >= 2 ? viewportGeometry : simplifiedGeometry.slice(0, 2),
  };
}

export function shouldRenderStationLabels(zoom: number) {
  return mapLevelOfDetail(zoom) === "HIGH";
}

export function shouldRenderMinorObjects(zoom: number) {
  return mapLevelOfDetail(zoom) === "HIGH";
}

export function shouldRenderMajorStations(zoom: number) {
  return mapLevelOfDetail(zoom) !== "LOW";
}
