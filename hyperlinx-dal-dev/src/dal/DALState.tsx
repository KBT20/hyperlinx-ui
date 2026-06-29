import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { listCustomerDesignImports, normalizeCustomerDesignImport, saveCustomerDesignImport } from "../api/customerDesignLibrary";
import type { InventoryGraph, InventoryGraphMetadata, PrismOpportunity, ScopeVersion } from "../types/dal";
import type { CandidateSite } from "../types/candidateSite";
import type { CommercialCorridorDraft } from "../commercial/CommercialCorridorDraftEngine";
import type { CustomerDesignImport } from "../translate/CustomerDesignImport";
import type { DesignLaunchResult } from "../design/DesignLaunchResult";
import type { RouteEngineeringDraft } from "../engineering/RouteEngineeringDraft";
import type { GraphExtension } from "../types/graphExtension";
import type { NetworkAffinity } from "../types/networkAffinity";
import type { OpportunitySeed } from "../types/portfolio";
import type { ProposedGraph } from "../proposedGraph/ProposedGraph";

export type DALWorkspace =
  | "translate"
  | "teralinxRoute"
  | "googleRfp"
  | "inventory"
  | "inventoryRecovery"
  | "graphViewer"
  | "graphExtensions"
  | "design"
  | "proposedNetwork"
  | "preliminaryProposal"
  | "prism"
  | "siteDecision"
  | "routeEngineering"
  | "candidateSites"
  | "networkAffinity"
  | "portfolio"
  | "marketplace"
  | "control"
  | "field"
  | "twin"
  | "ops";

export type DALInventorySummary = InventoryGraphMetadata;

export type RouteEngineeringActivationRequest = {
  requestId: string;
  commercialDraft: CommercialCorridorDraft;
  accountId?: string;
  accountName?: string;
  opportunityId?: string;
  createdBy?: string;
  createdAt: string;
  sourceWorkspace: "COMMERCIAL_PLANNING";
  activationReason: string;
};

type DALState = {
  workspace: DALWorkspace;
  setWorkspace: (workspace: DALWorkspace) => void;
  selectedInventoryId: string;
  setSelectedInventoryId: (inventoryId: string) => void;
  selectedGraph: InventoryGraph | null;
  setSelectedGraph: (graph: InventoryGraph | null) => void;
  selectedScopeVersionId: string;
  setSelectedScopeVersionId: (scopeVersionId: string) => void;
  selectedScopeVersion: ScopeVersion | null;
  setSelectedScopeVersion: (scopeVersion: ScopeVersion | null) => void;
  selectedExtensionId: string;
  setSelectedExtensionId: (extensionId: string) => void;
  selectedExtension: GraphExtension | null;
  setSelectedExtension: (extension: GraphExtension | null) => void;
  selectedGraphFeature: unknown;
  setSelectedGraphFeature: (feature: unknown) => void;
  selectedOpportunityId: string;
  setSelectedOpportunityId: (opportunityId: string) => void;
  selectedOpportunity: PrismOpportunity | null;
  setSelectedOpportunity: (opportunity: PrismOpportunity | null) => void;
  selectedOpportunitySeedId: string;
  setSelectedOpportunitySeedId: (opportunitySeedId: string) => void;
  selectedOpportunitySeed: OpportunitySeed | null;
  setSelectedOpportunitySeed: (opportunitySeed: OpportunitySeed | null) => void;
  selectedCandidateSiteId: string;
  setSelectedCandidateSiteId: (candidateSiteId: string) => void;
  selectedCandidateSite: CandidateSite | null;
  setSelectedCandidateSite: (candidateSite: CandidateSite | null) => void;
  selectedNetworkAffinity: NetworkAffinity | null;
  setSelectedNetworkAffinity: (networkAffinity: NetworkAffinity | null) => void;
  selectedDesignLaunchResult: DesignLaunchResult | null;
  setSelectedDesignLaunchResult: (result: DesignLaunchResult | null) => void;
  selectedProposedGraph: ProposedGraph | null;
  setSelectedProposedGraph: (proposedGraph: ProposedGraph | null) => void;
  selectedCommercialCorridorDraft: CommercialCorridorDraft | null;
  setSelectedCommercialCorridorDraft: (draft: CommercialCorridorDraft | null) => void;
  customerDesignImports: CustomerDesignImport[];
  customerDesignLibraryLoaded: boolean;
  selectedCustomerDesignImportId: string;
  setSelectedCustomerDesignImportId: (importId: string) => void;
  selectedCustomerDesignRouteId: string;
  setSelectedCustomerDesignRouteId: (routeId: string) => void;
  selectedCustomerDesignImport: CustomerDesignImport | null;
  upsertCustomerDesignImport: (record: CustomerDesignImport) => void;
  selectedRouteEngineeringActivation: RouteEngineeringActivationRequest | null;
  setSelectedRouteEngineeringActivation: (activation: RouteEngineeringActivationRequest | null) => void;
  selectedRouteEngineeringDraft: RouteEngineeringDraft | null;
  setSelectedRouteEngineeringDraft: (draft: RouteEngineeringDraft | null) => void;
  activateRouteEngineeringFromCommercialDraft: (args: {
    commercialDraft: CommercialCorridorDraft;
    accountId?: string;
    accountName?: string;
    opportunityId?: string;
    createdBy?: string;
    activationReason?: string;
  }) => RouteEngineeringActivationRequest;
  inventorySummaries: DALInventorySummary[];
  upsertInventorySummary: (summary: DALInventorySummary) => void;
};

const DALStateContext = createContext<DALState | null>(null);

export function DALStateProvider({ children }: { children: ReactNode }) {
  const [workspace, setWorkspace] = useState<DALWorkspace>("googleRfp");
  const [selectedInventoryId, setSelectedInventoryId] = useState("");
  const [selectedGraph, setSelectedGraph] = useState<InventoryGraph | null>(null);
  const [selectedScopeVersionId, setSelectedScopeVersionId] = useState("");
  const [selectedScopeVersion, setSelectedScopeVersion] = useState<ScopeVersion | null>(null);
  const [selectedExtensionId, setSelectedExtensionId] = useState("");
  const [selectedExtension, setSelectedExtension] = useState<GraphExtension | null>(null);
  const [selectedGraphFeature, setSelectedGraphFeature] = useState<unknown>(null);
  const [selectedOpportunityId, setSelectedOpportunityId] = useState("");
  const [selectedOpportunity, setSelectedOpportunity] = useState<PrismOpportunity | null>(null);
  const [selectedOpportunitySeedId, setSelectedOpportunitySeedId] = useState("");
  const [selectedOpportunitySeed, setSelectedOpportunitySeed] = useState<OpportunitySeed | null>(null);
  const [selectedCandidateSiteId, setSelectedCandidateSiteId] = useState("");
  const [selectedCandidateSite, setSelectedCandidateSite] = useState<CandidateSite | null>(null);
  const [selectedNetworkAffinity, setSelectedNetworkAffinity] = useState<NetworkAffinity | null>(null);
  const [selectedDesignLaunchResult, setSelectedDesignLaunchResult] = useState<DesignLaunchResult | null>(null);
  const [selectedProposedGraph, setSelectedProposedGraph] = useState<ProposedGraph | null>(null);
  const [selectedCommercialCorridorDraft, setSelectedCommercialCorridorDraft] = useState<CommercialCorridorDraft | null>(null);
  const [customerDesignImports, setCustomerDesignImports] = useState<CustomerDesignImport[]>([]);
  const [customerDesignLibraryLoaded, setCustomerDesignLibraryLoaded] = useState(false);
  const [selectedCustomerDesignImportId, setSelectedCustomerDesignImportId] = useState("");
  const [selectedCustomerDesignRouteId, setSelectedCustomerDesignRouteId] = useState("");
  const [selectedRouteEngineeringActivation, setSelectedRouteEngineeringActivation] = useState<RouteEngineeringActivationRequest | null>(null);
  const [selectedRouteEngineeringDraft, setSelectedRouteEngineeringDraft] = useState<RouteEngineeringDraft | null>(null);
  const [inventorySummaries, setInventorySummaries] = useState<DALInventorySummary[]>([]);

  const activateRouteEngineeringFromCommercialDraft = useCallback((args: {
    commercialDraft: CommercialCorridorDraft;
    accountId?: string;
    accountName?: string;
    opportunityId?: string;
    createdBy?: string;
    activationReason?: string;
  }) => {
    const request: RouteEngineeringActivationRequest = {
      requestId: `ROUTE-ENGINEERING-ACTIVATION-${args.commercialDraft.routeId}-${Date.now()}`,
      commercialDraft: args.commercialDraft,
      accountId: args.accountId,
      accountName: args.accountName,
      opportunityId: args.opportunityId,
      createdBy: args.createdBy,
      createdAt: new Date().toISOString(),
      sourceWorkspace: "COMMERCIAL_PLANNING",
      activationReason: args.activationReason ?? "Commercial Draft handed to Route Engineering.",
    };
    setSelectedCommercialCorridorDraft(args.commercialDraft);
    setSelectedRouteEngineeringActivation(request);
    setWorkspace("routeEngineering");
    return request;
  }, []);

  function upsertInventorySummary(summary: DALInventorySummary) {
    setInventorySummaries((prev) => [summary, ...prev.filter((item) => item.inventoryId !== summary.inventoryId)]);
  }

  useEffect(() => {
    let cancelled = false;
    listCustomerDesignImports()
      .then((records) => {
        if (cancelled) return;
        setCustomerDesignImports(records);
        setCustomerDesignLibraryLoaded(true);
        if (!selectedCustomerDesignImportId && records[0]) {
          setSelectedCustomerDesignImportId(records[0].importId);
          setSelectedCustomerDesignRouteId(records[0].activeRouteId ?? records[0].routes[0]?.routeId ?? "");
        }
      })
      .catch((error) => {
        console.warn("Customer Design Library load failed", error instanceof Error ? error.message : String(error));
        if (!cancelled) setCustomerDesignLibraryLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedCustomerDesignImport = useMemo(
    () => customerDesignImports.find((record) => record.importId === selectedCustomerDesignImportId) ?? null,
    [customerDesignImports, selectedCustomerDesignImportId],
  );

  function upsertCustomerDesignImport(record: CustomerDesignImport) {
    const normalized = normalizeCustomerDesignImport(record);
    setCustomerDesignImports((prev) => [normalized, ...prev.filter((item) => item.importId !== normalized.importId)]);
    setSelectedCustomerDesignImportId(normalized.importId);
    setSelectedCustomerDesignRouteId(normalized.activeRouteId ?? normalized.routes[0]?.routeId ?? "");
    void saveCustomerDesignImport(normalized).catch((error) => {
      console.warn("Customer Design Library save failed", error instanceof Error ? error.message : String(error));
    });
  }

  const value = useMemo(
    () => ({
      workspace,
      setWorkspace,
      selectedInventoryId,
      setSelectedInventoryId,
      selectedGraph,
      setSelectedGraph,
      selectedScopeVersionId,
      setSelectedScopeVersionId,
      selectedScopeVersion,
      setSelectedScopeVersion,
      selectedExtensionId,
      setSelectedExtensionId,
      selectedExtension,
      setSelectedExtension,
      selectedGraphFeature,
      setSelectedGraphFeature,
      selectedOpportunityId,
      setSelectedOpportunityId,
      selectedOpportunity,
      setSelectedOpportunity,
      selectedOpportunitySeedId,
      setSelectedOpportunitySeedId,
      selectedOpportunitySeed,
      setSelectedOpportunitySeed,
      selectedCandidateSiteId,
      setSelectedCandidateSiteId,
      selectedCandidateSite,
      setSelectedCandidateSite,
      selectedNetworkAffinity,
      setSelectedNetworkAffinity,
      selectedDesignLaunchResult,
      setSelectedDesignLaunchResult,
      selectedProposedGraph,
      setSelectedProposedGraph,
      selectedCommercialCorridorDraft,
      setSelectedCommercialCorridorDraft,
      customerDesignImports,
      customerDesignLibraryLoaded,
      selectedCustomerDesignImportId,
      setSelectedCustomerDesignImportId,
      selectedCustomerDesignRouteId,
      setSelectedCustomerDesignRouteId,
      selectedCustomerDesignImport,
      upsertCustomerDesignImport,
      selectedRouteEngineeringActivation,
      setSelectedRouteEngineeringActivation,
      selectedRouteEngineeringDraft,
      setSelectedRouteEngineeringDraft,
      activateRouteEngineeringFromCommercialDraft,
      inventorySummaries,
      upsertInventorySummary,
    }),
    [
      workspace,
      selectedInventoryId,
      selectedGraph,
      selectedScopeVersionId,
      selectedScopeVersion,
      selectedExtensionId,
      selectedExtension,
      selectedGraphFeature,
      selectedOpportunityId,
      selectedOpportunity,
      selectedOpportunitySeedId,
      selectedOpportunitySeed,
      selectedCandidateSiteId,
      selectedCandidateSite,
      selectedNetworkAffinity,
      selectedDesignLaunchResult,
      selectedProposedGraph,
      selectedCommercialCorridorDraft,
      customerDesignImports,
      customerDesignLibraryLoaded,
      selectedCustomerDesignImportId,
      selectedCustomerDesignRouteId,
      selectedCustomerDesignImport,
      selectedRouteEngineeringActivation,
      selectedRouteEngineeringDraft,
      activateRouteEngineeringFromCommercialDraft,
      inventorySummaries,
    ]
  );

  return <DALStateContext.Provider value={value}>{children}</DALStateContext.Provider>;
}

export function useDALState() {
  const context = useContext(DALStateContext);
  if (!context) throw new Error("useDALState must be used inside DALStateProvider");
  return context;
}
