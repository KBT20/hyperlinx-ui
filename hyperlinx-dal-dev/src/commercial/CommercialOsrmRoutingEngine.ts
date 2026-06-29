import { routeInventoryExtensionViaOsrm } from "../routing/OsrmLateralRouter";
import type { DALCoordinate } from "../types/dal";

export interface CommercialRouteRequest {
  accountId: string;
  from: {
    latitude: number;
    longitude: number;
    source: "ATTACHMENT_POINT" | "A_LOCATION";
    label: string;
    attachmentCandidateId?: string;
  };
  to: {
    latitude: number;
    longitude: number;
    source: "CANDIDATE_SITE" | "Z_LOCATION";
    label: string;
  };
  waypoints?: Array<{
    latitude: number;
    longitude: number;
    label: string;
  }>;
  mode: "LATERAL" | "AZ_CORRIDOR" | "EXTEND_EXISTING" | "INDEPENDENT_GRAPH";
}

export interface CommercialRouteResult {
  status: "ROUTED" | "FAILED";
  routeId?: string;
  geometry?: Array<{ latitude: number; longitude: number }>;
  routeMiles?: number;
  osrmDistanceMeters?: number;
  osrmDurationSeconds?: number;
  source: "OSRM";
  failureReason?: string;
  diagnostics: string[];
}

function validLatLng(latitude: number, longitude: number) {
  return Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
}

function toDalCoordinate(point: { latitude: number; longitude: number }): DALCoordinate {
  return [point.longitude, point.latitude];
}

function commercialRouteId(request: CommercialRouteRequest) {
  const from = `${request.from.longitude.toFixed(5)}-${request.from.latitude.toFixed(5)}`;
  const to = `${request.to.longitude.toFixed(5)}-${request.to.latitude.toFixed(5)}`;
  const waypointToken = (request.waypoints ?? [])
    .map((waypoint) => `${waypoint.longitude.toFixed(5)}-${waypoint.latitude.toFixed(5)}`)
    .join("-");
  return `COMMERCIAL-OSRM-${request.accountId}-${request.mode}-${from}-${waypointToken}-${to}`.replace(/[^a-zA-Z0-9-]+/g, "-");
}

function failed(failureReason: string, diagnostics: string[]): CommercialRouteResult {
  return {
    status: "FAILED",
    source: "OSRM",
    failureReason,
    diagnostics,
  };
}

export async function routeCommercialCorridorWithOsrm(request: CommercialRouteRequest): Promise<CommercialRouteResult> {
  if (!validLatLng(request.from.latitude, request.from.longitude)) {
    return failed("INVALID_FROM_COORDINATE", ["OSRM route was not requested because the source coordinate is invalid."]);
  }
  if (!validLatLng(request.to.latitude, request.to.longitude)) {
    return failed("INVALID_TO_COORDINATE", ["OSRM route was not requested because the destination coordinate is invalid."]);
  }
  const invalidWaypoint = (request.waypoints ?? []).find((waypoint) => !validLatLng(waypoint.latitude, waypoint.longitude));
  if (invalidWaypoint) {
    return failed("INVALID_WAYPOINT_COORDINATE", [`OSRM route was not requested because waypoint ${invalidWaypoint.label} is invalid.`]);
  }

  const orderedPoints = [
    request.from,
    ...(request.waypoints ?? []).map((waypoint) => ({ ...waypoint, source: "A_LOCATION" as const })),
    request.to,
  ];
  const geometry: DALCoordinate[] = [];
  let routeFeet = 0;
  const diagnostics: string[] = [];
  for (let index = 1; index < orderedPoints.length; index += 1) {
    const from = orderedPoints[index - 1];
    const to = orderedPoints[index];
    const osrmRoute = await routeInventoryExtensionViaOsrm({
      attachmentCoordinate: toDalCoordinate(from),
      candidateCoordinate: toDalCoordinate(to),
      attachmentId: request.from.attachmentCandidateId ?? `${commercialRouteId(request)}-LEG-${index}`,
    });

    if (osrmRoute.routeStatus !== "VALID" || osrmRoute.geometry.length < 2) {
      return failed(osrmRoute.failureReason ?? "OSRM_ROUTE_NOT_FOUND", [
        "OSRM did not return a valid routed corridor. No straight-line fallback geometry was generated.",
        `Mode: ${request.mode}. From ${from.label}. To ${to.label}. Leg ${index} of ${orderedPoints.length - 1}.`,
        ...(osrmRoute.audit.failureReason ? [`OSRM failure: ${osrmRoute.audit.failureReason}.`] : []),
      ]);
    }

    osrmRoute.geometry.forEach((coordinate) => {
      const last = geometry.at(-1);
      if (last && Math.abs(last[0] - coordinate[0]) < 0.000001 && Math.abs(last[1] - coordinate[1]) < 0.000001) return;
      geometry.push(coordinate);
    });
    routeFeet += osrmRoute.routeFeet;
    diagnostics.push(`Leg ${index}: OSRM returned ${osrmRoute.geometry.length.toLocaleString()} vertices.`);
  }

  if (geometry.length < 2) {
    return failed("OSRM_ROUTE_NOT_FOUND", [
      "OSRM did not return enough routed geometry. No straight-line fallback geometry was generated.",
      `Mode: ${request.mode}. From ${request.from.label}. To ${request.to.label}.`,
    ]);
  }

  return {
    status: "ROUTED",
    routeId: commercialRouteId(request),
    geometry: geometry.map((coordinate) => ({
      latitude: Number(coordinate[1].toFixed(6)),
      longitude: Number(coordinate[0].toFixed(6)),
    })),
    routeMiles: Number((routeFeet / 5280).toFixed(3)),
    osrmDistanceMeters: Math.round(routeFeet / 3.28084),
    source: "OSRM",
    diagnostics: [
      "OSRM returned routed geometry through the existing DAL OSRM integration.",
      `Waypoint count: ${(request.waypoints ?? []).length.toLocaleString()}.`,
      `Rendered vertices: ${geometry.length.toLocaleString()}.`,
      "Straight-line fallback used: FALSE.",
      ...diagnostics,
    ],
  };
}
