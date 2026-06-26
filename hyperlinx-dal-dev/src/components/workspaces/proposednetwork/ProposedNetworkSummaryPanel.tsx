import type { ProposedGraph } from "../../../proposedGraph/ProposedGraph";
import { formatNetworkClass } from "../../../designDoctrine/NetworkClass";
import { formatProtectionClass } from "../../../designDoctrine/ProtectionClass";
import { formatTopologyClass } from "../../../designDoctrine/TopologyClass";

export default function ProposedNetworkSummaryPanel({ graph }: { graph: ProposedGraph }) {
  return (
    <section className="dal-panel">
      <div className="dal-panel-title-row">
        <h3>Proposed Network Summary</h3>
        <span className={`dal-badge ${graph.readiness === "BLOCKED" ? "fail" : "pass"}`}>{graph.readiness.replaceAll("_", " ")}</span>
      </div>
      <div className="teralinx-summary-grid">
        <div>
          <span>Customer</span>
          <b>{graph.customerName}</b>
        </div>
        <div>
          <span>Opportunity</span>
          <b>{graph.opportunityName}</b>
        </div>
        <div>
          <span>ProposedGraph</span>
          <b>{graph.proposedGraphId}</b>
        </div>
        <div>
          <span>Design Doctrine</span>
          <b>{graph.designDoctrineId}</b>
        </div>
        <div>
          <span>Network Class</span>
          <b>{formatNetworkClass(graph.networkClass)}</b>
        </div>
        <div>
          <span>Topology</span>
          <b>{formatTopologyClass(graph.topology)}</b>
        </div>
        <div>
          <span>Protection</span>
          <b>{formatProtectionClass(graph.protectionClass, graph.networkClass)}</b>
        </div>
        <div>
          <span>Primary Product</span>
          <b>{graph.primaryProduct}</b>
        </div>
        <div>
          <span>Ready for Proposal</span>
          <b>{graph.readiness === "BLOCKED" ? "No" : "Yes"}</b>
        </div>
      </div>
    </section>
  );
}
