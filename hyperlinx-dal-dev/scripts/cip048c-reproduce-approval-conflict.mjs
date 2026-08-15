import { mkdir, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { DIRS } from "../server/routes/_shared.js";

const PACKAGE_ID = "ENG-PKG-DRAFT-IOF-PROP-DEMO-OPPORTUNITY-3SWR-v2";
const output = resolve("artifacts", "cip048c");
await mkdir(output, { recursive: true });
const approvalsBefore = new Set(await readdir(DIRS.engineeringApprovals).catch(() => []));

const targets = await fetch("http://127.0.0.1:9222/json").then((response) => response.json());
const target = targets.find((candidate) => candidate.type === "page" && candidate.url.startsWith("http://127.0.0.1:5173"));
if (!target) throw new Error("Local Teralinx browser target was not found.");
const socket = new WebSocket(target.webSocketDebuggerUrl);
let sequence = 0;
const pending = new Map();
const events = [];
await new Promise((resolveOpen, reject) => {
  socket.addEventListener("open", resolveOpen, { once: true });
  socket.addEventListener("error", reject, { once: true });
});
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const waiter = pending.get(message.id);
    pending.delete(message.id);
    message.error ? waiter.reject(new Error(message.error.message)) : waiter.resolve(message.result);
    return;
  }
  events.push(message);
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

await command("Runtime.enable");
await command("Page.enable");
await command("Network.enable");
await command("Page.reload", { ignoreCache: true });
await delay(2500);
await waitFor(`Boolean(document.querySelector('.dal-nav-item'))`, "application shell");
const navClicked = await evaluate(`(() => { const button = [...document.querySelectorAll('.dal-nav-item')].find((node) => node.textContent.trim() === 'Engineering Certification'); button?.click(); return Boolean(button); })()`);
if (!navClicked) throw new Error("Engineering navigation was unavailable.");
await waitFor(`document.body.innerText.includes('Engineering Package Browser') || Boolean(document.querySelector('.engineering-approval-progress'))`, "Engineering workspace");
if (!await evaluate(`Boolean(document.querySelector('.engineering-approval-progress'))`)) {
  await waitFor(`Boolean([...document.querySelectorAll('.dal-list-row')].find((node) => node.textContent.includes('${PACKAGE_ID}') && !node.disabled))`, "real package row");
  await evaluate(`(() => { const row = [...document.querySelectorAll('.dal-list-row')].find((node) => node.textContent.includes('${PACKAGE_ID}')); row.click(); return true; })()`);
}
await waitFor(`document.querySelector('.engineering-approval-progress')?.innerText.includes('Human Approval\\nREADY')`, "Human Approval READY");
await evaluate(`(() => { const button = [...document.querySelectorAll('.engineering-review-navigator > button')].find((node) => node.querySelector('span')?.textContent.trim() === 'Final Review'); button?.click(); return Boolean(button); })()`);
await waitFor(`[...document.querySelectorAll('button')].some((node) => node.textContent.includes('Approve Engineering Revision'))`, "approval action");
const renderedAuthority = await evaluate(`(() => { const card = document.querySelector('.engineering-human-approval-ready'); const values = [...(card?.querySelectorAll('.engineering-approval-authority-summary > span') ?? [])].map((node) => ({ label: node.childNodes[0]?.textContent?.trim(), value: node.querySelector('b')?.textContent?.trim() })); return Object.fromEntries(values.map(({ label, value }) => [label, value])); })()`);
await evaluate(`(() => { const button = [...document.querySelectorAll('button')].find((node) => node.textContent.trim() === 'Approve Engineering Revision'); button?.click(); return true; })()`);
await waitFor(`Boolean(document.querySelector('.engineering-approval-confirm'))`, "approval confirmation modal");
events.length = 0;
await evaluate(`(() => { const modal = document.querySelector('.engineering-approval-confirm'); const button = [...modal.querySelectorAll('button')].find((node) => node.textContent.trim() === 'Approve Engineering Revision'); button.click(); return true; })()`);
let responseEvent;
const responseDeadline = Date.now() + 30_000;
while (Date.now() < responseDeadline) {
  responseEvent = events.find((message) => message.method === "Network.responseReceived"
    && message.params.response.url.endsWith("/api/engineering/approvals")
    && message.params.response.status === 409);
  if (responseEvent) break;
  await delay(100);
}
if (!responseEvent) throw new Error("Expected approval 409 was not observed.");
const responseBody = await command("Network.getResponseBody", { requestId: responseEvent.params.requestId });
const requestEvent = events.find((message) => message.method === "Network.requestWillBeSent" && message.params.requestId === responseEvent.params.requestId);
const response = JSON.parse(responseBody.body);
const approvalsAfter = new Set(await readdir(DIRS.engineeringApprovals).catch(() => []));
const result = {
  capturedAt: new Date().toISOString(),
  packageId: PACKAGE_ID,
  request: {
    url: requestEvent?.params.request.url,
    method: requestEvent?.params.request.method,
    body: JSON.parse(requestEvent?.params.request.postData ?? "{}"),
  },
  renderedAuthority,
  status: responseEvent.params.response.status,
  response,
  approvalRepositoryUnchanged: approvalsBefore.size === approvalsAfter.size,
};
await writeFile(resolve(output, "exact-approval-409-before-repair.json"), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
socket.close();
if (result.status !== 409 || !result.approvalRepositoryUnchanged) process.exitCode = 1;
