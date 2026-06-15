const env = import.meta.env as Record<string, string | undefined>;

function cleanApiBase(value: string | undefined, fallback: string) {
  const resolved = value?.trim() || fallback;
  return resolved.replace(/\/+$/, "");
}

export const DAL_API = cleanApiBase(env.VITE_DAL_API, "http://127.0.0.1:3001");
export const DAL_BASELINE_GRAPH_API = cleanApiBase(env.VITE_DAL_BASELINE_GRAPH_API, DAL_API);
export const DAL_INVENTORY_GRAPH_API = cleanApiBase(env.VITE_DAL_INVENTORY_GRAPH_API, DAL_BASELINE_GRAPH_API);
export const DAL_REASONING_API = cleanApiBase(env.VITE_DAL_REASONING_API, "http://127.0.0.1:4100");
export const DAL_GEOCODER_PROVIDER = env.VITE_DAL_GEOCODER_PROVIDER?.trim() || "priority";
export const DAL_MAPBOX_GEOCODING_TOKEN = env.VITE_DAL_MAPBOX_GEOCODING_TOKEN?.trim() || "";
export const DAL_GOOGLE_GEOCODING_KEY = env.VITE_DAL_GOOGLE_GEOCODING_KEY?.trim() || "";
export const DAL_APP_NAME = env.VITE_DAL_APP_NAME?.trim() || "HYPERLINX DAL DEVELOPMENT";

console.log("DAL DEVELOPMENT MODE");
console.log("DAL API TARGET", DAL_API);
console.log("DAL BASELINE GRAPH API TARGET", DAL_BASELINE_GRAPH_API);
console.log("DAL INVENTORY GRAPH API TARGET", DAL_INVENTORY_GRAPH_API);
console.log("DAL REASONING API TARGET", DAL_REASONING_API);
console.log("DAL GEOCODER PROVIDER", DAL_GEOCODER_PROVIDER);
