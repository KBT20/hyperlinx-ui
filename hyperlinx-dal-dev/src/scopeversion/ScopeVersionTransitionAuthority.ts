import type { ScopeVersionCloseActorRole, ScopeVersionCloseType } from "./ScopeVersionCloseAuthority";
import {
  SCOPEVERSION_TRANSITION_REGISTRY,
  type ScopeVersionState,
  type ScopeVersionTransition,
  type ScopeVersionTransitionAuthority,
} from "./ScopeVersionLifecycle";

const actorRolesByTargetState: Partial<Record<ScopeVersionState, ScopeVersionCloseActorRole[]>> = {
  DESIGN: ["TERALINX_ENGINEERING", "TERALINX_SALES", "SYSTEM"],
  ENGINEERING_REVIEW: ["TERALINX_ENGINEERING", "SYSTEM"],
  ENGINEERING_APPROVED: ["TERALINX_ENGINEERING"],
  COMMERCIAL_REVIEW: ["TERALINX_MARKETPLACE", "TERALINX_SALES", "FINANCE"],
  BUDGET_CANDIDATE: ["TERALINX_MARKETPLACE", "FINANCE"],
  BUDGET_LOCKED: ["FINANCE", "TERALINX_MARKETPLACE"],
  VENDOR_REVIEW: ["TERALINX_MARKETPLACE"],
  VENDOR_ACCEPTED: ["VENDOR", "TERALINX_MARKETPLACE"],
  CUSTOMER_REVIEW: ["TERALINX_SALES", "CUSTOMER"],
  CUSTOMER_ACCEPTED: ["CUSTOMER", "TERALINX_SALES"],
  CONTRACT_REVIEW: ["LEGAL", "CUSTOMER", "VENDOR"],
  CONTRACT_EXECUTED: ["LEGAL"],
  CONTROL_READY: ["TERALINX_OPERATIONS", "SYSTEM"],
  CONTROL_ACTIVE: ["TERALINX_OPERATIONS", "SYSTEM"],
  FIELD_READY: ["TERALINX_OPERATIONS", "SYSTEM"],
  FIELD_ACTIVE: ["FIELD_OPERATOR", "TERALINX_OPERATIONS", "SYSTEM"],
  COMPLETION_REVIEW: ["TERALINX_OPERATIONS", "FIELD_OPERATOR", "SYSTEM"],
  COMPLETE: ["TERALINX_OPERATIONS", "FIELD_OPERATOR", "SYSTEM"],
  OPERATIONS: ["TERALINX_OPERATIONS", "SYSTEM"],
  SUPERSEDED: ["TERALINX_ENGINEERING"],
  CANCELLED: ["TERALINX_SALES", "CUSTOMER"],
};

const requiredClosesByTargetState: Partial<Record<ScopeVersionState, ScopeVersionCloseType[]>> = {
  ENGINEERING_APPROVED: ["ENGINEERING_CLOSE"],
  BUDGET_LOCKED: ["COMMERCIAL_CLOSE", "BUDGET_CLOSE"],
  VENDOR_ACCEPTED: ["VENDOR_ACCEPTANCE_CLOSE"],
  CUSTOMER_ACCEPTED: ["CUSTOMER_ACCEPTANCE_CLOSE"],
  CONTRACT_EXECUTED: ["CONTRACT_CLOSE"],
  CONTROL_ACTIVE: ["CONTROL_CLOSE"],
  FIELD_ACTIVE: ["FIELD_CLOSE"],
  COMPLETE: ["COMPLETION_CLOSE"],
  OPERATIONS: ["OPERATIONS_CLOSE"],
  SUPERSEDED: ["DESIGN_CLOSE"],
  CANCELLED: ["COMMERCIAL_CLOSE"],
};

export const SCOPEVERSION_TRANSITION_AUTHORITY_REGISTRY: readonly ScopeVersionTransitionAuthority[] = Object.freeze(
  SCOPEVERSION_TRANSITION_REGISTRY.map((transition: ScopeVersionTransition) => ({
    authorityId: `AUTH-${transition.transitionId}`,
    transition,
    authorizedRoles: actorRolesByTargetState[transition.to] ?? ["SYSTEM"],
    requiredCloseTypes: requiredClosesByTargetState[transition.to] ?? [],
    notes: transition.governedException ? "Governed exception path." : undefined,
  })),
);

export function findTransitionAuthority(from: ScopeVersionState, to: ScopeVersionState): ScopeVersionTransitionAuthority | undefined {
  return SCOPEVERSION_TRANSITION_AUTHORITY_REGISTRY.find(
    (authority) => authority.transition.from === from && authority.transition.to === to,
  );
}
