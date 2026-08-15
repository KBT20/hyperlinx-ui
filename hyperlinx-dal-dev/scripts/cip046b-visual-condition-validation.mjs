import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const PACKAGE_ID = "ENG-PKG-DRAFT-IOF-PROP-DEMO-OPPORTUNITY-3SWR-v2";
const CONDITION_TITLE = "CIP-046B visual acceptance condition";
const targets = await fetch("http://127.0.0.1:9222/json").then((response) => response.json());
const target = targets.find((candidate) => candidate.type === "page" && candidate.url.startsWith("http://127.0.0.1:5173"));
if (!target) throw new Error("Local Teralinx browser target was not found.");
const socket = new WebSocket(target.webSocketDebuggerUrl);
let sequence = 0;
const pending = new Map();
await new Promise((resolveOpen, reject) => { socket.addEventListener("open", resolveOpen, { once: true }); socket.addEventListener("error", reject, { once: true }); });
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (!message.id) return;
  const waiter = pending.get(message.id);
  if (!waiter) return;
  pending.delete(message.id);
  message.error ? waiter.reject(new Error(message.error.message)) : waiter.resolve(message.result);
});
function command(method, params = {}) { const id = ++sequence; socket.send(JSON.stringify({ id, method, params })); return new Promise((resolveCommand, reject) => pending.set(id, { resolve: resolveCommand, reject })); }
async function evaluate(expression) { const result = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true, userGesture: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text); return result.result.value; }
const delay = (ms) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
async function waitFor(expression, label, timeout = 240_000) { const deadline = Date.now() + timeout; while (Date.now() < deadline) { if (await evaluate(expression)) return; await delay(250); } throw new Error(`Timed out waiting for ${label}.`); }

await command("Runtime.enable");
await command("Page.enable");
await command("Emulation.setDeviceMetricsOverride", { width: 1375, height: 780, deviceScaleFactor: 1, mobile: false });
if (!await evaluate(`document.body.textContent.includes('Opportunity Map')`)) {
  await command("Page.reload", { ignoreCache: true });
  await delay(2200);
}
if (!await evaluate(`document.body.textContent.includes('Engineering review')`)) {
  await evaluate(`(() => { const button = [...document.querySelectorAll('button')].find((node) => node.textContent.trim() === 'Engineering Certification'); button?.click(); return Boolean(button); })()`);
}
await waitFor(`document.body.textContent.includes('Engineering Package Browser') || document.body.textContent.includes('Opportunity Map')`, "Engineering workspace");
if (!await evaluate(`document.body.textContent.includes('Opportunity Map')`)) {
  await waitFor(`document.body.textContent.includes('Opportunity Map') || Boolean([...document.querySelectorAll('.dal-list-row')].find((node) => node.textContent.includes('${PACKAGE_ID}') && !node.disabled))`, "restored package or enabled validated package row");
  if (!await evaluate(`document.body.textContent.includes('Opportunity Map')`)) {
    await evaluate(`(() => { const row = [...document.querySelectorAll('.dal-list-row')].find((node) => node.textContent.includes('${PACKAGE_ID}')); row.click(); return true; })()`);
  }
}
await waitFor(`document.body.textContent.includes('Opportunity Map') && document.body.textContent.includes('Identify Condition')`, "human Engineering review");
console.log("stage:review-open");
await delay(1200);

const interactionMetrics = await evaluate(`(() => {
  const durations = {};
  const measure = (name, action) => { const start = performance.now(); action(); durations[name] = performance.now() - start; };
  measure('navigatorChangeMs', () => [...document.querySelectorAll('.engineering-review-navigator button')].find((node) => node.textContent.includes('Conditions'))?.click());
  measure('inspectorOpenMs', () => { const details = document.querySelector('.engineering-identify-condition'); if (details && !details.open) details.open = true; });
  measure('mapSelectionMs', () => { const circle = [...document.querySelectorAll('.engineering-review-canvas circle')].find((node) => node.querySelector('title')?.textContent.includes('HANDHOLE')) ?? document.querySelector('.engineering-review-canvas circle'); circle?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  measure('zoomMs', () => document.querySelector('.engineering-review-canvas svg')?.dispatchEvent(new WheelEvent('wheel', { deltaY: -120, bubbles: true, cancelable: true, clientX: 600, clientY: 350 })));
  return durations;
})()`);
await delay(500);
const initial = await evaluate(`(() => ({
  route: [...document.querySelectorAll('.engineering-review-header-metrics > div')].find((node) => node.querySelector('span')?.textContent === 'Route')?.querySelector('b')?.textContent ?? '',
  proposedState: document.querySelector('.engineering-review-inspector')?.textContent.includes('Proposed / not excepted') ?? false,
  identifyCondition: document.querySelector('.engineering-review-inspector')?.textContent.includes('Identify Condition') ?? false,
  diagnosticsCollapsed: !(document.querySelector('.engineering-review-diagnostics')?.open ?? true),
  openConditions: document.querySelector('.engineering-condition-table')?.textContent ?? '',
  mutationCalls: performance.getEntriesByType('resource').filter((entry) => /constraints|object-moves|route-redlines|doctrine-exceptions|return-commercial|certify/.test(entry.name)).length,
  reasoningCalls: performance.getEntriesByType('resource').filter((entry) => /reasoning|8000/.test(entry.name)).length,
}))()`);
console.log("stage:interactions-measured");

if (!initial.openConditions.includes(CONDITION_TITLE)) {
  await evaluate(`(() => {
    const set = (element, value) => { const descriptor = Object.getOwnPropertyDescriptor(element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype, 'value'); descriptor.set.call(element, value); element.dispatchEvent(new Event('change', { bubbles: true })); element.dispatchEvent(new Event('input', { bubbles: true })); };
    const panel = document.querySelector('.engineering-identify-condition'); panel.open = true;
    const inputs = panel.querySelectorAll('input');
    set(inputs[0], '${CONDITION_TITLE}');
    const selects = panel.querySelectorAll('select');
    set(selects[0], 'Access');
    set(selects[1], 'INFO');
    const area = panel.querySelector('textarea');
    const areaSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set; areaSetter.call(area, 'Visual review acceptance; no physical design change required.'); area.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await delay(150);
  await evaluate(`(() => { [...document.querySelectorAll('.engineering-identify-condition button')].find((node) => node.textContent.includes('Add Engineering Condition')).click(); return true; })()`);
  await waitFor(`document.querySelector('.engineering-review-inspector')?.textContent.includes('${CONDITION_TITLE}')`, "created Engineering condition");
} else {
  await waitFor(`document.querySelector('.engineering-condition-table')?.textContent.includes('${CONDITION_TITLE}')`, "existing Engineering condition");
}

const created = await evaluate(`(() => ({
  inspector: document.querySelector('.engineering-inspector-identity')?.textContent ?? '',
  route: [...document.querySelectorAll('.engineering-review-header-metrics > div')].find((node) => node.querySelector('span')?.textContent === 'Route')?.querySelector('b')?.textContent ?? '',
  conditionRows: document.querySelectorAll('.engineering-condition-table > button').length,
  changeSetNotice: [...document.querySelectorAll('.dal-status')].map((node) => node.textContent).find((text) => text.includes('Engineering Change Set')) ?? '',
}))()`);
console.log("stage:condition-selected");

if (!initial.openConditions.includes('ACCEPTED') && created.inspector.includes(CONDITION_TITLE) && !created.inspector.includes('ACCEPTED')) {
  await evaluate(`(() => { const section = document.querySelector('.engineering-condition-disposition'); const button = [...section.querySelectorAll('button')].find((node) => node.textContent.includes('Accept Proposed Design')); button.click(); return true; })()`);
  await waitFor(`document.querySelector('.engineering-review-inspector')?.textContent.includes('ACCEPTED')`, "accepted condition");
}
await delay(600);
const accepted = await evaluate(`(() => ({
  inspector: document.querySelector('.engineering-inspector-identity')?.textContent ?? '',
  conditionQueue: document.querySelector('.engineering-condition-table')?.textContent ?? '',
  route: [...document.querySelectorAll('.engineering-review-header-metrics > div')].find((node) => node.querySelector('span')?.textContent === 'Route')?.querySelector('b')?.textContent ?? '',
  objectMoveCalls: performance.getEntriesByType('resource').filter((entry) => entry.name.includes('object-moves')).length,
  routeRedlineCalls: performance.getEntriesByType('resource').filter((entry) => entry.name.includes('route-redlines')).length,
  reasoningCalls: performance.getEntriesByType('resource').filter((entry) => /reasoning|8000/.test(entry.name)).length,
  conditionMutationCalls: performance.getEntriesByType('resource').filter((entry) => entry.name.includes('/constraints')).length,
  diagnosticsCollapsed: !(document.querySelector('.engineering-review-diagnostics')?.open ?? true),
  bodyHeight: document.body.scrollHeight,
  viewport: [innerWidth, innerHeight],
}))()`);
console.log("stage:accepted-state-captured");

await evaluate(`document.getElementById('engineering-route')?.scrollIntoView({ behavior: 'instant', block: 'start' })`);
await evaluate(`(() => { const style = document.createElement('style'); style.id = 'cip046b-capture-style'; style.textContent = '.engineering-review-section,.engineering-review-diagnostics,.engineering-certification-footer{display:none!important} body{overflow:hidden!important}'; document.head.appendChild(style); return true; })()`);
await delay(300);
await command("Page.bringToFront");
const screenshot = await command("Page.captureScreenshot", { format: "png", fromSurface: false, captureBeyondViewport: false });
console.log("stage:screenshot-captured");
await evaluate(`(() => { document.getElementById('cip046b-capture-style')?.remove(); document.body.style.removeProperty('overflow'); return true; })()`);
const outputDirectory = resolve("artifacts", "cip046b");
await mkdir(outputDirectory, { recursive: true });
const screenshotPath = resolve(outputDirectory, "engineering-condition-review-after-1375x780.png");
await writeFile(screenshotPath, Buffer.from(screenshot.data, "base64"));
const result = { screenshotPath, interactionMetrics, initial, created, accepted: { ...accepted, reasoningCallsDelta: accepted.reasoningCalls - initial.reasoningCalls } };
await writeFile(resolve(outputDirectory, "condition-workflow-validation.json"), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
socket.close();
