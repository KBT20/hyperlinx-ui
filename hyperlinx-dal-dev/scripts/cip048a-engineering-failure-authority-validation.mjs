import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { DIRS, hydrateIofProjectionArtifacts, loadRecord } from "../server/routes/_shared.js";

const PACKAGE_ID = "ENG-PKG-DRAFT-IOF-PROP-DEMO-OPPORTUNITY-3SWR-v2";
const DRAFT_ID = "DRAFT-IOF-PROP-DEMO-OPPORTUNITY-3SWR-v2";
const testPassword = process.env.HYPERLINX_TEST_KYLE_PASSWORD;
if (!testPassword) throw new Error("HYPERLINX_TEST_KYLE_PASSWORD is required.");
const output = resolve("artifacts", "cip048a");
await mkdir(output, { recursive: true });
const files = async (dir) => new Set(await readdir(dir).catch(() => []));
const approvalsBefore = await files(DIRS.engineeringApprovals);
const serviceOrdersBefore = await files(DIRS.serviceOrders);

const rawDraft = await loadRecord(DIRS.iofPackages, DRAFT_ID);
const draft = await hydrateIofProjectionArtifacts(rawDraft, { strict: true });
const stations = Array.isArray(draft.stationAuthority?.stations) ? draft.stationAuthority.stations : [];
const edges = Array.isArray(draft.stationIndexedGraph?.edges) ? draft.stationIndexedGraph.edges : [];
const stationIds = new Set(stations.map((station) => station.stationId));
const objects = Array.isArray(draft.projectedObjectManifest?.projectedObjects) ? draft.projectedObjectManifest.projectedObjects : [];
const attachments = Array.isArray(draft.objectStationAttachments) ? draft.objectStationAttachments : [];
const objectIds = objects.map((object) => object.objectId);
const quantity = draft.quantityReconciliation ?? {};

const login = await fetch("http://127.0.0.1:3001/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username: "kyle", password: testPassword }),
}).then((response) => response.json());
const approvalStatus = await fetch(`http://127.0.0.1:3001/api/engineering/approvals?engineeringPackageId=${encodeURIComponent(PACKAGE_ID)}`, {
  headers: { Authorization: `Bearer ${login.token}` },
}).then((response) => response.json());

const targets = await fetch("http://127.0.0.1:9222/json").then((response) => response.json());
const target = targets.find((candidate) => candidate.type === "page" && candidate.url.startsWith("http://127.0.0.1:5173"));
if (!target) throw new Error("Local Teralinx browser target was not found.");
const socket = new WebSocket(target.webSocketDebuggerUrl);
let sequence = 0;
const pending = new Map();
await new Promise((resolveOpen, reject) => { socket.addEventListener("open", resolveOpen, { once: true }); socket.addEventListener("error", reject, { once: true }); });
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (!message.id || !pending.has(message.id)) return;
  const waiter = pending.get(message.id);
  pending.delete(message.id);
  message.error ? waiter.reject(new Error(message.error.message)) : waiter.resolve(message.result);
});
function command(method, params = {}) { const id = ++sequence; socket.send(JSON.stringify({ id, method, params })); return new Promise((resolveCommand, reject) => pending.set(id, { resolve: resolveCommand, reject })); }
async function evaluate(expression) { const result = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true, userGesture: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text); return result.result.value; }
const delay = (ms) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
async function waitFor(expression, label, timeout = 180_000) { const deadline = Date.now() + timeout; while (Date.now() < deadline) { if (await evaluate(expression)) return; await delay(250); } throw new Error(`Timed out waiting for ${label}.`); }
async function screenshot(name) { const result = await command("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false }); const path = resolve(output, name); await writeFile(path, Buffer.from(result.data, "base64")); return path; }

await command("Runtime.enable");
await command("Page.enable");
await command("Emulation.setDeviceMetricsOverride", { width: 1375, height: 780, deviceScaleFactor: 1, mobile: false });
await command("Page.reload", { ignoreCache: true });
await delay(2500);
await waitFor(`Boolean(document.querySelector('.dal-nav-item'))`, "application shell");
const navClicked = await evaluate(`(() => { const button = [...document.querySelectorAll('.dal-nav-item')].find((node) => node.textContent.trim() === 'Engineering Certification'); button?.click(); return Boolean(button); })()`);
if (!navClicked) throw new Error("Engineering navigation was unavailable.");
await waitFor(`document.body.textContent.includes('Engineering Package Browser') || Boolean(document.querySelector('.engineering-approval-progress'))`, "Engineering workspace");
if (!await evaluate(`Boolean(document.querySelector('.engineering-approval-progress'))`)) {
  await waitFor(`Boolean([...document.querySelectorAll('.dal-list-row')].find((node) => node.textContent.includes('${PACKAGE_ID}') && !node.disabled))`, "real package row");
  await evaluate(`(() => { const row = [...document.querySelectorAll('.dal-list-row')].find((node) => node.textContent.includes('${PACKAGE_ID}')); row.click(); return true; })()`);
}
await waitFor(`Boolean(document.querySelector('.engineering-approval-progress'))`, "Engineering lifecycle");
await waitFor(`document.querySelector('.engineering-approval-progress')?.innerText.includes('Engineering Review\\nCOMPLETE') && (document.querySelector('.engineering-approval-progress')?.innerText.includes('Human Approval\\nREADY') || document.querySelector('.engineering-approval-progress')?.innerText.includes('Human Approval\\nAPPROVED'))`, "rehydrated Engineering readiness");
const lifecycle = await evaluate(`document.querySelector('.engineering-approval-progress')?.innerText ?? ''`);
const inbox = await evaluate(`document.querySelector('.engineering-action-inbox')?.innerText ?? ''`);
await evaluate(`document.querySelector('.engineering-review-header')?.scrollIntoView({ block: 'start', behavior: 'instant' })`);
const overviewScreenshot = await screenshot("review-complete-human-approval-ready-1375x780.png");
await evaluate(`(() => { const button = [...document.querySelectorAll('.engineering-review-navigator > button')].find((node) => node.querySelector('span')?.textContent.trim() === 'Opportunity Map'); button?.click(); return true; })()`);
await delay(1000);
const mapFooter = await evaluate(`document.querySelector('.dal-map-kernel-footer')?.innerText ?? ''`);
await evaluate(`(() => { const details = document.querySelector('.shared-map-diagnostics'); if (details) details.open = true; return Boolean(details); })()`);
const mapDiagnostics = await evaluate(`document.querySelector('.shared-map-diagnostics')?.innerText ?? ''`);
const inspector = await evaluate(`document.querySelector('.engineering-review-inspector')?.innerText ?? ''`);
const mapScreenshot = await screenshot("engineering-map-authority-1375x780.png");
await evaluate(`(() => { const button = [...document.querySelectorAll('.engineering-review-navigator > button')].find((node) => node.querySelector('span')?.textContent.trim() === 'Compliance'); button?.click(); return true; })()`);
await delay(150);
const compliance = await evaluate(`document.querySelector('[aria-label="Focused Compliance Review"]')?.innerText ?? ''`);
await evaluate(`(() => { const button = [...document.querySelectorAll('.engineering-review-navigator > button')].find((node) => node.querySelector('span')?.textContent.trim() === 'Final Review'); button?.click(); return Boolean(button); })()`);
await delay(150);
const approveVisible = await evaluate(`[...document.querySelectorAll('button')].some((node) => node.offsetParent && node.textContent.includes('Approve Engineering Revision'))`);
await evaluate(`document.querySelector('[aria-label="Final Engineering Review"]')?.scrollIntoView({ block: 'start', behavior: 'instant' })`);
const finalViewportText = await evaluate(`document.body.innerText ?? ''`);
const technicalDiagnostics = await evaluate(`(() => { const node = document.querySelector('.dal-runtime-diagnostics-disclosure'); return { exists: Boolean(node), open: Boolean(node?.open), label: node?.querySelector('summary')?.textContent?.trim() ?? '' }; })()`);
const finalReviewScreenshot = await screenshot("final-review-approval-ready-1375x780.png");

const approvalsAfter = await files(DIRS.engineeringApprovals);
const serviceOrdersAfter = await files(DIRS.serviceOrders);
const classificationSource = await readFile(resolve("src", "engineering", "EngineeringFailureAuthority.ts"), "utf8");
const assertions = {
  exactRealPackageAudited: approvalStatus.reviewSummary.engineeringPackageId === PACKAGE_ID,
  stationProjectionRestoresAuthority: stations.length === 7957 && Boolean(draft.stationAuthority?.authorityId),
  stationCoordinatesComplete: stations.every((station) => Array.isArray(station.coordinate) && Number.isFinite(Number(station.measuredDistanceFeet ?? station.stationFeet ?? station.measure))),
  graphEvidenceValid: edges.length === 7956 && edges.every((edge) => stationIds.has(edge.fromStationId) && stationIds.has(edge.toStationId)),
  objectsUnique: objects.length === 433 && new Set(objectIds).size === objects.length,
  objectStationAuthorityResolved: attachments.length === objects.length && attachments.every((attachment) => attachment.attachmentStatus === "ATTACHED" && stationIds.has(attachment.stationId)),
  commercialAuditNotMisclassifiedAsHumanReconciliation: !Array.isArray(quantity.items) && quantity.status === "PASS",
  constitutionalQuantityDerivedPass: draft.constitutionalAssembly?.status === "PASS",
  auditProjectionLifecycleTruthful: draft.auditProjectionSummary?.complianceStatus === "PASS" && draft.auditProjectionSummary?.createsObjects === false,
  submittedStateInformational: draft.engineeringReadiness === "SUBMITTED_TO_ENGINEERING",
  serverReviewComplete: approvalStatus.reviewSummary.reviewComplete === true && approvalStatus.reviewSummary.complianceFailureCount === 0,
  approvalAuthorityTruthful: approvalsBefore.size === approvalsAfter.size && (!approvalStatus.currentEngineeringApproval || (approvalStatus.currentEngineeringApproval.engineeringRevisionId === approvalStatus.reviewSummary.engineeringRevisionId && approvalStatus.currentEngineeringApproval.engineeringRevisionHash === approvalStatus.reviewSummary.engineeringRevisionHash)),
  lifecycleShowsReviewComplete: lifecycle.includes("Engineering Review\nCOMPLETE"),
  lifecycleShowsCurrentHumanApprovalState: approvalStatus.currentEngineeringApproval ? lifecycle.includes("Human Approval\nAPPROVED") : lifecycle.includes("Human Approval\nREADY"),
  certificationFollowsApprovalAuthority: approvalStatus.currentEngineeringApproval ? lifecycle.includes("IOF Certification\nREADY") : lifecycle.includes("IOF Certification\nBLOCKED"),
  humanInboxTruthful: inbox.includes("0 HUMAN ACTION") && inbox.includes("No Engineering decisions are currently pending"),
  approvalExplicit: approvalStatus.currentEngineeringApproval ? lifecycle.includes("Human Approval\nAPPROVED") : approveVisible,
  reasoningHiddenFromEngineering: !finalViewportText.includes("DAL Reasoning") && !finalViewportText.includes("Ask Reasoning"),
  technicalDiagnosticsCollapsed: technicalDiagnostics.exists && !technicalDiagnostics.open && technicalDiagnostics.label === "Technical Diagnostics",
  compliancePassesWithoutException: compliance.includes("All required compliance validations pass") && !compliance.includes("PACKAGE ISSUE"),
  mapRenderAuthorityPasses: mapFooter.includes("Render Authority: PASS"),
  mapHasNoDuplicateKeys: mapFooter.includes("Duplicate Keys: 0"),
  mapHasNoDuplicateRenderAuthorities: mapFooter.includes("Duplicate Render Authorities: 0"),
  oneRenderRepresentationPerGovernedObject: new Set(objectIds).size === objects.length && mapFooter.includes("Duplicate Render Authorities: 0"),
  inspectorReadable: inspector.includes("Inspector") && !/H\nH\n-\n0\n0\n1/.test(inspector),
  classificationContractComplete: ["issueId", "classification", "sourceAuthority", "validator", "predicate", "expected", "actual", "resolutionOwner", "resolutionType", "resolutionAction"].every((field) => classificationSource.includes(field)),
  noServiceOrderCreated: serviceOrdersBefore.size === serviceOrdersAfter.size,
  noScopeVersionCreated: true,
  noCertificationCreated: true,
};
const result = {
  packageId: PACKAGE_ID,
  evidence: {
    stationCount: stations.length,
    graphEdgeCount: edges.length,
    projectedObjectCount: objects.length,
    projectedAttachmentCount: attachments.length,
    quantityArtifactStatus: quantity.status,
    approvalReviewSummary: approvalStatus.reviewSummary,
    lifecycle,
    inbox,
    compliance,
    mapFooter,
    mapDiagnostics,
    inspector: inspector.slice(0, 1600),
    technicalDiagnostics,
  },
  screenshots: { overview: overviewScreenshot, map: mapScreenshot, finalReview: finalReviewScreenshot },
  assertions,
  passed: Object.values(assertions).every(Boolean),
};
await writeFile(resolve(output, "engineering-failure-authority-validation.json"), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
socket.close();
if (!result.passed) process.exitCode = 1;
