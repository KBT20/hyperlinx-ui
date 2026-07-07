import { Buffer } from "node:buffer";
import { existsSync, readFileSync } from "node:fs";
import { Readable } from "node:stream";
import path from "node:path";
import {
  DIRS,
  deleteRecord,
  listRecords,
  persistRecord,
} from "./server/routes/_shared.js";
import { ALPHA_USERS } from "./server/routes/auth.js";
import { handleProposalDrafts } from "./server/routes/proposal-drafts.js";

const decisionTraceLogs = [];
const originalConsoleInfo = console.info;
console.info = (...args) => {
  const label = String(args[0] ?? "");
  if (label.startsWith("[ProposalStateAuthority]")) return;
  if (label.startsWith("[ProposalApprovalDecisionTrace]")) {
    decisionTraceLogs.push(args[1]);
    return;
  }
  if (label.startsWith("Decision Trace")) {
    decisionTraceLogs.push(label);
    return;
  }
  originalConsoleInfo(...args);
};

const root = process.cwd().endsWith("hyperlinx-dal-dev")
  ? process.cwd()
  : path.join(process.cwd(), "hyperlinx-dal-dev");

const paths = {
  proposalRoutes: path.join(root, "server", "routes", "proposal-drafts.js"),
  report: path.join(root, "CIP_016F_PROPOSAL_APPROVAL_DECISION_TRACE_REPORT.md"),
};

for (const requiredPath of Object.values(paths)) {
  if (!existsSync(requiredPath)) {
    console.error(`FAIL missing required file: ${path.relative(root, requiredPath)}`);
    process.exit(1);
  }
}

const sources = Object.fromEntries(
  Object.entries(paths).map(([key, filePath]) => [key, readFileSync(filePath, "utf8")]),
);

const checks = [];
const cleanupProposalIds = new Set();

function check(name, condition, detail = "") {
  checks.push({ name, condition: Boolean(condition), detail });
}

function includesAll(source, terms) {
  return terms.every((term) => source.includes(term));
}

function tokenFor(user) {
  return Buffer.from(JSON.stringify({
    sub: user.userId,
    username: user.username,
    role: user.role,
    iat: new Date().toISOString(),
  })).toString("base64url");
}

function mockRequest(method, body, token) {
  const raw = body === undefined ? "" : JSON.stringify(body);
  const req = Readable.from(raw ? [Buffer.from(raw)] : []);
  req.method = method;
  req.headers = {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  };
  return req;
}

function mockResponse() {
  const chunks = [];
  return {
    statusCode: 0,
    headers: {},
    body: "",
    writeHead(statusCode, headers) {
      this.statusCode = statusCode;
      this.headers = headers;
    },
    end(chunk = "") {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      this.body = Buffer.concat(chunks).toString("utf8");
    },
    json() {
      return this.body ? JSON.parse(this.body) : {};
    },
  };
}

async function invoke(method, pathname, body, token) {
  const req = mockRequest(method, body, token);
  const res = mockResponse();
  const handled = await handleProposalDrafts(req, res, pathname);
  if (!handled) throw new Error(`Route not handled: ${method} ${pathname}`);
  return res;
}

function proposalFixture(id, overrides = {}) {
  const timestamp = new Date().toISOString();
  return {
    proposalId: id,
    proposalRecordId: id,
    proposalRecordType: "PROPOSAL_RUNTIME_OBJECT",
    proposalNumber: `PROP-${id}`,
    title: `CIP-016F ${id}`,
    summary: "Proposal approval decision trace validation.",
    executiveSummary: "Validation proposal.",
    customerId: "customer-google",
    accountId: "google",
    customer: "Google",
    opportunityId: `OPPORTUNITY-${id}`,
    productId: "POINT_TO_POINT_DARK_FIBER",
    productName: "Point-to-Point Duct & Dark Fiber",
    organizationId: "org-teralinx",
    workspaceId: "workspace-teralinx-kyle",
    ownerId: "teralinx-user-kyle",
    commercialOwnerId: "teralinx-user-kyle",
    visibility: "SHARED",
    assignedCustomerUsers: ["google-participant-001"],
    assignedTo: ["google-participant-001"],
    status: "WAITING_CUSTOMER_REVIEW",
    approvalState: "CUSTOMER_REVIEW",
    pricingSummary: { totalCost: 1000, sellPrice: 1500, routeMiles: 1 },
    marginSummary: { grossMarginDollars: 500 },
    dealPointIds: ["DEAL-001"],
    runtimeObjectIds: ["ROUTE-OBJECT-001"],
    runtimeRelationshipIds: ["REL-001"],
    runtimeEvidenceIds: ["EVID-001"],
    existingInventoryReferences: ["INV-001"],
    geometryReferences: ["GEOM-001"],
    proposalDocumentReferences: ["Proposal PDF"],
    createdAt: timestamp,
    updatedAt: timestamp,
    noScopeVersionCreation: true,
    noInventoryMutation: true,
    ...overrides,
  };
}

async function saveFixture(id, overrides = {}) {
  cleanupProposalIds.add(id);
  await persistRecord(DIRS.proposalDrafts, id, proposalFixture(id, overrides));
}

function rule(trace, ruleName) {
  return trace?.validationRules?.find((item) => item.rule === ruleName);
}

function hasTraceShape(trace) {
  return includesAll(JSON.stringify(trace ?? {}), [
    "proposalId",
    "proposalRepositoryRecord",
    "repositoryStatus",
    "approvalState",
    "commercialState",
    "customerReviewState",
    "engineeringStatus",
    "requestedTransition",
    "validationRules",
    "failedRule",
    "denialReason",
  ]);
}

async function cleanupRecords() {
  const ids = [...cleanupProposalIds];
  const relatedDirs = [
    [DIRS.proposalDrafts, "proposalRecordId"],
    [DIRS.runtimeObjects, "runtimeId"],
    [DIRS.iofPackages, "packageId"],
    [DIRS.engineeringIntakes, "intakeId"],
    [DIRS.runtimeWorkspaceSessions, "sessionId"],
    [DIRS.runtimeHistory, "historyId"],
  ];
  for (const [dir, idKey] of relatedDirs) {
    const records = await listRecords(dir).catch(() => []);
    for (const record of records) {
      const recordText = JSON.stringify(record);
      if (ids.some((id) => recordText.includes(id))) {
        const recordId = record[idKey] ?? record.id ?? record.objectId ?? record.proposalId;
        if (recordId) await deleteRecord(dir, recordId).catch(() => null);
      }
    }
  }
  for (const id of ids) {
    await deleteRecord(DIRS.proposalDrafts, id).catch(() => null);
    await deleteRecord(DIRS.runtimeObjects, `RUNTIME-PROPOSAL-${id}`).catch(() => null);
  }
}

check("approval endpoint has decision trace helpers", includesAll(sources.proposalRoutes, [
  "PROPOSAL_APPROVAL_ELIGIBLE_STATUSES",
  "buildProposalApprovalDecisionTrace",
  "logProposalApprovalDecisionTrace",
  "proposalApprovalDenied",
  "ProposalApprovalDecisionTrace",
  "decisionTraceText",
]));
check("decision trace evaluates every requested field", includesAll(sources.proposalRoutes, [
  "proposalRepositoryRecord",
  "repositoryStatus",
  "approvalState",
  "commercialState",
  "customerReviewState",
  "engineeringStatus",
  "requestedTransition: \"APPROVE\"",
  "validationRules",
  "failedRule",
]));
check("403 denial returns structured trace body", includesAll(sources.proposalRoutes, [
  "jsonResponse(res, statusCode",
  "denialReason: trace.denialReason",
  "decisionTrace: trace",
]) && !sources.proposalRoutes.includes("errorResponse(res, 403, \"Only an assigned customer reviewer can approve this proposal.\")"));
check("approval state machine blocks duplicate and mismatched states", includesAll(sources.proposalRoutes, [
  "Already Approved",
  "Approval Eligible State",
  "Proposal state mismatch.",
  "Proposal is already approved.",
]));
check("report documents approval and rejection path validation", includesAll(sources.report, [
  "Approval Decision Trace",
  "Approval Paths",
  "Rejection Paths",
  "Validation Results",
]));

const kyle = ALPHA_USERS.find((user) => user.username === "kyle");
const google = ALPHA_USERS.find((user) => user.username === "google");
const fran = ALPHA_USERS.find((user) => user.username === "fran");
const googleToken = tokenFor(google);
const franToken = tokenFor(fran);

const timestamp = Date.now();
const waitingId = `CIP016F-WAITING-${timestamp}`;
const commentsId = `CIP016F-COMMENTS-${timestamp}`;
const unauthorizedId = `CIP016F-UNAUTHORIZED-${timestamp}`;
const duplicateId = `CIP016F-DUPLICATE-${timestamp}`;
const mismatchId = `CIP016F-MISMATCH-${timestamp}`;
const missingId = `CIP016F-MISSING-${timestamp}`;

try {
  await saveFixture(waitingId);
  const waitingApproval = await invoke("POST", `/api/proposals/${encodeURIComponent(waitingId)}/approve`, { comment: "Approved waiting review." }, googleToken);
  const waitingTrace = decisionTraceLogs.find((item) => item?.proposalId === waitingId && item.decision === "ALLOW");
  check("WAITING_CUSTOMER_REVIEW approval path succeeds", waitingApproval.statusCode === 200 && waitingApproval.json().proposal?.status === "COMMERCIAL_APPROVED", `status=${waitingApproval.statusCode}`);
  check("WAITING_CUSTOMER_REVIEW approval path logs ALLOW trace", waitingTrace?.decision === "ALLOW" && rule(waitingTrace, "Approval Eligible State")?.status === "PASS");

  await saveFixture(commentsId, { status: "CUSTOMER_COMMENTS", approvalState: "COMMENTED" });
  const commentsApproval = await invoke("POST", `/api/proposals/${encodeURIComponent(commentsId)}/approve`, { comment: "Approved after comments." }, googleToken);
  const commentsTrace = decisionTraceLogs.find((item) => item?.proposalId === commentsId && item.decision === "ALLOW");
  check("CUSTOMER_COMMENTS approval path succeeds", commentsApproval.statusCode === 200 && commentsApproval.json().proposal?.status === "COMMERCIAL_APPROVED", `status=${commentsApproval.statusCode}`);
  check("CUSTOMER_COMMENTS approval path logs ALLOW trace", commentsTrace?.decision === "ALLOW" && rule(commentsTrace, "Approval Eligible State")?.status === "PASS");

  await saveFixture(unauthorizedId);
  const unauthorized = await invoke("POST", `/api/proposals/${encodeURIComponent(unauthorizedId)}/approve`, { comment: "Unauthorized." }, franToken);
  const unauthorizedBody = unauthorized.json();
  check("unauthorized approval returns HTTP 403", unauthorized.statusCode === 403, `status=${unauthorized.statusCode}`);
  check("unauthorized approval returns structured decision trace", hasTraceShape(unauthorizedBody.decisionTrace) && unauthorizedBody.failedRule === "Customer Review Authority");

  await saveFixture(duplicateId, { status: "COMMERCIAL_APPROVED", approvalState: "APPROVED", approvedAt: new Date().toISOString() });
  const duplicate = await invoke("POST", `/api/proposals/${encodeURIComponent(duplicateId)}/approve`, { comment: "Duplicate." }, googleToken);
  const duplicateBody = duplicate.json();
  check("already approved proposal returns HTTP 403", duplicate.statusCode === 403, `status=${duplicate.statusCode}`);
  check("already approved trace identifies duplicate approval", duplicateBody.failedRule === "Already Approved" && duplicateBody.denialReason === "Proposal is already approved.");

  await saveFixture(mismatchId, { status: "CUSTOMER_REVIEW", approvalState: "CUSTOMER_REVIEW" });
  const mismatch = await invoke("POST", `/api/proposals/${encodeURIComponent(mismatchId)}/approve`, { comment: "Mismatch." }, googleToken);
  const mismatchBody = mismatch.json();
  check("state mismatch proposal returns HTTP 403", mismatch.statusCode === 403, `status=${mismatch.statusCode}`);
  check("state mismatch trace identifies approval eligible state failure", mismatchBody.failedRule === "Approval Eligible State" && mismatchBody.denialReason === "Proposal state mismatch.");

  const missing = await invoke("POST", `/api/proposals/${encodeURIComponent(missingId)}/approve`, { comment: "Missing." }, googleToken);
  const missingBody = missing.json();
  check("missing proposal returns structured DENY trace", missing.statusCode === 404 && missingBody.decisionTrace?.failedRule === "Proposal Exists", `status=${missing.statusCode}`);
  check("all denial traces include required fields", [unauthorizedBody, duplicateBody, mismatchBody, missingBody].every((body) => hasTraceShape(body.decisionTrace)));
  check("decision trace log captured allow and deny decisions", decisionTraceLogs.some((item) => item?.decision === "ALLOW") && decisionTraceLogs.some((item) => item?.decision === "DENY"));
} catch (error) {
  check("dynamic proposal approval decision trace validation completed", false, error instanceof Error ? error.stack ?? error.message : String(error));
} finally {
  await cleanupRecords();
}

const failed = checks.filter((item) => !item.condition);

for (const item of checks) {
  const status = item.condition ? "PASS" : "FAIL";
  console.log(`${status} ${item.name}${item.detail ? ` - ${item.detail}` : ""}`);
}

if (failed.length) {
  console.error(`\n${failed.length} CIP-016F validation check(s) failed.`);
  process.exit(1);
}

console.log("\nCIP-016F Proposal approval decision trace validation passed.");
