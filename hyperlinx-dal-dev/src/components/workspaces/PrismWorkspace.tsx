import { useMemo, useState } from "react";
import { prismWorkspaceFixtures, readyForQuotePrismWorkspace } from "../../prism/fixtures/prismWorkspaceFixtures";
import type { PrismWorkspace as PrismWorkspaceModel } from "../../prism/PrismWorkspace";
import PrismDiagnosticsPanel from "./prism/PrismDiagnosticsPanel";
import PrismOpportunityPanel from "./prism/PrismOpportunityPanel";
import PrismRecommendationPanel from "./prism/PrismRecommendationPanel";
import PrismRiskPanel from "./prism/PrismRiskPanel";
import PrismSummaryPanel from "./prism/PrismSummaryPanel";

function fixtureLabel(workspace: PrismWorkspaceModel) {
  return `${workspace.summary.customerName} · ${workspace.summary.opportunityName} · ${workspace.status}`;
}

export default function PrismWorkspace() {
  const fixtures = useMemo(() => prismWorkspaceFixtures, []);
  const defaultIndex = Math.max(0, fixtures.indexOf(readyForQuotePrismWorkspace));
  const [selectedFixtureIndex, setSelectedFixtureIndex] = useState(defaultIndex);
  const workspace = fixtures[selectedFixtureIndex] ?? readyForQuotePrismWorkspace;

  return (
    <section className="dal-workspace wide">
      <div className="dal-workspace-header">
        <div>
          <h2>Prism Workspace</h2>
          <p>Advisory opportunity, risk, marketplace, and recommendation composition for one customer workflow.</p>
        </div>
        <select value={selectedFixtureIndex} onChange={(event) => setSelectedFixtureIndex(Number(event.currentTarget.value))} aria-label="Prism fixture">
          {fixtures.map((item, index) => (
            <option key={`${item.summary.opportunityId}-${index}`} value={index}>
              {fixtureLabel(item)}
            </option>
          ))}
        </select>
      </div>

      <div className="dal-grid">
        <PrismSummaryPanel workspace={workspace} />
        <section className="dal-panel">
          <div className="dal-panel-title-row">
            <h3>Quote Readiness</h3>
            <span className={`dal-badge ${workspace.summary.readyForQuote ? "pass" : "fail"}`}>
              {workspace.summary.readyForQuote ? "READY FOR QUOTE" : "BLOCKED"}
            </span>
          </div>
          <div className="opportunity-facts">
            <span>Risks</span>
            <b>{workspace.summary.riskCount}</b>
            <span>Recommendations</span>
            <b>{workspace.summary.recommendationCount}</b>
            <span>Candidate Sites</span>
            <b>{workspace.candidateSites.length}</b>
            <span>Scope Review</span>
            <b>{workspace.scopeReviewWorkspace?.status ?? "Not approved"}</b>
          </div>
          <div className="dal-actions">
            <span className="dal-badge warning">Prism advises</span>
            <span className="dal-badge warning">Humans decide</span>
            <span className="dal-badge warning">Engineering validates</span>
          </div>
        </section>
      </div>

      <PrismOpportunityPanel workspace={workspace} />
      <PrismRiskPanel workspace={workspace} />
      <PrismRecommendationPanel workspace={workspace} />
      <PrismDiagnosticsPanel workspace={workspace} />
    </section>
  );
}
