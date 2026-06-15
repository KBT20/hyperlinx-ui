import type { CandidateSite } from "../types/candidateSite";
import type { DALCoordinate, InventoryGraph } from "../types/dal";
import type { AttachmentType, BuildPath } from "../types/networkAffinity";
import { generateCorridorPathOptions, selectBestCorridorPath } from "../corridor/corridorPathEngine";
import { DEFAULT_CONSTRUCTION_TYPE, estimateBuriedConstructionCost, BURIED_CONSTRUCTION_ASSUMPTIONS } from "../engineering/constructionModel";
import { haversineFeet } from "./geo";

export function buildPathForAttachment(args: {
  graph?: InventoryGraph;
  site: CandidateSite;
  attachmentCoordinate?: DALCoordinate;
  routeId?: string;
  nodeId?: string;
  stationId?: string;
  attachmentType: AttachmentType;
}): BuildPath {
  const siteCoord: DALCoordinate = [Number(args.site.longitude), Number(args.site.latitude)];
  const attach = args.attachmentCoordinate ?? siteCoord;
  const corridorPath =
    args.graph && args.attachmentCoordinate
      ? selectBestCorridorPath(
          generateCorridorPathOptions({
            graph: args.graph,
            site: args.site,
            attachmentCoordinate: args.attachmentCoordinate,
            routeId: args.routeId,
            nodeId: args.nodeId,
            stationId: args.stationId,
            attachmentType: args.attachmentType,
          })
        )
      : null;
  const buildFeet = haversineFeet(siteCoord, attach);
  const routeableFeet = corridorPath?.distanceFeet ?? buildFeet;
  const estimatedUndergroundFeet = Math.round(routeableFeet);
  const estimatedAerialFeet = 0;
  const estimatedCrossings = corridorPath?.crossings ?? Math.max(0, Math.round(buildFeet / 1600));
  const estimatedBores = Math.max(0, Math.round(estimatedUndergroundFeet / 2200));
  const buriedCost = estimateBuriedConstructionCost({
    buildFeet: routeableFeet,
    boreFeet: estimatedBores * 180,
    crossings: estimatedCrossings,
  });
  return {
    siteId: args.site.candidateId,
    routeId: corridorPath?.attachmentRouteId ?? args.routeId,
    nodeId: corridorPath?.attachmentNodeId ?? args.nodeId,
    stationId: corridorPath?.attachmentStationId ?? args.stationId,
    attachmentType: args.attachmentType,
    buildFeet: Math.round(routeableFeet),
    buildMiles: corridorPath?.buildMiles ?? routeableFeet / 5280,
    estimatedRouteMiles: corridorPath?.estimatedRouteMiles ?? routeableFeet / 5280,
    estimatedCrossings,
    estimatedBores,
    estimatedAerialFeet,
    estimatedUndergroundFeet,
    railCrossingCount: corridorPath?.railCrossingCount,
    highwayCrossingCount: corridorPath?.highwayCrossingCount,
    waterCrossingCount: corridorPath?.waterCrossingCount,
    turnCount: corridorPath?.turnCount,
    segmentCount: corridorPath?.segmentCount,
    constructionType: DEFAULT_CONSTRUCTION_TYPE,
    estimatedCost: buriedCost.totalCost,
    riskScore: corridorPath?.risk.riskScore,
    constructabilityScore: corridorPath?.constructabilityScore,
    corridorPath: corridorPath ?? undefined,
    corridorCost: corridorPath?.cost,
    corridorRisk: corridorPath?.risk,
    constructionAssumptions: BURIED_CONSTRUCTION_ASSUMPTIONS,
    geometry: corridorPath?.coordinates ?? [siteCoord, attach],
  };
}
