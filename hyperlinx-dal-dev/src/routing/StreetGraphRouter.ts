import { haversineFeet } from "../affinity/geo";
import type { MapKernelRenderSpec } from "../mapkernel";
import type { StreetCenterline } from "../street/streetTypes";
import type { DALCoordinate } from "../types/dal";

export type StreetGraphRouteStatus = "VALID" | "ROUTE_NOT_FOUND" | "INVALID";
export type StreetGraphRouteFailureReason =
  | "NO_STREET_GRAPH"
  | "NO_ATTACHMENT_FOUND"
  | "NO_REACHABLE_PATH"
  | "DISCONNECTED_GRAPH"
  | "INVALID_CANDIDATE"
  | "INVALID_STREET_GRAPH"
  | "EMPTY_STREET_GRAPH"
  | "SNAP_FAILURE";

export type RoutingAudit = {
  routingEngine: "StreetGraphRouter";
  graphNodes: number;
  graphEdges: number;
  startNode?: string;
  endNode?: string;
  pathFound: boolean;
  pathNodeCount: number;
  pathEdgeCount: number;
  pathSegmentCount: number;
  totalTraversedLength: number;
  routingMethod: "ASTAR";
  routingExecutionTime: number;
  fallbackUsed: false;
  routeStatus: StreetGraphRouteStatus;
  failureReason?: StreetGraphRouteFailureReason;
  graphSource: "IMPORTED_STREET_CENTERLINES";
  candidateCoordinate?: DALCoordinate;
  attachmentCoordinate?: DALCoordinate;
  snappedStartCoordinate?: DALCoordinate;
  snappedEndCoordinate?: DALCoordinate;
  distanceToStartNode?: number;
  distanceToEndNode?: number;
};

export type StreetGraphRouteResult = {
  routeStatus: StreetGraphRouteStatus;
  failureReason?: StreetGraphRouteFailureReason;
  geometry: DALCoordinate[];
  routeFeet: number;
  routeMiles: number;
  streetGraphPath: DALCoordinate[];
  startNode?: StreetGraphNode;
  endNode?: StreetGraphNode;
  pathNodeIds: string[];
  pathEdgeIds: string[];
  roadSegmentCount: number;
  roadNamesTraversed: string[];
  roadClassesTraversed: string[];
  audit: RoutingAudit;
  graphPreview: {
    nodes: StreetGraphNode[];
    edges: StreetGraphEdge[];
  };
};

export type StreetGraphNode = {
  nodeId: string;
  coordinate: DALCoordinate;
};

export type StreetGraphEdge = {
  edgeId: string;
  fromNodeId: string;
  toNodeId: string;
  streetId: string;
  streetName: string;
  streetClass: string;
  geometry: DALCoordinate[];
  lengthFeet: number;
};

type QueueItem = {
  nodeId: string;
  priority: number;
};

type StreetGraph = {
  nodes: StreetGraphNode[];
  edges: StreetGraphEdge[];
  adjacency: Map<string, StreetGraphEdge[]>;
  nodeById: Map<string, StreetGraphNode>;
};

function validCoordinate(coordinate?: DALCoordinate | null): coordinate is DALCoordinate {
  return Array.isArray(coordinate) && Number.isFinite(Number(coordinate[0])) && Number.isFinite(Number(coordinate[1]));
}

function coordinateKey(coordinate: DALCoordinate) {
  return `${coordinate[0].toFixed(7)},${coordinate[1].toFixed(7)}`;
}

function edgeLengthFeet(geometry: DALCoordinate[]) {
  let total = 0;
  for (let index = 1; index < geometry.length; index += 1) total += haversineFeet(geometry[index - 1], geometry[index]);
  return total;
}

function pushQueue(queue: QueueItem[], item: QueueItem) {
  queue.push(item);
  let index = queue.length - 1;
  while (index > 0) {
    const parent = Math.floor((index - 1) / 2);
    if (queue[parent].priority <= item.priority) break;
    queue[index] = queue[parent];
    index = parent;
  }
  queue[index] = item;
}

function popQueue(queue: QueueItem[]) {
  if (!queue.length) return undefined;
  const first = queue[0];
  const last = queue.pop();
  if (last && queue.length) {
    let index = 0;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      if (left >= queue.length) break;
      const child = right < queue.length && queue[right].priority < queue[left].priority ? right : left;
      if (queue[child].priority >= last.priority) break;
      queue[index] = queue[child];
      index = child;
    }
    queue[index] = last;
  }
  return first;
}

function buildStreetGraph(streets: StreetCenterline[]): StreetGraph {
  const nodes: StreetGraphNode[] = [];
  const nodeByKey = new Map<string, StreetGraphNode>();
  const edges: StreetGraphEdge[] = [];
  const adjacency = new Map<string, StreetGraphEdge[]>();

  function getNode(coordinate: DALCoordinate): StreetGraphNode {
    const key = coordinateKey(coordinate);
    const existing = nodeByKey.get(key);
    if (existing) return existing;
    const node: StreetGraphNode = { nodeId: `street-node-${nodeByKey.size + 1}`, coordinate };
    nodeByKey.set(key, node);
    nodes.push(node);
    return node;
  }

  function addDirected(edge: StreetGraphEdge) {
    adjacency.set(edge.fromNodeId, [...(adjacency.get(edge.fromNodeId) ?? []), edge]);
  }

  streets
    .filter((street) => street.source === "IMPORTED" && street.geometry.filter(validCoordinate).length >= 2)
    .forEach((street) => {
      const geometry = street.geometry.filter(validCoordinate);
      for (let index = 1; index < geometry.length; index += 1) {
        const from = getNode(geometry[index - 1]);
        const to = getNode(geometry[index]);
        if (from.nodeId === to.nodeId) continue;
        const segment = [from.coordinate, to.coordinate];
        const lengthFeet = edgeLengthFeet(segment);
        if (!Number.isFinite(lengthFeet) || lengthFeet <= 0) continue;
        const edgeId = `street-edge-${edges.length + 1}`;
        const edge: StreetGraphEdge = {
          edgeId,
          fromNodeId: from.nodeId,
          toNodeId: to.nodeId,
          streetId: street.streetId,
          streetName: street.streetName || street.streetId,
          streetClass: street.streetClass || "Local",
          geometry: segment,
          lengthFeet,
        };
        const reverse: StreetGraphEdge = {
          ...edge,
          edgeId: `${edgeId}:reverse`,
          fromNodeId: to.nodeId,
          toNodeId: from.nodeId,
          geometry: [...segment].reverse(),
        };
        edges.push(edge);
        addDirected(edge);
        addDirected(reverse);
      }
    });

  return { nodes, edges, adjacency, nodeById: new Map(nodes.map((node) => [node.nodeId, node])) };
}

function nearestNodes(graph: StreetGraph, coordinate: DALCoordinate, limit = 8) {
  return graph.nodes
    .map((node) => ({ node, distanceFeet: haversineFeet(coordinate, node.coordinate) }))
    .sort((a, b) => a.distanceFeet - b.distanceFeet)
    .slice(0, limit);
}

function aStar(graph: StreetGraph, startNodeId: string, endNodeId: string) {
  const endNode = graph.nodeById.get(endNodeId);
  if (!endNode) return null;
  const open: QueueItem[] = [];
  const cameFromEdge = new Map<string, StreetGraphEdge>();
  const gScore = new Map<string, number>([[startNodeId, 0]]);
  pushQueue(open, { nodeId: startNodeId, priority: 0 });

  while (open.length) {
    const current = popQueue(open);
    if (!current) break;
    if (current.nodeId === endNodeId) {
      const pathEdges: StreetGraphEdge[] = [];
      let walkNodeId = endNodeId;
      while (walkNodeId !== startNodeId) {
        const edge = cameFromEdge.get(walkNodeId);
        if (!edge) break;
        pathEdges.push(edge);
        walkNodeId = edge.fromNodeId;
      }
      pathEdges.reverse();
      return pathEdges;
    }

    for (const edge of graph.adjacency.get(current.nodeId) ?? []) {
      const tentativeScore = (gScore.get(current.nodeId) ?? Number.POSITIVE_INFINITY) + edge.lengthFeet;
      if (tentativeScore >= (gScore.get(edge.toNodeId) ?? Number.POSITIVE_INFINITY)) continue;
      const nextNode = graph.nodeById.get(edge.toNodeId);
      if (!nextNode) continue;
      cameFromEdge.set(edge.toNodeId, edge);
      gScore.set(edge.toNodeId, tentativeScore);
      pushQueue(open, {
        nodeId: edge.toNodeId,
        priority: tentativeScore + haversineFeet(nextNode.coordinate, endNode.coordinate),
      });
    }
  }

  return null;
}

function graphGeometryFromEdges(edges: StreetGraphEdge[]) {
  const geometry: DALCoordinate[] = [];
  edges.forEach((edge, index) => {
    if (index === 0) geometry.push(edge.geometry[0]);
    geometry.push(edge.geometry[edge.geometry.length - 1]);
  });
  return geometry;
}

function logRoutingAudit(audit: RoutingAudit) {
  console.log({
    routingEngine: audit.routingEngine,
    streetNodes: audit.graphNodes,
    streetEdges: audit.graphEdges,
    startNode: audit.startNode,
    endNode: audit.endNode,
    pathFound: audit.pathFound,
    pathNodeCount: audit.pathNodeCount,
    pathSegmentCount: audit.pathSegmentCount,
    routingExecutionTime: audit.routingExecutionTime,
    fallbackUsed: audit.fallbackUsed,
    routeStatus: audit.routeStatus,
    failureReason: audit.failureReason,
  });
}

function failureResult(args: {
  startedAt: number;
  graph?: StreetGraph;
  failureReason: StreetGraphRouteFailureReason;
  candidateCoordinate?: DALCoordinate;
  attachmentCoordinate?: DALCoordinate;
  snappedStartCoordinate?: DALCoordinate;
  snappedEndCoordinate?: DALCoordinate;
  distanceToStartNode?: number;
  distanceToEndNode?: number;
}): StreetGraphRouteResult {
  const graph = args.graph;
  const audit: RoutingAudit = {
    routingEngine: "StreetGraphRouter",
    graphNodes: graph?.nodes.length ?? 0,
    graphEdges: graph?.edges.length ?? 0,
    pathFound: false,
    pathNodeCount: 0,
    pathEdgeCount: 0,
    pathSegmentCount: 0,
    totalTraversedLength: 0,
    routingMethod: "ASTAR",
    routingExecutionTime: Math.round(performance.now() - args.startedAt),
    fallbackUsed: false,
    routeStatus: "ROUTE_NOT_FOUND",
    failureReason: args.failureReason,
    graphSource: "IMPORTED_STREET_CENTERLINES",
    candidateCoordinate: args.candidateCoordinate,
    attachmentCoordinate: args.attachmentCoordinate,
    snappedStartCoordinate: args.snappedStartCoordinate,
    snappedEndCoordinate: args.snappedEndCoordinate,
    distanceToStartNode: args.distanceToStartNode,
    distanceToEndNode: args.distanceToEndNode,
  };
  logRoutingAudit(audit);
  return {
    routeStatus: "ROUTE_NOT_FOUND",
    failureReason: args.failureReason,
    geometry: [],
    routeFeet: 0,
    routeMiles: 0,
    streetGraphPath: [],
    pathNodeIds: [],
    pathEdgeIds: [],
    roadSegmentCount: 0,
    roadNamesTraversed: [],
    roadClassesTraversed: [],
    audit,
    graphPreview: {
      nodes: graph?.nodes.slice(0, 1200) ?? [],
      edges: graph?.edges.slice(0, 1600) ?? [],
    },
  };
}

export function routeInventoryExtensionViaStreetGraph(args: {
  attachmentCoordinate?: DALCoordinate;
  candidateCoordinate?: DALCoordinate;
  streetCenterlines?: StreetCenterline[];
}): StreetGraphRouteResult {
  const startedAt = performance.now();
  if (!validCoordinate(args.candidateCoordinate)) return failureResult({ startedAt, failureReason: "INVALID_CANDIDATE", attachmentCoordinate: args.attachmentCoordinate });
  if (!validCoordinate(args.attachmentCoordinate)) return failureResult({ startedAt, failureReason: "NO_ATTACHMENT_FOUND", candidateCoordinate: args.candidateCoordinate });
  const streets = (args.streetCenterlines ?? []).filter((street) => street.source === "IMPORTED");
  if (!streets.length) return failureResult({ startedAt, failureReason: "NO_STREET_GRAPH", candidateCoordinate: args.candidateCoordinate, attachmentCoordinate: args.attachmentCoordinate });
  const graph = buildStreetGraph(streets);
  if (!graph.nodes.length || !graph.edges.length) return failureResult({ startedAt, graph, failureReason: "EMPTY_STREET_GRAPH", candidateCoordinate: args.candidateCoordinate, attachmentCoordinate: args.attachmentCoordinate });

  const startCandidates = nearestNodes(graph, args.attachmentCoordinate);
  const endCandidates = nearestNodes(graph, args.candidateCoordinate);
  if (!startCandidates.length || !endCandidates.length) {
    return failureResult({
      startedAt,
      graph,
      failureReason: "SNAP_FAILURE",
      candidateCoordinate: args.candidateCoordinate,
      attachmentCoordinate: args.attachmentCoordinate,
    });
  }
  let best:
    | {
        start: (typeof startCandidates)[number];
        end: (typeof endCandidates)[number];
        edges: StreetGraphEdge[];
        totalFeet: number;
      }
    | null = null;

  for (const start of startCandidates) {
    for (const end of endCandidates) {
      if (start.node.nodeId === end.node.nodeId) continue;
      const edges = aStar(graph, start.node.nodeId, end.node.nodeId);
      if (!edges?.length) continue;
      const traversed = edges.reduce((sum, edge) => sum + edge.lengthFeet, 0);
      const totalFeet = start.distanceFeet + traversed + end.distanceFeet;
      if (!best || totalFeet < best.totalFeet) best = { start, end, edges, totalFeet };
    }
  }

  if (!best) {
    return failureResult({
      startedAt,
      graph,
      failureReason: "NO_REACHABLE_PATH",
      candidateCoordinate: args.candidateCoordinate,
      attachmentCoordinate: args.attachmentCoordinate,
      snappedStartCoordinate: startCandidates[0]?.node.coordinate,
      snappedEndCoordinate: endCandidates[0]?.node.coordinate,
      distanceToStartNode: startCandidates[0] ? Math.round(startCandidates[0].distanceFeet) : undefined,
      distanceToEndNode: endCandidates[0] ? Math.round(endCandidates[0].distanceFeet) : undefined,
    });
  }

  const streetGraphPath = graphGeometryFromEdges(best.edges);
  const geometry: DALCoordinate[] = [args.attachmentCoordinate, ...streetGraphPath, args.candidateCoordinate];
  const pathNodeIds = [best.start.node.nodeId, ...best.edges.map((edge) => edge.toNodeId)];
  const pathEdgeIds = best.edges.map((edge) => edge.edgeId.replace(":reverse", ""));
  const totalTraversedLength = Math.round(best.edges.reduce((sum, edge) => sum + edge.lengthFeet, 0));
  const routeFeet = Math.round(edgeLengthFeet(geometry));

  const audit: RoutingAudit = {
    routingEngine: "StreetGraphRouter",
    graphNodes: graph.nodes.length,
    graphEdges: graph.edges.length,
    startNode: best.start.node.nodeId,
    endNode: best.end.node.nodeId,
    pathFound: true,
    pathNodeCount: pathNodeIds.length,
    pathEdgeCount: pathEdgeIds.length,
    pathSegmentCount: best.edges.length,
    totalTraversedLength,
    routingMethod: "ASTAR",
    routingExecutionTime: Math.round(performance.now() - startedAt),
    fallbackUsed: false,
    routeStatus: "VALID",
    graphSource: "IMPORTED_STREET_CENTERLINES",
    candidateCoordinate: args.candidateCoordinate,
    attachmentCoordinate: args.attachmentCoordinate,
    snappedStartCoordinate: best.start.node.coordinate,
    snappedEndCoordinate: best.end.node.coordinate,
    distanceToStartNode: Math.round(best.start.distanceFeet),
    distanceToEndNode: Math.round(best.end.distanceFeet),
  };
  logRoutingAudit(audit);

  return {
    routeStatus: "VALID",
    geometry,
    routeFeet,
    routeMiles: routeFeet / 5280,
    streetGraphPath,
    startNode: best.start.node,
    endNode: best.end.node,
    pathNodeIds,
    pathEdgeIds,
    roadSegmentCount: best.edges.length,
    roadNamesTraversed: Array.from(new Set(best.edges.map((edge) => edge.streetName))),
    roadClassesTraversed: Array.from(new Set(best.edges.map((edge) => edge.streetClass))),
    audit,
    graphPreview: {
      nodes: graph.nodes.slice(0, 1200),
      edges: graph.edges.slice(0, 1600),
    },
  };
}

export function renderStreetGraphRoutingDiagnostics(result: StreetGraphRouteResult | null | undefined, sourceId = "street-graph-routing"): MapKernelRenderSpec | null {
  if (!result) return null;
  const primitives: MapKernelRenderSpec["primitives"] = [
    ...result.graphPreview.edges.map((edge) => ({
      id: `${sourceId}:${edge.edgeId}`,
      layerId: "streetReference" as const,
      kind: "line" as const,
      coordinates: edge.geometry,
      label: edge.streetName,
      style: { stroke: "#6b7280", strokeWidth: 1, opacity: 0.42 },
      metadata: { sourceLayer: "STREET_GRAPH_EDGES", renderAuthority: "Street Graph Diagnostic", selectable: false },
      ref: { kind: "StreetReference" as const, id: edge.edgeId, sourceLayer: "STREET_GRAPH_EDGES" },
    })),
    ...result.graphPreview.nodes.map((node) => ({
      id: `${sourceId}:${node.nodeId}`,
      layerId: "node" as const,
      kind: "point" as const,
      coordinate: node.coordinate,
      label: node.nodeId,
      style: { fill: "#2563eb", stroke: "#eff6ff", strokeWidth: 1, radius: 2, opacity: 0.62 },
      metadata: { sourceLayer: "STREET_GRAPH_NODES", renderAuthority: "Street Graph Diagnostic", selectable: false },
      ref: { kind: "Node" as const, id: node.nodeId, nodeId: node.nodeId, sourceLayer: "STREET_GRAPH_NODES" },
    })),
  ];

  if (result.startNode) {
    primitives.push({
      id: `${sourceId}:start-node`,
      layerId: "attachment",
      kind: "point",
      coordinate: result.startNode.coordinate,
      label: "Selected Start Node",
      style: { fill: "#16a34a", stroke: "#ffffff", strokeWidth: 2, radius: 7, opacity: 1 },
      metadata: { sourceLayer: "STREET_GRAPH_START_NODE", renderAuthority: "Street Graph Diagnostic" },
      ref: { kind: "Attachment", id: `${sourceId}:start-node`, sourceLayer: "STREET_GRAPH_START_NODE" },
    });
  }

  if (result.endNode) {
    primitives.push({
      id: `${sourceId}:end-node`,
      layerId: "site",
      kind: "point",
      coordinate: result.endNode.coordinate,
      label: "Selected End Node",
      style: { fill: "#dc2626", stroke: "#ffffff", strokeWidth: 2, radius: 7, opacity: 1 },
      metadata: { sourceLayer: "STREET_GRAPH_END_NODE", renderAuthority: "Street Graph Diagnostic" },
      ref: { kind: "Site", id: `${sourceId}:end-node`, sourceLayer: "STREET_GRAPH_END_NODE" },
    });
  }

  if (result.streetGraphPath.length >= 2) {
    primitives.push({
      id: `${sourceId}:computed-path`,
      layerId: "lateral",
      kind: "line",
      coordinates: result.streetGraphPath,
      label: "Computed Street Graph Path",
      style: { stroke: "#22c55e", strokeWidth: 5, opacity: 1 },
      metadata: { sourceLayer: "STREET_GRAPH_COMPUTED_PATH", renderAuthority: "Street Graph Diagnostic" },
      ref: { kind: "Lateral", id: `${sourceId}:computed-path`, sourceLayer: "STREET_GRAPH_COMPUTED_PATH" },
    });
    result.streetGraphPath.forEach((coordinate, index) => {
      primitives.push({
        id: `${sourceId}:computed-path-vertex-${index + 1}`,
        layerId: "node",
        kind: "point",
        coordinate,
        label: `Path Vertex ${index + 1}`,
        style: { fill: "#22c55e", stroke: "#052e16", strokeWidth: 1, radius: 3, opacity: 0.95 },
        metadata: { sourceLayer: "STREET_GRAPH_PATH_VERTEX", renderAuthority: "Street Graph Diagnostic", selectable: false },
        ref: { kind: "Node", id: `${sourceId}:computed-path-vertex-${index + 1}`, sourceLayer: "STREET_GRAPH_PATH_VERTEX" },
      });
    });
  }

  return {
    specId: `${sourceId}:street-graph-diagnostics`,
    sourceType: "Manual",
    sourceId,
    name: "Street Graph Routing Diagnostics",
    primitives,
    metadata: { routeStatus: result.routeStatus, failureReason: result.failureReason },
  };
}
