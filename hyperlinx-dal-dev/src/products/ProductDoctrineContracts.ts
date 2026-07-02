import type { DALCoordinate } from "../types/dal";

export type ProductNetworkClass = "LONG_HAUL" | "METRO" | "CAMPUS" | "LATERAL";
export type ProductTopology = "LINEAR" | "RING" | "MESH" | "HUB_AND_SPOKE";
export type ProductLayer = 1 | 2 | 3;
export type ProductValidationStatus = "PASS" | "WARNING" | "FAIL";

export interface ProductDoctrineRules {
  networkClass: ProductNetworkClass;
  topology: ProductTopology;
  layer: ProductLayer;
  opticalTransport: boolean;
  comparisonAllowed: boolean;
  reuseRecommendationAllowed: boolean;
  scopeVersionCreationAllowedFromCommercial: boolean;
  engineeringCertificationRequired: boolean;
}

export interface ProductDoctrine {
  doctrineId: string;
  productId: string;
  productName: string;
  productVersion: string;
  doctrineVersion: string;
  rules: ProductDoctrineRules;
  requiredInputs: string[];
  assembledArtifacts: string[];
  readinessChecks: string[];
}

export interface ProductDoctrineSite {
  siteId: string;
  role: "A" | "Z";
  label: string;
  coordinate: DALCoordinate;
  source: string;
}

export interface ProductDoctrineOsrmRoute {
  routeId: string;
  source: "OSRM";
  routeMiles: number;
  routeFeet: number;
  distanceMeters: number;
  geometry: DALCoordinate[];
}

export interface ProductDoctrineSpine {
  spineId: string;
  topology: "LINEAR";
  networkClass: "LONG_HAUL";
  aSiteId: string;
  zSiteId: string;
  centerlineId: string;
  routeMiles: number;
  routeFeet: number;
  noScopeVersionCreation: true;
}

export interface ProductDoctrineStation {
  stationId: string;
  spineId: string;
  stationIndex: number;
  stationFeet: number;
  milepost: number;
  coordinate: DALCoordinate;
}

export interface ProductDoctrineRouteSegment {
  segmentId: string;
  spineId: string;
  fromStationId: string;
  toStationId: string;
  fromMile: number;
  toMile: number;
  routeMiles: number;
  routeFeet: number;
}

export interface ProductDoctrineObject {
  objectId: string;
  objectType: "SPINE" | "ROUTE_SEGMENT" | "CONDUIT" | "FIBER" | "STRUCTURE" | "CROSSING";
  label: string;
  parentId?: string;
  quantity?: number;
  unit?: string;
  metadata: Record<string, unknown>;
}

export interface ProductDoctrineConduitAssembly {
  assemblyId: string;
  conduitCount: number;
  conduitSizeInches: number;
  conduitFeet: number;
  objects: ProductDoctrineObject[];
}

export interface ProductDoctrineFiberAssembly {
  assemblyId: string;
  fiberCount: number;
  fiberFeet: number;
  objects: ProductDoctrineObject[];
}

export interface ProductDoctrineStructureAssembly {
  assemblyId: string;
  structureCount: number;
  structures: ProductDoctrineObject[];
}

export interface ProductDoctrineCrossingAssembly {
  assemblyId: string;
  crossingCount: number;
  crossings: ProductDoctrineObject[];
}

export interface ProductDoctrineQuantitySummary {
  routeMiles: number;
  routeFeet: number;
  stationCount: number;
  segmentCount: number;
  objectCount: number;
  conduitFeet: number;
  conduitCount: number;
  fiberFeet: number;
  fiberCount: number;
  structureCount: number;
  crossingCount: number;
}

export interface ProductDoctrinePricingSummary {
  budgetCost: number;
  sellPriceIru: number;
  nrcRevenue: number;
  mrcRevenue: number;
  grossMarginDollars: number;
  grossMarginPercent: number;
  pricingInputs: Record<string, unknown>;
}

export interface ProductDoctrineValidationCheck {
  key: string;
  label: string;
  status: ProductValidationStatus;
}

export interface ProductDoctrineValidationSummary {
  status: ProductValidationStatus;
  checks: ProductDoctrineValidationCheck[];
  readinessScore: number;
}

export interface ProductDoctrineEngineeringManifest {
  manifestId: string;
  packagePath: string;
  requiresEngineeringCertification: true;
  noScopeVersionCreation: true;
  objectIds: string[];
  stationIds: string[];
  quantityKeys: string[];
}

export interface ProductDoctrineAssembly {
  assemblyId: string;
  doctrineId: string;
  productId: string;
  productDoctrineVersion: string;
  aSite: ProductDoctrineSite | null;
  zSite: ProductDoctrineSite | null;
  osrmRoute: ProductDoctrineOsrmRoute | null;
  centerline: DALCoordinate[];
  centerlineId: string;
  spine: ProductDoctrineSpine | null;
  stations: ProductDoctrineStation[];
  routeSegments: ProductDoctrineRouteSegment[];
  objects: ProductDoctrineObject[];
  conduitAssembly: ProductDoctrineConduitAssembly;
  fiberAssembly: ProductDoctrineFiberAssembly;
  structureAssembly: ProductDoctrineStructureAssembly;
  crossingAssembly: ProductDoctrineCrossingAssembly;
  quantitySummary: ProductDoctrineQuantitySummary;
  pricingSummary: ProductDoctrinePricingSummary;
  validationSummary: ProductDoctrineValidationSummary;
  engineeringManifest: ProductDoctrineEngineeringManifest;
  rules: ProductDoctrineRules;
  noScopeVersionCreation: true;
}
