import type { MarketplaceAssetType, MarketplaceServiceArea } from "./MarketplaceAsset";
import type { MarketplaceUnitType } from "./MarketplacePriceBook";

export type MarketplaceCapabilityType =
  | "DIRECTIONAL_DRILLING"
  | "FIBER_PLACEMENT"
  | "SPLICING"
  | "OPTICAL_DEPLOYMENT"
  | "PERMITTING"
  | "ELECTRICAL_CONSTRUCTION"
  | "DATA_CENTER_DEPLOYMENT"
  | "GPU_HOSTING"
  | "DARK_FIBER"
  | "TRANSPORT"
  | "INTERCONNECTION"
  | "MATERIAL_SUPPLY"
  | "DUCT_INSTALLATION"
  | "CONDUIT_PLACEMENT"
  | "ROUTE_OPERATIONS";

export interface MarketplaceCapability {
  capabilityId: string;
  capabilityName: string;
  capabilityType: MarketplaceCapabilityType;
  ownerName: string;
  requiredObjects: MarketplaceAssetType[];
  serviceAreas: MarketplaceServiceArea[];
  unitTypes: MarketplaceUnitType[];
  priceBookEligible: boolean;
  reviewRequired: boolean;
  notes?: string;
}
