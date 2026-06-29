import type { CostPlusPricingModel } from "./CostPlusPricingModel";

export type IlaRegenProfileId = "ILA_18_RACK_SINGLE_WIDE" | "ILA_36_RACK_DOUBLE_WIDE";

export type IlaRegenLineItemCategory =
  | "SITE_LAND"
  | "SITE_CONSTRUCTION"
  | "TELECOM_FIT_OUT";

export interface IlaRegenLineItem {
  lineItemId: string;
  category: IlaRegenLineItemCategory;
  description: string;
  quantity: number;
  unit: "EACH" | "ALLOWANCE";
  unitCost: number;
  extendedCost: number;
  source: "DOBSON_REFERENCE_WORKBOOK" | "PROPOSAL_PROFILE_CATALOG";
  referenceDerived: true;
  developmentSeed: true;
  productionApproved: false;
}

export interface IlaRegenPricingProfile {
  profileId: IlaRegenProfileId;
  label: string;
  rackCount: number;
  buildingType: string;
  budgetCost: number;
  referenceMarkupPoints: number;
  referenceSellPrice: number;
  lineItems: IlaRegenLineItem[];
}

export interface IlaRegenSitePricing {
  siteId: string;
  siteName: string;
  profileId: IlaRegenProfileId;
  rackCount: number;
  lineItems: IlaRegenLineItem[];
  budgetCost: number;
  costPlus: CostPlusPricingModel;
  engineeringValidationRequired: true;
}

export interface IlaRegenPricing {
  pricingId: string;
  selectedProfileId: IlaRegenProfileId;
  siteCount: number;
  sitePricings: IlaRegenSitePricing[];
  totalBudgetCost: number;
  totalSellPrice: number;
  sourceReferences: string[];
  referenceDerived: true;
  developmentSeed: true;
  productionApproved: false;
}
