import type { GoogleBidPackagePreview } from "../../../rfp/GoogleBidPackagePreview";
import type { SelectedScopePricingSummary } from "../../../commercial/SelectedScopePricingSummary";

function money(value: number) {
  return `$${Math.round(value).toLocaleString()}`;
}

function miles(value: number) {
  return `${Number(value.toFixed(1)).toLocaleString()} mi`;
}

function statusLabel(value: string) {
  return value.replaceAll("_", " ");
}

export default function GoogleBidExecutiveSummaryPanel({
  preview,
  pricingSummary,
}: {
  preview: GoogleBidPackagePreview;
  pricingSummary: SelectedScopePricingSummary;
}) {
  const summary = preview.executiveSummary;
  const reconciliation = pricingSummary.reconciliation;
  const assumptionState = pricingSummary.assumptionState;
  const constructionStrategy = assumptionState.civilMix;
  const dirtBoreMiles = reconciliation.routeMiles * (constructionStrategy.hddPercent / 100);
  const grossMargin = reconciliation.sellPriceIru - reconciliation.budgetCost;

  return (
    <section className="dal-panel">
      <div className="dal-panel-title-row">
        <h3>Executive Dashboard</h3>
        <span className="dal-badge warning">Budgetary only</span>
      </div>

      <div className="dal-panel-title-row">
        <h3>Project Facts</h3>
        <span className="dal-badge pass">Selected corridor</span>
      </div>
      <div className="teralinx-summary-grid">
        <div><span>Customer</span><b>{summary.customer}</b></div>
        <div><span>Opportunity</span><b>{summary.opportunity}</b></div>
        <div><span>Pricing Scope</span><b>{pricingSummary.scope.label}</b></div>
        <div><span>Route Count</span><b>{summary.routeCount}</b></div>
        <div><span>Total Route Miles</span><b>{reconciliation.routeMiles.toLocaleString()}</b></div>
        <div><span>Highway Crossings</span><b>{summary.highwayCrossings.toLocaleString()}</b></div>
        <div><span>Rail Crossings</span><b>{summary.railCrossings.toLocaleString()}</b></div>
        <div><span>Water Crossings</span><b>{summary.waterCrossings.toLocaleString()}</b></div>
        <div><span>Regen / ILA Sites</span><b>{summary.totalRegenIlaSites.toLocaleString()}</b></div>
        <div><span>RFP Issue Date</span><b>{summary.rfpIssueDate}</b></div>
        <div><span>KMZ Deadline</span><b>{summary.kmzDeadline}</b></div>
        <div><span>Submission Readiness</span><b>{statusLabel(summary.submissionReadiness)}</b></div>
      </div>

      <div className="dal-panel-title-row">
        <h3>Current Commercial Plan</h3>
        <span className="dal-badge pass">Live assumptions</span>
      </div>
      <div className="teralinx-summary-grid">
        <div><span>Current Assumption State</span><b>{assumptionState.label}</b></div>
        <div><span>Plow Strategy</span><b>{constructionStrategy.plowPercent}% / {miles(reconciliation.routeMiles * (constructionStrategy.plowPercent / 100))}</b></div>
        <div><span>Dirt Bore Strategy</span><b>{constructionStrategy.hddPercent}% / {miles(dirtBoreMiles)}</b></div>
        <div><span>Open Cut Strategy</span><b>{constructionStrategy.openCutPercent}% / {miles(reconciliation.routeMiles * (constructionStrategy.openCutPercent / 100))}</b></div>
        <div><span>Rock Inside Dirt Bore</span><b>{assumptionState.borePricing.rockBorePercent}% / {miles(dirtBoreMiles * (assumptionState.borePricing.rockBorePercent / 100))}</b></div>
        <div><span>Budget Cost</span><b>{money(reconciliation.budgetCost)}</b></div>
        <div><span>Sell Price</span><b>{money(reconciliation.sellPriceIru)}</b></div>
        <div><span>Gross Margin</span><b>{money(grossMargin)}</b></div>
        <div><span>Markup / Points</span><b>{reconciliation.markupPointsPercent}% / {money(reconciliation.markupPointsAmount)}</b></div>
        <div><span>Cost / Mile</span><b>{money(reconciliation.costPerMile)}</b></div>
        <div><span>Sell / Mile</span><b>{money(reconciliation.sellPricePerMile)}</b></div>
        <div><span>Cost / Foot</span><b>{money(reconciliation.costPerFoot)}</b></div>
        <div><span>Sell / Foot</span><b>{money(reconciliation.sellPricePerFoot)}</b></div>
        <div><span>OSP Cost</span><b>{money(reconciliation.ospCost)}</b></div>
        <div><span>ILA Cost</span><b>{money(reconciliation.ilaRegenCost)}</b></div>
        <div><span>Commercial Authority</span><b>SelectedScopePricingSummary</b></div>
      </div>
    </section>
  );
}
