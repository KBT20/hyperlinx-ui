import type { CorridorEndpoint, CorridorRequirement } from "../../corridor/corridorTypes";
import type { Customer } from "../CustomerContract";
import type { Opportunity, OpportunityRequestedProduct, OpportunityType } from "../OpportunityContract";

const createdAt = "2026-06-23T00:00:00.000Z";

function endpoint(endpointId: string, name: string, type: CorridorEndpoint["type"], role: CorridorEndpoint["role"]): CorridorEndpoint {
  return {
    endpointId,
    name,
    type,
    role,
    evidenceIds: [`EV-${endpointId}`],
  };
}

function requirement(requirementId: string, serviceType: CorridorRequirement["serviceType"], bandwidth: string): CorridorRequirement {
  return {
    requirementId,
    serviceType,
    bandwidth,
    designTopology: "LINEAR",
    desiredDiversity: "ROUTE_DIVERSE",
    routeDiversityRequired: true,
    evidenceIds: [`EV-${requirementId}`],
  };
}

function customer(input: Pick<Customer, "customerId" | "customerName" | "customerType" | "customerSegment" | "industry" | "accountOwner" | "relationshipStatus">): Customer {
  return {
    ...input,
    contacts: [
      {
        contactId: `${input.customerId}-CONTACT-PRIMARY`,
        name: `${input.customerName} Primary Contact`,
        role: "Commercial Sponsor",
        primary: true,
      },
    ],
    billingProfile: {
      billingProfileId: `${input.customerId}-BILLING`,
      billingName: input.customerName,
    },
    legalProfile: {
      legalProfileId: `${input.customerId}-LEGAL`,
      legalName: input.customerName,
    },
    relationships: [
      {
        relationshipId: `${input.customerId}-RELATIONSHIP`,
        customerId: input.customerId,
        relationshipStatus: input.relationshipStatus,
        accountOwner: input.accountOwner,
        updatedAt: createdAt,
      },
    ],
    createdAt,
    updatedAt: createdAt,
  };
}

function opportunity(input: {
  opportunityId: string;
  customerId: string;
  customerType: Opportunity["customerType"];
  opportunityName: string;
  opportunityType: OpportunityType;
  requestedProducts: OpportunityRequestedProduct[];
  endpoints: CorridorEndpoint[];
  requirements: CorridorRequirement[];
  commercialOwner: string;
  technicalOwner?: string;
  corridorIds: string[];
  scopeVersionIds?: string[];
}): Opportunity {
  return {
    opportunityId: input.opportunityId,
    customerId: input.customerId,
    customerType: input.customerType,
    opportunityName: input.opportunityName,
    opportunityType: input.opportunityType,
    requestedProducts: input.requestedProducts,
    requestedEndpoints: input.endpoints,
    customerRequirements: input.requirements,
    commercialOwner: input.commercialOwner,
    technicalOwner: input.technicalOwner,
    status: "CORRIDOR_ANALYSIS",
    corridorIds: input.corridorIds,
    selectedScopeVersionIds: input.scopeVersionIds ?? [],
    traceability: {
      customerId: input.customerId,
      opportunityId: input.opportunityId,
      corridorIds: input.corridorIds,
      scopeVersionIds: input.scopeVersionIds ?? [],
      marketplaceBudgetIds: [],
      contractIds: [],
      controlWorkPackageIds: [],
      fieldClosureIds: [],
    },
    createdAt,
    updatedAt: createdAt,
  };
}

export const customerOpportunityFixtures = Object.freeze([
  {
    label: "Google AI Expansion",
    customer: customer({
      customerId: "CUST-GOOGLE",
      customerName: "Google",
      customerType: "HYPERSCALER",
      customerSegment: "AI_EXPANSION",
      industry: "Cloud and AI Infrastructure",
      accountOwner: "Strategic Accounts",
      relationshipStatus: "STRATEGIC_ACCOUNT",
    }),
    opportunity: opportunity({
      opportunityId: "OPP-GOOGLE-AI-EXPANSION",
      customerId: "CUST-GOOGLE",
      customerType: "HYPERSCALER",
      opportunityName: "Google AI Expansion",
      opportunityType: "AI_INTERCONNECT",
      requestedProducts: ["AI_INTERCONNECT", "WAVE_SERVICE"],
      endpoints: [
        endpoint("END-GOOGLE-DFW", "Dallas AI Region", "HYPERSCALER_CAMPUS", "A_END"),
        endpoint("END-GOOGLE-KC", "Kansas City AI Region", "HYPERSCALER_CAMPUS", "Z_END"),
      ],
      requirements: [requirement("REQ-GOOGLE-800G", "AI_INTERCONNECT", "800G")],
      commercialOwner: "Strategic Accounts",
      technicalOwner: "Route Engineering",
      corridorIds: ["CORR-GOOGLE-DFW-KC-AI"],
    }),
  },
  {
    label: "Oracle Data Center Interconnect",
    customer: customer({
      customerId: "CUST-ORACLE",
      customerName: "Oracle",
      customerType: "HYPERSCALER",
      customerSegment: "STRATEGIC",
      industry: "Cloud Infrastructure",
      accountOwner: "Strategic Accounts",
      relationshipStatus: "QUALIFIED",
    }),
    opportunity: opportunity({
      opportunityId: "OPP-ORACLE-DCI",
      customerId: "CUST-ORACLE",
      customerType: "HYPERSCALER",
      opportunityName: "Oracle Data Center Interconnect",
      opportunityType: "DATA_CENTER_INTERCONNECT",
      requestedProducts: ["WAVE_SERVICE", "ETHERNET_TRANSPORT"],
      endpoints: [
        endpoint("END-ORACLE-DC-A", "Oracle DC A", "DATA_CENTER", "A_END"),
        endpoint("END-ORACLE-DC-Z", "Oracle DC Z", "DATA_CENTER", "Z_END"),
      ],
      requirements: [requirement("REQ-ORACLE-400G", "WAVE", "400G")],
      commercialOwner: "Cloud Accounts",
      technicalOwner: "Transport Engineering",
      corridorIds: ["CORR-ORACLE-DCI-METRO"],
    }),
  },
  {
    label: "Meta Long Haul Corridor",
    customer: customer({
      customerId: "CUST-META",
      customerName: "Meta",
      customerType: "HYPERSCALER",
      customerSegment: "STRATEGIC",
      industry: "Cloud and Social Infrastructure",
      accountOwner: "Strategic Accounts",
      relationshipStatus: "QUALIFIED",
    }),
    opportunity: opportunity({
      opportunityId: "OPP-META-LONG-HAUL",
      customerId: "CUST-META",
      customerType: "HYPERSCALER",
      opportunityName: "Meta Long Haul Corridor",
      opportunityType: "LONG_HAUL",
      requestedProducts: ["DARK_FIBER_IRU", "WAVE_SERVICE"],
      endpoints: [
        endpoint("END-META-DFW", "Meta DFW", "HYPERSCALER_CAMPUS", "A_END"),
        endpoint("END-META-ATL", "Meta Atlanta", "HYPERSCALER_CAMPUS", "Z_END"),
      ],
      requirements: [requirement("REQ-META-LH", "DARK_FIBER", "432F")],
      commercialOwner: "Strategic Accounts",
      technicalOwner: "Route Engineering",
      corridorIds: ["CORR-META-DFW-ATL"],
    }),
  },
  {
    label: "CoreWeave AI Fabric",
    customer: customer({
      customerId: "CUST-COREWEAVE",
      customerName: "CoreWeave",
      customerType: "NEOCLOUD",
      customerSegment: "AI_EXPANSION",
      industry: "AI Compute",
      accountOwner: "Neocloud Accounts",
      relationshipStatus: "ACTIVE",
    }),
    opportunity: opportunity({
      opportunityId: "OPP-COREWEAVE-AI-FABRIC",
      customerId: "CUST-COREWEAVE",
      customerType: "NEOCLOUD",
      opportunityName: "CoreWeave AI Fabric",
      opportunityType: "AI_INTERCONNECT",
      requestedProducts: ["AI_INTERCONNECT", "DARK_FIBER_IRU"],
      endpoints: [
        endpoint("END-CW-GPU", "GPU Array", "GPU_FACILITY", "A_END"),
        endpoint("END-CW-CLOUD", "Cloud On-Ramp", "CLOUD_ONRAMP", "Z_END"),
      ],
      requirements: [requirement("REQ-CW-AI", "AI_INTERCONNECT", "1.6T")],
      commercialOwner: "Neocloud Accounts",
      technicalOwner: "Interconnection Engineering",
      corridorIds: ["CORR-COREWEAVE-AI-FABRIC"],
    }),
  },
  {
    label: "Crusoe West Texas Expansion",
    customer: customer({
      customerId: "CUST-CRUSOE",
      customerName: "Crusoe",
      customerType: "NEOCLOUD",
      customerSegment: "AI_EXPANSION",
      industry: "AI and Energy Infrastructure",
      accountOwner: "Neocloud Accounts",
      relationshipStatus: "QUALIFIED",
    }),
    opportunity: opportunity({
      opportunityId: "OPP-CRUSOE-WTX",
      customerId: "CUST-CRUSOE",
      customerType: "NEOCLOUD",
      opportunityName: "Crusoe West Texas Expansion",
      opportunityType: "AI_INTERCONNECT",
      requestedProducts: ["AI_INTERCONNECT", "MANAGED_FIBER"],
      endpoints: [
        endpoint("END-CRUSOE-WTX", "West Texas AI Site", "GPU_FACILITY", "A_END"),
        endpoint("END-CRUSOE-DALLAS", "Dallas Interconnect", "CARRIER_HOTEL", "Z_END"),
      ],
      requirements: [requirement("REQ-CRUSOE-WTX", "AI_INTERCONNECT", "400G")],
      commercialOwner: "Neocloud Accounts",
      technicalOwner: "Route Engineering",
      corridorIds: ["CORR-CRUSOE-WTX-DALLAS"],
    }),
  },
  {
    label: "FiberLight Transport Opportunity",
    customer: customer({
      customerId: "CUST-FIBERLIGHT",
      customerName: "FiberLight",
      customerType: "CARRIER",
      customerSegment: "WHOLESALE",
      industry: "Carrier Infrastructure",
      accountOwner: "Carrier Accounts",
      relationshipStatus: "ACTIVE",
    }),
    opportunity: opportunity({
      opportunityId: "OPP-FIBERLIGHT-TRANSPORT",
      customerId: "CUST-FIBERLIGHT",
      customerType: "CARRIER",
      opportunityName: "FiberLight Transport Opportunity",
      opportunityType: "TRANSPORT",
      requestedProducts: ["WAVE_SERVICE", "ROUTE_OPERATIONS"],
      endpoints: [
        endpoint("END-FBL-POP-A", "FiberLight POP A", "CARRIER_HOTEL", "A_END"),
        endpoint("END-FBL-POP-Z", "FiberLight POP Z", "CARRIER_HOTEL", "Z_END"),
      ],
      requirements: [requirement("REQ-FBL-WAVE", "WAVE", "100G")],
      commercialOwner: "Carrier Accounts",
      technicalOwner: "Transport Engineering",
      corridorIds: ["CORR-FIBERLIGHT-TRANSPORT"],
    }),
  },
  {
    label: "360 Broadband Metro Opportunity",
    customer: customer({
      customerId: "CUST-360-BROADBAND",
      customerName: "360 Broadband",
      customerType: "ISP",
      customerSegment: "REGIONAL",
      industry: "Broadband",
      accountOwner: "Regional Accounts",
      relationshipStatus: "PROSPECT",
    }),
    opportunity: opportunity({
      opportunityId: "OPP-360-METRO",
      customerId: "CUST-360-BROADBAND",
      customerType: "ISP",
      opportunityName: "360 Broadband Metro Opportunity",
      opportunityType: "METRO",
      requestedProducts: ["DUCT_SALE", "MANAGED_FIBER"],
      endpoints: [
        endpoint("END-360-HEADEND", "360 Broadband Headend", "MUNICIPAL_SITE", "A_END"),
        endpoint("END-360-METRO", "Metro Aggregation Area", "MUNICIPAL_SITE", "Z_END"),
      ],
      requirements: [requirement("REQ-360-METRO", "DUCT", "2 duct")],
      commercialOwner: "Regional Accounts",
      technicalOwner: "Metro Engineering",
      corridorIds: ["CORR-360-METRO"],
    }),
  },
]);

export function listCustomerOpportunityFixtures() {
  return customerOpportunityFixtures;
}
