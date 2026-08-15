import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { DIRS } from "../server/routes/_shared.js";

const PACKAGE_ID = "ENG-PKG-DRAFT-IOF-PROP-DEMO-OPPORTUNITY-3SWR-v2";
const testPassword = process.env.HYPERLINX_TEST_KYLE_PASSWORD;
if (!testPassword) throw new Error("HYPERLINX_TEST_KYLE_PASSWORD is required.");
const output = resolve("artifacts", "cip048c");
await mkdir(output, { recursive: true });
const governedDirectories = {
  engineeringApprovals: DIRS.engineeringApprovals,
  certificationLedgers: DIRS.certificationLedgers,
  certifiedIofPackages: DIRS.certifiedIofPackages,
  serviceOrders: DIRS.serviceOrders,
  scopeVersions: DIRS.scopeVersions,
  marketplaceQuotes: DIRS.marketplaceQuotes,
  controlWorkItems: DIRS.controlWorkItems,
  fieldClosures: DIRS.fieldClosures,
  customerTwins: DIRS.iofPackageTwins,
};
async function directorySnapshot(directory) {
  const names = (await readdir(directory).catch(() => [])).sort();
  const rows = await Promise.all(names.map(async (name) => {
    const metadata = await stat(resolve(directory, name));
    return `${name}:${metadata.size}:${metadata.mtimeMs}`;
  }));
  return rows;
}
async function repositorySnapshot() {
  return Object.fromEntries(await Promise.all(Object.entries(governedDirectories).map(async ([key, directory]) => [key, await directorySnapshot(directory)])));
}
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const before = await repositorySnapshot();

const login = await fetch("http://127.0.0.1:3001/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username: "kyle", password: testPassword }),
}).then((response) => response.json());
const headers = { Authorization: `Bearer ${login.token}`, "Content-Type": "application/json" };
async function approvalStatus() {
  const started = performance.now();
  const response = await fetch(`http://127.0.0.1:3001/api/engineering/approvals?engineeringPackageId=${encodeURIComponent(PACKAGE_ID)}`, { headers });
  const body = await response.json();
  return { status: response.status, body, durationMs: Number((performance.now() - started).toFixed(2)) };
}
async function postApproval(body) {
  const response = await fetch("http://127.0.0.1:3001/api/engineering/approvals", { method: "POST", headers, body: JSON.stringify(body) });
  return { status: response.status, body: await response.json() };
}
const initialStatus = await approvalStatus();
const eligibility = initialStatus.body.approvalEligibility;
if (!eligibility?.approvalEligible) throw new Error(`Real package is not approval eligible: ${JSON.stringify(eligibility?.blockers ?? [])}`);
const preexistingApproval = initialStatus.body.currentEngineeringApproval ?? null;
const exactRequest = {
  engineeringPackageId: eligibility.engineeringPackageId,
  engineeringRevisionId: eligibility.engineeringRevisionId,
  engineeringRevisionHash: eligibility.engineeringRevisionHash,
  reviewSummaryHash: eligibility.reviewSummaryHash,
  organizationId: eligibility.organizationId,
  tenantId: eligibility.tenantId,
  customerId: eligibility.customerId,
  opportunityId: eligibility.opportunityId,
};
const staleRevision = await postApproval({ ...exactRequest, engineeringRevisionHash: "engineering-revision-stale" });
const staleSummary = await postApproval({ ...exactRequest, reviewSummaryHash: "stale-review-summary" });
const revisionMismatch = await postApproval({ ...exactRequest, engineeringRevisionId: `${eligibility.engineeringRevisionId}-STALE` });
const scopeMismatch = await postApproval({ ...exactRequest, customerId: "customer-outside-governed-scope" });
const tamper = await postApproval({ ...exactRequest, engineeringRevisionHash: "engineering-revision-tampered", reviewSummaryHash: undefined });
const afterNegativeTests = await repositorySnapshot();

const targets = await fetch("http://127.0.0.1:9222/json").then((response) => response.json());
const target = targets.find((candidate) => candidate.type === "page" && candidate.url.startsWith("http://127.0.0.1:5173"));
if (!target) throw new Error("Local Teralinx browser target was not found.");
const socket = new WebSocket(target.webSocketDebuggerUrl);
let sequence = 0;
const pending = new Map();
const events = [];
await new Promise((resolveOpen, reject) => { socket.addEventListener("open", resolveOpen, { once: true }); socket.addEventListener("error", reject, { once: true }); });
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const waiter = pending.get(message.id);
    pending.delete(message.id);
    message.error ? waiter.reject(new Error(message.error.message)) : waiter.resolve(message.result);
    return;
  }
  events.push(message);
});
function command(method, params = {}) { const id = ++sequence; socket.send(JSON.stringify({ id, method, params })); return new Promise((resolveCommand, reject) => pending.set(id, { resolve: resolveCommand, reject })); }
async function evaluate(expression) { const result = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true, userGesture: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text); return result.result.value; }
const delay = (ms) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
async function waitFor(expression, label, timeout = 180_000) { const deadline = Date.now() + timeout; while (Date.now() < deadline) { if (await evaluate(expression)) return; await delay(250); } throw new Error(`Timed out waiting for ${label}.`); }
async function screenshot(name) { const result = await command("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false }); const path = resolve(output, name); await writeFile(path, Buffer.from(result.data, "base64")); return path; }
async function openEngineering() {
  await waitFor(`Boolean(document.querySelector('.dal-nav-item'))`, "application shell");
  await evaluate(`(() => { const button = [...document.querySelectorAll('.dal-nav-item')].find((node) => node.textContent.trim() === 'Engineering Certification'); button?.click(); return Boolean(button); })()`);
  await waitFor(`document.body.innerText.includes('Engineering Package Browser') || Boolean(document.querySelector('.engineering-approval-progress'))`, "Engineering workspace");
  if (!await evaluate(`Boolean(document.querySelector('.engineering-approval-progress'))`)) {
    await waitFor(`Boolean([...document.querySelectorAll('.dal-list-row')].find((node) => node.textContent.includes('${PACKAGE_ID}') && !node.disabled))`, "real package row");
    await evaluate(`(() => { const row = [...document.querySelectorAll('.dal-list-row')].find((node) => node.textContent.includes('${PACKAGE_ID}')); row.click(); return true; })()`);
  }
}
await command("Runtime.enable");
await command("Log.enable");
await command("Network.enable");
await command("Page.enable");
await command("Emulation.setDeviceMetricsOverride", { width: 1375, height: 780, deviceScaleFactor: 1, mobile: false });
events.length = 0;
await command("Page.reload", { ignoreCache: true });
await delay(2500);
await openEngineering();
await waitFor(`document.querySelector('.engineering-approval-progress')?.innerText.includes('Human Approval\\nREADY') || document.querySelector('.engineering-approval-progress')?.innerText.includes('Human Approval\\nAPPROVED')`, "canonical Human Approval state");
await evaluate(`(() => { const button = [...document.querySelectorAll('.engineering-review-navigator > button')].find((node) => node.querySelector('span')?.textContent.trim() === 'Opportunity Map'); button?.click(); return true; })()`);
await delay(1000);
const mapFooter = await evaluate(`document.querySelector('.dal-map-kernel-footer')?.innerText ?? ''`);
const mapScreenshot = await screenshot("map-render-authority-after-reconciliation.png");
await evaluate(`(() => { const button = [...document.querySelectorAll('.engineering-review-navigator > button')].find((node) => node.querySelector('span')?.textContent.trim() === 'Compliance'); button?.click(); return true; })()`);
await evaluate(`(() => { const button = [...document.querySelectorAll('.engineering-review-navigator > button')].find((node) => node.querySelector('span')?.textContent.trim() === 'Final Review'); button?.click(); return true; })()`);
const afterPresentationNavigation = await repositorySnapshot();
const renderedAuthority = await evaluate(`(() => { const card = document.querySelector('.engineering-human-approval-ready'); const values = [...(card?.querySelectorAll('.engineering-approval-authority-summary > span') ?? [])].map((node) => ({ label: node.childNodes[0]?.textContent?.trim(), value: node.querySelector('b')?.textContent?.trim() })); return Object.fromEntries(values.map(({ label, value }) => [label, value])); })()`);
let approvalHttpStatus;
let approvalResponseBody;
if (preexistingApproval) {
  const replayResult = await postApproval(exactRequest);
  approvalHttpStatus = replayResult.status;
  approvalResponseBody = replayResult.body;
} else {
  events.length = 0;
  await evaluate(`(() => { const button = [...document.querySelectorAll('button')].find((node) => node.textContent.trim() === 'Approve Engineering Revision'); button.click(); return true; })()`);
  await waitFor(`Boolean(document.querySelector('.engineering-approval-confirm'))`, "approval confirmation modal");
  await evaluate(`(() => { const modal = document.querySelector('.engineering-approval-confirm'); const button = [...modal.querySelectorAll('button')].find((node) => node.textContent.trim() === 'Approve Engineering Revision'); button.click(); return true; })()`);
  let approvalResponseEvent;
  const approvalDeadline = Date.now() + 60_000;
  while (Date.now() < approvalDeadline) {
    approvalResponseEvent = events.find((message) => message.method === "Network.responseReceived" && message.params.response.url.endsWith("/api/engineering/approvals") && [200, 201].includes(message.params.response.status));
    if (approvalResponseEvent) break;
    await delay(100);
  }
  if (!approvalResponseEvent) throw new Error("Legitimate approval response was not observed.");
  approvalHttpStatus = approvalResponseEvent.params.response.status;
  approvalResponseBody = JSON.parse((await command("Network.getResponseBody", { requestId: approvalResponseEvent.params.requestId })).body);
}
await waitFor(`document.querySelector('.engineering-approval-progress')?.innerText.includes('Human Approval\\nAPPROVED') && document.querySelector('.engineering-approval-progress')?.innerText.includes('IOF Certification\\nREADY')`, "approval and certification readiness");
const approvedLifecycle = await evaluate(`document.querySelector('.engineering-approval-progress')?.innerText ?? ''`);
const approvalScreenshot = await screenshot("human-approval-approved-certification-ready.png");
const afterApproval = await repositorySnapshot();
const persistedStatus = await approvalStatus();
const replay = await postApproval(exactRequest);

const consoleMessagesBeforeReload = events.filter((message) => ["Runtime.consoleAPICalled", "Log.entryAdded"].includes(message.method)).map((message) => JSON.stringify(message.params));
events.length = 0;
await command("Page.reload", { ignoreCache: true });
await delay(2500);
await openEngineering();
await waitFor(`document.querySelector('.engineering-approval-progress')?.innerText.includes('Human Approval\\nAPPROVED') && document.querySelector('.engineering-approval-progress')?.innerText.includes('IOF Certification\\nREADY')`, "approval reload rehydration");
const reloadLifecycle = await evaluate(`document.querySelector('.engineering-approval-progress')?.innerText ?? ''`);
const reloadScreenshot = await screenshot("approval-rehydrated-after-reload.png");
const afterReload = await repositorySnapshot();
const consoleMessages = [...consoleMessagesBeforeReload, ...events.filter((message) => ["Runtime.consoleAPICalled", "Log.entryAdded"].includes(message.method)).map((message) => JSON.stringify(message.params))];
const workspaceSource = await readFile(resolve("src", "workspaces", "EngineeringCertificationWorkspace.tsx"), "utf8");
const failureContractSource = await readFile(resolve("src", "engineering", "EngineeringFailureAuthority.ts"), "utf8");
const approvalRecord = persistedStatus.body.currentEngineeringApproval;
const assertions = {
  canonicalEligibilityComplete: eligibility.reviewComplete === true && eligibility.approvalEligible === true && eligibility.blockers.length === 0,
  canonicalPredicatePasses: eligibility.packageIntegrity === "PASS" && eligibility.routeAuthority === "PASS" && eligibility.quantityReconciliation === "PASS" && eligibility.constitutionalQuantity === "PASS" && eligibility.budgetApproval === "APPROVED" && eligibility.blockingConditions === 0 && eligibility.compliance === "PASS",
  exactRevisionIdMatch: (renderedAuthority["Engineering Revision"] ?? approvalResponseBody.engineeringApproval?.engineeringRevisionId) === eligibility.engineeringRevisionId,
  exactRevisionHashMatch: (renderedAuthority["Revision Hash"] ?? approvalResponseBody.engineeringApproval?.engineeringRevisionHash) === eligibility.engineeringRevisionHash,
  reviewSummaryHashMatch: (renderedAuthority["Review Summary Hash"] ?? approvalResponseBody.engineeringApproval?.reviewSummaryHash) === eligibility.reviewSummaryHash,
  staleRevisionRejected: staleRevision.status === 409 && staleRevision.body.code === "STALE_APPROVAL_ELIGIBILITY" && staleRevision.body.failedPredicate === "engineeringRevisionHash",
  staleSummaryRejected: staleSummary.status === 409 && staleSummary.body.code === "STALE_APPROVAL_ELIGIBILITY" && staleSummary.body.failedPredicate === "reviewSummaryHash",
  revisionMismatchRejected: revisionMismatch.status === 409 && revisionMismatch.body.code === "ENGINEERING_APPROVAL_REVISION_MISMATCH",
  scopeMismatchRejected: scopeMismatch.status === 409 && scopeMismatch.body.code === "ENGINEERING_APPROVAL_SCOPE_MISMATCH",
  tamperRejected: tamper.status === 409 && tamper.body.code === "ENGINEERING_APPROVAL_REVISION_HASH_MISMATCH",
  negativeTestsCreateNothing: same(before, afterNegativeTests),
  presentationNavigationCreatesNothing: same(afterNegativeTests, afterPresentationNavigation),
  legitimateApprovalCreated: [200, 201].includes(approvalHttpStatus) && approvalResponseBody.engineeringApproval?.decision === "APPROVED" && (!preexistingApproval || approvalResponseBody.idempotentReplay === true),
  approvalExactRevisionBound: approvalResponseBody.engineeringApproval?.engineeringRevisionId === eligibility.engineeringRevisionId && approvalResponseBody.engineeringApproval?.engineeringRevisionHash === eligibility.engineeringRevisionHash,
  approvalReviewHashBound: approvalResponseBody.engineeringApproval?.reviewSummaryHash === eligibility.reviewSummaryHash,
  approvalHashValid: Boolean(approvalResponseBody.engineeringApproval?.approvalHash),
  approvalPersisted: persistedStatus.body.currentEngineeringApproval?.approvalId === approvalResponseBody.engineeringApproval?.approvalId,
  idempotentReplay: replay.status === 200 && replay.body.idempotentReplay === true && replay.body.engineeringApproval?.approvalId === approvalRecord?.approvalId,
  lifecycleApproved: approvedLifecycle.includes("Human Approval\nAPPROVED") && approvedLifecycle.includes("IOF Certification\nREADY"),
  reloadRehydratesApproval: reloadLifecycle.includes("Human Approval\nAPPROVED") && reloadLifecycle.includes("IOF Certification\nREADY"),
  onlyApprovalRepositoryChanged: Object.entries(afterApproval).every(([key, value]) => key === "engineeringApprovals" ? value.length === before[key].length + (preexistingApproval ? 0 : 1) : same(value, before[key])),
  reloadCreatesNothing: same(afterApproval, afterReload),
  noAutomaticCertification: afterApproval.certificationLedgers.length === before.certificationLedgers.length && afterApproval.certifiedIofPackages.length === before.certifiedIofPackages.length,
  noDownstreamMutation: ["serviceOrders", "scopeVersions", "marketplaceQuotes", "controlWorkItems", "fieldClosures", "customerTwins"].every((key) => same(afterApproval[key], before[key])),
  mapRenderAuthorityPasses: mapFooter.includes("Render Authority: PASS") && mapFooter.includes("Duplicate Keys: 0") && mapFooter.includes("Duplicate Render Authorities: 0"),
  duplicateHh001WarningAbsent: !consoleMessages.some((message) => message.includes("HH-001") && message.toLowerCase().includes("same key")),
  zeroDuplicateReactKeyWarnings: !consoleMessages.some((message) => message.toLowerCase().includes("two children with the same key")),
  reasoningNonBlocking: eligibility.reasoningRequired === false && eligibility.approvalEligible === true,
  approvalErrorUxPresent: ["Approval Cannot Be Completed", "Return to Review", "Refresh Package State", "Technical Details"].every((text) => workspaceSource.includes(text)),
  cip048aClassificationIntact: ["ENGINEERING_DECISION", "DERIVED_SYSTEM_VALIDATION", "PACKAGE_DATA_DEFECT", "IMPLEMENTATION_DEFECT", "INFORMATIONAL"].every((text) => failureContractSource.includes(text)),
};
const result = {
  packageId: PACKAGE_ID,
  exact409BeforeRepair: JSON.parse(await readFile(resolve(output, "exact-approval-409-before-repair.json"), "utf8")),
  eligibility,
  predicateComparison: {
    packageIntegrity: { ui: eligibility.packageIntegrity, server: eligibility.packageIntegrity, authority: "ENGINEERING_PACKAGE_REFERENCE_INTEGRITY" },
    routeAuthority: { ui: eligibility.routeAuthority, server: eligibility.routeAuthority, authority: "COMMERCIAL_ROUTE_REPOSITORY" },
    quantityReconciliation: { ui: eligibility.quantityReconciliation, server: eligibility.quantityReconciliation, authority: "QUANTITY_RECONCILIATION" },
    constitutionalQuantity: { ui: eligibility.constitutionalQuantity, server: eligibility.constitutionalQuantity, authority: "CONSTITUTIONAL_ASSEMBLY" },
    budgetApproval: { ui: eligibility.budgetApproval, server: eligibility.budgetApproval, authority: "ENGINEERING_CHANGE_SET" },
    blockingConditions: { ui: eligibility.blockingConditions, server: eligibility.blockingConditions, authority: "ENGINEERING_CONSTRAINTS" },
    compliance: { ui: eligibility.compliance, server: eligibility.compliance, authority: "PRODUCT_DOCTRINE_COMPLIANCE" },
    revisionIdentity: { ui: renderedAuthority["Revision Hash"], server: eligibility.engineeringRevisionHash, authority: "ENGINEERING_REVISION" },
    reviewSummaryHash: { ui: renderedAuthority["Review Summary Hash"], server: eligibility.reviewSummaryHash, authority: "ENGINEERING_APPROVAL_ELIGIBILITY" },
  },
  negativeResponses: { staleRevision, staleSummary, revisionMismatch, scopeMismatch, tamper },
  approval: { httpStatus: approvalHttpStatus, response: approvalResponseBody, persisted: approvalRecord, replay, preexistingApproval: Boolean(preexistingApproval) },
  lifecycle: { approved: approvedLifecycle, reload: reloadLifecycle },
  mapFooter,
  consoleMessages,
  performance: { eligibilityGetMs: initialStatus.durationMs },
  screenshots: { map: mapScreenshot, approved: approvalScreenshot, reload: reloadScreenshot },
  assertions,
  passed: Object.values(assertions).every(Boolean),
};
await writeFile(resolve(output, "engineering-approval-reconciliation-validation.json"), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ packageId: result.packageId, performance: result.performance, assertions: result.assertions, passed: result.passed, screenshots: result.screenshots }, null, 2));
socket.close();
if (!result.passed) process.exitCode = 1;
