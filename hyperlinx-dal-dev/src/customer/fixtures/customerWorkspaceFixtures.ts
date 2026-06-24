import type { Customer } from "../CustomerContract";
import type { CustomerWorkspace } from "../CustomerWorkspace";
import {
  createCustomerOpportunitySummary,
  createCustomerWorkspace,
  evaluateOpportunityLaunchReadiness,
  launchOpportunityToTranslate,
  type CustomerWorkspaceInputOpportunity,
} from "../OpportunityLaunchEngine";
import type { OpportunityLaunchResult } from "../OpportunityLaunch";
import type { OpportunityAttachment } from "../../opportunity/OpportunityAttachment";
import type { OpportunityObjective } from "../../opportunity/OpportunityObjective";
import type { OpportunityLocation, OpportunityRequest } from "../../opportunity/OpportunityRequest";
import type { NetworkIntent, NetworkType } from "../../translate/NetworkIntent";
import type { ProtectionSchema, ProtectionSchemaType } from "../../translate/ProtectionSchema";

const fixtureTimestamp = "2026-06-24T00:00:00.000Z";

function customer(input: Pick<Customer, "customerId" | "customerName" | "customerType" | "customerSegment" | "industry" | "accountOwner" | "relationshipStatus">): Customer {
  return {
    ...input,
    contacts: [
      {
        contactId: `${input.customerId}-PRIMARY`,
        name: `${input.customerName} Sponsor`,
        role: "Executive Sponsor",
        primary: true,
      },
    ],
    relationships: [
      {
        relationshipId: `${input.customerId}-REL`,
        customerId: input.customerId,
        relationshipStatus: input.relationshipStatus,
        accountOwner: input.accountOwner,
        updatedAt: fixtureTimestamp,
      },
    ],
    createdAt: fixtureTimestamp,
    updatedAt: fixtureTimestamp,
  };
}

function location(locationId: string, siteName: string, state: string): OpportunityLocation {
  return {
    locationId,
    role: "CANDIDATE",
    siteName,
    state,
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

function objective(objectiveId: string, objectiveType: OpportunityObjective["objectiveType"]): OpportunityObjective {
  return {
    objectiveId,
    objectiveType,
    priority: "STRATEGIC",
    requestedProducts: objectiveType === "AI_CORRIDOR" || objectiveType === "GPU_INFRASTRUCTURE" ? ["AI_INTERCONNECT", "GPU_FACILITY"] : ["DARK_FIBER"],
    requestedServices: ["FEASIBILITY", "ROUTE_ANALYSIS"],
  };
}

function opportunity(input: {
  requestId: string;
  customer: Customer;
  opportunityId: string;
  opportunityName: string;
  objectiveType: OpportunityObjective["objectiveType"];
  locations?: OpportunityLocation[];
  attachments?: OpportunityAttachment[];
  narrative?: string;
  status?: OpportunityRequest["status"];
}): OpportunityRequest {
  const objectives = [objective(`${input.opportunityId}-OBJ`, input.objectiveType)];
  return {
    requestId: input.requestId,
    customerId: input.customer.customerId,
    customerName: input.customer.customerName,
    customerType: input.customer.customerType === "MUNICIPAL" ? "GOVERNMENT" : input.customer.customerType,
    opportunityId: input.opportunityId,
    opportunityName: input.opportunityName,
    accountOwner: input.customer.accountOwner,
    requestedDate: fixtureTimestamp,
    source: "STRATEGIC_ACCOUNT",
    status: input.status ?? "INTAKE",
    objectives,
    requestedProducts: objectives.flatMap((item) => item.requestedProducts),
    requestedServices: objectives.flatMap((item) => item.requestedServices),
    locations: input.locations ?? [],
    attachments: input.attachments ?? [],
    narrative: input.narrative,
    createdAt: fixtureTimestamp,
    updatedAt: fixtureTimestamp,
  };
}

function networkIntent(customerId: string, opportunityId: string, networkType: NetworkType): NetworkIntent {
  return {
    intentId: `INTENT-${opportunityId}`,
    networkType,
    customerId,
    opportunityId,
    selectedAt: fixtureTimestamp,
    source: "MANUAL",
    confidence: "HIGH",
  };
}

function protectionSchema(customerId: string, opportunityId: string, schemaType: ProtectionSchemaType): ProtectionSchema {
  return {
    protectionSchemaId: `PROTECTION-${opportunityId}`,
    schemaType,
    customerId,
    opportunityId,
    selectedAt: fixtureTimestamp,
    source: "MANUAL",
    confidence: "HIGH",
  };
}

export const googleCustomer = customer({
  customerId: "CUST-GOOGLE",
  customerName: "Google",
  customerType: "HYPERSCALER",
  customerSegment: "AI_EXPANSION",
  industry: "Cloud and AI Infrastructure",
  accountOwner: "Ryan",
  relationshipStatus: "STRATEGIC_ACCOUNT",
});

export const metaCustomer = customer({
  customerId: "CUST-META",
  customerName: "Meta",
  customerType: "HYPERSCALER",
  customerSegment: "STRATEGIC",
  industry: "Cloud Infrastructure",
  accountOwner: "Strategic Accounts",
  relationshipStatus: "QUALIFIED",
});

export const oracleCustomer = customer({
  customerId: "CUST-ORACLE",
  customerName: "Oracle",
  customerType: "HYPERSCALER",
  customerSegment: "STRATEGIC",
  industry: "Cloud Infrastructure",
  accountOwner: "Cloud Accounts",
  relationshipStatus: "QUALIFIED",
});

export const carrierCustomer = customer({
  customerId: "CUST-CARRIER-LONGHAUL",
  customerName: "Carrier Long Haul Customer",
  customerType: "CARRIER",
  customerSegment: "WHOLESALE",
  industry: "Carrier Infrastructure",
  accountOwner: "Carrier Accounts",
  relationshipStatus: "ACTIVE",
});

export const googleTexasAiOpportunity = opportunity({
  requestId: "REQ-GOOGLE-TX-AI",
  customer: googleCustomer,
  opportunityId: "OPP-GOOGLE-TX-AI",
  opportunityName: "Google Texas AI Opportunity",
  objectiveType: "AI_CORRIDOR",
  locations: [location("LOC-GOOGLE-TX-1", "Texas AI Campus", "TX"), location("LOC-GOOGLE-TX-2", "Dallas Interconnect", "TX")],
  attachments: [attachment("ATT-GOOGLE-TX-KMZ", "KMZ", "google-texas-ai.kmz")],
  narrative: "AI corridor with diverse protection request.",
});

export const googleOklahomaAiOpportunity = opportunity({
  requestId: "REQ-GOOGLE-OK-AI",
  customer: googleCustomer,
  opportunityId: "OPP-GOOGLE-OK-AI",
  opportunityName: "Google Oklahoma AI Opportunity",
  objectiveType: "AI_CORRIDOR",
  locations: [location("LOC-GOOGLE-OK-1", "Oklahoma AI Campus", "OK"), location("LOC-GOOGLE-OK-2", "Tulsa Interconnect", "OK")],
  attachments: [attachment("ATT-GOOGLE-OK-CSV", "CSV", "google-oklahoma-sites.csv")],
});

export const metaAiCorridorOpportunity = opportunity({
  requestId: "REQ-META-AI-CORRIDOR",
  customer: metaCustomer,
  opportunityId: "OPP-META-AI-CORRIDOR",
  opportunityName: "Meta AI Corridor Opportunity",
  objectiveType: "AI_CORRIDOR",
  locations: [location("LOC-META-AI-1", "Meta DFW", "TX"), location("LOC-META-AI-2", "Meta Atlanta", "GA")],
  attachments: [attachment("ATT-META-GEOJSON", "GEOJSON", "meta-ai-corridor.geojson")],
});

export const oracleGpuExpansionOpportunity = opportunity({
  requestId: "REQ-ORACLE-GPU",
  customer: oracleCustomer,
  opportunityId: "OPP-ORACLE-GPU",
  opportunityName: "Oracle GPU Expansion Opportunity",
  objectiveType: "GPU_INFRASTRUCTURE",
  locations: [location("LOC-ORACLE-GPU-1", "Oracle GPU Expansion Site", "TX")],
  attachments: [attachment("ATT-ORACLE-RFP", "RFP_PACKAGE", "oracle-gpu-rfp.zip")],
});

export const carrierLongHaulOpportunity = opportunity({
  requestId: "REQ-CARRIER-LONGHAUL",
  customer: carrierCustomer,
  opportunityId: "OPP-CARRIER-LONGHAUL",
  opportunityName: "Carrier Long Haul Opportunity",
  objectiveType: "LONG_HAUL",
  locations: [location("LOC-CARRIER-A", "Carrier POP A", "TX"), location("LOC-CARRIER-Z", "Carrier POP Z", "OK")],
  attachments: [attachment("ATT-CARRIER-KML", "KML", "carrier-longhaul.kml")],
});

export const blockedOpportunityMissingProtection = opportunity({
  requestId: "REQ-BLOCKED-PROTECTION",
  customer: googleCustomer,
  opportunityId: "OPP-BLOCKED-PROTECTION",
  opportunityName: "Blocked Opportunity Missing Protection",
  objectiveType: "AI_CORRIDOR",
  locations: [location("LOC-BLOCKED-PROTECTION", "AI Site", "TX")],
  attachments: [attachment("ATT-BLOCKED-PROTECTION", "CSV", "blocked-protection.csv")],
});

export const blockedOpportunityMissingLocation = opportunity({
  requestId: "REQ-BLOCKED-LOCATION",
  customer: googleCustomer,
  opportunityId: "OPP-BLOCKED-LOCATION",
  opportunityName: "Blocked Opportunity Missing Location",
  objectiveType: "AI_CORRIDOR",
  attachments: [attachment("ATT-BLOCKED-LOCATION", "CSV", "blocked-location.csv")],
});

export const readyToLaunchOpportunity = googleTexasAiOpportunity;

export const launchedToTranslateOpportunity = googleOklahomaAiOpportunity;

function launchInput(opportunityRequest: OpportunityRequest, networkType: NetworkType, schemaType?: ProtectionSchemaType): CustomerWorkspaceInputOpportunity {
  return {
    opportunity: opportunityRequest,
    networkIntent: networkIntent(opportunityRequest.customerId, opportunityRequest.opportunityId, networkType),
    protectionSchema: schemaType ? protectionSchema(opportunityRequest.customerId, opportunityRequest.opportunityId, schemaType) : undefined,
    stage: "READY_FOR_TRANSLATE",
  };
}

export const customerWorkspaceFixtureInputs: readonly CustomerWorkspaceInputOpportunity[] = Object.freeze([
  launchInput(googleTexasAiOpportunity, "AI_CORRIDOR", "DIVERSE"),
  launchInput(googleOklahomaAiOpportunity, "AI_CORRIDOR", "DIVERSE"),
  {
    ...launchInput(blockedOpportunityMissingProtection, "AI_CORRIDOR"),
    stage: "BLOCKED",
  },
  {
    ...launchInput(blockedOpportunityMissingLocation, "AI_CORRIDOR", "DIVERSE"),
    stage: "BLOCKED",
  },
]);

export const googleCustomerWorkspace: CustomerWorkspace = createCustomerWorkspace(googleCustomer, customerWorkspaceFixtureInputs);

export const customerWorkspaceFixtures = Object.freeze({
  googleCustomerWorkspace,
  googleTexasAiOpportunity,
  googleOklahomaAiOpportunity,
  metaAiCorridorOpportunity,
  oracleGpuExpansionOpportunity,
  carrierLongHaulOpportunity,
  blockedOpportunityMissingProtection,
  blockedOpportunityMissingLocation,
  readyToLaunchOpportunity,
  launchedToTranslateOpportunity,
  readyLaunchResult: evaluateOpportunityLaunchReadiness(launchInput(readyToLaunchOpportunity, "AI_CORRIDOR", "DIVERSE")),
  launchedToTranslateResult: launchOpportunityToTranslate(launchInput(launchedToTranslateOpportunity, "AI_CORRIDOR", "DIVERSE")),
  blockedMissingProtectionResult: evaluateOpportunityLaunchReadiness({
    opportunity: blockedOpportunityMissingProtection,
    networkIntent: networkIntent(blockedOpportunityMissingProtection.customerId, blockedOpportunityMissingProtection.opportunityId, "AI_CORRIDOR"),
  }),
  blockedMissingLocationResult: evaluateOpportunityLaunchReadiness(launchInput(blockedOpportunityMissingLocation, "AI_CORRIDOR", "DIVERSE")),
});

export function evaluateCustomerWorkspaceFixtures(): {
  workspace: CustomerWorkspace;
  opportunitySummaries: ReturnType<typeof createCustomerOpportunitySummary>[];
  launchResults: OpportunityLaunchResult[];
} {
  const opportunitySummaries = customerWorkspaceFixtureInputs.map(createCustomerOpportunitySummary);
  const launchResults = [
    customerWorkspaceFixtures.readyLaunchResult,
    customerWorkspaceFixtures.launchedToTranslateResult,
    customerWorkspaceFixtures.blockedMissingProtectionResult,
    customerWorkspaceFixtures.blockedMissingLocationResult,
  ];
  return {
    workspace: googleCustomerWorkspace,
    opportunitySummaries,
    launchResults,
  };
}
