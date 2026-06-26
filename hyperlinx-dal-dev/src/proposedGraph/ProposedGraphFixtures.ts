import { designLaunchFixtureResults } from "../design/fixtures/designLaunchFixtures";
import { createProposedGraph } from "./ProposedGraphEngine";
import type { ProposedGraph } from "./ProposedGraph";

export interface ProposedGraphFixture {
  fixtureId: string;
  title: string;
  proposedGraph: ProposedGraph | null;
}

function buildProposedGraphFixture(index: number): ProposedGraphFixture {
  const result = designLaunchFixtureResults[index];
  if (!result?.session) {
    return {
      fixtureId: `PG-BLOCKED-${index}`,
      title: "Blocked ProposedGraph",
      proposedGraph: null,
    };
  }
  const proposedGraph = createProposedGraph(result.session);
  return {
    fixtureId: proposedGraph.proposedGraphId,
    title: `${proposedGraph.customerName} - ${proposedGraph.opportunityName}`,
    proposedGraph,
  };
}

export const proposedGraphFixtures = Object.freeze(designLaunchFixtureResults.map((_, index) => buildProposedGraphFixture(index)));
export const googleTexasAiProposedGraphFixture = proposedGraphFixtures[0];
export const austinMetroProposedGraphFixture = proposedGraphFixtures[1];
export const carrierMiddleMileProposedGraphFixture = proposedGraphFixtures[2];
export const blockedProposedGraphFixture = proposedGraphFixtures[3];

export function evaluateProposedGraphFixtures() {
  return proposedGraphFixtures;
}
