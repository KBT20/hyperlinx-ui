export interface GoogleRfpDoctrine {
  doctrineId: string;
  name: string;
  customerSpecific: "GOOGLE";
  artifactPattern: {
    workbookTabs: string[];
    kmzInputs: string[];
    priorCostWorkbooks: string[];
  };
  reusableHyperscalerRules: string[];
  googleSpecificRules: string[];
}

export const googleHeliumRfpDoctrine: GoogleRfpDoctrine = {
  doctrineId: "GOOGLE_HELIUM_RFP_DOCTRINE_V1",
  name: "Google Helium RFP Bid Response Doctrine",
  customerSpecific: "GOOGLE",
  artifactPattern: {
    workbookTabs: ["Cover Page", "A Requirements", "B Location List", "C Network Spans for Bid", "D Vendor Response"],
    kmzInputs: ["HIU-Summary-06-03-2026.kmz", "MUS 07162024.kmz"],
    priorCostWorkbooks: ["Google Fiber Project - 20251121.xlsx", "Dobson ILA Cost Summary 27 vs 36 Racks.xlsx"],
  },
  reusableHyperscalerRules: [
    "RFP intake creates route requirements and response artifacts.",
    "Customer locations become Teralinx sites.",
    "Requested spans become route requirements.",
    "Centerline corridors and takeoffs remain sales estimates until Route Engineering certification.",
    "Vendor workbook values are staged, not written, until a future explicit export phase.",
  ],
  googleSpecificRules: [
    "Tab D Vendor Response is the workbook target for bid values.",
    "Vendor proposed KMZ spans must be staged for customer review.",
    "Helium to Stillwater must be compared against Helium to Muskogee for diversity readiness.",
  ],
};
