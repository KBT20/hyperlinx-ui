# Corridor Promotion Gate

Status: doctrine and read-only engine skeleton.

## Promotion States

```text
DRAFT
EVIDENCE_COLLECTING
EVIDENCE_READY
ENGINEERING_REVIEW
PROMOTION_READY
PROMOTED
REJECTED
SUPERSEDED
```

## Promotion State Meaning

| State | Meaning |
| --- | --- |
| DRAFT | Initial development object exists |
| EVIDENCE_COLLECTING | Required evidence or assumptions are missing |
| EVIDENCE_READY | Evidence is complete enough for review |
| ENGINEERING_REVIEW | Awaiting human engineering approval |
| PROMOTION_READY | Human-approved and ready to create a draft |
| PROMOTED | Draft was promoted in a later persistence phase |
| REJECTED | Human review rejected the candidate |
| SUPERSEDED | A newer route candidate replaced this promotion |

## Blocking Conditions

Promotion is blocked by:

- missing A endpoint.
- missing Z endpoint.
- invalid endpoint coordinates.
- missing endpoint confidence.
- missing customer requirement.
- no route candidate selected.
- invalid route geometry.
- route confidence below threshold.
- unresolved high severity constraint.
- unresolved fatal permitting risk.
- missing conduit count assumption.
- missing fiber count assumption.
- missing optical/transport assumption when transport service is requested.
- missing human engineering approval.
- duplicate active ScopeVersion for the same corridor candidate.

## Warning Conditions

Promotion may warn, but not necessarily block, for:

- no crossings identified.
- weak monetization evidence.
- missing residual capacity estimate.
- missing maintenance model detail.
- incomplete restoration service zone evidence.

## Gate Output

The gate returns:

- promotion status.
- ready/not ready.
- blockers.
- warnings.
- satisfied evidence IDs.
- missing evidence requirements.

The gate does not persist anything.

## Engine Reference

Read-only implementation:

- `src/corridor/corridorPromotion.ts`
- `src/corridor/CorridorPromotionEngine.ts`

Diagnostics:

- `[CORRIDOR_PROMOTION_EVALUATION]`
- `[CORRIDOR_PROMOTION_BLOCKER]`
- `[CORRIDOR_PROMOTION_READY]`
- `[CORRIDOR_SCOPEVERSION_DRAFT_CREATED]`

