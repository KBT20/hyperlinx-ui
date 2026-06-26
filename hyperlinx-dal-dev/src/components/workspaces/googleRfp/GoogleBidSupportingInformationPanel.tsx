import type { BudgetAssumption, BudgetAssumptionCategory } from "../../../commercial/BudgetAssumptionSet";
import type { SelectedScopePricingSummary } from "../../../commercial/SelectedScopePricingSummary";
import { DEFAULT_BUDGET_ASSUMPTION_SET, GOOGLE_REFERENCE_ASSUMPTION_PATTERNS } from "../../../commercial/fixtures/budgetAssumptionFixtures";
import type { GoogleBidPackagePreview } from "../../../rfp/GoogleBidPackagePreview";
import type { GoogleRfpBidPlan } from "../../../rfp/GoogleRfpBidPlan";

const CATEGORY_ORDER: BudgetAssumptionCategory[] = [
  "CORRIDOR",
  "CORRIDOR_CONFIDENCE",
  "ROUTE_MATURITY",
  "EXISTING_INFRASTRUCTURE",
  "EXISTING_UTILITY",
  "CIVIL",
  "ENGINEERING",
  "COMMERCIAL",
  "CONSTRUCTION",
  "CUSTOMER",
  "RISK",
];

function money(value: number) {
  return `$${Math.round(value).toLocaleString()}`;
}

function feet(value: number) {
  return `${Math.round(value).toLocaleString()} ft`;
}

function displayValue(value: BudgetAssumption["value"]) {
  return typeof value === "boolean" ? (value ? "Yes" : "No") : String(value);
}

function assumptionsByCategory() {
  return CATEGORY_ORDER.map((category) => ({
    category,
    assumptions: DEFAULT_BUDGET_ASSUMPTION_SET.assumptions.filter((assumption) => assumption.category === category),
  })).filter((group) => group.assumptions.length > 0);
}

export default function GoogleBidSupportingInformationPanel({
  bidPlan,
  preview,
  pricingSummary,
}: {
  bidPlan: GoogleRfpBidPlan;
  preview: GoogleBidPackagePreview;
  pricingSummary: SelectedScopePricingSummary;
}) {
  const pricing = pricingSummary.pricing;
  const materials = pricing.fiberSummary.materialSummary;
  const ospLineItems = pricing.routes.flatMap((route) => route.lineItems.map((line) => ({ route, line })));
  const ilaLineItems = pricing.ilaRegenPricing.sitePricings[0]?.lineItems ?? [];
  const checklistReady = bidPlan.checklist.filter((item) => item.status === "READY").length;
  const checklistReview = bidPlan.checklist.filter((item) => item.status === "REQUIRES_REVIEW").length;
  const checklistNotStarted = bidPlan.checklist.filter((item) => item.status === "NOT_STARTED").length;
  const checklistBlocked = bidPlan.checklist.filter((item) => item.status === "BLOCKED").length;
  const readiness = preview.submissionReadiness;
  const kmz = preview.kmzStagingPreview;

  return (
    <section className="dal-panel bid-supporting-information">
      <div className="dal-panel-title-row">
        <h3>Supporting Information</h3>
        <span className="dal-badge warning">Collapsed by default</span>
      </div>

      <details>
        <summary>Material and Splicing - Purchased Fiber {feet(materials.fiber.purchasedFiberFeet)} - Splice Cases {materials.splicing.spliceCases.toLocaleString()}</summary>
        <div className="dal-table-wrap">
          <table className="dal-table">
            <tbody>
              <tr><td>Purchased Fiber</td><td>{feet(materials.fiber.purchasedFiberFeet)}</td></tr>
              <tr><td>Standard Duct Package</td><td>{feet(materials.conduit.standardDuctPackageFeet)} ({materials.conduit.standardDuctPackageConduitCount} conduits)</td></tr>
              <tr><td>FuturePath</td><td>{materials.innerduct.enabled ? feet(materials.innerduct.installedInnerductFeet) : "Disabled"}</td></tr>
              <tr><td>Reel Count</td><td>{materials.splicing.reelCount.toLocaleString()}</td></tr>
              <tr><td>Butt Splice Locations</td><td>{materials.splicing.fieldSpliceLocations.toLocaleString()}</td></tr>
              <tr><td>Splice Cases</td><td>{materials.splicing.spliceCases.toLocaleString()}</td></tr>
              <tr><td>Splicing Labor</td><td>{money(materials.splicing.splicingLaborTotal)}</td></tr>
            </tbody>
          </table>
        </div>
      </details>

      <details>
        <summary>OSP Segment Line Items - {ospLineItems.length.toLocaleString()} Items - Budget {money(pricingSummary.reconciliation.ospCost)}</summary>
        <div className="dal-table-wrap">
          <table className="dal-table">
            <thead>
              <tr>
                <th>Segment</th>
                <th>Line</th>
                <th>Quantity</th>
                <th>Quantity Source</th>
                <th>Rate</th>
                <th>Cost</th>
                <th>Basis</th>
              </tr>
            </thead>
            <tbody>
              {ospLineItems.map(({ route, line }) => (
                <tr key={line.lineId}>
                  <td>{route.segmentName}</td>
                  <td>{line.description}</td>
                  <td>{line.quantity.toLocaleString()} {line.unit}</td>
                  <td>{line.sourceQuantity}</td>
                  <td>{line.unit === "PERCENT" ? `${Number((line.unitRate * 100).toFixed(2))}%` : money(line.unitRate)}</td>
                  <td>{money(line.extendedCost)}</td>
                  <td>{line.costBasis}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <details>
        <summary>ILA / Regen - {pricing.ilaRegenPricing.siteCount.toLocaleString()} Sites - Budget {money(pricing.ilaRegenPricing.totalBudgetCost)}</summary>
        <div className="dal-table-wrap">
          <table className="dal-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Description</th>
                <th>Cost</th>
              </tr>
            </thead>
            <tbody>
              {ilaLineItems.map((line) => (
                <tr key={line.lineItemId}>
                  <td>{line.category.replaceAll("_", " ")}</td>
                  <td>{line.description}</td>
                  <td>{money(line.extendedCost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <details>
        <summary>Budget Assumptions - {DEFAULT_BUDGET_ASSUMPTION_SET.assumptionSetId} - Confidence {DEFAULT_BUDGET_ASSUMPTION_SET.confidence.level} ({DEFAULT_BUDGET_ASSUMPTION_SET.confidence.score})</summary>
        <div className="teralinx-summary-grid">
          <div><span>Version</span><b>{DEFAULT_BUDGET_ASSUMPTION_SET.version}</b></div>
          <div><span>Status</span><b>{DEFAULT_BUDGET_ASSUMPTION_SET.status}</b></div>
          <div><span>Pricing Scope</span><b>{pricingSummary.scope.label}</b></div>
          <div><span>Assumptions</span><b>{DEFAULT_BUDGET_ASSUMPTION_SET.assumptions.length.toLocaleString()}</b></div>
        </div>
        {assumptionsByCategory().map((group) => (
          <div className="dal-panel-subsection" key={group.category}>
            <div className="dal-panel-title-row">
              <h4>{group.category.replaceAll("_", " ")}</h4>
              <span>{group.assumptions.length.toLocaleString()} assumptions</span>
            </div>
            <div className="dal-table-wrap">
              <table className="dal-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Value</th>
                    <th>Unit</th>
                    <th>Source</th>
                    <th>Confidence</th>
                    <th>Reason</th>
                    <th>Impacted Cost Categories</th>
                  </tr>
                </thead>
                <tbody>
                  {group.assumptions.map((assumption) => (
                    <tr key={assumption.assumptionId}>
                      <td>{assumption.name}</td>
                      <td>{displayValue(assumption.value)}</td>
                      <td>{assumption.unit}</td>
                      <td>{assumption.source.replaceAll("_", " ")}</td>
                      <td>{assumption.confidence.level} ({assumption.confidence.score})</td>
                      <td>{assumption.reason}</td>
                      <td>{assumption.affectedCostCategories.join(", ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
        <details>
          <summary>Customer Reference Patterns - {GOOGLE_REFERENCE_ASSUMPTION_PATTERNS.length.toLocaleString()} Patterns</summary>
          <div className="dal-list">
            {GOOGLE_REFERENCE_ASSUMPTION_PATTERNS.map((pattern) => (
              <div className="dal-list-row" key={pattern.sourceArtifact}>
                <b>{pattern.sourceArtifact}</b>
                <span>Reusable pattern</span>
                <small>{pattern.reusablePattern} Mapped assumptions: {pattern.mappedAssumptions.join(", ")}.</small>
              </div>
            ))}
          </div>
        </details>
      </details>

      <details>
        <summary>Submission Readiness - {readiness.status.replaceAll("_", " ")} - Export {readiness.exportNotStarted ? "Not Started" : "Ready"}</summary>
        <div className="teralinx-summary-grid">
          <div><span>Commercial Review</span><b>{readiness.commercialReviewRequired ? "REQUIRED" : "READY"}</b></div>
          <div><span>Engineering Review</span><b>{readiness.engineeringReviewRequired ? "REQUIRED" : "READY"}</b></div>
          <div><span>Export</span><b>{readiness.exportNotStarted ? "NOT STARTED" : "READY"}</b></div>
          <div><span>Submission</span><b>{readiness.submissionNotStarted ? "NOT STARTED" : "READY"}</b></div>
        </div>
        <div className="dal-status">{readiness.message}</div>
      </details>

      <details>
        <summary>KMZ Staging - {kmz.kmzExportReadiness.replaceAll("_", " ")} - {kmz.vendorProposedSpansFolderTargets.length.toLocaleString()} Folder Targets</summary>
        <div className="teralinx-summary-grid">
          <div><span>Source KMZs Detected</span><b>{kmz.sourceKmzsDetected.length}</b></div>
          <div><span>Folder Targets</span><b>{kmz.vendorProposedSpansFolderTargets.length}</b></div>
          <div><span>Route 1 Span</span><b>{kmz.routeSpanStatuses[0]?.staged ? "STAGED" : "NOT STAGED"}</b></div>
          <div><span>Route 2 Span</span><b>{kmz.routeSpanStatuses[1]?.staged ? "STAGED" : "NOT STAGED"}</b></div>
          <div><span>Human Review Required</span><b>{kmz.humanReviewRequired ? "YES" : "NO"}</b></div>
        </div>
        <div className="dal-status">Source KMZs: {kmz.sourceKmzsDetected.join(", ")}. Vendor proposed spans are staged as preview metadata only.</div>
      </details>

      <details>
        <summary>Submission Checklist - Ready {checklistReady} - Review {checklistReview} - Not Started {checklistNotStarted} - Blocked {checklistBlocked}</summary>
        <div className="dal-list">
          {bidPlan.checklist.map((item) => (
            <div className="dal-list-row teralinx-list-row" key={item.checklistItemId}>
              <b>{item.label}</b>
              <span>{item.status.replaceAll("_", " ")}</span>
              <small>No external submission is performed by DAL.</small>
            </div>
          ))}
        </div>
      </details>

      <details>
        <summary>Next Actions - Human Tasks {bidPlan.nextActions.length.toLocaleString()} - DAL Tasks 0</summary>
        <div className="dal-list">
          {bidPlan.nextActions.map((action) => (
            <div className="dal-list-row" key={action}>
              <b>{action}</b>
              <span>HUMAN</span>
              <small>This workspace does not email, submit, write workbooks, create ScopeVersions, or mutate inventory.</small>
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}
