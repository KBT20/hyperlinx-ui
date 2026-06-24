import {
  carrierLongHaulOpportunity,
  googleOklahomaAiOpportunity,
  googleTexasAiOpportunity,
  metaAiCorridorOpportunity,
  oracleGpuExpansionOpportunity,
} from "../../customer/fixtures/customerWorkspaceFixtures";
import type { OpportunityAttachment } from "../../opportunity/OpportunityAttachment";
import type { OpportunityObjective } from "../../opportunity/OpportunityObjective";
import type { OpportunityLocation, OpportunityRequest } from "../../opportunity/OpportunityRequest";
import { buildTranslateWorkspace } from "../TranslateWorkspaceOrchestrator";
import type { TranslateWorkspace, TranslateWorkspaceInput } from "../TranslateWorkspace";
import type { NetworkIntent, NetworkType } from "../NetworkIntent";
import type { ProtectionSchema, ProtectionSchemaType } from "../ProtectionSchema";

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
}): OpportunityRequest {
  const objectives = [objective(input.objectiveType)];
  return {
    requestId: `REQ-${input.opportunityId}`,
    customerId: `CUST-${input.customerName.toUpperCase().replace(/[^A-Z0-9]+/g, "-")}`,
    customerName: input.customerName,
    customerType: input.customerName.includes("Carrier") ? "CARRIER" : "ENTERPRISE",
    opportunityId: input.opportunityId,
    opportunityName: input.opportunityName,
    accountOwner: "Ryan",
    requestedDate: fixtureTimestamp,
    source: "MANUAL",
    status: "READY_FOR_TRANSLATE",
    objectives,
    requestedProducts: objectives.flatMap((item) => item.requestedProducts),
    requestedServices: objectives.flatMap((item) => item.requestedServices),
    locations: [location(`LOC-${input.opportunityId}`, `${input.opportunityName} Site`)],
    attachments: [attachment(`ATT-${input.opportunityId}`, "ADDRESS_LIST", `${input.opportunityId.toLowerCase()}-addresses.csv`)],
    createdAt: fixtureTimestamp,
    updatedAt: fixtureTimestamp,
  };
}

const metroRingOpportunity = opportunity({
  opportunityId: "OPP-TRANSLATE-METRO-RING",
  opportunityName: "Metro Ring",
  customerName: "Metro Customer",
  objectiveType: "METRO_EXPANSION",
});

const middleMileDiverseOpportunity = opportunity({
  opportunityId: "OPP-TRANSLATE-MIDDLE-MILE-DIVERSE",
  opportunityName: "Middle Mile Diverse",
  customerName: "Middle Mile Customer",
  objectiveType: "MIDDLE_MILE",
});

function input(opportunityRequest: OpportunityRequest, networkType?: NetworkType, schemaType?: ProtectionSchemaType): TranslateWorkspaceInput {
  return {
    opportunity: opportunityRequest,
    networkIntent: networkType ? intent(opportunityRequest, networkType) : undefined,
    protectionSchema: schemaType ? protection(opportunityRequest, schemaType) : undefined,
    evaluatedAt: fixtureTimestamp,
  };
}

export const translateWorkspaceFixtureInputs: readonly TranslateWorkspaceInput[] = Object.freeze([
  input(googleTexasAiOpportunity, "AI_CORRIDOR", "DIVERSE"),
  input(googleOklahomaAiOpportunity, "AI_CORRIDOR", "DIVERSE"),
  input(metaAiCorridorOpportunity, "AI_CORRIDOR", "DIVERSE"),
  input(oracleGpuExpansionOpportunity, "AI_CORRIDOR", "DIVERSE"),
  input(carrierLongHaulOpportunity, "LONG_HAUL", "DIVERSE"),
  input(metroRingOpportunity, "METRO", "RING"),
  input(middleMileDiverseOpportunity, "MIDDLE_MILE", "DIVERSE"),
  input(googleTexasAiOpportunity),
  input(googleTexasAiOpportunity, "AI_CORRIDOR"),
  input(googleOklahomaAiOpportunity, "AI_CORRIDOR", "DIVERSE"),
]);

export const translateWorkspaceFixtures: readonly TranslateWorkspace[] = Object.freeze(
  translateWorkspaceFixtureInputs.map(buildTranslateWorkspace),
);

export const googleTexasAiTranslateWorkspace = translateWorkspaceFixtures[0];
export const googleOklahomaAiTranslateWorkspace = translateWorkspaceFixtures[1];
export const metaAiCorridorTranslateWorkspace = translateWorkspaceFixtures[2];
export const oracleGpuExpansionTranslateWorkspace = translateWorkspaceFixtures[3];
export const carrierLongHaulTranslateWorkspace = translateWorkspaceFixtures[4];
export const metroRingTranslateWorkspace = translateWorkspaceFixtures[5];
export const middleMileDiverseTranslateWorkspace = translateWorkspaceFixtures[6];
export const blockedMissingIntentTranslateWorkspace = translateWorkspaceFixtures[7];
export const blockedMissingProtectionTranslateWorkspace = translateWorkspaceFixtures[8];
export const readyForScopeReviewTranslateWorkspace = translateWorkspaceFixtures[9];

export function evaluateTranslateWorkspaceFixtures(): readonly TranslateWorkspace[] {
  return translateWorkspaceFixtures;
}
