import { useEffect, useMemo, useState } from "react";
import {
  endpointBaseUrl,
  REASONING_WORKLOAD_ROUTES,
  getReasoningServiceSnapshot,
  refreshReasoningService,
  setReasoningEnabled,
  startReasoningService,
  subscribeReasoningService,
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
  const [health, setHealth] = useState<ReasoningFabricHealth | null>(() => getReasoningServiceSnapshot());
  const [status, setStatus] = useState("Reasoning status is served from the StellaOS Kernel cache.");

  async function testHealth() {
    try {
      setStatus("Requesting Kernel reasoning refresh...");
      const nextHealth = await refreshReasoningService();
      setHealth(nextHealth);
      onHealthChange?.(nextHealth);
      setStatus(
        nextHealth.activeEndpoint
          ? `Active reasoning endpoint: ${nextHealth.activeEndpoint.name}.`
          : nextHealth.reasoningEnabled
            ? "Reasoning OFFLINE. Circuit breaker state is cached by Kernel."
            : "Reasoning disabled in Developer Mode."
      );
    } catch (err: any) {
      const snapshot = getReasoningServiceSnapshot();
      setHealth(snapshot);
      onHealthChange?.(snapshot);
      setStatus(`Reasoning refresh returned cached state: ${err?.message ?? String(err)}`);
    }
  }

  useEffect(() => {
    const unsubscribe = subscribeReasoningService((nextHealth) => {
      setHealth(nextHealth);
      onHealthChange?.(nextHealth);
    });
    startReasoningService();
    return unsubscribe;
  }, [onHealthChange]);

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
        <button type="button" onClick={() => void setReasoningEnabled(!health?.reasoningEnabled)}>
          {health?.reasoningEnabled ? "Disable Reasoning" : "Enable Reasoning"}
        </button>
        <button type="button" onClick={() => void testHealth()}>
          Refresh Kernel Cache
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
        <span>Reasoning Enabled: {health?.reasoningEnabled ? "true" : "false"}</span>
        <span>Service State: {health?.serviceStatus ?? "OFFLINE"}</span>
        <span>Circuit Breaker: {health?.circuitBreakerState ?? "DISABLED"}</span>
        <span>Retry Countdown: {fmt(health?.retryCountdownSeconds)} sec</span>
        <span>Last Successful Probe: {health?.lastSuccessfulProbe ?? "none"}</span>
        <span>Last Failure: {health?.lastFailure ?? "none"}</span>
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
              <th>Retry After</th>
              <th>Circuit</th>
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
                <td>{endpoint.retryAfter ?? "none"}</td>
                <td>{endpoint.circuitBreakerState ?? "CLOSED"}</td>
                <td>{endpoint.capabilities.join(", ")}</td>
              </tr>
            ))}
            {!endpointRows.length ? (
              <tr>
                <td colSpan={10}>No reasoning endpoints configured. Set registry environment variables for GPU or fallback services.</td>
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
              <th>Circuit</th>
              <th>Retry</th>
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
                <td>{diagnostic.circuitBreakerState}</td>
                <td>{fmt(diagnostic.retryAfterSeconds)} sec</td>
                <td>{diagnostic.error ?? JSON.stringify(diagnostic.response ?? {})}</td>
              </tr>
            ))}
            {!diagnosticRows.length ? (
              <tr>
                <td colSpan={8}>No diagnostics are available yet.</td>
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
