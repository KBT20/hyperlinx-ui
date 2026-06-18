import type { CandidateSite } from "../types/candidateSite";
import type { InventoryGraph } from "../types/dal";
import type { AttachmentStrategy, AttachmentType, CapacityAnalysis, NearestNodeResult, NearestRouteResult, NearestStationResult } from "../types/networkAffinity";
import type { RevenueEstimate } from "../types/portfolio";
import type { StreetCenterline } from "../street/streetTypes";
import { BURIED_CONSTRUCTION_ASSUMPTIONS, DEFAULT_CONSTRUCTION_TYPE } from "../engineering/constructionModel";
import { assessConstructability } from "../spatial/constructabilityEngine";
import { clamp } from "./geo";
import { buildPathForAttachment } from "./buildPathEngine";
import { analyzeCapacity } from "./capacityEngine";

const strategyMultipliers: Record<AttachmentType, { cost: number; strategic: number; engineering: number }> = {
  LATERAL: { cost: 1, strategic: 62, engineering: 82 },
  NEW_SEGMENT: { cost: 1.55, strategic: 70, engineering: 60 },
  MIDSPAN_SPLICE: { cost: 1.2, strategic: 68, engineering: 72 },
  EXISTING_NODE_ATTACH: { cost: 0.82, strategic: 74, engineering: 88 },
  EXISTING_STATION_ATTACH: { cost: 0.74, strategic: 66, engineering: 90 },
  RING_EXTENSION: { cost: 2.1, strategic: 88, engineering: 52 },
  REGEN_EXTENSION: { cost: 2.45, strategic: 82, engineering: 48 },
  DATACENTER_EXTENSION: { cost: 2.65, strategic: 94, engineering: 54 },
};

function facilityStrategicBoost(site: CandidateSite, type: AttachmentType) {
  const text = `${site.facilityType ?? ""} ${site.marketSegment ?? ""} ${site.companyName}`.toLowerCase();
  if (/hospital|public safety|data center|hyperscaler/.test(text) && ["RING_EXTENSION", "DATACENTER_EXTENSION", "EXISTING_NODE_ATTACH"].includes(type)) return 10;
  if (/school|municipal|county|government/.test(text) && ["EXISTING_STATION_ATTACH", "LATERAL"].includes(type)) return 7;
  return 0;
}

function capacityPenalty(capacity: CapacityAnalysis) {
  const values = Object.values(capacity);
  if (values.includes("CRITICAL")) return 24;
  if (values.includes("HIGH")) return 12;
  if (values.includes("MEDIUM")) return 4;
  return 0;
}

export function compareAttachmentStrategies(args: {
  graph?: InventoryGraph;
  site: CandidateSite;
  nearestRoute: NearestRouteResult;
  nearestNode: NearestNodeResult;
  nearestStation: NearestStationResult;
  revenue: RevenueEstimate;
  streetCenterlines?: StreetCenterline[];
}) {
  const strategyTypes: AttachmentType[] = [
    "LATERAL",
    "NEW_SEGMENT",
    "MIDSPAN_SPLICE",
    "EXISTING_NODE_ATTACH",
    "EXISTING_STATION_ATTACH",
    "RING_EXTENSION",
    "REGEN_EXTENSION",
    "DATACENTER_EXTENSION",
  ];

  return strategyTypes
    .map((attachmentType): AttachmentStrategy => {
      const attachCoordinate =
        attachmentType === "EXISTING_NODE_ATTACH"
          ? args.nearestNode.coordinate
          : attachmentType === "EXISTING_STATION_ATTACH"
            ? args.nearestStation.coordinate
            : args.nearestRoute.coordinate ?? args.nearestNode.coordinate ?? args.nearestStation.coordinate;
      const path = buildPathForAttachment({
        graph: args.graph,
        site: args.site,
        attachmentCoordinate: attachCoordinate,
        routeId: args.nearestRoute.routeId ?? args.nearestStation.routeId,
        nodeId: args.nearestNode.nodeId,
        stationId: args.nearestStation.stationId,
        attachmentType,
        streetCenterlines: args.streetCenterlines,
      });
      const profile = strategyMultipliers[attachmentType];
      const routeValid = path.routeStatus === "VALID" && path.geometry.length >= 2;
      const fallbackCost = Math.round((path.estimatedUndergroundFeet * BURIED_CONSTRUCTION_ASSUMPTIONS.costPerFoot + path.estimatedCrossings * BURIED_CONSTRUCTION_ASSUMPTIONS.crossingCost) * profile.cost);
      const constructabilityAssessment = assessConstructability(args.site, path);
      const spatialSoftCosts =
        constructabilityAssessment.estimatedPermitCost +
        constructabilityAssessment.estimatedCrossingCost +
        constructabilityAssessment.estimatedEnvironmentalCost +
        constructabilityAssessment.estimatedEngineeringCost;
      const estimatedCost = routeValid ? Math.round((path.estimatedCost ?? fallbackCost) * profile.cost + spatialSoftCosts) : 0;
      const buildPath = {
        ...path,
        constructabilityScore: constructabilityAssessment.constructabilityScore,
        constructabilityAssessment,
        parcelScore: constructabilityAssessment.parcelScore,
        roadAccessScore: constructabilityAssessment.roadAccessScore,
        permitScore: constructabilityAssessment.permitScore,
        crossingScore: constructabilityAssessment.crossingScore,
        estimatedPermitCost: constructabilityAssessment.estimatedPermitCost,
        estimatedCrossingCost: constructabilityAssessment.estimatedCrossingCost,
        estimatedEnvironmentalCost: constructabilityAssessment.estimatedEnvironmentalCost,
        estimatedEngineeringCost: constructabilityAssessment.estimatedEngineeringCost,
        constructionAssumptions: BURIED_CONSTRUCTION_ASSUMPTIONS,
      };
      const capacity = analyzeCapacity(args.nearestRoute.routeId, args.nearestNode.nodeId, args.nearestStation.stationId, args.revenue.estimatedRevenueMonthly);
      const paybackMonths = routeValid ? estimatedCost / Math.max(args.revenue.estimatedMRC * 0.72, 1) : 0;
      const riskScore = routeValid ? clamp((path.riskScore ?? 45) * 0.55 + constructabilityAssessment.riskScore * 0.45) : 100;
      const roi = routeValid ? args.revenue.estimatedTCV / Math.max(estimatedCost, 1) : 0;
      const margin = routeValid ? (args.revenue.estimatedTCV - estimatedCost) / Math.max(args.revenue.estimatedTCV, 1) : 0;
      const engineeringScore = clamp(
        profile.engineering -
          path.buildFeet / 250 -
          capacityPenalty(capacity) -
          riskScore * 0.16 +
          constructabilityAssessment.constructabilityScore * 0.22 +
          constructabilityAssessment.roadAccessScore * 0.06
      );
      const financialScore = routeValid ? clamp(100 - paybackMonths * 2.2 + roi * 6 - riskScore * 0.12 - constructabilityAssessment.permitComplexity * 0.05) : 0;
      const strategicScore = clamp(profile.strategic + facilityStrategicBoost(args.site, attachmentType));
      const compositeScore = Math.round(
        (routeValid ? financialScore : 0) * 0.3 +
          strategicScore * 0.22 +
          engineeringScore * 0.22 +
          constructabilityAssessment.constructabilityScore * 0.14 +
          Math.max(0, 100 - riskScore) * 0.12
      );
      return {
        attachmentType,
        routeId: buildPath.routeId,
        nodeId: buildPath.nodeId,
        stationId: buildPath.stationId,
        buildFeet: buildPath.buildFeet,
        estimatedCost,
        estimatedRevenueAnnual: args.revenue.estimatedRevenueAnnual,
        paybackMonths,
        roi,
        margin,
        riskScore,
        constructionType: DEFAULT_CONSTRUCTION_TYPE,
        constructabilityScore: constructabilityAssessment.constructabilityScore,
        parcelScore: constructabilityAssessment.parcelScore,
        roadAccessScore: constructabilityAssessment.roadAccessScore,
        permitScore: constructabilityAssessment.permitScore,
        crossingScore: constructabilityAssessment.crossingScore,
        estimatedPermitCost: constructabilityAssessment.estimatedPermitCost,
        estimatedCrossingCost: constructabilityAssessment.estimatedCrossingCost,
        estimatedEnvironmentalCost: constructabilityAssessment.estimatedEnvironmentalCost,
        estimatedEngineeringCost: constructabilityAssessment.estimatedEngineeringCost,
        constructabilityAssessment,
        engineeringScore: routeValid ? engineeringScore : 0,
        financialScore: routeValid ? financialScore : 0,
        strategicScore,
        compositeScore: routeValid ? compositeScore : 0,
        buildPath,
        capacity,
        constructionAssumptions: BURIED_CONSTRUCTION_ASSUMPTIONS,
      };
    })
    .sort((a, b) => b.compositeScore - a.compositeScore);
}
