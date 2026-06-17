import type { DALCoordinate } from "../types/dal";

const TILE_SIZE = 256;
const MAX_LAT = 85.05112878;

export function clampLatitude(latitude: number) {
  return Math.max(-MAX_LAT, Math.min(MAX_LAT, latitude));
}

export function isCoordinate(value: unknown): value is DALCoordinate {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    Number.isFinite(Number(value[0])) &&
    Number.isFinite(Number(value[1])) &&
    Math.abs(Number(value[0])) <= 180 &&
    Math.abs(Number(value[1])) <= 90
  );
}

export function lonLatToWorld(coordinate: DALCoordinate, zoom: number) {
  const [lon, latRaw] = coordinate;
  const lat = clampLatitude(latRaw);
  const scale = TILE_SIZE * 2 ** zoom;
  const sinLat = Math.sin((lat * Math.PI) / 180);
  return {
    x: ((lon + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale,
  };
}

export function worldToLonLat(point: { x: number; y: number }, zoom: number): DALCoordinate {
  const scale = TILE_SIZE * 2 ** zoom;
  const lon = (point.x / scale) * 360 - 180;
  const mercatorN = Math.PI - (2 * Math.PI * point.y) / scale;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(mercatorN) - Math.exp(-mercatorN)));
  return [lon, clampLatitude(lat)];
}

export function worldToTile(value: number) {
  return Math.floor(value / TILE_SIZE);
}

export function tileCount(zoom: number) {
  return 2 ** zoom;
}

export function normalizeTileX(x: number, zoom: number) {
  const count = tileCount(zoom);
  return ((x % count) + count) % count;
}

export function validTileY(y: number, zoom: number) {
  return y >= 0 && y < tileCount(zoom);
}

export function boundsFromCoordinates(coordinates: DALCoordinate[]) {
  const valid = coordinates.filter(isCoordinate);
  if (!valid.length) return null;
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  valid.forEach(([lon, lat]) => {
    minLon = Math.min(minLon, lon);
    minLat = Math.min(minLat, lat);
    maxLon = Math.max(maxLon, lon);
    maxLat = Math.max(maxLat, lat);
  });
  return { minLon, minLat, maxLon, maxLat };
}

export function centerFromCoordinates(coordinates: DALCoordinate[], fallback: DALCoordinate = [-97.7431, 30.2672]) {
  const bounds = boundsFromCoordinates(coordinates);
  if (!bounds) return fallback;
  return [(bounds.minLon + bounds.maxLon) / 2, (bounds.minLat + bounds.maxLat) / 2] as DALCoordinate;
}

export function zoomForCoordinates(coordinates: DALCoordinate[], width: number, height: number) {
  const bounds = boundsFromCoordinates(coordinates);
  if (!bounds) return 6;
  const lonSpan = Math.max(bounds.maxLon - bounds.minLon, 0.00008);
  const latSpan = Math.max(bounds.maxLat - bounds.minLat, 0.00008);
  const lonZoom = Math.log2((width * 360) / (lonSpan * TILE_SIZE));
  const latZoom = Math.log2((height * 170) / (latSpan * TILE_SIZE));
  return Math.max(4, Math.min(19, Math.floor(Math.min(lonZoom, latZoom) - 1)));
}

export function pathData(coordinates: DALCoordinate[], project: (coordinate: DALCoordinate) => { x: number; y: number }) {
  return coordinates
    .filter(isCoordinate)
    .map((coordinate, index) => {
      const point = project(coordinate);
      return `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`;
    })
    .join(" ");
}
