import type { ScopeVersionCloseEvent } from "../scopeversion/ScopeVersionCloseAuthority";
import type {
  FieldClosureDiagnostic,
  FieldClosureEvent,
  FieldClosureInput,
  FieldClosureType,
} from "./FieldClosureEvent";

export type FieldClosureBlockerSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type FieldClosureBlockerCode =
  | "MISSING_SCOPEVERSION_ID"
  | "MISSING_CUSTOMER_ID"
  | "MISSING_OPPORTUNITY_ID"
  | "MISSING_CORRIDOR_ID"
  | "FIELD_ACTIVE_REQUIRED"
  | "MISSING_WORK_PACKAGE"
  | "MISSING_CLOSURE_EVIDENCE"
  | "MISSING_ACTOR_IDENTITY"
  | "MISSING_CLOSURE_TYPE"
  | "MISSING_OBJECT_REFERENCES"
  | "MISSING_STATION_REFERENCES"
  | "MISSING_SEGMENT_REFERENCES"
  | "MISSING_COMPLETION_REFERENCES"
  | "MISSING_TIMESTAMP"
  | "UNAPPROVED_WORK_PACKAGE"
  | "TRACEABILITY_MISMATCH"
  | "AI_ADVISORY_RECOMMENDATION"
  | "FIELD_CLOSE_REJECTED";

export interface FieldClosureBlocker {
  blockerId: string;
  code: FieldClosureBlockerCode;
  severity: FieldClosureBlockerSeverity;
  message: string;
  resolved: boolean;
}

export interface FieldClosureAuthority {
  authorityId: string;
  allowedClosureTypes: FieldClosureType[];
  requiredLifecycleState: "FIELD_ACTIVE";
  scopeVersionCloseType: "FIELD_CLOSE";
}

export interface FieldClosureValidation {
  fieldClosureId: string;
  valid: boolean;
  status: "VALIDATED" | "REJECTED";
  blockers: FieldClosureBlocker[];
  diagnostics: FieldClosureDiagnostic[];
}

export interface FieldClosureAudit {
  auditId: string;
  fieldClosureId: string;
  scopeVersionId: string;
  customerId: string;
  opportunityId: string;
  corridorId: string;
  fieldClosureType: FieldClosureType;
  workPackageId: string;
  objectIds: string[];
  stationIds: string[];
  segmentIds: string[];
  evidenceIds: string[];
  closeId?: string;
  blockerIds: string[];
  timestamp: string;
  diagnostics: FieldClosureDiagnostic[];
}

export interface FieldClosureResult {
  fieldClosureId: string;
  status: "VALIDATED" | "REJECTED";
  fieldClosure?: FieldClosureEvent;
  scopeVersionCloseDraft?: ScopeVersionCloseEvent;
  scopeVersionClose?: ScopeVersionCloseEvent;
  validation: FieldClosureValidation;
  audit: FieldClosureAudit;
  diagnostics: FieldClosureDiagnostic[];
}

export const FIELD_CLOSURE_AUTHORITY: FieldClosureAuthority = Object.freeze({
  authorityId: "FIELD-CLOSURE-AUTHORITY",
  allowedClosureTypes: [
    "OBJECT_CLOSE",
    "STATION_CLOSE",
    "SEGMENT_CLOSE",
    "DISCIPLINE_CLOSE",
    "WORK_PACKAGE_CLOSE",
    "MATERIAL_CLOSE",
    "FACILITY_CLOSE",
    "POWER_CLOSE",
    "TRANSPORT_CLOSE",
    "GPU_CLOSE",
    "DATA_CENTER_CLOSE",
    "COMPOSITE_CLOSE",
  ] satisfies FieldClosureType[],
  requiredLifecycleState: "FIELD_ACTIVE",
  scopeVersionCloseType: "FIELD_CLOSE",
});

export function fieldClosureRequiresObjects(type: FieldClosureType) {
  return [
    "OBJECT_CLOSE",
    "MATERIAL_CLOSE",
    "FACILITY_CLOSE",
    "POWER_CLOSE",
    "TRANSPORT_CLOSE",
    "GPU_CLOSE",
    "DATA_CENTER_CLOSE",
    "COMPOSITE_CLOSE",
  ].includes(type);
}

export function fieldClosureRequiresStations(type: FieldClosureType) {
  return ["STATION_CLOSE", "OBJECT_CLOSE", "COMPOSITE_CLOSE"].includes(type);
}

export function fieldClosureRequiresSegments(type: FieldClosureType) {
  return ["SEGMENT_CLOSE", "WORK_PACKAGE_CLOSE", "COMPOSITE_CLOSE"].includes(type);
}

export type FieldClosureEvaluationInput = FieldClosureInput;
