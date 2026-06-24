import type { OpportunityDetailWorkspace } from "../../../opportunity/OpportunityDetailWorkspace";

export default function OpportunityDiagnosticsPanel({ workspace }: { workspace: OpportunityDetailWorkspace }) {
  return (
    <details className="dal-panel">
      <summary>Advanced Diagnostics</summary>
      <div className="dal-grid compact">
        <section className="dal-panel">
          <h3>Traceability</h3>
          <div className="opportunity-facts">
            <span>Customer ID</span>
            <b>{workspace.summary.customerId}</b>
            <span>Opportunity ID</span>
            <b>{workspace.summary.opportunityId}</b>
            <span>Workspace ID</span>
            <b>{workspace.workspaceId}</b>
            <span>Persistence</span>
            <b>{workspace.noPersistence ? "Disabled" : "Enabled"}</b>
            <span>Server Routes</span>
            <b>{workspace.noServerRoutes ? "Disabled" : "Enabled"}</b>
          </div>
        </section>

        <section className="dal-panel">
          <h3>Blockers</h3>
          <div className="dal-list">
            {workspace.blockers.map((blocker) => (
              <div className="dal-list-row opportunity-list-row" key={blocker}>
                <b>{blocker}</b>
                <span>BLOCKER</span>
                <small>Workspace readiness</small>
              </div>
            ))}
            {!workspace.blockers.length && <div className="dal-status">No blockers.</div>}
          </div>
        </section>
      </div>

      <pre className="dal-pre">{JSON.stringify(workspace.diagnostics, null, 2)}</pre>
    </details>
  );
}
