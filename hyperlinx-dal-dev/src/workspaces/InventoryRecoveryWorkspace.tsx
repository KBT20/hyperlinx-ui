import { useEffect, useMemo, useState } from "react";
import { loadInventoryGraph } from "../api/dalClient";
import { testBaselineGraphConnectivity, testDalConnectivity, type DalConnectivityResult } from "../api/dalConnectivity";
import {
  classifyLegacyInventory,
  discoverInventoryRecovery,
  pullServerInventoryToBrowser,
  pushBrowserInventoryToServer,
  summarizeInventoryRecovery,
  synchronizeInventory,
  validateServerInventory,
  type InventoryRecoveryRecord,
  type InventoryValidationCheck,
} from "../api/inventoryRecovery";
import { DAL_API, DAL_BASELINE_GRAPH_API, DAL_REASONING_API } from "../config/dalApi";
import { useDALState } from "../dal/DALState";

function fmt(n: number | undefined) {
  return Number(n || 0).toLocaleString();
}

function mb(n: number | undefined) {
  return `${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} MB`;
}

function badgeClass(status: string) {
  return `dal-badge ${status.toLowerCase().replaceAll("_", "-").replaceAll(" ", "-")}`;
}

export default function InventoryRecoveryWorkspace() {
  const { setSelectedGraph, setSelectedInventoryId, setWorkspace, upsertInventorySummary } = useDALState();
  const [records, setRecords] = useState<InventoryRecoveryRecord[]>([]);
  const [selectedInventoryId, setSelectedInventoryIdLocal] = useState("");
  const [validationChecks, setValidationChecks] = useState<InventoryValidationCheck[]>([]);
  const [connectivityResults, setConnectivityResults] = useState<DalConnectivityResult[]>([]);
  const [busyInventoryId, setBusyInventoryId] = useState("");
  const [status, setStatus] = useState("Inventory Recovery ready.");
  const [connectivityStatus, setConnectivityStatus] = useState("Connectivity not tested.");

  const selectedRecord = records.find((record) => record.inventoryId === selectedInventoryId) ?? records[0] ?? null;
  const summary = useMemo(() => summarizeInventoryRecovery(records), [records]);
  const legacyGroups = useMemo(() => {
    return records
      .filter((record) => record.storageLocation === "Browser Only")
      .reduce<Record<string, InventoryRecoveryRecord[]>>((groups, record) => {
        const group = classifyLegacyInventory(record);
        groups[group] = [...(groups[group] ?? []), record];
        return groups;
      }, {});
  }, [records]);

  useEffect(() => {
    void refresh();
    void runConnectivityTest();
  }, []);

  async function runConnectivityTest() {
    try {
      setConnectivityStatus("Testing DAL connectivity...");
      const results = await testDalConnectivity();
      setConnectivityResults(results);
      const reachable = results.filter((result) => result.reachable).length;
      setConnectivityStatus(`${reachable} of ${results.length} DAL endpoints reachable.`);
      return results;
    } catch (err: any) {
      setConnectivityStatus(`Connectivity test failed: ${err?.message ?? String(err)}`);
      return [];
    }
  }

  async function ensureBaselineConnectivity() {
    const result = await testBaselineGraphConnectivity();
    setConnectivityResults((current) => {
      const others = current.filter((item) => item.key !== "baseline");
      return [...others, result].sort((a, b) => a.label.localeCompare(b.label));
    });
    setConnectivityStatus(`Baseline Graph API reachable at ${result.endpoint} in ${result.responseTimeMs} ms.`);
    return result;
  }

  async function refresh() {
    try {
      setStatus("Discovering browser and server inventories...");
      const nextRecords = await discoverInventoryRecovery();
      setRecords(nextRecords);
      nextRecords.forEach((record) => {
        const metadata = record.serverMetadata ?? record.browserMetadata;
        if (metadata) upsertInventorySummary(metadata);
      });
      setSelectedInventoryIdLocal((current) => current || nextRecords[0]?.inventoryId || "");
      setStatus(`Discovered ${nextRecords.length.toLocaleString()} inventory records.`);
    } catch (err: any) {
      setStatus(`Inventory discovery failed: ${err?.message ?? String(err)}`);
    }
  }

  async function runAction(inventoryId: string, label: string, action: () => Promise<unknown>) {
    try {
      setBusyInventoryId(inventoryId);
      setStatus(`Checking DAL server connectivity before ${label}...`);
      const connectivity = await ensureBaselineConnectivity();
      setStatus(`${label} ${inventoryId} through ${connectivity.endpoint}...`);
      await action();
      const checks = await validateServerInventory(inventoryId).catch(() => []);
      setValidationChecks(checks);
      await refresh();
      setStatus(`${label} complete for ${inventoryId}.`);
    } catch (err: any) {
      setStatus(`${label} failed for ${inventoryId}: ${err?.message ?? String(err)}`);
    } finally {
      setBusyInventoryId("");
    }
  }

  async function push(record: InventoryRecoveryRecord) {
    await runAction(record.inventoryId, "Push To Server", () => pushBrowserInventoryToServer(record.inventoryId));
  }

  async function pull(record: InventoryRecoveryRecord) {
    await runAction(record.inventoryId, "Pull From Server", () => pullServerInventoryToBrowser(record.inventoryId));
  }

  async function sync(record: InventoryRecoveryRecord) {
    await runAction(record.inventoryId, "Synchronize", () => synchronizeInventory(record.inventoryId));
  }

  async function recoverBrowserGraphs() {
    const browserOnly = records.filter((record) => record.storageLocation === "Browser Only");
    if (!browserOnly.length) {
      setStatus("No browser-only inventory graphs need recovery.");
      return;
    }
    for (const record of browserOnly) {
      await runAction(record.inventoryId, "Recover Browser Graph", () => pushBrowserInventoryToServer(record.inventoryId));
    }
  }

  async function openInventory(record: InventoryRecoveryRecord) {
    try {
      setBusyInventoryId(record.inventoryId);
      const graph = await loadInventoryGraph(record.inventoryId);
      setSelectedGraph(graph);
      setSelectedInventoryId(graph.inventoryId);
      setWorkspace("graphViewer");
    } catch (err: any) {
      setStatus(`Open graph failed: ${err?.message ?? String(err)}`);
    } finally {
      setBusyInventoryId("");
    }
  }

  async function validate(record: InventoryRecoveryRecord) {
    await runAction(record.inventoryId, "Validate Server Inventory", async () => {
      const checks = await validateServerInventory(record.inventoryId);
      setValidationChecks(checks);
      return checks;
    });
  }

  return (
    <section className="dal-workspace wide">
      <div className="dal-workspace-header">
        <div>
          <h2>Inventory Recovery</h2>
          <p>Compare browser-only IndexedDB inventory graphs with DAL server inventory truth, then reconcile missing or mismatched graphs.</p>
        </div>
        <div className="dal-actions">
          <button type="button" onClick={() => void refresh()}>
            Refresh
          </button>
          <button type="button" onClick={() => void recoverBrowserGraphs()}>
            Recover Browser Graphs
          </button>
        </div>
      </div>

      <div className="dal-panel">
        <h3>Recovery Summary</h3>
        <div className="dal-status">{status}</div>
        <div className="dal-metrics">
          <span>Server Inventory Count: {fmt(summary.serverInventoryCount)}</span>
          <span>Browser Inventory Count: {fmt(summary.browserInventoryCount)}</span>
          <span>Synchronized Inventory Count: {fmt(summary.synchronizedInventoryCount)}</span>
          <span>Unsynchronized Inventory Count: {fmt(summary.unsynchronizedInventoryCount)}</span>
          <span>Server Inventory Size: {mb(summary.totalServerSizeMB)}</span>
          <span>Browser Inventory Size: {mb(summary.totalBrowserSizeMB)}</span>
          <span>Sync Failures: {fmt(summary.syncFailures.length)}</span>
        </div>
      </div>

      <div className="dal-panel">
        <h3>DAL Connectivity</h3>
        <div className="dal-status">{connectivityStatus}</div>
        <div className="dal-actions">
          <button type="button" onClick={() => void runConnectivityTest()}>
            Test Connectivity
          </button>
        </div>
        <div className="dal-metrics">
          <span>DAL API Endpoint: {DAL_API || "not configured"}</span>
          <span>Baseline Graph Endpoint: {DAL_BASELINE_GRAPH_API || "not configured"}</span>
          <span>Reasoning Endpoint: {DAL_REASONING_API || "not configured"}</span>
        </div>
        <div className="dal-table-wrap">
          <table className="dal-table">
            <thead>
              <tr>
                <th>Service</th>
                <th>Current Endpoint</th>
                <th>Reachable</th>
                <th>Response Time</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {connectivityResults.map((result) => (
                <tr key={result.key}>
                  <td>{result.label}</td>
                  <td>{result.endpoint}</td>
                  <td><span className={badgeClass(result.reachable ? "PASS" : "FAIL")}>{result.reachable ? "YES" : "NO"}</span></td>
                  <td>{fmt(result.responseTimeMs)} ms</td>
                  <td>{result.statusCode ? `${result.statusCode} ${result.statusText ?? ""}` : result.error ?? "not tested"}</td>
                </tr>
              ))}
              {!connectivityResults.length ? (
                <tr>
                  <td colSpan={5}>Connectivity has not been tested yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="dal-panel">
        <h3>Inventory Comparison Matrix</h3>
        <div className="dal-table-wrap">
          <table className="dal-table">
            <thead>
              <tr>
                <th>Inventory ID</th>
                <th>Name</th>
                <th>Nodes</th>
                <th>Edges</th>
                <th>Stations</th>
                <th>Routes</th>
                <th>Graph Size</th>
                <th>Storage Location</th>
                <th>Sync</th>
                <th>Last Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.inventoryId} className={selectedRecord?.inventoryId === record.inventoryId ? "selected-row" : ""}>
                  <td>{record.inventoryId}</td>
                  <td>{record.name}</td>
                  <td>{fmt(record.nodeCount)}</td>
                  <td>{fmt(record.edgeCount)}</td>
                  <td>{fmt(record.stationCount)}</td>
                  <td>{fmt(record.routeCount)}</td>
                  <td>{mb(record.graphSizeMB)}</td>
                  <td><span className={badgeClass(record.storageLocation)}>{record.storageLocation}</span></td>
                  <td><span className={badgeClass(record.syncStatus)}>{record.syncStatus}</span></td>
                  <td>{record.lastUpdated || "n/a"}</td>
                  <td>
                    <div className="dal-actions compact-actions">
                      <button type="button" disabled={!record.browserMetadata || busyInventoryId === record.inventoryId} onClick={() => void push(record)}>
                        Push
                      </button>
                      <button type="button" disabled={!record.serverMetadata || busyInventoryId === record.inventoryId} onClick={() => void pull(record)}>
                        Pull
                      </button>
                      <button type="button" disabled={busyInventoryId === record.inventoryId} onClick={() => void sync(record)}>
                        Sync
                      </button>
                      <button type="button" disabled={!record.serverMetadata || busyInventoryId === record.inventoryId} onClick={() => void validate(record)}>
                        Validate
                      </button>
                      <button type="button" disabled={busyInventoryId === record.inventoryId} onClick={() => void openInventory(record)}>
                        Open
                      </button>
                      <button type="button" onClick={() => setSelectedInventoryIdLocal(record.inventoryId)}>
                        Details
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="dal-grid">
        <div className="dal-panel">
          <h3>Persistence Validation</h3>
          {(validationChecks.length ? validationChecks : selectedRecord?.validationChecks ?? []).map((check) => (
            <div key={check.label} className="dal-list-row">
              <span>{check.label}</span>
              <b>{check.status}</b>
              <small>{check.detail}</small>
            </div>
          ))}
        </div>

        <div className="dal-panel">
          <h3>Recover Browser Graphs</h3>
          {Object.entries(legacyGroups).length ? (
            Object.entries(legacyGroups).map(([group, groupRecords]) => (
              <div key={group} className="dal-list">
                <h4>{group}</h4>
                {groupRecords.map((record) => (
                  <div key={record.inventoryId} className="dal-list-row">
                    <span>{record.name}</span>
                    <b>{fmt(record.edgeCount)} edges</b>
                    <small>{record.inventoryId}</small>
                  </div>
                ))}
              </div>
            ))
          ) : (
            <div className="dal-status">No browser-only legacy inventory graphs detected.</div>
          )}
        </div>
      </div>

      <div className="dal-grid">
        <div className="dal-panel">
          <h3>Largest Graphs</h3>
          <div className="dal-list">
            {summary.largestGraphs.map((record) => (
              <div key={record.inventoryId} className="dal-list-row">
                <span>{record.name}</span>
                <b>{mb(record.graphSizeMB)}</b>
                <small>{record.storageLocation}</small>
              </div>
            ))}
          </div>
        </div>

        <div className="dal-panel">
          <h3>Selected Inventory Detail</h3>
          <pre className="dal-pre">{JSON.stringify(selectedRecord ?? {}, null, 2)}</pre>
        </div>
      </div>
    </section>
  );
}
