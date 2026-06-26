import type { GoogleRfpRouteRequirement } from "./GoogleRfpRouteRequirement";

export type GoogleRfpStatus = "INTAKE" | "ROUTES_REQUIRED" | "BUDGETARY_IN_PROGRESS" | "READY_FOR_REVIEW" | "BLOCKED";

export interface GoogleRfpContact {
  contactId: string;
  name: string;
  role: string;
  email?: string;
}

export interface GoogleRfpRequiredAttachment {
  attachmentId: string;
  attachmentType: "VENDOR_PROPOSED_KMZ" | "VENDOR_RESPONSE_WORKBOOK" | "BUDGETARY_QUOTE" | "QUOTE_EMAIL";
  label: string;
  status: "NOT_STARTED" | "STAGED" | "READY" | "BLOCKED";
}

export interface GoogleRfpOpportunity {
  rfpId: string;
  customerId: string;
  customerName: string;
  opportunityId: string;
  opportunityName: string;
  issueDate: string;
  kmzDeadline: string;
  budgetaryDeadline: string;
  requestedRoutes: GoogleRfpRouteRequirement[];
  requiredAttachments: GoogleRfpRequiredAttachment[];
  responseContacts: GoogleRfpContact[];
  submissionInstructions: string[];
  status: GoogleRfpStatus;
  reusableWorkflow: true;
}
