# Field Closure Audit Model

Status: doctrine and read-only audit contract.

## Purpose

Field Closure audits preserve why closure evidence was validated or rejected.

## Audit Fields

A Field Closure audit records:

- `auditId`.
- `fieldClosureId`.
- `scopeVersionId`.
- `customerId`.
- `opportunityId`.
- `corridorId`.
- closure type.
- Work Package id.
- object ids.
- station ids.
- segment ids.
- evidence ids.
- ScopeVersion close id.
- blocker ids.
- timestamp.
- diagnostics.

## Diagnostic Events

Field Closure may emit:

- `[FIELD_CLOSURE_STARTED]`
- `[FIELD_CLOSURE_VALIDATED]`
- `[FIELD_CLOSURE_REJECTED]`
- `[FIELD_CLOSURE_BLOCKER_IDENTIFIED]`
- `[FIELD_CLOSE_CREATED]`
- `[FIELD_CLOSURE_AUDIT_CREATED]`

## Replay Doctrine

Replay may use:

1. Field Closure event.
2. approved Work Package.
3. evidence ids.
4. ScopeVersion `FIELD_CLOSE`.
5. audit record.

Replay may not infer closure authority from Field workspace state alone.

