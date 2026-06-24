import type { PreliminaryQuoteWorkspace } from "../../../quote/PreliminaryQuoteWorkspace";

export default function QuoteAssumptionPanel({ workspace }: { workspace: PreliminaryQuoteWorkspace }) {
  return (
    <section className="dal-panel">
      <div className="dal-panel-title-row">
        <h3>Assumptions & Risks</h3>
        <span className="dal-badge warning">Engineering validation required</span>
      </div>

      <div className="dal-grid compact">
        <section className="dal-panel">
          <h3>Assumptions</h3>
          <div className="dal-list">
            {workspace.assumptions.map((assumption) => (
              <div className="dal-list-row opportunity-list-row" key={assumption.assumptionId}>
                <b>{assumption.category}</b>
                <span>{assumption.confidence}</span>
                <small>{assumption.statement}</small>
              </div>
            ))}
          </div>
        </section>

        <section className="dal-panel">
          <h3>Risks</h3>
          <div className="dal-list">
            {workspace.risks.map((risk) => (
              <div className="dal-list-row opportunity-list-row" key={risk.riskId}>
                <b>{risk.severity}</b>
                <span>Risk</span>
                <small>{risk.summary} Mitigation: {risk.mitigation}</small>
              </div>
            ))}
            {!workspace.risks.length && <div className="dal-status">No Prism risks projected into this quote fixture.</div>}
          </div>
        </section>
      </div>
    </section>
  );
}
