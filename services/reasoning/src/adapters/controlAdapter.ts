export function controlAdapter(context: any) {
  return {
    workItemId: context?.workItemId,
    scopeVersionId: context?.scopeVersionId,
    status: context?.metadata?.status,
  };
}

