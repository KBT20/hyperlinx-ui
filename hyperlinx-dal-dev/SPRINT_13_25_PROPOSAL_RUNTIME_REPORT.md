# Sprint 13.25 - Proposal Runtime & Customer Collaboration

Status: Implemented and validated  
Commit: Not created

## Root Cause Analysis

Commercial Proposal persistence existed as a generic `/api/proposals` JSON collection. It could store snapshots and accepted-proposal records, but it did not enforce proposal ownership, customer review authority, immutable revisions, runtime evidence, runtime history, or Draft IOF readiness gates.

The critical failure was architectural: customer review users had broad update access through generic `PUT`, and proposal records were not mirrored into the Runtime Object Library as governed `PROPOSAL` objects. That made the proposal stage a persistence convenience instead of an authoritative lifecycle boundary.

## Interaction Audit

Validated lifecycle:

1. Ryan creates a Proposal Runtime Object.
2. Proposal is private and owned by Ryan.
3. Fran and Google cannot see Ryan's private draft.
4. Kyle can see as executive/admin context but cannot mutate Ryan's draft without explicit proposal authority.
5. Ryan submits the proposal to Google customer review.
6. Google sees the assigned proposal in the customer workspace.
7. Google cannot edit proposal pricing or runtime object fields.
8. Google can comment, upload evidence, request changes, and approve.
9. Ryan creates immutable revision v2 after customer feedback.
10. Google approves v2.
11. Ryan exposes Draft IOF source references.
12. No IOF Package or ScopeVersion is created.

## Implemented Runtime Model

Proposal records now include first-class runtime fields:

- `proposalId`, `proposalNumber`, `customerId`, `opportunityId`
- `organizationId`, `workspaceId`, owner/commercial owner/creator
- assigned customer users, reviewers, authority grants
- visibility, status, lifecycle state, approval state
- version and immutable version entries
- commercial assumptions, deal points, pricing, margin, confidence
- runtime object, relationship, evidence, inventory, design, twin, geometry, document references
- comments, attachments, approvals, history, readiness, next lifecycle action

Every saved proposal is mirrored into `/api/runtime/objects` as object type `PROPOSAL`.

## Customer Collaboration

Customer actions are constrained to collaboration endpoints:

- `POST /api/proposals/:id/comment`
- `POST /api/proposals/:id/upload-evidence`
- `POST /api/proposals/:id/request-changes`
- `POST /api/proposals/:id/approve`
- `POST /api/proposals/:id/reject`

Customer uploads create Runtime Evidence. Comments, revisions, approval, and Draft IOF source exposure create Runtime History.

## Draft IOF Boundary

Implemented:

- `GET /api/proposals/:id/readiness`
- `POST /api/proposals/:id/create-draft-iof-package`

The Draft IOF endpoint only exposes approved proposal source references for Sprint 13.3 assembly. It does not create an IOF Package and does not create a ScopeVersion.

## UI Surface

Commercial Planning now includes a Proposal Runtime Dashboard:

- Ryan/commercial users can save runtime proposal, submit to customer, create revision, duplicate, archive, and expose Draft IOF source.
- Customer users can comment, upload evidence, request changes, and approve.
- Dashboard displays workspace, owner, version, visibility, approval, readiness, runtime references, evidence, comments, next action, and visible proposal records.

The legacy accepted-proposal path now persists an approved Proposal Runtime Object instead of only a local accepted-proposal record.

## Validation

Command:

```bash
node proposal-runtime-validation.mjs
```

Result:

- 56 assertions passed
- Proposal final status: `READY_FOR_IOF_PACKAGE`
- Proposal final version: `2`
- Runtime Object mirror: exactly one authoritative `PROPOSAL`
- Runtime Evidence: customer upload registered
- Runtime History: comment, approval, and Draft IOF source exposure recorded
- IOF Packages created: `0`
- ScopeVersions created: `0`
- Persistence verified after logout/login and file-backed reload

Report output:

`.tmp/sprint13-25-proposal-runtime-report.json`
