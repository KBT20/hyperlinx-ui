import { useDALState, type DALWorkspace } from "./DALState";

const items: Array<{ id: DALWorkspace; label: string }> = [
  { id: "translate", label: "Translate" },
  { id: "inventory", label: "Inventory Graphs" },
  { id: "inventoryRecovery", label: "Inventory Recovery" },
  { id: "graphViewer", label: "Graph Viewer" },
  { id: "graphExtensions", label: "Graph Extensions" },
  { id: "prism", label: "Prism" },
  { id: "siteDecision", label: "Site Decision" },
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

  return (
    <nav className="dal-nav" aria-label="DAL workspaces">
      {items.map((item) => (
        <button
          key={item.id}
          className={workspace === item.id ? "dal-nav-item active" : "dal-nav-item"}
          type="button"
          onClick={() => setWorkspace(item.id)}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}
