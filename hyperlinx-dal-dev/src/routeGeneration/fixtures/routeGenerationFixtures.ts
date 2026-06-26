import { designLaunchFixtureResults } from "../../design/fixtures/designLaunchFixtures";
import { generateRouteCandidate } from "../RouteGenerationEngine";

export const routeGenerationFixtures = Object.freeze(
  designLaunchFixtureResults.map((result) => (result.session ? generateRouteCandidate(result.session) : null)),
);

export const googleTexasAiRouteCandidateFixture = routeGenerationFixtures[0];
export const austinMetroRouteCandidateFixture = routeGenerationFixtures[1];
export const carrierMiddleMileRouteCandidateFixture = routeGenerationFixtures[2];

export function evaluateRouteGenerationFixtures() {
  return routeGenerationFixtures;
}
