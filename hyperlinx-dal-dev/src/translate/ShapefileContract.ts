import type { CorridorEvidenceBundle } from "../corridor/CorridorNormalizedEvidence";
import type { CorridorCoordinate } from "../corridor/corridorTypes";

export type ShapefileGeometryType =
  | "POINT"
  | "MULTIPOINT"
  | "LINESTRING"
  | "MULTILINESTRING"
  | "POLYGON"
  | "MULTIPOLYGON"
  | "UNKNOWN";

export type ShapefileComponentType = "shp" | "shx" | "dbf" | "prj" | "cpg";

export type ShapefileDiagnosticCode =
  | "SHAPEFILE_PACKAGE_LOADED"
  | "SHAPEFILE_MISSING_COMPONENT"
  | "SHAPEFILE_LAYER_DISCOVERED"
  | "SHAPEFILE_FEATURE_EXTRACTED"
  | "SHAPEFILE_WARNING"
  | "SHAPEFILE_ERROR";

export interface ShapefileDiagnostic {
  diagnosticId: string;
  code: ShapefileDiagnosticCode;
  severity: "INFO" | "WARNING" | "ERROR";
  message: string;
  layerName?: string;
  featureId?: string;
  details?: Record<string, unknown>;
}

export interface ShapefileAttribute {
  sourceFieldName: string;
  normalizedFieldName: string;
  value: string | number | boolean | null;
  fieldType?: string;
}

export interface NormalizedAttributeSet {
  attributes: ShapefileAttribute[];
  originalFieldNames: string[];
  unknownFieldNames: string[];
  duplicateFieldNames: string[];
  missingFieldNames: string[];
  rawProperties: Record<string, string | number | boolean | null>;
}

export interface ShapefileGeometry {
  geometryType: ShapefileGeometryType;
  coordinates: CorridorCoordinate | CorridorCoordinate[] | CorridorCoordinate[][] | CorridorCoordinate[][][];
  bbox?: [minLon: number, minLat: number, maxLon: number, maxLat: number];
  sourceShapeType?: number;
}

export interface ShapefileFeature {
  featureId: string;
  recordNumber: number;
  geometry: ShapefileGeometry;
  attributes: NormalizedAttributeSet;
}

export interface ShapefileLayer {
  layerId: string;
  layerName: string;
  shapeType?: number;
  projection?: string;
  coordinateSystem: "WGS84" | "NAD83" | "UNKNOWN";
  features: ShapefileFeature[];
  diagnostics: ShapefileDiagnostic[];
}

export interface ShapefilePackage {
  packageId: string;
  packageName: string;
  shp?: ArrayBuffer;
  shx?: ArrayBuffer;
  dbf?: ArrayBuffer;
  prj?: string;
  cpg?: string;
  components: Partial<Record<ShapefileComponentType, boolean>>;
}

export interface ShapefileTranslationResult {
  packageId: string;
  packageName: string;
  layers: ShapefileLayer[];
  evidenceBundle: CorridorEvidenceBundle;
  diagnostics: ShapefileDiagnostic[];
}

