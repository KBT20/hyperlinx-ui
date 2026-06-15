export function closureCompleteness(context: any) {
  const missing = ["workItemId", "stationId", "closureId"].filter((key) => !context?.[key]);
  const metadata = context?.metadata ?? {};
  for (const key of ["footage", "crew", "closedAt", "notes"]) {
    if (!metadata?.[key]) missing.push(key);
  }
  return {
    complete: missing.length === 0,
    missing,
  };
}

