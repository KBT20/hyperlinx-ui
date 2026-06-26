import { designLaunchFixtureResults } from "../../design/fixtures/designLaunchFixtures";
import { generateFixtureStationedCorridor } from "../CorridorGenerationEngine";
import type { StationedCorridor } from "../StationedCorridor";

export interface StationedCorridorFixture {
  fixtureId: string;
  title: string;
  stationedCorridor: StationedCorridor | null;
}

function buildFixture(index: number): StationedCorridorFixture {
  const result = designLaunchFixtureResults[index];
  if (!result?.session) {
    return {
      fixtureId: `SC-BLOCKED-${index}`,
      title: "Blocked Stationed Corridor",
      stationedCorridor: null,
    };
  }
  const stationedCorridor = generateFixtureStationedCorridor(result.session);
  return {
    fixtureId: stationedCorridor.stationedCorridorId,
    title: `${result.session.customerName} - ${result.session.opportunityName}`,
    stationedCorridor,
  };
}

export const stationedCorridorFixtures = Object.freeze(designLaunchFixtureResults.map((_, index) => buildFixture(index)));
export const googleTexasAiStationedCorridorFixture = stationedCorridorFixtures[0];
