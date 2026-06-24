import type { ReferenceArchitectureId } from "./ArchitectureSelection";
import type { BaselineNetworkCandidate } from "./BaselineNetworkCandidate";
import type { NetworkType } from "./NetworkIntent";
import type { ProtectionSchemaType } from "./ProtectionSchema";
import type { TranslateWorkspaceNextAction } from "./TranslateWorkspaceStatus";

export interface TranslateWorkspaceSummary {
  customerId: string;
  customerName: string;
  opportunityId: string;
  opportunityName: string;
  networkType?: NetworkType;
  protectionSchema?: ProtectionSchemaType;
  referenceArchitecture?: ReferenceArchitectureId | string;
  candidateObjectCount: number;
  candidateFacilityCount: number;
  candidateSegmentCount: number;
  readiness: "READY_FOR_SCOPE_REVIEW" | "BLOCKED";
  nextAction: TranslateWorkspaceNextAction;
  blockers: string[];
}

export interface BaselineSummaryCardModel {
  modelId: "BASELINE_SUMMARY_CARD";
  networkType?: NetworkType;
  protectionSchema?: ProtectionSchemaType;
  referenceArchitecture?: ReferenceArchitectureId | string;
  candidateObjectCount: number;
  candidateFacilityCount: number;
  candidateSegmentCount: number;
  readiness: "READY_FOR_SCOPE_REVIEW" | "BLOCKED";
  blockers: string[];
}

export interface ArchitectureSummaryCardModel {
  modelId: "TRANSLATE_ARCHITECTURE_SUMMARY_CARD";
  referenceArchitecture?: ReferenceArchitectureId | string;
  designStandardCount: number;
  objectCatalogTypeCount: number;
  humanReviewRequired: boolean;
}

export interface TranslateReadinessCardModel {
  modelId: "TRANSLATE_READINESS_CARD";
  readiness: "READY_FOR_SCOPE_REVIEW" | "BLOCKED";
  nextWorkspace?: "Scope Review";
  blockers: string[];
}

export interface TranslateBlockerPanelModel {
  modelId: "TRANSLATE_BLOCKER_PANEL";
  blockerCount: number;
  blockers: string[];
}

export interface TranslateNextActionPanelModel {
  modelId: "TRANSLATE_NEXT_ACTION_PANEL";
  nextAction: TranslateWorkspaceNextAction;
}

export function summarizeBaselineCandidate(candidate?: BaselineNetworkCandidate): Pick<
  BaselineSummaryCardModel,
  "candidateObjectCount" | "candidateFacilityCount" | "candidateSegmentCount" | "referenceArchitecture"
> {
  if (!candidate) {
    return {
      candidateObjectCount: 0,
      candidateFacilityCount: 0,
      candidateSegmentCount: 0,
      referenceArchitecture: undefined,
    };
  }

  const candidateSegmentCount = candidate.candidateObjects.filter((object) => object.objectRole === "SEGMENT").length;
  return {
    candidateObjectCount: candidate.candidateObjects.length,
    candidateFacilityCount: candidate.candidateObjects.length - candidateSegmentCount,
    candidateSegmentCount,
    referenceArchitecture: candidate.referenceArchitecture,
  };
}
