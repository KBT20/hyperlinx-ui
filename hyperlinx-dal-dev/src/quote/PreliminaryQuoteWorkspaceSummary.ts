import type { PreliminaryQuoteConfidence } from "./PreliminaryQuoteConfidence";

export type QuoteReadiness =
  | "NOT_READY"
  | "READY_FOR_QUOTE"
  | "QUOTE_GENERATED"
  | "BLOCKED";

export type PreliminaryQuoteProduct =
  | "DARK_FIBER"
  | "WAVELENGTH"
  | "ETHERNET"
  | "AI_INTERCONNECT"
  | "DATA_CENTER_INTERCONNECT"
  | "GPU_FACILITY"
  | "POWER_INFRASTRUCTURE"
  | "MIDDLE_MILE"
  | "LONG_HAUL"
  | "METRO_ACCESS"
  | "MANAGED_INFRASTRUCTURE";

export interface PreliminaryQuoteWorkspaceSummary {
  customerName: string;
  opportunityName: string;
  opportunityId: string;
  networkType: string;
  protectionSchema: string;
  referenceArchitecture: string;
  readiness: QuoteReadiness;
  recommendedProducts: PreliminaryQuoteProduct[];
  estimatedNrc: number;
  estimatedMrc: number;
  estimatedTermMonths: number;
  estimatedTcv: number;
  confidence: PreliminaryQuoteConfidence;
  nextAction: "RESOLVE_BLOCKERS" | "READY_FOR_CUSTOMER_DISCUSSION" | "ENGINEERING_VALIDATION";
}
