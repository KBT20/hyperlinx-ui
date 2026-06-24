import type { OpportunityDetailWorkspace } from "../../../opportunity/OpportunityDetailWorkspace";

function joinList(values: readonly string[]) {
  return values.length ? values.join(", ") : "None";
}

export default function OpportunitySummaryPanel({ workspace }: { workspace: OpportunityDetailWorkspace }) {
  const { opportunity, networkIntent, protectionSchema, stageContext, summary } = workspace;
  const baseline = stageContext.baselineNetwork;

  return (
    <div className="dal-grid">
      <section className="dal-panel">
        <div className="dal-panel-title-row">
          <h3>Customer / Opportunity</h3>
          <span className="dal-badge pass">Fixture Only</span>
        </div>
        <div className="opportunity-facts">
          <span>Customer</span>
          <b>{summary.customerName}</b>
          <span>Opportunity</span>
          <b>{summary.opportunityName}</b>
          <span>Account Owner</span>
          <b>{summary.accountOwner}</b>
          <span>Products</span>
          <b>{joinList(summary.requestedProducts)}</b>
          <span>Services</span>
          <b>{joinList(summary.requestedServices)}</b>
        </div>
      </section>

      <section className="dal-panel">
        <h3>Network Intent</h3>
        <div className="opportunity-facts">
          <span>Network Type</span>
          <b>{networkIntent?.networkType ?? "Not selected"}</b>
          <span>Protection</span>
          <b>{protectionSchema?.schemaType ?? "Not selected"}</b>
          <span>Baseline Status</span>
          <b>{baseline?.status ?? "Not synthesized"}</b>
          <span>Reference Architecture</span>
          <b>{baseline?.referenceArchitecture ?? "Not selected"}</b>
          <span>Candidate Objects</span>
          <b>{baseline?.candidateObjects.length ?? 0}</b>
        </div>
      </section>

      <section className="dal-panel">
        <h3>Locations</h3>
        <div className="dal-list">
          {opportunity.locations.map((location) => (
            <div className="dal-list-row opportunity-list-row" key={location.locationId}>
              <b>{location.siteName}</b>
              <span>{location.role}</span>
              <small>
                {[location.region, location.state, location.country].filter(Boolean).join(", ") || "Location"} · {location.locationConfidence}
              </small>
            </div>
          ))}
          {!opportunity.locations.length && <div className="dal-status">No locations registered.</div>}
        </div>
      </section>

      <section className="dal-panel">
        <h3>Attachments</h3>
        <div className="dal-list">
          {opportunity.attachments.map((attachment) => (
            <div className="dal-list-row opportunity-list-row" key={attachment.attachmentId}>
              <b>{attachment.fileName}</b>
              <span>{attachment.attachmentType}</span>
              <small>{attachment.status}</small>
            </div>
          ))}
          {!opportunity.attachments.length && <div className="dal-status">No attachments registered.</div>}
        </div>
      </section>
    </div>
  );
}
