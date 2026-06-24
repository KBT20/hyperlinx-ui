# Control Activation Audit Model

Status: doctrine and read-only audit contract.

## Purpose

Control Activation audits record why activation was approved or rejected.

Audits support replay without relying on UI state, transient workspace state, or passive logs.

## Audit Fields

A Control Activation audit records:

- `auditId`.
- `scopeVersionId`.
- `customerId`.
- `opportunityId`.
- `corridorId`.
- lifecycle state.
- activation status.
- blocker ids.
- close ids.
- actor id.
- actor role.
- lifecycle transition results.
- timestamp.
- diagnostics.

## Diagnostic Events

Control Activation may emit:

- `[CONTROL_READINESS_STARTED]`
- `[CONTROL_REQUIREMENTS_VALIDATED]`
- `[CONTROL_BLOCKER_IDENTIFIED]`
- `[CONTROL_READY]`
- `[CONTROL_ACTIVATION_APPROVED]`
- `[CONTROL_ACTIVATION_REJECTED]`
- `[CONTROL_AUDIT_CREATED]`

## Replay Doctrine

Replay must use:

1. ScopeVersion traceability.
2. validated `CONTRACT_CLOSE`.
3. Control activation readiness evidence.
4. validated `CONTROL_CLOSE`.
5. lifecycle transition authority results.
6. audit records.

Replay may not infer Control activation from budget lock, contract readiness, Prism output, or quote status.

