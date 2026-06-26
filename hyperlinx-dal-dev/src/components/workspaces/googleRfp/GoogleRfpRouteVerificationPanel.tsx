import { coordinatesAreVerified, routeVerificationIsQuoteReady } from "../../../routeGeneration/OsrmRouteVerification";
import type { GoogleRfpBidPlan } from "../../../rfp/GoogleRfpBidPlan";

function badge(label: string, ok: boolean) {
  return <span className={`dal-badge ${ok ? "pass" : "warning"}`}>{label}</span>;
}

export default function GoogleRfpRouteVerificationPanel({ bidPlan }: { bidPlan: GoogleRfpBidPlan }) {
  return (
    <section className="dal-panel">
      <div className="dal-panel-title-row">
        <h3>Route Verification</h3>
        <span className="dal-badge warning">OSRM required</span>
      </div>
      <div className="dal-list">
        {bidPlan.routePlans.map((routePlan) => {
          const requirement = routePlan.routeRequirement;
          const verification = routePlan.routeVerification;
          const coordinatesVerified = coordinatesAreVerified(verification.aSiteCoordinateStatus) && coordinatesAreVerified(verification.zSiteCoordinateStatus);
          const osrmSnapped = verification.routeSnapStatus === "ROUTE_SNAPPED";
          const quoteReady = routeVerificationIsQuoteReady(verification);
          const blocked = verification.blockers.length > 0 || routePlan.status === "BLOCKED";
          return (
            <div className="dal-list-row teralinx-list-row" key={requirement.routeRequirementId}>
              <b>{requirement.bidSegmentName}</b>
              <span>{verification.routeSnapStatus.replaceAll("_", " ")}</span>
              <small>
                A: {requirement.aSite.siteCode} {requirement.aSite.coordinateStatus.replaceAll("_", " ")} | Z: {requirement.zSite.siteCode}{" "}
                {requirement.zSite.coordinateStatus.replaceAll("_", " ")}
              </small>
              <small>
                OSRM: {verification.osrmStatus.replaceAll("_", " ")} | Endpoint: {verification.osrmEndpoint} | Miles:{" "}
                {verification.totalMiles.toLocaleString()} | Vertices: {verification.geometryCoordinateCount.toLocaleString()}
              </small>
              <small>
                Mileage Source: {verification.mileageSource.replaceAll("_", " ")} | Takeoff: {verification.takeoffSource.replaceAll("_", " ")} | Quote:{" "}
                {verification.quoteSource.replaceAll("_", " ")}
              </small>
              <div className="dal-actions">
                {badge("Coordinates Verified", coordinatesVerified)}
                {badge("OSRM Snapped", osrmSnapped)}
                {badge("Quote Ready", quoteReady)}
                <span className="dal-badge warning">Needs Review</span>
                <span className={`dal-badge ${blocked ? "fail" : "pass"}`}>Blocked</span>
              </div>
              {verification.blockers.length > 0 ? (
                <ul>
                  {verification.blockers.map((blocker) => (
                    <li key={blocker}>{blocker}</li>
                  ))}
                </ul>
              ) : (
                <small>Verified route remains sales-estimate only and requires engineering certification before execution.</small>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
