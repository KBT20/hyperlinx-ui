import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const targets = await fetch("http://127.0.0.1:9222/json").then((response) => response.json());
const target = targets.find((candidate) => candidate.type === "page" && candidate.url.startsWith("http://127.0.0.1:5173"));
if (!target) throw new Error("Local Teralinx browser target was not found.");
const socket = new WebSocket(target.webSocketDebuggerUrl);
let sequence = 0;
const pending = new Map();
await new Promise((resolveOpen, reject) => {
  socket.addEventListener("open", resolveOpen, { once: true });
  socket.addEventListener("error", reject, { once: true });
});
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (!message.id) return;
  const waiter = pending.get(message.id);
  if (!waiter) return;
  pending.delete(message.id);
  message.error ? waiter.reject(new Error(message.error.message)) : waiter.resolve(message.result);
});
function command(method, params = {}) {
  const id = ++sequence;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolveCommand, reject) => pending.set(id, { resolve: resolveCommand, reject }));
}
async function evaluate(expression) {
  const result = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true, userGesture: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  return result.result.value;
}
const delay = (ms) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
async function waitFor(expression, label, timeout = 180_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await evaluate(expression)) return;
    await delay(300);
  }
  throw new Error(`Timed out waiting for ${label}.`);
}

await command("Runtime.enable");
await command("Page.enable");
await command("Emulation.setDeviceMetricsOverride", { width: 1375, height: 780, deviceScaleFactor: 1, mobile: false });
await command("Page.reload", { ignoreCache: true });
await delay(2500);
console.log("CIP-046A visual validation: page reloaded");
if (!await evaluate(`document.body.textContent.includes('Engineering review')`)) {
  await evaluate(`(() => { const item = [...document.querySelectorAll('button')].find((node) => node.textContent.trim() === 'Engineering Certification'); if (item) item.click(); return Boolean(item); })()`);
}
await waitFor(`document.body.textContent.includes('Engineering review') || document.body.textContent.includes('Engineering Packages')`, "Engineering workspace");
console.log("CIP-046A visual validation: Engineering workspace reached", await evaluate(`document.body.textContent.slice(0, 800)`));
if (!await evaluate(`document.body.textContent.includes('Opportunity Map')`)) {
  await waitFor(`Boolean(document.querySelector('.dal-list-row'))`, "Engineering package row", 240_000);
  await evaluate(`(() => { const candidates = [...document.querySelectorAll('button')]; const item = candidates.find((node) => node.textContent.includes('ENG-PKG-DRAFT-IOF-PROP-DEMO-OPPORTUNITY-3SWR-v2')) ?? document.querySelector('.dal-list-row'); if (item) item.click(); return Boolean(item); })()`);
}
await waitFor(`document.body.textContent.includes('Opportunity Map')`, "canvas-first Engineering workspace", 240_000);
console.log("CIP-046A visual validation: Opportunity Map reached");
await delay(2500);

const beforeInteraction = await evaluate(`(() => ({
  route: [...document.querySelectorAll('.engineering-review-header-metrics > div')].find((node) => node.querySelector('span')?.textContent === 'Route')?.querySelector('b')?.textContent ?? '',
  diagnosticsOpen: document.querySelector('.engineering-review-diagnostics')?.open ?? true,
  bodyHeight: document.body.scrollHeight,
  viewport: [window.innerWidth, window.innerHeight],
  mapPresent: Boolean(document.querySelector('.engineering-review-canvas .dal-map-kernel')),
  navigatorPresent: Boolean(document.querySelector('.engineering-review-navigator')),
  inspectorPresent: Boolean(document.querySelector('.engineering-review-inspector')),
  footerPresent: Boolean(document.querySelector('.engineering-review-footer')),
  blockerText: document.querySelector('.engineering-review-blocker-banner')?.textContent.trim() ?? '',
  labels: [...document.querySelectorAll('.engineering-review-canvas svg text')].length,
  postRequests: performance.getEntriesByType('resource').filter((entry) => entry.initiatorType === 'fetch' && /constraints|object-moves|route-redlines|doctrine-exceptions|certify|return-commercial/.test(entry.name)).length,
}))()`);

await evaluate(`(() => {
  const lens = [...document.querySelectorAll('.engineering-review-lenses button')].find((node) => node.textContent.trim() === 'OSP');
  lens?.click();
  const svg = document.querySelector('.engineering-review-canvas svg');
  svg?.dispatchEvent(new WheelEvent('wheel', { deltaY: 120, bubbles: true, cancelable: true, clientX: 500, clientY: 350 }));
  return true;
})()`);
await delay(750);
const afterInteraction = await evaluate(`(() => ({
  route: [...document.querySelectorAll('.engineering-review-header-metrics > div')].find((node) => node.querySelector('span')?.textContent === 'Route')?.querySelector('b')?.textContent ?? '',
  activeLens: document.querySelector('.engineering-review-lenses .active-toggle')?.textContent.trim() ?? '',
  diagnosticsOpen: document.querySelector('.engineering-review-diagnostics')?.open ?? true,
  labels: [...document.querySelectorAll('.engineering-review-canvas svg text')].length,
  postRequests: performance.getEntriesByType('resource').filter((entry) => entry.initiatorType === 'fetch' && /constraints|object-moves|route-redlines|doctrine-exceptions|certify|return-commercial/.test(entry.name)).length,
}))()`);

const screenshot = await command("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
const outputDirectory = resolve("artifacts", "cip046a");
await mkdir(outputDirectory, { recursive: true });
const screenshotPath = resolve(outputDirectory, "engineering-workspace-after-1375x780.png");
await writeFile(screenshotPath, Buffer.from(screenshot.data, "base64"));
const result = { screenshotPath, beforeInteraction, afterInteraction };
await writeFile(resolve(outputDirectory, "visual-validation.json"), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
socket.close();
