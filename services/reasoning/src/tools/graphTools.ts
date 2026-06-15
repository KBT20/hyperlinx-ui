export function summarizeGraphContext(context: any) {
  const metadata = context?.metadata ?? {};
  return {
    inventoryId: context?.inventoryId ?? metadata?.inventoryId,
    graphId: context?.graphId ?? metadata?.graphId,
    nodeCount: metadata?.nodeCount,
    edgeCount: metadata?.edgeCount,
    stationCount: metadata?.stationCount,
    routeCount: metadata?.routeCount,
    routeMiles: metadata?.routeMiles,
  };
}

