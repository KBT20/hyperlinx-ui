import { haversineFeet } from "../affinity/geo";
import type { CustomerTwinObject, CustomerTwinRenderableState, CustomerTwinRoute, CustomerTwinStation } from "../customerTwin/CustomerTwin";
import type { DALCoordinate } from "../types/dal";

export type CommercialAttachmentType =
  | "BACKBONE_STATION"
  | "ROUTE_EDGE"
  | "POP"
  | "SPLICE_CASE"
  | "HANDHOLE"
  | "VAULT"
  | "REGEN"
  | "CUSTOMER_ENTRY"
  | "PROPOSED_EAP";

export interface AttachmentCandidate {
  id: string;
  accountId: string;
  routeId: string;
  routeName: string;
  stationId?: string;
  stationMeasureFeet?: number;
  projectedLatitude: number;
  projectedLongitude: number;
  distanceFeet: number;
  attachmentType: CommercialAttachmentType;
  confidence: number;
  score: number;
  reasons: string[];
  warnings: string[];
}

export interface AttachmentResolution {
  candidateLocationId: string;
  recommendedAttachment?: AttachmentCandidate;
  alternatives: AttachmentCandidate[];
  status: "READY" | "NO_ROUTABLE_ATTACHMENT" | "CUSTOMER_TWIN_MISSING";
  diagnostics: string[];
}

export interface CommercialAttachmentRequest {
  accountId: string;
  candidateLocationId: string;
  latitude: number;
  longitude: number;
  customerTwinState: CustomerTwinRenderableState | null | undefined;
  selectedInventoryLayerIds?: string[];
}

type ProjectedRoutePoint = {
  coordinate: DALCoordinate;
  distanceFeet: number;
  measureFeet: number;
};

const FEET_PER_LAT_DEGREE = 364000;

function validCoordinate(coordinate: DALCoordinate | undefined): coordinate is DALCoordinate {
  return Boolean(coordinate && Number.isFinite(coordinate[0]) && Number.isFinite(coordinate[1]));
}

function safeId(value: string) {
  return value.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "attachment";
}

function feetPerLonDegree(latitude: number) {
  return Math.max(1, FEET_PER_LAT_DEGREE * Math.cos((latitude * Math.PI) / 180));
}

function projectedPointOnSegment(point: DALCoordinate, start: DALCoordinate, end: DALCoordinate, cumulativeFeet: number): ProjectedRoutePoint {
  const referenceLat = (point[1] + start[1] + end[1]) / 3;
  const feetPerLon = feetPerLonDegree(referenceLat);
  const px = (point[0] - start[0]) * feetPerLon;
  const py = (point[1] - start[1]) * FEET_PER_LAT_DEGREE;
  const sx = 0;
  const sy = 0;
  const ex = (end[0] - start[0]) * feetPerLon;
  const ey = (end[1] - start[1]) * FEET_PER_LAT_DEGREE;
  const dx = ex - sx;
  const dy = ey - sy;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared ? Math.max(0, Math.min(1, ((px - sx) * dx + (py - sy) * dy) / lengthSquared)) : 0;
  const coordinate: DALCoordinate = [start[0] + (end[0] - start[0]) * t, start[1] + (end[1] - start[1]) * t];
  const segmentFeet = haversineFeet(start, end);
  return {
    coordinate,
    distanceFeet: haversineFeet(point, coordinate),
    measureFeet: cumulativeFeet + segmentFeet * t,
  };
}

function nearestPointOnRoute(point: DALCoordinate, route: CustomerTwinRoute): ProjectedRoutePoint | null {
  if (route.coordinates.length < 2) return null;
  let cumulativeFeet = 0;
  let best: ProjectedRoutePoint | null = null;
  for (let index = 1; index < route.coordinates.length; index += 1) {
    const start = route.coordinates[index - 1];
    const end = route.coordinates[index];
    if (!validCoordinate(start) || !validCoordinate(end)) continue;
    const projected = projectedPointOnSegment(point, start, end, cumulativeFeet);
    if (!best || projected.distanceFeet < best.distanceFeet) best = projected;
    cumulativeFeet += haversineFeet(start, end);
  }
  return best;
}

function nearestStationForRoute(stations: CustomerTwinStation[], routeId: string, coordinate: DALCoordinate): CustomerTwinStation | undefined {
  return stations
    .filter((station) => station.routeId === routeId)
    .sort((a, b) => haversineFeet(a.coordinate, coordinate) - haversineFeet(b.coordinate, coordinate))[0];
}

function candidateScore(type: CommercialAttachmentType, distanceFeet: number, hasStation: boolean) {
  const priority: Record<CommercialAttachmentType, number> = {
    BACKBONE_STATION: 100,
    ROUTE_EDGE: 94,
    POP: 84,
    SPLICE_CASE: 80,
    VAULT: 76,
    HANDHOLE: 74,
    REGEN: 72,
    CUSTOMER_ENTRY: 60,
    PROPOSED_EAP: 58,
  };
  const distancePenalty = Math.min(44, distanceFeet / 900);
  const stationBonus = hasStation ? 4 : 0;
  return Math.round(Math.max(0, priority[type] + stationBonus - distancePenalty));
}

function confidenceFor(type: CommercialAttachmentType, distanceFeet: number, hasStation: boolean) {
  const typeBase: Record<CommercialAttachmentType, number> = {
    BACKBONE_STATION: 94,
    ROUTE_EDGE: 90,
    POP: 84,
    SPLICE_CASE: 80,
    VAULT: 78,
    HANDHOLE: 76,
    REGEN: 74,
    CUSTOMER_ENTRY: 66,
    PROPOSED_EAP: 55,
  };
  const distancePenalty = Math.min(35, distanceFeet / 1100);
  const stationBonus = hasStation ? 5 : 0;
  return Math.round(Math.max(10, Math.min(99, typeBase[type] + stationBonus - distancePenalty)));
}

function buildCandidate(args: {
  accountId: string;
  routeId: string;
  routeName: string;
  coordinate: DALCoordinate;
  distanceFeet: number;
  attachmentType: CommercialAttachmentType;
  stationId?: string;
  stationMeasureFeet?: number;
  reasons: string[];
  warnings?: string[];
}): AttachmentCandidate {
  const roundedFeet = Math.round(args.distanceFeet);
  const hasStation = Boolean(args.stationId);
  const id = safeId(`${args.accountId}-${args.routeId}-${args.stationId ?? args.attachmentType}-${args.coordinate[0].toFixed(5)}-${args.coordinate[1].toFixed(5)}`);
  return {
    id,
    accountId: args.accountId,
    routeId: args.routeId,
    routeName: args.routeName,
    stationId: args.stationId,
    stationMeasureFeet: typeof args.stationMeasureFeet === "number" ? Math.round(args.stationMeasureFeet) : undefined,
    projectedLatitude: Number(args.coordinate[1].toFixed(6)),
    projectedLongitude: Number(args.coordinate[0].toFixed(6)),
    distanceFeet: roundedFeet,
    attachmentType: args.attachmentType,
    confidence: confidenceFor(args.attachmentType, roundedFeet, hasStation),
    score: candidateScore(args.attachmentType, roundedFeet, hasStation),
    reasons: args.reasons,
    warnings: args.warnings ?? [],
  };
}

function objectAttachmentType(object: CustomerTwinObject): CommercialAttachmentType | null {
  if (object.objectType === "POP") return "POP";
  if (object.objectType === "SPLICE_CASE") return "SPLICE_CASE";
  if (object.objectType === "HANDHOLE") return "HANDHOLE";
  if (object.objectType === "VAULT") return "VAULT";
  if (object.objectType === "REGENERATION_SITE") return "REGEN";
  return null;
}

function routeInScope(route: CustomerTwinRoute, selectedLayerIds: Set<string>) {
  if (selectedLayerIds.size && !selectedLayerIds.has(route.layerId)) return false;
  return route.domain === "EXISTING_INVENTORY" && route.routeUse === "ATTACHMENT_CANDIDATE" && route.coordinates.length > 1;
}

export function resolveCommercialAttachment(request: CommercialAttachmentRequest): AttachmentResolution {
  const diagnostics: string[] = [];
  const point: DALCoordinate = [request.longitude, request.latitude];
  if (!request.customerTwinState || request.customerTwinState.accountId !== request.accountId) {
    return {
      candidateLocationId: request.candidateLocationId,
      status: "CUSTOMER_TWIN_MISSING",
      alternatives: [],
      diagnostics: ["Customer Twin is unavailable for the selected account. Commercial Draft routing is blocked."],
    };
  }

  const selectedLayerIds = new Set(request.selectedInventoryLayerIds?.filter(Boolean) ?? []);
  const routableRoutes = request.customerTwinState.routes.filter((route) => routeInScope(route, selectedLayerIds));
  const routableRouteIds = new Set(routableRoutes.map((route) => route.routeId));
  const routableStations = request.customerTwinState.stations.filter((station) => routableRouteIds.has(station.routeId));
  diagnostics.push(`Attachment search inspected ${routableRoutes.length.toLocaleString()} routable Customer Twin routes and ${routableStations.length.toLocaleString()} route stations before objects.`);

  const candidates: AttachmentCandidate[] = [];

  routableStations.forEach((station) => {
    candidates.push(buildCandidate({
      accountId: request.accountId,
      routeId: station.routeId,
      routeName: station.routeName,
      coordinate: station.coordinate,
      distanceFeet: haversineFeet(point, station.coordinate),
      attachmentType: "BACKBONE_STATION",
      stationId: station.stationId,
      stationMeasureFeet: station.cumulativeFeet,
      reasons: [
        "Customer Twin route station is the preferred commercial attachment target.",
        "Station belongs to a route marked as an attachment candidate.",
      ],
    }));
  });

  routableRoutes.forEach((route) => {
    const projected = nearestPointOnRoute(point, route);
    if (!projected) return;
    const nearestStation = nearestStationForRoute(routableStations, route.routeId, projected.coordinate);
    candidates.push(buildCandidate({
      accountId: request.accountId,
      routeId: route.routeId,
      routeName: route.routeName,
      coordinate: projected.coordinate,
      distanceFeet: projected.distanceFeet,
      attachmentType: "ROUTE_EDGE",
      stationId: nearestStation?.stationId,
      stationMeasureFeet: projected.measureFeet,
      reasons: [
        "Candidate projected onto a routable Customer Twin route edge.",
        nearestStation ? "Nearest station resolved for station-based commercial traceability." : "Route has no station record in the active Customer Twin slice.",
      ],
      warnings: nearestStation ? [] : ["Projected route edge has no station association in the active Twin state."],
    }));
  });

  request.customerTwinState.objects.forEach((object) => {
    if (selectedLayerIds.size && !selectedLayerIds.has(object.layerId)) return;
    const attachmentType = objectAttachmentType(object);
    if (!attachmentType) return;
    const routeId = object.nearestRouteId;
    if (!routeId || !routableRouteIds.has(routeId)) return;
    const route = routableRoutes.find((candidate) => candidate.routeId === routeId);
    const station = object.nearestStationId
      ? routableStations.find((candidate) => candidate.stationId === object.nearestStationId)
      : nearestStationForRoute(routableStations, routeId, object.coordinate);
    candidates.push(buildCandidate({
      accountId: request.accountId,
      routeId,
      routeName: route?.routeName ?? object.name,
      coordinate: object.coordinate,
      distanceFeet: haversineFeet(point, object.coordinate),
      attachmentType,
      stationId: station?.stationId,
      stationMeasureFeet: station?.cumulativeFeet,
      reasons: [
        `${object.objectType.replaceAll("_", " ")} is tied to a routable Customer Twin route.`,
        "Object attachments are considered only after station and route-edge candidates.",
      ],
      warnings: station ? [] : ["Object has route association but no resolved station; engineering review required before authority."],
    }));
  });

  if (!candidates.length) {
    const proposedRoutes = request.customerTwinState.routes.filter((route) => route.domain === "CUSTOMER_PROPOSED" && route.coordinates.length > 1);
    proposedRoutes.forEach((route) => {
      const projected = nearestPointOnRoute(point, route);
      if (!projected) return;
      candidates.push(buildCandidate({
        accountId: request.accountId,
        routeId: route.routeId,
        routeName: route.routeName,
        coordinate: projected.coordinate,
        distanceFeet: projected.distanceFeet,
        attachmentType: "PROPOSED_EAP",
        stationMeasureFeet: projected.measureFeet,
        reasons: ["No routable existing attachment was found; proposed EAP is surfaced for review only."],
        warnings: ["Proposed EAP is not a routable existing attachment and cannot create a Commercial Draft without operator review."],
      }));
    });
  }

  const alternatives = candidates
    .filter((candidate, index, list) => index === list.findIndex((item) => item.id === candidate.id))
    .sort((a, b) => b.score - a.score || a.distanceFeet - b.distanceFeet)
    .slice(0, 8);
  const recommendedAttachment = alternatives.find((candidate) => candidate.attachmentType !== "PROPOSED_EAP") ?? alternatives[0];

  if (!recommendedAttachment) {
    return {
      candidateLocationId: request.candidateLocationId,
      status: "NO_ROUTABLE_ATTACHMENT",
      alternatives: [],
      diagnostics: [...diagnostics, "No station, route edge, or route-associated object could be used as a routable attachment."],
    };
  }

  return {
    candidateLocationId: request.candidateLocationId,
    recommendedAttachment,
    alternatives,
    status: recommendedAttachment.attachmentType === "PROPOSED_EAP" ? "NO_ROUTABLE_ATTACHMENT" : "READY",
    diagnostics,
  };
}
