import type { PreliminaryQuoteWorkspace } from "../../../quote/PreliminaryQuoteWorkspace";

function confidenceClass(confidence: string) {
  if (confidence === "HIGH") return "pass";
  if (confidence === "MEDIUM") return "warning";
  return "fail";
}

export default function QuoteConfidencePanel({ workspace }: { workspace: PreliminaryQuoteWorkspace }) {
  const basis = workspace.confidenceBasis;

  return (
    <section className="dal-panel">
      <div className="dal-panel-title-row">
        <h3>Confidence</h3>
        <span className={`dal-badge ${confidenceClass(basis.overallConfidence)}`}>{basis.overallConfidence}</span>
      </div>

      <div className="opportunity-facts">
        <span>Data</span>
        <b>{basis.dataCompleteness}</b>
        <span>Marketplace</span>
        <b>{basis.marketplaceCompleteness}</b>
        <span>Architecture</span>
        <b>{basis.architectureCompleteness}</b>
        <span>Review</span>
        <b>{basis.reviewCompleteness}</b>
        <span>Prism</span>
        <b>{basis.prismCompleteness}</b>
      </div>

      <div className="dal-actions">
        <span className="dal-badge warning">Preliminary</span>
        <span className="dal-badge warning">Non-contractual</span>
        <span className="dal-badge warning">No budget lock</span>
        <span className="dal-badge warning">No SOF</span>
      </div>
    </section>
  );
}
