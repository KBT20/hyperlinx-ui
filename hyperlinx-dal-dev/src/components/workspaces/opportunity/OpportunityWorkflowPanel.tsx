import type { OpportunityDetailWorkspace } from "../../../opportunity/OpportunityDetailWorkspace";
import type { OpportunityStatusCard } from "../../../opportunity/OpportunityStatusCard";

function cardStatusClass(status: OpportunityStatusCard["status"]) {
  if (status === "COMPLETE" || status === "READY") return "pass";
  if (status === "BLOCKED") return "fail";
  return "warning";
}

function cardTitle(card: OpportunityStatusCard) {
  return card.cardType.replaceAll("_", " ");
}

export default function OpportunityWorkflowPanel({ workspace }: { workspace: OpportunityDetailWorkspace }) {
  return (
    <section className="dal-panel">
      <div className="dal-panel-title-row">
        <h3>Workflow</h3>
        <div className="dal-actions">
          <span className="dal-badge warning">Advisory only</span>
          <span className="dal-badge warning">No ScopeVersion mutation</span>
        </div>
      </div>

      <div className="opportunity-workflow-grid">
        {workspace.statusCards.map((card) => (
          <article className="opportunity-status-card" key={card.cardId}>
            <div className="dal-panel-title-row">
              <h3>{cardTitle(card)}</h3>
              <span className={`dal-badge ${cardStatusClass(card.status)}`}>{card.status.replaceAll("_", " ")}</span>
            </div>
            <p>{card.summary}</p>
            <div className="dal-status">Updated: {card.lastUpdated}</div>
            {card.nextAction && <span className="dal-badge pass">Next: {card.nextAction.label}</span>}
            {card.blockers.length > 0 && (
              <div className="opportunity-blockers">
                {card.blockers.map((blocker) => (
                  <span className="dal-badge fail" key={`${card.cardId}-${blocker}`}>
                    {blocker}
                  </span>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
