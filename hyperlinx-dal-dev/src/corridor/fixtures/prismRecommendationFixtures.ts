import type { CorridorClass, CorridorNetworkRole } from "../corridorTypes";
import type { CorridorLensObjectType, CorridorLensType } from "../CorridorLens";
import type { ReferenceArchitectureFit, ReferenceArchitectureToolType } from "../CorridorReferenceArchitecture";
import { matchReferenceArchitectures } from "../CorridorReferenceArchitectureEngine";
import type { PrismDecisionSummary } from "../PrismDecisionHierarchy";
import type { PrismEvidenceConfidence, PrismScore } from "../PrismScoreContract";
import { recommendCorridorCandidate, type PrismRecommendationInput } from "../PrismRecommendationEngine";
import type { PrismRecommendation } from "../PrismRecommendationContract";

export interface PrismRecommendationFixture {
  fixtureId: string;
  label: string;
  input: PrismRecommendationInput;
  expectedOutcome: string;
}

interface FitSeed {
  candidateId: string;
  corridorId: string;
  lensType: CorridorLensType;
  networkRole: CorridorNetworkRole;
  corridorClasses: CorridorClass[];
  customerRequirement: string;
  availableObjectTypes: CorridorLensObjectType[];
  availableToolEvidence: ReferenceArchitectureToolType[];
  expectedArchitectureId: string;
}

function score(candidateId: string, corridorId: string, overallScore: number, confidence: PrismEvidenceConfidence): PrismScore {
  return {
    scoreId: `SCORE-${candidateId}`,
    candidateId,
    corridorId,
    scoredAt: "2026-06-23T00:00:00.000Z",
    summary: {
      overallScore,
      categoryScores: [],
      confidence,
      confidenceValue: confidence === "VERIFIED" ? 1 : confidence === "HIGH" ? 0.85 : confidence === "MEDIUM" ? 0.65 : 0.35,
      warnings: [],
      evidenceUsed: [],
      diagnostics: [],
    },
    doctrine: "PRISM_SCORING_IS_ADVISORY_ONLY",
  };
}

function decision(candidateId: string, corridorId: string, overrides: Partial<PrismDecisionSummary> = {}): PrismDecisionSummary {
  return {
    decisionId: `DECISION-${candidateId}`,
    candidateId,
    corridorId,
    hardExclusion: "PASS",
    strategicFit: "STRONG",
    commercialPotential: "HIGH",
    engineeringFeasibility: "FAVORABLE",
    optimization: "GOOD",
    reviewRequired: true,
    layerResults: [],
    conflicts: [],
    diagnostics: [],
    doctrine: "PRISM_HIERARCHY_GOVERNS_SCORING",
    ...overrides,
  };
}

function fit(seed: FitSeed): ReferenceArchitectureFit {
  const fits = matchReferenceArchitectures({
    lensTypes: [seed.lensType],
    networkRoles: [seed.networkRole],
    corridorClasses: seed.corridorClasses,
    customerAsk: seed.customerRequirement,
    availableObjectTypes: seed.availableObjectTypes,
    availableToolEvidence: seed.availableToolEvidence,
  });
  return fits.find((item) => item.architectureId === seed.expectedArchitectureId) ?? fits[0];
}

function baseInput(seed: FitSeed, overallScore: number, confidence: PrismEvidenceConfidence): PrismRecommendationInput {
  return {
    candidateId: seed.candidateId,
    corridorId: seed.corridorId,
    lensType: seed.lensType,
    networkRole: seed.networkRole,
    customerRequirement: seed.customerRequirement,
    referenceArchitectureFit: fit(seed),
    availableObjectTypes: seed.availableObjectTypes,
    prismScore: score(seed.candidateId, seed.corridorId, overallScore, confidence),
    decisionSummary: decision(seed.candidateId, seed.corridorId),
    routeEngineeringReviewed: false,
    routeDiversityReviewed: true,
    regenAdmOpticalReviewComplete: true,
    powerCapacityVerified: true,
    jurisdictionRiskResolved: true,
    crossingRiskResolved: true,
  };
}

export function createPrismRecommendationFixtures(): PrismRecommendationFixture[] {
  const hyperscalerSeed: FitSeed = {
    candidateId: "CAND-HYPER-LONGHAUL",
    corridorId: "CORRIDOR-DFW-KC",
    lensType: "HYPERSCALER",
    networkRole: "AI_FABRIC",
    corridorClasses: ["LONGHAUL", "AI_CORRIDOR"],
    customerRequirement: "Dallas to Kansas City 400G/800G ready route diversity future AI expansion data center interconnect",
    availableObjectTypes: ["CONDUIT", "FIBER", "REGEN_SITE", "DATA_CENTER", "SUBSTATION", "TRANSMISSION_LINE", "CARRIER_HOTEL", "CLOUD_ONRAMP"],
    availableToolEvidence: [
      "DOT_GIS",
      "SHAPEFILE_TRANSLATE",
      "KML_KMZ_TRANSLATE",
      "SUBSTATION_PROVIDER",
      "TRANSMISSION_PROVIDER",
      "DATA_CENTER_PROVIDER",
      "CARRIER_HOTEL_PROVIDER",
      "CLOUD_ONRAMP_PROVIDER",
      "OPTICAL_REACH_REVIEW",
      "REGEN_SPACING_REVIEW",
      "ROUTE_DIVERSITY_REVIEW",
      "DARK_FIBER_IRU_MODEL",
      "TRANSPORT_REVENUE_MODEL",
      "HYPERSCALER_BUSINESS_CASE_MODEL",
    ],
    expectedArchitectureId: "REF-ARCH-HYPERSCALER-LONG-HAUL",
  };

  const aiSeed: FitSeed = {
    candidateId: "CAND-AI-WTX",
    corridorId: "CORRIDOR-WTX-DALLAS",
    lensType: "POWER_AI_EXPANSION",
    networkRole: "AI_FABRIC",
    corridorClasses: ["AI_CORRIDOR", "REGIONAL"],
    customerRequirement: "West Texas data center footprint to Dallas power-adjacent land future AI campus",
    availableObjectTypes: ["SUBSTATION", "TRANSMISSION_LINE", "GENERATION_SITE", "PARCEL", "DEVELOPMENT_SITE", "FIBER"],
    availableToolEvidence: ["SUBSTATION_PROVIDER", "TRANSMISSION_PROVIDER", "GENERATION_PROVIDER", "PARCEL_GIS", "POWER_PROXIMITY_EVALUATION", "HYPERSCALER_BUSINESS_CASE_MODEL"],
    expectedArchitectureId: "REF-ARCH-AI-POWER-EXPANSION",
  };

  const ductSeed: FitSeed = {
    candidateId: "CAND-DUCT-MSA",
    corridorId: "CORRIDOR-METRO-DUCT",
    lensType: "DUCT_MONETIZATION",
    networkRole: "METRO_AGGREGATION",
    corridorClasses: ["METRO"],
    customerRequirement: "spare duct sale maintenance responsibility residual capacity",
    availableObjectTypes: ["CONDUIT", "INNERDUCT", "RIGHT_OF_WAY", "JURISDICTION"],
    availableToolEvidence: ["DUCT_CAPACITY_PLANNING", "RESIDUAL_CAPACITY_MODEL", "DUCT_SALE_MODEL", "MUNICIPAL_GIS", "COUNTY_GIS", "JURISDICTION_REVIEW", "MAINTENANCE_ACCESS_REVIEW"],
    expectedArchitectureId: "REF-ARCH-DUCT-SALE-MAINTENANCE",
  };

  const transportSeed: FitSeed = {
    candidateId: "CAND-TRANSPORT-WAVE",
    corridorId: "CORRIDOR-WAVE-01",
    lensType: "TRANSPORT",
    networkRole: "BACKBONE_INTERCONNECT",
    corridorClasses: ["LONGHAUL"],
    customerRequirement: "protected wavelength transport wave SLA optical service",
    availableObjectTypes: ["REGEN_SITE", "ADM_SITE", "POP", "DATA_CENTER", "CARRIER_HOTEL"],
    availableToolEvidence: ["OPTICAL_REACH_REVIEW", "REGEN_SPACING_REVIEW", "ADM_PLACEMENT_REVIEW", "RESTORATION_REVIEW", "TRANSPORT_REVENUE_MODEL", "DATA_CENTER_PROVIDER", "CARRIER_HOTEL_PROVIDER"],
    expectedArchitectureId: "REF-ARCH-TRANSPORT-WAVE",
  };

  const enterpriseSeed: FitSeed = {
    candidateId: "CAND-ENTERPRISE-METRO",
    corridorId: "CORRIDOR-ENT-ACCESS",
    lensType: "ENTERPRISE",
    networkRole: "METRO_AGGREGATION",
    corridorClasses: ["METRO"],
    customerRequirement: "enterprise building lateral commercial serviceability building entry",
    availableObjectTypes: ["ENTERPRISE_BUILDING", "CONDUIT", "FIBER", "PARCEL", "JURISDICTION"],
    availableToolEvidence: ["CSV_TRANSLATE", "PARCEL_GIS", "MUNICIPAL_GIS", "ENTERPRISE_MONETIZATION_MODEL", "MAINTENANCE_ACCESS_REVIEW", "JURISDICTION_REVIEW"],
    expectedArchitectureId: "REF-ARCH-ENTERPRISE-METRO-ACCESS",
  };

  return [
    {
      fixtureId: "PRISM-REC-HYPERSCALER-LONGHAUL",
      label: "Hyperscaler long-haul recommendation",
      input: baseInput(hyperscalerSeed, 91, "HIGH"),
      expectedOutcome: "RECOMMENDED with Route Engineering review required.",
    },
    {
      fixtureId: "PRISM-REC-AI-EXPANSION",
      label: "West Texas AI expansion recommendation",
      input: baseInput(aiSeed, 84, "HIGH"),
      expectedOutcome: "RECOMMENDED or ACCEPTABLE when power evidence is verified.",
    },
    {
      fixtureId: "PRISM-REC-DUCT-MONETIZATION",
      label: "Duct monetization recommendation",
      input: baseInput(ductSeed, 76, "MEDIUM"),
      expectedOutcome: "ACCEPTABLE with residual capacity review.",
    },
    {
      fixtureId: "PRISM-REC-TRANSPORT-WAVE",
      label: "Transport wave recommendation",
      input: baseInput(transportSeed, 78, "HIGH"),
      expectedOutcome: "ACCEPTABLE with optical review context.",
    },
    {
      fixtureId: "PRISM-REC-ENTERPRISE-METRO",
      label: "Enterprise metro access recommendation",
      input: baseInput(enterpriseSeed, 71, "HIGH"),
      expectedOutcome: "ACCEPTABLE with building entry review.",
    },
    {
      fixtureId: "PRISM-REC-ENVIRONMENTAL-REJECTED",
      label: "Rejected environmental blocker",
      input: {
        ...baseInput(enterpriseSeed, 42, "MEDIUM"),
        decisionSummary: decision("CAND-ENTERPRISE-METRO", "CORRIDOR-ENT-ACCESS", {
          hardExclusion: "FAIL",
          strategicFit: "WEAK",
          blockedByLayer: "HARD_EXCLUSION",
          conflicts: [
            {
              conflictId: "CONFLICT-ENV-001",
              candidateId: "CAND-ENTERPRISE-METRO",
              layer: "HARD_EXCLUSION",
              conflictType: "ENVIRONMENTAL",
              description: "Environmental constraint blocks advisory progression.",
              evidenceIds: ["EVIDENCE-ENV-001"],
              findingIds: ["FINDING-ENV-001"],
              confidenceImpact: "BLOCKING_REVIEW",
              resolutionPolicy: "HUMAN_REVIEW_REQUIRED",
            },
          ],
        }),
        unresolvedConflictIds: ["CONFLICT-ENV-001"],
      },
      expectedOutcome: "REJECTED because hard exclusion failed.",
    },
    {
      fixtureId: "PRISM-REC-CONDITIONAL-POWER",
      label: "Conditional recommendation missing power evidence",
      input: {
        ...baseInput(aiSeed, 84, "HIGH"),
        powerCapacityVerified: false,
      },
      expectedOutcome: "CONDITIONAL because power capacity remains unverified.",
    },
    {
      fixtureId: "PRISM-REC-CONDITIONAL-REGEN-ADM",
      label: "Conditional recommendation requiring regen/ADM review",
      input: {
        ...baseInput(transportSeed, 82, "HIGH"),
        regenAdmOpticalReviewComplete: false,
      },
      expectedOutcome: "CONDITIONAL because regen/ADM/optical review is required.",
    },
  ];
}

export function evaluatePrismRecommendationFixtures(): PrismRecommendation[] {
  return createPrismRecommendationFixtures().map((fixture) => recommendCorridorCandidate(fixture.input));
}
