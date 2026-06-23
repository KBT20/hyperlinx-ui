import {
  createCorridorEvidenceBundle,
  lineGeometry,
  normalizeEndpointEvidence,
  normalizeRouteEvidence,
  pointGeometry,
} from "../CorridorNormalizationEngine";
import type { CorridorEvidenceBundle, CorridorRawEvidenceInput } from "../CorridorNormalizedEvidence";
import type { CorridorRequirement } from "../corridorTypes";
import {
  synthesizeCorridorCandidates,
  type CorridorSynthesisRequest,
} from "../CorridorSynthesisEngine";
import {
  buildCustomerSuppliedRouteBundle,
  buildEndpointPairOnlyBundle,
} from "./corridorNormalizationFixtures";

const createdAt = "2026-06-23T00:00:00.000Z";

export const aiCorridorRequirement: CorridorRequirement = {
  requirementId: "REQ-AI-CORRIDOR",
  bandwidth: "800G initial / 1.6T future-ready",
  serviceType: "AI_INTERCONNECT",
  availabilityTarget: "99.999%",
  designTopology: "DIVERSE_LINEAR",
  maxLatencyMs: 8,
  desiredDiversity: "ROUTE_DIVERSE",
  conduitCount: 4,
  fiberCount: 432,
  transportCapacity: "800G",
  routeDiversityRequired: true,
  maintenanceRequirement: "24x7 route operations",
  restorationSLA: "4 hour restoration objective",
  commercialPreference: "HYBRID",
  evidenceIds: ["EV-REQ-AI-CORRIDOR"],
};

export const middleMileRequirement: CorridorRequirement = {
  requirementId: "REQ-MIDDLE-MILE",
  bandwidth: "100G",
  serviceType: "DARK_FIBER",
  availabilityTarget: "99.99%",
  designTopology: "LINEAR",
  desiredDiversity: "PATH_DIVERSE",
  conduitCount: 2,
  fiberCount: 144,
  routeDiversityRequired: false,
  commercialPreference: "DARK_FIBER_IRU",
  evidenceIds: ["EV-REQ-MIDDLE-MILE"],
};

function endpointInput(id: string, name: string, role: "A_END" | "Z_END", longitude: number, latitude: number): CorridorRawEvidenceInput {
  return {
    sourceType: "CUSTOMER_ENDPOINT",
    sourceName: "Synthesis fixture endpoint intake",
    entityType: "ENDPOINT",
    entityId: id,
    collectedAt: createdAt,
    rawReference: `fixture:${id}`,
    normalizedPayload: { name, role },
    geometryReference: pointGeometry(longitude, latitude),
  };
}

function routeInput(id: string, name: string, coordinates: Array<[number, number]>): CorridorRawEvidenceInput {
  return {
    sourceType: "CUSTOMER_ROUTE",
    sourceName: "Synthesis fixture customer route",
    entityType: "ROUTE_CANDIDATE",
    entityId: id,
    collectedAt: createdAt,
    rawReference: `fixture:${id}`,
    normalizedPayload: { routeName: name, source: "CUSTOMER_SUPPLIED" },
    geometryReference: lineGeometry(coordinates),
  };
}

function bundle(bundleId: string, corridorId: string, endpoints: CorridorRawEvidenceInput[], routes: CorridorRawEvidenceInput[] = []): CorridorEvidenceBundle {
  return createCorridorEvidenceBundle({
    bundleId,
    corridorId,
    evidence: [
      ...normalizeEndpointEvidence(endpoints),
      ...normalizeRouteEvidence(routes),
    ],
    createdAt,
  });
}

export const dallasKansasCityEndpointPairBundle = bundle(
  "BUNDLE-DALLAS-KC",
  "CORR-DALLAS-KC-AI",
  [
    endpointInput("END-DALLAS-AI", "Dallas AI Campus", "A_END", -96.797, 32.7767),
    endpointInput("END-KANSAS-CITY-IX", "Kansas City Interconnect", "Z_END", -94.5786, 39.0997),
  ]
);

export const metroOverbuildBundle = bundle(
  "BUNDLE-METRO-OVERBUILD",
  "CORR-METRO-OVERBUILD",
  [
    endpointInput("END-METRO-A", "Metro Hub A", "A_END", -96.85, 32.78),
    endpointInput("END-METRO-Z", "Metro Hub Z", "Z_END", -96.68, 32.86),
  ],
  [
    routeInput("ROUTE-METRO-CUSTOMER", "Metro Customer Reference Route", [
      [-96.85, 32.78],
      [-96.78, 32.82],
      [-96.68, 32.86],
    ]),
  ]
);

export const longHaulBundle = bundle(
  "BUNDLE-LONG-HAUL",
  "CORR-LONG-HAUL",
  [
    endpointInput("END-DALLAS", "Dallas", "A_END", -96.797, 32.7767),
    endpointInput("END-ATLANTA", "Atlanta", "Z_END", -84.388, 33.749),
  ]
);

export const aiCorridorBundle = dallasKansasCityEndpointPairBundle;

export const middleMileBundle = bundle(
  "BUNDLE-MIDDLE-MILE",
  "CORR-MIDDLE-MILE",
  [
    endpointInput("END-REGIONAL-A", "Regional Fiber Hut A", "A_END", -97.33, 32.75),
    endpointInput("END-REGIONAL-Z", "Regional Data Center Z", "Z_END", -96.45, 33.12),
  ]
);

export const endpointPairRequest: CorridorSynthesisRequest = {
  requestId: "SYNTHESIS-ENDPOINT-PAIR",
  corridorId: "CORR-FIXTURE-ENDPOINTS",
  corridorName: "Endpoint Pair Fixture",
  evidenceBundle: buildEndpointPairOnlyBundle(),
  requirements: [aiCorridorRequirement],
  requestedCandidateTypes: ["PRIMARY", "DIVERSE", "LOW_LATENCY", "LOW_COST"],
  customerType: "HYPERSCALER",
  topologyIntent: "DIVERSE_LINEAR",
  generatedAt: createdAt,
};

export const customerRouteRequest: CorridorSynthesisRequest = {
  requestId: "SYNTHESIS-CUSTOMER-ROUTE",
  corridorId: "CORR-FIXTURE-ROUTE",
  corridorName: "Customer Route Fixture",
  evidenceBundle: buildCustomerSuppliedRouteBundle(),
  requirements: [aiCorridorRequirement],
  requestedCandidateTypes: ["CUSTOMER_SUPPLIED", "PRIMARY", "HYBRID"],
  customerType: "HYPERSCALER",
  topologyIntent: "DIVERSE_LINEAR",
  generatedAt: createdAt,
};

export const metroOverbuildRequest: CorridorSynthesisRequest = {
  requestId: "SYNTHESIS-METRO-OVERBUILD",
  corridorId: "CORR-METRO-OVERBUILD",
  corridorName: "Metro Overbuild Fixture",
  evidenceBundle: metroOverbuildBundle,
  requirements: [middleMileRequirement],
  requestedCandidateTypes: ["PRIMARY", "CUSTOMER_SUPPLIED", "EXPANSION", "LOW_COST"],
  customerType: "CARRIER",
  topologyIntent: "RING",
  generatedAt: createdAt,
};

export const longHaulRequest: CorridorSynthesisRequest = {
  requestId: "SYNTHESIS-LONG-HAUL",
  corridorId: "CORR-LONG-HAUL",
  corridorName: "Long-Haul Fixture",
  evidenceBundle: longHaulBundle,
  requirements: [middleMileRequirement],
  requestedCandidateTypes: ["PRIMARY", "DIVERSE", "LOW_LATENCY"],
  customerType: "CARRIER",
  topologyIntent: "DIVERSE_LINEAR",
  generatedAt: createdAt,
};

export const aiCorridorRequest: CorridorSynthesisRequest = {
  requestId: "SYNTHESIS-AI-CORRIDOR",
  corridorId: "CORR-DALLAS-KC-AI",
  corridorName: "Dallas to Kansas City AI Corridor",
  evidenceBundle: aiCorridorBundle,
  requirements: [aiCorridorRequirement],
  requestedCandidateTypes: ["PRIMARY", "AI_CORRIDOR", "EXPANSION", "DIVERSE"],
  customerType: "HYPERSCALER",
  topologyIntent: "DIVERSE_LINEAR",
  generatedAt: createdAt,
};

export const middleMileRequest: CorridorSynthesisRequest = {
  requestId: "SYNTHESIS-MIDDLE-MILE",
  corridorId: "CORR-MIDDLE-MILE",
  corridorName: "Middle-Mile Fixture",
  evidenceBundle: middleMileBundle,
  requirements: [middleMileRequirement],
  requestedCandidateTypes: ["PRIMARY", "DIVERSE", "EXPANSION"],
  customerType: "ISP",
  topologyIntent: "LINEAR",
  generatedAt: createdAt,
};

export function evaluateCorridorSynthesisFixtures() {
  return {
    endpointPair: synthesizeCorridorCandidates(endpointPairRequest),
    customerRoute: synthesizeCorridorCandidates(customerRouteRequest),
    metroOverbuild: synthesizeCorridorCandidates(metroOverbuildRequest),
    longHaul: synthesizeCorridorCandidates(longHaulRequest),
    aiCorridor: synthesizeCorridorCandidates(aiCorridorRequest),
    middleMile: synthesizeCorridorCandidates(middleMileRequest),
  };
}

