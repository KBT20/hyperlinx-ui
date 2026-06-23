import type { CorridorNetworkRole } from "../../corridor/corridorTypes";
import { getProvidersForRole } from "../ProviderRegistry";

export interface ProviderSelectionFixture {
  fixtureId: string;
  label: string;
  role: CorridorNetworkRole;
  expectedProviderTypes: string[];
  notes: string;
}

export interface ProviderSelectionFixtureResult extends ProviderSelectionFixture {
  selectedProviderIds: string[];
  selectedProviderTypes: string[];
  selectedCapabilities: string[];
}

export const providerSelectionFixtures: ProviderSelectionFixture[] = [
  {
    fixtureId: "provider-fixture-metro",
    label: "Metro aggregation corridor",
    role: "METRO_AGGREGATION",
    expectedProviderTypes: ["MUNICIPAL_GIS", "PARCEL_PROVIDER", "UTILITY_GIS", "DATA_CENTER_PROVIDER", "CARRIER_HOTEL_PROVIDER"],
    notes: "Metro aggregation prefers municipal, parcel, utility, building/interconnection evidence.",
  },
  {
    fixtureId: "provider-fixture-msa-interconnect",
    label: "MSA interconnect corridor",
    role: "MSA_INTERCONNECT",
    expectedProviderTypes: ["DOT_GIS", "COUNTY_GIS", "UTILITY_GIS", "TRANSMISSION_PROVIDER"],
    notes: "MSA interconnect emphasizes DOT, county, utility, and transmission evidence.",
  },
  {
    fixtureId: "provider-fixture-backbone",
    label: "Backbone interconnect corridor",
    role: "BACKBONE_INTERCONNECT",
    expectedProviderTypes: ["DOT_GIS", "TRANSMISSION_PROVIDER", "GENERATION_PROVIDER", "CARRIER_HOTEL_PROVIDER"],
    notes: "Backbone interconnect emphasizes longhaul transport and regional infrastructure evidence.",
  },
  {
    fixtureId: "provider-fixture-ai",
    label: "AI fabric corridor",
    role: "AI_FABRIC",
    expectedProviderTypes: [
      "SUBSTATION_PROVIDER",
      "TRANSMISSION_PROVIDER",
      "GENERATION_PROVIDER",
      "DATA_CENTER_PROVIDER",
      "CARRIER_HOTEL_PROVIDER",
      "CLOUD_ONRAMP_PROVIDER",
      "PARCEL_PROVIDER",
    ],
    notes: "AI fabric emphasizes power, compute, data center, cloud on-ramp, carrier hotel, and parcel evidence.",
  },
];

export function evaluateProviderSelectionFixtures(): ProviderSelectionFixtureResult[] {
  return providerSelectionFixtures.map((fixture) => {
    const providers = getProvidersForRole(fixture.role);
    return {
      ...fixture,
      selectedProviderIds: providers.map((provider) => provider.providerId),
      selectedProviderTypes: providers.map((provider) => provider.providerType),
      selectedCapabilities: [...new Set(providers.flatMap((provider) => provider.capabilities))],
    };
  });
}

