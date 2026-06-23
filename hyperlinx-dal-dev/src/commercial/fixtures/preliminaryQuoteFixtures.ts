import type { CorridorClass, CorridorNetworkRole } from "../../corridor/corridorTypes";
import type { CorridorLensObjectType, CorridorLensType } from "../../corridor/CorridorLens";
import type { ReferenceArchitectureToolType } from "../../corridor/CorridorReferenceArchitecture";
import { matchReferenceArchitectures } from "../../corridor/CorridorReferenceArchitectureEngine";
import type { PrismDecisionSummary } from "../../corridor/PrismDecisionHierarchy";
import type { PrismEvidenceConfidence, PrismScore } from "../../corridor/PrismScoreContract";
import { recommendCorridorCandidate, type PrismRecommendationInput } from "../../corridor/PrismRecommendationEngine";
import { createPrismRecommendationFixtures } from "../../corridor/fixtures/prismRecommendationFixtures";
import { createOpportunityPackage, createPreliminaryQuote, type PreliminaryQuoteInput } from "../PreliminaryQuoteEngine";
import type { OpportunityPackage } from "../OpportunityPackage";
import type { PreliminaryQuote } from "../PreliminaryQuote";

export interface PreliminaryQuoteFixture {
  fixtureId: string;
  label: string;
  scenario: string;
  input: PreliminaryQuoteInput;
  expectedCommercialUse: string;
}

interface Seed {
  candidateId: string;
  corridorId: string;
  lensType: CorridorLensType;
  networkRole: CorridorNetworkRole;
  corridorClasses: CorridorClass[];
  customerRequirement: string;
  availableObjectTypes: CorridorLensObjectType[];
  availableToolEvidence: ReferenceArchitectureToolType[];
  expectedArchitectureId: string;
  score: number;
  confidence: PrismEvidenceConfidence;
}

function score(seed: Seed): PrismScore {
  return {
    scoreId: `SCORE-${seed.candidateId}`,
    candidateId: seed.candidateId,
    corridorId: seed.corridorId,
    scoredAt: "2026-06-23T00:00:00.000Z",
    summary: {
      overallScore: seed.score,
      categoryScores: [],
      confidence: seed.confidence,
      confidenceValue: seed.confidence === "VERIFIED" ? 1 : seed.confidence === "HIGH" ? 0.85 : seed.confidence === "MEDIUM" ? 0.65 : 0.35,
      warnings: [],
      evidenceUsed: [],
      diagnostics: [],
    },
    doctrine: "PRISM_SCORING_IS_ADVISORY_ONLY",
  };
}

function decision(seed: Seed): PrismDecisionSummary {
  return {
    decisionId: `DECISION-${seed.candidateId}`,
    corridorId: seed.corridorId,
    candidateId: seed.candidateId,
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
  };
}

function recommendationInput(seed: Seed): PrismRecommendationInput {
  const fits = matchReferenceArchitectures({
    lensTypes: [seed.lensType],
    networkRoles: [seed.networkRole],
    corridorClasses: seed.corridorClasses,
    customerAsk: seed.customerRequirement,
    availableObjectTypes: seed.availableObjectTypes,
    availableToolEvidence: seed.availableToolEvidence,
  });
  return {
    candidateId: seed.candidateId,
    corridorId: seed.corridorId,
    lensType: seed.lensType,
    networkRole: seed.networkRole,
    customerRequirement: seed.customerRequirement,
    referenceArchitectureFit: fits.find((fit) => fit.architectureId === seed.expectedArchitectureId) ?? fits[0],
    availableObjectTypes: seed.availableObjectTypes,
    prismScore: score(seed),
    decisionSummary: decision(seed),
    routeEngineeringReviewed: false,
    routeDiversityReviewed: true,
    regenAdmOpticalReviewComplete: true,
    powerCapacityVerified: true,
    jurisdictionRiskResolved: true,
    crossingRiskResolved: true,
  };
}

function quoteInputFromRecommendationFixture(index: number, customerAsk: string): PreliminaryQuoteInput {
  const recommendationFixture = createPrismRecommendationFixtures()[index];
  return {
    recommendation: recommendCorridorCandidate(recommendationFixture.input),
    referenceArchitectureFit: recommendationFixture.input.referenceArchitectureFit,
    productPlan: recommendationFixture.input.prismScore ? undefined : undefined,
    objectPopulationPlan: recommendationFixture.input.referenceArchitectureFit ? undefined : undefined,
    customerAsk,
  };
}

function darkFiberIruInput(): PreliminaryQuoteInput {
  const seed: Seed = {
    candidateId: "CAND-DARK-FIBER-IRU",
    corridorId: "CORRIDOR-DARK-FIBER-IRU",
    lensType: "DARK_FIBER_IRU",
    networkRole: "BACKBONE_INTERCONNECT",
    corridorClasses: ["LONGHAUL", "INTERCONNECTION"],
    customerRequirement: "fiber pair IRU with diverse routing strand reservation",
    availableObjectTypes: ["FIBER", "FIBER_PAIR", "SPLICE", "DATA_CENTER", "CARRIER_HOTEL", "BACKBONE_NODE"],
    availableToolEvidence: ["FIBER_COUNT_PLANNING", "DARK_FIBER_IRU_MODEL", "ROUTE_DIVERSITY_REVIEW", "DATA_CENTER_PROVIDER", "CARRIER_HOTEL_PROVIDER"],
    expectedArchitectureId: "REF-ARCH-DARK-FIBER-IRU",
    score: 79,
    confidence: "HIGH",
  };
  const input = recommendationInput(seed);
  return {
    recommendation: recommendCorridorCandidate(input),
    referenceArchitectureFit: input.referenceArchitectureFit,
    customerAsk: seed.customerRequirement,
  };
}

export function createPreliminaryQuoteFixtures(): PreliminaryQuoteFixture[] {
  return [
    {
      fixtureId: "PRELIM-QUOTE-DFW-KC-HYPERSCALER",
      label: "Dallas to Kansas City Hyperscaler Long Haul",
      scenario: "400G/800G ready, route diversity, future AI expansion.",
      input: quoteInputFromRecommendationFixture(0, "Dallas to Kansas City 400G/800G ready route diversity future AI expansion"),
      expectedCommercialUse: "Advisory AI interconnect and transport estimate before engineering approval.",
    },
    {
      fixtureId: "PRELIM-QUOTE-WTX-AI",
      label: "West Texas AI Expansion",
      scenario: "Power-adjacent AI footprint to Dallas with future campus expansion.",
      input: quoteInputFromRecommendationFixture(1, "West Texas AI data center footprint to Dallas"),
      expectedCommercialUse: "Advisory AI interconnect estimate with power review risk.",
    },
    {
      fixtureId: "PRELIM-QUOTE-METRO-DCI",
      label: "Metro Data Center Interconnect",
      scenario: "Metro facility handoff and cloud/interconnection access.",
      input: quoteInputFromRecommendationFixture(4, "Metro data center interconnect and building access"),
      expectedCommercialUse: "Advisory managed fiber or Ethernet transport estimate.",
    },
    {
      fixtureId: "PRELIM-QUOTE-DUCT-MONETIZATION",
      label: "Duct Monetization Opportunity",
      scenario: "Spare duct sale and residual capacity monetization.",
      input: quoteInputFromRecommendationFixture(2, "Spare duct sale and maintenance responsibility"),
      expectedCommercialUse: "Advisory duct sale and residual capacity estimate.",
    },
    {
      fixtureId: "PRELIM-QUOTE-ENTERPRISE-ACCESS",
      label: "Enterprise Access Opportunity",
      scenario: "Enterprise lateral and building entry serviceability.",
      input: quoteInputFromRecommendationFixture(4, "Enterprise building lateral and managed fiber access"),
      expectedCommercialUse: "Advisory managed fiber estimate before building entry review.",
    },
    {
      fixtureId: "PRELIM-QUOTE-DARK-FIBER-IRU",
      label: "Dark Fiber IRU Opportunity",
      scenario: "Fiber pair IRU with diverse routing and strand reservation.",
      input: darkFiberIruInput(),
      expectedCommercialUse: "Advisory IRU estimate before strand reservation and handoff approval.",
    },
  ];
}

export function evaluatePreliminaryQuoteFixtures(): PreliminaryQuote[] {
  return createPreliminaryQuoteFixtures().map((fixture) => createPreliminaryQuote(fixture.input));
}

export function evaluateOpportunityPackageFixtures(): OpportunityPackage[] {
  return createPreliminaryQuoteFixtures().map((fixture) => createOpportunityPackage(fixture.input));
}
