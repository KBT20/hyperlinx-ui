import type { BuildPath } from "../types/networkAffinity";
import type { ParcelIntelligence, PermitAuthority, PermittingAssessment, RoadIntelligence, RailIntelligence, WaterIntelligence } from "./types";
import { clamp } from "./spatialUtils";

function addAuthority(authorities: Set<PermitAuthority>, authority: PermitAuthority, permits: string[], permit: string) {
  authorities.add(authority);
  permits.push(permit);
}

export function analyzePermitting(args: {
  parcel: ParcelIntelligence;
  road: RoadIntelligence;
  rail: RailIntelligence;
  water: WaterIntelligence;
  buildPath?: BuildPath;
}): PermittingAssessment {
  const authorities = new Set<PermitAuthority>();
  const likelyPermits: string[] = [];

  if (["Interstate", "Highway", "Farm To Market"].includes(args.road.nearestRoad.roadType)) {
    addAuthority(authorities, "TxDOT", likelyPermits, "State ROW / driveway or utility occupancy review");
  }
  if (args.road.nearestRoad.roadType === "County Road" || args.parcel.parcel.parcelType === "County") {
    addAuthority(authorities, "County", likelyPermits, "County ROW permit");
  }
  if (args.road.nearestRoad.roadType === "City Street" || args.parcel.parcel.parcelType === "Municipal") {
    addAuthority(authorities, "Municipality", likelyPermits, "Municipal ROW / traffic control permit");
  }
  if (args.rail.railCrossingCount > 0) {
    addAuthority(authorities, "Railroad", likelyPermits, "Railroad crossing license or encroachment agreement");
  }
  if (args.water.waterCrossingCount > 0 || args.parcel.parcel.parcelType === "Federal") {
    addAuthority(authorities, "Federal", likelyPermits, "Environmental / waterways review");
  }
  if (args.parcel.parcel.parcelType === "Utility" || Number(args.buildPath?.estimatedUndergroundFeet ?? 0) > 0) {
    addAuthority(authorities, "Utility", likelyPermits, "Utility locate and conflict clearance");
  }
  if (!authorities.size) {
    addAuthority(authorities, "Municipality", likelyPermits, "Local construction notice");
  }

  const permitComplexityScore = clamp(
    authorities.size * 9 +
      args.rail.railCrossingCount * 18 +
      args.water.waterCrossingCount * 14 +
      Number(args.buildPath?.highwayCrossingCount ?? 0) * 12 +
      Math.min(Number(args.buildPath?.buildFeet ?? 0) / 450, 24)
  );

  return {
    authorities: Array.from(authorities),
    permitComplexityScore,
    likelyPermits,
    notes: [`Likely permit authorities: ${Array.from(authorities).join(", ")}.`],
  };
}
