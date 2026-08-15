import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const port = 3013;
const base = `http://127.0.0.1:${port}`;
const token = Buffer.from(JSON.stringify({ sub: "teralinx-user-kyle", username: "kyle" })).toString("base64url");
const headers = { Authorization: `Bearer ${token}` };
const server = spawn(process.execPath, [path.join(root, "server", "index.js")], {
  cwd: root,
  env: { ...process.env, DAL_PORT: String(port) },
  stdio: ["ignore", "ignore", "pipe"],
  windowsHide: true,
});
let stderr = "";
server.stderr.on("data", (chunk) => { stderr += chunk.toString(); });

async function waitForHealth() {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${base}/health`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Validation server did not become healthy. ${stderr}`);
}

try {
  await waitForHealth();
  const endpoints = [
    "/api/runtime/workspace-session/current",
    "/api/runtime/rehydrate",
    "/api/runtime/inventories",
    "/api/runtime/objects",
    "/api/proposals",
  ];
  for (const endpoint of endpoints) {
    const response = await fetch(`${base}${endpoint}`, { headers });
    const body = await response.text();
    assert.equal(response.status, 200, `${endpoint} returned ${response.status}: ${body.slice(0, 500)}`);
    assert.doesNotThrow(() => JSON.parse(body), `${endpoint} returned invalid JSON`);
    console.log(`PASS ${endpoint}: 200 (${body.length} bytes)`);
  }

  const packageSource = await readFile(path.join(root, "package.json"), "utf8");
  const launcherSource = await readFile(path.join(root, "scripts", "local-dev.mjs"), "utf8");
  assert.match(packageSource, /"dev": "node scripts\/local-dev\.mjs"/);
  assert.match(launcherSource, /await runtimeIsHealthy\(\)/);
  assert.match(launcherSource, /await waitForRuntime\(runtimeChild\)/);
  console.log("PASS local dev waits for a healthy runtime before starting Vite");

  const performanceSource = await readFile(path.join(root, "src", "performance", "CommercialMutationRuntime.ts"), "utf8");
  const civilDependencies = performanceSource.match(/CIVIL_MIX_CHANGE: \[([^\]]+)\]/)?.[1] ?? "";
  assert.doesNotMatch(civilDependencies, /GEOMETRY|STATIONING|PRODUCT_DOCTRINE|DRAFT_IOF|ENGINEERING|MAP/);
  assert.match(civilDependencies, /QUANTITY/);
  assert.match(civilDependencies, /ESTIMATE/);
  assert.match(civilDependencies, /COMMERCIAL_FINANCIALS/);
  console.log("PASS CIP-044A civil dependency envelope remains unchanged");
  console.log("CIP-044A.1 local runtime rehydration repair validation passed.");
} finally {
  server.kill();
}
