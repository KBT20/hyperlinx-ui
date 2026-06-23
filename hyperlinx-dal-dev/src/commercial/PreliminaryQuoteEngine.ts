import type { CorridorLensObjectType } from "../corridor/CorridorLens";
import type { ReferenceArchitectureFit } from "../corridor/CorridorReferenceArchitecture";
import type {
  PrismObjectPopulationPlan,
  PrismProductPlan,
  PrismProductType,
  PrismRecommendation,
} from "../corridor/PrismRecommendationContract";
import type { CorridorDesignStandard } from "../corridor/CorridorDesignStandards";
import type { OpportunityPackage } from "./OpportunityPackage";
import {
  COMMERCIAL_PRODUCT_DEFINITIONS,
  type CommercialAssumption,
  type CommercialConfidence,
  type CommercialProductEstimate,
  type CommercialProductType,
  type CommercialQuantityEstimate,
  type CommercialRisk,
  type PreliminaryQuote,
} from "./PreliminaryQuote";

export interface PreliminaryQuoteInput {
  recommendation: PrismRecommendation;
  referenceArchitectureFit?: ReferenceArchitectureFit;
  productPlan?: PrismProductPlan;
  objectPopulationPlan?: PrismObjectPopulationPlan;
  designStandards?: CorridorDesignStandard[];
  customerAsk?: string;
}

function now(): string {
  return new Date().toISOString();
}

function unique<T>(items: readonly T[]): T[] {
  return [...new Set(items)];
}

function commercialProductFromPrism(productType: PrismProductType): CommercialProductType {
  if (productType === "RESIDUAL_CAPACITY_MONETIZATION") return "RESIDUAL_CAPACITY";
  return productType;
}

function productDefinition(productType: CommercialProductType) {
  return COMMERCIAL_PRODUCT_DEFINITIONS.find((definition) => definition.productType === productType);
}

function allObjects(input: PreliminaryQuoteInput): CorridorLensObjectType[] {
  const plan = input.objectPopulationPlan ?? input.recommendation.objectPopulationPlan;
  return unique([...plan.requiredObjects, ...plan.suggestedObjects, ...plan.optionalObjects]);
}

function containsObject(input: PreliminaryQuoteInput, objectType: CorridorLensObjectType): boolean {
  return allObjects(input).includes(objectType);
}

function lensType(input: PreliminaryQuoteInput) {
  return input.recommendation.routeEngineeringHandoffDraft.lensType;
}

function baseDistanceFeet(input: PreliminaryQuoteInput): number {
  const scoreDistance = input.recommendation.productPlan.capacityAssumptions.find((item) => /\d+/.test(item));
  const parsed = scoreDistance ? Number(scoreDistance.match(/\d+/)?.[0]) : 0;
  if (Number.isFinite(parsed) && parsed > 1000) return parsed;
  const architecture = input.referenceArchitectureFit ?? input.recommendation.routeEngineeringHandoffDraft.referenceArchitectureId;
  const fitId = typeof architecture === "string" ? architecture : architecture?.architectureId;
  if (fitId?.includes("LONG-HAUL")) return 500_000;
  if (fitId?.includes("AI-POWER")) return 250_000;
  if (fitId?.includes("METRO")) return 20_000;
  if (fitId?.includes("ENTERPRISE")) return 5_000;
  return 50_000;
}

function estimateQuantities(input: PreliminaryQuoteInput): CommercialQuantityEstimate {
  const feet = baseDistanceFeet(input);
  const hasConduit = containsObject(input, "CONDUIT");
  const hasFiber = containsObject(input, "FIBER");
  const hasRegen = containsObject(input, "REGEN_SITE");
  const hasAdm = containsObject(input, "ADM_SITE");
  const hasDataCenter = containsObject(input, "DATA_CENTER");
  const hasCarrierHotel = containsObject(input, "CARRIER_HOTEL");
  const hasCloud = containsObject(input, "CLOUD_ONRAMP");
  const hasPower = containsObject(input, "SUBSTATION") || containsObject(input, "TRANSMISSION_LINE") || containsObject(input, "GENERATION_SITE");
  const hasCrossing = containsObject(input, "CROSSING");
  const permitCategories = unique([
    ...(containsObject(input, "JURISDICTION") ? ["jurisdiction"] : []),
    ...(hasCrossing ? ["crossing"] : []),
    ...(hasConduit ? ["ROW"] : []),
    ...(hasPower ? ["power context"] : []),
  ]);

  return {
    conduitFeet: hasConduit ? feet : 0,
    fiberFeet: hasFiber ? feet : 0,
    fiberCount: hasFiber ? (lensType(input) === "HYPERSCALER" ? 432 : lensType(input) === "DARK_FIBER_IRU" ? 24 : 144) : 0,
    regenCount: hasRegen ? Math.max(1, Math.ceil(feet / 300_000)) : 0,
    admCount: hasAdm ? Math.max(1, Math.ceil(feet / 150_000)) : 0,
    laterals: lensType(input) === "ENTERPRISE" ? 1 : 0,
    crossings: hasCrossing ? Math.max(1, Math.ceil(feet / 25_000)) : 0,
    dataCenterInterconnects: hasDataCenter ? 1 : 0,
    carrierHotelInterconnects: hasCarrierHotel ? 1 : 0,
    cloudOnRamps: hasCloud ? 1 : 0,
    powerReviews: hasPower ? 1 : 0,
    permitCategories,
  };
}

function assumption(input: {
  label: string;
  value: string | number | boolean;
  confidence: CommercialConfidence;
  notes?: string;
}): CommercialAssumption {
  return {
    assumptionId: `ASSUMPTION-${input.label.toUpperCase().replace(/[^A-Z0-9]+/g, "-")}`,
    source: "COMMERCIAL_ASSUMPTION",
    label: input.label,
    value: input.value,
    confidence: input.confidence,
    notes: input.notes,
  };
}

function quantityAssumptions(quantities: CommercialQuantityEstimate, confidence: CommercialConfidence): CommercialAssumption[] {
  return [
    assumption({ label: "Conduit Feet", value: quantities.conduitFeet, confidence, notes: "Advisory quantity only; not engineered." }),
    assumption({ label: "Fiber Feet", value: quantities.fiberFeet, confidence, notes: "Advisory quantity only; not engineered." }),
    assumption({ label: "Fiber Count", value: quantities.fiberCount, confidence, notes: "Commercial planning assumption." }),
    assumption({ label: "Regen Count", value: quantities.regenCount, confidence, notes: "Requires optical review." }),
    assumption({ label: "ADM Count", value: quantities.admCount, confidence, notes: "Requires ADM placement review." }),
  ];
}

export function estimateCommercialConfidence(input: PreliminaryQuoteInput): CommercialConfidence {
  const scoreConfidence = input.recommendation.risk === "LOW" ? 2 : input.recommendation.risk === "MEDIUM" ? 1 : 0;
  const architectureFit = input.referenceArchitectureFit ?? input.recommendation.routeEngineeringHandoffDraft.referenceArchitectureId;
  const fitLevel = typeof architectureFit === "string" ? undefined : architectureFit?.fitLevel;
  const fitConfidence = fitLevel === "STRONG" ? 2 : fitLevel === "MODERATE" ? 1 : 0;
  const blockerPenalty = input.recommendation.humanReviewGate.blockers.length > 0 ? -1 : 0;
  const missingObjectPenalty = (input.objectPopulationPlan ?? input.recommendation.objectPopulationPlan).missingObjects.length > 0 ? -1 : 0;
  const missingToolPenalty = input.referenceArchitectureFit?.missingToolEvidence.length ? -1 : 0;
  const standardConfidence = (input.designStandards?.length ?? 0) > 0 ? 1 : 0;
  const total = scoreConfidence + fitConfidence + standardConfidence + blockerPenalty + missingObjectPenalty + missingToolPenalty;
  const confidence: CommercialConfidence = total >= 4 ? "HIGH" : total >= 2 ? "MEDIUM" : "LOW";
  console.log("[COMMERCIAL_CONFIDENCE_CALCULATED]", {
    recommendationId: input.recommendation.recommendationId,
    confidence,
    total,
  });
  return confidence;
}

export function generateCommercialRisks(input: PreliminaryQuoteInput): CommercialRisk[] {
  const risks: CommercialRisk[] = [];
  const evidence = input.recommendation.rationale.evidenceIds;
  const add = (risk: CommercialRisk) => {
    risks.push(risk);
    console.log("[COMMERCIAL_RISK_IDENTIFIED]", {
      riskId: risk.riskId,
      riskType: risk.riskType,
      severity: risk.severity,
    });
  };

  input.recommendation.humanReviewGate.blockers.forEach((blocker) => {
    if (blocker.blockerType === "POWER_CAPACITY_UNVERIFIED") {
      add({
        riskId: "RISK-POWER-VALIDATION",
        riskType: "MISSING_POWER_VALIDATION",
        severity: "HIGH",
        message: "Power capacity has not been verified.",
        evidenceIds: blocker.evidenceIds,
        mitigation: "Obtain power capacity evidence before budget or contract.",
      });
    }
    if (blocker.blockerType === "ROUTE_DIVERSITY_NOT_REVIEWED") {
      add({
        riskId: "RISK-DIVERSITY-REVIEW",
        riskType: "ROUTE_DIVERSITY_NOT_REVIEWED",
        severity: "HIGH",
        message: "Route diversity has not been reviewed.",
        evidenceIds: blocker.evidenceIds,
        mitigation: "Complete route diversity review before budget lock.",
      });
    }
    if (blocker.blockerType === "JURISDICTION_RISK_UNRESOLVED") {
      add({
        riskId: "RISK-JURISDICTION",
        riskType: "JURISDICTION_UNCERTAINTY",
        severity: "MEDIUM",
        message: "Jurisdiction or permit risk remains unresolved.",
        evidenceIds: blocker.evidenceIds,
        mitigation: "Complete jurisdiction review.",
      });
    }
    if (blocker.blockerType === "CROSSING_RISK_UNRESOLVED") {
      add({
        riskId: "RISK-CROSSING",
        riskType: "CROSSING_UNCERTAINTY",
        severity: "MEDIUM",
        message: "Crossing risk remains unresolved.",
        evidenceIds: blocker.evidenceIds,
        mitigation: "Complete crossing review.",
      });
    }
    if (blocker.blockerType === "REGEN_ADM_OPTICAL_REVIEW_REQUIRED") {
      add({
        riskId: "RISK-OPTICAL-REVIEW",
        riskType: "OPTICAL_REVIEW_REQUIRED",
        severity: "HIGH",
        message: "Optical, regen, or ADM review is required.",
        evidenceIds: blocker.evidenceIds,
        mitigation: "Complete Route Engineering optical review.",
      });
    }
  });

  if (input.referenceArchitectureFit?.missingObjects.length) {
    add({
      riskId: "RISK-MISSING-OBJECT-EVIDENCE",
      riskType: "MISSING_OBJECT_EVIDENCE",
      severity: "HIGH",
      message: "Required architecture object evidence is missing.",
      evidenceIds: evidence,
      mitigation: "Provide missing object evidence or document exception.",
    });
  }

  if (input.referenceArchitectureFit?.missingToolEvidence.length) {
    add({
      riskId: "RISK-MISSING-TOOL-EVIDENCE",
      riskType: "MISSING_TOOL_EVIDENCE",
      severity: "HIGH",
      message: "Required tool evidence is missing.",
      evidenceIds: evidence,
      mitigation: "Provide required tool evidence or mark unavailable for review.",
    });
  }

  add({
    riskId: "RISK-VENDOR-PRICING",
    riskType: "VENDOR_PRICING_UNAVAILABLE",
    severity: "MEDIUM",
    message: "Vendor pricing is unavailable in preliminary quote phase.",
    evidenceIds: evidence,
    mitigation: "Marketplace budget process must establish budget.",
  });

  add({
    riskId: "RISK-BUDGET-NOT-ESTABLISHED",
    riskType: "BUDGET_NOT_ESTABLISHED",
    severity: "MEDIUM",
    message: "Budget is not established by preliminary estimate.",
    evidenceIds: evidence,
    mitigation: "Marketplace must convert estimate to budget after engineering approval.",
  });

  return risks;
}

function estimateProductAmount(productType: CommercialProductType, quantities: CommercialQuantityEstimate) {
  const miles = Math.max(1, (quantities.fiberFeet || quantities.conduitFeet || 5_000) / 5280);
  const conduitRate = 18;
  const fiberRate = 8;
  const interconnectNrc = 25_000;
  const opticalNrc = 75_000;
  const monthlyPerMile = 950;
  const iruPerMile = 55_000;

  switch (productType) {
    case "DUCT_SALE":
      return { nrc: quantities.conduitFeet * conduitRate, mrc: 0, iru: 0 };
    case "DUCT_MAINTENANCE":
      return { nrc: quantities.conduitFeet * 3, mrc: miles * 250, iru: 0 };
    case "DARK_FIBER_IRU":
      return { nrc: miles * 20_000, mrc: 0, iru: miles * iruPerMile };
    case "MANAGED_FIBER":
      return { nrc: quantities.fiberFeet * fiberRate + interconnectNrc, mrc: miles * 700, iru: 0 };
    case "ETHERNET_TRANSPORT":
      return { nrc: interconnectNrc, mrc: miles * 850, iru: 0 };
    case "WAVE_SERVICE":
      return { nrc: opticalNrc + quantities.regenCount * 45_000 + quantities.admCount * 35_000, mrc: miles * monthlyPerMile, iru: 0 };
    case "AI_INTERCONNECT":
      return { nrc: opticalNrc + interconnectNrc + quantities.powerReviews * 15_000, mrc: miles * 1_400, iru: 0 };
    case "RESIDUAL_CAPACITY":
      return { nrc: quantities.conduitFeet * 6 + quantities.fiberFeet * 3, mrc: miles * 500, iru: 0 };
    case "ROUTE_OPERATIONS":
      return { nrc: miles * 5_000, mrc: miles * 300, iru: 0 };
  }
}

export function estimateProducts(input: PreliminaryQuoteInput, quantities = estimateQuantities(input)): CommercialProductEstimate[] {
  const confidence = estimateCommercialConfidence(input);
  const risks = generateCommercialRisks(input);
  const prismProduct = input.productPlan?.productType ?? input.recommendation.productPlan.productType;
  const productTypes = unique<CommercialProductType>([
    commercialProductFromPrism(prismProduct),
    ...(lensType(input) === "DUCT_MONETIZATION" ? ["RESIDUAL_CAPACITY" as CommercialProductType] : []),
    ...(lensType(input) === "TRANSPORT" ? ["ETHERNET_TRANSPORT" as CommercialProductType] : []),
    ...(lensType(input) === "DARK_FIBER_IRU" ? ["ROUTE_OPERATIONS" as CommercialProductType] : []),
  ]);

  return productTypes.map((productType) => {
    const definition = productDefinition(productType);
    const amount = estimateProductAmount(productType, quantities);
    const assumptions = quantityAssumptions(quantities, confidence);
    console.log("[PRODUCT_ESTIMATE_CREATED]", {
      productType,
      estimatedNrc: amount.nrc,
      estimatedMrc: amount.mrc,
      estimatedIru: amount.iru,
    });
    return {
      productType,
      estimatedNrc: Math.round(amount.nrc),
      estimatedMrc: Math.round(amount.mrc),
      estimatedIru: Math.round(amount.iru),
      confidence,
      quantityBasis: quantities,
      assumptions,
      risks,
      requiredObjects: definition?.objectDependencies ?? input.recommendation.productPlan.requiredObjects,
      notes: definition?.notes ?? "Advisory product estimate.",
    };
  });
}

export function createPreliminaryQuote(input: PreliminaryQuoteInput): PreliminaryQuote {
  console.log("[PRELIMINARY_QUOTE_STARTED]", {
    recommendationId: input.recommendation.recommendationId,
    candidateId: input.recommendation.candidateId,
  });
  const quantities = estimateQuantities(input);
  const confidence = estimateCommercialConfidence(input);
  const productEstimates = estimateProducts(input, quantities);
  const assumptions = unique(productEstimates.flatMap((estimate) => estimate.assumptions));
  const risks = unique(productEstimates.flatMap((estimate) => estimate.risks));
  const quote: PreliminaryQuote = {
    quoteId: `PRELIM-QUOTE-${input.recommendation.candidateId}`,
    opportunityPackageId: `OPP-PKG-${input.recommendation.candidateId}`,
    candidateId: input.recommendation.candidateId,
    corridorId: input.recommendation.corridorId,
    lensType: lensType(input),
    referenceArchitectureId: input.referenceArchitectureFit?.architectureId ?? input.recommendation.routeEngineeringHandoffDraft.referenceArchitectureId,
    status: "PRELIMINARY",
    productEstimates,
    estimatedQuantities: quantities,
    estimatedNrc: productEstimates.reduce((sum, estimate) => sum + estimate.estimatedNrc, 0),
    estimatedMrc: productEstimates.reduce((sum, estimate) => sum + estimate.estimatedMrc, 0),
    estimatedIru: productEstimates.reduce((sum, estimate) => sum + estimate.estimatedIru, 0),
    assumptions,
    risks,
    confidence,
    engineeringReviewRequired: true,
    marketplaceBudgetRequired: true,
    doctrine: "ESTIMATE_IS_NOT_BUDGET",
    createdAt: now(),
  };
  console.log("[PRELIMINARY_QUOTE_COMPLETE]", {
    quoteId: quote.quoteId,
    estimatedNrc: quote.estimatedNrc,
    estimatedMrc: quote.estimatedMrc,
    estimatedIru: quote.estimatedIru,
  });
  return quote;
}

export function createOpportunityPackage(input: PreliminaryQuoteInput): OpportunityPackage {
  const quote = createPreliminaryQuote(input);
  const packageResult: OpportunityPackage = {
    opportunityPackageId: quote.opportunityPackageId,
    candidateId: input.recommendation.candidateId,
    corridorId: input.recommendation.corridorId,
    customerAsk: input.customerAsk ?? input.recommendation.rationale.summary,
    lensType: lensType(input),
    networkRole: input.recommendation.routeEngineeringHandoffDraft.networkRole,
    referenceArchitectureId: quote.referenceArchitectureId,
    recommendationLevel: input.recommendation.recommendationLevel,
    recommendedProducts: [input.productPlan ?? input.recommendation.productPlan],
    objectPlan: input.objectPopulationPlan ?? input.recommendation.objectPopulationPlan,
    requiredObjects: input.recommendation.routeEngineeringHandoffDraft.requiredObjects,
    requiredTools: input.recommendation.routeEngineeringHandoffDraft.requiredTools,
    requiredDesignStandards: input.recommendation.routeEngineeringHandoffDraft.requiredDesignStandards,
    estimatedQuantities: quote.estimatedQuantities,
    productEstimates: quote.productEstimates,
    estimatedNrc: quote.estimatedNrc,
    estimatedMrc: quote.estimatedMrc,
    estimatedIru: quote.estimatedIru,
    commercialAssumptions: quote.assumptions,
    commercialRisks: quote.risks,
    confidence: quote.confidence,
    engineeringReviewRequired: true,
    marketplaceBudgetRequired: true,
    status: "PRELIMINARY",
    preliminaryQuote: quote,
    doctrine: "OPPORTUNITY_PACKAGE_IS_ADVISORY_ONLY",
    createdAt: now(),
  };
  console.log("[OPPORTUNITY_PACKAGE_CREATED]", {
    opportunityPackageId: packageResult.opportunityPackageId,
    confidence: packageResult.confidence,
    status: packageResult.status,
  });
  return packageResult;
}
