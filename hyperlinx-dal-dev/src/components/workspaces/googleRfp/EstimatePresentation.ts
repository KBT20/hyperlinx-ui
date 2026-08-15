export function formatEstimateLabel(value: unknown, fallback = "UNRESOLVED") {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim();
  return normalized ? normalized.replaceAll("_", " ") : fallback;
}
