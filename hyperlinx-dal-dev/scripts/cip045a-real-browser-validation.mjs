const endpoint = process.argv[2] ?? "http://127.0.0.1:9222";
const targets = await fetch(`${endpoint}/json`).then((response) => response.json());
const target = targets.find((candidate) => candidate.type === "page" && candidate.url.startsWith("http://127.0.0.1:5173"));
if (!target) throw new Error("Local Teralinx browser target was not found.");

const socket = new WebSocket(target.webSocketDebuggerUrl);
let sequence = 0;
const pending = new Map();
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (!message.id) return;
  const waiter = pending.get(message.id);
  if (!waiter) return;
  pending.delete(message.id);
  if (message.error) waiter.reject(new Error(message.error.message));
  else waiter.resolve(message.result);
});
function command(method, params = {}) {
  const id = ++sequence;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}
async function evaluate(expression) {
  const response = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true, userGesture: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text);
  return response.result.value;
}
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
async function waitFor(expression, label, timeout = 45_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await evaluate(expression)) return;
    await delay(200);
  }
  throw new Error(`Timed out waiting for ${label}.`);
}
async function snapshot() {
  return evaluate(`(() => {
    const card = document.querySelector('.commercial-constitutional-handoff-card');
    const rows = card ? [...card.querySelectorAll('.dal-list-row')].map((row) => ({
      label: row.querySelector('b')?.textContent?.trim() ?? '',
      state: row.querySelector('.dal-badge')?.textContent?.trim() ?? '',
      detail: row.querySelector('small')?.textContent?.trim() ?? '',
    })) : [];
    const selector = card?.querySelector('.commercial-release-revision-selector select');
    return {
      account: document.querySelector('select[aria-label="Active account selector"]')?.value ?? document.querySelector('select[aria-label="Select account"]')?.value ?? '',
      opportunity: document.querySelector('select[aria-label="Open opportunity or library item"]')?.value ?? '',
      cardVisible: Boolean(card),
      heading: card?.querySelector('h3')?.textContent?.trim() ?? '',
      rows,
      releaseButton: [...(card?.querySelectorAll('button') ?? [])].find((button) => button.textContent.includes('Release to Engineering'))?.textContent?.trim() ?? '',
      eligibleRevisionOptions: selector ? [...selector.options].map((option) => ({ value: option.value, text: option.textContent.trim() })) : [],
      notice: document.querySelector('.commercial-proposal-runtime-notice')?.textContent?.trim() ?? '',
    };
  })()`);
}

await command("Runtime.enable");
await waitFor(`document.readyState === "complete"`, "initial page load");
console.log("Browser stage: initial page loaded");
await waitFor(`Boolean(document.querySelector('.commercial-constitutional-handoff-card'))`, "preselected Commercial Release Readiness card", 10_000);
console.log("Browser stage: current Google readiness displayed");
const beforeReload = await snapshot();
await command("Page.enable");
await command("Page.reload", { ignoreCache: true });
await waitFor(`document.readyState === "complete"`, "reload");
await delay(1500);
console.log("Browser stage: page reloaded");
await waitFor(`Boolean(document.querySelector('.commercial-constitutional-handoff-card'))`, "readiness rehydration", 90_000);
console.log("Browser stage: readiness rehydrated");
const afterReload = await snapshot();
console.log(JSON.stringify({ browser: await evaluate("navigator.userAgent"), beforeReload, afterReload }, null, 2));
socket.close();
