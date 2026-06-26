export interface GoogleRfpVendorResponseField {
  fieldId: string;
  googleTab: "D Vendor Response";
  googleFieldName: string;
  hyperlinxSource: string;
  value: string | number | boolean;
  readiness: "READY" | "PENDING_ENGINEERING" | "PENDING_COMMERCIAL" | "BLOCKED";
  notes?: string;
}

export interface GoogleRfpVendorResponsePreview {
  vendorResponseId: string;
  routeRequirementId: string;
  bidSegmentName: string;
  fields: GoogleRfpVendorResponseField[];
  workbookTabTarget: "D Vendor Response";
  status: "PREVIEW_READY" | "BLOCKED";
  noWorkbookWrite: true;
}
