import type { CorridorClass, CorridorNetworkRole } from "../corridorTypes";
import type { CorridorLensObjectType, CorridorLensType } from "../CorridorLens";
import type { ReferenceArchitectureFit, ReferenceArchitectureToolType, ReferenceArchitectureType } from "../CorridorReferenceArchitecture";
import { matchReferenceArchitectures } from "../CorridorReferenceArchitectureEngine";

export interface CorridorReferenceArchitectureFixture {
  fixtureId: string;
  label: string;
  customerAsk: string;
  lensTypes: CorridorLensType[];
  networkRoles: CorridorNetworkRole[];
  corridorClasses: CorridorClass[];
  availableObjectTypes: CorridorLensObjectType[];
  availableToolEvidence: ReferenceArchitectureToolType[];
  expectedArchitectureType: ReferenceArchitectureType;
  expectedReviewFocus: string[];
}

export const corridorReferenceArchitectureFixtures: readonly CorridorReferenceArchitectureFixture[] = Object.freeze([
  {
    fixtureId: "REF-FIXTURE-HYPERSCALER-LONG-HAUL",
    label: "Hyperscaler long-haul ask: Dallas to Kansas City",
    customerAsk: "Dallas to Kansas City 400G/800G ready route diversity future AI expansion data center interconnect",
    lensTypes: ["HYPERSCALER"],
    networkRoles: ["AI_FABRIC", "BACKBONE_INTERCONNECT"],
    corridorClasses: ["LONGHAUL", "AI_CORRIDOR"],
    availableObjectTypes: ["CONDUIT", "FIBER", "REGEN_SITE", "DATA_CENTER", "SUBSTATION", "TRANSMISSION_LINE", "CARRIER_HOTEL", "CLOUD_ONRAMP"],
    availableToolEvidence: ["DOT_GIS", "KML_KMZ_TRANSLATE", "SUBSTATION_PROVIDER", "TRANSMISSION_PROVIDER", "DATA_CENTER_PROVIDER", "OPTICAL_REACH_REVIEW"],
    expectedArchitectureType: "HYPERSCALER_LONG_HAUL",
    expectedReviewFocus: ["optical reach", "regen spacing", "route diversity", "power proximity", "restoration"],
  },
  {
    fixtureId: "REF-FIXTURE-HYPERSCALER-METRO",
    label: "Hyperscaler metro ask: data center to carrier hotel",
    customerAsk: "data center to carrier hotel inside same MSA with metro cloud access",
    lensTypes: ["HYPERSCALER"],
    networkRoles: ["METRO_AGGREGATION", "INTERCONNECTION"],
    corridorClasses: ["METRO", "INTERCONNECTION"],
    availableObjectTypes: ["CONDUIT", "FIBER", "DATA_CENTER", "CARRIER_HOTEL", "CLOUD_ONRAMP", "JURISDICTION"],
    availableToolEvidence: ["GEOJSON_TRANSLATE", "MUNICIPAL_GIS", "DATA_CENTER_PROVIDER", "CARRIER_HOTEL_PROVIDER", "CLOUD_ONRAMP_PROVIDER"],
    expectedArchitectureType: "HYPERSCALER_METRO",
    expectedReviewFocus: ["facility handoff", "jurisdiction review", "crossing plan", "maintenance access"],
  },
  {
    fixtureId: "REF-FIXTURE-NEOCLOUD-INTERCONNECT",
    label: "Neocloud interconnect ask: GPU array to cloud on-ramp",
    customerAsk: "GPU array to cloud on-ramp AI fabric low latency",
    lensTypes: ["NEOCLOUD"],
    networkRoles: ["AI_FABRIC", "INTERCONNECTION"],
    corridorClasses: ["AI_CORRIDOR", "INTERCONNECTION"],
    availableObjectTypes: ["GPU_ARRAY", "DATA_CENTER", "CARRIER_HOTEL", "IX", "CLOUD_ONRAMP", "FIBER", "POWER_FEED"],
    availableToolEvidence: ["DATA_CENTER_PROVIDER", "CARRIER_HOTEL_PROVIDER", "IX_PROVIDER", "CLOUD_ONRAMP_PROVIDER", "POWER_PROXIMITY_EVALUATION"],
    expectedArchitectureType: "NEOCLOUD_INTERCONNECT",
    expectedReviewFocus: ["GPU support", "cloud access", "interconnection density", "power dependency"],
  },
  {
    fixtureId: "REF-FIXTURE-DUCT-MONETIZATION",
    label: "Duct monetization ask: spare duct sale and maintenance",
    customerAsk: "spare duct sale maintenance responsibility residual capacity",
    lensTypes: ["DUCT_MONETIZATION"],
    networkRoles: ["METRO_AGGREGATION", "REGIONAL_AGGREGATION"],
    corridorClasses: ["METRO", "REGIONAL"],
    availableObjectTypes: ["CONDUIT", "INNERDUCT", "RIGHT_OF_WAY", "JURISDICTION"],
    availableToolEvidence: ["DUCT_CAPACITY_PLANNING", "RESIDUAL_CAPACITY_MODEL", "DUCT_SALE_MODEL", "MUNICIPAL_GIS"],
    expectedArchitectureType: "DUCT_SALE_AND_MAINTENANCE",
    expectedReviewFocus: ["spare duct accounting", "sale eligibility", "maintenance rights", "jurisdiction"],
  },
  {
    fixtureId: "REF-FIXTURE-DARK-FIBER-IRU",
    label: "Dark fiber IRU ask: fiber pair with diverse routing",
    customerAsk: "fiber pair IRU diverse route strand reservation",
    lensTypes: ["DARK_FIBER_IRU"],
    networkRoles: ["BACKBONE_INTERCONNECT", "INTERCONNECTION"],
    corridorClasses: ["LONGHAUL", "INTERCONNECTION"],
    availableObjectTypes: ["FIBER", "FIBER_PAIR", "SPLICE", "DATA_CENTER", "CARRIER_HOTEL", "BACKBONE_NODE"],
    availableToolEvidence: ["FIBER_COUNT_PLANNING", "DARK_FIBER_IRU_MODEL", "ROUTE_DIVERSITY_REVIEW", "DATA_CENTER_PROVIDER"],
    expectedArchitectureType: "DARK_FIBER_IRU",
    expectedReviewFocus: ["strand reservation", "IRU boundary", "handoff", "route diversity"],
  },
  {
    fixtureId: "REF-FIXTURE-TRANSPORT-WAVE",
    label: "Transport wave ask: protected wavelength service",
    customerAsk: "protected wavelength transport wave SLA optical service",
    lensTypes: ["TRANSPORT"],
    networkRoles: ["MSA_INTERCONNECT", "BACKBONE_INTERCONNECT"],
    corridorClasses: ["MIDDLE_MILE", "LONGHAUL"],
    availableObjectTypes: ["REGEN_SITE", "ADM_SITE", "POP", "DATA_CENTER", "CARRIER_HOTEL"],
    availableToolEvidence: ["OPTICAL_REACH_REVIEW", "REGEN_SPACING_REVIEW", "ADM_PLACEMENT_REVIEW", "RESTORATION_REVIEW"],
    expectedArchitectureType: "TRANSPORT_WAVE",
    expectedReviewFocus: ["optical reach", "ADM placement", "regen placement", "SLA restoration"],
  },
  {
    fixtureId: "REF-FIXTURE-ENTERPRISE-METRO",
    label: "Enterprise metro access ask: enterprise building lateral",
    customerAsk: "enterprise building lateral commercial serviceability building entry",
    lensTypes: ["ENTERPRISE"],
    networkRoles: ["METRO_AGGREGATION"],
    corridorClasses: ["METRO"],
    availableObjectTypes: ["ENTERPRISE_BUILDING", "CONDUIT", "FIBER", "PARCEL", "JURISDICTION"],
    availableToolEvidence: ["CSV_TRANSLATE", "PARCEL_GIS", "MUNICIPAL_GIS", "ENTERPRISE_MONETIZATION_MODEL"],
    expectedArchitectureType: "ENTERPRISE_METRO_ACCESS",
    expectedReviewFocus: ["building entry", "lateral constructability", "service availability", "maintenance"],
  },
  {
    fixtureId: "REF-FIXTURE-AI-POWER-EXPANSION",
    label: "AI power expansion ask: West Texas footprint to Dallas",
    customerAsk: "West Texas data center footprint to Dallas power-adjacent land future AI campus",
    lensTypes: ["POWER_AI_EXPANSION"],
    networkRoles: ["AI_FABRIC", "REGIONAL_AGGREGATION"],
    corridorClasses: ["AI_CORRIDOR", "REGIONAL"],
    availableObjectTypes: ["SUBSTATION", "TRANSMISSION_LINE", "GENERATION_SITE", "PARCEL", "DEVELOPMENT_SITE", "FIBER"],
    availableToolEvidence: ["SUBSTATION_PROVIDER", "TRANSMISSION_PROVIDER", "PARCEL_GIS", "POWER_PROXIMITY_EVALUATION"],
    expectedArchitectureType: "AI_POWER_EXPANSION",
    expectedReviewFocus: ["power capacity evidence", "parcel suitability", "fiber route context", "future campus expansion"],
  },
]);

export function evaluateCorridorReferenceArchitectureFixtures(): ReferenceArchitectureFit[][] {
  return corridorReferenceArchitectureFixtures.map((fixture) =>
    matchReferenceArchitectures({
      lensTypes: fixture.lensTypes,
      networkRoles: fixture.networkRoles,
      corridorClasses: fixture.corridorClasses,
      customerAsk: fixture.customerAsk,
      availableObjectTypes: fixture.availableObjectTypes,
      availableToolEvidence: fixture.availableToolEvidence,
    }),
  );
}
