import { DIRS, handleJsonCollection, nowIso } from "./_shared.js";
import { governedActorAuthority } from "./duty-authority.js";

function normalizeActivity(event = {}, context = {}) {
  const timestamp = event.timestamp ?? event.createdAt ?? nowIso();
  const user = context.operation === "write" ? context.user : null;
  return {
    ...event,
    activityId: String(event.activityId),
    timestamp,
    createdAt: timestamp,
    updatedAt: event.updatedAt ?? timestamp,
    ...(user ? {
      userId: user.userId,
      userName: user.name,
      userRole: user.role,
      principalId: user.principalId ?? user.userId,
      membershipId: user.membershipId,
      organizationId: user.organizationId,
      authSessionId: user.sessionId,
      actorDisplayNameAtAction: user.displayName ?? user.name,
      actorAuthority: governedActorAuthority(user),
    } : {}),
  };
}

export async function handleActivity(req, res, pathname) {
  return handleJsonCollection(req, res, pathname, {
    basePath: "/api/activity",
    dir: DIRS.activity,
    idKey: "activityId",
    listKey: "activity",
    itemKey: "activityEvent",
    pluralBodyKeys: ["activity", "events", "items", "data"],
    idPrefix: "activity",
    normalize: normalizeActivity,
  });
}
