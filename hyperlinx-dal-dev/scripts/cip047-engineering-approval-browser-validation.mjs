import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const PACKAGE_ID = "ENG-PKG-DRAFT-IOF-PROP-DEMO-OPPORTUNITY-3SWR-v2";
const output = resolve("artifacts", "cip047");
await mkdir(output, { recursive: true });
const targets = await fetch("http://127.0.0.1:9222/json").then((response) => response.json());
const target = targets.find((candidate) => candidate.type === "page" && candidate.url.startsWith("http://127.0.0.1:5173"));
if (!target) throw new Error("Local Teralinx browser target was not found.");
const socket = new WebSocket(target.webSocketDebuggerUrl);
let sequence = 0;
const pending = new Map();
await new Promise((resolveOpen, reject) => { socket.addEventListener("open", resolveOpen, { once: true }); socket.addEventListener("error", reject, { once: true }); });
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (!message.id || !pending.has(message.id)) return;
  const waiter = pending.get(message.id);
  pending.delete(message.id);
  message.error ? waiter.reject(new Error(message.error.message)) : waiter.resolve(message.result);
});
function command(method, params = {}) { const id = ++sequence; socket.send(JSON.stringify({ id, method, params })); return new Promise((resolveCommand, reject) => pending.set(id, { resolve: resolveCommand, reject })); }
async function evaluate(expression) { const result = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true, userGesture: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text); return result.result.value; }
const delay = (ms) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
async function waitFor(expression, label, timeout = 180_000) { const deadline = Date.now() + timeout; while (Date.now() < deadline) { if (await evaluate(expression)) return; await delay(250); } throw new Error(`Timed out waiting for ${label}.`); }
async function screenshot(name) { const result = await command("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false }); const path = resolve(output, name); await writeFile(path, Buffer.from(result.data, "base64")); return path; }

await command("Runtime.enable");
await command("Page.enable");
await command("Emulation.setDeviceMetricsOverride", { width: 1375, height: 780, deviceScaleFactor: 1, mobile: false });
await command("Page.reload", { ignoreCache: true });
await delay(2500);
await waitFor(`Boolean(document.querySelector('.dal-nav-item'))`, "application shell", 30_000);
const navClicked = await evaluate(`(() => { const button = [...document.querySelectorAll('.dal-nav-item')].find((node) => node.textContent.trim() === 'Engineering Certification'); button?.click(); return Boolean(button); })()`);
if (!navClicked) throw new Error(`Engineering navigation was unavailable. Page: ${await evaluate(`document.body.innerText.slice(0, 1200)`)}`);
await waitFor(`document.body.textContent.includes('Engineering Package Browser') || document.querySelector('.engineering-approval-progress')`, "Engineering workspace", 30_000);
if (!await evaluate(`Boolean(document.querySelector('.engineering-approval-progress'))`)) {
  await waitFor(`Boolean([...document.querySelectorAll('.dal-list-row')].find((node) => node.textContent.includes('${PACKAGE_ID}') && !node.disabled))`, "3SWR package row");
  await evaluate(`(() => { const row = [...document.querySelectorAll('.dal-list-row')].find((node) => node.textContent.includes('${PACKAGE_ID}')); row.click(); return true; })()`);
}
await waitFor(`document.querySelector('.engineering-approval-progress')?.innerText.includes('Human Approval')`, "approval lifecycle");
await evaluate(`scrollTo({ top: document.querySelector('.engineering-review-header').getBoundingClientRect().top + scrollY - 8, behavior: 'instant' })`);
await delay(1200);
const stateAPath = await screenshot("state-a-real-package-unresolved-1375x780.png");
await evaluate(`(() => { const button = [...document.querySelectorAll('.engineering-review-navigator > button')].find((node) => node.querySelector('span')?.textContent.trim() === 'Compliance'); button.click(); return true; })()`);
await delay(150);
const complianceFailures = await evaluate(`[...document.querySelectorAll('.engineering-compliance-action-list > div')].map((node) => node.innerText)`);
await evaluate(`(() => { const button = [...document.querySelectorAll('.engineering-review-navigator > button')].find((node) => node.querySelector('span')?.textContent.trim() === 'Final Review'); button.click(); return true; })()`);
await delay(250);
const finalPath = await screenshot("state-a-real-package-final-review-1375x780.png");
const stateA = await evaluate(`(() => {
  const progress = document.querySelector('.engineering-approval-progress')?.innerText ?? '';
  const final = document.querySelector('[aria-label="Final Engineering Review"]')?.innerText ?? '';
  const visible = (node) => Boolean(node && getComputedStyle(node).display !== 'none' && node.getBoundingClientRect().height > 0);
  return {
    packageVisible: document.body.innerText.includes('${PACKAGE_ID}'),
    progress,
    final,
    approveButtonVisible: [...document.querySelectorAll('button')].some((node) => visible(node) && /Approve Engineering (Package|Revision)/.test(node.textContent)),
    certifyButtonVisible: [...document.querySelectorAll('button')].some((node) => visible(node) && node.textContent.includes('Certify IOF Package')),
    diagnosticsHidden: !visible(document.querySelector('.engineering-review-diagnostics')),
  };
})()`);
const result = {
  viewport: [1375, 780],
  packageId: PACKAGE_ID,
  stateA,
  complianceFailures,
  screenshots: { unresolved: stateAPath, finalReview: finalPath },
  assertions: {
    packageHeaderVisible: stateA.packageVisible,
    progressPathVisible: /Package Received/.test(stateA.progress) && /Engineering Review/.test(stateA.progress) && /Human Approval/.test(stateA.progress) && /IOF Certification/.test(stateA.progress),
    reviewShowsThreeActions: /3 REMAINING/.test(stateA.progress),
    humanApprovalBlocked: /BLOCKED/.test(stateA.progress),
    noPrematureApproveButton: !stateA.approveButtonVisible,
    noPrematureCertifyButton: !stateA.certifyButtonVisible,
    diagnosticsHiddenByDefault: stateA.diagnosticsHidden,
  },
};
await writeFile(resolve(output, "engineering-approval-browser-validation.json"), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
socket.close();
if (!Object.values(result.assertions).every(Boolean)) process.exitCode = 1;
