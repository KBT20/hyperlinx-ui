export function withStoredAuthHeaders(headers: HeadersInit = {}) {
  return { ...headers };
}

export function withStoredAuth(init: RequestInit = {}) {
  return {
    ...init,
    credentials: init.credentials ?? "same-origin",
    headers: withStoredAuthHeaders(init.headers),
  };
}
