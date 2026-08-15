import assert from "node:assert/strict";

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
async function waitFor(expression, label, timeout = 120_000) {
  const deadline = Date.now() + timeout;
  let lastError = "";
  while (Date.now() < deadline) {
    try {
      if (await evaluate(expression)) return;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await delay(250);
  }
  throw new Error(`Timed out waiting for ${label}.${lastError ? ` Last evaluation error: ${lastError}` : ""}`);
}

const testName = `CIP-045B Fresh KMZ ${new Date().toISOString().replaceAll(":", "-")}`;
await command("Runtime.enable");
await command("Page.enable");
await command("Page.reload", { ignoreCache: true });
await waitFor(`document.readyState === "complete"`, "page reload");
await waitFor(`Boolean([...document.querySelectorAll('.dal-nav-item')].find((button) => button.textContent.trim() === 'Commercial Planning'))`, "Commercial Planning navigation");
await evaluate(`(() => {
  const button = [...document.querySelectorAll('.dal-nav-item')].find((candidate) => candidate.textContent.trim() === 'Commercial Planning');
  button.click();
  return true;
})()`);
await waitFor(`Boolean(document.querySelector('select[aria-label="Select account"]') || document.querySelector('select[aria-label="Active account selector"]'))`, "Commercial account selector");
await evaluate(`(() => {
  const selector = document.querySelector('select[aria-label="Select account"]') || document.querySelector('select[aria-label="Active account selector"]');
  const google = [...selector.options].find((option) => option.textContent.includes('Google'));
  if (!google) throw new Error('Google account option missing.');
  if (selector.value !== google.value) {
    selector.value = google.value;
    selector.dispatchEvent(new Event('change', { bubbles: true }));
  }
  return google.value;
})()`);
await waitFor(`Boolean([...document.querySelectorAll('button')].find((button) => button.textContent.trim() === 'New Opportunity'))`, "Commercial New Opportunity action");

await evaluate(`window.prompt = () => ${JSON.stringify(testName)}; true`);
await evaluate(`(() => {
  const button = [...document.querySelectorAll('.commercial-compact-actions button, .commercial-map-left-rail button')]
    .find((candidate) => candidate.textContent.trim() === 'New Opportunity');
  if (!button) throw new Error('New Opportunity button missing.');
  button.click();
  return true;
})()`);
await waitFor(`Boolean(document.querySelector('[aria-label="New opportunity command"]'))`, "new opportunity command");
await waitFor(`(() => {
  const block = [...document.querySelectorAll('.commercial-compact-header-grid > div')].find((node) => node.querySelector('span')?.textContent.trim() === 'Opportunity ID');
  return Boolean(block?.querySelector('b')?.textContent.trim() && block.querySelector('b').textContent.trim() !== 'Unsaved');
})()`, "fresh Opportunity repository save");

const opportunityBeforeImport = await evaluate(`(() => {
  const block = [...document.querySelectorAll('.commercial-compact-header-grid > div')].find((node) => node.querySelector('span')?.textContent.trim() === 'Opportunity ID');
  return { opportunityId: block?.querySelector('b')?.textContent.trim() ?? '', dialog: Boolean(document.querySelector('[aria-label="New opportunity command"]')) };
})()`);
assert.ok(opportunityBeforeImport.opportunityId && opportunityBeforeImport.opportunityId !== "Unsaved");

await evaluate(`(async () => {
  const input = document.querySelector('[aria-label="New opportunity command"] input[type="file"]');
  if (!input) throw new Error('New Opportunity route import input missing.');
  const response = await fetch('/customer-inventory/google/MUS%2007162024.kmz');
  if (!response.ok) throw new Error('KMZ fixture request failed: ' + response.status);
  const blob = await response.blob();
  const transfer = new DataTransfer();
  transfer.items.add(new File([blob], 'MUS 07162024.kmz', { type: 'application/vnd.google-earth.kmz' }));
  input.files = transfer.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return { size: blob.size };
})()`);

await waitFor(`Boolean(document.querySelector('.route-candidate-selection-card') || document.querySelector('.temporary-imported-route-card .teralinx-summary-grid'))`, "KMZ parsing and route inspection", 180_000);
const candidateCount = await evaluate(`(() => {
  const selector = document.querySelector('select[aria-label="Imported route candidate"]');
  if (!selector) return 1;
  return Math.max(0, selector.options.length - 1);
})()`);
if (candidateCount > 1) {
  await evaluate(`(() => {
    const selector = document.querySelector('select[aria-label="Imported route candidate"]');
    selector.value = selector.options[1].value;
    selector.dispatchEvent(new Event('change', { bubbles: true }));
    return selector.value;
  })()`);
}
await waitFor(`Boolean(document.querySelector('.temporary-imported-route-card .teralinx-summary-grid'))`, "selected route endpoint derivation");
await waitFor(`(() => {
  const card = document.querySelector('.temporary-imported-route-card');
  return card && !card.textContent.includes('Parsing selected route file') && !card.textContent.includes('Source HashMissing');
})()`, "source hash and route preview");

function routePreviewSnapshotExpression() {
  return `(() => {
    const card = document.querySelector('.temporary-imported-route-card');
    const value = (label) => [...(card?.querySelectorAll('.teralinx-summary-grid > div') ?? [])].find((node) => node.querySelector('span')?.textContent.trim() === label)?.querySelector('b')?.textContent.trim() ?? '';
    return {
      text: card?.textContent ?? '',
      sourceType: value('Source Type'),
      sourceHash: value('Source Hash'),
      routeRevision: value('Route Revision'),
      geometryHash: value('Geometry Hash'),
      start: value('Start Endpoint'),
      end: value('End Endpoint'),
      aRelationship: value('A Relationship'),
      zRelationship: value('Z Relationship'),
      siteCoordinates: [...(card?.querySelectorAll('details small') ?? [])].map((node) => node.textContent.trim()),
    };
  })()`;
}
const beforeReverse = await evaluate(routePreviewSnapshotExpression());
assert.ok(beforeReverse.sourceHash && beforeReverse.sourceHash !== "Missing");
assert.ok(beforeReverse.geometryHash);
assert.ok(beforeReverse.start && beforeReverse.end && beforeReverse.start !== beforeReverse.end);
assert.match(beforeReverse.text, /Estimate:\s*\$/);
assert.ok(["MATCH", "NEAR", "MISMATCH", "UNRESOLVED"].includes(beforeReverse.aRelationship));

await evaluate(`(() => { [...document.querySelectorAll('.temporary-imported-route-card button')].find((button) => button.textContent.trim() === 'Reverse A / Z').click(); return true; })()`);
await delay(500);
const afterReverse = await evaluate(routePreviewSnapshotExpression());
assert.equal(afterReverse.sourceHash, beforeReverse.sourceHash);
assert.equal(afterReverse.start, beforeReverse.start);
assert.equal(afterReverse.end, beforeReverse.end);
assert.notDeepEqual(afterReverse.siteCoordinates, beforeReverse.siteCoordinates);

await evaluate(`(() => { [...document.querySelectorAll('.temporary-imported-route-card button')].find((button) => button.textContent.trim() === 'Accept Start as A').click(); return true; })()`);
await delay(300);
await evaluate(`(() => {
  const details = document.querySelector('.temporary-imported-route-card details');
  details.open = true;
  const input = [...details.querySelectorAll('label')].find((label) => label.querySelector('span')?.textContent.trim() === 'Site Name')?.querySelector('input');
  if (!input) throw new Error('A site-name input missing.');
  const coordinate = details.querySelector('small')?.textContent ?? '';
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(input, 'CIP-045B Imported A Site');
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return coordinate;
})()`);
await delay(300);

await evaluate(`(() => {
  const button = [...document.querySelectorAll('.temporary-imported-route-card button')].find((candidate) => candidate.textContent.trim() === 'Save Imported Route');
  if (!button || button.disabled) throw new Error('Save Imported Route is unavailable.');
  button.click();
  return true;
})()`);
await waitFor(`!document.querySelector('.temporary-imported-route-card')`, "governed route save", 180_000);
await waitFor(`document.body.textContent.includes('saved from MUS 07162024.kmz')`, "saved route confirmation", 60_000);

const governed = await evaluate(`(() => {
  const text = document.body.textContent;
  const routeBlocks = [...document.querySelectorAll('.teralinx-summary-grid > div')];
  const values = (label) => routeBlocks.filter((node) => node.querySelector('span')?.textContent.trim() === label).map((node) => node.querySelector('b')?.textContent.trim() ?? '').filter(Boolean);
  return { text, routeMiles: values('Route Miles'), routeRevision: values('Route Revision'), geometryHash: values('Geometry Hash') };
})()`);
assert.match(governed.text, /Route Repository/);
assert.match(governed.text, /Point-to-Point Duct & Dark Fiber/);

await evaluate(`(() => {
  const summary = [...document.querySelectorAll('.commercial-workbook-section > summary')].find((node) => node.textContent.includes('2. Estimate Detail'));
  if (!summary) throw new Error('Estimate Detail section missing.');
  if (!summary.parentElement.open) summary.click();
  return true;
})()`);
await waitFor(`Boolean(document.querySelector('.transparent-estimate-explorer'))`, "transparent estimate projection", 120_000);
const identityBeforeCalibration = { sourceHash: beforeReverse.sourceHash, geometryHash: beforeReverse.geometryHash };
await evaluate(`(() => {
  const mode = document.querySelector('select[aria-label="Civil mix balancing mode"]');
  if (!mode) throw new Error('Civil mix control missing.');
  mode.value = 'MANUAL';
  mode.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
})()`);
await delay(300);
await evaluate(`(() => {
  const desired = { 'Plow': 80, 'Dirt Bore': 14, 'Rock Bore': 0, 'Open Trench': 6, 'Markup': 21 };
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  const changed = [];
  for (const label of document.querySelectorAll('.transparent-estimate-explorer label')) {
    const name = label.querySelector('span')?.textContent.trim();
    if (!(name in desired)) continue;
    const input = label.querySelector('input');
    if (!input || input.disabled) continue;
    setter.call(input, String(desired[name]));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    changed.push(name);
  }
  return changed;
})()`);
await delay(1500);
const calibration = await evaluate(`(() => {
  const values = {};
  for (const label of document.querySelectorAll('.transparent-estimate-explorer label')) {
    const name = label.querySelector('span')?.textContent.trim();
    if (['Plow', 'Dirt Bore', 'Rock Bore', 'Open Trench', 'Markup'].includes(name)) values[name] = label.querySelector('input')?.value ?? '';
  }
  return { values, total: document.querySelector('.transparent-civil-total')?.textContent.trim() ?? '', sourceFixtureRequests: performance.getEntriesByName(location.origin + '/customer-inventory/google/MUS%2007162024.kmz').length };
})()`);
assert.equal(calibration.total, "100%");
assert.equal(identityBeforeCalibration.sourceHash, beforeReverse.sourceHash);
assert.equal(identityBeforeCalibration.geometryHash, beforeReverse.geometryHash);

const saveProposalVisible = await evaluate(`Boolean([...document.querySelectorAll('button')].find((button) => button.textContent.trim() === 'Save Proposal Revision'))`);
let proposal = { saved: false, revision: "", hash: "", routeBindingVisible: false };
if (saveProposalVisible) {
  await evaluate(`(() => { [...document.querySelectorAll('button')].find((button) => button.textContent.trim() === 'Save Proposal Revision').click(); return true; })()`);
  await waitFor(`(() => {
    const blocks = [...document.querySelectorAll('.teralinx-summary-grid > div')];
    const revision = blocks.find((node) => node.querySelector('span')?.textContent.trim() === 'Proposal Revision')?.querySelector('b')?.textContent.trim() ?? '';
    const hash = blocks.find((node) => node.querySelector('span')?.textContent.trim() === 'Revision Hash')?.querySelector('b')?.textContent.trim() ?? '';
    return revision.includes('SAVED') && hash && hash !== 'Save required';
  })()`, "Proposal Revision save", 120_000);
  proposal = await evaluate(`(() => {
    const blocks = [...document.querySelectorAll('.teralinx-summary-grid > div')];
    const value = (label) => blocks.find((node) => node.querySelector('span')?.textContent.trim() === label)?.querySelector('b')?.textContent.trim() ?? '';
    return { saved: true, revision: value('Proposal Revision'), hash: value('Revision Hash'), routeBindingVisible: document.body.textContent.includes('Route Revision') && document.body.textContent.includes('Geometry Hash') };
  })()`);
}

console.log(JSON.stringify({
  browser: await evaluate("navigator.userAgent"),
  testName,
  opportunityBeforeImport,
  fixture: "MUS 07162024.kmz",
  candidateCount,
  beforeReverse,
  afterReverse,
  governed: { routeMiles: governed.routeMiles, routeRevision: governed.routeRevision, geometryHash: governed.geometryHash },
  calibration,
  proposal,
}, null, 2));
socket.close();
