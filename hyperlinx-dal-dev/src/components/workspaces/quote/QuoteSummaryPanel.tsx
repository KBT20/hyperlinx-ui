import type { PreliminaryQuoteWorkspace } from "../../../quote/PreliminaryQuoteWorkspace";

function money(value: number) {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function readinessClass(readiness: string) {
  if (readiness === "QUOTE_GENERATED" || readiness === "READY_FOR_QUOTE") return "pass";
  if (readiness === "BLOCKED") return "fail";
  return "warning";
}

export default function QuoteSummaryPanel({ workspace }: { workspace: PreliminaryQuoteWorkspace }) {
  const { summary } = workspace;

  return (
    <section className="dal-panel">
      <div className="dal-panel-title-row">
        <h3>Quote Summary</h3>
        <span className={`dal-badge ${readinessClass(summary.readiness)}`}>{summary.readiness.replaceAll("_", " ")}</span>
      </div>

      <div className="quote-total-grid">
        <div>
          <span>Estimated NRC</span>
          <b>{money(summary.estimatedNrc)}</b>
        </div>
        <div>
          <span>Estimated MRC</span>
          <b>{money(summary.estimatedMrc)}</b>
        </div>
        <div>
          <span>Term</span>
          <b>{summary.estimatedTermMonths} months</b>
        </div>
        <div>
          <span>Estimated TCV</span>
          <b>{money(summary.estimatedTcv)}</b>
        </div>
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
        <span>Reference Architecture</span>
        <b>{summary.referenceArchitecture}</b>
        <span>Next Action</span>
        <b>{summary.nextAction}</b>
      </div>
    </section>
  );
}
