import type { PreliminaryQuoteAssumption } from "./PreliminaryQuoteAssumption";
import type { PreliminaryQuoteConfidence, PreliminaryQuoteConfidenceBasis } from "./PreliminaryQuoteConfidence";
import type {
  PreliminaryQuoteBlocker,
  PreliminaryQuoteDiagnostic,
  PreliminaryQuoteLineItem,
  PreliminaryQuoteRisk,
  PreliminaryQuoteWorkspace,
  PreliminaryQuoteWorkspaceInput,
  PreliminaryQuoteWorkspaceSection,
} from "./PreliminaryQuoteWorkspace";
import type { PreliminaryQuoteProduct, QuoteReadiness } from "./PreliminaryQuoteWorkspaceSummary";

const SECTIONS: readonly PreliminaryQuoteWorkspaceSection[] = Object.freeze([
  "CUSTOMER_SUMMARY",
  "OPPORTUNITY_SUMMARY",
  "NETWORK_INTENT",
  "PROTECTION_SCHEMA",
  "REFERENCE_ARCHITECTURE",
  "RECOMMENDED_PRODUCTS",
  "MARKETPLACE_INPUTS",
  "ESTIMATED_NRC",
  "ESTIMATED_MRC",
  "ESTIMATED_TERM",
  "ASSUMPTIONS",
  "RISKS",
  "CONFIDENCE",
  "DIAGNOSTICS",
  "NEXT_ACTION",
]);

function now(value?: string) {
  return value ?? new Date().toISOString();
}

function diagnostic(
  code: PreliminaryQuoteDiagnostic["code"],
  severity: PreliminaryQuoteDiagnostic["severity"],
  message: string,
  input: PreliminaryQuoteWorkspaceInput,
  details?: Record<string, unknown>,
): PreliminaryQuoteDiagnostic {
  const opportunityId = input.prismWorkspace.summary.opportunityId;
  const entry: PreliminaryQuoteDiagnostic = {
    diagnosticId: `${code}-${opportunityId}`,
    code,
    severity,
    opportunityId,
    message,
    timestamp: now(input.evaluatedAt),
    details,
  };
  console.info(`[${code}]`, entry);
  return entry;
}

function lowestConfidence(values: PreliminaryQuoteConfidence[]): PreliminaryQuoteConfidence {
  if (values.includes("LOW")) return "LOW";
  if (values.includes("MEDIUM")) return "MEDIUM";
  return "HIGH";
}

export function identifyQuoteBlockers(input: PreliminaryQuoteWorkspaceInput): PreliminaryQuoteBlocker[] {
  const blockers: PreliminaryQuoteBlocker[] = [];
  const opportunity = input.prismWorkspace.opportunityWorkspace;

  if (!opportunity.summary.opportunityId || !opportunity.summary.customerName) {
    blockers.push({
      blockerId: `QUOTE-BLOCKER-${input.prismWorkspace.summary.opportunityId}-OPPORTUNITY`,
      severity: "CRITICAL",
      message: "Opportunity context is required.",
      requiredAction: "Complete Opportunity intake.",
    });
  }

  if (opportunity.stageContext.translateStatus !== "COMPLETE") {
    blockers.push({
      blockerId: `QUOTE-BLOCKER-${input.prismWorkspace.summary.opportunityId}-TRANSLATE`,
      severity: "CRITICAL",
      message: "Translate must be complete before preliminary quote review.",
      requiredAction: "Complete Translate workflow.",
    });
  }

  const reviewStatus = input.prismWorkspace.scopeReviewWorkspace?.status ?? opportunity.stageContext.scopeReviewStatus;
  if (reviewStatus !== "APPROVED_FOR_PRISM" && reviewStatus !== "REVIEW_COMPLETE") {
    blockers.push({
      blockerId: `QUOTE-BLOCKER-${input.prismWorkspace.summary.opportunityId}-REVIEW`,
      severity: "CRITICAL",
      message: "Scope Review must be approved before quote discussion.",
      requiredAction: "Complete Scope Review approval.",
    });
  }

  if (input.prismWorkspace.status !== "READY_FOR_QUOTE" && opportunity.stageContext.prismStatus !== "COMPLETE") {
    blockers.push({
      blockerId: `QUOTE-BLOCKER-${input.prismWorkspace.summary.opportunityId}-PRISM`,
      severity: "CRITICAL",
      message: "Prism must be complete or ready for quote.",
      requiredAction: "Resolve Prism blockers.",
    });
  }

  input.prismWorkspace.blockers
    .filter((blocker) => blocker.severity === "CRITICAL")
    .forEach((blocker) => {
      blockers.push({
        blockerId: `QUOTE-${blocker.blockerId}`,
        severity: "CRITICAL",
        message: blocker.message,
        requiredAction: blocker.requiredAction,
      });
    });

  return blockers;
}

export function evaluateQuoteReadiness(input: PreliminaryQuoteWorkspaceInput): QuoteReadiness {
  const blockers = identifyQuoteBlockers(input);
  if (blockers.length) return "BLOCKED";
  return input.quoteGenerated ? "QUOTE_GENERATED" : "READY_FOR_QUOTE";
}

export function selectRecommendedProducts(input: PreliminaryQuoteWorkspaceInput): PreliminaryQuoteProduct[] {
  if (input.recommendedProducts?.length) return [...input.recommendedProducts];

  const networkType = input.prismWorkspace.summary.networkType;
  const products = new Set<PreliminaryQuoteProduct>();

  if (networkType === "AI_CORRIDOR") {
    products.add("AI_INTERCONNECT");
    products.add("DATA_CENTER_INTERCONNECT");
    products.add("GPU_FACILITY");
    products.add("POWER_INFRASTRUCTURE");
    products.add("LONG_HAUL");
  } else if (networkType === "LONG_HAUL") {
    products.add("DARK_FIBER");
    products.add("WAVELENGTH");
    products.add("LONG_HAUL");
  } else if (networkType === "METRO") {
    products.add("METRO_ACCESS");
    products.add("ETHERNET");
    products.add("MANAGED_INFRASTRUCTURE");
  } else if (networkType === "MIDDLE_MILE") {
    products.add("MIDDLE_MILE");
    products.add("DARK_FIBER");
  }

  input.prismWorkspace.marketplaceAssets.forEach((asset) => {
    if (asset.assetType === "GPU_FACILITY") products.add("GPU_FACILITY");
    if (asset.assetType === "POWER_FEED") products.add("POWER_INFRASTRUCTURE");
    if (asset.assetType === "TRANSPORT_CAPABILITY") products.add("WAVELENGTH");
    if (asset.assetType === "CARRIER_HOTEL" || asset.assetType === "DATA_CENTER") products.add("DATA_CENTER_INTERCONNECT");
  });

  if (!products.size) products.add("MANAGED_INFRASTRUCTURE");
  return [...products];
}

export function generateQuoteAssumptions(input: PreliminaryQuoteWorkspaceInput): PreliminaryQuoteAssumption[] {
  const opportunityId = input.prismWorkspace.summary.opportunityId;
  return [
    {
      assumptionId: `QUOTE-ASSUMPTION-${opportunityId}-ENGINEERING`,
      category: "ENGINEERING",
      statement: "Engineering validation is required before any contractual quote or SOF.",
      confidence: "HIGH",
      evidenceIds: [],
      requiresValidation: true,
      advisoryOnly: true,
    },
    {
      assumptionId: `QUOTE-ASSUMPTION-${opportunityId}-MARKETPLACE`,
      category: "MARKETPLACE",
      statement: "Marketplace inputs are fixture-based and do not represent vendor commitments.",
      confidence: input.prismWorkspace.marketplaceAssets.length ? "MEDIUM" : "LOW",
      evidenceIds: input.prismWorkspace.marketplaceAssets.flatMap((asset) => asset.evidenceIds),
      requiresValidation: true,
      advisoryOnly: true,
    },
    {
      assumptionId: `QUOTE-ASSUMPTION-${opportunityId}-COMMERCIAL`,
      category: "COMMERCIAL",
      statement: "NRC, MRC, term, and TCV are preliminary commercial recommendation values only.",
      confidence: "MEDIUM",
      evidenceIds: input.prismWorkspace.recommendations.map((recommendation) => recommendation.recommendationId),
      requiresValidation: true,
      advisoryOnly: true,
    },
  ];
}

export function generateQuoteConfidence(input: PreliminaryQuoteWorkspaceInput): PreliminaryQuoteConfidenceBasis {
  const opportunity = input.prismWorkspace.opportunityWorkspace;
  const dataCompleteness: PreliminaryQuoteConfidence = opportunity.summary.locationCount && opportunity.summary.attachmentCount ? "HIGH" : "LOW";
  const marketplaceCompleteness: PreliminaryQuoteConfidence = input.prismWorkspace.marketplaceAssets.length >= 3 ? "HIGH" : input.prismWorkspace.marketplaceAssets.length ? "MEDIUM" : "LOW";
  const architectureCompleteness: PreliminaryQuoteConfidence = input.prismWorkspace.baselineNetwork?.referenceArchitecture ? "HIGH" : "LOW";
  const reviewStatus = input.prismWorkspace.scopeReviewWorkspace?.status ?? opportunity.stageContext.scopeReviewStatus;
  const reviewCompleteness: PreliminaryQuoteConfidence = reviewStatus === "APPROVED_FOR_PRISM" || reviewStatus === "REVIEW_COMPLETE" ? "HIGH" : "LOW";
  const prismCompleteness: PreliminaryQuoteConfidence = input.prismWorkspace.status === "READY_FOR_QUOTE" || opportunity.stageContext.prismStatus === "COMPLETE" ? "HIGH" : "LOW";

  return {
    dataCompleteness,
    marketplaceCompleteness,
    architectureCompleteness,
    reviewCompleteness,
    prismCompleteness,
    overallConfidence: lowestConfidence([dataCompleteness, marketplaceCompleteness, architectureCompleteness, reviewCompleteness, prismCompleteness]),
    advisoryOnly: true,
  };
}

function defaultNrc(input: PreliminaryQuoteWorkspaceInput) {
  if (input.estimatedNrc !== undefined) return input.estimatedNrc;
  const base = 185000;
  const objectFactor = (input.prismWorkspace.baselineNetwork?.candidateObjects.length ?? 1) * 42000;
  const marketplaceCredit = input.prismWorkspace.marketplaceAssets.length * 12000;
  return Math.max(95000, base + objectFactor - marketplaceCredit);
}

function defaultMrc(input: PreliminaryQuoteWorkspaceInput) {
  if (input.estimatedMrc !== undefined) return input.estimatedMrc;
  const productFactor = selectRecommendedProducts(input).length * 8500;
  const networkFactor = input.prismWorkspace.summary.networkType === "AI_CORRIDOR" ? 38000 : 14000;
  return networkFactor + productFactor;
}

export function generateLineItems(input: PreliminaryQuoteWorkspaceInput): PreliminaryQuoteLineItem[] {
  const products = selectRecommendedProducts(input);
  const nrc = defaultNrc(input);
  const mrc = defaultMrc(input);
  return products.map((product, index) => ({
    lineItemId: `QUOTE-LINE-${input.prismWorkspace.summary.opportunityId}-${product}`,
    label: product.replaceAll("_", " "),
    product,
    estimatedNrc: Math.round(nrc / products.length),
    estimatedMrc: Math.round(mrc / products.length),
    source: index % 2 === 0 ? "PRISM_FIXTURE" : "MARKETPLACE_FIXTURE",
    advisoryOnly: true,
  }));
}

export function generateQuoteRisks(input: PreliminaryQuoteWorkspaceInput): PreliminaryQuoteRisk[] {
  return input.prismWorkspace.risks.map((risk) => ({
    riskId: `QUOTE-${risk.riskId}`,
    severity: risk.severity,
    summary: risk.summary,
    mitigation: risk.mitigation,
  }));
}

export function generateQuoteDiagnostics(input: PreliminaryQuoteWorkspaceInput): PreliminaryQuoteDiagnostic[] {
  const blockers = identifyQuoteBlockers(input);
  const readiness = evaluateQuoteReadiness(input);
  const products = selectRecommendedProducts(input);
  return [
    diagnostic("QUOTE_WORKSPACE_CREATED", "INFO", "Preliminary Quote Workspace composed.", input),
    diagnostic("PRODUCTS_SELECTED", "INFO", "Recommended products selected from fixture context.", input, {
      products,
    }),
    diagnostic("ASSUMPTIONS_GENERATED", "INFO", "Quote assumptions generated.", input, {
      assumptionCount: generateQuoteAssumptions(input).length,
    }),
    diagnostic("CONFIDENCE_CALCULATED", "INFO", "Quote confidence calculated from fixture completeness.", input, {
      confidenceBasis: generateQuoteConfidence(input),
    }),
    diagnostic(readiness === "BLOCKED" ? "QUOTE_BLOCKED" : "READY_FOR_CUSTOMER_DISCUSSION", blockers.length ? "WARNING" : "INFO", readiness === "BLOCKED" ? "Preliminary quote is blocked." : "Preliminary quote is ready for customer discussion.", input, {
      readiness,
      blockerCount: blockers.length,
    }),
  ];
}

export function buildQuoteWorkspace(input: PreliminaryQuoteWorkspaceInput): PreliminaryQuoteWorkspace {
  const readiness = evaluateQuoteReadiness(input);
  const estimatedTermMonths = input.estimatedTermMonths ?? 60;
  const estimatedNrc = defaultNrc(input);
  const estimatedMrc = defaultMrc(input);
  const estimatedTcv = estimatedNrc + estimatedMrc * estimatedTermMonths;
  const confidenceBasis = generateQuoteConfidence(input);

  return {
    workspaceId: "PRELIMINARY_QUOTE_WORKSPACE",
    title: `Preliminary Quote: ${input.prismWorkspace.summary.opportunityName}`,
    prismWorkspace: input.prismWorkspace,
    marketplaceAssets: input.marketplaceAssets ?? input.prismWorkspace.marketplaceAssets,
    sections: SECTIONS,
    summary: {
      customerName: input.prismWorkspace.summary.customerName,
      opportunityName: input.prismWorkspace.summary.opportunityName,
      opportunityId: input.prismWorkspace.summary.opportunityId,
      networkType: input.prismWorkspace.summary.networkType,
      protectionSchema: input.prismWorkspace.summary.protectionSchema,
      referenceArchitecture: input.prismWorkspace.baselineNetwork?.referenceArchitecture ?? "Not selected",
      readiness,
      recommendedProducts: selectRecommendedProducts(input),
      estimatedNrc,
      estimatedMrc,
      estimatedTermMonths,
      estimatedTcv,
      confidence: confidenceBasis.overallConfidence,
      nextAction: readiness === "BLOCKED" ? "RESOLVE_BLOCKERS" : "READY_FOR_CUSTOMER_DISCUSSION",
    },
    lineItems: generateLineItems(input),
    assumptions: generateQuoteAssumptions(input),
    risks: generateQuoteRisks(input),
    confidenceBasis,
    blockers: identifyQuoteBlockers(input),
    diagnostics: generateQuoteDiagnostics(input),
    advisoryOnly: true,
    preliminaryOnly: true,
    nonContractual: true,
    engineeringValidationRequired: true,
    noContractAuthority: true,
    noBudgetLock: true,
    noSof: true,
    noPersistence: true,
    noServerRoutes: true,
    noAuthorityCreated: true,
  };
}
