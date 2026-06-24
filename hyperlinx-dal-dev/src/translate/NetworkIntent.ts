import type { OpportunityCustomerType } from "../opportunity/OpportunityRequest";

export type NetworkType =
  | "METRO"
  | "MIDDLE_MILE"
  | "LONG_HAUL"
  | "AI_CORRIDOR"
  | "DATA_CENTER_INTERCONNECT"
  | "ENTERPRISE_ACCESS"
  | "WIRELESS_BACKHAUL"
  | "CUSTOM";

export interface CustomerContext {
  customerId: string;
  customerName?: string;
  customerType?: OpportunityCustomerType | "UNKNOWN";
}

export interface OpportunityContext {
  opportunityId: string;
  opportunityName?: string;
  opportunityDescription?: string;
}

export interface NetworkIntent {
  intentId: string;
  networkType: NetworkType;
  customerId: string;
  opportunityId: string;
  selectedBy?: string;
  selectedAt: string;
  source: "CUSTOMER_PROVIDED" | "ACCOUNT_TEAM" | "TRANSLATE_INFERRED" | "MANUAL";
  confidence: "LOW" | "MEDIUM" | "HIGH" | "VERIFIED";
  notes?: string;
}

export interface NetworkIntentSelectorModel {
  modelId: "NETWORK_INTENT_SELECTOR";
  supportedNetworkTypes: NetworkType[];
  selectedNetworkType?: NetworkType;
  selectionRequired: true;
  noAuthorityCreated: true;
}

export const SUPPORTED_NETWORK_TYPES: readonly NetworkType[] = Object.freeze([
  "METRO",
  "MIDDLE_MILE",
  "LONG_HAUL",
  "AI_CORRIDOR",
  "DATA_CENTER_INTERCONNECT",
  "ENTERPRISE_ACCESS",
  "WIRELESS_BACKHAUL",
  "CUSTOM",
]);
