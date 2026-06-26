import type { TeralinxDesignIntent, TeralinxPrimaryProduct, TeralinxProtection } from "./TeralinxDesignIntent";
import type { TeralinxCustomer, TeralinxOpportunity } from "./TeralinxOpportunity";

export type TeralinxSiteRole = "A_SITE" | "Z_SITE" | "INTERMEDIATE_SITE";

export interface TeralinxSite {
  siteId: string;
  role: TeralinxSiteRole;
  facilityName: string;
  address?: string;
  latitude?: number;
  longitude?: number;
}

export type TeralinxRouteReadiness = "READY_FOR_DESIGN" | "BLOCKED";

export type TeralinxRouteDiagnosticCode =
  | "ROUTE_INTAKE_CREATED"
  | "CUSTOMER_VALIDATED"
  | "OPPORTUNITY_VALIDATED"
  | "SITE_VALIDATED"
  | "INTENT_VALIDATED"
  | "ROUTE_READY_FOR_DESIGN"
  | "ROUTE_INTAKE_BLOCKED";

export interface TeralinxRouteDiagnostic {
  diagnosticId: string;
  code: TeralinxRouteDiagnosticCode;
  severity: "INFO" | "WARNING" | "ERROR";
  message: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

export interface TeralinxRouteBlocker {
  blockerId: string;
  blockerType:
    | "MISSING_CUSTOMER"
    | "MISSING_OPPORTUNITY"
    | "MISSING_SITE"
    | "INVALID_ADDRESS"
    | "DUPLICATE_SITE"
    | "NO_NETWORK_INTENT";
  message: string;
  requiredAction: string;
}

export interface TeralinxRouteRequest {
  routeRequestId: string;
  customer: TeralinxCustomer;
  opportunity: TeralinxOpportunity;
  siteList: TeralinxSite[];
  intent: TeralinxDesignIntent;
  protection?: TeralinxProtection;
  product?: TeralinxPrimaryProduct;
  diagnostics: TeralinxRouteDiagnostic[];
  blockers: TeralinxRouteBlocker[];
  readiness: TeralinxRouteReadiness;
  estimatedMilesPlaceholder: number;
  fixtureOnly: true;
  noPersistence: true;
  noRouting: true;
  noGeometry: true;
  noScopeVersionCreation: true;
  noInventoryMutation: true;
}
