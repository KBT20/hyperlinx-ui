# Deterministic Route Generation Engine

Phase 7.0B introduces the first deterministic Layer 1 sales route generation engine.

## Doctrine

Sales creates a `RouteCandidate`.

Route Engineering creates a `CertifiedRoute`.

The `RouteCandidate` is representative enough for customer discussion, preliminary proposal, and infrastructure quantification, but it is not engineering-certified or survey-grade.

## Inputs

- A Site
- Z Site
- Layer 1 Design Doctrine

## Outputs

- `RouteCandidate`
- `RouteSegment[]`
- `RouteConstraint[]`
- `EngineeringConstraintCandidate[]`
- `RouteStatistics`

## Estimated Constraints

Supported estimated constraint types:

- `MAJOR_HIGHWAY_CROSSING`
- `STATE_HIGHWAY_CROSSING`
- `RAILROAD_CROSSING`
- `RIVER_CREEK_CROSSING`
- `LARGE_WATER_BODY`
- `URBAN_AREA`
- `STEEP_TERRAIN`
- `BRIDGE_CROSSING`
- `ENVIRONMENTAL_AREA`
- `UTILITY_CORRIDOR`
- `UNKNOWN_CONSTRAINT`

All constraints are estimated and carry `engineeringStatus = PENDING_VERIFICATION` when projected as engineering candidates.

## Boundaries

This engine does not implement survey-grade routing, engineering certification, ScopeVersion creation, inventory mutation, lifecycle execution, route optimization, AI reasoning, geographic diversity, ring generation, mesh generation, Marketplace execution, Control, Field, Twin, Operational Intelligence, APIs, or persistence.
