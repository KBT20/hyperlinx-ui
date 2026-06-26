import type { ProposedGraph } from "../../../proposedGraph/ProposedGraph";

function money(value: number) {
  return `$${Math.round(value).toLocaleString()}`;
}

export default function ProposedEstimatedInfrastructurePanel({ graph }: { graph: ProposedGraph }) {
  const takeoff = graph.takeoff;
  return (
    <section className="dal-panel">
      <div className="dal-panel-title-row">
        <h3>Estimated Infrastructure</h3>
        <span className="dal-badge warning">Sales Estimate</span>
      </div>
      <div className="teralinx-summary-grid">
        <div>
          <span>Estimated Vaults / Handholes</span>
          <b>{((takeoff?.vaultCount ?? graph.routeStatistics.estimatedVaultCount) + (takeoff?.handholeCount ?? 0)).toLocaleString()}</b>
        </div>
        <div>
          <span>Estimated Regen Sites</span>
          <b>{(takeoff?.regenSiteCount ?? graph.routeStatistics.estimatedRegenCount).toLocaleString()}</b>
        </div>
        <div>
          <span>Segments</span>
          <b>{(graph.stationedCorridor?.segments.length ?? graph.routeCandidate.segments.length).toLocaleString()}</b>
        </div>
        <div>
          <span>Construction Cost</span>
          <b>{money(takeoff?.estimatedConstructionCost ?? graph.routeStatistics.estimatedConstructionCost)}</b>
        </div>
        <div>
          <span>Construction Profile</span>
          <b>{graph.routeCandidate.estimatedConstructionProfile}</b>
        </div>
        <div>
          <span>Material Profile</span>
          <b>{graph.routeCandidate.estimatedMaterialProfile}</b>
        </div>
        <div>
          <span>Takeoff Source</span>
          <b>{takeoff?.takeoffId ?? "RouteCandidate"}</b>
        </div>
      </div>
    </section>
  );
}
