type GovernedIdContext = {
  authorityClass?: string | null;
  organizationId?: string | null;
};

const DEMO_NAMESPACE_PATTERN = /(^|[-_:])DEMO(?:[-_:]|$)/i;

export function isDemoGovernedContext(context?: GovernedIdContext | null) {
  return context?.authorityClass === "DEMO" && context.organizationId === "org-demo";
}

export function hasDemoIdNamespace(id: string) {
  return DEMO_NAMESPACE_PATTERN.test(String(id ?? "").trim());
}

/**
 * Applies the existing Demo governed-ID contract before a record is submitted.
 * Production IDs are returned byte-for-byte unchanged; server enforcement remains
 * the final authority for both environments.
 */
export function governedClientId(id: string, context?: GovernedIdContext | null) {
  const normalized = String(id ?? "").trim();
  if (!normalized || !isDemoGovernedContext(context) || hasDemoIdNamespace(normalized)) return normalized;
  return `DEMO-${normalized}`;
}
