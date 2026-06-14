import { DAL_API, DAL_APP_NAME, DAL_BASELINE_GRAPH_API } from "../config/dalApi";
import DALInventoryWorkspace from "../workspaces/DALInventoryWorkspace";
import DALPlaceholderWorkspace from "../workspaces/DALPlaceholderWorkspace";
import DALNavigation from "./DALNavigation";
import { DALStateProvider, useDALState } from "./DALState";

function DALWorkspaceOutlet() {
  const { workspace } = useDALState();

  if (workspace === "inventory") return <DALInventoryWorkspace />;
  if (workspace === "design") return <DALPlaceholderWorkspace title="Design" />;
  if (workspace === "prism") return <DALPlaceholderWorkspace title="Prism" />;
  return <DALPlaceholderWorkspace title="Translate" />;
}

function DALShell() {
  return (
    <div className="dal-shell">
      <header className="dal-header">
        <div>
          <div className="dal-kicker">HYPERLINX DAL DEVELOPMENT</div>
          <h1>{DAL_APP_NAME}</h1>
        </div>
        <div className="dal-targets">
          <span>DAL API: {DAL_API}</span>
          <span>Inventory API: {DAL_BASELINE_GRAPH_API}</span>
        </div>
      </header>
      <div className="dal-layout">
        <DALNavigation />
        <main className="dal-main">
          <DALWorkspaceOutlet />
        </main>
      </div>
    </div>
  );
}

export default function DALApp() {
  return (
    <DALStateProvider>
      <DALShell />
    </DALStateProvider>
  );
}
