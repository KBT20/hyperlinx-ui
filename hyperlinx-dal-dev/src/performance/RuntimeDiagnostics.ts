const env = (typeof import.meta !== "undefined" ? import.meta.env : {}) as Record<string, string | boolean | undefined>;
const lastDiagnosticAt = new Map<string, number>();

export function runtimeDiagnosticsEnabled() {
  const value = String(env?.VITE_DEBUG_RUNTIME_DIAGNOSTICS ?? env?.DEBUG_RUNTIME_DIAGNOSTICS ?? "").toLowerCase();
  return value === "true" || value === "1" || value === "yes";
}

function runtimeDiagnosticCanEmit(channel: string) {
  if (!runtimeDiagnosticsEnabled()) return false;
  const now = Date.now();
  const previous = lastDiagnosticAt.get(channel) ?? 0;
  if (now - previous < 250) return false;
  lastDiagnosticAt.set(channel, now);
  return true;
}

export function runtimeDiagnosticsLog(channel: string, payload: Record<string, unknown>) {
  if (!runtimeDiagnosticCanEmit(channel)) return;
  console.info(`[${channel}]`, payload);
}

export function runtimeDiagnosticsWarn(channel: string, payload: Record<string, unknown>) {
  if (runtimeDiagnosticCanEmit(channel)) {
    console.warn(`[${channel}]`, payload);
  }
}
