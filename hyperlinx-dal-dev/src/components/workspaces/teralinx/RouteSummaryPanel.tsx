import type { TeralinxRouteIntake } from "../../../teralinx/TeralinxRouteIntake";
import { formatProtectionClass } from "../../../designDoctrine/ProtectionClass";

export default function RouteSummaryPanel({ intake }: { intake: TeralinxRouteIntake }) {
  const request = intake.routeRequest;

  return (
    <section className="dal-panel">
      <div className="dal-panel-title-row">
        <h3>Design Summary</h3>
        <span className={`dal-badge ${request.readiness === "READY_FOR_DESIGN" ? "pass" : "fail"}`}>{request.readiness.replaceAll("_", " ")}</span>
      </div>
      <div className="teralinx-summary-grid">
        <div>
          <span>Customer</span>
          <b>{request.customer.company || "Missing"}</b>
        </div>
        <div>
          <span>Opportunity</span>
          <b>{request.opportunity.opportunityName || "Missing"}</b>
        </div>
        <div>
          <span>Network</span>
          <b>{request.intent.networkType || "Missing"}</b>
        </div>
        <div>
          <span>Protection</span>
          <b>{request.intent.protection ? formatProtectionClass(request.intent.protection, request.intent.networkType) : "Missing"}</b>
        </div>
        <div>
          <span>Product</span>
          <b>{request.intent.primaryProduct || "Missing"}</b>
        </div>
        <div>
          <span>Sites</span>
          <b>{request.siteList.length}</b>
        </div>
        <div>
          <span>Estimated Miles</span>
          <b>{request.estimatedMilesPlaceholder.toLocaleString()}</b>
        </div>
        <div>
          <span>Ready</span>
          <b>{request.readiness === "READY_FOR_DESIGN" ? "Yes" : "No"}</b>
        </div>
      </div>
    </section>
  );
}
