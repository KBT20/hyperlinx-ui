import type { OpportunityDetailWorkspace } from "../../../opportunity/OpportunityDetailWorkspace";

export default function OpportunityNextActionPanel({ workspace }: { workspace: OpportunityDetailWorkspace }) {
  const { nextAction } = workspace;

  return (
    <section className="dal-panel opportunity-next-action">
      <div className="dal-panel-title-row">
        <h3>Next Action</h3>
        <span className="dal-badge warning">Visual only</span>
      </div>
      <div>
        <div className="opportunity-next-action-label">{nextAction.label}</div>
        <p>{nextAction.reason}</p>
      </div>
      <div className="opportunity-facts">
        <span>Action</span>
        <b>{nextAction.actionType}</b>
        <span>Target</span>
        <b>{nextAction.targetWorkspace}</b>
        <span>Blockers</span>
        <b>{nextAction.blockerCount}</b>
      </div>
      <button type="button" disabled>
        {nextAction.label}
      </button>
      <div className="dal-actions">
        <span className="dal-badge warning">Human approval required</span>
        <span className="dal-badge warning">Non-authoritative</span>
      </div>
    </section>
  );
}
