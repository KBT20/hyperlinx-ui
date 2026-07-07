# CIP-016F Proposal Approval Decision Trace Report

Date: 2026-07-07

## Objective

Instrument `POST /api/proposals/:proposalId/approve` so every approval allow or denial produces a complete decision trace.

This sprint does not modify Engineering Repository, ScopeVersion, Marketplace, Control, Field, or Commercial repository schemas.

## Approval Decision Trace

The approval endpoint now evaluates and logs:

- `proposalId`
- Proposal Repository record
- Repository status
- Approval state
- Commercial state
- Customer review state
- Engineering status
- Requested transition
- Every validation rule evaluated
- Failed rule
- Denial reason

The trace is emitted as `[ProposalApprovalDecisionTrace]` and also includes a readable `Decision Trace` text block.

## Approval Rules

The `APPROVE` transition evaluates:

- Proposal Exists
- Repository Loaded
- Customer Review Authority
- Already Approved
- Approval Eligible State

Approval is allowed only when the Proposal Repository record is in:

- `WAITING_CUSTOMER_REVIEW`
- `CUSTOMER_COMMENTS`

Successful approval still writes the canonical approved state:

`COMMERCIAL_APPROVED`

## Rejection Paths

HTTP 403 responses now return a structured body containing:

- `error`
- `denialReason`
- `decision`
- `failedRule`
- `decisionTrace`

The validation covers:

- Unauthorized reviewer
- Already approved proposal
- Proposal state mismatch

Missing Proposal Repository records return a structured `DENY` trace with HTTP 404.

## Approval Paths

The validation covers both allowed approval states:

- `WAITING_CUSTOMER_REVIEW`
- `CUSTOMER_COMMENTS`

Both paths return HTTP 200 and persist `COMMERCIAL_APPROVED`.

## Example Denial

```text
Decision Trace
--------------
Proposal Exists ............ PASS
Repository Loaded .......... PASS
Customer Review Authority .. PASS
Already Approved ........... PASS
Approval Eligible State .... FAIL
Required State ............. WAITING_CUSTOMER_REVIEW | CUSTOMER_COMMENTS
Current State .............. CUSTOMER_REVIEW
Transition ................. APPROVE

DENY
Reason:
Proposal state mismatch.
```

## Architectural Note

The proposed explicit gated pipeline is the right next visual model:

```text
Commercial Planning
Customer Review
Commercial Approval
Draft IOF Package
Engineering Certification
Service Order
Customer Signature
ScopeVersion Created
Marketplace
Control
Field
Operational Twin
```

Each stage should eventually render as green, yellow, red, or locked based on repository authority. CIP-016F does not implement that UI; it tightens the proposal approval gate so the future pipeline has deterministic state evidence to read.

## Files Modified

- `server/routes/proposal-drafts.js`
- `cip016f-proposal-approval-decision-trace-validation.mjs`
- `CIP_016F_PROPOSAL_APPROVAL_DECISION_TRACE_REPORT.md`

## Validation Results

Validation script:

`node cip016f-proposal-approval-decision-trace-validation.mjs`

Result:

`PASS`

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
