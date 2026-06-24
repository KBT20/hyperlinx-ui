import type { OpportunityAttachment } from "../OpportunityAttachment";
import type { OpportunityObjective } from "../OpportunityObjective";
import type { OpportunityLocation } from "../OpportunityRequest";
import {
  createOpportunityIntakeViewModel,
  createOpportunityPackage,
  createOpportunityRequest,
  evaluateTranslateReadiness,
  type CreateOpportunityRequestInput,
} from "../OpportunityIntakeEngine";

const requestedDate = "2026-06-24";

function attachment(attachmentId: string, attachmentType: OpportunityAttachment["attachmentType"], fileName: string): OpportunityAttachment {
  return {
    attachmentId,
    attachmentType,
    fileName,
    sourceName: fileName,
    status: "REGISTERED",
    registeredAt: `${requestedDate}T00:00:00.000Z`,
  };
}

function location(locationId: string, siteName: string, role: OpportunityLocation["role"], latitude: number, longitude: number, state = "TX"): OpportunityLocation {
  return {
    locationId,
    role,
    siteName,
    latitude,
    longitude,
    state,
    country: "US",
    locationConfidence: "HIGH",
  };
}

function objective(objectiveId: string, objectiveType: OpportunityObjective["objectiveType"], products: OpportunityObjective["requestedProducts"]): OpportunityObjective {
  return {
    objectiveId,
    objectiveType,
    priority: "STRATEGIC",
    requestedProducts: products,
    requestedServices: ["FEASIBILITY", "ROUTE_ANALYSIS", "BUDGETARY_QUOTE"],
  };
}

const googleTexasAiExpansion: CreateOpportunityRequestInput = {
  requestId: "REQ-GOOGLE-TEXAS-AI",
  customerId: "CUST-GOOGLE",
  customerName: "Google",
  customerType: "HYPERSCALER",
  opportunityId: "OPP-GOOGLE-TEXAS-AI",
  opportunityName: "Google Texas AI Expansion",
  accountOwner: "Strategic Accounts",
  businessSponsor: "Cloud Infrastructure",
  requestedDate,
  source: "STRATEGIC_ACCOUNT",
  objectives: [objective("OBJ-GOOGLE-TX-AI", "AI_CORRIDOR", ["AI_INTERCONNECT", "DARK_FIBER", "POWER_INFRASTRUCTURE"])],
  locations: [
    location("LOC-GOOGLE-TX-ORIGIN", "Dallas Metro", "ORIGIN", 32.7767, -96.797),
    location("LOC-GOOGLE-TX-CANDIDATE", "West Texas AI Site", "CANDIDATE", 31.9973, -102.0779),
  ],
  attachments: [attachment("ATT-GOOGLE-TX-SITES", "CSV", "google-texas-ai-sites.csv"), attachment("ATT-GOOGLE-TX-KMZ", "KMZ", "google-texas-reference.kmz")],
  narrative: "Evaluate AI interconnect and power-adjacent fiber expansion opportunities across Texas.",
};

const googleOklahomaAiExpansion: CreateOpportunityRequestInput = {
  ...googleTexasAiExpansion,
  requestId: "REQ-GOOGLE-OKLAHOMA-AI",
  opportunityId: "OPP-GOOGLE-OKLAHOMA-AI",
  opportunityName: "Google Oklahoma AI Expansion",
  locations: [
    location("LOC-GOOGLE-OK-ORIGIN", "Dallas Metro", "ORIGIN", 32.7767, -96.797),
    location("LOC-GOOGLE-OK-CANDIDATE", "Oklahoma AI Campus", "CANDIDATE", 35.4676, -97.5164, "OK"),
  ],
  attachments: [attachment("ATT-GOOGLE-OK-RFP", "RFP_PACKAGE", "google-oklahoma-ai-rfp.zip")],
};

const metaAiCorridor: CreateOpportunityRequestInput = {
  requestId: "REQ-META-AI-CORRIDOR",
  customerId: "CUST-META",
  customerName: "Meta",
  customerType: "HYPERSCALER",
  opportunityId: "OPP-META-AI-CORRIDOR",
  opportunityName: "Meta AI Corridor",
  accountOwner: "Strategic Accounts",
  requestedDate,
  source: "CUSTOMER_RFP",
  objectives: [objective("OBJ-META-DIVERSE", "DUAL_DIVERSE_ROUTE", ["DARK_FIBER", "PRIVATE_NETWORK"])],
  locations: [
    location("LOC-META-A", "Fort Worth Data Center", "ORIGIN", 32.7555, -97.3308),
    location("LOC-META-Z", "Kansas City Interconnect", "DESTINATION", 39.0997, -94.5786, "MO"),
  ],
  attachments: [attachment("ATT-META-KML", "KML", "meta-ai-corridor.kml")],
};

const oracleGpuExpansion: CreateOpportunityRequestInput = {
  requestId: "REQ-ORACLE-GPU",
  customerId: "CUST-ORACLE",
  customerName: "Oracle",
  customerType: "HYPERSCALER",
  opportunityId: "OPP-ORACLE-GPU",
  opportunityName: "Oracle GPU Expansion",
  accountOwner: "Strategic Accounts",
  requestedDate,
  source: "ACCOUNT_TEAM",
  objectives: [objective("OBJ-ORACLE-GPU", "GPU_INFRASTRUCTURE", ["GPU_FACILITY", "DATA_CENTER", "POWER_INFRASTRUCTURE"])],
  locations: [location("LOC-ORACLE-GPU", "Oracle GPU Region", "CANDIDATE", 33.4484, -112.074, "AZ")],
  attachments: [attachment("ATT-ORACLE-DOC", "DOCX", "oracle-gpu-expansion-brief.docx")],
};

const carrierLongHaulRoute: CreateOpportunityRequestInput = {
  requestId: "REQ-CARRIER-LONG-HAUL",
  customerId: "CUST-CARRIER",
  customerName: "Carrier Partner",
  customerType: "CARRIER",
  opportunityId: "OPP-CARRIER-LONG-HAUL",
  opportunityName: "Carrier Long Haul Route",
  accountOwner: "Wholesale",
  requestedDate,
  source: "PARTNER",
  objectives: [objective("OBJ-CARRIER-LH", "LONG_HAUL", ["DARK_FIBER", "WAVE"])],
  locations: [
    location("LOC-CARRIER-A", "Dallas", "ORIGIN", 32.7767, -96.797),
    location("LOC-CARRIER-Z", "Tulsa", "DESTINATION", 36.154, -95.9928, "OK"),
  ],
  attachments: [attachment("ATT-CARRIER-GEOJSON", "GEOJSON", "carrier-long-haul.geojson")],
};

const metroAggregation: CreateOpportunityRequestInput = {
  requestId: "REQ-METRO-AGG",
  customerId: "CUST-METRO",
  customerName: "Metro Aggregation Customer",
  customerType: "ISP",
  opportunityId: "OPP-METRO-AGG",
  opportunityName: "Metro Aggregation",
  accountOwner: "Regional Sales",
  requestedDate,
  source: "ACCOUNT_TEAM",
  objectives: [objective("OBJ-METRO", "METRO_EXPANSION", ["ETHERNET", "MANAGED_FIBER"])],
  locations: [
    location("LOC-METRO-1", "Metro Hub", "ORIGIN", 29.7604, -95.3698),
    location("LOC-METRO-2", "Metro Site 2", "CANDIDATE", 29.756, -95.36),
  ],
  attachments: [attachment("ATT-METRO-XLSX", "XLSX", "metro-sites.xlsx")],
};

const enterpriseAccess: CreateOpportunityRequestInput = {
  requestId: "REQ-ENTERPRISE-ACCESS",
  customerId: "CUST-ENTERPRISE",
  customerName: "Enterprise Customer",
  customerType: "ENTERPRISE",
  opportunityId: "OPP-ENTERPRISE-ACCESS",
  opportunityName: "Enterprise Access",
  accountOwner: "Enterprise Sales",
  requestedDate,
  source: "CUSTOMER_EMAIL",
  objectives: [objective("OBJ-ENTERPRISE", "ENTERPRISE_ACCESS", ["INTERNET", "ETHERNET"])],
  locations: [location("LOC-ENTERPRISE", "Enterprise HQ", "CANDIDATE", 30.2672, -97.7431)],
  attachments: [attachment("ATT-ENTERPRISE-ADDRESS", "ADDRESS_LIST", "enterprise-address-list.csv")],
};

const darkFiberRequest: CreateOpportunityRequestInput = {
  requestId: "REQ-DARK-FIBER",
  customerId: "CUST-DARK-FIBER",
  customerName: "Dark Fiber Customer",
  customerType: "ENTERPRISE",
  opportunityId: "OPP-DARK-FIBER",
  opportunityName: "Dark Fiber Request",
  accountOwner: "Enterprise Sales",
  requestedDate,
  source: "CUSTOMER_RFP",
  objectives: [objective("OBJ-DARK-FIBER", "DARK_FIBER", ["DARK_FIBER"])],
  locations: [
    location("LOC-DARK-A", "Primary Site", "ORIGIN", 32.7767, -96.797),
    location("LOC-DARK-Z", "DR Site", "DESTINATION", 33.0198, -96.6989),
  ],
  attachments: [attachment("ATT-DARK-PDF", "PDF", "dark-fiber-rfp.pdf")],
};

const incompleteOpportunity: CreateOpportunityRequestInput = {
  requestId: "REQ-INCOMPLETE",
  customerId: "",
  customerName: "",
  customerType: "OTHER",
  opportunityId: "OPP-INCOMPLETE",
  opportunityName: "Incomplete Opportunity",
  accountOwner: "",
  requestedDate,
  source: "MANUAL",
  objectives: [],
  locations: [],
  attachments: [],
};

const readyForTranslateOpportunity: CreateOpportunityRequestInput = {
  requestId: "REQ-READY-TRANSLATE",
  customerId: "CUST-READY",
  customerName: "Ready Customer",
  customerType: "NEOCLOUD",
  opportunityId: "OPP-READY-TRANSLATE",
  opportunityName: "Ready For Translate Opportunity",
  accountOwner: "Strategic Accounts",
  requestedDate,
  source: "MANUAL",
  objectives: [objective("OBJ-READY", "AI_CORRIDOR", ["AI_INTERCONNECT"])],
  locations: [location("LOC-READY", "Ready Site", "CANDIDATE", 35.222, -101.8313)],
  attachments: [attachment("ATT-READY-KMZ", "KMZ", "ready-translate.kmz")],
};

export const opportunityIntakeInputFixtures = Object.freeze([
  googleTexasAiExpansion,
  googleOklahomaAiExpansion,
  metaAiCorridor,
  oracleGpuExpansion,
  carrierLongHaulRoute,
  metroAggregation,
  enterpriseAccess,
  darkFiberRequest,
  incompleteOpportunity,
  readyForTranslateOpportunity,
]);

export const opportunityIntakeFixtures = Object.freeze(
  opportunityIntakeInputFixtures.map((input) => {
    const request = createOpportunityRequest(input);
    return {
      request,
      readiness: evaluateTranslateReadiness(request),
      packageCandidate: createOpportunityPackage(request),
      viewModel: createOpportunityIntakeViewModel(request),
    };
  }),
);

export function evaluateOpportunityIntakeFixtures() {
  return opportunityIntakeFixtures;
}
