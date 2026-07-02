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

export function CommercialReviewPanel({
  draftPackage,
  customerName,
  proposalLabel,
  productLabel,
  doctrineLabel,
  pending = false,
  canEdit = true,
  notice,
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

      <div className="dal-actions">
        <button type="button" onClick={onSaveDraft} disabled={!canEdit || locked || pending || !draftPackage}>Save Draft</button>
        <button type="button" className="secondary" onClick={onValidate} disabled={pending || !draftPackage}>Validate</button>
        <button type="button" className="secondary" onClick={() => setPreviewOpen((open) => !open)} disabled={!draftPackage}>
          Preview Package
        </button>
        <button type="button" onClick={onSubmitToEngineering} disabled={!canEdit || locked || pending || !draftPackage}>Submit to Engineering</button>
      </div>

      {notice ? <div className="dal-status">{notice}</div> : null}

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
