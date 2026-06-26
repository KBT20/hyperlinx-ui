import type { ProposedGraph } from "../../../proposedGraph/ProposedGraph";

function fmt(value: number) {
  return Math.round(value).toLocaleString();
}

export default function ProposedRouteStatisticsPanel({ graph }: { graph: ProposedGraph }) {
  const stats = graph.routeStatistics;
  const takeoff = graph.takeoff;
  return (
    <section className="dal-panel">
      <div className="dal-panel-title-row">
        <h3>Route Statistics</h3>
        <span className="dal-badge warning">{takeoff ? "Centerline takeoff" : "Estimated"}</span>
      </div>
      <div className="teralinx-summary-grid">
        <div>
          <span>Total Route Length</span>
          <b>{(takeoff?.routeMiles ?? stats.totalRouteLengthMiles).toLocaleString()} mi</b>
        </div>
        <div>
          <span>Fiber Feet</span>
          <b>{fmt(takeoff?.fiberFeet ?? stats.fiberFeet)}</b>
        </div>
        <div>
          <span>Duct Feet</span>
          <b>{fmt(takeoff?.ductFeet ?? stats.ductFeet)}</b>
        </div>
        <div>
          <span>Estimated Stations</span>
          <b>{fmt(graph.stationedCorridor?.stations.length ?? stats.estimatedStationCount)}</b>
        </div>
        <div>
          <span>Confidence</span>
          <b>{takeoff?.confidence ?? stats.confidenceScore}</b>
        </div>
        <div>
          <span>Source</span>
          <b>{graph.centerlineRoute?.source ?? "ROUTE_CANDIDATE"}</b>
        </div>
      </div>
    </section>
  );
}
