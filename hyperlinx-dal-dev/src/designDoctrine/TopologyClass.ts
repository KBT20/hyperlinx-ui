export type TopologyClass = "LINEAR" | "RING" | "MESH";

export function formatTopologyClass(value: TopologyClass) {
  return value.replaceAll("_", " ");
}
