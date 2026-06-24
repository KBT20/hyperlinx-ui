import type { MarketplaceAsset, MarketplaceAssetType, MarketplaceProduct } from "./MarketplaceAsset";
import type { MarketplaceCapability, MarketplaceCapabilityType } from "./MarketplaceCapability";

export type MarketplacePricingModel =
  | "UNIT_PRICE"
  | "NRC"
  | "MRC"
  | "IRU"
  | "TERM"
  | "HYBRID"
  | "ADVISORY_UNIT";

export type MarketplaceUnitType =
  | "CONDUIT_FOOT"
  | "FIBER_FOOT"
  | "SPLICE_EACH"
  | "CABINET_EACH"
  | "MW_MONTH"
  | "RACK_MONTH"
  | "CROSSING_EACH"
  | "PERMIT_EACH"
  | "BORE_FOOT"
  | "TRANSPORT_MBPS"
  | "TRANSPORT_GBPS"
  | "WAVE_CIRCUIT"
  | "DARK_FIBER_PAIR_MILE"
  | "GPU_RACK_MONTH"
  | "ENGINEERING_HOUR"
  | "CREW_DAY";

export interface MarketplaceUnitPrice {
  unitType: MarketplaceUnitType;
  unitLabel: string;
  price: number;
  currency: "USD";
  notes?: string;
}

export interface MarketplacePriceBook {
  priceBookId: string;
  ownerName: string;
  pricingModel: MarketplacePricingModel;
  assetIds: string[];
  capabilityIds: string[];
  productIds: string[];
  unitPrices: MarketplaceUnitPrice[];
  advisory: true;
  effectiveDate: string;
  notes?: string;
}

export function findAssetsByType(assetType: MarketplaceAssetType, assets: readonly MarketplaceAsset[]): MarketplaceAsset[] {
  return assets.filter((asset) => asset.assetType === assetType);
}

export function findCapabilitiesByType(capabilityType: MarketplaceCapabilityType, capabilities: readonly MarketplaceCapability[]): MarketplaceCapability[] {
  return capabilities.filter((capability) => capability.capabilityType === capabilityType);
}

export function findPriceBooks(
  priceBooks: readonly MarketplacePriceBook[],
  filter: { assetId?: string; capabilityId?: string; productId?: string; unitType?: MarketplaceUnitType } = {},
): MarketplacePriceBook[] {
  return priceBooks.filter((priceBook) => {
    if (filter.assetId && !priceBook.assetIds.includes(filter.assetId)) return false;
    if (filter.capabilityId && !priceBook.capabilityIds.includes(filter.capabilityId)) return false;
    if (filter.productId && !priceBook.productIds.includes(filter.productId)) return false;
    if (filter.unitType && !priceBook.unitPrices.some((unitPrice) => unitPrice.unitType === filter.unitType)) return false;
    return true;
  });
}

export function findAssetsForProduct(product: MarketplaceProduct, assets: readonly MarketplaceAsset[]): MarketplaceAsset[] {
  return assets.filter((asset) => product.requiredAssetTypes.includes(asset.assetType) || product.optionalAssetTypes.includes(asset.assetType));
}
