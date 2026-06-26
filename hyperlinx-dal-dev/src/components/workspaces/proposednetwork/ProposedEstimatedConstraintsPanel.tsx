import type { ProposedGraph } from "../../../proposedGraph/ProposedGraph";

export default function ProposedEstimatedConstraintsPanel({ graph }: { graph: ProposedGraph }) {
  const takeoff = graph.takeoff;
  const crossingObjects =
    graph.stationedCorridor?.inventoryObjects.filter((object) => object.objectType.includes("CROSSING") || object.objectType === "UNKNOWN_CONSTRAINT") ?? [];
  return (
    <section className="dal-panel">
      <div className="dal-panel-title-row">
        <h3>Estimated Constraints</h3>
        <span className="dal-badge warning">Pending Engineering</span>
      </div>
      <div className="teralinx-summary-grid">
        <div>
          <span>Highway Crossings</span>
          <b>{takeoff?.roadCrossingCount ?? graph.routeStatistics.estimatedHighwayCrossings}</b>
        </div>
        <div>
          <span>Railroad Crossings</span>
          <b>{takeoff?.railCrossingCount ?? graph.routeStatistics.estimatedRailroadCrossings}</b>
        </div>
        <div>
          <span>Water Crossings</span>
          <b>{takeoff ? takeoff.waterCrossingCount + takeoff.bridgeCrossingCount : graph.routeStatistics.estimatedWaterCrossings}</b>
        </div>
        <div>
          <span>Unknown Constraints</span>
          <b>{takeoff?.unknownConstraintCount ?? 0}</b>
        </div>
        <div>
          <span>Source</span>
          <b>{takeoff ? "CorridorTakeoff" : "RouteCandidate"}</b>
        </div>
      </div>
      <div className="dal-list">
        {takeoff
          ? crossingObjects.slice(0, 8).map((object) => (
              <div className="dal-list-row" key={object.objectId}>
                <b>{object.objectType.replaceAll("_", " ")}</b>
                <span>{object.engineeringStatus.replaceAll("_", " ")}</span>
                <small>
                  {object.stationLabel}; estimated at {object.lat.toFixed(4)}, {object.lng.toFixed(4)}
                </small>
              </div>
            ))
          : graph.engineeringConstraintCandidates.slice(0, 8).map((candidate) => (
              <div className="dal-list-row" key={candidate.constraintId}>
                <b>{candidate.constraintType.replaceAll("_", " ")}</b>
                <span>{candidate.engineeringStatus.replaceAll("_", " ")}</span>
                <small>
                  Confidence {candidate.confidence}; estimated at {candidate.estimatedLocation[1].toFixed(4)}, {candidate.estimatedLocation[0].toFixed(4)}
                </small>
              </div>
            ))}
      </div>
    </section>
  );
}
