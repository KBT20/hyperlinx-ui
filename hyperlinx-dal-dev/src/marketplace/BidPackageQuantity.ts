import type { MarketplaceUnitType } from "./MarketplacePriceBook";

export type BidPackageQuantityUnit =
  | "FEET"
  | "MILES"
  | "COUNT"
  | "PAIR_MILES"
  | "CROSSINGS"
  | "SPLICES"
  | "CABINETS"
  | "REGENS"
  | "ADMS"
  | "RACKS"
  | "MW"
  | "KW"
  | "ACRES"
  | "PERMITS"
  | "MANHOLES"
  | "HANDHOLES"
  | "DUCTS"
  | "FIBERS";

export interface BidPackageQuantity {
  quantityId: string;
  quantity: number;
  unit: BidPackageQuantityUnit;
  unitLabel: string;
  marketplaceUnitType?: MarketplaceUnitType;
  estimatedUnitCost?: number;
  estimatedTotal?: number;
  priceBookId?: string;
  notes?: string;
}

export function calculateBidPackageQuantityTotal(quantity: BidPackageQuantity): number | undefined {
  if (quantity.estimatedTotal !== undefined) return quantity.estimatedTotal;
  if (quantity.estimatedUnitCost === undefined) return undefined;
  return quantity.quantity * quantity.estimatedUnitCost;
}

