import { useEffect, useState } from "react";
import {
  DAL_BASELINE_GRAPH_API,
  listDALBaselineGraphs,
  loadDALBaselineGraphMetadata,
  loadDALGraphChunk,
  saveDALBaselineGraph,
  type DALBaselineGraphMetadata,
  type DALChunkType,
  type DALGraphBundle,
} from "../config/dalApi";
import { useDALState } from "../dal/DALState";

function fmt(n: number | undefined) {
  return Number(n || 0).toLocaleString();
}

export default function DALInventoryWorkspace() {
  const { selectedInventoryId, setSelectedInventoryId } = useDALState();
  const [items, setItems] = useState<DALBaselineGraphMetadata[]>([]);
  const [selected, setSelected] = useState<DALBaselineGraphMetadata | null>(null);
  const [status, setStatus] = useState("Inventory workspace ready.");
  const [chunkPreview, setChunkPreview] = useState("");

  useEffect(() => {
    console.log("DAL INVENTORY WORKSPACE LOADED");
    void refreshInventory();
  }, []);

  async function refreshInventory() {
    try {
      setStatus("Loading inventory metadata...");
      const records = await listDALBaselineGraphs();
      setItems(records);
      setStatus(`Loaded ${records.length.toLocaleString()} inventory records from ${DAL_BASELINE_GRAPH_API}.`);
    } catch (err: any) {
      setStatus(`Inventory load failed: ${err?.message ?? String(err)}`);
    }
  }

  async function selectInventory(inventoryId: string) {
    setSelectedInventoryId(inventoryId);
    setChunkPreview("");
    if (!inventoryId) {
      setSelected(null);
      return;
    }

    try {
      setStatus("Loading inventory metadata detail...");
      const metadata = await loadDALBaselineGraphMetadata(inventoryId);
      setSelected(metadata);
      setStatus(`Selected ${metadata.name}.`);
    } catch (err: any) {
      setStatus(`Inventory detail failed: ${err?.message ?? String(err)}`);
    }
  }

  async function uploadGraphBundle(file: File) {
    try {
      setStatus(`Reading ${file.name}...`);
      const bundle = JSON.parse(await file.text()) as DALGraphBundle;
      bundle.sourceFile = bundle.sourceFile ?? file.name;
      const saved = await saveDALBaselineGraph(bundle, setStatus);
      setItems((prev) => [saved, ...prev.filter((item) => item.inventoryId !== saved.inventoryId)]);
      setSelected(saved);
      setSelectedInventoryId(saved.inventoryId);
      setStatus(`Saved ${saved.name}: ${fmt(saved.nodeCount)} nodes / ${fmt(saved.edgeCount)} edges.`);
    } catch (err: any) {
      setStatus(`Inventory save failed: ${err?.message ?? String(err)}`);
    }
  }

  async function loadChunkPreview(chunkType: DALChunkType) {
    if (!selectedInventoryId) return;
    try {
      setStatus(`Loading ${chunkType} chunk 0...`);
      const records = await loadDALGraphChunk(selectedInventoryId, chunkType, 0);
      setChunkPreview(JSON.stringify(records.slice(0, 3), null, 2));
      setStatus(`Loaded ${chunkType} chunk 0: ${records.length.toLocaleString()} records.`);
    } catch (err: any) {
      setStatus(`Chunk load failed: ${err?.message ?? String(err)}`);
    }
  }

  return (
    <section className="dal-workspace">
      <div className="dal-workspace-header">
        <div>
          <h2>DAL Inventory Graphs</h2>
          <p>Carrier inventory ingestion, baseline graph persistence, serviceability inputs, and opportunity seed staging.</p>
        </div>
        <button type="button" onClick={() => void refreshInventory()}>
          Refresh
        </button>
      </div>

      <div className="dal-grid">
        <div className="dal-panel">
          <h3>Upload Graph Bundle</h3>
          <p>Accepts JSON with `nodes`, `edges`, `stations`, and optional `routes` arrays.</p>
          <input
            type="file"
            accept=".json,.geojson"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (file) void uploadGraphBundle(file);
              event.currentTarget.value = "";
            }}
          />
        </div>

        <div className="dal-panel">
          <h3>Inventory Records</h3>
          <select value={selectedInventoryId} onChange={(event) => void selectInventory(event.target.value)}>
            <option value="">Select inventory graph</option>
            {items.map((item) => (
              <option key={item.inventoryId} value={item.inventoryId}>
                {item.name} ({fmt(item.edgeCount)} edges)
              </option>
            ))}
          </select>
          <div className="dal-status">{status}</div>
        </div>
      </div>

      {selected && (
        <div className="dal-panel">
          <h3>{selected.name}</h3>
          <div className="dal-metrics">
            <span>Nodes: {fmt(selected.nodeCount)}</span>
            <span>Edges: {fmt(selected.edgeCount)}</span>
            <span>Stations: {fmt(selected.stationCount)}</span>
            <span>Routes: {fmt(selected.chunkCounts?.routes)}</span>
            <span>Miles: {Number(selected.routeMiles || 0).toFixed(2)}</span>
          </div>
          <div className="dal-actions">
            <button type="button" onClick={() => void loadChunkPreview("nodes")}>
              Nodes Chunk
            </button>
            <button type="button" onClick={() => void loadChunkPreview("edges")}>
              Edges Chunk
            </button>
            <button type="button" onClick={() => void loadChunkPreview("stations")}>
              Stations Chunk
            </button>
            <button type="button" onClick={() => void loadChunkPreview("routes")}>
              Routes Chunk
            </button>
          </div>
          {chunkPreview && <pre className="dal-pre">{chunkPreview}</pre>}
        </div>
      )}
    </section>
  );
}
