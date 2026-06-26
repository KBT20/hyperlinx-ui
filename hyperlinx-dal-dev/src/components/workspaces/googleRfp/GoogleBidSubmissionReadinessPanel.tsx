import type { GoogleBidPackagePreview } from "../../../rfp/GoogleBidPackagePreview";

export default function GoogleBidSubmissionReadinessPanel({ preview }: { preview: GoogleBidPackagePreview }) {
  const readiness = preview.submissionReadiness;
  return (
    <section className="dal-panel">
      <div className="dal-panel-title-row">
        <h3>Submission Readiness</h3>
        <span className="dal-badge warning">{readiness.status.replaceAll("_", " ")}</span>
      </div>
      <div className="teralinx-summary-grid">
        <div><span>Commercial Review</span><b>{readiness.commercialReviewRequired ? "REQUIRED" : "READY"}</b></div>
        <div><span>Engineering Review</span><b>{readiness.engineeringReviewRequired ? "REQUIRED" : "READY"}</b></div>
        <div><span>Export</span><b>{readiness.exportNotStarted ? "NOT STARTED" : "READY"}</b></div>
        <div><span>Submission</span><b>{readiness.submissionNotStarted ? "NOT STARTED" : "READY"}</b></div>
      </div>
      <div className="dal-status">{readiness.message}</div>
    </section>
  );
}
