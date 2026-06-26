import type { GoogleRfpBidPlan } from "../../../rfp/GoogleRfpBidPlan";

function fmt(value: number | undefined) {
  return Number.isFinite(value) ? Number(value).toLocaleString() : "0";
}

export default function GoogleRfpRoutesPanel({ bidPlan }: { bidPlan: GoogleRfpBidPlan }) {
  return (
    <section className="dal-panel">
      <div className="dal-panel-title-row">
        <h3>Requested Routes</h3>
        <span className="dal-badge warning">Budgetary</span>
      </div>
      <div className="dal-list">
        {bidPlan.routePlans.map((routePlan) => (
          <div className="dal-list-row teralinx-list-row" key={routePlan.routeRequirement.routeRequirementId}>
            <b>{routePlan.routeRequirement.bidSegmentName}</b>
            <span>{routePlan.status}</span>
            <small>
              {routePlan.routeRequirement.aSite.facilityName} to {routePlan.routeRequirement.zSite.facilityName}; route miles{" "}
              {fmt(routePlan.stationedCorridor?.takeoff.routeMiles)}; diversity {routePlan.diversityAssessment.diversityStatus.replaceAll("_", " ")}
            </small>
          </div>
        ))}
      </div>
    </section>
  );
}
