export type EstimateAuthorityLayer = "PRODUCT_DOCTRINE" | "PROJECT_CONFIGURATION" | "SOURCE_EVIDENCE" | "RATE_CATALOG" | "MATERIAL_CATALOG" | "ESTIMATING_DOCTRINE" | "COMMERCIAL_POLICY" | "HUMAN_CALIBRATION" | "ENGINEERING" | "UNKNOWN";
export type CostContributionMode = "PRIMARY" | "COMPONENT" | "REFERENCE_ONLY" | "ROLLUP";

export interface EstimatingAuthorityEntry {
  authorityId: string;
  authorityLayer: "ESTIMATING_DOCTRINE";
  authorityMode: "SOURCE_WORKBOOK" | "RATE_PROFILE" | "COMMERCIAL_PLANNING_ASSUMPTION" | "HUMAN_APPROVED";
  source: string;
  confidence: number;
  formula: string;
  revision: string;
  approvedBy?: string;
  effectiveDate?: string;
}

export const DUCT_DARK_FIBER_ESTIMATING_DOCTRINE = {
  estimatingDoctrineId: "ED-L1-DUCT-DARK-FIBER-1.0",
  revision: "1.0.0",
  authorityLayer: "ESTIMATING_DOCTRINE" as const,
  governs: ["production assumptions", "crew assumptions", "quantity-to-rate application", "contingency categories", "planning allowances"],
  doesNotGovern: ["product requirements", "project physical selections", "commercial price", "certified Engineering quantities"],
};

export const DUCT_DARK_FIBER_CATALOG_BOUNDARIES = {
  rateCatalog: ["labor", "equipment", "professional services", "other services"],
  materialCatalog: ["vendor-backed materials", "SKUs", "quote revisions"],
  projectCalibration: ["project-only quantity, production, and unit-cost overrides"],
  prohibitedAutomaticPromotion: true,
  productDoctrineContainsPricing: false,
};

export const DUCT_DARK_FIBER_COMMERCIAL_POLICY = {
  commercialPolicyId: "CP-L1-DUCT-DARK-FIBER-1.0",
  revision: "1.0.0",
  authorityLayer: "COMMERCIAL_POLICY" as const,
  governs: ["markup percent", "margin target", "NRC policy", "MRC policy", "O&M pricing", "term", "ROI", "IRR", "payback", "commercial contingency policy"],
  doesNotGovern: ["Product Doctrine", "route authority", "Engineering quantities", "optical certification"],
};
