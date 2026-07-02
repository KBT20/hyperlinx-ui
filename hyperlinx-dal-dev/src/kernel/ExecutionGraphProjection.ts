import {
  EXECUTION_GRAPH_PROJECTION_LAYERS,
  KERNEL_EXECUTION_GRAPH_AUTHORITY,
  type ExecutionGraphProjection,
  type ExecutionGraphProjectionLayer,
  type ExecutionNode,
  type KernelExecutionGraph,
} from "./ExecutionGraphContracts";

export const kernelExecutionGraphProjectionLayers = EXECUTION_GRAPH_PROJECTION_LAYERS;

function nodeInLayer(node: ExecutionNode, layer: ExecutionGraphProjectionLayer) {
  return node.projectionLayers.includes(layer);
}

export function projectKernelExecutionGraph(
  graph: Pick<KernelExecutionGraph, "graphId" | "packageId" | "nodes" | "edges">,
  layer: ExecutionGraphProjectionLayer,
  generatedAt: string,
): ExecutionGraphProjection {
  const nodeIds = new Set(graph.nodes.filter((node) => nodeInLayer(node, layer)).map((node) => node.nodeId));
  const edgeIds = graph.edges
    .filter((edge) => edge.projectionLayers.includes(layer) && nodeIds.has(edge.fromNodeId) && nodeIds.has(edge.toNodeId))
    .map((edge) => edge.edgeId);
  return {
    projectionId: `${graph.graphId}:PROJECTION:${layer}`,
    sourceGraphId: graph.graphId,
    packageId: graph.packageId,
    layer,
    nodeIds: Array.from(nodeIds).sort(),
    edgeIds: edgeIds.sort(),
    nodeCount: nodeIds.size,
    edgeCount: edgeIds.length,
    authority: KERNEL_EXECUTION_GRAPH_AUTHORITY,
    generatedAt,
  };
}

export function buildKernelExecutionGraphProjections(
  graph: Pick<KernelExecutionGraph, "graphId" | "packageId" | "nodes" | "edges">,
  generatedAt: string,
) {
  return EXECUTION_GRAPH_PROJECTION_LAYERS.map((layer) => projectKernelExecutionGraph(graph, layer, generatedAt));
}

export function findExecutionNode(graph: KernelExecutionGraph, nodeId: string) {
  return graph.nodes.find((node) => node.nodeId === nodeId) ??
    graph.nodes.find((node) => node.nodeType === "STATION" && node.stationId === nodeId) ??
    graph.nodes.find((node) => node.sourceArtifactId === nodeId || node.stationId === nodeId);
}
