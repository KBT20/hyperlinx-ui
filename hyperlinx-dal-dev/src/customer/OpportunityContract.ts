import type { CorridorEndpoint, CorridorRequirement } from "../corridor/corridorTypes";
import type { CustomerType } from "./CustomerContract";

export type OpportunityType =
  | "LONG_HAUL"
  | "MIDDLE_MILE"
  | "METRO"
  | "AI_INTERCONNECT"
  | "DARK_FIBER"
  | "DUCT_SALE"
  | "TRANSPORT"
  | "ENTERPRISE_ACCESS"
  | "DATA_CENTER_INTERCONNECT";

export type OpportunityStatus =
  | "DRAFT"
  | "DISCOVERY"
  | "TRANSLATE"
  | "CORRIDOR_ANALYSIS"
  | "PRISM_REVIEW"
  | "ENGINEERING_REVIEW"
  | "MARKETPLACE"
  | "CONTRACT"
  | "CONTROL"
  | "FIELD"
  | "COMPLETE"
  | "CANCELLED";

export type OpportunityRequestedProduct =
  | "DUCT_SALE"
  | "DUCT_MAINTENANCE"
  | "DARK_FIBER_IRU"
  | "MANAGED_FIBER"
  | "ETHERNET_TRANSPORT"
  | "WAVE_SERVICE"
  | "AI_INTERCONNECT"
  | "RESIDUAL_CAPACITY"
  | "ROUTE_OPERATIONS";

export interface OpportunityTraceability {
  customerId: string;
  opportunityId: string;
  corridorIds: string[];
  scopeVersionIds: string[];
  marketplaceBudgetIds: string[];
  contractIds: string[];
  controlWorkPackageIds: string[];
  fieldClosureIds: string[];
}

export interface OpportunityDiagnostic {
  code:
    | "OPPORTUNITY_CREATED"
    | "OPPORTUNITY_CUSTOMER_REQUIRED"
    | "OPPORTUNITY_CORRIDOR_REQUIRED"
    | "SCOPEVERSION_TRACEABILITY_REQUIRED"
    | "OPPORTUNITY_TRACEABILITY_WARNING";
  customerId?: string;
  opportunityId?: string;
  corridorId?: string;
  scopeVersionId?: string;
  severity: "INFO" | "WARNING";
  message: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

export interface Opportunity {
  opportunityId: string;
  customerId: string;
  customerType?: CustomerType;
  opportunityName: string;
  opportunityType: OpportunityType;
  requestedProducts: OpportunityRequestedProduct[];
  requestedEndpoints: CorridorEndpoint[];
  customerRequirements: CorridorRequirement[];
  commercialOwner: string;
  technicalOwner?: string;
  status: OpportunityStatus;
  corridorIds: string[];
  selectedScopeVersionIds: string[];
  traceability: OpportunityTraceability;
  createdAt: string;
  updatedAt: string;
  notes?: string;
}
