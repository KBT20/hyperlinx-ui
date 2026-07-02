import { useDALState, type DALWorkspace } from "./DALState";
import { useTeralinxAuth } from "../identity/TeralinxAuth";
import { canAccessWorkspace, workspaceAccessReason } from "../identity/teralinxIdentity";

const items: Array<{ id: DALWorkspace; label: string }> = [
  { id: "googleRfp", label: "Commercial Planning" },
  { id: "translate", label: "Translate" },
  { id: "teralinxRoute", label: "Teralinx Route" },
  { id: "design", label: "Design" },
  { id: "proposedNetwork", label: "Proposed Network" },
  { id: "preliminaryProposal", label: "Preliminary Proposal" },
  { id: "inventory", label: "Inventory Graphs" },
  { id: "inventoryRecovery", label: "Inventory Recovery" },
  { id: "graphViewer", label: "Graph Viewer" },
  { id: "graphExtensions", label: "Graph Extensions" },
  { id: "prism", label: "Prism" },
  { id: "siteDecision", label: "Site Decision" },
  { id: "routeEngineering", label: "Engineering Certification" },
  { id: "candidateSites", label: "Candidate Sites" },
  { id: "networkAffinity", label: "Network Affinity" },
  { id: "portfolio", label: "Portfolio" },
  { id: "marketplace", label: "Marketplace" },
  { id: "control", label: "Control" },
  { id: "field", label: "Field" },
  { id: "twin", label: "Twin" },
  { id: "ops", label: "Operational Intelligence" },
];

export default function DALNavigation() {
  const { workspace, setWorkspace } = useDALState();
  const { session } = useTeralinxAuth();
  const user = session?.user ?? null;
  const visibleItems = items.filter((item) => canAccessWorkspace(user, item.id));

  return (
    <nav className="dal-nav" aria-label="DAL workspaces">
      {visibleItems.map((item) => (
        <button
          key={item.id}
          className={workspace === item.id ? "dal-nav-item active" : "dal-nav-item"}
          type="button"
          onClick={() => setWorkspace(item.id)}
          title={workspaceAccessReason(user, item.id)}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}
