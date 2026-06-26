import type { GoogleRfpBidPlan } from "../../../rfp/GoogleRfpBidPlan";

function money(value: number | undefined) {
  return `$${Math.round(value ?? 0).toLocaleString()}`;
}

export default function GoogleRfpCivilMixPanel({ bidPlan }: { bidPlan: GoogleRfpBidPlan }) {
  return (
    <section className="dal-panel">
      <div className="dal-panel-title-row">
        <h3>Civil Mix</h3>
        <span className="dal-badge warning">Pending engineering verification</span>
      </div>
      <div className="dal-list">
        {bidPlan.routePlans.map((routePlan) => (
          <div className="dal-list-row teralinx-list-row" key={routePlan.routeRequirement.routeRequirementId}>
            <b>{routePlan.routeRequirement.bidSegmentName}</b>
            <span>{money(routePlan.civilMixEstimate?.totalBudgetaryCost)}</span>
            <small>
              {(routePlan.civilMixEstimate?.lineItems ?? [])
                .map((item) => `${item.category}: ${item.feet ? `${item.feet.toLocaleString()} ft` : `${item.count} ea`}`)
                .join("; ")}
            </small>
          </div>
        ))}
      </div>
    </section>
  );
}
