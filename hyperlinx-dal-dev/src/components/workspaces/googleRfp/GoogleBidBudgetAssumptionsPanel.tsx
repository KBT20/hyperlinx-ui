import type { BudgetAssumption, BudgetAssumptionCategory } from "../../../commercial/BudgetAssumptionSet";
import type { SelectedScopePricingSummary } from "../../../commercial/SelectedScopePricingSummary";
import { DEFAULT_BUDGET_ASSUMPTION_SET, GOOGLE_REFERENCE_ASSUMPTION_PATTERNS } from "../../../commercial/fixtures/budgetAssumptionFixtures";

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

function displayValue(value: BudgetAssumption["value"]) {
  return typeof value === "boolean" ? (value ? "Yes" : "No") : String(value);
}

function assumptionsByCategory() {
  return CATEGORY_ORDER.map((category) => ({
    category,
    assumptions: DEFAULT_BUDGET_ASSUMPTION_SET.assumptions.filter((assumption) => assumption.category === category),
  })).filter((group) => group.assumptions.length > 0);
}

export default function GoogleBidBudgetAssumptionsPanel({ pricingSummary }: { pricingSummary: SelectedScopePricingSummary }) {
  const assumptionSet = DEFAULT_BUDGET_ASSUMPTION_SET;
  const groups = assumptionsByCategory();

  return (
    <section className="dal-panel">
      <div className="dal-panel-title-row">
        <h3>Budget Assumptions</h3>
        <span className="dal-badge warning">Read only</span>
      </div>
      <div className="teralinx-summary-grid">
        <div><span>Assumption Set</span><b>{assumptionSet.assumptionSetId}</b></div>
        <div><span>Version</span><b>{assumptionSet.version}</b></div>
        <div><span>Status</span><b>{assumptionSet.status}</b></div>
        <div><span>Source</span><b>{assumptionSet.source.replaceAll("_", " ")}</b></div>
        <div><span>Pricing Scope</span><b>{pricingSummary.scope.label}</b></div>
        <div><span>Confidence</span><b>{assumptionSet.confidence.level} ({assumptionSet.confidence.score})</b></div>
        <div><span>Assumptions</span><b>{assumptionSet.assumptions.length.toLocaleString()}</b></div>
      </div>

      <div className="dal-status">
        Budgets reference this versioned assumption set; assumptions are not production pricing, budget locks, contracts, or execution authority.
      </div>

      {groups.map((group) => (
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
        <summary>Customer Reference Patterns</summary>
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
    </section>
  );
}
