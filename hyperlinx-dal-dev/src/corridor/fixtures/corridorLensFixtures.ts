import type { CorridorLensApplication, CorridorLensType } from "../CorridorLens";
import { applyCorridorLens } from "../CorridorLensRegistry";

export interface CorridorLensFixture {
  fixtureId: string;
  corridorLabel: string;
  lensType: CorridorLensType;
  unchangedCorridorTruth: string;
  application: CorridorLensApplication;
}

function fixture(fixtureId: string, corridorLabel: string, lensType: CorridorLensType): CorridorLensFixture {
  return {
    fixtureId,
    corridorLabel,
    lensType,
    unchangedCorridorTruth: "The corridor geometry, evidence, and authority do not change. Only lens priorities change.",
    application: applyCorridorLens(lensType),
  };
}

export const corridorLensFixtures: CorridorLensFixture[] = [
  fixture("lens-dallas-kansas-city-hyperscaler", "Dallas to Kansas City corridor", "HYPERSCALER"),
  fixture("lens-dallas-kansas-city-transport", "Dallas to Kansas City corridor", "TRANSPORT"),
  fixture("lens-dallas-kansas-city-duct", "Dallas to Kansas City corridor", "DUCT_MONETIZATION"),
  fixture("lens-metro-lso-enterprise", "Metro LSO aggregation corridor", "ENTERPRISE"),
  fixture("lens-west-texas-ai-power", "West Texas AI corridor", "POWER_AI_EXPANSION"),
];

export function evaluateCorridorLensFixtures(): CorridorLensFixture[] {
  return corridorLensFixtures;
}

