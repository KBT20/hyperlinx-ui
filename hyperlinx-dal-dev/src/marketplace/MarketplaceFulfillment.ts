import type { SharedOpportunityMapProjection } from "../mapkernel";

export type MarketplaceResponseType = "FULL_SCOPE" | "PARTIAL_SCOPE" | "CAPACITY_OFFER" | "MATERIAL_OFFER" | "NO_BID";

export type MarketplaceDemandLine = { demandLineId: string; category: string; description: string; quantity: number; unit: string };
export type MarketplaceCapacityCoverage = { requirementId: string; workType: string; requiredCrews: number; requiredEquipment: number; offered: number; allocated: number; remaining: number; offeredCoveragePercent: number; allocatedCoveragePercent: number };
export type MarketplaceMaterialCoverage = MarketplaceDemandLine & { offered: number; allocated: number; remaining: number; offeredCoveragePercent: number; allocatedCoveragePercent: number };

export interface MarketplaceFulfillmentState {
  demand: {
    demandProjectionId: string; scopeVersionId: string; scopeVersionHash: string; certifiedIofPackageId: string; serviceOrderId: string; customerId: string; opportunityId: string; productId: string;
    route: { routeRepositoryId: string; routeRevision: string; routeGeometryId: string; geometryHash: string; routeFeet: number; routeMiles: number };
    stationSummary: { count: number; firstStationId: string; lastStationId: string };
    stationReferences: string[];
    segmentCount: number; objectCount: number; objectCounts: Record<string, number>; materialLines: MarketplaceDemandLine[];
    capacityRequirements: Array<{ requirementId: string; workType: string; requiredCrews: number; requiredEquipment: number }>;
  };
  packages: Array<Record<string, any>>;
  responses: Array<Record<string, any>>;
  latestResponses: Array<Record<string, any>>;
  allocations: Array<Record<string, any>>;
  awards: Array<Record<string, any>>;
  observations: Array<Record<string, any>>;
  coverage: { capacity: MarketplaceCapacityCoverage[]; material: MarketplaceMaterialCoverage[]; scheduleState: string; scheduleConflicts: string[]; calculatedBy: string };
  sharedOpportunityMapProjection: SharedOpportunityMapProjection;
  sourceAuthorityHash: string;
}
