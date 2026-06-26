import { proposedGraphFixtures } from "../../proposedGraph/ProposedGraphFixtures";
import type { ProposedGraph } from "../../proposedGraph/ProposedGraph";
import { createPreliminaryQuotePackageFromGraph, createProposedInventoryFromGraph } from "../ProposalGenerationEngine";
import type { PreliminaryQuotePackage } from "../PreliminaryQuotePackage";
import type { ProposedInventory } from "../ProposedInventory";

export interface ProposalFixture {
  fixtureId: string;
  title: string;
  proposedGraph: ProposedGraph | null;
  proposedInventory: ProposedInventory | null;
  preliminaryQuotePackage: PreliminaryQuotePackage | null;
}

function buildProposalFixture(index: number): ProposalFixture {
  const graphFixture = proposedGraphFixtures[index];
  const proposedGraph = graphFixture?.proposedGraph ?? null;
  if (!proposedGraph) {
    return {
      fixtureId: `PROPOSAL-BLOCKED-${index}`,
      title: "Blocked Proposal",
      proposedGraph,
      proposedInventory: null,
      preliminaryQuotePackage: null,
    };
  }

  const proposedInventory = createProposedInventoryFromGraph(proposedGraph);
  const preliminaryQuotePackage = createPreliminaryQuotePackageFromGraph(proposedGraph);

  return {
    fixtureId: proposedInventory.proposalId,
    title: `${proposedGraph.customerName} - ${proposedGraph.opportunityName}`,
    proposedGraph,
    proposedInventory,
    preliminaryQuotePackage,
  };
}

export const proposalFixtures = Object.freeze(proposedGraphFixtures.map((_, index) => buildProposalFixture(index)));
export const googleTexasAiProposalFixture = proposalFixtures[0];
export const austinMetroProposalFixture = proposalFixtures[1];
export const carrierMiddleMileProposalFixture = proposalFixtures[2];
export const blockedProposalFixture = proposalFixtures[3];

export function evaluateProposalFixtures() {
  return proposalFixtures;
}
