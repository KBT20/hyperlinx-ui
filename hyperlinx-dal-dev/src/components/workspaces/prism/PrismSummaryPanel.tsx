import type { PrismWorkspace } from "../../../prism/PrismWorkspace";

function statusClass(status: string) {
  if (status === "READY_FOR_QUOTE") return "pass";
  if (status === "BLOCKED") return "fail";
  return "warning";
}

export default function PrismSummaryPanel({ workspace }: { workspace: PrismWorkspace }) {
  const { summary } = workspace;

  return (
    <section className="dal-panel">
      <div className="dal-panel-title-row">
        <h3>Prism Summary</h3>
        <span className={`dal-badge ${statusClass(summary.status)}`}>{summary.status.replaceAll("_", " ")}</span>
      </div>

      <div className="opportunity-facts">
        <span>Customer</span>
        <b>{summary.customerName}</b>
        <span>Opportunity</span>
        <b>{summary.opportunityName}</b>
        <span>Network Type</span>
        <b>{summary.networkType}</b>
        <span>Protection</span>
        <b>{summary.protectionSchema}</b>
        <span>Baseline Objects</span>
        <b>{summary.baselineObjectCount}</b>
        <span>Marketplace Matches</span>
        <b>{summary.marketplaceMatchCount}</b>
        <span>Route Alternatives</span>
        <b>{summary.routeAlternativeCount}</b>
        <span>Next Action</span>
        <b>{summary.nextAction}</b>
      </div>
    </section>
  );
}
