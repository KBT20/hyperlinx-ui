import type { PrismWorkspace } from "../../../prism/PrismWorkspace";

export default function PrismDiagnosticsPanel({ workspace }: { workspace: PrismWorkspace }) {
  return (
    <details className="dal-panel">
      <summary>Advanced Diagnostics</summary>
      <div className="dal-grid compact">
        <section className="dal-panel">
          <h3>Blockers</h3>
          <div className="dal-list">
            {workspace.blockers.map((blocker) => (
              <div className="dal-list-row opportunity-list-row" key={blocker.blockerId}>
                <b>{blocker.severity}</b>
                <span>BLOCKER</span>
                <small>{blocker.message} Required: {blocker.requiredAction}</small>
              </div>
            ))}
            {!workspace.blockers.length && <div className="dal-status">No Prism blockers.</div>}
          </div>
        </section>

        <section className="dal-panel">
          <h3>Authority Boundary</h3>
          <div className="opportunity-facts">
            <span>Persistence</span>
            <b>{workspace.noPersistence ? "Disabled" : "Enabled"}</b>
            <span>Server Routes</span>
            <b>{workspace.noServerRoutes ? "Disabled" : "Enabled"}</b>
            <span>Authority</span>
            <b>{workspace.noAuthorityCreated ? "Not created" : "Created"}</b>
            <span>Lifecycle Mutation</span>
            <b>{workspace.noLifecycleMutation ? "No" : "Yes"}</b>
            <span>ScopeVersion Mutation</span>
            <b>{workspace.noScopeVersionMutation ? "No" : "Yes"}</b>
          </div>
        </section>
      </div>

      <pre className="dal-pre">{JSON.stringify(workspace.diagnostics, null, 2)}</pre>
    </details>
  );
}
