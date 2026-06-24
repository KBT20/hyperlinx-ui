import type { OpportunityAttachment } from "./OpportunityAttachment";
import type { OpportunityObjective, RequestedProduct, RequestedService } from "./OpportunityObjective";

export type OpportunityCustomerType =
  | "HYPERSCALER"
  | "NEOCLOUD"
  | "CARRIER"
  | "ISP"
  | "ENTERPRISE"
  | "UTILITY"
  | "DATA_CENTER"
  | "GOVERNMENT"
  | "EDUCATION"
  | "OTHER";

export type OpportunityStatus =
  | "INTAKE"
  | "UNDER_REVIEW"
  | "READY_FOR_TRANSLATE"
  | "BLOCKED"
  | "REJECTED";

export type OpportunitySource =
  | "ACCOUNT_TEAM"
  | "CUSTOMER_RFP"
  | "CUSTOMER_EMAIL"
  | "STRATEGIC_ACCOUNT"
  | "PARTNER"
  | "MANUAL"
  | "OTHER";

export type OpportunityLocationRole =
  | "ORIGIN"
  | "DESTINATION"
  | "INTERMEDIATE"
  | "CANDIDATE"
  | "UNKNOWN";

export interface OpportunityLocation {
  locationId: string;
  role: OpportunityLocationRole;
  siteName?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  region?: string;
  state?: string;
  country?: string;
  locationConfidence: "LOW" | "MEDIUM" | "HIGH" | "VERIFIED";
  metadata?: Record<string, unknown>;
}

export interface OpportunityDiagnostic {
  code:
    | "OPPORTUNITY_CREATED"
    | "OPPORTUNITY_VALIDATED"
    | "OPPORTUNITY_ATTACHMENT_REGISTERED"
    | "OPPORTUNITY_LOCATION_REGISTERED"
    | "OPPORTUNITY_GAP_IDENTIFIED"
    | "READY_FOR_TRANSLATE"
    | "TRANSLATE_BLOCKED";
  severity: "INFO" | "WARNING" | "ERROR" | "CRITICAL";
  customerId?: string;
  opportunityId?: string;
  message: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

export interface OpportunityRequest {
  requestId: string;
  customerId: string;
  customerName: string;
  customerType: OpportunityCustomerType;
  opportunityId: string;
  opportunityName: string;
  accountOwner: string;
  businessSponsor?: string;
  requestedDate: string;
  source: OpportunitySource;
  status: OpportunityStatus;
  objectives: OpportunityObjective[];
  requestedProducts: RequestedProduct[];
  requestedServices: RequestedService[];
  locations: OpportunityLocation[];
  attachments: OpportunityAttachment[];
  narrative?: string;
  createdAt: string;
  updatedAt: string;
}
