# IOF Package Assembly Engine

Status: Sprint 13.5 Runtime Model

The IOF Package Assembly Engine turns a customer-approved Proposal Runtime Object into a Draft IOF Package for Engineering review.

It is a bridge, not an execution system. It does not create Marketplace, Contract, SOF, SOW, Control, Field, or Operational Intelligence artifacts.

## Runtime Path

1. Commercial creates and maintains the Proposal Runtime Object.
2. Customer approves the Proposal.
3. Runtime assembles a Draft IOF Package from proposal references.
4. Engineering receives the package in the Engineering Review Queue.
5. Engineering assigns, reviews, certifies units, or returns the package to Commercial.

## Assembly Inputs

- Proposal
- Customer
- Opportunity
- Existing Inventory references
- Customer Design Request references
- Customer Twin reference
- Geometry references
- Runtime Object references
- Relationship references
- Evidence references
- Commercial assumptions
- Customer requests
- Proposal document references

## Assembly Outputs

- Draft IOF Package
- Manifest
- Dependency Graph
- Readiness model
- Validation model
- Proposed IOF Units
- Package differences
- Runtime History events
- Runtime Object mirror

## Authority Rules

- The package is organization visible by default.
- The package authority is Engineering Review.
- The package owns no independent data copies.
- Manifest entries reference Runtime Objects and supporting runtime libraries.
- ScopeVersion authority is not created during Draft IOF Package assembly.

## Runtime Endpoints

- `POST /api/engineering/certification/draft-packages/from-proposal`
- `GET /api/engineering/certification/queue`
- `GET /api/engineering/certification/draft-packages/:packageId`
- `GET /api/engineering/certification/draft-packages/:packageId/manifest`
- `GET /api/engineering/certification/draft-packages/:packageId/graph`
- `GET /api/engineering/certification/draft-packages/:packageId/readiness`
- `GET /api/engineering/certification/draft-packages/:packageId/differences`
- `POST /api/engineering/certification/draft-packages/:packageId/assign-engineer`
- `POST /api/engineering/certification/draft-packages/:packageId/return-commercial`

