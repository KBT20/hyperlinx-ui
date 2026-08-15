import { useEffect, useState } from "react";
import {
  endpointBaseUrl,
  getReasoningServiceSnapshot,
  refreshReasoningService,
  setReasoningEnabled,
  startReasoningService,
  subscribeReasoningService,
  type ReasoningFabricHealth,
} from "../kernel/ReasoningServiceManager";

function fmt(value: number | undefined) {
  return Number(value || 0).toLocaleString();
}

export default function KernelReasoningStatusPanel() {
  const [health, setHealth] = useState<ReasoningFabricHealth>(() => getReasoningServiceSnapshot());

  useEffect(() => {
    const unsubscribe = subscribeReasoningService(setHealth);
    startReasoningService();
    return unsubscribe;
  }, []);

  const endpoint = health.activeEndpoint ?? health.endpoints[0];

  return (
    <details className="runtime-diagnostics-panel">
      <summary>Reasoning Status</summary>
      <div className="runtime-diagnostics-grid">
        <span>authority</span>
        <b>{health.authority}</b>
        <span>reasoningEnabled</span>
        <b>{health.reasoningEnabled ? "true" : "false"}</b>
        <span>endpoint</span>
        <b>{endpoint ? endpointBaseUrl(endpoint) : "not configured"}</b>
        <span>online</span>
        <b>{health.serviceStatus}</b>
        <span>latency</span>
        <b>{fmt(endpoint?.latencyMs)} ms</b>
        <span>models</span>
        <b>{health.availableModels.length ? health.availableModels.join(", ") : health.defaultModel ?? "none"}</b>
        <span>last successful probe</span>
        <b>{health.lastSuccessfulProbe ?? "none"}</b>
        <span>retry countdown</span>
        <b>{fmt(health.retryCountdownSeconds)} sec</b>
        <span>circuit breaker state</span>
        <b>{health.circuitBreakerState}</b>
      </div>
      <div className="runtime-diagnostics-timings">
        <button type="button" onClick={() => void refreshReasoningService()}>
          Refresh Kernel Cache
        </button>
        <button type="button" onClick={() => setReasoningEnabled(!health.reasoningEnabled)}>
          {health.reasoningEnabled ? "Disable Reasoning" : "Enable Reasoning"}
        </button>
      </div>
    </details>
  );
}
