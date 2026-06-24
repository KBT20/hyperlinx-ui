# Control Activation Requirements

Status: doctrine and read-only requirement contract.

## Required Traceability

Control activation requires:

- valid `scopeVersionId`.
- valid `customerId`.
- valid `opportunityId`.
- valid `corridorId`.

No orphan Control activation records.

No Control activation outside ScopeVersion authority.

## Required Authority

Control activation requires:

- validated `CONTRACT_CLOSE`.
- lifecycle state equal to `CONTRACT_EXECUTED`.
- Lifecycle Authority approval for `CONTRACT_EXECUTED -> CONTROL_READY`.
- validated `CONTROL_CLOSE`.
- Lifecycle Authority approval for `CONTROL_READY -> CONTROL_ACTIVE`.

## Required References

Control activation requires:

- approved engineering package.
- approved budget.
- approved vendor selections.
- approved object package.
- approved execution strategy.
- required design standards satisfied.
- required reference architecture selected.
- required close chain validated.
- no unresolved critical blockers.

## Future Boundary

The requirements prepare future:

- work package generation.
- station assignment.
- segment assignment.
- crew assignment.
- schedule creation.
- Field activation.

They do not implement those behaviors in this phase.

