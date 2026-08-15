import {
  deriveObjectDomainProjection,
  type DomainProjection,
} from "./DomainProjectionEngine";
import {
  closureEventsForEntity,
  type ConstitutionalClosureEvent,
  type ConstitutionalClosureLedger,
} from "./ClosureLedger";
import type { ConstitutionalLifecycleState } from "./ObjectTransitionEngine";

export const CLOSURE_REPLAY_AUTHORITY = "CLOSURE_REPLAY_ENGINE" as const;
export const CLOSURE_REPLAY_VERSION = "39.0" as const;

export type ClosureReplayAssemblyGraph = {
  packageId: string;
  measuredCenterlineId?: string;
  geometryAuthorityId?: string;
  objects?: Array<Record<string, unknown>>;
  spans?: Array<Record<string, unknown>>;
  closureSegments?: Array<Record<string, unknown>>;
};

export type ClosureReplayResult = {
  replayAuthority: typeof CLOSURE_REPLAY_AUTHORITY;
  packageId: string;
  replayedAt?: string;
  closureLedgerId: string;
  closureEventCount: number;
  measuredCenterlineId?: string;
  geometryAuthorityId?: string;
  iofPackageTwin: {
    packageId: string;
    source: "Assembly Graph + Closure Ledger";
    objects: Array<Record<string, unknown>>;
    spans: Array<Record<string, unknown>>;
    closureSegments: Array<Record<string, unknown>>;
    currentStateByEntity: Record<string, ConstitutionalLifecycleState>;
    domainProjectionByEntity: Record<string, DomainProjection>;
    closureEventCount: number;
    noStoredCurrentDomain: true;
    noMutableWorkspaceState: true;
  };
};

function entityId(entity: Record<string, unknown>) {
  return String(entity.objectId ?? entity.spanId ?? entity.closureSegmentId ?? entity.id ?? "");
}

function eventAppliesBefore(event: ConstitutionalClosureEvent, replayedAt?: string) {
  return !replayedAt || event.timestamp <= replayedAt;
}

function replayEntity(
  entity: Record<string, unknown>,
  ledger: ConstitutionalClosureLedger,
  replayedAt?: string,
) {
  const id = entityId(entity);
  const events = closureEventsForEntity(ledger, id).filter((event) => eventAppliesBefore(event, replayedAt));
  const latest = events.at(-1);
  const currentState = (latest?.toState
    ?? entity.currentState
    ?? entity.currentLifecycleState
    ?? "COMMERCIAL_ASSEMBLED") as ConstitutionalLifecycleState;
  const projected = {
    ...entity,
    currentState,
    currentLifecycleState: currentState,
    latestClosureId: latest?.closureId,
    closureEventHistory: events,
  };
  return {
    entity: projected,
    currentState,
    projection: deriveObjectDomainProjection(projected),
  };
}

export function replayClosureLedger(input: {
  assemblyGraph: ClosureReplayAssemblyGraph;
  closureLedger: ConstitutionalClosureLedger;
  at?: string;
}): ClosureReplayResult {
  const objects = (input.assemblyGraph.objects ?? []).map((entity) => replayEntity(entity, input.closureLedger, input.at));
  const spans = (input.assemblyGraph.spans ?? []).map((entity) => replayEntity(entity, input.closureLedger, input.at));
  const closureSegments = (input.assemblyGraph.closureSegments ?? []).map((entity) => replayEntity(entity, input.closureLedger, input.at));
  const allEntities = [...objects, ...spans, ...closureSegments];
  const currentStateByEntity = Object.fromEntries(
    allEntities.map((entry) => [entityId(entry.entity), entry.currentState]).filter(([id]) => Boolean(id)),
  ) as Record<string, ConstitutionalLifecycleState>;
  const domainProjectionByEntity = Object.fromEntries(
    allEntities.map((entry) => [entityId(entry.entity), entry.projection]).filter(([id]) => Boolean(id)),
  ) as Record<string, DomainProjection>;

  return {
    replayAuthority: CLOSURE_REPLAY_AUTHORITY,
    packageId: input.assemblyGraph.packageId,
    replayedAt: input.at,
    closureLedgerId: input.closureLedger.closureLedgerId,
    closureEventCount: input.closureLedger.closureEvents.filter((event) => eventAppliesBefore(event, input.at)).length,
    measuredCenterlineId: input.assemblyGraph.measuredCenterlineId,
    geometryAuthorityId: input.assemblyGraph.geometryAuthorityId ?? input.closureLedger.geometryAuthorityId,
    iofPackageTwin: {
      packageId: input.assemblyGraph.packageId,
      source: "Assembly Graph + Closure Ledger",
      objects: objects.map((entry) => entry.entity),
      spans: spans.map((entry) => entry.entity),
      closureSegments: closureSegments.map((entry) => entry.entity),
      currentStateByEntity,
      domainProjectionByEntity,
      closureEventCount: input.closureLedger.closureEvents.length,
      noStoredCurrentDomain: true,
      noMutableWorkspaceState: true,
    },
  };
}

export const reconstructIofPackageTwin = replayClosureLedger;
