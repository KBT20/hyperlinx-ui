import { DAL_API } from "../config/dalApi";
import { runtimeDiagnosticsLog } from "../performance/RuntimeDiagnostics";
import { withStoredAuthHeaders } from "./authHeaders";

export type TeralinxUserRole = "ADMINISTRATOR_COO" | "CRO" | "CEO" | "CUSTOMER_PARTICIPANT";

export type TeralinxPermission =
  | "platform.admin"
  | "runtime.deploy"
  | "users.manage"
  | "workspace.translate"
  | "workspace.commercial"
  | "workspace.proposal"
  | "workspace.salesEngineering"
  | "workspace.executiveReview"
  | "workspace.engineering.read"
  | "workspace.engineering.write"
  | "scopeversion.authority"
  | "customerDesign.read"
  | "customerDesign.manage"
  | "opportunity.read"
  | "opportunity.manage"
  | "proposal.read"
  | "proposal.review"
  | "proposal.manage";

export type TeralinxUser = {
  userId: string;
  organizationId: string;
  workspaceId: string;
  username: string;
  name: string;
  title: string;
  role: TeralinxUserRole;
  organization: "Teralinx";
  permissions: TeralinxPermission[];
  preferences: Record<string, unknown>;
  dashboard: {
    sections: string[];
    executiveOverview?: boolean;
    organizationPipeline?: boolean;
    revenue?: boolean;
    operationalIntelligence?: boolean;
  };
  assignments: string[];
  notifications: string[];
  pinnedObjects: string[];
  workspace: TeralinxWorkspace;
};

export type TeralinxWorkspace = {
  workspaceId: string;
  userId: string;
  organizationId: string;
  name: string;
  preferences: Record<string, unknown>;
  dashboard: Record<string, unknown>;
  recentActivity: string[];
  assignments: string[];
  notifications: string[];
  pinnedObjects: string[];
  createdAt: string;
  updatedAt: string;
};

export type TeralinxAuthSession = {
  token: string;
  user: TeralinxUser;
  workspace?: TeralinxWorkspace;
  authenticatedAt: string;
  provider: "TERALINX_ALPHA_INTERNAL" | string;
};

export type TeralinxRuntimeInfo = {
  application: string;
  applicationName: string;
  applicationTitle: string;
  organization: "Teralinx";
  workspaceOwner: "Teralinx";
  version: string;
  runtimeVersion: string;
  gitCommit: string;
  buildDate: string;
  environment: string;
  runtimeStatus: "CONNECTED" | "DEGRADED" | "ERROR" | string;
  status: "CONNECTED" | "DEGRADED" | "ERROR" | string;
  serverStartedAt: string;
  sharedRuntime: boolean;
  libraries: {
    opportunityLibrary: boolean;
    customerDesignLibrary: boolean;
    engineeringLibrary: boolean;
    scopeVersionLibrary: boolean;
    proposalLibrary: boolean;
    activityHistory: boolean;
    evidenceRegistry: boolean;
    runtimeObjectLibrary: boolean;
    relationshipGraph: boolean;
    workspaceLibrary: boolean;
    workspaceSessionLibrary?: boolean;
    runtimeRehydration?: boolean;
    tenantRegistry: boolean;
  };
};

export type TeralinxActivityEvent = {
  activityId: string;
  userId: string;
  userName: string;
  userRole: TeralinxUserRole;
  action: string;
  objectType: string;
  objectId: string;
  objectName?: string;
  revision?: string;
  opportunityId?: string;
  customerId?: string;
  timestamp: string;
  createdAt: string;
  updatedAt: string;
  details?: string;
};

export type TeralinxActivityInput = Omit<TeralinxActivityEvent, "activityId" | "timestamp" | "createdAt" | "updatedAt" | "userId" | "userName" | "userRole"> & {
  timestamp?: string;
};

export type ProposalRuntimeStatus =
  | "COMMERCIAL_DRAFT"
  | "INTERNAL_COMMERCIAL_REVIEW"
  | "WAITING_CUSTOMER_REVIEW"
  | "CUSTOMER_COMMENTS"
  | "COMMERCIAL_REVISION"
  | "CUSTOMER_CHANGES_REQUESTED"
  | "CUSTOMER_APPROVED"
  | "COMMERCIAL_APPROVED"
  | "READY_FOR_IOF_PACKAGE"
  | "SALES_ENGINEERING_REVIEW"
  | "CERTIFIED_IOF_PACKAGE"
  | "CUSTOMER_REJECTED"
  | "WITHDRAWN"
  | "ARCHIVED";

export type ProposalReadiness = {
  proposalId: string;
  proposalRevisionId?: string;
  proposalHash?: string;
  proposalRevisionNumber?: number;
  status: "READY" | "BLOCKED" | string;
  canCreateDraftIofPackage: boolean;
  customerApproved: boolean;
  proposalComplete: boolean;
  runtimeValid: boolean;
  confidence: number;
  missingInformation: string[];
  blockingIssues: string[];
  recommendation: string;
  commercial: Record<string, unknown>;
  customer: Record<string, unknown>;
  engineering: Record<string, unknown>;
  marketplace: Record<string, unknown>;
  runtimeHealth: Record<string, unknown>;
};

export type ProposalRuntimeObject = {
  proposalId: string;
  proposalRecordId: string;
  proposalNumber: string;
  customerId: string;
  opportunityId: string;
  productId?: string;
  productName?: string;
  productConfigurator?: string;
  productConfiguratorVersion?: string;
  configuratorVersion?: string;
  configuratorLifecycle?: string;
  productInvocationAuthority?: string;
  engineeringObjectDoctrine?: unknown;
  engineeringObjects?: unknown[];
  commercialDesign?: unknown;
  commercialReviewState?: unknown;
  fulfillmentPlanId?: string;
  fulfillmentStrategy?: string;
  fulfillmentPlan?: Record<string, unknown> | null;
  fulfillmentMix?: Array<Record<string, unknown>>;
  organizationId: string;
  workspaceId: string;
  owner: string;
  ownerId: string;
  commercialOwner: string;
  commercialOwnerId: string;
  createdBy: string;
  createdById: string;
  assignedCustomerUsers: string[];
  assignedTo: string[];
  visibility: "PRIVATE" | "SHARED" | "ORGANIZATION" | "PUBLIC" | string;
  status: ProposalRuntimeStatus | string;
  approvalState: string;
  lifecycleState: string;
  version: number;
  proposalRevisionId?: string;
  parentProposalRevisionId?: string;
  derivedFromProposalHash?: string;
  proposalHash?: string;
  revisionNumber?: number;
  revisionReason?: string;
  revisionStatus?: "WORKING" | "SAVED" | "ISSUED" | "CUSTOMER_APPROVED" | string;
  proposalRevisions?: Array<{
    proposalId: string;
    proposalRevisionId: string;
    parentProposalRevisionId?: string;
    derivedFromProposalHash?: string;
    revisionNumber: number;
    revisionReason: string;
    revisionStatus: string;
    proposalHash: string;
    createdBy: string;
    createdByName?: string;
    createdAt: string;
    snapshot: Record<string, unknown>;
  }>;
  title: string;
  summary: string;
  executiveSummary: string;
  pricingSummary: Record<string, unknown>;
  marginSummary: Record<string, unknown>;
  confidenceSummary: Record<string, unknown>;
  commercialAssumptionIds: string[];
  dealPointIds: string[];
  runtimeObjectId: string;
  runtimeObjectIds: string[];
  runtimeRelationshipIds: string[];
  runtimeEvidenceIds: string[];
  existingInventoryReferences: string[];
  customerDesignReferences: string[];
  partnerInventoryReferences?: string[];
  marketplaceAssetReferences?: string[];
  newInfrastructureRequired?: string[];
  customerTwinReference: string;
  geometryReferences: string[];
  proposalDocumentReferences: string[];
  attachments: Array<Record<string, unknown>>;
  comments: Array<Record<string, unknown>>;
  reviewers: string[];
  approvals: Array<Record<string, unknown>>;
  history: Array<Record<string, unknown>>;
  historyIds: string[];
  readiness: ProposalReadiness;
  nextLifecycleAction: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
};

export type EngineeringReviewQueueItem = {
  engineeringPackageId?: string;
  packageId: string;
  engineeringBaselineId?: string;
  engineeringBaselineHash?: string;
  engineeringRevisionId?: string;
  engineeringAuthority?: string;
  draftIofPackageId?: string;
  packageName?: string;
  packageReadiness: Record<string, unknown>;
  packageCompleteness?: number;
  certificationProgress?: number;
  packageRevision?: number;
  workspaceId?: string;
  proposalSummary: Record<string, unknown>;
  commercialConfidence: number;
  engineeringConfidence?: number;
  assemblyConfidence?: number;
  engineeringReadiness: string;
  assemblyReport: Record<string, unknown>;
  packageStatus: string;
  assignedEngineer: string;
  assignedEngineerId: string;
  priority: string;
  submissionDate: string;
  submittedAt: string;
  customer: string;
  customerId: string;
  opportunity: string;
  opportunityId: string;
  proposalId: string;
  routeRepositoryId?: string;
  commercialWorkbookId?: string;
  estimateId?: string;
  productDoctrineId?: string;
  commercialStatus?: string;
  repositoryAuthority?: string;
  proposedUnitCount: number;
  certifiedUnitCount: number;
  status: string;
  updatedAt: string;
};

export type EngineeringBaselineRuntime = {
  engineeringBaselineId: string;
  engineeringBaselineManifestId: string;
  engineeringBaselineProjectionId: string;
  engineeringBaselineHash: string;
  draftIOFPackageId: string;
  draftIofPackageId?: string;
  commercialReleasePackageId: string;
  commercialRevisionId: string;
  commercialRevisionHash: string;
  commercialReleaseHash: string;
  routeRepositoryId: string;
  stationProjectionId: string;
  measuredCenterlineId?: string;
  stationGraphId?: string;
  stationAuthorityIds?: string[];
  objectManifestId: string;
  stationObjectManifestId?: string;
  projectedObjectManifestId?: string;
  estimateId: string;
  workbookId: string;
  commercialWorkbookId: string;
  proposalId: string;
  productDoctrineId: string;
  engineeringDoctrineId: string;
  opportunityId: string;
  customerId?: string;
  customerTwinId?: string;
  submittedBy?: string;
  submittedById?: string;
  submittedAt: string;
  baselineState: "FROZEN" | string;
  engineeringAuthority: "ENGINEERING_BASELINE" | string;
  authority: "ENGINEERING_BASELINE_AUTHORITY" | string;
  repositoryType: "ENGINEERING_BASELINE" | string;
  referenceOnly: true;
  immutable: true;
  draftIofPackageUnchanged: true;
  noCommercialMutation: true;
  noScopeVersionCreation: true;
  noGeometryDuplication: true;
  noWorkbookDuplication: true;
  noProposalDuplication: true;
  referenceIntegrity?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
};

export type EngineeringPackageRuntime = {
  engineeringPackageId: string;
  engineeringBaselineId?: string;
  engineeringBaselineManifestId?: string;
  engineeringBaselineProjectionId?: string;
  engineeringBaselineHash?: string;
  baselineState?: string;
  derivedFromBaseline?: boolean;
  engineeringRevisionId?: string;
  engineeringRevisionSource?: string;
  engineeringRevisionState?: string;
  customerId?: string;
  opportunityId: string;
  customerTwinId: string;
  proposalId: string;
  commercialProposalId?: string;
  commercialWorkbookId: string;
  workbookId?: string;
  draftIOFPackageId: string;
  draftIofPackageId?: string;
  commercialRevisionId?: string;
  commercialReleasePackageId?: string;
  commercialRevisionHash?: string;
  commercialReleaseHash?: string;
  routeRepositoryId: string;
  measuredCenterlineId?: string;
  stationGraphId?: string;
  stationAuthorityIds?: string[];
  stationObjectManifestId?: string;
  projectedObjectManifestId?: string;
  estimateId: string;
  productDoctrineId: string;
  submittedBy: string;
  submittedById?: string;
  submittedAt: string;
  submittedDate?: string;
  commercialStatus?: string;
  engineeringStatus: string;
  status?: string;
  serviceOrderState: string;
  serviceOrderStatus?: string;
  scopeVersionState: string;
  scopeVersionStatus?: string;
  authority: "ENGINEERING_REPOSITORY" | string;
  engineeringAuthority?: "ENGINEERING_BASELINE" | string;
  repositoryType?: "ENGINEERING_PACKAGE" | string;
  referenceOnly: true;
  referenceHash?: string;
  referenceIntegrity?: Record<string, unknown>;
  stationPlanId?: string | null;
  futureInventoryManifestId?: string | null;
  certifiedIOFPackageId?: string | null;
  certifiedIofPackageId?: string | null;
  noScopeVersionCreation: true;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
};

export type CommercialRevisionRuntime = {
  commercialRevisionId: string;
  revisionId: string;
  opportunityId: string;
  repositoryId: string;
  routeRepositoryId: string;
  estimateId: string;
  workbookId: string;
  commercialWorkbookId?: string;
  proposalId: string;
  proposalRevisionId?: string;
  proposalHash?: string;
  proposalRevisionNumber?: number;
  revisionStatus: string;
  createdBy: string;
  createdById?: string;
  createdOn: string;
  parentRevision?: string;
  commercialReleaseState: string;
  productDoctrineId?: string;
  commercialDoctrineId?: string;
  commercialAssumptionIds?: string[];
  evidenceReferences?: string[];
  revisionHash: string;
  authority: "COMMERCIAL_REVISION" | string;
  repositoryType: "COMMERCIAL_REVISION" | string;
  editableAuthority: true;
  referenceOnly: true;
  repositoryTruthImmutable: true;
  mutableWorkspaceStateAuthority: false;
  noScopeVersionCreation: true;
  noPricingMutation: true;
  noProposalOutputMutation: true;
  noWorkbookOutputMutation: true;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
};

export type CommercialReleasePackageRuntime = {
  commercialReleasePackageId: string;
  commercialRevisionId: string;
  revisionId: string;
  opportunityId: string;
  repositoryId: string;
  routeRepositoryId: string;
  estimateId: string;
  workbookId: string;
  commercialWorkbookId?: string;
  proposalId: string;
  proposalRevisionId?: string;
  proposalHash?: string;
  proposalRevisionNumber?: number;
  productDoctrineId?: string;
  commercialDoctrineId?: string;
  revisionHash: string;
  releaseHash: string;
  evidenceReferences?: string[];
  status: "FROZEN" | string;
  commercialReleaseState: "RELEASED" | string;
  createdBy: string;
  createdById?: string;
  authority: "COMMERCIAL_RELEASE_PACKAGE" | string;
  repositoryType: "COMMERCIAL_RELEASE_PACKAGE" | string;
  referenceOnly: true;
  immutable: true;
  frozen: true;
  noCommercialTruthDuplication: true;
  noScopeVersionCreation: true;
  noEngineeringAuthorityMutation: true;
  noPricingMutation: true;
  noProposalOutputMutation: true;
  noWorkbookOutputMutation: true;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
};

export type CommercialPatchRuntime = {
  patchId: string;
  revisionId: string;
  patchType: string;
  targetObjectId: string;
  targetProperty: string;
  oldValue: unknown;
  newValue: unknown;
  createdBy: string;
  createdAt: string;
  reason: string;
  authority: "COMMERCIAL_CHANGE_SET" | string;
  validationState: string;
};

export type CommercialChangeSetRuntime = {
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
  status: "ACTIVE" | "APPLIED" | "DISCARDED" | "INACTIVE" | string;
  patchCount: number;
  activePatchCount: number;
  appliedPatchCount: number;
  patches: CommercialPatchRuntime[];
  createdBy: string;
  createdById?: string;
  createdAt: string;
  updatedAt: string;
  authority: "COMMERCIAL_CHANGE_SET" | string;
  repositoryType: "COMMERCIAL_CHANGE_SET" | string;
  additive: true;
  patchSetOnly: true;
  repositoryTruthImmutable: true;
  noScopeVersionCreation: true;
  noPricingMutation: true;
  noProposalOutputMutation: true;
  noEngineeringAuthorityMutation: true;
  [key: string]: unknown;
};

export type CommercialRevisionProjectionRuntime = {
  projectionId: string;
  revisionId: string;
  repositoryId: string;
  opportunityId?: string;
  proposalId?: string;
  changeSetIds: string[];
  patches: CommercialPatchRuntime[];
  diagnostics: {
    repositoryHash: string;
    revisionHash: string;
    activePatchCount: number;
    appliedPatchCount: number;
    patchReplayTimeMs: number;
    projectionTimeMs: number;
    warnings: string[];
  };
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
  [key: string]: unknown;
};

export type EngineeringPatchRuntime = {
  patchId: string;
  revisionId: string;
  patchType: string;
  targetObjectId: string;
  targetProperty: string;
  oldValue: unknown;
  newValue: unknown;
  createdBy: string;
  createdAt: string;
  reason: string;
  authority: "ENGINEERING_CHANGE_SET" | string;
  validationState: string;
};

export type EngineeringChangeSetRuntime = {
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
  status: "ACTIVE" | "APPLIED" | "DISCARDED" | "INACTIVE" | string;
  patchCount: number;
  activePatchCount: number;
  appliedPatchCount: number;
  patches: EngineeringPatchRuntime[];
  createdBy: string;
  createdById?: string;
  createdAt: string;
  updatedAt: string;
  authority: "ENGINEERING_CHANGE_SET" | string;
  repositoryType: "ENGINEERING_CHANGE_SET" | string;
  additive: true;
  patchSetOnly: true;
  baselineImmutable: true;
  repositoryTruthImmutable: true;
  noScopeVersionCreation: true;
  noStationProjectionMutation: true;
  noPricingMutation: true;
  noCommercialAuthorityMutation: true;
  [key: string]: unknown;
};

export type EngineeringRevisionProjectionRuntime = {
  projectionId: string;
  revisionId: string;
  engineeringBaselineId: string;
  engineeringPackageId?: string;
  changeSetIds: string[];
  patches: EngineeringPatchRuntime[];
  diagnostics: {
    baselineHash: string;
    revisionHash: string;
    activePatchCount: number;
    appliedPatchCount: number;
    patchReplayTimeMs: number;
    projectionTimeMs: number;
    warnings: string[];
  };
  certificationConsumesEngineeringRevision: true;
  certifiedIofPackageConsumesEngineeringRevision: true;
  baselineImmutable: true;
  noBaselineMutation: true;
  noEngineeringPackageMutation: true;
  noStationProjectionMutation: true;
  noPricingMutation: true;
  noCommercialAuthorityMutation: true;
  noScopeVersionCreation: true;
  [key: string]: unknown;
};

export type IofPackageManifestEntry = {
  manifestEntryId: string;
  entryType: string;
  objectId: string;
  objectType: string;
  label: string;
  runtimeObjectIds: string[];
  source: string;
  authority: string;
  lifecycle: string;
  duplicated: boolean;
  metadata: Record<string, unknown>;
};

export type IofPackageManifest = {
  manifestId: string;
  packageId: string;
  proposalId: string;
  organizationId?: string;
  workspaceId?: string;
  generatedAt: string;
  modelVersion: string;
  duplicationPolicy: string;
  objects: IofPackageManifestEntry[];
  relationships: IofPackageManifestEntry[];
  inventory: IofPackageManifestEntry[];
  geometry: IofPackageManifestEntry[];
  stations: IofPackageManifestEntry[];
  structures: IofPackageManifestEntry[];
  dependencies: IofPackageManifestEntry[];
  evidence: IofPackageManifestEntry[];
  documents: IofPackageManifestEntry[];
  commercialAssumptions: IofPackageManifestEntry[];
  customerRequests: IofPackageManifestEntry[];
  engineeringRequirements: IofPackageManifestEntry[];
  counts: Record<string, number>;
  summary: Record<string, unknown>;
};

export type IofPackageDependencyGraph = {
  graphId: string;
  packageId: string;
  generatedAt: string;
  path: string;
  nodes: Array<{ id: string; type: string; label: string; metadata?: Record<string, unknown> }>;
  edges: Array<{ edgeId: string; from: string; to: string; relationship: string; metadata?: Record<string, unknown> }>;
  summary: Record<string, unknown>;
};

export type IofPackageValidation = {
  validationId: string;
  packageId: string;
  status: "PASS" | "WARNING" | "FAIL" | string;
  readinessScore: number;
  checks: Array<{ key: string; label: string; status: "PASS" | "WARNING" | "FAIL" | string }>;
  validatedAt: string;
};

export type IofPackageDifferences = {
  differenceId: string;
  packageId: string;
  proposalId: string;
  proposalVersion: number | string | null;
  packageSourceProposalVersion: number | string | null;
  comparedAt: string;
  addedObjects: string[];
  removedObjects: string[];
  modifiedUnits: string[];
  geometryChanges: { added: string[]; removed: string[] };
  relationshipChanges: { added: string[]; removed: string[] };
  engineeringImpact: string;
};

export type ProposedIofUnit = {
  unitId: string;
  unitType: string;
  name: string;
  status: "PROPOSED" | "CERTIFIED" | "REJECTED" | string;
  sourceRuntimeObjectId?: string;
  runtimeObjectIds: string[];
  runtimeRelationshipIds: string[];
  runtimeEvidenceIds: string[];
  geometryReferences: string[];
  dependencyIds: string[];
  quantity?: number;
  commercialQuantity?: number;
  historicalQuantity?: number;
  marketplaceAdvisory?: string;
  engineeringQuantity?: number;
  confidence?: number;
  commercialConfidence?: number;
  engineeringDecision?: string;
  engineeringNote?: string;
  engineeringConfidence?: number;
  engineeringRisk?: string;
  engineeringComments?: unknown[];
  immutable?: boolean;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
};

export type DraftIofPackageRuntime = {
  packageId: string;
  draftPackageId: string;
  engineeringPackageId?: string;
  engineeringPackage?: EngineeringPackageRuntime;
  engineeringRepositoryRestore?: Record<string, unknown>;
  packageName?: string;
  packageType: string;
  status: string;
  workflowStatus: string;
  organizationId?: string;
  workspaceId?: string;
  ownerId?: string;
  owner?: string;
  visibility?: string;
  authority?: string;
  lifecycleState?: string;
  engineeringStatus?: string;
  commercialRevisionLocked?: boolean;
  doctrineId?: string;
  productDoctrineVersion?: string;
  productDoctrineRegistry?: unknown;
  productDoctrineExecution?: Record<string, unknown>;
  requiredServices?: unknown[];
  requiredAssets?: unknown[];
  productDoctrineEngineeringObjects?: unknown[];
  executionSequences?: unknown[];
  closeSequences?: unknown[];
  closeSequenceReferences?: unknown[];
  evidenceRequirements?: unknown[];
  certificationRules?: unknown;
  stationLevelLifecycleProjection?: unknown;
  scopeVersionReadinessRequirements?: unknown[];
  doctrineObjectInstantiation?: unknown;
  doctrineObjectManifest?: unknown;
  engineeringObjectManifest?: unknown;
  doctrineObjectManifestId?: string;
  engineeringObjectManifestId?: string;
  doctrineInstantiatedObjects?: unknown[];
  doctrineObjectAddresses?: unknown[];
  doctrineObjectDependencyGraph?: unknown;
  doctrineObjectExecutionSequence?: unknown[];
  doctrineObjectCloseSequence?: unknown[];
  doctrineObjectPaymentSequence?: unknown[];
  doctrineObjectEvidenceRequirements?: unknown[];
  doctrineStationLifecycleRules?: unknown[];
  doctrineQuantityPlacement?: unknown;
  doctrineStationObjectIndex?: unknown[];
  doctrineSequencedActionObjects?: unknown[];
  doctrineDerivedSpans?: unknown[];
  doctrineLinearAssetSpanAttachments?: unknown[];
  doctrineEngineeringMovementPolicy?: unknown;
  doctrineContinuousStationClosure?: boolean;
  doctrineObjectInstantiationValidation?: unknown;
  doctrineObjectInstantiationSummary?: unknown;
  doctrineProjectionDiagnostics?: unknown;
  geometryAuthorityDiagnostics?: unknown;
  commercialAuditReconciliation?: unknown;
  constitutionalStateValidation?: unknown;
  executionGraphId?: string;
  lifecycleGraphId?: string;
  closureLedger?: unknown;
  closureLedgerId?: string;
  iofPackageTwin?: unknown;
  iofPackageTwinId?: string;
  workSegments?: unknown[];
  doctrineMarketplaceProjection?: unknown;
  doctrineControlProjection?: unknown;
  doctrineFieldProjection?: unknown;
  doctrineTwinProjection?: unknown;
  commercialRevisionId?: string;
  revisionId?: string;
  commercialRevisionHash?: string;
  commercialRepositoryId?: string;
  commercialReleasePackageId?: string;
  commercialReleaseHash?: string;
  commercialReleaseState?: string;
  changeSetIds?: string[];
  activeChangeSetIds?: string[];
  patchCount?: number;
  activePatchCount?: number;
  appliedPatchCount?: number;
  repositoryHash?: string;
  projectionHash?: string;
  patchReplayTimeMs?: number;
  projectionTimeMs?: number;
  currentAuthority?: string;
  proposalAuthorityFlow?: Record<string, unknown>;
  draftIofAuthorityFlow?: Record<string, unknown>;
  commercialAuthorityDiagnostics?: Record<string, unknown>;
  proposalId: string;
  customerId: string;
  opportunityId: string;
  productId?: string;
  productName?: string;
  fulfillmentPlanId?: string;
  fulfillmentStrategy?: string;
  fulfillmentPlan?: Record<string, unknown> | null;
  fulfillmentMix?: Array<Record<string, unknown>>;
  assignedEngineerId: string;
  assignedEngineer: string;
  priority: string;
  submittedAt: string;
  proposalSummary: Record<string, unknown>;
  commercialSummary: Record<string, unknown>;
  customerSummary: Record<string, unknown>;
  proposalRecipientContactIds?: string[];
  customerReviewContactIds?: string[];
  approvalAuthorityContactIds?: string[];
  sofRecipientContactIds?: string[];
  customerContactEmails?: string[];
  packageReadiness: Record<string, unknown>;
  engineeringReadiness: string;
  commercialConfidence: number;
  engineeringConfidence?: number;
  assemblyConfidence?: number;
  packageCompleteness?: number;
  certificationProgress?: number;
  packageRevision?: number;
  assemblyReport: Record<string, unknown>;
  manifest?: IofPackageManifest;
  dependencyGraph?: IofPackageDependencyGraph;
  validation?: IofPackageValidation;
  packageDifferences?: IofPackageDifferences;
  proposedIofUnits: ProposedIofUnit[];
  geometry?: unknown;
  geometryCoordinateCount?: number;
  centerline?: unknown;
  centerlineId?: string;
  centerlineRoute?: unknown;
  osrmRoute?: unknown;
  spine?: unknown;
  measuredSpine?: unknown;
  stationAuthority?: unknown;
  stationIndex?: unknown;
  stationToCoordinateMap?: unknown;
  objectStationAttachments?: unknown[];
  stationIndexedGraph?: unknown;
  spineAuditProjection?: unknown;
  spineAuditAttachments?: unknown[];
  stationedExpectations?: unknown[];
  stationRangeExpectations?: unknown[];
  spineReviewObjects?: unknown[];
  closureExpectations?: unknown[];
  auditProjectionSummary?: unknown;
  kernelExecutionGraph?: unknown;
  executionNodes?: unknown[];
  executionEdges?: unknown[];
  executionGraphProjections?: unknown[];
  executionGraphValidation?: unknown;
  executionGraphSummary?: unknown;
  executionExpectations?: unknown[];
  closureLedgers?: unknown[];
  closureReplaySummary?: unknown;
  constitutionalClosureSummary?: unknown;
  constitutionalAssembly?: unknown;
  spineObjectDependencies?: unknown[];
  spineObjectCloseSequences?: unknown[];
  spineObjectEvidenceRequirements?: unknown[];
  segmentValidationRules?: unknown[];
  paymentEligibilityRules?: unknown[];
  draftIofReadiness?: unknown;
  objectAddressingDoctrine?: unknown;
  stationAddressRegistry?: unknown;
  objectAddresses?: unknown[];
  unassignedReviewObjects?: unknown[];
  addressedReviewObjects?: unknown[];
  addressValidation?: unknown;
  addressAssignmentEvents?: unknown[];
  addressProjectionSummary?: unknown;
  objectAddressingMapLayers?: unknown[];
  spineObjectCatalog?: unknown;
  spineObjectCatalogEntries?: unknown[];
  spineObjectCatalogValidation?: unknown;
  spineObjectCatalogSummary?: unknown;
  auditObjectManifest?: unknown;
  auditObjectManifestEntries?: unknown[];
  auditManifestReviewObjects?: unknown[];
  auditObjectManifestValidation?: unknown;
  auditObjectManifestSummary?: unknown;
  objectManifestSummary?: unknown;
  productionDoctrine?: unknown;
  productionProfileLibrary?: unknown;
  productionProfiles?: unknown[];
  objectProductionProfiles?: unknown[];
  productionProjectionSummary?: unknown;
  productionScheduleProjection?: unknown[];
  productionCostProjection?: unknown[];
  productionPaymentProjection?: unknown[];
  productionReviewObjects?: unknown[];
  productionValidation?: unknown;
  instantiatedSpineObjects?: unknown[];
  spineObjectRegistry?: unknown;
  spineObjectIdentityRegistry?: unknown;
  constructionSegments?: unknown[];
  paymentSegments?: unknown[];
  executionZones?: unknown[];
  instantiationSummary?: unknown;
  instantiationHealth?: unknown;
  hierarchySummary?: unknown;
  productionBindings?: unknown[];
  addressBindings?: unknown[];
  kernelSpineObjectReferences?: unknown[];
  auditProjectionRedlines?: unknown[];
  commercialBaselineFrozen?: boolean;
  commercialBaselineFrozenAt?: string;
  commercialObjectPlacementHistory?: unknown[];
  customerRequestedMoves?: unknown[];
  commercialImpactSummary?: unknown;
  commercialImpactSummaries?: unknown[];
  commercialReviewRevision?: number;
  route?: unknown[];
  commercialDraftSnapshot?: unknown;
  stations?: unknown[];
  structures?: unknown[];
  dependencies?: unknown[];
  objects?: unknown[];
  relationships?: unknown[];
  evidence?: unknown[];
  proposalDocumentReferences?: string[];
  customerRequests?: unknown[];
  commercialNotes?: unknown[];
  engineeringNotes?: unknown[];
  engineeringRequirements?: unknown[];
  runtimeObjectIds: string[];
  runtimeRelationshipIds: string[];
  runtimeEvidenceIds: string[];
  existingInventoryReferences: string[];
  customerDesignReferences: string[];
  partnerInventoryReferences?: string[];
  marketplaceAssetReferences?: string[];
  newInfrastructureRequired?: string[];
  customerTwinReference: string;
  geometryReferences: string[];
  historyIds: string[];
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
};

export type RuntimeLifecycleProgressItem = {
  eventType: string;
  complete: boolean;
  timestamp: string;
  objectId: string;
};

export type RuntimeLifecycleBridgeState = {
  lifecycleId: string;
  status: string;
  lifecycleProgress: RuntimeLifecycleProgressItem[];
  currentAuthority: string;
  currentOwner: string;
  currentWorkspace: string;
  currentRuntimeObject: string;
  currentProduct?: string;
  currentFulfillmentPlan?: string;
  currentProposal: string;
  currentIofPackage: string;
  currentEngineeringStatus: string;
  events?: Array<Record<string, unknown>>;
};

export type RuntimeLifecycleBridgeResult = {
  ok: boolean;
  trigger: string;
  lifecycle: RuntimeLifecycleBridgeState;
  customerTwin?: Record<string, unknown>;
  opportunity?: Record<string, unknown>;
  product?: Record<string, unknown>;
  fulfillmentPlan?: Record<string, unknown>;
  commercialDraft?: Record<string, unknown>;
  proposal?: ProposalRuntimeObject;
  draftPackage?: DraftIofPackageRuntime | null;
  engineeringQueueItem?: EngineeringReviewQueueItem | null;
  workspaceSession?: RuntimeWorkspaceSession;
};

type DraftIofPayloadSizeEntry = {
  key: string;
  approxBytes: number;
  descriptor: string;
};

type DraftIofSavePayloadSizeAudit = {
  topLevelKeys: string[];
  originalApproxBytes: number;
  referenceOnlyBytes: number;
  largestFields: DraftIofPayloadSizeEntry[];
  inspectedSections: DraftIofPayloadSizeEntry[];
  offendingField: string | null;
  thresholdBytes: number;
  referenceOnlyThresholdBytes: number;
};

const DRAFT_IOF_REFERENCE_ONLY_MAX_BYTES = 4 * 1024 * 1024;
const DRAFT_IOF_OFFENDING_FIELD_THRESHOLD_BYTES = 512 * 1024;

function runtimeRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function runtimeText(...values: unknown[]) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function runtimeNumber(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function runtimeStringList(...values: unknown[]) {
  const seen = new Set<string>();
  const list: string[] = [];
  for (const value of values) {
    const entries = Array.isArray(value) ? value : [value];
    for (const entry of entries) {
      const text = String(entry ?? "").trim();
      if (!text || seen.has(text)) continue;
      seen.add(text);
      list.push(text);
    }
  }
  return list;
}

function approximatePayloadBytes(value: unknown, seen = new WeakSet<object>(), depth = 0): number {
  if (value === null || value === undefined) return 4;
  if (typeof value === "string") return value.length * 2 + 2;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return String(value).length;
  if (typeof value === "function" || typeof value === "symbol") return 0;
  if (depth > 8) return 64;
  if (typeof value !== "object") return 0;
  if (seen.has(value)) return 16;
  seen.add(value);
  if (Array.isArray(value)) {
    if (!value.length) return 2;
    const sampleCount = Math.min(value.length, 100);
    const sampleBytes = value.slice(0, sampleCount).reduce((total, item) => total + approximatePayloadBytes(item, seen, depth + 1), 2);
    const average = sampleBytes / sampleCount;
    return Math.round(2 + average * value.length);
  }
  const record = value as Record<string, unknown>;
  return Object.entries(record).reduce((total, [key, item]) => (
    total + key.length * 2 + approximatePayloadBytes(item, seen, depth + 1)
  ), 2);
}

function byteLengthOfSmallJson(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

function payloadDescriptor(value: unknown) {
  if (Array.isArray(value)) return `array(${value.length})`;
  if (value && typeof value === "object") return `object(${Object.keys(value as Record<string, unknown>).length})`;
  return typeof value;
}

function sectionSize(key: string, value: unknown): DraftIofPayloadSizeEntry {
  return {
    key,
    approxBytes: approximatePayloadBytes(value),
    descriptor: payloadDescriptor(value),
  };
}

function draftIofSavePayloadSizeAudit(
  draftPackage: DraftIofPackageRuntime,
  referenceOnlyDraftPackage: DraftIofPackageRuntime,
): DraftIofSavePayloadSizeAudit {
  const draft = draftPackage as Record<string, unknown>;
  const commercialSummary = runtimeRecord(draftPackage.commercialSummary);
  const geometry = runtimeRecord(draftPackage.geometry);
  const sections = [
    sectionSize("route geometry", {
      routeGeometry: draft.routeGeometry,
      commercialGeometry: draft.commercialGeometry,
      convertedRuntimeGeometry: draft.convertedRuntimeGeometry,
      renderedGeometryCache: draft.renderedGeometryCache,
      geometry,
      centerline: draftPackage.centerline,
      route: draftPackage.route,
      osrmRoute: draftPackage.osrmRoute,
    }),
    sectionSize("workbook", {
      workbook: draft.workbook,
      workbookRows: draft.workbookRows,
      commercialWorkbook: draft.commercialWorkbook,
      commercialWorkbookSections: draft.commercialWorkbookSections,
      commercialSummaryWorkbook: commercialSummary.workbook,
    }),
    sectionSize("proposal", {
      proposalSummary: draftPackage.proposalSummary,
      proposalBody: draft.proposalBody,
      proposalDocument: draft.proposalDocument,
      proposalHtml: draft.proposalHtml,
    }),
    sectionSize("estimate", {
      estimate: draft.estimate,
      commercialEstimate: draft.commercialEstimate,
      pricing: draft.pricing,
      pricingSummary: draft.pricingSummary,
      commercialSummaryPricing: commercialSummary.pricingSummary,
      financialAuthority: draft.financialAuthority,
    }),
    sectionSize("customer twin/runtime inventory", {
      customerTwin: draft.customerTwin,
      customerTwinSnapshot: draft.customerTwinSnapshot,
      runtimeInventory: draft.runtimeInventory,
      objectInventory: draft.objectInventory,
      inventory: draft.inventory,
      existingInventoryReferences: draftPackage.existingInventoryReferences,
      customerDesignReferences: draftPackage.customerDesignReferences,
    }),
    sectionSize("station graph", {
      stationGraph: draft.stationGraph,
      stationIndexedGraph: draftPackage.stationIndexedGraph,
      stationAuthority: draftPackage.stationAuthority,
      stationAddressRegistry: draftPackage.stationAddressRegistry,
      stations: draftPackage.stations,
      measuredCenterline: draftPackage.measuredCenterline,
      measuredSpine: draftPackage.measuredSpine,
    }),
    sectionSize("object manifest", {
      manifest: draftPackage.manifest,
      objectManifest: draft.objectManifest,
      doctrineObjectManifest: draft.doctrineObjectManifest,
      doctrineProjection: draft.doctrineProjection,
      doctrineProjectionDiagnostics: draft.doctrineProjectionDiagnostics,
      objectManifestSummary: draftPackage.objectManifestSummary,
      auditObjectManifest: draftPackage.auditObjectManifest,
      auditObjectManifestEntries: draftPackage.auditObjectManifestEntries,
      stationObjectManifest: draft.stationObjectManifest,
      projectedObjectManifest: draft.projectedObjectManifest,
      objects: draftPackage.objects,
      instantiatedSpineObjects: draftPackage.instantiatedSpineObjects,
    }),
    sectionSize("commercial revision", {
      commercialRevisionId: draftPackage.commercialRevisionId,
      revisionId: draftPackage.revisionId,
      commercialRevisionHash: draftPackage.commercialRevisionHash,
      commercialAuthorityDiagnostics: draftPackage.commercialAuthorityDiagnostics,
      proposalAuthorityFlow: draftPackage.proposalAuthorityFlow,
      draftIofAuthorityFlow: draftPackage.draftIofAuthorityFlow,
    }),
    sectionSize("commercial release package", {
      commercialReleasePackageId: draftPackage.commercialReleasePackageId,
      commercialReleaseHash: draftPackage.commercialReleaseHash,
      commercialReleaseState: draftPackage.commercialReleaseState,
    }),
  ].sort((a, b) => b.approxBytes - a.approxBytes);
  const largestFields = Object.entries(draft)
    .map(([key, value]) => ({
      key,
      approxBytes: approximatePayloadBytes(value),
      descriptor: payloadDescriptor(value),
    }))
    .sort((a, b) => b.approxBytes - a.approxBytes)
    .slice(0, 25);
  const offending = largestFields.find((entry) => entry.approxBytes > DRAFT_IOF_OFFENDING_FIELD_THRESHOLD_BYTES) ?? null;
  return {
    topLevelKeys: Object.keys(draftPackage),
    originalApproxBytes: approximatePayloadBytes(draftPackage),
    referenceOnlyBytes: byteLengthOfSmallJson({ draftPackage: referenceOnlyDraftPackage }),
    largestFields,
    inspectedSections: sections,
    offendingField: offending?.key ?? null,
    thresholdBytes: DRAFT_IOF_OFFENDING_FIELD_THRESHOLD_BYTES,
    referenceOnlyThresholdBytes: DRAFT_IOF_REFERENCE_ONLY_MAX_BYTES,
  };
}

function draftIofPackageRecordForRepository(draftPackage: DraftIofPackageRuntime): DraftIofPackageRuntime {
  const draft = draftPackage as Record<string, unknown>;
  const commercialSummary = runtimeRecord(draftPackage.commercialSummary);
  const routeRepositoryRef = runtimeRecord(draft.routeRepositoryRef);
  const geometry = runtimeRecord(draftPackage.geometry);
  const proposalSummary = runtimeRecord(draftPackage.proposalSummary);
  const customerSummary = runtimeRecord(draftPackage.customerSummary);
  const packageReadiness = runtimeRecord(draftPackage.packageReadiness);
  const assemblyReport = runtimeRecord(draftPackage.assemblyReport);
  const artifactReferences = runtimeRecord(draft.iofArtifactRepositoryReferences);
  const routeRepositoryId = runtimeText(
    draft.routeRepositoryId,
    routeRepositoryRef.routeRepositoryId,
    commercialSummary.routeRepositoryId,
  );
  const routeGeometryId = runtimeText(
    draft.routeGeometryId,
    routeRepositoryRef.routeGeometryId,
    geometry.routeGeometryId,
    draft.centerlineId,
  );
  const geometryHash = runtimeText(
    draft.geometryHash,
    routeRepositoryRef.geometryHash,
    geometry.geometryHash,
  );
  const workbookId = runtimeText(
    draft.workbookId,
    draft.commercialWorkbookId,
    commercialSummary.workbookId,
    runtimeRecord(commercialSummary.commercialWorkbook).workbookId,
  );
  const commercialWorkbookId = runtimeText(
    draft.commercialWorkbookId,
    draft.workbookId,
    commercialSummary.commercialWorkbookId,
    commercialSummary.workbookId,
  );
  const estimateId = runtimeText(
    draft.estimateId,
    draft.commercialEstimateId,
    commercialSummary.estimateId,
    runtimeRecord(draft.pricingSummary).estimateId,
    runtimeRecord(commercialSummary.pricingSummary).estimateId,
  );
  const proposalId = runtimeText(draftPackage.proposalId, proposalSummary.proposalId);
  const proposalRevisionId = runtimeText(draftPackage.proposalRevisionId, proposalSummary.proposalRevisionId, draft.proposalRevisionId);
  const proposalHash = runtimeText(draftPackage.proposalHash, proposalSummary.proposalHash, draft.proposalHash);
  const proposalRevisionNumber = runtimeNumber(draftPackage.proposalRevisionNumber ?? proposalSummary.proposalRevisionNumber ?? draft.proposalRevisionNumber, 0);
  const customerId = runtimeText(draftPackage.customerId, customerSummary.customerId, draft.customerId);
  const opportunityId = runtimeText(draftPackage.opportunityId, draft.opportunityId);
  const commercialRevisionId = runtimeText(draftPackage.commercialRevisionId, draftPackage.revisionId, draft.commercialRevisionId);
  const commercialReleasePackageId = runtimeText(draftPackage.commercialReleasePackageId, draft.commercialReleasePackageId);
  const missing = [
    ["proposalId", proposalId],
    ["customerId", customerId],
    ["opportunityId", opportunityId],
    ["routeRepositoryId", routeRepositoryId],
    ["workbookId", workbookId || commercialWorkbookId],
    ["estimateId", estimateId],
    ["commercialRevisionId", commercialRevisionId],
    ["commercialReleasePackageId", commercialReleasePackageId],
  ].filter(([, value]) => !String(value ?? "").trim());
  if (missing.length) {
    throw new Error(`Draft IOF reference-only save blocked: missing ${missing.map(([field]) => field).join(", ")}.`);
  }
  const referenceOnly = {
    packageId: draftPackage.packageId,
    draftPackageId: draftPackage.draftPackageId ?? draftPackage.packageId,
    packageName: draftPackage.packageName,
    packageType: draftPackage.packageType ?? "ENGINEERING",
    status: draftPackage.status ?? "DRAFT",
    workflowStatus: draftPackage.workflowStatus ?? "ENGINEERING_REVIEW",
    organizationId: draftPackage.organizationId,
    workspaceId: draftPackage.workspaceId,
    ownerId: draftPackage.ownerId,
    owner: draftPackage.owner,
    visibility: draftPackage.visibility ?? "ORGANIZATION",
    authority: draftPackage.authority ?? "COMMERCIAL_DRAFT_IOF_PACKAGE",
    lifecycleState: draftPackage.lifecycleState ?? "IN_REVIEW",
    commercialRepositoryId: draftPackage.commercialRepositoryId,
    commercialRevisionId,
    revisionId: draftPackage.revisionId ?? commercialRevisionId,
    commercialRevisionHash: draftPackage.commercialRevisionHash,
    commercialReleasePackageId,
    commercialReleaseHash: draftPackage.commercialReleaseHash,
    commercialReleaseState: draftPackage.commercialReleaseState,
    changeSetIds: runtimeStringList(draftPackage.changeSetIds),
    activeChangeSetIds: runtimeStringList(draftPackage.activeChangeSetIds, draftPackage.changeSetIds),
    patchCount: runtimeNumber(draftPackage.patchCount, 0),
    activePatchCount: runtimeNumber(draftPackage.activePatchCount, 0),
    appliedPatchCount: runtimeNumber(draftPackage.appliedPatchCount, 0),
    repositoryHash: draftPackage.repositoryHash,
    projectionHash: draftPackage.projectionHash,
    currentAuthority: draftPackage.currentAuthority ?? (commercialReleasePackageId ? "COMMERCIAL_RELEASE_PACKAGE" : "COMMERCIAL_REVISION"),
    proposalId,
    proposalRevisionId,
    proposalHash,
    proposalRevisionNumber,
    customerId,
    opportunityId,
    accountId: draft.accountId,
    productId: draftPackage.productId,
    productName: draftPackage.productName,
    assignedEngineerId: draftPackage.assignedEngineerId ?? "",
    assignedEngineer: draftPackage.assignedEngineer ?? "Unassigned",
    priority: draftPackage.priority ?? "NORMAL",
    submittedAt: draftPackage.submittedAt,
    routeRepositoryId,
    routeRepositoryRef: {
      routeRepositoryId,
      routeGeometryId,
      geometryHash,
      repositoryType: "COMMERCIAL_ROUTE_REPOSITORY",
    },
    routeGeometryId,
    geometryHash,
    geometryReferences: runtimeStringList(draftPackage.geometryReferences, routeGeometryId),
    workbookId,
    commercialWorkbookId: commercialWorkbookId || workbookId,
    estimateId,
    commercialEstimateId: estimateId,
    stationProjectionId: runtimeText(draft.stationProjectionId, draft.stationGraphId),
    stationGraphId: runtimeText(draft.stationGraphId),
    stationAuthorityIds: runtimeStringList(draft.stationAuthorityIds),
    measuredCenterlineId: runtimeText(draft.measuredCenterlineId),
    stationObjectManifestId: runtimeText(draft.stationObjectManifestId),
    projectedObjectManifestId: runtimeText(draft.projectedObjectManifestId),
    objectManifestId: runtimeText(draft.objectManifestId, draft.stationObjectManifestId, draft.projectedObjectManifestId),
    productDoctrineId: runtimeText(draft.productDoctrineId, draft.doctrineId),
    doctrineId: runtimeText(draft.doctrineId, draft.productDoctrineId),
    proposalSummary: {
      proposalId,
      proposalRevisionId,
      proposalHash,
      proposalRevisionNumber,
      proposalNumber: proposalSummary.proposalNumber,
      title: proposalSummary.title,
      status: proposalSummary.status,
      repositoryType: "PROPOSAL_REPOSITORY",
    },
    commercialSummary: {
      routeRepositoryId,
      routeGeometryId,
      geometryHash,
      workbookId,
      commercialWorkbookId: commercialWorkbookId || workbookId,
      estimateId,
      proposalId,
      proposalRevisionId,
      proposalHash,
      proposalRevisionNumber,
      commercialRevisionId,
      commercialReleasePackageId,
      commercialReleaseHash: draftPackage.commercialReleaseHash,
      repositoryType: "COMMERCIAL_RELEASE_PACKAGE_REFERENCES",
    },
    customerSummary: {
      customerId,
      customerTwinId: runtimeText(customerSummary.customerTwinId, draft.customerTwinId, draftPackage.customerTwinReference),
      name: customerSummary.name,
    },
    packageReadiness: {
      status: packageReadiness.status ?? "REFERENCE_ONLY",
      readinessScore: packageReadiness.readinessScore,
      canSubmitToEngineering: packageReadiness.canSubmitToEngineering,
    },
    engineeringReadiness: draftPackage.engineeringReadiness ?? "READY_FOR_ENGINEERING_REVIEW",
    commercialConfidence: runtimeNumber(draftPackage.commercialConfidence, 0),
    engineeringConfidence: runtimeNumber(draftPackage.engineeringConfidence, 0),
    assemblyConfidence: runtimeNumber(draftPackage.assemblyConfidence, 0),
    packageCompleteness: runtimeNumber(draftPackage.packageCompleteness, 0),
    assemblyReport: {
      assemblyId: assemblyReport.assemblyId,
      assembledBy: assemblyReport.assembledBy ?? "IOFPackageAssemblyEngine",
      referenceOnly: true,
    },
    doctrineObjectManifestId: runtimeText(draft.doctrineObjectManifestId, runtimeRecord(draft.doctrineObjectManifest).manifestId, runtimeRecord(draft.engineeringObjectManifest).manifestId),
    engineeringObjectManifestId: runtimeText(draft.engineeringObjectManifestId, runtimeRecord(draft.engineeringObjectManifest).manifestId, runtimeRecord(draft.doctrineObjectManifest).manifestId),
    doctrineProjectionId: runtimeText(draft.doctrineProjectionId, runtimeRecord(draft.doctrineProjection).projectionId),
    executionGraphId: runtimeText(draft.executionGraphId, runtimeRecord(draft.projectedObjectManifest).executionGraphId, runtimeRecord(draft.iofPackageTwin).executionGraphId),
    lifecycleGraphId: runtimeText(draft.lifecycleGraphId, runtimeRecord(draft.projectedObjectManifest).lifecycleGraphId, runtimeRecord(draft.iofPackageTwin).lifecycleGraphId),
    closureLedgerId: runtimeText(draft.closureLedgerId, runtimeRecord(draft.closureLedger).closureLedgerId),
    iofPackageTwinId: runtimeText(draft.iofPackageTwinId, runtimeRecord(draft.iofPackageTwin).twinProjectionId),
    iofArtifactRepositoryReferences: artifactReferences,
    objectManifestRef: artifactReferences.engineeringObjectManifest,
    stationProjectionRef: artifactReferences.stationProjection,
    stationGraphRef: artifactReferences.stationGraph,
    measuredCenterlineRef: artifactReferences.measuredCenterline,
    productDoctrineAssemblyRef: artifactReferences.productDoctrineAssembly,
    projectConfigurationRef: artifactReferences.projectConfiguration,
    quantityReconciliationRef: artifactReferences.quantityReconciliation,
    routeRevision: draft.routeRevision ?? routeRepositoryRef.routeRevision,
    productVersion: draft.productVersion,
    productDoctrineVersion: draft.productDoctrineVersion,
    estimateRevisionId: draft.estimateRevisionId,
    estimateHash: draft.estimateHash,
    sourceEvidenceRefs: Array.isArray(draft.sourceEvidenceRefs) ? draft.sourceEvidenceRefs : [],
    proposedIofUnits: [],
    runtimeObjectIds: runtimeStringList(draftPackage.runtimeObjectIds),
    runtimeRelationshipIds: runtimeStringList(draftPackage.runtimeRelationshipIds),
    runtimeEvidenceIds: runtimeStringList(draftPackage.runtimeEvidenceIds),
    existingInventoryReferences: runtimeStringList(draftPackage.existingInventoryReferences),
    customerDesignReferences: runtimeStringList(draftPackage.customerDesignReferences),
    customerTwinReference: runtimeText(draftPackage.customerTwinReference, customerSummary.customerTwinId, draft.customerTwinId),
    historyIds: runtimeStringList(draftPackage.historyIds, `${draftPackage.packageId}:HISTORY:COMMERCIAL_ASSEMBLED`),
    draftIofSavePayload: {
      referenceOnly: true,
      noEmbeddedRouteGeometry: true,
      noEmbeddedWorkbookRows: true,
      noEmbeddedProposalBody: true,
      noEmbeddedRuntimeInventory: true,
      noEmbeddedMapObjects: true,
      replacedByReferences: [
        "routeRepositoryId",
        "routeGeometryId",
        "geometryHash",
        "workbookId",
        "estimateId",
        "proposalId",
        "commercialRevisionId",
        "commercialReleasePackageId",
        "stationProjectionId",
        "objectManifestId",
      ],
    },
    referenceOnly: true,
    noScopeVersionCreation: true,
    noInventoryMutation: true,
    noMarketplaceCreation: true,
    noControlCreation: true,
    noFieldCreation: true,
    createdAt: draftPackage.createdAt,
    updatedAt: draftPackage.updatedAt,
  } as DraftIofPackageRuntime;
  const referenceBytes = byteLengthOfSmallJson({ draftPackage: referenceOnly });
  if (referenceBytes > DRAFT_IOF_REFERENCE_ONLY_MAX_BYTES) {
    const largest = draftIofSavePayloadSizeAudit(draftPackage, referenceOnly).largestFields[0];
    throw new Error(`Draft IOF reference-only save blocked: payload is ${referenceBytes} bytes; largest source field is ${largest.key} (${largest.approxBytes} bytes).`);
  }
  return referenceOnly;
}

export type RuntimeWorkspaceSession = {
  sessionId: string;
  workspaceSessionId: string;
  runtimeObjectId: string;
  objectType: "WORKSPACE_SESSION" | string;
  userId: string;
  workspaceId: string;
  organizationId: string;
  accountId: string;
  customerId?: string;
  opportunityId?: string;
  productId?: string;
  fulfillmentPlanId?: string;
  proposalId?: string;
  packageId?: string;
  certifiedPackageId?: string;
  scopeVersionId?: string;
  currentRuntimeObject?: string;
  currentAuthority?: string;
  currentLifecycleStage?: string;
  selectedGraph?: string;
  selectedRoute?: string;
  selectedCustomerDesign?: string;
  selectedInventory?: string[];
  selectedPackage?: string;
  selectedProposalRevision?: string;
  engineeringRevision?: string;
  resumeToken?: string;
  sessionState?: string;
  lastActivity?: string;
  lastSaved?: string;
  [key: string]: unknown;
};

export type RuntimeRehydrationState = {
  workspaceSession: RuntimeWorkspaceSession;
  restored: Record<string, unknown>;
  account?: Record<string, unknown> | null;
  contacts?: Array<Record<string, unknown>>;
  opportunity?: Record<string, unknown> | null;
  product?: Record<string, unknown> | null;
  fulfillmentPlan?: Record<string, unknown> | null;
  proposal?: ProposalRuntimeObject | null;
  draftPackage?: DraftIofPackageRuntime | null;
  certifiedPackage?: CertifiedIofPackageRuntime | null;
  scopeVersion?: Record<string, unknown> | null;
  currentRuntimeObject?: string;
  currentAuthority?: string;
  currentLifecycleStage?: string;
  route?: Record<string, unknown>;
  graph?: Record<string, unknown>;
  runtimeObjects?: Array<Record<string, unknown>>;
  runtimeHistory?: Array<Record<string, unknown>>;
  twinRestore?: Record<string, unknown>;
  runtimeIsSingleSourceOfTruth?: boolean;
};

export type ProposalCustomerRecipientInput = {
  assignedCustomerUsers?: string[];
  customerUsers?: string[];
  customerReviewers?: string[];
  proposalRecipientContactIds?: string[];
  customerReviewContactIds?: string[];
  approvalAuthorityContactIds?: string[];
  sofRecipientContactIds?: string[];
  customerContactEmails?: string[];
};

export type CertifiedIofPackageRuntime = DraftIofPackageRuntime & {
  certifiedPackageId: string;
  certificationLedgerId?: string;
  certificationId?: string;
  packageHash?: string;
  certifiedPackageHash?: string;
  certificationEvidenceManifestId?: string;
  evidenceManifestId?: string;
  certificationEvidenceHash?: string;
  engineeringBaselineId?: string;
  engineeringRevisionId?: string;
  engineeringRevisionHash?: string;
  engineeringApprovalId?: string;
  engineeringApprovalHash?: string;
  engineeringChangeSetIds?: string[];
  commercialReleasePackageId?: string;
  commercialRevisionId?: string;
  commercialRevisionHash?: string;
  certifiedDraftIofPackageId?: string;
  technicalSourcePackageId?: string;
  sourceEngineeringTruthId?: string;
  sourcePackageId: string;
  sourceDraftPackageId?: string;
  singleEngineeringTruth?: boolean;
  noEngineeringRecreation?: boolean;
  readyForCustomerCommitment?: boolean;
  noAdditionalEngineeringReviewAfterSignature?: boolean;
  routeRepositoryId?: string;
  proposalId: string;
  commercialEstimate?: Record<string, unknown>;
  stationPlanId?: string;
  stationPlan?: Record<string, unknown>;
  engineeringApprovedObjectBudget?: Record<string, unknown>;
  engineeringApprovedBudget?: number;
  engineeringApprovedBudgetTotal?: number;
  engineeringReviewer?: string;
  engineeringReviewerId?: string;
  certificationTimestamp?: string;
  certificationRevision?: number;
  certificationHash?: string;
  serviceOrderStatus?: string;
  signatureStatus?: string;
  scopeVersionStatus?: string;
  scopeVersionFuture?: boolean;
  certificationDate?: string;
  certifiedAt: string;
  certifiedBy: string;
  certifiedById: string;
  engineer?: string;
  engineerId?: string;
  doctrineStatus?: string;
  constraintSummary?: Record<string, unknown>;
  approvedExceptions?: unknown[];
  redlineHistory?: unknown[];
  engineeringManifest?: IofPackageManifest;
  readiness?: Record<string, unknown>;
  notes?: string;
  engineeringChecklist: Record<string, unknown>;
  certificationConfidence: number;
  certifiedIofUnits: ProposedIofUnit[];
  executionAuthorizationCertificateId?: string;
  scopeVersionId?: string;
  executionAuthorized?: boolean;
  immutable: boolean;
};

export type CertificationLedgerEntryRuntime = {
  certificationLedgerId: string;
  certificationId: string;
  engineeringBaselineId: string;
  engineeringRevisionId: string;
  engineeringRevisionHash: string;
  engineeringApprovalId?: string;
  engineeringApprovalHash?: string;
  engineeringChangeSetIds?: string[];
  commercialReleasePackageId: string;
  commercialRevisionId: string;
  commercialRevisionHash: string;
  routeRepositoryId?: string;
  proposalId?: string;
  estimateId?: string;
  workbookId?: string;
  productDoctrineId?: string;
  engineeringDoctrineId?: string;
  certificationEvidenceManifestId: string;
  certificationEvidenceManifest?: Record<string, unknown>;
  certificationEvidenceHash: string;
  certificationTimestamp: string;
  certifiedBy: string;
  certifiedById?: string;
  reviewStatus: string;
  engineeringDoctrineVersion: string;
  commercialDoctrineVersion: string;
  stationProjectionHash: string;
  objectManifestHash: string;
  packageHash: string;
  certificationHash: string;
  result: string;
  certifiedPackageId: string;
  certifiedIofPackageProjectionId: string;
  certifiedPackageHash: string;
  authority: "CERTIFICATION_LEDGER" | string;
  repositoryType: "CERTIFICATION_LEDGER" | string;
  immutable: boolean;
  appendOnly: boolean;
  referenceOnly: boolean;
  createdAt: string;
  updatedAt: string;
};

export type EngineeringApprovalRuntime = {
  approvalId: string;
  organizationId: string;
  tenantId: string;
  customerId: string;
  opportunityId: string;
  engineeringPackageId: string;
  engineeringBaselineId: string;
  engineeringRevisionId: string;
  engineeringRevisionHash: string;
  draftIofPackageId: string;
  proposalRevisionId?: string;
  proposalHash?: string;
  commercialRevisionId?: string;
  commercialRevisionHash?: string;
  decision: "APPROVED";
  approvedBy: string;
  approvedById: string;
  approvedAt: string;
  reviewSummary: Record<string, unknown>;
  reviewSummaryHash: string;
  approvalHash: string;
  authority: "ENGINEERING_APPROVAL";
  repositoryType: "ENGINEERING_APPROVAL";
  immutable: true;
  referenceOnly: true;
};

export type EngineeringApprovalEligibilityRuntime = {
  engineeringPackageId: string;
  engineeringRevisionId: string;
  engineeringRevisionHash: string;
  draftIofPackageId: string;
  proposalRevisionId?: string;
  commercialRevisionId?: string;
  organizationId: string;
  tenantId: string;
  customerId: string;
  opportunityId: string;
  packageIntegrity: "PASS" | "FAIL" | string;
  routeAuthority: "PASS" | "FAIL" | string;
  quantityReconciliation: "PASS" | "INCOMPLETE" | string;
  constitutionalQuantity: "PASS" | "INCOMPLETE" | string;
  budgetApproval: "APPROVED" | "NOT_APPROVED" | string;
  blockingConditions: number;
  compliance: "PASS" | "FAIL" | string;
  reviewSummaryHash: string;
  reviewComplete: boolean;
  approvalEligible: boolean;
  blockers: Array<{
    code: string;
    predicate: string;
    expected: unknown;
    actual: unknown;
    sourceAuthority: string;
  }>;
  sourceAuthority: "ENGINEERING_APPROVAL_ELIGIBILITY";
  derivedFromGovernedState: true;
  reasoningRequired: false;
};

export type ServiceOrderRuntime = {
  serviceOrderId: string;
  serviceOrderNumber?: string;
  objectType: "SERVICE_ORDER_FORM" | string;
  authority: "COMMERCIAL_AUTHORIZATION" | string;
  constitutionalRole?: string;
  lifecycleState: string;
  status: string;
  authorizationStatus: string;
  signatureStatus: string;
  readyForSignature: boolean;
  customer: Record<string, unknown>;
  customerId?: string;
  customerName?: string;
  accountId?: string;
  opportunityId?: string;
  proposalId: string;
  proposalNumber?: string;
  acceptedProposalId: string;
  acceptedProposalRevision: string | number;
  customerAcceptance: Record<string, unknown>;
  customerAcceptanceId?: string;
  certifiedDraftIofPackageId: string;
  draftIofPackageId: string;
  draftIofPackageRevision?: string | number;
  engineeringCertificationId: string;
  certifiedPackageId: string;
  futureScopeVersionId: string;
  executionOrderReference: string;
  product: Record<string, unknown>;
  routeSummary: Record<string, unknown>;
  pricingSummary: Record<string, unknown>;
  objectSummary: Record<string, unknown>;
  scheduleSummary: Record<string, unknown>;
  assumptions: unknown[];
  commercialTerms: Record<string, unknown>;
  legalPlaceholders: Array<Record<string, unknown>>;
  sourceReferences: Record<string, unknown>;
  runtimePromotion: Record<string, unknown>;
  signature: Record<string, unknown>;
  noScopeVersionCreation: boolean;
  noEngineeringRecreation: boolean;
  noEngineeringObjectsPersisted: boolean;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
};

export type EngineeringIntakeRecord = {
  intakeId: string;
  packageId: string;
  draftPackageId: string;
  status: string;
  workflowStatus: string;
  lifecycleState: string;
  authority: string;
  customerId?: string;
  customerName?: string;
  proposalId?: string;
  productId?: string;
  productName?: string;
  doctrineId?: string;
  packageRevision?: number;
  assignedEngineer?: string;
  commercialRevisionLocked?: boolean;
  submittedAt?: string;
  openedAt?: string;
  certifiedAt?: string;
  certifiedPackageId?: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
};

export type ExecutionAuthorizationCertificate = {
  certificateId: string;
  proposalId: string;
  draftIofPackageId: string;
  certifiedDraftIofPackageId?: string;
  technicalSourcePackageId?: string;
  certifiedIofPackageId: string;
  scopeVersionId?: string;
  engineeringApproverId: string;
  engineeringApprover: string;
  certificationTimestamp: string;
  engineeringChecklist: Record<string, unknown>;
  authorityTransfer: Record<string, unknown>;
  runtimeObjectCount: number;
  relationshipCount: number;
  evidenceCount: number;
  certificationConfidence: number;
  assemblyFingerprint: string;
  status: string;
  immutable: boolean;
  createdAt: string;
  updatedAt: string;
};

function apiUrl(path: string) {
  return `${DAL_API}${path}`;
}

export class TeralinxRuntimeRequestError extends Error {
  status: number;
  statusText: string;
  body: Record<string, unknown>;

  constructor(status: number, statusText: string, body: Record<string, unknown>, rawText: string) {
    super(String(body.error ?? `${status} ${statusText}${rawText ? `: ${rawText}` : ""}`));
    this.name = "TeralinxRuntimeRequestError";
    this.status = status;
    this.statusText = statusText;
    this.body = body;
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), init);
  const text = await response.text().catch(() => "");
  if (!response.ok) {
    let body: Record<string, unknown> = {};
    try {
      body = text ? JSON.parse(text) as Record<string, unknown> : {};
    } catch {
      body = {};
    }
    throw new TeralinxRuntimeRequestError(response.status, response.statusText, body, text);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

function authHeaders(session?: TeralinxAuthSession | null, headers: HeadersInit = {}) {
  if (!session?.token) return withStoredAuthHeaders(headers);
  return {
    ...headers,
    Authorization: `Bearer ${session.token}`,
  };
}

export async function downloadRuntimeArtifact(path: string, session?: TeralinxAuthSession | null) {
  const response = await fetch(apiUrl(path), { headers: authHeaders(session) });
  if (!response.ok) {
    const rawText = await response.text().catch(() => "");
    let body: Record<string, unknown> = {};
    try { body = rawText ? JSON.parse(rawText) as Record<string, unknown> : {}; } catch { body = {}; }
    throw new TeralinxRuntimeRequestError(response.status, response.statusText, body, rawText);
  }
  const disposition = response.headers.get("content-disposition") ?? "";
  const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1] ?? "Teralinx_Deliverable";
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = filename; anchor.style.display = "none";
  document.body.appendChild(anchor); anchor.click(); anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  return { filename, size: blob.size, contentType: blob.type, exportHash: response.headers.get("x-teralinx-export-hash") ?? "" };
}

export async function loadMarketplaceFulfillment<T>(scopeVersionId: string, session?: TeralinxAuthSession | null): Promise<T> {
  return requestJson<T>(`/api/marketplace/fulfillment/${encodeURIComponent(scopeVersionId)}`, { headers: authHeaders(session) });
}

export async function bootstrapMarketplaceFulfillment<T>(scopeVersionId: string, session?: TeralinxAuthSession | null): Promise<T> {
  return requestJson<T>(`/api/marketplace/fulfillment/${encodeURIComponent(scopeVersionId)}/bootstrap`, { method: "POST", headers: authHeaders(session) });
}

export async function createMarketplaceResponse<T>(scopeVersionId: string, input: Record<string, unknown>, session?: TeralinxAuthSession | null): Promise<T> {
  return requestJson<T>(`/api/marketplace/fulfillment/${encodeURIComponent(scopeVersionId)}/responses`, { method: "POST", headers: { ...authHeaders(session), "Content-Type": "application/json" }, body: JSON.stringify(input) });
}

export async function createMarketplaceAllocation<T>(scopeVersionId: string, input: Record<string, unknown>, session?: TeralinxAuthSession | null): Promise<T> {
  return requestJson<T>(`/api/marketplace/fulfillment/${encodeURIComponent(scopeVersionId)}/allocations`, { method: "POST", headers: { ...authHeaders(session), "Content-Type": "application/json" }, body: JSON.stringify(input) });
}

export async function createMarketplaceAward<T>(scopeVersionId: string, input: Record<string, unknown>, session?: TeralinxAuthSession | null): Promise<T> {
  return requestJson<T>(`/api/marketplace/fulfillment/${encodeURIComponent(scopeVersionId)}/awards`, { method: "POST", headers: { ...authHeaders(session), "Content-Type": "application/json" }, body: JSON.stringify(input) });
}

function unwrapList<T>(data: any, keys: string[]): T[] {
  const items = keys.map((key) => data?.[key]).find(Array.isArray) ?? data?.items ?? data?.data ?? data;
  return Array.isArray(items) ? items : [];
}

export const COMMERCIAL_ROUTE_REPOSITORY_ENDPOINT = "/api/commercial/routes";

export type CommercialRouteRepositoryDiagnostics = {
  endpointSelected?: string;
  endpointRegistered?: boolean;
  endpointUsed?: string;
  clientMethod?: string;
  repositoryIdentifier?: string;
  repositoryType?: string;
  persistenceResult?: string;
  restoreResult?: string;
  authoritySource?: string;
  recordCount?: number;
  noOsrmRegeneration?: boolean;
  noScopeVersionCreation?: boolean;
  noInventoryMutation?: boolean;
  [key: string]: unknown;
};

type CommercialRouteRepositoryClientMethod =
  | "listCommercialRoutes"
  | "loadCommercialRoute"
  | "saveCommercialRoute"
  | "verifyCommercialRoute";

function logCommercialRouteRepositoryDiagnostics(action: string, data: any) {
  const diagnostics = data?.routeRepositoryDiagnostics as CommercialRouteRepositoryDiagnostics | undefined;
  if (!diagnostics) return;
  runtimeDiagnosticsLog("CommercialRouteRepository", {
    action,
    endpointSelected: diagnostics.endpointSelected,
    endpointRegistered: diagnostics.endpointRegistered,
    endpointUsed: diagnostics.endpointUsed,
    clientMethod: diagnostics.clientMethod,
    repositoryIdentifier: diagnostics.repositoryIdentifier,
    persistenceResult: diagnostics.persistenceResult,
    restoreResult: diagnostics.restoreResult,
    authoritySource: diagnostics.authoritySource,
    recordCount: diagnostics.recordCount,
  });
}

function commercialRouteRepositoryHeaders(
  clientMethod: CommercialRouteRepositoryClientMethod,
  session?: TeralinxAuthSession | null,
  headers: Record<string, string> = {},
) {
  return authHeaders(session, {
    ...headers,
    "X-Teralinx-Route-Client-Method": clientMethod,
    "X-Teralinx-Route-Endpoint": COMMERCIAL_ROUTE_REPOSITORY_ENDPOINT,
  });
}

async function commercialRouteRepositoryRequest<T>(
  clientMethod: CommercialRouteRepositoryClientMethod,
  pathSuffix = "",
  session?: TeralinxAuthSession | null,
  init: Omit<RequestInit, "headers"> & { headers?: Record<string, string> } = {},
) {
  const endpointUsed = `${COMMERCIAL_ROUTE_REPOSITORY_ENDPOINT}${pathSuffix}`;
  runtimeDiagnosticsLog("CommercialRouteRepositoryClient", {
    clientMethod,
    endpointUsed,
    endpointSelected: COMMERCIAL_ROUTE_REPOSITORY_ENDPOINT,
  });
  const data = await requestJson<any>(endpointUsed, {
    ...init,
    headers: commercialRouteRepositoryHeaders(clientMethod, session, init.headers ?? {}),
  });
  logCommercialRouteRepositoryDiagnostics(clientMethod, data);
  return data as T;
}

export async function loginTeralinxUser(username: string, password: string) {
  return requestJson<TeralinxAuthSession>("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
}

export async function loadTeralinxRuntimeInfo() {
  return requestJson<TeralinxRuntimeInfo>("/api/runtime");
}

export async function loadRuntimeRehydration(session?: TeralinxAuthSession | null) {
  return requestJson<RuntimeRehydrationState>("/api/runtime/rehydrate", {
    headers: authHeaders(session),
  });
}

export async function saveRuntimeWorkspaceSession(input: Partial<RuntimeWorkspaceSession>, session?: TeralinxAuthSession | null) {
  const data = await requestJson<any>("/api/runtime/workspace-session", {
    method: "POST",
    headers: authHeaders(session, { "Content-Type": "application/json" }),
    body: JSON.stringify({ workspaceSession: input }),
  });
  return (data.workspaceSession ?? data.session ?? data) as RuntimeWorkspaceSession;
}

export async function listTeralinxActivity() {
  const data = await requestJson<any>("/api/activity");
  return unwrapList<TeralinxActivityEvent>(data, ["activity", "events"]).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export async function appendTeralinxActivity(session: TeralinxAuthSession, input: TeralinxActivityInput) {
  const timestamp = input.timestamp ?? new Date().toISOString();
  const event = {
    ...input,
    activityId: `activity-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    userId: session.user.userId,
    userName: session.user.name,
    userRole: session.user.role,
    timestamp,
  };
  const data = await requestJson<any>("/api/activity", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.token}`,
    },
    body: JSON.stringify({ activityEvent: event }),
  });
  return (data.activityEvent ?? data) as TeralinxActivityEvent;
}

export async function listCommercialOpportunities<T>(session?: TeralinxAuthSession | null) {
  const data = await requestJson<any>("/api/commercial/opportunities", {
    headers: authHeaders(session),
  });
  return unwrapList<T>(data, ["opportunities", "commercialOpportunities"]);
}

export async function saveCommercialOpportunity<T extends { opportunityId: string }>(record: T, session?: TeralinxAuthSession | null) {
  const data = await requestJson<any>("/api/commercial/opportunities", {
    method: "POST",
    headers: authHeaders(session, { "Content-Type": "application/json" }),
    body: JSON.stringify({ opportunity: record }),
  });
  return (data.opportunity ?? data) as T;
}

export async function openCommercialOpportunity<T>(opportunityId: string, session?: TeralinxAuthSession | null) {
  const data = await requestJson<any>(`/api/commercial/opportunities/${encodeURIComponent(opportunityId)}/open`, {
    method: "POST",
    headers: authHeaders(session, { "Content-Type": "application/json" }),
  });
  return (data.opportunity ?? data) as T;
}

export async function listCommercialRoutes<T>(session?: TeralinxAuthSession | null) {
  const data = await commercialRouteRepositoryRequest<any>("listCommercialRoutes", "", session);
  return unwrapList<T>(data, ["commercialRoutes", "routes"]);
}

export async function loadCommercialRoute<T>(routeRepositoryId: string, session?: TeralinxAuthSession | null) {
  const data = await commercialRouteRepositoryRequest<any>("loadCommercialRoute", `/${encodeURIComponent(routeRepositoryId)}`, session);
  return (data.commercialRoute ?? data.route ?? data) as T;
}

export async function saveCommercialRoute<T extends { routeRepositoryId: string }>(record: T, session?: TeralinxAuthSession | null) {
  const data = await commercialRouteRepositoryRequest<any>("saveCommercialRoute", "", session, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ commercialRoute: record }),
  });
  return (data.commercialRoute ?? data.route ?? data) as T;
}

export async function verifyCommercialRoute<T extends { routeRepositoryId: string; geometryHash?: string }>(
  routeRepositoryId: string,
  expected: { geometryHash?: string } = {},
  session?: TeralinxAuthSession | null,
) {
  const data = await commercialRouteRepositoryRequest<any>("verifyCommercialRoute", `/${encodeURIComponent(routeRepositoryId)}`, session);
  const route = (data.commercialRoute ?? data.route ?? data) as T;
  if (expected.geometryHash && route.geometryHash && route.geometryHash !== expected.geometryHash) {
    throw new Error(`Commercial Route Repository verification failed. Expected geometry hash ${expected.geometryHash}; found ${route.geometryHash}.`);
  }
  runtimeDiagnosticsLog("CommercialRouteRepositoryClient", {
    clientMethod: "verifyCommercialRoute",
    endpointUsed: `${COMMERCIAL_ROUTE_REPOSITORY_ENDPOINT}/${routeRepositoryId}`,
    repositoryIdentifier: routeRepositoryId,
    verificationResult: "PASS",
  });
  return route;
}

export async function listCommercialRevisions(session?: TeralinxAuthSession | null) {
  const data = await requestJson<any>("/api/commercial/revisions", {
    headers: authHeaders(session),
  });
  return unwrapList<CommercialRevisionRuntime>(data, ["commercialRevisions", "items", "data"]);
}

export async function openCommercialRevision(commercialRevisionId: string, session?: TeralinxAuthSession | null) {
  const data = await requestJson<any>(`/api/commercial/revisions/${encodeURIComponent(commercialRevisionId)}`, {
    headers: authHeaders(session),
  });
  return (data.commercialRevision ?? data) as CommercialRevisionRuntime;
}

export async function saveCommercialRevision(
  commercialRevision: Partial<CommercialRevisionRuntime>,
  session?: TeralinxAuthSession | null,
) {
  const data = await requestJson<any>("/api/commercial/revisions", {
    method: "POST",
    headers: authHeaders(session, { "Content-Type": "application/json" }),
    body: JSON.stringify({ commercialRevision }),
  });
  return (data.commercialRevision ?? data) as CommercialRevisionRuntime;
}

export async function listCommercialReleasePackages(session?: TeralinxAuthSession | null) {
  const data = await requestJson<any>("/api/commercial/release-packages", {
    headers: authHeaders(session),
  });
  return unwrapList<CommercialReleasePackageRuntime>(data, ["commercialReleasePackages", "items", "data"]);
}

export async function openCommercialReleasePackage(commercialReleasePackageId: string, session?: TeralinxAuthSession | null) {
  const data = await requestJson<any>(`/api/commercial/release-packages/${encodeURIComponent(commercialReleasePackageId)}`, {
    headers: authHeaders(session),
  });
  return (data.commercialReleasePackage ?? data) as CommercialReleasePackageRuntime;
}

export async function saveCommercialReleasePackage(
  commercialReleasePackage: Partial<CommercialReleasePackageRuntime>,
  session?: TeralinxAuthSession | null,
) {
  const data = await requestJson<any>("/api/commercial/release-packages", {
    method: "POST",
    headers: authHeaders(session, { "Content-Type": "application/json" }),
    body: JSON.stringify({ commercialReleasePackage }),
  });
  return (data.commercialReleasePackage ?? data) as CommercialReleasePackageRuntime;
}

export async function listCommercialChangeSets(session?: TeralinxAuthSession | null) {
  const data = await requestJson<any>("/api/commercial/change-sets", {
    headers: authHeaders(session),
  });
  return unwrapList<CommercialChangeSetRuntime>(data, ["commercialChangeSets", "items", "data"]);
}

export async function openCommercialChangeSet(changeSetId: string, session?: TeralinxAuthSession | null) {
  const data = await requestJson<any>(`/api/commercial/change-sets/${encodeURIComponent(changeSetId)}`, {
    headers: authHeaders(session),
  });
  return (data.commercialChangeSet ?? data) as CommercialChangeSetRuntime;
}

export async function saveCommercialChangeSet(
  commercialChangeSet: Partial<CommercialChangeSetRuntime>,
  session?: TeralinxAuthSession | null,
) {
  const data = await requestJson<any>("/api/commercial/change-sets", {
    method: "POST",
    headers: authHeaders(session, { "Content-Type": "application/json" }),
    body: JSON.stringify({ commercialChangeSet }),
  });
  return (data.commercialChangeSet ?? data) as CommercialChangeSetRuntime;
}

export async function replayCommercialRevision(revisionId: string, session?: TeralinxAuthSession | null) {
  const data = await requestJson<any>(`/api/commercial/change-sets/${encodeURIComponent(revisionId)}/replay`, {
    method: "POST",
    headers: authHeaders(session, { "Content-Type": "application/json" }),
  });
  return (data.replay ?? data.projection ?? data) as CommercialRevisionProjectionRuntime;
}

export async function compareCommercialRevision(revisionId: string, session?: TeralinxAuthSession | null) {
  const data = await requestJson<any>(`/api/commercial/change-sets/${encodeURIComponent(revisionId)}/compare`, {
    method: "POST",
    headers: authHeaders(session, { "Content-Type": "application/json" }),
  });
  return data.comparison ?? data;
}

export async function discardCommercialRevision(revisionIdOrChangeSetId: string, session?: TeralinxAuthSession | null) {
  const data = await requestJson<any>(`/api/commercial/change-sets/${encodeURIComponent(revisionIdOrChangeSetId)}/discard`, {
    method: "POST",
    headers: authHeaders(session, { "Content-Type": "application/json" }),
  });
  return data.commercialChangeSet ?? data.commercialChangeSets ?? data;
}

export async function restoreOriginalCommercialRevision(revisionId: string, session?: TeralinxAuthSession | null) {
  const data = await requestJson<any>(`/api/commercial/change-sets/${encodeURIComponent(revisionId)}/restore-original`, {
    method: "POST",
    headers: authHeaders(session, { "Content-Type": "application/json" }),
  });
  return data.commercialChangeSets ?? data;
}

export async function listEngineeringChangeSets(session?: TeralinxAuthSession | null) {
  const data = await requestJson<any>("/api/engineering/change-sets", {
    headers: authHeaders(session),
  });
  return unwrapList<EngineeringChangeSetRuntime>(data, ["engineeringChangeSets", "items", "data"]);
}

export async function openEngineeringChangeSet(changeSetId: string, session?: TeralinxAuthSession | null) {
  const data = await requestJson<any>(`/api/engineering/change-sets/${encodeURIComponent(changeSetId)}`, {
    headers: authHeaders(session),
  });
  return (data.engineeringChangeSet ?? data) as EngineeringChangeSetRuntime;
}

export async function saveEngineeringChangeSet(
  engineeringChangeSet: Partial<EngineeringChangeSetRuntime>,
  session?: TeralinxAuthSession | null,
) {
  const data = await requestJson<any>("/api/engineering/change-sets", {
    method: "POST",
    headers: authHeaders(session, { "Content-Type": "application/json" }),
    body: JSON.stringify({ engineeringChangeSet }),
  });
  return (data.engineeringChangeSet ?? data) as EngineeringChangeSetRuntime;
}

export async function replayEngineeringRevision(revisionId: string, session?: TeralinxAuthSession | null) {
  const data = await requestJson<any>(`/api/engineering/change-sets/${encodeURIComponent(revisionId)}/replay`, {
    method: "POST",
    headers: authHeaders(session, { "Content-Type": "application/json" }),
  });
  return (data.replay ?? data.projection ?? data) as EngineeringRevisionProjectionRuntime;
}

export async function compareEngineeringRevision(revisionId: string, session?: TeralinxAuthSession | null) {
  const data = await requestJson<any>(`/api/engineering/change-sets/${encodeURIComponent(revisionId)}/compare`, {
    method: "POST",
    headers: authHeaders(session, { "Content-Type": "application/json" }),
  });
  return data.comparison ?? data;
}

export async function discardEngineeringRevision(revisionIdOrChangeSetId: string, session?: TeralinxAuthSession | null) {
  const data = await requestJson<any>(`/api/engineering/change-sets/${encodeURIComponent(revisionIdOrChangeSetId)}/discard`, {
    method: "POST",
    headers: authHeaders(session, { "Content-Type": "application/json" }),
  });
  return data.engineeringChangeSet ?? data.engineeringChangeSets ?? data;
}

export async function restoreOriginalEngineeringRevision(revisionId: string, session?: TeralinxAuthSession | null) {
  const data = await requestJson<any>(`/api/engineering/change-sets/${encodeURIComponent(revisionId)}/restore-original`, {
    method: "POST",
    headers: authHeaders(session, { "Content-Type": "application/json" }),
  });
  return data.engineeringChangeSets ?? data;
}

export async function cloneCommercialOpportunity<T>(opportunityId: string, session?: TeralinxAuthSession | null) {
  const data = await requestJson<any>(`/api/commercial/opportunities/${encodeURIComponent(opportunityId)}/clone`, {
    method: "POST",
    headers: authHeaders(session, { "Content-Type": "application/json" }),
  });
  return (data.opportunity ?? data) as T;
}

export async function archiveCommercialOpportunity<T>(opportunityId: string, session?: TeralinxAuthSession | null) {
  const data = await requestJson<any>(`/api/commercial/opportunities/${encodeURIComponent(opportunityId)}/archive`, {
    method: "POST",
    headers: authHeaders(session, { "Content-Type": "application/json" }),
  });
  return (data.opportunity ?? data) as T;
}

export async function shareCommercialOpportunity<T>(
  opportunityId: string,
  input: { userId?: string; username?: string; targetUserIds?: string[]; role?: "contributors" | "reviewers" | "approvers" | "executives" },
  session?: TeralinxAuthSession | null,
) {
  const data = await requestJson<any>(`/api/commercial/opportunities/${encodeURIComponent(opportunityId)}/share`, {
    method: "POST",
    headers: authHeaders(session, { "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  return (data.opportunity ?? data) as T;
}

export async function assignCommercialOpportunity<T>(
  opportunityId: string,
  input: { assignedTo?: string[]; contributors?: string[]; reviewers?: string[]; approvers?: string[]; executives?: string[] },
  session?: TeralinxAuthSession | null,
) {
  const data = await requestJson<any>(`/api/commercial/opportunities/${encodeURIComponent(opportunityId)}/assign`, {
    method: "POST",
    headers: authHeaders(session, { "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  return (data.opportunity ?? data) as T;
}

export async function listEngineeringDrafts<T>() {
  const data = await requestJson<any>("/api/engineering/drafts", {
    headers: authHeaders(),
  });
  return unwrapList<T>(data, ["engineeringDrafts", "drafts"]);
}

export async function saveEngineeringDraft<T extends { engineeringDraftId: string }>(record: T) {
  const data = await requestJson<any>("/api/engineering/drafts", {
    method: "POST",
    headers: authHeaders(null, { "Content-Type": "application/json" }),
    body: JSON.stringify({ engineeringDraft: record }),
  });
  return (data.engineeringDraft ?? data) as T;
}

export async function listProposalDrafts<T>(session?: TeralinxAuthSession | null) {
  const data = await requestJson<any>("/api/proposals", {
    headers: authHeaders(session),
  });
  return unwrapList<T>(data, ["proposals", "proposalDrafts"]);
}

export async function saveProposalDraft<T extends { proposalRecordId?: string; proposalId?: string }>(record: T, session?: TeralinxAuthSession | null) {
  const data = await requestJson<any>("/api/proposals", {
    method: "POST",
    headers: authHeaders(session, { "Content-Type": "application/json" }),
    body: JSON.stringify({ proposal: record }),
  });
  return (data.proposal ?? data) as T;
}

export async function listProposalRuntimeObjects<T extends ProposalRuntimeObject = ProposalRuntimeObject>(session?: TeralinxAuthSession | null) {
  return listProposalDrafts<T>(session);
}

async function proposalAction<T>(proposalId: string, action: string, body?: unknown, session?: TeralinxAuthSession | null) {
  const init: RequestInit = {
    method: "POST",
    headers: authHeaders(session, { "Content-Type": "application/json" }),
  };
  if (body !== undefined) init.body = JSON.stringify(body);
  const data = await requestJson<any>(`/api/proposals/${encodeURIComponent(proposalId)}/${action}`, init);
  return (data.proposal ?? data) as T;
}

export async function openProposalRuntimeObject<T extends ProposalRuntimeObject = ProposalRuntimeObject>(proposalId: string, session?: TeralinxAuthSession | null) {
  return proposalAction<T>(proposalId, "open", undefined, session);
}

export async function assignProposalRuntimeObject<T extends ProposalRuntimeObject = ProposalRuntimeObject>(
  proposalId: string,
  input: ProposalCustomerRecipientInput & {
    assignedTo?: string[];
    contributors?: string[];
    reviewers?: string[];
    approvers?: string[];
    executives?: string[];
    salesEngineering?: string[];
  },
  session?: TeralinxAuthSession | null,
) {
  return proposalAction<T>(proposalId, "assign", input, session);
}

export async function submitProposalToCustomer<T extends ProposalRuntimeObject = ProposalRuntimeObject>(
  proposalId: string,
  input: ProposalCustomerRecipientInput = {},
  session?: TeralinxAuthSession | null,
) {
  return proposalAction<T>(proposalId, "submit-customer", input, session);
}

export async function withdrawProposalRuntimeObject<T extends ProposalRuntimeObject = ProposalRuntimeObject>(proposalId: string, session?: TeralinxAuthSession | null) {
  return proposalAction<T>(proposalId, "withdraw", undefined, session);
}

export async function duplicateProposalRuntimeObject<T extends ProposalRuntimeObject = ProposalRuntimeObject>(proposalId: string, session?: TeralinxAuthSession | null) {
  return proposalAction<T>(proposalId, "duplicate", undefined, session);
}

export async function archiveProposalRuntimeObject<T extends ProposalRuntimeObject = ProposalRuntimeObject>(proposalId: string, session?: TeralinxAuthSession | null) {
  return proposalAction<T>(proposalId, "archive", undefined, session);
}

export async function createProposalRevision<T extends ProposalRuntimeObject = ProposalRuntimeObject>(
  proposalId: string,
  input: { reason?: string; basisProposalRevisionId?: string; proposal?: Partial<T>; changes?: Record<string, unknown> } = {},
  session?: TeralinxAuthSession | null,
) {
  return proposalAction<T>(proposalId, "revision", input, session);
}

export async function commentProposalRuntimeObject<T extends ProposalRuntimeObject = ProposalRuntimeObject>(
  proposalId: string,
  input: { comment?: string; text?: string; visibility?: string },
  session?: TeralinxAuthSession | null,
) {
  return proposalAction<T>(proposalId, "comment", input, session);
}

export async function uploadProposalEvidence<T extends ProposalRuntimeObject = ProposalRuntimeObject>(
  proposalId: string,
  input: { evidenceId?: string; sourceName?: string; fileName?: string; name?: string; sourceType?: string; metadata?: Record<string, unknown> },
  session?: TeralinxAuthSession | null,
) {
  const data = await requestJson<any>(`/api/proposals/${encodeURIComponent(proposalId)}/upload-evidence`, {
    method: "POST",
    headers: authHeaders(session, { "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  return { proposal: (data.proposal ?? data) as T, evidence: data.evidence };
}

export async function requestProposalChanges<T extends ProposalRuntimeObject = ProposalRuntimeObject>(
  proposalId: string,
  input: { comment?: string; reason?: string; text?: string },
  session?: TeralinxAuthSession | null,
) {
  return proposalAction<T>(proposalId, "request-changes", input, session);
}

export async function approveProposalRuntimeObject<T extends ProposalRuntimeObject = ProposalRuntimeObject>(
  proposalId: string,
  input: { comment?: string } = {},
  session?: TeralinxAuthSession | null,
) {
  return proposalAction<T>(proposalId, "approve", input, session);
}

export async function rejectProposalRuntimeObject<T extends ProposalRuntimeObject = ProposalRuntimeObject>(
  proposalId: string,
  input: { comment?: string; reason?: string } = {},
  session?: TeralinxAuthSession | null,
) {
  return proposalAction<T>(proposalId, "reject", input, session);
}

export async function getProposalReadiness(proposalId: string, session?: TeralinxAuthSession | null) {
  const data = await requestJson<any>(`/api/proposals/${encodeURIComponent(proposalId)}/readiness`, {
    headers: authHeaders(session),
  });
  return {
    readiness: data.readiness as ProposalReadiness,
    proposal: data.proposal as ProposalRuntimeObject,
  };
}

export async function createDraftIofPackageFromProposal(proposalId: string, session?: TeralinxAuthSession | null) {
  return requestJson<{
    ready: boolean;
    readiness: ProposalReadiness;
    draftIofPackageSource: Record<string, unknown>;
    proposal: ProposalRuntimeObject;
  }>(`/api/proposals/${encodeURIComponent(proposalId)}/create-draft-iof-package`, {
    method: "POST",
    headers: authHeaders(session, { "Content-Type": "application/json" }),
  });
}

export async function advanceRuntimeLifecycleBridge(
  input: Record<string, unknown>,
  session?: TeralinxAuthSession | null,
) {
  return requestJson<RuntimeLifecycleBridgeResult>("/api/runtime/lifecycle/advance", {
    method: "POST",
    headers: authHeaders(session, { "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
}

export async function listEngineeringReviewQueue(session?: TeralinxAuthSession | null) {
  const data = await requestJson<any>("/api/engineering/certification/queue", {
    headers: authHeaders(session),
  });
  return unwrapList<EngineeringReviewQueueItem>(data, ["engineeringReviewQueue", "queue", "items"]);
}

export async function listEngineeringPackages(session?: TeralinxAuthSession | null) {
  const data = await requestJson<any>("/api/engineering/packages", {
    headers: authHeaders(session),
  });
  return unwrapList<EngineeringPackageRuntime>(data, ["engineeringPackages", "items", "data"]);
}

export async function listEngineeringBaselines(session?: TeralinxAuthSession | null) {
  const data = await requestJson<any>("/api/engineering/baselines", {
    headers: authHeaders(session),
  });
  return unwrapList<EngineeringBaselineRuntime>(data, ["engineeringBaselines", "items", "data"]);
}

export async function openEngineeringBaseline(engineeringBaselineId: string, session?: TeralinxAuthSession | null) {
  const data = await requestJson<any>(`/api/engineering/baselines/${encodeURIComponent(engineeringBaselineId)}`, {
    headers: authHeaders(session),
  });
  return (data.engineeringBaseline ?? data) as EngineeringBaselineRuntime;
}

export async function saveEngineeringBaseline(
  engineeringBaseline: Partial<EngineeringBaselineRuntime>,
  session?: TeralinxAuthSession | null,
) {
  const data = await requestJson<any>("/api/engineering/baselines", {
    method: "POST",
    headers: authHeaders(session, { "Content-Type": "application/json" }),
    body: JSON.stringify({ engineeringBaseline }),
  });
  return (data.engineeringBaseline ?? data) as EngineeringBaselineRuntime;
}

export async function openEngineeringPackage(engineeringPackageId: string, session?: TeralinxAuthSession | null) {
  const data = await requestJson<any>(`/api/engineering/packages/${encodeURIComponent(engineeringPackageId)}`, {
    headers: authHeaders(session),
  });
  return (data.engineeringPackage ?? data) as EngineeringPackageRuntime;
}

export async function saveEngineeringPackage(
  engineeringPackage: Partial<EngineeringPackageRuntime>,
  session?: TeralinxAuthSession | null,
) {
  const data = await requestJson<any>("/api/engineering/packages", {
    method: "POST",
    headers: authHeaders(session, { "Content-Type": "application/json" }),
    body: JSON.stringify({ engineeringPackage }),
  });
  return (data.engineeringPackage ?? data) as EngineeringPackageRuntime;
}

export async function listDraftIofPackagesForCertification(session?: TeralinxAuthSession | null) {
  const data = await requestJson<any>("/api/engineering/certification/draft-packages", {
    headers: authHeaders(session),
  });
  return unwrapList<DraftIofPackageRuntime>(data, ["draftPackages", "iofPackages", "items"]);
}

export async function assembleDraftIofPackageFromProposal(
  input: { proposalId: string; packageId?: string; assignedEngineerId?: string; assignedEngineer?: string; priority?: string },
  session?: TeralinxAuthSession | null,
) {
  const data = await requestJson<any>("/api/engineering/certification/draft-packages/from-proposal", {
    method: "POST",
    headers: authHeaders(session, { "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  return (data.draftPackage ?? data.iofPackage ?? data) as DraftIofPackageRuntime;
}

export async function saveCommercialDraftIofPackage(
  draftPackage: DraftIofPackageRuntime,
  session?: TeralinxAuthSession | null,
) {
  const initialReferenceOnlyDraftPackage = draftIofPackageRecordForRepository(draftPackage);
  const draft = draftPackage as Record<string, unknown>;
  const artifactPersistenceDraftPackage = {
    ...initialReferenceOnlyDraftPackage,
    engineeringObjectManifest: draft.engineeringObjectManifest ?? draft.doctrineObjectManifest,
    stationProjection: draft.stationProjection,
    stationGraph: draft.stationGraph ?? draft.stationIndexedGraph,
    stationObjectManifest: draft.stationObjectManifest,
    measuredCenterline: draft.measuredCenterline ?? draft.measuredSpine,
    projectedObjectManifest: draft.projectedObjectManifest,
    closureLedger: draft.closureLedger,
    iofPackageTwin: draft.iofPackageTwin ?? draft.iofTwin,
    productDoctrineAssembly: draft.productDoctrineAssembly ?? draft.doctrineAssembly,
    projectConfiguration: draft.projectConfiguration,
    quantityReconciliation: draft.quantityReconciliation ?? draft.commercialAuditReconciliation,
  };
  const artifactData = await requestJson<any>(`/api/commercial/iof-packages/${encodeURIComponent(draftPackage.packageId)}/artifacts`, {
    method: "POST",
    headers: authHeaders(session, { "Content-Type": "application/json" }),
    body: JSON.stringify({ draftPackage: artifactPersistenceDraftPackage }),
  });
  const referenceOnlyDraftPackage = draftIofPackageRecordForRepository({
    ...draftPackage,
    ...(artifactData.authorityBindings ?? {}),
    iofArtifactRepositoryReferences: artifactData.artifactReferences ?? {},
  } as DraftIofPackageRuntime);
  const payloadAudit = draftIofSavePayloadSizeAudit(draftPackage, referenceOnlyDraftPackage);
  console.info("[Draft IOF Save] payload size audit", payloadAudit);
  if (payloadAudit.offendingField) {
    console.warn("[Draft IOF Save] large embedded source field stripped before serialization", {
      offendingField: payloadAudit.offendingField,
      largestFields: payloadAudit.largestFields,
      referenceOnlyBytes: payloadAudit.referenceOnlyBytes,
    });
  }
  let body: string;
  try {
    body = JSON.stringify({ draftPackage: referenceOnlyDraftPackage });
  } catch (error) {
    throw new Error(`Draft IOF reference-only save serialization failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  const data = await requestJson<any>("/api/commercial/iof-packages", {
    method: "POST",
    headers: authHeaders(session, { "Content-Type": "application/json" }),
    body,
  });
  return (data.draftPackage ?? data.iofPackage ?? data) as DraftIofPackageRuntime;
}

export async function listCommercialDraftIofPackages(session?: TeralinxAuthSession | null) {
  const data = await requestJson<any>("/api/commercial/iof-packages", {
    headers: authHeaders(session),
  });
  return unwrapList<DraftIofPackageRuntime>(data, ["draftPackages", "iofPackages", "items", "data"]);
}

export async function submitDraftIofPackageToEngineering(
  packageId: string,
  _input: { draftPackage?: DraftIofPackageRuntime } = {},
  session?: TeralinxAuthSession | null,
) {
  const transactionRequest = {
    packageId,
    draftIOFPackageId: packageId,
    transactionType: "COMMERCIAL_TO_ENGINEERING_HANDOFF",
    referenceOnly: true,
  };
  return requestJson<{
    draftPackage: DraftIofPackageRuntime;
    iofPackage: DraftIofPackageRuntime;
    engineeringIntake: EngineeringIntakeRecord;
    engineeringBaseline: EngineeringBaselineRuntime;
    engineeringPackage: EngineeringPackageRuntime;
    commercialOpportunity?: Record<string, unknown> | null;
    proposal?: ProposalRuntimeObject | null;
    engineeringTransactionLog?: Record<string, unknown>[];
  }>(`/api/commercial/iof-packages/${encodeURIComponent(packageId)}/submit-engineering`, {
    method: "POST",
    headers: authHeaders(session, { "Content-Type": "application/json" }),
    body: JSON.stringify(transactionRequest),
  });
}

export async function openDraftIofPackageForCertification(packageId: string, session?: TeralinxAuthSession | null) {
  const data = await requestJson<any>(`/api/engineering/certification/draft-packages/${encodeURIComponent(packageId)}`, {
    headers: authHeaders(session),
  });
  return (data.draftPackage ?? data.iofPackage ?? data) as DraftIofPackageRuntime;
}

export async function assignDraftIofPackageEngineer(
  packageId: string,
  input: { assignedEngineerId?: string; assignedEngineer?: string; engineerId?: string; engineerName?: string } = {},
  session?: TeralinxAuthSession | null,
) {
  const data = await requestJson<any>(`/api/engineering/certification/draft-packages/${encodeURIComponent(packageId)}/assign-engineer`, {
    method: "POST",
    headers: authHeaders(session, { "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  return (data.draftPackage ?? data.iofPackage ?? data) as DraftIofPackageRuntime;
}

export async function getDraftIofPackageManifest(packageId: string, session?: TeralinxAuthSession | null) {
  const data = await requestJson<any>(`/api/engineering/certification/draft-packages/${encodeURIComponent(packageId)}/manifest`, {
    headers: authHeaders(session),
  });
  return data.manifest as IofPackageManifest;
}

export async function getDraftIofPackageGraph(packageId: string, session?: TeralinxAuthSession | null) {
  const data = await requestJson<any>(`/api/engineering/certification/draft-packages/${encodeURIComponent(packageId)}/graph`, {
    headers: authHeaders(session),
  });
  return data.dependencyGraph as IofPackageDependencyGraph;
}

export async function getDraftIofPackageReadiness(packageId: string, session?: TeralinxAuthSession | null) {
  return requestJson<{ packageReadiness: Record<string, unknown>; validation: IofPackageValidation; draftPackage: DraftIofPackageRuntime }>(
    `/api/engineering/certification/draft-packages/${encodeURIComponent(packageId)}/readiness`,
    { headers: authHeaders(session) },
  );
}

export async function getDraftIofPackageDifferences(packageId: string, session?: TeralinxAuthSession | null) {
  const data = await requestJson<any>(`/api/engineering/certification/draft-packages/${encodeURIComponent(packageId)}/differences`, {
    headers: authHeaders(session),
  });
  return data.packageDifferences as IofPackageDifferences;
}

export async function addEngineeringCertificationConstraint(
  packageId: string,
  input: {
    conditionTitle?: string;
    humanClassification?: string;
    humanSeverity?: string;
    category: string;
    station?: string;
    stationRange?: string;
    objectReference?: string;
    severity?: string;
    status?: string;
    engineeringDisposition?: string;
    notesEvidence?: string;
    conditionContext?: Record<string, unknown>;
  },
  session?: TeralinxAuthSession | null,
) {
  const data = await requestJson<any>(`/api/engineering/certification/draft-packages/${encodeURIComponent(packageId)}/constraints`, {
    method: "POST",
    headers: authHeaders(session, { "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  return data as { packageId: string; updatedAt: string; engineeringConstraints: Record<string, unknown>[]; constraint: Record<string, unknown>; metadataPatchOnly: true };
}

export async function dispositionEngineeringCertificationConstraint(
  packageId: string,
  constraintId: string,
  input: {
    status: "OPEN" | "IN_REVIEW" | "RESOLVED" | "ACCEPTED";
    disposition: string;
    reason: string;
    impactSummary?: string;
    notesEvidence?: string;
  },
  session?: TeralinxAuthSession | null,
) {
  const data = await requestJson<any>(`/api/engineering/certification/draft-packages/${encodeURIComponent(packageId)}/constraints/${encodeURIComponent(constraintId)}/disposition`, {
    method: "POST",
    headers: authHeaders(session, { "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  return data as { packageId: string; updatedAt: string; engineeringConstraints: Record<string, unknown>[]; constraint: Record<string, unknown>; previousConstraint: Record<string, unknown>; metadataPatchOnly: true };
}

export async function moveEngineeringCertificationObject(
  packageId: string,
  input: {
    objectId: string;
    newStation: string;
    reason: string;
    authority: string;
    impactSummary?: string;
  },
  session?: TeralinxAuthSession | null,
) {
  const data = await requestJson<any>(`/api/engineering/certification/draft-packages/${encodeURIComponent(packageId)}/object-moves`, {
    method: "POST",
    headers: authHeaders(session, { "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  return (data.draftPackage ?? data.iofPackage ?? data) as DraftIofPackageRuntime;
}

export async function createEngineeringCertificationRouteRedline(
  packageId: string,
  input: {
    reason: string;
    description?: string;
    authority: string;
    affectedStations?: string;
    impactSummary?: string;
  },
  session?: TeralinxAuthSession | null,
) {
  const data = await requestJson<any>(`/api/engineering/certification/draft-packages/${encodeURIComponent(packageId)}/route-redlines`, {
    method: "POST",
    headers: authHeaders(session, { "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  return (data.draftPackage ?? data.iofPackage ?? data) as DraftIofPackageRuntime;
}

export async function recordEngineeringDoctrineException(
  packageId: string,
  input: {
    doctrineRule: string;
    actualCondition: string;
    reason: string;
    approvalAuthority: string;
    impactSummary: string;
  },
  session?: TeralinxAuthSession | null,
) {
  const data = await requestJson<any>(`/api/engineering/certification/draft-packages/${encodeURIComponent(packageId)}/doctrine-exceptions`, {
    method: "POST",
    headers: authHeaders(session, { "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  return (data.draftPackage ?? data.iofPackage ?? data) as DraftIofPackageRuntime;
}

async function engineeringUnitAction(
  packageId: string,
  unitId: string,
  action: "certify" | "modify" | "reject" | "split" | "merge",
  input: Record<string, unknown> = {},
  session?: TeralinxAuthSession | null,
) {
  const data = await requestJson<any>(`/api/engineering/certification/draft-packages/${encodeURIComponent(packageId)}/units/${encodeURIComponent(unitId)}/${action}`, {
    method: "POST",
    headers: authHeaders(session, { "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  return {
    iofPackage: (data.draftPackage ?? data.iofPackage ?? data) as DraftIofPackageRuntime,
    unit: data.unit as ProposedIofUnit | undefined,
  };
}

export async function certifyIofUnit(
  packageId: string,
  unitId: string,
  input: { engineeringNote?: string; engineeringConfidence?: number; engineeringRisk?: string; engineeringComments?: string[] } = {},
  session?: TeralinxAuthSession | null,
) {
  return engineeringUnitAction(packageId, unitId, "certify", input, session);
}

export async function modifyIofUnit(
  packageId: string,
  unitId: string,
  input: { unit?: Partial<ProposedIofUnit>; engineeringComments?: string[] },
  session?: TeralinxAuthSession | null,
) {
  return engineeringUnitAction(packageId, unitId, "modify", input as Record<string, unknown>, session);
}

export async function rejectIofUnit(
  packageId: string,
  unitId: string,
  input: { reason?: string; engineeringRisk?: string } = {},
  session?: TeralinxAuthSession | null,
) {
  return engineeringUnitAction(packageId, unitId, "reject", input, session);
}

export async function splitIofUnit(
  packageId: string,
  unitId: string,
  input: { units?: Partial<ProposedIofUnit>[] } = {},
  session?: TeralinxAuthSession | null,
) {
  return engineeringUnitAction(packageId, unitId, "split", input as Record<string, unknown>, session);
}

export async function mergeIofUnits(
  packageId: string,
  unitId: string,
  input: { mergeUnitIds?: string[]; unitId?: string; name?: string } = {},
  session?: TeralinxAuthSession | null,
) {
  return engineeringUnitAction(packageId, unitId, "merge", input as Record<string, unknown>, session);
}

export async function returnDraftIofPackageToCommercial(
  packageId: string,
  input: { reason?: string } = {},
  session?: TeralinxAuthSession | null,
) {
  const data = await requestJson<any>(`/api/engineering/certification/draft-packages/${encodeURIComponent(packageId)}/return-commercial`, {
    method: "POST",
    headers: authHeaders(session, { "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  return (data.draftPackage ?? data.iofPackage ?? data) as DraftIofPackageRuntime;
}

export async function certifyDraftIofPackage(
  packageId: string,
  input: {
    certifiedPackageId?: string;
    checklist: Record<string, unknown>;
    stationPlan?: Record<string, unknown>;
    engineeringApprovedObjectBudget?: Record<string, unknown>;
    engineeringApprovedBudget?: number;
    quantityReconciliation?: Record<string, unknown>;
    engineeringRevision?: Record<string, unknown>;
    engineeringRevisionProjection?: EngineeringRevisionProjectionRuntime | Record<string, unknown>;
    engineeringApprovalId?: string;
    manualHandoff?: Record<string, unknown>;
    notes?: string;
  },
  session?: TeralinxAuthSession | null,
) {
  return requestJson<{
    draftPackage: DraftIofPackageRuntime;
    certifiedIofPackage: CertifiedIofPackageRuntime;
    certifiedIofTwin?: Record<string, unknown>;
    certificationLedgerEntry?: CertificationLedgerEntryRuntime;
    engineeringPackage?: EngineeringPackageRuntime | null;
    executionAuthorizationCertificate?: ExecutionAuthorizationCertificate;
    scopeVersion?: Record<string, unknown>;
  }>(`/api/engineering/certification/draft-packages/${encodeURIComponent(packageId)}/certify`, {
    method: "POST",
    headers: authHeaders(session, { "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
}

export async function listEngineeringApprovals(
  input: { engineeringPackageId?: string; engineeringRevisionId?: string } = {},
  session?: TeralinxAuthSession | null,
) {
  const query = new URLSearchParams();
  if (input.engineeringPackageId) query.set("engineeringPackageId", input.engineeringPackageId);
  if (input.engineeringRevisionId) query.set("engineeringRevisionId", input.engineeringRevisionId);
  const data = await requestJson<any>(`/api/engineering/approvals${query.size ? `?${query}` : ""}`, {
    headers: authHeaders(session),
  });
  return unwrapList<EngineeringApprovalRuntime>(data, ["engineeringApprovals", "items"]);
}

export async function getEngineeringApprovalStatus(
  input: { engineeringPackageId: string; engineeringRevisionId?: string },
  session?: TeralinxAuthSession | null,
) {
  const query = new URLSearchParams({ engineeringPackageId: input.engineeringPackageId });
  if (input.engineeringRevisionId) query.set("engineeringRevisionId", input.engineeringRevisionId);
  return requestJson<{
    currentEngineeringApproval: EngineeringApprovalRuntime | null;
    engineeringApprovals: EngineeringApprovalRuntime[];
    reviewSummary: Record<string, unknown>;
    reviewSummaryHash: string;
    approvalEligibility: EngineeringApprovalEligibilityRuntime;
    missingRequirements: string[];
  }>(`/api/engineering/approvals?${query}`, { headers: authHeaders(session) });
}

export async function approveEngineeringRevision(
  input: {
    engineeringPackageId: string;
    engineeringRevisionId: string;
    engineeringRevisionHash: string;
    reviewSummaryHash: string;
    organizationId?: string;
    tenantId?: string;
    customerId?: string;
    opportunityId?: string;
  },
  session?: TeralinxAuthSession | null,
) {
  return requestJson<{ engineeringApproval: EngineeringApprovalRuntime; idempotentReplay: boolean; reviewComplete: boolean; sizeBytes?: number }>("/api/engineering/approvals", {
    method: "POST",
    headers: authHeaders(session, { "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
}

export async function listCertifiedIofPackages(session?: TeralinxAuthSession | null) {
  const data = await requestJson<any>("/api/engineering/certification/certified-packages", {
    headers: authHeaders(session),
  });
  return unwrapList<CertifiedIofPackageRuntime>(data, ["certifiedIofPackages", "items"]);
}

export async function openCertifiedIofPackage(certifiedPackageId: string, session?: TeralinxAuthSession | null) {
  const data = await requestJson<any>(`/api/engineering/certification/certified-packages/${encodeURIComponent(certifiedPackageId)}`, {
    headers: authHeaders(session),
  });
  return (data.certifiedIofPackage ?? data) as CertifiedIofPackageRuntime;
}

export async function listCertificationLedgerEntries(session?: TeralinxAuthSession | null) {
  const data = await requestJson<any>("/api/engineering/certification-ledger", {
    headers: authHeaders(session),
  });
  return unwrapList<CertificationLedgerEntryRuntime>(data, ["certificationLedger", "certificationLedgerEntries", "items"]);
}

export async function openCertificationLedgerEntry(certificationLedgerId: string, session?: TeralinxAuthSession | null) {
  const data = await requestJson<any>(`/api/engineering/certification-ledger/${encodeURIComponent(certificationLedgerId)}`, {
    headers: authHeaders(session),
  });
  return (data.certificationLedgerEntry ?? data) as CertificationLedgerEntryRuntime;
}

export async function listServiceOrders(session?: TeralinxAuthSession | null) {
  const data = await requestJson<any>("/api/service-orders", {
    headers: authHeaders(session),
  });
  return unwrapList<ServiceOrderRuntime>(data, ["serviceOrders", "items"]);
}

export async function generateServiceOrder(
  input: {
    proposalId?: string;
    certifiedPackageId?: string;
    proposal?: ProposalRuntimeObject;
    certifiedPackage?: CertifiedIofPackageRuntime;
    customerAcceptance?: Record<string, unknown>;
    commercialTerms?: Record<string, unknown>;
  },
  session?: TeralinxAuthSession | null,
) {
  const data = await requestJson<any>("/api/service-orders", {
    method: "POST",
    headers: authHeaders(session, { "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  return (data.serviceOrder ?? data) as ServiceOrderRuntime;
}

export async function markServiceOrderReadyForSignature(serviceOrderId: string, session?: TeralinxAuthSession | null) {
  const data = await requestJson<any>(`/api/service-orders/${encodeURIComponent(serviceOrderId)}/mark-ready-signature`, {
    method: "POST",
    headers: authHeaders(session, { "Content-Type": "application/json" }),
  });
  return (data.serviceOrder ?? data) as ServiceOrderRuntime;
}

export async function recordServiceOrderSignaturePlaceholder(
  serviceOrderId: string,
  input: { placeholderId?: string; note?: string } = {},
  session?: TeralinxAuthSession | null,
) {
  const data = await requestJson<any>(`/api/service-orders/${encodeURIComponent(serviceOrderId)}/record-signature-placeholder`, {
    method: "POST",
    headers: authHeaders(session, { "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  return (data.serviceOrder ?? data) as ServiceOrderRuntime;
}

export async function recordServiceOrderCustomerSignature(
  serviceOrderId: string,
  input: { documentHash?: string; typedName?: string; authorityAcknowledged?: boolean } = {},
  session?: TeralinxAuthSession | null,
) {
  const data = await requestJson<any>(`/api/service-orders/${encodeURIComponent(serviceOrderId)}/record-signature`, {
    method: "POST",
    headers: authHeaders(session, { "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  return (data.serviceOrder ?? data) as ServiceOrderRuntime;
}

export async function issueServiceOrder(serviceOrderId: string, session?: TeralinxAuthSession | null) {
  const data = await requestJson<any>(`/api/service-orders/${encodeURIComponent(serviceOrderId)}/issue`, {
    method: "POST", headers: authHeaders(session, { "Content-Type": "application/json" }),
  });
  return (data.serviceOrder ?? data) as ServiceOrderRuntime;
}

export async function countersignServiceOrder(
  serviceOrderId: string,
  input: { documentHash: string; authorizationAcknowledged: boolean },
  session?: TeralinxAuthSession | null,
) {
  return requestJson<{ serviceOrder: ServiceOrderRuntime; scopeVersion: Record<string, unknown>; authorizedTwin: Record<string, unknown>; transaction: Record<string, unknown> }>(`/api/service-orders/${encodeURIComponent(serviceOrderId)}/countersign`, {
    method: "POST", headers: authHeaders(session, { "Content-Type": "application/json" }), body: JSON.stringify(input),
  });
}

export async function generateScopeVersionFromCertifiedIofPackage(
  certifiedPackageId: string,
  input: {
    previousScopeVersionId?: string;
    parentScopeVersionId?: string;
    customerAcceptance?: Record<string, unknown>;
    serviceOrder?: Record<string, unknown>;
    signedServiceOrder?: Record<string, unknown>;
    changeSummary?: string;
    engineeringReason?: string;
    approvedBy?: string;
    approvedTimestamp?: string;
  } = {},
  session?: TeralinxAuthSession | null,
) {
  return requestJson<{
    certifiedPackage: CertifiedIofPackageRuntime;
    certificate: ExecutionAuthorizationCertificate;
    scopeVersion: Record<string, unknown>;
  }>(`/api/engineering/certification/certified-packages/${encodeURIComponent(certifiedPackageId)}/generate-scopeversion`, {
    method: "POST",
    headers: authHeaders(session, { "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
}
