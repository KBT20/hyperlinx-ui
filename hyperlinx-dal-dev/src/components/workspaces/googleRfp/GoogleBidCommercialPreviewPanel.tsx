import type { BudgetAssumptionState } from "../../../commercial/BudgetAssumptionState";
import type { SelectedScopePricingSummary } from "../../../commercial/SelectedScopePricingSummary";

function money(value: number) {
  return `$${Math.round(value).toLocaleString()}`;
}

function miles(value: number) {
  return `${Number(value.toFixed(1)).toLocaleString()} mi`;
}

export default function GoogleBidCommercialPreviewPanel({
  pricingSummary,
  assumptionStates,
  selectedAssumptionStateId,
  onSelectAssumptionState,
  onConstructionStrategyChange,
  onRockPercentChange,
}: {
  pricingSummary: SelectedScopePricingSummary;
  assumptionStates: BudgetAssumptionState[];
  selectedAssumptionStateId: string;
  onSelectAssumptionState: (stateId: string) => void;
  onConstructionStrategyChange: (changed: "hddPercent" | "plowPercent" | "openCutPercent", value: number) => void;
  onRockPercentChange: (value: number) => void;
}) {
  const reconciliation = pricingSummary.reconciliation;
  const assumptionState = pricingSummary.assumptionState;

  return (
    <section className="dal-panel bid-commercial-planning-panel">
      <div className="bid-planning-grid">
        <div className="bid-construction-card">
          <div className="dal-panel-title-row">
            <h3>Construction Strategy</h3>
            <span className="dal-badge pass">100%</span>
          </div>
          <div className="dal-actions">
            <label>
              Current Assumption State
              <select value={selectedAssumptionStateId} onChange={(event) => onSelectAssumptionState(event.currentTarget.value)}>
                {assumptionStates.map((state) => (
                  <option key={state.stateId} value={state.stateId}>{state.label}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="teralinx-summary-grid">
            <label>
              Plow %
              <input type="range" min="0" max="100" value={assumptionState.civilMix.plowPercent} onChange={(event) => onConstructionStrategyChange("plowPercent", Number(event.currentTarget.value))} />
              <b>{assumptionState.civilMix.plowPercent}%</b>
            </label>
            <label>
              Dirt Bore %
              <input type="range" min="0" max="100" value={assumptionState.civilMix.hddPercent} onChange={(event) => onConstructionStrategyChange("hddPercent", Number(event.currentTarget.value))} />
              <b>{assumptionState.civilMix.hddPercent}%</b>
            </label>
            <label>
              Open Cut %
              <input type="range" min="0" max="100" value={assumptionState.civilMix.openCutPercent} onChange={(event) => onConstructionStrategyChange("openCutPercent", Number(event.currentTarget.value))} />
              <b>{assumptionState.civilMix.openCutPercent}%</b>
            </label>
            <label>
              Rock % inside Dirt Bore
              <input type="range" min="0" max="100" value={assumptionState.borePricing.rockBorePercent} onChange={(event) => onRockPercentChange(Number(event.currentTarget.value))} />
              <b>{assumptionState.borePricing.rockBorePercent}%</b>
            </label>
          </div>
        </div>

        <div className="bid-commercial-summary-card">
          <div className="dal-panel-title-row">
            <h3>Commercial Summary</h3>
            <span className="dal-badge warning">Budgetary</span>
          </div>
          <div className="teralinx-summary-grid">
            <div><span>Selected Pricing Scope</span><b>{pricingSummary.scope.label}</b></div>
            <div><span>Current Assumption State</span><b>{assumptionState.label}</b></div>
            <div><span>Route Miles</span><b>{miles(reconciliation.routeMiles)}</b></div>
            <div><span>Budget Cost</span><b>{money(reconciliation.budgetCost)}</b></div>
            <div><span>Sell Price</span><b>{money(reconciliation.sellPriceIru)}</b></div>
            <div><span>NRC Revenue</span><b>{money(reconciliation.nrcRevenue)}</b></div>
            <div><span>MRC Revenue</span><b>{money(reconciliation.mrcRevenue)}</b></div>
            <div><span>Markup / Points</span><b>{reconciliation.markupPointsPercent}%</b></div>
            <div><span>Gross Margin</span><b>{money(reconciliation.grossMarginDollars)}</b></div>
            <div><span>Margin %</span><b>{reconciliation.grossMarginPercent}%</b></div>
            <div><span>Cost / Mile</span><b>{money(reconciliation.costPerMile)}</b></div>
            <div><span>Revenue / Mile</span><b>{money(reconciliation.revenuePerMile)}</b></div>
            <div><span>Cost / Foot</span><b>{money(reconciliation.costPerFoot)}</b></div>
            <div><span>Sell / Foot</span><b>{money(reconciliation.sellPerFoot)}</b></div>
            <div><span>Revenue / Foot</span><b>{money(reconciliation.revenuePerFoot)}</b></div>
            <div><span>OSP Cost</span><b>{money(reconciliation.ospCost)}</b></div>
            <div><span>ILA Cost</span><b>{money(reconciliation.ilaRegenCost)}</b></div>
          </div>
          {reconciliation.financialValidationWarnings.length ? (
            <div className="dal-status">{reconciliation.financialValidationWarnings.join(" ")}</div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
