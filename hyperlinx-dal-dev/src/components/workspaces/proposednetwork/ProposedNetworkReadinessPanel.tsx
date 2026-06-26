import type { ProposedGraph } from "../../../proposedGraph/ProposedGraph";

export default function ProposedNetworkReadinessPanel({ graph }: { graph: ProposedGraph }) {
  return (
    <section className="dal-panel">
      <div className="dal-panel-title-row">
        <h3>Customer Review</h3>
        <span className={`dal-badge ${graph.readiness === "BLOCKED" ? "fail" : "pass"}`}>{graph.readiness.replaceAll("_", " ")}</span>
      </div>
      <div className="dal-list">
        <div className="dal-list-row teralinx-list-row">
          <b>Visual Review</b>
          <span>{graph.readiness === "READY_FOR_ENGINEERING" ? "APPROVED" : "OPEN"}</span>
          <small>Customer review approves the ProposedGraph for Route Engineering eligibility only.</small>
        </div>
        <div className="dal-list-row teralinx-list-row">
          <b>Proposal Readiness</b>
          <span>{graph.readiness === "BLOCKED" ? "BLOCKED" : "READY"}</span>
          <small>Proposal documentation is generated from this ProposedGraph.</small>
        </div>
      </div>
    </section>
  );
}
