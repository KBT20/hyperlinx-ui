# Corridor Lens Doctrine

Status: doctrine and contract only.

## Core Doctrine

The corridor does not change.

The lens changes what matters.

A single corridor may be evaluated through hyperscaler, neocloud, enterprise, duct monetization, dark fiber IRU, transport, interconnection, power/AI expansion, municipal, utility, or carrier wholesale lenses.

## Purpose

A Corridor Lens determines:

- objects to discover.
- providers to prioritize.
- evidence categories to request.
- scoring categories to emphasize.
- monetization opportunities to evaluate.
- risks to elevate.
- recommendation context for a future recommendation engine.

## Authority Boundary

Lens output remains advisory.

Human review remains required.

Route Engineering remains authoritative.

## Prism Recommendation Relationship

Lens context guides Prism Recommendation.

The lens determines which objects, providers, scoring categories, products, and risks matter.

Prism Recommendation may suggest object population plans and product plans from lens context.

Those plans are draft-only until reviewed.

Route Engineering remains authoritative.

Lenses do not:

- change corridor truth.
- score candidates directly.
- create recommendations.
- call providers.
- persist state.
- create ScopeVersions.
- modify kernel or execution contracts.

## Implementation Reference

- `src/corridor/CorridorLens.ts`
- `src/corridor/CorridorLensRegistry.ts`
- `src/corridor/fixtures/corridorLensFixtures.ts`
## Design Standards Relationship

A Corridor Lens determines what matters.

Reference Architecture determines what must be considered for the customer ask.

Corridor Design Standards determine what those objects require.

For example, the HYPERSCALER lens may prioritize REGEN_SITE, SUBSTATION, DATA_CENTER, CONDUIT, and FIBER objects. The design standards define the optical, power, handoff, capacity, maintenance, and restoration questions those objects raise.

Lens output remains advisory.

Reference Architecture output remains advisory.

Design standards provide review context.

Route Engineering remains authoritative.
