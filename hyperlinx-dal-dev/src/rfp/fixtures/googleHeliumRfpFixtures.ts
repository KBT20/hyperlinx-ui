import type { GoogleRfpOpportunity } from "../GoogleRfpOpportunity";
import type { GoogleRfpSite } from "../GoogleRfpRouteRequirement";
import { buildGoogleRfpBidPlan } from "../GoogleRfpResponseEngine";

const heliumSite: GoogleRfpSite = {
  siteId: "GOOGLE-HIU",
  siteCode: "HIU",
  role: "A_SITE" as const,
  facilityName: "Helium / HIU near Dodge City, KS",
  address: "Helium Campus, near Dodge City, KS",
  city: "Dodge City Area",
  state: "KS",
  latitude: 37.27373229544936,
  longitude: -98.44683450556334,
  sourceArtifact: "HIU-Summary-06-03-2026.kmz / HIU placemark",
  sourceConfidence: 96,
  coordinateStatus: "VERIFIED_FROM_KMZ",
};

const muskogeeSite: GoogleRfpSite = {
  siteId: "GOOGLE-MUS",
  siteCode: "MUS",
  role: "Z_SITE" as const,
  facilityName: "Muskogee / MUS Campus",
  address: "Muskogee Campus, Muskogee, OK",
  city: "Muskogee",
  state: "OK",
  latitude: 35.683347,
  longitude: -95.38984799999999,
  sourceArtifact: "MUS 07162024.kmz / KAMO MUS placemark",
  sourceConfidence: 94,
  coordinateStatus: "VERIFIED_FROM_KMZ",
};

const stillwaterSite: GoogleRfpSite = {
  siteId: "GOOGLE-SWR",
  siteCode: "SWR",
  role: "Z_SITE" as const,
  facilityName: "Stillwater / SWR Campus",
  address: "Stillwater Campus, Stillwater, OK",
  city: "Stillwater",
  state: "OK",
  latitude: 36.17190069110111,
  longitude: -97.03890329471994,
  sourceArtifact: "HIU-Summary-06-03-2026.kmz / SWR placemark",
  sourceConfidence: 92,
  coordinateStatus: "VERIFIED_FROM_KMZ",
};

export const googleHeliumRfpOpportunity: GoogleRfpOpportunity = {
  rfpId: "GOOGLE-HELIUM-RFP-2026-06",
  customerId: "CUSTOMER-GOOGLE",
  customerName: "Google",
  opportunityId: "OPP-GOOGLE-HELIUM-CAMPUS-RFP",
  opportunityName: "Helium Campus RFP",
  issueDate: "2026-06-05",
  kmzDeadline: "2026-06-19",
  budgetaryDeadline: "2026-06-30",
  requestedRoutes: [
    {
      routeRequirementId: "GOOGLE-HELIUM-HIU-MUS",
      bidSegmentName: "Helium / HIU to Muskogee / MUS",
      aSite: heliumSite,
      zSite: muskogeeSite,
      requiredProduct: "DUCT_PLUS_FIBER",
      fiberCount: 288,
      ductRequirement: "Customer workbook requirement; confirm conduit count and size during commercial review.",
      protectionRequirement: "PATH_PROTECTED",
      diversityRequirement: "NONE",
      kmzFolderTarget: "Vendor Proposed KMZ / HIU to MUS",
      status: "READY_FOR_DESIGN",
    },
    {
      routeRequirementId: "GOOGLE-HELIUM-HIU-SWR",
      bidSegmentName: "Helium / HIU to Stillwater / SWR",
      aSite: heliumSite,
      zSite: stillwaterSite,
      requiredProduct: "DUCT_PLUS_FIBER",
      fiberCount: 288,
      ductRequirement: "Customer workbook requirement; confirm conduit count and size during commercial review.",
      protectionRequirement: "PATH_PROTECTED",
      diversityRequirement: "DIVERSE_FROM_ROUTE",
      diverseFromRouteRequirementId: "GOOGLE-HELIUM-HIU-MUS",
      kmzFolderTarget: "Vendor Proposed KMZ / HIU to SWR",
      status: "READY_FOR_DESIGN",
    },
  ],
  requiredAttachments: [
    { attachmentId: "GOOGLE-HELIUM-KMZ", attachmentType: "VENDOR_PROPOSED_KMZ", label: "Vendor proposed KMZ spans", status: "STAGED" },
    { attachmentId: "GOOGLE-HELIUM-TABD", attachmentType: "VENDOR_RESPONSE_WORKBOOK", label: "Google workbook tab D Vendor Response", status: "STAGED" },
    { attachmentId: "GOOGLE-HELIUM-QUOTE", attachmentType: "BUDGETARY_QUOTE", label: "Budgetary quote attachment", status: "STAGED" },
    { attachmentId: "GOOGLE-HELIUM-EMAIL", attachmentType: "QUOTE_EMAIL", label: "Quote attachment by email", status: "NOT_STARTED" },
  ],
  responseContacts: [
    { contactId: "GOOGLE-RFP-CONTACT", name: "Google RFP Contact", role: "Customer procurement / network sourcing" },
    { contactId: "TERALINX-OWNER", name: "Ryan", role: "Teralinx commercial owner" },
  ],
  submissionInstructions: [
    "Stage vendor proposed KMZ spans for customer review.",
    "Populate D Vendor Response preview before workbook export.",
    "Prepare budgetary submission by 2026-06-30.",
    "Do not submit externally from DAL; email/submission remains a human commercial action.",
  ],
  status: "BUDGETARY_IN_PROGRESS",
  reusableWorkflow: true,
};

export const googleHeliumBidPlanFixture = buildGoogleRfpBidPlan(googleHeliumRfpOpportunity);
