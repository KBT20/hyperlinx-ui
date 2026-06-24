import type { MarketplaceCapabilityType } from "./MarketplaceCapability";
import type { VendorCategory, VendorProfile } from "./VendorProfile";
import type { BidPackageItem, BidPackageItemCategory } from "./BidPackageItem";
import { estimateBidPackageItemTotal } from "./BidPackageItem";

export type BidPackageType =
  | "FULL_PROJECT"
  | "SEGMENT"
  | "STATION_GROUP"
  | "DISCIPLINE"
  | "CATEGORY"
  | "HYBRID";

export type BidPackageStatus =
  | "DRAFT"
  | "READY_FOR_REVIEW"
  | "REVIEWED"
  | "ARCHIVED";

export type BidPackageDiagnosticCode =
  | "BID_PACKAGE_CREATED"
  | "BID_PACKAGE_ITEM_CREATED"
  | "BID_PACKAGE_STATION_LINKED"
  | "BID_PACKAGE_SEGMENT_LINKED"
  | "BID_PACKAGE_VENDOR_MATCHED"
  | "BID_PACKAGE_VALIDATED";

export interface BidPackageDiagnostic {
  code: BidPackageDiagnosticCode;
  packageId: string;
  severity: "INFO" | "WARNING";
  message: string;
  details?: Record<string, unknown>;
}

export interface BidPackage {
  packageId: string;
  packageName: string;
  packageType: BidPackageType;
  status: BidPackageStatus;
  scopeVersionId?: string;
  opportunityId?: string;
  corridorId?: string;
  segmentIds: string[];
  stationIds: string[];
  disciplines: string[];
  categories: BidPackageItemCategory[];
  items: BidPackageItem[];
  matchedVendorIds: string[];
  diagnostics: BidPackageDiagnostic[];
  createdAt: string;
  updatedAt: string;
  notes?: string;
}

export interface BidPackageGenerationInput {
  packageId: string;
  packageName: string;
  packageType: BidPackageType;
  items: BidPackageItem[];
  scopeVersionId?: string;
  opportunityId?: string;
  corridorId?: string;
  segmentIds?: string[];
  stationIds?: string[];
  notes?: string;
}

export function createBidPackageDiagnostic(
  code: BidPackageDiagnosticCode,
  packageId: string,
  message: string,
  details?: Record<string, unknown>,
): BidPackageDiagnostic {
  return {
    code,
    packageId,
    severity: "INFO",
    message,
    details,
  };
}

export function generateBidPackages(inputs: readonly BidPackageGenerationInput[]): BidPackage[] {
  return inputs.map((input) => createBidPackage(input));
}

export function generateSegmentPackage(input: Omit<BidPackageGenerationInput, "packageType">): BidPackage {
  return createBidPackage({ ...input, packageType: "SEGMENT" });
}

export function generateStationGroupPackage(input: Omit<BidPackageGenerationInput, "packageType">): BidPackage {
  return createBidPackage({ ...input, packageType: "STATION_GROUP" });
}

export function generateDisciplinePackage(input: Omit<BidPackageGenerationInput, "packageType">): BidPackage {
  return createBidPackage({ ...input, packageType: "DISCIPLINE" });
}

export function generateCategoryPackage(input: Omit<BidPackageGenerationInput, "packageType">): BidPackage {
  return createBidPackage({ ...input, packageType: "CATEGORY" });
}

export function generateHybridPackage(input: Omit<BidPackageGenerationInput, "packageType">): BidPackage {
  return createBidPackage({ ...input, packageType: "HYBRID" });
}

export function matchVendorCategories(packageType: BidPackageType, vendors: readonly VendorProfile[]): VendorProfile[] {
  const categoriesByPackageType: Record<BidPackageType, VendorCategory[]> = {
    FULL_PROJECT: ["CONSTRUCTION", "ENGINEERING", "FIBER_PROVIDER", "TRANSPORT_PROVIDER"],
    SEGMENT: ["CONSTRUCTION", "ENGINEERING"],
    STATION_GROUP: ["CONSTRUCTION", "ENGINEERING"],
    DISCIPLINE: ["CONSTRUCTION", "ENGINEERING", "POWER", "PERMITTING_PROVIDER", "TRANSPORT_PROVIDER", "INTERCONNECTION_PROVIDER"],
    CATEGORY: ["CONSTRUCTION", "POWER", "MATERIAL_SUPPLIER", "EQUIPMENT_SUPPLIER", "TRANSPORT_PROVIDER"],
    HYBRID: ["CONSTRUCTION", "FIBER_PROVIDER", "TRANSPORT_PROVIDER", "INTERCONNECTION_PROVIDER"],
  };
  const allowedCategories = categoriesByPackageType[packageType];
  return vendors.filter((vendor) => allowedCategories.includes(vendor.vendorCategory));
}

export function matchCapabilities(requiredCapabilities: readonly MarketplaceCapabilityType[], vendors: readonly VendorProfile[]): VendorProfile[] {
  if (requiredCapabilities.length === 0) return [];
  return vendors.filter((vendor) =>
    requiredCapabilities.every((requiredCapability) =>
      vendor.capabilities.some((capability) => capability.capabilityType === requiredCapability),
    ),
  );
}

export function estimateBidPackageTotal(bidPackage: BidPackage): number {
  return bidPackage.items.reduce((total, item) => total + (estimateBidPackageItemTotal(item) ?? 0), 0);
}

export function alignBidPackageVendors(bidPackage: BidPackage, vendors: readonly VendorProfile[]): BidPackage {
  const requiredCapabilities = [...new Set(bidPackage.items.flatMap((item) => item.requiredCapabilityTypes))];
  const categoryMatches = matchVendorCategories(bidPackage.packageType, vendors);
  const capabilityMatches = matchCapabilities(requiredCapabilities, vendors);
  const matchedVendorIds = [...new Set([...categoryMatches, ...capabilityMatches].map((vendor) => vendor.vendorId))];

  return {
    ...bidPackage,
    matchedVendorIds,
    diagnostics: [
      ...bidPackage.diagnostics,
      ...matchedVendorIds.map((vendorId) =>
        createBidPackageDiagnostic("BID_PACKAGE_VENDOR_MATCHED", bidPackage.packageId, `${vendorId} matched.`, {
          vendorId,
          requiredCapabilities,
        }),
      ),
      createBidPackageDiagnostic("BID_PACKAGE_VALIDATED", bidPackage.packageId, `${bidPackage.packageName} validated.`, {
        itemCount: bidPackage.items.length,
        stationCount: bidPackage.stationIds.length,
        segmentCount: bidPackage.segmentIds.length,
        matchedVendorCount: matchedVendorIds.length,
      }),
    ],
  };
}

function createBidPackage(input: BidPackageGenerationInput): BidPackage {
  const now = new Date().toISOString();
  const disciplines = [...new Set(input.items.map((item) => item.discipline))];
  const categories = [...new Set(input.items.map((item) => item.itemCategory))];
  const stationIds = [...new Set([...(input.stationIds ?? []), ...input.items.map((item) => item.stationReference.stationId)])];
  const segmentIds = [...new Set([...(input.segmentIds ?? []), ...input.items.map((item) => item.segmentReference.segmentId)])];

  return {
    packageId: input.packageId,
    packageName: input.packageName,
    packageType: input.packageType,
    status: "DRAFT",
    scopeVersionId: input.scopeVersionId,
    opportunityId: input.opportunityId,
    corridorId: input.corridorId,
    segmentIds,
    stationIds,
    disciplines,
    categories,
    items: [...input.items],
    matchedVendorIds: [],
    diagnostics: [
      createBidPackageDiagnostic("BID_PACKAGE_CREATED", input.packageId, `${input.packageName} created.`, {
        packageType: input.packageType,
        itemCount: input.items.length,
      }),
      ...input.items.map((item) =>
        createBidPackageDiagnostic("BID_PACKAGE_ITEM_CREATED", input.packageId, `${item.itemName} item created.`, {
          itemId: item.itemId,
          unit: item.quantity.unit,
          quantity: item.quantity.quantity,
        }),
      ),
      ...stationIds.map((stationId) =>
        createBidPackageDiagnostic("BID_PACKAGE_STATION_LINKED", input.packageId, `${stationId} linked.`, {
          stationId,
        }),
      ),
      ...segmentIds.map((segmentId) =>
        createBidPackageDiagnostic("BID_PACKAGE_SEGMENT_LINKED", input.packageId, `${segmentId} linked.`, {
          segmentId,
        }),
      ),
    ],
    createdAt: now,
    updatedAt: now,
    notes: input.notes,
  };
}
