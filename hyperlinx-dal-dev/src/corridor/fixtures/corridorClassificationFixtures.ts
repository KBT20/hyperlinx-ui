import {
  classifyCorridorRole,
  type CorridorClassificationInput,
  type CorridorClassificationResult,
} from "../CorridorClassificationEngine";

export const corridorClassificationFixtures: CorridorClassificationInput[] = [
  {
    corridorId: "fixture-metro-26-lso",
    corridorName: "165-mile 12-duct 26 LSO single-MSA metro aggregation",
    endpointLabels: ["LSO 01", "LSO 26", "central office aggregation"],
    objectLabels: ["12-duct system", "26 LSO sites", "carrier hotel", "municipal aggregation"],
    serviceIntent: "aggregate local serving offices across one metro area",
    distanceMiles: 165,
    msaContext: {
      aMsa: "Dallas-Fort Worth-Arlington, TX",
      zMsa: "Dallas-Fort Worth-Arlington, TX",
      sameMsa: true,
    },
    evidenceIds: ["evidence-fixture-metro-lso"],
  },
  {
    corridorId: "fixture-dallas-fort-worth",
    corridorName: "Dallas to Fort Worth MSA interconnect",
    endpointLabels: ["Dallas metro edge", "Fort Worth metro edge"],
    objectLabels: ["middle-mile fiber", "regional aggregation"],
    serviceIntent: "connect adjacent MSA endpoints",
    distanceMiles: 32,
    msaContext: {
      aMsa: "Dallas, TX",
      zMsa: "Fort Worth, TX",
    },
    evidenceIds: ["evidence-fixture-dfw-interconnect"],
  },
  {
    corridorId: "fixture-dallas-kansas-city",
    corridorName: "Dallas to Kansas City backbone",
    endpointLabels: ["Dallas regional POP", "Kansas City carrier hotel"],
    objectLabels: ["transport backbone", "DWDM", "wave service"],
    serviceIntent: "long haul intercity transport backbone",
    distanceMiles: 508,
    msaContext: {
      aMsa: "Dallas-Fort Worth-Arlington, TX",
      zMsa: "Kansas City, MO-KS",
    },
    evidenceIds: ["evidence-fixture-dallas-kc-backbone"],
  },
  {
    corridorId: "fixture-west-texas-ai-dallas",
    corridorName: "West Texas data center footprint to Dallas AI fabric",
    customerType: "HYPERSCALER",
    endpointTypes: ["GPU_FACILITY", "DATA_CENTER"],
    endpointLabels: ["West Texas AI compute campus", "Dallas carrier hotel"],
    objectLabels: ["substation proximity", "transmission", "GPU", "neocloud"],
    serviceIntent: "AI fabric connection with power-proximate compute footprint",
    distanceMiles: 291,
    msaContext: {
      aMsa: "West Texas",
      zMsa: "Dallas-Fort Worth-Arlington, TX",
    },
    evidenceIds: ["evidence-fixture-ai-middle-mile"],
  },
  {
    corridorId: "fixture-campus-dc-buildings",
    corridorName: "Campus data center building interconnect",
    endpointTypes: ["DATA_CENTER", "DATA_CENTER"],
    endpointLabels: ["Building A MMR", "Building B MMR"],
    objectLabels: ["campus distribution", "meet-me room", "facility entrance"],
    serviceIntent: "connect buildings inside one data center campus",
    distanceMiles: 0.8,
    msaContext: {
      aMsa: "Austin-Round Rock-Georgetown, TX",
      zMsa: "Austin-Round Rock-Georgetown, TX",
      sameMsa: true,
    },
    evidenceIds: ["evidence-fixture-campus"],
  },
  {
    corridorId: "fixture-cloud-onramp-carrier-hotel",
    corridorName: "Cloud on-ramp / carrier hotel interconnection",
    endpointTypes: ["CLOUD_ONRAMP", "CARRIER_HOTEL"],
    endpointLabels: ["Cloud on-ramp", "carrier hotel meet-me room"],
    objectLabels: ["cross connect", "handoff", "IX"],
    serviceIntent: "cloud on-ramp interconnection handoff",
    distanceMiles: 2.1,
    msaContext: {
      aMsa: "Dallas-Fort Worth-Arlington, TX",
      zMsa: "Dallas-Fort Worth-Arlington, TX",
      sameMsa: true,
    },
    evidenceIds: ["evidence-fixture-cloud-interconnection"],
  },
];

export function evaluateCorridorClassificationFixtures(): CorridorClassificationResult[] {
  return corridorClassificationFixtures.map((fixture) => classifyCorridorRole(fixture));
}
