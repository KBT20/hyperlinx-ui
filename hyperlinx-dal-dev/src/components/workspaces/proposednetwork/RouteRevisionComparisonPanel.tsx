import type { RouteRevision } from "../../../redline/RouteRevision";

function money(value: number) {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}$${Math.round(value).toLocaleString()}`;
}

function signed(value: number, suffix = "") {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toLocaleString()}${suffix}`;
}

export default function RouteRevisionComparisonPanel({ revisions, selectedRevision }: { revisions: RouteRevision[]; selectedRevision?: RouteRevision | null }) {
  const revision = selectedRevision ?? revisions.at(-1) ?? null;
  return (
    <section className="dal-panel">
      <div className="dal-panel-title-row">
        <h3>Route Revision Delta</h3>
        <span className="dal-badge warning">{revision ? revision.snapStatus.replaceAll("_", " ") : "No revision"}</span>
      </div>
      {!revision ? (
        <div className="dal-status">Enter Edit Corridor mode and drag a route handle or insert a control point to create a revision preview.</div>
      ) : (
        <>
          <div className="teralinx-summary-grid">
            <div><span>Original Miles</span><b>{revision.delta.originalMiles.toLocaleString()}</b></div>
            <div><span>Revised Miles</span><b>{revision.delta.revisedMiles.toLocaleString()}</b></div>
            <div><span>Mileage Change</span><b>{signed(revision.delta.mileDelta, " mi")}</b></div>
            <div><span>Segment Mileage Delta</span><b>{signed(revision.delta.mileDelta, " mi")}</b></div>
            <div><span>Original Cost</span><b>${Math.round(revision.delta.originalEstimatedCost).toLocaleString()}</b></div>
            <div><span>Revised Cost</span><b>${Math.round(revision.delta.revisedEstimatedCost).toLocaleString()}</b></div>
            <div><span>Cost Change</span><b>{money(revision.delta.estimatedCostDelta)}</b></div>
            <div><span>HDD Change</span><b>Pending civil remap</b></div>
            <div><span>Plow Change</span><b>Pending civil remap</b></div>
            <div><span>Bore Change</span><b>Pending civil remap</b></div>
            <div><span>Crossing Change</span><b>{signed(revision.delta.crossingDelta)}</b></div>
            <div><span>Vault Change</span><b>{signed(revision.delta.vaultDelta)}</b></div>
            <div><span>Regen Change</span><b>{signed(revision.delta.regenDelta)}</b></div>
            <div><span>Schedule Delta</span><b>{revision.delta.scheduleDeltaDays === undefined ? "Pending schedule model" : signed(revision.delta.scheduleDeltaDays, " days")}</b></div>
            <div><span>Unresolved Warnings</span><b>{revision.delta.unresolvedWarningCount ?? 0}</b></div>
            <div><span>Confidence Change</span><b>{signed(revision.delta.confidenceChange)}</b></div>
          </div>
          <div className="dal-status">
            {revision.delta.summary} Original OSRM route remains preserved. Revision is sales/design candidate only and is not engineering-certified.
          </div>
        </>
      )}
    </section>
  );
}
