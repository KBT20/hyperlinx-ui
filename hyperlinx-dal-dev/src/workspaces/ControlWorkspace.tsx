import { useEffect, useMemo, useState } from "react";
import { createId, listControlWorkItems, listMarketplaceQuotes, listScopeVersions, now, saveControlWorkItem, saveScopeVersion } from "../api/dalClient";
import ScopeVersionLifecycleRibbon from "../components/ScopeVersionLifecycleRibbon";
import { useDALState } from "../dal/DALState";
import { buildFieldExecutionViewModel } from "../field/FieldExecutionViewModel";
import { LeafletMap, type GISBuildPath, type GISPoint, type GISRoute } from "../gis";
import { calculateScopeVersionProgress } from "../scopeversion/ClosureAuthorityEngine";
import { canControlActivateWork, canControlCreateWork, isScopeVersionApprovedForControl, withScopeVersionExecutionState } from "../scopeversion/LifecycleAuthorityEngine";
import { getAuthoritativeLifecycleState, transitionScopeVersionLifecycle } from "../scopeversion/ScopeVersionLifecycleGuard";
import type { ControlWorkItem, ControlWorkStatus, DALCoordinate, MarketplaceQuote, OperationalEvent, RouteStation, ScopeVersion } from "../types/dal";

const statuses: ControlWorkStatus[] = ["PENDING", "ACTIVE", "ON_HOLD", "COMPLETE", "CANCELLED"];
const workTypes: NonNullable<ControlWorkItem["workType"]>[] = ["ENGINEERING", "PERMITTING", "CONSTRUCTION", "ACTIVATION", "VALIDATION"];

function controlEvent(scopeVersionId: string, type: string, payload: Record<string, unknown>): OperationalEvent {
  return {
    eventId: createId("event"),
    type,
    entityId: scopeVersionId,
    entityType: "ScopeVersion",
    payload,
    createdAt: now(),
  };
}

function mostRecent(scopes: ScopeVersion[]) {
  return [...scopes].sort((a, b) => String(b.updatedAt ?? b.createdAt).localeCompare(String(a.updatedAt ?? a.createdAt)))[0] ?? null;
}

function defaultControlScope(scopes: ScopeVersion[], selected?: ScopeVersion | null) {
  if (selected) return selected;
  return (
    mostRecent(scopes.filter((scope) => getAuthoritativeLifecycleState(scope) === "APPROVED")) ??
    mostRecent(scopes.filter((scope) => getAuthoritativeLifecycleState(scope) === "QUOTED")) ??
    scopes[0] ??
    null
  );
}

function validCoordinate(coordinate: unknown): coordinate is DALCoordinate {
  return Array.isArray(coordinate) && Number.isFinite(Number(coordinate[0])) && Number.isFinite(Number(coordinate[1]));
}

function controlRoutes(scopeVersion: ScopeVersion | null, selectedGraph: ReturnType<typeof useDALState>["selectedGraph"]): GISRoute[] {
  if (!scopeVersion) return [];
  const routeId = (scopeVersion.canonicalTruth as any)?.networkBasis?.routeId;
  const route = selectedGraph?.routes.find((item) => item.routeId === routeId);
  if (!route?.coordinates?.length) return [];
  return [
    {
      id: route.routeId,
      label: route.name ?? "Backbone route segment",
      coordinates: route.coordinates,
      color: "#14b8a6",
      width: 5,
    },
  ];
}

function controlBuildPaths(scopeVersion: ScopeVersion | null): GISBuildPath[] {
  const truth = scopeVersion?.canonicalTruth as any;
  const geometry = truth?.geographicBasis?.geometry ?? truth?.geographicBasis?.buildPath?.geometry ?? scopeVersion?.geometry;
  return Array.isArray(geometry) && geometry.length > 1
    ? [
        {
          id: `${scopeVersion?.scopeVersionId ?? "scope"}-control-lateral`,
          label: "Planned lateral",
          coordinates: geometry,
        },
      ]
    : [];
}

function controlCandidate(scopeVersion: ScopeVersion | null): GISPoint[] {
  const truth = scopeVersion?.canonicalTruth as any;
  const lon = Number(truth?.geographicBasis?.candidateLongitude ?? scopeVersion?.longitude);
  const lat = Number(truth?.geographicBasis?.candidateLatitude ?? scopeVersion?.latitude);
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return [];
  return [
    {
      id: `${scopeVersion?.scopeVersionId ?? "scope"}-control-candidate`,
      label: String(truth?.sourceCandidate?.name ?? truth?.sourceCandidate?.companyName ?? "Candidate"),
      coordinate: [lon, lat],
      kind: "candidate",
    },
  ];
}

function controlAttachment(scopeVersion: ScopeVersion | null): GISPoint[] {
  const truth = scopeVersion?.canonicalTruth as any;
  const coordinate = truth?.networkBasis?.attachmentCoordinates ?? truth?.networkBasis?.attachmentPoint ?? scopeVersion?.attachmentCoordinates;
  if (!validCoordinate(coordinate)) return [];
  return [
    {
      id: `${scopeVersion?.scopeVersionId ?? "scope"}-control-attachment`,
      label: "Attachment",
      coordinate,
      kind: "attachment",
      state: "RELEASED",
    },
  ];
}

function controlStations(scopeVersion: ScopeVersion | null, selectedWork?: ControlWorkItem): GISPoint[] {
  const stations = (scopeVersion?.canonicalTruth?.stations ?? []).filter((station: any): station is RouteStation => validCoordinate(station?.coordinate));
  return stations.slice(0, 350).map((station) => ({
    id: `control:${scopeVersion?.scopeVersionId}:${station.stationId}`,
    label: station.stationLabel ?? station.stationId,
    coordinate: station.coordinate,
    kind: "station",
    state: station.stationState,
    selected: Boolean(selectedWork?.stationId && selectedWork.stationId === station.stationId),
  }));
}

export default function ControlWorkspace() {
  const { selectedScopeVersion, selectedGraph, setSelectedScopeVersion, setSelectedScopeVersionId, setWorkspace } = useDALState();
  const [quotes, setQuotes] = useState<MarketplaceQuote[]>([]);
  const [scopeVersions, setScopeVersions] = useState<ScopeVersion[]>([]);
  const [workItems, setWorkItems] = useState<ControlWorkItem[]>([]);
  const [selectedScopeId, setSelectedScopeId] = useState("");
  const [selectedWorkId, setSelectedWorkId] = useState("");
  const [scopeOnly, setScopeOnly] = useState(true);
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
      const nextDefault = defaultControlScope(nextScopes, selectedScopeVersion);
      if (nextDefault && !selectedScopeId) {
        setSelectedScopeId(nextDefault.scopeVersionId);
        setSelectedScopeVersion(nextDefault);
        setSelectedScopeVersionId(nextDefault.scopeVersionId);
      }
      setStatus("Control data loaded.");
    } catch (err: any) {
      setStatus(`Control load failed: ${err?.message ?? String(err)}`);
    }
  }

  const defaultScope = useMemo(() => defaultControlScope(scopeVersions, selectedScopeVersion), [scopeVersions, selectedScopeVersion]);
  const activeScope = scopeVersions.find((scope) => scope.scopeVersionId === selectedScopeId) ?? defaultScope;
  const selectedScopeWorkItems = useMemo(() => workItems.filter((item) => item.scopeVersionId === activeScope?.scopeVersionId), [activeScope?.scopeVersionId, workItems]);
  const filteredWorkItems = scopeOnly ? selectedScopeWorkItems : workItems;
  const selectedWorkItem = selectedScopeWorkItems.find((item) => item.workItemId === selectedWorkId) ?? selectedScopeWorkItems[0] ?? null;
  const controlGate = useMemo(() => canControlCreateWork(activeScope), [activeScope]);
  const scopeProgress = useMemo(() => (activeScope ? calculateScopeVersionProgress(activeScope) : null), [activeScope]);
  const fieldExecution = useMemo(() => buildFieldExecutionViewModel(activeScope), [activeScope]);
  const controlObjectCounts = fieldExecution.objectStateCounts as Record<string, number>;
  const quote = quotes.find((item) => item.scopeVersionId === activeScope?.scopeVersionId);
  const activeWorkCount = selectedScopeWorkItems.filter((item) => item.status === "ACTIVE").length;
  const scopeExecutable = isScopeVersionApprovedForControl(activeScope);
  const blockingReasons = controlGate.allowed ? [] : controlGate.reasons;
  const activeLifecycleState = getAuthoritativeLifecycleState(activeScope);

  useEffect(() => {
    if (!activeScope) return;
    console.log("[CONTROL_SCOPE_SELECTED]", {
      scopeVersionId: activeScope.scopeVersionId,
      lifecycleState: activeLifecycleState,
      routeAuthority: activeScope.certifiedRouteReference?.routeAuthorityState ?? "none",
      stationCount: activeScope.canonicalTruth?.stations?.length ?? 0,
      objectCount: activeScope.canonicalTruth?.objects?.length ?? 0,
      workPackageCount: selectedScopeWorkItems.length,
      activeWorkPackageCount: activeWorkCount,
    });
  }, [activeScope?.scopeVersionId, activeLifecycleState, selectedScopeWorkItems.length, activeWorkCount]);

  function selectScope(scopeVersionId: string) {
    const scope = scopeVersions.find((item) => item.scopeVersionId === scopeVersionId) ?? null;
    setSelectedScopeId(scopeVersionId);
    setSelectedScopeVersion(scope);
    setSelectedScopeVersionId(scope?.scopeVersionId ?? "");
    setSelectedWorkId("");
  }

  async function saveScopeStatus(scope: ScopeVersion, nextStatus: ScopeVersion["status"], eventType: string, payload: Record<string, unknown>, nextWorkItems = selectedScopeWorkItems) {
    const timestamp = now();
    const transitionedScope = transitionScopeVersionLifecycle({
      ...scope,
      updatedAt: timestamp,
      events: [...scope.events, controlEvent(scope.scopeVersionId, eventType, payload)],
    }, nextStatus, timestamp);
    const saved = await saveScopeVersion(
      withScopeVersionExecutionState(
        transitionedScope,
        nextWorkItems
      )
    );
    setSelectedScopeVersion(saved);
    setSelectedScopeVersionId(saved.scopeVersionId);
    setSelectedScopeId(saved.scopeVersionId);
    setScopeVersions((prev) => [saved, ...prev.filter((item) => item.scopeVersionId !== saved.scopeVersionId)]);
    return saved;
  }

  async function createWorkPackage() {
    if (!activeScope) {
      setStatus("Select a ScopeVersion before creating Control work.");
      return;
    }
    const gate = canControlCreateWork(activeScope);
    if (!gate.allowed) {
      setStatus(gate.reasons.join(" "));
      return;
    }
    const scopeTruth = activeScope.canonicalTruth as any;
    const networkBasis = scopeTruth?.networkBasis ?? {};
    const geographicBasis = scopeTruth?.geographicBasis ?? {};
    const engineeringBasis = scopeTruth?.engineeringBasis ?? {};
    const timestamp = now();
    const base = {
      scopeVersionId: activeScope.scopeVersionId,
      opportunitySeedId: scopeTruth?.sourceOpportunity?.opportunitySeedId ?? scopeTruth?.opportunitySeedId,
      quoteId: quote?.quoteId,
      inventoryId: activeScope.inventoryId,
      graphId: activeScope.graphId,
      routeId: networkBasis?.routeId,
      nodeId: networkBasis?.nodeId,
      stationId: networkBasis?.stationId,
      attachmentType: networkBasis?.attachmentStrategy,
      buildPath: geographicBasis?.buildPath,
      constructabilityAssessment: scopeTruth?.constructabilityAssessment ?? activeScope.constructability,
      permitRequirements: engineeringBasis?.permits ?? scopeTruth?.permitRequirements,
      crossingInventory: engineeringBasis?.crossings ?? scopeTruth?.crossingInventory,
    };
    const records: ControlWorkItem[] = workTypes.map((workType) => ({
      ...base,
      workItemId: createId("work"),
      workType,
      status: "PENDING",
      title: `${workType.replace("_", " ")} Work: ${scopeTruth?.sourceCandidate?.name ?? activeScope.scopeVersionId}`,
      notes:
        notes ||
        `${activeScope.scopeVersionId}. ${workType} work generated from approved ScopeVersion truth. Route ${base.routeId ?? "n/a"} station ${base.stationId ?? "n/a"}. Build ${Math.round(Number(engineeringBasis?.buildFeet ?? 0)).toLocaleString()} ft.`,
      createdAt: timestamp,
      updatedAt: timestamp,
    }));
    const savedWork = await Promise.all(records.map((item) => saveControlWorkItem(item)));
    setWorkItems((prev) => [...savedWork, ...prev.filter((record) => !savedWork.some((item) => item.workItemId === record.workItemId))]);
    const allScopeWorkItems = [...savedWork, ...selectedScopeWorkItems.filter((item) => !savedWork.some((savedItem) => savedItem.workItemId === item.workItemId))];
    const savedScope = await saveScopeStatus(activeScope, "CONTROL", "scopeversion.control.work_created", {
      workItemIds: savedWork.map((item) => item.workItemId),
      createdAs: "PENDING",
    }, allScopeWorkItems);
    setSelectedWorkId(savedWork[0]?.workItemId ?? "");
    console.log("[CONTROL_WORK_CREATED]", {
      scopeVersionId: savedScope.scopeVersionId,
      workItemIds: savedWork.map((item) => item.workItemId),
      lifecycleState: getAuthoritativeLifecycleState(savedScope),
    });
    setStatus(`Created ${savedWork.length} PENDING Control work packages from ${savedScope.scopeVersionId}. Activate a package before Field execution.`);
  }

  async function updateWorkStatus(item: ControlWorkItem, nextStatus: ControlWorkStatus) {
    if (!activeScope || item.scopeVersionId !== activeScope.scopeVersionId) {
      setStatus("Select a work package that belongs to the active ScopeVersion.");
      return;
    }
    if (nextStatus === "ACTIVE") {
      const activationGate = canControlActivateWork(activeScope, item);
      if (!activationGate.allowed) {
        setStatus(activationGate.reasons.join(" "));
        return;
      }
    }
    const saved = await saveControlWorkItem({ ...item, status: nextStatus, updatedAt: now() });
    const nextScopedWorkItems = selectedScopeWorkItems.map((record) => (record.workItemId === saved.workItemId ? saved : record));
    setWorkItems((prev) => prev.map((record) => (record.workItemId === saved.workItemId ? saved : record)));
    setSelectedWorkId(saved.workItemId);
    if (nextStatus === "ACTIVE" && saved.scopeVersionId === activeScope.scopeVersionId) {
      const savedScope = await saveScopeStatus(activeScope, "CONTROL_ACTIVE", "scopeversion.control.activated", {
        workItemId: saved.workItemId,
        workType: saved.workType,
      }, nextScopedWorkItems);
      console.log("[CONTROL_WORK_ACTIVATED]", {
        scopeVersionId: savedScope.scopeVersionId,
        workItemId: saved.workItemId,
        lifecycleState: getAuthoritativeLifecycleState(savedScope),
      });
    } else if (nextStatus === "COMPLETE" && nextScopedWorkItems.length && nextScopedWorkItems.every((workItem) => workItem.status === "COMPLETE")) {
      await saveScopeStatus(activeScope, "COMPLETE", "scopeversion.control.work_complete", {
        workItemIds: nextScopedWorkItems.map((workItem) => workItem.workItemId),
      }, nextScopedWorkItems);
    } else {
      await saveScopeStatus(activeScope, activeLifecycleState, "scopeversion.control.execution_state_updated", {
        workItemId: saved.workItemId,
        workType: saved.workType,
        status: saved.status,
      }, nextScopedWorkItems);
    }
    setStatus(`${saved.title} -> ${nextStatus}.`);
  }

  const fieldMapCandidates = controlCandidate(activeScope);
  const fieldMapAttachments = controlAttachment(activeScope);
  const fieldMapRoutes = controlRoutes(activeScope, selectedGraph);
  const fieldMapBuildPaths = controlBuildPaths(activeScope);
  const fieldMapStations = controlStations(activeScope, selectedWorkItem ?? undefined);
  const focusCoordinates = [
    ...fieldMapCandidates.map((point) => point.coordinate),
    ...fieldMapAttachments.map((point) => point.coordinate),
    ...fieldMapBuildPaths.flatMap((path) => path.coordinates),
    ...fieldMapRoutes.flatMap((route) => route.coordinates.slice(0, 2000)),
  ];

  return (
    <section className="dal-workspace">
      <div className="dal-workspace-header">
        <div>
          <h2>DAL Control</h2>
          <p>Control creates and activates work packages only after Route Engineering approves a ScopeVersion.</p>
        </div>
        <button type="button" onClick={() => void refresh()}>
          Refresh
        </button>
      </div>

      <ScopeVersionLifecycleRibbon scopeVersion={activeScope} />

      <div className="dal-grid">
        <div className="dal-panel">
          <h3>ScopeVersion Selection</h3>
          <select value={activeScope?.scopeVersionId ?? ""} onChange={(event) => selectScope(event.target.value)}>
            <option value="">Select ScopeVersion</option>
            {scopeVersions.map((scope) => (
              <option key={scope.scopeVersionId} value={scope.scopeVersionId}>
                {((scope.canonicalTruth as any)?.sourceCandidate?.name ?? (scope.canonicalTruth as any)?.sourceCandidate?.companyName ?? scope.scopeVersionId)} [{getAuthoritativeLifecycleState(scope)}]
              </option>
            ))}
          </select>
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Control package notes" />
          <button type="button" onClick={() => void createWorkPackage()} disabled={!controlGate.allowed}>
            Create Work Package
          </button>
          <div className="dal-status">{status}</div>
          {!controlGate.allowed ? <div className="dal-status">{controlGate.reasons.join(" ")}</div> : null}
        </div>

        <div className="dal-panel">
          <h3>Control Status</h3>
          <div className="dal-metrics">
            <span>Selected ScopeVersion: {activeScope?.scopeVersionId ?? "none"}</span>
            <span>Lifecycle State: {activeScope ? activeLifecycleState : "none"}</span>
            <span>Executable Authority: {scopeExecutable ? "PASS" : "FAIL"}</span>
            <span>Route Authority: {activeScope?.certifiedRouteReference?.routeAuthorityState ?? "NO_CERTIFIED_ROUTE"}</span>
            <span>Stations: {scopeProgress?.totalStations.toLocaleString() ?? "0"}</span>
            <span>Objects: {scopeProgress?.totalObjects.toLocaleString() ?? "0"}</span>
            <span>Work Packages: {selectedScopeWorkItems.length.toLocaleString()}</span>
            <span>Active Packages: {activeWorkCount.toLocaleString()}</span>
            <span>Quote TCV: {Math.round(Number(quote?.totalContractValue ?? 0)).toLocaleString()}</span>
            <span>Blocking Reasons: {blockingReasons.length ? blockingReasons.length : "0"}</span>
          </div>
        </div>
      </div>

      <div className="dal-panel">
        <div className="dal-panel-title-row">
          <h3>Control Release Map - planned work authority</h3>
          <span className="dal-status">Read-only map context for the selected ScopeVersion.</span>
        </div>
        <LeafletMap
          autoFocusKey={`${activeScope?.scopeVersionId ?? "none"}:control`}
          candidates={fieldMapCandidates}
          attachments={fieldMapAttachments}
          routes={fieldMapRoutes}
          buildPaths={fieldMapBuildPaths}
          stations={fieldMapStations}
          focusCoordinates={focusCoordinates}
          height={560}
          enableLevelOfDetail
        />
      </div>

      <div className="dal-panel">
        <div className="dal-panel-title-row">
          <h3>Work Queue</h3>
          <div className="dal-actions">
            <button type="button" className={scopeOnly ? "active-toggle" : ""} onClick={() => setScopeOnly(true)}>
              Selected Scope only
            </button>
            <button type="button" className={!scopeOnly ? "active-toggle" : ""} onClick={() => setScopeOnly(false)}>
              All work
            </button>
            <button type="button" onClick={() => setWorkspace("field")}>
              Field
            </button>
          </div>
        </div>
        {filteredWorkItems.length ? (
          <div className="dal-list">
            {filteredWorkItems.map((item) => (
              <div key={item.workItemId} className={`dal-list-row ${item.workItemId === selectedWorkId ? "selected" : ""}`}>
                <button type="button" onClick={() => setSelectedWorkId(item.workItemId)}>
                  Select
                </button>
                <span>{item.title}</span>
                <b>{item.status}</b>
                <small>{item.workType ?? "GENERAL"} / {item.scopeVersionId ?? "no scope"}</small>
                <div className="dal-actions">
                  <button type="button" onClick={() => void updateWorkStatus(item, "ACTIVE")} disabled={item.status === "ACTIVE"}>
                    Activate Work
                  </button>
                  <button type="button" onClick={() => void updateWorkStatus(item, "ON_HOLD")} disabled={item.status === "ON_HOLD"}>
                    Hold Work
                  </button>
                  <button type="button" onClick={() => void updateWorkStatus(item, "COMPLETE")} disabled={item.status === "COMPLETE"}>
                    Complete Work
                  </button>
                  <button type="button" onClick={() => void updateWorkStatus(item, "CANCELLED")} disabled={item.status === "CANCELLED"}>
                    Cancel Work
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="dal-status">No work items for this filter.</div>
        )}
      </div>

      <div className="dal-grid">
        <div className="dal-panel">
          <h3>Execution Readiness</h3>
          <div className="dal-metrics">
            <span>Total Stations: {scopeProgress?.totalStations.toLocaleString() ?? "0"}</span>
            <span>Released Stations: {scopeProgress?.releasedStations.toLocaleString() ?? "0"}</span>
            <span>In Progress Stations: {scopeProgress?.inProgressStations.toLocaleString() ?? "0"}</span>
            <span>Complete Stations: {scopeProgress?.completeStations.toLocaleString() ?? "0"}</span>
            <span>Verified Stations: {scopeProgress?.verifiedStations.toLocaleString() ?? "0"}</span>
            <span>Completed Feet: {Math.round(scopeProgress?.completedFeet ?? 0).toLocaleString()}</span>
            <span>Remaining Feet: {Math.round(scopeProgress?.remainingFeet ?? 0).toLocaleString()}</span>
            <span>Percent Complete: {Math.round(scopeProgress?.percentComplete ?? 0).toLocaleString()}%</span>
            <span>Open Closures: {scopeProgress?.openClosures.toLocaleString() ?? "0"}</span>
            <span>Released Objects: {(controlObjectCounts.RELEASED ?? 0).toLocaleString()}</span>
            <span>Installed Objects: {(controlObjectCounts.INSTALLED ?? 0).toLocaleString()}</span>
            <span>Tested Objects: {(controlObjectCounts.TESTED ?? 0).toLocaleString()}</span>
            <span>Accepted Objects: {(controlObjectCounts.ACCEPTED ?? 0).toLocaleString()}</span>
            <span>Completed Objects: {(controlObjectCounts.COMPLETE ?? 0).toLocaleString()}</span>
            <span>Verified Objects: {(controlObjectCounts.VERIFIED ?? 0).toLocaleString()}</span>
          </div>
        </div>
        <div className="dal-panel">
          <h3>Blocking Reasons</h3>
          {blockingReasons.length ? (
            <div className="dal-list">
              {blockingReasons.map((reason) => (
                <div key={reason} className="dal-list-row">
                  <span>{reason}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="dal-status">ScopeVersion is ready for Control work creation.</div>
          )}
        </div>
      </div>
    </section>
  );
}
