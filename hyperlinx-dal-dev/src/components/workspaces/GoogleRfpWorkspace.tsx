import { useEffect, useMemo, useRef, useState } from "react";
import { cloneBudgetAssumptionState, createDefaultBudgetAssumptionState, rebalanceConstructionStrategy, type BudgetAssumptionState } from "../../commercial/BudgetAssumptionState";
import { createSelectedScopePricingSummary, type PricingScopeSelection, type SelectedScopePricingSummary } from "../../commercial/SelectedScopePricingSummary";
import { commercialMapZIndex, sortCommercialMapLayers, type CommercialMapLayer, type CommercialMapLockState, type CommercialMapVisibility } from "../../commercial/CommercialMapLayerManager";
import {
  createAddressScoutCandidate,
  createAzBuilderScoutCandidateFromResolvedLocations,
  createBrowserScoutCandidate,
  createLatLngScoutCandidate,
  createAddressResolvedLocation,
  createLatLngResolvedLocation,
  createMapResolvedLocation,
  createObjectResolvedLocation,
  createRouteResolvedLocation,
  createStationResolvedLocation,
  createMapScoutCandidate,
  runOpportunityQuickQuote,
  runOpportunityScoutSiteDecision,
  searchOpportunityBrowser,
  type OpportunityBrowserResult,
  type OpportunityQuickQuote,
  type OpportunityScoutCandidate,
  type OpportunityScoutMode,
  type OpportunityScoutSiteDecision,
  type ResolvedLocation,
  type ResolvedLocationSource,
} from "../../commercial/OpportunityScoutEngine";
import { resolveCommercialAttachment, type AttachmentResolution } from "../../commercial/CommercialAttachmentEngine";
import {
  buildCommercialCorridorDraft,
  buildCommercialCorridorDraftFromImportedRoute,
  type CommercialCorridorDraft,
  type CommercialDraftType,
} from "../../commercial/CommercialCorridorDraftEngine";
import { routeCommercialCorridorWithOsrm, type CommercialRouteRequest, type CommercialRouteResult } from "../../commercial/CommercialOsrmRoutingEngine";
import {
  compareEndpointCoordinate,
  deriveImportedRouteEndpointAuthority,
  enrichImportedEndpointSite,
  orientedImportedRouteGeometry,
  reverseImportedRouteEndpointAuthority,
  type ImportedRouteEndpointAuthority,
  type ImportedRouteEndpointSite,
} from "../../commercial/CommercialRouteEndpointAuthority";
import {
  DEFAULT_TRANSPARENT_ESTIMATE_CONTROLS,
  type TransparentEstimateControls,
  type TransparentEstimateFinancialControls,
  type TransparentEstimateHumanAuditEntry,
  type TransparentEstimateProductionControls,
  type TransparentProjectConfigurationControls,
  type TransparentUnknownQuantity,
} from "../../commercial/TransparentEstimatingEngine";
import { invalidateIlaPlanningCache, type IlaPlanningControls } from "../../commercial/IlaPlanningEngine";
import { authorityModeConfidence, type ConstraintValue, type ConstraintAuthorityMode } from "../../commercial/ConstraintAuthority";
import {
  COMMERCIAL_ROUTE_REPOSITORY_ENDPOINT,
  advanceRuntimeLifecycleBridge,
  approveProposalInternalCommercialReview,
  approveProposalRuntimeObject,
  assignDraftIofPackageEngineer,
  archiveProposalRuntimeObject,
  certifyDraftIofPackage,
  certifyIofUnit,
  commentProposalRuntimeObject,
  createDraftIofPackageFromProposal,
  createProposalRevision,
  downloadRuntimeArtifact,
  duplicateProposalRuntimeObject,
  listCommercialDraftIofPackages,
  loadAccountCustomerTwin,
  loadRuntimeRehydration,
  listEngineeringReviewQueue,
  openEngineeringPackage,
  openDraftIofPackageForCertification,
  requestProposalChanges,
  returnDraftIofPackageToCommercial,
  saveCommercialDraftIofPackage,
  submitDraftIofPackageToEngineering,
  submitProposalToCustomer,
  submitProposalToCustomerPortal,
  uploadProposalEvidence,
  type DraftIofPackageRuntime,
  type CommercialReleasePackageRuntime,
  type CommercialRevisionRuntime,
  type EngineeringReviewQueueItem,
  type ProposalRuntimeObject,
  type RuntimeRehydrationState,
  type RuntimeLifecycleBridgeState,
  type AccountCustomerTwin,
} from "../../api/teralinxRuntime";
import {
  evaluateProposalAuthorityState,
  logProposalAuthorityStateHydration,
  proposalCustomerReviewStateFromRepository,
  proposalRepositoryReportsCommercialApproved,
} from "../../kernel/ProposalAuthorityState";
import {
  cacheInventoryProjection,
  findCachedInventoryProjectionForCustomer,
  inventoryCacheStats,
} from "../../performance/InventoryImportCache";
import type { AsyncImportProgressState } from "../../performance/AsyncCustomerDesignImport";
import {
  latestRuntimePerformanceMetrics,
  runtimePerformanceSnapshot,
  startRuntimePerformanceOperation,
  type RuntimePerformanceSnapshot,
} from "../../performance/RuntimePerformanceInstrumentation";
import { affectedWorkbookExecutionDomains } from "../../performance/WorkbookRecalculationDomains";
import { runtimeDiagnosticsLog, runtimeDiagnosticsWarn } from "../../performance/RuntimeDiagnostics";
import {
  executeCorridorInBackground,
  type CorridorAggregateProjection,
  type CorridorExecutionMetricsSnapshot,
  type CorridorExecutionProgress,
  type CorridorExecutionSession,
  type CorridorViewportProjection,
} from "../../corridorExecution";
import {
  commitRouteEditSession,
  createRouteEditPatch,
  createRouteEditSession,
  rollbackRouteEditSession,
  safeApplyRouteEditPatch,
  type RouteEditPatch,
  type RouteEditPatchType,
  type RouteEditRevisionRecord,
  type RouteEditSession,
} from "../../routeEdit";
import {
  buildCommercialRevisionProjection,
  commercialChangeSetFromPatches,
  commercialPatchFromRouteEditPatch,
  compareCommercialRevisionProjections,
  discardUnappliedCommercialPatches,
  restoreOriginalCommercialRevision,
  type CommercialChangeSet,
  type CommercialPatch,
  type CommercialRevisionProjection,
} from "../../commercialChangeSet";
import { useDALState } from "../../dal/DALState";
import { useTeralinxAuth } from "../../identity/TeralinxAuth";
import { governedClientId } from "../../identity/governedIdNamespace";
import AccountDealRoomPanel from "./teralinx/AccountDealRoomPanel";
import type { GovernedAccount, GovernedContact, RuntimeHistoryEvent } from "../../api/accountLibrary";
import type { CustomerDesignImport, ImportedCustomerRoute } from "../../translate/CustomerDesignImport";
import { scheduleDraftIofPackageAssembly, schedulePointToPointLongHaulDoctrineAssembly } from "../../runtime/ConstitutionalAssemblyScheduler";
import { constitutionalProjectionCacheTelemetry } from "../../runtime/ConstitutionalProjectionCache";
import {
  annotateCommercialMutation,
  beginCommercialMutation,
  calculateCivilMixFastPath,
  completeCommercialMutation,
  latestCommercialMutationTrace,
  recordCommercialMutationMilestone,
  recordCommercialMutationOperation,
  type CommercialMutationType,
} from "../../performance/CommercialMutationRuntime";
import {
  CustomerRepository,
  CustomerTwinRepository,
  CommercialChangeSetRepository,
  CommercialReleasePackageRepository,
  CommercialRevisionRepository,
  ImportRepository,
  OpportunityRepository,
  ProposalRepository,
  RevisionRepository,
  RouteRepository,
  TemplateRepository,
  type CommercialRouteEvidence,
  type CommercialRouteRepositoryRecord,
} from "../../repositories/commercialRepositories";
import { googleHeliumBidPlanFixture } from "../../rfp/fixtures/googleHeliumRfpFixtures";
import { buildGoogleBidPackagePreview } from "../../rfp/GoogleBidPackagePreview";
import { rebuildGoogleRfpBidPlanFromRoutePlans } from "../../rfp/GoogleRfpResponseEngine";
import type { GoogleRfpRouteBidPlan } from "../../rfp/GoogleRfpBidPlan";
import type { CustomerInventoryParsedStatus, CustomerNetworkGraph } from "../../customerInventory/CustomerNetworkInventory";
import {
  buildCustomerTwinFromNetworkGraph,
  type CustomerTwinRenderableState,
  type CustomerTwinRouteUse,
  type CustomerTwinState,
} from "../../customerTwin/CustomerTwin";
import { projectCustomerTwinForRender } from "../../customerTwin/TwinRenderProjection";
import teralinxLogo from "../../assets/teralinx-logo.png";
import GoogleBidExecutiveSummaryPanel from "./googleRfp/GoogleBidExecutiveSummaryPanel";
import GoogleBidCommercialPreviewPanel from "./googleRfp/GoogleBidCommercialPreviewPanel";
import GoogleBidRouteReviewPanel from "./googleRfp/GoogleBidRouteReviewPanel";
import GoogleBidSupportingInformationPanel from "./googleRfp/GoogleBidSupportingInformationPanel";
import GoogleBidVendorResponsePreviewPanel from "./googleRfp/GoogleBidVendorResponsePreviewPanel";
import { CommercialReviewPanel } from "./googleRfp/CommercialReviewPanel";
import { evaluateConstitutionalAssemblyReview } from "../commercial/ConstitutionalAssemblyReviewPanel";
import TransparentEstimateExplorer from "./googleRfp/TransparentEstimateExplorer";
import { compareProposalRevisions, proposalRevisionApproval } from "../../commercial/ProposalRevisionLifecycle";
import ProposedNetworkMapPanel, { type CommercialIlaMapStation, type CommercialIofProjectionOverlay, type ProposedNetworkSelection } from "./proposednetwork/ProposedNetworkMapPanel";
import type { ProposedGraph } from "../../proposedGraph/ProposedGraph";
import type { DALCoordinate } from "../../types/dal";
import { sharedOpportunityMapProjectionFromRouteRepository } from "../../mapkernel";
import { hashRouteGeometry } from "../../routing/ConstraintAnalysisEngine";
import {
  POINT_TO_POINT_LONG_HAUL_DOCTRINE_HASH,
  POINT_TO_POINT_LONG_HAUL_PRODUCT_ID,
  type PointToPointLongHaulDoctrineInput,
} from "../../products/pointToPointLongHaulDoctrine";
import { PRODUCT_REGISTRY } from "../../products/ProductRegistry";
import type { ProductDoctrineSite } from "../../products/ProductDoctrineContracts";
import {
  executePointToPointConfigurator,
  productConfiguratorForProduct,
  POINT_TO_POINT_CONFIGURATOR_ID,
  POINT_TO_POINT_PRODUCT_NAME,
  type PointToPointConfiguratorResult,
} from "../../products/PointToPointConfigurator";

type CommercialWorkspaceView =
  | "account"
  | "engagement"
  | "networks"
  | "scout"
  | "assistant"
  | "analysis"
  | "proposal"
  | "review"
  | "handoff";

const COMMERCIAL_WORKSPACE_VIEWS: CommercialWorkspaceView[] = [
  "account",
  "engagement",
  "networks",
  "scout",
  "assistant",
  "analysis",
  "proposal",
  "review",
  "handoff",
];

interface CommercialAccountFixture {
  accountId: string;
  accountNumber: number;
  name: string;
  accountType: string;
  status: string;
  salesOwner: string;
  primaryEngineeringContact: string;
  procurementContact: string;
  contacts: string[];
  activeOpportunities: string[];
  existingNetworks: string[];
  operationalObjects: string[];
  commercialEngagements: string[];
  proposalHistory: string[];
  customerReviewHistory: string[];
  engineeringHistory: string[];
  notes: string;
}

type LiveProposalRouteSource = "ORIGINAL" | "LIVE_DRAFT" | "CUSTOMER_DRAFT" | "SAVED_REVISION";
type LiveProposalRecalculationStatus = "CURRENT" | "RECALCULATING" | "ERROR";
type CustomerReviewStatus = "NOT_STARTED" | "IN_REVIEW" | "CUSTOMER_DRAFT" | "ACCEPTED" | "REJECTED";
type CommercialNetworkCategory = "CUSTOMER_INVENTORY" | "CUSTOMER_PROPOSED" | "COMMERCIAL_DRAFT" | "CUSTOMER_DRAFT" | "ACCEPTED_PROPOSAL" | "IMPORTED" | "FUTURE_GIS";
type InventoryImportSource = "KMZ" | "KML" | "CSV" | "XLSX" | "GeoJSON" | "GIS_API" | "MANUAL" | "LIVE_SESSION";
type CommercialDesignMode = "EXTEND_EXISTING_NETWORK" | "NEW_INDEPENDENT_GRAPH" | "CUSTOMER_PROPOSAL_REVIEW";
type CommercialOpportunityStatus = "SAVED" | "RECENT" | "ARCHIVED" | "SUBMITTED_TO_ENGINEERING";
type OpportunityWorkflowState =
  | "IDLE"
  | "SELECTING_START_MODE"
  | "AWAITING_MAP_CLICK"
  | "AWAITING_ADDRESS"
  | "AWAITING_LAT_LNG"
  | "AWAITING_AZ_INPUT"
  | "SELECTING_EXTENSION_INPUT"
  | "AWAITING_IMPORT"
  | "RESOLVING_LOCATION"
  | "SITE_DECISION_READY"
  | "CORRIDOR_READY"
  | "QUICK_QUOTE_READY"
  | "LOCKED_SITE"
  | "COMMERCIAL_DRAFT_ACTIVE";
type AzLocationSlot = "A" | "Z";
type ImportDisposition = "PRICE_AS_NEW_OPPORTUNITY" | "ATTACH_TO_CURRENT_OPPORTUNITY" | "TEMPORARY_IMPORTED_ROUTE";
type RouteImportStatus = "IDLE" | "PARSING" | "READY" | "ERROR";
type OpportunityRestoreStatus = "IDLE" | "RESTORING" | "RESTORED" | "FAILED";
type OpportunityRestoreStepStatus = "PENDING" | "LOADING" | "OK" | "WARNING" | "FAILED";
type OpportunityRestoreStepId =
  | "repository"
  | "route-repository"
  | "validation"
  | "restore"
  | "map"
  | "estimate"
  | "workbook"
  | "proposal"
  | "preview"
  | "service-order"
  | "attachments"
  | "complete";

interface TemporaryImportedRoute {
  importRecord: CustomerDesignImport;
  route: ImportedCustomerRoute;
  draft: CommercialCorridorDraft | null;
  geometry: DALCoordinate[];
  sourceFileName: string;
  evidence: Record<string, unknown>;
  importedAt: string;
  endpointAuthority: ImportedRouteEndpointAuthority;
}

interface OpportunityRestoreStep {
  id: OpportunityRestoreStepId;
  label: string;
  status: OpportunityRestoreStepStatus;
  reason?: string;
}

interface OpportunityRestoreState {
  status: OpportunityRestoreStatus;
  opportunityId: string;
  opportunityName: string;
  steps: OpportunityRestoreStep[];
  log: string[];
  warnings: string[];
  fatalError?: string;
  completedAt?: string;
}

type RoutePersistenceAuditStatus = "START" | "SUCCESS" | "FAIL" | "WARNING" | "INFO";

interface RoutePersistenceAuditEntry {
  auditId: string;
  timestamp: string;
  stage: string;
  status: RoutePersistenceAuditStatus;
  details: Record<string, unknown>;
}

interface RoutePersistenceInspectorState {
  opportunityId: string;
  routeRepositoryId: string;
  routeGeometryId: string;
  geometryHash: string;
  vertexCount: number;
  lengthMiles: number;
  estimateId: string;
  workbookId: string;
  proposalId: string;
  attachmentIds: string[];
  savedTimestamp: string;
  restoredTimestamp: string;
  status: string;
}

interface CommercialNetworkRecord {
  networkId: string;
  accountId: string;
  name: string;
  networkCategory: CommercialNetworkCategory;
  authorityState: "EXISTING_NETWORK" | "CUSTOMER_PROPOSED_NETWORK" | "IMPORTED_NETWORK" | "CUSTOMER_DRAFT_NETWORK" | "COMMERCIAL_DRAFT_NETWORK" | "PROPOSED_NETWORK" | "ACCEPTED_PROPOSAL_NETWORK" | "CERTIFIED_NETWORK" | "OPERATIONAL_NETWORK";
  importSource: InventoryImportSource;
  sourceAssetName: string;
  source: string;
  importDate: string;
  routeMiles: number | null;
  parsedStatus?: CustomerInventoryParsedStatus;
  inventoryLayerId?: string;
  status: string;
  lastUpdated: string;
  geometryStatus: string;
  objectCount: number;
  stationCount?: number;
  featureCount?: number;
  inventorySessionVersion?: string;
  revisionCount: number;
  confidence: string;
  visibleByDefault: boolean;
  lockedByDefault: boolean;
  activeReferenceByDefault: boolean;
  diversityConstraintByDefault?: boolean;
  noScopeVersionCreation: true;
  noInventoryAuthorityMutation: true;
}

interface NetworkLayerState {
  visible: boolean;
  locked: boolean;
  activeReference: boolean;
  diversityConstraint: boolean;
}

interface LiveCommercialSession {
  sessionId: string;
  accountId: string;
  commercialEngagementId: string;
  activePricingScopeId: string;
  routeRequirementId: string;
  activeEditableRouteGeometry: Array<[number, number]>;
  routeSource: LiveProposalRouteSource;
  existingNetworksSelected: string[];
  proposedNetworksSelected: string[];
  constructionStrategy: BudgetAssumptionState["civilMix"];
  enrichmentSelections: string[];
  currentCommercialAssumptions: string;
  currentSelectedScopePricingSummary: SelectedScopePricingSummary | null;
  customerComments: string[];
  customerReviewStatus: CustomerReviewStatus;
  lastRecalculatedAt: string | null;
  lastAutosavedAt: string | null;
  dirty: boolean;
  recalculationStatus: LiveProposalRecalculationStatus;
  routePlan: GoogleRfpRouteBidPlan;
  snapshotCount: number;
  currentOwner: "Sales" | "Engineering";
  acceptedProposalId?: string;
  errorMessage?: string;
}

interface LiveProposalSnapshot {
  snapshotId: string;
  name: string;
  timestamp: string;
  routeRequirementId: string;
  pricingScopeId: string;
  accountId: string;
  commercialEngagementId: string;
  routeGeometry: Array<[number, number]>;
  routeSource: LiveProposalRouteSource;
  constructionStrategy: BudgetAssumptionState["civilMix"];
  enrichmentSelections: string[];
  selectedAssumptionStateId: string;
  selectedScopePricingSummary: SelectedScopePricingSummary;
  author: string;
  note: string;
  immutableCommercialRecord: true;
  noScopeVersionCreation: true;
  noInventoryMutation: true;
}

interface CustomerDraftRecord {
  customerDraftId: string;
  accountId: string;
  commercialEngagementId: string;
  source: "KMZ" | "KML" | "CSV" | "GeoJSON" | "COMMENT";
  status: "RECEIVED" | "COUNTER_REQUESTED" | "ACCEPTED_FOR_REVIEW" | "REJECTED";
  createdAt: string;
  note: string;
  noInventoryMutation: true;
}

interface AcceptedProposal {
  acceptedProposalId: string;
  acceptedAt: string;
  accountId: string;
  accountName: string;
  commercialEngagementId: string;
  routeRequirementId: string;
  acceptedRouteGeometry: Array<[number, number]>;
  acceptedCommercialSummary: SelectedScopePricingSummary;
  proposalSnapshots: LiveProposalSnapshot[];
  customerComments: string[];
  customerUploadedRoutes: CustomerDraftRecord[];
  existingNetworksReferenced: string[];
  proposedNetworksReferenced: string[];
  constructionStrategy: BudgetAssumptionState["civilMix"];
  enrichmentSelections: string[];
  budgetAssumptions: string;
  attachments: string[];
  owner: "Engineering";
  engineeringReviewActivated: true;
  noScopeVersionCreation: true;
  noServiceOrderCreation: true;
}

interface CommercialOpportunityRecord {
  transactionId?: string;
  opportunityId: string;
  objectId?: string;
  runtimeObjectId?: string;
  objectType?: "OPPORTUNITY";
  accountId: string;
  customerId?: string;
  name: string;
  status: CommercialOpportunityStatus;
  productId?: string;
  productName?: string;
  productDoctrineId?: string;
  productDoctrineVersion?: string;
  productDoctrineHash?: string;
  doctrineVersion?: string;
  customerSnapshot?: Record<string, unknown>;
  customerTwinReference?: string;
  customerTwinId?: string;
  commercialStateVersion?: number;
  commercialStateHash?: string;
  commercialStateSnapshot?: Record<string, unknown>;
  commercialWorkingState?: Record<string, unknown>;
  state?: string;
  modifiedBy?: string;
  modifiedById?: string;
  routeRepositoryId?: string;
  routeRepositoryRef?: {
    routeRepositoryId: string;
    routeSnapshotId: string;
    routeId: string;
    routeName: string;
    repositoryType: "COMMERCIAL_ROUTE_REPOSITORY";
  };
  routeRepositorySnapshot?: CommercialRouteRepositoryRecord | null;
  routeName?: string;
  routeGeometry?: DALCoordinate[];
  routeFeet?: number;
  routeMiles?: number;
  routeRevision?: number;
  routeGeometryId?: string;
  geometryHash?: string;
  aSite?: ImportedRouteEndpointSite | Record<string, unknown>;
  zSite?: ImportedRouteEndpointSite | Record<string, unknown>;
  sourceRouteFileReference?: string;
  sourceFiles?: Array<Record<string, unknown>>;
  attachments?: Array<Record<string, unknown>>;
  attachmentMetadata?: Array<Record<string, unknown>>;
  estimate?: Record<string, unknown>;
  commercialWorkbook?: Record<string, unknown>;
  doctrineAssumptions?: Record<string, unknown>;
  humanOverrides?: Array<Record<string, unknown>>;
  commercialOverrides?: Array<Record<string, unknown>>;
  constructionMixSnapshot?: Record<string, unknown>;
  riskSnapshot?: string[];
  commercialNotes?: string;
  importedEvidenceReferences?: CommercialRouteEvidence[];
  restoreSnapshotVersion?: string;
  commercialSnapshot?: Record<string, unknown>;
  proposalId?: string;
  proposalRevisionId?: string;
  proposalHash?: string;
  commercialRepositoryId?: string;
  commercialRevisionId?: string;
  revisionId?: string;
  commercialReleasePackageId?: string;
  commercialRevisionHash?: string;
  commercialReleaseHash?: string;
  changeSetIds?: string[];
  activeChangeSetIds?: string[];
  patchCount?: number;
  activePatchCount?: number;
  appliedPatchCount?: number;
  repositoryHash?: string;
  projectionHash?: string;
  patchReplayTimeMs?: number;
  projectionTimeMs?: number;
  engineeringPackageId?: string;
  draftIofPackageId?: string;
  estimateId?: string;
  commercialWorkbookId?: string;
  engineeringStatus?: string;
  engineeringHandoff?: Record<string, unknown>;
  proposalPreviewId?: string;
  proposalStatus?: string;
  proposalPreview?: Record<string, unknown>;
  workbookId?: string;
  serviceOrderPreviewId?: string;
  serviceOrderPreview?: Record<string, unknown>;
  revisionHistory?: Array<Record<string, unknown>>;
  owner?: string;
  ownerId?: string;
  createdBy?: string;
  createdById?: string;
  assignedTo?: string[];
  assignment?: {
    owner: string;
    contributors: string[];
    reviewers: string[];
    approvers: string[];
    executives: string[];
  };
  organization?: string;
  organizationId?: string;
  workspace?: string;
  workspaceId?: string;
  visibility?: "PRIVATE" | "SHARED" | "ORGANIZATION" | "PUBLIC";
  authority?: {
    owner: string;
    contributors: string[];
    reviewers: string[];
    approvers: string[];
    executives: string[];
    sharedWith?: string[];
  };
  lifecycleState?: string;
  version?: number;
  evidenceLinks?: string[];
  relationshipLinks?: string[];
  createdDate?: string;
  modifiedDate?: string;
  createdAt: string;
  updatedAt: string;
  lastOpenedBy?: string;
  lastOpenedById?: string;
  lastOpenedAt?: string;
  archivedAt?: string;
  selectedImportId?: string;
  selectedRouteId?: string;
  selectedScopeId: string;
  activeView: CommercialWorkspaceView;
  commercialDraftType: CommercialDraftType | null;
  liveSession: LiveCommercialSession | null;
  commercialDraftSnapshot?: CommercialCorridorDraft | null;
  customerDesignImportSnapshot?: CustomerDesignImport | null;
  selectedRouteSnapshot?: ImportedCustomerRoute | null;
  selectedCustomerDesignLabel?: string;
  importedDraftRouteId?: string;
  snapshotCount: number;
  note: string;
  noScopeVersionCreation: true;
  noInventoryMutation: true;
}

type AccountEditorState = {
  accountId: string;
  name: string;
  accountType: string;
  status: string;
  salesOwner: string;
  primaryEngineeringContact: string;
  procurementContact: string;
  notes: string;
};

type ContactEditorState = {
  name: string;
  title: string;
  role: string;
  email: string;
  phone: string;
};

const COMMERCIAL_WORKFLOW: Array<{ id: CommercialWorkspaceView; label: string; summary: string }> = [
  { id: "account", label: "CRM Account", summary: "Customer, contacts, and opportunity context" },
  { id: "engagement", label: "Engagement", summary: "Opportunity record, documents, reviews, and attachments" },
  { id: "networks", label: "Customer Inventory", summary: "Read-only account inventory before any proposal work" },
  { id: "scout", label: "Opportunity Scout", summary: "Map, address, coordinates, and A/Z opportunity discovery" },
  { id: "assistant", label: "Design Modes", summary: "Extend existing inventory or create an independent graph" },
  { id: "analysis", label: "Opportunity Analysis", summary: "Launch Site Decision with inventory and proposal inputs" },
  { id: "proposal", label: "Proposal Builder", summary: "Commercial plan, corridor map, pricing, KMZ, and vendor response" },
  { id: "review", label: "Customer Review", summary: "Comments, revision intake, and approval state" },
  { id: "handoff", label: "Engineering Handoff", summary: "Accepted proposal package for Route Engineering" },
];

const LAYER_1_PRODUCT_OPTIONS = PRODUCT_REGISTRY.commercialOptions();

const CARRIER_NEUTRAL_FULFILLMENT_MIX = [
  { ownershipClass: "CUSTOMER_OWNED", label: "Customer Existing Ring", percentage: 40 },
  { ownershipClass: "TERALINX_OWNED", label: "Teralinx Backbone", percentage: 35 },
  { ownershipClass: "PARTNER_OWNED", label: "Partner Longhaul", percentage: 15 },
  { ownershipClass: "NEW_CONSTRUCTION", label: "New Construction", percentage: 10 },
];

const RUNTIME_USER_LABELS: Record<string, string> = {
  "teralinx-user-ryan": "Ryan",
  "teralinx-user-fran": "Fran",
  "teralinx-user-kyle": "Kyle",
};

function runtimeUserLabel(userId: string | undefined) {
  if (!userId) return "Unassigned";
  return RUNTIME_USER_LABELS[userId] ?? userId;
}

function asDisplayArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === "") return [];
  return [value];
}

function displayReference(value: unknown) {
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return String(record.label ?? record.name ?? record.title ?? record.objectId ?? record.id ?? JSON.stringify(record));
  }
  return String(value);
}

function displayReferenceList(value: unknown, limit = 4) {
  const list = asDisplayArray(value).map(displayReference).filter(Boolean);
  if (!list.length) return "None";
  const visible = list.slice(0, limit).join(", ");
  return list.length > limit ? `${visible}, +${list.length - limit}` : visible;
}

function manifestCount(packageRecord: DraftIofPackageRuntime | null, key: string) {
  const manifest = packageRecord?.manifest as Record<string, unknown> | undefined;
  return asDisplayArray(manifest?.[key]).length;
}

function packageScore(value: unknown) {
  const score = Number(value);
  return Number.isFinite(score) ? `${Math.round(score)}%` : "n/a";
}

function opportunityAssignedTo(record: CommercialOpportunityRecord) {
  return [
    ...(record.assignedTo ?? []),
    ...(record.authority?.contributors ?? []),
    ...(record.authority?.reviewers ?? []),
    ...(record.authority?.approvers ?? []),
    ...(record.authority?.executives ?? []),
  ].filter((value, index, list) => value && list.indexOf(value) === index);
}

const COMMERCIAL_ACCOUNTS: CommercialAccountFixture[] = [
  {
    accountId: "google",
    accountNumber: 1,
    name: "Google",
    accountType: "Hyperscaler",
    status: "Active RFP",
    salesOwner: "Ryan",
    primaryEngineeringContact: "Google Network Engineering",
    procurementContact: "Google Procurement",
    contacts: ["Network Engineering", "Sourcing", "Commercial Review"],
    activeOpportunities: ["Google Helium / Dobson diversity response"],
    existingNetworks: ["Customer-supplied KMZ references", "Helium route source package"],
    operationalObjects: ["Helium campus", "Muskogee target", "Stillwater target"],
    commercialEngagements: ["Google Helium commercial response"],
    proposalHistory: ["Initial Dobson commercial package", "Current sales corridor proposal"],
    customerReviewHistory: ["KMZ review pending", "Commercial review pending"],
    engineeringHistory: ["No ScopeVersion created; Route Engineering not yet owner"],
    notes: "Google fixture remains the first production customer scenario for DAL Commercial Planning.",
  },
];

const EMPTY_COMMERCIAL_ACCOUNT: CommercialAccountFixture = {
  accountId: "",
  accountNumber: 0,
  name: "",
  accountType: "",
  status: "",
  salesOwner: "",
  primaryEngineeringContact: "",
  procurementContact: "",
  contacts: [],
  activeOpportunities: [],
  existingNetworks: [],
  operationalObjects: [],
  commercialEngagements: [],
  proposalHistory: [],
  customerReviewHistory: [],
  engineeringHistory: [],
  notes: "",
};

const RETIRED_DEMO_ACCOUNT_IDS = new Set(["fiberlight", "verizon", "crown-castle", "municipality"]);

const ENRICHMENT_OPTIONS = [
  "Geology",
  "ERCOT",
  "Power transmission",
  "DOT",
  "Rail",
  "Watersheds",
  "Floodplain",
  "Parcels",
  "Utility easements",
  "Power capacity",
  "NAICS",
  "Municipal boundaries",
  "Environmental",
];

const NETWORK_CATEGORY_ORDER: Array<Exclude<CommercialNetworkCategory, "IMPORTED">> = [
  "CUSTOMER_INVENTORY",
  "CUSTOMER_PROPOSED",
  "COMMERCIAL_DRAFT",
  "CUSTOMER_DRAFT",
  "ACCEPTED_PROPOSAL",
  "FUTURE_GIS",
];

const TRANSPARENT_CONSTRAINT_PRODUCTION_MAP: Partial<Record<string, keyof TransparentEstimateProductionControls>> = {
  "production.directionalBoreDirtFeetPerDay": "directionalBoreDirtFeetPerDay",
  "production.directionalBoreRockFeetPerDay": "directionalBoreRockFeetPerDay",
  "production.openTrenchDirtFeetPerDay": "openTrenchDirtFeetPerDay",
  "production.openTrenchRockFeetPerDay": "openTrenchRockFeetPerDay",
  "production.plowFeetPerDay": "plowFeetPerDay",
  "production.fiberBlowingFeetPerDay": "fiberBlowingFeetPerDay",
  "production.fiberPullingFeetPerDay": "fiberPullingFeetPerDay",
  "production.splicingTerminationsPerDay": "splicingTerminationsPerDay",
};

const CIVIL_MIX_CONSTRAINT_KEYS = [
  "civil.plowPercent",
  "civil.directionalBoreDirtPercent",
  "civil.directionalBoreRockPercent",
  "civil.openTrenchPercent",
] as const;

type CivilMixCalibrationKey = "plowPercent" | "dirtPercent" | "rockPercent" | "trenchPercent";

interface CivilMixCalibration {
  plowPercent: number;
  dirtPercent: number;
  rockPercent: number;
  trenchPercent: number;
}

const STANDARD_CIVIL_MIX: CivilMixCalibration = Object.freeze({
  plowPercent: 82,
  dirtPercent: 12,
  rockPercent: 0,
  trenchPercent: 6,
});

const ESTIMATE_AUTHOR = "Teralinx";

function isHumanWorkflowAuthority(mode: ConstraintAuthorityMode) {
  return mode === "PENDING_HUMAN" || mode === "HUMAN_APPROVED" || mode === "HUMAN" || mode === "APPROVED";
}

function isApprovedHumanAuthority(mode: ConstraintAuthorityMode) {
  return mode === "HUMAN_APPROVED" || mode === "APPROVED";
}

function auditValue(value: ConstraintValue["value"]) {
  if (value === null || value === undefined) return "UNKNOWN";
  return String(value);
}

function valuesMatch(left: ConstraintValue["value"], right: ConstraintValue["value"]) {
  return auditValue(left) === auditValue(right);
}

function humanAuditEntry(previous: ConstraintValue, next: ConstraintValue, reason?: string, user = ESTIMATE_AUTHOR): TransparentEstimateHumanAuditEntry {
  const timestamp = new Date().toISOString();
  return {
    auditId: `estimate-human-${timestamp}-${next.key}-${Math.random().toString(36).slice(2, 8)}`,
    constraintKey: next.key,
    label: next.label,
    previousValue: auditValue(previous.value),
    newValue: auditValue(next.value),
    previousAuthority: previous.authorityMode,
    newAuthority: next.authorityMode,
    user,
    timestamp,
    reason: reason?.trim() || undefined,
  };
}

const NETWORK_CATEGORY_LABELS: Record<CommercialNetworkCategory, string> = {
  CUSTOMER_INVENTORY: "Existing Networks",
  CUSTOMER_PROPOSED: "Customer Proposed Networks",
  COMMERCIAL_DRAFT: "Commercial Drafts",
  CUSTOMER_DRAFT: "Customer Drafts",
  ACCEPTED_PROPOSAL: "Accepted Proposals",
  IMPORTED: "Imported Networks",
  FUTURE_GIS: "Future GIS Connections",
};

const COMMERCIAL_BASELINE_GRAPH = {
  proposedGraphId: "COMMERCIAL-PLANNING-CUSTOMER-TWIN-BASELINE",
  proposalId: "NO-PROPOSAL",
  customerId: "ACCOUNT",
  customerName: "Account",
  opportunityId: "NO-OPPORTUNITY",
  opportunityName: "Customer Twin Baseline",
  routeRequestId: "NO-ROUTE-REQUEST",
  sourceDesignLaunchId: "NO-DESIGN-LAUNCH",
  designDoctrineId: "NO-DESIGN-DOCTRINE",
  routeCandidateId: "NO-ROUTE-CANDIDATE",
  networkType: "METRO",
  networkClass: "MIDDLE_MILE",
  topology: "LINEAR",
  protection: "LINEAR",
  protectionClass: "UNPROTECTED",
  primaryProduct: "FIBER",
  nodes: [],
  edges: [],
  statistics: {
    totalMiles: 0,
    fiberFeet: 0,
    ductFeet: 0,
    estimatedStationCount: 0,
    estimatedVaults: 0,
    estimatedRegenSites: 0,
    estimatedCabinets: 0,
    estimatedCrossings: 0,
    estimatedHighwayCrossings: 0,
    estimatedRailroadCrossings: 0,
    estimatedWaterCrossings: 0,
    estimatedUrbanSegments: 0,
    estimatedRuralSegments: 0,
    estimatedConstructionCost: 0,
    confidenceScore: 0,
    routeCandidateDerived: false,
    estimatedOnly: true,
  },
  routeStatistics: {
    totalRouteLengthFeet: 0,
    totalRouteLengthMiles: 0,
    fiberFeet: 0,
    ductFeet: 0,
    estimatedStationCount: 0,
    estimatedVaultCount: 0,
    estimatedRegenCount: 0,
    estimatedHighwayCrossings: 0,
    estimatedRailroadCrossings: 0,
    estimatedWaterCrossings: 0,
    estimatedConstructionCost: 0,
    confidenceScore: 0,
    estimatedOnly: true,
  },
  routeCandidate: {
    routeCandidateId: "NO-ROUTE-CANDIDATE",
    name: "No commercial proposal route",
    nodes: [],
    segments: [],
    constraints: [],
    engineeringConstraintCandidates: [],
    statistics: {
      totalRouteLengthFeet: 0,
      totalRouteLengthMiles: 0,
      fiberFeet: 0,
      ductFeet: 0,
      estimatedStationCount: 0,
      estimatedVaultCount: 0,
      estimatedRegenCount: 0,
      estimatedHighwayCrossings: 0,
      estimatedRailroadCrossings: 0,
      estimatedWaterCrossings: 0,
      estimatedConstructionCost: 0,
      confidenceScore: 0,
      estimatedOnly: true,
    },
    metadata: { baselineOnly: true },
    readOnly: true,
  },
  engineeringConstraintCandidates: [],
  readiness: "BLOCKED",
  diagnostics: [],
  generatedAt: "2026-06-27T00:00:00.000Z",
  metadata: { source: "CUSTOMER_TWIN_BASELINE", noProposalGeometry: true },
  readOnly: true,
  noEngineering: true,
  salesEstimate: true,
  engineeringCertificationRequired: true,
  noScopeVersionCreation: true,
  noInventoryMutation: true,
  noPersistence: true,
} as unknown as ProposedGraph;

const COMMERCIAL_NETWORKS: CommercialNetworkRecord[] = [
  {
    networkId: "NET-GOOGLE-HIU-SUMMARY-20260603",
    accountId: "google",
    name: "HIU Summary 06-03-2026",
    networkCategory: "CUSTOMER_INVENTORY",
    authorityState: "EXISTING_NETWORK",
    importSource: "KMZ",
    sourceAssetName: "HIU-Summary-06-03-2026.kmz",
    source: "Inventory Import Adapter",
    importDate: "2026-06-03",
    parsedStatus: "PENDING",
    inventoryLayerId: "INV-GOOGLE-HIU-SUMMARY-20260603",
    routeMiles: null,
    status: "Parses on account load",
    lastUpdated: "2026-06-27",
    geometryStatus: "KMZ customer inventory geometry loads as locked reference",
    objectCount: 0,
    revisionCount: 0,
    confidence: "Customer supplied",
    visibleByDefault: true,
    lockedByDefault: true,
    activeReferenceByDefault: true,
    diversityConstraintByDefault: false,
    noScopeVersionCreation: true,
    noInventoryAuthorityMutation: true,
  },
  {
    networkId: "NET-GOOGLE-MUS-20240716",
    accountId: "google",
    name: "MUS 07162024",
    networkCategory: "CUSTOMER_INVENTORY",
    authorityState: "EXISTING_NETWORK",
    importSource: "KMZ",
    sourceAssetName: "MUS 07162024.kmz",
    source: "Inventory Import Adapter",
    importDate: "2024-07-16",
    parsedStatus: "PENDING",
    inventoryLayerId: "INV-GOOGLE-MUS-20240716",
    routeMiles: null,
    status: "Parses on account load",
    lastUpdated: "2026-06-27",
    geometryStatus: "KMZ customer inventory geometry loads as locked reference",
    objectCount: 0,
    revisionCount: 0,
    confidence: "Customer supplied",
    visibleByDefault: true,
    lockedByDefault: true,
    activeReferenceByDefault: true,
    diversityConstraintByDefault: true,
    noScopeVersionCreation: true,
    noInventoryAuthorityMutation: true,
  },
  {
    networkId: "NET-GOOGLE-GIS-API-FUTURE",
    accountId: "google",
    name: "Google GIS API Connection",
    networkCategory: "FUTURE_GIS",
    authorityState: "IMPORTED_NETWORK",
    importSource: "GIS_API",
    sourceAssetName: "Future Google GIS API",
    source: "Inventory Import Adapter",
    importDate: "Not connected",
    routeMiles: null,
    status: "Future account-scoped inventory connector",
    lastUpdated: "Not connected",
    geometryStatus: "Connector planned; no live inventory call in DAL",
    objectCount: 0,
    revisionCount: 0,
    confidence: "Future integration",
    visibleByDefault: false,
    lockedByDefault: true,
    activeReferenceByDefault: false,
    noScopeVersionCreation: true,
    noInventoryAuthorityMutation: true,
  },
  {
    networkId: "NET-GOOGLE-HELIUM-RFP-WORKBOOK",
    accountId: "google",
    name: "Google Helium KS Campus RFP Workbook",
    networkCategory: "IMPORTED",
    authorityState: "IMPORTED_NETWORK",
    importSource: "XLSX",
    sourceAssetName: "Google Helium, KS Campus RFP.xlsx",
    source: "Inventory Import Adapter",
    importDate: "2026-06-27",
    routeMiles: null,
    status: "Imported customer commercial package",
    lastUpdated: "2026-06-27",
    geometryStatus: "Workbook metadata only",
    objectCount: 0,
    revisionCount: 0,
    confidence: "Customer supplied",
    visibleByDefault: false,
    lockedByDefault: true,
    activeReferenceByDefault: false,
    noScopeVersionCreation: true,
    noInventoryAuthorityMutation: true,
  },
  {
    networkId: "NET-GOOGLE-EXISTING-POPS",
    accountId: "google",
    name: "Google Existing POPs",
    networkCategory: "CUSTOMER_INVENTORY",
    authorityState: "EXISTING_NETWORK",
    importSource: "KMZ",
    sourceAssetName: "Derived from Google KMZ deliverables",
    source: "Inventory Import Adapter",
    importDate: "2026-06-27",
    routeMiles: null,
    status: "Derived from parsed KMZ markers",
    lastUpdated: "2026-06-27",
    geometryStatus: "Object markers render from parsed Google Customer Inventory",
    objectCount: 3,
    revisionCount: 0,
    confidence: "Parsed KMZ",
    visibleByDefault: true,
    lockedByDefault: true,
    activeReferenceByDefault: false,
    noScopeVersionCreation: true,
    noInventoryAuthorityMutation: true,
  },
  {
    networkId: "NET-GOOGLE-SPLICE-CASES",
    accountId: "google",
    name: "Google Existing Splice Cases",
    networkCategory: "CUSTOMER_INVENTORY",
    authorityState: "EXISTING_NETWORK",
    importSource: "KMZ",
    sourceAssetName: "Derived from Google KMZ deliverables",
    source: "Inventory Import Adapter",
    importDate: "2026-06-27",
    routeMiles: null,
    status: "Derived from parsed KMZ markers",
    lastUpdated: "2026-06-27",
    geometryStatus: "Object markers render from parsed Google Customer Inventory",
    objectCount: 0,
    revisionCount: 0,
    confidence: "Parsed KMZ",
    visibleByDefault: true,
    lockedByDefault: true,
    activeReferenceByDefault: false,
    noScopeVersionCreation: true,
    noInventoryAuthorityMutation: true,
  },
  {
    networkId: "NET-GOOGLE-BUILDINGS",
    accountId: "google",
    name: "Google Existing Buildings",
    networkCategory: "CUSTOMER_INVENTORY",
    authorityState: "EXISTING_NETWORK",
    importSource: "KMZ",
    sourceAssetName: "Derived from Google KMZ deliverables",
    source: "Inventory Import Adapter",
    importDate: "2026-06-27",
    routeMiles: null,
    status: "Derived from parsed KMZ markers",
    lastUpdated: "2026-06-27",
    geometryStatus: "Facility markers render from parsed Google Customer Inventory",
    objectCount: 3,
    revisionCount: 0,
    confidence: "Parsed KMZ",
    visibleByDefault: true,
    lockedByDefault: true,
    activeReferenceByDefault: false,
    noScopeVersionCreation: true,
    noInventoryAuthorityMutation: true,
  },
  {
    networkId: "NET-GOOGLE-HELIUM-PROPOSED",
    accountId: "google",
    name: "Helium KS -> Muskogee",
    networkCategory: "COMMERCIAL_DRAFT",
    authorityState: "PROPOSED_NETWORK",
    importSource: "LIVE_SESSION",
    sourceAssetName: "Commercial Planning live proposal",
    source: "Commercial Planning live session",
    importDate: "2026-06-27",
    routeMiles: null,
    status: "Live commercial proposal",
    lastUpdated: "2026-06-27",
    geometryStatus: "Editable proposal",
    objectCount: 0,
    revisionCount: 0,
    confidence: "Budgetary",
    visibleByDefault: false,
    lockedByDefault: false,
    activeReferenceByDefault: false,
    noScopeVersionCreation: true,
    noInventoryAuthorityMutation: true,
  },
  {
    networkId: "NET-GOOGLE-HELIUM-SWR-PROPOSED",
    accountId: "google",
    name: "Helium KS -> Stillwater",
    networkCategory: "COMMERCIAL_DRAFT",
    authorityState: "PROPOSED_NETWORK",
    importSource: "LIVE_SESSION",
    sourceAssetName: "Commercial Planning live proposal",
    source: "Commercial Planning live session",
    importDate: "2026-06-27",
    routeMiles: null,
    status: "Live commercial proposal",
    lastUpdated: "2026-06-27",
    geometryStatus: "Editable proposal",
    objectCount: 0,
    revisionCount: 0,
    confidence: "Budgetary",
    visibleByDefault: false,
    lockedByDefault: false,
    activeReferenceByDefault: false,
    noScopeVersionCreation: true,
    noInventoryAuthorityMutation: true,
  },
  {
    networkId: "NET-GOOGLE-KANSAS-NORTH-EXPANSION",
    accountId: "google",
    name: "Kansas North Expansion",
    networkCategory: "COMMERCIAL_DRAFT",
    authorityState: "PROPOSED_NETWORK",
    importSource: "MANUAL",
    sourceAssetName: "Commercial planning scenario",
    source: "Commercial Planning workspace",
    importDate: "2026-06-27",
    routeMiles: null,
    status: "Scenario placeholder",
    lastUpdated: "2026-06-27",
    geometryStatus: "No visible route loaded",
    objectCount: 0,
    revisionCount: 0,
    confidence: "Not started",
    visibleByDefault: false,
    lockedByDefault: false,
    activeReferenceByDefault: false,
    noScopeVersionCreation: true,
    noInventoryAuthorityMutation: true,
  },
  {
    networkId: "NET-GOOGLE-TEXAS-AI-CORRIDOR",
    accountId: "google",
    name: "Texas AI Corridor",
    networkCategory: "COMMERCIAL_DRAFT",
    authorityState: "PROPOSED_NETWORK",
    importSource: "MANUAL",
    sourceAssetName: "Commercial planning scenario",
    source: "Commercial Planning workspace",
    importDate: "2026-06-27",
    routeMiles: null,
    status: "Scenario placeholder",
    lastUpdated: "2026-06-27",
    geometryStatus: "No visible route loaded",
    objectCount: 0,
    revisionCount: 0,
    confidence: "Not started",
    visibleByDefault: false,
    lockedByDefault: false,
    activeReferenceByDefault: false,
    noScopeVersionCreation: true,
    noInventoryAuthorityMutation: true,
  },
];

function routeLabel(routePlan: GoogleRfpRouteBidPlan) {
  return routePlan.routeRequirement.bidSegmentName.replace("Helium / HIU to ", "Helium -> ");
}

function routeInput(routePlan: GoogleRfpRouteBidPlan) {
  if (!routePlan.stationedCorridor?.takeoff) return null;
  return {
    segmentId: routePlan.routeRequirement.routeRequirementId,
    segmentName: routePlan.routeRequirement.bidSegmentName,
    aLocation: routePlan.routeRequirement.aSite.facilityName,
    zLocation: routePlan.routeRequirement.zSite.facilityName,
    fiberCount: routePlan.routeRequirement.fiberCount,
    takeoff: routePlan.stationedCorridor.takeoff,
  };
}

function money(value: number) {
  return `$${Math.round(value).toLocaleString()}`;
}

function percentage(value: number) {
  return `${Number(value.toFixed(1)).toLocaleString()}%`;
}

function feet(value: number | null | undefined) {
  if (typeof value !== "number") return "No result";
  return `${Math.round(value).toLocaleString()} ft`;
}

function unknownQuantityDisplay(value: TransparentUnknownQuantity) {
  return `${value.display} / ${value.status}`;
}

function shortTimestamp(value: string | null | undefined) {
  if (!value) return "n/a";
  return new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function opportunityWorkflowLabel(state: OpportunityWorkflowState) {
  return state.replaceAll("_", " ");
}

function siteDecisionCanRun(state: OpportunityWorkflowState) {
  return state === "SITE_DECISION_READY" ||
    state === "CORRIDOR_READY" ||
    state === "QUICK_QUOTE_READY" ||
    state === "LOCKED_SITE" ||
    state === "COMMERCIAL_DRAFT_ACTIVE";
}

function quickQuoteCanRun(state: OpportunityWorkflowState) {
  return state === "QUICK_QUOTE_READY" ||
    state === "LOCKED_SITE" ||
    state === "COMMERCIAL_DRAFT_ACTIVE";
}

function corridorDraftCanRun(state: OpportunityWorkflowState) {
  return state === "CORRIDOR_READY" ||
    state === "COMMERCIAL_DRAFT_ACTIVE";
}

function draftTypeLabel(type: CommercialDraftType | null) {
  if (type === "NEW_GRAPH_CORRIDOR") return "Point-to-Point Product Design";
  if (type === "EXISTING_GRAPH_EXTENSION") return "Extend Existing Graph / Lateral";
  return "Not selected";
}

function locationSourceLabel(source: ResolvedLocationSource) {
  return source.replaceAll("_", " ");
}

function importedEndpointResolvedLocation(accountId: string, site: ImportedRouteEndpointSite): ResolvedLocation {
  return {
    id: `${site.sourceGeometryId}:${site.endpoint}:${site.geometryHash}`,
    label: site.siteName || `${site.endpoint} Endpoint`,
    source: "IMPORTED_ROUTE",
    inputValue: `${site.coordinate[1]},${site.coordinate[0]}`,
    latitude: site.coordinate[1],
    longitude: site.coordinate[0],
    accountId,
    domain: "SALES_DRAFT",
    confidence: 100,
  };
}

function isCustomerTwinLocation(location: ResolvedLocation | null | undefined) {
  return Boolean(location && (
    location.domain === "CUSTOMER_EXISTING" ||
    location.domain === "CUSTOMER_PROPOSED" ||
    location.source.startsWith("CUSTOMER_") ||
    location.snappedRouteId ||
    location.snappedStationId ||
    location.snappedObjectId
  ));
}

function locationCoordinate(location: ResolvedLocation) {
  return {
    latitude: location.latitude,
    longitude: location.longitude,
    label: location.label,
  };
}

function attachmentSearchLocation(candidate: OpportunityScoutCandidate, designMode: CommercialDesignMode, draftType: CommercialDraftType | null): ResolvedLocation | null {
  if (draftType === "NEW_GRAPH_CORRIDOR") return null;
  if (candidate.mode !== "AZ_BUILDER") return candidate.resolvedLocation ?? null;
  if (designMode === "NEW_INDEPENDENT_GRAPH") return null;
  if (isCustomerTwinLocation(candidate.originLocation)) return candidate.originLocation ?? null;
  if (isCustomerTwinLocation(candidate.destinationLocation)) return candidate.destinationLocation ?? null;
  return candidate.destinationLocation ?? candidate.originLocation ?? null;
}

function routeModeForCandidate(candidate: OpportunityScoutCandidate, designMode: CommercialDesignMode, draftType: CommercialDraftType | null): CommercialRouteRequest["mode"] {
  if (draftType === "NEW_GRAPH_CORRIDOR") return "INDEPENDENT_GRAPH";
  if (candidate.mode === "AZ_BUILDER") return designMode === "NEW_INDEPENDENT_GRAPH" ? "INDEPENDENT_GRAPH" : "AZ_CORRIDOR";
  return designMode === "EXTEND_EXISTING_NETWORK" ? "EXTEND_EXISTING" : "LATERAL";
}

function importDispositionLabel(disposition: ImportDisposition) {
  return disposition.replaceAll("_", " ");
}

function sourceLabel(source: LiveProposalRouteSource) {
  return source.replaceAll("_", " ");
}

function customerIdForAccount(accountId: string) {
  if (accountId === "google") return "customer-google";
  if (accountId.startsWith("customer-")) return accountId;
  return `customer-${accountId}`;
}

function cleanCommercialSlug(value: string, fallback = "OPPORTUNITY") {
  const normalized = value
    .trim()
    .replace(/&/g, " AND ")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toUpperCase();
  return normalized || fallback;
}

function customerAwareOpportunityName(input: string, accountName: string) {
  const trimmed = input.trim();
  if (!trimmed) return `${accountName} Opportunity`;
  return trimmed.toLowerCase().startsWith(accountName.toLowerCase()) ? trimmed : `${accountName} ${trimmed}`;
}

function commercialRecordIdsForOpportunity(opportunityName: string, revision = 1, demoContext = false) {
  const slug = cleanCommercialSlug(opportunityName, "COMMERCIAL-OPPORTUNITY");
  const version = Math.max(1, Math.round(Number(revision) || 1));
  const context = demoContext ? { authorityClass: "DEMO", organizationId: "org-demo" } : null;
  return {
    slug,
    proposalId: governedClientId(`PROP-${slug}-v${version}`, context),
    workbookId: governedClientId(`WORKBOOK-${slug}-v${version}`, context),
    proposalPreviewId: governedClientId(`PROPOSAL-PREVIEW-${slug}-v${version}`, context),
    serviceOrderPreviewId: governedClientId(`SO-PREVIEW-${slug}-v${version}`, context),
  };
}

function sourceFileEvidence(fileName: string, disposition: ImportDisposition, storagePath: string) {
  return {
    fileName,
    disposition,
    storagePath,
    preservedAsEvidence: true,
    uploadedAt: new Date().toISOString(),
  };
}

function geometryBoundingBox(geometry: DALCoordinate[]) {
  if (!geometry.length) return null;
  return geometry.reduce(
    (box, coordinate) => ({
      west: Math.min(box.west, coordinate[0]),
      south: Math.min(box.south, coordinate[1]),
      east: Math.max(box.east, coordinate[0]),
      north: Math.max(box.north, coordinate[1]),
    }),
    { west: geometry[0][0], south: geometry[0][1], east: geometry[0][0], north: geometry[0][1] },
  );
}

function simplifyRouteGeometry(geometry: DALCoordinate[], targetPoints = 500) {
  if (geometry.length <= targetPoints) return geometry;
  const step = Math.max(1, Math.ceil(geometry.length / targetPoints));
  const simplified = geometry.filter((_, index) => index === 0 || index === geometry.length - 1 || index % step === 0);
  return simplified.at(-1) === geometry.at(-1) ? simplified : [...simplified, geometry.at(-1) as DALCoordinate];
}

function dalGeometryFromCommercialRouteResult(routeResult: CommercialRouteResult | null | undefined): DALCoordinate[] {
  return (routeResult?.geometry ?? []).map((coordinate) => [coordinate.longitude, coordinate.latitude] as DALCoordinate);
}

function commercialRouteGeometryHash(geometry: DALCoordinate[]) {
  return geometry.length > 1 ? hashRouteGeometry(geometry) : "missing";
}

function routeGeometryId(routeRepositoryId: string, geometryHash: string) {
  return `${routeRepositoryId}:geometry:${geometryHash}`;
}

function routeRepositoryIdForOpportunity(opportunityId: string, routeId: string) {
  return `ROUTE-REPO-${cleanCommercialSlug(opportunityId)}-${cleanCommercialSlug(routeId, "ROUTE")}`;
}

function attachmentMetadataFromEvidence(item: Record<string, unknown>, index: number) {
  const fileName = String(item.fileName ?? item.name ?? item.sourceName ?? `Attachment ${index + 1}`);
  return {
    attachmentId: String(item.attachmentId ?? item.evidenceId ?? `ATTACHMENT-${cleanCommercialSlug(fileName, "FILE")}-${index + 1}`),
    fileName,
    type: String(item.attachmentType ?? item.type ?? item.disposition ?? "IMPORTED_EVIDENCE"),
    originalImportDate: String(item.originalImportDate ?? item.uploadedAt ?? item.importedAt ?? item.createdAt ?? new Date().toISOString()),
    source: String(item.source ?? item.sourceSystem ?? item.disposition ?? "Commercial Planning"),
    repositoryLocation: String(item.repositoryLocation ?? item.storagePath ?? item.path ?? "Opportunity Repository"),
    sizeBytes: typeof item.sizeBytes === "number" ? item.sizeBytes : undefined,
    checksum: typeof item.checksum === "string" ? item.checksum : undefined,
  };
}

function evidenceFromSourceFile(item: Record<string, unknown>, opportunityId: string, index: number): CommercialRouteEvidence {
  const metadata = attachmentMetadataFromEvidence(item, index);
  return {
    evidenceId: metadata.attachmentId,
    fileName: metadata.fileName,
    type: metadata.type,
    source: metadata.source,
    repositoryLocation: metadata.repositoryLocation || `server/data/opportunities/${opportunityId}/evidence/${metadata.fileName}`,
    originalImportDate: metadata.originalImportDate,
    sizeBytes: metadata.sizeBytes,
    checksum: metadata.checksum,
    immutable: true,
  };
}

function generatedRouteEvidence(routeRepositoryId: string, routeId: string, geometryHash: string, timestamp: string): CommercialRouteEvidence {
  return {
    evidenceId: `EVIDENCE-${cleanCommercialSlug(routeRepositoryId)}-OSRM`,
    fileName: `${cleanCommercialSlug(routeId, "ROUTE")}.osrm-route.json`,
    type: "GENERATED_ROUTE_AUDIT",
    source: "OSRM Generate Route",
    repositoryLocation: `Commercial Route Repository/${routeRepositoryId}/generated-route`,
    originalImportDate: timestamp,
    checksum: geometryHash,
    immutable: true,
  };
}

const OPPORTUNITY_RESTORE_STEPS: Array<{ id: OpportunityRestoreStepId; label: string }> = [
  { id: "repository", label: "Repository" },
  { id: "route-repository", label: "Route Repository" },
  { id: "validation", label: "Validate" },
  { id: "restore", label: "Restore" },
  { id: "map", label: "Map" },
  { id: "estimate", label: "Estimate" },
  { id: "workbook", label: "Workbook" },
  { id: "proposal", label: "Proposal" },
  { id: "preview", label: "Proposal Preview" },
  { id: "service-order", label: "Service Order Preview" },
  { id: "attachments", label: "Attachments" },
  { id: "complete", label: "Complete" },
];

function createOpportunityRestoreState(
  status: OpportunityRestoreStatus = "IDLE",
  opportunityId = "",
  opportunityName = "",
): OpportunityRestoreState {
  return {
    status,
    opportunityId,
    opportunityName,
    steps: OPPORTUNITY_RESTORE_STEPS.map((step) => ({ ...step, status: "PENDING" as const })),
    log: [],
    warnings: [],
  };
}

function objectRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function recordArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(objectRecord(item))) : [];
}

function snapshotLabel(key: string) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function snapshotValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "Pending";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return `${value.length.toLocaleString()} item(s)`;
  if (typeof value === "object") return `${Object.keys(value as Record<string, unknown>).length.toLocaleString()} field(s)`;
  return String(value);
}

function snapshotRows(value: unknown) {
  const record = objectRecord(value);
  return record ? Object.entries(record).map(([key, entry]) => [snapshotLabel(key), snapshotValue(entry)] as [string, string]) : [];
}

function repositoryRecordPath(repository: string, id: string) {
  return `server/data/${repository}/${encodeURIComponent(id)}.json`;
}

function hasObjectPayload(value: unknown) {
  const record = objectRecord(value);
  return Boolean(record && Object.keys(record).length);
}

function hasArrayPayload(value: unknown) {
  return Array.isArray(value) && value.length > 0;
}

function hasCoordinateGeometry(value: unknown) {
  return Array.isArray(value) &&
    value.length > 1 &&
    value.every((point) => Array.isArray(point) && point.length >= 2 && point.every((coordinate) => typeof coordinate === "number" && Number.isFinite(coordinate)));
}

function hasImportedRouteGeometry(route: ImportedCustomerRoute | null | undefined) {
  return hasCoordinateGeometry(route?.dalGeometry) ||
    Boolean(route?.geometry?.length && route.geometry.length > 1 && route.geometry.every((coordinate) => (
      typeof coordinate.latitude === "number" &&
      Number.isFinite(coordinate.latitude) &&
      typeof coordinate.longitude === "number" &&
      Number.isFinite(coordinate.longitude)
    )));
}

function isRestorableCommercialDraft(value: unknown): value is CommercialCorridorDraft {
  const draft = objectRecord(value);
  const financialAuthority = objectRecord(draft?.financialAuthority);
  const transparentEstimate = objectRecord(draft?.transparentEstimate);
  return Boolean(
    draft &&
    draft.draftType === "NEW_GRAPH_CORRIDOR" &&
    typeof draft.routeId === "string" &&
    hasCoordinateGeometry(draft.geometry) &&
    typeof draft.routeMiles === "number" &&
    typeof draft.routeFeet === "number" &&
    Array.isArray(draft.routeSegments) &&
    Array.isArray(draft.unknownQuantities) &&
    Array.isArray(draft.financialValidationWarnings) &&
    Array.isArray(draft.vendorResponsePreview) &&
    financialAuthority &&
    typeof financialAuthority.constructionCost === "number" &&
    typeof financialAuthority.sellPrice === "number" &&
    transparentEstimate &&
    objectRecord(transparentEstimate.confidence) &&
    objectRecord(transparentEstimate.commercialReadiness) &&
    Array.isArray(transparentEstimate.sections)
  );
}

function restorableDraftFromOpportunity(record: CommercialOpportunityRecord) {
  if (isRestorableCommercialDraft(record.routeRepositorySnapshot?.commercialDraftSnapshot)) return record.routeRepositorySnapshot.commercialDraftSnapshot;
  if (isRestorableCommercialDraft(record.commercialDraftSnapshot)) return record.commercialDraftSnapshot;
  if (isRestorableCommercialDraft(record.selectedRouteSnapshot?.pricedDraft)) return record.selectedRouteSnapshot.pricedDraft;
  return null;
}

function hydrateOpportunityFromRouteRepository(
  record: CommercialOpportunityRecord,
  routeSnapshot: CommercialRouteRepositoryRecord | null,
): CommercialOpportunityRecord {
  if (!routeSnapshot) return record;
  return {
    ...record,
    routeRepositoryId: routeSnapshot.routeRepositoryId,
    routeRepositoryRef: {
      routeRepositoryId: routeSnapshot.routeRepositoryId,
      routeSnapshotId: routeSnapshot.routeSnapshotId,
      routeId: routeSnapshot.routeId,
      routeName: routeSnapshot.routeName,
      repositoryType: "COMMERCIAL_ROUTE_REPOSITORY",
    },
    routeRepositorySnapshot: routeSnapshot,
    routeName: routeSnapshot.routeName,
    routeGeometry: routeSnapshot.commercialGeometry,
    routeFeet: routeSnapshot.routeFeet,
    routeMiles: routeSnapshot.routeMiles,
    commercialDraftSnapshot: routeSnapshot.commercialDraftSnapshot ?? record.commercialDraftSnapshot,
    selectedRouteSnapshot: routeSnapshot.selectedRouteSnapshot ?? record.selectedRouteSnapshot,
    customerDesignImportSnapshot: routeSnapshot.sourceImportSnapshot ?? record.customerDesignImportSnapshot,
    importedEvidenceReferences: routeSnapshot.importedEvidence,
  };
}

function validateOpportunityRestoreRecord(record: CommercialOpportunityRecord) {
  const warnings: Array<{ stepId: OpportunityRestoreStepId; label: string; reason: string }> = [];
  const draft = restorableDraftFromOpportunity(record);
  const mapAvailable = Boolean(
    draft ||
    hasCoordinateGeometry(record.routeRepositorySnapshot?.commercialGeometry) ||
    hasImportedRouteGeometry(record.routeRepositorySnapshot?.selectedRouteSnapshot) ||
    hasImportedRouteGeometry(record.selectedRouteSnapshot) ||
    hasCoordinateGeometry(record.routeGeometry)
  );
  const estimateAvailable = Boolean(draft || hasObjectPayload(record.estimate));

  if (!mapAvailable) warnings.push({ stepId: "map", label: "Map", reason: "Missing route geometry in Opportunity Repository record." });
  if (!estimateAvailable) warnings.push({ stepId: "estimate", label: "Estimate", reason: "Missing estimate snapshot or restorable commercial draft." });
  if (!hasObjectPayload(record.commercialWorkbook)) warnings.push({ stepId: "workbook", label: "Workbook", reason: "Missing workbook.json." });
  if (!record.proposalId) warnings.push({ stepId: "proposal", label: "Proposal", reason: "Missing proposal id." });
  if (!hasObjectPayload(record.proposalPreview)) warnings.push({ stepId: "preview", label: "Proposal Preview", reason: "Missing proposal preview payload." });
  if (!hasObjectPayload(record.serviceOrderPreview)) warnings.push({ stepId: "service-order", label: "Service Order Preview", reason: "Missing service order preview payload." });
  if (
    !hasArrayPayload(record.attachments) &&
    !hasArrayPayload(record.sourceFiles) &&
    !hasArrayPayload(record.importedEvidenceReferences) &&
    !hasArrayPayload(record.routeRepositorySnapshot?.importedEvidence)
  ) {
    warnings.push({ stepId: "attachments", label: "Attachments", reason: "Missing attachments or source file evidence." });
  }

  return { warnings, draft, mapAvailable, estimateAvailable };
}

function restoreWarningText(label: string, reason: string) {
  return `Unable to restore ${label}. Continue loading remaining Opportunity? Continuing. Reason: ${reason}`;
}

function isCommercialWorkspaceView(value: unknown): value is CommercialWorkspaceView {
  return typeof value === "string" && COMMERCIAL_WORKSPACE_VIEWS.includes(value as CommercialWorkspaceView);
}

function safeRestoreWorkspaceView(value: unknown): CommercialWorkspaceView {
  return isCommercialWorkspaceView(value) && value !== "networks" ? value : "proposal";
}

function safeRestoreDraftType(value: unknown, draft: CommercialCorridorDraft | null): CommercialDraftType | null {
  return value === "NEW_GRAPH_CORRIDOR" || value === "EXISTING_GRAPH_EXTENSION"
    ? value
    : draft ? "NEW_GRAPH_CORRIDOR" : null;
}

function cleanAccountId(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

function emptyAccountEditor(currentUserName: string): AccountEditorState {
  return {
    accountId: "",
    name: "",
    accountType: "Prospect",
    status: "Prospect",
    salesOwner: currentUserName,
    primaryEngineeringContact: "TBD",
    procurementContact: "TBD",
    notes: "Governed Account workspace root.",
  };
}

function contactEditorDefaults(): ContactEditorState {
  return {
    name: "",
    title: "",
    role: "Commercial",
    email: "",
    phone: "",
  };
}

function accountEditorFromAccount(account: CommercialAccountFixture): AccountEditorState {
  return {
    accountId: account.accountId,
    name: account.name,
    accountType: account.accountType,
    status: account.status,
    salesOwner: account.salesOwner,
    primaryEngineeringContact: account.primaryEngineeringContact,
    procurementContact: account.procurementContact,
    notes: account.notes,
  };
}

function commercialAccountFromGoverned(
  account: GovernedAccount,
  contacts: GovernedContact[],
  fallback?: CommercialAccountFixture,
): CommercialAccountFixture {
  const contactNames = contacts.length
    ? contacts.map((contact) => contact.name)
    : (account.contacts?.length ? account.contacts : fallback?.contacts ?? []);
  return {
    accountId: account.accountId,
    accountNumber: Number(account.accountNumber ?? fallback?.accountNumber ?? 0),
    name: account.name,
    accountType: account.accountType ?? fallback?.accountType ?? "Prospect",
    status: account.status ?? fallback?.status ?? "Prospect",
    salesOwner: account.salesOwner ?? fallback?.salesOwner ?? "Teralinx",
    primaryEngineeringContact: account.primaryEngineeringContact ?? fallback?.primaryEngineeringContact ?? "TBD",
    procurementContact: account.procurementContact ?? fallback?.procurementContact ?? "TBD",
    contacts: contactNames,
    activeOpportunities: account.activeOpportunities?.length ? account.activeOpportunities : fallback?.activeOpportunities ?? [],
    existingNetworks: account.existingNetworks?.length ? account.existingNetworks : fallback?.existingNetworks ?? [],
    operationalObjects: account.operationalObjects?.length ? account.operationalObjects : fallback?.operationalObjects ?? [],
    commercialEngagements: account.commercialEngagements?.length ? account.commercialEngagements : fallback?.commercialEngagements ?? [],
    proposalHistory: account.proposalHistory?.length ? account.proposalHistory : fallback?.proposalHistory ?? [],
    customerReviewHistory: account.customerReviewHistory?.length ? account.customerReviewHistory : fallback?.customerReviewHistory ?? [],
    engineeringHistory: account.engineeringHistory?.length ? account.engineeringHistory : fallback?.engineeringHistory ?? [],
    notes: account.notes ?? fallback?.notes ?? "Governed Account workspace root.",
  };
}

function proposalRuntimeStatusLabel(status: string | undefined) {
  return status ? status.replaceAll("_", " ") : "No commercial proposal";
}

function displayTimestamp(value: string | null | undefined) {
  if (!value) return "Not recalculated in this session";
  return new Date(value).toLocaleString();
}

function defaultNetworkLayerState(network: CommercialNetworkRecord): NetworkLayerState {
  return {
    visible: network.visibleByDefault,
    locked: network.lockedByDefault,
    activeReference: network.activeReferenceByDefault,
    diversityConstraint: Boolean(network.diversityConstraintByDefault),
  };
}

function resolveNetworkLayerState(
  network: CommercialNetworkRecord,
  layerStates: Record<string, NetworkLayerState>,
): NetworkLayerState {
  return layerStates[network.networkId] ?? defaultNetworkLayerState(network);
}

function formatRouteMiles(value: number | null) {
  return value === null ? "Pending parse" : Number(value.toFixed(2)).toLocaleString();
}

function geometryForImportedRoute(route: ImportedCustomerRoute | null | undefined): DALCoordinate[] {
  if (!route) return [];
  return route.dalGeometry?.length
    ? route.dalGeometry
    : (route.geometry ?? []).map((coordinate) => [coordinate.longitude, coordinate.latitude] as DALCoordinate);
}

function commercialDraftRouteIdForImportedRoute(routeId: string) {
  return `COMMERCIAL-DRAFT-${routeId}`.replace(/[^a-zA-Z0-9-]/g, "-");
}

function defaultTransparentEstimateControls(): TransparentEstimateControls {
  return {
    ...DEFAULT_TRANSPARENT_ESTIMATE_CONTROLS,
    production: { ...DEFAULT_TRANSPARENT_ESTIMATE_CONTROLS.production },
    financial: { ...DEFAULT_TRANSPARENT_ESTIMATE_CONTROLS.financial },
    ilaPlanning: {
      ...DEFAULT_TRANSPARENT_ESTIMATE_CONTROLS.ilaPlanning,
      stationOverrides: { ...(DEFAULT_TRANSPARENT_ESTIMATE_CONTROLS.ilaPlanning.stationOverrides ?? {}) },
    },
    constraints: {},
    algorithmConstraints: {},
    humanAuditTrail: [],
  };
}

function buildImportedCustomerDesignGraph(importRecord: CustomerDesignImport, route: ImportedCustomerRoute, draft: CommercialCorridorDraft | null): ProposedGraph | null {
  const graphId = `PROPOSED-GRAPH-${importRecord.designId}-${route.routeId}`;
  const geometry = geometryForImportedRoute(route);
  if (geometry.length < 2) return null;
  const first = geometry[0];
  const last = geometry.at(-1) ?? first;
  const routeFeet = route.routeFeet || Math.round(route.routeMiles * 5280);
  const routeMiles = route.routeMiles || routeFeet / 5280;
  const generatedAt = new Date().toISOString();
  const nodes = [
    {
      id: `${graphId}:A`,
      type: "A_SITE" as const,
      name: `${route.name} A`,
      lng: first[0],
      lat: first[1],
      stationLabel: "A Site",
      estimatedCost: 0,
      estimatedConstructionType: "UNKNOWN" as const,
      status: "CUSTOMER_REVIEW" as const,
      comments: ["Imported customer design endpoint. Engineering validation required."],
      confidence: route.confidence,
      readiness: "READY_FOR_PROPOSAL" as const,
      metadata: { designId: importRecord.designId, importId: importRecord.importId, routeId: route.routeId },
      readOnly: true as const,
    },
    {
      id: `${graphId}:Z`,
      type: "Z_SITE" as const,
      name: `${route.name} Z`,
      lng: last[0],
      lat: last[1],
      stationLabel: "Z Site",
      estimatedCost: 0,
      estimatedConstructionType: "UNKNOWN" as const,
      status: "CUSTOMER_REVIEW" as const,
      comments: ["Imported customer design endpoint. Engineering validation required."],
      confidence: route.confidence,
      readiness: "READY_FOR_PROPOSAL" as const,
      metadata: { designId: importRecord.designId, importId: importRecord.importId, routeId: route.routeId },
      readOnly: true as const,
    },
  ];
  const routeStatistics = {
    totalRouteLengthFeet: routeFeet,
    totalRouteLengthMiles: routeMiles,
    fiberFeet: routeFeet,
    ductFeet: routeFeet,
    estimatedStationCount: Math.max(2, Math.ceil(routeFeet / 1000) + 1),
    estimatedVaultCount: draft?.vaultCount ?? 0,
    estimatedRegenCount: draft?.regenCount ?? 0,
    estimatedHighwayCrossings: 0,
    estimatedRailroadCrossings: 0,
    estimatedWaterCrossings: 0,
    estimatedUrbanSegments: 0,
    estimatedRuralSegments: Math.max(1, draft?.routeSegments.length ?? 1),
    estimatedConstructionCost: draft?.financialAuthority.constructionCost ?? 0,
    confidenceScore: route.confidence,
    estimatedOnly: true as const,
  };
  return {
    proposedGraphId: graphId,
    proposalId: `CUSTOMER-DESIGN-PROPOSAL-${importRecord.designId}`,
    customerId: importRecord.accountId,
    customerName: importRecord.customerName,
    opportunityId: importRecord.designId,
    opportunityName: route.name,
    routeRequestId: importRecord.importId,
    sourceDesignLaunchId: importRecord.designId,
    designDoctrineId: "CUSTOMER_DESIGN_IMPORT",
    routeCandidateId: `ROUTE-CANDIDATE-${route.routeId}`,
    networkType: "LONG_HAUL",
    networkClass: "LONG_HAUL",
    topology: "LINEAR",
    protection: "LINEAR",
    protectionClass: "NONE",
    primaryProduct: "DUCT_PLUS_FIBER",
    nodes,
    edges: [
      {
        id: `${graphId}:CUSTOMER-BASELINE`,
        segmentId: `${route.routeId}:CUSTOMER-BASELINE`,
        from: nodes[0].id,
        to: nodes[1].id,
        estimatedDistance: routeFeet,
        estimatedFiberFeet: routeFeet,
        estimatedDuctFeet: routeFeet,
        estimatedCost: draft?.financialAuthority.constructionCost,
        constructionType: "UNKNOWN",
        crossings: [],
        confidence: route.confidence,
        comments: ["Commercial Planning is estimating against imported customer geometry. OSRM is not regenerated unless explicitly requested."],
        engineeringNotes: ["Commercial Baseline preserves customer import geometry."],
        coordinates: geometry,
        metadata: { designId: importRecord.designId, importId: importRecord.importId, routeId: route.routeId, commercialBaseline: true },
        readOnly: true,
      },
    ],
    statistics: {
      totalMiles: routeMiles,
      fiberFeet: routeFeet,
      ductFeet: routeFeet,
      estimatedStationCount: routeStatistics.estimatedStationCount,
      estimatedVaults: draft?.vaultCount ?? 0,
      estimatedRegenSites: draft?.regenCount ?? 0,
      estimatedCabinets: 0,
      estimatedCrossings: 0,
      estimatedHighwayCrossings: 0,
      estimatedRailroadCrossings: 0,
      estimatedWaterCrossings: 0,
      estimatedUrbanSegments: 0,
      estimatedRuralSegments: routeStatistics.estimatedRuralSegments,
      estimatedConstructionCost: draft?.financialAuthority.constructionCost ?? 0,
      confidenceScore: route.confidence,
      routeCandidateDerived: false,
      estimatedOnly: true,
    },
    routeStatistics,
    routeCandidate: {
      routeCandidateId: `ROUTE-CANDIDATE-${route.routeId}`,
      sourceDesignLaunchId: importRecord.designId,
      designDoctrineId: "CUSTOMER_DESIGN_IMPORT",
      networkClass: "LONG_HAUL",
      topology: "LINEAR",
      protectionClass: "NONE",
      geometry,
      nodes: [],
      segments: [],
      constraints: [],
      engineeringConstraintCandidates: [],
      statistics: routeStatistics,
      estimatedConstructionProfile: "CUSTOMER_IMPORTED",
      estimatedMaterialProfile: "CUSTOMER_IMPORTED",
      estimatedFacilityProfile: "CUSTOMER_IMPORTED",
      generatedAt,
      diagnostics: [],
      salesEstimate: true,
      engineeringCertificationRequired: true,
      noScopeVersionCreation: true,
      noInventoryMutation: true,
      noPersistence: true,
    } as ProposedGraph["routeCandidate"],
    engineeringConstraintCandidates: [],
    readiness: "READY_FOR_PROPOSAL",
    diagnostics: [],
    generatedAt,
    metadata: {
      designId: importRecord.designId,
      importId: importRecord.importId,
      routeId: route.routeId,
      commercialBaselineSource: "IMPORTED_CUSTOMER_DESIGN",
      noOsrmRegeneration: true,
    },
    readOnly: true,
    noEngineering: true,
    salesEstimate: true,
    engineeringCertificationRequired: true,
    noScopeVersionCreation: true,
    noInventoryMutation: true,
    noPersistence: true,
  };
}

function customerDraftToNetworkRecord(draft: CustomerDraftRecord, account: CommercialAccountFixture): CommercialNetworkRecord {
  return {
    networkId: draft.customerDraftId,
    accountId: draft.accountId,
    name: `${account.name} draft ${draft.source}`,
    networkCategory: "CUSTOMER_DRAFT",
    authorityState: "CUSTOMER_DRAFT_NETWORK",
    importSource: draft.source === "COMMENT" ? "MANUAL" : draft.source,
    sourceAssetName: draft.source === "COMMENT" ? "Customer comment" : `Customer supplied ${draft.source}`,
    source: "Customer review workflow",
    importDate: draft.createdAt,
    routeMiles: null,
    status: draft.status.replaceAll("_", " "),
    lastUpdated: draft.createdAt,
    geometryStatus: "Commercial review input only",
    objectCount: 0,
    revisionCount: 0,
    confidence: "Customer supplied draft",
    visibleByDefault: true,
    lockedByDefault: false,
    activeReferenceByDefault: false,
    noScopeVersionCreation: true,
    noInventoryAuthorityMutation: true,
  };
}

function acceptedProposalToNetworkRecord(accepted: AcceptedProposal): CommercialNetworkRecord {
  return {
    networkId: accepted.acceptedProposalId,
    accountId: accepted.accountId,
    name: `${accepted.accountName} accepted proposal`,
    networkCategory: "ACCEPTED_PROPOSAL",
    authorityState: "ACCEPTED_PROPOSAL_NETWORK",
    importSource: "LIVE_SESSION",
    sourceAssetName: "AcceptedProposal commercial package",
    source: "Customer Review",
    importDate: accepted.acceptedAt,
    routeMiles: accepted.acceptedCommercialSummary.reconciliation.routeMiles,
    status: "Accepted for Engineering handoff",
    lastUpdated: accepted.acceptedAt,
    geometryStatus: "Accepted commercial overlay; not Customer Inventory",
    objectCount: accepted.acceptedRouteGeometry.length,
    revisionCount: accepted.proposalSnapshots.length,
    confidence: "Customer accepted",
    visibleByDefault: false,
    lockedByDefault: true,
    activeReferenceByDefault: false,
    noScopeVersionCreation: true,
    noInventoryAuthorityMutation: true,
  };
}

function mapVisibility(visible: boolean): CommercialMapVisibility {
  return visible ? "VISIBLE" : "HIDDEN";
}

function mapLockState(locked: boolean): CommercialMapLockState {
  return locked ? "LOCKED" : "EDITABLE";
}

function customerTwinRouteUseForLayerState(layerState: NetworkLayerState): CustomerTwinRouteUse {
  if (layerState.diversityConstraint) return "DIVERSITY_CONSTRAINT";
  if (layerState.activeReference) return "ATTACHMENT_CANDIDATE";
  return "REFERENCE_ONLY";
}

function buildCommercialMapLayers(args: {
  account: CommercialAccountFixture;
  customerTwinState: CustomerTwinRenderableState | null;
  networks: CommercialNetworkRecord[];
  layerStates: Record<string, NetworkLayerState>;
  customerReviewStatus: CustomerReviewStatus;
  salesDraftActive: boolean;
  importedDesignActive: boolean;
  importedDesignLabel?: string;
  importedDesignRouteMiles?: number;
  customerDraftActive: boolean;
  acceptedProposal: AcceptedProposal | null;
}): CommercialMapLayer[] {
  const layers: CommercialMapLayer[] = [
    {
      id: "base-map",
      label: "Base Map",
      domain: "BASE_MAP",
      accountId: args.account.accountId,
      authority: "System",
      owner: "Map",
      visibility: "VISIBLE",
      lockState: "LOCKED",
      renderState: "REFERENCE",
      zIndex: commercialMapZIndex("BASE_MAP", "BASE"),
      source: "OpenStreetMap tiles",
      refreshMode: "SESSION_FROZEN",
      featureScope: "BASE",
      featureCount: 1,
    },
    {
      id: "enrichment-overlays",
      label: "Enrichment",
      domain: "ENRICHMENT",
      accountId: args.account.accountId,
      authority: "System",
      owner: "Commercial Planning",
      visibility: "HIDDEN",
      lockState: "LOCKED",
      renderState: "INACTIVE",
      zIndex: commercialMapZIndex("ENRICHMENT", "REVIEW"),
      source: "Optional overlays",
      refreshMode: "USER_REFRESH",
      featureScope: "REVIEW",
      featureCount: 0,
    },
  ];

  const networkByTwinLayerId = new Map(
    args.networks
      .filter((network) => network.inventoryLayerId)
      .map((network) => [network.inventoryLayerId, network]),
  );

  (args.customerTwinState?.layers ?? []).forEach((twinLayer) => {
    if (twinLayer.domain !== "EXISTING_INVENTORY" && twinLayer.domain !== "CUSTOMER_PROPOSED") return;
    const network = networkByTwinLayerId.get(twinLayer.layerId);
    const layerState = network ? resolveNetworkLayerState(network, args.layerStates) : {
      visible: twinLayer.visibleByDefault,
      locked: true,
      activeReference: twinLayer.visibleByDefault,
      diversityConstraint: twinLayer.routeUse === "DIVERSITY_CONSTRAINT",
    };
    const domain = twinLayer.domain === "CUSTOMER_PROPOSED" ? "CUSTOMER_PROPOSED_NETWORK" : "CUSTOMER_INVENTORY";
    const laneLabel = twinLayer.domain === "CUSTOMER_PROPOSED" ? "Customer Design Request" : "Existing Inventory";
    const renderState = layerState.activeReference ? "ACTIVE" : "REFERENCE";
    layers.push({
      id: `${twinLayer.layerId}:objects`,
      label: `${laneLabel} Objects - ${twinLayer.label}`,
      domain: "CUSTOMER_INVENTORY",
      accountId: twinLayer.accountId,
      authority: "Customer",
      owner: args.account.name,
      visibility: mapVisibility(twinLayer.domain === "EXISTING_INVENTORY" && layerState.visible && twinLayer.objectCount > 0),
      lockState: "LOCKED",
      renderState,
      zIndex: commercialMapZIndex("CUSTOMER_INVENTORY", "OBJECTS"),
      source: `Customer Twin: ${twinLayer.sourceAssetName}`,
      refreshMode: "SESSION_FROZEN",
      featureScope: "OBJECTS",
      featureCount: twinLayer.objectCount + twinLayer.stationCount,
      sourceLayerId: twinLayer.layerId,
      sourceNetworkId: network?.networkId,
    });
    layers.push({
      id: `${twinLayer.layerId}:routes`,
      label: `${laneLabel} - ${twinLayer.label}`,
      domain,
      accountId: twinLayer.accountId,
      authority: "Customer",
      owner: args.account.name,
      visibility: mapVisibility(layerState.visible),
      lockState: "LOCKED",
      renderState,
      zIndex: commercialMapZIndex(domain, "ROUTES"),
      source: `Customer Twin: ${twinLayer.sourceAssetName}`,
      refreshMode: "SESSION_FROZEN",
      featureScope: "ROUTES",
      featureCount: twinLayer.routeCount,
      routeMiles: twinLayer.routeMiles,
      sourceLayerId: twinLayer.layerId,
      sourceNetworkId: network?.networkId,
    });
  });

  const salesDraftNetwork = args.networks.find((network) => network.networkCategory === "COMMERCIAL_DRAFT" && resolveNetworkLayerState(network, args.layerStates).activeReference);
  layers.push({
    id: "customer-design:active-imported-baseline",
    label: args.importedDesignLabel ? `Customer Design Request - ${args.importedDesignLabel}` : "Customer Design Request",
    domain: "CUSTOMER_PROPOSED_NETWORK",
    accountId: args.account.accountId,
    authority: "Customer",
    owner: args.account.name,
    visibility: mapVisibility(args.importedDesignActive),
    lockState: "LOCKED",
    renderState: args.importedDesignActive ? "ACTIVE" : "INACTIVE",
    zIndex: commercialMapZIndex("CUSTOMER_PROPOSED_NETWORK", "ROUTES"),
    source: args.importedDesignActive ? "Customer Design Request Library" : "No design request selected",
    refreshMode: "SESSION_FROZEN",
    featureScope: "ROUTES",
    featureCount: args.importedDesignActive ? 1 : 0,
    routeMiles: args.importedDesignRouteMiles,
  });

  layers.push({
    id: "sales-commercial-draft:active-corridor",
    label: salesDraftNetwork?.name ? `Commercial Opportunity - ${salesDraftNetwork.name}` : "Commercial Opportunity",
    domain: "SALES_COMMERCIAL_DRAFT",
    accountId: args.account.accountId,
    authority: "Sales",
    owner: "Ryan",
    visibility: mapVisibility(args.salesDraftActive),
    lockState: args.salesDraftActive ? "EDITABLE" : "LOCKED",
    renderState: args.salesDraftActive ? "ACTIVE" : "INACTIVE",
    zIndex: commercialMapZIndex("SALES_COMMERCIAL_DRAFT", "CORRIDOR"),
    source: salesDraftNetwork?.sourceAssetName ?? "Explicit working set action required",
    refreshMode: "LIVE_DRAFT",
    featureScope: "CORRIDOR",
    featureCount: args.salesDraftActive ? 1 : 0,
    sourceNetworkId: salesDraftNetwork?.networkId,
  });

  layers.push({
    id: "customer-draft:active-review-route",
    label: "Customer Design Request Draft",
    domain: "CUSTOMER_DRAFT",
    accountId: args.account.accountId,
    authority: "Customer",
    owner: args.account.name,
    visibility: mapVisibility(args.customerDraftActive),
    lockState: args.customerDraftActive ? "EDITABLE" : "LOCKED",
    renderState: args.customerDraftActive ? "ACTIVE" : "INACTIVE",
    zIndex: commercialMapZIndex("CUSTOMER_DRAFT", "CORRIDOR"),
    source: args.customerDraftActive ? "Customer review upload" : "Not loaded",
    refreshMode: "USER_REFRESH",
    featureScope: "CORRIDOR",
    featureCount: args.customerDraftActive ? 1 : 0,
  });

  layers.push({
    id: "shared-review:merged-proposal",
    label: "Shared Review",
    domain: "SHARED_REVIEW",
    accountId: args.account.accountId,
    authority: "Commercial Review",
    owner: "Commercial Review",
    visibility: mapVisibility(args.customerReviewStatus === "IN_REVIEW"),
    lockState: "LOCKED",
    renderState: args.customerReviewStatus === "IN_REVIEW" ? "ACTIVE" : "INACTIVE",
    zIndex: commercialMapZIndex("SHARED_REVIEW", "REVIEW"),
    source: "Review workflow",
    refreshMode: "REVIEW_ONLY",
    featureScope: "REVIEW",
    featureCount: args.customerReviewStatus === "IN_REVIEW" ? 1 : 0,
  });

  layers.push({
    id: "accepted-proposal:engineering-handoff",
    label: "Accepted Design",
    domain: "ACCEPTED_PROPOSAL",
    accountId: args.account.accountId,
    authority: "Commercial Review",
    owner: "Commercial Review",
    visibility: "HIDDEN",
    lockState: "LOCKED",
    renderState: args.acceptedProposal ? "REFERENCE" : "INACTIVE",
    zIndex: commercialMapZIndex("ACCEPTED_PROPOSAL", "CORRIDOR"),
    source: args.acceptedProposal?.acceptedProposalId ?? "Not accepted",
    refreshMode: "REVIEW_ONLY",
    featureScope: "CORRIDOR",
    featureCount: args.acceptedProposal ? 1 : 0,
  });

  layers.push({
    id: "engineering-draft:runtime-handoff",
    label: "Engineering Draft",
    domain: "ENGINEERING_DRAFT",
    accountId: args.account.accountId,
    authority: "Engineering",
    owner: "Engineering",
    visibility: "HIDDEN",
    lockState: "LOCKED",
    renderState: args.acceptedProposal ? "REFERENCE" : "INACTIVE",
    zIndex: commercialMapZIndex("ENGINEERING_DRAFT", "CORRIDOR"),
    source: args.acceptedProposal?.acceptedProposalId ?? "No engineering draft selected",
    refreshMode: "REVIEW_ONLY",
    featureScope: "CORRIDOR",
    featureCount: args.acceptedProposal ? 1 : 0,
  });

  layers.push({
    id: "field-certified:future-runtime",
    label: "Field Certified",
    domain: "FIELD_CERTIFIED",
    accountId: args.account.accountId,
    authority: "Field",
    owner: "Field",
    visibility: "HIDDEN",
    lockState: "LOCKED",
    renderState: "INACTIVE",
    zIndex: commercialMapZIndex("FIELD_CERTIFIED", "CORRIDOR"),
    source: "Field certification runtime lane",
    refreshMode: "REVIEW_ONLY",
    featureScope: "CORRIDOR",
    featureCount: 0,
  });

  layers.push({
    id: "operational:future-runtime",
    label: "Operational",
    domain: "OPERATIONAL",
    accountId: args.account.accountId,
    authority: "Operations",
    owner: "Operations",
    visibility: "HIDDEN",
    lockState: "LOCKED",
    renderState: "INACTIVE",
    zIndex: commercialMapZIndex("OPERATIONAL", "CORRIDOR"),
    source: "Operational Intelligence runtime lane",
    refreshMode: "REVIEW_ONLY",
    featureScope: "CORRIDOR",
    featureCount: 0,
  });

  return sortCommercialMapLayers(layers);
}

function CommercialRecalculationNotice() {
  return (
    <section className="dal-panel bid-recalculation-panel">
      <div className="dal-panel-title-row">
        <h3>Recalculating Commercial Plan...</h3>
        <span className="dal-badge warning">Live draft route changed</span>
      </div>
      <div className="dal-status">
        The active editable proposal corridor is being resnapped and repriced. Stationing, takeoff, materials,
        splicing, pricing, vendor response, readiness, and supporting information will refresh from the same live SelectedScopePricingSummary.
      </div>
    </section>
  );
}

function CommercialStatusBar({
  account,
  session,
  customerReviewStatus,
  acceptedProposal,
  engineeringConfidence,
  commercialConfidence,
  estimateConfidence,
  unknownConstraintCount,
  osrmStatus,
  estimateStatus,
  proposalStatus,
  draftVersion,
  lastRecalculatedAt,
  unsavedChanges,
}: {
  account: CommercialAccountFixture;
  session: LiveCommercialSession | null;
  customerReviewStatus: CustomerReviewStatus;
  acceptedProposal: AcceptedProposal | null;
  engineeringConfidence: string;
  commercialConfidence: string;
  estimateConfidence: string;
  unknownConstraintCount: number;
  osrmStatus: string;
  estimateStatus: string;
  proposalStatus: string;
  draftVersion: string;
  lastRecalculatedAt: string | null;
  unsavedChanges: boolean;
}) {
  const routeSource = session?.routeSource ?? "ORIGINAL";
  const owner = acceptedProposal ? "Engineering" : session?.currentOwner ?? "Sales";
  return (
    <section className="commercial-health-strip" aria-label="Commercial health">
      <div><span>Engineering Confidence</span><b>{engineeringConfidence}</b></div>
      <div><span>Commercial Confidence</span><b>{commercialConfidence}</b></div>
      <div><span>Estimate Confidence</span><b>{estimateConfidence}</b></div>
      <div><span>Unknown Constraints</span><b>{unknownConstraintCount.toLocaleString()}</b></div>
      <div><span>OSRM</span><b>{osrmStatus}</b></div>
      <div><span>Estimate Status</span><b>{estimateStatus}</b></div>
      <div><span>Proposal Status</span><b>{proposalStatus}</b></div>
      <div><span>Draft Version</span><b>{draftVersion}</b></div>
      <div><span>Last Recalculated</span><b>{shortTimestamp(lastRecalculatedAt)}</b></div>
      <div><span>Unsaved Changes</span><b>{unsavedChanges ? "Yes" : "No"}</b></div>
      <div><span>Route Source</span><b>{sourceLabel(routeSource)}</b></div>
      <div><span>Owner</span><b>{owner}</b></div>
      <div><span>Review</span><b>{customerReviewStatus.replaceAll("_", " ")}</b></div>
      <div><span>Account</span><b>{account.name}</b></div>
      <div><span>Opportunity</span><b>{account.commercialEngagements[0]}</b></div>
    </section>
  );
}

function LiveCommercialSessionPanel({
  session,
  selectedScopeLabel,
  pricingSummary,
  recalculating,
  onSaveRevision,
}: {
  session: LiveCommercialSession | null;
  selectedScopeLabel: string;
  pricingSummary: SelectedScopePricingSummary;
  recalculating: boolean;
  onSaveRevision: () => void;
}) {
  const status = recalculating ? "RECALCULATING" : session?.recalculationStatus ?? "CURRENT";
  const routeSource = session?.routeSource ?? "ORIGINAL";
  return (
    <section className="dal-panel bid-live-draft-panel">
      <div className="dal-panel-title-row">
        <h3>Live Commercial Session</h3>
        <span className={`dal-badge ${status === "ERROR" ? "fail" : status === "RECALCULATING" ? "warning" : "pass"}`}>
          {status.replaceAll("_", " ")}
        </span>
      </div>
      <div className="teralinx-summary-grid">
        <div><span>Active Route Source</span><b>{sourceLabel(routeSource)}</b></div>
        <div><span>Unsaved Changes</span><b>{session?.dirty ? "Yes" : "No"}</b></div>
        <div><span>Last Recalculated</span><b>{displayTimestamp(session?.lastRecalculatedAt)}</b></div>
        <div><span>Last Autosaved</span><b>{displayTimestamp(session?.lastAutosavedAt)}</b></div>
        <div><span>Pricing Scope</span><b>{selectedScopeLabel}</b></div>
        <div><span>Route Miles</span><b>{Number(pricingSummary.reconciliation.routeMiles.toFixed(2)).toLocaleString()}</b></div>
        <div><span>Budget Cost</span><b>{money(pricingSummary.reconciliation.budgetCost)}</b></div>
        <div><span>Sell Price</span><b>{money(pricingSummary.reconciliation.sellPriceIru)}</b></div>
        <div><span>Snapshots</span><b>{session?.snapshotCount ?? 0}</b></div>
        <div><span>Customer Review</span><b>{session?.customerReviewStatus.replaceAll("_", " ") ?? "NOT STARTED"}</b></div>
        <div><span>Current Owner</span><b>{session?.currentOwner ?? "Sales"}</b></div>
      </div>
      {session?.errorMessage ? <div className="dal-status bid-recalculation-status">{session.errorMessage}</div> : null}
      <div className="dal-actions">
        <button type="button" onClick={onSaveRevision} disabled={!session?.dirty || recalculating}>
          Save Revision
        </button>
        <span className="dal-status">Save Revision preserves the already-current commercial state through the Commercial Change Set path.</span>
      </div>
    </section>
  );
}

function CommercialNetworksPanel({
  networks,
  layerStates,
  onToggleVisibility,
  onToggleLock,
  onToggleActiveReference,
  onToggleDiversityConstraint,
}: {
  networks: CommercialNetworkRecord[];
  layerStates: Record<string, NetworkLayerState>;
  onToggleVisibility: (networkId: string) => void;
  onToggleLock: (networkId: string) => void;
  onToggleActiveReference: (networkId: string) => void;
  onToggleDiversityConstraint: (networkId: string) => void;
}) {
  return (
    <div className="commercial-network-sections">
      {NETWORK_CATEGORY_ORDER.map((category) => {
        const categoryNetworks = networks.filter((network) => network.networkCategory === category);
        return (
          <details className="commercial-network-section" key={category} open={category === "CUSTOMER_INVENTORY"}>
            <summary>
              <span>{NETWORK_CATEGORY_LABELS[category]}</span>
              <b>{categoryNetworks.length.toLocaleString()}</b>
            </summary>
            {categoryNetworks.length ? (
              <div className="commercial-network-table-wrap">
                <table className="commercial-network-table">
                  <thead>
                    <tr>
                      <th>Network Name</th>
                      <th>Account</th>
                      <th>Authority State</th>
                      <th>Source</th>
                      <th>Parsed Status</th>
                      <th>Route Miles</th>
                      <th>Features</th>
                      <th>Stations</th>
                      <th>Last Updated</th>
                      <th>Visible</th>
                      <th>Lock Layer</th>
                      <th>Active Reference</th>
                      <th>Diversity Constraint</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryNetworks.map((network) => {
                      const layerState = resolveNetworkLayerState(network, layerStates);
                      const readOnlyInventoryLayer = network.networkCategory === "CUSTOMER_INVENTORY" || network.networkCategory === "CUSTOMER_PROPOSED" || network.networkCategory === "IMPORTED" || network.networkCategory === "FUTURE_GIS";
                      return (
                        <tr key={network.networkId}>
                          <td>
                            <b>{network.name}</b>
                            <small>{network.geometryStatus}</small>
                          </td>
                          <td>{network.accountId}</td>
                          <td>{network.authorityState.replaceAll("_", " ")}</td>
                          <td>
                            <span>{network.importSource}</span>
                            <small>{network.sourceAssetName}</small>
                          </td>
                          <td>
                            <span>{network.parsedStatus ?? "PARSED"}</span>
                            <small>{network.status}</small>
                          </td>
                          <td>{formatRouteMiles(network.routeMiles)}</td>
                          <td>{(network.featureCount ?? network.objectCount).toLocaleString()}</td>
                          <td>{(network.stationCount ?? 0).toLocaleString()}</td>
                          <td>{network.lastUpdated}</td>
                          <td>
                            <label className="commercial-network-toggle">
                              <input
                                type="checkbox"
                                checked={layerState.visible}
                                onChange={() => onToggleVisibility(network.networkId)}
                              />
                              <span>{layerState.visible ? "Shown" : "Hidden"}</span>
                            </label>
                          </td>
                          <td>
                            <label className="commercial-network-toggle">
                              <input
                                type="checkbox"
                                checked={layerState.locked}
                                disabled={readOnlyInventoryLayer}
                                onChange={() => onToggleLock(network.networkId)}
                              />
                              <span>{layerState.locked ? "Locked" : "Editable"}</span>
                            </label>
                          </td>
                          <td>
                            <label className="commercial-network-toggle">
                              <input
                                type="checkbox"
                                checked={layerState.activeReference}
                                onChange={() => onToggleActiveReference(network.networkId)}
                              />
                              <span>{layerState.activeReference ? "Active" : "Available"}</span>
                            </label>
                          </td>
                          <td>
                            <label className="commercial-network-toggle">
                              <input
                                type="checkbox"
                                checked={layerState.diversityConstraint}
                                disabled={network.networkCategory !== "CUSTOMER_INVENTORY" && network.networkCategory !== "CUSTOMER_PROPOSED"}
                                onChange={() => onToggleDiversityConstraint(network.networkId)}
                              />
                              <span>{layerState.diversityConstraint ? "Constraint" : "Reference"}</span>
                            </label>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="dal-status">No {NETWORK_CATEGORY_LABELS[category].toLowerCase()} loaded for this account.</div>
            )}
          </details>
        );
      })}
    </div>
  );
}

function CommercialMapLayerManagerPanel({
  layers,
  onToggleSourceNetworkVisibility,
}: {
  layers: CommercialMapLayer[];
  onToggleSourceNetworkVisibility: (networkId: string) => void;
}) {
  const displayLayers = [...layers].sort((a, b) => b.zIndex - a.zIndex || a.id.localeCompare(b.id));

  return (
    <section className="commercial-map-layer-manager" aria-label="Active map layer manager">
      <div className="dal-panel-title-row">
        <h3>Active Layer Panel</h3>
        <span className="dal-badge warning">Deterministic layer stack</span>
      </div>
      <div className="commercial-layer-manager-table-wrap">
        <table className="commercial-network-table">
          <thead>
            <tr>
              <th>Layer</th>
              <th>Domain</th>
              <th>Authority</th>
              <th>Owner</th>
              <th>Visibility</th>
              <th>Lock</th>
              <th>State</th>
              <th>Z</th>
              <th>Source</th>
              <th>Refresh</th>
              <th>Features</th>
            </tr>
          </thead>
          <tbody>
            {displayLayers.map((layer) => (
              <tr key={layer.id}>
                <td>
                  <b>{layer.label}</b>
                  <small>{layer.id}</small>
                </td>
                <td>{layer.domain.replaceAll("_", " ")}</td>
                <td>{layer.authority}</td>
                <td>{layer.owner}</td>
                <td>
                  <label className="commercial-network-toggle">
                    <input
                      type="checkbox"
                      checked={layer.visibility === "VISIBLE"}
                      disabled={!layer.sourceNetworkId}
                      onChange={() => layer.sourceNetworkId && onToggleSourceNetworkVisibility(layer.sourceNetworkId)}
                    />
                    <span>{layer.visibility === "VISIBLE" ? "Visible" : "Hidden"}</span>
                  </label>
                </td>
                <td>{layer.lockState === "LOCKED" ? "Locked" : "Editable"}</td>
                <td>{layer.renderState}</td>
                <td>{layer.zIndex}</td>
                <td>{layer.source}</td>
                <td>{layer.refreshMode.replaceAll("_", " ")}</td>
                <td>{layer.featureCount.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="dal-status">
        No geometry renders outside this registry. Customer Inventory is session-frozen; Sales Draft, Customer Draft, Shared Review, and Accepted Proposal enter the stack only through explicit workflow actions.
      </div>
    </section>
  );
}

function CommercialWorkingSetPanel({
  customerInventoryCount,
  salesDraftActive,
  customerDraftActive,
  sharedReviewActive,
  acceptedProposalActive,
  onCreateSalesDraft,
  onLoadSavedProposal,
  onLoadCustomerDraft,
  onStartSharedReview,
}: {
  customerInventoryCount: number;
  salesDraftActive: boolean;
  customerDraftActive: boolean;
  sharedReviewActive: boolean;
  acceptedProposalActive: boolean;
  onCreateSalesDraft: () => void;
  onLoadSavedProposal: () => void;
  onLoadCustomerDraft: () => void;
  onStartSharedReview: () => void;
}) {
  return (
    <section className="commercial-working-set-panel">
      <div className="dal-panel-title-row">
        <h3>Working Set</h3>
        <span className="dal-badge pass">Explicit activation</span>
      </div>
      <div className="teralinx-summary-grid">
        <div><span>Customer Inventory</span><b>{customerInventoryCount.toLocaleString()} active</b></div>
        <div><span>Sales Draft</span><b>{salesDraftActive ? "Active" : "Hidden"}</b></div>
        <div><span>Customer Draft</span><b>{customerDraftActive ? "Loaded" : "Hidden"}</b></div>
        <div><span>Customer Review</span><b>{sharedReviewActive ? "Active" : "Hidden"}</b></div>
        <div><span>Accepted Proposal</span><b>{acceptedProposalActive ? "Available" : "Hidden"}</b></div>
      </div>
      <div className="dal-actions">
        <button type="button" onClick={onCreateSalesDraft}>New Corridor</button>
        <button type="button" onClick={onLoadSavedProposal}>Load Saved Proposal</button>
        <button type="button" onClick={onLoadCustomerDraft}>Load Customer Draft</button>
        <button type="button" onClick={onStartSharedReview}>Start Customer Review</button>
      </div>
      <div className="dal-status">
        Startup working set is Customer Inventory only. Each button adds a domain without mutating Customer Inventory or creating ScopeVersion authority.
      </div>
    </section>
  );
}

function InventoryImportAdapterPanel({ account }: { account: CommercialAccountFixture }) {
  return (
    <div className="commercial-import-adapter">
      <div>
        <span>Future Source</span>
        <b>Google GIS API</b>
      </div>
      <div>
        <span>Adapter</span>
        <b>Inventory Import Adapter</b>
      </div>
      <div>
        <span>Owned Collection</span>
        <b>{account.name} Account Inventory</b>
      </div>
      <div>
        <span>Workspace</span>
        <b>Commercial Planning</b>
      </div>
    </div>
  );
}

function ProposalExtensionWorkflowPanel({ account }: { account: CommercialAccountFixture }) {
  return (
    <div className="commercial-extension-workflow">
      <div>
        <b>1. Select active reference layers</b>
        <span>Existing POPs, laterals, splice cases, buildings, and imported routes remain account-owned inventory references.</span>
      </div>
      <div>
        <b>2. Start or edit proposed networks</b>
        <span>Commercial proposals extend from references without mutating inventory or creating ScopeVersion authority.</span>
      </div>
      <div>
        <b>3. Save customer drafts separately</b>
        <span>Customer drafts are review inputs until accepted into the commercial proposal workflow.</span>
      </div>
      <div>
        <b>4. Handoff only after acceptance</b>
        <span>{account.name} handoff records stay pre-Kernel and pre-Engineering until Sales accepts the proposal package.</span>
      </div>
    </div>
  );
}

function DesignModePanel({
  activeMode,
  selectedInventoryNetworks,
  selectedCustomerProposedNetworks,
  selectedDraftNetworks,
  diversityConstraintNetworks,
  customerTwinState,
  onSelectMode,
}: {
  activeMode: CommercialDesignMode;
  selectedInventoryNetworks: CommercialNetworkRecord[];
  selectedCustomerProposedNetworks: CommercialNetworkRecord[];
  selectedDraftNetworks: CommercialNetworkRecord[];
  diversityConstraintNetworks: CommercialNetworkRecord[];
  customerTwinState: CustomerTwinRenderableState | null;
  onSelectMode: (mode: CommercialDesignMode) => void;
}) {
  const attachmentRouteCount = customerTwinState?.routes.filter((route) => route.routeUse === "ATTACHMENT_CANDIDATE").length ?? 0;
  return (
    <section className="dal-panel commercial-design-mode-panel">
      <div className="dal-panel-title-row">
        <h3>Design Modes</h3>
        <span className="dal-badge warning">Commercial Mode / Draft Authority</span>
      </div>
      <div className="commercial-design-mode-grid">
        <button
          type="button"
          className={activeMode === "EXTEND_EXISTING_NETWORK" ? "commercial-design-mode-card active" : "commercial-design-mode-card"}
          onClick={() => onSelectMode("EXTEND_EXISTING_NETWORK")}
        >
          <b>A. Extend Existing Network</b>
          <span>Select Customer Inventory, choose a connection point, then launch Route Engineering in Commercial Mode. The proposal remains an overlay.</span>
          <small>{selectedInventoryNetworks.length.toLocaleString()} active inventory references</small>
        </button>
        <button
          type="button"
          className={activeMode === "NEW_INDEPENDENT_GRAPH" ? "commercial-design-mode-card active" : "commercial-design-mode-card"}
          onClick={() => onSelectMode("NEW_INDEPENDENT_GRAPH")}
        >
          <b>B. New Independent Graph</b>
          <span>Create a brand-new commercial corridor without an inventory connection. It may connect later, but starts independent.</span>
          <small>{selectedDraftNetworks.length.toLocaleString()} active commercial drafts</small>
        </button>
        <button
          type="button"
          className={activeMode === "CUSTOMER_PROPOSAL_REVIEW" ? "commercial-design-mode-card active" : "commercial-design-mode-card"}
          onClick={() => onSelectMode("CUSTOMER_PROPOSAL_REVIEW")}
        >
          <b>C. Customer Proposal Review</b>
          <span>Review customer edits and shared overlays while preserving one editable commercial layer.</span>
          <small>{selectedCustomerProposedNetworks.length.toLocaleString()} customer proposed references</small>
        </button>
      </div>
      <div className="teralinx-summary-grid">
        <div><span>Customer Twin</span><b>{customerTwinState?.graphContext.graphVersion ?? "Not synchronized"}</b></div>
        <div><span>Attachment Routes</span><b>{attachmentRouteCount.toLocaleString()}</b></div>
        <div><span>Customer Proposed References</span><b>{selectedCustomerProposedNetworks.length.toLocaleString()}</b></div>
        <div><span>Diversity Constraints</span><b>{diversityConstraintNetworks.length.toLocaleString()}</b></div>
        <div><span>Commercial Drafts</span><b>{selectedDraftNetworks.length.toLocaleString()}</b></div>
      </div>
      <div className="dal-status">
        Corridor editing launches the shared Route Engineering geometry editor in Commercial Mode. Sales does not own a second routing engine and does not create ScopeVersion authority.
      </div>
    </section>
  );
}

function ExistingFiberInventoryQueryPanel({
  accountName,
  selectedInventoryNetworks,
  customerTwinState,
  selectedDraftNetworks,
  selectedRouteLabels,
  lastRunAt,
  excludedAccounts,
  onRunQuery,
}: {
  accountName: string;
  selectedInventoryNetworks: CommercialNetworkRecord[];
  customerTwinState: CustomerTwinRenderableState | null;
  selectedDraftNetworks: CommercialNetworkRecord[];
  selectedRouteLabels: string[];
  lastRunAt: string | null;
  excludedAccounts: string[];
  onRunQuery: () => void;
}) {
  const selectedLayerIds = new Set(selectedInventoryNetworks
    .map((network) => network.inventoryLayerId)
    .filter((layerId): layerId is string => Boolean(layerId)));
  const graphRoutes = customerTwinState?.routes.filter((route) => selectedLayerIds.has(route.layerId) && route.domain === "EXISTING_INVENTORY") ?? [];
  const graphObjects = customerTwinState?.objects.filter((object) => selectedLayerIds.has(object.layerId) && object.domain === "EXISTING_INVENTORY") ?? [];
  const graphStations = customerTwinState?.stations.filter((station) => selectedLayerIds.has(station.layerId) && station.domain === "EXISTING_INVENTORY") ?? [];
  const returnedRouteMiles = graphRoutes.reduce((sum, route) => sum + route.routeMiles, 0);
  return (
    <section className="dal-panel commercial-inventory-query-panel">
      <div className="dal-panel-title-row">
        <h3>Existing Fiber Inventory Query</h3>
        <span className="dal-badge pass">Account scoped</span>
      </div>
      <div className="teralinx-summary-grid">
        <div><span>Account</span><b>{accountName}</b></div>
        <div><span>Selected Existing Networks</span><b>{selectedInventoryNetworks.length.toLocaleString()}</b></div>
        <div><span>Current Proposal Corridors</span><b>{Math.max(selectedDraftNetworks.length, selectedRouteLabels.length).toLocaleString()}</b></div>
        <div><span>Returned Fiber Routes</span><b>{lastRunAt ? graphRoutes.length.toLocaleString() : "Run query"}</b></div>
        <div><span>Returned Fiber Objects</span><b>{lastRunAt ? graphObjects.length.toLocaleString() : "Run query"}</b></div>
        <div><span>Returned Stations</span><b>{lastRunAt ? graphStations.length.toLocaleString() : "Run query"}</b></div>
        <div><span>Returned Route Miles</span><b>{lastRunAt ? Number(returnedRouteMiles.toFixed(2)).toLocaleString() : "Run query"}</b></div>
        <div><span>Last Query</span><b>{displayTimestamp(lastRunAt)}</b></div>
        <div><span>Excluded Accounts</span><b>{excludedAccounts.join(", ")}</b></div>
        <div><span>Customer Twin</span><b>{customerTwinState?.graphContext.graphVersion ?? "No twin"}</b></div>
      </div>
      <div className="dal-actions">
        <button type="button" onClick={onRunQuery} disabled={!selectedInventoryNetworks.length}>
          Run Existing Fiber Query
        </button>
        <span className="dal-status">
          Query input is Customer Inventory plus the current proposal corridor. Results never include another account inventory collection.
        </span>
      </div>
      <div className="commercial-query-lists">
        <div>
          <b>Inventory Scope</b>
          <span>{selectedInventoryNetworks.map((network) => network.name).join(", ") || "No active Customer Inventory selected"}</span>
        </div>
        <div>
          <b>Proposal Scope</b>
          <span>{selectedDraftNetworks.map((network) => network.name).join(", ") || selectedRouteLabels.join(", ") || "No active proposal selected"}</span>
        </div>
      </div>
    </section>
  );
}

function OpportunityAnalysisLaunchPanel({
  accountName,
  selectedInventoryNetworks,
  selectedCustomerProposedNetworks,
  selectedDraftNetworks,
  diversityConstraintNetworks,
  customerTwinState,
  launchedAt,
  onLaunch,
}: {
  accountName: string;
  selectedInventoryNetworks: CommercialNetworkRecord[];
  selectedCustomerProposedNetworks: CommercialNetworkRecord[];
  selectedDraftNetworks: CommercialNetworkRecord[];
  diversityConstraintNetworks: CommercialNetworkRecord[];
  customerTwinState: CustomerTwinRenderableState | null;
  launchedAt: string | null;
  onLaunch: () => void;
}) {
  const candidateObjectCount = customerTwinState?.objects.filter((object) => ["POP", "FACILITY", "CUSTOMER_FACILITY", "CAMPUS", "SPLICE_CASE"].includes(object.objectType)).length ?? 0;
  return (
    <section className="dal-panel commercial-opportunity-launch-panel">
      <div className="dal-panel-title-row">
        <h3>Opportunity Analysis Launch</h3>
        <span className="dal-badge warning">Site Decision engine</span>
      </div>
      <div className="teralinx-summary-grid">
        <div><span>Customer Inventory Input</span><b>{selectedInventoryNetworks.length.toLocaleString()} selected</b></div>
        <div><span>Customer Proposed Input</span><b>{selectedCustomerProposedNetworks.length.toLocaleString()} selected</b></div>
        <div><span>Proposal Corridor Input</span><b>{selectedDraftNetworks.length.toLocaleString()} draft overlays</b></div>
        <div><span>Diversity Constraints</span><b>{diversityConstraintNetworks.length.toLocaleString()} active</b></div>
        <div><span>Customer Twin</span><b>{customerTwinState?.graphContext.graphVersion ?? "Not synchronized"}</b></div>
        <div><span>Twin Candidate Objects</span><b>{candidateObjectCount.toLocaleString()}</b></div>
        <div><span>Engine</span><b>Site Decision</b></div>
        <div><span>Last Launch</span><b>{displayTimestamp(launchedAt)}</b></div>
        <div><span>Output</span><b>Candidate sites / laterals / ranking</b></div>
        <div><span>Proposal Builder Role</span><b>Consumes output only</b></div>
      </div>
      <div className="dal-actions">
        <button type="button" onClick={onLaunch} disabled={!selectedDraftNetworks.length}>
          Launch Opportunity Analysis
        </button>
        <span className="dal-status">
          {accountName} inventory, selected proposal corridor, and selected existing networks are passed to Site Decision. Proposal Builder does not generate laterals.
        </span>
      </div>
    </section>
  );
}

function OpportunityScoutPanel({
  accountName,
  mode,
  address,
  lat,
  lng,
  azOrigin,
  azDestination,
  selectedInventoryNetworks,
  candidate,
  siteDecision,
  attachmentResolution,
  selectedAttachmentId,
  routeResult,
  routing,
  quickQuote,
  onSelectMode,
  onAddressChange,
  onLatChange,
  onLngChange,
  onAzOriginChange,
  onAzDestinationChange,
  onRunAddress,
  onRunLatLng,
  onRunAzBuilder,
  onSelectAttachment,
  onGenerateRoute,
  onLockCandidate,
  onDeleteCandidate,
}: {
  accountName: string;
  mode: OpportunityScoutMode;
  address: string;
  lat: string;
  lng: string;
  azOrigin: string;
  azDestination: string;
  selectedInventoryNetworks: CommercialNetworkRecord[];
  candidate: OpportunityScoutCandidate | null;
  siteDecision: OpportunityScoutSiteDecision | null;
  attachmentResolution: AttachmentResolution | null;
  selectedAttachmentId: string | null;
  routeResult: CommercialRouteResult | null;
  routing: boolean;
  quickQuote: OpportunityQuickQuote | null;
  onSelectMode: (mode: OpportunityScoutMode) => void;
  onAddressChange: (value: string) => void;
  onLatChange: (value: string) => void;
  onLngChange: (value: string) => void;
  onAzOriginChange: (value: string) => void;
  onAzDestinationChange: (value: string) => void;
  onRunAddress: () => void;
  onRunLatLng: () => void;
  onRunAzBuilder: () => void;
  onSelectAttachment: (attachmentId: string) => void;
  onGenerateRoute: () => void;
  onLockCandidate: () => void;
  onDeleteCandidate: () => void;
}) {
  const modeCards: Array<{ id: OpportunityScoutMode; label: string; summary: string }> = [
    { id: "CLICK_SITE", label: "Click Site on Map", summary: "Drops a site candidate against selected inventory." },
    { id: "ADDRESS", label: "Address", summary: "Creates a deterministic local address candidate." },
    { id: "LAT_LNG", label: "Latitude / Longitude", summary: "Uses entered coordinates as the candidate site." },
    { id: "AZ_BUILDER", label: "A/Z Builder", summary: "Builds a commercial corridor seed without creating a proposal." },
  ];
  const selectedAttachment =
    attachmentResolution?.alternatives.find((attachment) => attachment.id === selectedAttachmentId) ??
    attachmentResolution?.recommendedAttachment ??
    null;
  const routeReady = routeResult?.status === "ROUTED";
  const routeFailed = routeResult?.status === "FAILED";

  return (
    <section className="dal-panel commercial-opportunity-scout-panel">
      <div className="dal-panel-title-row">
        <h3>Opportunity Scout</h3>
        <span className="dal-badge warning">Advisory / Pre-Kernel</span>
      </div>
      <div className="commercial-design-mode-grid">
        {modeCards.map((card) => (
          <button
            key={card.id}
            type="button"
            className={mode === card.id ? "commercial-design-mode-card active" : "commercial-design-mode-card"}
            onClick={() => onSelectMode(card.id)}
          >
            <b>{card.label}</b>
            <span>{card.summary}</span>
            <small>{card.id === "CLICK_SITE" ? "Unified map" : card.id.replaceAll("_", " ")}</small>
          </button>
        ))}
      </div>
      {mode === "ADDRESS" ? (
        <div className="commercial-scout-input-row">
          <label>
            <span>Address</span>
            <input value={address} onChange={(event) => onAddressChange(event.currentTarget.value)} />
          </label>
          <button type="button" onClick={onRunAddress} disabled={!address.trim()}>Run Site Decision</button>
        </div>
      ) : null}
      {mode === "LAT_LNG" ? (
        <div className="commercial-scout-input-row">
          <label>
            <span>Latitude</span>
            <input value={lat} onChange={(event) => onLatChange(event.currentTarget.value)} />
          </label>
          <label>
            <span>Longitude</span>
            <input value={lng} onChange={(event) => onLngChange(event.currentTarget.value)} />
          </label>
          <button type="button" onClick={onRunLatLng} disabled={!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))}>Run Site Decision</button>
        </div>
      ) : null}
      {mode === "AZ_BUILDER" ? (
        <div className="commercial-scout-input-row">
          <label>
            <span>A Location</span>
            <input value={azOrigin} onChange={(event) => onAzOriginChange(event.currentTarget.value)} />
          </label>
          <label>
            <span>Z Location</span>
            <input value={azDestination} onChange={(event) => onAzDestinationChange(event.currentTarget.value)} />
          </label>
          <button type="button" onClick={onRunAzBuilder} disabled={!azOrigin.trim() || !azDestination.trim()}>Build A/Z Seed</button>
        </div>
      ) : null}
      <div className="teralinx-summary-grid">
        <div><span>Account</span><b>{accountName}</b></div>
        <div><span>Selected Inventory</span><b>{selectedInventoryNetworks.length.toLocaleString()}</b></div>
        <div><span>Candidate</span><b>{candidate?.label ?? "No candidate"}</b></div>
        <div><span>Mode</span><b>{mode.replaceAll("_", " ")}</b></div>
        <div><span>Nearest Inventory</span><b>{siteDecision?.nearestInventory?.label ?? "Pending"}</b></div>
        <div><span>Nearest Graph Node</span><b>{siteDecision?.nearestGraphNode?.label ?? "Pending"}</b></div>
        <div><span>Nearest Station</span><b>{siteDecision?.nearestStation?.label ?? "Pending"}</b></div>
        <div><span>Nearest Splice</span><b>{siteDecision?.nearestSplice?.label ?? "Pending"}</b></div>
        <div><span>Nearest POP</span><b>{siteDecision?.nearestPOP?.label ?? "Pending"}</b></div>
        <div><span>Distance</span><b>{feet(siteDecision?.distanceFeet)}</b></div>
        <div><span>Attachment Status</span><b>{attachmentResolution?.status.replaceAll("_", " ") ?? "Pending"}</b></div>
        <div><span>Selected Attachment</span><b>{selectedAttachment ? selectedAttachment.attachmentType.replaceAll("_", " ") : "Pending"}</b></div>
        <div><span>Attachment Route</span><b>{selectedAttachment?.routeName ?? "Pending"}</b></div>
        <div><span>Attachment Station</span><b>{selectedAttachment?.stationId ?? "Pending"}</b></div>
        <div><span>OSRM Status</span><b>{routing ? "ROUTING" : routeResult?.status ?? "Not requested"}</b></div>
        <div><span>OSRM Miles</span><b>{routeReady ? formatRouteMiles(routeResult?.routeMiles ?? null) : routeFailed ? "Failed" : "Pending"}</b></div>
        <div><span>Power</span><b>{siteDecision?.power ?? "Pending"}</b></div>
        <div><span>Floodplain</span><b>{siteDecision?.floodplain ?? "Pending"}</b></div>
        <div><span>Rail</span><b>{siteDecision?.rail ?? "Pending"}</b></div>
        <div><span>Parcel</span><b>{siteDecision?.parcel ?? "Pending"}</b></div>
        <div><span>Environmental</span><b>{siteDecision?.environmental ?? "Pending"}</b></div>
        <div><span>Utility Corridor</span><b>{siteDecision?.utilityCorridor ?? "Pending"}</b></div>
        <div><span>Diversity</span><b>{siteDecision ? `${siteDecision.diversityScore}` : "Pending"}</b></div>
        <div><span>Expandability</span><b>{siteDecision ? `${siteDecision.expandability}` : "Pending"}</b></div>
        <div><span>Commercial Confidence</span><b>{siteDecision ? percentage(siteDecision.commercialConfidence) : "Pending"}</b></div>
        <div><span>Route Miles</span><b>{quickQuote ? formatRouteMiles(quickQuote.routeMiles) : "Pending"}</b></div>
        <div><span>Budget</span><b>{quickQuote ? money(quickQuote.budgetCost) : "Pending"}</b></div>
        <div><span>Civil Mix</span><b>{quickQuote?.civilMix.label ?? "Pending"}</b></div>
        <div><span>Crossings</span><b>{quickQuote ? quickQuote.crossings.toLocaleString() : "Pending"}</b></div>
        <div><span>Stationing</span><b>{quickQuote ? quickQuote.stationCount.toLocaleString() : "Pending"}</b></div>
        <div><span>SVA</span><b>{quickQuote ? quickQuote.svaScore.toLocaleString() : "Pending"}</b></div>
        <div><span>Revenue</span><b>{quickQuote ? money(quickQuote.revenue) : "Pending"}</b></div>
        <div><span>NRC</span><b>{quickQuote ? money(quickQuote.nrc) : "Pending"}</b></div>
        <div><span>MRC</span><b>{quickQuote ? money(quickQuote.mrc) : "Pending"}</b></div>
        <div><span>Margin</span><b>{quickQuote ? percentage(quickQuote.marginPercent) : "Pending"}</b></div>
        <div><span>Quick Quote Confidence</span><b>{quickQuote ? percentage(quickQuote.confidence) : "Pending"}</b></div>
      </div>
      {attachmentResolution?.alternatives.length ? (
        <div className="dal-list commercial-attachment-candidates">
          {attachmentResolution.alternatives.map((attachment, index) => (
            <div className="dal-list-row" key={attachment.id}>
              <b>{index === 0 ? "Recommended" : "Alternative"} - {attachment.attachmentType.replaceAll("_", " ")}</b>
              <span>{attachment.routeName}{attachment.stationId ? ` / ${attachment.stationId}` : ""}</span>
              <small>{feet(attachment.distanceFeet)} from candidate | Score {attachment.score} | Confidence {percentage(attachment.confidence)}</small>
              <button type="button" className={selectedAttachment?.id === attachment.id ? "primary" : "secondary"} onClick={() => onSelectAttachment(attachment.id)}>
                {selectedAttachment?.id === attachment.id ? "Selected" : "Select"}
              </button>
            </div>
          ))}
        </div>
      ) : null}
      {routeResult?.status === "FAILED" ? (
        <div className="dal-status">OSRM failed: {routeResult.failureReason ?? "Route unavailable"}. No budget or Commercial Draft can be created from straight-line distance.</div>
      ) : null}
      <div className="dal-actions">
        <button type="button" onClick={onGenerateRoute} disabled={!candidate || routing || routeReady || (candidate.mode !== "AZ_BUILDER" && attachmentResolution?.status !== "READY")}>
          {routing ? "Routing..." : "Generate OSRM Route"}
        </button>
        <button type="button" onClick={onLockCandidate} disabled={!candidate || !quickQuote || candidate.lockedIntoCommercialDraft}>
          Lock {candidate?.mode === "AZ_BUILDER" ? "Corridor" : "Site"}
        </button>
        <button type="button" className="secondary" onClick={onDeleteCandidate} disabled={!candidate}>Delete Candidate</button>
        <span className="dal-status">
          Quick Quote and Commercial Draft activation require OSRM routed geometry. Customer Inventory stays read-only and no ScopeVersion is created.
        </span>
      </div>
    </section>
  );
}

function OpportunityBrowserPanel({
  query,
  results,
  onQueryChange,
  onSelectResult,
}: {
  query: string;
  results: OpportunityBrowserResult[];
  onQueryChange: (value: string) => void;
  onSelectResult: (result: OpportunityBrowserResult) => void;
}) {
  const chips = ["near active backbone", "campus expansion", "splice adjacency", "independent corridor"];
  return (
    <section className="dal-panel commercial-opportunity-browser-panel">
      <div className="dal-panel-title-row">
        <h3>Opportunity Browser</h3>
        <span className="dal-badge pass">Customer Twin ranked</span>
      </div>
      <div className="commercial-scout-input-row">
        <label>
          <span>Search</span>
          <input value={query} onChange={(event) => onQueryChange(event.currentTarget.value)} />
        </label>
        <div className="dal-actions">
          {chips.map((chip) => (
            <button key={chip} type="button" className="secondary" onClick={() => onQueryChange(chip)}>
              {chip}
            </button>
          ))}
        </div>
      </div>
      <div className="dal-list">
        {results.map((result) => (
          <div className="dal-list-row commercial-browser-result" key={result.resultId}>
            <b>{result.title}</b>
            <span>{result.summary}</span>
            <small>Score {result.score} | {result.nearestInventoryLabel} | {formatRouteMiles(result.estimatedRouteMiles)} mi</small>
            <button type="button" onClick={() => onSelectResult(result)}>Open</button>
          </div>
        ))}
      </div>
    </section>
  );
}

function EnrichmentPalettePanel({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (name: string) => void;
}) {
  const activeOptionalLayerCount = selected.filter((option) => ENRICHMENT_OPTIONS.includes(option)).length;
  return (
    <section className="dal-panel commercial-disclosure-panel">
      <details>
        <summary>Enrichment Palette - Optional Layers {activeOptionalLayerCount.toLocaleString()} Active</summary>
        <div className="commercial-enrichment-grid">
          {ENRICHMENT_OPTIONS.map((option) => (
            <label key={option}>
              <input type="checkbox" checked={selected.includes(option)} onChange={() => onToggle(option)} />
              <span>{option}</span>
            </label>
          ))}
        </div>
        <div className="dal-status">No enrichment runs automatically. Enabled layers are session selections only and do not mutate inventory.</div>
      </details>
    </section>
  );
}

function SegmentValueAnalysisPanel({ pricingSummary }: { pricingSummary: SelectedScopePricingSummary }) {
  const reconciliation = pricingSummary.reconciliation;
  return (
    <section className="dal-panel commercial-disclosure-panel">
      <details>
        <summary>Segment Value Analysis - Collapsed - {pricingSummary.scope.label}</summary>
        <div className="teralinx-summary-grid">
          <div><span>Construction Cost</span><b>{money(reconciliation.ospCost)}</b></div>
          <div><span>NRC Revenue</span><b>{money(reconciliation.nrcRevenue)}</b></div>
          <div><span>Risk</span><b>Pending selected enrichment</b></div>
          <div><span>Capacity</span><b>Customer product driven</b></div>
          <div><span>Latency</span><b>Route geometry dependent</b></div>
          <div><span>Crossings</span><b>Corridor takeoff</b></div>
          <div><span>Power Proximity</span><b>Optional enrichment</b></div>
          <div><span>Environmental Constraints</span><b>Optional enrichment</b></div>
          <div><span>Permits</span><b>Engineering review required</b></div>
          <div><span>Expansion Opportunity</span><b>Commercial review</b></div>
          <div><span>Competitive Density</span><b>Optional enrichment</b></div>
          <div><span>Customer Density</span><b>Optional enrichment</b></div>
          <div><span>Buildability</span><b>Budgetary</b></div>
          <div><span>Confidence</span><b>Sales estimate only</b></div>
        </div>
      </details>
    </section>
  );
}

function SummaryList({ items }: { items: string[] }) {
  return (
    <div className="dal-list">
      {items.map((item, index) => (
        <div className="dal-list-row" key={`${item}-${index}`}>
          <b>{item}</b>
          <span>Account scoped</span>
        </div>
      ))}
    </div>
  );
}

function EmptyAccountProposal({ account }: { account: CommercialAccountFixture }) {
  return (
    <section className="dal-panel">
      <div className="dal-panel-title-row">
        <h3>Proposal Builder</h3>
        <span className="dal-badge warning">No engagement loaded</span>
      </div>
      <div className="dal-status">
        {account.name} has no active commercial proposal fixture in this DAL session. Customer corridors, assets, and proposals remain isolated by account.
      </div>
    </section>
  );
}

export default function GoogleRfpWorkspace() {
  const {
    customerDesignImports,
    selectedCustomerDesignImportId,
    setSelectedCustomerDesignImportId,
    selectedCustomerDesignRouteId,
    setSelectedCustomerDesignRouteId,
    upsertCustomerDesignImport,
    setSelectedCommercialCorridorDraft,
    engineeringDrafts,
    selectedRouteEngineeringDraft,
    setSelectedRouteEngineeringDraft,
    setSelectedRouteEngineeringActivation,
    setSelectedEngineeringDraftIofPackage,
    setSelectedEngineeringDraftIofPackageId,
    setWorkspace,
  } = useDALState();
  const { session, runtimeInfo, activity, recordActivity, can } = useTeralinxAuth();
  const demoGovernedIdContext = session?.user.authorityClass === "DEMO" && session.user.organizationId === "org-demo"
    ? session.user
    : null;
  const currentUserName = session?.user.name ?? "Teralinx";
  const currentUserId = session?.user.userId ?? "teralinx-user-system";
  const currentWorkspaceId = session?.user.workspaceId ?? session?.workspace?.workspaceId ?? "workspace-teralinx-system";
  const currentOrganizationId = session?.user.organizationId ?? session?.workspace?.organizationId ?? "org-teralinx";
  const [bidPlan, setBidPlan] = useState(googleHeliumBidPlanFixture);
  const defaultAssumptionState = useMemo(() => createDefaultBudgetAssumptionState(), []);
  const [assumptionStates, setAssumptionStates] = useState<BudgetAssumptionState[]>([defaultAssumptionState]);
  const [selectedAssumptionStateId, setSelectedAssumptionStateId] = useState(defaultAssumptionState.stateId);
  const [transparentEstimateControls, setTransparentEstimateControls] = useState<TransparentEstimateControls>(() => defaultTransparentEstimateControls());
  const [commercialWorkbookOpenSections, setCommercialWorkbookOpenSections] = useState<Set<string>>(() => new Set(["proposal-summary", "construction-mix"]));
  const [transparentEstimateRecalculatedAt, setTransparentEstimateRecalculatedAt] = useState<string | null>(null);
  const [liveCommercialSession, setLiveCommercialSession] = useState<LiveCommercialSession | null>(null);
  const [selectedScopeId, setSelectedScopeId] = useState<string>(() => googleHeliumBidPlanFixture.routePlans[0]?.routeRequirement.routeRequirementId ?? "COMBINED_AWARD");
  const [inventoryMapSelection, setInventoryMapSelection] = useState<ProposedNetworkSelection>(null);
  const verificationStatus = "PENDING" as const;
  const [commercialRecalculationPending, setCommercialRecalculationPending] = useState(false);
  const [proposalSnapshots, setProposalSnapshots] = useState<LiveProposalSnapshot[]>([]);
  const [proposalRuntimeRecords, setProposalRuntimeRecords] = useState<ProposalRuntimeObject[]>([]);
  const [proposalRuntimeNotice, setProposalRuntimeNotice] = useState("Proposal Runtime Library is waiting for a governed proposal object.");
  const [customerEnrollmentLinks, setCustomerEnrollmentLinks] = useState<Array<{ principalId: string; expiresAt: string; enrollmentPath: string }>>([]);
  const [proposalRuntimeActionPending, setProposalRuntimeActionPending] = useState(false);
  const [releaseProposalRevisionId, setReleaseProposalRevisionId] = useState("");
  const releaseCoordinatorPendingRef = useRef(false);
  const [engineeringReviewQueue, setEngineeringReviewQueue] = useState<EngineeringReviewQueueItem[]>([]);
  const [activeDraftIofPackage, setActiveDraftIofPackage] = useState<DraftIofPackageRuntime | null>(null);
  const [commercialDraftIofPackage, setCommercialDraftIofPackage] = useState<DraftIofPackageRuntime | null>(null);
  const [productConfiguratorResult, setProductConfiguratorResult] = useState<PointToPointConfiguratorResult | null>(null);
  const [productConfiguratorNotice, setProductConfiguratorNotice] = useState("Point-to-Point Configurator is waiting for customer, product, A, and Z.");
  const [engineeringCertificationNotice, setEngineeringCertificationNotice] = useState("Engineering Certification queue is waiting for a Draft IOF Package.");
  const [engineeringCertificationPending, setEngineeringCertificationPending] = useState(false);
  const [runtimeLifecycleState, setRuntimeLifecycleState] = useState<RuntimeLifecycleBridgeState | null>(null);
  const [runtimeLifecycleNotice, setRuntimeLifecycleNotice] = useState("Runtime lifecycle bridge is waiting for a quote-ready commercial path.");
  const [runtimeLifecyclePending, setRuntimeLifecyclePending] = useState(false);
  const [runtimeRehydrationState, setRuntimeRehydrationState] = useState<RuntimeRehydrationState | null>(null);
  const [runtimeRehydrationNotice, setRuntimeRehydrationNotice] = useState("Runtime rehydration has not run for this workspace.");
  const [customerDrafts, setCustomerDrafts] = useState<CustomerDraftRecord[]>([]);
  const [customerReviewStatus, setCustomerReviewStatus] = useState<CustomerReviewStatus>("NOT_STARTED");
  const [acceptedProposal, setAcceptedProposal] = useState<AcceptedProposal | null>(null);
  const [governedAccounts, setGovernedAccounts] = useState<GovernedAccount[]>([]);
  const [governedContacts, setGovernedContacts] = useState<GovernedContact[]>([]);
  const [runtimeHistory, setRuntimeHistory] = useState<RuntimeHistoryEvent[]>([]);
  const [accountLibraryLoaded, setAccountLibraryLoaded] = useState(false);
  const [accountPersistencePending, setAccountPersistencePending] = useState(false);
  const [accountNotice, setAccountNotice] = useState("Account Library is loading governed workspace roots.");
  const [accountEditorOpen, setAccountEditorOpen] = useState(false);
  const [accountEditorMode, setAccountEditorMode] = useState<"create" | "edit">("edit");
  const [accountDraft, setAccountDraft] = useState<AccountEditorState>(() => emptyAccountEditor(currentUserName));
  const [contactDraft, setContactDraft] = useState<ContactEditorState>(() => contactEditorDefaults());
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [accountDealTwin, setAccountDealTwin] = useState<AccountCustomerTwin | null>(null);
  const [selectedProductId, setSelectedProductId] = useState(POINT_TO_POINT_LONG_HAUL_PRODUCT_ID);
  const [activeView, setActiveView] = useState<CommercialWorkspaceView>("networks");
  const [activeDesignMode, setActiveDesignMode] = useState<CommercialDesignMode>("EXTEND_EXISTING_NETWORK");
  const [commercialDraftType, setCommercialDraftType] = useState<CommercialDraftType | null>(null);
  const [importedCommercialDraft, setImportedCommercialDraft] = useState<CommercialCorridorDraft | null>(null);
  const [loadedCommercialDraftSnapshot, setLoadedCommercialDraftSnapshot] = useState<CommercialCorridorDraft | null>(null);
  const [commercialOpportunities, setCommercialOpportunities] = useState<CommercialOpportunityRecord[]>([]);
  const [commercialRouteRepositoryRecords, setCommercialRouteRepositoryRecords] = useState<CommercialRouteRepositoryRecord[]>([]);
  const [commercialLibraryLoaded, setCommercialLibraryLoaded] = useState(false);
  const [activeCommercialOpportunityId, setActiveCommercialOpportunityId] = useState("");
  const [opportunityNameDraft, setOpportunityNameDraft] = useState("");
  const [opportunityNotice, setOpportunityNotice] = useState("No opportunity loaded. New Opportunity starts with Customer Twin only.");
  const [opportunityRestoreState, setOpportunityRestoreState] = useState<OpportunityRestoreState>(() => createOpportunityRestoreState());
  const opportunityRestoreRunRef = useRef(0);
  const [generatedRouteRepositorySnapshot, setGeneratedRouteRepositorySnapshot] = useState<CommercialRouteRepositoryRecord | null>(null);
  const [automaticIofAssemblyRouteRepositoryId, setAutomaticIofAssemblyRouteRepositoryId] = useState("");
  const [commercialLifecycleSequencingNotice, setCommercialLifecycleSequencingNotice] = useState("Commercial lifecycle sequencing is waiting for a committed Route Repository.");
  const [routePersistencePending, setRoutePersistencePending] = useState(false);
  const [routePersistenceAuditLog, setRoutePersistenceAuditLog] = useState<RoutePersistenceAuditEntry[]>([]);
  const [routePersistenceInspector, setRoutePersistenceInspector] = useState<RoutePersistenceInspectorState | null>(null);
  const [proposalPreviewOpen, setProposalPreviewOpen] = useState(false);
  const [opportunityWorkflowState, setOpportunityWorkflowState] = useState<OpportunityWorkflowState>("IDLE");
  const [opportunityScoutMode, setOpportunityScoutMode] = useState<OpportunityScoutMode>("CLICK_SITE");
  const [opportunityScoutAddress, setOpportunityScoutAddress] = useState("");
  const [opportunityScoutLat, setOpportunityScoutLat] = useState("");
  const [opportunityScoutLng, setOpportunityScoutLng] = useState("");
  const [opportunityScoutAzOrigin, setOpportunityScoutAzOrigin] = useState("");
  const [opportunityScoutAzDestination, setOpportunityScoutAzDestination] = useState("");
  const [azOriginLocation, setAzOriginLocation] = useState<ResolvedLocation | null>(null);
  const [azDestinationLocation, setAzDestinationLocation] = useState<ResolvedLocation | null>(null);
  const [azMapPlacementSlot, setAzMapPlacementSlot] = useState<AzLocationSlot | null>(null);
  const [opportunityScoutCandidate, setOpportunityScoutCandidate] = useState<OpportunityScoutCandidate | null>(null);
  const [selectedAttachmentCandidateId, setSelectedAttachmentCandidateId] = useState<string | null>(null);
  const [commercialRouteResult, setCommercialRouteResult] = useState<CommercialRouteResult | null>(null);
  const [commercialRoutingStatus, setCommercialRoutingStatus] = useState<"IDLE" | "ROUTING">("IDLE");
  const [opportunityBrowserQuery, setOpportunityBrowserQuery] = useState("");
  const [temporaryImportedRoute, setTemporaryImportedRoute] = useState<TemporaryImportedRoute | null>(null);
  const [pendingRouteImport, setPendingRouteImport] = useState<CustomerDesignImport | null>(null);
  const [importedEndpointReplacementConfirmed, setImportedEndpointReplacementConfirmed] = useState(false);
  const [routeImportStatus, setRouteImportStatus] = useState<RouteImportStatus>("IDLE");
  const [newOpportunityDialogOpen, setNewOpportunityDialogOpen] = useState(false);
  const [existingFiberQueryLastRunAt, setExistingFiberQueryLastRunAt] = useState<string | null>(null);
  const [opportunityAnalysisLaunchedAt, setOpportunityAnalysisLaunchedAt] = useState<string | null>(null);
  const [customerNetworkGraph, setCustomerNetworkGraph] = useState<CustomerNetworkGraph | null>(null);
  const [customerInventoryLoadStatus, setCustomerInventoryLoadStatus] = useState<CustomerInventoryParsedStatus>("PENDING");
  const [customerInventoryDiagnostics, setCustomerInventoryDiagnostics] = useState<string[]>([]);
  const [existingInventoryImportStatus, setExistingInventoryImportStatus] = useState<"IDLE" | "PARSING" | "COMMITTING" | "READY" | "ERROR">("IDLE");
  const [existingInventoryImportNotice, setExistingInventoryImportNotice] = useState("Use Import Existing Network to create organization-owned Customer Twin inventory records.");
  const [runtimePerformancePanelOpen, setRuntimePerformancePanelOpen] = useState(false);
  const [mutationTraceRevision, setMutationTraceRevision] = useState(0);
  const [runtimePerformance, setRuntimePerformance] = useState<RuntimePerformanceSnapshot>(() => runtimePerformanceSnapshot());
  const [importWorkerStatus, setImportWorkerStatus] = useState<AsyncImportProgressState | "IDLE">("IDLE");
  const [corridorExecutionSession, setCorridorExecutionSession] = useState<CorridorExecutionSession | null>(null);
  const [corridorExecutionProgress, setCorridorExecutionProgress] = useState<CorridorExecutionProgress | null>(null);
  const [corridorAggregateProjection, setCorridorAggregateProjection] = useState<CorridorAggregateProjection | null>(null);
  const [corridorViewportProjection, setCorridorViewportProjection] = useState<CorridorViewportProjection | null>(null);
  const [corridorPerformanceMetrics, setCorridorPerformanceMetrics] = useState<CorridorExecutionMetricsSnapshot | null>(null);
  const renderCountRef = useRef(0);
  renderCountRef.current += 1;
  const [routeEditSession, setRouteEditSession] = useState<RouteEditSession | null>(null);
  const [routeEditNotice, setRouteEditNotice] = useState("Route edits are inactive. Original assembled route truth is unchanged.");
  const [routeEditRevisionPreview, setRouteEditRevisionPreview] = useState<RouteEditRevisionRecord | null>(null);
  const [commercialChangeSetPatches, setCommercialChangeSetPatches] = useState<CommercialPatch[]>([]);
  const [commercialChangeSetHistory, setCommercialChangeSetHistory] = useState<CommercialChangeSet[]>([]);
  const [commercialRevisionProjection, setCommercialRevisionProjection] = useState<CommercialRevisionProjection | null>(null);
  const [commercialChangeSetNotice, setCommercialChangeSetNotice] = useState("Commercial Revision is at Repository Truth. No Change Set patches are active.");
  const [inventoryRefreshNonce, setInventoryRefreshNonce] = useState(0);
  const [networkLayerStates, setNetworkLayerStates] = useState<Record<string, NetworkLayerState>>(() =>
    Object.fromEntries(COMMERCIAL_NETWORKS.map((network) => [network.networkId, defaultNetworkLayerState(network)])),
  );
  const governedContactsForSelectedAccount = useMemo(
    () => governedContacts.filter((contact) => contact.accountId === selectedAccountId && contact.lifecycleState !== "ARCHIVED"),
    [governedContacts, selectedAccountId],
  );
  const accountOptions = useMemo<CommercialAccountFixture[]>(() => {
    const byId = new Map<string, CommercialAccountFixture>();
    COMMERCIAL_ACCOUNTS.forEach((account) => byId.set(account.accountId, account));
    governedAccounts.filter((account) => !RETIRED_DEMO_ACCOUNT_IDS.has(account.accountId)).forEach((account) => {
      const fallback = byId.get(account.accountId);
      const contacts = governedContacts.filter((contact) => contact.accountId === account.accountId && contact.lifecycleState !== "ARCHIVED");
      byId.set(account.accountId, commercialAccountFromGoverned(account, contacts, fallback));
    });
    const usedNumbers = new Set([...byId.values()].map((account) => account.accountNumber).filter((value) => value > 0));
    let nextNumber = 1;
    const numbered = [...byId.values()]
      .sort((a, b) => (a.accountNumber || Number.MAX_SAFE_INTEGER) - (b.accountNumber || Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name))
      .map((account) => {
        if (account.accountNumber > 0) return account;
        while (usedNumbers.has(nextNumber)) nextNumber += 1;
        usedNumbers.add(nextNumber);
        return { ...account, accountNumber: nextNumber++ };
      });
    return numbered.sort((a, b) => a.accountNumber - b.accountNumber);
  }, [governedAccounts, governedContacts]);
  const selectedAccount =
    accountOptions.find((account) => account.accountId === selectedAccountId) ??
    EMPTY_COMMERCIAL_ACCOUNT;
  const selectedGovernedAccount = governedAccounts.find((account) => account.accountId === selectedAccount.accountId) ?? null;
  const selectedProductOption = useMemo(
    () => LAYER_1_PRODUCT_OPTIONS.find((product) => product.productId === selectedProductId) ?? LAYER_1_PRODUCT_OPTIONS[0],
    [selectedProductId],
  );
  const selectedProductConfiguratorId = useMemo(
    () => productConfiguratorForProduct(selectedProductOption.productId),
    [selectedProductOption.productId],
  );
  const proposalRecipientContactIds = useMemo(
    () => governedContactsForSelectedAccount.filter((contact) => contact.proposalRecipient !== false).map((contact) => contact.contactId),
    [governedContactsForSelectedAccount],
  );
  const customerReviewContactIds = useMemo(
    () => governedContactsForSelectedAccount.filter((contact) => contact.customerReviewRecipient !== false).map((contact) => contact.contactId),
    [governedContactsForSelectedAccount],
  );
  const approvalAuthorityContactIds = useMemo(
    () => governedContactsForSelectedAccount.filter((contact) => contact.approvalAuthority !== false).map((contact) => contact.contactId),
    [governedContactsForSelectedAccount],
  );
  const sofRecipientContactIds = useMemo(
    () => governedContactsForSelectedAccount.filter((contact) => contact.sofRecipient !== false || contact.serviceOrderRecipient !== false).map((contact) => contact.contactId),
    [governedContactsForSelectedAccount],
  );
  const customerContactEmails = useMemo(
    () => governedContactsForSelectedAccount.map((contact) => contact.email).filter(Boolean),
    [governedContactsForSelectedAccount],
  );
  async function refreshAccountLibrary(nextNotice?: string, targetAccountId = selectedAccountId) {
    const [accounts, contacts, history] = await Promise.all([
      CustomerRepository.listCustomers(),
      targetAccountId ? CustomerRepository.listContacts(targetAccountId) : Promise.resolve([]),
      CustomerRepository.listHistory(),
    ]);
    setGovernedAccounts(accounts);
    setGovernedContacts(contacts.filter((contact) => contact.accountId === targetAccountId));
    setRuntimeHistory(history.filter((event) => event.accountId === targetAccountId || event.customerId === targetAccountId || event.customerId === customerIdForAccount(targetAccountId)));
    setAccountLibraryLoaded(true);
    if (nextNotice) setAccountNotice(nextNotice);
    else setAccountNotice(`${accounts.length.toLocaleString()} governed Accounts loaded.`);
  }

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    CustomerRepository.listCustomers()
      .then((accounts) => {
        if (cancelled) return;
        setGovernedAccounts(accounts);
        setGovernedContacts([]);
        setRuntimeHistory([]);
        setAccountLibraryLoaded(true);
        setAccountNotice(`${accounts.length.toLocaleString()} governed Accounts loaded.`);
      })
      .catch((error) => {
        if (cancelled) return;
        setAccountLibraryLoaded(true);
        setAccountNotice(`Account Library load failed: ${error instanceof Error ? error.message : String(error)}`);
      });
    return () => {
      cancelled = true;
    };
  }, [session?.token]);

  useEffect(() => {
    if (!session || !selectedAccountId) {
      setGovernedContacts([]);
      setRuntimeHistory([]);
      setAccountDealTwin(null);
      return;
    }
    let cancelled = false;
    Promise.all([CustomerRepository.listContacts(selectedAccountId), CustomerRepository.listHistory(), loadAccountCustomerTwin(selectedAccountId, session)])
      .then(([contacts, history, customerTwin]) => {
        if (cancelled) return;
        setGovernedContacts(contacts.filter((contact) => contact.accountId === selectedAccountId));
        setRuntimeHistory(history.filter((event) => event.accountId === selectedAccountId || event.customerId === selectedAccountId || event.customerId === customerIdForAccount(selectedAccountId)));
        setAccountDealTwin(customerTwin);
      })
      .catch((error) => {
        if (cancelled) return;
        setAccountNotice(`Account detail load failed: ${error instanceof Error ? error.message : String(error)}`);
      });
    return () => { cancelled = true; };
  }, [selectedAccountId, session?.token]);

  useEffect(() => {
    if (!session || !selectedAccountId) {
      setRuntimeRehydrationState(null);
      setRuntimeRehydrationNotice("Select an account to load its governed runtime session.");
      return;
    }
    let cancelled = false;
    loadRuntimeRehydration(session)
      .then((rehydration) => {
        if (cancelled) return;
        if (rehydration.workspaceSession?.accountId && rehydration.workspaceSession.accountId !== selectedAccountId) {
          setRuntimeRehydrationState(null);
          setRuntimeRehydrationNotice("No governed runtime session is active for the selected account.");
          return;
        }
        setRuntimeRehydrationState(rehydration);
        const workspaceSession = rehydration.workspaceSession;
        // Account selection is intentionally never restored automatically. A user must
        // select an account before any customer-scoped data becomes visible or loads.
        if (workspaceSession?.productId) setSelectedProductId(workspaceSession.productId);
        if (workspaceSession?.opportunityId) setActiveCommercialOpportunityId(workspaceSession.opportunityId);
        if (rehydration.opportunity) {
          const opportunity = rehydration.opportunity as unknown as CommercialOpportunityRecord;
          setCommercialOpportunities((prev) => [opportunity, ...prev.filter((candidate) => candidate.opportunityId !== opportunity.opportunityId)]);
        }
        if (rehydration.proposal) upsertProposalRuntimeRecord(rehydration.proposal);
        if (rehydration.draftPackage) setActiveDraftIofPackage(rehydration.draftPackage);
        if (workspaceSession?.selectedRoute && bidPlan.routePlans.some((route) => route.routeRequirement.routeRequirementId === workspaceSession.selectedRoute)) {
          setSelectedScopeId(workspaceSession.selectedRoute);
        }
        setRuntimeRehydrationNotice(workspaceSession?.proposalId
          ? `Runtime restored ${workspaceSession.proposalId} at ${workspaceSession.currentLifecycleStage ?? "current lifecycle"}.`
          : "Runtime session loaded; no governed Proposal has been selected yet.");
      })
      .catch((error) => {
        if (cancelled) return;
        setRuntimeRehydrationNotice(`Runtime rehydration unavailable: ${error instanceof Error ? error.message : String(error)}`);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedAccountId, session?.token]);

  useEffect(() => {
    if (!accountEditorOpen || accountEditorMode !== "edit") return;
    setAccountDraft(accountEditorFromAccount(selectedAccount));
  }, [accountEditorMode, accountEditorOpen, selectedAccount.accountId]);

  function handleCreateAccountDraft() {
    resetCommercialOpportunityWorkingState();
    setAccountEditorMode("create");
    setAccountDraft(emptyAccountEditor(currentUserName));
    setContactDraft(contactEditorDefaults());
    setAccountEditorOpen(true);
    setAccountNotice("Create a governed Account workspace root before starting downstream work.");
  }

  function handleEditSelectedAccount() {
    setAccountEditorMode("edit");
    setAccountDraft(accountEditorFromAccount(selectedAccount));
    setContactDraft(contactEditorDefaults());
    setAccountEditorOpen((value) => !value);
  }

  function updateAccountDraftField<K extends keyof AccountEditorState>(field: K, value: AccountEditorState[K]) {
    setAccountDraft((prev) => ({ ...(prev ?? emptyAccountEditor(currentUserName)), [field]: value }));
  }

  function updateContactDraftField<K extends keyof ContactEditorState>(field: K, value: ContactEditorState[K]) {
    setContactDraft((prev) => ({ ...(prev ?? contactEditorDefaults()), [field]: value }));
  }

  async function handleSaveAccountDraft() {
    const name = accountDraft.name.trim();
    const nextAccountNumber = Math.max(0, ...accountOptions.map((account) => account.accountNumber)) + 1;
    const requestedAccountId = cleanAccountId(accountDraft.accountId);
    const accountId = requestedAccountId || (accountEditorMode === "create" ? `account-${nextAccountNumber}` : cleanAccountId(name));
    if (!name || !accountId) {
      setAccountNotice("Account name is required.");
      return;
    }
    setAccountPersistencePending(true);
    try {
      const existing = governedAccounts.find((account) => account.accountId === accountId);
      const baseAccount = accountEditorMode === "edit" ? (existing ?? selectedGovernedAccount ?? {}) : (existing ?? {});
      const fixtureAccount = accountOptions.find((account) => account.accountId === accountId);
      const accountNumber = Number(existing?.accountNumber ?? fixtureAccount?.accountNumber ?? nextAccountNumber);
      const saved = await CustomerRepository.saveCustomer({
        ...baseAccount,
        accountId,
        accountNumber,
        name,
        customerId: customerIdForAccount(accountId),
        accountType: accountDraft.accountType,
        status: accountDraft.status,
        salesOwner: accountDraft.salesOwner || currentUserName,
        primaryEngineeringContact: accountDraft.primaryEngineeringContact || "TBD",
        procurementContact: accountDraft.procurementContact || "TBD",
        notes: accountDraft.notes,
        organizationId: currentOrganizationId,
        workspaceId: currentWorkspaceId,
        ownerId: existing?.ownerId ?? currentUserId,
        contactIds: (baseAccount as GovernedAccount).contactIds ?? [],
        contacts: (baseAccount as GovernedAccount).contacts ?? [],
        activeOpportunities: (baseAccount as GovernedAccount).activeOpportunities ?? [],
        existingNetworks: (baseAccount as GovernedAccount).existingNetworks ?? [],
        operationalObjects: (baseAccount as GovernedAccount).operationalObjects ?? [],
        commercialEngagements: (baseAccount as GovernedAccount).commercialEngagements?.length ? (baseAccount as GovernedAccount).commercialEngagements : [`${name} commercial workspace`],
        proposalHistory: (baseAccount as GovernedAccount).proposalHistory ?? [],
        customerReviewHistory: (baseAccount as GovernedAccount).customerReviewHistory ?? [],
        engineeringHistory: (baseAccount as GovernedAccount).engineeringHistory ?? [],
      });
      setGovernedAccounts((prev) => [saved, ...prev.filter((account) => account.accountId !== saved.accountId)]);
      setSelectedAccountId(saved.accountId);
      setAccountEditorOpen(false);
      setAccountNotice(`Account ${accountNumber} · ${saved.name} saved as a governed workspace root.`);
      void recordActivity({
        action: "saved account",
        objectType: "Account",
        objectId: saved.accountId,
        objectName: saved.name,
        customerId: saved.accountId,
        details: "Account persisted to the governed Account Library and mirrored into commercial records.",
      });
      await refreshAccountLibrary(`${saved.name} Account Library record refreshed.`, saved.accountId);
    } catch (error) {
      setAccountNotice(`Account save failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setAccountPersistencePending(false);
    }
  }

  async function handleSaveContactDraft() {
    if (!selectedAccount.accountId) {
      setAccountNotice("Save an Account before adding Contacts.");
      return;
    }
    const nextContactDraft = contactDraft ?? contactEditorDefaults();
    const name = nextContactDraft.name.trim();
    if (!name) {
      setAccountNotice("Contact name is required.");
      return;
    }
    setAccountPersistencePending(true);
    try {
      const saved = await CustomerRepository.saveContact({
        accountId: selectedAccount.accountId,
        name,
        title: nextContactDraft.title,
        role: nextContactDraft.role,
        email: nextContactDraft.email,
        phone: nextContactDraft.phone,
        status: "Active",
        recipientWorkflows: ["PROPOSAL_RECIPIENT", "CUSTOMER_REVIEW", "CUSTOMER_APPROVAL", "SOF_RECIPIENT"],
        proposalRecipient: true,
        customerReviewRecipient: true,
        approvalAuthority: true,
        sofRecipient: true,
        serviceOrderRecipient: true,
        organizationId: currentOrganizationId,
        workspaceId: currentWorkspaceId,
        ownerId: selectedGovernedAccount?.ownerId ?? currentUserId,
      });
      setGovernedContacts((prev) => [saved, ...prev.filter((contact) => contact.contactId !== saved.contactId)]);
      setContactDraft(contactEditorDefaults());
      setAccountNotice(`${saved.name} added to ${selectedAccount.name}.`);
      void recordActivity({
        action: "saved contact",
        objectType: "Contact",
        objectId: saved.contactId,
        objectName: saved.name,
        customerId: saved.accountId,
        details: "Contact persisted to the governed Contact Library and mirrored into commercial records.",
      });
      await refreshAccountLibrary(`${saved.name} Contact Library record refreshed.`);
    } catch (error) {
      setAccountNotice(`Contact save failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setAccountPersistencePending(false);
    }
  }

  const googleFixtureIsActive = selectedAccount.accountId === "google";
  const accountNetworks = useMemo(
    () => COMMERCIAL_NETWORKS.filter((network) => (
      network.accountId === selectedAccount.accountId &&
      !network.sourceAssetName.startsWith("Derived from parsed KMZ")
    )),
    [selectedAccount.accountId],
  );
  const accountCustomerNetworkGraph = customerNetworkGraph?.accountId === selectedAccount.accountId ? customerNetworkGraph : null;
  const accountCustomerTwin = useMemo<CustomerTwinState | null>(
    () => buildCustomerTwinFromNetworkGraph(accountCustomerNetworkGraph),
    [accountCustomerNetworkGraph],
  );
  const accountParsedInventoryLayers = useMemo(
    () => (accountCustomerNetworkGraph?.layers ?? []).filter((layer) => layer.accountId === selectedAccount.accountId),
    [accountCustomerNetworkGraph, selectedAccount.accountId],
  );
  const accountNetworkRecords = useMemo<CommercialNetworkRecord[]>(
    () => accountNetworks.map((network) => {
      const parsedLayer = network.inventoryLayerId
        ? accountParsedInventoryLayers.find((layer) => layer.layerId === network.inventoryLayerId)
        : undefined;
      if (!parsedLayer) {
        return {
          ...network,
          parsedStatus: network.parsedStatus ?? (network.networkCategory === "CUSTOMER_INVENTORY" ? customerInventoryLoadStatus : undefined),
        };
      }
      const parsedNetworkCategory: CommercialNetworkCategory = parsedLayer.authorityState === "CUSTOMER_PROPOSED_NETWORK" ? "CUSTOMER_PROPOSED" : network.networkCategory;
      const parsedAuthorityState: CommercialNetworkRecord["authorityState"] = parsedLayer.authorityState === "CUSTOMER_PROPOSED_NETWORK" ? "CUSTOMER_PROPOSED_NETWORK" : "EXISTING_NETWORK";
      return {
        ...network,
        networkCategory: parsedNetworkCategory,
        authorityState: parsedAuthorityState,
        parsedStatus: parsedLayer.parsedStatus,
        routeMiles: parsedLayer.routeMiles,
        status: parsedLayer.parsedStatus === "PARSED" ? "Parsed" : parsedLayer.parsedStatus,
        lastUpdated: parsedLayer.lastUpdated,
        geometryStatus: `${parsedLayer.routeLineCount.toLocaleString()} route/path lines and ${parsedLayer.objectCount.toLocaleString()} markers parsed from ${parsedLayer.kmlEntryName ?? "KMZ"}`,
        objectCount: parsedLayer.objectCount,
        stationCount: parsedLayer.stationCount,
        featureCount: parsedLayer.featureCount,
        inventorySessionVersion: accountCustomerNetworkGraph?.inventorySessionVersion,
        diversityConstraintByDefault: parsedLayer.useAsDiversityConstraintByDefault,
        confidence: "Parsed KMZ",
      };
    }),
    [accountNetworks, accountParsedInventoryLayers, accountCustomerNetworkGraph?.inventorySessionVersion, customerInventoryLoadStatus],
  );
  const accountLiveSession = googleFixtureIsActive && liveCommercialSession?.accountId === selectedAccount.accountId ? liveCommercialSession : null;
  const liveDraftRoutePlan = accountLiveSession?.routePlan ?? null;
  const commercialRoutePlans = useMemo(
    () => bidPlan.routePlans.map((route) => (
      liveDraftRoutePlan && route.routeRequirement.routeRequirementId === liveDraftRoutePlan.routeRequirement.routeRequirementId
        ? liveDraftRoutePlan
        : route
    )),
    [bidPlan.routePlans, liveDraftRoutePlan],
  );
  const commercialBidPlan = useMemo(
    () => rebuildGoogleRfpBidPlanFromRoutePlans(bidPlan.opportunity, commercialRoutePlans),
    [bidPlan.opportunity, commercialRoutePlans],
  );
  const inventoryReferenceGraph = commercialBidPlan.routePlans[0]?.proposedGraph ?? bidPlan.routePlans[0]?.proposedGraph ?? null;
  const pricingScopes: PricingScopeSelection[] = useMemo(() => [
    ...commercialBidPlan.routePlans.map((route) => ({
      scopeId: route.routeRequirement.routeRequirementId,
      label: routeLabel(route),
      kind: "ROUTE" as const,
      routeRequirementIds: [route.routeRequirement.routeRequirementId],
    })),
    {
      scopeId: "COMBINED_AWARD",
      label: "Combined Award",
      kind: "COMBINED_AWARD",
      routeRequirementIds: commercialBidPlan.routePlans.map((route) => route.routeRequirement.routeRequirementId),
    },
  ], [commercialBidPlan.routePlans]);
  const selectedScope = pricingScopes.find((scope) => scope.scopeId === selectedScopeId) ?? pricingScopes[0];
  const selectedRoutePlans = useMemo(
    () => commercialBidPlan.routePlans.filter((route) => selectedScope?.routeRequirementIds.includes(route.routeRequirement.routeRequirementId)),
    [commercialBidPlan.routePlans, selectedScope],
  );
  const selectedAssumptionState = assumptionStates.find((state) => state.stateId === selectedAssumptionStateId) ?? assumptionStates[0];
  const selectedCivilMixCalibration = useMemo<CivilMixCalibration>(() => {
    const constraintValue = (key: (typeof CIVIL_MIX_CONSTRAINT_KEYS)[number], fallback: number) => {
      const value = transparentEstimateControls.constraints?.[key]?.value;
      return typeof value === "number" ? Math.round(value) : fallback;
    };
    const combinedBorePercent = selectedAssumptionState.civilMix.hddPercent;
    const fallbackRockPercent = Math.round(combinedBorePercent * (selectedAssumptionState.borePricing.rockBorePercent / 100));
    const fallbackDirtPercent = Math.max(0, combinedBorePercent - fallbackRockPercent);
    return {
      plowPercent: constraintValue("civil.plowPercent", selectedAssumptionState.civilMix.plowPercent),
      dirtPercent: constraintValue("civil.directionalBoreDirtPercent", fallbackDirtPercent),
      rockPercent: constraintValue("civil.directionalBoreRockPercent", fallbackRockPercent),
      trenchPercent: constraintValue("civil.openTrenchPercent", selectedAssumptionState.civilMix.openCutPercent),
    };
  }, [selectedAssumptionState, transparentEstimateControls.constraints]);
  const accountCustomerDesignImports = useMemo(
    () => customerDesignImports.filter((record) => record.accountId === selectedAccount.accountId),
    [customerDesignImports, selectedAccount.accountId],
  );
  const accountImportedCustomerRoutes = useMemo(
    () => accountCustomerDesignImports.flatMap((record) => record.routes.map((route) => ({ importRecord: record, route }))),
    [accountCustomerDesignImports],
  );
  const accountCommercialOpportunities = useMemo(
    () => commercialOpportunities.filter((record) => record.accountId === selectedAccount.accountId),
    [commercialOpportunities, selectedAccount.accountId],
  );
  const accountOpportunityGroups = useMemo(() => {
    const lifecycleOrder = ["AUTHORIZED", "COUNTERSIGNED", "CUSTOMER_SIGNED", "SERVICE_ORDER", "CERTIFIED", "ENGINEERING", "ACCEPTED", "CUSTOMER_REVIEW", "PROPOSED", "DRAFT", "SAVED", "RECENT", "ARCHIVED"];
    const dealState = new Map((accountDealTwin?.deals ?? []).map((deal) => [deal.opportunityId, deal.currentState]));
    const groups = new Map<string, CommercialOpportunityRecord[]>();
    for (const record of accountCommercialOpportunities) {
      const state = record.status === "ARCHIVED" ? "ARCHIVED" : String(dealState.get(record.opportunityId) ?? record.state ?? record.status ?? "DRAFT").toUpperCase();
      groups.set(state, [...(groups.get(state) ?? []), record]);
    }
    return [...groups.entries()]
      .sort(([a], [b]) => (lifecycleOrder.indexOf(a) < 0 ? 999 : lifecycleOrder.indexOf(a)) - (lifecycleOrder.indexOf(b) < 0 ? 999 : lifecycleOrder.indexOf(b)))
      .map(([state, records]) => ({ state, records: records.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))) }));
  }, [accountCommercialOpportunities, accountDealTwin?.deals]);
  const recentCommercialOpportunities = useMemo(
    () => [...accountCommercialOpportunities]
      .filter((record) => record.status !== "ARCHIVED")
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 6),
    [accountCommercialOpportunities],
  );
  const savedCommercialOpportunities = useMemo(
    () => [...accountCommercialOpportunities]
      .filter((record) => record.status === "SAVED" || record.status === "RECENT")
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [accountCommercialOpportunities],
  );
  const archivedCommercialOpportunities = useMemo(
    () => [...accountCommercialOpportunities]
      .filter((record) => record.status === "ARCHIVED")
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [accountCommercialOpportunities],
  );
  const recentRuntimeActivity = useMemo(
    () => activity
      .filter((event) => !event.customerId || event.customerId === selectedAccount.accountId || event.objectType === "Runtime")
      .slice(0, 6),
    [activity, selectedAccount.accountId],
  );
  const accountRuntimeHistory = useMemo(
    () => runtimeHistory
      .filter((event) => (
        event.accountId === selectedAccount.accountId ||
        event.customerId === selectedAccount.accountId ||
        event.customerId === customerIdForAccount(selectedAccount.accountId) ||
        event.metadata?.accountId === selectedAccount.accountId ||
        event.metadata?.customerId === customerIdForAccount(selectedAccount.accountId)
      ))
      .slice(0, 8),
    [runtimeHistory, selectedAccount.accountId],
  );
  const recentEngineeringDrafts = useMemo(
    () => engineeringDrafts
      .filter((draft) => (draft.commercialDraft as any)?.accountId === selectedAccount.accountId || (draft.commercialDraft as any)?.accountName === selectedAccount.name)
      .slice(0, 4),
    [engineeringDrafts, selectedAccount.accountId, selectedAccount.name],
  );
  const activeCommercialOpportunity = accountCommercialOpportunities.find((record) => record.opportunityId === activeCommercialOpportunityId) ?? null;
  const visibleRuntimeOpportunities = useMemo(
    () => commercialOpportunities.filter((record) => record.status !== "ARCHIVED"),
    [commercialOpportunities],
  );
  const myRuntimeOpportunities = useMemo(
    () => visibleRuntimeOpportunities.filter((record) => record.ownerId === currentUserId),
    [currentUserId, visibleRuntimeOpportunities],
  );
  const assignedRuntimeWork = useMemo(
    () => visibleRuntimeOpportunities.filter((record) => record.ownerId !== currentUserId && opportunityAssignedTo(record).includes(currentUserId)),
    [currentUserId, visibleRuntimeOpportunities],
  );
  const pendingRuntimeApprovals = useMemo(
    () => visibleRuntimeOpportunities.filter((record) => (
      record.authority?.reviewers?.includes(currentUserId) ||
      record.authority?.approvers?.includes(currentUserId) ||
      record.authority?.executives?.includes(currentUserId)
    )),
    [currentUserId, visibleRuntimeOpportunities],
  );
  const runtimeNotifications = useMemo(
    () => [
      ...assignedRuntimeWork.map((record) => `${record.name} assigned by ${record.owner ?? runtimeUserLabel(record.ownerId)}`),
      ...pendingRuntimeApprovals.map((record) => `${record.name} awaiting ${record.authority?.executives?.includes(currentUserId) ? "executive review" : "review"}`),
    ].slice(0, 5),
    [assignedRuntimeWork, currentUserId, pendingRuntimeApprovals],
  );
  const canModifyActiveOpportunity = Boolean(activeCommercialOpportunity && (
    activeCommercialOpportunity.ownerId === currentUserId ||
    activeCommercialOpportunity.authority?.contributors?.includes(currentUserId) ||
    activeCommercialOpportunity.authority?.approvers?.includes(currentUserId)
  ));
  const executiveDashboardEnabled = Boolean(session?.user.dashboard?.executiveOverview);
  const selectedImportedCustomerDesignEntry = useMemo(
    () => {
      if (!selectedCustomerDesignImportId || !selectedCustomerDesignRouteId) return null;
      return accountImportedCustomerRoutes.find((entry) => (
        entry.importRecord.importId === selectedCustomerDesignImportId &&
        entry.route.routeId === selectedCustomerDesignRouteId
      )) ?? null;
    },
    [accountImportedCustomerRoutes, selectedCustomerDesignImportId, selectedCustomerDesignRouteId],
  );
  const selectedImportedCustomerDesignImport = selectedImportedCustomerDesignEntry?.importRecord ?? null;
  const selectedImportedCustomerRoute = selectedImportedCustomerDesignEntry?.route ?? null;
  const storedSelectedImportedCommercialDraft =
    selectedImportedCustomerRoute?.pricedDraft ??
    (selectedImportedCustomerRoute && importedCommercialDraft?.routeId === commercialDraftRouteIdForImportedRoute(selectedImportedCustomerRoute.routeId) ? importedCommercialDraft : null);
  const selectedImportedCommercialDraft = useMemo(() => {
    if (!storedSelectedImportedCommercialDraft || !selectedImportedCustomerDesignImport || !selectedImportedCustomerRoute) return storedSelectedImportedCommercialDraft;
    return buildCommercialCorridorDraftFromImportedRoute({
      importRecord: selectedImportedCustomerDesignImport,
      importedRoute: selectedImportedCustomerRoute,
      assumptionState: selectedAssumptionState,
      estimateControls: transparentEstimateControls,
    }) ?? storedSelectedImportedCommercialDraft;
  }, [
    selectedAssumptionState,
    selectedImportedCustomerDesignImport,
    selectedImportedCustomerRoute,
    storedSelectedImportedCommercialDraft,
    transparentEstimateControls,
  ]);
  const temporaryImportedCommercialDraft = useMemo(() => {
    if (!temporaryImportedRoute) return null;
    return buildCommercialCorridorDraftFromImportedRoute({
      importRecord: temporaryImportedRoute.importRecord,
      importedRoute: temporaryImportedRoute.route,
      assumptionState: selectedAssumptionState,
      estimateControls: transparentEstimateControls,
    }) ?? temporaryImportedRoute.draft;
  }, [selectedAssumptionState, temporaryImportedRoute, transparentEstimateControls]);
  const selectedImportedCustomerRouteGeometry = useMemo(
    () => geometryForImportedRoute(selectedImportedCustomerRoute),
    [selectedImportedCustomerRoute],
  );
  const importedCustomerGeometryLoaded = selectedImportedCustomerRouteGeometry.length > 1;
  const importedCustomerGeometryError = selectedImportedCustomerDesignImport && selectedImportedCustomerRoute && !importedCustomerGeometryLoaded
    ? `Imported route geometry not loaded for active designId ${selectedImportedCustomerDesignImport.designId}`
    : "";
  const importedCustomerDesignGraph = useMemo(
    () => selectedImportedCustomerDesignImport && selectedImportedCustomerRoute
      ? buildImportedCustomerDesignGraph(selectedImportedCustomerDesignImport, selectedImportedCustomerRoute, selectedImportedCommercialDraft ?? null)
      : null,
    [selectedImportedCustomerDesignImport, selectedImportedCustomerRoute, selectedImportedCommercialDraft],
  );
  const scopedBidPlan = useMemo(() => ({
    ...commercialBidPlan,
    routePlans: selectedRoutePlans,
  }), [commercialBidPlan, selectedRoutePlans]);
  const preview = useMemo(() => buildGoogleBidPackagePreview(scopedBidPlan), [scopedBidPlan]);
  const selectedPricingSummary = useMemo(() => createSelectedScopePricingSummary({
    scope: selectedScope,
    routes: selectedRoutePlans.map(routeInput).filter((input): input is NonNullable<typeof input> => Boolean(input)),
    assumptionState: selectedAssumptionState,
  }), [selectedAssumptionState, selectedRoutePlans, selectedScope]);
  const selectedScopeRouteKey = selectedScope.routeRequirementIds.join("|");
  const activeLiveSession = accountLiveSession && selectedScope.routeRequirementIds.includes(accountLiveSession.routeRequirementId) ? accountLiveSession : null;
  const accountSnapshots = proposalSnapshots.filter((snapshot) => snapshot.accountId === selectedAccount.accountId);
  const accountCustomerDrafts = customerDrafts.filter((draft) => draft.accountId === selectedAccount.accountId);
  const accountAcceptedProposal = acceptedProposal?.accountId === selectedAccount.accountId ? acceptedProposal : null;
  const accountProposalRuntimeRecords = useMemo(
    () => proposalRuntimeRecords
      .filter((record) => (
        record.accountId === selectedAccount.accountId ||
        record.customerId === customerIdForAccount(selectedAccount.accountId) ||
        record.customerId === selectedAccount.accountId
      ))
      .sort((a, b) => String(b.updatedAt ?? b.createdAt).localeCompare(String(a.updatedAt ?? a.createdAt))),
    [proposalRuntimeRecords, selectedAccount.accountId],
  );
  const activeOpportunityProposalRecords = accountProposalRuntimeRecords.filter((record) => (
    Boolean(activeCommercialOpportunityId) &&
    (
      record.opportunityId === activeCommercialOpportunityId ||
      record.opportunityId === activeCommercialOpportunity?.opportunityId ||
      record.proposalId === activeCommercialOpportunity?.proposalId ||
      record.proposalRecordId === activeCommercialOpportunity?.proposalId
    )
  ));
  const activeApprovedProposalRuntime = activeOpportunityProposalRecords.find(proposalRepositoryReportsCommercialApproved) ?? null;
  const activeProposalRuntime =
    activeApprovedProposalRuntime ??
    activeOpportunityProposalRecords[0] ??
    (activeCommercialOpportunity ? null : accountProposalRuntimeRecords[0] ?? null);
  const savedProposalRevisions = activeProposalRuntime?.proposalRevisions ?? [];
  const selectedReleaseProposalRevision = savedProposalRevisions.find((revision) => revision.proposalRevisionId === releaseProposalRevisionId)
    ?? savedProposalRevisions.find((revision) => revision.proposalRevisionId === activeProposalRuntime?.proposalRevisionId)
    ?? savedProposalRevisions.at(-1)
    ?? null;
  const selectedReleaseApproval = selectedReleaseProposalRevision && activeProposalRuntime
    ? proposalRevisionApproval(selectedReleaseProposalRevision, activeProposalRuntime.approvals ?? [])
    : null;
  const selectedReleaseProposalEligible = Boolean(
    selectedReleaseProposalRevision?.revisionStatus === "SAVED" &&
    selectedReleaseProposalRevision.proposalHash &&
    selectedReleaseApproval,
  );

  useEffect(() => {
    if (activeCommercialOpportunity?.name) {
      setOpportunityNameDraft(activeCommercialOpportunity.name);
    } else if (!selectedAccount.accountId) {
      setOpportunityNameDraft("");
    } else {
      setOpportunityNameDraft(`${selectedAccount.name} Opportunity`);
    }
  }, [activeCommercialOpportunity?.opportunityId, selectedAccount.name]);
  const isCustomerParticipant = session?.user.role === "CUSTOMER_PARTICIPANT";
  const canManageProposalRuntime = Boolean(session && can("proposal.manage"));
  const canReviewProposalRuntime = Boolean(session && can("proposal.review"));
  const canReadEngineeringCertification = Boolean(session && (can("workspace.engineering.read") || can("workspace.engineering.write") || can("scopeversion.authority")));
  const canWriteEngineeringCertification = Boolean(session && (can("workspace.engineering.write") || can("scopeversion.authority")));
  const commercialDeveloperMode = Boolean(session && (can("runtime.deploy") || can("workspace.engineering.write") || can("scopeversion.authority")));
  const accountNetworkInventory = useMemo(
    () => [
      ...accountNetworkRecords,
      ...(accountAcceptedProposal ? [acceptedProposalToNetworkRecord(accountAcceptedProposal)] : []),
      ...accountCustomerDrafts.map((draft) => customerDraftToNetworkRecord(draft, selectedAccount)),
    ],
    [accountAcceptedProposal, accountCustomerDrafts, accountNetworkRecords, selectedAccount],
  );
  const accountNetworkCounts = useMemo(
    () => Object.fromEntries(
      NETWORK_CATEGORY_ORDER.map((category) => [
        category,
        accountNetworkInventory.filter((network) => network.networkCategory === category).length,
      ]),
    ) as Record<CommercialNetworkCategory, number>,
    [accountNetworkInventory],
  );
  const activeExistingReferenceNetworkIds = useMemo(
    () => accountNetworkInventory
      .filter((network) => network.networkCategory === "CUSTOMER_INVENTORY" && resolveNetworkLayerState(network, networkLayerStates).activeReference)
      .map((network) => network.networkId),
    [accountNetworkInventory, networkLayerStates],
  );
  const activeProposedReferenceNetworkIds = useMemo(
    () => accountNetworkInventory
      .filter((network) => network.networkCategory === "CUSTOMER_PROPOSED" && resolveNetworkLayerState(network, networkLayerStates).activeReference)
      .map((network) => network.networkId),
    [accountNetworkInventory, networkLayerStates],
  );
  const activeCustomerInventoryNetworks = useMemo(
    () => accountNetworkInventory.filter((network) => network.networkCategory === "CUSTOMER_INVENTORY" && resolveNetworkLayerState(network, networkLayerStates).activeReference),
    [accountNetworkInventory, networkLayerStates],
  );
  const activeCustomerProposedNetworks = useMemo(
    () => accountNetworkInventory.filter((network) => network.networkCategory === "CUSTOMER_PROPOSED" && resolveNetworkLayerState(network, networkLayerStates).activeReference),
    [accountNetworkInventory, networkLayerStates],
  );
  const activeCommercialDraftNetworks = useMemo(
    () => accountNetworkInventory.filter((network) => network.networkCategory === "COMMERCIAL_DRAFT" && resolveNetworkLayerState(network, networkLayerStates).activeReference),
    [accountNetworkInventory, networkLayerStates],
  );
  const activeDiversityConstraintNetworks = useMemo(
    () => accountNetworkInventory.filter((network) => (
      (network.networkCategory === "CUSTOMER_INVENTORY" || network.networkCategory === "CUSTOMER_PROPOSED") &&
      resolveNetworkLayerState(network, networkLayerStates).diversityConstraint
    )),
    [accountNetworkInventory, networkLayerStates],
  );
  const activeInventoryLayerIds = useMemo(
    () => activeCustomerInventoryNetworks
      .map((network) => network.inventoryLayerId)
      .filter((layerId): layerId is string => Boolean(layerId)),
    [activeCustomerInventoryNetworks],
  );
  const customerTwinRouteUsesByLayerId = useMemo(
    () => Object.fromEntries(
      accountNetworkInventory
        .filter((network) => network.inventoryLayerId)
        .map((network) => {
          const layerState = resolveNetworkLayerState(network, networkLayerStates);
          return [network.inventoryLayerId as string, customerTwinRouteUseForLayerState(layerState)];
        }),
    ) as Record<string, CustomerTwinRouteUse>,
    [accountNetworkInventory, networkLayerStates],
  );
  const accountRenderableCustomerTwin = useMemo(
    () => projectCustomerTwinForRender(accountCustomerTwin, selectedAccount.accountId, {
      routeUsesByLayerId: customerTwinRouteUsesByLayerId,
    }),
    [accountCustomerTwin, customerTwinRouteUsesByLayerId, selectedAccount.accountId],
  );
  useEffect(() => {
    const metric = startRuntimePerformanceOperation("initial-render", "STARTUP", {
      customerId: selectedAccount.accountId,
    });
    const frameId = window.requestAnimationFrame(() => {
      const completed = metric.end({
        recordsRendered: renderCountRef.current,
        workerStatus: "INITIAL_RENDER_READY",
      });
      setRuntimePerformance((prev) => runtimePerformanceSnapshot({
        ...prev,
        initialRenderMs: completed.durationMs,
        reactRenderCount: renderCountRef.current,
        workerStatus: "INITIAL_RENDER_READY",
      }));
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [selectedAccount.accountId]);
  useEffect(() => {
    const visibleRoutes = accountRenderableCustomerTwin.routes.length;
    const renderedObjects = accountRenderableCustomerTwin.objects.length;
    const visibleStations = accountRenderableCustomerTwin.stations.length;
    const metric = startRuntimePerformanceOperation("frame", "REACT_RENDER", {
      customerId: selectedAccount.accountId,
      visibleRoutes,
      renderedObjects,
      visibleStations,
    });
    const completed = metric.end({
      recordsRendered: visibleRoutes + renderedObjects + visibleStations,
      metadata: {
        reactRenderCount: renderCountRef.current,
      },
    });
    setRuntimePerformance((prev) => runtimePerformanceSnapshot({
      ...prev,
      reactRenderCount: renderCountRef.current,
      frameTimingMs: completed.durationMs,
      visibleRoutes,
      renderedObjects,
      visibleStations,
      viewportObjectCount: visibleRoutes + renderedObjects + visibleStations,
    }));
  }, [
    accountRenderableCustomerTwin.objects.length,
    accountRenderableCustomerTwin.routes.length,
    accountRenderableCustomerTwin.stations.length,
    selectedAccount.accountId,
  ]);
  const opportunityScoutScope = useMemo(
    () => ({ selectedInventoryLayerIds: activeInventoryLayerIds }),
    [activeInventoryLayerIds],
  );
  const opportunityScoutSiteDecision = useMemo(
    () => opportunityScoutCandidate && (
      commercialDraftType === "NEW_GRAPH_CORRIDOR"
        ? commercialRouteResult?.status === "ROUTED"
        : siteDecisionCanRun(opportunityWorkflowState)
    )
      ? runOpportunityScoutSiteDecision(opportunityScoutCandidate, accountRenderableCustomerTwin, opportunityScoutScope)
      : null,
    [accountRenderableCustomerTwin, commercialDraftType, commercialRouteResult?.status, opportunityScoutCandidate, opportunityScoutScope, opportunityWorkflowState],
  );
  const opportunityAttachmentResolution = useMemo(() => {
    if (commercialDraftType !== "EXISTING_GRAPH_EXTENSION" || !opportunityScoutCandidate || !siteDecisionCanRun(opportunityWorkflowState)) return null;
    const location = attachmentSearchLocation(opportunityScoutCandidate, activeDesignMode, commercialDraftType);
    if (!location) return null;
    return resolveCommercialAttachment({
      accountId: selectedAccount.accountId,
      candidateLocationId: location.id,
      latitude: location.latitude,
      longitude: location.longitude,
      customerTwinState: accountRenderableCustomerTwin,
      selectedInventoryLayerIds: activeInventoryLayerIds,
    });
  }, [accountRenderableCustomerTwin, activeDesignMode, activeInventoryLayerIds, commercialDraftType, opportunityScoutCandidate, opportunityWorkflowState, selectedAccount.accountId]);
  const selectedAttachmentCandidate = useMemo(
    () => opportunityAttachmentResolution?.alternatives.find((attachment) => attachment.id === selectedAttachmentCandidateId) ??
      opportunityAttachmentResolution?.recommendedAttachment ??
      null,
    [opportunityAttachmentResolution, selectedAttachmentCandidateId],
  );
  const opportunityScoutQuickQuote = useMemo(
    () => commercialDraftType === "EXISTING_GRAPH_EXTENSION" && opportunityScoutCandidate && opportunityScoutSiteDecision && quickQuoteCanRun(opportunityWorkflowState)
      ? runOpportunityQuickQuote({
          candidate: opportunityScoutCandidate,
          siteDecision: opportunityScoutSiteDecision,
          routeResult: commercialRouteResult,
          attachmentResolution: opportunityAttachmentResolution,
          selectedAttachment: selectedAttachmentCandidate,
          assumptionState: selectedAssumptionState,
        })
      : null,
    [commercialDraftType, commercialRouteResult, opportunityAttachmentResolution, opportunityScoutCandidate, opportunityScoutSiteDecision, opportunityWorkflowState, selectedAssumptionState, selectedAttachmentCandidate],
  );
  const commercialCorridorDraft = useMemo<CommercialCorridorDraft | null>(
    () => commercialDraftType === "NEW_GRAPH_CORRIDOR" && opportunityScoutCandidate && corridorDraftCanRun(opportunityWorkflowState)
      ? buildCommercialCorridorDraft({
          candidate: opportunityScoutCandidate,
          routeResult: commercialRouteResult,
          assumptionState: selectedAssumptionState,
          estimateControls: transparentEstimateControls,
        })
      : null,
    [commercialDraftType, commercialRouteResult, opportunityScoutCandidate, opportunityWorkflowState, selectedAssumptionState, transparentEstimateControls],
  );
  useEffect(() => {
    if (!commercialCorridorDraft) return;
    setTransparentEstimateRecalculatedAt(new Date().toISOString());
  }, [
    commercialCorridorDraft?.routeId,
    commercialCorridorDraft?.transparentEstimate.totalKnownCost,
    commercialCorridorDraft?.transparentEstimate.sellPrice,
    commercialCorridorDraft?.transparentEstimate.mrc,
    commercialCorridorDraft?.transparentEstimate.confidence.score,
    commercialCorridorDraft?.transparentEstimate.commercialReadiness.score,
    commercialCorridorDraft?.transparentEstimate.controls.targetDurationDays,
  ]);
  useEffect(() => {
    if (!selectedImportedCommercialDraft) return;
    setTransparentEstimateRecalculatedAt(new Date().toISOString());
  }, [
    selectedImportedCommercialDraft?.routeId,
    selectedImportedCommercialDraft?.transparentEstimate.totalKnownCost,
    selectedImportedCommercialDraft?.transparentEstimate.sellPrice,
    selectedImportedCommercialDraft?.transparentEstimate.mrc,
    selectedImportedCommercialDraft?.transparentEstimate.confidence.score,
    selectedImportedCommercialDraft?.transparentEstimate.commercialReadiness.score,
    selectedImportedCommercialDraft?.transparentEstimate.controls.targetDurationDays,
  ]);
  useEffect(() => {
    if (!temporaryImportedCommercialDraft) return;
    setTransparentEstimateRecalculatedAt(new Date().toISOString());
  }, [
    temporaryImportedCommercialDraft?.routeId,
    temporaryImportedCommercialDraft?.transparentEstimate.totalKnownCost,
    temporaryImportedCommercialDraft?.transparentEstimate.sellPrice,
    temporaryImportedCommercialDraft?.transparentEstimate.mrc,
    temporaryImportedCommercialDraft?.transparentEstimate.confidence.score,
    temporaryImportedCommercialDraft?.transparentEstimate.commercialReadiness.score,
    temporaryImportedCommercialDraft?.transparentEstimate.controls.targetDurationDays,
  ]);
  useEffect(() => {
    if (!selectedImportedCustomerRoute?.pricedDraft) return;
    setImportedCommercialDraft(selectedImportedCustomerRoute.pricedDraft);
    setSelectedCommercialCorridorDraft(selectedImportedCustomerRoute.pricedDraft);
  }, [
    selectedImportedCustomerRoute?.routeId,
    selectedImportedCustomerRoute?.pricedDraft,
    setSelectedCommercialCorridorDraft,
  ]);
  const commercialDraftValidation = useMemo(() => {
    if (!commercialDraftType) return [];
    if (commercialDraftType === "NEW_GRAPH_CORRIDOR") {
      return [
        ["A/Z resolved", Boolean(opportunityScoutCandidate?.originLocation && opportunityScoutCandidate.destinationLocation)],
        ["OSRM corridor geometry", commercialRouteResult?.status === "ROUTED" && Boolean(commercialCorridorDraft?.geometry.length)],
        ["Route continuity", Boolean(commercialCorridorDraft && commercialCorridorDraft.geometry.length > 1)],
        ["Segment stationing", Boolean(commercialCorridorDraft?.routeSegments.length && commercialCorridorDraft.stationCount > 1)],
        ["Unknown constraints isolated", Boolean(commercialCorridorDraft && commercialCorridorDraft.unknownQuantities.every((item) => item.costImpact === 0))],
        ["Regen spacing", Boolean(commercialCorridorDraft && commercialCorridorDraft.regenCount >= 0)],
        ["Estimate sections", Boolean(commercialCorridorDraft?.transparentEstimate.sections.length)],
        ["Audit provenance", Boolean(commercialCorridorDraft?.transparentEstimate.auditTrail.length)],
        ["Diversity advisory", Boolean(opportunityScoutSiteDecision)],
      ] as Array<[string, boolean]>;
    }
    return [
      ["Customer attachment", Boolean(selectedAttachmentCandidate)],
      ["Attachment station", Boolean(selectedAttachmentCandidate?.stationId)],
      ["OSRM lateral geometry", commercialRouteResult?.status === "ROUTED" && Boolean(opportunityScoutQuickQuote?.geometry.length)],
      ["Lateral continuity", Boolean(opportunityScoutQuickQuote && opportunityScoutQuickQuote.geometry.length > 1)],
      ["Customer premise route", Boolean(opportunityScoutCandidate?.resolvedLocation || opportunityScoutCandidate?.destinationLocation)],
      ["Attach economics", Boolean(opportunityScoutQuickQuote?.budgetCost)],
    ] as Array<[string, boolean]>;
  }, [commercialCorridorDraft, commercialDraftType, commercialRouteResult?.status, opportunityScoutCandidate, opportunityScoutQuickQuote, opportunityScoutSiteDecision, selectedAttachmentCandidate]);
  const opportunityBrowserResults = useMemo(
    () => searchOpportunityBrowser(opportunityBrowserQuery, accountRenderableCustomerTwin, opportunityScoutScope),
    [accountRenderableCustomerTwin, opportunityBrowserQuery, opportunityScoutScope],
  );
  const commercialOpportunityOverlay = useMemo(() => {
    const sharedOpportunityMap = sharedOpportunityMapProjectionFromRouteRepository(
      activeCommercialOpportunity?.routeRepositorySnapshot ?? generatedRouteRepositorySnapshot,
    );
    const configuredAzPoints = [
      azOriginLocation ? {
        id: azOriginLocation.id,
        label: azOriginLocation.label,
        coordinate: [azOriginLocation.longitude, azOriginLocation.latitude] as [number, number],
        role: "A" as const,
      } : null,
      azDestinationLocation ? {
        id: azDestinationLocation.id,
        label: azDestinationLocation.label,
        coordinate: [azDestinationLocation.longitude, azDestinationLocation.latitude] as [number, number],
        role: "Z" as const,
      } : null,
    ].filter((point): point is { id: string; label: string; coordinate: [number, number]; role: "A" | "Z" } => Boolean(point));
    const azPoints = sharedOpportunityMap?.endpoints.length
      ? sharedOpportunityMap.endpoints.map((endpoint) => ({
          id: `${sharedOpportunityMap.routeRepositoryId}:endpoint:${endpoint.role}`,
          label: endpoint.label,
          coordinate: endpoint.coordinate,
          role: endpoint.role,
        }))
      : configuredAzPoints;
    const temporaryRouteGeometry = temporaryImportedCommercialDraft?.geometry?.length
      ? temporaryImportedCommercialDraft.geometry
      : temporaryImportedRoute?.geometry;
    const corridorGeometry = temporaryRouteGeometry?.length
      ? temporaryRouteGeometry
      : sharedOpportunityMap?.coordinates.length
        ? sharedOpportunityMap.coordinates
      : selectedImportedCommercialDraft
      ? undefined
      : loadedCommercialDraftSnapshot
        ? loadedCommercialDraftSnapshot.geometry
      : commercialRouteResult?.status === "ROUTED"
        ? (commercialCorridorDraft?.geometry ?? opportunityScoutQuickQuote?.geometry)
        : undefined;
    if (!opportunityScoutCandidate && !azPoints.length && !corridorGeometry?.length) return undefined;
    return {
      draftType: commercialDraftType ?? undefined,
      candidateCoordinate: commercialDraftType === "EXISTING_GRAPH_EXTENSION" ? opportunityScoutCandidate?.coordinate : undefined,
      candidateLabel: opportunityScoutCandidate?.label,
      azPoints,
      corridorGeometry,
      attachmentCandidates: commercialDraftType === "EXISTING_GRAPH_EXTENSION" ? opportunityAttachmentResolution?.alternatives.map((attachment, index) => ({
        id: attachment.id,
        label: index === 0 ? "Recommended attachment" : "Attachment option",
        coordinate: [attachment.projectedLongitude, attachment.projectedLatitude] as [number, number],
        selected: selectedAttachmentCandidate?.id === attachment.id,
      })) : undefined,
      quickQuoteLabel: temporaryImportedRoute
        ? `${formatRouteMiles(temporaryImportedCommercialDraft?.routeMiles ?? temporaryImportedRoute.route.routeMiles)} mi / ${temporaryImportedCommercialDraft ? money(temporaryImportedCommercialDraft.financialAuthority.constructionCost) : "estimate pending"} temporary import`
        : selectedImportedCommercialDraft
        ? `${formatRouteMiles(selectedImportedCommercialDraft.routeMiles)} mi / ${money(selectedImportedCommercialDraft.financialAuthority.constructionCost)} imported baseline`
        : loadedCommercialDraftSnapshot
        ? `${formatRouteMiles(loadedCommercialDraftSnapshot.routeMiles)} mi / ${money(loadedCommercialDraftSnapshot.financialAuthority.constructionCost)} saved draft`
        : commercialCorridorDraft
        ? `${formatRouteMiles(commercialCorridorDraft.routeMiles)} mi / ${money(commercialCorridorDraft.financialAuthority.constructionCost)} corridor`
        : opportunityScoutQuickQuote ? `${formatRouteMiles(opportunityScoutQuickQuote.routeMiles)} mi / ${money(opportunityScoutQuickQuote.budgetCost)} lateral` : undefined,
      confidence: temporaryImportedCommercialDraft?.transparentEstimate.confidence.score ?? opportunityScoutQuickQuote?.confidence,
    };
  }, [activeCommercialOpportunity?.routeRepositorySnapshot, azDestinationLocation, azOriginLocation, commercialCorridorDraft, commercialDraftType, commercialRouteResult?.status, generatedRouteRepositorySnapshot, loadedCommercialDraftSnapshot, opportunityAttachmentResolution, opportunityScoutCandidate, opportunityScoutQuickQuote, selectedAttachmentCandidate?.id, selectedImportedCommercialDraft, temporaryImportedCommercialDraft, temporaryImportedRoute]);
  const accountCustomerReviewStatus: CustomerReviewStatus = googleFixtureIsActive ? customerReviewStatus : "NOT_STARTED";
  const commercialMapLayers = useMemo(() => buildCommercialMapLayers({
    account: selectedAccount,
    customerTwinState: accountRenderableCustomerTwin,
    networks: accountNetworkInventory,
    layerStates: networkLayerStates,
    customerReviewStatus: accountCustomerReviewStatus,
    salesDraftActive: !temporaryImportedRoute && !selectedImportedCustomerRoute && (activeCommercialDraftNetworks.length > 0 || Boolean(loadedCommercialDraftSnapshot)),
    importedDesignActive: Boolean(temporaryImportedRoute?.geometry.length || (selectedImportedCustomerRoute && importedCustomerGeometryLoaded)),
    importedDesignLabel: temporaryImportedRoute ? `Temporary Imported Route / ${temporaryImportedRoute.route.name}` : selectedImportedCustomerRoute?.name,
    importedDesignRouteMiles: temporaryImportedCommercialDraft?.routeMiles ?? temporaryImportedRoute?.route.routeMiles ?? selectedImportedCustomerRoute?.routeMiles,
    customerDraftActive: accountCustomerDrafts.length > 0,
    acceptedProposal: accountAcceptedProposal,
  }), [
    accountAcceptedProposal,
    accountCustomerDrafts.length,
    accountRenderableCustomerTwin,
    accountCustomerReviewStatus,
    accountNetworkInventory,
    activeCommercialDraftNetworks.length,
    importedCustomerGeometryLoaded,
    loadedCommercialDraftSnapshot,
    networkLayerStates,
    selectedImportedCustomerRoute,
    selectedAccount,
    temporaryImportedCommercialDraft?.routeMiles,
    temporaryImportedRoute,
  ]);
  const excludedInventoryAccountNames = useMemo(
    () => COMMERCIAL_ACCOUNTS.filter((account) => account.accountId !== selectedAccount.accountId).map((account) => account.name),
    [selectedAccount.accountId],
  );

  useEffect(() => {
    if (!liveCommercialSession || !selectedScope.routeRequirementIds.includes(liveCommercialSession.routeRequirementId)) return;
    const timestamp = new Date().toISOString();
    setLiveCommercialSession((prev) => {
      if (!prev || !selectedScope.routeRequirementIds.includes(prev.routeRequirementId)) return prev;
      return {
        ...prev,
        activePricingScopeId: selectedScope.scopeId,
        constructionStrategy: selectedAssumptionState.civilMix,
        currentCommercialAssumptions: selectedAssumptionState.stateId,
        currentSelectedScopePricingSummary: selectedPricingSummary,
        lastRecalculatedAt: prev.recalculationStatus === "RECALCULATING" ? prev.lastRecalculatedAt : timestamp,
        lastAutosavedAt: timestamp,
        dirty: prev.dirty || prev.currentCommercialAssumptions !== selectedAssumptionState.stateId,
        recalculationStatus: prev.recalculationStatus === "RECALCULATING" ? "RECALCULATING" : "CURRENT",
        snapshotCount: proposalSnapshots.filter((snapshot) => snapshot.routeRequirementId === prev.routeRequirementId).length,
      };
    });
  }, [
    liveCommercialSession?.routeRequirementId,
    proposalSnapshots.length,
    selectedAssumptionState.civilMix,
    selectedAssumptionState.stateId,
    selectedPricingSummary,
    selectedScope.scopeId,
    selectedScopeRouteKey,
  ]);

  useEffect(() => {
    if (!selectedAccountId) {
      setCommercialOpportunities([]);
      setCommercialRouteRepositoryRecords([]);
      setCommercialLibraryLoaded(true);
      return;
    }
    let cancelled = false;
    setCommercialLibraryLoaded(false);
    Promise.all([
      OpportunityRepository.listOpportunities<CommercialOpportunityRecord>(session),
      RouteRepository.listRoutes(session).catch((error) => {
        runtimeDiagnosticsWarn("Route Repository load failed", {
          reason: error instanceof Error ? error.message : String(error),
        });
        return [] as CommercialRouteRepositoryRecord[];
      }),
    ])
      .then(([records, routes]) => {
        if (cancelled) return;
        setCommercialOpportunities(records.filter((record) => record.accountId === selectedAccountId).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))));
        setCommercialRouteRepositoryRecords(routes.filter((record) => record.accountId === selectedAccountId || record.customerId === selectedAccountId).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))));
        setCommercialLibraryLoaded(true);
      })
      .catch((error) => {
        if (cancelled) return;
        runtimeDiagnosticsWarn("Opportunity Library load failed", {
          reason: error instanceof Error ? error.message : String(error),
        });
        setOpportunityNotice(`Opportunity Library unavailable: ${error instanceof Error ? error.message : String(error)}`);
        setCommercialLibraryLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedAccountId, session?.token]);

  useEffect(() => {
    if (!selectedAccountId) {
      setProposalSnapshots([]);
      setAcceptedProposal(null);
      setProposalRuntimeRecords([]);
      setProposalRuntimeNotice("Select an account to load its Proposal Library.");
      return;
    }
    let cancelled = false;
    ProposalRepository.listProposals<any>(session)
      .then((records) => {
        if (cancelled) return;
        const accountRecords = records.filter((record) => record?.accountId === selectedAccountId || record?.customerId === selectedAccountId || record?.customerId === customerIdForAccount(selectedAccountId));
        const snapshots = accountRecords
          .filter((record) => record?.snapshotId)
          .sort((a, b) => String(b.timestamp ?? b.createdAt).localeCompare(String(a.timestamp ?? a.createdAt)))
          .map(({ proposalRecordId: _proposalRecordId, proposalRecordType: _proposalRecordType, organization: _organization, createdAt: _createdAt, updatedAt: _updatedAt, ...snapshot }) => snapshot as LiveProposalSnapshot);
        const accepted = accountRecords
          .filter((record) => record?.acceptedProposalId)
          .sort((a, b) => String(b.acceptedAt ?? b.createdAt).localeCompare(String(a.acceptedAt ?? a.createdAt)))
          .map(({ proposalRecordId: _proposalRecordId, proposalRecordType: _proposalRecordType, organization: _organization, createdAt: _createdAt, updatedAt: _updatedAt, ...proposal }) => proposal as AcceptedProposal);
        accountRecords.forEach((record) => {
          if (record?.proposalId || record?.proposalRecordId || record?.acceptedProposalId) {
            logProposalAuthorityStateHydration("Proposal Repository restore:list", record as ProposalRuntimeObject, proposalRuntimeStatusLabel(record?.status));
          }
        });
        setProposalSnapshots(snapshots);
        setAcceptedProposal(accepted[0] ?? null);
        setProposalRuntimeRecords(accountRecords.filter((record) => record?.proposalId || record?.objectType === "PROPOSAL" || record?.readiness) as ProposalRuntimeObject[]);
        setProposalRuntimeNotice(accountRecords.length ? "Account Proposal Library loaded." : "No governed proposals exist for this account.");
      })
      .catch((error) => {
        runtimeDiagnosticsWarn("Proposal Library load failed", {
          reason: error instanceof Error ? error.message : String(error),
        });
        setProposalRuntimeNotice(`Proposal Runtime Library unavailable: ${error instanceof Error ? error.message : String(error)}`);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedAccountId, session?.token]);

  useEffect(() => {
    setEngineeringReviewQueue([]);
    if (!canReadEngineeringCertification) setActiveDraftIofPackage(null);
    setEngineeringCertificationNotice("Commercial Review submits Draft IOF Packages to Engineering Intake.");
  }, [canReadEngineeringCertification, session?.token]);

  function upsertProposalRuntimeRecord(record: ProposalRuntimeObject) {
    setProposalRuntimeRecords((prev) => [
      record,
      ...prev.filter((item) => item.proposalId !== record.proposalId && item.proposalRecordId !== record.proposalRecordId),
    ]);
  }

  async function refreshProposalRuntimeLibrary(nextNotice?: string) {
    const records = await ProposalRepository.listProposals<any>(session);
    records.forEach((record) => {
      if (record?.proposalId || record?.proposalRecordId || record?.acceptedProposalId) {
        logProposalAuthorityStateHydration("Proposal Repository restore:refresh", record as ProposalRuntimeObject, proposalRuntimeStatusLabel(record?.status));
      }
    });
    setProposalRuntimeRecords(records.filter((record) => record?.proposalId || record?.objectType === "PROPOSAL" || record?.readiness) as ProposalRuntimeObject[]);
    if (nextNotice) setProposalRuntimeNotice(nextNotice);
  }

  async function refreshEngineeringReviewQueue(nextNotice?: string) {
    if (!canReadEngineeringCertification) return;
    const queue = await listEngineeringReviewQueue(session);
    setEngineeringReviewQueue(queue);
    if (nextNotice) setEngineeringCertificationNotice(nextNotice);
  }

  function runtimeLifecycleBridgeInput(trigger = "QUOTE_READY_FOR_CUSTOMER", overrides: Record<string, unknown> = {}) {
    const routePlan = activeLiveSession?.routePlan ?? selectedRoutePlans[0];
    const geometry = activeLiveSession?.activeEditableRouteGeometry ?? routePlan?.stationedCorridor?.centerlineRoute.geometry ?? routePlan?.proposedGraph?.centerlineRoute?.geometry ?? [];
    return {
      trigger,
      accountId: selectedAccount.accountId,
      customerId: customerIdForAccount(selectedAccount.accountId),
      customerName: selectedAccount.name,
      organizationId: currentOrganizationId,
      workspaceId: currentWorkspaceId,
      ownerId: activeCommercialOpportunity?.ownerId ?? currentUserId,
      opportunityId: activeCommercialOpportunityId || activeCommercialOpportunity?.opportunityId || routePlan?.routeRequirement.routeRequirementId || governedClientId(`OPP-${currentCommercialRecordIds.slug}`, demoGovernedIdContext),
      opportunity: activeCommercialOpportunity ?? {
        name: activeOpportunityDisplayName,
        selectedScopeId: selectedScope.scopeId,
        commercialDraftType,
      },
      commercialDraftId: activeCommercialOpportunity?.runtimeObjectId ? `COMMERCIAL-DRAFT-${activeCommercialOpportunity.opportunityId}` : undefined,
      commercialDraft: selectedImportedCommercialDraft ?? commercialCorridorDraft ?? loadedCommercialDraftSnapshot ?? {
        revision: accountSnapshots.length + 1,
        routeId: routePlan?.routeRequirement.routeRequirementId,
        draftType: commercialDraftType,
      },
      proposalId: activeProposalRuntime?.proposalId ?? currentCommercialRecordIds.proposalId,
      proposalNumber: activeProposalRuntime?.proposalNumber ?? currentCommercialRecordIds.proposalId,
      proposal: activeProposalRuntime ?? undefined,
      productId: selectedProductOption.productId,
      productName: selectedProductOption.productName,
      productConfiguration: {
        termYears: selectedProductOption.defaultTermYears,
        protected: selectedProductOption.protected,
        routeMiles: selectedPricingSummary.reconciliation.routeMiles,
        selectedScopeId: selectedScope.scopeId,
        designMode: activeDesignMode,
      },
      fulfillmentMix: CARRIER_NEUTRAL_FULFILLMENT_MIX,
      title: activeProposalRuntime?.title ?? `${activeOpportunityDisplayName} Commercial Proposal`,
      summary: activeProposalRuntime?.summary ?? `Commercial proposal for ${activeOpportunityDisplayName}.`,
      executiveSummary: activeProposalRuntime?.executiveSummary ?? preview.executiveSummary,
      pricingSummary: activeProposalRuntime?.pricingSummary ?? selectedPricingSummary.reconciliation,
      marginSummary: activeProposalRuntime?.marginSummary ?? {
        grossMarginDollars: selectedPricingSummary.reconciliation.grossMarginDollars,
        grossMarginPercent: selectedPricingSummary.reconciliation.grossMarginPercent,
      },
      confidenceSummary: activeProposalRuntime?.confidenceSummary ?? {
        commercialReadiness: selectedImportedCommercialDraft?.transparentEstimate.commercialReadiness.score ?? commercialCorridorDraft?.transparentEstimate.commercialReadiness.score ?? loadedCommercialDraftSnapshot?.transparentEstimate.commercialReadiness.score ?? opportunityScoutQuickQuote?.confidence ?? 0,
      },
      commercialAssumptionIds: activeProposalRuntime?.commercialAssumptionIds ?? [selectedAssumptionState.stateId],
      dealPointIds: activeProposalRuntime?.dealPointIds ?? selectedScope.routeRequirementIds,
      runtimeObjectIds: [
        activeCommercialOpportunity?.runtimeObjectId,
        selectedImportedCustomerDesignImport?.designImportId,
        ...activeCommercialDraftNetworks.map((network) => network.networkId),
        ...(activeProposalRuntime?.runtimeObjectIds ?? []),
      ].filter(Boolean),
      runtimeRelationshipIds: [
        activeCommercialOpportunity?.opportunityId ? `DERIVED_FROM:${activeCommercialOpportunity.opportunityId}` : "",
        routePlan?.routeRequirement.routeRequirementId ? `PROPOSES_ROUTE:${routePlan.routeRequirement.routeRequirementId}` : "",
        ...(activeProposalRuntime?.runtimeRelationshipIds ?? []),
      ].filter(Boolean),
      runtimeEvidenceIds: activeProposalRuntime?.runtimeEvidenceIds ?? [],
      existingInventoryReferences: activeProposalRuntime?.existingInventoryReferences ?? activeExistingReferenceNetworkIds,
      customerDesignReferences: activeProposalRuntime?.customerDesignReferences ?? (selectedImportedCustomerDesignImport ? [selectedImportedCustomerDesignImport.designId] : []),
      partnerInventoryReferences: googleFixtureIsActive ? ["PARTNER-LONGHAUL-GOOGLE-HELIUM"] : [],
      marketplaceAssetReferences: [],
      newInfrastructureRequired: activeCommercialDraftNetworks.map((network) => network.networkId),
      customerTwinReference: activeProposalRuntime?.customerTwinReference ?? accountCustomerTwin?.customerTwinId ?? `CUSTOMER-TWIN-${selectedAccount.accountId}`,
      geometryReferences: activeProposalRuntime?.geometryReferences ?? [routePlan?.routeRequirement.routeRequirementId, ...geometry.map((coordinate, index) => `lifecycle-geometry:${index}:${coordinate.join(",")}`)].filter(Boolean).slice(0, 20),
      proposalDocumentReferences: activeProposalRuntime?.proposalDocumentReferences ?? ["Runtime lifecycle proposal", "Commercial pricing summary"],
      assignedCustomerUsers: activeProposalRuntime?.assignedCustomerUsers?.length ? activeProposalRuntime.assignedCustomerUsers : ["google-participant-001"],
      proposalRecipientContactIds,
      customerReviewContactIds,
      approvalAuthorityContactIds,
      sofRecipientContactIds,
      customerContactEmails,
      assignedEngineerId: activeDraftIofPackage?.assignedEngineerId ?? "teralinx-user-kyle",
      assignedEngineer: activeDraftIofPackage?.assignedEngineer ?? "Kyle",
      priority: activeDraftIofPackage?.priority ?? "NORMAL",
      ...overrides,
    };
  }

  async function handleAdvanceRuntimeLifecycleBridge(trigger = "QUOTE_READY_FOR_CUSTOMER", overrides: Record<string, unknown> = {}) {
    let governedOverrides = overrides;
    if (trigger === "QUOTE_READY_FOR_CUSTOMER") {
      if (!activeCommercialOpportunity) {
        setRuntimeLifecycleNotice("PROPOSAL GENERATION BLOCKED: save a governed Opportunity before advancing the lifecycle.");
        return;
      }
      const authoritativeOpportunity = await upsertCommercialOpportunity(buildCommercialOpportunityRecord("SAVED", { overrideName: opportunityNameDraft }));
      if (!authoritativeOpportunity?.commercialStateHash || !authoritativeOpportunity.commercialStateSnapshot) {
        setRuntimeLifecycleNotice("PROPOSAL GENERATION BLOCKED: authoritative Opportunity persistence or verification failed.");
        return;
      }
      governedOverrides = {
        ...overrides,
        opportunityId: authoritativeOpportunity.opportunityId,
        opportunityStateVersion: authoritativeOpportunity.commercialStateVersion,
        opportunityStateHash: authoritativeOpportunity.commercialStateHash,
        opportunityStateSnapshot: authoritativeOpportunity.commercialStateSnapshot,
        routeRepositoryId: authoritativeOpportunity.routeRepositoryId,
        routeRevision: authoritativeOpportunity.routeRevision,
        routeGeometryId: authoritativeOpportunity.routeGeometryId,
        routeGeometryHash: authoritativeOpportunity.geometryHash,
      };
    }
    setRuntimeLifecyclePending(true);
    try {
      const result = await advanceRuntimeLifecycleBridge(runtimeLifecycleBridgeInput(trigger, governedOverrides), session);
      setRuntimeLifecycleState(result.lifecycle);
      if (result.opportunity) {
        const opportunity = result.opportunity as unknown as CommercialOpportunityRecord;
        setCommercialOpportunities((prev) => [opportunity, ...prev.filter((candidate) => candidate.opportunityId !== opportunity.opportunityId)]);
        setActiveCommercialOpportunityId(opportunity.opportunityId);
      }
      if (result.proposal) upsertProposalRuntimeRecord(result.proposal);
      if (result.draftPackage) setActiveDraftIofPackage(result.draftPackage);
      if (result.engineeringQueueItem || result.draftPackage) await refreshEngineeringReviewQueue("Engineering Review Queue refreshed from Runtime lifecycle bridge.");
      setRuntimeLifecycleNotice(`${result.lifecycle.status.replaceAll("_", " ")} via ${result.lifecycle.currentRuntimeObject || "Runtime lifecycle bridge"}.`);
    } catch (error) {
      setRuntimeLifecycleNotice(`Runtime lifecycle bridge failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setRuntimeLifecyclePending(false);
    }
  }

  async function saveCurrentRuntimeProposal(status: ProposalRuntimeObject["status"] = "DRAFT") {
    if (!canManageProposalRuntime) {
      setProposalRuntimeNotice("Only commercial proposal authority may create or update Commercial Proposals.");
      return null;
    }
    if (!activeCommercialOpportunity) {
      setProposalRuntimeNotice("PROPOSAL GENERATION BLOCKED: save a governed Opportunity before generating a Proposal Revision.");
      return null;
    }
    const authoritativeOpportunity = await upsertCommercialOpportunity(buildCommercialOpportunityRecord("SAVED", { overrideName: opportunityNameDraft }));
    if (!authoritativeOpportunity?.commercialStateHash || !authoritativeOpportunity.commercialStateSnapshot) {
      setProposalRuntimeNotice("PROPOSAL GENERATION BLOCKED: authoritative Opportunity persistence or verification failed.");
      return null;
    }
    const routePlan = activeLiveSession?.routePlan ?? selectedRoutePlans[0];
    if (!routePlan) {
      setProposalRuntimeNotice("No route requirement is selected for proposal runtime creation.");
      return null;
    }
    setProposalRuntimeActionPending(true);
    try {
      const timestamp = new Date().toISOString();
      const geometry = activeLiveSession?.activeEditableRouteGeometry ?? routePlan.stationedCorridor?.centerlineRoute.geometry ?? routePlan.proposedGraph?.centerlineRoute?.geometry ?? [];
      const proposalRouteAuthority = authoritativeOpportunity.routeRepositorySnapshot ?? generatedRouteRepositorySnapshot;
      const proposalId = activeProposalRuntime?.proposalId ?? authoritativeOpportunity.proposalId ?? currentCommercialRecordIds.proposalId;
      const proposalRecord = {
        ...(activeProposalRuntime ?? {}),
        saveProposalRevision: true,
        revisionReason: activeProposalRuntime?.revisionStatus === "WORKING"
          ? activeProposalRuntime.revisionReason ?? "Saved derived commercial proposal revision."
          : "Saved current commercial estimate and proposal revision.",
        proposalId,
        proposalRecordId: proposalId,
        proposalRecordType: "PROPOSAL_RUNTIME_OBJECT",
        proposalNumber: activeProposalRuntime?.proposalNumber ?? proposalId,
        customerId: customerIdForAccount(selectedAccount.accountId),
        accountId: selectedAccount.accountId,
        opportunityId: authoritativeOpportunity.opportunityId,
        organizationId: currentOrganizationId,
        workspaceId: currentWorkspaceId,
        productId: selectedProductOption.productId,
        productName: selectedProductOption.productName,
        productDoctrineId: selectedProductDoctrine?.doctrineId,
        productDoctrineVersion: selectedProductDoctrine?.doctrineVersion,
        productDoctrineHash: selectedProductDoctrine ? POINT_TO_POINT_LONG_HAUL_DOCTRINE_HASH : undefined,
        commercialOwnerId: activeProposalRuntime?.commercialOwnerId ?? currentUserId,
        ownerId: activeProposalRuntime?.ownerId ?? currentUserId,
        createdById: activeProposalRuntime?.createdById ?? currentUserId,
        assignedCustomerUsers: activeProposalRuntime?.assignedCustomerUsers?.length ? activeProposalRuntime.assignedCustomerUsers : ["google-participant-001"],
        proposalRecipientContactIds,
        customerReviewContactIds,
        approvalAuthorityContactIds,
        sofRecipientContactIds,
        customerContactEmails,
        visibility: activeProposalRuntime?.visibility ?? "PRIVATE",
        status,
        title: `${activeOpportunityDisplayName} Commercial Proposal`,
        summary: `Commercial proposal for ${activeOpportunityDisplayName}.`,
        executiveSummary: preview.executiveSummary,
        productConfiguration: displayedTransparentEstimateControls.projectConfiguration,
        estimateId: activeFinancialDraft?.transparentEstimate.estimateId,
        estimateControls: displayedTransparentEstimateControls,
        transparentEstimate: displayedTransparentEstimate,
        constructionQuantities: displayedTransparentEstimate?.physicalQuantities,
        estimatingDoctrineId: displayedTransparentEstimate?.estimatingDoctrineId,
        commercialPolicyId: displayedTransparentEstimate?.commercialPolicyId,
        commercialTerms: {
          termMonths: selectedProductOption.defaultTermYears * 12,
          nrc: displayedTransparentEstimate?.nrc ?? selectedPricingSummary.reconciliation.sellPriceIru,
          monthlyOm: displayedTransparentEstimate?.mrc ?? selectedPricingSummary.reconciliation.mrcRevenue,
          totalContractValue: displayedTransparentEstimate
            ? displayedTransparentEstimate.nrc + displayedTransparentEstimate.mrc * selectedProductOption.defaultTermYears * 12
            : selectedPricingSummary.reconciliation.lifecycleRevenue,
        },
        proposalContent: {
          title: `${activeOpportunityDisplayName} Commercial Proposal`,
          executiveSummary: preview.executiveSummary,
          customerFacingPricing: {
            nrc: displayedTransparentEstimate?.nrc ?? selectedPricingSummary.reconciliation.sellPriceIru,
            monthlyOm: displayedTransparentEstimate?.mrc ?? selectedPricingSummary.reconciliation.mrcRevenue,
            termMonths: selectedProductOption.defaultTermYears * 12,
          },
        },
        pricingSummary: selectedPricingSummary.reconciliation,
        marginSummary: {
          grossMarginDollars: selectedPricingSummary.reconciliation.grossMarginDollars,
          grossMarginPercent: selectedPricingSummary.reconciliation.grossMarginPercent,
        },
        confidenceSummary: {
          commercialReadiness: activeFinancialDraft?.transparentEstimate.commercialReadiness.score ?? 0,
          pricingStatus: selectedPricingSummary.reconciliation.combinedAwardAdjustmentStatus,
        },
        commercialAssumptionIds: [selectedAssumptionState.stateId],
        dealPointIds: selectedScope.routeRequirementIds,
        runtimeObjectIds: [
          authoritativeOpportunity.runtimeObjectId,
          selectedImportedCustomerDesignImport?.designImportId,
          ...activeCommercialDraftNetworks.map((network) => network.networkId),
        ].filter(Boolean),
        runtimeRelationshipIds: [
          authoritativeOpportunity.opportunityId ? `DERIVED_FROM:${authoritativeOpportunity.opportunityId}` : "",
          routePlan.routeRequirement.routeRequirementId ? `PROPOSES_ROUTE:${routePlan.routeRequirement.routeRequirementId}` : "",
        ].filter(Boolean),
        runtimeEvidenceIds: activeProposalRuntime?.runtimeEvidenceIds ?? [],
        existingInventoryReferences: activeExistingReferenceNetworkIds,
        customerDesignReferences: selectedImportedCustomerDesignImport ? [selectedImportedCustomerDesignImport.designId] : [],
        customerTwinReference: accountCustomerTwin?.customerTwinId ?? `CUSTOMER-TWIN-${selectedAccount.accountId}`,
        routeRepositoryId: proposalRouteAuthority?.routeRepositoryId ?? authoritativeOpportunity.routeRepositoryId,
        routeId: proposalRouteAuthority?.routeId,
        routeRevision: proposalRouteAuthority?.routeRevision ?? authoritativeOpportunity.routeRevision,
        routeGeometryId: proposalRouteAuthority?.routeGeometryId ?? authoritativeOpportunity.routeGeometryId,
        routeGeometryHash: proposalRouteAuthority?.geometryHash ?? authoritativeOpportunity.geometryHash,
        aSite: proposalRouteAuthority?.endpointAuthority?.aSite ?? authoritativeOpportunity.aSite,
        zSite: proposalRouteAuthority?.endpointAuthority?.zSite ?? authoritativeOpportunity.zSite,
        opportunityStateVersion: authoritativeOpportunity.commercialStateVersion,
        opportunityStateHash: authoritativeOpportunity.commercialStateHash,
        opportunityStateSnapshot: authoritativeOpportunity.commercialStateSnapshot,
        routeSnapshot: proposalRouteAuthority ? {
          routeRepositoryId: proposalRouteAuthority.routeRepositoryId,
          routeId: proposalRouteAuthority.routeId,
          routeRevision: proposalRouteAuthority.routeRevision,
          routeGeometryId: proposalRouteAuthority.routeGeometryId,
          geometryHash: proposalRouteAuthority.geometryHash,
          aSite: proposalRouteAuthority.endpointAuthority?.aSite ?? proposalRouteAuthority.aLocation,
          zSite: proposalRouteAuthority.endpointAuthority?.zSite ?? proposalRouteAuthority.zLocation,
        } : undefined,
        geometryReferences: [proposalRouteAuthority?.routeGeometryId, routePlan.routeRequirement.routeRequirementId, ...geometry.map((coordinate, index) => `${proposalId}:geometry:${index}:${coordinate.join(",")}`)].filter(Boolean).slice(0, 20),
        proposalDocumentReferences: ["Executive summary", "Commercial pricing summary", "Interactive proposal map"],
        attachments: activeProposalRuntime?.attachments ?? [],
        comments: activeProposalRuntime?.comments ?? [],
        reviewers: activeProposalRuntime?.reviewers ?? [],
        approvalState: activeProposalRuntime?.approvalState ?? "NOT_SUBMITTED",
        version: activeProposalRuntime?.version ?? 1,
        createdAt: activeProposalRuntime?.createdAt ?? timestamp,
      updatedAt: timestamp,
      noScopeVersionCreation: true,
      noInventoryMutation: true,
      currentAuthority: activeProposalRuntime?.currentAuthority ?? "COMMERCIAL_REVISION",
      commercialRevisionId: activeProposalRuntime?.commercialRevisionId,
      revisionId: activeProposalRuntime?.revisionId,
      commercialRevisionHash: activeProposalRuntime?.commercialRevisionHash,
      commercialRepositoryId: activeProposalRuntime?.commercialRepositoryId,
      proposalAuthorityFlow: activeProposalRuntime?.proposalAuthorityFlow ?? {
        inputAuthority: "COMMERCIAL_REVISION",
        projection: "PROPOSAL_PROJECTION",
        repository: "PROPOSAL_REPOSITORY",
        proposalOutputUnchanged: true,
        pricingOutputUnchanged: true,
        workbookOutputUnchanged: true,
        noScopeVersionCreation: true,
      },
    };
      const saved = await ProposalRepository.saveProposal<any>(proposalRecord, session) as ProposalRuntimeObject;
      upsertProposalRuntimeRecord(saved);
      const linkedOpportunity = await OpportunityRepository.saveOpportunity(opportunityRecordForRepository({
        ...authoritativeOpportunity,
        proposalId: saved.proposalId,
        proposalRevisionId: saved.proposalRevisionId,
        proposalHash: saved.proposalHash,
        commercialWorkingState: {
          ...(authoritativeOpportunity.commercialWorkingState ?? {}),
          proposalReferences: {
            proposalId: saved.proposalId,
            proposalRevisionId: saved.proposalRevisionId,
            proposalHash: saved.proposalHash,
          },
          lastGovernedRevisionState: "PROPOSAL_REVISION_SAVED",
        },
      }), session);
      setCommercialOpportunities((prev) => [linkedOpportunity, ...prev.filter((candidate) => candidate.opportunityId !== linkedOpportunity.opportunityId)]);
      setProposalRuntimeNotice(`${saved.proposalNumber} revision ${saved.revisionNumber ?? saved.version} saved immutably.`);
      return saved;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setProposalRuntimeNotice(`Proposal Runtime save failed: ${message}`);
      return null;
    } finally {
      setProposalRuntimeActionPending(false);
    }
  }

  async function handleSaveRuntimeProposal() {
    await saveCurrentRuntimeProposal(activeProposalRuntime?.status ?? "DRAFT");
  }

  function exactProposalSubmissionLineage(proposal: ProposalRuntimeObject) {
    return {
      accountId: String(proposal.accountId ?? selectedAccount.accountId),
      opportunityId: proposal.opportunityId,
      opportunityStateVersion: Number(proposal.opportunityStateVersion),
      opportunityStateHash: String(proposal.opportunityStateHash ?? ""),
      proposalId: proposal.proposalId,
      proposalRevisionId: String(proposal.proposalRevisionId ?? ""),
      proposalHash: String(proposal.proposalHash ?? ""),
      routeId: String(proposal.routeRepositoryId ?? ""),
      routeRepositoryId: String(proposal.routeRepositoryId ?? ""),
      routeRevision: Number(proposal.routeRevision),
      routeGeometryId: String(proposal.routeGeometryId ?? ""),
      geometryHash: String(proposal.routeGeometryHash ?? ""),
    };
  }

  async function handleInternalCommercialApproval() {
    if (!activeProposalRuntime) return;
    setProposalRuntimeActionPending(true);
    try {
      const saved = await approveProposalInternalCommercialReview(activeProposalRuntime.proposalId, {
        ...exactProposalSubmissionLineage(activeProposalRuntime),
        comment: "Internal Commercial Review approved for customer submission.",
      }, session);
      upsertProposalRuntimeRecord(saved);
      setProposalRuntimeNotice(`Internal Commercial Review approved exact ${saved.proposalRevisionId}.`);
    } catch (error) {
      setProposalRuntimeNotice(`Internal Commercial Review failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setProposalRuntimeActionPending(false);
    }
  }

  async function handleSubmitRuntimeProposalToCustomer() {
    const proposal = activeProposalRuntime ?? await saveCurrentRuntimeProposal("DRAFT");
    if (!proposal) return;
    setProposalRuntimeActionPending(true);
    try {
      const demoSubmission = session?.user.authorityClass === "DEMO" && session.user.organizationId === "org-demo";
      const customerOrganizationId = selectedGovernedAccount?.customerId === "customer-demo-b" ? "org-demo-customer-b" : "org-demo-customer-a";
      const assignedCustomerUsers = customerOrganizationId === "org-demo-customer-b"
        ? ["demo-customer-b-viewer", "demo-customer-b-reviewer", "demo-customer-b-signer"]
        : ["demo-customer-a-viewer", "demo-customer-a-reviewer", "demo-customer-a-signer"];
      const input = {
        ...exactProposalSubmissionLineage(proposal),
        assignedCustomerUsers: demoSubmission ? assignedCustomerUsers : ["google-participant-001"],
        customerOrganizationId: demoSubmission ? customerOrganizationId : undefined,
        proposalRecipientContactIds,
        customerReviewContactIds,
        approvalAuthorityContactIds,
        customerContactEmails,
      };
      const portalResult = demoSubmission
        ? await submitProposalToCustomerPortal(proposal.proposalId, input, session)
        : { proposal: await submitProposalToCustomer(proposal.proposalId, input, session), invitations: [] };
      const saved = portalResult.proposal;
      upsertProposalRuntimeRecord(saved);
      setAccountDealTwin(await loadAccountCustomerTwin(selectedAccount.accountId, session));
      setCustomerEnrollmentLinks(portalResult.invitations);
      const invitationSummary = portalResult.invitations.length
        ? ` Enrollment links issued once for ${portalResult.invitations.map((item) => item.principalId).join(", ")}.`
        : "";
      setProposalRuntimeNotice(`${saved.proposalNumber} submitted to Customer View.${invitationSummary}`);
      const customerViewUrl = new URL(window.location.href);
      customerViewUrl.searchParams.set("workspace", "customerView");
      customerViewUrl.searchParams.set("accountId", selectedAccount.accountId);
      customerViewUrl.searchParams.set("opportunityId", saved.opportunityId);
      window.history.replaceState({}, "", `${customerViewUrl.pathname}${customerViewUrl.search}${customerViewUrl.hash}`);
      setWorkspace("customerView");
    } catch (error) {
      setProposalRuntimeNotice(`Customer review submit failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setProposalRuntimeActionPending(false);
    }
  }

  async function handleCreateRuntimeProposalRevision() {
    if (!activeProposalRuntime) return;
    const reason = window.prompt("Revision reason", "Commercial revision after customer feedback.") ?? "";
    if (!reason.trim()) return;
    setProposalRuntimeActionPending(true);
    try {
      if (!activeCommercialOpportunity) throw new Error("Save a governed Opportunity before creating a Proposal Revision.");
      const authoritativeOpportunity = await upsertCommercialOpportunity(buildCommercialOpportunityRecord("SAVED", { overrideName: opportunityNameDraft }));
      if (!authoritativeOpportunity?.commercialStateHash || !authoritativeOpportunity.commercialStateSnapshot) {
        throw new Error("Authoritative Opportunity persistence or verification failed.");
      }
      const saved = await createProposalRevision(activeProposalRuntime.proposalId, {
        reason,
        basisProposalRevisionId: activeProposalRuntime.proposalRevisionId,
        proposal: {
          pricingSummary: selectedPricingSummary.reconciliation as unknown as Record<string, unknown>,
          marginSummary: {
            grossMarginDollars: selectedPricingSummary.reconciliation.grossMarginDollars,
            grossMarginPercent: selectedPricingSummary.reconciliation.grossMarginPercent,
          },
          opportunityStateVersion: authoritativeOpportunity.commercialStateVersion,
          opportunityStateHash: authoritativeOpportunity.commercialStateHash,
          opportunityStateSnapshot: authoritativeOpportunity.commercialStateSnapshot,
          routeRepositoryId: authoritativeOpportunity.routeRepositoryId,
          routeRevision: authoritativeOpportunity.routeRevision,
          routeGeometryId: authoritativeOpportunity.routeGeometryId,
          routeGeometryHash: authoritativeOpportunity.geometryHash,
        },
        changes: {
          changedRuntimeObjectIds: activeProposalRuntime.runtimeObjectIds,
          changedDealPointIds: selectedScope.routeRequirementIds,
          changedPricingFields: ["pricingSummary", "marginSummary"],
          changedGeometryReferences: activeProposalRuntime.geometryReferences,
        },
      }, session);
      upsertProposalRuntimeRecord(saved);
      setProposalRuntimeNotice(`${saved.proposalNumber} revision v${saved.version} created.`);
    } catch (error) {
      setProposalRuntimeNotice(`Revision failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setProposalRuntimeActionPending(false);
    }
  }

  async function handleDuplicateRuntimeProposal() {
    if (!activeProposalRuntime) return;
    setProposalRuntimeActionPending(true);
    try {
      const saved = await duplicateProposalRuntimeObject(activeProposalRuntime.proposalId, session);
      upsertProposalRuntimeRecord(saved);
      setProposalRuntimeNotice(`${saved.proposalNumber} duplicated as a private commercial draft.`);
    } catch (error) {
      setProposalRuntimeNotice(`Duplicate failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setProposalRuntimeActionPending(false);
    }
  }

  async function handleArchiveRuntimeProposal() {
    if (!activeProposalRuntime) return;
    setProposalRuntimeActionPending(true);
    try {
      const saved = await archiveProposalRuntimeObject(activeProposalRuntime.proposalId, session);
      upsertProposalRuntimeRecord(saved);
      setProposalRuntimeNotice(`${saved.proposalNumber} archived.`);
    } catch (error) {
      setProposalRuntimeNotice(`Archive failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setProposalRuntimeActionPending(false);
    }
  }

  async function handleCustomerRuntimeProposalComment() {
    if (!activeProposalRuntime) return;
    const comment = window.prompt("Customer comment", "Please revise the commercial assumptions for review.") ?? "";
    if (!comment.trim()) return;
    setProposalRuntimeActionPending(true);
    try {
      const saved = await commentProposalRuntimeObject(activeProposalRuntime.proposalId, { comment }, session);
      upsertProposalRuntimeRecord(saved);
      setProposalRuntimeNotice("Customer comment recorded in proposal history.");
    } catch (error) {
      setProposalRuntimeNotice(`Comment failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setProposalRuntimeActionPending(false);
    }
  }

  async function handleCustomerRuntimeProposalEvidence() {
    if (!activeProposalRuntime) return;
    const sourceName = window.prompt("Evidence source name", "Customer approval note") ?? "";
    if (!sourceName.trim()) return;
    setProposalRuntimeActionPending(true);
    try {
      const result = await uploadProposalEvidence(activeProposalRuntime.proposalId, {
        sourceName,
        sourceType: "CUSTOMER_UPLOAD",
        metadata: { uploadedFrom: "Customer Proposal Dashboard" },
      }, session);
      upsertProposalRuntimeRecord(result.proposal);
      setProposalRuntimeNotice(`${sourceName} registered in proposal evidence.`);
    } catch (error) {
      setProposalRuntimeNotice(`Evidence upload failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setProposalRuntimeActionPending(false);
    }
  }

  async function handleCustomerRuntimeProposalChanges() {
    if (!activeProposalRuntime) return;
    const comment = window.prompt("Requested change", "Please revise and resubmit.") ?? "";
    if (!comment.trim()) return;
    setProposalRuntimeActionPending(true);
    try {
      const saved = await requestProposalChanges(activeProposalRuntime.proposalId, { comment }, session);
      upsertProposalRuntimeRecord(saved);
      setProposalRuntimeNotice("Customer change request recorded.");
    } catch (error) {
      setProposalRuntimeNotice(`Request changes failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setProposalRuntimeActionPending(false);
    }
  }

  async function handleCustomerRuntimeProposalApproval() {
    if (!activeProposalRuntime) return;
    const comment = window.prompt("Approval comment", "Approved for Draft IOF package readiness.") ?? "";
    setProposalRuntimeActionPending(true);
    try {
      const saved = await approveProposalRuntimeObject(activeProposalRuntime.proposalId, { comment }, session);
      upsertProposalRuntimeRecord(saved);
      setProposalRuntimeNotice(`${saved.proposalNumber} approved by customer.`);
    } catch (error) {
      setProposalRuntimeNotice(`Approval failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setProposalRuntimeActionPending(false);
    }
  }

  async function handleExposeDraftIofSource() {
    if (!activeProposalRuntime) return;
    setProposalRuntimeActionPending(true);
    try {
      const result = await createDraftIofPackageFromProposal(activeProposalRuntime.proposalId, session);
      upsertProposalRuntimeRecord(result.proposal);
      setProposalRuntimeNotice(result.ready ? "Draft IOF source references exposed. No IOF package was assembled." : "Draft IOF source is not ready.");
    } catch (error) {
      setProposalRuntimeNotice(`Draft IOF readiness failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setProposalRuntimeActionPending(false);
    }
  }

  async function handleAssembleDraftIofForEngineering() {
    if (!activeProposalRuntime) {
      setEngineeringCertificationNotice("Customer-approved Commercial Proposal is required before Draft IOF Package assembly.");
      return;
    }
    if (!activeProposalRuntime.readiness?.canCreateDraftIofPackage && activeProposalRuntime.approvalState !== "APPROVED") {
      setEngineeringCertificationNotice("Engineering can only assemble from a customer-approved and runtime-valid Proposal.");
      return;
    }
    const draftSource = commercialDraftIofPackagePreview ?? commercialDraftIofPackage;
    if (!draftSource) {
      setEngineeringCertificationNotice("Commercial Draft IOF Package JSON is required before Engineering handoff.");
      return;
    }
    setEngineeringCertificationPending(true);
    try {
      const routeRepositoryId = String(draftSource.routeRepositoryId ?? (draftSource.routeRepositoryRef as any)?.routeRepositoryId ?? generatedRouteRepositorySnapshot?.routeRepositoryId ?? "");
      const authority = await ensureCommercialLifecycleAuthorityForDraft(draftSource, routeRepositoryId, "MANUAL_DRAFT_IOF_SAVE");
      const draft = authority.restoredDraftPackage
        ? authority.draftPackage
        : await saveCommercialDraftIofPackage(authority.draftPackage, session);
      setCommercialDraftIofPackage(draft);
      setActiveDraftIofPackage(draft);
      setCommercialLifecycleSequencingNotice(`Draft IOF Package ${draft.packageId} ${authority.restoredDraftPackage ? "restored" : "saved"} after Commercial Revision ${authority.revision.commercialRevisionId}.`);
      await refreshEngineeringReviewQueue(`${draft.packageId} saved as Commercial Draft IOF JSON. Submit to Engineering creates the Engineering Repository package.`);
      setProposalRuntimeNotice(`${draft.packageId} saved as the Draft IOF Package source. Engineering Certification will open only an Engineering Package after submission.`);
    } catch (error) {
      setEngineeringCertificationNotice(`Draft IOF assembly failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setEngineeringCertificationPending(false);
    }
  }

  async function handleSaveCommercialDraftIofPackage() {
    if (!activeProposalRuntime) {
      setProposalRuntimeNotice("Save a governed Commercial Proposal before preserving Draft IOF Package JSON.");
      return;
    }
    const draftSource = commercialDraftIofPackagePreview ?? commercialDraftIofPackage;
    if (!draftSource) {
      setProposalRuntimeNotice("Commercial package assembly needs proposal, design, pricing, and validation inputs.");
      return;
    }
    setEngineeringCertificationPending(true);
    try {
      const routeRepositoryId = String(draftSource.routeRepositoryId ?? (draftSource.routeRepositoryRef as any)?.routeRepositoryId ?? generatedRouteRepositorySnapshot?.routeRepositoryId ?? "");
      const authority = await ensureCommercialLifecycleAuthorityForDraft(draftSource, routeRepositoryId, "MANUAL_DRAFT_IOF_SAVE");
      const draft = authority.restoredDraftPackage
        ? authority.draftPackage
        : await saveCommercialDraftIofPackage(authority.draftPackage, session);
      setCommercialDraftIofPackage(draft);
      setActiveDraftIofPackage(draft);
      setCommercialLifecycleSequencingNotice(`Draft IOF Package ${draft.packageId} ${authority.restoredDraftPackage ? "restored" : "saved"} after Commercial Release Package ${authority.releasePackage.commercialReleasePackageId}.`);
      setProposalRuntimeNotice(`${draft.packageId} saved as deterministic Draft IOF Package JSON.`);
      setEngineeringCertificationNotice(`${draft.packageId} saved as a Commercial Draft IOF Package. Submit it to create Engineering Intake.`);
    } catch (error) {
      setProposalRuntimeNotice(`Commercial Draft IOF Package save failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setEngineeringCertificationPending(false);
    }
  }

  function handleValidateCommercialReviewPackage() {
    const draft = commercialDraftIofPackage ?? commercialDraftIofPackagePreview ?? activeDraftIofPackage;
    if (!draft) {
      setProposalRuntimeNotice("Commercial Review has no Draft IOF Package to validate.");
      return;
    }
    const validationStatus = String((draft.validationSummary as any)?.status ?? draft.validation?.status ?? "MISSING");
    const readiness = String((draft.packageReadiness as any)?.status ?? draft.engineeringReadiness ?? "UNKNOWN").replaceAll("_", " ");
    setProposalRuntimeNotice(`${draft.packageId} validation ${validationStatus}; readiness ${readiness}.`);
  }

  async function handleSubmitCommercialDraftIofToEngineering() {
    console.log("[HANDOFF] Submit button clicked");
    if (releaseCoordinatorPendingRef.current) {
      setProposalRuntimeNotice("Release to Engineering is already running for the selected Proposal Revision.");
      return;
    }
    const draftSource = commercialDraftIofPackagePreview ?? commercialDraftIofPackage ?? activeDraftIofPackage;
    if (!draftSource) {
      console.warn("[HANDOFF] Submit blocked", {
        reason: "MISSING_DRAFT_IOF_PACKAGE",
        activeProposalId: activeProposalRuntime?.proposalId ?? null,
        opportunityId: activeCommercialOpportunity?.opportunityId ?? null,
      });
      setProposalRuntimeNotice("Commercial Review needs a Draft IOF Package before Engineering submission.");
      return;
    }
    if (!commercialReleasePrerequisitesReady) {
      console.warn("[HANDOFF] Submit blocked", {
        reason: "RELEASE_PREREQUISITES_FAILED",
        missing: commercialReleasePrerequisiteChecks.filter((check) => !check.ok).map((check) => `${check.label}: ${check.detail}`),
        checks: commercialReleasePrerequisiteChecks.map((check) => ({
          key: check.key,
          ok: check.ok,
          detail: check.detail,
        })),
      });
      setProposalRuntimeNotice(`Release blocked: ${commercialReleasePrerequisiteChecks.filter((check) => !check.ok).map((check) => `${check.label}: ${check.detail}`).join("; ")}`);
      return;
    }
    if (draftSource.commercialRevisionLocked || ["SUBMITTED_TO_ENGINEERING", "UNDER_ENGINEERING_REVIEW", "CERTIFIED"].includes(String(draftSource.status ?? ""))) {
      console.warn("[HANDOFF] Submit blocked", {
        reason: "COMMERCIAL_ALREADY_LOCKED_OR_SUBMITTED",
        packageId: draftSource.packageId,
        status: draftSource.status ?? null,
        commercialRevisionLocked: Boolean(draftSource.commercialRevisionLocked),
      });
      setProposalRuntimeNotice(`${draftSource.packageId} is already locked for Engineering custody.`);
      return;
    }
    setEngineeringCertificationPending(true);
    releaseCoordinatorPendingRef.current = true;
    try {
      console.log("[HANDOFF] Saving Draft IOF Package before submit", {
        packageId: draftSource.packageId,
        status: draftSource.status ?? null,
      });
      const routeRepositoryId = String(draftSource.routeRepositoryId ?? (draftSource.routeRepositoryRef as any)?.routeRepositoryId ?? generatedRouteRepositorySnapshot?.routeRepositoryId ?? "");
      const authority = await ensureCommercialLifecycleAuthorityForDraft(draftSource, routeRepositoryId, "COMMERCIAL_TO_ENGINEERING_HANDOFF", selectedReleaseProposalRevision);
      const savedDraft = authority.restoredDraftPackage
        ? authority.draftPackage
        : await saveCommercialDraftIofPackage(authority.draftPackage, session);
      setCommercialDraftIofPackage(savedDraft);
      setActiveDraftIofPackage(savedDraft);
      setCommercialLifecycleSequencingNotice(`Engineering handoff is using Draft IOF Package ${savedDraft.packageId} with Commercial Revision ${authority.revision.commercialRevisionId}.`);
      console.log("[HANDOFF] Draft IOF saved; calling commercial handoff endpoint", {
        packageId: savedDraft.packageId,
        endpoint: `/api/commercial/iof-packages/${encodeURIComponent(savedDraft.packageId)}/submit-engineering`,
        method: "POST",
      });
      const result = await submitDraftIofPackageToEngineering(savedDraft.packageId, undefined, session);
      console.log("[HANDOFF] Commercial handoff API returned", {
        packageId: savedDraft.packageId,
        engineeringPackageId: result.engineeringPackage.engineeringPackageId,
        engineeringBaselineId: result.engineeringBaseline?.engineeringBaselineId ?? null,
      });
      const verifiedEngineeringPackage = await openEngineeringPackage(result.engineeringPackage.engineeringPackageId, session);
      console.log("[HANDOFF] Engineering Package verification returned", {
        engineeringPackageId: verifiedEngineeringPackage.engineeringPackageId,
      });
      if (verifiedEngineeringPackage.engineeringPackageId !== result.engineeringPackage.engineeringPackageId) {
        throw new Error("Engineering Repository verification failed after submit.");
      }
      const draft = {
        ...savedDraft,
        ...result.draftPackage,
        engineeringPackageId: verifiedEngineeringPackage.engineeringPackageId,
        engineeringPackage: verifiedEngineeringPackage,
      } as DraftIofPackageRuntime;
      setCommercialDraftIofPackage(draft);
      setActiveDraftIofPackage(draft);
      if (result.commercialOpportunity) {
        const opportunityPatch = result.commercialOpportunity as Partial<CommercialOpportunityRecord>;
        if (opportunityPatch.opportunityId) {
          setCommercialOpportunities((items) => items.map((item) => (
            item.opportunityId === opportunityPatch.opportunityId ? { ...item, ...opportunityPatch } : item
          )));
          setActiveCommercialOpportunityId(opportunityPatch.opportunityId);
        }
      }
      if (result.proposal) {
        upsertProposalRuntimeRecord(result.proposal);
      }
      await refreshEngineeringReviewQueue(`${result.engineeringPackage.engineeringPackageId} created in the Engineering Repository.`);
      setProposalRuntimeNotice(`${draft.packageId} submitted to Engineering as ${result.engineeringPackage.engineeringPackageId}. Commercial status is SUBMITTED_TO_ENGINEERING.`);
      setEngineeringCertificationNotice(`${result.engineeringPackage.engineeringPackageId} is awaiting Engineering Package restore. ScopeVersion remains blocked.`);
      setSelectedEngineeringDraftIofPackage(null);
      setSelectedEngineeringDraftIofPackageId(verifiedEngineeringPackage.engineeringPackageId);
      setSelectedRouteEngineeringActivation(null);
      setWorkspace("routeEngineering");
    } catch (error) {
      console.error("[HANDOFF] Engineering submission failed", {
        reason: error instanceof Error ? error.message : String(error),
      });
      setProposalRuntimeNotice(`Engineering submission failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      releaseCoordinatorPendingRef.current = false;
      setEngineeringCertificationPending(false);
    }
  }

  async function handleOpenEngineeringDraftPackage(packageId: string) {
    setEngineeringCertificationPending(true);
    try {
      const draft = await openDraftIofPackageForCertification(packageId, session);
      setActiveDraftIofPackage(draft);
      setEngineeringCertificationNotice(`${draft.engineeringPackageId ?? draft.packageId} restored through the Engineering Repository. Commercial Planning did not open Engineering Certification.`);
    } catch (error) {
      setEngineeringCertificationNotice(`Open Draft IOF Package failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setEngineeringCertificationPending(false);
    }
  }

  function handleOpenSubmittedEngineeringCertification() {
    if (!submittedEngineeringPackageId) {
      setProposalRuntimeNotice("No submitted Engineering Package is available to open.");
      return;
    }
    setSelectedEngineeringDraftIofPackage(null);
    setSelectedEngineeringDraftIofPackageId(submittedEngineeringPackageId);
    setSelectedRouteEngineeringActivation(null);
    setEngineeringCertificationNotice(`${submittedEngineeringPackageId} selected. Engineering Certification will restore it from the Engineering Repository.`);
    setWorkspace("routeEngineering");
  }

  async function handleAssignActiveDraftIofPackageToMe() {
    if (!activeDraftIofPackage) return;
    setEngineeringCertificationPending(true);
    try {
      const draft = await assignDraftIofPackageEngineer(activeDraftIofPackage.packageId, {
        assignedEngineerId: currentUserId,
        assignedEngineer: currentUserName,
      }, session);
      setActiveDraftIofPackage(draft);
      await refreshEngineeringReviewQueue(`${draft.packageId} assigned to ${currentUserName}.`);
    } catch (error) {
      setEngineeringCertificationNotice(`Assign engineer failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setEngineeringCertificationPending(false);
    }
  }

  async function handleReturnActiveDraftIofToCommercial() {
    if (!activeDraftIofPackage) return;
    const reason = window.prompt("Return reason", "Engineering needs Commercial to revise package references.") ?? "";
    if (!reason.trim()) return;
    setEngineeringCertificationPending(true);
    try {
      const draft = await returnDraftIofPackageToCommercial(activeDraftIofPackage.packageId, { reason }, session);
      setActiveDraftIofPackage(draft);
      await refreshEngineeringReviewQueue(`${draft.packageId} returned to Commercial.`);
    } catch (error) {
      setEngineeringCertificationNotice(`Return to Commercial failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setEngineeringCertificationPending(false);
    }
  }

  async function handleCertifyFirstIofUnit() {
    const unit = activeDraftIofPackage?.proposedIofUnits?.find((item) => item.status !== "CERTIFIED");
    if (!activeDraftIofPackage || !unit) return;
    setEngineeringCertificationPending(true);
    try {
      const result = await certifyIofUnit(activeDraftIofPackage.packageId, unit.unitId, {
        engineeringNote: "Certified from Engineering Review Queue.",
        engineeringConfidence: 92,
        engineeringRisk: "ACCEPTED",
        engineeringComments: ["Engineering unit certification complete."],
      }, session);
      setActiveDraftIofPackage(result.iofPackage);
      await refreshEngineeringReviewQueue(`${unit.unitId} certified.`);
    } catch (error) {
      setEngineeringCertificationNotice(`Unit certification failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setEngineeringCertificationPending(false);
    }
  }

  async function handleCertifyAllIofUnits() {
    if (!activeDraftIofPackage) return;
    setEngineeringCertificationPending(true);
    try {
      let draft = activeDraftIofPackage;
      for (const unit of activeDraftIofPackage.proposedIofUnits.filter((item) => item.status !== "CERTIFIED")) {
        const result = await certifyIofUnit(draft.packageId, unit.unitId, {
          engineeringNote: "Certified during package review.",
          engineeringConfidence: 94,
          engineeringRisk: "ACCEPTED",
          engineeringComments: ["Batch-certified by Engineering."],
        }, session);
        draft = result.iofPackage;
      }
      setActiveDraftIofPackage(draft);
      await refreshEngineeringReviewQueue(`${draft.packageId} units certified.`);
    } catch (error) {
      setEngineeringCertificationNotice(`Batch unit certification failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setEngineeringCertificationPending(false);
    }
  }

  async function handleCertifyEngineeringPackage() {
    if (!activeDraftIofPackage) return;
    setEngineeringCertificationPending(true);
    try {
      const result = await certifyDraftIofPackage(activeDraftIofPackage.packageId, {
        checklist: {
          geometryComplete: true,
          existingInventoryValidated: true,
          customerDesignReviewed: true,
          relationshipsValidated: true,
          dependenciesValidated: true,
          evidencePresent: true,
          commercialAssumptionsReviewed: true,
          unitQuantitiesVerified: true,
          engineeringStandardsMet: true,
          riskAccepted: true,
          packageComplete: true,
          certificationConfidence: 94,
          engineeringNotes: "Engineering certification completed. Certified Draft IOF Package is ready for customer commitment.",
        },
      }, session);
      setActiveDraftIofPackage(result.draftPackage);
      await refreshEngineeringReviewQueue(`${result.certifiedIofPackage.certifiedDraftIofPackageId ?? result.certifiedIofPackage.certifiedPackageId} certified. ScopeVersion not created by certification.`);
    } catch (error) {
      setEngineeringCertificationNotice(`Package certification failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setEngineeringCertificationPending(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    if (!selectedAccount.accountId) {
      setCustomerNetworkGraph(null);
      setCustomerInventoryLoadStatus("PENDING");
      setCustomerInventoryDiagnostics([]);
      return () => { cancelled = true; };
    }
    const cached = findCachedInventoryProjectionForCustomer(selectedAccount.accountId);
    if (cached) {
      setCustomerNetworkGraph(cached.loadResult.graph);
      setCustomerInventoryLoadStatus(cached.loadResult.status);
      setCustomerInventoryDiagnostics([
        `Inventory projection restored from cache ${cached.cacheKey}. Background refresh started.`,
        ...cached.loadResult.diagnostics,
      ]);
      setRuntimePerformance((prev) => runtimePerformanceSnapshot({
        ...prev,
        cacheStatus: "HIT",
        workerStatus: "CACHE_RESTORED_BACKGROUND_REFRESH",
        visibleRoutes: cached.projectionSummary.routeCount,
        renderedObjects: cached.projectionSummary.objectCount,
        visibleStations: cached.projectionSummary.stationCount,
      }));
    } else {
      setCustomerInventoryLoadStatus("PENDING");
      setCustomerInventoryDiagnostics(["Inventory cache miss. Customer Twin will load in the background."]);
      setRuntimePerformance((prev) => runtimePerformanceSnapshot({ ...prev, cacheStatus: "MISS", workerStatus: "BACKGROUND_REFRESH" }));
    }
    const metric = startRuntimePerformanceOperation("inventory-import", "INVENTORY", {
      customerId: selectedAccount.accountId,
      cacheStatus: cached ? "HIT" : "MISS",
    });
    runtimeDiagnosticsLog("RuntimePerformance", {
      operation: "inventory-import",
      customerId: selectedAccount.accountId,
      cacheStatus: cached ? "HIT" : "MISS",
      workerStatus: "BACKGROUND_REFRESH",
    });
    window.setTimeout(() => {
      if (cancelled) return;
      setCustomerInventoryLoadStatus((prev) => prev === "PARSED" && cached ? prev : "PARSING");
      void CustomerTwinRepository.loadCustomerTwin(selectedAccount.accountId).then((result) => {
      if (cancelled) return;
      setCustomerNetworkGraph(result.graph);
      setCustomerInventoryLoadStatus(result.status);
      setCustomerInventoryDiagnostics(result.diagnostics);
      const cachedRecord = cacheInventoryProjection({
        key: {
          customerTwinId: `CUSTOMER-TWIN-${selectedAccount.accountId}`,
          customerId: selectedAccount.accountId,
          inventorySourceId: result.graph.inventorySessionVersion,
          importHash: result.graph.graphId,
          routeCount: result.graph.summary.routeCount,
          lastModified: result.graph.synchronizedAt,
        },
        loadResult: result,
      });
      metric.end({
        cacheStatus: cached ? "HIT" : "MISS",
        recordsProcessed: result.graph.summary.routeCount + result.graph.summary.objectCount + result.graph.summary.stationCount,
        recordsRendered: result.graph.summary.routeCount,
      });
      setRuntimePerformance((prev) => runtimePerformanceSnapshot({
        ...prev,
        cacheStatus: cached ? "HIT" : "MISS",
        inventoryImportMs: latestRuntimePerformanceMetrics().at(-1)?.durationMs ?? prev.inventoryImportMs,
        visibleRoutes: cachedRecord.projectionSummary.routeCount,
        renderedObjects: cachedRecord.projectionSummary.objectCount,
        visibleStations: cachedRecord.projectionSummary.stationCount,
        workerStatus: "READY",
      }));
    }).catch((error) => {
      if (cancelled) return;
      if (!cached) setCustomerNetworkGraph(null);
      setCustomerInventoryLoadStatus("ERROR");
      setCustomerInventoryDiagnostics([`Customer inventory load failed: ${error instanceof Error ? error.message : String(error)}`]);
      metric.end({ cacheStatus: cached ? "HIT" : "MISS", workerStatus: "ERROR" });
      runtimeDiagnosticsWarn("Performance", {
        operation: "inventory-import",
        reason: error instanceof Error ? error.message : String(error),
      });
    });
    }, 0);
    return () => {
      cancelled = true;
    };
  }, [selectedAccount.accountId, inventoryRefreshNonce]);

  useEffect(() => {
    setExistingFiberQueryLastRunAt(null);
    setOpportunityAnalysisLaunchedAt(null);
    setOpportunityScoutCandidate(null);
    setOpportunityScoutMode("CLICK_SITE");
    setCommercialDraftType(null);
    setSelectedAttachmentCandidateId(null);
    setCommercialRouteResult(null);
    setCommercialRoutingStatus("IDLE");
  }, [selectedAccount.accountId]);

  useEffect(() => {
    setSelectedAttachmentCandidateId(null);
    setCommercialRouteResult(null);
    setCommercialRoutingStatus("IDLE");
  }, [activeDesignMode, commercialDraftType, opportunityScoutCandidate?.candidateId, selectedAccount.accountId]);

  async function handleExistingInventoryFile(file: File | null) {
    if (!file) return;
    const lowerName = file.name.toLowerCase();
    if (lowerName.endsWith(".zip") || lowerName.endsWith(".shp")) {
      setExistingInventoryImportStatus("ERROR");
      setExistingInventoryImportNotice("Shapefile import is staged as a future-ready interface. Convert Shapefile to GeoJSON or Customer Twin JSON for this sprint.");
      return;
    }

    const importMetric = startRuntimePerformanceOperation("inventory-import", "IMPORT", {
      fileName: file.name,
      customerId: selectedAccount.accountId,
    });
    try {
      setExistingInventoryImportStatus("PARSING");
      setImportWorkerStatus("Parsing");
      setExistingInventoryImportNotice(`Repository is importing ${file.name} for ${selectedAccount.name} Existing Inventory...`);
      setExistingInventoryImportStatus("COMMITTING");
      const { commit: response } = await CustomerTwinRepository.importExistingNetwork({
        file,
        accountId: selectedAccount.accountId,
        customerName: selectedAccount.name,
        uploadedBy: currentUserName,
        currentUserName,
        currentUserId,
        currentOrganizationId,
        currentWorkspaceId,
        session,
        onProgress: (state) => {
          setImportWorkerStatus(state);
          setExistingInventoryImportNotice(`${state}: ${file.name}`);
          setRuntimePerformance((prev) => runtimePerformanceSnapshot({
            ...prev,
            workerStatus: state,
          }));
        },
      });
      const completed = importMetric.end({
        cacheStatus: "BYPASS",
        recordsProcessed: response.counts.runtimeObjects + response.counts.relationships + response.counts.evidence,
        recordsRendered: response.counts.runtimeObjects,
        workerStatus: "READY",
      });
      setExistingInventoryImportStatus("READY");
      setImportWorkerStatus("Ready");
      setExistingInventoryImportNotice(
        `Committed ${response.counts.runtimeObjects.toLocaleString()} inventory record(s), ${response.counts.relationships.toLocaleString()} relationship(s), and ${response.counts.evidence.toLocaleString()} evidence record(s).`,
      );
      setRuntimePerformance((prev) => runtimePerformanceSnapshot({
        ...prev,
        inventoryImportMs: completed.durationMs,
        cacheStatus: "BYPASS",
        workerStatus: "READY",
      }));
      setCustomerInventoryLoadStatus("PARSING");
      setInventoryRefreshNonce((nonce) => nonce + 1);
      void recordActivity({
        action: "imported existing inventory",
        objectType: "Customer Inventory",
        objectId: response.commit.inventoryIds[0] ?? response.commit.commitId,
        objectName: file.name,
        revision: "Customer Twin Library",
        customerId: selectedAccount.accountId,
        details: `${response.counts.runtimeObjects} inventory records committed for ${selectedAccount.name}.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      importMetric.end({ cacheStatus: "BYPASS", workerStatus: "ERROR" });
      setImportWorkerStatus("IDLE");
      setExistingInventoryImportStatus("ERROR");
      setExistingInventoryImportNotice(`Existing Inventory import failed: ${message}`);
      runtimeDiagnosticsWarn("RuntimePerformance", {
        operation: "existing-network-import",
        fileName: file.name,
        reason: message,
      });
    }
  }

  function activeRouteEditBase() {
    if (!activeFinancialDraft?.transparentEstimate) return null;
    return {
      routeId: activeFinancialDraft.routeId ?? activeFinancialDraft.transparentEstimate.estimateId,
      routeRepositoryId: generatedRouteRepositorySnapshot?.routeRepositoryId ?? activeCommercialOpportunity?.routeRepositoryId ?? activeCommercialOpportunity?.routeRepositoryRef?.routeRepositoryId ?? null,
      opportunityId: activeCommercialOpportunity?.opportunityId ?? (activeCommercialOpportunityId || null),
      estimate: activeFinancialDraft.transparentEstimate,
      controls: transparentEstimateControls,
      geometryVertexCount: activeFinancialDraft.geometry?.length ?? generatedRouteRepositorySnapshot?.commercialGeometry.length ?? 0,
    };
  }

  function commercialRevisionReferenceForPatch() {
    const proposalId = String(activeProposalRuntime?.proposalId ?? currentCommercialRecordIds.proposalId ?? "");
    const opportunityId = String(activeCommercialOpportunity?.opportunityId ?? activeCommercialOpportunityId ?? activeProposalRuntime?.opportunityId ?? proposalId);
    const routeRepositoryId = String(generatedRouteRepositorySnapshot?.routeRepositoryId ?? activeCommercialOpportunity?.routeRepositoryId ?? activeCommercialOpportunity?.routeRepositoryRef?.routeRepositoryId ?? activeProposalRuntime?.routeRepositoryId ?? "");
    const revisionId = String(
      activeProposalRuntime?.revisionId ??
        activeProposalRuntime?.commercialRevisionId ??
        activeCommercialOpportunity?.commercialRevisionId ??
        `COMM-REV-${opportunityId || proposalId || "COMMERCIAL"}-V${String(activeProposalRuntime?.version ?? 1)}`,
    );
    return {
      commercialRevisionId: revisionId,
      revisionId,
      opportunityId,
      repositoryId: String(activeProposalRuntime?.commercialRepositoryId ?? activeCommercialOpportunity?.commercialRepositoryId ?? `COMMERCIAL-REPOSITORY-${opportunityId || proposalId || "COMMERCIAL"}`),
      routeRepositoryId,
      estimateId: String(activeFinancialDraft?.transparentEstimate.estimateId ?? activeProposalRuntime?.estimateId ?? activeCommercialOpportunity?.estimateId ?? ""),
      workbookId: String(activeCommercialOpportunity?.workbookId ?? activeCommercialOpportunity?.commercialWorkbookId ?? activeProposalRuntime?.commercialWorkbookId ?? activeProposalRuntime?.workbookId ?? ""),
      commercialWorkbookId: String(activeCommercialOpportunity?.commercialWorkbookId ?? activeCommercialOpportunity?.workbookId ?? activeProposalRuntime?.commercialWorkbookId ?? activeProposalRuntime?.workbookId ?? ""),
      proposalId,
      revisionHash: String(activeProposalRuntime?.commercialRevisionHash ?? activeCommercialOpportunity?.commercialRevisionHash ?? ""),
    };
  }

  function buildLocalCommercialRevisionProjection(patches: CommercialPatch[], history: CommercialChangeSet[] = commercialChangeSetHistory) {
    const revisionReference = commercialRevisionReferenceForPatch();
    const activeChangeSet = patches.length
      ? commercialChangeSetFromPatches({
          revisionId: revisionReference.revisionId,
          opportunityId: revisionReference.opportunityId,
          repositoryId: revisionReference.repositoryId,
          proposalId: revisionReference.proposalId,
          routeRepositoryId: revisionReference.routeRepositoryId,
          estimateId: revisionReference.estimateId,
          workbookId: revisionReference.workbookId,
          patches,
          createdBy: currentUserName,
          createdById: currentUserId,
          revisionNumber: history.length + 1,
        })
      : null;
    return buildCommercialRevisionProjection(
      revisionReference,
      revisionReference,
      activeChangeSet ? [activeChangeSet, ...history] : history,
    );
  }

  function stageCommercialChangeSetPatch(routePatch: RouteEditPatch) {
    const revisionReference = commercialRevisionReferenceForPatch();
    const commercialPatch = commercialPatchFromRouteEditPatch({
      revisionId: revisionReference.revisionId,
      patch: routePatch,
    });
    const nextPatches = [...commercialChangeSetPatches, commercialPatch];
    const projection = buildLocalCommercialRevisionProjection(nextPatches);
    setCommercialChangeSetPatches(nextPatches);
    setCommercialRevisionProjection(projection);
    setCommercialChangeSetNotice(`${commercialPatch.patchType} staged as Commercial Change Set patch. Repository Truth remains immutable.`);
    runtimeDiagnosticsLog("CommercialChangeSetPatch", {
      patchId: commercialPatch.patchId,
      patchType: commercialPatch.patchType,
      revisionId: commercialPatch.revisionId,
      repositoryHash: projection.diagnostics.repositoryHash,
      revisionHash: projection.diagnostics.revisionHash,
      activePatchCount: projection.diagnostics.activePatchCount,
      patchReplayTimeMs: projection.diagnostics.patchReplayTimeMs,
      projectionTimeMs: projection.diagnostics.projectionTimeMs,
      repositoryTruthImmutable: true,
    });
  }

  async function saveCommercialChangeSetForRouteRevision() {
    if (!commercialChangeSetPatches.length) return null;
    const revisionReference = commercialRevisionReferenceForPatch();
    const changeSet = commercialChangeSetFromPatches({
      revisionId: revisionReference.revisionId,
      opportunityId: revisionReference.opportunityId,
      repositoryId: revisionReference.repositoryId,
      proposalId: revisionReference.proposalId,
      routeRepositoryId: revisionReference.routeRepositoryId,
      estimateId: revisionReference.estimateId,
      workbookId: revisionReference.workbookId,
      repositoryHash: commercialRevisionProjection?.diagnostics.repositoryHash,
      revisionNumber: commercialChangeSetHistory.length + 1,
      patches: commercialChangeSetPatches,
      createdBy: currentUserName,
      createdById: currentUserId,
    });
    const saved = await CommercialChangeSetRepository.saveChangeSet(changeSet as never, session) as unknown as CommercialChangeSet;
    const nextHistory = [saved, ...commercialChangeSetHistory];
    setCommercialChangeSetHistory(nextHistory);
    setCommercialChangeSetPatches([]);
    const replayed = await CommercialChangeSetRepository.replayRevision(revisionReference.revisionId, session)
      .catch(() => buildLocalCommercialRevisionProjection([], nextHistory)) as CommercialRevisionProjection;
    setCommercialRevisionProjection(replayed);
    setCommercialChangeSetNotice(`Save Revision committed ${saved.patchCount.toLocaleString()} Commercial Change Set patch(es). Repository Truth remains unchanged.`);
    return saved;
  }

  function routeEditSessionOrCreate() {
    const base = activeRouteEditBase();
    if (!base) return null;
    if (routeEditSession && routeEditSession.routeId === base.routeId) return routeEditSession;
    return createRouteEditSession({
      ...base,
      createdBy: currentUserName,
    });
  }

  function applyRouteEditPatch(patch: RouteEditPatch) {
    const sessionToEdit = routeEditSessionOrCreate();
    if (!sessionToEdit) return false;
    const nextSession = safeApplyRouteEditPatch(sessionToEdit, patch);
    setRouteEditSession(nextSession);
    setRouteEditRevisionPreview(null);
    const failed = nextSession.failedPatches[0]?.patchId === patch.patchId;
    setRouteEditNotice(failed
      ? nextSession.failedPatches[0].operatorSafeMessage
      : `${patch.label} staged as ${patch.patchType}. Repository truth is unchanged until Save Revision.`);
    if (!failed) stageCommercialChangeSetPatch(patch);
    runtimeDiagnosticsLog("RouteEditSession", {
      patchType: patch.patchType,
      patchId: patch.patchId,
      routeId: patch.routeId,
      status: nextSession.status,
      recalculationBoundary: nextSession.projection.impact.recalculationBoundary,
      fullRouteRebuild: nextSession.projection.impact.fullRouteRebuild,
      repositoryTruthUnchanged: nextSession.repositoryTruthUnchanged,
    });
    return true;
  }

  function routeEditPatch(type: RouteEditPatchType, label: string, value?: RouteEditPatch["value"], extra: Partial<RouteEditPatch> = {}) {
    const base = activeRouteEditBase();
    if (!base) return null;
    return createRouteEditPatch({
      patchType: type,
      routeId: base.routeId,
      createdBy: currentUserName,
      label,
      value,
      ...extra,
    });
  }

  function inferIlaRouteEditPatch(next: IlaPlanningControls) {
    const base = routeEditSession?.projection.projectedControls.ilaPlanning ?? transparentEstimateControls.ilaPlanning;
    if (next.intermediateIlaEnabled !== base.intermediateIlaEnabled) return null;
    if (next.ilaMode !== base.ilaMode) return null;
    if (next.useBookendIlas !== base.useBookendIlas) {
      return routeEditPatch(next.useBookendIlas ? "RESTORE_BOOKEND" : "REMOVE_BOOKEND", next.useBookendIlas ? "Restore bookend ILAs" : "Remove bookend ILAs", next.useBookendIlas);
    }
    const selectedStationId = next.selectedStationId ?? base.selectedStationId ?? "";
    const nextOverride = selectedStationId ? next.stationOverrides?.[selectedStationId] : undefined;
    const previousOverride = selectedStationId ? base.stationOverrides?.[selectedStationId] : undefined;
    if (selectedStationId && typeof nextOverride?.milepost === "number" && nextOverride.milepost !== previousOverride?.milepost) {
      return routeEditPatch(
        selectedStationId.includes("BOOKEND") ? "MOVE_BOOKEND" : "MOVE_ILA",
        "Move ILA station",
        nextOverride.milepost,
        { targetId: selectedStationId, facilityProfileId: nextOverride.facilityProfileId },
      );
    }
    if (next.desiredIntermediateIlas < base.desiredIntermediateIlas) {
      const targetStation = (routeEditSession?.projection.projectedEstimate ?? activeFinancialDraft?.transparentEstimate)?.ilaPlan.stationObjects
        .filter((station) => station.stationType === "INTERMEDIATE")
        .at(-1);
      return routeEditPatch("REMOVE_ILA", "Remove intermediate ILA", targetStation?.totalCost ?? 0, { targetId: targetStation?.stationId ?? selectedStationId });
    }
    if (next.desiredIntermediateIlas > base.desiredIntermediateIlas) {
      return routeEditPatch("RESTORE_ILA", "Restore intermediate ILA", 0, { targetId: selectedStationId || `ILA-INT-${String(next.desiredIntermediateIlas).padStart(3, "0")}` });
    }
    if (selectedStationId && next.defaultFacilityProfileId !== base.defaultFacilityProfileId) {
      return routeEditPatch("CHANGE_SEGMENT_UNIT_COST", "Change ILA facility profile", 0, { targetId: selectedStationId, facilityProfileId: next.defaultFacilityProfileId });
    }
    return null;
  }

  async function handleSaveRouteEditRevision() {
    if (!routeEditSession) {
      setRouteEditNotice("No active Route Edit Session is available to save.");
      return;
    }
    const revision = commitRouteEditSession(routeEditSession, currentUserName);
    setRouteEditRevisionPreview(revision);
    let savedCommercialChangeSet: CommercialChangeSet | null = null;
    try {
      savedCommercialChangeSet = await saveCommercialChangeSetForRouteRevision();
    } catch (error) {
      setCommercialChangeSetNotice(`Unable to save Commercial Change Set: ${error instanceof Error ? error.message : String(error)}. Route Edit Session preserved.`);
      setRouteEditNotice(`Unable to save Commercial Change Set: ${error instanceof Error ? error.message : String(error)}. Edit session preserved.`);
      return;
    }
    if (!activeCommercialOpportunity) {
      setRouteEditSession({ ...routeEditSession, status: "SAVED", updatedAt: revision.committedAt });
      setRouteEditNotice(`${revision.routeEditRevisionId} saved as a patch-set preview. ${savedCommercialChangeSet?.changeSetId ?? "Commercial Change Set"} recorded; no Opportunity Repository record was active.`);
      return;
    }
    try {
      const nextRecord: CommercialOpportunityRecord = {
        ...activeCommercialOpportunity,
        revisionHistory: RevisionRepository.appendRevision(
          { revisionHistory: (activeCommercialOpportunity.revisionHistory ?? []) as Array<Record<string, unknown>> },
          {
            revision: revision.routeEditRevisionId,
            revisionType: "ROUTE_EDIT_PATCH_SET",
            routeEditRevision: revision,
            commercialChangeSetId: savedCommercialChangeSet?.changeSetId,
            commercialChangeSetPatchCount: savedCommercialChangeSet?.patchCount ?? commercialChangeSetPatches.length,
            patchSetOnly: true,
            repositoryTruthUnchangedUntilExplicitSave: true,
            noScopeVersionCreation: true,
            noInventoryMutation: true,
          },
        ).revisionHistory,
        updatedAt: revision.committedAt,
      };
      const saved = await OpportunityRepository.saveOpportunity(opportunityRecordForRepository(nextRecord), session);
      setCommercialOpportunities((prev) => [saved, ...prev.filter((candidate) => candidate.opportunityId !== saved.opportunityId)]);
      setActiveCommercialOpportunityId(saved.opportunityId);
      setRouteEditSession({ ...routeEditSession, status: "SAVED", updatedAt: revision.committedAt });
      setRouteEditNotice(`${revision.routeEditRevisionId} saved as patch set only. ${savedCommercialChangeSet?.changeSetId ?? "Commercial Change Set"} is the editable authority. Route Repository geometry and assembled route remain unchanged.`);
    } catch (error) {
      setRouteEditNotice(`Unable to save route edit revision: ${error instanceof Error ? error.message : String(error)}. Edit session preserved.`);
    }
  }

  function handleDiscardRouteEditRevision() {
    const revisionReference = commercialRevisionReferenceForPatch();
    const nextHistory = discardUnappliedCommercialPatches(commercialChangeSetHistory);
    setRouteEditSession(null);
    setRouteEditRevisionPreview(null);
    setCommercialChangeSetPatches([]);
    setCommercialChangeSetHistory(nextHistory);
    setCommercialRevisionProjection(buildCommercialRevisionProjection(revisionReference, revisionReference, nextHistory));
    setCommercialChangeSetNotice("Discard Revision removed unapplied Commercial Change Set patches. Repository Truth is unchanged.");
    void CommercialChangeSetRepository.discardRevision(revisionReference.revisionId, session).catch((error) => {
      runtimeDiagnosticsWarn("CommercialChangeSetDiscard", {
        revisionId: revisionReference.revisionId,
        reason: error instanceof Error ? error.message : String(error),
      });
    });
    setRouteEditNotice("Route Edit Session discarded. Original assembled route remains active.");
  }

  function handleRollbackRouteEditSession() {
    if (!routeEditSession) return;
    const next = rollbackRouteEditSession(routeEditSession);
    const revisionReference = commercialRevisionReferenceForPatch();
    const restoredHistory = restoreOriginalCommercialRevision(commercialChangeSetHistory);
    setRouteEditSession(next);
    setRouteEditRevisionPreview(null);
    setCommercialChangeSetPatches([]);
    setCommercialChangeSetHistory(restoredHistory);
    setCommercialRevisionProjection(buildCommercialRevisionProjection(revisionReference, revisionReference, restoredHistory));
    setCommercialChangeSetNotice("Restore Original cleared Commercial Change Set patches. Commercial Revision returns to Repository Truth.");
    void CommercialChangeSetRepository.restoreOriginal(revisionReference.revisionId, session).catch((error) => {
      runtimeDiagnosticsWarn("CommercialChangeSetRestoreOriginal", {
        revisionId: revisionReference.revisionId,
        reason: error instanceof Error ? error.message : String(error),
      });
    });
    setRouteEditNotice("Route Edit Session rolled back to original projection. Repository truth unchanged.");
  }

  function handleCompareRouteEditRevision() {
    if (!routeEditSession) {
      setRouteEditNotice("No active Route Edit Session is available to compare.");
      return;
    }
    const revisionReference = commercialRevisionReferenceForPatch();
    const originalProjection = buildCommercialRevisionProjection(revisionReference, revisionReference, []);
    const currentProjection = buildLocalCommercialRevisionProjection(commercialChangeSetPatches);
    const comparison = compareCommercialRevisionProjections(originalProjection, currentProjection);
    setCommercialChangeSetNotice(`Compare Revision: ${comparison.differences.length.toLocaleString()} projected difference(s). Raw JSON was not compared.`);
    void CommercialChangeSetRepository.compareRevision(revisionReference.revisionId, session).catch((error) => {
      runtimeDiagnosticsWarn("CommercialChangeSetCompare", {
        revisionId: revisionReference.revisionId,
        reason: error instanceof Error ? error.message : String(error),
      });
    });
    setRouteEditNotice(`Compare Revision: ${routeEditSession.patches.length.toLocaleString()} patch(es), ${routeEditSession.projection.impact.affectedSections.join(", ") || "no affected sections"}.`);
  }

  function handleStartRouteEditSession() {
    const sessionToEdit = routeEditSessionOrCreate();
    if (!sessionToEdit) {
      setRouteEditNotice("An assembled commercial route is required before starting a Route Edit Session.");
      return;
    }
    setRouteEditSession(sessionToEdit);
    setRouteEditRevisionPreview(null);
    setCommercialRevisionProjection(buildLocalCommercialRevisionProjection(commercialChangeSetPatches));
    setCommercialChangeSetNotice("Commercial Change Set capture is active. Edits create deterministic patches against Commercial Revision.");
    setRouteEditNotice(`${sessionToEdit.sessionId} active. Edits are patches until Save Revision.`);
  }

  function commitAssumptionState(label: string, patch: Partial<Pick<BudgetAssumptionState, "civilMix" | "borePricing" | "slack" | "waste" | "splicing">>) {
    runtimeDiagnosticsLog("WorkbookRecalculationBoundary", {
      changedKey: label,
      affectedDomains: affectedWorkbookExecutionDomains({ changedKey: label }),
    });
    const next = cloneBudgetAssumptionState({
      state: selectedAssumptionState,
      label,
      patch,
    });
    setAssumptionStates((prev) => [...prev, next]);
    setSelectedAssumptionStateId(next.stateId);
  }

  function updateConstructionStrategy(changed: "hddPercent" | "plowPercent" | "openCutPercent", value: number) {
    const label = changed === "hddPercent" ? "Dirt Bore" : changed === "plowPercent" ? "Plow" : "Open Cut";
    const patchType: RouteEditPatchType = changed === "plowPercent" ? "CHANGE_PLOW_RATE" : changed === "hddPercent" ? "CHANGE_BORE_RATE" : "CHANGE_TRENCH_RATE";
    const stagedPatch = routeEditPatch(patchType, `Construction Strategy ${label} ${Math.round(value)}%`, Math.round(value));
    if (stagedPatch && applyRouteEditPatch(stagedPatch)) return;
    commitAssumptionState(`Construction Strategy ${label} ${Math.round(value)}%`, {
      civilMix: rebalanceConstructionStrategy(selectedAssumptionState.civilMix, changed, value),
    });
  }

  function updateCivilMixCalibration(changed: CivilMixCalibrationKey, value: number) {
    const traceId = beginCommercialMutation({
      event: "CIVIL_MIX_CHANGE",
      component: "GoogleRfpWorkspace",
      action: `updateCivilMixCalibration:${changed}`,
      input: { changed, value, routeFeet: activeFinancialDraft?.routeFeet ?? selectedPricingSummary.reconciliation.routeMiles * 5280 },
      artifactType: "CommercialFinancialProjection",
      artifactId: activeFinancialDraft?.transparentEstimate.estimateId,
    });
    recordCommercialMutationMilestone("civil-mix-event-handler-start", { changed, value });
    const next: CivilMixCalibration = { ...selectedCivilMixCalibration };
    const roundedValue = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
    if (changed === "plowPercent") {
      next.plowPercent = Math.min(roundedValue, Math.max(0, 100 - next.rockPercent - next.trenchPercent));
      next.dirtPercent = Math.max(0, 100 - next.plowPercent - next.rockPercent - next.trenchPercent);
    } else {
      const otherNonPlowTotal = (["dirtPercent", "rockPercent", "trenchPercent"] as const)
        .filter((key) => key !== changed)
        .reduce((total, key) => total + next[key], 0);
      next[changed] = Math.min(roundedValue, Math.max(0, 100 - otherNonPlowTotal));
      next.plowPercent = Math.max(0, 100 - next.dirtPercent - next.rockPercent - next.trenchPercent);
    }

    const combinedBorePercent = next.dirtPercent + next.rockPercent;
    const fastQuantities = calculateCivilMixFastPath(
      activeFinancialDraft?.routeFeet ?? selectedPricingSummary.reconciliation.routeMiles * 5280,
      next,
    );
    recordCommercialMutationMilestone("civil-mix-quantity-complete");
    annotateCommercialMutation({ objectsProcessed: 4, geometryPointsProcessed: 0, cacheStatus: "HIT" });
    recordCommercialMutationOperation("estimateRecalculations");
    recordCommercialMutationOperation("financialProjections");
    recordCommercialMutationOperation("proposalProjections");
    const rockShareOfBore = combinedBorePercent > 0 ? Math.round((next.rockPercent / combinedBorePercent) * 100) : 0;
    commitAssumptionState(
      `Civil Mix ${next.plowPercent}% plow / ${next.dirtPercent}% dirt / ${next.rockPercent}% rock / ${next.trenchPercent}% trench`,
      {
        civilMix: {
          hddPercent: combinedBorePercent,
          plowPercent: next.plowPercent,
          openCutPercent: next.trenchPercent,
          totalPercent: 100,
        },
        borePricing: {
          ...selectedAssumptionState.borePricing,
          rockBorePercent: rockShareOfBore,
          dirtBorePercent: 100 - rockShareOfBore,
        },
      },
    );
    recordCommercialMutationMilestone("commercial-assumption-state-enqueued");

    const calibratedValues: Record<(typeof CIVIL_MIX_CONSTRAINT_KEYS)[number], number> = {
      "civil.plowPercent": next.plowPercent,
      "civil.directionalBoreDirtPercent": next.dirtPercent,
      "civil.directionalBoreRockPercent": next.rockPercent,
      "civil.openTrenchPercent": next.trenchPercent,
    };
    const calibratedAt = new Date().toISOString();
    setTransparentEstimateControls((prev) => {
      const constraints = { ...(prev.constraints ?? {}) };
      CIVIL_MIX_CONSTRAINT_KEYS.forEach((key) => {
        constraints[key] = {
          ...transparentConstraintTemplate(key, prev),
          value: calibratedValues[key],
          authorityMode: "HUMAN_APPROVED",
          confidence: 100,
          source: "Account Manager civil mix calibration",
          sourceDetail: "Whole-number commercial calibration maintained at a 100% total.",
          approvedBy: currentUserName,
          approvedAt: calibratedAt,
          lastUpdated: calibratedAt,
        };
      });
      return { ...prev, civilMixMode: "MANUAL", constraints };
    });
    recordCommercialMutationMilestone("estimate-control-state-enqueued");
    setTransparentEstimateRecalculatedAt(calibratedAt);
    recordCommercialMutationOperation("reactStateCommits", 3);
    runtimeDiagnosticsLog("CivilMixFastPath", { traceId, ...fastQuantities, noGeometryRebuild: true, noStationRebuild: true, noMapRebuild: true, noEngineeringProjection: true });
    window.requestAnimationFrame(() => {
      recordCommercialMutationMilestone("react-commit-and-paint-complete");
      completeCommercialMutation(traceId);
      setMutationTraceRevision((revision) => revision + 1);
    });
  }

  function resetCivilMixCalibration() {
    const calibratedAt = new Date().toISOString();
    const next = STANDARD_CIVIL_MIX;
    commitAssumptionState("Standard Civil Mix 82% plow / 12% dirt / 0% rock / 6% trench", {
      civilMix: { hddPercent: 12, plowPercent: 82, openCutPercent: 6, totalPercent: 100 },
      borePricing: { ...selectedAssumptionState.borePricing, rockBorePercent: 0, dirtBorePercent: 100 },
    });
    setTransparentEstimateControls((prev) => {
      const calibratedValues: Record<(typeof CIVIL_MIX_CONSTRAINT_KEYS)[number], number> = {
        "civil.plowPercent": next.plowPercent,
        "civil.directionalBoreDirtPercent": next.dirtPercent,
        "civil.directionalBoreRockPercent": next.rockPercent,
        "civil.openTrenchPercent": next.trenchPercent,
      };
      const constraints = { ...(prev.constraints ?? {}) };
      CIVIL_MIX_CONSTRAINT_KEYS.forEach((key) => {
        constraints[key] = {
          ...transparentConstraintTemplate(key, prev),
          value: calibratedValues[key],
          authorityMode: "HUMAN_APPROVED",
          confidence: 100,
          source: "Standard civil mix",
          sourceDetail: "82% plow / 12% dirt / 0% rock / 6% trench.",
          approvedBy: currentUserName,
          approvedAt: calibratedAt,
          lastUpdated: calibratedAt,
        };
      });
      return { ...prev, civilMixMode: "MANUAL", constraints };
    });
    setTransparentEstimateRecalculatedAt(calibratedAt);
  }

  function updateRockPercent(value: number) {
    const rockBorePercent = Math.max(0, Math.min(100, Math.round(value)));
    const stagedPatch = routeEditPatch("CHANGE_ROCK_RATE", `Geology rock ${rockBorePercent}%`, rockBorePercent);
    if (stagedPatch && applyRouteEditPatch(stagedPatch)) return;
    commitAssumptionState(`Geology rock ${rockBorePercent}%`, {
      borePricing: {
        ...selectedAssumptionState.borePricing,
        rockBorePercent,
        dirtBorePercent: 100 - rockBorePercent,
      },
    });
  }

  function updateTransparentEstimateDuration(days: number) {
    const stagedPatch = routeEditPatch("CHANGE_TERM_MONTHS", `Customer Duration ${Math.max(1, Math.round(days))} days`, Math.max(1, Math.round(days)));
    if (stagedPatch && applyRouteEditPatch(stagedPatch)) return;
    setTransparentEstimateControls((prev) => ({
      ...prev,
      targetDurationDays: Math.max(1, Math.round(days)),
    }));
  }

  function updateTransparentProduction(key: keyof TransparentEstimateProductionControls, value: number | null) {
    const patchType: RouteEditPatchType =
      key === "plowFeetPerDay" ? "CHANGE_PLOW_RATE" :
      key === "directionalBoreDirtFeetPerDay" ? "CHANGE_BORE_RATE" :
      key === "directionalBoreRockFeetPerDay" ? "CHANGE_ROCK_RATE" :
      key === "openTrenchDirtFeetPerDay" || key === "openTrenchRockFeetPerDay" ? "CHANGE_TRENCH_RATE" :
      "CHANGE_SEGMENT_UNIT_COST";
    const stagedPatch = routeEditPatch(patchType, `Production ${key}`, value);
    if (stagedPatch && applyRouteEditPatch(stagedPatch)) return;
    setTransparentEstimateControls((prev) => ({
      ...prev,
      production: {
        ...prev.production,
        [key]: value === null ? null : Math.max(0, Math.round(value)),
      },
    }));
  }

  function updateTransparentFinancial(key: keyof TransparentEstimateFinancialControls, value: number) {
    const mutation: CommercialMutationType = key === "markupPercent" ? "COMMERCIAL_MARKUP_CHANGE" : "COMMERCIAL_MARKUP_CHANGE";
    const traceId = beginCommercialMutation({ event: mutation, component: "GoogleRfpWorkspace", action: `updateTransparentFinancial:${key}`, input: { key, value }, artifactType: "CommercialFinancialProjection" });
    const patchType: RouteEditPatchType = key === "monthlyOmPerRouteMile" ? "CHANGE_MONTHLY_REVENUE" : "CHANGE_MARGIN_ASSUMPTION";
    const stagedPatch = routeEditPatch(patchType, `Financial ${key}`, Number(value.toFixed(2)));
    if (stagedPatch && applyRouteEditPatch(stagedPatch)) return;
    setTransparentEstimateControls((prev) => ({
      ...prev,
      financial: {
        ...prev.financial,
        [key]: Math.max(0, Number(value.toFixed(2))),
      },
    }));
    recordCommercialMutationOperation("financialProjections");
    recordCommercialMutationOperation("proposalProjections");
    recordCommercialMutationOperation("reactStateCommits");
    window.requestAnimationFrame(() => { completeCommercialMutation(traceId); setMutationTraceRevision((revision) => revision + 1); });
  }

  function updateTransparentIlaPlanning(next: IlaPlanningControls) {
    const traceId = beginCommercialMutation({ event: "ILA_MODE_CHANGE", component: "GoogleRfpWorkspace", action: "updateTransparentIlaPlanning", input: next, artifactType: "CommercialFinancialProjection" });
    const estimateId = activeFinancialDraft?.transparentEstimate.estimateId;
    if (estimateId) invalidateIlaPlanningCache(estimateId);
    const stagedPatch = inferIlaRouteEditPatch(next);
    if (stagedPatch && applyRouteEditPatch(stagedPatch)) return;
    setTransparentEstimateControls((prev) => ({
      ...prev,
      ilaPlanning: {
        ...next,
        stationOverrides: { ...(next.stationOverrides ?? {}) },
      },
    }));
    recordCommercialMutationOperation("quantityRecalculations");
    recordCommercialMutationOperation("estimateRecalculations");
    recordCommercialMutationOperation("financialProjections");
    recordCommercialMutationOperation("reactStateCommits");
    window.requestAnimationFrame(() => { completeCommercialMutation(traceId); setMutationTraceRevision((revision) => revision + 1); });
  }

  function updateTransparentProjectConfiguration(next: TransparentProjectConfigurationControls) {
    const previous = transparentEstimateControls.projectConfiguration;
    const event: CommercialMutationType = previous.fiberCount !== next.fiberCount ? "FIBER_CONFIGURATION_CHANGE" : "DUCT_CONFIGURATION_CHANGE";
    const traceId = beginCommercialMutation({ event, component: "GoogleRfpWorkspace", action: "updateTransparentProjectConfiguration", input: next, artifactType: "DraftIofStructuralProjection" });
    const estimateId = activeFinancialDraft?.transparentEstimate.estimateId;
    if (estimateId) invalidateIlaPlanningCache(estimateId);
    setTransparentEstimateControls((prev) => ({
      ...prev,
      projectConfiguration: {
        ...next,
        configurationRevision: prev.projectConfiguration.configurationRevision + 1,
        slackRevision: `PROJECT-CONFIG-R${prev.projectConfiguration.configurationRevision + 1}`,
      },
    }));
    recordCommercialMutationOperation("quantityRecalculations");
    recordCommercialMutationOperation("estimateRecalculations");
    recordCommercialMutationOperation("financialProjections");
    recordCommercialMutationOperation("reactStateCommits");
    window.requestAnimationFrame(() => { completeCommercialMutation(traceId); setMutationTraceRevision((revision) => revision + 1); });
  }

  function selectTransparentIlaStation(stationId: string) {
    const stagedPatch = routeEditPatch("MOVE_ILA", `Select ILA station ${stationId}`, undefined, { targetId: stationId });
    if (stagedPatch && routeEditSession) {
      setRouteEditSession((prev) => prev ? {
        ...prev,
        projection: {
          ...prev.projection,
          projectedControls: {
            ...prev.projection.projectedControls,
            ilaPlanning: {
              ...prev.projection.projectedControls.ilaPlanning,
              selectedStationId: stationId,
            },
          },
          projectedEstimate: {
            ...prev.projection.projectedEstimate,
            ilaPlan: {
              ...prev.projection.projectedEstimate.ilaPlan,
              controls: {
                ...prev.projection.projectedEstimate.ilaPlan.controls,
                selectedStationId: stationId,
              },
            },
          },
        },
      } : prev);
      return;
    }
    setTransparentEstimateControls((prev) => ({
      ...prev,
      ilaPlanning: {
        ...prev.ilaPlanning,
        selectedStationId: stationId,
        stationOverrides: { ...(prev.ilaPlanning.stationOverrides ?? {}) },
      },
    }));
  }

  function transparentConstraintTemplate(key: string, prev: TransparentEstimateControls, fallback?: ConstraintValue): ConstraintValue {
    const estimateConstraint =
      commercialCorridorDraft?.transparentEstimate.constraintValues[key] ??
      selectedImportedCommercialDraft?.transparentEstimate.constraintValues[key] ??
      loadedCommercialDraftSnapshot?.transparentEstimate.constraintValues[key];
    const existing = prev.constraints?.[key];
    if (existing) return existing;
    if (estimateConstraint) return estimateConstraint;
    if (fallback) return fallback;
    return {
      key,
      label: key,
      value: null,
      authorityMode: "UNKNOWN",
      confidence: 0,
      source: "Estimate control",
      affectsCost: true,
      affectsSchedule: true,
      affectsConfidence: true,
    };
  }

  function algorithmConstraintTemplate(key: string, prev: TransparentEstimateControls, previous?: ConstraintValue): ConstraintValue | undefined {
    const stored = prev.algorithmConstraints?.[key];
    if (stored) return stored;
    if (previous && !isHumanWorkflowAuthority(previous.authorityMode)) return previous;
    const estimateConstraint =
      commercialCorridorDraft?.transparentEstimate.constraintValues[key] ??
      selectedImportedCommercialDraft?.transparentEstimate.constraintValues[key] ??
      loadedCommercialDraftSnapshot?.transparentEstimate.constraintValues[key];
    if (estimateConstraint && !isHumanWorkflowAuthority(estimateConstraint.authorityMode)) return estimateConstraint;
    return undefined;
  }

  function baseCivilMixValue(key: string, prev: TransparentEstimateControls) {
    const existing = prev.constraints?.[key]?.value;
    if (typeof existing === "number") return existing;
    const estimateValue =
      commercialCorridorDraft?.transparentEstimate.constraintValues[key]?.value ??
      selectedImportedCommercialDraft?.transparentEstimate.constraintValues[key]?.value ??
      loadedCommercialDraftSnapshot?.transparentEstimate.constraintValues[key]?.value;
    if (typeof estimateValue === "number") return estimateValue;
    if (key === "civil.plowPercent") return selectedAssumptionState.civilMix.plowPercent;
    if (key === "civil.directionalBoreDirtPercent") return selectedAssumptionState.civilMix.hddPercent;
    if (key === "civil.openTrenchPercent") return selectedAssumptionState.civilMix.openCutPercent;
    return 0;
  }

  function rebalanceCivilMixConstraints(prev: TransparentEstimateControls, changed: ConstraintValue) {
    if (!CIVIL_MIX_CONSTRAINT_KEYS.includes(changed.key as (typeof CIVIL_MIX_CONSTRAINT_KEYS)[number])) return { ...(prev.constraints ?? {}), [changed.key]: changed };
    const changedValue = typeof changed.value === "number" ? Math.max(0, Math.min(100, changed.value)) : 0;
    if (prev.civilMixMode === "MANUAL") {
      return {
        ...(prev.constraints ?? {}),
        [changed.key]: { ...changed, value: changedValue },
      };
    }
    const remainingKeys = CIVIL_MIX_CONSTRAINT_KEYS.filter((key) => key !== changed.key);
    const fixedKeys = remainingKeys.filter((key) => isApprovedHumanAuthority(transparentConstraintTemplate(key, prev).authorityMode));
    const adjustableKeys = remainingKeys.filter((key) => !fixedKeys.includes(key));
    const fixedTotal = fixedKeys.reduce((total, key) => total + baseCivilMixValue(key, prev), 0);
    const remainingTarget = Math.max(0, 100 - changedValue - fixedTotal);
    const currentRemainingTotal = adjustableKeys.reduce((total, key) => total + baseCivilMixValue(key, prev), 0);
    let allocated = 0;
    const nextConstraints: Record<string, ConstraintValue> = {
      ...(prev.constraints ?? {}),
      [changed.key]: { ...changed, value: changedValue },
    };
    fixedKeys.forEach((key) => {
      const template = transparentConstraintTemplate(key, prev);
      nextConstraints[key] = {
        ...template,
        value: baseCivilMixValue(key, prev),
        lastUpdated: new Date().toISOString(),
      };
    });
    adjustableKeys.forEach((key, index) => {
      const template = transparentConstraintTemplate(key, prev);
      const rawValue = currentRemainingTotal > 0
        ? (baseCivilMixValue(key, prev) / currentRemainingTotal) * remainingTarget
        : remainingTarget / Math.max(1, adjustableKeys.length);
      const remainingAllocation = Math.max(0, remainingTarget - allocated);
      const balancedValue = index === adjustableKeys.length - 1 ? roundTwo(remainingAllocation) : Math.min(roundTwo(rawValue), remainingAllocation);
      allocated += balancedValue;
      nextConstraints[key] = {
        ...template,
        key,
        value: balancedValue,
        authorityMode: "ALGORITHM",
        confidence: authorityModeConfidence("ALGORITHM"),
        source: "Civil mix auto-balance",
        sourceDetail: "Automatic mode redistributed the remaining route percentage to keep civil mix at 100%.",
        lastUpdated: new Date().toISOString(),
      };
    });
    return nextConstraints;
  }

  function roundTwo(value: number) {
    return Math.round(value * 100) / 100;
  }

  function updateTransparentCivilMixMode(mode: TransparentEstimateControls["civilMixMode"]) {
    setTransparentEstimateControls((prev) => {
      if (mode !== "AUTOMATIC") return { ...prev, civilMixMode: mode };
      const driverKey = CIVIL_MIX_CONSTRAINT_KEYS.reduce((largestKey, key) => (
        baseCivilMixValue(key, prev) > baseCivilMixValue(largestKey, prev) ? key : largestKey
      ), CIVIL_MIX_CONSTRAINT_KEYS[0]);
      const driverTemplate = transparentConstraintTemplate(driverKey, prev);
      return {
        ...prev,
        civilMixMode: mode,
        constraints: rebalanceCivilMixConstraints(
          { ...prev, civilMixMode: "AUTOMATIC" },
          {
            ...driverTemplate,
            value: baseCivilMixValue(driverKey, prev),
            lastUpdated: new Date().toISOString(),
          },
        ),
      };
    });
  }

  function updateTransparentConstraint(next: ConstraintValue) {
    const routeEditConstraintPatchType: RouteEditPatchType | null =
      next.key === "civil.plowPercent" ? "CHANGE_PLOW_RATE" :
      next.key === "civil.directionalBoreDirtPercent" ? "CHANGE_BORE_RATE" :
      next.key === "civil.directionalBoreRockPercent" || next.key === "civil.rockAdderPerFoot" ? "CHANGE_ROCK_RATE" :
      next.key === "civil.openTrenchPercent" ? "CHANGE_TRENCH_RATE" :
      next.key.startsWith("labor.") || next.key.startsWith("material.") ? "CHANGE_SEGMENT_UNIT_COST" :
      next.key.startsWith("financial.") || next.key.startsWith("om.") ? "CHANGE_MONTHLY_REVENUE" :
      null;
    if (routeEditConstraintPatchType && routeEditSession) {
      const stagedPatch = routeEditPatch(routeEditConstraintPatchType, `Constraint ${next.label || next.key}`, typeof next.value === "number" ? next.value : String(next.value ?? ""));
      if (stagedPatch && applyRouteEditPatch(stagedPatch)) return;
    }
    const mutationEvent: CommercialMutationType | null = next.key.startsWith("material.")
      ? "MATERIAL_RATE_CHANGE"
      : next.key.startsWith("labor.") || next.key === "civil.rockAdderPerFoot"
        ? "LABOR_RATE_CHANGE"
        : null;
    const traceId = mutationEvent ? beginCommercialMutation({
      event: mutationEvent,
      component: "GoogleRfpWorkspace",
      action: `updateTransparentConstraint:${next.key}`,
      input: { key: next.key, value: next.value, authorityMode: next.authorityMode },
      artifactType: "CommercialFinancialProjection",
    }) : null;
    setTransparentEstimateControls((prev) => {
      const previous = transparentConstraintTemplate(next.key, prev);
      const algorithmBaseline = algorithmConstraintTemplate(next.key, prev, previous);
      const restoringAlgorithm = next.authorityMode === "ALGORITHM" && Boolean(algorithmBaseline);
      const resolvedNext: ConstraintValue = restoringAlgorithm && algorithmBaseline
        ? {
            ...algorithmBaseline,
            authorityMode: "ALGORITHM",
            confidence: authorityModeConfidence("ALGORITHM"),
            approvedBy: undefined,
            approvedAt: undefined,
            notes: next.notes,
            lastUpdated: new Date().toISOString(),
          }
        : {
            ...next,
            lastUpdated: next.lastUpdated ?? new Date().toISOString(),
          };
      const productionKey = TRANSPARENT_CONSTRAINT_PRODUCTION_MAP[resolvedNext.key];
      const numericValue = typeof resolvedNext.value === "number" ? Math.max(0, resolvedNext.value) : null;
      const constraints = CIVIL_MIX_CONSTRAINT_KEYS.includes(resolvedNext.key as (typeof CIVIL_MIX_CONSTRAINT_KEYS)[number])
        ? rebalanceCivilMixConstraints(prev, resolvedNext)
        : {
            ...(prev.constraints ?? {}),
            [resolvedNext.key]: {
              ...resolvedNext,
              lastUpdated: resolvedNext.lastUpdated ?? new Date().toISOString(),
            },
          };
      const algorithmConstraints = algorithmBaseline
        ? {
            ...(prev.algorithmConstraints ?? {}),
            [resolvedNext.key]: algorithmBaseline,
          }
        : prev.algorithmConstraints;
      const changedValue = !valuesMatch(previous.value, resolvedNext.value);
      const changedAuthority = previous.authorityMode !== resolvedNext.authorityMode;
      const changedReason = (previous.notes ?? "") !== (resolvedNext.notes ?? "");
      const appendAudit = (changedValue || changedAuthority || changedReason) && (
        restoringAlgorithm ||
        isHumanWorkflowAuthority(previous.authorityMode) ||
        isHumanWorkflowAuthority(resolvedNext.authorityMode)
      );
      return {
        ...prev,
        production: productionKey
          ? {
              ...prev.production,
              [productionKey]: numericValue === null ? null : Math.round(numericValue),
            }
          : prev.production,
        financial: resolvedNext.key === "financial.omCostPerRouteMile"
          ? {
              ...prev.financial,
              monthlyOmPerRouteMile: numericValue === null ? 0 : Number((numericValue / 12).toFixed(2)),
            }
          : prev.financial,
        constraints,
        algorithmConstraints,
        humanAuditTrail: appendAudit
          ? [
              ...(prev.humanAuditTrail ?? []),
              humanAuditEntry(previous, resolvedNext, resolvedNext.notes, currentUserName),
            ]
          : prev.humanAuditTrail,
      };
    });
    if (traceId) {
      recordCommercialMutationOperation("estimateRecalculations");
      recordCommercialMutationOperation("financialProjections");
      recordCommercialMutationOperation("proposalProjections");
      recordCommercialMutationOperation("reactStateCommits");
      annotateCommercialMutation({ geometryPointsProcessed: 0, cacheStatus: "HIT" });
      window.requestAnimationFrame(() => { completeCommercialMutation(traceId); setMutationTraceRevision((revision) => revision + 1); });
    }
  }

  function handleRoutePlanRevised(nextRoutePlan: GoogleRfpRouteBidPlan) {
    setBidPlan((prev) =>
      rebuildGoogleRfpBidPlanFromRoutePlans(
        prev.opportunity,
        prev.routePlans.map((route) => (route.routeRequirement.routeRequirementId === nextRoutePlan.routeRequirement.routeRequirementId ? nextRoutePlan : route)),
      ),
    );
  }

  function handleCommercialRecalculationChange(recalculating: boolean) {
    setCommercialRecalculationPending(recalculating);
    if (!recalculating) return;
    setLiveCommercialSession((prev) => (prev ? { ...prev, recalculationStatus: "RECALCULATING", errorMessage: undefined } : prev));
  }

  function updateNetworkLayerState(networkId: string, key: keyof NetworkLayerState) {
    const network = accountNetworkInventory.find((candidate) => candidate.networkId === networkId);
    if (!network) return;
    setNetworkLayerStates((prev) => {
      const current = prev[networkId] ?? defaultNetworkLayerState(network);
      return {
        ...prev,
        [networkId]: {
          ...current,
          [key]: !current[key],
        },
      };
    });
  }

  function handleSelectCommercialAttachment(attachmentId: string) {
    setSelectedAttachmentCandidateId(attachmentId);
    setCommercialRouteResult(null);
    setCommercialRoutingStatus("IDLE");
    if (quickQuoteCanRun(opportunityWorkflowState)) setOpportunityWorkflowState("SITE_DECISION_READY");
  }

  function selectAccount(accountId: string) {
    if (!accountId) return;
    setSelectedAccountId(accountId);
    setOpportunityRestoreState(createOpportunityRestoreState());
    setAccountEditorOpen(false);
    setContactDraft(contactEditorDefaults());
    setActiveView("networks");
    setNewOpportunityDialogOpen(false);
    setOpportunityWorkflowState("IDLE");
    setCommercialDraftType(null);
    setOpportunityScoutCandidate(null);
    setOpportunityScoutAddress("");
    setOpportunityScoutLat("");
    setOpportunityScoutLng("");
    setOpportunityScoutAzOrigin("");
    setOpportunityScoutAzDestination("");
    setAzOriginLocation(null);
    setAzDestinationLocation(null);
    setAzMapPlacementSlot(null);
    setSelectedAttachmentCandidateId(null);
    setCommercialRouteResult(null);
    setCommercialRoutingStatus("IDLE");
    setTemporaryImportedRoute(null);
    setPendingRouteImport(null);
    setImportedEndpointReplacementConfirmed(false);
    setRouteImportStatus("IDLE");
    setGeneratedRouteRepositorySnapshot(null);
    setRoutePersistenceInspector(null);
    setActiveCommercialOpportunityId("");
    setOpportunityNotice("No opportunity loaded. New Opportunity starts with Customer Twin only.");
  }

  function clearCommercialDraftMapLayers() {
    setNetworkLayerStates((prev) => {
      const next = { ...prev };
      accountNetworkInventory
        .filter((network) => network.networkCategory === "COMMERCIAL_DRAFT")
        .forEach((network) => {
          next[network.networkId] = {
            ...(prev[network.networkId] ?? defaultNetworkLayerState(network)),
            visible: false,
            activeReference: false,
            locked: false,
          };
        });
      return next;
    });
  }

  function resetCommercialOpportunityWorkingState(options: { preserveActiveOpportunity?: boolean } = {}) {
    resetOpportunityInputState();
    setLiveCommercialSession(null);
    setCommercialRecalculationPending(false);
    setImportedCommercialDraft(null);
    setLoadedCommercialDraftSnapshot(null);
    setSelectedCommercialCorridorDraft(null);
    setSelectedCustomerDesignImportId("");
    setSelectedCustomerDesignRouteId("");
    setSelectedRouteEngineeringActivation(null);
    setSelectedRouteEngineeringDraft(null);
    setInventoryMapSelection(null);
    setAcceptedProposal(null);
    setCustomerReviewStatus("NOT_STARTED");
    setActiveDesignMode("EXTEND_EXISTING_NETWORK");
    setActiveView("networks");
    setOpportunityWorkflowState("IDLE");
    setNewOpportunityDialogOpen(false);
    setSelectedScopeId(googleHeliumBidPlanFixture.routePlans[0]?.routeRequirement.routeRequirementId ?? "COMBINED_AWARD");
    setTransparentEstimateControls(defaultTransparentEstimateControls());
    setTransparentEstimateRecalculatedAt(null);
    setGeneratedRouteRepositorySnapshot(null);
    setRouteEditSession(null);
    setRouteEditRevisionPreview(null);
    setRouteEditNotice("Route edits are inactive. Original assembled route truth is unchanged.");
    setRoutePersistenceInspector(null);
    clearCommercialDraftMapLayers();
    if (!options.preserveActiveOpportunity) setActiveCommercialOpportunityId("");
  }

  function appendRoutePersistenceAudit(stage: string, status: RoutePersistenceAuditStatus, details: Record<string, unknown> = {}) {
    const entry: RoutePersistenceAuditEntry = {
      auditId: `ROUTE-PERSISTENCE-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      timestamp: new Date().toISOString(),
      stage,
      status,
      details,
    };
    setRoutePersistenceAuditLog((prev) => [entry, ...prev].slice(0, 80));
    runtimeDiagnosticsLog("RoutePersistenceAudit", { ...entry });
    return entry;
  }

  function routeSnapshotHash(snapshot: CommercialRouteRepositoryRecord | null | undefined) {
    if (!snapshot) return "missing";
    return snapshot.geometryHash || commercialRouteGeometryHash(snapshot.commercialGeometry ?? []);
  }

  function routeSnapshotVertexCount(snapshot: CommercialRouteRepositoryRecord | null | undefined) {
    return snapshot?.commercialGeometry?.length ?? 0;
  }

  function routePersistenceInspectorFromRecords(
    opportunity: CommercialOpportunityRecord,
    routeSnapshot: CommercialRouteRepositoryRecord | null,
    status: string,
  ): RoutePersistenceInspectorState {
    const routeRepositoryId = routeSnapshot?.routeRepositoryId ?? opportunity.routeRepositoryId ?? opportunity.routeRepositoryRef?.routeRepositoryId ?? "";
    const geometryHash = routeSnapshotHash(routeSnapshot);
    const attachmentIds = [
      ...((routeSnapshot?.importedEvidence ?? []).map((item) => item.evidenceId)),
      ...((opportunity.attachmentMetadata ?? []).map((item) => String(item.attachmentId ?? item.evidenceId ?? "")).filter(Boolean)),
    ];
    return {
      opportunityId: opportunity.opportunityId,
      routeRepositoryId,
      routeGeometryId: routeSnapshot?.routeGeometryId ?? routeGeometryId(routeRepositoryId || "missing-route-repository", geometryHash),
      geometryHash,
      vertexCount: routeSnapshotVertexCount(routeSnapshot),
      lengthMiles: Number(routeSnapshot?.routeMiles ?? opportunity.routeMiles ?? 0),
      estimateId: String(opportunity.estimate?.estimateId ?? opportunity.commercialDraftSnapshot?.transparentEstimate?.estimateId ?? "estimate-snapshot"),
      workbookId: String(opportunity.workbookId ?? opportunity.commercialWorkbook?.workbookId ?? ""),
      proposalId: String(opportunity.proposalId ?? ""),
      attachmentIds: [...new Set(attachmentIds)],
      savedTimestamp: String(opportunity.updatedAt ?? opportunity.modifiedDate ?? routeSnapshot?.updatedAt ?? ""),
      restoredTimestamp: new Date().toISOString(),
      status,
    };
  }

  function updateRoutePersistenceInspector(
    opportunity: CommercialOpportunityRecord,
    routeSnapshot: CommercialRouteRepositoryRecord | null,
    status: string,
  ) {
    setRoutePersistenceInspector(routePersistenceInspectorFromRecords(opportunity, routeSnapshot, status));
  }

  function routeSnapshotWithIntegrity(snapshot: CommercialRouteRepositoryRecord): CommercialRouteRepositoryRecord {
    const geometryHash = commercialRouteGeometryHash(snapshot.commercialGeometry ?? []);
    const routeGeometryIdValue = routeGeometryId(snapshot.routeRepositoryId, geometryHash);
    const evidence = snapshot.importedEvidence?.length
      ? snapshot.importedEvidence
      : [generatedRouteEvidence(snapshot.routeRepositoryId, snapshot.routeId, geometryHash, snapshot.updatedAt ?? new Date().toISOString())];
    return {
      ...snapshot,
      geometryHash,
      routeGeometryId: routeGeometryIdValue,
      importedEvidence: evidence,
      immutableImportedEvidence: true,
      noScopeVersionCreation: true,
      noInventoryMutation: true,
    };
  }

  function requireRouteSnapshotIntegrity(snapshot: CommercialRouteRepositoryRecord | null | undefined, phase: string) {
    if (!snapshot?.routeRepositoryId) throw new Error(`${phase}: missing Route Repository ID.`);
    if (!hasCoordinateGeometry(snapshot.commercialGeometry)) throw new Error(`${phase}: missing Route Repository geometry.`);
    if (!snapshot.geometryHash || snapshot.geometryHash !== commercialRouteGeometryHash(snapshot.commercialGeometry)) {
      throw new Error(`${phase}: Route Repository geometry hash mismatch.`);
    }
  }

  function opportunityRequiresRouteTransaction(record: CommercialOpportunityRecord) {
    return Boolean(
      hasCoordinateGeometry(record.routeGeometry) ||
      hasCoordinateGeometry(record.routeRepositorySnapshot?.commercialGeometry) ||
      isRestorableCommercialDraft(record.commercialDraftSnapshot) ||
      Number(record.routeFeet ?? 0) > 0 ||
      Number(record.routeMiles ?? 0) > 0
    );
  }

  function validateOpportunityBeforeSave(record: CommercialOpportunityRecord) {
    const failures: string[] = [];
    const requiresRoute = opportunityRequiresRouteTransaction(record);
    if (requiresRoute && !record.routeRepositoryId && !record.routeRepositoryRef?.routeRepositoryId && !record.routeRepositorySnapshot?.routeRepositoryId) {
      failures.push("routeRepositoryId missing before Opportunity save.");
    }
    if (requiresRoute && !hasCoordinateGeometry(record.routeRepositorySnapshot?.commercialGeometry) && !hasCoordinateGeometry(record.routeGeometry)) {
      failures.push("route geometry missing before Opportunity save.");
    }
    if (!hasObjectPayload(record.estimate)) failures.push("estimate snapshot missing before Opportunity save.");
    if (!hasObjectPayload(record.commercialWorkbook)) failures.push("workbook snapshot missing before Opportunity save.");
    return failures;
  }

  async function verifySavedOpportunityTransaction(
    memoryRecord: CommercialOpportunityRecord,
    expectedRouteSnapshot: CommercialRouteRepositoryRecord | null,
  ) {
    appendRoutePersistenceAudit("Verify immediately after save", "START", {
      opportunityId: memoryRecord.opportunityId,
      routeRepositoryId: expectedRouteSnapshot?.routeRepositoryId ?? memoryRecord.routeRepositoryId ?? "",
    });
    const reloadedOpportunity = await OpportunityRepository.openOpportunity<CommercialOpportunityRecord>(memoryRecord.opportunityId, session);
    const routeRepositoryId = reloadedOpportunity.routeRepositoryRef?.routeRepositoryId ?? reloadedOpportunity.routeRepositoryId ?? "";
    if ((expectedRouteSnapshot?.routeRepositoryId ?? "") && routeRepositoryId !== expectedRouteSnapshot?.routeRepositoryId) {
      throw new Error(`Saved Opportunity routeRepositoryId mismatch. Expected ${expectedRouteSnapshot?.routeRepositoryId}; found ${routeRepositoryId || "empty"}.`);
    }
    const reloadedRoute = routeRepositoryId ? await RouteRepository.verifyRoute(routeRepositoryId, { geometryHash: expectedRouteSnapshot?.geometryHash }, session) : null;
    if (expectedRouteSnapshot) {
      requireRouteSnapshotIntegrity(reloadedRoute, "Verify immediately after save");
      const expectedHash = routeSnapshotHash(expectedRouteSnapshot);
      const actualHash = routeSnapshotHash(reloadedRoute);
      if (actualHash !== expectedHash) {
        throw new Error(`Saved geometry hash mismatch. Expected ${expectedHash}; found ${actualHash}.`);
      }
    }
    if (!hasObjectPayload(reloadedOpportunity.estimate)) throw new Error("Saved Opportunity is missing estimate snapshot after reload.");
    if (!hasObjectPayload(reloadedOpportunity.commercialWorkbook)) throw new Error("Saved Opportunity is missing workbook snapshot after reload.");
    appendRoutePersistenceAudit("Verify immediately after save", "SUCCESS", {
      opportunityId: reloadedOpportunity.opportunityId,
      routeRepositoryId,
      geometryHash: routeSnapshotHash(reloadedRoute),
      vertexCount: routeSnapshotVertexCount(reloadedRoute),
      estimate: "OK",
      workbook: "OK",
    });
    updateRoutePersistenceInspector(reloadedOpportunity, reloadedRoute, "TRANSACTION_VERIFIED");
    return { reloadedOpportunity, reloadedRoute };
  }

  function opportunityRecordForRepository(record: CommercialOpportunityRecord): CommercialOpportunityRecord {
    const {
      routeRepositorySnapshot: _routeRepositorySnapshot,
      routeGeometry: _routeGeometry,
      commercialDraftSnapshot: _commercialDraftSnapshot,
      selectedRouteSnapshot: _selectedRouteSnapshot,
      customerDesignImportSnapshot: _customerDesignImportSnapshot,
      sourceFiles: _sourceFiles,
      attachments: _attachments,
      ...repositoryRecord
    } = record;
    const routeRepositoryId = record.routeRepositoryId ?? record.routeRepositoryRef?.routeRepositoryId ?? record.routeRepositorySnapshot?.routeRepositoryId;
    return {
      ...repositoryRecord,
      routeRepositoryId,
      routeRepositoryRef: record.routeRepositoryRef,
      sourceFiles: [],
      attachments: [],
      importedEvidenceReferences: (record.importedEvidenceReferences ?? record.routeRepositorySnapshot?.importedEvidence ?? []).map((evidence) => ({
        ...evidence,
        repositoryLocation: evidence.repositoryLocation,
      })),
      commercialSnapshot: {
        ...(record.commercialSnapshot ?? {}),
        routeRepositoryId,
        routeRepositoryRef: record.routeRepositoryRef,
        routeGeometryOwnedBy: routeRepositoryId ? "COMMERCIAL_ROUTE_REPOSITORY" : "NONE",
        noEmbeddedRouteGeometry: true,
      },
    };
  }

  function newestRouteForOpportunity(routes: CommercialRouteRepositoryRecord[], opportunityId: string) {
    return [...routes]
      .filter((route) => route.opportunityId === opportunityId)
      .sort((a, b) => String(b.updatedAt ?? b.createdAt ?? "").localeCompare(String(a.updatedAt ?? a.createdAt ?? "")))[0] ?? null;
  }

  function buildCommercialRouteRepositoryRecord(args: {
    opportunityId: string;
    opportunityName: string;
    commercialDraft: CommercialCorridorDraft | null;
    sourceImport: CustomerDesignImport | null;
    sourceRoute: ImportedCustomerRoute | null;
    sourceFiles: Array<Record<string, unknown>>;
    routeGeometry: DALCoordinate[];
    routeFeet: number;
    routeMiles: number;
    timestamp: string;
  }): CommercialRouteRepositoryRecord | null {
    const commercialGeometry = args.commercialDraft?.geometry?.length
      ? args.commercialDraft.geometry
      : args.routeGeometry?.length
        ? args.routeGeometry
        : geometryForImportedRoute(args.sourceRoute);
    if (commercialGeometry.length < 2) return null;
    const first = commercialGeometry[0] ?? null;
    const last = commercialGeometry.at(-1) ?? null;
    const routeId = args.commercialDraft?.routeId ?? args.sourceRoute?.routeId ?? `${args.opportunityId}:COMMERCIAL-ROUTE`;
    const routeRepositoryId = routeRepositoryIdForOpportunity(args.opportunityId, routeId);
    const geometryHash = commercialRouteGeometryHash(commercialGeometry);
    const routeName = args.sourceRoute?.name ?? args.commercialDraft?.routeId ?? `${args.opportunityName} Route`;
    const routeRevision = Math.max(1, Number(activeCommercialOpportunity?.routeRepositorySnapshot?.routeRevision ?? generatedRouteRepositorySnapshot?.routeRevision ?? 0) + (activeCommercialOpportunity?.routeRepositoryId ? 1 : 0));
    const sourceGeometry = args.sourceImport?.routes.find((route) => route.routeId === args.sourceRoute?.routeId)?.dalGeometry ?? args.sourceRoute?.dalGeometry ?? commercialGeometry;
    const stagedImport = temporaryImportedRoute;
    const endpointAuthority = stagedImport && stagedImport.route.routeId === args.sourceRoute?.routeId
      ? stagedImport.endpointAuthority
      : args.sourceImport && args.sourceRoute
        ? deriveImportedRouteEndpointAuthority({
            sourceGeometry,
            sourceFileHash: args.sourceImport.sourceFileHash ?? "missing-source-file-hash",
            sourceGeometryId: `${args.sourceImport.importId}:${args.sourceRoute.routeId}`,
            routeRevision,
            geometryHash,
          })
        : undefined;
    const importedEvidence = args.sourceFiles.length
      ? args.sourceFiles.map((file, index) => evidenceFromSourceFile(file, args.opportunityId, index))
      : [generatedRouteEvidence(routeRepositoryId, routeId, geometryHash, args.timestamp)];
    return {
      routeRepositoryId,
      transactionId: `ROUTE-SAVE-${routeRepositoryId}-${Date.now()}`,
      routeSnapshotId: `${routeRepositoryId}-v${routeRevision}`,
      routeGeometryId: routeGeometryId(routeRepositoryId, geometryHash),
      geometryHash,
      opportunityId: args.opportunityId,
      accountId: selectedAccount.accountId,
      customerId: customerIdForAccount(selectedAccount.accountId),
      productId: selectedProductOption.productId,
      productName: selectedProductOption.productName,
      routeId,
      routeName,
      sourceImportId: args.sourceImport?.importId,
      sourceRouteId: args.sourceRoute?.routeId,
      sourceFileName: args.sourceImport?.sourceFileName ?? String(args.sourceFiles.at(-1)?.fileName ?? ""),
      sourceFileType: args.sourceImport?.sourceType,
      sourceFileHash: args.sourceImport?.sourceFileHash,
      sourceGeometryId: endpointAuthority?.aSite.sourceGeometryId,
      sourceGeometryHash: commercialRouteGeometryHash(sourceGeometry),
      routeRevision,
      parentRouteRepositoryId: activeCommercialOpportunity?.routeRepositoryId,
      endpointAuthority,
      importedEvidence,
      immutableImportedEvidence: true,
      commercialGeometry,
      convertedRuntimeGeometry: commercialGeometry,
      simplifiedGeometry: simplifyRouteGeometry(commercialGeometry),
      renderedGeometryCache: commercialGeometry,
      boundingBox: geometryBoundingBox(commercialGeometry),
      routeFeet: args.routeFeet,
      routeMiles: args.routeMiles,
      length: {
        feet: args.routeFeet,
        miles: args.routeMiles,
      },
      aLocation: {
        label: endpointAuthority?.aSite.siteName || args.commercialDraft?.aLabel || `${routeName} A`,
        coordinate: endpointAuthority?.aSite.coordinate ?? first,
      },
      zLocation: {
        label: endpointAuthority?.zSite.siteName || args.commercialDraft?.zLabel || `${routeName} Z`,
        coordinate: endpointAuthority?.zSite.coordinate ?? last,
      },
      commercialDraftSnapshot: args.commercialDraft,
      selectedRouteSnapshot: args.sourceRoute,
      sourceImportSnapshot: args.sourceImport,
      routeSource: args.sourceImport ? "IMPORTED_EVIDENCE" : args.commercialDraft ? "COMMERCIAL_DRAFT" : "MANUAL",
      authority: "COMMERCIAL_ROUTE_REPOSITORY",
      noScopeVersionCreation: true,
      noInventoryMutation: true,
      createdAt: args.timestamp,
      updatedAt: args.timestamp,
    };
  }

  function buildCommercialOpportunityRecord(
    status: CommercialOpportunityStatus,
    options: {
      duplicate?: boolean;
      overrideName?: string;
      overrideImport?: CustomerDesignImport | null;
      overrideRoute?: ImportedCustomerRoute | null;
      overrideDraft?: CommercialCorridorDraft | null;
      sourceFile?: Record<string, unknown>;
      blank?: boolean;
    } = {},
  ): CommercialOpportunityRecord {
    const timestamp = new Date().toISOString();
    const existing = options.duplicate
      ? null
      : activeCommercialOpportunity ?? commercialOpportunities.find((record) => record.opportunityId === activeCommercialOpportunityId) ?? null;
    const hasExplicitImportedRouteSource = Boolean(options.overrideImport || options.overrideRoute || selectedImportedCustomerDesignImport || selectedImportedCustomerRoute);
    const pendingGeneratedRouteSnapshot = !options.blank && !options.duplicate && !hasExplicitImportedRouteSource ? generatedRouteRepositorySnapshot : null;
    const sourceImport = options.blank ? null : options.overrideImport ?? selectedImportedCustomerDesignImport ?? null;
    const sourceRoute = options.blank ? null : options.overrideRoute ?? selectedImportedCustomerRoute ?? null;
    const commercialDraft = options.blank ? null : options.overrideDraft ?? selectedImportedCommercialDraft ?? commercialCorridorDraft ?? loadedCommercialDraftSnapshot ?? pendingGeneratedRouteSnapshot?.commercialDraftSnapshot ?? null;
    const selectedCustomerDesignLabel = sourceImport && sourceRoute
      ? `${sourceImport.sourceFileName} / ${sourceRoute.name}`
      : undefined;
    const requestedName = options.overrideName ?? opportunityNameDraft ?? existing?.name ?? selectedCustomerDesignLabel ?? "";
    const opportunityName = customerAwareOpportunityName(requestedName, selectedAccount.name);
    const nextVersion = options.duplicate || !existing ? 1 : Math.max(1, Number(existing.version ?? 0) + 1);
    const recordIds = commercialRecordIdsForOpportunity(opportunityName, nextVersion, Boolean(demoGovernedIdContext));
    const opportunityId = existing?.opportunityId ?? pendingGeneratedRouteSnapshot?.opportunityId ?? governedClientId(`OPP-${recordIds.slug}-${Date.now()}`, demoGovernedIdContext);
    const canonicalProposalId = options.duplicate ? recordIds.proposalId : activeProposalRuntime?.proposalId ?? existing?.proposalId ?? recordIds.proposalId;
    const sourceFiles = [
      ...((existing?.sourceFiles ?? []) as Array<Record<string, unknown>>),
      ...(options.sourceFile ? [options.sourceFile] : []),
    ];
    const attachments = [
      ...((existing?.attachments ?? []) as Array<Record<string, unknown>>),
      ...(options.sourceFile ? [{ ...options.sourceFile, attachmentType: "SOURCE_ROUTE_FILE" }] : []),
    ];
    const routedGeometry = commercialRouteResult?.status === "ROUTED" ? dalGeometryFromCommercialRouteResult(commercialRouteResult) : [];
    const routeGeometry = options.blank
      ? []
      : commercialDraft?.geometry ??
        pendingGeneratedRouteSnapshot?.commercialGeometry ??
        (routedGeometry.length > 1 ? routedGeometry : undefined) ??
        geometryForImportedRoute(sourceRoute);
    const routeFeet = options.blank
      ? 0
      : commercialDraft?.routeFeet ??
        pendingGeneratedRouteSnapshot?.routeFeet ??
        sourceRoute?.routeFeet ??
        Math.round(selectedPricingSummary.reconciliation.routeFeet);
    const routeMiles = options.blank
      ? 0
      : commercialDraft?.routeMiles ??
        pendingGeneratedRouteSnapshot?.routeMiles ??
        sourceRoute?.routeMiles ??
        selectedPricingSummary.reconciliation.routeMiles;
    const sourceRouteFileReference = sourceImport?.sourceFileName ?? existing?.sourceRouteFileReference ?? String(options.sourceFile?.fileName ?? "");
    const generatedRouteSnapshotForSave = pendingGeneratedRouteSnapshot?.opportunityId === opportunityId
      ? routeSnapshotWithIntegrity({
          ...pendingGeneratedRouteSnapshot,
          opportunityId,
          commercialGeometry: routeGeometry.length > 1 ? routeGeometry : pendingGeneratedRouteSnapshot.commercialGeometry,
          convertedRuntimeGeometry: routeGeometry.length > 1 ? routeGeometry : pendingGeneratedRouteSnapshot.convertedRuntimeGeometry,
          simplifiedGeometry: simplifyRouteGeometry(routeGeometry.length > 1 ? routeGeometry : pendingGeneratedRouteSnapshot.commercialGeometry),
          renderedGeometryCache: routeGeometry.length > 1 ? routeGeometry : pendingGeneratedRouteSnapshot.renderedGeometryCache,
          boundingBox: geometryBoundingBox(routeGeometry.length > 1 ? routeGeometry : pendingGeneratedRouteSnapshot.commercialGeometry),
          routeFeet,
          routeMiles,
          length: {
            feet: routeFeet,
            miles: routeMiles,
          },
          commercialDraftSnapshot: commercialDraft ?? pendingGeneratedRouteSnapshot.commercialDraftSnapshot,
          updatedAt: timestamp,
        })
      : null;
    const routeRepositorySnapshot = options.blank ? null : generatedRouteSnapshotForSave ?? buildCommercialRouteRepositoryRecord({
      opportunityId,
      opportunityName,
      commercialDraft,
      sourceImport,
      sourceRoute,
      sourceFiles,
      routeGeometry,
      routeFeet,
      routeMiles,
      timestamp,
    });
    const routeRepositoryRef = routeRepositorySnapshot
      ? {
          routeRepositoryId: routeRepositorySnapshot.routeRepositoryId,
          routeSnapshotId: routeRepositorySnapshot.routeSnapshotId,
          routeId: routeRepositorySnapshot.routeId,
          routeName: routeRepositorySnapshot.routeName,
          repositoryType: "COMMERCIAL_ROUTE_REPOSITORY" as const,
        }
      : existing?.routeRepositoryRef;
    const attachmentMetadata = attachments.map(attachmentMetadataFromEvidence);
    const proposalStatus = accountAcceptedProposal ? "CUSTOMER_ACCEPTED" : proposalStatusLabel.toUpperCase().replace(/\s+/g, "_");
    const estimateSnapshot = {
      routeFeet,
      routeMiles,
      constructionCost: options.blank ? 0 : commercialDraft?.financialAuthority.constructionCost ?? selectedPricingSummary.reconciliation.budgetCost,
      costPerFoot: options.blank ? 0 : commercialDraft?.financialAuthority.costPerFoot ?? (routeFeet ? selectedPricingSummary.reconciliation.budgetCost / routeFeet : 0),
      costPerMile: options.blank ? 0 : commercialDraft?.financialAuthority.costPerMile ?? selectedPricingSummary.reconciliation.costPerMile,
      sellPrice: options.blank ? 0 : commercialDraft?.financialAuthority.sellPrice ?? selectedPricingSummary.reconciliation.sellPriceIru,
      sellPricePerFoot: options.blank ? 0 : commercialDraft?.financialAuthority.revenuePerFoot ?? (routeFeet ? selectedPricingSummary.reconciliation.sellPriceIru / routeFeet : 0),
      revenuePerMile: options.blank ? 0 : commercialDraft?.financialAuthority.revenuePerMile ?? selectedPricingSummary.reconciliation.revenuePerMile,
      mrc: options.blank ? 0 : commercialDraft?.financialAuthority.mrcRevenue ?? selectedPricingSummary.reconciliation.mrcRevenue,
      lifecycleValue: options.blank ? 0 : commercialDraft?.financialAuthority.lifecycleRevenue ?? selectedPricingSummary.reconciliation.lifecycleRevenue,
      grossMarginDollars: options.blank ? 0 : commercialDraft?.financialAuthority.grossMarginDollars ?? selectedPricingSummary.reconciliation.grossMarginDollars,
      grossMarginPercent: options.blank ? 0 : commercialDraft?.financialAuthority.grossMarginPercent ?? selectedPricingSummary.reconciliation.grossMarginPercent,
      confidence: commercialDraft?.transparentEstimate.confidence.score ?? opportunityScoutQuickQuote?.confidence ?? 0,
      transparentEstimate: commercialDraft?.transparentEstimate,
      status: options.blank ? "Not Started" : estimateStatusLabel,
      restoreAuthority: "OPPORTUNITY_SNAPSHOT",
    };
    const workbookSnapshot = {
      workbookId: recordIds.workbookId,
      sourceOpportunityId: opportunityId,
      sourceDraftIofPackage: displayedDraftIofPackage?.packageId ?? "DRAFT_IOF_PACKAGE_PLACEHOLDER",
      sourceRouteRepositoryId: routeRepositoryRef?.routeRepositoryId,
      sectionCount: 14,
      openSections: [...commercialWorkbookOpenSections],
      updatedAt: timestamp,
      restoreAuthority: "OPPORTUNITY_SNAPSHOT",
    };
    const proposalPreviewSnapshot = existing?.proposalPreview && !options.duplicate
      ? {
          ...existing.proposalPreview,
          proposalPreviewId: recordIds.proposalPreviewId,
          proposalId: canonicalProposalId,
          revision: `v${nextVersion}`,
          updatedAt: timestamp,
        }
      : {
          proposalPreviewId: recordIds.proposalPreviewId,
          templateId: TemplateRepository.proposalTemplateId(),
          proposalId: canonicalProposalId,
          customer: selectedAccount.name,
          opportunity: opportunityName,
          product: selectedProductOption.productName,
          routeSummary: `${formatRouteMiles(routeMiles)} mi / ${Math.round(routeFeet).toLocaleString()} ft`,
          sourceFile: sourceRouteFileReference || "None",
          status: proposalStatus,
          revision: `v${nextVersion}`,
          generatedAt: timestamp,
          restoreAuthority: "OPPORTUNITY_SNAPSHOT",
        };
    const serviceOrderPreviewSnapshot = existing?.serviceOrderPreview && !options.duplicate
      ? {
          ...existing.serviceOrderPreview,
          serviceOrderPreviewId: recordIds.serviceOrderPreviewId,
          sourceOpportunityId: opportunityId,
          sourceProposalId: canonicalProposalId,
          updatedAt: timestamp,
        }
      : {
          serviceOrderPreviewId: recordIds.serviceOrderPreviewId,
          templateId: TemplateRepository.serviceOrderTemplateId(),
          sourceOpportunityId: opportunityId,
          sourceProposalId: canonicalProposalId,
          certifiedDraftIofPackage: displayedDraftIofPackage?.status === "CERTIFIED" ? displayedDraftIofPackage.packageId : "CERTIFIED_PACKAGE_PLACEHOLDER",
          legalBusinessTerms: "Commercial Release 2 placeholder",
          noScopeVersionCreation: true,
          updatedAt: timestamp,
          restoreAuthority: "OPPORTUNITY_SNAPSHOT",
        };
    const commercialOverrides = commercialDoctrineOverrideRows.filter((row) => row.source === "HUMAN_OVERRIDE") as unknown as Array<Record<string, unknown>>;
    const constructionMixSnapshot = { ...(commercialDraft?.constructionMix ?? selectedAssumptionState.civilMix) } as Record<string, unknown>;
    const riskSnapshot = [
      ...(commercialDraft?.financialValidationWarnings ?? []),
      ...((commercialDraft?.unknownQuantities ?? []).map((item) => item.label)),
    ].filter(Boolean);
    const commercialWorkingState = {
      schemaVersion: "CIP-067",
      opportunityId,
      accountId: selectedAccount.accountId,
      customerTwinId: accountCustomerTwin?.customerTwinId ?? `CUSTOMER-TWIN-${selectedAccount.accountId}`,
      product: {
        productId: selectedProductOption.productId,
        productName: selectedProductOption.productName,
        productDoctrineId: selectedProductDoctrine?.doctrineId,
        productDoctrineVersion: selectedProductDoctrine?.doctrineVersion,
        productDoctrineHash: selectedProductDoctrine ? POINT_TO_POINT_LONG_HAUL_DOCTRINE_HASH : undefined,
      },
      route: routeRepositorySnapshot ? {
        routeRepositoryId: routeRepositorySnapshot.routeRepositoryId,
        routeRevision: routeRepositorySnapshot.routeRevision,
        routeGeometryId: routeRepositorySnapshot.routeGeometryId,
        geometryHash: routeRepositorySnapshot.geometryHash,
      } : null,
      assumptionState: selectedAssumptionState,
      civilMixCalibration: selectedCivilMixCalibration,
      estimateControls: transparentEstimateControls,
      estimate: estimateSnapshot,
      economics: {
        constructionCost: estimateSnapshot.constructionCost,
        sellPrice: estimateSnapshot.sellPrice,
        mrc: estimateSnapshot.mrc,
        lifecycleValue: estimateSnapshot.lifecycleValue,
        grossMarginDollars: estimateSnapshot.grossMarginDollars,
        grossMarginPercent: estimateSnapshot.grossMarginPercent,
        termMonths: selectedProductOption.defaultTermYears * 12,
      },
      quantities: commercialDraft?.transparentEstimate.physicalQuantities ?? {},
      assumptions: commercialOverrides,
      specifications: transparentEstimateControls.projectConfiguration,
      commercialRequirements: selectedScope.routeRequirementIds,
      customerRequirements: {
        proposalRecipientContactIds,
        customerReviewContactIds,
        approvalAuthorityContactIds,
        sofRecipientContactIds,
      },
      proposalReferences: {
        proposalId: activeProposalRuntime?.proposalId ?? existing?.proposalId ?? canonicalProposalId,
        proposalRevisionId: activeProposalRuntime?.proposalRevisionId ?? existing?.proposalRevisionId ?? null,
        proposalHash: activeProposalRuntime?.proposalHash ?? existing?.proposalHash ?? null,
      },
      currentLifecycleState: existing?.state ?? existing?.status ?? status,
      updatedAt: timestamp,
    };
    const revisionHistory = RevisionRepository.appendRevision(
      { revisionHistory: (existing?.revisionHistory ?? []) as Array<Record<string, unknown>> },
      {
        revision: `v${nextVersion}`,
        event: options.duplicate ? "SAVE_AS" : existing ? "SAVE" : "CREATE",
        opportunityId,
        opportunityName,
        proposalId: canonicalProposalId,
        workbookId: recordIds.workbookId,
        serviceOrderPreviewId: recordIds.serviceOrderPreviewId,
        routeId: routeRepositoryRef?.routeId ?? commercialDraft?.routeId ?? sourceRoute?.routeId ?? selectedScope.scopeId,
        routeRepositoryId: routeRepositoryRef?.routeRepositoryId,
        sourceFileName: sourceRouteFileReference || undefined,
        createdAt: timestamp,
        actor: currentUserName,
      },
    ).revisionHistory ?? [];
    return {
      opportunityId,
      objectId: existing?.objectId ?? opportunityId,
      runtimeObjectId: existing?.runtimeObjectId ?? `RUNTIME-OPPORTUNITY-${opportunityId}`,
      objectType: "OPPORTUNITY",
      accountId: selectedAccount.accountId,
      customerId: customerIdForAccount(selectedAccount.accountId),
      name: opportunityName,
      status,
      productId: selectedProductOption.productId,
      productName: selectedProductOption.productName,
      productDoctrineId: selectedProductDoctrine?.doctrineId,
      productDoctrineVersion: selectedProductDoctrine?.doctrineVersion,
      productDoctrineHash: selectedProductDoctrine ? POINT_TO_POINT_LONG_HAUL_DOCTRINE_HASH : undefined,
      doctrineVersion: selectedProductDoctrine?.doctrineVersion,
      customerSnapshot: {
        accountId: selectedAccount.accountId,
        customerId: customerIdForAccount(selectedAccount.accountId),
        name: selectedAccount.name,
        accountType: selectedAccount.accountType,
        status: selectedAccount.status,
        salesOwner: selectedAccount.salesOwner,
        contacts: selectedAccount.contacts,
      },
      customerTwinReference: accountCustomerTwin?.customerTwinId ?? `CUSTOMER-TWIN-${selectedAccount.accountId}`,
      customerTwinId: accountCustomerTwin?.customerTwinId ?? `CUSTOMER-TWIN-${selectedAccount.accountId}`,
      routeRepositoryId: routeRepositoryRef?.routeRepositoryId,
      routeRepositoryRef,
      routeRepositorySnapshot,
      routeName: routeRepositoryRef?.routeName ?? commercialDraft?.routeId ?? sourceRoute?.name ?? currentDraftLabel,
      routeGeometry: routeRepositorySnapshot?.commercialGeometry ?? routeGeometry,
      routeFeet,
      routeMiles,
      routeRevision: routeRepositorySnapshot?.routeRevision,
      routeGeometryId: routeRepositorySnapshot?.routeGeometryId,
      geometryHash: routeRepositorySnapshot?.geometryHash,
      aSite: routeRepositorySnapshot?.endpointAuthority?.aSite ?? routeRepositorySnapshot?.aLocation,
      zSite: routeRepositorySnapshot?.endpointAuthority?.zSite ?? routeRepositorySnapshot?.zLocation,
      sourceRouteFileReference,
      sourceFiles,
      attachments,
      attachmentMetadata,
      estimate: estimateSnapshot,
      commercialWorkbook: workbookSnapshot,
      doctrineAssumptions: {
        assumptionStateId: selectedAssumptionState.stateId,
        label: selectedAssumptionState.label,
        productDoctrineId: selectedProductDoctrine?.doctrineId,
        productDoctrineVersion: selectedProductDoctrine?.doctrineVersion,
        commercialValuesOnly: true,
      },
      humanOverrides: commercialOverrides,
      commercialOverrides,
      constructionMixSnapshot,
      riskSnapshot,
      commercialNotes: existing?.commercialNotes ?? "",
      commercialWorkingState,
      importedEvidenceReferences: routeRepositorySnapshot?.importedEvidence ?? [],
      restoreSnapshotVersion: "CIP-014C",
      commercialSnapshot: {
        snapshotVersion: "CIP-014C",
        opportunityId,
        routeRepositoryId: routeRepositoryRef?.routeRepositoryId,
        customerTwinReference: accountCustomerTwin?.customerTwinId ?? `CUSTOMER-TWIN-${selectedAccount.accountId}`,
        productId: selectedProductOption.productId,
        productName: selectedProductOption.productName,
        productDoctrineId: selectedProductDoctrine?.doctrineId,
        productDoctrineVersion: selectedProductDoctrine?.doctrineVersion,
        productDoctrineHash: selectedProductDoctrine ? POINT_TO_POINT_LONG_HAUL_DOCTRINE_HASH : undefined,
        doctrineVersion: selectedProductDoctrine?.doctrineVersion,
        estimate: estimateSnapshot,
        workbook: workbookSnapshot,
        proposalPreview: proposalPreviewSnapshot,
        serviceOrderPreview: serviceOrderPreviewSnapshot,
        commercialOverrides,
        constructionMix: constructionMixSnapshot,
        commercialWorkingState,
        risks: riskSnapshot,
        attachments: attachmentMetadata,
        importedEvidenceReferences: routeRepositorySnapshot?.importedEvidence ?? [],
        updatedAt: timestamp,
      },
      proposalId: canonicalProposalId,
      proposalPreviewId: recordIds.proposalPreviewId,
      proposalStatus,
      proposalPreview: proposalPreviewSnapshot,
      workbookId: recordIds.workbookId,
      serviceOrderPreviewId: recordIds.serviceOrderPreviewId,
      serviceOrderPreview: serviceOrderPreviewSnapshot,
      revisionHistory,
      owner: existing?.owner ?? currentUserName,
      ownerId: existing?.ownerId ?? currentUserId,
      createdBy: existing?.createdBy ?? currentUserName,
      createdById: existing?.createdById ?? currentUserId,
      assignedTo: existing?.assignedTo ?? [],
      assignment: existing?.assignment ?? {
        owner: currentUserId,
        contributors: [],
        reviewers: [],
        approvers: [],
        executives: [],
      },
      organization: existing?.organization ?? "Teralinx",
      organizationId: existing?.organizationId ?? currentOrganizationId,
      workspace: existing?.workspace ?? currentWorkspaceId,
      workspaceId: existing?.workspaceId ?? currentWorkspaceId,
      visibility: existing?.visibility ?? "PRIVATE",
      authority: existing?.authority ?? {
        owner: currentUserId,
        contributors: [],
        reviewers: [],
        approvers: [],
        executives: [],
        sharedWith: [],
      },
      lifecycleState: status === "ARCHIVED" ? "ARCHIVED" : "ACTIVE",
      version: existing?.version ?? 1,
      evidenceLinks: existing?.evidenceLinks ?? [],
      relationshipLinks: existing?.relationshipLinks ?? [],
      createdDate: existing?.createdDate ?? timestamp,
      modifiedDate: timestamp,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
      selectedImportId: sourceImport?.importId,
      selectedRouteId: sourceRoute?.routeId,
      selectedScopeId: selectedScope.scopeId,
      activeView,
      commercialDraftType,
      liveSession: options.blank ? null : activeLiveSession,
      commercialDraftSnapshot: routeRepositorySnapshot?.commercialDraftSnapshot ?? commercialDraft,
      customerDesignImportSnapshot: routeRepositorySnapshot?.sourceImportSnapshot ?? sourceImport,
      selectedRouteSnapshot: routeRepositorySnapshot?.selectedRouteSnapshot ?? sourceRoute,
      selectedCustomerDesignLabel,
      importedDraftRouteId: commercialDraft?.routeId,
      snapshotCount: accountSnapshots.length,
      note: selectedCustomerDesignLabel
        ? "Opportunity attaches a Customer Design Library route intentionally. No ScopeVersion authority created."
        : "Opportunity saved from Commercial Planning working state. No ScopeVersion authority created.",
      noScopeVersionCreation: true,
      noInventoryMutation: true,
    };
  }

  async function upsertCommercialOpportunity(record: CommercialOpportunityRecord) {
    const transactionId = `ROUTE-OPPORTUNITY-SAVE-${record.opportunityId}-${Date.now()}`;
    const previousRecord = activeCommercialOpportunity?.opportunityId === record.opportunityId ? activeCommercialOpportunity : null;
    let opportunityPersisted = false;
    setRoutePersistencePending(true);
    const sharedRecord = {
      ...record,
      organization: "Teralinx",
      organizationId: currentOrganizationId,
      workspaceId: record.workspaceId ?? currentWorkspaceId,
      savedBy: currentUserName,
      savedById: currentUserId,
      transactionId,
    };
    try {
      appendRoutePersistenceAudit("Save Opportunity", "START", {
        message: "Saving Opportunity...",
        opportunityId: sharedRecord.opportunityId,
        routeRepositoryId: sharedRecord.routeRepositoryId ?? sharedRecord.routeRepositoryRef?.routeRepositoryId ?? sharedRecord.routeRepositorySnapshot?.routeRepositoryId ?? "",
      });
      let routeSnapshot = sharedRecord.routeRepositorySnapshot ?? generatedRouteRepositorySnapshot ?? null;
      if (routeSnapshot) routeSnapshot = { ...routeSnapshotWithIntegrity(routeSnapshot), transactionId };
      if (opportunityRequiresRouteTransaction(sharedRecord)) {
        if (!routeSnapshot) throw new Error("Save Opportunity preflight: missing Route Repository snapshot.");
        requireRouteSnapshotIntegrity(routeSnapshot, "Save Opportunity preflight");
        appendRoutePersistenceAudit("Save Opportunity preflight", "SUCCESS", {
          routeRepositoryId: routeSnapshot.routeRepositoryId,
          geometryExists: "YES",
          geometryHash: routeSnapshot.geometryHash,
          estimateExists: hasObjectPayload(sharedRecord.estimate) ? "YES" : "NO",
          workbookExists: hasObjectPayload(sharedRecord.commercialWorkbook) ? "YES" : "NO",
        });
        appendRoutePersistenceAudit("Route Repository", "START", {
          message: "Verifying Route Repository before Opportunity save...",
          routeRepositoryId: routeSnapshot.routeRepositoryId,
          vertexCount: routeSnapshot.commercialGeometry.length,
          miles: routeSnapshot.routeMiles,
          geometryHash: routeSnapshot.geometryHash,
        });
        routeSnapshot = routeSnapshotWithIntegrity(await RouteRepository.saveRoute(routeSnapshot, session));
        const verifiedRouteSnapshot = routeSnapshotWithIntegrity(await RouteRepository.verifyRoute(routeSnapshot.routeRepositoryId, { geometryHash: routeSnapshot.geometryHash }, session));
        requireRouteSnapshotIntegrity(verifiedRouteSnapshot, "Save Opportunity Route Repository verification");
        if (routeSnapshotHash(verifiedRouteSnapshot) !== routeSnapshotHash(routeSnapshot)) {
          throw new Error("Route Repository verification failed before Opportunity save: geometry hash changed after reload.");
        }
        routeSnapshot = verifiedRouteSnapshot;
        appendRoutePersistenceAudit("Route Repository", "SUCCESS", {
          routeRepositoryId: routeSnapshot.routeRepositoryId,
          geometrySaved: "YES",
          vertexCount: routeSnapshot.commercialGeometry.length,
          miles: routeSnapshot.routeMiles,
          status: "SUCCESS",
        });
        sharedRecord.routeRepositorySnapshot = routeSnapshot;
        sharedRecord.routeRepositoryId = routeSnapshot.routeRepositoryId;
        sharedRecord.routeRepositoryRef = {
          routeRepositoryId: routeSnapshot.routeRepositoryId,
          routeSnapshotId: routeSnapshot.routeSnapshotId,
          routeId: routeSnapshot.routeId,
          routeName: routeSnapshot.routeName,
          repositoryType: "COMMERCIAL_ROUTE_REPOSITORY",
        };
        sharedRecord.routeGeometry = routeSnapshot.commercialGeometry;
        sharedRecord.routeFeet = routeSnapshot.routeFeet;
        sharedRecord.routeMiles = routeSnapshot.routeMiles;
        sharedRecord.commercialDraftSnapshot = routeSnapshot.commercialDraftSnapshot ?? sharedRecord.commercialDraftSnapshot;
        sharedRecord.selectedRouteSnapshot = routeSnapshot.selectedRouteSnapshot ?? sharedRecord.selectedRouteSnapshot;
        sharedRecord.customerDesignImportSnapshot = routeSnapshot.sourceImportSnapshot ?? sharedRecord.customerDesignImportSnapshot;
        sharedRecord.importedEvidenceReferences = routeSnapshot.importedEvidence;
      }
      const preSaveFailures = validateOpportunityBeforeSave(sharedRecord);
      if (preSaveFailures.length) throw new Error(preSaveFailures.join(" "));
      appendRoutePersistenceAudit("Save Opportunity", "INFO", {
        opportunityId: sharedRecord.opportunityId,
        routeRepositoryId: sharedRecord.routeRepositoryId ?? "",
        geometryExists: hasCoordinateGeometry(sharedRecord.routeGeometry) ? "YES" : "NO",
        estimateExists: hasObjectPayload(sharedRecord.estimate) ? "YES" : "NO",
        workbookExists: hasObjectPayload(sharedRecord.commercialWorkbook) ? "YES" : "NO",
      });
      const opportunityRepositoryRecord = opportunityRecordForRepository(sharedRecord);
      const saved = await OpportunityRepository.saveOpportunity(opportunityRepositoryRecord, session);
      opportunityPersisted = true;
      appendRoutePersistenceAudit("Save Opportunity", "SUCCESS", {
        opportunityId: saved.opportunityId,
        routeRepositoryId: saved.routeRepositoryId ?? saved.routeRepositoryRef?.routeRepositoryId ?? "",
        commit: "SUCCESS",
      });
      const verification = await verifySavedOpportunityTransaction(saved, routeSnapshot?.routeRepositoryId ? routeSnapshot : null);
      const committedOpportunity = hydrateOpportunityFromRouteRepository(verification.reloadedOpportunity, verification.reloadedRoute);
      setCommercialOpportunities((prev) => [committedOpportunity, ...prev.filter((candidate) => candidate.opportunityId !== committedOpportunity.opportunityId)]);
      setActiveCommercialOpportunityId(committedOpportunity.opportunityId);
      if (verification.reloadedRoute) {
        setGeneratedRouteRepositorySnapshot(verification.reloadedRoute);
        setCommercialRouteRepositoryRecords((prev) => [verification.reloadedRoute as CommercialRouteRepositoryRecord, ...prev.filter((route) => route.routeRepositoryId !== verification.reloadedRoute?.routeRepositoryId)]);
      }
      setOpportunityNotice(`${committedOpportunity.name} saved and verified from repository.`);
      appendRoutePersistenceAudit("Commit", "SUCCESS", {
        opportunityId: committedOpportunity.opportunityId,
        routeRepositoryId: committedOpportunity.routeRepositoryId ?? "",
        geometryHash: routeSnapshotHash(verification.reloadedRoute),
        status: "SUCCESS",
      });
      void recordActivity({
        action: record.status === "ARCHIVED" ? "archived opportunity" : "saved opportunity",
        objectType: "Opportunity",
        objectId: committedOpportunity.opportunityId,
        objectName: committedOpportunity.name,
        revision: committedOpportunity.commercialDraftSnapshot?.routeId ?? committedOpportunity.importedDraftRouteId ?? committedOpportunity.selectedScopeId,
        opportunityId: committedOpportunity.opportunityId,
        customerId: committedOpportunity.accountId,
        details: committedOpportunity.routeRepositoryId
          ? "Opportunity and Commercial Route Repository snapshot persisted, reloaded, and hash-verified from governed Commercial repositories."
          : "Opportunity persisted to the shared Teralinx Opportunity Library.",
      });
      return committedOpportunity;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      appendRoutePersistenceAudit("Rollback", "FAIL", {
        opportunityId: sharedRecord.opportunityId,
        routeRepositoryId: sharedRecord.routeRepositoryId ?? sharedRecord.routeRepositoryRef?.routeRepositoryId ?? "",
        opportunityPersisted,
        reason,
      });
      if (opportunityPersisted && previousRecord) {
        try {
          await OpportunityRepository.saveOpportunity(opportunityRecordForRepository(previousRecord), session);
          appendRoutePersistenceAudit("Rollback", "SUCCESS", {
            opportunityId: previousRecord.opportunityId,
            restoredPreviousSnapshot: "YES",
          });
        } catch (rollbackError) {
          appendRoutePersistenceAudit("Rollback", "WARNING", {
            opportunityId: previousRecord.opportunityId,
            restoredPreviousSnapshot: "NO",
            reason: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
          });
        }
      }
      setOpportunityNotice(`Opportunity save aborted. ${reason}`);
      return null;
    } finally {
      setRoutePersistencePending(false);
    }
  }

  function promptCommercialOpportunityName(action: string, fallback: string) {
    if (typeof window === "undefined") return fallback;
    const entered = window.prompt(`${action} opportunity name`, fallback);
    return entered === null ? "" : customerAwareOpportunityName(entered, selectedAccount.name);
  }

  function handleNewCommercialOpportunity() {
    const defaultName = customerAwareOpportunityName(`${selectedAccount.name === "Google" ? "DFW Route" : "Opportunity"} ${accountCommercialOpportunities.length + 1}`, selectedAccount.name);
    const name = promptCommercialOpportunityName("New", defaultName);
    if (!name) return;
    setOpportunityRestoreState(createOpportunityRestoreState());
    resetCommercialOpportunityWorkingState();
    setOpportunityNameDraft(name);
    void upsertCommercialOpportunity(buildCommercialOpportunityRecord("SAVED", { duplicate: true, overrideName: name, blank: true }));
    setOpportunityNotice("New Opportunity started. Customer Twin is visible; no design or draft is loaded.");
    setNewOpportunityDialogOpen(true);
    setOpportunityWorkflowState("SELECTING_START_MODE");
  }

  function handleSaveCommercialOpportunity() {
    if (temporaryImportedRoute) {
      void handleSaveTemporaryImportedRoute();
      return;
    }
    if (activeCommercialOpportunity && !canModifyActiveOpportunity) {
      setOpportunityNotice("You cannot modify this Opportunity unless you own it or have contributor/approver authority.");
      return;
    }
    void upsertCommercialOpportunity(buildCommercialOpportunityRecord("SAVED", { overrideName: opportunityNameDraft }));
  }

  function handleSaveAsCommercialOpportunity() {
    if (temporaryImportedRoute) {
      void handleSaveTemporaryImportedRoute({ duplicate: true });
      return;
    }
    const fallback = `${opportunityNameDraft || activeCommercialOpportunity?.name || selectedAccount.name} Copy`;
    const name = promptCommercialOpportunityName("Save As", fallback);
    if (!name) return;
    setOpportunityNameDraft(name);
    void upsertCommercialOpportunity(buildCommercialOpportunityRecord("SAVED", { duplicate: true, overrideName: name }));
  }

  function handleOpenCustomerDesignFromLibrary(importId: string, routeId: string) {
    resetCommercialOpportunityWorkingState({ preserveActiveOpportunity: true });
    const entry = customerDesignImports
      .filter((record) => record.accountId === selectedAccount.accountId || record.accountId === activeCommercialOpportunity?.accountId)
      .flatMap((record) => record.routes.map((route) => ({ importRecord: record, route })))
      .find((item) => item.importRecord.importId === importId && item.route.routeId === routeId);
    if (!entry) {
      setOpportunityNotice("Customer Design Library record was not found for this account.");
      return;
    }
    setSelectedCustomerDesignImportId(importId);
    setSelectedCustomerDesignRouteId(routeId);
    setCommercialDraftType("NEW_GRAPH_CORRIDOR");
    setActiveDesignMode("CUSTOMER_PROPOSAL_REVIEW");
    setActiveView("proposal");
    setOpportunityWorkflowState(entry.route.pricedDraft ? "COMMERCIAL_DRAFT_ACTIVE" : "IDLE");
    if (entry.route.pricedDraft) {
      setImportedCommercialDraft(entry.route.pricedDraft);
      setSelectedCommercialCorridorDraft(entry.route.pricedDraft);
    }
    setOpportunityNotice(`Customer Design loaded: ${entry.importRecord.designId} / ${entry.route.name}.`);
  }

  async function handleOpenCommercialOpportunity(opportunityId: string) {
    if (!opportunityId) return;
    const localRecord = commercialOpportunities.find((candidate) => candidate.opportunityId === opportunityId);
    const restoreRunId = opportunityRestoreRunRef.current + 1;
    opportunityRestoreRunRef.current = restoreRunId;
    const initialName = localRecord?.name ?? opportunityId;
    const initialRestoreState = createOpportunityRestoreState("RESTORING", opportunityId, initialName);
    setOpportunityRestoreState({
      ...initialRestoreState,
      log: [
        `Opening ${initialName}`,
        "Opening Opportunity",
      ],
    });
    appendRoutePersistenceAudit("Opening Opportunity", "START", {
      opportunityId,
      opportunityName: initialName,
    });
    setOpportunityNotice(`Opening ${initialName} from Opportunity Repository...`);
    const restoreMetric = startRuntimePerformanceOperation("workspace-restore", "RESTORE", {
      opportunityId,
      opportunityName: initialName,
    });

    const updateRestore = (updater: (state: OpportunityRestoreState) => OpportunityRestoreState) => {
      if (opportunityRestoreRunRef.current !== restoreRunId) return;
      setOpportunityRestoreState((prev) => updater(prev));
    };
    const addRestoreLog = (line: string) => updateRestore((prev) => ({ ...prev, log: [...prev.log, line] }));
    const markRestoreStep = (stepId: OpportunityRestoreStepId, status: OpportunityRestoreStepStatus, reason?: string) => updateRestore((prev) => ({
      ...prev,
      steps: prev.steps.map((step) => step.id === stepId ? { ...step, status, reason } : step),
    }));
    const addRestoreWarning = (warning: string) => updateRestore((prev) => ({
      ...prev,
      warnings: prev.warnings.includes(warning) ? prev.warnings : [...prev.warnings, warning],
    }));

    let record: CommercialOpportunityRecord;
    try {
      markRestoreStep("repository", "LOADING");
      addRestoreLog("Repository loads...");
      record = await OpportunityRepository.openOpportunity<CommercialOpportunityRecord>(opportunityId, session);
      if (opportunityRestoreRunRef.current !== restoreRunId) return;
      markRestoreStep("repository", "OK");
      addRestoreLog("OK");
      setOpportunityRestoreState((prev) => ({
        ...prev,
        opportunityId: record.opportunityId,
        opportunityName: record.name,
      }));
      appendRoutePersistenceAudit("Opening Opportunity", "INFO", {
        opportunityId: record.opportunityId,
        routeRepositoryId: record.routeRepositoryRef?.routeRepositoryId ?? record.routeRepositoryId ?? record.routeRepositorySnapshot?.routeRepositoryId ?? "",
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      markRestoreStep("repository", "FAILED", reason);
      addRestoreLog("FAILED");
      addRestoreLog(`Reason: ${reason}`);
      setOpportunityRestoreState((prev) => ({
        ...prev,
        status: "FAILED",
        fatalError: `Unable to restore Opportunity from Repository. Reason: ${reason}`,
        completedAt: new Date().toISOString(),
      }));
      const failedRestore = restoreMetric.end({ workerStatus: "RESTORE_FAILED" });
      setRuntimePerformance((prev) => runtimePerformanceSnapshot({
        ...prev,
        workspaceRestoreMs: failedRestore.durationMs,
        workerStatus: "RESTORE_FAILED",
      }));
      runtimeDiagnosticsWarn("RuntimePerformance", {
        operation: "workspace-restore",
        opportunityId,
        reason,
      });
      setOpportunityNotice(`Unable to restore Opportunity from Repository: ${reason}`);
      return;
    }

    let routeSnapshot: CommercialRouteRepositoryRecord | null = null;
    let routeRepositoryId = record.routeRepositoryRef?.routeRepositoryId ?? record.routeRepositoryId ?? record.routeRepositorySnapshot?.routeRepositoryId ?? "";
    if (!routeRepositoryId) {
      appendRoutePersistenceAudit("Route Repository relationship repair", "START", {
        opportunityId: record.opportunityId,
        routeRepositoryId: "",
        source: "RouteRepository.listRoutes",
      });
      try {
        const repositoryRoutes = await RouteRepository.listRoutes(session);
        if (opportunityRestoreRunRef.current !== restoreRunId) return;
        setCommercialRouteRepositoryRecords(repositoryRoutes.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))));
        const candidateRoute = newestRouteForOpportunity(repositoryRoutes, record.opportunityId);
        if (candidateRoute) {
          routeSnapshot = routeSnapshotWithIntegrity(candidateRoute);
          routeRepositoryId = routeSnapshot.routeRepositoryId;
          record = hydrateOpportunityFromRouteRepository(record, routeSnapshot);
          const repairedRecord = opportunityRecordForRepository(record);
          await OpportunityRepository.saveOpportunity(repairedRecord, session);
          appendRoutePersistenceAudit("Route Repository relationship repair", "SUCCESS", {
            opportunityId: record.opportunityId,
            routeRepositoryId,
            geometryHash: routeSnapshot.geometryHash,
            relationshipCommitted: "YES",
          });
        } else {
          appendRoutePersistenceAudit("Route Repository relationship repair", "FAIL", {
            opportunityId: record.opportunityId,
            routeRepositoryId: "",
            reason: "No Route Repository record matched opportunityId.",
          });
        }
      } catch (error) {
        appendRoutePersistenceAudit("Route Repository relationship repair", "FAIL", {
          opportunityId: record.opportunityId,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }
    markRestoreStep("route-repository", "LOADING");
    addRestoreLog("Loading Route Repository...");
    appendRoutePersistenceAudit("Loading Route Repository", "START", {
      opportunityId: record.opportunityId,
      routeRepositoryId,
    });
    if (routeRepositoryId) {
      try {
        routeSnapshot = routeSnapshotWithIntegrity(await RouteRepository.loadRoute(routeRepositoryId, session));
        requireRouteSnapshotIntegrity(routeSnapshot, "Open Opportunity Route Repository");
        if (opportunityRestoreRunRef.current !== restoreRunId) return;
        record = hydrateOpportunityFromRouteRepository(record, routeSnapshot);
        setGeneratedRouteRepositorySnapshot(routeSnapshot);
        markRestoreStep("route-repository", "OK");
        addRestoreLog("OK");
        appendRoutePersistenceAudit("Loading Route Repository", "SUCCESS", {
          routeRepositoryId,
          geometryLoaded: "YES",
          vertexCount: routeSnapshot.commercialGeometry.length,
          lengthMiles: routeSnapshot.routeMiles,
          geometryHash: routeSnapshot.geometryHash,
        });
      } catch (error) {
        if (opportunityRestoreRunRef.current !== restoreRunId) return;
        const reason = error instanceof Error ? error.message : String(error);
        routeSnapshot = record.routeRepositorySnapshot ? routeSnapshotWithIntegrity(record.routeRepositorySnapshot) : null;
        record = hydrateOpportunityFromRouteRepository(record, routeSnapshot);
        if (routeSnapshot) setGeneratedRouteRepositorySnapshot(routeSnapshot);
        const warning = restoreWarningText("Route Repository", routeSnapshot ? `${reason}. Using embedded repository snapshot.` : reason);
        markRestoreStep("route-repository", routeSnapshot ? "WARNING" : "FAILED", reason);
        addRestoreWarning(warning);
        addRestoreLog(routeSnapshot ? "FAILED" : "FAILED");
        addRestoreLog(`Reason: ${reason}`);
        addRestoreLog(routeSnapshot ? "Continuing with embedded route repository snapshot..." : "Continuing...");
        appendRoutePersistenceAudit("Loading Route Repository", routeSnapshot ? "WARNING" : "FAIL", {
          routeRepositoryId,
          geometryLoaded: routeSnapshot ? "EMBEDDED" : "NO",
          reason,
        });
      }
    } else if (record.routeRepositorySnapshot) {
      routeSnapshot = routeSnapshotWithIntegrity(record.routeRepositorySnapshot);
      record = hydrateOpportunityFromRouteRepository(record, routeSnapshot);
      markRestoreStep("route-repository", "WARNING", "Missing route repository reference; using embedded route repository snapshot.");
      addRestoreWarning(restoreWarningText("Route Repository", "Missing route repository reference; using embedded route repository snapshot."));
      addRestoreLog("FAILED");
      addRestoreLog("Reason: Missing route repository reference; using embedded route repository snapshot.");
      addRestoreLog("Continuing...");
      appendRoutePersistenceAudit("Loading Route Repository", "WARNING", {
        routeRepositoryId: routeSnapshot.routeRepositoryId,
        geometryLoaded: "EMBEDDED",
        reason: "Missing route repository reference; using embedded route repository snapshot.",
      });
    } else {
      markRestoreStep("route-repository", "WARNING", "Missing Route Repository reference.");
      addRestoreWarning(restoreWarningText("Route Repository", "Missing Route Repository reference."));
      addRestoreLog("FAILED");
      addRestoreLog("Reason: Missing Route Repository reference.");
      addRestoreLog("Continuing...");
      appendRoutePersistenceAudit("Loading Route Repository", "FAIL", {
        opportunityId: record.opportunityId,
        routeRepositoryId: "",
        geometryLoaded: "NO",
        reason: "Missing Route Repository reference.",
      });
    }

    const validation = validateOpportunityRestoreRecord(record);
    markRestoreStep("validation", "LOADING");
    addRestoreLog("Validate...");
    if (validation.warnings.length) {
      markRestoreStep("validation", "WARNING", `${validation.warnings.length} restore warning(s)`);
      validation.warnings.forEach((warning) => {
        addRestoreLog(`Validation warning: ${warning.label} - ${warning.reason}`);
      });
    } else {
      markRestoreStep("validation", "OK");
      addRestoreLog("OK");
    }
    markRestoreStep("restore", "LOADING");
    addRestoreLog("Restore...");
    markRestoreStep("restore", "OK");
    addRestoreLog("OK");

    const runRestoreStep = async (
      stepId: OpportunityRestoreStepId,
      label: string,
      restore: () => void | Promise<void>,
    ) => {
      markRestoreStep(stepId, "LOADING");
      addRestoreLog(`Loading ${label}...`);
      try {
        await restore();
        if (opportunityRestoreRunRef.current !== restoreRunId) return;
        markRestoreStep(stepId, "OK");
        addRestoreLog("OK");
        appendRoutePersistenceAudit(`Open Opportunity / ${label}`, "SUCCESS", {
          opportunityId: record.opportunityId,
          routeRepositoryId: record.routeRepositoryId ?? record.routeRepositoryRef?.routeRepositoryId ?? "",
          status: `${label} Restored`,
        });
      } catch (error) {
        if (opportunityRestoreRunRef.current !== restoreRunId) return;
        const reason = error instanceof Error ? error.message : String(error);
        const warning = restoreWarningText(label, reason);
        markRestoreStep(stepId, "WARNING", reason);
        addRestoreWarning(warning);
        addRestoreLog("FAILED");
        addRestoreLog(`Reason: ${reason}`);
        addRestoreLog("Continuing...");
        appendRoutePersistenceAudit(`Open Opportunity / ${label}`, "WARNING", {
          opportunityId: record.opportunityId,
          reason,
        });
      }
    };

    await runRestoreStep("map", "Map", () => {
      resetCommercialOpportunityWorkingState({ preserveActiveOpportunity: true });
      const workingState = objectRecord(record.commercialWorkingState);
      const workingProduct = objectRecord(workingState?.product);
      const restoredProductId = String(workingProduct?.productId ?? record.productId ?? "");
      if (restoredProductId && LAYER_1_PRODUCT_OPTIONS.some((product) => product.productId === restoredProductId)) {
        setSelectedProductId(restoredProductId);
      }
      const restoredAssumptionState = objectRecord(workingState?.assumptionState);
      if (restoredAssumptionState?.stateId && objectRecord(restoredAssumptionState.civilMix)) {
        setAssumptionStates([restoredAssumptionState as unknown as BudgetAssumptionState]);
        setSelectedAssumptionStateId(String(restoredAssumptionState.stateId));
      }
      const restoredEstimateControls = objectRecord(workingState?.estimateControls);
      if (restoredEstimateControls && objectRecord(restoredEstimateControls.production) && objectRecord(restoredEstimateControls.financial)) {
        setTransparentEstimateControls(restoredEstimateControls as unknown as TransparentEstimateControls);
      }
      if (record.accountId && record.accountId !== selectedAccountId) setSelectedAccountId(record.accountId);
      setCommercialOpportunities((prev) => [record, ...prev.filter((candidate) => candidate.opportunityId !== record.opportunityId)]);
      setActiveCommercialOpportunityId(record.opportunityId);
      setOpportunityNameDraft(record.name);
      setSelectedScopeId(record.selectedScopeId || selectedScope.scopeId);
      setActiveView(safeRestoreWorkspaceView(record.activeView));
      setCommercialDraftType(safeRestoreDraftType(record.commercialDraftType, validation.draft));
      setActiveDesignMode(validation.draft ? "CUSTOMER_PROPOSAL_REVIEW" : "NEW_INDEPENDENT_GRAPH");
      if (record.liveSession) setLiveCommercialSession(record.liveSession);
      if (record.proposalRevisionId) setReleaseProposalRevisionId(record.proposalRevisionId);
      if (record.selectedImportId && record.selectedRouteId && record.customerDesignImportSnapshot && record.selectedRouteSnapshot) {
        setSelectedCustomerDesignImportId(record.selectedImportId);
        setSelectedCustomerDesignRouteId(record.selectedRouteId);
      }
      if (!validation.mapAvailable) throw new Error("Missing route geometry in Opportunity Repository record.");
      if (validation.draft) {
        setLoadedCommercialDraftSnapshot(validation.draft);
        setImportedCommercialDraft(validation.draft);
        setSelectedCommercialCorridorDraft(validation.draft);
        setOpportunityWorkflowState("COMMERCIAL_DRAFT_ACTIVE");
      } else {
        setOpportunityWorkflowState("IDLE");
      }
    });

    await runRestoreStep("estimate", "Estimate", () => {
      if (!validation.estimateAvailable) throw new Error("Missing estimate snapshot or restorable commercial draft.");
      if (validation.draft) setTransparentEstimateRecalculatedAt(new Date().toISOString());
    });

    await runRestoreStep("workbook", "Workbook", () => {
      if (!hasObjectPayload(record.commercialWorkbook)) throw new Error("Missing workbook.json.");
      const restoredSections = Array.isArray(record.commercialWorkbook?.openSections)
        ? record.commercialWorkbook.openSections.map(String)
        : [];
      setCommercialWorkbookOpenSections(new Set([...restoredSections, "proposal-summary"]));
    });

    await runRestoreStep("proposal", "Proposal", () => {
      if (!record.proposalId) throw new Error("Missing proposal id.");
    });

    await runRestoreStep("preview", "Proposal Preview", () => {
      if (!hasObjectPayload(record.proposalPreview)) throw new Error("Missing proposal preview payload.");
    });

    await runRestoreStep("service-order", "Service Order Preview", () => {
      if (!hasObjectPayload(record.serviceOrderPreview)) throw new Error("Missing service order preview payload.");
      setCommercialWorkbookOpenSections((prev) => new Set([...prev, "service-order-preview"]));
    });

    await runRestoreStep("attachments", "Attachments", () => {
      if (
        !hasArrayPayload(record.attachments) &&
        !hasArrayPayload(record.sourceFiles) &&
        !hasArrayPayload(record.importedEvidenceReferences) &&
        !hasArrayPayload(record.routeRepositorySnapshot?.importedEvidence)
      ) {
        throw new Error("Missing attachments or source file evidence.");
      }
    });

    if (opportunityRestoreRunRef.current !== restoreRunId) return;
    markRestoreStep("complete", "OK");
    addRestoreLog(validation.warnings.length ? "Workspace restored with warnings." : "Workspace restored.");
    setOpportunityRestoreState((prev) => ({
      ...prev,
      status: "RESTORED",
      completedAt: new Date().toISOString(),
    }));
    updateRoutePersistenceInspector(record, routeSnapshot, validation.warnings.length ? "RESTORED_WITH_WARNINGS" : "RESTORED");
    appendRoutePersistenceAudit("Opening Opportunity", validation.warnings.length ? "WARNING" : "SUCCESS", {
      opportunityId: record.opportunityId,
      routeRepositoryId: record.routeRepositoryId ?? record.routeRepositoryRef?.routeRepositoryId ?? "",
      geometryHash: routeSnapshotHash(routeSnapshot),
      mapRendered: validation.mapAvailable ? "YES" : "NO",
      estimateRestored: validation.estimateAvailable ? "YES" : "NO",
      workbookRestored: hasObjectPayload(record.commercialWorkbook) ? "YES" : "NO",
      proposalRestored: record.proposalId ? "YES" : "NO",
      warnings: validation.warnings.length,
    });
    const completedRestore = restoreMetric.end({
      workerStatus: validation.warnings.length ? "RESTORED_WITH_WARNINGS" : "RESTORED",
      recordsProcessed: validation.warnings.length,
      recordsRendered: routeSnapshot?.commercialGeometry.length ?? 0,
    });
    setRuntimePerformance((prev) => runtimePerformanceSnapshot({
      ...prev,
      workspaceRestoreMs: completedRestore.durationMs,
      workerStatus: completedRestore.workerStatus ?? "RESTORED",
    }));
    setOpportunityNotice(validation.warnings.length
      ? `${record.name} restored from Opportunity Repository with warnings.`
      : `${record.name} restored from Opportunity Repository.`);
    void recordActivity({
      action: "opened opportunity",
      objectType: "Opportunity",
      objectId: record.opportunityId,
      objectName: record.name,
      revision: record.selectedScopeId,
      opportunityId: record.opportunityId,
      customerId: record.accountId,
      details: validation.warnings.length
        ? "Opportunity Repository restore completed with warnings."
        : "Opportunity Repository restore completed.",
    });
  }

  function handleOpportunityLibrarySelect(value: string) {
    if (!value) return;
    const [kind, firstId, secondId] = value.split("::");
    if (kind === "opportunity") {
      handleOpenCommercialOpportunity(firstId);
      return;
    }
    if (kind === "new") {
      handleNewCommercialOpportunity();
      return;
    }
    if (kind === "customer-design" && secondId) {
      setActiveCommercialOpportunityId("");
      handleOpenCustomerDesignFromLibrary(firstId, secondId);
      return;
    }
    if (kind === "engineering" && selectedRouteEngineeringDraft) {
      const revision = selectedRouteEngineeringDraft.revisions.find((candidate) => candidate.revisionId === firstId);
      if (!revision) return;
      setSelectedRouteEngineeringDraft({ ...selectedRouteEngineeringDraft, currentRevisionId: revision.revisionId });
      setSelectedRouteEngineeringActivation(null);
      setActiveView("handoff");
      setOpportunityNotice(`${revision.revisionName} selected from Engineering Revisions.`);
    }
  }

  function activateSalesDraftWorkingSet() {
    const draft = accountNetworkInventory.find((network) => network.networkCategory === "COMMERCIAL_DRAFT");
    if (!draft) return;
    setNetworkLayerStates((prev) => ({
      ...prev,
      [draft.networkId]: {
        ...(prev[draft.networkId] ?? defaultNetworkLayerState(draft)),
        visible: true,
        locked: false,
        activeReference: true,
      },
    }));
    setActiveView("proposal");
    setOpportunityWorkflowState("COMMERCIAL_DRAFT_ACTIVE");
  }

  function handleCreateSalesDraft() {
    activateSalesDraftWorkingSet();
  }

  function handleLoadSavedProposal() {
    const saved = recentCommercialOpportunities[0] ?? savedCommercialOpportunities[0] ?? null;
    if (!saved) {
      setOpportunityNotice("No saved Commercial Planning opportunity is available for this account.");
      return;
    }
    handleOpenCommercialOpportunity(saved.opportunityId);
    setNewOpportunityDialogOpen(false);
  }

  function handleLoadCustomerDraft() {
    handleCreateCustomerDraft("KMZ");
    setActiveView("review");
    setOpportunityWorkflowState("IDLE");
    setNewOpportunityDialogOpen(false);
  }

  function handleStartSharedReview() {
    setCustomerReviewStatus("IN_REVIEW");
    setActiveView("review");
  }

  function launchCommercialDesignMode(mode: CommercialDesignMode) {
    setActiveDesignMode(mode);
    if (mode === "CUSTOMER_PROPOSAL_REVIEW") {
      setActiveView("review");
      return;
    }
    if (mode === "NEW_INDEPENDENT_GRAPH" || activeCommercialDraftNetworks.length) setActiveView("proposal");
  }

  function runExistingFiberInventoryQuery() {
    setExistingFiberQueryLastRunAt(new Date().toISOString());
  }

  function launchOpportunityAnalysis() {
    setOpportunityAnalysisLaunchedAt(new Date().toISOString());
  }

  function resetOpportunityInputState(options: { preserveDraftType?: boolean } = {}) {
    setOpportunityScoutCandidate(null);
    setOpportunityScoutAddress("");
    setOpportunityScoutLat("");
    setOpportunityScoutLng("");
    setOpportunityScoutAzOrigin("");
    setOpportunityScoutAzDestination("");
    setAzOriginLocation(null);
    setAzDestinationLocation(null);
    setAzMapPlacementSlot(null);
    setSelectedAttachmentCandidateId(null);
    setCommercialRouteResult(null);
    setCommercialRoutingStatus("IDLE");
    if (!options.preserveDraftType) setCommercialDraftType(null);
    setTemporaryImportedRoute(null);
    setPendingRouteImport(null);
    setImportedEndpointReplacementConfirmed(false);
    setRouteImportStatus("IDLE");
  }

  function closeNewOpportunityDialog() {
    setNewOpportunityDialogOpen(false);
    if (opportunityWorkflowState === "SELECTING_START_MODE") setOpportunityWorkflowState("IDLE");
  }

  function handleBeginAddressOpportunity() {
    resetOpportunityInputState({ preserveDraftType: true });
    setCommercialDraftType("EXISTING_GRAPH_EXTENSION");
    setActiveDesignMode("EXTEND_EXISTING_NETWORK");
    setOpportunityScoutMode("ADDRESS");
    setOpportunityWorkflowState("AWAITING_ADDRESS");
    setActiveView("scout");
    setNewOpportunityDialogOpen(false);
  }

  function handleBeginLatLngOpportunity() {
    resetOpportunityInputState({ preserveDraftType: true });
    setCommercialDraftType("EXISTING_GRAPH_EXTENSION");
    setActiveDesignMode("EXTEND_EXISTING_NETWORK");
    setOpportunityScoutMode("LAT_LNG");
    setOpportunityWorkflowState("AWAITING_LAT_LNG");
    setActiveView("scout");
    setNewOpportunityDialogOpen(false);
  }

  function handleBeginAzOpportunity() {
    resetOpportunityInputState();
    setCommercialDraftType("NEW_GRAPH_CORRIDOR");
    setOpportunityScoutMode("AZ_BUILDER");
    setOpportunityWorkflowState("AWAITING_AZ_INPUT");
    setActiveDesignMode("NEW_INDEPENDENT_GRAPH");
    setActiveView("scout");
    setNewOpportunityDialogOpen(false);
  }

  function handleBeginExtendExistingOpportunity() {
    resetOpportunityInputState();
    setCommercialDraftType("EXISTING_GRAPH_EXTENSION");
    setOpportunityScoutMode("CLICK_SITE");
    setOpportunityWorkflowState("SELECTING_EXTENSION_INPUT");
    setActiveDesignMode("EXTEND_EXISTING_NETWORK");
    setActiveView("scout");
    setNewOpportunityDialogOpen(false);
  }

  function handleScoutMapCoordinate(coordinate: [number, number]) {
    if (opportunityWorkflowState === "AWAITING_AZ_INPUT" && azMapPlacementSlot) {
      const location = createMapResolvedLocation(selectedAccount.accountId, coordinate, `${azMapPlacementSlot} Map Point`);
      if (azMapPlacementSlot === "A") setAzOriginLocation(location);
      else setAzDestinationLocation(location);
      setAzMapPlacementSlot(null);
      return;
    }
    if (opportunityWorkflowState !== "AWAITING_MAP_CLICK") return;
    setOpportunityScoutCandidate(createMapScoutCandidate(selectedAccount.accountId, coordinate));
    setOpportunityWorkflowState("SITE_DECISION_READY");
  }

  function handleRunAddressScout() {
    if (opportunityWorkflowState !== "AWAITING_ADDRESS" || !opportunityScoutAddress.trim()) return;
    setOpportunityWorkflowState("RESOLVING_LOCATION");
    setOpportunityScoutCandidate(createAddressScoutCandidate(selectedAccount.accountId, opportunityScoutAddress));
    setOpportunityWorkflowState("SITE_DECISION_READY");
  }

  function handleRunLatLngScout() {
    const lat = Number(opportunityScoutLat);
    const lng = Number(opportunityScoutLng);
    if (
      opportunityWorkflowState !== "AWAITING_LAT_LNG" ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      Math.abs(lat) > 90 ||
      Math.abs(lng) > 180
    ) return;
    setOpportunityWorkflowState("RESOLVING_LOCATION");
    setOpportunityScoutCandidate(createLatLngScoutCandidate(selectedAccount.accountId, lat, lng));
    setOpportunityWorkflowState("SITE_DECISION_READY");
  }

  function setAzLocation(slot: AzLocationSlot, location: ResolvedLocation) {
    if (slot === "A") setAzOriginLocation(location);
    else setAzDestinationLocation(location);
  }

  function azInputForSlot(slot: AzLocationSlot) {
    return slot === "A" ? opportunityScoutAzOrigin : opportunityScoutAzDestination;
  }

  function resolveAzTextInput(slot: AzLocationSlot) {
    const input = azInputForSlot(slot).trim();
    if (!input) return null;
    const coordinateParts = input.split(",").map((part) => Number(part.trim()));
    return coordinateParts.length === 2 &&
      Number.isFinite(coordinateParts[0]) &&
      Number.isFinite(coordinateParts[1]) &&
      Math.abs(coordinateParts[0]) <= 90 &&
      Math.abs(coordinateParts[1]) <= 180
      ? createLatLngResolvedLocation(selectedAccount.accountId, coordinateParts[0], coordinateParts[1])
      : createAddressResolvedLocation(selectedAccount.accountId, input);
  }

  function handleResolveAzTextLocation(slot: AzLocationSlot) {
    const location = resolveAzTextInput(slot);
    if (!location) return;
    setAzLocation(slot, location);
  }

  function handleResolveAzExistingLocation(slot: AzLocationSlot, source: "CUSTOMER_ROUTE" | "CUSTOMER_STATION" | "CUSTOMER_POP" | "CUSTOMER_OBJECT") {
    if (source === "CUSTOMER_ROUTE") {
      const route = accountRenderableCustomerTwin.routes[0];
      if (route) setAzLocation(slot, createRouteResolvedLocation(selectedAccount.accountId, route));
      return;
    }
    if (source === "CUSTOMER_STATION") {
      const station = accountRenderableCustomerTwin.stations[0];
      if (station) setAzLocation(slot, createStationResolvedLocation(selectedAccount.accountId, station));
      return;
    }
    const object = source === "CUSTOMER_POP"
      ? accountRenderableCustomerTwin.objects.find((candidate) => ["POP", "FACILITY", "CUSTOMER_FACILITY", "CAMPUS", "BUILDING"].includes(candidate.objectType))
      : accountRenderableCustomerTwin.objects[0];
    if (object) setAzLocation(slot, createObjectResolvedLocation(selectedAccount.accountId, object));
  }

  function handleBeginAzMapPlacement(slot: AzLocationSlot) {
    setAzMapPlacementSlot(slot);
    setOpportunityWorkflowState("AWAITING_AZ_INPUT");
  }

  function buildCommercialRouteRequest(): CommercialRouteRequest | null {
    if (!opportunityScoutCandidate) return null;
    const routeMode = routeModeForCandidate(opportunityScoutCandidate, activeDesignMode, commercialDraftType);
    if (commercialDraftType === "NEW_GRAPH_CORRIDOR") {
      if (!opportunityScoutCandidate.originLocation || !opportunityScoutCandidate.destinationLocation) return null;
      const origin = locationCoordinate(opportunityScoutCandidate.originLocation);
      const destination = locationCoordinate(opportunityScoutCandidate.destinationLocation);
      return {
        accountId: selectedAccount.accountId,
        from: { ...origin, source: "A_LOCATION" },
        to: { ...destination, source: "Z_LOCATION" },
        mode: routeMode,
      };
    }
    if (opportunityScoutCandidate.mode === "AZ_BUILDER") {
      if (!opportunityScoutCandidate.originLocation || !opportunityScoutCandidate.destinationLocation) return null;
      const origin = locationCoordinate(opportunityScoutCandidate.originLocation);
      const destination = locationCoordinate(opportunityScoutCandidate.destinationLocation);
      if (!selectedAttachmentCandidate) return null;
      const originTouchesTwin = isCustomerTwinLocation(opportunityScoutCandidate.originLocation);
      const destinationTouchesTwin = isCustomerTwinLocation(opportunityScoutCandidate.destinationLocation);
      const target = originTouchesTwin && !destinationTouchesTwin
        ? destination
        : destinationTouchesTwin
          ? origin
          : destination;
      return {
        accountId: selectedAccount.accountId,
        from: {
          latitude: selectedAttachmentCandidate.projectedLatitude,
          longitude: selectedAttachmentCandidate.projectedLongitude,
          source: "ATTACHMENT_POINT",
          label: selectedAttachmentCandidate.routeName,
          attachmentCandidateId: selectedAttachmentCandidate.id,
        },
        to: {
          ...target,
          source: "Z_LOCATION",
        },
        mode: routeMode,
      };
    }
    if (!selectedAttachmentCandidate) return null;
    return {
      accountId: selectedAccount.accountId,
      from: {
        latitude: selectedAttachmentCandidate.projectedLatitude,
        longitude: selectedAttachmentCandidate.projectedLongitude,
        source: "ATTACHMENT_POINT",
        label: selectedAttachmentCandidate.routeName,
        attachmentCandidateId: selectedAttachmentCandidate.id,
      },
      to: {
        latitude: opportunityScoutCandidate.resolvedLocation?.latitude ?? opportunityScoutCandidate.coordinate[1],
        longitude: opportunityScoutCandidate.resolvedLocation?.longitude ?? opportunityScoutCandidate.coordinate[0],
        source: "CANDIDATE_SITE",
        label: opportunityScoutCandidate.label,
      },
      mode: routeMode,
    };
  }

  async function handleGenerateCommercialRoute() {
    const request = buildCommercialRouteRequest();
    if (!request) {
      setCommercialRouteResult({
        status: "FAILED",
        source: "OSRM",
        failureReason: "NO_ROUTABLE_ATTACHMENT",
        diagnostics: ["Route generation requires a resolved candidate and a routable Customer Twin attachment, except independent A/Z mode."],
      });
      setOpportunityWorkflowState("SITE_DECISION_READY");
      return;
    }
    setCommercialRoutingStatus("ROUTING");
    setCommercialRouteResult(null);
    setOpportunityWorkflowState("RESOLVING_LOCATION");
    try {
      appendRoutePersistenceAudit("Generate Route", "START", {
        mode: request.mode,
        from: request.from.label,
        to: request.to.label,
      });
      const result = await routeCommercialCorridorWithOsrm(request);
      const routedGeometry = dalGeometryFromCommercialRouteResult(result);
      appendRoutePersistenceAudit("Generate Route", result.status === "ROUTED" ? "SUCCESS" : "FAIL", {
        vertices: routedGeometry.length,
        lengthMiles: result.routeMiles ?? 0,
        geometryHash: commercialRouteGeometryHash(routedGeometry),
        status: result.status === "ROUTED" ? "SUCCESS" : "FAIL",
        failureReason: result.failureReason,
      });
      if (result.status !== "ROUTED") {
        setCommercialRouteResult(result);
        setOpportunityWorkflowState("SITE_DECISION_READY");
        return;
      }
      const generatedDraft = opportunityScoutCandidate
        ? buildCommercialCorridorDraft({
            candidate: opportunityScoutCandidate,
            routeResult: result,
            assumptionState: selectedAssumptionState,
            estimateControls: transparentEstimateControls,
          })
        : null;
      const routeGeometry = generatedDraft?.geometry?.length ? generatedDraft.geometry : routedGeometry;
      const routeMiles = generatedDraft?.routeMiles ?? result.routeMiles ?? 0;
      const routeFeet = generatedDraft?.routeFeet ?? Math.round(routeMiles * 5280);
      const opportunityName = customerAwareOpportunityName(opportunityNameDraft || `${selectedAccount.name} Route`, selectedAccount.name);
      const nextVersion = activeCommercialOpportunity ? Math.max(1, Number(activeCommercialOpportunity.version ?? 1)) : 1;
      const recordIds = commercialRecordIdsForOpportunity(opportunityName, nextVersion, Boolean(demoGovernedIdContext));
      const opportunityId = activeCommercialOpportunity?.opportunityId ?? generatedRouteRepositorySnapshot?.opportunityId ?? governedClientId(`OPP-${recordIds.slug}-${Date.now()}`, demoGovernedIdContext);
      const routeSnapshot = buildCommercialRouteRepositoryRecord({
        opportunityId,
        opportunityName,
        commercialDraft: generatedDraft,
        sourceImport: null,
        sourceRoute: null,
        sourceFiles: [],
        routeGeometry,
        routeFeet,
        routeMiles,
        timestamp: new Date().toISOString(),
      });
      if (!routeSnapshot) throw new Error("Route Repository creation aborted: OSRM geometry could not be converted into a repository snapshot.");
      const routeSnapshotToSave = routeSnapshotWithIntegrity(routeSnapshot);
      appendRoutePersistenceAudit("Route Repository", "START", {
        message: "Creating Route Repository...",
        routeRepositoryId: routeSnapshotToSave.routeRepositoryId,
        vertexCount: routeSnapshotToSave.commercialGeometry.length,
        miles: routeSnapshotToSave.routeMiles,
        geometryHash: routeSnapshotToSave.geometryHash,
      });
      const savedRouteSnapshot = routeSnapshotWithIntegrity(await RouteRepository.saveRoute(routeSnapshotToSave, session));
      const verifiedRouteSnapshot = routeSnapshotWithIntegrity(await RouteRepository.verifyRoute(savedRouteSnapshot.routeRepositoryId, { geometryHash: routeSnapshotToSave.geometryHash }, session));
      requireRouteSnapshotIntegrity(verifiedRouteSnapshot, "Route Repository");
      if (routeSnapshotHash(verifiedRouteSnapshot) !== routeSnapshotHash(routeSnapshotToSave)) {
        throw new Error("Route Repository creation failed: geometry hash changed after reload.");
      }
      appendRoutePersistenceAudit("Route Repository", "SUCCESS", {
        routeRepositoryId: verifiedRouteSnapshot.routeRepositoryId,
        geometrySaved: "YES",
        vertexCount: verifiedRouteSnapshot.commercialGeometry.length,
        miles: verifiedRouteSnapshot.routeMiles,
        status: "SUCCESS",
      });
      setCommercialRouteRepositoryRecords((prev) => [verifiedRouteSnapshot, ...prev.filter((route) => route.routeRepositoryId !== verifiedRouteSnapshot.routeRepositoryId)]);
      setGeneratedRouteRepositorySnapshot(verifiedRouteSnapshot);
      const inspectorOpportunity = {
        opportunityId,
        accountId: selectedAccount.accountId,
        name: opportunityName,
        status: "SAVED",
        routeRepositoryId: verifiedRouteSnapshot.routeRepositoryId,
        routeRepositoryRef: {
          routeRepositoryId: verifiedRouteSnapshot.routeRepositoryId,
          routeSnapshotId: verifiedRouteSnapshot.routeSnapshotId,
          routeId: verifiedRouteSnapshot.routeId,
          routeName: verifiedRouteSnapshot.routeName,
          repositoryType: "COMMERCIAL_ROUTE_REPOSITORY",
        },
        routeGeometry: verifiedRouteSnapshot.commercialGeometry,
        routeFeet: verifiedRouteSnapshot.routeFeet,
        routeMiles: verifiedRouteSnapshot.routeMiles,
        estimate: { estimateId: generatedDraft?.transparentEstimate.estimateId ?? "estimate-pending" },
        commercialWorkbook: { workbookId: recordIds.workbookId },
        workbookId: recordIds.workbookId,
        proposalId: recordIds.proposalId,
        importedEvidenceReferences: verifiedRouteSnapshot.importedEvidence,
        createdAt: verifiedRouteSnapshot.createdAt,
        updatedAt: verifiedRouteSnapshot.updatedAt,
        selectedScopeId: selectedScope.scopeId,
        activeView,
        commercialDraftType,
        liveSession: null,
        snapshotCount: 0,
        note: "Generated route repository inspection record. Opportunity has not been saved yet.",
        noScopeVersionCreation: true,
        noInventoryMutation: true,
      } satisfies CommercialOpportunityRecord;
      updateRoutePersistenceInspector(inspectorOpportunity, verifiedRouteSnapshot, "ROUTE_REPOSITORY_CREATED");
      appendRoutePersistenceAudit("Workspace", "SUCCESS", {
        "Workspace.routeRepositoryId": verifiedRouteSnapshot.routeRepositoryId,
        value: verifiedRouteSnapshot.routeRepositoryId,
      });
      setCommercialRouteResult(result);
      setOpportunityWorkflowState(result.status === "ROUTED"
        ? commercialDraftType === "NEW_GRAPH_CORRIDOR" ? "CORRIDOR_READY" : "QUICK_QUOTE_READY"
        : "SITE_DECISION_READY");
    } catch (error) {
      appendRoutePersistenceAudit("Route Repository", "FAIL", {
        geometrySaved: "NO",
        status: "FAIL",
        reason: error instanceof Error ? error.message : String(error),
      });
      setCommercialRouteResult({
        status: "FAILED",
        source: "OSRM",
        failureReason: "ROUTE_REPOSITORY_COMMIT_FAILED",
        diagnostics: [
          "Route generation did not advance because the Route Repository transaction failed.",
          "No Opportunity save is allowed until the Route Repository commits and reloads successfully.",
          error instanceof Error ? error.message : String(error),
        ],
      });
      setOpportunityWorkflowState("SITE_DECISION_READY");
      setOpportunityNotice(`Route Repository persistence failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setCommercialRoutingStatus("IDLE");
    }
  }

  function handleRunAzBuilderScout() {
    const originLocation = azOriginLocation ?? resolveAzTextInput("A");
    const destinationLocation = azDestinationLocation ?? resolveAzTextInput("Z");
    if (opportunityWorkflowState !== "AWAITING_AZ_INPUT" || !originLocation || !destinationLocation) return;
    const draftType = commercialDraftType ?? "NEW_GRAPH_CORRIDOR";
    setAzOriginLocation(originLocation);
    setAzDestinationLocation(destinationLocation);
    setCommercialDraftType(draftType);
    setActiveDesignMode(draftType === "EXISTING_GRAPH_EXTENSION" ? "EXTEND_EXISTING_NETWORK" : "NEW_INDEPENDENT_GRAPH");
    setOpportunityScoutCandidate(createAzBuilderScoutCandidateFromResolvedLocations(selectedAccount.accountId, originLocation, destinationLocation));
    setOpportunityWorkflowState("SITE_DECISION_READY");
  }

  function handleBeginMapOpportunity() {
    resetOpportunityInputState({ preserveDraftType: true });
    setCommercialDraftType("EXISTING_GRAPH_EXTENSION");
    setActiveDesignMode("EXTEND_EXISTING_NETWORK");
    setOpportunityScoutMode("CLICK_SITE");
    setOpportunityWorkflowState("AWAITING_MAP_CLICK");
    setActiveView("scout");
    setNewOpportunityDialogOpen(false);
  }

  function buildPricedImport(record: CustomerDesignImport, selectedRouteId?: string) {
    const baseRoute = selectedRouteId
      ? record.routes.find((route) => route.routeId === selectedRouteId) ?? null
      : record.routes.find((route) => route.pricingEligible) ?? record.routes[0] ?? null;
    if (!baseRoute) return { record, route: null, draft: null };
    const pricedRoute = baseRoute.pricingEligible
      ? baseRoute
      : { ...baseRoute, designState: "CUSTOMER_PROPOSED" as const, pricingEligible: true, confidence: Math.max(baseRoute.confidence, 76) };
    const pricingRecord = {
      ...record,
      activeRouteId: pricedRoute.routeId,
      routes: record.routes.map((route) => route.routeId === pricedRoute.routeId ? pricedRoute : route),
      designIntent: "PRICE_AS_NEW_OPPORTUNITY",
    } as CustomerDesignImport & Record<string, unknown>;
    const draft = buildCommercialCorridorDraftFromImportedRoute({
      importRecord: pricingRecord,
      importedRoute: pricedRoute,
      assumptionState: selectedAssumptionState,
      estimateControls: transparentEstimateControls,
    });
    const pricedRecord = draft
      ? ImportRepository.attachPricedDraft(pricingRecord, pricedRoute.routeId, draft, currentUserName)
      : pricingRecord;
    const savedRoute = pricedRecord.routes.find((route) => route.routeId === pricedRoute.routeId) ?? pricedRoute;
    return { record: pricedRecord, route: savedRoute, draft };
  }

  function stageSelectedImportedRoute(record: CustomerDesignImport, routeId: string) {
    const priced = buildPricedImport(record, routeId);
    if (!priced.route) {
      setRouteImportStatus("ERROR");
      setOpportunityNotice(`${record.sourceFileName} did not contain the selected route geometry.`);
      return;
    }
    const sourceGeometry = geometryForImportedRoute(priced.route);
    if (sourceGeometry.length < 2) {
      setRouteImportStatus("ERROR");
      setOpportunityNotice(`${record.sourceFileName} parsed, but the selected route has no continuous line geometry.`);
      return;
    }
    const routeRevision = Math.max(1, Number(activeCommercialOpportunity?.routeRepositorySnapshot?.routeRevision ?? generatedRouteRepositorySnapshot?.routeRevision ?? 0) + 1);
    const geometryHash = commercialRouteGeometryHash(sourceGeometry);
    const endpointAuthority = deriveImportedRouteEndpointAuthority({
      sourceGeometry,
      sourceFileHash: record.sourceFileHash ?? "missing-source-file-hash",
      sourceGeometryId: `${record.importId}:${priced.route.routeId}`,
      routeRevision,
      geometryHash,
    });
    const evidence = {
      ...sourceFileEvidence(
        record.sourceFileName,
        "TEMPORARY_IMPORTED_ROUTE",
        `server/data/opportunities/${selectedAccount.accountId}/temporary-imports/${record.sourceFileName}`,
      ),
      sourceFileType: record.sourceType,
      sourceFileHash: record.sourceFileHash,
      checksum: record.sourceFileHash,
      parserVersion: record.parserVersion,
      sourceGeometryId: endpointAuthority.aSite.sourceGeometryId,
      originalGeometryHash: geometryHash,
    };
    setTemporaryImportedRoute({
      importRecord: priced.record,
      route: priced.route,
      draft: priced.draft,
      geometry: sourceGeometry,
      sourceFileName: record.sourceFileName,
      evidence,
      importedAt: new Date().toISOString(),
      endpointAuthority,
    });
    setPendingRouteImport(null);
    setImportedEndpointReplacementConfirmed(false);
    if (!azOriginLocation && !azDestinationLocation) {
      setAzOriginLocation(importedEndpointResolvedLocation(selectedAccount.accountId, endpointAuthority.aSite));
      setAzDestinationLocation(importedEndpointResolvedLocation(selectedAccount.accountId, endpointAuthority.zSite));
      setOpportunityScoutAzOrigin(`${endpointAuthority.aSite.coordinate[1]}, ${endpointAuthority.aSite.coordinate[0]}`);
      setOpportunityScoutAzDestination(`${endpointAuthority.zSite.coordinate[1]}, ${endpointAuthority.zSite.coordinate[0]}`);
    }
    setRouteImportStatus("READY");
    setOpportunityWorkflowState("AWAITING_IMPORT");
    setOpportunityNotice(`${record.sourceFileName} route selected. Start/end endpoint candidates are ready for A/Z orientation confirmation.`);
  }

  async function handleRouteImportFile(file: File | null) {
    if (!file) return;
    setTemporaryImportedRoute(null);
    setPendingRouteImport(null);
    setImportedEndpointReplacementConfirmed(false);
    setRouteImportStatus("PARSING");
    setCommercialDraftType("NEW_GRAPH_CORRIDOR");
    setActiveDesignMode("CUSTOMER_PROPOSAL_REVIEW");
    setOpportunityWorkflowState("AWAITING_IMPORT");
    setActiveView("scout");
    setNewOpportunityDialogOpen(false);
    setOpportunityNotice(`Parsing ${file.name} as a Temporary Imported Route...`);
    try {
      const imported = await ImportRepository.parseRouteImport({
        file,
        accountId: selectedAccount.accountId,
        customerName: selectedAccount.name,
        uploadedBy: currentUserName,
      });
      const routeCandidates = imported.routes.filter((route) => route.dalGeometry.length > 1);
      if (!routeCandidates.length) {
        setRouteImportStatus("ERROR");
        setOpportunityNotice(`${file.name} did not contain route geometry that can be priced.`);
        return;
      }
      if (routeCandidates.length > 1) {
        setPendingRouteImport({ ...imported, activeRouteId: undefined, previewGeometry: [] });
        setRouteImportStatus("READY");
        setOpportunityNotice(`${file.name} contains ${routeCandidates.length} candidate route centerlines. Select the intended route before A/Z derivation.`);
        return;
      }
      stageSelectedImportedRoute(imported, routeCandidates[0].routeId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setRouteImportStatus("ERROR");
      setOpportunityNotice(`Customer route import failed: ${message}`);
    }
  }

  async function handleSaveTemporaryImportedRoute(options: { duplicate?: boolean } = {}) {
    if (!temporaryImportedRoute) return;
    if (importedEndpointsNeedConfirmation) {
      setOpportunityNotice("Confirm whether imported endpoint candidates replace the existing A/Z coordinates before saving the governed route.");
      return;
    }
    if (activeCommercialOpportunity && !options.duplicate && !canModifyActiveOpportunity) {
      setOpportunityNotice("You cannot replace this Opportunity route unless you own it or have contributor/approver authority.");
      return;
    }
    const commercialDraft = temporaryImportedCommercialDraft ?? temporaryImportedRoute.draft;
    const fallbackName = customerAwareOpportunityName(temporaryImportedRoute.route.name, selectedAccount.name);
    const opportunityName = activeCommercialOpportunity && !options.duplicate
      ? customerAwareOpportunityName(opportunityNameDraft || activeCommercialOpportunity.name || fallbackName, selectedAccount.name)
      : promptCommercialOpportunityName(options.duplicate ? "Save Imported Route As" : "Save Imported Route", fallbackName);
    if (!opportunityName) return;

    upsertCustomerDesignImport(temporaryImportedRoute.importRecord);
    setSelectedCustomerDesignImportId(temporaryImportedRoute.importRecord.importId);
    setSelectedCustomerDesignRouteId(temporaryImportedRoute.route.routeId);
    setImportedCommercialDraft(commercialDraft);
    if (commercialDraft) setSelectedCommercialCorridorDraft(commercialDraft);
    setCommercialDraftType("NEW_GRAPH_CORRIDOR");
    setActiveDesignMode("CUSTOMER_PROPOSAL_REVIEW");
    setActiveView("proposal");
    setOpportunityWorkflowState("COMMERCIAL_DRAFT_ACTIVE");
    setOpportunityNameDraft(opportunityName);
    const saved = await upsertCommercialOpportunity(buildCommercialOpportunityRecord("SAVED", {
      duplicate: options.duplicate || !activeCommercialOpportunity,
      overrideName: opportunityName,
      overrideImport: temporaryImportedRoute.importRecord,
      overrideRoute: temporaryImportedRoute.route,
      overrideDraft: commercialDraft,
      sourceFile: temporaryImportedRoute.evidence,
    }));
    if (!saved) return;
    setTemporaryImportedRoute(null);
    setRouteImportStatus("IDLE");
    setOpportunityNotice(`${opportunityName} saved from ${temporaryImportedRoute.sourceFileName}.`);
  }

  function handleReverseImportedRouteOrientation() {
    if (!temporaryImportedRoute) return;
    const reversedAuthority = reverseImportedRouteEndpointAuthority(temporaryImportedRoute.endpointAuthority);
    const originalSourceGeometry = temporaryImportedRoute.importRecord.routes.find((route) => route.routeId === temporaryImportedRoute.route.routeId)?.dalGeometry ?? temporaryImportedRoute.route.dalGeometry;
    const geometry = orientedImportedRouteGeometry(
      originalSourceGeometry,
      reversedAuthority.orientation,
    );
    const geometryHash = commercialRouteGeometryHash(geometry);
    const endpointAuthority = {
      ...reversedAuthority,
      aSite: { ...reversedAuthority.aSite, geometryHash },
      zSite: { ...reversedAuthority.zSite, geometryHash },
    };
    const orientedRoute: ImportedCustomerRoute = {
      ...temporaryImportedRoute.route,
      dalGeometry: geometry,
      geometry: geometry.map(([longitude, latitude]) => ({ longitude, latitude })),
      pricedDraft: undefined,
    };
    const draft = buildCommercialCorridorDraftFromImportedRoute({
      importRecord: temporaryImportedRoute.importRecord,
      importedRoute: orientedRoute,
      assumptionState: selectedAssumptionState,
      estimateControls: transparentEstimateControls,
    });
    setTemporaryImportedRoute({ ...temporaryImportedRoute, route: orientedRoute, geometry, draft, endpointAuthority });
    if (azOriginLocation?.source === "IMPORTED_ROUTE" && azDestinationLocation?.source === "IMPORTED_ROUTE") {
      setAzOriginLocation(importedEndpointResolvedLocation(selectedAccount.accountId, endpointAuthority.aSite));
      setAzDestinationLocation(importedEndpointResolvedLocation(selectedAccount.accountId, endpointAuthority.zSite));
    }
    setOpportunityNotice("Commercial A/Z orientation reversed. Original imported source geometry remains unchanged in evidence.");
  }

  function handleAcceptImportedStartAsA() {
    if (!temporaryImportedRoute) return;
    if (temporaryImportedRoute.endpointAuthority.orientation === "SOURCE_END_TO_START") handleReverseImportedRouteOrientation();
    else setOpportunityNotice("Imported source start is confirmed as commercial A. Source evidence remains unchanged.");
  }

  function handleConfirmImportedEndpointReplacement() {
    if (!temporaryImportedRoute) return;
    setAzOriginLocation(importedEndpointResolvedLocation(selectedAccount.accountId, temporaryImportedRoute.endpointAuthority.aSite));
    setAzDestinationLocation(importedEndpointResolvedLocation(selectedAccount.accountId, temporaryImportedRoute.endpointAuthority.zSite));
    setOpportunityScoutAzOrigin(`${temporaryImportedRoute.endpointAuthority.aSite.coordinate[1]}, ${temporaryImportedRoute.endpointAuthority.aSite.coordinate[0]}`);
    setOpportunityScoutAzDestination(`${temporaryImportedRoute.endpointAuthority.zSite.coordinate[1]}, ${temporaryImportedRoute.endpointAuthority.zSite.coordinate[0]}`);
    setImportedEndpointReplacementConfirmed(true);
    setOpportunityNotice("Imported endpoint coordinates confirmed as the Opportunity A/Z sites.");
  }

  function handleEnrichImportedEndpoint(endpoint: "A" | "Z", field: "siteName" | "customerSiteId" | "address" | "city" | "state" | "facilityType" | "notes", value: string) {
    setTemporaryImportedRoute((current) => {
      if (!current) return current;
      const endpointAuthority = {
        ...current.endpointAuthority,
        aSite: endpoint === "A" ? enrichImportedEndpointSite(current.endpointAuthority.aSite, { [field]: value }) : current.endpointAuthority.aSite,
        zSite: endpoint === "Z" ? enrichImportedEndpointSite(current.endpointAuthority.zSite, { [field]: value }) : current.endpointAuthority.zSite,
      };
      if (endpoint === "A" && azOriginLocation?.source === "IMPORTED_ROUTE") setAzOriginLocation(importedEndpointResolvedLocation(selectedAccount.accountId, endpointAuthority.aSite));
      if (endpoint === "Z" && azDestinationLocation?.source === "IMPORTED_ROUTE") setAzDestinationLocation(importedEndpointResolvedLocation(selectedAccount.accountId, endpointAuthority.zSite));
      return { ...current, endpointAuthority };
    });
  }

  function handleSelectExistingGovernedRoute(routeRepositoryIdValue: string) {
    const source = commercialRouteRepositoryRecords.find((route) => route.routeRepositoryId === routeRepositoryIdValue);
    const opportunityId = activeCommercialOpportunity?.opportunityId;
    if (!source || !opportunityId || source.commercialGeometry.length < 2) return;
    const routeRevision = Math.max(1, Number(source.routeRevision ?? 1) + 1);
    const routeRepositoryId = routeRepositoryIdForOpportunity(opportunityId, `${source.routeId}-revision-${routeRevision}`);
    const geometryHash = commercialRouteGeometryHash(source.commercialGeometry);
    const endpointAuthority = deriveImportedRouteEndpointAuthority({
      sourceGeometry: source.commercialGeometry,
      sourceFileHash: source.sourceFileHash ?? source.geometryHash ?? "repository-route",
      sourceGeometryId: source.sourceGeometryId ?? source.routeGeometryId ?? source.routeRepositoryId,
      routeRevision,
      geometryHash,
    });
    const cloned: CommercialRouteRepositoryRecord = routeSnapshotWithIntegrity({
      ...source,
      routeRepositoryId,
      routeSnapshotId: `${routeRepositoryId}-v${routeRevision}`,
      opportunityId,
      routeRevision,
      parentRouteRepositoryId: source.routeRepositoryId,
      routeSource: "EXISTING_ROUTE",
      endpointAuthority,
      aLocation: { label: source.aLocation?.label ?? `${source.routeName} A`, coordinate: endpointAuthority.aSite.coordinate },
      zLocation: { label: source.zLocation?.label ?? `${source.routeName} Z`, coordinate: endpointAuthority.zSite.coordinate },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setGeneratedRouteRepositorySnapshot(cloned);
    setAzOriginLocation({ ...importedEndpointResolvedLocation(selectedAccount.accountId, endpointAuthority.aSite), source: "COMMERCIAL_DRAFT_POINT" });
    setAzDestinationLocation({ ...importedEndpointResolvedLocation(selectedAccount.accountId, endpointAuthority.zSite), source: "COMMERCIAL_DRAFT_POINT" });
    setCommercialDraftType("NEW_GRAPH_CORRIDOR");
    setOpportunityWorkflowState("CORRIDOR_READY");
    setNewOpportunityDialogOpen(false);
    setOpportunityNotice(`${source.routeName} selected as an immutable source for new Route Revision ${routeRevision}.`);
  }

  function handleDiscardTemporaryImportedRoute() {
    const discardedName = temporaryImportedRoute?.sourceFileName ?? "Temporary Imported Route";
    setTemporaryImportedRoute(null);
    setPendingRouteImport(null);
    setImportedEndpointReplacementConfirmed(false);
    setRouteImportStatus("IDLE");
    if (opportunityWorkflowState === "AWAITING_IMPORT") setOpportunityWorkflowState("IDLE");
    setOpportunityNotice(`${discardedName} discarded. The Opportunity Repository was not changed.`);
  }

  function handleUseExistingCustomerSite() {
    const site = accountRenderableCustomerTwin.objects.find((object) => ["CAMPUS", "CUSTOMER_FACILITY", "FACILITY", "BUILDING", "POP"].includes(object.objectType));
    if (!site) return;
    setCommercialDraftType("EXISTING_GRAPH_EXTENSION");
    setActiveDesignMode("EXTEND_EXISTING_NETWORK");
    setOpportunityScoutMode("CLICK_SITE");
    setOpportunityScoutCandidate({
      ...createMapScoutCandidate(selectedAccount.accountId, site.coordinate),
      source: "BROWSER_RESULT",
      label: `Existing Customer Site: ${site.name}`,
    });
    setOpportunityWorkflowState("SITE_DECISION_READY");
    setNewOpportunityDialogOpen(false);
  }

  function handleUseExistingStation() {
    const station = accountRenderableCustomerTwin.stations[0];
    if (!station) return;
    setCommercialDraftType("EXISTING_GRAPH_EXTENSION");
    setActiveDesignMode("EXTEND_EXISTING_NETWORK");
    setOpportunityScoutMode("CLICK_SITE");
    setOpportunityScoutCandidate({
      ...createMapScoutCandidate(selectedAccount.accountId, station.coordinate),
      source: "BROWSER_RESULT",
      label: `Existing Station: ${station.routeName} ${station.stationIndex}`,
    });
    setOpportunityWorkflowState("SITE_DECISION_READY");
    setNewOpportunityDialogOpen(false);
  }

  function handleUseExistingObject() {
    const object = accountRenderableCustomerTwin.objects[0];
    if (!object) return;
    setCommercialDraftType("EXISTING_GRAPH_EXTENSION");
    setActiveDesignMode("EXTEND_EXISTING_NETWORK");
    setOpportunityScoutMode("CLICK_SITE");
    setOpportunityScoutCandidate({
      ...createMapScoutCandidate(selectedAccount.accountId, object.coordinate),
      source: "BROWSER_RESULT",
      label: `Existing Object: ${object.name}`,
    });
    setOpportunityWorkflowState("SITE_DECISION_READY");
    setNewOpportunityDialogOpen(false);
  }

  function handleBeginParcelOpportunity() {
    handleBeginMapOpportunity();
  }

  function handleOpenOpportunityBrowserResult(result: OpportunityBrowserResult) {
    setActiveDesignMode(result.recommendedMode);
    setCommercialDraftType("EXISTING_GRAPH_EXTENSION");
    setOpportunityScoutCandidate(createBrowserScoutCandidate(selectedAccount.accountId, result));
    setOpportunityWorkflowState("SITE_DECISION_READY");
    setActiveView("scout");
  }

  function handleLockScoutCandidate() {
    if (!opportunityScoutCandidate) return;
    if (commercialDraftType === "NEW_GRAPH_CORRIDOR" && !commercialCorridorDraft) return;
    if (commercialDraftType !== "NEW_GRAPH_CORRIDOR" && !opportunityScoutQuickQuote) return;
    setOpportunityScoutCandidate({
      ...opportunityScoutCandidate,
      lockedIntoCommercialDraft: true,
    });
    if (commercialDraftType === "NEW_GRAPH_CORRIDOR") setActiveDesignMode("NEW_INDEPENDENT_GRAPH");
    else setActiveDesignMode("EXTEND_EXISTING_NETWORK");
    setOpportunityWorkflowState("COMMERCIAL_DRAFT_ACTIVE");
    activateSalesDraftWorkingSet();
  }

  function handleDeleteScoutCandidate() {
    setOpportunityScoutCandidate(null);
    setOpportunityWorkflowState("IDLE");
    setAzOriginLocation(null);
    setAzDestinationLocation(null);
    setAzMapPlacementSlot(null);
    setSelectedAttachmentCandidateId(null);
    setCommercialRouteResult(null);
    setCommercialRoutingStatus("IDLE");
  }

  function handleLiveDraftRoutePlanRecalculated(nextRoutePlan: GoogleRfpRouteBidPlan) {
    const routeRequirementId = nextRoutePlan.routeRequirement.routeRequirementId;
    const geometry = nextRoutePlan.stationedCorridor?.centerlineRoute.geometry ?? nextRoutePlan.proposedGraph?.centerlineRoute?.geometry ?? [];
    const timestamp = new Date().toISOString();
    setCustomerReviewStatus("IN_REVIEW");
    setLiveCommercialSession((prev) => ({
      sessionId: prev?.routeRequirementId === routeRequirementId ? prev.sessionId : `LIVE-COMMERCIAL-SESSION-${routeRequirementId}-${Date.now()}`,
      accountId: selectedAccount.accountId,
      commercialEngagementId: selectedAccount.commercialEngagements[0],
      activePricingScopeId: selectedScope.scopeId,
      routeRequirementId,
      activeEditableRouteGeometry: geometry,
      routeSource: "LIVE_DRAFT",
      existingNetworksSelected: activeExistingReferenceNetworkIds,
      proposedNetworksSelected: activeProposedReferenceNetworkIds,
      constructionStrategy: selectedAssumptionState.civilMix,
      enrichmentSelections: prev?.enrichmentSelections ?? [],
      currentCommercialAssumptions: selectedAssumptionState.stateId,
      currentSelectedScopePricingSummary: prev?.routeRequirementId === routeRequirementId ? prev.currentSelectedScopePricingSummary : null,
      customerComments: prev?.customerComments ?? [],
      customerReviewStatus: "IN_REVIEW",
      lastRecalculatedAt: timestamp,
      lastAutosavedAt: timestamp,
      dirty: true,
      recalculationStatus: "CURRENT",
      routePlan: nextRoutePlan,
      snapshotCount: proposalSnapshots.filter((snapshot) => snapshot.routeRequirementId === routeRequirementId).length,
      currentOwner: "Sales",
      acceptedProposalId: undefined,
    }));
    setCommercialRecalculationPending(false);
  }

  function handleLiveDraftRecalculationError(message: string) {
    setCommercialRecalculationPending(false);
    setLiveCommercialSession((prev) => (prev ? { ...prev, recalculationStatus: "ERROR", errorMessage: message } : prev));
  }

  function handleSaveLiveProposalSnapshot() {
    if (!activeLiveSession?.routePlan) return;
    const timestamp = new Date().toISOString();
    const summary = activeLiveSession.currentSelectedScopePricingSummary ?? selectedPricingSummary;
    const snapshot: LiveProposalSnapshot = {
      snapshotId: `PROPOSAL-SNAPSHOT-${activeLiveSession.routeRequirementId}-${Date.now()}`,
      name: `Snapshot ${accountSnapshots.length + 1} - ${selectedScope.label}`,
      timestamp,
      routeRequirementId: activeLiveSession.routeRequirementId,
      pricingScopeId: selectedScope.scopeId,
      accountId: activeLiveSession.accountId,
      commercialEngagementId: activeLiveSession.commercialEngagementId,
      routeGeometry: activeLiveSession.activeEditableRouteGeometry,
      routeSource: activeLiveSession.routeSource,
      constructionStrategy: activeLiveSession.constructionStrategy,
      enrichmentSelections: activeLiveSession.enrichmentSelections,
      selectedAssumptionStateId: activeLiveSession.currentCommercialAssumptions,
      selectedScopePricingSummary: summary,
      author: currentUserName,
      note: "Saved from the live commercial proposal draft. No ScopeVersion, inventory, or execution authority created.",
      immutableCommercialRecord: true,
      noScopeVersionCreation: true,
      noInventoryMutation: true,
    };
    setProposalSnapshots((prev) => [snapshot, ...prev]);
    void ProposalRepository.saveProposal({
      ...(snapshot as any),
      proposalRecordId: snapshot.snapshotId,
      proposalRecordType: "SNAPSHOT",
      opportunityId: activeCommercialOpportunityId || activeCommercialOpportunity?.opportunityId,
      organization: "Teralinx",
    }).then(() => recordActivity({
      action: "saved proposal snapshot",
      objectType: "Proposal",
      objectId: snapshot.snapshotId,
      objectName: snapshot.name,
      revision: snapshot.pricingScopeId,
      opportunityId: activeCommercialOpportunityId || activeCommercialOpportunity?.opportunityId,
      customerId: snapshot.accountId,
      details: "Proposal snapshot persisted to the shared Teralinx Proposal Library.",
    })).catch((error) => {
      runtimeDiagnosticsWarn("Proposal Library save failed", {
        reason: error instanceof Error ? error.message : String(error),
      });
    });
    setLiveCommercialSession((prev) => (
      prev && prev.routeRequirementId === activeLiveSession.routeRequirementId
        ? {
            ...prev,
            dirty: false,
            routeSource: "SAVED_REVISION",
            lastRecalculatedAt: prev.lastRecalculatedAt ?? timestamp,
            lastAutosavedAt: timestamp,
            currentSelectedScopePricingSummary: summary,
            snapshotCount: prev.snapshotCount + 1,
            recalculationStatus: "CURRENT",
            errorMessage: undefined,
          }
        : prev
    ));
  }

  function handleSaveCommercialDraftSnapshot() {
    if (activeLiveSession?.routePlan) {
      handleSaveLiveProposalSnapshot();
      return;
    }
    const geometry = commercialCorridorDraft?.geometry ?? opportunityScoutQuickQuote?.geometry;
    if (!geometry?.length || !commercialDraftType) return;
    const timestamp = new Date().toISOString();
    const snapshot: LiveProposalSnapshot = {
      snapshotId: `PROPOSAL-SNAPSHOT-${selectedAccount.accountId}-${commercialDraftType}-${Date.now()}`,
      name: `Snapshot ${accountSnapshots.length + 1} - ${draftTypeLabel(commercialDraftType)}`,
      timestamp,
      routeRequirementId: commercialCorridorDraft?.routeId ?? opportunityScoutQuickQuote?.candidateId ?? `COMMERCIAL-DRAFT-${selectedAccount.accountId}`,
      pricingScopeId: selectedScope.scopeId,
      accountId: selectedAccount.accountId,
      commercialEngagementId: selectedAccount.commercialEngagements[0],
      routeGeometry: geometry,
      routeSource: "LIVE_DRAFT",
      constructionStrategy: selectedAssumptionState.civilMix,
      enrichmentSelections: [],
      selectedAssumptionStateId: selectedAssumptionState.stateId,
      selectedScopePricingSummary: selectedPricingSummary,
      author: currentUserName,
      note: `${draftTypeLabel(commercialDraftType)} snapshot. No ScopeVersion, inventory mutation, or execution authority created.`,
      immutableCommercialRecord: true,
      noScopeVersionCreation: true,
      noInventoryMutation: true,
    };
    setProposalSnapshots((prev) => [snapshot, ...prev]);
    void ProposalRepository.saveProposal({
      ...(snapshot as any),
      proposalRecordId: snapshot.snapshotId,
      proposalRecordType: "SNAPSHOT",
      opportunityId: activeCommercialOpportunityId || activeCommercialOpportunity?.opportunityId,
      organization: "Teralinx",
    }).then(() => recordActivity({
      action: "saved proposal snapshot",
      objectType: "Proposal",
      objectId: snapshot.snapshotId,
      objectName: snapshot.name,
      revision: snapshot.pricingScopeId,
      opportunityId: activeCommercialOpportunityId || activeCommercialOpportunity?.opportunityId,
      customerId: snapshot.accountId,
      details: "Commercial Draft snapshot persisted to the shared Teralinx Proposal Library.",
    })).catch((error) => {
      runtimeDiagnosticsWarn("Proposal Library save failed", {
        reason: error instanceof Error ? error.message : String(error),
      });
    });
  }

  function handleSelectImportedCustomerRoute(value: string) {
    if (!value) {
      setSelectedCustomerDesignImportId("");
      setSelectedCustomerDesignRouteId("");
      setImportedCommercialDraft(null);
      setLoadedCommercialDraftSnapshot(null);
      setSelectedCommercialCorridorDraft(null);
      setOpportunityNotice("Customer Design detached. Customer Twin remains visible.");
      return;
    }
    const [importId, routeId] = value.split("::");
    handleOpenCustomerDesignFromLibrary(importId, routeId);
  }

  function handlePriceImportedCustomerRoute() {
    if (!selectedImportedCustomerDesignImport || !selectedImportedCustomerRoute) return null;
    const draft = buildCommercialCorridorDraftFromImportedRoute({
      importRecord: selectedImportedCustomerDesignImport,
      importedRoute: selectedImportedCustomerRoute,
      assumptionState: selectedAssumptionState,
      estimateControls: transparentEstimateControls,
    });
    if (!draft) return null;
    const updated = ImportRepository.attachPricedDraft(selectedImportedCustomerDesignImport, selectedImportedCustomerRoute.routeId, draft, currentUserName);
    upsertCustomerDesignImport(updated);
    setSelectedCustomerDesignImportId(updated.importId);
    setSelectedCustomerDesignRouteId(selectedImportedCustomerRoute.routeId);
    setImportedCommercialDraft(draft);
    setSelectedCommercialCorridorDraft(draft);
    setTransparentEstimateRecalculatedAt(new Date().toISOString());
    return { record: updated, draft };
  }

  function handleMakeImportedCommercialDraft() {
    const priced = selectedImportedCommercialDraft
      ? { record: selectedImportedCustomerDesignImport, draft: selectedImportedCommercialDraft }
      : handlePriceImportedCustomerRoute();
    if (!priced?.record || !priced.draft || !selectedImportedCustomerRoute) return;
    const promoted = ImportRepository.markRoutePromoted(priced.record, selectedImportedCustomerRoute.routeId, "ROUTE_PROMOTED_TO_COMMERCIAL_DRAFT", currentUserName);
    upsertCustomerDesignImport(promoted);
    setCommercialDraftType("NEW_GRAPH_CORRIDOR");
    setImportedCommercialDraft(priced.draft);
    setSelectedCommercialCorridorDraft(priced.draft);
    setActiveView("proposal");
  }

  function handleCompareImportedCustomerRoute() {
    handleMakeImportedCommercialDraft();
    setActiveView("analysis");
  }

  function handleDiscardLiveProposalDraft() {
    setCommercialRecalculationPending(false);
    setLiveCommercialSession(null);
  }

  function toggleEnrichmentSelection(option: string) {
    if (!activeLiveSession) return;
    const timestamp = new Date().toISOString();
    setLiveCommercialSession((prev) => {
      if (!prev || prev.sessionId !== activeLiveSession.sessionId) return prev;
      const nextSelections = prev.enrichmentSelections.includes(option)
        ? prev.enrichmentSelections.filter((item) => item !== option)
        : [...prev.enrichmentSelections, option];
      return {
        ...prev,
        enrichmentSelections: nextSelections,
        dirty: true,
        lastAutosavedAt: timestamp,
        errorMessage: undefined,
      };
    });
  }

  function handleCreateCustomerDraft(source: CustomerDraftRecord["source"]) {
    const timestamp = new Date().toISOString();
    const draft: CustomerDraftRecord = {
      customerDraftId: `CUSTOMER-DRAFT-${selectedAccount.accountId}-${Date.now()}`,
      accountId: selectedAccount.accountId,
      commercialEngagementId: selectedAccount.commercialEngagements[0],
      source,
      status: "RECEIVED",
      createdAt: timestamp,
      note: `${selectedAccount.name} customer draft received as commercial review input only.`,
      noInventoryMutation: true,
    };
    setCustomerDrafts((prev) => [draft, ...prev]);
    setCustomerReviewStatus("CUSTOMER_DRAFT");
    setLiveCommercialSession((prev) => (prev && prev.accountId === selectedAccount.accountId
      ? {
          ...prev,
          routeSource: "CUSTOMER_DRAFT",
          customerReviewStatus: "CUSTOMER_DRAFT",
          customerComments: [...prev.customerComments, draft.note],
          dirty: true,
          lastAutosavedAt: timestamp,
        }
      : prev));
  }

  function handleAcceptProposal() {
    if (!activeProposalRuntime) {
      setProposalRuntimeNotice("Proposal Repository record is required before Commercial Approval.");
      return;
    }
    void handleCustomerRuntimeProposalApproval();
  }

  function handleRejectProposal() {
    const timestamp = new Date().toISOString();
    setCustomerReviewStatus("REJECTED");
    setLiveCommercialSession((prev) => (prev && prev.accountId === selectedAccount.accountId
      ? {
          ...prev,
          customerReviewStatus: "REJECTED",
          customerComments: [...prev.customerComments, "Customer requested changes; Sales remains owner."],
          currentOwner: "Sales",
          dirty: true,
          lastAutosavedAt: timestamp,
        }
      : prev));
  }

  const compactOwner = activeCommercialOpportunity?.owner ?? (accountAcceptedProposal ? "Engineering" : activeLiveSession?.currentOwner ?? "Sales");
  const activePersistedLifecycleState = accountDealTwin?.deals.find((deal) => deal.opportunityId === activeCommercialOpportunity?.opportunityId)?.currentState
    ?? activeCommercialOpportunity?.state
    ?? activeCommercialOpportunity?.status
    ?? "Unsaved";
  const currentDraftLabel = temporaryImportedRoute
    ? `Temporary Imported Route / ${temporaryImportedRoute.route.name}`
    : selectedImportedCustomerRoute
    ? `Customer Design / ${selectedImportedCustomerRoute.name}`
    : activeCommercialDraftNetworks.length
    ? draftTypeLabel(commercialDraftType)
    : loadedCommercialDraftSnapshot
    ? `Saved Commercial Draft / ${loadedCommercialDraftSnapshot.routeId}`
    : commercialDraftType
      ? `${draftTypeLabel(commercialDraftType)} / Not activated`
      : "No draft";
  const estimateConfidenceLabel = temporaryImportedCommercialDraft
    ? `${percentage(temporaryImportedCommercialDraft.transparentEstimate.confidence.score)} ${temporaryImportedCommercialDraft.transparentEstimate.confidence.level}`
    : temporaryImportedRoute
      ? percentage(temporaryImportedRoute.route.confidence)
    : selectedImportedCommercialDraft
    ? `${percentage(selectedImportedCommercialDraft.transparentEstimate.confidence.score)} ${selectedImportedCommercialDraft.transparentEstimate.confidence.level}`
    : commercialCorridorDraft
    ? `${percentage(commercialCorridorDraft.transparentEstimate.confidence.score)} ${commercialCorridorDraft.transparentEstimate.confidence.level}`
    : loadedCommercialDraftSnapshot
    ? `${percentage(loadedCommercialDraftSnapshot.transparentEstimate.confidence.score)} ${loadedCommercialDraftSnapshot.transparentEstimate.confidence.level}`
    : opportunityScoutQuickQuote
      ? percentage(opportunityScoutQuickQuote.confidence)
      : "Pending";
  const commercialConfidenceLabel = opportunityScoutQuickQuote
    ? percentage(opportunityScoutQuickQuote.confidence)
    : opportunityScoutSiteDecision
      ? percentage(opportunityScoutSiteDecision.commercialConfidence)
      : "Pending";
  const engineeringConfidenceLabel = temporaryImportedRoute
    ? "Temporary import known"
    : selectedImportedCustomerRoute
    ? "Imported baseline known"
    : commercialRouteResult?.status === "ROUTED"
    ? "Route geometry known"
    : commercialRouteResult?.status === "FAILED"
      ? "Route failed"
      : "Pending";
  const unknownConstraintCount = temporaryImportedCommercialDraft?.unknownQuantities.length ?? selectedImportedCommercialDraft?.unknownQuantities.length ?? commercialCorridorDraft?.unknownQuantities.length ?? loadedCommercialDraftSnapshot?.unknownQuantities.length ?? (opportunityScoutQuickQuote?.crossings ?? 0);
  const osrmStatusLabel = commercialRoutingStatus === "ROUTING"
    ? "ROUTING"
    : commercialRouteResult?.status ?? verificationStatus;
  const estimateStatusLabel = commercialRecalculationPending || activeLiveSession?.recalculationStatus === "RECALCULATING"
    ? "Needs Recalculation"
    : activeLiveSession?.dirty
      ? "Modified"
      : accountCustomerReviewStatus === "CUSTOMER_DRAFT"
        ? "Customer Requested"
        : accountAcceptedProposal
          ? "Proposal Ready"
        : temporaryImportedRoute
            ? "Temporary"
        : selectedImportedCommercialDraft || commercialCorridorDraft || loadedCommercialDraftSnapshot || opportunityScoutQuickQuote
            ? "Current"
            : "Not Started";
  const proposalStatusLabel = activeApprovedProposalRuntime
    ? "Proposal Ready"
    : accountAcceptedProposal
    ? "Proposal Ready"
    : accountCustomerReviewStatus === "IN_REVIEW"
      ? "Commercial Review"
      : temporaryImportedRoute
        ? "Temporary Route"
      : selectedImportedCommercialDraft
        ? "Commercial Draft"
      : activeCommercialDraftNetworks.length
        ? "Commercial Draft"
        : "Not Started";
  const draftVersionLabel = temporaryImportedRoute || activeCommercialDraftNetworks.length || selectedImportedCommercialDraft || commercialCorridorDraft || loadedCommercialDraftSnapshot || opportunityScoutQuickQuote
    ? `v${accountSnapshots.length + 1}`
    : "n/a";
  const lastRecalculatedAt = transparentEstimateRecalculatedAt ?? activeLiveSession?.lastRecalculatedAt ?? null;
  const unsavedChanges = Boolean(temporaryImportedRoute || activeLiveSession?.dirty || (commercialCorridorDraft && !opportunityScoutCandidate?.lockedIntoCommercialDraft));
  const activeFinancialDraft = temporaryImportedCommercialDraft ?? selectedImportedCommercialDraft ?? commercialCorridorDraft ?? loadedCommercialDraftSnapshot;
  const activeFinancialAuthority = activeFinancialDraft?.financialAuthority ?? null;
  const activeRouteEditProjection = routeEditSession?.status === "DISCARDED" ? null : routeEditSession?.projection ?? null;
  const displayedTransparentEstimate = activeRouteEditProjection?.projectedEstimate ?? activeFinancialDraft?.transparentEstimate ?? null;
  const displayedTransparentEstimateControls = activeRouteEditProjection?.projectedControls ?? transparentEstimateControls;
  useEffect(() => {
    const metric = startRuntimePerformanceOperation("workbook-recalculation", "WORKBOOK", {
      estimateId: displayedTransparentEstimate?.estimateId ?? "NO_ACTIVE_ESTIMATE",
      openSections: commercialWorkbookOpenSections.size,
      affectedDomains: affectedWorkbookExecutionDomains({ changedKey: "workbook.display" }),
    });
    const completed = metric.end({
      recordsProcessed: displayedTransparentEstimate
        ? displayedTransparentEstimate.laborLineItems.length + displayedTransparentEstimate.materialLineItems.length
        : 0,
      recordsRendered: commercialWorkbookOpenSections.size,
    });
    setRuntimePerformance((prev) => runtimePerformanceSnapshot({
      ...prev,
      workbookRecalculationMs: completed.durationMs,
      ilaRecalculationMs: latestRuntimePerformanceMetrics().reverse().find((item) => item.operation === "ila-recalculation")?.durationMs ?? prev.ilaRecalculationMs,
    }));
  }, [
    displayedTransparentEstimate?.estimateId,
    displayedTransparentEstimate?.laborLineItems.length,
    displayedTransparentEstimate?.materialLineItems.length,
    commercialWorkbookOpenSections.size,
  ]);
  const selectedProductResolution = PRODUCT_REGISTRY.resolve(selectedProductOption.productId);
  const selectedProductDefinition = selectedProductResolution?.definition ?? null;
  const selectedProductDoctrine = selectedProductResolution?.doctrine ?? null;
  const activeOpportunityDisplayName = customerAwareOpportunityName(
    opportunityNameDraft || activeCommercialOpportunity?.name || selectedImportedCustomerRoute?.name || "Opportunity",
    selectedAccount.name,
  );
  const currentCommercialRecordIds = commercialRecordIdsForOpportunity(activeOpportunityDisplayName, activeCommercialOpportunity?.version ?? 1, Boolean(demoGovernedIdContext));
  const activeRouteFeet = activeFinancialDraft?.routeFeet ?? temporaryImportedRoute?.route.routeFeet ?? Math.round(selectedPricingSummary.reconciliation.routeFeet);
  const activeRouteMiles = activeFinancialDraft?.routeMiles ?? temporaryImportedRoute?.route.routeMiles ?? selectedPricingSummary.reconciliation.routeMiles;
  const activeConstructionCost = activeFinancialAuthority?.constructionCost ?? selectedPricingSummary.reconciliation.budgetCost;
  const activeSellPrice = activeFinancialAuthority?.sellPrice ?? selectedPricingSummary.reconciliation.sellPriceIru;
  const activeCostPerFoot = activeFinancialAuthority?.costPerFoot ?? (activeRouteFeet ? activeConstructionCost / activeRouteFeet : 0);
  const activeSellPerFoot = activeFinancialAuthority?.revenuePerFoot ?? (activeRouteFeet ? activeSellPrice / activeRouteFeet : 0);
  const activeSourceFileReference = temporaryImportedRoute?.sourceFileName ?? activeCommercialOpportunity?.sourceRouteFileReference ?? selectedImportedCustomerDesignImport?.sourceFileName ?? "None";
  const activeLocationA = activeFinancialDraft?.aLabel ?? (temporaryImportedRoute ? `${temporaryImportedRoute.route.name} A` : undefined) ?? azOriginLocation?.label ?? selectedRoutePlans[0]?.routeRequirement.bidSegmentName ?? "A location pending";
  const activeLocationZ = activeFinancialDraft?.zLabel ?? (temporaryImportedRoute ? `${temporaryImportedRoute.route.name} Z` : undefined) ?? azDestinationLocation?.label ?? selectedRoutePlans[0]?.routeRequirement.bidSegmentName ?? "Z location pending";
  const importedAEndpointComparison = temporaryImportedRoute
    ? compareEndpointCoordinate(azOriginLocation ? [azOriginLocation.longitude, azOriginLocation.latitude] : null, temporaryImportedRoute.endpointAuthority.aSite.coordinate)
    : null;
  const importedZEndpointComparison = temporaryImportedRoute
    ? compareEndpointCoordinate(azDestinationLocation ? [azDestinationLocation.longitude, azDestinationLocation.latitude] : null, temporaryImportedRoute.endpointAuthority.zSite.coordinate)
    : null;
  const importedEndpointsNeedConfirmation = Boolean(temporaryImportedRoute && (
    (azOriginLocation && azOriginLocation.source !== "IMPORTED_ROUTE") ||
    (azDestinationLocation && azDestinationLocation.source !== "IMPORTED_ROUTE")
  ) && !importedEndpointReplacementConfirmed);
  const activeFinancialGeometryAuthorityKey = generatedRouteRepositorySnapshot?.geometryHash
    ?? commercialRouteGeometryHash(activeFinancialDraft?.geometry ?? temporaryImportedRoute?.geometry ?? opportunityScoutQuickQuote?.geometry ?? []);
  const corridorExecutionGeometry = useMemo(() => {
    if (activeFinancialDraft?.geometry?.length) return activeFinancialDraft.geometry;
    if (generatedRouteRepositorySnapshot?.commercialGeometry?.length) return generatedRouteRepositorySnapshot.commercialGeometry;
    if (temporaryImportedRoute?.geometry?.length) return temporaryImportedRoute.geometry;
    if (opportunityScoutQuickQuote?.geometry?.length) return opportunityScoutQuickQuote.geometry;
    return [] as DALCoordinate[];
  }, [
    activeFinancialDraft?.routeId,
    activeFinancialGeometryAuthorityKey,
    generatedRouteRepositorySnapshot?.routeRepositoryId,
    generatedRouteRepositorySnapshot?.geometryHash,
    temporaryImportedRoute?.route.routeId,
    opportunityScoutQuickQuote?.candidateId,
  ]);
  const corridorExecutionGeometryKey = useMemo(() => {
    const first = corridorExecutionGeometry[0];
    const last = corridorExecutionGeometry.at(-1);
    return [
      corridorExecutionGeometry.length,
      first ? `${first[0]},${first[1]}` : "none",
      last ? `${last[0]},${last[1]}` : "none",
      generatedRouteRepositorySnapshot?.geometryHash ?? "no-route-repository-hash",
      displayedTransparentEstimate?.estimateId ?? "no-estimate",
    ].join("|");
  }, [
    corridorExecutionGeometry,
    generatedRouteRepositorySnapshot?.geometryHash,
    displayedTransparentEstimate?.estimateId,
  ]);
  useEffect(() => {
    let cancelled = false;
    if (corridorExecutionGeometry.length < 2 || !displayedTransparentEstimate) {
      setCorridorExecutionSession(null);
      setCorridorExecutionProgress(null);
      setCorridorAggregateProjection(null);
      setCorridorViewportProjection(null);
      setCorridorPerformanceMetrics(null);
      return () => {
        cancelled = true;
      };
    }

    const corridorId = activeFinancialDraft?.routeId
      ?? generatedRouteRepositorySnapshot?.routeId
      ?? activeCommercialOpportunity?.routeRepositoryId
      ?? activeCommercialOpportunity?.opportunityId
      ?? `${selectedAccount.accountId}-COMMERCIAL-CORRIDOR`;
    const customerTwinId = accountCustomerTwin?.customerTwinId ?? `CUSTOMER-TWIN-${selectedAccount.accountId}`;
    const importHash = generatedRouteRepositorySnapshot?.geometryHash ?? commercialRouteGeometryHash(corridorExecutionGeometry);
    setCorridorExecutionProgress({
      status: "INITIALIZING_CORRIDOR",
      label: "Initializing Corridor",
      currentSegment: 0,
      totalSegments: 0,
      completedSegments: 0,
      failedSegmentId: null,
    });
    runtimeDiagnosticsLog("CorridorExecutionEngine", {
      authority: "CORRIDOR_EXECUTION_ENGINE",
      action: "START_BACKGROUND_EXECUTION",
      corridorId,
      customerTwinId,
      vertexCount: corridorExecutionGeometry.length,
      estimateId: displayedTransparentEstimate.estimateId,
    });

    void executeCorridorInBackground({
      corridorId,
      customerId: selectedAccount.accountId,
      customerTwinId,
      importHash,
      workbookHash: displayedTransparentEstimate.estimateId,
      geometry: corridorExecutionGeometry,
      routeMiles: activeRouteMiles,
      estimate: displayedTransparentEstimate,
      viewportBounds: null,
      viewportZoom: 9,
      selectedSegmentId: null,
      onProgress(progress) {
        if (!cancelled) setCorridorExecutionProgress(progress);
      },
    }).then((result) => {
      if (cancelled) return;
      setCorridorExecutionSession(result.session);
      setCorridorAggregateProjection(result.aggregateProjection);
      setCorridorViewportProjection(result.viewportProjection);
      setCorridorPerformanceMetrics(result.metrics);
      setRuntimePerformance((prev) => runtimePerformanceSnapshot({
        ...prev,
        cacheStatus: result.cacheStatus,
        workerStatus: result.session.status,
        visibleRoutes: result.viewportProjection.visibleSegmentCount,
        visibleStations: result.viewportProjection.renderedStationCount,
        renderedObjects: result.viewportProjection.renderedObjectCount,
        viewportObjectCount: result.viewportProjection.visibleSegmentCount,
        geometryBuildMs: result.metrics.corridorPartitionTimeMs,
        workbookRecalculationMs: result.metrics.workbookCalculationTimeMs,
      }));
    }).catch((error) => {
      if (cancelled) return;
      const message = error instanceof Error ? error.message : String(error);
      setCorridorExecutionProgress((prev) => ({
        status: "FAILED",
        label: "Corridor execution failed",
        currentSegment: prev?.currentSegment ?? 0,
        totalSegments: prev?.totalSegments ?? 0,
        completedSegments: prev?.completedSegments ?? 0,
        failedSegmentId: prev?.failedSegmentId ?? null,
      }));
      runtimeDiagnosticsWarn("CorridorExecutionEngine", {
        authority: "CORRIDOR_EXECUTION_ENGINE",
        corridorId,
        message,
        repositoryTruthUnchanged: true,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [
    activeCommercialOpportunity?.opportunityId,
    activeCommercialOpportunity?.routeRepositoryId,
    activeFinancialDraft?.routeId,
    activeRouteMiles,
    accountCustomerTwin?.customerTwinId,
    corridorExecutionGeometry,
    corridorExecutionGeometryKey,
    displayedTransparentEstimate?.estimateId,
    generatedRouteRepositorySnapshot?.geometryHash,
    generatedRouteRepositorySnapshot?.routeId,
    selectedAccount.accountId,
  ]);
  const productDoctrineRouteSegmentsKey = (activeFinancialDraft?.routeSegments ?? [])
    .map((segment) => `${segment.segmentId}:${segment.fromMile}:${segment.toMile}:${segment.routeMiles}`)
    .join("|");
  const productDoctrineRouteSegments = useMemo(
    () => (activeFinancialDraft?.routeSegments ?? []).map((segment) => ({
      segmentId: segment.segmentId,
      label: segment.label,
      fromMile: segment.fromMile,
      toMile: segment.toMile,
      routeMiles: segment.routeMiles,
      fiberFeet: segment.fiberFeet,
      ductFeet: segment.ductFeet,
      constructionCost: 0,
    })),
    [productDoctrineRouteSegmentsKey],
  );
  const productDoctrineAssembly = useMemo(() => {
    if (!selectedProductDoctrine) return null;
    const releasedSnapshot = objectRecord(selectedReleaseProposalRevision?.snapshot);
    const releasedEstimateControls = objectRecord(releasedSnapshot?.estimateControls);
    const releasedTransparentEstimate = objectRecord(releasedSnapshot?.transparentEstimate);
    const releasedConfiguration = objectRecord(releasedSnapshot?.productConfiguration)
      ?? objectRecord(releasedEstimateControls?.projectConfiguration)
      ?? displayedTransparentEstimateControls.projectConfiguration;
    const releasedQuantities = objectRecord(releasedSnapshot?.constructionQuantities)
      ?? objectRecord(releasedTransparentEstimate?.physicalQuantities)
      ?? displayedTransparentEstimate?.physicalQuantities;
    const routePlan = activeLiveSession?.routePlan ?? selectedRoutePlans[0];
    const routedGeometry = commercialRouteResult?.status === "ROUTED"
      ? commercialRouteResult.geometry?.map((point) => [point.longitude, point.latitude] as DALCoordinate) ?? []
      : [];
    const centerline = activeFinancialDraft?.geometry ?? opportunityScoutQuickQuote?.geometry ?? activeLiveSession?.activeEditableRouteGeometry ?? routePlan?.stationedCorridor?.centerlineRoute.geometry ?? routedGeometry;
    const routeMiles = activeFinancialDraft?.routeMiles ?? opportunityScoutQuickQuote?.routeMiles ?? commercialRouteResult?.routeMiles ?? selectedPricingSummary.reconciliation.routeMiles;
    const routeFeet = activeFinancialDraft?.routeFeet ?? Math.round(routeMiles * 5280);
    const routeId = activeFinancialDraft?.routeId ?? opportunityScoutQuickQuote?.candidateId ?? commercialRouteResult?.routeId ?? routePlan?.routeRequirement.routeRequirementId ?? `${selectedAccount.accountId}-POINT-TO-POINT`;
    const siteFromLocation = (role: "A" | "Z", location: ResolvedLocation | undefined | null, fallbackCoordinate: DALCoordinate | undefined, fallbackLabel: string): ProductDoctrineSite | null => {
      const coordinate = location ? [location.longitude, location.latitude] as DALCoordinate : fallbackCoordinate;
      if (!coordinate) return null;
      return {
        siteId: `${POINT_TO_POINT_LONG_HAUL_PRODUCT_ID}:SITE:${role}:${selectedAccount.accountId}`,
        role,
        label: location?.label ?? fallbackLabel,
        coordinate,
        source: location?.source ?? "OSRM_CENTERLINE",
      };
    };
    const aSite = siteFromLocation("A", azOriginLocation ?? opportunityScoutCandidate?.originLocation, centerline[0], activeFinancialDraft?.aLabel ?? "A location");
    const zSite = siteFromLocation("Z", azDestinationLocation ?? opportunityScoutCandidate?.destinationLocation, centerline[centerline.length - 1], activeFinancialDraft?.zLabel ?? "Z location");
    const authoritativeRoute = centerline.length > 1 && routeFeet > 0 ? {
      routeId,
      source: activeCommercialOpportunity?.routeRepositoryId || generatedRouteRepositorySnapshot?.routeRepositoryId
        ? "COMMERCIAL_ROUTE_REPOSITORY" as const
        : commercialRouteResult?.status === "ROUTED" ? "OSRM_ASSISTED_ROUTE" as const : "OTHER_GOVERNED_SOURCE" as const,
      routeMiles,
      routeFeet,
      distanceMeters: Math.round(routeFeet / 3.28084),
      geometry: centerline,
      routeAuthority: activeCommercialOpportunity?.routeRepositoryId ?? generatedRouteRepositorySnapshot?.routeRepositoryId ?? "COMMERCIAL_WORKING_ROUTE",
      routeRevision: String(activeCommercialOpportunity?.routeRevision ?? generatedRouteRepositorySnapshot?.routeRevision ?? 1),
      routeHash: activeCommercialOpportunity?.geometryHash ?? generatedRouteRepositorySnapshot?.geometryHash ?? activeFinancialGeometryAuthorityKey,
      measurementAuthority: "COMMERCIAL_ROUTE_REPOSITORY",
    } : null;
    const assemblyInput: PointToPointLongHaulDoctrineInput = {
      accountId: selectedAccount.accountId,
      customerId: customerIdForAccount(selectedAccount.accountId),
      aSite,
      zSite,
      authoritativeRoute,
      osrmRoute: authoritativeRoute,
      routeSegments: productDoctrineRouteSegments,
      stationIntervalFeet: activeFinancialDraft?.stationIntervalFeet ?? 5280,
      projectConfiguration: {
        configurationId: `${activeCommercialOpportunity?.opportunityId ?? routeId}:DUCT-DARK-FIBER-CONFIG:R${releasedConfiguration.configurationRevision ?? 1}`,
        configurationRevision: releasedConfiguration.configurationRevision ?? 1,
        organizationId: currentOrganizationId,
        tenantId: currentOrganizationId,
        customerId: customerIdForAccount(selectedAccount.accountId),
        opportunityId: activeCommercialOpportunity?.opportunityId ?? routeId,
        productId: POINT_TO_POINT_LONG_HAUL_PRODUCT_ID,
        productVersion: "1",
        doctrineId: selectedProductDoctrine.doctrineId,
        doctrineVersion: selectedProductDoctrine.doctrineVersion,
        ductCount: releasedConfiguration.ductCount,
        ductDiameter: releasedConfiguration.ductDiameter,
        ductMaterialSpec: releasedConfiguration.ductMaterialSpec,
        fiberCount: releasedConfiguration.fiberCount,
        fiberCableType: releasedConfiguration.fiberCableType,
        fiberPlacementPolicy: releasedConfiguration.fiberPlacementPolicy,
        slackPolicy: {
          mode: releasedConfiguration.slackPolicyMode,
          slackPercent: releasedConfiguration.slackPercent,
          authority: releasedConfiguration.slackAuthority,
          source: releasedConfiguration.slackSource,
          revision: releasedConfiguration.slackRevision,
        },
        structurePlanAuthority: releasedConfiguration.structurePlanAuthority,
        handholeCount: releasedQuantities?.handholeCount,
        vaultCount: releasedQuantities?.vaultCount,
        spliceArchitectureAuthority: releasedConfiguration.spliceArchitectureAuthority,
        spliceCaseCount: releasedQuantities?.spliceCaseCount,
        terminationConfiguration: releasedConfiguration.terminationConfiguration,
        routeSource: authoritativeRoute?.source ?? "UNKNOWN",
        routeAuthority: authoritativeRoute?.routeAuthority ?? "COMMERCIAL_ROUTE_REPOSITORY",
        routeRevision: authoritativeRoute?.routeRevision ?? "1",
        routeHash: authoritativeRoute?.routeHash ?? "UNRESOLVED",
        measurementAuthority: authoritativeRoute?.measurementAuthority ?? "COMMERCIAL_ROUTE_REPOSITORY",
        changeReason: "Bound to the exact saved Proposal Revision construction quantities.",
        createdAt: selectedReleaseProposalRevision?.createdAt ?? activeProposalRuntime?.createdAt ?? "2026-07-01T00:00:00.000Z",
        createdBy: selectedReleaseProposalRevision?.createdByName ?? currentUserName,
        noScopeVersionCreation: true as const,
      } as PointToPointLongHaulDoctrineInput["projectConfiguration"],
    };
    return schedulePointToPointLongHaulDoctrineAssembly(
      `PRODUCT-DOCTRINE-${selectedAccount.accountId}-${routeId}`,
      assemblyInput,
    );
  }, [
    activeFinancialDraft?.aLabel,
    activeFinancialGeometryAuthorityKey,
    activeFinancialDraft?.routeFeet,
    activeFinancialDraft?.routeId,
    activeFinancialDraft?.routeMiles,
    activeFinancialDraft?.stationIntervalFeet,
    activeCommercialOpportunity?.geometryHash,
    activeCommercialOpportunity?.routeRepositoryId,
    activeCommercialOpportunity?.routeRevision,
    activeLiveSession,
    azDestinationLocation,
    azOriginLocation,
    commercialRouteResult,
    opportunityScoutCandidate,
    opportunityScoutQuickQuote,
    selectedAccount.accountId,
    generatedRouteRepositorySnapshot?.geometryHash,
    generatedRouteRepositorySnapshot?.routeRepositoryId,
    generatedRouteRepositorySnapshot?.routeRevision,
    productDoctrineRouteSegments,
    selectedProductDoctrine,
    selectedReleaseProposalRevision,
    displayedTransparentEstimate?.physicalQuantities,
    displayedTransparentEstimateControls.projectConfiguration,
    currentOrganizationId,
    currentUserName,
    selectedRoutePlans,
  ]);
  const commercialDraftIofPackagePreview = useMemo<DraftIofPackageRuntime | null>(() => {
    const routePlan = activeLiveSession?.routePlan ?? selectedRoutePlans[0];
    if (!routePlan && !activeProposalRuntime && !activeFinancialDraft && !opportunityScoutQuickQuote) return null;
    const proposalId = activeProposalRuntime?.proposalId ?? currentCommercialRecordIds.proposalId;
    const geometry = activeLiveSession?.activeEditableRouteGeometry ?? routePlan?.stationedCorridor?.centerlineRoute.geometry ?? routePlan?.proposedGraph?.centerlineRoute?.geometry ?? activeFinancialDraft?.geometry ?? opportunityScoutQuickQuote?.geometry ?? [];
    const proposalSource = {
      ...(activeProposalRuntime ?? {}),
      proposalId,
      proposalRecordId: activeProposalRuntime?.proposalRecordId ?? proposalId,
      proposalNumber: activeProposalRuntime?.proposalNumber ?? proposalId,
      customerId: activeProposalRuntime?.customerId ?? customerIdForAccount(selectedAccount.accountId),
      accountId: selectedAccount.accountId,
      customerName: selectedAccount.name,
      opportunityId: activeProposalRuntime?.opportunityId ?? (activeCommercialOpportunityId || activeCommercialOpportunity?.opportunityId || routePlan?.routeRequirement.routeRequirementId || `${proposalId}:OPPORTUNITY`),
      organizationId: activeProposalRuntime?.organizationId ?? currentOrganizationId,
      workspaceId: activeProposalRuntime?.workspaceId ?? currentWorkspaceId,
      owner: activeProposalRuntime?.owner ?? currentUserName,
      ownerId: activeProposalRuntime?.ownerId ?? currentUserId,
      commercialOwner: activeProposalRuntime?.commercialOwner ?? currentUserName,
      commercialOwnerId: activeProposalRuntime?.commercialOwnerId ?? currentUserId,
      productId: activeProposalRuntime?.productId ?? selectedProductOption.productId,
      productName: activeProposalRuntime?.productName ?? selectedProductOption.productName,
      title: activeProposalRuntime?.title ?? `${activeOpportunityDisplayName} Commercial Proposal`,
      summary: activeProposalRuntime?.summary ?? `Commercial proposal for ${activeOpportunityDisplayName}.`,
      executiveSummary: activeProposalRuntime?.executiveSummary ?? preview.executiveSummary,
      status: activeProposalRuntime?.status ?? "DRAFT",
      approvalState: activeProposalRuntime?.approvalState ?? "NOT_SUBMITTED",
      version: activeProposalRuntime?.version ?? 1,
      pricingSummary: activeProposalRuntime?.pricingSummary ?? selectedPricingSummary.reconciliation,
      marginSummary: activeProposalRuntime?.marginSummary ?? {
        grossMarginDollars: selectedPricingSummary.reconciliation.grossMarginDollars,
        grossMarginPercent: selectedPricingSummary.reconciliation.grossMarginPercent,
      },
      confidenceSummary: activeProposalRuntime?.confidenceSummary ?? {
        commercialReadiness: activeFinancialDraft?.transparentEstimate.commercialReadiness.score ?? opportunityScoutQuickQuote?.confidence ?? 0,
        pricingStatus: selectedPricingSummary.reconciliation.combinedAwardAdjustmentStatus,
      },
      commercialAssumptionIds: activeProposalRuntime?.commercialAssumptionIds ?? [selectedAssumptionState.stateId],
      dealPointIds: activeProposalRuntime?.dealPointIds ?? selectedScope.routeRequirementIds,
      runtimeObjectIds: activeProposalRuntime?.runtimeObjectIds ?? [
        activeCommercialOpportunity?.runtimeObjectId,
        selectedImportedCustomerDesignImport?.designImportId,
        ...activeCommercialDraftNetworks.map((network) => network.networkId),
      ].filter(Boolean),
      runtimeRelationshipIds: activeProposalRuntime?.runtimeRelationshipIds ?? [
        activeCommercialOpportunity?.opportunityId ? `DERIVED_FROM:${activeCommercialOpportunity.opportunityId}` : "",
        routePlan?.routeRequirement.routeRequirementId ? `PROPOSES_ROUTE:${routePlan.routeRequirement.routeRequirementId}` : "",
      ].filter(Boolean),
      runtimeEvidenceIds: activeProposalRuntime?.runtimeEvidenceIds ?? [],
      existingInventoryReferences: activeProposalRuntime?.existingInventoryReferences ?? activeExistingReferenceNetworkIds,
      customerDesignReferences: activeProposalRuntime?.customerDesignReferences ?? (selectedImportedCustomerDesignImport ? [selectedImportedCustomerDesignImport.designId] : []),
      customerTwinReference: activeProposalRuntime?.customerTwinReference ?? accountCustomerTwin?.customerTwinId ?? `CUSTOMER-TWIN-${selectedAccount.accountId}`,
      geometryReferences: activeProposalRuntime?.geometryReferences ?? [routePlan?.routeRequirement.routeRequirementId, ...geometry.map((coordinate, index) => `${proposalId}:geometry:${index}:${coordinate.join(",")}`)].filter(Boolean).slice(0, 20),
      proposalDocumentReferences: activeProposalRuntime?.proposalDocumentReferences ?? ["Executive summary", "Commercial pricing summary", "Interactive proposal map"],
      proposalRecipientContactIds,
      customerReviewContactIds,
      approvalAuthorityContactIds,
      sofRecipientContactIds,
      customerContactEmails,
      createdAt: activeProposalRuntime?.createdAt ?? "2026-07-01T00:00:00.000Z",
      updatedAt: activeProposalRuntime?.updatedAt ?? "2026-07-01T00:00:00.000Z",
      currentAuthority: activeProposalRuntime?.currentAuthority ?? "COMMERCIAL_REVISION",
      commercialRevisionId: activeProposalRuntime?.commercialRevisionId,
      revisionId: activeProposalRuntime?.revisionId,
      commercialRevisionHash: activeProposalRuntime?.commercialRevisionHash,
      commercialRepositoryId: activeProposalRuntime?.commercialRepositoryId,
      proposalAuthorityFlow: activeProposalRuntime?.proposalAuthorityFlow ?? {
        inputAuthority: "COMMERCIAL_REVISION",
        projection: "PROPOSAL_PROJECTION",
        repository: "PROPOSAL_REPOSITORY",
        proposalOutputUnchanged: true,
        pricingOutputUnchanged: true,
        workbookOutputUnchanged: true,
        noScopeVersionCreation: true,
      },
      noScopeVersionCreation: true,
      noInventoryMutation: true,
    } as Partial<ProposalRuntimeObject> & { proposalId: string; customerId: string; opportunityId?: string };
    const assembledDraft = scheduleDraftIofPackageAssembly({
      proposal: proposalSource,
      customerName: selectedAccount.name,
      accountId: selectedAccount.accountId,
      commercialCandidate: (activeFinancialDraft ?? opportunityScoutQuickQuote ?? activeCommercialOpportunity ?? null) as Record<string, unknown> | null,
      commercialDraft: activeFinancialDraft,
      quickQuote: opportunityScoutQuickQuote,
      designArtifacts: [
        selectedImportedCustomerDesignImport,
        selectedImportedCustomerRoute,
        activeCommercialOpportunity,
        routePlan,
      ].filter(Boolean),
      graph: importedCustomerDesignGraph ?? accountCustomerNetworkGraph ?? accountCustomerTwin,
      stationing: activeFinancialDraft?.routeSegments ?? [],
      objectInventory: accountNetworkInventory,
      pricing: {
        pricingSummary: selectedPricingSummary.reconciliation,
        financialAuthority: activeFinancialAuthority,
        transparentEstimate: activeFinancialDraft?.transparentEstimate,
      },
      validation: commercialDraftValidation,
      productDoctrine: selectedProductDoctrine,
      productDoctrineAssembly,
      selectedRoutePlans,
      assignedEngineerId: currentUserId,
      assignedEngineer: currentUserName,
      priority: "NORMAL",
      generatedAt: activeProposalRuntime?.updatedAt ?? "2026-07-01T00:00:00.000Z",
      ownerId: activeProposalRuntime?.ownerId ?? currentUserId,
      owner: activeProposalRuntime?.owner ?? currentUserName,
      organizationId: currentOrganizationId,
      workspaceId: currentWorkspaceId,
      runtimeObjectIds: activeProposalRuntime?.runtimeObjectIds,
      runtimeRelationshipIds: activeProposalRuntime?.runtimeRelationshipIds,
      runtimeEvidenceIds: activeProposalRuntime?.runtimeEvidenceIds,
      existingInventoryReferences: activeProposalRuntime?.existingInventoryReferences,
      customerDesignReferences: activeProposalRuntime?.customerDesignReferences,
      customerTwinReference: activeProposalRuntime?.customerTwinReference ?? accountCustomerTwin?.customerTwinId ?? `CUSTOMER-TWIN-${selectedAccount.accountId}`,
      geometryReferences: activeProposalRuntime?.geometryReferences,
      routeGeometryHash: activeFinancialGeometryAuthorityKey,
      stationAuthorityRevision: `${activeFinancialDraft?.routeId ?? "NO-ROUTE"}:${activeFinancialDraft?.stationIntervalFeet ?? "NO-INTERVAL"}:${productDoctrineRouteSegmentsKey}`,
      objectInventoryAuthorityRevision: accountNetworkInventory
        .map((network) => `${network.networkId}:${network.inventorySessionVersion ?? network.revisionCount}:${network.lastUpdated}`)
        .sort()
        .join("|"),
      commercialRevisionId: String(activeProposalRuntime?.commercialRevisionId ?? "") || undefined,
      revisionId: String(activeProposalRuntime?.revisionId ?? "") || undefined,
      commercialRevisionHash: String(activeProposalRuntime?.commercialRevisionHash ?? "") || undefined,
      commercialRepositoryId: String(activeProposalRuntime?.commercialRepositoryId ?? "") || undefined,
      currentAuthority: String(activeProposalRuntime?.currentAuthority ?? "COMMERCIAL_REVISION"),
    }).value;
    const routeRepositoryId = String(
      generatedRouteRepositorySnapshot?.routeRepositoryId ??
        activeCommercialOpportunity?.routeRepositoryId ??
        activeCommercialOpportunity?.routeRepositoryRef?.routeRepositoryId ??
        activeProposalRuntime?.routeRepositoryId ??
        "",
    );
    const routeGeometryIdValue = String(
      generatedRouteRepositorySnapshot?.routeGeometryId ??
        activeCommercialOpportunity?.routeRepositorySnapshot?.routeGeometryId ??
        (activeCommercialOpportunity?.routeRepositoryRef as any)?.routeGeometryId ??
        "",
    );
    const geometryHash = String(
      generatedRouteRepositorySnapshot?.geometryHash ??
        activeCommercialOpportunity?.routeRepositorySnapshot?.geometryHash ??
        (activeCommercialOpportunity?.routeRepositoryRef as any)?.geometryHash ??
        "",
    );
    const routeRevision = Number(
      generatedRouteRepositorySnapshot?.routeRevision ??
        activeCommercialOpportunity?.routeRepositorySnapshot?.routeRevision ??
        activeCommercialOpportunity?.routeRevision ??
        1,
    );
    const estimateId = String(
      activeFinancialDraft?.transparentEstimate.estimateId ??
        activeProposalRuntime?.estimateId ??
        activeCommercialOpportunity?.estimateId ??
        activeCommercialOpportunity?.estimate?.estimateId ??
        "",
    );
    const workbookId = String(
      activeCommercialOpportunity?.workbookId ??
        activeCommercialOpportunity?.commercialWorkbookId ??
        activeProposalRuntime?.commercialWorkbookId ??
        activeProposalRuntime?.workbookId ??
        currentCommercialRecordIds.workbookId ??
        "",
    );
    const commercialRevisionId = String(
      activeProposalRuntime?.commercialRevisionId ??
        activeProposalRuntime?.revisionId ??
        activeCommercialOpportunity?.commercialRevisionId ??
        "",
    );
    return {
      ...assembledDraft,
      projectConfiguration: productDoctrineAssembly?.projectConfiguration,
      routeRepositoryId,
      routeRevision,
      routeRepositoryRef: {
        routeRepositoryId,
        routeGeometryId: routeGeometryIdValue,
        geometryHash,
        routeRevision,
        repositoryType: "COMMERCIAL_ROUTE_REPOSITORY",
      },
      routeGeometryId: routeGeometryIdValue,
      geometryHash,
      estimateId,
      commercialEstimateId: estimateId,
      workbookId,
      commercialWorkbookId: workbookId,
      commercialRevisionId,
      revisionId: String(activeProposalRuntime?.revisionId ?? commercialRevisionId),
      commercialRevisionHash: String(activeProposalRuntime?.commercialRevisionHash ?? activeCommercialOpportunity?.commercialRevisionHash ?? "") || undefined,
      commercialRepositoryId: String(activeProposalRuntime?.commercialRepositoryId ?? activeCommercialOpportunity?.commercialRepositoryId ?? "") || undefined,
      commercialReleasePackageId: String(activeProposalRuntime?.commercialReleasePackageId ?? activeCommercialOpportunity?.commercialReleasePackageId ?? "") || undefined,
      commercialReleaseHash: String(activeProposalRuntime?.commercialReleaseHash ?? activeCommercialOpportunity?.commercialReleaseHash ?? "") || undefined,
      commercialSummary: {
        ...assembledDraft.commercialSummary,
        routeRepositoryId,
        routeGeometryId: routeGeometryIdValue,
        geometryHash,
        routeRevision,
        estimateId,
        workbookId,
        commercialWorkbookId: workbookId,
        proposalId,
        commercialRevisionId,
        commercialReleasePackageId: String(activeProposalRuntime?.commercialReleasePackageId ?? activeCommercialOpportunity?.commercialReleasePackageId ?? "") || undefined,
      },
    } as DraftIofPackageRuntime;
  }, [
    accountCustomerNetworkGraph,
    accountCustomerTwin,
    accountNetworkInventory,
    activeCommercialDraftNetworks,
    activeCommercialOpportunity,
    activeCommercialOpportunityId,
    activeOpportunityDisplayName,
    activeFinancialAuthority,
    activeFinancialDraft,
    activeLiveSession,
    activeProposalRuntime,
    approvalAuthorityContactIds,
    commercialDraftValidation,
    currentOrganizationId,
    currentCommercialRecordIds.proposalId,
    currentUserId,
    currentUserName,
    currentWorkspaceId,
    customerContactEmails,
    customerReviewContactIds,
    importedCustomerDesignGraph,
    opportunityScoutQuickQuote,
    preview.executiveSummary,
    proposalRecipientContactIds,
    selectedAccount.accountId,
    selectedAccount.name,
    selectedAssumptionState.stateId,
    activeExistingReferenceNetworkIds,
    generatedRouteRepositorySnapshot,
    selectedImportedCustomerDesignImport,
    selectedImportedCustomerRoute,
    selectedPricingSummary,
    selectedProductDoctrine,
    selectedProductOption,
    productDoctrineAssembly,
    selectedRoutePlans,
    selectedScope.label,
    selectedScope.routeRequirementIds,
    selectedScope.scopeId,
    sofRecipientContactIds,
  ]);

  async function ensureCommercialLifecycleAuthorityForDraft(
    draftSource: DraftIofPackageRuntime,
    routeRepositoryId: string,
    lifecycleStage: "AUTOMATIC_IOF_PACKAGE_ASSEMBLY" | "MANUAL_DRAFT_IOF_SAVE" | "COMMERCIAL_TO_ENGINEERING_HANDOFF",
    proposalRevision = selectedReleaseProposalRevision,
  ): Promise<{
    draftPackage: DraftIofPackageRuntime;
    revision: CommercialRevisionRuntime;
    releasePackage: CommercialReleasePackageRuntime;
    restoredDraftPackage: boolean;
  }> {
    const routeRepositoryRef = objectRecord((draftSource as any).routeRepositoryRef);
    const routeRepositoryIdValue = String(routeRepositoryId || draftSource.routeRepositoryId || routeRepositoryRef?.routeRepositoryId || "").trim();
    const proposalId = String(draftSource.proposalId ?? activeProposalRuntime?.proposalId ?? currentCommercialRecordIds.proposalId ?? "").trim();
    const proposalRevisionId = String(proposalRevision?.proposalRevisionId ?? draftSource.proposalRevisionId ?? "").trim();
    const proposalHash = String(proposalRevision?.proposalHash ?? draftSource.proposalHash ?? "").trim();
    const proposalRevisionNumber = Number(proposalRevision?.revisionNumber ?? draftSource.proposalRevisionNumber ?? 0);
    const opportunityId = String(draftSource.opportunityId ?? activeCommercialOpportunity?.opportunityId ?? activeCommercialOpportunityId ?? "").trim();
    const estimateId = String(
      draftSource.estimateId ??
        draftSource.commercialEstimateId ??
        activeFinancialDraft?.transparentEstimate.estimateId ??
        activeProposalRuntime?.estimateId ??
        activeCommercialOpportunity?.estimateId ??
        `ESTIMATE-${cleanCommercialSlug(proposalId || opportunityId)}`,
    ).trim();
    const workbookId = String(
      draftSource.workbookId ??
        draftSource.commercialWorkbookId ??
        activeCommercialOpportunity?.workbookId ??
        activeCommercialOpportunity?.commercialWorkbookId ??
        activeProposalRuntime?.commercialWorkbookId ??
        activeProposalRuntime?.workbookId ??
        currentCommercialRecordIds.workbookId ??
        `WORKBOOK-${cleanCommercialSlug(proposalId || opportunityId)}`,
    ).trim();
    const missing = [
      ["Route Repository", routeRepositoryIdValue, "Generate Route and wait for Route Repository commit."],
      ["Proposal", proposalId, "Save Proposal or allow the governed proposal ID to resolve."],
      ["Saved Proposal Revision", proposalRevisionId, "Select an immutable saved Proposal Revision."],
      ["Proposal Hash", proposalHash, "Save the exact Proposal Revision before release."],
      ["Opportunity", opportunityId, "Create or restore the Commercial Opportunity."],
      ["Estimate", estimateId, "Let the Commercial estimate projection resolve before IOF assembly."],
      ["Workbook", workbookId, "Let the Commercial workbook projection resolve before IOF assembly."],
    ].filter(([, value]) => !String(value ?? "").trim());
    if (missing.length) {
      const [authority, , recommendation] = missing[0];
      throw new Error(`${authority} missing. ${lifecycleStage} blocked. ${recommendation}`);
    }

    const localDraftPackageCandidate = commercialDraftIofPackage ?? activeDraftIofPackage;
    const inMemoryDraftPackage = localDraftPackageCandidate && String(localDraftPackageCandidate.packageId ?? "") === String(draftSource.packageId ?? "")
      ? localDraftPackageCandidate
      : null;
    const existingDraftPackages = inMemoryDraftPackage
      ? [inMemoryDraftPackage]
      : lifecycleStage === "AUTOMATIC_IOF_PACKAGE_ASSEMBLY"
        ? await listCommercialDraftIofPackages(session).catch(() => [] as DraftIofPackageRuntime[])
        : [];
    const existingDraftPackage = existingDraftPackages.find((draft) => (
      String(draft.routeRepositoryId ?? (draft.routeRepositoryRef as any)?.routeRepositoryId ?? "") === routeRepositoryIdValue &&
      String(draft.proposalRevisionId ?? "") === proposalRevisionId &&
      String(draft.proposalHash ?? "") === proposalHash &&
      Boolean(draft.commercialRevisionId) &&
      Boolean(draft.commercialReleasePackageId)
    ));
    const existingRevisions = await CommercialRevisionRepository.listRevisions(session).catch(() => [] as CommercialRevisionRuntime[]);
    const existingReleasePackages = await CommercialReleasePackageRepository.listReleasePackages(session).catch(() => [] as CommercialReleasePackageRuntime[]);

    let revision = existingRevisions.find((item) => (
      String(item.commercialRevisionId) === String(draftSource.commercialRevisionId ?? draftSource.revisionId ?? existingDraftPackage?.commercialRevisionId ?? "") &&
      String(item.proposalRevisionId ?? "") === proposalRevisionId &&
      String(item.proposalHash ?? "") === proposalHash
    )) ?? existingRevisions.find((item) => (
      String(item.routeRepositoryId) === routeRepositoryIdValue &&
      String(item.opportunityId) === opportunityId &&
      String(item.proposalId) === proposalId &&
      String(item.proposalRevisionId ?? "") === proposalRevisionId &&
      String(item.proposalHash ?? "") === proposalHash
    ));

    if (!revision) {
      revision = await CommercialRevisionRepository.saveRevision({
        opportunityId,
        routeRepositoryId: routeRepositoryIdValue,
        proposalId,
        proposalRevisionId,
        proposalHash,
        proposalRevisionNumber,
        estimateId,
        workbookId,
        commercialWorkbookId: workbookId,
        productDoctrineId: String(draftSource.productDoctrineId ?? draftSource.doctrineId ?? selectedProductDoctrine?.doctrineId ?? "PD-001"),
        commercialDoctrineId: String((draftSource as any).commercialDoctrineId ?? selectedAssumptionState.stateId ?? "COMMERCIAL-DOCTRINE-POINT-TO-POINT"),
        revisionStatus: "DRAFT",
        commercialReleaseState: "OPEN",
        createdBy: currentUserName,
        createdById: currentUserId,
        createdOn: new Date().toISOString(),
      }, session);
    }

    let releasePackage = existingReleasePackages.find((item) => (
      String(item.commercialReleasePackageId) === String(draftSource.commercialReleasePackageId ?? existingDraftPackage?.commercialReleasePackageId ?? "") &&
      String(item.proposalRevisionId ?? "") === proposalRevisionId &&
      String(item.proposalHash ?? "") === proposalHash
    )) ?? existingReleasePackages.find((item) => (
      String(item.commercialRevisionId) === String(revision.commercialRevisionId) &&
      String(item.routeRepositoryId) === routeRepositoryIdValue &&
      String(item.proposalRevisionId ?? "") === proposalRevisionId &&
      String(item.proposalHash ?? "") === proposalHash
    ));

    if (!releasePackage) {
      releasePackage = await CommercialReleasePackageRepository.saveReleasePackage({
        commercialRevisionId: revision.commercialRevisionId,
        revisionId: revision.revisionId,
        opportunityId,
        repositoryId: revision.repositoryId,
        routeRepositoryId: routeRepositoryIdValue,
        estimateId,
        workbookId,
        commercialWorkbookId: workbookId,
        proposalId,
        proposalRevisionId,
        proposalHash,
        proposalRevisionNumber,
        productDoctrineId: revision.productDoctrineId,
        commercialDoctrineId: revision.commercialDoctrineId,
        revisionHash: revision.revisionHash,
        evidenceReferences: revision.evidenceReferences,
        changeSetIds: revision.changeSetIds as string[] | undefined,
        patchCount: Number(revision.patchCount ?? 0),
        activePatchCount: Number(revision.activePatchCount ?? 0),
        appliedPatchCount: Number(revision.appliedPatchCount ?? 0),
        status: "FROZEN",
        commercialReleaseState: "RELEASED",
        createdBy: currentUserName,
        createdById: currentUserId,
      }, session);
    }

    const existingManifestValidationStatus = String(
      objectRecord(objectRecord(existingDraftPackage?.engineeringObjectManifest)?.validation)?.status ??
        objectRecord(existingDraftPackage?.validationSummary)?.status ??
        "",
    ).toUpperCase();
    const reusableExistingDraftPackage = existingDraftPackage && existingManifestValidationStatus === "PASS"
      ? existingDraftPackage
      : null;

    if (reusableExistingDraftPackage) {
      return {
        draftPackage: reusableExistingDraftPackage,
        revision,
        releasePackage,
        restoredDraftPackage: true,
      };
    }

    const authorityDraft = {
      ...draftSource,
      routeRepositoryId: routeRepositoryIdValue,
      routeRepositoryRef: {
        ...(routeRepositoryRef ?? {}),
        routeRepositoryId: routeRepositoryIdValue,
        routeGeometryId: String(draftSource.routeGeometryId ?? routeRepositoryRef?.routeGeometryId ?? generatedRouteRepositorySnapshot?.routeGeometryId ?? ""),
        geometryHash: String(draftSource.geometryHash ?? routeRepositoryRef?.geometryHash ?? generatedRouteRepositorySnapshot?.geometryHash ?? ""),
        routeRevision: Number(draftSource.routeRevision ?? routeRepositoryRef?.routeRevision ?? generatedRouteRepositorySnapshot?.routeRevision ?? 1),
        repositoryType: "COMMERCIAL_ROUTE_REPOSITORY",
      },
      proposalId,
      proposalRevisionId,
      proposalHash,
      proposalRevisionNumber,
      lifecycleSequence: 4,
      opportunityId,
      estimateId,
      commercialEstimateId: estimateId,
      workbookId,
      commercialWorkbookId: workbookId,
      commercialRevisionId: revision.commercialRevisionId,
      revisionId: revision.revisionId,
      commercialRevisionHash: revision.revisionHash,
      commercialRepositoryId: revision.repositoryId,
      commercialReleasePackageId: releasePackage.commercialReleasePackageId,
      commercialReleaseHash: releasePackage.releaseHash,
      commercialReleaseState: releasePackage.commercialReleaseState,
      repositoryHash: revision.repositoryHash,
      projectionHash: revision.projectionHash,
      currentAuthority: "COMMERCIAL_RELEASE_PACKAGE",
      automaticIofPackageAssembly: lifecycleStage === "AUTOMATIC_IOF_PACKAGE_ASSEMBLY" ? true : draftSource.automaticIofPackageAssembly,
      commercialSummary: {
        ...(objectRecord(draftSource.commercialSummary) ?? {}),
        routeRepositoryId: routeRepositoryIdValue,
        proposalId,
        proposalRevisionId,
        proposalHash,
        proposalRevisionNumber,
        estimateId,
        workbookId,
        commercialWorkbookId: workbookId,
        commercialRevisionId: revision.commercialRevisionId,
        commercialReleasePackageId: releasePackage.commercialReleasePackageId,
      },
    } as DraftIofPackageRuntime;

    return {
      draftPackage: authorityDraft,
      revision,
      releasePackage,
      restoredDraftPackage: false,
    };
  }

  useEffect(() => {
    let cancelled = false;
    const routeRepositoryId = generatedRouteRepositorySnapshot?.routeRepositoryId ?? "";
    if (!routeRepositoryId) return;
    if (!commercialDraftIofPackagePreview) return;
    if (!selectedReleaseProposalEligible || !selectedReleaseProposalRevision) return;
    if (automaticIofAssemblyRouteRepositoryId === routeRepositoryId) return;
    if (
      commercialDraftIofPackage?.routeRepositoryId === routeRepositoryId &&
      commercialDraftIofPackage.commercialRevisionId &&
      commercialDraftIofPackage.commercialReleasePackageId
    ) {
      setAutomaticIofAssemblyRouteRepositoryId(routeRepositoryId);
      setCommercialLifecycleSequencingNotice(`Draft IOF Package ${commercialDraftIofPackage.packageId} already assembled for Route Repository ${routeRepositoryId}.`);
      return;
    }
    setAutomaticIofAssemblyRouteRepositoryId(routeRepositoryId);
    console.log("[CIP-035A] Commercial lifecycle sequencing started", {
      routeRepositoryId,
      draftIofPackageId: commercialDraftIofPackagePreview.packageId,
    });
    setCommercialLifecycleSequencingNotice(`Route Repository ${routeRepositoryId} committed. Creating Commercial Revision before IOF assembly.`);
    ensureCommercialLifecycleAuthorityForDraft(
      {
        ...commercialDraftIofPackagePreview,
        automaticIofPackageAssembly: true,
        repositoryAssemblyStatus: "PENDING_COMMERCIAL_AUTHORITY",
      },
      routeRepositoryId,
      "AUTOMATIC_IOF_PACKAGE_ASSEMBLY",
    )
      .then((authority) => {
        if (cancelled) return null;
        if (authority.restoredDraftPackage) {
          setCommercialDraftIofPackage(authority.draftPackage);
          setActiveDraftIofPackage(authority.draftPackage);
          setProposalRuntimeNotice(`${authority.draftPackage.packageId} restored from Route Repository ${routeRepositoryId}.`);
          setCommercialLifecycleSequencingNotice(`Route Repository ${routeRepositoryId} already had Draft IOF Package ${authority.draftPackage.packageId}. Automatic assembly skipped.`);
          console.log("[CIP-035A] Automatic IOF Package Assembly restored existing package", {
            routeRepositoryId,
            draftIofPackageId: authority.draftPackage.packageId,
            commercialRevisionId: authority.revision.commercialRevisionId,
            commercialReleasePackageId: authority.releasePackage.commercialReleasePackageId,
          });
          return null;
        }
        setCommercialLifecycleSequencingNotice(`Commercial Revision ${authority.revision.commercialRevisionId} and Release Package ${authority.releasePackage.commercialReleasePackageId} ready. Saving Draft IOF Package.`);
        return saveCommercialDraftIofPackage({
          ...authority.draftPackage,
          automaticIofPackageAssembly: true,
          repositoryAssemblyStatus: "PENDING_REFERENCE_ARTIFACT_PERSISTENCE",
        }, session);
      })
      .then((draft) => {
        if (!draft) return;
        if (cancelled) return;
        setCommercialDraftIofPackage(draft);
        setActiveDraftIofPackage(draft);
        setProposalRuntimeNotice(`${draft.packageId} assembled automatically from Route Repository ${routeRepositoryId}.`);
        setCommercialLifecycleSequencingNotice(`Commercial Ready. Draft IOF Package ${draft.packageId} saved after Commercial Revision and Release Package.`);
        console.log("[CIP-035A] Automatic IOF Package Assembly completed", {
          routeRepositoryId,
          draftIofPackageId: draft.packageId,
          commercialRevisionId: draft.commercialRevisionId,
          commercialReleasePackageId: draft.commercialReleasePackageId,
          repositoryAssemblyStatus: draft.repositoryAssemblyStatus,
        });
      })
      .catch((error) => {
        if (cancelled) return;
        setAutomaticIofAssemblyRouteRepositoryId("");
        setProposalRuntimeNotice(`Automatic IOF Package Assembly failed: ${error instanceof Error ? error.message : String(error)}`);
        setCommercialLifecycleSequencingNotice(`Automatic IOF Assembly blocked. ${error instanceof Error ? error.message : String(error)}`);
        console.warn("[CIP-035A] Automatic IOF Package Assembly failed", {
          routeRepositoryId,
          reason: error instanceof Error ? error.message : String(error),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [
    automaticIofAssemblyRouteRepositoryId,
    activeCommercialOpportunity?.opportunityId,
    activeCommercialOpportunity?.routeRepositoryId,
    activeCommercialOpportunityId,
    activeFinancialDraft?.transparentEstimate.estimateId,
    activeProposalRuntime?.commercialReleasePackageId,
    activeProposalRuntime?.commercialRevisionId,
    activeProposalRuntime?.proposalId,
    selectedReleaseProposalEligible,
    selectedReleaseProposalRevision?.proposalRevisionId,
    selectedReleaseProposalRevision?.proposalHash,
    commercialDraftIofPackage?.routeRepositoryId,
    commercialDraftIofPackage?.commercialRevisionId,
    commercialDraftIofPackage?.commercialReleasePackageId,
    commercialDraftIofPackagePreview,
    currentCommercialRecordIds.workbookId,
    selectedAssumptionState.stateId,
    selectedProductDoctrine?.doctrineId,
    generatedRouteRepositorySnapshot?.routeRepositoryId,
    generatedRouteRepositorySnapshot?.routeGeometryId,
    generatedRouteRepositorySnapshot?.geometryHash,
    session,
  ]);

  function handleBuildProductCommercialDesign() {
    const configuratorId = selectedProductConfiguratorId;
    if (configuratorId !== POINT_TO_POINT_CONFIGURATOR_ID) {
      setProductConfiguratorNotice("No Product Configurator is available for the selected product.");
      return;
    }
    const originLocation = azOriginLocation ?? resolveAzTextInput("A");
    const destinationLocation = azDestinationLocation ?? resolveAzTextInput("Z");
    if (!originLocation || !destinationLocation) {
      setProductConfiguratorNotice("Resolve A and Z before building the Commercial Design.");
      setOpportunityWorkflowState("AWAITING_AZ_INPUT");
      setActiveView("scout");
      return;
    }
    const timestamp = new Date().toISOString();
    const routePlan = activeLiveSession?.routePlan ?? selectedRoutePlans[0];
    const routedGeometry = commercialRouteResult?.status === "ROUTED"
      ? commercialRouteResult.geometry?.map((point) => [point.longitude, point.latitude] as DALCoordinate) ?? []
      : [];
    const routeGeometry = routedGeometry.length > 1
      ? routedGeometry
      : activeFinancialDraft?.geometry?.length
        ? activeFinancialDraft.geometry
        : opportunityScoutQuickQuote?.geometry?.length
          ? opportunityScoutQuickQuote.geometry
          : activeLiveSession?.activeEditableRouteGeometry?.length
            ? activeLiveSession.activeEditableRouteGeometry
            : routePlan?.stationedCorridor?.centerlineRoute?.geometry?.length
              ? routePlan.stationedCorridor.centerlineRoute.geometry
              : routePlan?.proposedGraph?.centerlineRoute?.geometry ?? [];
    const routeMiles = commercialRouteResult?.status === "ROUTED"
      ? commercialRouteResult.routeMiles
      : activeFinancialDraft?.routeMiles ?? opportunityScoutQuickQuote?.routeMiles;
    const opportunityId = activeCommercialOpportunityId ||
      activeCommercialOpportunity?.opportunityId ||
      routePlan?.routeRequirement.routeRequirementId ||
      `${selectedAccount.accountId}-POINT-TO-POINT-OPPORTUNITY`;
    const proposalId = activeProposalRuntime?.proposalId ?? currentCommercialRecordIds.proposalId;
    try {
      const result = executePointToPointConfigurator({
        customer: {
          accountId: selectedAccount.accountId,
          customerId: customerIdForAccount(selectedAccount.accountId),
          customerName: selectedAccount.name,
        },
        opportunity: {
          opportunityId,
          proposalId,
          proposalNumber: activeProposalRuntime?.proposalNumber ?? proposalId,
          title: activeProposalRuntime?.title ?? `${activeOpportunityDisplayName} ${POINT_TO_POINT_PRODUCT_NAME}`,
          summary: activeProposalRuntime?.summary ?? `Commercial Design for ${activeOpportunityDisplayName} ${POINT_TO_POINT_PRODUCT_NAME}.`,
        },
        product: {
          productId: selectedProductOption.productId,
          productName: selectedProductOption.productName,
          defaultTermYears: selectedProductOption.defaultTermYears,
          protected: selectedProductOption.protected,
        },
        aLocation: {
          locationId: originLocation.id,
          label: originLocation.label,
          latitude: originLocation.latitude,
          longitude: originLocation.longitude,
          source: originLocation.source,
        },
        zLocation: {
          locationId: destinationLocation.id,
          label: destinationLocation.label,
          latitude: destinationLocation.latitude,
          longitude: destinationLocation.longitude,
          source: destinationLocation.source,
        },
        routeGeometry: routeGeometry.length > 1 ? routeGeometry : undefined,
        routeId: commercialRouteResult?.status === "ROUTED"
          ? commercialRouteResult.routeId
          : activeFinancialDraft?.routeId ?? routePlan?.routeRequirement.routeRequirementId,
        routeMiles,
        commercialAssumptions: {
          assumptionStateId: selectedAssumptionState.stateId,
          civilMix: selectedAssumptionState.civilMix,
          pricingScopeId: selectedScope.scopeId,
          selectedRouteRequirementIds: selectedScope.routeRequirementIds,
          fulfillmentMix: CARRIER_NEUTRAL_FULFILLMENT_MIX,
        },
        pricingSummary: selectedPricingSummary.reconciliation as unknown as Record<string, unknown>,
        routeSegments: activeFinancialDraft?.routeSegments,
        generatedAt: timestamp,
        ownerId: currentUserId,
        owner: currentUserName,
        organizationId: currentOrganizationId,
        workspaceId: currentWorkspaceId,
      });
      setAzOriginLocation(originLocation);
      setAzDestinationLocation(destinationLocation);
      setProductConfiguratorResult(result);
      setProductConfiguratorNotice(`${result.configuratorId} ${result.configuratorVersion} built ${result.draftPackage.packageId}.`);
      setCommercialDraftIofPackage(result.draftPackage);
      setActiveDraftIofPackage(result.draftPackage);
      setCommercialDraftType("NEW_GRAPH_CORRIDOR");
      setActiveDesignMode("NEW_INDEPENDENT_GRAPH");
      setOpportunityScoutMode("AZ_BUILDER");
      setOpportunityWorkflowState("COMMERCIAL_DRAFT_ACTIVE");
      setActiveView("review");
      setProposalRuntimeNotice(`${result.draftPackage.packageId} created from Product Configurator and loaded into Commercial Review.`);
      setEngineeringCertificationNotice(`${result.draftPackage.packageId} is ready for Commercial Review before Engineering submission.`);
    } catch (error) {
      setProductConfiguratorNotice(`Product Configurator failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const displayedDraftIofPackage = commercialDraftIofPackage ?? commercialDraftIofPackagePreview ?? activeDraftIofPackage;
  const displayedProjectedObjectManifest = objectRecord(displayedDraftIofPackage?.projectedObjectManifest);
  const displayedStationProjection = objectRecord((displayedDraftIofPackage as any)?.stationProjection);
  const displayedStationGraph = objectRecord(
    (displayedDraftIofPackage as any)?.stationGraph ??
      (displayedDraftIofPackage as any)?.stationIndexedGraph ??
      (displayedDraftIofPackage as any)?.doctrineProjection?.stationGraph,
  );
  const displayedObjectStationAttachments = recordArray((displayedDraftIofPackage as any)?.objectStationAttachments).length
    ? recordArray((displayedDraftIofPackage as any)?.objectStationAttachments)
    : recordArray((displayedDraftIofPackage as any)?.doctrineProjection?.objectStationAttachments);
  const displayedDoctrineProjectionDiagnostics = objectRecord(displayedDraftIofPackage?.doctrineProjectionDiagnostics);
  const displayedGeometryAuthorityDiagnostics = objectRecord(
    (displayedDraftIofPackage as any)?.geometryAuthorityDiagnostics ??
      displayedProjectedObjectManifest?.geometryAuthorityDiagnostics ??
      displayedDoctrineProjectionDiagnostics?.geometryAuthorityDiagnostics,
  );
  const displayedProjectedObjects = recordArray(displayedDraftIofPackage?.projectedObjects).length
    ? recordArray(displayedDraftIofPackage?.projectedObjects)
    : recordArray(displayedProjectedObjectManifest?.projectedObjects);
  const displayedProjectedSpans = recordArray(displayedDraftIofPackage?.projectedSpans).length
    ? recordArray(displayedDraftIofPackage?.projectedSpans)
    : recordArray(displayedProjectedObjectManifest?.projectedSpans);
  const displayedLinearAssetSpanAttachments = recordArray((displayedDraftIofPackage as any)?.linearAssetSpanAttachments).length
    ? recordArray((displayedDraftIofPackage as any)?.linearAssetSpanAttachments)
    : recordArray((displayedDraftIofPackage as any)?.doctrineLinearAssetSpanAttachments).length
      ? recordArray((displayedDraftIofPackage as any)?.doctrineLinearAssetSpanAttachments)
      : recordArray(displayedProjectedObjectManifest?.linearAssetSpanAttachments);
  const displayedObjectAddresses = recordArray(displayedDraftIofPackage?.objectAddresses).length
    ? recordArray(displayedDraftIofPackage?.objectAddresses)
    : recordArray(displayedProjectedObjectManifest?.objectAddresses);
  const commercialIofProjectionOverlay = useMemo<CommercialIofProjectionOverlay | null>(() => {
    if (!displayedProjectedObjects.length && !displayedProjectedSpans.length) return null;
    return {
      measuredCenterline: objectRecord((displayedDraftIofPackage as any)?.measuredCenterline ?? (displayedDraftIofPackage as any)?.measuredSpine),
      measuredCenterlineId: String((displayedDraftIofPackage as any)?.measuredCenterlineId ?? objectRecord((displayedDraftIofPackage as any)?.measuredCenterline)?.measuredCenterlineId ?? ""),
      stationProjection: displayedStationProjection,
      stationGraph: displayedStationGraph,
      projectedObjects: displayedProjectedObjects as CommercialIofProjectionOverlay["projectedObjects"],
      projectedSpans: displayedProjectedSpans as CommercialIofProjectionOverlay["projectedSpans"],
      objectStationAttachments: displayedObjectStationAttachments,
      linearAssetSpanAttachments: displayedLinearAssetSpanAttachments,
      objectAddresses: displayedObjectAddresses,
      routeRepositoryId: String(displayedDraftIofPackage?.routeRepositoryId ?? (displayedDraftIofPackage?.routeRepositoryRef as any)?.routeRepositoryId ?? ""),
      geometryHash: String(displayedDraftIofPackage?.geometryHash ?? (displayedDraftIofPackage?.routeRepositoryRef as any)?.geometryHash ?? ""),
      projectionAuthority: String(displayedDoctrineProjectionDiagnostics?.authority ?? "DOCTRINE_PROJECTION_ENGINE"),
    };
  }, [
    displayedDraftIofPackage?.geometryHash,
    displayedDraftIofPackage?.routeRepositoryId,
    displayedDraftIofPackage?.routeRepositoryRef,
    (displayedDraftIofPackage as any)?.measuredCenterline,
    (displayedDraftIofPackage as any)?.measuredCenterlineId,
    (displayedDraftIofPackage as any)?.measuredSpine,
    displayedDoctrineProjectionDiagnostics?.authority,
    displayedLinearAssetSpanAttachments,
    displayedObjectAddresses,
    displayedObjectStationAttachments,
    displayedProjectedObjects,
    displayedProjectedSpans,
    displayedStationGraph,
    displayedStationProjection,
  ]);
  const commercialDoctrineDiagnosticObjectTypes = recordArray(displayedDoctrineProjectionDiagnostics?.objectTypes);
  const commercialDoctrineLinearAssetRows = ["CONDUIT", "FIBER", "TRACE_WIRE", "WARNING_TAPE", "MULE_TAPE_PULL_TAPE"].map((assetType) => {
    const attachments = displayedLinearAssetSpanAttachments.filter((attachment) => String(attachment.assetType ?? "").toUpperCase() === assetType);
    const ranges = recordArray(displayedProjectedObjectManifest?.linearAssetStationRanges).filter((range) => String(range.assetType ?? "").toUpperCase() === assetType);
    return {
      objectType: assetType,
      doctrineQuantitySource: assetType === "CONDUIT"
        ? "productDoctrineAssembly.quantitySummary.conduitFeet"
        : assetType === "FIBER"
          ? "productDoctrineAssembly.quantitySummary.fiberFeet"
          : "Product Doctrine linear asset span attachment",
      routeFeet: Number(displayedDoctrineProjectionDiagnostics?.routeFeet ?? (displayedDraftIofPackage?.commercialSummary as any)?.routeFeet ?? activeRouteFeet),
      stationCount: Number(displayedDoctrineProjectionDiagnostics?.stationCount ?? 0),
      objectCount: attachments.length,
      nominalIntervalFeet: 0,
      calculatedStations: ranges.map((range) => `${String(range.stationStart ?? "0+00")} - ${String(range.stationEnd ?? "Pending")}`),
      resolvedCoordinates: [],
      placementAuthority: "DOCTRINE_PROJECTION_ENGINE",
      projectionResult: attachments.length || !displayedProjectedSpans.length ? "PASS" : "FAIL",
      gates: [
        { gate: "Math Present", status: displayedDoctrineProjectionDiagnostics ? "PASS" : "FAIL", reason: displayedDoctrineProjectionDiagnostics ? "linear asset quantity source present" : "missing doctrine projection diagnostics" },
        { gate: "Objects Calculated", status: attachments.length || !displayedProjectedSpans.length ? "PASS" : "FAIL", reason: attachments.length ? `${attachments.length} span attachment(s)` : "linear asset span attachment missing" },
        { gate: "Addresses Assigned", status: ranges.length || attachments.length ? "PASS" : "FAIL", reason: ranges.length ? `${ranges.length} station range(s)` : "station range derived from span attachment" },
        { gate: "Objects Projected", status: attachments.length || !displayedProjectedSpans.length ? "PASS" : "FAIL", reason: attachments.length ? "linear asset attached to projected spans" : "no projected spans available" },
      ],
      failureReasons: attachments.length || !displayedProjectedSpans.length ? [] : ["linear asset is not attached to projected spans"],
    };
  });
  const commercialDoctrineDiagnosticsRows = [
    ...commercialDoctrineDiagnosticObjectTypes,
    ...commercialDoctrineLinearAssetRows,
  ];
  const constitutionalAssemblyReview = useMemo(
    () => evaluateConstitutionalAssemblyReview(displayedDraftIofPackage),
    [displayedDraftIofPackage],
  );
  const customerTwinFeatureCount =
    accountRenderableCustomerTwin.routes.length +
    accountRenderableCustomerTwin.objects.length +
    accountRenderableCustomerTwin.stations.length;
  const customerTwinLoadWarning = customerTwinFeatureCount === 0
    ? customerInventoryLoadStatus === "ERROR"
      ? "Customer Twin failed to load for this opportunity. Existing network context is unavailable until the import or inventory service is restored."
      : `Customer Twin is ${customerInventoryLoadStatus.toLowerCase()}. Keep the map visible, but do not treat existing network context as loaded yet.`
    : null;
  const activeProposalAuthoritySnapshot = evaluateProposalAuthorityState(activeProposalRuntime, proposalStatusLabel);
  const activeProposalStatus = activeProposalAuthoritySnapshot.repositoryStatus;
  const activeProposalApprovalState = String(activeProposalRuntime?.approvalState ?? "");
  const internalCommercialApproval = activeProposalRuntime?.internalCommercialApproval as Record<string, unknown> | undefined;
  const opportunityMateriality = activeProposalRuntime?.opportunityMateriality as { decision?: string; materialCommercialState?: string; materialChanges?: Array<{ field?: string }>; unknownChanges?: Array<{ field?: string }> } | undefined;
  const proposalBoundOpportunityVersion = Number(activeProposalRuntime?.opportunityStateVersion ?? 0);
  const currentOpportunityVersion = Number(activeCommercialOpportunity?.commercialStateVersion ?? 0);
  const proposalOpportunityStale = Boolean(activeProposalRuntime && activeCommercialOpportunity && (
    proposalBoundOpportunityVersion !== currentOpportunityVersion || activeProposalRuntime.opportunityStateHash !== activeCommercialOpportunity.commercialStateHash
  ));
  const exactInternalCommercialApproval = Boolean(activeProposalRuntime && internalCommercialApproval?.status === "APPROVED" &&
    internalCommercialApproval.proposalRevisionId === activeProposalRuntime.proposalRevisionId &&
    internalCommercialApproval.proposalHash === activeProposalRuntime.proposalHash);
  const proposalSubmitted = Boolean(activeProposalRuntime && !["", "DRAFT", "CREATED"].includes(activeProposalStatus));
  const proposalRepositoryCustomerReviewState = proposalCustomerReviewStateFromRepository(activeProposalRuntime);
  const renderedCustomerReviewStatus = proposalRepositoryCustomerReviewState !== "NOT_STARTED" ? proposalRepositoryCustomerReviewState : accountCustomerReviewStatus;
  const customerReviewVisible = renderedCustomerReviewStatus !== "NOT_STARTED" || ["SUBMITTED", "IN_CUSTOMER_REVIEW", "CUSTOMER_REVIEW", "WAITING_CUSTOMER_REVIEW"].includes(activeProposalStatus);
  const customerApproved = proposalRepositoryReportsCommercialApproved(activeProposalRuntime);
  const submittedEngineeringPackageId = String(
    activeCommercialOpportunity?.engineeringPackageId ??
      displayedDraftIofPackage?.engineeringPackageId ??
      (displayedDraftIofPackage?.engineeringPackage as any)?.engineeringPackageId ??
      "",
  );
  const submittedEngineeringStatus = String(
    activeCommercialOpportunity?.engineeringStatus ??
      (displayedDraftIofPackage?.engineeringPackage as any)?.engineeringStatus ??
      (displayedDraftIofPackage?.engineeringPackage as any)?.status ??
      displayedDraftIofPackage?.engineeringStatus ??
      (submittedEngineeringPackageId ? "ENGINEERING_PENDING" : "NOT_SUBMITTED"),
  );
  const submittedToEngineering = Boolean(
    submittedEngineeringPackageId ||
      activeCommercialOpportunity?.status === "SUBMITTED_TO_ENGINEERING" ||
      ["SUBMITTED_TO_ENGINEERING", "UNDER_ENGINEERING_REVIEW", "CERTIFIED"].includes(String(displayedDraftIofPackage?.status ?? "")),
  );
  const commercialAuthorityDiagnostics = {
    repository: String(activeProposalRuntime?.commercialRepositoryId ?? activeCommercialOpportunity?.opportunityId ?? "COMMERCIAL_REPOSITORY"),
    commercialRevisionId: String(
      activeProposalRuntime?.commercialRevisionId ??
        displayedDraftIofPackage?.commercialRevisionId ??
        activeCommercialOpportunity?.commercialRevisionId ??
        "",
    ),
    commercialReleasePackageId: String(
      activeProposalRuntime?.commercialReleasePackageId ??
        displayedDraftIofPackage?.commercialReleasePackageId ??
        activeCommercialOpportunity?.commercialReleasePackageId ??
        "",
    ),
    proposalId: String(activeProposalRuntime?.proposalId ?? displayedDraftIofPackage?.proposalId ?? activeCommercialOpportunity?.proposalId ?? ""),
    draftIofPackageId: String(displayedDraftIofPackage?.packageId ?? activeCommercialOpportunity?.draftIofPackageId ?? ""),
    revisionHash: String(
      activeProposalRuntime?.commercialRevisionHash ??
        displayedDraftIofPackage?.commercialRevisionHash ??
        activeCommercialOpportunity?.commercialRevisionHash ??
        "",
    ),
    releaseHash: String(
      activeProposalRuntime?.commercialReleaseHash ??
        displayedDraftIofPackage?.commercialReleaseHash ??
        activeCommercialOpportunity?.commercialReleaseHash ??
        "",
    ),
    proposalHash: String((activeProposalRuntime?.commercialAuthorityDiagnostics as any)?.proposalHash ?? ""),
    repositoryHash: String(
      commercialRevisionProjection?.diagnostics.repositoryHash ??
        (activeProposalRuntime?.commercialAuthorityDiagnostics as any)?.repositoryHash ??
        activeProposalRuntime?.repositoryHash ??
        displayedDraftIofPackage?.repositoryHash ??
        "",
    ),
    activePatchCount: Number(
      commercialRevisionProjection?.diagnostics.activePatchCount ??
        (activeProposalRuntime?.commercialAuthorityDiagnostics as any)?.activePatchCount ??
        activeProposalRuntime?.activePatchCount ??
        displayedDraftIofPackage?.activePatchCount ??
        commercialChangeSetPatches.length,
    ),
    appliedPatchCount: Number(
      commercialRevisionProjection?.diagnostics.appliedPatchCount ??
        (activeProposalRuntime?.commercialAuthorityDiagnostics as any)?.appliedPatchCount ??
        activeProposalRuntime?.appliedPatchCount ??
        displayedDraftIofPackage?.appliedPatchCount ??
        0,
    ),
    patchReplayTimeMs: Number(
      commercialRevisionProjection?.diagnostics.patchReplayTimeMs ??
        (activeProposalRuntime?.commercialAuthorityDiagnostics as any)?.patchReplayTimeMs ??
        activeProposalRuntime?.patchReplayTimeMs ??
        displayedDraftIofPackage?.patchReplayTimeMs ??
        0,
    ),
    projectionTimeMs: Number(
      commercialRevisionProjection?.diagnostics.projectionTimeMs ??
        (activeProposalRuntime?.commercialAuthorityDiagnostics as any)?.projectionTimeMs ??
        activeProposalRuntime?.projectionTimeMs ??
        displayedDraftIofPackage?.projectionTimeMs ??
        0,
    ),
    changeSetIds: Array.isArray(commercialRevisionProjection?.changeSetIds)
      ? commercialRevisionProjection.changeSetIds
      : Array.isArray(activeProposalRuntime?.changeSetIds)
        ? activeProposalRuntime.changeSetIds
        : Array.isArray(displayedDraftIofPackage?.changeSetIds)
          ? displayedDraftIofPackage.changeSetIds
          : [],
    currentAuthority: String(
      displayedDraftIofPackage?.currentAuthority ??
        activeProposalRuntime?.currentAuthority ??
        (displayedDraftIofPackage?.commercialReleasePackageId ? "COMMERCIAL_RELEASE_PACKAGE" : activeProposalRuntime?.commercialRevisionId ? "COMMERCIAL_REVISION" : "COMMERCIAL_REPOSITORY"),
    ),
  };
  const activeDashboardRouteRepositoryId = String(
    activeCommercialOpportunity?.routeRepositoryId ??
      activeCommercialOpportunity?.routeRepositoryRef?.routeRepositoryId ??
      displayedDraftIofPackage?.routeRepositoryId ??
      (displayedDraftIofPackage?.routeRepositoryRef as any)?.routeRepositoryId ??
      "",
  );
  const activeDashboardRouteRepository = activeDashboardRouteRepositoryId
    ? commercialRouteRepositoryRecords.find((route) => route.routeRepositoryId === activeDashboardRouteRepositoryId)
    : null;
  const dashboardCommercialSummary = objectRecord(displayedDraftIofPackage?.commercialSummary);
  const dashboardPricingSummary = objectRecord((displayedDraftIofPackage as any)?.pricingSummary ?? dashboardCommercialSummary?.pricingSummary);
  const commercialDashboardHandoffChecks = [
    {
      key: "commercial-revision",
      label: "Commercial Revision",
      ok: Boolean(commercialAuthorityDiagnostics.commercialRevisionId),
      detail: commercialAuthorityDiagnostics.commercialRevisionId || "Created after Route Repository commit",
    },
    {
      key: "commercial-release",
      label: "Commercial Release Package",
      ok: Boolean(commercialAuthorityDiagnostics.commercialReleasePackageId),
      detail: commercialAuthorityDiagnostics.commercialReleasePackageId || "Created after Commercial Revision and before Draft IOF save",
    },
    {
      key: "proposal",
      label: "Proposal",
      ok: Boolean(activeProposalRuntime?.proposalId && proposalRepositoryReportsCommercialApproved(activeProposalRuntime)),
      detail: activeProposalRuntime?.proposalId
        ? proposalRepositoryReportsCommercialApproved(activeProposalRuntime)
          ? `${activeProposalRuntime.proposalNumber ?? activeProposalRuntime.proposalId} reports COMMERCIAL_APPROVED`
          : `Proposal Repository status is ${activeProposalStatus || "missing"}`
        : "No governed proposal",
    },
    {
      key: "estimate",
      label: "Estimate",
      ok: Boolean(activeFinancialDraft || hasObjectPayload(activeCommercialOpportunity?.estimate) || hasObjectPayload((displayedDraftIofPackage as any)?.commercialEstimate) || hasObjectPayload(dashboardPricingSummary)),
      detail: activeFinancialDraft
        ? activeFinancialDraft.transparentEstimate?.estimateId ?? "Live estimate ready"
        : activeCommercialOpportunity?.estimate?.estimateId ? String(activeCommercialOpportunity.estimate.estimateId) : "Estimate snapshot required",
    },
    {
      key: "workbook",
      label: "Workbook",
      ok: Boolean(activeCommercialOpportunity?.workbookId || activeCommercialOpportunity?.commercialWorkbookId || hasObjectPayload(activeCommercialOpportunity?.commercialWorkbook) || (displayedDraftIofPackage as any)?.commercialWorkbookId || hasArrayPayload((displayedDraftIofPackage as any)?.commercialWorkbookSections) || hasObjectPayload((displayedDraftIofPackage as any)?.commercialWorkbook)),
      detail: String(activeCommercialOpportunity?.workbookId ?? activeCommercialOpportunity?.commercialWorkbookId ?? (displayedDraftIofPackage as any)?.commercialWorkbookId ?? "Workbook snapshot required"),
    },
    {
      key: "draft-iof",
      label: "Draft IOF Package",
      ok: Boolean(displayedDraftIofPackage?.packageId),
      detail: displayedDraftIofPackage?.packageId ?? "Draft IOF Package required",
    },
    {
      key: "route-repository",
      label: "Route Repository",
      ok: Boolean(activeDashboardRouteRepositoryId && (activeDashboardRouteRepository || activeCommercialOpportunity?.routeRepositorySnapshot || displayedDraftIofPackage?.routeRepositoryId)),
      detail: activeDashboardRouteRepositoryId || "Route Repository required",
    },
  ];
  const commercialDashboardHandoffMissing = commercialDashboardHandoffChecks
    .filter((check) => !check.ok)
    .map((check) => `${check.label}: ${check.detail}`);
  const commercialDashboardHandoffReady = commercialDashboardHandoffChecks.every((check) => check.ok);
  const commercialReleasePrerequisiteChecks = [
    {
      key: "proposal-revision",
      label: "Proposal Revision",
      ok: Boolean(selectedReleaseProposalRevision?.proposalRevisionId && selectedReleaseProposalRevision?.proposalHash && selectedReleaseProposalRevision?.revisionStatus === "SAVED"),
      detail: selectedReleaseProposalRevision
        ? `${selectedReleaseProposalRevision.proposalRevisionId} · ${selectedReleaseProposalRevision.revisionStatus}`
        : "Save and select an immutable Proposal Revision",
    },
    {
      key: "customer-approval",
      label: "Customer Approval",
      ok: Boolean(selectedReleaseApproval),
      detail: selectedReleaseApproval ? `Exact revision/hash approval ${String(selectedReleaseApproval.approvalId ?? "recorded")}` : "Exact selected revision and hash must be customer approved",
    },
    ...commercialDashboardHandoffChecks.filter((check) => ["estimate", "workbook", "route-repository"].includes(check.key)),
  ];
  const commercialReleasePrerequisitesReady = commercialReleasePrerequisiteChecks.every((check) => check.ok);
  const displayedDraftMatchesSelectedRevision = Boolean(
    selectedReleaseProposalRevision &&
    displayedDraftIofPackage?.proposalRevisionId === selectedReleaseProposalRevision.proposalRevisionId &&
    displayedDraftIofPackage?.proposalHash === selectedReleaseProposalRevision.proposalHash,
  );
  const commercialReleaseReadinessRows = [
    ...commercialReleasePrerequisiteChecks.slice(0, 2),
    {
      key: "commercial-revision",
      label: "Commercial Revision",
      ok: displayedDraftMatchesSelectedRevision && Boolean(displayedDraftIofPackage?.commercialRevisionId),
      detail: displayedDraftMatchesSelectedRevision ? displayedDraftIofPackage?.commercialRevisionId ?? "Not created" : "Not created for selected Proposal Revision",
    },
    {
      key: "release-package",
      label: "Release Package",
      ok: displayedDraftMatchesSelectedRevision && Boolean(displayedDraftIofPackage?.commercialReleasePackageId),
      detail: displayedDraftMatchesSelectedRevision ? displayedDraftIofPackage?.commercialReleasePackageId ?? "Not created" : "Not created for selected Proposal Revision",
    },
    {
      key: "draft-iof",
      label: "Draft IOF Package",
      ok: displayedDraftMatchesSelectedRevision && Boolean(displayedDraftIofPackage?.packageId),
      detail: displayedDraftMatchesSelectedRevision ? displayedDraftIofPackage?.packageId ?? "Blocked" : "Blocked until Release Package",
    },
    {
      key: "engineering-handoff",
      label: "Engineering Handoff",
      ok: displayedDraftMatchesSelectedRevision && submittedToEngineering,
      detail: displayedDraftMatchesSelectedRevision && submittedToEngineering ? submittedEngineeringPackageId || "Submitted" : "Blocked until Draft IOF save",
    },
  ];
  useEffect(() => {
    logProposalAuthorityStateHydration("Commercial Dashboard hydration", activeProposalRuntime, activeProposalAuthoritySnapshot.dashboardStatus);
  }, [
    activeProposalAuthoritySnapshot.approvalState,
    activeProposalAuthoritySnapshot.dashboardStatus,
    activeProposalAuthoritySnapshot.engineeringEligibility,
    activeProposalAuthoritySnapshot.proposalId,
    activeProposalAuthoritySnapshot.repositoryStatus,
  ]);
  const commercialProposalProgressSteps = [
    {
      key: "draft",
      label: "Draft",
      status: currentDraftLabel,
      complete: Boolean(temporaryImportedRoute || activeCommercialDraftNetworks.length || selectedImportedCommercialDraft || commercialCorridorDraft || loadedCommercialDraftSnapshot || opportunityScoutQuickQuote),
      view: "proposal" as CommercialWorkspaceView,
    },
    {
      key: "submitted",
      label: "Submitted",
      status: activeProposalRuntime?.proposalNumber ?? "Not submitted",
      complete: proposalSubmitted,
      view: "proposal" as CommercialWorkspaceView,
    },
    {
      key: "customer-review",
      label: "Customer Review",
      status: renderedCustomerReviewStatus.replaceAll("_", " "),
      complete: customerReviewVisible,
      view: "review" as CommercialWorkspaceView,
    },
    {
      key: "approved",
      label: "Approved",
      status: customerApproved ? "Customer accepted" : "Pending",
      complete: customerApproved,
      view: "review" as CommercialWorkspaceView,
    },
    {
      key: "iof-package",
      label: "IOF Package",
      status: displayedDraftIofPackage?.packageId ?? "Not assembled",
      complete: Boolean(displayedDraftIofPackage),
      view: "review" as CommercialWorkspaceView,
    },
    {
      key: "engineering",
      label: "Engineering",
      status: displayedDraftIofPackage?.status === "CERTIFIED" || activeDraftIofPackage?.status === "CERTIFIED" ? "Certified" : "Not certified",
      complete: displayedDraftIofPackage?.status === "CERTIFIED" || activeDraftIofPackage?.status === "CERTIFIED",
      view: "handoff" as CommercialWorkspaceView,
    },
  ];
  const commercialLifecycleRibbonBaseSteps = [
    {
      key: "opportunity",
      label: "Opportunity",
      complete: Boolean(activeCommercialOpportunity?.opportunityId),
      detail: activeCommercialOpportunity?.opportunityId ?? "Unsaved",
    },
    {
      key: "commercial-revision",
      label: "Commercial Revision",
      complete: Boolean(commercialAuthorityDiagnostics.commercialRevisionId),
      detail: commercialAuthorityDiagnostics.commercialRevisionId || "Pending",
    },
    {
      key: "commercial-release",
      label: "Commercial Release Package",
      complete: Boolean(commercialAuthorityDiagnostics.commercialReleasePackageId || displayedDraftIofPackage?.commercialReleasePackageId),
      detail: commercialAuthorityDiagnostics.commercialReleasePackageId || displayedDraftIofPackage?.commercialReleasePackageId || "Pending",
    },
    {
      key: "proposal",
      label: "Proposal",
      complete: Boolean(activeProposalRuntime?.proposalId),
      detail: activeProposalRuntime?.proposalNumber ?? activeProposalRuntime?.proposalId ?? "Pending",
    },
    {
      key: "customer-accepted",
      label: "Customer Accepted",
      complete: customerApproved,
      detail: customerApproved ? "Accepted" : activeProposalStatus || "Pending",
    },
    {
      key: "engineering",
      label: "Engineering",
      complete: submittedToEngineering,
      detail: submittedEngineeringPackageId || "Ready after customer acceptance",
    },
    {
      key: "certified-iof",
      label: "Certified IOF",
      complete: displayedDraftIofPackage?.status === "CERTIFIED" || activeDraftIofPackage?.status === "CERTIFIED",
      detail: displayedDraftIofPackage?.status === "CERTIFIED" || activeDraftIofPackage?.status === "CERTIFIED" ? "Certified" : "Future",
    },
    {
      key: "service-order",
      label: "Service Order",
      complete: String((activeCommercialOpportunity as any)?.serviceOrderStatus ?? "").toUpperCase() === "READY",
      detail: activeCommercialOpportunity?.serviceOrderPreviewId ?? "Future",
    },
    {
      key: "scopeversion",
      label: "ScopeVersion",
      complete: false,
      detail: "Blocked until signed Service Order",
    },
  ];
  const commercialLifecycleCurrentIndex = commercialLifecycleRibbonBaseSteps.findIndex((step) => !step.complete);
  const commercialLifecycleRibbonSteps = commercialLifecycleRibbonBaseSteps.map((step, index) => ({
    ...step,
    state: step.complete
      ? "completed"
      : index === commercialLifecycleCurrentIndex
        ? "current"
        : index === commercialLifecycleCurrentIndex + 1
          ? "next"
          : "locked",
  }));
  const commercialSequencingDraftRouteId = String(displayedDraftIofPackage?.routeRepositoryId ?? (displayedDraftIofPackage?.routeRepositoryRef as any)?.routeRepositoryId ?? "");
  const commercialLifecycleSequencingRows = [
    {
      key: "route-repository",
      label: "Route Repository",
      ok: Boolean(activeDashboardRouteRepositoryId),
      detail: activeDashboardRouteRepositoryId || "Missing routeRepositoryId",
      recommendation: "Generate Route and wait for Route Repository commit.",
    },
    {
      key: "commercial-revision",
      label: "Commercial Revision",
      ok: Boolean(commercialAuthorityDiagnostics.commercialRevisionId),
      detail: commercialAuthorityDiagnostics.commercialRevisionId || "commercialRevisionId missing",
      recommendation: "Create or restore Commercial Revision immediately after Route Repository commit.",
    },
    {
      key: "commercial-release-package",
      label: "Commercial Release Package",
      ok: Boolean(commercialAuthorityDiagnostics.commercialReleasePackageId),
      detail: commercialAuthorityDiagnostics.commercialReleasePackageId || "commercialReleasePackageId missing",
      recommendation: "Freeze Commercial Revision into a Commercial Release Package before IOF assembly.",
    },
    {
      key: "automatic-iof-assembly",
      label: "Automatic IOF Assembly",
      ok: Boolean(
        displayedDraftIofPackage?.packageId &&
          displayedDraftIofPackage?.commercialRevisionId &&
          displayedDraftIofPackage?.commercialReleasePackageId &&
          commercialAuthorityDiagnostics.commercialReleasePackageId &&
          commercialSequencingDraftRouteId === activeDashboardRouteRepositoryId
      ),
      detail: displayedDraftIofPackage?.packageId || "Automatic IOF Assembly blocked",
      recommendation: "Run assembly only after Commercial Revision and Commercial Release Package pass.",
    },
    {
      key: "draft-iof-save",
      label: "Draft IOF Save",
      ok: Boolean(
        displayedDraftIofPackage?.packageId &&
          displayedDraftIofPackage?.commercialRevisionId &&
          displayedDraftIofPackage?.commercialReleasePackageId &&
          displayedDraftIofPackage?.stationProjectionId &&
          displayedDraftIofPackage?.stationGraphId &&
          displayedDraftIofPackage?.projectedObjectManifestId
      ),
      detail: displayedDraftIofPackage?.packageId
        ? displayedDraftIofPackage.repositoryAssemblyStatus ?? "Reference package saved"
        : "Draft IOF Package not saved",
      recommendation: "Save reference-only Draft IOF Package with repository artifact IDs.",
    },
  ];
  const commercialLifecycleSequencingBlocker = commercialLifecycleSequencingRows.find((row) => !row.ok);
  const commercialConstitutionalHandoffVisible = Boolean((customerApproved || selectedReleaseProposalEligible || submittedToEngineering) && canManageProposalRuntime);
  const commercialConstitutionalHandoffReady = Boolean(
    canManageProposalRuntime &&
      commercialReleasePrerequisitesReady &&
      !submittedToEngineering,
  );
  const commercialEstimateRisks = activeFinancialAuthority?.validationWarnings.length
    ? activeFinancialAuthority.validationWarnings
    : selectedPricingSummary.reconciliation.financialValidationWarnings.length
      ? selectedPricingSummary.reconciliation.financialValidationWarnings
      : unknownConstraintCount > 0
        ? [`${unknownConstraintCount.toLocaleString()} unknown route constraint${unknownConstraintCount === 1 ? "" : "s"} need commercial review.`]
        : constitutionalAssemblyReview.draftIofGateBlocked
          ? [constitutionalAssemblyReview.draftIofGateReason]
          : ["No commercial blockers visible."];
  const commercialReadinessLabel = activeFinancialDraft
    ? percentage(activeFinancialDraft.transparentEstimate.commercialReadiness.score)
    : "Pending";
  const activeRouteLengthLabel = activeFinancialDraft
    ? formatRouteMiles(activeFinancialDraft.routeMiles)
    : formatRouteMiles(selectedPricingSummary.reconciliation.routeMiles);
  const activeConstructionMixLabel = `${selectedCivilMixCalibration.plowPercent}% plow / ${selectedCivilMixCalibration.dirtPercent}% dirt / ${selectedCivilMixCalibration.rockPercent}% rock / ${selectedCivilMixCalibration.trenchPercent}% trench`;
  const defaultProductionControls = DEFAULT_TRANSPARENT_ESTIMATE_CONTROLS.production;
  const defaultFinancialControls = DEFAULT_TRANSPARENT_ESTIMATE_CONTROLS.financial;
  const overrideTimestamp = transparentEstimateControls.humanAuditTrail?.at(-1)?.timestamp
    ?? activeFinancialDraft?.transparentEstimate.humanAuditTrail.at(-1)?.timestamp
    ?? selectedAssumptionState.createdAt
    ?? lastRecalculatedAt
    ?? "Not recorded";
  const commercialDoctrineOverrideRows = [
    ["product.undergroundOnly", "Underground Only", "Enabled", "Enabled", "Doctrine product default"],
    ["civil.dirtPercent", "Dirt Percentage", `${STANDARD_CIVIL_MIX.dirtPercent}%`, `${selectedCivilMixCalibration.dirtPercent}%`, selectedAssumptionState.label],
    ["civil.rockPercent", "Rock Percentage", `${STANDARD_CIVIL_MIX.rockPercent}%`, `${selectedCivilMixCalibration.rockPercent}%`, selectedAssumptionState.label],
    ["civil.plowPercent", "Plow Mix", `${STANDARD_CIVIL_MIX.plowPercent}%`, `${selectedCivilMixCalibration.plowPercent}%`, selectedAssumptionState.label],
    ["civil.directionalBorePercent", "Directional Bore Mix", `${STANDARD_CIVIL_MIX.dirtPercent + STANDARD_CIVIL_MIX.rockPercent}%`, `${selectedCivilMixCalibration.dirtPercent + selectedCivilMixCalibration.rockPercent}%`, selectedAssumptionState.label],
    ["civil.openTrenchPercent", "Open Trench Mix", `${STANDARD_CIVIL_MIX.trenchPercent}%`, `${selectedCivilMixCalibration.trenchPercent}%`, selectedAssumptionState.label],
    ["slack.handholeSlackFeet", "Handhole Slack", `${defaultAssumptionState.slack.handholeSlackFeet} ft`, `${selectedAssumptionState.slack.handholeSlackFeet} ft`, selectedAssumptionState.label],
    ["ila.placementMethod", "ILA Assumption", DEFAULT_TRANSPARENT_ESTIMATE_CONTROLS.ilaPlanning.placementMethod, transparentEstimateControls.ilaPlanning.placementMethod, "Commercial ILA planning controls"],
    ["production.plowFeetPerDay", "Plow Production", `${defaultProductionControls.plowFeetPerDay?.toLocaleString()} ft/day`, `${transparentEstimateControls.production.plowFeetPerDay?.toLocaleString()} ft/day`, "Commercial production calibration"],
    ["production.directionalBoreDirtFeetPerDay", "Dirt Bore Production", `${defaultProductionControls.directionalBoreDirtFeetPerDay?.toLocaleString()} ft/day`, `${transparentEstimateControls.production.directionalBoreDirtFeetPerDay?.toLocaleString()} ft/day`, "Commercial production calibration"],
    ["financial.contingencyPercent", "Contingency", `${defaultFinancialControls.contingencyPercent}%`, `${transparentEstimateControls.financial.contingencyPercent}%`, "Commercial financial controls"],
    ["financial.monthlyOmPerRouteMile", "O&M", money(defaultFinancialControls.monthlyOmPerRouteMile), money(transparentEstimateControls.financial.monthlyOmPerRouteMile), "Commercial lifecycle controls"],
    ["financial.markupPercent", "Markup", `${defaultFinancialControls.markupPercent}%`, `${transparentEstimateControls.financial.markupPercent}%`, "Commercial pricing controls"],
  ].map(([assumptionId, label, doctrineValue, commercialValue, reason]) => {
    const overridden = doctrineValue !== commercialValue;
    return {
      assumptionId,
      label,
      doctrineValue,
      commercialValue,
      source: overridden ? "HUMAN_OVERRIDE" : "DOCTRINE",
      confidence: overridden ? "Commercial override" : "Doctrine default",
      overrideStatus: overridden ? "Override recorded" : "Doctrine accepted",
      overrideReason: overridden ? reason : "Doctrine value accepted for commercial estimate.",
      owner: overridden ? currentUserName : "Doctrine",
      timestamp: overridden ? overrideTimestamp : defaultAssumptionState.createdAt,
    };
  });
  const restoredProposalPreview = activeCommercialOpportunity?.proposalPreview ?? null;
  const restoredServiceOrderPreview = activeCommercialOpportunity?.serviceOrderPreview ?? null;
  const proposalPreviewRows = snapshotRows(restoredProposalPreview);
  const serviceOrderReadinessRows = snapshotRows(restoredServiceOrderPreview);
  const proposalRevisionComparison = useMemo(() => {
    const revisions = activeProposalRuntime?.proposalRevisions ?? [];
    return revisions.length > 1
      ? compareProposalRevisions(revisions[revisions.length - 2], revisions[revisions.length - 1])
      : [];
  }, [activeProposalRuntime?.proposalRevisions]);
  const commercialRepositoryBrowserSections = useMemo(() => {
    const selectedTwinRecord = customerNetworkGraph ? {
      customerTwinId: accountCustomerTwin?.customerTwinId ?? `CUSTOMER-TWIN-${selectedAccount.accountId}`,
      accountId: selectedAccount.accountId,
      graphId: customerNetworkGraph.graphId,
      inventorySessionVersion: customerNetworkGraph.inventorySessionVersion,
      sourceRepository: "runtime-inventories + runtime-objects",
      routeCount: customerNetworkGraph.summary.routeCount,
      objectCount: customerNetworkGraph.summary.objectCount,
      stationCount: customerNetworkGraph.summary.stationCount,
      synchronizedAt: customerNetworkGraph.synchronizedAt,
    } : null;
    const customerRecords = accountOptions.map((account) => ({
      id: account.accountId,
      relationships: [`customerId:${customerIdForAccount(account.accountId)}`],
      storagePath: repositoryRecordPath("accounts", account.accountId),
      json: account,
    }));
    const twinRecords = selectedTwinRecord ? [{
      id: selectedTwinRecord.customerTwinId,
      relationships: [`customer:${selectedAccount.accountId}`],
      storagePath: "server/data/runtime-inventories/*.json + server/data/runtime-objects/*.json",
      json: selectedTwinRecord,
    }] : [];
    const opportunityRecords = commercialOpportunities.map((opportunity) => ({
      id: opportunity.opportunityId,
      relationships: [
        `customer:${opportunity.accountId}`,
        `routeRepository:${opportunity.routeRepositoryId ?? opportunity.routeRepositoryRef?.routeRepositoryId ?? "missing"}`,
        `proposal:${opportunity.proposalId ?? "missing"}`,
        `workbook:${opportunity.workbookId ?? opportunity.commercialWorkbook?.workbookId ?? "missing"}`,
      ],
      storagePath: repositoryRecordPath("commercial-opportunities", opportunity.opportunityId),
      json: {
        opportunityId: opportunity.opportunityId,
        accountId: opportunity.accountId,
        routeRepositoryId: opportunity.routeRepositoryId ?? opportunity.routeRepositoryRef?.routeRepositoryId ?? "",
        proposalId: opportunity.proposalId,
        workbookId: opportunity.workbookId,
        estimateId: opportunity.estimate?.estimateId ?? opportunity.commercialDraftSnapshot?.transparentEstimate?.estimateId,
        routeGeometryStoredHere: Array.isArray(opportunity.routeGeometry) ? opportunity.routeGeometry.length : 0,
        routeRepositorySnapshotStoredHere: Boolean(opportunity.routeRepositorySnapshot),
        importedEvidenceReferences: opportunity.importedEvidenceReferences?.map((evidence) => evidence.evidenceId) ?? [],
        createdAt: opportunity.createdAt,
        updatedAt: opportunity.updatedAt,
      },
    }));
    const routeRecords = commercialRouteRepositoryRecords.map((route) => ({
      id: route.routeRepositoryId,
      relationships: [
        `opportunity:${route.opportunityId}`,
        `geometry:${route.routeGeometryId ?? routeGeometryId(route.routeRepositoryId, routeSnapshotHash(route))}`,
        `evidence:${route.importedEvidence.map((evidence) => evidence.evidenceId).join(",") || "missing"}`,
      ],
      storagePath: repositoryRecordPath("commercial-routes", route.routeRepositoryId),
      json: {
        routeRepositoryId: route.routeRepositoryId,
        opportunityId: route.opportunityId,
        routeGeometryId: route.routeGeometryId,
        geometryHash: routeSnapshotHash(route),
        vertexCount: route.commercialGeometry.length,
        routeMiles: route.routeMiles,
        evidenceIds: route.importedEvidence.map((evidence) => evidence.evidenceId),
        createdAt: route.createdAt,
        updatedAt: route.updatedAt,
      },
    }));
    const proposalRecords = proposalRuntimeRecords.map((proposal) => ({
      id: String(proposal.proposalRecordId ?? proposal.proposalId ?? proposal.acceptedProposalId ?? proposal.snapshotId ?? "proposal"),
      relationships: [
        `opportunity:${String((proposal as Record<string, unknown>).opportunityId ?? activeCommercialOpportunityId ?? "missing")}`,
        `customer:${String((proposal as Record<string, unknown>).accountId ?? (proposal as Record<string, unknown>).customerId ?? "missing")}`,
      ],
      storagePath: repositoryRecordPath("proposal-drafts", String(proposal.proposalRecordId ?? proposal.proposalId ?? proposal.acceptedProposalId ?? proposal.snapshotId ?? "proposal")),
      json: proposal,
    }));
    const commercialRevisionRecords = commercialAuthorityDiagnostics.commercialRevisionId ? [{
      id: commercialAuthorityDiagnostics.commercialRevisionId,
      relationships: [
        `repository:${commercialAuthorityDiagnostics.repository}`,
        `proposal:${commercialAuthorityDiagnostics.proposalId || "missing"}`,
        `draftIof:${commercialAuthorityDiagnostics.draftIofPackageId || "pending"}`,
      ],
      storagePath: repositoryRecordPath("commercial-revisions", commercialAuthorityDiagnostics.commercialRevisionId),
      json: {
        commercialRevisionId: commercialAuthorityDiagnostics.commercialRevisionId,
        proposalId: commercialAuthorityDiagnostics.proposalId,
        revisionHash: commercialAuthorityDiagnostics.revisionHash,
        repositoryHash: commercialAuthorityDiagnostics.repositoryHash,
        changeSetIds: commercialAuthorityDiagnostics.changeSetIds,
        activePatchCount: commercialAuthorityDiagnostics.activePatchCount,
        appliedPatchCount: commercialAuthorityDiagnostics.appliedPatchCount,
        currentAuthority: "COMMERCIAL_REVISION",
        repositoryTruthImmutable: true,
        proposalConsumesCommercialRevision: true,
      },
    }] : [];
    const commercialChangeSetRecords = [
      ...commercialChangeSetHistory,
      ...(commercialChangeSetPatches.length ? [commercialChangeSetFromPatches({
        revisionId: commercialRevisionReferenceForPatch().revisionId,
        opportunityId: commercialRevisionReferenceForPatch().opportunityId,
        repositoryId: commercialRevisionReferenceForPatch().repositoryId,
        proposalId: commercialRevisionReferenceForPatch().proposalId,
        routeRepositoryId: commercialRevisionReferenceForPatch().routeRepositoryId,
        estimateId: commercialRevisionReferenceForPatch().estimateId,
        workbookId: commercialRevisionReferenceForPatch().workbookId,
        patches: commercialChangeSetPatches,
        createdBy: currentUserName,
        createdById: currentUserId,
        revisionNumber: commercialChangeSetHistory.length + 1,
      })] : []),
    ].map((changeSet) => ({
      id: changeSet.changeSetId,
      relationships: [
        `commercialRevision:${changeSet.revisionId}`,
        `opportunity:${changeSet.opportunityId || "missing"}`,
        `proposal:${changeSet.proposalId || "missing"}`,
      ],
      storagePath: repositoryRecordPath("commercial-change-sets", changeSet.changeSetId),
      json: {
        changeSetId: changeSet.changeSetId,
        revisionId: changeSet.revisionId,
        status: changeSet.status,
        patchCount: changeSet.patchCount,
        revisionHash: changeSet.revisionHash,
        patchSetOnly: true,
        repositoryTruthImmutable: true,
        patches: changeSet.patches.map((patch) => ({
          patchId: patch.patchId,
          patchType: patch.patchType,
          targetObjectId: patch.targetObjectId,
          targetProperty: patch.targetProperty,
          validationState: patch.validationState,
        })),
      },
    }));
    const commercialReleaseRecords = commercialAuthorityDiagnostics.commercialReleasePackageId ? [{
      id: commercialAuthorityDiagnostics.commercialReleasePackageId,
      relationships: [
        `commercialRevision:${commercialAuthorityDiagnostics.commercialRevisionId || "missing"}`,
        `proposal:${commercialAuthorityDiagnostics.proposalId || "missing"}`,
        `draftIof:${commercialAuthorityDiagnostics.draftIofPackageId || "pending"}`,
      ],
      storagePath: repositoryRecordPath("commercial-release-packages", commercialAuthorityDiagnostics.commercialReleasePackageId),
      json: {
        commercialReleasePackageId: commercialAuthorityDiagnostics.commercialReleasePackageId,
        commercialRevisionId: commercialAuthorityDiagnostics.commercialRevisionId,
        releaseHash: commercialAuthorityDiagnostics.releaseHash,
        currentAuthority: "COMMERCIAL_RELEASE_PACKAGE",
        referenceOnly: true,
        noCommercialTruthDuplication: true,
      },
    }] : [];
    const revisionRecords = commercialOpportunities.flatMap((opportunity) => (opportunity.revisionHistory ?? []).map((revision, index) => ({
      id: `${opportunity.opportunityId}:${String(revision.revisionId ?? revision.revision ?? `revision-${index + 1}`)}`,
      relationships: [`opportunity:${opportunity.opportunityId}`],
      storagePath: `${repositoryRecordPath("commercial-opportunities", opportunity.opportunityId)}#/revisionHistory/${index}`,
      json: revision,
    })));
    return [
      { id: "customers", label: "Customer Repository", endpoint: "GET /api/accounts / POST /api/accounts / PUT /api/accounts/:id", storage: "server/data/accounts/*.json", records: customerRecords },
      { id: "customer-twin", label: "Customer Twin Repository", endpoint: "GET /api/runtime/inventories + GET /api/runtime/objects", storage: "server/data/runtime-inventories/*.json + server/data/runtime-objects/*.json", records: twinRecords },
      { id: "opportunities", label: "Opportunity Repository", endpoint: "GET /api/commercial/opportunities / POST /api/commercial/opportunities / POST /api/commercial/opportunities/:id/open", storage: "server/data/commercial-opportunities/*.json", records: opportunityRecords },
      { id: "routes", label: "Route Repository", endpoint: `GET ${COMMERCIAL_ROUTE_REPOSITORY_ENDPOINT} / POST ${COMMERCIAL_ROUTE_REPOSITORY_ENDPOINT} / GET ${COMMERCIAL_ROUTE_REPOSITORY_ENDPOINT}/:id / PUT ${COMMERCIAL_ROUTE_REPOSITORY_ENDPOINT}/:id`, storage: "server/data/commercial-routes/*.json", records: routeRecords },
      { id: "commercial-revisions", label: "Commercial Revision Repository", endpoint: "GET /api/commercial/revisions / POST /api/commercial/revisions / GET /api/commercial/revisions/:id", storage: "server/data/commercial-revisions/*.json", records: commercialRevisionRecords },
      { id: "commercial-change-sets", label: "Commercial Change Set Repository", endpoint: "GET /api/commercial/change-sets / POST /api/commercial/change-sets / POST /api/commercial/change-sets/:id/replay", storage: "server/data/commercial-change-sets/*.json", records: commercialChangeSetRecords },
      { id: "proposals", label: "Proposal Repository", endpoint: "GET /api/proposals / POST /api/proposals / POST /api/proposals/:id/open", storage: "server/data/proposal-drafts/*.json", records: proposalRecords },
      { id: "commercial-release-packages", label: "Commercial Release Package Repository", endpoint: "GET /api/commercial/release-packages / POST /api/commercial/release-packages / GET /api/commercial/release-packages/:id", storage: "server/data/commercial-release-packages/*.json", records: commercialReleaseRecords },
      { id: "revisions", label: "Legacy Embedded Revision History", endpoint: "Embedded append-only revisionHistory on Opportunity Repository records", storage: "server/data/commercial-opportunities/*.json#/revisionHistory", records: revisionRecords },
    ];
  }, [accountCustomerTwin?.customerTwinId, accountOptions, activeCommercialOpportunityId, commercialAuthorityDiagnostics, commercialChangeSetHistory, commercialChangeSetPatches, commercialOpportunities, commercialRouteRepositoryRecords, currentUserId, currentUserName, customerNetworkGraph, proposalRuntimeRecords, selectedAccount.accountId]);
  const inventoryPerformanceStats = inventoryCacheStats();
  const projectionCacheStats = constitutionalProjectionCacheTelemetry();
  const lastMutationTrace = useMemo(() => latestCommercialMutationTrace(), [mutationTraceRevision]);
  const recentRuntimePerformanceMetrics = latestRuntimePerformanceMetrics().slice(-20).reverse();

  function isCommercialWorkbookSectionOpen(sectionId: string) {
    return commercialWorkbookOpenSections.has(sectionId);
  }

  function handleCommercialWorkbookSectionToggle(sectionId: string, open: boolean) {
    setCommercialWorkbookOpenSections((prev) => {
      const next = new Set(prev);
      if (open) next.add(sectionId);
      else next.delete(sectionId);
      return next;
    });
  }

  function focusCivilMixCalibration() {
    handleCommercialWorkbookSectionToggle("construction-mix", true);
    window.requestAnimationFrame(() => {
      document.getElementById("civil-mix-calibration")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  if (!selectedAccountId) {
    const nextAccountNumber = Math.max(0, ...accountOptions.map((account) => account.accountNumber)) + 1;
    return (
      <section className="dal-workspace wide commercial-account-gate" aria-label="Account Manager">
        <div className="commercial-compact-header commercial-account-gate-header">
          <div className="commercial-compact-brand">
            <img className="commercial-compact-logo" src={teralinxLogo} alt="TeralinX" />
            <div className="commercial-compact-brand-copy">
              <b>Account Manager</b>
              <span>Select an account or create a new governed account to begin Commercial Planning.</span>
            </div>
          </div>
        </div>
        <section className="dal-panel commercial-account-gate-panel">
          <div className="dal-panel-title-row">
            <div>
              <h2>Choose an account</h2>
              <span>No customer information is loaded until an account is selected.</span>
            </div>
            <span className="dal-badge warning">No account selected</span>
          </div>
          <div className="commercial-account-gate-actions">
            <label>
              <span>Account</span>
              <select value="" onChange={(event) => selectAccount(event.currentTarget.value)} aria-label="Select account">
                <option value="">Select an account...</option>
                {accountOptions.map((account) => (
                  <option key={`gate-${account.accountId}`} value={account.accountId}>Account {account.accountNumber} · {account.name}</option>
                ))}
              </select>
            </label>
            <span>or</span>
            <button className="dal-button primary" type="button" onClick={handleCreateAccountDraft}>Create New Account</button>
          </div>
          {accountEditorOpen ? (
            <div className="commercial-account-create-panel">
              <div className="dal-panel-title-row">
                <div>
                  <h3>Create Account {nextAccountNumber}</h3>
                  <span>The formal account number and internal account key are assigned automatically when saved.</span>
                </div>
              </div>
              <div className="account-workspace-editor">
                <label>
                  <span>Account Name</span>
                  <input autoFocus value={accountDraft.name} onChange={(event) => updateAccountDraftField("name", event.currentTarget.value)} placeholder="Customer or organization name" />
                </label>
                <label>
                  <span>Type</span>
                  <input value={accountDraft.accountType} onChange={(event) => updateAccountDraftField("accountType", event.currentTarget.value)} placeholder="Customer type" />
                </label>
                <label>
                  <span>Status</span>
                  <input value={accountDraft.status} onChange={(event) => updateAccountDraftField("status", event.currentTarget.value)} placeholder="Prospect" />
                </label>
                <label>
                  <span>Sales Owner</span>
                  <input value={accountDraft.salesOwner} onChange={(event) => updateAccountDraftField("salesOwner", event.currentTarget.value)} />
                </label>
                <label>
                  <span>Engineering Contact</span>
                  <input value={accountDraft.primaryEngineeringContact} onChange={(event) => updateAccountDraftField("primaryEngineeringContact", event.currentTarget.value)} />
                </label>
                <label>
                  <span>Procurement Contact</span>
                  <input value={accountDraft.procurementContact} onChange={(event) => updateAccountDraftField("procurementContact", event.currentTarget.value)} />
                </label>
                <label className="wide">
                  <span>Notes</span>
                  <input value={accountDraft.notes} onChange={(event) => updateAccountDraftField("notes", event.currentTarget.value)} />
                </label>
                <button type="button" className="primary" onClick={() => void handleSaveAccountDraft()} disabled={accountPersistencePending || !accountDraft.name.trim()}>
                  Save Account {nextAccountNumber}
                </button>
                <button type="button" className="secondary" onClick={() => setAccountEditorOpen(false)} disabled={accountPersistencePending}>
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
        </section>
      </section>
    );
  }

  if (opportunityRestoreState.status === "RESTORING") {
    return (
      <section className="dal-workspace wide commercial-restore-workspace" aria-label="Opportunity restore loading state">
        <div className="commercial-compact-header">
          <div className="commercial-compact-brand">
            <img className="commercial-compact-logo" src={teralinxLogo} alt="TeralinX" />
            <div>
              <b>Opening {opportunityRestoreState.opportunityName || "Opportunity"}...</b>
              <span>Opportunity Repository restore is validating before Commercial Planning renders.</span>
            </div>
          </div>
        </div>
        <section className="commercial-restore-panel">
          <div className="dal-panel-title-row">
            <div>
              <h3>Repository Restore</h3>
              <span>{opportunityRestoreState.opportunityId}</span>
            </div>
            <span className="dal-badge warning">Loading</span>
          </div>
          <div className="commercial-restore-steps">
            {opportunityRestoreState.steps.map((step) => (
              <div key={`restore-step-${step.id}`} className={`commercial-restore-step ${step.status.toLowerCase()}`}>
                <span>{step.status === "LOADING" ? `Loading ${step.label}` : step.label}</span>
                <b>{step.status === "PENDING" ? "Pending" : step.status}</b>
                {step.reason ? <small>{step.reason}</small> : null}
              </div>
            ))}
          </div>
          <div className="commercial-restore-log">
            {opportunityRestoreState.log.map((line, index) => (
              <span key={`restore-log-${index}`}>{line}</span>
            ))}
          </div>
        </section>
      </section>
    );
  }

  return (
    <section className="dal-workspace wide">
      <div className="commercial-compact-header">
        <div className="commercial-compact-brand">
          <img className="commercial-compact-logo" src={teralinxLogo} alt="TeralinX" />
          <div className="commercial-compact-brand-copy">
            <b>Account Manager</b>
            <span>Commercial Planning for {selectedProductOption.productName}</span>
          </div>
        </div>
        <div className="commercial-compact-header-grid" aria-label="Commercial workspace status">
          <div><span>Account</span><b title={`Account ${selectedAccount.accountNumber} · ${selectedAccount.name}`}>Account {selectedAccount.accountNumber} · {selectedAccount.name}</b></div>
          <label>
            <span>Opportunity Name</span>
            <input value={opportunityNameDraft} onChange={(event) => setOpportunityNameDraft(event.currentTarget.value)} aria-label="Opportunity Name" />
          </label>
          <div><span>Opportunity ID</span><b title={activeCommercialOpportunity?.opportunityId ?? "Unsaved"}>{activeCommercialOpportunity?.opportunityId ?? "Unsaved"}</b></div>
          <label>
            <span>Product</span>
            <select value={selectedProductId} onChange={(event) => setSelectedProductId(event.currentTarget.value)} aria-label="Product selector">
              {LAYER_1_PRODUCT_OPTIONS.map((product) => (
                <option key={`header-product-${product.productId}`} value={product.productId}>{product.productName}</option>
              ))}
            </select>
          </label>
          <div><span>Commercial Status</span><b title={activePersistedLifecycleState.replaceAll("_", " ")}>{activePersistedLifecycleState.replaceAll("_", " ")}</b></div>
          <div><span>Owner</span><b title={compactOwner}>{compactOwner}</b></div>
          <div><span>Created</span><b>{activeCommercialOpportunity?.createdAt ? new Date(activeCommercialOpportunity.createdAt).toLocaleDateString() : "Not saved"}</b></div>
          <div><span>Modified</span><b>{activeCommercialOpportunity?.updatedAt ? new Date(activeCommercialOpportunity.updatedAt).toLocaleDateString() : "Not saved"}</b></div>
          <div><span>Estimate Status</span><b>{estimateStatusLabel}</b></div>
          <div><span>Proposal Status</span><b>{proposalStatusLabel}</b></div>
        </div>
        <div className="commercial-compact-actions">
          <div className="commercial-action-group commercial-action-group-primary" aria-label="Opportunity actions">
            <span className="commercial-action-group-label">Opportunity</span>
            <button className="dal-button primary" type="button" onClick={handleNewCommercialOpportunity}>
              New Opportunity
            </button>
            <select value="" onChange={(event) => handleOpportunityLibrarySelect(event.currentTarget.value)} aria-label="Open opportunity or library item">
              <option value="">Open Opportunity</option>
            {accountOpportunityGroups.map((group) => (
              <optgroup key={`opportunity-state-${group.state}`} label={group.state.replaceAll("_", " ")}>
                {group.records.map((record) => (
                  <option key={`${group.state}-${record.opportunityId}`} value={`opportunity::${record.opportunityId}`}>
                    {record.name} | {record.opportunityId} | {record.productName ?? "Product pending"} | {record.owner ?? "Unassigned"} | {new Date(record.updatedAt).toLocaleDateString()}
                  </option>
                ))}
              </optgroup>
            ))}
            <optgroup label="Create">
              <option value="new::opportunity">New Opportunity</option>
            </optgroup>
            {accountImportedCustomerRoutes.length ? (
              <optgroup label="Customer Designs">
                {accountImportedCustomerRoutes.map((entry) => (
                  <option key={`design-${entry.importRecord.importId}-${entry.route.routeId}`} value={`customer-design::${entry.importRecord.importId}::${entry.route.routeId}`}>
                    {entry.importRecord.designId} / {entry.route.name}
                  </option>
                ))}
              </optgroup>
            ) : null}
            {selectedRouteEngineeringDraft?.revisions.length ? (
              <optgroup label="Engineering Revisions">
                {selectedRouteEngineeringDraft.revisions.map((revision) => (
                  <option key={`engineering-${revision.revisionId}`} value={`engineering::${revision.revisionId}`}>
                    {revision.revisionName}
                  </option>
                ))}
              </optgroup>
            ) : null}
            </select>
            <button className="dal-button secondary" type="button" onClick={handleSaveCommercialOpportunity} disabled={routePersistencePending || Boolean(activeCommercialOpportunity && !canModifyActiveOpportunity)}>
              Save
            </button>
            <button className="dal-button secondary" type="button" onClick={handleSaveAsCommercialOpportunity} disabled={routePersistencePending}>
              Save As
            </button>
          </div>
          <div className="commercial-action-group" aria-label="Customer and route actions">
            <span className="commercial-action-group-label">Customer &amp; Route</span>
            <select value={selectedAccount.accountId} onChange={(event) => selectAccount(event.currentTarget.value)} aria-label="Active account selector">
              <option value="">Select account...</option>
              {accountOptions.map((account) => (
                <option key={account.accountId} value={account.accountId}>Account {account.accountNumber} · {account.name}</option>
              ))}
            </select>
            <label className="dal-button secondary commercial-file-action">
              Import Network
              <input
                type="file"
                accept=".kmz,.kml,.geojson,.json"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0] ?? null;
                  event.currentTarget.value = "";
                  void handleExistingInventoryFile(file);
                }}
              />
            </label>
            <label className="dal-button secondary commercial-file-action">
              Import Route
              <input
                type="file"
                accept=".kmz,.kml,.geojson,.json,.csv"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0] ?? null;
                  event.currentTarget.value = "";
                  void handleRouteImportFile(file);
                }}
              />
            </label>
          </div>
          <div className="commercial-action-group" aria-label="Preview actions">
            <span className="commercial-action-group-label">Tools &amp; Preview</span>
            <button className="dal-button secondary" type="button" onClick={focusCivilMixCalibration}>
              Civil Mix
            </button>
            <button className="dal-button secondary" type="button" onClick={() => setProposalPreviewOpen(true)}>
              Proposal
            </button>
            <button className="dal-button secondary" type="button" onClick={() => handleCommercialWorkbookSectionToggle("service-order-preview", true)}>
              Service Order
            </button>
          </div>
        </div>
      </div>

      <div className="dal-status commercial-opportunity-notice">{opportunityNotice}</div>
      {opportunityRestoreState.status !== "IDLE" ? (
        <details className={`commercial-restore-report ${opportunityRestoreState.status.toLowerCase()}`} open={opportunityRestoreState.status === "FAILED" || opportunityRestoreState.warnings.length > 0}>
          <summary>
            <b>Repository Restore</b>
            <span>{opportunityRestoreState.status === "FAILED" ? "Failed" : opportunityRestoreState.warnings.length ? "Restored with warnings" : "Restored"}</span>
          </summary>
          {opportunityRestoreState.fatalError ? <div className="dal-status fail">{opportunityRestoreState.fatalError}</div> : null}
          {opportunityRestoreState.warnings.length ? (
            <div className="commercial-restore-warning-list">
              {opportunityRestoreState.warnings.map((warning, index) => (
                <span key={`restore-warning-${index}`}>{warning}</span>
              ))}
            </div>
          ) : null}
          <div className="commercial-restore-steps compact">
            {opportunityRestoreState.steps.map((step) => (
              <div key={`restore-report-step-${step.id}`} className={`commercial-restore-step ${step.status.toLowerCase()}`}>
                <span>{step.label}</span>
                <b>{step.status}</b>
                {step.reason ? <small>{step.reason}</small> : null}
              </div>
            ))}
          </div>
          <div className="commercial-restore-log">
            {opportunityRestoreState.log.map((line, index) => (
              <span key={`restore-report-log-${index}`}>{line}</span>
            ))}
          </div>
        </details>
      ) : null}

      <section className="commercial-lifecycle-ribbon" aria-label="Commercial to Engineering lifecycle ribbon">
        {commercialLifecycleRibbonSteps.map((step) => (
          <div className={`commercial-lifecycle-step ${step.state}`} key={`commercial-lifecycle-${step.key}`}>
            <span>{step.state === "completed" ? "OK" : step.state === "current" ? ">" : "o"}</span>
            <b>{step.label}</b>
            <small>{step.detail}</small>
          </div>
        ))}
      </section>

      <section className="dal-panel commercial-lifecycle-sequencing-panel" aria-label="Commercial Lifecycle Sequencing">
        <div className="dal-panel-title-row">
          <div>
            <h3>Commercial Lifecycle</h3>
            <span>{commercialLifecycleSequencingNotice}</span>
          </div>
          <span className={`dal-badge ${commercialLifecycleSequencingBlocker ? "warning" : "pass"}`}>
            {commercialLifecycleSequencingBlocker ? "Blocked" : "Commercial Ready"}
          </span>
        </div>
        <div className="dal-list compact">
          {commercialLifecycleSequencingRows.map((row) => (
            <div className="dal-list-row teralinx-list-row" key={`commercial-lifecycle-sequencing-${row.key}`}>
              <b>{row.label}</b>
              <span className={`dal-badge ${row.ok ? "pass" : "fail"}`}>{row.ok ? "PASS" : "FAIL"}</span>
              <small>
                {String(row.detail)}
                {!row.ok ? ` Reason: ${String(row.detail)}. Automatic IOF Assembly blocked. Repair: ${row.recommendation}` : ""}
              </small>
            </div>
          ))}
        </div>
      </section>

      {commercialConstitutionalHandoffVisible ? (
        <section className="dal-panel commercial-constitutional-handoff-card" aria-label="Commercial Engineering Handoff">
          <div className="dal-panel-title-row">
            <div>
              <h3>Commercial Release Readiness</h3>
              <span>{submittedToEngineering ? "Commercial is locked and Engineering owns the review queue." : "Release the exact saved and approved Proposal Revision through each governed artifact."}</span>
            </div>
            <span className={`dal-badge ${submittedToEngineering ? "pass" : commercialConstitutionalHandoffReady ? "warning" : "fail"}`}>
              {submittedToEngineering ? "Submitted" : commercialConstitutionalHandoffReady ? "Ready" : "Blocked"}
            </span>
          </div>
          <label className="commercial-release-revision-selector">
            <span>Eligible Proposal Revision</span>
            <select value={selectedReleaseProposalRevision?.proposalRevisionId ?? ""} onChange={(event) => setReleaseProposalRevisionId(event.currentTarget.value)}>
              <option value="">Select a saved revision</option>
              {savedProposalRevisions.map((revision) => {
                const approval = activeProposalRuntime ? proposalRevisionApproval(revision, activeProposalRuntime.approvals ?? []) : null;
                return <option key={revision.proposalRevisionId} value={revision.proposalRevisionId}>Revision {revision.revisionNumber} · {revision.revisionStatus} · {approval ? "APPROVED" : "NOT APPROVED"}</option>;
              })}
            </select>
          </label>
          <div className="teralinx-summary-grid">
            <div><span>Proposal</span><b>{activeProposalRuntime?.proposalNumber ?? activeProposalRuntime?.proposalId ?? "Missing"}</b></div>
            <div><span>Customer Acceptance</span><b>{customerApproved ? "Accepted" : "Pending"}</b></div>
            <div><span>Commercial Revision</span><b>{commercialAuthorityDiagnostics.commercialRevisionId || "Missing"}</b></div>
            <div><span>Release Package</span><b>{commercialAuthorityDiagnostics.commercialReleasePackageId || displayedDraftIofPackage?.commercialReleasePackageId || "Pending"}</b></div>
            <div><span>Draft IOF Package</span><b>{displayedDraftIofPackage?.packageId ?? "Missing"}</b></div>
            <div><span>Route Repository</span><b>{activeDashboardRouteRepositoryId || "Missing"}</b></div>
            <div><span>Engineering Package</span><b>{submittedEngineeringPackageId || "Not submitted"}</b></div>
            <div><span>Engineering Status</span><b>{submittedEngineeringStatus.replaceAll("_", " ")}</b></div>
          </div>
          {!submittedToEngineering ? (
            <div className="dal-list compact">
              {commercialReleaseReadinessRows.map((check) => (
                <div className="dal-list-row teralinx-list-row" key={`handoff-blocker-${check.key}`}>
                  <b>{check.label}</b>
                  <span className={`dal-badge ${check.ok ? "pass" : "warning"}`}>{check.ok ? "READY" : check.key === "release-package" ? "NOT CREATED" : "BLOCKED"}</span>
                  <small>{check.detail}</small>
                </div>
              ))}
            </div>
          ) : null}
          <div className="dal-actions">
            {!submittedToEngineering ? (
              <button
                type="button"
                className="primary"
                data-action-authority="submit-to-engineering"
                onClick={() => void handleSubmitCommercialDraftIofToEngineering()}
                disabled={proposalRuntimeActionPending || engineeringCertificationPending}
              >
                Release to Engineering
              </button>
            ) : (
              <button
                type="button"
                className="primary"
                data-action-authority="open-engineering-certification"
                onClick={handleOpenSubmittedEngineeringCertification}
                disabled={!submittedEngineeringPackageId || engineeringCertificationPending}
              >
                Open Engineering Certification
              </button>
            )}
            <span className="dal-status">ScopeVersion remains blocked until customer signature and executed Service Order.</span>
          </div>
        </section>
      ) : null}

      <details className="account-workspace-dashboard commercial-intake-drawer" aria-label="Customer Twin account drawer">
        <summary className="commercial-intake-summary">
          <span>Customer Twin</span>
          <b>Account {selectedAccount.accountNumber} · {selectedAccount.name}</b>
          <small>{accountNotice}</small>
          <span className={`dal-badge ${selectedGovernedAccount ? "pass" : accountLibraryLoaded ? "warning" : "fail"}`}>
            {selectedGovernedAccount ? "Governed Account" : accountLibraryLoaded ? "Fixture fallback" : "Loading"}
          </span>
        </summary>
        <div className="commercial-intake-drawer-body">
        <div className="dal-panel-title-row">
          <div>
            <h3>Account Workspace</h3>
            <span>{accountNotice}</span>
          </div>
          <span className={`dal-badge ${selectedGovernedAccount ? "pass" : accountLibraryLoaded ? "warning" : "fail"}`}>
            {selectedGovernedAccount ? "Governed Account" : accountLibraryLoaded ? "Fixture fallback" : "Loading"}
          </span>
        </div>
        <div className="dal-actions">
          <button className="dal-button secondary" type="button" onClick={handleCreateAccountDraft}>
            New Account
          </button>
          <button className="dal-button secondary" type="button" onClick={handleEditSelectedAccount}>
            Edit Account
          </button>
        </div>
        <div className="account-workspace-summary">
          <div><span>Formal Account</span><b>Account {selectedAccount.accountNumber}</b></div>
          <div><span>Account Name</span><b>{selectedAccount.name}</b></div>
          <div><span>Customer ID</span><b>{customerIdForAccount(selectedAccount.accountId)}</b></div>
          <div><span>Contacts</span><b>{governedContactsForSelectedAccount.length || selectedAccount.contacts.length}</b></div>
          <div><span>Product</span><b>{selectedProductOption.productName}</b></div>
          <div><span>Doctrine</span><b>{selectedProductDoctrine?.doctrineId ?? "No product doctrine"}</b></div>
          <div><span>Doctrine Validation</span><b>{productDoctrineAssembly?.validationSummary.status ?? "Not assembled"}</b></div>
          <div><span>Opportunities</span><b>{accountCommercialOpportunities.length}</b></div>
          <div><span>Proposals</span><b>{accountProposalRuntimeRecords.length}</b></div>
          <div><span>IOF Packages</span><b>{activeDraftIofPackage?.customerId === customerIdForAccount(selectedAccount.accountId) || activeDraftIofPackage?.accountId === selectedAccount.accountId ? "1" : "0"}</b></div>
          <div><span>Recent Activity</span><b>{accountRuntimeHistory.length}</b></div>
        </div>
        {selectedGovernedAccount ? <AccountDealRoomPanel accountId={selectedGovernedAccount.accountId} /> : null}

        <div className="account-product-fulfillment">
          <label>
            <span>Product</span>
            <select value={selectedProductId} onChange={(event) => setSelectedProductId(event.currentTarget.value)} aria-label="Product selector">
              {LAYER_1_PRODUCT_OPTIONS.map((product) => (
                <option key={product.productId} value={product.productId}>{product.productName}</option>
              ))}
            </select>
          </label>
          {selectedProductDoctrine ? (
            <div className="account-fulfillment-mix">
              <div><span>Doctrine</span><b>{selectedProductDoctrine.doctrineVersion}</b></div>
              <div><span>Network</span><b>{selectedProductDoctrine.rules.networkClass}</b></div>
              <div><span>Topology</span><b>{selectedProductDoctrine.rules.topology}</b></div>
              <div><span>Layer</span><b>{selectedProductDoctrine.rules.layer}</b></div>
              <div><span>Optical Transport</span><b>{selectedProductDoctrine.rules.opticalTransport ? "Allowed" : "False"}</b></div>
              <div><span>Engineering Gate</span><b>{selectedProductDoctrine.rules.engineeringCertificationRequired ? "Required" : "Open"}</b></div>
            </div>
          ) : null}
          {selectedProductDefinition ? (
            <div className="account-fulfillment-mix" data-product-registry-resolution="resolved">
              <div><span>Product Registry</span><b>{selectedProductDefinition.status}</b></div>
              <div><span>Doctrine Version</span><b>{selectedProductDefinition.doctrineVersion}</b></div>
              <div><span>Required Services</span><b>{selectedProductDefinition.requiredServices.join(", ").replaceAll("_", " ")}</b></div>
              <div><span>Required Asset Classes</span><b>{selectedProductDefinition.assetClasses.filter((item) => item.mode === "REQUIRED").map((item) => item.objectClass).join(", ")}</b></div>
              <div><span>Commercial Profile</span><b>{selectedProductDefinition.commercialProfile.profileId}</b></div>
              <div><span>Acceptance Profile</span><b>{selectedProductDefinition.acceptanceProfile.profileId}</b></div>
              <div><span>Maintenance Profile</span><b>{selectedProductDefinition.maintenanceProfile.profileId}</b></div>
              <div><span>Contract Profile</span><b>{selectedProductDefinition.contractProfile.contractProfileId}</b></div>
              <div><span>Commercial ScopeVersion</span><b>{selectedProductDefinition.commercialScopeVersionCreationAllowed ? "Allowed" : "Prohibited"}</b></div>
            </div>
          ) : null}
          <div className="account-fulfillment-mix" data-product-assembly-status="visible">
            <div><span>Doctrine Applied</span><b>{productDoctrineAssembly?.validationSummary.status ?? "Not assembled"}</b></div>
            <div><span>Source Evidence Loaded</span><b>{activeSourceFileReference !== "None" ? "YES" : "NO"}</b></div>
            <div><span>Quantity Reconciliation</span><b>{asDisplayArray((displayedDraftIofPackage as Record<string, unknown> | null)?.quantityReconciliation).length ? "AVAILABLE" : "PENDING"}</b></div>
            <div><span>Object Manifest Status</span><b>{manifestCount(displayedDraftIofPackage, "objectIds") || asDisplayArray(displayedDraftIofPackage?.instantiatedSpineObjects).length ? "ASSEMBLED" : "PENDING"}</b></div>
            <div><span>Draft IOF Readiness</span><b>{constitutionalAssemblyReview.draftIofReadiness}</b></div>
          </div>
          <div className="account-fulfillment-mix">
            {CARRIER_NEUTRAL_FULFILLMENT_MIX.map((item) => (
              <div key={item.ownershipClass}>
                <span>{item.label}</span>
                <b>{item.percentage}%</b>
              </div>
            ))}
          </div>
        </div>

        <section className="dal-panel product-configurator-panel" aria-label="Product Configurator">
          <div className="dal-panel-title-row">
            <div>
              <h3>Product Configurator</h3>
              <span>{productConfiguratorNotice}</span>
            </div>
            <span className={`dal-badge ${productConfiguratorResult?.validation.status === "PASS" ? "pass" : selectedProductConfiguratorId ? "warning" : "fail"}`}>
              {productConfiguratorResult?.validation.status ?? selectedProductConfiguratorId ?? "No Configurator"}
            </span>
          </div>
          <div className="account-workspace-summary">
            <div><span>Step 1 Customer</span><b>{selectedAccount.name}</b></div>
            <label>
              <span>Step 2 Product</span>
              <select value={selectedProductId} onChange={(event) => setSelectedProductId(event.currentTarget.value)} aria-label="Product Configurator product">
                {LAYER_1_PRODUCT_OPTIONS.map((product) => (
                  <option key={`configurator-${product.productId}`} value={product.productId}>{product.productName}</option>
                ))}
              </select>
            </label>
            <div><span>Configurator</span><b>{selectedProductConfiguratorId ?? "Unavailable"}</b></div>
            <div><span>Doctrine</span><b>{selectedProductDoctrine ? `${selectedProductDoctrine.doctrineId} ${selectedProductDoctrine.doctrineVersion}` : "Unavailable"}</b></div>
          </div>
          <div className="account-product-fulfillment">
            <label>
              <span>Step 3 A Location</span>
              <input value={opportunityScoutAzOrigin} onChange={(event) => setOpportunityScoutAzOrigin(event.currentTarget.value)} placeholder="Address or lat,lng" />
            </label>
            <label>
              <span>Step 3 Z Location</span>
              <input value={opportunityScoutAzDestination} onChange={(event) => setOpportunityScoutAzDestination(event.currentTarget.value)} placeholder="Address or lat,lng" />
            </label>
            <div className="account-fulfillment-mix">
              <div><span>A Status</span><b>{azOriginLocation ? `${azOriginLocation.label} / ${locationSourceLabel(azOriginLocation.source)}` : "Unresolved"}</b></div>
              <div><span>Z Status</span><b>{azDestinationLocation ? `${azDestinationLocation.label} / ${locationSourceLabel(azDestinationLocation.source)}` : "Unresolved"}</b></div>
            </div>
          </div>
          <div className="dal-actions">
            <button type="button" className="secondary" onClick={() => handleResolveAzTextLocation("A")} disabled={!opportunityScoutAzOrigin.trim()}>
              Resolve A
            </button>
            <button type="button" className="secondary" onClick={() => handleResolveAzTextLocation("Z")} disabled={!opportunityScoutAzDestination.trim()}>
              Resolve Z
            </button>
            <button type="button" className="secondary" onClick={handleBeginAzOpportunity}>
              Open A/Z Selector
            </button>
            <button
              type="button"
              className="primary"
              onClick={handleBuildProductCommercialDesign}
              disabled={
                selectedProductConfiguratorId !== POINT_TO_POINT_CONFIGURATOR_ID ||
                (!azOriginLocation && !opportunityScoutAzOrigin.trim()) ||
                (!azDestinationLocation && !opportunityScoutAzDestination.trim())
              }
            >
              BUILD COMMERCIAL DESIGN
            </button>
          </div>
          {productConfiguratorResult ? (
            <>
              <div className="dal-panel-title-row">
                <div>
                  <h3>Context Inspector</h3>
                  <span>{productConfiguratorResult.draftPackage.packageId}</span>
                </div>
                <span className="dal-badge pass">{productConfiguratorResult.contextInspector.draftPackageStatus.replaceAll("_", " ")}</span>
              </div>
              <div className="teralinx-summary-grid">
                <div><span>Customer</span><b>{productConfiguratorResult.contextInspector.customer}</b></div>
                <div><span>Opportunity</span><b>{productConfiguratorResult.contextInspector.opportunity}</b></div>
                <div><span>Product</span><b>{productConfiguratorResult.contextInspector.product}</b></div>
                <div><span>Doctrine</span><b>{productConfiguratorResult.contextInspector.doctrine}</b></div>
                <div><span>Configurator</span><b>{productConfiguratorResult.contextInspector.configurator}</b></div>
                <div><span>Route Length</span><b>{productConfiguratorResult.contextInspector.routeLength}</b></div>
                <div><span>Measured Spine</span><b>{productConfiguratorResult.contextInspector.measuredSpine}</b></div>
                <div><span>Station Count</span><b>{productConfiguratorResult.contextInspector.stationCount.toLocaleString()}</b></div>
                <div><span>Design Objects</span><b>{productConfiguratorResult.contextInspector.engineeringObjects.toLocaleString()}</b></div>
                <div><span>Quantities</span><b>{productConfiguratorResult.contextInspector.quantities}</b></div>
                <div><span>Commercial Status</span><b>{productConfiguratorResult.contextInspector.commercialStatus.replaceAll("_", " ")}</b></div>
                <div><span>Draft Package Status</span><b>{productConfiguratorResult.contextInspector.draftPackageStatus.replaceAll("_", " ")}</b></div>
              </div>
              <div className="dal-list">
                {productConfiguratorResult.validation.checks.map((check) => (
                  <div className="dal-list-row teralinx-list-row" key={check.key}>
                    <b>{check.label}</b>
                    <span>{check.status}</span>
                    <small>{check.key}</small>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </section>

        {accountEditorOpen ? (
          <div className="account-workspace-editor">
            <label>
              <span>Internal Account Key</span>
              <input value={accountDraft.accountId} onChange={(event) => updateAccountDraftField("accountId", cleanAccountId(event.currentTarget.value))} placeholder="Assigned automatically" disabled={accountEditorMode === "edit"} />
            </label>
            <label>
              <span>Name</span>
              <input value={accountDraft.name} onChange={(event) => updateAccountDraftField("name", event.currentTarget.value)} placeholder="Google" />
            </label>
            <label>
              <span>Type</span>
              <input value={accountDraft.accountType} onChange={(event) => updateAccountDraftField("accountType", event.currentTarget.value)} placeholder="Hyperscaler" />
            </label>
            <label>
              <span>Status</span>
              <input value={accountDraft.status} onChange={(event) => updateAccountDraftField("status", event.currentTarget.value)} placeholder="Active RFP" />
            </label>
            <label>
              <span>Sales Owner</span>
              <input value={accountDraft.salesOwner} onChange={(event) => updateAccountDraftField("salesOwner", event.currentTarget.value)} />
            </label>
            <label>
              <span>Engineering Contact</span>
              <input value={accountDraft.primaryEngineeringContact} onChange={(event) => updateAccountDraftField("primaryEngineeringContact", event.currentTarget.value)} />
            </label>
            <label>
              <span>Procurement Contact</span>
              <input value={accountDraft.procurementContact} onChange={(event) => updateAccountDraftField("procurementContact", event.currentTarget.value)} />
            </label>
            <label className="wide">
              <span>Notes</span>
              <input value={accountDraft.notes} onChange={(event) => updateAccountDraftField("notes", event.currentTarget.value)} />
            </label>
            <button type="button" className="primary" onClick={() => void handleSaveAccountDraft()} disabled={accountPersistencePending}>
              Save Account
            </button>
          </div>
        ) : null}

        <div className="account-workspace-grid">
          <div>
            <b>Contacts</b>
            <div className="account-contact-form">
              <input value={contactDraft.name} onChange={(event) => updateContactDraftField("name", event.currentTarget.value)} placeholder="Contact name" aria-label="Contact name" />
              <input value={contactDraft.title} onChange={(event) => updateContactDraftField("title", event.currentTarget.value)} placeholder="Title" aria-label="Contact title" />
              <input value={contactDraft.role} onChange={(event) => updateContactDraftField("role", event.currentTarget.value)} placeholder="Role" aria-label="Contact role" />
              <input value={contactDraft.email} onChange={(event) => updateContactDraftField("email", event.currentTarget.value)} placeholder="Email" aria-label="Contact email" />
              <button type="button" onClick={() => void handleSaveContactDraft()} disabled={accountPersistencePending || !selectedGovernedAccount}>
                Add Contact
              </button>
            </div>
            <div className="dal-list">
              {(governedContactsForSelectedAccount.length ? governedContactsForSelectedAccount : selectedAccount.contacts.map((name, index) => ({
                contactId: `${selectedAccount.accountId}-fixture-contact-${index}`,
                name,
                title: "Fixture contact",
                role: "Account",
                email: "",
                status: "Fixture",
              } as GovernedContact))).slice(0, 5).map((contact) => (
                <div className="dal-list-row teralinx-list-row" key={contact.contactId}>
                  <b>{contact.name}</b>
                  <span>{contact.role || contact.title || contact.status}</span>
                  <small>{contact.email || contact.title || "Account scoped contact"}</small>
                </div>
              ))}
            </div>
          </div>
          <div>
            <b>Recent Governed Activity</b>
            <div className="dal-list">
              {accountRuntimeHistory.length ? accountRuntimeHistory.map((event) => (
                <div className="dal-list-row teralinx-list-row" key={event.historyId}>
                  <b>{event.eventType.replaceAll("_", " ")}</b>
                  <span>{event.objectType ?? "Activity"}</span>
                  <small>{event.timestamp ? new Date(event.timestamp).toLocaleString() : event.details}</small>
                </div>
              )) : (
                <div className="dal-status">No recent activity for this Account yet.</div>
              )}
            </div>
          </div>
        </div>
        </div>
      </details>

      {false ? (
        <>
      <section className="dal-panel runtime-lifecycle-bridge-panel">
        <div className="dal-panel-title-row">
          <div>
            <h3>Runtime Lifecycle Bridge</h3>
            <span>{runtimeLifecycleNotice}</span>
          </div>
          <span className={`dal-badge ${runtimeLifecycleState?.status === "ENGINEERING_REVIEW_QUEUED" ? "pass" : runtimeLifecycleState ? "warning" : "fail"}`}>
            {runtimeLifecycleState?.status?.replaceAll("_", " ") ?? "Not synced"}
          </span>
        </div>
        <div className="teralinx-summary-grid">
          <div><span>Lifecycle Progress</span><b>{`${(runtimeLifecycleState?.lifecycleProgress ?? []).filter((item) => item.complete).length}/${runtimeLifecycleState?.lifecycleProgress.length ?? 13}`}</b></div>
          <div><span>Current Authority</span><b>{runtimeLifecycleState?.currentAuthority?.replaceAll("_", " ") ?? "Commercial Planning"}</b></div>
          <div><span>Current Owner</span><b>{runtimeLifecycleState?.currentOwner ?? compactOwner}</b></div>
          <div><span>Current Workspace</span><b>{runtimeLifecycleState?.currentWorkspace ?? currentWorkspaceId}</b></div>
          <div><span>Runtime Object</span><b>{runtimeLifecycleState?.currentRuntimeObject || activeCommercialOpportunity?.runtimeObjectId || "Not bridged"}</b></div>
          <div><span>Current Proposal</span><b>{runtimeLifecycleState?.currentProposal || activeProposalRuntime?.proposalId || "Not generated"}</b></div>
          <div><span>Current IOF Package</span><b>{runtimeLifecycleState?.currentIofPackage || activeDraftIofPackage?.packageId || "Not assembled"}</b></div>
          <div><span>Engineering Status</span><b>{runtimeLifecycleState?.currentEngineeringStatus?.replaceAll("_", " ") ?? "Not queued"}</b></div>
        </div>
        <div className="teralinx-summary-grid">
          <div><span>Current Session</span><b>{runtimeRehydrationState?.workspaceSession?.sessionState ?? "Not loaded"}</b></div>
          <div><span>Resume Token</span><b>{runtimeRehydrationState?.workspaceSession?.resumeToken ?? "Pending"}</b></div>
          <div><span>Restored Authority</span><b>{runtimeRehydrationState?.currentAuthority ?? runtimeRehydrationState?.workspaceSession?.currentAuthority ?? "Runtime"}</b></div>
          <div><span>Restored Execution Order</span><b>{runtimeRehydrationState?.workspaceSession?.scopeVersionId ?? "None"}</b></div>
        </div>
        <div className="dal-status">{runtimeRehydrationNotice}</div>
        <div className="dal-actions">
          <button type="button" onClick={() => void handleAdvanceRuntimeLifecycleBridge("QUOTE_READY_FOR_CUSTOMER")} disabled={!session || runtimeLifecyclePending}>
            Refresh Commercial State
          </button>
        </div>
        <div className="dal-list">
          {(runtimeLifecycleState?.lifecycleProgress ?? [
            "CUSTOMER_TWIN_READY",
            "COMMERCIAL_OPPORTUNITY_CREATED",
            "PRODUCT_SELECTED",
            "INVENTORY_RESOLVED",
            "FULFILLMENT_PLAN_CREATED",
            "COMMERCIAL_DRAFT_CREATED",
            "PROPOSAL_CREATED",
            "PROPOSAL_SUBMITTED",
            "PROPOSAL_ASSIGNED",
            "CUSTOMER_REVIEW_STARTED",
            "CUSTOMER_APPROVED",
            "DRAFT_IOF_PACKAGE_CREATED",
            "ENGINEERING_REVIEW_QUEUED",
          ].map((eventType) => ({ eventType, complete: false, timestamp: "", objectId: "" }))).map((item) => (
            <div className="dal-list-row teralinx-list-row" key={item.eventType}>
              <b>{item.eventType.replaceAll("_", " ")}</b>
              <span>{item.complete ? "Complete" : "Waiting"}</span>
              <small>{item.objectId || item.timestamp || "Runtime will reconnect or create this stage when authority exists."}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="runtime-workspace-dashboard" aria-label="Runtime workspace dashboard">
        <div className="runtime-dashboard-title">
          <div>
            <span>Workspace</span>
            <b>{session?.user.workspace?.name ?? `${currentUserName} Workspace`}</b>
          </div>
          <div>
            <span>Workspace ID</span>
            <b>{currentWorkspaceId}</b>
          </div>
          <div>
            <span>User ID</span>
            <b>{currentUserId}</b>
          </div>
          <div>
            <span>Organization ID</span>
            <b>{currentOrganizationId}</b>
          </div>
        </div>
        <div className="runtime-dashboard-grid">
          <div>
            <b>My Opportunities</b>
            <strong>{myRuntimeOpportunities.length}</strong>
            {myRuntimeOpportunities.slice(0, 3).map((record) => (
              <button key={`my-${record.opportunityId}`} type="button" onClick={() => handleOpenCommercialOpportunity(record.opportunityId)}>
                <span>{record.name}</span>
                <small>{record.visibility ?? "PRIVATE"} / v{record.version ?? 1}</small>
              </button>
            ))}
          </div>
          <div>
            <b>Assigned Work</b>
            <strong>{assignedRuntimeWork.length}</strong>
            {assignedRuntimeWork.slice(0, 3).map((record) => (
              <button key={`assigned-${record.opportunityId}`} type="button" onClick={() => handleOpenCommercialOpportunity(record.opportunityId)}>
                <span>{record.name}</span>
                <small>Owner {record.owner ?? runtimeUserLabel(record.ownerId)}</small>
              </button>
            ))}
          </div>
          <div>
            <b>Pending Approvals</b>
            <strong>{pendingRuntimeApprovals.length}</strong>
            {pendingRuntimeApprovals.slice(0, 3).map((record) => (
              <button key={`approval-${record.opportunityId}`} type="button" onClick={() => handleOpenCommercialOpportunity(record.opportunityId)}>
                <span>{record.name}</span>
                <small>{record.lifecycleState ?? record.status}</small>
              </button>
            ))}
          </div>
          <div>
            <b>Notifications</b>
            <strong>{runtimeNotifications.length}</strong>
            {runtimeNotifications.length ? runtimeNotifications.map((item, index) => <span key={`${item}-${index}`}>{item}</span>) : <span>No notifications</span>}
          </div>
          {executiveDashboardEnabled ? (
            <div className="executive">
              <b>Executive Overview</b>
              <strong>{visibleRuntimeOpportunities.length}</strong>
              <span>Organization Pipeline: {visibleRuntimeOpportunities.length} visible commercial records</span>
              <span>Revenue: {money(activeFinancialAuthority?.lifecycleRevenue ?? 0)}</span>
              <span>Operational Intelligence: {runtimeInfo?.runtimeStatus ?? "loading"}</span>
            </div>
          ) : null}
        </div>
      </section>

        </>
      ) : null}

      <details className="existing-inventory-runtime-section commercial-intake-drawer" aria-label="Existing Inventory import drawer">
        <summary className="commercial-intake-summary">
          <span>Imports</span>
          <b>Existing Inventory</b>
          <small>{existingInventoryImportStatus} / {accountRenderableCustomerTwin.routes.length.toLocaleString()} routes</small>
          <span className={`dal-badge ${existingInventoryImportStatus === "READY" ? "pass" : existingInventoryImportStatus === "ERROR" ? "fail" : "warning"}`}>
            {existingInventoryImportStatus}
          </span>
        </summary>
        <div className="commercial-intake-drawer-body">
        <div className="dal-panel-title-row">
          <div>
            <h3>Existing Inventory</h3>
            <span>Already-built infrastructure. Imports create Customer Twin source data only.</span>
          </div>
          <span className={`dal-badge ${existingInventoryImportStatus === "READY" ? "pass" : existingInventoryImportStatus === "ERROR" ? "fail" : "warning"}`}>
            {existingInventoryImportStatus}
          </span>
        </div>
        <div className="existing-inventory-runtime-grid">
          <div>
            <b>Supported Now</b>
            <span>KMZ</span>
            <span>KML</span>
            <span>GeoJSON</span>
            <span>Runtime Inventory JSON</span>
          </div>
          <div>
            <b>Future Ready</b>
            <span>SHP route intake belongs to Import Route after interface release</span>
            <span>Use converted GeoJSON during this commercial repository sprint</span>
          </div>
          <div>
            <b>Inventory Authority</b>
            <span>Customer Twin source data</span>
            <span>Raw files remain evidence</span>
          </div>
          <div>
            <b>Inventory Status</b>
            <span>{existingInventoryImportNotice}</span>
            <span>Use the header action: Import Existing Network.</span>
          </div>
        </div>
        <div className="existing-inventory-runtime-summary">
          <div><span>Customer Twin</span><b>{accountCustomerTwin?.customerTwinId ?? customerInventoryLoadStatus}</b></div>
          <div><span>Routes</span><b>{accountRenderableCustomerTwin.routes.length.toLocaleString()}</b></div>
          <div><span>Objects</span><b>{accountRenderableCustomerTwin.objects.length.toLocaleString()}</b></div>
          <div><span>Stations</span><b>{accountRenderableCustomerTwin.stations.length.toLocaleString()}</b></div>
          <div><span>Source Files</span><b>{accountCustomerNetworkGraph?.summary.sourceFiles.length.toLocaleString() ?? "0"}</b></div>
          <div><span>Last Updated</span><b>{accountCustomerNetworkGraph?.summary.lastSynchronized ? new Date(accountCustomerNetworkGraph.summary.lastSynchronized).toLocaleString() : "Not loaded"}</b></div>
          <div><span>Lifecycle</span><b>Organization Asset</b></div>
        </div>
        </div>
      </details>

      <details className="customer-design-request-section commercial-intake-drawer" aria-label="Customer Design Request drawer">
        <summary className="commercial-intake-summary">
          <span>Customer Design Request</span>
          <b>{accountCustomerDesignImports.length.toLocaleString()} request(s)</b>
          <small>{selectedImportedCustomerRoute?.name ?? "No proposed route selected"}</small>
          <span className="dal-badge warning">Design Intent</span>
        </summary>
        <div className="commercial-intake-drawer-body">
        <div className="dal-panel-title-row">
          <div>
            <h3>Customer Design Requests</h3>
            <span>Requested or proposed builds. Imports create design intent, candidate design records, and proposed-network views.</span>
          </div>
          <span className="dal-badge warning">Design Intent</span>
        </div>
        <div className="existing-inventory-runtime-grid">
          <div>
            <b>Customer Design Library</b>
            <span>{accountCustomerDesignImports.length.toLocaleString()} request(s)</span>
            <span>{accountImportedCustomerRoutes.length.toLocaleString()} proposed route(s)</span>
            <span>Use the header action: Import Route.</span>
          </div>
          <div>
            <b>Design Intent</b>
            <span>{selectedImportedCustomerDesignImport?.designIntent ?? "No active design request"}</span>
            <span>{selectedImportedCustomerDesignImport?.scopeVersionId ?? "No candidate design selected"}</span>
          </div>
          <div>
            <b>Proposed Network</b>
            <span>{selectedImportedCustomerRoute?.name ?? "No proposed route selected"}</span>
            <span>{selectedImportedCustomerRoute ? formatRouteMiles(selectedImportedCustomerRoute.routeMiles) : "0 mi"}</span>
          </div>
        </div>
        </div>
      </details>

      <section className="teralinx-commercial-landing" aria-label="Teralinx Commercial Planning landing">
        <div className="teralinx-landing-summary">
          <div>
            <span>Workspace</span>
            <b>Commercial Planning</b>
          </div>
          <div>
            <span>Account</span>
            <b>Account {selectedAccount.accountNumber} · {selectedAccount.name}</b>
          </div>
          <div>
            <span>Current User</span>
            <b>{currentUserName} / {session?.user.title ?? "Teralinx"}</b>
          </div>
          <div>
            <span>Runtime Version</span>
            <b>{runtimeInfo?.runtimeVersion ?? "loading"} / {runtimeInfo?.environment ?? "alpha"}</b>
          </div>
          <div>
            <span>Git Commit</span>
            <b>{runtimeInfo?.gitCommit ?? "loading"}</b>
          </div>
          <div>
            <span>Build Date</span>
            <b>{runtimeInfo?.buildDate ? new Date(runtimeInfo.buildDate).toLocaleString() : "loading"}</b>
          </div>
        </div>
        <div className="teralinx-landing-controls">
          <label>
            Account
            <select value={selectedAccountId} onChange={(event) => selectAccount(event.currentTarget.value)} aria-label="Customer selector">
              {accountOptions.map((account) => (
                <option key={account.accountId} value={account.accountId}>Account {account.accountNumber} · {account.name}</option>
              ))}
            </select>
          </label>
          <label>
            Opportunity / Library
            <select value="" onChange={(event) => handleOpportunityLibrarySelect(event.currentTarget.value)} aria-label="Opportunity selector">
              <option value="">Select explicitly...</option>
              {savedCommercialOpportunities.map((record) => (
                <option key={`landing-opportunity-${record.opportunityId}`} value={`opportunity::${record.opportunityId}`}>
                  {record.name}
                </option>
              ))}
              {accountImportedCustomerRoutes.map((entry) => (
                <option key={`landing-design-${entry.importRecord.importId}-${entry.route.routeId}`} value={`customer-design::${entry.importRecord.importId}::${entry.route.routeId}`}>
                  {entry.importRecord.designId} / {entry.route.name}
                </option>
              ))}
            </select>
          </label>
          <div className="teralinx-landing-runtime">
            <span>{commercialLibraryLoaded ? `${accountCommercialOpportunities.length} opportunities` : "Opportunity Library loading"}</span>
            <span>{accountCustomerDesignImports.length} customer designs</span>
            <span>{recentEngineeringDrafts.length} engineering revisions</span>
            <span>{can("runtime.deploy") ? "Runtime deploy authority enabled" : "Runtime deploy authority restricted"}</span>
          </div>
        </div>
        <div className="teralinx-landing-columns">
          <div>
            <b>Recent Opportunities</b>
            {recentCommercialOpportunities.length ? recentCommercialOpportunities.slice(0, 4).map((record) => (
              <button key={`landing-recent-${record.opportunityId}`} type="button" onClick={() => handleOpenCommercialOpportunity(record.opportunityId)}>
                <span>{record.name}</span>
                <small>{new Date(record.updatedAt).toLocaleString()}</small>
              </button>
            )) : <span className="dal-status">No saved opportunity is loaded automatically.</span>}
          </div>
          <div>
            <b>Recent Customer Designs</b>
            {accountImportedCustomerRoutes.length ? accountImportedCustomerRoutes.slice(0, 4).map((entry) => (
              <button key={`landing-design-open-${entry.importRecord.importId}-${entry.route.routeId}`} type="button" onClick={() => handleOpenCustomerDesignFromLibrary(entry.importRecord.importId, entry.route.routeId)}>
                <span>{entry.importRecord.designId}</span>
                <small>{entry.route.name}</small>
              </button>
            )) : <span className="dal-status">No Customer Design Library records for this customer.</span>}
          </div>
          <div>
            <b>Recent Activity</b>
            {recentRuntimeActivity.length ? recentRuntimeActivity.map((event) => (
              <span key={event.activityId} className="teralinx-activity-line">
                <strong>{event.userName}</strong> {event.action} {event.objectName ?? event.objectId}
                <small>{new Date(event.timestamp).toLocaleString()}</small>
              </span>
            )) : <span className="dal-status">No shared runtime activity recorded yet.</span>}
          </div>
        </div>
      </section>

      <CommercialStatusBar
        account={selectedAccount}
        session={accountLiveSession}
        customerReviewStatus={accountCustomerReviewStatus}
        acceptedProposal={accountAcceptedProposal}
        engineeringConfidence={engineeringConfidenceLabel}
        commercialConfidence={commercialConfidenceLabel}
        estimateConfidence={estimateConfidenceLabel}
        unknownConstraintCount={unknownConstraintCount}
        osrmStatus={osrmStatusLabel}
        estimateStatus={estimateStatusLabel}
        proposalStatus={proposalStatusLabel}
        draftVersion={draftVersionLabel}
        lastRecalculatedAt={lastRecalculatedAt}
        unsavedChanges={unsavedChanges}
      />

      {newOpportunityDialogOpen ? (
        <section className="commercial-command-dialog" aria-label="New opportunity command">
          <div className="dal-panel-title-row">
            <h3>New Opportunity</h3>
            <span className="dal-badge warning">Choose route source</span>
          </div>
          <div className="teralinx-summary-grid">
            <div><span>Customer</span><b>{selectedAccount.name}</b></div>
            <div><span>Product</span><b>{selectedProductOption.productName}</b></div>
          </div>
          <div className="dal-status">Route Source</div>
          <div className="commercial-command-grid">
            <button type="button" onClick={handleBeginAzOpportunity}>Create / Draw Route</button>
            <label className="dal-button secondary commercial-file-action">
              Import Route File
              <input
                type="file"
                accept=".kmz,.kml,.geojson,.json,.csv"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0] ?? null;
                  event.currentTarget.value = "";
                  void handleRouteImportFile(file);
                }}
              />
            </label>
            <label>
              <span>Existing Route</span>
              <select defaultValue="" onChange={(event) => handleSelectExistingGovernedRoute(event.currentTarget.value)}>
                <option value="">Select governed route...</option>
                {commercialRouteRepositoryRecords.map((route) => <option key={route.routeRepositoryId} value={route.routeRepositoryId}>{route.routeName} · {formatRouteMiles(route.routeMiles)} mi</option>)}
              </select>
            </label>
          </div>
          <div className="dal-actions">
            <button type="button" className="secondary" onClick={closeNewOpportunityDialog}>Close</button>
            <span className="dal-status">A/Z may be entered before Create Route or derived after selecting one imported centerline. Every source converges on the Commercial Route Repository.</span>
          </div>
        </section>
      ) : null}

      <details
        className="commercial-proposal-preview-shell"
        open={proposalPreviewOpen}
        onToggle={(event) => setProposalPreviewOpen(event.currentTarget.open)}
        aria-label="Proposal Preview"
      >
        <summary>
          <b>Proposal Preview</b>
          <span>{activeCommercialOpportunity?.proposalPreviewId ?? "Proposal Preview not generated"}</span>
        </summary>
        <div className="commercial-proposal-preview-page">
          <div className="commercial-proposal-preview-title">
            <span>{selectedAccount.name}</span>
            <h3>{activeOpportunityDisplayName}</h3>
            <b>{selectedProductOption.productName}</b>
          </div>
          <div className="commercial-proposal-preview-map">
            <span>Map Snapshot Placeholder</span>
            <b>{activeRouteLengthLabel} mi route</b>
          </div>
          <div className="teralinx-summary-grid" aria-label="Customer proposal commercial summary">
            <div><span>Product</span><b>{selectedProductOption.productName}</b></div>
            <div><span>Route</span><b>{activeRouteLengthLabel} mi</b></div>
            <div><span>Duct Package</span><b>{displayedTransparentEstimateControls.projectConfiguration.ductCount} x {displayedTransparentEstimateControls.projectConfiguration.ductDiameter}&quot;</b></div>
            <div><span>Fiber</span><b>{displayedTransparentEstimateControls.projectConfiguration.fiberCount.toLocaleString()} count</b></div>
            <div><span>Construction Mix</span><b>{activeConstructionMixLabel}</b></div>
            <div><span>NRC</span><b>{money(displayedTransparentEstimate?.nrc ?? selectedPricingSummary.reconciliation.sellPriceIru)}</b></div>
            <div><span>O&amp;M / Month</span><b>{money(displayedTransparentEstimate?.mrc ?? selectedPricingSummary.reconciliation.mrcRevenue)}</b></div>
            <div><span>Term</span><b>{selectedProductOption.defaultTermYears * 12} months</b></div>
            <div><span>Total Contract Value</span><b>{money(displayedTransparentEstimate ? displayedTransparentEstimate.nrc + displayedTransparentEstimate.mrc * selectedProductOption.defaultTermYears * 12 : selectedPricingSummary.reconciliation.lifecycleRevenue)}</b></div>
          </div>
          {proposalPreviewRows.length ? (
            <div className="teralinx-summary-grid">
              {proposalPreviewRows.map(([label, value]) => (
                <div key={`proposal-preview-${label}`}>
                  <span>{label}</span>
                  <b>{value}</b>
                </div>
              ))}
            </div>
          ) : (
            <div className="dal-status">
              Proposal Preview not generated.
              <button type="button" onClick={handleSaveCommercialOpportunity} disabled={routePersistencePending || Boolean(activeCommercialOpportunity && !canModifyActiveOpportunity)}>
                Generate Preview
              </button>
            </div>
          )}
          <div className="dal-status">
            Proposal is a commercial projection of the Certified Draft IOF Package path. It does not create ScopeVersion or execution authority.
          </div>
        </div>
      </details>

      <section className="commercial-workbook-shell" aria-label="Commercial Workbook">
        <div className="commercial-area-heading">
          <h3>Commercial Workbook</h3>
          <span>Detailed commercial review, doctrine assumptions, human overrides, validation, and Service Order readiness.</span>
        </div>

        <details
          id="civil-mix-calibration"
          className="commercial-workbook-section"
          open={isCommercialWorkbookSectionOpen("proposal-summary")}
          onToggle={(event) => handleCommercialWorkbookSectionToggle("proposal-summary", event.currentTarget.open)}
        >
          <summary><b>1. Proposal Summary</b><span>{activeProposalRuntime?.proposalNumber ?? proposalStatusLabel}</span></summary>
          {isCommercialWorkbookSectionOpen("proposal-summary") ? (
            <section className="dal-panel proposal-runtime-dashboard">
              <div className="dal-panel-title-row">
                <div>
                  <h3>{isCustomerParticipant ? "Customer Proposal Dashboard" : "Commercial Proposal Dashboard"}</h3>
                  <span>{activeProposalRuntime?.proposalNumber ?? proposalRuntimeNotice}</span>
                </div>
                <span className={`dal-badge ${activeProposalRuntime?.readiness?.canCreateDraftIofPackage ? "pass" : activeProposalRuntime ? "warning" : "fail"}`}>
                  {proposalRuntimeStatusLabel(activeProposalRuntime?.status)}
                </span>
              </div>
              <div className="teralinx-summary-grid">
                <div><span>Workspace</span><b>{session?.user.workspaceId ?? "Unauthenticated"}</b></div>
                <div><span>Owner</span><b>{activeProposalRuntime?.commercialOwner ?? activeProposalRuntime?.owner ?? currentUserName}</b></div>
                <div><span>Proposal Revision</span><b>{activeProposalRuntime ? `R${activeProposalRuntime.revisionNumber ?? activeProposalRuntime.version} ${activeProposalRuntime.revisionStatus ?? "LEGACY"}` : "Not created"}</b></div>
                <div><span>Revision Hash</span><b>{activeProposalRuntime?.proposalHash ? activeProposalRuntime.proposalHash.slice(0, 12) : "Save required"}</b></div>
                <div><span>Visibility</span><b>{activeProposalRuntime?.visibility ?? "Private default"}</b></div>
                <div><span>Approval</span><b>{activeProposalRuntime?.approvalState?.replaceAll("_", " ") ?? "Not submitted"}</b></div>
                <div><span>Internal Commercial Review</span><b>{exactInternalCommercialApproval ? "APPROVED" : "PENDING"}</b></div>
                <div><span>Readiness</span><b>{activeProposalRuntime?.readiness?.status ?? "Blocked"}</b></div>
                <div><span>References</span><b>{activeProposalRuntime?.runtimeObjectIds?.length.toLocaleString() ?? "0"}</b></div>
                <div><span>Evidence</span><b>{activeProposalRuntime?.runtimeEvidenceIds?.length.toLocaleString() ?? "0"}</b></div>
                <div><span>Comments</span><b>{activeProposalRuntime?.comments?.length.toLocaleString() ?? "0"}</b></div>
                <div><span>Next Action</span><b>{activeProposalRuntime?.nextLifecycleAction?.replaceAll("_", " ") ?? "Save proposal"}</b></div>
                <div><span>Repository</span><b>{commercialAuthorityDiagnostics.repository}</b></div>
                <div><span>Commercial Revision</span><b>{commercialAuthorityDiagnostics.commercialRevisionId || "Not created"}</b></div>
                <div><span>Release Package</span><b>{commercialAuthorityDiagnostics.commercialReleasePackageId || "Not released"}</b></div>
                <div><span>Release Hash</span><b>{commercialAuthorityDiagnostics.releaseHash ? commercialAuthorityDiagnostics.releaseHash.slice(0, 12) : "Not released"}</b></div>
                <div><span>Current Authority</span><b>{commercialAuthorityDiagnostics.currentAuthority.replaceAll("_", " ")}</b></div>
                <div><span>Engineering Package</span><b>{submittedEngineeringPackageId || "Not submitted"}</b></div>
                <div><span>Engineering Status</span><b>{submittedEngineeringStatus.replaceAll("_", " ")}</b></div>
              </div>
              {commercialDeveloperMode ? <div className="dal-status">Commercial Revision Repository · Commercial Release Package Repository</div> : null}
              <div className="dal-list compact">
                {commercialDashboardHandoffChecks.map((check) => (
                  <div className="dal-list-row teralinx-list-row" key={`dashboard-handoff-${check.key}`}>
                    <b>{check.label}</b>
                    <span className={`dal-badge ${check.ok ? "pass" : "warning"}`}>{check.ok ? "Valid" : "Required"}</span>
                    <small>{check.detail}</small>
                  </div>
                ))}
              </div>
              {proposalOpportunityStale ? <div className={`dal-status ${opportunityMateriality?.decision === "NON_MATERIAL" ? "pass" : "warning"}`}>
                <b>Proposal R{activeProposalRuntime?.revisionNumber ?? activeProposalRuntime?.version} · {opportunityMateriality?.decision === "NON_MATERIAL" ? "CURRENT OFFER" : "STALE — REVIEW REQUIRED"}</b><br />
                Proposal bound to Opportunity v{proposalBoundOpportunityVersion}; current Opportunity v{currentOpportunityVersion}.<br />
                {opportunityMateriality?.decision === "NON_MATERIAL"
                  ? "No customer-facing commercial changes were found. The complete Opportunity versions and hashes remain auditable."
                  : opportunityMateriality?.materialChanges?.length
                    ? `Material changes: ${opportunityMateriality.materialChanges.map((item) => item.field).join(", ")}.`
                    : opportunityMateriality?.unknownChanges?.length
                      ? `Review required: ${opportunityMateriality.unknownChanges.map((item) => item.field).join(", ")}.`
                      : "Internal Commercial Review will evaluate the exact Opportunity change before customer submission."}
              </div> : null}
              <div className="dal-actions">
                {canManageProposalRuntime ? (
                  <>
                    <button type="button" onClick={handleSaveRuntimeProposal} disabled={proposalRuntimeActionPending}>Save Proposal Revision</button>
                    <button type="button" onClick={handleInternalCommercialApproval} disabled={!activeProposalRuntime?.proposalRevisionId || activeProposalRuntime.revisionStatus !== "SAVED" || exactInternalCommercialApproval || proposalRuntimeActionPending}>Approve Internal Commercial Review</button>
                    <button type="button" onClick={handleSubmitRuntimeProposalToCustomer} disabled={!exactInternalCommercialApproval || proposalRuntimeActionPending}>Submit to Customer</button>
                    <button type="button" onClick={handleCreateRuntimeProposalRevision} disabled={!activeProposalRuntime?.proposalRevisionId || proposalRuntimeActionPending}>Create New Revision</button>
                    <button type="button" onClick={handleDuplicateRuntimeProposal} disabled={!activeProposalRuntime || proposalRuntimeActionPending}>Duplicate</button>
                    <button type="button" onClick={handleArchiveRuntimeProposal} disabled={!activeProposalRuntime || proposalRuntimeActionPending}>Archive</button>
                    <button type="button" onClick={handleExposeDraftIofSource} disabled={!activeProposalRuntime?.readiness?.canCreateDraftIofPackage || proposalRuntimeActionPending}>Create Draft IOF Source</button>
                  </>
                ) : null}
                {canReviewProposalRuntime ? (
                  <span className="dal-status">Customer comments, change requests, and acceptance are recorded only in Customer View.</span>
                ) : null}
                {commercialDeveloperMode ? (
                  <button type="button" className="secondary" onClick={() => void refreshProposalRuntimeLibrary("Proposal Library refreshed.")} disabled={proposalRuntimeActionPending}>Refresh Proposals</button>
                ) : null}
              </div>
              {activeProposalRuntime?.readiness?.blockingIssues?.length ? (
                <div className="dal-status">{activeProposalRuntime.readiness.blockingIssues.join(" ")}</div>
              ) : (
                <div className="dal-status">{proposalRuntimeNotice}</div>
              )}
              {customerEnrollmentLinks.length ? <div className="dal-panel">
                <strong>Single-use customer enrollment links</strong>
                <small>Copy these now. Only token hashes are stored and the links are not shown again after this page is left.</small>
                {customerEnrollmentLinks.map((invitation) => {
                  const enrollmentUrl = `${window.location.origin}${invitation.enrollmentPath}`;
                  return <div className="dal-list-row" key={invitation.principalId}><b>{invitation.principalId}</b><code>{enrollmentUrl}</code><small>Expires {new Date(invitation.expiresAt).toLocaleString()}</small><button type="button" onClick={() => void navigator.clipboard.writeText(enrollmentUrl)}>Copy link</button></div>;
                })}
              </div> : null}
              <details>
                <summary>Visible Commercial Proposals - {accountProposalRuntimeRecords.length.toLocaleString()}</summary>
                <div className="dal-list">
                  {accountProposalRuntimeRecords.length ? accountProposalRuntimeRecords.map((proposal) => (
                    <div className="dal-list-row teralinx-list-row" key={proposal.proposalId}>
                      <b>{proposal.proposalNumber}</b>
                      <span>{proposalRuntimeStatusLabel(proposal.status)}</span>
                      <small>
                        {proposal.title}. Owner {proposal.owner ?? proposal.commercialOwner}. Version {proposal.version}. Updated {proposal.updatedAt ? new Date(proposal.updatedAt).toLocaleString() : "n/a"}.
                      </small>
                    </div>
                  )) : <div className="dal-status">No Commercial Proposals are visible for this account workspace.</div>}
                </div>
              </details>
              <details>
                <summary>Saved Proposal Revisions - {activeProposalRuntime?.proposalRevisions?.length.toLocaleString() ?? "0"}</summary>
                <div className="dal-list">
                  {activeProposalRuntime?.proposalRevisions?.length ? [...activeProposalRuntime.proposalRevisions].reverse().map((revision) => {
                    const revisionApproval = activeProposalRuntime.approvals?.find((approval) =>
                      approval.proposalRevisionId === revision.proposalRevisionId && approval.proposalHash === revision.proposalHash && approval.decision === "APPROVED"
                    );
                    const pricing = revision.snapshot.pricingSummary as Record<string, unknown> | undefined;
                    return (
                      <div className="dal-list-row teralinx-list-row" key={revision.proposalRevisionId}>
                        <b>Revision {revision.revisionNumber} · {revisionApproval ? "CUSTOMER APPROVED" : revision.revisionStatus}</b>
                        <span>{revision.revisionReason}</span>
                        <small>
                          Hash {revision.proposalHash.slice(0, 12)} · NRC {typeof pricing?.sellPriceIru === "number" ? money(pricing.sellPriceIru) : "captured"} · Saved {new Date(revision.createdAt).toLocaleString()} · Parent {revision.parentProposalRevisionId || "Original"}
                        </small>
                      </div>
                    );
                  }) : <div className="dal-status">No immutable Proposal Revision has been saved yet.</div>}
                </div>
                {proposalRevisionComparison.length ? (
                  <div className="commercial-workbook-table-wrap">
                    <table className="dal-table">
                      <thead><tr><th>Latest Revision Change</th><th>Class</th><th>Before</th><th>After</th></tr></thead>
                      <tbody>{proposalRevisionComparison.slice(0, 50).map((difference) => (
                        <tr key={`proposal-difference-${difference.path}`}>
                          <td>{difference.path}</td><td>{difference.changeClass.replaceAll("_", " ")}</td>
                          <td>{typeof difference.before === "object" ? JSON.stringify(difference.before) : String(difference.before ?? "UNSET")}</td>
                          <td>{typeof difference.after === "object" ? JSON.stringify(difference.after) : String(difference.after ?? "UNSET")}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                ) : null}
              </details>
            </section>
          ) : null}
        </details>

        <details
          className="commercial-workbook-section"
          open={isCommercialWorkbookSectionOpen("estimate-detail")}
          onToggle={(event) => handleCommercialWorkbookSectionToggle("estimate-detail", event.currentTarget.open)}
        >
          <summary><b>2. Estimate Detail</b><span>{estimateStatusLabel}</span></summary>
          {isCommercialWorkbookSectionOpen("estimate-detail") && activeFinancialDraft && displayedTransparentEstimate ? (
            <section className="commercial-estimate-authoring-section" aria-label="Commercial estimate authoring">
              <div className="dal-panel-title-row">
                <div>
                  <h3>Estimate Detail</h3>
                  <span>{selectedImportedCustomerRoute ? `${selectedImportedCustomerRoute.name} uses the imported-route pricing authority.` : "Civil mix, production, financial model, authority controls, audit, and calibration."}</span>
                </div>
                <span className="dal-badge warning">{estimateStatusLabel}</span>
              </div>
              <TransparentEstimateExplorer
                estimate={displayedTransparentEstimate}
                controls={displayedTransparentEstimateControls}
                lastRecalculatedAt={lastRecalculatedAt}
                vendorPreview={activeFinancialDraft.vendorResponsePreview}
                onTargetDurationChange={updateTransparentEstimateDuration}
                onProductionChange={updateTransparentProduction}
                onFinancialChange={updateTransparentFinancial}
                onConstraintChange={updateTransparentConstraint}
                onCivilMixModeChange={updateTransparentCivilMixMode}
                onIlaPlanningChange={updateTransparentIlaPlanning}
                onProjectConfigurationChange={updateTransparentProjectConfiguration}
              />
            </section>
          ) : <div className="dal-status">Open this section to mount the full commercial estimate explorer.</div>}
        </details>

        <details className="commercial-workbook-section" onToggle={(event) => handleCommercialWorkbookSectionToggle("commercial-economics", event.currentTarget.open)}>
          <summary><b>3. Commercial Economics</b><span>{activeFinancialAuthority ? money(activeFinancialAuthority.lifecycleRevenue) : "Pending"}</span></summary>
          {isCommercialWorkbookSectionOpen("commercial-economics") ? (
            activeFinancialDraft && activeFinancialAuthority ? (
              <div className="commercial-financial-authority-summary">
                <div className="commercial-financial-groups">
                  <div>
                    <b>Construction Economics</b>
                    <span>Construction Cost: {money(activeFinancialAuthority.constructionCost)}</span>
                    <span>Cost/Mile: {money(activeFinancialAuthority.costPerMile)}</span>
                    <span>Cost/Foot: ${activeFinancialAuthority.costPerFoot.toLocaleString()}</span>
                    <span>Unknowns: {activeFinancialDraft.unknownQuantities.length.toLocaleString()}</span>
                  </div>
                  <div>
                    <b>Commercial Revenue</b>
                    <span>Sell Price: {money(activeFinancialAuthority.sellPrice)}</span>
                    <span>NRC Revenue: {money(activeFinancialAuthority.nrcRevenue)}</span>
                    <span>MRC Revenue: {money(activeFinancialAuthority.mrcRevenue)}</span>
                    <span>Revenue/Mile: {money(activeFinancialAuthority.revenuePerMile)}</span>
                  </div>
                  <div>
                    <b>Lifecycle Value</b>
                    <span>Gross Margin: {money(activeFinancialAuthority.grossMarginDollars)}</span>
                    <span>Margin %: {percentage(activeFinancialAuthority.grossMarginPercent)}</span>
                    <span>Margin/Mile: {money(activeFinancialAuthority.marginPerMile)}</span>
                    <span>Lifecycle Revenue: {money(activeFinancialAuthority.lifecycleRevenue)}</span>
                  </div>
                </div>
              </div>
            ) : <div className="dal-status">Commercial economics are waiting for a priced commercial route.</div>
          ) : null}
        </details>

        <details
          className="commercial-workbook-section"
          open={isCommercialWorkbookSectionOpen("construction-mix")}
          onToggle={(event) => handleCommercialWorkbookSectionToggle("construction-mix", event.currentTarget.open)}
        >
          <summary><b>4. Civil Mix Calibration</b><span>{activeConstructionMixLabel}</span></summary>
          {isCommercialWorkbookSectionOpen("construction-mix") ? (
            <div className="civil-mix-calibration-panel">
              <div className="civil-mix-calibration-heading">
                <div>
                  <b>Calibrate Civil Mix</b>
                  <span>Enter whole percentages. Plow automatically absorbs the balance so the mix always totals 100%.</span>
                </div>
                <div className="civil-mix-calibration-total">
                  <span>Total</span>
                  <b>100%</b>
                </div>
              </div>
              <div className="civil-mix-calibration-grid">
                {([
                  ["plowPercent", "Plow", selectedCivilMixCalibration.plowPercent],
                  ["dirtPercent", "Dirt", selectedCivilMixCalibration.dirtPercent],
                  ["rockPercent", "Rock", selectedCivilMixCalibration.rockPercent],
                  ["trenchPercent", "Trench", selectedCivilMixCalibration.trenchPercent],
                ] as const).map(([key, label, value]) => (
                  <label key={key}>
                    <span>{label}</span>
                    <div>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        inputMode="numeric"
                        aria-label={`${label} civil mix percent`}
                        value={value}
                        onChange={(event) => updateCivilMixCalibration(key, Number(event.currentTarget.value))}
                      />
                      <b>%</b>
                    </div>
                  </label>
                ))}
              </div>
              <div className="civil-mix-calibration-footer">
                <span>Standard: 82% plow · 12% dirt · 0% rock · 6% trench</span>
                <button type="button" onClick={resetCivilMixCalibration}>Reset to Standard</button>
              </div>
              <div className="teralinx-summary-grid">
                <div><span>Underground Product</span><b>Point-to-Point Duct and Dark Fiber</b></div>
                <div><span>ILA Method</span><b>{displayedTransparentEstimateControls.ilaPlanning.placementMethod.replaceAll("_", " ")}</b></div>
                <div><span>Commercial Source</span><b>{selectedAssumptionState.source.replaceAll("_", " ")}</b></div>
              </div>
            </div>
          ) : null}
        </details>

        <details className="commercial-workbook-section" onToggle={(event) => handleCommercialWorkbookSectionToggle("doctrine-assumptions", event.currentTarget.open)}>
          <summary><b>5. Product Doctrine Assumptions</b><span>{selectedAssumptionState.stateId}</span></summary>
          {isCommercialWorkbookSectionOpen("doctrine-assumptions") ? (
            <div className="commercial-workbook-table-wrap">
              <table className="dal-table">
                <thead>
                  <tr>
                    <th>Assumption ID</th>
                    <th>Doctrine Value</th>
                    <th>Current Commercial Value</th>
                    <th>Source</th>
                    <th>Confidence</th>
                    <th>Override Status</th>
                    <th>Override Reason</th>
                    <th>Owner</th>
                    <th>Timestamp</th>
                    <th>Engineering Actual</th>
                  </tr>
                </thead>
                <tbody>
                  {commercialDoctrineOverrideRows.map((row) => (
                    <tr key={row.assumptionId}>
                      <td>{row.assumptionId}</td>
                      <td>{row.doctrineValue}</td>
                      <td>{row.commercialValue}</td>
                      <td>{row.source}</td>
                      <td>{row.confidence}</td>
                      <td>{row.overrideStatus}</td>
                      <td>{row.overrideReason}</td>
                      <td>{row.owner}</td>
                      <td>{row.timestamp === "Not recorded" ? row.timestamp : new Date(row.timestamp).toLocaleString()}</td>
                      <td>Not available in Commercial Planning</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </details>

        <details className="commercial-workbook-section" onToggle={(event) => handleCommercialWorkbookSectionToggle("human-overrides", event.currentTarget.open)}>
          <summary><b>6. Human Overrides</b><span>{commercialDoctrineOverrideRows.filter((row) => row.source === "HUMAN_OVERRIDE").length.toLocaleString()} recorded</span></summary>
          {isCommercialWorkbookSectionOpen("human-overrides") ? (
            <>
              <div className="dal-actions">
                <button type="button" onClick={() => handleCommercialWorkbookSectionToggle("estimate-detail", true)}>Open Estimate Detail</button>
                <span className="dal-status">Use Estimate Detail to enter a human value, reason, source, confidence, save override, or reset to doctrine.</span>
              </div>
              <div className="commercial-workbook-table-wrap">
                <table className="dal-table">
                  <thead>
                    <tr>
                      <th>Assumption ID</th>
                      <th>Doctrine Value</th>
                      <th>Override Value</th>
                      <th>Reason</th>
                      <th>Owner</th>
                      <th>Timestamp</th>
                      <th>Source</th>
                      <th>Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {commercialDoctrineOverrideRows.filter((row) => row.source === "HUMAN_OVERRIDE").map((row) => (
                      <tr key={`override-${row.assumptionId}`}>
                        <td>{row.assumptionId}</td>
                        <td>{row.doctrineValue}</td>
                        <td>{row.commercialValue}</td>
                        <td>{row.overrideReason}</td>
                        <td>{row.owner}</td>
                        <td>{row.timestamp === "Not recorded" ? row.timestamp : new Date(row.timestamp).toLocaleString()}</td>
                        <td>{row.source}</td>
                        <td>{row.confidence}</td>
                      </tr>
                    ))}
                    {commercialDoctrineOverrideRows.every((row) => row.source !== "HUMAN_OVERRIDE") ? (
                      <tr><td colSpan={8}>No commercial overrides recorded. Doctrine values are accepted.</td></tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </details>

        <details className="commercial-workbook-section" onToggle={(event) => handleCommercialWorkbookSectionToggle("quantities", event.currentTarget.open)}>
          <summary><b>7. Quantities</b><span>{activeFinancialDraft ? `${Math.round(activeFinancialDraft.routeFeet).toLocaleString()} ft` : "Pending"}</span></summary>
          {isCommercialWorkbookSectionOpen("quantities") ? (
            <div className="teralinx-summary-grid">
              <div><span>Route Miles</span><b>{activeRouteLengthLabel}</b></div>
              <div><span>Route Feet</span><b>{Math.round(activeFinancialDraft?.routeFeet ?? selectedPricingSummary.reconciliation.routeFeet).toLocaleString()}</b></div>
              <div><span>Segments</span><b>{activeFinancialDraft?.routeSegments.length.toLocaleString() ?? "0"}</b></div>
              <div><span>ILA Sites</span><b>{activeFinancialDraft?.transparentEstimate.ilaPlan.stationObjects.length.toLocaleString() ?? "0"}</b></div>
              <div><span>Labor Lines</span><b>{activeFinancialDraft?.transparentEstimate.laborLineItems.length.toLocaleString() ?? "0"}</b></div>
              <div><span>Material Lines</span><b>{activeFinancialDraft?.transparentEstimate.materialLineItems.length.toLocaleString() ?? "0"}</b></div>
              <div><span>Unknown Quantities</span><b>{activeFinancialDraft?.unknownQuantities.length.toLocaleString() ?? "0"}</b></div>
              <div><span>Draft IOF Objects</span><b>{displayedDraftIofPackage?.objects?.length.toLocaleString() ?? "0"}</b></div>
            </div>
          ) : null}
        </details>

        <details className="commercial-workbook-section" onToggle={(event) => handleCommercialWorkbookSectionToggle("object-manifest", event.currentTarget.open)}>
          <summary><b>8. Object Manifest Summary</b><span>{displayedDraftIofPackage?.manifest?.manifestId ?? "No manifest"}</span></summary>
          {isCommercialWorkbookSectionOpen("object-manifest") ? (
            <div className="teralinx-summary-grid">
              {[
                ["Objects", "objects"],
                ["Relationships", "relationships"],
                ["Inventory", "inventory"],
                ["Geometry", "geometry"],
                ["Stations", "stations"],
                ["Structures", "structures"],
                ["Evidence", "evidence"],
                ["Customer Requests", "customerRequests"],
              ].map(([label, key]) => (
                <div key={`manifest-summary-${key}`}><span>{label}</span><b>{manifestCount(displayedDraftIofPackage, key).toLocaleString()}</b></div>
              ))}
            </div>
          ) : null}
        </details>

        <details className="commercial-workbook-section" onToggle={(event) => handleCommercialWorkbookSectionToggle("production-forecast", event.currentTarget.open)}>
          <summary><b>9. Production Forecast</b><span>{activeFinancialDraft ? `${activeFinancialDraft.transparentEstimate.laborLineItems.length} labor rows` : "Pending"}</span></summary>
          {isCommercialWorkbookSectionOpen("production-forecast") ? (
            <div className="teralinx-summary-grid">
              <div><span>Target Duration</span><b>{transparentEstimateControls.targetDurationDays.toLocaleString()} days</b></div>
              <div><span>Plow Production</span><b>{transparentEstimateControls.production.plowFeetPerDay?.toLocaleString() ?? "n/a"} ft/day</b></div>
              <div><span>Dirt Bore Production</span><b>{transparentEstimateControls.production.directionalBoreDirtFeetPerDay?.toLocaleString() ?? "n/a"} ft/day</b></div>
              <div><span>Rock Bore Production</span><b>{transparentEstimateControls.production.directionalBoreRockFeetPerDay?.toLocaleString() ?? "n/a"} ft/day</b></div>
              <div><span>Fiber Blowing</span><b>{transparentEstimateControls.production.fiberBlowingFeetPerDay?.toLocaleString() ?? "n/a"} ft/day</b></div>
              <div><span>Splicing</span><b>{transparentEstimateControls.production.splicingTerminationsPerDay?.toLocaleString() ?? "n/a"} terms/day</b></div>
              <div><span>Forecast Cost</span><b>{activeFinancialDraft ? money(activeFinancialDraft.transparentEstimate.totalKnownCost) : "Pending"}</b></div>
              <div><span>Commercial Readiness</span><b>{commercialReadinessLabel}</b></div>
            </div>
          ) : null}
        </details>

        <section className="dal-panel" aria-label="Customer deliverables">
          <div className="dal-panel-title-row"><div><h3>Customer Deliverables</h3><span>Generated from the exact saved Proposal Revision and governed route.</span></div><span className="dal-badge pass">GOVERNED EXPORT</span></div>
          <div className="dal-actions">
            <button type="button" disabled={!activeProposalRuntime?.proposalId} onClick={() => void downloadRuntimeArtifact(`/api/exports/proposals/${encodeURIComponent(String(activeProposalRuntime?.proposalId))}/pdf`, session).then((artifact) => setProposalRuntimeNotice(`Downloaded ${artifact.filename}.`)).catch((error) => setProposalRuntimeNotice(`Proposal PDF failed: ${error.message}`))}>Download Proposal PDF</button>
            <button type="button" disabled={!activeProposalRuntime?.proposalId} onClick={() => void downloadRuntimeArtifact(`/api/exports/proposals/${encodeURIComponent(String(activeProposalRuntime?.proposalId))}/route.kmz`, session).then((artifact) => setProposalRuntimeNotice(`Downloaded ${artifact.filename}.`)).catch((error) => setProposalRuntimeNotice(`Route KMZ failed: ${error.message}`))}>Download Route KMZ</button>
          </div>
        </section>

        <details className="commercial-workbook-section" onToggle={(event) => handleCommercialWorkbookSectionToggle("commercial-validation", event.currentTarget.open)}>
          <summary><b>10. Commercial Validation</b><span>{constitutionalAssemblyReview.draftIofGateBlocked ? "Blocked" : "Ready"}</span></summary>
          {isCommercialWorkbookSectionOpen("commercial-validation") ? (
            <CommercialReviewPanel
              draftPackage={displayedDraftIofPackage}
              customerName={selectedAccount.name}
              proposalLabel={String(activeProposalRuntime?.proposalNumber ?? activeProposalRuntime?.proposalId ?? "No proposal")}
              productLabel={String(selectedProductOption.productName ?? selectedProductOption.productId)}
              doctrineLabel={`${String(displayedDraftIofPackage?.doctrineId ?? selectedProductDoctrine?.doctrineId ?? "PD-001")} ${String(displayedDraftIofPackage?.productDoctrineVersion ?? selectedProductDoctrine?.doctrineVersion ?? "").trim()}`}
              pending={engineeringCertificationPending}
              canEdit={canManageProposalRuntime}
              notice={proposalRuntimeNotice}
              draftIofApprovalDisabled={constitutionalAssemblyReview.draftIofGateBlocked}
              draftIofApprovalReason={constitutionalAssemblyReview.draftIofGateReason}
              engineeringPackageId={submittedEngineeringPackageId}
              engineeringStatus={submittedEngineeringStatus}
              onSaveDraft={handleSaveCommercialDraftIofPackage}
              onValidate={handleValidateCommercialReviewPackage}
            />
          ) : null}
        </details>

        <details className="commercial-workbook-section" onToggle={(event) => handleCommercialWorkbookSectionToggle("risks-unknowns", event.currentTarget.open)}>
          <summary><b>11. Risks / Unknowns</b><span>{commercialEstimateRisks.length.toLocaleString()} risk signal(s)</span></summary>
          {isCommercialWorkbookSectionOpen("risks-unknowns") ? (
            <div className="dal-list">
              {commercialEstimateRisks.map((risk, index) => (
                <div className="dal-list-row teralinx-list-row" key={`commercial-risk-${index}`}>
                  <b>Risk</b>
                  <span>{risk}</span>
                  <small>Commercial estimate review</small>
                </div>
              ))}
              {(activeFinancialDraft?.unknownQuantities ?? []).map((item, index) => (
                <div className="dal-list-row teralinx-list-row" key={`unknown-quantity-${index}`}>
                  <b>{item.label}</b>
                  <span>{money(item.costImpact)}</span>
                  <small>{(item as { reason?: string; source?: string; note?: string }).reason ?? (item as { reason?: string; source?: string; note?: string }).source ?? (item as { reason?: string; source?: string; note?: string }).note ?? "Commercial unknown quantity"}</small>
                </div>
              ))}
            </div>
          ) : null}
        </details>

        {commercialDeveloperMode ? (
          <details className="commercial-workbook-section" onToggle={(event) => handleCommercialWorkbookSectionToggle("draft-iof-preview", event.currentTarget.open)}>
            <summary><b>12. Draft IOF Package Preview</b><span>{displayedDraftIofPackage?.packageId ?? "Pending"}</span></summary>
            {isCommercialWorkbookSectionOpen("draft-iof-preview") ? (
              <div className="commercial-workbook-json-preview">
                <div className="teralinx-summary-grid">
                  <div><span>Package</span><b>{displayedDraftIofPackage?.packageId ?? "Not assembled"}</b></div>
                  <div><span>Status</span><b>{displayedDraftIofPackage?.status ?? "Pending"}</b></div>
                  <div><span>Certified</span><b>{displayedDraftIofPackage?.status === "CERTIFIED" ? "Yes" : "No"}</b></div>
                  <div><span>ScopeVersion</span><b>Not created in Commercial Planning</b></div>
                </div>
                <pre>{displayedDraftIofPackage ? JSON.stringify(displayedDraftIofPackage, null, 2) : "No Draft IOF Package preview is available yet."}</pre>
              </div>
            ) : null}
          </details>
        ) : null}

        <details className="commercial-workbook-section" onToggle={(event) => handleCommercialWorkbookSectionToggle("service-order-preview", event.currentTarget.open)}>
          <summary><b>13. Service Order Preview</b><span>{activeCommercialOpportunity?.serviceOrderPreviewId ?? "Service Order Preview not generated"}</span></summary>
          {isCommercialWorkbookSectionOpen("service-order-preview") ? (
            <div className="commercial-workbook-table-wrap">
              {serviceOrderReadinessRows.length ? (
                <table className="dal-table">
                  <thead>
                    <tr><th>Service Order Readiness Item</th><th>Status / Reference</th></tr>
                  </thead>
                  <tbody>
                    {serviceOrderReadinessRows.map(([label, value]) => (
                      <tr key={`service-order-readiness-${label}`}>
                        <td>{label}</td>
                        <td>{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="dal-status">
                  Service Order Preview not generated.
                  <button type="button" onClick={handleSaveCommercialOpportunity} disabled={routePersistencePending || Boolean(activeCommercialOpportunity && !canModifyActiveOpportunity)}>
                    Generate Preview
                  </button>
                </div>
              )}
              <div className="dal-status">Legal terms, payment terms, insurance, warranty, signature blocks, and final legal language remain Commercial Release 2 placeholders. No ScopeVersion is created here.</div>
            </div>
          ) : null}
        </details>

        {commercialDeveloperMode ? (
          <details className="commercial-workbook-section commercial-runtime-diagnostics" onToggle={(event) => handleCommercialWorkbookSectionToggle("runtime-diagnostics", event.currentTarget.open)}>
          <summary><b>Advanced / Diagnostics</b><span>Collapsed by default · Developer Mode</span></summary>
          {isCommercialWorkbookSectionOpen("runtime-diagnostics") ? (
            <div className="dal-list">
              <div className="dal-list-row teralinx-list-row">
                <b>Current Session</b>
                <span>{runtimeRehydrationState?.workspaceSession?.sessionState ?? "Not loaded"}</span>
                <small>{runtimeRehydrationNotice}</small>
              </div>
              <div className="dal-list-row teralinx-list-row">
                <b>Customer Twin</b>
                <span>{accountCustomerTwin?.customerTwinId ?? customerInventoryLoadStatus}</span>
                <small>{customerInventoryDiagnostics.join(" ") || "No parser diagnostics."}</small>
              </div>
              <div className="dal-list-row teralinx-list-row">
                <b>Runtime Performance</b>
                <span>{runtimePerformance.cacheStatus} cache / {importWorkerStatus === "IDLE" ? runtimePerformance.workerStatus : importWorkerStatus}</span>
                <small>
                  Initial {runtimePerformance.initialRenderMs} ms / restore {runtimePerformance.workspaceRestoreMs} ms / import {runtimePerformance.inventoryImportMs} ms / routes {runtimePerformance.visibleRoutes.toLocaleString()} / objects {runtimePerformance.renderedObjects.toLocaleString()}
                </small>
              </div>
              <div className="dal-list-row teralinx-list-row">
                <b>Last Mutation</b>
                <span>{lastMutationTrace?.event ?? "No traced mutation"}</span>
                <small>
                  {lastMutationTrace
                    ? `${lastMutationTrace.durationMs} ms · invalidated ${lastMutationTrace.invalidated.length} · preserved ${lastMutationTrace.preserved.length} · structural IOF ${lastMutationTrace.operations.structuralIofAssemblies ? "MISS" : "CACHE HIT"} · geometry ${lastMutationTrace.operations.routeRebuilds ? "REBUILT" : "CACHE HIT"} · map ${lastMutationTrace.operations.mapRebuilds ? "INVOKED" : "NOT INVOKED"} · Engineering ${lastMutationTrace.operations.engineeringProjections ? "INVOKED" : "NOT INVOKED"}`
                    : "Civil mix, configuration, ILA, rate, and markup changes are traced without retaining payloads."}
                </small>
              </div>
              <div className="dal-list-row teralinx-list-row">
                <b>Corridor Execution Engine</b>
                <span>{corridorExecutionProgress?.label ?? "Waiting for route"}</span>
                <small>
                  {corridorExecutionSession
                    ? `${corridorExecutionSession.completedSegments.toLocaleString()} of ${corridorExecutionSession.totalSegments.toLocaleString()} segment(s) checkpointed / ${corridorExecutionSession.hotSegmentIds.length.toLocaleString()} hot / ${corridorExecutionSession.warmSegmentIds.length.toLocaleString()} warm / ${corridorExecutionSession.coldSegmentIds.length.toLocaleString()} cold`
                    : "Large corridors execute through segment checkpoints, aggregate projections, and viewport materialization."}
                </small>
              </div>
              <div className="dal-actions">
                <button type="button" className="secondary" onClick={() => setRuntimePerformancePanelOpen((open) => !open)}>
                  {runtimePerformancePanelOpen ? "Hide Runtime Performance" : "Show Runtime Performance"}
                </button>
              </div>
              {runtimePerformancePanelOpen ? (
                <div className="commercial-workbook-json-preview">
                  <div className="teralinx-summary-grid">
                    <div><span>Initial Render</span><b>{runtimePerformance.initialRenderMs} ms</b></div>
                    <div><span>Restore</span><b>{runtimePerformance.workspaceRestoreMs} ms</b></div>
                    <div><span>Inventory Import</span><b>{runtimePerformance.inventoryImportMs} ms</b></div>
                    <div><span>KMZ Parse</span><b>{runtimePerformance.kmzParseMs} ms</b></div>
                    <div><span>Normalization</span><b>{runtimePerformance.normalizationMs} ms</b></div>
                    <div><span>Geometry Build</span><b>{runtimePerformance.geometryBuildMs} ms</b></div>
                    <div><span>Workbook Recalc</span><b>{runtimePerformance.workbookRecalculationMs} ms</b></div>
                    <div><span>ILA Recalc</span><b>{runtimePerformance.ilaRecalculationMs} ms</b></div>
                    <div><span>Frame Timing</span><b>{runtimePerformance.frameTimingMs} ms</b></div>
                    <div><span>React Renders</span><b>{runtimePerformance.reactRenderCount.toLocaleString()}</b></div>
                    <div><span>Visible Routes</span><b>{runtimePerformance.visibleRoutes.toLocaleString()}</b></div>
                    <div><span>Visible Stations</span><b>{runtimePerformance.visibleStations.toLocaleString()}</b></div>
                    <div><span>Rendered Objects</span><b>{runtimePerformance.renderedObjects.toLocaleString()}</b></div>
                    <div><span>Viewport Objects</span><b>{runtimePerformance.viewportObjectCount.toLocaleString()}</b></div>
                    <div><span>Cache Entries</span><b>{inventoryPerformanceStats.projectionRecords.toLocaleString()}</b></div>
                    <div><span>Projection Cache</span><b>{projectionCacheStats.entries}/{projectionCacheStats.maximumEntries}</b></div>
                    <div><span>Projection Hits</span><b>{projectionCacheStats.hits.toLocaleString()}</b></div>
                    <div><span>Cache Evictions</span><b>{projectionCacheStats.evictions.toLocaleString()}</b></div>
                    <div><span>Cache Invalidations</span><b>{projectionCacheStats.invalidations.toLocaleString()}</b></div>
                    <div><span>Import Hashes</span><b>{inventoryPerformanceStats.dedupeRecords.toLocaleString()}</b></div>
                    <div><span>Corridor Partition</span><b>{corridorPerformanceMetrics?.corridorPartitionTimeMs ?? 0} ms</b></div>
                    <div><span>Worker Queue</span><b>{corridorPerformanceMetrics?.workerQueueDepth ?? 0}</b></div>
                    <div><span>Checkpoints</span><b>{corridorPerformanceMetrics?.checkpointCount.toLocaleString() ?? "0"}</b></div>
                    <div><span>Corridor Cache Hits</span><b>{corridorPerformanceMetrics?.cacheHits.toLocaleString() ?? "0"}</b></div>
                    <div><span>Corridor Cache Misses</span><b>{corridorPerformanceMetrics?.cacheMisses.toLocaleString() ?? "0"}</b></div>
                    <div><span>Visible Segments</span><b>{corridorPerformanceMetrics?.visibleSegmentCount.toLocaleString() ?? corridorViewportProjection?.visibleSegmentCount.toLocaleString() ?? "0"}</b></div>
                    <div><span>Rendered Stations</span><b>{corridorPerformanceMetrics?.renderedStationCount.toLocaleString() ?? "0"}</b></div>
                    <div><span>Rendered Objects</span><b>{corridorPerformanceMetrics?.renderedObjectCount.toLocaleString() ?? "0"}</b></div>
                    <div><span>Workbook Segment Calc</span><b>{corridorPerformanceMetrics?.workbookCalculationTimeMs ?? 0} ms</b></div>
                    <div><span>Proposal Aggregate Calc</span><b>{corridorPerformanceMetrics?.proposalGenerationTimeMs ?? 0} ms</b></div>
                    <div><span>Worker Utilization</span><b>{percentage(corridorPerformanceMetrics?.workerUtilization ?? 0)}</b></div>
                  </div>
                  {corridorAggregateProjection ? (
                    <div className="commercial-workbook-json-preview">
                      <div className="teralinx-summary-grid">
                        <div><span>Total Length</span><b>{formatRouteMiles(corridorAggregateProjection.totalLengthMiles)} mi</b></div>
                        <div><span>Estimated Cost</span><b>{money(corridorAggregateProjection.estimatedCost)}</b></div>
                        <div><span>Revenue</span><b>{money(corridorAggregateProjection.revenue)}</b></div>
                        <div><span>Margin</span><b>{percentage(corridorAggregateProjection.margin)}</b></div>
                        <div><span>Unknowns</span><b>{corridorAggregateProjection.unknownCount.toLocaleString()}</b></div>
                        <div><span>Confidence</span><b>{percentage(corridorAggregateProjection.confidence)}</b></div>
                        <div><span>ILA Count</span><b>{corridorAggregateProjection.ilaCount.toLocaleString()}</b></div>
                        <div><span>Bookends</span><b>{corridorAggregateProjection.bookendCount.toLocaleString()}</b></div>
                        <div><span>LOD</span><b>{corridorViewportProjection?.lod ?? "LOW"}</b></div>
                        <div><span>Materialized Tier</span><b>{corridorViewportProjection?.materializedTier ?? "COLD"}</b></div>
                      </div>
                    </div>
                  ) : null}
                  <pre>{JSON.stringify(recentRuntimePerformanceMetrics, null, 2)}</pre>
                </div>
              ) : null}
              <div className="dal-list-row teralinx-list-row">
                <b>Proposal Library</b>
                <span>{accountProposalRuntimeRecords.length.toLocaleString()} visible proposal(s)</span>
                <small>{proposalRuntimeNotice}</small>
              </div>
              <div className="dal-list-row teralinx-list-row">
                <b>Route Persistence Inspector</b>
                <span>{routePersistenceInspector?.routeRepositoryId ?? "No route transaction inspected"}</span>
                <small>{routePersistenceInspector?.geometryHash ?? "Generate, save, or open an Opportunity to inspect repository state."}</small>
              </div>
              {routePersistenceInspector ? (
                <div className="commercial-workbook-json-preview">
                  <div className="teralinx-summary-grid">
                    <div><span>Opportunity ID</span><b>{routePersistenceInspector.opportunityId}</b></div>
                    <div><span>Route Repository ID</span><b>{routePersistenceInspector.routeRepositoryId || "Missing"}</b></div>
                    <div><span>Route Geometry ID</span><b>{routePersistenceInspector.routeGeometryId}</b></div>
                    <div><span>Geometry Hash</span><b>{routePersistenceInspector.geometryHash}</b></div>
                    <div><span>Vertex Count</span><b>{routePersistenceInspector.vertexCount.toLocaleString()}</b></div>
                    <div><span>Length</span><b>{formatRouteMiles(routePersistenceInspector.lengthMiles)} mi</b></div>
                    <div><span>Estimate ID</span><b>{routePersistenceInspector.estimateId}</b></div>
                    <div><span>Workbook ID</span><b>{routePersistenceInspector.workbookId}</b></div>
                    <div><span>Proposal ID</span><b>{routePersistenceInspector.proposalId}</b></div>
                    <div><span>Attachment IDs</span><b>{routePersistenceInspector.attachmentIds.length.toLocaleString()}</b></div>
                    <div><span>Saved Timestamp</span><b>{routePersistenceInspector.savedTimestamp || "Pending"}</b></div>
                    <div><span>Restored Timestamp</span><b>{routePersistenceInspector.restoredTimestamp || "Pending"}</b></div>
                  </div>
                </div>
              ) : null}
              {routePersistenceAuditLog.length ? (
                <div className="commercial-restore-log">
                  {routePersistenceAuditLog.slice(0, 16).map((entry) => (
                    <span key={entry.auditId}>
                      {entry.timestamp} / {entry.stage} / {entry.status} / {JSON.stringify(entry.details)}
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="dal-list-row teralinx-list-row">
                <b>Repository Browser</b>
                <span>{commercialRepositoryBrowserSections.reduce((total, section) => total + section.records.length, 0).toLocaleString()} stored record(s)</span>
                <small>Customer &gt; Customer Twin &gt; Opportunity &gt; Route Repository &gt; Commercial Revision &gt; Commercial Change Set &gt; Proposal &gt; Commercial Release Package.</small>
              </div>
              <div className="commercial-workbook-json-preview">
                {commercialRepositoryBrowserSections.map((section) => (
                  <details key={section.id}>
                    <summary>{section.label} / {section.records.length.toLocaleString()}</summary>
                    <div className="teralinx-summary-grid">
                      <div><span>Physical Storage</span><b>{section.storage}</b></div>
                      <div><span>Repository API</span><b>{section.endpoint}</b></div>
                    </div>
                    <div className="dal-list">
                      {section.records.length ? section.records.slice(0, 10).map((record) => (
                        <details className="dal-list-row teralinx-list-row" key={`${section.id}-${record.id}`}>
                          <summary>
                            <b>{record.id}</b>
                            <span>{record.relationships.join(" / ")}</span>
                            <small>{record.storagePath}</small>
                          </summary>
                          <span>Stored JSON</span>
                          <pre>{JSON.stringify(record.json, null, 2)}</pre>
                        </details>
                      )) : (
                        <div className="dal-status">No persisted records visible for this repository.</div>
                      )}
                    </div>
                  </details>
                ))}
              </div>
            </div>
          ) : null}
        </details>
        ) : null}
      </section>

      {/*
      <section className="dal-panel commercial-iof-package-json">
        <div className="dal-panel-title-row">
          <div>
            <h3>Draft IOF Package JSON</h3>
            <span>{displayedDraftIofPackage?.packageId ?? "Commercial assembly is waiting for proposal/design evidence."}</span>
          </div>
          <span className={`dal-badge ${displayedDraftIofPackage?.packageReadiness?.status === "READY_FOR_ENGINEERING_REVIEW" ? "pass" : displayedDraftIofPackage ? "warning" : "fail"}`}>
            {String(displayedDraftIofPackage?.packageReadiness?.status ?? "Not Assembled").replaceAll("_", " ")}
          </span>
        </div>
        <div className="teralinx-summary-grid">
          <div><span>Assembler</span><b>{String(displayedDraftIofPackage?.assemblyReport?.assembledBy ?? "IOFPackageAssemblyEngine")}</b></div>
          <div><span>Proposal</span><b>{displayedDraftIofPackage?.proposalId ?? activeProposalRuntime?.proposalId ?? "Save proposal first"}</b></div>
          <div><span>Doctrine ID</span><b>{String(displayedDraftIofPackage?.doctrineId ?? selectedProductDoctrine?.doctrineId ?? "n/a")}</b></div>
          <div><span>Doctrine Version</span><b>{String(displayedDraftIofPackage?.productDoctrineVersion ?? selectedProductDoctrine?.doctrineVersion ?? "n/a")}</b></div>
          <div><span>Units</span><b>{displayedDraftIofPackage?.proposedIofUnits?.length.toLocaleString() ?? "0"}</b></div>
          <div><span>Stations</span><b>{displayedDraftIofPackage?.stations?.length.toLocaleString() ?? "0"}</b></div>
          <div><span>Objects</span><b>{displayedDraftIofPackage?.objects?.length.toLocaleString() ?? "0"}</b></div>
          <div><span>Quantities</span><b>{Number((displayedDraftIofPackage?.quantitySummary as any)?.routeFeet ?? 0).toLocaleString()} ft</b></div>
          <div><span>Pricing</span><b>{money(Number((displayedDraftIofPackage?.pricingSummary as any)?.sellPriceIru ?? 0))}</b></div>
          <div><span>Geometry Refs</span><b>{displayedDraftIofPackage?.geometryReferences?.length.toLocaleString() ?? "0"}</b></div>
          <div><span>Validation</span><b>{String((displayedDraftIofPackage?.validationSummary as any)?.status ?? displayedDraftIofPackage?.validation?.status ?? "Missing")}</b></div>
          <div><span>ScopeVersion</span><b>{displayedDraftIofPackage?.noScopeVersionCreation ? "Not created" : "Blocked"}</b></div>
          <div><span>Engineering</span><b>{displayedDraftIofPackage?.engineeringReadiness?.replaceAll("_", " ") ?? "Not ready"}</b></div>
        </div>
        <div className="dal-actions">
          <button type="button" onClick={handleSaveCommercialDraftIofPackage} disabled={!canManageProposalRuntime || !activeProposalRuntime || !commercialDraftIofPackagePreview || engineeringCertificationPending}>
            Save Draft IOF JSON
          </button>
          {!submittedToEngineering ? (
            <button type="button" onClick={handleSubmitCommercialDraftIofToEngineering} disabled={!canManageProposalRuntime || !activeProposalRuntime || !commercialDraftIofPackagePreview || engineeringCertificationPending}>
              Submit to Engineering
            </button>
          ) : (
            <button type="button" onClick={handleOpenSubmittedEngineeringCertification} disabled={!submittedEngineeringPackageId || engineeringCertificationPending}>
              Open Engineering Certification
            </button>
          )}
        </div>
        <div className="dal-status">
          {activeProposalRuntime
            ? "Commercial assembles one Draft IOF Package artifact here. Engineering opens this persisted JSON and certifies it without regenerating from Proposal state."
            : "Save a Proposal Runtime Object before preserving or handing off the Draft IOF Package JSON."}
        </div>
        <details open>
          <summary>Commercial-Assembled Draft IOF Package JSON</summary>
          <pre style={{ maxHeight: 420, overflow: "auto", whiteSpace: "pre-wrap" }}>
            {displayedDraftIofPackage ? JSON.stringify(displayedDraftIofPackage, null, 2) : "No Draft IOF Package JSON is available yet."}
          </pre>
        </details>
      </section>

      {canReadEngineeringCertification ? (
        <section className="dal-panel engineering-certification-queue">
          <div className="dal-panel-title-row">
            <div>
              <h3>IOF Package Assembly</h3>
              <span>{activeDraftIofPackage?.packageName ?? activeDraftIofPackage?.packageId ?? engineeringCertificationNotice}</span>
            </div>
            <span className={`dal-badge ${activeDraftIofPackage?.status === "CERTIFIED" ? "pass" : activeDraftIofPackage ? "warning" : "fail"}`}>
              {activeDraftIofPackage?.status ?? "No Draft Package"}
            </span>
          </div>
          <div className="teralinx-summary-grid">
            <div><span>Package Name</span><b>{activeDraftIofPackage?.packageName ?? "No active package"}</b></div>
            <div><span>Package ID</span><b>{activeDraftIofPackage?.packageId ?? "Not assembled"}</b></div>
            <div><span>Proposal</span><b>{String((activeDraftIofPackage?.proposalSummary as any)?.proposalNumber ?? activeProposalRuntime?.proposalNumber ?? "No proposal")}</b></div>
            <div><span>Customer</span><b>{activeDraftIofPackage?.customerSummary?.name ? String(activeDraftIofPackage.customerSummary.name) : selectedAccount.name}</b></div>
            <div><span>Opportunity</span><b>{activeDraftIofPackage?.opportunityId ?? activeCommercialOpportunity?.opportunityId ?? "No opportunity"}</b></div>
            <div><span>Workspace</span><b>{activeDraftIofPackage?.workspaceId ?? currentWorkspaceId}</b></div>
            <div><span>Assigned Engineer</span><b>{activeDraftIofPackage?.assignedEngineer || currentUserName}</b></div>
            <div><span>Status</span><b>{activeDraftIofPackage?.workflowStatus ?? "Waiting"}</b></div>
            <div><span>Package Readiness</span><b>{String((activeDraftIofPackage?.packageReadiness as any)?.status ?? "Not opened")}</b></div>
            <div><span>Commercial Confidence</span><b>{activeDraftIofPackage ? `${activeDraftIofPackage.commercialConfidence}%` : "n/a"}</b></div>
            <div><span>Engineering Confidence</span><b>{packageScore(activeDraftIofPackage?.engineeringConfidence)}</b></div>
            <div><span>Assembly Confidence</span><b>{packageScore(activeDraftIofPackage?.assemblyConfidence)}</b></div>
            <div><span>Completeness</span><b>{packageScore(activeDraftIofPackage?.packageCompleteness ?? (activeDraftIofPackage?.packageReadiness as any)?.packageCompleteness)}</b></div>
            <div><span>Certification Progress</span><b>{packageScore(activeDraftIofPackage?.certificationProgress ?? (activeDraftIofPackage?.packageReadiness as any)?.certificationPercent)}</b></div>
            <div><span>Revision</span><b>v{activeDraftIofPackage?.packageRevision ?? 1}</b></div>
            <div><span>History</span><b>{activeDraftIofPackage?.historyIds?.length.toLocaleString() ?? "0"}</b></div>
            <div><span>Queue</span><b>{engineeringReviewQueue.length.toLocaleString()}</b></div>
          </div>
          <div className="dal-actions">
            {!submittedToEngineering ? (
              <button type="button" onClick={handleSubmitCommercialDraftIofToEngineering} disabled={!canManageProposalRuntime || !activeProposalRuntime || !commercialDraftIofPackagePreview || engineeringCertificationPending}>Submit to Engineering</button>
            ) : (
              <button type="button" onClick={handleOpenSubmittedEngineeringCertification} disabled={!submittedEngineeringPackageId || engineeringCertificationPending}>Open Engineering Certification</button>
            )}
            <button type="button" className="secondary" onClick={() => void refreshEngineeringReviewQueue("Engineering Package queue refreshed.")} disabled={engineeringCertificationPending}>Refresh Engineering Packages</button>
          </div>
          <div className="dal-status">{engineeringCertificationNotice}</div>
          <details>
            <summary>Package Explorer</summary>
            <div className="dal-list">
              {activeDraftIofPackage ? (
                <>
                  <div className="dal-list-row teralinx-list-row">
                    <b>Executive Summary</b>
                    <span>{String((activeDraftIofPackage.proposalSummary as any)?.title ?? "Proposal summary")}</span>
                    <small>{String((activeDraftIofPackage.proposalSummary as any)?.executiveSummary ?? "No executive summary provided.")}</small>
                  </div>
                  <div className="dal-list-row teralinx-list-row">
                    <b>Commercial Summary</b>
                    <span>Assumptions {displayReferenceList((activeDraftIofPackage.commercialSummary as any)?.commercialAssumptionIds)}</span>
                    <small>Pricing {displayReference((activeDraftIofPackage.commercialSummary as any)?.pricingSummary ?? "Referenced in proposal runtime")}.</small>
                  </div>
                  <div className="dal-list-row teralinx-list-row">
                    <b>Customer Summary</b>
                    <span>{String((activeDraftIofPackage.customerSummary as any)?.name ?? activeDraftIofPackage.customerId)}</span>
                    <small>Approval {String((activeDraftIofPackage.customerSummary as any)?.approvalState ?? "Unknown")} at {String((activeDraftIofPackage.customerSummary as any)?.approvedAt ?? "n/a")}.</small>
                  </div>
                  <div className="dal-list-row teralinx-list-row">
                    <b>Existing Inventory</b>
                    <span>{manifestCount(activeDraftIofPackage, "inventory").toLocaleString()} references</span>
                    <small>{displayReferenceList(activeDraftIofPackage.existingInventoryReferences)}</small>
                  </div>
                  <div className="dal-list-row teralinx-list-row">
                    <b>Customer Design Request</b>
                    <span>{manifestCount(activeDraftIofPackage, "customerRequests").toLocaleString()} requests</span>
                    <small>{displayReferenceList(activeDraftIofPackage.customerDesignReferences)}</small>
                  </div>
                  <div className="dal-list-row teralinx-list-row">
                    <b>Geometry / Segments</b>
                    <span>{manifestCount(activeDraftIofPackage, "geometry").toLocaleString()} geometry refs</span>
                    <small>{displayReferenceList(activeDraftIofPackage.geometryReferences)}</small>
                  </div>
                  <div className="dal-list-row teralinx-list-row">
                    <b>Stations / Structures</b>
                    <span>{manifestCount(activeDraftIofPackage, "stations").toLocaleString()} stations / {manifestCount(activeDraftIofPackage, "structures").toLocaleString()} structures</span>
                    <small>Stations {displayReferenceList(activeDraftIofPackage.stations)}. Structures {displayReferenceList(activeDraftIofPackage.structures)}.</small>
                  </div>
                  <div className="dal-list-row teralinx-list-row">
                    <b>Runtime Objects / Relationships</b>
                    <span>{manifestCount(activeDraftIofPackage, "objects").toLocaleString()} objects / {manifestCount(activeDraftIofPackage, "relationships").toLocaleString()} relationships</span>
                    <small>Objects {displayReferenceList(activeDraftIofPackage.runtimeObjectIds)}. Relationships {displayReferenceList(activeDraftIofPackage.runtimeRelationshipIds)}.</small>
                  </div>
                  <div className="dal-list-row teralinx-list-row">
                    <b>Evidence / Dependencies</b>
                    <span>{manifestCount(activeDraftIofPackage, "evidence").toLocaleString()} evidence / {manifestCount(activeDraftIofPackage, "dependencies").toLocaleString()} dependencies</span>
                    <small>Evidence {displayReferenceList(activeDraftIofPackage.runtimeEvidenceIds)}. Dependencies {displayReferenceList(activeDraftIofPackage.dependencies)}.</small>
                  </div>
                  <div className="dal-list-row teralinx-list-row">
                    <b>Engineering Notes / Commercial Notes</b>
                    <span>{displayReferenceList(activeDraftIofPackage.engineeringNotes)}</span>
                    <small>{displayReferenceList(activeDraftIofPackage.commercialNotes)}</small>
                  </div>
                  <div className="dal-list-row teralinx-list-row">
                    <b>History / Validation</b>
                    <span>{activeDraftIofPackage.historyIds.length.toLocaleString()} history events / {activeDraftIofPackage.validation?.status ?? "No validation"}</span>
                    <small>{displayReferenceList(activeDraftIofPackage.historyIds)}</small>
                  </div>
                </>
              ) : (
                <div className="dal-status">Open a Draft IOF Package from the queue or assemble one from an approved Proposal.</div>
              )}
            </div>
          </details>
          <details>
            <summary>True Manifest</summary>
            <div className="teralinx-summary-grid">
              {[
                ["Objects", "objects"],
                ["Relationships", "relationships"],
                ["Inventory", "inventory"],
                ["Geometry", "geometry"],
                ["Stations", "stations"],
                ["Structures", "structures"],
                ["Dependencies", "dependencies"],
                ["Evidence", "evidence"],
                ["Documents", "documents"],
                ["Commercial Assumptions", "commercialAssumptions"],
                ["Customer Requests", "customerRequests"],
                ["Engineering Requirements", "engineeringRequirements"],
              ].map(([label, key]) => (
                <div key={key}><span>{label}</span><b>{manifestCount(activeDraftIofPackage, key).toLocaleString()}</b></div>
              ))}
            </div>
            <div className="dal-list">
              {activeDraftIofPackage?.manifest ? (
                <>
                  <div className="dal-list-row teralinx-list-row">
                    <b>{activeDraftIofPackage.manifest.manifestId}</b>
                    <span>{activeDraftIofPackage.manifest.duplicationPolicy}</span>
                    <small>Every manifest entry is a reference to runtime authority; package assembly does not copy customer data.</small>
                  </div>
                  {(["objects", "relationships", "inventory", "geometry", "evidence", "dependencies"] as const).map((key) => (
                    <div className="dal-list-row teralinx-list-row" key={key}>
                      <b>{key}</b>
                      <span>{manifestCount(activeDraftIofPackage, key).toLocaleString()} entries</span>
                      <small>{displayReferenceList((activeDraftIofPackage.manifest as any)[key]?.map((entry: any) => entry.label ?? entry.objectId), 6)}</small>
                    </div>
                  ))}
                </>
              ) : <div className="dal-status">No manifest is open.</div>}
            </div>
          </details>
          <details>
            <summary>Proposed IOF Units - {activeDraftIofPackage?.proposedIofUnits?.length.toLocaleString() ?? "0"}</summary>
            <div className="dal-list">
              {activeDraftIofPackage?.proposedIofUnits?.length ? activeDraftIofPackage.proposedIofUnits.map((unit) => (
                <div className="dal-list-row teralinx-list-row" key={unit.unitId}>
                  <b>{unit.name}</b>
                  <span>{unit.status} / {unit.engineeringDecision ?? "PENDING_ENGINEERING_REVIEW"}</span>
                  <small>
                    Type {unit.unitType}. Qty {unit.quantity ?? 0}. Commercial {unit.commercialQuantity ?? 0}. Historical {unit.historicalQuantity ?? 0}.
                    Marketplace {unit.marketplaceAdvisory ?? "NOT_REQUESTED"}. Engineering {unit.engineeringQuantity ?? 0}. Confidence {unit.confidence ?? unit.engineeringConfidence ?? 0}%.
                  </small>
                </div>
              )) : <div className="dal-status">No Proposed IOF Units are available.</div>}
            </div>
          </details>
          <details>
            <summary>Assembly Graph</summary>
            <div className="dal-list">
              {activeDraftIofPackage?.dependencyGraph ? (
                <>
                  <div className="dal-list-row teralinx-list-row">
                    <b>{activeDraftIofPackage.dependencyGraph.path}</b>
                    <span>{activeDraftIofPackage.dependencyGraph.nodes.length.toLocaleString()} nodes / {activeDraftIofPackage.dependencyGraph.edges.length.toLocaleString()} edges</span>
                    <small>Proposal references flow through Runtime Objects, relationships, units, evidence, geometry, then into the Draft IOF Package.</small>
                  </div>
                  {activeDraftIofPackage.dependencyGraph.nodes.slice(0, 8).map((node) => (
                    <div className="dal-list-row teralinx-list-row" key={node.id}>
                      <b>{node.label}</b>
                      <span>{node.type}</span>
                      <small>{node.id}</small>
                    </div>
                  ))}
                </>
              ) : <div className="dal-status">No dependency graph is open.</div>}
            </div>
          </details>
          <details>
            <summary>Readiness / Validation</summary>
            <div className="dal-list">
              {activeDraftIofPackage ? (
                <>
                  <div className="dal-list-row teralinx-list-row">
                    <b>Readiness Score</b>
                    <span>{packageScore((activeDraftIofPackage.packageReadiness as any)?.readinessScore)}</span>
                    <small>Missing {displayReferenceList((activeDraftIofPackage.packageReadiness as any)?.missingInformation, 8)}.</small>
                  </div>
                  {activeDraftIofPackage.validation?.checks?.map((check) => (
                    <div className="dal-list-row teralinx-list-row" key={check.key}>
                      <b>{check.label}</b>
                      <span>{check.status}</span>
                      <small>{check.key}</small>
                    </div>
                  ))}
                </>
              ) : <div className="dal-status">No package readiness is open.</div>}
            </div>
          </details>
          <details>
            <summary>Package Differences</summary>
            <div className="dal-list">
              {activeDraftIofPackage?.packageDifferences ? (
                <>
                  <div className="dal-list-row teralinx-list-row">
                    <b>Engineering Impact</b>
                    <span>{activeDraftIofPackage.packageDifferences.engineeringImpact}</span>
                    <small>Compared proposal v{String(activeDraftIofPackage.packageDifferences.proposalVersion ?? "n/a")} to package source v{String(activeDraftIofPackage.packageDifferences.packageSourceProposalVersion ?? "n/a")}.</small>
                  </div>
                  <div className="dal-list-row teralinx-list-row">
                    <b>Objects</b>
                    <span>Added {activeDraftIofPackage.packageDifferences.addedObjects.length} / Removed {activeDraftIofPackage.packageDifferences.removedObjects.length}</span>
                    <small>Added {displayReferenceList(activeDraftIofPackage.packageDifferences.addedObjects)}. Removed {displayReferenceList(activeDraftIofPackage.packageDifferences.removedObjects)}.</small>
                  </div>
                  <div className="dal-list-row teralinx-list-row">
                    <b>Geometry / Relationships</b>
                    <span>Geometry {activeDraftIofPackage.packageDifferences.geometryChanges.added.length + activeDraftIofPackage.packageDifferences.geometryChanges.removed.length} / Relationships {activeDraftIofPackage.packageDifferences.relationshipChanges.added.length + activeDraftIofPackage.packageDifferences.relationshipChanges.removed.length}</span>
                    <small>Modified units {displayReferenceList(activeDraftIofPackage.packageDifferences.modifiedUnits)}.</small>
                  </div>
                </>
              ) : <div className="dal-status">No package differences are open.</div>}
            </div>
          </details>
          <details>
            <summary>Engineering Handoff</summary>
            <div className="dal-list">
              {activeDraftIofPackage ? (
                <>
                  <div className="dal-list-row teralinx-list-row">
                    <b>Draft IOF Package</b>
                    <span>{activeDraftIofPackage.packageId}</span>
                    <small>Manifest {activeDraftIofPackage.manifest?.manifestId ?? "n/a"}. Readiness {packageScore((activeDraftIofPackage.packageReadiness as any)?.readinessScore)}.</small>
                  </div>
                  <div className="dal-list-row teralinx-list-row">
                    <b>Engineering Checklist</b>
                    <span>{manifestCount(activeDraftIofPackage, "engineeringRequirements").toLocaleString()} requirements</span>
                    <small>{displayReferenceList(activeDraftIofPackage.engineeringRequirements ?? activeDraftIofPackage.manifest?.engineeringRequirements?.map((entry) => entry.label), 8)}</small>
                  </div>
                  <div className="dal-list-row teralinx-list-row">
                    <b>Commercial Summary</b>
                    <span>{String((activeDraftIofPackage.proposalSummary as any)?.proposalNumber ?? activeDraftIofPackage.proposalId)}</span>
                    <small>Authority is Engineering Review. Marketplace, Contracts, SOF, and SOW remain disabled.</small>
                  </div>
                </>
              ) : <div className="dal-status">Assemble or open a package to hand it to Engineering.</div>}
            </div>
          </details>
          <details>
            <summary>Queued Draft IOF Packages - {engineeringReviewQueue.length.toLocaleString()}</summary>
            <div className="dal-list">
              {engineeringReviewQueue.length ? engineeringReviewQueue.map((item) => (
                <button className="dal-list-row teralinx-list-row" type="button" key={item.packageId} onClick={() => void handleOpenEngineeringDraftPackage(item.packageId)}>
                  <b>{item.packageName ?? item.packageId}</b>
                  <span>{item.packageStatus} / {item.priority}</span>
                  <small>
                    {item.customer} / {item.opportunityId}. Workspace {item.workspaceId ?? "n/a"}.
                    Units {item.certifiedUnitCount}/{item.proposedUnitCount}. Complete {packageScore(item.packageCompleteness)}.
                    Submitted {item.submissionDate ? new Date(item.submissionDate).toLocaleString() : "n/a"}.
                  </small>
                </button>
              )) : <div className="dal-status">No Draft IOF Packages are currently queued.</div>}
            </div>
          </details>
        </section>
      ) : null}
      */}

      <section className="commercial-orchestrator-shell commercial-map-first-workspace" aria-label="Commercial Planning map-first workspace">
        <aside className="commercial-orchestrator-nav commercial-map-left-rail">
          <div className="commercial-orchestrator-heading">
            <b>{selectedAccount.name}</b>
            <span>{accountCustomerTwin?.customerTwinId ?? customerInventoryLoadStatus}</span>
          </div>
          {customerTwinLoadWarning ? (
            <div className="commercial-customer-twin-warning">
              <b>Customer Twin Warning</b>
              <span>{customerTwinLoadWarning}</span>
              {commercialDeveloperMode ? (
                <button type="button" onClick={() => setInventoryRefreshNonce((nonce) => nonce + 1)}>Reload Twin</button>
              ) : null}
            </div>
          ) : null}
          <button type="button" className="primary" onClick={handleNewCommercialOpportunity}>New Opportunity</button>
          <div className="commercial-stage-list commercial-proposal-progress">
            <b>Proposal Progress</b>
            {commercialProposalProgressSteps.map((step) => (
              <button
                key={step.key}
                type="button"
                className={step.complete || activeView === step.view ? "commercial-stage active" : "commercial-stage"}
                onClick={() => setActiveView(step.view)}
              >
                <b>{step.label}</b>
                <span>{step.status}</span>
              </button>
            ))}
          </div>
          <div className="commercial-working-set-compact commercial-layer-rail">
            <b>Layers</b>
            {commercialMapLayers.slice(0, 8).map((layer) => (
              <label className="commercial-layer-rail-toggle" key={layer.id}>
                <input
                  type="checkbox"
                  checked={layer.visibility === "VISIBLE"}
                  disabled={!layer.sourceNetworkId}
                  onChange={() => layer.sourceNetworkId && updateNetworkLayerState(layer.sourceNetworkId, "visible")}
                />
                <span>{layer.label}</span>
              </label>
            ))}
          </div>
          <div className="commercial-working-set-compact">
            <b>Route</b>
            <span>Customer Twin: {accountRenderableCustomerTwin.routes.length.toLocaleString()} routes</span>
            <span>Draft Type: {draftTypeLabel(commercialDraftType)}</span>
            <span>Commercial Draft: {activeCommercialDraftNetworks.length ? "Visible" : "Off"}</span>
            <span>Customer Draft: {accountCustomerDrafts.length ? "Loaded" : "Off"}</span>
            <span>Shared Review: {accountCustomerReviewStatus === "IN_REVIEW" ? "On" : "Off"}</span>
            <span>Accepted Proposal: {accountAcceptedProposal ? "On" : "Off"}</span>
          </div>
          <div className="commercial-working-set-compact">
            <b>Imports</b>
            <span>Use header actions for Import Existing Network and Import Route.</span>
            {commercialDeveloperMode ? (
              <button type="button" onClick={() => setInventoryRefreshNonce((nonce) => nonce + 1)}>Reload Twin</button>
            ) : null}
            <span>Existing inventory: {accountNetworkCounts.CUSTOMER_INVENTORY.toLocaleString()} network(s)</span>
            <span>Customer designs: {accountCustomerDesignImports.length.toLocaleString()} request(s)</span>
          </div>
          <div className="dal-actions vertical">
            {commercialDeveloperMode ? (
              <>
                <button type="button" onClick={() => setInventoryRefreshNonce((nonce) => nonce + 1)}>Refresh Twin</button>
                <button type="button" onClick={() => setInventoryRefreshNonce((nonce) => nonce + 1)}>Reload Customer Inventory</button>
              </>
            ) : null}
            <button type="button" onClick={() => setActiveView("review")} disabled={!activeCommercialDraftNetworks.length && !accountCustomerDrafts.length}>Customer Review</button>
          </div>
        </aside>

        <main className="commercial-orchestrator-map">
          {importedCustomerGeometryError ? (
            <div className="dal-status commercial-map-error">{importedCustomerGeometryError}</div>
          ) : null}
          <ProposedNetworkMapPanel
            graph={importedCustomerDesignGraph ?? (activeCommercialDraftNetworks.length || loadedCommercialDraftSnapshot ? (inventoryReferenceGraph ?? COMMERCIAL_BASELINE_GRAPH) : COMMERCIAL_BASELINE_GRAPH)}
            selected={inventoryMapSelection}
            onSelect={setInventoryMapSelection}
            customerTwinState={accountRenderableCustomerTwin}
            commercialMapLayers={commercialMapLayers}
            commercialOpportunityOverlay={commercialOpportunityOverlay}
            corridorViewportProjection={corridorViewportProjection}
            commercialIofProjection={commercialIofProjectionOverlay}
            commercialIlaStations={(displayedTransparentEstimate?.ilaPlan.stationObjects ?? activeFinancialDraft?.transparentEstimate.ilaPlan.stationObjects ?? []).map((station): CommercialIlaMapStation => ({
              stationId: station.stationId,
              label: station.label,
              station: station.station,
              milepost: station.milepost,
              gps: station.gps,
              coordinate: station.coordinate,
              facilityType: station.facilityType,
              totalCost: station.totalCost,
            }))}
            selectedCommercialIlaStationId={displayedTransparentEstimateControls.ilaPlanning.selectedStationId}
            onCommercialIlaStationSelect={selectTransparentIlaStation}
            mapMinHeight={800}
            mapTitle="Unified Commercial Map"
            mapBadgeLabel={opportunityWorkflowState === "AWAITING_MAP_CLICK" ? "Extension site placement" : azMapPlacementSlot ? `${azMapPlacementSlot} corridor point placement` : commercialDraftType ? draftTypeLabel(commercialDraftType) : "Customer Twin baseline"}
            onMapCoordinateClick={handleScoutMapCoordinate}
            onCommercialLayerVisibilityToggle={(networkId) => updateNetworkLayerState(networkId, "visible")}
            redline={{
              mode: "REVIEW",
              presentationMode: "SALES",
            }}
          />
          {!accountRenderableCustomerTwin.routes.length && !accountRenderableCustomerTwin.objects.length && !accountRenderableCustomerTwin.stations.length ? (
            <div className="dal-status">Customer Twin is {customerInventoryLoadStatus.toLowerCase()}. Commercial Planning is not loading proposal geometry while inventory settles.</div>
          ) : null}
        </main>

        <aside className="commercial-context-inspector commercial-estimate-sidebar">
          <div className="dal-panel-title-row">
            <h3>Estimate</h3>
            <span className="dal-badge warning">{estimateStatusLabel}</span>
          </div>
          <div className="commercial-estimate-sidebar-grid">
            <div><span>Route Length Miles</span><b>{activeRouteLengthLabel}</b></div>
            <div><span>Route Length Feet</span><b>{Math.round(activeRouteFeet).toLocaleString()}</b></div>
            <div><span>Corridor Segments</span><b>{corridorAggregateProjection?.segmentCount.toLocaleString() ?? "Pending"}</b></div>
            <div><span>Visible Segments</span><b>{corridorViewportProjection?.visibleSegmentCount.toLocaleString() ?? "Pending"}</b></div>
            <div><span>Construction Cost</span><b>{money(activeConstructionCost)}</b></div>
            <div><span>Cost / Foot</span><b>{money(activeCostPerFoot)}</b></div>
            <div><span>Cost / Mile</span><b>{activeFinancialAuthority ? money(activeFinancialAuthority.costPerMile) : money(selectedPricingSummary.reconciliation.costPerMile)}</b></div>
            <div><span>Sell Price</span><b>{money(activeSellPrice)}</b></div>
            <div><span>Sell Price / Foot</span><b>{money(activeSellPerFoot)}</b></div>
            <div><span>Revenue / Mile</span><b>{activeFinancialAuthority ? money(activeFinancialAuthority.revenuePerMile) : money(selectedPricingSummary.reconciliation.revenuePerMile)}</b></div>
            <div><span>Gross Margin $</span><b>{money(activeFinancialAuthority?.grossMarginDollars ?? selectedPricingSummary.reconciliation.grossMarginDollars)}</b></div>
            <div><span>Gross Margin %</span><b>{percentage(activeFinancialAuthority?.grossMarginPercent ?? selectedPricingSummary.reconciliation.grossMarginPercent)}</b></div>
            <div><span>Monthly Revenue</span><b>{activeFinancialAuthority ? money(activeFinancialAuthority.mrcRevenue) : money(selectedPricingSummary.reconciliation.mrcRevenue)}</b></div>
            <div><span>Lifecycle Value</span><b>{activeFinancialAuthority ? money(activeFinancialAuthority.lifecycleRevenue) : money(selectedPricingSummary.reconciliation.lifecycleRevenue)}</b></div>
            <div><span>Confidence</span><b>{estimateConfidenceLabel}</b></div>
            <div><span>Unknowns</span><b>{unknownConstraintCount.toLocaleString()}</b></div>
            <div><span>Construction Mix</span><b>{activeConstructionMixLabel}</b></div>
            <div><span>Proposal Status</span><b>{proposalStatusLabel}</b></div>
            <div><span>Commercial Review</span><b>{accountCustomerReviewStatus.replaceAll("_", " ")}</b></div>
          </div>
          <div className="commercial-estimate-risk-list">
            <b>Risks</b>
            {commercialEstimateRisks.slice(0, 4).map((risk, index) => (
              <span key={`estimate-risk-${index}`}>{risk}</span>
            ))}
          </div>
          <div className="commercial-inspector-card route-edit-session-card">
            <b>Route Edit Session</b>
            <span>{routeEditSession ? `${routeEditSession.patches.length.toLocaleString()} patch(es) staged` : "Inactive"}</span>
            <small>{routeEditNotice}</small>
            <div className="dal-actions">
              <button type="button" onClick={handleStartRouteEditSession} disabled={!activeFinancialDraft}>
                {routeEditSession ? "Edit Session Active" : "Start Edit"}
              </button>
              <button type="button" onClick={() => void handleSaveRouteEditRevision()} disabled={!routeEditSession || !routeEditSession.patches.length}>Save Revision</button>
              <button type="button" onClick={handleCompareRouteEditRevision} disabled={!routeEditSession}>Compare Revision</button>
              <button type="button" onClick={handleRollbackRouteEditSession} disabled={!routeEditSession || !routeEditSession.patches.length}>Restore Original</button>
              <button type="button" onClick={handleDiscardRouteEditRevision} disabled={!routeEditSession}>Discard Revision</button>
            </div>
            {routeEditSession ? (
              <div className="teralinx-summary-grid">
                <div><span>Boundary</span><b>{routeEditSession.projection.impact.recalculationBoundary.replaceAll("_", " ")}</b></div>
                <div><span>Route Rebuild</span><b>{routeEditSession.projection.impact.fullRouteRebuild ? "YES" : "NO"}</b></div>
                <div><span>Workbook Full Recalc</span><b>{routeEditSession.projection.impact.fullWorkbookRecalculation ? "YES" : "NO"}</b></div>
                <div><span>Inventory Reimport</span><b>{routeEditSession.projection.impact.inventoryReimport ? "YES" : "NO"}</b></div>
                <div><span>Map Rerender</span><b>{routeEditSession.projection.impact.mapFullRerender ? "FULL" : "PATCH"}</b></div>
                <div><span>Cost Delta</span><b>{money(routeEditSession.projection.estimateDelta.constructionCostDelta)}</b></div>
                <div><span>Monthly Revenue Delta</span><b>{money(routeEditSession.projection.estimateDelta.monthlyRevenueDelta)}</b></div>
                <div><span>Lifecycle Delta</span><b>{money(routeEditSession.projection.estimateDelta.lifecycleValueDelta)}</b></div>
              </div>
            ) : null}
            {routeEditSession?.failedPatches.length ? (
              <div className="dal-status">
                {routeEditSession.failedPatches[0].operatorSafeMessage}
              </div>
            ) : null}
            {routeEditRevisionPreview ? (
              <small>Last saved patch set: {routeEditRevisionPreview.routeEditRevisionId}</small>
            ) : null}
          </div>
          <div className="commercial-inspector-card">
            <b>Commercial Change Set</b>
            <span>{commercialChangeSetPatches.length ? `${commercialChangeSetPatches.length.toLocaleString()} active patch(es)` : "Repository Truth projection"}</span>
            <small>{commercialChangeSetNotice}</small>
          </div>
          <div className="commercial-inspector-card commercial-geometry-authority-panel" data-geometry-authority-diagnostics="visible">
            <b>Geometry Authority</b>
            <span>{String(displayedGeometryAuthorityDiagnostics?.geometryAuthority ?? displayedGeometryAuthorityDiagnostics?.status ?? "PENDING")}</span>
            <small>Measured Centerline: {String(displayedGeometryAuthorityDiagnostics?.measuredCenterlineId ?? (displayedDraftIofPackage as any)?.measuredCenterlineId ?? "missing")}</small>
            <div className="teralinx-summary-grid compact">
              <div><span>Measured Centerline</span><b>{displayedGeometryAuthorityDiagnostics?.measuredCenterlineId ? "PASS" : "FAIL"}</b></div>
              <div><span>Independent Geometry</span><b>{Number(displayedGeometryAuthorityDiagnostics?.independentGeometryCount ?? 0).toLocaleString()}</b></div>
              <div><span>Projected Objects</span><b>{Number(displayedGeometryAuthorityDiagnostics?.projectedObjectCount ?? displayedProjectedObjects.length).toLocaleString()}</b></div>
              <div><span>Projected Spans</span><b>{Number(displayedGeometryAuthorityDiagnostics?.projectedSpanCount ?? displayedProjectedSpans.length).toLocaleString()}</b></div>
              <div><span>Objects On Spine</span><b>{Number(displayedGeometryAuthorityDiagnostics?.objectsOnSpine ?? displayedProjectedObjects.length).toLocaleString()} / {Number(displayedGeometryAuthorityDiagnostics?.objectsOnSpineTotal ?? displayedProjectedObjects.length).toLocaleString()}</b></div>
              <div><span>Maximum Drift</span><b>{Number(displayedGeometryAuthorityDiagnostics?.maximumDriftFeet ?? 0).toFixed(2)} ft</b></div>
              <div><span>Independent Span Geometry</span><b>{Number(displayedGeometryAuthorityDiagnostics?.independentSpanGeometryCount ?? 0).toLocaleString()}</b></div>
              <div><span>Commercial</span><b>{String(displayedGeometryAuthorityDiagnostics?.commercialRenderValidation ?? "PENDING")}</b></div>
              <div><span>Engineering</span><b>{String(displayedGeometryAuthorityDiagnostics?.engineeringRenderValidation ?? "PENDING")}</b></div>
              <div><span>Field</span><b>{String(displayedGeometryAuthorityDiagnostics?.fieldRenderValidation ?? "PENDING")}</b></div>
              <div><span>Twin</span><b>{String(displayedGeometryAuthorityDiagnostics?.twinRenderValidation ?? "PENDING")}</b></div>
            </div>
            {asDisplayArray(displayedGeometryAuthorityDiagnostics?.failures).length ? (
              <small>{asDisplayArray(displayedGeometryAuthorityDiagnostics?.failures).join("; ")}</small>
            ) : null}
          </div>
          <div className="commercial-inspector-card commercial-projection-diagnostics-panel" data-commercial-projection-diagnostics="visible">
            <b>Commercial Projection Diagnostics</b>
            <span>{String(displayedDoctrineProjectionDiagnostics?.status ?? "PENDING")}</span>
            <small>
              Authority {String(displayedDoctrineProjectionDiagnostics?.authority ?? "DOCTRINE_PROJECTION_ENGINE")} /
              Projection {String((displayedDraftIofPackage as any)?.doctrineProjectionId ?? displayedStationProjection?.stationProjectionId ?? "missing")}
            </small>
            <div className="teralinx-summary-grid compact">
              <div><span>Measured Centerline</span><b>{String((displayedDraftIofPackage as any)?.measuredCenterlineId ?? objectRecord((displayedDraftIofPackage as any)?.measuredCenterline)?.measuredCenterlineId ?? "Missing")}</b></div>
              <div><span>Station Projection</span><b>{String((displayedDraftIofPackage as any)?.stationProjectionId ?? displayedStationProjection?.stationProjectionId ?? "Missing")}</b></div>
              <div><span>Station Graph</span><b>{String((displayedDraftIofPackage as any)?.stationGraphId ?? displayedStationGraph?.stationGraphId ?? displayedStationGraph?.graphId ?? "Missing")}</b></div>
              <div><span>Projected Object Manifest</span><b>{String((displayedDraftIofPackage as any)?.projectedObjectManifestId ?? displayedProjectedObjectManifest?.projectedObjectManifestId ?? displayedProjectedObjectManifest?.manifestId ?? "Missing")}</b></div>
              <div><span>Projected Objects Layer</span><b>{displayedProjectedObjects.length.toLocaleString()}</b></div>
              <div><span>Projected Spans Layer</span><b>{displayedProjectedSpans.length.toLocaleString()}</b></div>
              <div><span>Station Graph Layer</span><b>{recordArray(displayedStationGraph?.edges).length.toLocaleString()} edges</b></div>
              <div><span>Object Address Layer</span><b>{displayedObjectAddresses.length.toLocaleString()}</b></div>
              <div><span>Object Attachments</span><b>{displayedObjectStationAttachments.length.toLocaleString()}</b></div>
              <div><span>Linear Attachments</span><b>{displayedLinearAssetSpanAttachments.length.toLocaleString()}</b></div>
            </div>
            {recordArray(displayedDoctrineProjectionDiagnostics?.failedGates).length ? (
              <small>{recordArray(displayedDoctrineProjectionDiagnostics?.failedGates).map((gate) => `${String(gate.objectType ?? "Projection")} ${String(gate.gate ?? "Gate")}: ${String(gate.reason ?? "failed")}`).join("; ")}</small>
            ) : null}
          </div>
          <div className="commercial-inspector-card commercial-doctrine-diagnostics-panel" data-commercial-doctrine-diagnostics="visible">
            <b>Commercial Doctrine Diagnostics</b>
            <span>{String(displayedDoctrineProjectionDiagnostics?.status ?? "PENDING")}</span>
            <small>
              Route {Math.round(Number(displayedDoctrineProjectionDiagnostics?.routeFeet ?? activeRouteFeet)).toLocaleString()} ft /
              Stations {Number(displayedDoctrineProjectionDiagnostics?.stationCount ?? 0).toLocaleString()} /
              Objects {displayedProjectedObjects.length.toLocaleString()} /
              Spans {displayedProjectedSpans.length.toLocaleString()}
            </small>
            <div className="teralinx-summary-grid commercial-doctrine-gates">
              {["Math Present", "Objects Calculated", "Addresses Assigned", "Objects Projected"].map((gateLabel) => {
                const failedGate = recordArray(displayedDoctrineProjectionDiagnostics?.failedGates).find((gate) => String(gate.gate ?? "").replaceAll("_", " ") === gateLabel);
                const pass = !failedGate && Boolean(displayedDoctrineProjectionDiagnostics);
                return (
                  <div key={`commercial-doctrine-gate-${gateLabel}`}>
                    <span>{gateLabel}</span>
                    <b>{pass ? "PASS" : "FAIL"}</b>
                    {!pass ? <small>{String(failedGate?.reason ?? "projection ID missing")}</small> : null}
                  </div>
                );
              })}
            </div>
            <div className="commercial-workbook-table-wrap">
              <table className="dal-table commercial-doctrine-diagnostics-table">
                <thead>
                  <tr>
                    <th>Object Class</th>
                    <th>Quantity Source</th>
                    <th>Route Feet</th>
                    <th>Station Count</th>
                    <th>Object Count</th>
                    <th>Nominal Interval</th>
                    <th>Calculated Stations</th>
                    <th>Resolved Coordinates</th>
                    <th>Placement Authority</th>
                    <th>Projection Result</th>
                  </tr>
                </thead>
                <tbody>
                  {commercialDoctrineDiagnosticsRows.map((row) => {
                    const gates = recordArray(row.gates);
                    const failed = gates.find((gate) => String(gate.status ?? "").toUpperCase() !== "PASS");
                    const resolvedCoordinates = recordArray(row.resolvedCoordinates);
                    return (
                      <tr key={`commercial-doctrine-diagnostic-${String(row.objectType)}`}>
                        <td>{String(row.objectType ?? "UNKNOWN").replaceAll("_", " ")}</td>
                        <td>{String(row.doctrineQuantitySource ?? "Product Doctrine")}</td>
                        <td>{Math.round(Number(row.routeFeet ?? 0)).toLocaleString()}</td>
                        <td>{Number(row.stationCount ?? 0).toLocaleString()}</td>
                        <td>{Number(row.objectCount ?? 0).toLocaleString()}</td>
                        <td>{Math.round(Number(row.nominalIntervalFeet ?? 0)).toLocaleString()} ft</td>
                        <td>{asDisplayArray(row.calculatedStations).slice(0, 6).join(", ") || "Span range"}</td>
                        <td>{resolvedCoordinates.slice(0, 3).map((coordinate) => `${coordinate.objectId ?? ""} ${coordinate.stationAddress ?? ""} ${coordinate.latitude ?? ""}/${coordinate.longitude ?? ""}`.trim()).join("; ") || "Linear span"}</td>
                        <td>{String(row.placementAuthority ?? "DOCTRINE_PROJECTION_ENGINE")}</td>
                        <td>{String(row.projectionResult ?? (failed ? "FAIL" : "PASS"))}{failed ? `: ${String(failed.reason ?? "failed gate")}` : ""}</td>
                      </tr>
                    );
                  })}
                  {!commercialDoctrineDiagnosticsRows.length ? (
                    <tr><td colSpan={10}>Commercial Doctrine Diagnostics will appear after OSRM route commit and Initial IOF Package assembly.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
          <div className="dal-panel-title-row commercial-route-inspector-title">
            <h3>Route</h3>
            <span className="dal-badge warning">{opportunityWorkflowLabel(opportunityWorkflowState)}</span>
          </div>
          {inventoryMapSelection ? (
            <div className="commercial-inspector-card">
              <b>{inventoryMapSelection.type.replaceAll("_", " ").toUpperCase()}</b>
              {inventoryMapSelection.type === "commercialIofObject" ? (
                <>
                  <span>{inventoryMapSelection.value.objectId} / {inventoryMapSelection.value.objectType.replaceAll("_", " ")}</span>
                  <small>{inventoryMapSelection.value.stationAddress} / {inventoryMapSelection.value.coordinate?.[1]?.toFixed?.(6) ?? inventoryMapSelection.value.latitude ?? "lat pending"}, {inventoryMapSelection.value.coordinate?.[0]?.toFixed?.(6) ?? inventoryMapSelection.value.longitude ?? "lng pending"}</small>
                  <div className="teralinx-summary-grid">
                    <div><span>Doctrine</span><b>{inventoryMapSelection.value.doctrineObjectType ?? inventoryMapSelection.value.objectType}</b></div>
                    <div><span>Quantity Source</span><b>{inventoryMapSelection.value.doctrineQuantitySource ?? "Product Doctrine"}</b></div>
                    <div><span>Measure</span><b>{feet(inventoryMapSelection.value.measure)}</b></div>
                    <div><span>Billable Material</span><b>{inventoryMapSelection.value.billableMaterial ?? inventoryMapSelection.value.objectType.replaceAll("_", " ")}</b></div>
                    <div><span>Billable Labor</span><b>{inventoryMapSelection.value.billableLabor ?? "Doctrine placement labor"}</b></div>
                    <div><span>Material Template</span><b>{(inventoryMapSelection.value as any).materialTemplateId ?? (inventoryMapSelection.value as any).materialTemplate ?? inventoryMapSelection.value.billableMaterial ?? inventoryMapSelection.value.objectType.replaceAll("_", " ")}</b></div>
                    <div><span>Labor Template</span><b>{(inventoryMapSelection.value as any).laborTemplateId ?? (inventoryMapSelection.value as any).laborTemplate ?? inventoryMapSelection.value.billableLabor ?? "Doctrine placement labor"}</b></div>
                    <div><span>Evidence Template</span><b>{(inventoryMapSelection.value as any).evidenceTemplateId ?? (inventoryMapSelection.value as any).evidenceTemplate ?? displayReferenceList(inventoryMapSelection.value.evidenceRequirements)}</b></div>
                    <div><span>Dependencies</span><b>{displayReferenceList(inventoryMapSelection.value.dependencyList ?? inventoryMapSelection.value.dependencies)}</b></div>
                    <div><span>Execution</span><b>{inventoryMapSelection.value.executionSequenceId ?? "Missing"}</b></div>
                    <div><span>Payment</span><b>{inventoryMapSelection.value.paymentSequenceId ?? "Missing"}</b></div>
                    <div><span>Close</span><b>{inventoryMapSelection.value.closeSequenceId ?? "Missing"}</b></div>
                    <div><span>Evidence</span><b>{displayReferenceList(inventoryMapSelection.value.evidenceRequirements)}</b></div>
                    <div><span>Lifecycle</span><b>{inventoryMapSelection.value.currentLifecycleState ?? inventoryMapSelection.value.lifecycleState ?? "PLANNED"}</b></div>
                    <div><span>Authority</span><b>{(inventoryMapSelection.value as any).currentAuthority ?? "Commercial"}</b></div>
                    <div><span>Next Authority</span><b>{(inventoryMapSelection.value as any).nextAuthority ?? "Commercial"}</b></div>
                    <div><span>Domain Owner</span><b>{(inventoryMapSelection.value as any).domainResponsibilityMatrix?.[(inventoryMapSelection.value as any).currentState ?? inventoryMapSelection.value.currentLifecycleState ?? inventoryMapSelection.value.lifecycleState ?? ""] ?? "Commercial"}</b></div>
                    <div><span>Audit</span><b>{(inventoryMapSelection.value as any).auditStatus ?? "OPEN"}</b></div>
                    <div><span>Closure Ledger</span><b>{(inventoryMapSelection.value as any).auditLedgerHooks?.closureLedgerId ?? "Pending"}</b></div>
                    <div><span>Twin Projection</span><b>{(inventoryMapSelection.value as any).twinProjectionMetadata?.twinProjectionId ?? "Pending"}</b></div>
                  </div>
                </>
              ) : inventoryMapSelection.type === "commercialIofSpan" ? (
                <>
                  <span>{inventoryMapSelection.value.spanId}</span>
                  <small>{inventoryMapSelection.value.startObjectId ?? "Start"} to {inventoryMapSelection.value.endObjectId ?? "End"} / {feet(inventoryMapSelection.value.lengthFeet)}</small>
                  <div className="teralinx-summary-grid">
                    <div><span>Doctrine</span><b>{inventoryMapSelection.value.spanType ?? "Projected Span"}</b></div>
                    <div><span>Quantity Source</span><b>{(inventoryMapSelection.value as any).doctrineQuantitySource ?? displayReferenceList(inventoryMapSelection.value.containedAssets)}</b></div>
                    <div><span>Start Station</span><b>{inventoryMapSelection.value.startStation ?? inventoryMapSelection.value.stationStart ?? "Missing"}</b></div>
                    <div><span>End Station</span><b>{inventoryMapSelection.value.endStation ?? inventoryMapSelection.value.stationEnd ?? "Missing"}</b></div>
                    <div><span>Start Measure</span><b>{feet(inventoryMapSelection.value.startMeasure ?? inventoryMapSelection.value.startStationFeet)}</b></div>
                    <div><span>End Measure</span><b>{feet(inventoryMapSelection.value.endMeasure ?? inventoryMapSelection.value.endStationFeet)}</b></div>
                    <div><span>Render Authority</span><b>{inventoryMapSelection.value.renderAuthority ?? "MEASURED_CENTERLINE_CLIP"}</b></div>
                    <div><span>Contained Assets</span><b>{displayReferenceList(inventoryMapSelection.value.containedAssets)}</b></div>
                    <div><span>Construction</span><b>{inventoryMapSelection.value.constructionMethod ?? "Doctrine span view"}</b></div>
                    <div><span>Billable Material</span><b>{inventoryMapSelection.value.billableMaterial ?? displayReferenceList(inventoryMapSelection.value.containedAssets)}</b></div>
                    <div><span>Billable Labor</span><b>{inventoryMapSelection.value.billableLabor ?? "Span placement labor"}</b></div>
                    <div><span>Material Template</span><b>{(inventoryMapSelection.value as any).materialTemplateId ?? (inventoryMapSelection.value as any).materialTemplate ?? inventoryMapSelection.value.billableMaterial ?? displayReferenceList(inventoryMapSelection.value.containedAssets)}</b></div>
                    <div><span>Labor Template</span><b>{(inventoryMapSelection.value as any).laborTemplateId ?? (inventoryMapSelection.value as any).laborTemplate ?? inventoryMapSelection.value.billableLabor ?? "Span placement labor"}</b></div>
                    <div><span>Evidence Template</span><b>{(inventoryMapSelection.value as any).evidenceTemplateId ?? (inventoryMapSelection.value as any).evidenceTemplate ?? displayReferenceList((inventoryMapSelection.value as any).evidenceRequirements)}</b></div>
                    <div><span>Dependencies</span><b>{displayReferenceList(inventoryMapSelection.value.dependencies)}</b></div>
                    <div><span>Execution</span><b>{(inventoryMapSelection.value as any).executionSequenceId ?? "Derived from endpoint objects"}</b></div>
                    <div><span>Payment</span><b>{(inventoryMapSelection.value as any).paymentSequenceId ?? "Derived from endpoint objects"}</b></div>
                    <div><span>Close</span><b>{(inventoryMapSelection.value as any).closeSequenceId ?? "Derived from endpoint objects"}</b></div>
                    <div><span>Lifecycle</span><b>{inventoryMapSelection.value.lifecycleState ?? "PLANNED"}</b></div>
                    <div><span>Authority</span><b>{(inventoryMapSelection.value as any).currentAuthority ?? "Commercial"}</b></div>
                    <div><span>Next Authority</span><b>{(inventoryMapSelection.value as any).nextAuthority ?? "Commercial"}</b></div>
                    <div><span>Domain Owner</span><b>{(inventoryMapSelection.value as any).domainResponsibilityMatrix?.[(inventoryMapSelection.value as any).currentState ?? inventoryMapSelection.value.lifecycleState ?? ""] ?? "Commercial"}</b></div>
                    <div><span>Audit</span><b>{(inventoryMapSelection.value as any).auditStatus ?? "OPEN"}</b></div>
                    <div><span>Closure Ledger</span><b>{(inventoryMapSelection.value as any).auditLedgerHooks?.closureLedgerId ?? "Pending"}</b></div>
                    <div><span>Twin Projection</span><b>{(inventoryMapSelection.value as any).twinProjectionMetadata?.twinProjectionId ?? "Pending"}</b></div>
                    <div><span>Next Closable</span><b>{(inventoryMapSelection.value as any).nextClosableSegment ?? displayReferenceList((inventoryMapSelection.value as any).openClosureSegments)}</b></div>
                  </div>
                </>
              ) : (
                <span>
                  {inventoryMapSelection.type === "node"
                    ? inventoryMapSelection.value.name
                    : inventoryMapSelection.type === "edge"
                      ? (inventoryMapSelection.value.segmentId ?? inventoryMapSelection.value.id)
                      : inventoryMapSelection.type === "station"
                        ? inventoryMapSelection.value.stationLabel
                        : inventoryMapSelection.value.objectType.replaceAll("_", " ")}
                </span>
              )}
            </div>
          ) : null}
          <div className="commercial-inspector-card">
            <b>Customer Twin Summary</b>
            <span>{accountRenderableCustomerTwin.routes.length || accountRenderableCustomerTwin.objects.length || accountRenderableCustomerTwin.stations.length ? "Customer Twin loaded. Select New Opportunity to begin." : `Customer Twin ${customerInventoryLoadStatus.toLowerCase()}.`}</span>
            <small>{accountRenderableCustomerTwin.routes.length.toLocaleString()} routes / {accountRenderableCustomerTwin.objects.length.toLocaleString()} objects / {accountRenderableCustomerTwin.stations.length.toLocaleString()} stations</small>
          </div>
          {commercialDraftType ? (
            <div className="commercial-inspector-card">
              <b>{draftTypeLabel(commercialDraftType)}</b>
              <span>{commercialDraftType === "NEW_GRAPH_CORRIDOR" ? "A/Z corridor build. Customer Twin is advisory only." : "Attachment-based lateral extension. Customer Twin is attachment authority."}</span>
            </div>
          ) : null}
          {opportunityWorkflowState === "IDLE" && !opportunityScoutCandidate && !activeCommercialDraftNetworks.length ? (
            <div className="commercial-inspector-card">
              <b>No opportunity selected</b>
              <span>Select Product Configurator or Extend Existing Graph / Lateral.</span>
              <small>Product Configurator builds A/Z commercial design data. Extend Existing builds attachment-based lateral economics.</small>
            </div>
          ) : null}
          {opportunityWorkflowState === "SELECTING_START_MODE" ? (
            <div className="commercial-inspector-card">
              <b>Select how to create an opportunity.</b>
              <span>No Site Decision. No Quick Quote. No draft.</span>
            </div>
          ) : null}
          {opportunityWorkflowState === "AWAITING_MAP_CLICK" ? (
            <div className="commercial-inspector-card">
              <b>Click the map to place a candidate.</b>
              <span>Extension site placement is active. The first map click creates a candidate site only.</span>
            </div>
          ) : null}
          {opportunityWorkflowState === "SELECTING_EXTENSION_INPUT" ? (
            <div className="commercial-inspector-card">
              <b>Extension / Lateral Input</b>
              <span>Create a candidate site, then Commercial Planning will search Customer Twin for routable attachments.</span>
              <button type="button" onClick={handleBeginMapOpportunity}>Click Site on Map</button>
              <button type="button" onClick={handleBeginAddressOpportunity}>Enter Address</button>
              <button type="button" onClick={handleBeginLatLngOpportunity}>Enter Latitude / Longitude</button>
              <button type="button" onClick={handleUseExistingCustomerSite} disabled={!accountRenderableCustomerTwin.objects.length}>Use Existing Customer Site</button>
              <button type="button" onClick={handleUseExistingStation} disabled={!accountRenderableCustomerTwin.stations.length}>Use Existing Station</button>
              <button type="button" onClick={handleUseExistingObject} disabled={!accountRenderableCustomerTwin.objects.length}>Use Existing Object</button>
            </div>
          ) : null}
          {opportunityWorkflowState === "AWAITING_ADDRESS" ? (
            <div className="commercial-inspector-card">
              <b>Address Input</b>
              <label>
                <span>Address</span>
                <input value={opportunityScoutAddress} onChange={(event) => setOpportunityScoutAddress(event.currentTarget.value)} placeholder="Enter customer site address" />
              </label>
              <button type="button" onClick={handleRunAddressScout} disabled={!opportunityScoutAddress.trim()}>Resolve Address</button>
            </div>
          ) : null}
          {opportunityWorkflowState === "AWAITING_LAT_LNG" ? (
            <div className="commercial-inspector-card">
              <b>Latitude / Longitude Input</b>
              <label>
                <span>Latitude</span>
                <input value={opportunityScoutLat} onChange={(event) => setOpportunityScoutLat(event.currentTarget.value)} placeholder="37.78520" />
              </label>
              <label>
                <span>Longitude</span>
                <input value={opportunityScoutLng} onChange={(event) => setOpportunityScoutLng(event.currentTarget.value)} placeholder="-100.05070" />
              </label>
              <button type="button" onClick={handleRunLatLngScout} disabled={!Number.isFinite(Number(opportunityScoutLat)) || !Number.isFinite(Number(opportunityScoutLng))}>Resolve Coordinates</button>
            </div>
          ) : null}
          {opportunityWorkflowState === "AWAITING_AZ_INPUT" ? (
            <div className="commercial-inspector-card">
              <b>Point-to-Point Product Configurator</b>
              <span>A and Z resolve as explicit endpoints. Customer Twin is not used for attachment or station snapping.</span>
              <label>
                <span>A Location</span>
                <input value={opportunityScoutAzOrigin} onChange={(event) => setOpportunityScoutAzOrigin(event.currentTarget.value)} placeholder="Address or lat,lng" />
              </label>
              <small>{azOriginLocation ? `${azOriginLocation.label} | ${locationSourceLabel(azOriginLocation.source)} | ${azOriginLocation.domain.replaceAll("_", " ")}` : "A unresolved"}</small>
              <div className="dal-actions">
                <button type="button" onClick={() => handleResolveAzTextLocation("A")} disabled={!opportunityScoutAzOrigin.trim()}>Resolve A Text</button>
                <button type="button" onClick={() => handleBeginAzMapPlacement("A")}>Click A on Map</button>
                <button type="button" onClick={() => handleResolveAzExistingLocation("A", "CUSTOMER_ROUTE")} disabled={!accountRenderableCustomerTwin.routes.length}>A Route</button>
                <button type="button" onClick={() => handleResolveAzExistingLocation("A", "CUSTOMER_STATION")} disabled={!accountRenderableCustomerTwin.stations.length}>A Station</button>
                <button type="button" onClick={() => handleResolveAzExistingLocation("A", "CUSTOMER_POP")} disabled={!accountRenderableCustomerTwin.objects.length}>A POP</button>
                <button type="button" onClick={() => handleResolveAzExistingLocation("A", "CUSTOMER_OBJECT")} disabled={!accountRenderableCustomerTwin.objects.length}>A Object</button>
              </div>
              <label>
                <span>Z Location</span>
                <input value={opportunityScoutAzDestination} onChange={(event) => setOpportunityScoutAzDestination(event.currentTarget.value)} placeholder="Address or lat,lng" />
              </label>
              <small>{azDestinationLocation ? `${azDestinationLocation.label} | ${locationSourceLabel(azDestinationLocation.source)} | ${azDestinationLocation.domain.replaceAll("_", " ")}` : "Z unresolved"}</small>
              <div className="dal-actions">
                <button type="button" onClick={() => handleResolveAzTextLocation("Z")} disabled={!opportunityScoutAzDestination.trim()}>Resolve Z Text</button>
                <button type="button" onClick={() => handleBeginAzMapPlacement("Z")}>Click Z on Map</button>
                <button type="button" onClick={() => handleResolveAzExistingLocation("Z", "CUSTOMER_ROUTE")} disabled={!accountRenderableCustomerTwin.routes.length}>Z Route</button>
                <button type="button" onClick={() => handleResolveAzExistingLocation("Z", "CUSTOMER_STATION")} disabled={!accountRenderableCustomerTwin.stations.length}>Z Station</button>
                <button type="button" onClick={() => handleResolveAzExistingLocation("Z", "CUSTOMER_POP")} disabled={!accountRenderableCustomerTwin.objects.length}>Z POP</button>
                <button type="button" onClick={() => handleResolveAzExistingLocation("Z", "CUSTOMER_OBJECT")} disabled={!accountRenderableCustomerTwin.objects.length}>Z Object</button>
              </div>
              {azMapPlacementSlot ? <span className="dal-status">Click the map to resolve {azMapPlacementSlot}.</span> : null}
              <button type="button" onClick={handleRunAzBuilderScout} disabled={!azOriginLocation || !azDestinationLocation}>Resolve Product A/Z</button>
            </div>
          ) : null}
          {pendingRouteImport ? (
            <div className="commercial-inspector-card route-candidate-selection-card">
              <b>Select Imported Route Centerline</b>
              <span>{pendingRouteImport.sourceFileName} contains {pendingRouteImport.routes.length.toLocaleString()} candidate lines.</span>
              <small>A/Z derivation is blocked until one intended centerline is selected. Points, polygons, laterals, and unselected lines remain source evidence.</small>
              <select defaultValue="" aria-label="Imported route candidate" onChange={(event) => event.currentTarget.value && stageSelectedImportedRoute(pendingRouteImport, event.currentTarget.value)}>
                <option value="">Select route...</option>
                {pendingRouteImport.routes.filter((route) => route.dalGeometry.length > 1).map((route) => (
                  <option key={route.routeId} value={route.routeId}>{route.name} · {formatRouteMiles(route.routeMiles)} mi · {route.folderPath.join(" / ") || "Root"}</option>
                ))}
              </select>
            </div>
          ) : null}
          {routeImportStatus !== "IDLE" || temporaryImportedRoute ? (
            <div className="commercial-inspector-card temporary-imported-route-card">
              <b>Temporary Imported Route</b>
              <span>
                {routeImportStatus === "PARSING"
                  ? "Parsing selected route file..."
                  : temporaryImportedRoute?.route.name ?? "No temporary route loaded"}
              </span>
              <small>
                {temporaryImportedRoute
                  ? `${temporaryImportedRoute.sourceFileName} / ${formatRouteMiles(temporaryImportedCommercialDraft?.routeMiles ?? temporaryImportedRoute.route.routeMiles)} mi / not saved`
                  : routeImportStatus === "ERROR" ? "Import failed before a temporary route could be staged." : "Waiting for route file."}
              </small>
              {temporaryImportedRoute ? (
                <>
                  <span>State: Temporary Imported Route</span>
                  <span>Estimate: {temporaryImportedCommercialDraft ? money(temporaryImportedCommercialDraft.financialAuthority.constructionCost) : "Pending"}</span>
                  <div className="teralinx-summary-grid">
                    <div><span>Source Type</span><b>{temporaryImportedRoute.importRecord.sourceType}</b></div>
                    <div><span>Source Hash</span><b>{temporaryImportedRoute.importRecord.sourceFileHash?.slice(0, 16) ?? "Missing"}</b></div>
                    <div><span>Route Revision</span><b>{temporaryImportedRoute.endpointAuthority.aSite.routeRevision}</b></div>
                    <div><span>Geometry Hash</span><b>{temporaryImportedRoute.endpointAuthority.aSite.geometryHash.slice(0, 16)}</b></div>
                    <div><span>Start Endpoint</span><b>{temporaryImportedRoute.endpointAuthority.sourceStartCoordinate[1].toFixed(6)}, {temporaryImportedRoute.endpointAuthority.sourceStartCoordinate[0].toFixed(6)}</b></div>
                    <div><span>End Endpoint</span><b>{temporaryImportedRoute.endpointAuthority.sourceEndCoordinate[1].toFixed(6)}, {temporaryImportedRoute.endpointAuthority.sourceEndCoordinate[0].toFixed(6)}</b></div>
                    <div><span>A Relationship</span><b>{importedAEndpointComparison?.relationship ?? "UNRESOLVED"}</b></div>
                    <div><span>Z Relationship</span><b>{importedZEndpointComparison?.relationship ?? "UNRESOLVED"}</b></div>
                  </div>
                  <div className="dal-actions">
                    <button type="button" onClick={handleAcceptImportedStartAsA}>Accept Start as A</button>
                    <button type="button" onClick={handleReverseImportedRouteOrientation}>Reverse A / Z</button>
                    {importedEndpointsNeedConfirmation ? <button type="button" className="primary" onClick={handleConfirmImportedEndpointReplacement}>Confirm Imported A/Z Coordinates</button> : <span className="dal-status">Imported route endpoint orientation accepted.</span>}
                  </div>
                  {(["A", "Z"] as const).map((endpoint) => {
                    const site = endpoint === "A" ? temporaryImportedRoute.endpointAuthority.aSite : temporaryImportedRoute.endpointAuthority.zSite;
                    return (
                      <details key={`imported-endpoint-${endpoint}`}>
                        <summary>{endpoint} Site Enrichment · {site.siteName}</summary>
                        <div className="commercial-command-grid">
                          {(["siteName", "customerSiteId", "address", "city", "state", "facilityType", "notes"] as const).map((field) => (
                            <label key={`${endpoint}-${field}`}>
                              <span>{field.replace(/([A-Z])/g, " $1").replace(/^./, (value) => value.toUpperCase())}</span>
                              <input value={site[field]} onChange={(event) => handleEnrichImportedEndpoint(endpoint, field, event.currentTarget.value)} />
                            </label>
                          ))}
                        </div>
                        <small>Coordinate authority: IMPORTED_ROUTE · {site.coordinate[1].toFixed(6)}, {site.coordinate[0].toFixed(6)}. Enrichment cannot modify coordinates.</small>
                      </details>
                    );
                  })}
                </>
              ) : null}
              <div className="dal-actions">
                <button type="button" className="primary" onClick={() => handleSaveTemporaryImportedRoute()} disabled={!temporaryImportedRoute || importedEndpointsNeedConfirmation}>
                  Save Imported Route
                </button>
                <label className="dal-button secondary commercial-file-action">
                  Replace Imported Route
                  <input
                    type="file"
                    accept=".kmz,.kml,.geojson,.json,.csv"
                    onChange={(event) => {
                      const file = event.currentTarget.files?.[0] ?? null;
                      event.currentTarget.value = "";
                      void handleRouteImportFile(file);
                    }}
                  />
                </label>
                <button type="button" onClick={handleDiscardTemporaryImportedRoute} disabled={!temporaryImportedRoute && routeImportStatus !== "ERROR"}>
                  Discard Imported Route
                </button>
              </div>
            </div>
          ) : null}
          {opportunityScoutCandidate ? (
            <div className="commercial-inspector-card">
              <b>{opportunityScoutCandidate.label}</b>
              <span>{opportunityScoutCandidate.coordinate[1].toFixed(5)}, {opportunityScoutCandidate.coordinate[0].toFixed(5)}</span>
              <small>{opportunityScoutCandidate.source.replaceAll("_", " ")}</small>
            </div>
          ) : null}
          {opportunityScoutSiteDecision ? (
            <div className="commercial-inspector-card">
              <b>{commercialDraftType === "NEW_GRAPH_CORRIDOR" ? "Corridor Advisory" : "Site Decision"}</b>
              <span>{commercialDraftType === "NEW_GRAPH_CORRIDOR" ? "Customer Twin diversity and avoidance context only. No attachment selected." : "Advisory only. Attachment and routing remain separate."}</span>
              <span>Nearest route: {opportunityScoutSiteDecision.nearestExistingCorridor?.label ?? "Pending"}</span>
              <span>Nearest station: {opportunityScoutSiteDecision.nearestStation?.label ?? "Pending"}</span>
              <span>Nearest POP: {opportunityScoutSiteDecision.nearestPOP?.label ?? "Pending"}</span>
              <span>Diversity: {opportunityScoutSiteDecision.diversityScore}</span>
              <span>Confidence: {percentage(opportunityScoutSiteDecision.commercialConfidence)}</span>
            </div>
          ) : null}
          {opportunityAttachmentResolution ? (
            <div className="commercial-inspector-card">
              <b>Attachment Candidates</b>
              <span>{opportunityAttachmentResolution.status.replaceAll("_", " ")}</span>
              {opportunityAttachmentResolution.alternatives.slice(0, 4).map((attachment) => (
                <button
                  key={attachment.id}
                  type="button"
                  className={selectedAttachmentCandidate?.id === attachment.id ? "primary" : "secondary"}
                  onClick={() => handleSelectCommercialAttachment(attachment.id)}
                >
                  {attachment.attachmentType.replaceAll("_", " ")} / {attachment.routeName} / {feet(attachment.distanceFeet)}
                </button>
              ))}
              <button
                type="button"
                onClick={handleGenerateCommercialRoute}
                disabled={commercialRoutingStatus === "ROUTING" || opportunityAttachmentResolution.status !== "READY" || commercialRouteResult?.status === "ROUTED"}
              >
                {commercialRoutingStatus === "ROUTING" ? "Routing..." : "Generate Route"}
              </button>
              <small>{opportunityAttachmentResolution.diagnostics[0]}</small>
            </div>
          ) : opportunityScoutCandidate?.mode === "AZ_BUILDER" && commercialDraftType === "NEW_GRAPH_CORRIDOR" && siteDecisionCanRun(opportunityWorkflowState) ? (
            <div className="commercial-inspector-card">
              <b>New Graph OSRM Corridor</b>
              <span>OSRM routes A to Z directly. Attachment logic is not invoked.</span>
              <button type="button" onClick={handleGenerateCommercialRoute} disabled={commercialRoutingStatus === "ROUTING" || commercialRouteResult?.status === "ROUTED"}>
                {commercialRoutingStatus === "ROUTING" ? "Routing..." : "Generate Corridor Route"}
              </button>
            </div>
          ) : null}
          {commercialRouteResult?.status === "FAILED" ? (
            <div className="commercial-inspector-card">
              <b>OSRM Failed</b>
              <span>{commercialRouteResult.failureReason ?? "Route unavailable"}</span>
              <small>No straight-line corridor, budget, lock, or Commercial Draft was created.</small>
            </div>
          ) : null}
          {commercialRouteResult?.status === "ROUTED" ? (
            <div className="commercial-inspector-card">
              <b>{commercialDraftType === "NEW_GRAPH_CORRIDOR" ? "OSRM Corridor" : "OSRM Lateral"}</b>
              <span>{formatRouteMiles(commercialRouteResult.routeMiles ?? null)} mi from OSRM</span>
              <small>{commercialRouteResult.diagnostics[0]}</small>
            </div>
          ) : null}
          {accountImportedCustomerRoutes.length ? (
            <div className="commercial-inspector-card">
              <b>Customer Design Imports</b>
              <select
                value={selectedImportedCustomerDesignImport && selectedImportedCustomerRoute ? `${selectedImportedCustomerDesignImport.importId}::${selectedImportedCustomerRoute.routeId}` : ""}
                onChange={(event) => handleSelectImportedCustomerRoute(event.currentTarget.value)}
              >
                <option value="">Select customer design...</option>
                {accountImportedCustomerRoutes.map((entry) => (
                  <option key={`${entry.importRecord.importId}-${entry.route.routeId}`} value={`${entry.importRecord.importId}::${entry.route.routeId}`}>
                    {entry.importRecord.sourceFileName} / {entry.route.name}
                  </option>
                ))}
              </select>
              {selectedImportedCustomerRoute ? (
                <>
                  <span>DesignID: {selectedImportedCustomerDesignImport?.designId}</span>
                  <span>{selectedImportedCustomerRoute.designState.replaceAll("_", " ")} / {formatRouteMiles(selectedImportedCustomerRoute.routeMiles)} mi</span>
                  <span>{selectedImportedCustomerRoute.folderPath.join(" / ") || "Root folder"}</span>
                  <span>Library: {selectedImportedCustomerDesignImport?.libraryPath.join(" / ")}</span>
                  {selectedImportedCommercialDraft ? (
                    <>
                      <span>{money(selectedImportedCommercialDraft.financialAuthority.constructionCost)} cost / {money(selectedImportedCommercialDraft.financialAuthority.sellPrice)} sell / GM {percentage(selectedImportedCommercialDraft.financialAuthority.grossMarginPercent)}</span>
                      <span>Cost/mi {money(selectedImportedCommercialDraft.financialAuthority.costPerMile)} / Cost/ft ${selectedImportedCommercialDraft.financialAuthority.costPerFoot.toLocaleString()}</span>
                      <span>Revenue/mi {money(selectedImportedCommercialDraft.financialAuthority.revenuePerMile)} / Revenue/ft ${selectedImportedCommercialDraft.financialAuthority.revenuePerFoot.toLocaleString()}</span>
                      <span>Margin/mi {money(selectedImportedCommercialDraft.financialAuthority.marginPerMile)} / Lifecycle {money(selectedImportedCommercialDraft.financialAuthority.lifecycleRevenue)}</span>
                      {(selectedImportedCommercialDraft.financialValidationWarnings ?? []).map((warning, index) => (
                        <small key={`${selectedImportedCommercialDraft.routeId}-warning-${index}`}>Warning: {warning}</small>
                      ))}
                    </>
                  ) : (
                    <small>Imported route has not been priced in this workspace.</small>
                  )}
                  <button type="button" onClick={handlePriceImportedCustomerRoute} disabled={!selectedImportedCustomerRoute.pricingEligible}>
                    Price Imported Route
                  </button>
                  <button type="button" onClick={handleMakeImportedCommercialDraft} disabled={!selectedImportedCustomerRoute.pricingEligible}>
                    Make Commercial Draft
                  </button>
                  <button type="button" onClick={handleCompareImportedCustomerRoute} disabled={!selectedImportedCustomerRoute.pricingEligible}>
                    Compare
                  </button>
                  {selectedImportedCustomerDesignImport?.lineage.slice(0, 4).map((event) => (
                    <small key={event.lineageEventId}>{event.stage}: {event.relatedId ?? selectedImportedCustomerDesignImport.designId}</small>
                  ))}
                  <small>No ScopeVersion, CertifiedRoute, or production inventory mutation is created from this imported design.</small>
                </>
              ) : null}
            </div>
          ) : null}
          {commercialCorridorDraft ? (
            <>
              <div className="commercial-inspector-card">
                <b>Corridor Summary</b>
                <span>{commercialCorridorDraft.aLabel} to {commercialCorridorDraft.zLabel}</span>
                <span>{formatRouteMiles(commercialCorridorDraft.routeMiles)} mi / {commercialCorridorDraft.routeSegments.length.toLocaleString()} segments / {commercialCorridorDraft.stationCount.toLocaleString()} stations</span>
                <span>{commercialCorridorDraft.ilaCount.toLocaleString()} ILA sites / {commercialCorridorDraft.spliceCaseCount.toLocaleString()} splice cases</span>
                <small>{commercialCorridorDraft.diagnostics[0]}</small>
              </div>
              <div className="commercial-inspector-card">
                <b>Confidence / Unknowns</b>
                <span>DOT / Rail / Water: {unknownQuantityDisplay(commercialCorridorDraft.highwayCrossings)} / {unknownQuantityDisplay(commercialCorridorDraft.railCrossings)} / {unknownQuantityDisplay(commercialCorridorDraft.waterCrossings)}</span>
                <span>Unknown cost impact: {money(commercialCorridorDraft.unknownQuantities.reduce((total, item) => total + item.costImpact, 0))}</span>
                <span>Confidence: {percentage(commercialCorridorDraft.transparentEstimate.confidence.score)} {commercialCorridorDraft.transparentEstimate.confidence.level}</span>
                <span>Construction mix: {commercialCorridorDraft.constructionMix.label}</span>
              </div>
              <div className="commercial-inspector-card">
                <b>Proposal Actions</b>
                <span>{money(commercialCorridorDraft.financialAuthority.constructionCost)} cost / {money(commercialCorridorDraft.financialAuthority.sellPrice)} sell / GM {percentage(commercialCorridorDraft.financialAuthority.grossMarginPercent)}</span>
                <span>Revenue/mi {money(commercialCorridorDraft.financialAuthority.revenuePerMile)} / Margin/mi {money(commercialCorridorDraft.financialAuthority.marginPerMile)}</span>
                {(commercialCorridorDraft.financialValidationWarnings ?? []).map((warning, index) => (
                  <small key={`${commercialCorridorDraft.routeId}-warning-${index}`}>Warning: {warning}</small>
                ))}
                <small>Use Generate Route and Save Revision for governed Commercial Revision changes.</small>
              </div>
            </>
          ) : null}
          {opportunityScoutQuickQuote ? (
            <div className="commercial-inspector-card">
              <b>Extension Quick Quote</b>
              <span>Attachment: {opportunityScoutQuickQuote.selectedAttachment?.routeName ?? "Independent A/Z"}</span>
              <span>Station: {opportunityScoutQuickQuote.selectedAttachment?.stationId ?? "n/a"}</span>
              <span>{formatRouteMiles(opportunityScoutQuickQuote.routeMiles)} mi</span>
              <span>{opportunityScoutQuickQuote.lateralFootage.toLocaleString()} ft routed footage</span>
              <span>{money(opportunityScoutQuickQuote.budgetCost)} budget</span>
              <span>{money(opportunityScoutQuickQuote.nrc)} NRC / {money(opportunityScoutQuickQuote.mrc)} MRC</span>
              <span>{opportunityScoutQuickQuote.civilMix.label}</span>
              <small>Commercial Change Sets replace legacy site locks.</small>
            </div>
          ) : null}
          {commercialDraftValidation.length ? (
            <div className="commercial-inspector-card">
              <b>{commercialDraftType === "NEW_GRAPH_CORRIDOR" ? "Corridor Validation" : "Extension Validation"}</b>
              {commercialDraftValidation.map(([label, passed]) => (
                <span key={label}>{passed ? "PASS" : "PENDING"} - {label}</span>
              ))}
            </div>
          ) : null}
          {activeCommercialDraftNetworks.length ? (
            <div className="commercial-inspector-card">
              <b>Proposal Builder</b>
              <span>{draftTypeLabel(commercialDraftType)} draft is active.</span>
              {commercialDraftType === "NEW_GRAPH_CORRIDOR" && commercialCorridorDraft ? (
                <>
                  <span>{formatRouteMiles(commercialCorridorDraft.routeMiles)} mi corridor / {commercialCorridorDraft.routeSegments.length.toLocaleString()} segments</span>
                  <span>{money(commercialCorridorDraft.financialAuthority.constructionCost)} cost / {money(commercialCorridorDraft.financialAuthority.sellPrice)} sell</span>
                  <span>{commercialCorridorDraft.ilaCount.toLocaleString()} ILA sites / {commercialCorridorDraft.transparentEstimate.auditTrail.length.toLocaleString()} audit entries</span>
                </>
              ) : opportunityScoutQuickQuote ? (
                <>
                  <span>{opportunityScoutQuickQuote.selectedAttachment?.routeName ?? "Attachment pending"} / {opportunityScoutQuickQuote.selectedAttachment?.stationId ?? "station n/a"}</span>
                  <span>{opportunityScoutQuickQuote.lateralFootage.toLocaleString()} ft lateral / {money(opportunityScoutQuickQuote.nrc)} NRC / {money(opportunityScoutQuickQuote.mrc)} MRC</span>
                </>
              ) : (
                <span>{money(selectedPricingSummary.reconciliation.budgetCost)} budget / {money(selectedPricingSummary.reconciliation.sellPriceIru)} sell</span>
              )}
              <button type="button" onClick={() => setActiveView("proposal")}>Open Proposal Builder</button>
            </div>
          ) : null}
          {activeCommercialDraftNetworks.length || accountCustomerDrafts.length || accountCustomerReviewStatus !== "NOT_STARTED" ? (
            <div className="commercial-inspector-card">
              <b>Customer Review</b>
              <span>{accountCustomerReviewStatus.replaceAll("_", " ")}</span>
              <button type="button" onClick={handleStartSharedReview}>Start Customer Review</button>
              <small>Acceptance is completed by an authorized customer in Customer View.</small>
            </div>
          ) : null}
          {accountAcceptedProposal ? (
            <div className="commercial-inspector-card">
              <b>Engineering Handoff</b>
              <span>{accountAcceptedProposal.acceptedProposalId}</span>
              <small>Use the Commercial Engineering Handoff card above the map for the single governed handoff action.</small>
            </div>
          ) : null}
        </aside>
        <div className="commercial-map-action-bar" aria-label="Commercial map actions">
          <span>{activeRouteLengthLabel} / {estimateStatusLabel} / {proposalStatusLabel}</span>
        </div>
      </section>

      {false ? (
        <>

      <section className="dal-panel commercial-account-panel">
        <div className="dal-panel-title-row">
          <h3>{selectedAccount.name}</h3>
          <span className="dal-badge pass">Account context</span>
        </div>
        <div className="teralinx-summary-grid">
          <div><span>Account Type</span><b>{selectedAccount.accountType}</b></div>
          <div><span>Status</span><b>{selectedAccount.status}</b></div>
          <div><span>Sales Owner</span><b>{selectedAccount.salesOwner}</b></div>
          <div><span>Engineering Contact</span><b>{selectedAccount.primaryEngineeringContact}</b></div>
          <div><span>Procurement Contact</span><b>{selectedAccount.procurementContact}</b></div>
          <div><span>Commercial Engagement</span><b>{selectedAccount.commercialEngagements[0]}</b></div>
          <div><span>Data Isolation</span><b>{selectedAccount.name} only</b></div>
          <div><span>Authority Boundary</span><b>No ScopeVersion</b></div>
        </div>
        <div className="dal-status">{selectedAccount.notes}</div>
      </section>

      <section className="dal-panel commercial-workflow-panel">
        <div className="dal-panel-title-row">
          <h3>Commercial Planning Workflow</h3>
          <span className="dal-badge warning">Pre-Kernel</span>
        </div>
        <div className="commercial-workflow-tabs" role="tablist" aria-label="Commercial planning workflow">
          {COMMERCIAL_WORKFLOW.map((step) => (
            <button
              key={step.id}
              type="button"
              className={activeView === step.id ? "commercial-workflow-tab active" : "commercial-workflow-tab"}
              onClick={() => setActiveView(step.id)}
            >
              <b>{step.label}</b>
              <span>{step.summary}</span>
            </button>
          ))}
        </div>
      </section>

      {false && activeView === "account" ? (
        <section className="dal-panel commercial-account-grid">
          <div>
            <div className="dal-panel-title-row">
              <h3>CRM</h3>
              <span className="dal-badge pass">Lightweight</span>
            </div>
            <div className="teralinx-summary-grid">
              <div><span>Contacts</span><b>{selectedAccount.contacts.length}</b></div>
              <div><span>Active Opportunities</span><b>{selectedAccount.activeOpportunities.length}</b></div>
              <div><span>Customer Inventory</span><b>{selectedAccount.existingNetworks.length}</b></div>
              <div><span>Proposal History</span><b>{selectedAccount.proposalHistory.length}</b></div>
            </div>
          </div>
          <SummaryList items={selectedAccount.contacts} />
          <SummaryList items={selectedAccount.activeOpportunities} />
        </section>
      ) : null}

      {false && activeView === "engagement" ? (
        <section className="dal-panel">
          <div className="dal-panel-title-row">
            <h3>Commercial Engagement</h3>
            <span className="dal-badge warning">Sales-owned</span>
          </div>
          <div className="teralinx-summary-grid">
            <div><span>Customer</span><b>{selectedAccount.name}</b></div>
            <div><span>Opportunity</span><b>{selectedAccount.activeOpportunities[0]}</b></div>
            <div><span>Documents</span><b>Customer supplied</b></div>
            <div><span>Review Status</span><b>{googleFixtureIsActive ? "Commercial review" : "Not loaded"}</b></div>
            <div><span>Engineering Status</span><b>Not transferred</b></div>
            <div><span>Attachments</span><b>Account scoped</b></div>
          </div>
          <div className="dal-status">Commercial Engagement remains the commercial record until customer acceptance. Engineering assumes ownership after acceptance.</div>
        </section>
      ) : null}

      {false && activeView === "networks" ? (
        <section className="dal-panel">
          <div className="dal-panel-title-row">
            <h3>Customer Inventory</h3>
            <span className="dal-badge pass">{selectedAccount.name} only</span>
          </div>
          <div className="teralinx-summary-grid">
            <div><span>Existing Networks</span><b>{accountNetworkCounts.CUSTOMER_INVENTORY}</b></div>
            <div><span>Customer Proposed Networks</span><b>{accountNetworkCounts.CUSTOMER_PROPOSED}</b></div>
            <div><span>Commercial Drafts</span><b>{accountNetworkCounts.COMMERCIAL_DRAFT}</b></div>
            <div><span>Customer Drafts</span><b>{accountNetworkCounts.CUSTOMER_DRAFT}</b></div>
            <div><span>Accepted Proposals</span><b>{accountNetworkCounts.ACCEPTED_PROPOSAL}</b></div>
            <div><span>Future GIS Connections</span><b>{accountNetworkCounts.FUTURE_GIS}</b></div>
            <div><span>Customer Twin</span><b>{accountCustomerTwin?.customerTwinId ?? customerInventoryLoadStatus}</b></div>
            <div><span>Twin Routes</span><b>{accountRenderableCustomerTwin.routes.length.toLocaleString()}</b></div>
            <div><span>Twin Route Miles</span><b>{Number((accountCustomerNetworkGraph?.summary.routeMiles ?? 0).toFixed(2)).toLocaleString()}</b></div>
            <div><span>Twin Objects</span><b>{accountRenderableCustomerTwin.objects.length.toLocaleString()}</b></div>
            <div><span>Twin Stations</span><b>{accountRenderableCustomerTwin.stations.length.toLocaleString()}</b></div>
            <div><span>Source Files</span><b>{accountCustomerNetworkGraph?.summary.sourceFiles.length.toLocaleString() ?? "0"}</b></div>
            <div><span>Last Synchronized</span><b>{accountCustomerNetworkGraph?.summary.lastSynchronized ? new Date(accountCustomerNetworkGraph?.summary.lastSynchronized ?? "").toLocaleString() : customerInventoryLoadStatus}</b></div>
            <div><span>Visibility</span><b>{accountNetworkInventory.filter((network) => resolveNetworkLayerState(network, networkLayerStates).visible).length} shown</b></div>
            <div><span>Active References</span><b>{accountNetworkInventory.filter((network) => resolveNetworkLayerState(network, networkLayerStates).activeReference).length}</b></div>
            <div><span>Diversity Constraints</span><b>{activeDiversityConstraintNetworks.length.toLocaleString()}</b></div>
          </div>
          <div className="dal-actions">
            <button type="button" onClick={() => setInventoryRefreshNonce((nonce) => nonce + 1)}>Refresh Inventory</button>
            <button type="button" onClick={() => setInventoryRefreshNonce((nonce) => nonce + 1)}>Start New Session</button>
            <button type="button" onClick={() => setInventoryRefreshNonce((nonce) => nonce + 1)}>Import New Inventory</button>
            <button type="button" onClick={() => setInventoryRefreshNonce((nonce) => nonce + 1)}>Apply Customer GIS Update</button>
            <span className="dal-status">Inventory is parsed once and frozen for this planning session. Future live API updates should ask before applying to the current session.</span>
          </div>
          {accountCustomerNetworkGraph ? (
            <div className="dal-status">
              Customer Twin baseline: {accountCustomerTwin?.customerTwinId ?? accountCustomerNetworkGraph?.graphId ?? "No Twin"}. KMZ/KML remains provenance; map, inventory query, and Site Decision inputs consume renderable Twin state.
            </div>
          ) : null}
          <CommercialWorkingSetPanel
            customerInventoryCount={activeCustomerInventoryNetworks.length}
            salesDraftActive={activeCommercialDraftNetworks.length > 0}
            customerDraftActive={accountCustomerDrafts.length > 0}
            sharedReviewActive={accountCustomerReviewStatus === "IN_REVIEW"}
            acceptedProposalActive={Boolean(accountAcceptedProposal)}
            onCreateSalesDraft={handleCreateSalesDraft}
            onLoadSavedProposal={handleLoadSavedProposal}
            onLoadCustomerDraft={handleLoadCustomerDraft}
            onStartSharedReview={handleStartSharedReview}
          />
          <OpportunityScoutPanel
            accountName={selectedAccount.name}
            mode={opportunityScoutMode}
            address={opportunityScoutAddress}
            lat={opportunityScoutLat}
            lng={opportunityScoutLng}
            azOrigin={opportunityScoutAzOrigin}
            azDestination={opportunityScoutAzDestination}
            selectedInventoryNetworks={activeCustomerInventoryNetworks}
            candidate={opportunityScoutCandidate}
            siteDecision={opportunityScoutSiteDecision}
            attachmentResolution={opportunityAttachmentResolution}
            selectedAttachmentId={selectedAttachmentCandidate?.id ?? null}
            routeResult={commercialRouteResult}
            routing={commercialRoutingStatus === "ROUTING"}
            quickQuote={opportunityScoutQuickQuote}
            onSelectMode={setOpportunityScoutMode}
            onAddressChange={setOpportunityScoutAddress}
            onLatChange={setOpportunityScoutLat}
            onLngChange={setOpportunityScoutLng}
            onAzOriginChange={setOpportunityScoutAzOrigin}
            onAzDestinationChange={setOpportunityScoutAzDestination}
            onRunAddress={handleRunAddressScout}
            onRunLatLng={handleRunLatLngScout}
            onRunAzBuilder={handleRunAzBuilderScout}
            onSelectAttachment={handleSelectCommercialAttachment}
            onGenerateRoute={handleGenerateCommercialRoute}
            onLockCandidate={handleLockScoutCandidate}
            onDeleteCandidate={handleDeleteScoutCandidate}
          />
          <CommercialMapLayerManagerPanel
            layers={commercialMapLayers}
            onToggleSourceNetworkVisibility={(networkId) => updateNetworkLayerState(networkId, "visible")}
          />
          {inventoryReferenceGraph ? (
            <ProposedNetworkMapPanel
              graph={inventoryReferenceGraph!}
              selected={inventoryMapSelection}
              onSelect={setInventoryMapSelection}
              customerTwinState={accountRenderableCustomerTwin}
              commercialMapLayers={commercialMapLayers}
              commercialOpportunityOverlay={commercialOpportunityOverlay}
              mapMinHeight={520}
              mapTitle="Unified Commercial Map"
              mapBadgeLabel="Inventory context / Scout overlay"
              onMapCoordinateClick={handleScoutMapCoordinate}
              redline={{
                mode: "REVIEW",
                presentationMode: "SALES",
              }}
            />
          ) : null}
          <OpportunityBrowserPanel
            query={opportunityBrowserQuery}
            results={opportunityBrowserResults}
            onQueryChange={setOpportunityBrowserQuery}
            onSelectResult={handleOpenOpportunityBrowserResult}
          />
          <InventoryImportAdapterPanel account={selectedAccount} />
          <CommercialNetworksPanel
            networks={accountNetworkInventory}
            layerStates={networkLayerStates}
            onToggleVisibility={(networkId) => updateNetworkLayerState(networkId, "visible")}
            onToggleLock={(networkId) => updateNetworkLayerState(networkId, "locked")}
            onToggleActiveReference={(networkId) => updateNetworkLayerState(networkId, "activeReference")}
            onToggleDiversityConstraint={(networkId) => updateNetworkLayerState(networkId, "diversityConstraint")}
          />
          <ProposalExtensionWorkflowPanel account={selectedAccount} />
          <details className="commercial-network-section">
            <summary>
              <span>Inventory Parser Diagnostics</span>
              <b>{customerInventoryDiagnostics.length.toLocaleString()}</b>
            </summary>
            <div className="dal-list">
              {customerInventoryDiagnostics.length ? customerInventoryDiagnostics.map((diagnostic) => (
                <div className="dal-list-row" key={diagnostic}>
                  <b>{diagnostic}</b>
                  <span>Account scoped</span>
                </div>
              )) : <div className="dal-status">No parser diagnostics yet.</div>}
            </div>
          </details>
          <div className="dal-status">
            Customer Inventory loads before proposal work. Commercial Drafts are overlays and can be deleted without touching inventory. No layer here creates a ScopeVersion or mutates authoritative inventory.
          </div>
        </section>
      ) : null}

      {false && activeView === "scout" ? (
        <section className="dal-panel commercial-scout-workspace">
          <div className="dal-panel-title-row">
            <h3>Opportunity Scout</h3>
            <span className="dal-badge pass">{selectedAccount.name} Customer Twin</span>
          </div>
          <OpportunityScoutPanel
            accountName={selectedAccount.name}
            mode={opportunityScoutMode}
            address={opportunityScoutAddress}
            lat={opportunityScoutLat}
            lng={opportunityScoutLng}
            azOrigin={opportunityScoutAzOrigin}
            azDestination={opportunityScoutAzDestination}
            selectedInventoryNetworks={activeCustomerInventoryNetworks}
            candidate={opportunityScoutCandidate}
            siteDecision={opportunityScoutSiteDecision}
            attachmentResolution={opportunityAttachmentResolution}
            selectedAttachmentId={selectedAttachmentCandidate?.id ?? null}
            routeResult={commercialRouteResult}
            routing={commercialRoutingStatus === "ROUTING"}
            quickQuote={opportunityScoutQuickQuote}
            onSelectMode={setOpportunityScoutMode}
            onAddressChange={setOpportunityScoutAddress}
            onLatChange={setOpportunityScoutLat}
            onLngChange={setOpportunityScoutLng}
            onAzOriginChange={setOpportunityScoutAzOrigin}
            onAzDestinationChange={setOpportunityScoutAzDestination}
            onRunAddress={handleRunAddressScout}
            onRunLatLng={handleRunLatLngScout}
            onRunAzBuilder={handleRunAzBuilderScout}
            onSelectAttachment={handleSelectCommercialAttachment}
            onGenerateRoute={handleGenerateCommercialRoute}
            onLockCandidate={handleLockScoutCandidate}
            onDeleteCandidate={handleDeleteScoutCandidate}
          />
          {inventoryReferenceGraph ? (
            <ProposedNetworkMapPanel
              graph={inventoryReferenceGraph!}
              selected={inventoryMapSelection}
              onSelect={setInventoryMapSelection}
              customerTwinState={accountRenderableCustomerTwin}
              commercialMapLayers={commercialMapLayers}
              commercialOpportunityOverlay={commercialOpportunityOverlay}
              mapMinHeight={560}
              mapTitle="Unified Commercial Map"
              mapBadgeLabel="Click candidate / Customer Twin context"
              onMapCoordinateClick={handleScoutMapCoordinate}
              redline={{
                mode: "REVIEW",
                presentationMode: "SALES",
              }}
            />
          ) : null}
          <OpportunityBrowserPanel
            query={opportunityBrowserQuery}
            results={opportunityBrowserResults}
            onQueryChange={setOpportunityBrowserQuery}
            onSelectResult={handleOpenOpportunityBrowserResult}
          />
          <div className="dal-status">
            Opportunity Scout invokes Site Decision and Quick Quote as advisory services. It does not browse raw KMZ/KML, mutate Customer Inventory, or create ScopeVersion authority.
          </div>
        </section>
      ) : null}

      {false && activeView === "assistant" ? (
          <DesignModePanel
            activeMode={activeDesignMode}
            selectedInventoryNetworks={activeCustomerInventoryNetworks}
            selectedCustomerProposedNetworks={activeCustomerProposedNetworks}
            selectedDraftNetworks={activeCommercialDraftNetworks}
            diversityConstraintNetworks={activeDiversityConstraintNetworks}
            customerTwinState={accountRenderableCustomerTwin}
            onSelectMode={launchCommercialDesignMode}
          />
      ) : null}

      {false && activeView === "analysis" ? (
        <OpportunityAnalysisLaunchPanel
          accountName={selectedAccount.name}
          selectedInventoryNetworks={activeCustomerInventoryNetworks}
          selectedCustomerProposedNetworks={activeCustomerProposedNetworks}
          selectedDraftNetworks={activeCommercialDraftNetworks}
          diversityConstraintNetworks={activeDiversityConstraintNetworks}
          customerTwinState={accountRenderableCustomerTwin}
          launchedAt={opportunityAnalysisLaunchedAt}
          onLaunch={launchOpportunityAnalysis}
        />
      ) : null}

      {false && activeView === "proposal" && !googleFixtureIsActive ? <EmptyAccountProposal account={selectedAccount} /> : null}

      {false && activeView === "proposal" && googleFixtureIsActive && !activeCommercialDraftNetworks.length ? (
        <section className="dal-panel">
          <div className="dal-panel-title-row">
            <h3>Sales Commercial Draft</h3>
            <span className="dal-badge warning">Not in working set</span>
          </div>
          <div className="dal-status">
            Proposal Builder is waiting for an explicit Sales Draft. Customer Inventory is loaded and frozen, but no commercial corridor, saved proposal, previous proposal, or customer draft has been activated.
          </div>
          <CommercialWorkingSetPanel
            customerInventoryCount={activeCustomerInventoryNetworks.length}
            salesDraftActive={false}
            customerDraftActive={accountCustomerDrafts.length > 0}
            sharedReviewActive={accountCustomerReviewStatus === "IN_REVIEW"}
            acceptedProposalActive={Boolean(accountAcceptedProposal)}
            onCreateSalesDraft={handleCreateSalesDraft}
            onLoadSavedProposal={handleLoadSavedProposal}
            onLoadCustomerDraft={handleLoadCustomerDraft}
            onStartSharedReview={handleStartSharedReview}
          />
          <CommercialMapLayerManagerPanel
            layers={commercialMapLayers}
            onToggleSourceNetworkVisibility={(networkId) => updateNetworkLayerState(networkId, "visible")}
          />
        </section>
      ) : null}

      {false && activeView === "proposal" && googleFixtureIsActive && activeCommercialDraftNetworks.length ? (
        <>
          <DesignModePanel
            activeMode={activeDesignMode}
            selectedInventoryNetworks={activeCustomerInventoryNetworks}
            selectedCustomerProposedNetworks={activeCustomerProposedNetworks}
            selectedDraftNetworks={activeCommercialDraftNetworks}
            diversityConstraintNetworks={activeDiversityConstraintNetworks}
            customerTwinState={accountRenderableCustomerTwin}
            onSelectMode={setActiveDesignMode}
          />

          <ExistingFiberInventoryQueryPanel
            accountName={selectedAccount.name}
            selectedInventoryNetworks={activeCustomerInventoryNetworks}
            customerTwinState={accountRenderableCustomerTwin}
            selectedDraftNetworks={activeCommercialDraftNetworks}
            selectedRouteLabels={selectedRoutePlans.map(routeLabel)}
            lastRunAt={existingFiberQueryLastRunAt}
            excludedAccounts={excludedInventoryAccountNames}
            onRunQuery={runExistingFiberInventoryQuery}
          />

          <section className="dal-panel">
            <div className="dal-panel-title-row">
              <h3>Pricing Scope</h3>
              <span className="dal-badge pass">Commercial context</span>
            </div>
            <div className="dal-actions">
              <select
                value={selectedScope.scopeId}
                onChange={(event) => setSelectedScopeId(event.currentTarget.value)}
                aria-label="Pricing scope selector"
              >
                {pricingScopes.map((scope) => (
                  <option key={scope.scopeId} value={scope.scopeId}>{scope.label}</option>
                ))}
              </select>
              <span className="dal-status">{selectedPricingSummary.reconciliation.combinedAwardAdjustmentStatus}</span>
            </div>
          </section>

          <LiveCommercialSessionPanel
            session={activeLiveSession}
            selectedScopeLabel={selectedScope.label}
            pricingSummary={selectedPricingSummary}
            recalculating={commercialRecalculationPending}
            onSaveRevision={handleSaveLiveProposalSnapshot}
          />

          <EnrichmentPalettePanel
            selected={activeLiveSession?.enrichmentSelections ?? []}
            onToggle={toggleEnrichmentSelection}
          />

          {commercialRecalculationPending ? (
            <CommercialRecalculationNotice />
          ) : (
            <>
              <GoogleBidExecutiveSummaryPanel preview={preview} pricingSummary={selectedPricingSummary} />
              <GoogleBidCommercialPreviewPanel
                pricingSummary={selectedPricingSummary}
                assumptionStates={assumptionStates}
                selectedAssumptionStateId={selectedAssumptionState.stateId}
                onSelectAssumptionState={setSelectedAssumptionStateId}
                onConstructionStrategyChange={updateConstructionStrategy}
                onRockPercentChange={updateRockPercent}
              />
            </>
          )}

          <GoogleBidRouteReviewPanel
            bidPlan={commercialBidPlan}
            selectedScopeId={selectedScope.scopeId}
            pricingSummary={selectedPricingSummary}
            onRoutePlanRevised={handleRoutePlanRevised}
            onCommercialRecalculationChange={handleCommercialRecalculationChange}
            onLiveDraftRoutePlanRecalculated={handleLiveDraftRoutePlanRecalculated}
            onLiveDraftRecalculationError={handleLiveDraftRecalculationError}
            onSaveLiveProposalSnapshot={handleSaveLiveProposalSnapshot}
            onDiscardLiveProposalDraft={handleDiscardLiveProposalDraft}
            liveDraftDirty={Boolean(activeLiveSession?.dirty)}
            liveDraftRecalculationStatus={activeLiveSession?.recalculationStatus ?? "CURRENT"}
            customerTwinState={accountRenderableCustomerTwin}
            commercialMapLayers={commercialMapLayers}
          />
          {commercialRecalculationPending ? null : (
            <>
              <GoogleBidVendorResponsePreviewPanel preview={preview} pricingSummary={selectedPricingSummary} />
              <SegmentValueAnalysisPanel pricingSummary={selectedPricingSummary} />
              <GoogleBidSupportingInformationPanel bidPlan={scopedBidPlan} preview={preview} pricingSummary={selectedPricingSummary} />
            </>
          )}
        </>
      ) : null}

      {false && activeView === "review" ? (
        <section className="dal-panel">
          <div className="dal-panel-title-row">
            <h3>Customer Review</h3>
            <span className={`dal-badge ${accountCustomerReviewStatus === "ACCEPTED" ? "pass" : accountCustomerReviewStatus === "REJECTED" ? "fail" : "warning"}`}>
              {accountCustomerReviewStatus.replaceAll("_", " ")}
            </span>
          </div>
          <div className="teralinx-summary-grid">
            <div><span>Review Proposal</span><b>Enabled by engagement</b></div>
            <div><span>Customer Revision</span><b>Route file evidence</b></div>
            <div><span>Comments</span><b>Proposal revisions only</b></div>
            <div><span>Approval</span><b>Customer acceptance ends Sales</b></div>
            <div><span>Active Route Source</span><b>{googleFixtureIsActive ? sourceLabel(activeLiveSession?.routeSource ?? "ORIGINAL") : "Not loaded"}</b></div>
            <div><span>Unsaved Changes</span><b>{googleFixtureIsActive && activeLiveSession?.dirty ? "Yes" : "No"}</b></div>
            <div><span>Budget Cost</span><b>{googleFixtureIsActive ? money(selectedPricingSummary.reconciliation.budgetCost) : "Not loaded"}</b></div>
            <div><span>Sell Price</span><b>{googleFixtureIsActive ? money(selectedPricingSummary.reconciliation.sellPriceIru) : "Not loaded"}</b></div>
            <div><span>Proposal Snapshots</span><b>{accountSnapshots.length.toLocaleString()}</b></div>
            <div><span>Customer Drafts</span><b>{accountCustomerDrafts.length.toLocaleString()}</b></div>
          </div>
          <div className="dal-actions">
            <button type="button" disabled={!googleFixtureIsActive} onClick={() => handleCreateCustomerDraft("KMZ")}>Stage KMZ Draft</button>
            <button type="button" disabled={!googleFixtureIsActive} onClick={() => handleCreateCustomerDraft("KML")}>Stage KML Draft</button>
            <button type="button" disabled={!googleFixtureIsActive} onClick={() => handleCreateCustomerDraft("CSV")}>Stage CSV Draft</button>
            <button type="button" disabled={!googleFixtureIsActive} onClick={handleAcceptProposal}>Accept Proposal</button>
            <button type="button" disabled={!googleFixtureIsActive} onClick={handleRejectProposal}>Request Changes</button>
          </div>
          <details>
            <summary>Proposal Snapshots - {accountSnapshots.length.toLocaleString()}</summary>
            <div className="dal-list">
              {accountSnapshots.length ? accountSnapshots.map((snapshot) => (
                <div className="dal-list-row teralinx-list-row" key={snapshot.snapshotId}>
                  <b>{snapshot.name}</b>
                  <span>{sourceLabel(snapshot.routeSource)}</span>
                  <small>{new Date(snapshot.timestamp).toLocaleString()} by {snapshot.author}. Budget {money(snapshot.selectedScopePricingSummary.reconciliation.budgetCost)}. Sell {money(snapshot.selectedScopePricingSummary.reconciliation.sellPriceIru)}.</small>
                </div>
              )) : <div className="dal-status">No proposal snapshots saved yet. Snapshots are optional commercial milestones.</div>}
            </div>
          </details>
          <details>
            <summary>Customer Draft Routes - {accountCustomerDrafts.length.toLocaleString()}</summary>
            <div className="dal-list">
              {accountCustomerDrafts.length ? accountCustomerDrafts.map((draft) => (
                <div className="dal-list-row teralinx-list-row" key={draft.customerDraftId}>
                  <b>{draft.source} Draft</b>
                  <span>{draft.status.replaceAll("_", " ")}</span>
                  <small>{new Date(draft.createdAt).toLocaleString()}. {draft.note} No inventory mutation.</small>
                </div>
              )) : <div className="dal-status">No customer draft routes staged. Customer uploads create commercial draft records only.</div>}
            </div>
          </details>
          <SummaryList items={selectedAccount.customerReviewHistory} />
        </section>
      ) : null}

      {false && activeView === "handoff" ? (
        <section className="dal-panel">
          <div className="dal-panel-title-row">
            <h3>Engineering Handoff</h3>
            <span className={`dal-badge ${accountAcceptedProposal ? "pass" : "fail"}`}>{accountAcceptedProposal ? "Accepted Proposal Ready" : "Kernel boundary"}</span>
          </div>
          <div className="teralinx-summary-grid">
            <div><span>Trigger</span><b>Customer Acceptance</b></div>
            <div><span>Sales Record</span><b>Read-only after acceptance</b></div>
            <div><span>Engineering Review</span><b>Next owner</b></div>
            <div><span>ScopeVersion</span><b>After signed Service Order</b></div>
            <div><span>Service Order</span><b>After customer acceptance</b></div>
            <div><span>Execution</span><b>After ScopeVersion</b></div>
            <div><span>Accepted Commercial Source</span><b>{googleFixtureIsActive ? sourceLabel(activeLiveSession?.routeSource ?? "ORIGINAL") : "Not loaded"}</b></div>
            <div><span>Route Miles</span><b>{googleFixtureIsActive ? Number(selectedPricingSummary.reconciliation.routeMiles.toFixed(2)).toLocaleString() : "Not loaded"}</b></div>
            <div><span>Budget Cost</span><b>{googleFixtureIsActive ? money(selectedPricingSummary.reconciliation.budgetCost) : "Not loaded"}</b></div>
            <div><span>Sell Price</span><b>{googleFixtureIsActive ? money(selectedPricingSummary.reconciliation.sellPriceIru) : "Not loaded"}</b></div>
            <div><span>AcceptedProposal ID</span><b>{accountAcceptedProposal?.acceptedProposalId ?? "Not accepted"}</b></div>
            <div><span>Owner</span><b>{accountAcceptedProposal ? "Engineering" : "Sales"}</b></div>
            <div><span>Snapshots Included</span><b>{accountAcceptedProposal?.proposalSnapshots.length.toLocaleString() ?? accountSnapshots.length.toLocaleString()}</b></div>
            <div><span>Customer Drafts Included</span><b>{accountAcceptedProposal?.customerUploadedRoutes.length.toLocaleString() ?? accountCustomerDrafts.length.toLocaleString()}</b></div>
          </div>
          <details>
            <summary>AcceptedProposal Object - {accountAcceptedProposal ? "Ready for Engineering Review" : "Pending customer acceptance"}</summary>
            {accountAcceptedProposal ? (
              <div className="dal-list">
                <div className="dal-list-row teralinx-list-row">
                  <b>{accountAcceptedProposal?.acceptedProposalId ?? "Accepted proposal pending"}</b>
                  <span>{accountAcceptedProposal?.owner ?? "Sales"}</span>
                  <small>
                    Accepted {accountAcceptedProposal?.acceptedAt ? new Date(accountAcceptedProposal?.acceptedAt ?? "").toLocaleString() : "pending"}. Geometry vertices {accountAcceptedProposal?.acceptedRouteGeometry.length.toLocaleString() ?? "0"}.
                    Engineering review activated. No ScopeVersion or Service Order created by Sales.
                  </small>
                </div>
              </div>
            ) : (
              <div className="dal-status">Customer acceptance freezes the live commercial session into an AcceptedProposal. Sales still cannot create ScopeVersion, SOF, Marketplace execution, Control, Field, Twin, or OI authority.</div>
            )}
          </details>
          <SummaryList items={selectedAccount.engineeringHistory} />
        </section>
      ) : null}
        </>
      ) : null}
    </section>
  );
}
