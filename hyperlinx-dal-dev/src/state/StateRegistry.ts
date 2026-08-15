import {
  CONSTITUTIONAL_LIFECYCLE_STATES,
  DOMAIN_AUTHORITY_MATRIX,
  nextLifecycleState,
  type ConstitutionalLifecycleState,
  type DomainAuthority,
} from "./ObjectTransitionEngine";

export const STATE_REGISTRY_AUTHORITY = "STATE_REGISTRY" as const;
export const STATE_REGISTRY_VERSION = "39.0" as const;

export type StateRegistryRenderStyle = {
  icon: string;
  color: string;
  lineStyle: "solid" | "dashed" | "muted";
};

export type ConstitutionalStateDefinition = {
  stateId: ConstitutionalLifecycleState;
  domain: DomainAuthority;
  authority: DomainAuthority;
  visibleLens: string;
  visibleActions: string[];
  allowedTransitions: ConstitutionalLifecycleState[];
  requiredEvidence: string[];
  requiredDiagnostics: string[];
  requiredAuditChecks: string[];
  nextStates: ConstitutionalLifecycleState[];
  blockingStates: ConstitutionalLifecycleState[];
  renderStyle: StateRegistryRenderStyle;
  icon: string;
  color: string;
  hoverTemplate: string[];
  toolbarActions: string[];
  closeActions: string[];
  registryAuthority: typeof STATE_REGISTRY_AUTHORITY;
};

const REQUIRED_EVIDENCE_BY_STATE: Record<ConstitutionalLifecycleState, string[]> = {
  COMMERCIAL_ASSEMBLED: ["commercial review evidence"],
  COMMERCIAL_REVIEW: ["commercial approval evidence"],
  COMMERCIAL_APPROVED: ["customer acceptance evidence"],
  CUSTOMER_ACCEPTED: ["engineering handoff evidence"],
  SUBMITTED_TO_ENGINEERING: ["engineering intake evidence"],
  ENGINEERING_REVIEW: ["engineering certification evidence"],
  ENGINEERING_CERTIFIED: ["service order package evidence"],
  RETURNED_TO_COMMERCIAL: ["commercial revision evidence"],
  SERVICE_ORDER_CREATED: ["customer signature evidence"],
  CUSTOMER_SIGNED: ["ScopeVersion creation evidence"],
  SCOPEVERSION_CREATED: ["marketplace projection evidence"],
  MARKETPLACE_PROJECTED: ["marketplace release evidence"],
  MARKETPLACE_RELEASED: ["control readiness evidence"],
  CONTROL_READY: ["control release evidence"],
  CONTROL_RELEASED: ["field assignment evidence"],
  FIELD_ASSIGNED: ["field start evidence"],
  FIELD_STARTED: ["field installation evidence"],
  FIELD_INSTALLED: ["field close evidence"],
  FIELD_CLOSED: ["as-built verification evidence"],
  AS_BUILT_VERIFIED: ["twin synchronization evidence"],
  TWIN_SYNCHRONIZED: ["operational acceptance evidence"],
  OPERATIONAL: ["maintenance event evidence"],
  MAINTAINED: ["modification authorization evidence"],
  MODIFIED: ["retirement authorization evidence"],
  RETIRED: [],
};

const LENS_BY_DOMAIN: Record<DomainAuthority, string> = {
  Commercial: "Commercial approval, customer acceptance, and revenue readiness",
  Engineering: "Engineering review, certification evidence, and doctrine compliance",
  ScopeVersion: "Execution authorization and constitutional promotion readiness",
  Marketplace: "Material release, inventory allocation, and procurement evidence",
  Control: "Work release, crew assignment, and production control",
  Field: "Station closure, installation evidence, and as-built readiness",
  Twin: "Operational truth, maintenance, modification, and retirement",
};

const RENDER_BY_DOMAIN: Record<DomainAuthority, StateRegistryRenderStyle> = {
  Commercial: { icon: "file-check", color: "#2563eb", lineStyle: "solid" },
  Engineering: { icon: "ruler", color: "#7c3aed", lineStyle: "solid" },
  ScopeVersion: { icon: "shield-check", color: "#0f766e", lineStyle: "solid" },
  Marketplace: { icon: "package-check", color: "#b45309", lineStyle: "dashed" },
  Control: { icon: "clipboard-check", color: "#334155", lineStyle: "solid" },
  Field: { icon: "map-pin-check", color: "#15803d", lineStyle: "solid" },
  Twin: { icon: "activity", color: "#0891b2", lineStyle: "muted" },
};

function actionForState(state: ConstitutionalLifecycleState, domain: DomainAuthority) {
  if (state === "CUSTOMER_ACCEPTED") return ["Submit to Engineering"];
  if (state === "ENGINEERING_REVIEW") return ["Submit Engineering Certification Closure"];
  if (state === "ENGINEERING_CERTIFIED") return ["Generate Service Order Closure"];
  if (state === "CUSTOMER_SIGNED") return ["Submit ScopeVersion Closure"];
  if (state === "CONTROL_RELEASED") return ["Assign Field Closure"];
  if (state === "FIELD_INSTALLED") return ["Submit Field Close"];
  if (state === "FIELD_CLOSED") return ["Submit As-Built Verification"];
  if (state === "RETIRED") return [];
  return [`Submit ${domain} Closure`];
}

function diagnosticsForState(state: ConstitutionalLifecycleState, domain: DomainAuthority) {
  return [
    "State Registry",
    "Closure Ledger",
    "Evidence Completeness",
    "Dependency Readiness",
    "Geometry Authority",
    `${domain} Readiness`,
    state,
  ];
}

function auditChecksForState(state: ConstitutionalLifecycleState) {
  return [
    "allowed transition",
    "authority match",
    "evidence present",
    "dependency clearance",
    "closure hash",
    state === "SCOPEVERSION_CREATED" ? "ScopeVersion constitutional gate" : "domain projection refresh",
  ];
}

function hoverTemplateForState(domain: DomainAuthority) {
  return [
    "objectId",
    "spanId",
    "closureSegmentId",
    "currentState",
    "currentDomain",
    "currentAuthority",
    "allowedTransitions",
    "requiredEvidence",
    "closureLedgerId",
    "latestClosureId",
    "stationRange",
    "scopeVersionId",
    "geometryAuthorityId",
    "evidenceIds",
    "dependencies",
    "auditHash",
    `${domain}Lens`,
  ];
}

function createDefinition(stateId: ConstitutionalLifecycleState): ConstitutionalStateDefinition {
  const domain = DOMAIN_AUTHORITY_MATRIX[stateId];
  const nextState = nextLifecycleState(stateId);
  const allowedTransitions = nextState ? [nextState] : [];
  const renderStyle = RENDER_BY_DOMAIN[domain];
  return {
    stateId,
    domain,
    authority: domain,
    visibleLens: LENS_BY_DOMAIN[domain],
    visibleActions: actionForState(stateId, domain),
    allowedTransitions,
    requiredEvidence: REQUIRED_EVIDENCE_BY_STATE[stateId],
    requiredDiagnostics: diagnosticsForState(stateId, domain),
    requiredAuditChecks: auditChecksForState(stateId),
    nextStates: allowedTransitions,
    blockingStates: [],
    renderStyle,
    icon: renderStyle.icon,
    color: renderStyle.color,
    hoverTemplate: hoverTemplateForState(domain),
    toolbarActions: actionForState(stateId, domain),
    closeActions: stateId.startsWith("FIELD_") ? ["Submit Field Closure Event"] : [],
    registryAuthority: STATE_REGISTRY_AUTHORITY,
  };
}

export const CONSTITUTIONAL_STATE_REGISTRY = Object.fromEntries(
  CONSTITUTIONAL_LIFECYCLE_STATES.map((stateId) => [stateId, createDefinition(stateId)]),
) as Record<ConstitutionalLifecycleState, ConstitutionalStateDefinition>;

export function isConstitutionalLifecycleState(value: unknown): value is ConstitutionalLifecycleState {
  return typeof value === "string" && CONSTITUTIONAL_LIFECYCLE_STATES.includes(value as ConstitutionalLifecycleState);
}

export function normalizeLifecycleState(value: unknown, fallback: ConstitutionalLifecycleState = "COMMERCIAL_ASSEMBLED") {
  return isConstitutionalLifecycleState(value) ? value : fallback;
}

export function stateDefinitionFor(state: unknown) {
  return CONSTITUTIONAL_STATE_REGISTRY[normalizeLifecycleState(state)];
}

export function allowedTransitionsFor(state: unknown) {
  return stateDefinitionFor(state).allowedTransitions;
}

export function requiredEvidenceFor(state: unknown) {
  return stateDefinitionFor(state).requiredEvidence;
}

export function domainForState(state: unknown) {
  return stateDefinitionFor(state).domain;
}

export function authorityForState(state: unknown) {
  return stateDefinitionFor(state).authority;
}

export function nextStatesForState(state: unknown) {
  return stateDefinitionFor(state).nextStates;
}
