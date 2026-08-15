import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptsDirectory, "..");
const serverEntry = path.join(projectRoot, "server", "index.js");
const viteEntry = path.join(projectRoot, "node_modules", "vite", "bin", "vite.js");
const viteArguments = [viteEntry, "--config", "vite.config.ts", ...process.argv.slice(2)];
const proxyTarget = String(process.env.VITE_DAL_DEV_API_PROXY || "http://127.0.0.1:3001").replace(/\/+$/, "");
const healthUrl = `${proxyTarget}/health`;
const ownedChildren = new Set();
let stopping = false;

async function runtimeIsHealthy() {
  try {
    const response = await fetch(healthUrl, { signal: AbortSignal.timeout(1_000) });
    if (!response.ok) return false;
    const body = await response.json();
    return body?.ok === true && body?.service === "hyperlinx-dal-dev";
  } catch {
    return false;
  }
}

function startNode(args, options = {}) {
  const child = spawn(process.execPath, args, {
    cwd: projectRoot,
    env: process.env,
    stdio: "inherit",
    windowsHide: true,
    ...options,
  });
  ownedChildren.add(child);
  child.once("exit", () => ownedChildren.delete(child));
  return child;
}

async function waitForRuntime(child) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Local runtime exited with code ${child.exitCode} before becoming healthy.`);
    if (await runtimeIsHealthy()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Local runtime did not become healthy at ${healthUrl} within 10 seconds.`);
}

function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of ownedChildren) child.kill();
  process.exitCode = exitCode;
}

process.once("SIGINT", () => stop(0));
process.once("SIGTERM", () => stop(0));

let runtimeChild = null;
if (!(await runtimeIsHealthy())) {
  const target = new URL(proxyTarget);
  const localTarget = ["127.0.0.1", "localhost", "::1"].includes(target.hostname);
  if (!localTarget) throw new Error(`Configured API proxy ${proxyTarget} is unavailable; refusing to start a local server for a non-local target.`);
  const runtimeEnvironment = {
    ...process.env,
    DAL_PORT: target.port || (target.protocol === "https:" ? "443" : "80"),
  };
  console.log(`[local-dev] Runtime unavailable at ${healthUrl}; starting the local runtime first.`);
  runtimeChild = startNode([serverEntry], { env: runtimeEnvironment });
  await waitForRuntime(runtimeChild);
}

console.log(`[local-dev] Runtime healthy at ${healthUrl}; starting Vite.`);
const viteChild = startNode(viteArguments);

viteChild.once("exit", (code) => stop(code ?? 0));
runtimeChild?.once("exit", (code) => {
  if (!stopping) {
    console.error(`[local-dev] Local runtime stopped unexpectedly with code ${code ?? 1}.`);
    stop(code ?? 1);
  }
});
