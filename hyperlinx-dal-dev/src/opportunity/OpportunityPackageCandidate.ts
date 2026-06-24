import type { OpportunityAttachment } from "./OpportunityAttachment";
import type { OpportunityObjective, RequestedProduct, RequestedService } from "./OpportunityObjective";
import type { OpportunityDiagnostic, OpportunityLocation, OpportunityRequest, OpportunityStatus } from "./OpportunityRequest";

export interface OpportunityTraceabilityPlaceholders {
  customerId: string;
  opportunityId: string;
  futureCorridorId?: string;
  futureScopeVersionId?: string;
}

export interface OpportunityPackageCandidate {
  packageCandidateId: string;
  status: OpportunityStatus;
  customerContext: {
    customerId: string;
    customerName: string;
    customerType: string;
    accountOwner: string;
    businessSponsor?: string;
  };
  opportunityContext: {
    opportunityId: string;
    opportunityName: string;
    requestedDate: string;
    source: string;
    narrative?: string;
  };
  attachments: OpportunityAttachment[];
  locations: OpportunityLocation[];
  objectives: OpportunityObjective[];
  requestedProducts: RequestedProduct[];
  requestedServices: RequestedService[];
  diagnostics: OpportunityDiagnostic[];
  traceability: OpportunityTraceabilityPlaceholders;
}

export interface OpportunityPackageCandidateInput {
  request: OpportunityRequest;
  diagnostics: OpportunityDiagnostic[];
  status: OpportunityStatus;
}
