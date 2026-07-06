const DEBUG_STORAGE_KEY = "hyperlinx:debug:runtime";

function envFlag() {
  const env = import.meta.env as Record<string, string | undefined>;
  return env.VITE_DAL_RUNTIME_DEBUG === "1" || env.VITE_DAL_RUNTIME_DEBUG === "true";
}

export function runtimeDebugEnabled() {
  if (envFlag()) return true;
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(DEBUG_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function runtimeDebugLog(label: string, payload?: unknown) {
  if (!runtimeDebugEnabled()) return;
  if (payload === undefined) console.debug(label);
  else console.debug(label, payload);
}

