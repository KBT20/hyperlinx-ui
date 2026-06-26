import type { GoogleBidPackagePreview } from "../../../rfp/GoogleBidPackagePreview";
import type { SelectedScopePricingSummary } from "../../../commercial/SelectedScopePricingSummary";

const fieldOrder = [
  "Bid Segment Name",
  "A Location",
  "Z Location",
  "Route Miles",
  "Fiber Count to Deliver",
  "Fiber Type",
  "Placement",
  "Delivery Interval",
  "Conduit Size",
  "Number of Conduits",
  "ILA Quantity",
  "Construction Length",
  "DP&E",
  "Construction Cost",
  "NRC",
  "O&M",
  "Risks",
  "TCO",
];

function money(value: number) {
  return `$${Math.round(value).toLocaleString()}`;
}

export default function GoogleBidVendorResponsePreviewPanel({
  preview,
  pricingSummary,
}: {
  preview: GoogleBidPackagePreview;
  pricingSummary: SelectedScopePricingSummary;
}) {
  const blocked = preview.vendorResponsePreviews.some((response) => response.status === "BLOCKED");
  const reconciliation = pricingSummary.reconciliation;
  function reconciledFieldValue(fieldName: string, value: string | number | boolean | undefined) {
    if (fieldName === "Construction Cost") return money(reconciliation.budgetCost);
    if (fieldName === "NRC") return money(reconciliation.sellPriceIru);
    if (fieldName === "TCO") return money(reconciliation.sellPriceIru);
    return value;
  }
  return (
    <section className="dal-panel">
      <div className="dal-panel-title-row">
        <h3>Vendor Response Preview</h3>
        <span className="dal-badge warning">Preview only - no workbook write</span>
      </div>
      <div className="teralinx-summary-grid">
        <div><span>Pricing Scope</span><b>{pricingSummary.scope.label}</b></div>
        <div><span>Route Miles</span><b>{Number(reconciliation.routeMiles.toFixed(2)).toLocaleString()}</b></div>
        <div><span>Construction / Budget Cost</span><b>{money(reconciliation.budgetCost)}</b></div>
        <div><span>NRC / IRU Sell Price</span><b>{money(reconciliation.sellPriceIru)}</b></div>
        <div><span>Markup / Points</span><b>{reconciliation.markupPointsPercent}% / {money(reconciliation.markupPointsAmount)}</b></div>
        <div><span>Reconciliation</span><b>{reconciliation.sellPriceReconciles ? "PASS" : "FAIL"}</b></div>
      </div>
      {blocked ? (
        <div className="dal-status">Vendor Response Preview Blocked - route coordinates or OSRM snapping require verification.</div>
      ) : null}
      <div className="dal-list">
        {preview.vendorResponsePreviews.map((response) => (
          <div className="dal-list-row teralinx-list-row" key={response.vendorResponseId}>
            <b>{response.bidSegmentName}</b>
            <span>{response.status.replaceAll("_", " ")}</span>
            <small>
              {response.status === "BLOCKED"
                ? response.fields[0]?.value
                : fieldOrder
                    .map((fieldName) => response.fields.find((field) => field.googleFieldName === fieldName))
                    .filter(Boolean)
                    .map((field) => `${field?.googleFieldName}: ${reconciledFieldValue(field?.googleFieldName ?? "", field?.value)}`)
                    .join("; ")}
            </small>
          </div>
        ))}
      </div>
    </section>
  );
}
