# ScopeVersion Close Validation Model

Status: doctrine and read-only contracts only.

## Purpose

Close validation determines whether a close event has authority against a ScopeVersion.

Validation does not persist, mutate, route, execute, or create downstream records.

## Validation Requirements

A valid close must have:

- valid `scopeVersionId`.
- `customerId`.
- `opportunityId`.
- `corridorId`.
- known close type.
- authorized actor role.
- actor id.
- evidence ids.
- immutable status once validated.

## Validation Engine

The read-only engine defines:

- `validateScopeVersionClose()`.
- `createScopeVersionCloseDraft()`.
- `evaluateCloseAuthority()`.
- `createCloseAuditRecord()`.
- `getAllowedCloseTypesForRole()`.

## Rejection Rules

A close is rejected when:

- `scopeVersionId` is missing.
- traceability is missing.
- evidence is missing.
- actor role is not authorized.
- close type is unknown.
- `AI_ASSISTANT_ADVISORY` attempts validation.
- a validated close is not immutable.

## Diagnostics

Supported diagnostics:

- `SCOPEVERSION_CLOSE_DRAFT_CREATED`.
- `SCOPEVERSION_CLOSE_VALIDATION_STARTED`.
- `SCOPEVERSION_CLOSE_AUTHORITY_CHECKED`.
- `SCOPEVERSION_CLOSE_VALIDATED`.
- `SCOPEVERSION_CLOSE_REJECTED`.
- `SCOPEVERSION_CLOSE_AUDIT_RECORD_CREATED`.
- `SCOPEVERSION_CLOSE_WARNING`.

