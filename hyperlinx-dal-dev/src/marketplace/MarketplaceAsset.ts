import type { CorridorLensObjectType } from "../corridor/CorridorLens";
import type { MarketplaceCapabilityType } from "./MarketplaceCapability";

export type MarketplaceAssetType =
  | "GPU_FACILITY"
  | "DATA_CENTER"
  | "SUBSTATION"
  | "POWER_FEED"
  | "TRANSMISSION_LINE"
  | "PARCEL"
  | "FIBER_ROUTE"
  | "DUCT_ROUTE"
  | "CONDUIT_SYSTEM"
  | "CARRIER_HOTEL"
  | "IX"
  | "CLOUD_ONRAMP"
  | "CONSTRUCTION_CAPABILITY"
  | "ENGINEERING_CAPABILITY"
  | "PERMITTING_CAPABILITY"
  | "LABOR_CAPABILITY"
  | "MATERIAL_CAPABILITY"
  | "TRANSPORT_CAPABILITY";

export type MarketplaceAssetStatus =
  | "DISCOVERED"
  | "AVAILABLE"
  | "REVIEW_REQUIRED"
  | "UNAVAILABLE"
  | "SUPERSEDED";

export interface MarketplaceServiceArea {
  serviceAreaId: string;
  name: string;
  states?: string[];
  counties?: string[];
  markets?: string[];
  notes?: string;
}

export interface MarketplaceAsset {
  assetId: string;
  assetName: string;
  assetType: MarketplaceAssetType;
  ownerName: string;
  status: MarketplaceAssetStatus;
  serviceAreas: MarketplaceServiceArea[];
  relatedObjectTypes: CorridorLensObjectType[];
  capabilityIds: string[];
  priceBookIds: string[];
  evidenceIds: string[];
  reviewRequired: boolean;
  notes?: string;
}

export interface MarketplaceProduct {
  productId: string;
  productName: string;
  productType:
    | "DUCT_SALE"
    | "DUCT_MAINTENANCE"
    | "DARK_FIBER_IRU"
    | "MANAGED_FIBER"
    | "ETHERNET_TRANSPORT"
    | "WAVE_SERVICE"
    | "AI_INTERCONNECT"
    | "RESIDUAL_CAPACITY"
    | "ROUTE_OPERATIONS"
    | "GPU_CAPACITY"
    | "POWER_ACCESS"
    | "INTERCONNECTION_ACCESS";
  requiredAssetTypes: MarketplaceAssetType[];
  requiredCapabilityTypes: MarketplaceCapabilityType[];
  optionalAssetTypes: MarketplaceAssetType[];
  reviewRequired: boolean;
  notes: string;
}
