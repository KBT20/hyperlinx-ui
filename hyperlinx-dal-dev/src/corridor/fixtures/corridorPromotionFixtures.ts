import {
  evaluateCorridorPromotionReadiness,
  mapCorridorCandidateToScopeVersionDraft,
} from "../CorridorPromotionEngine";
import type { CorridorPromotionInput } from "../corridorPromotion";
import type {
  ConduitSystem,
  Constraint,
  Corridor,
  CorridorEndpoint,
  CorridorEvidence,
  CorridorRequirement,
  CorridorRouteCandidate,
  Crossing,
  FiberSystem,
  Jurisdiction,
  OpticalSystem,
} from "../corridorTypes";

const createdAt = "2026-06-23T00:00:00.000Z";

export const validEndpointPairCorridor: Corridor = {
  corridorId: "CORR-VALID-AI-001",
  corridorName: "Dallas AI Campus Diverse Path",
  corridorClass: "METRO",
  customerType: "HYPERSCALER",
  designObjective: "Provide low-latency diverse conduit and fiber path between AI campus and cloud onramp.",
  endpointIds: ["END-AI-A", "END-AI-Z"],
  routeCandidateIds: ["RC-CUSTOMER-001"],
  status: "SYNTHESIS_READY",
  requirements: [],
  evidenceIds: ["EV-CORR-001"],
  createdAt,
  updatedAt: createdAt,
};

export const validEndpoints: CorridorEndpoint[] = [
  {
    endpointId: "END-AI-A",
    name: "AI Campus A",
    type: "HYPERSCALER_CAMPUS",
    address: "100 Compute Dr, Dallas, TX",
    latitude: 32.7767,
    longitude: -96.797,
    owner: "Teralinx Customer",
    role: "A_END",
    evidenceIds: ["EV-END-A"],
  },
  {
    endpointId: "END-AI-Z",
    name: "Cloud Onramp Z",
    type: "CLOUD_ONRAMP",
    address: "200 Onramp Ave, Dallas, TX",
    latitude: 32.812,
    longitude: -96.754,
    owner: "Cloud Partner",
    role: "Z_END",
    evidenceIds: ["EV-END-Z"],
  },
];

export const validRequirement: CorridorRequirement = {
  requirementId: "REQ-AI-001",
  bandwidth: "800G initial / 1.6T future-ready",
  serviceType: "AI_INTERCONNECT",
  availabilityTarget: "99.999%",
  designTopology: "DIVERSE_LINEAR",
  maxLatencyMs: 2.5,
  desiredDiversity: "ROUTE_DIVERSE",
  conduitCount: 4,
  fiberCount: 432,
  transportCapacity: "800G",
  routeDiversityRequired: true,
  maintenanceRequirement: "24x7 route operations",
  restorationSLA: "4 hour restoration objective",
  commercialPreference: "HYBRID",
  evidenceIds: ["EV-CORR-001"],
};

export const validCustomerSuppliedRouteCandidate: CorridorRouteCandidate = {
  routeCandidateId: "RC-CUSTOMER-001",
  corridorId: "CORR-VALID-AI-001",
  source: "CUSTOMER_SUPPLIED",
  geometry: [
    [-96.797, 32.7767],
    [-96.783, 32.786],
    [-96.767, 32.798],
    [-96.754, 32.812],
  ],
  distanceMiles: 4.8,
  estimatedLatencyMs: 0.04,
  routeClass: "PRIMARY",
  diversityGroupId: "DIV-A",
  constructabilityScore: 82,
  riskScore: 28,
  monetizationScore: 62,
  score: 84,
  evidenceIds: ["EV-ROUTE-001"],
};

export const validJurisdiction: Jurisdiction = {
  jurisdictionId: "JUR-DALLAS-001",
  type: "CITY",
  name: "City of Dallas",
  segmentIds: ["seg-1", "seg-2"],
  permitRequired: true,
  permitComplexity: 35,
  expectedLeadTimeDays: 45,
  evidenceIds: ["EV-JUR-001"],
};

export const validCrossing: Crossing = {
  crossingId: "XING-ROAD-001",
  type: "ROAD",
  owner: "City of Dallas",
  method: "BORE",
  estimatedCost: 28000,
  permitRequired: true,
  riskScore: 24,
  evidenceIds: ["EV-XING-001"],
};

export const mitigatedConstraint: Constraint = {
  constraintId: "CONSTRAINT-ROW-001",
  type: "ROW",
  severity: "MEDIUM",
  affectedSegmentIds: ["seg-2"],
  mitigation: "Use existing public ROW alignment pending permit confirmation.",
  evidenceIds: ["EV-CONSTRAINT-001"],
};

export const validConduitSystem: ConduitSystem = {
  conduitSystemId: "CONDUIT-001",
  corridorId: "CORR-VALID-AI-001",
  ductCount: 4,
  ductSize: "2 inch",
  occupiedDucts: 1,
  reservedDucts: 1,
  availableDucts: 2,
  owner: "Teralinx",
  saleEligible: true,
  maintenanceRequired: true,
  maintenanceModel: "OWNER_MAINTAINED",
  evidenceIds: ["EV-CONDUIT-001"],
};

export const validFiberSystem: FiberSystem = {
  fiberSystemId: "FIBER-001",
  corridorId: "CORR-VALID-AI-001",
  fiberCount: 432,
  fiberType: "ULTRA_LOW_LOSS",
  strandGroups: [{ strandGroupId: "SG-CUSTOMER", strandCount: 288, use: "CUSTOMER_RESERVED" }],
  reservedStrands: 288,
  availableStrands: 144,
  iruEligible: true,
  transportEligible: true,
  evidenceIds: ["EV-FIBER-001"],
};

export const validOpticalSystem: OpticalSystem = {
  opticalSystemId: "OPTICAL-001",
  corridorId: "CORR-VALID-AI-001",
  designCapacity: "800G",
  waveCapacity: "2 x 400G",
  amplificationRequired: false,
  regenRequired: false,
  maxSpanMiles: 60,
  topology: "DIVERSE_LINEAR",
  serviceStandards: ["DWDM", "OTN", "400G", "800G", "1.6T_FUTURE_READY"],
  evidenceIds: ["EV-OPTICAL-001"],
};

export const validPromotionEvidence: CorridorEvidence[] = [
  { evidenceId: "EV-CORR-001", sourceType: "ENDPOINT_CSV", sourceName: "Customer requirement sheet", collectedAt: createdAt, confidence: 92, entityType: "CORRIDOR", entityId: "CORR-VALID-AI-001", normalizedValue: { service: "AI_INTERCONNECT" } },
  { evidenceId: "EV-END-A", sourceType: "ENDPOINT_CSV", sourceName: "Customer endpoint CSV", collectedAt: createdAt, confidence: 95, entityType: "ENDPOINT", entityId: "END-AI-A" },
  { evidenceId: "EV-END-Z", sourceType: "ENDPOINT_CSV", sourceName: "Customer endpoint CSV", collectedAt: createdAt, confidence: 94, entityType: "ENDPOINT", entityId: "END-AI-Z" },
  { evidenceId: "EV-ROUTE-001", sourceType: "CUSTOMER_ROUTE_FILE", sourceName: "Customer supplied KML", collectedAt: createdAt, confidence: 88, entityType: "ROUTE_CANDIDATE", entityId: "RC-CUSTOMER-001" },
  { evidenceId: "EV-JUR-001", sourceType: "DOT_GIS", sourceName: "Municipal jurisdiction layer", collectedAt: createdAt, confidence: 76, entityType: "JURISDICTION", entityId: "JUR-DALLAS-001" },
  { evidenceId: "EV-XING-001", sourceType: "DOT_GIS", sourceName: "Road crossing layer", collectedAt: createdAt, confidence: 73, entityType: "CROSSING", entityId: "XING-ROAD-001" },
  { evidenceId: "EV-CONSTRAINT-001", sourceType: "HUMAN_ENGINEERING_REVIEW", sourceName: "Engineering ROW note", collectedAt: createdAt, confidence: 90, entityType: "CONSTRAINT", entityId: "CONSTRAINT-ROW-001" },
  { evidenceId: "EV-CONDUIT-001", sourceType: "HUMAN_ENGINEERING_REVIEW", sourceName: "Conduit assumption", collectedAt: createdAt, confidence: 86, entityType: "CONDUIT_SYSTEM", entityId: "CONDUIT-001" },
  { evidenceId: "EV-FIBER-001", sourceType: "HUMAN_ENGINEERING_REVIEW", sourceName: "Fiber assumption", collectedAt: createdAt, confidence: 86, entityType: "FIBER_SYSTEM", entityId: "FIBER-001" },
  { evidenceId: "EV-OPTICAL-001", sourceType: "HUMAN_ENGINEERING_REVIEW", sourceName: "Optical assumption", collectedAt: createdAt, confidence: 84, entityType: "OPTICAL_SYSTEM", entityId: "OPTICAL-001" },
  { evidenceId: "EV-APPROVAL-001", sourceType: "HUMAN_ENGINEERING_REVIEW", sourceName: "Promotion approval", collectedAt: createdAt, confidence: 100, entityType: "ROUTE_CANDIDATE", entityId: "RC-CUSTOMER-001", notes: "Approved for ScopeVersion drafting only." },
];

export const validPromotionInput: CorridorPromotionInput = {
  promotionId: "PROMO-VALID-AI-001",
  corridor: {
    ...validEndpointPairCorridor,
    requirements: [validRequirement],
  },
  routeCandidate: validCustomerSuppliedRouteCandidate,
  endpoints: validEndpoints,
  requirements: [validRequirement],
  evidence: validPromotionEvidence,
  conduitSystems: [validConduitSystem],
  fiberSystems: [validFiberSystem],
  opticalSystems: [validOpticalSystem],
  jurisdictions: [validJurisdiction],
  crossings: [validCrossing],
  constraints: [mitigatedConstraint],
  reviewedBy: "engineering.reviewer@teralinx.example",
  reviewedAt: createdAt,
  approvalEvidenceId: "EV-APPROVAL-001",
};

export const invalidMissingEndpointInput: CorridorPromotionInput = {
  ...validPromotionInput,
  promotionId: "PROMO-MISSING-ENDPOINT",
  endpoints: validEndpoints.filter((endpoint) => endpoint.role !== "Z_END"),
};

export const invalidMissingRequirementInput: CorridorPromotionInput = {
  ...validPromotionInput,
  promotionId: "PROMO-MISSING-REQUIREMENT",
  corridor: {
    ...validEndpointPairCorridor,
    requirements: [],
  },
  requirements: [],
};

export const unresolvedHighRiskConstraint: Constraint = {
  constraintId: "CONSTRAINT-RAIL-FATAL-001",
  type: "RAIL",
  severity: "CRITICAL",
  affectedSegmentIds: ["seg-3"],
  evidenceIds: ["EV-CONSTRAINT-RAIL-001"],
};

export const invalidHighRiskInput: CorridorPromotionInput = {
  ...validPromotionInput,
  promotionId: "PROMO-HIGH-RISK",
  constraints: [unresolvedHighRiskConstraint],
  evidence: [
    ...validPromotionEvidence,
    { evidenceId: "EV-CONSTRAINT-RAIL-001", sourceType: "DOT_GIS", sourceName: "Rail crossing fatal risk", collectedAt: createdAt, confidence: 82, entityType: "CONSTRAINT", entityId: "CONSTRAINT-RAIL-FATAL-001" },
  ],
};

export function evaluatePromotionFixtures() {
  const validEvaluation = evaluateCorridorPromotionReadiness(validPromotionInput);
  return {
    validEvaluation,
    validDraft: mapCorridorCandidateToScopeVersionDraft(validPromotionInput),
    invalidMissingEndpoint: evaluateCorridorPromotionReadiness(invalidMissingEndpointInput),
    invalidMissingRequirement: evaluateCorridorPromotionReadiness(invalidMissingRequirementInput),
    invalidHighRisk: evaluateCorridorPromotionReadiness(invalidHighRiskInput),
  };
}

