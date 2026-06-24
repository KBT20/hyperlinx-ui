import type { MarketplaceAssetType } from "./MarketplaceAsset";
import type { MarketplaceCapabilityType } from "./MarketplaceCapability";
import type { VendorQualificationStatus, VendorReviewStatus } from "./VendorQualification";
import { isVendorAtLeastQualifiedAs } from "./VendorQualification";
import type { VendorServiceArea } from "./VendorServiceArea";
import { vendorServiceAreaMatchesRegion } from "./VendorServiceArea";

export type VendorCategory =
  | "CONSTRUCTION"
  | "ENGINEERING"
  | "POWER"
  | "UTILITY"
  | "DATA_CENTER"
  | "GPU_PROVIDER"
  | "CARRIER"
  | "FIBER_PROVIDER"
  | "LAND_OWNER"
  | "MATERIAL_SUPPLIER"
  | "EQUIPMENT_SUPPLIER"
  | "INTERCONNECTION_PROVIDER"
  | "TRANSPORT_PROVIDER"
  | "CLOUD_PROVIDER"
  | "PERMITTING_PROVIDER";

export type VendorStatus =
  | "DISCOVERED"
  | "REGISTERED"
  | "ACTIVE"
  | "INACTIVE"
  | "SUSPENDED"
  | "ARCHIVED";

export type VendorAssetOwnershipType =
  | "OWNS"
  | "OPERATES"
  | "LEASES"
  | "REPRESENTS"
  | "SUPPLIES"
  | "UNKNOWN";

export interface VendorCapabilityReference {
  capabilityId: string;
  capabilityType: MarketplaceCapabilityType;
  capabilityName: string;
  notes?: string;
}

export interface VendorAssetReference {
  assetId: string;
  assetType: MarketplaceAssetType;
  ownershipType: VendorAssetOwnershipType;
  notes?: string;
}

export type VendorDiagnosticCode =
  | "VENDOR_PROFILE_REGISTERED"
  | "VENDOR_CAPABILITY_LINKED"
  | "VENDOR_ASSET_LINKED"
  | "VENDOR_PRICEBOOK_REGISTERED"
  | "VENDOR_REGION_LINKED"
  | "VENDOR_QUALIFICATION_RECORDED";

export interface VendorDiagnostic {
  code: VendorDiagnosticCode;
  vendorId: string;
  severity: "INFO" | "WARNING";
  message: string;
  details?: Record<string, unknown>;
}

export interface VendorProfile {
  vendorId: string;
  vendorName: string;
  vendorCategory: VendorCategory;
  status: VendorStatus;
  website?: string;
  serviceRegions: VendorServiceArea[];
  capabilities: VendorCapabilityReference[];
  assets: VendorAssetReference[];
  priceBooks: string[];
  qualificationStatus: VendorQualificationStatus;
  insuranceStatus: VendorReviewStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export function findVendorByCategory(category: VendorCategory, vendors: readonly VendorProfile[]): VendorProfile[] {
  return vendors.filter((vendor) => vendor.vendorCategory === category);
}

export function findVendorByCapability(
  capabilityType: MarketplaceCapabilityType,
  vendors: readonly VendorProfile[],
): VendorProfile[] {
  return vendors.filter((vendor) => vendor.capabilities.some((capability) => capability.capabilityType === capabilityType));
}

export function findVendorByAsset(assetIdOrType: string, vendors: readonly VendorProfile[]): VendorProfile[] {
  return vendors.filter((vendor) =>
    vendor.assets.some((asset) => asset.assetId === assetIdOrType || asset.assetType === assetIdOrType),
  );
}

export function findVendorByRegion(region: string, vendors: readonly VendorProfile[]): VendorProfile[] {
  return vendors.filter((vendor) => vendor.serviceRegions.some((serviceArea) => vendorServiceAreaMatchesRegion(serviceArea, region)));
}

export function findQualifiedVendors(
  vendors: readonly VendorProfile[],
  minimumStatus: VendorQualificationStatus = "QUALIFIED",
): VendorProfile[] {
  return vendors.filter((vendor) => isVendorAtLeastQualifiedAs(vendor.qualificationStatus, minimumStatus));
}

export function createVendorDiagnostic(
  code: VendorDiagnosticCode,
  vendorId: string,
  message: string,
  details?: Record<string, unknown>,
): VendorDiagnostic {
  return {
    code,
    vendorId,
    severity: "INFO",
    message,
    details,
  };
}

