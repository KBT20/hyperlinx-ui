import type { TeralinxDesignIntent } from "./TeralinxDesignIntent";
import type { TeralinxCustomer, TeralinxOpportunity } from "./TeralinxOpportunity";
import type { TeralinxRouteBlocker, TeralinxRouteDiagnostic, TeralinxRouteReadiness, TeralinxRouteRequest, TeralinxSite } from "./TeralinxRouteRequest";

export interface TeralinxRouteIntakeInput {
  routeRequestId: string;
  customer: TeralinxCustomer;
  opportunity: TeralinxOpportunity;
  siteList: TeralinxSite[];
  intent: TeralinxDesignIntent;
  evaluatedAt?: string;
}

export interface TeralinxRouteIntake {
  intakeId: string;
  title: string;
  input: TeralinxRouteIntakeInput;
  routeRequest: TeralinxRouteRequest;
  readiness: TeralinxRouteReadiness;
  blockers: TeralinxRouteBlocker[];
  diagnostics: TeralinxRouteDiagnostic[];
  noPersistence: true;
  noRouting: true;
  noGeometry: true;
  noScopeVersionCreation: true;
}
