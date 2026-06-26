import type { GoogleRfpBidPlan } from "../../../rfp/GoogleRfpBidPlan";

export default function GoogleBidDiversityPanel({ bidPlan }: { bidPlan: GoogleRfpBidPlan }) {
  const assessments = bidPlan.routePlans.filter((route) => route.diversityAssessment.comparedToRouteRequirementId);
  return (
    <section className="dal-panel">
      <div className="dal-panel-title-row">
        <h3>Diversity Preview</h3>
        <span className="dal-badge warning">Sales estimate</span>
      </div>
      <div className="dal-list">
        {assessments.map((route) => {
          const compare = bidPlan.routePlans.find((candidate) => candidate.routeRequirement.routeRequirementId === route.diversityAssessment.comparedToRouteRequirementId);
          return (
            <div className="dal-list-row teralinx-list-row" key={route.diversityAssessment.assessmentId}>
              <b>{route.routeRequirement.bidSegmentName}</b>
              <span>{route.diversityAssessment.diversityStatus.replaceAll("_", " ")}</span>
              <small>
                Primary route: {route.routeRequirement.bidSegmentName}; comparison route: {compare?.routeRequirement.bidSegmentName ?? "Not available"}; shared mileage estimate {route.diversityAssessment.sharedMileageEstimate}; shared corridor {route.diversityAssessment.sharedCorridorPercentage}%. {route.diversityAssessment.separationWarning} Sales diversity estimate; Route Engineering must verify before submission.
              </small>
            </div>
          );
        })}
      </div>
    </section>
  );
}
