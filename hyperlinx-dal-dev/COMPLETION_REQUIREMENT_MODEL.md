# Completion Requirement Model

Status: doctrine and contract alignment.

## Required Requirement Families

Completion requirements are grouped as:

- ScopeVersion traceability.
- lifecycle state.
- Field close evidence.
- Work Package closure.
- Object closure.
- Station closure.
- Segment closure.
- Deliverable closure.
- acceptance criteria.
- blocker review.

## Requirement Semantics

Required Work Packages, Objects, Stations, Segments, and Deliverables are considered closed only when they are referenced by validated `FIELD_CLOSE` evidence or, for deliverables, accepted completion evidence.

`FIELD_CLOSE` must be:

- attached to the same `scopeVersionId`.
- immutable.
- validated.
- traceable to customer, opportunity, and corridor.

## Readiness Status

Completion status values are:

- `NOT_READY`
- `REVIEW_REQUIRED`
- `READY_FOR_COMPLETION`
- `COMPLETE`

Critical and high-severity blockers produce `NOT_READY`.

Low and medium blockers produce `REVIEW_REQUIRED`.

No blockers produces `READY_FOR_COMPLETION`.

Validated `COMPLETION_CLOSE` and approved lifecycle transition produce `COMPLETE`.

