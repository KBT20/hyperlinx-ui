import type { PrismWorkspace } from "../../../prism/PrismWorkspace";

function riskClass(severity: string) {
  if (severity === "CRITICAL" || severity === "HIGH") return "fail";
  if (severity === "MEDIUM") return "warning";
  return "pass";
}

export default function PrismRiskPanel({ workspace }: { workspace: PrismWorkspace }) {
  return (
    <section className="dal-panel">
      <div className="dal-panel-title-row">
        <h3>Risks & Cost Drivers</h3>
        <span className="dal-badge warning">Human review required</span>
      </div>

      <div className="dal-grid compact">
        <section className="dal-panel">
          <h3>Risks</h3>
          <div className="dal-list">
            {workspace.risks.map((risk) => (
              <div className="dal-list-row opportunity-list-row" key={risk.riskId}>
                <b>{risk.riskCategory.replaceAll("_", " ")}</b>
                <span className={`dal-badge ${riskClass(risk.severity)}`}>{risk.severity}</span>
                <small>{risk.summary} Mitigation: {risk.mitigation}</small>
              </div>
            ))}
            {!workspace.risks.length && <div className="dal-status">No advisory risks generated.</div>}
          </div>
        </section>

        <section className="dal-panel">
          <h3>Cost Drivers</h3>
          <div className="dal-list">
            {workspace.costDrivers.map((driver) => (
              <div className="dal-list-row opportunity-list-row" key={driver.costDriverId}>
                <b>{driver.label}</b>
                <span>{driver.impact}</span>
                <small>{driver.summary}</small>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="dal-panel">
        <h3>Diversity Gaps</h3>
        <div className="dal-list">
          {workspace.diversityGaps.map((gap) => (
            <div className="dal-list-row opportunity-list-row" key={gap.gapId}>
              <b>{gap.gapType}</b>
              <span>Review</span>
              <small>{gap.summary} {gap.suggestedReview}</small>
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}
