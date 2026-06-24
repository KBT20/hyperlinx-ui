import type { MarketplaceAsset } from "../marketplace/MarketplaceAsset";
import type { PrismAdvisoryCard, PrismOpportunity, PrismRecommendation, PrismRisk } from "./PrismAdvisoryCard";
import type { PrismCostDriver, PrismDiversityGap, PrismRouteAlternative, PrismWorkspace, PrismWorkspaceInput } from "./PrismWorkspace";
import type { PrismWorkspaceBlocker, PrismWorkspaceDiagnostic, PrismWorkspaceSection, PrismWorkspaceStatus } from "./PrismWorkspaceStatus";

const SECTIONS: readonly PrismWorkspaceSection[] = Object.freeze([
  "OPPORTUNITY_SUMMARY",
  "BASELINE_NETWORK_SUMMARY",
  "MARKETPLACE_OPPORTUNITIES",
  "CANDIDATE_FACILITIES",
  "CANDIDATE_SITES",
  "NETWORK_AFFINITY",
  "ROUTE_ALTERNATIVES",
  "COST_DRIVERS",
  "DIVERSITY_GAPS",
  "RISKS",
  "RECOMMENDATIONS",
  "DIAGNOSTICS",
]);

function now(value?: string) {
  return value ?? new Date().toISOString();
}

function diagnostic(
  code: PrismWorkspaceDiagnostic["code"],
  severity: PrismWorkspaceDiagnostic["severity"],
  message: string,
  input: PrismWorkspaceInput,
  details?: Record<string, unknown>,
): PrismWorkspaceDiagnostic {
  const entry: PrismWorkspaceDiagnostic = {
    diagnosticId: `${code}-${input.opportunityWorkspace.summary.opportunityId}`,
    code,
    severity,
    opportunityId: input.opportunityWorkspace.summary.opportunityId,
    message,
    timestamp: now(input.evaluatedAt),
    details,
  };
  console.info(`[${code}]`, entry);
  return entry;
}

export function identifyPrismBlockers(input: PrismWorkspaceInput): PrismWorkspaceBlocker[] {
  const blockers: PrismWorkspaceBlocker[] = [];
  const baseline = input.opportunityWorkspace.stageContext.baselineNetwork;
  const reviewStatus = input.scopeReviewWorkspace?.status ?? input.opportunityWorkspace.stageContext.scopeReviewStatus;

  if (!baseline) {
    blockers.push({
      blockerId: `PRISM-BLOCKER-${input.opportunityWorkspace.summary.opportunityId}-BASELINE`,
      severity: "CRITICAL",
      message: "Baseline Network Candidate is required before Prism.",
      requiredAction: "Generate baseline in Translate.",
    });
  }

  if (baseline?.status === "BLOCKED") {
    blockers.push({
      blockerId: `PRISM-BLOCKER-${input.opportunityWorkspace.summary.opportunityId}-BASELINE-BLOCKED`,
      severity: "CRITICAL",
      message: "Baseline Network Candidate is blocked.",
      requiredAction: "Resolve baseline synthesis blockers.",
    });
  }

  if (reviewStatus !== "APPROVED_FOR_PRISM" && reviewStatus !== "REVIEW_COMPLETE") {
    blockers.push({
      blockerId: `PRISM-BLOCKER-${input.opportunityWorkspace.summary.opportunityId}-REVIEW`,
      severity: "CRITICAL",
      message: "Scope Review must be approved before Prism can become quote-ready.",
      requiredAction: "Complete Scope Review approval.",
    });
  }

  return blockers;
}

export function evaluatePrismReadiness(input: PrismWorkspaceInput): PrismWorkspaceStatus {
  const blockers = identifyPrismBlockers(input);
  if (blockers.length) return "BLOCKED";
  return "READY_FOR_QUOTE";
}

function assetEvidenceIds(assets: readonly MarketplaceAsset[]) {
  return assets.flatMap((asset) => asset.evidenceIds);
}

export function generatePrismOpportunities(input: PrismWorkspaceInput): PrismOpportunity[] {
  const baseline = input.opportunityWorkspace.stageContext.baselineNetwork;
  const assets = input.marketplaceAssets ?? [];
  const opportunities: PrismOpportunity[] = [];

  if (baseline) {
    opportunities.push({
      opportunityId: `PRISM-OPP-${baseline.candidateId}-ROUTE`,
      opportunityType: "ROUTE_OPPORTUNITY",
      title: "Baseline route opportunity",
      summary: `${baseline.referenceArchitecture ?? "Baseline"} contains ${baseline.candidateObjects.length} candidate objects for advisory review.`,
      source: "BASELINE",
      evidenceIds: baseline.candidateObjects.flatMap((object) => object.evidenceIds),
    });
  }

  assets
    .filter((asset) => asset.status === "AVAILABLE" || asset.status === "REVIEW_REQUIRED")
    .slice(0, 5)
    .forEach((asset) => {
      opportunities.push({
        opportunityId: `PRISM-OPP-${asset.assetId}`,
        opportunityType: asset.assetType === "GPU_FACILITY" ? "GPU_OPPORTUNITY" : asset.assetType === "POWER_FEED" ? "POWER_OPPORTUNITY" : "MARKETPLACE_MATCH",
        title: asset.assetName,
        summary: `${asset.ownerName} exposes ${asset.assetType.replaceAll("_", " ")} for advisory marketplace review.`,
        source: "MARKETPLACE",
        evidenceIds: asset.evidenceIds,
      });
    });

  return opportunities;
}

export function generatePrismRisks(input: PrismWorkspaceInput): PrismRisk[] {
  const baseline = input.opportunityWorkspace.stageContext.baselineNetwork;
  const assets = input.marketplaceAssets ?? [];
  const risks: PrismRisk[] = [];
  const protection = input.opportunityWorkspace.summary.protectionSchema;

  if (protection !== "DIVERSE") {
    risks.push({
      riskId: `PRISM-RISK-${input.opportunityWorkspace.summary.opportunityId}-DIVERSITY`,
      riskCategory: "DIVERSITY_RISK",
      severity: "HIGH",
      summary: "Protection schema is not diverse.",
      mitigation: "Review diverse route or facility alternatives.",
      evidenceIds: [],
    });
  }

  if (!assets.some((asset) => asset.assetType === "POWER_FEED" || asset.assetType === "SUBSTATION")) {
    risks.push({
      riskId: `PRISM-RISK-${input.opportunityWorkspace.summary.opportunityId}-POWER`,
      riskCategory: "POWER_RISK",
      severity: "MEDIUM",
      summary: "Power evidence is not represented in marketplace assets.",
      mitigation: "Add power provider or substation evidence before quote reliance.",
      evidenceIds: [],
    });
  }

  if ((baseline?.candidateObjects.length ?? 0) > 10) {
    risks.push({
      riskId: `PRISM-RISK-${input.opportunityWorkspace.summary.opportunityId}-COST`,
      riskCategory: "COST_RISK",
      severity: "MEDIUM",
      summary: "Baseline object count may create construction and engineering cost pressure.",
      mitigation: "Review cost drivers and route alternatives before quote generation.",
      evidenceIds: baseline?.candidateObjects.flatMap((object) => object.evidenceIds) ?? [],
    });
  }

  return risks;
}

export function generatePrismRecommendations(input: PrismWorkspaceInput): PrismRecommendation[] {
  const opportunities = generatePrismOpportunities(input);
  const risks = generatePrismRisks(input);
  const recommendations: PrismRecommendation[] = [];

  if (risks.some((risk) => risk.riskCategory === "DIVERSITY_RISK")) {
    recommendations.push({
      recommendationId: `PRISM-REC-${input.opportunityWorkspace.summary.opportunityId}-DIVERSITY`,
      recommendationType: "DIVERSITY_IMPROVEMENT",
      title: "Add diverse route",
      rationale: "Diversity risk is present in the opportunity context.",
      expectedBenefit: "Improves resiliency evidence before commercial quoting.",
      humanDecisionRequired: true,
      advisoryOnly: true,
    });
  }

  if (opportunities.some((opportunity) => opportunity.opportunityType === "MARKETPLACE_MATCH")) {
    recommendations.push({
      recommendationId: `PRISM-REC-${input.opportunityWorkspace.summary.opportunityId}-MARKETPLACE`,
      recommendationType: "MARKETPLACE_MATCH",
      title: "Use marketplace asset",
      rationale: "Available marketplace assets may reduce build scope or time to quote.",
      expectedBenefit: "Improves optionality for quote construction.",
      humanDecisionRequired: true,
      advisoryOnly: true,
    });
  }

  if (opportunities.some((opportunity) => opportunity.opportunityType === "POWER_OPPORTUNITY")) {
    recommendations.push({
      recommendationId: `PRISM-REC-${input.opportunityWorkspace.summary.opportunityId}-POWER`,
      recommendationType: "POWER_OPPORTUNITY",
      title: "Add power diversity review",
      rationale: "Power-related marketplace evidence exists but remains advisory.",
      expectedBenefit: "Improves AI corridor readiness and hyperscaler review quality.",
      humanDecisionRequired: true,
      advisoryOnly: true,
    });
  }

  recommendations.push({
    recommendationId: `PRISM-REC-${input.opportunityWorkspace.summary.opportunityId}-ENGINEERING`,
    recommendationType: "ROUTE_OPPORTUNITY",
    title: "Route Engineering review required",
    rationale: "Prism cannot approve designs or create authority.",
    expectedBenefit: "Keeps advisory scoring separate from engineered truth.",
    humanDecisionRequired: true,
    advisoryOnly: true,
  });

  return recommendations;
}

export function buildAdvisoryCards(input: PrismWorkspaceInput): PrismAdvisoryCard[] {
  const opportunities = generatePrismOpportunities(input);
  const risks = generatePrismRisks(input);
  return [
    ...opportunities.slice(0, 6).map((opportunity, index) => ({
      cardId: `PRISM-CARD-${opportunity.opportunityId}`,
      category: opportunity.opportunityType,
      title: opportunity.title,
      summary: opportunity.summary,
      confidence: index < 2 ? "HIGH" as const : "MEDIUM" as const,
      impactScore: Math.max(55, 90 - index * 7),
      evidenceIds: opportunity.evidenceIds,
      advisoryOnly: true as const,
    })),
    ...risks.map((risk) => ({
      cardId: `PRISM-CARD-${risk.riskId}`,
      category: "RISK_ALERT" as const,
      title: risk.riskCategory.replaceAll("_", " "),
      summary: risk.summary,
      confidence: risk.severity === "HIGH" || risk.severity === "CRITICAL" ? "HIGH" as const : "MEDIUM" as const,
      impactScore: risk.severity === "CRITICAL" ? 95 : risk.severity === "HIGH" ? 85 : 65,
      evidenceIds: risk.evidenceIds,
      advisoryOnly: true as const,
    })),
  ];
}

export function buildRouteAlternatives(input: PrismWorkspaceInput): PrismRouteAlternative[] {
  const provided = input.routeAlternatives ? [...input.routeAlternatives] : [];
  if (provided.length) return provided;
  return [
    {
      alternativeId: `PRISM-ALT-${input.opportunityWorkspace.summary.opportunityId}-PRIMARY`,
      label: "Primary baseline corridor",
      routeType: "PRIMARY",
      summary: "Use the synthesized baseline as advisory primary route evidence.",
      evidenceIds: input.opportunityWorkspace.stageContext.baselineNetwork?.diagnostics.map((item) => item.code) ?? [],
      advisoryOnly: true,
    },
    {
      alternativeId: `PRISM-ALT-${input.opportunityWorkspace.summary.opportunityId}-DIVERSE`,
      label: "Diverse alternate corridor",
      routeType: "DIVERSE",
      summary: "Review a diversity alternative before quote reliance.",
      evidenceIds: [],
      advisoryOnly: true,
    },
  ];
}

export function buildCostDrivers(input: PrismWorkspaceInput): PrismCostDriver[] {
  return [
    {
      costDriverId: `PRISM-COST-${input.opportunityWorkspace.summary.opportunityId}-CONSTRUCTION`,
      label: "Construction distance",
      category: "CONSTRUCTION",
      impact: "HIGH",
      summary: "Baseline route length and object population will drive construction NRC.",
    },
    {
      costDriverId: `PRISM-COST-${input.opportunityWorkspace.summary.opportunityId}-MARKETPLACE`,
      label: "Marketplace leverage",
      category: "MARKETPLACE",
      impact: input.marketplaceAssets?.length ? "MEDIUM" : "HIGH",
      summary: "Marketplace assets may reduce cost if human review accepts the fit.",
    },
  ];
}

export function buildDiversityGaps(input: PrismWorkspaceInput): PrismDiversityGap[] {
  if (input.opportunityWorkspace.summary.protectionSchema === "DIVERSE") {
    return [
      {
        gapId: `PRISM-GAP-${input.opportunityWorkspace.summary.opportunityId}-DIVERSITY-EVIDENCE`,
        gapType: "ROUTE",
        summary: "Diverse protection is requested; physical diversity evidence still requires engineering review.",
        suggestedReview: "Compare shared ROW, shared crossings, and shared facilities before quote.",
      },
    ];
  }

  return [
    {
      gapId: `PRISM-GAP-${input.opportunityWorkspace.summary.opportunityId}-PROTECTION`,
      gapType: "ROUTE",
      summary: "Protection schema is not diverse.",
      suggestedReview: "Add route diversity analysis before quote readiness.",
    },
  ];
}

export function buildPrismSummary(input: PrismWorkspaceInput) {
  const status = evaluatePrismReadiness(input);
  const opportunities = generatePrismOpportunities(input);
  const risks = generatePrismRisks(input);
  const recommendations = generatePrismRecommendations(input);
  const routeAlternatives = buildRouteAlternatives(input);
  return {
    customerName: input.opportunityWorkspace.summary.customerName,
    opportunityName: input.opportunityWorkspace.summary.opportunityName,
    opportunityId: input.opportunityWorkspace.summary.opportunityId,
    networkType: input.opportunityWorkspace.summary.networkType ?? "UNKNOWN",
    protectionSchema: input.opportunityWorkspace.summary.protectionSchema ?? "UNKNOWN",
    status,
    baselineObjectCount: input.opportunityWorkspace.stageContext.baselineNetwork?.candidateObjects.length ?? 0,
    marketplaceMatchCount: input.marketplaceAssets?.length ?? 0,
    riskCount: risks.length,
    recommendationCount: recommendations.length,
    routeAlternativeCount: routeAlternatives.length,
    readyForQuote: status === "READY_FOR_QUOTE",
    nextAction: status === "READY_FOR_QUOTE" ? "GENERATE_PRELIMINARY_QUOTE" as const : "RESOLVE_BLOCKERS" as const,
  };
}

export function generatePrismDiagnostics(input: PrismWorkspaceInput): PrismWorkspaceDiagnostic[] {
  const blockers = identifyPrismBlockers(input);
  const status = evaluatePrismReadiness(input);
  return [
    diagnostic("PRISM_WORKSPACE_CREATED", "INFO", "Prism Workspace composed.", input),
    diagnostic("BASELINE_ANALYZED", input.opportunityWorkspace.stageContext.baselineNetwork ? "INFO" : "WARNING", "Baseline Network context analyzed.", input),
    diagnostic("MARKETPLACE_ANALYZED", "INFO", "Marketplace assets analyzed as advisory matches.", input, {
      assetCount: input.marketplaceAssets?.length ?? 0,
    }),
    ...generatePrismRisks(input).map((risk) =>
      diagnostic("RISK_IDENTIFIED", risk.severity === "CRITICAL" ? "ERROR" : "WARNING", risk.summary, input, {
        riskCategory: risk.riskCategory,
      }),
    ),
    ...generatePrismOpportunities(input).map((opportunity) =>
      diagnostic("OPPORTUNITY_IDENTIFIED", "INFO", opportunity.summary, input, {
        opportunityType: opportunity.opportunityType,
      }),
    ),
    ...generatePrismRecommendations(input).map((recommendation) =>
      diagnostic("RECOMMENDATION_GENERATED", "INFO", recommendation.title, input, {
        recommendationType: recommendation.recommendationType,
      }),
    ),
    diagnostic(status === "READY_FOR_QUOTE" ? "READY_FOR_QUOTE" : "PRISM_BLOCKED", blockers.length ? "WARNING" : "INFO", status === "READY_FOR_QUOTE" ? "Prism is ready for preliminary quote." : "Prism is blocked.", input, {
      blockerCount: blockers.length,
    }),
  ];
}

export function buildPrismWorkspace(input: PrismWorkspaceInput): PrismWorkspace {
  const status = evaluatePrismReadiness(input);
  const opportunities = generatePrismOpportunities(input);
  const risks = generatePrismRisks(input);
  const recommendations = generatePrismRecommendations(input);
  return {
    workspaceId: "PRISM_WORKSPACE",
    title: `Prism: ${input.opportunityWorkspace.summary.opportunityName}`,
    opportunityWorkspace: input.opportunityWorkspace,
    baselineNetwork: input.opportunityWorkspace.stageContext.baselineNetwork,
    scopeReviewWorkspace: input.scopeReviewWorkspace,
    marketplaceAssets: input.marketplaceAssets ?? [],
    candidateSites: input.candidateSites ?? [],
    sections: SECTIONS,
    status,
    summary: buildPrismSummary(input),
    advisoryCards: buildAdvisoryCards(input),
    opportunities,
    risks,
    recommendations,
    routeAlternatives: buildRouteAlternatives(input),
    costDrivers: buildCostDrivers(input),
    diversityGaps: buildDiversityGaps(input),
    blockers: identifyPrismBlockers(input),
    diagnostics: generatePrismDiagnostics(input),
    noPersistence: true,
    noServerRoutes: true,
    noAuthorityCreated: true,
    noLifecycleMutation: true,
    noScopeVersionMutation: true,
    advisoryOnly: true,
  };
}
