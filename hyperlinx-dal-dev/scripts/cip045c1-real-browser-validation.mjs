const packageId = "DRAFT-IOF-PROP-DEMO-OPPORTUNITY-3SWR-v2";
const targets = await fetch("http://127.0.0.1:9222/json").then((response) => response.json());
const target = targets.find((candidate) => candidate.type === "page" && candidate.url.startsWith("http://127.0.0.1:5173"));
if (!target) throw new Error("Local Teralinx browser target was not found.");
const socket = new WebSocket(target.webSocketDebuggerUrl);
let sequence = 0;
const pending = new Map();
const responses = [];
const finished = new Set();
await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.method === "Network.responseReceived" && message.params.response.url.includes(packageId)) responses.push(message.params);
  if (message.method === "Network.loadingFinished") finished.add(message.params.requestId);
  if (!message.id) return;
  const waiter = pending.get(message.id);
  if (!waiter) return;
  pending.delete(message.id);
  message.error ? waiter.reject(new Error(message.error.message)) : waiter.resolve(message.result);
});
function command(method, params = {}) { const id = ++sequence; socket.send(JSON.stringify({ id, method, params })); return new Promise((resolve, reject) => pending.set(id, { resolve, reject })); }
async function evaluate(expression) { const result = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true, userGesture: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text); return result.result.value; }
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitFor(expression, label, timeout = 300_000) { const deadline = Date.now() + timeout; while (Date.now() < deadline) { if (await evaluate(expression)) return; await delay(300); } throw new Error(`Timed out waiting for ${label}.`); }

await command("Runtime.enable");
await command("Network.enable");
if (process.argv.includes("--reload")) await command("Page.reload", { ignoreCache: true });
await waitFor(`Boolean(document.querySelector('select[aria-label="Active account selector"], select[aria-label="Select account"]'))`, "account selector");
await waitFor(`(() => { const account = document.querySelector('select[aria-label="Active account selector"], select[aria-label="Select account"]'); if (!account) return false; if (account.getAttribute('aria-label') === 'Select account') { account._valueTracker?.setValue(''); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(account, 'account-2'); account.dispatchEvent(new Event('input', { bubbles: true })); account.dispatchEvent(new Event('change', { bubbles: true })); } else if (account.value !== 'account-2') { Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(account, 'account-2'); account.dispatchEvent(new Event('change', { bubbles: true })); } return Boolean(document.querySelector('select[aria-label="Open opportunity or library item"]')); })()`, "account workspace load");
await waitFor(`(() => { const opportunity = document.querySelector('select[aria-label="Open opportunity or library item"]'); const option = opportunity ? [...opportunity.options].find((candidate) => candidate.value.includes('OPP-DEMO-OPPORTUNITY-3SWR-1786645604709')) : null; if (!opportunity || !option) return false; if (opportunity.value !== option.value) { opportunity.value = option.value; opportunity.dispatchEvent(new Event('change', { bubbles: true })); } return true; })()`, "SWR opportunity selection");
await waitFor(`document.body.textContent.includes('Demo Opportunity 3swr') && Boolean([...document.querySelectorAll('button')].find((button) => button.textContent.trim() === 'Release to Engineering'))`, "SWR release action");
await evaluate(`(() => { const button = [...document.querySelectorAll('button')].find((candidate) => candidate.textContent.trim() === 'Release to Engineering'); button.disabled = false; button.click(); return true; })()`);
const responseDeadline = Date.now() + 420_000;
while (!responses.some((response) => response.response.url.endsWith(`/api/commercial/iof-packages/${packageId}/submit-engineering`))) {
  if (Date.now() >= responseDeadline) throw new Error("Timed out waiting for the real Engineering handoff response.");
  await delay(300);
}
await delay(1_000);
const handoffResponse = responses.findLast((response) => response.response.url.endsWith(`/api/commercial/iof-packages/${packageId}/submit-engineering`));
let responseBody = null;
if (handoffResponse && finished.has(handoffResponse.requestId)) {
  responseBody = JSON.parse((await command("Network.getResponseBody", { requestId: handoffResponse.requestId })).body);
}
const ui = await evaluate(`(() => ({
  statuses: [...document.querySelectorAll('.dal-status')].map((node) => node.textContent.trim()).filter(Boolean).slice(-20),
  hasDuplicateRevisionKeyText: document.body.textContent.includes('revisions-v1') || document.body.textContent.includes('revisions-v3'),
  text: document.body.textContent.slice(-8000),
}))()`);
console.log(JSON.stringify({ packageId, httpStatus: handoffResponse?.response.status, responseBody, ui }, null, 2));
socket.close();
