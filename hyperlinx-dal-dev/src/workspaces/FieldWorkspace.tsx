import { useEffect, useMemo, useState } from "react";
import { createId, listControlWorkItems, listFieldClosures, now, saveFieldClosure } from "../api/dalClient";
import { useDALState } from "../dal/DALState";
import type { ControlWorkItem, FieldClosure } from "../types/dal";

function activeWork(item: ControlWorkItem) {
  return item.status === "ACTIVE" || item.status === "PENDING";
}

function hasCertifiedRouteAuthority(scope: ReturnType<typeof useDALState>["selectedScopeVersion"]) {
  return scope?.certifiedRouteReference?.routeAuthorityState === "CERTIFIED_ROUTE";
}

export default function FieldWorkspace() {
  const { selectedGraph, selectedScopeVersion, setWorkspace } = useDALState();
  const [workItems, setWorkItems] = useState<ControlWorkItem[]>([]);
  const [closures, setClosures] = useState<FieldClosure[]>([]);
  const [selectedWorkId, setSelectedWorkId] = useState("");
  const [closureType, setClosureType] = useState<"STATION" | "SEGMENT">("STATION");
  const [stationId, setStationId] = useState("");
  const [routeId, setRouteId] = useState("");
  const [footage, setFootage] = useState(0);
  const [crew, setCrew] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("Field ready.");

  useEffect(() => {
    void refresh();
  }, []);

  const activeItems = useMemo(() => workItems.filter(activeWork), [workItems]);

  async function refresh() {
    try {
      const [nextWork, nextClosures] = await Promise.all([listControlWorkItems(), listFieldClosures()]);
      setWorkItems(nextWork);
      setClosures(nextClosures);
      if (!selectedWorkId && nextWork.find(activeWork)) setSelectedWorkId(nextWork.find(activeWork)?.workItemId ?? "");
      setStatus("Field data loaded.");
    } catch (err: any) {
      setStatus(`Field load failed: ${err?.message ?? String(err)}`);
    }
  }

  async function submitClosure() {
    const item = workItems.find((record) => record.workItemId === selectedWorkId);
    const scopeVersionId = selectedScopeVersion?.scopeVersionId ?? item?.scopeVersionId;
    if (!scopeVersionId) {
      setStatus("Select active work with a ScopeVersion before submitting a closure.");
      return;
    }
    if (!hasCertifiedRouteAuthority(selectedScopeVersion)) {
      setStatus("Field closure blocked: selected ScopeVersion must reference a CERTIFIED_ROUTE.");
      return;
    }
    const closure: FieldClosure = {
      closureId: createId("closure"),
      workItemId: item?.workItemId,
      scopeVersionId,
      inventoryId: selectedGraph?.inventoryId ?? item?.inventoryId,
      graphId: selectedGraph?.graphId ?? item?.graphId,
      stationId: closureType === "STATION" ? stationId : undefined,
      routeId,
      segmentId: closureType === "SEGMENT" ? routeId : undefined,
      closureType,
      footage,
      crew,
      closedAt: now(),
      notes,
    };
    const saved = await saveFieldClosure(closure);
    setClosures((prev) => [saved, ...prev.filter((record) => record.closureId !== saved.closureId)]);
    setStatus(`Submitted closure ${saved.closureId}.`);
  }

  return (
    <section className="dal-workspace">
      <div className="dal-workspace-header">
        <div>
          <h2>DAL Field</h2>
          <p>Station and segment closure capture against active DAL ScopeVersion work items.</p>
        </div>
        <button type="button" onClick={() => void refresh()}>
          Refresh
        </button>
      </div>

      <div className="dal-grid">
        <div className="dal-panel">
          <h3>Closure Entry</h3>
          <select value={selectedWorkId} onChange={(event) => setSelectedWorkId(event.target.value)}>
            <option value="">Select active work item</option>
            {activeItems.map((item) => (
              <option key={item.workItemId} value={item.workItemId}>
                {item.title} [{item.status}]
              </option>
            ))}
          </select>
          <select value={closureType} onChange={(event) => setClosureType(event.target.value as "STATION" | "SEGMENT")}>
            <option value="STATION">Close station</option>
            <option value="SEGMENT">Close segment</option>
          </select>
          <input value={stationId} onChange={(event) => setStationId(event.target.value)} placeholder="Station ID" />
          <input value={routeId} onChange={(event) => setRouteId(event.target.value)} placeholder="Route / segment ID" />
          <input type="number" value={footage} onChange={(event) => setFootage(Number(event.target.value))} placeholder="Footage" />
          <input value={crew} onChange={(event) => setCrew(event.target.value)} placeholder="Crew" />
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Field notes" />
          <button type="button" onClick={() => void submitClosure()} disabled={!hasCertifiedRouteAuthority(selectedScopeVersion)}>
            Submit Closure
          </button>
          <div className="dal-status">{status}</div>
        </div>

        <div className="dal-panel">
          <h3>Graph Context</h3>
          <div className="dal-metrics">
            <span>Inventory: {selectedGraph?.inventoryId ?? "none"}</span>
            <span>Scope: {selectedScopeVersion?.scopeVersionId ?? "none"}</span>
            <span>Route Authority: {selectedScopeVersion?.certifiedRouteReference?.routeAuthorityState ?? "NO_CERTIFIED_ROUTE"}</span>
            <span>Stations: {selectedGraph?.stations.length.toLocaleString() ?? "0"}</span>
          </div>
        </div>
      </div>

      <div className="dal-panel">
        <div className="dal-panel-title-row">
          <h3>Closures</h3>
          <button type="button" onClick={() => setWorkspace("twin")}>
            Twin
          </button>
        </div>
        {closures.length ? (
          <div className="dal-list">
            {closures.map((closure) => (
              <div key={closure.closureId} className="dal-list-row">
                <span>{closure.closureType}: {closure.stationId ?? closure.segmentId ?? closure.routeId ?? "unassigned"}</span>
                <b>{closure.footage.toLocaleString()} ft</b>
                <small>{closure.crew || "crew n/a"}</small>
              </div>
            ))}
          </div>
        ) : (
          <div className="dal-status">No closures yet.</div>
        )}
      </div>
    </section>
  );
}
