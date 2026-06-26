import type { NetworkClass } from "./NetworkClass";

export type ProtectionClass = "NONE" | "PATH_PROTECTED" | "RING_PROTECTED" | "MESH_PROTECTED";

export type ProtectionClassInput = ProtectionClass | "LINEAR" | "DIVERSE" | "RING" | undefined | null;

export function defaultProtectionForNetworkClass(networkClass: NetworkClass): ProtectionClass {
  if (networkClass === "LONG_HAUL") return "NONE";
  if (networkClass === "MIDDLE_MILE") return "PATH_PROTECTED";
  if (networkClass === "METRO") return "RING_PROTECTED";
  return "MESH_PROTECTED";
}

export function normalizeProtectionClass(value: ProtectionClassInput, networkClass: NetworkClass): ProtectionClass {
  if (value === "NONE" || value === "PATH_PROTECTED" || value === "RING_PROTECTED" || value === "MESH_PROTECTED") return value;
  if (value === "LINEAR") return networkClass === "LONG_HAUL" ? "NONE" : defaultProtectionForNetworkClass(networkClass);
  if (value === "RING") return "RING_PROTECTED";
  if (value === "DIVERSE") return "PATH_PROTECTED";
  return defaultProtectionForNetworkClass(networkClass);
}

export function formatProtectionClass(value?: ProtectionClassInput, networkClass: NetworkClass = "METRO") {
  const normalized = normalizeProtectionClass(value, networkClass);
  return normalized.replaceAll("_", " ");
}
