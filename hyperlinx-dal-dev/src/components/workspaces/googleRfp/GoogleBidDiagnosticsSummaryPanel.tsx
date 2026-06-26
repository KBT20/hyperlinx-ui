import type { GoogleBidPackagePreview } from "../../../rfp/GoogleBidPackagePreview";
import type { GoogleRfpBidPlan } from "../../../rfp/GoogleRfpBidPlan";
import { googleHeliumRfpDoctrine } from "../../../rfp/GoogleRfpDoctrine";

function copyJson(value: unknown) {
  const text = JSON.stringify(value, null, 2);
  void navigator.clipboard?.writeText(text);
}

export default function GoogleBidDiagnosticsSummaryPanel({
  bidPlan,
  preview,
}: {
  bidPlan: GoogleRfpBidPlan;
  preview: GoogleBidPackagePreview;
}) {
  const summary = preview.diagnosticsSummary;
  const developerJson = { doctrine: googleHeliumRfpDoctrine, bidPlan, preview };
  return (
    <section className="dal-panel">
      <div className="dal-panel-title-row">
        <h3>Diagnostics Summary</h3>
        <span className="dal-badge warning">Collapsed JSON</span>
      </div>
      <div className="teralinx-summary-grid">
        <div><span>RFP ID</span><b>{summary.rfpId}</b></div>
        <div><span>Route Count</span><b>{summary.routeCount}</b></div>
        <div><span>Vendor Response Previews</span><b>{summary.vendorResponsePreviewCount}</b></div>
        <div><span>Checklist Ready</span><b>{summary.checklistReadyCount}</b></div>
        <div><span>Checklist Blocked</span><b>{summary.checklistBlockedCount}</b></div>
        <div><span>Civil Mix</span><b>{summary.civilMixStatus}</b></div>
        <div><span>Diversity</span><b>{summary.diversityStatus.replaceAll("_", " ")}</b></div>
        <div><span>KMZ Staging</span><b>{summary.kmzStagingStatus.replaceAll("_", " ")}</b></div>
        <div><span>Workbook Preview</span><b>{summary.workbookPreviewStatus.replaceAll("_", " ")}</b></div>
      </div>
      <div className="dal-actions">
        <button type="button" onClick={() => copyJson(developerJson)}>Copy JSON</button>
        <button type="button" disabled title="Placeholder only. File download is intentionally not implemented in this phase.">
          Download Diagnostics JSON
        </button>
      </div>
      <details>
        <summary>Developer mode JSON</summary>
        <pre
          className="dal-pre"
          style={{
            maxHeight: 360,
            overflow: "auto",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {JSON.stringify(developerJson, null, 2)}
        </pre>
      </details>
    </section>
  );
}
