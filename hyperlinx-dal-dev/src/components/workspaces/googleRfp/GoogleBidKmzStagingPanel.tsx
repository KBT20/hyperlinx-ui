import type { GoogleBidPackagePreview } from "../../../rfp/GoogleBidPackagePreview";

export default function GoogleBidKmzStagingPanel({ preview }: { preview: GoogleBidPackagePreview }) {
  const kmz = preview.kmzStagingPreview;
  return (
    <section className="dal-panel">
      <div className="dal-panel-title-row">
        <h3>KMZ Staging Preview</h3>
        <span className="dal-badge warning">No KMZ export</span>
      </div>
      <div className="teralinx-summary-grid">
        <div><span>Source KMZs Detected</span><b>{kmz.sourceKmzsDetected.length}</b></div>
        <div><span>Folder Targets</span><b>{kmz.vendorProposedSpansFolderTargets.length}</b></div>
        <div><span>Route 1 Span</span><b>{kmz.routeSpanStatuses[0]?.staged ? "STAGED" : "NOT STAGED"}</b></div>
        <div><span>Route 2 Span</span><b>{kmz.routeSpanStatuses[1]?.staged ? "STAGED" : "NOT STAGED"}</b></div>
        <div><span>KMZ Export Readiness</span><b>{kmz.kmzExportReadiness.replaceAll("_", " ")}</b></div>
        <div><span>Human Review Required</span><b>{kmz.humanReviewRequired ? "YES" : "NO"}</b></div>
      </div>
      <div className="dal-status">Source KMZs: {kmz.sourceKmzsDetected.join(", ")}. Vendor proposed spans are staged as preview metadata only.</div>
    </section>
  );
}
