import type {
  RouteEditFailure,
  RouteEditPatch,
  RouteEditRevisionRecord,
  RouteEditSession,
} from "./RouteEditSession";
import { buildRouteEditProjection } from "./RouteEditProjection";

function routeEditFailure(patch: RouteEditPatch, error: unknown): RouteEditFailure {
  const message = error instanceof Error ? error.message : String(error);
  return {
    failureId: `ROUTE-EDIT-FAILURE-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    patchId: patch.patchId,
    patchType: patch.patchType,
    message,
    timestamp: new Date().toISOString(),
    operatorSafeMessage: `Unable to apply ${patch.label}. Original assembled route remains intact.`,
  };
}

function validatePatch(patch: RouteEditPatch) {
  if (!patch.routeId) throw new Error("Route edit patch is missing routeId.");
  if (!patch.patchType) throw new Error("Route edit patch is missing patchType.");
  if (["MOVE_BOOKEND", "MOVE_ILA"].includes(patch.patchType) && typeof patch.value !== "number") {
    throw new Error(`${patch.patchType} requires numeric milepost value.`);
  }
  if (["REMOVE_ILA", "RESTORE_ILA", "MOVE_ILA", "MOVE_BOOKEND"].includes(patch.patchType) && !patch.targetId) {
    throw new Error(`${patch.patchType} requires a target station id.`);
  }
}

export function routeEditReducer(session: RouteEditSession, patch: RouteEditPatch): RouteEditSession {
  validatePatch(patch);
  const nextSession: RouteEditSession = {
    ...session,
    updatedAt: new Date().toISOString(),
    status: "ACTIVE",
    patches: [...session.patches, patch],
  };
  return {
    ...nextSession,
    projection: buildRouteEditProjection(nextSession),
  };
}

export function safeApplyRouteEditPatch(session: RouteEditSession, patch: RouteEditPatch): RouteEditSession {
  try {
    return routeEditReducer(session, patch);
  } catch (error) {
    const failedPatch = routeEditFailure(patch, error);
    return {
      ...session,
      status: "FAILED_PATCH",
      updatedAt: new Date().toISOString(),
      failedPatches: [failedPatch, ...session.failedPatches],
      projection: {
        ...session.projection,
        warnings: [failedPatch.operatorSafeMessage, ...session.projection.warnings],
      },
    };
  }
}

export function rollbackRouteEditSession(session: RouteEditSession): RouteEditSession {
  const nextSession: RouteEditSession = {
    ...session,
    status: "ACTIVE",
    updatedAt: new Date().toISOString(),
    patches: [],
    failedPatches: [],
  };
  return {
    ...nextSession,
    projection: buildRouteEditProjection(nextSession),
  };
}

export function commitRouteEditSession(session: RouteEditSession, committedBy: string): RouteEditRevisionRecord {
  return {
    routeEditRevisionId: `ROUTE-EDIT-REVISION-${session.routeId}-${Date.now()}`,
    sessionId: session.sessionId,
    opportunityId: session.opportunityId,
    routeId: session.routeId,
    routeRepositoryId: session.routeRepositoryId,
    committedAt: new Date().toISOString(),
    committedBy,
    patchCount: session.patches.length,
    patches: session.patches,
    impact: session.projection.impact,
    patchSetOnly: true,
    assembledRouteEmbedded: false,
    repositoryTruthUnchangedUntilExplicitSave: true,
    noScopeVersionCreation: true,
    noInventoryMutation: true,
  };
}
