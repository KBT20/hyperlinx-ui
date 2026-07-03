import { useMemo, useState } from "react";
import type { DraftIofPackageRuntime } from "../../../api/teralinxRuntime";

type CommercialReviewPanelProps = {
  draftPackage: DraftIofPackageRuntime | null;
  customerName: string;
  proposalLabel: string;
  productLabel: string;
  doctrineLabel: string;
  pending?: boolean;
  canEdit?: boolean;
  notice?: string;
  draftIofApprovalDisabled?: boolean;
  draftIofApprovalReason?: string;
  onSaveDraft: () => void;
  onValidate: () => void;
  onSubmitToEngineering: () => void;
};

function text(value: unknown, fallback = "n/a") {
  const next = String(value ?? "").trim();
  return next || fallback;
}

function percent(value: unknown) {
  const next = Number(value);
  return Number.isFinite(next) ? `${Math.round(next)}%` : "n/a";
}

function readinessStatus(draftPackage: DraftIofPackageRuntime | null) {
  return text(draftPackage?.engineeringReadiness ?? draftPackage?.packageReadiness?.status, "Not ready").replaceAll("_", " ");
}

function record(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function list(value: unknown) {
  return Array.isArray(value) ? value as Record<string, unknown>[] : [];
}

export function CommercialReviewPanel({
  draftPackage,
  customerName,
  proposalLabel,
  productLabel,
  doctrineLabel,
  pending = false,
  canEdit = true,
  notice,
  draftIofApprovalDisabled = false,
  draftIofApprovalReason,
  onSaveDraft,
  onValidate,
  onSubmitToEngineering,
}: CommercialReviewPanelProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const status = String(draftPackage?.status ?? "");
  const locked = Boolean(draftPackage?.commercialRevisionLocked) || ["SUBMITTED_TO_ENGINEERING", "UNDER_ENGINEERING_REVIEW", "CERTIFIED"].includes(status);
  const validationStatus = text((draftPackage?.validationSummary as any)?.status ?? draftPackage?.validation?.status, "Missing");
  const completeness = draftPackage?.packageCompleteness ?? (draftPackage?.packageReadiness as any)?.packageCompleteness ?? (draftPackage?.packageReadiness as any)?.readinessScore;
  const confidence = draftPackage?.assemblyConfidence ?? draftPackage?.commercialConfidence ?? (draftPackage?.packageReadiness as any)?.readinessScore;
  const objectManifestSummary = record(draftPackage?.objectManifestSummary ?? draftPackage?.auditObjectManifestSummary);
  const objectManifestEntries = list(draftPackage?.auditObjectManifestEntries).slice(0, 6);
  const manifestReviewObjects = list(draftPackage?.auditManifestReviewObjects);
  const productionSummary = record(draftPackage?.productionProjectionSummary);
  const productionProfiles = list(draftPackage?.productionProfiles).slice(0, 5);
  const productionReviewObjects = list(draftPackage?.productionReviewObjects);
  const instantiationSummary = record(draftPackage?.instantiationSummary);
  const instantiationHealth = record(draftPackage?.instantiationHealth);
  const instantiatedSpineObjects = list(draftPackage?.instantiatedSpineObjects);
  const constructionSegments = list(draftPackage?.constructionSegments);
  const paymentSegments = list(draftPackage?.paymentSegments);
  const productionBindings = list(draftPackage?.productionBindings);
  const badgeClass = status === "SUBMITTED_TO_ENGINEERING" || status === "CERTIFIED"
    ? "pass"
    : draftPackage
      ? "warning"
      : "fail";
  const revision = useMemo(() => {
    const value = draftPackage?.packageRevision ?? draftPackage?.revision ?? 0;
    return Number.isFinite(Number(value)) ? `Revision ${Number(value)}` : text(value, "Revision 0");
  }, [draftPackage]);

  return (
    <section className="dal-panel commercial-review-panel">
      <div className="dal-panel-title-row">
        <div>
          <h3>Commercial Review</h3>
          <span>{draftPackage?.packageId ?? "Draft IOF Package not assembled"}</span>
        </div>
        <span className={`dal-badge ${badgeClass}`}>{status ? status.replaceAll("_", " ") : "DRAFT NOT SAVED"}</span>
      </div>

      <div className="teralinx-summary-grid">
        <div><span>Customer</span><b>{customerName}</b></div>
        <div><span>Proposal</span><b>{proposalLabel}</b></div>
        <div><span>Product</span><b>{productLabel}</b></div>
        <div><span>Doctrine</span><b>{doctrineLabel}</b></div>
        <div><span>Revision</span><b>{revision}</b></div>
        <div><span>Validation</span><b>{validationStatus}</b></div>
        <div><span>Commercial Readiness</span><b>{text(draftPackage?.packageReadiness?.status, "Not ready").replaceAll("_", " ")}</b></div>
        <div><span>Engineering Readiness</span><b>{readinessStatus(draftPackage)}</b></div>
        <div><span>Completeness</span><b>{percent(completeness)}</b></div>
        <div><span>Estimated Confidence</span><b>{percent(confidence)}</b></div>
      </div>

      {draftPackage?.auditObjectManifest ? (
        <div className="commercial-object-manifest-summary">
          <div className="dal-panel-title-row">
            <div>
              <h3>Object Manifest Summary</h3>
              <span>Commercial Audit mapped to Spine Object Catalog. Instantiation Pending.</span>
            </div>
            <span className="dal-badge warning">{text(objectManifestSummary.instantiationStatus, "NOT_INSTANTIATED_YET").replaceAll("_", " ")}</span>
          </div>
          <div className="teralinx-summary-grid">
            <div><span>Catalog Entries</span><b>{text(objectManifestSummary.manifestEntryCount, "0")}</b></div>
            <div><span>Review Objects</span><b>{manifestReviewObjects.length.toLocaleString()}</b></div>
            <div><span>Blocking Reviews</span><b>{text(objectManifestSummary.blockingReviewObjectCount, "0")}</b></div>
            <div><span>Object Creation</span><b>{objectManifestSummary.createsObjects === false ? "Deferred to 24D Instantiation" : "Blocked"}</b></div>
          </div>
          <div className="engineering-certification-list">
            {objectManifestEntries.map((entry) => {
              const catalogEntry = record(entry.catalogEntry);
              const visibility = record(entry.visibility);
              return (
                <div key={text(entry.manifestEntryId)}>
                  <b>{text(catalogEntry.displayName ?? entry.objectType, "Catalog Entry")}</b>
                  <span className="dal-badge warning">Instantiation Pending</span>
                  <small>Expected Quantity: {text(entry.expectedQuantity, "0")} {text(entry.expectedQuantityUnit, "")}</small>
                  <small>Visibility: Commercial {text(visibility.commercial, "VISIBLE")} / Engineering {text(visibility.engineering, "VISIBLE")}</small>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {draftPackage?.instantiationSummary ? (
        <div className="commercial-instantiation-summary">
          <div className="dal-panel-title-row">
            <div>
              <h3>Instantiation Summary</h3>
              <span>Constitutional Spine Objects created from the Commercial Audit, PD-002A addresses, the Spine Object Catalog, and PD-003 production profiles.</span>
            </div>
            <span className={`dal-badge ${instantiationHealth.instantiationStatus === "PASS" ? "pass" : "fail"}`}>Instantiation Health {text(instantiationHealth.instantiationStatus, "MISSING")}</span>
          </div>
          <div className="teralinx-summary-grid">
            <div><span>Expected Objects</span><b>{text(instantiationSummary.expectedObjects, "0")}</b></div>
            <div><span>Created Objects</span><b>{text(instantiationSummary.createdObjects ?? instantiatedSpineObjects.length, "0")}</b></div>
            <div><span>Review Objects</span><b>{text(instantiationSummary.reviewObjects, "0")}</b></div>
            <div><span>Production Profiles</span><b>{text(instantiationSummary.productionProfileBindings ?? productionBindings.length, "0")}</b></div>
            <div><span>Construction Segments</span><b>{text(instantiationSummary.constructionSegments ?? constructionSegments.length, "0")}</b></div>
            <div><span>Payment Segments</span><b>{text(instantiationSummary.paymentSegments ?? paymentSegments.length, "0")}</b></div>
            <div><span>Execution Zones</span><b>{text(instantiationSummary.executionZones, "0")}</b></div>
            <div><span>Instantiation Health</span><b>{text(instantiationHealth.instantiationStatus, "MISSING")}</b></div>
          </div>
          <div className="engineering-certification-list">
            {instantiatedSpineObjects.slice(0, 6).map((object) => (
              <div key={text(object.spineObjectId)}>
                <b>{text(object.objectType, "Spine Object")} / {text(object.spineObjectId)}</b>
                <span className="dal-badge pass">{text(object.currentState, "PLANNED")}</span>
                <small>Address: {text(record(object.stationAddress).stationLabel ?? record(object.fromStationAddress).stationLabel, "Station range or review pending")}</small>
                <small>Segment: {text(object.constructionSegmentId)} / Payment: {text(object.paymentSegmentId)}</small>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {draftPackage?.productionDoctrine ? (
        <div className="commercial-production-doctrine-summary">
          <div className="dal-panel-title-row">
            <div>
              <h3>Production Doctrine Summary</h3>
              <span>PD-003 governs production rates, labor rates, material rates, crew days, weekly production, and payment projection basis.</span>
            </div>
            <span className="dal-badge warning">Forecast Only</span>
          </div>
          <div className="teralinx-summary-grid">
            <div><span>Production Profiles Used</span><b>{text(productionSummary.objectProductionProfileCount, "0")}</b></div>
            <div><span>Projected Crew Days</span><b>{text(Math.round(Number(productionSummary.projectedCrewDays ?? 0) * 10) / 10, "0")}</b></div>
            <div><span>Weekly Production</span><b>{text(Math.round(Number(productionSummary.projectedWeeklyProduction ?? 0)).toLocaleString(), "0")}</b></div>
            <div><span>Payment Projection Basis</span><b>{productionSummary.paymentAuthorized === false ? "Validation Required" : "Blocked"}</b></div>
            <div><span>Labor Forecast</span><b>${text(Math.round(Number(productionSummary.projectedLaborCost ?? 0)).toLocaleString(), "0")}</b></div>
            <div><span>Material Forecast</span><b>${text(Math.round(Number(productionSummary.projectedMaterialCost ?? 0)).toLocaleString(), "0")}</b></div>
            <div><span>Unknown Reviews</span><b>{productionReviewObjects.length.toLocaleString()}</b></div>
          </div>
          <div className="engineering-certification-list">
            {productionProfiles.map((profile) => (
              <div key={text(profile.profileId)}>
                <b>{text(profile.displayName ?? profile.profileId, "Production Profile")}</b>
                <small>Production Rate: {text(profile.productionRate)} {text(profile.productionRateUnit, "")}</small>
                <small>Labor Rate: {text(profile.laborRate)} {text(profile.laborRateUnit, "")} / Material Rate: {text(profile.materialRate)} {text(profile.materialRateUnit, "")}</small>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="dal-actions">
        <button type="button" onClick={onSaveDraft} disabled={!canEdit || locked || pending || !draftPackage}>Save Draft</button>
        <button type="button" className="secondary" onClick={onValidate} disabled={pending || !draftPackage}>Validate</button>
        <button type="button" className="secondary" onClick={() => setPreviewOpen((open) => !open)} disabled={!draftPackage}>
          Preview Package
        </button>
        <button type="button" onClick={onSubmitToEngineering} disabled={!canEdit || locked || pending || !draftPackage || draftIofApprovalDisabled}>Submit to Engineering</button>
      </div>

      {notice ? <div className="dal-status">{notice}</div> : null}
      {draftPackage && draftIofApprovalDisabled && draftIofApprovalReason ? <div className="dal-status fail">{draftIofApprovalReason}</div> : null}

      {previewOpen ? (
        <details open>
          <summary>{draftPackage?.packageId ?? "Package Preview"}</summary>
          <pre className="commercial-review-package-preview">
            {draftPackage ? JSON.stringify(draftPackage, null, 2) : "No Draft IOF Package is available."}
          </pre>
        </details>
      ) : null}
    </section>
  );
}
