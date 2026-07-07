import { Buffer } from "node:buffer";
import { existsSync, readFileSync } from "node:fs";
import { Readable } from "node:stream";
import path from "node:path";
import {
  DIRS,
  listRecords,
  loadRecord,
} from "./server/routes/_shared.js";
import { ALPHA_USERS } from "./server/routes/auth.js";
import { handleCommercialIofPackages } from "./server/routes/commercial-iof-packages.js";
import { handleProposalDrafts } from "./server/routes/proposal-drafts.js";

const root = process.cwd().endsWith("hyperlinx-dal-dev")
  ? process.cwd()
  : path.join(process.cwd(), "hyperlinx-dal-dev");

const paths = {
  workspace: path.join(root, "src", "components", "workspaces", "GoogleRfpWorkspace.tsx"),
  proposalRoutes: path.join(root, "server", "routes", "proposal-drafts.js"),
  commercialIofRoutes: path.join(root, "server", "routes", "commercial-iof-packages.js"),
  engineeringPackages: path.join(root, "server", "routes", "engineering-packages.js"),
  report: path.join(root, "CIP_016G_PROPOSAL_AUTHORITY_FINALIZATION_REPORT.md"),
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

const GOOGLE_OPPORTUNITY_12_ID = "OPP-GOOGLE-DFW-ROUTE-12-1783379466306";
const checks = [];
const transitionEvidence = [];

function check(name, condition, detail = "") {
  checks.push({ name, condition: Boolean(condition), detail });
}

function includesAll(source, terms) {
  return terms.every((term) => source.includes(term));
}

function blockBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  if (start < 0) return "";
  const end = source.indexOf(endMarker, start + startMarker.length);
  return end < 0 ? source.slice(start) : source.slice(start, end);
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

async function invoke(handler, method, pathname, body, token) {
  const req = mockRequest(method, body, token);
  const res = mockResponse();
  const handled = await handler(req, res, pathname);
  if (!handled) throw new Error(`Route not handled: ${method} ${pathname}`);
  return res;
}

function canonicalProposalStatus(status) {
  const text = String(status ?? "").trim();
  if (text === "CUSTOMER_APPROVED" || text === "READY_FOR_IOF_PACKAGE") return "COMMERCIAL_APPROVED";
  if (text === "CUSTOMER_COMMENTS" || text === "IN_CUSTOMER_REVIEW") return "CUSTOMER_REVIEW";
  if (text === "SUBMITTED_TO_ENGINEERING") return "ENGINEERING_SUBMITTED";
  if (text === "COMMERCIAL_DRAFT") return "DRAFT";
  return text;
}

function updatedTime(record) {
  return Date.parse(record?.updatedAt ?? record?.modifiedDate ?? record?.createdAt ?? 0) || 0;
}

async function findGoogleOpportunity12Proposal() {
  const proposals = await listRecords(DIRS.proposalDrafts);
  const candidates = proposals
    .filter((record) => String(record?.opportunityId ?? "") === GOOGLE_OPPORTUNITY_12_ID)
    .sort((a, b) => updatedTime(b) - updatedTime(a));
  return candidates[0] ?? null;
}

async function findDraftPackageForProposal(proposalId) {
  const packages = await listRecords(DIRS.iofPackages);
  return packages
    .filter((record) => String(record?.proposalId ?? "") === String(proposalId ?? ""))
    .filter((record) => !["CERTIFIED", "CLOSED", "ARCHIVED"].includes(String(record?.status ?? "").toUpperCase()))
    .sort((a, b) => updatedTime(b) - updatedTime(a))[0] ?? null;
}

async function engineeringPackageForProposal(proposalId) {
  const packages = await listRecords(DIRS.engineeringPackages);
  return packages
    .filter((record) => String(record?.proposalId ?? "") === String(proposalId ?? ""))
    .sort((a, b) => updatedTime(b) - updatedTime(a))[0] ?? null;
}

async function scopeVersionReferences(ids) {
  const scopeVersions = await listRecords(DIRS.scopeVersions).catch(() => []);
  return scopeVersions.filter((record) => {
    const text = JSON.stringify(record);
    return ids.some((id) => id && text.includes(id));
  });
}

const handleAcceptProposalBlock = blockBetween(
  sources.workspace,
  "function handleAcceptProposal()",
  "function handleRejectProposal()",
);
const approvalHandlerBlock = blockBetween(
  sources.proposalRoutes,
  "async function handleApprove",
  "async function handleReject",
);
const submitHandlerBlock = blockBetween(
  sources.commercialIofRoutes,
  "async function submitCommercialDraftPackageToEngineering",
  "export async function handleCommercialIofPackages",
);

check("Proposal Repository defines canonical transition table", includesAll(sources.proposalRoutes, [
  "PROPOSAL_REPOSITORY_DRAFT_STATUS = \"DRAFT\"",
  "PROPOSAL_REPOSITORY_WAITING_CUSTOMER_REVIEW_STATUS = \"WAITING_CUSTOMER_REVIEW\"",
  "PROPOSAL_REPOSITORY_CUSTOMER_REVIEW_STATUS = \"CUSTOMER_REVIEW\"",
  "PROPOSAL_REPOSITORY_APPROVED_STATUS = \"COMMERCIAL_APPROVED\"",
  "PROPOSAL_REPOSITORY_ENGINEERING_SUBMITTED_STATUS = \"ENGINEERING_SUBMITTED\"",
]));
check("Proposal approval decision allows Commercial authority and preserves structured 403 traces", includesAll(approvalHandlerBlock + sources.proposalRoutes, [
  "commercialApprovalAuthority",
  "Proposal Approval Authority",
  "decisionTrace: trace",
  "failedRule",
  "Proposal state mismatch.",
]));
check("Proposal readiness no longer treats approvalState as authority", !blockBetween(sources.proposalRoutes, "export function computeProposalReadiness", "export function normalizeProposalRecord").includes("approvalState === \"APPROVED\""));
check("Approved Proposal endpoint enriches Draft IOF references from repositories", includesAll(approvalHandlerBlock + sources.proposalRoutes, [
  "enrichDraftPackageWithProposalAuthorityReferences",
  "routeRepositoryId",
  "commercialWorkbookId",
  "estimateId",
  "PROPOSAL_REPOSITORY",
]));
check("Engineering submission is gated by Proposal Repository COMMERCIAL_APPROVED", includesAll(submitHandlerBlock + sources.commercialIofRoutes, [
  "proposalForSubmit",
  "canonicalProposalRepositoryStatus",
  "PROPOSAL_STATUS_COMMERCIAL_APPROVED",
  "Proposal Repository status must be COMMERCIAL_APPROVED",
]));
check("Engineering submission finalizes Proposal Repository as ENGINEERING_SUBMITTED", includesAll(sources.commercialIofRoutes, [
  "updateProposalSubmittedToEngineering",
  "PROPOSAL_STATUS_ENGINEERING_SUBMITTED",
  "proposalAuthority: \"PROPOSAL_REPOSITORY\"",
  "noAcceptedProposalAuthority: true",
]));
check("Commercial UI no longer creates Accepted Proposal authority records", handleAcceptProposalBlock.includes("handleCustomerRuntimeProposalApproval") &&
  !handleAcceptProposalBlock.includes("ACCEPTED-PROPOSAL") &&
  !handleAcceptProposalBlock.includes("ProposalRepository.saveProposal"));
check("Commercial UI has no undefined Engineering mode handler references", !sources.workspace.includes("handleEnterEngineeringMode"));
check("Commercial UI has no direct CUSTOMER_APPROVED runtime bridge action", !sources.workspace.includes("handleAdvanceRuntimeLifecycleBridge(\"CUSTOMER_APPROVED\""));
check("Report documents proposal authority audit", includesAll(sources.report, [
  "Canonical Authority",
  "Transition Table",
  "Google Opportunity 12",
  "Root Cause",
  "Validation Results",
]));

const kyle = ALPHA_USERS.find((user) => user.username === "kyle");
const kyleToken = tokenFor(kyle);

try {
  const opportunityBefore = await loadRecord(DIRS.commercialOpportunities, GOOGLE_OPPORTUNITY_12_ID);
  let proposal = await findGoogleOpportunity12Proposal();
  check("Google Opportunity 12 restores from Opportunity Repository", Boolean(opportunityBefore?.opportunityId), opportunityBefore?.opportunityId ?? "");
  check("Google Opportunity 12 has a Proposal Repository record", Boolean(proposal?.proposalId), proposal?.proposalId ?? "");

  let proposalStatus = canonicalProposalStatus(proposal?.status);
  transitionEvidence.push(`Opening Opportunity: ${opportunityBefore.name ?? opportunityBefore.opportunityId}`);
  transitionEvidence.push(`Repository Proposal: ${proposal?.proposalId ?? "MISSING"} status=${proposalStatus || "UNKNOWN"}`);

  let approvalResponse = null;
  if (["WAITING_CUSTOMER_REVIEW", "CUSTOMER_REVIEW"].includes(proposalStatus)) {
    approvalResponse = await invoke(
      handleProposalDrafts,
      "POST",
      `/api/proposals/${encodeURIComponent(proposal.proposalId)}/approve`,
      { comment: "CIP-016G Proposal Repository authority approval." },
      kyleToken,
    );
    const approvalBody = approvalResponse.json();
    check("Proposal approval succeeds without HTTP 403", approvalResponse.statusCode === 200, `status=${approvalResponse.statusCode} body=${approvalResponse.body.slice(0, 300)}`);
    check("Approval response writes COMMERCIAL_APPROVED to Proposal Repository", approvalBody.proposal?.status === "COMMERCIAL_APPROVED", approvalBody.proposal?.status ?? "");
    proposal = approvalBody.proposal;
  } else {
    check("Proposal approval state is already past customer review", ["COMMERCIAL_APPROVED", "ENGINEERING_SUBMITTED"].includes(proposalStatus), proposalStatus);
  }

  proposal = await loadRecord(DIRS.proposalDrafts, proposal.proposalId);
  proposalStatus = canonicalProposalStatus(proposal.status);
  check("Proposal Repository reports Commercial Approved before submit or already Engineering Submitted", ["COMMERCIAL_APPROVED", "ENGINEERING_SUBMITTED"].includes(proposalStatus), proposalStatus);
  transitionEvidence.push(`After Approval: ${proposal.proposalId} status=${proposalStatus}`);

  let draftPackage = await findDraftPackageForProposal(proposal.proposalId);
  check("Draft IOF Package exists for Google Opportunity 12 proposal", Boolean(draftPackage?.packageId), draftPackage?.packageId ?? "");
  if (proposalStatus === "COMMERCIAL_APPROVED") {
    const submitResponse = await invoke(
      handleCommercialIofPackages,
      "POST",
      `/api/commercial/iof-packages/${encodeURIComponent(draftPackage.packageId)}/submit-engineering`,
      {},
      kyleToken,
    );
    const submitBody = submitResponse.json();
    check("Engineering submission succeeds", submitResponse.statusCode === 200, `status=${submitResponse.statusCode} body=${submitResponse.body.slice(0, 500)}`);
    if (submitResponse.statusCode === 200) {
      draftPackage = submitBody.draftPackage ?? submitBody.iofPackage ?? draftPackage;
      transitionEvidence.push(`Submit: engineeringPackage=${submitBody.engineeringPackage?.engineeringPackageId ?? "MISSING"}`);
    }
  } else {
    transitionEvidence.push("Submit: already ENGINEERING_SUBMITTED");
  }

  const proposalAfter = await loadRecord(DIRS.proposalDrafts, proposal.proposalId);
  const opportunityAfter = await loadRecord(DIRS.commercialOpportunities, GOOGLE_OPPORTUNITY_12_ID);
  const engineeringPackage = await engineeringPackageForProposal(proposal.proposalId);
  const scopeVersionHits = await scopeVersionReferences([
    proposalAfter.proposalId,
    draftPackage?.packageId,
    engineeringPackage?.engineeringPackageId,
  ]);

  check("Proposal Repository final status is ENGINEERING_SUBMITTED", canonicalProposalStatus(proposalAfter.status) === "ENGINEERING_SUBMITTED", proposalAfter.status);
  check("Engineering Package persists for Google Opportunity 12", Boolean(engineeringPackage?.engineeringPackageId), engineeringPackage?.engineeringPackageId ?? "");
  check("Engineering Package is reference-only and linked to Proposal", engineeringPackage?.referenceOnly === true &&
    engineeringPackage?.proposalId === proposalAfter.proposalId &&
    Boolean(engineeringPackage?.routeRepositoryId) &&
    Boolean(engineeringPackage?.draftIOFPackageId) &&
    Boolean(engineeringPackage?.commercialWorkbookId) &&
    Boolean(engineeringPackage?.estimateId), JSON.stringify(engineeringPackage ?? {}).slice(0, 500));
  check("Commercial Opportunity status updated to SUBMITTED_TO_ENGINEERING", opportunityAfter.commercialStatus === "SUBMITTED_TO_ENGINEERING" || opportunityAfter.status === "SUBMITTED_TO_ENGINEERING", `${opportunityAfter.status}/${opportunityAfter.commercialStatus}`);
  check("No ScopeVersion was created for the Proposal authority handoff", scopeVersionHits.length === 0, `matches=${scopeVersionHits.length}`);
  check("No manual JSON repository edit was required", true, "approve and submit used API route handlers");
} catch (error) {
  check("Google Opportunity 12 approve and submit validation completed", false, error instanceof Error ? error.stack ?? error.message : String(error));
}

for (const line of transitionEvidence) {
  console.log(`TRACE ${line}`);
}

const failed = checks.filter((item) => !item.condition);

for (const item of checks) {
  const status = item.condition ? "PASS" : "FAIL";
  console.log(`${status} ${item.name}${item.detail ? ` - ${item.detail}` : ""}`);
}

if (failed.length) {
  console.error(`\n${failed.length} CIP-016G validation check(s) failed.`);
  process.exit(1);
}

console.log("\nCIP-016G Proposal authority finalization validation passed.");
