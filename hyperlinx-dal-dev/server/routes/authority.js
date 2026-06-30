import { errorResponse } from "./_shared.js";
import { userFromBearerToken, userHasPermission } from "./auth.js";

export function requireRuntimeUser(req, res) {
  const user = userFromBearerToken(req);
  if (!user) {
    errorResponse(res, 401, "Authentication token is missing or invalid.");
    return null;
  }
  return user;
}

export function requireAnyPermission(req, res, permissions, message = "You do not have authority for this runtime action.") {
  const user = requireRuntimeUser(req, res);
  if (!user) return null;
  const allowed = permissions.some((permission) => userHasPermission(user, permission));
  if (!allowed) {
    errorResponse(res, 403, message);
    return null;
  }
  return user;
}
