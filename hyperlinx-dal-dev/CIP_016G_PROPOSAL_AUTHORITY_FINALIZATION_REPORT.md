# CIP-016G Proposal Authority Finalization Report

Date: 2026-07-07

## Objective

Finalize Proposal constitutional authority without adding new functionality and without modifying Engineering Certification, ScopeVersion, Marketplace, Control, or Field.

The Proposal Repository is the single authority for proposal state transitions. Commercial UI projections, Opportunity preview fields, Accepted Proposal projections, and runtime bridge state may display context, but they do not own proposal approval state.

## Canonical Authority

Proposal authority now lives in:

`server/data/proposal-drafts/*.json`

## Transition Table

The canonical Proposal Repository transition table is:

1. `DRAFT`
2. `WAITING_CUSTOMER_REVIEW`
3. `CUSTOMER_REVIEW`
4. `COMMERCIAL_APPROVED`
5. `ENGINEERING_SUBMITTED`

Legacy values are normalized on read only:

- `COMMERCIAL_DRAFT` -> `DRAFT`
- `CUSTOMER_COMMENTS` / `IN_CUSTOMER_REVIEW` -> `CUSTOMER_REVIEW`
- `CUSTOMER_APPROVED` / `READY_FOR_IOF_PACKAGE` -> `COMMERCIAL_APPROVED`
- `SUBMITTED_TO_ENGINEERING` -> `ENGINEERING_SUBMITTED`

## Root Cause

Google Opportunity 12 displayed customer approval from non-authoritative projections:

- Opportunity preview status: `CUSTOMER_ACCEPTED`
- Commercial dashboard status: Proposal ready
- Proposal Repository record: `WAITING_CUSTOMER_REVIEW`

The approval endpoint was returning HTTP 403 because the decision trace required customer reviewer authority only. Kyle had Commercial proposal authority, but the rule did not consider Commercial authority valid for this final approval action.

The exact denied record was:

`server/data/proposal-drafts/ACCEPTED-PROPOSAL-google-1783379652948.json`

Before repair:

- `proposalId`: `ACCEPTED-PROPOSAL-google-1783379652948`
- `opportunityId`: `OPP-GOOGLE-DFW-ROUTE-12-1783379466306`
- `status`: `WAITING_CUSTOMER_REVIEW`
- `approvalState`: `CUSTOMER_REVIEW`
- `commercialOwnerId`: `teralinx-user-kyle`
- `assignedCustomerUsers`: `google-participant-001`

## Repairs

Proposal approval now accepts either:

- assigned customer reviewer authority, or
- Commercial proposal authority

Approval still requires the Proposal Repository status to be:

- `WAITING_CUSTOMER_REVIEW`, or
- `CUSTOMER_REVIEW`

The UI no longer creates a new `ACCEPTED-PROPOSAL-*` authority record when the operator accepts a proposal. That action delegates to `POST /api/proposals/:proposalId/approve`.

The UI no longer calls the `CUSTOMER_APPROVED` runtime lifecycle bridge as part of proposal approval.

Engineering submission now requires the Proposal Repository to report:

`COMMERCIAL_APPROVED`

The Draft IOF package produced for Google Opportunity 12 had Proposal and Route Repository references but did not yet contain the station-aware package projections required by the existing submit validator. The repair hydrates those Draft IOF package projections from the persisted Route Repository geometry and hash during approval and defensively during submit.

This does not run OSRM, pricing, workbook generation, proposal regeneration, inventory creation, or ScopeVersion creation.

After successful Engineering submission, the submit path writes:

`ENGINEERING_SUBMITTED`

back to the Proposal Repository.

## Duplicate Authority Cleanup

Duplicate projections remain readable for historical context, but they are not authority:

- Accepted Proposal projections
- Opportunity proposal preview fields
- Customer review UI state
- Commercial dashboard labels
- Runtime lifecycle bridge state

The authority write path is now:

Proposal Repository approval -> Draft IOF reference enrichment -> Engineering Package submit -> Proposal Repository `ENGINEERING_SUBMITTED`

## Google Opportunity 12

Google Opportunity 12 is validated by:

`node cip016g-proposal-authority-finalization-validation.mjs`

The validation opens the Opportunity, resolves the Proposal Repository record, approves it through the proposal endpoint when needed, submits the Draft IOF Package to Engineering when needed, and verifies the Engineering Package is persisted.

No manual JSON edits are required.

## ScopeVersion Boundary

CIP-016G does not create ScopeVersion.

ScopeVersion remains blocked until signed Service Order authority exists.

## Files Modified

- `server/routes/proposal-drafts.js`
- `server/routes/commercial-iof-packages.js`
- `src/components/workspaces/GoogleRfpWorkspace.tsx`
- `cip016g-proposal-authority-finalization-validation.mjs`
- `CIP_016G_PROPOSAL_AUTHORITY_FINALIZATION_REPORT.md`

## Validation Results

Validation script:

`node cip016g-proposal-authority-finalization-validation.mjs`

Result:

`PASS`

The script verified:

- Google Opportunity 12 restored from the Opportunity Repository.
- Proposal approval no longer returned HTTP 403.
- Proposal Repository final state became `ENGINEERING_SUBMITTED`.
- Engineering Package persisted as reference-only.
- Commercial Opportunity became `SUBMITTED_TO_ENGINEERING`.
- No ScopeVersion was created.
- No manual JSON edit was required.

TypeScript:

`npx tsc --noEmit -p tsconfig.json`

Result:

`PASS`

Production build:

`npm run build`

Result:

`PASS`

Diff whitespace:

`git diff --check`

Result:

`PASS`

Note: Git reported existing CRLF normalization warnings in the working copy, but no whitespace errors.
