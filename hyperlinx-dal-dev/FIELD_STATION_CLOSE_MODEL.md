# Field Station Close Model

Status: doctrine and read-only closure model.

## Purpose

Station closure records completion evidence for approved station allocations.

## Required References

Station closure requires:

- `scopeVersionId`.
- approved Work Package.
- station ids.
- closure evidence.
- actor identity.
- timestamp.

## Boundary

Station closure creates evidence.

It does not mark the ScopeVersion complete.

It does not alter station truth until validated and consumed by future authority.

