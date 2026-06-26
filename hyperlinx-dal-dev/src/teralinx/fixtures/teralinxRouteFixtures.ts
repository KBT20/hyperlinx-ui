import type { TeralinxRouteIntakeInput } from "../TeralinxRouteIntake";
import { buildTeralinxRouteIntake } from "../TeralinxRouteIntakeEngine";

const evaluatedAt = "2026-06-25T00:00:00.000Z";

export const teralinxRouteFixtureInputs: readonly TeralinxRouteIntakeInput[] = Object.freeze([
  {
    routeRequestId: "TLX-ROUTE-GOOGLE-TX-AI",
    customer: {
      customerMode: "EXISTING_CUSTOMER",
      existingCustomerId: "CUST-GOOGLE",
      company: "Google",
      primaryContact: "Google Network Planner",
      market: "Texas AI Corridor",
      notes: "Customer requests preliminary Layer 1 corridor design intake.",
    },
    opportunity: {
      opportunityName: "Google Texas AI Route",
      customer: "Google",
      market: "Texas",
      targetCompletion: "2027-03-31",
      internalOwner: "Design Desk",
      salesOwner: "Ryan",
    },
    siteList: [
      {
        siteId: "SITE-GOOGLE-TX-A",
        role: "A_SITE",
        facilityName: "Dallas Interconnect",
        address: "1950 N Stemmons Fwy, Dallas, TX",
      },
      {
        siteId: "SITE-GOOGLE-TX-Z",
        role: "Z_SITE",
        facilityName: "Texas AI Campus",
        address: "Temple, TX",
      },
    ],
    intent: {
      networkType: "LONG_HAUL",
      protection: "PATH_PROTECTED",
      primaryProduct: "DUCT_PLUS_FIBER",
    },
    evaluatedAt,
  },
  {
    routeRequestId: "TLX-ROUTE-METRO-AUSTIN",
    customer: {
      customerMode: "NEW_CUSTOMER",
      company: "Austin Enterprise Customer",
      primaryContact: "Facilities Lead",
      market: "Austin",
      notes: "Metro access route request.",
    },
    opportunity: {
      opportunityName: "Austin Metro Access",
      customer: "Austin Enterprise Customer",
      market: "Austin",
      targetCompletion: "2026-11-15",
      internalOwner: "Metro Design",
      salesOwner: "Ryan",
    },
    siteList: [
      {
        siteId: "SITE-AUSTIN-A",
        role: "A_SITE",
        facilityName: "Austin POP",
        latitude: 30.2672,
        longitude: -97.7431,
      },
      {
        siteId: "SITE-AUSTIN-Z",
        role: "Z_SITE",
        facilityName: "Customer HQ",
        address: "611 Walker St, Austin, TX",
      },
      {
        siteId: "SITE-AUSTIN-I1",
        role: "INTERMEDIATE_SITE",
        facilityName: "Optional Aggregation Site",
        address: "Downtown Austin, TX",
      },
    ],
    intent: {
      networkType: "METRO",
      protection: "RING_PROTECTED",
      primaryProduct: "FIBER",
    },
    evaluatedAt,
  },
  {
    routeRequestId: "TLX-ROUTE-CARRIER-MIDDLE-MILE",
    customer: {
      customerMode: "EXISTING_CUSTOMER",
      existingCustomerId: "CUST-CARRIER",
      company: "Carrier Long Haul Customer",
      primaryContact: "Wholesale Planner",
      market: "Oklahoma/Texas",
    },
    opportunity: {
      opportunityName: "Middle Mile Protected Build",
      customer: "Carrier Long Haul Customer",
      market: "North Texas",
      targetCompletion: "2027-06-30",
      internalOwner: "Carrier Design",
      salesOwner: "Ryan",
    },
    siteList: [
      {
        siteId: "SITE-CARRIER-A",
        role: "A_SITE",
        facilityName: "Carrier POP A",
        address: "Wichita Falls, TX",
      },
      {
        siteId: "SITE-CARRIER-Z",
        role: "Z_SITE",
        facilityName: "Carrier POP Z",
        address: "Lawton, OK",
      },
    ],
    intent: {
      networkType: "MIDDLE_MILE",
      protection: "PATH_PROTECTED",
      primaryProduct: "DUCT",
    },
    evaluatedAt,
  },
  {
    routeRequestId: "TLX-ROUTE-BLOCKED",
    customer: {
      customerMode: "NEW_CUSTOMER",
      company: "",
      primaryContact: "",
      market: "",
    },
    opportunity: {
      opportunityName: "",
      customer: "",
      market: "",
      internalOwner: "",
      salesOwner: "Ryan",
    },
    siteList: [
      {
        siteId: "SITE-BLOCKED-A",
        role: "A_SITE",
        facilityName: "A Site",
      },
    ],
    intent: {},
    evaluatedAt,
  },
]);

export const teralinxRouteFixtures = Object.freeze(teralinxRouteFixtureInputs.map(buildTeralinxRouteIntake));

export const googleTexasAiTeralinxRoute = teralinxRouteFixtures[0];
export const austinMetroTeralinxRoute = teralinxRouteFixtures[1];
export const carrierMiddleMileTeralinxRoute = teralinxRouteFixtures[2];
export const blockedTeralinxRoute = teralinxRouteFixtures[3];

export function evaluateTeralinxRouteFixtures() {
  return teralinxRouteFixtures;
}
