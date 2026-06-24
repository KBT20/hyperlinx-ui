import { useMemo, useState } from "react";
import {
  googleTexasAiExpansionWorkspace,
  opportunityDetailWorkspaceFixtures,
} from "../../opportunity/fixtures/opportunityDetailWorkspaceFixtures";
import type { OpportunityDetailWorkspace } from "../../opportunity/OpportunityDetailWorkspace";
import OpportunityDiagnosticsPanel from "./opportunity/OpportunityDiagnosticsPanel";
import OpportunityHeader from "./opportunity/OpportunityHeader";
import OpportunityNextActionPanel from "./opportunity/OpportunityNextActionPanel";
import OpportunitySummaryPanel from "./opportunity/OpportunitySummaryPanel";
import OpportunityWorkflowPanel from "./opportunity/OpportunityWorkflowPanel";

function fixtureLabel(workspace: OpportunityDetailWorkspace) {
  return `${workspace.summary.customerName} · ${workspace.summary.opportunityName}`;
}

export default function OpportunityWorkspace() {
  const fixtures = useMemo(() => opportunityDetailWorkspaceFixtures, []);
  const defaultFixtureIndex = Math.max(0, fixtures.indexOf(googleTexasAiExpansionWorkspace));
  const [selectedFixtureIndex, setSelectedFixtureIndex] = useState(defaultFixtureIndex);
  const workspace = fixtures[selectedFixtureIndex] ?? googleTexasAiExpansionWorkspace;

  return (
    <section className="dal-workspace wide">
      <div className="dal-workspace-header">
        <div>
          <h2>Opportunity</h2>
          <p>Customer, opportunity, Translate, Scope Review, Prism, and Quote status composed into one read-only cockpit.</p>
        </div>
        <select value={selectedFixtureIndex} onChange={(event) => setSelectedFixtureIndex(Number(event.currentTarget.value))} aria-label="Opportunity fixture">
          {fixtures.map((item, index) => (
            <option key={`${item.summary.opportunityId}-${index}`} value={index}>
              {fixtureLabel(item)}
            </option>
          ))}
        </select>
      </div>

      <OpportunityHeader workspace={workspace} />

      <div className="dal-grid">
        <OpportunityNextActionPanel workspace={workspace} />
        <section className="dal-panel">
          <h3>Baseline Network</h3>
          <div className="opportunity-facts">
            <span>Status</span>
            <b>{workspace.stageContext.baselineNetwork?.status ?? "Not synthesized"}</b>
            <span>Architecture</span>
            <b>{workspace.stageContext.baselineNetwork?.referenceArchitecture ?? "Not selected"}</b>
            <span>Object Count</span>
            <b>{workspace.stageContext.baselineNetwork?.candidateObjects.length ?? 0}</b>
            <span>Scope Review</span>
            <b>{workspace.stageContext.scopeReviewStatus ?? "Not started"}</b>
            <span>Prism</span>
            <b>{workspace.stageContext.prismStatus ?? "Not started"}</b>
            <span>Quote</span>
            <b>{workspace.stageContext.preliminaryQuoteStatus ?? "Not started"}</b>
          </div>
        </section>
      </div>

      <OpportunitySummaryPanel workspace={workspace} />
      <OpportunityWorkflowPanel workspace={workspace} />
      <OpportunityDiagnosticsPanel workspace={workspace} />
    </section>
  );
}
