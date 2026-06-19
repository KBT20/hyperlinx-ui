import { useEffect, useMemo, useState } from "react";
import { createId, listControlWorkItems, listMarketplaceQuotes, listScopeVersions, now, saveControlWorkItem, saveScopeVersion } from "../api/dalClient";
import ScopeVersionLifecycleRibbon from "../components/ScopeVersionLifecycleRibbon";
import { useDALState } from "../dal/DALState";
import { buildFieldExecutionViewModel } from "../field/FieldExecutionViewModel";
import { calculateScopeVersionProgress, deriveScopeVersionLifecycleState } from "../scopeversion/ClosureAuthorityEngine";
import type { ControlWorkItem, ControlWorkStatus, MarketplaceQuote, OperationalEvent, ScopeVersion } from "../types/dal";

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

function hasCertifiedRouteAuthority(scope: ScopeVersion | null | undefined) {
  return scope?.certifiedRouteReference?.routeAuthorityState === "CERTIFIED_ROUTE";
}

export default function ControlWorkspace() {
  const { selectedScopeVersion, selectedGraph, setSelectedScopeVersion, setSelectedScopeVersionId, setWorkspace } = useDALState();
  const [quotes, setQuotes] = useState<MarketplaceQuote[]>([]);
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
      const [nextQuotes, nextScopes, nextWork] = await Promise.all([listMarketplaceQuotes(), listScopeVersions(), listControlWorkItems()]);
      setQuotes(nextQuotes);
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
    if (!["QUOTED", "APPROVED", "ACTIVATED", "IN_CONSTRUCTION"].includes(scope.status)) {
      setStatus("Generate a quote and approve the ScopeVersion before Control activation.");
      return;
    }
    if (!hasCertifiedRouteAuthority(scope)) {
      setStatus("Control work blocked: ScopeVersion must reference a CERTIFIED_ROUTE.");
      return;
    }
    const quote = quotes.find((item) => item.scopeVersionId === scope.scopeVersionId);
    const scopeTruth = scope.canonicalTruth as any;
    const networkBasis = scopeTruth?.networkBasis ?? {};
    const geographicBasis = scopeTruth?.geographicBasis ?? {};
    const engineeringBasis = scopeTruth?.engineeringBasis ?? {};
    const buildPath = geographicBasis?.buildPath;
    const constructability = scopeTruth?.constructabilityAssessment ?? scope.constructability;
    const timestamp = now();
    const base = {
      scopeVersionId: scope.scopeVersionId,
      opportunitySeedId: scopeTruth?.sourceOpportunity?.opportunitySeedId ?? scopeTruth?.opportunitySeedId,
      quoteId: quote?.quoteId,
      inventoryId: scope.inventoryId,
      graphId: scope.graphId,
      routeId: networkBasis?.routeId,
      nodeId: networkBasis?.nodeId,
      stationId: networkBasis?.stationId,
      attachmentType: networkBasis?.attachmentStrategy,
      buildPath,
      constructabilityAssessment: constructability,
      permitRequirements: engineeringBasis?.permits ?? scopeTruth?.permitRequirements,
      crossingInventory: engineeringBasis?.crossings ?? scopeTruth?.crossingInventory,
    };
    const records: ControlWorkItem[] = workTypes.map((workType) => ({
      ...base,
      workItemId: createId("work"),
      workType,
      status: "PENDING",
      title: `${workType.replace("_", " ")} Work: ${scopeTruth?.sourceCandidate?.name ?? scope.scopeVersionId}`,
      notes:
        notes ||
        `${scope.scopeVersionId}. ${workType} work generated from ScopeVersion truth. Route ${base.routeId ?? "n/a"} station ${base.stationId ?? "n/a"}. Build ${Math.round(Number(engineeringBasis?.buildFeet ?? 0)).toLocaleString()} ft. Quote ${quote?.quoteId ?? "not quoted"}.`,
      createdAt: timestamp,
      updatedAt: timestamp,
    }));
    const saved = await Promise.all(records.map((item) => saveControlWorkItem(item)));
    setWorkItems((prev) => [...saved, ...prev.filter((record) => !saved.some((item) => item.workItemId === record.workItemId))]);
    const approvedScope =
      scope.status === "QUOTED"
        ? await saveScopeVersion({
            ...scope,
            status: "APPROVED",
            updatedAt: timestamp,
            events: [...scope.events, controlEvent(scope.scopeVersionId, { approvedForControl: true })],
          })
        : scope;
    const activatedScope = await saveScopeVersion({
      ...approvedScope,
      status: approvedScope.status === "IN_CONSTRUCTION" ? "IN_CONSTRUCTION" : "ACTIVATED",
      updatedAt: timestamp,
      events: [...approvedScope.events, controlEvent(scope.scopeVersionId, { workItemIds: saved.map((item) => item.workItemId) })],
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

  const activeScope = selectedScopeVersion ?? scopeVersions[0] ?? null;
  const scopeProgress = useMemo(() => (activeScope ? calculateScopeVersionProgress(activeScope) : null), [activeScope]);
  const fieldExecution = useMemo(() => buildFieldExecutionViewModel(activeScope), [activeScope]);
  const controlObjectCounts = fieldExecution.objectStateCounts as Record<string, number>;
  const blockedObjects = fieldExecution.stations.flatMap((station) => station.blockedObjectsAtStation);
  const nextOpenObject = fieldExecution.stations.flatMap((station) => station.openObjectsAtStation)[0];
  const completedObjects = Number(controlObjectCounts.COMPLETE ?? 0);
  const verifiedObjects = Number(controlObjectCounts.VERIFIED ?? 0);

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

      <ScopeVersionLifecycleRibbon scopeVersion={activeScope} />

      <div className="dal-grid">
        <div className="dal-panel">
          <h3>Create Work Item</h3>
          <input value={title} onChange={(event) => setTitle(event.target.value)} />
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Control notes" />
          <button type="button" onClick={() => void createWorkItem()} disabled={!hasCertifiedRouteAuthority(selectedScopeVersion ?? scopeVersions[0])}>
            Generate Work From ScopeVersion
          </button>
          <div className="dal-status">{status}</div>
        </div>

        <div className="dal-panel">
          <h3>Context</h3>
          <div className="dal-metrics">
            <span>Scope: {selectedScopeVersion?.scopeVersionId ?? scopeVersions[0]?.scopeVersionId ?? "none"}</span>
            <span>Status: {selectedScopeVersion?.status ?? scopeVersions[0]?.status ?? "none"}</span>
            <span>Inventory: {selectedScopeVersion?.inventoryId ?? selectedGraph?.inventoryId ?? "none"}</span>
            <span>Build feet: {Math.round(Number((selectedScopeVersion?.canonicalTruth as any)?.engineeringBasis?.buildFeet ?? 0)).toLocaleString()}</span>
            <span>Attachment: {(selectedScopeVersion?.canonicalTruth as any)?.networkBasis?.attachmentStrategy?.replaceAll("_", " ") ?? "n/a"}</span>
            <span>Route: {(selectedScopeVersion?.canonicalTruth as any)?.networkBasis?.routeId ?? "n/a"}</span>
            <span>Station: {(selectedScopeVersion?.canonicalTruth as any)?.networkBasis?.stationId ?? "n/a"}</span>
            <span>Route Authority: {(selectedScopeVersion ?? scopeVersions[0])?.certifiedRouteReference?.routeAuthorityState ?? "NO_CERTIFIED_ROUTE"}</span>
            <span>Quote TCV: {Math.round(Number(quotes.find((quote) => quote.scopeVersionId === selectedScopeVersion?.scopeVersionId)?.totalContractValue ?? 0)).toLocaleString()}</span>
            <span>Constructability: {Math.round(Number(((selectedScopeVersion?.constructability as any) ?? (selectedScopeVersion?.canonicalTruth as any)?.constructabilityAssessment)?.constructabilityScore ?? 0)).toLocaleString()}</span>
            <span>Permit Authorities: {(((selectedScopeVersion?.permits as any) ?? (selectedScopeVersion?.canonicalTruth as any)?.permitRequirements)?.authorities ?? []).join(", ") || "n/a"}</span>
            <span>Quotes: {quotes.length.toLocaleString()}</span>
            <span>Lifecycle State: {activeScope ? deriveScopeVersionLifecycleState(activeScope) : "none"}</span>
            <span>Total Stations: {scopeProgress?.totalStations.toLocaleString() ?? "0"}</span>
            <span>Released Stations: {scopeProgress?.releasedStations.toLocaleString() ?? "0"}</span>
            <span>In Progress Stations: {scopeProgress?.inProgressStations.toLocaleString() ?? "0"}</span>
            <span>Complete Stations: {scopeProgress?.completeStations.toLocaleString() ?? "0"}</span>
            <span>Verified Stations: {scopeProgress?.verifiedStations.toLocaleString() ?? "0"}</span>
            <span>Completed Feet: {Math.round(scopeProgress?.completedFeet ?? 0).toLocaleString()}</span>
            <span>Remaining Feet: {Math.round(scopeProgress?.remainingFeet ?? 0).toLocaleString()}</span>
            <span>Percent Complete: {Math.round(scopeProgress?.percentComplete ?? 0).toLocaleString()}%</span>
            <span>Open Closures: {scopeProgress?.openClosures.toLocaleString() ?? "0"}</span>
            <span>Latest Closure: {scopeProgress?.latestClosureTimestamp ?? "none"}</span>
            <span>Total Objects: {scopeProgress?.totalObjects.toLocaleString() ?? "0"}</span>
            <span>Released Objects: {(controlObjectCounts.RELEASED ?? 0).toLocaleString()}</span>
            <span>Installed Objects: {(controlObjectCounts.INSTALLED ?? 0).toLocaleString()}</span>
            <span>Tested Objects: {(controlObjectCounts.TESTED ?? 0).toLocaleString()}</span>
            <span>Accepted Objects: {(controlObjectCounts.ACCEPTED ?? 0).toLocaleString()}</span>
            <span>Completed Objects: {completedObjects.toLocaleString()}</span>
            <span>Verified Objects: {verifiedObjects.toLocaleString()}</span>
            <span>Blocked Objects: {blockedObjects.length.toLocaleString()}</span>
            <span>Next Open Object: {nextOpenObject ? `${nextOpenObject.humanName} @ ${nextOpenObject.stationId}` : "none"}</span>
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
