import { useMemo, useState } from "react";
import { useDALState } from "../../dal/DALState";
import { createEngineeringHandoffCandidate, createPreliminaryQuotePackageFromGraph, createProposedInventoryFromGraph } from "../../proposal/ProposalGenerationEngine";
import { googleTexasAiProposalFixture, proposalFixtures, type ProposalFixture } from "../../proposal/fixtures/proposalFixtures";
import type { EngineeringHandoffCandidate, PreliminaryQuotePackage } from "../../proposal/PreliminaryQuotePackage";
import type { ProposedInventory } from "../../proposal/ProposedInventory";
import type { QuoteReadiness } from "../../proposal/QuoteReadiness";
import type { ProposedGraph } from "../../proposedGraph/ProposedGraph";
import { approveProposedGraphForEngineering } from "../../proposedGraph/ProposedGraphEngine";
import ProposalAssumptionsPanel from "./proposal/ProposalAssumptionsPanel";
import ProposalConfidencePanel from "./proposal/ProposalConfidencePanel";
import ProposalLineItemsPanel from "./proposal/ProposalLineItemsPanel";
import ProposalReadinessPanel from "./proposal/ProposalReadinessPanel";
import ProposalSummaryPanel from "./proposal/ProposalSummaryPanel";

type CustomerDecision = "PENDING" | "ACCEPTED" | "DECLINED";

function fixtureLabel(fixture: ProposalFixture) {
  return fixture.title;
}

export default function PreliminaryProposalWorkspace() {
  const { selectedProposedGraph, setSelectedProposedGraph, setWorkspace } = useDALState();
  const fixtures = useMemo(() => proposalFixtures, []);
  const defaultFixture = selectedProposedGraph ? fixtures.find((item) => item.proposedGraph?.proposedGraphId === selectedProposedGraph.proposedGraphId) ?? googleTexasAiProposalFixture : googleTexasAiProposalFixture;
  const defaultIndex = Math.max(0, fixtures.indexOf(defaultFixture));
  const [selectedFixtureIndex, setSelectedFixtureIndex] = useState(defaultIndex);
  const [quotePackage, setQuotePackage] = useState<PreliminaryQuotePackage | null>(null);
  const [customerDecision, setCustomerDecision] = useState<CustomerDecision>("PENDING");
  const [handoffCandidate, setHandoffCandidate] = useState<EngineeringHandoffCandidate | null>(null);
  const fixture = fixtures[selectedFixtureIndex] ?? googleTexasAiProposalFixture;
  const activeGraph: ProposedGraph | null = selectedProposedGraph ?? fixture.proposedGraph;
  const activeInventory: ProposedInventory | null = useMemo(() => (activeGraph ? createProposedInventoryFromGraph(activeGraph) : fixture.proposedInventory), [activeGraph, fixture.proposedInventory]);

  function handleFixtureChange(index: number) {
    const nextFixture = fixtures[index] ?? googleTexasAiProposalFixture;
    setSelectedFixtureIndex(index);
    setSelectedProposedGraph(nextFixture.proposedGraph);
    setQuotePackage(null);
    setCustomerDecision("PENDING");
    setHandoffCandidate(null);
  }

  function handleGenerateQuote() {
    setQuotePackage(activeGraph ? createPreliminaryQuotePackageFromGraph(activeGraph) : fixture.preliminaryQuotePackage);
    setCustomerDecision("PENDING");
    setHandoffCandidate(null);
  }

  function handleCustomerAccepted() {
    if (!quotePackage || !activeGraph) return;
    const approvedGraph = approveProposedGraphForEngineering(activeGraph);
    const approvedInventory = createProposedInventoryFromGraph(approvedGraph);
    setSelectedProposedGraph(approvedGraph);
    setCustomerDecision("ACCEPTED");
    setHandoffCandidate(
      createEngineeringHandoffCandidate({
        quotePackage,
        proposedInventory: approvedInventory,
        proposalAccepted: true,
      }),
    );
  }

  function handleCustomerDeclined() {
    if (!quotePackage || !activeInventory) return;
    setCustomerDecision("DECLINED");
    setHandoffCandidate(
      createEngineeringHandoffCandidate({
        quotePackage,
        proposedInventory: activeInventory,
        proposalAccepted: false,
      }),
    );
  }

  const readiness: QuoteReadiness = customerDecision === "ACCEPTED" ? "CUSTOMER_ACCEPTED" : customerDecision === "DECLINED" ? "CUSTOMER_DECLINED" : quotePackage?.readiness ?? "NOT_READY";
  const canSendToRouteEngineering = customerDecision === "ACCEPTED" && Boolean(handoffCandidate);

  return (
    <section className="dal-workspace wide">
      <div className="dal-workspace-header">
        <div>
          <h2>Preliminary Proposal</h2>
          <p>Sales-facing proposed inventory and preliminary quote package before Route Engineering certification.</p>
        </div>
        <select value={selectedFixtureIndex} onChange={(event) => handleFixtureChange(Number(event.currentTarget.value))} aria-label="Preliminary proposal fixture">
          {fixtures.map((item, index) => (
            <option key={item.fixtureId} value={index}>
              {fixtureLabel(item)}
            </option>
          ))}
        </select>
      </div>

      <ProposalSummaryPanel fixture={fixture} proposedGraph={activeGraph} proposedInventory={activeInventory} quotePackage={quotePackage} />

      <div className="dal-grid">
        <ProposalConfidencePanel quotePackage={quotePackage} />
        <ProposalReadinessPanel quotePackage={quotePackage} readiness={readiness} handoffCandidate={handoffCandidate} />
      </div>

      <ProposalLineItemsPanel quotePackage={quotePackage} />
      <ProposalAssumptionsPanel quotePackage={quotePackage} />

      <section className="dal-panel">
        <div className="dal-panel-title-row">
          <h3>Actions</h3>
          <span className="dal-badge warning">Sales estimate only</span>
        </div>
        <div className="dal-actions">
          <button type="button" disabled={!activeGraph} onClick={handleGenerateQuote}>
            Generate Preliminary Quote
          </button>
          <button type="button" disabled title="Placeholder only. Export is intentionally not implemented in Phase 6.9C.">
            Export Proposal
          </button>
          <button type="button" disabled={!quotePackage || quotePackage.readiness === "BLOCKED"} onClick={handleCustomerAccepted}>
            Customer Accepted ProposedGraph
          </button>
          <button type="button" disabled={!quotePackage || quotePackage.readiness === "BLOCKED"} onClick={handleCustomerDeclined}>
            Customer Declined ProposedGraph
          </button>
          <button type="button" disabled={!canSendToRouteEngineering} onClick={() => setWorkspace("routeEngineering")}>
            Send to Route Engineering
          </button>
        </div>
        <div className="dal-status">
          No engineering work is created here. Route Engineering navigation is available only after Customer Accepted and remains a handoff candidate.
        </div>
      </section>
    </section>
  );
}
