# Completion Authority Doctrine

Status: doctrine, contracts, validation, completion evaluation, and audit only.

## Purpose

Completion Authority determines when approved delivery work is constitutionally complete.

Field closes work.

Completion Authority closes delivery.

A ScopeVersion is not complete because work was closed. A ScopeVersion is complete only when all required closure obligations, acceptance criteria, traceability requirements, and critical-blocker checks are satisfied.

## Core Doctrine

Completion Authority consumes validated `FIELD_CLOSE` events and creates `COMPLETION_CLOSE` against `scopeVersionId`.

Completion Authority requires:

- `scopeVersionId`.
- `customerId`.
- `opportunityId`.
- `corridorId`.
- lifecycle state `FIELD_ACTIVE`.
- validated `FIELD_CLOSE` evidence.
- closed required Work Packages.
- closed required Objects.
- closed required Stations.
- closed required Segments.
- closed required Deliverables.
- accepted completion criteria.
- no unresolved critical blockers.

## Authority Boundary

Completion Authority may not:

- modify contract authority.
- modify budget authority.
- modify engineering authority.
- activate operations.
- activate billing.
- recognize revenue.
- activate monitoring.
- persist records.
- create server routes.
- mutate kernel state.

## Lifecycle Alignment

The constitutional path is:

```text
FIELD_ACTIVE
  -> validated FIELD_CLOSE events
  -> READY_FOR_COMPLETION
  -> COMPLETION_REVIEW
  -> COMPLETION_CLOSE
  -> COMPLETE
```

Operations Authority consumes `COMPLETION_CLOSE`.

Operations Authority creates `OPERATIONS_CLOSE` against `scopeVersionId` after operational readiness is validated.

Operational assets remain governed through ScopeVersion authority.
