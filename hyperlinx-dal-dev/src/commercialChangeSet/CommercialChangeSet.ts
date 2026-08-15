export type CommercialPatchType =
  | "CHANGE_PLOW_PERCENT"
  | "CHANGE_BORE_PERCENT"
  | "CHANGE_ROCK_PERCENT"
  | "CHANGE_TRENCH_PERCENT"
  | "CHANGE_AERIAL_PERCENT"
  | "CHANGE_PLOW_RATE"
  | "CHANGE_BORE_RATE"
  | "CHANGE_LABOR_RATE"
  | "CHANGE_MATERIAL_RATE"
  | "CHANGE_EQUIPMENT_RATE"
  | "CHANGE_MARKUP"
  | "CHANGE_CONTINGENCY"
  | "MOVE_ILA"
  | "REMOVE_ILA"
  | "RESTORE_ILA"
  | "CHANGE_MAX_SPAN"
  | "CHANGE_OPTICAL_LOSS"
  | "CHANGE_REGEN_SPACING"
  | "CHANGE_STATION_SPACING"
  | "REMOVE_BOOKEND"
  | "RESTORE_BOOKEND"
  | "ADD_UNKNOWN"
  | "RESOLVE_UNKNOWN"
  | "ADD_RISK"
  | "RESOLVE_RISK"
  | "ADD_EXCEPTION"
  | "RESOLVE_EXCEPTION"
  | "MOVE_ALIGNMENT"
  | "CHANGE_CONSTRUCTION_METHOD"
  | "CHANGE_SEGMENT_TYPE"
  | "CHANGE_MONTHLY_REVENUE"
  | "CHANGE_MARGIN_ASSUMPTION";

export type CommercialPatchValidationState = "PENDING" | "VALID" | "WARNING" | "INVALID";

export type CommercialPatchValue = string | number | boolean | null | Record<string, unknown> | CommercialPatchValue[];

export type CommercialPatch = {
  patchId: string;
  revisionId: string;
  patchType: CommercialPatchType;
  targetObjectId: string;
  targetProperty: string;
  oldValue: CommercialPatchValue;
  newValue: CommercialPatchValue;
  createdBy: string;
  createdAt: string;
  reason: string;
  authority: "COMMERCIAL_CHANGE_SET";
  validationState: CommercialPatchValidationState;
};

export type CommercialChangeSetStatus = "ACTIVE" | "APPLIED" | "DISCARDED" | "INACTIVE";

export type CommercialChangeSet = {
  changeSetId: string;
  revisionId: string;
  opportunityId?: string;
  repositoryId?: string;
  proposalId?: string;
  routeRepositoryId?: string;
  estimateId?: string;
  workbookId?: string;
  revisionNumber: number;
  repositoryHash: string;
  revisionHash: string;
  projectionHash: string;
  status: CommercialChangeSetStatus;
  patchCount: number;
  activePatchCount: number;
  appliedPatchCount: number;
  patches: CommercialPatch[];
  createdBy: string;
  createdById?: string;
  createdAt: string;
  updatedAt: string;
  authority: "COMMERCIAL_CHANGE_SET";
  repositoryType: "COMMERCIAL_CHANGE_SET";
  additive: true;
  patchSetOnly: true;
  repositoryTruthImmutable: true;
  noScopeVersionCreation: true;
  noPricingMutation: true;
  noProposalOutputMutation: true;
  noEngineeringAuthorityMutation: true;
};

export type CommercialRevisionReference = {
  commercialRevisionId?: string;
  revisionId?: string;
  opportunityId?: string;
  repositoryId?: string;
  routeRepositoryId?: string;
  estimateId?: string;
  workbookId?: string;
  commercialWorkbookId?: string;
  proposalId?: string;
  revisionHash?: string;
  [key: string]: unknown;
};

export type CommercialRevisionProjectionState = {
  constructionPercentages: Record<string, CommercialPatchValue>;
  rates: Record<string, CommercialPatchValue>;
  engineeringAssumptions: Record<string, CommercialPatchValue>;
  risk: {
    unknowns: CommercialPatch[];
    risks: CommercialPatch[];
    exceptions: CommercialPatch[];
  };
  route: {
    alignmentMoves: CommercialPatch[];
    constructionMethods: Record<string, CommercialPatchValue>;
    segmentTypes: Record<string, CommercialPatchValue>;
  };
  commercialImpacts: {
    costs: CommercialPatch[];
    revenue: CommercialPatch[];
    proposal: CommercialPatch[];
    engineering: CommercialPatch[];
  };
};

export type CommercialRevisionProjectionDiagnostics = {
  repositoryHash: string;
  revisionHash: string;
  activePatchCount: number;
  appliedPatchCount: number;
  patchReplayTimeMs: number;
  projectionTimeMs: number;
  warnings: string[];
};

export type CommercialRevisionProjection = {
  projectionId: string;
  revisionId: string;
  repositoryId: string;
  opportunityId?: string;
  proposalId?: string;
  sourceAuthority: "COMMERCIAL_REPOSITORY";
  revisionAuthority: "COMMERCIAL_REVISION";
  patchAuthority: "COMMERCIAL_CHANGE_SET";
  changeSetIds: string[];
  patches: CommercialPatch[];
  projectionState: CommercialRevisionProjectionState;
  diagnostics: CommercialRevisionProjectionDiagnostics;
  workbookConsumesCommercialRevision: true;
  estimateConsumesCommercialRevision: true;
  proposalConsumesCommercialRevision: true;
  commercialReleasePackageConsumesCommercialRevision: true;
  draftIofConsumesCommercialRevision: true;
  repositoryTruthImmutable: true;
  noRepositoryMutation: true;
  noPricingFormulaMutation: true;
  noProposalOutputMutation: true;
  noScopeVersionCreation: true;
};

export type CommercialRevisionHistory = {
  revisionId: string;
  revisionNumber: number;
  revisionHash: string;
  patchCount: number;
  timestamp: string;
  author: string;
  changeSetIds: string[];
};

export type CommercialPatchReplay = {
  replayId: string;
  revisionId: string;
  repositoryHash: string;
  revisionHash: string;
  patchCount: number;
  activePatchCount: number;
  appliedPatchCount: number;
  patchReplayTimeMs: number;
  projectionTimeMs: number;
  warnings: string[];
  projection: CommercialRevisionProjection;
};

export type CommercialRevisionComparison = {
  comparisonId: string;
  fromRevisionHash: string;
  toRevisionHash: string;
  differences: Array<{
    category: "construction percentages" | "rates" | "assumptions" | "costs" | "revenue" | "proposal impact" | "engineering impact";
    targetProperty: string;
    fromValue: CommercialPatchValue;
    toValue: CommercialPatchValue;
  }>;
  rawJsonCompared: false;
  comparedPatchResults: true;
};

export type CreateCommercialPatchInput = Omit<CommercialPatch, "patchId" | "createdAt" | "authority" | "validationState"> & {
  patchId?: string;
  createdAt?: string;
  validationState?: CommercialPatchValidationState;
};
