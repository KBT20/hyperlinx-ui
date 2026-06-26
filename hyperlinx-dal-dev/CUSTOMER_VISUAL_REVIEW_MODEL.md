# Customer Visual Review Model

Customer Visual Review is display-only.

The review lets a customer, salesperson, and engineer look at the same `ProposedGraph` before any quote or engineering certification occurs.

## Supported Actions

- Open Proposal
- Back to Design
- Export Map placeholder
- Customer Review Complete

## Unsupported Actions

- editing
- redlining
- geometry changes
- routing
- ScopeVersion creation
- Inventory Graph mutation
- engineering certification

## Review Complete

`Customer Review Complete` marks the local `ProposedGraph` as `READY_FOR_ENGINEERING`. It does not certify, persist, create a ScopeVersion, or mutate inventory.
