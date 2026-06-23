export type TranslateSourceType = "CSV" | "GEOJSON" | "KML" | "KMZ";

export type TranslateArtifactType = "ENDPOINT" | "ROUTE_CANDIDATE";

export interface TranslateSourceDescriptor {
  sourceType: TranslateSourceType;
  fileName: string;
  mimeType?: string;
}

export interface TranslateTextInput extends TranslateSourceDescriptor {
  text: string;
}

export interface TranslateBinaryInput extends TranslateSourceDescriptor {
  data: ArrayBuffer;
}

export interface TranslateArtifact {
  artifactId: string;
  artifactType: TranslateArtifactType;
  entityId: string;
  evidenceIds: string[];
  label: string;
  summary: Record<string, unknown>;
}

