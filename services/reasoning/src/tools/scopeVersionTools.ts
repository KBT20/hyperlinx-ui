export function summarizeScopeVersionContext(context: any) {
  return {
    scopeVersionId: context?.scopeVersionId,
    status: context?.metadata?.status,
    inventoryId: context?.inventoryId,
    graphId: context?.graphId,
  };
}

