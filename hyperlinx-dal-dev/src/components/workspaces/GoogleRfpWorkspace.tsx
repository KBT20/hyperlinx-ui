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
  DEFAULT_TRANSPARENT_ESTIMATE_CONTROLS,
  type TransparentEstimateControls,
  type TransparentEstimateFinancialControls,
  type TransparentEstimateHumanAuditEntry,
  type TransparentEstimateProductionControls,
  type TransparentUnknownQuantity,
} from "../../commercial/TransparentEstimatingEngine";
import type { IlaPlanningControls } from "../../commercial/IlaPlanningEngine";
import { authorityModeConfidence, type ConstraintValue, type ConstraintAuthorityMode } from "../../commercial/ConstraintAuthority";
import {
  COMMERCIAL_ROUTE_REPOSITORY_ENDPOINT,
  advanceRuntimeLifecycleBridge,
  approveProposalRuntimeObject,
  assignDraftIofPackageEngineer,
  archiveProposalRuntimeObject,
  certifyDraftIofPackage,
  certifyIofUnit,
  commentProposalRuntimeObject,
  createDraftIofPackageFromProposal,
  createProposalRevision,
  duplicateProposalRuntimeObject,
  loadRuntimeRehydration,
  listEngineeringReviewQueue,
  openEngineeringPackage,
  openDraftIofPackageForCertification,
  requestProposalChanges,
  returnDraftIofPackageToCommercial,
  saveCommercialDraftIofPackage,
  submitDraftIofPackageToEngineering,
  submitProposalToCustomer,
  uploadProposalEvidence,
  type DraftIofPackageRuntime,
  type EngineeringReviewQueueItem,
  type ProposalRuntimeObject,
  type RuntimeRehydrationState,
  type RuntimeLifecycleBridgeState,
} from "../../api/teralinxRuntime";
import {
  evaluateProposalAuthorityState,
  logProposalAuthorityStateHydration,
  proposalCustomerReviewStateFromRepository,
  proposalRepositoryReportsCommercialApproved,
} from "../../kernel/ProposalAuthorityState";
import { useDALState } from "../../dal/DALState";
import { useTeralinxAuth } from "../../identity/TeralinxAuth";
import type { GovernedAccount, GovernedContact, RuntimeHistoryEvent } from "../../api/accountLibrary";
import type { CustomerDesignImport, ImportedCustomerRoute } from "../../translate/CustomerDesignImport";
import { scheduleDraftIofPackageAssembly, schedulePointToPointLongHaulDoctrineAssembly } from "../../runtime/ConstitutionalAssemblyScheduler";
import {
  CustomerRepository,
  CustomerTwinRepository,
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
import ProposedNetworkMapPanel, { type CommercialIlaMapStation, type ProposedNetworkSelection } from "./proposednetwork/ProposedNetworkMapPanel";
import type { ProposedGraph } from "../../proposedGraph/ProposedGraph";
import type { DALCoordinate } from "../../types/dal";
import { hashRouteGeometry } from "../../routing/ConstraintAnalysisEngine";
import {
  POINT_TO_POINT_LONG_HAUL_DOCTRINE,
  POINT_TO_POINT_LONG_HAUL_PRODUCT_ID,
} from "../../products/pointToPointLongHaulDoctrine";
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
  productDoctrineVersion?: string;
  doctrineVersion?: string;
  customerSnapshot?: Record<string, unknown>;
  customerTwinReference?: string;
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

type Layer1ProductOption = {
  productId: string;
  productName: string;
  productFamily: string;
  defaultTermYears: number;
  protected: boolean;
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

const LAYER_1_PRODUCT_OPTIONS: Layer1ProductOption[] = [
  { productId: POINT_TO_POINT_LONG_HAUL_PRODUCT_ID, productName: POINT_TO_POINT_PRODUCT_NAME, productFamily: "Transport Infrastructure", defaultTermYears: 20, protected: false },
];

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
  {
    accountId: "fiberlight",
    name: "FiberLight",
    accountType: "Carrier",
    status: "Prospect",
    salesOwner: "Ryan",
    primaryEngineeringContact: "TBD",
    procurementContact: "TBD",
    contacts: ["Carrier sales contact", "Network planning contact"],
    activeOpportunities: ["No active DAL commercial engagement loaded"],
    existingNetworks: ["No customer networks loaded in this workspace session"],
    operationalObjects: ["Isolated from Google assets"],
    commercialEngagements: ["None open"],
    proposalHistory: ["None loaded"],
    customerReviewHistory: ["None loaded"],
    engineeringHistory: ["None loaded"],
    notes: "Account data is isolated. Selecting FiberLight does not display Google corridors, proposals, or assets.",
  },
  {
    accountId: "verizon",
    name: "Verizon",
    accountType: "Carrier",
    status: "Prospect",
    salesOwner: "Ryan",
    primaryEngineeringContact: "TBD",
    procurementContact: "TBD",
    contacts: ["Carrier account contact"],
    activeOpportunities: ["No active DAL commercial engagement loaded"],
    existingNetworks: ["No customer networks loaded in this workspace session"],
    operationalObjects: ["Isolated from Google assets"],
    commercialEngagements: ["None open"],
    proposalHistory: ["None loaded"],
    customerReviewHistory: ["None loaded"],
    engineeringHistory: ["None loaded"],
    notes: "Account context gates downstream commercial and map data.",
  },
  {
    accountId: "crown-castle",
    name: "Crown Castle",
    accountType: "Infrastructure provider",
    status: "Prospect",
    salesOwner: "Ryan",
    primaryEngineeringContact: "TBD",
    procurementContact: "TBD",
    contacts: ["Infrastructure account contact"],
    activeOpportunities: ["No active DAL commercial engagement loaded"],
    existingNetworks: ["No customer networks loaded in this workspace session"],
    operationalObjects: ["Isolated from Google assets"],
    commercialEngagements: ["None open"],
    proposalHistory: ["None loaded"],
    customerReviewHistory: ["None loaded"],
    engineeringHistory: ["None loaded"],
    notes: "Future imported networks will remain account-owned assets, not proposals.",
  },
  {
    accountId: "municipality",
    name: "Municipality",
    accountType: "Public sector",
    status: "Prospect",
    salesOwner: "Ryan",
    primaryEngineeringContact: "TBD",
    procurementContact: "TBD",
    contacts: ["Municipal broadband lead"],
    activeOpportunities: ["No active DAL commercial engagement loaded"],
    existingNetworks: ["No customer networks loaded in this workspace session"],
    operationalObjects: ["Isolated from Google assets"],
    commercialEngagements: ["None open"],
    proposalHistory: ["None loaded"],
    customerReviewHistory: ["None loaded"],
    engineeringHistory: ["None loaded"],
    notes: "Municipal network imports will enter as customer assets with authority state.",
  },
];

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
  {
    networkId: "NET-FIBERLIGHT-EXISTING",
    accountId: "fiberlight",
    name: "FiberLight existing backbone reference",
    networkCategory: "FUTURE_GIS",
    authorityState: "EXISTING_NETWORK",
    importSource: "GIS_API",
    sourceAssetName: "Future FiberLight connector",
    source: "Account-owned reference placeholder",
    importDate: "Not loaded",
    routeMiles: null,
    status: "Account isolated placeholder",
    lastUpdated: "Not loaded",
    geometryStatus: "Hidden outside FiberLight",
    objectCount: 0,
    revisionCount: 0,
    confidence: "Pending import",
    visibleByDefault: true,
    lockedByDefault: true,
    activeReferenceByDefault: true,
    noScopeVersionCreation: true,
    noInventoryAuthorityMutation: true,
  },
  {
    networkId: "NET-VERIZON-REFERENCE",
    accountId: "verizon",
    name: "Verizon customer network placeholder",
    networkCategory: "FUTURE_GIS",
    authorityState: "EXISTING_NETWORK",
    importSource: "GIS_API",
    sourceAssetName: "Future Verizon connector",
    source: "Account-owned reference placeholder",
    importDate: "Not loaded",
    routeMiles: null,
    status: "Account isolated placeholder",
    lastUpdated: "Not loaded",
    geometryStatus: "Hidden outside Verizon",
    objectCount: 0,
    revisionCount: 0,
    confidence: "Pending import",
    visibleByDefault: true,
    lockedByDefault: true,
    activeReferenceByDefault: true,
    noScopeVersionCreation: true,
    noInventoryAuthorityMutation: true,
  },
  {
    networkId: "NET-CROWN-CASTLE-REFERENCE",
    accountId: "crown-castle",
    name: "Crown Castle infrastructure reference",
    networkCategory: "FUTURE_GIS",
    authorityState: "EXISTING_NETWORK",
    importSource: "GIS_API",
    sourceAssetName: "Future Crown Castle connector",
    source: "Account-owned reference placeholder",
    importDate: "Not loaded",
    routeMiles: null,
    status: "Account isolated placeholder",
    lastUpdated: "Not loaded",
    geometryStatus: "Hidden outside Crown Castle",
    objectCount: 0,
    revisionCount: 0,
    confidence: "Pending import",
    visibleByDefault: true,
    lockedByDefault: true,
    activeReferenceByDefault: true,
    noScopeVersionCreation: true,
    noInventoryAuthorityMutation: true,
  },
  {
    networkId: "NET-MUNICIPALITY-REFERENCE",
    accountId: "municipality",
    name: "Municipal broadband planning area",
    networkCategory: "FUTURE_GIS",
    authorityState: "IMPORTED_NETWORK",
    importSource: "GeoJSON",
    sourceAssetName: "Future municipal import",
    source: "Account-owned reference placeholder",
    importDate: "Not loaded",
    routeMiles: null,
    status: "Account isolated placeholder",
    lastUpdated: "Not loaded",
    geometryStatus: "Hidden outside Municipality",
    objectCount: 0,
    revisionCount: 0,
    confidence: "Pending import",
    visibleByDefault: true,
    lockedByDefault: true,
    activeReferenceByDefault: true,
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

function commercialRecordIdsForOpportunity(opportunityName: string, revision = 1) {
  const slug = cleanCommercialSlug(opportunityName, "COMMERCIAL-OPPORTUNITY");
  const version = Math.max(1, Math.round(Number(revision) || 1));
  return {
    slug,
    proposalId: `PROP-${slug}-v${version}`,
    workbookId: `WORKBOOK-${slug}-v${version}`,
    proposalPreviewId: `PROPOSAL-PREVIEW-${slug}-v${version}`,
    serviceOrderPreviewId: `SO-PREVIEW-${slug}-v${version}`,
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
  onSaveSnapshot,
}: {
  session: LiveCommercialSession | null;
  selectedScopeLabel: string;
  pricingSummary: SelectedScopePricingSummary;
  recalculating: boolean;
  onSaveSnapshot: () => void;
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
        <button type="button" onClick={onSaveSnapshot} disabled={!session?.dirty || recalculating}>
          Save Snapshot
        </button>
        <span className="dal-status">Save Snapshot preserves the already-current commercial state. It does not calculate or create authority.</span>
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
  const currentUserName = session?.user.name ?? "Teralinx";
  const currentUserId = session?.user.userId ?? "teralinx-user-system";
  const currentWorkspaceId = session?.user.workspaceId ?? session?.workspace?.workspaceId ?? "workspace-teralinx-system";
  const currentOrganizationId = session?.user.organizationId ?? session?.workspace?.organizationId ?? "org-teralinx";
  const [bidPlan, setBidPlan] = useState(googleHeliumBidPlanFixture);
  const defaultAssumptionState = useMemo(() => createDefaultBudgetAssumptionState(), []);
  const [assumptionStates, setAssumptionStates] = useState<BudgetAssumptionState[]>([defaultAssumptionState]);
  const [selectedAssumptionStateId, setSelectedAssumptionStateId] = useState(defaultAssumptionState.stateId);
  const [transparentEstimateControls, setTransparentEstimateControls] = useState<TransparentEstimateControls>(() => defaultTransparentEstimateControls());
  const [commercialWorkbookOpenSections, setCommercialWorkbookOpenSections] = useState<Set<string>>(() => new Set(["proposal-summary"]));
  const [transparentEstimateRecalculatedAt, setTransparentEstimateRecalculatedAt] = useState<string | null>(null);
  const [liveCommercialSession, setLiveCommercialSession] = useState<LiveCommercialSession | null>(null);
  const [selectedScopeId, setSelectedScopeId] = useState<string>(() => googleHeliumBidPlanFixture.routePlans[0]?.routeRequirement.routeRequirementId ?? "COMBINED_AWARD");
  const [inventoryMapSelection, setInventoryMapSelection] = useState<ProposedNetworkSelection>(null);
  const verificationStatus = "PENDING" as const;
  const [commercialRecalculationPending, setCommercialRecalculationPending] = useState(false);
  const [proposalSnapshots, setProposalSnapshots] = useState<LiveProposalSnapshot[]>([]);
  const [proposalRuntimeRecords, setProposalRuntimeRecords] = useState<ProposalRuntimeObject[]>([]);
  const [proposalRuntimeNotice, setProposalRuntimeNotice] = useState("Proposal Runtime Library is waiting for a governed proposal object.");
  const [proposalRuntimeActionPending, setProposalRuntimeActionPending] = useState(false);
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
  const [selectedAccountId, setSelectedAccountId] = useState("google");
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
  const [opportunityNameDraft, setOpportunityNameDraft] = useState("Google DFW Route");
  const [opportunityNotice, setOpportunityNotice] = useState("No opportunity loaded. New Opportunity starts with Customer Twin only.");
  const [opportunityRestoreState, setOpportunityRestoreState] = useState<OpportunityRestoreState>(() => createOpportunityRestoreState());
  const opportunityRestoreRunRef = useRef(0);
  const [generatedRouteRepositorySnapshot, setGeneratedRouteRepositorySnapshot] = useState<CommercialRouteRepositoryRecord | null>(null);
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
  const [routeImportStatus, setRouteImportStatus] = useState<RouteImportStatus>("IDLE");
  const [newOpportunityDialogOpen, setNewOpportunityDialogOpen] = useState(false);
  const [existingFiberQueryLastRunAt, setExistingFiberQueryLastRunAt] = useState<string | null>(null);
  const [opportunityAnalysisLaunchedAt, setOpportunityAnalysisLaunchedAt] = useState<string | null>(null);
  const [customerNetworkGraph, setCustomerNetworkGraph] = useState<CustomerNetworkGraph | null>(null);
  const [customerInventoryLoadStatus, setCustomerInventoryLoadStatus] = useState<CustomerInventoryParsedStatus>("PENDING");
  const [customerInventoryDiagnostics, setCustomerInventoryDiagnostics] = useState<string[]>([]);
  const [existingInventoryImportStatus, setExistingInventoryImportStatus] = useState<"IDLE" | "PARSING" | "COMMITTING" | "READY" | "ERROR">("IDLE");
  const [existingInventoryImportNotice, setExistingInventoryImportNotice] = useState("Use Import Existing Network to create organization-owned Customer Twin inventory records.");
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
    governedAccounts.forEach((account) => {
      const fallback = byId.get(account.accountId);
      const contacts = governedContacts.filter((contact) => contact.accountId === account.accountId && contact.lifecycleState !== "ARCHIVED");
      byId.set(account.accountId, commercialAccountFromGoverned(account, contacts, fallback));
    });
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [governedAccounts, governedContacts]);
  const selectedAccount =
    accountOptions.find((account) => account.accountId === selectedAccountId) ??
    accountOptions.find((account) => account.accountId === "google") ??
    COMMERCIAL_ACCOUNTS[0];
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
  async function refreshAccountLibrary(nextNotice?: string) {
    const [accounts, contacts, history] = await Promise.all([
      CustomerRepository.listCustomers(),
      CustomerRepository.listContacts(),
      CustomerRepository.listHistory(),
    ]);
    setGovernedAccounts(accounts);
    setGovernedContacts(contacts);
    setRuntimeHistory(history);
    setAccountLibraryLoaded(true);
    if (nextNotice) setAccountNotice(nextNotice);
    else setAccountNotice(`${accounts.length.toLocaleString()} governed Accounts loaded.`);
  }

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    Promise.all([CustomerRepository.listCustomers(), CustomerRepository.listContacts(), CustomerRepository.listHistory()])
      .then(([accounts, contacts, history]) => {
        if (cancelled) return;
        setGovernedAccounts(accounts);
        setGovernedContacts(contacts);
        setRuntimeHistory(history);
        setAccountLibraryLoaded(true);
        setAccountNotice(`${accounts.length.toLocaleString()} governed Accounts loaded.`);
        if (!accounts.some((account) => account.accountId === selectedAccountId) && accounts[0]?.accountId) {
          setSelectedAccountId(accounts[0].accountId);
        }
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
    if (!session) return;
    let cancelled = false;
    loadRuntimeRehydration(session)
      .then((rehydration) => {
        if (cancelled) return;
        setRuntimeRehydrationState(rehydration);
        const workspaceSession = rehydration.workspaceSession;
        if (workspaceSession?.accountId) setSelectedAccountId(workspaceSession.accountId);
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
  }, [session?.token]);

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
    const accountId = cleanAccountId(accountDraft.accountId || name);
    if (!name || !accountId) {
      setAccountNotice("Account name is required.");
      return;
    }
    setAccountPersistencePending(true);
    try {
      const existing = governedAccounts.find((account) => account.accountId === accountId);
      const baseAccount = accountEditorMode === "edit" ? (existing ?? selectedGovernedAccount ?? {}) : (existing ?? {});
      const saved = await CustomerRepository.saveCustomer({
        ...baseAccount,
        accountId,
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
      setAccountNotice(`${saved.name} Account saved as governed workspace root.`);
      void recordActivity({
        action: "saved account",
        objectType: "Account",
        objectId: saved.accountId,
        objectName: saved.name,
        customerId: saved.accountId,
        details: "Account persisted to the governed Account Library and mirrored into commercial records.",
      });
      await refreshAccountLibrary(`${saved.name} Account Library record refreshed.`);
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

  useEffect(() => {
    if (activeCommercialOpportunity?.name) {
      setOpportunityNameDraft(activeCommercialOpportunity.name);
    } else {
      setOpportunityNameDraft(`${selectedAccount.name} Opportunity`);
    }
  }, [activeCommercialOpportunity?.opportunityId, selectedAccount.name]);
  const isCustomerParticipant = session?.user.role === "CUSTOMER_PARTICIPANT";
  const canManageProposalRuntime = Boolean(session && can("proposal.manage"));
  const canReviewProposalRuntime = Boolean(session && can("proposal.review"));
  const canReadEngineeringCertification = Boolean(session && (can("workspace.engineering.read") || can("workspace.engineering.write") || can("scopeversion.authority")));
  const canWriteEngineeringCertification = Boolean(session && (can("workspace.engineering.write") || can("scopeversion.authority")));
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
    const azPoints = [
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
    const temporaryRouteGeometry = temporaryImportedCommercialDraft?.geometry?.length
      ? temporaryImportedCommercialDraft.geometry
      : temporaryImportedRoute?.geometry;
    const corridorGeometry = temporaryRouteGeometry?.length
      ? temporaryRouteGeometry
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
  }, [azDestinationLocation, azOriginLocation, commercialCorridorDraft, commercialDraftType, commercialRouteResult?.status, loadedCommercialDraftSnapshot, opportunityAttachmentResolution, opportunityScoutCandidate, opportunityScoutQuickQuote, selectedAttachmentCandidate?.id, selectedImportedCommercialDraft, temporaryImportedCommercialDraft, temporaryImportedRoute]);
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
    let cancelled = false;
    setCommercialLibraryLoaded(false);
    Promise.all([
      OpportunityRepository.listOpportunities<CommercialOpportunityRecord>(session),
      RouteRepository.listRoutes(session).catch((error) => {
        console.warn("Route Repository load failed", error instanceof Error ? error.message : String(error));
        return [] as CommercialRouteRepositoryRecord[];
      }),
    ])
      .then(([records, routes]) => {
        if (cancelled) return;
        setCommercialOpportunities(records.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))));
        setCommercialRouteRepositoryRecords(routes.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))));
        setCommercialLibraryLoaded(true);
      })
      .catch((error) => {
        if (cancelled) return;
        console.warn("Opportunity Library load failed", error instanceof Error ? error.message : String(error));
        setOpportunityNotice(`Opportunity Library unavailable: ${error instanceof Error ? error.message : String(error)}`);
        setCommercialLibraryLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [session?.token]);

  useEffect(() => {
    let cancelled = false;
    ProposalRepository.listProposals<any>(session)
      .then((records) => {
        if (cancelled) return;
        const snapshots = records
          .filter((record) => record?.snapshotId)
          .sort((a, b) => String(b.timestamp ?? b.createdAt).localeCompare(String(a.timestamp ?? a.createdAt)))
          .map(({ proposalRecordId: _proposalRecordId, proposalRecordType: _proposalRecordType, organization: _organization, createdAt: _createdAt, updatedAt: _updatedAt, ...snapshot }) => snapshot as LiveProposalSnapshot);
        const accepted = records
          .filter((record) => record?.acceptedProposalId)
          .sort((a, b) => String(b.acceptedAt ?? b.createdAt).localeCompare(String(a.acceptedAt ?? a.createdAt)))
          .map(({ proposalRecordId: _proposalRecordId, proposalRecordType: _proposalRecordType, organization: _organization, createdAt: _createdAt, updatedAt: _updatedAt, ...proposal }) => proposal as AcceptedProposal);
        records.forEach((record) => {
          if (record?.proposalId || record?.proposalRecordId || record?.acceptedProposalId) {
            logProposalAuthorityStateHydration("Proposal Repository restore:list", record as ProposalRuntimeObject, proposalRuntimeStatusLabel(record?.status));
          }
        });
        setProposalSnapshots(snapshots);
        setAcceptedProposal(accepted[0] ?? null);
        setProposalRuntimeRecords(records.filter((record) => record?.proposalId || record?.objectType === "PROPOSAL" || record?.readiness) as ProposalRuntimeObject[]);
        setProposalRuntimeNotice(records.length ? "Proposal Runtime Library loaded." : "No governed proposal runtime objects are visible in this workspace.");
      })
      .catch((error) => {
        console.warn("Proposal Library load failed", error instanceof Error ? error.message : String(error));
        setProposalRuntimeNotice(`Proposal Runtime Library unavailable: ${error instanceof Error ? error.message : String(error)}`);
      });
    return () => {
      cancelled = true;
    };
  }, [session?.token]);

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
      opportunityId: activeCommercialOpportunityId || activeCommercialOpportunity?.opportunityId || routePlan?.routeRequirement.routeRequirementId || `OPP-${currentCommercialRecordIds.slug}`,
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
    setRuntimeLifecyclePending(true);
    try {
      const result = await advanceRuntimeLifecycleBridge(runtimeLifecycleBridgeInput(trigger, overrides), session);
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

  useEffect(() => {
    if (
      opportunityWorkflowState !== "QUICK_QUOTE_READY" ||
      runtimeLifecycleState ||
      runtimeLifecyclePending ||
      !session ||
      !canManageProposalRuntime
    ) return;
    void handleAdvanceRuntimeLifecycleBridge("QUOTE_READY_FOR_CUSTOMER");
  }, [opportunityWorkflowState, runtimeLifecycleState?.lifecycleId, runtimeLifecyclePending, session?.token, canManageProposalRuntime]);

  async function saveCurrentRuntimeProposal(status: ProposalRuntimeObject["status"] = "DRAFT") {
    if (!canManageProposalRuntime) {
      setProposalRuntimeNotice("Only commercial proposal authority may create or update Commercial Proposals.");
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
      const proposalId = activeProposalRuntime?.proposalId ?? currentCommercialRecordIds.proposalId;
      const proposalRecord = {
        ...(activeProposalRuntime ?? {}),
        proposalId,
        proposalRecordId: proposalId,
        proposalRecordType: "PROPOSAL_RUNTIME_OBJECT",
        proposalNumber: activeProposalRuntime?.proposalNumber ?? proposalId,
        customerId: customerIdForAccount(selectedAccount.accountId),
        accountId: selectedAccount.accountId,
        opportunityId: activeCommercialOpportunityId || activeCommercialOpportunity?.opportunityId || routePlan.routeRequirement.routeRequirementId,
        organizationId: currentOrganizationId,
        workspaceId: currentWorkspaceId,
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
          activeCommercialOpportunity?.runtimeObjectId,
          selectedImportedCustomerDesignImport?.designImportId,
          ...activeCommercialDraftNetworks.map((network) => network.networkId),
        ].filter(Boolean),
        runtimeRelationshipIds: [
          activeCommercialOpportunity?.opportunityId ? `DERIVED_FROM:${activeCommercialOpportunity.opportunityId}` : "",
          routePlan.routeRequirement.routeRequirementId ? `PROPOSES_ROUTE:${routePlan.routeRequirement.routeRequirementId}` : "",
        ].filter(Boolean),
        runtimeEvidenceIds: activeProposalRuntime?.runtimeEvidenceIds ?? [],
        existingInventoryReferences: activeExistingReferenceNetworkIds,
        customerDesignReferences: selectedImportedCustomerDesignImport ? [selectedImportedCustomerDesignImport.designId] : [],
        customerTwinReference: accountCustomerTwin?.customerTwinId ?? `CUSTOMER-TWIN-${selectedAccount.accountId}`,
        geometryReferences: [routePlan.routeRequirement.routeRequirementId, ...geometry.map((coordinate, index) => `${proposalId}:geometry:${index}:${coordinate.join(",")}`)].slice(0, 20),
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
      };
      const saved = await ProposalRepository.saveProposal<any>(proposalRecord, session) as ProposalRuntimeObject;
      upsertProposalRuntimeRecord(saved);
      setProposalRuntimeNotice(`${saved.proposalNumber} saved as ${proposalRuntimeStatusLabel(saved.status)}.`);
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

  async function handleSubmitRuntimeProposalToCustomer() {
    const proposal = activeProposalRuntime ?? await saveCurrentRuntimeProposal("DRAFT");
    if (!proposal) return;
    setProposalRuntimeActionPending(true);
    try {
      const saved = await submitProposalToCustomer(proposal.proposalId, {
        assignedCustomerUsers: ["google-participant-001"],
        proposalRecipientContactIds,
        customerReviewContactIds,
        approvalAuthorityContactIds,
        customerContactEmails,
      }, session);
      upsertProposalRuntimeRecord(saved);
      setProposalRuntimeNotice(`${saved.proposalNumber} submitted to customer review.`);
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
      const saved = await createProposalRevision(activeProposalRuntime.proposalId, {
        reason,
        proposal: {
          pricingSummary: selectedPricingSummary.reconciliation as unknown as Record<string, unknown>,
          marginSummary: {
            grossMarginDollars: selectedPricingSummary.reconciliation.grossMarginDollars,
            grossMarginPercent: selectedPricingSummary.reconciliation.grossMarginPercent,
          },
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
    const draftSource = commercialDraftIofPackage ?? commercialDraftIofPackagePreview;
    if (!draftSource) {
      setEngineeringCertificationNotice("Commercial Draft IOF Package JSON is required before Engineering handoff.");
      return;
    }
    setEngineeringCertificationPending(true);
    try {
      const draft = await saveCommercialDraftIofPackage(draftSource, session);
      setCommercialDraftIofPackage(draft);
      setActiveDraftIofPackage(draft);
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
    const draftSource = commercialDraftIofPackage ?? commercialDraftIofPackagePreview;
    if (!draftSource) {
      setProposalRuntimeNotice("Commercial package assembly needs proposal, design, pricing, and validation inputs.");
      return;
    }
    setEngineeringCertificationPending(true);
    try {
      const draft = await saveCommercialDraftIofPackage(draftSource, session);
      setCommercialDraftIofPackage(draft);
      setActiveDraftIofPackage(draft);
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
    const draftSource = commercialDraftIofPackage ?? commercialDraftIofPackagePreview ?? activeDraftIofPackage;
    if (!draftSource) {
      setProposalRuntimeNotice("Commercial Review needs a Draft IOF Package before Engineering submission.");
      return;
    }
    if (!commercialDashboardHandoffReady) {
      setProposalRuntimeNotice(`Engineering submission blocked: ${commercialDashboardHandoffMissing.join("; ")}`);
      return;
    }
    if (draftSource.commercialRevisionLocked || ["SUBMITTED_TO_ENGINEERING", "UNDER_ENGINEERING_REVIEW", "CERTIFIED"].includes(String(draftSource.status ?? ""))) {
      setProposalRuntimeNotice(`${draftSource.packageId} is already locked for Engineering custody.`);
      return;
    }
    setEngineeringCertificationPending(true);
    try {
      const result = await submitDraftIofPackageToEngineering(draftSource.packageId, undefined, session);
      const verifiedEngineeringPackage = await openEngineeringPackage(result.engineeringPackage.engineeringPackageId, session);
      if (verifiedEngineeringPackage.engineeringPackageId !== result.engineeringPackage.engineeringPackageId) {
        throw new Error("Engineering Repository verification failed after submit.");
      }
      const draft = {
        ...draftSource,
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
      await refreshEngineeringReviewQueue(`${result.engineeringPackage.engineeringPackageId} created in the Engineering Repository.`);
      setProposalRuntimeNotice(`${draft.packageId} submitted to Engineering as ${result.engineeringPackage.engineeringPackageId}. Commercial status is SUBMITTED_TO_ENGINEERING.`);
      setEngineeringCertificationNotice(`${result.engineeringPackage.engineeringPackageId} is awaiting Engineering Package restore. ScopeVersion remains blocked.`);
    } catch (error) {
      setProposalRuntimeNotice(`Engineering submission failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
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
    setCustomerInventoryLoadStatus("PARSING");
    setCustomerInventoryDiagnostics([]);
    setCustomerNetworkGraph(null);
    void CustomerTwinRepository.loadCustomerTwin(selectedAccount.accountId).then((result) => {
      if (cancelled) return;
      setCustomerNetworkGraph(result.graph);
      setCustomerInventoryLoadStatus(result.status);
      setCustomerInventoryDiagnostics(result.diagnostics);
    }).catch((error) => {
      if (cancelled) return;
      setCustomerNetworkGraph(null);
      setCustomerInventoryLoadStatus("ERROR");
      setCustomerInventoryDiagnostics([`Customer inventory load failed: ${error instanceof Error ? error.message : String(error)}`]);
    });
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

    try {
      setExistingInventoryImportStatus("PARSING");
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
      });
      setExistingInventoryImportStatus("READY");
      setExistingInventoryImportNotice(
        `Committed ${response.counts.runtimeObjects.toLocaleString()} inventory record(s), ${response.counts.relationships.toLocaleString()} relationship(s), and ${response.counts.evidence.toLocaleString()} evidence record(s).`,
      );
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
      setExistingInventoryImportStatus("ERROR");
      setExistingInventoryImportNotice(`Existing Inventory import failed: ${message}`);
    }
  }

  function commitAssumptionState(label: string, patch: Partial<Pick<BudgetAssumptionState, "civilMix" | "borePricing" | "slack" | "waste" | "splicing">>) {
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
    commitAssumptionState(`Construction Strategy ${label} ${Math.round(value)}%`, {
      civilMix: rebalanceConstructionStrategy(selectedAssumptionState.civilMix, changed, value),
    });
  }

  function updateRockPercent(value: number) {
    const rockBorePercent = Math.max(0, Math.min(100, Math.round(value)));
    commitAssumptionState(`Geology rock ${rockBorePercent}%`, {
      borePricing: {
        ...selectedAssumptionState.borePricing,
        rockBorePercent,
        dirtBorePercent: 100 - rockBorePercent,
      },
    });
  }

  function updateTransparentEstimateDuration(days: number) {
    setTransparentEstimateControls((prev) => ({
      ...prev,
      targetDurationDays: Math.max(1, Math.round(days)),
    }));
  }

  function updateTransparentProduction(key: keyof TransparentEstimateProductionControls, value: number | null) {
    setTransparentEstimateControls((prev) => ({
      ...prev,
      production: {
        ...prev.production,
        [key]: value === null ? null : Math.max(0, Math.round(value)),
      },
    }));
  }

  function updateTransparentFinancial(key: keyof TransparentEstimateFinancialControls, value: number) {
    setTransparentEstimateControls((prev) => ({
      ...prev,
      financial: {
        ...prev.financial,
        [key]: Math.max(0, Number(value.toFixed(2))),
      },
    }));
  }

  function updateTransparentIlaPlanning(next: IlaPlanningControls) {
    setTransparentEstimateControls((prev) => ({
      ...prev,
      ilaPlanning: {
        ...next,
        stationOverrides: { ...(next.stationOverrides ?? {}) },
      },
    }));
  }

  function selectTransparentIlaStation(stationId: string) {
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
    console.info("[CIP-014D Route Persistence]", entry);
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
    const importedEvidence = args.sourceFiles.length
      ? args.sourceFiles.map((file, index) => evidenceFromSourceFile(file, args.opportunityId, index))
      : [generatedRouteEvidence(routeRepositoryId, routeId, geometryHash, args.timestamp)];
    return {
      routeRepositoryId,
      routeSnapshotId: `${routeRepositoryId}-v${activeCommercialOpportunity?.version ?? 1}`,
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
        label: args.commercialDraft?.aLabel ?? `${routeName} A`,
        coordinate: first,
      },
      zLocation: {
        label: args.commercialDraft?.zLabel ?? `${routeName} Z`,
        coordinate: last,
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
    const existing = options.duplicate ? null : activeCommercialOpportunity;
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
    const recordIds = commercialRecordIdsForOpportunity(opportunityName, nextVersion);
    const opportunityId = existing?.opportunityId ?? pendingGeneratedRouteSnapshot?.opportunityId ?? `OPP-${recordIds.slug}-${Date.now()}`;
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
          proposalId: recordIds.proposalId,
          revision: `v${nextVersion}`,
          updatedAt: timestamp,
        }
      : {
          proposalPreviewId: recordIds.proposalPreviewId,
          templateId: TemplateRepository.proposalTemplateId(),
          proposalId: recordIds.proposalId,
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
          sourceProposalId: recordIds.proposalId,
          updatedAt: timestamp,
        }
      : {
          serviceOrderPreviewId: recordIds.serviceOrderPreviewId,
          templateId: TemplateRepository.serviceOrderTemplateId(),
          sourceOpportunityId: opportunityId,
          sourceProposalId: recordIds.proposalId,
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
    const revisionHistory = RevisionRepository.appendRevision(
      { revisionHistory: (existing?.revisionHistory ?? []) as Array<Record<string, unknown>> },
      {
        revision: `v${nextVersion}`,
        event: options.duplicate ? "SAVE_AS" : existing ? "SAVE" : "CREATE",
        opportunityId,
        opportunityName,
        proposalId: recordIds.proposalId,
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
      productDoctrineVersion: selectedProductDoctrine?.doctrineVersion,
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
      routeRepositoryId: routeRepositoryRef?.routeRepositoryId,
      routeRepositoryRef,
      routeRepositorySnapshot,
      routeName: routeRepositoryRef?.routeName ?? commercialDraft?.routeId ?? sourceRoute?.name ?? currentDraftLabel,
      routeGeometry: routeRepositorySnapshot?.commercialGeometry ?? routeGeometry,
      routeFeet,
      routeMiles,
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
      importedEvidenceReferences: routeRepositorySnapshot?.importedEvidence ?? [],
      restoreSnapshotVersion: "CIP-014C",
      commercialSnapshot: {
        snapshotVersion: "CIP-014C",
        opportunityId,
        routeRepositoryId: routeRepositoryRef?.routeRepositoryId,
        customerTwinReference: accountCustomerTwin?.customerTwinId ?? `CUSTOMER-TWIN-${selectedAccount.accountId}`,
        productId: selectedProductOption.productId,
        productName: selectedProductOption.productName,
        doctrineVersion: selectedProductDoctrine?.doctrineVersion,
        estimate: estimateSnapshot,
        workbook: workbookSnapshot,
        proposalPreview: proposalPreviewSnapshot,
        serviceOrderPreview: serviceOrderPreviewSnapshot,
        commercialOverrides,
        constructionMix: constructionMixSnapshot,
        risks: riskSnapshot,
        attachments: attachmentMetadata,
        importedEvidenceReferences: routeRepositorySnapshot?.importedEvidence ?? [],
        updatedAt: timestamp,
      },
      proposalId: recordIds.proposalId,
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
    };
    try {
      appendRoutePersistenceAudit("Save Opportunity", "START", {
        message: "Saving Opportunity...",
        opportunityId: sharedRecord.opportunityId,
        routeRepositoryId: sharedRecord.routeRepositoryId ?? sharedRecord.routeRepositoryRef?.routeRepositoryId ?? sharedRecord.routeRepositorySnapshot?.routeRepositoryId ?? "",
      });
      let routeSnapshot = sharedRecord.routeRepositorySnapshot ?? generatedRouteRepositorySnapshot ?? null;
      if (routeSnapshot) routeSnapshot = routeSnapshotWithIntegrity(routeSnapshot);
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
      if (record.accountId && record.accountId !== selectedAccountId) setSelectedAccountId(record.accountId);
      setCommercialOpportunities((prev) => [record, ...prev.filter((candidate) => candidate.opportunityId !== record.opportunityId)]);
      setActiveCommercialOpportunityId(record.opportunityId);
      setOpportunityNameDraft(record.name);
      setSelectedScopeId(record.selectedScopeId || selectedScope.scopeId);
      setActiveView(safeRestoreWorkspaceView(record.activeView));
      setCommercialDraftType(safeRestoreDraftType(record.commercialDraftType, validation.draft));
      setActiveDesignMode(validation.draft ? "CUSTOMER_PROPOSAL_REVIEW" : "NEW_INDEPENDENT_GRAPH");
      if (record.liveSession) setLiveCommercialSession(record.liveSession);
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
      setCommercialWorkbookOpenSections((prev) => new Set([...prev, "proposal-summary"]));
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
      const recordIds = commercialRecordIdsForOpportunity(opportunityName, nextVersion);
      const opportunityId = activeCommercialOpportunity?.opportunityId ?? generatedRouteRepositorySnapshot?.opportunityId ?? `OPP-${recordIds.slug}-${Date.now()}`;
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

  function buildPricedImport(record: CustomerDesignImport) {
    const baseRoute = record.routes.find((route) => route.pricingEligible) ?? record.routes[0] ?? null;
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

  async function handleRouteImportFile(file: File | null) {
    if (!file) return;
    resetOpportunityInputState();
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
      const priced = buildPricedImport(imported);
      if (!priced.route) {
        setRouteImportStatus("ERROR");
        setOpportunityNotice(`${file.name} did not contain route geometry that can be priced.`);
        return;
      }
      const geometry = priced.draft?.geometry?.length ? priced.draft.geometry : geometryForImportedRoute(priced.route);
      if (geometry.length < 2) {
        setRouteImportStatus("ERROR");
        setOpportunityNotice(`${file.name} parsed, but no line geometry was available for the map.`);
        return;
      }
      const evidence = sourceFileEvidence(
        file.name,
        "TEMPORARY_IMPORTED_ROUTE",
        `server/data/opportunities/${selectedAccount.accountId}/temporary-imports/${file.name}`,
      );
      setTemporaryImportedRoute({
        importRecord: priced.record,
        route: priced.route,
        draft: priced.draft,
        geometry,
        sourceFileName: file.name,
        evidence,
        importedAt: new Date().toISOString(),
      });
      setRouteImportStatus("READY");
      setOpportunityNotice(`${file.name} loaded as a Temporary Imported Route. Save Imported Route to persist it.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setRouteImportStatus("ERROR");
      setOpportunityNotice(`Customer route import failed: ${message}`);
    }
  }

  async function handleSaveTemporaryImportedRoute(options: { duplicate?: boolean } = {}) {
    if (!temporaryImportedRoute) return;
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

  function handleDiscardTemporaryImportedRoute() {
    const discardedName = temporaryImportedRoute?.sourceFileName ?? "Temporary Imported Route";
    setTemporaryImportedRoute(null);
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
      console.warn("Proposal Library save failed", error instanceof Error ? error.message : String(error));
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
      console.warn("Proposal Library save failed", error instanceof Error ? error.message : String(error));
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
  const selectedProductDoctrine = selectedProductOption.productId === POINT_TO_POINT_LONG_HAUL_PRODUCT_ID ? POINT_TO_POINT_LONG_HAUL_DOCTRINE : null;
  const activeOpportunityDisplayName = customerAwareOpportunityName(
    opportunityNameDraft || activeCommercialOpportunity?.name || selectedImportedCustomerRoute?.name || "Opportunity",
    selectedAccount.name,
  );
  const currentCommercialRecordIds = commercialRecordIdsForOpportunity(activeOpportunityDisplayName, activeCommercialOpportunity?.version ?? 1);
  const activeRouteFeet = activeFinancialDraft?.routeFeet ?? temporaryImportedRoute?.route.routeFeet ?? Math.round(selectedPricingSummary.reconciliation.routeFeet);
  const activeRouteMiles = activeFinancialDraft?.routeMiles ?? temporaryImportedRoute?.route.routeMiles ?? selectedPricingSummary.reconciliation.routeMiles;
  const activeConstructionCost = activeFinancialAuthority?.constructionCost ?? selectedPricingSummary.reconciliation.budgetCost;
  const activeSellPrice = activeFinancialAuthority?.sellPrice ?? selectedPricingSummary.reconciliation.sellPriceIru;
  const activeCostPerFoot = activeFinancialAuthority?.costPerFoot ?? (activeRouteFeet ? activeConstructionCost / activeRouteFeet : 0);
  const activeSellPerFoot = activeFinancialAuthority?.revenuePerFoot ?? (activeRouteFeet ? activeSellPrice / activeRouteFeet : 0);
  const activeSourceFileReference = temporaryImportedRoute?.sourceFileName ?? activeCommercialOpportunity?.sourceRouteFileReference ?? selectedImportedCustomerDesignImport?.sourceFileName ?? "None";
  const activeLocationA = activeFinancialDraft?.aLabel ?? (temporaryImportedRoute ? `${temporaryImportedRoute.route.name} A` : undefined) ?? azOriginLocation?.label ?? selectedRoutePlans[0]?.routeRequirement.bidSegmentName ?? "A location pending";
  const activeLocationZ = activeFinancialDraft?.zLabel ?? (temporaryImportedRoute ? `${temporaryImportedRoute.route.name} Z` : undefined) ?? azDestinationLocation?.label ?? selectedRoutePlans[0]?.routeRequirement.bidSegmentName ?? "Z location pending";
  const productDoctrineAssembly = useMemo(() => {
    if (!selectedProductDoctrine) return null;
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
    const assemblyInput = {
      accountId: selectedAccount.accountId,
      customerId: customerIdForAccount(selectedAccount.accountId),
      aSite,
      zSite,
      osrmRoute: centerline.length > 1 && routeFeet > 0 ? {
        routeId,
        source: "OSRM" as const,
        routeMiles,
        routeFeet,
        distanceMeters: Math.round(routeFeet / 3.28084),
        geometry: centerline,
      } : null,
      routeSegments: activeFinancialDraft?.routeSegments,
      pricingSummary: selectedPricingSummary.reconciliation as unknown as Record<string, unknown>,
      stationIntervalFeet: activeFinancialDraft?.stationIntervalFeet ?? 5280,
    };
    return schedulePointToPointLongHaulDoctrineAssembly(
      `PRODUCT-DOCTRINE-${selectedAccount.accountId}-${routeId}`,
      assemblyInput,
    );
  }, [
    activeFinancialDraft,
    activeLiveSession,
    azDestinationLocation,
    azOriginLocation,
    commercialRouteResult,
    opportunityScoutCandidate,
    opportunityScoutQuickQuote,
    selectedAccount.accountId,
    selectedPricingSummary.reconciliation,
    selectedProductDoctrine,
    selectedRoutePlans,
  ]);
  const commercialDraftIofPackagePreview = useMemo(() => {
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
      noScopeVersionCreation: true,
      noInventoryMutation: true,
    } as Partial<ProposalRuntimeObject> & { proposalId: string; customerId: string; opportunityId?: string };
    return scheduleDraftIofPackageAssembly({
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
    }).value;
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
  const showCommercialDashboardSubmitToEngineering = Boolean(
    canManageProposalRuntime &&
      commercialDashboardHandoffReady &&
      !submittedToEngineering,
  );
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
  const activeConstructionMixLabel = activeFinancialDraft?.constructionMix?.label
    ?? `${selectedAssumptionState.civilMix.plowPercent}% plow / ${selectedAssumptionState.civilMix.hddPercent}% bore / ${selectedAssumptionState.civilMix.openCutPercent}% trench`;
  const defaultProductionControls = DEFAULT_TRANSPARENT_ESTIMATE_CONTROLS.production;
  const defaultFinancialControls = DEFAULT_TRANSPARENT_ESTIMATE_CONTROLS.financial;
  const overrideTimestamp = transparentEstimateControls.humanAuditTrail?.at(-1)?.timestamp
    ?? activeFinancialDraft?.transparentEstimate.humanAuditTrail.at(-1)?.timestamp
    ?? selectedAssumptionState.createdAt
    ?? lastRecalculatedAt
    ?? "Not recorded";
  const commercialDoctrineOverrideRows = [
    ["product.undergroundOnly", "Underground Only", "Enabled", "Enabled", "Doctrine product default"],
    ["civil.dirtPercent", "Dirt Percentage", `${defaultAssumptionState.borePricing.dirtBorePercent}%`, `${selectedAssumptionState.borePricing.dirtBorePercent}%`, selectedAssumptionState.label],
    ["civil.rockPercent", "Rock Percentage", `${defaultAssumptionState.borePricing.rockBorePercent}%`, `${selectedAssumptionState.borePricing.rockBorePercent}%`, selectedAssumptionState.label],
    ["civil.plowPercent", "Plow Mix", `${defaultAssumptionState.civilMix.plowPercent}%`, `${selectedAssumptionState.civilMix.plowPercent}%`, selectedAssumptionState.label],
    ["civil.directionalBorePercent", "Directional Bore Mix", `${defaultAssumptionState.civilMix.hddPercent}%`, `${selectedAssumptionState.civilMix.hddPercent}%`, selectedAssumptionState.label],
    ["civil.openTrenchPercent", "Open Trench Mix", `${defaultAssumptionState.civilMix.openCutPercent}%`, `${selectedAssumptionState.civilMix.openCutPercent}%`, selectedAssumptionState.label],
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
    const revisionRecords = commercialOpportunities.flatMap((opportunity) => (opportunity.revisionHistory ?? []).map((revision, index) => ({
      id: String(revision.revision ?? revision.revisionId ?? `${opportunity.opportunityId}-revision-${index + 1}`),
      relationships: [`opportunity:${opportunity.opportunityId}`],
      storagePath: `${repositoryRecordPath("commercial-opportunities", opportunity.opportunityId)}#/revisionHistory/${index}`,
      json: revision,
    })));
    return [
      { id: "customers", label: "Customer Repository", endpoint: "GET /api/accounts / POST /api/accounts / PUT /api/accounts/:id", storage: "server/data/accounts/*.json", records: customerRecords },
      { id: "customer-twin", label: "Customer Twin Repository", endpoint: "GET /api/runtime/inventories + GET /api/runtime/objects", storage: "server/data/runtime-inventories/*.json + server/data/runtime-objects/*.json", records: twinRecords },
      { id: "opportunities", label: "Opportunity Repository", endpoint: "GET /api/commercial/opportunities / POST /api/commercial/opportunities / POST /api/commercial/opportunities/:id/open", storage: "server/data/commercial-opportunities/*.json", records: opportunityRecords },
      { id: "routes", label: "Route Repository", endpoint: `GET ${COMMERCIAL_ROUTE_REPOSITORY_ENDPOINT} / POST ${COMMERCIAL_ROUTE_REPOSITORY_ENDPOINT} / GET ${COMMERCIAL_ROUTE_REPOSITORY_ENDPOINT}/:id / PUT ${COMMERCIAL_ROUTE_REPOSITORY_ENDPOINT}/:id`, storage: "server/data/commercial-routes/*.json", records: routeRecords },
      { id: "proposals", label: "Proposal Repository", endpoint: "GET /api/proposals / POST /api/proposals / POST /api/proposals/:id/open", storage: "server/data/proposal-drafts/*.json", records: proposalRecords },
      { id: "revisions", label: "Revision Repository", endpoint: "Embedded append-only revisionHistory on Opportunity Repository records", storage: "server/data/commercial-opportunities/*.json#/revisionHistory", records: revisionRecords },
    ];
  }, [accountCustomerTwin?.customerTwinId, accountOptions, activeCommercialOpportunityId, commercialOpportunities, commercialRouteRepositoryRecords, customerNetworkGraph, proposalRuntimeRecords, selectedAccount.accountId]);

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
          <div>
            <b>Opportunity Manager</b>
            <span>Commercial Planning for Point-to-Point Duct & Dark Fiber</span>
          </div>
        </div>
        <div className="commercial-compact-header-grid" aria-label="Commercial workspace status">
          <div><span>Customer</span><b>{selectedAccount.name}</b></div>
          <label>
            <span>Opportunity Name</span>
            <input value={opportunityNameDraft} onChange={(event) => setOpportunityNameDraft(event.currentTarget.value)} aria-label="Opportunity Name" />
          </label>
          <div><span>Opportunity ID</span><b>{activeCommercialOpportunity?.opportunityId ?? "Unsaved"}</b></div>
          <label>
            <span>Product</span>
            <select value={selectedProductId} onChange={(event) => setSelectedProductId(event.currentTarget.value)} aria-label="Product selector">
              {LAYER_1_PRODUCT_OPTIONS.map((product) => (
                <option key={`header-product-${product.productId}`} value={product.productId}>{product.productName}</option>
              ))}
            </select>
          </label>
          <div><span>Commercial Status</span><b>{activeCommercialOpportunity?.status?.replaceAll("_", " ") ?? "Unsaved"}</b></div>
          <div><span>Owner</span><b>{compactOwner}</b></div>
          <div><span>Created</span><b>{activeCommercialOpportunity?.createdAt ? new Date(activeCommercialOpportunity.createdAt).toLocaleDateString() : "Not saved"}</b></div>
          <div><span>Modified</span><b>{activeCommercialOpportunity?.updatedAt ? new Date(activeCommercialOpportunity.updatedAt).toLocaleDateString() : "Not saved"}</b></div>
          <div><span>Estimate Status</span><b>{estimateStatusLabel}</b></div>
          <div><span>Proposal Status</span><b>{proposalStatusLabel}</b></div>
        </div>
        <div className="commercial-compact-actions">
          <button className="dal-button primary" type="button" onClick={handleNewCommercialOpportunity}>
            New Opportunity
          </button>
          <select value="" onChange={(event) => handleOpportunityLibrarySelect(event.currentTarget.value)} aria-label="Open opportunity or library item">
            <option value="">Open Opportunity</option>
            {recentCommercialOpportunities.length ? (
              <optgroup label="Recent">
                {recentCommercialOpportunities.map((record) => (
                  <option key={`recent-${record.opportunityId}`} value={`opportunity::${record.opportunityId}`}>
                    {record.name}
                  </option>
                ))}
              </optgroup>
            ) : null}
            {savedCommercialOpportunities.length ? (
              <optgroup label="Saved">
                {savedCommercialOpportunities.map((record) => (
                  <option key={`saved-${record.opportunityId}`} value={`opportunity::${record.opportunityId}`}>
                    {record.name}
                  </option>
                ))}
              </optgroup>
            ) : null}
            {archivedCommercialOpportunities.length ? (
              <optgroup label="Archived">
                {archivedCommercialOpportunities.map((record) => (
                  <option key={`archived-${record.opportunityId}`} value={`opportunity::${record.opportunityId}`}>
                    {record.name}
                  </option>
                ))}
              </optgroup>
            ) : null}
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
          <select value={selectedAccount.accountId} onChange={(event) => selectAccount(event.currentTarget.value)} aria-label="Active account selector">
            {accountOptions.map((account) => (
              <option key={account.accountId} value={account.accountId}>{account.name}</option>
            ))}
          </select>
          <label className="dal-button secondary commercial-file-action">
            Import Existing Network
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
          <button className="dal-button secondary" type="button" onClick={() => setProposalPreviewOpen(true)}>
            Preview Proposal
          </button>
          <button className="dal-button secondary" type="button" onClick={() => handleCommercialWorkbookSectionToggle("service-order-preview", true)}>
            Service Order Preview
          </button>
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

      <details className="account-workspace-dashboard commercial-intake-drawer" aria-label="Customer Twin account drawer">
        <summary className="commercial-intake-summary">
          <span>Customer Twin</span>
          <b>{selectedAccount.name}</b>
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
          <div><span>Account</span><b>{selectedAccount.name}</b></div>
          <div><span>Account ID</span><b>{selectedAccount.accountId}</b></div>
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
              <span>Account ID</span>
              <input value={accountDraft.accountId} onChange={(event) => updateAccountDraftField("accountId", cleanAccountId(event.currentTarget.value))} placeholder="google" />
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
            <span>Customer</span>
            <b>{selectedAccount.name}</b>
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
            Customer
            <select value={selectedAccountId} onChange={(event) => selectAccount(event.currentTarget.value)} aria-label="Customer selector">
              {COMMERCIAL_ACCOUNTS.map((account) => (
                <option key={account.accountId} value={account.accountId}>{account.name}</option>
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
            <span className="dal-badge warning">Choose build type</span>
          </div>
          <div className="dal-status">What are we building?</div>
          <div className="commercial-command-grid">
            <button type="button" onClick={handleBeginAzOpportunity}>Point-to-Point Product Configurator</button>
            <button type="button" onClick={handleBeginExtendExistingOpportunity} disabled={!accountRenderableCustomerTwin.routes.length && !accountRenderableCustomerTwin.objects.length}>Extend Existing Graph / Lateral</button>
            <button type="button" onClick={handleLoadSavedProposal}>Load Saved Proposal</button>
            <button type="button" onClick={handleLoadCustomerDraft}>Load Customer Draft</button>
          </div>
          <div className="dal-actions">
            <button type="button" className="secondary" onClick={closeNewOpportunityDialog}>Close</button>
            <span className="dal-status">The selected build type determines whether Commercial Planning creates a new corridor graph or a Customer Twin extension.</span>
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
                <div><span>Version</span><b>{activeProposalRuntime ? `v${activeProposalRuntime.version}` : "Not created"}</b></div>
                <div><span>Visibility</span><b>{activeProposalRuntime?.visibility ?? "Private default"}</b></div>
                <div><span>Approval</span><b>{activeProposalRuntime?.approvalState?.replaceAll("_", " ") ?? "Not submitted"}</b></div>
                <div><span>Readiness</span><b>{activeProposalRuntime?.readiness?.status ?? "Blocked"}</b></div>
                <div><span>References</span><b>{activeProposalRuntime?.runtimeObjectIds?.length.toLocaleString() ?? "0"}</b></div>
                <div><span>Evidence</span><b>{activeProposalRuntime?.runtimeEvidenceIds?.length.toLocaleString() ?? "0"}</b></div>
                <div><span>Comments</span><b>{activeProposalRuntime?.comments?.length.toLocaleString() ?? "0"}</b></div>
                <div><span>Next Action</span><b>{activeProposalRuntime?.nextLifecycleAction?.replaceAll("_", " ") ?? "Save proposal"}</b></div>
                <div><span>Engineering Package</span><b>{submittedEngineeringPackageId || "Not submitted"}</b></div>
                <div><span>Engineering Status</span><b>{submittedEngineeringStatus.replaceAll("_", " ")}</b></div>
              </div>
              <div className="dal-list compact">
                {commercialDashboardHandoffChecks.map((check) => (
                  <div className="dal-list-row teralinx-list-row" key={`dashboard-handoff-${check.key}`}>
                    <b>{check.label}</b>
                    <span className={`dal-badge ${check.ok ? "pass" : "warning"}`}>{check.ok ? "Valid" : "Required"}</span>
                    <small>{check.detail}</small>
                  </div>
                ))}
              </div>
              <div className="dal-actions">
                {canManageProposalRuntime ? (
                  <>
                    <button type="button" onClick={handleSaveRuntimeProposal} disabled={proposalRuntimeActionPending}>Save Proposal</button>
                    <button type="button" onClick={handleSubmitRuntimeProposalToCustomer} disabled={proposalRuntimeActionPending}>Submit to Customer</button>
                    <button type="button" onClick={handleCreateRuntimeProposalRevision} disabled={!activeProposalRuntime || proposalRuntimeActionPending}>Create Revision</button>
                    <button type="button" onClick={handleDuplicateRuntimeProposal} disabled={!activeProposalRuntime || proposalRuntimeActionPending}>Duplicate</button>
                    <button type="button" onClick={handleArchiveRuntimeProposal} disabled={!activeProposalRuntime || proposalRuntimeActionPending}>Archive</button>
                    <button type="button" onClick={handleExposeDraftIofSource} disabled={!activeProposalRuntime?.readiness?.canCreateDraftIofPackage || proposalRuntimeActionPending}>Create Draft IOF Source</button>
                    {showCommercialDashboardSubmitToEngineering ? (
                      <button type="button" onClick={handleSubmitCommercialDraftIofToEngineering} disabled={proposalRuntimeActionPending || engineeringCertificationPending}>Submit to Engineering</button>
                    ) : null}
                  </>
                ) : null}
                {submittedEngineeringPackageId ? (
                  <button type="button" onClick={handleOpenSubmittedEngineeringCertification} disabled={engineeringCertificationPending}>
                    Open Engineering Certification
                  </button>
                ) : null}
                {canReviewProposalRuntime ? (
                  <>
                    <button type="button" onClick={handleCustomerRuntimeProposalComment} disabled={!activeProposalRuntime || proposalRuntimeActionPending}>Comment</button>
                    <button type="button" onClick={handleCustomerRuntimeProposalEvidence} disabled={!activeProposalRuntime || proposalRuntimeActionPending}>Upload Evidence</button>
                    <button type="button" onClick={handleCustomerRuntimeProposalChanges} disabled={!activeProposalRuntime || proposalRuntimeActionPending}>Request Changes</button>
                    <button type="button" onClick={handleCustomerRuntimeProposalApproval} disabled={!activeProposalRuntime || proposalRuntimeActionPending}>Approve</button>
                  </>
                ) : null}
                <button type="button" className="secondary" onClick={() => void refreshProposalRuntimeLibrary("Proposal Library refreshed.")} disabled={proposalRuntimeActionPending}>Refresh Proposals</button>
              </div>
              {activeProposalRuntime?.readiness?.blockingIssues?.length ? (
                <div className="dal-status">{activeProposalRuntime.readiness.blockingIssues.join(" ")}</div>
              ) : (
                <div className="dal-status">{proposalRuntimeNotice}</div>
              )}
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
            </section>
          ) : null}
        </details>

        <details
          className="commercial-workbook-section"
          open={isCommercialWorkbookSectionOpen("estimate-detail")}
          onToggle={(event) => handleCommercialWorkbookSectionToggle("estimate-detail", event.currentTarget.open)}
        >
          <summary><b>2. Estimate Detail</b><span>{estimateStatusLabel}</span></summary>
          {isCommercialWorkbookSectionOpen("estimate-detail") && activeFinancialDraft ? (
            <section className="commercial-estimate-authoring-section" aria-label="Commercial estimate authoring">
              <div className="dal-panel-title-row">
                <div>
                  <h3>Estimate Detail</h3>
                  <span>{selectedImportedCustomerRoute ? `${selectedImportedCustomerRoute.name} uses the imported-route pricing authority.` : "Civil mix, production, financial model, authority controls, audit, and calibration."}</span>
                </div>
                <span className="dal-badge warning">{estimateStatusLabel}</span>
              </div>
              <TransparentEstimateExplorer
                estimate={activeFinancialDraft.transparentEstimate}
                controls={transparentEstimateControls}
                lastRecalculatedAt={lastRecalculatedAt}
                vendorPreview={activeFinancialDraft.vendorResponsePreview}
                onTargetDurationChange={updateTransparentEstimateDuration}
                onProductionChange={updateTransparentProduction}
                onFinancialChange={updateTransparentFinancial}
                onConstraintChange={updateTransparentConstraint}
                onCivilMixModeChange={updateTransparentCivilMixMode}
                onIlaPlanningChange={updateTransparentIlaPlanning}
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

        <details className="commercial-workbook-section" onToggle={(event) => handleCommercialWorkbookSectionToggle("construction-mix", event.currentTarget.open)}>
          <summary><b>4. Construction Mix</b><span>{activeConstructionMixLabel}</span></summary>
          {isCommercialWorkbookSectionOpen("construction-mix") ? (
            <div className="teralinx-summary-grid">
              <div><span>Underground Product</span><b>Point-to-Point Duct and Dark Fiber</b></div>
              <div><span>Plow</span><b>{selectedAssumptionState.civilMix.plowPercent}%</b></div>
              <div><span>Directional Bore</span><b>{selectedAssumptionState.civilMix.hddPercent}%</b></div>
              <div><span>Open Trench</span><b>{selectedAssumptionState.civilMix.openCutPercent}%</b></div>
              <div><span>Dirt Bore</span><b>{selectedAssumptionState.borePricing.dirtBorePercent}%</b></div>
              <div><span>Rock Bore</span><b>{selectedAssumptionState.borePricing.rockBorePercent}%</b></div>
              <div><span>ILA Method</span><b>{transparentEstimateControls.ilaPlanning.placementMethod.replaceAll("_", " ")}</b></div>
              <div><span>Commercial Source</span><b>{selectedAssumptionState.source.replaceAll("_", " ")}</b></div>
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
              onSubmitToEngineering={handleSubmitCommercialDraftIofToEngineering}
              onOpenEngineeringCertification={handleOpenSubmittedEngineeringCertification}
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

        <details className="commercial-workbook-section commercial-runtime-diagnostics" onToggle={(event) => handleCommercialWorkbookSectionToggle("runtime-diagnostics", event.currentTarget.open)}>
          <summary><b>14. Runtime / Diagnostics</b><span>Collapsed by default</span></summary>
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
                <small>Customer &gt; Customer Twin &gt; Opportunity &gt; Route Repository &gt; Proposal &gt; Revision.</small>
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
              <button type="button" onClick={() => setInventoryRefreshNonce((nonce) => nonce + 1)}>Reload Twin</button>
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
            <button type="button" onClick={() => setInventoryRefreshNonce((nonce) => nonce + 1)}>Reload Twin</button>
            <span>Existing inventory: {accountNetworkCounts.CUSTOMER_INVENTORY.toLocaleString()} network(s)</span>
            <span>Customer designs: {accountCustomerDesignImports.length.toLocaleString()} request(s)</span>
          </div>
          <div className="dal-actions vertical">
            <button type="button" onClick={() => setInventoryRefreshNonce((nonce) => nonce + 1)}>Refresh Twin</button>
            <button type="button" onClick={() => setInventoryRefreshNonce((nonce) => nonce + 1)}>Reload Customer Inventory</button>
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
            commercialIlaStations={(activeFinancialDraft?.transparentEstimate.ilaPlan.stationObjects ?? []).map((station): CommercialIlaMapStation => ({
              stationId: station.stationId,
              label: station.label,
              station: station.station,
              milepost: station.milepost,
              gps: station.gps,
              coordinate: station.coordinate,
              facilityType: station.facilityType,
              totalCost: station.totalCost,
            }))}
            selectedCommercialIlaStationId={transparentEstimateControls.ilaPlanning.selectedStationId}
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
          <div className="dal-panel-title-row commercial-route-inspector-title">
            <h3>Route</h3>
            <span className="dal-badge warning">{opportunityWorkflowLabel(opportunityWorkflowState)}</span>
          </div>
          {inventoryMapSelection ? (
            <div className="commercial-inspector-card">
              <b>{inventoryMapSelection.type.replaceAll("_", " ").toUpperCase()}</b>
              <span>
                {inventoryMapSelection.type === "node"
                  ? inventoryMapSelection.value.name
                  : inventoryMapSelection.type === "edge"
                    ? (inventoryMapSelection.value.segmentId ?? inventoryMapSelection.value.id)
                    : inventoryMapSelection.type === "station"
                      ? inventoryMapSelection.value.stationLabel
                      : inventoryMapSelection.value.objectType.replaceAll("_", " ")}
              </span>
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
                </>
              ) : null}
              <div className="dal-actions">
                <button type="button" className="primary" onClick={() => handleSaveTemporaryImportedRoute()} disabled={!temporaryImportedRoute}>
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
                <button type="button" onClick={handleLockScoutCandidate} disabled={opportunityScoutCandidate?.lockedIntoCommercialDraft}>Activate Corridor Draft</button>
                <button type="button" onClick={handleSaveCommercialDraftSnapshot}>Save Snapshot</button>
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
              <button type="button" onClick={handleLockScoutCandidate} disabled={opportunityScoutCandidate?.lockedIntoCommercialDraft}>Lock Site</button>
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
              <button type="button" onClick={handleSaveCommercialDraftSnapshot} disabled={!commercialCorridorDraft && !opportunityScoutQuickQuote && !activeLiveSession?.dirty}>Save Snapshot</button>
            </div>
          ) : null}
          {activeCommercialDraftNetworks.length || accountCustomerDrafts.length || accountCustomerReviewStatus !== "NOT_STARTED" ? (
            <div className="commercial-inspector-card">
              <b>Customer Review</b>
              <span>{accountCustomerReviewStatus.replaceAll("_", " ")}</span>
              <button type="button" onClick={handleStartSharedReview}>Start Customer Review</button>
              <button type="button" onClick={handleAcceptProposal} disabled={!activeCommercialDraftNetworks.length}>Accept Proposal</button>
            </div>
          ) : null}
          {accountAcceptedProposal ? (
            <div className="commercial-inspector-card">
              <b>Engineering Handoff</b>
              <span>{accountAcceptedProposal.acceptedProposalId}</span>
              <small>Submit to Engineering creates the Engineering Repository package. Sales still creates no ScopeVersion.</small>
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
          ) : null}
        </aside>
        <div className="commercial-map-action-bar" aria-label="Commercial map actions">
          <button type="button" className="primary" onClick={handleNewCommercialOpportunity}>New Opportunity</button>
          <button type="button" onClick={handleGenerateCommercialRoute} disabled={commercialRoutingStatus === "ROUTING" || commercialRouteResult?.status === "ROUTED"}>
            {commercialRoutingStatus === "ROUTING" ? "Routing..." : "Generate Route"}
          </button>
          <button type="button" onClick={handleSaveCommercialDraftSnapshot} disabled={!commercialCorridorDraft && !opportunityScoutQuickQuote && !activeLiveSession?.dirty}>Save Snapshot</button>
          <button type="button" onClick={() => setActiveView("review")} disabled={!activeCommercialDraftNetworks.length && !accountCustomerDrafts.length}>Customer Review</button>
          <button type="button" onClick={handleSaveRuntimeProposal} disabled={proposalRuntimeActionPending}>Save Proposal</button>
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
            onSaveSnapshot={handleSaveLiveProposalSnapshot}
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
