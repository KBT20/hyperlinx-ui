import { useMemo, useState } from "react";
import type { DraftIofPackageRuntime } from "../../api/teralinxRuntime";
import {
  addCommercialObjectAtStation,
  moveCommercialObjectByStation,
  removeCommercialProposedObject,
  type CommercialImpactSummary,
} from "../../commercial/CommercialObjectPlacementEngine";
import {
  buildCommercialStationReview,
  lookupCommercialStation,
  type CommercialMovableObjectReview,
} from "../../commercial/CommercialStationReviewEngine";
import MapKernel from "../../mapkernel/MapKernel";

type StationAwareObjectReviewPanelProps = {
  draftPackage: DraftIofPackageRuntime | null;
  canEdit: boolean;
  pending?: boolean;
  actor: string;
  onDraftChange: (draftPackage: DraftIofPackageRuntime, message: string) => void;
};

function feet(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? `${Math.round(numeric).toLocaleString()} ft` : "n/a";
}

function coordinateText(value: unknown) {
  const coordinate = Array.isArray(value) ? value : [];
  const lng = Number(coordinate[0]);
  const lat = Number(coordinate[1]);
  return Number.isFinite(lng) && Number.isFinite(lat) ? `${lat.toFixed(6)}, ${lng.toFixed(6)}` : "n/a";
}

function badgeClass(status: unknown) {
  const text = String(status ?? "").toUpperCase();
  if (text === "PASS" || text === "ATTACHED") return "pass";
  if (text === "FAIL" || text === "UNRESOLVED") return "fail";
  return "warning";
}

function objectOptionLabel(object: CommercialMovableObjectReview) {
  const station = object.currentStationLabel || object.currentStationId || "station pending";
  return `${object.objectType} / ${object.objectId} / ${station}`;
}

export default function StationAwareObjectReviewPanel({
  draftPackage,
  canEdit,
  pending = false,
  actor,
  onDraftChange,
}: StationAwareObjectReviewPanelProps) {
  const review = useMemo(() => buildCommercialStationReview(draftPackage), [draftPackage]);
  const firstObjectId = review.movableObjects[0]?.objectId ?? "";
  const [selectedObjectId, setSelectedObjectId] = useState(firstObjectId);
  const selectedObject = review.movableObjects.find((object) => object.objectId === selectedObjectId) ?? review.movableObjects[0] ?? null;
  const [targetStation, setTargetStation] = useState("40+00");
  const [addObjectType, setAddObjectType] = useState("HANDHOLE");
  const [reason, setReason] = useState("Customer requested station-aware commercial review move.");
  const [customerRequested, setCustomerRequested] = useState(true);
  const [notice, setNotice] = useState("");
  const stationLookup = useMemo(() => draftPackage ? lookupCommercialStation(draftPackage, targetStation) : null, [draftPackage, targetStation]);
  const locked = Boolean((draftPackage as any)?.commercialRevisionLocked) ||
    ["SUBMITTED_TO_ENGINEERING", "UNDER_ENGINEERING_REVIEW", "CERTIFIED"].includes(String(draftPackage?.status ?? ""));
  const actionDisabled = !canEdit || pending || locked || !draftPackage || !review.stationLookupReady;

  function applyMove() {
    if (!draftPackage || !selectedObject) return;
    try {
      const result = moveCommercialObjectByStation({
        draftPackage,
        objectId: selectedObject.objectId,
        targetStation,
        reason,
        actor,
        customerRequested,
      });
      setNotice(impactText(result.commercialImpactSummary));
      onDraftChange(result.draftPackage, `${selectedObject.objectType} moved to ${result.revision.newStationLabel}. Engineering review required.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    }
  }

  function applyAdd() {
    if (!draftPackage) return;
    try {
      const result = addCommercialObjectAtStation({
        draftPackage,
        objectType: addObjectType,
        targetStation,
        reason,
        actor,
        customerRequested,
      });
      setSelectedObjectId(result.revision.objectId);
      setNotice(impactText(result.commercialImpactSummary));
      onDraftChange(result.draftPackage, `${addObjectType.toUpperCase()} added at ${result.revision.newStationLabel}. Engineering review required.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    }
  }

  function applyRemove() {
    if (!draftPackage || !selectedObject) return;
    try {
      const result = removeCommercialProposedObject({
        draftPackage,
        objectId: selectedObject.objectId,
        reason,
        actor,
        customerRequested,
      });
      setSelectedObjectId(result.draftPackage.objects?.[0] ? String((result.draftPackage.objects[0] as any).objectId ?? "") : "");
      setNotice(impactText(result.commercialImpactSummary));
      onDraftChange(result.draftPackage, `${selectedObject.objectType} removed from Commercial station review. Engineering review required.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    }
  }

  function recalculateImpact() {
    const moved = Number(((draftPackage as any)?.commercialObjectPlacementHistory ?? []).length);
    setNotice(moved ? `${moved.toLocaleString()} commercial station placement revision(s) require Engineering review.` : "No commercial station placement changes recorded.");
  }

  return (
    <section className="dal-panel station-aware-object-review-panel">
      <div className="dal-panel-title-row">
        <div>
          <h3>Station-Aware Object Review</h3>
          <span>{draftPackage?.packageId ?? "Draft IOF Package not assembled"}</span>
        </div>
        <span className={`dal-badge ${badgeClass(review.readiness.status)}`}>{review.readiness.status}</span>
      </div>

      <div className="teralinx-summary-grid">
        <div><span>Measured Spine</span><b>{review.measuredSpine?.geometryHash ?? "Missing"}</b></div>
        <div><span>Station Authority</span><b>{review.stationAuthority?.stationCount?.toLocaleString() ?? "Missing"}</b></div>
        <div><span>Movable Objects</span><b>{review.movableObjects.length.toLocaleString()}</b></div>
        <div><span>Attachments</span><b>{((draftPackage as any)?.objectStationAttachments ?? []).length.toLocaleString()}</b></div>
        <div><span>Customer Moves</span><b>{((draftPackage as any)?.customerRequestedMoves ?? []).length.toLocaleString()}</b></div>
        <div><span>Commercial Revisions</span><b>{((draftPackage as any)?.commercialObjectPlacementHistory ?? []).length.toLocaleString()}</b></div>
        <div><span>Can Certify</span><b>{review.canCertifyStationAuthority ? "YES" : "NO"}</b></div>
        <div><span>ScopeVersion</span><b>{review.canCreateScopeVersion ? "CREATED" : "OUT OF SCOPE"}</b></div>
      </div>

      <div className="commercial-station-review-grid">
        <div className="commercial-station-review-map">
          <MapKernel
            specs={[review.mapSpec]}
            stationDensityFeet={600}
            showStationLabels
            initialMode="geographic"
          />
        </div>

        <div className="commercial-station-review-controls">
          <label>
            <span>Object</span>
            <select value={selectedObject?.objectId ?? selectedObjectId} onChange={(event) => setSelectedObjectId(event.currentTarget.value)} disabled={!review.movableObjects.length}>
              {review.movableObjects.map((object) => (
                <option key={object.objectId} value={object.objectId}>{objectOptionLabel(object)}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Target Station</span>
            <input value={targetStation} onChange={(event) => setTargetStation(event.currentTarget.value)} placeholder="40+00" />
          </label>
          <label>
            <span>Add Object Type</span>
            <select value={addObjectType} onChange={(event) => setAddObjectType(event.currentTarget.value)}>
              {["ILA", "REGEN", "HUT", "HANDHOLE", "VAULT", "SPLICE_CASE", "PULL_POINT", "MARKER"].map((type) => (
                <option key={type} value={type}>{type.replaceAll("_", " ")}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Reason</span>
            <textarea value={reason} onChange={(event) => setReason(event.currentTarget.value)} rows={3} />
          </label>
          <label className="commercial-station-checkbox">
            <input type="checkbox" checked={customerRequested} onChange={(event) => setCustomerRequested(event.currentTarget.checked)} />
            <span>Customer requested</span>
          </label>

          <div className="teralinx-summary-grid compact">
            <div><span>Lookup</span><b>{stationLookup?.stationLabel ?? "No match"}</b></div>
            <div><span>Measure</span><b>{feet(stationLookup?.measureFeet)}</b></div>
            <div><span>Coordinate</span><b>{coordinateText(stationLookup?.coordinate)}</b></div>
            <div><span>Segment</span><b>{stationLookup?.segmentId?.split(":").slice(-2).join(":") ?? "n/a"}</b></div>
          </div>

          <div className="dal-actions">
            <button type="button" onClick={applyMove} disabled={actionDisabled || !selectedObject || !stationLookup}>Move Object by Station</button>
            <button type="button" className="secondary" onClick={applyAdd} disabled={actionDisabled || !stationLookup}>Add Object at Station</button>
            <button type="button" className="secondary" onClick={applyRemove} disabled={actionDisabled || !selectedObject}>Remove Proposed Object</button>
            <button type="button" className="secondary" onClick={() => setCustomerRequested(true)} disabled={actionDisabled}>Record Customer Requested Move</button>
            <button type="button" className="secondary" onClick={recalculateImpact} disabled={!draftPackage}>Recalculate Commercial Impact</button>
          </div>
        </div>
      </div>

      {notice || review.readiness.blockingIssues.length ? (
        <div className="dal-status">
          {notice || review.readiness.blockingIssues.join(" ")}
        </div>
      ) : null}

      <div className="dal-table-wrap station-aware-object-table">
        <table className="dal-table">
          <thead>
            <tr>
              <th>Object</th>
              <th>Station</th>
              <th>Measure</th>
              <th>Coordinate</th>
              <th>Attachment</th>
              <th>Prior</th>
              <th>Next</th>
              <th>Doctrine</th>
              <th>Impact</th>
            </tr>
          </thead>
          <tbody>
            {review.movableObjects.length ? review.movableObjects.map((object) => (
              <tr key={object.objectId} className={object.objectId === selectedObject?.objectId ? "selected-row" : ""} onClick={() => setSelectedObjectId(object.objectId)}>
                <td><b>{object.objectType}</b><small>{object.objectId}</small></td>
                <td><b>{object.currentStationLabel || "Unresolved"}</b><small>{object.currentStationId}</small></td>
                <td>{feet(object.currentMeasureFeet)}</td>
                <td>{coordinateText(object.currentCoordinate)}</td>
                <td><span className={`dal-badge ${badgeClass(object.attachmentStatus)}`}>{object.attachmentMethod}</span></td>
                <td>{object.spacingFromPriorFacilityFeet === null ? "n/a" : feet(object.spacingFromPriorFacilityFeet)}</td>
                <td>{object.spacingToNextFacilityFeet === null ? "n/a" : feet(object.spacingToNextFacilityFeet)}</td>
                <td><span className={`dal-badge ${badgeClass(object.doctrineSpacingStatus)}`}>{object.doctrineSpacingStatus}</span></td>
                <td>{object.commercialImpactStatus.replaceAll("_", " ")}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan={9}>No movable station-attached proposed objects are available.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function impactText(summary: CommercialImpactSummary) {
  return `${summary.objectId} moved ${feet(summary.distanceMovedFeet)} from ${summary.priorStation ?? "n/a"} to ${summary.newStation ?? "n/a"}. Requires Engineering review: ${summary.requiresEngineeringReview}.`;
}
