const AUTH_STORAGE_KEY = "teralinx:auth-session:v1";

function storedToken() {
  if (typeof window === "undefined") return "";
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return "";
    const session = JSON.parse(raw) as { token?: unknown };
    return typeof session.token === "string" ? session.token : "";
  } catch {
    return "";
  }
}

export function withStoredAuthHeaders(headers: HeadersInit = {}) {
  const token = storedToken();
  return {
    ...headers,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export function withStoredAuth(init: RequestInit = {}) {
  return {
    ...init,
    headers: withStoredAuthHeaders(init.headers),
  };
}
