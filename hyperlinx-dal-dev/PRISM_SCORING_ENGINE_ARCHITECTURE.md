# Prism Scoring Engine Architecture

Status: Phase 6.3A implementation. Advisory scoring only.

## Objective

The Prism Scoring Engine V1 consumes corridor classification, enriched corridor candidates, the Corridor Object Catalog, and the Prism Decision Hierarchy to produce structured scored observations.

## Constitutional Rule

Prism scoring is evidence-driven and advisory.

Prism scoring does not create truth, recommendations, rankings, routes, ScopeVersions, or execution state.

Recommendations belong to Phase 6.3B.

## Input Chain

```text
CorridorClassificationResult
EnrichedCorridorCandidate
CorridorObjectCatalog
PrismDecisionHierarchy
  -> PrismScoringEngine
  -> PrismScore
```

## Output

`PrismScore` contains:

- overall score.
- category scores.
- confidence.
- warnings.
- evidence used.
- diagnostics.

No recommendation or ranking is produced.

## Implementation Reference

- `src/corridor/PrismScoreContract.ts`
- `src/corridor/PrismScoringEngine.ts`
- `src/corridor/fixtures/prismScoringFixtures.ts`
## Recommendation Engine Relationship

Prism Scoring produces scored observations.

Prism Recommendation consumes scored observations, decision hierarchy, lens context, reference architecture fit, and design standards to produce advisory recommendations.

Recommendation does not create truth.

Recommendation does not create ScopeVersions.

Human review is required.

Route Engineering remains authority.

