import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = path.dirname(fileURLToPath(import.meta.url));
const runtimeUrl = "http://127.0.0.1:3001/api/runtime";
const proxyTarget = "http://127.0.0.1:3001";

process.chdir(root);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readJsonEndpoint(url) {
  const response = await fetch(url);
  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text();
  const trimmed = text.trimStart();
  return {
    ok: response.ok && contentType.includes("application/json") && trimmed.startsWith("{") && !trimmed.startsWith("<!doctype html"),
    status: response.status,
    contentType,
    text,
    json: contentType.includes("application/json") && trimmed.startsWith("{") ? JSON.parse(text) : null,
  };
}

async function waitForRuntime() {
  const startedAt = Date.now();
  let lastError = "";
  while (Date.now() - startedAt < 12000) {
    try {
      const result = await readJsonEndpoint(runtimeUrl);
      if (result.ok) return result;
      lastError = `${result.status} ${result.contentType} ${result.text.slice(0, 120)}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await delay(250);
  }
  throw new Error(`Express runtime did not return JSON from ${runtimeUrl}. Last error: ${lastError}`);
}

let runtimeProcess = null;
let vite = null;

try {
  let directRuntime;
  try {
    directRuntime = await readJsonEndpoint(runtimeUrl);
  } catch {
    directRuntime = null;
  }

  if (!directRuntime?.ok) {
    runtimeProcess = spawn(process.execPath, ["server/index.js"], {
      cwd: root,
      env: { ...process.env, DAL_PORT: "3001" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    runtimeProcess.stdout.on("data", () => {});
    runtimeProcess.stderr.on("data", () => {});
    directRuntime = await waitForRuntime();
  }

  assert(directRuntime.ok, "Express runtime must serve JSON on /api/runtime.");

  const viteConfigSource = readFileSync(path.join(root, "vite.config.ts"), "utf8");
  assert(viteConfigSource.includes(proxyTarget), "vite.config.ts must default /api proxy to the Express runtime on port 3001.");
  assert(viteConfigSource.includes('"/api"'), "vite.config.ts must proxy /api requests during development.");

  vite = await createServer({
    configFile: false,
    root,
    server: {
      host: "127.0.0.1",
      port: 5179,
      strictPort: false,
      proxy: {
        "/api": {
          target: proxyTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    logLevel: "silent",
  });
  await vite.listen();
  const localUrl = vite.resolvedUrls?.local?.[0] ?? "http://127.0.0.1:5179/";
  const proxiedRuntime = await readJsonEndpoint(new URL("/api/runtime", localUrl).toString());

  assert(
    proxiedRuntime.ok,
    `Vite dev proxy must serve JSON for /api/runtime, not index.html. Received ${proxiedRuntime.status} ${proxiedRuntime.contentType}: ${proxiedRuntime.text.slice(0, 120)}`,
  );
  assert(proxiedRuntime.json?.application || proxiedRuntime.json?.applicationName, "Runtime JSON payload must include application metadata.");

  console.log("Vite API proxy validation passed.");
} finally {
  if (vite) await vite.close();
  if (runtimeProcess) runtimeProcess.kill();
}
