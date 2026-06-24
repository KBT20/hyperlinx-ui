import {
  blockedOpportunityMissingLocation,
  blockedOpportunityMissingProtection,
  carrierLongHaulOpportunity,
  googleOklahomaAiOpportunity,
  googleTexasAiOpportunity,
  metaAiCorridorOpportunity,
  oracleGpuExpansionOpportunity,
} from "../../customer/fixtures/customerWorkspaceFixtures";
import { generateBaselineNetwork } from "../../translate/BaselineNetworkSynthesisEngine";
import type { NetworkIntent, NetworkType } from "../../translate/NetworkIntent";
import type { ProtectionSchema, ProtectionSchemaType } from "../../translate/ProtectionSchema";
import { buildOpportunityDetailWorkspace } from "../OpportunityWorkspaceOrchestrator";
import type { OpportunityDetailWorkspace, OpportunityDetailWorkspaceInput } from "../OpportunityDetailWorkspace";
import type { OpportunityAttachment } from "../OpportunityAttachment";
import type { OpportunityObjective } from "../OpportunityObjective";
import type { OpportunityLocation, OpportunityRequest } from "../OpportunityRequest";

const fixtureTimestamp = "2026-06-24T00:00:00.000Z";

function intent(opportunity: OpportunityRequest, networkType: NetworkType): NetworkIntent {
  return {
    intentId: `INTENT-${opportunity.opportunityId}`,
    networkType,
    customerId: opportunity.customerId,
    opportunityId: opportunity.opportunityId,
    selectedAt: fixtureTimestamp,
    source: "MANUAL",
    confidence: "HIGH",
  };
}

function protection(opportunity: OpportunityRequest, schemaType: ProtectionSchemaType): ProtectionSchema {
  return {
    protectionSchemaId: `PROTECTION-${opportunity.opportunityId}`,
    schemaType,
    customerId: opportunity.customerId,
    opportunityId: opportunity.opportunityId,
    selectedAt: fixtureTimestamp,
    source: "MANUAL",
    confidence: "HIGH",
  };
}

function baseline(opportunity: OpportunityRequest, networkType: NetworkType, schemaType: ProtectionSchemaType) {
  const selectedIntent = intent(opportunity, networkType);
  const selectedProtection = protection(opportunity, schemaType);
  return generateBaselineNetwork({
    candidateId: `BNC-${opportunity.opportunityId}`,
    customerContext: {
      customerId: opportunity.customerId,
      customerName: opportunity.customerName,
      customerType: opportunity.customerType,
    },
    opportunityContext: {
      opportunityId: opportunity.opportunityId,
      opportunityName: opportunity.opportunityName,
    },
    selectedIntent,
    selectedProtection,
    corridorId: `CORRIDOR-${opportunity.opportunityId}`,
    requestedAt: fixtureTimestamp,
  });
}

function location(locationId: string, siteName: string): OpportunityLocation {
  return {
    locationId,
    role: "CANDIDATE",
    siteName,
    state: "TX",
    country: "US",
    locationConfidence: "HIGH",
  };
}

function attachment(attachmentId: string, attachmentType: OpportunityAttachment["attachmentType"], fileName: string): OpportunityAttachment {
  return {
    attachmentId,
    attachmentType,
    fileName,
    status: "READY_FOR_TRANSLATE",
    registeredAt: fixtureTimestamp,
  };
}

function objective(objectiveType: OpportunityObjective["objectiveType"]): OpportunityObjective {
  return {
    objectiveId: `OBJ-${objectiveType}`,
    objectiveType,
    priority: "STRATEGIC",
    requestedProducts: objectiveType === "METRO_EXPANSION" ? ["MANAGED_FIBER"] : ["DARK_FIBER", "AI_INTERCONNECT"],
    requestedServices: ["FEASIBILITY", "ROUTE_ANALYSIS"],
  };
}

function opportunity(input: {
  opportunityId: string;
  opportunityName: string;
  customerName: string;
  objectiveType: OpportunityObjective["objectiveType"];
  accountOwner?: string;
  locations?: OpportunityLocation[];
  attachments?: OpportunityAttachment[];
}): OpportunityRequest {
  const objectives = [objective(input.objectiveType)];
  return {
    requestId: `REQ-${input.opportunityId}`,
    customerId: `CUST-${input.customerName.toUpperCase().replace(/[^A-Z0-9]+/g, "-")}`,
    customerName: input.customerName,
    customerType: input.customerName.includes("Carrier") ? "CARRIER" : "ENTERPRISE",
    opportunityId: input.opportunityId,
    opportunityName: input.opportunityName,
    accountOwner: input.accountOwner ?? "Ryan",
    requestedDate: fixtureTimestamp,
    source: "MANUAL",
    status: "INTAKE",
    objectives,
    requestedProducts: objectives.flatMap((item) => item.requestedProducts),
    requestedServices: objectives.flatMap((item) => item.requestedServices),
    locations: input.locations ?? [location(`LOC-${input.opportunityId}`, `${input.opportunityName} Site`)],
    attachments: input.attachments ?? [attachment(`ATT-${input.opportunityId}`, "ADDRESS_LIST", `${input.opportunityId.toLowerCase()}-addresses.csv`)],
    createdAt: fixtureTimestamp,
    updatedAt: fixtureTimestamp,
  };
}

const metroRingOpportunity = opportunity({
  opportunityId: "OPP-METRO-RING",
  opportunityName: "Metro Ring",
  customerName: "Metro Customer",
  objectiveType: "METRO_EXPANSION",
});

const middleMileDiverseOpportunity = opportunity({
  opportunityId: "OPP-MIDDLE-MILE-DIVERSE",
  opportunityName: "Middle Mile Diverse",
  customerName: "Middle Mile Customer",
  objectiveType: "MIDDLE_MILE",
});

function input(
  opportunityRequest: OpportunityRequest,
  networkType: NetworkType,
  schemaType: ProtectionSchemaType,
  stageContext: OpportunityDetailWorkspaceInput["stageContext"] = {},
): OpportunityDetailWorkspaceInput {
  return {
    opportunity: opportunityRequest,
    networkIntent: intent(opportunityRequest, networkType),
    protectionSchema: protection(opportunityRequest, schemaType),
    stageContext,
    evaluatedAt: fixtureTimestamp,
  };
}

export const opportunityDetailWorkspaceFixtureInputs: readonly OpportunityDetailWorkspaceInput[] = Object.freeze([
  input(googleTexasAiOpportunity, "AI_CORRIDOR", "DIVERSE", {
    translateStatus: "COMPLETE",
    baselineNetwork: baseline(googleTexasAiOpportunity, "AI_CORRIDOR", "DIVERSE"),
  }),
  input(googleOklahomaAiOpportunity, "AI_CORRIDOR", "DIVERSE", {
    translateStatus: "READY",
  }),
  input(metaAiCorridorOpportunity, "AI_CORRIDOR", "DIVERSE", {
    translateStatus: "COMPLETE",
    baselineNetwork: baseline(metaAiCorridorOpportunity, "AI_CORRIDOR", "DIVERSE"),
    scopeReviewStatus: "UNDER_REVIEW",
  }),
  input(oracleGpuExpansionOpportunity, "AI_CORRIDOR", "DIVERSE", {
    translateStatus: "COMPLETE",
    baselineNetwork: baseline(oracleGpuExpansionOpportunity, "AI_CORRIDOR", "DIVERSE"),
    scopeReviewStatus: "APPROVED_FOR_PRISM",
  }),
  input(carrierLongHaulOpportunity, "LONG_HAUL", "DIVERSE", {
    translateStatus: "COMPLETE",
    baselineNetwork: baseline(carrierLongHaulOpportunity, "LONG_HAUL", "DIVERSE"),
  }),
  input(metroRingOpportunity, "METRO", "RING", {
    translateStatus: "COMPLETE",
    baselineNetwork: baseline(metroRingOpportunity, "METRO", "RING"),
  }),
  input(middleMileDiverseOpportunity, "MIDDLE_MILE", "DIVERSE", {
    translateStatus: "COMPLETE",
    baselineNetwork: baseline(middleMileDiverseOpportunity, "MIDDLE_MILE", "DIVERSE"),
  }),
  {
    opportunity: blockedOpportunityMissingLocation,
    networkIntent: intent(blockedOpportunityMissingLocation, "AI_CORRIDOR"),
    protectionSchema: protection(blockedOpportunityMissingLocation, "DIVERSE"),
    evaluatedAt: fixtureTimestamp,
  },
  {
    opportunity: blockedOpportunityMissingProtection,
    networkIntent: intent(blockedOpportunityMissingProtection, "AI_CORRIDOR"),
    evaluatedAt: fixtureTimestamp,
  },
  input(googleTexasAiOpportunity, "AI_CORRIDOR", "DIVERSE", {
    translateStatus: "COMPLETE",
    baselineNetwork: baseline(googleTexasAiOpportunity, "AI_CORRIDOR", "DIVERSE"),
    scopeReviewStatus: "APPROVED_FOR_PRISM",
    prismStatus: "COMPLETE",
    preliminaryQuoteStatus: "READY",
  }),
]);

export const opportunityDetailWorkspaceFixtures: readonly OpportunityDetailWorkspace[] = Object.freeze(
  opportunityDetailWorkspaceFixtureInputs.map(buildOpportunityDetailWorkspace),
);

export const googleTexasAiExpansionWorkspace = opportunityDetailWorkspaceFixtures[0];
export const googleOklahomaAiExpansionWorkspace = opportunityDetailWorkspaceFixtures[1];
export const metaCampusExpansionWorkspace = opportunityDetailWorkspaceFixtures[2];
export const oracleGpuExpansionWorkspace = opportunityDetailWorkspaceFixtures[3];
export const carrierLongHaulWorkspace = opportunityDetailWorkspaceFixtures[4];
export const metroRingWorkspace = opportunityDetailWorkspaceFixtures[5];
export const middleMileDiverseWorkspace = opportunityDetailWorkspaceFixtures[6];
export const blockedMissingLocationWorkspace = opportunityDetailWorkspaceFixtures[7];
export const blockedMissingProtectionWorkspace = opportunityDetailWorkspaceFixtures[8];
export const quoteReadyWorkspace = opportunityDetailWorkspaceFixtures[9];

export function evaluateOpportunityDetailWorkspaceFixtures(): readonly OpportunityDetailWorkspace[] {
  return opportunityDetailWorkspaceFixtures;
}
