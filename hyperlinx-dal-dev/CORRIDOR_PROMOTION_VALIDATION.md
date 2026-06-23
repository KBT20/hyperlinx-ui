# Corridor Promotion Validation

Status: static TypeScript fixture validation.

## Fixture Location

`src/corridor/fixtures/corridorPromotionFixtures.ts`

Fixtures include:

- valid endpoint pair corridor.
- valid customer-supplied route candidate.
- invalid missing endpoint corridor.
- invalid missing requirement corridor.
- invalid high-risk unresolved constraint corridor.

## Valid Corridor Readiness

Expected valid fixture result:

```text
status = PROMOTION_READY
readyForPromotion = true
blockers = []
```

Required evidence satisfied:

- A endpoint.
- Z endpoint.
- endpoint confidence.
- route geometry.
- route confidence.
- customer requirement.
- jurisdiction summary.
- crossing summary.
- constraint summary.
- conduit assumption.
- fiber assumption.
- optical/transport assumption.
- human engineering approval.

## Invalid Missing Endpoint

Expected blockers:

- `MISSING_Z_ENDPOINT`

The promotion cannot proceed because A/Z endpoint roles are constitutional minimum evidence.

## Invalid Missing Requirement

Expected blockers:

- `MISSING_CUSTOMER_REQUIREMENT`

The promotion cannot proceed because a ScopeVersion draft must know the customer ask before Route Engineering receives it.

## Invalid High-Risk Constraint

Expected blockers:

- `UNRESOLVED_HIGH_SEVERITY_CONSTRAINT`

The promotion cannot proceed because unresolved high or critical constraints must be mitigated or explicitly rejected.

## Mapping Output Summary

`mapCorridorCandidateToScopeVersionDraft()` creates a safe draft object with:

- `lifecycleState = ANALYZED`
- corridor reference.
- route candidate reference.
- endpoint references.
- draft route geometry.
- requirement basis.
- infrastructure assumptions.
- risk basis.
- evidence IDs.
- promotion readiness summary.

The draft is not persisted.

## Remaining Risks Before Translate

- Translate must preserve raw and normalized evidence separately.
- Endpoint confidence must be traceable to source evidence.
- Requirement extraction must avoid inventing bandwidth, topology, or commercial intent.
- Human override must generate evidence.

## Remaining Risks Before Corridor Synthesis

- Route diversity must be backed by physical separation evidence.
- Constructability and permit risk must distinguish evidence from authority.
- Residual monetization must remain secondary to the customer design objective.
- Promotion must remain draft-only until Route Engineering approval.

