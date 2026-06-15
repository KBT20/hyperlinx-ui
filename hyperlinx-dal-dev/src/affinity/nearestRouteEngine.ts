import type { DALCoordinate, InventoryGraph, InventoryRoute } from "../types/dal";
import type { NearestRouteResult } from "../types/networkAffinity";
import { haversineFeet, sampledStep } from "./geo";

export function findNearestRoute(graph: InventoryGraph, target: DALCoordinate, maxRoutes = 12000, maxCoordsPerRoute = 160): NearestRouteResult {
  let best: { route: InventoryRoute; coordinate: DALCoordinate; distanceFeet: number } | null = null;
  const routeStep = sampledStep(graph.routes.length, maxRoutes);
  for (let routeIndex = 0; routeIndex < graph.routes.length; routeIndex += routeStep) {
    const route = graph.routes[routeIndex];
    if (!route?.coordinates?.length) continue;
    const coordStep = sampledStep(route.coordinates.length, maxCoordsPerRoute);
    for (let coordIndex = 0; coordIndex < route.coordinates.length; coordIndex += coordStep) {
      const coordinate = route.coordinates[coordIndex];
      const distanceFeet = haversineFeet(coordinate, target);
      if (!best || distanceFeet < best.distanceFeet) best = { route, coordinate, distanceFeet };
    }
  }
  return {
    routeId: best?.route.routeId,
    routeName: best?.route.name,
    coordinate: best?.coordinate,
    distanceFeet: best?.distanceFeet ?? Infinity,
  };
}

