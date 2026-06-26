export type NetworkClass = "LONG_HAUL" | "MIDDLE_MILE" | "METRO" | "CAMPUS";

export function normalizeNetworkClass(value?: string | null): NetworkClass {
  if (value === "LONG_HAUL" || value === "MIDDLE_MILE" || value === "METRO" || value === "CAMPUS") return value;
  return "METRO";
}

export function formatNetworkClass(value: NetworkClass) {
  return value.replaceAll("_", " ");
}
