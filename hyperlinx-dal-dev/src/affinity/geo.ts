import type { DALCoordinate } from "../types/dal";

export function haversineFeet(a: DALCoordinate, b: DALCoordinate) {
  const r = 6371008.8;
  const toRad = Math.PI / 180;
  const lat1 = a[1] * toRad;
  const lat2 = b[1] * toRad;
  const dLat = (b[1] - a[1]) * toRad;
  const dLon = (b[0] - a[0]) * toRad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h)) * 3.28084;
}

export function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

export function sampledStep(length: number, maxItems: number) {
  return Math.max(1, Math.ceil(length / Math.max(maxItems, 1)));
}

