# Control Blocker Model

Status: doctrine and read-only blocker contract.

## Purpose

Control blockers explain why a ScopeVersion may not enter execution authority.

## Blocker Severity

Blocker severity:

- `LOW`
- `MEDIUM`
- `HIGH`
- `CRITICAL`

Critical and high blockers produce `NOT_READY`.

Medium and low blockers produce `REVIEW_REQUIRED`.

No blockers produce `CONTROL_READY`.

## Supported Blockers

Control blockers include:

- missing contract close.
- missing engineering package.
- missing budget.
- missing vendor acceptance.
- missing object package.
- missing execution strategy.
- missing design standard approval.
- missing reference architecture.
- invalid lifecycle state.
- missing `scopeVersionId`.
- unresolved critical risk.
- AI advisory-only recommendation.

## Boundary

Blockers do not mutate ScopeVersion state.

Blockers do not generate work packages.

Blockers do not create schedules.

