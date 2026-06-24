import type { WorkPackage } from "../control/WorkPackage";
import type { ScopeVersionCloseActorRole, ScopeVersionCloseEvent } from "../scopeversion/ScopeVersionCloseAuthority";
import type { ScopeVersionState } from "../scopeversion/ScopeVersionLifecycle";
import type {
  FieldActivationBlocker,
  FieldActivationDiagnostic,
  FieldActivationStatus,
} from "./FieldActivationAuthority";

export interface FieldActivationReferences {
  controlActivationId?: string;
  controlCloseId?: string;
  executionPackageReference?: string;
  designStandardsReference?: string;
  dependencySatisfactionReference?: string;
}

export interface FieldActivationRiskContext {
  unresolvedCriticalRisks?: string[];
  aiAdvisoryRecommendation?: boolean;
}

export interface FieldActivationReadinessInput {
  scopeVersionId?: string;
  customerId?: string;
  opportunityId?: string;
  corridorId?: string;
  lifecycleState: ScopeVersionState;
  closes: readonly ScopeVersionCloseEvent[];
  workPackages: readonly WorkPackage[];
  references: FieldActivationReferences;
  riskContext?: FieldActivationRiskContext;
  actorId: string;
  actorRole: ScopeVersionCloseActorRole;
}

export interface FieldActivationReadiness {
  scopeVersionId: string;
  lifecycleState: ScopeVersionState;
  status: FieldActivationStatus;
  blockers: FieldActivationBlocker[];
  satisfiedRequirementIds: string[];
  missingRequirementIds: string[];
  diagnostics: FieldActivationDiagnostic[];
}

export interface FieldActivationDraftInput extends FieldActivationReadinessInput {
  activationId: string;
  notes?: string;
}
