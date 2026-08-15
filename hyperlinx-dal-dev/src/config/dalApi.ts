import { runtimeDebugLog } from "../runtime/RuntimeDebug";

const env = import.meta.env as Record<string, string | undefined>;

function cleanApiBase(value: string | undefined) {
  const resolved = value?.trim();
  return resolved ? resolved.replace(/\/+$/, "") : "";
}

function resolveExternalApiBase(keys: string[]) {
  for (const key of keys) {
    const value = cleanApiBase(env[key]);
    if (value) return value;
  }
  return "";
}

export const DAL_API = "";
export const DAL_BASELINE_API = "";
export const DAL_BASELINE_GRAPH_API = "";
export const DAL_INVENTORY_GRAPH_API = "";
export const DAL_REASONING_ENDPOINTS = env.VITE_DAL_REASONING_ENDPOINTS?.trim() || "";
export const DAL_REASONING_PRIMARY_API = resolveExternalApiBase(["VITE_DAL_REASONING_PRIMARY_API"]);
export const DAL_REASONING_SECONDARY_API = resolveExternalApiBase(["VITE_DAL_REASONING_SECONDARY_API"]);
export const DAL_REASONING_FALLBACK_API = resolveExternalApiBase(["VITE_DAL_REASONING_FALLBACK_API"]);
export const DAL_REASONING_LEGACY_API = resolveExternalApiBase(["VITE_DAL_REASONING_API"]);
export const DAL_REASONING_PRIMARY_MODEL = env.VITE_DAL_REASONING_PRIMARY_MODEL?.trim() || "unknown";
export const DAL_REASONING_SECONDARY_MODEL = env.VITE_DAL_REASONING_SECONDARY_MODEL?.trim() || "unknown";
export const DAL_REASONING_FALLBACK_MODEL = env.VITE_DAL_REASONING_FALLBACK_MODEL?.trim() || "unknown";
export const DAL_REASONING_ENABLED = (env.VITE_DAL_REASONING_ENABLED?.trim().toLowerCase() ?? "true") !== "false";
export const DAL_GEOCODER_PROVIDER = env.VITE_DAL_GEOCODER_PROVIDER?.trim() || "server";
export const DAL_MAPBOX_GEOCODING_TOKEN = env.VITE_DAL_MAPBOX_GEOCODING_TOKEN?.trim() || "";
export const DAL_GOOGLE_GEOCODING_KEY = env.VITE_DAL_GOOGLE_GEOCODING_KEY?.trim() || "";
export const DAL_APP_NAME = env.VITE_DAL_APP_NAME?.trim() || "Teralinx Infrastructure Operating Platform";

runtimeDebugLog("TERALINX DAL RUNTIME MODE");
runtimeDebugLog("DAL API TARGET", DAL_API);
runtimeDebugLog("DAL BASELINE API TARGET", DAL_BASELINE_API);
runtimeDebugLog("DAL BASELINE GRAPH API TARGET", DAL_BASELINE_GRAPH_API);
runtimeDebugLog("DAL INVENTORY GRAPH API TARGET", DAL_INVENTORY_GRAPH_API);
runtimeDebugLog("DAL REASONING FABRIC CONFIGURED", Boolean(DAL_REASONING_ENDPOINTS || DAL_REASONING_PRIMARY_API || DAL_REASONING_SECONDARY_API || DAL_REASONING_FALLBACK_API || DAL_REASONING_LEGACY_API));
runtimeDebugLog("DAL GEOCODER PROVIDER", DAL_GEOCODER_PROVIDER);
