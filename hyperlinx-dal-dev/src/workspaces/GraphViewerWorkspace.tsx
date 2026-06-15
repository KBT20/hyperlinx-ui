import { useEffect, useState } from "react";
import { loadInventoryGraph } from "../api/dalClient";
import GraphMap, { type GraphLayerToggles } from "../components/GraphMap";
import { useDALState } from "../dal/DALState";

function fmt(n: number | undefined) {
  return Number(n || 0).toLocaleString();
}

export default function GraphViewerWorkspace() {
  const { selectedInventoryId, selectedGraph, setSelectedGraph } = useDALState();
  const [status, setStatus] = useState("Graph Viewer ready.");
  const [layers, setLayers] = useState<GraphLayerToggles>({
    inventory: true,
    inventoryPath: true,
    candidate: true,
    buildPath: true,
    attachmentPoint: true,
    routes: true,
    stations: true,
    edges: false,
    nodes: false,
  });
  const [selectedFeature, setSelectedFeature] = useState<any>(null);

  useEffect(() => {
    if (!selectedGraph && selectedInventoryId) void loadGraph(selectedInventoryId);
  }, [selectedInventoryId, selectedGraph]);

  async function loadGraph(inventoryId: string) {
    try {
      setStatus("Loading full inventory graph...");
      const graph = await loadInventoryGraph(inventoryId);
      setSelectedGraph(graph);
      setStatus(`Loaded ${graph.metadata.name}.`);
    } catch (err: any) {
      setStatus(`Graph load failed: ${err?.message ?? String(err)}`);
    }
  }

  function toggleLayer(layer: keyof GraphLayerToggles) {
    setLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));
  }

  return (
    <section className="dal-workspace">
      <div className="dal-workspace-header">
        <div>
          <h2>DAL Graph Viewer</h2>
          <p>Viewport-filtered inventory graph rendering with routes and stations prioritized for dense carrier data.</p>
        </div>
      </div>

      <div className="dal-panel">
        <div className="dal-panel-title-row">
          <h3>{selectedGraph?.metadata.name ?? "No graph selected"}</h3>
          <div className="dal-actions">
            {(["inventoryPath", "candidate", "buildPath", "attachmentPoint", "routes", "stations", "edges", "nodes"] as Array<keyof GraphLayerToggles>).map((layer) => (
              <button key={layer} type="button" className={layers[layer] ? "active-toggle" : ""} onClick={() => toggleLayer(layer)}>
                {layer}
              </button>
            ))}
          </div>
        </div>
        <div className="dal-status">{status}</div>
        {selectedGraph && (
          <div className="dal-metrics">
            <span>Inventory: {selectedGraph.inventoryId}</span>
            <span>Graph: {selectedGraph.graphId}</span>
            <span>Routes: {fmt(selectedGraph.routes.length)}</span>
            <span>Stations: {fmt(selectedGraph.stations.length)}</span>
            <span>Edges: {fmt(selectedGraph.edges.length)}</span>
            <span>Nodes: {fmt(selectedGraph.nodes.length)}</span>
            <span>Validation: {selectedGraph.validation.status}</span>
          </div>
        )}
      </div>

      <GraphMap graph={selectedGraph} layers={layers} onSelectFeature={setSelectedFeature} />

      <div className="dal-grid">
        <div className="dal-panel">
          <h3>Validation Summary</h3>
          {selectedGraph ? (
            <div className="dal-validation-list">
              {selectedGraph.validation.issues.map((issue) => (
                <div className="dal-validation-row" key={issue.check}>
                  <span>{issue.check}</span>
                  <b className={`dal-result ${issue.status.toLowerCase()}`}>{issue.status}</b>
                  <span>{fmt(issue.count)}</span>
                  <small>{issue.message}</small>
                </div>
              ))}
            </div>
          ) : (
            <div className="dal-status">No graph loaded.</div>
          )}
        </div>

        <div className="dal-panel">
          <h3>Selected Feature</h3>
          {selectedFeature ? <pre className="dal-pre">{JSON.stringify(selectedFeature, null, 2)}</pre> : <div className="dal-status">Click a rendered feature.</div>}
        </div>
      </div>
    </section>
  );
}
