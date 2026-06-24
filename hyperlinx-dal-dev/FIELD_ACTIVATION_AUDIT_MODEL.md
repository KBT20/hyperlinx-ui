# Field Activation Audit Model

Status: doctrine and read-only audit contract.

## Purpose

Field Activation audits record why Field activation was approved or rejected.

Audits preserve replayable authority context without relying on UI state or transient Field workspace state.

## Audit Fields

A Field Activation audit records:

- `auditId`.
- `scopeVersionId`.
- `customerId`.
- `opportunityId`.
- `corridorId`.
- lifecycle state.
- activation status.
- Work Package ids.
- blocker ids.
- close ids.
- actor id.
- actor role.
- lifecycle transition results.
- timestamp.
- diagnostics.

## Diagnostic Events

Field Activation may emit:

- `[FIELD_READINESS_STARTED]`
- `[FIELD_REQUIREMENTS_VALIDATED]`
- `[FIELD_BLOCKER_IDENTIFIED]`
- `[FIELD_READY]`
- `[FIELD_ACTIVATION_APPROVED]`
- `[FIELD_ACTIVATION_REJECTED]`
- `[FIELD_AUDIT_CREATED]`

## Replay Doctrine

Replay may verify Field activation from:

1. ScopeVersion traceability.
2. `CONTROL_ACTIVE`.
3. approved Work Packages.
4. validated `FIELD_CLOSE`.
5. lifecycle transition authority results.
6. audit records.

Replay may not infer Field activation from Control readiness, Marketplace status, contract status, or map display state.

