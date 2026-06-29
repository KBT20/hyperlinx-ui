import { useEffect, useMemo, useState } from "react";
import { DAL_INVENTORY_GRAPH_API } from "../config/dalApi";
import { listInventoryGraphs, loadInventoryGraph } from "../api/dalClient";
import { useDALState } from "../dal/DALState";
import type { InventoryGraph, InventoryGraphMetadata } from "../types/dal";

function fmt(n: number | undefined) {
  return Number(n || 0).toLocaleString();
}

function mergeInventoryRecords(remote: InventoryGraphMetadata[], local: InventoryGraphMetadata[]) {
  const merged = new Map<string, InventoryGraphMetadata>();
  [...local, ...remote].forEach((item) => {
    if (item.inventoryId) merged.set(item.inventoryId, item);
  });
  return Array.from(merged.values()).sort((a, b) => String(b.createdDate || "").localeCompare(String(a.createdDate || "")));
}

export default function DALInventoryWorkspace() {
  const {
    selectedInventoryId,
    setSelectedInventoryId,
    selectedGraph,
    setSelectedGraph,
    inventorySummaries,
    upsertInventorySummary,
    setWorkspace,
  } = useDALState();
  const [remoteItems, setRemoteItems] = useState<InventoryGraphMetadata[]>([]);
  const [selected, setSelected] = useState<InventoryGraph | null>(selectedGraph);
  const [status, setStatus] = useState("Inventory workspace ready.");

  const items = useMemo(() => mergeInventoryRecords(remoteItems, inventorySummaries), [remoteItems, inventorySummaries]);
  const selectedMetadata = selected?.metadata ?? items.find((item) => item.inventoryId === selectedInventoryId);

  useEffect(() => {
    console.log("DAL INVENTORY WORKSPACE LOADED");
    void refreshInventory();
  }, []);

  useEffect(() => {
    if (selectedGraph && selectedGraph.inventoryId === selectedInventoryId) setSelected(selectedGraph);
  }, [selectedGraph, selectedInventoryId]);

  async function refreshInventory() {
    try {
      setStatus("Loading inventory graphs...");
      const records = await listInventoryGraphs();
      setRemoteItems(records);
      records.forEach(upsertInventorySummary);
      setStatus(`Loaded ${records.length.toLocaleString()} inventory graphs from ${DAL_INVENTORY_GRAPH_API}.`);
    } catch (err: any) {
      setStatus(`Inventory load failed: ${err?.message ?? String(err)}`);
    }
  }

  async function loadSelectedInventory(inventoryId: string) {
    setSelectedInventoryId(inventoryId);
    if (!inventoryId) {
      setSelected(null);
      setSelectedGraph(null);
      return;
    }

    try {
      setStatus("Loading full inventory graph...");
      const graph = await loadInventoryGraph(inventoryId);
      setSelected(graph);
      setSelectedGraph(graph);
      upsertInventorySummary(graph.metadata);
      setStatus(`Loaded ${graph.metadata.name}.`);
    } catch (err: any) {
      setSelected(null);
      setStatus(`Inventory detail failed: ${err?.message ?? String(err)}`);
    }
  }

  function openGraphViewer() {
    if (selected) setSelectedGraph(selected);
    setWorkspace("graphViewer");
  }

  function sendToPrism() {
    if (selected) setSelectedGraph(selected);
    setWorkspace("prism");
  }

  return (
    <section className="dal-workspace">
      <div className="dal-workspace-header">
        <div>
          <h2>DAL Inventory Graphs</h2>
          <p>Runtime inventory graphs and graph handoff into Viewer and Prism.</p>
        </div>
        <button type="button" onClick={() => void refreshInventory()}>
          Refresh
        </button>
      </div>

      <div className="dal-panel">
        <h3>Inventory Graphs</h3>
        <select value={selectedInventoryId} onChange={(event) => void loadSelectedInventory(event.target.value)}>
          <option value="">Select inventory graph</option>
          {items.map((item) => (
            <option key={item.inventoryId} value={item.inventoryId}>
              {item.name} ({fmt(item.edgeCount)} edges)
            </option>
          ))}
        </select>
        <div className="dal-status">{status}</div>
      </div>

      {selectedMetadata && (
        <div className="dal-panel">
          <div className="dal-panel-title-row">
            <h3>{selectedMetadata.name}</h3>
            <span className={`dal-badge ${(selectedMetadata.validationStatus ?? "PASS").toLowerCase()}`}>
              {selectedMetadata.validationStatus ?? "PASS"}
            </span>
          </div>
          <div className="dal-metrics">
            <span>Inventory ID: {selectedMetadata.inventoryId}</span>
            <span>Graph ID: {selectedMetadata.graphId}</span>
            <span>Source file: {selectedMetadata.sourceFile ?? "unknown"}</span>
            <span>Created date: {selectedMetadata.createdDate}</span>
            <span>Nodes: {fmt(selectedMetadata.nodeCount)}</span>
            <span>Edges: {fmt(selectedMetadata.edgeCount)}</span>
            <span>Stations: {fmt(selectedMetadata.stationCount)}</span>
            <span>Routes: {fmt(selectedMetadata.routeCount)}</span>
            <span>Route miles: {Number(selectedMetadata.routeMiles || 0).toFixed(2)}</span>
          </div>
          <div className="dal-actions">
            <button type="button" disabled={!selected} onClick={openGraphViewer}>
              Open Graph Viewer
            </button>
            <button type="button" disabled={!selected} onClick={sendToPrism}>
              Send To Prism
            </button>
          </div>
          {selected && (
            <pre className="dal-pre">
              {JSON.stringify(
                {
                  metadata: selected.metadata,
                  validation: selected.validation,
                  preview: {
                    routes: selected.routes.slice(0, 2),
                    stations: selected.stations.slice(0, 2),
                  },
                },
                null,
                2
              )}
            </pre>
          )}
        </div>
      )}
    </section>
  );
}
