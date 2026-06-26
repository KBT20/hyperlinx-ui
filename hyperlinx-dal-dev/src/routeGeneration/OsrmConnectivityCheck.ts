import type { OsrmConnectivityStatus } from "./OsrmRouteVerification";

export const OSRM_PUBLIC_ENDPOINT = "https://router.project-osrm.org";

export interface OsrmConnectivityCheck {
  endpoint: string;
  status: OsrmConnectivityStatus;
  lastCheckedAt: string;
  diagnostic: string;
}

export function createOsrmConnectivityCheck(status: OsrmConnectivityStatus, diagnostic: string, endpoint = OSRM_PUBLIC_ENDPOINT): OsrmConnectivityCheck {
  return {
    endpoint,
    status,
    diagnostic,
    lastCheckedAt: new Date().toISOString(),
  };
}
