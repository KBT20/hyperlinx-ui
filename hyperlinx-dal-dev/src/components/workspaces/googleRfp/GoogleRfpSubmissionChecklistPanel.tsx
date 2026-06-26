import type { GoogleRfpBidPlan } from "../../../rfp/GoogleRfpBidPlan";

export default function GoogleRfpSubmissionChecklistPanel({ bidPlan }: { bidPlan: GoogleRfpBidPlan }) {
  return (
    <section className="dal-panel">
      <div className="dal-panel-title-row">
        <h3>Submission Checklist</h3>
        <span className="dal-badge warning">Human action required</span>
      </div>
      <div className="dal-list">
        {bidPlan.checklist.map((item) => (
          <div className="dal-list-row teralinx-list-row" key={item.checklistItemId}>
            <b>{item.label}</b>
            <span>{item.status.replaceAll("_", " ")}</span>
            <small>No external submission is performed by DAL.</small>
          </div>
        ))}
      </div>
    </section>
  );
}
