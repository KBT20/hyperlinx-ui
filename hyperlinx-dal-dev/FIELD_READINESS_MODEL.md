# Field Readiness Model

Status: doctrine and read-only readiness contract.

## Status Values

Field readiness and activation use:

- `NOT_READY`
- `REVIEW_REQUIRED`
- `FIELD_READY`
- `FIELD_ACTIVE`

## Meaning

`FIELD_READY` means all required Field activation prerequisites are present.

`FIELD_ACTIVE` means Field activation authority has been approved through close authority and lifecycle authority.

Neither status performs Field closure.

## Readiness Inputs

Field readiness evaluates:

- ScopeVersion traceability.
- lifecycle state.
- approved Work Packages.
- station allocations.
- segment allocations.
- object allocations.
- vendor allocations.
- execution package reference.
- dependency satisfaction reference.
- required design standards.
- critical risk context.

