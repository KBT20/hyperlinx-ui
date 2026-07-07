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

const originalConsoleInfo = console.info;
console.info = (...args) => {
  if (String(args[0] ?? "").startsWith("[ProposalStateAuthority]")) return;
  originalConsoleInfo(...args);
};

const root = process.cwd().endsWith("hyperlinx-dal-dev")
  ? process.cwd()
  : path.join(process.cwd(), "hyperlinx-dal-dev");

const paths = {
  proposalRoutes: path.join(root, "server", "routes", "proposal-drafts.js"),
  api: path.join(root, "src", "api", "teralinxRuntime.ts"),
  workspace: path.join(root, "src", "components", "workspaces", "GoogleRfpWorkspace.tsx"),
  report: path.join(root, "CIP_016E_COMMERCIAL_PROPOSAL_STATE_AUTHORITY_AUDIT_REPORT.md"),
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
const cleanup = [];

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
    title: `CIP-016E ${id}`,
    summary: "Commercial proposal state authority validation.",
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
    pricingSummary: { totalCost: 1000, sellPrice: 1500 },
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

check("server canonicalizes approved proposal state", includesAll(sources.proposalRoutes, [
  "PROPOSAL_REPOSITORY_APPROVED_STATUS = \"COMMERCIAL_APPROVED\"",
  "canonicalProposalRepositoryStatus",
  "APPROVED_PROPOSAL_STATUSES",
  "ProposalStateAuthority",
]));
check("server approval writes COMMERCIAL_APPROVED", sources.proposalRoutes.includes("status: PROPOSAL_REPOSITORY_APPROVED_STATUS"));
check("server logs save and restore proposal state", includesAll(sources.proposalRoutes, [
  "Proposal save input",
  "Proposal Repository write",
  "Proposal Repository restore:list",
  "Proposal Repository restore:get",
  "Proposal Repository restore:open",
  "valueWrittenToProposalRepository",
  "valueRestoredFromProposalRepository",
]));
check("client type includes COMMERCIAL_APPROVED", sources.api.includes("| \"COMMERCIAL_APPROVED\""));
check("dashboard derives authority from Proposal Repository", includesAll(sources.workspace, [
  "proposalRepositoryReportsCommercialApproved",
  "proposalAuthoritySnapshot",
  "Commercial Dashboard hydration",
  "Proposal Repository status is",
  "reports COMMERCIAL_APPROVED",
]) && sources.workspace.includes("ok: Boolean(activeProposalRuntime?.proposalId && proposalRepositoryReportsCommercialApproved(activeProposalRuntime))"));
check("dashboard submit gate no longer trusts accepted projection alone", !sources.workspace.includes("Boolean(activeProposalRuntime?.proposalId && customerApproved)") &&
  !sources.workspace.includes("accountCustomerReviewStatus === \"ACCEPTED\" || [\"APPROVED\", \"CUSTOMER_APPROVED\", \"ACCEPTED\"].includes(activeProposalApprovalState) || Boolean(accountAcceptedProposal)"));
check("manual accepted proposal path updates original authority record", includesAll(sources.workspace, [
  "status: \"COMMERCIAL_APPROVED\"",
  "Proposal Repository approval write",
]));
check("report documents state transition audit", includesAll(sources.report, [
  "Root Cause",
  "State Transition Report",
  "Proposal Repository Authority",
  "Unexpected Status Change",
  "Gated Pipeline Recommendation",
  "Validation Results",
]));

const kyle = ALPHA_USERS.find((user) => user.username === "kyle");
const google = ALPHA_USERS.find((user) => user.username === "google");
const kyleToken = tokenFor(kyle);
const googleToken = tokenFor(google);
const legacyId = `CIP016E-LEGACY-${Date.now()}`;
const approvalId = `CIP016E-APPROVE-${Date.now()}`;

try {
  const legacy = proposalFixture(legacyId, {
    status: "CUSTOMER_APPROVED",
    approvalState: "APPROVED",
  });
  await persistRecord(DIRS.proposalDrafts, legacyId, legacy);
  cleanup.push([DIRS.proposalDrafts, legacyId]);
  cleanup.push([DIRS.runtimeObjects, `RUNTIME-PROPOSAL-${legacyId}`]);

  const getLegacy = await invoke("GET", `/api/proposals/${encodeURIComponent(legacyId)}`, undefined, kyleToken);
  const restoredLegacy = getLegacy.json().proposal;
  check("legacy CUSTOMER_APPROVED restores as COMMERCIAL_APPROVED", restoredLegacy.status === "COMMERCIAL_APPROVED", `status=${restoredLegacy?.status}`);
  check("legacy approved proposal remains engineering eligible", restoredLegacy.readiness?.customerApproved === true);

  const approvalProposal = proposalFixture(approvalId);
  const saveApproval = await invoke("POST", "/api/proposals", { proposal: approvalProposal }, kyleToken);
  cleanup.push([DIRS.proposalDrafts, approvalId]);
  cleanup.push([DIRS.runtimeObjects, `RUNTIME-PROPOSAL-${approvalId}`]);
  check("proposal save succeeds before approval", saveApproval.statusCode === 201, `status=${saveApproval.statusCode}`);

  const approve = await invoke("POST", `/api/proposals/${encodeURIComponent(approvalId)}/approve`, { comment: "Approved for CIP-016E." }, googleToken);
  const approved = approve.json().proposal;
  check("customer approval endpoint returns COMMERCIAL_APPROVED", approve.statusCode === 200 && approved.status === "COMMERCIAL_APPROVED", `status=${approve.statusCode} proposal=${approved?.status}`);
  check("approved proposal readiness is customer approved", approved.readiness?.customerApproved === true);

  const list = await invoke("GET", "/api/proposals", undefined, kyleToken);
  const listed = list.json().proposals.find((proposal) => proposal.proposalId === approvalId);
  check("Proposal Repository list reports COMMERCIAL_APPROVED", listed?.status === "COMMERCIAL_APPROVED", `status=${listed?.status}`);
} catch (error) {
  check("dynamic proposal state authority validation completed", false, error instanceof Error ? error.stack ?? error.message : String(error));
} finally {
  const histories = await listRecords(DIRS.runtimeHistory).catch(() => []);
  for (const history of histories) {
    if ([legacyId, approvalId].includes(String(history.objectId ?? ""))) {
      cleanup.push([DIRS.runtimeHistory, history.historyId]);
    }
  }
  for (const [dir, id] of cleanup.reverse()) {
    await deleteRecord(dir, id).catch(() => null);
  }
}

const failed = checks.filter((item) => !item.condition);

for (const item of checks) {
  const status = item.condition ? "PASS" : "FAIL";
  console.log(`${status} ${item.name}${item.detail ? ` - ${item.detail}` : ""}`);
}

if (failed.length) {
  console.error(`\n${failed.length} CIP-016E validation check(s) failed.`);
  process.exit(1);
}

console.log("\nCIP-016E Commercial Proposal state authority validation passed.");
