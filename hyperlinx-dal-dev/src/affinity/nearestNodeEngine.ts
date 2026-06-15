import type { DALCoordinate, InventoryGraph, InventoryNode } from "../types/dal";
import type { NearestNodeResult } from "../types/networkAffinity";
import { haversineFeet, sampledStep } from "./geo";

export function findNearestNode(graph: InventoryGraph, target: DALCoordinate, maxNodes = 40000): NearestNodeResult {
  let best: { node: InventoryNode; distanceFeet: number } | null = null;
  const step = sampledStep(graph.nodes.length, maxNodes);
  for (let index = 0; index < graph.nodes.length; index += step) {
    const node = graph.nodes[index];
    if (!node) continue;
    const distanceFeet = haversineFeet([node.lon, node.lat], target);
    if (!best || distanceFeet < best.distanceFeet) best = { node, distanceFeet };
  }
  return {
    nodeId: best?.node.nodeId,
    coordinate: best ? [best.node.lon, best.node.lat] : undefined,
    distanceFeet: best?.distanceFeet ?? Infinity,
  };
}

