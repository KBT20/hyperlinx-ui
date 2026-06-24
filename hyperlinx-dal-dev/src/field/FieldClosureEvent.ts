import type { WorkPackage } from "../control/WorkPackage";
import type { ScopeVersionCloseActorRole, ScopeVersionCloseEvent } from "../scopeversion/ScopeVersionCloseAuthority";
import type { ScopeVersionState } from "../scopeversion/ScopeVersionLifecycle";

export type FieldClosureType =
  | "OBJECT_CLOSE"
  | "STATION_CLOSE"
  | "SEGMENT_CLOSE"
  | "DISCIPLINE_CLOSE"
  | "WORK_PACKAGE_CLOSE"
  | "MATERIAL_CLOSE"
  | "FACILITY_CLOSE"
  | "POWER_CLOSE"
  | "TRANSPORT_CLOSE"
  | "GPU_CLOSE"
  | "DATA_CENTER_CLOSE"
  | "COMPOSITE_CLOSE";

export type FieldClosureStatus = "DRAFT" | "VALIDATED" | "REJECTED";

export type FieldClosureDiagnosticCode =
  | "FIELD_CLOSURE_STARTED"
  | "FIELD_CLOSURE_VALIDATED"
  | "FIELD_CLOSURE_REJECTED"
  | "FIELD_CLOSURE_BLOCKER_IDENTIFIED"
  | "FIELD_CLOSE_CREATED"
  | "FIELD_CLOSURE_AUDIT_CREATED";

export type FieldClosureEvidenceType =
  | "PHOTO"
  | "GPS"
  | "TEST_RESULT"
  | "MATERIAL_RECEIPT"
  | "INSPECTION"
  | "AS_BUILT_NOTE"
  | "CREW_ATTESTATION"
  | "VENDOR_ATTESTATION";

export interface FieldClosureEvidence {
  evidenceId: string;
  evidenceType: FieldClosureEvidenceType;
  source: string;
  capturedAt: string;
  immutable?: boolean;
  notes?: string;
}

export interface FieldClosureEvent {
  fieldClosureId: string;
  fieldClosureType: FieldClosureType;
  scopeVersionId: string;
  customerId: string;
  opportunityId: string;
  corridorId: string;
  lifecycleState: ScopeVersionState;
  workPackageId: string;
  actorId: string;
  actorRole: ScopeVersionCloseActorRole;
  objectIds: string[];
  stationIds: string[];
  segmentIds: string[];
  disciplineIds: string[];
  completionReferences: string[];
  evidence: FieldClosureEvidence[];
  timestamp: string;
  status: FieldClosureStatus;
  scopeVersionClose?: ScopeVersionCloseEvent;
}

export interface FieldClosureInput {
  fieldClosureId: string;
  fieldClosureType: FieldClosureType;
  scopeVersionId?: string;
  customerId?: string;
  opportunityId?: string;
  corridorId?: string;
  lifecycleState: ScopeVersionState;
  workPackage?: WorkPackage;
  actorId: string;
  actorRole: ScopeVersionCloseActorRole;
  objectIds?: string[];
  stationIds?: string[];
  segmentIds?: string[];
  disciplineIds?: string[];
  completionReferences?: string[];
  evidence?: FieldClosureEvidence[];
  timestamp?: string;
  notes?: string;
}

export interface FieldClosureDiagnostic {
  code: FieldClosureDiagnosticCode;
  severity: "INFO" | "WARNING" | "ERROR";
  message: string;
  details?: Record<string, unknown>;
}
