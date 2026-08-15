const targets = await fetch("http://127.0.0.1:9222/json").then((response) => response.json());
const target = targets.find((candidate) => candidate.type === "page" && candidate.url.startsWith("http://127.0.0.1:5173"));
if (!target) throw new Error("Local Teralinx browser target was not found.");
const socket = new WebSocket(target.webSocketDebuggerUrl);
let sequence = 0;
const pending = new Map();
const consoleEvents = [];
await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.method === "Runtime.consoleAPICalled") consoleEvents.push(message.params);
  if (!message.id) return;
  const waiter = pending.get(message.id);
  if (!waiter) return;
  pending.delete(message.id);
  message.error ? waiter.reject(new Error(message.error.message)) : waiter.resolve(message.result);
});
function command(method, params = {}) { const id = ++sequence; socket.send(JSON.stringify({ id, method, params })); return new Promise((resolve, reject) => pending.set(id, { resolve, reject })); }
async function evaluate(expression) { const result = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true, userGesture: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text); return result.result.value; }
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitFor(expression, label, timeout = 180_000) { const deadline = Date.now() + timeout; while (Date.now() < deadline) { if (await evaluate(expression)) return; await delay(250); } throw new Error(`Timed out waiting for ${label}.`); }

await command("Runtime.enable");
await evaluate(`(() => {
  const account = document.querySelector('select[aria-label="Active account selector"]') || document.querySelector('select[aria-label="Select account"]');
  const option = [...account.options].find((item) => item.value === 'account-2');
  if (!option) throw new Error('Demo account missing.');
  account.value = option.value;
  account.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
})()`);
await waitFor(`Boolean(document.querySelector('select[aria-label="Open opportunity or library item"] option[value*="OPP-DEMO-OPPORTUNITY-2-GGL-HELSWR"]'))`, "target opportunity option");
await evaluate(`(() => {
  const selector = document.querySelector('select[aria-label="Open opportunity or library item"]');
  const option = [...selector.options].find((item) => item.value.includes('OPP-DEMO-OPPORTUNITY-2-GGL-HELSWR'));
  selector.value = option.value;
  selector.dispatchEvent(new Event('change', { bubbles: true }));
  return option.value;
})()`);
await waitFor(`document.body.textContent.includes('Demo Opportunity 2 ggl helswr') && document.body.textContent.includes('Release to Engineering')`, "target release surface", 240_000);
await delay(2_000);
const before = await evaluate(`(() => {
  const button = [...document.querySelectorAll('button')].find((item) => item.textContent.trim() === 'Release to Engineering');
  const proposal = [...document.querySelectorAll('.teralinx-summary-grid > div')].find((node) => node.querySelector('span')?.textContent.trim() === 'Proposal Revision')?.querySelector('b')?.textContent.trim() ?? '';
  return { button: Boolean(button), disabled: button?.disabled ?? true, proposal, body: document.body.textContent.slice(0, 5000) };
})()`);
if (!before.button || before.disabled) throw new Error(`Release action unavailable: ${JSON.stringify(before)}`);
await evaluate(`(() => { [...document.querySelectorAll('button')].find((item) => item.textContent.trim() === 'Release to Engineering').click(); return true; })()`);
await waitFor(`document.body.textContent.includes('112989222') || document.body.textContent.includes('112,989,222') || document.body.textContent.includes('Draft IOF reference-only save blocked')`, "expected reference-only payload failure", 300_000);
await delay(1_000);
const after = await evaluate(`(() => ({
  notice: [...document.querySelectorAll('.dal-status')].map((node) => node.textContent.trim()).find((text) => text.includes('Draft IOF reference-only save blocked')) ?? '',
  text: document.body.textContent.slice(-10000),
}))()`);
const payloadEvent = consoleEvents.findLast((event) => event.args?.some((arg) => arg.value === "[Draft IOF Save] payload size audit"));
let payloadAudit = null;
if (payloadEvent) {
  const objectArg = payloadEvent.args.find((arg) => arg.objectId);
  if (objectArg) {
    const value = await command("Runtime.callFunctionOn", { objectId: objectArg.objectId, functionDeclaration: "function () { return this; }", returnByValue: true });
    payloadAudit = value.result.value;
  }
}
console.log(JSON.stringify({ before, notice: after.notice, payloadAudit }, null, 2));
socket.close();
