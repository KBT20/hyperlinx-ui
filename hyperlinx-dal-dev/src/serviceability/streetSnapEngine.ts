import { haversineFeet } from "../affinity/geo";
import type { DALCoordinate } from "../types/dal";

export type StreetSnapInput = {
  siteLat: number;
  siteLon: number;
};

export type StreetSnapResult = {
  snapPoint: {
    lat: number;
    lon: number;
  };
  roadName?: string;
  roadClass?: string;
  snapDistanceFeet: number;
  confidence: number;
  snapMethod: "DETERMINISTIC_ROW_GRID";
};

function validCoordinate(lat: number, lon: number) {
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
}

export function snapSiteToStreet(input: StreetSnapInput): StreetSnapResult | null {
  if (!validCoordinate(input.siteLat, input.siteLon)) return null;
  const siteCoordinate: DALCoordinate = [input.siteLon, input.siteLat];
  const grid = 0.00045;
  const eastWestLon = Math.round(input.siteLon / grid) * grid;
  const northSouthLat = Math.round(input.siteLat / grid) * grid;
  const eastWest: DALCoordinate = [eastWestLon, input.siteLat];
  const northSouth: DALCoordinate = [input.siteLon, northSouthLat];
  const eastWestDistance = haversineFeet(siteCoordinate, eastWest);
  const northSouthDistance = haversineFeet(siteCoordinate, northSouth);
  const snap = eastWestDistance <= northSouthDistance ? eastWest : northSouth;
  const snapDistanceFeet = Math.min(eastWestDistance, northSouthDistance);
  return {
    snapPoint: { lon: snap[0], lat: snap[1] },
    roadName: "Deterministic ROW grid",
    roadClass: "FALLBACK_LOCAL_GRID",
    snapDistanceFeet: Math.round(snapDistanceFeet),
    confidence: 0.42,
    snapMethod: "DETERMINISTIC_ROW_GRID",
  };
}
