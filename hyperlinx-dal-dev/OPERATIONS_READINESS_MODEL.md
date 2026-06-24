# Operations Readiness Model

Status: doctrine and contract alignment.

## Required Readiness Families

Operations readiness requires:

- ScopeVersion traceability.
- lifecycle state `COMPLETE`.
- validated `COMPLETION_CLOSE`.
- operational owner.
- support owner.
- maintenance owner.
- asset inventory reference.
- service inventory reference.
- required documentation.
- required turnover package.
- operational acceptance criteria.
- no unresolved critical blockers.

## Status Values

Operations status values are:

- `NOT_READY`
- `REVIEW_REQUIRED`
- `READY_FOR_OPERATIONS`
- `OPERATIONS_ACTIVE`

Critical and high-severity blockers produce `NOT_READY`.

Low and medium blockers produce `REVIEW_REQUIRED`.

No blockers produces `READY_FOR_OPERATIONS`.

Validated `OPERATIONS_CLOSE` and approved lifecycle transition produce `OPERATIONS_ACTIVE`.

