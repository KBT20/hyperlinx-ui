export type QuoteReadiness = "NOT_READY" | "READY_FOR_CUSTOMER" | "BLOCKED" | "CUSTOMER_ACCEPTED" | "CUSTOMER_DECLINED";

export type QuoteConfidence = "LOW" | "MEDIUM" | "HIGH";

export interface QuoteReadinessBlocker {
  blockerId: string;
  blockerType:
    | "MISSING_PROPOSED_INVENTORY"
    | "MISSING_CUSTOMER"
    | "MISSING_OPPORTUNITY"
    | "MISSING_PRODUCT"
    | "MISSING_ESTIMATES"
    | "CUSTOMER_DECISION_REQUIRED";
  message: string;
  requiredAction: string;
}

export interface QuoteReadinessDiagnostic {
  diagnosticId: string;
  code:
    | "PROPOSED_INVENTORY_CREATED"
    | "PRELIMINARY_QUOTE_CREATED"
    | "QUOTE_READY_FOR_CUSTOMER"
    | "QUOTE_BLOCKED"
    | "CUSTOMER_ACCEPTED"
    | "CUSTOMER_DECLINED"
    | "ENGINEERING_HANDOFF_ELIGIBLE";
  severity: "INFO" | "WARNING" | "ERROR";
  message: string;
  timestamp: string;
  details?: Record<string, unknown>;
}
