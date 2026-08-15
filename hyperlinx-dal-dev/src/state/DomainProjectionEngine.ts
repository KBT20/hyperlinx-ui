import {
  STATE_REGISTRY_AUTHORITY,
  stateDefinitionFor,
  type ConstitutionalStateDefinition,
} from "./StateRegistry";
import type { ConstitutionalLifecycleState, DomainAuthority } from "./ObjectTransitionEngine";

export const DOMAIN_PROJECTION_AUTHORITY = "DOMAIN_PROJECTION_ENGINE" as const;
export const DOMAIN_PROJECTION_VERSION = "39.0" as const;

export type DomainProjection = {
  projectionAuthority: typeof DOMAIN_PROJECTION_AUTHORITY;
  registryAuthority: typeof STATE_REGISTRY_AUTHORITY;
  currentState: ConstitutionalLifecycleState;
  currentDomain: DomainAuthority;
  currentAuthority: DomainAuthority;
  visibleLens: string;
  visibleActions: string[];
  visibleDiagnostics: string[];
  visibleAuditChecks: string[];
  visibleToolbarActions: string[];
  visibleCloseActions: string[];
  nextAllowedStates: ConstitutionalLifecycleState[];
  blockingStates: ConstitutionalLifecycleState[];
  renderStyle: ConstitutionalStateDefinition["renderStyle"];
  hoverTemplate: string[];
  derivedFromStateOnly: true;
  noStoredCurrentDomain: true;
};

export function deriveDomainProjection(currentState: unknown): DomainProjection {
  const definition = stateDefinitionFor(currentState);
  return {
    projectionAuthority: DOMAIN_PROJECTION_AUTHORITY,
    registryAuthority: STATE_REGISTRY_AUTHORITY,
    currentState: definition.stateId,
    currentDomain: definition.domain,
    currentAuthority: definition.authority,
    visibleLens: definition.visibleLens,
    visibleActions: [...definition.visibleActions],
    visibleDiagnostics: [...definition.requiredDiagnostics],
    visibleAuditChecks: [...definition.requiredAuditChecks],
    visibleToolbarActions: [...definition.toolbarActions],
    visibleCloseActions: [...definition.closeActions],
    nextAllowedStates: [...definition.nextStates],
    blockingStates: [...definition.blockingStates],
    renderStyle: { ...definition.renderStyle },
    hoverTemplate: [...definition.hoverTemplate],
    derivedFromStateOnly: true,
    noStoredCurrentDomain: true,
  };
}

export function deriveObjectDomainProjection(entity: Record<string, unknown> | null | undefined) {
  return deriveDomainProjection(
    entity?.currentState
      ?? entity?.currentLifecycleState
      ?? entity?.lifecycleState
      ?? entity?.status,
  );
}

export function deriveWorkspaceProjection(entity: Record<string, unknown> | null | undefined) {
  const projection = deriveObjectDomainProjection(entity);
  return {
    ...projection,
    workspaceActions: projection.visibleActions,
    workspaceDiagnostics: projection.visibleDiagnostics,
    workspaceToolbar: projection.visibleToolbarActions,
    workspaceCloseActions: projection.visibleCloseActions,
    stateDeterminesDomain: true,
  };
}
