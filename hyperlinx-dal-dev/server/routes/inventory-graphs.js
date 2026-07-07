import { DIRS, errorResponse, handleOptions, jsonResponse, listRecords, loadRecord, persistRecord, readRequestJson, routeMatch, sortedByUpdated } from "./_shared.js";

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
  const match = routeMatch(pathname, "/api/inventory-graphs") ?? routeMatch(pathname, "/api/baseline-graphs");
  if (!match) return false;
  if (handleOptions(req, res)) return true;

  if (match.base && req.method === "GET") {
    const graphs = await listRecords(DIRS.inventoryGraphs);
    const metadata = sortedByUpdated(graphs.map(metadataFromGraph));
    jsonResponse(res, 200, {
      inventoryGraphs: metadata,
      baselineGraphs: metadata,
      graphs: metadata,
      baselineGraphCompatibility: true,
    });
    return true;
  }

  if (!match.base && req.method === "GET") {
    try {
      const graph = await loadRecord(DIRS.inventoryGraphs, match.id);
      jsonResponse(res, 200, { inventoryGraph: graph, baselineGraph: graph, graph, baselineGraphCompatibility: true });
    } catch {
      errorResponse(res, 404, `Inventory graph not found: ${match.id}`);
    }
    return true;
  }

  if (match.base && req.method === "POST") {
    const body = await readRequestJson(req);
    const graph = body.inventoryGraph ?? body.graph ?? body.data ?? body;
    const metadata = metadataFromGraph(graph);
    const saved = await persistRecord(DIRS.inventoryGraphs, metadata.inventoryId, {
      ...graph,
      inventoryId: metadata.inventoryId,
      graphId: metadata.graphId,
      metadata,
      createdAt: graph.createdAt ?? metadata.createdDate,
      updatedAt: graph.updatedAt ?? metadata.updatedAt ?? metadata.createdDate,
    });
    jsonResponse(res, 201, { inventoryGraph: saved, graph: saved, metadata: metadataFromGraph(saved) });
    return true;
  }

  return false;
}
