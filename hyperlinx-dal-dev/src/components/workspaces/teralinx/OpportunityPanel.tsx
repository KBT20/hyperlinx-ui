import type { TeralinxRouteIntake } from "../../../teralinx/TeralinxRouteIntake";

export default function OpportunityPanel({ intake }: { intake: TeralinxRouteIntake }) {
  const { opportunity } = intake.routeRequest;

  return (
    <section className="dal-panel">
      <h3>Opportunity</h3>
      <div className="teralinx-facts">
        <span>Name</span>
        <b>{opportunity.opportunityName || "Missing"}</b>
        <span>Customer</span>
        <b>{opportunity.customer || "Missing"}</b>
        <span>Market</span>
        <b>{opportunity.market || "Missing"}</b>
        <span>Target Completion</span>
        <b>{opportunity.targetCompletion || "Not set"}</b>
        <span>Internal Owner</span>
        <b>{opportunity.internalOwner || "Missing"}</b>
        <span>Sales Owner</span>
        <b>{opportunity.salesOwner || "Missing"}</b>
      </div>
    </section>
  );
}
