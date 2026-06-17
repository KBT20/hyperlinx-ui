import { createContext } from "react";
import type { DALCoordinate } from "../types/dal";
import type { MapKernelPrimitive } from "./MapLayerManager";

export type MapBounds = {
  west: number;
  south: number;
  east: number;
  north: number;
};

export type MapViewportMode = "FIT_SCOPEVERSION" | "FIT_CORRIDOR" | "FIT_ROUTE" | "FIT_SELECTION" | "MANUAL";

export type MapViewportRequest = {
  mode: MapViewportMode;
  bounds?: MapBounds;
  targetId?: string;
  requestedAt: string;
};

export type MapViewportContextValue = {
  viewportRequest: MapViewportRequest | null;
  requestViewport: (request: MapViewportRequest | null) => void;
};

export const MapViewportContext = createContext<MapViewportContextValue>({
  viewportRequest: null,
  requestViewport: () => undefined,
});

export function isValidCoordinate(coordinate: unknown): coordinate is DALCoordinate {
  if (!Array.isArray(coordinate) || coordinate.length < 2) return false;
  const lon = Number(coordinate[0]);
  const lat = Number(coordinate[1]);
  return Number.isFinite(lon) && Number.isFinite(lat) && lon >= -180 && lon <= 180 && lat >= -90 && lat <= 90;
}

export function createBounds(coordinates: DALCoordinate[]): MapBounds | null {
  const valid = coordinates.filter(isValidCoordinate);
  if (!valid.length) return null;
  return valid.reduce<MapBounds>(
    (bounds, [lon, lat]) => ({
      west: Math.min(bounds.west, lon),
      south: Math.min(bounds.south, lat),
      east: Math.max(bounds.east, lon),
      north: Math.max(bounds.north, lat),
    }),
    { west: valid[0][0], south: valid[0][1], east: valid[0][0], north: valid[0][1] }
  );
}

export function expandBounds(bounds: MapBounds, paddingRatio = 0.08): MapBounds {
  const width = Math.max(bounds.east - bounds.west, 0.0001);
  const height = Math.max(bounds.north - bounds.south, 0.0001);
  return {
    west: bounds.west - width * paddingRatio,
    south: bounds.south - height * paddingRatio,
    east: bounds.east + width * paddingRatio,
    north: bounds.north + height * paddingRatio,
  };
}

export function boundsFromPrimitives(primitives: MapKernelPrimitive[]): MapBounds | null {
  const coordinates: DALCoordinate[] = [];
  primitives.forEach((primitive) => {
    if (primitive.coordinate) coordinates.push(primitive.coordinate);
    if (primitive.coordinates) coordinates.push(...primitive.coordinates);
    if (primitive.rings) primitive.rings.forEach((ring) => coordinates.push(...ring));
  });
  const bounds = createBounds(coordinates);
  return bounds ? expandBounds(bounds) : null;
}

export function viewportRequest(mode: MapViewportMode, bounds?: MapBounds, targetId?: string): MapViewportRequest {
  return {
    mode,
    bounds,
    targetId,
    requestedAt: new Date().toISOString(),
  };
}
