import type { Customer, CustomerRelationshipStatus, CustomerType } from "./CustomerContract";
import type { OpportunityLaunchSummary, OpportunityLaunchStatus } from "./OpportunityLaunch";
import type { NetworkType } from "../translate/NetworkIntent";
import type { ProtectionSchemaType } from "../translate/ProtectionSchema";
import type { OpportunityAttachment } from "../opportunity/OpportunityAttachment";
import type { OpportunityLocation } from "../opportunity/OpportunityRequest";
import type { RequestedProduct } from "../opportunity/OpportunityObjective";

export type CustomerOpportunityStage =
  | "DRAFT"
  | "READY_FOR_TRANSLATE"
  | "TRANSLATE"
  | "SCOPE_REVIEW"
  | "PRISM"
  | "MARKETPLACE"
  | "CONTRACTED"
  | "OPERATIONAL"
  | "BLOCKED";

export interface CustomerSummary {
  customerId: string;
  customerName: string;
  customerType: CustomerType;
  accountOwner: string;
  relationshipStatus: CustomerRelationshipStatus;
}

export interface CustomerOpportunitySummary {
  opportunityId: string;
  opportunityName: string;
  networkType?: NetworkType;
  protectionSchema?: ProtectionSchemaType;
  stage: CustomerOpportunityStage;
  status: OpportunityLaunchStatus | string;
  requestedProducts: RequestedProduct[];
  locations: OpportunityLocation[];
  attachments: OpportunityAttachment[];
  readiness: "READY_TO_LAUNCH" | "BLOCKED" | "IN_PROGRESS" | "COMPLETE";
  nextAction:
    | "SELECT_NETWORK_TYPE"
    | "SELECT_PROTECTION_SCHEMA"
    | "ADD_LOCATION"
    | "RESOLVE_BLOCKERS"
    | "LAUNCH_TRANSLATE"
    | "CONTINUE_TRANSLATE"
    | "CONTINUE_SCOPE_REVIEW"
    | "CONTINUE_PRISM"
    | "CONTINUE_MARKETPLACE"
    | "VIEW_EXECUTION"
    | "VIEW_OPERATIONS";
  lastUpdated: string;
  launchSummary?: OpportunityLaunchSummary;
}

export interface CustomerWorkspace {
  workspaceId: "CUSTOMER_WORKSPACE";
  customer: CustomerSummary;
  opportunities: CustomerOpportunitySummary[];
  activeOpportunities: number;
  blockedOpportunities: number;
  readyForTranslateOpportunities: number;
  inReviewOpportunities: number;
  inPrismOpportunities: number;
  inMarketplaceOpportunities: number;
  contractedOpportunities: number;
  operationalOpportunities: number;
  noPersistence: true;
  noProductionUiWiring: true;
}

export function createCustomerSummary(customer: Customer): CustomerSummary {
  return {
    customerId: customer.customerId,
    customerName: customer.customerName,
    customerType: customer.customerType,
    accountOwner: customer.accountOwner,
    relationshipStatus: customer.relationshipStatus,
  };
}
