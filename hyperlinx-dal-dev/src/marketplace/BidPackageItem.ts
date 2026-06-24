import type { MarketplaceCapabilityType } from "./MarketplaceCapability";
import type {
  BidPackageObjectReference,
  BidPackageSegmentReference,
  BidPackageStationReference,
  CategoryAllocation,
  DisciplineAllocation,
  SegmentAllocation,
  StationAllocation,
} from "./BidPackageStationAllocation";
import type { BidPackageQuantity } from "./BidPackageQuantity";
import { calculateBidPackageQuantityTotal } from "./BidPackageQuantity";

export type BidPackageItemCategory =
  | "CONDUIT"
  | "FIBER"
  | "SPLICING"
  | "OPTICAL"
  | "CIVIL"
  | "POWER"
  | "PERMITTING"
  | "INTERCONNECTION"
  | "PROPERTY"
  | "MATERIAL"
  | "LABOR"
  | "TRANSPORT"
  | "GPU_CAPACITY";

export interface BidPackageItem {
  itemId: string;
  itemName: string;
  itemCategory: BidPackageItemCategory;
  discipline: string;
  requiredCapabilityTypes: MarketplaceCapabilityType[];
  quantity: BidPackageQuantity;
  objectReference: BidPackageObjectReference;
  stationReference: BidPackageStationReference;
  segmentReference: BidPackageSegmentReference;
  stationAllocations: StationAllocation[];
  segmentAllocations: SegmentAllocation[];
  disciplineAllocations: DisciplineAllocation[];
  categoryAllocations: CategoryAllocation[];
  notes?: string;
}

export function estimateBidPackageItemTotal(item: BidPackageItem): number | undefined {
  return calculateBidPackageQuantityTotal(item.quantity);
}

