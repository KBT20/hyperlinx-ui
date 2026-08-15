const debuggerUrl = process.argv[2];
if (!debuggerUrl) throw new Error("Pass the page webSocketDebuggerUrl.");
const testPassword = process.env.HYPERLINX_TEST_KYLE_PASSWORD;
if (process.argv.includes("--login") && !testPassword) {
  throw new Error("HYPERLINX_TEST_KYLE_PASSWORD is required with --login.");
}

const socket = new WebSocket(debuggerUrl);
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
  const result = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

await command("Runtime.enable");
if (process.argv.includes("--login")) {
  await evaluate(`(() => {
    const inputs = [...document.querySelectorAll("input")];
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    set.call(inputs[0], "kyle"); inputs[0].dispatchEvent(new Event("input", { bubbles: true }));
    set.call(inputs[1], ${JSON.stringify(testPassword)}); inputs[1].dispatchEvent(new Event("input", { bubbles: true }));
    document.querySelector("form")?.requestSubmit();
  })()`);
  await new Promise((resolve) => setTimeout(resolve, 4000));
}
if (process.argv.includes("--select-google")) {
  await evaluate(`(() => {
    const select = document.querySelector('select[aria-label="Select account"]');
    const option = [...select.options].find((candidate) => candidate.textContent.includes("Google"));
    const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set;
    set.call(select, option.value); select.dispatchEvent(new Event("change", { bubbles: true }));
  })()`);
  await new Promise((resolve) => setTimeout(resolve, 5000));
}
if (process.argv.includes("--open-dfw")) {
  await evaluate(`(() => {
    const select = document.querySelector('select[aria-label="Open opportunity or library item"]');
    const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set;
    set.call(select, "opportunity::OPP-GOOGLE-DFW-ROUTE-36OBJ-1783608785224"); select.dispatchEvent(new Event("change", { bubbles: true }));
  })()`);
  await new Promise((resolve) => setTimeout(resolve, 12000));
}
if (process.argv.includes("--open-legacy")) {
  await evaluate(`(() => {
    const select = document.querySelector('select[aria-label="Open opportunity or library item"]');
    const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set;
    set.call(select, "opportunity::GOOGLE-HELIUM-HIU-MUS"); select.dispatchEvent(new Event("change", { bubbles: true }));
  })()`);
  await new Promise((resolve) => setTimeout(resolve, 12000));
}
if (process.argv.includes("--expand-estimate")) {
  await evaluate(`(() => {
    const summary = [...document.querySelectorAll("summary")].find((candidate) => candidate.innerText.startsWith("2. Estimate Detail"));
    if (!summary) throw new Error("Estimate Detail summary not found.");
    if (!summary.parentElement.open) summary.click();
  })()`);
  await new Promise((resolve) => setTimeout(resolve, 4000));
}
if (process.argv.includes("--enable-dirt-rate")) {
  const point = await evaluate(`(async () => {
    const row = [...document.querySelectorAll(".transparent-authority-row")].find((candidate) => candidate.querySelector(".transparent-authority-main b")?.textContent === "Directional bore dirt labor rate");
    for (let ancestor = row?.parentElement; ancestor; ancestor = ancestor.parentElement) if (ancestor instanceof HTMLDetailsElement) ancestor.open = true;
    const button = [...row.querySelectorAll("button")].find((candidate) => candidate.textContent.includes("Enter Human Value"));
    if (!button) throw new Error("Dirt rate human-value button not found");
    button.scrollIntoView({ block: "center" }); await new Promise((resolve) => requestAnimationFrame(resolve));
    const rect = button.getBoundingClientRect(); return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  })()`);
  await command("Input.dispatchMouseEvent", { type: "mousePressed", x: point.x, y: point.y, button: "left", clickCount: 1 });
  await command("Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x, y: point.y, button: "left", clickCount: 1 });
  await new Promise((resolve) => setTimeout(resolve, 3000));
}
const snapshot = await evaluate(`(() => ({
  title: document.title,
  url: location.href,
  text: document.body?.innerText?.slice(0, 30000) ?? "",
  buttons: [...document.querySelectorAll("button")].map((element, index) => ({ index, text: element.innerText, aria: element.getAttribute("aria-label"), disabled: element.disabled })),
  selects: [...document.querySelectorAll("select")].map((element, index) => ({ index, value: element.value, aria: element.getAttribute("aria-label"), label: element.closest("label")?.innerText, options: [...element.options].map((option) => ({ value: option.value, text: option.textContent })) })),
  inputs: [...document.querySelectorAll("input")].map((element, index) => ({ index, value: element.value, aria: element.getAttribute("aria-label"), label: element.closest("label")?.innerText, type: element.type })),
  authorityRows: [...document.querySelectorAll(".transparent-authority-row")].map((element) => ({ label: element.querySelector(".transparent-authority-main b")?.textContent, text: element.innerText, buttons: [...element.querySelectorAll("button")].map((button) => button.textContent), inputs: [...element.querySelectorAll("input")].map((input) => ({ value: input.value, disabled: input.disabled, placeholder: input.placeholder })) })),
  errors: [...document.querySelectorAll('[role="alert"], .dal-status.fail')].map((element) => element.innerText),
  unresolvedAuditCells: [...document.querySelectorAll(".transparent-estimate-section td")].filter((element) => element.textContent === "UNRESOLVED").length,
}))()`);
snapshot.latestTrace = await evaluate(`import('/src/performance/CommercialMutationRuntime.ts').then((module) => module.latestCommercialMutationTrace())`);
console.log(JSON.stringify(snapshot, null, 2));
socket.close();
