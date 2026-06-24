# Field Activation Requirements

Status: doctrine and read-only requirement contract.

## Required Traceability

Field activation requires:

- valid `scopeVersionId`.
- valid `customerId`.
- valid `opportunityId`.
- valid `corridorId`.

## Required Authority

Field activation requires:

- lifecycle state `CONTROL_ACTIVE`.
- approved Work Packages.
- Lifecycle Authority approval for `CONTROL_ACTIVE -> FIELD_READY`.
- validated `FIELD_CLOSE`.
- Lifecycle Authority approval for `FIELD_READY -> FIELD_ACTIVE`.

## Required Allocations

Field activation requires:

- station allocations.
- segment allocations.
- object allocations.
- vendor allocations.
- approved execution package.
- required design standards.
- required dependencies satisfied.
- no unresolved critical blockers.

## Future Boundary

Field activation only authorizes execution.

Future phases define:

- Field Closure Authority.
- Completion Authority.
- Operations Authority.

