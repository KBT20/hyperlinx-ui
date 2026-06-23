export type CorridorEvidenceSourceType =
  | "CUSTOMER_ROUTE"
  | "CUSTOMER_ENDPOINT"
  | "CSV"
  | "KML"
  | "KMZ"
  | "GEOJSON"
  | "SHAPEFILE"
  | "OSRM"
  | "GRAPHHOPPER"
  | "OPENROUTESERVICE"
  | "GOOGLE_ROADS"
  | "DOT_GIS"
  | "POWER_DATASET"
  | "PARCEL_DATASET"
  | "DATA_CENTER_DATASET"
  | "HUMAN_ENGINEERING"
  | "FIELD_VALIDATION"
  | "PERMIT_RECORD"
  | "UNKNOWN";

export type CorridorEvidenceAuthorityLevel = "EVIDENCE_ONLY";

export interface CorridorEvidenceSourceDefinition {
  sourceType: CorridorEvidenceSourceType;
  authorityLevel: CorridorEvidenceAuthorityLevel;
  defaultConfidence: number;
  supportsGeometry: boolean;
  supportsEndpoints: boolean;
  supportsConstraints: boolean;
  supportsCrossings: boolean;
  supportsPower: boolean;
  supportsInterconnection: boolean;
}

export const CORRIDOR_EVIDENCE_SOURCE_REGISTRY: Record<
  CorridorEvidenceSourceType,
  CorridorEvidenceSourceDefinition
> = {
  CUSTOMER_ROUTE: {
    sourceType: "CUSTOMER_ROUTE",
    authorityLevel: "EVIDENCE_ONLY",
    defaultConfidence: 82,
    supportsGeometry: true,
    supportsEndpoints: false,
    supportsConstraints: false,
    supportsCrossings: false,
    supportsPower: false,
    supportsInterconnection: false,
  },
  CUSTOMER_ENDPOINT: {
    sourceType: "CUSTOMER_ENDPOINT",
    authorityLevel: "EVIDENCE_ONLY",
    defaultConfidence: 80,
    supportsGeometry: false,
    supportsEndpoints: true,
    supportsConstraints: false,
    supportsCrossings: false,
    supportsPower: false,
    supportsInterconnection: true,
  },
  CSV: {
    sourceType: "CSV",
    authorityLevel: "EVIDENCE_ONLY",
    defaultConfidence: 58,
    supportsGeometry: true,
    supportsEndpoints: true,
    supportsConstraints: true,
    supportsCrossings: true,
    supportsPower: true,
    supportsInterconnection: true,
  },
  KML: {
    sourceType: "KML",
    authorityLevel: "EVIDENCE_ONLY",
    defaultConfidence: 74,
    supportsGeometry: true,
    supportsEndpoints: true,
    supportsConstraints: true,
    supportsCrossings: true,
    supportsPower: false,
    supportsInterconnection: true,
  },
  KMZ: {
    sourceType: "KMZ",
    authorityLevel: "EVIDENCE_ONLY",
    defaultConfidence: 74,
    supportsGeometry: true,
    supportsEndpoints: true,
    supportsConstraints: true,
    supportsCrossings: true,
    supportsPower: false,
    supportsInterconnection: true,
  },
  GEOJSON: {
    sourceType: "GEOJSON",
    authorityLevel: "EVIDENCE_ONLY",
    defaultConfidence: 76,
    supportsGeometry: true,
    supportsEndpoints: true,
    supportsConstraints: true,
    supportsCrossings: true,
    supportsPower: false,
    supportsInterconnection: true,
  },
  SHAPEFILE: {
    sourceType: "SHAPEFILE",
    authorityLevel: "EVIDENCE_ONLY",
    defaultConfidence: 80,
    supportsGeometry: true,
    supportsEndpoints: true,
    supportsConstraints: true,
    supportsCrossings: true,
    supportsPower: true,
    supportsInterconnection: true,
  },
  OSRM: {
    sourceType: "OSRM",
    authorityLevel: "EVIDENCE_ONLY",
    defaultConfidence: 55,
    supportsGeometry: true,
    supportsEndpoints: false,
    supportsConstraints: false,
    supportsCrossings: false,
    supportsPower: false,
    supportsInterconnection: false,
  },
  GRAPHHOPPER: {
    sourceType: "GRAPHHOPPER",
    authorityLevel: "EVIDENCE_ONLY",
    defaultConfidence: 60,
    supportsGeometry: true,
    supportsEndpoints: false,
    supportsConstraints: false,
    supportsCrossings: false,
    supportsPower: false,
    supportsInterconnection: false,
  },
  OPENROUTESERVICE: {
    sourceType: "OPENROUTESERVICE",
    authorityLevel: "EVIDENCE_ONLY",
    defaultConfidence: 60,
    supportsGeometry: true,
    supportsEndpoints: false,
    supportsConstraints: false,
    supportsCrossings: false,
    supportsPower: false,
    supportsInterconnection: false,
  },
  GOOGLE_ROADS: {
    sourceType: "GOOGLE_ROADS",
    authorityLevel: "EVIDENCE_ONLY",
    defaultConfidence: 65,
    supportsGeometry: true,
    supportsEndpoints: false,
    supportsConstraints: false,
    supportsCrossings: false,
    supportsPower: false,
    supportsInterconnection: false,
  },
  DOT_GIS: {
    sourceType: "DOT_GIS",
    authorityLevel: "EVIDENCE_ONLY",
    defaultConfidence: 82,
    supportsGeometry: true,
    supportsEndpoints: false,
    supportsConstraints: true,
    supportsCrossings: true,
    supportsPower: false,
    supportsInterconnection: false,
  },
  POWER_DATASET: {
    sourceType: "POWER_DATASET",
    authorityLevel: "EVIDENCE_ONLY",
    defaultConfidence: 78,
    supportsGeometry: true,
    supportsEndpoints: false,
    supportsConstraints: true,
    supportsCrossings: false,
    supportsPower: true,
    supportsInterconnection: false,
  },
  PARCEL_DATASET: {
    sourceType: "PARCEL_DATASET",
    authorityLevel: "EVIDENCE_ONLY",
    defaultConfidence: 72,
    supportsGeometry: true,
    supportsEndpoints: false,
    supportsConstraints: true,
    supportsCrossings: false,
    supportsPower: false,
    supportsInterconnection: false,
  },
  DATA_CENTER_DATASET: {
    sourceType: "DATA_CENTER_DATASET",
    authorityLevel: "EVIDENCE_ONLY",
    defaultConfidence: 74,
    supportsGeometry: true,
    supportsEndpoints: true,
    supportsConstraints: false,
    supportsCrossings: false,
    supportsPower: true,
    supportsInterconnection: true,
  },
  HUMAN_ENGINEERING: {
    sourceType: "HUMAN_ENGINEERING",
    authorityLevel: "EVIDENCE_ONLY",
    defaultConfidence: 92,
    supportsGeometry: true,
    supportsEndpoints: true,
    supportsConstraints: true,
    supportsCrossings: true,
    supportsPower: true,
    supportsInterconnection: true,
  },
  FIELD_VALIDATION: {
    sourceType: "FIELD_VALIDATION",
    authorityLevel: "EVIDENCE_ONLY",
    defaultConfidence: 95,
    supportsGeometry: true,
    supportsEndpoints: true,
    supportsConstraints: true,
    supportsCrossings: true,
    supportsPower: true,
    supportsInterconnection: true,
  },
  PERMIT_RECORD: {
    sourceType: "PERMIT_RECORD",
    authorityLevel: "EVIDENCE_ONLY",
    defaultConfidence: 86,
    supportsGeometry: false,
    supportsEndpoints: false,
    supportsConstraints: true,
    supportsCrossings: true,
    supportsPower: false,
    supportsInterconnection: false,
  },
  UNKNOWN: {
    sourceType: "UNKNOWN",
    authorityLevel: "EVIDENCE_ONLY",
    defaultConfidence: 25,
    supportsGeometry: true,
    supportsEndpoints: true,
    supportsConstraints: true,
    supportsCrossings: true,
    supportsPower: true,
    supportsInterconnection: true,
  },
};

export function getCorridorEvidenceSourceDefinition(sourceType: CorridorEvidenceSourceType) {
  return CORRIDOR_EVIDENCE_SOURCE_REGISTRY[sourceType] ?? CORRIDOR_EVIDENCE_SOURCE_REGISTRY.UNKNOWN;
}

