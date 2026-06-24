# Control Readiness Model

Status: doctrine and read-only model contract.

## Status Values

Control readiness and activation use:

- `NOT_READY`
- `REVIEW_REQUIRED`
- `CONTROL_READY`
- `CONTROL_ACTIVE`

## Meaning

`CONTROL_READY` means a ScopeVersion has passed readiness checks and can be evaluated for Control activation authority.

`CONTROL_ACTIVE` means activation authority has been approved through close authority and lifecycle authority.

Neither status creates work packages in this phase.

## Readiness Inputs

Control readiness evaluates:

- ScopeVersion traceability.
- lifecycle state.
- validated close chain.
- approved engineering package.
- approved budget.
- approved vendor selections.
- approved object package.
- execution strategy.
- design standards approval.
- reference architecture.
- critical risk context.

## Work Package Generation Alignment

Control readiness prepares Control activation.

Only `CONTROL_ACTIVE` authorizes Work Package generation.

Work Packages organize execution after Control authority exists.

Field activation requires approved Work Packages and separate Field authority.
