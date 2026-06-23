import type { CorridorLensType } from "../CorridorLens";
import {
  CORRIDOR_LENS_DESIGN_STANDARDS,
  CORRIDOR_OBJECT_DESIGN_STANDARDS,
  type CorridorLensDesignStandard,
  type CorridorObjectDesignStandard,
  type DesignStandardException,
} from "../CorridorDesignStandards";

export interface CorridorDesignStandardsFixture {
  fixtureId: string;
  label: string;
  lensType: CorridorLensType;
  scenario: string;
  objectStandards: CorridorObjectDesignStandard[];
  lensStandards: CorridorLensDesignStandard[];
  exceptionExamples: DesignStandardException[];
  expectedRouteEngineeringFocus: string[];
}

function objects(objectTypes: string[]): CorridorObjectDesignStandard[] {
  return CORRIDOR_OBJECT_DESIGN_STANDARDS.filter((standard) => objectTypes.includes(standard.objectType));
}

function lens(lensType: CorridorLensType): CorridorLensDesignStandard[] {
  return CORRIDOR_LENS_DESIGN_STANDARDS.filter((standard) => standard.lensType === lensType);
}

export const corridorDesignStandardsFixtures: readonly CorridorDesignStandardsFixture[] = Object.freeze([
  {
    fixtureId: "DESIGN-STANDARDS-HYPERSCALER-REGEN",
    label: "Hyperscaler corridor requiring regen review",
    lensType: "HYPERSCALER",
    scenario: "Long-haul AI corridor with data centers, substations, carrier hotels, and candidate regen locations.",
    objectStandards: objects(["REGEN_SITE", "DATA_CENTER", "SUBSTATION", "TRANSMISSION_LINE", "CONDUIT", "FIBER"]),
    lensStandards: lens("HYPERSCALER"),
    exceptionExamples: [
      {
        exceptionId: "EXCEPTION-HYPER-REGEN-001",
        standardId: "STANDARD-REGEN-SITE-001",
        objectId: "candidate-regen-west-texas-01",
        reason: "Commercial model requests wider spacing than preliminary optical review suggests.",
        requestedBy: "Sales",
        status: "REQUESTED",
        evidenceIds: ["evidence-optical-prelim-01", "evidence-sla-target-01"],
        notes: "Route Engineering must approve or reject the exception before ScopeVersion handoff.",
      },
    ],
    expectedRouteEngineeringFocus: ["optical reach", "regen placement", "power availability", "route diversity", "restoration"],
  },
  {
    fixtureId: "DESIGN-STANDARDS-DUCT-SPARE",
    label: "Duct monetization corridor requiring spare duct accounting",
    lensType: "DUCT_MONETIZATION",
    scenario: "Metro corridor with existing conduit, prospective ISP/WISP demand, and uncertain spare duct availability.",
    objectStandards: objects(["CONDUIT", "PARCEL", "JURISDICTION"]),
    lensStandards: lens("DUCT_MONETIZATION"),
    exceptionExamples: [
      {
        exceptionId: "EXCEPTION-DUCT-ACCOUNTING-001",
        standardId: "STANDARD-CONDUIT-001",
        objectId: "conduit-segment-msa-42",
        reason: "Provider evidence reports spare duct but maintenance reservation is unknown.",
        requestedBy: "Prism Analyst",
        status: "REQUESTED",
        evidenceIds: ["evidence-conduit-provider-42"],
        notes: "Residual and committed capacity must remain separate.",
      },
    ],
    expectedRouteEngineeringFocus: ["duct count", "spare duct", "sale eligibility", "maintenance rights", "ROW evidence"],
  },
  {
    fixtureId: "DESIGN-STANDARDS-DARK-FIBER-IRU",
    label: "Dark fiber IRU corridor requiring strand reservation",
    lensType: "DARK_FIBER_IRU",
    scenario: "Intercity corridor being evaluated for dark fiber IRU availability and diverse handoff feasibility.",
    objectStandards: objects(["FIBER", "DATA_CENTER", "CARRIER_HOTEL"]),
    lensStandards: lens("DARK_FIBER_IRU"),
    exceptionExamples: [
      {
        exceptionId: "EXCEPTION-IRU-STRAND-001",
        standardId: "STANDARD-FIBER-001",
        objectId: "fiber-span-dfw-kc-17",
        reason: "Requested IRU strand allocation conflicts with future growth reserve.",
        requestedBy: "Commercial",
        status: "REQUESTED",
        evidenceIds: ["evidence-strand-inventory-17"],
      },
    ],
    expectedRouteEngineeringFocus: ["strand reservation", "IRU boundary", "handoff design", "splice points", "diversity evidence"],
  },
  {
    fixtureId: "DESIGN-STANDARDS-TRANSPORT-TOPOLOGY",
    label: "Transport corridor requiring ADM, regen, and topology review",
    lensType: "TRANSPORT",
    scenario: "Backbone transport corridor with add/drop locations, POPs, and projected SLA commitments.",
    objectStandards: objects(["ADM_SITE", "REGEN_SITE", "DATA_CENTER", "CARRIER_HOTEL", "IX"]),
    lensStandards: lens("TRANSPORT"),
    exceptionExamples: [
      {
        exceptionId: "EXCEPTION-ADM-PLACEMENT-001",
        standardId: "STANDARD-ADM-SITE-001",
        objectId: "adm-site-transport-03",
        reason: "Customer requested add/drop point lacks confirmed power and space evidence.",
        requestedBy: "Sales",
        status: "REQUESTED",
        evidenceIds: ["evidence-customer-add-drop-03"],
      },
    ],
    expectedRouteEngineeringFocus: ["topology", "ADM placement", "regen placement", "optical design", "SLA restoration"],
  },
  {
    fixtureId: "DESIGN-STANDARDS-ENTERPRISE-LATERAL",
    label: "Enterprise corridor requiring building entry and lateral review",
    lensType: "ENTERPRISE",
    scenario: "Metro enterprise aggregation route with building entry, lateral construction, and serviceability questions.",
    objectStandards: objects(["DATA_CENTER", "CARRIER_HOTEL", "CLOUD_ONRAMP", "CONDUIT", "FIBER", "PARCEL"]),
    lensStandards: lens("ENTERPRISE"),
    exceptionExamples: [
      {
        exceptionId: "EXCEPTION-ENTERPRISE-ENTRY-001",
        standardId: "LENS-STANDARD-ENTERPRISE-001",
        objectId: "enterprise-building-200-main",
        reason: "Building entrance path is commercially attractive but not yet constructability reviewed.",
        requestedBy: "Sales",
        status: "REQUESTED",
        evidenceIds: ["evidence-building-entry-200-main"],
      },
    ],
    expectedRouteEngineeringFocus: ["building entry", "lateral constructability", "service availability", "fiber capacity"],
  },
  {
    fixtureId: "DESIGN-STANDARDS-AI-POWER-PARCEL",
    label: "AI expansion corridor requiring power and parcel review",
    lensType: "POWER_AI_EXPANSION",
    scenario: "West Texas AI expansion corridor with substations, transmission, parcels, and future campus demand evidence.",
    objectStandards: objects(["SUBSTATION", "TRANSMISSION_LINE", "PARCEL", "DATA_CENTER"]),
    lensStandards: lens("POWER_AI_EXPANSION"),
    exceptionExamples: [
      {
        exceptionId: "EXCEPTION-AI-POWER-001",
        standardId: "STANDARD-SUBSTATION-001",
        objectId: "substation-west-tx-07",
        reason: "Substation proximity exists, but available capacity has not been verified.",
        requestedBy: "Strategy",
        status: "REQUESTED",
        evidenceIds: ["evidence-substation-location-07"],
      },
    ],
    expectedRouteEngineeringFocus: ["power capacity evidence", "parcel suitability", "fiber proximity", "campus expansion risk"],
  },
]);

export function listCorridorDesignStandardsFixtures(): readonly CorridorDesignStandardsFixture[] {
  return corridorDesignStandardsFixtures;
}
