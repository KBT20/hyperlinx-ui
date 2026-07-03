import type { DALCoordinate } from "../../../types/dal";

export const PD002A_OBJECT_ADDRESSING_DOCTRINE_ID = "PD-002A";
export const PD002A_OBJECT_ADDRESSING_DOCTRINE_VERSION = "24A.1";
export const PD002A_OBJECT_ADDRESSING_AUTHORITY = "PD002A_OBJECT_ADDRESSING_AUTHORITY" as const;
export const STATION_ADDRESS_AUTHORITY = "STATION_ADDRESS_AUTHORITY" as const;
export const OBJECT_ADDRESSING_VALIDATION_AUTHORITY = "PD002A_OBJECT_ADDRESS_VALIDATION_AUTHORITY" as const;

export type StationAddressStatus =
  | "ASSIGNED"
  | "ALGORITHM_ASSIGNED"
  | "ENGINEERING_ASSIGNED"
  | "FIELD_REDLINE_ASSIGNED"
  | "UNASSIGNED"
  | "PENDING_REVIEW"
  | "REJECTED";

export type ObjectAddressType =
  | "POINT"
  | "RANGE"
  | "SPINE_WIDE"
  | "PACKAGE_LEVEL"
  | "UNASSIGNED_REVIEW";

export interface StationAddress {
  stationAddressId: string;
  stationId: string;
  stationLabel: string;
  measureFeet: number;
  coordinate: DALCoordinate;
  lat: number;
  lng: number;
  geometryHash: string;
  authority: typeof STATION_ADDRESS_AUTHORITY;
  source: string;
  confidence: number;
  addressStatus: StationAddressStatus;
}

export interface AddressRange {
  fromStationAddress: StationAddress;
  toStationAddress: StationAddress;
  fromMeasureFeet: number;
  toMeasureFeet: number;
  lengthFeet: number;
}

export interface ObjectAddress {
  objectId: string;
  objectType: string;
  addressType: ObjectAddressType;
  stationAddress?: StationAddress;
  fromStationAddress?: StationAddress;
  toStationAddress?: StationAddress;
  addressRange?: AddressRange;
  measureFeet?: number;
  fromMeasureFeet?: number;
  toMeasureFeet?: number;
  coordinate?: DALCoordinate;
  fromCoordinate?: DALCoordinate;
  toCoordinate?: DALCoordinate;
  addressStatus: StationAddressStatus;
  addressAuthority: typeof PD002A_OBJECT_ADDRESSING_AUTHORITY;
  addressSource: string;
  parentObjectId?: string;
  inheritedFromObjectId?: string;
  requiresEngineeringReview: boolean;
  requiresFieldRedlineReview: boolean;
  notes: string[];
}

export type PD002AReviewObjectType =
  | "RAILROAD_CROSSING_UNKNOWN"
  | "WATER_CROSSING_UNKNOWN"
  | "DOT_HIGHWAY_CROSSING_UNKNOWN"
  | "UTILITY_CONFLICT_UNKNOWN"
  | "ENVIRONMENTAL_IMPACT_UNKNOWN"
  | "BRIDGE_ATTACHMENT_UNKNOWN"
  | "ROCK_PERCENTAGE_UNKNOWN"
  | "RESTORATION_REVIEW_UNKNOWN"
  | "GENERAL_REVIEW";

export interface PD002AReviewObject {
  reviewObjectId: string;
  reviewType: PD002AReviewObjectType;
  addressStatus: "PENDING_REVIEW" | "UNASSIGNED" | "ENGINEERING_ASSIGNED" | "REJECTED";
  sourceAuditEntry: unknown;
  reason: string;
  confidence: number;
  blockingStatus: "BLOCKING" | "NON_BLOCKING";
  requiresEngineeringAddressing: boolean;
  objectAddress?: ObjectAddress;
  originalReviewObject?: unknown;
  noScopeVersionCreation: true;
}

export interface StationAddressRegistry {
  registryId: string;
  packageId: string;
  measuredSpineId: string;
  stationAuthorityId: string;
  geometryHash: string;
  stationCount: number;
  byStationId: Record<string, StationAddress>;
  byStationLabel: Record<string, StationAddress>;
  entries: StationAddress[];
  authority: typeof STATION_ADDRESS_AUTHORITY;
  noScopeVersionCreation: true;
}

export interface AddressAssignmentEvent {
  assignmentEventId: string;
  reviewObjectId: string;
  actor: string;
  reason: string;
  assignedAt: string;
  addressType: "POINT" | "RANGE";
  clickedCoordinate?: DALCoordinate;
  stationLabel?: string;
  fromStationLabel?: string;
  toStationLabel?: string;
  snappedStationAddress?: StationAddress;
  fromStationAddress?: StationAddress;
  toStationAddress?: StationAddress;
  addressStatus: "ENGINEERING_ASSIGNED";
  requiresEngineeringDelta: boolean;
  commercialBaselineMutated: false;
  originalReviewRecordPreserved: true;
  authority: typeof PD002A_OBJECT_ADDRESSING_AUTHORITY;
  noScopeVersionCreation: true;
}

export interface PD002AAddressValidationIssue {
  issueId: string;
  severity: "FAIL" | "WARNING";
  objectId?: string;
  reviewObjectId?: string;
  reason: string;
  requiredResolution: string;
}

export interface PD002AAddressValidation {
  validationId: string;
  packageId: string;
  status: "PASS" | "WARNING" | "FAIL";
  checkedObjectCount: number;
  assignedPointCount: number;
  assignedRangeCount: number;
  packageLevelCount: number;
  pendingReviewCount: number;
  invalidAddressCount: number;
  warnings: PD002AAddressValidationIssue[];
  failures: PD002AAddressValidationIssue[];
  authority: typeof OBJECT_ADDRESSING_VALIDATION_AUTHORITY;
  noScopeVersionCreation: true;
}

export interface AddressProjectionSummary {
  summaryId: string;
  packageId: string;
  objectAddressCount: number;
  stationAddressCount: number;
  pointAddressCount: number;
  rangeAddressCount: number;
  unassignedReviewObjectCount: number;
  addressedReviewObjectCount: number;
  blockingUnassignedReviewObjectCount: number;
  mapLayerCount: number;
  status: "PASS" | "WARNING" | "FAIL";
  authority: typeof PD002A_OBJECT_ADDRESSING_AUTHORITY;
  noScopeVersionCreation: true;
}

export interface ObjectAddressingDoctrine {
  doctrineId: typeof PD002A_OBJECT_ADDRESSING_DOCTRINE_ID;
  doctrineVersion: typeof PD002A_OBJECT_ADDRESSING_DOCTRINE_VERSION;
  authority: typeof PD002A_OBJECT_ADDRESSING_AUTHORITY;
  principle: "STATIONING_IS_CANONICAL_ADDRESS_SYSTEM";
  pointObjectTypes: string[];
  rangeObjectTypes: string[];
  containedObjectTypes: string[];
  packageLevelObjectTypes: string[];
  reviewObjectTypes: string[];
  certificationOrder: string[];
  noScopeVersionCreation: true;
}

export interface ObjectAddressingResult {
  objectAddressingDoctrine: ObjectAddressingDoctrine;
  stationAddressRegistry: StationAddressRegistry;
  objectAddresses: ObjectAddress[];
  unassignedReviewObjects: PD002AReviewObject[];
  addressedReviewObjects: PD002AReviewObject[];
  addressValidation: PD002AAddressValidation;
  addressAssignmentEvents: AddressAssignmentEvent[];
  addressProjectionSummary: AddressProjectionSummary;
  mapLayers: string[];
  noScopeVersionCreation: true;
}

export interface AssignReviewObjectAddressInput {
  draftPackage: Record<string, unknown>;
  reviewObjectId: string;
  clickedCoordinate?: DALCoordinate;
  stationLabel?: string;
  addressType: "POINT" | "RANGE";
  fromStationLabel?: string;
  toStationLabel?: string;
  actor: string;
  reason: string;
  requiresEngineeringDelta?: boolean;
  assignedAt?: string;
}

export interface AssignReviewObjectAddressResult {
  addressedReviewObject: PD002AReviewObject;
  addressAssignmentEvent: AddressAssignmentEvent;
  addressedReviewObjects: PD002AReviewObject[];
  unassignedReviewObjects: PD002AReviewObject[];
  addressValidation: PD002AAddressValidation;
  commercialBaselineMutated: false;
  draftPackagePatch: {
    addressedReviewObjects: PD002AReviewObject[];
    unassignedReviewObjects: PD002AReviewObject[];
    addressAssignmentEvents: AddressAssignmentEvent[];
    addressValidation: PD002AAddressValidation;
  };
  noScopeVersionCreation: true;
}
