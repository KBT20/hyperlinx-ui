import type { DALCoordinate } from "../types/dal";

export type AuditProjectionType =
  | "SPINE_WIDE"
  | "SEGMENT_RANGE"
  | "STATION_OBJECT"
  | "STATION_RANGE"
  | "COST_ONLY"
  | "SCHEDULE_ONLY"
  | "LIFECYCLE"
  | "CONFIDENCE_REVIEW"
  | "UNKNOWN_REVIEW";

export type AuditAttachmentType =
  | "SPINE_SEGMENT"
  | "STATION"
  | "ENGINEERING_OBJECT"
  | "STATION_RANGE"
  | "SPINE"
  | "REVIEW_OBJECT"
  | "COST_RECORD"
  | "SCHEDULE_RECORD";

export type AuditProjectionStatus = "PROJECTED" | "REVIEW_REQUIRED" | "UNATTACHED" | "EXCEPTED" | "FROZEN" | "DELTA";

export interface SpineAuditAttachment {
  projectionId: string;
  auditEntryId: string;
  auditItem: string;
  sourceEngine: string;
  authorityMode: string;
  value: unknown;
  unit: string;
  formula: string;
  sourceWorkbook?: string;
  confidence: number;
  costImpact: string;
  scheduleImpact: string;
  projectionType: AuditProjectionType;
  attachmentType: AuditAttachmentType;
  attachmentId: string;
  stationId?: string;
  stationLabel?: string;
  measureFeet?: number;
  fromStationId?: string;
  toStationId?: string;
  fromStationLabel?: string;
  toStationLabel?: string;
  fromMeasureFeet?: number;
  toMeasureFeet?: number;
  objectId?: string;
  objectType?: string;
  reviewObjectId?: string;
  expectedQuantity?: number;
  expectedCost?: number;
  expectedScheduleImpact?: number;
  closureRequired: boolean;
  reviewRequired: boolean;
  status: AuditProjectionStatus;
}

export interface StationedExpectation {
  expectationId: string;
  packageId: string;
  stationId: string;
  stationLabel: string;
  measureFeet: number;
  coordinate: DALCoordinate;
  objectId?: string;
  objectType?: string;
  auditEntryIds: string[];
  expectedWork: string[];
  expectedQuantity: number;
  quantityUnit: string;
  expectedLaborCost?: number;
  expectedMaterialCost?: number;
  expectedCapitalCost?: number;
  expectedScheduleImpact?: number;
  sourceFormula?: string;
  confidence?: number;
  closureRequired: boolean;
  reviewRequired: boolean;
  requiredEvidence: string[];
  status: "NOT_STARTED" | "REVIEW_REQUIRED" | "EXCEPTED";
}

export interface StationRangeExpectation {
  expectationId: string;
  packageId: string;
  fromStationId: string;
  toStationId: string;
  fromStationLabel: string;
  toStationLabel: string;
  fromMeasureFeet: number;
  toMeasureFeet: number;
  spineSegmentIds: string[];
  auditEntryIds: string[];
  expectationType: "PLOW" | "BORE" | "OPEN_TRENCH" | "CONDUIT" | "FIBER" | "GENERAL_SEGMENT";
  quantityFeet: number;
  productionRate?: number;
  expectedCost?: number;
  expectedScheduleImpact?: number;
  sourceFormula?: string;
  confidence?: number;
  closureRequired: boolean;
  reviewRequired: boolean;
  status: "NOT_STARTED" | "REVIEW_REQUIRED" | "EXCEPTED";
}

export interface SpineReviewObject {
  reviewObjectId: string;
  packageId: string;
  reviewType: "UNKNOWN_CONDITION" | "CONFIDENCE_RISK" | "JURISDICTION_REVIEW" | "LIFECYCLE_REVIEW" | "COMMERCIAL_REVIEW";
  label: string;
  auditEntryId: string;
  stationId?: string;
  stationLabel?: string;
  measureFeet?: number;
  fromStationId?: string;
  toStationId?: string;
  fromMeasureFeet?: number;
  toMeasureFeet?: number;
  coordinate?: DALCoordinate;
  requiredBeforeEngineeringCertification: boolean;
  closureRequired: false;
  reviewRequired: true;
  status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED";
  reason: string;
}

export interface ClosureExpectation {
  closureExpectationId: string;
  packageId: string;
  expectationKind: "STATION_OBJECT" | "STATION_RANGE" | "REVIEW_OBJECT" | "SPINE_WIDE";
  stationId?: string;
  stationLabel?: string;
  fromStationId?: string;
  toStationId?: string;
  objectId?: string;
  objectType?: string;
  auditEntryIds: string[];
  expectedWork: string;
  expectedQuantity: number;
  quantityUnit: string;
  expectedCost?: number;
  expectedScheduleImpact?: number;
  requiredEvidence: string[];
  closureRequired: boolean;
  reviewRequired: boolean;
  currentStatus: "NOT_STARTED";
}

export interface AuditProjectionSummary {
  projectionId: string;
  packageId: string;
  sourceEngine: string;
  auditEntryCount: number;
  projectedAttachmentCount: number;
  stationedExpectationCount: number;
  stationRangeExpectationCount: number;
  spineReviewObjectCount: number;
  closureExpectationCount: number;
  costBearingUnattachedCount: number;
  unknownReviewCount: number;
  confidenceReviewCount: number;
  complianceStatus: "PASS" | "WARNING" | "FAIL";
  warnings: string[];
  failures: string[];
  baselineFrozen: boolean;
  generatedAt: string;
  noScopeVersionCreation: true;
}

export interface SpineAuditProjection {
  projectionId: string;
  packageId: string;
  measuredSpineId: string;
  stationAuthorityId: string;
  geometryHash: string;
  sourceEngine: "SpineAuditProjectionEngine";
  sourceAuditEngines: string[];
  generatedAt: string;
  authority: "SPINE_AUDIT_PROJECTION_AUTHORITY";
  baselineState: "LIVE" | "FROZEN";
  baselineFrozenAt?: string;
  baselineProjectionId?: string;
  attachments: SpineAuditAttachment[];
  stationedExpectations: StationedExpectation[];
  stationRangeExpectations: StationRangeExpectation[];
  spineReviewObjects: SpineReviewObject[];
  closureExpectations: ClosureExpectation[];
  summary: AuditProjectionSummary;
  noScopeVersionCreation: true;
}

export interface SpineAuditProjectionRedlineDelta {
  deltaId: string;
  packageId: string;
  baselineProjectionId: string;
  reason: string;
  actor: string;
  createdAt: string;
  addedAttachmentIds: string[];
  removedAttachmentIds: string[];
  changedAttachmentIds: string[];
  baselineFrozen: true;
  originalBaselineImmutable: true;
  noScopeVersionCreation: true;
}
