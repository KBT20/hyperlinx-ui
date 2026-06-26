# Proposed Network Visualization Doctrine

Proposed Network Visualization is the customer-facing visual bridge between Design and Preliminary Proposal.

It displays the canonical `ProposedGraph` that emerges from Design Launch context, but it does not create engineering authority.

## Doctrine

Design produces the `ProposedGraph` context.

Visualization displays the same `ProposedGraph` instance.

Preliminary Proposal documents and commercializes the same `ProposedGraph` instance.

Route Engineering validates only after customer acceptance.

## Boundary

This workspace may:

- display fixture-provided proposed nodes
- display fixture-provided proposed segments
- display fixture-provided vaults and regeneration sites
- support pan, zoom, node selection, and segment selection
- mark customer visual review complete in local UI state

This workspace may not:

- create routes
- calculate geometry
- mutate geometry
- create ScopeVersions
- mutate Inventory Graphs
- modify lifecycle or execution authority
- persist review state
