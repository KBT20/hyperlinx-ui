import type { ScopeVersionCloseActorRole } from "../scopeversion/ScopeVersionCloseAuthority";

export type WorkPackageType =
  | "STATION_WORK_PACKAGE"
  | "SEGMENT_WORK_PACKAGE"
  | "DISCIPLINE_WORK_PACKAGE"
  | "MATERIAL_WORK_PACKAGE"
  | "CONSTRUCTION_WORK_PACKAGE"
  | "ENGINEERING_WORK_PACKAGE"
  | "POWER_WORK_PACKAGE"
  | "FACILITY_WORK_PACKAGE"
  | "TRANSPORT_WORK_PACKAGE"
  | "GPU_WORK_PACKAGE"
  | "DATA_CENTER_WORK_PACKAGE"
  | "COMPOSITE_WORK_PACKAGE";

export type WorkPackageStatus =
  | "DRAFT"
  | "PLANNED"
  | "VALIDATED"
  | "REJECTED"
  | "READY_FOR_FIELD";

export type WorkPackageDependencyType =
  | "PREDECESSOR"
  | "SUCCESSOR"
  | "BLOCKING"
  | "ENGINEERING"
  | "MATERIAL"
  | "VENDOR"
  | "FACILITY"
  | "POWER";

export type WorkPackageDiagnosticCode =
  | "WORK_PACKAGE_GENERATION_STARTED"
  | "WORK_PACKAGE_GENERATED"
  | "WORK_PACKAGE_VALIDATED"
  | "WORK_PACKAGE_BLOCKER_IDENTIFIED"
  | "WORK_PACKAGE_REJECTED"
  | "WORK_PACKAGE_AUDIT_CREATED";

export interface WorkPackageAllocation {
  scopeVersionId: string;
  customerId: string;
  opportunityId: string;
  corridorId: string;
  stationIds: string[];
  segmentIds: string[];
  objectIds: string[];
  vendorIds: string[];
  budgetReferences: string[];
  quantityReferences: string[];
  dependencyReferences: string[];
}

export interface WorkPackageDependency {
  dependencyId: string;
  dependencyType: WorkPackageDependencyType;
  sourceWorkPackageId: string;
  targetWorkPackageId: string;
  description: string;
  blocking: boolean;
}

export interface WorkPackageDiagnostic {
  code: WorkPackageDiagnosticCode;
  severity: "INFO" | "WARNING" | "ERROR";
  message: string;
  details?: Record<string, unknown>;
}

export interface WorkPackageAudit {
  auditId: string;
  scopeVersionId: string;
  customerId: string;
  opportunityId: string;
  corridorId: string;
  generatedPackageIds: string[];
  rejectedPackageIds: string[];
  blockerIds: string[];
  actor: {
    actorId: string;
    actorRole: ScopeVersionCloseActorRole;
  };
  createdAt: string;
  diagnostics: WorkPackageDiagnostic[];
}

export interface WorkPackage {
  workPackageId: string;
  workPackageType: WorkPackageType;
  status: WorkPackageStatus;
  scopeVersionId: string;
  customerId: string;
  opportunityId: string;
  corridorId: string;
  name: string;
  description: string;
  allocation: WorkPackageAllocation;
  dependencies: WorkPackageDependency[];
  authorityReferences: {
    controlActivationId?: string;
    controlCloseId?: string;
    lifecycleState: "CONTROL_ACTIVE";
  };
  createdAt: string;
  diagnostics: WorkPackageDiagnostic[];
}
