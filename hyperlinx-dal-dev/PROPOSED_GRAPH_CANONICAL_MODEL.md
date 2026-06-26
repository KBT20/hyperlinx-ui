# ProposedGraph Canonical Model

`ProposedGraph` is the canonical pre-engineering network object.

It represents customer intent after Design Launch and before engineering begins.

## Doctrine

The customer approves a proposed network, not a quote.

Visualization consumes `ProposedGraph`.

Proposal consumes `ProposedGraph`.

Engineering handoff references `ProposedGraph`.

Future ScopeVersion creation may use `ProposedGraph` as its parent input, but Phase 6.9E does not create ScopeVersions.

Phase 7.0A attaches Layer 1 Design Doctrine before route generation exists. Each `ProposedGraph` carries:

- `designDoctrineId`
- `networkClass`
- `topology`
- `protectionClass`

The doctrine explains how a future route should behave.

Phase 7.0B adds `RouteCandidate` as the sales-estimate geometry source for `ProposedGraph`. RouteCandidate geometry and constraints are estimated only; Route Engineering must later produce certified route truth.

## Boundaries

`ProposedGraph` is:

- read-only
- RouteCandidate-derived in Phase 7.0B
- not engineered
- not persisted
- not engineering-certified
- not stationed
- not an Inventory Graph
- not a ScopeVersion

## Readiness

Supported readiness values:

- `READY_FOR_PROPOSAL`
- `READY_FOR_ENGINEERING`
- `BLOCKED`
