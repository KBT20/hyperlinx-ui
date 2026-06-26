import type { ProposalFixture } from "../../../proposal/fixtures/proposalFixtures";
import type { ProposedInventory } from "../../../proposal/ProposedInventory";
import type { PreliminaryQuotePackage } from "../../../proposal/PreliminaryQuotePackage";
import type { ProposedGraph } from "../../../proposedGraph/ProposedGraph";
import { formatNetworkClass } from "../../../designDoctrine/NetworkClass";
import { formatProtectionClass } from "../../../designDoctrine/ProtectionClass";
import { formatTopologyClass } from "../../../designDoctrine/TopologyClass";

export default function ProposalSummaryPanel({
  fixture,
  proposedGraph,
  proposedInventory,
  quotePackage,
}: {
  fixture: ProposalFixture;
  proposedGraph: ProposedGraph | null;
  proposedInventory: ProposedInventory | null;
  quotePackage: PreliminaryQuotePackage | null;
}) {
  const inventory = proposedInventory ?? fixture.proposedInventory;

  return (
    <section className="dal-panel">
      <div className="dal-panel-title-row">
        <h3>Proposal Summary</h3>
        <span className={`dal-badge ${inventory ? "pass" : "fail"}`}>{inventory ? "PROPOSED INVENTORY" : "BLOCKED"}</span>
      </div>
      <div className="teralinx-summary-grid">
        <div>
          <span>Customer</span>
          <b>{proposedGraph?.customerName ?? "Missing"}</b>
        </div>
        <div>
          <span>Opportunity</span>
          <b>{proposedGraph?.opportunityName ?? "Missing"}</b>
        </div>
        <div>
          <span>ProposedGraph</span>
          <b>{proposedGraph?.proposedGraphId ?? "Missing"}</b>
        </div>
        <div>
          <span>RouteCandidate</span>
          <b>{proposedGraph?.routeCandidateId ?? "Missing"}</b>
        </div>
        <div>
          <span>Centerline Route</span>
          <b>{proposedGraph?.centerlineRouteId ?? "Missing"}</b>
        </div>
        <div>
          <span>Stationed Corridor</span>
          <b>{proposedGraph?.stationedCorridorId ?? "Missing"}</b>
        </div>
        <div>
          <span>Takeoff</span>
          <b>{proposedGraph?.takeoffId ?? "Missing"}</b>
        </div>
        <div>
          <span>Design Doctrine</span>
          <b>{proposedGraph?.designDoctrineId ?? "Missing"}</b>
        </div>
        <div>
          <span>Network Class</span>
          <b>{proposedGraph ? formatNetworkClass(proposedGraph.networkClass) : "Missing"}</b>
        </div>
        <div>
          <span>Topology</span>
          <b>{proposedGraph ? formatTopologyClass(proposedGraph.topology) : "Missing"}</b>
        </div>
        <div>
          <span>Protection</span>
          <b>{proposedGraph ? formatProtectionClass(proposedGraph.protectionClass, proposedGraph.networkClass) : "Missing"}</b>
        </div>
        <div>
          <span>Product</span>
          <b>{inventory?.primaryProduct ?? "Missing"}</b>
        </div>
        <div>
          <span>Estimated Miles</span>
          <b>{inventory?.estimatedMileage.toLocaleString() ?? "0"}</b>
        </div>
        <div>
          <span>Estimated NRC</span>
          <b>{quotePackage ? `$${quotePackage.estimatedNrc.toLocaleString()}` : "Not generated"}</b>
        </div>
        <div>
          <span>Estimated MRC</span>
          <b>{quotePackage ? `$${quotePackage.estimatedMrc.toLocaleString()}` : "Not generated"}</b>
        </div>
      </div>
    </section>
  );
}
