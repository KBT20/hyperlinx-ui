import { CORRIDOR_OBJECT_CATALOG } from "./CorridorObjectCatalog";
import type {
  CorridorLensApplication,
  CorridorLensDefinition,
  CorridorLensDiagnostic,
  CorridorLensObjectPriority,
  CorridorLensObjectType,
  CorridorLensProviderPriority,
  CorridorLensScoringPriority,
  CorridorLensType,
} from "./CorridorLens";
import type { PrismScoreCategory } from "./PrismScoreContract";

const CANONICAL_OBJECT_TYPES = new Set<string>(CORRIDOR_OBJECT_CATALOG.map((definition) => definition.objectType));

function diagnostic(input: {
  code: CorridorLensDiagnostic["code"];
  lensType?: CorridorLensType;
  message: string;
  severity?: CorridorLensDiagnostic["severity"];
  details?: Record<string, unknown>;
}): CorridorLensDiagnostic {
  const result: CorridorLensDiagnostic = {
    code: input.code,
    lensType: input.lensType,
    severity: input.severity ?? "INFO",
    message: input.message,
    details: input.details,
  };

  const payload = {
    lensType: result.lensType,
    severity: result.severity,
    message: result.message,
    details: result.details,
  };

  if (result.severity === "WARNING") {
    console.warn(`[${result.code}]`, payload);
  } else {
    console.log(`[${result.code}]`, payload);
  }

  return result;
}

function object(objectType: CorridorLensObjectType, priority: CorridorLensObjectPriority["priority"], reason: string): CorridorLensObjectPriority {
  return { objectType, priority, reason };
}

function provider(
  providerType: CorridorLensProviderPriority["providerType"],
  priority: CorridorLensProviderPriority["priority"],
  reason: string,
): CorridorLensProviderPriority {
  return { providerType, priority, reason };
}

function scoring(category: PrismScoreCategory, emphasis: CorridorLensScoringPriority["emphasis"], reason: string): CorridorLensScoringPriority {
  return { category, emphasis, reason };
}

export const CORRIDOR_LENS_REGISTRY: readonly CorridorLensDefinition[] = Object.freeze([
  {
    lensType: "HYPERSCALER",
    displayName: "Hyperscaler Lens",
    purpose: "Prioritize AI-scale demand, power, interconnection, expansion land, and highly scalable infrastructure.",
    objectPriorities: [
      object("DATA_CENTER", "PRIMARY", "Hyperscaler demand and interconnect anchor."),
      object("HYPERSCALER_CAMPUS", "PRIMARY", "Future hyperscaler campus object."),
      object("GPU_ARRAY", "PRIMARY", "Future AI compute concentration object."),
      object("SUBSTATION", "PRIMARY", "Power proximity is central to hyperscaler expansion."),
      object("TRANSMISSION_LINE", "PRIMARY", "Transmission proximity supports AI-scale load."),
      object("GENERATION_SITE", "SECONDARY", "Generation may improve AI expansion optionality."),
      object("CLOUD_ONRAMP", "PRIMARY", "Cloud handoff supports hyperscaler connectivity."),
      object("CARRIER_HOTEL", "SECONDARY", "Carrier density supports strategic handoff."),
      object("IX", "SECONDARY", "Peering density supports network strategy."),
      object("DEVELOPMENT_SITE", "PRIMARY", "Expansion land matters for future campuses."),
      object("PARCEL", "PRIMARY", "Parcel evidence supports site and ROW strategy."),
      object("REGEN_SITE", "SECONDARY", "Long optical spans may require regen."),
      object("ADM_SITE", "SECONDARY", "Transport flexibility for large-scale services."),
      object("CONDUIT", "PRIMARY", "Scalable physical infrastructure."),
      object("FIBER", "PRIMARY", "Fiber capacity supports transport and dark fiber models."),
    ],
    providerPriorities: [
      provider("DATA_CENTER_PROVIDER", "PRIMARY", "Facility and demand evidence."),
      provider("SUBSTATION_PROVIDER", "PRIMARY", "Power proximity evidence."),
      provider("TRANSMISSION_PROVIDER", "PRIMARY", "Transmission proximity evidence."),
      provider("GENERATION_PROVIDER", "SECONDARY", "Generation optionality evidence."),
      provider("CLOUD_ONRAMP_PROVIDER", "PRIMARY", "Cloud handoff evidence."),
      provider("CARRIER_HOTEL_PROVIDER", "SECONDARY", "Interconnection density evidence."),
      provider("PARCEL_PROVIDER", "PRIMARY", "Land and parcel evidence."),
      provider("LAND_PROVIDER", "PRIMARY", "Development site evidence."),
      provider("DOT_GIS", "SECONDARY", "ROW and jurisdiction evidence."),
    ],
    scoringPriorities: [
      scoring("POWER", "HIGH", "Power is a hyperscaler gating concern."),
      scoring("INTERCONNECTION", "HIGH", "Interconnection density matters."),
      scoring("AI", "HIGH", "AI suitability matters."),
      scoring("STRATEGIC", "HIGH", "Strategic role matters."),
      scoring("COMMERCIAL", "MEDIUM", "Commercial return matters after fit."),
      scoring("ENGINEERING", "MEDIUM", "Constructability must stay visible."),
      scoring("INFRASTRUCTURE", "MEDIUM", "Scalable assets matter."),
      scoring("OPTIMIZATION", "MEDIUM", "Scalability and optionality matter."),
    ],
    monetizationRelevance: ["AI expansion potential", "transport revenue", "interconnection revenue", "future campus opportunity"],
    risksToElevate: ["power availability", "parcel control", "development constraint", "interconnection availability"],
  },
  {
    lensType: "NEOCLOUD",
    displayName: "Neocloud Lens",
    purpose: "Prioritize GPU-ready power, fast interconnection, and transport capability for neocloud operators.",
    objectPriorities: [
      object("GPU_ARRAY", "PRIMARY", "Future GPU concentration object."),
      object("DATA_CENTER", "PRIMARY", "Neocloud facilities anchor demand."),
      object("POWER_FEED", "PRIMARY", "Power feed supports compute deployment."),
      object("SUBSTATION", "PRIMARY", "Substation evidence supports compute feasibility."),
      object("TRANSMISSION_LINE", "PRIMARY", "Transmission supports high-load expansion."),
      object("CLOUD_ONRAMP", "PRIMARY", "Cloud adjacency matters."),
      object("CARRIER_HOTEL", "SECONDARY", "Carrier options matter."),
      object("IX", "SECONDARY", "Peering density helps."),
      object("FIBER", "PRIMARY", "Fiber capacity supports transport."),
      object("TRANSPORT_OPPORTUNITY", "PRIMARY", "Recurring transport revenue matters."),
    ],
    providerPriorities: [
      provider("DATA_CENTER_PROVIDER", "PRIMARY", "Data center evidence."),
      provider("SUBSTATION_PROVIDER", "PRIMARY", "Substation evidence."),
      provider("TRANSMISSION_PROVIDER", "PRIMARY", "Transmission evidence."),
      provider("CLOUD_ONRAMP_PROVIDER", "PRIMARY", "Cloud on-ramp evidence."),
      provider("CARRIER_HOTEL_PROVIDER", "SECONDARY", "Carrier hotel evidence."),
      provider("IX_PROVIDER", "SECONDARY", "IX evidence."),
      provider("PARCEL_PROVIDER", "SECONDARY", "Parcel evidence."),
    ],
    scoringPriorities: [
      scoring("POWER", "HIGH", "Power is critical."),
      scoring("AI", "HIGH", "AI compute suitability is central."),
      scoring("INTERCONNECTION", "HIGH", "Cloud and carrier handoff matter."),
      scoring("COMMERCIAL", "MEDIUM", "Transport monetization matters."),
      scoring("ENGINEERING", "MEDIUM", "Fast deployment requires feasibility."),
      scoring("OPTIMIZATION", "MEDIUM", "Route optionality matters."),
      scoring("INFRASTRUCTURE", "MEDIUM", "Fiber assets matter."),
      scoring("STRATEGIC", "HIGH", "Fit to neocloud intent matters."),
    ],
    monetizationRelevance: ["transport revenue", "AI expansion potential", "interconnection revenue"],
    risksToElevate: ["power availability", "cloud on-ramp availability", "facility readiness", "fiber capacity"],
  },
  {
    lensType: "ENTERPRISE",
    displayName: "Enterprise Lens",
    purpose: "Prioritize enterprise demand, building/service access, parcels, and practical construction evidence.",
    objectPriorities: [
      object("ENTERPRISE_BUILDING", "PRIMARY", "Future enterprise building object."),
      object("OFFICE_PARK", "PRIMARY", "Future office park object."),
      object("INDUSTRIAL_PARK", "PRIMARY", "Future industrial park object."),
      object("HOSPITAL", "SECONDARY", "Future enterprise vertical object."),
      object("UNIVERSITY", "SECONDARY", "Future enterprise vertical object."),
      object("GOVERNMENT_SITE", "SECONDARY", "Future enterprise vertical object."),
      object("DATA_CENTER", "SECONDARY", "Data center adjacency matters."),
      object("CARRIER_HOTEL", "SECONDARY", "Carrier density can support service."),
      object("CLOUD_ONRAMP", "SECONDARY", "Cloud access may matter."),
      object("CONDUIT", "PRIMARY", "Constructible access path."),
      object("FIBER", "PRIMARY", "Service inventory."),
      object("PARCEL", "PRIMARY", "Parcel context for serviceability."),
      object("RIGHT_OF_WAY", "SECONDARY", "ROW affects delivery."),
    ],
    providerPriorities: [
      provider("PARCEL_PROVIDER", "PRIMARY", "Parcel and ownership evidence."),
      provider("MUNICIPAL_GIS", "PRIMARY", "Local GIS and addressing evidence."),
      provider("COUNTY_GIS", "SECONDARY", "County parcel and jurisdiction evidence."),
      provider("DATA_CENTER_PROVIDER", "SECONDARY", "Data center adjacency evidence."),
      provider("CLOUD_ONRAMP_PROVIDER", "SECONDARY", "Cloud handoff evidence."),
      provider("DOT_GIS", "SECONDARY", "ROW and crossing evidence."),
      provider("ENTERPRISE_DATA_PROVIDER", "PRIMARY", "Future enterprise demand provider."),
      provider("BUILDING_DATA_PROVIDER", "PRIMARY", "Future building footprint provider."),
    ],
    scoringPriorities: [
      scoring("COMMERCIAL", "HIGH", "Enterprise revenue potential matters."),
      scoring("INTERCONNECTION", "MEDIUM", "Cloud and carrier access matters."),
      scoring("INFRASTRUCTURE", "MEDIUM", "Conduit and fiber serviceability matter."),
      scoring("ENGINEERING", "MEDIUM", "Delivery burden matters."),
      scoring("POWER", "LOW", "Power is contextual."),
      scoring("AI", "LOW", "AI is not central for generic enterprise."),
      scoring("STRATEGIC", "MEDIUM", "Market fit matters."),
      scoring("OPTIMIZATION", "LOW", "Optimization matters after serviceability."),
    ],
    monetizationRelevance: ["transport revenue", "dark fiber IRU", "enterprise service revenue"],
    risksToElevate: ["parcel mismatch", "building access", "construction difficulty", "jurisdiction burden"],
  },
  {
    lensType: "DUCT_MONETIZATION",
    displayName: "Duct Monetization Lens",
    purpose: "Prioritize opportunities to monetize conduit, innerduct, ROW, and adjacent customers.",
    objectPriorities: [
      object("ISP", "PRIMARY", "Future ISP opportunity object."),
      object("WISP", "PRIMARY", "Future WISP opportunity object."),
      object("WIRELESS_SITE", "PRIMARY", "Wireless backhaul opportunity."),
      object("MUNICIPAL_SITE", "SECONDARY", "Future municipal site object."),
      object("UTILITY", "SECONDARY", "Future utility site object."),
      object("ENTERPRISE_BUILDING", "SECONDARY", "Future enterprise demand object."),
      object("SCHOOL", "SECONDARY", "Future school demand object."),
      object("PARCEL", "PRIMARY", "Parcel context for opportunities."),
      object("CONDUIT", "PRIMARY", "Primary duct sale asset."),
      object("INNERDUCT", "PRIMARY", "Primary monetizable duct asset."),
      object("RIGHT_OF_WAY", "PRIMARY", "ROW affects marketability."),
      object("DUCT_OPPORTUNITY", "PRIMARY", "Direct monetization object."),
      object("IRU_OPPORTUNITY", "SECONDARY", "Long-term commercial option."),
    ],
    providerPriorities: [
      provider("PARCEL_PROVIDER", "PRIMARY", "Parcel evidence."),
      provider("MUNICIPAL_GIS", "PRIMARY", "Municipal customer and ROW evidence."),
      provider("COUNTY_GIS", "SECONDARY", "County parcel and jurisdiction evidence."),
      provider("UTILITY_GIS", "PRIMARY", "Utility assets and conflicts."),
      provider("WIRELESS_SITE_PROVIDER", "PRIMARY", "Future wireless demand provider."),
      provider("ENTERPRISE_DATA_PROVIDER", "SECONDARY", "Future enterprise demand provider."),
      provider("TERALINX_MODEL", "PRIMARY", "Internal capacity and monetization assumptions."),
    ],
    scoringPriorities: [
      scoring("COMMERCIAL", "HIGH", "Duct monetization is commercial-first."),
      scoring("INFRASTRUCTURE", "HIGH", "Conduit and innerduct inventory matter."),
      scoring("ENGINEERING", "MEDIUM", "ROW and access burden matter."),
      scoring("STRATEGIC", "MEDIUM", "Market fit matters."),
      scoring("POWER", "LOW", "Power is low priority."),
      scoring("INTERCONNECTION", "LOW", "Interconnection is contextual."),
      scoring("AI", "LOW", "AI is not primary."),
      scoring("OPTIMIZATION", "MEDIUM", "Expansion optionality matters."),
    ],
    monetizationRelevance: ["duct sale", "IRU opportunity", "residual capacity", "cost avoidance"],
    risksToElevate: ["unknown duct availability", "ROW limits", "parcel control", "market demand uncertainty"],
  },
  {
    lensType: "DARK_FIBER_IRU",
    displayName: "Dark Fiber IRU Lens",
    purpose: "Prioritize fiber availability, pair assignability, and endpoints that can support IRU demand.",
    objectPriorities: [
      object("FIBER", "PRIMARY", "Primary dark fiber asset."),
      object("FIBER_PAIR", "PRIMARY", "Assignable pair inventory."),
      object("DATA_CENTER", "PRIMARY", "IRU demand anchor."),
      object("CARRIER_HOTEL", "PRIMARY", "Carrier demand and handoff."),
      object("ENTERPRISE_BUILDING", "SECONDARY", "Future enterprise demand object."),
      object("HYPERSCALER_CAMPUS", "SECONDARY", "Future hyperscaler demand object."),
      object("BACKBONE_NODE", "PRIMARY", "Backbone handoff."),
      object("DARK_FIBER_OPPORTUNITY", "PRIMARY", "Direct IRU monetization."),
      object("IRU_OPPORTUNITY", "PRIMARY", "IRU commercial object."),
    ],
    providerPriorities: [
      provider("DATA_CENTER_PROVIDER", "PRIMARY", "Data center demand."),
      provider("CARRIER_HOTEL_PROVIDER", "PRIMARY", "Carrier density."),
      provider("ENTERPRISE_DATA_PROVIDER", "SECONDARY", "Future enterprise demand."),
      provider("TERALINX_MODEL", "PRIMARY", "Fiber availability and IRU assumptions."),
      provider("DOT_GIS", "SECONDARY", "Route and ROW evidence."),
    ],
    scoringPriorities: [
      scoring("COMMERCIAL", "HIGH", "IRU monetization matters."),
      scoring("INFRASTRUCTURE", "HIGH", "Fiber inventory matters."),
      scoring("INTERCONNECTION", "MEDIUM", "Handoff quality matters."),
      scoring("ENGINEERING", "MEDIUM", "Delivery risk matters."),
      scoring("STRATEGIC", "MEDIUM", "Demand fit matters."),
      scoring("POWER", "LOW", "Power is contextual."),
      scoring("AI", "LOW", "AI may matter only for demand."),
      scoring("OPTIMIZATION", "MEDIUM", "Route diversity and optionality matter."),
    ],
    monetizationRelevance: ["dark fiber IRU", "transport revenue", "residual capacity"],
    risksToElevate: ["strand availability", "handoff availability", "route diversity", "term assumptions"],
  },
  {
    lensType: "TRANSPORT",
    displayName: "Transport Lens",
    purpose: "Prioritize POPs, backbone nodes, regen, ADM, cloud and carrier handoff for lit transport.",
    objectPriorities: [
      object("DATA_CENTER", "PRIMARY", "Transport demand anchor."),
      object("CARRIER_HOTEL", "PRIMARY", "Carrier handoff anchor."),
      object("IX", "PRIMARY", "Peering and interconnection."),
      object("CLOUD_ONRAMP", "PRIMARY", "Cloud transport relevance."),
      object("POP", "PRIMARY", "Transport point of presence."),
      object("BACKBONE_NODE", "PRIMARY", "Backbone continuity."),
      object("REGEN_SITE", "PRIMARY", "Optical reach."),
      object("ADM_SITE", "PRIMARY", "Add/drop capability."),
      object("FIBER", "PRIMARY", "Transport inventory."),
      object("TRANSPORT_OPPORTUNITY", "PRIMARY", "Recurring revenue object."),
    ],
    providerPriorities: [
      provider("DATA_CENTER_PROVIDER", "PRIMARY", "Data center evidence."),
      provider("CARRIER_HOTEL_PROVIDER", "PRIMARY", "Carrier hotel evidence."),
      provider("IX_PROVIDER", "PRIMARY", "IX evidence."),
      provider("CLOUD_ONRAMP_PROVIDER", "PRIMARY", "Cloud on-ramp evidence."),
      provider("DOT_GIS", "SECONDARY", "Route and jurisdiction evidence."),
      provider("TERALINX_MODEL", "PRIMARY", "Transport modeling evidence."),
    ],
    scoringPriorities: [
      scoring("OPTIMIZATION", "HIGH", "Latency, regen, and route flexibility matter."),
      scoring("STRATEGIC", "HIGH", "Transport role matters."),
      scoring("INTERCONNECTION", "HIGH", "Handoff locations matter."),
      scoring("ENGINEERING", "MEDIUM", "Route feasibility matters."),
      scoring("COMMERCIAL", "MEDIUM", "Recurring revenue matters."),
      scoring("INFRASTRUCTURE", "MEDIUM", "Fiber and POP assets matter."),
      scoring("POWER", "LOW", "Power is contextual except regen."),
      scoring("AI", "LOW", "AI is contextual."),
    ],
    monetizationRelevance: ["transport revenue", "interconnection revenue", "dark fiber IRU"],
    risksToElevate: ["regen burden", "handoff availability", "restoration complexity", "route diversity"],
  },
  {
    lensType: "INTERCONNECTION",
    displayName: "Interconnection Lens",
    purpose: "Prioritize carrier hotels, IX nodes, cloud on-ramps, meet-me rooms, and handoff capability.",
    objectPriorities: [
      object("DATA_CENTER", "PRIMARY", "Data center handoff."),
      object("CARRIER_HOTEL", "PRIMARY", "Carrier density."),
      object("IX", "PRIMARY", "Internet exchange."),
      object("CLOUD_ONRAMP", "PRIMARY", "Cloud handoff."),
      object("MEET_ME_ROOM", "PRIMARY", "Physical handoff."),
      object("INTERCONNECT_FACILITY", "PRIMARY", "Generic interconnection environment."),
      object("FIBER_PAIR", "SECONDARY", "Assignable handoff inventory."),
      object("VAULT", "SECONDARY", "Local access structure."),
      object("TRANSPORT_OPPORTUNITY", "SECONDARY", "Transport monetization."),
    ],
    providerPriorities: [
      provider("DATA_CENTER_PROVIDER", "PRIMARY", "Data center evidence."),
      provider("CARRIER_HOTEL_PROVIDER", "PRIMARY", "Carrier hotel evidence."),
      provider("IX_PROVIDER", "PRIMARY", "IX evidence."),
      provider("CLOUD_ONRAMP_PROVIDER", "PRIMARY", "Cloud evidence."),
      provider("PARCEL_PROVIDER", "SECONDARY", "Facility/parcel context."),
    ],
    scoringPriorities: [
      scoring("INTERCONNECTION", "HIGH", "Core lens priority."),
      scoring("STRATEGIC", "HIGH", "Network handoff relevance."),
      scoring("COMMERCIAL", "MEDIUM", "Revenue opportunity."),
      scoring("INFRASTRUCTURE", "MEDIUM", "Handoff infrastructure."),
      scoring("ENGINEERING", "MEDIUM", "Access feasibility."),
      scoring("POWER", "LOW", "Contextual."),
      scoring("AI", "LOW", "Contextual."),
      scoring("OPTIMIZATION", "MEDIUM", "Facility and route optionality."),
    ],
    monetizationRelevance: ["interconnection revenue", "transport revenue", "dark fiber IRU"],
    risksToElevate: ["cross-connect availability", "facility access", "carrier density mismatch"],
  },
  {
    lensType: "POWER_AI_EXPANSION",
    displayName: "Power / AI Expansion Lens",
    purpose: "Prioritize power, land, AI expansion, data centers, and GPU-ready growth optionality.",
    objectPriorities: [
      object("SUBSTATION", "PRIMARY", "Substation proximity."),
      object("TRANSMISSION_LINE", "PRIMARY", "Transmission proximity."),
      object("GENERATION_SITE", "PRIMARY", "Generation optionality."),
      object("POWER_FEED", "PRIMARY", "Facility power service."),
      object("DEVELOPMENT_SITE", "PRIMARY", "Expansion site."),
      object("PARCEL", "PRIMARY", "Land evidence."),
      object("DATA_CENTER", "PRIMARY", "AI/data center demand."),
      object("GPU_ARRAY", "PRIMARY", "Future AI compute object."),
      object("POWER_CORRIDOR", "PRIMARY", "Power corridor relationship."),
      object("EXPANSION_OPPORTUNITY", "PRIMARY", "Future monetization object."),
    ],
    providerPriorities: [
      provider("SUBSTATION_PROVIDER", "PRIMARY", "Substation evidence."),
      provider("TRANSMISSION_PROVIDER", "PRIMARY", "Transmission evidence."),
      provider("GENERATION_PROVIDER", "PRIMARY", "Generation evidence."),
      provider("PARCEL_PROVIDER", "PRIMARY", "Parcel evidence."),
      provider("LAND_PROVIDER", "PRIMARY", "Development site evidence."),
      provider("DATA_CENTER_PROVIDER", "SECONDARY", "Data center evidence."),
      provider("UTILITY_GIS", "SECONDARY", "Utility evidence."),
    ],
    scoringPriorities: [
      scoring("POWER", "HIGH", "Core lens priority."),
      scoring("AI", "HIGH", "AI expansion suitability."),
      scoring("OPTIMIZATION", "HIGH", "Future optionality."),
      scoring("STRATEGIC", "HIGH", "Strategic expansion value."),
      scoring("COMMERCIAL", "MEDIUM", "Expansion monetization."),
      scoring("ENGINEERING", "MEDIUM", "Siting and constructability."),
      scoring("INTERCONNECTION", "MEDIUM", "Data center/cloud handoff."),
      scoring("INFRASTRUCTURE", "MEDIUM", "Fiber/conduit support."),
    ],
    monetizationRelevance: ["AI expansion potential", "future campus opportunity", "transport revenue"],
    risksToElevate: ["power capacity unknown", "land control", "transmission distance", "development restriction"],
  },
  {
    lensType: "MUNICIPAL",
    displayName: "Municipal Lens",
    purpose: "Prioritize public-sector sites, schools, utilities, municipal ROW, and community anchor institutions.",
    objectPriorities: [
      object("MUNICIPAL_SITE", "PRIMARY", "Future municipal site object."),
      object("SCHOOL", "PRIMARY", "Future school object."),
      object("GOVERNMENT_SITE", "PRIMARY", "Future government object."),
      object("UTILITY", "SECONDARY", "Future utility site object."),
      object("PARCEL", "PRIMARY", "Parcel and ownership context."),
      object("RIGHT_OF_WAY", "PRIMARY", "Municipal ROW."),
      object("CONDUIT", "PRIMARY", "Shared infrastructure."),
      object("FIBER", "PRIMARY", "Connectivity asset."),
      object("JURISDICTION", "PRIMARY", "Municipal authority."),
    ],
    providerPriorities: [
      provider("MUNICIPAL_GIS", "PRIMARY", "Municipal GIS evidence."),
      provider("PARCEL_PROVIDER", "PRIMARY", "Parcel evidence."),
      provider("COUNTY_GIS", "SECONDARY", "County data."),
      provider("SCHOOL_PROVIDER", "SECONDARY", "Future school provider."),
      provider("MUNICIPAL_SITE_PROVIDER", "PRIMARY", "Future municipal site provider."),
      provider("UTILITY_GIS", "SECONDARY", "Utility context."),
    ],
    scoringPriorities: [
      scoring("COMMERCIAL", "MEDIUM", "Public-sector economics."),
      scoring("INFRASTRUCTURE", "HIGH", "Shared infrastructure."),
      scoring("ENGINEERING", "HIGH", "ROW and permitting."),
      scoring("STRATEGIC", "MEDIUM", "Community anchor fit."),
      scoring("POWER", "LOW", "Contextual."),
      scoring("INTERCONNECTION", "LOW", "Contextual."),
      scoring("AI", "LOW", "Contextual."),
      scoring("OPTIMIZATION", "MEDIUM", "Operational optionality."),
    ],
    monetizationRelevance: ["transport revenue", "cost avoidance", "public-sector service revenue"],
    risksToElevate: ["public procurement", "ROW access", "permit timing", "budget constraints"],
  },
  {
    lensType: "UTILITY",
    displayName: "Utility Lens",
    purpose: "Prioritize utility infrastructure, easements, power adjacency, and utility-customer opportunities.",
    objectPriorities: [
      object("UTILITY", "PRIMARY", "Future utility site object."),
      object("UTILITY_EASEMENT", "PRIMARY", "Easement access."),
      object("SUBSTATION", "PRIMARY", "Utility power anchor."),
      object("TRANSMISSION_LINE", "PRIMARY", "Transmission relationship."),
      object("POWER_FEED", "PRIMARY", "Power feed."),
      object("PARCEL", "SECONDARY", "Land context."),
      object("RIGHT_OF_WAY", "PRIMARY", "ROW relationship."),
      object("CONDUIT", "PRIMARY", "Shared infrastructure."),
      object("FIBER", "PRIMARY", "Utility communications."),
    ],
    providerPriorities: [
      provider("UTILITY_GIS", "PRIMARY", "Utility evidence."),
      provider("SUBSTATION_PROVIDER", "PRIMARY", "Substation evidence."),
      provider("TRANSMISSION_PROVIDER", "PRIMARY", "Transmission evidence."),
      provider("PARCEL_PROVIDER", "SECONDARY", "Parcel evidence."),
      provider("UTILITY_SITE_PROVIDER", "PRIMARY", "Future utility site provider."),
      provider("DOT_GIS", "SECONDARY", "ROW evidence."),
    ],
    scoringPriorities: [
      scoring("POWER", "HIGH", "Utility power assets."),
      scoring("ENGINEERING", "HIGH", "Easement and ROW feasibility."),
      scoring("INFRASTRUCTURE", "HIGH", "Fiber/conduit assets."),
      scoring("COMMERCIAL", "MEDIUM", "Utility service opportunity."),
      scoring("STRATEGIC", "MEDIUM", "Utility partnership fit."),
      scoring("INTERCONNECTION", "LOW", "Contextual."),
      scoring("AI", "MEDIUM", "AI expansion may matter."),
      scoring("OPTIMIZATION", "MEDIUM", "Operational optionality."),
    ],
    monetizationRelevance: ["transport revenue", "cost avoidance", "AI expansion potential"],
    risksToElevate: ["easement rights", "utility conflict", "power capacity uncertainty"],
  },
  {
    lensType: "CARRIER_WHOLESALE",
    displayName: "Carrier Wholesale Lens",
    purpose: "Prioritize wholesale carrier demand, carrier hotels, POPs, dark fiber, duct, and transport.",
    objectPriorities: [
      object("CARRIER_HOTEL", "PRIMARY", "Wholesale handoff."),
      object("POP", "PRIMARY", "Carrier POP."),
      object("BACKBONE_NODE", "PRIMARY", "Backbone transport."),
      object("DATA_CENTER", "SECONDARY", "Demand anchor."),
      object("IX", "SECONDARY", "Peering adjacency."),
      object("FIBER", "PRIMARY", "Wholesale fiber."),
      object("FIBER_PAIR", "PRIMARY", "Assignable inventory."),
      object("CONDUIT", "PRIMARY", "Duct capacity."),
      object("DARK_FIBER_OPPORTUNITY", "PRIMARY", "IRU opportunity."),
      object("TRANSPORT_OPPORTUNITY", "PRIMARY", "Lit transport opportunity."),
    ],
    providerPriorities: [
      provider("CARRIER_HOTEL_PROVIDER", "PRIMARY", "Carrier hotel evidence."),
      provider("DATA_CENTER_PROVIDER", "SECONDARY", "Data center evidence."),
      provider("IX_PROVIDER", "SECONDARY", "IX evidence."),
      provider("TERALINX_MODEL", "PRIMARY", "Internal asset capacity."),
      provider("DOT_GIS", "SECONDARY", "ROW and route evidence."),
    ],
    scoringPriorities: [
      scoring("COMMERCIAL", "HIGH", "Wholesale revenue."),
      scoring("INTERCONNECTION", "HIGH", "Carrier handoff."),
      scoring("INFRASTRUCTURE", "HIGH", "Fiber/duct assets."),
      scoring("STRATEGIC", "HIGH", "Carrier network role."),
      scoring("OPTIMIZATION", "MEDIUM", "Route diversity and optionality."),
      scoring("ENGINEERING", "MEDIUM", "Delivery feasibility."),
      scoring("POWER", "LOW", "Contextual."),
      scoring("AI", "LOW", "Contextual."),
    ],
    monetizationRelevance: ["dark fiber IRU", "duct sale", "transport revenue", "interconnection revenue"],
    risksToElevate: ["carrier density mismatch", "strand availability", "route diversity", "handoff risk"],
  },
]);

export function listCorridorLenses(): readonly CorridorLensDefinition[] {
  return CORRIDOR_LENS_REGISTRY;
}

export function getCorridorLens(lensType: CorridorLensType): CorridorLensDefinition | undefined {
  return CORRIDOR_LENS_REGISTRY.find((lens) => lens.lensType === lensType);
}

export function getObjectPrioritiesForLens(lensType: CorridorLensType): CorridorLensObjectPriority[] {
  const lens = getCorridorLens(lensType);
  return lens?.objectPriorities ?? [];
}

export function getProviderPrioritiesForLens(lensType: CorridorLensType): CorridorLensProviderPriority[] {
  const lens = getCorridorLens(lensType);
  return lens?.providerPriorities ?? [];
}

export function getScoringPrioritiesForLens(lensType: CorridorLensType): CorridorLensScoringPriority[] {
  const lens = getCorridorLens(lensType);
  return lens?.scoringPriorities ?? [];
}

export function applyCorridorLens(lensType: CorridorLensType): CorridorLensApplication {
  const lens = getCorridorLens(lensType);
  const diagnostics: CorridorLensDiagnostic[] = [
    diagnostic({
      code: "CORRIDOR_LENS_SELECTED",
      lensType,
      message: `Selected ${lensType} corridor lens.`,
    }),
  ];

  if (!lens) {
    const warning = `No lens definition found for ${lensType}.`;
    diagnostics.push(
      diagnostic({
        code: "CORRIDOR_LENS_WARNING",
        lensType,
        severity: "WARNING",
        message: warning,
      }),
    );
    return {
      lensType,
      prioritizedObjectTypes: [],
      prioritizedProviderTypes: [],
      prioritizedScoringCategories: [],
      ignoredObjectTypes: [],
      warnings: [warning],
      diagnostics,
    };
  }

  const warnings = lens.objectPriorities
    .filter((priority) => !CANONICAL_OBJECT_TYPES.has(priority.objectType))
    .map((priority) => `${priority.objectType} is a lens-defined future object type.`);

  lens.objectPriorities.forEach((priority) => {
    diagnostics.push(
      diagnostic({
        code: "CORRIDOR_LENS_OBJECT_PRIORITY",
        lensType,
        message: `${priority.objectType} priority is ${priority.priority}.`,
        details: { ...priority },
      }),
    );
  });

  lens.providerPriorities.forEach((priority) => {
    diagnostics.push(
      diagnostic({
        code: "CORRIDOR_LENS_PROVIDER_PRIORITY",
        lensType,
        message: `${priority.providerType} priority is ${priority.priority}.`,
        details: { ...priority },
      }),
    );
  });

  lens.scoringPriorities.forEach((priority) => {
    diagnostics.push(
      diagnostic({
        code: "CORRIDOR_LENS_SCORING_PRIORITY",
        lensType,
        message: `${priority.category} emphasis is ${priority.emphasis}.`,
        details: { ...priority },
      }),
    );
  });

  warnings.forEach((warning) => {
    diagnostics.push(
      diagnostic({
        code: "CORRIDOR_LENS_WARNING",
        lensType,
        severity: "WARNING",
        message: warning,
      }),
    );
  });

  const prioritizedObjectTypes = lens.objectPriorities
    .filter((priority) => priority.priority === "PRIMARY" || priority.priority === "SECONDARY")
    .map((priority) => priority.objectType);
  const prioritizedProviderTypes = lens.providerPriorities
    .filter((priority) => priority.priority === "PRIMARY" || priority.priority === "SECONDARY")
    .map((priority) => priority.providerType);
  const prioritizedScoringCategories = lens.scoringPriorities
    .filter((priority) => priority.emphasis === "HIGH" || priority.emphasis === "MEDIUM")
    .map((priority) => priority.category);
  const ignoredObjectTypes = lens.objectPriorities
    .filter((priority) => priority.priority === "IGNORED" || priority.priority === "LOW")
    .map((priority) => priority.objectType);

  diagnostics.push(
    diagnostic({
      code: "CORRIDOR_LENS_APPLIED",
      lensType,
      message: `Applied ${lensType} corridor lens.`,
      details: {
        prioritizedObjectTypes,
        prioritizedProviderTypes,
        prioritizedScoringCategories,
        ignoredObjectTypes,
      },
    }),
  );

  return {
    lensType,
    prioritizedObjectTypes,
    prioritizedProviderTypes,
    prioritizedScoringCategories: [...new Set(prioritizedScoringCategories)],
    ignoredObjectTypes,
    warnings,
    diagnostics,
  };
}
