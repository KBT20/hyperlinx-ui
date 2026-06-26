import type { TeralinxRouteIntake } from "../../../teralinx/TeralinxRouteIntake";

export default function CustomerPanel({ intake }: { intake: TeralinxRouteIntake }) {
  const { customer } = intake.routeRequest;

  return (
    <section className="dal-panel">
      <div className="dal-panel-title-row">
        <h3>Customer</h3>
        <span className="dal-badge warning">{customer.customerMode.replaceAll("_", " ")}</span>
      </div>
      <div className="teralinx-facts">
        <span>Company</span>
        <b>{customer.company || "Missing"}</b>
        <span>Primary Contact</span>
        <b>{customer.primaryContact || "Missing"}</b>
        <span>Market</span>
        <b>{customer.market || "Missing"}</b>
        <span>Notes</span>
        <b>{customer.notes || "None"}</b>
      </div>
    </section>
  );
}
