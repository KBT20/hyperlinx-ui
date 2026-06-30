# Runtime Lifecycle Bridge

Status: Sprint 13.6 Runtime Model

The Runtime Lifecycle Bridge connects Commercial Planning to the governed Runtime lifecycle.

It does not add Marketplace, Contracts, Control, Field, or Operational Intelligence. It only coordinates existing Runtime services so the lifecycle advances continuously without users manually creating hidden runtime objects.

## Runtime-Owned Path

1. Customer Twin
2. Commercial Opportunity
3. Commercial Draft
4. Proposal
5. Customer Review
6. Draft IOF Package
7. Engineering Queue

Engineering Certification, Certified IOF Package, Execution Authorization, and executable ScopeVersion remain governed by the Engineering Certification model.

## Orchestrator

The orchestrator is exposed through:

- `POST /api/runtime/lifecycle/advance`
- `GET /api/runtime/lifecycle/state`

The orchestrator coordinates existing services:

- Opportunity Library
- Proposal Runtime Library
- Engineering Certification Draft IOF assembly
- Runtime Object Library
- Relationship Graph
- Evidence Registry
- Activity History
- Runtime Workspaces

It does not duplicate business logic from those services.

## Idempotence

If an object already exists, the bridge reconnects to it.

If a relationship is missing, the bridge repairs it.

If a notification or review task already exists, the bridge reuses the deterministic runtime object ID.

The bridge uses deterministic identifiers for:

- Commercial Draft Runtime Object
- Customer Review Task
- Runtime Relationships
- Assignment Evidence
- Draft IOF Package

## Authority

- Commercial owns Opportunity, Commercial Draft, and Proposal generation.
- Customer Review owns the assigned review task.
- Customer approval triggers Draft IOF Package assembly.
- Engineering receives the Draft IOF Package in the Engineering Review Queue.
- ScopeVersion is not created by this bridge.

