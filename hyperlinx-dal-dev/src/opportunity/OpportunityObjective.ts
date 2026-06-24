export type OpportunityObjectiveType =
  | "AI_CORRIDOR"
  | "HYPERSCALER_EXPANSION"
  | "DATA_CENTER_INTERCONNECT"
  | "DARK_FIBER"
  | "DUAL_DIVERSE_ROUTE"
  | "MIDDLE_MILE"
  | "LONG_HAUL"
  | "METRO_EXPANSION"
  | "ENTERPRISE_ACCESS"
  | "CARRIER_HOTEL"
  | "GPU_INFRASTRUCTURE"
  | "POWER_INFRASTRUCTURE"
  | "WIRELESS_BACKHAUL"
  | "CUSTOM";

export type RequestedProduct =
  | "DUCT"
  | "DARK_FIBER"
  | "MANAGED_FIBER"
  | "WAVE"
  | "ETHERNET"
  | "PRIVATE_NETWORK"
  | "INTERNET"
  | "AI_INTERCONNECT"
  | "GPU_FACILITY"
  | "DATA_CENTER"
  | "POWER_INFRASTRUCTURE"
  | "CARRIER_HOTEL"
  | "CLOUD_ONRAMP"
  | "CUSTOM";

export type RequestedService =
  | "FEASIBILITY"
  | "ROUTE_ANALYSIS"
  | "BUDGETARY_QUOTE"
  | "DIVERSITY_REVIEW"
  | "POWER_REVIEW"
  | "MARKETPLACE_SOURCING"
  | "CUSTOM";

export interface OpportunityObjective {
  objectiveId: string;
  objectiveType: OpportunityObjectiveType;
  description?: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "STRATEGIC";
  requestedProducts: RequestedProduct[];
  requestedServices: RequestedService[];
}
