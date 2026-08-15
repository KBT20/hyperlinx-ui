const pages = await (await fetch("http://127.0.0.1:9222/json/list")).json();
const page = pages.find((item) => item.type === "page" && item.url === "http://127.0.0.1:5173/");
if (!page) throw new Error("Teralinx browser page is not available on the debug endpoint.");

const socket = new WebSocket(page.webSocketDebuggerUrl);
let requestId = 0;
const pending = new Map();
const consoleEvents = [];
const runtimeExceptions = [];
const failedRequests = [];

socket.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    pending.get(message.id)(message);
    pending.delete(message.id);
    return;
  }
  if (message.method === "Runtime.consoleAPICalled") consoleEvents.push(message.params);
  if (message.method === "Runtime.exceptionThrown") runtimeExceptions.push(message.params);
  if (message.method === "Network.loadingFailed") failedRequests.push(message.params);
};

await new Promise((resolve) => { socket.onopen = resolve; });
const send = (method, params = {}) => new Promise((resolve) => {
  const id = ++requestId;
  pending.set(id, resolve);
  socket.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression) => {
  const response = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (response.result?.exceptionDetails) throw new Error(response.result.exceptionDetails.text ?? "Browser evaluation failed.");
  return response.result?.result?.value;
};
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

await Promise.all([send("Runtime.enable"), send("Network.enable"), send("Page.enable")]);
const reloadStartedAt = Date.now();
await send("Page.reload", { ignoreCache: true });
let reloadReady = false;
for (let attempt = 0; attempt < 200 && !reloadReady; attempt += 1) {
  await wait(50);
  reloadReady = Boolean(await evaluate("document.body?.innerText.includes('Certified IOF Twin')"));
}
const reloadReadyMs = Date.now() - reloadStartedAt;

const signedIn = await evaluate("Boolean(localStorage.getItem('teralinx:auth-session:v1'))");
if (!signedIn) throw new Error("The existing browser is not signed into the local Teralinx workspace.");

const clicked = await evaluate(`(() => {
  const candidates = [...document.querySelectorAll('button')];
  const button = candidates.find((item) => item.textContent.trim() === 'Twin')
    ?? candidates.find((item) => /Twin/.test(item.textContent));
  if (!button) return false;
  button.click();
  return true;
})()`);
if (!clicked) throw new Error("Twin workspace navigation control was not found.");
await wait(2500);

const view = await evaluate(`(() => {
  const body = document.body.innerText;
  const resourceEntries = performance.getEntriesByType('resource');
  const twinRequest = resourceEntries.filter((entry) => entry.name.includes('/api/twin/state?certified=true')).at(-1);
  return {
    title: document.title,
    certifiedTwinVisible: body.includes('Certified IOF Twin'),
    certifiedStateVisible: body.includes('CERTIFIED'),
    executionBlockedVisible: body.includes('NOT AUTHORIZED'),
    serviceOrderNotCreatedVisible: body.includes('NOT CREATED'),
    sharedMapVisible: body.includes('Shared Opportunity Map'),
    lineageVisible: body.includes('Certification & Lineage'),
    lensAuthorityVisible: body.includes('Lens Authority & Package Integrity'),
    mapSvgCount: document.querySelectorAll('svg').length,
    mapCanvasCount: document.querySelectorAll('canvas').length,
    twinRequestDurationMs: twinRequest ? Math.round(twinRequest.duration * 10) / 10 : null,
    twinRequestBytes: twinRequest ? twinRequest.transferSize : null,
    twinResourceNames: resourceEntries.map((entry) => entry.name).filter((name) => /twin/i.test(name)),
    bodyExcerpt: body.slice(0, 2400),
  };
})()`);

const relevantConsole = consoleEvents.map((entry) => ({
  type: entry.type,
  text: (entry.args ?? []).map((arg) => arg.value ?? arg.description ?? "").join(" "),
}));
const integrityFailures = relevantConsole.filter((entry) => /duplicate key|render.authority|uncaught|integrity fail|twin load failed|hydration fail/i.test(entry.text));
const failedRepositoryRequests = failedRequests.filter((entry) => /\/api\//.test(entry.requestId ?? entry.errorText ?? ""));

console.log(JSON.stringify({
  ...view,
  reloadReadyMs,
  runtimeExceptionCount: runtimeExceptions.length,
  integrityFailureCount: integrityFailures.length,
  failedRepositoryRequestCount: failedRepositoryRequests.length,
  consoleErrorCount: relevantConsole.filter((entry) => entry.type === "error").length,
  consoleWarningCount: relevantConsole.filter((entry) => entry.type === "warning").length,
  consoleWarnings: relevantConsole.filter((entry) => entry.type === "warning"),
  integrityFailures,
}, null, 2));
socket.close();
