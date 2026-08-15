import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import fs from "node:fs";
import pathModule from "node:path";
import JSZip from "jszip";

const base = process.env.CIP052_API ?? "http://127.0.0.1:3199";
const testPassword = process.env.HYPERLINX_TEST_KYLE_PASSWORD;
if (!testPassword) throw new Error("HYPERLINX_TEST_KYLE_PASSWORD is required.");
const scopeId = "ScopeVersion-0001-CERT-IOF-DRAFT-IOF-PROP-DEMO-OPPORTUNITY-3SWR-v2";
const upstream = [
  `server/data/scopeversions/${scopeId}.json`,
  "server/data/certified-iof-packages/CERT-IOF-DRAFT-IOF-PROP-DEMO-OPPORTUNITY-3SWR-v2.json",
  "server/data/service-orders/SO-PROP-DEMO-OPPORTUNITY-3SWR-v2-R001.json",
];
const hash = (body) => createHash("sha256").update(body).digest("hex");
const sourceBefore = Object.fromEntries(await Promise.all(upstream.map(async (file) => [file, hash(await readFile(file))])));

async function json(path, init = {}) {
  const response = await fetch(`${base}${path}`, init);
  const text = await response.text();
  let body = {}; try { body = text ? JSON.parse(text) : {}; } catch { body = { text }; }
  return { status: response.status, headers: response.headers, body };
}
const login = await json("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "kyle", password: testPassword }) });
assert.equal(login.status, 200);
const headers = { Authorization: `Bearer ${login.body.token}`, "Content-Type": "application/json" };
const path = `/api/marketplace/fulfillment/${encodeURIComponent(scopeId)}`;

const boot = await json(`${path}/bootstrap`, { method: "POST", headers });
assert.equal(boot.status, 201, JSON.stringify(boot.body));
const initial = boot.body;
assert.equal(initial.demand.scopeVersionId, scopeId);
assert.equal(initial.demand.certifiedIofPackageId, "CERT-IOF-DRAFT-IOF-PROP-DEMO-OPPORTUNITY-3SWR-v2");
assert.equal(initial.demand.serviceOrderId, "SO-PROP-DEMO-OPPORTUNITY-3SWR-v2-R001");
assert.equal(initial.demand.route.geometryHash, "rg-0d302bb0");
assert.equal(initial.sharedOpportunityMapProjection.coordinates.length, 340);
assert.equal(initial.demand.stationSummary.count, 7957);
assert.equal(initial.demand.objectCount, 433);
assert.equal(initial.packages.length, 2);
assert.ok(initial.latestResponses.some((r) => r.responseType === "CAPACITY_OFFER"));
assert.ok(initial.latestResponses.some((r) => r.responseType === "PARTIAL_SCOPE"));
assert.ok(initial.latestResponses.some((r) => r.responseType === "MATERIAL_OFFER"));
const alternate = initial.responses.find((r) => r.vendorResponseId === "VR-3SWR-SUPPLIER-ALT-V1");
assert.equal(alternate.materialResponses[0].alternateMaterial.reviewState, "PENDING_ENGINEERING_REVIEW");
assert.equal(initial.coverage.material.find((m) => m.demandLineId === "MAT-CONDUIT").offered, initial.demand.materialLines.find((m) => m.demandLineId === "MAT-CONDUIT").quantity, "Unaccepted alternate was counted as fulfillment.");
const aVersions = initial.responses.filter((r) => r.responseSeriesId === "VR-3SWR-VENDOR-A").sort((a,b) => a.vendorResponseVersion-b.vendorResponseVersion);
assert.deepEqual(aVersions.map((r) => r.vendorResponseVersion), [1,2]);
assert.equal(aVersions[0].capacityCommitments[0].productionRate, 2200);
assert.equal(aVersions[1].capacityCommitments[0].productionRate, 2400);
assert.notEqual(aVersions[0].contentHash, aVersions[1].contentHash);

assert.ok(initial.latestResponses.some((r) => r.responseType === "FULL_SCOPE"));
assert.ok(initial.latestResponses.some((r) => r.responseType === "NO_BID"));

const stationIds = initial.demand.stationReferences;
const response = (id) => initial.responses.find((r) => r.vendorResponseId === id);
async function allocate(body) { return json(`${path}/allocations`, { method: "POST", headers, body: JSON.stringify(body) }); }
function constructionAllocation(series, r, first, last) {
  return { allocationSeriesId: series, vendorId: r.vendorId, vendorResponseId: r.vendorResponseId, vendorResponseVersion: r.vendorResponseVersion, marketplacePackageId: r.marketplacePackageId, stationRanges: [{ startStationId: stationIds[first], endStationId: stationIds[last] }], segmentIds: [], objectIds: [], quantityAllocations: [], materialAllocations: [], capacityAllocations: r.capacityCommitments.map((c) => ({ commitmentId: c.commitmentId, resourceCount: c.equipmentCount || c.crewCount })), plannedStart: "2026-09-15", requiredComplete: "2026-11-30", allocatedValue: r.pricingLines.reduce((sum, line) => sum + line.extendedAmount, 0), decisionNotes: "CIP-052 human allocation acceptance." };
}
let current = (await json(path, { headers })).body;
if (!current.allocations.some((a) => a.allocationSeriesId === "ALLOC-3SWR-A")) assert.equal((await allocate(constructionAllocation("ALLOC-3SWR-A", response("VR-3SWR-VENDOR-A-V2"), 0, 25))).status, 201);
if (!current.allocations.some((a) => a.allocationSeriesId === "ALLOC-3SWR-B")) assert.equal((await allocate(constructionAllocation("ALLOC-3SWR-B", response("VR-3SWR-VENDOR-B-V1"), 26, 50))).status, 201);
const supplierA = response("VR-3SWR-SUPPLIER-A-V1"), supplierB = response("VR-3SWR-SUPPLIER-B-V1");
function materialAllocation(series, r) { const m = r.materialResponses[0]; return { allocationSeriesId: series, vendorId: r.vendorId, vendorResponseId: r.vendorResponseId, vendorResponseVersion: r.vendorResponseVersion, marketplacePackageId: r.marketplacePackageId, stationRanges: [], segmentIds: [], objectIds: [], quantityAllocations: [], capacityAllocations: [], materialAllocations: [{ materialResponseId: m.materialResponseId, demandLineId: m.demandLineId, quantity: m.offeredQuantity, unit: m.unit }], plannedStart: "2026-09-01", requiredComplete: "2026-10-15", allocatedValue: m.extendedPrice, decisionNotes: "CIP-052 material allocation acceptance." }; }
current = (await json(path, { headers })).body;
if (!current.allocations.some((a) => a.allocationSeriesId === "ALLOC-3SWR-MAT-A")) assert.equal((await allocate(materialAllocation("ALLOC-3SWR-MAT-A", supplierA))).status, 201);
if (!current.allocations.some((a) => a.allocationSeriesId === "ALLOC-3SWR-MAT-B")) assert.equal((await allocate(materialAllocation("ALLOC-3SWR-MAT-B", supplierB))).status, 201);

const overlap = await allocate(constructionAllocation("ALLOC-OVERLAP", response("VR-3SWR-VENDOR-C-V1"), 24, 30));
assert.equal(overlap.status, 409, JSON.stringify(overlap.body));
assert.match(overlap.body.error, /overlapping station/i);
const overMaterial = await allocate({ ...materialAllocation("ALLOC-OVER-MAT", supplierA), stationRanges: [], materialAllocations: [{ ...materialAllocation("x", supplierA).materialAllocations[0], quantity: supplierA.materialResponses[0].offeredQuantity + 1 }] });
assert.equal(overMaterial.status, 409);
const fakeStation = await allocate({ ...constructionAllocation("ALLOC-FAKE", response("VR-3SWR-VENDOR-C-V1"), 60, 70), stationRanges: [{ startStationId: "VENDOR-DRAWN-STATION", endStationId: stationIds[70] }] });
assert.equal(fakeStation.status, 409);

current = (await json(path, { headers })).body;
let aSeries = current.allocations.filter((a) => a.allocationSeriesId === "ALLOC-3SWR-A").sort((a,b) => b.allocationRevision-a.allocationRevision);
if (aSeries.length === 1) {
  const revisionInput = constructionAllocation("ALLOC-3SWR-A", response("VR-3SWR-VENDOR-A-V2"), 0, 25);
  const revised = await allocate({ ...revisionInput, supersedesAllocationId: aSeries[0].allocationId, decisionNotes: "Revised human allocation preserving R1." });
  assert.equal(revised.status, 201); assert.equal(revised.body.allocationRevision, 2); assert.equal(revised.body.parentAllocationId, aSeries[0].allocationId);
}
current = (await json(path, { headers })).body;
assert.equal(current.allocations.filter((a) => a.allocationSeriesId === "ALLOC-3SWR-A").length, 2);
const aAllocation = current.allocations.find((a) => a.allocationSeriesId === "ALLOC-3SWR-A" && a.allocationRevision === 1);
let award = current.awards.find((a) => a.allocationId === aAllocation.allocationId);
if (!award) {
  const awarded = await json(`${path}/awards`, { method: "POST", headers, body: JSON.stringify({ awardId: "AWARD-3SWR-A", allocationId: aAllocation.allocationId, awardedAmount: aAllocation.allocatedValue }) });
  assert.equal(awarded.status, 201); award = awarded.body;
}
assert.equal(award.vendorResponseId, "VR-3SWR-VENDOR-A-V2");
assert.equal(award.vendorResponseVersion, 2);
assert.equal(award.createsControlWork, false);
assert.equal(award.createsFieldWork, false);
const bAllocation = current.allocations.find((a) => a.allocationSeriesId === "ALLOC-3SWR-B");
let bAward = current.awards.find((a) => a.allocationId === bAllocation.allocationId);
if (!bAward) { const awarded = await json(`${path}/awards`, { method: "POST", headers, body: JSON.stringify({ awardId: "AWARD-3SWR-B", allocationId: bAllocation.allocationId, awardedAmount: bAllocation.allocatedValue }) }); assert.equal(awarded.status, 201); bAward = awarded.body; }
assert.equal(bAward.vendorResponseId, "VR-3SWR-VENDOR-B-V1"); assert.ok(bAward.vendorResponseContentHash); assert.ok(bAward.allocationContentHash); assert.ok(bAward.acceptedCapacityCommitmentIds.length > 0);
const duplicateAward = await json(`${path}/awards`, { method: "POST", headers, body: JSON.stringify({ awardId: "AWARD-3SWR-B", allocationId: bAllocation.allocationId, awardedAmount: bAllocation.allocatedValue }) });
assert.equal(duplicateAward.status, 409);

const pdf = await fetch(`${base}${path}/packages/MP-3SWR-CONSTRUCTION/pdf`, { headers });
const pdfBytes = Buffer.from(await pdf.arrayBuffer());
assert.equal(pdf.status, 200); assert.equal(pdfBytes.subarray(0,4).toString(), "%PDF"); assert.match(pdf.headers.get("content-disposition"), /attachment/);
const kmz = await fetch(`${base}${path}/packages/MP-3SWR-CONSTRUCTION/kmz`, { headers });
const kmzBytes = Buffer.from(await kmz.arrayBuffer()); const zip = await JSZip.loadAsync(kmzBytes); const kml = await zip.file("doc.kml").async("string");
assert.equal(kmz.status, 200); assert.equal((kml.match(/,-?\d+(?:\.\d+)?,0/g) ?? []).length, 340); assert.match(kml, /rg-0d302bb0/);

const unauthorized = await json(path); assert.equal(unauthorized.status, 401);
const sourceAfter = Object.fromEntries(await Promise.all(upstream.map(async (file) => [file, hash(await readFile(file))])));
assert.deepEqual(sourceAfter, sourceBefore);
current = (await json(path, { headers })).body;
const conduitCoverage = current.coverage.material.find((m) => m.demandLineId === "MAT-CONDUIT");
assert.equal(conduitCoverage.remaining, 0);
assert.equal(conduitCoverage.allocatedCoveragePercent, 100);
assert.ok(current.observations.some((o) => o.observationType === "PRICING"));
assert.ok(current.observations.some((o) => o.observationType === "CAPACITY"));
assert.ok(current.observations.some((o) => o.observationType === "MATERIAL"));

const browser = { available: false };
try {
  const pages = await (await fetch("http://127.0.0.1:9222/json/list")).json();
  const page = pages.find((item) => item.type === "page" && item.url === "http://127.0.0.1:5173/");
  if (page) {
    const downloadDirectory = pathModule.resolve("artifacts/cip052-browser-downloads"); fs.mkdirSync(downloadDirectory, { recursive: true });
    const socket = new WebSocket(page.webSocketDebuggerUrl); let commandId = 0; const pending = new Map(); const exceptions = []; const consoleErrors = [];
    socket.onmessage = (event) => { const message = JSON.parse(event.data); if (message.id && pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); } else if (message.method === "Runtime.exceptionThrown") exceptions.push(message.params); else if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") consoleErrors.push(message.params); };
    await new Promise((resolve) => socket.onopen = resolve);
    const send = (method, params = {}) => new Promise((resolve) => { const id = ++commandId; pending.set(id, resolve); socket.send(JSON.stringify({ id, method, params })); });
    const evaluate = async (expression) => (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    await Promise.all([send("Runtime.enable"), send("Page.enable")]); await send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: downloadDirectory, eventsEnabled: true }); await send("Page.reload", { ignoreCache: true }); await wait(1800);
    await evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Marketplace');b?.click();return Boolean(b)})()`);
    let body = ""; for (let attempt = 0; attempt < 150 && !body.includes("Delivery Readiness\nHDD"); attempt += 1) { await wait(200); body = await evaluate("document.body.innerText"); }
    let buttons = await evaluate(`[...document.querySelectorAll('button')].map(x=>x.textContent.trim())`);
    await evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Vendor View');b?.click();return Boolean(b)})()`); await wait(500);
    const vendorPortalVisible = await evaluate(`document.body.innerText.toLowerCase().includes('bounded vendor portal')`);
    const vendorResponseTypes = await evaluate(`[...document.querySelectorAll('select')].flatMap(x=>[...x.options].map(o=>o.textContent.trim())).filter(x=>['Full Scope','Partial Scope','Capacity Offer','Material Offer','No Bid'].includes(x))`);
    buttons = await evaluate(`[...document.querySelectorAll('button')].map(x=>x.textContent.trim())`);
    for (const label of ["Download Bid Package PDF", "Download Bid Package KMZ"]) { await evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()===${JSON.stringify(label)});b?.click();return Boolean(b)})()`); await wait(800); }
    for (let attempt = 0; attempt < 30 && fs.readdirSync(downloadDirectory).filter((file) => !file.endsWith(".crdownload")).length < 2; attempt += 1) await wait(200);
    const savedFiles = fs.readdirSync(downloadDirectory).filter((file) => !file.endsWith(".crdownload"));
    Object.assign(browser, { available: true, authorizedScopeVisible: body.includes(scopeId), readinessVisible: body.includes("Delivery Readiness"), gapVisible: body.includes("GAP"), vendorPortalVisible, vendorResponseTypes, buttons: buttons.filter((label) => /Download Bid Package|Allocate|Award|Vendor View|Submit Immutable/.test(label)), savedFiles, runtimeExceptions: exceptions.length, consoleErrors: consoleErrors.length });
    socket.close();
    if (!browser.authorizedScopeVisible || !browser.readinessVisible || !browser.gapVisible) console.error("CIP052_BROWSER_STATE", JSON.stringify({ body: body.slice(0, 4000), buttons, exceptions, consoleErrors }, null, 2));
    if (!vendorPortalVisible || vendorResponseTypes.length !== 5 || !buttons.includes("Submit Immutable Vendor Response")) console.error("CIP052_VENDOR_PORTAL", JSON.stringify({ vendorPortalVisible, vendorResponseTypes, buttons }, null, 2));
    if (exceptions.length || consoleErrors.length) console.error("CIP052_BROWSER_ERRORS", JSON.stringify({ exceptions, consoleErrors }, null, 2));
    assert(browser.authorizedScopeVisible && browser.readinessVisible && browser.gapVisible, "Marketplace fulfillment workflow is not visible in browser.");
    assert(buttons.includes("Download Bid Package PDF") && buttons.includes("Download Bid Package KMZ") && buttons.includes("Allocate Selected Response") && buttons.includes("Award First Approved Allocation"), "Marketplace actions are missing.");
    assert(vendorPortalVisible && vendorResponseTypes.length === 5 && buttons.includes("Submit Immutable Vendor Response"), "Bounded Vendor Portal response workflow is missing.");
    assert(savedFiles.some((file) => file.endsWith(".pdf")) && savedFiles.some((file) => file.endsWith(".kmz")), "Bid Package browser downloads were not saved locally.");
    assert(exceptions.length === 0 && consoleErrors.length === 0, "Marketplace browser emitted runtime errors.");
  }
} catch (error) { browser.error = error.message; throw error; }

console.log(JSON.stringify({ result: "PASS", scopeVersionId: scopeId, sourceAuthorityUnchanged: true, demand: { routeMiles: current.demand.route.routeMiles, stations: current.demand.stationSummary.count, objects: current.demand.objectCount, materialLines: current.demand.materialLines.length }, responses: { totalVersions: current.responses.length, latest: current.latestResponses.length, vendorAVersions: aVersions.map((r) => ({ id: r.vendorResponseId, rate: r.capacityCommitments[0].productionRate, hash: r.contentHash })) }, coverage: current.coverage, allocations: current.allocations.map((a) => ({ id: a.allocationId, vendor: a.vendorId, response: `${a.vendorResponseId}:V${a.vendorResponseVersion}`, value: a.allocatedValue })), awards: current.awards, observations: { total: current.observations.length, pricing: current.observations.filter((o) => o.observationType === "PRICING").length, capacity: current.observations.filter((o) => o.observationType === "CAPACITY").length, material: current.observations.filter((o) => o.observationType === "MATERIAL").length }, exports: { pdfBytes: pdfBytes.length, pdfHash: hash(pdfBytes), kmzBytes: kmzBytes.length, kmzHash: hash(kmzBytes), routePoints: 340 }, security: { unauthenticated: unauthorized.status }, browser, noAutomaticControlOrField: true }, null, 2));
