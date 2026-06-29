import { useEffect, useMemo, useState } from "react";
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
import { listCommercialOpportunities, listProposalDrafts, saveCommercialOpportunity, saveProposalDraft } from "../../api/teralinxRuntime";
import { useDALState } from "../../dal/DALState";
import { useTeralinxAuth } from "../../identity/TeralinxAuth";
import { attachPricedDraftToImportedRoute, markImportedRoutePromoted } from "../../translate/CustomerDesignImportEngine";
import type { CustomerDesignImport, ImportedCustomerRoute } from "../../translate/CustomerDesignImport";
import { googleHeliumBidPlanFixture, googleHeliumRfpOpportunity } from "../../rfp/fixtures/googleHeliumRfpFixtures";
import { buildGoogleBidPackagePreview } from "../../rfp/GoogleBidPackagePreview";
import { buildGoogleRfpBidPlanWithOsrm, rebuildGoogleRfpBidPlanFromRoutePlans } from "../../rfp/GoogleRfpResponseEngine";
import type { GoogleRfpRouteBidPlan } from "../../rfp/GoogleRfpBidPlan";
import { loadCustomerInventoryForAccount, type CustomerInventoryParsedStatus, type CustomerNetworkGraph } from "../../customerInventory/CustomerNetworkInventory";
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
import TransparentEstimateExplorer from "./googleRfp/TransparentEstimateExplorer";
import ProposedNetworkMapPanel, { type CommercialIlaMapStation, type ProposedNetworkSelection } from "./proposednetwork/ProposedNetworkMapPanel";
import type { ProposedGraph } from "../../proposedGraph/ProposedGraph";
import type { DALCoordinate } from "../../types/dal";

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
type CommercialOpportunityStatus = "SAVED" | "RECENT" | "ARCHIVED";
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
type ImportDisposition = "SALES_COMMERCIAL_DRAFT" | "CUSTOMER_DRAFT" | "CUSTOMER_PROPOSED_REFERENCE" | "REFERENCE_ONLY";

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
  accountId: string;
  name: string;
  status: CommercialOpportunityStatus;
  createdAt: string;
  updatedAt: string;
  selectedImportId?: string;
  selectedRouteId?: string;
  selectedScopeId: string;
  activeView: CommercialWorkspaceView;
  commercialDraftType: CommercialDraftType | null;
  liveSession: LiveCommercialSession | null;
  commercialDraftSnapshot?: CommercialCorridorDraft | null;
  selectedCustomerDesignLabel?: string;
  importedDraftRouteId?: string;
  snapshotCount: number;
  note: string;
  noScopeVersionCreation: true;
  noInventoryMutation: true;
}

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
  if (type === "NEW_GRAPH_CORRIDOR") return "Create New Graph / Corridor";
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
    const renderState = layerState.activeReference ? "ACTIVE" : "REFERENCE";
    layers.push({
      id: `${twinLayer.layerId}:objects`,
      label: `${twinLayer.label} Objects`,
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
      label: twinLayer.label,
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
    label: args.importedDesignLabel ?? "Customer Design",
    domain: "CUSTOMER_PROPOSED_NETWORK",
    accountId: args.account.accountId,
    authority: "Customer",
    owner: args.account.name,
    visibility: mapVisibility(args.importedDesignActive),
    lockState: "LOCKED",
    renderState: args.importedDesignActive ? "ACTIVE" : "INACTIVE",
    zIndex: commercialMapZIndex("CUSTOMER_PROPOSED_NETWORK", "ROUTES"),
    source: args.importedDesignActive ? "Customer Design Library" : "No imported design selected",
    refreshMode: "SESSION_FROZEN",
    featureScope: "ROUTES",
    featureCount: args.importedDesignActive ? 1 : 0,
    routeMiles: args.importedDesignRouteMiles,
  });

  layers.push({
    id: "sales-commercial-draft:active-corridor",
    label: salesDraftNetwork?.name ?? "Sales Commercial Draft",
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
    label: "Customer Draft",
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
    label: "Accepted Proposal",
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
  onUploadSalesDraft,
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
  onUploadSalesDraft: () => void;
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
        <button type="button" onClick={onUploadSalesDraft}>Upload KMZ/KML/CSV</button>
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
      {items.map((item) => (
        <div className="dal-list-row" key={item}>
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
    activateRouteEngineeringFromCommercialDraft,
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
  } = useDALState();
  const { session, runtimeInfo, activity, recordActivity, can } = useTeralinxAuth();
  const currentUserName = session?.user.name ?? "Teralinx";
  const [bidPlan, setBidPlan] = useState(googleHeliumBidPlanFixture);
  const defaultAssumptionState = useMemo(() => createDefaultBudgetAssumptionState(), []);
  const [assumptionStates, setAssumptionStates] = useState<BudgetAssumptionState[]>([defaultAssumptionState]);
  const [selectedAssumptionStateId, setSelectedAssumptionStateId] = useState(defaultAssumptionState.stateId);
  const [transparentEstimateControls, setTransparentEstimateControls] = useState<TransparentEstimateControls>(() => defaultTransparentEstimateControls());
  const [transparentEstimateRecalculatedAt, setTransparentEstimateRecalculatedAt] = useState<string | null>(null);
  const [liveCommercialSession, setLiveCommercialSession] = useState<LiveCommercialSession | null>(null);
  const [selectedScopeId, setSelectedScopeId] = useState<string>(() => googleHeliumBidPlanFixture.routePlans[0]?.routeRequirement.routeRequirementId ?? "COMBINED_AWARD");
  const [inventoryMapSelection, setInventoryMapSelection] = useState<ProposedNetworkSelection>(null);
  const [verificationStatus, setVerificationStatus] = useState<"PENDING" | "RUNNING" | "COMPLETE" | "FAILED">("PENDING");
  const [commercialRecalculationPending, setCommercialRecalculationPending] = useState(false);
  const [proposalSnapshots, setProposalSnapshots] = useState<LiveProposalSnapshot[]>([]);
  const [customerDrafts, setCustomerDrafts] = useState<CustomerDraftRecord[]>([]);
  const [customerReviewStatus, setCustomerReviewStatus] = useState<CustomerReviewStatus>("NOT_STARTED");
  const [acceptedProposal, setAcceptedProposal] = useState<AcceptedProposal | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState("google");
  const [activeView, setActiveView] = useState<CommercialWorkspaceView>("networks");
  const [activeDesignMode, setActiveDesignMode] = useState<CommercialDesignMode>("EXTEND_EXISTING_NETWORK");
  const [commercialDraftType, setCommercialDraftType] = useState<CommercialDraftType | null>(null);
  const [importedCommercialDraft, setImportedCommercialDraft] = useState<CommercialCorridorDraft | null>(null);
  const [loadedCommercialDraftSnapshot, setLoadedCommercialDraftSnapshot] = useState<CommercialCorridorDraft | null>(null);
  const [commercialOpportunities, setCommercialOpportunities] = useState<CommercialOpportunityRecord[]>([]);
  const [commercialLibraryLoaded, setCommercialLibraryLoaded] = useState(false);
  const [activeCommercialOpportunityId, setActiveCommercialOpportunityId] = useState("");
  const [opportunityNotice, setOpportunityNotice] = useState("No opportunity loaded. New Opportunity starts with Customer Twin only.");
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
  const [pendingImportSource, setPendingImportSource] = useState<"KMZ" | "CSV" | null>(null);
  const [pendingImportFileName, setPendingImportFileName] = useState("");
  const [pendingImportDisposition, setPendingImportDisposition] = useState<ImportDisposition>("REFERENCE_ONLY");
  const [newOpportunityDialogOpen, setNewOpportunityDialogOpen] = useState(false);
  const [existingFiberQueryLastRunAt, setExistingFiberQueryLastRunAt] = useState<string | null>(null);
  const [opportunityAnalysisLaunchedAt, setOpportunityAnalysisLaunchedAt] = useState<string | null>(null);
  const [customerNetworkGraph, setCustomerNetworkGraph] = useState<CustomerNetworkGraph | null>(null);
  const [customerInventoryLoadStatus, setCustomerInventoryLoadStatus] = useState<CustomerInventoryParsedStatus>("PENDING");
  const [customerInventoryDiagnostics, setCustomerInventoryDiagnostics] = useState<string[]>([]);
  const [inventoryRefreshNonce, setInventoryRefreshNonce] = useState(0);
  const [networkLayerStates, setNetworkLayerStates] = useState<Record<string, NetworkLayerState>>(() =>
    Object.fromEntries(COMMERCIAL_NETWORKS.map((network) => [network.networkId, defaultNetworkLayerState(network)])),
  );
  const selectedAccount = COMMERCIAL_ACCOUNTS.find((account) => account.accountId === selectedAccountId) ?? COMMERCIAL_ACCOUNTS[0];
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
  const recentEngineeringDrafts = useMemo(
    () => engineeringDrafts
      .filter((draft) => (draft.commercialDraft as any)?.accountId === selectedAccount.accountId || (draft.commercialDraft as any)?.accountName === selectedAccount.name)
      .slice(0, 4),
    [engineeringDrafts, selectedAccount.accountId, selectedAccount.name],
  );
  const activeCommercialOpportunity = accountCommercialOpportunities.find((record) => record.opportunityId === activeCommercialOpportunityId) ?? null;
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
    const corridorGeometry = selectedImportedCommercialDraft
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
      quickQuoteLabel: selectedImportedCommercialDraft
        ? `${formatRouteMiles(selectedImportedCommercialDraft.routeMiles)} mi / ${money(selectedImportedCommercialDraft.financialAuthority.constructionCost)} imported baseline`
        : loadedCommercialDraftSnapshot
        ? `${formatRouteMiles(loadedCommercialDraftSnapshot.routeMiles)} mi / ${money(loadedCommercialDraftSnapshot.financialAuthority.constructionCost)} saved draft`
        : commercialCorridorDraft
        ? `${formatRouteMiles(commercialCorridorDraft.routeMiles)} mi / ${money(commercialCorridorDraft.financialAuthority.constructionCost)} corridor`
        : opportunityScoutQuickQuote ? `${formatRouteMiles(opportunityScoutQuickQuote.routeMiles)} mi / ${money(opportunityScoutQuickQuote.budgetCost)} lateral` : undefined,
      confidence: opportunityScoutQuickQuote?.confidence,
    };
  }, [azDestinationLocation, azOriginLocation, commercialCorridorDraft, commercialDraftType, commercialRouteResult?.status, loadedCommercialDraftSnapshot, opportunityAttachmentResolution, opportunityScoutCandidate, opportunityScoutQuickQuote, selectedAttachmentCandidate?.id, selectedImportedCommercialDraft]);
  const accountCustomerReviewStatus: CustomerReviewStatus = googleFixtureIsActive ? customerReviewStatus : "NOT_STARTED";
  const commercialMapLayers = useMemo(() => buildCommercialMapLayers({
    account: selectedAccount,
    customerTwinState: accountRenderableCustomerTwin,
    networks: accountNetworkInventory,
    layerStates: networkLayerStates,
    customerReviewStatus: accountCustomerReviewStatus,
    salesDraftActive: !selectedImportedCustomerRoute && (activeCommercialDraftNetworks.length > 0 || Boolean(loadedCommercialDraftSnapshot)),
    importedDesignActive: Boolean(selectedImportedCustomerRoute && importedCustomerGeometryLoaded),
    importedDesignLabel: selectedImportedCustomerRoute?.name,
    importedDesignRouteMiles: selectedImportedCustomerRoute?.routeMiles,
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
    listCommercialOpportunities<CommercialOpportunityRecord>()
      .then((records) => {
        if (cancelled) return;
        setCommercialOpportunities(records.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))));
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
  }, []);

  useEffect(() => {
    let cancelled = false;
    listProposalDrafts<any>()
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
        setProposalSnapshots(snapshots);
        setAcceptedProposal(accepted[0] ?? null);
      })
      .catch((error) => {
        console.warn("Proposal Library load failed", error instanceof Error ? error.message : String(error));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setCustomerInventoryLoadStatus("PARSING");
    setCustomerInventoryDiagnostics([]);
    setCustomerNetworkGraph(null);
    void loadCustomerInventoryForAccount(selectedAccount.accountId).then((result) => {
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

  async function verifyRoutesWithOsrm() {
    setVerificationStatus("RUNNING");
    try {
      const verifiedPlan = await buildGoogleRfpBidPlanWithOsrm(googleHeliumRfpOpportunity);
      setBidPlan(verifiedPlan);
      setVerificationStatus(verifiedPlan.status === "READY_FOR_REVIEW" ? "COMPLETE" : "FAILED");
    } catch (error) {
      console.warn("Teralinx Bid Engine OSRM verification failed", error);
      setBidPlan(googleHeliumBidPlanFixture);
      setVerificationStatus("FAILED");
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
    setSelectedAccountId(accountId);
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
    setPendingImportSource(null);
    setPendingImportFileName("");
    setPendingImportDisposition("REFERENCE_ONLY");
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
    clearCommercialDraftMapLayers();
    if (!options.preserveActiveOpportunity) setActiveCommercialOpportunityId("");
  }

  function buildCommercialOpportunityRecord(status: CommercialOpportunityStatus, options: { duplicate?: boolean } = {}): CommercialOpportunityRecord {
    const timestamp = new Date().toISOString();
    const existing = options.duplicate ? null : activeCommercialOpportunity;
    const selectedCustomerDesignLabel = selectedImportedCustomerDesignImport && selectedImportedCustomerRoute
      ? `${selectedImportedCustomerDesignImport.sourceFileName} / ${selectedImportedCustomerRoute.name}`
      : undefined;
    return {
      opportunityId: existing?.opportunityId ?? `COMMERCIAL-OPPORTUNITY-${selectedAccount.accountId}-${Date.now()}`,
      accountId: selectedAccount.accountId,
      name: existing?.name ?? selectedCustomerDesignLabel ?? `${selectedAccount.name} Opportunity ${accountCommercialOpportunities.length + 1}`,
      status,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
      selectedImportId: selectedImportedCustomerDesignImport?.importId,
      selectedRouteId: selectedImportedCustomerRoute?.routeId,
      selectedScopeId: selectedScope.scopeId,
      activeView,
      commercialDraftType,
      liveSession: activeLiveSession,
      commercialDraftSnapshot: selectedImportedCommercialDraft ?? commercialCorridorDraft ?? loadedCommercialDraftSnapshot,
      selectedCustomerDesignLabel,
      importedDraftRouteId: selectedImportedCommercialDraft?.routeId,
      snapshotCount: accountSnapshots.length,
      note: selectedCustomerDesignLabel
        ? "Opportunity attaches a Customer Design Library route intentionally. No ScopeVersion authority created."
        : "Opportunity saved from Commercial Planning working state. No ScopeVersion authority created.",
      noScopeVersionCreation: true,
      noInventoryMutation: true,
    };
  }

  function upsertCommercialOpportunity(record: CommercialOpportunityRecord) {
    setCommercialOpportunities((prev) => {
      const withoutCurrent = prev.filter((candidate) => candidate.opportunityId !== record.opportunityId);
      return [record, ...withoutCurrent];
    });
    setActiveCommercialOpportunityId(record.opportunityId);
    setOpportunityNotice(`${record.name} saved.`);
    const sharedRecord = {
      ...record,
      organization: "Teralinx",
      savedBy: currentUserName,
    };
    void saveCommercialOpportunity(sharedRecord).then((saved) => {
      setCommercialOpportunities((prev) => [saved, ...prev.filter((candidate) => candidate.opportunityId !== saved.opportunityId)]);
      void recordActivity({
        action: record.status === "ARCHIVED" ? "archived opportunity" : "saved opportunity",
        objectType: "Opportunity",
        objectId: saved.opportunityId,
        objectName: saved.name,
        revision: saved.commercialDraftSnapshot?.routeId ?? saved.importedDraftRouteId ?? saved.selectedScopeId,
        opportunityId: saved.opportunityId,
        customerId: saved.accountId,
        details: "Opportunity persisted to the shared Teralinx Opportunity Library.",
      });
    }).catch((error) => {
      setOpportunityNotice(`Opportunity saved locally in session but shared save failed: ${error instanceof Error ? error.message : String(error)}`);
    });
  }

  function handleNewCommercialOpportunity() {
    resetCommercialOpportunityWorkingState();
    setOpportunityNotice("New Opportunity started. Customer Twin is visible; no design or draft is loaded.");
    setNewOpportunityDialogOpen(true);
    setOpportunityWorkflowState("SELECTING_START_MODE");
  }

  function handleSaveCommercialOpportunity() {
    upsertCommercialOpportunity(buildCommercialOpportunityRecord("SAVED"));
  }

  function handleSaveAsCommercialOpportunity() {
    upsertCommercialOpportunity(buildCommercialOpportunityRecord("SAVED", { duplicate: true }));
  }

  function handleArchiveCommercialOpportunity() {
    if (!activeCommercialOpportunity) return;
    const archived = {
      ...activeCommercialOpportunity,
      status: "ARCHIVED" as const,
      updatedAt: new Date().toISOString(),
    };
    upsertCommercialOpportunity(archived);
    resetCommercialOpportunityWorkingState();
    setOpportunityNotice(`${archived.name} archived. Customer Twin remains visible.`);
  }

  function handleCloseCommercialOpportunity() {
    resetCommercialOpportunityWorkingState();
    setOpportunityNotice("Opportunity closed. Customer Twin is visible; saved libraries remain available.");
  }

  function handleOpenCustomerDesignFromLibrary(importId: string, routeId: string) {
    resetCommercialOpportunityWorkingState({ preserveActiveOpportunity: true });
    const entry = accountImportedCustomerRoutes.find((item) => item.importRecord.importId === importId && item.route.routeId === routeId);
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

  function handleOpenCommercialOpportunity(opportunityId: string) {
    const record = accountCommercialOpportunities.find((candidate) => candidate.opportunityId === opportunityId);
    if (!record) return;
    resetCommercialOpportunityWorkingState({ preserveActiveOpportunity: true });
    setActiveCommercialOpportunityId(record.opportunityId);
    if (record.liveSession) setLiveCommercialSession(record.liveSession);
    if (record.selectedImportId && record.selectedRouteId) handleOpenCustomerDesignFromLibrary(record.selectedImportId, record.selectedRouteId);
    else if (record.commercialDraftSnapshot) {
      setLoadedCommercialDraftSnapshot(record.commercialDraftSnapshot);
      setSelectedCommercialCorridorDraft(record.commercialDraftSnapshot);
      setOpportunityWorkflowState("COMMERCIAL_DRAFT_ACTIVE");
      activateSalesDraftWorkingSet();
    }
    setSelectedScopeId(record.selectedScopeId);
    setActiveView(record.activeView);
    setCommercialDraftType(record.commercialDraftType);
    const openedRecord = {
      ...record,
      status: record.status === "ARCHIVED" ? "ARCHIVED" as const : "RECENT" as const,
      updatedAt: new Date().toISOString(),
    };
    setCommercialOpportunities((prev) => prev.map((candidate) => (
      candidate.opportunityId === record.opportunityId ? openedRecord : candidate
    )));
    if (openedRecord.status !== "ARCHIVED") {
      void saveCommercialOpportunity({ ...openedRecord, lastOpenedBy: currentUserName }).catch((error) => {
        console.warn("Opportunity Library recent update failed", error instanceof Error ? error.message : String(error));
      });
      void recordActivity({
        action: "opened opportunity",
        objectType: "Opportunity",
        objectId: openedRecord.opportunityId,
        objectName: openedRecord.name,
        revision: openedRecord.selectedScopeId,
        opportunityId: openedRecord.opportunityId,
        customerId: openedRecord.accountId,
      });
    }
    setActiveCommercialOpportunityId(record.opportunityId);
    setOpportunityNotice(`${record.name} opened intentionally.`);
  }

  function handleOpportunityLibrarySelect(value: string) {
    if (!value) return;
    const [kind, firstId, secondId] = value.split("::");
    if (kind === "opportunity") {
      handleOpenCommercialOpportunity(firstId);
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

  function handleUploadSalesDraft() {
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
    setPendingImportSource(null);
    setPendingImportFileName("");
    setPendingImportDisposition("REFERENCE_ONLY");
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

  function handleBeginImportOpportunity(source: "KMZ" | "CSV") {
    resetOpportunityInputState();
    setPendingImportSource(source);
    setOpportunityWorkflowState("AWAITING_IMPORT");
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

  function handleResolveAzTextLocation(slot: AzLocationSlot) {
    const input = azInputForSlot(slot).trim();
    if (!input) return;
    const coordinateParts = input.split(",").map((part) => Number(part.trim()));
    const location = coordinateParts.length === 2 &&
      Number.isFinite(coordinateParts[0]) &&
      Number.isFinite(coordinateParts[1]) &&
      Math.abs(coordinateParts[0]) <= 90 &&
      Math.abs(coordinateParts[1]) <= 180
      ? createLatLngResolvedLocation(selectedAccount.accountId, coordinateParts[0], coordinateParts[1])
      : createAddressResolvedLocation(selectedAccount.accountId, input);
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
      const result = await routeCommercialCorridorWithOsrm(request);
      setCommercialRouteResult(result);
      setOpportunityWorkflowState(result.status === "ROUTED"
        ? commercialDraftType === "NEW_GRAPH_CORRIDOR" ? "CORRIDOR_READY" : "QUICK_QUOTE_READY"
        : "SITE_DECISION_READY");
    } catch (error) {
      setCommercialRouteResult({
        status: "FAILED",
        source: "OSRM",
        failureReason: "OSRM_ROUTE_FAILED",
        diagnostics: [
          "OSRM routing failed before a valid route result was returned. No straight-line fallback geometry was generated.",
          error instanceof Error ? error.message : String(error),
        ],
      });
      setOpportunityWorkflowState("SITE_DECISION_READY");
    } finally {
      setCommercialRoutingStatus("IDLE");
    }
  }

  function handleRunAzBuilderScout() {
    if (opportunityWorkflowState !== "AWAITING_AZ_INPUT" || !azOriginLocation || !azDestinationLocation) return;
    setCommercialDraftType(commercialDraftType ?? "NEW_GRAPH_CORRIDOR");
    setActiveDesignMode(commercialDraftType === "EXISTING_GRAPH_EXTENSION" ? "EXTEND_EXISTING_NETWORK" : "NEW_INDEPENDENT_GRAPH");
    setOpportunityScoutCandidate(createAzBuilderScoutCandidateFromResolvedLocations(selectedAccount.accountId, azOriginLocation, azDestinationLocation));
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

  function handleImportOpportunityDraft(source: "KMZ" | "CSV") {
    handleBeginImportOpportunity(source);
  }

  function handleConfirmImportPreview() {
    if (!pendingImportSource || !pendingImportFileName.trim()) return;
    if (pendingImportDisposition === "SALES_COMMERCIAL_DRAFT") {
      setCommercialDraftType(commercialDraftType ?? "NEW_GRAPH_CORRIDOR");
      activateSalesDraftWorkingSet();
      setOpportunityWorkflowState("COMMERCIAL_DRAFT_ACTIVE");
      return;
    }
    if (pendingImportDisposition === "CUSTOMER_DRAFT") {
      handleCreateCustomerDraft(pendingImportSource);
      setActiveView("review");
      setOpportunityWorkflowState("IDLE");
      return;
    }
    setOpportunityWorkflowState("IDLE");
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
    void saveProposalDraft({
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
    void saveProposalDraft({
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
    const updated = attachPricedDraftToImportedRoute(selectedImportedCustomerDesignImport, selectedImportedCustomerRoute.routeId, draft);
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
    const promoted = markImportedRoutePromoted(priced.record, selectedImportedCustomerRoute.routeId, "ROUTE_PROMOTED_TO_COMMERCIAL_DRAFT");
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

  function handleOpenImportedCustomerRouteInEngineering() {
    const priced = selectedImportedCommercialDraft
      ? { record: selectedImportedCustomerDesignImport, draft: selectedImportedCommercialDraft }
      : handlePriceImportedCustomerRoute();
    if (!priced?.record || !priced.draft || !selectedImportedCustomerRoute) return;
    const promoted = markImportedRoutePromoted(priced.record, selectedImportedCustomerRoute.routeId, "ROUTE_OPENED_IN_ENGINEERING");
    upsertCustomerDesignImport(promoted);
    setImportedCommercialDraft(priced.draft);
    setSelectedCommercialCorridorDraft(priced.draft);
    activateRouteEngineeringFromCommercialDraft({
      commercialDraft: priced.draft,
      accountId: selectedAccount.accountId,
      accountName: selectedAccount.name,
      opportunityId: selectedScope.scopeId,
      createdBy: currentUserName,
      activationReason: "Imported customer design opened from Commercial Planning as immutable Engineering baseline.",
    });
  }

  function handleEnterEngineeringMode() {
    if (!commercialCorridorDraft) return;
    activateSalesDraftWorkingSet();
    activateRouteEngineeringFromCommercialDraft({
      commercialDraft: commercialCorridorDraft,
      accountId: selectedAccount.accountId,
      accountName: selectedAccount.name,
      opportunityId: selectedScope.scopeId,
      createdBy: currentUserName,
      activationReason: "Commercial Planning entered Engineering Mode from a valid Commercial Draft.",
    });
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
    const routePlan = activeLiveSession?.routePlan ?? selectedRoutePlans[0];
    if (!routePlan) return;
    const timestamp = new Date().toISOString();
    const geometry = activeLiveSession?.activeEditableRouteGeometry ?? routePlan.stationedCorridor?.centerlineRoute.geometry ?? routePlan.proposedGraph?.centerlineRoute?.geometry ?? [];
    const acceptedProposalId = `ACCEPTED-PROPOSAL-${selectedAccount.accountId}-${Date.now()}`;
    const accepted: AcceptedProposal = {
      acceptedProposalId,
      acceptedAt: timestamp,
      accountId: selectedAccount.accountId,
      accountName: selectedAccount.name,
      commercialEngagementId: selectedAccount.commercialEngagements[0],
      routeRequirementId: routePlan.routeRequirement.routeRequirementId,
      acceptedRouteGeometry: geometry,
      acceptedCommercialSummary: selectedPricingSummary,
      proposalSnapshots: accountSnapshots,
      customerComments: activeLiveSession?.customerComments ?? [],
      customerUploadedRoutes: accountCustomerDrafts,
      existingNetworksReferenced: activeExistingReferenceNetworkIds,
      proposedNetworksReferenced: activeProposedReferenceNetworkIds,
      constructionStrategy: activeLiveSession?.constructionStrategy ?? selectedAssumptionState.civilMix,
      enrichmentSelections: activeLiveSession?.enrichmentSelections ?? [],
      budgetAssumptions: activeLiveSession?.currentCommercialAssumptions ?? selectedAssumptionState.stateId,
      attachments: ["Commercial pricing summary", "Route geometry", "Customer review record"],
      owner: "Engineering",
      engineeringReviewActivated: true,
      noScopeVersionCreation: true,
      noServiceOrderCreation: true,
    };
    setAcceptedProposal(accepted);
    void saveProposalDraft({
      ...(accepted as any),
      proposalRecordId: accepted.acceptedProposalId,
      proposalRecordType: "ACCEPTED_PROPOSAL",
      opportunityId: activeCommercialOpportunityId || activeCommercialOpportunity?.opportunityId,
      organization: "Teralinx",
    }).then(() => recordActivity({
      action: "accepted proposal",
      objectType: "Proposal",
      objectId: accepted.acceptedProposalId,
      objectName: `${accepted.accountName} accepted proposal`,
      revision: accepted.routeRequirementId,
      opportunityId: activeCommercialOpportunityId || activeCommercialOpportunity?.opportunityId,
      customerId: accepted.accountId,
      details: "Accepted proposal persisted to the shared Teralinx Proposal Library. No ScopeVersion or service order created.",
    })).catch((error) => {
      console.warn("Accepted proposal shared save failed", error instanceof Error ? error.message : String(error));
    });
    setCustomerReviewStatus("ACCEPTED");
    setLiveCommercialSession((prev) => (prev && prev.accountId === selectedAccount.accountId
      ? {
          ...prev,
          dirty: false,
          customerReviewStatus: "ACCEPTED",
          currentOwner: "Engineering",
          acceptedProposalId,
          lastAutosavedAt: timestamp,
        }
      : prev));
    setActiveView("handoff");
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

  const compactOwner = accountAcceptedProposal ? "Engineering" : activeLiveSession?.currentOwner ?? "Sales";
  const currentDraftLabel = selectedImportedCustomerRoute
    ? `Customer Design / ${selectedImportedCustomerRoute.name}`
    : activeCommercialDraftNetworks.length
    ? draftTypeLabel(commercialDraftType)
    : loadedCommercialDraftSnapshot
    ? `Saved Commercial Draft / ${loadedCommercialDraftSnapshot.routeId}`
    : commercialDraftType
      ? `${draftTypeLabel(commercialDraftType)} / Not activated`
      : "No draft";
  const estimateConfidenceLabel = selectedImportedCommercialDraft
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
  const engineeringConfidenceLabel = selectedImportedCustomerRoute
    ? "Imported baseline known"
    : commercialRouteResult?.status === "ROUTED"
    ? "Route geometry known"
    : commercialRouteResult?.status === "FAILED"
      ? "Route failed"
      : "Pending";
  const unknownConstraintCount = selectedImportedCommercialDraft?.unknownQuantities.length ?? commercialCorridorDraft?.unknownQuantities.length ?? loadedCommercialDraftSnapshot?.unknownQuantities.length ?? (opportunityScoutQuickQuote?.crossings ?? 0);
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
        : selectedImportedCommercialDraft || commercialCorridorDraft || loadedCommercialDraftSnapshot || opportunityScoutQuickQuote
            ? "Current"
            : "Not Started";
  const proposalStatusLabel = accountAcceptedProposal
    ? "Proposal Ready"
    : accountCustomerReviewStatus === "IN_REVIEW"
      ? "Commercial Review"
      : selectedImportedCommercialDraft
        ? "Commercial Draft"
      : activeCommercialDraftNetworks.length
        ? "Commercial Draft"
        : "Not Started";
  const draftVersionLabel = activeCommercialDraftNetworks.length || selectedImportedCommercialDraft || commercialCorridorDraft || loadedCommercialDraftSnapshot || opportunityScoutQuickQuote
    ? `v${accountSnapshots.length + 1}`
    : "n/a";
  const lastRecalculatedAt = transparentEstimateRecalculatedAt ?? activeLiveSession?.lastRecalculatedAt ?? null;
  const unsavedChanges = Boolean(activeLiveSession?.dirty || (commercialCorridorDraft && !opportunityScoutCandidate?.lockedIntoCommercialDraft));
  const activeFinancialDraft = selectedImportedCommercialDraft ?? commercialCorridorDraft ?? loadedCommercialDraftSnapshot;
  const activeFinancialAuthority = activeFinancialDraft?.financialAuthority ?? null;

  return (
    <section className="dal-workspace wide">
      <div className="commercial-compact-header">
        <div className="commercial-compact-brand">
          <img className="commercial-compact-logo" src={teralinxLogo} alt="TeralinX" />
          <div>
            <b>Commercial Planning</b>
            <span>Advisory Commercial Draft authoring</span>
          </div>
        </div>
        <div className="commercial-compact-header-grid" aria-label="Commercial workspace status">
          <div><span>Customer</span><b>{selectedAccount.name}</b></div>
          <div><span>Current Opportunity</span><b>{activeCommercialOpportunity?.name ?? "No opportunity loaded"}</b></div>
          <div><span>Current Draft</span><b>{currentDraftLabel}</b></div>
          <div><span>Review State</span><b>{accountCustomerReviewStatus.replaceAll("_", " ")}</b></div>
          <div><span>Owner</span><b>{compactOwner}</b></div>
          <div><span>OSRM Status</span><b>{osrmStatusLabel}</b></div>
          <div><span>Estimate Status</span><b>{estimateStatusLabel}</b></div>
          <div><span>Confidence</span><b>{estimateConfidenceLabel}</b></div>
          <div><span>Proposal Status</span><b>{proposalStatusLabel}</b></div>
        </div>
        <div className="commercial-compact-actions">
          <button className="dal-button primary" type="button" onClick={handleNewCommercialOpportunity}>
            New
          </button>
          <select value="" onChange={(event) => handleOpportunityLibrarySelect(event.currentTarget.value)} aria-label="Open opportunity or library item">
            <option value="">Open...</option>
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
          <button className="dal-button secondary" type="button" onClick={handleSaveCommercialOpportunity}>
            Save
          </button>
          <button className="dal-button secondary" type="button" onClick={handleSaveAsCommercialOpportunity}>
            Save As
          </button>
          <button className="dal-button secondary" type="button" onClick={handleArchiveCommercialOpportunity} disabled={!activeCommercialOpportunity}>
            Archive
          </button>
          <button className="dal-button secondary" type="button" onClick={handleCloseCommercialOpportunity}>
            Close
          </button>
          <select value={selectedAccountId} onChange={(event) => selectAccount(event.currentTarget.value)} aria-label="Account selector">
            {COMMERCIAL_ACCOUNTS.map((account) => (
              <option key={account.accountId} value={account.accountId}>{account.name}</option>
            ))}
          </select>
          <span className="dal-badge warning">Budgetary only</span>
          <span className={`dal-badge ${verificationStatus === "COMPLETE" ? "pass" : verificationStatus === "RUNNING" ? "warning" : "fail"}`}>
            OSRM {verificationStatus}
          </span>
          <button className="dal-button secondary" type="button" onClick={verifyRoutesWithOsrm} disabled={verificationStatus === "RUNNING"}>
            Verify OSRM Routes
          </button>
        </div>
      </div>

      <div className="dal-status commercial-opportunity-notice">{opportunityNotice}</div>

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

      {activeFinancialDraft && activeFinancialAuthority ? (
        <section className="commercial-financial-authority-summary">
          <div className="dal-panel-title-row">
            <div>
              <h3>Executive Financial Summary</h3>
              <span>{selectedImportedCustomerRoute ? `Customer Design ${selectedImportedCustomerDesignImport?.designId}` : "Commercial Draft"} / {activeFinancialDraft.routeId}</span>
            </div>
            <span className="dal-badge warning">Budgetary Authority</span>
          </div>
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
              <span>Revenue/Foot: ${activeFinancialAuthority.revenuePerFoot.toLocaleString()}</span>
            </div>
            <div>
              <b>Lifecycle Value</b>
              <span>Gross Margin: {money(activeFinancialAuthority.grossMarginDollars)}</span>
              <span>Margin %: {percentage(activeFinancialAuthority.grossMarginPercent)}</span>
              <span>Margin/Mile: {money(activeFinancialAuthority.marginPerMile)}</span>
              <span>Lifecycle Revenue: {money(activeFinancialAuthority.lifecycleRevenue)}</span>
              <span>Commercial Readiness: {percentage(activeFinancialDraft.transparentEstimate.commercialReadiness.score)}</span>
            </div>
          </div>
          {activeFinancialAuthority.validationWarnings.length ? (
            <div className="commercial-financial-warning-list">
              {activeFinancialAuthority.validationWarnings.map((warning) => (
                <span key={warning}>{warning}</span>
              ))}
            </div>
          ) : (
            <div className="dal-status">Financial sanity validation passed. Revenue is not calculated as Cost + Sell Price.</div>
          )}
        </section>
      ) : null}

      {newOpportunityDialogOpen ? (
        <section className="commercial-command-dialog" aria-label="New opportunity command">
          <div className="dal-panel-title-row">
            <h3>New Opportunity</h3>
            <span className="dal-badge warning">Choose build type</span>
          </div>
          <div className="dal-status">What are we building?</div>
          <div className="commercial-command-grid">
            <button type="button" onClick={handleBeginAzOpportunity}>Create New Graph / Corridor</button>
            <button type="button" onClick={handleBeginExtendExistingOpportunity} disabled={!accountRenderableCustomerTwin.routes.length && !accountRenderableCustomerTwin.objects.length}>Extend Existing Graph / Lateral</button>
            <button type="button" onClick={() => handleBeginImportOpportunity("KMZ")}>Import KMZ / KML</button>
            <button type="button" onClick={handleLoadSavedProposal}>Load Saved Proposal</button>
            <button type="button" onClick={handleLoadCustomerDraft}>Load Customer Draft</button>
          </div>
          <div className="dal-actions">
            <button type="button" className="secondary" onClick={closeNewOpportunityDialog}>Close</button>
            <span className="dal-status">The selected build type determines whether Commercial Planning creates a new corridor graph or a Customer Twin extension.</span>
          </div>
        </section>
      ) : null}

      <div className="commercial-area-heading">
        <h3>Commercial Planning</h3>
        <span>Executive summary, map, imported design, commercial draft, proposal actions, and customer review.</span>
      </div>

      <section className="commercial-orchestrator-shell" aria-label="Commercial Planning domain orchestrator">
        <aside className="commercial-orchestrator-nav">
          <div className="commercial-orchestrator-heading">
            <b>{selectedAccount.name}</b>
            <span>{accountCustomerTwin?.customerTwinId ?? customerInventoryLoadStatus}</span>
          </div>
          <button type="button" className="primary" onClick={handleNewCommercialOpportunity}>New Opportunity</button>
          <div className="commercial-stage-list">
            {[
              ["networks", "Customer Twin", accountRenderableCustomerTwin.routes.length ? "Loaded" : customerInventoryLoadStatus],
              ["scout", "Opportunity", opportunityWorkflowLabel(opportunityWorkflowState)],
              ["proposal", "Commercial Draft", activeCommercialDraftNetworks.length ? draftTypeLabel(commercialDraftType) : "Not created"],
              ["review", "Customer Draft", accountCustomerDrafts.length ? `${accountCustomerDrafts.length} staged` : "None"],
              ["review", "Shared Review", accountCustomerReviewStatus === "IN_REVIEW" ? "Active" : "Closed"],
              ["handoff", "Accepted Proposal", accountAcceptedProposal ? "Ready" : "Pending"],
              ["handoff", "Engineering", accountAcceptedProposal ? "Owner next" : "Boundary"],
            ].map(([id, label, status]) => (
              <button
                key={`${id}:${label}`}
                type="button"
                className={activeView === id ? "commercial-stage active" : "commercial-stage"}
                onClick={() => setActiveView(id as CommercialWorkspaceView)}
              >
                <b>{label}</b>
                <span>{status}</span>
              </button>
            ))}
          </div>
          <div className="commercial-working-set-compact">
            <b>Working Set</b>
            <span>Customer Twin: {accountRenderableCustomerTwin.routes.length.toLocaleString()} routes</span>
            <span>Draft Type: {draftTypeLabel(commercialDraftType)}</span>
            <span>Commercial Draft: {activeCommercialDraftNetworks.length ? "Visible" : "Off"}</span>
            <span>Customer Draft: {accountCustomerDrafts.length ? "Loaded" : "Off"}</span>
            <span>Shared Review: {accountCustomerReviewStatus === "IN_REVIEW" ? "On" : "Off"}</span>
            <span>Accepted Proposal: {accountAcceptedProposal ? "On" : "Off"}</span>
          </div>
          <div className="dal-actions vertical">
            <button type="button" onClick={() => setInventoryRefreshNonce((nonce) => nonce + 1)}>Refresh Twin</button>
            <button type="button" onClick={() => setInventoryRefreshNonce((nonce) => nonce + 1)}>Reload Customer Inventory</button>
            <button type="button" onClick={() => setActiveView("review")} disabled={!activeCommercialDraftNetworks.length && !accountCustomerDrafts.length}>Customer Review</button>
          </div>
          <div className="commercial-future-contracts">
            <b>Future Contracts</b>
            <span>Marketplace adapter</span>
            <span>Control adapter</span>
            <span>Field adapter</span>
            <span>Operational Intelligence adapter</span>
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

        <aside className="commercial-context-inspector">
          <div className="dal-panel-title-row">
            <h3>Context Inspector</h3>
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
              <span>Select Create New Graph / Corridor or Extend Existing Graph / Lateral.</span>
              <small>New Graph builds A/Z corridor data. Extend Existing builds attachment-based lateral economics.</small>
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
              <b>Create New Graph / Corridor</b>
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
              <button type="button" onClick={handleRunAzBuilderScout} disabled={!azOriginLocation || !azDestinationLocation}>Create Corridor Seed</button>
            </div>
          ) : null}
          {opportunityWorkflowState === "AWAITING_IMPORT" ? (
            <div className="commercial-inspector-card">
              <b>{pendingImportSource === "CSV" ? "Import CSV" : "Import KMZ / KML"}</b>
              <span>Upload, preview, then choose the state. Nothing renders before confirmation.</span>
              <input
                type="file"
                accept={pendingImportSource === "CSV" ? ".csv" : ".kmz,.kml"}
                onChange={(event) => setPendingImportFileName(event.currentTarget.files?.[0]?.name ?? "")}
              />
              <small>{pendingImportFileName || "No file selected"}</small>
              <label>
                <span>State</span>
                <select value={pendingImportDisposition} onChange={(event) => setPendingImportDisposition(event.currentTarget.value as ImportDisposition)}>
                  <option value="REFERENCE_ONLY">Reference Only</option>
                  <option value="CUSTOMER_PROPOSED_REFERENCE">Customer Proposed Reference</option>
                  <option value="CUSTOMER_DRAFT">Customer Draft</option>
                  <option value="SALES_COMMERCIAL_DRAFT">Sales Commercial Draft</option>
                </select>
              </label>
              <button type="button" onClick={handleConfirmImportPreview} disabled={!pendingImportFileName.trim()}>Confirm {importDispositionLabel(pendingImportDisposition)}</button>
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
                      {(selectedImportedCommercialDraft.financialValidationWarnings ?? []).map((warning) => (
                        <small key={warning}>Warning: {warning}</small>
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
                  <button type="button" onClick={handleOpenImportedCustomerRouteInEngineering} disabled={!selectedImportedCustomerRoute.pricingEligible}>
                    Open In Engineering
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
                {(commercialCorridorDraft.financialValidationWarnings ?? []).map((warning) => (
                  <small key={warning}>Warning: {warning}</small>
                ))}
                <button type="button" onClick={handleLockScoutCandidate} disabled={opportunityScoutCandidate?.lockedIntoCommercialDraft}>Activate Corridor Draft</button>
                <button type="button" onClick={handleEnterEngineeringMode}>Enter Engineering Mode</button>
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
              {commercialCorridorDraft ? (
                <button type="button" onClick={handleEnterEngineeringMode}>Enter Engineering Mode</button>
              ) : null}
              <button type="button" onClick={handleSaveCommercialDraftSnapshot} disabled={!commercialCorridorDraft && !opportunityScoutQuickQuote && !activeLiveSession?.dirty}>Save Snapshot</button>
            </div>
          ) : null}
          {activeCommercialDraftNetworks.length || accountCustomerDrafts.length || accountCustomerReviewStatus !== "NOT_STARTED" ? (
            <div className="commercial-inspector-card">
              <b>Customer Review</b>
              <span>{accountCustomerReviewStatus.replaceAll("_", " ")}</span>
              <button type="button" onClick={() => handleBeginImportOpportunity("KMZ")}>Stage KMZ Draft</button>
              <button type="button" onClick={handleStartSharedReview}>Start Customer Review</button>
              <button type="button" onClick={handleAcceptProposal} disabled={!activeCommercialDraftNetworks.length}>Accept Proposal</button>
            </div>
          ) : null}
          {accountAcceptedProposal ? (
            <div className="commercial-inspector-card">
              <b>Engineering Handoff</b>
              <span>{accountAcceptedProposal.acceptedProposalId}</span>
              <small>Engineering owns the next step. Sales still creates no ScopeVersion.</small>
              <button type="button" onClick={handleEnterEngineeringMode} disabled={!commercialCorridorDraft}>Enter Engineering Mode</button>
            </div>
          ) : null}
        </aside>
      </section>

      {activeFinancialDraft ? (
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
      ) : null}

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
            onUploadSalesDraft={handleUploadSalesDraft}
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
            onUploadSalesDraft={handleUploadSalesDraft}
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
            <div><span>Upload Revision</span><b>KMZ / KML / CSV</b></div>
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
            <div><span>ScopeVersion</span><b>Engineering only</b></div>
            <div><span>SOF</span><b>After certified ScopeVersion</b></div>
            <div><span>Execution</span><b>Kernel after Engineering Review</b></div>
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
