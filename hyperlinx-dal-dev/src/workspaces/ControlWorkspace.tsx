import { useEffect, useState } from "react";
import { createId, listControlWorkItems, listMarketplaceQuotes, listOpportunitySeeds, listScopeVersions, now, saveControlWorkItem, saveScopeVersion } from "../api/dalClient";
import { useDALState } from "../dal/DALState";
import type { ControlWorkItem, ControlWorkStatus, MarketplaceQuote, OperationalEvent, ScopeVersion } from "../types/dal";
import type { OpportunitySeed } from "../types/portfolio";

const statuses: ControlWorkStatus[] = ["PENDING", "ACTIVE", "ON_HOLD", "COMPLETE", "CANCELLED"];
const workTypes: NonNullable<ControlWorkItem["workType"]>[] = ["ENGINEERING", "PERMITTING", "CONSTRUCTION", "ACTIVATION", "VALIDATION"];

function controlEvent(scopeVersionId: string, payload: Record<string, unknown>): OperationalEvent {
  return {
    eventId: createId("event"),
    type: "scopeversion.control.activated",
    entityId: scopeVersionId,
    entityType: "ScopeVersion",
    payload,
    createdAt: now(),
  };
}

export default function ControlWorkspace() {
  const { selectedOpportunitySeed, selectedScopeVersion, selectedGraph, setSelectedScopeVersion, setSelectedScopeVersionId, setWorkspace } = useDALState();
  const [quotes, setQuotes] = useState<MarketplaceQuote[]>([]);
  const [seeds, setSeeds] = useState<OpportunitySeed[]>([]);
  const [scopeVersions, setScopeVersions] = useState<ScopeVersion[]>([]);
  const [workItems, setWorkItems] = useState<ControlWorkItem[]>([]);
  const [title, setTitle] = useState("DAL field work package");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("Control ready.");

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    try {
      const [nextQuotes, nextSeeds, nextScopes, nextWork] = await Promise.all([listMarketplaceQuotes(), listOpportunitySeeds(), listScopeVersions(), listControlWorkItems()]);
      setQuotes(nextQuotes);
      setSeeds(nextSeeds);
      setScopeVersions(nextScopes);
      setWorkItems(nextWork);
      setStatus("Control data loaded.");
    } catch (err: any) {
      setStatus(`Control load failed: ${err?.message ?? String(err)}`);
    }
  }

  async function createWorkItem() {
    const scope = selectedScopeVersion ?? scopeVersions[0];
    if (!scope) {
      setStatus("Select a ScopeVersion before creating Control work.");
      return;
    }
    const quote = quotes.find((item) => item.scopeVersionId === scope.scopeVersionId) ?? quotes[0];
    const scopeTruth = scope.canonicalTruth as any;
    const buildPath = (scope.buildPath as any) ?? scopeTruth?.buildPath;
    const constructability = scope.constructability ?? scopeTruth?.constructabilityAssessment ?? quote?.constructabilityAssessment;
    const timestamp = now();
    const base = {
      scopeVersionId: scope.scopeVersionId,
      opportunitySeedId: scopeTruth?.opportunitySeedId ?? quote?.opportunitySeedId,
      quoteId: quote?.quoteId,
      inventoryId: scope.inventoryId ?? quote?.inventoryId,
      graphId: scope.graphId ?? quote?.graphId,
      routeId: buildPath?.routeId ?? quote?.routeId ?? scopeTruth?.route?.routeId,
      nodeId: buildPath?.nodeId ?? quote?.nodeId ?? scopeTruth?.node?.nodeId,
      stationId: buildPath?.stationId ?? quote?.stationId ?? scopeTruth?.station?.stationId,
      attachmentType: scopeTruth?.opportunitySeed?.attachmentStrategy?.attachmentType ?? quote?.attachmentType ?? buildPath?.attachmentType,
      buildPath,
      constructabilityAssessment: constructability,
      permitRequirements: scope.permits ?? scopeTruth?.permitRequirements ?? (constructability as any)?.permitting,
      crossingInventory: scope.crossings ?? scopeTruth?.crossingInventory,
    };
    const records: ControlWorkItem[] = workTypes.map((workType) => ({
      ...base,
      workItemId: createId("work"),
      workType,
      status: "PENDING",
      title: `${workType.replace("_", " ")} Work: ${scopeTruth?.site?.companyName ?? scopeTruth?.candidateSite?.companyName ?? scope.scopeVersionId}`,
      notes:
        notes ||
        `${scope.scopeVersionId}. ${workType} work generated from ScopeVersion truth. Route ${base.routeId ?? "n/a"} station ${base.stationId ?? "n/a"}. Build ${Math.round(Number(buildPath?.buildFeet ?? scope.buildFeet ?? 0)).toLocaleString()} ft. Quote ${quote?.quoteId ?? "not quoted"}.`,
      createdAt: timestamp,
      updatedAt: timestamp,
    }));
    const saved = await Promise.all(records.map((item) => saveControlWorkItem(item)));
    setWorkItems((prev) => [...saved, ...prev.filter((record) => !saved.some((item) => item.workItemId === record.workItemId))]);
    const activatedScope = await saveScopeVersion({
      ...scope,
      status: "ACTIVATED",
      updatedAt: timestamp,
      events: [...scope.events, controlEvent(scope.scopeVersionId, { workItemIds: saved.map((item) => item.workItemId) })],
    });
    setSelectedScopeVersion(activatedScope);
    setSelectedScopeVersionId(activatedScope.scopeVersionId);
    setScopeVersions((prev) => [activatedScope, ...prev.filter((item) => item.scopeVersionId !== activatedScope.scopeVersionId)]);
    setStatus(`Created ${saved.length} work packages from ${activatedScope.scopeVersionId}.`);
  }

  async function updateWorkStatus(item: ControlWorkItem, nextStatus: ControlWorkStatus) {
    const saved = await saveControlWorkItem({ ...item, status: nextStatus, updatedAt: now() });
    setWorkItems((prev) => prev.map((record) => (record.workItemId === saved.workItemId ? saved : record)));
  }

  return (
    <section className="dal-workspace">
      <div className="dal-workspace-header">
        <div>
          <h2>DAL Control</h2>
          <p>Work queue activation, hold, completion, and graph/scope reference tracking.</p>
        </div>
        <button type="button" onClick={() => void refresh()}>
          Refresh
        </button>
      </div>

      <div className="dal-grid">
        <div className="dal-panel">
          <h3>Create Work Item</h3>
          <input value={title} onChange={(event) => setTitle(event.target.value)} />
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Control notes" />
          <button type="button" onClick={() => void createWorkItem()}>
            Generate Work From ScopeVersion
          </button>
          <div className="dal-status">{status}</div>
        </div>

        <div className="dal-panel">
          <h3>Context</h3>
          <div className="dal-metrics">
            <span>Scope: {selectedScopeVersion?.scopeVersionId ?? quotes[0]?.scopeVersionId ?? "none"}</span>
            <span>Status: {selectedScopeVersion?.status ?? scopeVersions[0]?.status ?? "none"}</span>
            <span>Inventory: {selectedGraph?.inventoryId ?? quotes[0]?.inventoryId ?? "none"}</span>
            <span>Build feet: {Math.round(Number(((selectedScopeVersion?.buildPath as any) ?? (selectedScopeVersion?.canonicalTruth as any)?.buildPath)?.buildFeet ?? selectedScopeVersion?.buildFeet ?? 0)).toLocaleString()}</span>
            <span>Attachment: {(selectedScopeVersion?.canonicalTruth as any)?.opportunitySeed?.attachmentStrategy?.attachmentType?.replaceAll("_", " ") ?? quotes[0]?.attachmentType?.replaceAll("_", " ") ?? "n/a"}</span>
            <span>Route: {((selectedScopeVersion?.buildPath as any) ?? (selectedScopeVersion?.canonicalTruth as any)?.buildPath)?.routeId ?? quotes[0]?.routeId ?? (selectedScopeVersion?.canonicalTruth as any)?.route?.routeId ?? "n/a"}</span>
            <span>Station: {((selectedScopeVersion?.buildPath as any) ?? (selectedScopeVersion?.canonicalTruth as any)?.buildPath)?.stationId ?? quotes[0]?.stationId ?? (selectedScopeVersion?.canonicalTruth as any)?.station?.stationId ?? "n/a"}</span>
            <span>Quote TCV: {Math.round(Number(quotes.find((quote) => quote.scopeVersionId === selectedScopeVersion?.scopeVersionId)?.totalContractValue ?? 0)).toLocaleString()}</span>
            <span>Constructability: {Math.round(Number(((selectedScopeVersion?.constructability as any) ?? (selectedScopeVersion?.canonicalTruth as any)?.constructabilityAssessment)?.constructabilityScore ?? 0)).toLocaleString()}</span>
            <span>Permit Authorities: {(((selectedScopeVersion?.permits as any) ?? (selectedScopeVersion?.canonicalTruth as any)?.permitRequirements)?.authorities ?? []).join(", ") || "n/a"}</span>
            <span>Quotes: {quotes.length.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div className="dal-panel">
        <div className="dal-panel-title-row">
          <h3>Work Queue</h3>
          <button type="button" onClick={() => setWorkspace("field")}>
            Field
          </button>
        </div>
        {workItems.length ? (
          <div className="dal-list">
            {workItems.map((item) => (
              <div key={item.workItemId} className="dal-list-row">
                <span>{item.title}</span>
                <select value={item.status} onChange={(event) => void updateWorkStatus(item, event.target.value as ControlWorkStatus)}>
                  {statuses.map((workStatus) => (
                    <option key={workStatus} value={workStatus}>
                      {workStatus}
                    </option>
                  ))}
                </select>
                <small>{item.workItemId}</small>
                <small>{item.workType ?? "GENERAL"} | {item.attachmentType?.replaceAll("_", " ") ?? "no attachment"} | {item.routeId ?? "no route"} | {item.stationId ?? "no station"}</small>
              </div>
            ))}
          </div>
        ) : (
          <div className="dal-status">No work items yet.</div>
        )}
      </div>
    </section>
  );
}
