import {
  KERNEL_EXECUTION_GRAPH_AUTHORITY,
  KERNEL_EXECUTION_GRAPH_VERSION,
  type ExecutionEdge,
  type ExecutionGraphProjection,
  type ExecutionGraphValidationResult,
  type ExecutionNode,
  type KernelExecutionGraph,
} from "./ExecutionGraphContracts";

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
}

export function stableKernelHash(value: unknown) {
  const text = stableJson(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `KEG-${(hash >>> 0).toString(16).padStart(8, "0").toUpperCase()}`;
}

export function createKernelExecutionGraph(input: {
  packageId: string;
  measuredSpineId: string;
  stationAuthorityId: string;
  stationIndexedGraphId?: string;
  spineAuditProjectionId?: string;
  geometryHash: string;
  generatedAt: string;
  nodes: ExecutionNode[];
  edges: ExecutionEdge[];
  projections: ExecutionGraphProjection[];
  validation: ExecutionGraphValidationResult;
}): KernelExecutionGraph {
  const nodes = [...input.nodes].sort((a, b) => a.nodeId.localeCompare(b.nodeId));
  const edges = [...input.edges].sort((a, b) => a.edgeId.localeCompare(b.edgeId));
  const graphId = `${input.packageId}:KERNEL-EXECUTION-GRAPH:${input.geometryHash}`;
  const identityHash = stableKernelHash({
    packageId: input.packageId,
    geometryHash: input.geometryHash,
    measuredSpineId: input.measuredSpineId,
    stationAuthorityId: input.stationAuthorityId,
    nodeIdentities: nodes.map((node) => ({
      nodeId: node.nodeId,
      sourceArtifactId: node.sourceArtifactId,
      nodeType: node.nodeType,
      parentStationId: node.parentStationId,
      stationId: node.stationId,
    })),
    edgeIdentities: edges.map((edge) => ({
      edgeId: edge.edgeId,
      fromNodeId: edge.fromNodeId,
      toNodeId: edge.toNodeId,
      edgeType: edge.edgeType,
      dependencyClass: edge.dependencyClass,
    })),
  });
  return {
    graphId,
    packageId: input.packageId,
    graphVersion: KERNEL_EXECUTION_GRAPH_VERSION,
    authority: KERNEL_EXECUTION_GRAPH_AUTHORITY,
    sourceEngine: "ExecutionGraphBuilder",
    measuredSpineId: input.measuredSpineId,
    stationAuthorityId: input.stationAuthorityId,
    stationIndexedGraphId: input.stationIndexedGraphId,
    spineAuditProjectionId: input.spineAuditProjectionId,
    geometryHash: input.geometryHash,
    identityHash,
    generatedAt: input.generatedAt,
    nodes,
    edges,
    projections: input.projections,
    validation: input.validation,
    summary: {
      graphId,
      packageId: input.packageId,
      graphVersion: KERNEL_EXECUTION_GRAPH_VERSION,
      nodeCount: nodes.length,
      edgeCount: edges.length,
      stationNodeCount: nodes.filter((node) => node.nodeType === "STATION").length,
      objectNodeCount: nodes.filter((node) => node.parentStationId && node.nodeType !== "STATION" && node.nodeType !== "CLOSURE_EXPECTATION").length,
      closureExpectationNodeCount: nodes.filter((node) => node.nodeType === "CLOSURE_EXPECTATION").length,
      projectionLayerCount: input.projections.length,
      validationStatus: input.validation.status,
      identityHash,
      noScopeVersionCreation: true,
    },
    immutableIdentity: true,
    noScopeVersionCreation: true,
  };
}
