export function twinAdapter(context: any) {
  return {
    twinStateId: context?.twinStateId,
    scopeVersionId: context?.scopeVersionId,
    selectedFeature: context?.selectedFeature ? "provided" : "none",
  };
}

