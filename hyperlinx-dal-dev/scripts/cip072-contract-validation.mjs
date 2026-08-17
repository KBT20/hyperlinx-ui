import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { deriveArtifactStates } from "../server/routes/customer-account-twin.js";

const proposal = {
  proposalId: "DEMO-PROP-CIP072",
  proposalRevisionId: "DEMO-PROP-CIP072-revision-2",
  proposalHash: "HASH-CIP072-R2",
  status: "WAITING_CUSTOMER_REVIEW",
};
const reviewPackage = {
  customerReviewPackageId: "CUSTOMER-REVIEW-DEMO-CIP072",
  accountId: "ACCOUNT-DEMO-NORTHSTAR",
  opportunityId: "DEMO-OPP-CIP072",
  proposalId: proposal.proposalId,
  proposalRevisionId: proposal.proposalRevisionId,
  proposalHash: proposal.proposalHash,
};

const submitted = deriveArtifactStates({ proposal, reviewPackage });
assert.equal(submitted.proposal.state, "SUBMITTED");
assert.equal(submitted.customerReview.state, "ACTIVE");
assert.equal(submitted.customerAcceptance.state, "PENDING");
assert.equal(submitted.engineering.eligibility, "NOT_ELIGIBLE");

const stale = deriveArtifactStates({ proposal, reviewPackage, portalActions: [{ action: "ACCEPT", proposalRevisionId: proposal.proposalRevisionId, proposalHash: "STALE" }] });
assert.equal(stale.proposal.state, "SUBMITTED");
assert.equal(stale.engineering.eligibility, "NOT_ELIGIBLE");

const accepted = deriveArtifactStates({ proposal, reviewPackage, portalActions: [{ customerPortalActionId: "ACTION-CIP072", action: "ACCEPT", proposalRevisionId: proposal.proposalRevisionId, proposalHash: proposal.proposalHash }] });
assert.equal(accepted.proposal.state, "ACCEPTED");
assert.equal(accepted.customerReview.state, "COMPLETE");
assert.equal(accepted.customerAcceptance.state, "COMPLETE");
assert.equal(accepted.engineering.eligibility, "ELIGIBLE");

const proposalRoute = await readFile(new URL("../server/routes/proposal-drafts.js", import.meta.url), "utf8");
assert.match(proposalRoute, /exact Internal Commercial Review approval is required/);
assert.match(proposalRoute, /assessOpportunityStateBinding\(existing, \{ requireCurrent: true \}\)/);
assert.match(proposalRoute, /materiality\?\.decision !== "NON_MATERIAL"/);
assert.match(proposalRoute, /internal-commercial-approve/);

const portalRoute = await readFile(new URL("../server/routes/customer-portal.js", import.meta.url), "utf8");
assert.match(portalRoute, /text\(body\.accountId\) === text\(reviewPackage\.accountId\)/);
assert.match(portalRoute, /text\(body\.opportunityId\) === text\(reviewPackage\.opportunityId\)/);

console.log(JSON.stringify({
  result: "PASS",
  submitted: {
    proposal: submitted.proposal.state,
    customerReview: submitted.customerReview.state,
    customerAcceptance: submitted.customerAcceptance.state,
    engineeringEligibility: submitted.engineering.eligibility,
  },
  accepted: {
    proposal: accepted.proposal.state,
    customerReview: accepted.customerReview.state,
    customerAcceptance: accepted.customerAcceptance.state,
    engineeringEligibility: accepted.engineering.eligibility,
  },
  staleAcceptance: "FAIL_CLOSED",
}, null, 2));
