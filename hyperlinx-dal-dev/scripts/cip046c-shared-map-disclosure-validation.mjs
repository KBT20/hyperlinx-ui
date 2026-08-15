import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const PACKAGE_ID = "ENG-PKG-DRAFT-IOF-PROP-DEMO-OPPORTUNITY-3SWR-v2";
const OUTPUT = resolve("artifacts", "cip046c");
const LEVELS = ["REGIONAL", "ROUTE_OVERVIEW", "ENGINEERING_OVERVIEW", "ENGINEERING_DETAIL", "CLOSE_ENGINEERING_DETAIL"];

async function persistedSnapshot() {
  const root = resolve("server", "data");
  const result = {};
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) {
        const contents = await readFile(path);
        const metadata = await stat(path);
        result[path.slice(root.length + 1).replaceAll("\\", "/")] = {
          bytes: contents.length,
          modifiedMs: metadata.mtimeMs,
          sha256: createHash("sha256").update(contents).digest("hex"),
        };
      }
    }
  }
  await visit(root);
  return result;
}

function changedFiles(before, after) {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((key) => before[key]?.sha256 !== after[key]?.sha256)
    .sort();
}

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
async function waitFor(expression, label, timeout = 240_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await evaluate(expression)) return;
    await delay(250);
  }
  throw new Error(`Timed out waiting for ${label}.`);
}
async function clickNavigation(label) {
  const clicked = await evaluate(`(() => { const button = [...document.querySelectorAll('.dal-nav-item')].find((node) => node.textContent.trim() === ${JSON.stringify(label)}); button?.click(); return Boolean(button); })()`);
  if (!clicked) throw new Error(`${label} navigation was not available.`);
}
async function screenshotMap(workspace, scale, selector) {
  await evaluate(`document.querySelector(${JSON.stringify(selector)})?.scrollIntoView({ behavior: 'instant', block: 'center' })`);
  await delay(200);
  await command("Page.bringToFront");
  const screenshot = await command("Page.captureScreenshot", { format: "png", fromSurface: false, captureBeyondViewport: false });
  const path = resolve(OUTPUT, `${workspace}-${scale.toLowerCase().replaceAll('_', '-')}-1440x900.png`);
  await writeFile(path, Buffer.from(screenshot.data, "base64"));
  return path;
}
async function moveToLevel(mapSelector, wheelSelector, desired) {
  for (let attempts = 0; attempts < 24; attempts += 1) {
    const current = await evaluate(`document.querySelector(${JSON.stringify(mapSelector)})?.dataset.mapDisclosureLevel ?? ''`);
    if (current === desired) return;
    const direction = LEVELS.indexOf(desired) > LEVELS.indexOf(current) ? -120 : 120;
    const elapsed = await evaluate(`(() => { const target = document.querySelector(${JSON.stringify(wheelSelector)}); if (!target) return -1; const start = performance.now(); target.dispatchEvent(new WheelEvent('wheel', { deltaY: ${direction}, ctrlKey: target.classList.contains('dal-map-kernel-geographic-svg'), bubbles: true, cancelable: true, clientX: 650, clientY: 400 })); return performance.now() - start; })()`);
    if (elapsed < 0) throw new Error(`Wheel target ${wheelSelector} was not found.`);
    if (attempts === 0 || attempts === 23) console.log(`zoom:${mapSelector}:${current}->${desired}`);
    await delay(180);
  }
  const finalLevel = await evaluate(`document.querySelector(${JSON.stringify(mapSelector)})?.dataset.mapDisclosureLevel ?? ''`);
  throw new Error(`Unable to move ${mapSelector} to ${desired}; final level was ${finalLevel}.`);
}
async function captureMetrics(mapSelector) {
  return evaluate(`(() => {
    const map = document.querySelector(${JSON.stringify(mapSelector)});
    const texts = [...map.querySelectorAll('svg text')].map((node) => node.textContent.trim()).filter(Boolean);
    const resources = performance.getEntriesByType('resource').map((entry) => entry.name);
    return {
      context: map.dataset.mapPresentationContext,
      level: map.dataset.mapDisclosureLevel,
      projected: {
        features: Number(map.dataset.projectedFeatures ?? map.dataset.projectedRoutes ?? 0),
        stations: Number(map.dataset.projectedStations ?? 0),
        objects: Number(map.dataset.projectedObjects ?? 0),
      },
      rendered: {
        features: Number(map.dataset.renderedFeatures ?? 0),
        stations: Number(map.dataset.renderedStations ?? 0),
        objects: Number(map.dataset.renderedObjects ?? 0),
        labels: Number(map.dataset.renderedLabels ?? 0),
      },
      svgTextCount: texts.length,
      svgTexts: texts.slice(0, 80),
      coordinateLabels: texts.filter((text) => /-?\\d{2,3}\\.\\d{4,}\\s*[,/]\\s*-?\\d{2,3}\\.\\d{4,}/.test(text)),
      repositoryArtifactLabels: texts.filter((text) => /(sha256|geometryhash|repository|package-id|sourcefilehash)/i.test(text)),
      resourceCounts: {
        total: resources.length,
        repository: resources.filter((name) => /repository|packages|opportunities|commercial-routes|customer-twins/i.test(name)).length,
        assembly: resources.filter((name) => /assembl|projection|reasoning/i.test(name)).length,
        mutation: resources.filter((name) => /constraints|object-moves|route-redlines|doctrine-exceptions|return-commercial|certify/i.test(name)).length,
      },
      browserViewState: localStorage.getItem('teralinx:map-kernel:view-state:v1'),
    };
  })()`);
}
async function validateScales({ workspace, mapSelector, wheelSelector }) {
  const persistedBefore = await persistedSnapshot();
  const resourceBefore = await captureMetrics(mapSelector);
  const samples = {};
  const timings = [];
  for (const level of ["REGIONAL", "ENGINEERING_OVERVIEW", "CLOSE_ENGINEERING_DETAIL"]) {
    if (workspace === "commercial-planner" && level === "CLOSE_ENGINEERING_DETAIL") {
      await evaluate(`(() => {
        const map = document.querySelector(${JSON.stringify(mapSelector)});
        const marker = map.querySelector('circle[fill="#dcfce7"]') ?? map.querySelector('.commercial-opportunity-overlay circle');
        if (!map || !marker) return false;
        const mapRect = map.getBoundingClientRect();
        const markerRect = marker.getBoundingClientRect();
        const startX = markerRect.left + markerRect.width / 2;
        const startY = markerRect.top + markerRect.height / 2;
        const endX = mapRect.left + mapRect.width / 2;
        const endY = mapRect.top + mapRect.height / 2;
        map.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 91, pointerType: 'mouse', buttons: 1, clientX: startX, clientY: startY, bubbles: true }));
        map.dispatchEvent(new PointerEvent('pointermove', { pointerId: 91, pointerType: 'mouse', buttons: 1, clientX: endX, clientY: endY, bubbles: true }));
        map.dispatchEvent(new PointerEvent('pointerup', { pointerId: 91, pointerType: 'mouse', clientX: endX, clientY: endY, bubbles: true }));
        return true;
      })()`);
      await delay(200);
    }
    const start = Date.now();
    await moveToLevel(mapSelector, wheelSelector, level);
    timings.push({ level, elapsedMs: Date.now() - start });
    await delay(150);
    samples[level] = await captureMetrics(mapSelector);
    samples[level].screenshot = await screenshotMap(workspace, level, mapSelector);
  }
  const resourceAfter = await captureMetrics(mapSelector);
  const persistedAfter = await persistedSnapshot();
  return {
    samples,
    timings,
    resourceDelta: Object.fromEntries(Object.keys(resourceAfter.resourceCounts).map((key) => [key, resourceAfter.resourceCounts[key] - resourceBefore.resourceCounts[key]])),
    browserViewStateChanged: resourceBefore.browserViewState !== resourceAfter.browserViewState,
    serverPersistenceChangedFiles: changedFiles(persistedBefore, persistedAfter),
  };
}

await mkdir(OUTPUT, { recursive: true });
await command("Runtime.enable");
await command("Page.enable");
await command("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await command("Page.reload", { ignoreCache: true });
await delay(2200);

await clickNavigation("Engineering Certification");
await waitFor(`document.body.textContent.includes('Engineering Package Browser') || document.querySelector('[data-map-presentation-context="ENGINEERING_REVIEW"]')`, "Engineering workspace");
if (!await evaluate(`Boolean(document.querySelector('[data-map-presentation-context="ENGINEERING_REVIEW"]'))`)) {
  await waitFor(`Boolean([...document.querySelectorAll('.dal-list-row')].find((node) => node.textContent.includes('${PACKAGE_ID}') && !node.disabled))`, "validated 3SWR package row");
  await evaluate(`(() => { const row = [...document.querySelectorAll('.dal-list-row')].find((node) => node.textContent.includes('${PACKAGE_ID}')); row.click(); return true; })()`);
}
await waitFor(`Boolean(document.querySelector('[data-map-presentation-context="ENGINEERING_REVIEW"] .dal-map-kernel-geographic-svg'))`, "Engineering shared geographic map");
const engineering = await validateScales({
  workspace: "engineering",
  mapSelector: '[data-map-presentation-context="ENGINEERING_REVIEW"]',
  wheelSelector: '[data-map-presentation-context="ENGINEERING_REVIEW"] .dal-map-kernel-geographic-svg',
});

await clickNavigation("Commercial Planning");
await waitFor(`document.body.textContent.includes('Commercial Planning')`, "Commercial Planning workspace");
if (!await evaluate(`Boolean(document.querySelector('[data-map-presentation-context="COMMERCIAL_PLANNER"]'))`)) {
  if (await evaluate(`Boolean(document.querySelector('select[aria-label="Select account"]'))`)) {
    await waitFor(`Boolean([...document.querySelectorAll('select[aria-label="Select account"] option')].find((candidate) => candidate.value === 'account-2'))`, "account-2 fixture option");
    const selectedFixtureAccount = await evaluate(`(() => {
      const select = document.querySelector('select[aria-label="Select account"]');
      const option = [...select.options].find((candidate) => candidate.value === 'account-2');
      if (!option) return false;
      const value = option.value;
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
      setter.call(select, value);
      select.dispatchEvent(new Event('input', { bubbles: true }));
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return value;
    })()`);
    if (!selectedFixtureAccount) throw new Error("The account-2 fixture was not available for Commercial validation.");
    await delay(250);
    await waitFor(`Boolean(document.querySelector('select[aria-label="Opportunity selector"]'))`, "3SWR account Commercial landing");
  }
  await waitFor(`(() => { const select = document.querySelector('select[aria-label="Opportunity selector"]'); return Boolean([...select?.options ?? []].find((option) => /3SWR/i.test(option.textContent + ' ' + option.value))) || Boolean([...document.querySelectorAll('.teralinx-landing-columns button')].find((node) => /3SWR/i.test(node.textContent))); })()`, "3SWR Commercial opportunity library", 90_000);
  await evaluate(`(() => {
    const select = document.querySelector('select[aria-label="Opportunity selector"]');
    const option = [...select?.options ?? []].find((candidate) => /3SWR/i.test(candidate.textContent + ' ' + candidate.value));
    if (select && option) {
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
      setter.call(select, option.value);
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return option.textContent;
    }
    const button = [...document.querySelectorAll('.teralinx-landing-columns button')].find((node) => /3SWR/i.test(node.textContent));
    button?.click();
    return button?.textContent ?? '';
  })()`);
}
await waitFor(`Boolean(document.querySelector('[data-map-presentation-context="COMMERCIAL_PLANNER"]'))`, "Commercial Planner shared map", 120_000);
const planner = await validateScales({
  workspace: "commercial-planner",
  mapSelector: '[data-map-presentation-context="COMMERCIAL_PLANNER"]',
  wheelSelector: '[data-map-presentation-context="COMMERCIAL_PLANNER"]',
});

const result = {
  packageId: PACKAGE_ID,
  viewport: [1440, 900],
  engineering,
  planner,
  invariants: {
    engineeringProjectedStable: new Set(Object.values(engineering.samples).map((sample) => JSON.stringify(sample.projected))).size === 1,
    plannerProjectedStable: new Set(Object.values(planner.samples).map((sample) => JSON.stringify(sample.projected))).size === 1,
    noCoordinateLabels: [...Object.values(engineering.samples), ...Object.values(planner.samples)].every((sample) => sample.coordinateLabels.length === 0),
    noRepositoryArtifactLabels: [...Object.values(engineering.samples), ...Object.values(planner.samples)].every((sample) => sample.repositoryArtifactLabels.length === 0),
    noServerPersistenceWrites: engineering.serverPersistenceChangedFiles.length === 0 && planner.serverPersistenceChangedFiles.length === 0,
    noPanZoomRepositoryAssemblyMutationCalls: [engineering, planner].every((workspace) => workspace.resourceDelta.repository === 0 && workspace.resourceDelta.assembly === 0 && workspace.resourceDelta.mutation === 0),
  },
};
await writeFile(resolve(OUTPUT, "shared-map-disclosure-validation.json"), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
socket.close();
