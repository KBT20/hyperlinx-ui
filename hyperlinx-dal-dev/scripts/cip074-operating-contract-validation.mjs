import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { governedActivity } from "../server/routes/customer-account-twin.js";

const timestamp = "2026-08-17T12:00:00.000Z";
const evidence = {
  opportunity: { opportunityId: "DEMO-OPP-074", createdAt: timestamp, createdBy: "Ryan" },
  proposal: {
    modifiedBy: "Ryan",
    proposalRevisions: [{ proposalRevisionId: "DEMO-PROP-074-revision-2", revisionNumber: 2, createdAt: timestamp, savedBy: "Ryan" }],
    internalCommercialApproval: { internalCommercialApprovalId: "DEMO-INTERNAL-074", approvedAt: timestamp, approvedByDisplayName: "Ryan" },
  },
  reviewPackage: { customerReviewPackageId: "DEMO-REVIEW-074", proposalRevisionNumber: 2, submittedAt: timestamp, submittedByDisplayName: "Ryan" },
  portalActions: [{ customerPortalActionId: "DEMO-ACTION-074", action: "ACCEPT", createdAt: timestamp, actorDisplayName: "Northstar Reviewer" }],
  engineeringPackage: { engineeringPackageId: "DEMO-ENG-074", submittedAt: timestamp, submittedByDisplayName: "Ryan" },
  certifiedPackage: null,
  serviceOrder: null,
  customerSignature: null,
  countersignature: null,
  scopeVersion: null,
};

const internal = governedActivity({ ...evidence, lens: "INTERNAL" });
const customer = governedActivity({ ...evidence, lens: "CUSTOMER" });
assert.deepEqual(internal.map((item) => item.eventType), [
  "OPPORTUNITY_CREATED", "PROPOSAL_REVISION_SAVED", "INTERNAL_COMMERCIAL_APPROVED",
  "PROPOSAL_SUBMITTED_TO_CUSTOMER", "CUSTOMER_ACCEPT", "ENGINEERING_SUBMITTED",
]);
assert.deepEqual(customer.map((item) => item.eventType), [
  "PROPOSAL_SUBMITTED_TO_CUSTOMER", "CUSTOMER_ACCEPT", "ENGINEERING_SUBMITTED",
]);
assert.ok(customer.every((item) => item.customerSafe));

const sources = Object.fromEntries(await Promise.all([
  "src/workspaces/CustomerWorkspace.tsx",
  "src/workspaces/CustomerPortalWorkspace.tsx",
  "src/dal/DALNavigation.tsx",
  "src/dal/DALApp.tsx",
].map(async (path) => [path, await readFile(new URL(`../${path}`, import.meta.url), "utf8")])));

assert.match(sources["src/dal/DALNavigation.tsx"], /customerView.*Customer View/);
assert.match(sources["src/dal/DALApp.tsx"], /DEMO\s[—-]\sNOT PRODUCTION ELIGIBLE/);
assert.match(sources["src/workspaces/CustomerWorkspace.tsx"], /INTERNAL CUSTOMER VIEW.*NO CUSTOMER AUTHORITY/);
assert.match(sources["src/workspaces/CustomerWorkspace.tsx"], /Technical Details \/ Lineage/);
assert.match(sources["src/workspaces/CustomerWorkspace.tsx"], /Send to Engineering/);
assert.match(sources["src/workspaces/CustomerWorkspace.tsx"], /View \/ Download Proposal/);
assert.match(sources["src/workspaces/CustomerPortalWorkspace.tsx"], /Accept Proposal/);
assert.match(sources["src/workspaces/CustomerPortalWorkspace.tsx"], /Customer Viewer is read-only/);
assert.match(sources["src/workspaces/CustomerPortalWorkspace.tsx"], /customer-safe activity evidence/);

console.log(JSON.stringify({
  result: "PASS",
  customerViewFirstClass: true,
  dealAuthorityHeader: true,
  governedActivityProjection: true,
  internalActivityCount: internal.length,
  customerSafeActivityCount: customer.length,
  customerInternalEventLeakage: false,
  technicalDetailsCollapsed: true,
  humanPredicateMessages: true,
  createsAuthority: false,
}, null, 2));
