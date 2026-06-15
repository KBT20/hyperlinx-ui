import type { CandidateSite } from "../types/candidateSite";
import type { BuildPath } from "../types/networkAffinity";
import { analyzeParcel } from "./parcelEngine";
import { analyzePermitting } from "./permittingEngine";
import { analyzeRailCrossings } from "./railEngine";
import { analyzeRoadAccess } from "./roadEngine";
import { analyzeWaterCrossings } from "./waterEngine";
import type { ConstructabilityAssessment, SpatialLayers } from "./types";
import { bandedCost, clamp, scoreFromRisk, stableHash } from "./spatialUtils";

function ownershipComplexity(type: string) {
  if (type === "Utility") return 18;
  if (type === "Municipal") return 24;
  if (type === "County") return 30;
  if (type === "Commercial") return 32;
  if (type === "Industrial") return 38;
  if (type === "State") return 48;
  if (type === "Residential") return 55;
  if (type === "Federal") return 66;
  return 58;
}

function buildableStatus(score: number, permitComplexity: number, crossingComplexity: number) {
  if (score >= 72 && permitComplexity < 55 && crossingComplexity < 50) return "BUILDABLE";
  if (score >= 48) return "CONSTRAINED";
  return "HIGH_RISK";
}

export function assessConstructability(site: CandidateSite, buildPath?: BuildPath, layers?: SpatialLayers): ConstructabilityAssessment {
  const parcel = analyzeParcel(site, layers);
  const road = analyzeRoadAccess(site, layers);
  const rail = analyzeRailCrossings(site, buildPath, layers);
  const water = analyzeWaterCrossings(site, buildPath, layers);
  const permitting = analyzePermitting({ parcel, road, rail, water, buildPath });
  const buildFeet = Number(buildPath?.buildFeet ?? 0);
  const undergroundShare = buildFeet > 0 ? Number(buildPath?.estimatedUndergroundFeet ?? 0) / buildFeet : 0.5;
  const crossingCount = rail.railCrossingCount + water.waterCrossingCount + Number(buildPath?.highwayCrossingCount ?? 0);
  const rowComplexity = clamp(ownershipComplexity(parcel.parcel.ownershipType) + Math.min(buildFeet / 700, 24) - road.roadAccessScore * 0.12);
  const permitComplexity = permitting.permitComplexityScore;
  const crossingComplexity = clamp(rail.railRiskScore * 0.46 + water.waterRiskScore * 0.4 + Number(buildPath?.highwayCrossingCount ?? 0) * 10);
  const utilityConflictRisk = clamp((parcel.parcel.ownershipType === "Utility" ? 18 : 36) + undergroundShare * 38 + crossingCount * 4);
  const environmentalRisk = clamp(water.waterRiskScore * 0.72 + (parcel.parcel.ownershipType === "Federal" ? 18 : 0) + Math.min(buildFeet / 1200, 18));
  const constructionDifficulty = clamp(
    Math.min(buildFeet / 280, 35) +
      undergroundShare * 34 +
      Number(buildPath?.estimatedBores ?? 0) * 4 +
      Number(buildPath?.turnCount ?? 0) * 1.7 +
      crossingCount * 5
  );
  const parcelScore = parcel.parcelScore;
  const roadAccessScore = road.roadAccessScore;
  const permitScore = scoreFromRisk(permitComplexity);
  const crossingScore = scoreFromRisk(crossingComplexity);
  const riskScore = clamp(
    rowComplexity * 0.18 +
      permitComplexity * 0.2 +
      crossingComplexity * 0.2 +
      utilityConflictRisk * 0.14 +
      environmentalRisk * 0.12 +
      constructionDifficulty * 0.16
  );
  const constructabilityScore = clamp(
    parcelScore * 0.18 +
      roadAccessScore * 0.18 +
      permitScore * 0.18 +
      crossingScore * 0.18 +
      scoreFromRisk(utilityConflictRisk) * 0.1 +
      scoreFromRisk(environmentalRisk) * 0.08 +
      scoreFromRisk(constructionDifficulty) * 0.1
  );
  const estimatedPermitCost = bandedCost(3500, permitting.authorities.length, 6500) + Math.round(permitComplexity * 450);
  const estimatedCrossingCost = Math.round(rail.railCrossingCount * 65000 + water.waterCrossingCount * 42000 + Number(buildPath?.highwayCrossingCount ?? 0) * 55000);
  const estimatedEnvironmentalCost = Math.round(environmentalRisk * 850 + water.waterCrossingCount * 9000);
  const estimatedEngineeringCost = Math.round(Math.max(8500, buildFeet * 1.15 + constructionDifficulty * 700));

  return {
    assessmentId: `construct-${stableHash(`${site.candidateId}|${buildPath?.attachmentType ?? ""}|${buildPath?.buildFeet ?? 0}`).toString(16)}`,
    siteId: site.candidateId,
    createdAt: new Date().toISOString(),
    parcel,
    road,
    rail,
    water,
    permitting,
    rowComplexity,
    permitComplexity,
    crossingComplexity,
    utilityConflictRisk,
    environmentalRisk,
    constructionDifficulty,
    constructabilityScore,
    parcelScore,
    roadAccessScore,
    permitScore,
    crossingScore,
    riskScore,
    buildableStatus: buildableStatus(constructabilityScore, permitComplexity, crossingComplexity),
    estimatedPermitCost,
    estimatedCrossingCost,
    estimatedEnvironmentalCost,
    estimatedEngineeringCost,
    notes: [
      ...parcel.notes,
      ...road.notes,
      ...rail.notes,
      ...water.notes,
      ...permitting.notes,
      `Constructability score ${Math.round(constructabilityScore)} with ${Math.round(riskScore)} risk.`,
    ],
  };
}
