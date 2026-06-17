const env = import.meta.env as Record<string, string | undefined>;

function cleanApiBase(value: string | undefined) {
  const resolved = value?.trim();
  return resolved ? resolved.replace(/\/+$/, "") : "";
}

function runtimeApiBase(port: number) {
  if (typeof window === "undefined" || !window.location?.hostname) return "";
  return `${window.location.protocol}//${window.location.hostname}:${port}`;
}

function resolveApiBase(keys: string[], fallback: string) {
  for (const key of keys) {
    const value = cleanApiBase(env[key]);
    if (value) return value;
  }
  return fallback;
}

export const DAL_API = resolveApiBase(["VITE_DAL_API"], runtimeApiBase(3001));
export const DAL_BASELINE_API = resolveApiBase(["VITE_DAL_BASELINE_API", "VITE_DAL_BASELINE_GRAPH_API"], DAL_API);
export const DAL_BASELINE_GRAPH_API = DAL_BASELINE_API;
export const DAL_INVENTORY_GRAPH_API = resolveApiBase(["VITE_DAL_INVENTORY_GRAPH_API"], DAL_BASELINE_API);
export const DAL_REASONING_ENDPOINTS = env.VITE_DAL_REASONING_ENDPOINTS?.trim() || "";
export const DAL_REASONING_PRIMARY_API = resolveApiBase(["VITE_DAL_REASONING_PRIMARY_API"], "");
export const DAL_REASONING_SECONDARY_API = resolveApiBase(["VITE_DAL_REASONING_SECONDARY_API"], "");
export const DAL_REASONING_FALLBACK_API = resolveApiBase(["VITE_DAL_REASONING_FALLBACK_API"], "");
export const DAL_REASONING_LEGACY_API = resolveApiBase(["VITE_DAL_REASONING_API"], "");
export const DAL_REASONING_PRIMARY_MODEL = env.VITE_DAL_REASONING_PRIMARY_MODEL?.trim() || "unknown";
export const DAL_REASONING_SECONDARY_MODEL = env.VITE_DAL_REASONING_SECONDARY_MODEL?.trim() || "unknown";
export const DAL_REASONING_FALLBACK_MODEL = env.VITE_DAL_REASONING_FALLBACK_MODEL?.trim() || "unknown";
export const DAL_GEOCODER_PROVIDER = env.VITE_DAL_GEOCODER_PROVIDER?.trim() || "server";
export const DAL_MAPBOX_GEOCODING_TOKEN = env.VITE_DAL_MAPBOX_GEOCODING_TOKEN?.trim() || "";
export const DAL_GOOGLE_GEOCODING_KEY = env.VITE_DAL_GOOGLE_GEOCODING_KEY?.trim() || "";
export const DAL_APP_NAME = env.VITE_DAL_APP_NAME?.trim() || "HYPERLINX DAL DEVELOPMENT";

console.log("DAL DEVELOPMENT MODE");
console.log("DAL API TARGET", DAL_API);
console.log("DAL BASELINE API TARGET", DAL_BASELINE_API);
console.log("DAL BASELINE GRAPH API TARGET", DAL_BASELINE_GRAPH_API);
console.log("DAL INVENTORY GRAPH API TARGET", DAL_INVENTORY_GRAPH_API);
console.log("DAL REASONING FABRIC CONFIGURED", Boolean(DAL_REASONING_ENDPOINTS || DAL_REASONING_PRIMARY_API || DAL_REASONING_SECONDARY_API || DAL_REASONING_FALLBACK_API || DAL_REASONING_LEGACY_API));
console.log("DAL GEOCODER PROVIDER", DAL_GEOCODER_PROVIDER);
