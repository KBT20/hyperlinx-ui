import { useEffect, useMemo, useState } from "react";
import {
  addEngineeringCertificationConstraint,
  certifyDraftIofPackage,
  certifyIofUnit,
  createEngineeringCertificationRouteRedline,
  listEngineeringReviewQueue,
  moveEngineeringCertificationObject,
  openDraftIofPackageForCertification,
  recordEngineeringDoctrineException,
  returnDraftIofPackageToCommercial,
  type DraftIofPackageRuntime,
  type EngineeringReviewQueueItem,
} from "../api/teralinxRuntime";
import { useDALState } from "../dal/DALState";
import {
  ENGINEERING_CERTIFICATION_WORKFLOW,
  ENGINEERING_CONSTRAINT_CATEGORIES,
  buildEngineeringCertificationChecklist,
  buildEngineeringCertificationProjection,
  canMoveEngineeringObjectToStation,
  engineeringCertificationReady,
  type EngineeringConstraintCategory,
  type EngineeringConstraintSeverity,
} from "../engineering/EngineeringCertificationProjection";
import { useTeralinxAuth } from "../identity/TeralinxAuth";
import { MapKernel } from "../mapkernel";

type StationLabelMode = "hidden" | "major" | "engineering";

function percent(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? `${Math.round(numeric)}%` : "n/a";
}

function feet(value: number | undefined) {
  return `${Math.round(Number(value || 0)).toLocaleString()} ft`;
}

function coordinateLabel(coordinate: unknown) {
  if (!Array.isArray(coordinate) || coordinate.length < 2) return "n/a";
  const lon = Number(coordinate[0]);
  const lat = Number(coordinate[1]);
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return "n/a";
  return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
}

function statusClass(status: string) {
  if (status === "PASS" || status === "complete" || status === "RESOLVED" || status === "ACCEPTED") return "pass";
  if (status === "FAIL" || status === "CRITICAL") return "fail";
  if (status === "active") return "green";
  return "warning";
}

function stationDensity(mode: StationLabelMode) {
  if (mode === "engineering") return 500;
  if (mode === "major") return 5280;
  return 5280;
}

function selectedStationLabel(draft: DraftIofPackageRuntime | null) {
  const first = draft?.stations?.[0] as Record<string, unknown> | undefined;
  return String(first?.stationId ?? first?.label ?? "");
}

export default function EngineeringCertificationWorkspace() {
  const {
    selectedEngineeringDraftIofPackage,
    selectedEngineeringDraftIofPackageId,
    setSelectedEngineeringDraftIofPackage,
    setSelectedEngineeringDraftIofPackageId,
    setWorkspace,
  } = useDALState();
  const { session, can } = useTeralinxAuth();
  const canRead = Boolean(session && (can("workspace.engineering.read") || can("workspace.engineering.write") || can("scopeversion.authority")));
  const canWrite = Boolean(session && (can("workspace.engineering.write") || can("scopeversion.authority")));
  const currentUserName = session?.user.name ?? "Engineering";

  const [queue, setQueue] = useState<EngineeringReviewQueueItem[]>([]);
  const [activeDraft, setActiveDraft] = useState<DraftIofPackageRuntime | null>(selectedEngineeringDraftIofPackage);
  const [selectedObjectId, setSelectedObjectId] = useState("");
  const [stationLabelMode, setStationLabelMode] = useState<StationLabelMode>("major");
  const [notice, setNotice] = useState("Engineering Certification consumes a Commercial Draft IOF Package.");
  const [pending, setPending] = useState(false);

  const [constraintCategory, setConstraintCategory] = useState<EngineeringConstraintCategory>("ROW");
  const [constraintSeverity, setConstraintSeverity] = useState<EngineeringConstraintSeverity>("MEDIUM");
  const [constraintNotes, setConstraintNotes] = useState("");
  const [constraintDisposition, setConstraintDisposition] = useState("PENDING_ENGINEERING_DISPOSITION");

  const [moveStation, setMoveStation] = useState("");
  const [moveReason, setMoveReason] = useState("Power availability");
  const [moveAuthority, setMoveAuthority] = useState(currentUserName);

  const [redlineReason, setRedlineReason] = useState("Constructability redline");
  const [redlineDescription, setRedlineDescription] = useState("");

  const [exceptionRule, setExceptionRule] = useState("PD-001 spacing rule");
  const [exceptionCondition, setExceptionCondition] = useState("");
  const [exceptionReason, setExceptionReason] = useState("");
  const [exceptionImpact, setExceptionImpact] = useState("");

  const [certificationNotes, setCertificationNotes] = useState("Engineering Certification complete.");
  const [commercialRevisionReason, setCommercialRevisionReason] = useState("Engineering requests Commercial revision.");

  const projection = useMemo(
    () => activeDraft ? buildEngineeringCertificationProjection(activeDraft) : null,
    [activeDraft],
  );
  const selectedObject = useMemo(() => {
    if (!projection) return null;
    return projection.objects.find((object) => object.objectId === selectedObjectId) ?? projection.objects[0] ?? null;
  }, [projection, selectedObjectId]);
  const selectedStation = useMemo(() => projection?.stations.find((station) => station.stationId === moveStation || station.label === moveStation), [moveStation, projection]);

  useEffect(() => {
    setActiveDraft(selectedEngineeringDraftIofPackage);
  }, [selectedEngineeringDraftIofPackage]);

  useEffect(() => {
    if (!projection?.objects.length) return;
    if (!selectedObjectId || !projection.objects.some((object) => object.objectId === selectedObjectId)) {
      setSelectedObjectId(projection.objects[0].objectId);
    }
  }, [projection, selectedObjectId]);

  useEffect(() => {
    if (moveStation || !activeDraft) return;
    setMoveStation(selectedStationLabel(activeDraft));
  }, [activeDraft, moveStation]);

  useEffect(() => {
    if (!canRead) return;
    let cancelled = false;
    listEngineeringReviewQueue(session)
      .then(async (items) => {
        if (cancelled) return;
        setQueue(items);
        const preferredPackageId = selectedEngineeringDraftIofPackageId || selectedEngineeringDraftIofPackage?.packageId;
        if (!activeDraft && preferredPackageId) {
          const draft = await openDraftIofPackageForCertification(preferredPackageId, session);
          if (cancelled) return;
          setActiveDraft(draft);
          setSelectedEngineeringDraftIofPackage(draft);
          setNotice(`${draft.packageId} projected into Engineering Certification.`);
        } else {
          setNotice(items.length ? "Packages awaiting review loaded." : "No submitted Draft IOF Packages are waiting.");
        }
      })
      .catch((error) => {
        if (!cancelled) setNotice(`Engineering Certification queue unavailable: ${error instanceof Error ? error.message : String(error)}`);
      });
    return () => {
      cancelled = true;
    };
  }, [activeDraft, canRead, selectedEngineeringDraftIofPackage?.packageId, selectedEngineeringDraftIofPackageId, session, setSelectedEngineeringDraftIofPackage]);

  async function refreshQueue(message?: string) {
    if (!canRead) return;
    const items = await listEngineeringReviewQueue(session);
    setQueue(items);
    if (message) setNotice(message);
  }

  async function openPackage(packageId: string) {
    setPending(true);
    try {
      const draft = await openDraftIofPackageForCertification(packageId, session);
      setActiveDraft(draft);
      setSelectedEngineeringDraftIofPackage(draft);
      setSelectedEngineeringDraftIofPackageId(draft.packageId);
      setNotice(`${draft.packageId} projected without regenerating geometry.`);
    } catch (error) {
      setNotice(`Open package failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setPending(false);
    }
  }

  function syncDraft(draft: DraftIofPackageRuntime, message: string) {
    setActiveDraft(draft);
    setSelectedEngineeringDraftIofPackage(draft);
    setNotice(message);
  }

  async function addConstraint() {
    if (!activeDraft || !selectedObject) return;
    setPending(true);
    try {
      const draft = await addEngineeringCertificationConstraint(activeDraft.packageId, {
        category: constraintCategory,
        station: selectedObject.station,
        objectReference: selectedObject.objectId,
        severity: constraintSeverity,
        status: "OPEN",
        engineeringDisposition: constraintDisposition,
        notesEvidence: constraintNotes,
      }, session);
      setConstraintNotes("");
      syncDraft(draft, "Constraint added to the Engineering Certification queue.");
      await refreshQueue();
    } catch (error) {
      setNotice(`Add Constraint failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setPending(false);
    }
  }

  async function moveObject() {
    if (!activeDraft || !selectedObject || !canMoveEngineeringObjectToStation(selectedObject) || !moveStation) return;
    setPending(true);
    try {
      const draft = await moveEngineeringCertificationObject(activeDraft.packageId, {
        objectId: selectedObject.objectId,
        newStation: moveStation,
        reason: moveReason,
        authority: moveAuthority || currentUserName,
        impactSummary: `Object reference moved to ${selectedStation?.label ?? moveStation}. Station geometry unchanged.`,
      }, session);
      syncDraft(draft, `${selectedObject.objectId} station reference moved. Stations remained fixed.`);
      await refreshQueue();
    } catch (error) {
      setNotice(`Move Object failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setPending(false);
    }
  }

  async function createRedline() {
    if (!activeDraft) return;
    setPending(true);
    try {
      const draft = await createEngineeringCertificationRouteRedline(activeDraft.packageId, {
        reason: redlineReason,
        description: redlineDescription,
        authority: currentUserName,
        affectedStations: selectedObject?.station,
        impactSummary: "Governed route redline created for Commercial Draft IOF revision.",
      }, session);
      setRedlineDescription("");
      syncDraft(draft, "Route redline created new engineering revision metadata.");
      await refreshQueue();
    } catch (error) {
      setNotice(`Create Route Redline failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setPending(false);
    }
  }

  async function recordException() {
    if (!activeDraft) return;
    setPending(true);
    try {
      const draft = await recordEngineeringDoctrineException(activeDraft.packageId, {
        doctrineRule: exceptionRule,
        actualCondition: exceptionCondition,
        reason: exceptionReason,
        approvalAuthority: currentUserName,
        impactSummary: exceptionImpact,
      }, session);
      setExceptionCondition("");
      setExceptionReason("");
      setExceptionImpact("");
      syncDraft(draft, "Doctrine exception recorded for Engineering Certification.");
      await refreshQueue();
    } catch (error) {
      setNotice(`Record Doctrine Exception failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setPending(false);
    }
  }

  async function certifyPackage() {
    if (!activeDraft || !projection) return;
    if (!engineeringCertificationReady(projection)) {
      setNotice("Certification blocked until compliance failures are excepted and constraints are resolved or accepted.");
      return;
    }
    setPending(true);
    try {
      let draft = activeDraft;
      for (const unit of draft.proposedIofUnits.filter((item) => item.status !== "CERTIFIED")) {
        const result = await certifyIofUnit(draft.packageId, unit.unitId, {
          engineeringNote: "Certified by Engineering Certification package gate.",
          engineeringConfidence: 94,
          engineeringRisk: "ACCEPTED",
          engineeringComments: ["Certified as part of CERTIFY PACKAGE action."],
        }, session);
        draft = result.iofPackage;
      }
      const refreshedProjection = buildEngineeringCertificationProjection(draft);
      const result = await certifyDraftIofPackage(draft.packageId, {
        checklist: buildEngineeringCertificationChecklist(refreshedProjection, certificationNotes, 94),
      }, session);
      syncDraft(result.draftPackage, `${result.certifiedIofPackage.certifiedPackageId} certified. Certified IOF Package created; ScopeVersion not created.`);
      await refreshQueue();
    } catch (error) {
      setNotice(`CERTIFY PACKAGE failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setPending(false);
    }
  }

  async function requestCommercialRevision() {
    if (!activeDraft) return;
    setPending(true);
    try {
      const draft = await returnDraftIofPackageToCommercial(activeDraft.packageId, { reason: commercialRevisionReason }, session);
      syncDraft(draft, "Draft IOF Package returned to Commercial for revision.");
      await refreshQueue();
    } catch (error) {
      setNotice(`Commercial revision request failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setPending(false);
    }
  }

  if (!canRead) {
    return (
      <section className="dal-panel engineering-certification-shell">
        <h3>Engineering Certification</h3>
        <div className="dal-status">Engineering Certification requires Engineering read authority.</div>
      </section>
    );
  }

  if (!projection || !activeDraft) {
    return (
      <section className="dal-panel engineering-certification-shell">
        <div className="dal-panel-title-row">
          <div>
            <h3>Engineering Certification</h3>
            <div className="dal-status">Packages Awaiting Review</div>
          </div>
          <button type="button" onClick={() => setWorkspace("googleRfp")}>Return to Commercial</button>
        </div>
        <div className="dal-list">
          {queue.map((item) => (
            <button className="dal-list-row" type="button" key={item.packageId} onClick={() => void openPackage(item.packageId)} disabled={pending}>
              <b>{item.customer || item.packageName || item.packageId}</b>
              <span>{item.packageId} / Revision {item.packageRevision ?? 0}</span>
              <small>{item.packageStatus.replaceAll("_", " ")}. Assigned {item.assignedEngineer || "Unassigned"}. OPEN</small>
            </button>
          ))}
          {!queue.length ? <div className="dal-status">No packages are currently submitted to Engineering Intake.</div> : null}
        </div>
        <div className="dal-status">{notice}</div>
      </section>
    );
  }
  const renderDraft = activeDraft;

  return (
    <section className="engineering-certification-shell">
      <div className="engineering-certification-workflow" aria-label="Engineering certification workflow">
        {ENGINEERING_CERTIFICATION_WORKFLOW.map((step) => (
          <div className={step.status} key={step.key}>
            <span>{step.label}</span>
            <b>{step.status}</b>
          </div>
        ))}
      </div>

      <div className="dal-panel engineering-certification-package-header">
        <div className="dal-panel-title-row">
          <div>
            <h3>Engineering Certification</h3>
            <span>{renderDraft.packageName ?? renderDraft.packageId}</span>
          </div>
          <span className="dal-badge warning">{String(renderDraft.status ?? "UNDER_ENGINEERING_REVIEW").replaceAll("_", " ")}</span>
        </div>
        <div className="teralinx-summary-grid">
          <div><span>Package</span><b>{renderDraft.packageId}</b></div>
          <div><span>Customer</span><b>{projection.customer}</b></div>
          <div><span>Revision</span><b>{renderDraft.packageRevision ?? 0}</b></div>
          <div><span>Authority</span><b>Engineering</b></div>
          <div><span>Engineering Status</span><b>{String(renderDraft.engineeringStatus ?? "Under Review").replaceAll("_", " ")}</b></div>
          <div><span>Doctrine</span><b>{String(renderDraft.doctrineId ?? "PD-001")}</b></div>
        </div>
      </div>

      <div className="engineering-certification-grid">
        <aside className="dal-panel engineering-certification-summary">
          <div className="dal-panel-title-row">
            <h3>Draft IOF Package Summary</h3>
            <span className={`dal-badge ${statusClass(projection.commercialStatus)}`}>{projection.commercialStatus}</span>
          </div>
          <div className="engineering-certification-kv">
            <span>customer</span><b>{projection.customer}</b>
            <span>account</span><b>{projection.account}</b>
            <span>opportunity/package id</span><b>{projection.opportunityPackageId}</b>
            <span>product id/name</span><b>{projection.productIdName}</b>
            <span>doctrine id/version</span><b>{projection.doctrineIdVersion}</b>
            <span>draft package revision</span><b>{projection.draftPackageRevision}</b>
            <span>route length</span><b>{feet(projection.routeLength)}</b>
            <span>station count</span><b>{projection.stationCount.toLocaleString()}</b>
            <span>object count</span><b>{projection.objectCount.toLocaleString()}</b>
            <span>ILA / regen / facility count</span><b>{projection.facilityCount.toLocaleString()}</b>
            <span>commercial status</span><b>{projection.commercialStatus}</b>
            <span>engineering status</span><b>{projection.engineeringStatus}</b>
            <span>validation/readiness status</span><b>{projection.validationReadinessStatus}</b>
          </div>
          <label>
            Draft package queue
            <select value={renderDraft.packageId} onChange={(event) => void openPackage(event.currentTarget.value)} disabled={pending}>
              {[renderDraft, ...queue.filter((item) => item.packageId !== renderDraft.packageId)].map((item) => (
                <option key={item.packageId} value={item.packageId}>{item.packageName ?? item.packageId}</option>
              ))}
            </select>
          </label>
          <div className="dal-status">{notice}</div>
        </aside>

        <main className="dal-panel engineering-certification-canvas">
          <div className="dal-panel-title-row">
            <div>
              <h3>Engineering Canvas</h3>
              <div className="dal-status">Rendered from Draft IOF Package artifacts. No intake route regeneration or ScopeVersion creation is invoked here.</div>
            </div>
            <div className="engineering-certification-segments">
              <button type="button" className={stationLabelMode === "hidden" ? "active-toggle" : undefined} onClick={() => setStationLabelMode("hidden")}>Labels Off</button>
              <button type="button" className={stationLabelMode === "major" ? "active-toggle" : undefined} onClick={() => setStationLabelMode("major")}>Major Stations</button>
              <button type="button" className={stationLabelMode === "engineering" ? "active-toggle" : undefined} onClick={() => setStationLabelMode("engineering")}>Engineering Labels</button>
            </div>
          </div>
          <MapKernel
            specs={[projection.mapSpec]}
            initialMode="geographic"
            initialBaseLayer="hybrid"
            stationDensityFeet={stationDensity(stationLabelMode)}
            showStationLabels={stationLabelMode !== "hidden"}
            height={620}
            onSelectionChange={(selection) => {
              const id = selection?.featureRef.objectId ?? selection?.featureRef.id ?? "";
              if (projection.objects.some((object) => object.objectId === id)) setSelectedObjectId(id);
            }}
          />
        </main>

        <aside className="dal-panel engineering-certification-compliance">
          <div className="dal-panel-title-row">
            <h3>PD-001 Compliance</h3>
            <span className={`dal-badge ${engineeringCertificationReady(projection) ? "pass" : "warning"}`}>{percent(renderDraft.packageCompleteness)}</span>
          </div>
          <div className="engineering-certification-compliance-list">
            {projection.compliance.map((row) => (
              <div key={row.key}>
                <span>{row.label}</span>
                <b className={`dal-badge ${statusClass(row.status)}`}>{row.status}</b>
                <small>{row.detail}</small>
              </div>
            ))}
          </div>
        </aside>
      </div>

      <div className="engineering-certification-bottom">
        <section className="dal-panel">
          <div className="dal-panel-title-row">
            <h3>Constraint Queue</h3>
            <span className="dal-badge warning">{projection.constraints.length.toLocaleString()}</span>
          </div>
          <div className="engineering-certification-form-grid">
            <label>
              Category
              <select value={constraintCategory} onChange={(event) => setConstraintCategory(event.currentTarget.value as EngineeringConstraintCategory)}>
                {ENGINEERING_CONSTRAINT_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </label>
            <label>
              Severity
              <select value={constraintSeverity} onChange={(event) => setConstraintSeverity(event.currentTarget.value as EngineeringConstraintSeverity)}>
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="CRITICAL">CRITICAL</option>
              </select>
            </label>
            <label>
              Disposition
              <input value={constraintDisposition} onChange={(event) => setConstraintDisposition(event.currentTarget.value)} />
            </label>
          </div>
          <textarea value={constraintNotes} onChange={(event) => setConstraintNotes(event.currentTarget.value)} placeholder="Notes / evidence" />
          <div className="engineering-certification-list">
            {projection.constraints.map((constraint) => (
              <div key={constraint.constraintId}>
                <b>{constraint.constraintId}</b>
                <span className={`dal-badge ${statusClass(constraint.status)}`}>{constraint.status}</span>
                <small>{constraint.category} / {constraint.severity} / {constraint.station || constraint.stationRange || "station pending"} / {constraint.objectReference || "no object"}</small>
                <small>{constraint.engineeringDisposition}. {constraint.notesEvidence}</small>
              </div>
            ))}
            {!projection.constraints.length ? <div className="dal-status">No constraints recorded on this Draft IOF Package.</div> : null}
          </div>
        </section>

        <section className="dal-panel">
          <div className="dal-panel-title-row">
            <h3>Selected Object Inspector</h3>
            <span className={`dal-badge ${selectedObject?.movable ? "pass" : "warning"}`}>{selectedObject?.objectType ?? "NO_OBJECT"}</span>
          </div>
          {selectedObject ? (
            <>
              <select value={selectedObject.objectId} onChange={(event) => setSelectedObjectId(event.currentTarget.value)} aria-label="Selected object">
                {projection.objects.map((object) => <option key={object.objectId} value={object.objectId}>{object.objectType} / {object.objectId}</option>)}
              </select>
              <div className="engineering-certification-kv">
                <span>object id</span><b>{selectedObject.objectId}</b>
                <span>object type</span><b>{selectedObject.objectType}</b>
                <span>station</span><b>{selectedObject.station || "n/a"}</b>
                <span>station range</span><b>{selectedObject.stationRange || "n/a"}</b>
                <span>coordinates</span><b>{coordinateLabel(selectedObject.coordinate)}</b>
                <span>parent spine/graph reference</span><b>{selectedObject.parentReference || "n/a"}</b>
                <span>package source</span><b>{selectedObject.packageSource}</b>
                <span>construction method</span><b>{selectedObject.constructionMethod}</b>
                <span>dependencies</span><b>{selectedObject.dependencies.join(", ") || "n/a"}</b>
                <span>quantity impact</span><b>{selectedObject.quantityImpact}</b>
                <span>commercial assumption</span><b>{selectedObject.commercialAssumption}</b>
                <span>engineering notes</span><b>{selectedObject.engineeringNotes || "n/a"}</b>
                <span>constraint links</span><b>{selectedObject.constraintLinks.join(", ") || "n/a"}</b>
                <span>current review status</span><b>{selectedObject.currentReviewStatus}</b>
              </div>
            </>
          ) : <div className="dal-status">No package object selected.</div>}
        </section>

        <section className="dal-panel engineering-certification-actions">
          <div className="dal-panel-title-row">
            <h3>Engineering Actions</h3>
            <span className={`dal-badge ${canWrite ? "pass" : "warning"}`}>{canWrite ? "WRITE" : "READ ONLY"}</span>
          </div>
          <div className="dal-actions">
            <button type="button" onClick={addConstraint} disabled={!canWrite || pending || !selectedObject}>Add Constraint</button>
          </div>
          <div className="engineering-certification-form-grid">
            <label>
              New station
              <select value={moveStation} onChange={(event) => setMoveStation(event.currentTarget.value)}>
                {projection.stations.map((station) => <option key={station.stationId} value={station.stationId}>{station.label}</option>)}
              </select>
            </label>
            <label>
              Reason
              <input value={moveReason} onChange={(event) => setMoveReason(event.currentTarget.value)} />
            </label>
            <label>
              Authority
              <input value={moveAuthority} onChange={(event) => setMoveAuthority(event.currentTarget.value)} />
            </label>
          </div>
          <div className="dal-actions">
            <button type="button" onClick={moveObject} disabled={!canWrite || pending || !selectedObject?.movable}>Move Object</button>
          </div>
          <label>
            Redline reason
            <input value={redlineReason} onChange={(event) => setRedlineReason(event.currentTarget.value)} />
          </label>
          <textarea value={redlineDescription} onChange={(event) => setRedlineDescription(event.currentTarget.value)} placeholder="Route redline description" />
          <div className="dal-actions">
            <button type="button" onClick={createRedline} disabled={!canWrite || pending}>Create Route Redline</button>
          </div>
          <div className="engineering-certification-form-grid">
            <label>
              Doctrine rule
              <input value={exceptionRule} onChange={(event) => setExceptionRule(event.currentTarget.value)} />
            </label>
            <label>
              Actual condition
              <input value={exceptionCondition} onChange={(event) => setExceptionCondition(event.currentTarget.value)} />
            </label>
          </div>
          <textarea value={exceptionReason} onChange={(event) => setExceptionReason(event.currentTarget.value)} placeholder="Exception reason" />
          <textarea value={exceptionImpact} onChange={(event) => setExceptionImpact(event.currentTarget.value)} placeholder="Impact summary" />
          <div className="dal-actions">
            <button type="button" onClick={recordException} disabled={!canWrite || pending}>Record Doctrine Exception</button>
          </div>
          <textarea value={certificationNotes} onChange={(event) => setCertificationNotes(event.currentTarget.value)} placeholder="Certification notes" />
          <div className="dal-actions">
            <button type="button" className="engineering-certification-primary" onClick={certifyPackage} disabled={!canWrite || pending}>CERTIFY PACKAGE</button>
          </div>
          <textarea value={commercialRevisionReason} onChange={(event) => setCommercialRevisionReason(event.currentTarget.value)} placeholder="Commercial revision reason" />
          <div className="dal-actions">
            <button type="button" className="secondary" onClick={requestCommercialRevision} disabled={!canWrite || pending}>Reject / Request Commercial Revision</button>
          </div>
        </section>
      </div>
    </section>
  );
}
