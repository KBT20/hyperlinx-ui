import type { MarketplacePricingModel, MarketplaceUnitType } from "./MarketplacePriceBook";
import type { VendorServiceArea } from "./VendorServiceArea";

export interface VendorPriceBook {
  priceBookId: string;
  vendorId: string;
  effectiveDate: string;
  pricingModel: MarketplacePricingModel;
  unitType: MarketplaceUnitType;
  unitPrice: number;
  currency: "USD";
  marketCoverage: VendorServiceArea[];
  advisory: true;
  notes?: string;
}

export interface VendorPriceBookRegistry {
  registryId: string;
  priceBooks: VendorPriceBook[];
  updatedAt: string;
  notes?: string;
}

export function findVendorPriceBooks(
  priceBooks: readonly VendorPriceBook[],
  filter: {
    vendorId?: string;
    pricingModel?: MarketplacePricingModel;
    unitType?: MarketplaceUnitType;
    region?: string;
  } = {},
): VendorPriceBook[] {
  const normalizedRegion = filter.region?.trim().toLowerCase();

  return priceBooks.filter((priceBook) => {
    if (filter.vendorId && priceBook.vendorId !== filter.vendorId) return false;
    if (filter.pricingModel && priceBook.pricingModel !== filter.pricingModel) return false;
    if (filter.unitType && priceBook.unitType !== filter.unitType) return false;
    if (
      normalizedRegion &&
      !priceBook.marketCoverage.some((coverage) => {
        const names = [
          coverage.name,
          coverage.country,
          ...(coverage.regions ?? []),
          ...(coverage.states ?? []),
          ...(coverage.msas ?? []),
          ...(coverage.counties ?? []),
          ...(coverage.corridors ?? []),
        ];
        return names.some((name) => name?.toLowerCase() === normalizedRegion);
      })
    ) {
      return false;
    }
    return true;
  });
}

