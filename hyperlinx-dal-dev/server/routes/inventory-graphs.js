import { DIRS, errorResponse, handleOptions, jsonResponse, listRecords, loadRecord, routeMatch, sortedByUpdated } from "./_shared.js";

function metadataFromGraph(graph = {}) {
  const metadata = graph.metadata ?? graph;
  return {
    ...metadata,
    inventoryId: String(graph.inventoryId ?? metadata.inventoryId ?? ""),
    graphId: String(graph.graphId ?? metadata.graphId ?? ""),
    name: metadata.name ?? graph.name ?? graph.inventoryId ?? "Inventory Graph",
    nodeCount: Number(metadata.nodeCount ?? graph.nodes?.length ?? 0),
    edgeCount: Number(metadata.edgeCount ?? graph.edges?.length ?? 0),
    stationCount: Number(metadata.stationCount ?? graph.stations?.length ?? 0),
    routeCount: Number(metadata.routeCount ?? graph.routes?.length ?? 0),
    createdDate: metadata.createdDate ?? graph.createdAt ?? metadata.importedAt,
    updatedAt: metadata.updatedAt ?? graph.updatedAt,
    serverBacked: true,
    localFallback: false,
  };
}

export async function handleInventoryGraphs(req, res, pathname) {
  const match = routeMatch(pathname, "/api/inventory-graphs");
  if (!match) return false;
  if (handleOptions(req, res)) return true;

  if (match.base && req.method === "GET") {
    const graphs = await listRecords(DIRS.inventoryGraphs);
    jsonResponse(res, 200, { inventoryGraphs: sortedByUpdated(graphs.map(metadataFromGraph)), graphs: sortedByUpdated(graphs.map(metadataFromGraph)) });
    return true;
  }

  if (!match.base && req.method === "GET") {
    try {
      const graph = await loadRecord(DIRS.inventoryGraphs, match.id);
      jsonResponse(res, 200, { inventoryGraph: graph, graph });
    } catch {
      errorResponse(res, 404, `Inventory graph not found: ${match.id}`);
    }
    return true;
  }

  if (match.base && req.method === "POST") {
    errorResponse(res, 501, "Large inventory graph uploads are intentionally disabled for /api/inventory-graphs in this phase. Use /api/baseline-graphs chunk persistence.");
    return true;
  }

  return false;
}
