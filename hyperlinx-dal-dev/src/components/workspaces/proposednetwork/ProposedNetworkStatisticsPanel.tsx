import type { ProposedGraph } from "../../../proposedGraph/ProposedGraph";

export default function ProposedNetworkStatisticsPanel({ graph }: { graph: ProposedGraph }) {
  const stats = graph.statistics;
  return (
    <section className="dal-panel">
      <div className="dal-panel-title-row">
        <h3>ProposedGraph Statistics</h3>
        <span className="dal-badge warning">Sales estimate</span>
      </div>
      <div className="teralinx-summary-grid">
        <div>
          <span>Mileage</span>
          <b>{stats.totalMiles.toLocaleString()}</b>
        </div>
        <div>
          <span>Nodes</span>
          <b>{graph.nodes.length.toLocaleString()}</b>
        </div>
        <div>
          <span>Segments</span>
          <b>{graph.edges.length.toLocaleString()}</b>
        </div>
        <div>
          <span>RouteCandidate</span>
          <b>{graph.routeCandidateId}</b>
        </div>
        <div>
          <span>Centerline Route</span>
          <b>{graph.centerlineRouteId ?? "Not available"}</b>
        </div>
        <div>
          <span>Stationed Corridor</span>
          <b>{graph.stationedCorridorId ?? "Not available"}</b>
        </div>
        <div>
          <span>Crossings</span>
          <b>{stats.estimatedCrossings.toLocaleString()}</b>
        </div>
        <div>
          <span>Vaults</span>
          <b>{stats.estimatedVaults.toLocaleString()}</b>
        </div>
        <div>
          <span>Fiber Feet</span>
          <b>{stats.fiberFeet.toLocaleString()}</b>
        </div>
        <div>
          <span>Duct Feet</span>
          <b>{stats.ductFeet.toLocaleString()}</b>
        </div>
        <div>
          <span>Construction Cost</span>
          <b>${stats.estimatedConstructionCost.toLocaleString()}</b>
        </div>
        <div>
          <span>Confidence</span>
          <b>{stats.confidenceScore}</b>
        </div>
      </div>
    </section>
  );
}
