export type KernelStateDomain =
  | "lifecycle"
  | "controlWork"
  | "routeAuthority"
  | "station"
  | "object";

export const CANONICAL_CONTROL_WORK_STATUSES = ["PENDING", "ACTIVE", "HOLD", "COMPLETE", "CANCELLED", "BLOCKED"] as const;
export const CANONICAL_ROUTE_AUTHORITY_STATES = [
  "DRAFT",
  "ENGINEER_REVIEW_REQUIRED",
  "PROVISIONALLY_CERTIFIED",
  "CERTIFIED_ROUTE",
  "REJECTED",
  "SUPERSEDED",
  "DIRECT_FALLBACK",
  "BLOCKED",
] as const;

const CONTROL_WORK_ALIASES: Record<string, string> = {
  ON_HOLD: "HOLD",
};

const ROUTE_AUTHORITY_ALIASES: Record<string, string> = {
  DRAFT_ROUTE: "DRAFT",
  REJECTED_ROUTE: "REJECTED",
};

const DOMAIN_ALIASES: Partial<Record<KernelStateDomain, Record<string, string>>> = {
  controlWork: CONTROL_WORK_ALIASES,
  routeAuthority: ROUTE_AUTHORITY_ALIASES,
};

function asUpper(value: unknown) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

export function normalizeKernelState<T extends string = string>(value: unknown, domain?: KernelStateDomain): T | undefined {
  const upper = asUpper(value);
  if (!upper) return undefined;
  const aliasMap = domain ? DOMAIN_ALIASES[domain] : undefined;
  const normalized = aliasMap?.[upper] ?? upper;
  if (normalized !== upper) {
    console.log("[KERNEL_ALIAS_NORMALIZED]", {
      domain: domain ?? "unknown",
      from: upper,
      to: normalized,
    });
  }
  return normalized as T;
}

export function normalizeControlWorkStatus<T extends string = string>(value: unknown): T {
  return (normalizeKernelState(value, "controlWork") ?? "PENDING") as T;
}

export function normalizeRouteAuthorityState<T extends string = string>(value: unknown): T {
  return (normalizeKernelState(value, "routeAuthority") ?? "DRAFT") as T;
}

export function isKernelAlias(value: unknown, domain: KernelStateDomain) {
  const upper = asUpper(value);
  return Boolean(upper && DOMAIN_ALIASES[domain]?.[upper]);
}

export function kernelAliasTarget(value: unknown, domain: KernelStateDomain) {
  const upper = asUpper(value);
  return upper ? DOMAIN_ALIASES[domain]?.[upper] : undefined;
}

export function logKernelFallbackActive(input: {
  source: string;
  url?: string;
  mode?: "LOCAL_FALLBACK" | "DEVELOPMENT_FALLBACK";
  reason?: string;
}) {
  console.warn("[KERNEL_FALLBACK_ACTIVE]", {
    mode: input.mode ?? "DEVELOPMENT_FALLBACK",
    source: input.source,
    url: input.url,
    reason: input.reason,
    authoritative: false,
  });
}
