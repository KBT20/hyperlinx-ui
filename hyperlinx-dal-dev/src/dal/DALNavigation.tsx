import { useDALState, type DALWorkspace } from "./DALState";

type DALNavigationItem = {
  id: DALWorkspace;
  label: string;
};

type DALNavigationGroup = {
  group: string;
  items: Array<DALNavigationItem | { label: string; children: DALNavigationItem[] }>;
};

const groups: DALNavigationGroup[] = [
  {
    group: "Business",
    items: [
      { id: "customers", label: "Customers" },
      { id: "opportunity", label: "Opportunities" },
      { id: "portfolio", label: "Portfolio" },
      { id: "marketplace", label: "Marketplace" },
      { id: "preliminaryQuote", label: "Preliminary Quote" },
    ],
  },
  {
    group: "Design",
    items: [
      { id: "translate", label: "Translate" },
      { id: "scopeReview", label: "Scope Review" },
      { id: "prismWorkspace", label: "Prism Workspace" },
      { id: "routeEngineering", label: "Route Engineering" },
    ],
  },
  {
    group: "Execution",
    items: [
      {
        label: "Execution",
        children: [
          { id: "control", label: "Control" },
          { id: "field", label: "Field" },
          { id: "completion", label: "Completion" },
          { id: "ops", label: "Operations" },
        ],
      },
    ],
  },
  {
    group: "Operations",
    items: [
      { id: "twin", label: "Twin" },
      { id: "ops", label: "Operational Intelligence" },
    ],
  },
  {
    group: "Advanced",
    items: [
      {
        label: "Graph",
        children: [
          { id: "inventory", label: "Inventory Graphs" },
          { id: "inventoryRecovery", label: "Inventory Recovery" },
          { id: "graphViewer", label: "Graph Viewer" },
          { id: "graphExtensions", label: "Graph Extensions" },
        ],
      },
      {
        label: "Legacy Development",
        children: [
          { id: "prism", label: "Prism" },
          { id: "siteDecision", label: "Site Decision" },
          { id: "candidateSites", label: "Candidate Sites" },
          { id: "networkAffinity", label: "Network Affinity" },
          { id: "design", label: "Design" },
        ],
      },
    ],
  },
];

export default function DALNavigation() {
  const { workspace, setWorkspace } = useDALState();

  function renderItem(item: DALNavigationItem) {
    return (
      <button
        key={item.id}
        className={workspace === item.id ? "dal-nav-item active" : "dal-nav-item"}
        type="button"
        onClick={() => setWorkspace(item.id)}
      >
        {item.label}
      </button>
    );
  }

  return (
    <nav className="dal-nav" aria-label="DAL workspaces">
      {groups.map((group) => (
        <section className="dal-nav-group" key={group.group}>
          <div className="dal-nav-group-label">{group.group}</div>
          {group.items.map((item) => {
            if ("id" in item) return renderItem(item);
            return (
              <div className="dal-nav-subgroup" key={item.label}>
                <div className="dal-nav-subgroup-label">{item.label}</div>
                <div className="dal-nav-subgroup-items">{item.children.map(renderItem)}</div>
              </div>
            );
          })}
        </section>
      ))}
    </nav>
  );
}
