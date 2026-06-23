export type CustomerType =
  | "HYPERSCALER"
  | "NEOCLOUD"
  | "CARRIER"
  | "ISP"
  | "ENTERPRISE"
  | "MUNICIPAL"
  | "UTILITY"
  | "DATA_CENTER"
  | "GOVERNMENT";

export type CustomerSegment =
  | "STRATEGIC"
  | "WHOLESALE"
  | "COMMERCIAL"
  | "PUBLIC_SECTOR"
  | "INFRASTRUCTURE"
  | "AI_EXPANSION"
  | "REGIONAL";

export type CustomerRelationshipStatus =
  | "PROSPECT"
  | "QUALIFIED"
  | "ACTIVE"
  | "STRATEGIC_ACCOUNT"
  | "PAUSED"
  | "INACTIVE";

export interface CustomerContact {
  contactId: string;
  name: string;
  role: string;
  email?: string;
  phone?: string;
  primary: boolean;
  notes?: string;
}

export interface CustomerBillingProfile {
  billingProfileId: string;
  billingName: string;
  billingContactId?: string;
  paymentTerms?: string;
  billingNotes?: string;
}

export interface CustomerLegalProfile {
  legalProfileId: string;
  legalName: string;
  contractEntity?: string;
  taxIdReference?: string;
  legalNotes?: string;
}

export interface CustomerRelationship {
  relationshipId: string;
  customerId: string;
  relationshipStatus: CustomerRelationshipStatus;
  accountOwner: string;
  strategicNotes?: string;
  updatedAt: string;
}

export interface CustomerDiagnostic {
  code:
    | "CUSTOMER_CREATED"
    | "CUSTOMER_RELATIONSHIP_DEFINED"
    | "CUSTOMER_OPPORTUNITY_REQUIRED"
    | "CUSTOMER_TRACEABILITY_WARNING";
  customerId?: string;
  opportunityId?: string;
  severity: "INFO" | "WARNING";
  message: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

export interface Customer {
  customerId: string;
  customerName: string;
  customerType: CustomerType;
  customerSegment: CustomerSegment;
  industry: string;
  accountOwner: string;
  relationshipStatus: CustomerRelationshipStatus;
  contacts: CustomerContact[];
  billingProfile?: CustomerBillingProfile;
  legalProfile?: CustomerLegalProfile;
  relationships: CustomerRelationship[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
