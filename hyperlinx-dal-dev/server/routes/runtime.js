import { readFile } from "node:fs/promises";
import path from "node:path";
import { PROJECT_ROOT, errorResponse, handleOptions, jsonResponse, nowIso } from "./_shared.js";

const serverStartedAt = nowIso();

async function readPackageVersion() {
  try {
    const pkg = JSON.parse(await readFile(path.join(PROJECT_ROOT, "package.json"), "utf8"));
    return String(pkg.version ?? "0.0.0-alpha");
  } catch {
    return "0.0.0-alpha";
  }
}

async function readGitCommit() {
  const envCommit = process.env.GIT_COMMIT ?? process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.RENDER_GIT_COMMIT;
  if (envCommit) return envCommit.slice(0, 12);
  const gitRoots = [path.join(PROJECT_ROOT, ".git"), path.join(PROJECT_ROOT, "..", ".git")];
  for (const gitRoot of gitRoots) {
    try {
      const head = (await readFile(path.join(gitRoot, "HEAD"), "utf8")).trim();
      if (head.startsWith("ref:")) {
        const refPath = head.slice(5).trim();
        return (await readFile(path.join(gitRoot, refPath), "utf8")).trim().slice(0, 12);
      }
      if (head) return head.slice(0, 12);
    } catch {
      // Continue to the next possible git root.
    }
  }
  return "local-dev";
}

export async function handleRuntime(req, res, pathname) {
  if (!pathname.startsWith("/api/runtime")) return false;
  if (handleOptions(req, res)) return true;
  const normalizedPath = pathname.replace(/\/+$/, "");

  if (normalizedPath === "/api/runtime" && req.method === "GET") {
    const runtimeVersion = await readPackageVersion();
    const gitCommit = await readGitCommit();
    const buildDate = process.env.BUILD_DATE ?? process.env.VITE_BUILD_DATE ?? serverStartedAt;
    const application = "Teralinx Infrastructure Operating Platform";
    const environment = process.env.DAL_ENV ?? "Alpha";
    jsonResponse(res, 200, {
      application,
      applicationName: application,
      applicationTitle: application,
      organization: "Teralinx",
      workspaceOwner: "Teralinx",
      version: runtimeVersion,
      runtimeVersion,
      gitCommit,
      buildDate,
      environment,
      runtimeStatus: "CONNECTED",
      status: "CONNECTED",
      serverStartedAt,
      sharedRuntime: true,
      libraries: {
        accountLibrary: true,
        contactLibrary: true,
        opportunityLibrary: true,
        customerDesignLibrary: true,
        engineeringLibrary: true,
        proposalLibrary: true,
        productLibrary: true,
        fulfillmentPlanLibrary: true,
        scopeVersionLibrary: true,
        activityHistory: true,
        evidenceRegistry: true,
        runtimeInventoryLibrary: true,
        runtimeObjectLibrary: true,
        relationshipGraph: true,
        workspaceLibrary: true,
        tenantRegistry: true,
        validationPipeline: true,
        connectorRegistry: true,
      },
    });
    return true;
  }

  if (normalizedPath === "/api/runtime/deployments" && req.method === "POST") {
    errorResponse(res, 501, "Runtime deployment is controlled by the Teralinx administrator deployment pipeline.");
    return true;
  }

  return false;
}
