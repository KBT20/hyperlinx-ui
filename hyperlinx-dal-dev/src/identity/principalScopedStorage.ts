const PRINCIPAL_DATASET_KEY = "teralinxPrincipalId";

export function setPrincipalStorageScope(principalId: string | null | undefined) {
  if (typeof document === "undefined") return;
  if (principalId) {
    document.documentElement.dataset[PRINCIPAL_DATASET_KEY] = principalId;
  } else {
    delete document.documentElement.dataset[PRINCIPAL_DATASET_KEY];
  }
}

export function principalScopedStorageKey(key: string) {
  if (typeof document === "undefined") return `${key}:principal:anonymous`;
  const principalId = document.documentElement.dataset[PRINCIPAL_DATASET_KEY] ?? "anonymous";
  return `${key}:principal:${encodeURIComponent(principalId)}`;
}
