# Field Blocker Model

Status: doctrine and read-only blocker contract.

## Purpose

Field blockers explain why Field execution authority may not be activated.

## Blocker Severity

Field blockers use:

- `LOW`
- `MEDIUM`
- `HIGH`
- `CRITICAL`

Critical and high blockers produce `NOT_READY`.

Medium and low blockers produce `REVIEW_REQUIRED`.

No blockers produce `FIELD_READY`.

## Supported Blockers

Field blockers include:

- missing `CONTROL_ACTIVE`.
- missing Work Packages.
- missing station allocations.
- missing segment allocations.
- missing object allocations.
- missing vendor allocations.
- missing execution package.
- missing dependency.
- invalid lifecycle state.
- missing `scopeVersionId`.
- unresolved critical risk.
- AI advisory recommendation.

## Boundary

Blockers do not mutate ScopeVersion state.

Blockers do not perform Field closure.

Blockers do not create completion or operations authority.

