# Field Segment Close Model

Status: doctrine and read-only closure model.

## Purpose

Segment closure records completion evidence for approved segment allocations.

## Required References

Segment closure requires:

- `scopeVersionId`.
- approved Work Package.
- segment ids.
- closure evidence.
- actor identity.
- timestamp.

## Boundary

Segment closure creates evidence.

It does not mark the ScopeVersion complete.

It does not alter segment truth until validated and consumed by future authority.

