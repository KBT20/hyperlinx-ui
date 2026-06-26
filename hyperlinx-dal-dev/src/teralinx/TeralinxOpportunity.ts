export type TeralinxCustomerMode = "EXISTING_CUSTOMER" | "NEW_CUSTOMER";

export interface TeralinxCustomer {
  customerMode: TeralinxCustomerMode;
  existingCustomerId?: string;
  company: string;
  primaryContact: string;
  market: string;
  notes?: string;
}

export interface TeralinxOpportunity {
  opportunityName: string;
  customer: string;
  market: string;
  targetCompletion?: string;
  internalOwner: string;
  salesOwner: string;
}
