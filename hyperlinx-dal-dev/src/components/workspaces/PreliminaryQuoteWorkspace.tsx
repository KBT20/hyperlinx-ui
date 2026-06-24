import { useMemo, useState } from "react";
import {
  preliminaryQuoteWorkspaceFixtures,
  readyForCustomerDiscussionQuoteWorkspace,
} from "../../quote/fixtures/preliminaryQuoteWorkspaceFixtures";
import type { PreliminaryQuoteWorkspace as PreliminaryQuoteWorkspaceModel } from "../../quote/PreliminaryQuoteWorkspace";
import QuoteAssumptionPanel from "./quote/QuoteAssumptionPanel";
import QuoteConfidencePanel from "./quote/QuoteConfidencePanel";
import QuoteDiagnosticsPanel from "./quote/QuoteDiagnosticsPanel";
import QuoteProductPanel from "./quote/QuoteProductPanel";
import QuoteSummaryPanel from "./quote/QuoteSummaryPanel";

function fixtureLabel(workspace: PreliminaryQuoteWorkspaceModel) {
  return `${workspace.summary.customerName} · ${workspace.summary.opportunityName} · ${workspace.summary.readiness}`;
}

export default function PreliminaryQuoteWorkspace() {
  const fixtures = useMemo(() => preliminaryQuoteWorkspaceFixtures, []);
  const defaultIndex = Math.max(0, fixtures.indexOf(readyForCustomerDiscussionQuoteWorkspace));
  const [selectedFixtureIndex, setSelectedFixtureIndex] = useState(defaultIndex);
  const workspace = fixtures[selectedFixtureIndex] ?? readyForCustomerDiscussionQuoteWorkspace;

  return (
    <section className="dal-workspace wide">
      <div className="dal-workspace-header">
        <div>
          <h2>Preliminary Quote</h2>
          <p>Advisory commercial recommendation assembled from opportunity, Prism, and marketplace fixture context.</p>
        </div>
        <select value={selectedFixtureIndex} onChange={(event) => setSelectedFixtureIndex(Number(event.currentTarget.value))} aria-label="Preliminary quote fixture">
          {fixtures.map((item, index) => (
            <option key={`${item.summary.opportunityId}-${index}`} value={index}>
              {fixtureLabel(item)}
            </option>
          ))}
        </select>
      </div>

      <div className="dal-grid">
        <QuoteSummaryPanel workspace={workspace} />
        <QuoteConfidencePanel workspace={workspace} />
      </div>

      <QuoteProductPanel workspace={workspace} />
      <QuoteAssumptionPanel workspace={workspace} />
      <section className="dal-panel">
        <div className="dal-panel-title-row">
          <h3>Next Action</h3>
          <span className="dal-badge warning">Visual only</span>
        </div>
        <div className="opportunity-next-action-label">{workspace.summary.nextAction.replaceAll("_", " ")}</div>
        <p>Quote output is preliminary, non-contractual, and requires human decision plus engineering validation.</p>
        <button type="button" disabled>
          Prepare Customer Discussion
        </button>
      </section>
      <QuoteDiagnosticsPanel workspace={workspace} />
    </section>
  );
}
