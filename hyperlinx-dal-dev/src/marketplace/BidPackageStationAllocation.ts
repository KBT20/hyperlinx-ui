export type BidPackageObjectDomain =
  | "INFRASTRUCTURE"
  | "POWER"
  | "INTERCONNECTION"
  | "PROPERTY"
  | "OPERATIONAL"
  | "MONETIZATION";

export interface BidPackageObjectReference {
  objectId: string;
  objectType: string;
  objectDomain: BidPackageObjectDomain;
  scopeVersionId?: string;
  notes?: string;
}

export interface BidPackageStationReference {
  stationId: string;
  stationLabel: string;
  routeId?: string;
  scopeVersionId?: string;
  measureFeet?: number;
  notes?: string;
}

export interface BidPackageSegmentReference {
  segmentId: string;
  segmentName: string;
  routeId?: string;
  startStationId?: string;
  endStationId?: string;
  startMeasureFeet?: number;
  endMeasureFeet?: number;
  notes?: string;
}

export interface StationAllocation {
  allocationId: string;
  stationReference: BidPackageStationReference;
  quantityShare: number;
  estimatedCostShare?: number;
  notes?: string;
}

export interface SegmentAllocation {
  allocationId: string;
  segmentReference: BidPackageSegmentReference;
  quantityShare: number;
  estimatedCostShare?: number;
  notes?: string;
}

export interface DisciplineAllocation {
  allocationId: string;
  discipline: string;
  quantityShare: number;
  estimatedCostShare?: number;
  notes?: string;
}

export interface CategoryAllocation {
  allocationId: string;
  category: string;
  quantityShare: number;
  estimatedCostShare?: number;
  notes?: string;
}

