import type { GoogleRfpBidPlan } from "../../../rfp/GoogleRfpBidPlan";

export default function GoogleRfpSummaryPanel({ bidPlan }: { bidPlan: GoogleRfpBidPlan }) {
  const { opportunity } = bidPlan;
  return (
    <section className="dal-panel">
      <div className="dal-panel-title-row">
        <h3>RFP Summary</h3>
        <span className={`dal-badge ${bidPlan.status === "READY_FOR_REVIEW" ? "pass" : "warning"}`}>{bidPlan.status.replaceAll("_", " ")}</span>
      </div>
      <div className="teralinx-summary-grid">
        <div>
          <span>Customer</span>
          <b>{opportunity.customerName}</b>
        </div>
        <div>
          <span>Opportunity</span>
          <b>{opportunity.opportunityName}</b>
        </div>
        <div>
          <span>Issue Date</span>
          <b>{opportunity.issueDate}</b>
        </div>
        <div>
          <span>KMZ Deadline</span>
          <b>{opportunity.kmzDeadline}</b>
        </div>
        <div>
          <span>Budgetary Deadline</span>
          <b>{opportunity.budgetaryDeadline}</b>
        </div>
        <div>
          <span>Routes</span>
          <b>{opportunity.requestedRoutes.length}</b>
        </div>
        <div>
          <span>KMZ Readiness</span>
          <b>{bidPlan.kmzReadiness.replaceAll("_", " ")}</b>
        </div>
        <div>
          <span>Workbook Readiness</span>
          <b>{bidPlan.workbookReadiness.replaceAll("_", " ")}</b>
        </div>
        <div>
          <span>Budgetary Readiness</span>
          <b>{bidPlan.budgetaryReadiness.replaceAll("_", " ")}</b>
        </div>
      </div>
    </section>
  );
}
