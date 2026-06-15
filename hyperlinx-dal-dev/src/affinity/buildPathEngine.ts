import type { CandidateSite } from "../types/candidateSite";
import type { DALCoordinate, InventoryGraph } from "../types/dal";
import type { AttachmentType, BuildPath } from "../types/networkAffinity";
import { generateCorridorPathOptions, selectBestCorridorPath } from "../corridor/corridorPathEngine";
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
  const undergroundShare = args.attachmentType === "EXISTING_NODE_ATTACH" || args.attachmentType === "EXISTING_STATION_ATTACH" ? 0.55 : 0.75;
  const routeableFeet = corridorPath?.distanceFeet ?? buildFeet;
  const estimatedUndergroundFeet = Math.round(routeableFeet * undergroundShare);
  const estimatedAerialFeet = Math.max(0, Math.round(routeableFeet - estimatedUndergroundFeet));
  return {
    siteId: args.site.candidateId,
    routeId: corridorPath?.attachmentRouteId ?? args.routeId,
    nodeId: corridorPath?.attachmentNodeId ?? args.nodeId,
    stationId: corridorPath?.attachmentStationId ?? args.stationId,
    attachmentType: args.attachmentType,
    buildFeet: Math.round(routeableFeet),
    buildMiles: corridorPath?.buildMiles ?? routeableFeet / 5280,
    estimatedRouteMiles: corridorPath?.estimatedRouteMiles ?? routeableFeet / 5280,
    estimatedCrossings: corridorPath?.crossings ?? Math.max(0, Math.round(buildFeet / 1600)),
    estimatedBores: Math.max(0, Math.round(estimatedUndergroundFeet / 2200)),
    estimatedAerialFeet,
    estimatedUndergroundFeet,
    railCrossingCount: corridorPath?.railCrossingCount,
    highwayCrossingCount: corridorPath?.highwayCrossingCount,
    waterCrossingCount: corridorPath?.waterCrossingCount,
    turnCount: corridorPath?.turnCount,
    segmentCount: corridorPath?.segmentCount,
    constructionType: corridorPath?.constructionType,
    estimatedCost: corridorPath?.cost.nrcEstimate,
    riskScore: corridorPath?.risk.riskScore,
    constructabilityScore: corridorPath?.constructabilityScore,
    corridorPath: corridorPath ?? undefined,
    corridorCost: corridorPath?.cost,
    corridorRisk: corridorPath?.risk,
    geometry: corridorPath?.coordinates ?? [siteCoord, attach],
  };
}
