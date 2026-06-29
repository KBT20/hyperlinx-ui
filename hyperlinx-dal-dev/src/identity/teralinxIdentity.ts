import type { DALWorkspace } from "../dal/DALState";
import type { TeralinxPermission, TeralinxUser } from "../api/teralinxRuntime";

export function userHasPermission(user: TeralinxUser | null | undefined, permission: TeralinxPermission) {
  return Boolean(user?.permissions.includes(permission) || user?.permissions.includes("platform.admin"));
}

export function canAccessWorkspace(user: TeralinxUser | null | undefined, workspace: DALWorkspace) {
  if (!user) return false;
  if (userHasPermission(user, "platform.admin")) return true;
  if (workspace === "googleRfp") return userHasPermission(user, "workspace.commercial");
  if (workspace === "translate") return userHasPermission(user, "workspace.translate");
  if (workspace === "preliminaryProposal" || workspace === "proposedNetwork") return userHasPermission(user, "workspace.proposal");
  if (workspace === "routeEngineering") {
    return userHasPermission(user, "workspace.engineering.write") ||
      userHasPermission(user, "workspace.salesEngineering");
  }
  if (workspace === "candidateSites" || workspace === "networkAffinity") return userHasPermission(user, "workspace.salesEngineering");
  return false;
}

export function workspaceAccessReason(user: TeralinxUser | null | undefined, workspace: DALWorkspace) {
  if (canAccessWorkspace(user, workspace)) return "";
  if (!user) return "Sign in to access this workspace.";
  if (workspace === "control" || workspace === "field" || workspace === "marketplace" || workspace === "ops" || workspace === "twin") {
    return "This lifecycle workspace is outside alpha access.";
  }
  return `${user.name} does not have access to this workspace in the alpha permission model.`;
}
