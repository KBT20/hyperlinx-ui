import type { DesignLaunchSession } from "../design/DesignLaunchSession";
import type { DALCoordinate } from "../types/dal";

export type CenterlineRouteSource = "OSRM_EXISTING_DAL" | "STATIC_FIXTURE";
export type CenterlineRouteStatus = "CENTERLINE_ROUTE_VERIFIED" | "CENTERLINE_ROUTE_BLOCKED" | "CENTERLINE_ROUTE_ESTIMATED_FIXTURE";
export type CenterlineRouteConfidence = "LOW" | "MEDIUM" | "HIGH";

export interface CenterlineRouteDiagnostic {
  diagnosticId: string;
  code:
    | "CENTERLINE_ROUTE_REQUESTED"
    | "CENTERLINE_ROUTE_VERIFIED"
    | "CENTERLINE_ROUTE_BLOCKED"
    | "CENTERLINE_ROUTE_FIXTURE_CREATED"
    | "OSRM_ROUTE_NOT_FOUND";
  severity: "INFO" | "WARNING" | "ERROR";
  message: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

export interface CenterlineRouteSite {
  siteId: string;
  role: DesignLaunchSession["siteList"][number]["role"];
  facilityName: string;
  address?: string;
  coordinate?: DALCoordinate;
}

export interface CenterlineRoute {
  centerlineRouteId: string;
  routeRequestId: string;
  designDoctrineId: string;
  source: CenterlineRouteSource;
  status: CenterlineRouteStatus;
  aSite: CenterlineRouteSite;
  zSite: CenterlineRouteSite;
  intermediateSites: CenterlineRouteSite[];
  geometry: DALCoordinate[];
  totalFeet: number;
  totalMiles: number;
  confidence: CenterlineRouteConfidence;
  diagnostics: CenterlineRouteDiagnostic[];
  noEngineeringCertification: true;
  salesEstimateOnly: true;
}
