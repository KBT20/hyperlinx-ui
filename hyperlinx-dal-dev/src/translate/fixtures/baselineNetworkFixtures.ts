import { generateBaselineNetwork } from "../BaselineNetworkSynthesisEngine";
import type { BaselineNetworkCandidate } from "../BaselineNetworkCandidate";
import type { BaselineNetworkSynthesisInput } from "../BaselineNetworkSynthesisEngine";
import type { NetworkIntent, NetworkType } from "../NetworkIntent";
import type { ProtectionSchema, ProtectionSchemaType } from "../ProtectionSchema";

export interface BaselineNetworkFixture {
  fixtureId: string;
  label: string;
  input: BaselineNetworkSynthesisInput;
  expectedReferenceArchitecture?: string;
  expectedStatus: "READY_FOR_SCOPE_REVIEW" | "BLOCKED";
  expectedObjectTypes: string[];
}

const selectedAt = "2026-06-24T00:00:00.000Z";

function intent(
  networkType: NetworkType,
  customerId: string,
  opportunityId: string,
  confidence: NetworkIntent["confidence"] = "HIGH",
): NetworkIntent {
  return {
    intentId: `INTENT-${customerId}-${opportunityId}-${networkType}`,
    networkType,
    customerId,
    opportunityId,
    selectedAt,
    source: "MANUAL",
    confidence,
  };
}

function protection(
  schemaType: ProtectionSchemaType,
  customerId: string,
  opportunityId: string,
  confidence: ProtectionSchema["confidence"] = "HIGH",
): ProtectionSchema {
  return {
    protectionSchemaId: `PROTECTION-${customerId}-${opportunityId}-${schemaType}`,
    schemaType,
    customerId,
    opportunityId,
    selectedAt,
    source: "MANUAL",
    confidence,
  };
}

function input(
  fixtureId: string,
  customerName: string,
  opportunityName: string,
  networkType?: NetworkType,
  schemaType?: ProtectionSchemaType,
): BaselineNetworkSynthesisInput {
  const customerId = `CUST-${fixtureId}`;
  const opportunityId = `OPP-${fixtureId}`;
  return {
    candidateId: `BNC-${fixtureId}`,
    customerContext: {
      customerId,
      customerName,
      customerType: networkType === "AI_CORRIDOR" ? "HYPERSCALER" : "ENTERPRISE",
    },
    opportunityContext: {
      opportunityId,
      opportunityName,
    },
    selectedIntent: networkType ? intent(networkType, customerId, opportunityId) : undefined,
    selectedProtection: schemaType ? protection(schemaType, customerId, opportunityId) : undefined,
    corridorId: `CORRIDOR-${fixtureId}`,
  };
}

export const baselineNetworkFixtures: readonly BaselineNetworkFixture[] = Object.freeze([
  {
    fixtureId: "METRO-RING",
    label: "Metro Ring",
    input: input("METRO-RING", "Metro Customer", "Protected Metro Ring", "METRO", "RING"),
    expectedReferenceArchitecture: "METRO_RING_REFERENCE_ARCHITECTURE",
    expectedStatus: "READY_FOR_SCOPE_REVIEW",
    expectedObjectTypes: ["AGGREGATION_NODE", "CARRIER_HOTEL", "ENTERPRISE_BUILDING", "CONDUIT"],
  },
  {
    fixtureId: "METRO-DIVERSE",
    label: "Metro Diverse",
    input: input("METRO-DIVERSE", "Metro Customer", "Diverse Metro Access", "METRO", "DIVERSE"),
    expectedReferenceArchitecture: "METRO_DIVERSE_REFERENCE_ARCHITECTURE",
    expectedStatus: "READY_FOR_SCOPE_REVIEW",
    expectedObjectTypes: ["AGGREGATION_NODE", "CARRIER_HOTEL", "ENTERPRISE_BUILDING", "CONDUIT"],
  },
  {
    fixtureId: "MIDDLE-MILE-LINEAR",
    label: "Middle Mile Linear",
    input: input("MIDDLE-MILE-LINEAR", "Regional Carrier", "Linear Middle Mile", "MIDDLE_MILE", "LINEAR"),
    expectedReferenceArchitecture: "MIDDLE_MILE_LINEAR_REFERENCE_ARCHITECTURE",
    expectedStatus: "READY_FOR_SCOPE_REVIEW",
    expectedObjectTypes: ["AGGREGATION_NODE", "POP", "BACKBONE_NODE", "FIBER"],
  },
  {
    fixtureId: "MIDDLE-MILE-DIVERSE",
    label: "Middle Mile Diverse",
    input: input("MIDDLE-MILE-DIVERSE", "Regional Carrier", "Diverse Middle Mile", "MIDDLE_MILE", "DIVERSE"),
    expectedReferenceArchitecture: "MIDDLE_MILE_DIVERSE_REFERENCE_ARCHITECTURE",
    expectedStatus: "READY_FOR_SCOPE_REVIEW",
    expectedObjectTypes: ["AGGREGATION_NODE", "POP", "BACKBONE_NODE", "FIBER"],
  },
  {
    fixtureId: "LONG-HAUL-LINEAR",
    label: "Long Haul Linear",
    input: input("LONG-HAUL-LINEAR", "Carrier Wholesale", "Linear Long Haul", "LONG_HAUL", "LINEAR"),
    expectedReferenceArchitecture: "LONG_HAUL_LINEAR_REFERENCE_ARCHITECTURE",
    expectedStatus: "READY_FOR_SCOPE_REVIEW",
    expectedObjectTypes: ["ADM_SITE", "REGEN_SITE", "INTERCONNECT_FACILITY", "FIBER"],
  },
  {
    fixtureId: "LONG-HAUL-DIVERSE",
    label: "Long Haul Diverse",
    input: input("LONG-HAUL-DIVERSE", "Carrier Wholesale", "Diverse Long Haul", "LONG_HAUL", "DIVERSE"),
    expectedReferenceArchitecture: "LONG_HAUL_DIVERSE_REFERENCE_ARCHITECTURE",
    expectedStatus: "READY_FOR_SCOPE_REVIEW",
    expectedObjectTypes: ["ADM_SITE", "REGEN_SITE", "INTERCONNECT_FACILITY", "FIBER"],
  },
  {
    fixtureId: "AI-CORRIDOR-DIVERSE",
    label: "AI Corridor Diverse",
    input: input("AI-CORRIDOR-DIVERSE", "Hyperscaler AI", "Diverse AI Corridor", "AI_CORRIDOR", "DIVERSE"),
    expectedReferenceArchitecture: "AI_CORRIDOR_DIVERSE_REFERENCE_ARCHITECTURE",
    expectedStatus: "READY_FOR_SCOPE_REVIEW",
    expectedObjectTypes: ["GPU_ARRAY", "SUBSTATION", "POWER_FEED", "CARRIER_HOTEL", "DATA_CENTER", "INTERCONNECT_FACILITY", "FIBER"],
  },
  {
    fixtureId: "ENTERPRISE-ACCESS-LINEAR",
    label: "Enterprise Access Linear",
    input: input("ENTERPRISE-ACCESS-LINEAR", "Enterprise Customer", "Enterprise Access", "ENTERPRISE_ACCESS", "LINEAR"),
    expectedReferenceArchitecture: "ENTERPRISE_ACCESS_LINEAR_REFERENCE_ARCHITECTURE",
    expectedStatus: "READY_FOR_SCOPE_REVIEW",
    expectedObjectTypes: ["ENTERPRISE_BUILDING", "HANDHOLE", "CONDUIT"],
  },
  {
    fixtureId: "WIRELESS-BACKHAUL-LINEAR",
    label: "Wireless Backhaul Linear",
    input: input("WIRELESS-BACKHAUL-LINEAR", "Wireless Operator", "Backhaul Path", "WIRELESS_BACKHAUL", "LINEAR"),
    expectedReferenceArchitecture: "WIRELESS_BACKHAUL_LINEAR_REFERENCE_ARCHITECTURE",
    expectedStatus: "READY_FOR_SCOPE_REVIEW",
    expectedObjectTypes: ["WIRELESS_SITE", "AGGREGATION_NODE", "FIBER"],
  },
  {
    fixtureId: "BLOCKED-EXAMPLE",
    label: "Blocked Example",
    input: input("BLOCKED-EXAMPLE", "Unknown Customer", "Missing Intent"),
    expectedStatus: "BLOCKED",
    expectedObjectTypes: [],
  },
  {
    fixtureId: "READY-FOR-SCOPE-REVIEW",
    label: "Ready For Scope Review Example",
    input: input("READY-FOR-SCOPE-REVIEW", "Google", "AI Metro Expansion", "AI_CORRIDOR", "DIVERSE"),
    expectedReferenceArchitecture: "AI_CORRIDOR_DIVERSE_REFERENCE_ARCHITECTURE",
    expectedStatus: "READY_FOR_SCOPE_REVIEW",
    expectedObjectTypes: ["GPU_ARRAY", "SUBSTATION", "POWER_FEED", "CARRIER_HOTEL", "DATA_CENTER", "INTERCONNECT_FACILITY", "FIBER"],
  },
]);

export function evaluateBaselineNetworkFixtures(): BaselineNetworkCandidate[] {
  return baselineNetworkFixtures.map((fixture) => generateBaselineNetwork(fixture.input));
}
