import type { CorridorLensObjectType } from "../corridor/CorridorLens";
import type { NetworkType } from "./NetworkIntent";
import type { ProtectionSchemaType } from "./ProtectionSchema";

export type ReferenceArchitectureId = `${NetworkType}_${ProtectionSchemaType}_REFERENCE_ARCHITECTURE`;

export interface ArchitectureSelection {
  selectionId: string;
  networkType: NetworkType;
  protectionSchema: ProtectionSchemaType;
  referenceArchitectureId: ReferenceArchitectureId;
  referenceArchitectureName: string;
  designStandardIds: string[];
  objectCatalogTypes: CorridorLensObjectType[];
  selectedAt: string;
  selectionBasis: string[];
  humanReviewRequired: true;
  nonAuthoritative: true;
}

export interface ArchitectureSummaryCardModel {
  modelId: "ARCHITECTURE_SUMMARY_CARD";
  referenceArchitectureId: ReferenceArchitectureId;
  referenceArchitectureName: string;
  networkType: NetworkType;
  protectionSchema: ProtectionSchemaType;
  objectCount: number;
  standardCount: number;
  humanReviewRequired: true;
}
