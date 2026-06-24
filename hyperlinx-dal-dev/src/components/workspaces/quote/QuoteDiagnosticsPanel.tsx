import type { PreliminaryQuoteWorkspace } from "../../../quote/PreliminaryQuoteWorkspace";

export default function QuoteDiagnosticsPanel({ workspace }: { workspace: PreliminaryQuoteWorkspace }) {
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
            {!workspace.blockers.length && <div className="dal-status">No quote blockers.</div>}
          </div>
        </section>

        <section className="dal-panel">
          <h3>Authority Boundary</h3>
          <div className="opportunity-facts">
            <span>Persistence</span>
            <b>{workspace.noPersistence ? "Disabled" : "Enabled"}</b>
            <span>Server Routes</span>
            <b>{workspace.noServerRoutes ? "Disabled" : "Enabled"}</b>
            <span>Contract Authority</span>
            <b>{workspace.noContractAuthority ? "Not created" : "Created"}</b>
            <span>Budget Lock</span>
            <b>{workspace.noBudgetLock ? "Not created" : "Created"}</b>
            <span>SOF</span>
            <b>{workspace.noSof ? "Not created" : "Created"}</b>
          </div>
        </section>
      </div>

      <pre className="dal-pre">{JSON.stringify(workspace.diagnostics, null, 2)}</pre>
    </details>
  );
}
