# Contract and SOF Blocker Model

Status: doctrine and read-only blocker contract.

## Purpose

Blockers explain why a ScopeVersion is not ready, or why human review is required before SOF or contract generation.

## Status Values

Readiness statuses:

- `NOT_READY`
- `REVIEW_REQUIRED`
- `READY`

## Blocker Severity

High-severity blockers produce `NOT_READY`.

Medium and low-severity blockers produce `REVIEW_REQUIRED`.

No blockers produces `READY`.

## Blocker Types

Blockers include:

- missing engineering close.
- missing budget close.
- missing vendor acceptance close.
- missing customer acceptance close.
- missing locked budget.
- missing customer legal profile.
- missing billing profile.
- missing product plan.
- missing approved object package.
- unresolved high-severity risk.
- unresolved design standard exception.
- lifecycle state too early.
- AI advisory-only recommendation.

## Boundary

Blockers are explanatory diagnostics.

They do not mutate ScopeVersion state.

They do not create closes.

They do not generate legal artifacts.

