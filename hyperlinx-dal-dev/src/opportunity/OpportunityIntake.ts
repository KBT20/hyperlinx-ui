import type { OpportunityAttachment } from "./OpportunityAttachment";
import type { OpportunityObjective } from "./OpportunityObjective";
import type { OpportunityLocation, OpportunityRequest, OpportunityStatus } from "./OpportunityRequest";

export interface OpportunityIntake {
  intakeId: string;
  request: OpportunityRequest;
  status: OpportunityStatus;
  intakeOwner: string;
  createdAt: string;
  updatedAt: string;
}

export interface OpportunityIntakeWorkspaceModel {
  workspaceId: "OPPORTUNITY_INTAKE";
  title: string;
  supportedCustomerTypes: string[];
  supportedAttachmentTypes: string[];
  supportedObjectives: string[];
  noPersistence: true;
  noScopeVersionCreation: true;
  noCorridorCreation: true;
}

export interface OpportunitySummaryCardModel {
  customerName: string;
  opportunityName: string;
  customerType: string;
  accountOwner: string;
  status: OpportunityStatus;
}

export interface AttachmentSummaryModel {
  attachmentCount: number;
  attachmentTypes: string[];
  attachments: OpportunityAttachment[];
}

export interface OpportunityReadinessCardModel {
  locationCount: number;
  objectiveCount: number;
  attachmentCount: number;
  blockers: string[];
}

export interface TranslateReadinessCardModel {
  status: "READY_FOR_TRANSLATE" | "BLOCKED";
  reason: string;
  nextWorkspace: "Translate";
}

export interface OpportunityIntakeViewModel {
  workspace: OpportunityIntakeWorkspaceModel;
  summaryCard: OpportunitySummaryCardModel;
  attachmentSummary: AttachmentSummaryModel;
  readinessCard: OpportunityReadinessCardModel;
  translateReadinessCard: TranslateReadinessCardModel;
  locations: OpportunityLocation[];
  objectives: OpportunityObjective[];
}
