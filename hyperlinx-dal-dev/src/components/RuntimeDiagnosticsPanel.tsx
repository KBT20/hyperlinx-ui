import { useEffect, useState } from "react";
import { getRuntimeDiagnosticsSnapshot, type RuntimeDiagnosticsSnapshot } from "../runtime/RuntimeDiagnostics";

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatMs(value: number) {
  return `${value.toFixed(1)}ms`;
}

export default function RuntimeDiagnosticsPanel() {
  const [snapshot, setSnapshot] = useState<RuntimeDiagnosticsSnapshot>(() => getRuntimeDiagnosticsSnapshot());

  useEffect(() => {
    const interval = window.setInterval(() => setSnapshot(getRuntimeDiagnosticsSnapshot()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const slowestTiming = Object.entries(snapshot.timings)
    .sort(([, left], [, right]) => right.maxDurationMs - left.maxDurationMs)
    .slice(0, 4);

  return (
    <details className="runtime-diagnostics-panel">
      <summary>Runtime Diagnostics</summary>
      <div className="runtime-diagnostics-grid">
        <span>cache hit rate</span>
        <b>{formatPercent(snapshot.cacheUtilization)}</b>
        <span>cache entries</span>
        <b>{snapshot.cacheEntries.toLocaleString()}</b>
        <span>assemblies</span>
        <b>{snapshot.counters.assemblyExecutions.toLocaleString()}</b>
        <span>projections</span>
        <b>{snapshot.counters.projectionExecutions.toLocaleString()}</b>
        <span>engineering projections</span>
        <b>{snapshot.counters.engineeringProjectionExecutions.toLocaleString()}</b>
        <span>map rebuilds</span>
        <b>{snapshot.counters.mapRebuilds.toLocaleString()}</b>
        <span>revision changes</span>
        <b>{snapshot.counters.revisionChanges.toLocaleString()}</b>
        <span>cache hits</span>
        <b>{snapshot.counters.cacheHits.toLocaleString()}</b>
        <span>cache misses</span>
        <b>{snapshot.counters.cacheMisses.toLocaleString()}</b>
      </div>
      {slowestTiming.length ? (
        <div className="runtime-diagnostics-timings">
          {slowestTiming.map(([label, timing]) => (
            <span key={label}>{label}: {formatMs(timing.maxDurationMs)}</span>
          ))}
        </div>
      ) : null}
    </details>
  );
}
