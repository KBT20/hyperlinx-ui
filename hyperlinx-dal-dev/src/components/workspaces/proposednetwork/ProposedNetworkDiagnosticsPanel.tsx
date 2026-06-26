import type { ProposedGraph } from "../../../proposedGraph/ProposedGraph";

export default function ProposedNetworkDiagnosticsPanel({ graph }: { graph: ProposedGraph }) {
  return (
    <section className="dal-panel">
      <div className="dal-panel-title-row">
        <h3>Diagnostics</h3>
        <span className="dal-badge warning">Collapsed</span>
      </div>
      <details>
        <summary>Developer Mode: ProposedGraph diagnostics</summary>
        <pre className="dal-pre">{JSON.stringify(graph.diagnostics, null, 2)}</pre>
      </details>
      <details>
        <summary>Developer Mode: Design doctrine</summary>
        <pre className="dal-pre">
          {JSON.stringify(
            {
              designDoctrineId: graph.designDoctrineId,
              networkClass: graph.networkClass,
              topology: graph.topology,
              protectionClass: graph.protectionClass,
              designDoctrine: graph.metadata.designDoctrine,
            },
            null,
            2,
          )}
        </pre>
      </details>
      <details>
        <summary>Developer Mode: centerline corridor</summary>
        <pre className="dal-pre">
          {JSON.stringify(
            {
              centerlineRoute: graph.centerlineRoute,
              stationedCorridor: graph.stationedCorridor,
              takeoff: graph.takeoff,
            },
            null,
            2,
          )}
        </pre>
      </details>
      <details>
        <summary>Developer Mode: RouteCandidate</summary>
        <pre className="dal-pre">{JSON.stringify(graph.routeCandidate, null, 2)}</pre>
      </details>
      <details>
        <summary>Developer Mode: raw ProposedGraph JSON</summary>
        <pre className="dal-pre">{JSON.stringify(graph, null, 2)}</pre>
      </details>
    </section>
  );
}
