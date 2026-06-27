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
  return `COMMERCIAL-OSRM-${request.accountId}-${request.mode}-${from}-${to}`.replace(/[^a-zA-Z0-9-]+/g, "-");
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

  const osrmRoute = await routeInventoryExtensionViaOsrm({
    attachmentCoordinate: toDalCoordinate(request.from),
    candidateCoordinate: toDalCoordinate(request.to),
    attachmentId: request.from.attachmentCandidateId,
  });

  if (osrmRoute.routeStatus !== "VALID" || osrmRoute.geometry.length < 2) {
    return failed(osrmRoute.failureReason ?? "OSRM_ROUTE_NOT_FOUND", [
      "OSRM did not return a valid routed corridor. No straight-line fallback geometry was generated.",
      `Mode: ${request.mode}. From ${request.from.label}. To ${request.to.label}.`,
      ...(osrmRoute.audit.failureReason ? [`OSRM failure: ${osrmRoute.audit.failureReason}.`] : []),
    ]);
  }

  return {
    status: "ROUTED",
    routeId: commercialRouteId(request),
    geometry: osrmRoute.geometry.map((coordinate) => ({
      latitude: Number(coordinate[1].toFixed(6)),
      longitude: Number(coordinate[0].toFixed(6)),
    })),
    routeMiles: Number(osrmRoute.routeMiles.toFixed(3)),
    osrmDistanceMeters: Math.round(osrmRoute.routeFeet / 3.28084),
    source: "OSRM",
    diagnostics: [
      "OSRM returned routed geometry through the existing DAL OSRM integration.",
      `Rendered vertices: ${osrmRoute.geometry.length.toLocaleString()}.`,
      `No straight-line fallback was used: ${String(osrmRoute.audit.fallbackUsed).toUpperCase()}.`,
    ],
  };
}
