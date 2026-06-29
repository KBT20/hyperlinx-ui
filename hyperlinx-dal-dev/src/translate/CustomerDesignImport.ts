import type { DALCoordinate } from "../types/dal";
import type { InventoryGraph } from "../types/dal";
import type { CommercialCorridorDraft } from "../commercial/CommercialCorridorDraftEngine";

export type CustomerDesignSourceType = "KMZ" | "KML" | "CSV" | "API";

export type CustomerDesignImportStatus =
  | "UPLOADED"
  | "PARSED"
  | "PARTIAL"
  | "FAILED"
  | "STAGED"
  | "PRICED"
  | "PROMOTED_TO_COMMERCIAL_DRAFT"
  | "OPENED_IN_ENGINEERING";

export type ImportedCustomerRouteState =
  | "CUSTOMER_EXISTING"
  | "CUSTOMER_PROPOSED"
  | "CUSTOMER_DRAFT"
  | "UNKNOWN";

export type ImportedCustomerObjectType =
  | "POP"
  | "ILA"
  | "REGEN"
  | "SPLICE_CASE"
  | "HANDHOLE"
  | "VAULT"
  | "BUILDING"
  | "CUSTOMER_SITE"
  | "ANCHOR"
  | "UNKNOWN_PLACEMARK";

export type ImportDiagnosticSeverity = "INFO" | "WARNING" | "ERROR";

export type ImportAuditEventType =
  | "FILE_UPLOADED"
  | "FILE_PARSED"
  | "IMPORT_STAGED"
  | "ROUTE_CLASSIFIED"
  | "ROUTE_PRICED"
  | "ROUTE_PROMOTED_TO_COMMERCIAL_DRAFT"
  | "ROUTE_OPENED_IN_ENGINEERING"
  | "ROUTE_COMPARED"
  | "HUMAN_STATE_OVERRIDE";

export type CustomerDesignLineageStage =
  | "IMPORTED"
  | "PRICED"
  | "COMMERCIAL_DRAFT"
  | "COMMERCIAL_REVISION"
  | "ENGINEERING_REVISION"
  | "ACCEPTED_REVISION"
  | "PROPOSAL"
  | "ARCHIVED";

export interface CustomerDesignLineageEvent {
  lineageEventId: string;
  stage: CustomerDesignLineageStage;
  label: string;
  relatedId?: string;
  routeId?: string;
  createdAt: string;
  actor: string;
}

export interface CustomerDesignLayerVisibility {
  customerDesign: boolean;
  commercialDraft: boolean;
  engineeringRevision: boolean;
  acceptedRevision: boolean;
  inventory: boolean;
  stations: boolean;
  fiber: boolean;
  routes: boolean;
}

export interface ImportProvenance {
  sourceFileName: string;
  sourceType: CustomerDesignSourceType;
  kmlEntryName?: string;
  originalKmlPath: string;
  folderPath: string[];
  placemarkName?: string;
  description?: string;
  style?: string;
  geometryType?: "LineString" | "Point" | "Polygon" | "CSV_ROUTE" | "CSV_AZ";
  parseConfidence: number;
  importedAt: string;
  accountId: string;
  authoritySource: "CUSTOMER_FILE";
  authorityMode: "CUSTOMER";
}

export interface ImportDiagnostic {
  diagnosticId: string;
  severity: ImportDiagnosticSeverity;
  code: string;
  message: string;
  sourceFileName: string;
  kmlEntryName?: string;
  folderPath?: string[];
  placemarkName?: string;
  createdAt: string;
  details?: Record<string, unknown>;
}

export interface ImportAuditEvent {
  eventId: string;
  eventType: ImportAuditEventType;
  message: string;
  routeId?: string;
  objectId?: string;
  createdAt: string;
  actor: string;
}

export interface ImportedCustomerFolder {
  folderId: string;
  name: string;
  folderPath: string[];
  parentPath: string[];
  placemarkCount: number;
  routeCount: number;
  objectCount: number;
  polygonCount: number;
}

export interface ImportedCustomerRoute {
  routeId: string;
  name: string;
  folderPath: string[];
  geometry: Array<{ latitude: number; longitude: number }>;
  dalGeometry: DALCoordinate[];
  routeFeet: number;
  routeMiles: number;
  sourceStyle?: string;
  sourceDescription?: string;
  designState: ImportedCustomerRouteState;
  pricingEligible: boolean;
  confidence: number;
  provenance: ImportProvenance;
  pricedDraft?: CommercialCorridorDraft;
}

export interface ImportedCustomerObject {
  objectId: string;
  name: string;
  folderPath: string[];
  latitude: number;
  longitude: number;
  objectType: ImportedCustomerObjectType;
  sourceDescription?: string;
  nearestRouteId?: string;
  nearestStationFeet?: number;
  confidence: number;
  provenance: ImportProvenance;
}

export interface ImportedCustomerPolygon {
  polygonId: string;
  name: string;
  folderPath: string[];
  rings: DALCoordinate[][];
  sourceDescription?: string;
  sourceStyle?: string;
  confidence: number;
  provenance: ImportProvenance;
}

export interface CustomerDesignImport {
  designId: string;
  importId: string;
  accountId: string;
  customerName: string;
  libraryPath: string[];
  sourceFileName: string;
  sourceType: CustomerDesignSourceType;
  uploadedAt: string;
  uploadedBy: string;
  status: CustomerDesignImportStatus;
  routes: ImportedCustomerRoute[];
  objects: ImportedCustomerObject[];
  polygons: ImportedCustomerPolygon[];
  folders: ImportedCustomerFolder[];
  activeRouteId?: string;
  inventoryGraphId?: string;
  graphId?: string;
  inventoryGraph?: InventoryGraph;
  validation?: InventoryGraph["validation"];
  previewGeometry: DALCoordinate[];
  layerVisibility: CustomerDesignLayerVisibility;
  lineage: CustomerDesignLineageEvent[];
  diagnostics: ImportDiagnostic[];
  auditEvents: ImportAuditEvent[];
  provenance: ImportProvenance;
  noScopeVersionCreation: true;
  noInventoryMutation: true;
  noCertifiedRouteAuthority: true;
}
