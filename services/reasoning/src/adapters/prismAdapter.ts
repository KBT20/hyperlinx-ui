export function prismAdapter(context: any) {
  const seeds = Array.isArray(context?.opportunitySeeds) ? context.opportunitySeeds : [];
  const affinity = context?.networkAffinity;
  const strategy = context?.attachmentStrategy ?? affinity?.preferredStrategy;
  const buildPath = context?.buildPath ?? affinity?.buildPath;
  return {
    opportunityId: context?.opportunityId,
    opportunitySeedId: context?.opportunitySeedId,
    candidateSiteId: context?.candidateSiteId,
    inventoryId: context?.inventoryId,
    graphId: context?.graphId,
    seedCount: seeds.length,
    topSeed: seeds[0]
      ? {
          id: seeds[0].id,
          type: seeds[0].candidateType,
          overallScore: seeds[0].overallScore,
          paybackMonths: seeds[0].paybackMonths,
          estimatedTCV: seeds[0].estimatedTCV,
        }
      : undefined,
    portfolioSummary: context?.portfolioSummary,
    portfolioMetrics: context?.portfolioMetrics,
    phasePlan: context?.phasePlan,
    networkAffinity: affinity
      ? {
          siteId: affinity.siteId,
          affinityScore: affinity.affinityScore,
          nearestRouteId: affinity.nearestRoute?.routeId,
          nearestNodeId: affinity.nearestNode?.nodeId,
          nearestStationId: affinity.nearestStation?.stationId,
          estimatedBuildFootage: affinity.estimatedBuildFootage,
          capacityStatus: affinity.capacity?.projectedUtilization ?? context?.capacityStatus,
        }
      : undefined,
    attachmentStrategy: strategy
      ? {
          attachmentType: strategy.attachmentType,
          routeId: strategy.routeId,
          nodeId: strategy.nodeId,
          stationId: strategy.stationId,
          buildFeet: strategy.buildFeet,
          estimatedCost: strategy.estimatedCost,
          paybackMonths: strategy.paybackMonths,
          compositeScore: strategy.compositeScore,
        }
      : undefined,
    buildPath: buildPath
      ? {
          siteId: buildPath.siteId,
          routeId: buildPath.routeId,
          nodeId: buildPath.nodeId,
          stationId: buildPath.stationId,
          attachmentType: buildPath.attachmentType,
          buildFeet: buildPath.buildFeet,
          estimatedCrossings: buildPath.estimatedCrossings,
          estimatedBores: buildPath.estimatedBores,
          estimatedAerialFeet: buildPath.estimatedAerialFeet,
          estimatedUndergroundFeet: buildPath.estimatedUndergroundFeet,
        }
      : undefined,
    selectedFeature: context?.selectedFeature ? "provided" : "none",
  };
}
