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
  if (message.id && pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); return; }
  if (message.method === "Runtime.consoleAPICalled") consoleEvents.push(message.params);
  if (message.method === "Runtime.exceptionThrown") runtimeExceptions.push(message.params);
  if (message.method === "Network.loadingFailed") failedRequests.push(message.params);
};
await new Promise((resolve) => { socket.onopen = resolve; });
const send = (method, params = {}) => new Promise((resolve) => { const id = ++requestId; pending.set(id, resolve); socket.send(JSON.stringify({ id, method, params })); });
const evaluate = async (expression) => { const response = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }); if (response.result?.exceptionDetails) throw new Error(response.result.exceptionDetails.text); return response.result?.result?.value; };
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
await Promise.all([send("Runtime.enable"), send("Network.enable"), send("Page.enable")]);
await send("Page.reload", { ignoreCache: true });
await wait(1200);
const clicked = await evaluate(`(() => { const button=[...document.querySelectorAll('button')].find((item)=>item.textContent.trim()==='Twin') ?? [...document.querySelectorAll('button')].find((item)=>/Twin/.test(item.textContent)); if(!button)return false; button.click(); return true; })()`);
if (!clicked) throw new Error("Twin navigation was not found.");
const started = Date.now();
let ready = false;
for (let attempt = 0; attempt < 160 && !ready; attempt += 1) { await wait(100); ready = Boolean(await evaluate("document.body?.innerText.includes('Commercial Authorization') && document.body?.innerText.includes('SO-PROP-DEMO-OPPORTUNITY-3SWR-v2-R001')")); }
const body = await evaluate("document.body.innerText");
const resources = await evaluate(`performance.getEntriesByType('resource').map((entry)=>({name:entry.name,duration:entry.duration,transferSize:entry.transferSize})).filter((entry)=>entry.name.includes('/api/twin/state')||entry.name.includes('/api/service-orders'))`);
const relevantConsole = consoleEvents.map((entry) => ({ type: entry.type, text: (entry.args ?? []).map((arg) => arg.value ?? arg.description ?? "").join(" ") }));
const integrityFailures = relevantConsole.filter((entry) => /duplicate key|uncaught|integrity fail|twin load failed|authorization action failed/i.test(entry.text));
console.log(JSON.stringify({
  ready,
  readyMs: Date.now() - started,
  commercialAuthorizationVisible: body.includes("Commercial Authorization"),
  authorizedVisible: body.includes("AUTHORIZED"),
  countersignedVisible: body.includes("COUNTERSIGNED"),
  scopeVersionVisible: body.includes("ScopeVersion-0001-CERT-IOF-DRAFT-IOF-PROP-DEMO-OPPORTUNITY-3SWR-v2"),
  pricingVisible: body.includes("$26,334,426") && body.includes("$15,068"),
  routeVisible: body.includes("150.68"),
  sharedMapVisible: body.includes("Shared Opportunity Map"),
  runtimeExceptionCount: runtimeExceptions.length,
  consoleErrorCount: relevantConsole.filter((entry) => entry.type === "error").length,
  integrityFailureCount: integrityFailures.length,
  failedRequestCount: failedRequests.length,
  resources,
  integrityFailures,
  runtimeExceptions: runtimeExceptions.map((entry) => entry.exceptionDetails?.text ?? entry.exceptionDetails?.exception?.description ?? "unknown"),
  bodyExcerpt: body.slice(0, 2200),
}, null, 2));
socket.close();
