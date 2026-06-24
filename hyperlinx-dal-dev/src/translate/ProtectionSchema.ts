export type ProtectionSchemaType = "LINEAR" | "DIVERSE" | "RING" | "MESH";

export interface ProtectionSchema {
  protectionSchemaId: string;
  schemaType: ProtectionSchemaType;
  customerId: string;
  opportunityId: string;
  selectedBy?: string;
  selectedAt: string;
  source: "CUSTOMER_PROVIDED" | "ACCOUNT_TEAM" | "TRANSLATE_INFERRED" | "MANUAL";
  confidence: "LOW" | "MEDIUM" | "HIGH" | "VERIFIED";
  notes?: string;
}

export interface ProtectionSelectorModel {
  modelId: "PROTECTION_SELECTOR";
  supportedProtectionSchemas: ProtectionSchemaType[];
  selectedProtectionSchema?: ProtectionSchemaType;
  selectionRequired: true;
  noAuthorityCreated: true;
}

export const SUPPORTED_PROTECTION_SCHEMAS: readonly ProtectionSchemaType[] = Object.freeze([
  "LINEAR",
  "DIVERSE",
  "RING",
  "MESH",
]);
