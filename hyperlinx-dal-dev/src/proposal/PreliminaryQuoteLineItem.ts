export type PreliminaryQuoteLineItemCategory =
  | "ENGINEERING"
  | "PERMITTING"
  | "DIRECTIONAL_DRILLING"
  | "OPEN_CUT"
  | "PLOWING"
  | "VAULTS"
  | "FIBER"
  | "DUCT"
  | "SPLICING"
  | "TESTING"
  | "TRAFFIC_CONTROL"
  | "CONTINGENCY";

export interface PreliminaryQuoteLineItem {
  lineItemId: string;
  category: PreliminaryQuoteLineItemCategory;
  description: string;
  quantity: number;
  unit: "EACH" | "FOOT" | "MILE" | "MONTH" | "ALLOWANCE";
  unitCost: number;
  estimatedNrc: number;
  estimatedMrc: number;
  readOnly: true;
}
