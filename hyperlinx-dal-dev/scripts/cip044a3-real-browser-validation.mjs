const endpoint = process.argv[2] ?? "http://127.0.0.1:9222";
const targets = await fetch(`${endpoint}/json`).then((response) => response.json());
const target = targets.find((candidate) => candidate.type === "page" && candidate.url.startsWith("http://127.0.0.1:5173"));
if (!target) throw new Error("Local Teralinx browser target was not found.");

const socket = new WebSocket(target.webSocketDebuggerUrl);
let sequence = 0;
const pending = new Map();
const runtimeExceptions = [];
const networkFailures = [];
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id) {
    const waiter = pending.get(message.id);
    if (!waiter) return;
    pending.delete(message.id);
    if (message.error) waiter.reject(new Error(message.error.message));
    else waiter.resolve(message.result);
    return;
  }
  if (message.method === "Runtime.exceptionThrown") runtimeExceptions.push(message.params.exceptionDetails);
  if (message.method === "Network.loadingFailed") networkFailures.push(message.params);
});
function command(method, params = {}) {
  const id = ++sequence;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}
async function evaluate(expression) {
  const response = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true, userGesture: true });
  if (response.exceptionDetails) {
    const detail = response.exceptionDetails.exception?.description ?? response.exceptionDetails.text;
    throw new Error(detail);
  }
  return response.result.value;
}
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
async function waitFor(expression, label, timeout = 30_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await evaluate(expression)) return;
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${label}.`);
}
async function setSelect(labelStart, value) {
  return evaluate(`(async () => {
    const select = [...document.querySelectorAll("select")].find((candidate) => candidate.closest("label")?.innerText.trim().toUpperCase().startsWith(${JSON.stringify(labelStart.toUpperCase())}));
    if (!select) throw new Error(${JSON.stringify(`${labelStart} select not found`)});
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set;
    const started = performance.now();
    setter.call(select, ${JSON.stringify(value)});
    select.dispatchEvent(new Event("change", { bubbles: true }));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return Math.round((performance.now() - started) * 100) / 100;
  })()`);
}
async function setInputByAria(ariaLabel, value) {
  return evaluate(`(async () => {
    const input = document.querySelector(${JSON.stringify(`input[aria-label="${ariaLabel}"]`)});
    if (!input) throw new Error(${JSON.stringify(`${ariaLabel} input not found`)});
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    const started = performance.now();
    setter.call(input, ${JSON.stringify(String(value))});
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return Math.round((performance.now() - started) * 100) / 100;
  })()`);
}
async function enableAuthorityRow(label) {
  const point = await evaluate(`(async () => {
    const row = [...document.querySelectorAll(".transparent-authority-row")].find((candidate) => candidate.querySelector(".transparent-authority-main b")?.textContent === ${JSON.stringify(label)});
    if (!row) throw new Error(${JSON.stringify(`${label} authority row not found`)});
    for (let ancestor = row.parentElement; ancestor; ancestor = ancestor.parentElement) if (ancestor instanceof HTMLDetailsElement) ancestor.open = true;
    const button = [...row.querySelectorAll("button")].find((candidate) => candidate.textContent.includes("Enter Human Value"));
    if (!button) return null;
    button.scrollIntoView({ block: "center" });
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const rect = button.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  })()`);
  if (point) {
    await command("Input.dispatchMouseEvent", { type: "mouseMoved", x: point.x, y: point.y });
    await command("Input.dispatchMouseEvent", { type: "mousePressed", x: point.x, y: point.y, button: "left", clickCount: 1 });
    await command("Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x, y: point.y, button: "left", clickCount: 1 });
  }
  await delay(750);
}
async function setAuthorityValue(label, value) {
  await enableAuthorityRow(label);
  return evaluate(`(async () => {
    const row = [...document.querySelectorAll(".transparent-authority-row")].find((candidate) => candidate.querySelector(".transparent-authority-main b")?.textContent === ${JSON.stringify(label)});
    const input = row.querySelector('input[placeholder="UNKNOWN"]');
    if (input.disabled) throw new Error(${JSON.stringify(`${label} input remained disabled after Enter Human Value`)});
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    const started = performance.now();
    setter.call(input, ${JSON.stringify(String(value))});
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return Math.round((performance.now() - started) * 100) / 100;
  })()`);
}
async function latestTrace() {
  await delay(100);
  return evaluate(`import('/src/performance/CommercialMutationRuntime.ts').then((module) => module.latestCommercialMutationTrace())`);
}
async function ilaSnapshot() {
  return evaluate(`(() => {
    const root = document.querySelector(".ila-planning-panel");
    const metric = (label) => { const box = [...(root?.querySelectorAll(".ila-proposal-summary > div") ?? [])].find((candidate) => candidate.querySelector("span")?.textContent === label); return box?.querySelector("b")?.textContent ?? null; };
    const stationLabels = [...(root?.querySelectorAll(".ila-station-table tbody tr td:first-child b") ?? [])].map((node) => node.textContent);
    return { routeLength: metric("Route Length"), totalStations: Number(metric("Total Stations") ?? NaN), bookends: Number(metric("Bookend Facilities") ?? NaN), intermediate: Number(metric("Intermediate ILAs") ?? NaN), stationLabels };
  })()`);
}
async function workspaceState() {
  return evaluate(`(() => ({
    explorer: Boolean(document.querySelector(".transparent-estimate-explorer")),
    workspaceText: document.body.innerText.includes("Commercial Planning"),
    containedErrors: [...document.querySelectorAll('[data-contained-panel-error]')].map((node) => node.innerText),
    unresolvedAuditCells: [...document.querySelectorAll(".transparent-estimate-section td")].filter((node) => node.textContent === "UNRESOLVED").length,
    knownCost: [...document.querySelectorAll(".transparent-estimate-explorer .transparent-estimate-summary > div")].find((node) => node.querySelector("span")?.textContent === "Known Cost")?.querySelector("b")?.textContent ?? null,
  }))()`);
}

await command("Runtime.enable");
await command("Network.enable");
await waitFor(`document.readyState === "complete"`, "page load");
await waitFor(`Boolean(document.querySelector('select[aria-label="Open opportunity or library item"]'))`, "Commercial opportunity selector");
await evaluate(`(() => { const select = document.querySelector('select[aria-label="Open opportunity or library item"]'); const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set; setter.call(select, "opportunity::OPP-GOOGLE-DFW-ROUTE-36OBJ-1783608785224"); select.dispatchEvent(new Event("change", { bubbles: true })); })()`);
await waitFor(`document.body.innerText.includes("Opportunity restored") || document.body.innerText.includes("COMMERCIAL DRAFT ACTIVE")`, "opportunity restore", 45_000);
await evaluate(`(() => { const summary = [...document.querySelectorAll("summary")].find((candidate) => candidate.innerText.startsWith("2. Estimate Detail")); if (!summary) throw new Error("Estimate Detail summary not found"); if (!summary.parentElement.open) summary.click(); })()`);
await waitFor(`Boolean(document.querySelector(".transparent-estimate-explorer"))`, "Transparent Estimate Explorer");
await delay(500);

const loaded = await workspaceState();
await setSelect("BOOKEND ILAS", "OFF");
await waitFor(`(() => { const root=document.querySelector('.ila-planning-panel'); const box=[...(root?.querySelectorAll('.ila-proposal-summary > div') ?? [])].find((candidate)=>candidate.querySelector('span')?.textContent==='Bookend Facilities'); return box?.querySelector('b')?.textContent === '0'; })()`, "bookends OFF");
const bookendsOff = await ilaSnapshot();
const bookendOnBrowserDurationMs = await setSelect("BOOKEND ILAS", "ON");
await waitFor(`(() => { const root=document.querySelector('.ila-planning-panel'); const box=[...(root?.querySelectorAll('.ila-proposal-summary > div') ?? [])].find((candidate)=>candidate.querySelector('span')?.textContent==='Bookend Facilities'); return box?.querySelector('b')?.textContent === '2'; })()`, "bookends ON");
const bookendsOn = await ilaSnapshot();
const bookendOffBrowserDurationMs = await setSelect("BOOKEND ILAS", "OFF");
await waitFor(`(() => { const root=document.querySelector('.ila-planning-panel'); const box=[...(root?.querySelectorAll('.ila-proposal-summary > div') ?? [])].find((candidate)=>candidate.querySelector('span')?.textContent==='Bookend Facilities'); return box?.querySelector('b')?.textContent === '0'; })()`, "bookends OFF again");
const bookendsOffAgain = await ilaSnapshot();

const beforeCivil = await workspaceState();
const currentDirtPercent = await evaluate(`Number(document.querySelector('input[aria-label="Dirt civil mix percent"]').value)`);
const civilMixBrowserDurationMs = await setInputByAria("Dirt civil mix percent", currentDirtPercent === 13 ? 14 : 13);
const civilMixTrace = await latestTrace();
const afterCivil = await workspaceState();
const currentDirtRate = await evaluate(`Number([...document.querySelectorAll(".transparent-authority-row")].find((candidate) => candidate.querySelector(".transparent-authority-main b")?.textContent === "Directional bore dirt labor rate").querySelector('input[placeholder="UNKNOWN"]').value)`);
const dirtRateBrowserDurationMs = await setAuthorityValue("Directional bore dirt labor rate", currentDirtRate === 16 ? 17 : 16);
const dirtRateTrace = await latestTrace();
const afterDirt = await workspaceState();
const currentRockPercent = await evaluate(`Number(document.querySelector('input[aria-label="Rock civil mix percent"]').value)`);
const rockQuantityBrowserDurationMs = await setInputByAria("Rock civil mix percent", currentRockPercent === 1 ? 2 : 1);
const rockQuantityTrace = await latestTrace();
const currentRockRate = await evaluate(`Number([...document.querySelectorAll(".transparent-authority-row")].find((candidate) => candidate.querySelector(".transparent-authority-main b")?.textContent === "Rock adder").querySelector('input[placeholder="UNKNOWN"]').value)`);
const rockRateBrowserDurationMs = await setAuthorityValue("Rock adder", currentRockRate === 31 ? 32 : 31);
const rockRateTrace = await latestTrace();
const afterRock = await workspaceState();

const finalState = await workspaceState();
const sectionExceptions = runtimeExceptions.filter((entry) => /SectionDetails|TransparentEstimateExplorer|replaceAll/.test(entry.exception?.description ?? entry.text ?? ""));
const reasoningFailures = networkFailures.filter((entry) => /72\.46\.85\.137:8000|reasoning\/health/.test(entry.blockedReason ?? entry.errorText ?? ""));
console.log(JSON.stringify({
  browser: await evaluate(`navigator.userAgent`),
  loaded,
  bookends: { off: bookendsOff, on: bookendsOn, offAgain: bookendsOffAgain, onDurationMs: bookendOnBrowserDurationMs, offDurationMs: bookendOffBrowserDurationMs },
  civilMix: { browserDurationMs: civilMixBrowserDurationMs, trace: civilMixTrace, knownCostBefore: beforeCivil.knownCost, knownCostAfter: afterCivil.knownCost },
  dirtRate: { browserDurationMs: dirtRateBrowserDurationMs, trace: dirtRateTrace, knownCostAfter: afterDirt.knownCost },
  rockCalibration: { quantityBrowserDurationMs: rockQuantityBrowserDurationMs, quantityTrace: rockQuantityTrace, rateBrowserDurationMs: rockRateBrowserDurationMs, rateTrace: rockRateTrace, knownCostAfter: afterRock.knownCost },
  finalState,
  sectionExceptionCount: sectionExceptions.length,
  runtimeExceptionCount: runtimeExceptions.length,
  reasoningFailureCount: reasoningFailures.length,
}, null, 2));
socket.close();
