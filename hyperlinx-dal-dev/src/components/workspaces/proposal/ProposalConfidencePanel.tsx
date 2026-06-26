import type { PreliminaryQuotePackage } from "../../../proposal/PreliminaryQuotePackage";

export default function ProposalConfidencePanel({ quotePackage }: { quotePackage: PreliminaryQuotePackage | null }) {
  return (
    <section className="dal-panel">
      <div className="dal-panel-title-row">
        <h3>Quote Confidence</h3>
        <span className={`dal-badge ${quotePackage?.confidence === "HIGH" ? "pass" : quotePackage ? "warning" : "fail"}`}>
          {quotePackage?.confidence ?? "NOT GENERATED"}
        </span>
      </div>
      <div className="dal-list">
        <div className="dal-list-row teralinx-list-row">
          <b>Route Confidence</b>
          <span>{quotePackage ? "PRELIMINARY" : "WAITING"}</span>
          <small>Route confidence is sales-estimate confidence only until Route Engineering validates the design.</small>
        </div>
        <div className="dal-list-row teralinx-list-row">
          <b>Inventory Confidence</b>
          <span>{quotePackage ? "PROPOSED" : "WAITING"}</span>
          <small>Proposed inventory is not an Inventory Graph and does not create authority.</small>
        </div>
        <div className="dal-list-row teralinx-list-row">
          <b>Financial Confidence</b>
          <span>{quotePackage?.confidence ?? "WAITING"}</span>
          <small>Fixture values are advisory and non-contractual.</small>
        </div>
      </div>
    </section>
  );
}
