import { useDALState, type DALWorkspace } from "./DALState";
import { useTeralinxAuth } from "../identity/TeralinxAuth";
import { canAccessWorkspace, workspaceAccessReason } from "../identity/teralinxIdentity";

type NavItem = { id: DALWorkspace; label: string };
type NavGroup = { label: string; items: NavItem[]; collapsed?: boolean };

const navGroups: NavGroup[] = [
  {
    label: "Evidence Intake",
    items: [
      { id: "translate", label: "Translate" },
      { id: "teralinxRoute", label: "Route Intake" },
    ],
  },
  {
    label: "Commercial",
    items: [
      { id: "googleRfp", label: "Commercial Planning" },
      { id: "design", label: "Commercial Design" },
      { id: "preliminaryProposal", label: "Proposal Readiness" },
      { id: "serviceOrder", label: "Service Order" },
    ],
  },
  {
    label: "Engineering",
    items: [
      { id: "routeEngineering", label: "Engineering Certification" },
    ],
  },
  {
    label: "Constitutional Truth",
    items: [
      { id: "scopeVersion", label: "ScopeVersion" },
    ],
  },
  {
    label: "Execution",
    items: [
      { id: "marketplace", label: "Marketplace" },
      { id: "control", label: "Control" },
      { id: "field", label: "Field" },
    ],
  },
  {
    label: "Operations",
    items: [
      { id: "twin", label: "Twin" },
      { id: "ops", label: "Operational Intelligence" },
    ],
  },
  {
    label: "System",
    items: [
      { id: "inventory", label: "Inventory Graphs" },
      { id: "inventoryRecovery", label: "Inventory Recovery" },
      { id: "graphViewer", label: "Graph Viewer" },
      { id: "graphExtensions", label: "Graph Extensions" },
    ],
  },
  {
    label: "Preview / Future / Advanced",
    collapsed: true,
    items: [
      { id: "portfolio", label: "Portfolio" },
      { id: "prism", label: "Prism" },
      { id: "candidateSites", label: "Candidate Sites" },
      { id: "networkAffinity", label: "Network Affinity" },
      { id: "siteDecision", label: "Site Decision" },
      { id: "proposedNetwork", label: "Network Preview" },
    ],
  },
];

export default function DALNavigation({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { workspace, setWorkspace } = useDALState();
  const { session } = useTeralinxAuth();
  const user = session?.user ?? null;
  const visibleGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => canAccessWorkspace(user, item.id)),
    }))
    .filter((group) => group.items.length);

  return (
    <nav className={`dal-nav ${open ? "open" : ""}`} aria-label="DAL workspaces" aria-hidden={!open}>
      <div className="dal-nav-header">
        <div><span>Navigation</span><b>Workspaces</b></div>
        <button type="button" onClick={onClose} aria-label="Close workspace navigation">Close</button>
      </div>
      {visibleGroups.map((group) => {
        const items = group.items.map((item) => (
            <button
              key={item.id}
              className={workspace === item.id ? "dal-nav-item active" : "dal-nav-item"}
              type="button"
              onClick={() => { setWorkspace(item.id); onClose(); }}
              title={workspaceAccessReason(user, item.id)}
            >
              {item.label}
            </button>
        ));
        return group.collapsed ? (
          <details className="dal-nav-group dal-nav-group-collapsed" key={group.label}>
            <summary className="dal-nav-group-title">{group.label}</summary>
            {items}
          </details>
        ) : (
          <section className="dal-nav-group" key={group.label}>
            <div className="dal-nav-group-title">{group.label}</div>
            {items}
          </section>
        );
      })}
    </nav>
  );
}
