# Layer 1 Design Doctrine Engine

Phase 7.0A establishes deterministic Layer 1 design doctrine before route generation.

## Doctrine

A route is never generated in a vacuum. The selected network class determines topology, protection, construction assumptions, infrastructure assumptions, facility spacing, material defaults, and future routing constraints.

The Design Doctrine Engine is advisory and deterministic. It does not route, create geometry, station routes, certify engineering, create ScopeVersions, mutate inventory, persist records, or call APIs.

## Supported Network Classes

- `LONG_HAUL`
- `MIDDLE_MILE`
- `METRO`
- `CAMPUS`

## Protection Classes

The doctrine layer uses canonical protection classes:

- `NONE`
- `PATH_PROTECTED`
- `RING_PROTECTED`
- `MESH_PROTECTED`

Legacy intake values are compatibility inputs only:

- `LINEAR` normalizes to the class default.
- `DIVERSE` normalizes to `PATH_PROTECTED`.
- `RING` normalizes to `RING_PROTECTED`.

Customer-facing doctrine surfaces should not display `DIVERSE` unless future phases create multiple geographically independent route candidates.

## ProposedGraph Relationship

`ProposedGraph` now carries:

- `designDoctrineId`
- `networkClass`
- `topology`
- `protectionClass`

Visualization and Proposal continue to consume the same canonical `ProposedGraph`; they do not recreate doctrine or network objects independently.

## Boundaries

Phase 7.0A does not implement routing, pathfinding, OSRM, stationing, engineering certification, ScopeVersion creation, inventory mutation, persistence, APIs, Marketplace, Control, Field, Twin, or Operational Intelligence changes.
