import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const PACKAGE_ID = "ENG-PKG-DRAFT-IOF-PROP-DEMO-OPPORTUNITY-3SWR-v2";
const OUTPUT = resolve("artifacts", "cip046d");

async function dataSnapshot() {
  const root = resolve("server", "data");
  const result = {};
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) {
        const value = await readFile(path);
        const metadata = await stat(path);
        result[path.slice(root.length + 1).replaceAll("\\", "/")] = {
          sha256: createHash("sha256").update(value).digest("hex"),
          bytes: value.length,
          modifiedMs: metadata.mtimeMs,
        };
      }
    }
  }
  await visit(root);
  return result;
}

function changes(before, after) {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((key) => before[key]?.sha256 !== after[key]?.sha256).sort();
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
function command(method, params = {}) { const id = ++sequence; socket.send(JSON.stringify({ id, method, params })); return new Promise((resolveCommand, reject) => pending.set(id, { resolve: resolveCommand, reject })); }
async function evaluate(expression) { const result = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true, userGesture: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text); return result.result.value; }
const delay = (ms) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
async function waitFor(expression, label, timeout = 240_000) { const deadline = Date.now() + timeout; while (Date.now() < deadline) { if (await evaluate(expression)) return; await delay(250); } throw new Error(`Timed out waiting for ${label}.`); }
async function capture(name) { await command("Page.bringToFront"); const image = await command("Page.captureScreenshot", { format: "png", fromSurface: false, captureBeyondViewport: false }); const path = resolve(OUTPUT, name); await writeFile(path, Buffer.from(image.data, "base64")); return path; }

await mkdir(OUTPUT, { recursive: true });
await command("Runtime.enable");
await command("Page.enable");
await command("Emulation.setDeviceMetricsOverride", { width: 1375, height: 780, deviceScaleFactor: 1, mobile: false });
await command("Page.reload", { ignoreCache: true });
await delay(2200);
await evaluate(`(() => { const button = [...document.querySelectorAll('.dal-nav-item')].find((node) => node.textContent.trim() === 'Engineering Certification'); button?.click(); return Boolean(button); })()`);
await waitFor(`document.body.textContent.includes('Engineering Package Browser') || document.querySelector('.engineering-action-inbox')`, "Engineering workspace");
if (!await evaluate(`Boolean(document.querySelector('.engineering-action-inbox'))`)) {
  await waitFor(`Boolean([...document.querySelectorAll('.dal-list-row')].find((node) => node.textContent.includes('${PACKAGE_ID}') && !node.disabled))`, "3SWR Engineering package row");
  await evaluate(`(() => { const row = [...document.querySelectorAll('.dal-list-row')].find((node) => node.textContent.includes('${PACKAGE_ID}')); row.click(); return true; })()`);
}
await waitFor(`Boolean(document.querySelector('.engineering-action-inbox')) && Boolean(document.querySelector('[data-map-presentation-context="ENGINEERING_REVIEW"]'))`, "approval inbox and shared map");
await delay(1200);
await evaluate(`scrollTo({ top: 0, behavior: 'instant' })`);

const beforeNavigation = await dataSnapshot();
const initial = await evaluate(`(() => {
  const shell = document.querySelector('.engineering-review-shell');
  const visible = (node) => Boolean(node && getComputedStyle(node).display !== 'none' && getComputedStyle(node).visibility !== 'hidden' && node.getBoundingClientRect().height > 0);
  const actions = [...document.querySelectorAll('.engineering-action-list > button')].map((node) => ({ text: node.innerText, visible: visible(node) }));
  const firstViewport = (selector) => { const node = document.querySelector(selector); if (!node) return null; const rect = node.getBoundingClientRect(); return { top: Math.round(rect.top), bottom: Math.round(rect.bottom), visible: rect.top < innerHeight && rect.bottom > 0 }; };
  const resources = performance.getEntriesByType('resource').map((entry) => entry.name);
  return {
    packageVisible: shell.innerText.includes('${PACKAGE_ID}'),
    routeContextVisible: visible(document.querySelector('[data-map-presentation-context="ENGINEERING_REVIEW"]')),
    progress: document.querySelector('.engineering-approval-progress')?.innerText ?? '',
    actionCount: document.querySelector('.engineering-action-count')?.innerText ?? '',
    actions,
    headerInViewport: firstViewport('.engineering-review-header'),
    progressInViewport: firstViewport('.engineering-approval-progress'),
    actionsInViewport: firstViewport('.engineering-action-inbox'),
    workspaceInViewport: firstViewport('.engineering-review-workspace'),
    diagnosticsHidden: !visible(document.querySelector('.engineering-review-diagnostics')),
    footerHidden: !visible(document.querySelector('.engineering-review-footer')),
    normalText: shell.innerText,
    forbiddenVisible: ['Baseline hash', 'Revision hash', 'Cache hit', 'Projection time', 'Circuit breaker', 'Reasoning endpoint'].filter((term) => shell.innerText.includes(term)),
    projectedObjectsAsActions: actions.filter((item) => /HH-|handhole|projected object/i.test(item.text)).length,
    stationActions: actions.filter((item) => /station [0-9]|7,957 station/i.test(item.text)).length,
    resourceCounts: { total: resources.length, repository: resources.filter((name) => /repository|packages|engineering-change-sets|commercial-routes/i.test(name)).length, structural: resources.filter((name) => /assembl|projection|reasoning/i.test(name)).length, mutation: resources.filter((name) => /constraints|object-moves|route-redlines|doctrine-exceptions|return-commercial|certify/i.test(name)).length },
  };
})()`);
const initialScreenshot = await capture("engineering-approval-inbox-1375x780.png");

const navigation = [];
for (const label of ["Budget", "Quantities", "Compliance", "Opportunity Map", "Final Review"]) {
  const timing = await evaluate(`(() => { const button = [...document.querySelectorAll('.engineering-review-navigator > button')].find((node) => node.querySelector('span')?.textContent.trim() === ${JSON.stringify(label)}); const start = performance.now(); button?.click(); return { found: Boolean(button), dispatchMs: performance.now() - start }; })()`);
  await delay(120);
  navigation.push({ label, ...timing, activeHeading: await evaluate(`document.querySelector('.engineering-focused-review h3')?.textContent ?? document.querySelector('.engineering-review-canvas-toolbar h3')?.textContent ?? ''`) });
}

await evaluate(`(() => { const button = [...document.querySelectorAll('.engineering-review-navigator > button')].find((node) => node.querySelector('span')?.textContent.trim() === 'Budget'); button.click(); return true; })()`);
await delay(150);
const budget = await evaluate(`(() => ({
  text: document.querySelector('[aria-label="Focused Engineering Budget Review"]')?.innerText ?? '',
  approved: document.querySelector('[aria-label="Focused Engineering Budget Review"]')?.innerText.includes('Engineering Budget Approved') ?? false,
  approveDisabled: document.querySelector('[aria-label="Focused Engineering Budget Review"] .engineering-certification-primary')?.disabled ?? true,
  actionStillPresent: [...document.querySelectorAll('.engineering-action-list > button')].some((node) => node.innerText.includes('Engineering Budget')),
}))()`);

await evaluate(`(() => { const button = [...document.querySelectorAll('.engineering-review-navigator > button')].find((node) => node.querySelector('span')?.textContent.trim() === 'Final Review'); button.click(); return true; })()`);
await delay(150);
const finalReview = await evaluate(`(() => ({
  text: document.querySelector('[aria-label="Final Engineering Review"]')?.innerText ?? '',
  authorityGapVisible: document.querySelector('[aria-label="Final Engineering Review"]')?.innerText.includes('Human Approval Authority Gap') ?? false,
  certifyDisabled: document.querySelector('[aria-label="Final Engineering Review"] .engineering-certification-primary')?.disabled ?? true,
  blockerCount: document.querySelectorAll('[aria-label="Final Engineering Review"] .engineering-final-blockers span').length,
}))()`);
const finalScreenshot = await capture("engineering-final-review-authority-gap-1375x780.png");

await evaluate(`(() => { const more = [...document.querySelectorAll('.engineering-tools-menu')].find((node) => node.querySelector('summary')?.textContent.includes('More Actions')); more.open = true; const tools = [...document.querySelectorAll('.engineering-tools-menu')].find((node) => node.querySelector('summary')?.textContent.includes('Engineering Tools')); tools.open = true; return true; })()`);
const preserved = await evaluate(`(() => ({
  engineeringTools: [...document.querySelectorAll('.engineering-tools-menu')].find((node) => node.querySelector('summary')?.textContent.includes('Engineering Tools'))?.innerText ?? '',
  moreActions: [...document.querySelectorAll('.engineering-tools-menu')].find((node) => node.querySelector('summary')?.textContent.includes('More Actions'))?.innerText ?? '',
  conditionHandlerPresent: Boolean([...document.querySelectorAll('button')].find((node) => node.textContent.includes('Add Engineering Condition'))),
  moveHandlerPresent: Boolean([...document.querySelectorAll('button')].find((node) => node.textContent.includes('Move Object'))),
  redlineHandlerPresent: Boolean([...document.querySelectorAll('button')].find((node) => node.textContent.includes('Create Route Redline'))),
  exceptionHandlerPresent: Boolean([...document.querySelectorAll('button')].find((node) => node.textContent.includes('Record Doctrine Exception'))),
}))()`);

const afterMetrics = await evaluate(`(() => { const resources = performance.getEntriesByType('resource').map((entry) => entry.name); return { total: resources.length, repository: resources.filter((name) => /repository|packages|engineering-change-sets|commercial-routes/i.test(name)).length, structural: resources.filter((name) => /assembl|projection|reasoning/i.test(name)).length, mutation: resources.filter((name) => /constraints|object-moves|route-redlines|doctrine-exceptions|return-commercial|certify/i.test(name)).length }; })()`);
const afterNavigation = await dataSnapshot();
const serviceOrderBefore = Object.keys(beforeNavigation).filter((key) => key.startsWith("service-orders/")).sort();
const serviceOrderAfter = Object.keys(afterNavigation).filter((key) => key.startsWith("service-orders/")).sort();
const scopeVersionBefore = Object.keys(beforeNavigation).filter((key) => key.startsWith("scope-versions/")).sort();
const scopeVersionAfter = Object.keys(afterNavigation).filter((key) => key.startsWith("scope-versions/")).sort();
const result = {
  packageId: PACKAGE_ID,
  viewport: [1375, 780],
  screenshots: { initial: initialScreenshot, finalReview: finalScreenshot, beforeReference: resolve("artifacts", "cip046c", "engineering-regional-1440x900.png") },
  initial,
  navigation,
  budget,
  finalReview,
  preserved,
  navigationResourceDelta: Object.fromEntries(Object.keys(afterMetrics).map((key) => [key, afterMetrics[key] - initial.resourceCounts[key]])),
  serverDataChangesDuringPresentationNavigation: changes(beforeNavigation, afterNavigation),
  serviceOrderCreated: JSON.stringify(serviceOrderBefore) !== JSON.stringify(serviceOrderAfter),
  scopeVersionCreated: JSON.stringify(scopeVersionBefore) !== JSON.stringify(scopeVersionAfter),
  assertions: {
    approvalInboxVisible: initial.actionsInViewport?.visible === true,
    diagnosticsHiddenByDefault: initial.diagnosticsHidden,
    debugTermsAbsentFromNormalReview: initial.forbiddenVisible.length === 0,
    packageAndRouteVisible: initial.packageVisible && initial.routeContextVisible,
    noPerObjectOrStationApprovals: initial.projectedObjectsAsActions === 0 && initial.stationActions === 0,
    budgetApprovalRestoredFromExistingChangeSet: budget.approved && !budget.actionStillPresent,
    contextualNavigationIsPresentationOnly: Object.values(Object.fromEntries(Object.keys(afterMetrics).map((key) => [key, afterMetrics[key] - initial.resourceCounts[key]]))).every((value) => value === 0) && changes(beforeNavigation, afterNavigation).length === 0,
    humanApprovalAuthorityGapReported: finalReview.authorityGapVisible,
    certificationStillExplicitAndBlocked: finalReview.certifyDisabled,
    engineeringToolsAndCommercialRevisionPreserved: /Identify Condition/.test(preserved.engineeringTools) && /Request Commercial Revision/.test(preserved.moreActions),
    noServiceOrderOrScopeVersion: JSON.stringify(serviceOrderBefore) === JSON.stringify(serviceOrderAfter) && JSON.stringify(scopeVersionBefore) === JSON.stringify(scopeVersionAfter),
  },
};
await writeFile(resolve(OUTPUT, "engineering-approval-certification-validation.json"), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
socket.close();
