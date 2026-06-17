import { useEffect, useMemo, useState } from "react";
import { loadInventoryGraph } from "../api/dalClient";
import { testBaselineGraphConnectivity, testDalConnectivity, type DalConnectivityResult } from "../api/dalConnectivity";
import {
  describeImportStatus,
  downloadHyperlinxInventoryPackage,
  importHyperlinxPackageToBrowser,
  INVENTORY_SOURCE_FORMATS,
  listInventoryImportJobs,
  uploadHyperlinxPackageFile,
} from "../api/inventoryImportJobs";
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
import { endpointBaseUrl, getReasoningEndpointCandidates } from "../api/reasoningRegistry";
import ConstraintGeometryRegistryPanel from "../components/ConstraintGeometryRegistryPanel";
import { DAL_API, DAL_BASELINE_GRAPH_API } from "../config/dalApi";
import { useDALState } from "../dal/DALState";
import { MapKernel, buildMapKernelDiagnostics, renderScopeVersion, type MapKernelMetrics, type MapSelection } from "../mapkernel";
import { ensureInventoryScopeVersion, hydrateScopeVersionForMap, listScopeVersions } from "../api/scopeVersionRepository";
import { validateInventoryGraph, type InventoryValidationReport } from "../validation/inventoryValidation";
import type { InventoryImportJob, InventoryUploadProgress, ScopeVersion } from "../types/dal";

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
  const [importJobs, setImportJobs] = useState<InventoryImportJob[]>([]);
  const [importProgress, setImportProgress] = useState<InventoryUploadProgress | null>(null);
  const [scopeVersions, setScopeVersions] = useState<ScopeVersion[]>([]);
  const [inventoryValidationReport, setInventoryValidationReport] = useState<InventoryValidationReport | null>(null);
  const [kernelScopeVersion, setKernelScopeVersion] = useState<ScopeVersion | null>(null);
  const [kernelSelection, setKernelSelection] = useState<MapSelection | null>(null);
  const [kernelMetrics, setKernelMetrics] = useState<MapKernelMetrics | null>(null);
  const [busyInventoryId, setBusyInventoryId] = useState("");
  const [status, setStatus] = useState("Inventory Recovery ready.");
  const [connectivityStatus, setConnectivityStatus] = useState("Connectivity not tested.");

  const selectedRecord = records.find((record) => record.inventoryId === selectedInventoryId) ?? records[0] ?? null;
  const kernelSpec = useMemo(() => (kernelScopeVersion ? renderScopeVersion(kernelScopeVersion) : null), [kernelScopeVersion]);
  const kernelDiagnostics = useMemo(() => buildMapKernelDiagnostics(kernelScopeVersion, kernelSpec), [kernelScopeVersion, kernelSpec]);
  const reasoningCandidates = useMemo(() => getReasoningEndpointCandidates(), []);
  const inventoryScopeVersions = useMemo(() => scopeVersions.filter((scopeVersion) => scopeVersion.type === "INVENTORY" || scopeVersion.source === "InventoryGraph"), [scopeVersions]);
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
      const nextJobs = await listInventoryImportJobs();
      const nextScopes = await listScopeVersions();
      setRecords(nextRecords);
      setImportJobs(nextJobs);
      setScopeVersions(nextScopes);
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
    await runAction(record.inventoryId, "Push Browser Truth To Server", () => pushBrowserInventoryToServer(record.inventoryId));
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

  async function renderInventory(record: InventoryRecoveryRecord) {
    try {
      setBusyInventoryId(record.inventoryId);
      setStatus(`Loading ${record.inventoryId} into Map Kernel ScopeVersion renderer...`);
      const graph = await loadInventoryGraph(record.inventoryId);
      const scopeVersion = await ensureInventoryScopeVersion(graph);
      setScopeVersions((current) => [scopeVersion, ...current.filter((item) => item.scopeVersionId !== scopeVersion.scopeVersionId)]);
      setKernelScopeVersion(hydrateScopeVersionForMap(scopeVersion, graph));
      setKernelSelection(null);
      setSelectedGraph(graph);
      setSelectedInventoryId(graph.inventoryId);
      setSelectedInventoryIdLocal(graph.inventoryId);
      setStatus(`Map Kernel rendered ${graph.metadata.name} from persisted ScopeVersion ${scopeVersion.scopeVersionId}.`);
    } catch (err: any) {
      setStatus(`Map Kernel render failed: ${err?.message ?? String(err)}`);
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

  async function exportPackage(record: InventoryRecoveryRecord) {
    try {
      setBusyInventoryId(record.inventoryId);
      setStatus(`Exporting ${record.inventoryId} as .hyperlinx package...`);
      const graph = await loadInventoryGraph(record.inventoryId);
      const report = validateInventoryGraph(graph);
      setInventoryValidationReport(report);
      downloadHyperlinxInventoryPackage({
        ...graph,
        metadata: {
          ...graph.metadata,
          validationStatus: report.status,
        },
      });
      setStatus(`Exported ${record.name} with validation status ${report.status}.`);
    } catch (err: any) {
      setStatus(`Package export failed: ${err?.message ?? String(err)}`);
    } finally {
      setBusyInventoryId("");
    }
  }

  async function validateGraphPayload(record: InventoryRecoveryRecord) {
    try {
      setBusyInventoryId(record.inventoryId);
      setStatus(`Loading ${record.inventoryId} for full graph validation...`);
      const graph = await loadInventoryGraph(record.inventoryId);
      const report = validateInventoryGraph(graph);
      setInventoryValidationReport(report);
      setStatus(`Full graph validation ${report.status}: ${report.summary.nodeCount.toLocaleString()} nodes, ${report.summary.edgeCount.toLocaleString()} edges.`);
    } catch (err: any) {
      setStatus(`Full graph validation failed: ${err?.message ?? String(err)}`);
    } finally {
      setBusyInventoryId("");
    }
  }

  async function importPackageFile(file: File) {
    try {
      setStatus(`Importing ${file.name} into DAL browser recovery cache...`);
      const result = await importHyperlinxPackageToBrowser(file);
      setInventoryValidationReport(result.report);
      await refresh();
      setStatus(`Imported ${result.graph.metadata.name} from .hyperlinx package with validation status ${result.report.status}. Use Push Browser Truth only when this package should overwrite missing server truth.`);
    } catch (err: any) {
      setStatus(`Package import failed: ${err?.message ?? String(err)}`);
    }
  }

  async function uploadPackageFile(file: File) {
    try {
      setImportProgress(null);
      setStatus(`Uploading ${file.name} to DAL import job endpoint...`);
      const job = await uploadHyperlinxPackageFile(file, {
        onProgress: (progress) => {
          setImportProgress(progress);
          setStatus(`${progress.status}: ${progress.percentComplete}% uploaded. ${progress.message ?? ""}`);
        },
      });
      setImportJobs(await listInventoryImportJobs());
      setStatus(`Upload job ${job.jobId} ${job.status}${job.error ? `: ${job.error}` : ""}`);
    } catch (err: any) {
      setStatus(`Package upload failed: ${err?.message ?? String(err)}`);
    }
  }

  async function handlePackageFile(file: File | undefined, mode: "import" | "upload") {
    if (!file) return;
    if (mode === "import") await importPackageFile(file);
    else await uploadPackageFile(file);
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
        <h3>DAL1 Authority Doctrine</h3>
        <div className="dal-status">
          Server-backed inventory is authoritative. Synchronize pulls DAL server truth into the browser cache; Push Browser Truth is explicit recovery for browser-only legacy graphs.
        </div>
        <div className="dal-metrics">
          <span>Package Format: .hyperlinx</span>
          <span>Server Authority: DAL1 / Baseline Graph API</span>
          <span>Browser Role: IndexedDB cache and fallback</span>
        </div>
      </div>

      <div className="dal-panel">
        <h3>Enterprise Source Extension Points</h3>
        <div className="dal-status">
          These source formats are registered for future enterprise translators. Phase 2F only activates package transport, validation, and authority workflow.
        </div>
        <div className="dal-metrics">
          {INVENTORY_SOURCE_FORMATS.map((format) => (
            <span key={format}>{format}</span>
          ))}
        </div>
      </div>

      <div className="dal-panel">
        <h3>Enterprise Package Import</h3>
        <div className="dal-actions">
          <label className="dal-file-button">
            Import .hyperlinx To Browser Cache
            <input
              type="file"
              accept=".hyperlinx,application/json"
              onChange={(event) => void handlePackageFile(event.currentTarget.files?.[0], "import")}
            />
          </label>
          <label className="dal-file-button">
            Upload .hyperlinx To DAL Server
            <input
              type="file"
              accept=".hyperlinx,application/json"
              onChange={(event) => void handlePackageFile(event.currentTarget.files?.[0], "upload")}
            />
          </label>
        </div>
        {importProgress ? (
          <div className="dal-metrics">
            <span>Job: {importProgress.jobId}</span>
            <span>Status: {importProgress.status}</span>
            <span>Chunks: {fmt(importProgress.uploadedChunks)} / {fmt(importProgress.totalChunks)}</span>
            <span>Bytes: {fmt(importProgress.uploadedBytes)} / {fmt(importProgress.totalBytes)}</span>
            <span>Progress: {importProgress.percentComplete}%</span>
          </div>
        ) : (
          <div className="dal-status">No package upload in progress.</div>
        )}
      </div>

      <ConstraintGeometryRegistryPanel />

      <div className="dal-panel">
        <h3>Import Jobs</h3>
        <div className="dal-table-wrap">
          <table className="dal-table">
            <thead>
              <tr>
                <th>Job</th>
                <th>Inventory</th>
                <th>Source</th>
                <th>Status</th>
                <th>Progress</th>
                <th>Validation</th>
                <th>Endpoint</th>
              </tr>
            </thead>
            <tbody>
              {importJobs.slice(0, 10).map((job) => (
                <tr key={job.jobId}>
                  <td>{job.jobId}</td>
                  <td>{job.inventoryId ?? "n/a"}</td>
                  <td>{job.sourceFile}</td>
                  <td><span className={badgeClass(job.status)}>{job.status}</span><small>{describeImportStatus(job.status)}</small></td>
                  <td>{fmt(job.uploadedChunks)} / {fmt(job.totalChunks)} chunks</td>
                  <td>{job.validationStatus ?? "n/a"}</td>
                  <td>{job.endpoint}</td>
                </tr>
              ))}
              {!importJobs.length ? (
                <tr>
                  <td colSpan={7}>No inventory import jobs recorded.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
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
          <span>Reasoning Fabric Endpoints: {reasoningCandidates.length ? reasoningCandidates.map(endpointBaseUrl).join(", ") : "not configured"}</span>
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
                        Push Browser Truth
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
                      <button type="button" disabled={busyInventoryId === record.inventoryId} onClick={() => void validateGraphPayload(record)}>
                        Validate Graph
                      </button>
                      <button type="button" disabled={busyInventoryId === record.inventoryId} onClick={() => void exportPackage(record)}>
                        Export
                      </button>
                      <button type="button" disabled={busyInventoryId === record.inventoryId} onClick={() => void openInventory(record)}>
                        Open
                      </button>
                      <button type="button" disabled={busyInventoryId === record.inventoryId} onClick={() => void renderInventory(record)}>
                        Render Kernel
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

      <div className="dal-panel">
        <h3>Inventory ScopeVersions</h3>
        <div className="dal-table-wrap">
          <table className="dal-table">
            <thead>
              <tr>
                <th>ScopeVersionId</th>
                <th>Certification State</th>
                <th>Inventory Source</th>
                <th>Nodes</th>
                <th>Edges</th>
                <th>Stations</th>
                <th>Routes</th>
                <th>Created</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {inventoryScopeVersions.map((scopeVersion) => (
                <tr key={scopeVersion.scopeVersionId}>
                  <td>{scopeVersion.scopeVersionId}</td>
                  <td><span className={badgeClass(scopeVersion.certificationState ?? "DRAFT")}>{scopeVersion.certificationState ?? "DRAFT"}</span></td>
                  <td>{scopeVersion.sourceInventoryId ?? scopeVersion.inventoryId ?? "n/a"}</td>
                  <td>{fmt(scopeVersion.graphSummary?.nodeCount)}</td>
                  <td>{fmt(scopeVersion.graphSummary?.edgeCount)}</td>
                  <td>{fmt(scopeVersion.graphSummary?.stationCount)}</td>
                  <td>{fmt(scopeVersion.graphSummary?.routeCount)}</td>
                  <td>{scopeVersion.createdAt}</td>
                  <td>{scopeVersion.updatedAt}</td>
                </tr>
              ))}
              {!inventoryScopeVersions.length ? (
                <tr>
                  <td colSpan={9}>No persisted inventory ScopeVersions discovered yet. Render or import an inventory to generate one.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="dal-grid">
        <div className="dal-panel">
          <h3>Inventory ScopeVersion Map Kernel</h3>
          {kernelSpec ? (
            <MapKernel
              specs={[kernelSpec]}
              layerVisibility={{ inventory: true, edge: true, node: true, station: true, scopeVersion: true }}
              showStationLabels={false}
              stationDensityFeet={300}
              height={520}
              onSelectionChange={setKernelSelection}
              onMetricsChange={setKernelMetrics}
            />
          ) : (
            <div className="dal-status">Select Render Kernel on an inventory record to validate server-backed geometry through ScopeVersionRenderer.</div>
          )}
        </div>

        <div className="dal-panel">
          <h3>ScopeVersion Rendering Validation</h3>
          <div className="dal-metrics">
            <span>ScopeVersionId: {kernelDiagnostics.scopeVersionId}</span>
            <span>Route Count: {fmt(kernelDiagnostics.routeCount)}</span>
            <span>Station Count: {fmt(kernelDiagnostics.stationCount)}</span>
            <span>Node Count: {fmt(kernelDiagnostics.nodeCount)}</span>
            <span>Edge Count: {fmt(kernelDiagnostics.edgeCount)}</span>
            <span>Object Count: {fmt(kernelDiagnostics.objectCount)}</span>
            <span>Primitive Count: {fmt(kernelDiagnostics.primitiveCount)}</span>
            <span>Visible Routes: {fmt(kernelMetrics?.visibleRoutes ?? kernelDiagnostics.metrics.visibleRoutes)}</span>
            <span>Visible Stations: {fmt(kernelMetrics?.visibleStations ?? kernelDiagnostics.metrics.visibleStations)}</span>
            <span>Visible Nodes: {fmt(kernelMetrics?.visibleNodes ?? kernelDiagnostics.metrics.visibleNodes)}</span>
            <span>Visible Edges: {fmt(kernelMetrics?.visibleEdges ?? kernelDiagnostics.metrics.visibleEdges)}</span>
            <span>Render Authority: {kernelDiagnostics.renderAuthority.status}</span>
            <span>Duplicate Keys: {fmt(kernelDiagnostics.renderAuthority.duplicateKeyCount)}</span>
            <span>Duplicate Objects: {fmt(kernelDiagnostics.renderAuthority.duplicateObjectCount)}</span>
            <span>Duplicate Render Authorities: {fmt(kernelDiagnostics.renderAuthority.duplicateRenderAuthorityCount)}</span>
          </div>
          <div className="dal-status">
            Selection: {kernelSelection ? `${kernelSelection.kind} ${kernelSelection.featureRef.id}` : "none"} / Viewport source: {kernelDiagnostics.viewport.source}
          </div>
          <pre className="dal-pre">
            {JSON.stringify(
              {
                selection: kernelDiagnostics.selection,
                viewport: kernelDiagnostics.viewport,
                stationing: kernelDiagnostics.stationing,
                extensionHooks: kernelDiagnostics.extensionHooks,
                renderAuthority: kernelDiagnostics.renderAuthority,
              },
              null,
              2
            )}
          </pre>
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
          <h3>Full Graph Validation</h3>
          {inventoryValidationReport ? (
            <>
              <div className="dal-metrics">
                <span>Status: {inventoryValidationReport.status}</span>
                <span>Nodes: {fmt(inventoryValidationReport.summary.nodeCount)}</span>
                <span>Edges: {fmt(inventoryValidationReport.summary.edgeCount)}</span>
                <span>Stations: {fmt(inventoryValidationReport.summary.stationCount)}</span>
                <span>Routes: {fmt(inventoryValidationReport.summary.routeCount)}</span>
              </div>
              <div className="dal-list">
                {inventoryValidationReport.checks.map((check) => (
                  <div key={check.check} className="dal-list-row">
                    <span>{check.check}</span>
                    <b>{check.status}</b>
                    <small>{check.message}</small>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="dal-status">No full graph validation has been run in this session.</div>
          )}
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
