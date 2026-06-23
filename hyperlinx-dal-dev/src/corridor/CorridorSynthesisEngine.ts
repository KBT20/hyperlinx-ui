import type {
  CorridorCandidate,
  CorridorCandidateAttribute,
  CorridorCandidateSource,
  CorridorCandidateType,
} from "./CorridorCandidate";
import type {
  CorridorEvidenceBundle,
  CorridorNormalizedEvidence,
} from "./CorridorNormalizedEvidence";
import type {
  CorridorCoordinate,
  CorridorCustomerType,
  CorridorRequirement,
  CorridorTopology,
} from "./corridorTypes";
import type { CorridorSynthesisProviderType } from "./CorridorSynthesisContract";

export type CorridorSynthesisDiagnosticCode =
  | "CORRIDOR_SYNTHESIS_STARTED"
  | "CORRIDOR_PRIMARY_CREATED"
  | "CORRIDOR_CUSTOMER_ROUTE_PRESERVED"
  | "CORRIDOR_DIVERSE_PLACEHOLDER_CREATED"
  | "CORRIDOR_AI_PLACEHOLDER_CREATED"
  | "CORRIDOR_EXPANSION_PLACEHOLDER_CREATED"
  | "CORRIDOR_SYNTHESIS_COMPLETE"
  | "CORRIDOR_SYNTHESIS_WARNING"
  | "CORRIDOR_SYNTHESIS_ERROR";

export interface CorridorSynthesisDiagnostic {
  diagnosticId: string;
  code: CorridorSynthesisDiagnosticCode;
  severity: "INFO" | "WARNING" | "ERROR";
  message: string;
  candidateId?: string;
  evidenceIds: string[];
  details?: Record<string, unknown>;
}

export interface CorridorSynthesisProviderHook {
  providerId: string;
  providerType: CorridorSynthesisProviderType;
  evidenceOnly: true;
  status: "NOT_IMPLEMENTED";
  supportedCandidateTypes: CorridorCandidateType[];
  notes: string;
}

export type CorridorSynthesisCreationMethod =
  | "ENDPOINT_STRAIGHT_LINE_PLACEHOLDER"
  | "CUSTOMER_ROUTE_PRESERVATION"
  | "DIVERSITY_PLACEHOLDER"
  | "AI_CORRIDOR_PLACEHOLDER"
  | "EXPANSION_PLACEHOLDER"
  | "HYBRID_PLACEHOLDER";

export interface CorridorSynthesisRequest {
  requestId: string;
  corridorId: string;
  corridorName?: string;
  evidenceBundle: CorridorEvidenceBundle;
  requirements: CorridorRequirement[];
  requestedCandidateTypes?: CorridorCandidateType[];
  customerType?: CorridorCustomerType;
  topologyIntent?: CorridorTopology;
  generatedAt?: string;
}

export interface CorridorSynthesisCandidate extends CorridorCandidate {
  source: CorridorCandidateSource;
  evidenceIds: string[];
  requirements: CorridorRequirement[];
  diagnostics: CorridorSynthesisDiagnostic[];
  providerSources: CorridorSynthesisProviderType[];
  creationMethod: CorridorSynthesisCreationMethod;
  generatedAt: string;
  diversityStatus?: "NOT_EVALUATED" | "EVALUATION_REQUIRED";
}

export interface CorridorSynthesisResult {
  requestId: string;
  corridorId: string;
  candidates: CorridorSynthesisCandidate[];
  diagnostics: CorridorSynthesisDiagnostic[];
  providerHooks: CorridorSynthesisProviderHook[];
  preservedCustomerRouteEvidenceIds: string[];
  generatedAt: string;
}

export const CORRIDOR_SYNTHESIS_PROVIDER_HOOKS: CorridorSynthesisProviderHook[] = [
  {
    providerId: "provider-osrm",
    providerType: "OSRM",
    evidenceOnly: true,
    status: "NOT_IMPLEMENTED",
    supportedCandidateTypes: ["PRIMARY", "LOW_LATENCY", "LOW_COST"],
    notes: "Future road-route evidence provider. No API call in V1.",
  },
  {
    providerId: "provider-graphhopper",
    providerType: "GRAPHHOPPER",
    evidenceOnly: true,
    status: "NOT_IMPLEMENTED",
    supportedCandidateTypes: ["PRIMARY", "DIVERSE", "LOW_COST"],
    notes: "Future route evidence provider. No API call in V1.",
  },
  {
    providerId: "provider-openrouteservice",
    providerType: "OPENROUTESERVICE",
    evidenceOnly: true,
    status: "NOT_IMPLEMENTED",
    supportedCandidateTypes: ["PRIMARY", "LOW_RISK", "DIVERSE"],
    notes: "Future route/isochrone evidence provider. No API call in V1.",
  },
  {
    providerId: "provider-google-roads",
    providerType: "GOOGLE_ROADS",
    evidenceOnly: true,
    status: "NOT_IMPLEMENTED",
    supportedCandidateTypes: ["PRIMARY", "LOW_LATENCY"],
    notes: "Future roads/snap evidence provider. No API call in V1.",
  },
  {
    providerId: "provider-dot-gis",
    providerType: "DOT_GIS",
    evidenceOnly: true,
    status: "NOT_IMPLEMENTED",
    supportedCandidateTypes: ["LOW_RISK", "DIVERSE", "EXPANSION"],
    notes: "Future DOT/GIS evidence provider. No API call in V1.",
  },
  {
    providerId: "provider-internal-teralinx",
    providerType: "INTERNAL_TERALINX_MODEL",
    evidenceOnly: true,
    status: "NOT_IMPLEMENTED",
    supportedCandidateTypes: ["AI_CORRIDOR", "EXPANSION", "HYBRID"],
    notes: "Future internal synthesis provider. No model execution in V1.",
  },
];

const DEFAULT_CANDIDATE_TYPES: CorridorCandidateType[] = [
  "PRIMARY",
  "DIVERSE",
  "LOW_LATENCY",
  "LOW_COST",
  "AI_CORRIDOR",
  "EXPANSION",
  "CUSTOMER_SUPPLIED",
  "HYBRID",
];

function stableHash(value: unknown) {
  const text = JSON.stringify(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function safeId(value: unknown, fallback: string) {
  const text = String(value ?? fallback).trim();
  return text.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "") || fallback;
}

function diagnostic(args: Omit<CorridorSynthesisDiagnostic, "diagnosticId">): CorridorSynthesisDiagnostic {
  const item = {
    diagnosticId: `corridor-synthesis-${args.code.toLowerCase()}-${args.candidateId ?? stableHash(args.message)}`,
    ...args,
  };
  if (args.severity === "ERROR") {
    console.error(`[${args.code}]`, item);
  } else if (args.severity === "WARNING") {
    console.warn(`[${args.code}]`, item);
  } else {
    console.log(`[${args.code}]`, item);
  }
  return item;
}

function pointFromEvidence(evidence: CorridorNormalizedEvidence): CorridorCoordinate | undefined {
  if (evidence.geometryReference?.geometryType !== "POINT") return undefined;
  return evidence.geometryReference.coordinate;
}

function lineFromEvidence(evidence: CorridorNormalizedEvidence): CorridorCoordinate[] | undefined {
  if (evidence.geometryReference?.geometryType !== "LINESTRING") return undefined;
  return evidence.geometryReference.coordinates;
}

function endpointRole(evidence: CorridorNormalizedEvidence): string | undefined {
  return String(evidence.normalizedPayload.role ?? evidence.normalizedPayload.endpointRole ?? "").toUpperCase() || undefined;
}

function findEndpointPair(bundle: CorridorEvidenceBundle) {
  const endpoints = bundle.endpoints.filter((endpoint) => Boolean(pointFromEvidence(endpoint)));
  const aEnd = endpoints.find((endpoint) => ["A", "A_END", "A-END"].includes(endpointRole(endpoint) ?? "")) ?? endpoints[0];
  const zEnd = endpoints.find((endpoint) => ["Z", "Z_END", "Z-END"].includes(endpointRole(endpoint) ?? "")) ?? endpoints.find((endpoint) => endpoint.entityId !== aEnd?.entityId);
  return { aEnd, zEnd };
}

function distanceMiles(a: CorridorCoordinate, z: CorridorCoordinate) {
  const radiusMiles = 3958.7613;
  const lat1 = (a[1] * Math.PI) / 180;
  const lat2 = (z[1] * Math.PI) / 180;
  const deltaLat = ((z[1] - a[1]) * Math.PI) / 180;
  const deltaLon = ((z[0] - a[0]) * Math.PI) / 180;
  const h =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return 2 * radiusMiles * Math.asin(Math.sqrt(h));
}

function requirementIds(requirements: CorridorRequirement[]) {
  return requirements.map((requirement) => requirement.requirementId);
}

function baseCandidate(args: {
  request: CorridorSynthesisRequest;
  candidateType: CorridorCandidateType;
  candidateSource: CorridorCandidateSource;
  name: string;
  description: string;
  geometry: CorridorCoordinate[];
  sourceEvidenceIds: string[];
  preservedCustomerRouteEvidenceIds?: string[];
  attributes?: CorridorCandidateAttribute[];
  diagnostics?: CorridorSynthesisDiagnostic[];
  providerSources?: CorridorSynthesisProviderType[];
  creationMethod: CorridorSynthesisCreationMethod;
  diversityStatus?: "NOT_EVALUATED" | "EVALUATION_REQUIRED";
  generatedAt: string;
}): CorridorSynthesisCandidate {
  const candidateId = `CAND-${safeId(args.request.corridorId, "corridor")}-${args.candidateType}-${stableHash({
    geometry: args.geometry,
    evidence: args.sourceEvidenceIds,
    method: args.creationMethod,
  })}`;
  const totalMiles = args.geometry.length >= 2 ? distanceMiles(args.geometry[0]!, args.geometry[args.geometry.length - 1]!) : undefined;
  return {
    candidateId,
    corridorId: args.request.corridorId,
    candidateType: args.candidateType,
    candidateSource: args.candidateSource,
    customerType: args.request.customerType,
    topologyIntent: args.request.topologyIntent,
    name: args.name,
    description: args.description,
    endpointIds: args.request.evidenceBundle.endpoints.map((endpoint) => endpoint.entityId),
    requirementIds: requirementIds(args.request.requirements),
    geometry: args.geometry,
    distanceMiles: totalMiles,
    providerIds: args.providerSources ?? [],
    sourceEvidenceIds: args.sourceEvidenceIds,
    preservedCustomerRouteEvidenceIds: args.preservedCustomerRouteEvidenceIds ?? [],
    segmentIds: [],
    attributes: args.attributes ?? [],
    diversityLevel: args.diversityStatus ? "UNKNOWN" : undefined,
    diversityEvidenceIds: [],
    scorePlaceholder: {
      candidateId,
      scoreModel: "PRISM_PENDING",
      notes: "Corridor Synthesis V1 does not score candidates.",
    },
    promotionEligible: false,
    createdAt: args.generatedAt,
    source: args.candidateSource,
    evidenceIds: args.sourceEvidenceIds,
    requirements: args.request.requirements,
    diagnostics: args.diagnostics ?? [],
    providerSources: args.providerSources ?? [],
    creationMethod: args.creationMethod,
    generatedAt: args.generatedAt,
    diversityStatus: args.diversityStatus,
  };
}

export function synthesizeFromEndpoints(request: CorridorSynthesisRequest): CorridorSynthesisCandidate | undefined {
  const generatedAt = request.generatedAt ?? new Date().toISOString();
  const { aEnd, zEnd } = findEndpointPair(request.evidenceBundle);
  const a = aEnd ? pointFromEvidence(aEnd) : undefined;
  const z = zEnd ? pointFromEvidence(zEnd) : undefined;
  if (!aEnd || !zEnd || !a || !z) {
    diagnostic({
      code: "CORRIDOR_SYNTHESIS_WARNING",
      severity: "WARNING",
      message: "Endpoint synthesis requires two endpoint evidence records with point coordinates.",
      evidenceIds: request.evidenceBundle.endpoints.map((endpoint) => endpoint.evidenceId),
    });
    return undefined;
  }

  const candidate = baseCandidate({
    request,
    candidateType: "PRIMARY",
    candidateSource: "ENDPOINT_PAIR",
    name: `${request.corridorName ?? request.corridorId} Primary`,
    description: "V1 primary candidate using straight-line endpoint placeholder geometry. No routing provider was called.",
    geometry: [a, z],
    sourceEvidenceIds: [aEnd.evidenceId, zEnd.evidenceId],
    creationMethod: "ENDPOINT_STRAIGHT_LINE_PLACEHOLDER",
    generatedAt,
  });
  const created = diagnostic({
    code: "CORRIDOR_PRIMARY_CREATED",
    severity: "INFO",
    message: "Primary endpoint-pair placeholder candidate created.",
    candidateId: candidate.candidateId,
    evidenceIds: candidate.sourceEvidenceIds,
    details: { geometryType: "STRAIGHT_LINE_PLACEHOLDER" },
  });
  candidate.diagnostics.push(created);
  return candidate;
}

export function synthesizeFromCustomerRoute(request: CorridorSynthesisRequest): CorridorSynthesisCandidate[] {
  const generatedAt = request.generatedAt ?? new Date().toISOString();
  return request.evidenceBundle.routes
    .map((routeEvidence) => {
      const geometry = lineFromEvidence(routeEvidence);
      if (!geometry || geometry.length < 2) return undefined;
      const candidate = baseCandidate({
        request,
        candidateType: "CUSTOMER_SUPPLIED",
        candidateSource: "CUSTOMER_ROUTE",
        name: String(routeEvidence.normalizedPayload.routeName ?? routeEvidence.normalizedPayload.name ?? `${request.corridorName ?? request.corridorId} Customer Route`),
        description: "Customer supplied route preserved exactly from normalized route evidence.",
        geometry,
        sourceEvidenceIds: [routeEvidence.evidenceId],
        preservedCustomerRouteEvidenceIds: [routeEvidence.evidenceId],
        creationMethod: "CUSTOMER_ROUTE_PRESERVATION",
        generatedAt,
      });
      const created = diagnostic({
        code: "CORRIDOR_CUSTOMER_ROUTE_PRESERVED",
        severity: "INFO",
        message: "Customer supplied route evidence preserved as candidate without geometry modification.",
        candidateId: candidate.candidateId,
        evidenceIds: [routeEvidence.evidenceId],
      });
      candidate.diagnostics.push(created);
      return candidate;
    })
    .filter((candidate): candidate is CorridorSynthesisCandidate => Boolean(candidate));
}

export function createDiverseCandidate(request: CorridorSynthesisRequest, basis?: CorridorSynthesisCandidate): CorridorSynthesisCandidate | undefined {
  const primary = basis ?? synthesizeFromEndpoints(request);
  if (!primary) return undefined;
  const generatedAt = request.generatedAt ?? new Date().toISOString();
  const candidate = baseCandidate({
    request,
    candidateType: "DIVERSE",
    candidateSource: "PROVIDER_GENERATED",
    name: `${request.corridorName ?? request.corridorId} Diverse Placeholder`,
    description: "Diversity placeholder. V1 does not compute route diversity.",
    geometry: primary.geometry,
    sourceEvidenceIds: primary.sourceEvidenceIds,
    attributes: [
      {
        attributeId: `attribute-${primary.candidateId}-diversity-status`,
        candidateId: primary.candidateId,
        type: "ROUTE_DIVERSITY",
        label: "Diversity Status",
        value: "NOT_EVALUATED",
        evidenceIds: primary.sourceEvidenceIds,
      },
    ],
    providerSources: ["INTERNAL_TERALINX_MODEL"],
    creationMethod: "DIVERSITY_PLACEHOLDER",
    diversityStatus: "NOT_EVALUATED",
    generatedAt,
  });
  const created = diagnostic({
    code: "CORRIDOR_DIVERSE_PLACEHOLDER_CREATED",
    severity: "INFO",
    message: "Diverse candidate placeholder created. Diversity is not evaluated in V1.",
    candidateId: candidate.candidateId,
    evidenceIds: candidate.sourceEvidenceIds,
  });
  candidate.diagnostics.push(created);
  return candidate;
}

export function createAiCorridorCandidate(request: CorridorSynthesisRequest, basis?: CorridorSynthesisCandidate): CorridorSynthesisCandidate | undefined {
  const primary = basis ?? synthesizeFromEndpoints(request);
  if (!primary) return undefined;
  const generatedAt = request.generatedAt ?? new Date().toISOString();
  const attributes: CorridorCandidateAttribute[] = [
    "POWER_PROXIMITY",
    "SUBSTATION_PROXIMITY",
    "TRANSMISSION_PROXIMITY",
    "INTERCONNECTION_DENSITY",
    "EXPANSION_LAND",
    "FUTURE_AI_DEMAND",
  ].map((type) => ({
    attributeId: `attribute-${primary.candidateId}-${type.toLowerCase()}`,
    candidateId: primary.candidateId,
    type: type as CorridorCandidateAttribute["type"],
    label: type.replace(/_/g, " "),
    value: "PLACEHOLDER_NOT_ENRICHED",
    evidenceIds: primary.sourceEvidenceIds,
  }));
  const candidate = baseCandidate({
    request,
    candidateType: "AI_CORRIDOR",
    candidateSource: "PROVIDER_GENERATED",
    name: `${request.corridorName ?? request.corridorId} AI Corridor Placeholder`,
    description: "AI corridor placeholder with power, interconnection, expansion, and AI demand attributes awaiting enrichment.",
    geometry: primary.geometry,
    sourceEvidenceIds: primary.sourceEvidenceIds,
    attributes,
    providerSources: ["INTERNAL_TERALINX_MODEL"],
    creationMethod: "AI_CORRIDOR_PLACEHOLDER",
    generatedAt,
  });
  const created = diagnostic({
    code: "CORRIDOR_AI_PLACEHOLDER_CREATED",
    severity: "INFO",
    message: "AI corridor placeholder created without enrichment or scoring.",
    candidateId: candidate.candidateId,
    evidenceIds: candidate.sourceEvidenceIds,
  });
  candidate.diagnostics.push(created);
  return candidate;
}

export function createExpansionCandidate(request: CorridorSynthesisRequest, basis?: CorridorSynthesisCandidate): CorridorSynthesisCandidate | undefined {
  const primary = basis ?? synthesizeFromEndpoints(request);
  if (!primary) return undefined;
  const generatedAt = request.generatedAt ?? new Date().toISOString();
  const attributes: CorridorCandidateAttribute[] = [
    { type: "FUTURE_CAPACITY_EXPANSION", label: "Future Capacity" },
    { type: "MONETIZATION_POTENTIAL", label: "Residual Duct" },
    { type: "MONETIZATION_POTENTIAL", label: "Residual Fiber" },
    { type: "EXPANSION_LAND", label: "Expansion Land" },
    { type: "CONSTRUCTABILITY_SIGNAL", label: "Future Build Zones" },
  ].map((item) => ({
    attributeId: `attribute-${primary.candidateId}-${safeId(item.label, "expansion").toLowerCase()}`,
    candidateId: primary.candidateId,
    type: item.type as CorridorCandidateAttribute["type"],
    label: item.label,
    value: "PLACEHOLDER_NOT_CALCULATED",
    evidenceIds: primary.sourceEvidenceIds,
  }));
  const candidate = baseCandidate({
    request,
    candidateType: "EXPANSION",
    candidateSource: "PROVIDER_GENERATED",
    name: `${request.corridorName ?? request.corridorId} Expansion Placeholder`,
    description: "Expansion placeholder for future capacity, residual duct/fiber, expansion land, and future build zones.",
    geometry: primary.geometry,
    sourceEvidenceIds: primary.sourceEvidenceIds,
    attributes,
    providerSources: ["INTERNAL_TERALINX_MODEL"],
    creationMethod: "EXPANSION_PLACEHOLDER",
    generatedAt,
  });
  const created = diagnostic({
    code: "CORRIDOR_EXPANSION_PLACEHOLDER_CREATED",
    severity: "INFO",
    message: "Expansion placeholder created without calculations.",
    candidateId: candidate.candidateId,
    evidenceIds: candidate.sourceEvidenceIds,
  });
  candidate.diagnostics.push(created);
  return candidate;
}

function createLowLatencyPlaceholder(request: CorridorSynthesisRequest, basis?: CorridorSynthesisCandidate) {
  const primary = basis ?? synthesizeFromEndpoints(request);
  if (!primary) return undefined;
  return baseCandidate({
    request,
    candidateType: "LOW_LATENCY",
    candidateSource: "PROVIDER_GENERATED",
    name: `${request.corridorName ?? request.corridorId} Low Latency Placeholder`,
    description: "Low-latency placeholder. V1 does not call routing or optical models.",
    geometry: primary.geometry,
    sourceEvidenceIds: primary.sourceEvidenceIds,
    attributes: [{
      attributeId: `attribute-${primary.candidateId}-latency-placeholder`,
      candidateId: primary.candidateId,
      type: "LATENCY_SENSITIVITY",
      label: "Latency",
      value: "PLACEHOLDER_NOT_CALCULATED",
      evidenceIds: primary.sourceEvidenceIds,
    }],
    providerSources: ["INTERNAL_TERALINX_MODEL"],
    creationMethod: "HYBRID_PLACEHOLDER",
    generatedAt: request.generatedAt ?? new Date().toISOString(),
  });
}

function createLowCostPlaceholder(request: CorridorSynthesisRequest, basis?: CorridorSynthesisCandidate) {
  const primary = basis ?? synthesizeFromEndpoints(request);
  if (!primary) return undefined;
  return baseCandidate({
    request,
    candidateType: "LOW_COST",
    candidateSource: "PROVIDER_GENERATED",
    name: `${request.corridorName ?? request.corridorId} Low Cost Placeholder`,
    description: "Low-cost placeholder. V1 does not calculate cost.",
    geometry: primary.geometry,
    sourceEvidenceIds: primary.sourceEvidenceIds,
    attributes: [{
      attributeId: `attribute-${primary.candidateId}-cost-placeholder`,
      candidateId: primary.candidateId,
      type: "CONSTRUCTABILITY_SIGNAL",
      label: "Cost",
      value: "PLACEHOLDER_NOT_CALCULATED",
      evidenceIds: primary.sourceEvidenceIds,
    }],
    providerSources: ["INTERNAL_TERALINX_MODEL"],
    creationMethod: "HYBRID_PLACEHOLDER",
    generatedAt: request.generatedAt ?? new Date().toISOString(),
  });
}

function createHybridPlaceholder(request: CorridorSynthesisRequest, basis?: CorridorSynthesisCandidate) {
  const primary = basis ?? synthesizeFromEndpoints(request);
  if (!primary) return undefined;
  return baseCandidate({
    request,
    candidateType: "HYBRID",
    candidateSource: "HYBRID",
    name: `${request.corridorName ?? request.corridorId} Hybrid Placeholder`,
    description: "Hybrid placeholder preserving evidence lineage. V1 does not blend geometries.",
    geometry: primary.geometry,
    sourceEvidenceIds: Array.from(new Set([...primary.sourceEvidenceIds, ...request.evidenceBundle.evidence.map((item) => item.evidenceId)])),
    providerSources: ["INTERNAL_TERALINX_MODEL"],
    creationMethod: "HYBRID_PLACEHOLDER",
    generatedAt: request.generatedAt ?? new Date().toISOString(),
  });
}

export function synthesizeCorridorCandidates(request: CorridorSynthesisRequest): CorridorSynthesisResult {
  const generatedAt = request.generatedAt ?? new Date().toISOString();
  const diagnostics: CorridorSynthesisDiagnostic[] = [
    diagnostic({
      code: "CORRIDOR_SYNTHESIS_STARTED",
      severity: "INFO",
      message: "Corridor synthesis started.",
      evidenceIds: request.evidenceBundle.evidence.map((item) => item.evidenceId),
      details: { requestId: request.requestId, corridorId: request.corridorId },
    }),
  ];
  const requested = request.requestedCandidateTypes?.length ? request.requestedCandidateTypes : DEFAULT_CANDIDATE_TYPES;
  const candidates: CorridorSynthesisCandidate[] = [];
  const primary = requested.includes("PRIMARY") ? synthesizeFromEndpoints({ ...request, generatedAt }) : undefined;
  if (primary) candidates.push(primary);

  if (requested.includes("CUSTOMER_SUPPLIED")) {
    candidates.push(...synthesizeFromCustomerRoute({ ...request, generatedAt }));
  }
  if (requested.includes("DIVERSE")) {
    const candidate = createDiverseCandidate({ ...request, generatedAt }, primary);
    if (candidate) candidates.push(candidate);
  }
  if (requested.includes("LOW_LATENCY")) {
    const candidate = createLowLatencyPlaceholder({ ...request, generatedAt }, primary);
    if (candidate) candidates.push(candidate);
  }
  if (requested.includes("LOW_COST")) {
    const candidate = createLowCostPlaceholder({ ...request, generatedAt }, primary);
    if (candidate) candidates.push(candidate);
  }
  if (requested.includes("AI_CORRIDOR")) {
    const candidate = createAiCorridorCandidate({ ...request, generatedAt }, primary);
    if (candidate) candidates.push(candidate);
  }
  if (requested.includes("EXPANSION")) {
    const candidate = createExpansionCandidate({ ...request, generatedAt }, primary);
    if (candidate) candidates.push(candidate);
  }
  if (requested.includes("HYBRID")) {
    const candidate = createHybridPlaceholder({ ...request, generatedAt }, primary);
    if (candidate) candidates.push(candidate);
  }

  if (!candidates.length) {
    diagnostics.push(diagnostic({
      code: "CORRIDOR_SYNTHESIS_ERROR",
      severity: "ERROR",
      message: "Corridor synthesis produced no candidates. Check endpoint and route evidence.",
      evidenceIds: request.evidenceBundle.evidence.map((item) => item.evidenceId),
    }));
  }

  diagnostics.push(diagnostic({
    code: "CORRIDOR_SYNTHESIS_COMPLETE",
    severity: "INFO",
    message: `Corridor synthesis completed with ${candidates.length} candidates.`,
    evidenceIds: request.evidenceBundle.evidence.map((item) => item.evidenceId),
    details: { candidateCount: candidates.length },
  }));

  return {
    requestId: request.requestId,
    corridorId: request.corridorId,
    candidates,
    diagnostics,
    providerHooks: CORRIDOR_SYNTHESIS_PROVIDER_HOOKS,
    preservedCustomerRouteEvidenceIds: Array.from(new Set(candidates.flatMap((candidate) => candidate.preservedCustomerRouteEvidenceIds))),
    generatedAt,
  };
}

