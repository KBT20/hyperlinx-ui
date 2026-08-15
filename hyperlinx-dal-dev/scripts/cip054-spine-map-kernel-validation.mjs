import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const PACKAGE_ID = "ENG-PKG-DRAFT-IOF-PROP-DEMO-OPPORTUNITY-3SWR-v2";
const OUTPUT = resolve("artifacts", "cip054");
const MAP = '[data-map-presentation-context="TWIN"]';

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
        result[path.slice(root.length + 1).replaceAll("\\", "/")] = { sha256: createHash("sha256").update(contents).digest("hex"), modifiedMs: metadata.mtimeMs };
      }
    }
  }
  await visit(root);
  return result;
}

function changedFiles(before, after) {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((key) => before[key]?.sha256 !== after[key]?.sha256).sort();
}

function diagnosticStationRange(text) {
  const match = text.match(/Station range:\s*(\d+)\+(\d{2})\D+(\d+)\+(\d{2})/i);
  return match ? { start: Number(match[1]) * 100 + Number(match[2]), end: Number(match[3]) * 100 + Number(match[4]) } : null;
}

const targets = await fetch("http://127.0.0.1:9222/json").then((response) => response.json());
const target = targets.find((candidate) => candidate.type === "page" && candidate.url.startsWith("http://127.0.0.1:5173"));
if (!target) throw new Error("Local Teralinx browser target was not found.");
const socket = new WebSocket(target.webSocketDebuggerUrl);
let sequence = 0;
const pending = new Map();
const browserEvents = [];
await new Promise((resolveOpen, reject) => { socket.addEventListener("open", resolveOpen, { once: true }); socket.addEventListener("error", reject, { once: true }); });
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.method === "Runtime.exceptionThrown" || message.method === "Runtime.consoleAPICalled") browserEvents.push(message);
  if (!message.id || !pending.has(message.id)) return;
  const waiter = pending.get(message.id);
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
    await delay(250);
  }
  throw new Error(`Timed out waiting for ${label}.`);
}
async function clickNav(label) {
  const clicked = await evaluate(`(() => { const candidates = [...document.querySelectorAll('.dal-nav-item, button')]; const button = candidates.find((node) => node.textContent.trim() === ${JSON.stringify(label)}) ?? candidates.find((node) => node.textContent.trim().toLowerCase().includes(${JSON.stringify(label.toLowerCase().replace(" certification", ""))})); button?.click(); return Boolean(button); })()`);
  if (!clicked) throw new Error(`${label} navigation was not found. Page: ${await evaluate("document.body.innerText.slice(0, 1200)")} Events: ${JSON.stringify(browserEvents.slice(-8))}`);
}
async function mapSnapshot() {
  return evaluate(`(() => {
    const map = document.querySelector(${JSON.stringify(MAP)});
    const diagnostics = map?.querySelector('.shared-map-diagnostics')?.textContent ?? '';
    const summary = map?.querySelector('.map-lens-summary')?.textContent ?? '';
    const resources = performance.getEntriesByType('resource').map((item) => item.name);
    return {
      context: map?.dataset.mapPresentationContext,
      lens: map?.dataset.mapLens,
      resolution: map?.dataset.mapResolution,
      projected: { features: Number(map?.dataset.projectedFeatures ?? 0), stations: Number(map?.dataset.projectedStations ?? 0), objects: Number(map?.dataset.projectedObjects ?? 0) },
      rendered: { features: Number(map?.dataset.renderedFeatures ?? 0), stations: Number(map?.dataset.renderedStations ?? 0), objects: Number(map?.dataset.renderedObjects ?? 0), labels: Number(map?.dataset.renderedLabels ?? 0) },
      summary,
      diagnostics,
      projectionMs: Number(diagnostics.match(/Projection:\\s*([0-9.]+)\\s*ms/i)?.[1] ?? NaN),
      renderAuthorityPass: /Render Authority:\\s*PASS/i.test(diagnostics),
      duplicateKeysZero: /Duplicate Keys:\\s*0/i.test(diagnostics),
      duplicateAuthoritiesZero: /Duplicate Render Authorities:\\s*0/i.test(diagnostics),
      resourceCounts: {
        repository: resources.filter((name) => /repository|packages|scopeversions|commercial-routes|customer-twins/i.test(name)).length,
        assembly: resources.filter((name) => /assembl|projection|reasoning/i.test(name)).length,
        mutation: resources.filter((name) => /constraints|object-moves|route-redlines|doctrine-exceptions|return-commercial|certify/i.test(name)).length,
      },
    };
  })()`);
}
async function moveToResolution(targetResolution) {
  for (let attempt = 0; attempt < 18; attempt += 1) {
    const current = await evaluate(`document.querySelector(${JSON.stringify(MAP)})?.dataset.mapResolution ?? ''`);
    if (current === targetResolution) return;
    const order = ["REGIONAL", "CORRIDOR", "SEGMENT", "LOCAL", "OBJECT"];
    const title = order.indexOf(current) < order.indexOf(targetResolution) ? "Zoom in" : "Zoom out";
    const clicked = await evaluate(`(() => { const map = document.querySelector(${JSON.stringify(MAP)}); const button = [...map?.querySelectorAll('button') ?? []].find((node) => node.title === ${JSON.stringify(title)}); button?.click(); return Boolean(button); })()`);
    if (!clicked) throw new Error(`${title} control was not available.`);
    await delay(180);
  }
  throw new Error(`Could not reach ${targetResolution}.`);
}

if (process.argv.includes("--inspect-page")) {
  await command("Runtime.enable");
  await delay(500);
  console.log(JSON.stringify(await evaluate(`({ ready: document.readyState, body: document.body.innerText.slice(0, 1200), root: document.querySelector('#root')?.innerHTML.slice(0, 1200), scripts: [...document.scripts].map((item) => item.src), resources: performance.getEntriesByType('resource').slice(-20).map((item) => item.name) })`), null, 2));
  console.log(JSON.stringify(browserEvents.slice(-20), null, 2));
  socket.close();
  process.exit(0);
}

await mkdir(OUTPUT, { recursive: true });
await command("Runtime.enable");
await command("Page.enable");
await command("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
const persistenceBefore = await persistedSnapshot();
// A hard reload is intentional: the runtime projection cache is process-local,
// and acceptance must exercise the current renderer contract rather than a
// React tree retained across Vite hot updates.
await command("Page.reload", { ignoreCache: true });
await delay(1800);
await waitFor(`document.querySelectorAll('.dal-nav-item, button').length > 3`, "application navigation", 120_000);
if (await evaluate(`Boolean(document.querySelector(${JSON.stringify(MAP)}))`)) {
  await clickNav("Marketplace");
  await delay(250);
}
await clickNav("ScopeVersion");
await waitFor(`document.body.textContent.includes('ScopeVersion Selection') || Boolean(document.querySelector(${JSON.stringify(MAP)}))`, "ScopeVersion workspace");
await waitFor(`Boolean(document.querySelector(${JSON.stringify(MAP)} + ' .dal-map-kernel-geographic-svg'))`, "3SWR shared map");
await evaluate(`(() => { const map = document.querySelector(${JSON.stringify(MAP)}); [...map.querySelectorAll('button')].find((node) => node.textContent.trim() === 'Fit Route')?.click(); return true; })()`);
await delay(350);
await moveToResolution("REGIONAL");
const regional = await mapSnapshot();
const resourcesBeforeNavigation = regional.resourceCounts;
await moveToResolution("CORRIDOR");
const corridor = await mapSnapshot();
await moveToResolution("SEGMENT");
const segment = await mapSnapshot();
await moveToResolution("LOCAL");
const local = await mapSnapshot();
await evaluate(`(() => { const map = document.querySelector(${JSON.stringify(MAP)}); const input = map.querySelector('input[aria-label="Go to station or station range"]'); const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(input, '4320+00 - 4385+00'); input.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
await delay(60);
await evaluate(`(() => { const input = document.querySelector(${JSON.stringify(MAP)} + ' input[aria-label="Go to station or station range"]'); input.closest('form').querySelector('button[type="submit"]').click(); return true; })()`);
await delay(350);
const stationRange = await mapSnapshot();
await evaluate(`(() => { const map = document.querySelector(${JSON.stringify(MAP)}); const point = [...map.querySelectorAll('circle')].find((node) => Number(node.getAttribute('r')) > 2); point?.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: Number(point.getAttribute('cx')), clientY: Number(point.getAttribute('cy')) })); return Boolean(point); })()`);
await delay(180);
const selection = await mapSnapshot();
const persistenceAfter = await persistedSnapshot();
const resourcesAfterNavigation = selection.resourceCounts;
const navigatedRange = diagnosticStationRange(stationRange.diagnostics);
const result = {
  packageId: PACKAGE_ID,
  dataset: { routeMiles: 150.68, expectedStations: 7957, expectedObjects: 433, expectedFacilities: 19 },
  samples: { regional, corridor, segment, local, stationRange, selection },
  invariants: {
    allStationsAddressable: regional.projected.stations === 7957,
    allGovernedObjectsAddressable: regional.summary.includes("433 objects") || regional.projected.objects + 19 >= 433,
    regionalDoesNotRenderAllStations: regional.rendered.stations < regional.projected.stations,
    regionalDoesNotRenderAllObjects: regional.rendered.objects < regional.projected.objects,
    progressiveDisclosure: regional.rendered.features <= corridor.rendered.features && corridor.rendered.features <= segment.rendered.features,
    stationRangeNavigationWorks: Boolean(navigatedRange && navigatedRange.start <= 432000 && navigatedRange.end >= 438500 && stationRange.rendered.stations > 0),
    selectionSummaryWorks: /Selection/i.test(selection.summary),
    cachedProjectionEnvelopePass: [regional, corridor, segment, local, stationRange, selection].filter((sample) => Number.isFinite(sample.projectionMs)).every((sample) => sample.projectionMs < 100),
    renderAuthorityPass: [regional, corridor, segment, local].every((sample) => sample.renderAuthorityPass && sample.duplicateKeysZero && sample.duplicateAuthoritiesZero),
    noRepositoryCallsDuringNavigation: resourcesAfterNavigation.repository === resourcesBeforeNavigation.repository,
    noAssemblyOrReasoningCallsDuringNavigation: resourcesAfterNavigation.assembly === resourcesBeforeNavigation.assembly,
    noMutationCallsDuringNavigation: resourcesAfterNavigation.mutation === resourcesBeforeNavigation.mutation,
    noGovernedPersistenceMutation: changedFiles(persistenceBefore, persistenceAfter).length === 0,
  },
  changedPersistenceFiles: changedFiles(persistenceBefore, persistenceAfter),
};
await writeFile(resolve(OUTPUT, "spine-map-kernel-validation.json"), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
socket.close();
