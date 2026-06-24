# Adapter Reconciliation Model

Phase: 6.7C

Reconciliation converts detected gaps into remediation recommendations.

## Reconciliation Areas

- ScopeVersion traceability
- Lifecycle vocabulary
- Close vocabulary
- Marketplace references
- Authority references
- Legacy object references

## Reconciliation Functions

- `identifyGaps()`
- `reconcileLifecycle()`
- `reconcileClosures()`
- `reconcileTraceability()`
- `generateRemediationPlan()`

## Output

Reconciliation returns:

- `AdapterGap[]`
- `AdapterRemediation[]`
- `AdapterNormalizedValue[]`
- Diagnostics

## Non-Mutation Rule

Reconciliation may state that a field can be normalized, but it may not mutate the original DAL record.
