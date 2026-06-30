# Commercial To Runtime Sequence

Status: Sprint 13.6 Runtime Sequence

## Quote Ready

When Commercial Planning reaches `QUOTE_READY_FOR_CUSTOMER`, the Runtime Lifecycle Bridge verifies or creates:

- Customer Twin Runtime Object
- Commercial Opportunity Runtime Object
- Commercial Draft Runtime Object
- Proposal Runtime Object
- Customer Review Task
- Customer Workspace Notification
- Runtime Relationships
- Assignment Evidence
- Runtime History

## Customer Review

The Proposal is submitted with:

- `status`: `AWAITING_CUSTOMER_REVIEW`
- `approvalState`: `CUSTOMER_REVIEW`
- `visibility`: `SHARED`
- `immutableAfterSubmission`: `true`
- `commercialEditFrozen`: `true`

The customer receives a workspace assignment and notification.

## Approval Bridge

Customer approval records:

- `CUSTOMER_APPROVED`

Then the existing Engineering Certification assembly engine creates or reconnects:

- Draft IOF Package
- Manifest
- Readiness
- Validation
- Dependency Graph
- Engineering Review Queue item

## Runtime History Order

The expected lifecycle event sequence is:

1. `CUSTOMER_TWIN_READY`
2. `COMMERCIAL_OPPORTUNITY_CREATED`
3. `COMMERCIAL_DRAFT_CREATED`
4. `PROPOSAL_CREATED`
5. `PROPOSAL_SUBMITTED`
6. `PROPOSAL_ASSIGNED`
7. `CUSTOMER_REVIEW_STARTED`
8. `CUSTOMER_APPROVED`
9. `DRAFT_IOF_PACKAGE_CREATED`
10. `ENGINEERING_REVIEW_QUEUED`

## Boundary

This sequence stops at Engineering Review Queue.

It does not create Marketplace, Contracts, Control, Field, Operational Intelligence, or ScopeVersion authority.

