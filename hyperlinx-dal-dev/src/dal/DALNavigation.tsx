import { useDALState, type DALWorkspace } from "./DALState";

const items: Array<{ id: DALWorkspace; label: string }> = [
  { id: "inventory", label: "Inventory Graphs" },
  { id: "design", label: "Design" },
  { id: "prism", label: "Prism" },
  { id: "translate", label: "Translate" },
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
