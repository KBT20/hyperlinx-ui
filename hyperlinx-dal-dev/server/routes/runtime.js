import { readFile } from "node:fs/promises";
import path from "node:path";
import { errorResponse, handleOptions, jsonResponse, nowIso } from "./_shared.js";

const serverStartedAt = nowIso();

async function readPackageVersion() {
  try {
    const pkg = JSON.parse(await readFile(path.join(process.cwd(), "package.json"), "utf8"));
    return String(pkg.version ?? "0.0.0-alpha");
  } catch {
    return "0.0.0-alpha";
  }
}

async function readGitCommit() {
  const envCommit = process.env.GIT_COMMIT ?? process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.RENDER_GIT_COMMIT;
  if (envCommit) return envCommit.slice(0, 12);
  const gitRoots = [path.join(process.cwd(), ".git"), path.join(process.cwd(), "..", ".git")];
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
    jsonResponse(res, 200, {
      applicationName: "Teralinx Infrastructure Operating Platform",
      applicationTitle: "Teralinx Infrastructure Operating Platform",
      organization: "Teralinx",
      workspaceOwner: "Teralinx",
      runtimeVersion,
      gitCommit,
      buildDate,
      environment: process.env.DAL_ENV ?? process.env.NODE_ENV ?? "alpha",
      runtimeStatus: "CONNECTED",
      status: "CONNECTED",
      serverStartedAt,
      sharedRuntime: true,
      libraries: {
        opportunityLibrary: true,
        customerDesignLibrary: true,
        engineeringLibrary: true,
        proposalLibrary: true,
        activityHistory: true,
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
