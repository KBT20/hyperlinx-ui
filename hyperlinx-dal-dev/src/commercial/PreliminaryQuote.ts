import type { CorridorLensObjectType, CorridorLensType } from "../corridor/CorridorLens";
import type { ReferenceArchitectureToolType } from "../corridor/CorridorReferenceArchitecture";

export type CommercialProductType =
  | "DUCT_SALE"
  | "DUCT_MAINTENANCE"
  | "DARK_FIBER_IRU"
  | "MANAGED_FIBER"
  | "ETHERNET_TRANSPORT"
  | "WAVE_SERVICE"
  | "AI_INTERCONNECT"
  | "RESIDUAL_CAPACITY"
  | "ROUTE_OPERATIONS";

export type CommercialConfidence = "LOW" | "MEDIUM" | "HIGH";

export type EstimateSource =
  | "PRISM_RECOMMENDATION"
  | "REFERENCE_ARCHITECTURE"
  | "OBJECT_POPULATION_PLAN"
  | "DESIGN_STANDARDS"
  | "COMMERCIAL_ASSUMPTION"
  | "HUMAN_ADVISORY";

export type EstimateStatus =
  | "DRAFT"
  | "PRELIMINARY"
  | "ENGINEERING_REVIEW_REQUIRED"
  | "SUPERSEDED";

export interface CommercialAssumption {
  assumptionId: string;
  source: EstimateSource;
  label: string;
  value: string | number | boolean;
  confidence: CommercialConfidence;
  notes?: string;
}

export interface CommercialRisk {
  riskId: string;
  riskType:
    | "MISSING_POWER_VALIDATION"
    | "ROUTE_DIVERSITY_NOT_REVIEWED"
    | "JURISDICTION_UNCERTAINTY"
    | "CROSSING_UNCERTAINTY"
    | "DATA_CENTER_ACCESS_UNCERTAINTY"
    | "INTERCONNECTION_UNCERTAINTY"
    | "OPTICAL_REVIEW_REQUIRED"
    | "ENGINEERING_REVIEW_REQUIRED"
    | "VENDOR_PRICING_UNAVAILABLE"
    | "BUDGET_NOT_ESTABLISHED"
    | "MISSING_OBJECT_EVIDENCE"
    | "MISSING_TOOL_EVIDENCE";
  severity: "LOW" | "MEDIUM" | "HIGH";
  message: string;
  evidenceIds: string[];
  mitigation?: string;
}

export interface CommercialQuantityEstimate {
  conduitFeet: number;
  fiberFeet: number;
  fiberCount: number;
  regenCount: number;
  admCount: number;
  laterals: number;
  crossings: number;
  dataCenterInterconnects: number;
  carrierHotelInterconnects: number;
  cloudOnRamps: number;
  powerReviews: number;
  permitCategories: string[];
}

export interface CommercialProductDefinition {
  productType: CommercialProductType;
  displayName: string;
  nrcEligible: boolean;
  mrcEligible: boolean;
  iruEligible: boolean;
  recurringModel: "NONE" | "MONTHLY" | "TERM" | "HYBRID";
  termAssumptions: string[];
  objectDependencies: CorridorLensObjectType[];
  toolDependencies: ReferenceArchitectureToolType[];
  notes: string;
}

export interface CommercialProductEstimate {
  productType: CommercialProductType;
  estimatedNrc: number;
  estimatedMrc: number;
  estimatedIru: number;
  confidence: CommercialConfidence;
  quantityBasis: CommercialQuantityEstimate;
  assumptions: CommercialAssumption[];
  risks: CommercialRisk[];
  requiredObjects: CorridorLensObjectType[];
  notes: string;
}

export interface PreliminaryQuote {
  quoteId: string;
  opportunityPackageId: string;
  candidateId: string;
  corridorId: string;
  lensType?: CorridorLensType;
  referenceArchitectureId?: string;
  status: EstimateStatus;
  productEstimates: CommercialProductEstimate[];
  estimatedQuantities: CommercialQuantityEstimate;
  estimatedNrc: number;
  estimatedMrc: number;
  estimatedIru: number;
  assumptions: CommercialAssumption[];
  risks: CommercialRisk[];
  confidence: CommercialConfidence;
  engineeringReviewRequired: boolean;
  marketplaceBudgetRequired: boolean;
  doctrine: "ESTIMATE_IS_NOT_BUDGET";
  createdAt: string;
}

export const COMMERCIAL_PRODUCT_DEFINITIONS: readonly CommercialProductDefinition[] = Object.freeze([
  {
    productType: "DUCT_SALE",
    displayName: "Duct Sale",
    nrcEligible: true,
    mrcEligible: false,
    iruEligible: false,
    recurringModel: "NONE",
    termAssumptions: ["One-time commercial transaction; maintenance obligations require review."],
    objectDependencies: ["CONDUIT", "INNERDUCT", "RIGHT_OF_WAY"],
    toolDependencies: ["DUCT_CAPACITY_PLANNING", "RESIDUAL_CAPACITY_MODEL", "DUCT_SALE_MODEL"],
    notes: "Sale-eligible duct must be separated from occupied, reserved, and maintenance duct.",
  },
  {
    productType: "DUCT_MAINTENANCE",
    displayName: "Duct Maintenance",
    nrcEligible: true,
    mrcEligible: true,
    iruEligible: false,
    recurringModel: "MONTHLY",
    termAssumptions: ["Maintenance responsibility and access model must be reviewed."],
    objectDependencies: ["CONDUIT", "RIGHT_OF_WAY", "MAINTENANCE_ZONE"],
    toolDependencies: ["MAINTENANCE_ACCESS_REVIEW", "JURISDICTION_REVIEW"],
    notes: "Maintenance estimate is advisory until operating model is approved.",
  },
  {
    productType: "DARK_FIBER_IRU",
    displayName: "Dark Fiber IRU",
    nrcEligible: true,
    mrcEligible: false,
    iruEligible: true,
    recurringModel: "TERM",
    termAssumptions: ["IRU term commonly modeled over 120-240 months for advisory comparison."],
    objectDependencies: ["FIBER", "FIBER_PAIR", "SPLICE"],
    toolDependencies: ["FIBER_COUNT_PLANNING", "DARK_FIBER_IRU_MODEL", "ROUTE_DIVERSITY_REVIEW"],
    notes: "IRU eligibility requires approved strand reservation and handoff design.",
  },
  {
    productType: "MANAGED_FIBER",
    displayName: "Managed Fiber",
    nrcEligible: true,
    mrcEligible: true,
    iruEligible: false,
    recurringModel: "MONTHLY",
    termAssumptions: ["36 month advisory term unless customer ask says otherwise."],
    objectDependencies: ["FIBER", "HANDHOLE"],
    toolDependencies: ["FIBER_COUNT_PLANNING", "MAINTENANCE_ACCESS_REVIEW"],
    notes: "Managed service depends on service availability and operations model.",
  },
  {
    productType: "ETHERNET_TRANSPORT",
    displayName: "Ethernet Transport",
    nrcEligible: true,
    mrcEligible: true,
    iruEligible: false,
    recurringModel: "MONTHLY",
    termAssumptions: ["36 month advisory term unless customer ask says otherwise."],
    objectDependencies: ["FIBER", "DATA_CENTER", "CARRIER_HOTEL"],
    toolDependencies: ["FIBER_COUNT_PLANNING", "DATA_CENTER_PROVIDER", "CARRIER_HOTEL_PROVIDER"],
    notes: "Ethernet transport estimate is not a quote or SOF.",
  },
  {
    productType: "WAVE_SERVICE",
    displayName: "Wave Service",
    nrcEligible: true,
    mrcEligible: true,
    iruEligible: false,
    recurringModel: "MONTHLY",
    termAssumptions: ["36-60 month advisory term depending on SLA and capacity."],
    objectDependencies: ["FIBER", "REGEN_SITE", "ADM_SITE", "POP"],
    toolDependencies: ["OPTICAL_REACH_REVIEW", "REGEN_SPACING_REVIEW", "ADM_PLACEMENT_REVIEW", "TRANSPORT_REVENUE_MODEL"],
    notes: "Wave service requires optical review before budget or contract.",
  },
  {
    productType: "AI_INTERCONNECT",
    displayName: "AI Interconnect",
    nrcEligible: true,
    mrcEligible: true,
    iruEligible: false,
    recurringModel: "HYBRID",
    termAssumptions: ["Term depends on capacity, power context, and hyperscaler/neocloud ask."],
    objectDependencies: ["FIBER", "DATA_CENTER", "CLOUD_ONRAMP", "SUBSTATION", "TRANSMISSION_LINE"],
    toolDependencies: ["POWER_PROXIMITY_EVALUATION", "DATA_CENTER_PROVIDER", "CLOUD_ONRAMP_PROVIDER", "HYPERSCALER_BUSINESS_CASE_MODEL"],
    notes: "Power proximity is not power availability.",
  },
  {
    productType: "RESIDUAL_CAPACITY",
    displayName: "Residual Capacity",
    nrcEligible: true,
    mrcEligible: true,
    iruEligible: false,
    recurringModel: "HYBRID",
    termAssumptions: ["Model depends on residual capacity and maintenance constraints."],
    objectDependencies: ["CONDUIT", "FIBER", "INNERDUCT"],
    toolDependencies: ["RESIDUAL_CAPACITY_MODEL", "DUCT_CAPACITY_PLANNING", "FIBER_COUNT_PLANNING"],
    notes: "Residual capacity must remain separate from committed capacity.",
  },
  {
    productType: "ROUTE_OPERATIONS",
    displayName: "Route Operations",
    nrcEligible: true,
    mrcEligible: true,
    iruEligible: false,
    recurringModel: "MONTHLY",
    termAssumptions: ["Operations term depends on SLA, maintenance, and restoration obligations."],
    objectDependencies: ["MAINTENANCE_ZONE", "RESTORATION_ZONE", "JURISDICTION"],
    toolDependencies: ["MAINTENANCE_ACCESS_REVIEW", "RESTORATION_REVIEW", "JURISDICTION_REVIEW"],
    notes: "Route operations requires operations and engineering review.",
  },
]);
