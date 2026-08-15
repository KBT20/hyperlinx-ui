import assert from "node:assert/strict";

const targets = await fetch("http://127.0.0.1:9222/json").then((response) => response.json());
const target = targets.find((candidate) => candidate.type === "page" && candidate.url.startsWith("http://127.0.0.1:5173"));
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
function command(method, params = {}) { const sequence = ++id; socket.send(JSON.stringify({ id: sequence, method, params })); return new Promise((resolve, reject) => pending.set(sequence, { resolve, reject })); }
async function evaluate(expression) { const response = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true, userGesture: true }); if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text); return response.result.value; }
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

await command("Runtime.enable");
await evaluate(`(() => {
  const discard = [...document.querySelectorAll('button')].find((button) => button.textContent.trim() === 'Discard Revision' && !button.disabled);
  discard?.click();
  return Boolean(discard);
})()`);
await delay(500);
await evaluate(`(() => {
  const civil = [...document.querySelectorAll('button')].find((button) => button.textContent.trim() === 'Civil Mix');
  civil?.click();
  return Boolean(civil);
})()`);
await delay(500);
async function setInput(selector, value) {
  const result = await evaluate(`(() => {
    const input = document.querySelector(${JSON.stringify(selector)});
    if (!input || input.disabled) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, ${JSON.stringify(String(value))});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  assert.equal(result, true, `${selector} must be editable`);
  await delay(500);
}
await setInput('input[aria-label="Dirt civil mix percent"]', 13);
await setInput('input[aria-label="Rock civil mix percent"]', 1);
await setInput('input[aria-label="Trench civil mix percent"]', 6);

await evaluate(`(() => {
  const summary = [...document.querySelectorAll('.commercial-workbook-section > summary')].find((node) => node.textContent.includes('2. Estimate Detail'));
  if (summary && !summary.parentElement.open) summary.click();
  return Boolean(summary);
})()`);
await delay(500);
const material = await evaluate(`(async () => {
  const groups = [...document.querySelectorAll('.transparent-authority-group')];
  const group = groups.find((node) => node.querySelector('summary span')?.textContent.trim() === 'Crew / Material Rates');
  if (!group) return { changed: false, reason: 'group missing' };
  group.open = true;
  const row = [...group.querySelectorAll('.transparent-authority-row')].find((node) => /Conduit/i.test(node.querySelector('.transparent-authority-main b')?.textContent ?? ''));
  if (!row) return { changed: false, reason: 'material row missing' };
  const human = [...row.querySelectorAll('button')].find((button) => button.textContent.trim() === 'Enter Human Value');
  human?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  await new Promise((resolve) => setTimeout(resolve, 1500));
  const refreshedGroup = [...document.querySelectorAll('.transparent-authority-group')].find((node) => node.querySelector('summary span')?.textContent.trim() === 'Crew / Material Rates');
  const refreshedRow = [...refreshedGroup.querySelectorAll('.transparent-authority-row')].find((node) => /Conduit/i.test(node.querySelector('.transparent-authority-main b')?.textContent ?? ''));
  const input = [...refreshedRow.querySelectorAll('label')].find((label) => label.querySelector('span')?.textContent.trim() === 'Value')?.querySelector('input');
  if (!input || input.disabled) return { changed: false, reason: 'material value disabled', label: refreshedRow.querySelector('.transparent-authority-main b')?.textContent.trim(), buttons: [...refreshedRow.querySelectorAll('button')].map((button) => button.textContent.trim()), badges: [...refreshedRow.querySelectorAll('.dal-badge')].map((badge) => badge.textContent.trim()) };
  const before = Number(input.value || 0);
  const next = before + 0.01;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, String(next));
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return { changed: true, label: refreshedRow.querySelector('.transparent-authority-main b')?.textContent.trim(), before, next };
})()`);
if (!material.changed) console.log(JSON.stringify({ materialDiagnostic: material }, null, 2));
assert.equal(material.changed, true, JSON.stringify(material));
await delay(1000);
const markupChanged = await evaluate(`(() => {
  const label = [...document.querySelectorAll('.transparent-estimate-explorer label')].find((node) => node.querySelector('span')?.textContent.trim() === 'Markup');
  const input = label?.querySelector('input');
  if (!input || input.disabled) return false;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(input, '22');
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
})()`);
assert.equal(markupChanged, true);
await delay(750);
const result = await evaluate(`(() => ({
  civil: Object.fromEntries(['Plow','Dirt','Rock','Trench'].map((name) => [name, document.querySelector('input[aria-label="' + name + ' civil mix percent"]')?.value ?? ''])),
  total: document.querySelector('.civil-mix-calibration-total b')?.textContent.trim() ?? '',
  markup: [...document.querySelectorAll('.transparent-estimate-explorer label')].find((node) => node.querySelector('span')?.textContent.trim() === 'Markup')?.querySelector('input')?.value ?? '',
  fixtureRequests: performance.getEntriesByName(location.origin + '/customer-inventory/google/MUS%2007162024.kmz').length,
}))()`);
assert.deepEqual(result.civil, { Plow: "80", Dirt: "13", Rock: "1", Trench: "6" });
assert.equal(result.total, "100%");
assert.equal(result.markup, "22");
console.log(JSON.stringify({ ...result, material }, null, 2));
socket.close();
