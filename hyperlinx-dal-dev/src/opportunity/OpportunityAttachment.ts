export type OpportunityAttachmentType =
  | "KMZ"
  | "KML"
  | "SHP"
  | "GEOJSON"
  | "CSV"
  | "XLSX"
  | "PDF"
  | "DOCX"
  | "ADDRESS_LIST"
  | "COORDINATE_LIST"
  | "TEXT_DESCRIPTION"
  | "RFP_PACKAGE";

export type OpportunityAttachmentStatus =
  | "REGISTERED"
  | "READY_FOR_TRANSLATE"
  | "UNSUPPORTED"
  | "BLOCKED";

export interface OpportunityAttachment {
  attachmentId: string;
  attachmentType: OpportunityAttachmentType;
  fileName?: string;
  sourceName?: string;
  description?: string;
  contentType?: string;
  sizeBytes?: number;
  status: OpportunityAttachmentStatus;
  registeredAt: string;
  metadata?: Record<string, unknown>;
}

export const OPPORTUNITY_ATTACHMENT_REGISTRY: readonly OpportunityAttachmentType[] = Object.freeze([
  "KMZ",
  "KML",
  "SHP",
  "GEOJSON",
  "CSV",
  "XLSX",
  "PDF",
  "DOCX",
  "ADDRESS_LIST",
  "COORDINATE_LIST",
  "TEXT_DESCRIPTION",
  "RFP_PACKAGE",
]);

export function isRegisteredOpportunityAttachmentType(value: string): value is OpportunityAttachmentType {
  return OPPORTUNITY_ATTACHMENT_REGISTRY.includes(value as OpportunityAttachmentType);
}
