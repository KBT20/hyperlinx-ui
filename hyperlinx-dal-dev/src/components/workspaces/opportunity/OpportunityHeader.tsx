import type { OpportunityDetailWorkspace } from "../../../opportunity/OpportunityDetailWorkspace";

function label(value: string | undefined) {
  return value ? value.replaceAll("_", " ") : "Not selected";
}

function statusClass(status: string) {
  if (status.includes("BLOCKED")) return "fail";
  if (status.includes("READY") || status.includes("COMPLETE")) return "pass";
  return "warning";
}

export default function OpportunityHeader({ workspace }: { workspace: OpportunityDetailWorkspace }) {
  const { summary } = workspace;

  return (
    <div className="opportunity-header dal-panel">
      <div>
        <div className="dal-kicker">OPPORTUNITY DETAIL</div>
        <h2>{summary.opportunityName}</h2>
        <p>{summary.customerName}</p>
      </div>

      <div className="opportunity-header-meta">
        <span className={`dal-badge ${statusClass(workspace.status)}`}>{label(workspace.status)}</span>
        <span>{label(summary.networkType)}</span>
        <span>{label(summary.protectionSchema)}</span>
        <span>Owner: {summary.accountOwner}</span>
      </div>
    </div>
  );
}
