import type { GoogleRfpCoordinateStatus } from "../rfp/GoogleRfpRouteRequirement";

export type OsrmConnectivityStatus = "OSRM_READY" | "OSRM_UNAVAILABLE";
export type OsrmRouteSnapStatus = "ROUTE_SNAPPED" | "ROUTE_BLOCKED" | "COORDINATES_UNVERIFIED";
export type OsrmRouteSource = "OSRM_EXISTING_DAL" | "NON_OSRM_BLOCKED";
export type OsrmRouteMileageSource = "OSRM_SNAPPED_CENTERLINE" | "UNAVAILABLE";
export type OsrmRouteQuoteSource = "CORRIDOR_TAKEOFF" | "BLOCKED";
export type OsrmRouteTakeoffSource = "STATIONED_CORRIDOR_TAKEOFF" | "BLOCKED";

export interface OsrmRouteVerification {
  verificationId: string;
  routeRequirementId: string;
  osrmStatus: OsrmConnectivityStatus;
  osrmEndpoint: string;
  lastRouteRequest: string;
  routeSnapStatus: OsrmRouteSnapStatus;
  mileageSource: OsrmRouteMileageSource;
  source: OsrmRouteSource;
  aSiteCoordinateStatus: GoogleRfpCoordinateStatus;
  zSiteCoordinateStatus: GoogleRfpCoordinateStatus;
  coordinateSource: string;
  centerlineRouteId?: string;
  totalFeet: number;
  totalMiles: number;
  geometryCoordinateCount: number;
  stationedCorridorId?: string;
  takeoffId?: string;
  civilMixEstimateId?: string;
  quotePreviewId?: string;
  takeoffSource: OsrmRouteTakeoffSource;
  quoteSource: OsrmRouteQuoteSource;
  blockers: string[];
  generatedAt: string;
  salesEstimateOnly: true;
  engineeringCertified: false;
}

export function coordinatesAreVerified(status: GoogleRfpCoordinateStatus) {
  return status === "VERIFIED_FROM_RFP" || status === "VERIFIED_FROM_KMZ";
}

export function routeVerificationIsQuoteReady(verification: OsrmRouteVerification | undefined) {
  return Boolean(
    verification &&
      verification.blockers.length === 0 &&
      verification.osrmStatus === "OSRM_READY" &&
      verification.routeSnapStatus === "ROUTE_SNAPPED" &&
      verification.source === "OSRM_EXISTING_DAL" &&
      verification.centerlineRouteId &&
      verification.stationedCorridorId &&
      verification.takeoffId &&
      verification.civilMixEstimateId &&
      verification.quotePreviewId,
  );
}
