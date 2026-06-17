import { useEffect, useMemo, useState } from "react";
import {
  endpointBaseUrl,
  loadReasoningRegistryHealth,
  REASONING_WORKLOAD_ROUTES,
  type ReasoningFabricHealth,
} from "../api/reasoningRegistry";

function fmt(n: number | undefined) {
  return Number(n || 0).toLocaleString();
}

function badgeClass(status: string) {
  return `dal-badge ${status.toLowerCase().replaceAll("_", "-").replaceAll(" ", "-")}`;
}

export default function ReasoningHealthDashboard({
  onHealthChange,
}: {
  onHealthChange?: (health: ReasoningFabricHealth | null) => void;
}) {
  const [health, setHealth] = useState<ReasoningFabricHealth | null>(null);
  const [status, setStatus] = useState("Reasoning fabric health not tested.");

  async function testHealth() {
    try {
      setStatus("Testing reasoning fabric endpoints...");
      const nextHealth = await loadReasoningRegistryHealth();
      setHealth(nextHealth);
      onHealthChange?.(nextHealth);
      setStatus(
        nextHealth.activeEndpoint
          ? `Active reasoning endpoint: ${nextHealth.activeEndpoint.name}.`
          : "No reasoning endpoint is currently reachable."
      );
    } catch (err: any) {
      setHealth(null);
      onHealthChange?.(null);
      setStatus(`Reasoning fabric health test failed: ${err?.message ?? String(err)}`);
    }
  }

  useEffect(() => {
    void testHealth();
  }, []);

  const endpointRows = health?.endpoints ?? [];
  const diagnosticRows = health?.diagnostics ?? [];
  const activeEndpoint = health?.activeEndpoint;
  const summary = useMemo(
    () => ({
      online: endpointRows.filter((endpoint) => endpoint.healthStatus === "ONLINE").length,
      degraded: endpointRows.filter((endpoint) => endpoint.healthStatus === "DEGRADED").length,
      offline: endpointRows.filter((endpoint) => endpoint.healthStatus === "OFFLINE").length,
    }),
    [endpointRows]
  );

  return (
    <div className="dal-panel">
      <div className="dal-panel-title-row">
        <div>
          <h3>Reasoning Health Dashboard</h3>
          <div className="dal-status">{status}</div>
        </div>
        <button type="button" onClick={() => void testHealth()}>
          Test Reasoning Endpoint
        </button>
      </div>

      <div className="dal-metrics">
        <span>Configured Endpoints: {fmt(endpointRows.length)}</span>
        <span>Online Models: {fmt(summary.online)}</span>
        <span>Degraded Models: {fmt(summary.degraded)}</span>
        <span>Offline Models: {fmt(summary.offline)}</span>
        <span>Active Endpoint: {activeEndpoint ? activeEndpoint.name : "none"}</span>
        <span>Provider: {activeEndpoint?.provider ?? "unknown"}</span>
        <span>Endpoint Type: {activeEndpoint?.endpointType ?? "unknown"}</span>
        <span>Response Time: {fmt(activeEndpoint?.latencyMs)} ms</span>
        <span>Failures: {fmt(health?.failures)}</span>
      </div>

      <div className="dal-table-wrap">
        <table className="dal-table">
          <thead>
            <tr>
              <th>Endpoint</th>
              <th>Provider</th>
              <th>Model</th>
              <th>Status</th>
              <th>Latency</th>
              <th>Endpoint Type</th>
              <th>Last Check</th>
              <th>Capabilities</th>
            </tr>
          </thead>
          <tbody>
            {endpointRows.map((endpoint) => (
              <tr key={endpoint.endpointId}>
                <td>
                  <b>{endpoint.name}</b>
                  <small>{endpointBaseUrl(endpoint)}</small>
                </td>
                <td>{endpoint.provider ?? "unknown"}</td>
                <td>{endpoint.modelId ?? endpoint.modelName}</td>
                <td><span className={badgeClass(endpoint.healthStatus)}>{endpoint.healthStatus}</span></td>
                <td>{fmt(endpoint.latencyMs)} ms</td>
                <td>{endpoint.endpointType ?? "UNKNOWN"}</td>
                <td>{endpoint.lastCheck ?? "not checked"}</td>
                <td>{endpoint.capabilities.join(", ")}</td>
              </tr>
            ))}
            {!endpointRows.length ? (
              <tr>
                <td colSpan={8}>No reasoning endpoints configured. Set registry environment variables for GPU or fallback services.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="dal-table-wrap">
        <table className="dal-table">
          <thead>
            <tr>
              <th>Diagnostic</th>
              <th>DNS</th>
              <th>TCP Reachability</th>
              <th>Health Check</th>
              <th>Latency</th>
              <th>Response</th>
            </tr>
          </thead>
          <tbody>
            {diagnosticRows.map((diagnostic) => (
              <tr key={diagnostic.endpoint.endpointId}>
                <td>{diagnostic.endpoint.name}</td>
                <td>{diagnostic.dns}</td>
                <td>{diagnostic.tcpReachability}</td>
                <td><span className={badgeClass(diagnostic.healthCheck)}>{diagnostic.healthCheck}</span></td>
                <td>{fmt(diagnostic.latencyMs)} ms</td>
                <td>{diagnostic.error ?? JSON.stringify(diagnostic.response ?? {})}</td>
              </tr>
            ))}
            {!diagnosticRows.length ? (
              <tr>
                <td colSpan={6}>No diagnostics are available yet.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div>
        <h3>Reasoning Workload Routing Model</h3>
        <div className="dal-list">
          {REASONING_WORKLOAD_ROUTES.map((route) => (
            <div key={route.workload} className="dal-list-row">
              <span>{route.workload}</span>
              <b>{route.preferredLayer}</b>
              <small>{route.preferredCapabilities.join(", ")}</small>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
