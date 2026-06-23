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

## Implementation Reference

- `src/corridor/PrismDecisionHierarchy.ts`

