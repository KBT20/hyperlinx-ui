const engineeringPackageId = "ENG-PKG-DRAFT-IOF-PROP-DEMO-OPPORTUNITY-3SWR-v2";
const target = (await fetch("http://127.0.0.1:9222/json").then((response) => response.json()))
  .find((candidate) => candidate.type === "page" && candidate.url.startsWith("http://127.0.0.1:5173"));
if (!target) throw new Error("Local Teralinx browser target was not found.");
const socket = new WebSocket(target.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  const waiter = pending.get(message.id);
  if (!waiter) return;
  pending.delete(message.id);
  message.error ? waiter.reject(new Error(message.error.message)) : waiter.resolve(message.result);
});
const command = (method, params = {}) => {
  const requestId = ++id;
  socket.send(JSON.stringify({ id: requestId, method, params }));
  return new Promise((resolve, reject) => pending.set(requestId, { resolve, reject }));
};
await command("Page.enable");
await command("Page.reload", { ignoreCache: true });
await new Promise((resolve) => setTimeout(resolve, 2_000));
const result = await command("Runtime.evaluate", {
  awaitPromise: true,
  returnByValue: true,
  expression: `(async () => { const session = JSON.parse(localStorage.getItem('teralinx:auth-session:v1') || '{}'); const response = await fetch('/api/engineering/packages/${engineeringPackageId}', { headers: { Authorization: 'Bearer ' + session.token } }); const body = await response.json(); const engineeringPackage = body.engineeringPackage ?? body; return { status: response.status, engineeringPackageId: engineeringPackage.engineeringPackageId, referenceIntegrity: engineeringPackage.referenceIntegrity, referenceOnly: engineeringPackage.referenceOnly, scopeVersionState: engineeringPackage.scopeVersionState }; })()`,
});
if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
console.log(JSON.stringify(result.result.value, null, 2));
socket.close();
