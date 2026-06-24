import type { ScopeVersionCloseActorRole, ScopeVersionCloseEvent } from "../scopeversion/ScopeVersionCloseAuthority";
import type { ScopeVersionState } from "../scopeversion/ScopeVersionLifecycle";
import type {
  ControlActivationBlocker,
  ControlActivationDiagnostic,
  ControlActivationStatus,
} from "./ControlActivationAuthority";

export interface ControlActivationReferences {
  engineeringPackageReference?: string;
  budgetReference?: string;
  approvedVendorSelections?: string[];
  approvedObjectPackage?: string;
  executionStrategy?: string;
  designStandardsApproval?: string;
  referenceArchitecture?: string;
  closeChainValidation?: string;
}

export interface ControlActivationRiskContext {
  unresolvedCriticalRisks?: string[];
  aiAdvisoryOnlyRecommendation?: boolean;
  vendorAcceptanceRequired?: boolean;
}

export interface ControlActivationReadinessInput {
  scopeVersionId?: string;
  customerId?: string;
  opportunityId?: string;
  corridorId?: string;
  lifecycleState: ScopeVersionState;
  closes: readonly ScopeVersionCloseEvent[];
  references: ControlActivationReferences;
  riskContext?: ControlActivationRiskContext;
  actorId: string;
  actorRole: ScopeVersionCloseActorRole;
}

export interface ControlActivationReadiness {
  scopeVersionId: string;
  lifecycleState: ScopeVersionState;
  status: ControlActivationStatus;
  blockers: ControlActivationBlocker[];
  satisfiedRequirementIds: string[];
  missingRequirementIds: string[];
  diagnostics: ControlActivationDiagnostic[];
}

export interface ControlActivationDraftInput extends ControlActivationReadinessInput {
  activationId: string;
  notes?: string;
}
