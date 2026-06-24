# ScopeVersion Lifecycle Audit Model

Status: doctrine and read-only audit contract.

## Purpose

Lifecycle audit records preserve why a transition was approved or rejected.

They allow lifecycle replay without relying on UI state, console logs, or inferred workspace behavior.

## Audit Fields

A lifecycle audit records:

- `auditId`.
- `scopeVersionId`.
- previous state.
- requested state.
- required closes.
- validated closes.
- transition authority.
- actor id.
- actor role.
- timestamp.
- result.
- diagnostics.

## Diagnostic Events

Lifecycle evaluation may emit:

- `[LIFECYCLE_TRANSITION_EVALUATED]`
- `[LIFECYCLE_TRANSITION_APPROVED]`
- `[LIFECYCLE_TRANSITION_REJECTED]`
- `[LIFECYCLE_REQUIREMENT_MISSING]`
- `[LIFECYCLE_AUDIT_CREATED]`

## Replay Doctrine

Lifecycle replay must use:

1. ScopeVersion state.
2. validated close events.
3. transition authority registry.
4. lifecycle audits.

It may not use recommendation text, map display state, transient UI selections, or reasoning output as authority.

