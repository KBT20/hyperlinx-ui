import type { InventoryGraph } from "../types/dal";
import type { GraphExtension } from "../types/graphExtension";

export type GraphDiffSummary = {
  inventoryId?: string;
  graphId?: string;
  extensionIds: string[];
  addedNodeCount: number;
  addedEdgeCount: number;
  addedRouteCount: number;
  addedStationCount: number;
  addedFeet: number;
  addedNodes: string[];
  addedEdges: string[];
  addedRoutes: string[];
  addedStations: string[];
};

export function diffInventoryGraphExtensions(graph: InventoryGraph | null, extensions: GraphExtension[]): GraphDiffSummary {
  const addedFeet = extensions.reduce((sum, extension) => {
    const edgeFeet = extension.edges.reduce((edgeSum, edge) => edgeSum + Number(edge.lengthFeet || 0), 0);
    const routeFeet = extension.routes.reduce((routeSum, route) => routeSum + Number(route.lengthFeet || 0), 0);
    return sum + (edgeFeet || routeFeet);
  }, 0);

  return {
    inventoryId: graph?.inventoryId ?? extensions[0]?.inventoryId,
    graphId: graph?.graphId ?? extensions[0]?.graphId,
    extensionIds: extensions.map((extension) => extension.extensionId),
    addedNodeCount: extensions.reduce((sum, extension) => sum + extension.nodes.length, 0),
    addedEdgeCount: extensions.reduce((sum, extension) => sum + extension.edges.length, 0),
    addedRouteCount: extensions.reduce((sum, extension) => sum + extension.routes.length, 0),
    addedStationCount: extensions.reduce((sum, extension) => sum + extension.stations.length, 0),
    addedFeet,
    addedNodes: extensions.flatMap((extension) => extension.nodes.map((node) => node.extensionNodeId)),
    addedEdges: extensions.flatMap((extension) => extension.edges.map((edge) => edge.extensionEdgeId)),
    addedRoutes: extensions.flatMap((extension) => extension.routes.map((route) => route.extensionRouteId)),
    addedStations: extensions.flatMap((extension) => extension.stations.map((station) => station.extensionStationId)),
  };
}

export function formatGraphDiffSummary(summary: GraphDiffSummary) {
  return `+${summary.addedNodeCount.toLocaleString()} nodes +${summary.addedEdgeCount.toLocaleString()} edges +${summary.addedRouteCount.toLocaleString()} routes +${summary.addedStationCount.toLocaleString()} stations +${Math.round(summary.addedFeet).toLocaleString()} ft`;
}
