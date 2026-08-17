import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const baseUrl = process.env.CIP072_BASE_URL ?? "http://127.0.0.1:3001";
const password = (await readFile(process.env.CIP072_DEMO_CREDENTIAL_FILE ?? "/home/ubuntu/.hyperlinx-demo-credential", "utf8")).trim();
const accountId = "ACCOUNT-DEMO-NORTHSTAR";
const opportunityId = "DEMO-OPP-NORTHSTAR-CLOUD-INFRASTRUCTURE-CHEYENNE-METRO-DUCT-SYSTEM-31-1786992282335";
const proposalId = "DEMO-PROP-NORTHSTAR-CLOUD-INFRASTRUCTURE-CHEYENNE-METRO-DUCT-SYSTEM-31-v1";
const trace = [];

async function call(step, pathname, { method = "GET", body, cookie = "", persona = "SALES", expected = [200, 201] } = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(cookie ? { Cookie: cookie } : {}),
      "X-Hyperlinx-Demo-Persona": persona,
      "X-Hyperlinx-Demo-Customer-Organization": "org-demo-customer-a",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const raw = await response.text();
  let value;
  try { value = raw ? JSON.parse(raw) : {}; } catch { value = { raw }; }
  trace.push({ step, status: response.status, predicate: value.predicate, error: value.error });
  if (!expected.includes(response.status)) throw Object.assign(new Error(`${step} (${response.status}): ${value.error ?? raw}`), { value });
  return { value, cookie: String(response.headers.get("set-cookie") ?? "").split(";")[0] };
}

try {
  const login = await call("Demo login", "/api/auth/login", { method: "POST", body: { username: "demo", password } });
  let cookie = login.cookie;
  assert.equal(login.value.user.principalId, "demo-principal");
  assert.equal(login.value.user.organizationId, "org-demo");

  const original = (await call("Open existing Cheyenne Proposal R2", `/api/proposals/${encodeURIComponent(proposalId)}`, { cookie })).value.proposal;
  assert.equal(original.proposalRevisionId, `${proposalId}-revision-2`);
  assert.equal(original.revisionNumber, 2);
  assert.equal(original.revisionStatus, "SAVED");
  const originalHash = original.proposalHash;
  const originalRevisionCount = original.proposalRevisions.length;
  const exact = {
    accountId,
    opportunityId,
    opportunityStateVersion: original.opportunityStateVersion,
    opportunityStateHash: original.opportunityStateHash,
    proposalId,
    proposalRevisionId: original.proposalRevisionId,
    proposalHash: original.proposalHash,
    routeId: original.routeRepositoryId,
    routeRepositoryId: original.routeRepositoryId,
    routeRevision: original.routeRevision,
    routeGeometryId: original.routeGeometryId,
    geometryHash: original.routeGeometryHash,
  };

  await call("Wrong Opportunity state hash fails closed", `/api/proposals/${encodeURIComponent(proposalId)}/internal-commercial-approve`, {
    method: "POST", cookie, body: { ...exact, opportunityStateHash: "STALE-CIP073" }, expected: [409],
  });
  await call("Stale route revision fails closed", `/api/proposals/${encodeURIComponent(proposalId)}/internal-commercial-approve`, {
    method: "POST", cookie, body: { ...exact, routeRevision: Number(exact.routeRevision) - 1 }, expected: [409],
  });

  const internal = (await call("Approve exact Internal Commercial Review", `/api/proposals/${encodeURIComponent(proposalId)}/internal-commercial-approve`, {
    method: "POST", cookie, body: { ...exact, comment: "CIP-072 bounded Internal Commercial Review." },
  })).value.proposal;
  assert.equal(internal.internalCommercialApproval.proposalRevisionId, original.proposalRevisionId);
  assert.equal(internal.internalCommercialApproval.proposalHash, originalHash);
  assert.equal(internal.internalCommercialApproval.opportunityMateriality.decision, "NON_MATERIAL");
  assert.equal(internal.internalCommercialApproval.opportunityMateriality.materialCommercialState, "UNCHANGED");
  assert.equal(internal.internalCommercialApproval.currentOpportunityStateVersion, 5);

  await call("Stale submission hash fails closed", `/api/proposals/${encodeURIComponent(proposalId)}/submit-customer`, {
    method: "POST", cookie, body: { ...exact, proposalHash: "STALE-CIP072", assignedCustomerUsers: ["demo-customer-a-viewer"], customerOrganizationId: "org-demo-customer-a" }, expected: [409],
  });

  const recipients = ["demo-customer-a-viewer", "demo-customer-a-reviewer", "demo-customer-a-signer"];
  const submitted = (await call("Submit exact R2 to Customer", `/api/proposals/${encodeURIComponent(proposalId)}/submit-customer`, {
    method: "POST", cookie, body: { ...exact, assignedCustomerUsers: recipients, customerOrganizationId: "org-demo-customer-a" },
  })).value;
  assert.equal(submitted.customerReviewPackage.accountId, accountId);
  assert.equal(submitted.customerReviewPackage.proposalRevisionId, original.proposalRevisionId);
  assert.equal(submitted.customerReviewPackage.proposalHash, originalHash);

  const reviewTwin = (await call("Internal Customer Twin projects Customer Review", `/api/accounts/${encodeURIComponent(accountId)}/customer-twin`, { cookie })).value.customerTwin;
  const reviewDeal = reviewTwin.deals.find((item) => item.opportunityId === opportunityId);
  assert.equal(reviewDeal.currentState, "CUSTOMER_REVIEW");
  assert.equal(reviewDeal.artifactStates.proposal.state, "SUBMITTED");
  assert.equal(reviewDeal.artifactStates.customerReview.state, "ACTIVE");
  assert.equal(reviewDeal.artifactStates.customerAcceptance.state, "PENDING");
  assert.equal(reviewDeal.artifactStates.engineering.eligibility, "NOT_ELIGIBLE");

  await call("Engineering cannot begin before acceptance", "/api/engineering/certification/draft-packages/from-proposal", {
    method: "POST", cookie, body: { proposalId }, expected: [409],
  });
  await call("Customer cannot create ScopeVersion", "/api/scopeversions", {
    method: "POST", cookie, persona: "CUSTOMER_COMMERCIAL_REVIEWER", body: {}, expected: [403],
  });

  const projectPath = `/api/customer-portal/projects/${encodeURIComponent(opportunityId)}/proposal/accept`;
  await call("Customer Viewer cannot accept", projectPath, { method: "POST", cookie, persona: "CUSTOMER_VIEWER", body: { ...exact }, expected: [403] });
  await call("Customer Reviewer stale hash fails closed", projectPath, { method: "POST", cookie, persona: "CUSTOMER_COMMERCIAL_REVIEWER", body: { ...exact, proposalHash: "STALE-CIP072" }, expected: [409] });
  const accepted = (await call("Customer Reviewer accepts exact R2", projectPath, { method: "POST", cookie, persona: "CUSTOMER_COMMERCIAL_REVIEWER", body: { ...exact, comment: "Accepted in governed Customer View." } })).value;
  assert.equal(accepted.action.actorPrincipalId, "demo-principal");
  assert.equal(accepted.action.demoPersona, "CUSTOMER_COMMERCIAL_REVIEWER");
  const replay = (await call("Acceptance replay is idempotent", projectPath, { method: "POST", cookie, persona: "CUSTOMER_COMMERCIAL_REVIEWER", body: { ...exact } })).value;
  assert.equal(replay.idempotentReplay, true);

  const acceptedTwin = (await call("Internal Customer Twin projects Accepted", `/api/accounts/${encodeURIComponent(accountId)}/customer-twin`, { cookie })).value.customerTwin;
  const acceptedDeal = acceptedTwin.deals.find((item) => item.opportunityId === opportunityId);
  assert.equal(acceptedDeal.currentState, "ACCEPTED");
  assert.equal(acceptedDeal.artifactStates.proposal.state, "ACCEPTED");
  assert.equal(acceptedDeal.artifactStates.customerAcceptance.state, "COMPLETE");
  assert.equal(acceptedDeal.artifactStates.engineering.eligibility, "ELIGIBLE");
  assert.ok(acceptedDeal.permittedActions.some((item) => item.action === "SEND_TO_ENGINEERING"));

  await call("Logout after Customer acceptance", "/api/auth/logout", { method: "POST", cookie });
  const relogin = await call("Demo login after Customer acceptance", "/api/auth/login", {
    method: "POST",
    body: { username: "demo", password },
  });
  cookie = relogin.cookie;
  assert.equal(relogin.value.user.principalId, "demo-principal");
  assert.equal(relogin.value.user.organizationId, "org-demo");
  const reloginTwin = (await call("Reload Accepted Twin after logout/login", `/api/accounts/${encodeURIComponent(accountId)}/customer-twin`, { cookie })).value.customerTwin;
  const reloginDeal = reloginTwin.deals.find((item) => item.opportunityId === opportunityId);
  assert.equal(reloginDeal.currentState, "ACCEPTED");
  assert.equal(reloginDeal.artifactStates.proposal.state, "ACCEPTED");
  assert.equal(reloginDeal.artifactStates.customerAcceptance.state, "COMPLETE");

  const assembled = (await call("Assemble legitimate Draft IOF", "/api/engineering/certification/draft-packages/from-proposal", { method: "POST", cookie, body: { proposalId } })).value;
  const draft = assembled.draftPackage ?? assembled.iofPackage ?? assembled;
  assert.ok(draft.packageId);
  await call("Customer cannot invoke Send to Engineering", `/api/commercial/iof-packages/${encodeURIComponent(draft.packageId)}/submit-engineering`, {
    method: "POST", cookie, persona: "CUSTOMER_COMMERCIAL_REVIEWER", expected: [403],
  });
  const handoff = (await call("Send accepted Proposal to Engineering", `/api/commercial/iof-packages/${encodeURIComponent(draft.packageId)}/submit-engineering`, { method: "POST", cookie, expected: [200, 409] })).value;
  if (!handoff.engineeringPackage) {
    console.log(JSON.stringify({ result: "STOPPED_AT_GENUINE_ENGINEERING_HANDOFF_PREDICATE", opportunityId, proposalId, proposalRevisionId: original.proposalRevisionId, proposalHash: originalHash, predicate: handoff.predicate, error: handoff.error, trace }, null, 2));
    process.exit(2);
  }

  const finalProposal = (await call("Reload immutable Proposal R2", `/api/proposals/${encodeURIComponent(proposalId)}`, { cookie })).value.proposal;
  assert.equal(finalProposal.proposalRevisionId, original.proposalRevisionId);
  assert.equal(finalProposal.proposalHash, originalHash);
  assert.equal(finalProposal.proposalRevisions.length, originalRevisionCount);
  const finalTwin = (await call("Reload Engineering Customer Twin", `/api/accounts/${encodeURIComponent(accountId)}/customer-twin`, { cookie })).value.customerTwin;
  const finalDeal = finalTwin.deals.find((item) => item.opportunityId === opportunityId);
  assert.equal(finalDeal.currentState, "ENGINEERING");
  assert.equal(finalDeal.artifactStates.engineering.eligibility, "SUBMITTED");
  assert.equal(finalDeal.engineering.engineeringPackageId, handoff.engineeringPackage.engineeringPackageId);

  console.log(JSON.stringify({ result: "PASS", accountId, opportunityId, proposalId, proposalRevisionId: original.proposalRevisionId, proposalHash: originalHash, opportunityMateriality: internal.internalCommercialApproval.opportunityMateriality, customerReviewPackageId: submitted.customerReviewPackage.customerReviewPackageId, customerAcceptanceEvidenceId: accepted.action.customerPortalActionId, draftIofPackageId: draft.packageId, engineeringPackageId: handoff.engineeringPackage.engineeringPackageId, finalState: finalDeal.currentState, revisionCountUnchanged: true, trace }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ result: "FAIL", error: error.message, predicate: error.value?.predicate, details: error.value?.details, trace }, null, 2));
  process.exit(1);
}
