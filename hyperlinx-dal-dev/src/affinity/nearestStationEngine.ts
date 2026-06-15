import type { DALCoordinate, InventoryGraph, InventoryStation } from "../types/dal";
import type { NearestStationResult } from "../types/networkAffinity";
import { haversineFeet, sampledStep } from "./geo";

export function findNearestStation(graph: InventoryGraph, target: DALCoordinate, maxStations = 40000): NearestStationResult {
  let best: { station: InventoryStation; distanceFeet: number } | null = null;
  const step = sampledStep(graph.stations.length, maxStations);
  for (let index = 0; index < graph.stations.length; index += step) {
    const station = graph.stations[index];
    if (!station) continue;
    const distanceFeet = haversineFeet([station.lon, station.lat], target);
    if (!best || distanceFeet < best.distanceFeet) best = { station, distanceFeet };
  }
  return {
    stationId: best?.station.stationId,
    routeId: best?.station.routeId,
    coordinate: best ? [best.station.lon, best.station.lat] : undefined,
    distanceFeet: best?.distanceFeet ?? Infinity,
  };
}

