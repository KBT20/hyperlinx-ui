export type EngineeringPatchType =
  | "MOVE_STATION"
  | "INSERT_STATION"
  | "REMOVE_STATION"
  | "CHANGE_STATION_TYPE"
  | "CHANGE_STATION_INTERVAL"
  | "MOVE_OBJECT"
  | "ADD_OBJECT"
  | "REMOVE_OBJECT"
  | "CHANGE_OBJECT_CLASS"
  | "CHANGE_OBJECT_TYPE"
  | "CHANGE_OBJECT_STATUS"
  | "CHANGE_OBJECT_SIZE"
  | "CHANGE_OBJECT_CONFIGURATION"
  | "ADD_CONSTRAINT"
  | "REMOVE_CONSTRAINT"
  | "RESOLVE_CONSTRAINT"
  | "ADD_EXCEPTION"
  | "RESOLVE_EXCEPTION"
  | "CHANGE_CLEARANCE"
  | "CHANGE_PLACEMENT"
  | "CHANGE_SPLICE"
  | "CHANGE_SPLICE_CASE"
  | "CHANGE_FIBER_ASSIGNMENT"
  | "CHANGE_BUFFER_ASSIGNMENT"
  | "CHANGE_LOSS"
  | "CHANGE_REGEN"
  | "CHANGE_ILA_CONFIGURATION"
  | "ADD_EVIDENCE"
  | "REMOVE_EVIDENCE"
  | "CHANGE_REVIEW_STATUS"
  | "ADD_ENGINEERING_NOTE";

export type EngineeringPatchValidationState = "PENDING" | "VALID" | "WARNING" | "INVALID";

export type EngineeringPatchValue = string | number | boolean | null | Record<string, unknown> | EngineeringPatchValue[];

export type EngineeringPatch = {
  patchId: string;
  revisionId: string;
  patchType: EngineeringPatchType;
  targetObjectId: string;
  targetProperty: string;
  oldValue: EngineeringPatchValue;
  newValue: EngineeringPatchValue;
  createdBy: string;
  createdAt: string;
  reason: string;
  authority: "ENGINEERING_CHANGE_SET";
  validationState: EngineeringPatchValidationState;
};

export type EngineeringChangeSetStatus = "ACTIVE" | "APPLIED" | "DISCARDED" | "INACTIVE";

export type EngineeringChangeSet = {
  changeSetId: string;
  revisionId: string;
  engineeringBaselineId: string;
  engineeringPackageId?: string;
  draftIOFPackageId?: string;
  opportunityId?: string;
  routeRepositoryId?: string;
  proposalId?: string;
  estimateId?: string;
  workbookId?: string;
  revisionNumber: number;
  baselineHash: string;
  revisionHash: string;
  projectionHash: string;
  status: EngineeringChangeSetStatus;
  patchCount: number;
  activePatchCount: number;
  appliedPatchCount: number;
  patches: EngineeringPatch[];
  createdBy: string;
  createdById?: string;
  createdAt: string;
  updatedAt: string;
  authority: "ENGINEERING_CHANGE_SET";
  repositoryType: "ENGINEERING_CHANGE_SET";
  additive: true;
  patchSetOnly: true;
  baselineImmutable: true;
  repositoryTruthImmutable: true;
  noScopeVersionCreation: true;
  noStationProjectionMutation: true;
  noPricingMutation: true;
  noCommercialAuthorityMutation: true;
};

export type EngineeringBaselineReference = {
  engineeringBaselineId?: string;
  engineeringBaselineHash?: string;
  engineeringPackageId?: string;
  engineeringRevisionId?: string;
  draftIOFPackageId?: string;
  draftIofPackageId?: string;
  routeRepositoryId?: string;
  proposalId?: string;
  estimateId?: string;
  workbookId?: string;
  commercialWorkbookId?: string;
  opportunityId?: string;
  stationProjectionId?: string;
  objectManifestId?: string;
  [key: string]: unknown;
};

export type EngineeringRevisionProjectionState = {
  stations: {
    moves: EngineeringPatch[];
    inserted: EngineeringPatch[];
    removed: EngineeringPatch[];
    types: Record<string, EngineeringPatchValue>;
    intervals: Record<string, EngineeringPatchValue>;
  };
  objects: {
    moves: EngineeringPatch[];
    added: EngineeringPatch[];
    removed: EngineeringPatch[];
    classes: Record<string, EngineeringPatchValue>;
    types: Record<string, EngineeringPatchValue>;
    statuses: Record<string, EngineeringPatchValue>;
    sizes: Record<string, EngineeringPatchValue>;
    configurations: Record<string, EngineeringPatchValue>;
  };
  constraints: {
    added: EngineeringPatch[];
    removed: EngineeringPatch[];
    resolved: EngineeringPatch[];
    exceptions: EngineeringPatch[];
    clearances: Record<string, EngineeringPatchValue>;
    placements: Record<string, EngineeringPatchValue>;
  };
  fiber: {
    splices: Record<string, EngineeringPatchValue>;
    spliceCases: Record<string, EngineeringPatchValue>;
    fiberAssignments: Record<string, EngineeringPatchValue>;
    bufferAssignments: Record<string, EngineeringPatchValue>;
    loss: Record<string, EngineeringPatchValue>;
    regen: Record<string, EngineeringPatchValue>;
    ilaConfiguration: Record<string, EngineeringPatchValue>;
  };
  evidence: {
    added: EngineeringPatch[];
    removed: EngineeringPatch[];
    reviewStatus: Record<string, EngineeringPatchValue>;
    notes: EngineeringPatch[];
  };
};

export type EngineeringRevisionProjectionDiagnostics = {
  baselineHash: string;
  revisionHash: string;
  activePatchCount: number;
  appliedPatchCount: number;
  patchReplayTimeMs: number;
  projectionTimeMs: number;
  warnings: string[];
};

export type EngineeringRevisionProjection = {
  projectionId: string;
  revisionId: string;
  engineeringBaselineId: string;
  engineeringPackageId?: string;
  sourceAuthority: "ENGINEERING_BASELINE";
  revisionAuthority: "ENGINEERING_REVISION";
  patchAuthority: "ENGINEERING_CHANGE_SET";
  changeSetIds: string[];
  patches: EngineeringPatch[];
  projectionState: EngineeringRevisionProjectionState;
  diagnostics: EngineeringRevisionProjectionDiagnostics;
  certificationConsumesEngineeringRevision: true;
  certifiedIofPackageConsumesEngineeringRevision: true;
  baselineImmutable: true;
  noBaselineMutation: true;
  noEngineeringPackageMutation: true;
  noStationProjectionMutation: true;
  noPricingMutation: true;
  noCommercialAuthorityMutation: true;
  noScopeVersionCreation: true;
};

export type EngineeringRevisionHistory = {
  revisionId: string;
  revisionNumber: number;
  revisionHash: string;
  patchCount: number;
  timestamp: string;
  author: string;
  changeSetIds: string[];
};

export type EngineeringPatchReplay = {
  replayId: string;
  revisionId: string;
  baselineHash: string;
  revisionHash: string;
  patchCount: number;
  activePatchCount: number;
  appliedPatchCount: number;
  patchReplayTimeMs: number;
  projectionTimeMs: number;
  warnings: string[];
  projection: EngineeringRevisionProjection;
};

export type EngineeringRevisionComparison = {
  comparisonId: string;
  fromRevisionHash: string;
  toRevisionHash: string;
  differences: Array<{
    category: "stationing" | "objects" | "constraints" | "fiber engineering" | "evidence";
    targetProperty: string;
    fromValue: EngineeringPatchValue;
    toValue: EngineeringPatchValue;
  }>;
  rawJsonCompared: false;
  comparedPatchResults: true;
};

export type CreateEngineeringPatchInput = Omit<EngineeringPatch, "patchId" | "createdAt" | "authority" | "validationState"> & {
  patchId?: string;
  createdAt?: string;
  validationState?: EngineeringPatchValidationState;
};
