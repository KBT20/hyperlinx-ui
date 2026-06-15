import type { InventoryGraph } from "../types/dal";
import type { CandidateSite } from "../types/candidateSite";
import type { BuildCostModel, CandidateType, OpportunitySeed, PricingModel } from "../types/portfolio";
import { analyzeNetworkAffinity } from "../affinity/networkAffinityEngine";
import { evaluatePortfolioOpportunities } from "./prismOpportunityEngine";

function candidateTypeFor(site: CandidateSite): CandidateType {
  const text = `${site.facilityType ?? ""} ${site.marketSegment ?? ""} ${site.companyName}`.toLowerCase();
  if (/tower|wireless|public safety|dispatch|fire|police/.test(text)) return "tower";
  if (/data center|hyperscaler/.test(text)) return "data_center";
  if (/carrier|telecom|fiber/.test(text)) return "carrier";
  if (/residential|housing|apartment/.test(text)) return "residential_cluster";
  return "enterprise";
}

export function generateOpportunitySeedForCandidate(
  graph: InventoryGraph,
  site: CandidateSite,
  pricingModel?: PricingModel,
  buildCostModel?: BuildCostModel
): OpportunitySeed | null {
  if (!Number.isFinite(site.latitude) || !Number.isFinite(site.longitude)) return null;
  const [seed] = evaluatePortfolioOpportunities(
    graph,
    [
      {
        id: site.candidateId,
        name: site.companyName,
        candidateType: candidateTypeFor(site),
        latitude: Number(site.latitude),
        longitude: Number(site.longitude),
        tags: [site.facilityType ?? "", site.marketSegment ?? ""].filter(Boolean),
      },
    ],
    pricingModel,
    buildCostModel
  );
  const networkAffinity = analyzeNetworkAffinity(graph, site);
  if (!seed) return null;
  const constructabilityScore = networkAffinity?.constructabilityScore ?? networkAffinity?.constructabilityAssessment?.constructabilityScore;
  const blendedOverall = networkAffinity
    ? Math.round(seed.overallScore * 0.42 + networkAffinity.affinityScore * 0.34 + Number(constructabilityScore ?? 50) * 0.24)
    : seed.overallScore;
  return {
        ...seed,
        candidateSiteId: site.candidateId,
        siteName: site.companyName,
        facilityType: site.facilityType,
        marketSegment: site.marketSegment,
        nearestRouteId: networkAffinity?.nearestRoute.routeId ?? seed.nearestRouteId,
        nearestNodeId: networkAffinity?.nearestNode.nodeId ?? seed.nearestNodeId,
        nearestStationId: networkAffinity?.nearestStation.stationId ?? seed.nearestStationId,
        distanceFeet: networkAffinity?.estimatedBuildFootage ?? seed.distanceFeet,
        buildCost: networkAffinity?.preferredStrategy.estimatedCost ?? seed.buildCost,
        paybackMonths: networkAffinity?.preferredStrategy.paybackMonths ?? seed.paybackMonths,
        engineeringScore: networkAffinity?.preferredStrategy.engineeringScore ?? seed.engineeringScore,
        financialScore: networkAffinity?.preferredStrategy.financialScore ?? seed.financialScore,
        strategicScore: networkAffinity?.preferredStrategy.strategicScore ?? seed.strategicScore,
        overallScore: blendedOverall,
        networkAffinity: networkAffinity ?? undefined,
        networkAffinityScore: networkAffinity?.affinityScore,
        attachmentStrategy: networkAffinity?.preferredStrategy,
        buildPath: networkAffinity?.buildPath,
        capacityStatus: networkAffinity?.capacity.projectedUtilization,
        constructionType: networkAffinity?.constructionType,
        riskScore: networkAffinity?.riskScore,
        constructabilityScore,
        permitScore: networkAffinity?.permitScore,
        parcelScore: networkAffinity?.parcelScore,
        roadAccessScore: networkAffinity?.roadAccessScore,
        crossingScore: networkAffinity?.crossingScore,
        utilityConflictRisk: networkAffinity?.constructabilityAssessment?.utilityConflictRisk,
        environmentalRisk: networkAffinity?.constructabilityAssessment?.environmentalRisk,
        estimatedPermitCost: networkAffinity?.estimatedPermitCost,
        estimatedCrossingCost: networkAffinity?.estimatedCrossingCost,
        estimatedEnvironmentalCost: networkAffinity?.estimatedEnvironmentalCost,
        estimatedEngineeringCost: networkAffinity?.estimatedEngineeringCost,
        constructabilityAssessment: networkAffinity?.constructabilityAssessment,
        attachmentCertification: networkAffinity?.attachmentCertification,
        lateralCertification: networkAffinity?.lateralCertification,
        serviceabilityAssessment: networkAffinity?.serviceabilityAssessment,
        certificationSnapshot: networkAffinity?.certificationSnapshot,
        constructionAssumptions: networkAffinity?.constructionAssumptions,
        roi: networkAffinity?.roi,
        margin: networkAffinity?.preferredStrategy.margin,
        buildMiles: networkAffinity?.buildPath.buildMiles,
      };
}

export function generateOpportunitySeedsForCandidates(
  graph: InventoryGraph,
  sites: CandidateSite[],
  pricingModel?: PricingModel,
  buildCostModel?: BuildCostModel
) {
  const seeds = sites
    .map((site) => generateOpportunitySeedForCandidate(graph, site, pricingModel, buildCostModel))
    .filter(Boolean) as OpportunitySeed[];
  return seeds.sort((a, b) => b.overallScore - a.overallScore).map((seed, index) => ({ ...seed, rank: index + 1 }));
}
