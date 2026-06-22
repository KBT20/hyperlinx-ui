import { useEffect, useMemo, useState } from "react";
import { listControlWorkItems, listScopeVersions, saveScopeVersion, saveScopeVersionClosure } from "../api/dalClient";
import ScopeVersionLifecycleRibbon from "../components/ScopeVersionLifecycleRibbon";
import { useDALState } from "../dal/DALState";
import { buildFieldExecutionViewModel } from "../field/FieldExecutionViewModel";
import { LeafletMap, type GISBuildPath, type GISPoint, type GISRoute } from "../gis";
import {
  applyClosureToScopeVersion,
  calculateScopeVersionProgress,
  createClosureRecord,
} from "../scopeversion/ClosureAuthorityEngine";
import { canFieldExecute } from "../scopeversion/LifecycleAuthorityEngine";
import { getAuthoritativeLifecycleState } from "../scopeversion/ScopeVersionLifecycleGuard";
import { buildScopeVersionFieldViewModel } from "../scopeversion/ScopeVersionFieldViewModel";
import type { ClosureAuthority, ClosureRecord, ControlWorkItem, FieldObjectWorkContext, FieldStationWorkContext, RouteStationState, ScopeObjectState, ScopeVersion } from "../types/dal";

function activeWork(item: ControlWorkItem) {
  return item.status === "ACTIVE";
}

function canClose(scope: ScopeVersion | null | undefined) {
  return Boolean(scope?.certifiedRouteReference?.certifiedRouteId && scope.canonicalTruth?.stations && scope.canonicalTruth?.objects);
}

const stationActions: Array<{ label: string; state: RouteStationState }> = [
  { label: "Release", state: "RELEASED" },
  { label: "Start Work", state: "IN_PROGRESS" },
  { label: "Complete", state: "COMPLETE" },
  { label: "Verify", state: "VERIFIED" },
  { label: "Block", state: "BLOCKED" },
  { label: "Reject", state: "REJECTED" },
];

const objectActions: Array<{ label: string; state: ScopeObjectState }> = [
  { label: "Release", state: "RELEASED" },
  { label: "Install", state: "INSTALLED" },
  { label: "Test", state: "TESTED" },
  { label: "Accept", state: "ACCEPTED" },
  { label: "Complete", state: "COMPLETE" },
  { label: "Verify", state: "VERIFIED" },
  { label: "Block", state: "BLOCKED" },
  { label: "Reject", state: "REJECTED" },
];

function fieldRoutes(scopeVersion: ScopeVersion | null, selectedGraph: ReturnType<typeof useDALState>["selectedGraph"]): GISRoute[] {
  if (!scopeVersion) return [];
  const truth = scopeVersion.canonicalTruth as any;
  const routeId = truth?.networkBasis?.routeId;
  const route = selectedGraph?.routes.find((item) => item.routeId === routeId);
  if (!route?.coordinates?.length) return [];
  return [
    {
      id: route.routeId,
      label: route.name ?? "FiberLight Backbone",
      coordinates: route.coordinates,
      color: "#13b981",
      width: 6,
    },
  ];
}

function fieldBuildPaths(scopeVersion: ScopeVersion | null): GISBuildPath[] {
  const truth = scopeVersion?.canonicalTruth as any;
  const geometry = truth?.geographicBasis?.geometry ?? truth?.geographicBasis?.buildPath?.geometry ?? scopeVersion?.geometry;
  return Array.isArray(geometry) && geometry.length
    ? [
        {
          id: `${scopeVersion?.scopeVersionId ?? "scope"}-lateral`,
          label: "Certified lateral",
          coordinates: geometry,
        },
      ]
    : [];
}

function candidatePoint(scopeVersion: ScopeVersion | null): GISPoint[] {
  const truth = scopeVersion?.canonicalTruth as any;
  const lon = Number(truth?.geographicBasis?.candidateLongitude ?? scopeVersion?.longitude);
  const lat = Number(truth?.geographicBasis?.candidateLatitude ?? scopeVersion?.latitude);
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return [];
  const site = truth?.sourceCandidate ?? truth?.site ?? truth?.candidateSite;
  return [
    {
      id: `${scopeVersion?.scopeVersionId ?? "scope"}-candidate`,
      label: String(site?.name ?? site?.companyName ?? "Candidate Site"),
      coordinate: [lon, lat],
      kind: "candidate",
    },
  ];
}

function attachmentPoint(scopeVersion: ScopeVersion | null): GISPoint[] {
  const truth = scopeVersion?.canonicalTruth as any;
  const coordinate = truth?.networkBasis?.attachmentCoordinates ?? truth?.networkBasis?.attachmentPoint ?? scopeVersion?.attachmentCoordinates;
  if (!Array.isArray(coordinate) || !Number.isFinite(Number(coordinate[0])) || !Number.isFinite(Number(coordinate[1]))) return [];
  return [
    {
      id: `${scopeVersion?.scopeVersionId ?? "scope"}-attachment`,
      label: "Inventory Attachment",
      coordinate: [Number(coordinate[0]), Number(coordinate[1])],
      kind: "attachment",
      state: "RELEASED",
    },
  ];
}

function objectClosedState(state: ScopeObjectState) {
  return state === "COMPLETE" || state === "VERIFIED" || state === "BLOCKED" || state === "REJECTED";
}

function latestClosureTimestamp(object: FieldObjectWorkContext) {
  return object.closureHistory.at(-1)?.updatedAt ?? object.closureHistory.at(-1)?.createdAt ?? "none";
}

function persistenceBadgeClass(status: string) {
  if (status.startsWith("SERVER_PERSISTED")) return "dal-badge pass";
  if (status.startsWith("PERSISTENCE_FAILED")) return "dal-badge fail";
  if (status.startsWith("PERSISTENCE_PENDING")) return "dal-badge warning";
  return "dal-badge warning";
}

function stateCounts(stations: FieldStationWorkContext[]) {
  return stations.reduce<Record<string, number>>((counts, station) => {
    counts[station.stationDerivedState] = (counts[station.stationDerivedState] ?? 0) + 1;
    return counts;
  }, {});
}

export default function FieldWorkspace() {
  const { selectedGraph, selectedScopeVersion, selectedScopeVersionId, setSelectedScopeVersion, setSelectedScopeVersionId, setWorkspace } = useDALState();
  const [workItems, setWorkItems] = useState<ControlWorkItem[]>([]);
  const [scopeVersions, setScopeVersions] = useState<ScopeVersion[]>([]);
  const [selectedWorkId, setSelectedWorkId] = useState("");
  const [selectedStationId, setSelectedStationId] = useState("");
  const [selectedObjectId, setSelectedObjectId] = useState("");
  const [rangeStartId, setRangeStartId] = useState("");
  const [rangeEndId, setRangeEndId] = useState("");
  const [rangeTargetState, setRangeTargetState] = useState<RouteStationState>("COMPLETE");
  const [actorName, setActorName] = useState("DAL Field Operator");
  const [authority, setAuthority] = useState<ClosureAuthority>("FIELD");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("Field ready.");
  const [persistenceStatus, setPersistenceStatus] = useState("No closures submitted this session.");

  useEffect(() => {
    void refresh();
  }, []);

  const activeScope = useMemo(() => {
    const selectedScopeId = selectedScopeVersionId || selectedScopeVersion?.scopeVersionId;
    return (
      scopeVersions.find((scope) => scope.scopeVersionId === selectedScopeId) ??
      selectedScopeVersion ??
      scopeVersions.find((scope) => scope.scopeVersionId === workItems.find((item) => item.workItemId === selectedWorkId)?.scopeVersionId) ??
      scopeVersions[0] ??
      null
    );
  }, [scopeVersions, selectedScopeVersion, selectedScopeVersionId, selectedWorkId, workItems]);
  const selectedScopeWorkItems = useMemo(() => workItems.filter((item) => item.scopeVersionId === activeScope?.scopeVersionId), [activeScope?.scopeVersionId, workItems]);
  const activeItems = useMemo(() => selectedScopeWorkItems.filter(activeWork), [selectedScopeWorkItems]);
  const selectedWorkItem = useMemo(() => {
    const selected = activeItems.find((item) => item.workItemId === selectedWorkId);
    if (selected) return selected;
    return activeItems[0] ?? null;
  }, [activeItems, selectedWorkId]);
  const activeLifecycleState = getAuthoritativeLifecycleState(activeScope);
  const fieldGate = useMemo(() => canFieldExecute(activeScope, selectedWorkItem ?? undefined), [activeScope, selectedWorkItem]);
  const fieldModel = useMemo(() => (activeScope ? buildScopeVersionFieldViewModel(activeScope) : null), [activeScope]);
  const fieldExecution = useMemo(() => buildFieldExecutionViewModel(activeScope), [activeScope]);
  const progress = useMemo(() => (activeScope ? calculateScopeVersionProgress(activeScope) : null), [activeScope]);
  const stationContexts = fieldExecution.stations;
  const selectedStationContext = stationContexts.find((station) => station.stationId === selectedStationId) ?? stationContexts[0];
  const selectedStationIndex = selectedStationContext ? stationContexts.findIndex((station) => station.stationId === selectedStationContext.stationId) : -1;
  const selectedObjectContext =
    selectedStationContext?.objectsAtStation.find((object) => object.objectId === selectedObjectId) ??
    selectedStationContext?.objectsAtStation.find((object) => object.objectId === selectedStationContext.nextRecommendedObjectId) ??
    selectedStationContext?.objectsAtStation[0];
  const stationCounts = stateCounts(stationContexts);
  const openStationContexts = stationContexts.filter((station) => station.openObjectsAtStation.length);
  const openObjectCount = stationContexts.reduce((sum, station) => sum + station.openObjectsAtStation.length, 0);

  useEffect(() => {
    if (!selectedStationId && stationContexts[0]) {
      setSelectedStationId(stationContexts[0].stationId);
      setRangeStartId(stationContexts[0].stationId);
      setRangeEndId(stationContexts[Math.min(5, stationContexts.length - 1)]?.stationId ?? stationContexts[0].stationId);
    }
  }, [stationContexts, selectedStationId]);

  useEffect(() => {
    if (!selectedStationContext) return;
    const objectBelongsToStation = selectedStationContext.objectsAtStation.some((object) => object.objectId === selectedObjectId);
    if (!objectBelongsToStation) {
      setSelectedObjectId(selectedStationContext.nextRecommendedObjectId ?? selectedStationContext.objectsAtStation[0]?.objectId ?? "");
    }
  }, [selectedObjectId, selectedStationContext?.stationId, selectedStationContext?.nextRecommendedObjectId, selectedStationContext?.objectsAtStation.length]);

  async function refresh() {
    try {
      const [nextWork, nextScopes] = await Promise.all([listControlWorkItems(), listScopeVersions()]);
      setWorkItems(nextWork);
      setScopeVersions(nextScopes);
      const nextSelected = selectedScopeVersionId ? nextScopes.find((scope) => scope.scopeVersionId === selectedScopeVersionId) : nextScopes[0];
      const nextSelectedScopeId = nextSelected?.scopeVersionId ?? selectedScopeVersionId;
      const nextActiveWork = nextWork.find((workItem) => workItem.scopeVersionId === nextSelectedScopeId && activeWork(workItem));
      if (!selectedWorkId && nextActiveWork) setSelectedWorkId(nextActiveWork.workItemId);
      if (nextSelected && !selectedScopeVersion) {
        setSelectedScopeVersion(nextSelected);
        setSelectedScopeVersionId(nextSelected.scopeVersionId);
      }
      if (nextSelected) {
        const closureIds = [...(nextSelected.canonicalTruth?.closures ?? []), ...(nextSelected.closures ?? [])].map((closure) => closure.closureId);
        console.log("[SCOPEVERSION_RELOAD_CLOSURES]", {
          scopeVersionId: nextSelected.scopeVersionId,
          closureCount: new Set(closureIds).size,
          closureIds,
        });
      }
      setStatus("Field data loaded.");
    } catch (err: any) {
      setStatus(`Field load failed: ${err?.message ?? String(err)}`);
    }
  }

  async function persistUpdatedScope(updated: ScopeVersion) {
    const saved = await saveScopeVersion(updated);
    setSelectedScopeVersion(saved);
    setSelectedScopeVersionId(saved.scopeVersionId);
    setScopeVersions((prev) => [saved, ...prev.filter((scope) => scope.scopeVersionId !== saved.scopeVersionId)]);
    setPersistenceStatus("PERSISTENCE_PENDING: ScopeVersion updated through ClosureAuthorityEngine; DAL server persistence depends on configured endpoint availability.");
    return saved;
  }

  async function persistClosure(scopeVersion: ScopeVersion, closure: ClosureRecord) {
    console.log("[CLOSURE_PERSIST_REQUEST]", {
      scopeVersionId: scopeVersion.scopeVersionId,
      closureId: closure.closureId,
      closureType: closure.closureType,
      stationId: closure.stationId,
      objectIds: closure.objectIds,
      newStationState: closure.newStationState,
      newObjectState: closure.newObjectState,
    });
    try {
      const saved = await saveScopeVersionClosure(scopeVersion.scopeVersionId, closure, scopeVersion.updatedAt);
      setSelectedScopeVersion(saved);
      setSelectedScopeVersionId(saved.scopeVersionId);
      setScopeVersions((prev) => [saved, ...prev.filter((item) => item.scopeVersionId !== saved.scopeVersionId)]);
      setPersistenceStatus("SERVER_PERSISTED");
      console.log("[CLOSURE_PERSIST_SUCCESS]", {
        scopeVersionId: saved.scopeVersionId,
        closureId: closure.closureId,
        closureCount: new Set([...(saved.canonicalTruth?.closures ?? []), ...(saved.closures ?? [])].map((item) => item.closureId)).size,
      });
      return saved;
    } catch (err: any) {
      if (String(err?.message ?? err).includes("ACTIVE_CONTROL_WORK_REQUIRED")) {
        setPersistenceStatus("PERSISTENCE_REJECTED: ACTIVE_CONTROL_WORK_REQUIRED");
        setStatus("Closure rejected by DAL server: active Control work is required.");
        throw err;
      }
      console.log("[CLOSURE_PERSIST_FAILURE]", {
        scopeVersionId: scopeVersion.scopeVersionId,
        closureId: closure.closureId,
        message: err?.message ?? String(err),
      });
      const optimistic = applyClosureToScopeVersion(scopeVersion, closure);
      try {
        const saved = await persistUpdatedScope(optimistic);
        setPersistenceStatus(`PERSISTENCE_PENDING: server closure append failed; local fallback retained. ${err?.message ?? String(err)}`);
        return saved;
      } catch (fallbackErr: any) {
        setSelectedScopeVersion(optimistic);
        setSelectedScopeVersionId(optimistic.scopeVersionId);
        setPersistenceStatus(`PERSISTENCE_FAILED: server and local fallback failed. ${fallbackErr?.message ?? String(fallbackErr)}`);
        throw fallbackErr;
      }
    }
  }

  function blockClosureIfUnauthorized() {
    const gate = canFieldExecute(activeScope, selectedWorkItem ?? undefined);
    if (gate.allowed) return false;
    console.log("[FIELD_CLOSURE_BLOCKED]", {
      scopeVersionId: activeScope?.scopeVersionId ?? "none",
      workItemId: selectedWorkItem?.workItemId ?? "none",
      reasons: gate.reasons,
    });
    setStatus(`Closure blocked: ${gate.reasons.join(" ")}`);
    return true;
  }

  function selectStation(station: FieldStationWorkContext | undefined, objectId?: string) {
    if (!station) return;
    setSelectedStationId(station.stationId);
    setSelectedObjectId(objectId ?? station.nextRecommendedObjectId ?? station.objectsAtStation[0]?.objectId ?? "");
  }

  function selectNextOpenStation() {
    if (!openStationContexts.length) return;
    const currentOpenIndex = openStationContexts.findIndex((station) => station.stationId === selectedStationContext?.stationId);
    selectStation(openStationContexts[currentOpenIndex >= 0 ? Math.min(currentOpenIndex + 1, openStationContexts.length - 1) : 0]);
  }

  function selectNextOpenObject() {
    if (!stationContexts.length) return;
    const currentObjects = selectedStationContext?.openObjectsAtStation ?? [];
    const currentObjectIndex = currentObjects.findIndex((object) => object.objectId === selectedObjectContext?.objectId);
    const nextInStation = currentObjects[currentObjectIndex >= 0 ? currentObjectIndex + 1 : 0];
    if (nextInStation) {
      setSelectedObjectId(nextInStation.objectId);
      return;
    }
    const firstOpenStation = stationContexts.find((station) => station.openObjectsAtStation.length && station.stationId !== selectedStationContext?.stationId);
    if (firstOpenStation) selectStation(firstOpenStation, firstOpenStation.openObjectsAtStation[0]?.objectId);
  }

  async function submitObjectTransition(object: FieldObjectWorkContext, toState: ScopeObjectState) {
    if (!activeScope) {
      setStatus("Select a ScopeVersion before submitting object closure authority.");
      return;
    }
    if (blockClosureIfUnauthorized()) return;
    if (!canClose(activeScope)) {
      setStatus("Closure blocked: ScopeVersion must have certifiedRouteReference, stations, and objects.");
      return;
    }
    try {
      const closure = createClosureRecord({
        scopeVersion: activeScope,
        workItemId: selectedWorkItem?.workItemId,
        closureType: "OBJECT_STATE_TRANSITION",
        stationId: object.stationId,
        objectId: object.objectId,
        objectIds: [object.objectId],
        newObjectState: toState,
        actorId: actorName.toLowerCase().replaceAll(" ", "-") || "field-operator",
        actorName,
        authority,
        notes,
      });
      console.log("[OBJECT_CLOSURE]", {
        closureType: closure.closureType,
        stationId: object.stationId,
        objectIds: closure.objectIds,
        previousObjectStates: closure.previousObjectStates,
        newObjectState: closure.newObjectState,
        authority: closure.authority,
        createdAt: closure.createdAt,
      });
      const saved = await persistClosure(activeScope, closure);
      const nextModel = buildFieldExecutionViewModel(saved);
      const nextStation = nextModel.stations.find((station) => station.stationId === object.stationId);
      if (toState === "COMPLETE" || toState === "VERIFIED") {
        const nextOpenObject = nextStation?.openObjectsAtStation.find((item) => item.objectId !== object.objectId) ?? nextModel.stations.flatMap((station) => station.openObjectsAtStation)[0];
        if (nextOpenObject) {
          setSelectedStationId(nextOpenObject.stationId);
          setSelectedObjectId(nextOpenObject.objectId);
        }
      }
      setStatus(`Object closure ${closure.closureId} applied: ${object.humanName} -> ${toState}.`);
    } catch (err: any) {
      setStatus(`Object closure rejected: ${err?.message ?? String(err)}`);
    }
  }

  async function submitStationTransition(toState: RouteStationState) {
    if (!activeScope || !selectedStationContext) {
      setStatus("Select a ScopeVersion station before submitting closure authority.");
      return;
    }
    if (blockClosureIfUnauthorized()) return;
    if (!canClose(activeScope)) {
      setStatus("Closure blocked: ScopeVersion must have certifiedRouteReference, stations, and objects.");
      return;
    }
    try {
      const closure = createClosureRecord({
        scopeVersion: activeScope,
        workItemId: selectedWorkItem?.workItemId,
        closureType: "STATION_STATE_TRANSITION",
        stationId: selectedStationContext.stationId,
        newStationState: toState,
        actorId: actorName.toLowerCase().replaceAll(" ", "-") || "field-operator",
        actorName,
        authority,
        notes,
      });
      const saved = await persistClosure(activeScope, closure);
      const nextModel = buildFieldExecutionViewModel(saved);
      if (toState === "COMPLETE" || toState === "VERIFIED") {
        const nextOpen = nextModel.stations.find((station) => station.openObjectsAtStation.length);
        if (nextOpen) selectStation(nextOpen);
      }
      setStatus(`Station closure ${closure.closureId} applied: ${selectedStationContext.stationId} -> ${toState}.`);
    } catch (err: any) {
      setStatus(`Station closure rejected: ${err?.message ?? String(err)}`);
    }
  }

  async function submitRangeTransition() {
    if (!activeScope) {
      setStatus("Select a ScopeVersion before submitting a station range closure.");
      return;
    }
    if (blockClosureIfUnauthorized()) return;
    if (!canClose(activeScope)) {
      setStatus("Closure blocked: ScopeVersion must have certifiedRouteReference, stations, and objects.");
      return;
    }
    try {
      const closure = createClosureRecord({
        scopeVersion: activeScope,
        workItemId: selectedWorkItem?.workItemId,
        closureType: "STATION_RANGE_TRANSITION",
        stationStartId: rangeStartId,
        stationEndId: rangeEndId,
        newStationState: rangeTargetState,
        actorId: actorName.toLowerCase().replaceAll(" ", "-") || "field-operator",
        actorName,
        authority,
        notes,
      });
      await persistClosure(activeScope, closure);
      setStatus(`Range closure ${closure.closureId} applied: ${rangeStartId} -> ${rangeEndId} as ${rangeTargetState}.`);
    } catch (err: any) {
      setStatus(`Range closure rejected: ${err?.message ?? String(err)}`);
    }
  }

  const fieldMapCandidates = candidatePoint(activeScope);
  const stationPoints: GISPoint[] = stationContexts.map((station) => {
    const objectBadge = `${station.openObjectsAtStation.length} open / ${station.completeObjectsAtStation.length + station.verifiedObjectsAtStation.length} done`;
    const hasAttachment = station.objectsAtStation.some((object) => object.objectType === "NETWORK_ATTACHMENT");
    return {
      id: `field:${station.scopeVersionId}:${station.stationId}`,
      label: `${station.stationLabel} ${objectBadge}`,
      coordinate: station.coordinate,
      kind: hasAttachment ? "attachment" : "station",
      state: station.stationDerivedState,
      selected: station.stationId === selectedStationContext?.stationId,
      current: station.stationId === selectedStationContext?.stationId,
      muted: station.stationDerivedState === "COMPLETE" || station.stationDerivedState === "VERIFIED",
      payload: {
        stationId: station.stationId,
        objectId: station.nextRecommendedObjectId,
      },
    };
  });
  const fieldMapAttachments = [...attachmentPoint(activeScope), ...stationPoints.filter((point) => point.kind === "attachment")];
  const fieldMapStations = stationPoints.filter((point) => point.kind !== "attachment");
  const fieldMapRoutes = fieldRoutes(activeScope, selectedGraph);
  const fieldMapBuildPaths = fieldBuildPaths(activeScope);
  const fieldFocus = selectedStationContext
    ? [
        selectedStationContext.coordinate,
        selectedObjectContext?.coordinate,
        ...fieldMapCandidates.map((point) => point.coordinate),
        ...fieldMapAttachments.map((point) => point.coordinate),
        ...fieldMapBuildPaths.flatMap((path) => path.coordinates),
      ].filter(Boolean) as any
    : undefined;

  return (
    <section className="dal-workspace">
      <div className="dal-workspace-header">
        <div>
          <h2>DAL Field</h2>
          <p>Object-centric field execution against ScopeVersion production stations. Stations remain spatial authority; objects are the closure targets.</p>
        </div>
        <button type="button" onClick={() => void refresh()}>
          Refresh
        </button>
      </div>

      <ScopeVersionLifecycleRibbon scopeVersion={activeScope} />

      <div className="dal-grid">
        <div className="dal-panel">
          <h3>Select Work Item</h3>
          <select value={selectedWorkId} onChange={(event) => setSelectedWorkId(event.target.value)}>
            <option value="">Active work package context</option>
            {activeItems.map((item) => (
              <option key={item.workItemId} value={item.workItemId}>
                {item.title} [{item.status}]
              </option>
            ))}
          </select>
          {!activeItems.length ? <div className="dal-status">No active Control work package available.</div> : null}
          <select
            value={activeScope?.scopeVersionId ?? ""}
            onChange={(event) => {
              const scope = scopeVersions.find((item) => item.scopeVersionId === event.target.value) ?? null;
              setSelectedScopeVersion(scope);
              setSelectedScopeVersionId(scope?.scopeVersionId ?? "");
              setSelectedWorkId("");
              setSelectedStationId("");
              setSelectedObjectId("");
            }}
          >
            <option value="">ScopeVersion context</option>
            {scopeVersions.map((scope) => (
              <option key={scope.scopeVersionId} value={scope.scopeVersionId}>
                {((scope.canonicalTruth as any)?.sourceCandidate?.name ?? (scope.canonicalTruth as any)?.sourceCandidate?.companyName ?? scope.scopeVersionId)} [{getAuthoritativeLifecycleState(scope)}]
              </option>
            ))}
          </select>
          <div className="dal-metrics">
            <span>Open Objects: {openObjectCount.toLocaleString()}</span>
            <span>Released: {(fieldExecution.objectStateCounts.RELEASED ?? 0).toLocaleString()}</span>
            <span>Installed: {(fieldExecution.objectStateCounts.INSTALLED ?? 0).toLocaleString()}</span>
            <span>Tested: {(fieldExecution.objectStateCounts.TESTED ?? 0).toLocaleString()}</span>
            <span>Accepted: {(fieldExecution.objectStateCounts.ACCEPTED ?? 0).toLocaleString()}</span>
            <span>Complete: {(fieldExecution.objectStateCounts.COMPLETE ?? 0).toLocaleString()}</span>
            <span>Verified: {(fieldExecution.objectStateCounts.VERIFIED ?? 0).toLocaleString()}</span>
            <span>Blocked: {(fieldExecution.objectStateCounts.BLOCKED ?? 0).toLocaleString()}</span>
          </div>
          <div className="dal-status">
            Field execution gate: {fieldGate.allowed ? "PASS" : "BLOCKED"}
            {selectedWorkItem ? ` / ${selectedWorkItem.workItemId}` : " / no active work"}
          </div>
          {!fieldGate.allowed ? <div className="dal-status">{fieldGate.reasons.join(" ")}</div> : null}
          <input value={actorName} onChange={(event) => setActorName(event.target.value)} placeholder="Actor name" />
          <select value={authority} onChange={(event) => setAuthority(event.target.value as ClosureAuthority)}>
            <option value="FIELD">FIELD</option>
            <option value="CONTROL">CONTROL</option>
            <option value="ENGINEERING_REVIEW">ENGINEERING_REVIEW</option>
            <option value="SYSTEM">SYSTEM</option>
          </select>
          <div className="dal-status">{status}</div>
          <div className="dal-status">
            <span className={persistenceBadgeClass(persistenceStatus)}>{persistenceStatus.split(":")[0]}</span>
          </div>
          <div className="dal-status">{persistenceStatus}</div>
        </div>

        <div className="dal-panel">
          <h3>Next Open Work</h3>
          <div className="dal-actions">
            <button type="button" onClick={() => selectStation(stationContexts[Math.max(0, selectedStationIndex - 1)])} disabled={selectedStationIndex <= 0}>
              Previous Station
            </button>
            <button type="button" onClick={() => selectStation(stationContexts[Math.min(stationContexts.length - 1, selectedStationIndex + 1)])} disabled={selectedStationIndex < 0 || selectedStationIndex >= stationContexts.length - 1}>
              Next Station
            </button>
            <button type="button" onClick={selectNextOpenStation} disabled={!openStationContexts.length}>
              Next Open Station
            </button>
            <button type="button" onClick={selectNextOpenObject} disabled={!openObjectCount}>
              Next Open Object
            </button>
          </div>
          <select value={selectedStationContext?.stationId ?? ""} onChange={(event) => selectStation(stationContexts.find((station) => station.stationId === event.target.value))}>
            {stationContexts.map((station) => (
              <option key={station.stationId} value={station.stationId}>
                {station.stationLabel} / {station.openObjectsAtStation.length} open / {station.stationDerivedState}
              </option>
            ))}
          </select>
          <select value={selectedObjectContext?.objectId ?? ""} onChange={(event) => setSelectedObjectId(event.target.value)} disabled={!selectedStationContext?.objectsAtStation.length}>
            {selectedStationContext?.objectsAtStation.map((object) => (
              <option key={object.objectId} value={object.objectId}>
                {object.humanName} [{object.objectState}]
              </option>
            ))}
          </select>
          <div className="dal-status">Select Work Item to Station Work Context to Object Closure to Twin/OI projection.</div>
        </div>
      </div>

      <div className="dal-panel">
        <div className="dal-panel-title-row">
          <h3>Field Execution Map</h3>
          <span className="dal-status">Low zoom: route summary. Medium: station markers. High: station labels and object badges.</span>
        </div>
        <LeafletMap
          autoFocusKey={`${activeScope?.scopeVersionId ?? "none"}:${selectedStationContext?.stationId ?? "none"}:${selectedObjectContext?.objectId ?? "none"}`}
          candidates={fieldMapCandidates}
          attachments={fieldMapAttachments}
          stations={fieldMapStations}
          routes={fieldMapRoutes}
          buildPaths={fieldMapBuildPaths}
          focusCoordinates={fieldFocus}
          height={620}
          enableLevelOfDetail
          onPointSelect={(point) => {
            const payload = point.payload as { stationId?: string; objectId?: string } | undefined;
            const station = stationContexts.find((item) => item.stationId === payload?.stationId);
            if (station) selectStation(station, payload?.objectId);
          }}
        />
        <div className="dal-field-legend">
          <span><b className="legend-dot state-planned" /> Planned</span>
          <span><b className="legend-dot state-released" /> Released</span>
          <span><b className="legend-dot state-in-progress" /> In Progress</span>
          <span><b className="legend-dot state-complete" /> Complete</span>
          <span><b className="legend-dot state-verified" /> Verified</span>
          <span><b className="legend-dot state-blocked" /> Blocked</span>
          <span><b className="legend-dot state-rejected" /> Rejected</span>
        </div>
      </div>

      <div className="dal-grid">
        <div className="dal-panel">
          <h3>Station Work Context</h3>
          {selectedStationContext ? (
            <>
              <div className="dal-metrics">
                <span>Station ID: {selectedStationContext.stationId}</span>
                <span>Measure: {selectedStationContext.stationLabel} / {Math.round(selectedStationContext.measureFeet).toLocaleString()} ft</span>
                <span>Explicit State: {selectedStationContext.stationState}</span>
                <span>Derived State: {selectedStationContext.stationDerivedState}</span>
                <span>Objects: {selectedStationContext.objectsAtStation.length}</span>
                <span>Open: {selectedStationContext.openObjectsAtStation.length}</span>
                <span>Complete: {selectedStationContext.completeObjectsAtStation.length}</span>
                <span>Verified: {selectedStationContext.verifiedObjectsAtStation.length}</span>
                <span>Blocked: {selectedStationContext.blockedObjectsAtStation.length}</span>
                <span>Allowed Station Transitions: {selectedStationContext.allowedStationTransitions.join(", ") || "none"}</span>
                <span>Nearest Road: {selectedStationContext.nearestRoad}</span>
                <span>Address: {selectedStationContext.nearestAddress}</span>
                <span>Parcel: {selectedStationContext.nearestParcel}</span>
              </div>
              {selectedStationContext.stationState !== selectedStationContext.stationDerivedState ? (
                <div className="dal-status">Station explicit state differs from object-derived execution state. Closure authority remains object-first for this workflow.</div>
              ) : null}
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Closure notes" />
            </>
          ) : (
            <div className="dal-status">Select a work item and ScopeVersion to load station context.</div>
          )}
        </div>

        <div className="dal-panel">
          <div className="dal-panel-title-row">
            <h3>Work At This Station</h3>
            <button type="button" onClick={() => setWorkspace("twin")}>Twin Overlay</button>
          </div>
          {selectedStationContext?.objectsAtStation.length ? (
            <div className="dal-object-card-grid">
              {selectedStationContext.objectsAtStation.map((object) => (
                <article key={object.objectId} className={`dal-object-card ${object.objectId === selectedObjectContext?.objectId ? "selected" : ""}`}>
                  <div className="dal-panel-title-row">
                    <div>
                      <strong>{object.humanName}</strong>
                      <div className="dal-status">{object.objectType} / {object.objectCategory}</div>
                    </div>
                    <b className={`dal-object-state state-${object.objectState.toLowerCase().replaceAll("_", "-")}`}>{object.objectState}</b>
                  </div>
                  <p>{object.requiredWork}</p>
                  <div className="dal-metrics">
                    <span>Measure: {Math.round(object.measureFeet).toLocaleString()} ft</span>
                    <span>Dependencies: {object.dependencies.join(", ") || "none"}</span>
                    <span>Last Closure: {latestClosureTimestamp(object)}</span>
                    <span>Closable: {object.isClosable ? "YES" : "NO"}</span>
                  </div>
                  <div className="dal-actions">
                    {objectActions.map((action) => (
                      <button
                        key={action.state}
                        type="button"
                        disabled={!fieldGate.allowed || !object.allowedTransitions.includes(action.state) || objectClosedState(object.objectState)}
                        onClick={() => {
                          setSelectedObjectId(object.objectId);
                          void submitObjectTransition(object, action.state);
                        }}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                  <details>
                    <summary>Advanced Diagnostics</summary>
                    <pre className="dal-pre">
                      {JSON.stringify(
                        {
                          objectId: object.objectId,
                          stationId: object.stationId,
                          allowedTransitions: object.allowedTransitions,
                          closureHistory: object.closureHistory,
                          sourceObject: object.sourceObject,
                        },
                        null,
                        2
                      )}
                    </pre>
                  </details>
                </article>
              ))}
            </div>
          ) : (
            <div className="dal-status">No objects are attached to this ScopeVersion station.</div>
          )}
        </div>
      </div>

      <details className="dal-panel">
        <summary>Advanced station closure</summary>
        <div className="dal-grid">
          <div className="dal-panel">
            <h3>Station Action</h3>
            <div className="dal-actions">
              {stationActions.map((action) => (
                <button
                  key={action.state}
                  type="button"
                  disabled={!fieldGate.allowed || !selectedStationContext || !selectedStationContext.allowedStationTransitions.includes(action.state)}
                  onClick={() => void submitStationTransition(action.state)}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
          <div className="dal-panel">
            <h3>Station Range Closure</h3>
            <select value={rangeStartId} onChange={(event) => setRangeStartId(event.target.value)}>
              {fieldModel?.stations.map((station) => (
                <option key={station.stationId} value={station.stationId}>
                  {station.stationLabel} / {station.stationId}
                </option>
              ))}
            </select>
            <select value={rangeEndId} onChange={(event) => setRangeEndId(event.target.value)}>
              {fieldModel?.stations.map((station) => (
                <option key={station.stationId} value={station.stationId}>
                  {station.stationLabel} / {station.stationId}
                </option>
              ))}
            </select>
            <select value={rangeTargetState} onChange={(event) => setRangeTargetState(event.target.value as RouteStationState)}>
              {stationActions.map((action) => (
                <option key={action.state} value={action.state}>
                  {action.state}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => void submitRangeTransition()} disabled={!fieldGate.allowed || !canClose(activeScope)}>
              Apply Range Closure
            </button>
          </div>
        </div>
      </details>

      <div className="dal-grid">
        <div className="dal-panel">
          <h3>Graph Context</h3>
          <div className="dal-metrics">
            <span>Inventory: {activeScope?.inventoryId ?? selectedGraph?.inventoryId ?? "none"}</span>
            <span>Scope: {activeScope?.scopeVersionId ?? "none"}</span>
            <span>Route Authority: {activeScope?.certifiedRouteReference?.routeAuthorityState ?? "NO_CERTIFIED_ROUTE"}</span>
            <span>Field production stations: {fieldModel?.stations.length.toLocaleString() ?? "0"}</span>
            <span>Objects: {fieldModel?.objects.length.toLocaleString() ?? "0"}</span>
            <span>Completed feet: {Math.round(progress?.completedFeet ?? 0).toLocaleString()}</span>
            <span>Percent complete: {Math.round(progress?.percentComplete ?? 0)}%</span>
            <span>Station derived planned: {(stationCounts.PLANNED ?? 0).toLocaleString()}</span>
            <span>Station derived released: {(stationCounts.RELEASED ?? 0).toLocaleString()}</span>
            <span>Station derived in progress: {(stationCounts.IN_PROGRESS ?? 0).toLocaleString()}</span>
            <span>Station derived complete: {(stationCounts.COMPLETE ?? 0).toLocaleString()}</span>
            <span>Station derived verified: {(stationCounts.VERIFIED ?? 0).toLocaleString()}</span>
          </div>
        </div>

        <div className="dal-panel">
          <h3>Closure Records</h3>
          {activeScope?.closures?.length || activeScope?.canonicalTruth?.closures?.length ? (
            <div className="dal-list">
              {[...(activeScope?.canonicalTruth?.closures ?? []), ...(activeScope?.closures ?? [])]
                .filter((closure, index, list) => list.findIndex((item) => item.closureId === closure.closureId) === index)
                .slice()
                .reverse()
                .map((closure) => (
                  <div key={closure.closureId} className="dal-list-row">
                    <span>{closure.closureType}: {closure.stationId ?? `${closure.stationStartId ?? "?"} -> ${closure.stationEndId ?? "?"}`}</span>
                    <b>{closure.newStationState ?? closure.newObjectState ?? "STATE"}</b>
                    <small>{closure.actorName} / {closure.createdAt}</small>
                  </div>
                ))}
            </div>
          ) : (
            <div className="dal-status">No ClosureAuthority records yet.</div>
          )}
        </div>
      </div>

      <details className="dal-panel">
        <summary>Advanced Diagnostics</summary>
        <pre className="dal-pre">
          {JSON.stringify(
            {
              selectedStationId: selectedStationContext?.stationId,
              selectedObjectId: selectedObjectContext?.objectId,
              objectsAtStation: selectedStationContext?.objectsAtStation.map((object) => ({
                objectId: object.objectId,
                objectType: object.objectType,
                objectState: object.objectState,
              })),
              objectStateCounts: fieldExecution.objectStateCounts,
              stationDerivedState: selectedStationContext?.stationDerivedState,
              stationExplicitState: selectedStationContext?.stationState,
              closureCount: progress?.closureCount ?? 0,
              persistenceStatus,
              stationStateCounts: progress?.stationStateCounts ?? {},
              completedFeet: progress?.completedFeet ?? 0,
              percentComplete: progress?.percentComplete ?? 0,
              lifecycleState: activeScope ? activeLifecycleState : "NONE",
              lastClosureId: progress?.lastClosureId,
              closureAuthorityStatus: progress?.closureAuthorityStatus ?? "FAIL",
            },
            null,
            2
          )}
        </pre>
      </details>
    </section>
  );
}
