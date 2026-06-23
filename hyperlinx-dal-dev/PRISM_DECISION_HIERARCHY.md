# Prism Decision Hierarchy

Status: doctrine and contract only. No scoring implementation.

## Constitutional Rule

Prism is not a route scorer.

Prism is a corridor decision engine.

Prism evaluates infrastructure opportunities the way infrastructure operators, carriers, hyperscalers, utilities, and investors evaluate them: through ordered decision layers, not a single flat score.

## Decision Chain

```text
EnrichedCorridorCandidate
  -> Prism Decision Hierarchy
  -> future layer scoring
  -> future recommendation
  -> Promotion Gate
  -> Route Engineering
```

## Authority Boundary

Prism may evaluate and recommend in future phases. Prism does not approve executable truth.

Route Engineering remains authoritative.

ScopeVersion creation remains outside this phase.

## Layer Doctrine

Decision layers are:

1. Hard Exclusions.
2. Strategic Fit.
3. Commercial Potential.
4. Engineering Feasibility.
5. Optimization.

Layer order matters. A lower layer may not rescue a candidate that fails a higher layer.

## Object-Driven Evaluation

Prism evaluates corridors through the objects they contain.

Objects can indicate:

- strategic fit.
- commercial potential.
- engineering feasibility.
- optimization value.
- hard exclusion risk.

Examples:

- `SUBSTATION` and `TRANSMISSION_LINE` support AI fabric strategic fit.
- `DATA_CENTER`, `CARRIER_HOTEL`, `IX`, and `CLOUD_ONRAMP` support interconnection and commercial potential.
- `CONDUIT`, `FIBER`, and `FIBER_PAIR` support residual capacity and productization.
- `CROSSING`, `JURISDICTION`, `PERMIT_ZONE`, and `ENVIRONMENTAL_AREA` affect engineering feasibility and hard exclusion review.

Canonical object definitions live in:

- `src/corridor/CorridorObjectCatalog.ts`

Objects remain evidence. They do not create authority.

## Phase 6.3A Scoring Relationship

Phase 6.3A implements advisory category scoring inside the hierarchy context.

The scoring engine may produce category observations for:

- infrastructure.
- power.
- interconnection.
- commercial.
- AI.
- strategic.
- engineering.
- optimization.

The hierarchy still governs future recommendation behavior. A score is not a recommendation.

## Lens-Driven Decision Context

Corridor Lenses shape which objects, evidence, providers, and scoring categories matter for a specific commercial or strategic view.

The same corridor can be:

- power-critical under `HYPERSCALER`.
- optimization-critical under `TRANSPORT`.
- commercial/infrastructure-critical under `DUCT_MONETIZATION`.
- handoff-critical under `INTERCONNECTION`.

The hierarchy still governs decision behavior. The lens changes context, not truth.

## Implementation Reference

- `src/corridor/PrismDecisionHierarchy.ts`
## Corridor Design Standards Context

Prism decisions must consider applicable Corridor Design Standards before scoring or future recommendations are treated as meaningful.

Decision priority should account for:

1. lens
2. reference architecture
3. networkRole
4. customer requirement
5. commercial product
6. applicable object and lens design standards

Prism may evaluate evidence and surface concerns.

Prism may not approve regen spacing, ADM placement, optical reach, restoration design, capacity availability, or engineering feasibility.

Route Engineering remains the authority.

## Prism Recommendation Boundary

Prism Recommendation consumes the decision hierarchy but remains advisory.

Human review is required before any Route Engineering handoff can be considered ready.

Object population plans are draft-only until reviewed.

Route Engineering remains authority.
