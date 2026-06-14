import type { ScopeVersion } from "./scopeVersion"
import type { DerivedState } from "./types"

export function deriveState(scope: ScopeVersion): DerivedState {
  const nodeStates: Record<string, any> = {};
  const edgeStates: Record<string, any> = {};

  // initialize nodes
  for (const node of scope.nodes) {
    nodeStates[node.id] = {
      status: "unknown",
    };
  }

  // initialize edges
  for (const edge of scope.edges) {
    edgeStates[edge.id] = {
      status: "unknown",
      blocked: false,
    };
  }

  // replay events
  for (const event of scope.events) {
    if (event.type === "activate_node") {
      nodeStates[event.targetId] = { status: "active" };
    }

    if (event.type === "block_edge") {
      edgeStates[event.targetId].blocked = true;
    }
  }

  // 🔥 PROPAGATE BLOCKED EDGES → DOWNSTREAM NODES

    for (const edge of scope.edges) {
    const edgeState = edgeStates[edge.id];

    if (edgeState?.blocked) {
        const toNodeId = edge.to;

        if (nodeStates[toNodeId]) {
        nodeStates[toNodeId] = {
            ...nodeStates[toNodeId],
            status: "unreachable",
        };
        }
    }
    }

  return {
    nodeStates,
    edgeStates,
  };

  // 🔥 PROPAGATION LOGIC

    // If an edge is blocked, mark downstream node as unreachable
    for (const edge of scope.edges) {
    const edgeState = edgeStates[edge.id];

    if (edgeState?.blocked) {
        const toNodeId = edge.to;

        if (nodeStates[toNodeId]) {
        nodeStates[toNodeId] = {
            ...nodeStates[toNodeId],
            status: "unreachable",
        };
        }
    }
    }
}