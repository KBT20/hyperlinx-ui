import type { CorridorObjectType } from "../CorridorObjectCatalog";
import { enrichCorridorCandidate } from "../EvidenceEnrichmentEngine";
import type { PrismScore } from "../PrismScoreContract";
import { scoreEnrichedCorridorCandidate, type PrismScoringInput } from "../PrismScoringEngine";
import {
  aiFabricEnrichmentFixture,
  backboneEnrichmentFixture,
  interconnectionEnrichmentFixture,
  metroAggregationEnrichmentFixture,
} from "./enrichmentFixtures";

export interface PrismScoringFixture {
  fixtureId: string;
  label: string;
  input: PrismScoringInput;
  expectedStrongCategories: string[];
}

const dallasKansasCityBackboneObjects: CorridorObjectType[] = [
  "BACKBONE_NODE",
  "POP",
  "REGEN_SITE",
  "ADM_SITE",
  "TRANSMISSION_LINE",
  "SUBSTATION",
  "JURISDICTION",
  "CROSSING",
  "RESTORATION_ZONE",
  "TRANSPORT_OPPORTUNITY",
];

const westTexasAiObjects: CorridorObjectType[] = [
  "SUBSTATION",
  "TRANSMISSION_LINE",
  "GENERATION_SITE",
  "POWER_CORRIDOR",
  "DATA_CENTER",
  "PARCEL",
  "DEVELOPMENT_SITE",
  "CLOUD_ONRAMP",
  "EXPANSION_OPPORTUNITY",
];

const metroLsoObjects: CorridorObjectType[] = [
  "LSO",
  "CO",
  "WIRELESS_SITE",
  "AGGREGATION_NODE",
  "CONDUIT",
  "FIBER",
  "PARCEL",
  "JURISDICTION",
  "DUCT_OPPORTUNITY",
];

const carrierHotelInterconnectionObjects: CorridorObjectType[] = [
  "CARRIER_HOTEL",
  "IX",
  "CLOUD_ONRAMP",
  "MEET_ME_ROOM",
  "INTERCONNECT_FACILITY",
  "FIBER_PAIR",
  "VAULT",
  "TRANSPORT_OPPORTUNITY",
];

const dataCenterExpansionObjects: CorridorObjectType[] = [
  "DATA_CENTER",
  "SUBSTATION",
  "POWER_FEED",
  "PARCEL",
  "DEVELOPMENT_SITE",
  "UTILITY_EASEMENT",
  "EXPANSION_OPPORTUNITY",
  "FIBER",
  "CONDUIT",
];

export function createPrismScoringFixtures(): PrismScoringFixture[] {
  const backboneCandidate = enrichCorridorCandidate(backboneEnrichmentFixture);
  const aiCandidate = enrichCorridorCandidate(aiFabricEnrichmentFixture);
  const metroCandidate = enrichCorridorCandidate(metroAggregationEnrichmentFixture);
  const interconnectionCandidate = enrichCorridorCandidate(interconnectionEnrichmentFixture);
  const dataCenterExpansionCandidate = enrichCorridorCandidate({
    ...aiFabricEnrichmentFixture,
    candidate: {
      ...aiFabricEnrichmentFixture.candidate,
      candidateId: "score-data-center-expansion-candidate",
      corridorId: "score-data-center-expansion",
      name: "Data center expansion corridor",
    },
  });

  return [
    {
      fixtureId: "score-dallas-kansas-city-backbone",
      label: "Dallas to Kansas City Backbone",
      input: {
        enrichedCandidate: backboneCandidate,
        corridorObjects: dallasKansasCityBackboneObjects,
        objectConfidence: {
          BACKBONE_NODE: "HIGH",
          POP: "HIGH",
          REGEN_SITE: "MEDIUM",
          TRANSMISSION_LINE: "HIGH",
          SUBSTATION: "HIGH",
          CROSSING: "MEDIUM",
          JURISDICTION: "MEDIUM",
        },
      },
      expectedStrongCategories: ["INFRASTRUCTURE", "POWER", "STRATEGIC", "OPTIMIZATION", "COMMERCIAL"],
    },
    {
      fixtureId: "score-west-texas-ai",
      label: "West Texas AI Corridor",
      input: {
        enrichedCandidate: aiCandidate,
        corridorObjects: westTexasAiObjects,
        objectConfidence: {
          SUBSTATION: "HIGH",
          TRANSMISSION_LINE: "HIGH",
          GENERATION_SITE: "MEDIUM",
          POWER_CORRIDOR: "HIGH",
          DATA_CENTER: "HIGH",
          DEVELOPMENT_SITE: "MEDIUM",
          EXPANSION_OPPORTUNITY: "HIGH",
        },
      },
      expectedStrongCategories: ["POWER", "AI", "INTERCONNECTION", "STRATEGIC", "OPTIMIZATION"],
    },
    {
      fixtureId: "score-metro-lso",
      label: "Metro LSO Aggregation",
      input: {
        enrichedCandidate: metroCandidate,
        corridorObjects: metroLsoObjects,
        objectConfidence: {
          LSO: "VERIFIED",
          CO: "HIGH",
          AGGREGATION_NODE: "HIGH",
          CONDUIT: "MEDIUM",
          FIBER: "MEDIUM",
          DUCT_OPPORTUNITY: "MEDIUM",
        },
      },
      expectedStrongCategories: ["STRATEGIC", "COMMERCIAL", "INFRASTRUCTURE"],
    },
    {
      fixtureId: "score-carrier-hotel-interconnection",
      label: "Carrier Hotel Interconnection",
      input: {
        enrichedCandidate: interconnectionCandidate,
        corridorObjects: carrierHotelInterconnectionObjects,
        objectConfidence: {
          CARRIER_HOTEL: "HIGH",
          IX: "HIGH",
          CLOUD_ONRAMP: "HIGH",
          MEET_ME_ROOM: "MEDIUM",
          INTERCONNECT_FACILITY: "MEDIUM",
          TRANSPORT_OPPORTUNITY: "MEDIUM",
        },
      },
      expectedStrongCategories: ["INTERCONNECTION", "STRATEGIC", "COMMERCIAL"],
    },
    {
      fixtureId: "score-data-center-expansion",
      label: "Data Center Expansion",
      input: {
        enrichedCandidate: dataCenterExpansionCandidate,
        corridorObjects: dataCenterExpansionObjects,
        objectConfidence: {
          DATA_CENTER: "HIGH",
          SUBSTATION: "HIGH",
          POWER_FEED: "MEDIUM",
          DEVELOPMENT_SITE: "MEDIUM",
          EXPANSION_OPPORTUNITY: "MEDIUM",
          FIBER: "HIGH",
          CONDUIT: "HIGH",
        },
      },
      expectedStrongCategories: ["INFRASTRUCTURE", "POWER", "AI", "COMMERCIAL", "OPTIMIZATION"],
    },
  ];
}

export function evaluatePrismScoringFixtures(): PrismScore[] {
  return createPrismScoringFixtures().map((fixture) => scoreEnrichedCorridorCandidate(fixture.input));
}

