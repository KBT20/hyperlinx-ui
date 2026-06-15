import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { InventoryGraph, InventoryGraphMetadata, PrismOpportunity, ScopeVersion } from "../types/dal";
import type { CandidateSite } from "../types/candidateSite";
import type { GraphExtension } from "../types/graphExtension";
import type { NetworkAffinity } from "../types/networkAffinity";
import type { OpportunitySeed } from "../types/portfolio";

export type DALWorkspace =
  | "translate"
  | "inventory"
  | "graphViewer"
  | "graphExtensions"
  | "design"
  | "prism"
  | "siteDecision"
  | "candidateSites"
  | "networkAffinity"
  | "portfolio"
  | "marketplace"
  | "control"
  | "field"
  | "twin"
  | "ops";

export type DALInventorySummary = InventoryGraphMetadata;

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
  inventorySummaries: DALInventorySummary[];
  upsertInventorySummary: (summary: DALInventorySummary) => void;
};

const DALStateContext = createContext<DALState | null>(null);

export function DALStateProvider({ children }: { children: ReactNode }) {
  const [workspace, setWorkspace] = useState<DALWorkspace>("translate");
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
  const [inventorySummaries, setInventorySummaries] = useState<DALInventorySummary[]>([]);

  function upsertInventorySummary(summary: DALInventorySummary) {
    setInventorySummaries((prev) => [summary, ...prev.filter((item) => item.inventoryId !== summary.inventoryId)]);
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
