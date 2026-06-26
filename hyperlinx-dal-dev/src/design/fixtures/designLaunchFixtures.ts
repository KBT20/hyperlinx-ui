import { teralinxRouteFixtures } from "../../teralinx/fixtures/teralinxRouteFixtures";
import { buildDesignLaunchRequestFromRouteRequest, createDesignLaunchSession } from "../DesignLaunchEngine";

export const designLaunchFixtureRequests = Object.freeze(
  teralinxRouteFixtures.map((intake) => buildDesignLaunchRequestFromRouteRequest(intake.routeRequest)),
);

export const designLaunchFixtureResults = Object.freeze(designLaunchFixtureRequests.map(createDesignLaunchSession));
export const googleTexasAiDesignLaunchResult = designLaunchFixtureResults[0];
export const blockedDesignLaunchResult = designLaunchFixtureResults[3];
