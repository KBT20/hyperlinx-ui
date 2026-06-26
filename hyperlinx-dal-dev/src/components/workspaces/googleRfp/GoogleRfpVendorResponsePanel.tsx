import type { GoogleRfpBidPlan } from "../../../rfp/GoogleRfpBidPlan";

export default function GoogleRfpVendorResponsePanel({ bidPlan }: { bidPlan: GoogleRfpBidPlan }) {
  const previews = bidPlan.routePlans.flatMap((routePlan) => routePlan.vendorResponsePreview ? [routePlan.vendorResponsePreview] : []);
  return (
    <section className="dal-panel">
      <div className="dal-panel-title-row">
        <h3>Vendor Response Preview</h3>
        <span className="dal-badge warning">No workbook write</span>
      </div>
      <div className="dal-list">
        {previews.map((preview) => (
          <div className="dal-list-row teralinx-list-row" key={preview.vendorResponseId}>
            <b>{preview.bidSegmentName}</b>
            <span>{preview.status.replaceAll("_", " ")}</span>
            <small>
              {preview.fields.length} mapped fields for {preview.workbookTabTarget}
            </small>
          </div>
        ))}
      </div>
      <details>
        <summary>Preview mapped Tab D fields</summary>
        <pre className="dal-pre">{JSON.stringify(previews, null, 2)}</pre>
      </details>
    </section>
  );
}
